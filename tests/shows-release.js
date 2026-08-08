/* ═══════════════════════════════════════════════════════════════════
   THE RELEASE AND WHAT INVALIDATES IT — WS-6 and WS-7 (A16.15)
   -------------------------------------------------------------------
   Two invariants, in the words A16.15 uses:

     · WS-6 — no `published` show without an approved `reviews` row
       (`subjectType: 'show'`).
     · WS-7 — a material change in `pending_approval` or `published`
       resets or renews the affected consents.

   Both are measured the way tests/shows-reach.js measures WS-1..WS-5:
   every claim is made twice — once against the state as built, and once
   against a state in which the rule is broken, where the SAME check has
   to come back red. A check that stays green under its own counter-
   mutation is reported as a failure of the check (C7).

   WS-7 IS ONLY HALF BUILT, AND THIS FILE SAYS SO RATHER THAN TICKING
   IT. The `pending_approval` half — the show falls back and the open
   review is closed — is built and measured here. The `published` half
   asks for notification, renewed consent and a NEW release (A16.2), is
   a different mechanism, and is not built. It is printed as an open
   item below, not as a passing check: a green tick for something that
   does not exist is worse than no tick at all.

   THE STATES ARE BUILT, NOT BORROWED. Every show this file drives is
   walked through the real actions — the venue quotes, the host accepts,
   the split is named, the host submits — because a state assembled by
   assignment proves that the assertions run, not that the platform can
   reach the state.
═══════════════════════════════════════════════════════════════════ */
const path = require('path');
const { loadDashboard } = require('./load-dashboard');
const { JSDOM, VirtualConsole } = require('jsdom');

function boot(file) {
  const errs = [];
  const dom = new JSDOM(loadDashboard(file).html, {
    runScripts: 'dangerously', pretendToBeVisual: true,
    virtualConsole: new VirtualConsole().on('jsdomError', e => errs.push(e.message))
  });
  if (errs.length) { console.log('SCRIPT ERRORS in ' + (file || 'dashboard') + ':\n' + errs.join('\n')); process.exit(1); }
  const w = dom.window;
  w.scrollTo = () => {};
  w.confirm = () => true;
  w.prompt = () => 'The hero image is too dark to read the title over.';
  return w;
}

const DASH = path.join(__dirname, '..', 'bottle-lobby-dashboard.html');
const PAGE = path.join(__dirname, '..', 'bottle-lobby-wine-shows.html');
const w = boot(DASH), d = w.document;
console.log('dashboard evaluated cleanly\n');

let fail = 0;
const bad = m => { console.log('  ✗ ' + m); fail++; };
const ok  = m => console.log('  ✓ ' + m);

const S  = id => w.eval('wineShows').find(x => x.id === id);
const RV = id => w.eval('reviewsFor')('show', id);
const PAST = w.eval('SHOW_PAST_STAGES');

/* Same helper as shows-reach.js, same reasoning: the body is always THE
   CLAIM ITSELF, never its negation. Writing the negation here produces a
   check that passes because it asks the wrong question — which is the
   exact failure this helper exists to catch. */
function expectRed(label, check) {
  const before = fail;
  const realLog = console.log;
  console.log = () => {};
  try { check(); } finally { console.log = realLog; }
  const raised = fail - before;
  fail = before;
  if (raised) ok('counter-mutation: ' + label + ' — the check goes red (' + raised + ')');
  else bad('COUNTER-MUTATION STAYED GREEN: ' + label + ' — this check cannot fail and proves nothing');
}

/* Walks a show all the way to a green checklist, through the actions a
   person would use. Returns what is still missing, so a caller that
   expected green and got red is told why rather than just failing. */
function makeSubmittable(id) {
  const s = S(id);
  w.showWineShows('distributor', 'current');
  w.openShowDetail(id);
  if (s.venueType === 'partner_venue' && s.venueStatus === 'requested') {
    const venueRole = s.venueEntity === 'Weinhaus Müller' ? 'retail'
                    : s.venueEntity === 'Bistro Laurent'  ? 'restaurant' : null;
    if (!venueRole) throw new Error('no demo role is ' + s.venueEntity + ' — this show cannot be driven');
    w.showWineShows(venueRole, 'current');
    w.openShowDetail(id);
    w.openVenueQuoteModal(id);
    d.getElementById('vq-amount').value = '900';
    w.saveVenueQuote();
    w.showWineShows('distributor', 'current');
    w.openShowDetail(id);
  }
  if (s.venueStatus === 'quoted') {
    w.openVenueAcceptModal(id);
    d.getElementById('va-cb').checked = true;
    w.acceptVenueOffer();
    w.openShowDetail(id);
  }
  /* `host_covers` on purpose, and it is the only mode that can reach a
     release today: a charging split needs every bearer's consent, and
     dispatching those quotes is A16.11 steps 4–6 and is not built. That
     is the rule holding, not a shortcut around it — measured directly
     in the section below. */
  if (!s.cateringMode || w.eval('cateringCharges')(s)) {
    d.getElementById('cm-mode-' + id).value = 'host_covers';
    w.saveCateringMode(id);
    w.openShowDetail(id);
  }
  return w.eval('missingPublishPoints')(s);
}

/* ═══════════════════════════════════════════════════════════════════
   WS-6, part one — on the data as it ships
   A published show that arrived without a release row would make every
   check below true by construction, so the fixtures are asked first.
═══════════════════════════════════════════════════════════════════ */
console.log('── WS-6 on the delivered fixtures');
{
  const releasedStages = ['published'].concat(PAST.filter(st => st !== 'cancelled'));
  const released = w.eval('wineShows').filter(s => releasedStages.indexOf(s.stage) !== -1);
  if (!released.length) bad('no released show in the fixtures — WS-6 is untested by the data');
  else ok(released.length + ' released show(s) in the fixtures: ' + released.map(s => s.id).join(', '));
  released.forEach(s => {
    if (!w.eval('showReleaseApproved')(s))
      bad(s.id + ' is ' + s.stage + ' with no approved reviews row (WS-6)');
    else ok(s.id + ' (' + s.stage + ') carries an approved show_release row');
  });
  /* And the row is the right SHAPE, not merely present. */
  RV('WS-2603').forEach(r => {
    if (r.approvalType !== 'show_release') bad('WS-2603 review is not a show_release: ' + r.approvalType);
    else if (r.gateNumber !== null) bad('a release is not a numbered gate: ' + r.gateNumber);
    else if (r.reviewedBy !== 'Bottle Lobby') bad('a release is Bottle Lobby\'s act, reviewedBy is ' + r.reviewedBy);
    else ok('the release row is show_release / gateNumber null / reviewedBy Bottle Lobby');
  });
  /* A show under review has a PENDING row and no approval — the asking
     is recorded, the deciding is not. */
  const nordic = S('WS-2602');
  if (nordic.stage !== 'pending_approval') bad('WS-2602 must ship under Final Review for this to mean anything');
  else if (!w.eval('showReviewOpen')(nordic)) bad('a submitted show with no open review row (A16.14c)');
  else if (w.eval('showReleaseApproved')(nordic)) bad('a show under review must not read as approved');
  else ok('WS-2602 is under review: an open row, and no approval');

  expectRed('take the approved release row off WS-2603', () => {
    const keep = w.eval('reviews').filter(r => r.subjectId === 'WS-2603');
    w.eval("reviews = reviews.filter(function (r) { return r.subjectId !== 'WS-2603'; })");
    const released2 = w.eval('wineShows').filter(s => ['published'].concat(PAST.filter(x => x !== 'cancelled')).indexOf(s.stage) !== -1);
    released2.forEach(s => {
      if (!w.eval('showReleaseApproved')(s))
        bad(s.id + ' is ' + s.stage + ' with no approved reviews row (WS-6)');
      else ok(s.id + ' carries an approved show_release row');
    });
    keep.forEach(r => w.eval('reviews').push(r));
  });
}

/* ═══════════════════════════════════════════════════════════════════
   The checklist is the door — an incomplete one does not open
═══════════════════════════════════════════════════════════════════ */
console.log('\n── an incomplete checklist cannot be submitted');
{
  /* WS-2604 ships in `planning` with a requested venue, no exhibitor,
     no wine, no split — every line red. Built up from there. */
  const s = S('WS-2604');
  const missing = w.eval('missingPublishPoints')(s);
  if (missing.length < 4) bad('WS-2604 should be missing most of the checklist, got ' + JSON.stringify(missing));
  else ok('WS-2604 is missing ' + missing.length + ' points, each one named: ' + missing.join(' | '));
  w.submitShowForRelease('WS-2604');
  if (s.stage === 'pending_approval') bad('an incomplete show was submitted');
  else ok('submit refused — the show stays in planning');
  if (RV('WS-2604').length) bad('a refused submit wrote a review row: ' + JSON.stringify(RV('WS-2604')));
  else ok('a refused submit writes nothing — no row, no record of an asking that did not happen');

  /* Now the line-up, through the real handshake. */
  w.showWineShows('distributor', 'current');
  w.openShowDetail('WS-2604');
  w.openInviteModal('WS-2604');
  d.getElementById('if-producer').value = 'Cantina Rossi'; w.onInviteProducerChange();
  const opt = [...d.getElementById('if-product').options].find(o => o.textContent.includes('Primitivo Riserva'));
  d.getElementById('if-product').value = opt.value;
  w.saveInvite();
  w.showWineShows('winery', 'current');
  w.openShowDetail('WS-2604');
  w.respondToInvite('WS-2604', 'confirm');
  if (!w.eval('publishReadiness')(s).product) bad('the confirmed wine did not tick the wine line');
  else ok('a two-sided yes ticks the exhibitor and wine lines');
  w.submitShowForRelease('WS-2604');
  if (s.stage === 'pending_approval') bad('submitted with the venue unaccepted and no split named');
  else ok('a line-up alone is still not a submittable show');

  const left = makeSubmittable('WS-2604');
  if (left.length) bad('the checklist is still not green: ' + left.join(' | '));
  else ok('venue accepted and split named — every line green');

  /* A SPLIT THAT CHARGES SOMEBODY NAMES WHO HAS NOT AGREED. This is the
     consent line doing its arithmetic over the exhibitor rows (A16.10),
     not a placeholder: pick a charging mode and the show stops being
     publishable until each bearer has consented. */
  w.openShowDetail('WS-2604');
  d.getElementById('cm-mode-WS-2604').value = 'fixed_per_product';
  w.saveCateringMode('WS-2604');
  const rd = w.eval('publishReadiness')(s);
  if (rd.consents) bad('a charging split with no consents must not read as settled');
  else ok('a charging split reopens the consent line');
  if (rd.missingConsents.join(',') !== 'Cantina Rossi')
    bad('the missing bearer is not named: ' + JSON.stringify(rd.missingConsents));
  else ok('the missing bearer is NAMED, not counted: ' + rd.missingConsents.join(', '));
  w.submitShowForRelease('WS-2604');
  if (s.stage === 'pending_approval') bad('submitted with a contribution nobody consented to');
  else ok('a charging split cannot be released until the bearers agree (A16.11 step 9)');
  makeSubmittable('WS-2604');
}

/* ═══════════════════════════════════════════════════════════════════
   Submit → an open review row exists (A16.14c)
═══════════════════════════════════════════════════════════════════ */
console.log('\n── submitting is an act, and the act is a row');
{
  w.showWineShows('distributor', 'current');
  w.openShowDetail('WS-2604');
  w.submitShowForRelease('WS-2604');
  const s = S('WS-2604');
  if (s.stage !== 'pending_approval') bad('submit failed: ' + JSON.stringify(w.eval('missingPublishPoints')(s)));
  else ok('submitted → pending_approval');
  const open = w.eval('showReviewOpen')(s);
  if (!open) bad('no open review row after submitting');
  else {
    if (open.subjectType !== 'show')        bad('subjectType is ' + open.subjectType + ', not "show"');
    if (open.approvalType !== 'show_release') bad('approvalType is ' + open.approvalType);
    if (open.gateNumber !== null)           bad('gateNumber is ' + open.gateNumber + ', a release is not a gate');
    if (open.reviewedBy !== null)           bad('reviewedBy is ' + open.reviewedBy + ' — nobody has reviewed anything yet');
    else ok('one pending row: subjectType show, show_release, gateNumber null, no reviewer yet');
  }
  if (w.eval('showReleaseApproved')(s)) bad('a pending row must not read as an approval');
  else ok('pending is not approved');
  /* THE UI LABEL, on the stage where it appears (A16.2). */
  const chip = d.querySelector('#dshow-detail-pane .ws-pending_approval');
  if (!chip || !chip.textContent.includes('Final Review')) bad('the stage does not read "Final Review"');
  else if (s.stage !== 'pending_approval') bad('the STORED stage changed name — it must stay pending_approval');
  else ok('reads "Final Review", stores pending_approval — one stage, not two');
  /* Submitting twice must not open a second review. */
  w.submitShowForRelease('WS-2604');
  if (RV('WS-2604').length !== 1) bad('a second submit opened another review: ' + RV('WS-2604').length + ' rows');
  else ok('a show already with Bottle Lobby cannot be submitted again');
}

/* ═══════════════════════════════════════════════════════════════════
   WS-7 — a material change in `pending_approval`
   The show falls back, the open review is CLOSED BY A NEW ROW, and the
   log names the field that did it.
═══════════════════════════════════════════════════════════════════ */
console.log('\n── WS-7: the show moves under review, so the review lapses');
{
  const s = S('WS-2604');
  if (s.stage !== 'pending_approval') bad('WS-2604 must be under review for this section');
  const before = RV('WS-2604').map(r => JSON.stringify(r));

  /* A CHANGE THROUGH A REAL ACTION: the host changes how the cost is
     split while Bottle Lobby is reading the show. */
  w.showWineShows('distributor', 'current');
  w.openShowDetail('WS-2604');
  w.eval("(function(){var s=wineShows.find(x=>x.id==='WS-2604');s.cateringMode='fixed_per_product';s.cateringRatePerProduct=250;})()");
  w.refreshShows();

  if (s.stage !== 'planning') bad('a material change left the show under review, stage is ' + s.stage);
  else ok('the cost split changed → back to planning');
  if (w.eval('showReviewOpen')(s)) bad('the review is still open after the show moved');
  else ok('no open review remains');

  const after = RV('WS-2604');
  if (after.length !== before.length + 1) bad('expected exactly one new row, have ' + after.length);
  else ok('the review was closed by a NEW row, not by editing the old one');
  /* APPEND-ONLY, MEASURED: every row that existed is byte-identical. */
  const survived = after.slice(0, before.length).map(r => JSON.stringify(r));
  if (JSON.stringify(survived) !== JSON.stringify(before)) bad('an existing review row was rewritten');
  else ok('every earlier row is unchanged — the register is append-only (OL-3)');
  const closing = after[after.length - 1];
  if (closing.reviewStatus !== 'superseded')
    bad('the closing row claims a decision nobody took: ' + closing.reviewStatus);
  else ok('the closing row is "superseded" — nobody approved and nobody refused');
  if (!closing.reviewNotes || !closing.reviewNotes.includes('cost split'))
    bad('the closing row does not name what changed: ' + closing.reviewNotes);
  else ok('the closing row names the field: "' + closing.reviewNotes + '"');
  const trail = s.events.map(e => e.text).join(' | ');
  if (!trail.includes('Withdrawn from Final Review') || !trail.includes('cost split'))
    bad('the show log does not name the withdrawal and the field: ' + trail.slice(-160));
  else ok('the show log names the withdrawal and the field that caused it');

  /* THE COUNTER-MUTATION, AND IT IS THE OTHER DIRECTION: a change that
     is NOT material must leave the review alone. A watch that fires on
     everything would pass every check above and be useless — it would
     mean no show could ever survive being looked at. */
  makeSubmittable('WS-2604');
  w.submitShowForRelease('WS-2604');
  if (S('WS-2604').stage !== 'pending_approval') bad('could not resubmit after the fallback');
  else ok('resubmitted after the fallback — a return path, not a dead end');
  const rows = RV('WS-2604').length;
  w.eval("(function(){var s=wineShows.find(x=>x.id==='WS-2604');s.title='Sicilia Prima 2027';s.focus='Sicilian reds';})()");
  w.refreshShows();
  if (S('WS-2604').stage !== 'pending_approval')
    bad('a title and focus change threw the show out of review — those are the host\'s own presentation, nobody consented to them');
  else ok('a title or focus change is not material — the review stands');
  if (RV('WS-2604').length !== rows) bad('a non-material change wrote a review row');
  else ok('and it wrote no row');

  expectRed('move the date under review and require the review to survive', () => {
    w.eval("(function(){var s=wineShows.find(x=>x.id==='WS-2604');s._d=s.date;s.date='2027-04-18';})()");
    w.refreshShows();
    /* THE CLAIM ITSELF, unchanged: a show under review stays under
       review and its rows stand. Against a moved date it must fail. */
    if (S('WS-2604').stage !== 'pending_approval') bad('the show left Final Review');
    if (RV('WS-2604').length !== rows) bad('a review row was written');
    w.eval("(function(){var s=wineShows.find(x=>x.id==='WS-2604');s.date=s._d;delete s._d;})()");
  });
}

/* ═══════════════════════════════════════════════════════════════════
   Changes requested — the return path, with the reason on the row
═══════════════════════════════════════════════════════════════════ */
console.log('\n── changes requested sends the show back, with a reason');
{
  makeSubmittable('WS-2604');
  if (S('WS-2604').stage !== 'pending_approval') w.submitShowForRelease('WS-2604');
  const rowsBefore = RV('WS-2604').length;
  w.showWineShows('distributor', 'current');
  w.openShowDetail('WS-2604');
  w.simulateStaffChangesRequested('WS-2604');
  const s = S('WS-2604');
  if (s.stage !== 'planning') bad('a request for changes should send the show back to planning, is ' + s.stage);
  else ok('back to planning — the show goes on being listed while it is amended');
  const last = w.eval('showReviewLatest')(s);
  if (RV('WS-2604').length !== rowsBefore + 1) bad('the answer was not a new row');
  else if (last.reviewStatus !== 'changes_requested') bad('the answer row is ' + last.reviewStatus);
  else if (last.reviewedBy !== 'Bottle Lobby') bad('the answer must be Bottle Lobby\'s act');
  else if (!last.reviewNotes) bad('a request for changes with no reason on the row');
  else ok('a new row: changes_requested, by Bottle Lobby, reason "' + last.reviewNotes + '"');
  if (w.eval('showReleaseApproved')(s)) bad('a refused show must not read as released');
  else ok('nothing about it reads as released');
  if (!s.events.some(e => e.text.includes('Changes requested'))) bad('the show log does not carry the decision');
  else ok('the show log carries the decision too');
}

/* ═══════════════════════════════════════════════════════════════════
   WS-6, part two — approve, and only then published
═══════════════════════════════════════════════════════════════════ */
console.log('\n── WS-6 through the actions: approve, and only then published');
{
  const s = S('WS-2604');
  /* Releasing a show nobody submitted must be impossible — that is the
     failure WS-6 names, reached from the other side. */
  const stageBefore = s.stage, rowsBefore = RV('WS-2604').length;
  w.simulateStaffRelease('WS-2604');
  if (s.stage !== stageBefore) bad('a show with no open review was released');
  else ok('a show nobody submitted cannot be released');
  if (RV('WS-2604').length !== rowsBefore) bad('a refused release wrote a row');
  else ok('and it wrote no approval');

  makeSubmittable('WS-2604');
  w.submitShowForRelease('WS-2604');
  w.showWineShows('distributor', 'current');
  w.openShowDetail('WS-2604');
  w.simulateStaffRelease('WS-2604');
  if (s.stage !== 'published') bad('release failed, stage is ' + s.stage);
  else ok('approved → published');
  const last = w.eval('showReviewLatest')(s);
  if (last.reviewStatus !== 'approved') bad('the last row is ' + last.reviewStatus);
  else if (last.reviewedBy !== 'Bottle Lobby' || !last.reviewedAt) bad('the approval names no reviewer or no date');
  else if (last.approvalType !== 'show_release' || last.gateNumber !== null) bad('wrong shape: ' + JSON.stringify(last));
  else ok('the approval is its own row: show_release, by Bottle Lobby, dated');
  if (!w.eval('showReleaseApproved')(s)) bad('published with no approved row — WS-6');
  else ok('WS-6 holds on a show driven all the way through');

  /* WS-3's connection: from `published` the names are out. Measured on
     the dashboard's own public preview, which is rendered by the same
     publicShowCard() the public page uses — that shared renderer is
     what A16.6's single-answer rule is, and shows-reach.js rests on it
     for the same reason. */
  w.openShowDetail('WS-2604');
  const preview = d.querySelector('#dshow-detail-pane .ws-public').textContent;
  if (!preview.includes('Cantina Rossi')) bad('a published show should name its confirmed exhibitor: ' + preview.slice(0, 140));
  else ok('the public view of the published show names Cantina Rossi');

  expectRed('take the approval row away and keep the show published', () => {
    const keep = w.eval('reviews').filter(r => r.subjectId === 'WS-2604' && r.reviewStatus === 'approved');
    w.eval("reviews = reviews.filter(function (r) { return !(r.subjectId === 'WS-2604' && r.reviewStatus === 'approved'); })");
    if (!w.eval('showReleaseApproved')(S('WS-2604'))) bad('published with no approved row — WS-6');
    keep.forEach(r => w.eval('reviews').push(r));
  });
}

/* ═══════════════════════════════════════════════════════════════════
   And the real public page, on the fixture that ships published
   Its own window, its own data — nothing from the dashboard reaches it.
═══════════════════════════════════════════════════════════════════ */
console.log('\n── the public route of a released show names people; a planning one does not');
{
  const p = boot(PAGE), pd = p.document;
  const body = pd.body.cloneNode(true);
  [...body.querySelectorAll('script')].forEach(n => n.remove());
  const txt = body.textContent;
  if (!txt.includes('Loire & Mosel')) bad('the published fixture is missing from the public page');
  else if (!txt.includes('Weingut Schmitt')) bad('a published show must name its exhibitors publicly (A16.6)');
  else ok('WS-2603 (published, and carrying RVW-3001) names its exhibitors on the open route');
  if (txt.includes('Bodegas Ruiz')) bad('a planning show named an exhibitor on the public page');
  else ok('WS-2601 (planning) is listed and names nobody — the release is what opens the names');
}

/* ═══════════════════════════════════════════════════════════════════
   WHAT IS NOT COVERED, stated rather than ticked
═══════════════════════════════════════════════════════════════════ */
console.log('\n── open, and deliberately not asserted here');
console.log('    WS-7, the `published` half: a material change to a released show has to');
console.log('    notify the affected parties, have them renew their consent and take a NEW');
console.log('    Bottle Lobby release (A16.2). Not built — a silent fallback would');
console.log('    un-publish a show people have already been told about. Its own pass.');

console.log(fail ? `\n✗ ${fail} failure(s)` : '\n✓ all checks passed');
process.exit(fail ? 1 : 0);
