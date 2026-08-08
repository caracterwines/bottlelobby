const path = require('path');
const { loadDashboard } = require('./load-dashboard');
const DASHBOARD = path.join(__dirname, '..', 'bottle-lobby-dashboard.html');
const { JSDOM } = require('jsdom');
const fs = require('fs');
const html = loadDashboard().html;   // inlines <script src> — see load-dashboard.js

const errors = [];
const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true,
  virtualConsole: new (require('jsdom').VirtualConsole)().on('jsdomError', e => errors.push('JSDOM: ' + e.message)) });
const w = dom.window, d = w.document;
w.scrollTo = () => {};
if (errors.length) { console.log('SCRIPT ERRORS:\n' + errors.join('\n')); process.exit(1); }
console.log('script evaluated cleanly\n');

const ROLES = {
  winery:     { fn:'showWineryView',     maps:['W_SECTION_EL','W_NAV_EL','W_TITLES','W_GROUPS'], tabs:'wprofile-tabs', dashNav:'wnav-dashboard', sidebar:'sidebar-winery' },
  distributor:{ fn:'showDistributorView',maps:['D_SECTION_EL','D_NAV_EL','D_TITLES','D_GROUPS'], tabs:'dprofile-tabs', dashNav:'dnav-dashboard', sidebar:'sidebar-distributor' },
  restaurant: { fn:'showRestaurantView', maps:['R_SECTION_EL','R_NAV_EL','R_TITLES','R_GROUPS'], tabs:'rprofile-tabs', dashNav:'rnav-dashboard', sidebar:'sidebar-restaurant' },
  retail:     { fn:'showRetailView',     maps:['T_SECTION_EL','T_NAV_EL','T_TITLES','T_GROUPS'], tabs:'tprofile-tabs', dashNav:'tnav-dashboard', sidebar:'sidebar-retail' },
};
let fail = 0;
const bad = m => { console.log('  FAIL ' + m); fail++; };

/* ── NAV-1: the visible sidebar section labels per role (B8) ──────────
   Order matters — B8 fixes it as
   Overview → Commerce → My Portfolio → Network → Community →
   [role-specific] → Events / Tools → Account.

   "My Partners" became **Network** and the old "Network" became
   **Community** (D39). The two did not shift by one, they swapped
   meanings, which is why this list is the guard: a find-and-replace
   rename would have left one of the two right and the other wrong,
   and nothing would have turned red.

   This is the state after the rename pass, and the **My Events** items
   B8 asks for now exist in all four navs (A16.8) — they added items,
   not section labels, so this list is unchanged by that pass and stays
   complete as it stands. The items themselves are measured where they
   belong, in tests/member-events.js: a nav entry that opens nothing is
   what Retail's had been, and a section label cannot see that. */
const NAV_SECTIONS = {
  winery:     ['Overview','Commerce','My Portfolio','Network','Community','Market','Events','Services','Account'],
  distributor:['Overview','Commerce','My Portfolio','Network','Community','Intelligence','Events','Account'],
  restaurant: ['Overview','Commerce','My Portfolio','Network','Community','Discover','Events','Tools','Account'],
  retail:     ['Overview','Commerce','My Portfolio','Network','Community','Discover','Events','Account'],
};

console.log('── NAV-1: visible sidebar section labels (B8)');
for (const [role, cfg] of Object.entries(ROLES)) {
  const aside = d.getElementById(cfg.sidebar);
  if (!aside) { bad(`${role}: no #${cfg.sidebar}`); continue; }
  const got = [...aside.querySelectorAll('.nav-section-label')].map(e => e.textContent.trim());
  const want = NAV_SECTIONS[role];
  if (got.join(' · ') !== want.join(' · ')) bad(`${role}: sections [${got.join(' · ')}]\n         expected [${want.join(' · ')}]`);
  else console.log(`  ${role.padEnd(12)} ${got.join(' · ')}`);
  // The swap must not have left the retired label anywhere.
  if (got.includes('My Partners')) bad(`${role}: "My Partners" survives — D39 renamed it to Network`);
}
console.log('');

for (const [role, cfg] of Object.entries(ROLES)) {
  const [SEC, NAV, TIT, GRP] = cfg.maps.map(n => w.eval(n));
  console.log(`── ${role} (${Object.keys(SEC).length} sub-pages)`);
  for (const key of Object.keys(SEC)) {
    w[cfg.fn]('profile', key);
    // exactly one section visible
    const visible = Object.keys(SEC).filter(k => d.getElementById(SEC[k]).style.display !== 'none');
    if (visible.length !== 1 || visible[0] !== key) bad(`${key}: visible sections = [${visible}]`);
    // exactly one nav active
    const active = Object.keys(NAV).filter(k => d.getElementById(NAV[k]).classList.contains('active'));
    const dashActive = d.getElementById(cfg.dashNav).classList.contains('active');
    if (active.length !== 1 || active[0] !== key || dashActive) bad(`${key}: active nav = [${active}] dash=${dashActive}`);
    // topbar title matches the map
    const title = d.getElementById(role + '-topbar-title').textContent;
    if (title !== TIT[key]) bad(`${key}: title "${title}" != "${TIT[key]}"`);
    // tab bar present iff the section is in a multi-member group
    const grp = GRP.find(g => g.members.some(m => m.s === key));
    const tabs = d.getElementById(cfg.tabs);
    const shown = tabs.style.display !== 'none';
    if (!!grp !== shown) bad(`${key}: tab bar shown=${shown}, in group=${!!grp}`);
    if (grp) {
      const labels = [...tabs.querySelectorAll('.ord-tab')].map(b => b.textContent);
      if (labels.join('|') !== grp.members.map(m => m.label).join('|')) bad(`${key}: tabs [${labels}]`);
      const act = [...tabs.querySelectorAll('.ord-tab.active')].map(b => b.textContent);
      if (act.length !== 1 || act[0] !== grp.members.find(m => m.s === key).label) bad(`${key}: active tab [${act}]`);
    }
    // "Preview Public Profile" only on basics
    const pv = d.getElementById(role + '-topbar-actions-profile');
    if ((pv.style.display !== 'none') !== (key === 'basics')) bad(`${key}: preview group display=${pv.style.display}`);
  }
  // dashboard resets everything
  w[cfg.fn]('dashboard');
  const stillVisible = Object.keys(SEC).filter(k => d.getElementById(SEC[k]).style.display !== 'none');
  if (stillVisible.length) bad(`dashboard: sections still visible [${stillVisible}]`);
  if (!d.getElementById(cfg.dashNav).classList.contains('active')) bad('dashboard: dash nav not active');
  if (d.getElementById(cfg.tabs).style.display !== 'none') bad('dashboard: tab bar still shown');
}

console.log('\n── Orders sub-view clears profile nav + tabs');
for (const [role, cfg] of Object.entries(ROLES)) {
  const NAV = w.eval(cfg.maps[1]);
  w[cfg.fn]('profile', 'basics');
  w.showOrders(role, w.eval("ORDER_ROLES")[role].tabs[0].key);
  const active = Object.keys(NAV).filter(k => d.getElementById(NAV[k]).classList.contains('active'));
  if (active.length) bad(`${role}: profile nav still active after showOrders [${active}]`);
  if (d.getElementById(cfg.tabs).style.display !== 'none') bad(`${role}: profile tab bar still shown in Orders`);
  const navId = w.eval("ORDER_ROLES")[role].tabs[0].nav;
  if (!d.getElementById(navId).classList.contains('active')) bad(`${role}: order nav ${navId} not active`);
}

console.log('\n── My Stars / My Fans populated in all four roles');
for (const [id, label] of [['wstars-list','winery stars'],['wfans-list','winery fans'],
                           ['dstars-list','distributor stars'],['dfans-list','distributor fans'],
                           ['rstars-list','restaurant stars'],['rfans-list','restaurant fans'],
                           ['tstars-list','retail stars'],['tfans-list','retail fans']]) {
  const el = d.getElementById(id);
  const empty = el.querySelector('.wn-empty, .pn-empty');
  const n = el.querySelectorAll('.wn-card, .pn-card').length;
  console.log(`  ${label.padEnd(20)} ${n} entr${n===1?'y':'ies'}${empty ? '  (EMPTY STATE)' : ''}`);
  if (empty) bad(`${label} renders the empty state`);
}

console.log(fail ? `\n✗ ${fail} failure(s)` : '\n✓ all checks passed');
process.exit(fail ? 1 : 0);
