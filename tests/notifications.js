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
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');
const { loadDashboard } = require('./load-dashboard');
const REPO = path.join(__dirname, '..');

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

/* ── 9. Where a row goes (C9, pass 2b) ──────────────────────────── */
/* Three destinations, and only one of them is new markup. The wine
   show POPUP is the risk: this list reaches a restaurant that merely
   browses, and — through the regional exception — a house with no
   relation to the show at all. A popup that rendered the show itself
   would be a fourth surface, and A16.6 only holds if there is none. */
console.log('\n── what a row opens');
{
  const s = build();
  const KNOWN = ['show', 'profile', 'order', 'request'];

  const strange = [];
  ROLES.forEach(r => s.eval('notificationsFor("' + r + '")').forEach(n => {
    if (n.target) {
      if (KNOWN.indexOf(n.target.type) === -1) strange.push(r + ': target type "' + n.target.type + '"');
      return;
    }
    /* Having no target is legitimate in exactly ONE case, and it is
       the case C9 spells out: the row is about a WINE, and a wine is a
       plain link in a new tab, never a popup. Then the row has to
       carry that wine — otherwise it is a dead end, a line the reader
       can neither open nor act on, and "no target" would have become a
       way to smuggle those in. */
    if (!n.wine) strange.push(r + ': "' + n.title + '" opens nothing and names no wine');
  }));
  if (strange.length) bad('rows the surface cannot open: ' + strange.slice(0, 3).join(' · '));
  else ok('every derived entry either names a destination the surface knows, or is a wine and carries it');

  /* THE ONE THAT MATTERS. WS-2605 is `planning`, the restaurant has no
     edge to it at all (that is what makes it the regional entry), and
     the popup may therefore carry title, date, city and focus — the
     four fields A16.6 grants, and not one more. */
  s.eval('showNotifications("restaurant")');
  const regional = s.eval('notificationsFor("restaurant")').find(n => n.kind === 'regional');
  if (!regional) bad('no regional entry — section 9 cannot test the popup on an anonymised show');
  else {
    s.eval('openNotifShow("restaurant", "' + regional.target.id + '")');
    /* Read as text, not as markup: "Rhein & Main Selection" comes back
       out of innerHTML as "Rhein &amp; Main Selection" and the name
       check would fail on the entity rather than on the content. */
    const popup = s.document.getElementById('notif-show-body').textContent;
    if (!s.document.getElementById('notif-show-modal').classList.contains('active'))
      bad('the popup did not open');
    const leaks = ['Weingut Schmitt', 'Spätburgunder', 'Rhein-Main Loft']
      .filter(secret => popup.indexOf(secret) !== -1);
    if (leaks.length) bad('LEAK: the popup on an anonymised show names ' + leaks.join(', '));
    else if (popup.indexOf('Rhein & Main Selection') === -1) bad('the popup does not even name the show');
    else ok('the popup on an anonymised show names it and withholds exhibitor, wine and venue');

    /* And a stranger is told so rather than offered a way in. */
    const foot = s.document.getElementById('notif-show-foot').innerHTML;
    if (foot.indexOf('Open in Wine Shows') !== -1 && !s.eval('showsForRole("restaurant").some(x => x.id === "' + regional.target.id + '")'))
      bad('the popup offers a route into a show this role cannot reach');
    else ok('the footer routes through the existing view, or says there is nothing more');
  }

  /* A participant gets no private version of it either: the popup is
     the public card for everybody, and the working detail stays where
     it always was. Cantina Rossi IS an exhibitor at Grande Rioja. */
  s.eval('showNotifications("winery")');
  s.eval('openNotifShow("winery", "WS-2601")');
  const own = s.document.getElementById('notif-show-body').textContent;
  if (/Bodegas Ruiz|Rioja Reserva/.test(own))
    bad('LEAK: the popup shows an exhibitor list on a show that is still anonymised, to a participant');
  else if (s.document.getElementById('notif-show-foot').innerHTML.indexOf('Open in Wine Shows') === -1)
    bad('a participant is not offered the working view — the popup is a dead end for the side that has to act');
  else ok('a participant sees the same public card, plus the way into the working view');

  /* The profile destination is the A13 embed of a page that exists. */
  const follows = [];
  ROLES.forEach(r => s.eval('notificationsFor("' + r + '")')
    .filter(n => n.kind === 'follow').forEach(n => follows.push(n)));
  const missing = follows.filter(n => !n.target || n.target.type !== 'profile' ||
    !fs.existsSync(path.join(REPO, n.target.url)));
  if (!follows.length) bad('no follow entries — the profile destination is untested');
  else if (missing.length) bad('a follow entry points at a page that does not exist: ' + missing[0].target?.url);
  else ok('all ' + follows.length + ' follow entries open a real public profile page');

  /* An order row lands on the order, in a tab the role actually has. */
  const ordRow = s.eval('notificationsFor("distributor")').find(n => n.target && n.target.type === 'order');
  s.eval('openNotifOrder("distributor", "' + ordRow.target.id + '")');
  if (s.eval('ordState.distributor.openId') !== ordRow.target.id)
    bad('an order row did not open its order (' + s.eval('ordState.distributor.openId') + ')');
  else ok('an order row opens that order in the existing Orders view');
}

/* ── 10. The wine on an awaiting row ────────────────────────────── */
console.log('\n── the wine a row is about');
{
  const s = build();
  const withWine = [];
  ROLES.forEach(r => s.eval('notificationsFor("' + r + '")')
    .filter(n => n.wine).forEach(n => withWine.push({ role:r, n })));

  if (!withWine.length) bad('no awaiting row names a wine — the link rule has nothing to apply to');
  else ok(withWine.length + ' awaiting rows name the wine instead of saying "a wine"');

  /* Every url that IS set has to resolve — a link into nothing is worse
     than the sentence it replaced. Checked against the filesystem, not
     against a naming rule, because the naming rule is exactly what this
     field exists to avoid. */
  const pool = s.eval('JSON.parse(JSON.stringify(partnerWinesPool))');
  const dead = pool.filter(w => w.url && !fs.existsSync(path.join(REPO, w.url)));
  if (dead.length) bad('partnerWinesPool points at pages that do not exist: ' + dead.map(w => w.url).join(', '));
  else ok('all ' + pool.filter(w => w.url).length + ' wine urls in the pool resolve to a real page');

  const dangling = withWine.filter(x => x.n.wine.url && !fs.existsSync(path.join(REPO, x.n.wine.url)));
  if (dangling.length) bad('a row links to a page that does not exist: ' + dangling[0].n.wine.url);
  else ok('every wine link on a row resolves');

  /* The link is a link — not a popup. */
  s.eval('showNotifications("winery")');
  const row = Array.from(s.document.querySelectorAll('#wnotif-await .msg-item'))
    .find(el => el.querySelector('a'));
  if (!row) bad('the wine is named but never linked on screen');
  else {
    const a = row.querySelector('a');
    if (a.getAttribute('target') !== '_blank') bad('the wine link does not open in a new tab');
    else if (!/^bottle-lobby-wine-/.test(a.getAttribute('href'))) bad('the wine link does not point at an article page');
    else ok('the wine is a plain link to ' + a.getAttribute('href') + ', new tab, no popup');
  }
}

/* ── 11. The mutations sections 9 and 10 exist for ──────────────── */
console.log('\n── counter-check: the popup must not become a fourth surface');
{
  /* (a) The level. Same renderer, one word changed — the subtlest way
     to lose A16.6, because everything still goes through the shared
     function and only the answer to "how much" is wrong. */
  const full = build({
    from: '  const level = publicLevelFor(s);\n  document.getElementById(\'notif-show-body\').innerHTML =',
    to:   '  const level = \'full\';\n  document.getElementById(\'notif-show-body\').innerHTML ='
  });
  if (!full) bad('the level mutation did not apply — this counter-check proves nothing');
  else {
    full.eval('showNotifications("restaurant")');
    const reg = full.eval('notificationsFor("restaurant")').find(n => n.kind === 'regional');
    full.eval('openNotifShow("restaurant", "' + reg.target.id + '")');
    const html = full.document.getElementById('notif-show-body').textContent;
    if (!/Weingut Schmitt|Spätburgunder|Rhein-Main Loft/.test(html))
      bad('the popup was forced to the full level and leaked nothing — section 9 is testing the wrong show');
    else ok('forced to level "full", the popup names the hidden exhibitor and venue — section 9 catches it');
  }

  /* (b) The renderer. Somebody draws the show in the popup instead of
     asking publicShowCard() — the failure the whole pass was warned
     about, written out. */
  const rolled = build({
    from: "    publicShowCard(s, level) +",
    to:   "    ('<div class=\"ws-public\"><div class=\"ws-public-title\">' + s.title + '</div>' +\n" +
          "     '<div class=\"ws-public-line\"><b>Venue</b> · ' + s.venueName + '</div>' +\n" +
          "     s.exhibitors.map(function (e) { return '<div class=\"ws-public-line\">' + e.producer + '</div>'; }).join('') +\n" +
          "     '</div>') +"
  });
  if (!rolled) bad('the hand-rolled-popup mutation did not apply — this counter-check proves nothing');
  else {
    rolled.eval('showNotifications("restaurant")');
    const reg = rolled.eval('notificationsFor("restaurant")').find(n => n.kind === 'regional');
    rolled.eval('openNotifShow("restaurant", "' + reg.target.id + '")');
    const html = rolled.document.getElementById('notif-show-body').textContent;
    if (!/Weingut Schmitt|Rhein-Main Loft/.test(html))
      bad('the popup was re-rendered by hand and leaked nothing — the mutation missed its point');
    else ok('a popup that renders the show itself instead of calling publicShowCard() leaks at once — section 9 catches it');
  }

  /* (c) A wine whose record has no article page must be NAMED, not
     linked. The pool carries a url for all nineteen wines today, so
     the case is reached by taking one away — the rule is what is
     being checked, not the current contents of the fixture. */
  const unlinked = build({
    from: ", url:'bottle-lobby-wine-primitivo-riserva.html', at:",
    to:   ", at:"
  });
  if (!unlinked) bad('the missing-url mutation did not apply — this counter-check proves nothing');
  else {
    unlinked.eval('showNotifications("winery")');
    const rows = Array.from(unlinked.document.querySelectorAll('#wnotif-await .msg-item'));
    const named = rows.filter(el => /Primitivo Riserva 2020/.test(el.textContent));
    const linked = named.filter(el => el.querySelector('a'));
    if (!named.length) bad('with the url removed the wine stopped being named at all — the name must not depend on the link');
    else if (linked.length) bad('a wine with no article page was linked anyway');
    else ok('a wine record without a url is named and not linked — no guessed links');
  }
}

/* ── 12. The overview widget (C9, pass 2b) ──────────────────────── */
/* It used to hold three hand-written messages. One of them was
   "Vinoteca Roma started following you", and that follow has been a
   row in wineFollowGraph the whole time — a second copy of a record,
   living in markup instead of in a table, which is the same A1
   violation with a better hiding place. */
console.log('\n── the winery overview widget');
{
  const s = build();
  const host = s.document.getElementById('wnotif-widget');
  if (!host) { bad('the overview widget container is gone — nothing paints the winery overview'); }
  else {
    const all = s.eval('notificationsFor("winery")');
    const ordered = all.filter(n => n.cls === 'await').concat(all.filter(n => n.cls !== 'await'));
    const shown = Array.from(host.querySelectorAll('.msg-item')).map(el => el.querySelector('.msg-from').textContent);
    const want  = ordered.slice(0, 3).map(n => n.title);
    if (shown.join('|') !== want.join('|'))
      bad('the widget is not the derivation: shows [' + shown.join(', ') + '] for [' + want.join(', ') + ']');
    else ok('the widget shows the first three derived entries, awaiting first');

    if (host.textContent.indexOf('+ ' + (ordered.length - 3) + ' more') === -1)
      bad('the widget cuts the list without saying how much it cut');
    else ok('it names the ' + (ordered.length - 3) + ' it left out rather than implying there are none');

    /* The one that used to be invented is now the real edge, and it
       still says the same thing — that is what makes the replacement a
       replacement rather than a removal. */
    if (!all.some(n => n.kind === 'follow' && /Vinoteca Roma started following you/.test(n.title)))
      bad('"Vinoteca Roma started following you" no longer exists — it was deleted, not derived');
    else ok('the follow it used to fake is now the wineFollowGraph edge it always was');

    /* Reading a row HERE has to count. The widget is on the overview,
       which is reachable without the sub-view ever being built — and a
       renderer that returns early for an unbuilt view (B12) took the
       badge down with it. Found in Chrome, not here: the first version
       of openNotification() redrew only its own sub-view, so a row read
       from the widget left the badge at 13 and the dot in place. */
    const badgeEl = s.document.getElementById('wnotif-badge');
    const before = Number(badgeEl.textContent || 0);
    host.querySelector('.msg-item .msg-from').click();
    const after = Number(badgeEl.textContent || 0);
    if (after !== before - 1)
      bad('reading a row in the widget did not move the badge (' + before + ' → ' + after + ')');
    /* The FIRST row — the one that was clicked. The other two are still
       unread and must keep their dots, or the check would be asking for
       the wrong thing. */
    else if (host.querySelector('.msg-item').querySelector('.msg-unread'))
      bad('reading a row in the widget left its own unread dot in place');
    else ok('a row read in the widget counts everywhere — badge ' + before + ' → ' + after);
  }

  /* And the invented text is gone from the file, not merely covered up
     by a renderer that happens to run. */
  const raw = loadDashboard().html;
  const ghosts = ["We'd love to schedule a tasting", 'Your Wine Show spot in Munich', '45m ago']
    .filter(t => raw.indexOf(t) !== -1);
  if (ghosts.length) bad('hand-written message content is still in the markup: ' + ghosts.join(' · '));
  else ok('none of the three invented messages is left in the file');
}

/* ── 13. The mutation section 12 exists for ─────────────────────── */
console.log('\n── counter-check: a hand-written message must fail this file');
{
  const faked = build({
    from: '  mountNotifRows(host, role, ordered.slice(0, 3), unread,',
    to:   '  host.innerHTML = \'<div class="msg-item"><div class="msg-content"><div class="msg-header">\' +\n' +
          '    \'<span class="msg-from">Hawesko GmbH</span><span class="msg-time">2h ago</span></div>\' +\n' +
          '    \'<div class="msg-preview">A tasting for your Primitivo</div></div></div>\';\n' +
          '  if (false) mountNotifRows(host, role, ordered.slice(0, 3), unread,'
  });
  if (!faked) bad('the hand-written-widget mutation did not apply — this counter-check proves nothing');
  else {
    const shown = Array.from(faked.document.querySelectorAll('#wnotif-widget .msg-item'))
      .map(el => el.querySelector('.msg-from').textContent);
    const all = faked.eval('notificationsFor("winery")');
    const ordered = all.filter(n => n.cls === 'await').concat(all.filter(n => n.cls !== 'await'));
    if (shown.join('|') === ordered.slice(0, 3).map(n => n.title).join('|'))
      bad('the widget was replaced by hand-written markup and section 12 did NOT notice');
    else ok('a widget painting a message nobody derived reads "' + shown.join(', ') + '" — section 12 catches it');
  }
}

/* ── 14. The two A8 sources (C9, pass 2c) ───────────────────────── */
/* "A winery I follow now has a distributor" and "a new wine". Both are
   condition-2 sources and both hang on ONE question — do I have a
   relation to this producer — so both are only as narrow as
   notifWineryEdge() is. Section 16 removes that function's answer and
   requires this file to go red. */
console.log('\n── the two A8 sources');
{
  const s = build();
  const of = r => s.eval('notificationsFor("' + r + '")');

  /* (a) They exist at all. A source that derives nothing cannot be
     shown to derive the RIGHT nothing, and every check below would
     pass by vacuum. */
  const supply = {}, wines = {};
  ROLES.forEach(r => {
    supply[r] = of(r).filter(n => n.kind === 'supply');
    wines[r]  = of(r).filter(n => n.kind === 'wine');
  });
  if (!supply.retail.length) bad('no supply notification anywhere — the A8 fixture pair is gone');
  else ok('retail is told "' + supply.retail[0].title + '"');
  if (!wines.restaurant.length || !wines.distributor.length)
    bad('the new-wine source reaches neither the follower nor the partner');
  else ok('new wines reach the follower (' + wines.restaurant.length +
          ') and the partner (' + wines.distributor.length + ')');

  /* (b) THE ONE THAT MATTERS: no relation, no notification.
     The allowed set is computed HERE, out of the follow graph and the
     partner book, and deliberately NOT by asking notifWineryEdge().
     Asking it would be circular under exactly the mutation this check
     exists for — a notifWineryEdge() that answers "yes" to everything
     would make the page wrong and this check green at the same time.
     A test re-deriving is a second opinion; only the product may have
     just one answer. */
  const follows = s.eval('JSON.parse(JSON.stringify(wineFollowGraph))');
  const partners = s.eval('JSON.parse(JSON.stringify(activePartners))');
  /* "Is this house a producer" comes from the stakeholders table since
     the pass that gave profile data one owner. Reading it here is not
     the circularity the note above warns about: the mutation this
     check exists for lives in notifWineryEdge(), and the table is a
     different fact from a different place. */
  const types = {};
  s.eval('JSON.parse(JSON.stringify(stakeholders))').forEach(st => { types[st.name] = st.type; });
  const allowed = me => {
    const set = follows
      .filter(f => f.follower === me && types[f.winery] === 'winery')
      .map(f => f.winery);
    /* Only the distributor holds producer partnerships (invariant 3). */
    if (me === s.eval('SHOW_ROLES.distributor.entity'))
      partners.filter(p => types[p.winery] === 'winery').forEach(p => set.push(p.winery));
    return set;
  };
  const strangers = [];
  ROLES.forEach(r => {
    const me = entityOf(r), mine = allowed(me);
    of(r).filter(n => n.kind === 'wine' || n.kind === 'supply').forEach(n => {
      const producer = n.kind === 'wine'
        ? n.title.replace('New wine — ', '')
        : n.title.replace(' now has a distributor', '');
      if (mine.indexOf(producer) === -1) strangers.push(r + ' ← ' + producer + ' ("' + n.title + '")');
    });
  });
  if (strangers.length) bad('LEAK: a role was told about a producer it has no relation to: ' + strangers.slice(0, 4).join(' · '));
  else ok('every A8 row names a producer the reader follows or partners with');

  /* (c) The supply row is for the demand side only. For a distributor,
     a producer they follow signing elsewhere is a different sentence.

     The fixtures cannot show this on their own: no winery and no
     distributor follows a producer whose partnership came later, so
     the role gate is covered by construction and removing it changes
     nothing (measured — the mutation survived). So the state is BUILT
     here. Otherwise the gate reads as dead code and gets deleted by
     whoever tidies up next. */
  const wrongSide = ROLES.filter(r => (r === 'winery' || r === 'distributor') && supply[r].length);
  if (wrongSide.length) bad('a supply notification reached ' + wrongSide.join(', ') + ' — it is a Restaurant/Retail signal (invariant 3)');
  else {
    const g = build();
    /* Cantina Rossi follows Bodegas Ruiz BEFORE Bodegas Ruiz gains its
       distributor (2 Jun 2026) — every condition of the supply source
       is now met except the role. */
    g.eval('wineFollowGraph.push({ follower:"Cantina Rossi", winery:"Bodegas Ruiz", at:"2026-01-05" })');
    const edge = g.eval('JSON.stringify(notifWineryEdge("Cantina Rossi", "Bodegas Ruiz"))');
    const got  = g.eval('notificationsFor("winery")').filter(n => n.kind === 'supply');
    if (edge === 'null') bad('the built state did not take — the winery has no follow edge and the gate is untested');
    else if (got.length) bad('a winery following a producer was told it "now has a distributor" — the role gate is gone');
    else ok('a winery with the identical follow edge (' + edge + ') gets nothing — only the demand side does');
  }

  /* (d) The producer is named in the reader's own vocabulary and the
     row opens the real public profile, through the same branch the
     follow rows use — not a second profile renderer. */
  const sup = supply.retail[0];
  if (!sup) bad('no supply row to check the destination of');
  else if (!sup.target || sup.target.type !== 'profile')
    bad('the supply row does not open the producer profile: ' + JSON.stringify(sup.target));
  else if (!fs.existsSync(path.join(REPO, sup.target.url)))
    bad('the supply row points at a page that does not exist: ' + sup.target.url);
  else ok('the supply row opens ' + sup.target.url + ' in the A13 embed');

  /* (e) Who and when, for both. C9 requires every source to answer
     them, and an empty actor is the failure mode that hides: it makes
     condition 1 pass for everybody. */
  const mute = [];
  ROLES.forEach(r => of(r).filter(n => n.kind === 'wine' || n.kind === 'supply').forEach(n => {
    if (!n.actor) mute.push(r + ': "' + n.title + '" has no actor');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(n.at || '')) mute.push(r + ': "' + n.title + '" has no date');
  }));
  if (mute.length) bad('sources that cannot say who or when: ' + mute.slice(0, 3).join(' · '));
  else ok('every A8 row names its actor and carries an ISO date');

  /* (f) A wine row is a link, never a popup (C9), and the link is the
     record's url — not something built out of the name. Checked over
     ALL of them: one row behaving is not the rule holding. */
  const allWine = ROLES.reduce((a, r) => a.concat(wines[r]), []);
  const popped = allWine.filter(n => n.target);
  const linked = allWine.filter(n => n.wine && n.wine.url);
  if (popped.length) bad('a wine row has a target — C9 says a wine is a link, not a destination: ' + popped[0].title);
  else if (!linked.length) bad('not one wine row carries a link — the link rule has nothing to apply to');
  else if (linked.some(n => !fs.existsSync(path.join(REPO, n.wine.url))))
    bad('a wine link does not resolve: ' + linked.find(n => !fs.existsSync(path.join(REPO, n.wine.url))).wine.url);
  else ok('all ' + allWine.length + ' wine rows open no popup; the ' + linked.length + ' with an article page link to it');
}

/* ── 15. The date bound is condition 2, not decoration ──────────── */
/* An event that happened before my relation began did not touch my
   relation, because there was none. Without this the sources would be
   "everything the producer ever did, forwarded on the day I followed"
   — which is a catalogue, and the reader already has one. */
console.log('\n── an event before my relation began is not news');
{
  const s = build();

  /* Baglio Rosso was added 20 Apr 2026. Bistro Laurent followed
     Cantina Rossi on 12 Apr, Weinhaus Müller on 3 May. One of them
     hears about it and the other does not, and the fixture puts the
     dates either side of it on purpose. */
  const seen = r => s.eval('notificationsFor("' + r + '")').some(n => /Baglio Rosso/.test(n.text || ''));
  if (!seen('restaurant')) bad('the restaurant followed BEFORE the wine was added and was not told');
  else if (seen('retail')) bad('the retailer followed AFTER the wine was added and was told anyway — the bound does nothing');
  else ok('Baglio Rosso reaches the earlier follower and not the later one');

  /* And the older half of the range stays out of the list entirely —
     otherwise every relation would start with a wall of catalogue. */
  const old = s.eval('notificationsFor("distributor")')
    .filter(n => n.kind === 'wine' && n.at < '2026-01-01');
  if (old.length) bad(old.length + ' wines from before the partnership are being announced');
  else ok('nothing older than the relation is announced');

  /* Same rule on the supply side, and there it is the sentence itself:
     Cantina Rossi already had a distributor when Bistro Laurent
     started following, so it does not NOW have one. */
  const stale = s.eval('notificationsFor("restaurant")')
    .filter(n => n.kind === 'supply');
  if (stale.length) bad('"now has a distributor" was said about a producer that already had one: ' + stale[0].title);
  else ok('a producer that already had a distributor does not "now" have one');
}

/* ── 16. The mutations sections 14 and 15 exist for ─────────────── */
console.log('\n── counter-check: no relation must mean no notification');
{
  /* (a) THE ONE THE PASS WAS WARNED ABOUT. Remove the relation test
     and both sources reach everybody — a Frankfurt restaurant is told
     about a Rioja it has never heard of. This is notifHasEdge()'s
     mistake in a second place, and it fails the same way: silently,
     by letting MORE through. */
  const open = build({
    from: 'function notifWineryEdge(me, winery) {\n  const edges = [];',
    to:   'function notifWineryEdge(me, winery) {\n  return { via:\'follow\', at:\'2000-01-01\' };\n  const edges = [];'
  });
  if (!open) bad('the relation mutation did not apply — this counter-check proves nothing');
  else {
    const before = w.eval('notificationsFor("restaurant")').filter(n => n.kind === 'wine').length;
    const after  = open.eval('notificationsFor("restaurant")').filter(n => n.kind === 'wine').length;
    const producers = open.eval('notificationsFor("restaurant")')
      .filter(n => n.kind === 'wine').map(n => n.title).filter((v, i, a) => a.indexOf(v) === i);
    if (after <= before)
      bad('the relation test was removed and nothing widened — section 14 is testing a vacuum');
    else ok('without the relation test the restaurant hears from ' + producers.length +
            ' producers instead of 1 (' + before + ' → ' + after + ' wines) — section 14 catches it');
  }

  /* (b) The same mutation on the supply source, read from the side the
     rule protects: a role that is neither partner nor follower. */
  if (open) {
    const sup = open.eval('notificationsFor("retail")').filter(n => n.kind === 'supply').map(n => n.title);
    const real = w.eval('notificationsFor("retail")').filter(n => n.kind === 'supply').map(n => n.title);
    if (sup.length <= real.length)
      bad('the supply source did not widen — it is not asking notifWineryEdge() at all');
    else ok('without the relation test retail is told about ' + sup.length +
            ' producers instead of ' + real.length + ' — the supply source really does ask');
  }

  /* (c) The date bound. Drop it and the whole back catalogue arrives
     as news on day one. */
  const flood = build({
    from: '    if (notifTime(w.at) <= notifTime(edge.at)) return;',
    to:   '    if (false) return;'
  });
  if (!flood) bad('the date-bound mutation did not apply — this counter-check proves nothing');
  else {
    const after = flood.eval('notificationsFor("restaurant")').filter(n => n.kind === 'wine').length;
    const before = w.eval('notificationsFor("restaurant")').filter(n => n.kind === 'wine').length;
    if (after <= before) bad('the date bound was removed and nothing changed — section 15 proves nothing');
    else ok('without the date bound the restaurant gets ' + after + ' wines instead of ' +
            before + ' — section 15 catches it');
  }

  /* (d) A wine whose record has no article page must be NAMED, not
     linked, on the new rows too — the same rule the awaiting row has
     had since pass 2b, now reached through a different source. */
  const unlinked = build({
    from: ", url:'bottle-lobby-wine-costa-bianca.html', at:",
    to:   ", at:"
  });
  if (!unlinked) bad('the missing-url mutation did not apply on the new source — this counter-check proves nothing');
  else {
    const row = unlinked.eval('notificationsFor("restaurant")')
      .find(n => n.kind === 'wine' && /Costa Bianca/.test(n.text));
    if (!row) bad('the mutated wine stopped being derived — the mutation changed more than the url');
    else if (row.wine.url) bad('a wine with no article page was linked anyway to ' + row.wine.url);
    else if (!/Costa Bianca/.test(row.text)) bad('the wine lost its name along with its link');
    else ok('a wine with no article page is named ("' + row.text + '") and not linked');
  }
}

console.log(fail ? '\n✗ ' + fail + ' failure(s)' : '\n✓ all checks passed');
process.exit(fail ? 1 : 0);
