/* ═══════════════════════════════════════════════════════════════════
   ATTENDEES AND THE WAITLIST — A16.5

   The claim this file has to keep honest is the one in A16.5: a
   waitlist that "moves up automatically when someone withdraws". That
   is only true if a seat is COMPUTED (A16.10, D28). If anybody ever
   stores `waitlisted`, these checks are what should fail — so most of
   what follows drives the queue rather than reading it.

   Four rules from A16.5, each with its own section:
     1. a seat is computed from request order against capacity;
     2. only confirmed attendees consume capacity;
     3. invitations go to partners, requests are the route for anyone
        else — attending needs no partnership;
     4. the attendee list is the host's book: not public, not visible
        to other attendees, and a head count to the venue.
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
const A = (id, who) => (S(id).attendees || []).find(a => a.stakeholder === who);
const queue = id => w.eval('attendeeQueue')(S(id));
const standing = (id, who) => w.eval('attendeeStanding')(S(id), A(id, who));
const paneText = pre => d.getElementById(pre + '-detail-pane').textContent;
const boxWithHead = (pre, h) => [...d.querySelectorAll('#' + pre + '-detail-pane .odt-box')]
  .find(b => b.querySelector('.odt-box-head').textContent.includes(h));

/* ── 0. no stored waitlist anywhere in the fixtures ────────────── */
console.log('── the status column holds decisions only (D28)');
{
  const ALLOWED = ['invited','requested','confirmed','declined','withdrawn'];
  const bogus = [];
  w.eval('wineShows').forEach(s => (s.attendees || []).forEach(a => {
    if (ALLOWED.indexOf(a.status) === -1) bogus.push(s.id + ':' + a.stakeholder + '=' + a.status);
  }));
  if (bogus.length) bad('a stored status outside the decision set: ' + bogus.join(', '));
  else ok('every attendee status is a decision, never a computed standing');
}

/* ── 1. A SEAT IS COMPUTED — the full-room fixture ─────────────── */
console.log('\n── WS-2603: three seats, three seated, one asking');
{
  const q = queue('WS-2603');
  if (q.seated.length !== 3) bad('expected 3 seated, got ' + q.seated.length);
  else ok('three confirmed attendees hold the three seats');
  if (q.waiting.length !== 0) bad('nobody should be waiting yet — the fourth has not been accepted');
  else ok('an unanswered REQUEST is not on the waitlist either');
  if (standing('WS-2603','Weinhaus Müller') !== null) bad('a requester has no standing until the host answers');
  else ok('rule 2: only confirmed attendees consume or queue for capacity');
}

/* the host accepts into a full room → the waitlist forms by itself */
console.log('\n── accepting into a full room lands on the waitlist');
w.showWineShows('distributor','current');
w.openShowDetail('WS-2603');
if (!boxWithHead('dshow','Attendees')) bad('host has no attendee book');
else if (!paneText('dshow').includes('3 / 3 seats')) bad('the book does not show seats taken');
else ok('host sees "3 / 3 seats" before accepting');
w.hostRespondToAttendee('WS-2603','Weinhaus Müller','accept');
{
  if (A('WS-2603','Weinhaus Müller').status !== 'confirmed') bad('acceptance not recorded');
  if (standing('WS-2603','Weinhaus Müller') !== 'waitlist') bad('should be waiting, is ' + standing('WS-2603','Weinhaus Müller'));
  else ok('confirmed into a full room → waitlist, with no separate act');
  if (w.eval('waitlistPosition')(S('WS-2603'), A('WS-2603','Weinhaus Müller')) !== 1) bad('should be waitlist #1');
  else ok('waitlist position #1, derived from request order');
  if (JSON.stringify(A('WS-2603','Weinhaus Müller')).includes('waitlist'))
    bad('REGRESSION: the standing was written into the record (D28)');
  else ok('nothing about the waitlist was stored on the row');
}

/* ── THE CLAIM: a withdrawal promotes, with nothing running ────── */
console.log('\n── a withdrawal promotes the next person by arithmetic alone');
w.showWineShows('retail','current');
w.openShowDetail('WS-2603');
{
  const box = boxWithHead('tshow','On the Waitlist');
  if (!box) bad('the waitlisted attendee is not told where they stand');
  else if (!box.textContent.includes('number 1')) bad('the box does not name the position');
  else ok('waitlisted attendee sees "number 1" and why they need do nothing');
}
/* Bistro Laurent gives up seat 1. Nobody touches Weinhaus Müller. */
w.showWineShows('restaurant','current');
w.openShowDetail('WS-2603');
const beforeRow = JSON.stringify(A('WS-2603','Weinhaus Müller'));
w.withdrawPlace('WS-2603');
{
  if (A('WS-2603','Bistro Laurent').status !== 'withdrawn') bad('withdrawal not recorded');
  else ok('the leaver is `withdrawn`, not `declined` — different facts (D28)');
  if (JSON.stringify(A('WS-2603','Weinhaus Müller')) !== beforeRow)
    bad('the promoted row was MUTATED — the promotion should be arithmetic, not a cascade');
  else ok('the promoted attendee\'s record is byte-for-byte unchanged');
  if (standing('WS-2603','Weinhaus Müller') !== 'seat')
    bad('the waitlisted attendee should now hold a seat, is ' + standing('WS-2603','Weinhaus Müller'));
  else ok('THE CLAIM HOLDS: they hold a seat, and nothing ran to put them there');
  if (queue('WS-2603').seated.length !== 3) bad('the room should still be full, is ' + queue('WS-2603').seated.length);
  else ok('the room stays full — the seat was reused, not lost');
}
w.showWineShows('retail','current');
w.openShowDetail('WS-2603');
if (!boxWithHead('tshow','You Have a Place')) bad('the promoted attendee is still shown as waiting');
else ok('the promoted attendee now reads "You Have a Place"');

/* ── 2. capacity counts confirmations, not invitations ─────────── */
console.log('\n── an unanswered invitation holds no seat');
{
  const before = queue('WS-2601').seated.length;
  w.showWineShows('distributor','current');
  w.openShowDetail('WS-2601');
  w.openAttendeeModal('WS-2601');
  d.getElementById('af-guest').value = 'Weinhaus Müller';
  w.saveAttendeeInvite();
  if (A('WS-2601','Weinhaus Müller').status !== 'invited') bad('invitation not recorded');
  if (queue('WS-2601').seated.length !== before)
    bad('an invitation consumed a seat — a host could fill their own room by inviting');
  else ok('rule 2 holds: inviting changes no seat count');
}

/* ── 3. attending needs no partnership ─────────────────────────── */
console.log('\n── a stranger may attend; the invite picker is partners only');
{
  const partners = w.eval('activePartners').map(p => p.winery);
  const strangers = [];
  w.eval('wineShows').forEach(s => (s.attendees || []).forEach(a => {
    if (partners.indexOf(a.stakeholder) === -1 && a.status === 'confirmed') strangers.push(a.stakeholder);
  }));
  if (!strangers.length) bad('no confirmed non-partner attendee in the fixtures — rule 3 is untested');
  else ok('confirmed attendees who are nobody\'s partner: ' + [...new Set(strangers)].join(', '));

  w.showWineShows('distributor','current');
  w.openShowDetail('WS-2601');
  w.openAttendeeModal('WS-2601');
  const offered = [...d.getElementById('af-guest').options].map(o => o.value).filter(Boolean);
  if (offered.some(v => partners.indexOf(v) === -1)) bad('the invite picker offers a non-partner: ' + offered);
  else ok('invitations are offered for partners only — asking is the other route');
  w.closeAttendeeModal();
}
/* and the asking route works from the visitor pane */
console.log('\n── requesting a place from a browsed show');
w.showWineShows('retail','current');
w.openShowDetail('WS-2601');          // Weinhaus Müller was just invited here
if (!boxWithHead('tshow','Your Invitation')) bad('the invitation is not shown to the guest');
else ok('an invited guest sees Accept / Decline on the visitor pane');
w.respondToAttendeeInvite('WS-2601','accept');
if (standing('WS-2601','Weinhaus Müller') !== 'seat') bad('capacity 80 — this should be a seat');
else ok('accepting into a half-empty room is a seat, not a waitlist place');

/* ── 4. THE HOST'S BOOK — not public, not shared sideways ──────── */
console.log('\n── the attendee list is the host\'s book (rule 4)');
w.showWineShows('retail','current');
w.openShowDetail('WS-2601');
{
  const t = paneText('tshow');
  ['Vinstuen København','Bistro Laurent','Restaurant Hafenkante'].forEach(n => {
    if (t.includes(n)) bad('LEAK: one attendee can read another ("' + n + '")');
  });
  if (boxWithHead('tshow','Attendees')) bad('LEAK: the host\'s book rendered for an attendee');
  else ok('an attendee sees their own standing and nobody else\'s');
}
/* the venue gets a head count and no names */
w.showWineShows('distributor','current');
w.openShowDetail('WS-2601');
w.openVenueModal('WS-2601');
d.getElementById('vf-partner').value = 'Bistro Laurent';
w.sendVenueRequest();
w.showWineShows('restaurant','current');
w.openShowDetail('WS-2601');
{
  const t = paneText('rshow');
  if (!t.includes('guest(s) expected')) bad('the venue is not told how many are coming — it has to cater for them');
  else ok('the venue is given a head count');
  ['Vinstuen København','Weinhaus Müller'].forEach(n => {
    if (t.includes(n)) bad('LEAK: the venue can read the guest list ("' + n + '")');
  });
  if (boxWithHead('rshow','Attendees')) bad('LEAK: the host\'s book rendered for the venue');
  else ok('a head count, never the names');
}
/* nor does anything reach the public renderer */
{
  const card = w.eval('publicShowCard')(S('WS-2603'), 'full');
  ['Bistro Laurent','Restaurant Hafenkante','Vinoteca Alster','Weinhaus Müller'].forEach(n => {
    if (card.includes(n)) bad('LEAK: an attendee is named on the PUBLIC card ("' + n + '")');
  });
  ok('the public card of a released show names no attendee at all');
}

/* ── 5. the turn shows up where the role works ─────────────────── */
console.log('\n── requests and invitations are turns like any other');
{
  const s2604 = S('WS-2604');
  s2604.attendees = s2604.attendees || [];
  s2604.attendees.push({ stakeholder:'Vinoteca Alster', source:'request', status:'requested', at:'31 Jul 2026' });
  if (!w.eval('showAwaits')('distributor', s2604)) bad('a request for a place does not reach the host as a turn');
  else ok('a request for a place counts as the host\'s turn');
  s2604.attendees.pop();
  if (w.eval('showAwaits')('distributor', s2604)) bad('the turn survived the request being removed');
  else ok('and stops counting the moment it is gone — computed, not flagged');
}

/* ── 6. B12: a guard that cannot proceed says so ───────────────── */
console.log('\n── an action that does nothing says why (B12)');
{
  const said = [];
  const realToast = w.showToast;
  w.showToast = m => { said.push(m); };
  /* withdrawPlace acts on the ACTIVE role. Called while the distributor
     is active there is no attendance to withdraw — unreachable from the
     UI, reachable from here, and it must not look like it worked. */
  w.showWineShows('distributor','current');
  w.withdrawPlace('WS-2603');
  if (!said.length) bad('withdrawPlace returned silently for a role with no attendance');
  else ok('withdrawPlace with no attendance says so: "' + said[0] + '"');
  said.length = 0;
  w.hostRespondToAttendee('WS-2603','Nobody At All','accept');
  if (!said.length) bad('answering a guest who is not on the list returned silently');
  else ok('an unknown guest is reported, not ignored');
  said.length = 0;
  w.withdrawPlace('WS-9999');
  if (!said.length) bad('an unknown show id returned silently');
  else ok('an unknown show is reported');
  w.showToast = realToast;
}

console.log(fail ? `\n✗ ${fail} failure(s)` : '\n✓ all checks passed');
process.exit(fail ? 1 : 0);
