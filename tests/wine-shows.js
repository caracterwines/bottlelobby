const path = require('path');
const { loadDashboard } = require('./load-dashboard');
/* The wine selects carry the product KEY as their value and the label
   as their text (pass 3b). A harness that assigns a label would set
   nothing and the action would silently return — so it picks the
   option the way a person does, by what is written on it, and fails
   loudly when no option says that. */
function pickWine(d, selectId, label) {
  const sel = d.getElementById(selectId);
  if (!sel) throw new Error(selectId + ' is not on the page');
  const opt = [...sel.options].find(o => o.textContent.trim().startsWith(label));
  if (!opt) throw new Error('no option reading "' + label + '" in #' + selectId +
    ' — offered: ' + [...sel.options].map(o => o.textContent.trim()).join(' | '));
  sel.value = opt.value;
  return opt.value;
}
const DASHBOARD = path.join(__dirname, '..', 'bottle-lobby-dashboard.html');
const { JSDOM, VirtualConsole } = require('jsdom');
const fs = require('fs');
const html = loadDashboard().html;   // inlines <script src> — see load-dashboard.js
const errors = [];
const vc = new VirtualConsole().on('jsdomError', e => errors.push('JSDOM: ' + e.message));
const dom = new JSDOM(html, { runScripts:'dangerously', pretendToBeVisual:true, virtualConsole:vc });
const w = dom.window, d = w.document;
w.scrollTo = () => {};
w.confirm = () => true;
if (errors.length) { console.log('SCRIPT ERRORS:\n' + errors.join('\n')); process.exit(1); }
console.log('script evaluated cleanly\n');

let fail = 0;
const bad = m => { console.log('  ✗ ' + m); fail++; };
const ok  = m => console.log('  ✓ ' + m);
const shows = () => w.eval('wineShows');
const byId  = id => shows().find(s => s.id === id);

// ── 1. badges before any view is opened
console.log('── initial badges');
if (d.getElementById('wshow-badge').textContent !== '1') bad('winery badge should be 1 pending invitation');
else ok('winery badge = 1 open invitation');
/* 4, not 3: WS-2602's venue has quoted and the host now owes the
   binding acceptance (A16.11 step 6). That turn was uncounted only for
   as long as the host had no way to answer it. */
if (d.getElementById('dshow-badge').textContent !== '4') bad('distributor badge should be 4 (1 wine + 1 attendee request + 1 venue quote to accept + 1 awaiting release), got ' + d.getElementById('dshow-badge').textContent);
else ok('distributor badge = 4 (a wine, a request for a place, a venue quote to accept, a show awaiting release)');

// ── 2. view isolation: opening shows hides dashboard/profile/orders
console.log('\n── view switching');
for (const [role, other] of [['distributor','d'],['winery','w']]) {
  w.showWineShows(role, 'current');
  const cfg = w.eval('SHOW_ROLES')[role];
  if (d.getElementById(cfg.dashboardView).style.display !== 'none') bad(role + ': dashboard still visible');
  if (d.getElementById(cfg.profileView).style.display !== 'none') bad(role + ': profile still visible');
  if (d.getElementById(cfg.ordersView).style.display !== 'none') bad(role + ': orders still visible');
  if (d.getElementById(cfg.view).style.display === 'none') bad(role + ': shows view not shown');
  if (!d.getElementById(cfg.nav).classList.contains('active')) bad(role + ': nav not active');
  if (d.getElementById(cfg.profileTabs).style.display !== 'none') bad(role + ': profile tab bar still shown');
  ok(role + ': shows view isolated, nav active');
}
// and the reverse: profile/orders routers hide the shows view
w.showWineShows('distributor','current');
w.showDistributorView('profile','basics');
if (d.getElementById('distributor-view-shows').style.display !== 'none') bad('showDistributorView did not hide the shows view');
else ok('profile router hides the shows view');
w.showWineShows('distributor','current');
w.showOrders('distributor','incoming');
if (d.getElementById('distributor-view-shows').style.display !== 'none') bad('showOrders did not hide the shows view');
else ok('orders router hides the shows view');

// ── 3. no duplicate ids once BOTH shells are built
console.log('\n── runtime id uniqueness (orders + shows shells live)');
w.showOrders('winery','incoming'); w.showOrders('distributor','incoming');
w.showWineShows('winery','current'); w.showWineShows('distributor','current');
const all = [...d.querySelectorAll('[id]')].map(e => e.id);
const dup = all.filter((x,i) => all.indexOf(x) !== i);
if (dup.length) bad('duplicate ids at runtime: ' + [...new Set(dup)]); else ok('all ' + all.length + ' ids unique');

// ── 4. list contents per role
console.log('\n── list per role');
w.showWineShows('distributor','current');
const dRows = d.querySelectorAll('#dshow-table .otbl-row').length;
if (dRows !== 5) bad('distributor current tab: expected 5 rows, got ' + dRows); else ok('distributor sees 5 active shows');
w.showWineShows('distributor','history');
if (d.querySelectorAll('#dshow-table .otbl-row').length !== 1) bad('distributor history should hold 1'); else ok('distributor history = 1');
w.showWineShows('winery','current');
const wRows = [...d.querySelectorAll('#wshow-table .otbl-row')];
if (wRows.length !== 2) bad('winery current: expected 2, got ' + wRows.length); else ok('winery sees 2 active shows');
if (!wRows[0].textContent.includes('Grande Rioja')) bad('pending invitation should sort first, got: ' + wRows[0].textContent.slice(0,40));
else ok('pending invitation sorts to the top');
// the winery must not see shows it was never invited to
if (wRows.some(r => r.textContent.includes('Loire & Mosel'))) bad('winery sees a show it was not invited to');
else ok('winery sees only its own shows');

// ── 5. the two visibility levels (A16.6)
console.log('\n── visibility levels');
w.showWineShows('distributor','current');
w.openShowDetail('WS-2601');                       // planning
let pub = d.querySelector('#dshow-detail-pane .ws-public').textContent;
if (!pub.includes('Grande Rioja') || !pub.includes('Düsseldorf')) bad('anonymised card missing title/city');
if (pub.includes('Bodegas Ruiz')) bad('anonymised card leaks an exhibitor name');
else ok('planning → anonymised, no exhibitor named');
w.toggleShowVisPreview('full');
pub = d.querySelector('#dshow-detail-pane .ws-public').textContent;
if (!pub.includes('Bodegas Ruiz') || !pub.includes('Rioja Reserva 2019')) bad('full preview missing exhibitor/wine');
else ok('full preview names exhibitors and wines');
w.openShowDetail('WS-2603');                       // published
pub = d.querySelector('#dshow-detail-pane .ws-public').textContent;
if (!pub.includes('Weingut Schmitt')) bad('published show should default to the full card');
else ok('published → full card by default');

// ── 6. TWO checks, and D38 separated them (A16.2, A16.10, A16.14c)
/* `planning` is entered on the HOST'S BASICS alone — title, date, city,
   focus — because recruiting is what that stage is for. Venue,
   exhibitors, wines and costs are PUBLISH preconditions now, and they
   are what the checklist box asks about.

   WS-2604 ships in `planning`, so the harness BUILDS the draft it needs
   rather than leaning on a fixture that has legitimately moved. And it
   builds a draft whose basics do NOT stand, because a draft with them
   promotes itself the moment anything is asked of it — which is the
   behaviour under test, not an obstacle to it. */
console.log('\n── planning is entered on the basics alone (D38)');
w.eval("(function(){var s=wineShows.find(x=>x.id==='WS-2604');s.stage='draft';s._focus=s.focus;s.focus='';})()");
if (byId('WS-2604').stage !== 'draft') bad('could not put WS-2604 back into draft for this section');
if (w.eval('showBasics')(byId('WS-2604')).ready) bad('a show with no focus must not count as having its basics');
else ok('basics incomplete — a show with no focus is not ready to list');
w.eval('promoteIfReady')(byId('WS-2604'));
if (byId('WS-2604').stage !== 'draft') bad('promoted without the basics');
else ok('no promotion while a basic is missing');
w.eval("(function(){var s=wineShows.find(x=>x.id==='WS-2604');s.focus=s._focus;delete s._focus;})()");
w.eval('promoteIfReady')(byId('WS-2604'));
if (byId('WS-2604').stage !== 'planning') bad('the basics stand and it did not list, is ' + byId('WS-2604').stage);
else ok('basics complete → listed in planning, with no venue, no exhibitor and no wine');
if (!byId('WS-2604').events.some(e => e.text.includes('listed in Planning'))) bad('the listing is not in the trail');
else ok('the listing is written to the append-only trail');

console.log('\n── the publish checklist');
w.showWineShows('distributor','current');
w.openShowDetail('WS-2604');                       // planning, venue asked, no exhibitors
let rows = [...d.querySelectorAll('#dshow-detail-pane .ws-check-row')];
if (rows.length !== 6) bad('expected 6 checklist rows, got ' + rows.length);
let met = rows.map(r => r.classList.contains('met'));
if (JSON.stringify(met) !== JSON.stringify([false,false,false,false,false,false]))
  bad('checklist on a fresh planning show wrong: ' + met);
else ok('nothing met yet: venue, exhibitor, wine, total, split, consents');
if (!rows[0].textContent.includes('Bistro Laurent')) bad('venue row does not name who is being waited on');
else ok('venue row names the partner it waits on');
/* A MISSING POINT IS NAMED, NOT COUNTED — the whole value of the box. */
if (!rows[4].textContent.includes('say how the cost reaches')) bad('the split row does not say what to do: ' + rows[4].textContent);
else ok('an unmet row says what is missing, not that something is');

// the venue answers → the TOTAL is fixed, and only that
w.showWineShows('restaurant','current');
w.openShowDetail('WS-2604');
w.openVenueQuoteModal('WS-2604');
d.getElementById('vq-amount').value = '900';
w.saveVenueQuote();
w.showWineShows('distributor','current');
w.openShowDetail('WS-2604');
met = [...d.querySelectorAll('#dshow-detail-pane .ws-check-row')].map(r => r.classList.contains('met'));
if (JSON.stringify(met) !== JSON.stringify([false,false,false,true,false,false])) bad('checklist after the quote: ' + met);
else ok('venue quoted → the total is fixed, and the venue line is NOT — that waits on the host accepting');
if (byId('WS-2604').stage !== 'planning') bad('a quote must not move the stage');
else ok('still planning — a quote is not a release');

// ── 7. full flow: invite → producer confirms with a different wine → auto-promote
console.log('\n── invite / counter-propose / auto-promotion');
w.openInviteModal('WS-2604');
if (d.getElementById('wine-show-modal').classList.contains('active')) bad('wrong modal opened');
if (!d.getElementById('show-invite-modal').classList.contains('active')) bad('invite modal did not open');
else ok('invite modal opens');
const prodSel = d.getElementById('if-producer');
if (![...prodSel.options].some(o => o.value === 'Cantina Rossi')) bad('Cantina Rossi not offered');
prodSel.value = 'Cantina Rossi'; w.onInviteProducerChange();
/* Labels for the comparison, values for "is this a wine at all":
   the first option is the empty "No preference" one, whose value
   is '' and whose text is now prose. */
const wineOpts = [...d.getElementById('if-product').options]
  .filter(o => o.value).map(o => o.textContent.trim());
/* Derived, not a hand-written whitelist. The list used to name nine
   of Cantina Rossi's wines, so backfilling a tenth (Terra Rossa, A3)
   read as a foreign wine being offered — a check that has to be
   edited whenever the data grows is measuring the editor. */
/* w.eval, not w.partnerWinesPool: a top-level `const` in a classic
   script is not a property of the window, only `function` is. */
const rossiWines = JSON.parse(w.eval(
  "JSON.stringify(partnerWinesPool.filter(function (x) { return x.winery === 'Cantina Rossi'; })" +
  ".map(function (x) { return x.name + ' ' + x.vintage; }))"));
const foreign = wineOpts.filter(v => v && rossiWines.indexOf(v) === -1);
if (!rossiWines.length) bad('Cantina Rossi has no wines to offer — this check examined nothing');
else if (foreign.length) bad('foreign wine offered: ' + foreign.join(', '));
else ok("wine picker holds only Cantina Rossi's own wines");
pickWine(d, 'if-product', 'Primitivo Riserva 2020');
w.saveInvite();
let s = byId('WS-2604');
if (s.exhibitors.length !== 1 || s.exhibitors[0].status !== 'invited') bad('invitation not recorded');
else ok('invitation recorded as invited/proposed');
/* The stage does not move on an invitation, and it does not move on
   anything else in this section either: a listed show stays listed
   while it recruits, and only a submit takes it further (D38). */
if (s.stage !== 'planning') bad('an invitation must not move the stage, is ' + s.stage);
else ok('still planning — recruiting is what that stage is for');

// producer side
w.showWineShows('winery','current');
if (d.getElementById('wshow-badge').textContent !== '2') bad('winery badge should now be 2, got ' + d.getElementById('wshow-badge').textContent);
else ok('winery badge picked up the new invitation');
w.openShowDetail('WS-2604');
w.openCounterModal('WS-2604');
const mine = [...d.getElementById('cf-product').options].map(o => o.value);
if (!mine.length) bad('counter modal has no wines');
pickWine(d, 'cf-product', 'Grillo Sicilia DOC 2023');
w.saveCounter();
s = byId('WS-2604');
const ex = s.exhibitors[0];
if (ex.status !== 'confirmed') bad('producer place not taken');
const live = ex.products.filter(p => p.status !== 'declined');
/* Resolved through the page: a show product names a key now, so the
   assertion reads what a person sees rather than what the fixture
   happens to store. */
const liveLabel = w.eval('wineLabel(' + JSON.stringify(live[0] && live[0].productId) + ')');
if (live.length !== 1 || liveLabel !== 'Grillo Sicilia DOC 2023' || live[0].proposedBy !== 'producer'
    || live[0].status !== 'proposed')
  bad('counter-proposal not recorded as a proposal: ' + JSON.stringify(ex.products));
else ok('counter-proposal recorded as proposed-by-producer, awaiting the host (D23)');
if (s.stage !== 'planning') bad('a one-sided proposal must not move the stage, is ' + s.stage);
else ok('still planning — the host has not agreed the wine yet');

// the host now has to say yes; only then does it count
w.showWineShows('distributor','current');
w.openShowDetail('WS-2604');
w.hostRespondToProduct('WS-2604','Cantina Rossi','confirm');
s = byId('WS-2604');
if (s.exhibitors[0].products.find(p => p.status === 'confirmed') === undefined) bad('host confirm did not stick');
else ok('host confirmed the wine — both sides agreed');
if (s.stage !== 'planning') bad('the stage should still be planning, is ' + s.stage);
else ok('a confirmed wine ticks a checklist line and moves no stage — that is the submit');

// ── 8. submit + demo release
console.log('\n── approval gate');
w.showWineShows('distributor','current');
w.openShowDetail('WS-2604');
/* An INCOMPLETE checklist must not submit. The venue has quoted but
   nobody has accepted it and no cost split is named, so two lines are
   red — and a red line is a closed door, not a warning. */
w.submitShowForRelease('WS-2604');
if (byId('WS-2604').stage === 'pending_approval') bad('submitted with an incomplete checklist');
else ok('an incomplete checklist cannot be submitted');
/* Now complete it, through the real actions. */
w.openVenueAcceptModal('WS-2604');
d.getElementById('va-cb').checked = true;
w.acceptVenueOffer();
w.openShowDetail('WS-2604');
d.getElementById('cm-mode-WS-2604').value = 'host_covers';
w.saveCateringMode('WS-2604');
if (!w.eval('publishReadiness')(byId('WS-2604')).ready)
  bad('the checklist is still not green: ' + JSON.stringify(w.eval('publishReadiness')(byId('WS-2604'))));
else ok('venue accepted and the split named — every line green');
w.submitShowForRelease('WS-2604');
if (byId('WS-2604').stage !== 'pending_approval') bad('submit failed');
else ok('submitted → Final Review (stage pending_approval)');
/* THE STORED STAGE KEEPS ITS NAME, the label is what is read (A16.2). */
w.openShowDetail('WS-2604');
if (!d.querySelector('#dshow-detail-pane .ws-pending_approval').textContent.includes('Final Review'))
  bad('the stage chip does not read "Final Review"');
else ok('the stage renders as "Final Review" while the stored value stays pending_approval');
/* WS-6: the asking is a row, and it is open. */
{
  const open = w.eval('showReviewOpen')(byId('WS-2604'));
  if (!open) bad('submitting wrote no review row');
  else if (open.subjectType !== 'show' || open.approvalType !== 'show_release' || open.gateNumber !== null)
    bad('the review row is not a show release: ' + JSON.stringify(open));
  else ok('submitting wrote a pending reviews row, subjectType show / show_release');
  if (w.eval('showReleaseApproved')(byId('WS-2604'))) bad('a pending review must not count as approved');
  else ok('a pending row is not an approval');
}
const gate = d.querySelector('#dshow-detail-pane .ws-demo');
if (!gate || !gate.textContent.includes('Simulate release (demo)')) bad('demo button missing or unlabelled');
else if (!gate.textContent.includes('internal admin panel')) bad('demo note does not name the real mechanism');
else ok('demo release button is labelled as demo and names the real gate');
w.simulateStaffRelease('WS-2604');
if (byId('WS-2604').stage !== 'published') bad('release failed');
else ok('released → published');
w.openShowDetail('WS-2604');
if (!d.querySelector('#dshow-detail-pane .ws-public').textContent.includes('Cantina Rossi'))
  bad('published show still hides its exhibitor');
else ok('published show now shows exhibitors publicly');

// ── 9. decline path
console.log('\n── decline');
w.showWineShows('winery','current');
w.openShowDetail('WS-2601');
w.respondToInvite('WS-2601','decline');
const de = byId('WS-2601').exhibitors.find(e => e.producer === 'Cantina Rossi');
if (de.status !== 'declined' || de.products.some(p => p.status !== 'declined')) bad('decline did not propagate to products');
else ok('decline marks exhibitor and its products declined');

// ── 10. products are references, never copies
console.log('\n── product references');
/* Compared by KEY, and a miss is a FAILURE rather than a note.
   This built "name vintage" on both sides and read `p.name` off the
   show product — a field pass 3b removed. Every product therefore
   compared as `undefined`, all thirteen landed in `orphans`, and the
   result was printed as a friendly note that could never fail.

   RESOLVED THROUGH wineByRef(), NOT AGAINST partnerWinesPool. The
   first repair asserted the pool and went red on PRD-1022 — which is
   correct data, not a defect: "Primitivo — Alcamo DOC" is an own-label
   wine, and A17.9 says no distributor but the exclusive one may even
   see it in a picker, so it has no business in the pool everybody
   browses. The question a show product has to answer is "does this
   name a product the platform knows, and is it the exhibitor's own",
   and those are the two asked below. */
const orphans = [], misattributed = [];
let checked = 0;
shows().forEach(s => s.exhibitors.forEach(e => e.products.forEach(p => {
  checked++;
  const rec = w.eval('wineByRef(' + JSON.stringify(p.productId) + ')');
  if (!rec) orphans.push(s.id + ': ' + JSON.stringify(p.productId));
  else if (rec.winery !== e.producer)
    misattributed.push(s.id + ': ' + rec.name + ' is ' + rec.winery + "'s, exhibited by " + e.producer);
})));
if (!checked) bad('no show products at all — this check examined nothing');
else if (orphans.length) bad(orphans.length + ' of ' + checked +
  ' show product(s) name a key no book carries: ' + orphans.join(', '));
else if (misattributed.length) bad(misattributed.length +
  ' show product(s) are exhibited by somebody other than their producer: ' + misattributed.join(', '));
else ok('all ' + checked + ' show products resolve by key, every one to a wine of the exhibitor who shows it');

console.log(fail ? `\n✗ ${fail} failure(s)` : '\n✓ all checks passed');
process.exit(fail ? 1 : 0);
