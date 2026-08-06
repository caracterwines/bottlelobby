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
  /* Every product row, re-derived here from the books the page
     declares — the order lines name a key now, and a check that asked
     wineByRef() would be asking the very function it stands over. */
  const products = {};
  ['partnerWinesPool', 'currentWinePortfolio', 'rCurrentWineList', 'tCurrentWineSelection']
    .forEach(n => { try { J(n).forEach(r => { if (r.id && !products[r.id]) products[r.id] = r; }); } catch (e) {} });

  return {
    types,
    parts,
    books,
    products,
    product: ref => products[ref] || null,
    /* A label for a finding. An opaque key buys stability; the price
       is paid here, where somebody has to read the message. */
    label: ref => (products[ref] ? products[ref].name + ' ' + products[ref].vintage : String(ref)),
    distributors: Object.keys(books),
    partnered: (a, b) => parts.some(p => (p.distributor === a && p.partner === b) ||
                                         (p.distributor === b && p.partner === a)),
    /* Takes a key or a name: the commercial records still name names
       until pass 3c, and the order lines already name keys. */
    carries: (dist, ref) => (books[dist] || []).some(x => x.name === ref || x.id === ref),
    producerOf: (dist, ref) => ((books[dist] || []).find(x => x.name === ref || x.id === ref) || {}).winery
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
function chainFaults(r, dist, ref, buyer) {
  const out = [];
  const wine = r.label(ref);
  if (buyer && !r.partnered(dist, buyer)) out.push('no partnership ' + dist + ' ↔ ' + buyer);
  if (!r.carries(dist, ref)) return out.concat(dist + ' does not carry "' + wine + '"');
  const prod = r.producerOf(dist, ref);
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
    /* THE DRIFT CHECK THAT USED TO LIVE HERE IS GONE, and its removal
       is the finding rather than a loosening. A line carried `wine`
       and `winery` as strings, so it could name a producer the
       seller's book disagreed with, and this file had to compare the
       two answers. A line names a product now (invariant 2), so there
       is only one answer and the contradiction is unrepresentable.
       What replaces it is the assertion below that the copy stays
       gone — if the strings come back, so does the drift. */
    const p = R.product(i.productId);
    if (!p) {
      faults.push(o.id + ': line references "' + i.productId + '", which is in no book');
      return;
    }
    if (o.sellerType === 'winery') {
      if (p.winery !== o.seller)
        faults.push(o.id + ': ' + o.seller + ' sells "' + R.label(i.productId) + '", which is ' + p.winery + "'s");
      if (!R.partnered(o.seller, o.buyer))
        faults.push(o.id + ': no partnership ' + o.seller + ' ↔ ' + o.buyer);
      return;
    }
    if (o.sellerType !== 'distributor') return;
    chainFaults(R, o.seller, i.productId, o.buyer).forEach(f => faults.push(o.id + ': ' + f));
  }));

  /* The copy is gone and has to stay gone. */
  const copies = [];
  orders.forEach(o => (o.items || []).forEach(i => {
    if ('wine' in i)   copies.push(o.id + '.wine');
    if ('winery' in i) copies.push(o.id + '.winery');
  }));
  if (copies.length)
    bad(copies.length + ' order line field(s) copy product content back onto the line: ' +
        copies.slice(0, 4).join(' · ') + ' — invariant 2, and the producer drift comes back with it');
  else
    ok('no order line carries a product name or a producer — both are read through the key');
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
  /* They name a product key since 3c. Read here as a key OR a name,
     because this file stands over the chain and not over the pass: a
     record that went back to a name has to be checked, not skipped. */
  J('exclusiveOffers').forEach(o => { const x = o.productId || o.wineName; if (x) named.push(['Exclusive Offer', x]); });
  J('exclusiveDeals').forEach(d => (d.productIds || d.wineNames || [d.wineName]).forEach(x => { if (x) named.push(['Exclusive Deal', x]); }));
  J('promoMaterials').forEach(m => { const x = m.productId || m.wineName; if (x) named.push(['Promo Material', x]); });

  const faults = [];
  named.forEach(([kind, wine]) => {
    chainFaults(R, dist, wine, null).forEach(f => faults.push(kind + ' "' + R.label(wine) + '": ' + f));
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

/* ── 6. Distributor → distributor (A3 "Where a distributor sources") ─
   The route A8 has named since it was written and A17.9b describes in
   full: A sells on an ordinary wine he lawfully carries, B lists it
   himself. Four things have to be true at once, and the fourth is the
   one that decides whether the chain rule survived the addition:

     (a) it is ADMISSIBLE — partnership and listing are all it needs,
         and chainFaults() says "no partnership" about nothing
     (b) it needs NO A17 MARKET GRANT — ownLabelOrderRight() answers
         null for an ordinary product, and null is silence, not consent
     (c) B carries the SAME PRODUCT RECORD — one productId, two
         listings, two prices, and no wine content on either row
     (d) the PRODUCER is still the winery and B's SELLER is A — five
         facts that must not collapse into one (A17.9b, invariant 2)

   Every one of them is asked of the data rather than of a sentence,
   and the two mutations in section 7 put the removed guard back in its
   shipped shape to prove that (a) and the deal exclusion can fail. */
console.log('\n── the distributor→distributor route: ordinary trade, ordinary listing');
{
  const askIn = (win, expr) => JSON.parse(win.eval('JSON.stringify(' + expr + ')') || 'null');
  const ask = expr => askIn(w, expr);
  const S = v => JSON.stringify(v);

  const dd = J('orders').filter(o => o.sellerType === 'distributor' && o.buyerType === 'distributor');
  if (!dd.length) {
    bad('no distributor→distributor order in the data — A3\'s second sourcing route is described and never shown');
  } else {
    const o = dd[0];
    const A = o.seller, B = o.buyer;
    const REF = (o.items[0] || {}).productId;
    checked += (o.items || []).length; surfaces.push('D→D order lines:' + (o.items || []).length);

    /* (a) ADMISSIBLE. The same reader every other section uses, so
       this route is judged by the chain rule itself and not by a
       second one written for it. */
    const faults = (o.items || []).reduce((all, i) => all.concat(chainFaults(R, A, i.productId, B)), []);
    if (faults.length) bad(o.id + ' (' + A + ' → ' + B + ') has no chain behind it: ' + faults.join(' · '));
    else if (!R.partnered(A, B)) bad('the two distributors are not partners, so the green above says nothing');
    else ok(o.id + ': ' + A + ' → ' + B + ' is intact — an active partnership, the wine in the seller\'s book, no "no partnership" anywhere');

    /* (b) NO GRANT REQUIRED. Two halves, because either alone would
       pass for the wrong reason: with the shipped fixtures there is no
       project at all, so a null answer proves only that the function
       ran. The second window gives A17 a live project and three grants
       on ANOTHER product — the machinery answers there, and still says
       nothing about this one. */
    const right = ask('ownLabelOrderRight(' + S(B) + ', ' + S(A) + ', ' + S(REF) + ', ' +
      S({ country:'Italy', city:'Milano', channel:'wholesale', intermediary:B }) + ')');
    const grants = J('marketGrants');
    if (right !== null) bad('ownLabelOrderRight() has an opinion about an ordinary wine: ' + JSON.stringify(right));
    else if (grants.length) bad('marketGrants is no longer empty — this half has to be re-measured, not assumed');
    else ok('ownLabelOrderRight() answers null for the ordinary wine, and the chain is green with zero market grants');

    {
      const g = build();
      g.eval('ownLabelProjects.push(' + S({ id:'OLP-T1', distributor:A, producer:'Cantina Rossi',
        creationType:'bespoke_new_wine', sourceWineId:null, developmentReferenceWineId:null,
        productId:'PRD-1022', stage:'gate2_approved', brandOwner:A,
        requestedAt:'2026-04-06', requestedBy:A }) + ')');
      g.eval('marketGrants.push(' + S({ id:'OLG-T1', projectId:'OLP-T1', countries:['Italy'],
        channels:['sub-distribution'], intermediaries:[B] }) + ')');
      const ctx = S({ country:'Italy', city:'Milano', channel:'sub-distribution', intermediary:B });
      const live = askIn(g, 'ownLabelOrderRight(' + S(B) + ', ' + S(A) + ', "PRD-1022", ' + ctx + ')');
      const ordinary = askIn(g, 'ownLabelOrderRight(' + S(B) + ', ' + S(A) + ', ' + S(REF) + ', ' + ctx + ')');
      const rDD = chainReader(g);
      const stillGreen = !(o.items || []).some(i => chainFaults(rDD, A, i.productId, B).length);
      if (!live) bad('A17 answered null for an own-label product too — the null below proves nothing');
      else if (ordinary !== null) bad('with grants in the page the ordinary wine is judged after all: ' + JSON.stringify(ordinary));
      else if (!stillGreen) bad('the ordinary D→D order broke as soon as A17 had a project — the two must not touch');
      else ok('with a live project and a grant beside it, A17 answers for the own label (allowed=' + live.allowed +
              (live.rule ? ', ' + live.rule : '') + ') and still null for the ordinary wine');
    }

    /* (c) ONE PRODUCT, TWO LISTINGS. The key is (holder, productId),
       so the second holder is a row and never a second wine. */
    const la = ask('listingOf(' + S(A) + ', ' + S(REF) + ')');
    const lb = ask('listingOf(' + S(B) + ', ' + S(REF) + ')');
    if (!la || !lb) bad('the wine is not listed by both houses: ' + A + '=' + !!la + ', ' + B + '=' + !!lb);
    else if (la.productId !== lb.productId) bad('two productIds for one wine — that is a copy, not a listing');
    else if (la.tradePrice == null || lb.tradePrice == null || la.tradePrice === lb.tradePrice)
      bad('the two holders do not each carry their own price: ' + la.tradePrice + ' / ' + lb.tradePrice);
    else ok('one productId (' + REF + '), two listings, two prices — ' + A + ' ' + la.tradePrice + ' · ' + B + ' ' + lb.tradePrice);

    /* No wine content anywhere on a listing row. Asserted over ALL of
       them rather than over the two above: the defect this forbids
       arrives by somebody copying a name onto the row they are adding,
       and that row is by definition the new one. */
    const CONTENT = ['name', 'wine', 'winery', 'producer', 'vintage', 'url', 'type', 'origin'];
    const copies = [];
    J('listings').forEach(l => CONTENT.forEach(k => { if (k in l) copies.push(l.holder + '.' + k); }));
    if (copies.length) bad(copies.length + ' listing field(s) copy wine content onto the row: ' + copies.slice(0, 4).join(' · '));
    else ok(J('listings').length + ' listing rows, not one naming a wine, a producer or a vintage');

    /* (d) THE FIVE FACTS STAY APART. The producer is the winery, the
       seller is A, and the frozen line says the same — an accepted
       order carries its snapshot (A15.2b), and that snapshot is what a
       document prints. */
    const prod = (R.product(REF) || {}).winery;
    const snap = ask('normalizeOrder(orders.find(function (x) { return x.id === ' + S(o.id) + '; })).items[0].snapshot');
    if (!prod) bad('the ordered wine names no producer in any book');
    else if (R.types[prod] !== 'winery') bad('"' + R.label(REF) + '" is credited to ' + prod + ', which is not a producer');
    else if (!snap) bad(o.id + ' is ' + o.stage + ' and carries no frozen line — the document would read the product instead');
    else if (snap.producer !== prod) bad('the frozen line names ' + snap.producer + ' where the catalogue names ' + prod);
    else if (o.seller !== A || o.sellerType !== 'distributor') bad('the seller of the A→B order is not a distributor');
    else if (R.partnered(B, prod)) bad(B + ' and ' + prod + ' are partners — the A→B order must create no relation with the winery (A3 point 6)');
    else ok('producer ' + prod + ' (catalogue and frozen line), seller ' + A + ', and no relation whatever between ' + B + ' and the winery');

    /* THE DEAL EXCLUSION, on the line itself and then on state this
       check builds (A9, A17.9a). Free goods and deal discounts are a
       customer incentive; between two distributors they have no
       meaning. The shipped fixture's own answer is empty for a second
       reason — no deal names that wine — so the second window makes
       the line a deal line and asks the same question twice, changing
       nothing but the buyer's type. */
    const onTheRow = ask('dealFreeGoodsFor(normalizeOrder(orders.find(function (x) { return x.id === ' + S(o.id) + '; })))');
    if (onTheRow.length) bad(o.id + ' offers ' + onTheRow.length + ' deal entitlement(s) to a distributor');
    else ok(o.id + ': no deal free goods and no deal discount on a distributor→distributor line');

    {
      const g = build();
      const DEAL_LINE = "(function () { var o = orders.find(function (x) { return x.id === " + S(o.id) + "; });" +
        " o.items = [orderItemRaw('PRD-1008', 240, 13.40, 2021)]; normalizeOrder(o); return o; })()";
      const asDistributor = askIn(g, 'dealFreeGoodsFor(' + DEAL_LINE + ').length');
      g.eval("orders.find(function (x) { return x.id === " + S(o.id) + "; }).buyerType = 'retail'");
      const asCustomer = askIn(g, 'dealFreeGoodsFor(orders.find(function (x) { return x.id === ' + S(o.id) + '; })).length');
      if (!asCustomer) bad('the deal did not fire for a customer either — the state this check built is wrong, so it proves nothing');
      else if (asDistributor) bad('the same line offers ' + asDistributor + ' entitlement(s) to a distributor buyer');
      else ok('one line, one deal, two buyers: ' + asCustomer + ' entitlement(s) for a customer, none for a distributor');
    }
  }
}

/* ── 7. What this run actually covered ───────────────────────────
   Same rule as assertISO and the stamp check: a check that cannot say
   what it examined is indistinguishable from one that examined
   nothing. Zero is a failure. */
console.log('\n── scope');
if (!checked) bad('the chain check examined NOTHING — every surface came back empty');
else ok(checked + ' wine references checked across ' + surfaces.length + ' surfaces — ' + surfaces.join(' · '));

/* ── 8. Counter-check: each break must turn this file red ────────── */
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
          (o.items || []).some(i => chainFaults(r, o.seller, i.productId, o.buyer).length));
      },
      says: 'section 2 catches 156 bottles sold with no relation behind them' },

    { name: 'a wine is offered that the distributor does not carry',
      /* Anchored on the fields the mutation is about, not on the start
         of the row: a row gains a field now and then — `id` did in the
         product-key pass — and an anchor that spans the opening brace
         turns into a missed target rather than a finding. */
      /* The offer names a KEY now, so a renamed row no longer breaks
         the join — the book simply stops carrying that product. */
      /* PINNED TO THE BOOK, not to the picker pool. The row used to
         end `ownLabel:false,` and that alone told the two apart; once
         the flag moved onto the listing the shorter prefix matched
         partnerWinesPool first and the mutation stopped landing where
         it was aimed. The continuation line is what distinguishes them
         now — the pool keeps a `note` between type and origin. */
      from: "{ id:'PRD-1015', winery:'Henri Dubois Domaine', name:'Pouilly-Fumé', vintage:2023,\n    type:'White', origin:",
      to:   "{ id:'PRD-9015', winery:'Henri Dubois Domaine', name:'Pouilly-Fumé', vintage:2023,\n    type:'White', origin:",
      check: g => {
        const r = chainReader(g);
        const offers = JSON.parse(g.eval('JSON.stringify(exclusiveOffers)'));
        return offers.some(o => o.productId && chainFaults(r, r.distributors[0], o.productId, null).length);
      },
      says: 'section 3 catches an Exclusive Offer over a wine outside the book' },

    { name: 'the portfolio takes a wine from a house it does not partner with',
      /* Pinned to the book for the same reason as above. */
      from: "winery:'Cantina Rossi', name:'Baglio Rosso', vintage:2021,\n    type:'Red', origin:",
      to:   "winery:'Osteria Marconi', name:'Baglio Rosso', vintage:2021,\n    type:'Red', origin:",
      check: g => {
        const r = chainReader(g);
        return (r.books[r.distributors[0]] || []).some(x =>
          r.types[x.winery] !== 'winery' || !r.partnered(r.distributors[0], x.winery));
      },
      says: 'section 1 catches A6 being broken in the book itself' },

    { name: 'the picker reads the producers\' pool again',
      from: "  const book = dist ? portfolioOf(dist) : null;\n  if (!book) {\n    list.innerHTML = '<div class=\"aw-empty\">No active distributor partnership yet.<br>Send a request from a distributor\\'s public profile — once accepted and confirmed, their wine portfolio appears here.</div>';\n    return;\n  }\n  const term = (search || '').toLowerCase();\n  const filtered = book.filter(w => !term || w.name.toLowerCase().includes(term) || w.winery.toLowerCase().includes(term));\n  if (!filtered.length) {\n    list.innerHTML = '<div class=\"aw-empty\">No wines match your search.</div>';\n    return;\n  }\n  const groups = {};\n  filtered.forEach(w => { (groups[w.winery] = groups[w.winery] || []).push(w); });\n  list.innerHTML = Object.keys(groups).sort().map(winery => `\n    <div class=\"aw-pick-group\">${winery}</div>\n    ${groups[winery].map(w => {\n      const taken = !!wineByRef(w, rCurrentWineList);",
      to:   "  const book = partnerWinesPool;\n  if (!book) {\n    list.innerHTML = '<div class=\"aw-empty\">No active distributor partnership yet.<br>Send a request from a distributor\\'s public profile — once accepted and confirmed, their wine portfolio appears here.</div>';\n    return;\n  }\n  const term = (search || '').toLowerCase();\n  const filtered = book.filter(w => !term || w.name.toLowerCase().includes(term) || w.winery.toLowerCase().includes(term));\n  if (!filtered.length) {\n    list.innerHTML = '<div class=\"aw-empty\">No wines match your search.</div>';\n    return;\n  }\n  const groups = {};\n  filtered.forEach(w => { (groups[w.winery] = groups[w.winery] || []).push(w); });\n  list.innerHTML = Object.keys(groups).sort().map(winery => `\n    <div class=\"aw-pick-group\">${winery}</div>\n    ${groups[winery].map(w => {\n      const taken = !!wineByRef(w, rCurrentWineList);",
      check: g => {
        const r = chainReader(g);
        try { g.eval('renderWinePickerR()'); } catch (e) { return true; }
        const box = g.document.getElementById('r-aw-pick-list');
        const names = [...box.querySelectorAll('.aw-pick-name')].map(e => e.childNodes[0].textContent.trim());
        return names.some(n => !r.carries('Hawesko GmbH', n));
      },
      says: 'section 5 catches a buyer being offered what the PRODUCERS have, not what the distributor carries' },

    /* The D→D route's own two. Both put a removed guard back in its
       SHIPPED shape rather than approximating it (C7): a milder
       symptom would certify the file against a defect it cannot see. */
    { name: 'the two distributors lose their partnership',
      from: "  { distributor:'Hawesko GmbH', partner:'Enoteca Milano Import Srl', at:'2026-05-19', activatedBy:'Bottle Lobby' }\n];",
      to:   "\n];",
      check: g => {
        const r = chainReader(g);
        return JSON.parse(g.eval('JSON.stringify(orders)'))
          .filter(o => o.sellerType === 'distributor' && o.buyerType === 'distributor')
          .some(o => (o.items || []).some(i => chainFaults(r, o.seller, i.productId, o.buyer)
            .some(f => /no partnership/.test(f))));
      },
      says: 'section 6(a) catches a distributor→distributor sale with no relation behind it' },

    { name: 'dealFreeGoodsFor() asks only about the seller again',
      from: "  if (o.sellerType !== 'distributor' || o.buyerType === 'distributor' ||\n      typeof exclusiveDeals === 'undefined') return [];",
      to:   "  if (o.sellerType !== 'distributor' ||\n      typeof exclusiveDeals === 'undefined') return [];",
      check: g => JSON.parse(g.eval(
        "JSON.stringify(dealFreeGoodsFor((function () {" +
        "  var o = orders.filter(function (x) { return x.sellerType === 'distributor' && x.buyerType === 'distributor'; })[0];" +
        "  o.items = [orderItemRaw('PRD-1008', 240, 13.40, 2021)]; normalizeOrder(o); return o; })()).length)")) > 0,
      says: 'section 6 catches deal free goods being offered between two distributors' }
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
