/* bottle-lobby-wine-guide.html — the Guide's Events tab (A16.14d) and
   the deep links the rest of the site relies on.
   ------------------------------------------------------------------
   The Guide's Wines/Wineries/... tabs render the page's own inline
   arrays — that is the D34 copy, known and deliberately not this
   pass's business. What IS this file's business:

     · the EVENTS tab is THE derived directory, since O5 over FOUR
       record sorts (ME-1, DIR-1) — Wine Shows, member events,
       published fair editions and publicly released fair
       participations — and an anonymous reader sees exactly what the
       derivations grant a stranger and not one card more (A16.14b,
       A19.3, A21.7);
     · four sorts, THREE families (DIR-2);
     · one shell, four compositions, and no promise borrowed across
       them (ME-3, DIR-3) — the accepted winemaker is named on the
       public event card while everyone protected stays a head count
       (ME-5, D42);
     · one mixed, chronological order across all four card sorts;
     · one filter sidebar, options and counts derived live, no empty
       category (DIR-5);
     · the external ticket link, rendered by its own rules (DIR-6);
     · no invented figure, no copied content, one escaper (DIR-7);
     · and every deep link that existed before this tab still works:
       #wines … #retailers, and ?grape=<name>#wines from the article
       pages (B7).

   Each central claim runs its counter-mutation, exactly as
   tests/member-events.js does it: a check that stays green when the
   rule is broken proves nothing. */
const fs = require('fs');
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

const SHOWS    = () => w.eval('wineShows');
const EVENTS   = () => w.eval('memberEvents');
const EDITIONS = () => w.eval('fairEditions');
const PARTS    = () => w.eval('fairParticipations');
const TODAY    = w.eval('SHOW_TODAY');
const render   = () => w.renderEventsDirectory();

/* The anonymous entitlement, derived HERE and not borrowed from the
   asset: a stranger may see a show in a listable stage whose reach
   includes 'public' (or that is past its release), a member event the
   host published to 'public' — with no geographic narrowing, because a
   narrowing fails a reader without a location — a PUBLISHED fair
   edition of any type, and an ACTIVE participation whose edition is
   published. Nothing else, and no admission anywhere. */
const anonShow  = s => ['planning', 'published', 'completed'].includes(s.stage) &&
                       (['published', 'completed'].includes(s.stage) || (s.reach || []).includes('public'));
const anonEvent = e => ['published', 'postponed', 'completed'].includes(e.status) &&
                       !e.moderation &&
                       !e.reachCity && !e.reachRegion && !e.reachCountry &&
                       (e.reach || []).includes('public');
const anonEdition = ed => ed.status === 'published';
const editionOf   = p  => EDITIONS().find(e => e.id === p.editionId);
const anonPart    = p  => p.status === 'active' && !!editionOf(p) && anonEdition(editionOf(p));
/* "Past" per sort, derived here too: a show and an event carry it in
   their state, a fair in its own last day against the demo's today. */
const pastEdition = ed => (ed.endDate || ed.startDate) < TODAY;

const dateVal = v => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v || '');
  return m ? Number(m[1]) * 10000 + Number(m[2]) * 100 + Number(m[3]) : Number.MAX_SAFE_INTEGER;
};
/* Every record a stranger may find, as { key, date, past, family }.
   Built from the four raw collections, independently of the page. */
function expected() {
  const out = [];
  SHOWS().filter(anonShow).forEach(s => out.push(
    { key: s.id, date: s.date, past: s.stage === 'completed', family: 'Wine Show' }));
  EVENTS().filter(anonEvent).forEach(e => out.push(
    { key: e.id, date: e.date, past: e.status === 'completed', family: 'Member Event' }));
  EDITIONS().filter(anonEdition).forEach(ed => out.push(
    { key: ed.id, date: ed.startDate, past: pastEdition(ed), family: 'Fair' }));
  PARTS().filter(anonPart).forEach(p => {
    const ed = editionOf(p);
    out.push({ key: p.id, date: ed.startDate, past: pastEdition(ed), family: 'Fair' });
  });
  return out;
}

const panelText = () => {
  const clone = d.getElementById('gpanel-events').cloneNode(true);
  [...clone.querySelectorAll('script,style')].forEach(n => n.remove());
  return clone.textContent;
};
/* The identity of a rendered cell, per sort, off the markup the
   renderers emit — no title matching: three Uferlicht editions carry
   one series name and would be indistinguishable by it. */
const cellKey = c => c.dataset.editionId || c.dataset.participationId || c.dataset.eventId ||
  (((c.querySelector('.ws-listing') || {}).id) || '').replace('ws-listing-', '');
const cells = id => [...d.querySelectorAll('#' + id + ' > div')];
const keys  = id => cells(id).map(cellKey);
const cellFor = key => [...d.querySelectorAll('#events-upcoming > div, #events-past > div')]
  .find(c => cellKey(c) === key);

/* ── The sidebar, read like a reader reads it ─────────────────────
   Options are clicked, never set: a facet that only works when the
   harness calls the function behind it proves nothing about the
   surface. */
function setFilter(field, value, on) {
  const cb = [...d.querySelectorAll('#sidebar-events .fopt-cb')]
    .find(x => x.dataset.field === field && x.dataset.value === value);
  if (!cb) { bad('no filter option ' + field + ' = ' + value + ' to click'); return false; }
  cb.checked = !!on;
  cb.dispatchEvent(new w.Event('change', { bubbles: true }));
  return true;
}
const groupLabels = () => [...d.querySelectorAll('#filter-groups-events .filter-group-header span:first-child')]
  .map(x => x.textContent.trim());
const groupEl = label => [...d.querySelectorAll('#filter-groups-events .filter-group')]
  .find(g => {
    const h = g.querySelector('.filter-group-header span:first-child');
    return h && h.textContent.trim() === label;
  });
const groupOptions = label => {
  const g = groupEl(label);
  return g ? [...g.querySelectorAll('.filter-option')].map(o => ({
    value: o.querySelector('.fopt-cb').dataset.value,
    count: Number((o.querySelector('.fg-count').textContent.match(/\d+/) || [0])[0])
  })) : [];
};


/* ── 1. The tab renders shared records, not a copy ───────────────── */
console.log('── shared source');
{
  const raw = loadDashboard(PAGE).raw;
  const pasted = SHOWS().filter(s => raw.includes(s.title))
    .concat(EVENTS().filter(e => raw.includes(e.title)));
  const pastedFair = w.eval('fairSeries').filter(s => raw.includes(s.name))
    .concat(EDITIONS().filter(e => e.description && raw.includes(e.description)));
  if (pasted.length || pastedFair.length)
    bad('record content hard-coded into the page: ' +
        pasted.map(x => x.title).concat(pastedFair.map(x => x.name || x.id)).join(', '));
  else ok(SHOWS().length + ' shows, ' + EVENTS().length + ' events, ' + EDITIONS().length +
          ' editions and ' + PARTS().length + ' participations, none typed into the page');

  ['directoryEntries', 'mountDirectory', 'memberEventCard', 'publicShowCard',
   'fairEditionCellHtml', 'fairParticipationCellHtml', 'fairEditionDiscoverable',
   'fairParticipationPublic'].forEach(fn => {
    if (w.eval('typeof ' + fn) !== 'function') bad('shared ' + fn + '() not loaded');
  });
  ok('the shared derivations and renderers are loaded');

  /* Derived, measured on the surface: an edit to the record reaches
     the rendered tab without anything being copied — for a member
     event and for a fair edition alike (DIR-7). */
  const ev = EVENTS().find(anonEvent);
  const was = ev.title;
  ev.title = 'Renamed In Place';
  render();
  const followsEvent = panelText().includes('Renamed In Place');
  ev.title = was;
  const ed = EDITIONS().find(anonEdition);
  const wasCity = ed.city;
  ed.city = 'Renamed City';
  render();
  const followsFair = panelText().includes('Renamed City');
  ed.city = wasCity;
  render();
  if (!followsEvent || !followsFair)
    bad('the tab kept an old value after the record changed — a copy, not a derivation (' +
        (followsEvent ? '' : 'event ') + (followsFair ? '' : 'edition') + ')');
  else ok('the rendered tab follows an edit to the event AND to the edition: derived, not stored');
}

/* ── 2. Who a stranger may see, over all four sorts ──────────────── */
console.log('\n── who a stranger may see (DIR-1)');
{
  const listed = keys('events-upcoming').concat(keys('events-past'));
  const want = expected();
  const dropped = want.filter(x => !listed.includes(x.key));
  const extra = listed.filter(k => !want.some(x => x.key === k));
  if (dropped.length) bad('records a stranger may find are missing: ' + dropped.map(x => x.key).join(', '));
  else if (extra.length) bad('the directory lists records no derivation grants: ' + extra.join(', '));
  else ok('exactly the ' + want.length + ' records the four derivations grant a stranger are listed');

  const byFamily = f => want.filter(x => x.family === f).length;
  if (byFamily('Wine Show') && byFamily('Member Event') && byFamily('Fair'))
    ok('all three families are really present: ' + byFamily('Wine Show') + ' shows, ' +
       byFamily('Member Event') + ' member event(s), ' + byFamily('Fair') + ' fair entries');
  else bad('a family has no visible record — the mixed directory is unmeasured');
  const sorts = [...new Set(cells('events-upcoming').concat(cells('events-past'))
    .map(c => c.className.trim().split(/\s+/)[0]))];
  if (['ws-cell', 'me-cell', 'fe-cell', 'fp-cell'].every(c => sorts.includes(c)))
    ok('and all four card sorts really sit in the same two grids: ' + sorts.join(' · '));
  else bad('a card sort never renders: ' + sorts.join(', '));

  /* WS-4's rule, over four sorts: excluded means absent — no card, no
     title, no count, no trace in the panel's text. */
  const body = panelText();
  const ghosts = SHOWS().filter(s => !anonShow(s)).map(s => s.title)
    .concat(EVENTS().filter(e => !anonEvent(e)).map(e => e.title))
    .concat(EDITIONS().filter(ed => !anonEdition(ed)).map(ed => ed.description))
    .filter(t => t && body.includes(t));
  if (ghosts.length) bad('excluded records leave a trace: ' + ghosts.join(' / '));
  else ok('excluded shows, events and draft editions leave no card, no title, no count');
}

/* ── 3. The two fair gates, each with its own counter-mutation ───── */
console.log('\n── the fair sorts pass their own gates and no other (DIR-1)');
{
  const draft = EDITIONS().find(ed => ed.status === 'draft');
  if (!draft) bad('no draft edition in the fixtures — FS-6 is unmeasured here');
  else if (!keys('events-upcoming').concat(keys('events-past')).includes(draft.id))
    ok('the draft edition ' + draft.id + ' is on no directory (FS-6)');
  else bad(draft.id + ', a draft, is listed');

  /* A published edition CANCELLED is no longer a published one. */
  const ed = EDITIONS().find(anonEdition);
  const wasStatus = ed.status;
  ed.status = 'cancelled';
  render();
  const goneOnCancel = !keys('events-upcoming').concat(keys('events-past')).includes(ed.id);
  ed.status = wasStatus;
  render();
  if (goneOnCancel) ok('a cancelled edition falls off the directory — findability follows the one derivation');
  else bad('a cancelled edition stayed listed');

  const p = PARTS().find(anonPart);
  ['withdrawn', 'rescinded'].forEach(s => {
    const wasP = p.status;
    p.status = s;
    render();
    const gone = !keys('events-upcoming').concat(keys('events-past')).includes(p.id);
    p.status = wasP;
    render();
    if (gone) ok('a ' + s + ' participation is off the directory (FP-10, FP-11)');
    else bad('a ' + s + ' participation stayed listed');
  });
  /* Factor (c): the participation falls with ITS edition. */
  {
    const pe = editionOf(p);
    const wasS = pe.status;
    pe.status = 'draft';
    render();
    const gone = !keys('events-upcoming').concat(keys('events-past')).includes(p.id);
    pe.status = wasS;
    render();
    if (gone) ok("an active participation at an unpublished edition is off it too — the gate's third factor");
    else bad('a participation survived its edition being unpublished');
  }

  expectRed('list every edition regardless of status', () => {
    const real = w.publicFairEditions;
    w.publicFairEditions = (all, past) => (all || []).filter(x =>
      ((x.endDate || x.startDate) < TODAY) === !!past);
    try {
      render();
      const listed = keys('events-upcoming').concat(keys('events-past'));
      const leaked = EDITIONS().filter(x => !anonEdition(x)).filter(x => listed.includes(x.id));
      if (leaked.length) bad('leaked: ' + leaked.map(x => x.id).join(', '));
    } finally { w.publicFairEditions = real; render(); }
  });
  expectRed('list every participation regardless of the triple gate', () => {
    const real = w.publicFairParticipations;
    w.publicFairParticipations = (all) => (all || []);
    try {
      const wasP = p.status;
      p.status = 'withdrawn';
      render();
      const listed = keys('events-upcoming').concat(keys('events-past'));
      if (listed.includes(p.id)) bad('leaked: ' + p.id);
      p.status = wasP;
    } finally { w.publicFairParticipations = real; render(); }
  });

  /* FR-11 on this surface: no admission record exists here at all,
     and nothing in the page's source names one. */
  const raw = loadDashboard(PAGE).raw;
  if (w.eval('typeof fairAdmissions') === 'undefined' && !/fairAdmission/.test(raw))
    ok('no admission record exists on this document and none is named in its source (FR-11)');
  else bad('the Guide reaches a private recruiting record');
  /* AND THE SAME RULE ON THE CELL: an organisation reaches a fair card
     only as a PUBLIC participation. A house that is merely admitted —
     or whose participation has ended — is not named on the edition it
     was admitted to, and there is no register on this page that could
     name it (FR-11). Measured on the card rather than on the data,
     because the card is where a name would actually escape. */
  const gatedEd = editionOf(p);
  const wasStatus2 = p.status;
  p.status = 'withdrawn';
  render();
  const namedAnyway = cellFor(gatedEd.id).textContent.includes(p.org);
  p.status = wasStatus2;
  render();
  if (!namedAnyway)
    ok('an organisation whose participation has ended is not named on the edition card either');
  else bad(p.org + ' stays named on ' + gatedEd.id + ' without a public participation');

  expectRed('an edition card naming every organisation on it', () => {
    const real = w.fairEditionExhibitors;
    w.fairEditionExhibitors = ed2 => PARTS().filter(x => x.editionId === ed2.id);
    const was2 = p.status;
    p.status = 'withdrawn';
    try {
      render();
      if (cellFor(gatedEd.id).textContent.includes(p.org)) bad('named anyway');
    } finally { w.fairEditionExhibitors = real; p.status = was2; render(); }
  });
}

/* ── 4. Four sorts, three families (DIR-2) ───────────────────────── */
console.log('\n── three families at four record sorts');
{
  const families = w.eval('DIRECTORY_FAMILIES');
  if (families.length === 3 && families.join('|') === 'Wine Show|Member Event|Fair')
    ok('the family vocabulary is exactly three: ' + families.join(' · '));
  else bad('the family vocabulary is not the three of A16.14d: ' + families.join(', '));

  const rows = w.eval('eventsFacetRows()');
  const offered = [...new Set(rows.map(r => r.family))];
  if (offered.length === 3 && offered.every(f => families.includes(f)))
    ok('and the visible entries carry those three and no fourth: ' + offered.join(' · '));
  else bad('a fourth family reached the surface: ' + offered.join(', '));

  const parts = rows.filter(r => r.entry.kind === 'fairParticipation');
  const eds   = rows.filter(r => r.entry.kind === 'fairEdition');
  if (parts.length && parts.every(r => r.family === 'Fair') &&
      eds.length && eds.every(r => r.family === 'Fair'))
    ok('both fair sorts sit in the Fair family (' + eds.length + ' editions, ' + parts.length + ' presences)');
  else bad('a fair record sort is not in the Fair family');

  /* The top-level filter group offers exactly three options, and none
     of them is a participation option. */
  const opts = () => groupEl('Event family');
  const famGroup = opts();
  const famOptions = famGroup ? [...famGroup.querySelectorAll('.fopt-cb')].map(cb => cb.dataset.value) : [];
  if (famOptions.length === 3 && !famOptions.some(o => /participation|presence/i.test(o)))
    ok('the top-level family filter offers exactly three options and no "Participation": ' + famOptions.join(' · '));
  else bad('the family filter is not the three-part one: ' + famOptions.join(', '));

  /* Selecting Fair finds the participation — it is findable AS a fair
     rather than as a family of its own. */
  setFilter('family', 'Fair', true);
  const underFair = keys('events-upcoming').concat(keys('events-past'));
  const wantFair = expected().filter(x => x.family === 'Fair').map(x => x.key);
  if (wantFair.every(k => underFair.includes(k)) && underFair.length === wantFair.length)
    ok('family = Fair finds the editions AND the exhibitor presences (' + underFair.length + ')');
  else bad('family = Fair does not carry both fair sorts: ' + underFair.join(', '));
  setFilter('family', 'Fair', false);

  expectRed('a participation as a fourth family', () => {
    const real = w.directoryEntryFamily;
    w.directoryEntryFamily = en => en.kind === 'fairParticipation' ? 'Participation' : real(en);
    try {
      const rows2 = w.eval('eventsFacetRows()');
      const off = [...new Set(rows2.map(r => r.family))];
      if (off.length !== 3 || !off.every(f => families.includes(f)))
        bad('a fourth family reached the surface: ' + off.join(', '));
      if (rows2.filter(r => r.entry.kind === 'fairParticipation').some(r => r.family !== 'Fair'))
        bad('a participation left the Fair family');
    } finally { w.directoryEntryFamily = real; render(); }
  });
  expectRed('a top-level "Participation" filter option', () => {
    const real = w.directoryEntryFamily;
    w.directoryEntryFamily = en => en.kind === 'fairParticipation' ? 'Participation' : real(en);
    try {
      w.renderFilters('events');
      const g = opts();
      const o = g ? [...g.querySelectorAll('.fopt-cb')].map(cb => cb.dataset.value) : [];
      if (o.length !== 3 || o.some(x => /participation|presence/i.test(x)))
        bad('the family filter is not the three-part one: ' + o.join(', '));
    } finally { w.directoryEntryFamily = real; w.renderFilters('events'); render(); }
  });
  expectRed('a fair edition outside the Fair family', () => {
    const real = w.directoryEntryFamily;
    w.directoryEntryFamily = en => en.kind === 'fairEdition' ? 'Wine Show' : real(en);
    try {
      const rows2 = w.eval('eventsFacetRows()');
      if (rows2.filter(r => r.entry.kind === 'fairEdition').some(r => r.family !== 'Fair'))
        bad('an edition left the Fair family');
    } finally { w.directoryEntryFamily = real; render(); }
  });
}

/* ── 5. One list, chronological across all four sorts ────────────── */
console.log('\n── the mixed order');
{
  const expectUp = expected().filter(x => !x.past)
    .sort((a, b) => dateVal(a.date) - dateVal(b.date)).map(x => x.key);
  const got = keys('events-upcoming');
  if (got.join('|') !== expectUp.join('|'))
    bad('upcoming is not one chronological list:\n      got      ' + got.join('  ·  ') +
        '\n      expected ' + expectUp.join('  ·  '));
  else ok('upcoming is one list, soonest first, all four sorts interleaved (' + got.length + ')');

  const expectPast = expected().filter(x => x.past)
    .sort((a, b) => dateVal(b.date) - dateVal(a.date)).map(x => x.key);
  const gotPast = keys('events-past');
  if (gotPast.join('|') !== expectPast.join('|')) bad('past is not most-recent-first: ' + gotPast.join(' · '));
  else ok('past listings are there too, most recent first (' + gotPast.length + ')');

  expectRed('sort the four sorts separately', () => {
    const real = w.directoryEntries;
    w.directoryEntries = (sources, past, viewer) =>
      w.publicShows(sources.shows || [], past, viewer).map(rec => ({ kind: 'show', rec }))
        .concat(w.visibleEvents(sources.events || [], past, viewer).map(rec => ({ kind: 'event', rec })))
        .concat(w.publicFairEditions(sources.fairEditions || [], past).map(rec => ({ kind: 'fairEdition', rec })))
        .concat(w.publicFairParticipations(sources.fairParticipations || [], past)
          .map(rec => ({ kind: 'fairParticipation', rec })));
    try {
      render();
      if (keys('events-upcoming').join('|') !== expectUp.join('|')) bad('order broke');
    } finally { w.directoryEntries = real; render(); }
  });
}

/* ── 6. Four promises, kept apart (ME-3, DIR-3) ──────────────────── */
console.log('\n── one shell, four promises');
{
  const MARKERS = w.eval('SHOW_GUARANTEE_MARKERS');
  const CLASSES = w.eval('SHOW_CARD_CLASSES');

  /* The Wine Show keeps everything it had: its classes, its guarantee
     wording, its expand affordance. */
  const show = SHOWS().find(s => anonShow(s) && s.stage === 'published');
  const showCell = cellFor(show.id);
  if (showCell && CLASSES.every(c => showCell.innerHTML.includes(c)) &&
      MARKERS.some(m => showCell.innerHTML.includes(m)))
    ok('the Wine Show card is unchanged: all ' + CLASSES.length +
       ' guarantee classes and its release wording still on it');
  else bad('the Wine Show card lost a guarantee class or its wording');

  /* And nobody else wears either. */
  const others = [...d.querySelectorAll('#events-upcoming > div, #events-past > div')]
    .filter(c => !c.className.includes('ws-cell'));
  const wearing = others.filter(c =>
    CLASSES.some(k => c.innerHTML.includes('"' + k)) || MARKERS.some(m => c.innerHTML.includes(m)));
  if (wearing.length)
    bad('a non-show card wears a Wine Show guarantee marker: ' + wearing.map(cellKey).join(', '));
  else ok('no member event, fair or presence card carries a guarantee class or phrase (' +
          others.length + ' cards checked)');

  /* Each of the three other sorts says what it IS. */
  const evCell = cellFor(EVENTS().find(anonEvent).id);
  const feCell = cellFor(EDITIONS().find(anonEdition).id);
  const fpCell = cellFor(PARTS().find(anonPart).id);
  if (evCell.innerHTML.includes(w.eval('MEMBER_EVENT_DISCLAIMER')) &&
      feCell.innerHTML.includes(w.eval('FAIR_EDITION_DISCLAIMER')) &&
      fpCell.innerHTML.includes(w.eval('FAIR_PARTICIPATION_DISCLAIMER')))
    ok('and each carries its own sentence about who vouches for it — three different ones');
  else bad('a card sort does not say what it is');

  /* ME-5 on this surface, unchanged by O5. */
  const pub = EVENTS().find(anonEvent);
  const maker = pub.participants.find(x =>
    ['winemaker', 'exhibitor'].includes(x.role) && ['accepted', 'attended'].includes(x.status));
  if (!maker) bad(pub.id + ' has no accepted winemaker/exhibitor — the naming is unmeasured here');
  else if (!evCell.textContent.includes(maker.stakeholder))
    bad(maker.stakeholder + ', accepted ' + maker.role + ', is not named on the public card');
  else ok(maker.stakeholder + ', accepted ' + maker.role + ', is still named on the public event card (ME-5)');
  const protectedOnes = pub.participants.filter(x => x.role !== 'host' && x !== maker &&
    !(['winemaker', 'exhibitor'].includes(x.role) && ['accepted', 'attended'].includes(x.status)));
  const leaked = protectedOnes.filter(x => evCell.textContent.includes(x.stakeholder));
  if (leaked.length) bad('protected names on the card: ' + leaked.map(x => x.stakeholder).join(', '));
  else ok('and its ' + protectedOnes.length + ' protected participant(s) stay unnamed');

  expectRed('give the fair card the show promise', () => {
    const real = w.fairEditionCellHtml;
    w.fairEditionCellHtml = ed => real(ed).replace('</div></div>',
      '<div class="ws-public">' + MARKERS[0] + '</div></div></div>');
    try {
      render();
      const cs = [...d.querySelectorAll('#events-upcoming > div, #events-past > div')]
        .filter(c => !c.className.includes('ws-cell'));
      const hit = cs.filter(c =>
        CLASSES.some(k => c.innerHTML.includes('"' + k)) || MARKERS.some(m => c.innerHTML.includes(m)));
      if (hit.length) bad('marker on a non-show card: ' + hit.map(cellKey).join(', '));
    } finally { w.fairEditionCellHtml = real; render(); }
  });
  expectRed('ONE renderer for all four sorts', () => {
    const cell = w.eval('DIRECTORY_CELL');
    const realFe = cell.fairEdition, realFp = cell.fairParticipation, realEv = cell.event;
    /* Every sort rendered as a Wine Show — the mixed promise. */
    cell.fairEdition = rec => w.showCellHtml(SHOWS().find(anonShow), null, w.eval('SHOW_ANON'));
    cell.fairParticipation = cell.fairEdition;
    cell.event = cell.fairEdition;
    try {
      render();
      const cs = [...d.querySelectorAll('#events-upcoming > div, #events-past > div')];
      const wrong = cs.filter(c => CLASSES.some(k => c.innerHTML.includes('"' + k)))
        .filter(c => !c.className.includes('ws-cell'));
      const sortsNow = [...new Set(cs.map(c => c.className.trim().split(/\s+/)[0]))];
      if (wrong.length || !['ws-cell', 'me-cell', 'fe-cell', 'fp-cell'].every(x => sortsNow.includes(x)))
        bad('one renderer produced them all');
    } finally {
      cell.fairEdition = realFe; cell.fairParticipation = realFp; cell.event = realEv; render();
    }
  });
}

/* ── 7. ONE expand interaction, wired once (DIR-3) ───────────────── */
console.log('\n── the toggle exists once and serves both expanding sorts');
{
  const openOf = key => {
    const c = cellFor(key);
    const btn = c.querySelector('button');
    const panel = btn.nextElementSibling;
    btn.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
    const open = panel.classList.contains('open') && btn.getAttribute('aria-expanded') === 'true';
    btn.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
    return open && !panel.classList.contains('open');
  };
  const showKey = SHOWS().find(anonShow).id;
  const edKey   = EDITIONS().find(anonEdition).id;
  if (openOf(showKey) && openOf(edKey))
    ok('a Wine Show cell and a fair cell both open and close on a click');
  else bad('an expanding card sort does not toggle');

  /* Each keeps its OWN closed wording — the shared function decides
     the open state and nothing else. */
  const showMore = cellFor(showKey).querySelector('.bl-expand-more').textContent;
  const edMore   = cellFor(edKey).querySelector('.bl-expand-more').textContent;
  if (showMore === 'Full listing →' && edMore === 'Full listing →') ok('and each reads its own closed label back');
  else bad('the closed label did not come back: "' + showMore + '" / "' + edMore + '"');

  /* THE MEASUREMENT: neutralise the ONE wiring function and BOTH stop
     working. A second copy anywhere would leave one of them alive. */
  {
    const real = w.wireExpandableCards;
    w.wireExpandableCards = () => {};
    let stillWorks = [];
    try {
      render();
      if (openOf(showKey)) stillWorks.push('show');
      if (openOf(edKey)) stillWorks.push('fair');
    } finally { w.wireExpandableCards = real; render(); }
    if (!stillWorks.length)
      ok('with the one wiring function neutralised BOTH sorts stop toggling — there is no second copy of it');
    else bad('a second toggle implementation exists: ' + stillWorks.join(', ') + ' still opens');
  }
  /* And the participation cell is a LINK, not a second detail view. */
  const fp = cellFor(PARTS().find(anonPart).id);
  if (!fp.querySelector('button') && fp.querySelector('a[href^="bottle-lobby-fair-participation.html?id="]'))
    ok('the presence cell is a link to the canonical Participation Page — no parallel detail view (A21.7)');
  else bad('the presence cell built a detail view of its own');
}

/* ── 8. The canonical link target (A21.7, DIR-2) ─────────────────── */
console.log('\n── every presence links at the one canonical page');
{
  const parts = PARTS().filter(anonPart);
  const wrong = parts.filter(p => {
    const a = cellFor(p.id).querySelector('a');
    return !a || a.getAttribute('href') !== 'bottle-lobby-fair-participation.html?id=' + p.id;
  });
  if (!wrong.length) ok('all ' + parts.length + ' presence card(s) point at ?id= their own record');
  else bad('a presence card invents its target: ' + wrong.map(p => p.id).join(', '));

  expectRed('a presence card with its own detail target', () => {
    const real = w.fairParticipationCellHtml;
    w.fairParticipationCellHtml = p => real(p)
      .replace('bottle-lobby-fair-participation.html?id=' + p.id, 'bottle-lobby-fair-' + p.id + '.html');
    try {
      render();
      const bad2 = parts.filter(p => {
        const a = cellFor(p.id).querySelector('a');
        return !a || a.getAttribute('href') !== 'bottle-lobby-fair-participation.html?id=' + p.id;
      });
      if (bad2.length) bad('invented target');
    } finally { w.fairParticipationCellHtml = real; render(); }
  });
}

/* ── 9. The sidebar: live options, live counts, no empty category ── */
console.log('\n── the filter sidebar (DIR-5)');

{
  if (d.querySelector('#gpanel-events aside.filter-sidebar') &&
      !d.getElementById('filter-events-kind') && !d.getElementById('filter-events-city'))
    ok('the Events tab carries the other tabs\' own sidebar, and the two top dropdowns are gone');
  else bad('the old dropdowns still stand beside the sidebar, or the sidebar is missing');

  /* Every offered option has a record behind it, in both directions. */
  const rows = w.eval('eventsFacetRows()');
  let mismatched = [];
  [['Event family', 'family'], ['When', 'when'], ['City', 'city'], ['Member event host', 'hostRole']]
    .forEach(([label, field]) => {
      const offered = groupOptions(label);
      const real = {};
      rows.forEach(r => { if (r[field]) real[r[field]] = (real[r[field]] || 0) + 1; });
      offered.forEach(o => {
        if (!real[o.value]) mismatched.push(label + ' offers "' + o.value + '" with nothing behind it');
        else if (real[o.value] !== o.count)
          mismatched.push(label + ' counts ' + o.value + ' as ' + o.count + ', the result set says ' + real[o.value]);
      });
      Object.keys(real).forEach(v => {
        if (!offered.some(o => o.value === v)) mismatched.push(label + ' hides "' + v + '", which ' + real[v] + ' record(s) carry');
      });
    });
  if (mismatched.length) bad(mismatched.join(' · '));
  else ok('every option and every count equals the visible result set — in both directions');

  /* The fair type facet: absent until the reader is looking at fairs. */
  if (!groupLabels().includes('Fair type')) ok('the Fair type facet is not offered beside shows and member events');
  else bad('the fair type facet stands outside the Fair context');
  setFilter('family', 'Fair', true);
  const fairTypes = groupOptions('Fair type');
  const wantTypes = [...new Set(w.eval('eventsFacetRows()').map(r => r.fairType).filter(Boolean))];
  if (groupLabels().includes('Fair type') && fairTypes.length === wantTypes.length && wantTypes.length === 3)
    ok('inside the Fair context it appears with all three real types: ' +
       fairTypes.map(t => t.value + ' (' + t.count + ')').join(' · '));
  else bad('the fair type facet is wrong inside the Fair context: ' + fairTypes.map(t => t.value).join(', '));

  /* A type narrows to exactly the records that carry it. */
  setFilter('fairType', 'Consumer Fair', true);
  const shown = keys('events-upcoming').concat(keys('events-past'));
  const wantConsumer = w.eval('eventsFacetRows()').filter(r => r.fairType === 'Consumer Fair')
    .map(r => r.entry.rec.id);
  if (shown.slice().sort().join('|') === wantConsumer.slice().sort().join('|'))
    ok('fair type = Consumer narrows to exactly the consumer records (' + shown.length + ')');
  else bad('the fair type filter shows ' + shown.join(', '));
  setFilter('fairType', 'Consumer Fair', false);
  setFilter('family', 'Fair', false);

  /* Upcoming / past, and the city, both derived. */
  setFilter('when', 'Past', true);
  const pastOnly = keys('events-upcoming').concat(keys('events-past'));
  const wantPast = expected().filter(x => x.past).map(x => x.key);
  if (pastOnly.slice().sort().join('|') === wantPast.slice().sort().join('|'))
    ok('when = Past narrows to exactly the past records (' + pastOnly.length + ')');
  else bad('when = Past shows ' + pastOnly.join(', '));
  setFilter('when', 'Past', false);

  const city = groupOptions('City').find(c => c.count > 1);
  setFilter('city', city.value, true);
  const inCity = keys('events-upcoming').concat(keys('events-past'));
  if (inCity.length === city.count) ok('city = ' + city.value + ' narrows to its ' + city.count + ' listings');
  else bad('city = ' + city.value + ' shows ' + inCity.length + ' of ' + city.count);

  /* Clear all really clears. */
  d.getElementById('clearlink-events').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  w.clearFilters('events');
  if (keys('events-upcoming').concat(keys('events-past')).length === expected().length)
    ok('Clear all puts the whole visible set back');
  else bad('Clear all did not restore the list');

  /* A filter may narrow and never widen: whatever is shown under any
     single family selection is a subset of what the derivations grant. */
  const grantee = expected().map(x => x.key);
  let widened = [];
  ['Wine Show', 'Member Event', 'Fair'].forEach(f => {
    setFilter('family', f, true);
    keys('events-upcoming').concat(keys('events-past')).forEach(k => {
      if (!grantee.includes(k)) widened.push(f + ' → ' + k);
    });
    setFilter('family', f, false);
  });
  if (widened.length) bad('filtering showed a stranger something no derivation grants: ' + widened.join(', '));
  else ok('no family selection ever shows more than the derivations grant — a filter narrows only');

  expectRed('an option with nothing behind it', () => {
    const g = groupEl('City');
    g.querySelector('.filter-group-body').insertAdjacentHTML('beforeend',
      '<label class="filter-option"><input type="checkbox" class="fopt-cb" data-field="city" data-value="Palermo">' +
      '<span>Palermo</span><span class="fg-count">(3)</span></label>');
    try {
      const rows2 = w.eval('eventsFacetRows()');
      const offered = groupOptions('City');
      const empty = offered.filter(o => !rows2.some(r => r.city === o.value));
      if (empty.length) bad('empty option: ' + empty.map(o => o.value).join(', '));
    } finally { w.renderFilters('events'); }
  });
  expectRed('a frozen option list that no longer follows the records', () => {
    const real = w.eventsFacetRows;
    const frozen = real();
    w.eventsFacetRows = () => frozen;
    const ed = EDITIONS().find(anonEdition);
    const wasCity = ed.city;
    ed.city = 'Nowhere-on-Rhine';
    try {
      w.renderFilters('events');
      const offered = groupOptions('City').map(o => o.value);
      if (!offered.includes('Nowhere-on-Rhine'))
        bad('the option list did not follow the record');
    } finally {
      ed.city = wasCity; w.eventsFacetRows = real; w.renderFilters('events'); render();
    }
  });
  expectRed('the fair type facet offered outside the Fair context', () => {
    const cfg = w.eval('filterConfig');
    const f = cfg.events.fields.find(x => x.field === 'fairType');
    const realOnly = f.only;
    f.only = null;
    try {
      w.renderFilters('events');
      if (groupLabels().includes('Fair type')) bad('offered with no family selected');
    } finally { f.only = realOnly; w.renderFilters('events'); }
  });
  expectRed('a filter that widens past the derivations', () => {
    const real = w.eventsFacetRows;
    w.eventsFacetRows = () => real().concat(
      w.eval("[{ entry:{ kind:'fairEdition', rec: fairEditions.find(e => e.status === 'draft') }, when:'Upcoming', family:'Fair', city:'X', fairType:'Hybrid Fair', hostRole:null, text:'' }]"));
    try {
      render();
      const grantee2 = expected().map(x => x.key);
      const shown2 = keys('events-upcoming').concat(keys('events-past'));
      if (shown2.some(k => !grantee2.includes(k))) bad('a record no derivation grants is on the surface');
    } finally { w.eventsFacetRows = real; render(); }
  });
}

/* ── 10. The external ticket / accreditation link (DIR-6) ────────── */
console.log('\n── the ticket link renders by its own rules');
{
  const LABEL = w.eval('FAIR_TICKETING_LABEL');
  if (LABEL.trade === 'Trade Accreditation' && LABEL.consumer === 'Consumer Tickets' &&
      LABEL.hybrid === 'Hybrid Tickets & Accreditation')
    ok('the three captions are exactly the specified ones');
  else bad('a caption deviates: ' + JSON.stringify(LABEL));

  /* ONE derivation: the three strings appear once each in the code
     that renders them — in the map, and nowhere as a typed literal. */
  const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const sources = ['assets/bottle-lobby-data.js', 'assets/bottle-lobby-public-shows.js',
                   'bottle-lobby-wine-guide.html', 'bottle-lobby-dashboard.html']
    .map(f => strip(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'))).join('\n');
  const twice = Object.values(LABEL).filter(v => sources.split(v).length - 1 !== 1);
  if (!twice.length) ok('and each is written exactly once in the code — no second caption derivation');
  else bad('a caption is worded more than once: ' + twice.join(', '));

  /* Each type's caption really reaches its own card. */
  const byType = {};
  EDITIONS().filter(anonEdition).forEach(ed => {
    const a = cellFor(ed.id).querySelector('.fe-ticket');
    byType[ed.fairType] = byType[ed.fairType] || [];
    byType[ed.fairType].push(a ? a.textContent.replace(/\s*↗\s*$/, '') : null);
  });
  const rendered = Object.keys(byType).filter(t => byType[t].some(x => x === LABEL[t]));
  if (rendered.length === 3)
    ok('all three captions are publicly reachable, each on its own fair type');
  else bad('a caption is unreachable in the fixtures: ' + JSON.stringify(byType));

  /* NULL → no button and no empty reserved area. */
  const none = EDITIONS().find(ed => anonEdition(ed) && !ed.externalTicketingUrl);
  if (!none) bad('no published edition without a link — the NULL case is unmeasured');
  else {
    const listing = cellFor(none.id).querySelector('.fe-listing');
    const emptyAnchors = [...listing.querySelectorAll('a')].filter(a => !a.textContent.trim());
    if (!listing.querySelector('.fe-ticket') && !emptyAnchors.length)
      ok(none.id + ' carries no link: no button, and no empty element reserving its place');
    else bad(none.id + ' rendered a button or an empty placeholder for a link it does not have');
  }

  /* An unusable value renders nothing either — the write act's own
     question, asked by the same function at the read end. */
  const ed = EDITIONS().find(ed2 => anonEdition(ed2) && ed2.externalTicketingUrl);
  const wasUrl = ed.externalTicketingUrl;
  let rendered2 = [];
  ['javascript:alert(1)', 'data:text/html,x', '/tickets', 'atrium.example/tickets', 'ftp://x.example/t']
    .forEach(u => {
      ed.externalTicketingUrl = u;
      render();
      if (cellFor(ed.id).querySelector('.fe-ticket')) rendered2.push(u);
    });
  ed.externalTicketingUrl = wasUrl;
  render();
  if (!rendered2.length) ok('a non-absolute or non-http(s) value renders no link at all (5 probed)');
  else bad('an unusable URL was rendered: ' + rendered2.join(', '));

  /* Safely opened. */
  const anchors = [...d.querySelectorAll('#gpanel-events .fe-ticket')];
  const unsafe = anchors.filter(a => a.getAttribute('target') !== '_blank' ||
    !/noopener/.test(a.getAttribute('rel') || '') || !/noreferrer/.test(a.getAttribute('rel') || ''));
  if (anchors.length && !unsafe.length)
    ok('all ' + anchors.length + ' ticket links open in a new context with noopener noreferrer');
  else bad(unsafe.length + ' ticket link(s) open without the safe pattern');

  expectRed('a link rendered for an unusable URL', () => {
    const real = w.fairTicketingUrl;
    w.fairTicketingUrl = e => (e && e.externalTicketingUrl) || null;
    const was = ed.externalTicketingUrl;
    ed.externalTicketingUrl = 'javascript:alert(1)';
    try {
      render();
      if (cellFor(ed.id).querySelector('.fe-ticket')) bad('rendered');
    } finally { w.fairTicketingUrl = real; ed.externalTicketingUrl = was; render(); }
  });
  expectRed('an empty reserved area where there is no link', () => {
    const real = w.fairTicketingLinkHtml;
    w.fairTicketingLinkHtml = e => real(e) || '<a class="fe-ticket"></a>';
    try {
      render();
      const listing = cellFor(none.id).querySelector('.fe-listing');
      const emptyAnchors = [...listing.querySelectorAll('a')].filter(a => !a.textContent.trim());
      if (listing.querySelector('.fe-ticket') || emptyAnchors.length) bad('placeholder rendered');
    } finally { w.fairTicketingLinkHtml = real; render(); }
  });
  expectRed('a ticket link opened without the safe pattern', () => {
    const real = w.fairTicketingLinkHtml;
    w.fairTicketingLinkHtml = e => real(e).replace(' rel="noopener noreferrer"', '');
    try {
      render();
      const as = [...d.querySelectorAll('#gpanel-events .fe-ticket')];
      const u = as.filter(a => !/noopener/.test(a.getAttribute('rel') || ''));
      if (u.length) bad('unsafe link');
    } finally { w.fairTicketingLinkHtml = real; render(); }
  });
}

/* ── 11. Derived figures, references, one escaper (DIR-7) ────────── */
console.log('\n── nothing invented, nothing stored, nothing copied');
{
  /* The exhibitor figure follows the participation rows. */
  const ed = EDITIONS().find(e => anonEdition(e) && w.fairEditionExhibitors(e).length);
  const before = w.fairEditionExhibitors(ed).length;
  const shownBefore = /(\d+) exhibitor presence/.exec(cellFor(ed.id).textContent);
  const p = PARTS().find(x => x.editionId === ed.id && anonPart(x));
  p.status = 'withdrawn';
  render();
  const shownAfter = /(\d+) exhibitor presence/.exec(cellFor(ed.id).textContent);
  p.status = 'active';
  render();
  if (shownBefore && Number(shownBefore[1]) === before &&
      (!shownAfter || Number(shownAfter[1]) === before - 1))
    ok('the exhibitor figure is derived: ' + before + ' → ' + (before - 1) + ' when one withdraws');
  else bad('the figure on the fair card does not follow the rows');

  /* Represented wineries are named that, and derived. */
  const dist = PARTS().find(x => anonPart(x) && (x.representing || []).length);
  const repEd = editionOf(dist);
  const repNames = w.fairEditionRepresentedWineries(repEd);
  const cellTxt = cellFor(repEd.id).textContent + cellFor(dist.id).textContent;
  if (repNames.length && /[Rr]epresented wineries/.test(cellTxt) &&
      repNames.every(n => cellTxt.includes(n)))
    ok('represented houses are called "represented wineries" and derived from the rows (FP-2): ' +
       repNames.join(', '));
  else bad('the represented wineries are missing or worded as exhibitors');

  /* No figure the model does not record. */
  const invented = /\b\d+\s*(visitors?|attendees?|guests expected|tickets sold|expected reach)/i.exec(panelText());
  if (!invented) ok('no visitor, attendee, ticket or reach figure anywhere on the directory');
  else bad('an invented figure: "' + invented[0] + '"');

  /* Card content is a REFERENCE: rename the series and the card
     follows; nothing about the fair is written on the card's own row. */
  const series = w.eval('fairSeries')[0];
  const wasName = series.name;
  series.name = 'Renamed Series In Place';
  render();
  const follows = panelText().includes('Renamed Series In Place');
  series.name = wasName;
  render();
  if (follows) ok('the fair cards resolve the series name at render time — a reference, not a copy (FP-3)');
  else bad('the card kept the old series name — copied content');

  /* Typed text reaches the DOM only through the one escaper. */
  const inj = EDITIONS().find(anonEdition);
  const wasDesc = inj.description;
  inj.description = '<img id="dir-injection" src=x onerror="window.__pwn=1">';
  render();
  const escaped = !d.getElementById('dir-injection') &&
    cellFor(inj.id).textContent.includes('<img id="dir-injection"');
  inj.description = wasDesc;
  render();
  if (escaped) ok('markup in a typed field renders as TEXT and creates no element (one escaper)');
  else bad('typed text reached the DOM unescaped');

  expectRed('a stored exhibitor figure', () => {
    const real = w.fairEditionExhibitors;
    const frozen = real(ed);
    w.fairEditionExhibitors = () => frozen;
    const wasS = p.status;
    p.status = 'withdrawn';
    try {
      render();
      const after = /(\d+) exhibitor presence/.exec(cellFor(ed.id).textContent);
      if (after && Number(after[1]) === before) bad('the figure did not follow');
    } finally { w.fairEditionExhibitors = real; p.status = wasS; render(); }
  });
  expectRed('the escaper bypassed', () => {
    const real = w.notifEsc;
    w.notifEsc = v => String(v == null ? '' : v);
    const was = inj.description;
    inj.description = '<img id="dir-injection2" src=x>';
    try {
      render();
      if (d.getElementById('dir-injection2')) bad('element created');
    } finally { w.notifEsc = real; inj.description = was; render(); }
  });
}

/* ── 12. The join note ───────────────────────────────────────────── */
console.log('\n── the join note');
{
  const note = d.querySelector('.events-join-note');
  if (note && note.textContent.includes('Members see more'))
    ok('the join note says in words that members see more');
  else bad('no visible join note — a stranger cannot tell the list is the public subset');
}

/* ── 13. Every deep link that existed still works, plus #events ──── */
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

/* ── O7 changed nothing here, and that is the assurance (A16.14d) ───
   Booth appointments are a private matter between two houses. Whether
   an exhibitor takes requests belongs on that exhibitor's own
   Participation Page and NOWHERE else: not as a fifth card sort, not
   as a fourth family, not as a badge, not as a facet and not as a
   figure — the directory has no number for it, and a filter that
   ranked open appointment doors would turn a business door into a
   discovery signal. */
console.log('\n── the directory is untouched by O7: four sorts, three families, no appointment marker');
{
  const g = boot('#events');
  const gd = g.document;
  const gcells = id => [...gd.querySelectorAll('#' + id + ' > div')];
  const all = gcells('events-upcoming').concat(gcells('events-past'));
  const sorts = [...new Set(all.map(c => c.className.trim().split(/\s+/)[0]))].sort();
  if (sorts.join(',') === 'fe-cell,fp-cell,me-cell,ws-cell')
    ok('still exactly four card sorts in the two grids: ' + sorts.join(' · '));
  else bad('the card sorts moved: ' + sorts.join(', '));

  const body = gd.getElementById('gpanel-events').textContent;
  const html = gd.getElementById('gpanel-events').innerHTML;
  const leaks = [];
  if (/appointment|meeting slot|booth slot/i.test(body)) leaks.push('the word appointment');
  if (/F[TM]-9\d{3}/.test(html))                         leaks.push('a slot or appointment id');
  if (/appt=/.test(html))                                leaks.push('a booking deep link');
  if (!leaks.length) ok('no card, filter, badge or count on the directory mentions an appointment (A16.14d, AP-10)');
  else bad('the directory grew an appointment marker: ' + leaks.join(', '));

  const fams = g.eval('DIRECTORY_FAMILIES');
  if (fams.join('|') === 'Wine Show|Member Event|Fair')
    ok('and the family vocabulary is still the three it has always been: ' + fams.join(' · '));
  else bad('the family vocabulary moved: ' + fams.join(', '));
}

console.log(fail ? '\n' + fail + ' failure(s)' : '\nwine guide: the Events tab answers like every other public surface');
process.exit(fail ? 1 : 0);
