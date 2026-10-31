import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { mailConfigurationIssues, validateMailConfiguration, validateProductionMailConfiguration } from '../config/mailer.js';

const valid = {
  NODE_ENV: 'production', MAIL_HOST: 'smtp.provider.invalid', MAIL_PORT: 587,
  MAIL_SECURE: false, MAIL_USER: 'fixture-user', MAIL_PASS: 'fixture-only-not-a-secret',
  MAIL_FROM: 'My Dream Board <hello@mydreamboard.app>', MAIL_REPLY_TO: 'hello@mydreamboard.app'
};

test('production validates every mail field and never echoes configured values', () => {
  assert.deepEqual(mailConfigurationIssues(valid), []);
  for (const field of ['MAIL_HOST', 'MAIL_PORT', 'MAIL_SECURE', 'MAIL_USER', 'MAIL_PASS', 'MAIL_FROM', 'MAIL_REPLY_TO']) {
    const settings = { ...valid, [field]: undefined };
    assert.throws(() => validateProductionMailConfiguration(settings), (error) => {
      assert.equal(error.code, 'MAIL_CONFIGURATION');
      assert.ok(error.message.includes(field));
      assert.ok(!error.message.includes(valid.MAIL_PASS));
      assert.ok(!error.message.includes(valid.MAIL_USER));
      return true;
    });
  }
  for (const settings of [
    { ...valid, MAIL_HOST: 'https://credential-marker.invalid' },
    { ...valid, MAIL_PORT: 0 }, { ...valid, MAIL_PORT: NaN },
    { ...valid, MAIL_PORT: 65536 }, { ...valid, MAIL_SECURE: 'false' },
    { ...valid, MAIL_FROM: 'bad\r\nBcc: other@example.invalid' },
    { ...valid, MAIL_REPLY_TO: 'one@example.invalid,two@example.invalid' }
  ]) {
    assert.throws(() => validateProductionMailConfiguration(settings), (error) => {
      assert.ok(!error.message.includes('credential-marker'));
      assert.ok(!error.message.includes('Bcc:'));
      return true;
    });
  }
  assert.doesNotThrow(() => validateProductionMailConfiguration({ NODE_ENV: 'development' }));
  // The deliberate email-test command uses strict validation even in dev.
  assert.throws(() => validateMailConfiguration({ NODE_ENV: 'development' }));
});

const isolated = (source, extraEnv = {}) => {
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', source], {
    cwd: new URL('../', import.meta.url), encoding: 'utf8', timeout: 10_000,
    env: { ...process.env, NODE_ENV: 'production', MAIL_HOST: 'smtp.provider.invalid',
      MAIL_PORT: '587', MAIL_SECURE: 'false', MAIL_USER: 'provider-fixture-user',
      MAIL_PASS: 'provider-fixture-secret', MAIL_FROM: '', MAIL_REPLY_TO: '',
      APP_PUBLIC_URL: 'https://example.test', EMAIL_LOGO_URL: '', ...extraEnv }
  });
  assert.equal(result.status, 0, result.stderr);
};

test('SMTP remains provider-neutral, caches one transport and handles implicit TLS and STARTTLS', () => {
  for (const secure of [false, true]) {
    isolated(`
      import assert from 'node:assert/strict';
      import nodemailer from 'nodemailer';
      let transports = 0;
      let configuration;
      const messages = [];
      nodemailer.createTransport = (options) => {
        transports++;
        configuration = options;
        return { sendMail: async (message) => messages.push(message) };
      };
      const { sendOtpEmail, sendWelcomeEmail, sendPasswordChangedEmail } = await import('./utils/email.js');
      await sendOtpEmail({ to: 'fixture@example.invalid', otp: '000000', purpose: 'email_verification' });
      await sendOtpEmail({ to: 'fixture@example.invalid', otp: '000000', purpose: 'password_reset' });
      await sendWelcomeEmail({ to: 'fixture@example.invalid' });
      await sendPasswordChangedEmail({ to: 'fixture@example.invalid', userName: 'Fixture' });
      assert.equal(transports, 1);
      assert.equal(configuration.host, 'smtp.provider.invalid');
      assert.equal(configuration.port, ${secure ? 465 : 587});
      assert.equal(configuration.secure, ${secure});
      assert.equal(configuration.requireTLS, ${!secure});
      assert.equal(Object.hasOwn(configuration, 'service'), false);
      assert.equal(configuration.auth.user, 'provider-fixture-user');
      assert.equal(configuration.auth.pass, 'provider-fixture-secret');
      assert.equal(messages.length, 4);
      for (const message of messages) {
        assert.equal(message.from, 'My Dream Board <hello@mydreamboard.app>');
        assert.equal(message.replyTo, 'hello@mydreamboard.app');
      }
      assert.equal(messages[0].subject, 'Verify your email');
      assert.equal(messages[1].subject, 'Reset your password');
      assert.equal(messages[3].subject, 'Your password was changed');
      assert.equal(Object.hasOwn(messages[0], 'text'), false);
      assert.ok(messages[2].html && messages[2].text);
    `, { MAIL_PORT: secure ? '465' : '587', MAIL_SECURE: String(secure) });
  }
});

test('development without MAIL settings logs the email and ignores old personal-mailbox SMTP settings', () => {
  isolated(`
    import assert from 'node:assert/strict';
    import nodemailer from 'nodemailer';
    let transports = 0;
    const logs = [];
    nodemailer.createTransport = () => { transports++; throw new Error('No transport expected'); };
    console.info = (...args) => logs.push(args);
    console.warn = () => {};
    const { sendOtpEmail } = await import('./utils/email.js');
    const sent = await sendOtpEmail({ to: 'fixture@example.invalid', otp: '000000', purpose: 'email_verification' });
    assert.equal(sent, false);
    assert.equal(transports, 0);
    const mail = logs.find((args) => args[0] === '[mail:console]')[1];
    assert.equal(mail.to, 'fixture@example.invalid');
    assert.equal(mail.subject, 'Verify your email');
    assert.ok(mail.html.includes('000000'));
  `, { NODE_ENV: 'development', MAIL_HOST: '', MAIL_PORT: '', MAIL_SECURE: '', MAIL_USER: '', MAIL_PASS: '',
    SMTP_HOST: 'legacy.invalid', SMTP_USER: 'legacy-fixture', SMTP_PASS: 'unused-fixture-only' });
});

test('SMTP failures preserve false returns and OTP issuance behavior without leaking provider errors', () => {
  isolated(`
    import assert from 'node:assert/strict';
    import nodemailer from 'nodemailer';
    const logs = [];
    console.error = (...args) => logs.push(args);
    nodemailer.createTransport = () => ({ sendMail: async () => {
      throw Object.assign(new Error('LEAK-MARKER provider-fixture-secret'), {
        code: 'EAUTH', responseCode: 535, response: 'LEAK-MARKER raw SMTP auth response'
      });
    }});
    const { sendOtpEmail, sendWelcomeEmail, sendPasswordChangedEmail } = await import('./utils/email.js');
    assert.equal(await sendOtpEmail({ to: 'fixture@example.invalid', otp: '000000', purpose: 'email_verification' }), false);
    assert.equal(await sendOtpEmail({ to: 'fixture@example.invalid', otp: '000000', purpose: 'password_reset' }), false);
    assert.equal(await sendWelcomeEmail({ to: 'fixture@example.invalid' }), false);
    assert.equal(await sendPasswordChangedEmail({ to: 'fixture@example.invalid', userName: 'Fixture' }), false);
    const Otp = (await import('./models/otp.model.js')).default;
    Otp.findOne = () => ({ sort: async () => null });
    Otp.findOneAndUpdate = async () => ({});
    const { issueOtp } = await import('./services/auth.service.js');
    const issued = await issueOtp({ email: 'fixture@example.invalid', type: 'password_reset' });
    assert.equal(issued.email, 'fixture@example.invalid');
    assert.ok(issued.expiresIn > 0);
    const output = JSON.stringify(logs);
    assert.ok(output.includes('EAUTH') && output.includes('535'));
    assert.ok(!output.includes('LEAK-MARKER'));
    assert.ok(!output.includes('provider-fixture-secret'));
    assert.ok(!output.includes('raw SMTP auth response'));
  `);
});

test('invalid production environment produces a clear startup-validation error with no secret value', () => {
  isolated(`
    import assert from 'node:assert/strict';
    const { validateProductionMailConfiguration } = await import('./config/mailer.js');
    assert.throws(() => validateProductionMailConfiguration(), (error) => {
      assert.equal(error.code, 'MAIL_CONFIGURATION');
      assert.ok(error.message.includes('MAIL_HOST'));
      assert.ok(error.message.includes('MAIL_SECURE'));
      assert.ok(!error.message.includes('LEAK-MARKER'));
      return true;
    });
  `, { MAIL_HOST: 'LEAK-MARKER invalid hostname', MAIL_SECURE: 'LEAK-MARKER-invalid-boolean' });
});
