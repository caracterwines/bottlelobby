/* ═══════════════════════════════════════════════════════════════════
   CAMPAIGNS — A16.14e, ME-4, D43
   -------------------------------------------------------------------
   One mechanism, two carrier kinds, and almost everything it promises
   is an ABSENCE: no foreign community in an audience, no send without
   a confirmation, no name on any surface, no side effect on any other
   collection. As in tests/member-events.js, every invariant is
   measured twice:

     · the CLAIM: the rule holds;
     · the COUNTER-MUTATION: the state or the function is changed so
       that the rule is broken, the same check runs again, and it MUST
       come back red.

   The audiences asserted here are DERIVED in the fixture comments in
   assets/bottle-lobby-data.js, not invented for the test — a mutation
   that relies on a fixture holds only while the fixture happens to
   fit (C7), which is why the mutations below re-run the page's own
   resolvers rather than comparing against retyped lists twice.
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

/* Read from the page, never retyped. */
const CAMPS   = () => w.eval('eventCampaigns');
const EV      = id => w.eval('memberEvents').find(e => e.id === id);
const SHOW    = id => w.eval('wineShows').find(s => s.id === id);
const ANN     = (t, id, p) => w.eval('announcementAudience(' + JSON.stringify(t) + ', campaignSubject(' + JSON.stringify(t) + ',' + JSON.stringify(id) + '), ' + !!p + ')');
const REM     = (t, id) => w.eval('reminderAudience(' + JSON.stringify(t) + ', campaignSubject(' + JSON.stringify(t) + ',' + JSON.stringify(id) + '))');
const PERM    = (t, id, k) => w.eval('campaignPermission(' + JSON.stringify(t) + ', campaignSubject(' + JSON.stringify(t) + ',' + JSON.stringify(id) + '), ' + JSON.stringify(k) + ')');
const same    = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/* The counters a send must never move (ME-2 one mechanism over):
   participations/invitations/RSVPs/applications are participant rows,
   a show's are exhibitor and attendee rows; orders and partnerships
   are their own books. */
function sideEffectCounters() {
  return {
    participants: w.eval('memberEvents.reduce(function(n,e){return n+(e.participants||[]).length;},0)'),
    showRows:     w.eval('wineShows.reduce(function(n,s){return n+(s.exhibitors||[]).length+(s.attendees||[]).length;},0)'),
    orders:       w.eval('orders.length'),
    partnerships: w.eval('partnerships.length')
  };
}

/* ══════════════════════════════════════════════════════════════════
   1. The snapshot — deduplicated, frozen, derived (ME-4)
══════════════════════════════════════════════════════════════════ */
console.log('── the snapshot is deduplicated, frozen, and derived');
{
  const c = CAMPS().find(x => x.id === 'CMP-4001');
  if (!c) bad('the fixture campaign CMP-4001 is missing');
  else {
    if (c.subjectType !== 'event' || c.subjectId !== 'ME-3103')
      bad('CMP-4001 does not sit on ME-3103');
    else if (EV('ME-3103').status !== 'published')
      bad('CMP-4001 sits on a carrier that is not in an allowed stage');
    else ok('the fixture announcement sits on a published carrier (S4)');

    const dupes = c.recipients.filter((n, i) => c.recipients.indexOf(n) !== i);
    if (dupes.length) bad('the stored snapshot carries duplicates: ' + dupes.join(', '));
    else ok('the stored snapshot is deduplicated (' + c.recipients.length + ' names, all distinct)');

    const live = ANN('event', 'ME-3103', true);
    if (!same(live, c.recipients))
      bad('the snapshot does not match its own derivation: stored ' + JSON.stringify(c.recipients) +
          ', derived ' + JSON.stringify(live));
    else ok('the snapshot equals what the resolver derives today — stored because sent, not because underivable');

    /* Frozen: a graph change after the send changes the DERIVATION,
       never the sent record. */
    const before = c.recipients.slice();
    w.eval('wineFollowGraph.push({ follower:"Casa Elena", winery:"Hawesko GmbH", at:"2026-08-06" })');
    if (!same(CAMPS().find(x => x.id === 'CMP-4001').recipients, before))
      bad('a follow edge added AFTER the send changed a sent snapshot');
    else ok('a later graph change does not touch a sent snapshot (frozen at send)');
    w.eval('wineFollowGraph.pop()');

    expectRed('a snapshot that re-resolves on read', () => {
      const frozen = c.recipients;
      Object.defineProperty(c, 'recipients', {
        configurable: true,
        get() { return w.eval('announcementAudience("event", campaignSubject("event","ME-3103"), true)').concat(['Casa Elena']); }
      });
      w.eval('wineFollowGraph.push({ follower:"Casa Elena", winery:"Hawesko GmbH", at:"2026-08-06" })');
      if (!same(CAMPS().find(x => x.id === 'CMP-4001').recipients, before))
        bad('red as intended');
      w.eval('wineFollowGraph.pop()');
      Object.defineProperty(c, 'recipients', { configurable: true, value: frozen, writable: true });
    });

    expectRed('a filter that stops deduplicating', () => {
      w.eval('window.__origCAF = campaignAudienceFilter;' +
        'campaignAudienceFilter = function (st, s, names, kind) {' +
        '  var host = campaignHostOf(st, s), out = [];' +
        '  names.forEach(function (n) {' +
        '    if (n === host) return;' +
        '    if (suppressed(n, host, kind)) return;' +
        '    if (!carrierAdmitsRecipient(st, s, n)) return;' +
        '    out.push(n);' +
        '  });' +
        '  return out;' +
        '}');
      const mutant = ANN('event', 'ME-3103', true);
      const md = mutant.filter((n, i) => mutant.indexOf(n) !== i);
      if (md.length) bad('red as intended: ' + md.join(', '));
      w.eval('campaignAudienceFilter = window.__origCAF; delete window.__origCAF');
    });
  }
}

/* ══════════════════════════════════════════════════════════════════
   2. The announcement audience — own fans, optionally own partners,
      and structurally nothing wider (S2, D43)
══════════════════════════════════════════════════════════════════ */
console.log('\n── the announcement audience is the host\'s own graph, nothing wider');
{
  /* Derived in the fixture comment: 10 candidates → 1 suppressed →
     4 fail the Germany narrowing without a row of their own. */
  const withPartners = ANN('event', 'ME-3103', true);
  if (!same(withPartners, ['Cantina Rossi', 'Domaine Lefèvre', 'Henri Dubois Domaine',
                           'Weingut Schmitt', 'Weinhaus Müller']))
    bad('fans + own partners on ME-3103 resolved to ' + JSON.stringify(withPartners));
  else ok('fans + own active partners, deduplicated, suppressed and invisible houses removed (ME-3103 → 5)');

  if (withPartners.indexOf('Château Belrieu') !== -1)
    bad('Château Belrieu is in the audience although ME-3103\'s Germany narrowing hides the event from it');
  else ok('a fan the carrier is invisible to is not addressed (C9 condition 3 at resolve time)');

  const fansOnly = ANN('event', 'ME-3105', false);
  if (!same(fansOnly, ['Osteria Marconi']))
    bad('fans-only on ME-3105 resolved to ' + JSON.stringify(fansOnly) + ' — expected the one unsuppressed fan');
  else ok('fans only when partners are not included (ME-3105 → Osteria Marconi alone)');

  /* The host follows Henri Dubois, Weinhaus Müller and Osteria
     Marconi (outgoing edges). On the open WS-2603 nothing hides them
     — only the audience rule keeps them out. */
  const open = ANN('show', 'WS-2603', false);
  if (!same(open, ['Cantina Rossi', 'Château Belrieu']))
    bad('fans-only on the published WS-2603 resolved to ' + JSON.stringify(open));
  else ok('on a fully public carrier the audience is still only the fans (WS-2603 → 2)');
  if (open.indexOf('Osteria Marconi') !== -1 || open.indexOf('Henri Dubois Domaine') !== -1)
    bad('an account the host merely FOLLOWS was addressed — outgoing edges are not consent (A7)');
  else ok('outgoing edges (My Stars) are not an audience');

  /* Structural subset: every resolved name is a fan or an own active
     partner of the host — on every carrier that can announce. */
  const carriers = [['event', 'ME-3103'], ['event', 'ME-3105'], ['event', 'ME-3101'],
                    ['event', 'ME-3102'], ['show', 'WS-2603'], ['show', 'WS-2601']];
  let breach = null;
  carriers.forEach(([t, id]) => {
    const host = w.eval('campaignHostOf(' + JSON.stringify(t) + ', campaignSubject(' + JSON.stringify(t) + ',' + JSON.stringify(id) + '))');
    const legal = w.eval('fansOf(' + JSON.stringify(host) + ').concat(activePartnersOf(' + JSON.stringify(host) + '))');
    ANN(t, id, true).forEach(n => { if (legal.indexOf(n) === -1) breach = id + ' → ' + n; });
  });
  if (breach) bad('an audience member outside fans ∪ own partners: ' + breach);
  else ok('every resolved recipient is a fan or an own active partner, on all six announceable carriers');

  expectRed('outgoing edges mixed into the fan list', () => {
    w.eval('window.__origFans = fansOf;' +
      'fansOf = function (entity) {' +
      '  var seen = {}, out = [];' +
      '  wineFollowGraph.forEach(function (f) {' +
      '    var n = f.winery === entity ? f.follower : (f.follower === entity ? f.winery : null);' +
      '    if (!n || seen[n]) return; seen[n] = 1; out.push(n);' +
      '  });' +
      '  return out;' +
      '}');
    if (!same(ANN('show', 'WS-2603', false), ['Cantina Rossi', 'Château Belrieu'])) bad('red as intended');
    w.eval('fansOf = window.__origFans; delete window.__origFans');
  });

  expectRed('a participant\'s community mixed into the audience', () => {
    w.eval('window.__origAnn = announcementAudience;' +
      'announcementAudience = function (st, s, inc) {' +
      '  var host = campaignHostOf(st, s);' +
      '  var names = fansOf(host).concat(inc ? activePartnersOf(host) : []);' +
      '  names = names.concat(fansOf("Cantina Rossi"));' +   /* the exhibitor's fans */
      '  return campaignAudienceFilter(st, s, names, "announcement");' +
      '}');
    if (!same(ANN('show', 'WS-2603', false), ['Cantina Rossi', 'Château Belrieu'])) bad('red as intended');
    w.eval('announcementAudience = window.__origAnn; delete window.__origAnn');
  });

  expectRed('a role group mixed into the audience', () => {
    w.eval('window.__origAnn = announcementAudience;' +
      'announcementAudience = function (st, s, inc) {' +
      '  var host = campaignHostOf(st, s);' +
      '  var names = fansOf(host).concat(inc ? activePartnersOf(host) : []);' +
      '  names = names.concat(stakeholders.map(function (x) { return x.name; }));' +
      '  return campaignAudienceFilter(st, s, names, "announcement");' +
      '}');
    if (!same(ANN('show', 'WS-2603', false), ['Cantina Rossi', 'Château Belrieu'])) bad('red as intended');
    w.eval('announcementAudience = window.__origAnn; delete window.__origAnn');
  });
}

/* ══════════════════════════════════════════════════════════════════
   3. ONE suppression resolver, three kinds, each one subtracting (S1)
══════════════════════════════════════════════════════════════════ */
console.log('\n── each of the three suppression kinds is subtracted, by one resolver');
{
  const crAnn = ANN('event', 'ME-3105', false);

  if (w.eval('fansOf("Cantina Rossi")').indexOf('Vinoteca Roma') === -1)
    bad('the block fixture lost its follow edge — the check below would pass emptily');
  else if (crAnn.indexOf('Vinoteca Roma') !== -1)
    bad('a BLOCK did not subtract: Vinoteca Roma is addressed by the estate it blocked');
  else ok('block: Vinoteca Roma follows the estate and is still not addressed');

  if (crAnn.indexOf('Weinhaus Müller') !== -1)
    bad('an UNSUBSCRIBE did not subtract from the announcement');
  else ok('unsubscribe: Weinhaus Müller follows the estate and is not in its announcement');
  const crRem = REM('event', 'ME-3105');
  if (crRem.indexOf('Weinhaus Müller') !== -1)
    bad('an UNSUBSCRIBE covering both kinds did not subtract from the reminder — the open invitation was addressed');
  else ok('unsubscribe covers both kinds: the open ME-3105 invitation is not reminded');
  if (!same(crRem, ['Hawesko GmbH']))
    bad('ME-3105 reminder resolved to ' + JSON.stringify(crRem));
  else ok('the suppression removes the recipient, never the relation — the confirmed guest remains');

  if (ANN('show', 'WS-2603', false).indexOf('Bistro Laurent') !== -1)
    bad('a PREFERENCE against announcements did not subtract');
  else ok('preference: Bistro Laurent is in no announcement audience of anybody');
  if (REM('show', 'WS-2603').indexOf('Bistro Laurent') === -1)
    bad('a preference scoped to announcements suppressed a reminder too — the campaignKind scope is dead');
  else ok('the same house, the same sender, the other kind: the reminder still reaches it (kind scope)');

  if (CAMPS().find(x => x.id === 'CMP-4001').recipients.indexOf('Weinhaus Müller') === -1)
    bad('an unsubscribe scoped to one sender suppressed another sender\'s campaign');
  else ok('sender scope: the Cantina Rossi unsubscribe does not touch Hawesko\'s audience');

  [['block', 'Vinoteca Roma', () => ANN('event', 'ME-3105', false)],
   ['unsubscribe', 'Weinhaus Müller', () => ANN('event', 'ME-3105', false)],
   ['preference', 'Bistro Laurent', () => ANN('show', 'WS-2603', false)]
  ].forEach(([kind, name, resolve]) => {
    expectRed('the resolver ignores kind "' + kind + '"', () => {
      w.eval('window.__origSup = suppressed;' +
        'suppressed = function (recipient, sender, campaignKind) {' +
        '  return communicationSuppressions.some(function (s) {' +
        '    if (s.kind === ' + JSON.stringify(kind) + ') return false;' +
        '    if (s.recipient !== recipient) return false;' +
        '    if (s.sender && s.sender !== sender) return false;' +
        '    if (s.campaignKind && s.campaignKind !== campaignKind) return false;' +
        '    return true;' +
        '  });' +
        '}');
      if (resolve().indexOf(name) !== -1) bad('red as intended');
      w.eval('suppressed = window.__origSup; delete window.__origSup');
    });
  });
}

/* ══════════════════════════════════════════════════════════════════
   4. The reminder audience — those on it plus open invitations,
      and the exclusion list (S3)
══════════════════════════════════════════════════════════════════ */
console.log('\n── the reminder audience never re-resolves a community');
{
  const r1 = REM('event', 'ME-3101');
  if (!same(r1, ['Cantina Rossi', 'Hawesko GmbH', 'Bistro Laurent']))
    bad('ME-3101 reminder resolved to ' + JSON.stringify(r1));
  else ok('accepted winemaker + confirmed guest + open (viewed) invitation, and never the host (ME-3101 → 3)');

  const r2 = REM('event', 'ME-3102');
  if (r2.indexOf('Château Belrieu') !== -1)
    bad('an APPLICANT is reminded — an unanswered application is a question, not a participation');
  else ok('applicants are excluded (ME-3102: Château Belrieu applied, is not reminded)');
  if (r2.indexOf('Vinstuen København') !== -1)
    bad('a DECLINED house is reminded');
  else ok('the declined are excluded (ME-3102: Vinstuen København said no)');

  const r3 = REM('show', 'WS-2603');
  if (!same(r3, ['Henri Dubois Domaine', 'Weingut Schmitt', 'Bistro Laurent',
                 'Restaurant Hafenkante', 'Vinoteca Alster']))
    bad('WS-2603 reminder resolved to ' + JSON.stringify(r3));
  else ok('a show reminds confirmed exhibitors and confirmed attendees (WS-2603 → 5)');
  if (r3.indexOf('Weinhaus Müller') !== -1)
    bad('a show APPLICANT (`requested`) is reminded');
  else ok('a `requested` seat is an application and is excluded (WS-2603: Weinhaus Müller)');

  /* WS-2604 has a venue and nobody else: empty exhibitors, empty
     attendees, venueEntity Bistro Laurent. The empty answer is the
     rule — providing the room is not being on the guest list, so a
     venue WITHOUT an explicit participation row is not addressed. */
  const s4 = SHOW('WS-2604');
  if (!s4 || s4.venueEntity !== 'Bistro Laurent' || (s4.exhibitors || []).length || (s4.attendees || []).length)
    bad('WS-2604 no longer carries the venue-and-nobody-else shape this check relies on (C7)');
  else if (REM('show', 'WS-2604').length !== 0)
    bad('WS-2604 reminds somebody — its venue has no participation row and nobody else is on it');
  else ok('a venue without an explicit participation row is not addressed (WS-2604 → 0, and 0 is the rule)');

  /* The excluded statuses, proven by moving one row through them. */
  const row = EV('ME-3101').participants.find(p => p.stakeholder === 'Bistro Laurent');
  ['applied', 'declined', 'withdrawn', 'no_show'].forEach(st => {
    row.status = st;
    if (REM('event', 'ME-3101').indexOf('Bistro Laurent') !== -1)
      bad('a participant in status "' + st + '" is reminded');
    else ok('status "' + st + '" is excluded from the reminder');
  });
  row.status = 'viewed';

  /* The community is not consulted: a new fan of the host changes an
     announcement and never a reminder. */
  w.eval('wineFollowGraph.push({ follower:"Casa Elena", winery:"Weinhaus Müller", at:"2026-08-06" })');
  if (!same(REM('event', 'ME-3101'), ['Cantina Rossi', 'Hawesko GmbH', 'Bistro Laurent']))
    bad('a follow edge changed a reminder audience — the community was re-resolved');
  else ok('a new fan of the host changes no reminder — the community is never consulted');
  w.eval('wineFollowGraph.pop()');

  expectRed('the host\'s fans mixed into the reminder', () => {
    w.eval('window.__origRem = reminderAudience;' +
      'reminderAudience = function (st, s) {' +
      '  var names = window.__origRem === undefined ? [] : [];' +
      '  return campaignAudienceFilter(st, s, fansOf(campaignHostOf(st, s)).concat(' +
      '    window.__remNames(st, s)), "reminder");' +
      '};' +
      'window.__remNames = function (st, s) {' +
      '  var names = [];' +
      '  if (st === "show") {' +
      '    (s.exhibitors || []).forEach(function (x) { if (x.status === "confirmed" || x.status === "invited") names.push(x.producer); });' +
      '    (s.attendees || []).forEach(function (a) { if (a.status === "confirmed" || a.status === "invited") names.push(a.stakeholder); });' +
      '  } else (s.participants || []).forEach(function (p) {' +
      '    if (p.role === "host") return;' +
      '    if (["accepted","confirmed","sent","viewed"].indexOf(p.status) !== -1) names.push(p.stakeholder);' +
      '  });' +
      '  return names;' +
      '}');
    if (same(REM('show', 'WS-2603'), ['Henri Dubois Domaine', 'Weingut Schmitt', 'Bistro Laurent',
                                      'Restaurant Hafenkante', 'Vinoteca Alster'])) { /* stayed green */ }
    else bad('red as intended');
    w.eval('reminderAudience = window.__origRem; delete window.__origRem; delete window.__remNames');
  });

  expectRed('applicants included in the reminder', () => {
    w.eval('window.__origRem = reminderAudience;' +
      'reminderAudience = function (st, s) {' +
      '  var names = [];' +
      '  if (st === "show") {' +
      '    (s.exhibitors || []).forEach(function (x) { names.push(x.producer); });' +
      '    (s.attendees || []).forEach(function (a) { names.push(a.stakeholder); });' +
      '  } else (s.participants || []).forEach(function (p) { if (p.role !== "host") names.push(p.stakeholder); });' +
      '  return campaignAudienceFilter(st, s, names, "reminder");' +
      '}');
    if (REM('event', 'ME-3102').indexOf('Château Belrieu') === -1) { /* stayed green */ }
    else bad('red as intended');
    w.eval('reminderAudience = window.__origRem; delete window.__origRem');
  });
}

/* ══════════════════════════════════════════════════════════════════
   5. Stages — computed permissibility, named reason (S4)
══════════════════════════════════════════════════════════════════ */
console.log('\n── an announcement needs an upcoming, visible carrier; a reminder one still to come');
{
  const p1 = PERM('show', 'WS-2599', 'announcement');
  if (p1.ok || !/Completed/.test(p1.reason)) bad('a completed show may announce, or the reason does not name the stage');
  else ok('no announcement on a completed show, and the refusal names the stage');
  const p2 = PERM('show', 'WS-2599', 'reminder');
  if (p2.ok || !/over/.test(p2.reason)) bad('a completed show may remind, or the reason does not say it is over');
  else ok('no reminder on a carrier that is over, with the reason named');
  const p3 = PERM('show', 'WS-2602', 'announcement');
  if (p3.ok) bad('a show in Final Review may announce');
  else ok('no announcement in pending_approval (' + p3.reason.slice(0, 40) + '…)');
  if (!PERM('show', 'WS-2602', 'reminder').ok)
    bad('a show in Final Review may not remind — but its confirmed houses are exactly who a date note is for');
  else ok('a reminder is allowed where the carrier is merely not yet released');
  const p4 = PERM('event', 'ME-3104', 'announcement');
  if (p4.ok) bad('a draft event may announce');
  else ok('no announcement on a draft event (' + p4.reason.slice(0, 40) + '…)');
  if (!PERM('show', 'WS-2601', 'announcement').ok)
    bad('a planning show may not announce — planning is a listable, recruiting stage');
  else ok('planning and published are the announceable show stages');

  /* postponed is announceable; delisted is not; a past date is not. */
  const ev = EV('ME-3103');
  ev.status = 'postponed';
  if (!PERM('event', 'ME-3103', 'announcement').ok) bad('a postponed event may not announce');
  else ok('a postponed event may announce — it is published and coming, only later');
  ev.status = 'published';
  ev.moderation = { status:'delisted', by:'Bottle Lobby', at:'2026-08-06', reason:'test' };
  if (PERM('event', 'ME-3103', 'announcement').ok)
    bad('a DELISTED event may announce — "visible carrier" is not checked');
  else ok('a delisted event may not announce (visible means visible, not merely published)');
  ev.moderation = null;
  const realDate = ev.date;
  ev.date = '2026-01-10';
  if (PERM('event', 'ME-3103', 'announcement').ok)
    bad('an announcement on a PAST date is allowed — "upcoming" is not checked');
  else ok('a past date refuses an announcement, with the reason named');
  ev.date = realDate;

  /* A refused stage refuses the SEND, not only the button. */
  const n = CAMPS().length;
  const r = w.eval('sendCampaign("event", "ME-3104", "announcement", false, "x")');
  if (r.ok || CAMPS().length !== n)
    bad('a send on a refused carrier wrote something');
  else ok('sendCampaign() on a refused carrier writes nothing and returns the named reason');

  /* Adding 'draft' to CAMPAIGN_EVENT_STATUS alone stays refused —
     eventListable() is a second, independent gate. The counter-
     mutation therefore breaks the permission itself: a check that
     cannot see THAT failing proves nothing. */
  expectRed('the stage permission stops refusing', () => {
    w.eval('window.__origPerm = campaignPermission; campaignPermission = function () { return { ok:true }; }');
    if (PERM('event', 'ME-3104', 'announcement').ok) bad('red as intended');
    w.eval('campaignPermission = window.__origPerm; delete window.__origPerm');
  });
}

/* ══════════════════════════════════════════════════════════════════
   6. The volume limit — full rejection, never a partial send (S5)
══════════════════════════════════════════════════════════════════ */
console.log('\n── crossing the limit rejects the send in full');
{
  const n = CAMPS().length;
  w.eval('CAMPAIGN_MAX_RECIPIENTS = 2');
  const r = w.eval('sendCampaign("show", "WS-2603", "reminder", false, "moved to 19:00")');
  if (r.ok) bad('a send over the limit went through');
  else if (!/limit of 2/.test(r.reason) || !/in full/.test(r.reason))
    bad('the rejection does not name the limit and the full refusal: ' + r.reason);
  else ok('5 recipients against a limit of 2: rejected, with the limit named');
  if (CAMPS().length !== n)
    bad('a rejected send left a campaign row behind');
  else ok('no partial send: no campaign row, no capped snapshot, nothing');
  w.eval('CAMPAIGN_MAX_RECIPIENTS = 200');

  expectRed('the limit stops binding', () => {
    w.eval('CAMPAIGN_MAX_RECIPIENTS = 2000');
    const rr = w.eval('sendCampaign("show", "WS-2603", "reminder", false, "x")');
    if (rr.ok) {
      bad('red as intended');
      w.eval('eventCampaigns.pop(); campaignSeq--');
    }
    w.eval('CAMPAIGN_MAX_RECIPIENTS = 200');
  });
}

/* ══════════════════════════════════════════════════════════════════
   7. The UI path — preview, EXPLICIT confirmation, and nothing else
      sends (A16.14e)
══════════════════════════════════════════════════════════════════ */
console.log('\n── nothing is sent without the explicit confirmation');
{
  w.showMyEvents('distributor');
  w.openEventDetail('ME-3103');
  const pane = d.getElementById('devent-detail-pane');
  const boxOf = () => Array.from(pane.querySelectorAll('.odt-box'))
    .find(b => (b.querySelector('.odt-box-head') || {}).textContent === 'Campaigns');
  let box = boxOf();
  if (!box) bad('the host detail pane has no Campaigns box');
  else ok('the campaign surface sits in the host detail pane');

  const n0 = CAMPS().length;
  const msg = d.getElementById('devent-camp-msg');
  if (msg) msg.value = 'See you in the Speicherstadt';
  const prevBtn = box && Array.from(box.querySelectorAll('button')).find(b => /Preview/.test(b.textContent));
  if (!prevBtn) bad('no preview button');
  else {
    prevBtn.click();
    box = boxOf();
    if (CAMPS().length !== n0) bad('the PREVIEW sent something');
    else ok('a preview sends nothing');
    if (!/resolved from your own relations/.test(box.textContent) || !/1\s*—|1 —/.test(box.textContent.replace(/\s+/g, ' ')))
      /* announcement default, fans only → Cantina Rossi alone */
      bad('the preview does not show the resolved count');
    else ok('the preview shows the count (1 — the one unsuppressed, admitted fan)');

    const cancel = Array.from(box.querySelectorAll('button')).find(b => /Cancel/.test(b.textContent));
    cancel.click();
    box = boxOf();
    if (CAMPS().length !== n0) bad('CANCEL sent something');
    else if (w.eval('campaignDraft !== null')) bad('an abandoned preview left a draft behind');
    else ok('an abandoned preview stores nothing');

    /* Now the real thing. */
    const msg2 = d.getElementById('devent-camp-msg');
    msg2.value = 'See you in the Speicherstadt';
    Array.from(boxOf().querySelectorAll('button')).find(b => /Preview/.test(b.textContent)).click();
    const send = Array.from(boxOf().querySelectorAll('button')).find(b => /^Send to /.test(b.textContent));
    if (!send) bad('the preview offers no send button');
    else {
      const counters = sideEffectCounters();
      send.click();
      if (CAMPS().length !== n0 + 1) bad('the explicit confirmation did not send');
      else ok('the explicit confirmation sends — and only it does');
      const c = CAMPS()[CAMPS().length - 1];
      if (c && CAMPS().length === n0 + 1) {
        if (!same(c.recipients, ['Cantina Rossi']))
          bad('the sent snapshot is not the previewed audience: ' + JSON.stringify(c.recipients));
        else ok('the sent snapshot is exactly the previewed audience, frozen');
        if (!c.log || !c.log.length || !/sent to 1 recipient/i.test(c.log[0].text))
          bad('the send wrote no auditable log line');
        else ok('the send log is written, append-only, with the count');
        if (!/1 recipient/.test(boxOf().textContent))
          bad('the sent campaign does not appear in the box\'s protocol');
        else ok('the protocol row shows the send — as a count');

        /* 8-in-7: the send moved no other counter (ME-2). */
        const after = sideEffectCounters();
        if (!same(counters, after))
          bad('a send changed another collection: ' + JSON.stringify(counters) + ' → ' + JSON.stringify(after));
        else ok('a send creates no invitation, participation, RSVP, application, order or partnership');

        expectRed('a send that also writes a participant row', () => {
          const b4 = sideEffectCounters();
          w.eval('memberEvents[0].participants.push({ stakeholder:"X", role:"guest", source:"invitation", status:"sent", requestedAt:"2026-08-06" })');
          if (!same(b4, sideEffectCounters())) bad('red as intended');
          w.eval('memberEvents[0].participants.pop()');
        });
      }
      /* Roll the live send back — the fixtures stay the fixtures. */
      w.eval('eventCampaigns.pop(); campaignSeq--; campaignDraft = null');
      w.openEventDetail('ME-3103');
    }
  }
}

/* ══════════════════════════════════════════════════════════════════
   8. Counts, never names (A16.14e)
══════════════════════════════════════════════════════════════════ */
console.log('\n── every surface shows counts, never the snapshot');
{
  w.openEventDetail('ME-3103');
  const pane = d.getElementById('devent-detail-pane');
  const box = Array.from(pane.querySelectorAll('.odt-box'))
    .find(b => (b.querySelector('.odt-box-head') || {}).textContent === 'Campaigns');
  const names = CAMPS().find(x => x.id === 'CMP-4001').recipients;
  const leak = html => names.filter(n => html.indexOf(n) !== -1);

  if (!box) bad('no Campaigns box to measure');
  else {
    const leaked = leak(box.innerHTML);
    if (leaked.length) bad('the host\'s own campaign box names recipients: ' + leaked.join(', '));
    else ok('the host box shows "5 recipients" and not one of the five names');
    if (!/5 recipient/.test(box.textContent)) bad('the count is missing from the protocol row');
    else ok('the count is there — the number is the disclosure, the list is not');
  }

  expectRed('a box that renders the list', () => {
    const leaked = leak('<div>' + names.join(', ') + '</div>');
    if (leaked.length) bad('red as intended');
  });
}

/* ══════════════════════════════════════════════════════════════════
   9. The derived notification — three conditions, stable id, the
      existing routes (C9)
══════════════════════════════════════════════════════════════════ */
console.log('\n── the recipient notification is derived, gated, stable, and opens the existing way');
{
  const rows = role => w.eval('notificationsFor(' + JSON.stringify(role) + ')').filter(n => n.kind === 'campaign');

  const retail = rows('retail');
  if (retail.length !== 1) bad('retail derives ' + retail.length + ' campaign rows, expected the one fixture campaign');
  else ok('a snapshot recipient derives exactly one row per campaign (dedupe by construction)');
  if (retail.length && retail[0].id !== 'campaign|CMP-4001|2026-08-05')
    bad('the notifId is not campaign+send act: ' + retail[0].id);
  else if (retail.length) ok('the id is built from the campaign AND the send act — stable across derivations');
  if (retail.length && !same(rows('retail').map(n => n.id), retail.map(n => n.id)))
    bad('re-deriving produced different ids');
  else ok('a re-derivation yields the same id (the read marker survives a reload)');
  if (retail.length && (retail[0].target.type !== 'event' || retail[0].target.id !== 'ME-3103'))
    bad('the row does not target its carrier');
  else ok('the row targets the carrier: event ME-3103');

  if (!rows('winery').length) bad('a snapshot recipient (Cantina Rossi) derives no row');
  else ok('the second playable recipient sees it too');
  if (rows('restaurant').length)
    bad('a house OUTSIDE the snapshot (suppressed at send) derives a campaign row');
  else ok('not in the snapshot, no notification — the suppression held through to the surface');
  if (rows('distributor').length)
    bad('the SENDER derives his own campaign as a notification');
  else ok('actor ≠ recipient: the sender never notifies himself');

  const leak = retail.length ? ['Cantina Rossi', 'Domaine Lefèvre', 'Henri Dubois Domaine', 'Weingut Schmitt']
    .filter(n => (retail[0].title + retail[0].text).indexOf(n) !== -1) : [];
  if (leak.length) bad('the notification row names other recipients: ' + leak.join(', '));
  else ok('the notification carries the message and the carrier, never the other recipients');

  expectRed('the actor filter removed', () => {
    w.eval('window.__origPush = notifPush; notifPush = function (list, me, n) { list.push(n); }');
    /* the sender is not in the snapshot, so bypassing the actor filter
       alone shows nothing — put him in, as a broken resolver would */
    w.eval('eventCampaigns[0].recipients.push("Hawesko GmbH")');
    if (!rows('distributor').length) { /* stayed green */ } else bad('red as intended');
    w.eval('eventCampaigns[0].recipients.pop()');
    w.eval('notifPush = window.__origPush; delete window.__origPush');
  });

  /* Condition 3 is re-checked at read: a campaign on a carrier the
     recipient cannot see (and holds no row on) derives nothing. */
  const n0 = CAMPS().length;
  const sent = w.eval('sendCampaign("show", "WS-2603", "announcement", false, "released and open")');
  if (!sent.ok) bad('the live WS-2603 announcement did not send: ' + sent.reason);
  else {
    if (!rows('winery').some(n => n.target.id === 'WS-2603'))
      bad('the live campaign derives no row for its recipient');
    else ok('a live send derives its rows immediately — same mechanism, no second path');
    SHOW('WS-2603').stage = 'draft';
    if (rows('winery').some(n => n.target.id === 'WS-2603'))
      bad('a recipient without a row on a now-invisible carrier keeps the notification');
    else ok('visibility is inherited at read time: carrier gone from the reader, row gone with it');
    SHOW('WS-2603').stage = 'published';
    if (!rows('winery').some(n => n.target.id === 'WS-2603'))
      bad('the row did not come back with the visibility');
    else ok('…and it is a derivation, so it comes back when the carrier does');

    /* The show route: the row opens the existing notification popup. */
    w.eval('showNotifications("winery")');
    const wprefix = w.eval('NOTIF_ROLES').winery.prefix;
    const info = d.getElementById(wprefix + '-info');
    const row = info && Array.from(info.querySelectorAll('.msg-item'))
      .find(r => /Announcement — Loire & Mosel/.test(r.textContent));
    if (!row) bad('the winery notification list has no row for the live show campaign');
    else {
      row.dispatchEvent(new w.Event('click', { bubbles: true }));
      const modal = d.getElementById('notif-show-modal');
      if (!modal || !modal.classList.contains('active'))
        bad('a show campaign row does not open the existing show popup');
      else if (!/Loire & Mosel/.test(d.getElementById('notif-show-body').textContent))
        bad('the popup does not show the carrier');
      else ok('a show campaign opens the existing C9 show popup route');
      w.closeNotifShow();
    }
    w.eval('eventCampaigns.pop(); campaignSeq--');
  }
  if (CAMPS().length !== n0) bad('the live show campaign was not rolled back');

  /* The event route: the row opens Discover→Detail, the existing way. */
  w.eval('showNotifications("retail")');
  const tprefix = w.eval('NOTIF_ROLES').retail.prefix;
  const tinfo = d.getElementById(tprefix + '-info');
  const trow = tinfo && Array.from(tinfo.querySelectorAll('.msg-item'))
    .find(r => /Announcement — Hanseatic House Fair/.test(r.textContent));
  if (!trow) bad('the retail notification list has no row for CMP-4001');
  else {
    trow.dispatchEvent(new w.Event('click', { bubbles: true }));
    if (w.eval('eventState.retail.openId') !== 'ME-3103')
      bad('an event campaign row does not land on the event detail');
    else ok('an event campaign opens the existing Discover→Detail route (ME-3103 open on retail)');
    w.closeEventDetail();
  }
}

console.log(fail ? '\n' + fail + ' failure(s)' : '\ncampaigns: all checks passed');
process.exit(fail ? 1 : 0);
