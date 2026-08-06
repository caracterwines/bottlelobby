/* ═══════════════════════════════════════════════════════════════════
   MARKET GRANTS, THE FEE CHAIN AND THE PRIMARY OWN-LABEL LISTING
   (A17.9a, A17.9b, A17.10, A17.12 — OL-14, OL-15, MG-1, MG-2)

   WHAT THIS FILE OWNS AND WHAT IT NOW READS FROM THE PAGE.
   It used to carry two whole projects of its own, because the page's
   `ownLabelProjects` was empty: no bridged listing had a delivered order
   from its producing winery, so a project row in the page would have
   answered `false` for all six and "My Labels" would have rendered
   nothing. Both of those facts are gone — the page has real projects,
   real products and a delivered first order, and the six bridged wines
   turned out not to be own labels at all (D41).

   So the projects come from the page now, exactly as the A ↔ B
   partnership already did in §0, and for the same reason: two rows for
   one relation is the drift these records were consolidated to end. A
   duplicate project on the same `productId` would be worse than
   drift — `ownLabelProjectOf()` finds the first match, so the harness's
   copy would be silently shadowed and every check below would be
   measuring the page while claiming to measure a fixture.

   WHAT IS STILL THIS FILE'S OWN, and every piece of it is named:
     · the GRANTS, because §1 has to exercise all seven A17.9a
       dimensions and no real agreement would carry all seven
     · the DOWNSTREAM orders — A→B, B→restaurant, A→restaurant — which
       are the three rows of A17.10's fee table the page has no reason
       to hold
     · a delivered first order, seeded ONLY if the page has none yet, so
       this file works in the commit that introduces the derivation and
       in every commit after it without being edited twice

   THE TWO PROJECTS IT LEANS ON ARE THE TWO STATES A17 DISTINGUISHES:
   one past gate 2 with its first delivery confirmed, one past gate 2
   with the first order merely accepted. Section 2 needs both, and the
   page holds both because that is what the demo is for.
═══════════════════════════════════════════════════════════════════ */
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');
const { loadDashboard } = require('./load-dashboard');

let fail = 0;
const bad = m => { console.log('  ✗ ' + m); fail++; };
const ok  = m => console.log('  ✓ ' + m);

const SRC = fs.readFileSync(path.join(__dirname, '..', 'bottle-lobby-dashboard.html'), 'utf8');

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
  const win = dom.window;
  win.scrollTo = () => {}; win.confirm = () => true; win.showToast = () => {};
  if (errs.length) { console.log('SCRIPT ERRORS:\n' + errs.join('\n')); process.exit(1); }
  return win;
}

/* ── WHICH PROJECTS, READ FROM THE PAGE ──────────────────────────
   Named by the state they are in rather than by id, so a renumbering in
   the fixtures does not silently repoint the checks. If the page ever
   stops holding one of these two states, every section below says so
   instead of quietly examining nothing. */
function pageProjects(win) {
  return JSON.parse(win.eval('JSON.stringify(ownLabelProjects)'));
}

/* THE DIMENSION-COVERAGE GRANTS SIT ON A PROJECT ID OF THEIR OWN, and
   that is what keeps §1 a rules test. Between them these three exercise
   every dimension A17.9a names, which no real agreement would — and the
   moment they shared a project with the page's own grants, "which grant
   covers this supply" would have two candidates and §1 would be
   measuring the fixtures instead of the rule. `marketGrantsOf()` filters
   by id and needs no project row to exist, so the isolation costs
   nothing. */
const DIM_PROJECT = 'OLP-9001';

/* And this file's own rows carry an OLG-9 prefix throughout, so they can
   never be read as an agreement the page holds. */
function grantsFor(projectId) {
  return [
    { id:'OLG-9001', projectId:projectId, countries:['Germany'], channels:['gastronomy','retail'],
      validFrom:'2026-01-01', validUntil:'2026-12-31' },
    { id:'OLG-9002', projectId:projectId, countries:['Germany'], regions:['Nordrhein-Westfalen'],
      channels:['supermarket'], keyAccounts:['REWE Group'], maxBottles:24000 },
    { id:'OLG-9003', projectId:projectId, countries:['Italy'], cities:['Milano'], territories:['Lombardia Nord'],
      channels:['sub-distribution'], intermediaries:['Enoteca Milano Import Srl'],
      conditions:'Sub-distribution only under the Bottle Lobby platform binding (A17.10).' }
  ];
}

/* The downstream chain A17.14 says is missing. B is a real distributor
   in the demo with a real profile page.

   THE PARTNERSHIP IS NOT SEEDED HERE. This file used to push its own
   Hawesko ↔ Enoteca row, dated 15 Jun 2026; the D2D pass put the real
   one in the page, dated 19 May 2026, and a harness that kept pushing
   its copy would have run against TWO rows for one relation. It is
   asserted in §0 instead of created. */
const B = 'Enoteca Milano Import Srl';
function downstreamOrders(productId, vintage) {
  return [
    { id:'ORD-9001', placed:'2026-07-06', buyer:B, buyerType:'distributor',
      seller:'Hawesko GmbH', sellerType:'distributor', stage:'delivered',
      items:[{ productId:productId, qty:60, unit:9.40, vintage:vintage, batchOrLot:null }] },
    { id:'ORD-9002', placed:'2026-07-13', buyer:'Osteria Marconi', buyerType:'restaurant',
      seller:B, sellerType:'distributor', stage:'delivered',
      items:[{ productId:productId, qty:12, unit:14.20, vintage:vintage, batchOrLot:null }] },
    /* The fourth row of A17.10's fee table — A selling on to a
       restaurant of his own. Without it that line of the table would be
       asserted against an order that does not carry the wine, which is
       a check passing for the wrong reason. */
    { id:'ORD-9003', placed:'2026-07-20', buyer:'Bistro Laurent', buyerType:'restaurant',
      seller:'Hawesko GmbH', sellerType:'distributor', stage:'delivered',
      items:[{ productId:productId, qty:12, unit:13.80, vintage:vintage, batchOrLot:null }] }
  ];
}

/* ACTIVE is the project whose first delivery is confirmed; PENDING is
   the one whose first order is only accepted. Both are the page's.

   The seeding is deliberately CONDITIONAL: a delivered first order is
   pushed only where the page has none. In the commit that introduced
   this derivation the page's chains did not exist yet, and in every
   commit after it they do — one file, no second edit, and the check
   measures the same claim either way. What it must never do is push a
   SECOND delivered order beside a real one, because
   firstCommercialDeliveryOf() takes the earliest and the fixture would
   start deciding which delivery counts. */
let ACTIVE = null, PENDING = null;
function seed(win) {
  const prs = pageProjects(win).filter(p => p.productId);
  if (prs.length < 2) { console.log('  ✗ the page holds fewer than two own-label products — nothing below is founded'); process.exit(1); }
  /* Whichever already has a delivered first order is the active one; if
     neither has, the first becomes it by being given one. */
  ACTIVE  = prs.find(p => win.eval('firstCommercialDeliveryOf(' + JSON.stringify(p.productId) + ') !== null')) || prs[0];
  PENDING = prs.find(p => p.id !== ACTIVE.id);

  win.eval('marketGrants.push.apply(marketGrants, ' + JSON.stringify(grantsFor(DIM_PROJECT)) + ')');
  /* §5 needs a grant that ADMITS B downstream so the refusal it measures
     is MG-2 at the source and not MG-1 for want of coverage. Seeded only
     where the page has none — once Enoteca's real sub-distribution grant
     lands this becomes a no-op, exactly like the delivery above. */
  const dsCtx = { country:'Italy', city:'Milano', channel:'sub-distribution', intermediary:B };
  if (!win.eval('marketGrantCovering(' + JSON.stringify(ACTIVE.id) + ', ' + JSON.stringify(dsCtx) + ')'))
    win.eval('marketGrants.push(' + JSON.stringify({ id:'OLG-9004', projectId:ACTIVE.id,
      countries:['Italy'], cities:['Milano'], channels:['sub-distribution'],
      intermediaries:[B] }) + ')');
  const prod = JSON.parse(win.eval('JSON.stringify(wineByRef(' + JSON.stringify(ACTIVE.productId) + '))'));
  if (!win.eval('firstCommercialDeliveryOf(' + JSON.stringify(ACTIVE.productId) + ') !== null')) {
    win.eval('orders.push(' + JSON.stringify({
      id:'ORD-9000', placed:'2026-06-15', buyer:ACTIVE.distributor, buyerType:'distributor',
      seller:ACTIVE.producer, sellerType:'winery', stage:'delivered',
      items:[{ productId:ACTIVE.productId, qty:1200, unit:5.25, vintage:prod.vintage, batchOrLot:null }]
    }) + ')');
    /* A17.9: a delivered first order puts the product IN THE BOOK, and
       the book is two records — the portfolio row the distributor owns
       and the listing that says what he holds true about it. Seeding
       only the listing would leave the portfolio badge with nothing to
       draw, which is a fixture failing in a way that reads as a code
       failure. */
    win.eval('addListing(' + JSON.stringify(ACTIVE.distributor) + ', ' +
      JSON.stringify(ACTIVE.productId) + ', { tradePrice: 8.90, holderArticleNo: "HAW-OL-1" })');
    win.eval('(function (p) { if (!wineByRef(p.id, currentWinePortfolio)) currentWinePortfolio.push(' +
      '{ id:p.id, winery:p.winery, name:p.name, vintage:p.vintage, type:p.type, ' +
      'origin:p.origin, url:p.url }); })(wineByRef(' + JSON.stringify(ACTIVE.productId) + '))');
  }
  win.eval('orders.push.apply(orders, ' + JSON.stringify(downstreamOrders(ACTIVE.productId, prod.vintage)) + ')');
  win.eval("addListing(" + JSON.stringify(B) + ", " + JSON.stringify(ACTIVE.productId) +
    ", { tradePrice: 12.60, holderArticleNo: 'EMI-OL-1' })");
  /* B ↔ THE PRODUCING WINERY, and it is seeded on purpose. §5 has to
     show that MG-2 is what refuses B at the source and NOT a missing
     partnership — a refusal that would have happened anyway proves
     nothing about the rule being tested. The page holds Enoteca ↔
     Cantina Rossi for its own reasons and used to supply this by
     accident; once the checks follow whichever project is active, the
     precondition has to be stated rather than inherited. */
  if (!win.eval('arePartners(' + JSON.stringify(B) + ', ' + JSON.stringify(ACTIVE.producer) + ')'))
    win.eval('partnerships.push(' + JSON.stringify({ distributor: B, partner: ACTIVE.producer,
      at: '2026-05-11', activatedBy: 'Bottle Lobby' }) + ')');
  return win;
}
const fresh = patch => { const w = build(patch); return w ? seed(w) : null; };

/* Source lines with comments blanked out, line numbers preserved —
   the same reader `listings.js` uses, and for the same reason: a scan
   that cannot tell code from the paragraph describing it reports the
   paragraph. */
function codeLines(src) {
  const out = [];
  let inBlock = false;
  src.split('\n').forEach((raw, i) => {
    let line = '', j = 0;
    if (!inBlock && raw.trim().indexOf('//') === 0) { out.push({ line: '', n: i + 1 }); return; }
    while (j < raw.length) {
      const two = raw.substr(j, 2);
      if (!inBlock && two === '/*') { inBlock = true; j += 2; continue; }
      if (inBlock && two === '*/') { inBlock = false; j += 2; continue; }
      if (!inBlock) line += raw[j];
      j++;
    }
    out.push({ line: line, n: i + 1 });
  });
  return out;
}
/* A function's own code, comments removed. Returns '' when the
   function is not there, so a caller can say so instead of passing. */
function bodyOf(src, name) {
  const code = codeLines(src).map(x => x.line).join('\n');
  const start = code.indexOf('function ' + name + '(');
  if (start === -1) return '';
  const end = code.indexOf('\n}', start);
  return end === -1 ? '' : code.slice(start, end + 2);
}

const w = fresh();
const ask = (win, expr) => JSON.parse(win.eval('JSON.stringify(' + expr + ')') || 'null');
const S = v => JSON.stringify(v);

/* ── 0. The precondition this file used to create for itself ─────
   Every downstream check below assumes an active A ↔ B partnership.
   It is now the page's row, so it is read rather than pushed — and a
   single row, because two would be the drift `partnerships` exists to
   prevent. */
console.log('\n── the A ↔ B partnership comes from the page, exactly once');
{
  const rows = ask(w, 'partnerships').filter(p =>
    (p.distributor === 'Hawesko GmbH' && p.partner === B) ||
    (p.distributor === B && p.partner === 'Hawesko GmbH'));
  if (!rows.length) bad('the page carries no Hawesko ↔ ' + B + ' partnership — every downstream check below is unfounded');
  else if (rows.length > 1) bad(rows.length + ' rows for one relation: ' + rows.map(r => r.at).join(' · '));
  else ok('one Hawesko ↔ ' + B + ' row, active since ' + rows[0].at + ', activated by ' + rows[0].activatedBy);
}

/* ── 1. A GRANT IS A COMBINABLE RECORD (A17.9a) ─────────────────── */
console.log('\n── every dimension is optional, and they combine');
{
  const MINE = grantsFor(DIM_PROJECT);
  const grants = ask(w, 'marketGrantsOf(' + S(DIM_PROJECT) + ')');
  if (grants.length !== MINE.length) bad('the grants did not reach the project: ' + grants.length + ' of ' + MINE.length);
  else ok(grants.length + ' grants on OLP-1, read back through marketGrantsOf()');

  /* FIXTURE REACHABILITY (C7). A rule can hold while the fixtures only
     ever exercise one dimension of it, and then the other six are
     untested for the wrong reason. */
  const DIMENSIONS = {
    geography:     g => g.countries || g.regions || g.cities || g.territories,
    channel:       g => g.channels,
    keyAccounts:   g => g.keyAccounts,
    intermediaries:g => g.intermediaries,
    validity:      g => g.validFrom || g.validUntil,
    volume:        g => g.maxBottles != null,
    conditions:    g => g.conditions
  };
  const unused = Object.keys(DIMENSIONS).filter(d => !grants.some(DIMENSIONS[d]));
  if (unused.length) bad('no grant exercises ' + unused.join(', ') + ' — A17.9a names ' +
    Object.keys(DIMENSIONS).length + ' dimensions and this file would prove nothing about those');
  else ok('all ' + Object.keys(DIMENSIONS).length + ' A17.9a dimensions are exercised by at least one grant');

  const CASES = [
    { ctx:{ country:'Germany', channel:'gastronomy', at:'2026-08-06' }, grant:'OLG-9001', why:'country and channel named, inside the period' },
    { ctx:{ country:'Germany', channel:'retail', at:'2026-08-06' },     grant:'OLG-9001', why:'the second channel of the same grant' },
    { ctx:{ country:'Germany', region:'Nordrhein-Westfalen', channel:'supermarket', keyAccount:'REWE Group', bottles:12000 },
      grant:'OLG-9002', why:'a supermarket grant for one region and one named chain' },
    { ctx:{ country:'Italy', city:'Milano', territory:'Lombardia Nord', channel:'sub-distribution', intermediary:B },
      grant:'OLG-9003', why:'sub-distribution through a named intermediary' },

    { ctx:{ country:'Austria', channel:'gastronomy', at:'2026-08-06' }, grant:null, why:'geography: a country no grant names' },
    { ctx:{ country:'Germany', channel:'e-commerce', at:'2026-08-06' }, grant:null, why:'channel: a channel no grant names' },
    { ctx:{ country:'Germany', region:'Nordrhein-Westfalen', channel:'supermarket', keyAccount:'Edeka', bottles:12000 },
      grant:null, why:'key account: the chain is not the one named' },
    { ctx:{ country:'Germany', region:'Nordrhein-Westfalen', channel:'supermarket', keyAccount:'REWE Group', bottles:30000 },
      grant:null, why:'volume: past the ceiling' },
    { ctx:{ country:'Germany', channel:'gastronomy', at:'2027-03-01' }, grant:null, why:'validity: after the period ends' },
    { ctx:{ country:'Italy', city:'Milano', territory:'Lombardia Nord', channel:'sub-distribution', intermediary:'Vinorama Nordic AB' },
      grant:null, why:'intermediaries: an agency the grant does not admit' },
    { ctx:{ country:'Germany', at:'2026-08-06' }, grant:null,
      why:'a named dimension with nothing to match is a no — the supply names no channel at all' }
  ];
  const faults = [];
  CASES.forEach(c => {
    const got = ask(w, 'marketGrantCovering(' + S(DIM_PROJECT) + ', ' + S(c.ctx) + ')');
    const id = got ? got.id : null;
    if (id !== c.grant) faults.push(c.why + ': got ' + (id || 'no grant') + ', expected ' + (c.grant || 'no grant'));
  });
  if (faults.length) bad(faults.length + ' of ' + CASES.length + ' coverage cases wrong: ' + faults.join(' · '));
  else ok(CASES.length + ' coverage cases, ' + CASES.filter(c => c.grant).length + ' admitted and ' +
    CASES.filter(c => !c.grant).length + ' refused, each for the dimension it is about');

  /* COMBINABLE means the rows stay separate. If one supply were
     covered by both, the grants would be one permission written twice
     and the whole shape would be a boolean again. */
  const a = ask(w, 'marketGrantsOf(' + S(DIM_PROJECT) + ').filter(g => marketGrantCovers(g, ' +
    S({ country:'Germany', region:'Nordrhein-Westfalen', channel:'supermarket', keyAccount:'REWE Group', bottles:12000 }) + ')).map(g => g.id)');
  const b = ask(w, 'marketGrantsOf(' + S(DIM_PROJECT) + ').filter(g => marketGrantCovers(g, ' +
    S({ country:'Germany', channel:'gastronomy', at:'2026-08-06' }) + ')).map(g => g.id)');
  if (a.length !== 1 || b.length !== 1 || a[0] === b[0])
    bad('two different supplies are admitted by ' + S(a) + ' and ' + S(b) +
        ' — the grants are not separate records');
  else ok('two supplies, two different grants (' + a[0] + ' and ' + b[0] + '); neither covers the other');
}

/* ── 2. OL-15 — THE PRIMARY OWN-LABEL LISTING ───────────────────── */
console.log('\n── own label on a listing: two conditions, no others');
{
  /* MEASURED, NOT ASSUMED: both conditions hold for the ACTIVE project out of the
     demo's own data. If the delivery ever moves, this says so. */
  const delivery = ask(w, 'firstCommercialDeliveryOf(' + S(ACTIVE.productId) + ')');
  if (!delivery) bad('no confirmed first delivery for ' + ACTIVE.productId + ' — this whole section rests on one');
  else ok('first commercial delivery of ' + ACTIVE.productId + ': ' + delivery.id + ' (' + delivery.seller + ' → ' +
    delivery.buyer + ', ' + delivery.placed + '), read from the orders rather than a flag');

  const primary = ask(w, 'ownLabelListingDerived(listingOf(' + S(ACTIVE.distributor) + ', ' + S(ACTIVE.productId) + '))');
  if (primary !== true) bad('the primary distributor\'s row does not derive as own label although both conditions hold');
  else ok('both conditions hold and the primary distributor\'s listing derives as own label');

  /* Condition 1 alone, taken away: the delivery is not confirmed. */
  {
    const win = fresh();
    win.eval('firstCommercialDeliveryOf(' + S(ACTIVE.productId) + ').stage = "shipped"');
    if (win.eval('ownLabelListingDerived(listingOf(' + S(ACTIVE.distributor) + ', ' + S(ACTIVE.productId) + '))') !== false)
      bad('a product still in transit derives as own label — a wine enters the book when it can honestly be promised on');
    else ok('unconfirmed delivery: the primary distributor\'s row stops deriving as own label');
  }

  /* THE COUNTER-CHECK THE SECOND CONDITION EXISTS FOR (A17.9b). B has
     his own first delivery of the same product and his own listing.
     On the first condition alone his row would badge itself an own
     label; he never becomes the primary own-label holder. */
  {
    const bDelivery = ask(w, 'orders.filter(o => o.buyer === ' + S(B) + " && o.stage === 'delivered' && " +
      'o.items.some(i => i.productId === ' + S(ACTIVE.productId) + ')).map(o => o.id)');
    const bListing = ask(w, 'listingOf(' + S(B) + ', ' + S(ACTIVE.productId) + ')');
    if (!bDelivery.length || !bListing)
      bad('the downstream holder has no delivered order or no listing — the counter-check would pass vacuously');
    else if (ask(w, 'ownLabelListingDerived(listingOf(' + S(B) + ', ' + S(ACTIVE.productId) + '))') !== false)
      bad('the downstream holder\'s row derives as own label — B never becomes the primary own-label holder');
    else ok('the downstream holder has a delivered order (' + bDelivery.join(', ') +
      ') and a listing of his own, and his row still derives as ordinary');
  }

  /* AND THE FIRST CONDITION IS REALLY ASKED. The other project past
     gate 2 has a product and no confirmed delivery — *created ≠
     carried*, which is the pair A17.0a exists to keep apart. Its
     primary distributor is the same house, so the only thing separating
     the two answers is the delivery. */
  {
    const l = ask(w, 'listingOf(' + S(PENDING.distributor) + ', ' + S(PENDING.productId) + ')');
    if (ask(w, 'firstCommercialDeliveryOf(' + S(PENDING.productId) + ')'))
      bad(PENDING.id + ' has a confirmed first delivery too — there is no undelivered project left to ' +
          'measure the first condition against');
    else if (ask(w, 'ownLabelListingDerived(' + (l ? 'listingOf(' + S(PENDING.distributor) + ', ' +
             S(PENDING.productId) + ')' : 'null') + ')') !== false)
      bad(PENDING.productId + ' derives as own label although no delivery of it is confirmed');
    else ok(PENDING.productId + ' exists, is past gate 2, is held by the same distributor and derives ' +
      'as false — the delivery is the only difference, and it is doing the work');
  }
}

/* ── 3. OL-14 — THE FEE ACCRUES ONCE, AT THE TOP OF THE CHAIN ───── */
console.log('\n── a fee event only where the seller is the producing winery');
{
  /* The first link is the page's own delivered order rather than a
     name typed here: whichever order carries the first delivery is by
     definition the one OL-14 must charge, and naming it by id would
     start a second answer to "which delivery counts". */
  const FIRST_DELIVERY = ask(w, 'firstCommercialDeliveryOf(' + S(ACTIVE.productId) + ')');
  if (!FIRST_DELIVERY) { bad('no first delivery — the fee chain has no top'); }
  const CHAIN = [
    { order:FIRST_DELIVERY.id, seller:ACTIVE.producer, buyer:ACTIVE.distributor,
      bottles:FIRST_DELIVERY.items[0].qty, fee:true,
      what:'winery → primary distributor' },
    { order:'ORD-9001', seller:'Hawesko GmbH', buyer:B, bottles:60, fee:false,
      what:'A → downstream distributor B (A17.9b)' },
    { order:'ORD-9002', seller:B, buyer:'Osteria Marconi', bottles:12, fee:false,
      what:'B → restaurant' },
    { order:'ORD-9003', seller:'Hawesko GmbH', buyer:'Bistro Laurent', bottles:12, fee:false,
      what:'A → restaurant' }
  ];
  const built = [];
  const faults = [];
  CHAIN.forEach((c, i) => {
    const ev = ask(w, 'ownLabelFeeEvent({ id:"OLF-' + (i + 1) + '", type:"accrued", order: orders.find(o => o.id === ' +
      S(c.order) + '), productId:' + S(ACTIVE.productId) + ', bottles:' + c.bottles + ', at:"2026-06-27" })');
    if (c.fee && !ev) faults.push(c.what + ' (' + c.order + ') produced no fee event, and it is the one that must');
    if (!c.fee && ev) faults.push(c.what + ' (' + c.order + ') produced a fee event — the fee would become a turnover tax on the chain');
    if (ev) built.push(ev);
  });
  if (faults.length) bad(faults.join(' · '));
  else ok(CHAIN.length + ' links of the chain: exactly the winery→primary-distributor line accrues, the other ' +
    (CHAIN.length - 1) + ' carry none');

  /* THE SNAPSHOT. A ledger line has to be readable as money from
     itself, years after the tariff moved. */
  const ledger = ask(w, 'ownLabelFeeEvents').concat(built);
  if (!ledger.length) bad('no fee event exists at all — every check below examined nothing');
  else {
    const naked = ledger.filter(e => !w.eval('feeEventHasSnapshot(' + S(e) + ')'));
    if (naked.length) bad(naked.length + ' fee event(s) carry no amount/currency/version snapshot: ' +
      naked.map(e => e.id).join(', '));
    else ok(ledger.length + ' fee event(s), every one carrying its own amount, currency and tariff version (' +
      ledger[0].feePerBottle.toFixed(2) + ' ' + ledger[0].feeCurrency + ', ' + ledger[0].feeTermsVersion + ')');

    /* And the amount came from the central tariff, not from the
       project — A17.10's whole reason for putting it there. */
    const tariff = ask(w, 'OWN_LABEL_FEE_TARIFF');
    const drift = ledger.filter(e => e.feePerBottle !== tariff.feePerBottle ||
      e.feeCurrency !== tariff.feeCurrency || e.feeTermsVersion !== tariff.feeTermsVersion);
    if (drift.length) bad(drift.length + ' fee event(s) do not match the central tariff they were stamped from');
    else ok('every event was stamped from the central tariff; no project sets its own rate');

    /* OL-14 read over the ledger itself, the way an audit would. */
    const wrongSeller = ledger.filter(e => {
      const o = ask(w, 'orders.find(x => x.id === ' + S(e.orderId) + ')');
      const project = ask(w, 'ownLabelProjectById(' + S(e.projectId) + ')');
      return !o || !project || o.seller !== project.producer;
    });
    if (wrongSeller.length) bad(wrongSeller.length + ' fee event(s) sit on an order the producing winery did not sell');
    else ok('every fee event in the ledger sits on a sale by the producing winery of its project');
  }

  /* THE BUILDER IS NOT A WRITER. The page ledger holds fixture rows now,
     so "is it empty" stopped being the question — what has to stay true
     is that calling the builder does not lengthen it. An append-only
     ledger with an implicit writer is how a correction becomes an edit
     (OL-12). */
  {
    const win = fresh();
    const before = win.eval('ownLabelFeeEvents.length');
    if (!before) bad('the page ledger is empty — an own-label first order with no fee event behind it (OL-14)');
    win.eval('ownLabelFeeEvent({ id:"X", type:"accrued", order: firstCommercialDeliveryOf(' +
      S(ACTIVE.productId) + '), productId:' + S(ACTIVE.productId) + ', bottles:12, at:"2026-08-01" })');
    if (win.eval('ownLabelFeeEvents.length') !== before)
      bad('calling the builder appended to the ledger — it returns an event, it does not write one');
    else ok(before + ' fee event(s) in the page ledger, and the builder appends to none of them');

    /* AND THE TOTAL IS COUNTED. A stored figure would be wrong the
       moment an adjustment landed, which is exactly what OL-6 is for. */
    const t = JSON.parse(win.eval('JSON.stringify(ownLabelFeeTotal(' + S(ACTIVE.id) + '))'));
    const rows = JSON.parse(win.eval('JSON.stringify(ownLabelFeeEventsOf(' + S(ACTIVE.id) + '))'));
    const want = +rows.reduce((n, e) => n + e.bottles * e.feePerBottle, 0).toFixed(2);
    if (!t) bad('no fee total for the active project');
    else if (t.amount !== want) bad('the fee total reads ' + t.amount + ' where its own rows sum to ' + want);
    else ok('the fee total is summed from the ledger: ' + t.bottles + ' bottles, ' +
      t.amount.toFixed(2) + ' ' + t.currency);

    /* A reversal has to move it, or the sign convention is decoration. */
    win.eval('ownLabelFeeEvents.push(' + JSON.stringify({ id:'OLF-T1', type:'reversed',
      projectId: null, orderId:null, orderLineId:null, bottles:100, feePerBottle:0.25,
      feeCurrency:'EUR', feeTermsVersion:'OLF-2026-01', at:'2026-08-01', note:null, invoiceId:null })
      .replace('"projectId":null', '"projectId":' + S(ACTIVE.id)) + ')');
    const after = JSON.parse(win.eval('JSON.stringify(ownLabelFeeTotal(' + S(ACTIVE.id) + '))'));
    if (!after || after.amount !== +(want - 25).toFixed(2))
      bad('a reversal of 100 bottles did not take 25.00 off the total (got ' + (after && after.amount) + ')');
    else ok('a reversal subtracts: ' + want.toFixed(2) + ' → ' + after.amount.toFixed(2) + ' EUR');
  }
}

/* ── 4. MG-1 — VISIBILITY YIELDS NO ORDER RIGHT ─────────────────── */
console.log('\n── no order right out of visibility');
{
  const CASES = [
    { buyer:'Weinhaus Müller', seller:'Hawesko GmbH',
      ctx:{ country:'Germany', channel:'retail', at:'2026-08-06' }, allowed:true,
      what:'a retailer inside a covering grant' },
    { buyer:'Bistro Laurent', seller:'Hawesko GmbH',
      ctx:{ country:'France', channel:'gastronomy', at:'2026-08-06' }, allowed:false, rule:'MG-1',
      what:'a restaurant with an active partnership and no covering grant' },
    { buyer:'Casa Elena', seller:'Hawesko GmbH',
      ctx:{ country:'Germany', channel:'gastronomy', at:'2026-08-06' }, allowed:false, rule:'MG-1',
      what:'a covering grant but no partnership' }
  ];
  const faults = [];
  CASES.forEach(c => {
    const r = ask(w, 'ownLabelOrderRight(' + S(c.buyer) + ', ' + S(c.seller) + ', ' +
      S(ACTIVE.productId) + ', ' + S(c.ctx) + ')');
    if (!r) faults.push(c.what + ': the rule did not answer at all');
    else if (r.allowed !== c.allowed) faults.push(c.what + ': allowed=' + r.allowed + ' (' + r.reason + ')');
    else if (c.rule && r.rule !== c.rule) faults.push(c.what + ': refused under ' + r.rule + ', expected ' + c.rule);
  });
  if (faults.length) bad(faults.join(' · '));
  else ok('an order right needs BOTH an active partnership and a covering grant; either one alone refuses');

  /* The no-partnership case has to name a REAL house, or it refuses a
     name nobody could have used either way — B12's empty-state failure
     wearing a green tick. */
  if (w.eval('stakeholder("Casa Elena").unknown === true'))
    bad('Casa Elena is not a house in the data — the no-partnership case above proves nothing');
  else if (w.eval('arePartners("Casa Elena", "Hawesko GmbH")'))
    bad('Casa Elena IS a Hawesko partner — the case above refused for the wrong reason');
  else ok('Casa Elena is a real restaurant with no Hawesko partnership; the refusal is measured, not a typo');

  /* THE SENTENCE MG-1 IS ACTUALLY ABOUT. Reach decides who sees;
     the agreement decides who may act, and a display control cannot
     vary an agreement. Widen everything visible and ask again. */
  {
    const win = fresh();
    const ctx = { country:'France', channel:'gastronomy', at:'2026-08-06' };
    const before = JSON.parse(win.eval('JSON.stringify(ownLabelOrderRight("Bistro Laurent", ' + S(ACTIVE.distributor) + ', ' + S(ACTIVE.productId) + ',' + S(ctx) + '))'));
    win.eval('ownLabelProjectById(' + S(ACTIVE.id) + ').reach = "public"');
    win.eval('wineByRef(' + S(ACTIVE.productId) + ').reach = "public"');
    win.eval('listingOf(' + S(ACTIVE.distributor) + ', ' + S(ACTIVE.productId) + ').reach = "public"');
    const after = JSON.parse(win.eval('JSON.stringify(ownLabelOrderRight("Bistro Laurent", ' + S(ACTIVE.distributor) + ', ' + S(ACTIVE.productId) + ',' + S(ctx) + '))'));
    if (before.allowed !== false) bad('the reach probe started from an allowed answer and proves nothing');
    else if (JSON.stringify(before) !== JSON.stringify(after))
      bad('setting the product to reach `public` moved the order right — a setting varied an agreement');
    else ok('reach set to `public` on project, product and listing: the answer does not move (' + after.reason + ')');
  }

  /* And measured over the source, because a value that is never read
     cannot be read by accident later either. */
  const body = bodyOf(SRC, 'ownLabelOrderRight');
  const names = body.match(/\b(reach|visib\w*|public|listed|discover\w*)\b/g);
  if (!body) bad('ownLabelOrderRight() was not found in the source — nothing was measured');
  else if (names) bad('the order right reads ' + [...new Set(names)].join(', ') +
    ' — visibility is exactly what it may not consult');
  else ok('the order right names no reach, visibility or public flag anywhere in its body');
}

/* ── 5. MG-2 — THE WINERY SUPPLIES ONE CUSTOMER ─────────────────── */
console.log('\n── no own-label order from the winery to anybody but the primary distributor');
{
  const primary = ask(w, 'ownLabelOrderRight(' + S(ACTIVE.distributor) + ', ' + S(ACTIVE.producer) +
    ', ' + S(ACTIVE.productId) + ', {})');
  if (!primary || primary.allowed !== true)
    bad('the primary distributor cannot buy from the producing winery: ' + (primary ? primary.reason : 'no answer'));
  else ok('the primary distributor buys from the producing winery, and needs no grant to do it');

  const downstream = ask(w, 'ownLabelOrderRight(' + S(B) + ', ' + S(ACTIVE.producer) + ', ' +
    S(ACTIVE.productId) + ', ' +
    S({ country:'Italy', city:'Milano', territory:'Lombardia Nord', channel:'sub-distribution', intermediary:B }) + ')');
  if (!downstream) bad('the rule did not answer for the downstream distributor');
  else if (downstream.allowed !== false || downstream.rule !== 'MG-2')
    bad('a second distributor may order from the winery (' + downstream.reason + ') — B orders from A, never from the source');
  else ok('a grant that admits B downstream does not let him buy from the winery: ' + downstream.reason);

  /* The partnership is real, so it is MG-2 that refuses and not the
     missing relation — otherwise this passes for the wrong reason. */
  if (!w.eval('arePartners(' + S(B) + ', ' + S(ACTIVE.producer) + ')'))
    bad('B and the winery are not partners at all, so the refusal above says nothing about MG-2');
  else ok('B and the winery ARE active partners; the refusal is the source rule, not a missing relation');

  /* And over the orders themselves, the way an audit would ask. */
  const offenders = ask(w, `orders.filter(function (o) {
    return (o.items || []).some(function (i) {
      var p = ownLabelProjectOf(i.productId);
      return p && o.seller === producingWineryOf(i.productId) && o.buyer !== p.distributor;
    });
  }).map(function (o) { return o.id + ' (' + o.seller + ' → ' + o.buyer + ')'; })`);
  const own = ask(w, `orders.filter(function (o) {
    return (o.items || []).some(function (i) { return !!ownLabelProjectOf(i.productId); });
  }).length`);
  if (!own) bad('no order names an own-label product — this scan examined nothing');
  else if (offenders.length) bad(offenders.length + ' own-label order(s) sell from the winery to somebody else: ' + offenders.join(' · '));
  else ok(own + ' orders name an own-label product; not one sells from the winery to anybody but the primary distributor');
}

/* ── 6. THE DERIVATION IS THE ONLY READING ON SCREEN ────────────── */
console.log('\n── one reading on screen, and the screen moves with it');
{
  /* THIS SECTION USED TO ASSERT THE OPPOSITE, and the inversion is the
     substance of the migration rather than a rewrite. While the bridge
     was the reader, a project appearing had to move NOTHING — a second
     road to one answer is how two surfaces come to disagree (D33). The
     bridge is gone and the derivation is the reader, so the claim now is
     that the screen follows the RECORDS: the badge is there because both
     OL-15 conditions hold, and it goes the moment either of them stops.

     THE PROBE BREAKS THE DERIVATION RATHER THAN ADDING TO IT, because
     the page already carries the delivered own label — comparing a
     seeded page against a plain one would compare two identical screens
     and pass on a no-op. */
  const live = fresh();
  live.eval('refreshOwnLabelSurfaces(); renderWinePortfolioD();');
  const read = win => ({
    labels: win.document.getElementById('dlabels-list').innerHTML,
    count:  win.document.getElementById('dlabels-count').textContent,
    book:   win.document.getElementById('dportfolio-list').innerHTML,
    widget: win.document.getElementById('dlabels-widget-body').innerHTML,
    stat:   win.document.getElementById('dstat-ol-value').textContent
  });
  const after = read(live);

  if (live.eval('ownLabelListingDerived(listingOf(' + S(ACTIVE.distributor) + ', ' +
      S(ACTIVE.productId) + '))') !== true)
    bad('the active project does not derive own label at all — this section can prove nothing');
  else if (after.book.indexOf('Own-Label') === -1)
    bad('the portfolio drew no Own-Label badge for a row that derives as one');
  else {
    /* Take the delivery away and the badge has to go with it. */
    const broken = fresh();
    broken.eval('firstCommercialDeliveryOf(' + S(ACTIVE.productId) + ').stage = "shipped"');
    broken.eval('refreshOwnLabelSurfaces(); renderWinePortfolioD();');
    const gone = read(broken);
    if (gone.book === after.book)
      bad('the portfolio badges did not move when the first delivery was withdrawn — the badge is not ' +
          'reading the derivation');
    else if (Number(gone.stat) >= Number(after.stat))
      bad('the Own-Label SKUs counter did not fall when the delivery was withdrawn (' +
          after.stat + ' → ' + gone.stat + ')');
    else ok('withdrawing the first delivery takes the badge off the portfolio and the counter from ' +
      after.stat + ' to ' + gone.stat + ' — both conditions of OL-15 reach the screen');
  }

  if (Number(after.stat) < 1)
    bad('the Own-Label SKUs counter reads ' + JSON.stringify(after.stat) + ' with an active own label on the books');
  else ok('the counter reads ' + after.stat + ' active, computed from the same reading');

  /* AND ALL FOUR SURFACES AGREE, which is the thing five typed copies
     could never do: the widget said six, two counters said five, and
     the records said three. */
  const activeRows = live.eval('ownLabelListingsOf(' + S(ACTIVE.distributor) + ').length');
  if (Number(after.stat) !== activeRows)
    bad('the counter says ' + after.stat + ' where ownLabelListingsOf() finds ' + activeRows);
  else if ((after.widget.match(/tag-green/g) || []).length !== activeRows)
    bad('the widget shows ' + (after.widget.match(/tag-green/g) || []).length + ' active row(s) for ' +
        activeRows + ' own-label listing(s)');
  else ok('My Labels, the widget, the counter and the portfolio all answer ' + activeRows +
    ' — one reading, four surfaces');

  /* AND THERE IS NO SECOND ROAD. No surface may reach own-label status
     except through the two readings; a stored field of any name is a
     second road, and so is a listing property nobody derived. */
  const readers = codeLines(SRC)
    .filter(x => /ownLabelListingDerived|isOwnLabel\(|ownLabelListingsOf\(/.test(x.line));
  if (!readers.length) bad('no reader of the derivation was found in the source at all');
  else ok(readers.length + ' line(s) reach own-label status, all of them through the two readings');

  const stored = codeLines(SRC).filter(x => /\.(ownLabel|legacyOwnLabel)\s*[=)]/.test(x.line));
  if (stored.length) bad(stored.length + ' place(s) read or write a stored own-label field: ' +
    stored.map(x => 'line ' + x.n).join(' · '));
  else ok('no line anywhere reads or writes a stored own-label field on a listing (OL-6)');
}

/* ── 7. THE COUNTER-CHECKS ──────────────────────────────────────── */
console.log('\n── the counter-checks');
{
  const cases = [
    { what: 'the holder condition drops out of the OL-15 derivation',
      from: "  if (listing.holder !== project.distributor) return false;",
      to:   "",
      ask:  win => win.eval('ownLabelListingDerived(listingOf(' + S(B) + ', ' + S(ACTIVE.productId) + ')) === false'),
      says: 'a downstream holder badging his own row an own label on his own first delivery (A17.9b)' },

    { what: 'the delivery condition drops out of the OL-15 derivation',
      from: "  return !!firstCommercialDeliveryOf(listing.productId);",
      to:   "  return true;",
      ask:  win => {
        win.eval('firstCommercialDeliveryOf(' + S(ACTIVE.productId) + ').stage = "shipped"');
        return win.eval('ownLabelListingDerived(listingOf(' + S(ACTIVE.distributor) + ', ' + S(ACTIVE.productId) + ')) === false');
      },
      says: 'a wine on a restaurant list before a bottle of it has arrived' },

    /* THE PROBE IS AIMED AT THE GUARD BEING REMOVED, AND NOTHING ELSE.
       Its first version asked with ORD-9002 (B → restaurant), which the
       BUYER guard refuses anyway — so the mutation was weakened and the
       check read as safety while proving nothing (C7). The probe order
       below is refused by the seller guard alone: the buyer is the
       primary distributor, the line is on the order, and only "did the
       producing winery sell this?" stands between it and a fee. */
    { what: 'the fee stops asking who sold the bottle',
      from: "  if (order.seller !== producingWineryOf(id))",
      to:   "  if (false)",
      ask:  win => {
        win.eval(`orders.push({ id:'ORD-9004', placed:'2026-07-10', buyer:'Hawesko GmbH', buyerType:'distributor',
          seller:'Weingut Schmitt', sellerType:'winery', stage:'delivered',
          items:[{ productId: ${S(ACTIVE.productId)}, qty:24, unit:7.90,
                   vintage: wineByRef(${S(ACTIVE.productId)}).vintage, batchOrLot:null }] })`);
        return win.eval('ownLabelFeeEvent({ id:"X", type:"accrued", order: orders.find(o => o.id === "ORD-9004"), ' +
                        'productId:' + S(ACTIVE.productId) + ', bottles:24, at:"2026-07-10" }) === null');
      },
      says: 'a fee on a bottle the producing winery did not sell — the ledger charging whoever happened to ship' },

    { what: 'a fee event stops naming a line the order carries',
      from: "  if (!(order.items || []).some(i => i.productId === id))",
      to:   "  if (false)",
      /* The probe order is built here rather than named, because what
         it has to be is precise: the producing winery selling to the
         primary distributor — both guards above satisfied — with a line
         for a DIFFERENT wine. Leaning on a fixture that happens not to
         carry the wine would make the check depend on a coincidence. */
      ask:  win => {
        win.eval(`orders.push({ id:'ORD-9005', placed:'2026-07-29', buyer:${S(ACTIVE.distributor)},
          buyerType:'distributor', seller:${S(ACTIVE.producer)}, sellerType:'winery', stage:'delivered',
          items:[{ productId:'PRD-1013', qty:180, unit:5.90, vintage:2023, batchOrLot:null }] })`);
        return win.eval('ownLabelFeeEvent({ id:"X", type:"accrued", order: orders.find(o => o.id === "ORD-9005"), ' +
                        'productId:' + S(ACTIVE.productId) + ', bottles:180, at:"2026-07-29" }) === null');
      },
      says: 'a ledger row for goods that never moved — ORD-9005 carries no line for this product at all' },

    { what: 'the fee event stops carrying its own rate',
      from: "    feePerBottle:    OWN_LABEL_FEE_TARIFF.feePerBottle,",
      to:   "",
      ask:  win => win.eval('feeEventHasSnapshot(ownLabelFeeEvent({ id:"X", type:"accrued", ' +
                            'order: firstCommercialDeliveryOf(' + S(ACTIVE.productId) + '), productId:' +
                            S(ACTIVE.productId) + ', bottles:180, at:"2026-06-27" }))'),
      says: 'a ledger line that can only be priced by re-reading today\'s tariff (OL-12)' },

    { what: 'the order right stops asking for a grant',
      from: "  const grant = marketGrantCovering(project.id, ctx);",
      to:   "  const grant = marketGrantCovering(project.id, ctx) || { id: 'assumed' };",
      ask:  win => win.eval('ownLabelOrderRight("Bistro Laurent", ' + S(ACTIVE.distributor) + ', ' +
                            S(ACTIVE.productId) + ', ' +
                            S({ country:'France', channel:'gastronomy', at:'2026-08-06' }) + ').allowed === false'),
      says: 'MG-1 gone: an order right falling out of nothing but a partnership' },

    { what: 'the winery may sell to anybody it is partnered with',
      from: "    return buyer === project.distributor",
      to:   "    return true",
      ask:  win => win.eval('ownLabelOrderRight(' + S(B) + ', ' + S(ACTIVE.producer) + ', ' +
                            S(ACTIVE.productId) + ', {}).allowed === false'),
      says: 'MG-2 gone: a second distributor buying from the source' },

    { what: 'a named grant dimension starts admitting what it does not name',
      from: "    !Array.isArray(named) || !named.length || (value != null && named.indexOf(value) !== -1);",
      to:   "    !Array.isArray(named) || !named.length || value == null || named.indexOf(value) !== -1;",
      ask:  win => win.eval('marketGrantCovering(' + S(DIM_PROJECT) + ', ' + S({ country:'Germany', at:'2026-08-06' }) + ') === null'),
      says: 'a supply naming no channel slipping through a grant that names three' }
  ];

  cases.forEach(c => {
    const win = fresh({ from: c.from, to: c.to });
    if (!win) return bad('"' + c.what + '" never applied — the check below proves nothing');
    if (c.ask(win)) bad('NOT caught: ' + c.what + ' — ' + c.says + ', and nothing said so');
    else ok('caught: ' + c.what);
  });
}

console.log(fail ? '\n' + fail + ' check(s) failed' : '\nown-label grants: all checks passed');
process.exit(fail ? 1 : 0);
