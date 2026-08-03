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

/* ── 3b. assertISO — DISCOVERS what to check, and says what it saw ─
   ═══════════════════════════════════════════════════════════════════
   The bug this replaces was not "wineShows was missing". It was that
   NOBODY COULD NOTICE it was missing. Sections 2 and 3 each name the
   arrays they know about, so the sweep silently covered whatever
   somebody had thought to list, and "every date is ISO" was a claim
   about that subset. 59 display-format dates sat in wineShows for as
   long as the enumeration failed to mention it, and every run was
   green.

   Three properties follow, and they are the whole design:

   1. IT DISCOVERS. Nothing is enumerated. The collection names are
      harvested from the SOURCE — every top-level array declaration in
      the dashboard and the data file — and each one is then walked
      recursively in the live page. A collection written tomorrow is
      covered tomorrow, not on the day somebody remembers to add it.

   2. IT JUDGES BY VALUE SHAPE, not by field name. Any string that is
      ENTIRELY a date must be ISO, whatever the key is called. Anchored
      on purpose: "Consolidated from Loire & Mosel — 14 Mar 2027" is
      prose that contains a date, not a date field, and is left alone.

   3. IT REPORTS ITS OWN SCOPE. The green line names how many
      collections and how many date fields it examined. A check that
      states its reach cannot shrink quietly — if wineShows stopped
      being walked the number would fall and the line would say so.
      Green means "I looked at N things and they were right", never
      "I found nothing".

   Month-precision values are a third class, not a violation. A press
   citation is published in "March 2024" and no day exists; writing
   2024-03-01 would invent one, which is exactly what C7 forbids when
   backfilling. They are counted and named so they stay visible rather
   than becoming a hole a display date could hide in.

   An empty scan fails. No collections, or no date fields, is a broken
   check reporting success — the same reasoning as the marker in
   tests/partner-counts.js. */
console.log('\n── assertISO: every date-shaped value, in everything that has one');
{
  const fs2 = require('fs'), path2 = require('path');
  const FILES = ['bottle-lobby-dashboard.html', 'assets/bottle-lobby-data.js'];
  const sources = FILES.map(f => [f, fs2.readFileSync(path2.join(__dirname, '..', f), 'utf8')]);

  /* Discovery: every top-level array declaration, from the source. */
  const names = [];
  sources.forEach(([, src]) => {
    [...src.matchAll(/^\s{0,2}(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*\[/gm)]
      .forEach(m => { if (names.indexOf(m[1]) === -1) names.push(m[1]); });
  });

  const scan = w.eval(`(function (names) {
    var ISO     = /^\\d{4}-\\d{2}-\\d{2}$/;
    var DAY     = /^\\d{1,2} [A-Za-z]{3,9} \\d{4}$/;   /* "05 Dec 2026", "18 July 2026" */
    var MONTH   = /^[A-Za-z]{3,9} \\d{4}$/;            /* "March 2024" — no day exists */
    var out = { collections: [], fields: 0, month: [], wrong: [], strings: 0, missing: [] };
    var seen = [];
    function walk(node, path, hits) {
      if (!node || typeof node !== 'object') return;
      if (seen.indexOf(node) !== -1) return;
      seen.push(node);
      if (Array.isArray(node)) {
        for (var i = 0; i < node.length; i++) walk(node[i], path + '[' + i + ']', hits);
        return;
      }
      for (var k in node) {
        if (!Object.prototype.hasOwnProperty.call(node, k)) continue;
        var v = node[k];
        if (typeof v === 'string') {
          out.strings++;
          if (ISO.test(v))        { hits.n++; out.fields++; }
          else if (DAY.test(v))   { hits.n++; out.fields++; out.wrong.push(path + '.' + k + ' = "' + v + '"'); }
          else if (MONTH.test(v)) { hits.n++; out.month.push(path + '.' + k + ' = "' + v + '"'); }
        } else if (v && typeof v === 'object') walk(v, path + '.' + k, hits);
      }
    }
    names.forEach(function (name) {
      var v;
      try { v = eval(name); } catch (e) { out.missing.push(name); return; }
      if (!Array.isArray(v)) return;
      var hits = { n: 0 };
      walk(v, name, hits);
      if (hits.n) out.collections.push(name + ':' + hits.n);
    });
    return out;
  })(${JSON.stringify(names)})`);

  if (!names.length)
    bad('assertISO harvested NO collection names from the source — discovery is broken, not the data');
  else if (!scan.collections.length)
    bad('assertISO walked ' + names.length + ' declared arrays and found no dates at all — the scan is broken, not the data');
  else if (!scan.fields)
    bad('assertISO found ' + scan.collections.length + ' collections and not one date field — ' +
        'a check that examined nothing cannot be green');
  else if (scan.wrong.length)
    bad('assertISO: ' + scan.wrong.length + ' day-precision date(s) are not ISO — ' +
        scan.wrong.slice(0, 6).join(' · ') + (scan.wrong.length > 6 ? ' …' : ''));
  else
    ok('assertISO: ' + names.length + ' declared arrays harvested, ' + scan.collections.length +
       ' carry dates, ' + scan.fields + ' day-precision fields checked — all ISO' +
       ' (' + scan.strings + ' strings examined)\n      ' + scan.collections.sort().join(' · '));

  /* Month-precision values are named, every time. Unreported they
     would be a shape a display date could hide behind. */
  if (scan.month.length)
    ok('plus ' + scan.month.length + ' month-precision value(s), which have no ISO form: ' +
       scan.month.slice(0, 3).map(s => s.replace(/^.*\./, '')).join(' · '));

  /* The source half: a NEW array written in display format fails here
     before anything renders it, and before it holds any rows. */
  const written = [];
  sources.forEach(([f, src]) => {
    [...src.matchAll(/\b(at|placed|sent|received|closedAt|venueQuotedAt|venueAcceptedAt|since)\s*:\s*'([^']*)'/g)]
      .forEach(m => { if (/\d/.test(m[2]) && !/^\d{4}-\d{2}-\d{2}$/.test(m[2])) written.push(f + ': ' + m[1] + ":'" + m[2] + "'"); });
  });
  if (written.length) bad(written.length + ' date field(s) written in a non-ISO format: ' + written.slice(0, 4).join(' · '));
  else ok('no dated field in either source file is written as display text');
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
