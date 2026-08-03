/* ═══════════════════════════════════════════════════════════════════
   STAKEHOLDERS AND PARTNERSHIPS — A1 and A6, one owner each

   Two tables landed together, for the same reason and against two
   different failures.

   `stakeholders` ends the copies of a house's own profile data. Type,
   avatar, region and public page used to sit in twelve arrays at
   once, and they had drifted: Hawesko GmbH rendered as HW where an
   array carried `avatar` and as HG where wnInitials() computed it,
   on screen at the same time.

   `partnerships` ends the copies of the relation. A6 describes ONE
   record both parties read; the prototype kept four books, and the
   Weinhaus Müller partnership was dated 14 Apr 2026 in one and
   "March 2026" in another.

   Both failures are of the kind that never announces itself. A second
   copy renders perfectly until the day the two disagree, and then it
   still renders perfectly — just differently on two screens. So the
   checks here are mostly NEGATIVE: not "does it render" but "is there
   anywhere left that could answer this question a second time", and
   section 9 puts each copy back to prove the file notices.

   The one positive check that carries weight is coverage: the tables
   introduced a NEW join point, and a name that is not in them renders
   blank. B12 says an action never fails silently, so a miss is a
   console warning in the page and a failure here.
═══════════════════════════════════════════════════════════════════ */
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');
const { loadDashboard } = require('./load-dashboard');
const REPO = path.join(__dirname, '..');

let fail = 0;
const bad = m => { console.log('  ✗ ' + m); fail++; };
const ok  = m => console.log('  ✓ ' + m);

/* Every renderer that asks stakeholder() for something. Driven
   explicitly rather than trusted to have run at load: a lookup that
   is never called cannot miss, and a coverage check over an empty
   set is the emptiest kind of green. */
const RENDERERS = [
  'renderWineryNetwork', 'renderPartnerNetwork',
  'renderRestaurantNetwork', 'renderRetailNetwork',
  'renderIncomingRequests', 'renderIncomingRequestsR', 'renderIncomingRequestsT',
  'renderWineryFans', 'renderDistributorFans', 'renderRestaurantFans', 'renderRetailFans',
  'renderWineryWineStars', 'renderDistributorWineStars',
  'renderRestaurantWineStars', 'renderRetailWineStars',
  'renderDistributorOpportunities', 'renderWinePicker', 'renderWinePickerR', 'renderWinePickerT'
];

/* Builds a page, optionally with the source patched first. Returns
   null if the patch never applied, so a mutation that silently missed
   its target cannot be read as "the check held" — same discipline as
   tests/notifications.js. */
function build(patch) {
  let html = loadDashboard().html;
  if (patch) {
    const before = html;
    html = html.replace(patch.from, patch.to);
    if (html === before) return null;
  }
  const errs = [], warns = [];
  const dom = new JSDOM(html, {
    runScripts: 'dangerously', pretendToBeVisual: true,
    virtualConsole: new VirtualConsole()
      .on('jsdomError', e => errs.push(e.message))
      .on('warn', m => warns.push(String(m)))
  });
  const w = dom.window;
  w.scrollTo = () => {}; w.confirm = () => true;
  if (errs.length) { console.log('SCRIPT ERRORS:\n' + errs.join('\n')); process.exit(1); }
  RENDERERS.forEach(fn => { try { w.eval(fn + '()'); } catch (e) { /* absent view */ } });
  ['winery', 'distributor', 'restaurant', 'retail'].forEach(r => w.eval('notificationsFor("' + r + '")'));
  w.__warns = warns;
  return w;
}

const w = build();
const d = w.document;
console.log('script evaluated cleanly\n');

const TABLE = w.eval('JSON.parse(JSON.stringify(stakeholders))');
const PARTS = w.eval('JSON.parse(JSON.stringify(partnerships))');
const SRC = fs.readFileSync(path.join(REPO, 'bottle-lobby-dashboard.html'), 'utf8');

/* ── 1. The table is a table ────────────────────────────────────── */
console.log('── the master record is well formed');
{
  const names = TABLE.map(s => s.name);
  const dupes = names.filter((n, i) => names.indexOf(n) !== i);
  if (dupes.length) bad('a house appears twice in the master table: ' + [...new Set(dupes)].join(', '));
  else ok(TABLE.length + ' houses, each exactly once');

  const TYPES = ['winery', 'distributor', 'restaurant', 'retail'];
  const wrong = TABLE.filter(s => TYPES.indexOf(s.type) === -1);
  if (wrong.length) bad('houses with a type outside the enum: ' + wrong.map(s => s.name + '=' + s.type).join(', '));
  else ok('every type is one of ' + TYPES.join(' / '));

  /* A11: the individual public profile is the canonical destination
     for every cross-link, so a url in this table has to lead to a
     real page — a dead link here is a dead link on four dashboards. */
  const dead = TABLE.filter(s => s.url && !fs.existsSync(path.join(REPO, s.url)));
  if (dead.length) bad('urls pointing at pages that do not exist: ' + dead.map(s => s.url).join(', '));
  else ok('every public profile url resolves to a file in the repo (A11)');
}

/* ── 2. Coverage — the new join point never misses ──────────────── */
console.log('\n── every name that asks the table is in it (B12)');
{
  const misses = w.eval('Object.keys(stakeholderMisses)');
  if (misses.length) bad('names with no master record, reached by a real renderer: ' + misses.join(', '));
  else ok('all ' + RENDERERS.length + ' renderers and four notification lists resolved every name');

  /* And the check is not vacuous: the renderers really did run. */
  const painted = ['wn-partners-list', 'pn-active-list', 'rpn-active-list', 'tpn-active-list']
    .filter(id => d.getElementById(id) && d.getElementById(id).textContent.trim());
  if (painted.length !== 4) bad('only ' + painted.length + '/4 partner lists rendered — coverage passed by vacuum');
  else ok('all four partner lists actually painted, so the lookups were made');
}

/* ── 3. The two houses that deliberately have no record ─────────── */
console.log('\n── absence is a decision, not an oversight');
{
  /* Restaurant Hafenkante and Vinoteca Alster exist only as names on
     a guest list — no partnership, no follow edge, no public page.
     Inventing profile data for them so that a lookup succeeds would
     be the same A1 violation from the other direction, so the rule is
     that nothing may ASK for them, not that they must be listed. */
  const GUESTS_ONLY = ['Restaurant Hafenkante', 'Vinoteca Alster'];
  const listed = GUESTS_ONLY.filter(n => TABLE.some(s => s.name === n));
  if (listed.length) bad('invented profile data for guest-list-only houses: ' + listed.join(', '));
  else ok('the two guest-list-only houses are absent on purpose');

  const attendees = w.eval('JSON.stringify(wineShows.map(s => (s.attendees||[]).map(a => a.stakeholder)))');
  const present = GUESTS_ONLY.filter(n => attendees.indexOf(n) !== -1);
  if (present.length !== GUESTS_ONLY.length)
    bad('the fixtures no longer contain a guest with no profile — this rule is untested');
  else ok('both are still on a guest list, so the case stays exercised');
}

/* ── 4. Nowhere else may answer these questions ─────────────────── */
console.log('\n── no second copy of a house');
{
  /* Source-level, because a copy that nothing renders today is still
     a copy waiting to drift. The master table itself is cut out
     first, as is the fallback row inside stakeholder(). */
  const start = SRC.indexOf('const stakeholders = [');
  const end = SRC.indexOf('\n];', start);
  const rest = SRC.slice(0, start) + SRC.slice(end)
    .replace(/return \{ name:name,[^\n]*\n/, '');

  const BANNED = ['avatar:', 'location:', 'roleLabel:', 'followerType:', 'followedType:'];
  const found = BANNED.filter(k => rest.indexOf(k) !== -1);
  if (found.length) bad('profile fields living outside the master table: ' + found.join(', '));
  else ok('no array carries avatar, location, roleLabel or a follow type any more');

  /* `region:` also occurs legitimately on a WINE (country/region/
     appellation, A4), so it is only a copy when it sits next to a
     house-shaped key. */
  const houseRegion = rest.split('\n').filter(l =>
    /\bregion:/.test(l) && /\b(winery|partner|follower|distributor|name):\s*'/.test(l));
  if (houseRegion.length) bad('a house region outside the master table: ' + houseRegion[0].trim().slice(0, 80));
  else ok('the only house regions in the file are the master table\'s');
}

/* ── 5. The avatar is data, not a computation ───────────────────── */
console.log('\n── two letters are a choice, not an algorithm');
{
  /* This is the check that stops a future tidy-up from "simplifying"
     the field away. Naive initials are right for most houses and
     wrong for some, and the wrong ones are silent — they just render
     a different badge. */
  const initials = n => n.split(' ').filter(x => /[A-Za-zÀ-ÿ]/.test(x[0]))
    .slice(0, 2).map(x => x[0]).join('').toUpperCase();
  const differ = TABLE.filter(s => initials(s.name) !== s.avatar);
  if (!differ.length)
    bad('every avatar equals its naive initials — nothing would stop someone computing them, and the next house that breaks the rule would render silently wrong');
  else ok('avatars that a computation would get wrong: ' +
          differ.map(s => s.name + ' → ' + s.avatar + ' not ' + initials(s.name)).join(', '));
}

/* ── 6. One partnership, one row ────────────────────────────────── */
console.log('\n── a relation exists once (A6)');
{
  const keys = PARTS.map(p => p.distributor + '↔' + p.partner);
  const dupes = keys.filter((k, i) => keys.indexOf(k) !== i);
  if (dupes.length) bad('the same partnership stored twice: ' + [...new Set(dupes)].join(', '));
  else ok(PARTS.length + ' partnerships, each a single row');

  /* A6: the other three roles partner only with distributors, which
     is why a row may name its two ends rather than an unordered pair. */
  const wrongEnd = PARTS.filter(p => {
    const t = TABLE.find(s => s.name === p.distributor);
    return !t || t.type !== 'distributor';
  });
  if (wrongEnd.length) bad('rows whose distributor end is not a distributor: ' +
    wrongEnd.map(p => p.distributor).join(', '));
  else ok('every row has a distributor on its distributor end (A6, invariant 3)');

  const noDate = PARTS.filter(p => !/^\d{4}-\d{2}-\d{2}$/.test(p.at || ''));
  if (noDate.length) bad('partnerships without an ISO date: ' + noDate.map(p => p.partner).join(', '));
  else ok('one date format, comparable — no display strings left');

  /* Invariant 6: activation is a staff confirmation, so the actor is
     recorded rather than assumed at the notification end (C9). */
  const noActor = PARTS.filter(p => !p.activatedBy);
  if (noActor.length) bad('partnerships with no activating actor: ' + noActor.map(p => p.partner).join(', '));
  else ok('every partnership records who activated it (invariant 6)');
}

/* ── 7. Both ends read the same row ─────────────────────────────── */
console.log('\n── the two sides cannot disagree any more');
{
  /* Read off the RENDERED cards, not the array. The array holding one
     row proves nothing if the two renderers reach it differently, and
     the drift this pass fixed was visible on screen, not in memory. */
  const dateFrom = (listId, name) => {
    const el = d.getElementById(listId);
    if (!el) return null;
    const card = [...el.querySelectorAll('.pn-card, .wn-card')]
      .find(c => (c.querySelector('.pn-name, .wn-name') || {}).textContent === name);
    if (!card) return null;
    const m = /Partner since ([^·]+)/.exec(card.querySelector('.pn-meta, .wn-meta').textContent);
    return m ? m[1].trim() : null;
  };

  /* The three that used to exist twice, plus which list each end
     renders in. */
  const PAIRS = [
    { partner: 'Cantina Rossi',   partnerList: 'wn-partners-list',  distList: 'pn-active-list' },
    { partner: 'Bistro Laurent',  partnerList: 'rpn-active-list',   distList: 'pn-active-list' },
    { partner: 'Weinhaus Müller', partnerList: 'tpn-active-list',   distList: 'pn-active-list' }
  ];
  PAIRS.forEach(p => {
    const mine  = dateFrom(p.partnerList, 'Hawesko GmbH');
    const theirs = dateFrom(p.distList, p.partner);
    if (!mine || !theirs) bad(p.partner + ' ↔ Hawesko is missing from one of the two lists (' +
      JSON.stringify({ mine: mine, theirs: theirs }) + ')');
    else if (mine !== theirs) bad('DRIFT: ' + p.partner + ' reads "' + mine +
      '" while Hawesko reads "' + theirs + '" — two copies again');
    else ok(p.partner + ' ↔ Hawesko: both ends read ' + mine);
  });
}

/* ── 8. Reading the relation from either end ────────────────────── */
console.log('\n── the derivations ask the row, not a role');
{
  if (!w.eval('arePartners("Bistro Laurent","Hawesko GmbH")') ||
      !w.eval('arePartners("Hawesko GmbH","Bistro Laurent")'))
    bad('arePartners() is not symmetric — one end can see a partnership the other cannot');
  else ok('arePartners() answers the same in both directions');

  if (w.eval('arePartners("Bistro Laurent","Cantina Rossi")'))
    bad('a restaurant and a producer count as partners — invariant 3 says that relation does not exist');
  else ok('a restaurant and a producer are not partners (invariant 3)');

  /* "Now has a distributor" is an event, not a counter. Cantina Rossi
     is carried by two houses; gaining the trade happened once, on the
     earlier of the two. */
  const two = PARTS.filter(p => p.partner === 'Cantina Rossi');
  if (two.length < 2)
    bad('no producer with two distributors in the fixtures — the earliest-wins rule is untested');
  else {
    const first = w.eval('JSON.stringify(firstDistributorPartnership("Cantina Rossi"))');
    const earliest = two.slice().sort((a, b) => a.at < b.at ? -1 : 1)[0];
    if (JSON.parse(first).distributor !== earliest.distributor)
      bad('firstDistributorPartnership() returned ' + JSON.parse(first).distributor +
          ', not the earliest (' + earliest.distributor + ' on ' + earliest.at + ')');
    else ok('a producer with two distributors reports the earlier one (' +
            earliest.distributor + ', ' + earliest.at + ')');
  }
}

/* ── 9. B12 — an unknown house is reported, never blank ─────────── */
console.log('\n── a name with no record fails loudly and renders honestly');
{
  const g = build();
  g.eval('wineFollowGraph.push({ follower:"Restaurant Hafenkante", winery:"Cantina Rossi", at:"2026-08-01" })');
  g.eval('renderWineryFans()');
  const cards = [...g.document.getElementById('wfans-list').querySelectorAll('.wn-card')];
  const card = cards[cards.length - 1];

  if (card.querySelector('.wn-name').textContent !== 'Restaurant Hafenkante')
    bad('the unknown house is not named — the one thing actually known was dropped');
  else if (card.querySelector('.wn-avatar').textContent !== '')
    bad('an avatar was invented for a house with no record: "' +
        card.querySelector('.wn-avatar').textContent + '"');
  else if (card.querySelector('a.icon-btn'))
    bad('a profile link was rendered for a house with no public page');
  else ok('name shown, avatar and link absent — nothing guessed');

  if (!g.eval('Object.keys(stakeholderMisses)').length)
    bad('the miss was not recorded — it would render blank and say nothing (B12)');
  else if (!g.__warns.some(m => /no master record for "Restaurant Hafenkante"/.test(m)))
    bad('nothing reached the console — a silent blank card is exactly what B12 forbids');
  else ok('the miss is warned about once, by name');
}

/* ── 10. Counter-check: every copy put back must turn this file red ─
   Five mutations, one per rule above. Each rebuilds the page with the
   old mistake in it and requires the matching section to fail; a
   mutation that does not apply returns null and is reported as a
   miss rather than passing quietly. */
console.log('\n── counter-check: the old mistakes must not be able to return');
{
  const cases = [
    { name: 'stakeholder() invents a row for an unknown house',
      from: "return { name:name, type:null, avatar:'', region:'', city:undefined, url:null, unknown:true };",
      to:   "return { name:name, type:'winery', avatar:'??', region:'Somewhere', city:undefined, url:'bottle-lobby-winery-cantina-rossi.html' };",
      check: g => {
        g.eval('wineFollowGraph.push({ follower:"Restaurant Hafenkante", winery:"Cantina Rossi", at:"2026-08-01" })');
        g.eval('renderWineryFans()');
        const cards = [...g.document.getElementById('wfans-list').querySelectorAll('.wn-card')];
        const c = cards[cards.length - 1];
        return c.querySelector('.wn-avatar').textContent !== '' || !!c.querySelector('a.icon-btn');
      },
      says: 'section 9 catches a guessed avatar or link' },

    /* Patched in My Stars, which is where the old bug actually lived:
       the followed account had no avatar on the edge, so the renderer
       computed one, and Hawesko GmbH came out HG there and HW
       everywhere else. A first version of this mutation patched the
       Fans renderer instead and SURVIVED — every fan in the fixtures
       has initials that happen to match, so the change was real and
       invisible. Recorded here because an unobservable mutation is a
       check that proves nothing. */
    { name: 'the avatar is computed from the name again',
      from: '<div class="pn-avatar ${roleAv[st.type] || \'wn-av-winery\'}" style="${roleAv[st.type] ? \'\' : \'background:var(--wine)\'}">${st.avatar}</div>',
      to:   '<div class="pn-avatar ${roleAv[st.type] || \'wn-av-winery\'}" style="${roleAv[st.type] ? \'\' : \'background:var(--wine)\'}">${f.winery.split(\' \').filter(x=>/[A-Za-zÀ-ÿ]/.test(x[0])).slice(0,2).map(x=>x[0]).join(\'\').toUpperCase()}</div>',
      check: g => {
        g.eval('renderWineryWineStars()');
        const c = [...g.document.getElementById('wstars-list').querySelectorAll('.pn-card')]
          .find(x => x.querySelector('.pn-name').textContent === 'Hawesko GmbH');
        return !c || c.querySelector('.pn-avatar').textContent !== 'HW';
      },
      says: 'the computed badge reads HG where the record says HW — the original drift, exactly' },

    { name: 'the same partnership is stored a second time',
      from: "  { distributor:'Hawesko GmbH', partner:'Bistro Laurent', at:'2026-03-23', activatedBy:'Bottle Lobby' },",
      to:   "  { distributor:'Hawesko GmbH', partner:'Bistro Laurent', at:'2026-09-09', activatedBy:'Bottle Lobby' },\n  { distributor:'Hawesko GmbH', partner:'Bistro Laurent', at:'2026-03-23', activatedBy:'Bottle Lobby' },",
      check: g => {
        const p = g.eval('JSON.parse(JSON.stringify(partnerships))').map(x => x.distributor + '↔' + x.partner);
        return p.filter((k, i) => p.indexOf(k) !== i).length > 0;
      },
      says: 'section 6 catches a duplicated relation' },

    /* Anchored on the retail renderer's own line. The `pn-meta` markup
       is identical in the restaurant renderer, and a patch on that
       text alone hits the FIRST match only — it changed Bistro
       Laurent's card while this check read Weinhaus Müller's, and so
       survived. Two renderers sharing a line is exactly why a
       mutation needs an anchor that names its target. */
    { name: 'the buyer end keeps its own date again',
      from: "    /* The buyer's end of the same row the distributor reads. */\n    const mine = partnershipsOf('Weinhaus Müller');",
      to:   "    const mine = partnershipsOf('Weinhaus Müller').map(function (x) { return Object.assign({}, x, { at:'2026-03-01' }); });",
      check: g => {
        g.eval('renderRetailNetwork()'); g.eval('renderPartnerNetwork()');
        const one = /Partner since ([^·]+)/.exec(
          g.document.getElementById('tpn-active-list').textContent)[1].trim();
        const other = [...g.document.getElementById('pn-active-list').querySelectorAll('.pn-card')]
          .find(c => c.querySelector('.pn-name').textContent === 'Weinhaus Müller');
        return one !== /Partner since ([^·]+)/.exec(other.querySelector('.pn-meta').textContent)[1].trim();
      },
      says: 'section 7 catches the two ends disagreeing' },

    { name: '"now has a distributor" takes the latest partnership',
      from: '    .sort(function (a, b) { return notifTime(a.at) - notifTime(b.at); })[0] || null;',
      to:   '    .sort(function (a, b) { return notifTime(b.at) - notifTime(a.at); })[0] || null;',
      check: g => {
        const first = JSON.parse(g.eval('JSON.stringify(firstDistributorPartnership("Cantina Rossi"))'));
        return first.distributor !== 'Hawesko GmbH';
      },
      says: 'section 8 catches the wrong partnership being called the event' }
  ];

  cases.forEach(c => {
    const g = build({ from: c.from, to: c.to });
    if (!g) bad('MUTATION MISSED ITS TARGET (' + c.name + ') — it proved nothing, and the check it stands for is unverified');
    else if (!c.check(g)) bad('the mutation "' + c.name + '" survived: ' + c.says + ' — but it did not');
    else ok('"' + c.name + '" → ' + c.says);
  });
}

console.log(fail ? '\n✗ ' + fail + ' failure(s)' : '\n✓ all checks passed');
process.exit(fail ? 1 : 0);
