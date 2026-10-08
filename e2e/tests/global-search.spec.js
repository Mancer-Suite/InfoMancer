const fs = require('node:fs');
const path = require('node:path');
const { test, expect } = require('@playwright/test');

const shellScript = fs.readFileSync(
  path.join(__dirname, '..', '..', 'app', 'static', 'app-shell.js'),
  'utf8',
);

const fixture = `<!doctype html>
<html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  body { font: 16px system-ui; margin: 16px; }
  form { display: flex; gap: 6px; align-items: center; }
  label { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0,0,0,0); }
  #global-search-input { display: none; width: min(180px, 48vw); }
  #global-search.open #global-search-input { display: block; }
  #global-search-history { display: none; }
  #global-search-suggestions[hidden] { display: none; }
  #global-search-suggestions { position: absolute; top: 60px; left: 16px; background: white; }
  button { min-height: 44px; }
  #outside { margin-top: 80px; }
</style></head><body>
<form id="global-search" method="get" action="/library">
  <input name="record_search" type="hidden" value="1">
  <label for="global-search-input">Search the library</label>
  <input id="global-search-input" name="q" autocomplete="off">
  <button type="button" id="global-search-history">History</button>
  <div id="global-search-suggestions" role="listbox" hidden></div>
  <button type="button" id="global-search-toggle" aria-expanded="false" aria-controls="global-search-input" aria-label="Open library search">Search</button>
</form>
<button type="button" id="outside">Outside</button>
</body></html>`;

async function setupSearch(page) {
  await page.route('https://infomancer.test/**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'text/html', body: fixture });
  });
  await page.goto('https://infomancer.test/');

  // Deliberately ignore AbortSignal to prove the controller rejects old responses
  // even if a backend or network layer delivers one after it was cancelled.
  await page.evaluate(() => {
    window.__suggestions = {};
    window.__submissions = [];
    document.getElementById('global-search').addEventListener('submit', (event) => {
      event.preventDefault();
      window.__submissions.push(document.getElementById('global-search-input').value);
    });
    document.getElementById('outside').addEventListener('click', (event) => {
      event.currentTarget.textContent = 'Tapped outside';
    });
    window.fetch = (resource) => {
      const url = new URL(String(resource), window.location.href);
      if (url.pathname === '/api/search-history') {
        return Promise.resolve({ ok: true, json: async () => ({ history: [] }) });
      }
      if (url.pathname === '/api/library-suggestions') {
        const query = url.searchParams.get('q');
        return new Promise((resolve) => {
          window.__suggestions[query] = () => resolve({
            ok: true,
            json: async () => ({
              suggestions: [{ value: query, label: query, type: 'Title', detail: '' }],
            }),
          });
        });
      }
      throw new Error('Unexpected request: ' + url.pathname);
    };
  });
  await page.addScriptTag({ content: shellScript });
}

test.describe('global search on a narrow touch viewport', () => {
  test.use({ viewport: { width: 320, height: 640 }, isMobile: true, hasTouch: true });

  test('focuses in the opening tap and dismisses populated search on outside touch', async ({ page }) => {
    await setupSearch(page);
    const toggle = page.locator('#global-search-toggle');
    const input = page.locator('#global-search-input');
    const search = page.locator('#global-search');

    await toggle.tap();
    await expect(input).toBeFocused();
    await input.fill('matrix');
    await page.locator('#outside').tap();

    await expect(search).not.toHaveClass('open');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(input).not.toBeFocused();
    await expect(input).toHaveAttribute('tabindex', '-1');
    await expect(input).toHaveValue('matrix');
    await expect(page.locator('#outside')).toHaveText('Tapped outside');

    // A late focus timer must never steal focus back after dismissal.
    await page.waitForTimeout(230);
    await expect(input).not.toBeFocused();
  });

  test('Escape closes a nonempty query and returns focus to the toggle', async ({ page }) => {
    await setupSearch(page);
    const toggle = page.locator('#global-search-toggle');
    const input = page.locator('#global-search-input');

    await toggle.tap();
    await input.fill('planet');
    await input.press('Escape');

    await expect(toggle).toBeFocused();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(input).toHaveValue('planet');
    await page.keyboard.press('Tab');
    await expect(input).not.toBeFocused();
  });

  test('a late response cannot replace newer suggestions', async ({ page }) => {
    await setupSearch(page);
    await page.locator('#global-search-toggle').tap();
    const input = page.locator('#global-search-input');
    const options = page.locator('#global-search-suggestions');

    await input.fill('first');
    await expect.poll(() => page.evaluate(() => Boolean(window.__suggestions.first))).toBe(true);
    await input.fill('second');
    await expect.poll(() => page.evaluate(() => Boolean(window.__suggestions.second))).toBe(true);

    await page.evaluate(() => window.__suggestions.second());
    await expect(options).toContainText('second');
    await page.evaluate(() => window.__suggestions.first());
    await expect(options).toContainText('second');
    await expect(options).not.toContainText('first');
  });

  test('closing aborts work and late results never reopen the list', async ({ page }) => {
    await setupSearch(page);
    await page.locator('#global-search-toggle').tap();
    await page.locator('#global-search-input').fill('pending');
    await expect.poll(() => page.evaluate(() => Boolean(window.__suggestions.pending))).toBe(true);

    await page.locator('#outside').tap();
    await page.evaluate(() => window.__suggestions.pending());

    await expect(page.locator('#global-search-suggestions')).toBeHidden();
    await expect(page.locator('#global-search')).not.toHaveClass('open');
  });

  test('search toggle still submits a populated query', async ({ page }) => {
    await setupSearch(page);
    await page.locator('#global-search-toggle').tap();
    await page.locator('#global-search-input').fill('arrival');
    await page.locator('#global-search-toggle').tap();

    await expect.poll(() => page.evaluate(() => window.__submissions)).toEqual(['arrival']);
    await expect(page.locator('input[name="record_search"]')).toHaveValue('1');
  });
});
