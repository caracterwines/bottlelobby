/* ═══════════════════════════════════════════════════════════════════
   THE PROGRAMME, THE THREE ACTS AND THE GATES
   (A17.1, A17.2, A17.3, A17.7, A17.8, A17.12 — OL-3, OL-4, OL-6,
    OL-11, OL-13)

   WHY THIS IS A FILE OF ITS OWN. `own-label-grants.js` measures what a
   project MAY DO — grants, the fee chain, the primary listing. This one
   measures whether the project was allowed to exist at all, which is a
   different question with different records behind it: eight
   memberships, eight consents, eight contracts, twelve reviews and
   four readings that must never become fields.

   IT DRIVES THE PAGE'S OWN ROWS, not fixtures of its own, and that is
   the point of a fixture pass. Where the grants harness has to build a
   world because the page holds none, everything below is asked of the
   records the build ships — so a fixture that stops satisfying A17
   fails here rather than looking fine in isolation.

   THE ONE THING IT BUILDS is a mutation: section 8 breaks each
   derivation in the source and asserts the reading moves. A check whose
   only evidence is a case that would pass without it proves nothing.
═══════════════════════════════════════════════════════════════════ */
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');
const { loadDashboard } = require('./load-dashboard');

let fail = 0;
const bad = m => { console.log('  ✗ ' + m); fail++; };
const ok  = m => console.log('  ✓ ' + m);
const S   = v => JSON.stringify(v);

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
  win.scrollTo = () => {}; win.confirm = () => true;
  if (errs.length) { console.log('SCRIPT ERRORS:\n' + errs.join('\n')); process.exit(1); }
  return win;
}

const w = build();
const J = expr => JSON.parse(w.eval('JSON.stringify(' + expr + ')'));

const MEMBERSHIPS = J('ownLabelProgramMemberships');
const CONSENTS    = J('consents');
const CONTRACTS   = J('contracts');
const REVIEWS     = J('reviews');
const PROJECTS    = J('ownLabelProjects');

/* ── 1. The records exist, are keyed and are unique ──────────────── */
console.log('\n── one record per act, and every reference resolves');
{
  const sets = [
    ['membership', MEMBERSHIPS], ['consent', CONSENTS],
    ['contract', CONTRACTS],     ['review', REVIEWS]
  ];
  sets.forEach(([what, rows]) => {
    if (!rows.length) return bad('there are no ' + what + ' rows at all — every section below examines nothing');
    const ids = rows.map(r => r.id);
    const dupes = ids.filter((x, i) => ids.indexOf(x) !== i);
    if (dupes.length) bad(what + ' ids are not unique: ' + [...new Set(dupes)].join(' · '));
    else if (ids.some(x => typeof x !== 'string' || !x)) bad('a ' + what + ' row has no id');
    else ok(rows.length + ' ' + what + ' row(s), each with a unique id');
  });

  /* A membership pointing at a consent, contract or review that does
     not exist would read inactive for a reason nobody could find. */
  let dangling = [];
  MEMBERSHIPS.forEach(m => {
    if (m.consentId  && !CONSENTS.some(c => c.id === m.consentId))   dangling.push(m.id + '.consentId');
    if (m.contractId && !CONTRACTS.some(c => c.id === m.contractId)) dangling.push(m.id + '.contractId');
    if (m.reviewId   && !REVIEWS.some(r => r.id === m.reviewId))     dangling.push(m.id + '.reviewId');
  });
  /* And the other direction: an act naming a subject nobody holds. */
  CONSENTS.filter(c => c.subjectType === 'membership')
    .forEach(c => { if (!MEMBERSHIPS.some(m => m.id === c.subjectId)) dangling.push(c.id + '.subjectId'); });
  CONTRACTS.filter(c => c.subjectType === 'membership')
    .forEach(c => { if (!MEMBERSHIPS.some(m => m.id === c.subjectId)) dangling.push(c.id + '.subjectId'); });
  REVIEWS.filter(r => r.subjectType === 'contract')
    .forEach(r => { if (!CONTRACTS.some(c => c.id === r.subjectId)) dangling.push(r.id + '.subjectId'); });
  REVIEWS.filter(r => r.subjectType === 'membership')
    .forEach(r => { if (!MEMBERSHIPS.some(m => m.id === r.subjectId)) dangling.push(r.id + '.subjectId'); });
  REVIEWS.filter(r => r.subjectType === 'project')
    .forEach(r => { if (!PROJECTS.some(p => p.id === r.subjectId)) dangling.push(r.id + '.subjectId'); });
  CONSENTS.filter(c => c.subjectType === 'project')
    .forEach(c => { if (!PROJECTS.some(p => p.id === c.subjectId)) dangling.push(c.id + '.subjectId'); });
  CONTRACTS.filter(c => c.subjectType === 'project')
    .forEach(c => { if (!PROJECTS.some(p => p.id === c.subjectId)) dangling.push(c.id + '.subjectId'); });

  if (dangling.length) bad(dangling.length + ' dangling reference(s): ' + dangling.join(' · '));
  else ok('every reference between the four records resolves, in both directions');

  /* Every company named must be a stakeholder (A2). A membership for a
     house the platform does not know is a badge on nobody. */
  const unknown = MEMBERSHIPS.filter(m => w.eval('stakeholder(' + S(m.companyId) + ').unknown === true'));
  const roleMismatch = MEMBERSHIPS.filter(m => w.eval('stakeholder(' + S(m.companyId) + ').type') !== m.companyRole);
  const noProfile = MEMBERSHIPS.filter(m => !w.eval('stakeholder(' + S(m.companyId) + ').url'));
  if (unknown.length) bad(unknown.length + ' membership(s) name a company no stakeholder record knows: ' +
    unknown.map(m => m.companyId).join(' · '));
  else if (roleMismatch.length) bad(roleMismatch.length + ' membership(s) claim a companyRole the master ' +
    'record disagrees with: ' + roleMismatch.map(m => m.companyId).join(' · '));
  else if (noProfile.length) bad(noProfile.length + ' membership(s) name a house with no resolving profile page ' +
    '(A11): ' + noProfile.map(m => m.companyId).join(' · '));
  else ok('every membership names a house the platform knows, with the matching type and a ' +
    'resolving profile page (A2, A11)');
}

/* ── 2. OL-6 — NOT ONE DERIVED STATE IS STORED ───────────────────── */
console.log('\n── membership is read, never stored');
{
  /* The named forbidden fields, measured over the records rather than
     over the source: a field that exists nowhere cannot be read. */
  const FORBIDDEN = ['isOwnLabelPartner', 'applicationStatus', 'active', 'isActive',
                     'state', 'status', 'tabState', 'badge', 'projectActive',
                     'approvedForFirstOrder'];
  const found = [];
  MEMBERSHIPS.forEach(m => FORBIDDEN.forEach(k => {
    if (Object.prototype.hasOwnProperty.call(m, k)) found.push(m.id + '.' + k);
  }));
  if (found.length) bad('membership rows carry derived state as a field: ' + found.join(' · ') +
    ' — a boolean beside six conditions can disagree with all six');
  else ok('no membership row carries a status, a boolean or a screen name');

  /* And the reading answers from the six conditions. Each one is
     removed in turn and the answer has to change. */
  const CONDITIONS = [
    { what: 'submittedAt',      to: "m.submittedAt = null" },
    { what: 'the consent',      to: "m.consentId = null" },
    { what: 'the contract',     to: "contractById(m.contractId).status = 'sent'" },
    { what: 'the review',       to: "reviewById(m.reviewId).reviewStatus = 'pending'" },
    { what: 'validFrom',        to: "m.validFrom = null" },
    { what: 'validUntil',       to: "m.validUntil = '2026-07-01'" },
    { what: 'suspendedAt',      to: "m.suspendedAt = '2026-08-01'" },
    { what: 'terminatedAt',     to: "m.terminatedAt = '2026-08-01'" }
  ];
  CONDITIONS.forEach(c => {
    const win = build();
    if (!win.eval("isOwnLabelPartner('Hawesko GmbH')"))
      return bad('Hawesko is not an active partner to begin with — "' + c.what + '" proves nothing');
    win.eval("(function(){ var m = ownLabelMembershipOf('Hawesko GmbH'); " + c.to + "; })()");
    if (win.eval("isOwnLabelPartner('Hawesko GmbH')"))
      bad('membership still reads active with ' + c.what + ' gone — the condition is not being asked');
    else ok('removing ' + c.what + ' takes the membership inactive');
  });
}

/* ── 3. OL-4 — THREE ACTS, NEVER ONE ────────────────────────────── */
console.log('\n── consent, contract and approval are three records');
{
  const active = MEMBERSHIPS.filter(m => w.eval('isOwnLabelPartner(' + S(m.companyId) + ')'));
  if (!active.length) return bad('no membership is active — this section examined nothing');

  /* An active membership must hold all three, as separate rows, and
     the contract's own approval is a FOURTH act with its own row. */
  const thin = active.filter(m => {
    const c  = CONTRACTS.find(x => x.id === m.contractId);
    const cr = REVIEWS.find(r => r.subjectType === 'contract' && r.subjectId === m.contractId);
    return !m.consentId || !c || !m.reviewId || !cr;
  });
  if (thin.length) bad(thin.length + ' active membership(s) are missing one of the four rows: ' +
    thin.map(m => m.companyId).join(' · '));
  else ok(active.length + ' active membership(s), each holding a consent, a contract, ' +
    'a contract approval and an admission — four rows, four acts');

  /* None of them may be the same row wearing two hats. */
  const overlap = REVIEWS.filter(r => r.subjectType === 'membership')
    .filter(r => REVIEWS.some(o => o.subjectType === 'contract' && o.id === r.id));
  if (overlap.length) bad('a review row is serving as both a contract approval and an admission');
  else ok('a contract approval and a programme admission are never the same row');

  /* An approved contract must not by itself admit anybody. Withdraw
     the admission review and the membership has to fall. */
  {
    const win = build();
    win.eval("(function(){ reviewById(ownLabelMembershipOf('Hawesko GmbH').reviewId).reviewStatus = 'pending'; })()");
    if (win.eval("isOwnLabelPartner('Hawesko GmbH')"))
      bad('an approved contract admits the company on its own — OL-4 says three acts, none implying another');
    else ok('an approved contract does not admit anybody; the admission is its own act');
  }
}

/* ── 4. A17.2 — SEVEN STATES, ALL FOUR PRESENT IN THE FIXTURE ───── */
console.log('\n── the tab state is read from the record');
{
  const EXPECTED = {
    'Hawesko GmbH':              'approved',
    'Domaine Lefèvre':           'approved',
    'Weingut Schmitt':           'approved',
    'Château Belrieu':           'contract_under_review',
    'Enoteca Milano Import Srl': 'contract_sent',
    'Bistro Laurent':            'not_applied'
  };
  Object.keys(EXPECTED).forEach(co => {
    const got = w.eval('ownLabelTabState(' + S(co) + ')');
    if (got !== EXPECTED[co]) bad(co + ' reads "' + got + '" where the records say "' + EXPECTED[co] + '"');
    else ok(co + ' → ' + got);
  });

  /* A17.14 asks for the arc on screen. Four distinct states from real
     records is what makes it an arc rather than one state repeated. */
  const states = new Set(MEMBERSHIPS.map(m => w.eval('ownLabelTabState(' + S(m.companyId) + ')')));
  if (states.size < 3) bad('the memberships produce only ' + states.size +
    ' distinct tab state(s) — the pipeline A17.14 asks for is not visible');
  else ok(states.size + ' distinct tab states across the fixture: ' + [...states].sort().join(' · '));

  /* And a house nobody admitted gets a badge from nowhere (A17.3). */
  const badged = MEMBERSHIPS.filter(m => w.eval('ownLabelPublicBadge(' + S(m.companyId) + ') !== null'));
  const activeIds = MEMBERSHIPS.filter(m => w.eval('isOwnLabelPartner(' + S(m.companyId) + ')')).map(m => m.id);
  if (badged.length !== activeIds.length)
    bad(badged.length + ' badge(s) for ' + activeIds.length + ' active membership(s)');
  else if (w.eval("ownLabelPublicBadge('Château Belrieu') !== null"))
    bad('a company whose contract is still under review carries the public badge');
  else ok('the badge follows the membership exactly: ' + badged.length + ' badges, ' +
    activeIds.length + ' active, none for a company in flight');
}

/* ── 5. OL-11 — NO PROJECT WITHOUT TWO ADMISSIONS AT THE TIME ───── */
console.log('\n── every project was allowed to exist when it was created');
{
  if (!PROJECTS.length) {
    ok('no projects yet — OL-11 has nothing to contradict, and this line moves the day one exists');
  } else {
    PROJECTS.forEach(p => {
      const d = w.eval('isOwnLabelPartner(' + S(p.distributor) + ', ' + S(p.requestedAt) + ')');
      const y = w.eval('isOwnLabelPartner(' + S(p.producer) + ', ' + S(p.requestedAt) + ')');
      if (!d) bad(p.id + ': ' + p.distributor + ' was not an admitted partner on ' + p.requestedAt);
      else if (!y) bad(p.id + ': ' + p.producer + ' was not an admitted partner on ' + p.requestedAt);
      else ok(p.id + ': both houses were admitted before ' + p.requestedAt);
    });

    /* And the partnership itself — A17.4 requires one between the two
       houses, not merely two memberships. */
    PROJECTS.forEach(p => {
      if (!w.eval('arePartners(' + S(p.distributor) + ', ' + S(p.producer) + ')'))
        bad(p.id + ': ' + p.distributor + ' and ' + p.producer + ' hold no partnership at all');
    });
  }
}

/* ── 6. OL-3 — A CONSENT IS IMMUTABLE, AND CARRIES ITS OWN TEXT ─── */
console.log('\n── a consent keeps the text that was accepted');
{
  const thin = CONSENTS.filter(c => typeof c.textSnapshot !== 'string' || c.textSnapshot.length < 40);
  if (thin.length) bad(thin.length + ' consent(s) carry no usable textSnapshot: ' + thin.map(c => c.id).join(' · '));
  else ok('all ' + CONSENTS.length + ' consents carry the text as accepted, not a version to look up');

  const noVersion = CONSENTS.filter(c => !c.termsVersion || !c.termsType);
  if (noVersion.length) bad(noVersion.length + ' consent(s) name no terms version');
  else ok('every consent names its termsType and termsVersion beside the snapshot');

  /* Nothing in the page may write into an existing consent. */
  const CODE = SRC.split('\n').map((line, i) => ({ n: i + 1, line }));
  const writes = CODE.filter(x => /\.textSnapshot\s*=[^=]|consents\[[^\]]*\]\s*=[^=]|\.splice\(.*consents/.test(x.line));
  if (writes.length) bad(writes.length + ' write(s) into a consent: ' + writes.map(x => 'line ' + x.n).join(' · '));
  else ok('nothing assigns into a consent; the array is append-only by construction');
}

/* ── 7. OL-13 — PROGRAMME TEXT IS NOT RESTATED IN A PROJECT TEXT ── */
console.log('\n── no clause sentence appears in both texts');
{
  const sentences = t => t.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(s => s.length > 25);
  const prog = new Set(CONSENTS.filter(c => c.termsType === 'program_terms')
    .flatMap(c => sentences(c.textSnapshot)));
  const proj = CONSENTS.filter(c => c.termsType === 'project_terms');

  if (!prog.size) bad('no programme consent text was found — nothing was compared');
  else if (!proj.length)
    ok(prog.size + ' programme sentence(s) recorded; no project consent exists yet to collide with them');
  else {
    const shared = proj.flatMap(c => sentences(c.textSnapshot)).filter(s => prog.has(s));
    if (shared.length) bad(shared.length + ' sentence(s) appear in both the programme and a project text: ' +
      shared.map(s => JSON.stringify(s.slice(0, 60) + '…')).join(' · '));
    else ok('not one sentence is shared between the programme texts and the ' + proj.length + ' project text(s)');

    /* And a project consent must reference the programme version the
       company actually accepted (A17.7). */
    const wrong = proj.filter(c => {
      const m = MEMBERSHIPS.find(x => x.companyId === c.forCompany);
      const pc = m && CONSENTS.find(x => x.id === m.consentId);
      return !pc || c.programTermsVersion !== pc.termsVersion;
    });
    if (wrong.length) bad(wrong.length + ' project consent(s) do not reference the programme version ' +
      'their company accepted: ' + wrong.map(c => c.id).join(' · '));
    else ok('every project consent points at the programme terms version its company accepted');

    /* A project consent may not be recorded while the membership it
       leans on is inactive (A17.7, checkable). */
    const orphan = proj.filter(c => !w.eval('isOwnLabelPartner(' + S(c.forCompany) + ', ' + S(c.at) + ')'));
    if (orphan.length) bad(orphan.length + ' project consent(s) were recorded while the company was not admitted: ' +
      orphan.map(c => c.id + ' (' + c.forCompany + ', ' + c.at + ')').join(' · '));
    else ok('no project consent predates its own programme membership');
  }
}

/* ── 8. THE GATES ARE READINGS, AND THE COUNTER-CHECKS ──────────── */
console.log('\n── the counter-checks');
{
  /* A gate with no review is not a gate. */
  if (w.eval("projectActive('OLP-NO-SUCH-THING')"))
    bad('a project id nobody holds reads active');
  else ok('a project with no gate-1 review does not read active');

  if (w.eval("gate1Permitted('OLP-NO-SUCH-THING')"))
    bad('gate 1 is permitted for a project with no contracts at all');
  else ok('gate 1 is not permitted without two approved project contracts');

  /* ONE SIGNATURE IS NOT TWO. A17.7 says BOTH parties, and a guard
     that counted rows rather than parties would pass on one company
     signing twice — which is exactly how a two-sided check becomes a
     one-sided one. */
  {
    const win = build();
    win.eval(`(function(){
      contracts.push({ id:'CTR-T1', subjectType:'project', subjectId:'OLP-TEST', party:'Hawesko GmbH',
                       kind:'project_agreement', status:'approved', sentAt:'2026-05-01',
                       receivedAt:'2026-05-05', docNo:'T-1' });
      contracts.push({ id:'CTR-T2', subjectType:'project', subjectId:'OLP-TEST', party:'Hawesko GmbH',
                       kind:'project_agreement', status:'approved', sentAt:'2026-05-01',
                       receivedAt:'2026-05-05', docNo:'T-2' });
    })()`);
    if (win.eval("gate1Permitted('OLP-TEST')"))
      bad('two contracts from ONE party permit gate 1 — the check counts rows, not parties');
    else ok('two signatures from the same house do not permit gate 1');

    win.eval("contractById('CTR-T2').party = 'Cantina Rossi'");
    if (!win.eval("gate1Permitted('OLP-TEST')"))
      bad('two approved contracts from two parties still do not permit gate 1 — nothing would ever pass');
    else ok('two parties, two approved contracts: gate 1 is permitted');
  }

  /* And the mutations: break each reading in the source, and the
     answer has to move. */
  const cases = [
    { what: 'the membership reading stops asking whether the review was approved',
      from: "  if (!reviewApproved(m.reviewId)) return false;",
      to:   "  if (m.reviewId === undefined) return false;",
      ask:  win => win.eval("(function(){ reviewById(ownLabelMembershipOf('Hawesko GmbH').reviewId)" +
                            ".reviewStatus = 'rejected'; return isOwnLabelPartner('Hawesko GmbH'); })() === false"),
      says: 'a rejected admission still admitting the company' },

    { what: 'a suspended membership keeps its badge',
      from: "  if (m.suspendedAt || m.terminatedAt) return false;",
      to:   "  if (m.terminatedAt) return false;",
      ask:  win => win.eval("(function(){ ownLabelMembershipOf('Hawesko GmbH').suspendedAt = '2026-08-01';" +
                            " return ownLabelPublicBadge('Hawesko GmbH'); })() === null"),
      says: 'A17.3 promising the badge disappears the same day, and it not disappearing' },

    { what: 'gate 2 answers from gate 1',
      from: "function approvedForFirstOrder(projectId) { return gateApproved(projectId, 2); }",
      to:   "function approvedForFirstOrder(projectId) { return gateApproved(projectId, 1); }",
      ask:  win => {
        win.eval(`(function(){
          reviews.push({ id:'RVW-T1', subjectType:'project', subjectId:'OLP-TEST', gateNumber:1,
                         reviewStatus:'approved', reviewedBy:'Bottle Lobby', reviewedAt:'2026-05-10',
                         reviewNotes:null, approvalType:'gate_1' });
        })()`);
        return win.eval("approvedForFirstOrder('OLP-TEST') === false");
      },
      says: 'a project cleared for its first order on the strength of gate 1 alone' }
  ];

  cases.forEach(c => {
    const win = build({ from: c.from, to: c.to });
    if (!win) return bad('"' + c.what + '" never applied — the check below proves nothing');
    if (c.ask(win)) bad('NOT caught: ' + c.what + ' — ' + c.says + ', and nothing said so');
    else ok('caught: ' + c.what);
  });
}

console.log(fail ? '\n' + fail + ' check(s) failed' : '\nown-label programme: all checks passed');
process.exit(fail ? 1 : 0);
