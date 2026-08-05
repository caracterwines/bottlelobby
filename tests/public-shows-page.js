/* bottle-lobby-wine-shows.html — the public face of A16.7.
   ------------------------------------------------------------------
   This page had no coverage at all before it started rendering real
   records: it was static marketing. Now it decides which shows a
   stranger sees, which makes it the one surface where a mistake is
   visible to people who never agreed to be listed.

   What matters here is not that it renders, but that it renders LESS
   than the dashboard: A16.6 is a promise to an invited producer who
   has not yet said yes. */
const path = require('path');
const { loadDashboard } = require('./load-dashboard');
const { JSDOM, VirtualConsole } = require('jsdom');

const PAGE = path.join(__dirname, '..', 'bottle-lobby-wine-shows.html');
const errs = [];
const dom = new JSDOM(loadDashboard(PAGE).html, {
  runScripts: 'dangerously', pretendToBeVisual: true,
  virtualConsole: new VirtualConsole().on('jsdomError', e => errs.push(e.message)) });
const w = dom.window, d = w.document;
if (errs.length) { console.log('SCRIPT ERRORS:\n' + errs.join('\n')); process.exit(1); }
console.log('page evaluated cleanly\n');

let fail = 0;
const bad = m => { console.log('  ✗ ' + m); fail++; };
const ok  = m => console.log('  ✓ ' + m);
const shows = w.eval('wineShows');
const byId = id => shows.find(s => s.id === id);
const cards = sel => [...d.querySelectorAll(sel + ' .ws-teaser')];

/* ── 1. It renders from the shared data, not from a copy ─────────── */
console.log('── shared source');
{
  /* The page must not carry show content of its own. If a title only a
     record knows appears in the file's own markup, someone pasted it. */
  const own = loadDashboard(PAGE).raw;
  const pasted = shows.filter(s => own.includes(s.title));
  if (pasted.length) bad('show titles hard-coded into the page: ' + pasted.map(s => s.title).join(', '));
  else ok(shows.length + ' shows, none hard-coded — all rendered from the shared records');

  if (w.eval('typeof publicShowCard') !== 'function') bad('shared renderer not loaded');
  else ok('shared renderer loaded');
}

/* ── 2. Only public stages are listed ────────────────────────────── */
/* The load-bearing assertion. A draft or a show still awaiting release
   appearing here would announce a producer who has not accepted, or a
   show Bottle Lobby has not cleared (A16.1, A16.2). */
console.log('\n── which shows are listed');
{
  const listed = cards('#ups-upcoming').concat(cards('#ups-past'))
    .map(b => b.querySelector('.ws-public-title').textContent);
  const shouldList = shows.filter(s => ['planning','published','completed'].includes(s.stage));
  const shouldNot  = shows.filter(s => !['planning','published','completed'].includes(s.stage));

  const leaked = shouldNot.filter(s => listed.includes(s.title));
  if (leaked.length) bad('non-public stages listed: ' + leaked.map(s => s.title + ' (' + s.stage + ')').join(', '));
  else ok(shouldNot.length + ' draft/pending shows correctly absent');

  const dropped = shouldList.filter(s => !listed.includes(s.title));
  if (dropped.length) bad('public shows missing from the page: ' + dropped.map(s => s.title).join(', '));
  else ok(shouldList.length + ' public shows listed');

  /* Upcoming and past must not mix — a past show in the upcoming grid
     reads as an invitation. */
  const pastTitles = cards('#ups-past').map(b => b.querySelector('.ws-public-title').textContent);
  const wrong = pastTitles.filter(t => shows.find(s => s.title === t).stage !== 'completed');
  if (wrong.length) bad('not-completed shows in the past grid: ' + wrong.join(', '));
  else ok(pastTitles.length + ' show(s) in the past grid, all completed');
}

/* ── 3. The anonymised level really is anonymised ────────────────── */
/* The reason A16.6 exists. An invited producer must not be findable on
   a public page before accepting — not in the card, not in the
   expanded listing, not in an attribute. */
console.log('\n── A16.6 on a real page');
{
  const planning = shows.filter(s => s.stage === 'planning');
  if (!planning.length) bad('no planning show in the fixtures — the anonymised level is untested');
  else ok(planning.length + ' planning show(s) in the fixtures');

  for (const s of planning) {
    const cell = [...d.querySelectorAll('.ws-cell')]
      .find(c => (c.querySelector('.ws-public-title') || {}).textContent === s.title);
    if (!cell) { bad(s.title + ': not on the page'); continue; }

    const html = cell.innerHTML;
    const named = s.exhibitors.map(e => e.producer).filter(n => html.includes(n));
    if (named.length) bad(s.title + ': exhibitors named while anonymised — ' + named.join(', '));
    else ok(s.title + ': none of its ' + s.exhibitors.length + ' exhibitors named');

    /* Resolved from the KEY. This mapped `p.name`, which pass 3b took
       off show products, so `wines` was an array of `undefined` and the
       filter dropped every one of them — the check reported "no wines
       named" for a page that could have printed all of them. */
    const labels = s.exhibitors.flatMap(e => e.products.map(p => w.eval('wineName(' + JSON.stringify(p.productId) + ')')));
    if (labels.some(n => !n)) bad(s.title + ': a show product resolves to no name — the leak check looked for nothing');
    const wines = labels.filter(n => n && html.includes(n));
    if (wines.length) bad(s.title + ': wines named while anonymised — ' + wines.join(', '));
    else ok(s.title + ': none of its ' + labels.length + ' wines named');

    if (html.includes(s.venueName)) bad(s.title + ': exact venue disclosed while anonymised');
    else ok(s.title + ': venue withheld');

    /* Date, city and focus are explicitly granted at this level —
       withholding them would be a different bug. */
    if (!html.includes(s.city) || !html.includes(s.focus))
      bad(s.title + ': city or focus missing — the anonymised level still shows both');
    else ok(s.title + ': date, city and focus shown');
  }
}

/* ── 4. The published level does disclose ────────────────────────── */
console.log('\n── the full level');
{
  const pub = shows.filter(s => s.stage === 'published');
  if (!pub.length) bad('no published show in the fixtures — the full level is untested');
  for (const s of pub) {
    const cell = [...d.querySelectorAll('.ws-cell')]
      .find(c => (c.querySelector('.ws-public-title') || {}).textContent === s.title);
    if (!cell) { bad(s.title + ': not on the page'); continue; }
    const html = cell.innerHTML;
    const confirmed = s.exhibitors.filter(e => e.status === 'confirmed');
    const missing = confirmed.filter(e => !html.includes(e.producer));
    if (missing.length) bad(s.title + ': confirmed exhibitors not shown — ' + missing.map(e => e.producer).join(', '));
    else ok(s.title + ': all ' + confirmed.length + ' confirmed exhibitors named');
    if (!html.includes(s.venueName)) bad(s.title + ': venue not shown at the full level');
    else ok(s.title + ': venue shown');
  }
}

/* ── 5. The expanding listing ────────────────────────────────────── */
/* Stands in for /wine-show/{slug} until the real build has a router
   (A16.7). It must start closed, or the grid is a wall of detail. */
console.log('\n── the full listing layer');
{
  const panels = [...d.querySelectorAll('.ws-listing')];
  if (!panels.length) bad('no listing panels rendered');
  else if (panels.some(p => p.classList.contains('open'))) bad('a listing starts open');
  else ok(panels.length + ' listings, all closed on load');

  const btn = d.querySelector('#ups-upcoming .ws-teaser');
  if (!btn) { bad('no card to open'); }
  else {
    if (btn.getAttribute('aria-expanded') !== 'false') bad('aria-expanded not initialised');
    btn.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
    const panel = btn.nextElementSibling;
    if (!panel.classList.contains('open')) bad('clicking the card did not open its listing');
    else if (btn.getAttribute('aria-expanded') !== 'true') bad('aria-expanded not updated on open');
    else ok('card opens its listing and reports it');

    btn.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
    if (panel.classList.contains('open')) bad('clicking again did not close the listing');
    else ok('card closes again');

    /* Each card must control its own panel — one shared open state
       would disclose the wrong show. */
    const others = [...d.querySelectorAll('.ws-listing.open')];
    if (others.length) bad('other listings opened along with it');
    else ok('cards are independent');
  }
}

/* ── 6. Every card leads with a real image ───────────────────────── */
console.log('\n── hero images');
{
  const fs = require('fs');
  const missing = [...d.querySelectorAll('.ws-teaser-hero')]
    .map(img => img.getAttribute('src'))
    .filter(src => !fs.existsSync(path.join(__dirname, '..', src)));
  if (missing.length) bad('hero images that do not exist: ' + [...new Set(missing)].join(', '));
  else ok(d.querySelectorAll('.ws-teaser-hero').length + ' hero images, all present in the repo');
}

/* ── 7. The sort reads both date formats ─────────────────────────
   Written BEFORE the wine-show dates move to ISO, and that order is
   the point. showDateValue() used to match the display form alone and
   return MAX_SAFE_INTEGER for everything else — so an ISO date would
   not have thrown here, it would have sorted every show to the end
   and reordered "What's Coming" with no symptom at all. A reader that
   is widened after its data has moved is a reader that was broken in
   between, invisibly.

   The check does not care which format the fixtures use: it asserts
   the same shows come out in the same order when their dates are
   rewritten into the other format. That keeps holding after the
   migration, when the two formats swap roles. */
console.log('\n── the sort survives the format it is given');
{
  const DISPLAY = /^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})$/;
  const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const flip = v => {
    let m = DISPLAY.exec(v || '');
    if (m) return m[3] + '-' + String(MONTHS.indexOf(m[2]) + 1).padStart(2, '0') + '-' + m[1].padStart(2, '0');
    m = ISO.exec(v || '');
    if (m) return String(Number(m[3])).padStart(2, '0') + ' ' + MONTHS[Number(m[2]) - 1] + ' ' + m[1];
    return null;
  };
  const order = () => [false, true].map(past =>
    w.eval('publicShows(wineShows, ' + past + ')').map(s => s.id).join(','));

  const before = order();
  const originals = w.eval('wineShows').map(s => s.date);
  const flipped = originals.map(flip);

  if (flipped.some(v => v === null)) bad('a show date is in neither format: ' + JSON.stringify(originals));
  else {
    /* Rewrite every show date into the other format, in place. */
    w.eval('wineShows.forEach(function (s, i) { s.date = ' + JSON.stringify(flipped) + '[i]; })');
    const after = order();
    w.eval('wineShows.forEach(function (s, i) { s.date = ' + JSON.stringify(originals) + '[i]; })');

    if (before.join('|') !== after.join('|'))
      bad('the order changed when the dates were rewritten into the other format:\n' +
          '      ' + before.join('  ·  ') + '\n      ' + after.join('  ·  '));
    else if (!before[0] || before[0].indexOf(',') === -1)
      bad('fewer than two upcoming shows — the sort cannot be observed, so this check proves nothing');
    else ok('upcoming and past sort identically in both formats (' + before[0].split(',').length + ' upcoming, ' +
            before[1].split(',').length + ' past)');
  }

  /* And the unreadable case still sorts last rather than throwing. */
  const junk = w.eval('showDateValue({ date: "sometime next spring" })');
  if (junk !== w.eval('Number.MAX_SAFE_INTEGER')) bad('an unreadable date no longer sorts last: ' + junk);
  else ok('an unreadable date still sorts last instead of throwing');
}

console.log(fail ? `\n✗ ${fail} failure(s)` : '\n✓ the public page discloses exactly what A16.6 allows');
process.exit(fail ? 1 : 0);
