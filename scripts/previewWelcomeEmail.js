import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildWelcomeEmail } from '../templates/welcomeEmail.js';

const MAX_BYTES = 100_000;

/** Local checks only; never fetch remote URLs or import the mail transport. */
export const validateEmailHtml = (html) => {
  const bytes = Buffer.byteLength(html, 'utf8');
  if (bytes >= MAX_BYTES) throw new Error(`HTML must be under 100KB (got ${bytes} bytes)`);
  const images = html.match(/<img\b[^>]*>/gi) || [];
  if (!images.length) throw new Error('The welcome logo is missing');
  for (const image of images) {
    const alt = image.match(/\balt\s*=\s*(["'])(.*?)\1/i);
    if (!alt || !alt[2].trim()) throw new Error('Every image must have non-empty alt text');
  }
  // Also checks the Outlook VML href, not just ordinary HTML anchors.
  for (const match of html.matchAll(/\b(?:href|src|background|action)\s*=\s*(?:(["'])(.*?)\1|([^\s>]+))/gi)) {
    const value = (match[2] ?? match[3]).replaceAll('&amp;', '&');
    let url;
    try { url = new URL(value); } catch { /* rejected below */ }
    if (!/^https:\/\//i.test(value) || !url || url.protocol !== 'https:') {
      throw new Error('Every link and image source must be an absolute HTTPS URL');
    }
  }
  return { bytes, images: images.length };
};

const preview = async () => {
  const { html, text } = buildWelcomeEmail();
  const checks = validateEmailHtml(html);
  const logo = await readFile(new URL('../public/email/my-dream-board-logo.png', import.meta.url));
  if (logo.length >= MAX_BYTES) throw new Error('The hosted PNG logo must be under 100KB');
  const directory = new URL('../.email-preview/', import.meta.url);
  await mkdir(directory, { recursive: true });
  await writeFile(new URL('welcome.html', directory), html, 'utf8');
  await writeFile(new URL('welcome.txt', directory), text, 'utf8');
  console.info(`Welcome preview: ${fileURLToPath(new URL('welcome.html', directory))}`);
  console.info(`Plain text: ${fileURLToPath(new URL('welcome.txt', directory))}`);
  console.info(`Checks passed: ${checks.bytes} HTML bytes; ${checks.images} image with alt text; all URLs absolute HTTPS; PNG ${logo.length} bytes.`);
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await preview();
}
