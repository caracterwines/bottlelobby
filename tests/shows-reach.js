/* ═══════════════════════════════════════════════════════════════════
   REACH, THE MEMBER LEVEL AND APPLICATIONS — A16.14, invariants WS-1..5
   -------------------------------------------------------------------
   The thing being measured here is an ABSENCE, and an absence is the
   easiest thing in the world to assert wrongly: a check that looks for
   a title in a pane that was never rendered passes for the wrong
   reason and goes on passing after the rule is deleted. So every
   invariant below is measured twice —

     · the CLAIM: the rule holds on the rendered surface;
     · the COUNTER-MUTATION: the state or the function is changed so
       that the rule is broken, the same check runs again, and it MUST
       come back red. A check that stays green under its own counter-
       mutation is reported as a failure of the check, not of the code.

   That is C7's lesson from the A16.6 pass, applied from the start:
   guards that actually look. Nothing here reads a private array and
   calls it a surface; the claims are made against rendered HTML, and
   the derivation is only asked where the question genuinely has no
   pixels — "would this viewer find it", for a viewer with no dashboard
   of their own.

   Not covered here, deliberately: WS-6 (the stored release row) and
   WS-7 (material change) belong to the Final Review pass, which has
   not been built.
═══════════════════════════════════════════════════════════════════ */
const path = require('path');
const { loadDashboard } = require('./load-dashboard');
const { JSDOM, VirtualConsole } = require('jsdom');

function boot(file) {
  const errs = [];
  const dom = new JSDOM(loadDashboard(file).html, {
    runScripts: 'dangerously', pretendToBeVisual: true,
    virtualConsole: new VirtualConsole().on('jsdomError', e => errs.push(e.message))
  });
  if (errs.length) { console.log('SCRIPT ERRORS in ' + (file || 'dashboard') + ':\n' + errs.join('\n')); process.exit(1); }
  const w = dom.window;
  w.scrollTo = () => {};
  w.confirm = () => true;
  w.prompt = () => 'The line-up is full for Sicilian reds this time.';
  return w;
}

const DASH = path.join(__dirname, '..', 'bottle-lobby-dashboard.html');
const PAGE = path.join(__dirname, '..', 'bottle-lobby-wine-shows.html');
const w = boot(DASH), d = w.document;
console.log('dashboard evaluated cleanly\n');

let fail = 0;
const bad = m => { console.log('  ✗ ' + m); fail++; };
const ok  = m => console.log('  ✓ ' + m);

const S  = id => w.eval('wineShows').find(x => x.id === id);
const V  = (entity, role) => w.showViewer(entity, role);
const ANON = w.eval('SHOW_ANON');
const LEVELS = w.eval('REACH_LEVELS');

/* Runs `fn` with the show's reach temporarily set, then puts it back —
   so a mutation in one section can never be the reason another one
   passes. */
function withReach(id, reach, fn) {
  const s = S(id), before = s.reach;
  s.reach = reach;
  try { return fn(); } finally { s.reach = before; }
}

/* The whole point of the counter-mutation: run THE ORIGINAL CLAIM
   against a state in which it is false, and require it to complain.
   The body is therefore always the claim itself, never its negation —
   getting that backwards writes a check that passes because it is
   asking the wrong question, which is the exact failure this helper
   exists to catch. It caught it here first, on its own first run.

   Failures raised inside are the point, so they are swallowed; what is
   reported is whether any were raised at all. */
function expectRed(label, check) {
  const before = fail;
  const noise = [];
  const realLog = console.log;
  console.log = m => noise.push(m);
  try { check(); } finally { console.log = realLog; }
  const raised = fail - before;
  fail = before;                       /* the failures were the point */
  if (raised) ok('counter-mutation: ' + label + ' — the check goes red (' + raised + ')');
  else bad('COUNTER-MUTATION STAYED GREEN: ' + label + ' — this check cannot fail and proves nothing');
}

/* Everything a role's Wine Shows pane actually renders, as text. This
   is the surface WS-4 is about: no card, no title, no count. */
function paneText(role, tab) {
  w.showWineShows(role, tab);
  return d.getElementById(w.eval('SHOW_ROLES')[role].prefix + '-list-pane').textContent;
}
function discoverTitles(role) {
  w.showWineShows(role, 'discover');
  const p = w.eval('SHOW_ROLES')[role].prefix;
  return [...d.querySelectorAll('#' + p + '-table .ws-public-title')].map(e => e.textContent);
}

/* ══════════════════════════════════════════════════════════════════
   THE DELIVERY CASE — WS-2604 exactly as it ships
   ------------------------------------------------------------------
   reach ['wineries','partners']. The measured consequence is the whole
   reason this fixture is worth having: Hawesko's active partners
   INCLUDE Bistro Laurent, Weinhaus Müller and Vinstuen København, so
   "restricted to wineries and partners" is not the same sentence as
   "hidden from the demand side". It is hidden from an UNPARTNERED
   restaurant or retailer, and from the open web.
══════════════════════════════════════════════════════════════════ */
console.log('── WS-2604 as delivered: a restricted open call');
{
  const s = S('WS-2604');
  if (s.stage !== 'planning') bad('WS-2604 must ship in planning — recruiting happens there (D38)');
  else ok('ships in planning, where recruiting happens');
  if (JSON.stringify(w.showReach(s)) !== JSON.stringify(['wineries','partners']))
    bad('reach should be wineries+partners, is ' + JSON.stringify(s.reach));
  else ok("reach names wineries and the host's partners");
  if (!s.applications_open || !s.application_deadline)
    bad('the open call needs applications_open and a deadline');
  else ok('open for applications until ' + s.application_deadline);
  if (w.confirmedExhibitors(s).length !== 0)
    bad('the D38 fixture is the one that recruits from zero — it must have no confirmed exhibitor');
  else ok('zero confirmed exhibitors, which is the state D38 exists for');

  /* Who finds it, asked of the derivation — including two houses that
     have no dashboard in this prototype and can therefore only be
     asked this way. Both are real stakeholders, neither is a Hawesko
     partner. */
  const cases = [
    ['Cantina Rossi',      'winery',     true,  "a winery — 'wineries'"],
    ['Bodegas Ruiz',       'winery',     true,  "another winery, partnered too — seen once, not twice"],
    ['Bistro Laurent',     'restaurant', true,  "a restaurant with an active Hawesko partnership — 'partners'"],
    ['Weinhaus Müller',    'retail',     true,  "a retailer with an active Hawesko partnership — 'partners'"],
    ['Vinstuen København', 'retail',     true,  'the third partnered buyer'],
    ['Osteria Marconi',    'restaurant', false, 'a restaurant with NO Hawesko partnership'],
    ['Vinoteca Roma',      'retail',     false, 'a retailer with NO Hawesko partnership'],
    ['Hawesko GmbH',       'distributor',true,  'the host, whatever the reach says (WS-2)']
  ];
  for (const [who, role, want, why] of cases) {
    const got = w.showVisibleTo(s, V(who, role));
    if (got !== want) bad('WS-2604 · ' + who + ' (' + role + '): expected ' + want + ', got ' + got + ' — ' + why);
    else ok((want ? 'finds it: ' : 'cannot find it: ') + who + ' — ' + why);
  }
  if (w.showVisibleTo(s, ANON)) bad('an anonymous visitor must not find a wineries+partners show');
  else ok('anonymous: cannot find it');
}

console.log('\n── the same answer on the rendered Discover lists');
{
  for (const [role, why] of [['winery', "'wineries'"], ['restaurant', "'partners'"], ['retail', "'partners'"]]) {
    const titles = discoverTitles(role);
    if (!titles.includes('Sicilia Prima')) bad(role + ": Discover omits Sicilia Prima, which " + why + ' admits');
    else ok(role + ': Sicilia Prima is on Discover via ' + why);
  }
  /* THE UNPARTNERED BUYER, BUILT HERE. The prototype's restaurant and
     retail dashboards are both Hawesko partners, so the fixtures give
     no unpartnered reader with a rendered surface. Taking the
     partnership row out is the honest way to get one: it changes the
     one fact the rule turns on and nothing else. */
  const book = w.eval('partnerships');
  const idx  = book.findIndex(p => p.partner === 'Bistro Laurent' && p.distributor === 'Hawesko GmbH');
  if (idx === -1) bad('the Bistro Laurent ↔ Hawesko partnership is gone — this section cannot be built');
  else {
    const row = book.splice(idx, 1)[0];
    const text = paneText('restaurant', 'discover');
    if (text.includes('Sicilia Prima'))
      bad('an unpartnered restaurant still finds a wineries+partners show');
    else ok('partnership removed → the same restaurant no longer finds it, on the rendered pane');
    book.splice(idx, 0, row);
    if (!discoverTitles('restaurant').includes('Sicilia Prima'))
      bad('restoring the partnership did not restore the visibility — the harness has leaked state');
    else ok('partnership restored → visible again, so the section left nothing behind');
  }
}

/* ══════════════════════════════════════════════════════════════════
   WS-1 — reach never names an unconfirmed producer or applicant
   Measured on the rendered card, AT EVERY REACH LEVEL.
══════════════════════════════════════════════════════════════════ */
console.log('\n── WS-1: no name before published, at any reach level');
{
  const s = S('WS-2604');
  /* Three producers in three states, built here so the rule is tested
     against all of them rather than against whichever the fixtures
     happen to hold. */
  s.exhibitors.push(
    { producer:'Weingut Schmitt',  status:'confirmed', source:'invitation',
      products:[{ productId:'PRD-1019', proposedBy:'host', status:'confirmed' }] },
    { producer:'Domaine Lefèvre',  status:'invited',   source:'invitation', products:[] },
    { producer:'Bodegas Ruiz',     status:'applied',   source:'open_call',
      products:[{ productId:'PRD-1016', proposedBy:'producer', status:'proposed' }] });
  const NAMES = ['Weingut Schmitt', 'Domaine Lefèvre', 'Bodegas Ruiz'];

  const checkNoNames = () => {
    for (const level of LEVELS) {
      withReach('WS-2604', [level], () => {
        for (const viewer of [ANON, V('Cantina Rossi','winery'), V('Bistro Laurent','restaurant')]) {
          const lvl  = w.publicLevelFor(s, viewer);
          const html = w.publicShowTeaser(s, lvl) + w.publicShowCard(s, lvl);
          const leaked = NAMES.filter(n => html.includes(n));
          if (leaked.length)
            bad('reach ' + level + ', ' + (viewer.role || 'stranger') + ' (' + lvl + '): named ' + leaked.join(', '));
        }
      });
    }
  };
  checkNoNames();
  if (!fail) ok('all ' + LEVELS.length + ' reach levels × 3 readers: not one of the three producers named');

  /* And the member level really is doing more than the stranger's —
     otherwise "no names" would be trivially true because nothing is
     rendered at all. */
  withReach('WS-2604', ['members'], () => {
    const mem = w.publicShowCard(s, w.publicLevelFor(s, V('Cantina Rossi','winery')));
    if (!mem.includes('Exhibitors confirmed')) bad('the member card shows no confirmed-exhibitor count');
    else if (!/Exhibitors confirmed<\/b> · 1/.test(mem)) bad('the member card miscounts confirmed exhibitors');
    else ok('the member card gives the COUNT (1) while naming nobody');
    if (mem.includes('Bistro Laurent'))
      bad('the member card names the venue that has only been asked');
    else ok('venue status without the place — it has only been requested');
  });

  /* COUNTER-MUTATION: the same check against the FULL level. A
     published show names its confirmed exhibitors, so if the check
     cannot see a name there, it could never have seen one anywhere. */
  expectRed('the same "names nobody" check, run against the FULL card', () => {
    const html = w.publicShowCard(s, 'full');
    const leaked = NAMES.filter(n => html.includes(n));
    if (leaked.length) bad('named ' + leaked.join(', '));
  });

  /* Put the show back exactly as it shipped. */
  s.exhibitors.length = 0;
}

/* ══════════════════════════════════════════════════════════════════
   WS-2 — reach never excludes the host or a confirmed participant
══════════════════════════════════════════════════════════════════ */
console.log('\n── WS-2: no setting locks a host out of his own show');
{
  const s = S('WS-2604');
  s.exhibitors.push({ producer:'Weingut Schmitt', status:'confirmed', source:'invitation',
                      products:[{ productId:'PRD-1019', proposedBy:'host', status:'confirmed' }] });
  s.attendees.push({ stakeholder:'Vinstuen København', source:'invitation', status:'confirmed', at:'2026-08-01' });

  /* The harshest setting there is: nobody. */
  withReach('WS-2604', [], () => {
    const must = [
      ['Hawesko GmbH',       'distributor', 'the host'],
      ['Weingut Schmitt',    'winery',      'a confirmed exhibitor'],
      ['Vinstuen København', 'retail',      'a confirmed attendee']
    ];
    for (const [who, role, what] of must) {
      if (!w.showVisibleTo(s, V(who, role))) bad('reach [] hid the show from ' + what + ' (' + who + ')');
      else ok('reach [] — ' + what + ' still finds it');
    }
    if (w.showVisibleTo(s, V('Cantina Rossi','winery')))
      bad('reach [] must hide the show from everybody else');
    else ok('reach [] — an outsider finds nothing, so the yes above came from the relation');

    /* COUNTER-MUTATION: take the relation away and the same three
       questions must answer no. If they still answered yes, the check
       above would have been measuring a blanket permission. */
    expectRed('remove the confirmed exhibitor and the attendee', () => {
      const exh = s.exhibitors.pop(), att = s.attendees.pop();
      try {
        if (!w.showVisibleTo(s, V('Weingut Schmitt','winery'))) bad('exhibitor no longer finds it');
        if (!w.showVisibleTo(s, V('Vinstuen København','retail'))) bad('attendee no longer finds it');
      } finally { s.exhibitors.push(exh); s.attendees.push(att); }
    });
  });
  s.exhibitors.length = 0;
  s.attendees.length = 0;
}

/* ══════════════════════════════════════════════════════════════════
   WS-3 — reach is meaningless from `published`
   Measured on the real public page, in both directions.
══════════════════════════════════════════════════════════════════ */
console.log('\n── WS-3 (a): before published, the public page follows reach');
const p = boot(PAGE);
const pd = p.document;
const pageText = () => {
  const body = pd.body.cloneNode(true);
  [...body.querySelectorAll('script')].forEach(n => n.remove());
  return body.textContent;
};
const remount = () => {
  p.eval("mountShowCards(document.getElementById('ups-upcoming'), publicShows(wineShows, false));" +
         "mountShowCards(document.getElementById('ups-past'), publicShows(wineShows, true));");
};
{
  const txt = pageText();
  if (!txt.includes('Grande Rioja'))
    bad("WS-2601 has reach ['public'] and must be on the public page");
  else ok('WS-2601 (planning, public) is on the page');
  /* And anonymised: present as a title, naming nobody. */
  const rioja = [...pd.querySelectorAll('.ws-cell')]
    .find(c => (c.querySelector('.ws-public-title') || {}).textContent === 'Grande Rioja');
  const named = p.eval("wineShows.find(s => s.id === 'WS-2601').exhibitors.map(e => e.producer)")
    .filter(n => rioja.innerHTML.includes(n));
  if (named.length) bad('WS-2601 names ' + named.join(', ') + ' on the public page');
  else ok('WS-2601 is present and anonymised — a title, and not one producer');

  /* WS-4 measured here too: absent means ABSENT. */
  if (txt.includes('Sicilia Prima'))
    bad('WS-2604 (wineries+partners) left a trace on the anonymous public page');
  else ok('WS-2604 is absent from the public page — no card, no title, no count');

  /* COUNTER-MUTATION: give it 'public' and it must appear. Absence
     that survives the permission was never caused by the permission. */
  expectRed("the same absence check, after giving WS-2604 reach ['public']", () => {
    const s = p.eval("wineShows.find(x => x.id === 'WS-2604')");
    const before = s.reach;
    s.reach = ['public'];
    remount();
    try { if (pageText().includes('Sicilia Prima')) bad('it is on the page'); }
    finally { s.reach = before; remount(); }
  });
}

console.log('\n── WS-3 (b): from published, no reach gates the public route');
{
  const s = p.eval("wineShows.find(x => x.id === 'WS-2603')");   /* published */
  for (const reach of [[], ['wineries'], ['partners'], ['community']]) {
    const before = s.reach;
    s.reach = reach;
    remount();
    const on = pageText().includes('Loire & Mosel');
    s.reach = before; remount();
    if (!on) bad('a published show vanished from the public route under reach ' + JSON.stringify(reach));
    else ok('published + reach ' + JSON.stringify(reach) + ' → still on the open website');
  }

  /* COUNTER-MUTATION, and this is the one the invariant exists for:
     make the derivation gate published shows by reach, exactly as a
     future "tidy-up" might. The check above must go red. */
  expectRed('gate published shows by reach after all', () => {
    const real = p.showVisibleTo;
    p.showVisibleTo = function (show, viewer) {
      viewer = viewer || p.eval('SHOW_ANON');
      if (!p.showListable(show)) return false;
      return p.showReach(show).some(l => p.reachAdmits(show.leadHost, l, viewer));   /* the WS-3 branch removed */
    };
    const before = s.reach;
    s.reach = ['wineries'];
    remount();
    try { if (!pageText().includes('Loire & Mosel')) bad('placeholder'); }
    finally { p.showVisibleTo = real; s.reach = before; remount(); }
  });
  if (!pageText().includes('Loire & Mosel'))
    bad('the counter-mutation was not undone — the page is still gated');
  else ok('the real derivation is back and the published show is on the page');
}

/* ══════════════════════════════════════════════════════════════════
   WS-4 — an excluded show is absent. No card, no title, no count.
   A pure reach:['wineries'] case, built here.
══════════════════════════════════════════════════════════════════ */
console.log("\n── WS-4: a pure reach:['wineries'] show, for restaurant and retail");
{
  const s = S('WS-2601');            /* planning, and normally ['public'] */
  const before = s.reach;
  s.reach = ['wineries'];

  for (const role of ['restaurant', 'retail']) {
    /* Every tab of the pane, not only Discover: a title surfacing in
       the tab counts, the KPI strip or the browsing list is the same
       leak one box further along. */
    const seen = ['current', 'discover', 'history']
      .filter(t => paneText(role, t).includes('Grande Rioja'));
    if (seen.length) bad(role + ': Grande Rioja is visible on the ' + seen.join(', ') + ' tab(s)');
    else ok(role + ': Grande Rioja is absent from every tab — no card, no title, no count');
  }
  /* The count on the Discover tab must have moved with it, or the
     absence is only in the list and the number still announces it. */
  w.showWineShows('restaurant', 'discover');
  const tab = [...d.querySelectorAll('#rshow-tabs .ord-tab')].find(b => b.textContent.startsWith('Discover'));
  const n = Number((tab.textContent.match(/\((\d+)\)/) || [])[1]);
  /* Discover holds TWO card sorts since A16.8 — Wine Shows and member
     events — so the count is over both. What WS-4 is about is unchanged
     and is the reason this assertion is derived rather than typed: the
     number must count what is on the pane, never what was excluded from
     it. A hardcoded total would have gone on passing while an excluded
     show was still being announced by the tab. */
  const want = w.eval("discoverShows('restaurant')").length +
               w.eval("discoverEvents('restaurant')").length;
  if (n !== want) bad('the Discover tab count says ' + n + ', the two lists hold ' + want);
  else ok('the tab count (' + n + ') counts both sorts, and not what was excluded');

  /* And the winery, whom this reach DOES name, still finds it — so the
     absence above is the reach and not a broken renderer. */
  if (!discoverTitles('winery').includes('Grande Rioja'))
    bad("reach ['wineries'] hid the show from a winery too — that is a broken list, not a rule");
  else ok('a winery still finds it, so the absence is the reach and nothing else');

  /* COUNTER-MUTATION: name the restaurants and it must come back. */
  expectRed("the same absence check, after reach ['restaurants']", () => {
    s.reach = ['restaurants'];
    try { if (paneText('restaurant', 'discover').includes('Grande Rioja')) bad('it is on the pane'); }
    finally { s.reach = ['wineries']; }
  });

  s.reach = before;
}

/* ══════════════════════════════════════════════════════════════════
   WS-5 — an application creates no confirmation, no participation,
   no order. Driven through the real buttons.
══════════════════════════════════════════════════════════════════ */
console.log('\n── WS-5: applying creates nothing');
{
  const s = S('WS-2604');
  const snap = () => ({
    confirmed: w.confirmedExhibitors(s).length,
    attendees: (s.attendees || []).length,
    free:      w.showFreePlaces(s),
    wines:     w.showProductCount(s),
    orders:    w.eval('orders').length
  });
  const before = snap();

  w.showWineShows('winery', 'discover');
  w.openShowDetail('WS-2604');
  w.openApplyModal('WS-2604');
  const sel = d.getElementById('ap-product');
  const own = [...sel.options].find(o => o.value);      /* the first real wine of Cantina Rossi */
  if (!own) bad('the application picker offered none of the applicant\'s own wines');
  sel.value = own.value;
  w.saveApplication();

  const me = s.exhibitors.find(e => e.producer === 'Cantina Rossi');
  if (!me) bad('the application wrote no exhibitors row');
  else if (me.status !== 'applied') bad("the row should be status 'applied', is '" + me.status + "'");
  else if (me.source !== 'open_call') bad("the row should carry source 'open_call', has '" + me.source + "'");
  else ok("an exhibitors row, status 'applied', source 'open_call'");
  if (me && me.products[0] && !/^PRD-\d{4}$/.test(me.products[0].productId))
    bad('the wine is not a product key — a typed name is a harness failure (A15.2a)');
  else ok('the wine is named by product key, and it is the applicant\'s own');

  const after = snap();
  for (const k of Object.keys(before)) {
    if (before[k] !== after[k]) bad('applying changed ' + k + ': ' + before[k] + ' → ' + after[k] + ' (WS-5)');
  }
  ok('no confirmation, no seat, no place taken, no wine counted, no order');

  /* The applicant is told, and told the truth. */
  w.openShowDetail('WS-2604');
  const mine = d.getElementById('wshow-detail-pane').textContent;
  if (!/Applied, Waiting for the Host/.test(mine)) bad('the applicant is not told they are waiting');
  else ok('the applicant reads "applied, waiting for the host"');
  if (/Weingut Schmitt|Bodegas Ruiz/.test(mine))
    bad('an applicant was shown the working line-up');
  else ok('an applicant sees their own application, not the line-up');

  /* COUNTER-MUTATION: if the check could not see a confirmation
     arriving, it would pass for a build that confirms on apply. */
  expectRed('confirm the row by hand and the counts must move', () => {
    me.status = 'confirmed';
    try {
      const x = snap();
      for (const k of Object.keys(before)) if (before[k] !== x[k]) bad('placeholder');
    } finally { me.status = 'applied'; }
  });

  /* ── the host answers ── */
  w.showWineShows('distributor', 'current');
  w.openShowDetail('WS-2604');
  const hostPane = d.getElementById('dshow-detail-pane').textContent;
  if (!/Applications/.test(hostPane) || !hostPane.includes('Cantina Rossi'))
    bad('the host is not shown the application as a task');
  else ok('the host sees it as a task, with the applicant named (A16.6: his view and theirs)');

  w.hostRespondToApplication('WS-2604', 'Cantina Rossi', 'accept');
  const acc = s.exhibitors.find(e => e.producer === 'Cantina Rossi');
  if (acc.status !== 'confirmed') bad("accepting should make an ordinary A16.4 exhibitor, status is '" + acc.status + "'");
  else ok('accepted → an ordinary confirmed exhibitor (A16.4 unchanged)');
  if (w.confirmedExhibitors(s).length !== before.confirmed + 1)
    bad('the confirmed count did not move on acceptance');
  else ok('the confirmed count moves on acceptance, and only then');
  if (acc.products[0].status !== 'proposed')
    bad('accepting the application also confirmed the wine — the host still has to agree it (D23)');
  else ok('the wine stays a proposal: accepting the house is not agreeing the bottle');

  /* ── and the decline path keeps the row ── */
  acc.status = 'applied'; delete acc.declineReason;
  w.hostRespondToApplication('WS-2604', 'Cantina Rossi', 'decline');
  const dec = s.exhibitors.find(e => e.producer === 'Cantina Rossi');
  if (!dec) bad('declining deleted the row — a decline is a resting state, not a deletion (D29)');
  else if (dec.status !== 'declined') bad("the row should be 'declined', is '" + dec.status + "'");
  else if (!dec.declineReason) bad('the decline kept no reason');
  else ok('declined with a reason, and the row survives (D29)');

  s.exhibitors.length = 0;
}

/* ══════════════════════════════════════════════════════════════════
   THE TAXONOMY ITSELF — one list, and the locked value is on screen
══════════════════════════════════════════════════════════════════ */
console.log('\n── the taxonomy is defined once and reads as a multi-select');
{
  if (JSON.stringify(LEVELS) !== JSON.stringify(
      ['public','members','wineries','distributors','restaurants','retail','partners','community']))
    bad('the reach taxonomy has drifted from A16.14b: ' + JSON.stringify(LEVELS));
  else ok('the eight levels of A16.14b, in order');
  if (LEVELS.includes('network')) bad("'network' is not a reach level — it names a nav section (D39)");
  else ok("'network' is absent, as D39 requires");
  if (LEVELS.includes('matchmaking')) bad("'matchmaking' must not be a value until A8 exists (C2)");
  else ok("'matchmaking' is not a value");

  /* But it IS on screen, locked, with its reason. */
  w.showWineShows('distributor', 'current');
  w.openShowDetail('WS-2604');
  w.openReachModal('WS-2604');
  const locked = d.getElementById('rf-locked');
  if (!locked.textContent.includes('Matchmaking')) bad('matchmaking is not shown in the reach editor');
  else if (!locked.querySelector('input[disabled]')) bad('matchmaking is shown but not locked');
  else if (locked.textContent.length < 60) bad('matchmaking is locked without a reason on screen');
  else ok('matchmaking: shown, locked, with its reason on the row (C2)');

  const boxes = [...d.querySelectorAll('#rf-levels input')];
  if (boxes.length !== LEVELS.length) bad('the editor offers ' + boxes.length + ' of ' + LEVELS.length + ' levels');
  else ok('every level is offered, as checkboxes — a multi-select, not a ladder');

  /* Saving deduplicates and permits; it never forbids. */
  boxes.forEach(b => { b.checked = ['wineries','partners','wineries'].includes(b.value); });
  w.saveReach();
  const saved = S('WS-2604').reach;
  if (new Set(saved).size !== saved.length) bad('the saved reach holds a duplicate: ' + JSON.stringify(saved));
  else ok('saved deduplicated: ' + JSON.stringify(saved));
  w.closeReachModal();
}

console.log(fail ? `\n✗ ${fail} failure(s)` : '\n✓ WS-1..WS-5 hold, and every check goes red under its own counter-mutation');
process.exit(fail ? 1 : 0);
