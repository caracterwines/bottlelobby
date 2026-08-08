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
const errs = [];
const vc = new VirtualConsole().on('jsdomError', e => errs.push(e.message));
const dom = new JSDOM(html, { runScripts:'dangerously', pretendToBeVisual:true, virtualConsole:vc });
const w = dom.window, d = w.document;
w.scrollTo = () => {}; w.confirm = () => true;
let fail = 0; const bad = m => { console.log('  ✗ ' + m); fail++; }; const ok = m => console.log('  ✓ ' + m);

// Helper: what the detail pane actually shows under "Exhibitors & Wines"
function exhibitorPaneText() {
  const boxes = [...d.querySelectorAll('#dshow-detail-pane .odt-box')];
  const box = boxes.find(b => b.querySelector('.odt-box-head') &&
                              /* startsWith, not includes: a second box whose HEAD merely
                                 mentions exhibitors would otherwise be matched first and
                                 this file would report the wrong pane as empty. */
                              b.querySelector('.odt-box-head').textContent.trim().startsWith('Exhibitors'));
  return box ? box.querySelector('.odt-box-body').textContent : '(box not found)';
}

console.log('── Path A: invite on an EXISTING draft (what the harness covered)');
w.showWineShows('distributor','current');
w.openShowDetail('WS-2604');
w.openInviteModal('WS-2604');
d.getElementById('if-producer').value = 'Cantina Rossi'; w.onInviteProducerChange();
pickWine(d, 'if-product', 'Primitivo Riserva 2020');
w.saveInvite();
let t = exhibitorPaneText();
if (!t.includes('Cantina Rossi')) bad('exhibitor NOT rendered after saveInvite: ' + JSON.stringify(t.slice(0,120)));
else ok('exhibitor appears in the pane');
if (!t.includes('Primitivo Riserva 2020')) bad('wanted wine not rendered'); else ok('wanted wine appears');

console.log('\n── Path B: create a show via the modal, then invite (the browser click path)');
w.openShowModal();
d.getElementById('sf-title').value = 'Test Show';
d.getElementById('sf-date').value = '2027-05-20';
d.getElementById('sf-city').value = 'Bremen';
d.getElementById('sf-focus').value = 'Testing';
w.saveShow();
const newId = w.eval('wineShows')[0].id;
console.log('  new show:', newId, '| openId =', w.eval('showState').distributor.openId,
            '| detail pane visible =', d.getElementById('dshow-detail-pane').style.display !== 'none');
w.openInviteModal(newId);
const opts = [...d.getElementById('if-producer').options].map(o => o.value);
console.log('  producers offered:', opts.length);
d.getElementById('if-producer').value = 'Domaine Lefèvre'; w.onInviteProducerChange();
const wineOpts = [...d.getElementById('if-product').options].map(o => o.value).filter(Boolean);
console.log('  wines offered:', wineOpts.length, wineOpts.slice(0,2));
d.getElementById('if-product').value = wineOpts[0] || '';
w.saveInvite();
const rec = w.eval('wineShows').find(s => s.id === newId);
console.log('  data: exhibitors =', JSON.stringify(rec.exhibitors));
t = exhibitorPaneText();
if (!t.includes('Domaine Lefèvre')) bad('exhibitor NOT rendered on the freshly created show: ' + JSON.stringify(t.slice(0,160)));
else ok('exhibitor appears on the freshly created show');

console.log('\n── Path C: invite while the LIST is open (no detail), then open the detail');
w.showWineShows('distributor','current');   // resets openId to null
console.log('  openId after list view =', w.eval('showState').distributor.openId);
w.openInviteModal(newId);
d.getElementById('if-producer').value = 'Bodegas Ruiz'; w.onInviteProducerChange();
w.saveInvite();
const rec2 = w.eval('wineShows').find(s => s.id === newId);
console.log('  data: exhibitors =', rec2.exhibitors.map(e => e.producer).join(', '));
w.openShowDetail(newId);
t = exhibitorPaneText();
if (!t.includes('Bodegas Ruiz')) bad('second exhibitor missing after reopening detail');
else ok('second exhibitor present after reopening the detail');

/* A script error is a failure, not a footnote. This file used to print
   the jsdom errors and exit 0 anyway, so a page that threw on load
   could still report PASS as long as the assertions below happened to
   survive it. The other three harnesses guard on this before they
   assert anything; this one now agrees with them. */
if (errs.length) {
  console.log('\nJSDOM ERRORS:');
  errs.forEach(e => bad('script error on load: ' + e.split('\n')[0]));
}
console.log(fail ? `\n✗ ${fail} failure(s)` : '\n✓ all paths render the exhibitor');
/* This line was missing. Without it the file exited 0 whatever it
   found, so every assertion in it was decorative: run-all.js reads the
   exit code, and only an outright crash ever reached it. The other
   three harnesses have always ended this way. */
process.exit(fail ? 1 : 0);
