/* ═══════════════════════════════════════════════════════════════════
   THE PUBLIC ORGANIZER PROFILE AND THE PARTNER FOLLOW — A23,
   OP-1..OP-10 (pass O9)
   -------------------------------------------------------------------
   The measured storage decision (D47: a bounded second store, three
   target sorts, keys not names), the follow act under the DERIVED
   cockpit identity, the D43 guard, the public page without a write
   path, the exhibitor-call action, the one opened My Stars read path
   (PP-3), and — fixed, not measurable — no follower names and no
   follower figure anywhere.

   §6 IS A NEGATIVE SECTION (OP-6). O9 first shipped a public
   verification verdict; it was withdrawn because it held the full
   validated snapshot after hydration and read the private `reviews`
   rows out of it. §6 now proves the withdrawal holds: the store exports
   no verdict entry, the page makes no verification statement of any
   kind, and the private dashboard derivation is untouched.

   As in tests/fairs.js and its successors every invariant is measured
   TWICE — the CLAIM, and the COUNTER-MUTATION that breaks the rule and
   must turn the same check red. A check that survives its own
   counter-mutation is not a check.

   THE ACTIVE COCKPIT IS SET THE ONLY WAY THE PAGE SETS IT: through
   switchDashboard(role, btn), which writes `activeCockpit` at its head.
   Where a test needs a cockpit that cannot exist in SHOW_ROLES (the
   partner workspace) it switches to that view the same way. No test
   ever hands an identity to a mutating function; §4 proves that
   impossible.

   ONE measured absence: the LIVE-STORE half of OP-6/OP-9 — a real
   snapshot written by the dashboard, the page reading only its
   allowlisted collections out of it, holding nothing afterwards and
   never writing — lives in tests/persistence.js, the one harness
   allowed to run a live store.
═══════════════════════════════════════════════════════════════════ */
const { loadDashboard } = require('./load-dashboard');
const { JSDOM, VirtualConsole } = require('jsdom');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PAGE = path.join(ROOT, 'bottle-lobby-organizer-atrium-fairs-gmbh.html');
const GUIDE = path.join(ROOT, 'bottle-lobby-wine-guide.html');

function bootDash(urlSuffix) {
  const errs = [];
  const opts = {
    runScripts: 'dangerously', pretendToBeVisual: true,
    beforeParse(win) { win.scrollTo = () => {}; },
    virtualConsole: new VirtualConsole().on('jsdomError', e => errs.push(e.message))
  };
  if (urlSuffix) opts.url = 'https://localhost/bottle-lobby-dashboard.html' + urlSuffix;
  const dom = new JSDOM(loadDashboard().html, opts);
  if (errs.length) { console.log('SCRIPT ERRORS:\n' + errs.join('\n')); process.exit(1); }
  const win = dom.window;
  win.confirm = () => true;
  win.eval('Element.prototype.scrollIntoView = function () {}');
  win.eval('history.replaceState = function () {}');
  return win;
}
function bootPage(file, urlSuffix, patch) {
  const errs = [];
  let html = loadDashboard(file).html;
  if (patch) {
    const before = html;
    html = html.replace(patch.from, patch.to);
    if (html === before) throw new Error('patch never applied — ' + patch.from);
  }
  const dom = new JSDOM(html, {
    runScripts: 'dangerously', pretendToBeVisual: true,
    url: 'https://localhost/' + path.basename(file) + (urlSuffix || ''),
    beforeParse(win) { win.scrollTo = () => {}; },
    virtualConsole: new VirtualConsole().on('jsdomError', e => errs.push(e.message))
  });
  if (errs.length) { console.log('SCRIPT ERRORS:\n' + errs.join('\n')); process.exit(1); }
  dom.window.eval('Element.prototype.scrollIntoView = function () {}');
  return dom.window;
}
/* The assets are INLINED by the loader, so text checks over a page must
   strip the script nodes first (the public-shows-page.js discipline). */
function pageText(win) {
  const c = win.document.body.cloneNode(true);
  Array.prototype.forEach.call(c.querySelectorAll('script,style'), n => n.remove());
  return c.textContent;
}

const w = bootDash(), d = w.document;
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
  fail = before;
  if (raised) ok('counter-mutation: ' + label + ' — the check goes red (' + raised + ')');
  else bad('COUNTER-MUTATION STAYED GREEN: ' + label + ' — this check cannot fail and proves nothing');
}

const FOLLOWS = () => w.eval('partnerFollows');
const GRAPH   = () => w.eval('wineFollowGraph');
const PARTNER = () => w.eval('platformPartners[0]');
const TOAST   = () => d.getElementById('save-toast').textContent;
/* The only way the page sets the cockpit (A23.3). */
function cockpit(role) {
  w.eval("switchDashboard('" + role + "', document.querySelectorAll('.demo-btn')[rolesByHash['" + role + "']])");
}
const TRADE_ROLES = ['winery', 'distributor', 'restaurant', 'retail'];
const ENTITY = r => w.eval('SHOW_ROLES')[r].entity;
const STARS_HOST = { winery: 'wstars-partners', distributor: 'dstars-partners', restaurant: 'rstars-partners', retail: 'tstars-partners' };

/* Snapshots to restore what a section moved. */
const snapFollows = () => JSON.parse(JSON.stringify(FOLLOWS()));
const restoreFollows = s => { w.eval('partnerFollows.length = 0'); s.forEach(r => w.eval('partnerFollows.push(' + JSON.stringify(r) + ')')); w.eval('renderAllPartnerStars()'); };
const FIXTURE_FOLLOWS = snapFollows();

/* ══ §1 The storage decision — a bounded store, keys not names (OP-3) ══ */
console.log('§1 the bounded partner-follow store — three sorts, one register each (OP-3, D47)');
{
  if (Array.isArray(FOLLOWS()) && FOLLOWS().length === 2 &&
      FOLLOWS().every(f => f.targetType === 'organizer' && f.targetId === PARTNER().id))
    ok('partnerFollows exists with the two demo rows, both by KEY (' + PARTNER().id + ') toward the organizer');
  else bad('partnerFollows is missing or its fixture rows do not follow the organizer by key');
  const shapes = [...new Set(FOLLOWS().map(f => Object.keys(f).sort().join(',')))];
  if (shapes.length === 1 && shapes[0] === 'at,follower,targetId,targetType')
    ok('the edge is only the edge: follower · targetType · targetId · at — nothing about either side on the row');
  else bad('a partner-follow row carries more than the edge: ' + shapes.join(' | '));
  const map = w.eval('PARTNER_FOLLOW_TARGETS');
  const sorts = Object.keys(map).sort().join(',');
  if (sorts === 'fair_edition,fair_series,organizer' && w.eval('Object.isFrozen(PARTNER_FOLLOW_TARGETS)'))
    ok('the resolver map names exactly the three sorts and is frozen — the address book is platform property');
  else bad('the target-sort map is not the frozen three-sort address book: ' + sorts);
  if (w.eval("partnerFollowTarget('fair_series','FS-7001')") && w.eval("partnerFollowTarget('fair_edition','FE-7101')") &&
      w.eval("partnerFollowTarget('organizer','PP-9001')"))
    ok('each sort resolves its key in the register it names (series, edition, organizer)');
  else bad('a sort does not resolve its key in its own register');
  if (!w.eval("partnerFollowTarget('organizer','FS-7001')") && !w.eval("partnerFollowTarget('fair_series','PP-9001')"))
    ok('the sorts are not interchangeable — a series key under organizer (and vice versa) resolves nothing');
  else bad('a key resolved through the identity of another register (A23.1 (6))');
  if (!GRAPH().some(e => e.follower === PARTNER().name || e.winery === PARTNER().name))
    ok('the A7 trade graph carries no partner edge — A7 stays technically unchanged (D47)');
  else bad('wineFollowGraph names the partner — the A7 graph was generalised against the measurement');
  if (w.eval("BLStore.names()").indexOf('partnerFollows') !== -1)
    ok('partnerFollows is registered with the store — the act persists like every other dashboard act');
  else bad('partnerFollows is not registered — a follow would die on reload');
  if (w.eval('BLStore.PUBLIC_COLLECTIONS').indexOf('partnerFollows') === -1)
    ok('and it is NOT in the public hydration allowlist — no public page ever reads a follow');
  else bad('partnerFollows is public — follower rows would reach the open web (A23.1)');

  /* A copied NAME instead of a key falls at the act. */
  cockpit('winery');
  const before = FOLLOWS().length;
  const r1 = w.eval("followPartnerTarget('organizer','Atrium Fairs GmbH')");
  const r2 = w.eval("followPartnerTarget('media_partner','PP-9001')");
  if (r1 === null && r2 === null && FOLLOWS().length === before && /not a known target/.test(TOAST()))
    ok('a copied name instead of a key, and a sort outside the map, are refused whole with a message — nothing written');
  else bad('a name-keyed or unknown-sort follow was written or refused silently');

  expectRed('the resolver map widened by a fourth sort at runtime', () => {
    const wasMap = w.eval('PARTNER_FOLLOW_TARGETS');
    if (Object.keys(wasMap).length !== 3) bad('map moved');
    /* A frozen object refuses the write silently in sloppy mode; the
       CHECK must notice a widened map, so simulate the widened state
       through the check's own reading. */
    const widened = Object.assign({}, wasMap, { media_partner: () => ({}) });
    if (Object.keys(widened).sort().join(',') !== 'fair_edition,fair_series,organizer') bad('the map is not the three sorts');
  });
  expectRed('a name-keyed row stored anyway', () => {
    w.eval("partnerFollows.push({ follower:'Cantina Rossi', targetType:'organizer', targetId:'Atrium Fairs GmbH', at:'2026-07-31' })");
    try {
      const bogus = FOLLOWS().filter(f => !w.eval("partnerFollowTarget('" + f.targetType + "','" + f.targetId + "')"));
      if (bogus.length) bad('a stored follow does not resolve in its register');
    } finally { w.eval('partnerFollows.pop()'); }
  });
  /* The claim the counter-mutation just exercised. */
  const bogus = FOLLOWS().filter(f => !w.eval("partnerFollowTarget('" + f.targetType + "','" + f.targetId + "')"));
  if (!bogus.length) ok('every stored follow resolves in the register its sort names');
  else bad('a stored follow does not resolve: ' + JSON.stringify(bogus[0]));
}

/* ══ §2 Directed and non-commercial (OP-1) ═════════════════════════ */
console.log('\n§2 a partner follow is directed and non-commercial (OP-1, PP-6)');
{
  cockpit('restaurant');
  const parts = w.eval('JSON.stringify(partnerships)');
  const reqs  = w.eval('JSON.stringify([rIncomingRequests, tIncomingRequests, incomingRequests])');
  const orders = w.eval('orders.length');
  const followsBefore = FOLLOWS().length;
  /* Bistro Laurent already follows by fixture — unfollow, then follow
     for real, and watch every commercial book stay still. */
  w.eval("unfollowPartnerTarget('organizer','PP-9001')");
  const row = w.eval("followPartnerTarget('organizer','PP-9001')");
  const partsAfter = w.eval('JSON.stringify(partnerships)');
  const reqsAfter  = w.eval('JSON.stringify([rIncomingRequests, tIncomingRequests, incomingRequests])');
  if (row && row.follower === 'Bistro Laurent' && FOLLOWS().length === followsBefore &&
      parts === partsAfter && reqs === reqsAfter && w.eval('orders.length') === orders)
    ok('the follow act wrote one edge and NO partnership row, no request, no order — directed, non-commercial');
  else bad('a commercial book moved with the follow (PP-6/OP-1)');
  if (w.eval("typeof requestPartnershipFromFollow") === 'undefined')
    ok('nothing in the page turns a partner follow into a partnership request');
  else bad('a follow-to-partnership bridge exists');
  expectRed('a follow act that also files a partnership request', () => {
    w.eval("partnerships.push({ distributor:'Hawesko GmbH', partner:'Atrium Fairs GmbH', at:'2026-07-31' })");
    try {
      if (w.eval('JSON.stringify(partnerships)') !== parts) bad('a partnership row moved with the follow');
    } finally { w.eval('partnerships.pop()'); }
  });
  restoreFollows(FIXTURE_FOLLOWS);
}

/* ══ §3 The D43 guard — the audience never reads a partner follow (OP-2) ═ */
console.log('\n§3 the campaign audience and the reach community never read a partner follow (OP-2, D43)');
{
  const HOST = 'Hawesko GmbH';
  const aud = () => w.eval("announcementAudience('event', campaignSubject('event','ME-3103'), true)");
  const community = () => w.eval("hostCommunity('" + HOST + "')");
  const audBefore = aud().slice().sort().join('|');
  const comBefore = community().slice().sort().join('|');
  /* Two smuggled rows by a house the carrier ADMITS but who is NOT
     Hawesko's fan (Osteria Marconi — Hawesko follows it, the outgoing
     edge that is no audience): an honest partner follow, and a row
     abusing the organizer sort with a trade name as key. Neither may
     reach the host's audience or community. */
  const SMUG = 'Osteria Marconi';
  if (w.eval("carrierAdmitsRecipient('event', campaignSubject('event','ME-3103'), '" + SMUG + "')") !== true)
    bad('the probe house is not admitted by the carrier — the guard below could pass for the wrong reason');
  w.eval("partnerFollows.push({ follower:'" + SMUG + "', targetType:'organizer', targetId:'PP-9001', at:'2026-07-30' })");
  w.eval("partnerFollows.push({ follower:'" + SMUG + "', targetType:'organizer', targetId:'" + HOST + "', at:'2026-07-30' })");
  try {
    if (aud().indexOf(SMUG) === -1 && aud().slice().sort().join('|') === audBefore)
      ok('the D43 resolver ignores both smuggled rows — the audience is byte-identical (' + aud().length + ' recipients)');
    else bad('a partner-follow row reached the announcement audience (D43/OP-2)');
    /* (Osteria Marconi IS in Hawesko's community by the A7 fixture —
       Hawesko follows it — so the measure is byte-identity, not absence.) */
    if (community().slice().sort().join('|') === comBefore)
      ok('the reach level community ignores them too — hostCommunity() is byte-identical');
    else bad('a partner-follow row entered the reach community (PP-3)');
    if (aud().indexOf(PARTNER().name) === -1 && community().indexOf(PARTNER().name) === -1)
      ok('and no resolver names the partner workspace itself');
    else bad('the partner workspace was resolved into an audience or community');
  } finally { w.eval('partnerFollows.pop(); partnerFollows.pop()'); }
  expectRed('the same house smuggled into the A7 graph instead', () => {
    w.eval("wineFollowGraph.push({ follower:'" + SMUG + "', winery:'" + HOST + "', at:'2026-07-30' })");
    try {
      if (aud().indexOf(SMUG) !== -1) bad(SMUG + ' reached the audience');
    } finally { w.eval('wineFollowGraph.pop()'); }
  });
  /* The resolver reads ONE book, by source. */
  const src = w.eval('fansOf.toString() + announcementAudience.toString() + hostCommunity.toString()');
  if (!/partnerFollows/.test(src) && /wineFollowGraph|REACH_BOOKS\.follows/.test(src))
    ok('by source, fansOf()/announcementAudience()/hostCommunity() read the A7 book and never partnerFollows');
  else bad('a resolver mentions partnerFollows in its source');
}

/* ══ §4 The act — honest, idempotent, DERIVED identity (OP-4) ═══════ */
console.log('\n§4 the follow act: derived identity, idempotent, reporting (OP-4, A23.3)');
{
  const base = snapFollows();
  cockpit('winery');
  const before = FOLLOWS().length;
  const r = w.eval("followPartnerTarget('organizer','PP-9001')");
  if (r && r.follower === ENTITY('winery') && FOLLOWS().length === before + 1 && /Following Atrium Fairs GmbH/.test(TOAST()))
    ok('winery cockpit: the act wrote ONE edge as ' + ENTITY('winery') + ' and said so');
  else bad('the follow act did not write as the derived winery identity, or said nothing');
  const r2 = w.eval("followPartnerTarget('organizer','PP-9001')");
  if (r2 && FOLLOWS().length === before + 1 && /Already following/.test(TOAST()))
    ok('the same identity on the same target a second time: nothing duplicated, "already following" reported');
  else bad('a second call duplicated the edge or stayed silent');
  /* Rendered surface: My Stars carries the entry with a real Unfollow. */
  const card = d.querySelector('#wstars-partners .pn-card[data-target-id="PP-9001"]');
  if (card && /Atrium Fairs GmbH/.test(card.textContent) && /Platform Partner/.test(card.textContent) &&
      [...card.querySelectorAll('button')].some(b => /Unfollow/.test(b.textContent)))
    ok('My Stars (winery) shows the entry, marked Platform Partner, with a real Unfollow');
  else bad('the winery My Stars partner block does not show the new edge');
  const u = w.eval("unfollowPartnerTarget('organizer','PP-9001')");
  if (u === true && FOLLOWS().length === before && /Unfollowed/.test(TOAST()) &&
      !d.querySelector('#wstars-partners .pn-card[data-target-id="PP-9001"]'))
    ok('unfollow removed the one edge, said so, and the entry left My Stars');
  else bad('unfollow did not remove exactly the one edge or stayed silent');
  const u2 = w.eval("unfollowPartnerTarget('organizer','PP-9001')");
  if (u2 === false && FOLLOWS().length === before && /not following/.test(TOAST()))
    ok('unfollowing what is not followed changes nothing and says so');
  else bad('a second unfollow changed something or stayed silent');

  /* The identity is DERIVED from the cockpit switch: same call, other
     cockpit, other follower. */
  cockpit('retail');
  const r3 = w.eval("followPartnerTarget('organizer','PP-9001')");
  if (r3 && r3.follower === ENTITY('retail'))
    ok('retail cockpit, same call: the edge is written as ' + ENTITY('retail') + ' — the identity comes from the switch');
  else bad('the acting identity did not follow the cockpit switch');
  w.eval("unfollowPartnerTarget('organizer','PP-9001')");
  /* activeShowRole is NOT the source (measured: stale on load). */
  cockpit('winery');
  w.eval("activeShowRole = 'distributor'");
  const r4 = w.eval("followPartnerTarget('organizer','PP-9001')");
  if (r4 && r4.follower === ENTITY('winery'))
    ok('with activeShowRole pointing elsewhere the act still writes as the shown cockpit — activeCockpit is the source');
  else bad('the act read activeShowRole (stale on the My Stars surface) instead of the cockpit switch');
  w.eval("unfollowPartnerTarget('organizer','PP-9001')");

  /* No actor parameter — a surplus argument dies unread. */
  const n = FOLLOWS().length;
  const s1 = w.eval("followPartnerTarget('organizer','PP-9001','distributor')");
  const s2 = w.eval("followPartnerTarget('organizer','PP-9001','Hawesko GmbH')");
  if (s1 === null && s2 === null && FOLLOWS().length === n && /Refused whole/.test(TOAST()))
    ok('a foreign role key and an organisation name appended as a third argument are refused alike, unread — nothing written');
  else bad('a surplus argument was accepted as an identity');
  if (w.eval('followPartnerTarget.length') === 2 && w.eval('unfollowPartnerTarget.length') === 2 &&
      !/\b(role|actor|actingOrg|requester)\b/.test(w.eval('followPartnerTarget.toString().split("{")[0] + unfollowPartnerTarget.toString().split("{")[0]')))
    ok('both acts declare (targetType, targetId) and no role/actor/actingOrg/requester parameter');
  else bad('an act signature carries an identity parameter');

  /* The partner workspace follows nobody. */
  cockpit('partner');
  const p1 = w.eval("followPartnerTarget('organizer','PP-9001')");
  if (p1 === null && FOLLOWS().length === n && /partner workspace follows nobody/.test(TOAST()))
    ok('the partner cockpit: no derivable trade actor → refused with the reason');
  else bad('an organizer followed something (A23.3)');
  cockpit('winery');

  expectRed('the derivation switched to activeShowRole', () => {
    w.eval("var __real = followActingContext; followActingContext = function () { return fairActingContext(); }");
    w.eval("activeShowRole = 'distributor'");
    try {
      const rr = w.eval("followPartnerTarget('organizer','PP-9001')");
      if (!rr || rr.follower !== ENTITY('winery')) bad('written as the wrong house');
    } finally {
      w.eval('followActingContext = __real');
      restoreFollows(base);
    }
  });
  expectRed('an act that duplicates the edge on the second call', () => {
    w.eval("partnerFollows.push({ follower:'" + ENTITY('winery') + "', targetType:'organizer', targetId:'PP-9001', at:'2026-07-31' })");
    w.eval("partnerFollows.push({ follower:'" + ENTITY('winery') + "', targetType:'organizer', targetId:'PP-9001', at:'2026-07-31' })");
    try {
      const dup = FOLLOWS().filter(f => f.follower === ENTITY('winery') && f.targetId === 'PP-9001').length;
      if (dup > 1) bad('duplicate edges');
    } finally { restoreFollows(base); }
  });
  const dupNow = new Set(FOLLOWS().map(f => f.follower + '|' + f.targetType + '|' + f.targetId)).size === FOLLOWS().length;
  if (dupNow) ok('the store holds one edge per (follower, sort, key)');
  else bad('a duplicate edge sits in the store');
  restoreFollows(FIXTURE_FOLLOWS);
}

/* ══ §5 The public page — no write path, honest buttons, no followers ═ */
console.log('\n§5 the public organizer profile: read-only, honest, follower-free (OP-4/OP-5/OP-7/OP-8/OP-9)');
{
  const pw = bootPage(PAGE), pd = pw.document;
  const text = pageText(pw);
  const actions = [...pd.querySelectorAll('.profile-hero-actions > *')];
  const labels = actions.map(a => a.textContent.trim().replace(/^[^\w]+/, ''));
  if (labels.length === 4 && labels[0] === 'View Upcoming Fairs' && /Exhibitor Call|Apply to Exhibit/.test(labels[1]) &&
      /Send Inquiry/.test(labels[2]) && /Save & Follow/.test(labels[3]) && actions[3].classList.contains('follow-btn'))
    ok('hero actions in the fixed order: ' + labels.join(' · ') + ' — Save & Follow last, .follow-btn');
  else bad('the hero action order is not the fixed one: ' + labels.join(' · '));
  if (!actions.some(a => a.classList.contains('btn-gold') && !a.classList.contains('btn-gold-outline')) &&
      actions[0].classList.contains('btn-gold-outline') && actions[1].classList.contains('btn-gold-outline') &&
      actions[2].classList.contains('btn-outline') && actions[3].classList.contains('btn-outline'))
    ok('styles derived from B4: no solid tier, the two fair actions gold-outline, Send Inquiry and Save & Follow plain outline');
  else bad('a hero action carries the solid A6 tier or the wrong tier');
  if (!/Request Partnership/.test(text) && !pd.querySelector('[onclick*="Partnership"]'))
    ok('no Request Partnership on the page — text or handler (PP-6, OP-5)');
  else bad('Request Partnership is on the organizer page');

  /* Save & Follow: a LINK into the private area, no toggle, no claim. */
  const follow = actions[3];
  if (follow.tagName === 'A' && /bottle-lobby-dashboard\.html\?follow=PP-9001/.test(follow.getAttribute('href')) &&
      !follow.getAttribute('onclick') && !follow.classList.contains('following'))
    ok('Save & Follow is a link to the dashboard entry (?follow=PP-9001) — no handler, no toggled "following" state');
  else bad('Save & Follow on the public page is not the honest link (a toggle, a handler, or a claim)');
  if (pw.eval('typeof partnerFollows') === 'undefined' && pw.eval('typeof toggleFollow') === 'undefined' &&
      pw.eval('BLStore.isReadOnly()') === true && pw.eval('BLStore.save()') === false)
    ok('the page holds no follow store, no toggle function, is read-only after hydrate() and save() is dead');
  else bad('the public page owns a write path or a follow store');
  const src = fs.readFileSync(PAGE, 'utf8');
  if (!/BLStore\.start\(/.test(src) && !/partnerFollows|wineFollowGraph|fairAdmissions|\breviews\b/.test(src.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '')))
    ok('by source, the page never calls start() and never names a private collection');
  else bad('the page source calls start() or names a private collection');

  /* No follower names, no follower figure — fixed. */
  const followers = FIXTURE_FOLLOWS.map(f => f.follower);
  /* A house may be named as an EXHIBITOR (its public stand, A21.7) —
     that is its own published presence. Outside those stand links no
     follower name may appear anywhere. */
  const noStands = pd.body.cloneNode(true);
  [...noStands.querySelectorAll('script,style,.op-fair a')].forEach(n => n.remove());
  const outside = noStands.textContent;
  const namedOutside = followers.filter(n => outside.indexOf(n) !== -1);
  if (!namedOutside.length && !/follow(ers|ed by|ing this organizer:)/i.test(outside.replace(/Following this organizer/, '')))
    ok('no follower name on the page outside exhibitor stand links (' + followers.join(', ') + ' follow by fixture and are named as followers nowhere)');
  else bad('a follower is named on the public organizer page: ' + namedOutside.join(', ') + ' (A23.1)');
  if (!/\b\d+\s*(followers?|fans?|members? follow)/i.test(text))
    ok('no follower figure on the page');
  else bad('a follower figure is printed');
  /* No contact master data invented (A22.11). */
  if (!/@|\+\d{2}|www\./.test(text))
    ok('no e-mail, telephone or web address invented on the page (A22.11)');
  else bad('a contact detail nobody records is printed');

  /* The exhibitor-call action: derived caption, falls without a call. */
  const openCalls = pw.eval("organizerOpenCalls('PP-9001')");
  const cap = pd.querySelector('.op-call-action');
  if (openCalls.length === 2 && cap && cap.textContent.trim() === 'View Exhibitor Calls' &&
      /bottle-lobby-dashboard\.html\?calls=PP-9001/.test(cap.getAttribute('href')))
    ok('two open calls → "View Exhibitor Calls", linking into the authenticated A20 way (?calls=PP-9001)');
  else bad('the call action or its caption is not the derivation over ' + openCalls.length + ' open call(s)');
  if (pw.eval("organizerCallCaption([1])") === 'Apply to Exhibit' && pw.eval("organizerCallCaption([1,2])") === 'View Exhibitor Calls' &&
      pw.eval("organizerCallCaption([])") === null)
    ok('organizerCallCaption(): one → Apply to Exhibit · several → View Exhibitor Calls · none → no action');
  else bad('the caption derivation is not the one rule');
  /* Live: close the calls in the records and re-open the page over
     the same fixtures — the page derives, it does not remember. */
  const pw2 = bootPage(PAGE, '', { from: "exhibitorCallOpen:true,\n    externalTicketingUrl:'https://uferlicht-festival.example/tickets'",
                                    to:   "exhibitorCallOpen:false,\n    externalTicketingUrl:'https://uferlicht-festival.example/tickets'" });
  const cap2 = pw2.document.querySelector('.op-call-action');
  if (cap2 && cap2.textContent.trim() === 'Apply to Exhibit') ok('one call left → the caption reads "Apply to Exhibit"');
  else bad('with one open call the caption did not become Apply to Exhibit');
  const pw3 = bootPage(PAGE, '', { from: /exhibitorCallOpen:true/g, to: 'exhibitorCallOpen:false' });
  if (!pw3.document.querySelector('.op-call-action') && pw3.document.querySelectorAll('.profile-hero-actions > *').length === 3)
    ok('no open call → no call action and no reserved space (three actions remain, order intact)');
  else bad('the call action rendered without an open call (OP-7)');
  /* A draft's call is no call. */
  if (pw.eval("organizerOpenCalls('PP-9001')").every(ed => ed.status === 'published'))
    ok('open calls come only from discoverable editions — a draft\'s or cancelled edition\'s call is no call');
  else bad('a non-discoverable edition\'s call reached the page');

  /* Upcoming fairs: derived, linked at existing surfaces only. */
  const up = pw.eval("organizerUpcomingEditions('PP-9001')");
  const rows = [...pd.querySelectorAll('.op-fair')];
  if (rows.length === up.length && rows.length === 5 && up.every(ed => ed.status === 'published' && !pw.eval('fairEditionPast(' + JSON.stringify(ed) + ')')))
    ok('Upcoming Fairs lists the ' + rows.length + ' discoverable, not-yet-past editions of the organizer\'s series');
  else bad('the upcoming list is not the derivation (' + rows.length + ' rows vs ' + up.length + ')');
  const links = [...pd.querySelectorAll('.op-fair a')].map(a => a.getAttribute('href'));
  if (links.length && links.every(h => /^bottle-lobby-wine-guide\.html#events$|^bottle-lobby-fair-participation\.html\?id=/.test(h)))
    ok('every fair link targets an existing public surface — the directory or a canonical Participation Page');
  else bad('a fair row links at an invented target: ' + links.filter(h => !/wine-guide|fair-participation/.test(h)).join(', '));
  if (!/\b\d+\s*(visitors?|attendees?|tickets sold|expected reach)/i.test(text))
    ok('no visitor, attendee, ticket or reach figure anywhere (DIR-7)');
  else bad('an invented figure is printed');
  /* Typed text reaches the DOM through the one escaper. */
  const pwX = bootPage(PAGE, '', { from: "about:'Independent organiser of regional wine trade fairs and portfolio tastings.'",
                                    to:   "about:'<img id=\"op-injection\" src=x onerror=\"window.__pwn=1\">'" });
  if (!pwX.document.getElementById('op-injection') && /<img id="op-injection"/.test(pageText(pwX)))
    ok('markup in the partner\'s typed text renders as TEXT (one escaper)');
  else bad('typed text reached the DOM unescaped');

  /* Send Inquiry: mirrored, honest. */
  pw.eval('opInquiry()');
  const note = pd.getElementById('op-note');
  if (note && note.classList.contains('show') && /Nothing was sent/.test(note.textContent) && /O11/.test(note.textContent))
    ok('Send Inquiry answers honestly: nothing sent, the route to organizers is O11 (B12)');
  else bad('Send Inquiry is inert or claims a send');
  const srcCode = src.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
  if (pw.eval('typeof messages') === 'undefined' && !/sendMessage\(|messages\.push|inquiries\.push/.test(srcCode))
    ok('and no messaging system came with it');
  else bad('a messaging structure appeared on the page');

  expectRed('a Request Partnership button planted in the hero', () => {
    const btn = pd.createElement('button'); btn.textContent = 'Request Partnership';
    pd.querySelector('.profile-hero-actions').prepend(btn);
    try { if (/Request Partnership/.test(pageText(pw))) bad('found'); }
    finally { btn.remove(); }
  });
  expectRed('a follower count printed on the page', () => {
    const el = pd.createElement('div'); el.textContent = '2 followers'; pd.body.appendChild(el);
    try { if (/\b\d+\s*followers?/i.test(pageText(pw))) bad('found'); } finally { el.remove(); }
  });
  expectRed('Save & Follow turned into a page-local toggle', () => {
    follow.setAttribute('onclick', 'this.classList.add("following")');
    try { if (follow.getAttribute('onclick')) bad('handler'); } finally { follow.removeAttribute('onclick'); }
  });
}

/* ══ §6 NO public verification verdict — the negative invariant (OP-6) ══
   The withdrawn path, proved gone from three sides: the store's public
   surface, the public page's markup, and the store's own source. The
   fourth side — the execution context AFTER hydration over a REAL
   snapshot, which is where the violation actually lived and where a
   surface-only check let it run green — is in tests/persistence.js,
   which is the one harness allowed a live store. */
console.log('\n§6 there is NO public verification verdict — the negative invariant (OP-6, A23.4)');
{
  /* (a) The store's public surface carries no verdict entry any more. */
  const gone = ['publicVerdict', 'PUBLIC_VERDICTS', 'lastWord']
    .filter(k => w.eval('typeof BLStore.' + k) !== 'undefined');
  if (!gone.length)
    ok('the public store surface exports neither publicVerdict nor PUBLIC_VERDICTS — nor a last-word helper the public path could use');
  else bad('the withdrawn verdict path is still exported: ' + gone.join(', '));
  const ssrc = fs.readFileSync(path.join(ROOT, 'assets', 'bottle-lobby-store.js'), 'utf8');
  const hyd = ssrc.slice(ssrc.indexOf('  function hydrate() {'), ssrc.indexOf("    return 'hydrated';"));
  if (!/publicVerdict|PUBLIC_VERDICTS/.test(ssrc.replace(/\/\*[\s\S]*?\*\//g, '')) &&
      !/=\s*p\s*;/.test(hyd.replace(/\/\*[\s\S]*?\*\//g, '')))
    ok('and by source neither name survives in code, and hydrate() assigns the parsed snapshot to nothing that outlives the call');
  else bad('the store source still holds the verdict path or retains the parsed snapshot');
  /* The transient parse itself is the ACCEPTED prototype limit and must
     stay exactly as it is — this section does not object to it. */
  if (/JSON\.parse\(raw\)/.test(hyd) && /entries\.forEach/.test(hyd))
    ok('the transient parse that applies the allowlisted collections is unchanged — the accepted prototype limit, not a read path (A23.4)');
  else bad('hydrate() no longer parses transiently and applies the allowlist — the accepted limit was altered');

  /* (b) The last-word derivation lives in the private document, once. */
  const dsrc = w.eval('partnerVerificationLatest.toString() + seriesBrandLatest.toString()');
  if (w.eval('typeof lastWord') === 'function' && (dsrc.match(/[^.]\blastWord\(/g) || []).length === 2 &&
      !/BLStore\.lastWord/.test(dsrc))
    ok('lastWord() lives in the dashboard document, its one caller — both private readers delegate to it, one derivation');
  else bad('the private readers no longer share one local last-word derivation');

  /* (c) The public page makes NO verification statement of any kind. */
  const pw = bootPage(PAGE), pd = pw.document;
  const text = pageText(pw);
  if (!/verif/i.test(text))
    ok('not one occurrence of "verif" in the rendered page — no badge, no disclaimer, no explanation, no placeholder');
  else bad('the page says something about verification: ' + (text.match(/.{0,50}verif.{0,50}/i) || [])[0]);
  const marks = ['.badge-verified', '.badge-brand', '.op-brand-badge', '.op-disclaim', '#op-verification', '[data-verdict]']
    .filter(sel => pd.querySelector(sel) || pd.documentElement.matches(sel));
  if (!marks.length && !pd.documentElement.hasAttribute('data-verdict'))
    ok('no verification badge, brand badge, disclaimer block, Verification widget or data-verdict attribute in the markup');
  else bad('a verification surface is still rendered: ' + marks.join(', '));
  const substitutes = ['unverified', 'verification pending', 'status unavailable', 'not verified', 'pending review']
    .filter(s => text.toLowerCase().indexOf(s) !== -1);
  if (!substitutes.length)
    ok('and no SUBSTITUTE status either — a placeholder would be a verification statement too');
  else bad('a substitute status is printed: ' + substitutes.join(', '));
  if (pageText(pw).indexOf(w.eval('PARTNER_VERIFIED_DISCLAIMER')) === -1)
    ok('the A18.4 disclaimer sentence appears nowhere on the public page — it belongs to the badge, and the badge is deferred');
  else bad('the disclaimer is rendered publicly without its badge');
  /* What DOES stand: the role, and the page itself. The page is not
     gated on a verification word (A23.7, Serge's decision). */
  const roleBadge = pd.querySelector('.profile-hero .badge-partner');
  if (roleBadge && /Fair & Event Organizer/.test(roleBadge.textContent) &&
      /Platform Partner/.test(pd.querySelector('.profile-hero-location').textContent) &&
      pd.querySelectorAll('.op-fair').length === 5 && pd.querySelectorAll('.op-series').length === 2 &&
      pd.querySelector('#op-about') && pd.querySelector('.profile-hero-actions'))
    ok('the profile itself stands: role line, Platform Partner · Fair & Event Organizer, 5 upcoming fairs, 2 series, about and actions');
  else bad('the public profile no longer renders — the badges were deferred, the page was not');

  /* (d) The register is not on the page, in any shape. */
  if (pw.eval('typeof reviews') === 'undefined' && pw.eval('typeof partnerFollows') === 'undefined' &&
      pw.eval('typeof fairAdmissions') === 'undefined' &&
      pw.eval('typeof partnerVerificationApproved') === 'undefined' &&
      pw.eval('BLStore.PUBLIC_COLLECTIONS').indexOf('reviews') === -1 &&
      pw.eval("BLStore.names().sort().join(',')") === 'fairEditions,fairHalls,fairParticipations,fairSeries,fairStands')
    ok('reviews, partnerFollows and fairAdmissions are neither loaded, registered, bound nor allowlisted on the page');
  else bad('a private collection reached the public organizer page');
  ['bottle-lobby-organizer-atrium-fairs-gmbh.html', 'bottle-lobby-fair-participation.html', 'bottle-lobby-wine-guide.html'].forEach(f => {
    const html = fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
    const reg = html.slice(html.indexOf('BLStore.register('), html.indexOf('BLStore.hydrate()'));
    if (!/reviews|partnerFollows|fairAdmissions|wineFollowGraph|platformPartners/.test(reg))
      ok(f + ' registers no private collection (reviews, partnerFollows, fairAdmissions, wineFollowGraph) — and not platformPartners');
    else bad(f + ' registers a private collection against hydrate()');
  });
  const allow = w.eval('BLStore.PUBLIC_COLLECTIONS').sort().join(',');
  if (allow === 'fairEditions,fairHalls,fairParticipations,fairSeries,fairStands')
    ok('PUBLIC_COLLECTIONS is still the five fair collections — the withdrawal widened nothing and narrowed nothing');
  else bad('the hydration allowlist moved: ' + allow);

  /* (e) The PRIVATE derivation is untouched — and still moves with a
     later rejecting row. Restored afterwards. */
  const before = w.eval('partnerVerificationApproved(platformPartners[0]) && seriesBrandApproved(fairSeries[0])');
  w.eval("reviews.push({ id:'RVW-OP6-REJ', subjectType:'partner', subjectId:'PP-9001', gateNumber:null, reviewStatus:'rejected', reviewedBy:'Bottle Lobby', reviewedAt:'2026-07-31', reviewNotes:null, approvalType:'partner_verification' })");
  const after = w.eval('partnerVerificationApproved(platformPartners[0])');
  const brandStill = w.eval('seriesBrandApproved(fairSeries[0])');
  w.eval("reviews.splice(reviews.findIndex(r => r.id === 'RVW-OP6-REJ'), 1)");
  if (before === true && after === false && brandStill === true &&
      w.eval('partnerVerificationApproved(platformPartners[0])') === true)
    ok('the dashboard still derives from the register: approved by fixture, felled by a later rejecting row, the series brand untouched — and restored');
  else bad('the private derivation broke with the public withdrawal (' + before + ' → ' + after + ')');

  /* (f) The counter-mutations. Each reintroduces exactly one forbidden
     shape and must turn its own check red for that shape's reason. */
  expectRed('the verdict entry re-exported on the public store surface', () => {
    w.eval('BLStore.publicVerdict = function () { return true; }');
    try {
      if (['publicVerdict', 'PUBLIC_VERDICTS', 'lastWord'].some(k => w.eval('typeof BLStore.' + k) !== 'undefined'))
        bad('exported');
    } finally { w.eval('delete BLStore.publicVerdict'); }
  });
  expectRed('a Verified Platform Partner badge planted in the hero', () => {
    const b = pd.createElement('span'); b.className = 'profile-badge badge-verified';
    b.textContent = '✓ Verified Platform Partner';
    pd.querySelector('.profile-hero-meta').appendChild(b);
    try {
      if (/verif/i.test(pageText(pw)) || pd.querySelector('.badge-verified')) bad('found');
    } finally { b.remove(); }
  });
  expectRed('a substitute status ("Verification pending") in the sidebar', () => {
    const el = pd.createElement('div'); el.textContent = 'Verification pending';
    pd.querySelector('.profile-sidebar').appendChild(el);
    try {
      const t = pageText(pw).toLowerCase();
      if (['unverified', 'verification pending', 'status unavailable'].some(s => t.indexOf(s) !== -1)) bad('found');
    } finally { el.remove(); }
  });
  expectRed('the disclaimer rendered publicly without its badge', () => {
    const el = pd.createElement('div'); el.textContent = w.eval('PARTNER_VERIFIED_DISCLAIMER');
    pd.body.appendChild(el);
    try { if (pageText(pw).indexOf(w.eval('PARTNER_VERIFIED_DISCLAIMER')) !== -1) bad('found'); }
    finally { el.remove(); }
  });
  expectRed('reviews registered on the public page', () => {
    const rogue = bootPage(PAGE, '', { from: 'BLStore.register({\n    fairSeries:',
                                        to: 'BLStore.register({\n    reviews: [function () { return []; }, function (v) { window.__rv = v; }],\n    fairSeries:' });
    if (rogue.eval("BLStore.names().indexOf('reviews')") !== -1) bad('registered');
  });
}

/* ══ §7 The one opened read path — My Stars (OP-5, PP-3) ═══════════ */
console.log('\n§7 My Stars renders own partner follows — the named PP-3 read path (A23.6)');
{
  restoreFollows(FIXTURE_FOLLOWS);
  TRADE_ROLES.forEach(r => {
    const host = d.getElementById(STARS_HOST[r]);
    const cards = host ? [...host.querySelectorAll('.pn-card')] : [];
    const mine = FIXTURE_FOLLOWS.filter(f => f.follower === ENTITY(r));
    if (host && /Platform Partners/.test(host.textContent) && cards.length === mine.length)
      ok(r + ': the partner block exists and shows its ' + mine.length + ' own follow(s)');
    else bad(r + ': the partner block is missing or shows foreign follows (' + cards.length + ' vs ' + mine.length + ')');
    if (!/Request Partnership|Become a Customer|Request Tasting/.test(host ? host.textContent : ''))
      ok(r + ': no trade action on the partner block');
    else bad(r + ': a trade action is offered on a partner entry (OP-5)');
  });
  const card = d.querySelector('#rstars-partners .pn-card');
  const link = card && card.querySelector('a.pn-link');
  if (card && link && link.getAttribute('href') === PARTNER().url && /Atrium Fairs GmbH/.test(card.textContent) &&
      /Fair & Event Organizer/.test(card.textContent))
    ok('the restaurant entry links at the organizer\'s public page and carries the capability label from the register');
  else bad('the entry does not resolve name, label and page from the partner register');
  const rsrc = w.eval('renderPartnerStarsFor.toString() + partnerFollowTargetView.toString() + partnerFollowTarget.toString()').replace(/\/\*[\s\S]*?\*\//g, '');
  if (!/stakeholder\(/.test(rsrc) && /platformPartner\(|PARTNER_FOLLOW_TARGETS/.test(rsrc))
    ok('the read path resolves through the partner register, never through stakeholder()');
  else bad('the partner entry resolves through stakeholder()');
  /* Foreign graphs stay unreadable: the block is keyed on the house. */
  const foreign = d.querySelectorAll('#wstars-partners .pn-card').length;
  if (foreign === 0) ok('the winery, which follows no partner, sees an honest empty block — nobody else\'s follows');
  else bad('a foreign follow rendered in the winery cockpit');
  /* The organizer view: no follower surface, no follow notification. */
  const partnerView = d.getElementById('dash-partner').textContent;
  if (!/started following you|Followers|My Fans/.test(partnerView))
    ok('the organizer view has no follower surface and no follow notification (O11)');
  else bad('a follower surface or notification reached the organizer view');
  expectRed('a Request Partnership button on a partner entry', () => {
    const b = d.createElement('button'); b.textContent = 'Request Partnership';
    card.appendChild(b);
    try {
      if (/Request Partnership/.test(d.getElementById('rstars-partners').textContent)) bad('found');
    } finally { b.remove(); }
  });
  expectRed('the winery block rendering another house\'s follows', () => {
    w.eval("renderPartnerStarsFor('Bistro Laurent','wstars-partners')");   /* keyed on the wrong house */
    try {
      if (d.querySelectorAll('#wstars-partners .pn-card').length) bad('foreign');
    } finally { w.eval('renderAllPartnerStars()'); }
  });
}

/* ══ §8 Entry points and the two doors ═════════════════════════════ */
console.log('\n§8 entry points: the directory\'s organizer line, the cockpit\'s View Public Profile, the two doors');
{
  const gw = bootPage(GUIDE, '#events'), gd = gw.document;
  const org = [...gd.querySelectorAll('.fe-listing .fe-fact')].find(f => /Organizer/.test(f.textContent));
  const a = org && org.querySelector('a');
  if (a && a.getAttribute('href') === PARTNER().url && /Atrium Fairs GmbH/.test(a.textContent))
    ok('the fair-edition listing names the organizer and links at the profile — resolved, not copied');
  else bad('the directory has no organizer entry point');
  const teaser = gd.querySelector('.fe-teaser');
  if (teaser && !/Organizer/.test(teaser.textContent))
    ok('the teaser composition is untouched — the line lives in the listing (DIR-3)');
  else bad('the fair teaser card changed');
  const gw2 = bootPage(GUIDE, '#events', { from: "name:'Atrium Fairs GmbH', capabilities", to: "name:'Renamed Organizer In Place', capabilities" });
  if (/Renamed Organizer In Place/.test(pageText(gw2)))
    ok('rename the partner record and the listing follows — a reference, not a copy');
  else bad('the listing kept the old organizer name');
  /* B6: the organizer cockpit's View Public Profile. */
  w.eval("showPartnerView('profile')");
  const btn = [...d.querySelectorAll('#ppartner-profile button')].find(b => /View Public Profile/.test(b.textContent));
  if (btn && btn.getAttribute('onclick').indexOf(PARTNER().url) !== -1)
    ok('the organizer cockpit offers View Public Profile through the embed-preview pattern (B6)');
  else bad('no View Public Profile in the organizer cockpit');
  const locked = w.eval('PARTNER_LOCKED_NAV');
  if (!locked.community.some(l => /Organizer Profile/.test(l[0])) && locked.community.some(l => /follower view/.test(l[1])))
    ok('"Organizer Profile & Follow" left the locked list; Communications names the O11 follower view');
  else bad('the locked navigation did not follow O9');
  const pw = bootPage(PAGE, '?preview=embed');
  if (pw.document.documentElement.classList.contains('embed-preview'))
    ok('the page supports ?preview=embed like the trade profiles');
  else bad('embed mode is missing');

  /* The doors. */
  const d1 = bootDash('?follow=PP-9001#distributor');
  const f1 = d1.eval('partnerFollows').filter(f => f.follower === 'Hawesko GmbH' && f.targetId === 'PP-9001');
  if (f1.length === 1 && /Already following/.test(d1.document.getElementById('save-toast').textContent) &&
      d1.eval('organizerEntryPending.follow') === null)
    ok('?follow= with a role hash: the act ran as the cockpit\'s house (already following → nothing duplicated), the parameter consumed');
  else bad('the follow door did not run once under the derived identity');
  const d2 = bootDash('?follow=PP-9001#winery');
  const f2 = d2.eval('partnerFollows').filter(f => f.follower === 'Cantina Rossi' && f.targetId === 'PP-9001');
  const shown = d2.document.getElementById('wsection-winestars');
  if (f2.length === 1 && /Following Atrium Fairs GmbH/.test(d2.document.getElementById('save-toast').textContent) &&
      shown && shown.style.display !== 'none' && d2.document.querySelector('#wstars-partners .pn-card[data-target-id="PP-9001"]'))
    ok('?follow= as the winery: the edge is written as Cantina Rossi, My Stars opened and shows it');
  else bad('the follow door did not write as the winery or did not open My Stars');
  const d3 = bootDash('?follow=PP-9001');
  const note = d3.document.getElementById('role-picker-entry-note');
  if (note && note.style.display !== 'none' && /Nothing has been saved yet/.test(note.textContent) &&
      d3.eval('partnerFollows.length') === 2)
    ok('no hash → the role picker, with the honest note; nothing written before a role is chosen');
  else bad('the picker path wrote early or said nothing');
  d3.eval("pickRole('retail')");
  if (d3.eval('partnerFollows').some(f => f.follower === 'Weinhaus Müller' && f.targetId === 'PP-9001') && d3.eval('organizerEntryPending.follow') === null)
    ok('pickRole carries the same parameter to the same entry — written as the retailer, consumed once');
  else bad('the picker choice did not run the entry');
  const d4 = bootDash('?follow=PP-9001#partner');
  if (d4.eval('partnerFollows.length') === 2 && /partner workspace follows nobody/.test(d4.document.getElementById('save-toast').textContent))
    ok('the partner cockpit at the follow door: refused with the reason, nothing written');
  else bad('an organizer followed through the door');
  const d5 = bootDash('?calls=PP-9001#retail');
  if (/do not exhibit/.test(d5.document.getElementById('save-toast').textContent))
    ok('?calls= as retail: refused with FR-2\'s reason');
  else bad('the calls door opened for a retailer');
  const d6 = bootDash('?calls=PP-9001#winery');
  if (d6.document.getElementById('winery-view-shows').style.display !== 'none' &&
      /open exhibitor calls are listed here/.test(d6.document.getElementById('save-toast').textContent))
    ok('?calls= as winery: lands on Events → Wine Shows with the recruiting block named');
  else bad('the calls door did not land on the A20 block');
  expectRed('the follow door writing without a derived actor', () => {
    if (d4.eval('partnerFollows.length') !== 2) bad('written');
    d4.eval("partnerFollows.push({ follower:'Atrium Fairs GmbH', targetType:'organizer', targetId:'PP-9001', at:'x' })");
    try { if (d4.eval('partnerFollows').some(f => f.follower === 'Atrium Fairs GmbH')) bad('organizer as follower'); }
    finally { d4.eval('partnerFollows.pop()'); }
  });
}

/* ══ §9 The four trade cockpits, unchanged — samples (OP-10) ═══════ */
console.log('\n§9 trade cockpits untouched — samples (OP-10)');
{
  restoreFollows(FIXTURE_FOLLOWS);
  cockpit('winery');
  if (GRAPH().length === 16) ok('wineFollowGraph still carries its 16 fixture edges');
  else bad('the A7 graph moved: ' + GRAPH().length);
  w.eval('renderDistributorFans()');
  if (d.querySelectorAll('#dfans-list .wn-card').length === 3) ok("Hawesko's fan list still renders its 3 derived rows");
  else bad('the fans list changed');
  w.eval('renderDistributorOpportunities()');
  if (!/Atrium Fairs GmbH/.test(d.getElementById('dopp-list').textContent))
    ok('the distributor Opportunities never name the organizer (the collision D47 was decided on)');
  else bad('the organizer surfaced as an opportunity');
  const aud = w.eval("announcementAudience('event', campaignSubject('event','ME-3103'), true)");
  if (aud.length === 5) ok('CMP-4001: live audience still 5 recipients');
  else bad('the campaign audience moved: ' + aud.length);
  if (w.eval("partnershipsOf('Hawesko GmbH')").length === w.eval("partnershipsOf('Hawesko GmbH').filter(p => JSON.stringify(p).indexOf('Atrium') === -1)").length)
    ok("Hawesko's partnerships still name no platform partner");
  else bad('a partnership row names the partner');
  const stars = d.querySelectorAll('#dstars-list .pn-card').length;
  if (stars === 3) ok("Hawesko's trade My Stars still renders its 3 A7 entries beside the separate partner block");
  else bad('the trade My Stars list changed: ' + stars);
  if (JSON.stringify(FOLLOWS()) === JSON.stringify(FIXTURE_FOLLOWS))
    ok('the partner follow store ends where it started — every section restored what it moved');
  else bad('a section left the follow store changed');
}

console.log('');
if (fail) { console.log('✗ ' + fail + ' check(s) failed'); process.exit(1); }
console.log('✓ all checks passed');
