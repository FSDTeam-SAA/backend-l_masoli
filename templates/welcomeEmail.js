import env from '../config/env.js';

export const WELCOME_SUBJECT = 'Welcome to My Dream Board — Your Journey Begins!';
export const EMAIL_LOGO_PATH = '/assets/email/my-dream-board-logo.png';

// Keep these in sync with Flutter lib/core/theme/app_colors.dart.
const brand = {
  blue: '#6D96CE',
  navy: '#1B3B63',
  text: '#0F1222',
  muted: '#6B7280',
  paleBlue: '#E0E8F5',
  white: '#FFFFFF'
};

const copy = {
  heading: 'Welcome to My Dream Board!',
  lead: 'Your dream journey starts here.',
  introduction: "We're excited you've taken the first step toward turning your dreams into something you can see, plan, and achieve.",
  invitation: "Whether you're starting fresh, dreaming bigger, or rediscovering a dream you've put on hold, this is your space to imagine what's possible.",
  nextHeading: 'Your next step?',
  nextStep: 'Create your first Dream Board, add a dream that inspires you, and start bringing your vision to life.',
  button: 'Start Dreaming',
  tagline: 'Dream it. See it. Build it.',
  team: 'Welcome to the Dream Team!',
  signature: 'The My Dream Board Team',
  site: 'MyDreamBoard.app',
  footer: "You're receiving this email because you created a My Dream Board account."
};

const httpsUrl = (value, name) => {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password) {
    throw new Error(`${name} must be an absolute HTTPS URL without credentials`);
  }
  return url.href;
};

const attribute = (value) => value.replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[character]);

/** Pure rendering: no transport, database, server or personalization. */
export const buildWelcomeEmail = ({
  appPublicUrl = env.APP_PUBLIC_URL,
  logoUrl = env.EMAIL_LOGO_URL
} = {}) => {
  const siteUrl = httpsUrl(appPublicUrl, 'APP_PUBLIC_URL');
  const imageUrl = httpsUrl(logoUrl || new URL(EMAIL_LOGO_PATH, siteUrl).href, 'EMAIL_LOGO_URL');
  const href = attribute(siteUrl);
  const src = attribute(imageUrl);

  const html = `<!doctype html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>${WELCOME_SUBJECT}</title>
  <!--[if mso]><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml><![endif]-->
</head>
<body style="margin:0;padding:0;width:100%;background-color:${brand.paleBlue};-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  <div aria-hidden="true" style="display:none!important;visibility:hidden;opacity:0;height:0;width:0;max-height:0;max-width:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:${brand.paleBlue};">${copy.lead}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${brand.paleBlue}" style="width:100%;border-collapse:collapse;background-color:${brand.paleBlue};">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${brand.white}" style="width:100%;max-width:600px;border-collapse:collapse;background-color:${brand.white};font-family:Arial,Helvetica,sans-serif;color:${brand.text};">
          <tr>
            <td align="center" bgcolor="${brand.white}" style="padding:24px;background-color:${brand.white};background-image:linear-gradient(${brand.white},${brand.white});border-bottom:4px solid ${brand.blue};color-scheme:light;">
              <img src="${src}" width="160" height="160" alt="My Dream Board" style="display:block;width:160px;max-width:100%;height:auto;border:0;outline:none;text-decoration:none;color:${brand.text};">
            </td>
          </tr>
          <tr>
            <td style="padding:28px 24px 0;">
              <h1 style="margin:0 0 12px;font-size:28px;line-height:36px;font-weight:700;color:${brand.navy};">${copy.heading}</h1>
              <p style="margin:0 0 22px;font-size:20px;line-height:28px;font-weight:600;color:${brand.navy};">${copy.lead}</p>
              <p style="margin:0 0 18px;font-size:16px;line-height:26px;color:${brand.text};">${copy.introduction}</p>
              <p style="margin:0 0 24px;font-size:16px;line-height:26px;color:${brand.text};">${copy.invitation}</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${brand.paleBlue}" style="width:100%;border-collapse:collapse;background-color:${brand.paleBlue};">
                <tr>
                  <td style="padding:20px;">
                    <h2 style="margin:0 0 8px;font-size:20px;line-height:28px;color:${brand.navy};">${copy.nextHeading}</h2>
                    <p style="margin:0;font-size:16px;line-height:26px;color:${brand.text};">${copy.nextStep}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:24px;">
              <!--[if mso]>
              <v:roundrect xmlns:w="urn:schemas-microsoft-com:office:word" href="${href}" style="height:52px;v-text-anchor:middle;width:240px;" arcsize="16%" stroke="f" fillcolor="${brand.navy}">
                <w:anchorlock/>
                <center style="font-family:Arial,Helvetica,sans-serif;font-size:17px;font-weight:bold;color:${brand.white};">${copy.button}</center>
              </v:roundrect>
              <![endif]-->
              <!--[if !mso]><!-- -->
              <a href="${href}" style="display:inline-block;width:240px;max-width:100%;line-height:52px;background-color:${brand.navy};border-radius:8px;color:${brand.white};font-family:Arial,Helvetica,sans-serif;font-size:17px;font-weight:700;text-align:center;text-decoration:none;-webkit-text-size-adjust:none;mso-hide:all;">${copy.button}</a>
              <!--<![endif]-->
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:0 24px 24px;">
              <p style="margin:0;font-size:22px;line-height:30px;font-weight:700;color:${brand.navy};">${copy.tagline}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 24px 28px;">
              <p style="margin:0 0 16px;font-size:17px;line-height:26px;font-weight:600;color:${brand.text};">${copy.team}</p>
              <p style="margin:0 0 4px;font-size:15px;line-height:24px;color:${brand.text};">${copy.signature}</p>
              <a href="${href}" style="font-size:15px;line-height:24px;color:${brand.navy};text-decoration:underline;">${copy.site}</a>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 24px;border-top:1px solid ${brand.paleBlue};">
              <p style="margin:0;font-size:12px;line-height:20px;color:${brand.muted};">${copy.footer}</p>
            </td>
          </tr>
        </table>
        <!--[if mso]></td></tr></table><![endif]-->
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = [
    copy.heading, copy.lead, copy.introduction, copy.invitation,
    copy.nextHeading, copy.nextStep, `${copy.button}\n${siteUrl}`,
    copy.tagline, copy.team, copy.signature, `${copy.site}\n${siteUrl}`,
    copy.footer
  ].join('\n\n');

  return { subject: WELCOME_SUBJECT, html, text };
};
