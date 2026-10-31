import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import helmet from 'helmet';
import app from '../app.js';
import { buildWelcomeEmail, EMAIL_LOGO_PATH } from '../templates/welcomeEmail.js';
import { validateEmailHtml } from '../scripts/previewWelcomeEmail.js';

test('welcome URLs resolve independently, stay HTTPS and escape HTML attributes', () => {
  const email = buildWelcomeEmail({ appPublicUrl: 'https://example.test/start?a=1&b=2', logoUrl: '' });
  assert.ok(email.html.includes('href="https://example.test/start?a=1&amp;b=2"'));
  assert.ok(email.html.includes(`src="https://example.test${EMAIL_LOGO_PATH}"`));
  assert.ok(email.text.includes('https://example.test/start?a=1&b=2'));
  assert.equal(validateEmailHtml(email.html).images, 1);
  const customLogo = buildWelcomeEmail({ appPublicUrl: 'https://example.test', logoUrl: 'https://cdn.example.test/logo.png' });
  assert.ok(customLogo.html.includes('src="https://cdn.example.test/logo.png"'));
  for (const appPublicUrl of ['/relative', 'http://example.test', 'https://user:password@example.test']) {
    assert.throws(() => buildWelcomeEmail({ appPublicUrl }));
  }
  assert.throws(() => buildWelcomeEmail({ appPublicUrl: 'https://example.test', logoUrl: '/relative.png' }));
});

test('preview validator rejects oversize HTML, missing alt, relative and non-HTTPS URLs including Outlook', () => {
  const { html } = buildWelcomeEmail({ appPublicUrl: 'https://example.test', logoUrl: '' });
  assert.throws(() => validateEmailHtml(`${html}${' '.repeat(100_000)}`), /under 100KB/);
  assert.throws(() => validateEmailHtml(html.replace('alt="My Dream Board"', '')), /alt text/);
  assert.throws(() => validateEmailHtml(html.replace('alt="My Dream Board"', 'alt=""')), /alt text/);
  assert.throws(() => validateEmailHtml(html.replace(/src="[^"]+"/, 'src="/logo.png"')), /absolute HTTPS/);
  assert.throws(() => validateEmailHtml(html.replace(/href="[^"]+"/, 'href="http://example.test"')), /absolute HTTPS/);
  assert.throws(() => validateEmailHtml(html.replace(/(<v:roundrect[^>]*?)href="[^"]+"/, '$1href="/start"')), /absolute HTTPS/);
});

test('the single static PNG route overrides Helmet CORP without opening a server', async () => {
  const headers = new Map();
  let file;
  const res = {
    setHeader(name, value) { headers.set(name.toLowerCase(), value); },
    getHeader(name) { return headers.get(name.toLowerCase()); },
    removeHeader(name) { headers.delete(name.toLowerCase()); },
    sendFile(path, options) {
      file = path;
      for (const [name, value] of Object.entries(options.headers)) this.setHeader(name, value);
    }
  };
  await new Promise((resolve) => helmet()({ headers: {} }, res, resolve));
  assert.equal(res.getHeader('Cross-Origin-Resource-Policy'), 'same-origin');
  const route = app._router.stack.find((layer) => layer.route?.path === EMAIL_LOGO_PATH);
  assert.ok(route?.route.methods.get);
  route.route.stack[0].handle({}, res);
  assert.equal(res.getHeader('Cross-Origin-Resource-Policy'), 'cross-origin');
  const png = await readFile(file);
  assert.ok(png.length < 100_000);
  assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.equal(png.readUInt32BE(16), 480);
  assert.equal(png.readUInt32BE(20), 480);
});

const isolated = (source, extraEnv = {}) => {
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', source], {
    cwd: new URL('../', import.meta.url), encoding: 'utf8', timeout: 10_000,
    env: { ...process.env, NODE_ENV: 'test', MAIL_HOST: 'fixture.invalid', MAIL_PORT: '587',
      MAIL_SECURE: 'false', MAIL_USER: 'fixture', MAIL_PASS: 'fixture-only-not-a-secret',
      MAIL_FROM: '', MAIL_REPLY_TO: '', APP_PUBLIC_URL: 'https://example.test', EMAIL_LOGO_URL: '', ...extraEnv }
  });
  assert.equal(result.status, 0, result.stderr);
};

test('stubbed transport receives multipart welcome only; transport failures remain non-fatal', () => {
  isolated(`
    import assert from 'node:assert/strict';
    import nodemailer from 'nodemailer';
    const messages = [];
    let fail = false;
    nodemailer.createTransport = () => ({ sendMail: async (mail) => {
      if (fail) throw new Error('Fixture transport failure');
      messages.push(mail);
    }});
    console.info = () => {};
    console.error = () => {};
    const { sendWelcomeEmail, sendOtpEmail, sendPasswordChangedEmail } = await import('./utils/email.js');
    assert.equal(await sendWelcomeEmail({ to: 'nobody@example.invalid', userName: 'DoNotPersonalize' }), true);
    assert.equal(messages[0].subject, 'Welcome to My Dream Board — Your Journey Begins!');
    assert.ok(messages[0].html.startsWith('<!doctype html>'));
    assert.ok(messages[0].text.includes('Your dream journey starts here.'));
    assert.ok(!messages[0].html.includes('DoNotPersonalize'));
    assert.ok(!messages[0].text.includes('DoNotPersonalize'));
    await sendOtpEmail({ to: 'nobody@example.invalid', otp: '000000', purpose: 'email_verification' });
    await sendPasswordChangedEmail({ to: 'nobody@example.invalid', userName: 'Fixture' });
    assert.equal(Object.hasOwn(messages[1], 'text'), false);
    assert.equal(messages[1].subject, 'Verify your email');
    assert.equal(Object.hasOwn(messages[2], 'text'), false);
    assert.equal(messages[2].subject, 'Your password was changed');
    fail = true;
    assert.equal(await sendWelcomeEmail({ to: 'nobody@example.invalid' }), false);
  `);
});

test('a welcome rendering/configuration failure returns false before transport construction', () => {
  isolated(`
    import assert from 'node:assert/strict';
    import nodemailer from 'nodemailer';
    let attempts = 0;
    nodemailer.createTransport = () => { attempts++; throw new Error('Must not construct transport'); };
    console.error = () => {};
    const { sendWelcomeEmail } = await import('./utils/email.js');
    assert.equal(await sendWelcomeEmail({ to: 'nobody@example.invalid' }), false);
    assert.equal(attempts, 0);
  `, { APP_PUBLIC_URL: 'http://example.test' });
});
