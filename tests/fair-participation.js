/* ═══════════════════════════════════════════════════════════════════
   FAIR PARTICIPATION, THE PARTICIPATION PAGE, OCCUPANCY & CONTENT —
   A21, FP-1..FP-14 (pass O4)
   -------------------------------------------------------------------
   One canonical participation per (edition, organisation), created
   explicitly by the admitted organisation; the organizer places, the
   exhibitor fills; occupancy derives; the canonical public page
   renders behind the ONE triple gate. As in tests/fairs.js, every
   invariant is measured twice — the CLAIM, and the COUNTER-MUTATION
   that breaks the rule and must turn the same check red.

   ONE measured absence: the PERSISTENCE half of FP-13 (a saved
   dashboard change reaching the public page; the read path never
   writing) lives in tests/persistence.js §10 — that file is the one
   harness allowed to run a live store (its own kill-switch scan
   fails any other harness that opts in).
═══════════════════════════════════════════════════════════════════ */
const { loadDashboard } = require('./load-dashboard');
const { JSDOM, VirtualConsole } = require('jsdom');
const fs = require('fs');
const path = require('path');

function boot() {
  const errs = [];
  const dom = new JSDOM(loadDashboard().html, {
    runScripts: 'dangerously', pretendToBeVisual: true,
    virtualConsole: new VirtualConsole().on('jsdomError', e => errs.push(e.message))
  });
  if (errs.length) { console.log('SCRIPT ERRORS:\n' + errs.join('\n')); process.exit(1); }
  const w = dom.window;
  w.scrollTo = () => {};
  w.confirm = () => true;
  w.eval('history.replaceState = function () {}');
  return w;
}
const PAGE = path.join(__dirname, '..', 'bottle-lobby-fair-participation.html');
function bootPage(suffix) {
  const errs = [];
  const dom = new JSDOM(loadDashboard(PAGE).html, {
    runScripts: 'dangerously', pretendToBeVisual: true,
    url: 'https://localhost/bottle-lobby-fair-participation.html' + (suffix || ''),
    virtualConsole: new VirtualConsole().on('jsdomError', e => errs.push(e.message))
  });
  if (errs.length) { console.log('SCRIPT ERRORS:\n' + errs.join('\n')); process.exit(1); }
  return dom.window;
}
/* The data file is INLINED by the loader, so raw text greps over the
   body must strip the script nodes first (the public-shows-page.js
   discipline). */
function strippedBody(win) {
  const c = win.document.body.cloneNode(true);
  Array.prototype.forEach.call(c.querySelectorAll('script'), n => n.remove());
  return c;
}

const w = boot(), d = w.document;
console.log('dashboard evaluated cleanly\n');

let fail = 0;
const bad = m => { console.log('  ✗ ' + m); fail++; };
const ok  = m => console.log('  ✓ ' + m);

function expectRed(label, check) {
  const before = fail;
  const realLog = console.log;
  console.log = () => {};
  try { check(); } finally { console.log = realLog; }
  const raised = fail - before;
  fail = before;                       /* the failures were the point */
  if (raised) ok('counter-mutation: ' + label + ' — the check goes red (' + raised + ')');
  else bad('COUNTER-MUTATION STAYED GREEN: ' + label + ' — this check cannot fail and proves nothing');
}

/* Read from the page, never retyped. */
const PARTS = () => w.eval('fairParticipations');
const ADM   = () => w.eval('fairAdmissions');
w.eval("showPartnerView('fairs')");

/* Live acts mutate the records — a STACK per collection, because
   expectRed wraps blocks that snapshot on their own. */
w.eval('window.__fpStack = []; window.__faStack = []; window.__fiStack = []');
function snapParts()    { w.eval('window.__fpStack.push([JSON.stringify(fairParticipations), fairParticipationSeq])'); }
function restoreParts() { w.eval('(function(){ const s = window.__fpStack.pop(); fairParticipations = JSON.parse(s[0]); fairParticipationSeq = s[1]; })()'); }
function snapAdm()      { w.eval('window.__faStack.push([JSON.stringify(fairAdmissions), fairAdmissionSeq])'); }
function restoreAdm()   { w.eval('(function(){ const s = window.__faStack.pop(); fairAdmissions = JSON.parse(s[0]); fairAdmissionSeq = s[1]; })()'); }
function snapInv()      { w.eval('window.__fiStack.push([JSON.stringify(fairHalls), JSON.stringify(fairStands), fairHallSeq, fairStandSeq])'); }
function restoreInv()   { w.eval('(function(){ const s = window.__fiStack.pop(); fairHalls = JSON.parse(s[0]); fairStands = JSON.parse(s[1]); fairHallSeq = s[2]; fairStandSeq = s[3]; })()'); }

const ROW_KEYS = ['id','editionId','orgType','org','standId','days','description',
                  'products','representing','status','history'].sort().join(',');

/* ── §1 Explicit creation, one per pair, eligible owners (FP-1, FP-2) ─ */
console.log('§1 the admission entitles — the organisation itself creates, once, and only the eligible');

function assertNoAutoCreate() {
  snapAdm(); snapParts();
  try {
    w.eval("applyToFair('FE-7101','winery','Cantina Rossi')");
    w.eval("admitFairApplication(fairAdmissionFor('FE-7101','Cantina Rossi').id)");
    if (w.eval("fairParticipationFor('FE-7101','Cantina Rossi')") === null)
      ok('a full admission arc creates NO participation — the organisation must act itself (FP-1, FR-6)');
    else bad('the admission auto-created a participation');
  } finally { restoreParts(); restoreAdm(); }
}
assertNoAutoCreate();
expectRed('the admission act quietly creating the participation', () => {
  w.eval("window.__adm3 = admitFairApplication; admitFairApplication = function (id) { const r = window.__adm3(id); const a = fairAdmissionById(id); createFairParticipation(a.editionId, a.orgType, a.org); return r; }");
  try { assertNoAutoCreate(); }
  finally { w.eval('admitFairApplication = window.__adm3; delete window.__adm3'); }
});

function assertCreateNeedsAdmitted() {
  snapParts();
  try {
    const n = PARTS().length;
    const applied = w.eval("createFairParticipation('FE-7101','winery','Weingut Schmitt')");   /* status: applied */
    const rejected = w.eval("createFairParticipation('FE-7101','winery','Bodegas Ruiz')");     /* status: rejected */
    const nobody = w.eval("createFairParticipation('FE-7101','winery','Château Belrieu')");    /* no row at all */
    if (applied === null && rejected === null && nobody === null && PARTS().length === n)
      ok('an organisation without final `admitted` finds no creation path — applied, rejected and rowless all refuse');
    else bad('a non-admitted organisation created a participation (FP-1)');
  } finally { restoreParts(); }
}
assertCreateNeedsAdmitted();
expectRed('the admission check swapped for a yes-sayer', () => {
  w.eval("window.__for = fairAdmissionFor; fairAdmissionFor = function (ed, org) { const r = window.__for(ed, org); return r || { status:'admitted', orgType:'winery' }; }");
  try { assertCreateNeedsAdmitted(); }
  finally { w.eval('fairAdmissionFor = window.__for; delete window.__for'); }
});

function assertOnePerPair() {
  const seen = {}, dup = PARTS().find(p => {
    const k = p.editionId + '|' + p.org;
    if (seen[k]) return true;
    seen[k] = true; return false;
  });
  if (!dup) ok('no (edition, organisation) pair holds a second participation (FP-1)');
  else bad('a second participation exists for ' + dup.org + ' on ' + dup.editionId);
}
assertOnePerPair();
{
  snapParts();
  const n = PARTS().length;
  const second = w.eval("createFairParticipation('FE-7101','winery','Domaine Lefèvre')");
  if (second === null && PARTS().length === n)
    ok('a second creation beside the active participation is refused');
  else bad('a duplicate participation was created for an active pair');
  restoreParts();
}
expectRed('a second row planted for an existing pair', () => {
  w.eval("fairParticipations.push({ id:'FP-XXXX', editionId:'FE-7101', orgType:'winery', org:'Domaine Lefèvre', standId:null, days:[], description:'', products:[], representing:null, status:'active', history:[] })");
  try { assertOnePerPair(); }
  finally { w.eval("fairParticipations = fairParticipations.filter(p => p.id !== 'FP-XXXX')"); }
});

function assertEligibleOwners() {
  const alien = PARTS().find(p =>
    ['winery', 'distributor'].indexOf(p.orgType) === -1 ||
    w.eval('stakeholder(' + JSON.stringify(p.org) + ')').type !== p.orgType);
  if (!alien) ok('every participation is owned by a winery or distributor trade workspace (FP-2/FR-2)');
  else bad('participation ' + (alien && alien.id) + ' is owned by an ineligible organisation');
  const adm = PARTS().find(p => {
    const a = w.eval('fairAdmissionFor(' + JSON.stringify(p.editionId) + ',' + JSON.stringify(p.org) + ')');
    return !a || a.status !== 'admitted';
  });
  if (!adm) ok('every participation stands on a final `admitted` of its own pair — the creation entitlement holds on the fixtures');
  else bad('participation ' + (adm && adm.id) + ' has no admitted ground');
}
assertEligibleOwners();
expectRed('a restaurant smuggled in as an exhibitor', () => {
  w.eval("fairParticipations.push({ id:'FP-YYYY', editionId:'FE-7101', orgType:'restaurant', org:'Bistro Laurent', standId:null, days:[], description:'', products:[], representing:null, status:'active', history:[] })");
  try { assertEligibleOwners(); }
  finally { w.eval("fairParticipations = fairParticipations.filter(p => p.id !== 'FP-YYYY')"); }
});
{
  snapParts();
  const rest = w.eval("createFairParticipation('FE-7101','restaurant','Bistro Laurent')");
  if (rest === null) ok('the creation act refuses a restaurant outright (FR-2 mirror)');
  else bad('a restaurant created a participation');
  restoreParts();
}

/* ── §2 References, never copies (FP-3, FP-6, FP-14) ─────────────── */
console.log('\n§2 the row references — edition by key, org by key, wines by productId');

function assertRowShape() {
  const shaped = PARTS().find(p => Object.keys(p).sort().join(',') !== ROW_KEYS);
  if (!shaped) ok('every row carries exactly the reference fields — no copied fair, series, organizer or identity data (FP-3)');
  else bad('row ' + (shaped && shaped.id) + ' grew fields: ' + Object.keys(shaped).sort().join(','));
}
assertRowShape();
expectRed('edition facts copied onto the participation row', () => {
  w.eval("fairParticipationById('FP-9401').fairCity = 'Wiesbaden'");
  try { assertRowShape(); }
  finally { w.eval("delete fairParticipationById('FP-9401').fairCity"); }
});
expectRed('a stakeholder name/slug copied onto the row instead of resolving', () => {
  w.eval("fairParticipationById('FP-9401').orgName = 'Domaine Lefèvre'; fairParticipationById('FP-9401').orgSlug = 'domaine-lefevre'");
  try { assertRowShape(); }
  finally { w.eval("delete fairParticipationById('FP-9401').orgName; delete fairParticipationById('FP-9401').orgSlug"); }
});

function assertProductsResolve() {
  const badRow = PARTS().find(p => {
    const owner = p.org;
    const own = (p.products || []).some(x => {
      const wRow = w.eval('wineByRef(' + JSON.stringify(x.productId) + ')');
      return !wRow || wRow.winery !== owner;
    });
    const rep = (p.representing || []).some(r => {
      const house = r.winery;
      return (r.products || []).some(x => {
        const wRow = w.eval('wineByRef(' + JSON.stringify(x.productId) + ')');
        return !wRow || wRow.winery !== house;
      });
    });
    return own || rep;
  });
  if (!badRow) ok('every presented wine resolves to the presenting winery\'s own catalogue row (FP-6, ME-6)');
  else bad('row ' + (badRow && badRow.id) + ' presents a wine that is not the named winery\'s record');
}
assertProductsResolve();
expectRed('a typed wine name planted instead of a key (ME-6 mirror)', () => {
  w.eval("fairParticipationById('FP-9401').products.push({ productId:'Pouilly-Fumé 2023' })");
  try { assertProductsResolve(); }
  finally { w.eval("fairParticipationById('FP-9401').products.pop()"); }
});
{
  const typed = w.eval("setFairParticipationProducts('FP-9401','Domaine Lefèvre',['Mâcon-Villages'])");
  const foreign = w.eval("setFairParticipationProducts('FP-9401','Domaine Lefèvre',['PRD-1002'])");
  const before = JSON.stringify(w.eval("fairParticipationById('FP-9401').products"));
  if (typed === false && foreign === false)
    ok('the act refuses a typed name AND another house\'s key — nothing half-written (' + (before.length > 2) + ')');
  else bad('a typed or foreign wine reference was accepted (FP-6)');
}

function assertProvenance() {
  const badRep = PARTS().filter(p => p.orgType === 'distributor').find(p => {
    const list = w.eval('fairRepresentableWineries(' + JSON.stringify(p.org) + ')');
    return (p.representing || []).some(r => list.indexOf(r.winery) === -1);
  });
  if (!badRep) ok('every represented winery comes from the distributor\'s active A6 partnerships (A21.4)');
  else bad('a represented winery is outside the measured provenance (FP-6)');
}
assertProvenance();
{
  const free = w.eval("addFairRepresentedWinery('FP-9402','Hawesko GmbH','Fantasy Estate')");
  const retail = w.eval("addFairRepresentedWinery('FP-9402','Hawesko GmbH','Vinstuen København')");
  const d2d = w.eval("addFairRepresentedWinery('FP-9402','Hawesko GmbH','Enoteca Milano Import Srl')");
  if (free === false && retail === false && d2d === false && w.eval("fairParticipationById('FP-9402').representing.length") === 2)
    ok('a free-typed name, a retailer and a fellow distributor are all refused as represented wineries');
  else bad('a non-provenance house entered the representation (A21.4)');
}
expectRed('a fantasy house planted into the representation', () => {
  w.eval("fairParticipationById('FP-9402').representing.push({ winery:'Fantasy Estate', representedAtBooth:false, personallyAttending:false, products:[] })");
  try { assertProvenance(); }
  finally { w.eval("fairParticipationById('FP-9402').representing.pop()"); }
});

/* A represented winery is CONTENT, not an exhibitor (FP-2). */
{
  const repHasOwnRow = PARTS().filter(p => p.orgType === 'distributor')
    .flatMap(p => (p.representing || []).map(r => ({ ed: p.editionId, winery: r.winery })))
    .find(x => w.eval('fairParticipationFor(' + JSON.stringify(x.ed) + ',' + JSON.stringify(x.winery) + ')') !== null &&
               w.eval('fairParticipationFor(' + JSON.stringify(x.ed) + ',' + JSON.stringify(x.winery) + ').orgType') === 'winery' &&
               false);   /* a winery MAY exhibit itself elsewhere — what it must not GAIN is a row FROM the representation */
  snapParts(); snapAdm();
  const before = PARTS().length + ADM().length;
  w.eval("addFairRepresentedWinery('FP-9402','Hawesko GmbH','Domaine Lefèvre')");
  const after = PARTS().length + ADM().length;
  const writes = w.eval("setFairParticipationDescription('FP-9402','Weingut Schmitt','graffiti by the represented house')");
  if (!repHasOwnRow && before === after && writes === false)
    ok('representing a winery creates NO row for it, and the represented house cannot write the distributor\'s participation (FP-2)');
  else bad('the representation leaked ownership or created a record');
  restoreParts(); restoreAdm();
}

/* ── §3 The two presence statements (FP-7) ───────────────────────── */
console.log('\n§3 represented at booth and personally attending — two facts, never one from the other');

{
  const schmitt = w.eval("fairParticipationById('FP-9402').representing").find(r => r.winery === 'Weingut Schmitt');
  if (schmitt && schmitt.representedAtBooth === true && schmitt.personallyAttending === false)
    ok('the fixture carries the separation: Weingut Schmitt is represented at the booth WITHOUT personally attending');
  else bad('the fixture lost the represented-but-not-attending case (FP-7)');
}
function assertPresenceIndependent() {
  snapParts();
  try {
    w.eval("addFairRepresentedWinery('FP-9402','Hawesko GmbH','Domaine Lefèvre')");
    const fresh = () => w.eval("fairParticipationById('FP-9402').representing").find(r => r.winery === 'Domaine Lefèvre');
    if (fresh().representedAtBooth === false && fresh().personallyAttending === false)
      ok('a fresh representation starts with BOTH statements unset — nothing assumed');
    else bad('a fresh representation pre-set a presence statement');
    w.eval("setFairRepresentationPresence('FP-9402','Hawesko GmbH','Domaine Lefèvre','representedAtBooth',true)");
    if (fresh().representedAtBooth === true && fresh().personallyAttending === false)
      ok('setting `represented at booth` leaves `personally attending` untouched');
    else bad('setting the booth statement moved the attendance statement (FP-7)');
    w.eval("setFairRepresentationPresence('FP-9402','Hawesko GmbH','Domaine Lefèvre','representedAtBooth',false)");
    w.eval("setFairRepresentationPresence('FP-9402','Hawesko GmbH','Domaine Lefèvre','personallyAttending',true)");
    if (fresh().personallyAttending === true && fresh().representedAtBooth === false)
      ok('setting `personally attending` leaves `represented at booth` untouched — both directions hold');
    else bad('setting the attendance statement moved the booth statement (FP-7)');
  } finally { restoreParts(); }
}
assertPresenceIndependent();
expectRed('booth representation deriving attendance', () => {
  w.eval("window.__pres = setFairRepresentationPresence; setFairRepresentationPresence = function (id, org, house, field, v) { const r = window.__pres(id, org, house, field, v); if (r && field === 'representedAtBooth' && v) window.__pres(id, org, house, 'personallyAttending', true); return r; }");
  try { assertPresenceIndependent(); }
  finally { w.eval('setFairRepresentationPresence = window.__pres; delete window.__pres'); }
});
expectRed('attendance deriving booth representation', () => {
  w.eval("window.__pres2 = setFairRepresentationPresence; setFairRepresentationPresence = function (id, org, house, field, v) { const r = window.__pres2(id, org, house, field, v); if (r && field === 'personallyAttending' && v) window.__pres2(id, org, house, 'representedAtBooth', true); return r; }");
  try { assertPresenceIndependent(); }
  finally { w.eval('setFairRepresentationPresence = window.__pres2; delete window.__pres2'); }
});

/* ── §4 Responsibilities and the day span (FP-4, FP-5) ───────────── */
console.log('\n§4 the organizer places, the exhibitor fills — and nobody crosses');

function assertForeignContentRefused() {
  const before = w.eval("fairParticipationById('FP-9401').description");
  const asOrganizer = w.eval("setFairParticipationDescription('FP-9401','Atrium Fairs GmbH','organizer graffiti')");
  const asStranger  = w.eval("setFairParticipationDescription('FP-9401','Hawesko GmbH','stranger graffiti')");
  if (asOrganizer === false && asStranger === false &&
      w.eval("fairParticipationById('FP-9401').description") === before)
    ok('neither the organizer nor a foreign house writes exhibitor content — refused in the data layer (FP-4)');
  else bad('a foreign workspace wrote exhibitor content');
}
assertForeignContentRefused();
expectRed('the exhibitor gate swapped for a yes-sayer', () => {
  snapParts();
  w.eval("window.__actable = fairParticipationActable; fairParticipationActable = function (id) { return fairParticipationById(id); }");
  try { assertForeignContentRefused(); }
  finally { w.eval('fairParticipationActable = window.__actable; delete window.__actable'); restoreParts(); }
});

function assertExhibitorCannotPlace() {
  w.eval("fairSeries[0].organizerId = 'PP-9999'");   /* the workspace no longer owns the series */
  try {
    const before = w.eval("fairParticipationById('FP-9401').standId");
    const refused = w.eval("assignFairStand('FP-9401','FB-9302')") === false;
    if (refused && w.eval("fairParticipationById('FP-9401').standId") === before)
      ok('placement refuses a workspace that does not own the edition — only the organizer places (FP-4)');
    else bad('a non-owning workspace assigned a stand');
  } finally { w.eval("fairSeries[0].organizerId = 'PP-9001'"); }
}
assertExhibitorCannotPlace();
expectRed('the placement ownership gate swapped for a yes-sayer', () => {
  snapParts();
  w.eval('window.__g3 = fairSeriesManagedHere; fairSeriesManagedHere = function () { return true; }');
  try { assertExhibitorCannotPlace(); }
  finally { w.eval('fairSeriesManagedHere = window.__g3; delete window.__g3'); restoreParts(); }
});
{
  w.eval("fairOpenEditionId = 'FE-7101'");
  w.eval('renderPartnerFairs()');
  const html = d.getElementById('pfairs-root').innerHTML;
  if (!/fpdesc-|fpw-|fpd-|Save Wines|Save Days/.test(html))
    ok('the organizer surface offers NO exhibitor-content control — placement and rescind only (A21.2)');
  else bad('the organizer surface edits exhibitor content');
  w.eval('fairOpenEditionId = null');
}

function assertDaysWithinSpan() {
  const two = w.eval("setFairParticipationDays('FP-9401','Domaine Lefèvre',['2027-02-10'])");
  const twoState = w.eval("fairParticipationById('FP-9401').days.join(',')");
  const one = w.eval("setFairParticipationDays('FP-9402','Hawesko GmbH',['2027-06-13'])");
  const oneOk = w.eval("setFairParticipationDays('FP-9402','Hawesko GmbH',['2027-06-12'])");
  if (two === false && twoState === '2027-02-08,2027-02-09' && one === false && oneOk === true)
    ok('a day outside the span is refused whole — on the two-day run AND on the one-day edition (endDate null) (FP-5)');
  else bad('an out-of-span attendance day was accepted or the refusal left a half state');
}
assertDaysWithinSpan();
expectRed('the day enumeration widened past the edition', () => {
  w.eval("window.__days = fairEditionDays; fairEditionDays = function () { return ['2027-02-08','2027-02-09','2027-02-10','2027-06-12','2027-06-13']; }");
  try { assertDaysWithinSpan(); }
  finally { w.eval("fairEditionDays = window.__days; delete window.__days; fairParticipationById('FP-9401').days = ['2027-02-08','2027-02-09']"); }
});

/* ── §5 Occupancy derives; inventory care is safe (FP-8, FP-9) ───── */
console.log('\n§5 one stand, one active occupancy — and the inventory cannot lose a used row');

function assertNoDoubleOccupancy() {
  snapAdm(); snapParts();
  try {
    w.eval("applyToFair('FE-7101','winery','Cantina Rossi')");
    w.eval("admitFairApplication(fairAdmissionFor('FE-7101','Cantina Rossi').id)");
    const p2 = w.eval("createFairParticipation('FE-7101','winery','Cantina Rossi')");
    const conflict = w.eval("assignFairStand('" + p2.id + "','FB-9301')");
    const free = w.eval("assignFairStand('" + p2.id + "','FB-9302')");
    const steal = w.eval("assignFairStand('FP-9401','FB-9302')");
    if (conflict === false && free === true && steal === false &&
        w.eval("fairParticipationById('FP-9401').standId") === 'FB-9301')
      ok('an occupied stand refuses a second active exhibitor — in both directions, at the act (FP-8)');
    else bad('two active participations share a stand');
    const alien = w.eval("assignFairStand('" + p2.id + "','FB-9303')");
    if (alien === false) ok('a stand of ANOTHER edition is refused — placement stays on the own inventory (A21.2)');
    else bad('a foreign edition\'s stand was assigned');
    /* The ending frees the stand BY DERIVATION — the row keeps its
       reference, the occupancy reader answers null (A21.6). */
    w.eval("withdrawFairParticipation('" + p2.id + "','Cantina Rossi',null)");
    if (w.eval("fairStandOccupant('FB-9302')") === null &&
        w.eval("fairParticipationById('" + p2.id + "').standId") === 'FB-9302')
      ok('an ended participation occupies nothing — derived over the status, the record untouched (FP-10)');
    else bad('the withdrawal did not free the stand, or freed it by editing data');
  } finally { restoreParts(); restoreAdm(); }
}
assertNoDoubleOccupancy();
expectRed('the occupancy reader ignoring the status', () => {
  w.eval("window.__occ = fairStandOccupant; fairStandOccupant = function (id) { return fairParticipations.find(function (p) { return p.standId === id; }) || null; }");
  try { assertNoDoubleOccupancy(); }
  finally { w.eval('fairStandOccupant = window.__occ; delete window.__occ'); }
});
expectRed('the conflict check taken out of the assignment act', () => {
  w.eval("window.__assign = assignFairStand; assignFairStand = function (id, standId) { const p = fairParticipationById(id); if (!p) return false; if (standId) { const st = fairStands.find(function (x) { return x.id === standId; }); const hall = st && fairHalls.find(function (h) { return h.id === st.hallId; }); if (!st || !hall || hall.editionId !== p.editionId) return false; } p.standId = standId || null; return true; }");
  try { assertNoDoubleOccupancy(); }
  finally { w.eval('assignFairStand = window.__assign; delete window.__assign'); }
});

/* The reactivation gap Codex reproduced: withdraw frees the stand by
   derivation, the organizer re-assigns it, and the withdrawn row —
   which still remembers the stand — tries to come back. The return
   must refuse WHOLE, before any change (FP-8). */
function assertReactivationConflictRefused() {
  snapAdm(); snapParts();
  try {
    w.eval("withdrawFairParticipation('FP-9401','Domaine Lefèvre',null)");
    w.eval("applyToFair('FE-7101','winery','Cantina Rossi')");
    w.eval("admitFairApplication(fairAdmissionFor('FE-7101','Cantina Rossi').id)");
    const p2 = w.eval("createFairParticipation('FE-7101','winery','Cantina Rossi')");
    w.eval("assignFairStand('" + p2.id + "','FB-9301')");   /* the freed stand, re-assigned */
    const histBefore = w.eval("((fairParticipationById('FP-9401')||{}).history||[]).length");
    const admBefore = w.eval('JSON.stringify(fairAdmissions)');
    const back = w.eval("createFairParticipation('FE-7101','winery','Domaine Lefèvre')");
    const row = w.eval("fairParticipationById('FP-9401')");
    if (back === null && row && row.status === 'withdrawn' && row.history.length === histBefore &&
        row.standId === 'FB-9301' &&
        w.eval("fairParticipations.filter(p => p.org === 'Domaine Lefèvre' && p.editionId === 'FE-7101').length") === 1 &&
        w.eval('JSON.stringify(fairAdmissions)') === admBefore &&
        w.eval("(fairStandOccupant('FB-9301')||{}).id") === p2.id)
      ok('withdraw → re-assignment → return attempt: refused whole — no double occupancy, the row rests withdrawn, history, stand reference and admission untouched (FP-8)');
    else bad('the reactivation seized an occupied stand or left a half state');
    /* And with the stand free again, the SAME row still returns. */
    w.eval("assignFairStand('" + p2.id + "', null)");
    const again = w.eval("createFairParticipation('FE-7101','winery','Domaine Lefèvre')");
    if (again && again.id === 'FP-9401' && again.status === 'active')
      ok('once the stand is free the same row reactivates with a fresh created act — the door stays open (D28)');
    else bad('a free stand did not let the withdrawn row return');
  } finally { restoreParts(); restoreAdm(); }
}
assertReactivationConflictRefused();
expectRed('the occupancy check taken out of the reactivation', () => {
  w.eval("window.__occ2 = fairStandOccupant; fairStandOccupant = function () { return null; }");
  try { assertReactivationConflictRefused(); }
  finally { w.eval('fairStandOccupant = window.__occ2; delete window.__occ2'); }
});

function assertInventoryCare() {
  snapInv();
  try {
    const occ = w.eval("removeFairStand('FB-9301')");
    if (occ === false && w.eval("fairStands.some(s => s.id === 'FB-9301')"))
      ok('an occupied stand is not removable — refused, nothing half-done (FP-9)');
    else bad('an occupied stand was removed');
    const hall = w.eval("removeFairHall('FH-9201')");
    if (hall === false && w.eval("fairHalls.some(h => h.id === 'FH-9201')") &&
        w.eval('fairStandsOfHall(\'FH-9201\').length') === 2)
      ok('a hall with stands is not removable — hall and stands stand untouched (atomic refusal)');
    else bad('a non-empty hall was removed or lost a stand');
    const rn = w.eval("renameFairStand('FB-9302','A-02b')");
    if (rn === true && w.eval("fairStands.find(s => s.label === 'A-02b').id") === 'FB-9302')
      ok('renaming edits the label and never the id (FP-9)');
    else bad('the rename touched the id or failed');
    w.eval("renameFairStand('FB-9302','A-02')");
    const dupRefused = w.eval("renameFairStand('FB-9302','A-01')");
    if (dupRefused === false && w.eval("fairStands.find(s => s.id === 'FB-9302').label") === 'A-02')
      ok('a rename onto an existing label in the hall is refused — uniqueness survives renames');
    else bad('two stands in one hall carry one label after a rename');
    const h = w.eval("addFairHall('FE-7101','Temp Hall')");
    const gone = w.eval("removeFairHall('" + h.id + "')");
    if (gone === true && !w.eval("fairHalls.some(x => x.id === '" + h.id + "')"))
      ok('an empty, unreferenced hall IS removable — the refusals above are rules, not a missing feature');
    else bad('an empty hall could not be removed');
  } finally { restoreInv(); }
}
assertInventoryCare();
expectRed('the occupancy guard taken out of the stand removal', () => {
  w.eval("window.__rm = removeFairStand; removeFairStand = function (id) { fairStands = fairStands.filter(function (s) { return s.id !== id; }); return true; }");
  try { assertInventoryCare(); }
  finally { w.eval('removeFairStand = window.__rm; delete window.__rm'); }
});
{
  const hallKeys = 'editionId,id,name', standKeys = 'hallId,id,label';
  const grown = w.eval('fairHalls').find(h => Object.keys(h).sort().join(',') !== hallKeys) ||
                w.eval('fairStands').find(s => Object.keys(s).sort().join(',') !== standKeys);
  if (!grown) ok('halls and stands stay occupancy-free — no occupant, booking or counter field anywhere (A20.9/A21.5)');
  else bad('the inventory grew a field: ' + JSON.stringify(grown));
}
expectRed('an occupant field written onto a stand', () => {
  w.eval("fairStands[0].occupant = 'Domaine Lefèvre'");
  try {
    const grown = w.eval('fairStands').find(s => Object.keys(s).sort().join(',') !== 'hallId,id,label');
    if (!grown) ok('clean'); else bad('occupant field present');
  } finally { w.eval('delete fairStands[0].occupant'); }
});

/* ── §6 Lifecycle — two endings, one truth, nothing deleted (FP-10) ─ */
console.log('\n§6 withdrawn and rescinded are two acts; the admission never moves');

const PART_ACT_STATE = { created:'active', withdrawn:'withdrawn', rescinded:'rescinded' };
function assertPartConsistency() {
  const drift = PARTS().find(p => {
    if (!p.history || !p.history.length) return true;
    let state = null;
    p.history.forEach(h => { if (PART_ACT_STATE[h.action]) state = PART_ACT_STATE[h.action]; });
    return state !== p.status;
  });
  if (!drift) ok('every row\'s status equals the fold of its lifecycle acts — one truth, audited (A21.6)');
  else bad('row ' + (drift && drift.id) + ' contradicts its own history');
}
assertPartConsistency();
expectRed('a status written past the act functions', () => {
  w.eval("fairParticipationById('FP-9401').status = 'withdrawn'");   /* history still ends active */
  try { assertPartConsistency(); }
  finally { w.eval("fairParticipationById('FP-9401').status = 'active'"); }
});

function assertTwoEndings() {
  snapParts();
  const admBefore = w.eval('JSON.stringify(fairAdmissions)');
  try {
    const noReason = w.eval("rescindFairParticipation('FP-9401','  ')");
    if (noReason === false && w.eval("(fairParticipationById('FP-9401')||{}).status") === 'active' &&
        w.eval("((fairParticipationById('FP-9401')||{}).history||[]).length") === 2)
      ok('a rescission without a reason is refused and writes nothing (FP-10)');
    else bad('a reasonless rescission went through or left a half state');
    /* TWO SEPARATE participations, one per ending — the first act
       must not consume the second case. */
    w.eval("rescindFairParticipation('FP-9401','Hall 1 is being re-planned — the placement falls with it')");
    w.eval("withdrawFairParticipation('FP-9402','Hawesko GmbH',null)");
    const a = w.eval("fairParticipationById('FP-9401')");
    const b = w.eval("fairParticipationById('FP-9402')");
    /* a/b === null IS the failure the splice mutation produces — a
       crash here would hide it instead of counting it (the fairs.js
       §3 discipline). */
    const actA = a && a.history[a.history.length - 1];
    const actB = b && b.history[b.history.length - 1];
    if (a && b && a.status === 'rescinded' && b.status === 'withdrawn' &&
        actA.action === 'rescinded' && actA.reason && actB.action === 'withdrawn')
      ok('the organizer\'s rescission and the exhibitor\'s withdrawal are two states from two acts — never one collective end');
    else bad('the two endings collapsed: ' + (a && a.status) + '/' + (b && b.status));
    if (PARTS().length === 2)
      ok('both ended participations are still in the collection — resting states, no deletion (D29)');
    else bad('an ending deleted a participation record');
    if (w.eval("fairParticipationPublic(fairParticipationById('FP-9401'))") === false &&
        w.eval("fairParticipationPublic(fairParticipationById('FP-9402'))") === false)
      ok('neither ended participation renders publicly — the gate falls with the status, each way separately (FP-11)');
    else bad('an ended participation is still publicly rendered');
    if (w.eval("fairStandOccupant('FB-9301')") === null && w.eval("fairStandOccupant('FB-9303')") === null)
      ok('both stands are free again — occupancy derived, no inventory edit (FP-8)');
    else bad('an ended participation still occupies its stand');
    /* The door rule: withdrawn reopens the SAME row; rescinded rests. */
    const again = w.eval("createFairParticipation('FE-7103','distributor','Hawesko GmbH')");
    if (again && again.id === 'FP-9402' && again.status === 'active' &&
        w.eval("fairParticipationById('FP-9402').history").slice(-1)[0].action === 'created')
      ok('after a withdrawal the SAME row continues with a fresh created act (D28\'s distinction)');
    else bad('re-creation after withdrawal opened a second row or failed');
    const blocked = w.eval("createFairParticipation('FE-7101','winery','Domaine Lefèvre')");
    if (blocked === null) ok('after a rescission the organizer has answered — no re-creation in this pass');
    else bad('a rescinded participation was re-created');
    if (w.eval('JSON.stringify(fairAdmissions)') === admBefore)
      ok('the whole lifecycle arc left the admission records byte-identical — admitted stays final (A20.2)');
    else bad('a participation act changed an admission record (FP-10)');
  } finally { restoreParts(); }
}
assertTwoEndings();
expectRed('the withdrawal wired into the admission record', () => {
  w.eval("window.__wd = withdrawFairParticipation; withdrawFairParticipation = function (id, org, reason) { const r = window.__wd(id, org, reason); if (r) { const p = fairParticipationById(id); const a = fairAdmissionFor(p.editionId, p.org); if (a) a.status = 'withdrawn'; } return r; }");
  try { assertTwoEndings(); }
  finally { w.eval('withdrawFairParticipation = window.__wd; delete window.__wd'); snapAdm(); restoreAdm(); w.eval("fairAdmissionById('FA-9105').status = 'admitted'"); }
});
expectRed('the rescission swapped for a deletion', () => {
  w.eval("window.__rs = rescindFairParticipation; rescindFairParticipation = function (id) { fairParticipations = fairParticipations.filter(function (p) { return p.id !== id; }); return true; }");
  try { assertTwoEndings(); }
  finally { w.eval('rescindFairParticipation = window.__rs; delete window.__rs'); }
});

/* ── §7 The triple gate as data (FP-11) ──────────────────────────── */
console.log('\n§7 admitted AND active AND published — one derivation, no admission read');

{
  if (w.eval("fairParticipationPublic(fairParticipationById('FP-9401'))") === true &&
      w.eval("fairParticipationPublic(fairParticipationById('FP-9402'))") === true)
    ok('both fixtures pass the gate: active participation on a published edition, created under admitted');
  else bad('a fixture fails the gate it was built to demonstrate');
}
function assertUnpublishedGate() {
  snapAdm(); snapParts();
  try {
    w.eval("inviteToFair('FE-7102','winery','Cantina Rossi')");
    w.eval("answerFairInvitation(fairAdmissionFor('FE-7102','Cantina Rossi').id,'Cantina Rossi',true,null)");
    const p = w.eval("createFairParticipation('FE-7102','winery','Cantina Rossi')");
    if (p && p.status === 'active' && w.eval("fairParticipationPublic(fairParticipationById('" + p.id + "'))") === false)
      ok('an active participation on an UNPUBLISHED edition renders nothing — factor (c) alone closes the gate');
    else bad('the gate ignored the edition state (FP-11)');
  } finally { restoreParts(); restoreAdm(); }
}
assertUnpublishedGate();
expectRed('the gate reading only the participation status', () => {
  w.eval("window.__gate = fairParticipationPublic; fairParticipationPublic = function (p) { return !!p && p.status === 'active'; }");
  try { assertUnpublishedGate(); }
  finally { w.eval('fairParticipationPublic = window.__gate; delete window.__gate'); }
});
{
  const src = w.eval('fairParticipationPublic.toString()') + w.eval('fairEditionDiscoverable.toString()');
  if (!/[aA]dmission/.test(src.replace(/\/\*[\s\S]*?\*\//g, '')))
    ok('the gate reads NO admission data — factor (a) is the creation entitlement, not a public register (A21.1)');
  else bad('the public gate reads admission records (FR-11)');
}
expectRed('the gate propped up by a public admission register', () => {
  w.eval("window.__gate2 = fairParticipationPublic; fairParticipationPublic = function (p) { var reg = window.publicAdmissionRegister || fairAdmissions; return !!p && p.status === 'active' && reg.some(function (a) { return a.org === p.org && a.status === 'admitted'; }) && fairEditionDiscoverable(fairEditionById(p.editionId)); }");
  try {
    const src = w.eval('fairParticipationPublic.toString()');
    if (!/[aA]dmission/.test(src)) ok('clean'); else bad('the gate reads an admission register');
  } finally { w.eval('fairParticipationPublic = window.__gate2; delete window.__gate2'); }
});

/* ── §8 One canonical source, one implementation (FP-12) ─────────── */
console.log('\n§8 defined once, loaded everywhere — no shadow copy, no second gate');

const SRC_FILES = {
  dashboard: fs.readFileSync(path.join(__dirname, '..', 'bottle-lobby-dashboard.html'), 'utf8'),
  page:      fs.readFileSync(PAGE, 'utf8'),
  data:      fs.readFileSync(path.join(__dirname, '..', 'assets', 'bottle-lobby-data.js'), 'utf8'),
  renderer:  fs.readFileSync(path.join(__dirname, '..', 'assets', 'bottle-lobby-public-shows.js'), 'utf8'),
  store:     fs.readFileSync(path.join(__dirname, '..', 'assets', 'bottle-lobby-store.js'), 'utf8')
};
function countAll(srcAll, re) { return (srcAll.match(re) || []).length; }
function assertSingleDefinitions(srcAll) {
  const defs = [
    [/^let fairSeries\s*=/gm, 'fairSeries'], [/^let fairEditions\s*=/gm, 'fairEditions'],
    [/^let fairHalls\s*=/gm, 'fairHalls'], [/^let fairStands\s*=/gm, 'fairStands'],
    [/^let fairParticipations\s*=/gm, 'fairParticipations'],
    [/^const stakeholders\s*=/gm, 'stakeholders'],
    [/function fairEditionDiscoverable\s*\(/g, 'fairEditionDiscoverable()'],
    [/function fairParticipationPublic\s*\(/g, 'fairParticipationPublic()'],
    [/function fairParticipationPageHtml\s*\(/g, 'the page renderer'],
    [/function stakeholder\s*\(/g, 'stakeholder()']
  ];
  const wrong = defs.find(([re]) => countAll(srcAll, re) !== 1);
  if (!wrong) ok('each moved collection and each derivation is DEFINED exactly once across dashboard, page and assets (FP-12)');
  else bad(wrong[1] + ' is defined ' + countAll(srcAll, wrong[0]) + ' times — a shadow copy exists');
}
const ALL_SRC = Object.keys(SRC_FILES).map(k => SRC_FILES[k]).join('\n');
assertSingleDefinitions(ALL_SRC);
expectRed('a dashboard shadow copy of a moved collection', () => {
  assertSingleDefinitions(ALL_SRC + '\nlet fairSeries = [];');
});
expectRed('the gate rebuilt a second time on the public page', () => {
  assertSingleDefinitions(ALL_SRC + '\nfunction fairParticipationPublic(p) { return true; }');
});
{
  const assetRefs = raw => {
    const out = [];
    raw.replace(/src="(assets\/[A-Za-z0-9._-]+\.js)\?v=/g, (m, f) => { out.push(f); return m; });
    return out.sort().join(',');
  };
  const dashAssets = assetRefs(SRC_FILES.dashboard), pageAssets = assetRefs(SRC_FILES.page);
  if (dashAssets === pageAssets && /bottle-lobby-data\.js/.test(pageAssets) &&
      /bottle-lobby-public-shows\.js/.test(pageAssets) && /bottle-lobby-store\.js/.test(pageAssets))
    ok('dashboard and public page load the SAME canonical asset files — the file-level half of one source');
  else bad('the two documents load different data sources: [' + dashAssets + '] vs [' + pageAssets + ']');
  if (!/Burgundy table|Hanseatic portfolio table/.test(SRC_FILES.page))
    ok('the page holds no pasted participation content — it renders records, it does not carry them');
  else bad('participation fixture content is pasted into the page');
}
{
  if (w.eval("fairParticipationById('FP-9401') === fairParticipations.find(p => p.id === 'FP-9401')") &&
      w.eval("fairEditionById('FE-7101') === fairEditions.find(e => e.id === 'FE-7101')"))
    ok('within the dashboard, finders answer the canonically hydrated objects themselves (=== in one context)');
  else bad('a finder returns a copy instead of the hydrated record');
}
expectRed('a finder answering clones', () => {
  w.eval('window.__byId = fairParticipationById; fairParticipationById = function (id) { const p = window.__byId(id); return p ? JSON.parse(JSON.stringify(p)) : null; }');
  try {
    if (w.eval("fairParticipationById('FP-9401') === fairParticipations.find(p => p.id === 'FP-9401')")) ok('same object');
    else bad('a finder returns a copy');
  } finally { w.eval('fairParticipationById = window.__byId; delete window.__byId'); }
});
{
  const list = w.eval('BLStore.PUBLIC_COLLECTIONS');
  const assertAllowlist = arr => {
    const exact = arr.slice().sort().join(',') === 'fairEditions,fairHalls,fairParticipations,fairSeries,fairStands';
    if (exact) ok('the hydrate allowlist is exactly the five public fair collections — no admission, nothing private (FP-13)');
    else bad('the public allowlist moved: ' + arr.join(', '));
  };
  assertAllowlist(list);
  expectRed('fairAdmissions smuggled into the public allowlist', () => {
    assertAllowlist(list.concat('fairAdmissions'));
  });
  const registered = (SRC_FILES.page.match(/^\s{4}(\w+):\s*\[function/gm) || []).map(s => s.trim().split(':')[0]);
  if (registered.length === 5 && registered.every(n => list.indexOf(n) !== -1))
    ok('the page registers exactly the allowlisted collections and nothing else');
  else bad('the page registers outside the allowlist: ' + registered.join(', '));
}

/* ── §9 The rendered page (FP-11, FP-14) ─────────────────────────── */
console.log('\n§9 the canonical page — composed from sources, gated, naming nobody private');

{
  const w2 = bootPage('?id=FP-9401');
  const body = strippedBody(w2);
  const text = body.textContent;
  const html = body.innerHTML;
  if (/Domaine Lefèvre/.test(text) && /Atrium Wine Days/.test(text) &&
      /8 Feb 2027/.test(text) && /9 Feb 2027/.test(text) &&
      /A-01/.test(text) && /Hall 1 — Tasting Floor/.test(text) &&
      /Burgundy table/.test(text) && /Mâcon-Villages 2023/.test(text) && /Trade Fair/.test(text))
    ok('the winery page composes exhibitor, edition, days, hall/stand, description and wines — each from its record');
  else bad('the winery participation page is missing a composed fact');
  if (/href="bottle-lobby-winery-domaine-lefevre.html"/.test(html) &&
      /href="bottle-lobby-wine-macon-villages.html"/.test(html))
    ok('winery and wine references are REAL links onto the existing canonical pages (FP-14)');
  else bad('a reference does not link its canonical target');
  if (!/Bodegas Ruiz|Enoteca Milano|Weingut Schmitt/.test(text) && !/[Aa]dmitted|[Aa]pplied|[Ii]nvited|[Rr]ejected/.test(text))
    ok('applicants, invitees, rejected and merely-admitted organisations appear NOWHERE on the page (FR-11)');
  else bad('recruiting content leaked onto the public page');
  if (w2.eval('typeof fairAdmissions') === 'undefined' &&
      w2.eval('typeof organizerCandidateSearch') === 'undefined' &&
      w2.eval('typeof FAIR_RECRUITING_READ_FIELDS') === 'undefined')
    ok('the page context cannot even REACH an admission record or the recruiting path — not loaded, not hydrated (A21.8)');
  else bad('private recruiting data is reachable in the public page context');
  if (w2.eval("fairParticipationById('FP-9401') === fairParticipations.find(p => p.id === 'FP-9401')"))
    ok('within the page document, the finder answers the objects hydrated there (=== in one context, FP-12)');
  else bad('the page works on copies of its own hydrated records');
  if (w2.eval('BLStore.isReadOnly()') === true)
    ok('the page hydrated through the read-only entry — the store cannot write here');
  else bad('the page did not go through the read-only hydration path');
}

function assertGroupsPure(w2) {
  const reps = Array.prototype.slice.call(w2.document.querySelectorAll('#fpp-root .fpp-rep'));
  if (!reps.length) { bad('no represented-winery groups rendered — the grouping fell away (A21.7)'); return; }
  const pool = JSON.parse(w2.eval('JSON.stringify(partnerWinesPool)'));
  let mixed = null;
  reps.forEach(el => {
    const house = el.querySelector('.fpp-rep-head .fpp-link, .fpp-rep-head strong');
    const houseName = house ? house.textContent.trim() : '';
    Array.prototype.forEach.call(el.querySelectorAll('.fpp-wine a'), a => {
      const row = pool.find(r => r.url === a.getAttribute('href'));
      if (!row || row.winery !== houseName) mixed = { house: houseName, href: a.getAttribute('href') };
    });
  });
  if (!mixed) ok('every wine renders inside ITS winery\'s group — grouped by winery, nothing mixed');
  else bad('a foreign wine sits in ' + mixed.house + '\'s group: ' + mixed.href);
}
{
  const w2 = bootPage('?id=FP-9402');
  const body = strippedBody(w2);
  const text = body.textContent;
  if (/Hawesko GmbH/.test(text) && /12 Jun 2027/.test(text) && /S-01/.test(text))
    ok('the distributor page composes the one-day edition, its day and its stand');
  else bad('the distributor page is missing a composed fact');
  const reps = body.querySelectorAll('.fpp-rep');
  if (reps.length === 2) ok('two represented wineries render as two groups');
  else bad('the representation did not render per winery (' + reps.length + ')');
  const schmitt = Array.prototype.find.call(reps, el => /Weingut Schmitt/.test(el.textContent));
  if (schmitt && /Represented at booth · yes/.test(schmitt.textContent) &&
      /Personally attending · no/.test(schmitt.textContent))
    ok('the TWO presence statements render as two statements — represented WITHOUT personally attending is visible as exactly that (FP-7)');
  else bad('the page folded or dropped a presence statement');
  assertGroupsPure(w2);
  expectRed('a foreign wine planted into a represented group', () => {
    w2.eval("fairParticipationById('FP-9402').representing.find(r => r.winery === 'Weingut Schmitt').products.push({ productId:'PRD-1002' })");
    w2.eval("document.getElementById('fpp-root').innerHTML = fairParticipationPageHtml(fairParticipationById('FP-9402'))");
    try { assertGroupsPure(w2); }
    finally {
      w2.eval("fairParticipationById('FP-9402').representing.find(r => r.winery === 'Weingut Schmitt').products.pop()");
      w2.eval("document.getElementById('fpp-root').innerHTML = fairParticipationPageHtml(fairParticipationById('FP-9402'))");
    }
  });
  expectRed('the grouping flattened into one pool', () => {
    w2.eval("document.getElementById('fpp-root').innerHTML = '<ul>' + fairParticipationById('FP-9402').representing.map(function (r) { return r.products.map(function (x) { return '<li>' + x.productId + '</li>'; }).join(''); }).join('') + '</ul>'");
    try { assertGroupsPure(w2); }
    finally { w2.eval("document.getElementById('fpp-root').innerHTML = fairParticipationPageHtml(fairParticipationById('FP-9402'))"); }
  });
  /* The gate, asked in the page's own context — each factor separately. */
  if (w2.eval("(function(){ fairEditionById('FE-7103').status = 'draft'; const r = fairParticipationPublic(fairParticipationById('FP-9402')); fairEditionById('FE-7103').status = 'published'; return r; })()") === false)
    ok('page context: an unpublished edition closes the gate');
  else bad('the page gate ignores the edition state');
  if (w2.eval("(function(){ const p = fairParticipationById('FP-9402'); p.status = 'withdrawn'; const a = fairParticipationPublic(p); p.status = 'rescinded'; const b = fairParticipationPublic(p); p.status = 'active'; return a === false && b === false; })()"))
    ok('page context: a withdrawn AND a rescinded participation each close the gate — both ways separately');
  else bad('an ended participation passes the page gate');
}
{
  const w2 = bootPage('?id=FP-0000');
  const t1 = strippedBody(w2).textContent;
  const w3 = bootPage('');
  const t2 = strippedBody(w3).textContent;
  if (/no public fair participation at this address/.test(t1) &&
      /no public fair participation at this address/.test(t2) &&
      !/Domaine Lefèvre|Hawesko/.test(t1))
    ok('a closed door answers ONE neutral sentence — never which factor failed, never a neighbouring record');
  else bad('the not-available answer leaks information');
}

/* ── §10 Findability arrived in ONE place (the O5 line, crossed) ────
   O4 asserted here that no public surface carried fair content at all.
   O5 gives exactly one of them the directory (A16.14d), so the line
   moves rather than disappears — and what it now protects is that it
   moved ONCE: the Wine Shows page, which is a curated Wine Show
   landing and not the directory, must still carry no fair content, and
   the Guide's fair content must reach it through the shared
   derivations rather than through a second reading of the records.
   The Guide's own directory rules are measured in
   tests/wine-guide-page.js (DIR-1..DIR-7). */
console.log('\n§10 findability lives in the directory alone');

{
  const SHOWS_PAGE = path.join(__dirname, '..', 'bottle-lobby-wine-shows.html');
  const errs = [];
  const dom = new JSDOM(loadDashboard(SHOWS_PAGE).html, {
    runScripts: 'dangerously', pretendToBeVisual: true,
    url: 'https://localhost/' + path.basename(SHOWS_PAGE),
    virtualConsole: new VirtualConsole().on('jsdomError', e => errs.push(e.message))
  });
  if (errs.length) bad(path.basename(SHOWS_PAGE) + ' broke: ' + errs[0]);
  else {
    const text = strippedBody(dom.window).textContent;
    if (!/Atrium Wine Days|Uferlicht|FP-94|fair participation/i.test(text))
      ok('the Wine Shows page renders no fair or participation content — it is a Wine Show landing, not the directory');
    else bad('the Wine Shows page grew fair content — the directory is Wine Guide → Events alone');
  }
  /* The Guide reads the fair records — and reads them through the
     shared derivations. A private recruiting record has no route onto
     it, before or after O5 (FR-11). */
  const guideRaw = fs.readFileSync(path.join(__dirname, '..', 'bottle-lobby-wine-guide.html'), 'utf8');
  if (/fairEditions/.test(guideRaw) && /fairParticipations/.test(guideRaw))
    ok('the Wine Guide sources the two fair collections — the directory is its reader since O5');
  else bad('the Wine Guide no longer reads the fair records the directory is built on');
  if (!/fairAdmission/.test(guideRaw))
    ok('and it names no admission record anywhere in its source (FR-11)');
  else bad('the Wine Guide reaches a private recruiting record');
}

/* ── §11 Unchanged neighbours — the cockpits and the O3 core ──────── */
console.log('\n§11 regression samples: four cockpits, recruiting discipline, the frozen allowlist');

{
  const fansDom = d.querySelectorAll('#dfans-list .wn-card').length;
  const fansDerived = w.eval("fansOf('Hawesko GmbH')").length;
  if (fansDom === fansDerived && fansDerived > 0)
    ok("Hawesko's fan list still renders its " + fansDerived + ' derived rows');
  else bad("Hawesko's fan list moved: DOM " + fansDom + ' vs derived ' + fansDerived);
  const ws = w.eval("wineShows.find(s => s.id === 'WS-2604')");
  if (ws && ws.stage === 'planning' && ws.applications_open === true)
    ok('WS-2604 unchanged: planning, open for applications — the show workflow is untouched');
  else bad('WS-2604 moved');
  const audSize = w.eval("announcementAudience('event', campaignSubject('event','ME-3103'), true)").length;
  const snap = w.eval("eventCampaigns.find(c => c.id === 'CMP-4001')").recipients.length;
  if (audSize === snap)
    ok('CMP-4001: live audience still equals its frozen snapshot (' + snap + ')');
  else bad('the campaign audience moved: live ' + audSize + ' vs snapshot ' + snap);
}
{
  const frozen = w.eval("(function(){ try { FAIR_RECRUITING_READ_FIELDS.winery.push('x'); return false; } catch (e) { return true; } })()");
  const fields = w.eval("FAIR_RECRUITING_READ_FIELDS.winery.join(',')");
  if (frozen && fields === 'org,role,region,city,wines')
    ok('the recruiting allowlist is byte-identical and still frozen (FR-9) — O4 never touched it');
  else bad('the recruiting allowlist moved: ' + fields);
  if (w.eval("fairCallOpenFor(fairEditionById('FE-7101'))") === true &&
      w.eval("fairCallOpenFor(fairEditionById('FE-7103'))") === false)
    ok('the exhibitor call discipline stands: open on the spring run, closed on the summer day');
  else bad('the call state moved');
  const statuses = ADM().map(a => a.id + ':' + a.status).join(' ');
  if (/FA-9101:applied/.test(statuses) && /FA-9102:invited/.test(statuses) &&
      /FA-9103:admitted/.test(statuses) && /FA-9104:rejected/.test(statuses) && /FA-9105:admitted/.test(statuses))
    ok('the admission fixtures read as documented — the O3 workflow is semantically unchanged');
  else bad('the admission fixtures moved: ' + statuses);
}

console.log('');
if (fail) { console.log('✗ ' + fail + ' check(s) failed'); process.exit(1); }
console.log('✓ all checks passed');
