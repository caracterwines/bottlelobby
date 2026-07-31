/* Structural checks on bottle-lobby-dashboard.html.
   The other harnesses run the page; this one reads it. Together they
   are the "usual checks" C3 asks for, so `npm test` now covers both.

   Every check here exists because something broke once — see the note
   above each one. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { loadDashboard } = require('./load-dashboard');

/* Defaults to the dashboard; an explicit path lets you check a variant
   without touching the real file — used to verify that these checks
   actually fail when something is broken. */
const FILE = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(__dirname, '..', 'bottle-lobby-dashboard.html');

let fail = 0;
const bad = m => { console.log('  ✗ ' + m); fail++; };
const ok  = m => console.log('  ✓ ' + m);

/* ── 0. External assets ──────────────────────────────────────────── */
/* The page's data and its public renderer live in assets/ so the
   dashboard and the public pages cannot drift apart. jsdom does not
   fetch <script src>, so a missing or empty asset is invisible to every
   other check in this file and to all four behaviour harnesses — the
   page just runs without those globals. This check is the reason that
   cannot happen quietly. It runs first and stops the run, because every
   check below would otherwise report on a page missing half its code. */
console.log('── external assets');
let loaded;
try {
  loaded = loadDashboard(FILE);
} catch (e) {
  bad(e.message);
  console.log('\n✗ 1 failure(s)');
  process.exit(1);
}
{
  const raw = fs.readFileSync(FILE, 'utf8');
  const declaredJs  = [...raw.matchAll(/<script\s+src="([^"]+)"/g)].map(m => m[1]);
  const declaredCss = [...raw.matchAll(/<link\s+rel="stylesheet"\s+href="([^"]+)"/g)].map(m => m[1]);
  if (!declaredJs.length && !declaredCss.length) ok('none declared');
  else {
    const show = list => list.map(e => e.src + ' (' + Math.round(e.code.length / 1024) + ' KB)').join(', ');
    ok(loaded.externals.length + ' of ' + declaredJs.length + ' scripts inlined: ' + show(loaded.externals));
    ok(loaded.styles.length + ' of ' + declaredCss.length + ' stylesheets inlined: ' + show(loaded.styles));
    /* Order is a contract, not a detail: the renderer reads the data. */
    const order = loaded.externals.map(e => e.src);
    const data = order.indexOf('assets/bottle-lobby-data.js');
    const pub  = order.indexOf('assets/bottle-lobby-public-shows.js');
    if (data !== -1 && pub !== -1 && data > pub)
      bad('bottle-lobby-data.js must be loaded before bottle-lobby-public-shows.js');
    else if (data !== -1) ok('data asset loads before the renderer that reads it');
  }
}

/* Everything below reads the page WITH its assets inlined, so an
   extracted function is checked exactly like one that never moved. */
const src = loaded.html;
const scripts = [...src.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
const js = scripts.join('\n');
/* Markup only. Nearly every false positive in earlier ad-hoc runs came
   from HTML built inside JS template strings, so strip scripts first. */
const markup = src.replace(/<script>[\s\S]*?<\/script>/g, '');
/* Every style block, not just the first. Rules that moved into
   assets/*.css arrive as an extra inlined block, and a cross-check that
   read only block one would report them as missing. */
const style = [...src.matchAll(/<style>([\s\S]*?)<\/style>/g)].map(m => m[1]).join('\n');

/* ── 1. JS syntax — the `node --check` step ──────────────────────── */
console.log('\n── JS syntax');
try {
  new vm.Script(js, { filename: 'dashboard-scripts.js' });
  ok(scripts.length + ' script block(s), ' + Math.round(js.length / 1024) + ' KB, parse clean');
} catch (e) {
  bad('syntax error: ' + e.message);
}

/* ── 2. Duplicate ids ────────────────────────────────────────────── */
console.log('\n── ids');
{
  const ids = [...markup.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
  const dupes = [...new Set(ids.filter((x, i) => ids.indexOf(x) !== i))];
  if (dupes.length) bad('duplicate ids: ' + dupes.join(', '));
  else ok(ids.length + ' ids, all unique');

  /* getElementById('literal') must resolve. Ids built by string
     concatenation (the order/show shells) are not literals and are
     covered by the runtime harnesses instead. */
  const known = new Set(ids);
  const missing = [...new Set([...src.matchAll(/getElementById\('([a-z][\w-]*)'\)/g)].map(m => m[1]))]
    .filter(id => !known.has(id));
  if (missing.length) bad('getElementById targets absent from the markup: ' + missing.join(', '));
  else ok('every literal getElementById target exists');
}

/* ── 3. Div balance AND nesting ──────────────────────────────────── */
/* B10: a matching open/close COUNT does not prove correct nesting. A
   pair that closes two levels at once still balances. So check depth
   never goes negative, and that sibling sections really are siblings. */
console.log('\n── div structure');
{
  let depth = 0, lowest = 0;
  for (const m of markup.matchAll(/<div\b|<\/div>/g)) {
    depth += m[0].startsWith('</') ? -1 : 1;
    lowest = Math.min(lowest, depth);
  }
  if (depth !== 0) bad('div balance is ' + depth + ', expected 0');
  else if (lowest < 0) bad('div depth went negative (' + lowest + ') — a close precedes its open');
  else ok('balanced, never negative');

  /* B10 proper: children escaping their container. A stray closing pair
     that shuts an inner AND its wrapper leaves the count balanced and
     the depths plausible — the elements simply land outside. Regex
     depth-counting misses this, so parse the markup and ask the DOM.
     Each pair below is a container whose children lose their layout,
     border or grouping the moment they slip out of it. */
  const { JSDOM } = require('jsdom');
  const doc = new JSDOM(markup).window.document;
  const CONTAINS = [
    ['wines-grid',      'wine-card'],            // the original B10 bug
    ['wine-edit-list',  'wine-edit-entry'],
    ['list-edit',       'list-entry'],
    ['otbl',            'otbl-row'],
    ['profile-section', 'profile-section-header'],
    ['nav-section',     'nav-item'],
    ['stats-row',       'stat-card'],
    ['modal-panel',     'modal-body'],
    ['widget',          'widget-header'],
  ];
  let checkedPairs = 0;
  for (const [container, child] of CONTAINS) {
    const kids = [...doc.querySelectorAll('.' + child)];
    if (!kids.length) continue;                 // pair not present in this file
    checkedPairs++;
    const escaped = kids.filter(e => !e.closest('.' + container));
    if (escaped.length)
      bad(escaped.length + ' of ' + kids.length + ' .' + child +
          ' are outside any .' + container + ' — a closing pair shut the container early (B10)');
  }
  ok(checkedPairs + ' container/child relationships intact');

  /* Every profile-section of a role must sit at the same depth. If one
     drifts, a stray closing pair swallowed a wrapper (the B10 bug). */
  const stack = [], closedAt = {};
  for (const m of markup.matchAll(/<div\b[^>]*>|<\/div>/g)) {
    if (m[0].startsWith('</')) {
      const opened = stack.pop();
      if (opened) closedAt[opened] = stack.length;
    } else {
      const id = /id="([^"]+)"/.exec(m[0]);
      stack.push(id && /section-/.test(id[1]) ? id[1] : null);
    }
  }
  for (const [role, prefix] of [['winery','wsection-'],['distributor','dsection-'],
                                ['restaurant','rsection-'],['retail','tsection-']]) {
    const depths = new Set(Object.entries(closedAt)
      .filter(([k]) => k.startsWith(prefix)).map(([, v]) => v));
    const n = Object.keys(closedAt).filter(k => k.startsWith(prefix)).length;
    if (depths.size !== 1) bad(role + ': profile sections at differing depths ' + [...depths].join(', '));
    else ok(role + ': ' + n + ' sections, all siblings at depth ' + [...depths][0]);
  }
}

/* ── 4. onclick handlers are defined ─────────────────────────────── */
console.log('\n── onclick handlers');
{
  const called = new Set([...src.matchAll(/onclick="([A-Za-z_$][\w$]*)\(/g)].map(m => m[1]));
  const defined = new Set([...js.matchAll(/function\s+([A-Za-z_$][\w$]*)\s*\(/g)].map(m => m[1]));
  const builtins = new Set(['alert', 'confirm', 'if']);   // `if` comes from an inline conditional
  const missing = [...called].filter(f => !defined.has(f) && !builtins.has(f)).sort();
  if (missing.length) bad('called from onclick but never defined: ' + missing.join(', '));
  else ok(called.size + ' handlers, all defined');
}

/* ── 5. CSS classes used in the markup are defined ───────────────── */
/* Two legitimate reasons a class carries no rule, both excluded below:
   it is a JS query hook, or it is a known leftover of the older naming
   convention (B9). Anything else is a typo waiting to lose its
   styling silently. */
console.log('\n── CSS classes (markup)');
{
  /* Vestigial names from the pre-B9 convention. They are inert: every
     element carrying them sets its appearance inline, so there is no
     visual defect — but they are dead weight. Tracked in HANDOFF;
     remove the entry here once the class is gone from the markup. */
  const KNOWN_UNSTYLED = ['profile-badge', 'badge-own-label'];

  const defined = new Set([...style.matchAll(/\.([a-zA-Z][\w-]*)/g)].map(m => m[1]));
  /* Classes the JS selects on need no rule of their own. */
  const hooks = new Set([...js.matchAll(/(?:querySelector(?:All)?|closest)\('\.([\w-]+)/g)].map(m => m[1])
    .concat([...js.matchAll(/getElementsByClassName\('([\w-]+)/g)].map(m => m[1])));

  const used = new Set();
  for (const m of markup.matchAll(/class="([^"]*)"/g)) {
    m[1].split(/\s+/).filter(Boolean).forEach(c => used.add(c));
  }
  const missing = [...used].filter(c => !defined.has(c) && !hooks.has(c)).sort();
  const unexpected = missing.filter(c => !KNOWN_UNSTYLED.includes(c));
  const stillKnown = KNOWN_UNSTYLED.filter(c => used.has(c));

  if (unexpected.length) bad('used in markup, not defined in <style>: ' + unexpected.join(', '));
  else ok(used.size + ' classes checked, ' + hooks.size + ' JS hooks skipped, no unexpected gaps');
  if (stillKnown.length) console.log('    known unstyled leftovers (B9, see HANDOFF): ' + stillKnown.join(', '));
  const gone = KNOWN_UNSTYLED.filter(c => !used.has(c));
  if (gone.length) bad('KNOWN_UNSTYLED lists classes no longer used — drop them: ' + gone.join(', '));
}

/* ── 6. Dynamically built class names cover their whole enum ─────── */
/* The `.wse-applied` lesson: a class assembled as "wse-" + status is
   invisible to check 5, because the name never appears in the markup.
   So enumerate the states and check each has a rule.
   Enums per A16.2 / A16.9 — extend these when the spec does. */
console.log('\n── enum-driven class names');
{
  const SHOW_STAGES = ['draft','planning','pending_approval','changes_requested',
                       'published','completed','cancelled','rescheduled'];
  const PARTY_STATES = ['invited','applied','confirmed','declined','proposed'];

  /* Guard against the lists drifting from the code: every stage the
     source actually assigns must be in the list above. */
  const labelBlock = /const SHOW_STAGE_LABEL = \{([\s\S]*?)\};/.exec(js);
  if (!labelBlock) bad('SHOW_STAGE_LABEL not found — enum drift check cannot run');
  else {
    const inCode = [...labelBlock[1].matchAll(/(\w+):/g)].map(m => m[1]);
    const drift = inCode.filter(s => !SHOW_STAGES.includes(s));
    if (drift.length) bad('SHOW_STAGE_LABEL has stages this check does not know: ' + drift.join(', '));
    else ok('stage list matches SHOW_STAGE_LABEL (' + inCode.length + ')');
  }

  /* Every state in both enums must have a rule — including states that
     are not reachable through the UI yet. A pill only reveals itself as
     unstyled once the state first occurs, which is the worst moment to
     find out. */
  const has = cls => new RegExp('\\.' + cls + '[\\s,{:.]').test(style);
  const report = (label, names, prefix) => {
    const missing = names.map(s => prefix + s).filter(c => !has(c));
    if (missing.length) bad('no CSS for ' + label + ': ' + missing.map(c => '.' + c).join(', '));
    else ok('all ' + names.length + ' ' + label + ' styled');
  };
  report('stage pills', SHOW_STAGES, 'ws-');
  report('exhibitor/product state pills', PARTY_STATES, 'wse-');
}

/* ── 7. The shared renderer's classes are defined ────────────────── */
/* Same blind spot as check 6, one level worse: publicShowTeaser() and
   publicShowCard() live in assets/bottle-lobby-public-shows.js and emit
   their class names from inside JS strings, so the markup scan in
   check 5 cannot see them. They are also the classes two different
   pages depend on, which is exactly where an unstyled name would show
   up late and in front of someone. */
console.log('\n── shared renderer classes');
{
  const renderer = loaded.externals.find(e => /public-shows\.js$/.test(e.src));
  if (!renderer) {
    ok('no shared renderer on this page');
  } else {
    /* Stop at a quote OR an apostrophe: the source concatenates, so
       class="ws-teaser' + (past ? …) would otherwise capture the
       expression along with the name. */
    const emitted = new Set();
    for (const m of renderer.code.matchAll(/class="([^"']*)/g))
      m[1].split(/\s+/).filter(c => c.startsWith('ws-')).forEach(c => emitted.add(c));

    /* Modifiers are appended conditionally and never appear next to
       their base class in the source, so they are named here. Both are
       only ever used in combination, hence the compound selector. */
    const MODIFIERS = ['ws-teaser.past', 'ws-listing.open'];

    const has = cls => new RegExp('\\.' + cls.replace(/\./g, '\\.') + '[\\s,{:.]').test(style);
    const missing = [...emitted, ...MODIFIERS].filter(c => !has(c));
    if (missing.length) bad('emitted by the shared renderer, no CSS rule: ' + missing.map(c => '.' + c).join(', '));
    else ok(emitted.size + ' emitted classes + ' + MODIFIERS.length + ' modifiers, all styled');

    /* And the reverse, so the stylesheet cannot quietly outlive its
       renderer: every card rule should still correspond to something
       the renderer emits. */
    const declared = [...style.matchAll(/^\.(ws-teaser[\w-]*)/gm)].map(m => m[1]);
    const orphans = [...new Set(declared)].filter(c => !emitted.has(c));
    if (orphans.length) bad('styled but no longer emitted: ' + orphans.map(c => '.' + c).join(', '));
    else ok('no orphaned card rules');
  }
}

console.log(fail ? `\n✗ ${fail} failure(s)` : '\n✓ all checks passed');
process.exit(fail ? 1 : 0);
