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

   SINCE THE COCKPIT WENT TO ALL FOUR ROLES, so has this file. A16.8's
   "one model for all four roles" was a claim nothing measured while
   exactly one role was wired, and the rules most likely to be broken
   by a rollout are the ones that used to be checked on the one role
   that had the feature. So the directory checks, the moderation
   check, the card checks and the host/guest split all run over
   `EVENT_ROLES` rather than over a name — and the registry itself is
   measured for sameness, because D21 is what happens when four
   dashboards drift apart by accident.
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
/* ALL FOUR, ALWAYS. A16.8's "one model for all four roles" is the
   sentence this file now measures rather than assumes: every rule
   below that used to be checked on one role is checked on the list.
   Read from the page so that a fifth role — or a role quietly dropped
   from the cockpit — turns up here rather than being missed. */
const ROLES  = () => Object.keys(w.eval('EVENT_ROLES'));
const CFG    = role => w.eval('EVENT_ROLES')[role];
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
  /* ON EVERY ROLE, not on one. Four Discover panes are four chances
     for a per-surface copy to exist, and a copy on the role nobody
     measured is the one that survives. ME-3103's reach is partners +
     restaurants + retail, so the winery reaches it as an accepted
     exhibitor — gate 2 — which is the second way onto a directory and
     worth having in the same loop. */
  const blind = ROLES().filter(r => discoverText(r).indexOf(was) === -1);
  if (blind.length)
    bad('ME-3103 is on no Discover pane for ' + blind.join(', ') + ' — nothing would be measured there');
  else {
    ev.title = 'Renamed In Place';
    const stale = ROLES().filter(r => discoverText(r).indexOf('Renamed In Place') === -1);
    ev.title = was;
    if (stale.length) bad('the pane kept the old title on ' + stale.join(', ') + ' — a copy, not a derivation');
    else ok('the rendered directory follows an edit to the record on all ' + ROLES().length +
            ' roles: derived, not stored');
  }
}

/* ══════════════════════════════════════════════════════════════════
   ONE COCKPIT FOR FOUR ROLES (A16.8, D21).

   "There is no per-role event data model — the first full cockpit is
   built on the distributor dashboard, and the same components are then
   reused role-dependently." D21 is the lesson behind it: four
   dashboards behaving differently taught the user four navigations for
   one product, and the divergence was accidental rather than intended.

   So this section measures SAMENESS, which is unusual and is the
   point. Everything that differs between the four entries has to be a
   thing that MUST differ — which house, which container, which id
   prefix, which category seeds — and everything else has to be
   identical, because it is the same code answering.
══════════════════════════════════════════════════════════════════ */
console.log('\n── one cockpit, four roles: what may differ, and what may not');
{
  const roles = ROLES();
  if (roles.length !== 4) bad('EVENT_ROLES has ' + roles.length + ' entries, not four — A16.8 names four roles');
  else ok('all four roles are in the registry: ' + roles.join(', '));

  /* Reachable at all: a nav item that calls the cockpit, and a
     container for it to build into. Retail's item was a label with no
     handler for exactly as long as nothing measured this. */
  roles.forEach(r => {
    const cfg = CFG(r);
    const nav = d.getElementById(cfg.nav), view = d.getElementById(cfg.view);
    if (!nav) bad(r + ': no nav element #' + cfg.nav);
    else if (!/showMyEvents\(/.test(nav.getAttribute('onclick') || ''))
      bad(r + ': the ' + cfg.nav + ' item does not open the cockpit — it is a dead label');
    else if (!view) bad(r + ': no container #' + cfg.view);
    else ok(r + ': ' + cfg.nav + ' opens ' + cfg.view);
  });

  /* THE IDENTITY IS ONE FACT. A second copy of "Weinhaus Müller" in a
     second registry is the duplication invariant 1 is about, one level
     down: the cockpit and the Wine Shows view would disagree about who
     is logged in the day one of them is edited. */
  const split = roles.filter(r => CFG(r).entity !== w.eval('SHOW_ROLES')[r].entity);
  if (split.length) bad('EVENT_ROLES and SHOW_ROLES name different houses for ' + split.join(', '));
  else ok('every role is the same house in both registries');

  /* One tab set, four roles. A per-role list is how "the same product"
     becomes four navigations — D21, before the fact. */
  const tabsOf = r => CFG(r).tabs.map(t => t.key).join(',');
  const odd = roles.filter(r => tabsOf(r) !== tabsOf(roles[0]));
  if (odd.length) bad('these roles have their own tab set: ' + odd.join(', '));
  else ok('one tab set for all four: ' + tabsOf(roles[0]));

  /* And it really builds, for each of them, out of the same shell. */
  roles.forEach(r => {
    w.showMyEvents(r, 'drafts');
    const p = CFG(r).prefix;
    const missing = ['-list-pane', '-detail-pane', '-tabs', '-kpis', '-table']
      .filter(s => !d.getElementById(p + s));
    if (missing.length) bad(r + ': the shell is missing ' + missing.join(', '));
    else ok(r + ': the shell builds — ' + p + '-list-pane and four panes beside it');
  });

  /* The one thing A16.8 DOES let differ, and it differs. "Role
     examples, for fixtures and category seeds" is the only per-role
     vocabulary the section grants. */
  const cats = w.eval('EVENT_CATEGORIES');
  const shared = roles.filter(r => r !== 'distributor' &&
    cats[r].join(',') === cats.distributor.join(','));
  if (!roles.every(r => (cats[r] || []).length)) bad('a role has no category seeds at all');
  else if (shared.length) bad('these roles were handed the distributor list: ' + shared.join(', '));
  else ok('each role offers its own kinds of event (A16.8\'s role table)');

  expectRed('give one role a cockpit of its own', () => {
    const reg = w.eval('EVENT_ROLES'), real = reg.retail.tabs;
    reg.retail.tabs = [{ key:'everything', label:'Everything' }];
    try {
      const t = r => reg[r].tabs.map(x => x.key).join(',');
      const o = Object.keys(reg).filter(r => t(r) !== t('distributor'));
      if (o.length) bad('own tab set: ' + o.join(', '));
    } finally { reg.retail.tabs = real; }
  });
}

/* ══════════════════════════════════════════════════════════════════
   HOSTING IS NOT THE SAME AS BEING ON IT (A16.8).

   The host publishes, invites, opens applications, answers them and is
   the one Bottle Lobby's moderation shortcut is aimed at. Nobody else
   does any of that. A16.8's lifecycle sentence — "the host publishes
   himself" — is a statement about WHO, and a cockpit that offered the
   act to a guest would make it a statement about nothing.

   Measured on the RENDERED pane rather than on a flag, because the
   flag is not what a user clicks.
══════════════════════════════════════════════════════════════════ */
console.log('\n── the host acts, and the invited house answers');
{
  /* Every phrase here is a host act, and each is a real button. */
  const HOST_ACTS = ['Publish this event', 'Withdraw the publication', 'Send invitation',
                     'Allow applications', 'Simulate delisting'];
  const paneText = (role, id) => {
    w.showMyEvents(role, 'upcoming');
    w.openEventDetail(id);
    return d.getElementById(CFG(role).prefix + '-detail-pane').textContent;
  };

  ROLES().forEach(role => {
    const me = CFG(role).entity;
    const mine  = EVENTS().find(e => e.host === me);
    const other = EVENTS().find(e => e.host !== me && w.myEventRow(role, e));
    if (!mine)  { bad(role + ' hosts nothing — the host half is unmeasured for it'); return; }
    if (!other) { bad(role + ' is on nobody else\'s event — the guest half is unmeasured'); return; }

    const guestPane = paneText(role, other.id);
    const leaked = HOST_ACTS.filter(a => guestPane.indexOf(a) !== -1);
    if (leaked.length) bad(role + ' is offered the host\'s acts on ' + other.id + ': ' + leaked.join(', '));
    else if (guestPane.indexOf('Your row') === -1)
      bad(role + ' reads no row of its own on ' + other.id + ' — it is on the event and cannot see so');
    else ok(role + ': on ' + other.id + ' it reads its own row and none of the host\'s acts');

    const hostPane = paneText(role, mine.id);
    if (hostPane.indexOf('Send invitation') === -1)
      bad(role + ' cannot invite anybody to ' + mine.id + ', which it hosts');
    else if (hostPane.indexOf('Your row') !== -1)
      bad(role + ' is shown a guest box on its own event ' + mine.id);
    else ok(role + ': on its own ' + mine.id + ' it hosts — invitations, applications, publishing');
  });

  /* THE NON-RELEASE WORDING REACHES THE GUEST TOO. A16.8's box is a
     rule about what a member event may never look like, and the house
     that was invited is exactly the reader who might otherwise take a
     published event for a released one. */
  const disc = w.eval('MEMBER_EVENT_DISCLAIMER');
  const silent = ROLES().filter(role => {
    const other = EVENTS().find(e => e.host !== CFG(role).entity && w.myEventRow(role, e));
    return other && paneText(role, other.id).indexOf(disc) === -1;
  });
  if (silent.length) bad('the guest pane omits the non-release wording on ' + silent.join(', '));
  else ok('and every guest pane carries the A16.8 wording in full');

  expectRed('let a guest publish somebody else\'s event', () => {
    const real = w.isEventHost;
    w.isEventHost = () => true;
    try {
      ROLES().forEach(role => {
        const other = EVENTS().find(e => e.host !== CFG(role).entity && w.myEventRow(role, e));
        if (!other) return;
        const t = paneText(role, other.id);
        const l = HOST_ACTS.filter(a => t.indexOf(a) !== -1);
        if (l.length) bad(role + ' is offered ' + l.join(', ') + ' on ' + other.id);
      });
    } finally { w.isEventHost = real; }
  });
  ROLES().forEach(r => { w.eval('eventState')[r].openId = null; });
}

/* ══════════════════════════════════════════════════════════════════
   THE FIVE FACTS, ANSWERED FROM THE INVITED HOUSE'S OWN COCKPIT
   (A16.8: invitation · application · acceptance as participant · RSVP
   as guest · attendance).

   Durchgang 7 could only simulate the answer from the host's pane.
   The acts are the same two functions; what is new is that the house
   the answer is ABOUT now reaches them, so this drives the real
   buttons rather than calling the functions — the C8 rule about never
   supplying the event the mechanism should notice, applied to a click.
══════════════════════════════════════════════════════════════════ */
console.log('\n── invitation, acceptance and RSVP, driven from the invited cockpit');
{
  const btn = (role, label) => [...d.getElementById(CFG(role).prefix + '-detail-pane')
    .querySelectorAll('button')].find(b => b.textContent.trim() === label);
  /* Retail is the role with an open invitation in the fixtures:
     Weinhaus Müller is asked to ME-3105 and has not answered. */
  const ROLE = 'retail', ID = 'ME-3105', ME = CFG(ROLE).entity;
  const start = w.myEventRow(ROLE, EV(ID));
  if (!start || start.status !== 'sent')
    bad(ME + ' has no unanswered invitation to ' + ID + ' — the whole section has nothing to drive');
  else {
    ok('the fixture holds one unanswered invitation: ' + ME + ' as ' + start.role + ' on ' + ID);
    if (!w.eventsForTab(ROLE, 'invites').some(e => e.id === ID))
      bad('the invitation is not in the Invitations tab — it cannot be found, so it cannot be answered');
    else ok('and it is in the Invitations & Applications tab, where an answer is owed');

    w.showMyEvents(ROLE, 'invites');
    w.openEventDetail(ID);
    const ordersBefore = w.eval('orders').length, partsBefore = w.eval('partnerships').length;

    const accept = btn(ROLE, 'Accept');
    if (!accept) bad('no Accept button on the invited house\'s own pane');
    else {
      accept.click();
      const p = w.myEventRow(ROLE, EV(ID));
      if (p.status !== 'confirmed')
        bad('accepting as a guest left the row at "' + p.status + '" — a guest invitation accepted IS the RSVP');
      else ok('accepted from its own cockpit: the row is confirmed and holds a place');
      if (!w.eventsForTab(ROLE, 'upcoming').some(e => e.id === ID))
        bad('the accepted event is in no list — the answer led nowhere');
      else ok('and it moved to Upcoming, where the house can see it is going');
    }

    const give = btn(ROLE, 'Give up your place');
    if (!give) bad('no way to give the place back');
    else {
      give.click();
      if (w.myEventRow(ROLE, EV(ID)).status !== 'withdrawn') bad('the place was not given back');
      else ok('and the place goes back to the room — withdrawn, not declined');
      const again = btn(ROLE, 'RSVP — take a place');
      if (!again) bad('a withdrawn guest cannot RSVP again');
      else { again.click();
        if (w.myEventRow(ROLE, EV(ID)).status !== 'confirmed') bad('the second RSVP did not take');
        else ok('and RSVPing again takes a place back'); }
    }

    /* ME-2, one role over: none of that made a transaction. */
    if (w.eval('orders').length !== ordersBefore || w.eval('partnerships').length !== partsBefore)
      bad('answering an invitation created an order or a partnership (ME-2)');
    else ok('and none of it created an order or a partnership (' + ordersBefore + ' orders, ' +
            partsBefore + ' partnerships, unchanged)');

    expectRed('let an accepted invitation write an order', () => {
      const o = w.eval('orders'), n = o.length;
      o.push({ id:'ORD-9999', buyer:ME, note:'from ' + ID });
      try { if (o.length !== n) bad('orders grew'); } finally { o.pop(); }
    });
  }
  ROLES().forEach(r => { w.eval('eventState')[r].openId = null; });
}

/* ══════════════════════════════════════════════════════════════════
   THE TYPED DUPLICATE A16.8 NAMES BY NAME.

   "Cantina Rossi Tasting" existed twice, with two different dates, on
   two hardcoded surfaces and with no shared record — and A16.8 leaves
   it to the fixture to decide what the evening actually is. It did:
   ME-3101, hosted by Weinhaus Müller, with Hawesko on it as a guest.
   A second surface claiming the same evening under a different host is
   the copy ME-1 forbids, so the typed row is gone rather than rebuilt.

   Measured on rendered TEXT — what a reader sees — and the two
   `<script>` blocks are cut out first. Not a convenience: the page
   EXPLAINS the removal in a comment that names the phrase, and script
   text is part of `textContent`, so without the cut this check would
   be failed by its own documentation.
══════════════════════════════════════════════════════════════════ */
console.log('\n── the evening with two hosts now has one');
{
  const GONE = 'Cantina Rossi Tasting';
  const visible = () => {
    const clone = d.body.cloneNode(true);
    [...clone.querySelectorAll('script,style')].forEach(n => n.remove());
    return clone.textContent;
  };
  if (visible().indexOf(GONE) !== -1)
    bad('"' + GONE + '" is still typed onto a dashboard surface — no record backs it');
  else ok('"' + GONE + '" appears on no dashboard surface');

  const real = EVENTS().filter(e => (e.participants || [])
    .some(p => p.stakeholder === 'Cantina Rossi' && p.role !== 'host') &&
    e.host === 'Weinhaus Müller');
  if (real.length !== 1) bad('the evening the fixture decided on is in ' + real.length + ' records, not one');
  else ok('the evening is one record: ' + real[0].id + ', hosted by ' + real[0].host +
          ', with Cantina Rossi on it');

  expectRed('type the evening back onto a surface', () => {
    const div = d.createElement('div');
    div.textContent = GONE;
    d.body.appendChild(div);
    try { if (visible().indexOf(GONE) !== -1) bad('typed row present'); }
    finally { d.body.removeChild(div); }
  });
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

  /* ON THE FOUR RENDERED DISCOVER PANES, not only on the card in
     isolation. A16.14d lets the two kinds share a directory; A16.8
     forbids them sharing a promise — and a promise is broken on a
     SURFACE. A role whose pane rendered the sort under the Wine Shows
     heading, or with no heading at all, would put a self-published
     evening under the platform's guarantee without any card having
     changed. */
  ROLES().forEach(role => {
    const found = w.discoverEvents(role);
    const text  = discoverText(role);
    if (!found.length) { bad(role + ': no member event is findable at all — its Discover sort is unmeasured'); return; }
    const shown = found.filter(e => text.indexOf(e.title) !== -1);
    if (shown.length !== found.length)
      bad(role + ': ' + (found.length - shown.length) + ' findable event(s) are on no card');
    else if (text.indexOf('Member Events') === -1)
      bad(role + ': the events are rendered under no heading of their own');
    else if (text.indexOf(disc) === -1)
      bad(role + ': the member-event sort carries no non-release wording');
    else if (MARKERS.some(m => text.replace(/&nbsp;/g, ' ').indexOf(m.replace(/&nbsp;/g, ' ')) !== -1) &&
             !w.discoverShows(role).length)
      bad(role + ': a guarantee phrase is on a pane that has no released show to earn it');
    else ok(role + ': ' + found.length + ' member event(s) on their own cards, under their own heading');
  });

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
  const stillThere = ROLES().filter(r => w.discoverEvents(r).some(e => e.id === 'ME-3103'));
  if (stillThere.length) bad('a delisted event is still in the directory of ' + stillThere.join(', '));
  else ok('and it is off the directory of all ' + ROLES().length + ' roles — including its own host\'s');

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

/* ══════════════════════════════════════════════════════════════════
   WINES & PROGRAM — THE HOST DECIDES, OUT OF HIS OWN BOOK (A16.8).
   Member events do not follow the Wine Show model here: no proposal
   loop, no per-wine status. The host names wines from his OWN current
   range — winery: own catalogue rows · distributor: Wine Portfolio ·
   restaurant: Wine List · retail: Wine Selection — and what lands on
   the record is a productId reference and nothing else (ME-6).

   PRODUCT CHOICE AND PARTICIPATION ARE TWO FACTS, asserted in both
   directions: a chosen wine adds no participant, an accepted
   winemaker adds no wine. ME-3101's fixture rows OUTSIDE the retail
   host's selection stay untouched — they are the accepted guest
   winemaker's wines, named once by the host, and automating that case
   is deliberately not built (Durchgang 9's own scope line).
══════════════════════════════════════════════════════════════════ */
console.log('\n── Wines & Program: the host names wines, and only out of his own range');
{
  const paneBtn = (role, label) => [...d.getElementById(CFG(role).prefix + '-detail-pane')
    .querySelectorAll('button')].find(b => b.textContent.trim() === label);
  const openMine = role => {
    const mine = EVENTS().find(e => e.host === CFG(role).entity);
    w.showMyEvents(role, 'drafts');
    w.openEventDetail(mine.id);
    return mine;
  };
  const pickerCheck = role => {
    const mine = openMine(role);
    const sel = d.getElementById(CFG(role).prefix + '-wine-add');
    const book = w.eventAssortment(role).map(x => x.id);
    const chosen = (mine.products || []).map(x => x.productId);
    const eligible = book.filter(id => chosen.indexOf(id) === -1);
    if (!book.length) { bad(role + ': its own book is empty — nothing is measured'); return; }
    if (!sel) {
      if (eligible.length) bad(role + ': no picker although ' + eligible.length + ' own wine(s) are unchosen');
      else ok(role + ': whole range already on the program, and the pane says so');
      return;
    }
    const opts = [...sel.options].map(o => o.value);
    const alien = opts.filter(id => book.indexOf(id) === -1);
    const dupes = opts.filter(id => chosen.indexOf(id) !== -1);
    if (alien.length) bad(role + ': the picker offers wines outside the own book — ' + alien.join(', '));
    else if (dupes.length) bad(role + ': the picker re-offers wines already on the program');
    else ok(role + ': the picker is exactly the own range minus the chosen (' + opts.length + ' option(s))');
  };
  ROLES().forEach(pickerCheck);

  /* The mutation widens what the RENDERER reads, and the check compares
     the rendered options against the real book — widening both sides at
     once would compare the mutation with itself and stay green. */
  expectRed('widen the picker to the whole catalogue', () => {
    const real = w.eventAssortment;
    w.eventAssortment = () => w.allProducts();
    try { openMine('retail'); } finally { w.eventAssortment = real; }
    const sel = d.getElementById(CFG('retail').prefix + '-wine-add');
    const book = real('retail').map(x => x.id);
    const alien = [...sel.options].map(o => o.value).filter(id => book.indexOf(id) === -1);
    if (alien.length) bad('the picker offers wines outside the own book — ' + alien.length + ' of them');
  });

  /* The add, as a CLICK. Retail's own selection is PRD-1020/1021/1022;
     ME-3101 already names PRD-1022, so the picker holds the other two. */
  const ROLE = 'retail';
  const ev = openMine(ROLE);
  const pick = d.getElementById(CFG(ROLE).prefix + '-wine-add');
  const partsBefore  = JSON.stringify(ev.participants);
  const ordersBefore = w.eval('orders').length;
  const countBefore  = (ev.products || []).length;
  const target = pick.options[0].value;
  pick.value = target;
  paneBtn(ROLE, 'Add to the program').click();

  const row = ev.products[ev.products.length - 1];
  if (ev.products.length !== countBefore + 1 || row.productId !== target)
    bad('the click did not put the chosen wine on the program');
  else if (Object.keys(row).join(',') !== 'productId')
    bad('the new row carries more than the reference: ' + Object.keys(row).join(', '));
  else ok('one click, one new row, and it is {productId} and nothing else (' + target + ')');

  const producer = w.wineByRef(target).winery;
  if (JSON.stringify(ev.participants) !== partsBefore)
    bad('choosing a wine changed the participants');
  else if (w.eventParticipant(ev, producer))
    bad('choosing ' + target + ' put its producer ' + producer + ' on the event');
  else ok('and ' + producer + ', whose wine it is, is on no participant row because of it');
  if (w.eval('orders').length !== ordersBefore) bad('choosing a wine created an order');
  else ok('and no order came out of it (' + ordersBefore + ' unchanged)');

  expectRed('let a chosen wine bring its producer onto the event', () => {
    const real = w.addEventProduct;
    const partsSnap = JSON.stringify(ev.participants);
    const prodCount = ev.products.length;
    w.addEventProduct = (id, pid) => {
      real(id, pid);
      EVENTS().find(x => x.id === id).participants.push({
        stakeholder: w.wineByRef(pid).winery, role:'winemaker',
        source:'invitation', status:'accepted', requestedAt:'2026-08-08' });
    };
    try {
      /* PRD-1021 is in the retail book and definitely not yet chosen. */
      w.addEventProduct(ev.id, 'PRD-1021');
      if (JSON.stringify(ev.participants) !== partsSnap) bad('participants changed');
    } finally {
      w.addEventProduct = real;
      ev.participants = JSON.parse(partsSnap);
      ev.products.length = prodCount;
      w.refreshEvents();
    }
  });

  /* Outside the own range: refused by the function AND absent from the
     picker. PRD-1002 is real, resolvable — and Cantina Rossi's, not in
     any retail selection. */
  const foreignBefore = ev.products.length;
  w.addEventProduct(ev.id, 'PRD-1002');
  if (ev.products.length !== foreignBefore) bad('a wine outside the own range was added');
  else ok('PRD-1002 — real, but outside the own range — is refused');
  if ([...d.getElementById(CFG(ROLE).prefix + '-wine-add').options].some(o => o.value === 'PRD-1002'))
    bad('and yet the picker offers it');
  else ok('and the picker never offered it');

  /* The remove, as a click on the row the add created. */
  const removeBtn = [...d.getElementById(CFG(ROLE).prefix + '-detail-pane')
    .querySelectorAll('.odt-kv')].filter(kv => kv.textContent.indexOf(target) !== -1)
    .map(kv => [...kv.querySelectorAll('button')].find(b => b.textContent.trim() === 'Remove'))
    .filter(Boolean)[0];
  if (!removeBtn) bad('the host has no way to take ' + target + ' off the program again');
  else {
    removeBtn.click();
    if (ev.products.length !== countBefore) bad('the remove did not restore the program');
    else if (JSON.stringify(ev.participants) !== partsBefore) bad('removing a wine changed the participants');
    else ok('one click removes it again, participants untouched — the fixture state is restored');
  }

  /* The other direction: an accepted winemaker brings no wines along.
     Henri Dubois Domaine holds ME-3103's one unanswered exhibitor
     invitation; the status is put back afterwards so the fixture keeps
     carrying an open invitation for everything after this file. */
  const fair = EV('ME-3103');
  const hdd = fair.participants.find(x => x.stakeholder === 'Henri Dubois Domaine');
  if (!hdd || hdd.status !== 'sent') bad('ME-3103 no longer holds the unanswered exhibitor invitation');
  else {
    const winesBefore = JSON.stringify(fair.products);
    w.respondToEventInvite('ME-3103', 'Henri Dubois Domaine', 'accept');
    if (hdd.status !== 'accepted') bad('the acceptance did not land');
    else if (JSON.stringify(fair.products) !== winesBefore)
      bad('accepting as exhibitor changed the Wines & Program list');
    else ok('Henri Dubois accepts as exhibitor and the program does not move — participation adds no wine');
    hdd.status = 'sent';
    w.refreshEvents();
  }

  ROLES().forEach(r => { w.eval('eventState')[r].openId = null; });
}

console.log(fail ? '\n' + fail + ' failure(s)' : '\nmember events: all checks passed');
process.exit(fail ? 1 : 0);
