/* ═══════════════════════════════════════════════════════════════════
   THE SUPPLY CHAIN HAS NO SHORTCUTS (invariant 3, A3, A6)

   Every wine that can reach a restaurant or a retailer must have an
   unbroken chain behind it:

     1. a partnership  distributor ↔ buyer
     2. the wine in    the distributor's portfolio
     3. a partnership  producer ↔ distributor
     4. the wine owned by that producer — the portfolio row names it

   WHY THIS FILE EXISTS. The break was found by a person asking, not by
   a check: Hawesko sold Château Belrieu's Merlot to Weinhaus Müller
   twice, 156 bottles, while holding no partnership with Château
   Belrieu at all. Nothing was red. This class of defect does not
   announce itself — every screen renders, every figure adds up, and
   the only symptom is a relation that was never there.

   THE COMMERCIAL RECORDS MATTER MORE THAN THE LISTS, and that is
   deliberate (Serge). The buyers' lists were clean the whole time; the
   break sat in an ORDER, and the next one will sit in an offer or a
   deal — a promise over a wine outside the book is the same gap,
   delayed until somebody accepts it. So orders, offers, deals and
   promo materials are checked first and hardest.

   It reports its own reach and FAILS ON ZERO. A chain check that
   examined nothing is not a clean result.

   TWO THINGS THAT ARE TRUE TODAY AND MAY NOT BE TOMORROW — Serge's
   review, and both are handled rather than only noted:

     · Offers, deals and promo materials carry NO OWNER FIELD. They
       belong to the one distributor that has a book. With a second
       one they would be unattributable, and this file would check
       them against the wrong house while the scope line — which
       counts records FOUND, not records POSSIBLE — said nothing. So
       section 3 fails outright the moment a second distributor gets a
       portfolio, and says what the records need first.
     · A buyer's chain is checked against EVERY distributor it
       partners with, not the first one found. Taking the first would
       report a wine sourced through a second distributor as
       chain-broken — a false alarm, and false alarms are the kind of
       finding that talks somebody into loosening the real rule. That
       happened twice in one day here; it is not a hypothetical.
       (The PRODUCT still picks the first distributor in its pickers.
       That is a product limitation, not a test one, and it belongs to
       whichever pass gives a buyer a second distributor.)
═══════════════════════════════════════════════════════════════════ */
const { JSDOM, VirtualConsole } = require('jsdom');
const { loadDashboard } = require('./load-dashboard');

let fail = 0;
const bad = m => { console.log('  ✗ ' + m); fail++; };
const ok  = m => console.log('  ✓ ' + m);

/* Returns null if a patch never applied, so a mutation that missed its
   target cannot read as "the check held". */
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
  return w;
}

/* One reader, so every section asks the same questions the same way.
   Deliberately re-derived HERE from partnerships and the portfolio
   rather than calling the product's own helpers: the mutations below
   patch those helpers, and a check that asked them would go green on
   exactly the change it exists to catch. */
function chainReader(w) {
  const J = x => JSON.parse(w.eval('JSON.stringify(' + x + ')'));
  const parts = J('partnerships');
  const types = {};
  J('stakeholders').forEach(s => { types[s.name] = s.type; });
  const books = {};
  w.eval('Object.keys(DISTRIBUTOR_PORTFOLIOS)').forEach(d => {
    books[d] = J('portfolioOf(' + JSON.stringify(d) + ')') || [];
  });
  return {
    types,
    parts,
    books,
    distributors: Object.keys(books),
    partnered: (a, b) => parts.some(p => (p.distributor === a && p.partner === b) ||
                                         (p.distributor === b && p.partner === a)),
    carries: (dist, wine) => (books[dist] || []).some(x => x.name === wine),
    producerOf: (dist, wine) => ((books[dist] || []).find(x => x.name === wine) || {}).winery
  };
}

/* Every distributor a buyer partners with — all of them, because
   taking the first would call a wine sourced through the second one
   chain-broken. */
function distributorsOf(r, me) {
  return r.parts.filter(p => p.partner === me || p.distributor === me)
    .map(p => (p.distributor === me ? p.partner : p.distributor))
    .filter(x => r.types[x] === 'distributor');
}

/* Every link, named, so a failure says WHICH one broke. */
function chainFaults(r, dist, wine, buyer) {
  const out = [];
  if (buyer && !r.partnered(dist, buyer)) out.push('no partnership ' + dist + ' ↔ ' + buyer);
  if (!r.carries(dist, wine)) return out.concat(dist + ' does not carry "' + wine + '"');
  const prod = r.producerOf(dist, wine);
  if (!prod) out.push('"' + wine + '" names no producer in ' + dist + "'s book");
  else if (r.types[prod] !== 'winery') out.push('"' + wine + '" is credited to ' + prod + ', which is not a producer');
  else if (!r.partnered(dist, prod)) out.push('no partnership ' + prod + ' ↔ ' + dist + ' behind "' + wine + '"');
  return out;
}

const w = build();
const R = chainReader(w);
const J = x => JSON.parse(w.eval('JSON.stringify(' + x + ')'));
console.log('script evaluated cleanly\n');

let checked = 0;
const surfaces = [];

/* ── 1. The book itself: A6's own sentence ───────────────────────
   "Only active winery partners' wines can appear in your Wine
   Portfolio" — written in the distributor's own dashboard copy, and
   asserted nowhere until now. */
console.log('── the portfolio only holds wines of active winery partners');
{
  let n = 0;
  const faults = [];
  R.distributors.forEach(d => (R.books[d] || []).forEach(wine => {
    n++;
    const prod = wine.winery;
    if (!prod) faults.push(d + ': "' + wine.name + '" names no producer');
    else if (R.types[prod] !== 'winery') faults.push(d + ': "' + wine.name + '" is credited to ' + prod + ' (' + (R.types[prod] || 'unknown') + ')');
    else if (!R.partnered(d, prod)) faults.push(d + ' carries "' + wine.name + '" but has no partnership with ' + prod);
  }));
  checked += n; surfaces.push('portfolios:' + n);
  if (!n) bad('no portfolio wines found at all — the check is broken, not the data');
  else if (faults.length) bad(faults.length + ' of ' + n + ' portfolio wines break A6: ' + faults.slice(0, 3).join(' · '));
  else ok(n + ' portfolio wines, every one from an active winery partner');
}

/* ── 2. Orders — where the break actually lived ──────────────────
   Both directions of the chain (A3): a distributor buying from a
   producer, and a buyer sourcing from a distributor. A winery selling
   its own wine needs no portfolio — it owns the record (invariant 2). */
console.log('\n── every order line has the relation behind it that lets goods move');
{
  const orders = J('orders');
  let n = 0;
  const faults = [];
  orders.forEach(o => (o.items || []).forEach(i => {
    n++;
    if (o.sellerType === 'winery') {
      /* Producer → distributor: the wine must be the seller's own and
         the two must be partners. */
      if (i.winery && i.winery !== o.seller)
        faults.push(o.id + ': ' + o.seller + ' sells "' + i.wine + '", credited to ' + i.winery);
      if (!R.partnered(o.seller, o.buyer))
        faults.push(o.id + ': no partnership ' + o.seller + ' ↔ ' + o.buyer);
      return;
    }
    if (o.sellerType !== 'distributor') return;
    chainFaults(R, o.seller, i.wine, o.buyer).forEach(f => faults.push(o.id + ': ' + f));
    /* And the line's own producer field must agree with the book —
       two answers to "whose wine is this" is the drift this repo has
       paid for twice. */
    const inBook = R.producerOf(o.seller, i.wine);
    if (inBook && i.winery && i.winery !== inBook)
      faults.push(o.id + ': the line says ' + i.winery + ', the book says ' + inBook + ' for "' + i.wine + '"');
  }));
  checked += n; surfaces.push('order lines:' + n);
  if (!n) bad('no order lines found at all — the check is broken, not the data');
  else if (faults.length) bad(faults.length + ' of ' + n + ' order lines have no chain behind them: ' + faults.slice(0, 4).join(' · '));
  else ok(n + ' order lines across ' + orders.length + ' orders, every chain intact');
}

/* ── 3. Offers, deals, promo conditions — the delayed break ──────
   A promise over a wine outside your own book fires the moment
   somebody accepts it: orderItem() would have to invent a producer,
   and goods would move from a house you have no relation with. Same
   gap as a sale, only later. */
console.log('\n── nothing is advertised, discounted or promised that the book does not hold');
{
  if (R.distributors.length !== 1) {
    bad('there are now ' + R.distributors.length + ' distributors with a portfolio, and offers/deals/promo ' +
        'materials carry no owner field — give them one before this section can mean anything');
  }
  const dist = R.distributors[0];
  const named = [];
  J('exclusiveOffers').forEach(o => { if (o.wineName) named.push(['Exclusive Offer', o.wineName]); });
  J('exclusiveDeals').forEach(d => (d.wineNames || [d.wineName]).forEach(x => { if (x) named.push(['Exclusive Deal', x]); }));
  J('promoMaterials').forEach(m => { if (m.wineName) named.push(['Promo Material', m.wineName]); });

  const faults = [];
  named.forEach(([kind, wine]) => {
    chainFaults(R, dist, wine, null).forEach(f => faults.push(kind + ' "' + wine + '": ' + f));
  });
  checked += named.length; surfaces.push('commercial records:' + named.length);
  if (!named.length) bad('no offers, deals or promo materials name a wine — this section proves nothing');
  else if (faults.length) bad(faults.length + ' of ' + named.length + ' commercial records name a wine outside the book: ' + faults.slice(0, 3).join(' · '));
  else ok(named.length + ' offers, deals and promo conditions, every wine in ' + dist + "'s book");
}

/* ── 4. The buyers' own lists, both roles ────────────────────────
   Restaurant and Retail sit in the same position in the model (A3),
   and the break today hit the RETAILER — so both are checked, not the
   one that happens to be on screen. */
console.log('\n── every wine on a buyer list has all four links');
{
  const LISTS = [
    { role: 'restaurant', me: 'Bistro Laurent',  list: 'rCurrentWineList' },
    { role: 'retail',     me: 'Weinhaus Müller', list: 'tCurrentWineSelection' }
  ];
  let n = 0;
  const faults = [];
  LISTS.forEach(({ role, me, list }) => {
    const dists = distributorsOf(R, me);
    if (!dists.length) return faults.push(role + ' has no distributor partnership at all');
    J(list).forEach(wine => {
      n++;
      /* Intact through ANY of this buyer's distributors. With one it
         reads the same; with two it stops inventing a break. */
      const perDist = dists.map(d => chainFaults(R, d, wine.name, me));
      if (perDist.every(f => f.length))
        perDist[0].forEach(f => faults.push(role + ' "' + wine.name + '": ' + f));
      const carrier = dists.find(d => R.carries(d, wine.name));
      const inBook = carrier && R.producerOf(carrier, wine.name);
      if (inBook && wine.winery !== inBook)
        faults.push(role + ': list says ' + wine.winery + ', book says ' + inBook + ' for "' + wine.name + '"');
    });
  });
  checked += n; surfaces.push('buyer list rows:' + n);
  if (!n) bad('both buyer lists are empty — this section proves nothing');
  else if (faults.length) bad(faults.length + ' of ' + n + ' list rows break the chain: ' + faults.slice(0, 3).join(' · '));
  else ok(n + ' rows across both buyer lists, every chain intact');
}

/* ── 5. The picker cannot offer a way out ────────────────────────
   The list check above says what IS there; this says what could be
   put there. A buyer who cannot choose a wine outside the book cannot
   break the chain by choosing — which is the whole reason the pickers
   were pointed at the portfolio. */
console.log('\n── the pickers offer nothing the distributor does not carry');
{
  const PICKERS = [
    { role: 'restaurant', render: 'renderWinePickerR', el: 'r-aw-pick-list', me: 'Bistro Laurent' },
    { role: 'retail',     render: 'renderWinePickerT', el: 't-aw-pick-list', me: 'Weinhaus Müller' }
  ];
  let n = 0;
  const faults = [];
  PICKERS.forEach(({ role, render, el, me }) => {
    try { w.eval(render + '()'); } catch (e) { return faults.push(role + ': the picker threw — ' + e.message); }
    const box = w.document.getElementById(el);
    if (!box) return faults.push(role + ': no picker list element');
    const names = [...box.querySelectorAll('.aw-pick-name')]
      .map(e => e.childNodes[0].textContent.trim());
    if (!names.length) return faults.push(role + ': the picker offered nothing, so it cannot be checked');
    const dists = distributorsOf(R, me);
    names.forEach(name => {
      n++;
      if (!dists.some(d => R.carries(d, name)))
        faults.push(role + ' is offered "' + name + '", which none of its distributors (' + dists.join(', ') + ') carries');
    });
  });
  checked += n; surfaces.push('picker rows:' + n);
  if (!n) bad('neither picker offered anything — this section proves nothing');
  else if (faults.length) bad(faults.length + ' of ' + n + ' offered wines are outside the book: ' + faults.slice(0, 3).join(' · '));
  else ok(n + ' picker rows across both roles, all inside the book');
}

/* ── 6. What this run actually covered ───────────────────────────
   Same rule as assertISO and the stamp check: a check that cannot say
   what it examined is indistinguishable from one that examined
   nothing. Zero is a failure. */
console.log('\n── scope');
if (!checked) bad('the chain check examined NOTHING — every surface came back empty');
else ok(checked + ' wine references checked across ' + surfaces.length + ' surfaces — ' + surfaces.join(' · '));

/* ── 7. Counter-check: each break must turn this file red ────────── */
console.log('\n── counter-check: the breaks this file was written for');
{
  const cases = [
    /* The one that actually shipped, restored exactly. */
    { name: 'Château Belrieu loses its partnership again',
      from: "  { distributor:'Hawesko GmbH', partner:'Château Belrieu', at:'2026-06-30', activatedBy:'Bottle Lobby' },",
      to:   '',
      check: g => {
        const r = chainReader(g);
        const orders = JSON.parse(g.eval('JSON.stringify(orders)'));
        return orders.some(o => o.sellerType === 'distributor' &&
          (o.items || []).some(i => chainFaults(r, o.seller, i.wine, o.buyer).length));
      },
      says: 'section 2 catches 156 bottles sold with no relation behind them' },

    { name: 'a wine is offered that the distributor does not carry',
      /* Anchored on the fields the mutation is about, not on the start
         of the row: a row gains a field now and then — `id` did in the
         product-key pass — and an anchor that spans the opening brace
         turns into a missed target rather than a finding. */
      from: "winery:'Henri Dubois Domaine', name:'Pouilly-Fumé', vintage:2023, ownLabel:false,",
      to:   "winery:'Henri Dubois Domaine', name:'Pouilly-Fumé NOT CARRIED', vintage:2023, ownLabel:false,",
      check: g => {
        const r = chainReader(g);
        const offers = JSON.parse(g.eval('JSON.stringify(exclusiveOffers)'));
        return offers.some(o => o.wineName && chainFaults(r, r.distributors[0], o.wineName, null).length);
      },
      says: 'section 3 catches an Exclusive Offer over a wine outside the book' },

    { name: 'the portfolio takes a wine from a house it does not partner with',
      from: "winery:'Cantina Rossi', name:'Baglio Rosso', vintage:2021, ownLabel:false,",
      to:   "winery:'Osteria Marconi', name:'Baglio Rosso', vintage:2021, ownLabel:false,",
      check: g => {
        const r = chainReader(g);
        return (r.books[r.distributors[0]] || []).some(x =>
          r.types[x.winery] !== 'winery' || !r.partnered(r.distributors[0], x.winery));
      },
      says: 'section 1 catches A6 being broken in the book itself' },

    { name: 'the picker reads the producers\' pool again',
      from: "  const book = dist ? portfolioOf(dist) : null;\n  if (!book) {\n    list.innerHTML = '<div class=\"aw-empty\">No active distributor partnership yet.<br>Send a request from a distributor\\'s public profile — once accepted and confirmed, their wine portfolio appears here.</div>';\n    return;\n  }\n  const term = (search || '').toLowerCase();\n  const filtered = book.filter(w => !term || w.name.toLowerCase().includes(term) || w.winery.toLowerCase().includes(term));\n  if (!filtered.length) {\n    list.innerHTML = '<div class=\"aw-empty\">No wines match your search.</div>';\n    return;\n  }\n  const groups = {};\n  filtered.forEach(w => { (groups[w.winery] = groups[w.winery] || []).push(w); });\n  list.innerHTML = Object.keys(groups).sort().map(winery => `\n    <div class=\"aw-pick-group\">${winery}</div>\n    ${groups[winery].map(w => {\n      const taken = rCurrentWineList.some(cw => cw.winery === w.winery && cw.name === w.name);",
      to:   "  const book = partnerWinesPool;\n  if (!book) {\n    list.innerHTML = '<div class=\"aw-empty\">No active distributor partnership yet.<br>Send a request from a distributor\\'s public profile — once accepted and confirmed, their wine portfolio appears here.</div>';\n    return;\n  }\n  const term = (search || '').toLowerCase();\n  const filtered = book.filter(w => !term || w.name.toLowerCase().includes(term) || w.winery.toLowerCase().includes(term));\n  if (!filtered.length) {\n    list.innerHTML = '<div class=\"aw-empty\">No wines match your search.</div>';\n    return;\n  }\n  const groups = {};\n  filtered.forEach(w => { (groups[w.winery] = groups[w.winery] || []).push(w); });\n  list.innerHTML = Object.keys(groups).sort().map(winery => `\n    <div class=\"aw-pick-group\">${winery}</div>\n    ${groups[winery].map(w => {\n      const taken = rCurrentWineList.some(cw => cw.winery === w.winery && cw.name === w.name);",
      check: g => {
        const r = chainReader(g);
        try { g.eval('renderWinePickerR()'); } catch (e) { return true; }
        const box = g.document.getElementById('r-aw-pick-list');
        const names = [...box.querySelectorAll('.aw-pick-name')].map(e => e.childNodes[0].textContent.trim());
        return names.some(n => !r.carries('Hawesko GmbH', n));
      },
      says: 'section 5 catches a buyer being offered what the PRODUCERS have, not what the distributor carries' }
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
