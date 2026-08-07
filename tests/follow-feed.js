/* The follow graph as an announcement channel (A16.7).
   ------------------------------------------------------------------
   The feed is the THIRD public surface for a show, after the Wine
   Shows page and the participants' profiles. A16.6 holds across
   surfaces or it holds nowhere, so the question this file asks is not
   "does the widget render" but:

     · does the feed ever say more than the profiles do?

   The concrete trap: several accounts follow producers who are
   confirmed at a show that is still anonymised. A feed built from
   "shows my stars take part in" rather than from publicParticipation()
   would announce them, and the anonymisation on the other two surfaces
   would be worth nothing. */
const path = require('path');
const { loadDashboard } = require('./load-dashboard');
const { JSDOM, VirtualConsole } = require('jsdom');

const errs = [];
const dom = new JSDOM(loadDashboard().html, {
  runScripts: 'dangerously', pretendToBeVisual: true,
  virtualConsole: new VirtualConsole().on('jsdomError', e => errs.push(e.message)) });
const w = dom.window, d = w.document;
w.scrollTo = () => {};
w.confirm = () => true;
if (errs.length) { console.log('SCRIPT ERRORS:\n' + errs.join('\n')); process.exit(1); }
console.log('script evaluated cleanly\n');

let fail = 0;
const bad = m => { console.log('  ✗ ' + m); fail++; };
const ok  = m => console.log('  ✓ ' + m);

const SHOWS = w.eval('wineShows');
const GRAPH = w.eval('wineFollowGraph');
const ROLES = [
  { entity: 'Cantina Rossi',  el: 'wfeed-widget' },
  { entity: 'Hawesko GmbH',   el: 'dfeed-widget' },
  { entity: 'Bistro Laurent', el: 'rfeed-widget' },
  { entity: 'Weinhaus Müller', el: 'tfeed-widget' }
];

/* Derived here, independently of the implementation. */
function stars(entity) {
  return [...new Set(GRAPH.filter(f => f.follower === entity).map(f => f.winery))];
}
/* SORTED BY DATE, because the feed is — and the window below is only
   meaningful against the real order. Reading the fixtures in array
   order was a hidden assumption that array order IS render order; it
   held only while the one show declared first happened to be excluded
   anyway. WS-2604 moving into `planning` (D38) put the LAST show by
   date at the FRONT of the array and the assumption fell over. Deriving
   the order here rather than borrowing it keeps this file independent
   of the implementation, which is the whole point of it. */
function shouldAnnounce(entity) {
  const out = [];
  for (const s of SHOWS) {
    if (!['planning', 'published'].includes(s.stage)) continue;
    for (const who of stars(entity)) {
      if (s.leadHost === who) { out.push({ who, title: s.title, date: s.date, role: 'host' }); continue; }
      if (s.stage !== 'published') continue;
      if (s.exhibitors.some(e => e.status === 'confirmed' && e.producer === who))
        out.push({ who, title: s.title, date: s.date, role: 'exhibitor' });
    }
  }
  return out.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
}

console.log('── every role has a feed');
for (const r of ROLES) {
  if (!d.getElementById(r.el)) bad(r.entity + ': no feed widget (' + r.el + ')');
}
if (!fail) ok('all four overviews carry one, including Restaurant and Retail');

console.log('\n── the feed says exactly what it may');
for (const r of ROLES) {
  const el = d.getElementById(r.el);
  if (!el) continue;
  const html = el.innerHTML;
  const want = shouldAnnounce(r.entity);

  const rows = [...el.querySelectorAll('.list-item-title')].map(x => x.textContent);
  const missing = want.filter(x => !rows.some(t => t.includes(x.who) && t.includes(x.title)));
  /* Only the first three are rendered; a missing one is a failure only
     if it should have been in that window. */
  const shown = want.slice(0, 3);
  const reallyMissing = missing.filter(x => shown.includes(x));
  if (reallyMissing.length)
    bad(r.entity + ': feed omits ' + reallyMissing.map(x => x.who + '/' + x.title).join(', '));

  /* THE assertion: nothing about an anonymised show's exhibitors. */
  for (const s of SHOWS) {
    if (s.stage !== 'planning') continue;
    for (const e of s.exhibitors) {
      /* The show's title may appear — its HOST is announceable. The
         exhibitor's name next to it is what must never happen. */
      const rowWithExhibitor = rows.find(t => t.includes(e.producer) && t.includes(s.title));
      if (rowWithExhibitor)
        bad(r.entity + ': feed announces ' + e.producer + ' at the anonymised "' + s.title + '"');
      /* Resolved from the KEY. This read `p.name` until 5 Aug 2026 —
         a field pass 3b removed — so it tested `html.includes(undefined)`,
         which is false for every page ever rendered. The leak guard had
         been reporting success without looking. */
      for (const p of e.products) {
        const label = w.eval('wineName(' + JSON.stringify(p.productId) + ')');
        if (!label) bad('a show product resolves to no name — the leak check cannot look for anything');
        else if (html.includes(label))
          bad(r.entity + ': feed names the wine ' + label + ' from an anonymised show');
      }
    }
  }

  /* Nothing that is not public at all. */
  for (const s of SHOWS) {
    if (['planning', 'published', 'completed'].includes(s.stage)) continue;
    if (html.includes(s.title)) bad(r.entity + ': feed announces "' + s.title + '" (' + s.stage + ')');
  }

  const n = want.length;
  ok(r.entity.padEnd(16) + (n ? n + ' announcement(s): ' +
      want.slice(0, 3).map(x => x.who + ' → ' + x.title).join('; ') : 'empty state'));
  if (!n && !html.includes('No upcoming appearances'))
    bad(r.entity + ': nothing to announce and no empty state');
}

/* ── The fixtures have to contain the trap ───────────────────────── */
console.log('\n── the fixtures exercise the rule');
{
  const hidden = [];
  for (const s of SHOWS) {
    if (s.stage !== 'planning') continue;
    for (const e of s.exhibitors.filter(x => x.status === 'confirmed'))
      for (const r of ROLES)
        if (stars(r.entity).includes(e.producer)) hidden.push(r.entity + ' → ' + e.producer);
  }
  /* This pair is the whole test. Without it every assertion above
     passes vacuously: there is simply nothing the feed could have
     leaked, and a green run would mean the rule is untested rather
     than upheld. The fixture is documented in wineFollowGraph. */
  if (hidden.length) ok('followed-but-anonymised pairs present: ' + hidden.join(', '));
  else bad('no role follows a producer confirmed at an anonymised show — ' +
           'the leak this file exists to catch cannot occur, so the run proves nothing');

  const withFeed = ROLES.filter(r => shouldAnnounce(r.entity).length);
  const without = ROLES.filter(r => !shouldAnnounce(r.entity).length);
  if (!withFeed.length) bad('no role has a single announcement — the renderer is untested');
  else ok(withFeed.length + ' role(s) with announcements');
  if (!without.length) console.log('    note: every role has announcements, so the empty state is untested here');
  else ok(without.length + ' role(s) on the empty state');

  const roles = new Set(ROLES.flatMap(r => shouldAnnounce(r.entity).map(x => x.role)));
  if (!roles.has('host')) bad('no "is hosting" announcement in the fixtures');
  if (!roles.has('exhibitor')) bad('no "is exhibiting at" announcement in the fixtures');
  if (roles.has('host') && roles.has('exhibitor')) ok('both wordings occur');
}

/* ── A release must reach the feed ───────────────────────────────── */
/* The channel is only a channel if it updates. Releasing the pending
   show must make it announceable to everyone following its host. */
console.log('\n── releasing a show reaches the followers');
{
  const pending = SHOWS.find(s => s.stage === 'pending_approval');
  if (!pending) bad('no pending_approval show to release');
  else {
    const followers = ROLES.filter(r => stars(r.entity).includes(pending.leadHost));
    if (!followers.length) bad('nobody follows ' + pending.leadHost + ' — the path is untested');

    for (const r of followers)
      if (d.getElementById(r.el).innerHTML.includes(pending.title))
        bad(r.entity + ': "' + pending.title + '" announced while still awaiting release');

    w.showWineShows('distributor', 'current');
    w.openShowDetail(pending.id);
    w.simulateStaffRelease(pending.id);

    if (pending.stage !== 'published') bad('release did not publish the show');
    else ok('released ' + pending.title);

    for (const r of followers) {
      if (!d.getElementById(r.el).innerHTML.includes(pending.title))
        bad(r.entity + ': follows the host but was not told about the release');
      else ok(r.entity + ': told about ' + pending.title + ' the moment it was released');
    }
  }
}

console.log(fail ? `\n✗ ${fail} failure(s)` : '\n✓ the feed announces exactly what the other surfaces do');
process.exit(fail ? 1 : 0);
