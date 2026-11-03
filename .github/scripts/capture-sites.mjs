import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const sites = [
  { slug: 'nikko-turismo', url: 'https://nikkoturismo.com.br/' },
  { slug: 'nc-vinilicos', url: 'https://ncvinilicos.com.br/' },
  { slug: 'primekore', url: 'https://primekore.com.br/' },
  { slug: 'costao-matsuri', url: 'https://nikkoturismo.com.br/costao-matsuri/' }
];

await mkdir(resolve('assets/previews'), { recursive: true });
const browser = await chromium.launch({ headless: true });
let failures = 0;

try {
  for (const site of sites) {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 800 },
      deviceScaleFactor: 1,
      locale: 'pt-BR',
      reducedMotion: 'reduce',
      colorScheme: 'light'
    });
    try {
      const response = await page.goto(site.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      if (!response || response.status() >= 400) {
        throw new Error('Unexpected HTTP status: ' + (response?.status() ?? 'none'));
      }
      const expectedHost = new URL(site.url).hostname.replace(/^www\./, '');
      const actualHost = new URL(page.url()).hostname.replace(/^www\./, '');
      if (actualHost !== expectedHost) {
        throw new Error('Unexpected redirect to ' + actualHost);
      }
      await page.waitForLoadState('networkidle', { timeout: 12000 }).catch(() => {});
      await page.evaluate(async () => {
        await Promise.race([
          document.fonts.ready,
          new Promise(r => setTimeout(r, 4500))
        ]);
      });
      await page.waitForTimeout(1500);
      await page.screenshot({
        path: resolve('assets/previews', site.slug + '.jpg'),
        type: 'jpeg',
        quality: 84,
        fullPage: false,
        animations: 'disabled',
        timeout: 30000
      });
      console.log('Captured', site.slug, page.url(), response.status());
    } catch (error) {
      failures++;
      console.error('FAILED', site.slug, String(error));
    } finally {
      await page.close();
    }
  }
} finally {
  await browser.close();
}
if (failures > 0) {
  console.error(failures + ' captures did not succeed');
  process.exitCode = 1;
}