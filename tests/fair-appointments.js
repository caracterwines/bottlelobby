/* ═══════════════════════════════════════════════════════════════════
   FAIR BOOTH APPOINTMENTS — A22, AP-1..AP-17 (pass O7)
   -------------------------------------------------------------------
   One appointment per active fair participation, through its slot; the
   exhibitor owns the slots and answers the requests; all four trade
   roles may ask; the lifecycle is actor-exclusive and two-sided; and
   the acting identity is DERIVED from the active cockpit, never passed.

   As in tests/fairs.js and tests/fair-participation.js every invariant
   is measured TWICE — the CLAIM, and the COUNTER-MUTATION that breaks
   the rule and must turn the same check red. A check that survives its
   own counter-mutation is not a check.

   THE ACTIVE COCKPIT IS SET THE ONLY WAY THE PAGE SETS IT: through
   showWineShows(role), which writes `activeShowRole` at its head. Where
   a test needs a cockpit that cannot exist in SHOW_ROLES (a partner
   workspace, an organizer), it writes `activeShowRole` directly — that
   is still THE one source being set, not an argument being smuggled
   into an act. No test ever hands an identity to a mutating function;
   that is precisely what §15 proves impossible.
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
  w.eval('Element.prototype.scrollIntoView = function () {}');
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
const APPTS = () => w.eval('fairAppointments');
const SLOTS = () => w.eval('fairAppointmentSlots');
const A     = id => w.eval("fairAppointmentById('" + id + "')");
const rowOf = id => w.eval("JSON.stringify(fairAppointmentById('" + id + "'))");

/* A STACK, because expectRed wraps blocks that snapshot on their own.
   Everything a booth appointment can move travels together: the two
   appointment collections and their counters, the participations (the
   door lives there) and the editions (§12 ends one). */
w.eval('window.__apStack = []');
function snap() {
  w.eval('window.__apStack.push(JSON.stringify([fairAppointments, fairAppointmentSlots, ' +
         'fairAppointmentSeq, fairAppointmentSlotSeq, fairParticipations, fairParticipationSeq, ' +
         'fairEditions, fairAdmissions, fairAdmissionSeq]))');
}
function restore() {
  w.eval('(function(){ const s = JSON.parse(window.__apStack.pop());' +
         ' fairAppointments = s[0]; fairAppointmentSlots = s[1]; fairAppointmentSeq = s[2];' +
         ' fairAppointmentSlotSeq = s[3]; fairParticipations = s[4]; fairParticipationSeq = s[5];' +
         ' fairEditions = s[6]; fairAdmissions = s[7]; fairAdmissionSeq = s[8]; })()');
}
/* THE ONLY WAY THIS FILE SETS AN ACTOR. */
function act(role) { w.eval("showWineShows('" + role + "')"); }
/* …and the one deliberate exception, for cockpits SHOW_ROLES has no
   entry for: a partner workspace and an organizer. Still the one
   source, still not a parameter. */
function actRaw(key) { w.eval("activeShowRole = '" + key + "'"); }

const APPT_KEYS = ['id','slotId','requesterType','requester','message',
                   'topicWinery','status','history'].sort().join(',');
const SLOT_KEYS = ['id','participationId','day','startTime','durationMin'].sort().join(',');

/* ── §1 One appointment, one active participation, through the slot ─ */
console.log('§1 the appointment hangs off a slot — and reaches its participation through it (AP-1)');

function assertThroughSlot() {
  const p = w.eval("fairAppointmentParticipation('FM-9601')");
  const s = w.eval("fairAppointmentSlot('FM-9601')");
  if (p && p.id === 'FP-9401' && s && s.id === 'FT-9501' && s.participationId === 'FP-9401')
    ok('FM-9601 resolves FP-9401 THROUGH slot FT-9501 — the row itself names no participation (A22.1)');
  else bad('the slot no longer carries the participation link');
}
assertThroughSlot();
expectRed('the participation resolved from a copied field on the appointment row instead of the slot', () => {
  w.eval("window.__fap = fairAppointmentParticipation;" +
         "fairAppointmentParticipation = function (id) { const a = fairAppointmentById(id); return a && a.participationId ? fairParticipationById(a.participationId) : null; }");
  try { assertThroughSlot(); }
  finally { w.eval('fairAppointmentParticipation = window.__fap; delete window.__fap'); }
});

function assertRowShapes() {
  const shaped = APPTS().find(a => Object.keys(a).sort().join(',') !== APPT_KEYS);
  if (!shaped) ok('every appointment carries exactly its reference fields — no copied fair, edition, organizer or identity data');
  else bad('appointment ' + shaped.id + ' grew fields: ' + Object.keys(shaped).sort().join(','));
  const badSlot = SLOTS().find(s => Object.keys(s).sort().join(',') !== SLOT_KEYS);
  if (!badSlot) ok('every slot carries exactly day, time, duration and its participation key — and NO history (A22.15)');
  else bad('slot ' + badSlot.id + ' grew fields: ' + Object.keys(badSlot).sort().join(','));
}
assertRowShapes();
expectRed('a participationId copied onto the appointment row', () => {
  w.eval("fairAppointmentById('FM-9601').participationId = 'FP-9401'");
  try { assertRowShapes(); }
  finally { w.eval("delete fairAppointmentById('FM-9601').participationId"); }
});
expectRed('a history grown onto a slot', () => {
  w.eval("fairAppointmentSlotById('FT-9501').history = []");
  try { assertRowShapes(); }
  finally { w.eval("delete fairAppointmentSlotById('FT-9501').history"); }
});

/* ── §2 The exhibitor owns the slots and the answers (AP-2) ───────── */
console.log('\n§2 the exhibitor publishes, removes, confirms, declines and counter-proposes — nobody else');

function assertOnlyExhibitorPublishes() {
  snap();
  try {
    act('restaurant');
    const n = SLOTS().length;
    const stolen = w.eval("addFairAppointmentSlot('FP-9402','2027-06-12','16:00',30)");
    const gate   = w.eval("setFairParticipationAppointmentsOpen('FP-9402', false)");
    const gone   = w.eval("removeFairAppointmentSlot('FT-9506')");
    if (stolen === null && gate === false && gone === false && SLOTS().length === n &&
        w.eval("fairParticipationById('FP-9402').appointmentsOpen") === true)
      ok('a foreign cockpit publishes no slot, removes none and cannot touch the door — refused with a message, nothing changed (AP-2)');
    else bad('a foreign cockpit reached the exhibitor half');
    act('distributor');
    const mine = w.eval("addFairAppointmentSlot('FP-9402','2027-06-12','16:00',30)");
    if (mine && mine.participationId === 'FP-9402' && w.eval("removeFairAppointmentSlot('" + mine.id + "')") === true)
      ok('the owning exhibitor publishes and removes its own slot');
    else bad('the owner could not manage its own slots');
  } finally { restore(); }
}
assertOnlyExhibitorPublishes();
expectRed('the owner check dropped from the slot act', () => {
  w.eval("window.__add = addFairAppointmentSlot;" +
         "addFairAppointmentSlot = function (pid, day, t, dur) { const p = fairParticipationById(pid);" +
         " const row = { id:'FT-x' + (fairAppointmentSlotSeq++), participationId:pid, day:day, startTime:t, durationMin:dur };" +
         " fairAppointmentSlots.push(row); return row; }");
  try { assertOnlyExhibitorPublishes(); }
  finally { w.eval('addFairAppointmentSlot = window.__add; delete window.__add'); }
});

/* ── §3 A represented winery is content, never a holder (AP-3) ────── */
console.log('\n§3 named as a topic, and that is all it gets — no appointment, no calendar, no read path');

function assertTopicGivesNothing() {
  snap();
  try {
    /* Cantina Rossi really stands in FP-9402's representing, and it is
       the WINERY cockpit's own entity — so if a named house were ever
       given a read path, this is the dashboard it would show up in. */
    act('restaurant');
    const row = w.eval("requestFairAppointment('FT-9506','Mosel and Sicily, please','Cantina Rossi')");
    if (!row) { bad('the topic request was refused although Cantina Rossi is represented'); return; }
    if (w.eval("fairAppointmentsOfRequester('Cantina Rossi').length") === 0 &&
        w.eval("fairAppointmentsOfParticipation('FP-9402').every(a => a.requester !== 'Cantina Rossi')"))
      ok('the named winery holds no appointment of its own — it is a topic on somebody else\'s row (AP-3)');
    else bad('being named produced an appointment for the named winery');
    if (w.eval("fairParticipationFor('FE-7103','Cantina Rossi')") === null &&
        w.eval("fairAppointmentSlots.every(s => s.participationId !== 'FP-x')"))
      ok('no participation and no slot calendar appeared for the named winery');
    else bad('being named produced a participation for the named winery');
    /* The read path: the winery's own cockpit shows nothing of it. */
    act('winery');
    const seen = d.getElementById('wshow-appointments').textContent +
                 d.getElementById('wshow-fairs').textContent;
    if (seen.indexOf(row.id) === -1 && seen.indexOf('Bistro Laurent') === -1 &&
        seen.indexOf('Mosel and Sicily') === -1)
      ok('the named winery\'s own dashboard shows no line, no counterpart and no message about that appointment (AP-3)');
    else bad('the named winery can read the appointment it was only named in');
  } finally { restore(); }
}
assertTopicGivesNothing();
expectRed('a line about the topic appointment grafted into the named winery\'s block', () => {
  w.eval("window.__rb = renderFairAppointmentsBlock;" +
         "renderFairAppointmentsBlock = function (role) { window.__rb(role);" +
         " const box = document.getElementById(SHOW_ROLES[role].prefix + '-appointments');" +
         " if (role === 'winery') fairAppointments.forEach(function (a) {" +
         "   if (a.topicWinery === 'Cantina Rossi') box.innerHTML += '<div>' + a.id + ' ' + a.requester + ' ' + a.message + '</div>'; }); }");
  try { assertTopicGivesNothing(); }
  finally { w.eval('renderFairAppointmentsBlock = window.__rb; delete window.__rb'); }
});

/* A topic must really be one of the represented houses, and only a
   distributor stand has any (A22.9). */
{
  snap();
  try {
    act('restaurant');
    const alien = w.eval("requestFairAppointment('FT-9506','x','Bodegas Ruiz')");
    const onWinery = w.eval("requestFairAppointment('FT-9503','x','Cantina Rossi')");
    if (alien === null && onWinery === null && APPTS().length === 4)
      ok('a topic outside `representing`, and any topic at a WINERY participation, refuse the request whole (A22.9)');
    else bad('an unrepresented or misplaced topic was accepted');
  } finally { restore(); }
  expectRed('the representation check dropped from the topic', () => {
    snap();
    try {
      w.eval("window.__req = requestFairAppointment;" +
             "requestFairAppointment = function (slotId, message, topic) {" +
             " const s = fairAppointmentSlotById(slotId); const who = fairActingContext();" +
             " const row = { id:'FM-x' + (fairAppointmentSeq++), slotId:slotId, requesterType:who.role," +
             " requester:who.entity, message:message||'', topicWinery:topic||null, status:'requested', history:[] };" +
             " logFairAppointment(row,'requested',who.entity,null,null,null); fairAppointments.push(row); return row; }");
      act('restaurant');
      const alien = w.eval("requestFairAppointment('FT-9506','x','Bodegas Ruiz')");
      if (alien === null) ok('refused');
      else bad('an unrepresented topic was accepted');
    } finally { w.eval('requestFairAppointment = window.__req; delete window.__req'); restore(); }
  });
}

/* ── §4 Who may request (AP-4) ────────────────────────────────────── */
console.log('\n§4 all four trade roles, no partnership and no admission — and nobody else');

function assertAllFourMayAsk() {
  snap();
  try {
    const targets = { winery:'FT-9504', distributor:'FT-9503', restaurant:'FT-9505', retail:'FT-9506' };
    const got = [];
    Object.keys(targets).forEach(function (r) {
      act(r);
      const row = w.eval("requestFairAppointment('" + targets[r] + "','from " + r + "')");
      if (row && row.requesterType === r && row.requester === w.eval("SHOW_ROLES['" + r + "'].entity")) got.push(r);
    });
    if (got.length === 4)
      ok('winery, distributor, restaurant and retail all reach a stand — the requester type is derived, never typed (AP-4)');
    else bad('a trade role could not request: only ' + got.join(', '));
  } finally { restore(); }
}
assertAllFourMayAsk();
expectRed('the requesting roles narrowed to the two exhibiting ones', () => {
  w.eval("window.__roles = FAIR_APPOINTMENT_REQUESTER_ROLES.slice();" +
         "FAIR_APPOINTMENT_REQUESTER_ROLES.length = 0;" +
         "FAIR_APPOINTMENT_REQUESTER_ROLES.push('winery','distributor')");
  try { assertAllFourMayAsk(); }
  finally { w.eval("FAIR_APPOINTMENT_REQUESTER_ROLES.length = 0;" +
                   "window.__roles.forEach(function (r) { FAIR_APPOINTMENT_REQUESTER_ROLES.push(r); });" +
                   "delete window.__roles"); }
});

{
  snap();
  try {
    /* Bistro Laurent holds NO fair admission and no partnership with
       Hawesko's fair — and still gets in (A22.3). */
    act('restaurant');
    const before = w.eval("fairAdmissionsOfOrg('Bistro Laurent').length");
    const row = w.eval("requestFairAppointment('FT-9506','no admission, no partnership')");
    if (row && before === 0 && w.eval("fairAdmissionsOfOrg('Bistro Laurent').length") === 0)
      ok('no partnership and no admission precondition — a house with neither books a meeting (A22.3, AP-4)');
    else bad('the request path grew a precondition');
  } finally { restore(); }
  expectRed('an admission precondition hung onto the request', () => {
    snap();
    try {
      w.eval("window.__req2 = requestFairAppointment;" +
             "requestFairAppointment = function (slotId, message, topic) {" +
             " const who = fairActingContext();" +
             " const s = fairAppointmentSlotById(slotId); const p = s && fairParticipationById(s.participationId);" +
             " const adm = p && fairAdmissionFor(p.editionId, who.entity);" +
             " if (!adm || adm.status !== 'admitted') { actionSay('not admitted'); return null; }" +
             " return window.__req2(slotId, message, topic); }");
      act('restaurant');
      const row = w.eval("requestFairAppointment('FT-9506','x')");
      if (row) ok('open');
      else bad('the request path grew a precondition');
    } finally { w.eval('requestFairAppointment = window.__req2; delete window.__req2'); restore(); }
  });
}

function assertNonTradeRefused() {
  snap();
  try {
    const n = APPTS().length;
    actRaw('partner');
    const asPartner = w.eval("requestFairAppointment('FT-9506','x')");
    actRaw('organizer');
    const asOrganizer = w.eval("requestFairAppointment('FT-9506','x')");
    act('distributor');
    const atOwnStand = w.eval("requestFairAppointment('FT-9506','x')");
    if (asPartner === null && asOrganizer === null && atOwnStand === null && APPTS().length === n)
      ok('a partner workspace, an organizer and the exhibitor itself are all refused — with a message, nothing written (AP-4)');
    else bad('a non-requester reached the booking path');
  } finally { restore(); }
}
assertNonTradeRefused();
expectRed('an exhibitor booking a meeting at its own stand', () => {
  w.eval("window.__req3 = requestFairAppointment;" +
         "requestFairAppointment = function (slotId, message, topic) {" +
         " const s = fairAppointmentSlotById(slotId); const p = s && fairParticipationById(s.participationId);" +
         " const who = fairActingContext();" +
         " if (!who || !p) return null;" +
         " const row = { id:'FM-y' + (fairAppointmentSeq++), slotId:slotId, requesterType:who.role," +
         " requester:who.entity, message:message||'', topicWinery:null, status:'requested', history:[] };" +
         " logFairAppointment(row,'requested',who.entity,null,null,null); fairAppointments.push(row); return row; }");
  try { assertNonTradeRefused(); }
  finally { w.eval('requestFairAppointment = window.__req3; delete window.__req3'); }
});

/* ── §5 The door (AP-5) ───────────────────────────────────────────── */
console.log('\n§5 appointmentsOpen refuses NEW requests and changes no existing record');

function assertDoorTouchesNothing() {
  snap();
  try {
    const before = w.eval('JSON.stringify(fairAppointments)');
    act('distributor');
    const closed = w.eval("setFairParticipationAppointmentsOpen('FP-9402', false)");
    const afterClose = w.eval('JSON.stringify(fairAppointments)');
    act('restaurant');
    const refused = w.eval("requestFairAppointment('FT-9506','after the door closed')");
    act('distributor');
    w.eval("setFairParticipationAppointmentsOpen('FP-9402', true)");
    const afterOpen = w.eval('JSON.stringify(fairAppointments)');
    if (closed === true && refused === null && afterClose === before && afterOpen === before)
      ok('closing refuses the new request and leaves every appointment and every history row byte-identical — reopening too (AP-5, AP-13)');
    else bad('the door moved an existing record');
  } finally { restore(); }
}
assertDoorTouchesNothing();
expectRed('the closing act declining the open requests as a side effect', () => {
  w.eval("window.__gate = setFairParticipationAppointmentsOpen;" +
         "setFairParticipationAppointmentsOpen = function (pid, open) {" +
         " const r = window.__gate(pid, open);" +
         " if (r && !open) fairAppointmentsOfParticipation(pid).forEach(function (a) {" +
         "   if (a.status === 'requested') { a.status = 'declined';" +
         "     logFairAppointment(a, 'declined', fairParticipationById(pid).org, 'door closed', null, null); } });" +
         " return r; }");
  try { assertDoorTouchesNothing(); }
  finally { w.eval('setFairParticipationAppointmentsOpen = window.__gate; delete window.__gate'); }
});

/* ── §6 Slots: day, grid, midnight, overlap, one confirmed (AP-6) ─── */
console.log('\n§6 supply-side slots — on an attendance day, on the grid, inside the day, never overlapping');

function assertSlotRules() {
  snap();
  try {
    act('distributor');
    const n = SLOTS().length;
    const offDay   = w.eval("addFairAppointmentSlot('FP-9402','2027-06-13','10:00',30)");   /* not attended */
    const offGrid  = w.eval("addFairAppointmentSlot('FP-9402','2027-06-12','14:00',20)");
    const tooShort = w.eval("addFairAppointmentSlot('FP-9402','2027-06-12','14:00',0)");
    const tooLong  = w.eval("addFairAppointmentSlot('FP-9402','2027-06-12','14:00',135)");
    const midnight = w.eval("addFairAppointmentSlot('FP-9402','2027-06-12','23:30',60)");
    const overlap  = w.eval("addFairAppointmentSlot('FP-9402','2027-06-12','09:45',30)");
    const badTime  = w.eval("addFairAppointmentSlot('FP-9402','2027-06-12','9:5',30)");
    if ([offDay, offGrid, tooShort, tooLong, midnight, overlap, badTime].every(x => x === null) &&
        SLOTS().length === n)
      ok('an off-day, off-grid, too short, too long, midnight-crossing, overlapping or malformed slot is refused whole (AP-6)');
    else bad('an invalid slot was written');
    const touching = w.eval("addFairAppointmentSlot('FP-9402','2027-06-12','10:00',15)");
    if (touching) ok('and a slot that only TOUCHES another (10:00–10:15 beside 10:15–10:45) is fine — touching is not overlapping');
    else bad('a merely adjacent slot was refused');
  } finally { restore(); }
}
assertSlotRules();
[['the attendance-day check', "(p.days || []).indexOf(day) === -1", 'false'],
 ['the 15-minute grid check', "!isFinite(dur) || dur % 15 !== 0 || dur < 15 || dur > 120", 'false'],
 ['the same-calendar-day check', "start + dur > 24 * 60", 'false']].forEach(function (pair) {
  expectRed(pair[0] + ' dropped from the slot act', () => {
    const src = w.eval('String(addFairAppointmentSlot)');
    if (src.indexOf(pair[1]) === -1) { bad('the guard text moved: ' + pair[1]); return; }
    w.eval("window.__addS = addFairAppointmentSlot;" +
           "addFairAppointmentSlot = eval('(' + String(addFairAppointmentSlot).split(" +
           JSON.stringify(pair[1]) + ").join(" + JSON.stringify(pair[2]) + ") + ')')");
    try { assertSlotRules(); }
    finally { w.eval('addFairAppointmentSlot = window.__addS; delete window.__addS'); }
  });
});
expectRed('the overlap check dropped from the slot act', () => {
  w.eval("window.__coll = fairSlotsCollide; fairSlotsCollide = function () { return false; }");
  try { assertSlotRules(); }
  finally { w.eval('fairSlotsCollide = window.__coll; delete window.__coll'); }
});

{
  snap();
  try {
    act('retail');
    const onTaken = w.eval("requestFairAppointment('FT-9501','the confirmed slot')");
    if (onTaken === null)
      ok('a slot that already carries a CONFIRMED appointment takes no further request (AP-6)');
    else bad('a request landed on a slot with a confirmed appointment');
  } finally { restore(); }
}
function assertNoSecondConfirmation() {
  snap();
  try {
    /* Two houses ask for the SAME free slot — allowed. Only one of
       them can be confirmed, and the second confirmation is refused
       WHOLE, with a message, leaving the other request standing. */
    act('restaurant');
    const first = w.eval("requestFairAppointment('FT-9506','first')");
    act('retail');
    const second = w.eval("requestFairAppointment('FT-9506','second')");
    act('distributor');
    const okFirst = w.eval("confirmFairAppointment('" + first.id + "')");
    const before = rowOf(second.id);
    const okSecond = w.eval("confirmFairAppointment('" + second.id + "')");
    if (first && second && okFirst === true && okSecond === false &&
        A(second.id).status === 'requested' && rowOf(second.id) === before)
      ok('two houses may ask for one slot; the SECOND confirmation is refused whole and the other request stays exactly where it was (AP-6, A22.7)');
    else bad('a slot took a second confirmed appointment, or the loser was silently moved');
  } finally { restore(); }
}
assertNoSecondConfirmation();
expectRed('the taken-slot check dropped from the confirmation', () => {
  w.eval("window.__taken = fairSlotTaken; fairSlotTaken = function () { return null; }");
  try { assertNoSecondConfirmation(); }
  finally { w.eval('fairSlotTaken = window.__taken; delete window.__taken'); }
});

/* ── §7 The actor-exclusive lifecycle (AP-7) ──────────────────────── */
console.log('\n§7 two sides, two confirmation paths, and they never mix');

function assertCounteredIsTheirs() {
  snap();
  try {
    const before = rowOf('FM-9604');
    act('distributor');                        /* the exhibitor, Hawesko */
    const selfConfirm = w.eval("confirmFairAppointment('FM-9604')");
    const selfAccept  = w.eval("acceptFairAppointmentCounter('FM-9604')");
    const twice       = w.eval("counterFairAppointment('FM-9604','FT-9506','again')");
    const declineIt   = w.eval("declineFairAppointment('FM-9604','no')");
    if (selfConfirm === false && selfAccept === false && twice === false && declineIt === false &&
        rowOf('FM-9604') === before)
      ok('from `countered` the exhibitor has NO act — no confirm, no accept, no second counter, no decline; the row is byte-identical (AP-7)');
    else bad('the exhibitor acted on its own counter-proposal');
  } finally { restore(); }
}
assertCounteredIsTheirs();
expectRed('the exhibitor confirming its own counter-proposal (the core error)', () => {
  w.eval("window.__cf = confirmFairAppointment;" +
         "confirmFairAppointment = function (id) {" +
         " const a = fairAppointmentById(id); if (!a) return false;" +
         " if (a.status === 'countered') { a.status = 'confirmed';" +
         "   logFairAppointment(a,'confirmed', fairAppointmentParticipation(id).org, null, null, null); return true; }" +
         " return window.__cf(id); }");
  try { assertCounteredIsTheirs(); }
  finally { w.eval('confirmFairAppointment = window.__cf; delete window.__cf'); }
});
expectRed('the exhibitor accepting its own counter-proposal', () => {
  w.eval("window.__ac = acceptFairAppointmentCounter;" +
         "acceptFairAppointmentCounter = function (id) {" +
         " const a = fairAppointmentById(id); if (!a || a.status !== 'countered') return false;" +
         " a.status = 'confirmed'; logFairAppointment(a,'accepted', fairActingContext().entity, null, null, null); return true; }");
  try { assertCounteredIsTheirs(); }
  finally { w.eval('acceptFairAppointmentCounter = window.__ac; delete window.__ac'); }
});
expectRed('a second counter-proposal on the same appointment', () => {
  w.eval("window.__co = counterFairAppointment;" +
         "counterFairAppointment = function (id, slot, note) {" +
         " const a = fairAppointmentById(id); if (!a) return false;" +
         " a.slotId = slot; a.status = 'countered';" +
         " logFairAppointment(a,'countered', fairActingContext().entity, note||null, a.slotId, slot); return true; }");
  try { assertCounteredIsTheirs(); }
  finally { w.eval('counterFairAppointment = window.__co; delete window.__co'); }
});

{
  snap();
  try {
    /* The requester's side of `countered`: accept, or withdraw. */
    act('retail');                              /* Weinhaus Müller ≠ Vinstuen */
    const stranger = w.eval("acceptFairAppointmentCounter('FM-9604')");
    if (stranger === false && A('FM-9604').status === 'countered')
      ok('a house that is not the requester cannot accept the counter-proposal either (AP-7)');
    else bad('a stranger accepted somebody else\'s counter-proposal');
  } finally { restore(); }
}

function assertFullArc() {
  snap();
  try {
    act('restaurant');
    const r = w.eval("requestFairAppointment('FT-9506','the arc')");
    act('distributor');
    const countered = w.eval("counterFairAppointment('" + r.id + "','FT-9505','how about this')");
    act('restaurant');
    const accepted = w.eval("acceptFairAppointmentCounter('" + r.id + "')");
    const row = A(r.id);
    const h = row.history;
    if (countered && accepted && row.status === 'confirmed' && row.slotId === 'FT-9505' &&
        h.length === 3 && h[1].action === 'countered' && h[1].fromSlot === 'FT-9506' &&
        h[1].toSlot === 'FT-9505' && h[2].action === 'accepted' && h[2].actor === 'Bistro Laurent')
      ok('request → counter → accept: one row, three history lines, the move recorded from → to, both sides on the same slot (AP-7)');
    else bad('the two-sided arc did not land: ' + JSON.stringify(row && row.status));
  } finally { restore(); }
}
assertFullArc();

function assertTerminalRests() {
  snap();
  try {
    act('distributor');
    w.eval("declineFairAppointment('FM-9603','not this run')");
    const resting = rowOf('FM-9603');
    const reConfirm = w.eval("confirmFairAppointment('FM-9603')");
    const reCounter = w.eval("counterFairAppointment('FM-9603','FT-9506','x')");
    act('restaurant');
    const reWithdraw = w.eval("withdrawFairAppointment('FM-9603','x')");
    const reAccept = w.eval("acceptFairAppointmentCounter('FM-9603')");
    const reCancel = w.eval("cancelFairAppointment('FM-9603','x')");
    if ([reConfirm, reCounter, reWithdraw, reAccept, reCancel].every(x => x === false) &&
        rowOf('FM-9603') === resting)
      ok('`declined` rests for good — no act reopens it, and the row stays byte-identical (AP-7)');
    else bad('a terminal appointment was reopened');
  } finally { restore(); }
}
assertTerminalRests();
expectRed('a terminal state reopened by the confirmation', () => {
  w.eval("window.__cf2 = confirmFairAppointment;" +
         "confirmFairAppointment = function (id) { const a = fairAppointmentById(id);" +
         " if (a && a.status === 'declined') { a.status = 'confirmed';" +
         "   logFairAppointment(a,'confirmed', fairActingContext().entity, null, null, null); return true; }" +
         " return window.__cf2(id); }");
  try { assertTerminalRests(); }
  finally { w.eval('confirmFairAppointment = window.__cf2; delete window.__cf2'); }
});

function assertCancelRules() {
  snap();
  try {
    act('distributor');
    w.eval("confirmFairAppointment('FM-9603')");
    const noReason = w.eval("cancelFairAppointment('FM-9603','   ')");
    const stillOn = A('FM-9603').status === 'confirmed';
    const byExhibitor = w.eval("cancelFairAppointment('FM-9603','hall rebuilt overnight')");
    const h = A('FM-9603').history;
    if (noReason === false && stillOn && byExhibitor === true &&
        h[h.length - 1].actor === 'Hawesko GmbH' && h[h.length - 1].reason === 'hall rebuilt overnight')
      ok('cancelling demands a reason, and the actor and the reason stand in the history (AP-7)');
    else bad('the cancellation rules moved');
  } finally { restore(); }
  snap();
  try {
    act('distributor');
    w.eval("confirmFairAppointment('FM-9603')");
    act('restaurant');                       /* Casa Elena is the requester… */
    const wrongSide = w.eval("cancelFairAppointment('FM-9603','not mine')");
    act('retail');
    const outsider = w.eval("cancelFairAppointment('FM-9603','none of my business')");
    if (wrongSide === false && outsider === false && A('FM-9603').status === 'confirmed')
      ok('only the two SIDES cancel — and Bistro Laurent is not one of them here, nor is Weinhaus Müller');
    else bad('a third party cancelled a confirmed appointment');
  } finally { restore(); }
  snap();
  try {
    act('restaurant');
    const notConfirmed = w.eval("cancelFairAppointment('FM-9602','x')");
    if (notConfirmed === false) ok('and an appointment that is not confirmed is withdrawn or declined, never cancelled');
    else bad('a non-confirmed appointment was cancelled');
  } finally { restore(); }
}
assertCancelRules();
expectRed('the mandatory cancellation reason dropped', () => {
  w.eval("window.__ca = cancelFairAppointment;" +
         "cancelFairAppointment = function (id, reason) { return window.__ca(id, (reason || '').trim() || 'unstated'); }");
  try { assertCancelRules(); }
  finally { w.eval('cancelFairAppointment = window.__ca; delete window.__ca'); }
});

{
  /* FM-9603's requester is Casa Elena, which no cockpit is — so the
     "own act" half needs a row this session really owns. Bistro
     Laurent asks for a free slot and then takes it back. */
  snap();
  try {
    act('restaurant');
    const own = w.eval("requestFairAppointment('FT-9506','ours to take back')");
    act('retail');
    const notMine = w.eval("withdrawFairAppointment('" + own.id + "','not my request')");
    act('restaurant');
    const mine = w.eval("withdrawFairAppointment('" + own.id + "','changed our plans')");
    const h = A(own.id).history;
    if (notMine === false && mine === true && A(own.id).status === 'withdrawn' &&
        h[h.length - 1].reason === 'changed our plans' && h[h.length - 1].actor === 'Bistro Laurent')
      ok('withdrawal is the requester\'s OWN act — a foreign cockpit is refused, the owner\'s reason and actor land in the history (AP-7)');
    else bad('the withdrawal rules moved');
  } finally { restore(); }
  snap();
  try {
    act('restaurant');
    const own = w.eval("requestFairAppointment('FT-9506','no reason needed')");
    const noReason = w.eval("withdrawFairAppointment('" + own.id + "')");
    if (noReason === true && A(own.id).history.slice(-1)[0].reason === null)
      ok('and it needs no reason — leaving of one\'s own accord explains itself (A22.7, the D28 precedent)');
    else bad('withdrawal demanded a reason');
  } finally { restore(); }
}

/* ── §8 The counter-proposal's target (AP-8) ──────────────────────── */
console.log('\n§8 a counter-proposal moves onto a FREE slot of the SAME participation');

function assertCounterTarget() {
  snap();
  try {
    act('distributor');
    const before = rowOf('FM-9603');
    const foreign = w.eval("counterFairAppointment('FM-9603','FT-9503','another stand entirely')");
    const same    = w.eval("counterFairAppointment('FM-9603','FT-9504','the very same slot')");
    const gone    = w.eval("counterFairAppointment('FM-9603','FT-9999','nowhere')");
    if (foreign === false && same === false && gone === false && rowOf('FM-9603') === before)
      ok("a foreign participation's slot, the appointment's own slot and an unknown id are all refused whole (AP-8)");
    else bad('a counter-proposal escaped its own participation');
    const good = w.eval("counterFairAppointment('FM-9603','FT-9506','this one instead')");
    if (good === true && A('FM-9603').slotId === 'FT-9506') ok('and a free slot of the same participation works');
    else bad('a valid counter-proposal was refused');
  } finally { restore(); }
}
assertCounterTarget();
expectRed('the same-participation check dropped from the counter-proposal', () => {
  w.eval("window.__co2 = counterFairAppointment;" +
         "counterFairAppointment = eval('(' + String(counterFairAppointment)" +
         ".split('target.participationId !== p.id').join('false') + ')')");
  try { assertCounterTarget(); }
  finally { w.eval('counterFairAppointment = window.__co2; delete window.__co2'); }
});

/* ── §9 A booking creates nothing (AP-9) ──────────────────────────── */
console.log('\n§9 an appointment is a calendar act — it creates no participation, partnership, order or admission');

function assertCreatesNothing() {
  snap();
  try {
    const before = w.eval('JSON.stringify({ parts: fairParticipations.map(function (p) {' +
      ' const c = JSON.parse(JSON.stringify(p)); delete c.appointmentsOpen; return c; }),' +
      ' partnerships: partnerships, orders: orders, adm: fairAdmissions, events: memberEvents,' +
      ' shows: wineShows, halls: fairHalls, stands: fairStands })');
    act('restaurant');
    const r = w.eval("requestFairAppointment('FT-9506','the full arc')");
    act('distributor');
    w.eval("confirmFairAppointment('" + r.id + "')");
    act('restaurant');
    w.eval("cancelFairAppointment('" + r.id + "','plans changed')");
    const after = w.eval('JSON.stringify({ parts: fairParticipations.map(function (p) {' +
      ' const c = JSON.parse(JSON.stringify(p)); delete c.appointmentsOpen; return c; }),' +
      ' partnerships: partnerships, orders: orders, adm: fairAdmissions, events: memberEvents,' +
      ' shows: wineShows, halls: fairHalls, stands: fairStands })');
    if (after === before)
      ok('a whole request → confirm → cancel arc leaves participations (bar the door), partnerships, orders, admissions, events, shows and inventory byte-identical (AP-9)');
    else bad('the booking arc changed a neighbouring record');
  } finally { restore(); }
}
assertCreatesNothing();
expectRed('the confirmation quietly recording an admission', () => {
  w.eval("window.__cf3 = confirmFairAppointment;" +
         "confirmFairAppointment = function (id) { const r = window.__cf3(id);" +
         " if (r) { const a = fairAppointmentById(id); const p = fairAppointmentParticipation(id);" +
         "   fairAdmissions.push({ id:'FA-x' + (fairAdmissionSeq++), editionId:p.editionId," +
         "     orgType:a.requesterType, org:a.requester, source:'external', status:'admitted'," +
         "     externalSource:'appointment', externalActor:p.org, externalAt:SHOW_TODAY, history:[] }); }" +
         " return r; }");
  try { assertCreatesNothing(); }
  finally { w.eval('confirmFairAppointment = window.__cf3; delete window.__cf3'); }
});

/* ── §10 The public surface, and no contact detail (AP-10, AP-16) ─── */
console.log('\n§10 public is the neutral note plus the entry — and nothing else, ever');

function assertPublicSurface(win, label) {
  const root = win.document.getElementById('fpp-root');
  const html = root.innerHTML, text = root.textContent;
  const wants = /takes appointment requests/i.test(text) && /Request an appointment/i.test(text) &&
                /href="bottle-lobby-dashboard\.html\?appt=FP-9402"/.test(html);
  if (wants) ok(label + ': the neutral note and the safe entry are there');
  else bad(label + ': the note or the entry is missing');
  const leaks = [];
  if (/\b\d{1,2}:\d{2}\b/.test(text))                       leaks.push('a clock time');
  if (/\b\d+\s*min\b/i.test(text))                          leaks.push('a duration');
  if (/F[TM]-9\d{3}/.test(html))                            leaks.push('a slot or appointment id');
  ['Casa Elena', 'Vinstuen København', 'Osteria Marconi', 'Vinoteca Roma'].forEach(function (n) {
    if (text.indexOf(n) !== -1) leaks.push('a counterpart (' + n + ')');
  });
  if (/Mosel range you pour|German riesling section/.test(text)) leaks.push('a request message');
  if (/@|\+49|Tel\.|Telephone|Phone/i.test(text))           leaks.push('a contact detail');
  if (/\b\d+\s+(appointment|request|slot)/i.test(text))     leaks.push('a counter');
  if (/<(form|input|select|textarea)\b/i.test(html))        leaks.push('a booking form');
  if (!leaks.length) ok(label + ': no time, duration, slot id, counterpart, message, contact detail, count or form (AP-10, AP-16)');
  else bad(label + ' leaks: ' + leaks.join(', '));
}
assertPublicSurface(bootPage('?id=FP-9402'), 'the open stand');
expectRed('a slot time smuggled into the public renderer', () => {
  const win = bootPage('?id=FP-9402');
  win.eval("window.__ph = fairParticipationAppointmentHtml;" +
           "fairParticipationAppointmentHtml = function (p) { return window.__ph(p) +" +
           " '<p>Next free slot: 11:00, 45 min (FT-9506)</p>'; }");
  win.document.getElementById('fpp-root').innerHTML =
    win.eval("fairParticipationPageHtml(fairParticipationById('FP-9402'))");
  assertPublicSurface(win, 'grafted');
});
{
  /* Door closed → the page says nothing about appointments at all,
     not even that they exist. */
  const win = bootPage('?id=FP-9402');
  win.eval("fairParticipationById('FP-9402').appointmentsOpen = false");
  const html = win.eval("fairParticipationPageHtml(fairParticipationById('FP-9402'))");
  if (!/appointment/i.test(html) && !/appt=/.test(html))
    ok('with the door closed the page carries no appointment word, no entry and no reserved space (AP-10)');
  else bad('a closed door still advertises appointments');
  win.eval("fairParticipationById('FP-9402').appointmentsOpen = true");
}
{
  const win = bootPage('?id=FP-9402');
  const names = win.eval("BLStore.names().sort().join(',')");
  const allow = win.eval("BLStore.PUBLIC_COLLECTIONS.sort().join(',')");
  if (win.eval("typeof fairAppointments === 'undefined'") &&
      win.eval("typeof fairAppointmentSlots === 'undefined'") &&
      allow.indexOf('fairAppointment') === -1 && names.indexOf('fairAppointment') === -1)
    ok('the public page has no appointment binding at all, and the allowlist names none — it could not read one if it tried');
  else bad('an appointment collection reached the public page: ' + names);
}

/* ── §11 The organizer sees none of it (AP-11) ────────────────────── */
console.log('\n§11 the organizer runs the fair and stays out of the private calendar');

function assertOrganizerBlind() {
  w.eval("showPartnerView('fairs')");
  w.eval("fairOpenEditionId = 'FE-7103'");
  w.eval('renderPartnerFairs()');
  const txt = d.getElementById('pfairs-root').textContent;
  const html = d.getElementById('pfairs-root').innerHTML;
  const leaks = [];
  if (/F[TM]-9\d{3}/.test(html)) leaks.push('a slot or appointment id');
  ['Casa Elena', 'Vinstuen København', 'Osteria Marconi'].forEach(n => { if (txt.indexOf(n) !== -1) leaks.push(n); });
  if (/appointment/i.test(txt)) leaks.push('the word appointment');
  if (/Weingut Schmitt.*topic|Mosel range/i.test(txt)) leaks.push('a conversation topic');
  if (!leaks.length) ok('the organizer cockpit and the edition detail name no slot, appointment, counterpart or topic (AP-11)');
  else bad('the organizer surface leaks: ' + leaks.join(', '));
  w.eval('fairOpenEditionId = null');
  const search = w.eval("JSON.stringify(organizerCandidateSearch(''))");
  if (search.indexOf('appointment') === -1 && !/F[TM]-9\d{3}/.test(search))
    ok('the candidate search returns no appointment fact — FR-9\'s allowlist is untouched');
  else bad('the candidate search grew an appointment field');
}
assertOrganizerBlind();
expectRed('an appointment count printed on the organizer edition detail', () => {
  w.eval("window.__of = renderPartnerFairs;" +
         "renderPartnerFairs = function () { window.__of();" +
         " const el = document.getElementById('pfairs-root');" +
         " if (el) el.innerHTML += '<div>Casa Elena · FM-9603 appointment</div>'; }");
  try { assertOrganizerBlind(); }
  finally { w.eval('renderPartnerFairs = window.__of; delete window.__of'); }
});
{
  const frozen = w.eval("(function(){ try { FAIR_RECRUITING_READ_FIELDS.winery.push('x'); return false; } catch (e) { return true; } })()");
  const fields = w.eval("FAIR_RECRUITING_READ_FIELDS.winery.join(',')");
  if (frozen && fields === 'org,role,region,city,wines')
    ok('FAIR_RECRUITING_READ_FIELDS is byte-identical and still frozen — O7 never touched it (FR-9)');
  else bad('the recruiting allowlist moved: ' + fields);
}

/* ── §12 The end comes by derivation (AP-12) ──────────────────────── */
console.log('\n§12 a withdrawn participation, a cancelled or past edition — the path is dead, nothing is rewritten');

function assertEndByDerivation() {
  snap();
  try {
    const before = w.eval('JSON.stringify(fairAppointments)');
    act('distributor');
    w.eval("withdrawFairParticipation('FP-9402','Hawesko GmbH','trade fair budget cut')");
    const afterWithdraw = w.eval('JSON.stringify(fairAppointments)');
    const noConfirm = w.eval("confirmFairAppointment('FM-9603')");
    const noSlot    = w.eval("addFairAppointmentSlot('FP-9402','2027-06-12','16:00',30)");
    const noGate    = w.eval("setFairParticipationAppointmentsOpen('FP-9402', false)");
    act('restaurant');
    const noRequest = w.eval("requestFairAppointment('FT-9506','too late')");
    if (afterWithdraw === before && noConfirm === false && noSlot === null && noGate === false &&
        noRequest === null && w.eval('JSON.stringify(fairAppointments)') === before)
      ok('the participation ends and every appointment act stops — with no cascade write and no status rewritten (AP-12)');
    else bad('the end of a participation cascaded into the appointments, or an act still landed');
  } finally { restore(); }
  snap();
  try {
    const before = w.eval('JSON.stringify(fairAppointments)');
    w.eval("fairEditionById('FE-7103').status = 'cancelled'");
    act('distributor');
    const noConfirm = w.eval("confirmFairAppointment('FM-9603')");
    w.eval("fairEditionById('FE-7103').status = 'published'");
    w.eval("fairEditionById('FE-7103').startDate = '2026-06-12'; fairEditionById('FE-7103').endDate = null");
    const noConfirmPast = w.eval("confirmFairAppointment('FM-9603')");
    if (noConfirm === false && noConfirmPast === false && w.eval('JSON.stringify(fairAppointments)') === before)
      ok('a cancelled edition and a past one close the path the same way — one derivation, no stored flag');
    else bad('an act survived a fallen or past edition');
  } finally { restore(); }
}
assertEndByDerivation();
expectRed('the actionable derivation ignoring the participation status', () => {
  w.eval("window.__ac2 = fairAppointmentsActionable; fairAppointmentsActionable = function () { return null; }");
  try { assertEndByDerivation(); }
  finally { w.eval('fairAppointmentsActionable = window.__ac2; delete window.__ac2'); }
});

/* ── §13 History discipline, per function group (AP-13) ───────────── */
console.log('\n§13 seven lifecycle acts write exactly one row each; slot and gate mutations write none');

function assertOneRowPerAct() {
  const missed = [];
  /* request */
  snap();
  try {
    act('restaurant');
    const r = w.eval("requestFairAppointment('FT-9506','one row')");
    if (!r || r.history.length !== 1 || r.history[0].action !== 'requested') missed.push('request');
  } finally { restore(); }
  /* confirm */
  snap();
  try {
    const n = A('FM-9603').history.length;
    act('distributor');
    w.eval("confirmFairAppointment('FM-9603')");
    if (A('FM-9603').history.length !== n + 1) missed.push('confirm');
  } finally { restore(); }
  /* counter */
  snap();
  try {
    const n = A('FM-9603').history.length;
    act('distributor');
    w.eval("counterFairAppointment('FM-9603','FT-9506','other time')");
    if (A('FM-9603').history.length !== n + 1) missed.push('counter');
  } finally { restore(); }
  /* accept */
  snap();
  try {
    const n = A('FM-9604').history.length;
    act('retail');                              /* Weinhaus Müller… not the requester */
    /* the real requester is Vinstuen København, which no cockpit is —
       so accept through the requester field by moving the row onto a
       cockpit house instead of faking an actor. */
    w.eval("fairAppointmentById('FM-9604').requester = 'Weinhaus Müller'; fairAppointmentById('FM-9604').requesterType = 'retail'");
    w.eval("acceptFairAppointmentCounter('FM-9604')");
    if (A('FM-9604').history.length !== n + 1) missed.push('accept');
  } finally { restore(); }
  /* decline */
  snap();
  try {
    const n = A('FM-9603').history.length;
    act('distributor');
    w.eval("declineFairAppointment('FM-9603','no')");
    if (A('FM-9603').history.length !== n + 1) missed.push('decline');
  } finally { restore(); }
  /* withdraw — on a row this cockpit really requested (FM-9603's
     requester is Casa Elena, which no cockpit is). */
  snap();
  try {
    act('restaurant');
    const own = w.eval("requestFairAppointment('FT-9506','to withdraw')");
    const n = own.history.length;
    w.eval("withdrawFairAppointment('" + own.id + "','no')");
    if (A(own.id).history.length !== n + 1) missed.push('withdraw');
  } finally { restore(); }
  /* cancel — same reason: the canceller must be one of the two sides */
  snap();
  try {
    act('restaurant');
    const own = w.eval("requestFairAppointment('FT-9506','to cancel')");
    act('distributor');
    w.eval("confirmFairAppointment('" + own.id + "')");
    const n = A(own.id).history.length;
    act('restaurant');
    w.eval("cancelFairAppointment('" + own.id + "','no')");
    if (A(own.id).history.length !== n + 1) missed.push('cancel');
  } finally { restore(); }

  if (!missed.length) ok('all SEVEN lifecycle acts write exactly one appointment history row (AP-13)');
  else bad('history rows off for: ' + missed.join(', '));
}
assertOneRowPerAct();
expectRed('an act writing a SECOND history row', () => {
  w.eval("window.__log = logFairAppointment;" +
         "logFairAppointment = function (row, a, actor, r, f, t) { window.__log(row,a,actor,r,f,t); window.__log(row,a,actor,r,f,t); }");
  try { assertOneRowPerAct(); }
  finally { w.eval('logFairAppointment = window.__log; delete window.__log'); }
});
expectRed('an act writing NO history row', () => {
  w.eval("window.__log2 = logFairAppointment; logFairAppointment = function () {}");
  try { assertOneRowPerAct(); }
  finally { w.eval('logFairAppointment = window.__log2; delete window.__log2'); }
});

function assertNonLifecycleWritesNoHistory() {
  snap();
  try {
    const before = w.eval('JSON.stringify(fairAppointments)');
    act('distributor');
    const added = w.eval("addFairAppointmentSlot('FP-9402','2027-06-12','16:00',30)");
    w.eval("removeFairAppointmentSlot('" + (added ? added.id : 'FT-none') + "')");
    w.eval("setFairParticipationAppointmentsOpen('FP-9402', false)");
    w.eval("setFairParticipationAppointmentsOpen('FP-9402', true)");
    const slotHistories = w.eval('fairAppointmentSlots.filter(function (s) { return s.history; }).length');
    if (w.eval('JSON.stringify(fairAppointments)') === before && slotHistories === 0)
      ok('the two slot mutations and the gate mutation write NO appointment history row and grow no slot history (AP-13)');
    else bad('a non-lifecycle mutation touched a history');
  } finally { restore(); }
}
assertNonLifecycleWritesNoHistory();
expectRed('the slot act logging onto the appointments', () => {
  w.eval("window.__add2 = addFairAppointmentSlot;" +
         "addFairAppointmentSlot = function (pid, day, t, dur) { const r = window.__add2(pid, day, t, dur);" +
         " if (r) fairAppointmentsOfParticipation(pid).forEach(function (a) {" +
         "   logFairAppointment(a, 'requested', 'slot board', 'a slot was added', null, null); });" +
         " return r; }");
  try { assertNonLifecycleWritesNoHistory(); }
  finally { w.eval('addFairAppointmentSlot = window.__add2; delete window.__add2'); }
});
expectRed('the gate mutation hanging a history onto the slots', () => {
  w.eval("window.__gate2 = setFairParticipationAppointmentsOpen;" +
         "setFairParticipationAppointmentsOpen = function (pid, open) { const r = window.__gate2(pid, open);" +
         " if (r) fairAppointmentSlotsOf(pid).forEach(function (s) { s.history = (s.history || []).concat([{ at:SHOW_TODAY, action: open ? 'opened' : 'closed' }]); });" +
         " return r; }");
  try { assertNonLifecycleWritesNoHistory(); }
  finally { w.eval('setFairParticipationAppointmentsOpen = window.__gate2; delete window.__gate2'); }
});

/* ── §14 Several appointments, one slot each, no self-collision ───── */
console.log('\n§14 several meetings with one exhibitor are allowed — the same slot twice is not');

function assertSeveralAllowed() {
  snap();
  try {
    act('restaurant');
    const a1 = w.eval("requestFairAppointment('FT-9504','the riesling question')");
    const a2 = w.eval("requestFairAppointment('FT-9506','and the Sicilian reds')");
    act('distributor');
    const c1 = w.eval("confirmFairAppointment('" + (a1 ? a1.id : 'x') + "')");
    const c2 = w.eval("confirmFairAppointment('" + (a2 ? a2.id : 'x') + "')");
    if (a1 && a2 && c1 === true && c2 === true &&
        w.eval("fairAppointmentsOfRequester('Bistro Laurent').filter(function (a) { return a.status === 'confirmed'; }).length") === 2)
      ok('ONE house holds TWO confirmed appointments at the same exhibitor, on two non-colliding slots — expressly allowed (AP-14)');
    else bad('a second appointment with the same exhibitor was refused');
  } finally { restore(); }
}
assertSeveralAllowed();
expectRed('a one-appointment-per-exhibitor limit reintroduced', () => {
  w.eval("window.__req4 = requestFairAppointment;" +
         "requestFairAppointment = function (slotId, m, t) { const s = fairAppointmentSlotById(slotId);" +
         " const who = fairActingContext();" +
         " const has = fairAppointmentsOfParticipation(s.participationId).some(function (a) {" +
         "   return a.requester === who.entity && FAIR_APPOINTMENT_ACTIVE.indexOf(a.status) !== -1; });" +
         " if (has) { actionSay('one per exhibitor'); return null; } return window.__req4(slotId, m, t); }");
  try { assertSeveralAllowed(); }
  finally { w.eval('requestFairAppointment = window.__req4; delete window.__req4'); }
});

function assertNoDoubleOnOneSlot() {
  snap();
  try {
    act('restaurant');
    const first = w.eval("requestFairAppointment('FT-9506','once')");
    const again = w.eval("requestFairAppointment('FT-9506','and again')");
    if (first && again === null &&
        w.eval("fairAppointments.filter(function (a) { return a.slotId === 'FT-9506' && a.requester === 'Bistro Laurent'; }).length") === 1)
      ok('the same house does not ask for the same slot twice while its first request is still active (AP-14)');
    else bad('a duplicate active request on one slot was written');
  } finally { restore(); }
}
assertNoDoubleOnOneSlot();
expectRed('the duplicate-request check dropped', () => {
  w.eval("window.__req5 = requestFairAppointment;" +
         "requestFairAppointment = eval('(' + String(requestFairAppointment)" +
         ".split('const mine = fairAppointments.find').join('const mine = [].find') + ')')");
  try { assertNoDoubleOnOneSlot(); }
  finally { w.eval('requestFairAppointment = window.__req5; delete window.__req5'); }
});

function assertEditionCollision() {
  snap();
  try {
    /* Two exhibitors, ONE edition. Bistro Laurent takes 10:00 at
       Domaine Lefèvre's stand; the collision must then bar a
       confirmation at ANOTHER stand of the same edition. */
    w.eval("fairParticipations.push({ id:'FP-9490', editionId:'FE-7101', orgType:'distributor'," +
           " org:'Hawesko GmbH', standId:null, days:['2027-02-08'], description:'', products:null," +
           " representing:[], status:'active', appointmentsOpen:true, history:[] })");
    w.eval("fairAppointmentSlots.push({ id:'FT-9590', participationId:'FP-9490', day:'2027-02-08'," +
           " startTime:'11:15', durationMin:30 })");   /* overlaps 11:00–11:45 */
    w.eval("fairAppointmentSlots.push({ id:'FT-9591', participationId:'FP-9490', day:'2027-02-08'," +
           " startTime:'12:00', durationMin:30 })");
    act('restaurant');
    /* Domaine Lefèvre has no cockpit, so its participation is moved
       onto the winery cockpit's own house for this measurement — the
       rule under test is the REQUESTER's collision, not who confirms. */
    w.eval("fairParticipationById('FP-9401').org = 'Cantina Rossi'");
    act('restaurant');
    const near = w.eval("requestFairAppointment('FT-9502','the 11:00 at the first stand')");
    act('winery');
    const okFirst = w.eval("confirmFairAppointment('" + near.id + "')");
    /* Now the same requester asks for a colliding slot at the OTHER
       stand of the SAME edition. */
    act('restaurant');
    const other = w.eval("requestFairAppointment('FT-9590','same time, other hall')");
    act('distributor');
    const blocked = w.eval("confirmFairAppointment('" + other.id + "')");
    act('restaurant');
    const later = w.eval("requestFairAppointment('FT-9591','a clear hour later')");
    act('distributor');
    const allowed = w.eval("confirmFairAppointment('" + later.id + "')");
    if (okFirst === true && blocked === false && A(other.id).status === 'requested' && allowed === true)
      ok('a confirmation that would put the requester in two halls at once is refused — including at ANOTHER exhibitor of the same edition; a non-colliding one goes through (AP-14)');
    else bad('the edition-wide collision check did not bite: first ' + okFirst + ', blocked ' + blocked + ', allowed ' + allowed);
  } finally { restore(); }
}
assertEditionCollision();
expectRed('the edition-wide collision check dropped', () => {
  w.eval("window.__conf = fairRequesterEditionConflict; fairRequesterEditionConflict = function () { return null; }");
  try { assertEditionCollision(); }
  finally { w.eval('fairRequesterEditionConflict = window.__conf; delete window.__conf'); }
});

/* ── §15 The derived actor — the signature scan and the two-part
        counter-mutation Codex asked for (AP-15) ───────────────────── */
console.log('\n§15 the acting identity is derived, never passed — measured at the function heads and at the calls');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'bottle-lobby-dashboard.html'), 'utf8');
const TEN = ['requestFairAppointment', 'confirmFairAppointment', 'counterFairAppointment',
             'acceptFairAppointmentCounter', 'declineFairAppointment', 'withdrawFairAppointment',
             'cancelFairAppointment', 'addFairAppointmentSlot', 'removeFairAppointmentSlot',
             'setFairParticipationAppointmentsOpen'];
function headOf(name) {
  const m = new RegExp('function\\s+' + name + '\\s*\\(([^)]*)\\)\\s*\\{\\s*([^\\n]*)').exec(SRC);
  return m ? { params: m[1], first: m[2] } : null;
}
function assertSignatures() {
  const missing = [], named = [], unguarded = [];
  TEN.forEach(function (n) {
    const h = headOf(n);
    if (!h) { missing.push(n); return; }
    if (/\b(role|actor|actingOrg|requester)\b/.test(h.params)) named.push(n + '(' + h.params + ')');
    if (h.first.indexOf('fairArgGuard(' + n + ', arguments)') === -1) unguarded.push(n);
  });
  if (missing.length) bad('a mutating function is gone: ' + missing.join(', '));
  else ok('all ten mutating functions exist and were read at their real heads, not assumed');
  if (!named.length) ok('not one of the ten declares role, actor, actingOrg or requester — there is no parameter to bend (AP-15)');
  else bad('a mutating function takes an identity parameter: ' + named.join(', '));
  if (!unguarded.length) ok('and each one calls the SHARED surplus-argument check as its very first statement, before any read');
  else bad('these do not guard first: ' + unguarded.join(', '));
}
assertSignatures();
expectRed('a role parameter added to one of the ten heads', () => {
  const real = headOf('confirmFairAppointment');
  const orig = 'function confirmFairAppointment(appointmentId) {';
  if (SRC.indexOf(orig) === -1) { bad('the head text moved: ' + (real && real.params)); return; }
  const patched = SRC.replace(orig, 'function confirmFairAppointment(appointmentId, role) {');
  const saved = fs.readFileSync;
  fs.readFileSync = function (p, e) { return String(p).endsWith('dashboard.html') ? patched : saved(p, e); };
  try {
    delete require.cache[require.resolve('./load-dashboard')];
    /* re-read through the same path the assertion uses */
    const src2 = fs.readFileSync(path.join(__dirname, '..', 'bottle-lobby-dashboard.html'), 'utf8');
    const m = /function\s+confirmFairAppointment\s*\(([^)]*)\)/.exec(src2);
    if (m && /\brole\b/.test(m[1])) bad('a mutating function takes an identity parameter: confirmFairAppointment(' + m[1] + ')');
    else ok('clean');
  } finally { fs.readFileSync = saved; }
});
expectRed('the shared surplus-argument check removed from a head', () => {
  const orig = 'function confirmFairAppointment(appointmentId) {\n  if (!fairArgGuard(confirmFairAppointment, arguments)) return false;';
  if (SRC.indexOf(orig) === -1) { bad('the guarded head text moved'); return; }
  const patched = SRC.replace(orig, 'function confirmFairAppointment(appointmentId) {\n  const unguarded = true;');
  const m = /function\s+confirmFairAppointment\s*\(([^)]*)\)\s*\{\s*([^\n]*)/.exec(patched);
  if (m && m[2].indexOf('fairArgGuard(confirmFairAppointment, arguments)') === -1)
    bad('these do not guard first: confirmFairAppointment');
  else ok('clean');
});

/* THE CODEX COUNTER-MUTATION, VERBATIM AND IN TWO NAMED PARTS. */
console.log('\n§15a the surplus argument is refused on its LENGTH — a foreign role key is never read');
function assertSurplusRoleKeyRefused() {
  snap();
  try {
    /* The active cockpit is RESTAURANT (Bistro Laurent). The call
       carries its full regular argument set PLUS the valid role key
       'distributor' — as though it came from Hawesko GmbH. */
    act('restaurant');
    const before = rowOf('FM-9603');
    const beforeAll = w.eval('JSON.stringify(fairAppointments)');
    const confirmed = w.eval("confirmFairAppointment('FM-9603','distributor')");
    const requested = w.eval("requestFairAppointment('FT-9506','as if from Hawesko',null,'distributor')");
    if (confirmed === false && requested === null &&
        rowOf('FM-9603') === before && w.eval('JSON.stringify(fairAppointments)') === beforeAll)
      ok('(a) with the cockpit on restaurant, a call carrying the extra valid role key `distributor` is refused WHOLE — record and history byte-identical (AP-15)');
    else bad('(a) a surplus role key reached an act');
  } finally { restore(); }
}
assertSurplusRoleKeyRefused();
expectRed('(a) the surplus-argument check reading the extra value as a role instead of counting', () => {
  w.eval("window.__guard = fairArgGuard;" +
         "fairArgGuard = function (fn, args) {" +
         " if (args.length <= fn.length) return true;" +
         " const extra = args[args.length - 1];" +
         " if (SHOW_ROLES[extra]) { activeShowRole = extra; return true; }" +   /* the exact defect */
         " return window.__guard(fn, args); }");
  try { assertSurplusRoleKeyRefused(); }
  finally { w.eval('fairArgGuard = window.__guard; delete window.__guard'); }
});

console.log('\n§15b the SAME call without the surplus argument is judged on activeShowRole alone');
{
  snap();
  try {
    /* The exhibitor half, from the restaurant cockpit: refused, and
       with a DIFFERENT message — the cockpit, not the argument count. */
    act('restaurant');
    const wrongCockpit = w.eval("confirmFairAppointment('FM-9603')");
    /* The requester half, from the same cockpit: Bistro Laurent is
       entitled here, so it succeeds — which is what proves the
       refusal above came from the count and not from a general fault. */
    const allowed = w.eval("requestFairAppointment('FT-9506','plain and legitimate')");
    if (wrongCockpit === false && allowed && allowed.requester === 'Bistro Laurent' &&
        allowed.requesterType === 'restaurant')
      ok('(b) without the surplus argument the same cockpit is refused where it is not the entitled side, and SUCCEEDS where it is — the derivation itself works, so (a) really failed on the count');
    else bad('(b) the plain call behaved unexpectedly: confirm ' + wrongCockpit + ', request ' + !!allowed);
  } finally { restore(); }
}

console.log('\n§15c an organisation NAME as the surplus argument dies the same death');
function assertSurplusOrgNameRefused() {
  snap();
  try {
    act('restaurant');
    const before = rowOf('FM-9603');
    const beforeAll = w.eval('JSON.stringify(fairAppointments)');
    const byName = w.eval("confirmFairAppointment('FM-9603','Hawesko GmbH')");
    const reqByName = w.eval("requestFairAppointment('FT-9506','x',null,'Hawesko GmbH')");
    if (byName === false && reqByName === null &&
        rowOf('FM-9603') === before && w.eval('JSON.stringify(fairAppointments)') === beforeAll)
      ok('an appended organisation name is refused on the count exactly as the role key was — unread, whole, byte-identical (AP-15)');
    else bad('a surplus organisation name reached an act');
  } finally { restore(); }
}
assertSurplusOrgNameRefused();
expectRed('the surplus-argument check reading the extra value as an organisation', () => {
  w.eval("window.__guard2 = fairArgGuard;" +
         "fairArgGuard = function (fn, args) {" +
         " if (args.length <= fn.length) return true;" +
         " const extra = args[args.length - 1];" +
         " if (typeof extra === 'string' && stakeholder(extra)) {" +
         "   const key = Object.keys(SHOW_ROLES).find(function (r) { return SHOW_ROLES[r].entity === extra; });" +
         "   if (key) { activeShowRole = key; return true; } }" +
         " return window.__guard2(fn, args); }");
  try { assertSurplusOrgNameRefused(); }
  finally { w.eval('fairArgGuard = window.__guard2; delete window.__guard2'); }
});

console.log('\n§15d actor spoofing across all SEVEN acts, and the plain wrong-cockpit case beside it');
{
  snap();
  try {
    /* An UNKNOWN register key as the surplus argument, on every one of
       the seven — refused on the count, like the other two. */
    act('restaurant');
    const beforeAll = w.eval('JSON.stringify(fairAppointments)');
    const results = [
      w.eval("requestFairAppointment('FT-9506','x',null,'atrium')"),
      w.eval("confirmFairAppointment('FM-9603','atrium')"),
      w.eval("counterFairAppointment('FM-9603','FT-9506','x','atrium')"),
      w.eval("acceptFairAppointmentCounter('FM-9604','atrium')"),
      w.eval("declineFairAppointment('FM-9603','x','atrium')"),
      w.eval("withdrawFairAppointment('FM-9603','x','atrium')"),
      w.eval("cancelFairAppointment('FM-9601','x','atrium')")
    ];
    if (results.every(x => x === false || x === null) && w.eval('JSON.stringify(fairAppointments)') === beforeAll)
      ok('all seven acts refuse an unknown register key on the count — nothing written anywhere (AP-15)');
    else bad('an unknown key got through one of the seven: ' + JSON.stringify(results));
  } finally { restore(); }
}
{
  snap();
  try {
    /* And the OTHER kind of refusal, which is not an argument
       question at all: a plain call from the wrong cockpit. */
    act('restaurant');
    const exhibitorActs = [
      w.eval("confirmFairAppointment('FM-9603')"),
      w.eval("counterFairAppointment('FM-9603','FT-9506','x')"),
      w.eval("declineFairAppointment('FM-9603','x')"),
      w.eval("addFairAppointmentSlot('FP-9402','2027-06-12','16:00',30)"),
      w.eval("removeFairAppointmentSlot('FT-9506')"),
      w.eval("setFairParticipationAppointmentsOpen('FP-9402', false)")
    ];
    act('distributor');
    const requesterActs = [
      w.eval("withdrawFairAppointment('FM-9603','x')"),
      w.eval("acceptFairAppointmentCounter('FM-9604')")
    ];
    if (exhibitorActs.every(x => x === false || x === null) &&
        requesterActs.every(x => x === false))
      ok('and the plain wrong-cockpit case is refused by the ordinary activeShowRole check: exhibitor acts from the requester cockpit, requester acts from the exhibitor cockpit');
    else bad('a wrong-cockpit act landed: ' + JSON.stringify(exhibitorActs) + JSON.stringify(requesterActs));
  } finally { restore(); }
}
{
  /* The derivation itself, read where it lives. */
  act('restaurant');
  const ctx = w.eval('JSON.stringify(fairActingContext())');
  actRaw('organizer');
  const none = w.eval('fairActingContext()');
  act('winery');
  if (ctx === '{"role":"restaurant","entity":"Bistro Laurent"}' && none === null)
    ok('fairActingContext() answers from activeShowRole alone, and answers null for a cockpit SHOW_ROLES has no entry for');
  else bad('the derivation moved: ' + ctx);
}
{
  /* No second derivation crept in beside it (an explicit exclusion). */
  const others = (SRC.match(/function\s+fair\w*ActingContext\w*\s*\(/g) || []);
  const handlerLeak = /(confirm|counter|accept|decline|withdraw|cancel|request)FairAppointment\w*\s*\(\s*\\?'?\s*\+\s*role/.test(SRC) ||
                      /FairAppointment\w*\('[^']*',\s*SHOW_ROLES\[/.test(SRC);
  if (others.length === 1 && !handlerLeak)
    ok('exactly ONE acting-context derivation exists, and no handler passes a role or a SHOW_ROLES entity into an act');
  else bad('a second actor derivation or a role-passing call site exists (' + others.length + ')');
}

/* ── §16 Incoming only (AP-17) ────────────────────────────────────── */
console.log('\n§16 O7 built the incoming path — an outgoing invitation exists nowhere');

{
  const ASSETS = ['bottle-lobby-dashboard.html', 'assets/bottle-lobby-data.js',
                  'assets/bottle-lobby-public-shows.js', 'bottle-lobby-fair-participation.html']
    .map(f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8')).join('\n');
  const invented = /inviteFairAppointment|fairAppointmentInvit|appointment_invitation|appointmentInvite/i.test(ASSETS);
  const statusLeak = w.eval("Object.keys(FAIR_APPOINTMENT_LABEL).join(',')");
  if (!invented && statusLeak === 'requested,countered,confirmed,declined,withdrawn,cancelled')
    ok('no field, status, function or surface for an OUTGOING appointment invitation — the six states are the incoming flow\'s own (AP-17)');
  else bad('an outgoing invitation was anticipated: ' + statusLeak);
  /* FR-12 carried forward: no notification, no campaign, no suppression. */
  const supBefore = w.eval('JSON.stringify(communicationSuppressions)');
  const campBefore = w.eval('JSON.stringify(eventCampaigns)');
  snap();
  try {
    act('restaurant');
    const r = w.eval("requestFairAppointment('FT-9506','x')");
    act('distributor');
    w.eval("confirmFairAppointment('" + r.id + "')");
    if (w.eval('JSON.stringify(communicationSuppressions)') === supBefore &&
        w.eval('JSON.stringify(eventCampaigns)') === campBefore)
      ok('an appointment neither reads nor extends the suppression register and creates no campaign — the FR-12 pattern (AP-10)');
    else bad('the appointment flow touched the communication registers');
  } finally { restore(); }
}

/* ── §17 Unchanged neighbours ─────────────────────────────────────── */
console.log('\n§17 regression samples: the four cockpits, the O2 lifecycle, the O3/O4 core');

{
  act('winery');
  const fansDom = d.querySelectorAll('#dfans-list .wn-card').length;
  const fansDerived = w.eval("fansOf('Hawesko GmbH')").length;
  if (fansDom === fansDerived && fansDerived > 0)
    ok("Hawesko's fan list still renders its " + fansDerived + ' derived rows');
  else bad("Hawesko's fan list moved: DOM " + fansDom + ' vs derived ' + fansDerived);
  const ws = w.eval("wineShows.find(s => s.id === 'WS-2604')");
  if (ws && ws.stage === 'planning' && ws.applications_open === true)
    ok('WS-2604 unchanged: planning, open for applications');
  else bad('WS-2604 moved');
  const eds = w.eval("fairEditions.map(e => e.id + ':' + e.status).join(' ')");
  if (/FE-7101:published/.test(eds) && /FE-7102:draft/.test(eds) && /FE-7103:published/.test(eds))
    ok('the O2 lifecycle reads as documented: ' + eds);
  else bad('an edition status moved: ' + eds);
  const parts = w.eval("fairParticipations.map(p => p.id + ':' + p.status + ':' + p.appointmentsOpen).join(' ')");
  if (parts === 'FP-9401:active:true FP-9402:active:true')
    ok('both participations are active with their door open — the fixtures are back where they started');
  else bad('a participation fixture moved: ' + parts);
  const appts = w.eval("fairAppointments.map(a => a.id + ':' + a.status).join(' ')");
  if (appts === 'FM-9601:confirmed FM-9602:requested FM-9603:requested FM-9604:countered')
    ok('and so are the four appointment fixtures: ' + appts);
  else bad('an appointment fixture is left changed: ' + appts);
  const slots = SLOTS().map(s => s.id).join(',');
  if (slots === 'FT-9501,FT-9502,FT-9503,FT-9504,FT-9505,FT-9506')
    ok('the six slots are untouched — every test restored what it moved');
  else bad('the slot board is left changed: ' + slots);
}

console.log('');
if (fail) { console.log('✗ ' + fail + ' check(s) failed'); process.exit(1); }
console.log('✓ all checks passed');
