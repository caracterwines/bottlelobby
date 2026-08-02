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

/* ── 7. The surface (C9, pass 2b) ───────────────────────────────── */
/* The derivation above is proved; none of it was visible. What this
   section adds is the three ways the SCREEN can disagree with it: a
   badge that counts something else, a class that lands in the wrong
   box, and a "mark all as read" that redraws without asking again. */
console.log('\n── the surface: nav badge and the two boxes');
{
  const s = build();
  const rows = (role, box) => Array.from(
    s.document.querySelectorAll('#' + s.eval('NOTIF_ROLES["' + role + '"].prefix') + '-' + box + ' .msg-item'));
  const badge = role => (s.document.getElementById(s.eval('NOTIF_ROLES["' + role + '"].badge')).textContent || '').trim();

  /* Before anything is opened. A badge that only becomes honest once
     you visit the view is a badge nobody can act on. */
  let wrong = [];
  ROLES.forEach(r => {
    const want = String(s.eval('notifUnread("' + r + '").length'));
    if (badge(r) !== want) wrong.push(r + ': badge "' + badge(r) + '" vs ' + want + ' unread');
  });
  if (wrong.length) bad('the badge disagrees with notifUnread() before the view is opened: ' + wrong.join(' · '));
  else ok('all four badges equal notifUnread(role).length on load, unopened');

  /* Every role renders, and the split is the classes — not a slice. */
  ROLES.forEach(r => {
    s.eval('showNotifications("' + r + '")');
    const all  = s.eval('notificationsFor("' + r + '")');
    const nAw  = all.filter(n => n.cls === 'await').length;
    const nIn  = all.filter(n => n.cls === 'info').length;
    if (rows(r, 'await').length !== nAw || rows(r, 'info').length !== nIn)
      bad(r + ': drew ' + rows(r, 'await').length + '/' + rows(r, 'info').length +
          ' rows for ' + nAw + '/' + nIn + ' entries — the view is not showing the whole derivation');
  });
  ok('every role draws every derived entry, awaiting and informational apart');

  /* The box a row is in IS the claim "this needs you". An awaiting
     entry that lands under "For information" is a worklist item the
     reader will never work. Checked by text, because that is what the
     reader has to go on. */
  const bleed = [];
  ROLES.forEach(r => {
    const awaitTitles = s.eval('notificationsFor("' + r + '")')
      .filter(n => n.cls === 'await').map(n => n.title);
    rows(r, 'info').forEach(el => {
      const t = el.querySelector('.msg-from').textContent;
      if (awaitTitles.indexOf(t) !== -1) bleed.push(r + ': "' + t + '"');
    });
  });
  if (bleed.length) bad('an "awaiting you" entry is drawn under "For information": ' + bleed.join(' · '));
  else ok('nothing waiting on the reader is filed as information');

  /* Marking read has to travel: the marker, the dots and the badge are
     three readings of one fact. */
  const r0 = 'distributor';
  const before = rows(r0, 'info').filter(el => el.querySelector('.msg-unread')).length;
  if (!before) bad('no unread dots to begin with — the read state is not drawn at all');
  else ok('unread entries are marked as such (' + before + ' dots in the informational box)');

  s.document.getElementById(s.eval('NOTIF_ROLES["' + r0 + '"].prefix') + '-markall').click();
  const dots = rows(r0, 'await').concat(rows(r0, 'info')).filter(el => el.querySelector('.msg-unread')).length;
  if (dots) bad('marking all read left ' + dots + ' unread dots on screen');
  else if (badge(r0) !== '') bad('marking all read left the badge at "' + badge(r0) + '"');
  else ok('the button clears the dots and the badge together');

  /* And it is the LIST that is stale-proof, not the click: a new event
     afterwards must reappear on a plain redraw, with nobody reopening
     the view. */
  const ord = s.eval('orders.find(o => o.seller === "Hawesko GmbH").id');
  s.eval('logEvent(_o("' + ord + '"), "Bistro Laurent", "Arrived after the reader marked everything read")');
  s.eval('refreshNotifications()');
  if (badge(r0) !== '1')
    bad('a new event after "mark all read" did not reach the badge (badge is "' + badge(r0) + '")');
  else ok('a new event afterwards puts the badge back to 1 without reopening the view');
}

/* ── 8. The mutations section 7 exists for ──────────────────────── */
console.log('\n── counter-check: the two ways the screen can lie');
{
  /* (a) A badge counting the derivation instead of the unread part.
     It looks right on a fresh demo — everything IS unread — and only
     goes wrong after somebody reads something. */
  const mutant = build({
    from: '    const n = notifUnread(r).length;\n    el.textContent = n || \'\';',
    to:   '    const n = notificationsFor(r).length;\n    el.textContent = n || \'\';'
  });
  if (!mutant) bad('the badge mutation did not apply — this counter-check proves nothing');
  else {
    mutant.eval('showNotifications("distributor")');
    mutant.document.getElementById('dnotif-markall').click();
    const left = (mutant.document.getElementById('dnotif-badge').textContent || '').trim();
    if (!left) bad('the badge was changed to count everything and section 7 did NOT notice — it is too weak');
    else ok('a badge counting notificationsFor() instead of notifUnread() still reads "' + left + '" after mark-all — section 7 catches it');
  }

  /* (b) One box instead of two. The entries are all still there, which
     is exactly why this is worth a check: nothing is missing, the
     worklist has simply stopped being a worklist. */
  const merged = build({
    from: "    await: all.filter(function (n) { return n.cls === 'await'; }),\n" +
          "    info:  all.filter(function (n) { return n.cls === 'info'; })",
    to:   "    await: [], info: all"
  });
  if (!merged) bad('the class-split mutation did not apply — this counter-check proves nothing');
  else {
    merged.eval('showNotifications("restaurant")');
    const info = Array.from(merged.document.querySelectorAll('#rnotif-info .msg-item'));
    const awaitTitles = merged.eval('notificationsFor("restaurant")').filter(n => n.cls === 'await').map(n => n.title);
    const leaked = info.filter(el => awaitTitles.indexOf(el.querySelector('.msg-from').textContent) !== -1);
    const awaitBox = merged.document.querySelectorAll('#rnotif-await .msg-item').length;
    if (awaitBox !== 0) bad('the class-split mutation missed its target — the awaiting box still has rows');
    else if (!leaked.length && awaitTitles.length) bad('the split was removed and section 7 did NOT notice');
    else ok('with the split removed, ' + leaked.length + ' of ' + awaitTitles.length +
            ' worklist entries are drawn under "For information" — section 7 catches it');
  }
}

console.log(fail ? '\n✗ ' + fail + ' failure(s)' : '\n✓ all checks passed');
process.exit(fail ? 1 : 0);
