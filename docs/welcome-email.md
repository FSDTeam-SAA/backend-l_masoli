The welcome email is sent once from `controllers/auth.controller.js:verifyEmail`,
after OTP verification, when `wasUnverified` is true. Registration and verification
triggers are unchanged. The welcome wrapper returns `false` on rendering or
transport failures, so those failures do not interrupt verification.

`templates/welcomeEmail.js` renders the subject, HTML and plain-text parts. It
contains no personalization. Its colors match Flutter's `AppColors`: brandBlue
`#6D96CE`, navyHeading `#1B3B63`, textPrimary `#0F1222`, subtitleGray `#6B7280`,
cardBlueLight `#E0E8F5`, and white. Outlook uses a VML button; other clients use
the matching HTML button. The transparent PNG sits on a white header band,
including a white gradient to help retain that background in dark mode.

Configuration (also listed in `.env.example`):

- `APP_PUBLIC_URL`: button and footer destination; defaults to
  `https://mydreamboard.app`.
- `EMAIL_LOGO_URL`: optional image URL. Defaults to
  `/assets/email/my-dream-board-logo.png` on `APP_PUBLIC_URL`'s origin. If the API
  is hosted on a different domain, set this to the API's public HTTPS URL for
  that path (or a public HTTPS CDN copy).

Both URLs must be absolute HTTPS URLs without credentials. Delivery settings are
documented in [email-setup.md](email-setup.md). OTP, verification and
password-reset template content is unchanged.

`public/email/my-dream-board-logo.png` is a resized, compressed copy of Flutter's
`assets/icons/splashlogo.png`, 480 × 480px, displayed at 160 × 160px in the email.
The public GET route serves only this file and sets
`Cross-Origin-Resource-Policy: cross-origin`; all other routes retain Helmet's
existing policy.

To preview, from the backend directory:

```sh
npm run email:preview
```

Open `.email-preview/welcome.html` in a browser. A plain-text preview is written
alongside it as `welcome.txt`. Both files are gitignored. The script verifies
HTML and PNG sizes under 100,000 bytes, non-empty alt text on every image, and
absolute HTTPS image/link URLs (including the Outlook button). It does not start
the server, import the mail transport, send mail, or make network requests. The
browser loads the image from its configured public URL; that host must serve
the asset for the logo to appear. URL reachability is not checked by the script.
