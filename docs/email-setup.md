Production delivery uses Nodemailer with ordinary authenticated SMTP. Choose a
transactional email provider that supports domain authentication and SMTP
credentials. No provider SDK, personal email password, or personal app password
is required. A provider's HTTP API key works as `MAIL_PASS` only if that provider
explicitly documents that use; otherwise generate its dedicated SMTP credential.

## Audit and existing email flows

The audit inspected the mail utility, templates, callers, environment loading,
start scripts, tracked configuration and seven reachable configuration-history
revisions. No hardcoded personal mailbox credentials or committed mail secrets
were found in that scope. The local `.env` is ignored and does contain a legacy
personal-mailbox SMTP configuration; no values were printed or copied into git.
Git history was not changed. This does not assess remote deployment secrets or
unavailable/unreachable git history.

Before this change, `config/mailer.js` read `SMTP_HOST`, `SMTP_PORT`,
`SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, and `MAIL_FROM` from `config/env.js`.
That config uses `dotenv/config`: server environment variables take precedence
over the ignored local `.env`. `NODE_ENV` controls production/development
behavior; `OTP_EXPIRES_MINUTES` supplies template content. `APP_PUBLIC_URL` and
`EMAIL_LOGO_URL` control welcome-email links and imagery, not authentication.

All sends now pass through `sendMail({ to, subject, html, text })` in
`utils/email.js` and one cached transport in `config/mailer.js`:

| Flow | Existing call path |
| --- | --- |
| Verification OTP | `register` → `issueOtp` → `sendOtpEmail`; unverified `login` also calls `issueOtp` |
| Resend verification/reset OTP | `resendOtp` → `issueOtp` → `sendOtpEmail`, with the existing purpose |
| Forgot-password OTP | `forgotPassword` → `issueOtp` → `sendOtpEmail` with `password_reset` |
| Welcome | First successful `/verify-email` (`verifyEmail`) when `wasUnverified` is true → `sendWelcomeEmail` |
| Password-reset confirmation | `resetPassword` → `sendPasswordChangedEmail` |
| Password-change confirmation | `changePassword` → `sendPasswordChangedEmail` |

The separate `/verify-otp` handler verifies verification/reset codes and returns
tokens, but does not itself send email or call the welcome trigger. That existing
behavior is unchanged.

OTP/verification/reset subjects, templates, code generation, expiry, persistence,
triggers and API responses are unchanged. As before, SMTP delivery failures log
and return `false`; `issueOtp` and the password-reset/change callers do not turn
that result into an API failure. Welcome rendering or sending failures are
best-effort and never fail verification/registration. Production logs omit raw
SMTP errors/responses, credentials, and message bodies.

`npm start` runs `node server.js`; `npm run dev` uses Nodemon (and the existing
predev port-cleanup command). Production mail validation runs before database
connection, listening, or jobs. No dedicated deployment/CI/container secret
configuration was found in the inspected repository.

## Environment variables

| Variable | Required / default | Meaning |
| --- | --- | --- |
| `MAIL_HOST` | Required for SMTP | Provider's SMTP hostname, not a connection URL |
| `MAIL_PORT` | Required for SMTP | Explicit integer port; commonly `587` for STARTTLS or `465` for implicit TLS |
| `MAIL_SECURE` | Required for SMTP | `false` for STARTTLS; `true` for TLS from connection start; `1`/`0` also accepted |
| `MAIL_USER` | Required for SMTP | Provider-issued SMTP username (which may be a fixed string or generated ID) |
| `MAIL_PASS` | Required for SMTP | Provider-issued SMTP secret, or API key if supported as its SMTP password |
| `MAIL_FROM` | `My Dream Board <hello@mydreamboard.app>` | Verified business sender |
| `MAIL_REPLY_TO` | `hello@mydreamboard.app` | Business mailbox that receives replies |
| `NODE_ENV` | Existing default `development` | Set `production` on the production server |

Use the exact port/security combination supplied by the provider. Production
STARTTLS connections require a successful TLS upgrade. Certificate verification
stays enabled. Nodemailer documents these options in its
[SMTP transport guide](https://nodemailer.com/smtp).

In development/test, incomplete mail settings cause the message (including an
OTP, when applicable) to be logged locally, without sending or failing. In
production, incomplete/invalid configuration prevents startup with a clear error
containing field names only. Startup validation checks settings, not network
reachability, DNS authentication, SMTP login, or inbox delivery.

The old `SMTP_*` names are no longer read. Before rolling out this change,
configure all `MAIL_*` values in the deployment environment. Do not copy a
personal mailbox password from the old local `.env`; use the business provider's
transactional credential. Existing local `.env` contents have not been modified.

## Domain-owner DNS setup

Add `mydreamboard.app` to the chosen provider's sending-domain dashboard. Copy
the exact record names, types, values, selectors and regions that it generates.
The placeholders below describe those records; they are not deployable values.

| Record | Name | Value / action |
| --- | --- | --- |
| SPF `TXT` | Provider's specified envelope/return-path domain, sometimes `@`, sometimes a subdomain | Provider's exact `v=spf1 ...` value or SMTP-provider `include:` mechanism, merged with existing authorized senders at the same name |
| DKIM `TXT` or `CNAME` | Provider-generated selector(s), typically `<selector>._domainkey` | Provider's public key or CNAME target; add every requested selector |
| DMARC `TXT` | `_dmarc.mydreamboard.app` (often enter `_dmarc` in the DNS UI) | For an initial monitoring setup: `v=DMARC1; p=none; rua=mailto:hello@mydreamboard.app` |
| Other verification / bounce records | Only the provider-specified names | Add its verification TXT/CNAME or return-path subdomain MX if required |

**There can be only one SPF record per DNS owner name.** If an SPF record already
exists, merge the provider's `include:` into it before the final `~all` or `-all`;
do not add a second `v=spf1` TXT record, and preserve existing legitimate senders.
This also applies when more than one service sends for the business. An
illustrative combined record is
`v=spf1 include:existing-sender.example include:new-provider.example ~all`;
replace both example mechanisms with verified real values and review SPF's
DNS-lookup limit. See [SPF RFC 7208](https://www.rfc-editor.org/rfc/rfc7208.html#section-3.2).

Preserve the existing inbound MX records that deliver `hello@mydreamboard.app`.
Any provider-required bounce MX belongs at its specified subdomain, not in place
of the business mailbox's root MX. DKIM signing is performed by the provider;
only its public DNS records belong in DNS, not a private signing key in this app.

Start a new DMARC setup at `p=none` to monitor, then review reports with the domain
owner before moving to enforcement. If a DMARC policy already exists, reconcile
the new provider with that policy rather than creating a duplicate record or
blindly weakening it. Ensure DKIM's signing domain and/or the SPF-authenticated
return-path domain align with the `From` domain. Independent SPF/DKIM passes do
not guarantee DMARC alignment. See
[Google sender requirements](https://support.google.com/mail/answer/81126?hl=en)
and [Microsoft DMARC guidance](https://learn.microsoft.com/en-us/microsoft-365/security/office-365-security/use-dmarc-to-validate-email).

## Setup steps

1. Create a business-owned transactional provider account, verify the sending
   domain, and authorize `hello@mydreamboard.app` as the sender. Keep ownership
   and recovery with the business rather than an individual's mailbox account.
2. Have the domain owner add/reconcile SPF, DKIM, DMARC and any provider-required
   verification records above. Wait for the provider's domain checks to pass.
3. Generate a send-only SMTP credential with the least privileges supported by
   that provider. Record the SMTP hostname, port, TLS mode and username.
4. Put `MAIL_PASS` into the hosting platform's secret/environment-variable UI
   or secret manager, available to the Node process as a **server environment
   variable**. Never send the credential in git, an issue, chat, a screenshot,
   a client application, or a command line. Configure the remaining `MAIL_*`
   variables there too, using the official From/Reply-To defaults above.
5. Set `NODE_ENV=production`. Apply the environment to the API service and
   restart it using its existing deployment process. It will refuse startup if
   a required mail setting is missing. Do not print the environment to debug it.
6. From an authorized server/operator environment, run a deliberate test to an
   inbox you control (the command sends exactly one welcome message):

   ```sh
   npm run email:test -- someone@example.com
   ```

   Repeat with controlled Gmail and Outlook inboxes for verification. The
   command does not start the server or connect to the application database.
   It refuses console fallback and exits unsuccessfully if sending fails.
   SMTP acceptance means submission, not guaranteed inbox delivery.
7. Check the recipient headers and real authentication flows below. Rotate
   provider credentials through the same secret manager and restart the service
   when needed; credentials are cached for the life of the Node process.

## Verification checklist

- Send a welcome email to controlled Gmail and Outlook inboxes; verify the
  business sender, `Reply-To: hello@mydreamboard.app`, logo and Start Dreaming
  link, and confirm both HTML and plain-text MIME alternatives are present.
- In Gmail choose **More → Show original**. In new/web Outlook choose
  **More actions → View → View message details**; classic Outlook uses
  **File → Properties → Internet headers**. See
  [Gmail authentication help](https://support.google.com/mail/answer/180707)
  and [Outlook header instructions](https://support.microsoft.com/en-gb/outlook/view-internet-message-headers-in-outlook).
- In the receiving system's `Authentication-Results`, confirm **`spf=pass`**,
  **`dkim=pass`**, and **`dmarc=pass`**. Check `header.from=mydreamboard.app`
  and aligned signing/return-path domains, not just the provider's domain.
- Use controlled test accounts to check registration OTP, verification/resend,
  forgot-password/reset OTP and confirmation, and change-password confirmation.
  Check code expiry and successful completion, then check welcome remains a
  one-time send after the first successful `/verify-email` verification.
- Confirm production has no console email bodies/OTP codes/credentials, that
  missing mail configuration produces a secret-free startup error, and that
  welcome-send failure does not fail account verification.

The implementation work does not run `email:test`, send live email, change DNS,
start the server, or deploy anything. Those are the operator's setup steps.
