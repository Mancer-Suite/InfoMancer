const fs = require('node:fs');
const path = require('node:path');
const { test, expect } = require('@playwright/test');

const staticRoot = path.join(__dirname, '..', '..', 'app', 'static');
// Match the shared shell and final route-specific CSS order. Serve real CSS,
// including imports, so this catches cascade and intrinsic-width regressions.
const styles = [
  'app', 'progress', 'library', 'header', 'sources', 'auth', 'first-run',
  'settings', 'engagement', 'tour-demo', 'modern', 'workspace', 'workspace-ui',
  'review', 'dialog-controls', 'mobile', 'release-081-ui-polish',
  'navigation-paint-stability', 'library-controls', 'library-performance',
  'library-density', 'library-selection', 'display-accessibility',
  'profile', 'profile-account-dialogs',
];
const poster = 'data:image/svg+xml,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 300"><rect width="200" height="300" fill="#263542"/></svg>',
);
const cards = Array.from({ length: 12 }, (_, index) => `
  <article class="cover-card">
    <a class="cover-card-link" href="/titles/${index + 1}">
      <div class="cover-art"><img src="${poster}" alt=""></div>
      <strong>${index % 2 ? 'A deliberately long media title that occupies two lines' : 'Short title'}</strong>
    </a><div class="cover-card-meta"><span>2024</span></div>
  </article>`).join('');
const fixture = `<!doctype html><html lang="en" class="library-view-ready">
<head><meta name="viewport" content="width=device-width,initial-scale=1">
${styles.map(name => `<link rel="stylesheet" href="/static/${name}.css">`).join('')}
</head><body class="has-app-sidebar"><main class="shell">
  <header class="page-head"><div><h1>Library</h1></div></header>
  <header class="settings-heading profile-settings-heading"><h1>Profile Settings</h1></header>
  <div class="catalog-tabs">
    <a class="active" href="/library">All</a><a href="/movies">Movies</a>
    <a href="/shows">TV Shows</a>
    <div class="library-view-toolbar"><div class="library-view-controls">
      <div class="cover-size-control library-density-ready">
        <div class="library-density-desktop">${[1,2,3,4,5].map(n => `<button type="button" class="library-density-step" aria-label="Density ${n}">${n}</button>`).join('')}</div>
        <div class="library-density-mobile">${[1,2,3].map(n => `<button type="button" aria-label="${n} columns">${n}</button>`).join('')}</div>
      </div>
      <div class="library-view-toggle"><button type="button">List</button><button type="button" class="active">Covers</button></div>
    </div></div>
  </div>
  <div id="cover-library" class="cover-library" data-mobile-density="balanced" style="--cover-size:160px">${cards}</div>
  <div class="settings-page-grid"><section class="settings-card full-width">
    <div class="settings-card-head"><div><p class="eyebrow">BACKUP & RESTORE</p><h2>Complete database protection</h2></div>
      <div class="button-row backup-header-actions"><form><button class="button">Verify backups</button></form><form><button class="button">Create backup now</button></form></div>
    </div>
    <form class="settings-restore-upload backup-upload-row"><label>Restore an uploaded InfoMancer database<input type="file"></label><button class="button danger">Validate and restore</button></form>
    <div class="recovery-package-block"><div class="recovery-package-copy"><h3>One-file recovery package</h3></div><div class="recovery-package-actions"><form><button class="button primary">Create &amp; download recovery package</button></form></div></div>
  </section></div>
  <section class="panel session-panel"><div class="session-list"><article><div><strong>Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36</strong><small>Last active 2026-10-09</small></div><form><button class="button">Sign out</button></form></article></div></section>
</main><aside class="workspace-inspector" style="display:none" aria-label="Inspector">Inspector</aside></body></html>`;

async function setup(page) {
  await page.route('https://infomancer.test/**', route => {
    const url = new URL(route.request().url());
    if (url.pathname.startsWith('/static/')) {
      const name = path.basename(url.pathname);
      return route.fulfill({ contentType: 'text/css', body: fs.readFileSync(path.join(staticRoot, name), 'utf8') });
    }
    return route.fulfill({ contentType: 'text/html', body: fixture });
  });
  await page.goto('https://infomancer.test/');
}

test('headings, controls, and settings remain coherent at every supported width', async ({ page }) => {
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await setup(page);
    const sizes = await page.locator('h1').evaluateAll(nodes => nodes.map(node => parseFloat(getComputedStyle(node).fontSize)));
    expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThan(1);
    expect(Math.max(...sizes)).toBeLessThanOrEqual(34);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    for (const button of await page.locator('.library-view-toggle button, .backup-header-actions button').all()) {
      const bounds = await button.boundingBox();
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
    }
  }
});

test('poster gaps, caption alignment, and dimensions stay stable across densities and inspection', async ({ page }) => {
  await setup(page);
  for (const size of [112, 144, 180, 220, 280]) {
    await page.locator('#cover-library').evaluate((node, value) => node.style.setProperty('--cover-size', `${value}px`), size);
    const before = await page.locator('.cover-card').first().boundingBox();
    const row = await page.locator('.cover-card').evaluateAll(nodes => {
      const rects = nodes.map(node => node.getBoundingClientRect());
      return rects.filter(rect => Math.abs(rect.y - rects[0].y) < 1).map(rect => ({ x: rect.x, width: rect.width }));
    });
    const gaps = row.slice(1).map((rect, index) => rect.x - row[index].x - row[index].width);
    expect(Math.max(...gaps) - Math.min(...gaps)).toBeLessThan(1);
    expect(Math.max(...gaps)).toBeLessThanOrEqual(17);
    const meta = await page.locator('.cover-card-meta').evaluateAll(nodes => nodes.slice(0, 2).map(node => node.getBoundingClientRect().y));
    expect(Math.abs(meta[0] - meta[1])).toBeLessThan(1);
    await page.locator('.cover-card').first().hover();
    await page.waitForTimeout(200);
    expect((await page.locator('.cover-card').first().boundingBox()).y).toBeCloseTo(before.y, 0);
    await page.locator('.workspace-inspector').evaluate(node => { node.style.display = 'block'; document.body.classList.add('workspace-inspector-open'); });
    expect((await page.locator('.cover-card').first().boundingBox()).width).toBeCloseTo(before.width, 0);
    await page.locator('.workspace-inspector').evaluate(node => { node.style.display = 'none'; document.body.classList.remove('workspace-inspector-open'); });
  }
});

test('keyboard focus survives reduced motion and forced colors', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce', forcedColors: 'active' });
  await setup(page);
  await page.keyboard.press('Tab');
  expect(await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle)).not.toBe('none');
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).scrollbarColor)).toBe('auto');
});
