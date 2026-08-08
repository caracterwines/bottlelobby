/* ═══════════════════════════════════════════════════════════════════
   THE VENUE RELATION — A16.5 steps 1–2 of the settlement (A16.11)

   Two different things meet in the Restaurant and Retail sub-view, and
   confusing them is the mistake this file exists to catch:

     · SEEING a show needs no relation at all. Restaurants and
       retailers are the demand a show is convened to measure (A16.0),
       so they list every show A16.6 makes visible — anonymised from
       `planning`, full from `published` — exactly as a visitor does.
     · BEING the venue is a relation on top, reached through
       `venueEntity` and only ever by a direct request.

   What that leaves to guard:

     · the host asks, the venue prices, and there is one number —
       the host never gets a field of their own to retype (A1);
     · a venue that has only been ASKED is not a venue, so the show
       cannot call itself ready (A16.10);
     · what each side may read. Three deliberate decisions, none of
       them a side effect:
         – a browsed show discloses only what the public page grants,
           on the row and in the pane (A16.6 on a fourth surface);
         – the venue sees counts, not names, until the show is public
           (the same rule for the one participant who may still walk);
         – the producer never sees the venue's quote at all (A16.11).
═══════════════════════════════════════════════════════════════════ */
const path = require('path');
const { loadDashboard } = require('./load-dashboard');
const { JSDOM, VirtualConsole } = require('jsdom');
const html = loadDashboard().html;   // inlines <script src> — see load-dashboard.js
const errs = [];
const dom = new JSDOM(html, { runScripts:'dangerously', pretendToBeVisual:true,
  virtualConsole: new VirtualConsole().on('jsdomError', e => errs.push(e.message)) });
const w = dom.window, d = w.document;
w.scrollTo = () => {}; w.confirm = () => true;
if (errs.length) { console.log('SCRIPT ERRORS:\n' + errs.join('\n')); process.exit(1); }
console.log('script evaluated cleanly\n');

let fail = 0;
const bad = m => { console.log('  ✗ ' + m); fail++; };
const ok  = m => console.log('  ✓ ' + m);
const S = id => w.eval('wineShows').find(x => x.id === id);
const paneText = pre => d.getElementById(pre + '-detail-pane').textContent;
const boxWithHead = (pre, h) => [...d.querySelectorAll('#' + pre + '-detail-pane .odt-box')]
  .find(b => b.querySelector('.odt-box-head').textContent.includes(h));

/* ── 1. the demo data exercises every state of the relation ────── */
console.log('── fixtures cover all three states');
{
  const seen = new Set(w.eval('wineShows').map(s => s.venueStatus));
  ['requested','quoted','accepted','not_required'].forEach(st => {
    if (!seen.has(st)) bad('no show in the demo data is venueStatus=' + st + ' — that branch is untested');
    else ok('a fixture exists for ' + st);
  });
}

/* ── 2. the venue roles have a working sub-view ────────────────── */
console.log('\n── sub-view isolation, both venue roles');
for (const role of ['restaurant','retail']) {
  w.showWineShows(role, 'current');
  const cfg = w.eval('SHOW_ROLES')[role];
  if (cfg.side !== 'venue') bad(role + ' is not registered as a venue side');
  if (d.getElementById(cfg.dashboardView).style.display !== 'none') bad(role + ': dashboard still visible');
  if (d.getElementById(cfg.profileView).style.display !== 'none') bad(role + ': profile still visible');
  if (d.getElementById(cfg.ordersView).style.display !== 'none') bad(role + ': orders still visible');
  if (d.getElementById(cfg.view).style.display === 'none') bad(role + ': shows view not shown');
  if (!d.getElementById(cfg.nav).classList.contains('active')) bad(role + ': nav not active');
  else ok(role + ': shows view isolated, nav active');
}
/* and the reverse — the role's own routers put it away again */
w.showWineShows('restaurant','current'); w.showRestaurantView('profile','basics');
if (d.getElementById('restaurant-view-shows').style.display !== 'none') bad('restaurant profile router did not hide the shows view');
else ok('restaurant profile router hides the shows view');
w.showWineShows('retail','current'); w.showOrders('retail','outgoing');
if (d.getElementById('retail-view-shows').style.display !== 'none') bad('retail orders router did not hide the shows view');
else ok('retail orders router hides the shows view');

/* ── 3. DISCOVERY — the demand side sees every listed show (A16.0)
   The venue relation is layered on top; it is NOT how a restaurant
   reaches a show. Filtering the list by `venueEntity` would remove
   exactly the audience a show is convened to reach. */
console.log('\n── restaurants and retailers see every show A16.6 lists');
w.showWineShows('restaurant','current');
{
  const rows = [...d.querySelectorAll('#rshow-table .otbl-row')];
  const titles = rows.map(r => r.textContent);
  const has = t => titles.some(x => x.includes(t));
  if (!has('Grande Rioja'))  bad('a planning show must be listed — anonymised, but listed');
  if (!has('Loire & Mosel')) bad('a published show must be listed');
  else ok('restaurant sees shows it has no relation to at all');
  if (has('Nordic Selection')) bad('LEAK: a pending_approval show is not public and must not be listed');
  else ok('pending_approval absent — nothing is listed before it is listable');
  if (!has('Sicilia Prima')) bad('the show it is the venue for is missing');
  else ok('its own venue request is listed too');
  /* WS-2605 is the C9 regional fixture: a Frankfurt planning show this
     restaurant has no relation to. It is publicly listed, so it belongs
     in this count for exactly the reason Grande Rioja does. */
  if (!has('Rhein')) bad('the second planning show must be listed too — anonymised, but listed');
  else ok('the regional-fixture show is listed like any other planning show');
  if (rows.length !== 4) bad('expected 4 rows (3 public + 1 relation), got ' + rows.length);

  /* the venue request sorts first and is labelled as what it is */
  if (!rows[0].textContent.includes('Sicilia Prima')) bad('the request should sort to the top: ' + rows[0].textContent.slice(0,40));
  else ok('the venue request sorts above the shows it is only browsing');
  if (!rows[0].textContent.includes('Awaiting you')) bad('an unanswered request should be chipped');
  else if (!rows[0].textContent.includes('Venue request')) bad('the row does not say WHY it awaits them');
  else ok('request row chipped "Awaiting you" + "Venue request"');
  /* Two turns: the venue request on WS-2604 and the invitation to attend
     WS-2601. Browsing the other show is not a task and must not count. */
  if (d.getElementById('rshow-badge').textContent !== '2') bad('restaurant badge should be 2, got "' + d.getElementById('rshow-badge').textContent + '"');
  else ok('badge counts the venue request and the attendance invitation — browsing is not a task');

  /* a browsed anonymised show gives nothing away in the row itself */
  const rioja = rows.find(r => r.textContent.includes('Grande Rioja'));
  ['Bodegas Ruiz','Weingut Schmitt','Hawesko Tasting Loft'].forEach(n => {
    if (rioja.textContent.includes(n)) bad('LEAK: the list row of an anonymised show shows "' + n + '"');
  });
  if (!rioja.textContent.includes('Venue announced on release')) bad('the venue cell should say the venue is withheld');
  else ok('anonymised row: no exhibitors, no venue, no wine count');
}
w.showWineShows('retail','current');
{
  const rows = [...d.querySelectorAll('#tshow-table .otbl-row')];
  /* FOUR now, not three, and the fourth is the D38 consequence: WS-2604
     ships in `planning` instead of `draft`, so it is a listed show like
     any other. Weinhaus Müller is the venue of none of them. */
  if (rows.length !== 4) bad('retail should see the 4 publicly listed shows, got ' + rows.length);
  else ok('retail sees 4 listed shows — it is the venue of none of them');
  /* It reaches the retailer as a LISTING, never as a task: the venue
     request on it went to Bistro Laurent. A row here is browsing. */
  const sp = rows.find(r => r.textContent.includes('Sicilia Prima'));
  if (!sp) bad('a planning show must be listed for a retailer browsing');
  else if (sp.textContent.includes('Awaiting you'))
    bad("LEAK: another venue's request badged this retailer as if it were theirs");
  else if (sp.textContent.includes('Bistro Laurent'))
    bad('LEAK: the anonymised row names the venue that was asked');
  else ok("someone else's venue request is listed, unchipped and unnamed");
}
w.showWineShows('retail','history');
{
  const rows = [...d.querySelectorAll('#tshow-table .otbl-row')];
  if (!rows.some(r => r.textContent.includes('Primavera Italiana'))) bad('retail history should hold the show it hosted');
  else ok('retail history holds the show it was the venue for');
  if (!rows.find(r => r.textContent.includes('Primavera Italiana')).textContent.includes('You are the venue'))
    bad('the row does not say it was the venue');
  else ok('its own past show is labelled "You are the venue"');
  if (d.getElementById('tshow-badge').textContent !== '') bad('a past show must not badge the retailer');
  else ok('no badge for a show that has taken place');
}

/* the search box must not become a lookup for hidden line-ups */
console.log('\n── search reaches only what this viewer may already read');
w.showWineShows('restaurant','current');
{
  const box = d.getElementById('rshow-search');
  box.value = 'Bodegas';                 // confirmed at the ANONYMISED Grande Rioja
  w.renderWineShows('restaurant');
  const hits = [...d.querySelectorAll('#rshow-table .otbl-row')].map(r => r.textContent);
  if (hits.some(t => t.includes('Grande Rioja')))
    bad('LEAK: searching a producer name surfaced the anonymised show they are confirmed at');
  else ok('a producer name does not surface an anonymised show');

  box.value = 'Weingut';                 // also at the PUBLISHED Loire & Mosel
  w.renderWineShows('restaurant');
  const hits2 = [...d.querySelectorAll('#rshow-table .otbl-row')].map(r => r.textContent);
  if (!hits2.some(t => t.includes('Loire & Mosel')))
    bad('the search is simply broken — a producer on a published show should be findable');
  else ok('the same name does find the published show — the filter narrows, it does not just fail');
  if (hits2.some(t => t.includes('Grande Rioja')))
    bad('LEAK: the anonymised show came back on the second search');
  box.value = '';
  w.renderWineShows('restaurant');
}

/* ── 3b. a browsed show opens as the PUBLIC listing, not a workspace */
console.log('\n── browsing opens the visitor view, not the working detail');
w.showWineShows('restaurant','current');
w.openShowDetail('WS-2601');            // planning, no relation to Bistro Laurent yet
{
  const t = paneText('rshow');
  ['Bodegas Ruiz','Weingut Schmitt','Rioja Reserva','Hawesko Tasting Loft'].forEach(n => {
    if (t.includes(n)) bad('LEAK: the visitor pane of an anonymised show shows "' + n + '"');
  });
  if (!t.includes('Grande Rioja') || !t.includes('Düsseldorf')) bad('the visitor pane should still show title and city');
  else ok('visitor pane: title, date, city, focus — and nothing else');
  if (boxWithHead('rshow','Venue Request')) bad('a non-venue must not get the venue box');
  else ok('no venue box on a show it is not the venue of');
  if (boxWithHead('rshow','History')) bad('LEAK: the append-only trail is not a public surface');
  else ok('no trail on a browsed show');
}

/* ── 4. THE LEAK TEST — counts, not names, before release ───────
   A venue that can still decline must be able to answer without
   learning the line-up. WS-2601 is in `planning` and has confirmed
   exhibitors, which is exactly the case A16.6 protects. */
console.log('\n── the venue is told how many, not who, before release');
w.showWineShows('distributor','current');
w.openShowDetail('WS-2601');
w.openVenueModal('WS-2601');
d.getElementById('vf-partner').value = 'Bistro Laurent';
w.sendVenueRequest();
if (S('WS-2601').venueStatus !== 'requested') bad('venue request not recorded on WS-2601');
else ok('host asked Bistro Laurent to host a show that already has exhibitors');
w.showWineShows('restaurant','current');
w.openShowDetail('WS-2601');
{
  const t = paneText('rshow');
  ['Bodegas Ruiz','Weingut Schmitt','Rioja Reserva'].forEach(name => {
    if (t.includes(name)) bad('LEAK: the venue can read "' + name + '" on an unreleased show');
  });
  if (!t.includes('confirmed exhibitor')) bad('the venue is told nothing at all — it needs a head count to cater');
  else ok('venue sees a head count and no names');
  if (!boxWithHead('rshow','Venue Request')) bad('venue has no request box');
  else ok('venue sees the request box with a price and a decline');
}
/* released → the line-up is public, so the venue reads it like anyone else */
w.showWineShows('distributor','current');
w.simulateStaffRelease('WS-2601');
w.showWineShows('restaurant','current');
w.openShowDetail('WS-2601');
if (!paneText('rshow').includes('Bodegas Ruiz')) bad('after release the venue should see the line-up like the public does');
else ok('released → the venue reads the exhibitors, same as everyone');

/* ── 5. one number, entered once (A1) ──────────────────────────── */
console.log('\n── the quote is one field, not two');
w.showWineShows('restaurant','current');
w.openShowDetail('WS-2604');
w.openVenueQuoteModal('WS-2604');
d.getElementById('vq-amount').value = '1400';
w.saveVenueQuote();
{
  const s = S('WS-2604');
  if (s.cateringTotal !== 1400) bad('quote not written to the show record');
  else ok('the venue wrote €1,400 into the one show record');
  if (s.venueStatus !== 'quoted') bad('status should be quoted, is ' + s.venueStatus);
  if (!s.events.some(e => e.actor === 'Bistro Laurent' && e.text.includes('1,400')))
    bad('quote not written to the append-only trail');
  else ok('quote logged to the trail under the venue as actor');
  if (w.eval('venueTurn')(s) !== 'host') bad('a quote should wait on the host');
  else ok('venueTurn → host once a price is on the table');
}
/* the host reads the same number — there is no host-side copy */
w.showWineShows('distributor','current');
{
  const row = [...d.querySelectorAll('#dshow-table .otbl-row')].find(r => r.textContent.includes('Sicilia Prima'));
  if (!row || !row.textContent.includes('Venue quoted')) bad('the host is not told a price arrived');
  else if (!row.textContent.includes('1,400')) bad('the chip does not name the amount');
  else ok('host list chips "Venue quoted €1,400.00" — the quote is not a silent update');
}
w.openShowDetail('WS-2604');
if (!boxWithHead('dshow','The Venue Has Quoted')) bad('host detail has no quote box');
else if (!paneText('dshow').includes('1,400')) bad('host detail does not show the amount');
else ok('host detail carries the amount and what happens next');

/* ── 6. the publish precondition: a QUOTE is not a venue either ──
   The bar moved with D38. It used to be enough that the venue had
   moved at all, because a quote was as far as the relation could get.
   Now the binding answer exists, so the precondition asks for it: a
   quote nobody accepted settles nothing (A16.11 step 6, A16.14c). */
console.log('\n── neither a request nor a quote is an accepted venue');
{
  const V = st => w.eval('publishReadiness')({ venueType:'partner_venue', venueStatus:st,
                                               venueName:'x', exhibitors:[] }).venue;
  if (!w.eval('publishReadiness')({ venueType:'host_premises', venueName:'x', exhibitors:[] }).venue)
    bad('own premises should always satisfy the venue precondition');
  if (V('requested')) bad('a mere request must not satisfy the precondition');
  if (V('quoted'))    bad('a quote nobody accepted must not satisfy the precondition');
  if (V('declined'))  bad('a declined venue must not satisfy the precondition');
  if (!V('accepted')) bad('an accepted offer should satisfy the precondition');
  else ok('venue precondition: requested ✗ quoted ✗ declined ✗ accepted ✓ own premises ✓');
  if (w.eval('publishReadiness')(S('WS-2604')).venue)
    bad('WS-2604 has only a quote — the venue line must still be red');
  else ok('a quote alone leaves the venue line red, and the host is told to accept');
}

/* ── 7. THE DISCLOSURE DECISION — the producer never sees the quote
   Deliberate, and the reason it is tested: an exhibitor is shown the
   basis of their OWN contribution and nothing about what the room
   cost the host (A16.11). WS-2602 quotes €1,250 and Cantina Rossi
   exhibits there. */
console.log('\n── the exhibitor is not shown the venue\'s quote');
w.showWineShows('distributor','current');
w.openShowDetail('WS-2602');
if (!paneText('dshow').includes('1,250')) bad('the host should see the quote on WS-2602');
else ok('host reads €1,250 on WS-2602');
w.showWineShows('winery','current');
w.openShowDetail('WS-2602');
{
  const t = paneText('wshow');
  if (t.includes('1,250')) bad('LEAK: the producer can read the venue quote');
  else if (t.includes('Room & catering') || t.includes('Room &amp; catering')) bad('LEAK: the producer sees the room-and-catering line');
  else ok('producer sees no trace of the quote — not the number, not the row');
}

/* ── 8. decline, and re-asking clears the stale price ───────────- */
console.log('\n── decline and re-ask');
w.showWineShows('restaurant','current');
w.declineVenueRequest('WS-2604');
{
  const s = S('WS-2604');
  if (s.venueStatus !== 'declined') bad('decline not recorded');
  else ok('venue declined');
  if (w.eval('showReadiness')(s).venue) bad('a declined venue must fail the readiness check');
  else ok('readiness venue check fails again after the decline');
  if (w.eval('venueTurn')(s) !== null) bad('a declined request waits on nobody');
  else ok('venueTurn → nobody after a decline');
}
w.showWineShows('distributor','current');
w.openShowDetail('WS-2604');
if (!boxWithHead('dshow','Venue Declined')) bad('host is not told the venue declined');
else ok('host detail says the venue declined and offers another');
w.openVenueModal('WS-2604');
d.getElementById('vf-partner').value = 'Weinhaus Müller';
w.sendVenueRequest();
{
  const s = S('WS-2604');
  if (s.venueEntity !== 'Weinhaus Müller') bad('re-request did not switch the venue');
  if (s.cateringTotal !== undefined) bad('STALE: the previous venue\'s price survived the re-request');
  else ok('a new request drops the old price — it was that venue\'s offer, not this one\'s');
  if (s.venueStatus !== 'requested') bad('re-request should reset the status');
  else ok('status back to requested for the new venue');
}
/* and it lands with the other role */
w.showWineShows('retail','current');
{
  const rows = [...d.querySelectorAll('#tshow-table .otbl-row')];
  if (!rows.some(r => r.textContent.includes('Sicilia Prima'))) bad('the re-asked venue does not see the request');
  else ok('the request moved to Weinhaus Müller, who now sees it');
}

/* ═══════════════════════════════════════════════════════════════════
   STEP 6, THE HOST'S HALF — accepting the offer commits the show
   -------------------------------------------------------------------
   The venue names a price; accepting it is binding, and A16.11 asks
   for A6's mechanics by name: the obligation in words, a checkbox, a
   confirm that cannot be pressed before it is ticked. So the tick is
   measured as a GATE, not as decoration — the check drives the real
   handler with the box unticked and requires the state not to move.
═══════════════════════════════════════════════════════════════════ */
console.log('\n── A16.11 step 6: the host accepts, and the show is committed');
{
  /* WS-2602's venue has quoted in the fixtures — the state this act
     answers, built here rather than assumed anywhere else (C7). */
  const s = S('WS-2602');
  if (s.venueStatus !== 'quoted') bad('WS-2602 must ship with a quote for this section to mean anything');
  if (w.eval('isCommitted')(s)) bad('a show with nothing but a quote is NOT committed yet (A16.10)');
  else ok('a quote alone does not commit the show');

  w.showWineShows('distributor','current');
  w.openShowDetail('WS-2602');
  const box = boxWithHead('dshow','The Venue Has Quoted');
  if (!box) bad('the host is not offered the acceptance');
  else if (![...box.querySelectorAll('button')].some(b => b.textContent.includes('Accept the offer')))
    bad('the quoted box carries no Accept button');
  else ok('the host reads the quote and is offered the binding acceptance');

  w.openVenueAcceptModal('WS-2602');
  if (!d.getElementById('wine-show-venue-accept-modal').classList.contains('active'))
    bad('the acceptance modal did not open');
  else ok('the acceptance modal opens on the quote');
  if (!d.getElementById('va-confirm').disabled) bad('the confirm is live before the box is ticked (A6 mechanics)');
  else ok('confirm is hard-disabled until the box is ticked');
  if (!d.getElementById('va-amount').textContent.includes('1,250'))
    bad('the modal must state the amount being accepted, got ' + d.getElementById('va-amount').textContent);
  else ok('the amount being accepted is stated in the modal');

  /* THE GATE ITSELF. Driving the handler past a disabled button is what
     the console and the next entry point do; a check that only reads
     the `disabled` attribute proves the styling, not the rule. */
  w.acceptVenueOffer();
  if (S('WS-2602').venueStatus !== 'quoted')
    bad('the offer was accepted with the consent box unticked');
  else ok('accepting without the tick changes nothing — the rule is in the handler, not the attribute');

  d.getElementById('va-cb').checked = true;
  w.acceptVenueOffer();
  const a = S('WS-2602');
  if (a.venueStatus !== 'accepted') bad('the acceptance did not take, status is ' + a.venueStatus);
  else ok('venueStatus → accepted');
  if (!a.venueAcceptedAt) bad('the acceptance is an act with a date — venueAcceptedAt is empty');
  else ok('venueAcceptedAt is written — an act, not a derivation');
  if (!w.eval('isCommitted')(a)) bad('an accepted venue offer must commit the show (A16.10)');
  else ok('the show is committed from the acceptance');
  if (!a.events.some(e => e.text.includes('committed'))) bad('the commitment is not in the show log');
  else ok('the log names the acceptance and the commitment');
  if (w.eval('venueTurn')(a) !== null) bad('an accepted offer waits on nobody');
  else ok('venueTurn → nobody once accepted');

  /* Both sides read the one record. WS-2602's venue is Vinstuen
     København, which has no demo dashboard, so the venue's reading is
     measured on WS-2604 instead — where this file has already moved
     the request to Weinhaus Müller, a role that does. */
  w.openVenueQuoteModal('WS-2604');
  d.getElementById('vq-amount').value = '900';
  w.saveVenueQuote();
  w.showWineShows('distributor','current');
  w.openShowDetail('WS-2604');
  w.openVenueAcceptModal('WS-2604');
  d.getElementById('va-cb').checked = true;
  w.acceptVenueOffer();
  w.showWineShows('retail','current');
  w.openShowDetail('WS-2604');
  const vBox = boxWithHead('tshow','You Are the Venue');
  if (!vBox) bad('the venue is not told the offer was accepted');
  else if (!vBox.textContent.includes('900')) bad('the venue is told, but not what was accepted: ' + vBox.textContent.trim());
  else ok('the venue reads the acceptance and the amount off the same record');
}

console.log('\n── A16.11 step 3: the cost split is the host\'s decision, and the venue never sees it');
{
  w.showWineShows('distributor','current');
  w.openShowDetail('WS-2602');
  const sel = d.getElementById('cm-mode-WS-2602');
  if (!sel) { bad('the host has no cost-split control'); }
  else {
    const values = [...sel.options].map(o => o.value).filter(Boolean);
    const known  = Object.keys(w.eval('CATERING_MODES'));
    if (values.some(v => known.indexOf(v) === -1))
      bad('the control offers a split the platform does not know: ' + values);
    else ok('every offered split is one of the four A16.11 modes');

    /* Re-read the control between saves: the detail pane is rebuilt on
       every render, so a reference held across one is a detached node
       and the second save would silently write nothing. */
    const setMode = m => { d.getElementById('cm-mode-WS-2602').value = m; w.saveCateringMode('WS-2602'); };

    setMode('host_covers');
    if (S('WS-2602').cateringMode !== 'host_covers') bad('host_covers did not save');
    else ok('the host can say they carry the cost');
    if (w.eval('cateringCharges')(S('WS-2602'))) bad('host_covers must charge nobody');
    else ok('host_covers charges nobody — nothing to consent to');

    setMode('split_by_products');
    if (!w.eval('cateringCharges')(S('WS-2602'))) bad('split_by_products must charge the exhibitors');
    else ok('split_by_products charges the exhibitors');
  }
}
/* WS-2605 runs on the host's own premises, so there is no venue total
   to divide — the option must be ABSENT rather than offered and then
   refused. Measured on a show that really has no total (C7). */
{
  w.openShowDetail('WS-2605');
  const s5 = S('WS-2605');
  if (s5.cateringTotal) bad('WS-2605 must ship without a venue total for this check to mean anything');
  const sel5 = d.getElementById('cm-mode-WS-2605');
  if (!sel5) bad('no cost-split control on the own-premises show');
  else if ([...sel5.options].some(o => o.value === 'split_by_products'))
    bad('a split by wines is offered with no total to divide');
  else ok('with no venue total, the divide-the-total split is absent, not offered');
  /* And the handler refuses it too — the option list is the courtesy,
     the guard is the rule (B12). */
  w.eval("(function(){var e=document.createElement('select');e.id='cm-mode-WS-2605';" +
         "e.innerHTML='<option value=\"split_by_products\" selected></option>';" +
         "document.getElementById('cm-mode-WS-2605').replaceWith(e);})()");
  w.saveCateringMode('WS-2605');
  if (S('WS-2605').cateringMode === 'split_by_products')
    bad('the handler accepted a split by wines with nothing to divide');
  else ok('the handler refuses it as well, not only the option list');
}
/* The venue is never party to the split (A16.11). */
{
  w.showWineShows('retail','current');
  w.openShowDetail('WS-2604');
  const seen = paneText('tshow');
  const leaked = Object.keys(w.eval('CATERING_MODES')).filter(m => seen.includes(w.eval('CATERING_MODES')[m]));
  if (leaked.length) bad('the venue is shown the host\'s cost split: ' + leaked.join(', '));
  else ok('the venue never reads how the host splits the cost');
}

console.log(fail ? `\n✗ ${fail} failure(s)` : '\n✓ all checks passed');
process.exit(fail ? 1 : 0);
