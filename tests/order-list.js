/* ═══════════════════════════════════════════════════════════════════
   THE ORDER LIST ON THE SHOW FLOOR — A16.12

   The mechanism a Wine Show exists for (A16.0): what the room asks for
   is collected, and one consolidated order per producer comes out of
   it. This pass writes the interests and reads the tally; the closing
   and the two order directions are the next one.

   What has to hold, and what this file drives:

     · an interest is NOT an order — no partnership is needed, no
       stock is committed, and nothing here appears in `orders`;
     · only an attendee holding a SEAT may write one. The worth of the
       signal is that they tasted the wine, which rules out the
       waitlist and rules out browsing;
     · the tally is SUM over open interests, computed (A16.10);
     · three disclosure rules: an attendee sees only their own lines,
       the producer never sees the tally at all (it is the host's
       negotiating position), and the public card shows none of it.
═══════════════════════════════════════════════════════════════════ */
const { loadDashboard } = require('./load-dashboard');
const { JSDOM, VirtualConsole } = require('jsdom');
const html = loadDashboard().html;
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
const interests = id => S(id).interests || [];
const tally = (id, wine) => w.eval('productTally')(S(id), wine);
const paneText = pre => d.getElementById(pre + '-detail-pane').textContent;
const boxWithHead = (pre, h) => [...d.querySelectorAll('#' + pre + '-detail-pane .odt-box')]
  .find(b => b.querySelector('.odt-box-head').textContent.includes(h));

const SANCERRE = 'Sancerre Rouge 2022';
const MOSEL    = 'Müller-Thurgau — Mosel 2023';

/* ── 1. the tally is arithmetic over the rows ──────────────────── */
console.log('── the tally is computed, and counts houses as well as bottles');
{
  const t = tally('WS-2603', SANCERRE);
  if (t.bottles !== 60 || t.houses !== 2) bad('Sancerre should be 2 houses / 60 bottles, got ' + JSON.stringify(t));
  else ok('Sancerre: 2 houses, 60 bottles — summed, not stored');
  const m = tally('WS-2603', MOSEL);
  if (m.bottles !== 12 || m.houses !== 1) bad('Mosel should be 1 house / 12 bottles, got ' + JSON.stringify(m));
  else ok('Mosel: 1 house, 12 bottles');
  /* 60 from one buyer and from six are different findings — the house
     count is as much the signal as the volume (A16.0). */
  const show = S('WS-2603');
  if (JSON.stringify(show).indexOf('"bottles"') !== -1) bad('a tally was written into the record');
  else ok('no total anywhere in the show record');
}

/* ── 2. nothing here is an order ───────────────────────────────── */
console.log('\n── an interest is not an order');
{
  const orders = w.eval('orders') || [];
  const fromShow = orders.filter(o => o.source && String(o.source).indexOf('wine_show') === 0);
  if (fromShow.length) bad('the order list produced ' + fromShow.length + ' order(s) — closing is the NEXT pass');
  else ok('no orders exist yet: demand first, purchase after');
  const partners = w.eval('activePartners').map(p => p.winery);
  const strangers = interests('WS-2603').filter(i => partners.indexOf(i.attendee) === -1);
  if (!strangers.length) bad('every interest is from a partner — the no-partnership case is untested');
  else ok('interests from accounts with no partnership at all: ' + strangers.map(i => i.attendee).join(', '));
}

/* ── 3. WHO MAY WRITE ONE ──────────────────────────────────────── */
console.log('\n── only a guest with a seat may write a list');
{
  const may = w.eval('mayWriteOrderList');
  /* Bistro Laurent holds a seat at WS-2603 (published). */
  if (!may('restaurant', S('WS-2603'))) bad('a seated guest at a released show should be able to write');
  else ok('seated guest at a released show: yes');
  /* Weinhaus Müller has only REQUESTED a place there. */
  if (may('retail', S('WS-2603'))) bad('somebody with no confirmed place can write a list');
  else ok('a place merely requested: no');
  /* and once accepted into a full room they are on the waitlist */
  w.showWineShows('distributor','current');
  w.hostRespondToAttendee('WS-2603','Weinhaus Müller','accept');
  if (w.eval('attendeeStanding')(S('WS-2603'), (S('WS-2603').attendees).find(a => a.stakeholder === 'Weinhaus Müller')) !== 'waitlist')
    bad('fixture drift: Weinhaus Müller should be waitlisted here');
  if (may('retail', S('WS-2603')))
    bad('a WAITLISTED guest can write a list — they were not in the room, which is the whole point');
  else ok('waitlisted: no — the signal is worth something because they tasted it');
  /* WS-2601 is in planning: nobody has tasted anything yet */
  if (may('restaurant', S('WS-2601'))) bad('an unreleased show accepts order lists');
  else ok('a show that has not happened: no');
}

/* ── 4. the attendee writes their own, and sees only their own ─── */
console.log('\n── a guest writes their list from their own pane');
w.showWineShows('restaurant','current');
w.openShowDetail('WS-2603');
{
  const box = boxWithHead('rshow','Your Order List');
  if (!box) bad('a seated guest has no order-list box');
  else if (!box.textContent.toLowerCase().includes('indicative')) bad('the box does not say the price is indicative');
  else ok('guest sees the list with the price marked indicative');
  const inputs = [...d.querySelectorAll('#rshow-detail-pane .ol-qty')];
  if (inputs.length !== 2) bad('expected an input per confirmed wine, got ' + inputs.length);
  else ok('one quantity field per confirmed wine on the show');

  /* the leak: Restaurant Hafenkante's 24 bottles must not be here */
  const t = paneText('rshow');
  if (t.includes('Restaurant Hafenkante') || t.includes('Vinoteca Alster'))
    bad('LEAK: one guest can read another guest\'s order list');
  else ok('a guest sees their own lines and nobody else\'s');
  if (boxWithHead('rshow','Order List') && boxWithHead('rshow','Order List').textContent.includes('house(s)'))
    bad('LEAK: the host\'s tally rendered for a guest');
  else ok('the tally is the host\'s, not the room\'s');

  inputs[0].value = '36';
  w.saveMyOrderList('WS-2603');
  const mine = interests('WS-2603').filter(i => i.attendee === 'Bistro Laurent');
  if (mine.length !== 1 || mine[0].qty !== 36) bad('the guest\'s line was not written: ' + JSON.stringify(mine));
  else ok('guest wrote 36 bottles, recorded as entered by the attendee');
  if (mine[0].enteredBy !== 'attendee') bad('enteredBy should be attendee, is ' + mine[0].enteredBy);
  if (tally('WS-2603', SANCERRE).bottles !== 96) bad('the tally did not follow, is ' + tally('WS-2603', SANCERRE).bottles);
  else ok('the tally followed by itself: 96 bottles across 3 houses');
}
/* zero removes the line rather than storing a zero */
{
  const inputs = [...d.querySelectorAll('#rshow-detail-pane .ol-qty')];
  inputs[0].value = '0';
  w.saveMyOrderList('WS-2603');
  if (interests('WS-2603').some(i => i.attendee === 'Bistro Laurent' && i.product === SANCERRE))
    bad('a zero was stored as a row');
  else ok('setting a quantity to zero removes the line');
  inputs[0].value = '36';
  w.saveMyOrderList('WS-2603');
}

/* ── 5. the host writes at the stand, on a guest's behalf ──────── */
console.log('\n── the host notes an order for a guest');
w.showWineShows('distributor','current');
w.openShowDetail('WS-2603');
{
  if (!boxWithHead('dshow','Order List')) bad('host has no order-list box');
  else if (!paneText('dshow').includes('house(s)')) bad('the host box does not show the tally');
  else ok('host sees the tally per wine and for the show');
  w.openInterestModal('WS-2603');
  const guests = [...d.getElementById('oif-guest').options].map(o => o.value).filter(Boolean);
  if (guests.includes('Weinhaus Müller'))
    bad('the picker offers a WAITLISTED guest — they were not in the room');
  else ok('the guest picker holds seated attendees only');
  d.getElementById('oif-guest').value = 'Vinoteca Alster';
  d.getElementById('oif-wine').value = '1';           // the Mosel
  d.getElementById('oif-qty').value = '6';
  w.saveInterestForGuest();
  const row = interests('WS-2603').find(i => i.attendee === 'Vinoteca Alster' && i.product === MOSEL);
  if (!row) bad('the host-entered line was not written');
  else if (row.enteredBy !== 'host') bad('enteredBy should be host, is ' + row.enteredBy);
  else ok('same row, same function, only enteredBy differs');
}

/* ── 6. THE PRODUCER NEVER SEES THE TALLY ──────────────────────── */
console.log('\n── the producer is not shown the demand behind their order');
w.showWineShows('winery','current');
w.showWineShows('winery','history');
w.openShowDetail('WS-2599');                 // Cantina Rossi exhibits, 18 bottles asked for
{
  const t = paneText('wshow');
  if (!interests('WS-2599').length) bad('fixture drift: WS-2599 should carry an interest');
  if (t.includes('18')) bad('LEAK: the producer can read the quantity asked for');
  if (t.includes('Bistro Laurent')) bad('LEAK: the producer can read who asked');
  if (boxWithHead('wshow','Order List')) bad('LEAK: an order-list box rendered for the producer');
  else ok('the producer sees no tally, no quantity and no buyer');
}
/* nor does it reach the public renderer */
{
  const card = w.eval('publicShowCard')(S('WS-2603'), 'full');
  if (/\b96\b|\b60\b|house\(s\)/.test(card)) bad('LEAK: the tally reached the public card');
  else ok('the public card carries none of it');
}

/* ── 7. prices are the host's, and never binding ───────────────── */
console.log('\n── the indicative price');
w.showWineShows('distributor','current');
w.openShowDetail('WS-2603');
{
  const px = [...d.querySelectorAll('#dshow-detail-pane .ol-price')];
  if (px.length !== 2) bad('expected a price field per wine, got ' + px.length);
  px[0].value = '15.5';
  w.saveIndicativePrices('WS-2603');
  const wine = w.eval('orderListProducts')(S('WS-2603'))[0];
  if (wine.product.indicativePrice !== 15.5) bad('price not written to the show product');
  else ok('the price lives on the show product — the host\'s number, not the producer\'s');
  const prod = w.eval('partnerWinesPool').find(x => (x.name + ' ' + x.vintage) === wine.product.name);
  if (prod && prod.indicativePrice !== undefined)
    bad('the price was written onto the producer\'s own wine record (A2)');
  else ok('the producer\'s own record was not touched');
}

/* ── 8. TWO KINDS OF WINE ON THE SAME TABLE (A16.12) ───────────── */
console.log('\n── stock and pre-order, side by side on one show');
{
  const wines = w.eval('orderListProducts')(S('WS-2603'));
  const kinds = wines.map(x => x.product.name + '=' + x.kind);
  const pre = wines.filter(x => x.kind === 'preorder');
  const stk = wines.filter(x => x.kind === 'stock');
  /* The fixture has to DEMONSTRATE the distinction, not merely contain
     it: both columns on the same show, or nothing is being shown. */
  if (!pre.length || !stk.length)
    bad('WS-2603 must carry both columns to demonstrate anything, got ' + kinds.join(', '));
  else ok('one show, both columns: ' + kinds.join(', '));

  /* and it is a lookup, not a stored flag */
  if (JSON.stringify(S('WS-2603')).indexOf('preorder') !== -1)
    bad('the column was written into the show record — it must be read from the portfolio');
  else ok('nothing about the column is stored on the show');

  const portfolio = w.eval('currentWinePortfolio');
  const listed = portfolio.some(x => (x.name + ' ' + x.vintage) === stk[0].product.name);
  if (!listed) bad('a wine called "in stock" is not in the portfolio at all');
  else ok('the in-stock wine really is in the host\u2019s portfolio (A3)');

  /* take it out again and the wine changes column by itself */
  const idx = portfolio.findIndex(x => (x.name + ' ' + x.vintage) === stk[0].product.name);
  const removed = portfolio.splice(idx, 1)[0];
  if (w.eval('lineKind')(S('WS-2603'), stk[0].product.name) !== 'preorder')
    bad('removing the wine from the portfolio did not move it to the pre-order column');
  else ok('a wine leaving the portfolio changes column with nothing else touched');
  portfolio.splice(idx, 0, removed);
}

console.log('\n── the instrument counts only what is not listed yet');
{
  const all = w.eval('showTally')(S('WS-2603'));
  const pre = w.eval('preorderTally')(S('WS-2603'));
  if (pre.bottles >= all.bottles)
    bad('the pre-order tally should exclude the stocked wine: ' + pre.bottles + ' vs ' + all.bottles);
  else ok('pre-order demand ' + pre.bottles + ' btl of ' + all.bottles + ' asked for — stock is not at risk');
}

console.log('\n── the guest is told which is which, in words');
w.showWineShows('restaurant','current');
w.openShowDetail('WS-2603');
{
  const box = boxWithHead('rshow','Your Order List');
  const t = box ? box.textContent : '';
  if (!/In stock/i.test(t)) bad('no in-stock wording on the guest list');
  else if (!/Pre-order/i.test(t)) bad('no pre-order wording on the guest list');
  else ok('both phrasings appear on the guest\u2019s own list');
  if (!/about 14 days after the show/i.test(t)) bad('the lead time is not shown to the guest');
  else ok('the lead time is named: "about 14 days after the show"');
  /* Per LINE, not per box: nested divs mean an ancestor holding both
     wines matches everything, which is how this check first passed for
     the wrong reason. A row is the div that owns exactly one quantity
     field. */
  const rows = [...box.querySelectorAll('div')]
    .filter(el => el.querySelectorAll('input.ol-qty').length === 1);
  const rowFor = name => rows.filter(el => el.textContent.includes(name)).pop();
  const stockRow = rowFor(MOSEL), preRow = rowFor(SANCERRE);
  if (!stockRow || !preRow) bad('could not isolate one row per wine');
  else {
    if (!/In stock/i.test(stockRow.textContent)) bad('the stocked wine is not marked in stock');
    else if (/14 days|Pre-order/i.test(stockRow.textContent))
      bad('the lead time is claimed for a wine that is already on the shelf');
    else ok('the in-stock row carries no lead time — the mistake in the other direction');
    if (!/Pre-order/i.test(preRow.textContent) || !/14 days/.test(preRow.textContent))
      bad('the pre-order row does not carry its lead time');
    else ok('the pre-order row carries "about 14 days after the show"');
  }
}
/* with no lead time named, no figure is invented */
{
  const show = S('WS-2603'), keep = show.deliveryLead;
  show.deliveryLead = null;
  w.openShowDetail('WS-2603');
  const t = boxWithHead('rshow','Your Order List').textContent;
  if (/\d+ days/.test(t)) bad('a lead time appeared from nowhere once the field was cleared');
  else if (!/delivered after the show/i.test(t)) bad('a pre-order line says nothing about when');
  else ok('unnamed lead time reads "delivered after the show", with no figure invented');
  show.deliveryLead = keep;
}

/* ── 9. B12: the guards speak ──────────────────────────────────── */
console.log('\n── an action that does nothing says why (B12)');
{
  const said = [];
  const real = w.showToast;
  w.showToast = m => said.push(m);
  w.showWineShows('retail','current');
  w.saveMyOrderList('WS-2603');               // waitlisted → may not write
  if (!said.length) bad('a waitlisted guest saving a list got no answer');
  else ok('refused with a reason: "' + said[0] + '"');
  said.length = 0;
  w.saveInterestForGuest.call(null);
  if (!said.length) bad('saving with no guest picked was silent');
  else ok('the modal refuses with a reason too');
  w.showToast = real;
}

console.log(fail ? `\n✗ ${fail} failure(s)` : '\n✓ all checks passed');
process.exit(fail ? 1 : 0);
