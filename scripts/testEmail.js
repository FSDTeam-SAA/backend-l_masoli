import { validateMailConfiguration } from '../config/mailer.js';
import { sendWelcomeEmail } from '../utils/email.js';

// Deliberately explicit, single-recipient and never a server/database startup.
// Do not import this command from application startup or the preview script.
const [recipient, ...extra] = process.argv.slice(2);
try {
  if (extra.length || !recipient || !/^[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+$/.test(recipient)) {
    console.error('Usage: npm run email:test -- someone@example.com (one recipient)');
    process.exitCode = 1;
  } else {
    // Refuse console fallback: this command must exercise configured SMTP.
    validateMailConfiguration();
    const sent = await sendWelcomeEmail({ to: recipient });
    if (!sent) {
      console.error('Welcome email was not submitted. Check mail configuration and sanitized mail logs.');
      process.exitCode = 1;
    } else {
      console.info('One welcome email was submitted through the configured SMTP transport. Check the recipient inbox and authentication headers.');
    }
  }
} catch (error) {
  console.error(error.code === 'MAIL_CONFIGURATION'
    ? error.message
    : 'Unable to submit the test email. Check the server mail configuration.');
  process.exitCode = 1;
}
