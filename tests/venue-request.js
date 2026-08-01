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
  if (!has('Sicilia Prima')) bad('the show it is the venue for is missing — a draft reaches it by relation');
  else ok('its own venue request is listed too, draft though it is');
  if (rows.length !== 3) bad('expected 3 rows (2 public + 1 relation), got ' + rows.length);

  /* the venue request sorts first and is labelled as what it is */
  if (!rows[0].textContent.includes('Sicilia Prima')) bad('the request should sort to the top: ' + rows[0].textContent.slice(0,40));
  else ok('the venue request sorts above the shows it is only browsing');
  if (!rows[0].textContent.includes('Awaiting you')) bad('an unanswered request should be chipped');
  else if (!rows[0].textContent.includes('Venue request')) bad('the row does not say WHY it awaits them');
  else ok('request row chipped "Awaiting you" + "Venue request"');
  if (d.getElementById('rshow-badge').textContent !== '1') bad('restaurant badge should be 1, got "' + d.getElementById('rshow-badge').textContent + '"');
  else ok('badge counts the request only — browsing is not a task');

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
  if (rows.length !== 2) bad('retail should see the 2 publicly listed shows, got ' + rows.length);
  else ok('retail sees the same 2 public shows — it is the venue of none of them');
  if (rows.some(r => r.textContent.includes('Sicilia Prima'))) bad('LEAK: a draft show reached a role with no relation to it');
  else ok('the draft stays with the venue it was sent to');
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

/* ── 6. readiness: asked is not settled (A16.10) ────────────────- */
console.log('\n── a requested venue is not a venue');
{
  const settled = w.eval('venueSettled');
  if (!settled({ venueType:'host_premises' })) bad('own premises should always count as settled');
  if (settled({ venueType:'partner_venue', venueStatus:'requested' })) bad('a mere request must not satisfy readiness');
  if (settled({ venueType:'partner_venue', venueStatus:'declined' })) bad('a declined venue must not satisfy readiness');
  if (!settled({ venueType:'partner_venue', venueStatus:'quoted' })) bad('a quote should settle the venue check');
  if (!settled({ venueType:'partner_venue', venueStatus:'accepted' })) bad('an accepted venue should settle the check');
  else ok('venueSettled: requested ✗ declined ✗ quoted ✓ accepted ✓ own premises ✓');
  if (!w.eval('showReadiness')(S('WS-2604')).venue) bad('WS-2604 venue check should pass after the quote');
  else ok('the quote flips the readiness venue check');
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

console.log(fail ? `\n✗ ${fail} failure(s)` : '\n✓ all checks passed');
process.exit(fail ? 1 : 0);
