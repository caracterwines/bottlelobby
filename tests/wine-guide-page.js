/* bottle-lobby-wine-guide.html — the Guide's Events tab (A16.14d) and
   the deep links the rest of the site relies on.
   ------------------------------------------------------------------
   The Guide's Wines/Wineries/... tabs render the page's own inline
   arrays — that is the D34 copy, known and deliberately not this
   pass's business. What IS this file's business:

     · the EVENTS tab is a DERIVED directory over the shared
       `wineShows` and `memberEvents` records (ME-1) — an anonymous
       reader sees exactly what the reach derivation grants a stranger
       and not one card more (A16.14b);
     · the two kinds share the list and never a promise (ME-3), and
       the accepted winemaker is named on the public event card while
       everyone protected stays a head count (ME-5, D42);
     · one mixed, chronological order across both card sorts;
     · filters only where real data covers them — no empty categories;
     · and every deep link that existed before this tab still works:
       #wines … #retailers, and ?grape=<name>#wines from the article
       pages (B7).

   Each central claim runs its counter-mutation, exactly as
   tests/member-events.js does it: a check that stays green when the
   rule is broken proves nothing. */
const path = require('path');
const { loadDashboard } = require('./load-dashboard');
const { JSDOM, VirtualConsole } = require('jsdom');

const PAGE = path.join(__dirname, '..', 'bottle-lobby-wine-guide.html');

function boot(urlSuffix) {
  const errs = [];
  const dom = new JSDOM(loadDashboard(PAGE).html, {
    runScripts: 'dangerously', pretendToBeVisual: true,
    url: 'https://localhost/bottle-lobby-wine-guide.html' + (urlSuffix || ''),
    virtualConsole: new VirtualConsole().on('jsdomError', e => errs.push(e.message))
  });
  if (errs.length) { console.log('SCRIPT ERRORS:\n' + errs.join('\n')); process.exit(1); }
  return dom.window;
}

const w = boot(), d = w.document;
console.log('page evaluated cleanly\n');

let fail = 0;
const bad = m => { console.log('  ✗ ' + m); fail++; };
const ok  = m => console.log('  ✓ ' + m);

function expectRed(label, check) {
  const before = fail;
  const realLog = console.log;
  console.log = () => {};
  try { check(); } finally { console.log = realLog; }
  const raised = fail - before;
  fail = before;
  if (raised) ok('counter-mutation: ' + label + ' — the check goes red (' + raised + ')');
  else bad('COUNTER-MUTATION STAYED GREEN: ' + label + ' — this check cannot fail and proves nothing');
}

const SHOWS  = () => w.eval('wineShows');
const EVENTS = () => w.eval('memberEvents');

/* The anonymous entitlement, derived HERE and not borrowed from the
   asset: a stranger may see a show in a listable stage whose reach
   includes 'public' (or that is past its release), and a member event
   the host published to 'public' — with no geographic narrowing,
   because a narrowing fails a reader without a location. */
const anonShow  = s => ['planning', 'published', 'completed'].includes(s.stage) &&
                       (['published', 'completed'].includes(s.stage) || (s.reach || []).includes('public'));
const anonEvent = e => ['published', 'postponed', 'completed'].includes(e.status) &&
                       !e.moderation &&
                       !e.reachCity && !e.reachRegion && !e.reachCountry &&
                       (e.reach || []).includes('public');
const dateVal = v => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v || '');
  return m ? Number(m[1]) * 10000 + Number(m[2]) * 100 + Number(m[3]) : Number.MAX_SAFE_INTEGER;
};
const visibleText = () => {
  const clone = d.body.cloneNode(true);
  [...clone.querySelectorAll('script,style')].forEach(n => n.remove());
  return clone.textContent;
};
const cellTitles = id => [...d.querySelectorAll('#' + id + ' > div')].map(c =>
  (c.querySelector('.ws-public-title') || c.querySelector('.me-card-title') || {}).textContent);
const eventCell = id => d.querySelector('#events-upcoming .me-cell[data-event-id="' + id + '"], ' +
                                        '#events-past .me-cell[data-event-id="' + id + '"]');

/* ── 1. The tab renders shared records, not a copy ───────────────── */
console.log('── shared source');
{
  const raw = loadDashboard(PAGE).raw;
  const pasted = SHOWS().filter(s => raw.includes(s.title))
    .concat(EVENTS().filter(e => raw.includes(e.title)));
  if (pasted.length) bad('titles hard-coded into the page: ' + pasted.map(x => x.title).join(', '));
  else ok(SHOWS().length + ' shows and ' + EVENTS().length + ' events, none typed into the page');

  ['directoryEntries', 'mountDirectory', 'memberEventCard', 'publicShowCard'].forEach(fn => {
    if (w.eval('typeof ' + fn) !== 'function') bad('shared ' + fn + '() not loaded');
  });
  ok('the shared renderers are loaded');

  /* Derived, measured on the surface: an edit to the record reaches
     the rendered tab without anything being copied. */
  const ev = EVENTS().find(anonEvent);
  const was = ev.title;
  ev.title = 'Renamed In Place';
  w.renderEventsDirectory();
  const follows = visibleText().includes('Renamed In Place');
  ev.title = was;
  w.renderEventsDirectory();
  if (!follows) bad('the tab kept the old title after the record changed — a copy, not a derivation');
  else ok('the rendered tab follows an edit to the record: derived, not stored');
}

/* ── 2. The anonymous reach answer ───────────────────────────────── */
console.log('\n── who a stranger may see');
{
  const listedTitles = cellTitles('events-upcoming').concat(cellTitles('events-past'));

  const shouldShow = SHOWS().filter(anonShow).concat(EVENTS().filter(anonEvent));
  const dropped = shouldShow.filter(x => !listedTitles.includes(x.title));
  if (dropped.length) bad('anonymous-visible records missing: ' + dropped.map(x => x.title).join(', '));
  else ok('all ' + shouldShow.length + ' records a stranger may find are listed');

  const events = EVENTS().filter(anonEvent);
  if (!events.length) bad('no member event is publicly reachable — the second card sort is unmeasured');
  else ok(events.length + ' of them member event(s): both kinds really appear');

  const body = visibleText();
  const ghosts = SHOWS().filter(s => !anonShow(s))
    .concat(EVENTS().filter(e => !anonEvent(e)))
    .filter(x => body.includes(x.title));
  if (ghosts.length) bad('excluded records leave a trace: ' + ghosts.map(x => x.title).join(', '));
  else ok('excluded shows and events leave no card, no title, no count (WS-4\'s rule, both kinds)');

  expectRed('list every member event regardless of reach', () => {
    const real = w.visibleEvents;
    w.visibleEvents = (all, past) => (all || []).filter(e =>
      (past ? ['completed'] : ['published', 'postponed']).includes(e.status));
    try {
      w.renderEventsDirectory();
      const t = visibleText();
      const g = EVENTS().filter(e => !anonEvent(e)).filter(e => t.includes(e.title));
      if (g.length) bad('leaked: ' + g.map(e => e.id).join(', '));
    } finally { w.visibleEvents = real; w.renderEventsDirectory(); }
  });
}

/* ── 3. One list, chronological across both kinds ────────────────── */
console.log('\n── the mixed order');
{
  const expectUp = SHOWS().filter(s => anonShow(s) && s.stage !== 'completed')
    .concat(EVENTS().filter(e => anonEvent(e) && e.status !== 'completed'))
    .sort((a, b) => dateVal(a.date) - dateVal(b.date)).map(x => x.title);
  const got = cellTitles('events-upcoming');
  if (got.join('|') !== expectUp.join('|'))
    bad('upcoming is not one chronological list:\n      got      ' + got.join('  ·  ') +
        '\n      expected ' + expectUp.join('  ·  '));
  else ok('upcoming is one list, soonest first, both kinds interleaved (' + got.length + ')');

  const kinds = [...d.querySelectorAll('#events-upcoming > div')].map(c => c.className);
  if (!kinds.includes('ws-cell') || !kinds.some(k => k.includes('me-cell')))
    bad('only one card sort is rendered: ' + [...new Set(kinds)].join(', '));
  else ok('and the two card sorts really sit in the same grid: ' + kinds.join(' → '));

  const expectPast = SHOWS().filter(s => anonShow(s) && s.stage === 'completed')
    .concat(EVENTS().filter(e => anonEvent(e) && e.status === 'completed'))
    .sort((a, b) => dateVal(b.date) - dateVal(a.date)).map(x => x.title);
  const gotPast = cellTitles('events-past');
  if (gotPast.join('|') !== expectPast.join('|')) bad('past is not most-recent-first: ' + gotPast.join(' · '));
  else ok('past listings are there too, most recent first (' + gotPast.length + ')');

  expectRed('sort the two kinds separately', () => {
    const real = w.directoryEntries;
    w.directoryEntries = (shows, events, past, viewer) =>
      w.publicShows(shows || [], past, viewer).map(rec => ({ kind: 'show', rec }))
        .concat(w.visibleEvents(events || [], past, viewer).map(rec => ({ kind: 'event', rec })));
    try {
      w.renderEventsDirectory();
      if (cellTitles('events-upcoming').join('|') !== expectUp.join('|')) bad('order broke');
    } finally { w.directoryEntries = real; w.renderEventsDirectory(); }
  });
}

/* ── 4. Two kinds, two promises — and the ME-5 naming ────────────── */
console.log('\n── the event card on a public page');
{
  const MARKERS = w.eval('SHOW_GUARANTEE_MARKERS');
  const pub = EVENTS().find(anonEvent);
  const cell = eventCell(pub.id);
  if (!cell) { bad(pub.id + ' has no cell — nothing to measure'); }
  else {
    const html = cell.innerHTML;
    const hit = MARKERS.filter(m => html.includes(m));
    if (hit.length) bad(pub.id + ' asserts the show guarantee: ' + hit.join(' / '));
    else ok('no guarantee phrase on the event card, beside released shows in the same grid');
    if (!html.includes(w.eval('MEMBER_EVENT_DISCLAIMER'))) bad('the non-release wording is missing');
    else ok('and the non-release wording is on it in full');
    if (html.includes('"ws-public') || html.includes('"ws-teaser')) bad('the event cell wears the show card');
    else ok('and it wears its own card, not the show card');
  }

  /* ME-5 on this surface: the accepted winemaker is named; one status
     earlier the same name is off the card. */
  const maker = pub.participants.find(x =>
    ['winemaker', 'exhibitor'].includes(x.role) && ['accepted', 'attended'].includes(x.status));
  if (!maker) bad(pub.id + ' has no accepted winemaker/exhibitor — the naming is unmeasured here');
  else if (!cell.textContent.includes(maker.stakeholder))
    bad(maker.stakeholder + ', accepted ' + maker.role + ', is not named on the public card');
  else ok(maker.stakeholder + ', accepted ' + maker.role + ', is named on the public card');

  const others = pub.participants.filter(x => x.role !== 'host' && x !== maker &&
    !(['winemaker', 'exhibitor'].includes(x.role) && ['accepted', 'attended'].includes(x.status)));
  const leakedNames = others.filter(x => cell.textContent.includes(x.stakeholder));
  if (leakedNames.length) bad('protected names on the card: ' + leakedNames.map(x => x.stakeholder).join(', '));
  else ok('and its ' + others.length + ' other participant(s) — applicant, sponsor, guests — stay unnamed');

  if (maker) {
    const was = maker.status;
    maker.status = 'sent';
    w.renderEventsDirectory();
    const leaked = eventCell(pub.id).textContent.includes(maker.stakeholder);
    maker.status = was;
    w.renderEventsDirectory();
    if (leaked) bad('the same name stays on the card while the invitation is unanswered');
    else ok('one status earlier — sent instead of accepted — the same name is off this card too');
  }

  expectRed('give the event card the show promise', () => {
    const real = w.memberEventCard;
    w.memberEventCard = e => real(e).replace('</div></div>',
      '<div>' + MARKERS[0] + '</div></div></div>');
    try {
      w.renderEventsDirectory();
      const h = eventCell(pub.id).innerHTML;
      if (MARKERS.some(m => h.includes(m))) bad('marker on the card');
    } finally { w.memberEventCard = real; w.renderEventsDirectory(); }
  });
}

/* ── 5. The join note, and filters over real data only ───────────── */
console.log('\n── the join note and the two filters');
{
  const note = d.querySelector('.events-join-note');
  if (!note || !note.textContent.includes('Members see more'))
    bad('no visible join note — a stranger cannot tell the list is the public subset');
  else ok('the join note says in words that members see more');

  const all = SHOWS().filter(anonShow).concat(EVENTS().filter(anonEvent));
  const cityOpts = [...d.getElementById('filter-events-city').options].map(o => o.value).filter(Boolean);
  const empty = cityOpts.filter(c => !all.some(x => x.city === c));
  const missing = [...new Set(all.map(x => x.city).filter(Boolean))].filter(c => !cityOpts.includes(c));
  if (empty.length) bad('city options with nothing behind them: ' + empty.join(', '));
  else if (missing.length) bad('cities with listings but no option: ' + missing.join(', '));
  else ok('the city filter is exactly the cities with listings: ' + cityOpts.join(', '));

  /* Driven as changes, not as function calls. */
  const kindSel = d.getElementById('filter-events-kind');
  kindSel.value = 'event';
  kindSel.dispatchEvent(new w.Event('change'));
  const onlyEvents = [...d.querySelectorAll('#events-upcoming > div, #events-past > div')];
  if (!onlyEvents.length || onlyEvents.some(c => !c.className.includes('me-cell')))
    bad('the kind filter does not narrow to member events');
  else ok('kind = Member Events narrows to the second card sort (' + onlyEvents.length + ')');
  kindSel.value = '';
  const citySel = d.getElementById('filter-events-city');
  citySel.value = 'Frankfurt';
  citySel.dispatchEvent(new w.Event('change'));
  const inCity = cellTitles('events-upcoming').concat(cellTitles('events-past'));
  const expected = all.filter(x => x.city === 'Frankfurt').map(x => x.title);
  if (inCity.slice().sort().join('|') !== expected.slice().sort().join('|'))
    bad('city = Frankfurt shows ' + inCity.join(', ') + ' instead of ' + expected.join(', '));
  else ok('city = Frankfurt narrows both kinds to Frankfurt (' + expected.length + ')');
  citySel.value = '';
  citySel.dispatchEvent(new w.Event('change'));

  expectRed('offer a city no listing is in', () => {
    citySel.innerHTML += '<option value="Palermo">Palermo</option>';
    try {
      const opts = [...citySel.options].map(o => o.value).filter(Boolean);
      const e = opts.filter(c => !all.some(x => x.city === c));
      if (e.length) bad('empty option: ' + e.join(', '));
    } finally {
      citySel.removeChild(citySel.lastChild);
    }
  });
}

/* ── 6. Every deep link that existed still works, plus #events ───── */
console.log('\n── deep links, old and new');
{
  const activeTab = win => [...win.document.querySelectorAll('.guide-panel')]
    .find(x => x.classList.contains('active')).id;

  const ev = boot('#events');
  if (activeTab(ev) !== 'gpanel-events') bad('#events does not open the Events tab (got ' + activeTab(ev) + ')');
  else ok('#events opens the Events tab directly');

  ['wines', 'wineries', 'distributors', 'restaurants', 'retailers'].forEach(h => {
    const win = boot('#' + h);
    if (activeTab(win) !== 'gpanel-' + h) bad('#' + h + ' no longer opens its tab');
    else ok('#' + h + ' still opens its tab');
  });

  /* The B7 route from every wine article page: the filtered Wines view. */
  const g = boot('?grape=Chardonnay#wines');
  if (activeTab(g) !== 'gpanel-wines') bad('?grape=…#wines does not land on the Wines tab');
  else {
    const chard = g.eval('wines').filter(x => x.grape.split(',').map(s => s.trim()).includes('Chardonnay'));
    const count = g.document.getElementById('count-wines').textContent;
    if (!g.eval('state').wines.filters.grape || ![...g.eval('state').wines.filters.grape].includes('Chardonnay'))
      bad('the grape filter is not applied');
    else if (!count.includes(String(chard.length)))
      bad('?grape=Chardonnay counts "' + count + '" against ' + chard.length + ' Chardonnay wines in the data');
    else ok('?grape=Chardonnay#wines still lands filtered: ' + chard.length + ' wines, as before');
  }
}

console.log(fail ? '\n' + fail + ' failure(s)' : '\nwine guide: the Events tab answers like every other public surface');
process.exit(fail ? 1 : 0);
