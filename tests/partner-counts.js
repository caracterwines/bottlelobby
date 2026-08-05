/* ═══════════════════════════════════════════════════════════════════
   PARTNER FIGURES — counted, never stored (invariant 7)

   Every partner card used to carry its number as a field on the
   partnership row. Two of them were wrong on the screen and nothing
   said so: Cantina Rossi read "6 wines in your portfolio" where the
   portfolio holds 1, Weingut Schmitt read 1 where it holds 2. The two
   buyers named DIFFERENT figures — 5 and 6 — for the same book.

   A stored count is the same failure as a stored copy: it renders
   perfectly, and it is wrong only in the sense that nothing on the
   page agrees with it. So the assertions here are mostly negative —
   no row may carry a figure, no renderer may read one — and the one
   positive assertion is that every number on every card equals a
   count this file does itself.

   THE COUNTING IS DONE HERE, from currentWinePortfolio, and NOT by
   asking portfolioCount(). Under the mutation this file exists to
   catch — counting the wrong book — asking the product would be
   circular: green and wrong at the same time. A test may derive a
   second time; only the product needs one answer.

   Comparison is against the RENDERED CARD, not the function's return
   value. The drift these figures had was on the screen.
═══════════════════════════════════════════════════════════════════ */
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');
const { loadDashboard } = require('./load-dashboard');
const REPO = path.join(__dirname, '..');

let fail = 0;
const bad = m => { console.log('  ✗ ' + m); fail++; };
const ok  = m => console.log('  ✓ ' + m);

/* The four partner lists, one per role. Driven explicitly: a card
   that is never rendered cannot show a wrong number, and a coverage
   check over an empty set is the emptiest kind of green. */
const LISTS = [
  { role:'distributor', render:'renderPartnerNetwork',    el:'pn-active-list',   me:'Hawesko GmbH'   },
  { role:'winery',      render:'renderWineryNetwork',     el:'wn-partners-list', me:'Cantina Rossi'  },
  { role:'restaurant',  render:'renderRestaurantNetwork', el:'rpn-active-list',  me:'Bistro Laurent' },
  { role:'retail',      render:'renderRetailNetwork',     el:'tpn-active-list',  me:'Weinhaus Müller'}
];

/* Returns null if the patch never applied, so a mutation that missed
   its target cannot be read as "the check held" — same discipline as
   tests/notifications.js and tests/stakeholders.js. */
function build(patch) {
  let html = loadDashboard().html;
  if (patch) {
    const before = html;
    html = html.replace(patch.from, patch.to);
    if (html === before) return null;
  }
  const errs = [];
  const dom = new JSDOM(html, {
    runScripts: 'dangerously', pretendToBeVisual: true,
    virtualConsole: new VirtualConsole().on('jsdomError', e => errs.push(e.message))
  });
  const w = dom.window;
  w.scrollTo = () => {}; w.confirm = () => true;
  if (errs.length) { console.log('SCRIPT ERRORS:\n' + errs.join('\n')); process.exit(1); }
  LISTS.forEach(l => { try { w.eval(l.render + '()'); } catch (e) { /* absent view */ } });
  return w;
}

/* Every card in a list, as { name, meta }. */
function cards(w, el) {
  const box = w.document.getElementById(el);
  if (!box) return [];
  return [...box.querySelectorAll('.pn-card, .wn-card')].map(c => ({
    name: (c.querySelector('.pn-name, .wn-name') || {}).textContent.trim(),
    meta: ((c.querySelector('.pn-meta, .wn-meta') || {}).textContent || '').replace(/\s+/g, ' ').trim()
  }));
}
const cardFor = (w, el, name) => cards(w, el).find(c => c.name === name);

const w = build();
const SRC = fs.readFileSync(path.join(REPO, 'bottle-lobby-dashboard.html'), 'utf8');
console.log('script evaluated cleanly\n');

/* The book, read once and counted here. */
const BOOK = w.eval('JSON.parse(JSON.stringify(currentWinePortfolio))');
const TOTAL = BOOK.length;
const byProducer = name => BOOK.filter(x => x.winery === name).length;

/* ── 1. No figure is stored anywhere ─────────────────────────────── */
console.log('── the relation carries no figures');
{
  const rows = w.eval('JSON.parse(JSON.stringify(partnerships))');
  const allowed = ['distributor', 'partner', 'at', 'activatedBy'];
  const strays = rows.flatMap(r => Object.keys(r).filter(k => !allowed.includes(k))
    .map(k => r.distributor + '↔' + r.partner + '.' + k));
  if (strays.length) bad('a partnership row carries something other than the relation: ' + strays.join(', '));
  else ok('all ' + rows.length + ' rows hold exactly who, when and who activated it');

  /* Named explicitly, because these two are the ones that were there
     and could come back by name in a merge. */
  ['distributorMeta', 'partnerWines'].forEach(f => {
    if (rows.some(r => f in r)) bad('`' + f + '` is back on the partnership row');
    else ok('no `' + f + '` on any row');
  });
}

/* ── 2. Every rendered number equals a count made here ───────────── */
console.log('\n── every figure on a card is the count of the book');
{
  /* The distributor's own end: how much of THAT producer it carries. */
  const producers = w.eval('JSON.parse(JSON.stringify(partnerships))')
    .filter(p => p.distributor === 'Hawesko GmbH')
    .map(p => p.partner)
    .filter(n => w.eval('stakeholder(' + JSON.stringify(n) + ').type') === 'winery');

  producers.forEach(name => {
    const c = cardFor(w, 'pn-active-list', name);
    if (!c) return bad('no card for ' + name + ' on the distributor list');
    const n = byProducer(name);
    const want = n + (n === 1 ? ' wine' : ' wines') + ' in your portfolio';
    if (!c.meta.endsWith(want)) bad(name + ' reads "' + c.meta + '", counted here: ' + want);
    else ok(name + ' → ' + want);
  });

  /* A buyer partner is not counted at all: it does not fill the book,
     it sources from it. A number here would be the wrong question. */
  ['Bistro Laurent', 'Weinhaus Müller', 'Vinstuen København'].forEach(name => {
    const c = cardFor(w, 'pn-active-list', name);
    if (!c) return bad('no card for ' + name + ' on the distributor list');
    if (/\d/.test(c.meta.replace(/Partner since [^·]+/, '')))
      bad(name + ' is a buyer and its card names a figure: "' + c.meta + '"');
    else ok(name + ' → no figure, "Sources through your portfolio"');
  });

  /* The winery's end of the same book, from the other side. */
  {
    const c = cardFor(w, 'wn-partners-list', 'Hawesko GmbH');
    const want = byProducer('Cantina Rossi') + ' of your wines listed';
    if (!c) bad('the winery has no card for Hawesko GmbH');
    else if (!c.meta.endsWith(want)) bad('the winery reads "' + c.meta + '", counted here: ' + want);
    else ok('winery → ' + want);
  }

  /* Both buyers ask the identical question about the identical book.
     They used to answer it with 5 and 6. */
  const r = cardFor(w, 'rpn-active-list', 'Hawesko GmbH');
  const t = cardFor(w, 'tpn-active-list', 'Hawesko GmbH');
  const want = TOTAL + ' wines available in their portfolio';
  if (!r || !t) bad('a buyer has no card for Hawesko GmbH');
  else {
    if (!r.meta.endsWith(want)) bad('the restaurant reads "' + r.meta + '", counted here: ' + want);
    if (!t.meta.endsWith(want)) bad('the retailer reads "' + t.meta + '", counted here: ' + want);
    if (r.meta.replace(/Partner since [^·]+· /, '') !== t.meta.replace(/Partner since [^·]+· /, ''))
      bad('the two buyers disagree about the same book: "' + r.meta + '" vs "' + t.meta + '"');
    else ok('both buyers → ' + want + ' (the same book, so necessarily the same answer)');
  }
}

/* ── 3. No book is not an empty book ─────────────────────────────── */
console.log('\n── a distributor with no portfolio names no figure');
{
  if (w.eval('portfolioOf("Enoteca Milano Import Srl")') !== null)
    bad('portfolioOf() answers something other than null for a house with no book');
  else ok('portfolioOf("Enoteca Milano Import Srl") === null');

  if (w.eval('portfolioCount("Enoteca Milano Import Srl", "Cantina Rossi")') !== undefined)
    bad('portfolioCount() returns a number where there is no book to count');
  else ok('portfolioCount() → undefined, not 0');

  const c = cardFor(w, 'wn-partners-list', 'Enoteca Milano Import Srl');
  if (!c) bad('the winery has no card for Enoteca Milano Import Srl');
  else if (/\d+ of your wines|0 /.test(c.meta))
    bad('the Enoteca card names a figure it cannot know: "' + c.meta + '"');
  else ok('the Enoteca card names no figure: "' + c.meta + '"');
}

/* ── 4. The sentence has no singular form ────────────────────────── */
console.log('\n── the two sentences inflect differently, and on purpose');
{
  /* "1 of your wines listed" — the plural belongs to my range. The
     distributor's own card DOES inflect, because there the noun is
     the count itself. Both were wrong together before this pass. */
  const c = cardFor(w, 'wn-partners-list', 'Hawesko GmbH');
  if (c && /\bof your wine\b/.test(c.meta)) bad('"of your wine" — the plural belongs to the range, not the count');
  else ok('the winery card says "of your wines" whatever the number is');

  /* Bodegas Ruiz, not Domaine Lefèvre: the portfolio merge took Lefèvre
     to two wines and this check quietly lost its singular case. Which
     producer carries exactly one is a fixture fact and can move again —
     so the pair is chosen by COUNT here, and the section fails loudly
     if the data no longer offers both. */
  const byCount = n => w.eval('JSON.parse(JSON.stringify(partnerships))')
    .filter(p => p.distributor === 'Hawesko GmbH')
    .map(p => p.partner)
    .filter(name => byProducer(name) === n)[0];
  const oneName = byCount(1), twoName = byCount(2);
  if (!oneName || !twoName) {
    bad('no producer with exactly one wine and one with two — the inflection cannot be observed, ' +
        'so this check proves nothing (have: ' + JSON.stringify(BOOK.map(b => b.winery)) + ')');
    return;
  }
  const one = cardFor(w, 'pn-active-list', oneName);
  const two = cardFor(w, 'pn-active-list', twoName);
  if (!one || !/\b1 wine in your portfolio$/.test(one.meta)) bad(oneName + ' carries one wine but does not read "1 wine in your portfolio": ' + (one && one.meta));
  else if (!two || !/\b2 wines in your portfolio$/.test(two.meta)) bad(twoName + ' carries two wines but does not read "2 wines in your portfolio": ' + two.meta);
  else ok('the distributor card inflects: ' + oneName + ' "1 wine" vs ' + twoName + ' "2 wines"');
}

/* ── 5. The surface moves when the book moves ────────────────────── */
console.log('\n── pulling a wine in moves all four cards, with no second action');
{
  /* The bug this section stands for was invisible to a harness and
     visible in the browser: the four lists kept their old figure,
     because the only thing repainted was the portfolio itself. So the
     four lists are rendered ONCE here, up front, and never again —
     anything that redraws them afterwards has to come from the
     product, exactly as it does for a person clicking the button. */
  const g = build();
  const before = LISTS.map(l => cardFor(g, l.el, l.me === 'Hawesko GmbH' ? 'Cantina Rossi' : 'Hawesko GmbH'));

  g.eval('awSelectedWine = partnerWinesPool.find(function (x) { return x.name === "Grillo Sicilia DOC"; });');
  g.eval('editingPortfolioIndex = null;');
  g.eval('confirmAddWine()');

  const after = LISTS.map(l => cardFor(g, l.el, l.me === 'Hawesko GmbH' ? 'Cantina Rossi' : 'Hawesko GmbH'));
  const moved = before.map((b, i) => b && after[i] && b.meta !== after[i].meta);

  if (g.eval('currentWinePortfolio.length') !== TOTAL + 1) bad('the wine was not pulled in — the rest of this section proves nothing');
  else if (moved.some(m => !m))
    bad('a card kept its old figure after the book changed: ' +
        LISTS.filter((l, i) => !moved[i]).map(l => l.role).join(', ') +
        ' — still "' + before[moved.indexOf(false)].meta + '"');
  else ok('all four cards followed: ' + after.map((c, i) => LISTS[i].role + ' "' + c.meta.replace(/^Partner since [^·]+· /, '') + '"').join(', '));
}

/* ── 6. Counter-check: each mistake must turn this file red ──────── */
console.log('\n── counter-check: the old mistakes must not be able to return');
{
  const cases = [
    { name: 'the figure is stored on the row again',
      from: "  { distributor:'Hawesko GmbH', partner:'Cantina Rossi', at:'2026-03-09', activatedBy:'Bottle Lobby' },",
      to:   "  { distributor:'Hawesko GmbH', partner:'Cantina Rossi', at:'2026-03-09', activatedBy:'Bottle Lobby', partnerWines:6 },",
      check: g => g.eval('JSON.parse(JSON.stringify(partnerships))').some(r => 'partnerWines' in r),
      says: 'section 1 catches a figure back on the relation' },

    { name: 'the buyer card counts the producers\' pool instead of the distributor\'s book',
      from: '          const n = portfolioCount(who);\n          return `\n          <div class="pn-card">\n            <div class="pn-avatar">${st.avatar}</div>\n            <div class="pn-info">\n              <div class="pn-name">${who}</div>\n              <div class="pn-meta">Partner since ${orderDate(p.at)}${n === undefined ? \'\' : ` · ${n} ${n === 1 ? \'wine\' : \'wines\'} available in their portfolio`}</div>\n            </div>\n            <div class="pn-right">\n              <span class="pn-status st-active">Active</span>\n              ${st.url ? `<a class="pn-link" href="${st.url}" target="_blank">View profile →</a>` : \'\'}\n            </div>\n          </div>`;\n        }).join(\'\')}\n      `).join(\'\');\n    }\n  }\n\n  const req = document.getElementById(\'rpn-request-list\');',
      to:   '          const n = partnerWinesPool.length;\n          return `\n          <div class="pn-card">\n            <div class="pn-avatar">${st.avatar}</div>\n            <div class="pn-info">\n              <div class="pn-name">${who}</div>\n              <div class="pn-meta">Partner since ${orderDate(p.at)}${n === undefined ? \'\' : ` · ${n} ${n === 1 ? \'wine\' : \'wines\'} available in their portfolio`}</div>\n            </div>\n            <div class="pn-right">\n              <span class="pn-status st-active">Active</span>\n              ${st.url ? `<a class="pn-link" href="${st.url}" target="_blank">View profile →</a>` : \'\'}\n            </div>\n          </div>`;\n        }).join(\'\')}\n      `).join(\'\');\n    }\n  }\n\n  const req = document.getElementById(\'rpn-request-list\');',
      check: g => {
        const c = cardFor(g, 'rpn-active-list', 'Hawesko GmbH');
        return !!c && !c.meta.endsWith(TOTAL + ' wines available in their portfolio');
      },
      says: 'section 2 catches the wrong book being counted. The picker pools it used to name are gone; \n             partnerWinesPool is what a buyer must still never be shown — it is what the PRODUCERS \n             offer, not what this distributor carries' },

    { name: 'a missing book counts as an empty one',
      from: '  const get = DISTRIBUTOR_PORTFOLIOS[distributor];\n  return get ? get() : null;',
      to:   '  const get = DISTRIBUTOR_PORTFOLIOS[distributor];\n  return get ? get() : [];',
      check: g => {
        const c = cardFor(g, 'wn-partners-list', 'Enoteca Milano Import Srl');
        return !!c && /0 of your wines/.test(c.meta);
      },
      says: 'section 3 catches "0 wines" claimed about a house with no book' },

    { name: 'the distributor card counts the whole book per producer',
      from: '  return producer ? book.filter(function (w) { return w.winery === producer; }).length : book.length;',
      to:   '  return book.length;',
      check: g => {
        const c = cardFor(g, 'pn-active-list', 'Cantina Rossi');
        return !!c && c.meta.endsWith(TOTAL + ' wines in your portfolio');
      },
      says: 'section 2 catches every producer being credited with the whole portfolio' },

    { name: 'the four cards are left standing after a wine is pulled in',
      /* "My Labels" was wired in between these two lines in commit 3,
         so the mutation names the whole block it is removing from. */
      from: '  renderWinePortfolioD();\n  renderOwnLabelsD();\n  refreshPortfolioCounts();\n  closePullWineModal();',
      to:   '  renderWinePortfolioD();\n  renderOwnLabelsD();\n  closePullWineModal();',
      check: g => {
        const before = cardFor(g, 'rpn-active-list', 'Hawesko GmbH').meta;
        g.eval('awSelectedWine = partnerWinesPool.find(function (x) { return x.name === "Grillo Sicilia DOC"; });');
        g.eval('editingPortfolioIndex = null;');
        g.eval('confirmAddWine()');
        return cardFor(g, 'rpn-active-list', 'Hawesko GmbH').meta === before;
      },
      says: 'section 5 catches the surface keeping a figure its input has left behind' },

    { name: 'the winery sentence inflects on the count again',
      from: '${n === undefined ? \'\' : ` · ${n} of your wines listed`}',
      to:   '${n === undefined ? \'\' : ` · ${n} of your ${n === 1 ? \'wine\' : \'wines\'} listed`}',
      check: g => {
        /* The state is BUILT: the singular form only appears when the
           winery has exactly one wine listed, and Cantina Rossi has
           five since the portfolio merge. Left to the fixture this
           mutation was real and invisible — a check certified against
           a defect it could no longer see. Third time in a day. */
        g.eval("currentWinePortfolio = currentWinePortfolio.filter(function (x) { return x.winery !== 'Cantina Rossi'; })" +
               ".concat([{ winery:'Cantina Rossi', name:'Primitivo — Alcamo DOC', vintage:2022, ownLabel:true," +
               " type:'Red', origin:'Alcamo DOC, Sicily', url:'bottle-lobby-wine-primitivo-sicilia-igt.html' }])");
        g.eval('renderWineryNetwork()');
        const c = cardFor(g, 'wn-partners-list', 'Hawesko GmbH');
        if (!c || !/\b1 of your wine/.test(c.meta)) return false;   // state not built
        return /of your wine\b/.test(c.meta);
      },
      says: 'section 4 catches "1 of your wine listed"' }
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
