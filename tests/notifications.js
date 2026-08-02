/* ═══════════════════════════════════════════════════════════════════
   NOTIFICATIONS — the three conditions of C9 (and the read marker)

   Notifications are derived, so nothing here checks a table. What it
   checks is that the derivation does not widen: every condition of C9
   is one that only ever fails by letting MORE through, and more is
   invisible — an extra line looks like a notification, not like a leak.
   That is why the last section mutates the page and requires this file
   to go red. A check that cannot fail is not protecting anything.

   The mutation that matters is condition 2. The first version of
   notificationsFor() filtered the "for information" class through
   showsForRole(), which is deliberately WIDE for restaurants and retail
   (A16.0 makes them the demand side, so they see every publicly listed
   show whether or not they are in it). Weinhaus Müller was told that
   Grande Rioja had moved to planning — a show it has no relation to.
   notifHasEdge() exists to keep "may I see this" and "do I have a
   relation to this" apart, and section 6 puts the old mistake back to
   prove this file notices.
═══════════════════════════════════════════════════════════════════ */
const { JSDOM, VirtualConsole } = require('jsdom');
const { loadDashboard } = require('./load-dashboard');

let fail = 0;
const bad = m => { console.log('  ✗ ' + m); fail++; };
const ok  = m => console.log('  ✓ ' + m);

/* Builds a page, optionally with the source patched first. Returns null
   if the patch never applied, so a mutation that silently missed its
   target cannot be read as "the check held". */
function build(patch) {
  let html = loadDashboard().html;
  if (patch) {
    const before = html;
    html = html.replace(patch.from, patch.to);
    if (html === before) return null;
  }
  const errs = [];
  const dom = new JSDOM(html, {
    runScripts: 'dangerously', pretendToBeVisual: true,
    virtualConsole: new VirtualConsole().on('jsdomError', e => errs.push(e.message))
  });
  const w = dom.window;
  w.scrollTo = () => {}; w.confirm = () => true;
  if (errs.length) { console.log('SCRIPT ERRORS:\n' + errs.join('\n')); process.exit(1); }
  return w;
}

const w = build();
const ROLES = ['winery', 'distributor', 'restaurant', 'retail'];
const notifs = r => w.eval('notificationsFor("' + r + '")');
const entityOf = r => w.eval('SHOW_ROLES["' + r + '"].entity');

/* ── 1. Condition 1 — somebody else caused it ───────────────────── */
console.log('── condition 1: what I did myself is not news to me');
{
  let badRows = [];
  ROLES.forEach(r => {
    const me = entityOf(r);
    notifs(r).forEach(n => { if (n.actor === me) badRows.push(r + ': "' + n.title + '"'); });
  });
  if (badRows.length) bad('entries whose actor is the reader: ' + badRows.slice(0, 3).join(' · '));
  else ok('no role is told about its own actions');

  /* And the filter must be real, not an artefact of the fixtures. */
  const seller = w.eval('orders.find(o => o.seller === "Hawesko GmbH" && o.log && o.log.length).id');
  const before = w.eval('notificationsFor("distributor").length');
  w.eval('logEvent(_o("' + seller + '"), "Hawesko GmbH", "A thing Hawesko did itself")');
  const after = w.eval('notificationsFor("distributor").length');
  if (after !== before) bad('an event the reader caused changed their own list (' + before + ' → ' + after + ')');
  else ok('a freshly logged self-caused event does not appear');
}

/* ── 2. Condition 2 — it must touch MY relation ─────────────────── */
console.log('\n── condition 2: my relation to the thing, not the thing');
{
  /* The exact case that was wrong. Weinhaus Müller follows Bodegas Ruiz
     (the A16.6 fixture edge) and may browse Grande Rioja as the demand
     side — and still has no relation to it. */
  const retail = notifs('retail');
  const rioja = retail.filter(n => /Grande Rioja/.test(n.title + ' ' + n.text));
  if (rioja.length) bad('LEAK: retail was told about Grande Rioja, a show it has no edge to: "' + rioja[0].title + '"');
  else ok('retail hears nothing about a show it merely may look at');

  /* The other half: an entity that DOES have an edge still gets it,
     or the check above would pass by simply notifying nobody. */
  const restaurant = notifs('restaurant');
  if (!restaurant.some(n => /Grande Rioja/.test(n.title)))
    bad('the restaurant is an invited guest at Grande Rioja and was told nothing — condition 2 is now too narrow');
  else ok('an invited guest at the same show IS told about it');

  /* Edge events in a shared log are never forwarded (logShow scope).
     Scoped to cls 'info' on purpose: the awaiting class legitimately
     says "You have been invited to attend" about the reader's OWN
     invitation, and a looser match flagged that as a leak — a false
     alarm that would have taught us to loosen the real rule. What must
     never reach a non-host is the host's log line about a THIRD
     party — that is the line condition 2 turns on. */
  const guestLine = [];
  ROLES.forEach(r => notifs(r).forEach(n => {
    if (n.cls === 'info' && /invited to attend/i.test(n.text) && entityOf(r) !== 'Hawesko GmbH')
      guestLine.push(r + ': "' + n.text + '"');
  }));
  if (guestLine.length) bad('LEAK: a guest-list event reached a non-host: ' + guestLine.join(' · '));
  else ok('"X invited to attend" stays with the host (A16.5 rule 4)');
}

/* ── 3. Condition 3 — I may see it anyway ───────────────────────── */
console.log('\n── condition 3: never more than the surface it points at');
{
  const reg = notifs('restaurant').filter(n => n.kind === 'regional');
  if (!reg.length) bad('no regional entry at all — the WS-2605 fixture is gone and the exception is untested');
  else ok('the regional fixture produces exactly ' + reg.length + ' entry');

  /* A16.6 on a planning show: title, date, city, focus and nothing
     else. These are the names the show actually carries, so a widened
     text would hit one of them. */
  const blob = JSON.stringify(reg);
  ['Weingut Schmitt', 'Spätburgunder', 'Rhein-Main Loft', 'Hawesko Rhein'].forEach(secret => {
    if (blob.indexOf(secret) !== -1) bad('LEAK: the regional entry names "' + secret + '"');
  });
  if (!/Rhein & Main Selection/.test(blob)) bad('the regional entry does not even name the show');
  else ok('regional entry carries title, date, city, focus — no exhibitor, no wine, no venue');

  /* It must not go to a house in another city. */
  if (notifs('retail').some(n => n.kind === 'regional'))
    bad('Munich retail received a Frankfurt show — the city test is not applied');
  else ok('a house in another city gets nothing');
}

/* ── 4. Two classes ─────────────────────────────────────────────── */
console.log('\n── two classes, and "awaiting you" agrees with the badge');
{
  const classes = {};
  ROLES.forEach(r => notifs(r).forEach(n => { classes[n.cls] = (classes[n.cls] || 0) + 1; }));
  if (!classes.await || !classes.info) bad('expected both classes to occur, got ' + JSON.stringify(classes));
  else ok('both classes occur (' + JSON.stringify(classes) + ')');

  /* C9: the awaiting class must not grow its own answer to "does this
     need me?" — it asks showAwaits(), the same function the Wine Shows
     badge asks. Two answers would eventually disagree. */
  ROLES.forEach(r => {
    const fromBadge = w.eval('showsAwaiting("' + r + '").map(s => s.title).sort().join("|")');
    const fromNotif = notifs(r).filter(n => n.kind === 'show' && n.cls === 'await')
      .map(n => n.title.replace('Waiting for you — ', '')).sort().join('|');
    if (fromBadge !== fromNotif)
      bad(r + ': notifications and the shows badge disagree — badge "' + fromBadge + '" vs list "' + fromNotif + '"');
  });
  ok('every role: the awaiting list is exactly what showsAwaiting() says');
}

/* ── 5. The read marker — the one stored thing ──────────────────── */
console.log('\n── the read marker');
{
  const r = 'distributor';
  const total = notifs(r).length;
  const unread = w.eval('notifUnread("' + r + '").length');
  if (unread !== total) bad('a fresh demo should have everything unread: ' + unread + ' of ' + total);
  else ok('nothing is read to begin with (' + total + ')');

  w.eval('notifMarkAllSeen("' + r + '")');
  if (w.eval('notifUnread("' + r + '").length') !== 0) bad('marking all seen left something unread');
  else ok('marking all seen clears the count');

  /* The ids must be stable across a re-derivation, or a reload would
     make everything unread again — the one job the marker has. */
  if (w.eval('notifUnread("' + r + '").length') !== 0)
    bad('re-deriving produced different ids — the marker cannot survive a reload');
  else ok('ids are stable across re-derivation');

  /* A NEW event must still come through as unread afterwards. */
  const anyOrder = w.eval('orders.find(o => o.seller === "Hawesko GmbH").id');
  w.eval('logEvent(_o("' + anyOrder + '"), "Bistro Laurent", "Something new after the marker was set")');
  if (w.eval('notifUnread("' + r + '").length') !== 1)
    bad('a new event after marking everything seen did not surface as unread');
  else ok('a new event afterwards is unread again');

  /* And the marker is registered with the store, or a reload loses it
     and the badge starts lying with real numbers. */
  if (!w.eval('Object.keys(BLStore.fingerprints()).indexOf("notifSeen") !== -1'))
    bad('notifSeen is not registered with BLStore — it will not survive a reload');
  else ok('notifSeen is registered with BLStore (C8)');
}

/* ── 6. The mutation this file exists for ───────────────────────── */
console.log('\n── counter-check: the condition-2 bug must fail this file');
{
  /* Put the original mistake back: filter the "for information" class
     through the wide visibility gate instead of the edge test. */
  const mutant = build({
    from: 'if (!notifHasEdge(s, me)) return;',
    to:   'if (!showsForRole(role).some(function (x) { return x.id === s.id; })) return;'
  });
  if (!mutant) bad('the mutation did not apply — this counter-check proves nothing');
  else {
    const leaked = mutant.eval('notificationsFor("retail")')
      .filter(n => /Grande Rioja/.test(n.title + ' ' + n.text));
    if (!leaked.length) bad('the old bug was reintroduced and section 2 did NOT notice — this file is too weak');
    else ok('with notifHasEdge() replaced by showsForRole(), retail leaks Grande Rioja again (' + leaked.length + ' entries) — section 2 catches it');
  }
}

console.log(fail ? '\n✗ ' + fail + ' failure(s)' : '\n✓ all checks passed');
process.exit(fail ? 1 : 0);
