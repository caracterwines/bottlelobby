/* ═══════════════════════════════════════════════════════════════════
   MEMBER EVENTS — A16.8, A16.9, A16.14d, invariants ME-1..ME-7
   -------------------------------------------------------------------
   Most of what is asserted here is an ABSENCE — no guarantee marker,
   no order, no ticket, no copied show — and an absence is the easiest
   thing in the world to assert wrongly. A check that looks for a
   phrase in a card that was never rendered passes for the wrong reason
   and goes on passing after the rule is deleted.

   So, exactly as tests/shows-reach.js does it, every invariant is
   measured twice:

     · the CLAIM: the rule holds;
     · the COUNTER-MUTATION: the state or the function is changed so
       that the rule is broken, the same check runs again, and it MUST
       come back red. A check that stays green under its own counter-
       mutation is reported as a failure of the check, not of the code.

   ME-3 is the one this file exists for, and it is measured on the
   RENDERED CARD against the show card's own guarantee vocabulary —
   read out of SHOW_GUARANTEE_MARKERS in the asset rather than retyped
   here, so that adding a phrase to publicShowCard() and forgetting it
   here cannot go unnoticed (C7: a contract test over vocabulary).

   ME-4 (campaign recipient snapshots) is NOT covered: campaigns are
   A16.14e and are not built. There is nothing to measure, and a check
   over a feature that does not exist is a check that cannot fail.
═══════════════════════════════════════════════════════════════════ */
const path = require('path');
const { loadDashboard } = require('./load-dashboard');
const { JSDOM, VirtualConsole } = require('jsdom');

function boot() {
  const errs = [];
  const dom = new JSDOM(loadDashboard().html, {
    runScripts: 'dangerously', pretendToBeVisual: true,
    virtualConsole: new VirtualConsole().on('jsdomError', e => errs.push(e.message))
  });
  if (errs.length) { console.log('SCRIPT ERRORS:\n' + errs.join('\n')); process.exit(1); }
  const w = dom.window;
  w.scrollTo = () => {};
  w.confirm = () => true;
  return w;
}

const w = boot(), d = w.document;
console.log('dashboard evaluated cleanly\n');

let fail = 0;
const bad = m => { console.log('  ✗ ' + m); fail++; };
const ok  = m => console.log('  ✓ ' + m);

function expectRed(label, check) {
  const before = fail;
  const realLog = console.log;
  console.log = () => {};
  try { check(); } finally { console.log = realLog; }
  const raised = fail - before;
  fail = before;                       /* the failures were the point */
  if (raised) ok('counter-mutation: ' + label + ' — the check goes red (' + raised + ')');
  else bad('COUNTER-MUTATION STAYED GREEN: ' + label + ' — this check cannot fail and proves nothing');
}

/* Everything the role's Discover pane actually renders, as text —
   the surface the directory rules are about. */
function discoverText(role) {
  w.showWineShows(role, 'discover');
  return d.getElementById(w.eval('SHOW_ROLES')[role].prefix + '-list-pane').textContent;
}
const EV     = id => w.eval('memberEvents').find(e => e.id === id);
const EVENTS = () => w.eval('memberEvents');
const SHOWS  = () => w.eval('wineShows');
const V      = (entity, role) => w.showViewer(entity, role);

/* ══════════════════════════════════════════════════════════════════
   ME-1 — no `wine_shows` row inside `events`, and no event copied per
   surface. The directory is DERIVED.
══════════════════════════════════════════════════════════════════ */
console.log('── ME-1: two records of two kinds, and a directory that holds neither');
{
  const showIds = SHOWS().map(s => s.id);
  const evIds   = EVENTS().map(e => e.id);

  const crossed = evIds.filter(id => showIds.indexOf(id) !== -1);
  if (crossed.length) bad('these ids are in both collections: ' + crossed.join(', '));
  else ok(EVENTS().length + ' events and ' + SHOWS().length + ' shows, no id in both');

  /* A show that had been copied in would bring its own vocabulary with
     it — the fields only a Wine Show has, because only a Wine Show has
     a release pipeline, a venue relation and a cost split. */
  const SHOW_ONLY = ['stage', 'leadHost', 'exhibitors', 'venueStatus',
                     'cateringTotal', 'cateringMode', 'venueEntity'];
  const bleed = [];
  EVENTS().forEach(e => SHOW_ONLY.forEach(k => {
    if (Object.prototype.hasOwnProperty.call(e, k)) bleed.push(e.id + '.' + k);
  }));
  if (bleed.length) bad('Wine Show fields on an event record: ' + bleed.join(', '));
  else ok('no event carries a Wine Show field — ' + SHOW_ONLY.join(', '));

  const back = SHOWS().filter(s => Object.prototype.hasOwnProperty.call(s, 'hostRole'));
  if (back.length) bad('these shows carry the event vocabulary: ' + back.map(s => s.id).join(', '));
  else ok('and no show carries the event vocabulary either');

  expectRed('copy a show into memberEvents', () => {
    const clone = JSON.parse(JSON.stringify(SHOWS()[0]));
    EVENTS().push(clone);
    try {
      const ids = EVENTS().map(e => e.id).filter(id => SHOWS().map(s => s.id).indexOf(id) !== -1);
      if (ids.length) bad('crossed: ' + ids.join(', '));
      const b = [];
      EVENTS().forEach(e => SHOW_ONLY.forEach(k => {
        if (Object.prototype.hasOwnProperty.call(e, k)) b.push(e.id + '.' + k);
      }));
      if (b.length) bad('bled: ' + b.join(', '));
    } finally { EVENTS().pop(); }
  });

  /* THE DERIVED HALF, MEASURED ON THE RENDERED SURFACE. A directory
     that had been stored — or a per-surface copy — would go on showing
     the old title after the record changed. Rendering it either side of
     an edit is the only way to tell a derivation from a copy, and doing
     it on the array alone would prove nothing: the array IS the record. */
  const ev = EV('ME-3103');
  const was = ev.title;
  if (discoverText('restaurant').indexOf(was) === -1)
    bad('ME-3103 is not on the restaurant Discover pane at all — nothing would be measured');
  else {
    ev.title = 'Renamed In Place';
    const after = discoverText('restaurant');
    ev.title = was;
    if (after.indexOf('Renamed In Place') === -1) bad('the pane kept the old title — it is a copy, not a derivation');
    else ok('the rendered directory follows an edit to the record: derived, not stored');
  }
}

/* ══════════════════════════════════════════════════════════════════
   ME-2 — publish, announcement, RSVP, application and sponsoring
   create no order and no partnership.
══════════════════════════════════════════════════════════════════ */
console.log('\n── ME-2: nothing about an event creates an order or a partnership');
{
  const count = () => ({ orders: w.eval('orders').length,
                         partnerships: w.eval('partnerships').length });

  /* The applicant on ME-3102 is the case A16.8 names: Château Belrieu
     asked to take part and NOTHING else followed. If the fixture ever
     stops holding an application, this whole invariant is being
     measured against an empty set — so assert the fixture first
     (C7: fixture reachability). */
  const applicant = EV('ME-3102').participants.find(p => p.status === 'applied');
  if (!applicant) bad('no applied participant in the fixtures — ME-2 has nothing to measure');
  else ok('the fixture holds an application: ' + applicant.stakeholder + ' on ME-3102');

  const sponsor = EV('ME-3102').participants.find(p => p.role === 'sponsor');
  if (!sponsor) bad('no sponsor in the fixtures — the sponsoring half of ME-2 is unmeasured');
  else ok('and a sponsor: ' + sponsor.stakeholder);

  const before = count();
  /* Drive the real acts, in order: publish a draft, invite, accept,
     RSVP, and accept an application. Every one of them is a thing a
     helpful button would be tempted to turn into a transaction. */
  w.publishMemberEvent('ME-3104');
  w.inviteToEvent('ME-3104', 'Cantina Rossi', 'exhibitor');
  w.respondToEventInvite('ME-3104', 'Cantina Rossi', 'accept');
  w.rsvpToEvent('ME-3104', 'Bistro Laurent', 'confirm');
  w.setEventApplications('ME-3102', true);
  w.decideEventApplication('ME-3102', 'Château Belrieu', 'accept');
  const after = count();

  if (after.orders !== before.orders)
    bad('the orders book moved: ' + before.orders + ' → ' + after.orders);
  else ok('publish · invite · accept · RSVP · application accepted → the orders book is unchanged (' + after.orders + ')');
  if (after.partnerships !== before.partnerships)
    bad('the partnership book moved: ' + before.partnerships + ' → ' + after.partnerships);
  else ok('and the partnership book is unchanged (' + after.partnerships + ')');

  expectRed('let an accepted application write a partnership', () => {
    const p = w.eval('partnerships');
    const n = p.length;
    p.push({ distributor:'Bistro Laurent', partner:'Château Belrieu', at:'2026-08-08', activatedBy:'the event' });
    try { if (p.length !== n) bad('the partnership book moved'); }
    finally { p.pop(); }
  });
}

/* ══════════════════════════════════════════════════════════════════
   ME-3 — no Bottle Lobby guarantee marker on a member event, and a
   moderation block is not a release act.

   THE ONE THIS FILE EXISTS FOR. Measured on the rendered card, against
   the show card's own vocabulary.
══════════════════════════════════════════════════════════════════ */
console.log('\n── ME-3: the two cards may share a list and may not share a promise');
{
  const MARKERS = w.eval('SHOW_GUARANTEE_MARKERS');
  const CLASSES = w.eval('SHOW_CARD_CLASSES');
  if (!MARKERS.length || !CLASSES.length) bad('the marker lists are empty — nothing would be measured');
  else ok('measuring against ' + MARKERS.length + ' guarantee phrase(s) and ' +
          CLASSES.length + ' show-card class(es), read from the asset');

  /* First: the markers are really what the SHOW card says. A list that
     matched nothing would make every check below pass vacuously. */
  const shown = w.publicShowCard(SHOWS().find(s => s.stage === 'planning'), 'anonymised') +
                w.publicShowTeaser(SHOWS().find(s => s.stage === 'published'), 'full', null);
  const unused = MARKERS.filter(m => shown.indexOf(m) === -1);
  if (unused.length) bad('these "show markers" appear on no show card: ' + unused.join(' / '));
  else ok('every marker really is a phrase the show card uses');

  EVENTS().forEach(ev => {
    const html = w.memberEventCard(ev);
    const hitP = MARKERS.filter(m => html.indexOf(m) !== -1);
    const hitC = CLASSES.filter(c => html.indexOf('"' + c) !== -1 || html.indexOf(' ' + c + ' ') !== -1);
    if (hitP.length) bad(ev.id + ' asserts the guarantee: ' + hitP.join(' / '));
    else if (hitC.length) bad(ev.id + ' wears the show card: ' + hitC.join(', '));
    else ok(ev.id + ' — no guarantee phrase, no show-card class');
  });

  /* And it says what it IS, not only what it is not. */
  const disc = w.eval('MEMBER_EVENT_DISCLAIMER');
  const missing = EVENTS().filter(ev => w.memberEventCard(ev).indexOf(disc) === -1);
  if (missing.length) bad('no non-release wording on ' + missing.map(e => e.id).join(', '));
  else ok('every card carries the A16.8 wording in full');

  const nomark = EVENTS().filter(ev => w.memberEventCard(ev).indexOf('Member Event') === -1);
  if (nomark.length) bad('no kind marker on ' + nomark.map(e => e.id).join(', '));
  else ok('and every card leads with its own Member Event marker');

  expectRed('give the event card the show card\'s sentence', () => {
    const real = w.memberEventCard;
    w.memberEventCard = ev => real(ev).replace('</div></div>',
      '<div class="ws-public-hidden">' + MARKERS[0] + '</div></div></div>');
    try {
      EVENTS().forEach(ev => {
        const html = w.memberEventCard(ev);
        if (MARKERS.some(m => html.indexOf(m) !== -1)) bad(ev.id + ' asserts the guarantee');
      });
    } finally { w.memberEventCard = real; }
  });

  /* MODERATION IS NOT A RELEASE ACT. Delisting takes the event off the
     directory and writes NOTHING into `reviews` — that register carries
     release semantics (A16.9, WS-6), and a moderation decision wearing
     a release row is precisely the confusion this invariant forbids. */
  const revBefore = w.eval('reviews').length;
  const ev = EV('ME-3103');
  w.simulateStaffDelist('ME-3103', 'Reported for a misleading price claim.');
  const revAfter = w.eval('reviews').length;

  if (revAfter !== revBefore) bad('delisting wrote ' + (revAfter - revBefore) + ' reviews row(s)');
  else ok('delisting wrote no reviews row (' + revAfter + ' unchanged)');
  if (w.eval("reviews.some(r => r.subjectType === 'event')"))
    bad("`reviews` has grown a subjectType of 'event' — the register is the release register");
  else ok("`reviews` still carries no subjectType 'event'");
  if (!ev.moderation || ev.moderation.status !== 'delisted')
    bad('the event was not actually delisted — nothing was measured');
  else if (!ev.moderation.reason) bad('delisted without a reason on the record');
  else ok('the event carries its own moderation record, with the reason: "' + ev.moderation.reason + '"');
  if (w.discoverEvents('restaurant').some(e => e.id === 'ME-3103'))
    bad('a delisted event is still in the directory');
  else ok('and it is off the directory');

  expectRed('record the delisting as a reviews row', () => {
    const r = w.eval('reviews');
    const n = r.length;
    r.push({ id:'RV-9999', subjectType:'event', subjectId:'ME-3103', reviewStatus:'approved' });
    try {
      if (r.length !== n) bad('reviews grew');
      if (w.eval("reviews.some(x => x.subjectType === 'event')")) bad("subjectType 'event' exists");
    } finally { r.pop(); }
  });

  w.relistMemberEvent('ME-3103');
  if (ev.moderation) bad('relisting left the moderation record behind');
  else ok('relisted — the block is lifted and the directory has it back');
}

/* ══════════════════════════════════════════════════════════════════
   ME-5 — head counts, never identities, until `completed`.
══════════════════════════════════════════════════════════════════ */
console.log('\n── ME-5: the card counts the room, it does not name it');
{
  const named = [];
  EVENTS().forEach(ev => {
    if (ev.status === 'completed') return;
    const html = w.memberEventCard(ev);
    ev.participants.forEach(p => {
      /* The HOST is not an identity being disclosed — a card is the
         host announcing himself (A16.7), and it says so in words. */
      if (p.role === 'host') return;
      if (html.indexOf(p.stakeholder) !== -1) named.push(ev.id + ' names ' + p.stakeholder);
    });
  });
  if (named.length) bad(named.join('; '));
  else ok('no participant, invitee, applicant or guest is named on any card');

  const ev = EV('ME-3101');
  const card = w.memberEventCard(ev);
  const free = w.eventFreePlaces(ev);
  if (card.indexOf(String(free)) === -1) bad('the card shows no place count at all');
  else ok('it shows the count instead — ' + free + ' place(s) left of ' + ev.capacity);

  expectRed('name the participants on the card', () => {
    const real = w.memberEventCard;
    w.memberEventCard = e => real(e) + '<div>' + e.participants.map(p => p.stakeholder).join(', ') + '</div>';
    try {
      EVENTS().forEach(e => {
        if (e.status === 'completed') return;
        const html = w.memberEventCard(e);
        e.participants.forEach(p => {
          if (p.role === 'host') return;
          if (html.indexOf(p.stakeholder) !== -1) bad(e.id + ' names ' + p.stakeholder);
        });
      });
    } finally { w.memberEventCard = real; }
  });
}

/* ══════════════════════════════════════════════════════════════════
   ME-6 — event wines resolve to product keys. A typed wine name is a
   harness failure (A15.2a, invariant 2).
══════════════════════════════════════════════════════════════════ */
console.log('\n── ME-6: the wines are references into somebody else\'s catalogue');
{
  const rows = [];
  EVENTS().forEach(ev => (ev.products || []).forEach(p => rows.push({ ev:ev.id, p:p })));
  if (!rows.length) bad('no event names a wine — ME-6 has nothing to measure');
  else ok(rows.length + ' wine reference(s) across ' + EVENTS().length + ' events');

  const strayKeys = [];
  rows.forEach(r => {
    Object.keys(r.p).forEach(k => { if (k !== 'productId') strayKeys.push(r.ev + '.' + k); });
    if (!/^PRD-\d+$/.test(r.p.productId || '')) strayKeys.push(r.ev + ' — not a product key: ' + r.p.productId);
    else if (!w.wineByRef(r.p.productId)) strayKeys.push(r.ev + ' — ' + r.p.productId + ' resolves to nothing');
  });
  if (strayKeys.length) bad(strayKeys.join('; '));
  else ok('every row is a productId and nothing else, and every key resolves in the catalogue');

  /* AND THE WINE BELONGS TO A PRODUCER, not to the event's host —
     invariant 2 read from the other end. */
  const owned = rows.every(r => !!w.wineByRef(r.p.productId).winery);
  if (!owned) bad('a referenced product has no producer');
  else ok('and every referenced product is owned by a producer');

  expectRed('type a wine name onto an event', () => {
    const ev = EV('ME-3101');
    ev.products.push({ productId:'PRD-1022', name:'Primitivo — Alcamo DOC 2022' });
    try {
      const b = [];
      (ev.products || []).forEach(p => Object.keys(p).forEach(k => { if (k !== 'productId') b.push(k); }));
      if (b.length) bad('typed: ' + b.join(', '));
    } finally { ev.products.pop(); }
  });
}

/* ══════════════════════════════════════════════════════════════════
   ME-7 — no consumer checkout or ticketing structures exist.
   Bottle Lobby stays B2B: a flag, a price note, an off-platform link,
   and nothing else (A16.8).
══════════════════════════════════════════════════════════════════ */
console.log('\n── ME-7: a paid event is announced, never sold');
{
  const paid = EVENTS().filter(e => e.isPaid);
  if (!paid.length) bad('no paid event in the fixtures — ME-7 has nothing to measure');
  else ok(paid.length + ' paid event(s): ' + paid.map(e => e.id).join(', '));

  const PAID_FIELDS = ['isPaid', 'priceNote', 'externalLink'];
  const FORBIDDEN = ['tickets', 'ticketTypes', 'checkout', 'cart', 'basket', 'payment',
                     'paymentIntent', 'seats', 'bookings', 'attendeeAccounts', 'priceCents'];
  const found = [];
  EVENTS().forEach(ev => FORBIDDEN.forEach(k => {
    if (Object.prototype.hasOwnProperty.call(ev, k)) found.push(ev.id + '.' + k);
  }));
  if (found.length) bad('consumer commerce on an event record: ' + found.join(', '));
  else ok('no event carries any of ' + FORBIDDEN.join(', '));

  const ev = paid[0];
  const carried = PAID_FIELDS.filter(k => ev[k] !== null && ev[k] !== undefined);
  if (carried.length !== PAID_FIELDS.length)
    bad(ev.id + ' is paid but carries only ' + carried.join(', '));
  else ok(ev.id + ' carries exactly the three A16.8 fields — flag, note, off-platform link');

  /* And the card offers no way to pay. */
  const card = w.memberEventCard(ev);
  const buttons = ['Buy', 'Book now', 'Add to cart', 'Checkout', 'Pay '];
  const cta = buttons.filter(b => card.indexOf(b) !== -1);
  if (cta.length) bad('the card offers ' + cta.join(', '));
  else ok('and its card states the price without offering a way to pay it');

  expectRed('grow a ticket structure on a paid event', () => {
    ev.tickets = [{ type:'standard', price:95, sold:0 }];
    try {
      const b = [];
      EVENTS().forEach(e => FORBIDDEN.forEach(k => {
        if (Object.prototype.hasOwnProperty.call(e, k)) b.push(e.id + '.' + k);
      }));
      if (b.length) bad('found: ' + b.join(', '));
    } finally { delete ev.tickets; }
  });
}

/* ══════════════════════════════════════════════════════════════════
   REACH — ONE TAXONOMY, TWO KINDS OF RECORD (A16.14b).
   Not an ME- number, but it is the thing the whole section rests on:
   an event-only level, or a second level set, would break the promise
   that reach is defined exactly once.
══════════════════════════════════════════════════════════════════ */
console.log('\n── reach: the events reference the taxonomy, they do not redefine it');
{
  const LEVELS = w.eval('REACH_LEVELS');
  const used = [...new Set(EVENTS().flatMap(e => e.reach || []))];
  const alien = used.filter(l => LEVELS.indexOf(l) === -1);
  if (alien.length) bad('reach values that are not in the taxonomy: ' + alien.join(', '));
  else ok('every event reach value is one of the ' + LEVELS.length + ': ' + used.join(', '));
  if (used.indexOf('network') !== -1 || used.indexOf('matchmaking') !== -1)
    bad("'network' or 'matchmaking' used as a reach value (D39, C2)");
  else ok("neither 'network' nor 'matchmaking' appears — the two deliberately absent values");

  /* THE HOST IS NEVER LOCKED OUT OF HIS OWN EVENT — WS-2's rule, one
     kind over. Nor is anybody actually on it. */
  const ev = EV('ME-3102');                       /* reach members+wineries */
  const before = ev.reach;
  ev.reach = [];                                  /* invited-only: admits nobody */
  const host = w.eventVisibleTo(ev, V('Bistro Laurent', 'restaurant'));
  const on   = w.eventVisibleTo(ev, V('Henri Dubois Domaine', 'winery'));
  const off  = w.eventVisibleTo(ev, V('Weinhaus Müller', 'retail'));
  ev.reach = before;
  if (!host) bad('the host cannot find his own event');
  else if (!on) bad('an accepted participant cannot find the event they are on');
  else if (off) bad("reach:[] — 'invited-only' — still admitted an outsider");
  else ok('reach:[] admits nobody, and still never the host or a participant');

  /* AND THE INVERTED GATE, which is why eventVisibleTo is a sister
     function at all: a member event's `published` does NOT drop its
     reach, because the host published it and nobody released it. */
  const ev2 = EV('ME-3101');                      /* published, partners+community */
  if (ev2.status !== 'published') bad('ME-3101 is not published — the gate is unmeasured');
  else if (w.eventVisibleTo(ev2, V('Osteria Marconi', 'restaurant')))
    bad('a published event fell open to everybody — WS-3 leaked into the event derivation');
  else ok('published, and the stored reach still decides (WS-3 is a show rule, not an event one)');

  expectRed('drop the reach from a published event, WS-3 style', () => {
    const real = w.eventVisibleTo;
    w.eventVisibleTo = (e, v) => e.status === 'published' ? true : real(e, v);
    try {
      if (w.eventVisibleTo(ev2, V('Osteria Marconi', 'restaurant')))
        bad('a published event fell open to everybody');
    } finally { w.eventVisibleTo = real; }
  });

  /* Geographic narrowing NARROWS. ME-3101 is Munich-only, and Hawesko
     is a partner of nobody's Munich — it is in Hamburg. */
  const muni = w.eventVisibleTo(ev2, V('Weinhaus Müller', 'retail'));   /* host, always */
  const hamb = w.eventVisibleTo(ev2, V('Osteria Marconi', 'restaurant'));
  if (!muni) bad('the Munich host cannot find his own Munich event');
  else if (hamb) bad('a house outside the narrowing still found it');
  else ok('the Munich narrowing holds, and it narrows rather than widens');
}

console.log(fail ? '\n' + fail + ' failure(s)' : '\nmember events: all checks passed');
process.exit(fail ? 1 : 0);
