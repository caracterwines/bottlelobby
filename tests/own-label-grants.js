/* ═══════════════════════════════════════════════════════════════════
   MARKET GRANTS, THE FEE CHAIN AND THE PRIMARY OWN-LABEL LISTING
   (A17.9a, A17.9b, A17.10, A17.12 — OL-14, OL-15, MG-1, MG-2)

   WHY THIS FILE CARRIES ITS OWN FIXTURES, AND WHY THE PAGE DOES NOT.
   Measured before the pass that added these records: not one of the
   six bridged listings has a delivered order from its producing winery
   to Hawesko. ORD-2029 is the only delivered winery→distributor order
   in the fixtures and it carries PRD-1008, which is not bridged. A
   project row in the page would therefore answer `false` for all six,
   A17.14 would require the `legacyOwnLabel` bridge to go in the same
   commit, and "My Labels" would render nothing — repairable only by
   inventing a delivered first order, which A17.14 forbids in the same
   breath. So the records and the readings are in the page, the
   fixtures are here, and the bridge is untouched until the A17 fixture
   pass supplies the delivery that makes the derivation answer.

   THE FIXTURES ARE MEASURED WHERE THEY CAN BE. The one project this
   file leans on hardest, OLP-2, needs no invented order at all: it
   names PRD-1008, whose delivered ORD-2029 (Cantina Rossi → Hawesko,
   180 bottles, 11 Jun 2026) has been in the demo all along. That
   choice is what makes section 6 possible — the derivation says "own
   label" for a row the bridge calls Standard, so if any surface had
   quietly grown a second road to the answer, the screen would move.
   It must not.

   Only three rows are invented, all downstream and all named as such:
   a Distributor↔Distributor partnership and the two orders under it,
   which is exactly what A17.14 says the chain is missing ("fixtures,
   not architecture").
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

/* ── THE FIXTURES ───────────────────────────────────────────────
   Two projects, both Cantina Rossi → Hawesko, and both naming a wine
   the demo already carries.

   `bespoke_new_wine` with a null source on both, deliberately. A
   relabel would have to name a `sourceWineId`, and the own-label
   product is its own record (A17.0b) — so a relabel row here would
   have to invent a lineage between two wines that have none. OL-9 is
   satisfied by saying nothing rather than by saying something
   unchecked. */
const PROJECTS = [
  { id:'OLP-1', distributor:'Hawesko GmbH', producer:'Cantina Rossi',
    creationType:'bespoke_new_wine', sourceWineId:null, developmentReferenceWineId:null,
    productId:'PRD-1022', stage:'gate2_approved', brandOwner:'Hawesko GmbH',
    requestedAt:'2026-04-06', requestedBy:'Hawesko GmbH' },
  { id:'OLP-2', distributor:'Hawesko GmbH', producer:'Cantina Rossi',
    creationType:'bespoke_new_wine', sourceWineId:null, developmentReferenceWineId:null,
    productId:'PRD-1008', stage:'gate2_approved', brandOwner:'Hawesko GmbH',
    requestedAt:'2026-03-16', requestedBy:'Hawesko GmbH' }
];

/* Three grants on OLP-1's terms, combining freely, and between them
   every dimension A17.9a names is exercised at least once — section 1
   asserts that rather than trusting it. */
const GRANTS = [
  { id:'OLG-1', projectId:'OLP-1', countries:['Germany'], channels:['gastronomy','retail'],
    validFrom:'2026-01-01', validUntil:'2026-12-31' },
  { id:'OLG-2', projectId:'OLP-1', countries:['Germany'], regions:['Nordrhein-Westfalen'],
    channels:['supermarket'], keyAccounts:['REWE Group'], maxBottles:24000 },
  { id:'OLG-3', projectId:'OLP-1', countries:['Italy'], cities:['Milano'], territories:['Lombardia Nord'],
    channels:['sub-distribution'], intermediaries:['Enoteca Milano Import Srl'],
    conditions:'Sub-distribution only under the Bottle Lobby platform binding (A17.10).' }
];

/* The downstream chain A17.14 says is missing. B is a real distributor
   in the demo with a real profile page.

   THE PARTNERSHIP IS NO LONGER SEEDED HERE. This file used to push its
   own Hawesko ↔ Enoteca row, dated 15 Jun 2026; the D2D pass put the
   real one in the page, dated 19 May 2026, and a harness that kept
   pushing its copy would have run against TWO rows for one relation —
   the exact duplication `partnerships` was consolidated to end. It is
   asserted below instead of created: if the page ever loses the row,
   this file says so rather than quietly supplying it. */
const B = 'Enoteca Milano Import Srl';
const DOWNSTREAM_ORDERS = [
  { id:'ORD-9001', placed:'2026-06-20', buyer:B, buyerType:'distributor',
    seller:'Hawesko GmbH', sellerType:'distributor', stage:'delivered',
    items:[{ productId:'PRD-1008', qty:60, unit:9.40, vintage:2021, batchOrLot:null }] },
  { id:'ORD-9002', placed:'2026-07-02', buyer:'Osteria Marconi', buyerType:'restaurant',
    seller:B, sellerType:'distributor', stage:'delivered',
    items:[{ productId:'PRD-1008', qty:12, unit:14.20, vintage:2021, batchOrLot:null }] },
  /* The fourth row of A17.10's fee table — A selling on to a
     restaurant of his own. Without it that line of the table would be
     asserted against an order that does not carry the wine, which is
     a check passing for the wrong reason. */
  { id:'ORD-9003', placed:'2026-07-06', buyer:'Bistro Laurent', buyerType:'restaurant',
    seller:'Hawesko GmbH', sellerType:'distributor', stage:'delivered',
    items:[{ productId:'PRD-1008', qty:12, unit:13.80, vintage:2021, batchOrLot:null }] }
];

function seed(win) {
  win.eval('ownLabelProjects.push.apply(ownLabelProjects, ' + JSON.stringify(PROJECTS) + ')');
  win.eval('marketGrants.push.apply(marketGrants, ' + JSON.stringify(GRANTS) + ')');
  win.eval('orders.push.apply(orders, ' + JSON.stringify(DOWNSTREAM_ORDERS) + ')');
  win.eval("addListing(" + JSON.stringify(B) + ", 'PRD-1008', { tradePrice: 9.90, holderArticleNo: 'EM-114' })");
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
  const grants = ask(w, 'marketGrantsOf("OLP-1")');
  if (grants.length !== GRANTS.length) bad('the grants did not reach the project: ' + grants.length + ' of ' + GRANTS.length);
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
    { ctx:{ country:'Germany', channel:'gastronomy', at:'2026-08-06' }, grant:'OLG-1', why:'country and channel named, inside the period' },
    { ctx:{ country:'Germany', channel:'retail', at:'2026-08-06' },     grant:'OLG-1', why:'the second channel of the same grant' },
    { ctx:{ country:'Germany', region:'Nordrhein-Westfalen', channel:'supermarket', keyAccount:'REWE Group', bottles:12000 },
      grant:'OLG-2', why:'a supermarket grant for one region and one named chain' },
    { ctx:{ country:'Italy', city:'Milano', territory:'Lombardia Nord', channel:'sub-distribution', intermediary:B },
      grant:'OLG-3', why:'sub-distribution through a named intermediary' },

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
    const got = ask(w, 'marketGrantCovering("OLP-1", ' + S(c.ctx) + ')');
    const id = got ? got.id : null;
    if (id !== c.grant) faults.push(c.why + ': got ' + (id || 'no grant') + ', expected ' + (c.grant || 'no grant'));
  });
  if (faults.length) bad(faults.length + ' of ' + CASES.length + ' coverage cases wrong: ' + faults.join(' · '));
  else ok(CASES.length + ' coverage cases, ' + CASES.filter(c => c.grant).length + ' admitted and ' +
    CASES.filter(c => !c.grant).length + ' refused, each for the dimension it is about');

  /* COMBINABLE means the rows stay separate. If one supply were
     covered by both, the grants would be one permission written twice
     and the whole shape would be a boolean again. */
  const a = ask(w, 'marketGrantsOf("OLP-1").filter(g => marketGrantCovers(g, ' +
    S({ country:'Germany', region:'Nordrhein-Westfalen', channel:'supermarket', keyAccount:'REWE Group', bottles:12000 }) + ')).map(g => g.id)');
  const b = ask(w, 'marketGrantsOf("OLP-1").filter(g => marketGrantCovers(g, ' +
    S({ country:'Germany', channel:'gastronomy', at:'2026-08-06' }) + ')).map(g => g.id)');
  if (a.length !== 1 || b.length !== 1 || a[0] === b[0])
    bad('two different supplies are admitted by ' + S(a) + ' and ' + S(b) +
        ' — the grants are not separate records');
  else ok('two supplies, two different grants (' + a[0] + ' and ' + b[0] + '); neither covers the other');
}

/* ── 2. OL-15 — THE PRIMARY OWN-LABEL LISTING ───────────────────── */
console.log('\n── own label on a listing: two conditions, no others');
{
  /* MEASURED, NOT ASSUMED: both conditions hold for OLP-2 out of the
     demo's own data. If the delivery ever moves, this says so. */
  const delivery = ask(w, 'firstCommercialDeliveryOf("PRD-1008")');
  if (!delivery) bad('no confirmed first delivery for PRD-1008 — ORD-2029 is what this whole section rests on');
  else ok('first commercial delivery of PRD-1008: ' + delivery.id + ' (' + delivery.seller + ' → ' +
    delivery.buyer + ', ' + delivery.placed + '), read from the orders rather than a flag');

  const primary = ask(w, 'ownLabelListingDerived(listingOf("Hawesko GmbH", "PRD-1008"))');
  if (primary !== true) bad('the primary distributor\'s row does not derive as own label although both conditions hold');
  else ok('both conditions hold and the primary distributor\'s listing derives as own label');

  /* Condition 1 alone, taken away: the delivery is not confirmed. */
  {
    const win = fresh();
    win.eval("orders.find(o => o.id === 'ORD-2029').stage = 'shipped'");
    if (win.eval('ownLabelListingDerived(listingOf("Hawesko GmbH", "PRD-1008"))') !== false)
      bad('a product still in transit derives as own label — a wine enters the book when it can honestly be promised on');
    else ok('unconfirmed delivery: the primary distributor\'s row stops deriving as own label');
  }

  /* THE COUNTER-CHECK THE SECOND CONDITION EXISTS FOR (A17.9b). B has
     his own first delivery of the same product and his own listing.
     On the first condition alone his row would badge itself an own
     label; he never becomes the primary own-label holder. */
  {
    const bDelivery = ask(w, 'orders.filter(o => o.buyer === ' + S(B) + " && o.stage === 'delivered' && " +
      "o.items.some(i => i.productId === 'PRD-1008')).map(o => o.id)");
    const bListing = ask(w, 'listingOf(' + S(B) + ', "PRD-1008")');
    if (!bDelivery.length || !bListing)
      bad('the downstream holder has no delivered order or no listing — the counter-check would pass vacuously');
    else if (ask(w, 'ownLabelListingDerived(listingOf(' + S(B) + ', "PRD-1008"))') !== false)
      bad('the downstream holder\'s row derives as own label — B never becomes the primary own-label holder');
    else ok('the downstream holder has a delivered order (' + bDelivery.join(', ') +
      ') and a listing of his own, and his row still derives as ordinary');
  }

  /* And the reading takes NO third condition. A project whose product
     nobody has taken delivery of answers false on both sides. */
  if (ask(w, 'ownLabelListingDerived(listingOf("Hawesko GmbH", "PRD-1022"))') !== false)
    bad('PRD-1022 derives as own label although no delivery of it is confirmed — that is the bridge answering, not the derivation');
  else ok('PRD-1022 is bridged `active` on screen and derives as false — the two readings are separate, which is the point');
}

/* ── 3. OL-14 — THE FEE ACCRUES ONCE, AT THE TOP OF THE CHAIN ───── */
console.log('\n── a fee event only where the seller is the producing winery');
{
  const CHAIN = [
    { order:'ORD-2029', seller:'Cantina Rossi', buyer:'Hawesko GmbH', bottles:180, fee:true,
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
      S(c.order) + '), productId:"PRD-1008", bottles:' + c.bottles + ', at:"2026-06-27" })');
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

  /* A fee event is never rewritten, and the builder is not a writer:
     nothing in this pass appends to the ledger. */
  if (ask(w, 'ownLabelFeeEvents').length !== 0)
    bad('the page ledger is not empty — something wrote a fee event, and no path in this pass may');
  else ok('the page ledger stays empty: the builder returns an event, it does not append one');
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
    const r = ask(w, 'ownLabelOrderRight(' + S(c.buyer) + ', ' + S(c.seller) + ', "PRD-1022", ' + S(c.ctx) + ')');
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
    const before = JSON.parse(win.eval('JSON.stringify(ownLabelOrderRight("Bistro Laurent","Hawesko GmbH","PRD-1022",' + S(ctx) + '))'));
    win.eval("ownLabelProjectById('OLP-1').reach = 'public'");
    win.eval("wineByRef('PRD-1022').reach = 'public'");
    win.eval("listingOf('Hawesko GmbH','PRD-1022').reach = 'public'");
    const after = JSON.parse(win.eval('JSON.stringify(ownLabelOrderRight("Bistro Laurent","Hawesko GmbH","PRD-1022",' + S(ctx) + '))'));
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
  const primary = ask(w, 'ownLabelOrderRight("Hawesko GmbH", "Cantina Rossi", "PRD-1022", {})');
  if (!primary || primary.allowed !== true)
    bad('the primary distributor cannot buy from the producing winery: ' + (primary ? primary.reason : 'no answer'));
  else ok('the primary distributor buys from the producing winery, and needs no grant to do it');

  const downstream = ask(w, 'ownLabelOrderRight(' + S(B) + ', "Cantina Rossi", "PRD-1022", ' +
    S({ country:'Italy', city:'Milano', territory:'Lombardia Nord', channel:'sub-distribution', intermediary:B }) + ')');
  if (!downstream) bad('the rule did not answer for the downstream distributor');
  else if (downstream.allowed !== false || downstream.rule !== 'MG-2')
    bad('a second distributor may order from the winery (' + downstream.reason + ') — B orders from A, never from the source');
  else ok('a grant that admits B downstream does not let him buy from the winery: ' + downstream.reason);

  /* The partnership is real, so it is MG-2 that refuses and not the
     missing relation — otherwise this passes for the wrong reason. */
  if (!w.eval('arePartners(' + S(B) + ', "Cantina Rossi")'))
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

/* ── 6. THE DERIVATION IS NOT WIRED, AND MUST NOT BE ────────────── */
console.log('\n── one reading on screen, not two');
{
  /* PRD-1008 derives as own label and is bridged `false`. If any
     surface had grown a second road to the answer, seeding the project
     would move the screen. It must not: listingOwnLabelStatus() is
     REPLACED by the derivation in the A17 pass, never extended with
     it, and two roads to one answer is how two surfaces come to
     disagree (D33). */
  const plain = build();
  plain.eval('renderOwnLabelsD(); renderWinePortfolioD();');
  const before = {
    labels: plain.document.getElementById('dlabels-list').innerHTML,
    count:  plain.document.getElementById('dlabels-count').textContent,
    book:   plain.document.getElementById('dportfolio-list').innerHTML
  };
  const seeded = fresh();
  seeded.eval('renderOwnLabelsD(); renderWinePortfolioD();');
  const after = {
    labels: seeded.document.getElementById('dlabels-list').innerHTML,
    count:  seeded.document.getElementById('dlabels-count').textContent,
    book:   seeded.document.getElementById('dportfolio-list').innerHTML
  };

  if (seeded.eval('ownLabelListingDerived(listingOf("Hawesko GmbH","PRD-1008"))') !== true ||
      seeded.eval('listingOwnLabelStatus(listingOf("Hawesko GmbH","PRD-1008"))') !== null)
    bad('PRD-1008 does not sit on both sides of the question (derived true, bridged null) — ' +
        'this section can only prove something while it does');
  else if (before.labels !== after.labels || before.count !== after.count)
    bad('My Labels moved when a project appeared — a surface is already reading the derivation beside the bridge');
  else if (before.book !== after.book)
    bad('the portfolio badges moved when a project appeared — same second road, one screen further');
  else ok('a project that derives own label for a bridged-false row moves neither My Labels ' +
    before.count + ' nor the portfolio badges — exactly one reading reaches the screen');

  /* The bridge is not extended toward the new rule either (OL-15). */
  const reader = bodyOf(SRC, 'listingOwnLabelStatus');
  if (!reader) bad('listingOwnLabelStatus() was not found in the source');
  else if (/ownLabelProject|ownLabelListingDerived|firstCommercialDelivery/.test(reader))
    bad('listingOwnLabelStatus() has grown a road into the derivation — it is replaced by it, not extended with it');
  else ok('listingOwnLabelStatus() still answers from the bridge alone; the derivation has no caller on screen yet');
}

/* ── 7. THE COUNTER-CHECKS ──────────────────────────────────────── */
console.log('\n── the counter-checks');
{
  const cases = [
    { what: 'the holder condition drops out of the OL-15 derivation',
      from: "  if (listing.holder !== project.distributor) return false;",
      to:   "",
      ask:  win => win.eval('ownLabelListingDerived(listingOf(' + S(B) + ', "PRD-1008")) === false'),
      says: 'a downstream holder badging his own row an own label on his own first delivery (A17.9b)' },

    { what: 'the delivery condition drops out of the OL-15 derivation',
      from: "  return !!firstCommercialDeliveryOf(listing.productId);",
      to:   "  return true;",
      ask:  win => {
        win.eval("orders.find(o => o.id === 'ORD-2029').stage = 'shipped'");
        return win.eval('ownLabelListingDerived(listingOf("Hawesko GmbH", "PRD-1008")) === false');
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
          items:[{ productId:'PRD-1008', qty:24, unit:7.90, vintage:2021, batchOrLot:null }] })`);
        return win.eval('ownLabelFeeEvent({ id:"X", type:"accrued", order: orders.find(o => o.id === "ORD-9004"), ' +
                        'productId:"PRD-1008", bottles:24, at:"2026-07-10" }) === null');
      },
      says: 'a fee on a bottle the producing winery did not sell — the ledger charging whoever happened to ship' },

    { what: 'a fee event stops naming a line the order carries',
      from: "  if (!(order.items || []).some(i => i.productId === id))",
      to:   "  if (false)",
      ask:  win => win.eval('ownLabelFeeEvent({ id:"X", type:"accrued", order: orders.find(o => o.id === "ORD-2042"), ' +
                            'productId:"PRD-1008", bottles:180, at:"2026-07-29" }) === null'),
      says: 'a ledger row for goods that never moved — ORD-2042 carries no Baglio Rosso at all' },

    { what: 'the fee event stops carrying its own rate',
      from: "    feePerBottle:    OWN_LABEL_FEE_TARIFF.feePerBottle,",
      to:   "",
      ask:  win => win.eval('feeEventHasSnapshot(ownLabelFeeEvent({ id:"X", type:"accrued", ' +
                            'order: orders.find(o => o.id === "ORD-2029"), productId:"PRD-1008", bottles:180, at:"2026-06-27" }))'),
      says: 'a ledger line that can only be priced by re-reading today\'s tariff (OL-12)' },

    { what: 'the order right stops asking for a grant',
      from: "  const grant = marketGrantCovering(project.id, ctx);",
      to:   "  const grant = marketGrantCovering(project.id, ctx) || { id: 'assumed' };",
      ask:  win => win.eval('ownLabelOrderRight("Bistro Laurent", "Hawesko GmbH", "PRD-1022", ' +
                            S({ country:'France', channel:'gastronomy', at:'2026-08-06' }) + ').allowed === false'),
      says: 'MG-1 gone: an order right falling out of nothing but a partnership' },

    { what: 'the winery may sell to anybody it is partnered with',
      from: "    return buyer === project.distributor",
      to:   "    return true",
      ask:  win => win.eval('ownLabelOrderRight(' + S(B) + ', "Cantina Rossi", "PRD-1022", {}).allowed === false'),
      says: 'MG-2 gone: a second distributor buying from the source' },

    { what: 'a named grant dimension starts admitting what it does not name',
      from: "    !Array.isArray(named) || !named.length || (value != null && named.indexOf(value) !== -1);",
      to:   "    !Array.isArray(named) || !named.length || value == null || named.indexOf(value) !== -1;",
      ask:  win => win.eval('marketGrantCovering("OLP-1", ' + S({ country:'Germany', at:'2026-08-06' }) + ') === null'),
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
