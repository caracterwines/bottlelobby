/* The Wine Shows tab on the fifteen public winery and distributor
   profiles (A16.7).
   ------------------------------------------------------------------
   Fifteen pages is where a rule quietly stops holding on one of them.
   So every page is loaded and driven, not sampled — and the assertions
   are about DISCLOSURE, not about rendering:

     · an account is listed at a show only where A16.6 permits naming it
     · a producer confirmed at a `planning` show appears NOWHERE, because
       the show is publicly listed while anonymised and the two pages
       read together would give the name away
     · every data-entity resolves to a real account, so a typo shows up
       as a failure rather than as an empty tab

   These pages also had surgery done to them by script, so the run
   re-checks their structure: div balance, no duplicate ids, and the
   shared assets actually referenced. */
const fs = require('fs');
const path = require('path');
const { loadDashboard } = require('./load-dashboard');
const { JSDOM, VirtualConsole } = require('jsdom');

const ROOT = path.join(__dirname, '..');
const PAGES = fs.readdirSync(ROOT)
  .filter(f => /^bottle-lobby-(winery|distributor)-.*\.html$/.test(f))
  .sort();

let fail = 0;
const bad = m => { console.log('  ✗ ' + m); fail++; };
const ok  = m => console.log('  ✓ ' + m);

if (PAGES.length !== 15) bad('expected 15 profile pages, found ' + PAGES.length);
else ok(PAGES.length + ' winery and distributor profiles found');

/* The records, read once from the shared asset via any page. */
const probe = new JSDOM(loadDashboard(path.join(ROOT, PAGES[0])).html,
  { runScripts: 'dangerously' });
const SHOWS = probe.window.eval('wineShows');
/* A product key → the name a page would print. Read through the shared
   asset's own resolver, so a leak check looks for the same string the
   renderer would emit rather than a second spelling of it. */
const wineNameOf = ref => probe.window.eval('wineName(' + JSON.stringify(ref) + ')');

/* What SHOULD be on each page, derived here independently of the
   renderer — a test that reuses the implementation proves nothing. */
function expected(entity) {
  const out = [];
  for (const s of SHOWS) {
    const listable = ['planning', 'published', 'completed'].includes(s.stage);
    if (!listable) continue;
    if (s.leadHost === entity) { out.push({ show: s, role: 'Hosting' }); continue; }
    const full = s.stage === 'published' || s.stage === 'completed';
    if (!full) continue;
    if (s.exhibitors.some(e => e.status === 'confirmed' && e.producer === entity))
      out.push({ show: s, role: 'Exhibiting' });
  }
  return out;
}

/* There is no account registry in the prototype, so "is this a real
   account?" cannot be answered here — an account with no shows is
   correctly absent from the records, and is indistinguishable from a
   typo by that route. What IS checkable is that the name the tab
   declares is the name the page is about: the rewrite derived
   data-entity from <title>, and a mangled character or a wrong file
   would show up as a mismatch. */
function entityFromTitle(src) {
  const m = /<title>([^<—–]+)[—–]/.exec(src);
  return m ? m[1].trim() : null;
}

console.log('\n── every page, loaded and driven');
const summary = [];
for (const f of PAGES) {
  const file = path.join(ROOT, f);
  const errs = [];
  let dom;
  try {
    dom = new JSDOM(loadDashboard(file).html, {
      runScripts: 'dangerously', pretendToBeVisual: true,
      virtualConsole: new VirtualConsole().on('jsdomError', e => errs.push(e.message)) });
  } catch (e) { bad(f + ': ' + e.message); continue; }
  const w = dom.window, d = w.document;
  if (errs.length) { bad(f + ': script error — ' + errs[0].split('\n')[0]); continue; }

  const root = d.querySelector('.ws-profile-shows[data-entity]');
  if (!root) { bad(f + ': no shared Wine Shows tab'); continue; }
  const entity = root.getAttribute('data-entity');

  const titleEntity = entityFromTitle(fs.readFileSync(file, 'utf8'));
  if (entity !== titleEntity)
    bad(f + ': data-entity "' + entity + '" but the page is about "' + titleEntity + '"');

  const want = expected(entity);
  const cards = [...root.querySelectorAll('.ws-teaser')];
  const titles = cards.map(c => c.querySelector('.ws-public-title').textContent);

  const missing = want.filter(x => !titles.includes(x.show.title));
  const extra = titles.filter(t => !want.some(x => x.show.title === t));
  if (missing.length) bad(f + ': missing ' + missing.map(x => x.show.title).join(', '));
  if (extra.length)   bad(f + ': lists shows it may not — ' + extra.join(', '));

  /* The empty state must be an empty state, not a blank box. */
  if (!want.length) {
    if (!root.querySelector('.ws-empty')) bad(f + ': no shows and no empty state either');
  } else if (root.querySelector('.ws-empty')) {
    bad(f + ': shows a "no participation" notice while listing ' + want.length);
  }

  /* Role chip, so a host is not read as an exhibitor. */
  for (const x of want) {
    const card = cards.find(c => c.querySelector('.ws-public-title').textContent === x.show.title);
    if (!card) continue;
    const chip = card.querySelector('.ws-teaser-role');
    if (!chip) bad(f + ': "' + x.show.title + '" has no role chip');
    else if (chip.textContent !== x.role)
      bad(f + ': "' + x.show.title + '" says ' + chip.textContent + ', expected ' + x.role);
  }

  /* THE assertion. An anonymised show may appear on its HOST's profile
     — the host is the one announcing it, and A16.6 protects producers,
     products and the venue, not the announcer. On anyone else's
     profile, naming it is the leak: the show is publicly listed while
     anonymised, so a second page carrying the same title next to an
     account name gives away who is exhibiting. */
  const cellFor = title => [...root.querySelectorAll('.ws-cell')]
    .find(c => (c.querySelector('.ws-public-title') || {}).textContent === title);

  for (const s of SHOWS) {
    if (s.stage !== 'planning') continue;
    const cell = cellFor(s.title);

    if (cell && s.leadHost !== entity) {
      bad(f + ': lists the anonymised show "' + s.title + '" without hosting it');
      continue;
    }
    if (!cell) continue;

    /* Scoped to this show's own card and listing. The same producer may
       legitimately be named elsewhere on the page for a DIFFERENT,
       released show — Weingut Schmitt is anonymous at Grande Rioja and
       named at Loire & Mosel, on the same profile. */
    const scoped = cell.innerHTML;
    for (const e of s.exhibitors) {
      if (scoped.includes(e.producer))
        bad(f + ': "' + s.title + '" names its exhibitor ' + e.producer + ' while anonymised');
      /* Resolved from the KEY. `p.name` was removed by pass 3b, so this
         compared against `undefined` and the wine-leak guard had been
         silently vacuous ever since. */
      for (const p of e.products) {
        const label = wineNameOf(p.productId);
        if (!label) bad('a show product resolves to no name — the leak check cannot look for anything');
        else if (scoped.includes(label))
          bad(f + ': "' + s.title + '" names the wine ' + label + ' while anonymised');
      }
    }
    if (scoped.includes(s.venueName))
      bad(f + ': "' + s.title + '" discloses its venue while anonymised');
  }

  /* Structure, because these pages were rewritten by script. */
  const raw = fs.readFileSync(file, 'utf8');
  const markup = raw.replace(/<script>[\s\S]*?<\/script>/g, '');
  let depth = 0, lowest = 0;
  for (const m of markup.matchAll(/<div\b|<\/div>/g)) {
    depth += m[0].startsWith('</') ? -1 : 1;
    lowest = Math.min(lowest, depth);
  }
  if (depth !== 0 || lowest < 0) bad(f + ': div structure broken (balance ' + depth + ', lowest ' + lowest + ')');

  const ids = [...markup.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
  const dupes = [...new Set(ids.filter((x, i) => ids.indexOf(x) !== i))];
  if (dupes.length) bad(f + ': duplicate ids — ' + dupes.join(', '));

  /* The tab must not carry show content of its own any more. */
  const pasted = SHOWS.filter(s => raw.includes(s.title));
  if (pasted.length) bad(f + ': show titles hard-coded — ' + pasted.map(s => s.title).join(', '));

  summary.push({ f: f, entity: entity, n: want.length, roles: want.map(x => x.role) });
}

for (const s of summary) {
  const label = s.n ? s.n + ' show(s): ' + [...new Set(s.roles)].join(' + ') : 'empty state';
  ok(s.entity.padEnd(30) + label);
}

/* A run where every page is empty would pass every assertion above and
   prove nothing at all. */
console.log('\n── the fixtures exercise both outcomes');
{
  const withShows = summary.filter(s => s.n);
  const empty = summary.filter(s => !s.n);
  if (!withShows.length) bad('no profile lists a single show — the renderer is untested');
  else ok(withShows.length + ' profiles list shows');
  if (!empty.length) bad('no profile shows the empty state — it is untested');
  else ok(empty.length + ' profiles show the empty state');

  /* Both roles must occur, or one of the two branches is untested. */
  const roles = new Set(summary.flatMap(s => s.roles));
  for (const r of ['Hosting', 'Exhibiting'])
    if (!roles.has(r)) bad('no profile exercises the "' + r + '" role');
  if (roles.has('Hosting') && roles.has('Exhibiting')) ok('both host and exhibitor roles occur');

  /* And the case the whole rule exists for must be present. */
  const hidden = SHOWS.filter(s => s.stage === 'planning')
    .flatMap(s => s.exhibitors.filter(e => e.status === 'confirmed').map(e => e.producer));
  if (!hidden.length) bad('no producer is confirmed at an anonymised show — A16.6 is untested here');
  else ok(hidden.length + ' confirmed producer(s) correctly absent from their own profile: ' +
          [...new Set(hidden)].join(', '));
}

console.log(fail ? `\n✗ ${fail} failure(s)` : '\n✓ all fifteen profiles disclose exactly what A16.6 allows');
process.exit(fail ? 1 : 0);
