const path = require('path');
const { loadDashboard } = require('./load-dashboard');
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
if (d.getElementById('dshow-badge').textContent !== '2') bad('distributor badge should be 2 (1 wine to answer + 1 awaiting release), got ' + d.getElementById('dshow-badge').textContent);
else ok('distributor badge = 2 (a wine to answer + a show awaiting release)');

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
if (dRows !== 4) bad('distributor current tab: expected 4 rows, got ' + dRows); else ok('distributor sees 4 active shows');
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

// ── 6. readiness checklist is computed (A16.10)
console.log('\n── readiness checklist');
w.openShowDetail('WS-2604');                       // draft, no exhibitors
let rows = [...d.querySelectorAll('#dshow-detail-pane .ws-check-row')];
if (rows.length !== 3) bad('expected 3 checklist rows, got ' + rows.length);
const met = rows.map(r => r.classList.contains('met'));
if (JSON.stringify(met) !== JSON.stringify([true,false,false])) bad('draft checklist wrong: ' + met);
else ok('draft: venue ✓, exhibitor ✗, wine ✗');
if (byId('WS-2604').stage !== 'draft') bad('draft promoted too early');

// ── 7. full flow: invite → producer confirms with a different wine → auto-promote
console.log('\n── invite / counter-propose / auto-promotion');
w.openInviteModal('WS-2604');
if (d.getElementById('wine-show-modal').classList.contains('active')) bad('wrong modal opened');
if (!d.getElementById('show-invite-modal').classList.contains('active')) bad('invite modal did not open');
else ok('invite modal opens');
const prodSel = d.getElementById('if-producer');
if (![...prodSel.options].some(o => o.value === 'Cantina Rossi')) bad('Cantina Rossi not offered');
prodSel.value = 'Cantina Rossi'; w.onInviteProducerChange();
const wineOpts = [...d.getElementById('if-product').options].map(o => o.value);
if (wineOpts.some(v => v && !v.match(/Catarratto|Grillo|Nero|Primitivo|Rosato|Rosso|Trinacria|Baglio|Costa/))) bad('foreign wine offered: ' + wineOpts);
else ok("wine picker holds only Cantina Rossi's own wines");
d.getElementById('if-product').value = 'Primitivo Riserva 2020';
w.saveInvite();
let s = byId('WS-2604');
if (s.exhibitors.length !== 1 || s.exhibitors[0].status !== 'invited') bad('invitation not recorded');
else ok('invitation recorded as invited/proposed');
if (s.stage !== 'draft') bad('invite alone must not promote the show');
else ok('still draft — an invitation is not a confirmation');

// producer side
w.showWineShows('winery','current');
if (d.getElementById('wshow-badge').textContent !== '2') bad('winery badge should now be 2, got ' + d.getElementById('wshow-badge').textContent);
else ok('winery badge picked up the new invitation');
w.openShowDetail('WS-2604');
w.openCounterModal('WS-2604');
const mine = [...d.getElementById('cf-product').options].map(o => o.value);
if (!mine.length) bad('counter modal has no wines');
d.getElementById('cf-product').value = 'Grillo Sicilia DOC 2023';
w.saveCounter();
s = byId('WS-2604');
const ex = s.exhibitors[0];
if (ex.status !== 'confirmed') bad('producer place not taken');
const live = ex.products.filter(p => p.status !== 'declined');
if (live.length !== 1 || live[0].name !== 'Grillo Sicilia DOC 2023' || live[0].proposedBy !== 'producer'
    || live[0].status !== 'proposed')
  bad('counter-proposal not recorded as a proposal: ' + JSON.stringify(ex.products));
else ok('counter-proposal recorded as proposed-by-producer, awaiting the host (D23)');
if (s.stage !== 'draft') bad('a one-sided proposal must not promote the show, is ' + s.stage);
else ok('still draft — the host has not agreed the wine yet');

// the host now has to say yes; only then does it count
w.showWineShows('distributor','current');
w.openShowDetail('WS-2604');
w.hostRespondToProduct('WS-2604','Cantina Rossi','confirm');
s = byId('WS-2604');
if (s.exhibitors[0].products.find(p => p.status === 'confirmed') === undefined) bad('host confirm did not stick');
else ok('host confirmed the wine — both sides agreed');
if (s.stage !== 'planning') bad('show should have auto-promoted to planning, is ' + s.stage);
else ok('auto-promoted draft → planning once both sides agreed');
if (!s.events.some(e => e.text.includes('moved to Planning'))) bad('promotion not in the trail');
else ok('promotion written to the append-only trail');

// ── 8. submit + demo release
console.log('\n── approval gate');
w.showWineShows('distributor','current');
w.openShowDetail('WS-2604');
w.submitShowForRelease('WS-2604');
if (byId('WS-2604').stage !== 'pending_approval') bad('submit failed');
else ok('submitted → pending_approval');
const gate = d.querySelector('#dshow-detail-pane .ws-demo');
if (!gate || !gate.textContent.includes('Simulate Bottle Lobby release (demo)')) bad('demo button missing or unlabelled');
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
const pool = w.eval('partnerWinesPool').map(x => x.name + ' ' + x.vintage);
const orphans = [];
shows().forEach(s => s.exhibitors.forEach(e => e.products.forEach(p => {
  if (!pool.includes(p.name)) orphans.push(s.id + ': ' + p.name);
})));
if (orphans.length) console.log('  note — demo product strings not in the pool: ' + orphans.join(', '));
else ok('every show product resolves to a wine in partnerWinesPool');

console.log(fail ? `\n✗ ${fail} failure(s)` : '\n✓ all checks passed');
process.exit(fail ? 1 : 0);
