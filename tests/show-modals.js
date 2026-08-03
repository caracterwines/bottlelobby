/* ═══════════════════════════════════════════════════════════════════
   THE FIVE WINE SHOW MODALS — the surface nothing was watching

   This file exists because of a bug, and the bug is worth stating.

   The stakeholders pass (3 Aug 2026) moved `region` out of the
   partner lists into the master table. saveShow() still read it off a
   partnership row, so "Create Show →" with venue type "partner venue"
   threw `Cannot read properties of undefined (reading 'split')`. The
   full suite stayed green and the commit was pushed, because not one
   harness opened a show modal: everything about shows was driven
   through the underlying functions, never through the dialog that
   calls them.

   A thrown TypeError passing a green run is the failure mode this
   file is against. So the first thing every section asserts is
   simply: the action completed without throwing. The specific
   assertions come after that, never instead of it.

   What the modals must get right, beyond not crashing:

     · the pickers offer the HOST's partners, not "the distributor's".
       A show belongs to whoever hosts it (A16.4), and while the
       prototype had one book that distinction was free — now it is a
       real question with a real answer;
     · types are respected: producers can be invited as exhibitors,
       restaurants and retailers can be a venue, and neither list may
       contain the other (invariant 3);
     · a house already on the show is not offered again.
═══════════════════════════════════════════════════════════════════ */
const { JSDOM, VirtualConsole } = require('jsdom');
const { loadDashboard } = require('./load-dashboard');

let fail = 0;
const bad = m => { console.log('  ✗ ' + m); fail++; };
const ok  = m => console.log('  ✓ ' + m);

/* Returns null if a patch never applied, so a mutation that missed
   its target cannot read as "the check held". Takes a list, because
   the regression below was two lines and reproducing only one of
   them reproduces nothing — see the note on that case. */
function build(patch) {
  let html = loadDashboard().html;
  for (const p of (patch ? [].concat(patch) : [])) {
    const before = html;
    html = html.replace(p.from, p.to);
    if (html === before) return null;
  }
  const errs = [];
  const dom = new JSDOM(html, {
    runScripts: 'dangerously', pretendToBeVisual: true,
    virtualConsole: new VirtualConsole().on('jsdomError', e => errs.push(e.message))
  });
  const w = dom.window;
  w.scrollTo = () => {}; w.confirm = () => true;
  w.HTMLElement.prototype.scrollIntoView = () => {};
  if (errs.length) { console.log('SCRIPT ERRORS:\n' + errs.join('\n')); process.exit(1); }
  return w;
}

/* The whole point of the file: run it, and say what happened if it
   threw. Every section starts here. */
function attempt(w, label, fn) {
  try { return { ok: true, value: fn(w) }; }
  catch (e) { return { ok: false, error: e.constructor.name + ': ' + e.message, label: label }; }
}
const options = (w, id) => [...w.document.getElementById(id).options].map(o => o.value).filter(Boolean);
const typeOf = (w, name) => w.eval('stakeholder(' + JSON.stringify(name) + ').type');

const w = build();
console.log('script evaluated cleanly\n');

/* Fills the create-show form and presses the button, exactly as the
   dialog does. Returns the show that came out. */
function createShow(g, venue) {
  g.eval('openShowModal()');
  g.document.getElementById('sf-title').value = 'Harness Show';
  g.document.getElementById('sf-date').value  = '2026-11-05';
  g.document.getElementById('sf-city').value  = 'Hamburg';
  g.document.getElementById('sf-venue-type').value = venue ? 'partner_venue' : 'own_venue';
  g.eval('onShowVenueTypeChange()');
  if (venue) g.document.getElementById('sf-venue-partner').value = venue;
  const before = g.eval('wineShows.length');
  g.eval('saveShow()');
  if (g.eval('wineShows.length') !== before + 1) throw new Error('saveShow() created nothing');
  return g.eval('JSON.parse(JSON.stringify(wineShows[0]))');
}

/* ── 1. THE REGRESSION — create a show with a partner venue ─────── */
console.log('── the exact path that threw: "Create Show →" with a partner venue');
{
  const g = build();
  const r = attempt(g, 'saveShow', x => createShow(x, 'Bistro Laurent'));
  if (!r.ok) bad('saveShow() threw with a partner venue — ' + r.error);
  else {
    const s = r.value;
    ok('the show was created: ' + s.id);
    /* The field the crash was in. It must carry the venue's city, or
       the fix "worked" by producing a name that says less. */
    if (s.venueName !== 'Bistro Laurent, Frankfurt')
      bad('venueName is "' + s.venueName + '", expected "Bistro Laurent, Frankfurt" — the city comes from the master record');
    else ok('venueName carries the city from the master record: "' + s.venueName + '"');
    if (s.venueStatus !== 'requested')
      bad('picking a venue did not request it (status ' + s.venueStatus + ') — A16.11 has no state where a house is the venue unasked');
    else ok('choosing a partner venue IS asking them (A16.11)');
  }

  /* And the other branch, which never had the field. */
  const own = attempt(build(), 'saveShow own venue', x => createShow(x, null));
  if (!own.ok) bad('saveShow() threw with the distributor\'s own venue — ' + own.error);
  else if (own.value.venueStatus !== 'not_required')
    bad('an own venue was put into a request state: ' + own.value.venueStatus);
  else ok('an own venue needs no request');
}

/* ── 2. The venue picker offers the host's partners ─────────────── */
console.log('\n── the venue picker: the host\'s partners, and only the demand side');
{
  const g = build();
  const r = attempt(g, 'openVenueModal', x => { x.eval('openVenueModal("WS-2599")'); return options(x, 'vf-partner'); });
  if (!r.ok) bad('openVenueModal() threw — ' + r.error);
  else {
    const host = g.eval('wineShows.find(s => s.id === "WS-2599").leadHost');
    const partners = g.eval('JSON.parse(JSON.stringify(partnerships))')
      .filter(p => p.distributor === host || p.partner === host)
      .map(p => p.distributor === host ? p.partner : p.distributor);
    const strangers = r.value.filter(n => partners.indexOf(n) === -1);
    if (strangers.length) bad('the picker offers houses the host has no partnership with: ' + strangers.join(', '));
    else ok('every option is a partner of ' + host + ' (' + r.value.length + ' offered)');

    const wrongType = r.value.filter(n => ['restaurant', 'retail'].indexOf(typeOf(g, n)) === -1);
    if (wrongType.length) bad('a house that cannot be a venue is offered: ' +
      wrongType.map(n => n + ' (' + typeOf(g, n) + ')').join(', '));
    else ok('only restaurants and retailers are offered as a venue (A16.5)');

    const sent = attempt(g, 'sendVenueRequest', x => {
      x.document.getElementById('vf-partner').value = 'Weinhaus Müller';
      x.eval('sendVenueRequest()');
      return x.eval('wineShows.find(s => s.id === "WS-2599").venueName');
    });
    if (!sent.ok) bad('sendVenueRequest() threw — ' + sent.error);
    else if (sent.value !== 'Weinhaus Müller, Munich')
      bad('the venue name came out "' + sent.value + '", expected "Weinhaus Müller, Munich"');
    else ok('sending the request names the venue and its city: "' + sent.value + '"');
  }
}

/* ── 3. The exhibitor picker offers the host's producers ────────── */
console.log('\n── the invite picker: producers the host carries, none already on');
{
  const g = build();
  const s = g.eval('JSON.parse(JSON.stringify(wineShows.find(x => x.id === "WS-2599")))');
  const already = s.exhibitors.map(e => e.producer);
  const r = attempt(g, 'openInviteModal', x => { x.eval('openInviteModal("WS-2599")'); return options(x, 'if-producer'); });
  if (!r.ok) bad('openInviteModal() threw — ' + r.error);
  else {
    const wrongType = r.value.filter(n => typeOf(g, n) !== 'winery');
    if (wrongType.length) bad('a non-producer is offered as an exhibitor: ' + wrongType.join(', '));
    else ok('only producers are offered (' + r.value.length + ' of them)');

    const dupes = r.value.filter(n => already.indexOf(n) !== -1);
    if (dupes.length) bad('a producer already on the show is offered again: ' + dupes.join(', '));
    else if (!already.length) bad('the fixture show has no exhibitors — the "already on" rule is untested');
    else ok('the ' + already.length + ' already confirmed are not offered again');

    const host = s.leadHost;
    const carried = g.eval('JSON.parse(JSON.stringify(partnerships))')
      .filter(p => p.distributor === host).map(p => p.partner);
    const strangers = r.value.filter(n => carried.indexOf(n) === -1);
    if (strangers.length) bad('a producer the host does not carry is offered: ' + strangers.join(', ') +
      ' — A16.4 requires the partnership to precede the show');
    else ok('every offered producer is carried by ' + host + ' (A16.4)');
  }
}

/* ── 4. The attendee picker ─────────────────────────────────────── */
console.log('\n── the guest picker: partners of the host, not already invited');
{
  const g = build();
  const s = g.eval('JSON.parse(JSON.stringify(wineShows.find(x => x.id === "WS-2603")))');
  const already = (s.attendees || []).map(a => a.stakeholder);
  const r = attempt(g, 'openAttendeeModal', x => { x.eval('openAttendeeModal("WS-2603")'); return options(x, 'af-guest'); });
  if (!r.ok) bad('openAttendeeModal() threw — ' + r.error);
  else {
    const wrongType = r.value.filter(n => ['restaurant', 'retail'].indexOf(typeOf(g, n)) === -1);
    if (wrongType.length) bad('a house that cannot attend is offered: ' + wrongType.join(', '));
    else ok('only restaurants and retailers are offered as guests');

    const dupes = r.value.filter(n => already.indexOf(n) !== -1);
    if (dupes.length) bad('a house already on the guest list is offered again: ' + dupes.join(', '));
    else ok('the ' + already.length + ' already on the list are not offered again');

    const invited = attempt(g, 'saveAttendeeInvite', x => {
      const n = (x.eval('wineShows.find(s => s.id === "WS-2603").attendees') || []).length;
      x.document.getElementById('af-guest').value = r.value[0];
      x.eval('saveAttendeeInvite()');
      return (x.eval('wineShows.find(s => s.id === "WS-2603").attendees') || []).length - n;
    });
    if (!invited.ok) bad('saveAttendeeInvite() threw — ' + invited.error);
    else if (invited.value !== 1) bad('inviting a guest added ' + invited.value + ' rows, expected 1');
    else ok('inviting through the dialog adds exactly one guest');
  }
}

/* ── 5. The three wine pickers ──────────────────────────────────── */
console.log('\n── the wine pickers of all three buying roles');
{
  [['renderWinePicker', 'aw-pick-list', 'Hawesko GmbH'],
   ['renderWinePickerR', 'r-aw-pick-list', 'Bistro Laurent'],
   ['renderWinePickerT', 't-aw-pick-list', 'Weinhaus Müller']].forEach(([fn, id, me]) => {
    const g = build();
    const r = attempt(g, fn, x => { x.eval(fn + '("")'); return x.document.getElementById(id).textContent.trim(); });
    if (!r.ok) bad(fn + '() threw — ' + r.error);
    else if (!r.value) bad(fn + '() rendered nothing at all');
    else if (/No active/.test(r.value)) bad(fn + '() shows the empty state although ' + me + ' has partnerships');
    else ok(fn + ' fills the picker for ' + me);
  });
}

/* ── 6. Counter-check: the crash and the wrong pickers must be seen ─ */
console.log('\n── counter-check: the bug this file was written for must fail it');
{
  const cases = [
    /* The regression, restored to its shipped shape — both lines.
       A first version changed only the source of the value, to
       `(partnerships.find(...) || {}).region`, and SURVIVED: the fix
       had also added a `pReg ?` guard, so an undefined region now
       produces a shorter name instead of a crash. That is a weaker
       mutation than the real defect, and it would have certified this
       file against a bug it cannot see. What actually shipped was a
       TRUTHY row whose `region` was gone, with `.split` called on it
       unguarded, so that is what goes back in. */
    { name: 'saveShow() reads the region off a partnership row again',
      from: [
        { from: "  const pReg    = partner ? stakeholder(partner).region : '';",
          to:   "  const pRec    = partner ? partnerships.find(x => x.partner === partner) : null;" },
        { from: "    venueName: partner ? partner + (pReg ? ', ' + pReg.split(',')[0] : '')",
          to:   "    venueName: partner ? partner + (pRec ? ', ' + pRec.region.split(',')[0] : '')" }
      ],
      check: g => !attempt(g, 'saveShow', x => createShow(x, 'Bistro Laurent')).ok,
      says: 'section 1 catches the TypeError that a green suite let through' },

    { name: 'the invite picker offers every producer, partnered or not',
      from: "  const candidates = partnershipsOf(s.leadHost)\n    .map(p => partnerSide(p, s.leadHost))\n    .filter(n => stakeholder(n).type === 'winery' && already.indexOf(n) === -1);",
      to:   "  const candidates = stakeholders.filter(x => x.type === 'winery' && already.indexOf(x.name) === -1).map(x => x.name);",
      check: g => {
        /* The discriminating state is BUILT HERE, not borrowed from
           the fixtures. This mutation went unobservable the day every
           producer in the data became a partner of the host — the
           Château Belrieu row, added because two orders depended on
           it. "Every winery" and "the host's wineries" are only
           distinguishable while a winery exists that the host does not
           carry, and until then the mutation was real and invisible:
           it changed the code and nothing on the screen. So the check
           makes such a winery instead of hoping for one. */
        const host = g.eval('wineShows.find(s => s.id === "WS-2599").leadHost');
        g.eval('partnerships = partnerships.filter(function (p) { return p.partner !== "Château Belrieu"; })');
        const carried = g.eval('JSON.parse(JSON.stringify(partnerships))')
          .filter(p => p.distributor === host).map(p => p.partner);
        if (carried.indexOf('Château Belrieu') !== -1) return false;  // the state was not built
        g.eval('openInviteModal("WS-2599")');
        return options(g, 'if-producer').some(n => carried.indexOf(n) === -1);
      },
      says: 'section 3 catches a producer the host does not carry' },

    { name: 'the venue picker stops filtering by type',
      from: "  const partners = partnershipsOf(s.leadHost)\n    .map(p => partnerSide(p, s.leadHost))\n    .filter(n => {\n      const t = stakeholder(n).type;\n      return t === 'restaurant' || t === 'retail';\n    });",
      to:   "  const partners = partnershipsOf(s.leadHost).map(p => partnerSide(p, s.leadHost));",
      check: g => {
        g.eval('openVenueModal("WS-2599")');
        return options(g, 'vf-partner').some(n => ['restaurant', 'retail'].indexOf(typeOf(g, n)) === -1);
      },
      says: 'section 2 catches a producer being offered as a venue' },

    { name: 'the guest picker forgets who is already on the list',
      from: "      return (t === 'restaurant' || t === 'retail') && already.indexOf(n) === -1;",
      to:   "      return (t === 'restaurant' || t === 'retail');",
      check: g => {
        const already = (g.eval('JSON.parse(JSON.stringify(wineShows.find(x => x.id === "WS-2603").attendees))') || [])
          .map(a => a.stakeholder);
        g.eval('openAttendeeModal("WS-2603")');
        return options(g, 'af-guest').some(n => already.indexOf(n) !== -1);
      },
      says: 'section 4 catches a double invitation' }
  ];

  cases.forEach(c => {
    const g = build(Array.isArray(c.from) ? c.from : { from: c.from, to: c.to });
    if (!g) bad('MUTATION MISSED ITS TARGET (' + c.name + ') — it proved nothing');
    else if (!c.check(g)) bad('the mutation "' + c.name + '" survived: ' + c.says + ' — but it did not');
    else ok('"' + c.name + '" → ' + c.says);
  });
}

console.log(fail ? '\n✗ ' + fail + ' failure(s)' : '\n✓ all checks passed');
process.exit(fail ? 1 : 0);
