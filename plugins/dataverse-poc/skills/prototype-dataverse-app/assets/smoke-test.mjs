// Smoke test of the static POC build (dist/*.html) with Playwright: navigation, views, record form, simulation badges, console errors.
import { readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';

const pocDir = resolve(fileURLToPath(new URL('..', import.meta.url)));
const distDir = join(pocDir, 'dist');
const failures = [];
const warnings = [];

async function launch() {
    for (const channel of ['msedge', 'chrome', undefined]) {
        try {
            return await chromium.launch({ channel });
        } catch {
            // try the next channel
        }
    }
    throw new Error('Nessun browser disponibile: installare Edge o Chrome, oppure eseguire "npx playwright install chromium".');
}

const click = (page, selector) => page.evaluate((s) => {
    const el = document.querySelector(s);
    if (el) el.click();
    return Boolean(el);
}, selector);

async function testPage(browser, file) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

    await page.goto(pathToFileURL(join(distDir, file)).href);
    await page.waitForSelector('[data-nav]', { timeout: 10000 }).catch(() => {});

    const listOptions = (menu, option) => page.evaluate(async ([m, o]) => {
        const button = document.querySelector(m);
        if (!button) return [null];
        button.click();
        await new Promise((r) => setTimeout(r, 50));
        const list = [...document.querySelectorAll(o)].map((e) => e.getAttribute(o.slice(1, -1)));
        if (document.querySelector(m)) document.querySelector(m).click();
        return list.length ? list : [null];
    }, [menu, option]);
    const select = async (menu, option, value) => {
        if (!value) return;
        await click(page, menu);
        await click(page, `[${option}="${value}"]`);
        await page.waitForTimeout(50);
    };

    const scopes = [];
    for (const app of await listOptions('[data-app-menu]', '[data-app-select]')) {
        await select('[data-app-menu]', 'data-app-select', app);
        for (const area of await listOptions('[data-area-menu]', '[data-area-select]')) scopes.push({ app, area });
    }
    const enter = async ({ app, area }) => {
        await select('[data-app-menu]', 'data-app-select', app);
        await select('[data-area-menu]', 'data-area-select', area);
    };

    const screens = new Set();
    let simFrames = 0;
    let recordTarget = null;

    for (const scope of scopes) {
        await enter(scope);
        const navs = await page.evaluate(() => [...new Set([...document.querySelectorAll('[data-nav]')].map((e) => e.getAttribute('data-nav')))]);
        for (const nav of navs) {
            if (screens.has(nav)) continue;
            await click(page, `[data-nav="${nav}"]`);
            await page.waitForTimeout(80);
            const info = await page.evaluate(() => ({
                text: document.body.innerText.length,
                missing: [...document.querySelectorAll('.grid-empty')].map((e) => e.textContent).filter((t) => /non ancora reso/i.test(t)),
                sims: document.querySelectorAll('.sim-frame').length,
                record: Boolean(document.querySelector('tr[data-open]')),
            }));
            screens.add(nav);
            simFrames += info.sims;
            if (!info.text) failures.push(`${file} · ${nav}: schermata vuota`);
            info.missing.forEach((m) => warnings.push(`${file} · ${nav}: ${m.trim()}`));
            if (info.record && !recordTarget) recordTarget = { ...scope, nav };
        }
    }

    if (!screens.size) failures.push(`${file}: nessuna voce di navigazione [data-nav]`);

    if (recordTarget) {
        await enter(recordTarget);
        await click(page, `[data-nav="${recordTarget.nav}"]`);
        await click(page, 'tr[data-open]');
        await page.waitForTimeout(80);
        const formOk = await page.evaluate(() => Boolean(document.querySelector('.form-tabs, [data-form-tab]')));
        if (!formOk) failures.push(`${file}: il record aperto da "${recordTarget.nav}" non mostra un modulo`);
    } else {
        warnings.push(`${file}: nessuna vista con righe cliccabili`);
    }

    if (!simFrames) warnings.push(`${file}: nessun componente con contrassegno di simulazione (.sim-frame)`);
    errors.forEach((e) => failures.push(`${file}: errore console · ${e}`));

    console.log(`${file}: ${screens.size} schermate, ${simFrames} riquadri simulati, record ${recordTarget ? 'aperto' : 'n/d'}`);
    await page.close();
}

const files = readdirSync(distDir, { withFileTypes: true }).filter((d) => d.isFile() && d.name.endsWith('.html')).map((d) => d.name);
if (!files.length) {
    console.error('Nessun HTML in dist/: eseguire prima "npm run build".');
    process.exit(1);
}

const browser = await launch();
try {
    for (const file of files) await testPage(browser, file);
} finally {
    await browser.close();
}

warnings.forEach((w) => console.warn(`AVVISO  ${w}`));
failures.forEach((f) => console.error(`ERRORE  ${f}`));
console.log(failures.length ? `Smoke test FALLITO (${failures.length} errori)` : 'Smoke test OK');
process.exit(failures.length ? 1 : 0);
