/* ═══════════════════════════════════════════════════════════════════
   FAIR SERIES & EDITIONS — A19, FS-1..FS-7 (pass O2)
   -------------------------------------------------------------------
   The smallest canonical fair: the series as the durable brand, the
   edition as one concrete run, both owned by the verified organizer
   workspace and by nobody else. As in tests/platform-partners.js,
   every invariant is measured twice — the CLAIM, and the
   COUNTER-MUTATION that breaks the rule and must turn the same check
   red.

   WHAT THIS HARNESS SECURES — AND WHAT IT DOES NOT. §5's
   findability-is-not-entitlement checks pin the AS-IS STATE OF
   DURCHGANG 12: no application, appointment or other business action
   hangs off an edition today. They do NOT forbid the later passes
   that build exactly those (O3 recruiting, O7 appointments) — when
   one comes, it moves these assertions deliberately, with its
   measurement in hand.
═══════════════════════════════════════════════════════════════════ */
const { loadDashboard } = require('./load-dashboard');
const { JSDOM, VirtualConsole } = require('jsdom');

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
const SERIES   = () => w.eval('fairSeries');
const EDITIONS = () => w.eval('fairEditions');
const RENDER   = () => w.eval("renderPartnerFairs()");
const ROOT     = () => { RENDER(); return d.getElementById('pfairs-root').innerHTML; };
const TRADE_ROLES = ['winery', 'distributor', 'restaurant', 'retail'];
w.eval("showPartnerView('fairs')");

/* ── §1 Belonging and ownership (FS-1, FS-2) ─────────────────────── */
console.log('§1 one series per edition, one owner — and it is never a trade role');

function assertBelonging() {
  const orphan = EDITIONS().find(e =>
    SERIES().filter(s => s.id === e.seriesId).length !== 1);
  if (!orphan) ok('every edition resolves to exactly one series (FS-1)');
  else bad('edition ' + orphan.id + ' does not belong to exactly one series');
}
assertBelonging();
expectRed('an edition pointed at a series that does not exist', () => {
  w.eval("fairEditions[0].seriesId = 'FS-0000'");
  try { assertBelonging(); }
  finally { w.eval("fairEditions[0].seriesId = 'FS-7001'"); }
});

function assertOwnership() {
  const badOwner = SERIES().find(s => {
    const p = w.eval('platformPartner(' + JSON.stringify(s.organizerId) + ')');
    return !p || p.capabilities.indexOf('organizer') === -1;
  });
  if (!badOwner) ok('every series is owned by an organizer-capability platform partner (FS-2)');
  else bad('series ' + badOwner.id + ' is owned by "' + badOwner.organizerId + '" — not an organizer workspace (D44)');
  const asHouse = SERIES().find(s =>
    !w.eval('stakeholder(' + JSON.stringify(s.organizerId) + ')').unknown);
  if (!asHouse) ok('no series owner is a trade stakeholder');
  else bad('series ' + asHouse.id + ' is owned by a trade house (FS-2)');
}
assertOwnership();
expectRed('a trade role smuggled in as the series owner', () => {
  w.eval("fairSeries[0].organizerId = 'Hawesko GmbH'");
  try { assertOwnership(); }
  finally { w.eval("fairSeries[0].organizerId = 'PP-9001'"); }
});

/* Management refuses a workspace that does not own the series. The
   demo has one workspace, so "foreign" is a series owned by another
   id — the act must bounce and change nothing. */
function assertForeignManagementRefused() {
  w.eval("fairSeries[0].organizerId = 'PP-9999'");
  try {
    const before = w.eval("fairEditionById('FE-7102').city");
    const okAct = w.eval("updateFairEditionBasics('FE-7102', { city: 'MUTATED' })");
    const after = w.eval("fairEditionById('FE-7102').city");
    if (okAct === false && after === before)
      ok('a foreign-owned series refuses management and the record is untouched (FS-1)');
    else bad('a workspace managed an edition of a series it does not own');
  } finally { w.eval("fairSeries[0].organizerId = 'PP-9001'"); }
}
assertForeignManagementRefused();
expectRed('the ownership gate swapped for a yes-sayer', () => {
  w.eval('window.__fairGate = fairSeriesManagedHere; fairSeriesManagedHere = function () { return true; }');
  try { assertForeignManagementRefused(); }
  finally { w.eval('fairSeriesManagedHere = window.__fairGate; delete window.__fairGate; fairEditionById("FE-7102").city = "Wiesbaden"'); }
});

/* ── §2 Two publication preconditions, both the register's last word ─ */
console.log('\n§2 publishing takes both last words — and either level can withdraw it (FS-3)');

function freshDraft() {
  return w.eval("createFairEdition('FS-7001', { fairType:'trade', startDate:'2028-05-01' })");
}
function dropEdition(id) {
  w.eval("fairEditions = fairEditions.filter(e => e.id !== '" + id + "')");
}
{
  const ed = freshDraft();
  if (w.eval("publishFairEdition('" + ed.id + "')") === true)
    ok('with both approvals current, a draft publishes');
  else bad('publishing failed although both preconditions hold');
  dropEdition(ed.id);
}
/* Withdrawal, level (a): a LATER rejected partner_verification row —
   the approved row is still in the array, and that must not save the
   act (the register's last word, PP-4). */
function assertWorkspaceRejectionWithdraws() {
  const ed = freshDraft();
  w.eval("reviews.push({ id:'RVW-MUT-WSREJ', subjectType:'partner', subjectId:'PP-9001', gateNumber:null, reviewStatus:'rejected', reviewedBy:'Bottle Lobby', reviewedAt:'2026-07-30', reviewNotes:null, approvalType:'partner_verification' })");
  try {
    if (w.eval("publishFairEdition('" + ed.id + "')") === false &&
        w.eval("fairEditionById('" + ed.id + "').status") === 'draft')
      ok('a later rejected row on the WORKSPACE level withdraws the right to publish');
    else bad('publishing survived a later workspace rejection (FS-3a)');
  } finally {
    w.eval("reviews = reviews.filter(r => r.id !== 'RVW-MUT-WSREJ')");
    dropEdition(ed.id);
  }
}
assertWorkspaceRejectionWithdraws();
expectRed('an any-row workspace derivation under the last-word check', () => {
  w.eval("window.__fairWsDerive = partnerVerificationApproved; " +
         "partnerVerificationApproved = function (p) { return reviewsFor('partner', p.id).some(r => r.approvalType === 'partner_verification' && r.reviewStatus === 'approved'); }");
  try { assertWorkspaceRejectionWithdraws(); }
  finally { w.eval('partnerVerificationApproved = window.__fairWsDerive; delete window.__fairWsDerive'); }
});
/* Withdrawal, level (b): the series' OWN brand rows — the second
   precondition, its own subject, its own counter-mutation. */
function assertSeriesRejectionWithdraws() {
  const ed = freshDraft();
  w.eval("reviews.push({ id:'RVW-MUT-SBREJ', subjectType:'fair_series', subjectId:'FS-7001', gateNumber:null, reviewStatus:'rejected', reviewedBy:'Bottle Lobby', reviewedAt:'2026-07-30', reviewNotes:null, approvalType:'series_brand_review' })");
  try {
    if (w.eval("publishFairEdition('" + ed.id + "')") === false &&
        w.eval("fairEditionById('" + ed.id + "').status") === 'draft')
      ok('a later rejected row on the SERIES level withdraws the right to publish');
    else bad('publishing survived a later series brand rejection (FS-3b)');
  } finally {
    w.eval("reviews = reviews.filter(r => r.id !== 'RVW-MUT-SBREJ')");
    dropEdition(ed.id);
  }
}
assertSeriesRejectionWithdraws();
expectRed('an any-row series derivation under the last-word check', () => {
  w.eval("window.__fairSbDerive = seriesBrandApproved; " +
         "seriesBrandApproved = function (s) { return reviewsFor('fair_series', s.id).some(r => r.approvalType === 'series_brand_review' && r.reviewStatus === 'approved'); }");
  try { assertSeriesRejectionWithdraws(); }
  finally { w.eval('seriesBrandApproved = window.__fairSbDerive; delete window.__fairSbDerive'); }
});

/* The two badges: distinguishable on the RENDERED surface, each
   falling with its own row and never with the other's (FS-4). */
/* EVERY brand row goes, not RVW-3005 alone. O5 gave the workspace a
   SECOND series with its own approved brand row (FS-7002/RVW-3006),
   and a check that pulled one row while another series still carried
   its own would have measured "somewhere on this surface a brand is
   approved" instead of the rule. The rule is per subject, so the
   measurement is over the subject class. */
function assertBadgesIndependent() {
  const brandRows = w.eval("JSON.stringify(reviews.filter(r => r.approvalType === 'series_brand_review'))");
  w.eval("reviews = reviews.filter(r => r.approvalType !== 'series_brand_review')");
  try {
    const html = ROOT();
    if (!/Fair brand approved/.test(html) && /Verified Platform Partner/.test(html) && /Brand review/.test(html))
      ok('every brand row removed → only the brand badges fall; the workspace badge stands');
    else bad('the two badges do not derive from their own subjects (FS-4)');
  } finally {
    w.eval("reviews = reviews.concat(" + brandRows + ")");
  }
  w.eval("reviews = reviews.filter(r => r.id !== 'RVW-3004')");
  try {
    const html = ROOT();
    if (/Fair brand approved/.test(html) && !/Verified Platform Partner/.test(html))
      ok('workspace row removed → only the workspace badge falls; the brand badge stands');
    else bad('the workspace badge and the brand badge are one derivation in two coats (FS-4)');
  } finally {
    w.eval("reviews.push({ id:'RVW-3004', subjectType:'partner', subjectId:'PP-9001', gateNumber:null, reviewStatus:'approved', reviewedBy:'Bottle Lobby', reviewedAt:'2026-07-15', reviewNotes:null, approvalType:'partner_verification' })");
    RENDER();
  }
}
{
  const html = ROOT();
  if (/Verified Platform Partner/.test(html) && /Fair brand approved/.test(html))
    ok('both badges render, distinguishably worded (workspace vs fair brand)');
  else bad('the series card does not carry both badges');
}
assertBadgesIndependent();
expectRed('the brand badge derived from the workspace verification', () => {
  w.eval("window.__fairSbDerive2 = seriesBrandApproved; " +
         "seriesBrandApproved = function () { return partnerVerificationApproved(platformPartners[0]); }");
  try { assertBadgesIndependent(); }
  finally { w.eval('seriesBrandApproved = window.__fairSbDerive2; delete window.__fairSbDerive2'); RENDER(); }
});

/* ── §3 The lifecycle is the record (FS-5) ───────────────────────── */
console.log('\n§3 lifecycle — reasons are mandatory, history appends, nothing is deleted');

{
  const ed = freshDraft();
  const id = ed.id;
  if (w.eval("rescheduleFairEdition('" + id + "', '2028-06-01', null, '')") === false &&
      w.eval("fairEditionById('" + id + "').startDate") === '2028-05-01')
    ok('a date change without a reason is refused');
  else bad('a draft was rescheduled without a reason');
  const histBefore = w.eval("fairEditionById('" + id + "').history.length");
  if (w.eval("rescheduleFairEdition('" + id + "', '2028-06-01', null, 'venue moved us')") === true &&
      w.eval("fairEditionById('" + id + "').history.length") === histBefore + 1 &&
      w.eval("fairEditionById('" + id + "').history[" + histBefore + "].reason") === 'venue moved us')
    ok('a reasoned reschedule moves the date and APPENDS one history row carrying the reason');
  else bad('the reschedule did not append its reason to the history');
  const firstRow = JSON.stringify(w.eval("fairEditionById('" + id + "').history[0]"));
  w.eval("publishFairEdition('" + id + "')");
  if (JSON.stringify(w.eval("fairEditionById('" + id + "').history[0]")) === firstRow)
    ok('publishing appended — the first history row is untouched (append-only)');
  else bad('a later act rewrote an earlier history row');
  dropEdition(id);
}

function assertNoDateChangeAfterPublish() {
  const ed = freshDraft();
  w.eval("publishFairEdition('" + ed.id + "')");
  const before = w.eval("fairEditionById('" + ed.id + "').startDate");
  const refused = w.eval("rescheduleFairEdition('" + ed.id + "', '2028-12-01', null, 'a very good reason')") === false;
  const unchanged = w.eval("fairEditionById('" + ed.id + "').startDate") === before;
  if (refused && unchanged) ok('after publication the date does not move — even with a reason (A19.3)');
  else bad('a published edition was rescheduled');
  dropEdition(ed.id);
}
assertNoDateChangeAfterPublish();
expectRed('the publication bar taken out of the reschedule act', () => {
  w.eval("window.__fairResched = rescheduleFairEdition; " +
         "rescheduleFairEdition = function (id, s, e, reason) { const ed = fairEditionById(id); ed.startDate = s; ed.endDate = e || null; logFairEdition(ed, 'rescheduled', reason); return true; }");
  try { assertNoDateChangeAfterPublish(); }
  finally { w.eval('rescheduleFairEdition = window.__fairResched; delete window.__fairResched'); }
});

function assertCancellationDiscipline() {
  const ed = freshDraft();
  w.eval("publishFairEdition('" + ed.id + "')");
  try {
    if (w.eval("cancelFairEdition('" + ed.id + "', '  ')") === false &&
        w.eval("fairEditionById('" + ed.id + "').status") === 'published')
      ok('a cancellation without a reason is refused');
    else bad('a published edition was cancelled without a reason');
    w.eval("cancelFairEdition('" + ed.id + "', 'venue lost to fire damage')");
    const row = w.eval("fairEditionById('" + ed.id + "')");
    /* row === null IS the failure the splice mutation produces — a
       crash here would hide it instead of counting it. */
    const last = row && row.history[row.history.length - 1];
    if (row && row.status === 'cancelled' && last.action === 'cancelled' && last.reason === 'venue lost to fire damage')
      ok('cancelled with the reason on the history row — the record stands');
    else bad('the cancellation did not leave its reason on the record');
    if (row !== null)
      ok('the cancelled edition is still in the collection — no deletion (FS-5)');
    else bad('cancelling deleted the record');
  } finally { dropEdition(ed.id); }
}
assertCancellationDiscipline();
expectRed('the cancelled edition spliced out of the collection', () => {
  w.eval("window.__fairCancel = cancelFairEdition; " +
         "cancelFairEdition = function (id, reason) { fairEditions = fairEditions.filter(e => e.id !== id); return true; }");
  try { assertCancellationDiscipline(); }
  finally { w.eval('cancelFairEdition = window.__fairCancel; delete window.__fairCancel'); }
});

/* No delete act exists — in the data layer or on the surface. */
{
  if (w.eval("typeof deleteFairEdition === 'undefined' && typeof deleteFairSeries === 'undefined'"))
    ok('no delete function exists for a series or an edition');
  else bad('a fair delete act exists (A19.3: no deletion)');
  w.eval("fairOpenEditionId = 'FE-7101'");
  const html = ROOT();
  if (!/Delete/i.test(html)) ok('the My Fairs surface offers no Delete anywhere');
  else bad('a Delete appears on the My Fairs surface');
  w.eval('fairOpenEditionId = null');
}

/* "Past" is derived, never stored (measured finding of Messung 7). */
function assertPastDerived() {
  if (w.eval("fairEditionDiscoverable !== undefined && fairEditionPast({ startDate:'2026-01-05', endDate:'2026-01-06' })") === true &&
      w.eval("fairEditionPast({ startDate:'2027-02-08', endDate:'2027-02-09' })") === false)
    ok('"past" is answered from the edition dates against the demo today');
  else bad('the past derivation does not read the dates');
  const alien = EDITIONS().find(e => ['draft', 'published', 'cancelled'].indexOf(e.status) === -1);
  if (!alien) ok('stored status stays the minimal three — no past/postponed helper status');
  else bad('edition ' + alien.id + ' stores helper status "' + alien.status + '" (invariant 7)');
}
assertPastDerived();
expectRed('a stored past status invented on a row', () => {
  w.eval("fairEditions[0].status = 'past'");
  try { assertPastDerived(); }
  finally { w.eval("fairEditions[0].status = 'published'"); }
});

/* ── §4 Visibility — drafts are private, published is findable (FS-6) ─ */
console.log('\n§4 a draft is absent outside the workspace; published is findable, all three types');

function assertDraftAbsentOutside() {
  const draft = EDITIONS().find(e => e.status === 'draft');
  if (!draft) { bad('no draft fixture to measure'); return; }
  const leak = TRADE_ROLES.find(r =>
    (d.getElementById('dash-' + r).innerHTML + d.getElementById('sidebar-' + r).innerHTML)
      .indexOf(draft.id) !== -1 ||
    (d.getElementById('dash-' + r).innerHTML).indexOf(draft.description.slice(0, 30)) !== -1);
  if (!leak) ok('the draft (' + draft.id + ') is fully absent from every trade view — no title, no counter');
  else bad('the draft leaks into the ' + leak + ' view (FS-6)');
  if (w.eval("fairEditionDiscoverable(fairEditionById('" + draft.id + "'))") === false)
    ok('the findability derivation answers false for a draft');
  else bad('a draft is publicly findable');
}
assertDraftAbsentOutside();
expectRed('the draft title hung into a trade dashboard', () => {
  const draft = EDITIONS().find(e => e.status === 'draft');
  d.getElementById('dash-retail').insertAdjacentHTML('beforeend',
    '<div id="fair-mut-leak">' + draft.id + ' — ' + draft.description + '</div>');
  try { assertDraftAbsentOutside(); }
  finally { d.getElementById('fair-mut-leak').remove(); }
});
expectRed('a draft made discoverable', () => {
  const draft = EDITIONS().find(e => e.status === 'draft');
  w.eval("fairEditionById('" + draft.id + "').status = 'published'");
  try { assertDraftAbsentOutside(); }
  finally { w.eval("fairEditionById('" + draft.id + "').status = 'draft'"); }
});

function assertPublishedFindableAllTypes() {
  const misses = ['trade', 'consumer', 'hybrid'].filter(t =>
    w.eval("fairEditionDiscoverable({ status:'published', fairType:'" + t + "' })") !== true);
  if (!misses.length) ok('published → publicly findable by default, for all three fair types');
  else bad('published editions of type ' + misses.join('/') + ' are not findable');
}
assertPublishedFindableAllTypes();
expectRed('the published fixture pulled back to draft', () => {
  w.eval("window.__fairDisc = fairEditionDiscoverable; " +
         "fairEditionDiscoverable = function (ed) { return ed.status === 'published' && ed.fairType !== 'consumer'; }");
  try { assertPublishedFindableAllTypes(); }
  finally { w.eval('fairEditionDiscoverable = window.__fairDisc; delete window.__fairDisc'); }
});

/* ── §5 Findability is not entitlement (A19.3) ─────────────────────
   Being publicly findable grants no business action ON THE EDITION —
   that is the rule, and it outlives every pass. O3 and O7 moved the
   two acts this section once pinned by absence, and each landed
   where the rule says it belongs: an admission hangs off the
   (edition, organisation) pair through its own workflow row, and a
   booth appointment hangs off a SLOT of a participation (A22.1) —
   never off the edition, and never off its public findability. So
   the measurement changed shape and kept its target: no act is
   KEYED ON AN EDITION, and the organizer's edition surface offers
   none. */
console.log('\n§5 findability grants no action');

function assertNoEntitlement() {
  /* `requestFairAppointment` exists since O7 — and its first
     argument is a SLOT id, which is the whole point: the appointment
     path starts at a published slot of an active participation, so
     there is no way from "this edition is findable" to "I may act". */
  const noEditionAct = w.eval("typeof applyToFairEdition === 'undefined' && " +
    "typeof requestFairAppointmentAtEdition === 'undefined'");
  const apptOnSlot = w.eval("typeof requestFairAppointment === 'function' && " +
    "/^function requestFairAppointment\\s*\\(\\s*slotId\\s*,/.test(String(requestFairAppointment))");
  if (noEditionAct && apptOnSlot)
    ok('no act is keyed on an edition — the O7 appointment act starts at a slot of a participation (A22.1)');
  else bad('an edition carries a business action of its own (findability ≠ entitlement)');
  w.eval("fairOpenEditionId = 'FE-7101'");
  const html = ROOT();
  if (!/Apply|Request Appointment|Book a slot/i.test(html))
    ok('the rendered edition offers no apply/appointment action');
  else bad('the edition surface offers a business action (findability ≠ entitlement)');
  w.eval('fairOpenEditionId = null');
}
assertNoEntitlement();
expectRed('an Apply button hung onto the edition file', () => {
  w.eval("fairOpenEditionId = 'FE-7101'");
  RENDER();
  d.getElementById('pfairs-root').insertAdjacentHTML('beforeend',
    '<button id="fair-mut-apply">Apply as an exhibitor</button>');
  try {
    /* the check re-reads the DOM without re-rendering, so the graft is seen */
    const html = d.getElementById('pfairs-root').innerHTML;
    if (!/Apply/i.test(html)) ok('no apply action');
    else bad('apply action present');
  } finally {
    const el = d.getElementById('fair-mut-apply'); if (el) el.remove();
    w.eval('fairOpenEditionId = null'); RENDER();
  }
});

/* ── §6 The external ticketing link — stored, editable, not public ── */
console.log('\n§6 the ticket/accreditation link is an edition fact, maintained in the basics');

{
  const url = w.eval("fairEditionById('FE-7101').externalTicketingUrl");
  if (url && /^https:\/\//.test(url)) ok('the published fixture stores its external link: ' + url);
  else bad('FE-7101 carries no external ticketing link');
  w.eval("openFairEditionModal('FS-7001','FE-7102')");
  if (d.getElementById('fef-ticketing') && d.getElementById('fair-edition-modal').classList.contains('active'))
    ok('the link is maintained in the organizer basics modal');
  else bad('the basics modal has no ticketing field');
  d.getElementById('fef-ticketing').value = 'https://autumn.example/tickets';
  w.eval('saveFairEdition()');
  if (w.eval("fairEditionById('FE-7102').externalTicketingUrl") === 'https://autumn.example/tickets')
    ok('editing the basics stores the link on the edition');
  else bad('the link edit did not land on the record');
  w.eval("fairEditionById('FE-7102').externalTicketingUrl = null");
  /* The label derives from the fair type — stored once, worded thrice. */
  const lbl = w.eval('FAIR_TICKETING_LABEL');
  if (lbl.trade !== lbl.consumer && lbl.hybrid !== lbl.trade && /accredit/i.test(lbl.trade) && /ticket/i.test(lbl.consumer))
    ok('what the link IS derives from the fair type (accreditation vs tickets vs both)');
  else bad('the ticketing label does not follow the fair type');
}
function assertLinkNotPublic() {
  const url = w.eval("fairEditionById('FE-7101').externalTicketingUrl");
  const leak = TRADE_ROLES.find(r => d.getElementById('dash-' + r).innerHTML.indexOf(url) !== -1);
  if (!leak) ok('no trade surface renders the link — O5 is its first public reader');
  else bad('the ' + leak + ' view renders the ticketing link (A19.5: not public in O2)');
}
assertLinkNotPublic();
expectRed('the link rendered onto a trade dashboard', () => {
  d.getElementById('dash-winery').insertAdjacentHTML('beforeend',
    '<a id="fair-mut-link" href="' + w.eval("fairEditionById('FE-7101').externalTicketingUrl") + '">Tickets</a>');
  try { assertLinkNotPublic(); }
  finally { d.getElementById('fair-mut-link').remove(); }
});

/* ── §6b Hardening — the span, the URL scheme, the escaped render ──
   Added after Codex's independent review of cbc80e5: the span rule is
   an A19.3/FS-5 precision (end on/after start, or NULL for one day),
   the link must be absolute http(s) (A19.5), and organizer-typed text
   reaches the DOM only escaped. */
console.log('\n§6b fair days are one valid span; the link is http(s); typed text is escaped');

function assertInvalidSpanRefused() {
  const before = EDITIONS().length;
  const ed = w.eval("createFairEdition('FS-7001', { fairType:'trade', startDate:'2028-05-10', endDate:'2028-05-08' })");
  if (ed === null && EDITIONS().length === before)
    ok('creation with the last day before the first is refused — nothing written');
  else { bad('an edition with an inverted span was created'); if (ed) dropEdition(ed.id); }
  const draft = freshDraft();
  const histBefore = w.eval("fairEditionById('" + draft.id + "').history.length");
  const refused = w.eval("rescheduleFairEdition('" + draft.id + "', '2028-07-10', '2028-07-01', 'a stated reason')") === false;
  const row = w.eval("fairEditionById('" + draft.id + "')");
  if (refused && row.startDate === '2028-05-01' && row.endDate === null && row.history.length === histBefore)
    ok('rescheduling to an inverted span is refused — date AND history untouched');
  else bad('an inverted reschedule went through or left a partial change');
  dropEdition(draft.id);
}
assertInvalidSpanRefused();
expectRed('the span validation swapped for a yes-sayer', () => {
  w.eval("window.__fairSpan = fairDatesValid; fairDatesValid = function (s) { return s ? { ok:true } : { ok:false, why:'x' }; }");
  try { assertInvalidSpanRefused(); }
  finally { w.eval('fairDatesValid = window.__fairSpan; delete window.__fairSpan'); }
});

function assertBadUrlRefused() {
  const before = EDITIONS().length;
  const ed = w.eval("createFairEdition('FS-7001', { fairType:'trade', startDate:'2028-05-01', externalTicketingUrl:'javascript:alert(1)' })");
  if (ed === null && EDITIONS().length === before)
    ok('creation with a javascript: link is refused — nothing written');
  else { bad('a non-http(s) link was accepted at creation'); if (ed) dropEdition(ed.id); }
  const linkBefore = w.eval("fairEditionById('FE-7102').externalTicketingUrl");
  const cityBefore = w.eval("fairEditionById('FE-7102').city");
  const refused = w.eval("updateFairEditionBasics('FE-7102', { city:'MUT', externalTicketingUrl:'not a url' })") === false;
  if (refused &&
      w.eval("fairEditionById('FE-7102').externalTicketingUrl") === linkBefore &&
      w.eval("fairEditionById('FE-7102').city") === cityBefore)
    ok('an unparsable link is refused on edit — and the refused form changed NO field');
  else bad('a bad link edit went through or left a partial change');
}
assertBadUrlRefused();
{
  if (w.eval("updateFairEditionBasics('FE-7102', { externalTicketingUrl:'https://autumn.example/tickets' })") === true &&
      w.eval("fairEditionById('FE-7102').externalTicketingUrl") === 'https://autumn.example/tickets')
    ok('a valid https link still lands on the record');
  else bad('the validation refuses a valid https link');
  w.eval("fairEditionById('FE-7102').externalTicketingUrl = null");
}
expectRed('the URL validation swapped for a yes-sayer', () => {
  w.eval('window.__fairUrl = fairTicketingUrlValid; fairTicketingUrlValid = function () { return true; }');
  try { assertBadUrlRefused(); }
  finally { w.eval('fairTicketingUrlValid = window.__fairUrl; delete window.__fairUrl'); }
});

/* The combined modal save is atomic: a date move plus a refused link
   must leave neither the new date nor a history row behind. */
{
  w.eval("openFairEditionModal('FS-7001','FE-7102')");
  const before = w.eval("fairEditionById('FE-7102')");
  const histBefore = before.history.length;
  d.getElementById('fef-start').value = '2027-10-20';
  d.getElementById('fef-reason').value = 'trying to move';
  d.getElementById('fef-ticketing').value = 'javascript:alert(1)';
  w.eval('saveFairEdition()');
  const after = w.eval("fairEditionById('FE-7102')");
  if (after.startDate === before.startDate && after.history.length === histBefore &&
      d.getElementById('fair-edition-modal').classList.contains('active'))
    ok('date move + refused link: the whole save bounces — no date change, no history row');
  else bad('a refused save left a partial change behind (date ' + after.startDate + ', history ' + after.history.length + ')');
  w.eval('closeFairEditionModal()');
}

function assertTypedTextEscaped() {
  w.eval("createFairSeries('<span id=\"fair-injection\">Test</span>', '<img id=\"fair-injection-img\" src=x>')");
  const sid = SERIES()[SERIES().length - 1].id;
  try {
    RENDER();
    const injected = d.getElementById('fair-injection') || d.getElementById('fair-injection-img');
    const asText = d.getElementById('pfairs-root').textContent.indexOf('<span id="fair-injection">Test</span>') !== -1;
    if (!injected && asText)
      ok('markup in a series name/about renders as TEXT and creates no element');
    else bad('organizer-typed markup reached the DOM as a live element');
  } finally {
    w.eval("fairSeries = fairSeries.filter(s => s.id !== '" + sid + "'); " +
           "reviews = reviews.filter(r => r.subjectId !== '" + sid + "')");
    RENDER();
  }
  const ed = freshDraft();
  try {
    w.eval("updateFairEditionBasics('" + ed.id + "', { description:'<b id=\"fair-injection2\">x</b>' })");
    w.eval("rescheduleFairEdition('" + ed.id + "', '2028-05-02', null, '<i id=\"fair-injection3\">r</i>')");
    w.eval("fairOpenEditionId = '" + ed.id + "'"); RENDER();
    const injected = d.getElementById('fair-injection2') || d.getElementById('fair-injection3');
    const reasonAsText = d.getElementById('pfairs-root').textContent.indexOf('<i id="fair-injection3">r</i>') !== -1;
    if (!injected && reasonAsText)
      ok('markup in description and history reason renders as text too');
    else bad('typed markup in the edition file reached the DOM as a live element');
  } finally {
    w.eval('fairOpenEditionId = null');
    dropEdition(ed.id);
    RENDER();
  }
}
assertTypedTextEscaped();
expectRed('the escaper swapped for identity', () => {
  w.eval('window.__fairEsc = notifEsc; notifEsc = function (v) { return String(v == null ? "" : v); }');
  try { assertTypedTextEscaped(); }
  finally { w.eval('notifEsc = window.__fairEsc; delete window.__fairEsc'); RENDER(); }
});

/* ── §7 Three fair types, distinguishable ─────────────────────────── */
console.log('\n§7 trade · consumer · hybrid');

function assertThreeTypes() {
  const types = w.eval('FAIR_TYPES'), lbl = w.eval('FAIR_TYPE_LABEL');
  if (types.length === 3 && ['trade', 'consumer', 'hybrid'].every(t => types.indexOf(t) !== -1))
    ok('the three fair types exist as data');
  else bad('FAIR_TYPES is not the three agreed kinds');
  if (new Set(types.map(t => lbl[t])).size === 3)
    ok('the three labels are distinct (Trade / Consumer / Hybrid Fair)');
  else bad('two fair types share a label — not distinguishable');
}
assertThreeTypes();
expectRed('two types collapsed onto one label', () => {
  w.eval("window.__fairLbl = FAIR_TYPE_LABEL.consumer; FAIR_TYPE_LABEL.consumer = FAIR_TYPE_LABEL.trade");
  try { assertThreeTypes(); }
  finally { w.eval('FAIR_TYPE_LABEL.consumer = window.__fairLbl; delete window.__fairLbl'); }
});
{
  const ed = w.eval("createFairEdition('FS-7001', { fairType:'consumer', startDate:'2028-08-01' })");
  if (ed) ok('the third type (consumer) is creatable, not just declared');
  else bad('a consumer edition cannot be created');
  if (ed) dropEdition(ed.id);
}

/* ── §8 Fixture discipline — fictitious, C7-derived ──────────────── */
console.log('\n§8 fixture discipline');

function assertFixtureDiscipline() {
  const REAL_BRANDS = ['prowein', 'vinitaly', 'vinexpo', 'wine paris', 'anuga', 'weinbörse', 'weinboerse', 'veronafiere'];
  const hit = SERIES().map(s => s.name.toLowerCase())
    .flatMap(n => REAL_BRANDS.filter(b => n.indexOf(b) !== -1));
  if (!hit.length) ok('no series borrows a real fair brand — real names stay spec prose (A16.8)');
  else bad('a fixture borrows the real brand "' + hit[0] + '"');
  const TODAY = w.eval('SHOW_TODAY');
  const brand = w.eval("seriesBrandLatest(fairSeriesById('FS-7001'))");
  const pub = w.eval("fairEditionById('FE-7101').history").find(h => h.action === 'published');
  if (brand.reviewedAt <= TODAY && brand.reviewedAt <= pub.at && pub.at <= TODAY && '2026-07-15' <= brand.reviewedAt)
    ok('C7 chain holds: verification (15 Jul) ≤ brand review (' + brand.reviewedAt + ') ≤ publication (' + pub.at + ') ≤ today');
  else bad('the fixture dates violate their C7 ceiling chain');
  if (w.eval("fairEditionById('FE-7101').startDate") > TODAY)
    ok('the published edition is upcoming — the cockpit shows a live fair today');
  else bad('the published fixture edition is already over');
  const maxSeries = Math.max(...SERIES().map(s => Number(s.id.slice(3))));
  const maxEdition = Math.max(...EDITIONS().map(e => Number(e.id.slice(3))));
  if (w.eval('fairSeriesSeq') > maxSeries && w.eval('fairEditionSeq') > maxEdition)
    ok('both id counters are ahead of every fixture id — no reload collision');
  else bad('a fair id counter would reissue an existing id');
}
assertFixtureDiscipline();

/* ── §8b EVERY published fixture edition, not just the first ────────
   O5 added three published editions under a second series, and each of
   them is a publication act that FS-3 governs: both preconditions had
   to hold at the moment it happened. The fixtures are dated, not
   executed, so the harness is where that chain is actually checked —
   for all of them, by derivation, rather than for FE-7101 by hand. */
console.log('\n§8b every published edition is publishable, dated and append-only');

function assertPublishedFixtures() {
  const TODAY = w.eval('SHOW_TODAY');
  const wsRow = w.eval("reviewsFor('partner','PP-9001').filter(r => r.approvalType === 'partner_verification')");
  const wsAt = wsRow[wsRow.length - 1].reviewedAt;
  EDITIONS().filter(e => e.status === 'published').forEach(ed => {
    const hist = ed.history || [];
    const pub = hist.find(h => h.action === 'published');
    const brand = w.eval("seriesBrandLatest(fairSeriesById('" + ed.seriesId + "'))");
    if (!pub) { bad(ed.id + ' is published with no publication row in its history'); return; }
    /* FS-3, both levels, at the moment of the act. */
    if (!(brand && brand.reviewStatus === 'approved' && brand.reviewedAt <= pub.at && wsAt <= pub.at))
      bad(ed.id + ' was published before its preconditions: workspace ' + wsAt +
          ', brand ' + (brand ? brand.reviewedAt + '/' + brand.reviewStatus : 'none') + ', published ' + pub.at);
    /* The history is append-only and in order, and nothing postdates
       the demo's today (C7's ceiling). */
    const ats = hist.map(h => h.at);
    if (ats.join('|') !== ats.slice().sort().join('|') || ats[ats.length - 1] > TODAY)
      bad(ed.id + ' has a history out of order or after today: ' + ats.join(' → '));
    if (hist[0].action !== 'created')
      bad(ed.id + ' does not open its history with its creation');
  });
  ok('all ' + EDITIONS().filter(e => e.status === 'published').length +
     ' published editions: both preconditions before the act, history append-only, nothing after today');

  /* A series' own words and its editions may not contradict each
     other. "Run twice a year" is a claim about the record set, and a
     fixture that grows past it makes its own description false. */
  SERIES().forEach(s => {
    if (!/twice a year/i.test(s.about || '')) return;
    const perYear = {};
    EDITIONS().filter(e => e.seriesId === s.id && e.status === 'published')
      .forEach(e => { const y = e.startDate.slice(0, 4); perYear[y] = (perYear[y] || 0) + 1; });
    const over = Object.keys(perYear).filter(y => perYear[y] > 2);
    if (over.length)
      bad(s.name + ' says it runs twice a year and has ' + over.map(y => perYear[y] + ' in ' + y).join(', '));
  });
  ok('no series description contradicts the number of its published editions');
}
assertPublishedFixtures();
expectRed('a published edition dated before its brand review', () => {
  const ed = EDITIONS().find(e => e.status === 'published' && e.seriesId === 'FS-7002');
  const pub = ed.history.find(h => h.action === 'published');
  const was = pub.at;
  pub.at = '2026-07-21';
  try { assertPublishedFixtures(); } finally { pub.at = was; }
});
expectRed('a third published run under a series that says twice a year', () => {
  const donor = EDITIONS().find(e => e.status === 'published' && e.seriesId === 'FS-7002');
  const was = donor.seriesId, wasDate = donor.startDate;
  donor.seriesId = 'FS-7001';
  donor.startDate = '2027-04-04';
  try { assertPublishedFixtures(); } finally { donor.seriesId = was; donor.startDate = wasDate; }
});
{
  const draft = EDITIONS().find(e => e.id === 'FE-7102');
  if (draft && draft.status === 'draft' && draft.fairType === 'hybrid')
    ok('FE-7102 is still the hybrid DRAFT — the FS-6 fixture was not repurposed for the directory');
  else bad('FE-7102 is no longer the hybrid draft');
}
expectRed('the brand review dated after the publication it gates', () => {
  w.eval("reviewById('RVW-3005').reviewedAt = '2026-07-28'");
  try { assertFixtureDiscipline(); }
  finally { w.eval("reviewById('RVW-3005').reviewedAt = '2026-07-20'"); }
});

/* ── §9 The four trade views are unchanged — samples ─────────────── */
console.log('\n§9 trade dashboards untouched — samples');

{
  /* Since O3 the ONE legitimate trade-side fair surface is the
     measured recruiting block on the Wine Shows sub-page (A20.6),
     which is not built here — tests/fair-recruiting.js governs it.
     Everything ELSE — the dashboards as loaded, every sidebar —
     still carries no fair content. */
  const leak = TRADE_ROLES.find(r =>
    /Atrium Wine Days|My Fairs|FE-71\d\d|FS-70\d\d/.test(
      d.getElementById('dash-' + r).innerHTML + d.getElementById('sidebar-' + r).innerHTML));
  if (!leak) ok('no trade dashboard or sidebar carries fair content outside the measured A20.6 block');
  else bad('fair content leaked into the ' + leak + ' view (A18.3)');
  const fansDom = d.querySelectorAll('#dfans-list .wn-card').length;
  const fansDerived = w.eval("fansOf('Hawesko GmbH')").length;
  if (fansDom === fansDerived && fansDerived > 0)
    ok("Hawesko's fan list still renders its " + fansDerived + ' derived rows');
  else bad("Hawesko's fan list moved: DOM " + fansDom + ' vs derived ' + fansDerived);
  const ws = w.eval("wineShows.find(s => s.id === 'WS-2604')");
  if (ws && ws.stage === 'planning' && ws.title === 'Sicilia Prima' && ws.applications_open === true)
    ok('WS-2604 unchanged: planning, open for applications');
  else bad('WS-2604 moved');
  const audSize = w.eval("announcementAudience('event', campaignSubject('event','ME-3103'), true)").length;
  const snap = w.eval("eventCampaigns.find(c => c.id === 'CMP-4001')").recipients.length;
  if (audSize === snap)
    ok('CMP-4001: live audience still equals its frozen snapshot (' + snap + ')');
  else bad('the campaign audience moved: live ' + audSize + ' vs snapshot ' + snap);
}

/* The locked target navigation after O9: exactly the remaining THREE
   rows stay locked with reasons — "Organizer Profile & Follow" left
   the list with A23 (the public profile is live behind View Public
   Profile, the follow is a trade member's act), the way "Participation
   Pages" left it with A21, "Exhibitor Recruitment" and "Stands & Halls"
   with A20 and "Fair Series & Editions" with O2. Never a locked row
   beside its live feature. */
{
  const lockedNav = w.eval('PARTNER_LOCKED_NAV');
  const total = lockedNav.fairs.length + lockedNav.community.length;
  const gone = ['Fair Series & Editions', 'Exhibitor Recruitment', 'Stands & Halls', 'Participation Pages', 'Organizer Profile & Follow'];
  const all = lockedNav.fairs.concat(lockedNav.community);
  if (total === 3 && !all.some(l => gone.some(g => l[0].indexOf(g) !== -1)))
    ok('three target-navigation entries stay locked; the five live features carry no locked row');
  else bad('the locked navigation is not the agreed three (' + total + ')');
  /* Rendered rows, not raw HTML — a source comment naming the old
     entry is history, not a nav row. */
  const fairsEntries = Array.from(d.querySelectorAll('#sidebar-partner .nav-item'))
    .map(e => e.textContent.trim())
    .filter(t => /My Fairs|Fair Series & Editions/.test(t));
  if (fairsEntries.length === 1 && /My Fairs/.test(fairsEntries[0]) &&
      !/Fair Series & Editions/.test(fairsEntries[0]))
    ok('exactly one fairs entry renders in the sidebar — the replacement, not a duplicate');
  else bad('the sidebar renders ' + fairsEntries.length + ' fairs entries: ' + fairsEntries.join(', '));
}

console.log('');
if (fail) { console.log('✗ ' + fail + ' check(s) failed'); process.exit(1); }
console.log('✓ all checks passed');
