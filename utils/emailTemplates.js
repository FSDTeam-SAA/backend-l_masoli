const layout = (title, body) => `
<div style="font-family:Segoe UI,Helvetica,Arial,sans-serif;background:#f5f7fb;padding:32px 16px">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;padding:32px">
    <h1 style="margin:0 0 8px;font-size:22px;color:#0f172a">My Dream Board</h1>
    <h2 style="margin:0 0 20px;font-size:17px;color:#334155;font-weight:600">${title}</h2>
    ${body}
    <p style="margin:28px 0 0;font-size:12px;color:#94a3b8">
      If you did not request this email you can safely ignore it.
    </p>
  </div>
</div>
`;

export const otpTemplate = ({ otp, expiresInMinutes, purpose }) =>
  layout(
    purpose === 'password_reset' ? 'Reset your password' : 'Verify your email',
    `
    <p style="margin:0 0 20px;font-size:14px;color:#475569;line-height:1.6">
      Use the verification code below to continue. It expires in ${expiresInMinutes} minutes.
    </p>
    <div style="text-align:center;margin:24px 0">
      <span style="display:inline-block;font-size:32px;letter-spacing:12px;font-weight:700;color:#2563eb;background:#eff6ff;padding:16px 24px;border-radius:12px">
        ${otp}
      </span>
    </div>
    <p style="margin:0;font-size:13px;color:#64748b">Never share this code with anyone.</p>
  `
  );

export const passwordChangedTemplate = ({ userName }) =>
  layout(
    'Your password was changed',
    `
    <p style="margin:0;font-size:14px;color:#475569;line-height:1.6">
      Hi ${userName}, your password was changed successfully and every other session has been signed out.
      If this was not you, please reset your password immediately.
    </p>
  `
  );

export const welcomeTemplate = ({ userName }) =>
  layout(
    'Welcome to My Dream Board',
    `
    <p style="margin:0;font-size:14px;color:#475569;line-height:1.6">
      Hi ${userName}, your account is verified. Create your first goal, break it into small milestones,
      and build the vision board that keeps you inspired.
    </p>
  `
  );
