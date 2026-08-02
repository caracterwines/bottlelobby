/* ═══════════════════════════════════════════════════════════════════
   THE FIELDS NOTIFICATIONS ARE DERIVED FROM (spec C9, groundwork)

   Notifications are computed from records that already exist — no
   message table, nothing stored but a read cursor. That only works if
   every source can answer two questions about every event it carries:
   WHO did it, and WHEN. Three sources could not, and this file is the
   reason they cannot quietly stop again:

     · order logs had no `actor` at all. An audit trail that says what
       happened but not who did it cannot answer the first condition of
       a notification — did the reader cause this themselves?
     · the follow graph had no date, so A7's promised "X started
       following you" could not be ordered or placed in time.
     · partnership requests carried a third date format ("18 July
       2026") next to the shows' "18 Jul 2026" and the orders' ISO.

   These are checked here rather than in the notification code because
   a missing field there is invisible: the event simply never appears,
   and an empty list looks like a quiet day.
═══════════════════════════════════════════════════════════════════ */
const { JSDOM, VirtualConsole } = require('jsdom');
const { loadDashboard } = require('./load-dashboard');
const errs = [];
const dom = new JSDOM(loadDashboard().html, {
  runScripts:'dangerously', pretendToBeVisual:true,
  virtualConsole: new VirtualConsole().on('jsdomError', e => errs.push(e.message)) });
const w = dom.window;
w.scrollTo = () => {}; w.confirm = () => true;
if (errs.length) { console.log('SCRIPT ERRORS:\n' + errs.join('\n')); process.exit(1); }

let fail = 0;
const bad = m => { console.log('  ✗ ' + m); fail++; };
const ok  = m => console.log('  ✓ ' + m);
const ISO = /^\d{4}-\d{2}-\d{2}$/;

/* ── 1. Every order event says who ──────────────────────────────── */
console.log('── order events carry an actor');
{
  const orders = w.eval('orders.map(o => ({ id:o.id, buyer:o.buyer, seller:o.seller, log:o.log }))');
  const noLog = orders.filter(o => !o.log || !o.log.length);
  if (noLog.length) bad('orders with no log at all: ' + noLog.map(o => o.id).join(', '));
  else ok('all ' + orders.length + ' fixture orders have a log');

  const missing = [];
  orders.forEach(o => o.log.forEach((e, i) => { if (!e.actor) missing.push(o.id + '#' + i + ' "' + e.text + '"'); }));
  if (missing.length) bad('log entries with no actor: ' + missing.slice(0, 4).join(' · ') +
    (missing.length > 4 ? ' … (' + missing.length + ' total)' : ''));
  else ok('every entry of every fixture log names its actor');

  /* The actor has to be a party to the order, or the "did I cause
     this?" test compares against a name that means nothing. */
  const stray = [];
  orders.forEach(o => o.log.forEach(e => {
    if (e.actor && e.actor !== o.buyer && e.actor !== o.seller && e.actor !== 'Bottle Lobby')
      stray.push(o.id + ': "' + e.actor + '"');
  }));
  if (stray.length) bad('actors who are not a party to the order: ' + stray.join(', '));
  else ok('every actor is the buyer, the seller or Bottle Lobby');

  /* And a live action must keep doing it. This has to run a function
     that actually calls logEvent(). The first version of this check
     called acceptOrder(), which only moved the stage and wrote nothing
     — so it passed while testing nothing, and the "confirmed" entry it
     then inspected came from buildInitialLog(). acceptOrder() turned
     out to have no call site at all and was deleted; confirmOrder() is
     the real accept path. It logs first and renders second; the render
     throws here because no detail pane is open, which is why the call
     is wrapped. The entry is already appended by then. */
  const pending = w.eval("orders.find(o => o.stage === 'pending').id");
  const before = w.eval('_o("' + pending + '").log.length');
  try { w.eval('confirmOrder("' + pending + '")'); } catch (e) { /* render, not log */ }
  const log = w.eval('_o("' + pending + '").log');
  if (log.length !== before + 1) bad('confirmOrder() appended no log entry — the live check is testing nothing');
  else if (!log[log.length - 1].actor) bad('a live order action wrote a log entry with no actor');
  else ok('a live action writes its actor too (' + log[log.length - 1].actor + ')');
}

/* ── 2. Every follow is dated ───────────────────────────────────── */
console.log('\n── the follow graph can be placed in time');
{
  const g = w.eval('wineFollowGraph');
  const undated = g.filter(f => !f.at);
  if (undated.length) bad(undated.length + ' of ' + g.length + ' follows have no date — A7\'s notification cannot be ordered');
  else ok('all ' + g.length + ' follows carry a date');
  const badFmt = g.filter(f => f.at && !ISO.test(f.at));
  if (badFmt.length) bad('follow dates that are not ISO: ' + badFmt.map(f => f.at).join(', '));
  else ok('every follow date is ISO (yyyy-mm-dd)');
}

/* ── 3. Partnership requests are dated in ISO ───────────────────── */
console.log('\n── partnership requests are dated in one format');
{
  const sets = {
    wineryRequests: 'received', incomingRequests: 'received',
    rIncomingRequests: 'received', tIncomingRequests: 'received',
    wineryOutgoingRequests: 'sent', rPartnerRequests: 'sent', tPartnerRequests: 'sent'
  };
  let checked = 0, wrong = [];
  Object.keys(sets).forEach(name => {
    const rows = w.eval(name);
    if (!Array.isArray(rows)) { wrong.push(name + ' is not an array'); return; }
    rows.forEach((r, i) => {
      checked++;
      const v = r[sets[name]];
      if (!v) wrong.push(name + '[' + i + '] has no ' + sets[name]);
      else if (!ISO.test(v)) wrong.push(name + '[' + i + '].' + sets[name] + ' = "' + v + '"');
    });
  });
  if (wrong.length) bad('not ISO: ' + wrong.join(' · '));
  else ok('all ' + checked + ' request dates across 7 arrays are ISO');

  /* The display must still read like a date to a human — the record
     changed format, the screen must not have. */
  const shown = w.document.querySelector('.wn-meta, .ir-meta, .pn-meta');
  if (shown && /\d{4}-\d{2}-\d{2}/.test(shown.textContent))
    bad('a raw ISO date is on screen: "' + shown.textContent.trim() + '"');
  else ok('the rendered date is formatted, not the raw ISO string');
}

/* ── 4. One formatter, not four ─────────────────────────────────── */
console.log('\n── ISO dates go through one formatter');
{
  const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'bottle-lobby-dashboard.html'), 'utf8');
  const raw = [...src.matchAll(/Requested \$\{r\.(received|sent)\}/g)];
  if (raw.length) bad(raw.length + ' request date(s) rendered without a formatter');
  else ok('no request date reaches the page unformatted');
}

console.log(fail ? '\n✗ ' + fail + ' failure(s)' : '\n✓ all checks passed');
process.exit(fail ? 1 : 0);
