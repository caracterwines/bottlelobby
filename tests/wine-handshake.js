const path = require('path');
const DASHBOARD = path.join(__dirname, '..', 'bottle-lobby-dashboard.html');
const { JSDOM, VirtualConsole } = require('jsdom');
const fs = require('fs');
const html = fs.readFileSync(DASHBOARD,'utf8');
const errs = [];
const dom = new JSDOM(html, { runScripts:'dangerously', pretendToBeVisual:true,
  virtualConsole: new VirtualConsole().on('jsdomError', e => errs.push(e.message)) });
const w = dom.window, d = w.document;
w.scrollTo = () => {}; w.confirm = () => true;
if (errs.length) { console.log('SCRIPT ERRORS:\n' + errs.join('\n')); process.exit(1); }
let fail = 0; const bad = m => { console.log('  ✗ ' + m); fail++; }; const ok = m => console.log('  ✓ ' + m);
const S  = id => w.eval('wineShows').find(x => x.id === id);
const EX = (id, p) => S(id).exhibitors.find(e => e.producer === p);
const paneText = pre => d.getElementById(pre + '-detail-pane').textContent;
const boxWithHead = (pre, h) => [...d.querySelectorAll('#' + pre + '-detail-pane .odt-box')]
  .find(b => b.querySelector('.odt-box-head').textContent.includes(h));

/* Both sides must be reachable in the untouched demo data, or a
   comparison against cfg.side is dead in practice even when the
   vocabulary lines up. Checked here, before any test mutates state. */
console.log('── demo data exercises both sides of the handshake');
{
  const seen = new Set();
  w.eval('wineShows').forEach(sh => sh.exhibitors.forEach(e => {
    const t = w.eval('exhibitorTurn')(sh, e); if (t) seen.add(t);
  }));
  ['producer','host'].forEach(side => {
    if (!seen.has(side)) bad('no exhibitor in the demo data ever awaits the ' + side + ' — that side is untested by the fixtures');
    else ok('demo data has a case awaiting the ' + side);
  });
}

console.log('── host list: chip + sort while a wine really awaits the host');
w.showWineShows('distributor','current');
{
  const rows = [...d.querySelectorAll('#dshow-table .otbl-row')];
  if (!rows[0].textContent.includes('Grande Rioja')) bad('WS-2601 awaits the host and should sort first: ' + rows[0].textContent.slice(0,50));
  else ok('show awaiting the host sorts to the top');
  if (!rows[0].textContent.includes('Awaiting you')) bad('top row not chipped');
  else ok('"Awaiting you" chip on the host list');
  const others = rows.slice(1).filter(r => r.textContent.includes('Awaiting you'));
  if (others.length) bad('rows not awaiting the host are chipped too');
  else ok('no false chips on the other rows');
}

console.log('\n── THE REPORTED BUG: invite without a wine, then confirm');
w.showWineShows('distributor','current');
w.openShowDetail('WS-2604');                      // draft, no exhibitors
w.openInviteModal('WS-2604');
d.getElementById('if-producer').value = 'Cantina Rossi'; w.onInviteProducerChange();
d.getElementById('if-product').value = '';        // "No preference — let the producer choose"
w.saveInvite();
if (EX('WS-2604','Cantina Rossi').products.length !== 0) bad('invite without a wine should leave products empty');
else ok('invited with no wine named');

w.showWineShows('winery','current');
w.openShowDetail('WS-2604');
// The old bug: a bare "Confirm" existed and produced a confirmed exhibitor with no wine.
const invBox = boxWithHead('wshow','Your Invitation');
if (!invBox) bad('producer sees no invitation box');
else {
  const labels = [...invBox.querySelectorAll('button')].map(b => b.textContent.trim());
  if (labels.some(l => l === 'Confirm')) bad('bare "Confirm" still offered without a named wine: ' + labels);
  else ok('no bare Confirm — offered: ' + labels.join(' / '));
}
// and the guard holds even if the action is called directly
w.respondToInvite('WS-2604','confirm');
let e = EX('WS-2604','Cantina Rossi');
if (e.status === 'confirmed' && !e.products.length) bad('REGRESSION: confirmed with empty products — the dead-end is back');
else ok('direct confirm without a proposal is refused');
if (S('WS-2604').stage !== 'draft') bad('show should still be draft');

console.log('\n── producer picks a wine → host must confirm');
w.openCounterModal('WS-2604');
if (d.getElementById('cf-save').textContent !== 'Confirm With This Wine →') bad('wrong save label: ' + d.getElementById('cf-save').textContent);
else ok('modal reads "Confirm With This Wine" when no host wine exists');
d.getElementById('cf-product').value = 'Grillo Sicilia DOC 2023';
w.saveCounter();
e = EX('WS-2604','Cantina Rossi');
if (e.status !== 'confirmed') bad('producer place not taken');
if (e.products[0].status !== 'proposed' || e.products[0].proposedBy !== 'producer')
  bad('producer wine should be proposed, got ' + JSON.stringify(e.products));
else ok('wine is proposed by the producer, not self-confirmed');
if (S('WS-2604').stage !== 'draft') bad('show promoted on a one-sided proposal!');
else ok('show stays draft — a proposal is not an agreement');
if (w.eval('exhibitorTurn')(S('WS-2604'), e) !== 'host') bad('turn should be host');
else ok('exhibitorTurn → host');
// producer now sees a waiting box, no buttons
w.openShowDetail('WS-2604');
const waitBox = boxWithHead('wshow','Waiting for');
if (!waitBox) bad('producer has no "waiting" box');
else if (waitBox.querySelectorAll('button').length) bad('producer still has buttons while the host is at turn');
else ok('producer sees "Waiting for Hawesko GmbH", no actions');

console.log('\n── host confirms it');
w.showWineShows('distributor','current');
w.openShowDetail('WS-2604');
const hostBox = boxWithHead('dshow','Wines Awaiting Your Confirmation');
if (!hostBox) bad('host has no confirmation box');
else if (!hostBox.textContent.includes('Grillo Sicilia DOC 2023')) bad('host box does not name the wine');
else ok('host sees the proposed wine with Confirm / Decline');
w.hostRespondToProduct('WS-2604','Cantina Rossi','confirm');
e = EX('WS-2604','Cantina Rossi');
if (e.products[0].status !== 'confirmed') bad('host confirm did not stick');
else ok('wine confirmed by the host');
if (S('WS-2604').stage !== 'planning') bad('show should now auto-promote, is ' + S('WS-2604').stage);
else ok('both sides agreed → draft auto-promoted to planning');
if (w.eval('exhibitorTurn')(S('WS-2604'), e) !== null) bad('nobody should be at turn now');
else ok('exhibitorTurn → nobody');

console.log('\n── host declines a wine: producer stays, proposes another');
// WS-2601 seeded with Weingut Schmitt awaiting the host
let ws = EX('WS-2601','Weingut Schmitt');
if (w.eval('exhibitorTurn')(S('WS-2601'), ws) !== 'host') bad('seeded exhibitor should await the host');
else ok('demo data seeds a host-at-turn case');
w.openShowDetail('WS-2601');
w.hostRespondToProduct('WS-2601','Weingut Schmitt','decline');
ws = EX('WS-2601','Weingut Schmitt');
if (ws.status !== 'confirmed') bad('declining a wine must not remove the exhibitor');
else ok('exhibitor stays confirmed after a declined wine');
if (ws.products[0].status !== 'declined') bad('wine not marked declined');
if (w.eval('exhibitorTurn')(S('WS-2601'), ws) !== 'producer') bad('turn should return to the producer');
else ok('turn returns to the producer');

console.log('\n── producer proposes again after the decline');
w.showWineShows('winery','current');   // Cantina Rossi is the winery entity, not Schmitt
// exercise the same path on Cantina Rossi: host declines their wine on WS-2604
w.showWineShows('distributor','current');
// put a fresh producer proposal on the table first
w.showWineShows('winery','current'); w.openShowDetail('WS-2601');
const inv = boxWithHead('wshow','Your Invitation');   // Cantina Rossi is 'invited' with a host wine here
if (!inv) bad('Cantina Rossi should still have an open invitation on WS-2601');
else {
  const labels = [...inv.querySelectorAll('button')].map(b => b.textContent.trim());
  if (!labels.includes('Confirm')) bad('host proposed a wine, so a plain Confirm should exist: ' + labels);
  else ok('host-proposed wine → producer gets a plain Confirm');
}
w.respondToInvite('WS-2601','confirm');
const cr = EX('WS-2601','Cantina Rossi');
if (cr.products[0].status !== 'confirmed' || cr.products[0].proposedBy !== 'host')
  bad('accepting the host wine should confirm it: ' + JSON.stringify(cr.products));
else ok('producer accepting the host wine settles it in one step');

console.log('\n── badges track the turn, both directions');
w.showWineShows('distributor','current');
// everything the host owed is answered; only WS-2602 (pending_approval) is left
const hostWaiting = w.eval('showsAwaiting')('distributor','host').length;
if (hostWaiting !== 0) bad('host should owe nothing now, owes ' + hostWaiting);
else ok('host owes nothing after answering');
if (d.getElementById('dshow-badge').textContent !== '1')
  bad('host badge should be 1 (the pending_approval show), got ' + d.getElementById('dshow-badge').textContent);
else ok('host badge = 1, the show awaiting Bottle Lobby');
if ([...d.querySelectorAll('#dshow-table .otbl-row')].some(r => r.textContent.includes('Awaiting you')))
  bad('no row should be chipped when the host owes nothing');
else ok('no "Awaiting you" chips left on the host list');
// the winery's own turn is what its badge shows
w.showWineShows('winery','current');
const wWaiting = w.eval('showsAwaiting')('winery','producer').length;
const wBadge = d.getElementById('wshow-badge').textContent;
if (String(wWaiting || '') !== wBadge) bad('winery badge ' + JSON.stringify(wBadge) + ' != turns owed ' + wWaiting);
else ok('winery badge matches its own open turns (' + (wBadge || '0') + ')');

console.log('\n── readiness still counts only confirmed wines');
const rd = w.eval('showReadiness')(S('WS-2604'));
if (!rd.ready) bad('WS-2604 should be ready now');
else ok('showReadiness unchanged and satisfied by the two-sided yes');


/* ═══════════════════════════════════════════════════════════════════
   (a) VOCABULARY CONTRACT
   The bug that slipped through was not a wrong value — it was two
   names for one concept. SHOW_ROLES[*].side is compared against
   exhibitorTurn()'s return value, so a side that exhibitorTurn can
   never return makes every such comparison silently dead.
═══════════════════════════════════════════════════════════════════ */
console.log('\n── vocabulary contract: SHOW_ROLES.side vs exhibitorTurn()');
{
  const src = require('fs').readFileSync(DASHBOARD,'utf8');
  const m = src.match(/function exhibitorTurn\(show, e\) \{([\s\S]*?)\n\}/);
  if (!m) bad('could not read exhibitorTurn from the source');
  else {
    // every string literal exhibitorTurn can hand back
    const returns = new Set();
    m[1].replace(/return\s+([^;]+);/g, (_, expr) => {
      (expr.match(/'([^']+)'/g) || []).forEach(q => returns.add(q.slice(1,-1)));
      if (/^\s*null\s*$/.test(expr)) returns.add(null);
      return '';
    });
    const turnValues = [...returns].filter(x => x !== null);
    console.log('    exhibitorTurn returns:', JSON.stringify(turnValues));
    const roles = w.eval('SHOW_ROLES');
    const sides = Object.keys(roles).map(r => [r, roles[r].side]);
    console.log('    SHOW_ROLES sides    :', JSON.stringify(Object.fromEntries(sides)));
    sides.forEach(([r, side]) => {
      if (!turnValues.includes(side))
        bad('SHOW_ROLES.' + r + '.side = "' + side + '" is never returned by exhibitorTurn — every comparison against it is dead');
      else ok('SHOW_ROLES.' + r + '.side "' + side + '" is a value exhibitorTurn can return');
    });
    // and the reverse: no turn value without a role that owns it
    turnValues.forEach(v => {
      if (!sides.some(([, s]) => s === v))
        bad('exhibitorTurn can return "' + v + '" but no role claims that side');
    });
    if (turnValues.every(v => sides.some(([, s]) => s === v))) ok('every turn value is claimed by exactly one role');
  }
}

/* ═══════════════════════════════════════════════════════════════════
   (b) THE LAST UNTESTED PATH
   host declines → producer proposes again → host confirms → planning
═══════════════════════════════════════════════════════════════════ */
console.log('\n── full round trip after a host decline');
w.showWineShows('distributor','current');
w.openShowModal();
d.getElementById('sf-title').value = 'Round Trip';
d.getElementById('sf-date').value  = '2027-09-09';
d.getElementById('sf-city').value  = 'Bremen';
d.getElementById('sf-focus').value = 'Testing the decline loop';
w.saveShow();
const RT = w.eval('wineShows')[0].id;
if (S(RT).stage !== 'draft') bad('new show should start as draft');

// invite Cantina Rossi without naming a wine
w.openInviteModal(RT);
d.getElementById('if-producer').value = 'Cantina Rossi'; w.onInviteProducerChange();
d.getElementById('if-product').value = '';
w.saveInvite();
if (EX(RT,'Cantina Rossi').products.length) bad('no wine should be recorded'); else ok('invited, no wine named');

// producer picks one → proposed
w.showWineShows('winery','current');
w.openShowDetail(RT);
w.openCounterModal(RT);
d.getElementById('cf-product').value = 'Rosato di Sicilia 2023';
w.saveCounter();
if (EX(RT,'Cantina Rossi').products.slice(-1)[0].status !== 'proposed') bad('first pick should be proposed');
else ok('producer proposes Rosato di Sicilia 2023');
if (S(RT).stage !== 'draft') bad('must not promote on a proposal alone');

// host declines it
w.showWineShows('distributor','current');
w.openShowDetail(RT);
w.hostRespondToProduct(RT,'Cantina Rossi','decline');
let rt = EX(RT,'Cantina Rossi');
if (rt.status !== 'confirmed') bad('exhibitor must survive a declined wine');
if (rt.products.slice(-1)[0].status !== 'declined') bad('wine not declined');
else ok('host declined the wine, exhibitor stays on the show');
if (w.eval('exhibitorTurn')(S(RT), rt) !== 'producer') bad('turn must return to the producer');
else ok('turn back with the producer');

// producer sees the "propose another" box and does so
w.showWineShows('winery','current');
w.openShowDetail(RT);
const again = boxWithHead('wshow','Your Turn');
if (!again) bad('producer has no "Your Turn" box after the decline');
else {
  if (!again.textContent.includes('Rosato di Sicilia 2023')) bad('box does not name the declined wine');
  else ok('box names the declined wine');
  const labels = [...again.querySelectorAll('button')].map(b => b.textContent.trim());
  if (!labels.includes('Propose another wine')) bad('no "Propose another wine" button: ' + labels);
  else ok('offered: ' + labels.join(' / '));
}
w.openCounterModal(RT);
if (!d.getElementById('cf-title').textContent.includes('Another Wine')) bad('modal title not adapted to the retry state');
else ok('modal reads "Propose Another Wine"');
d.getElementById('cf-product').value = 'Catarratto Biologico 2023';
w.saveCounter();
rt = EX(RT,'Cantina Rossi');
const live = rt.products.filter(p => p.status === 'proposed');
if (live.length !== 1 || live[0].name !== 'Catarratto Biologico 2023') bad('second proposal wrong: ' + JSON.stringify(rt.products));
else ok('producer proposes Catarratto Biologico 2023');
if (w.eval('exhibitorTurn')(S(RT), rt) !== 'host') bad('turn should be the host again');
else ok('turn with the host again');
if (S(RT).stage !== 'draft') bad('still must not have promoted');

// host confirms → both sides agree → planning
w.showWineShows('distributor','current');
w.openShowDetail(RT);
w.hostRespondToProduct(RT,'Cantina Rossi','confirm');
rt = EX(RT,'Cantina Rossi');
if (!rt.products.some(p => p.status === 'confirmed' && p.name === 'Catarratto Biologico 2023'))
  bad('host confirm did not stick: ' + JSON.stringify(rt.products));
else ok('host confirmed the second wine');
if (S(RT).stage !== 'planning') bad('show should now be planning, is ' + S(RT).stage);
else ok('round trip complete → planning');
if (w.eval('exhibitorTurn')(S(RT), rt) !== null) bad('nobody should be at turn');
else ok('nobody at turn');
// the declined wine stays in the record as history, not silently dropped
if (!rt.products.some(p => p.status === 'declined' && p.name === 'Rosato di Sicilia 2023'))
  bad('the declined wine was dropped instead of kept as history');
else ok('declined wine kept in the record');
const trail = S(RT).events.map(e => e.text).join(' | ');
['Proposed Rosato','Declined Rosato','Proposed Catarratto','Confirmed Catarratto'].forEach(frag => {
  if (!trail.includes(frag)) bad('trail missing "' + frag + '": ' + trail);
});
ok('every step written to the append-only trail');

if (errs.length) { console.log('\nJSDOM ERRORS:'); errs.forEach(x => console.log('  ' + x.split('\n')[0])); fail += errs.length; }
console.log(fail ? `\n✗ ${fail} failure(s)` : '\n✓ all checks passed');
process.exit(fail ? 1 : 0);
