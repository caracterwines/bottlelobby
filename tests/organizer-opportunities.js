/* ═══════════════════════════════════════════════════════════════════
   ORGANIZER OPPORTUNITIES — A24, OO-1..OO-10 (pass O10)
   -------------------------------------------------------------------
   The organizer's own fair registers, read into explained suggestions
   that store nothing. As in tests/fair-recruiting.js, every invariant
   is measured twice — the CLAIM, and the COUNTER-MUTATION that breaks
   the rule and must turn the same check red.

   ONE VERIFIER, MANY MUTATIONS. Most of A24's contract is a FILTER:
   the correct derivation cannot be talked into emitting a forbidden
   card, so a counter-mutation on the fixtures alone would leave the
   check green and prove nothing. `contractViolations(list)` therefore
   states the whole contract over ANY list of cards, and each detection
   injects the ONE card that breaks its own clause. Where the fixtures
   CAN carry the fault — a corrupted canonical role, a blocking
   admission, an inactive participation, a follow register actually
   read — the counter-mutation is the data, and it is used there.

   THE DISTINCTION THIS FILE MUST NOT BLUR (A24.9): the Platform
   Partners block under My Stars, rendered by renderPartnerStarsFor()
   out of `partnerFollows`, is the ALLOWED and abgenommen O9 read path
   (A23.6, PP-3). §10(e) proves it still works and is NEVER a finding.
   What is forbidden is a partner in the A7 trade block, in the
   distributor opportunities renderer, under a trade action, or
   produced by this derivation.
═══════════════════════════════════════════════════════════════════ */
const { loadDashboard } = require('./load-dashboard');
const { JSDOM, VirtualConsole } = require('jsdom');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

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

/* ── Read from the page, never retyped ───────────────────────────── */
const OPPS   = () => JSON.parse(w.eval('JSON.stringify(organizerOpportunities())'));
const ADM    = () => w.eval('fairAdmissions');
const CODES  = w.eval('ORGANIZER_OPPORTUNITY_CODES.slice()');
const PARTNER_NAMES = w.eval('platformPartners.map(p => p.name)');
const TODAY  = w.eval('SHOW_TODAY');
/* The canonical roles as the PRISTINE register holds them — the anchor
   a corrupted register is measured against (§2). */
const HOUSE_ROLE = w.eval('JSON.stringify(stakeholders.reduce((a,s)=>{a[s.name]=s.type;return a;},{}))');
const ROLE = JSON.parse(HOUSE_ROLE);
const NON_EXHIBITOR = Object.keys(ROLE).filter(n => ROLE[n] === 'restaurant' || ROLE[n] === 'retail');

w.eval("switchDashboard('partner', document.querySelectorAll('.demo-btn')[4])");
w.eval("showPartnerView('opportunities')");

/* ── Snapshot / restore. A STACK, because expectRed wraps blocks that
   snapshot on their own. `stakeholders` is a const array and its index
   is a second structure — both are put back by hand. ────────────── */
w.eval('window.__stack = []');
function snap() {
  w.eval(`window.__stack.push({
    p:  JSON.stringify(fairParticipations),
    a:  JSON.stringify(fairAdmissions),
    e:  JSON.stringify(fairEditions),
    s:  JSON.stringify(fairSeries),
    st: JSON.stringify(stakeholders),
    g:  JSON.stringify(wineFollowGraph),
    pf: JSON.stringify(partnerFollows),
    seq: fairAdmissionSeq
  })`);
}
function restore() {
  w.eval(`(function () {
    const s = window.__stack.pop();
    fairParticipations = JSON.parse(s.p);
    fairAdmissions     = JSON.parse(s.a);
    fairEditions       = JSON.parse(s.e);
    fairSeries         = JSON.parse(s.s);
    wineFollowGraph    = JSON.parse(s.g);
    partnerFollows     = JSON.parse(s.pf);
    fairAdmissionSeq   = s.seq;
    stakeholders.length = 0;
    JSON.parse(s.st).forEach(function (x) { stakeholders.push(x); });
    Object.keys(STAKEHOLDER_INDEX).forEach(function (k) { delete STAKEHOLDER_INDEX[k]; });
    stakeholders.forEach(function (x) { STAKEHOLDER_INDEX[x.name] = x; });
  })()`);
}
/* ── THE WHOLE REGISTERED STATE, read from the platform's own list ──
   `BLStore.names()` is what this document persists; a register that
   came into being would appear in it BY ITSELF, which is why the check
   below asks the store rather than guessing at a global name. Every
   registered binding is a top-level `let` and is read by its name.
   `notifSeen` is in that list and is therefore NOT a forbidden
   "notification row" — it is one of the values that must not move. */
function registeredState(win) {
  const win2 = win || w;
  const names = win2.eval('BLStore.names()');
  const values = {};
  names.forEach(n => {
    /* A registered name whose binding cannot be read is itself worth
       seeing, so it is recorded rather than thrown. */
    try { values[n] = win2.eval('JSON.stringify(' + n + ')'); }
    catch (e) { values[n] = '<unreadable binding>'; }
  });
  return { names: names.slice().sort(), values: values };
}
/* The DERIVED notification model (C9) has no register at all, so the
   state comparison cannot see it. It is read directly, for all four
   roles, and must be byte-identical across the act. */
function derivedNotifications(win) {
  return (win || w).eval(
    "JSON.stringify(['winery','distributor','restaurant','retail']" +
    ".map(function(r){ return notificationsFor(r); }))");
}
/* B4 / OO-8: exactly `fairAdmissions` + `fairAdmissionSeq` may move,
   the registered NAME SET must be identical, and the delta itself must
   be one invited row with one history line. */
function assertOnlyAdmissionsMoved(before, after, label) {
  const ALLOWED = ['fairAdmissions', 'fairAdmissionSeq'];
  const appeared = after.names.filter(n => before.names.indexOf(n) === -1);
  const vanished = before.names.filter(n => after.names.indexOf(n) === -1);
  if (!appeared.length && !vanished.length)
    ok(label + ': the registered name set is unchanged (' + after.names.length +
       ') — no opportunity, message or notification register came into being');
  else bad(label + ': the registered name set moved — appeared: [' + appeared.join(', ') +
           '], vanished: [' + vanished.join(', ') + ']');
  /* EXACTLY the allowed set — both halves, because only asking for
     `extra` would let `moved = ['fairAdmissions']` pass while the
     sequence counter stood still, and the sentence this check makes is
     "exactly these two moved". So: nothing forbidden moved, AND nothing
     required stayed put. */
  const moved   = after.names.filter(n => before.values[n] !== after.values[n]);
  const extra   = moved.filter(n => ALLOWED.indexOf(n) === -1);
  const missing = ALLOWED.filter(n => moved.indexOf(n) === -1);
  if (!extra.length && !missing.length)
    ok(label + ': of ' + after.names.length + ' registered states exactly ' + moved.length +
       ' moved — ' + moved.slice().sort().join(' + ') + ', and nothing else');
  else {
    if (extra.length) bad(label + ': registered state changed that may not change: ' + extra.join(', '));
    if (missing.length) bad(label + ': registered state that MUST change did not move: ' + missing.join(', '));
  }
  const b = JSON.parse(before.values.fairAdmissions || '[]');
  const a = JSON.parse(after.values.fairAdmissions || '[]');
  const gained = a.filter(r => !b.some(x => x.id === r.id));
  const changed = a.filter(r => { const o = b.find(x => x.id === r.id);
    return o && JSON.stringify(o) !== JSON.stringify(r); });
  if (a.length === b.length + 1 && gained.length === 1 && !changed.length &&
      gained[0].status === 'invited' && gained[0].source === 'invitation' &&
      (gained[0].history || []).length === 1 && gained[0].history[0].action === 'invited')
    ok(label + ': the admissions delta is exactly one new invited row with one history line, no row rewritten');
  else bad(label + ': the admissions delta is ' + gained.length + ' new / ' +
           changed.length + ' rewritten row(s)');
}

/* A mutation that runs with the fixtures put back afterwards, always. */
function withMutation(js, body) {
  snap();
  try { w.eval('(function(){' + js + '})()'); return body(); }
  finally { restore(); }
}

/* ═══ THE ONE VERIFIER — A24's contract over any list of cards ═════ */
function contractViolations(list) {
  const out = [];
  const seenKeys = {};
  const ed = id => w.eval('JSON.stringify(fairEditionById(' + JSON.stringify(id) + '))');
  const get = id => { const r = ed(id); return r === 'null' ? null : JSON.parse(r); };
  const part = id => {
    const r = w.eval('JSON.stringify(fairParticipationById(' + JSON.stringify(id) + '))');
    return r === 'null' ? null : JSON.parse(r);
  };
  const managed = sid => w.eval('fairSeriesManagedHere(fairSeriesById(' + JSON.stringify(sid) + '))');

  list.forEach(c => {
    const label = c.org + ' → ' + c.targetEditionId;
    /* OO-9: one card per pair. */
    const key = c.org + ' ' + c.targetEditionId;
    if (seenKeys[key]) out.push('duplicate card for the same pair: ' + label);
    seenKeys[key] = true;

    /* OO-6: identity and role, canonically. */
    if (PARTNER_NAMES.indexOf(c.org) !== -1)
      out.push('a platform partner is an opportunity target: ' + label);
    if (NON_EXHIBITOR.indexOf(c.org) !== -1)
      out.push('a house that is canonically ' + ROLE[c.org] + ' holds an exhibitor opportunity: ' + label);
    if (['winery', 'distributor'].indexOf(ROLE[c.org]) === -1)
      out.push('the house does not resolve to an eligible trade role: ' + label);
    if (ROLE[c.org] !== c.orgType)
      out.push('the card\'s role differs from the canonical role: ' + label);

    /* OO-2 / OO-3: the target edition. */
    const t = get(c.targetEditionId);
    if (!t) { out.push('the target edition does not exist: ' + label); return; }
    if (t.status === 'cancelled') out.push('the target edition is cancelled: ' + label);
    if (t.startDate < TODAY) out.push('the target edition lies in the past: ' + label);
    if (!managed(t.seriesId)) out.push('the target series is not managed by this workspace: ' + label);
    const entrance = w.eval('JSON.stringify(fairAdmissionEntrance(' +
      JSON.stringify(c.targetEditionId) + ',' + JSON.stringify(c.org) + '))');
    if (!JSON.parse(entrance).fresh)
      out.push('the target edition already carries an admission row: ' + label);

    /* OO-4: at least one reason, each with a code and real provenance. */
    if (!c.reasons || !c.reasons.length) { out.push('a card without any reason: ' + label); return; }
    const seenReasons = {};
    c.reasons.forEach(r => {
      const rk = r.code + '|' + r.sourceEditionId + '|' + r.participationId;
      if (seenReasons[rk]) out.push('the identical reason twice: ' + label + ' (' + r.code + ')');
      seenReasons[rk] = true;
      if (CODES.indexOf(r.code) === -1) out.push('unknown reason code "' + r.code + '": ' + label);
      const s = get(r.sourceEditionId);
      if (!s) { out.push('the source edition does not exist: ' + label); return; }
      if (r.sourceEditionId === c.targetEditionId)
        out.push('source and target edition are the same: ' + label);
      if (s.seriesId !== t.seriesId)
        out.push('source and target belong to different series: ' + label);
      const p = part(r.participationId);
      if (!p) { out.push('the cited participation does not exist: ' + label); return; }
      if (p.status !== 'active') out.push('the source participation is not active: ' + label);
      if (p.editionId !== r.sourceEditionId)
        out.push('the cited participation does not stand at the cited source edition: ' + label);
      if (p.org === c.org) {
        if (r.code !== 'exhibits_at_other_edition')
          out.push('an own participation carries the representation reason: ' + label);
      } else {
        if (r.code !== 'represented_not_exhibiting')
          out.push('a foreign participation carries the own-stand reason: ' + label);
        const entry = (p.representing || []).find(x => x.winery === c.org);
        if (!entry) out.push('the cited participation represents nobody by that name: ' + label);
        else if (entry.representedAtBooth !== true)
          out.push('represented_not_exhibiting without represented-at-booth: ' + label);
      }
      /* Self-reference in the A8-defect sense: a REPRESENTATION whose
         representing booth is the house itself. On an own participation
         `via` IS the house by definition, and that is not a defect. */
      if (r.code === 'represented_not_exhibiting' && r.via === c.org)
        out.push('self-reference — the house represents itself: ' + label);
    });
  });
  return out;
}
function assertContract(list, what) {
  const v = contractViolations(list);
  if (v.length) v.forEach(x => bad(x));
  else ok(what);
}
/* A well-formed card, then broken on exactly one clause per detection. */
const CARD = (over) => Object.assign({
  key: 'X', org: 'Domaine Lefèvre', orgType: 'winery', targetEditionId: 'FE-7102',
  reasons: [{ code: 'exhibits_at_other_edition', sourceEditionId: 'FE-7101',
              participationId: 'FP-9401', via: 'Domaine Lefèvre' }]
}, over || {});

/* ══════════════════════════════════════════════════════════════════
   §1 The seven — count, houses, sources, targets, reason codes  (26)
══════════════════════════════════════════════════════════════════ */
console.log('§1 the fixture derivation — exactly seven, each one assigned (A24 blueprint)');
const EXPECTED = [
  ['Cantina Rossi',   'FE-7101', 'represented_not_exhibiting', 'FE-7103', 'FP-9402'],
  ['Hawesko GmbH',    'FE-7101', 'exhibits_at_other_edition',  'FE-7103', 'FP-9402'],
  ['Domaine Lefèvre', 'FE-7103', 'exhibits_at_other_edition',  'FE-7101', 'FP-9401'],
  ['Cantina Rossi',   'FE-7102', 'represented_not_exhibiting', 'FE-7103', 'FP-9402'],
  ['Domaine Lefèvre', 'FE-7102', 'exhibits_at_other_edition',  'FE-7101', 'FP-9401'],
  ['Hawesko GmbH',    'FE-7102', 'exhibits_at_other_edition',  'FE-7103', 'FP-9402'],
  ['Weingut Schmitt', 'FE-7102', 'represented_not_exhibiting', 'FE-7103', 'FP-9402']
];
const asRows = list => list.map(c => c.reasons.map(r =>
  [c.org, c.targetEditionId, r.code, r.sourceEditionId, r.participationId].join('|')).join(' + '));

function assertSeven(list) {
  const got = asRows(list), want = EXPECTED.map(r => r.join('|'));
  if (got.length !== want.length) { bad('expected 7 opportunities, derived ' + got.length); return; }
  const drift = got.map((g, i) => g === want[i] ? null : (i + 1) + ': ' + g + ' ≠ ' + want[i]).filter(Boolean);
  if (drift.length) bad('the seven differ: ' + drift.join(' · '));
  else ok('exactly 7, in target-date then alphabetical order, each with its source and reason code');
}
assertSeven(OPPS());
{
  /* Sorting is derived, not incidental: target start date ascending. */
  const dates = OPPS().map(c => w.eval('fairEditionById(' + JSON.stringify(c.targetEditionId) + ').startDate'));
  if (dates.every((x, i) => i === 0 || dates[i - 1] <= x)) ok('sorted by target edition start date ascending');
  else bad('the target dates are not ascending: ' + dates.join(', '));
  /* FS-7002 carries no participation and therefore contributes nothing. */
  const foreign = OPPS().filter(c => w.eval('fairEditionById(' + JSON.stringify(c.targetEditionId) + ').seriesId') === 'FS-7002');
  if (!foreign.length) ok('the second series (FS-7002) has no participation and yields nothing');
  else bad('FS-7002 produced ' + foreign.length + ' opportunity/-ies without a participation');
}
/* NOT "withdrawn": a reopenable row is still a row, and E-5 requires a
   FRESH entrance — the suggestion stays blocked, which §7 measures for
   all seven states. The mutation that really moves the count is the row
   going away. */
expectRed('FA-9101 removed — Weingut Schmitt gains an eighth opportunity on FE-7101', () => {
  withMutation("fairAdmissions = fairAdmissions.filter(function(a){ return a.id !== 'FA-9101'; })",
    () => assertSeven(OPPS()));
});
assertContract(OPPS(), 'the seven satisfy A24\'s contract in full');

/* ══════════════════════════════════════════════════════════════════
   §2 Identity and role — the two-stage guard              (1, 2, 3)
══════════════════════════════════════════════════════════════════ */
console.log('\n§2 the two-stage identity and role guard (OO-6, A24.3)');
{
  /* Stage one alone WOULD have admitted the smuggled row — measured,
     not assumed: that is exactly why stage two exists. */
  if (w.eval("fairOrgEligible('winery')") === true)
    ok("stage one (fairOrgEligible('winery')) says yes on its own — it cannot be the guard");
  else bad('fairOrgEligible no longer admits a winery — the premise of this section moved');
  if (w.eval("stakeholder('Atrium Fairs GmbH').unknown") === true)
    ok('the partner workspace has no stakeholders row (PP-2) — it falls out structurally');
  else bad('the platform partner resolved in the trade register (PP-2 broken)');
  if (w.eval("organizerOpportunityIdentityOk('Atrium Fairs GmbH','winery')") === false)
    ok('stage two refuses the partner name even under a claimed winery role');
  else bad('the canonical guard admitted the platform partner');

  /* (2) The smuggled participation row: partner name, trade orgType. */
  const smuggled = withMutation(
    "fairParticipations.push({ id:'FP-MUT1', editionId:'FE-7101', orgType:'winery'," +
    " org:'Atrium Fairs GmbH', standId:null, days:[], description:'', products:[]," +
    " representing:null, status:'active', appointmentsOpen:false, history:[] })",
    () => OPPS());
  if (smuggled.length === 7 && !smuggled.some(c => PARTNER_NAMES.indexOf(c.org) !== -1))
    ok('a participation naming the partner under orgType winery produces nothing — felled by stage two');
  else bad('the smuggled partner row produced an opportunity');
  expectRed('PP-2 broken as well — the partner gains a stakeholders row and the smuggled row bites', () => {
    withMutation(
      "stakeholders.push({name:'Atrium Fairs GmbH',type:'winery',avatar:'AF',region:'Wiesbaden',url:null});" +
      "STAKEHOLDER_INDEX['Atrium Fairs GmbH'] = stakeholders[stakeholders.length-1];" +
      "fairParticipations.push({ id:'FP-MUT1', editionId:'FE-7101', orgType:'winery'," +
      " org:'Atrium Fairs GmbH', standId:null, days:[], description:'', products:[]," +
      " representing:null, status:'active', appointmentsOpen:false, history:[] })",
      () => { assertContract(OPPS(), 'no partner'); assertSeven(OPPS()); });
  });

  /* (3) An ineligible role, canonically checked. */
  const restaurantRow = "fairParticipations.push({ id:'FP-MUT2', editionId:'FE-7101', orgType:'winery'," +
    " org:'Bistro Laurent', standId:null, days:[], description:'', products:[]," +
    " representing:null, status:'active', appointmentsOpen:false, history:[] })";
  const smuggledRole = withMutation(restaurantRow, () => OPPS());
  if (smuggledRole.length === 7 && !smuggledRole.some(c => c.org === 'Bistro Laurent'))
    ok('a restaurant smuggled in under orgType winery produces nothing — the canonical role decides');
  else bad('a restaurant reached the opportunity list');
  expectRed('the canonical register corrupted — Bistro Laurent becomes a winery and the row bites', () => {
    withMutation("STAKEHOLDER_INDEX['Bistro Laurent'].type = 'winery';" + restaurantRow,
      () => { assertContract(OPPS(), 'no restaurant'); assertSeven(OPPS()); });
  });

  /* (1) Self-reference — the A8 defect's shape, on this surface. */
  if (!OPPS().some(c => c.reasons.some(r => r.code === 'represented_not_exhibiting' && r.via === c.org)))
    ok('no house represents itself — the Hawesko-to-Hawesko shape does not arise here');
  else bad('a card cites the house as its own representing booth');
  if (!OPPS().some(c => PARTNER_NAMES.indexOf(c.org) !== -1))
    ok('the acting workspace never appears as an opportunity target');
  else bad('the organizer suggested itself');
  expectRed('Hawesko represents itself at its own booth, canonically a winery', () => {
    withMutation("STAKEHOLDER_INDEX['Hawesko GmbH'].type = 'winery';" +
      "fairParticipationById('FP-9402').representing.push({winery:'Hawesko GmbH'," +
      " representedAtBooth:true, personallyAttending:false, products:[]})",
      () => assertContract(OPPS(), 'no self-reference'));
  });
  expectRed('an injected card naming the platform partner', () => {
    assertContract(OPPS().concat([CARD({ org: 'Atrium Fairs GmbH' })]), 'no partner');
  });
  expectRed('an injected card naming a retail house', () => {
    assertContract(OPPS().concat([CARD({ org: 'Weinhaus Müller', orgType: 'retail' })]), 'no retail');
  });
}

/* ══════════════════════════════════════════════════════════════════
   §3 Explained or nothing — reasons, provenance, no score  (4, 5)
══════════════════════════════════════════════════════════════════ */
console.log('\n§3 every card explained with provenance, and no score anywhere (OO-4)');
function assertRenderedReasons() {
  const cards = [...d.querySelectorAll('#popp-root .pn-card')];
  if (!cards.length) { bad('no opportunity card rendered'); return; }
  const noProv = cards.filter(c => !/goToFairEdition\(/.test(c.innerHTML) || !/participation FP-/.test(c.textContent));
  if (noProv.length) bad(noProv.length + ' rendered card(s) carry no provenance link or no participation id');
  else ok(cards.length + ' rendered cards, each with a provenance link into the organizer\'s own source edition');
  const noAct = cards.filter(c => c.querySelectorAll('button.btn-gold').length !== 1);
  if (noAct.length) bad('a card offers other than exactly one action');
  else ok('exactly one action per card — Invite to exhibit');
}
w.eval('renderPartnerOpportunities()');
assertRenderedReasons();
if (d.getElementById('popp-count').textContent === '(7)') ok('the derived counter reads (7) — computed, never stored');
else bad('the counter reads ' + d.getElementById('popp-count').textContent);
expectRed('a hand-made card without provenance rendered into the view', () => {
  const root = d.getElementById('popp-root'), keep = root.innerHTML;
  root.innerHTML = '<div class="pn-card"><div class="pn-name">Some House</div>' +
                   '<button class="btn-sm btn-gold">Invite to exhibit</button></div>';
  try { assertRenderedReasons(); } finally { root.innerHTML = keep; }
});
expectRed('an injected card with an empty reasons list', () => {
  assertContract(OPPS().concat([CARD({ reasons: [] })]), 'every card explained');
});
expectRed('an injected card with an unknown reason code', () => {
  assertContract(OPPS().concat([CARD({ reasons: [{ code: 'looks_promising',
    sourceEditionId: 'FE-7101', participationId: 'FP-9401', via: 'Domaine Lefèvre' }] })]), 'known codes only');
});
{
  const SCORE = /\d+\s*%|\bscore\b|\bfit\b|\bmatch score\b/i;
  function assertNoScore(text, where) {
    if (SCORE.test(text)) bad('a percentage, score or "fit" statement in ' + where);
    else ok('no percentage, score or "fit" statement in ' + where);
  }
  assertNoScore(d.getElementById('popp-root').textContent, 'the rendered opportunities');
  assertNoScore(w.eval('organizerOpportunities.toString() + renderPartnerOpportunities.toString()'),
                'the derivation and its renderer');
  expectRed('a fit percentage appended to a card', () => {
    const c = d.querySelector('#popp-root .pn-card');
    const s = d.createElement('span'); s.textContent = ' 92% fit';
    c.appendChild(s);
    try { assertNoScore(d.getElementById('popp-root').textContent, 'the rendered opportunities'); }
    finally { s.remove(); }
  });
}

/* ══════════════════════════════════════════════════════════════════
   §4 No follow register in the derivation                (6, 7, 8)
══════════════════════════════════════════════════════════════════ */
console.log('\n§4 the derivation reads no follow register (OO-7) — probed, not assumed');
/* A read PROBE rather than a source grep: the binding is replaced by a
   Proxy that records the first property access. The probe's teeth are
   shown by the counter-mutations, which run a reader that legitimately
   DOES touch the register — including, for partnerFollows, the allowed
   A23.6 path. Tripping the probe is what a reader looks like; the point
   is that organizerOpportunities() does not. */
w.eval(`window.__touch = {};
window.__probe = function (which, fn) {
  const real = which === 'wineFollowGraph' ? wineFollowGraph : partnerFollows;
  window.__touch[which] = false;
  const p = new Proxy(real, { get: function (t, k, r) { window.__touch[which] = true; return Reflect.get(t, k, r); } });
  if (which === 'wineFollowGraph') wineFollowGraph = p; else partnerFollows = p;
  try { fn(); } finally { if (which === 'wineFollowGraph') wineFollowGraph = real; else partnerFollows = real; }
  return window.__touch[which];
};`);
function touched(which, js) { return w.eval('window.__probe(' + JSON.stringify(which) + ', function(){' + js + '})'); }
function assertUntouched(which, js, what) {
  if (touched(which, js) === false) ok(what + ' never reads ' + which);
  else bad(what + ' reads ' + which + ' — forbidden in the O10 derivation (OO-7)');
}
assertUntouched('wineFollowGraph', 'organizerOpportunities();', 'the derivation');
assertUntouched('partnerFollows',  'organizerOpportunities();', 'the derivation');
assertUntouched('wineFollowGraph', 'renderPartnerOpportunities();', 'the renderer');
assertUntouched('partnerFollows',  'renderPartnerOpportunities();', 'the renderer');
expectRed('the probe run over renderDistributorOpportunities(), which does read the A7 graph', () => {
  assertUntouched('wineFollowGraph', 'renderDistributorOpportunities();', 'the derivation');
});
expectRed('the probe run over renderAllPartnerStars() — the ALLOWED A23.6 reader, used here only to show the probe has teeth', () => {
  assertUntouched('partnerFollows', 'renderAllPartnerStars();', 'the derivation');
});
{
  /* And behaviourally: both registers emptied changes nothing. */
  const same = withMutation('wineFollowGraph = []; partnerFollows = [];', () => asRows(OPPS()).join('~'));
  if (same === asRows(OPPS()).join('~')) ok('both follow registers emptied — the seven are unchanged');
  else bad('emptying the follow registers changed the derivation');
}
/* (8) No follower surface and no O11 communication in the ORGANIZER view. */
function assertNoFollowerSurface() {
  const t = d.getElementById('dash-partner').textContent;
  const hit = /started following you|Followers|My Fans|follower/i.exec(t);
  if (hit) bad('a follower surface or O11 line reached the organizer view: "' + hit[0] + '" (OP-8, A24.6)');
  else ok('the organizer view carries no follower name, figure, notification or inquiry surface');
}
assertNoFollowerSurface();
expectRed('a follower figure rendered into the opportunities view', () => {
  const root = d.getElementById('popp-root'), keep = root.innerHTML;
  root.innerHTML = keep + '<div class="edit-sub">Followers (12) — Hawesko GmbH started following you</div>';
  try { assertNoFollowerSurface(); } finally { root.innerHTML = keep; }
});

/* ══════════════════════════════════════════════════════════════════
   §5 Rendering mutates nothing                            (9, 21)
══════════════════════════════════════════════════════════════════ */
console.log('\n§5 deriving and rendering write nothing (OO-1)');
function registersJson() {
  return w.eval(`JSON.stringify([fairSeries, fairEditions, fairParticipations,
    fairAdmissions, fairAdmissionSeq, wineFollowGraph, partnerFollows])`);
}
function assertPure(work, what) {
  const before = registersJson();
  w.eval(work);
  if (registersJson() === before) ok(what + ' left every register byte-identical');
  else bad(what + ' mutated a register');
}
assertPure('organizerOpportunities(); organizerOpportunities();', 'deriving twice');
assertPure('renderPartnerOpportunities(); renderPartnerOpportunities(); renderPartnerOpportunities();',
           'rendering three times');
assertPure("showPartnerView('opportunities'); showPartnerView('fairs'); showPartnerView('opportunities');",
           'switching into and out of the view');
expectRed('a render that writes an admission row', () => {
  const before = registersJson();
  w.eval("renderPartnerOpportunities(); fairAdmissions.push({id:'FA-MUT',editionId:'FE-7102'," +
         "orgType:'winery',org:'Domaine Lefèvre',source:'invitation',status:'invited'," +
         "externalSource:null,externalActor:null,externalAt:null,history:[]})");
  if (registersJson() !== before) bad('mutated');
  w.eval("fairAdmissions = fairAdmissions.filter(a => a.id !== 'FA-MUT')");
});
expectRed('a render that moves the admission sequence counter alone', () => {
  const before = registersJson();
  w.eval('renderPartnerOpportunities(); fairAdmissionSeq++;');
  if (registersJson() !== before) bad('mutated');
  w.eval('fairAdmissionSeq--;');
});

/* ══════════════════════════════════════════════════════════════════
   §6 One card per pair, no reason twice                  (10, 11)
══════════════════════════════════════════════════════════════════ */
console.log('\n§6 deduplication — one card per (house, target edition) (OO-9)');
{
  /* Two sources for the same pair: Domaine Lefèvre also exhibits at
     FE-7103, so (Lefèvre, FE-7102) is reachable twice. */
  const two = withMutation(
    "fairParticipations.push({ id:'FP-MUT3', editionId:'FE-7103', orgType:'winery'," +
    " org:'Domaine Lefèvre', standId:null, days:[], description:'', products:[]," +
    " representing:null, status:'active', appointmentsOpen:false, history:[] })",
    () => OPPS());
  const pair = two.filter(c => c.org === 'Domaine Lefèvre' && c.targetEditionId === 'FE-7102');
  if (pair.length === 1 && pair[0].reasons.length === 2)
    ok('a pair reachable from two participations is ONE card with two distinct reasons');
  else bad('the two-source pair produced ' + pair.length + ' card(s) with ' +
           (pair[0] ? pair[0].reasons.length : 0) + ' reason(s)');

  /* The identical representation twice inside one participation. */
  const dup = withMutation(
    "fairParticipationById('FP-9402').representing.push({winery:'Cantina Rossi'," +
    " representedAtBooth:true, personallyAttending:true, products:[]})",
    () => OPPS());
  const cr = dup.filter(c => c.org === 'Cantina Rossi');
  if (cr.length === 2 && cr.every(c => c.reasons.length === 1))
    ok('the same representation listed twice yields the same one reason, not two');
  else bad('a duplicated representing entry produced duplicate reasons');
}
expectRed('the derived list concatenated with itself — every pair twice', () => {
  assertContract(OPPS().concat(OPPS()), 'unique pairs');
});
expectRed('an injected card carrying the identical reason twice', () => {
  const r = { code: 'exhibits_at_other_edition', sourceEditionId: 'FE-7101',
              participationId: 'FP-9401', via: 'Domaine Lefèvre' };
  assertContract([CARD({ reasons: [r, Object.assign({}, r)] })], 'no reason twice');
});

/* ══════════════════════════════════════════════════════════════════
   §7 The target edition                     (12, 13, 14, 15, 19)
══════════════════════════════════════════════════════════════════ */
console.log('\n§7 the target edition — upcoming, not cancelled, same series, fresh (OO-2, OO-3)');
{
  const cancelled = withMutation("fairEditionById('FE-7102').status = 'cancelled'", () => OPPS());
  if (cancelled.length === 3 && !cancelled.some(c => c.targetEditionId === 'FE-7102'))
    ok('a cancelled target edition drops out — 7 becomes 3');
  else bad('a cancelled edition still carries ' + cancelled.filter(c => c.targetEditionId === 'FE-7102').length + ' opportunity/-ies');
  const past = withMutation("fairEditionById('FE-7102').startDate = '2026-01-10'", () => OPPS());
  if (past.length === 3 && !past.some(c => c.targetEditionId === 'FE-7102'))
    ok('a past target edition drops out — 7 becomes 3');
  else bad('a past edition still carries opportunities');
  const foreign = withMutation("fairSeriesById('FS-7001').organizerId = 'PP-9999'", () => OPPS());
  if (!foreign.length) ok('a series owned by another workspace yields nothing at all — 7 becomes 0');
  else bad('a foreign series produced ' + foreign.length + ' opportunity/-ies');
}
expectRed('an injected card on a cancelled target edition', () => {
  withMutation("fairEditionById('FE-7102').status = 'cancelled'",
    () => assertContract([CARD()], 'not cancelled'));
});
expectRed('an injected card on a past target edition', () => {
  withMutation("fairEditionById('FE-7102').startDate = '2026-01-10'",
    () => assertContract([CARD()], 'upcoming only'));
});
expectRed('an injected card whose series belongs to another organizer', () => {
  withMutation("fairSeriesById('FS-7001').organizerId = 'PP-9999'",
    () => assertContract([CARD()], 'managed here only'));
});
expectRed('an injected cross-series card — FE-7101 (FS-7001) → FE-7104 (FS-7002)', () => {
  assertContract([CARD({ targetEditionId: 'FE-7104' })], 'same series only');
});
expectRed('an injected card whose source edition IS its target', () => {
  assertContract([CARD({ targetEditionId: 'FE-7101' })], 'source ≠ target');
});
{
  /* (19) EACH of the seven admission states blocks the suggestion. */
  const STATES = w.eval('FAIR_ADMISSION_STATUSES.slice()');
  const blocked = STATES.filter(s => {
    const got = withMutation(
      "fairAdmissions.push({id:'FA-MUT9',editionId:'FE-7102',orgType:'winery',org:'Domaine Lefèvre'," +
      "source:'application',status:" + JSON.stringify(s) + ",externalSource:null,externalActor:null," +
      "externalAt:null,history:[]})", () => OPPS());
    return !got.some(c => c.org === 'Domaine Lefèvre' && c.targetEditionId === 'FE-7102') && got.length === 6;
  });
  if (blocked.length === STATES.length)
    ok('all ' + STATES.length + ' admission states block the suggestion: ' + STATES.join(', '));
  else bad('these states did NOT block: ' + STATES.filter(s => blocked.indexOf(s) === -1).join(', '));
  expectRed('an injected card on a target that already carries a withdrawn admission row', () => {
    withMutation("fairAdmissions.push({id:'FA-MUT9',editionId:'FE-7102',orgType:'winery'," +
      "org:'Domaine Lefèvre',source:'invitation',status:'withdrawn',externalSource:null," +
      "externalActor:null,externalAt:null,history:[]})",
      () => assertContract([CARD()], 'fresh entrances only'));
  });
}

/* ══════════════════════════════════════════════════════════════════
   §8 The source side                          (16, 17, 18)
══════════════════════════════════════════════════════════════════ */
console.log('\n§8 the source participation — active, and represented-at-booth alone (OO-5)');
{
  const off = withMutation(
    "fairParticipationById('FP-9402').representing.forEach(function(r){ r.representedAtBooth = false; })",
    () => OPPS());
  if (off.length === 4 && !off.some(c => c.reasons.some(r => r.code === 'represented_not_exhibiting')))
    ok('represented-at-booth false removes every representation opportunity — 7 becomes 4');
  else bad('a representation opportunity survived represented-at-booth false');

  const onlyAttending = withMutation(
    "fairParticipationById('FP-9402').representing.forEach(function(r){" +
    " r.representedAtBooth = false; r.personallyAttending = true; })",
    () => OPPS());
  if (onlyAttending.length === 4)
    ok('personally attending TRUE with represented-at-booth FALSE still produces nothing (FP-7)');
  else bad('personally attending alone produced ' + (onlyAttending.length - 4) + ' opportunity/-ies');

  const src = w.eval('organizerOpportunities.toString()').replace(/\/\*[\s\S]*?\*\//g, '');
  function assertNoAttendingRead(text) {
    if (/personallyAttending/.test(text)) bad('the derivation reads personallyAttending (FP-7, OO-5)');
    else ok('the derivation never mentions personallyAttending — the two facts stay two');
  }
  assertNoAttendingRead(src);
  expectRed('personallyAttending spliced into the measured derivation source', () => {
    assertNoAttendingRead(src + '\n if (r.personallyAttending) add();');
  });

  const inactive = withMutation("fairParticipationById('FP-9401').status = 'withdrawn'", () => OPPS());
  if (inactive.length === 5 && !inactive.some(c => c.org === 'Domaine Lefèvre'))
    ok('a withdrawn source participation carries nothing — 7 becomes 5');
  else bad('a non-active participation still produced opportunities');
}
expectRed('an injected card citing a rescinded source participation', () => {
  withMutation("fairParticipationById('FP-9401').status = 'rescinded'",
    () => assertContract([CARD()], 'active sources only'));
});
expectRed('an injected representation card whose entry is represented-at-booth false', () => {
  withMutation("fairParticipationById('FP-9402').representing[0].representedAtBooth = false",
    () => assertContract([CARD({ org: 'Cantina Rossi', targetEditionId: 'FE-7102',
      reasons: [{ code: 'represented_not_exhibiting', sourceEditionId: 'FE-7103',
                  participationId: 'FP-9402', via: 'Hawesko GmbH' }] })], 'booth representation only'));
});

/* ══════════════════════════════════════════════════════════════════
   §9 The act — authority, exactly one row, the card goes  (20, 22, 23)
══════════════════════════════════════════════════════════════════ */
console.log('\n§9 Invite to exhibit — the act carries no authority of its own (OO-8, A24.5)');
{
  /* The act's checks are inviteToFair()'s, measured on the function. */
  const isrc = w.eval('inviteToFair.toString()');
  const carries = ['fairSeriesManagedHere', "=== 'cancelled'", 'fairOrgEligible', 'fairAdmissionEntrance'];
  const missing = carries.filter(c => isrc.indexOf(c) === -1);
  if (!missing.length) ok('inviteToFair() itself checks series ownership, cancellation, eligibility and the entrance');
  else bad('inviteToFair() does not carry: ' + missing.join(', '));

  function attempt(js) {
    const before = JSON.stringify(ADM());
    w.eval(js);
    return JSON.stringify(ADM()) === before;
  }
  function assertRefused(label, mutation) {
    const clean = withMutation(mutation, () =>
      attempt("doOrganizerOpportunityInvite('Domaine Lefèvre','FE-7102')"));
    if (clean) ok(label + ' — refused, and not one row was written');
    else bad(label + ' — the act wrote a row it had no right to write');
  }
  assertRefused('a target whose series belongs to another workspace', "fairSeriesById('FS-7001').organizerId = 'PP-9999'");
  assertRefused('a cancelled target edition', "fairEditionById('FE-7102').status = 'cancelled'");
  expectRed('the same act on an entitled target, where it legitimately DOES write', () => {
    snap();
    try {
      const clean = attempt("doOrganizerOpportunityInvite('Domaine Lefèvre','FE-7102')");
      if (clean) ok('nothing written'); else bad('a row was written');
    } finally { restore(); }
  });

  /* (22) exactly one invited row; (23) the card is gone afterwards;
     (B4/OO-8) NOTHING ELSE came into being — measured over the whole
     registered state, see registeredState() above. */
  snap();
  const before = ADM().length;
  const stateBefore = registeredState();
  const notifBefore = derivedNotifications();
  w.eval("doOrganizerOpportunityInvite('Domaine Lefèvre','FE-7102')");
  const stateAfter = registeredState();
  const notifAfter = derivedNotifications();
  const added = ADM().filter(a => a.editionId === 'FE-7102' && a.org === 'Domaine Lefèvre');
  if (ADM().length === before + 1 && added.length === 1 && added[0].status === 'invited' &&
      added[0].source === 'invitation' && added[0].history.length === 1 &&
      added[0].history[0].action === 'invited')
    ok('the click writes exactly ONE row: invited, by invitation, with one history line');
  else bad('the click wrote ' + (ADM().length - before) + ' row(s), state ' +
           (added[0] ? added[0].status : '—'));
  const after = OPPS();
  if (after.length === 6 && !after.some(c => c.org === 'Domaine Lefèvre' && c.targetEditionId === 'FE-7102'))
    ok('the opportunity is gone on the next derivation — 7 becomes 6');
  else bad('the invited pair still appears as an opportunity');
  w.eval('renderPartnerOpportunities()');
  if (d.getElementById('popp-count').textContent === '(6)' &&
      d.querySelectorAll('#popp-root .pn-card').length === 6)
    ok('the rendered view and its counter follow immediately');
  else bad('the view did not follow the act');
  /* And the recruiting block of the TARGET edition shows the invitation. */
  w.eval("fairOpenEditionId = 'FE-7102'; showPartnerView('fairs')");
  const fairsText = d.getElementById('pfairs-root').textContent;
  if (/Domaine Lefèvre/.test(fairsText) && /Invited by the organizer/.test(fairsText))
    ok("the target edition's recruiting block carries the new invitation");
  else bad('the invitation is not visible on the target edition');
  /* B4 / OO-8, over the WHOLE registered state and the derived
     notification model — not over a guessed global name. */
  assertOnlyAdmissionsMoved(stateBefore, stateAfter, 'the invitation');
  if (notifBefore === notifAfter)
    ok('the derived notification model is byte-identical for all four roles — the act notifies nobody (C9, OO-8)');
  else bad('the invitation changed the derived notifications — a notification arose from an opportunity act');
  /* Two counter-mutations against the B4/OO-8 check, each breaking a
     different half of it — and each a REAL change, not a doctored
     artefact. */
  expectRed('a foreign register moves along with the act — the act also writes a partnership row', () => {
    snap();
    try {
      const b = registeredState();
      w.eval("doOrganizerOpportunityInvite('Hawesko GmbH','FE-7101');" +
             "partnerships.push({id:'PT-MUT',winery:'Cantina Rossi',distributor:'Hawesko GmbH',status:'active'})");
      assertOnlyAdmissionsMoved(b, registeredState(), 'the invitation');
    } finally { restore(); }
  });
  expectRed('a legitimate invitation with fairAdmissionSeq alone rolled back — the required change is MISSING', () => {
    /* The row is written and correct; only the counter stands still.
       The delta check below would still pass, which is exactly why the
       state check has to insist on BOTH names, not merely on the
       absence of forbidden ones. */
    snap();
    try {
      const b = registeredState();
      const seq = w.eval('fairAdmissionSeq');
      w.eval("doOrganizerOpportunityInvite('Hawesko GmbH','FE-7101'); fairAdmissionSeq = " + seq + ";");
      assertOnlyAdmissionsMoved(b, registeredState(), 'the invitation');
    } finally { restore(); }
  });
  expectRed('a new state really registered with BLStore — an "opportunitiesSeen" register comes into being', () => {
    /* In a THROWAWAY window: BLStore has no unregister, and polluting
       the register of the window every other section measures would be
       worse than the second boot this costs. */
    const w2 = boot();
    const b = registeredState(w2);
    w2.eval("window.opportunitiesSeen = []; BLStore.register({ opportunitiesSeen: " +
            "[function(){ return window.opportunitiesSeen; }, " +
            " function(v){ window.opportunitiesSeen = v; }] })");
    assertOnlyAdmissionsMoved(b, registeredState(w2), 'the invitation');
  });
  expectRed('the created invitation removed again — the card comes back', () => {
    snap();
    try {
      w.eval("fairAdmissions = fairAdmissions.filter(a => !(a.editionId === 'FE-7102' && a.org === 'Domaine Lefèvre'))");
      const back = OPPS();
      if (back.length === 6 && !back.some(c => c.org === 'Domaine Lefèvre' && c.targetEditionId === 'FE-7102'))
        ok('still gone');
      else bad('the opportunity returned — its absence rests on the written row');
    } finally { restore(); }
  });
  expectRed('a second invited row for the same pair', () => {
    w.eval("fairAdmissions.push({id:'FA-MUT8',editionId:'FE-7102',orgType:'winery'," +
      "org:'Domaine Lefèvre',source:'invitation',status:'invited',externalSource:null," +
      "externalActor:null,externalAt:null,history:[]})");
    const rows = ADM().filter(a => a.editionId === 'FE-7102' && a.org === 'Domaine Lefèvre');
    if (rows.length === 1) ok('one'); else bad('the pair carries ' + rows.length + ' rows — FR-1 broken');
  });
  restore();
  w.eval("fairOpenEditionId = null; showPartnerView('opportunities')");
  assertSeven(OPPS());
  ok('the fixtures are back — the section restored everything it moved');
}

/* ══════════════════════════════════════════════════════════════════
   §10 The unchanged boundaries                          (24, 25a-e)
══════════════════════════════════════════════════════════════════ */
console.log('\n§10 unchanged boundaries — trade cockpits, the A7 block, and the ALLOWED A23.6 path');
{
  /* (24) The distributor opportunities renderer and its markup, by
     segment checksum over the file itself — the file changes with O10,
     these two segments may not. Pinned at the O10 baseline
     (7c740b2), measured before and after the build. */
  const RENDERER_SHA = 'aeff0827c6c4f1d86aa033db6a2d6636702c238ee587e0381b98eeb08be7a615';
  const MARKUP_SHA   = '7f6d1d6f199cdd1dd0d8a165f73c56e9b96d782c3d67c83776ec17b7bb63b4cb';
  const RENDERED_SHA = '5aabf92f71676556b46a1dd31746f300b6210a6128d146a3bce4ca0460ee2a0c';
  const src = fs.readFileSync(path.join(__dirname, '..', 'bottle-lobby-dashboard.html'), 'utf8');

  /* THE RAW BYTES, not the source as a string and not the DOM. O10
     first shipped a real U+0000 inside organizerOpportunities(), used
     as a key separator: invisible in every rendered view, invisible in
     every DOM assertion — and enough to make git, grep and every
     ordinary tool treat the whole 1.2 MB document as BINARY. A control
     byte has no business in this file, so the file's own bytes are
     what gets measured. */
  function assertNoControlBytes(buf, what) {
    const nul = buf.filter(b => b === 0).length;
    if (nul === 0) ok(what + ': ' + buf.length + ' bytes, not one NUL — the document stays text');
    else bad(what + ': ' + nul + ' NUL byte(s) in the file — tools read it as binary');
  }
  const rawBytes = fs.readFileSync(path.join(__dirname, '..', 'bottle-lobby-dashboard.html'));
  assertNoControlBytes(rawBytes, 'bottle-lobby-dashboard.html');
  expectRed('one NUL byte spliced into the measured bytes', () => {
    assertNoControlBytes(Buffer.concat([rawBytes.slice(0, 100), Buffer.from([0]),
                                        rawBytes.slice(100)]), 'bottle-lobby-dashboard.html');
  });
  function fnSegment(name) {
    const i = src.indexOf('function ' + name + '(');
    if (i === -1) return null;
    let depth = 0, k = src.indexOf('{', i);
    for (; k < src.length; k++) {
      if (src[k] === '{') depth++;
      else if (src[k] === '}') { depth--; if (!depth) break; }
    }
    return src.slice(i, k + 1);
  }
  function markupSegment() {
    const a = src.indexOf('<div class="profile-section" id="dsection-opportunities">');
    if (a === -1) return null;
    const list = src.indexOf('<div id="dopp-list"></div>', a);
    return src.slice(a, src.indexOf('</div>', list + 26) + 6);
  }
  const sha = s => crypto.createHash('sha256').update(String(s), 'utf8').digest('hex');
  function assertSegments(rendererText, markupText) {
    if (sha(rendererText) === RENDERER_SHA) ok('renderDistributorOpportunities() + goToWineShowPlanning(): segment checksum unchanged');
    else bad('the distributor opportunities renderer changed (sha ' + sha(rendererText).slice(0, 12) + '…) — E-3/OO-10');
    if (sha(markupText) === MARKUP_SHA) ok('the #dopp-list / #dopp-count markup block: segment checksum unchanged');
    else bad('the distributor opportunities markup changed (sha ' + sha(markupText).slice(0, 12) + '…)');
  }
  const rendererText = fnSegment('renderDistributorOpportunities') + '\n' + fnSegment('goToWineShowPlanning');
  const markupText = markupSegment();
  assertSegments(rendererText, markupText);
  expectRed('one character added to the renderer segment', () => {
    assertSegments(rendererText + ' ', markupText);
  });
  expectRed('one character added to the markup segment', () => {
    assertSegments(rendererText, markupText + ' ');
  });

  /* And the RENDERED fixture result of that area, unchanged. */
  w.eval("switchDashboard('distributor', document.querySelectorAll('.demo-btn')[1]); renderDistributorOpportunities()");
  function assertRenderedDopp(html, count) {
    if (sha(html) === RENDERED_SHA && count === '(5)')
      ok('the rendered distributor Opportunities are identical to the pre-O10 measurement (5 cards)');
    else bad('the rendered distributor Opportunities changed: count ' + count + ', sha ' + sha(html).slice(0, 12) + '…');
  }
  assertRenderedDopp(d.getElementById('dopp-list').innerHTML, d.getElementById('dopp-count').textContent);
  expectRed('the rendered distributor Opportunities altered by one node', () => {
    assertRenderedDopp(d.getElementById('dopp-list').innerHTML + '<i></i>', '(5)');
  });

  /* (25a) No organizer or platform partner in that renderer's output. */
  function assertNoPartnerInDopp() {
    const t = d.getElementById('dopp-list').textContent;
    const hit = PARTNER_NAMES.find(n => t.indexOf(n) !== -1);
    if (hit) bad('the platform partner "' + hit + '" appears in the distributor Opportunities (PP-1)');
    else ok('no organizer and no platform partner in the distributor Opportunities');
  }
  assertNoPartnerInDopp();
  expectRed('the partner name rendered into the distributor Opportunities', () => {
    const el = d.getElementById('dopp-list'), keep = el.innerHTML;
    el.innerHTML = keep + '<div class="pn-card"><div class="pn-name">Atrium Fairs GmbH</div></div>';
    try { assertNoPartnerInDopp(); } finally { el.innerHTML = keep; }
  });

  /* (25b) No partner in the A7 TRADE block of My Stars. */
  const STARS_TRADE = { winery: 'wstars-list', distributor: 'dstars-list',
                        restaurant: 'rstars-list', retail: 'tstars-list' };
  function assertNoPartnerInTradeStars() {
    Object.keys(STARS_TRADE).forEach(r => {
      const el = d.getElementById(STARS_TRADE[r]);
      const t = el ? el.textContent : '';
      const hit = PARTNER_NAMES.find(n => t.indexOf(n) !== -1);
      if (hit) bad(r + ': the platform partner "' + hit + '" is in the A7 trade block of My Stars');
      else ok(r + ': the A7 trade block of My Stars names no platform partner');
    });
  }
  w.eval("renderWineStarsFor('Cantina Rossi','wstars-list','wstars-count');" +
         "renderWineStarsFor('Hawesko GmbH','dstars-list','dstars-count');" +
         "renderWineStarsFor('Bistro Laurent','rstars-list','rstars-count');" +
         "renderWineStarsFor('Weinhaus Müller','tstars-list','tstars-count');");
  assertNoPartnerInTradeStars();
  expectRed('a platform partner smuggled into wineFollowGraph', () => {
    snap();
    try {
      w.eval("wineFollowGraph.push({follower:'Hawesko GmbH', winery:'Atrium Fairs GmbH', at:'2026-08-01'});" +
             "renderWineStarsFor('Hawesko GmbH','dstars-list','dstars-count')");
      assertNoPartnerInTradeStars();
    } finally {
      restore();
      w.eval("renderWineStarsFor('Hawesko GmbH','dstars-list','dstars-count')");
    }
  });

  /* (25e) THE ALLOWED PATH, POSITIVELY VERIFIED — A23.6 / PP-3.
     This block must keep working. A check that objects to it is
     wrongly built (A24.9). */
  const STARS_PARTNER = { winery: 'wstars-partners', distributor: 'dstars-partners',
                          restaurant: 'rstars-partners', retail: 'tstars-partners' };
  w.eval('renderAllPartnerStars()');
  function assertPartnerBlockAlive() {
    const host = d.getElementById(STARS_PARTNER.restaurant);
    const card = host && host.querySelector('.pn-card');
    const link = card && card.querySelector('a.pn-link');
    if (host && /Platform Partners/.test(host.textContent) && card &&
        /Atrium Fairs GmbH/.test(card.textContent) && /Following since/.test(card.textContent) &&
        link && link.getAttribute('href') === w.eval('platformPartners[0].url'))
      ok('the Platform Partners block still shows the organizer follow with profile link and "Following since"');
    else bad('the ALLOWED A23.6 read path lost its entry — O10 may not touch it');
  }
  assertPartnerBlockAlive();
  Object.keys(STARS_PARTNER).forEach(r => {
    const host = d.getElementById(STARS_PARTNER[r]);
    if (host && /Platform Partners/.test(host.textContent)) ok(r + ': the separate Platform Partners block is present');
    else bad(r + ': the Platform Partners block is missing (A23.6)');
  });
  /* (25c) …and carries no trade action. */
  function assertNoTradeActionOnPartner() {
    const t = Object.keys(STARS_PARTNER).map(r => {
      const h = d.getElementById(STARS_PARTNER[r]); return h ? h.textContent : '';
    }).join(' ');
    if (/Request Partnership|Consider onboarding|Arrange a tasting|Become a Customer/.test(t))
      bad('a trade action is offered on a Platform Partner entry (PP-1, OP-5)');
    else ok('no trade action anywhere on a Platform Partner entry');
  }
  assertNoTradeActionOnPartner();
  expectRed('an onboarding button appended to the partner entry', () => {
    const card = d.querySelector('#rstars-partners .pn-card');
    const b = d.createElement('button'); b.textContent = 'Consider onboarding →';
    card.appendChild(b);
    try { assertNoTradeActionOnPartner(); } finally { b.remove(); }
  });
  /* The real Unfollow still works — and the block is not vacuous. */
  {
    snap();
    const n0 = w.eval('partnerFollows.length');
    w.eval("switchDashboard('restaurant', document.querySelectorAll('.demo-btn')[2]);" +
           "unfollowPartnerTarget('organizer','PP-9001')");
    const n1 = w.eval('partnerFollows.length');
    if (n1 === n0 - 1 && !d.querySelector('#rstars-partners .pn-card'))
      ok('Unfollow really removes the edge and the entry — the act is honest (OP-4)');
    else bad('Unfollow did not remove the edge (' + n0 + ' → ' + n1 + ')');
    restore();
    w.eval('renderAllPartnerStars()');
  }
  expectRed('the follow store emptied — the positive check above is not vacuous', () => {
    snap();
    try { w.eval('partnerFollows = []; renderAllPartnerStars()'); assertPartnerBlockAlive(); }
    finally { restore(); w.eval('renderAllPartnerStars()'); }
  });

  /* (25d) No organizer produced by O10 as a trade house or candidate. */
  function assertNoPartnerAsCandidate() {
    const cands = w.eval("JSON.stringify(organizerCandidateSearch('').map(function(h){return h.org;}))");
    const hit = PARTNER_NAMES.find(n => JSON.parse(cands).indexOf(n) !== -1);
    if (hit) bad('the platform partner "' + hit + '" is offered as an exhibitor candidate (FR-2, PP-2)');
    else ok('the candidate read path offers no platform partner');
    const opp = OPPS().find(c => PARTNER_NAMES.indexOf(c.org) !== -1);
    if (opp) bad('O10 produced the platform partner as a trade house');
    else ok('O10 produces no organizer as a trade house or exhibitor candidate');
  }
  assertNoPartnerAsCandidate();
  expectRed('PP-2 broken — the partner gains a stakeholders row and becomes a candidate', () => {
    withMutation("stakeholders.push({name:'Atrium Fairs GmbH',type:'winery',avatar:'AF',region:'Wiesbaden',url:null});" +
                 "STAKEHOLDER_INDEX['Atrium Fairs GmbH'] = stakeholders[stakeholders.length-1]",
      () => assertNoPartnerAsCandidate());
  });

  /* The trade cockpits' own sections are where O9 left them. */
  w.eval("switchDashboard('distributor', document.querySelectorAll('.demo-btn')[1])");
  const oppMarkup = d.getElementById('dsection-opportunities');
  if (oppMarkup && !/Invite to exhibit|organizerOpportunities/.test(oppMarkup.innerHTML))
    ok('nothing from A24 leaked into the distributor Opportunities section');
  else bad('an O10 artefact reached a trade cockpit');
}

/* ── The fixtures end where they started ─────────────────────────── */
console.log('');
{
  const state = w.eval('JSON.stringify([fairAdmissions.length, fairParticipations.length, ' +
    'fairEditions.length, fairSeries.length, stakeholders.length, wineFollowGraph.length, partnerFollows.length])');
  if (state === '[5,2,6,2,18,16,2]') ok('every register ends at its fixture size — nothing leaked out of a section');
  else bad('a section left state behind: ' + state);
  assertSeven(OPPS());
}

console.log('');
if (fail) { console.log('✗ ' + fail + ' check(s) failed'); process.exit(1); }
console.log('✓ all checks passed');
