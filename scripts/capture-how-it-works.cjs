/**
 * Captures real UI from the exported web build into assets/how-it-works/*.png
 * Run after: npx expo export --platform web
 *
 * Usage: node scripts/capture-how-it-works.cjs
 */
const http = require('http');
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const root = path.join(__dirname, '..');
const dist = path.join(root, 'dist');
const outDir = path.join(root, 'assets', 'how-it-works');

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json',
};

function resolveExportedHtml(pathname) {
  const clean = pathname.split('?')[0] || '/';
  if (clean === '/' || clean === '') return path.join(dist, 'index.html');
  const rel = clean.replace(/^\/+/, '');
  const directFile = path.join(dist, rel);
  const htmlFile = path.join(dist, rel + '.html');
  const indexInDir = path.join(dist, rel, 'index.html');

  if (fs.existsSync(htmlFile) && fs.statSync(htmlFile).isFile()) return htmlFile;
  if (fs.existsSync(indexInDir) && fs.statSync(indexInDir).isFile()) return indexInDir;
  if (fs.existsSync(directFile) && fs.statSync(directFile).isFile()) return directFile;
  return path.join(dist, 'index.html');
}

if (!fs.existsSync(dist)) {
  console.error('Missing dist/. Run: npx expo export --platform web');
  process.exit(1);
}
fs.mkdirSync(outDir, { recursive: true });

const server = http.createServer((req, res) => {
  try {
    const u = new URL(req.url || '/', 'http://127.0.0.1');
    let filePath = resolveExportedHtml(u.pathname);

    // _expo and assets live under dist/
    if (u.pathname.startsWith('/_expo/') || u.pathname.startsWith('/assets/')) {
      const alt = path.join(dist, u.pathname.replace(/^\/+/, ''));
      if (fs.existsSync(alt) && fs.statSync(alt).isFile()) filePath = alt;
    }

    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    const ext = path.extname(filePath);
    const ct = MIME[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': ct });
    res.end(fs.readFileSync(filePath));
  } catch (e) {
    res.writeHead(500);
    res.end(String(e));
  }
});

const PORT = 9990;
const BASE = `http://127.0.0.1:${PORT}`;

server.listen(PORT, '127.0.0.1', async () => {
  try {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width: 390, height: 780 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    });
    const page = await context.newPage();

    const shots = [
      {
        file: '01-home.png',
        url: `${BASE}/`,
        after: async () => {
          try {
            const el = page.locator('text=HEAD-TO-HEAD').first();
            await el.waitFor({ state: 'visible', timeout: 25000 });
            await el.scrollIntoViewIfNeeded();
            await delay(600);
          } catch {
            /* capture anyway */
          }
        },
      },
      {
        file: '02-minigames.png',
        url: `${BASE}/play/minigames`,
        after: async () => {
          try {
            const el = page.locator('text=MINI GAMES').first();
            await el.waitFor({ state: 'visible', timeout: 25000 });
            await el.scrollIntoViewIfNeeded();
            await delay(600);
          } catch {}
        },
      },
      {
        file: '03-queue.png',
        url: `${BASE}/play/casual`,
        after: async () => {
          await delay(4000);
        },
      },
      {
        file: '04-tap-dash.png',
        url: `${BASE}/play/minigames/tap-dash`,
        after: async () => {
          try {
            const el = page.locator('text=Tap Dash').first();
            await el.waitFor({ state: 'visible', timeout: 30000 });
            await el.scrollIntoViewIfNeeded();
            await delay(1000);
          } catch {}
        },
      },
    ];

    for (const shot of shots) {
      await page.goto(shot.url, { waitUntil: 'load', timeout: 120000 });
      await delay(2000);
      if (shot.after) await shot.after();
      const outPath = path.join(outDir, shot.file);
      await page.screenshot({ path: outPath, type: 'png', fullPage: false });
      console.log('wrote', path.relative(root, outPath));
    }

    await browser.close();
    console.log('How-it-works screenshots OK:', outDir);
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  } finally {
    server.close();
  }
});
