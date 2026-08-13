/* ═══════════════════════════════════════════════════════════════════
   FAIR EXHIBITOR RECRUITING, ADMISSION, HALLS & STANDS — A20,
   FR-1..FR-12 (pass O3)
   -------------------------------------------------------------------
   One canonical workflow row per (edition, organisation), three
   entrances converging on the single final state `admitted`, the
   platform-fixed candidate read path, and the edition's hall/stand
   inventory. As in tests/fairs.js, every invariant is measured twice
   — the CLAIM, and the COUNTER-MUTATION that breaks the rule and
   must turn the same check red.

   ONE DELIBERATE ABSENCE THIS FILE ASSERTS RATHER THAN OPERATES:
   the candidate allowlist (FAIR_RECRUITING_READ_FIELDS) is a
   platform boundary and NO workspace — the entitled organizer of an
   edition included — can manage, configure or extend it. The checks
   below prove that capability is ABSENT; none of them describes how
   an organizer would use it, because there is nothing to use.
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
const ADM  = () => w.eval('fairAdmissions');
const HALLS  = () => w.eval('fairHalls');
const STANDS = () => w.eval('fairStands');
const TRADE_ROLES = ['winery', 'distributor', 'restaurant', 'retail'];

/* Live acts mutate the record — every block that acts snapshots and
   restores, so each section reads the fixtures it documents. A STACK,
   because expectRed wraps blocks that snapshot on their own. */
w.eval("window.__admStack = []");
function snapAdmissions() {
  w.eval("window.__admStack.push([JSON.stringify(fairAdmissions), fairAdmissionSeq])");
}
function restoreAdmissions() {
  w.eval("(function(){ const s = window.__admStack.pop(); fairAdmissions = JSON.parse(s[0]); fairAdmissionSeq = s[1]; })()");
}

/* The act→state fold, ONE place in the harness (mirrors A20.2). */
const ACT_STATE = {
  applied:'applied', invited:'invited', admitted:'admitted',
  accepted:'admitted', recorded_external:'admitted',
  rejected:'rejected', declined:'declined', withdrawn:'withdrawn',
  revoked:'revoked'
};
const ROW_KEYS = ['id','editionId','orgType','org','source','status',
                  'externalSource','externalActor','externalAt','history'].sort().join(',');

/* ── §1 One workflow row per pair; eligible organisations only ───── */
console.log('§1 one row per (edition, organisation); winery and distributor only (FR-1, FR-2)');

function assertOneRowPerPair() {
  const seen = {}, dup = ADM().find(a => {
    const k = a.editionId + '|' + a.org;
    if (seen[k]) return true;
    seen[k] = true; return false;
  });
  if (!dup) ok('no (edition, organisation) pair holds a second workflow row (FR-1)');
  else bad('a second parallel procedure exists for ' + dup.org + ' on ' + dup.editionId);
}
assertOneRowPerPair();
expectRed('a second row planted for an existing pair', () => {
  w.eval("fairAdmissions.push({ id:'FA-XXXX', editionId:'FE-7101', org:'Weingut Schmitt', orgType:'winery', source:'application', status:'applied', externalSource:null, externalActor:null, externalAt:null, history:[] })");
  try { assertOneRowPerPair(); }
  finally { w.eval("fairAdmissions = fairAdmissions.filter(a => a.id !== 'FA-XXXX')"); }
});

{
  snapAdmissions();
  const n = ADM().length;
  const second = w.eval("inviteToFair('FE-7101','distributor','Enoteca Milano Import Srl')");
  if (second === null && ADM().length === n)
    ok('a second open invitation to the same organisation for the same edition is refused');
  else bad('a second parallel procedure was opened for an already-open pair (FR-1)');
  const reapply = w.eval("applyToFair('FE-7101','winery','Weingut Schmitt')");
  if (reapply === null && ADM().length === n)
    ok('an application beside the same organisation\'s open procedure is refused');
  else bad('an application was opened beside an open procedure (FR-1)');
  const answered = w.eval("applyToFair('FE-7101','winery','Bodegas Ruiz')");
  if (answered === null && w.eval("fairAdmissionFor('FE-7101','Bodegas Ruiz')").status === 'rejected')
    ok('a rejected application has answered — no new procedure in this pass (D28\'s distinction)');
  else bad('an answered resting state was reopened');
  restoreAdmissions();
}
expectRed('the entrance arithmetic swapped for an always-fresh one', () => {
  snapAdmissions();
  w.eval("window.__ent = fairAdmissionEntrance; fairAdmissionEntrance = function () { return { fresh:true }; }");
  try {
    w.eval("inviteToFair('FE-7101','distributor','Enoteca Milano Import Srl')");
    assertOneRowPerPair();
  } finally {
    w.eval("fairAdmissionEntrance = window.__ent; delete window.__ent");
    restoreAdmissions();
  }
});

function assertEligibilityRefused() {
  snapAdmissions();
  const n = ADM().length;
  const rest = w.eval("applyToFair('FE-7101','restaurant','Bistro Laurent')");
  const inv  = w.eval("inviteToFair('FE-7101','retail','Weinhaus Müller')");
  const part = w.eval("inviteToFair('FE-7101','partner','Atrium Fairs GmbH')");
  if (rest === null && inv === null && part === null && ADM().length === n)
    ok('restaurant, retail and partner workspaces can neither apply nor be invited (FR-2)');
  else bad('an ineligible organisation entered the workflow (FR-2)');
  restoreAdmissions();
}
assertEligibilityRefused();
expectRed('the eligibility list widened by a payload', () => {
  w.eval("FAIR_EXHIBITOR_ORG_TYPES.push('restaurant','retail','partner')");
  try { assertEligibilityRefused(); }
  finally { w.eval("FAIR_EXHIBITOR_ORG_TYPES.length = 2"); }
});

{
  const multi = ADM().filter(a => a.orgType === 'distributor');
  const bare = multi.every(a => Object.keys(a).sort().join(',') === ROW_KEYS);
  if (multi.length && bare)
    ok('a distributor is admitted as ONE organisation — no represented wineries, no presented products on the row (O4)');
  else bad('a distributor admission carries more than the organisation itself');
}

/* ── §2 Three entrances, one final state, distinct acts ──────────── */
console.log('\n§2 application, invitation, external record — one `admitted` (FR-3)');

{
  snapAdmissions();
  /* Entrance 1: apply, organizer admits. */
  w.eval("applyToFair('FE-7101','winery','Cantina Rossi')");
  w.eval("admitFairApplication(fairAdmissionFor('FE-7101','Cantina Rossi').id)");
  const viaApp = w.eval("fairAdmissionFor('FE-7101','Cantina Rossi')");
  /* Entrance 2: invite, recipient accepts. */
  w.eval("inviteToFair('FE-7101','distributor','Hawesko GmbH')");
  w.eval("answerFairInvitation(fairAdmissionFor('FE-7101','Hawesko GmbH').id,'Hawesko GmbH',true,null)");
  const viaInv = w.eval("fairAdmissionFor('FE-7101','Hawesko GmbH')");
  /* Entrance 3: the fixture's external record. */
  const viaExt = w.eval("fairAdmissionFor('FE-7101','Domaine Lefèvre')");

  if (viaApp.status === 'admitted' && viaInv.status === 'admitted' && viaExt.status === 'admitted')
    ok('all three entrances reach the SAME single final state `admitted` (FR-3)');
  else bad('the three entrances do not converge on one final state');
  const acts = [viaApp, viaInv, viaExt].map(a => a.history[a.history.length - 1].action);
  if (acts.join(',') === 'admitted,accepted,recorded_external')
    ok('the three positive acts stay DISTINCT in the history — admitted / accepted / recorded_external (A20.2)');
  else bad('the acts collapsed: ' + acts.join(','));
  restoreAdmissions();
}
expectRed('acceptance and admission folded into one act word', () => {
  snapAdmissions();
  try {
    w.eval("applyToFair('FE-7101','winery','Cantina Rossi')");
    w.eval("admitFairApplication(fairAdmissionFor('FE-7101','Cantina Rossi').id)");
    w.eval("inviteToFair('FE-7101','distributor','Hawesko GmbH')");
    const row = w.eval("fairAdmissionFor('FE-7101','Hawesko GmbH')");
    /* the mutation: the recipient's acceptance logged as the
       organizer's act word */
    w.eval("(function(){ const a = fairAdmissionFor('FE-7101','Hawesko GmbH'); a.status='admitted'; logFairAdmission(a,'admitted','Hawesko GmbH',null); })()");
    const acts = [w.eval("fairAdmissionFor('FE-7101','Cantina Rossi')"), w.eval("fairAdmissionFor('FE-7101','Hawesko GmbH')"), w.eval("fairAdmissionFor('FE-7101','Domaine Lefèvre')")]
      .map(a => a.history[a.history.length - 1].action);
    if (acts.join(',') === 'admitted,accepted,recorded_external')
      ok('distinct'); else bad('the acts collapsed: ' + acts.join(','));
  } finally { restoreAdmissions(); }
});

function assertExternalAudited() {
  const ext = ADM().filter(a => a.source === 'external');
  const bare = ext.find(a => !a.externalSource || !a.externalActor || !a.externalAt);
  if (ext.length && !bare)
    ok('every external record carries source, actor and date — audited, never a bypass (FR-3)');
  else bad(ext.length ? 'an external record is missing its audit facts' : 'no external record to measure');
}
assertExternalAudited();
{
  snapAdmissions();
  const n = ADM().length;
  const r1 = w.eval("recordExternalFairAdmission('FE-7101','winery','Cantina Rossi','','','')");
  const r2 = w.eval("recordExternalFairAdmission('FE-7101','winery','Cantina Rossi','signed deal',null,'2026-07-01')");
  if (r1 === null && r2 === null && ADM().length === n)
    ok('an external record without source, actor or date is refused whole — nothing is written');
  else bad('a bare external record slipped through (FR-3)');
  restoreAdmissions();
}
expectRed('the external audit fields planted empty on the fixture', () => {
  w.eval("(function(){ const a = fairAdmissionById('FA-9103'); a.externalSource=null; a.externalActor=null; })()");
  try { assertExternalAudited(); }
  finally { w.eval("(function(){ const a = fairAdmissionById('FA-9103'); a.externalSource='Signed exhibitor agreement, Atrium office Wiesbaden'; a.externalActor='Atrium Fairs GmbH / Domaine Lefèvre'; })()"); }
});

/* ── §3 One stored truth: status beside an append-only history ───── */
console.log('\n§3 the last-word model — status and history never drift, nothing is deleted (FR-4)');

function assertConsistency() {
  const drift = ADM().find(a =>
    !a.history || !a.history.length ||
    ACT_STATE[a.history[a.history.length - 1].action] !== a.status);
  if (!drift) ok('every row\'s status equals the fold of its last history act — one truth, audited');
  else bad('row ' + (drift && drift.id) + ' contradicts its own history (FR-4)');
  const shaped = ADM().find(a => Object.keys(a).sort().join(',') !== ROW_KEYS);
  if (!shaped) ok('no row carries a second status field or any helper copy beside the one status');
  else bad('row ' + shaped.id + ' grew extra fields: ' + Object.keys(shaped).sort().join(','));
}
assertConsistency();
expectRed('a second status source written past the act functions', () => {
  w.eval("fairAdmissionById('FA-9101').status = 'admitted'");   /* history still ends in `applied` */
  try { assertConsistency(); }
  finally { w.eval("fairAdmissionById('FA-9101').status = 'applied'"); }
});
expectRed('a parallel state copy planted on a row', () => {
  w.eval("fairAdmissionById('FA-9101').phase = 'open'");
  try { assertConsistency(); }
  finally { w.eval("delete fairAdmissionById('FA-9101').phase"); }
});

function assertRestingNotDeleted() {
  snapAdmissions();
  const n = ADM().length;
  w.eval("applyToFair('FE-7102','winery','Cantina Rossi')");   /* draft takes no application… */
  const openOnDraft = w.eval("fairAdmissionFor('FE-7102','Cantina Rossi')");
  w.eval("inviteToFair('FE-7102','winery','Cantina Rossi')");
  w.eval("answerFairInvitation(fairAdmissionFor('FE-7102','Cantina Rossi').id,'Cantina Rossi',false,null)");
  const declined = w.eval("fairAdmissionFor('FE-7102','Cantina Rossi')");
  w.eval("rejectFairApplication('FA-9101','no fit this run')");
  const rejected = w.eval("fairAdmissionById('FA-9101')");
  w.eval("revokeFairInvitation('FA-9102','plans changed')");
  const revoked = w.eval("fairAdmissionById('FA-9102')");
  if (openOnDraft === null &&
      declined && declined.status === 'declined' &&
      rejected.status === 'rejected' && revoked.status === 'revoked' &&
      ADM().length === n + 1)
    ok('decline, rejection and revocation are resting states — the rows and their history remain (D29 pattern)');
  else bad('a negative act deleted or lost a record');
  restoreAdmissions();
}
assertRestingNotDeleted();
expectRed('the decline act swapped for a deletion', () => {
  snapAdmissions();
  w.eval("window.__ans = answerFairInvitation; answerFairInvitation = function (id) { fairAdmissions = fairAdmissions.filter(a => a.id !== id); return true; }");
  try { assertRestingNotDeleted(); }
  finally { w.eval("answerFairInvitation = window.__ans; delete window.__ans"); restoreAdmissions(); }
});

/* ── §4 Reasons — measured per act, no blanket rule ──────────────── */
console.log('\n§4 reasons: mandatory on rejected/revoked, never on the yes (FR-5)');

{
  snapAdmissions();
  const r1 = w.eval("rejectFairApplication('FA-9101','')");
  const r2 = w.eval("revokeFairInvitation('FA-9102','  ')");
  const row1 = w.eval("fairAdmissionById('FA-9101')"), row2 = w.eval("fairAdmissionById('FA-9102')");
  if (r1 === false && r2 === false && row1.status === 'applied' && row2.status === 'invited' &&
      row1.history.length === 1 && row2.history.length === 1)
    ok('a rejection and a revocation without a reason are refused and write nothing (FR-5)');
  else bad('a negative organizer act went through without its mandatory reason');
  w.eval("rejectFairApplication('FA-9101','Focus region does not fit')");
  const kept = w.eval("fairAdmissionById('FA-9101').history").slice(-1)[0];
  if (kept.action === 'rejected' && kept.reason === 'Focus region does not fit')
    ok('the rejection reason lives ONCE, on the history row — no copy beside it (A20.3)');
  else bad('the rejection reason did not reach the record');
  restoreAdmissions();
}
{
  snapAdmissions();
  const a = w.eval("admitFairApplication('FA-9101')");
  const accRow = w.eval("(function(){ inviteToFair('FE-7102','distributor','Hawesko GmbH'); const r = fairAdmissionFor('FE-7102','Hawesko GmbH'); answerFairInvitation(r.id,'Hawesko GmbH',true,null); return r; })()");
  const decl = w.eval("(function(){ inviteToFair('FE-7102','winery','Cantina Rossi'); const r = fairAdmissionFor('FE-7102','Cantina Rossi'); return answerFairInvitation(r.id,'Cantina Rossi',false,null); })()");
  const wd = w.eval("(function(){ applyToFair('FE-7101','winery','Cantina Rossi'); const r = fairAdmissionFor('FE-7101','Cantina Rossi'); return withdrawFairApplication(r.id,'Cantina Rossi',null); })()");
  if (a === true && accRow.status === 'admitted' && decl === true && wd === true)
    ok('admission and acceptance carry no forced reason; decline and withdrawal succeed without one (A16.4/D28 precedents)');
  else bad('a positive or optional-reason act demanded a justification (FR-5)');
  restoreAdmissions();
}
expectRed('the admission act grown a mandatory reason', () => {
  snapAdmissions();
  w.eval("window.__adm = admitFairApplication; admitFairApplication = function (id) { return false; }");
  try {
    const a = w.eval("admitFairApplication('FA-9101')");
    if (a === true) ok('yes without reason'); else bad('the yes now demands a reason');
  } finally { w.eval("admitFairApplication = window.__adm; delete window.__adm"); restoreAdmissions(); }
});

/* ── §5 Admission entitles, creates nothing; no waitlist ─────────── */
console.log('\n§5 nothing is created; no waitlist anywhere (FR-6, FR-8)');

function assertCreatesNothing() {
  snapAdmissions();
  const before = w.eval("JSON.stringify([partnerships.length, orders.length, memberEvents.length, wineShows.length, listings.length])");
  w.eval("applyToFair('FE-7101','winery','Cantina Rossi')");
  w.eval("admitFairApplication(fairAdmissionFor('FE-7101','Cantina Rossi').id)");
  w.eval("inviteToFair('FE-7102','distributor','Hawesko GmbH')");
  w.eval("answerFairInvitation(fairAdmissionFor('FE-7102','Hawesko GmbH').id,'Hawesko GmbH',true,null)");
  const after = w.eval("JSON.stringify([partnerships.length, orders.length, memberEvents.length, wineShows.length, listings.length])");
  if (before === after)
    ok('a full admission arc creates no partnership, order, member event, show or listing row (FR-6, WS-5)');
  else bad('an admission created a business row: ' + before + ' → ' + after);
  restoreAdmissions();
}
assertCreatesNothing();
expectRed('the admission act quietly opening a partnership', () => {
  snapAdmissions();
  w.eval("window.__adm2 = admitFairApplication; admitFairApplication = function (id) { const r = window.__adm2(id); partnerships.push({ distributor:'X', partner:'Y', at:'2026-07-30', activatedBy:'mutation' }); return r; }");
  try { assertCreatesNothing(); }
  finally { w.eval("admitFairApplication = window.__adm2; delete window.__adm2; partnerships = partnerships.filter(p => p.activatedBy !== 'mutation')"); restoreAdmissions(); }
});

function assertNoWaitlist() {
  const enumHit = w.eval('FAIR_ADMISSION_STATUSES').find(s => /wait/i.test(s));
  const rowHit = ADM().find(a => /wait/i.test(a.status) ||
    Object.keys(a).some(k => /wait|queue|rank/i.test(k)));
  if (!enumHit && !rowHit)
    ok('no stored waitlist state, decision or ranking exists anywhere in the workflow (FR-8)');
  else bad('a waitlist surfaced: ' + (enumHit || (rowHit && rowHit.id)));
}
assertNoWaitlist();
expectRed('a waitlisted status smuggled into the enum and onto a row', () => {
  w.eval("FAIR_ADMISSION_STATUSES.push('waitlisted'); fairAdmissionById('FA-9101').waitlistRank = 1");
  try { assertNoWaitlist(); }
  finally { w.eval("FAIR_ADMISSION_STATUSES.pop(); delete fairAdmissionById('FA-9101').waitlistRank"); }
});

/* ── §6 The exhibitor call ───────────────────────────────────────── */
console.log('\n§6 explicit call on the published edition; closing touches nothing (FR-7)');

{
  snapAdmissions();
  const openDraft = w.eval("setFairExhibitorCall('FE-7102', true)");
  if (openDraft === false && w.eval("fairEditionById('FE-7102').exhibitorCallOpen") === false)
    ok('a call opens on a PUBLISHED edition only — the draft refuses (A20.5)');
  else bad('an exhibitor call opened on an unpublished edition');
  const rowsBefore = w.eval('JSON.stringify(fairAdmissions)');
  w.eval("setFairExhibitorCall('FE-7101', false)");
  const rowsAfter = w.eval('JSON.stringify(fairAdmissions)');
  const blocked = w.eval("applyToFair('FE-7101','winery','Cantina Rossi')");
  if (rowsBefore === rowsAfter && blocked === null)
    ok('closing the call refuses NEW applications and leaves every existing procedure byte-identical');
  else bad('closing the call changed existing records or let an application through');
  const invite = w.eval("inviteToFair('FE-7101','winery','Cantina Rossi')");
  if (invite && invite.status === 'invited')
    ok('a targeted invitation stays independent of the call — possible after it closed (FR-7)');
  else bad('the closed call blocked a targeted invitation');
  w.eval("setFairExhibitorCall('FE-7101', true)");
  restoreAdmissions();
}
expectRed('the call-closing act purging open applications', () => {
  snapAdmissions();
  w.eval("window.__call = setFairExhibitorCall; setFairExhibitorCall = function (id, open) { const r = window.__call(id, open); if (!open) fairAdmissions = fairAdmissions.filter(a => a.status !== 'applied'); return r; }");
  try {
    const rowsBefore = w.eval('JSON.stringify(fairAdmissions)');
    w.eval("setFairExhibitorCall('FE-7101', false)");
    const rowsAfter = w.eval('JSON.stringify(fairAdmissions)');
    if (rowsBefore === rowsAfter) ok('untouched'); else bad('closing the call mutated the record');
  } finally {
    w.eval("setFairExhibitorCall = window.__call; delete window.__call; fairEditionById('FE-7101').exhibitorCallOpen = true");
    restoreAdmissions();
  }
});

/* ── §7 Recruiting never reads the campaign apparatus ────────────── */
console.log('\n§7 suppressions and the campaign resolver stay out of recruiting (FR-12)');

{
  snapAdmissions();
  w.eval("communicationSuppressions.push({ recipient:'Weingut Schmitt', kind:'unsubscribe', sender:null, campaignKind:'announcement', at:'2026-07-30' })");
  w.eval("communicationSuppressions.push({ recipient:'Weingut Schmitt', kind:'block', sender:null, campaignKind:null, at:'2026-07-30' })");
  const inv = w.eval("inviteToFair('FE-7102','winery','Weingut Schmitt')");
  if (inv && inv.status === 'invited')
    ok('an announcement unsubscribe — and even a campaign-scoped block — never stops a targeted recruitment invitation');
  else bad('the suppression record blocked a recruitment invitation (FR-12)');
  w.eval("communicationSuppressions = communicationSuppressions.filter(s => s.recipient !== 'Weingut Schmitt')");
  restoreAdmissions();
}
{
  const srcs = ['applyToFair','inviteToFair','recordExternalFairAdmission','answerFairInvitation'].map(f => w.eval(f + '.toString()')).join('');
  if (!/suppressed\(|communicationSuppressions|announcementAudience|campaignAudience/.test(srcs))
    ok('no recruiting act consults the suppression record or the campaign resolver');
  else bad('a recruiting act reads the campaign apparatus (FR-12)');
  const resolver = w.eval('suppressed.toString()');
  if (!/recruit|fair/i.test(resolver))
    ok('the ONE suppression resolver is untouched — no recruitment kind was added to it');
  else bad('the campaign resolver grew a recruitment branch (FR-12)');
}
expectRed('the invitation act wired into the suppression record', () => {
  snapAdmissions();
  w.eval("window.__inv = inviteToFair; inviteToFair = function (ed, t, org) { if (suppressed(org, null, 'announcement')) return null; return window.__inv(ed, t, org); }");
  w.eval("communicationSuppressions.push({ recipient:'Weingut Schmitt', kind:'unsubscribe', sender:null, campaignKind:'announcement', at:'2026-07-30' })");
  try {
    const inv = w.eval("inviteToFair('FE-7102','winery','Weingut Schmitt')");
    if (inv) ok('unblocked'); else bad('the suppression blocked recruiting');
  } finally {
    w.eval("inviteToFair = window.__inv; delete window.__inv; communicationSuppressions = communicationSuppressions.filter(s => s.recipient !== 'Weingut Schmitt')");
    restoreAdmissions();
  }
});

/* ── §8 The candidate read path and its platform-fixed allowlist ─── */
console.log('\n§8 the allowlist is the boundary — explicit, frozen, owned by nobody (FR-9)');

function assertResultsInsideAllowlist() {
  const allow = w.eval('FAIR_RECRUITING_READ_FIELDS');
  const out = w.eval("organizerCandidateSearch('')");
  const leak = out.find(r => Object.keys(r).some(k =>
    k !== 'matchReason' && allow[r.role].indexOf(k) === -1));
  if (out.length && !leak)
    ok('every search result carries allowlist fields only — plus the match reason derived from them');
  else bad(out.length ? 'a result leaked a field outside the allowlist: ' + JSON.stringify(leak) : 'the search returned nothing to measure');
}
assertResultsInsideAllowlist();
expectRed('the search swapped for one that spreads the whole trade record', () => {
  w.eval("window.__search = organizerCandidateSearch; organizerCandidateSearch = function (q) { return stakeholders.filter(s => fairOrgEligible(s.type)).map(s => Object.assign({ role:s.type, matchReason:'x' }, s)); }");
  try { assertResultsInsideAllowlist(); }
  finally { w.eval("organizerCandidateSearch = window.__search; delete window.__search"); }
});

function assertPayloadCannotWiden() {
  const withPayload = w.eval("organizerCandidateSearch('', { fields:['tradePrice','partnerships'] })");
  const threw = w.eval("(function(){ try { FAIR_RECRUITING_READ_FIELDS.winery.push('tradePrice'); return false; } catch (e) { return true; } })()");
  const still = w.eval("FAIR_RECRUITING_READ_FIELDS.winery.join(',')");
  if (withPayload.length === 0 && threw && still === 'org,role,region,city,wines')
    ok('no organizer input, form or payload widens the allowlist — the entitled organizer of the edition included; the write attempt is refused');
  else bad('the allowlist definition moved under a workspace input (FR-9)');
}
assertPayloadCannotWiden();
expectRed('a payload-honouring search planted in', () => {
  w.eval("window.__search2 = organizerCandidateSearch; organizerCandidateSearch = function (q, payload) { const base = window.__search2(q); if (payload && payload.fields) base.forEach(r => payload.fields.forEach(f => { r[f] = 'leaked'; })); return base; }");
  try { assertPayloadCannotWiden(); }
  finally { w.eval("organizerCandidateSearch = window.__search2; delete window.__search2"); }
});

function assertNewPrivateFactStaysOut() {
  w.eval("stakeholder('Weingut Schmitt').internalCreditNote = 'CONFIDENTIAL'");
  try {
    const out = w.eval("organizerCandidateSearch('Schmitt')");
    const leak = out.find(r => JSON.stringify(r).indexOf('CONFIDENTIAL') !== -1 ||
                               Object.keys(r).indexOf('internalCreditNote') !== -1);
    if (out.length && !leak)
      ok('a private trade fact added elsewhere NEVER enters the search by side effect — the allowlist is explicit, not "everything minus a blocklist"');
    else bad('a new private trade property leaked into the organizer search (FR-9)');
  } finally { w.eval("delete stakeholder('Weingut Schmitt').internalCreditNote"); }
}
assertNewPrivateFactStaysOut();
expectRed('the extractors replaced by a spread of the record', () => {
  w.eval("window.__search3 = organizerCandidateSearch; organizerCandidateSearch = function (q) { return stakeholders.filter(s => fairOrgEligible(s.type) && s.name.indexOf('Schmitt') !== -1).map(s => Object.assign({ role:s.type, matchReason:'x' }, s)); }");
  try { assertNewPrivateFactStaysOut(); }
  finally { w.eval("organizerCandidateSearch = window.__search3; delete window.__search3"); }
});

function assertReasonsFromAllowlistFacts() {
  const out = w.eval("organizerCandidateSearch('Riesling')").concat(
              w.eval("organizerCandidateSearch('Hamburg')"),
              w.eval("organizerCandidateSearch('')"));
  const badReason = out.find(r =>
    !/^(Name matches|Region: |City: |Lists |Listed (winery|distributor))/.test(r.matchReason));
  if (out.length && !badReason)
    ok('every match reason derives from an allowlist fact — no score, no opportunity, nothing private');
  else bad('a match reason came from outside the allowlist facts: ' + (badReason && badReason.matchReason));
  /* Identifier names, not prose: the function's own comments SAY
     "no score" — the scan must look for the data it would READ. */
  const srcs = (w.eval('organizerCandidateSearch.toString()') +
    Object.keys(w.eval('FAIR_RECRUITING_EXTRACTORS')).map(k => w.eval("FAIR_RECRUITING_EXTRACTORS['" + k + "'].toString()")).join(''))
    .replace(/\/\*[\s\S]*?\*\//g, '');
  if (!/partnerships|wineFollowGraph|listings\b|\borders\b|incomingRequests|matchesFor|dealFreeGoods/.test(srcs))
    ok('the read path touches no portfolio, follow, partnership, request, sales or matchmaking data — and no private trade resolver');
  else bad('the read path reads private trade data (FR-9)');
}
assertReasonsFromAllowlistFacts();
expectRed('a match reason built from the partnership book', () => {
  w.eval("window.__search4 = organizerCandidateSearch; organizerCandidateSearch = function (q) { const r = window.__search4(q); r.forEach(x => { x.matchReason = 'Partner of Hawesko GmbH since 2026'; }); return r; }");
  try { assertReasonsFromAllowlistFacts(); }
  finally { w.eval("organizerCandidateSearch = window.__search4; delete window.__search4"); }
});

{
  /* The ABSENCE of any allowlist management, asserted — not its
     correct operation, because there is no operation. */
  w.eval("showPartnerView('fairs'); openFairEditionDetail && (fairOpenEditionId = 'FE-7101'); renderPartnerFairs()");
  const surface = d.getElementById('pfairs-root').innerHTML;
  /* No control, no handler, no word: nothing on the surface names or
     touches the allowlist, and no onclick reaches a function that
     could — the boundary has no operating surface at all. */
  const handlerHit = (surface.match(/onclick="([^"]+)"/g) || [])
    .find(h => /allowlist|readfield|recruitingfields/i.test(h));
  if (!/allowlist/i.test(surface) && !handlerHit)
    ok('the organizer surface offers NO place to manage, configure or extend the allowlist');
  else bad('the organizer surface renders an allowlist management control (FR-9)');
  const noWriter = w.eval("typeof window.setFairRecruitingFields === 'undefined' && typeof window.extendFairRecruitingAllowlist === 'undefined'");
  if (noWriter) ok('no allowlist writer function exists anywhere on the page');
  else bad('an allowlist writer function exists');
}

/* ── §9 Halls & stands — inventory without occupancy ─────────────── */
console.log('\n§9 edition inventory, no occupant, no copies, no stored counts (FR-10)');

function assertInventoryShape() {
  const hallKeys = 'editionId,id,name', standKeys = 'hallId,id,label';
  const badHall = HALLS().find(h => Object.keys(h).sort().join(',') !== hallKeys);
  const badStand = STANDS().find(s => Object.keys(s).sort().join(',') !== standKeys);
  if (!badHall && !badStand)
    ok('halls are (id, editionId, name); stands are (id, hallId, label) — no occupant, no copied fair or member data');
  else bad('inventory grew a field: ' + JSON.stringify(badHall || badStand));
  const orphan = STANDS().find(s => !HALLS().some(h => h.id === s.hallId));
  if (!orphan) ok('a stand reaches its edition through its hall — no second key, no orphan (invariant 1)');
  else bad('stand ' + (orphan && orphan.id) + ' has no hall');
}
assertInventoryShape();
expectRed('an occupant written onto a stand', () => {
  w.eval("fairStands[0].occupant = 'Cantina Rossi'");
  try { assertInventoryShape(); }
  finally { w.eval("delete fairStands[0].occupant"); }
});
expectRed('the edition key copied onto a stand row', () => {
  w.eval("fairStands[0].editionId = 'FE-7101'");
  try { assertInventoryShape(); }
  finally { w.eval("delete fairStands[0].editionId"); }
});

{
  const edKeys = Object.keys(w.eval("fairEditionById('FE-7101')"));
  if (!edKeys.some(k => /exhibitorCount|participantCount|admittedCount|standCount/i.test(k)) &&
      w.eval("typeof fairAdmittedCount === 'function'"))
    ok('exhibitor and participant counts stay derived — no stored helper value on the edition (invariant 7)');
  else bad('a stored counter appeared on the edition');
  const foreign = w.eval("(function(){ fairSeries[0].organizerId='PP-9999'; try { return { hall: addFairHall('FE-7101','Intruder Hall'), stand: addFairStand('FH-9201','Z-99'), n: fairHalls.length + fairStands.length }; } finally { fairSeries[0].organizerId='PP-9001'; } })()");
  if (foreign.hall === null && foreign.stand === null && foreign.n === HALLS().length + STANDS().length)
    ok('a foreign workspace cannot write the inventory — refused in the data layer, not just unrendered (A20.11)');
  else bad('a foreign workspace wrote hall or stand inventory');
}
expectRed('the inventory ownership gate swapped for a yes-sayer', () => {
  w.eval('window.__g2 = fairSeriesManagedHere; fairSeriesManagedHere = function () { return true; }');
  try {
    const foreign = w.eval("(function(){ fairSeries[0].organizerId='PP-9999'; try { return addFairHall('FE-7101','Intruder Hall'); } finally { fairSeries[0].organizerId='PP-9001'; } })()");
    if (foreign === null) ok('refused'); else bad('a foreign workspace wrote inventory');
  } finally { w.eval("fairSeriesManagedHere = window.__g2; delete window.__g2; fairHalls = fairHalls.filter(h => h.name !== 'Intruder Hall')"); }
});

{
  snapAdmissions();
  const foreignRecruiting = w.eval("(function(){ fairSeries[0].organizerId='PP-9999'; try { return { inv: inviteToFair('FE-7102','winery','Cantina Rossi'), adm: admitFairApplication('FA-9101'), call: setFairExhibitorCall('FE-7101', false) }; } finally { fairSeries[0].organizerId='PP-9001'; } })()");
  if (foreignRecruiting.inv === null && foreignRecruiting.adm === false && foreignRecruiting.call === false &&
      w.eval("fairEditionById('FE-7101').exhibitorCallOpen") === true)
    ok('a foreign workspace cannot run recruiting either — invitation, decision and call all refuse on the data path');
  else bad('a foreign workspace ran another organizer\'s recruiting (A20.11)');
  restoreAdmissions();
}

/* ── §10 The draft invitation view — narrow, entitled, falling ───── */
console.log('\n§10 the FS-6 exception: addressed recipient only, and the view falls (FR-11)');

const WSHOW_FAIRS = role => {
  w.eval("showWineShows('" + role + "')");
  return d.getElementById(w.eval("SHOW_ROLES['" + role + "'].prefix") + '-fairs').innerHTML;
};

{
  snapAdmissions();
  w.eval("inviteToFair('FE-7102','distributor','Hawesko GmbH')");
  const mine = WSHOW_FAIRS('distributor');
  const draftFacts = /Autumn edition|trade morning/.test(mine) && /Not yet published/.test(mine);
  if (draftFacts)
    ok('the addressed recipient sees the decision-minimum draft facts through its invitation view (A20.8)');
  else bad('the invited organisation cannot see what it is deciding about');
  const other = WSHOW_FAIRS('winery');
  if (!/Autumn edition|FE-7102|trade morning/.test(other))
    ok('a NON-addressed trade workspace sees nothing of the draft — the exception is one recipient wide');
  else bad('the draft leaked to a non-addressed workspace (FR-11)');
  const restRetail = ['restaurant', 'retail'].every(r => WSHOW_FAIRS(r) === '');
  if (restRetail) ok('restaurant and retail render no fair block at all — not eligible, nothing to reach');
  else bad('an ineligible role renders fair recruiting surface');
  w.eval("revokeFairInvitation(fairAdmissionFor('FE-7102','Hawesko GmbH').id,'plans changed')");
  const after = WSHOW_FAIRS('distributor');
  if (!/Autumn edition|trade morning|Not yet published/.test(after))
    ok('revocation removes the entitlement — the draft view falls with the open invitation');
  else bad('the draft view survived the revocation (FR-11)');
  restoreAdmissions();
}
expectRed('the recipient filter widened to every organisation', () => {
  snapAdmissions();
  w.eval("inviteToFair('FE-7102','distributor','Hawesko GmbH')");
  w.eval("window.__of = fairAdmissionsOfOrg; fairAdmissionsOfOrg = function () { return fairAdmissions; }");
  try {
    const other = WSHOW_FAIRS('winery');
    if (!/Autumn edition|FE-7102|trade morning/.test(other)) ok('tight'); else bad('the draft leaked');
  } finally { w.eval("fairAdmissionsOfOrg = window.__of; delete window.__of"); restoreAdmissions(); w.eval("showWineShows('winery')"); }
});

{
  /* Nobody is publicly named: no public surface reads the ADMISSION
     records at all — asserted structurally, with the reason. The
     assets are the public pages' whole data source; a name that
     never leaves the dashboard cannot appear on any of them. Since
     O4's data move (A21.8) halls and stands DO live in the shared
     asset — occupancy-free inventory a public page may resolve — so
     the assurance is exactly the admissions, as A20.13 words it. */
  const assetDir = path.join(__dirname, '..', 'assets');
  const assetSrc = fs.readdirSync(assetDir).filter(f => f.endsWith('.js'))
    .map(f => fs.readFileSync(path.join(assetDir, f), 'utf8')).join('')
    /* identifiers, not prose — the store and data files NAME the rule
       in comments; the scan looks for code that would READ the
       records (the §8 read-path discipline). */
    .replace(/\/\*[\s\S]*?\*\//g, '');
  if (!/fairAdmission/.test(assetSrc))
    ok('no public asset reads the admission records — applicants, invitees and rejected candidates are publicly named nowhere (FR-11)');
  else bad('a public asset reads the admission records (FR-11)');
}

/* ── §11 Unchanged neighbours — trade cockpits and the O2 core ───── */
console.log('\n§11 regression samples: the four cockpits and the O2 lifecycle');

/* §10 left rendered blocks from mutated states in the DOM — repaint
   both eligible views from the restored fixtures before sampling. */
w.eval("showWineShows('distributor')");
w.eval("showWineShows('winery')");

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
  /* FS-3 stays the register's last word: a later rejection on the
     series level still withdraws the right to publish. */
  const refused = w.eval("(function(){ writeReview('fair_series','FS-7001','rejected','Bottle Lobby','probe','series_brand_review'); try { const ed = createFairEdition('FS-7001',{ fairType:'trade', startDate:'2027-11-02', endDate:null, city:'X', venue:'', description:'' }); const r = publishFairEdition(ed.id); fairEditions = fairEditions.filter(e => e.id !== ed.id); return r; } finally { reviews.pop(); reviewSeq--; } })()");
  if (refused === false)
    ok('FS-3 unchanged: a later rejected brand review still withdraws the right to publish');
  else bad('the publication precondition weakened');
  const draftLeak = TRADE_ROLES.find(r =>
    /Autumn edition|FE-7102/.test(d.getElementById('dash-' + r).innerHTML + d.getElementById('sidebar-' + r).innerHTML));
  if (!draftLeak)
    ok('FS-6 in its precised form: outside the invitation view, the draft stays invisible to every trade surface');
  else bad('the draft leaked outside the invitation view: ' + draftLeak);
}

console.log('');
if (fail) { console.log('✗ ' + fail + ' check(s) failed'); process.exit(1); }
console.log('✓ all checks passed');
