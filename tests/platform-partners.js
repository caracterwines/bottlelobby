/* ═══════════════════════════════════════════════════════════════════
   PLATFORM PARTNERS — A18, PP-1..PP-5
   -------------------------------------------------------------------
   The foundation pass promises mostly ABSENCES: no trade surface in
   the organizer workspace, no partner in any trade enumeration, no
   media_partner instantiation anywhere, no typed verification flag.
   As in tests/campaigns.js, every invariant is measured twice:

     · the CLAIM: the rule holds;
     · the COUNTER-MUTATION: the state or the function is changed so
       that the rule is broken, the same check runs again, and it MUST
       come back red.

   WHAT THIS HARNESS SECURES — AND WHAT IT DOES NOT. The absence
   checks in §2 pin the AS-IS STATE OF DURCHGANG 11: the partner
   workspace takes part in no trade logic today. They do NOT forbid a
   later, MEASURED pass from opening a named read path — an organizer
   follow (A18.5) is the announced first candidate. When that pass
   comes, it moves these assertions deliberately, with its measurement
   in hand; until then, any partner leaking into ORDER_ROLES, the
   reach taxonomy, the follow graph or a campaign audience is a bug.
═══════════════════════════════════════════════════════════════════ */
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
  /* jsdom's opaque origin cannot rewrite the URL; the demo bar can. */
  w.eval('history.replaceState = function () {}');
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
const PARTNERS = () => w.eval('platformPartners');
const PARTNER  = () => PARTNERS()[0];
const CAPS     = () => w.eval('PARTNER_CAPABILITIES');
const RENDER   = () => w.eval('renderPartnerCockpit()');
const TRADE_ROLES = ['winery', 'distributor', 'restaurant', 'retail'];

/* ── §1 Workspace separation, measured on the rendered surface ─────
   The organizer subtree carries no trade section and no A6/order
   action. The check reads the LIVE DOM of sidebar + dashboard, so the
   counter-mutation can break it by hanging a trade section in. */
console.log('§1 workspace separation — no trade surface in the organizer view');

const TRADE_MARKS = [
  'showOrders(', 'placeOrder(', 'orderItem(', 'handleOfferRequest',
  'handleDealRequest', 'addWineToBuyerList', 'showWineShows(', 'showMyEvents(',
  'Request Partnership', 'requestPartnership'
];
const TRADE_SECTIONS = ['Commerce', 'My Portfolio', 'Network', 'Discover'];

function partnerSubtree() {
  return d.getElementById('sidebar-partner').innerHTML +
         d.getElementById('dash-partner').innerHTML;
}
function assertNoTradeSurface() {
  const html = partnerSubtree();
  const markHit = TRADE_MARKS.find(m => html.indexOf(m) !== -1);
  if (markHit) bad('trade action "' + markHit + '" is reachable from the organizer view (PP-1)');
  else ok('no trade action in the organizer subtree');
  const labels = Array.from(d.querySelectorAll('#sidebar-partner .nav-section-label'))
    .map(e => e.textContent.trim());
  const secHit = labels.find(l => TRADE_SECTIONS.indexOf(l) !== -1);
  if (secHit) bad('trade section "' + secHit + '" in the organizer sidebar (PP-1)');
  else ok('no trade section label in the organizer sidebar');
}
assertNoTradeSurface();

/* No dead links: every sidebar row is either one of the live entries
   or a LOCKED row with its reason on the row (C2). */
{
  const rows = Array.from(d.querySelectorAll('#sidebar-partner .nav-item'));
  const badRow = rows.find(r => {
    if (r.classList.contains('nav-locked'))
      return !(r.querySelector('.nav-lock-why') && r.querySelector('.nav-lock-why').textContent.trim());
    return !(r.getAttribute('onclick') || '').startsWith('showPartnerView(');
  });
  if (badRow) bad('sidebar row is neither live nor locked-with-reason: "' + badRow.textContent.trim().slice(0, 40) + '"');
  else ok(rows.length + ' sidebar rows: each live (showPartnerView) or locked with a reason on the row');
  const lockedNav = w.eval('PARTNER_LOCKED_NAV');
  const expected = lockedNav.fairs.length + lockedNav.community.length;
  const locked = rows.filter(r => r.classList.contains('nav-locked')).length;
  if (locked === expected) ok('all ' + expected + ' locked target-navigation entries render');
  else bad('locked entries rendered: ' + locked + ', PARTNER_LOCKED_NAV names ' + expected);
}

/* O10 (A24): the Opportunities view is the newest organizer surface, and
   PP-1 is exactly the question it has to answer — the ONE action on it is
   a RECRUITING act (inviteToFair, the same act the edition's recruiting
   block carries), never a trade action. Rendered first, because a view
   that has never rendered proves nothing about what it renders. */
{
  w.eval("showPartnerView('opportunities')");
  assertNoTradeSurface();
  const root = d.getElementById('popp-root');
  const btns = root ? Array.from(root.querySelectorAll('button.btn-gold')) : [];
  const wrong = btns.filter(b => !/doOrganizerOpportunityInvite\(/.test(b.getAttribute('onclick') || ''));
  if (btns.length && !wrong.length)
    ok(btns.length + ' opportunity actions, every one of them the recruiting act (PP-1)');
  else bad('an opportunity action is not the recruiting act (' + wrong.length + ' of ' + btns.length + ')');
  const invite = w.eval('doOrganizerOpportunityInvite.toString()');
  if (/inviteToFair\(/.test(invite) &&
      !/requestPartnership|placeOrder|addWineToBuyerList|handleOfferRequest/.test(invite))
    ok('the handler delegates to inviteToFair() and to no trade act');
  else bad('the opportunity handler reaches a trade act (PP-1)');
  w.eval("showPartnerView('dashboard')");
}

expectRed('a Commerce section hung into the organizer sidebar', () => {
  d.getElementById('sidebar-partner').insertAdjacentHTML('beforeend',
    '<div class="nav-section" id="pp-mut-commerce"><div class="nav-section-label">Commerce</div>' +
    '<div class="nav-item" onclick="showOrders(\'retail\',\'outgoing\')">My Purchases</div></div>');
  try { assertNoTradeSurface(); }
  finally { d.getElementById('pp-mut-commerce').remove(); }
});

/* The switcher: the fifth entry exists, is visually set apart, and
   activating it deactivates every trade view. */
{
  const btns = d.querySelectorAll('.demo-btn');
  if (btns.length === 5 && btns[4].classList.contains('demo-btn-partner') &&
      /Platform Partner · Organizer/.test(btns[4].textContent) &&
      d.querySelector('.demo-sep'))
    ok('fifth View-as entry present, labelled and set apart (divider + own class)');
  else bad('the fifth View-as entry is missing, unlabelled or not set apart');
  w.eval("switchDashboard('partner', document.querySelectorAll('.demo-btn')[4])");
  const partnerOn = d.getElementById('dash-partner').classList.contains('active');
  const tradesOff = TRADE_ROLES.every(r => !d.getElementById('dash-' + r).classList.contains('active'));
  if (partnerOn && tradesOff) ok('partner workspace active, all four trade views inactive');
  else bad('switching to the partner workspace left a trade view active');
  w.eval("switchDashboard('winery', document.querySelectorAll('.demo-btn')[0])");
  if (d.getElementById('dash-winery').classList.contains('active') &&
      !d.getElementById('dash-partner').classList.contains('active'))
    ok('switching back to a trade role leaves the partner workspace');
  else bad('the partner workspace did not release the view');
}

/* ── §2 The partner exists in NO trade logic (PP-3, as-is state) ── */
console.log('\n§2 no trade enumeration counts the partner workspace');

function assertNoPartnerInRegistries() {
  ['ORDER_ROLES', 'SHOW_ROLES', 'EVENT_ROLES'].forEach(reg => {
    const keys = Object.keys(w.eval(reg));
    if (keys.length === 4 && keys.indexOf('partner') === -1 &&
        keys.every(k => TRADE_ROLES.indexOf(k) !== -1))
      ok(reg + ' stays the four trade roles');
    else bad(reg + ' keys moved: [' + keys.join(', ') + ']');
  });
  const reach = w.eval('REACH_ROLE_VALUE');
  if (!('partner' in reach)) ok('REACH_ROLE_VALUE knows no partner role');
  else bad('the reach taxonomy gained a partner value');
}
assertNoPartnerInRegistries();

function assertPartnerOutsideRelations() {
  const name = PARTNER().name;
  /* stakeholder() never returns null — a miss comes back as a marked
     placeholder ({unknown:true}), so the placeholder IS the assertion. */
  if (w.eval('stakeholder(' + JSON.stringify(name) + ')').unknown === true)
    ok('no stakeholders row for the partner — it is not a house');
  else bad('the partner has a stakeholders row (PP-2: a workspace is one nature)');
  const graph = w.eval('wineFollowGraph');
  if (!graph.some(e => e.follower === name || e.winery === name))
    ok('the A7 trade graph carries no partner edge — partner follows live in their own store (A23.2, D47)');
  else bad('a wineFollowGraph edge names the partner — the A7 graph was generalised against the O9 measurement (D47)');
  const aud = w.eval("announcementAudience('event', campaignSubject('event','ME-3103'), true)");
  if (aud.indexOf(name) === -1)
    ok('the campaign resolver does not address the partner');
  else bad('the campaign audience resolved the partner in (A16.14e)');
  const parts = w.eval("partnershipsOf('Hawesko GmbH')");
  if (!parts.some(p => JSON.stringify(p).indexOf(name) !== -1))
    ok("Hawesko's partner counter does not count the platform partner");
  else bad('an A6 partnership row names the platform partner (PP-1)');
}
assertPartnerOutsideRelations();

expectRed('partner mixed into ORDER_ROLES as a trade role', () => {
  w.eval('ORDER_ROLES.partner = ORDER_ROLES.retail');
  try { assertNoPartnerInRegistries(); }
  finally { w.eval('delete ORDER_ROLES.partner'); }
});
expectRed('a follow edge invented for the partner', () => {
  w.eval("wineFollowGraph.push({ follower: platformPartners[0].name, winery: 'Hawesko GmbH', at: 'Aug 2026' })");
  try { assertPartnerOutsideRelations(); }
  finally { w.eval('wineFollowGraph.pop()'); }
});
expectRed('the partner given a stakeholders row', () => {
  w.eval("STAKEHOLDER_INDEX[platformPartners[0].name] = { name: platformPartners[0].name, type: 'distributor', avatar: 'AF', region: '', url: null }");
  try { assertPartnerOutsideRelations(); }
  finally { w.eval('delete STAKEHOLDER_INDEX[platformPartners[0].name]'); }
});

/* ── §3 Capability model — extensible, media_partner value-only ──── */
console.log('\n§3 capability model — media_partner is a value, not a feature (PP-5)');

function renderedSurfaceText() {
  /* Rendered surfaces only — the inline scripts legitimately contain
     the WORD media_partner (the permitted value), so textContent of
     the app subtree is the honest place to look for a SURFACE. */
  return d.querySelector('.demo-bar').textContent + d.querySelector('.app').textContent;
}
function assertMediaPartnerAbsent() {
  if (!PARTNERS().some(p => p.capabilities.indexOf('media_partner') !== -1))
    ok('no fixture instantiates media_partner');
  else bad('a platformPartners row carries media_partner (PP-5)');
  if (!/media[_ ]?partner/i.test(renderedSurfaceText()))
    ok('no rendered surface mentions Media Partner');
  else bad('a surface renders Media Partner (PP-5: reserved means invisible)');
}
{
  const caps = CAPS();
  if (Array.isArray(caps) && caps.indexOf('organizer') !== -1 && caps.indexOf('media_partner') !== -1)
    ok('PARTNER_CAPABILITIES is a list and already carries the reserved value');
  else bad('the capability model is not the extensible list A18.2 specifies');
  if (PARTNER().capabilities.length === 1 && PARTNER().capabilities[0] === 'organizer')
    ok('the fixture is organizer-only');
  else bad('the fixture claims capabilities beyond organizer');
}
assertMediaPartnerAbsent();

expectRed('media_partner instantiated and surfaced', () => {
  w.eval("platformPartners[0].capabilities.push('media_partner')");
  try { RENDER(); assertMediaPartnerAbsent(); }
  finally { w.eval('platformPartners[0].capabilities.pop()'); RENDER(); }
});

/* ── §4 Verification is the register's last word (PP-4) ──────────── */
console.log('\n§4 the Verified badge derives from the reviews row, never a flag');

function badgeShown() {
  return /Verified Platform Partner/.test(d.getElementById('ppartner-idcard').innerHTML) &&
         /Verified Platform Partner/.test(d.getElementById('ppartner-profile').innerHTML);
}
{
  const p = PARTNER();
  const flagKey = Object.keys(p).find(k => /verif/i.test(k));
  if (!flagKey) ok('the partner row stores no verification flag');
  else bad('typed verification state on the partner row: "' + flagKey + '" (invariant 7)');
  if (badgeShown()) ok('badge present while the approved partner_verification row exists');
  else bad('no badge despite an approved verification row');
  const disclaimers = (d.getElementById('dash-partner').innerHTML.match(/Verified confirms/g) || []).length;
  if (disclaimers >= 2) ok('the one-sentence disclaimer renders beside the badge (overview + profile)');
  else bad('the Verified badge appears without its disclaimer (A18.4)');
}
/* The Auftrag's mutation is the dependency itself: take the row away
   and the badge MUST fall — a stored flag would survive this. */
{
  w.eval("reviews = reviews.filter(r => !(r.subjectType === 'partner' && r.subjectId === platformPartners[0].id))");
  RENDER();
  if (!badgeShown() && /Verification pending/.test(d.getElementById('ppartner-idcard').innerHTML))
    ok('row removed → badge falls, surface says so honestly');
  else bad('the badge survived the loss of its review row — it is typed somewhere');
  w.eval("reviews.push({ id:'RVW-3004', subjectType:'partner', subjectId:platformPartners[0].id, gateNumber:null, reviewStatus:'approved', reviewedBy:'Bottle Lobby', reviewedAt:'2026-07-15', reviewNotes:null, approvalType:'partner_verification' })");
  RENDER();
  if (badgeShown()) ok('row restored → badge returns (pure derivation, both directions)');
  else bad('the badge did not come back with its row');
}
/* PP-4 is the register's LAST word (A18.4): the register is
   append-only, so a LATER rejected row must pull the badge even
   though the approved row is still in the array — an "any approved
   row ever" reading survives this and is exactly the defect. The
   mutation appends the later row, re-renders, and takes itself back
   completely. */
function assertLaterRejectionPullsBadge() {
  w.eval("reviews.push({ id:'RVW-MUT-REJ', subjectType:'partner', subjectId:platformPartners[0].id, gateNumber:null, reviewStatus:'rejected', reviewedBy:'Bottle Lobby', reviewedAt:'2026-07-30', reviewNotes:null, approvalType:'partner_verification' })");
  try {
    RENDER();
    if (!badgeShown() && !/Verified by Bottle Lobby/.test(d.getElementById('ppartner-profile').textContent))
      ok('later rejected row → both badges fall, no surface still claims Verified');
    else bad("a later rejection did not pull the badge — the derivation ignores the register's last word (PP-4)");
  } finally {
    w.eval("reviews = reviews.filter(r => r.id !== 'RVW-MUT-REJ')");
    RENDER();
  }
}
assertLaterRejectionPullsBadge();
if (badgeShown()) ok('rejection mutation fully taken back — badge present again');
else bad('the rejected-row mutation leaked into the fixtures');

/* The red counter-proof for the new claim: put the any-row derivation
   back in place of the real one and run the SAME check — it must go
   red, or the check cannot tell the two derivations apart. */
expectRed('an any-row derivation swapped in under the last-word check', () => {
  w.eval("window.__ppRealDerive = partnerVerificationApproved; " +
         "partnerVerificationApproved = function (p) { return reviewsFor('partner', p.id).some(r => r.approvalType === 'partner_verification' && r.reviewStatus === 'approved'); }");
  try { assertLaterRejectionPullsBadge(); }
  finally {
    w.eval('partnerVerificationApproved = window.__ppRealDerive; delete window.__ppRealDerive');
    RENDER();
  }
});

/* ── §5 The fixture is fictitious and C7-derived ─────────────────── */
console.log('\n§5 fixture discipline');

{
  const p = PARTNER();
  const REAL_BRANDS = ['prowein', 'vinitaly', 'vinexpo', 'wine paris', 'messe düsseldorf', 'veronafiere'];
  const hit = REAL_BRANDS.find(b => p.name.toLowerCase().indexOf(b) !== -1);
  if (!hit) ok('the fixture name "' + p.name + '" is no real fair or media brand');
  else bad('the fixture borrows the real brand "' + hit + '" — real names stay spec prose (A16.8)');
  const vrow = w.eval('reviewsFor("partner", platformPartners[0].id)')
    .find(r => r.approvalType === 'partner_verification');
  if (vrow && vrow.reviewedAt <= w.eval('SHOW_TODAY'))
    ok('verification date ' + vrow.reviewedAt + ' respects its C7 ceiling (SHOW_TODAY): the cockpit shows a verified organizer today');
  else bad('the verification postdates the demo "today" — the ceiling rule (C7) is broken');
  const maxShowBlock = Math.max.apply(null, w.eval('reviews')
    .map(r => r.id).filter(id => /^RVW-3\d{3}$/.test(id)).map(id => +id.slice(4)));
  if (w.eval('reviewSeq') > maxShowBlock)
    ok('reviewSeq (' + w.eval('reviewSeq') + ') is ahead of every fixture id — no reload collision');
  else bad('reviewSeq would reissue an existing RVW id');
}

/* ── §6 The four trade dashboards are unchanged — samples ────────── */
console.log('\n§6 trade dashboards untouched — samples');

{
  const name = PARTNER().name;
  /* Since O9 exactly ONE named read path is open (PP-3, A23.6): the My
     Stars partner block of each cockpit renders the house's OWN partner
     follows. That block is measured in tests/organizer-profile.js;
     HERE it is cut out, and everything else in the four trade views
     must still be free of the partner workspace. */
  const outsideStars = r => {
    const c = d.getElementById('dash-' + r).cloneNode(true);
    [...c.querySelectorAll('[id$="stars-partners"]')].forEach(n => n.remove());
    return c.innerHTML + d.getElementById('sidebar-' + r).innerHTML;
  };
  const leak = TRADE_ROLES.find(r => new RegExp(name + '|Platform Partner').test(outsideStars(r)));
  if (!leak) ok('outside the one opened My Stars read path, no trade dashboard or sidebar mentions the partner workspace');
  else bad('the ' + leak + ' view mentions the partner outside My Stars (workspaces bleed, A18.3 / PP-3)');
  const opened = TRADE_ROLES.filter(r => {
    const box = d.querySelector('#dash-' + r + ' [id$="stars-partners"]');
    return box && /Platform Partners/.test(box.textContent);
  });
  if (opened.length === 4) ok('the one opened path exists in all four cockpits — the My Stars partner block (PP-3 since O9)');
  else bad('the named PP-3 read path is missing in: ' + TRADE_ROLES.filter(r => opened.indexOf(r) === -1).join(', '));
  const fansDom = d.querySelectorAll('#dfans-list .wn-card').length;
  const fansDerived = w.eval("fansOf('Hawesko GmbH')").length;
  if (fansDom === fansDerived && fansDerived > 0)
    ok("Hawesko's fan list still renders its " + fansDerived + ' derived rows');
  else bad("Hawesko's fan list moved: DOM " + fansDom + ' vs derived ' + fansDerived);
  const audSize = w.eval("announcementAudience('event', campaignSubject('event','ME-3103'), true)").length;
  const snap = w.eval("eventCampaigns.find(c => c.id === 'CMP-4001')").recipients.length;
  if (audSize === snap)
    ok('CMP-4001: live audience still equals its frozen snapshot (' + snap + ')');
  else bad('the campaign audience moved: live ' + audSize + ' vs snapshot ' + snap);
}

console.log('');
if (fail) { console.log('✗ ' + fail + ' check(s) failed'); process.exit(1); }
console.log('✓ all checks passed');
