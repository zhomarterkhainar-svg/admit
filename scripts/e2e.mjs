// End-to-end run in headless Chrome: the real camera pipeline (Chrome's fake camera) and the
// whole demo flow. Checks what the jury will check by hand and fails loudly if anything breaks.
//
//   npm run dev            # in another terminal
//   npm run e2e            # or: npm run e2e -- --shots docs/img   (refresh README screenshots)
//
// CHROME_PATH=/path/to/chrome overrides the browser; APP_URL overrides http://localhost:5173/.
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import puppeteer from 'puppeteer-core';

const BASE = process.env.APP_URL ?? 'http://localhost:5173/';
const shotsArg = process.argv.indexOf('--shots');
const SHOTS = shotsArg > 0 ? process.argv[shotsArg + 1] : null;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

const CHROMES = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].filter(Boolean);
const executablePath = CHROMES.find((p) => existsSync(p));
if (!executablePath) {
  console.error('Chrome not found: set CHROME_PATH');
  process.exit(2);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const failures = [];
const check = (ok, what) => {
  console.log(`${ok ? '✓' : '✗'} ${what}`);
  if (!ok) failures.push(what);
};

const browser = await puppeteer.launch({
  executablePath,
  headless: true,
  args: [
    '--use-fake-ui-for-media-stream',
    '--use-fake-device-for-media-stream',
    '--autoplay-policy=no-user-gesture-required',
    '--enable-unsafe-swiftshader',
    // containers/CI often run as root, where Chrome refuses to start with its sandbox
    ...(process.getuid?.() === 0 ? ['--no-sandbox'] : []),
    // several tabs in one headless browser: never throttle the one under test
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
  ],
});

async function open(w, h, mobile = false) {
  const page = await browser.newPage();
  await page.setViewport({ width: w, height: h, isMobile: mobile, hasTouch: mobile });
  page.errors = [];
  page.on('console', (m) => m.type() === 'error' && page.errors.push(m.text()));
  page.on('pageerror', (e) => page.errors.push(String(e)));
  // hidden tabs get no video frames: keep the page under test in front
  await page.bringToFront();
  await page.goto(`${BASE}?e2e`, { waitUntil: 'networkidle0' });
  return page;
}
const shot = (page, name) => SHOTS && page.screenshot({ path: join(SHOTS, `${name}.png`) });
const go = (page, s) => page.evaluate((x) => window.__app.getState().go(x), s);
const waitFor = (page, sel, timeout = 30000) =>
  page.waitForSelector(sel, { timeout }).then(
    () => true,
    () => false,
  );
const click = (page, re) =>
  page.evaluate((src) => {
    const rx = new RegExp(src, 'i');
    [...document.querySelectorAll('button')].find((b) => rx.test(b.textContent))?.click();
  }, re);
async function waitError(page, timeout = 60000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    if (await page.$('.feedback.tone-validity, .feedback.tone-form, .feedback.tone-safety'))
      return true;
    await sleep(150);
  }
  return false;
}
/** hand-only users cannot scroll: every dwell target must be fully on screen */
async function reach(page, name) {
  const off = await page.evaluate(() =>
    [...document.querySelectorAll('.dwell-btn')]
      .map((b) => [b.textContent.trim().slice(0, 24), b.getBoundingClientRect()])
      .filter(([, r]) => r.width > 0 && (r.bottom > innerHeight + 1 || r.top < -1))
      .map(([t]) => t),
  );
  const hscroll = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
  check(
    !off.length && !hscroll,
    `${name}: all hand targets on screen${off.length ? ` (off: ${off})` : ''}`,
  );
}

try {
  // 1. welcome
  {
    const page = await open(1280, 720);
    check(!!(await page.$('.welcome .btn')), 'welcome: start + demo buttons');
    await shot(page, 'welcome');
    await page.close();
  }

  // 2. real camera pipeline: fake webcam → MediaPipe → calibration → setup hint
  {
    const page = await open(1280, 720);
    await click(page, '^(Начать|Бастау|Start)$');
    check(await waitFor(page, '.calib-card', 60000), 'camera: MediaPipe model + camera started');
    await sleep(2000);
    await go(page, 'menu');
    await sleep(800);
    await reach(page, 'camera menu');
    await page.evaluate(() =>
      window.__app
        .getState()
        .startProgram({ id: 'single', steps: [{ id: 'squat', target: 5, timeLimitSec: 30 }] }),
    );
    const hinted = await waitFor(page, '.feedback.tone-setup', 20000);
    const frames = await page.evaluate(
      () => document.querySelector('video')?.getVideoPlaybackQuality().totalVideoFrames ?? 0,
    );
    check(hinted, `camera: empty room → concrete setup hint (camera frames: ${frames})`);
    check(!page.errors.length, `camera: no console errors ${page.errors.slice(0, 2).join(' | ')}`);
    await page.close();
  }

  // 3. demo flow: intro → error mode → results → records → challenge → free workout
  {
    const page = await open(1280, 720);
    // two earlier workouts on this device: the results must say how the movement profile changed
    await page.evaluate(() => {
      const body = { symmetry: 60, core: 55, squatDepth: 70, amplitude: 70, smoothness: 60 };
      const h = (at) => ({
        at,
        programId: 'quick',
        counted: 5,
        attempted: 5,
        quality: 80,
        cleanPct: 60,
        xp: 50,
        durationMs: 60000,
        body,
      });
      localStorage.setItem(
        'qozgal.progress.v1',
        JSON.stringify({ totalXp: 100, history: [h(1), h(2)] }),
      );
    });
    await page.reload({ waitUntil: 'networkidle0' });
    await click(page, 'Демо|Demo');
    check(await waitFor(page, '.intro'), 'demo: exercise intro');
    await sleep(1000);
    await shot(page, 'intro');
    await reach(page, 'intro');
    check(await waitError(page), 'demo: error mode shows what is wrong + how to fix');
    await sleep(300);
    await shot(page, 'error-mode');
    check(await waitFor(page, '.results-title', 240000), 'demo: quick workout reaches results');
    await sleep(1200);
    await shot(page, 'results');
    await reach(page, 'results');
    const update = await page.$eval('.profile-update', (el) => el.textContent).catch(() => '');
    check(
      /обновл|updated|жаңарт/i.test(update) && /[↑↓]/.test(update),
      `results: movement profile updated (${update.trim()})`,
    );
    for (const screen of [
      'records',
      'menu',
      'pick',
      'profile',
      'moves',
      'settings',
      'floor',
      'games',
      'duel',
      'dance',
    ]) {
      await go(page, screen);
      await sleep(900);
      await shot(page, screen);
      await reach(page, screen);
    }
    await go(page, 'challenge');
    check(await waitFor(page, '.ch-command', 20000), 'challenge: commands appear');
    // commands come and go: sample for a while, never more than one card at a time
    let most = 0;
    for (let i = 0; i < 25; i++) {
      most = Math.max(most, await page.$$eval('.ch-command', (els) => els.length));
      await sleep(200);
    }
    await shot(page, 'challenge');
    check(most === 1, `challenge: one command card at a time (max ${most})`);
    check(await waitFor(page, '.ch-final', 90000), 'challenge: game over screen');
    await sleep(1200);
    await reach(page, 'challenge results');
    await go(page, 'free');
    await sleep(9000);
    await shot(page, 'free');
    const counted = await page.$$eval('.free-count', (els) =>
      els.reduce((s, e) => s + Number(e.textContent), 0),
    );
    check(counted > 0, `free workout: AI recognized and counted reps (${counted})`);

    // the duel: two virtual athletes join with their hands up and score in round 1
    await go(page, 'duel');
    await sleep(900);
    await click(page, '^(С другом|Досыңмен|With a friend)');
    check(await waitFor(page, '.duel-hud', 20000), 'duel: both players joined');
    // each athlete's set opens with a different rep (some are deliberately not counted):
    // wait until both have scored, up to the end of round 1
    let duelScores = [];
    for (let i = 0; i < 50; i++) {
      await sleep(500);
      duelScores = await page.$$eval('.duel-score', (els) => els.map((e) => Number(e.textContent)));
      if (duelScores.length === 2 && duelScores.every((s) => s > 0)) break;
    }
    await shot(page, 'duel-play');
    check(
      duelScores.length === 2 && duelScores.every((s) => s > 0),
      `duel: both players score (${duelScores.join(' : ')})`,
    );
    await click(page, '^(Выйти|Шығу|Exit)$');
    await sleep(500);
    check(
      (await page.evaluate(() => window.__app.getState().screen)) === 'games',
      'exit button: leaves the duel',
    );

    // duel against the AI rival: it moves and scores by the same rules as the player
    await go(page, 'duel');
    await sleep(900);
    await click(page, '^(Средний|Орташа|Medium)');
    check(await waitFor(page, '.duel-hud', 20000), 'duel vs AI: the match starts');
    await sleep(14000);
    await shot(page, 'duel-ai');
    const aiScore = await page.$eval('.duel-card.R .duel-score', (e) => Number(e.textContent));
    check(aiScore > 0, `duel vs AI: the AI rival scores (${aiScore})`);
    await click(page, '^(Выйти|Шығу|Exit)$');
    await sleep(500);

    // Qara Zhorga: the song plays, the lane runs, the virtual dancer's moves are judged
    await go(page, 'dance');
    await sleep(800);
    await click(page, 'Билеу|Dance!');
    check(await waitFor(page, '.dance-lane', 10000), 'dance: the song starts');
    await sleep(13000);
    await shot(page, 'dance-play');
    const judged = await page.$$eval('.dance-stats .hud-chip', (els) =>
      Number(els[0]?.textContent),
    );
    check(judged > 0, `dance: moves judged on the beat (score ${judged})`);
    await click(page, '^(Выйти|Шығу|Exit)$');
    await sleep(500);
    check(!page.errors.length, `demo: no console errors ${page.errors.slice(0, 2).join(' | ')}`);
    await page.close();
  }

  // 4. phone
  {
    const page = await open(390, 844, true);
    await click(page, 'Демо|Demo');
    await waitFor(page, '.intro');
    check(await waitError(page), 'phone: error mode');
    await sleep(300);
    await shot(page, 'phone');
    await page.close();
  }
} finally {
  await browser.close();
}

console.log(failures.length ? `\n${failures.length} check(s) failed` : '\nall checks passed');
process.exit(failures.length ? 1 : 0);
