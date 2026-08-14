/* ═══════════════════════════════════════════════════════════════════
   DEMO PERSISTENCE — assets/bottle-lobby-store.js (spec C8)

   The prototype now survives a reload. That buys one thing and risks
   three, and this file is about the three.

     · ISOLATION. jsdom harnesses share a process. If persistence were
       live in here, one harness would write state the next one reads
       back — and the checks that are supposed to be the safety net
       would become the thing that hides the break. This is the worst
       failure mode the feature can have, so it is checked first and
       checked from both sides: that the switch works, and that
       load-dashboard.js actually sets it.

     · STALENESS. After a push the browser holds yesterday's snapshot,
       possibly without fields today's code reads. That has to end as
       "discarded, starting fresh", never as an afternoon spent
       debugging new code against old data.

     · COMPLETENESS. The register block is one place, which is the
       point — but one place is still a place to forget. The static
       check at the end fails the build when a new top-level `let`
       appears that nobody has classified.

   Everything here drives the real store against a real page. The
   localStorage below is a stub only because jsdom does not offer one
   at an opaque origin — it behaves like the real thing, including
   firing `storage` at the OTHER tab and not at the writer.
═══════════════════════════════════════════════════════════════════ */
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');
const { loadDashboard, KILL_SWITCH } = require('./load-dashboard');

let fail = 0;
const bad = m => { console.log('  ✗ ' + m); fail++; };
const ok  = m => console.log('  ✓ ' + m);

/* ── A shared localStorage, so two pages can be two tabs ─────────── */
function makeStorageArea() {
  const area = { _data: Object.create(null), _tabs: [] };
  const fire = (key, tab) => area._tabs.forEach(t => {
    /* The writing tab never hears its own event — that is what the
       real one does, and the store relies on it. */
    if (t.w !== tab && t.w.__onStorage) t.w.__onStorage(key);
  });
  area.api = tabWindow => ({
    getItem: k => (k in area._data ? area._data[k] : null),
    setItem: (k, v) => { area._data[k] = String(v); fire(k, tabWindow()); },
    removeItem: k => { delete area._data[k]; fire(k, tabWindow()); },
    clear: () => { area._data = Object.create(null); fire(null, tabWindow()); },
    key: i => Object.keys(area._data)[i] ?? null,
    get length() { return Object.keys(area._data).length; }
  });
  return area;
}

/* Opens the dashboard as a "tab". `persist:true` keeps the kill switch
   out so the store really runs; `area` shares storage between tabs.

   `location` and `location.reload` cannot be replaced in jsdom — the
   property is non-configurable and a plain assignment silently does
   nothing. A reload therefore has to be observed rather than stubbed:
   jsdom reports it as "Not implemented: navigation" on the virtual
   console, which is how `reloads` is counted below. Everything else on
   that channel is a real script error and stops the run. */
function openTab(area, opts) {
  opts = opts || {};
  const errs = [];
  const nav = [];
  /* Off unless explicitly asked for: the default must be exactly what
     the other harnesses get, or this file would be testing a setup
     nobody else uses. */
  /* An optional patch, so a tab can stand in for an OLDER build of the
     page — the only honest way to produce the snapshot a returning
     visitor is really holding, fingerprint included. It throws rather
     than returning: a patch that missed its target would seed a
     snapshot from the current code and prove the opposite of what the
     caller asked. */
  let html = loadDashboard(null, { persist: opts.persist === true }).html;
  if (opts.patch) {
    /* One patch or several: an older build sometimes differs in more
       than one place — the D2D pass added three rows AND moved
       VERSION — and applying them one call at a time would mean
       building the page twice. Each is checked separately, so a miss
       still names the patch that missed. */
    (Array.isArray(opts.patch) ? opts.patch : [opts.patch]).forEach(p => {
      const before = html;
      html = html.replace(p.from, p.to);
      if (html === before) throw new Error('openTab: patch never applied — ' + p.from);
    });
  }
  const dom = new JSDOM(html, {
    runScripts: 'dangerously', pretendToBeVisual: true,
    /* A real URL on purpose, and not just so history.replaceState works.
       At an opaque origin jsdom hands out no localStorage at all, which
       would let the kill-switch checks pass for the wrong reason — they
       would be proving that jsdom has no storage, not that the switch
       works. With a URL the storage is real, so the switch has to be. */
    url: 'http://localhost/bottle-lobby-dashboard.html',
    beforeParse(w) {
      if (area) {
        const self = () => w;
        Object.defineProperty(w, 'localStorage', { value: area.api(self), configurable: true });
      }
      if (opts.killSwitch) w.BL_NO_PERSIST = true;
      w.scrollTo = () => {};
      w.confirm = () => true;
    },
    virtualConsole: new VirtualConsole().on('jsdomError', e => {
      if (/Not implemented: navigation/.test(e.message)) nav.push(e.message);
      else errs.push(e.message);
    })
  });
  const w = dom.window;
  /* Bridge the stub's notifications onto the real `storage` listener
     the store installed via addEventListener. */
  w.__onStorage = key => {
    const ev = new w.Event('storage');
    ev.key = key;
    w.dispatchEvent(ev);
  };
  if (area) area._tabs.push({ w });
  if (errs.length) { console.log('SCRIPT ERRORS:\n' + errs.join('\n')); process.exit(1); }
  return { dom, w, d: w.document, errs, reloads: () => nav.length };
}

/* The store debounces by 200 ms; jsdom timers are real timers. */
const settle = (w, ms) => new Promise(r => w.setTimeout(r, ms == null ? 320 : ms));
/* Nothing in the page changes state without an event, so this is how
   the harness "acts like a user" for the autosave listener. */
const nudge = w => w.document.dispatchEvent(new w.Event('click', { bubbles: true }));
/* Every state change in the page is reached through an onclick, so a
   harness that calls the function directly has to supply the click
   the store listens for. */
const act = (w, code) => { w.eval(code); nudge(w); };
/* A freshly opened page has the role picker up, and the store treats
   any open modal as "do not touch this tab yet". A demo dismisses it
   by picking a role, so a two-tab test has to as well. */
const enter = tab => { tab.w.eval('closeRolePicker()'); return tab; };

const KEY = 'bottle-lobby-demo';
const read = area => { try { return JSON.parse(area._data[KEY]); } catch (e) { return null; } };

(async function run() {

/* ── 1. Isolation from the harnesses ───────────────────────────── */
console.log('── isolation: a harness can never inherit another\'s state');
{
  /* Poison the storage with a snapshot that would be very visible. */
  const area = makeStorageArea();
  const seed = openTab(area, { persist: true });
  act(seed.w, "simulateStaffRelease('WS-2602')");
  await settle(seed.w);
  const snap = read(area);
  if (!snap) bad('could not seed a snapshot to poison with — the rest of this section is meaningless');
  else {
    snap.data.wineShows = snap.data.wineShows.filter(s => s.id === 'WS-2603');
    area._data[KEY] = JSON.stringify(snap);

    /* (a) explicit kill switch */
    const t = openTab(area, { persist: true, killSwitch: true });
    const n = t.w.eval('wineShows.length');
    if (n === 1) bad('BL_NO_PERSIST did not stop the store — poisoned data was read');
    else if (n === 6) ok('BL_NO_PERSIST ignores a poisoned localStorage (6 fixture shows, not 1)');
    else bad('unexpected show count with the kill switch set: ' + n);
    if (t.w.eval('BLStore.isActive()')) bad('BLStore reports itself active with BL_NO_PERSIST set');
    else ok('BLStore.isActive() is false with the kill switch set');
    /* And it must not write either. */
    const before = area._data[KEY];
    nudge(t.w); await settle(t.w);
    if (area._data[KEY] !== before) bad('a disabled store still wrote to localStorage');
    else ok('a disabled store writes nothing');

    /* (b) the default every other harness gets, with no switch passed
       by hand — this is the check that protects the other 11 files. */
    const plain = openTab(area, {});
    const pn = plain.w.eval('wineShows.length');
    if (pn === 6) ok('loadDashboard() defaults to persistence off — the other harnesses are safe');
    else bad('loadDashboard() default did NOT disable persistence (shows: ' + pn + ')');
    const before2 = area._data[KEY];
    nudge(plain.w); await settle(plain.w);
    if (area._data[KEY] !== before2) bad('a default-loaded harness page wrote to localStorage');
    else ok('a default-loaded harness page writes nothing');
  }
}

/* Belt and braces: the switch is in the shared loader, not in each
   harness, and it is first in document order. */
{
  const html = loadDashboard().html;
  if (!html.includes(KILL_SWITCH)) bad('loadDashboard() does not inject the kill switch');
  else if (html.indexOf(KILL_SWITCH) > html.indexOf('bottle-lobby-store.js'))
    bad('the kill switch is injected AFTER the store script — too late to matter');
  else ok('the kill switch is injected before the store script loads');

  const harnesses = fs.readdirSync(__dirname)
    .filter(f => f.endsWith('.js') && !['run-all.js', 'load-dashboard.js', 'persistence.js'].includes(f));
  const optedIn = harnesses.filter(f =>
    /loadDashboard\([^)]*persist/.test(fs.readFileSync(path.join(__dirname, f), 'utf8')));
  if (optedIn.length) bad('these harnesses opt back into persistence: ' + optedIn.join(', '));
  else ok('none of the other ' + harnesses.length + ' harnesses opts back in');
}

/* Two pages in ONE process, sharing one storage, must not see each
   other — the concrete shape of the fear. */
{
  const area = makeStorageArea();
  const a = openTab(area, {});
  a.w.eval("wineShows.push({ id:'WS-LEAK', title:'Leak', exhibitors:[], attendees:[], events:[] })");
  nudge(a.w); await settle(a.w);
  const b = openTab(area, {});
  if (b.w.eval("wineShows.some(s => s.id === 'WS-LEAK')"))
    bad('state leaked from one harness page into the next');
  else ok('two pages in one process stay independent');
}

/* ── 2. The trigger ────────────────────────────────────────────────
   This section exists because of a bug that shipped. The first version
   saved only when a DOM event arrived AFTER the change, and every
   check here passed anyway, because the harness produced that event
   itself: it called the action, then dispatched a click, then looked
   at storage. It was testing the store's ability to serialise, and
   calling it "the trigger works".

   So these drive the REAL buttons and then touch nothing. If saving
   depends on what the user happens to do next, this section fails. */
console.log('\n── the trigger fires without being helped');

/* Walks the create-show flow the way a person does. Returns the tab
   with a new show in it and NOTHING clicked afterwards. */
function createShowByHand(tab, title) {
  const w = tab.w, d = tab.d;
  w.eval("closeRolePicker(); switchDashboard('distributor', document.querySelectorAll('.demo-btn')[1]); showWineShows('distributor','current');");
  const open = [...d.querySelectorAll('button')].find(b => /Host a Wine Show/.test(b.textContent));
  if (!open) return null;
  open.click();
  const set = (id, v) => {
    const el = d.getElementById(id);
    el.value = v;
    ['input', 'keyup', 'change'].forEach(t => el.dispatchEvent(new w.Event(t, { bubbles: true })));
  };
  set('sf-title', title); set('sf-date', '2027-10-10'); set('sf-city', 'Graz');
  const create = [...d.querySelectorAll('button')].find(b => /Create Show/.test(b.textContent));
  if (!create) return null;
  create.click();                 /* the last thing that happens. */
  return tab;
}

{
  const area = makeStorageArea();
  const t = openTab(area, { persist: true });
  const before = t.w.eval('wineShows.length');
  const ok_ = createShowByHand(t, 'Real Button Show');
  if (!ok_) bad('could not drive the create-show flow — the buttons moved');
  else if (t.w.eval('wineShows.length') !== before + 1)
    bad('the create-show flow did not create a show; the rest of this check is meaningless');
  else {
    await settle(t.w);
    const snap = read(area);
    if (!snap) bad('creating a show through the real buttons stored NOTHING');
    else if (!snap.data.wineShows.some(s => s.title === 'Real Button Show'))
      bad('a snapshot was written, but without the show that was just created');
    else ok('a show created through the real buttons is in storage, with nothing clicked afterwards');
  }
}

/* The general case, and the one the event listener alone got wrong:
   a change with no event after it at all. Nothing in a prototype
   guarantees that every mutation is followed by a click — and if it
   is only usually true, the failures are silent and look like a bug
   in whatever was being demonstrated. */
{
  const area = makeStorageArea();
  const t = openTab(area, { persist: true });
  await settle(t.w);                      /* let the initial state settle */
  t.w.eval("wineShows[0].capacity = 4242;");   /* no click, no keypress, nothing */
  await settle(t.w, 2600);                     /* one heartbeat */
  const snap = read(area);
  const cap = snap && snap.data.wineShows[0].capacity;
  if (cap !== 4242) bad('a change with no event after it was never saved (capacity in storage: ' + cap + ')');
  else ok('a change with no following event is saved anyway, within one heartbeat');
}

/* And the reason the in-memory "last written" cache had to go: clear
   the storage from devtools — the first thing anyone does when testing
   persistence — and the store believed its work was already saved. */
{
  const area = makeStorageArea();
  const t = openTab(area, { persist: true });
  t.w.eval("wineShows[0].capacity = 77;");
  nudge(t.w); await settle(t.w);
  if (!read(area)) bad('setup failed — nothing was written to clear');

  delete area._data[KEY];                 /* devtools "clear site data" */
  nudge(t.w); await settle(t.w);
  const snap = read(area);
  if (!snap) bad('after the storage was cleared behind its back, the store never wrote again');
  else if (snap.data.wineShows[0].capacity !== 77)
    bad('the store rewrote, but not the current state');
  else ok('storage cleared behind its back is noticed and rewritten');
}

/* ── 3. The round trip ─────────────────────────────────────────── */
console.log('\n── what is written comes back');
{
  const area = makeStorageArea();
  const a = openTab(area, { persist: true });
  if (!a.w.eval('BLStore.isActive()')) bad('the store is not active on a page that should persist');
  else ok('the store is active when localStorage exists');

  /* Drive a real action rather than assigning a variable: releasing a
     show is a stage change plus an event-log entry, so it proves the
     nesting survives too. */
  act(a.w, "simulateStaffRelease('WS-2602')");
  await settle(a.w);
  const snap = read(area);
  if (!snap) { bad('nothing was written after a real action'); }
  else {
    const s = snap.data.wineShows.find(x => x.id === 'WS-2602');
    if (!s || s.stage !== 'published') bad('the stage change did not reach the snapshot');
    else ok('a real action reaches localStorage without anyone calling save()');

    const b = openTab(area, { persist: true });
    const back = b.w.eval("wineShows.find(s => s.id === 'WS-2602')");
    if (!back || back.stage !== 'published') bad('the change did not come back on the next load');
    else ok('the change is there after a reload');
    if (!back.events.some(e => /Released/.test(e.text)))
      bad('the nested event log did not survive the round trip');
    else ok('nested records (events, exhibitors, interests) survive');

    /* The counters matter as much as the arrays: without them a
       reload starts re-issuing order numbers that already exist. */
    const seq = b.w.eval('orderSeq');
    if (seq !== a.w.eval('orderSeq')) bad('orderSeq did not survive (' + seq + ')');
    else ok('orderSeq and docSeq survive, so IDs stay unique across a reload');
  }
}

/* An order placed in one tab is the same one record on the other side
   of the supply chain after a reload (invariant 8). */
{
  const area = makeStorageArea();
  const a = openTab(area, { persist: true });
  const before = a.w.eval('orders.length');
  act(a.w, "placeOrder('Bistro Laurent','restaurant','Hawesko GmbH','distributor',[{wine:'Rioja Reserva 2019',qty:6,unit:12}],'harness')");
  await settle(a.w);
  const b = openTab(area, { persist: true });
  if (b.w.eval('orders.length') !== before + 1) bad('a placed order did not survive the reload');
  else ok('an order placed before the reload is there after it');
}

/* ── 4. Nothing that should not be there ───────────────────────── */
console.log('\n── the transient state stays transient');
{
  const area = makeStorageArea();
  const a = openTab(area, { persist: true });
  a.w.eval("activeShowRole = 'restaurant'; activeOrderRole = 'retail'; showState.distributor.openId = 'WS-2601';");
  act(a.w, "simulateStaffRelease('WS-2602')");   /* something real, so a write happens */
  await settle(a.w);
  const snap = read(area);
  const forbidden = ['activeShowRole', 'activeOrderRole', 'showState', 'ordState', 'filters',
                     'interestShowId', 'venueShowId', 'editingPressId'];
  const found = forbidden.filter(k => snap && snap.data.hasOwnProperty(k));
  if (found.length) bad('the snapshot carries transient UI state: ' + found.join(', '));
  else ok('no role, no open view, no modal target is stored');

  const b = openTab(area, { persist: true });
  if (b.w.eval('activeShowRole') !== 'distributor') bad('the active role was restored — the dashboard must start normally');
  else ok('a reload starts on the default role, not where the last tab was');
  if (b.w.eval("showState.distributor.openId") !== null)
    bad('an open sub-view was restored');
  else ok('a reload starts on the overview, not in the last open detail pane');
}

/* ── 5. Stale data is discarded, never merged ──────────────────── */
console.log('\n── a stale snapshot ends as "discarded", not as a bug hunt');
{
  const cases = [
    ['a shape that no longer matches', snap => { snap.fp.wineShows = 'deadbeef'; return snap; }],
    ['a collection missing entirely', snap => { delete snap.data.orders; return snap; }],
    ['a collection nobody registers any more', snap => { snap.data.legacyThing = [1, 2, 3]; return snap; }],
    ['a different store version', snap => { snap.v = 999; return snap; }]
  ];
  for (const [label, poison] of cases) {
    const area = makeStorageArea();
    const seed = openTab(area, { persist: true });
    seed.w.eval("wineShows.push({ id:'WS-STALE', title:'Stale' })");
    nudge(seed.w); await settle(seed.w);
    area._data[KEY] = JSON.stringify(poison(read(area)));

    const t = openTab(area, { persist: true });
    if (t.w.eval("wineShows.some(s => s.id === 'WS-STALE')"))
      bad(label + ': stale data was restored anyway');
    else if (t.w.eval('wineShows.length') !== 6)
      bad(label + ': did not fall back to the fixtures (' + t.w.eval('wineShows.length') + ' shows)');
    else ok(label + ' → fixtures');
    if (t.errs.length) bad(label + ': the page threw while recovering');
  }

  /* Corrupt JSON is the same path. */
  const area = makeStorageArea();
  area._data[KEY] = '{not json at all';
  const t = openTab(area, { persist: true });
  if (t.w.eval('wineShows.length') !== 6) bad('unreadable JSON did not fall back to the fixtures');
  else ok('unreadable JSON → fixtures, no crash');
  if (area._data[KEY] !== undefined) bad('the unusable snapshot was left in storage to fail again');
  else ok('the unusable snapshot is cleared out rather than re-read forever');
}

/* The discard has to be visible. A silent reset is the same afternoon
   lost as a silent restore, just in the other direction. */
{
  const area = makeStorageArea();
  const seed = openTab(area, { persist: true });
  act(seed.w, "simulateStaffRelease('WS-2602')"); await settle(seed.w);
  const snap = read(area); snap.v = 999; area._data[KEY] = JSON.stringify(snap);
  const t = openTab(area, { persist: true });
  const toast = t.d.getElementById('save-toast');
  if (!toast || !/reset|updated/i.test(toast.textContent))
    bad('nothing told the user the demo data had been reset (toast: "' + (toast && toast.textContent) + '")');
  else ok('the reset is announced in the toast, not swallowed');
}

/* ── 6. Two tabs ───────────────────────────────────────────────── */
console.log('\n── two tabs, no reload');
{
  const area = makeStorageArea();
  const distributor = enter(openTab(area, { persist: true }));
  const winery = enter(openTab(area, { persist: true }));

  act(distributor.w, "simulateStaffRelease('WS-2602')");
  await settle(distributor.w);
  await settle(winery.w, 50);

  const seen = winery.w.eval("wineShows.find(s => s.id === 'WS-2602').stage");
  if (seen !== 'published') bad('the second tab did not pick up the change (stage: ' + seen + ')');
  else ok('a change in one tab reaches the other without a reload');
  const toast = winery.d.getElementById('save-toast');
  if (!toast || !/another tab/i.test(toast.textContent))
    bad('the receiving tab gave no sign that something arrived');
  else ok('the receiving tab says where the change came from');
  if (distributor.w.eval("wineShows.find(s => s.id === 'WS-2602').stage") !== 'published')
    bad('the writing tab lost its own change');
  else ok('the writing tab does not react to its own write');
}

/* The guard Serge asked for: a tab where somebody is typing must not
   have the ground moved under it. */
{
  const area = makeStorageArea();
  const a = enter(openTab(area, { persist: true }));
  const b = enter(openTab(area, { persist: true }));

  /* Tab B opens a modal and types in it. */
  b.d.getElementById('wine-show-quote-modal').classList.add('active');
  const field = b.d.getElementById('vq-amount');
  field.value = '999';
  field.focus();

  act(a.w, "simulateStaffRelease('WS-2602')");
  await settle(a.w);
  await settle(b.w, 100);

  if (b.w.eval("wineShows.find(s => s.id === 'WS-2602').stage") === 'published')
    bad('tab B was updated while a modal was open and a field had focus');
  else ok('an open modal blocks the update — data and redraw both wait');
  if (b.d.getElementById('vq-amount').value !== '999')
    bad('the half-typed value was lost');
  else ok('what was being typed is still there');

  /* Close it, and the pending change lands on the next interaction. */
  b.d.getElementById('wine-show-quote-modal').classList.remove('active');
  b.d.getElementById('vq-amount').blur();
  nudge(b.w);
  await settle(b.w, 700);
  if (b.w.eval("wineShows.find(s => s.id === 'WS-2602').stage") !== 'published')
    bad('the deferred change never arrived after the modal closed');
  else ok('the deferred change lands once the tab is free again');
}

/* ── 7. Reset ──────────────────────────────────────────────────── */
console.log('\n── the way back');
{
  const area = makeStorageArea();
  const a = enter(openTab(area, { persist: true }));
  act(a.w, "simulateStaffRelease('WS-2602')");
  await settle(a.w);
  if (!area._data[KEY]) bad('nothing to reset — the setup failed');

  const b = enter(openTab(area, { persist: true }));   /* a second tab, open at the time */
  a.w.eval('resetDemoData()');
  if (area._data[KEY] !== undefined) bad('reset did not clear the stored snapshot');
  else ok('reset clears the stored snapshot');
  if (a.reloads() !== 1) bad('reset did not reload the page (reloads: ' + a.reloads() + ')');
  else ok('reset reloads, so the transient state goes too');

  /* Reset must not be undone by the unload write on the way out. */
  a.w.dispatchEvent(new a.w.Event('beforeunload'));
  if (area._data[KEY] !== undefined)
    bad('the unload handler wrote the state straight back after a reset');
  else ok('the unload handler does not resurrect what reset threw away');

  await settle(b.w, 100);
  if (b.reloads() !== 1) bad('the other open tab kept its stale state after a reset elsewhere');
  else ok('a reset in one tab reloads the others too');

  const reset = a.d.getElementById('demo-reset');
  if (!reset) bad('the reset button is missing');
  else if (!reset.closest('.demo-bar')) bad('the reset button is not in the demo bar');
  else ok('the reset button sits in the demo bar, with "View as:"');
}

/* ── 8. The register block is complete ─────────────────────────── */
console.log('\n── the one list stays the one list');
{
  /* Deliberately NOT persisted. Every name here is a decision, and the
     reason is the point — a bare list would rot into "whatever was
     there when someone last ran the test". */
  const TRANSIENT = {
    activeOrderRole:       'which Orders sub-view is on screen — a reload starts on the default',
    activeShowRole:        'which Wine Shows sub-view is on screen — same',
    activeEventRole:       'which My Events sub-view is on screen — same. What HAS to survive is memberEvents and eventSeq, and both are registered (A16.8)',
    activeNotifRole:       'which Notifications sub-view is on screen — same. What HAS to survive is notifSeen, and that is registered (C9)',
    acceptingId:           'the partnership request an open modal is about',
    acceptingIncomingId:   'ditto, distributor side',
    rAcceptingIncomingId:  'ditto, restaurant side',
    tAcceptingIncomingId:  'ditto, retail side',
    attendeeShowId:        'the show an open invite modal is about',
    counterShowId:         'the show an open counter-proposal modal is about',
    reachShowId:           'the show an open reach editor is about — the SETTING is on the show record and persists with it',
    applyShowId:           'the show an open application modal is about — the APPLICATION is an exhibitors row and persists with the show',
    interestShowId:        'the show an open order-list modal is about',
    inviteShowId:          'the show an open exhibitor-invite modal is about',
    venueShowId:           'the show an open venue modal is about',
    venueAcceptShowId:     'the show an open venue-acceptance modal is about — the ACCEPTANCE writes venueAcceptedAt onto the show and persists with it',
    materialWatch:         'the last-seen material shape of every show under Final Review — DERIVED from wineShows and re-read after every restore, so persisting it would store a second answer to a question the shows already answer (invariant 1)',
    notifShowId:           'the show an open notification popup is about',
    campaignDraft:         'the campaign preview awaiting its explicit confirmation — an abandoned preview stores nothing, which is the A16.14e rule, not an accident. What HAS to survive is the sent campaign, and eventCampaigns is registered',
    CAMPAIGN_MAX_RECIPIENTS: 'the A16.14e volume limit — a configurable demo constant, not state. `let` only so the campaigns harness can prove the full rejection; nothing on the page writes it',
    addLineOrderId:        'the order an open add-lines modal is about',
    shippingOrderId:       'the order an open ship modal is about',
    payingOrderId:         'the order an open payment modal is about',
    awSelectedWine:        'the wine highlighted in an open picker',
    rAwSelectedWine:       'ditto, restaurant side',
    tAwSelectedWine:       'ditto, retail side',
    editingPressId:        'the press entry an open editor is about',
    fairOpenEditionId:     'the fair edition whose detail pane is unfolded in My Fairs — a reload starts folded. What HAS to survive is fairEditions and its history, and both are registered (A19)',
    fairApptEntryPending:  'the participation id the public "Request an appointment" link carried in, before it is consumed. It is an ADDRESS, not state: it is read from the query once, cleared through replaceState, and a reload must fire nothing again (A22) — persisting it would make exactly that reload re-open the entry for good',
    fairApptOpenFor:       'which exhibitor\'s booth-appointment request form is unfolded on the Wine Shows sub-page — a reload starts folded, and the deep link from the public participation page sets it once and clears its own parameter (A22). What HAS to survive is fairAppointmentSlots and fairAppointments, and both are registered',
    fairModalSeriesId:     'the series an open edition modal belongs to',
    fairEditModalId:       'the edition an open edit modal is about (null = the modal is creating one)',
    editingPortfolioIndex: 'the portfolio row an open editor is about',
    demoSavedTimer:        'the timer behind the "Saved" flash'
  };

  const files = ['../bottle-lobby-dashboard.html', 'assets-data'];
  const src = fs.readFileSync(path.join(__dirname, '..', 'bottle-lobby-dashboard.html'), 'utf8') +
              fs.readFileSync(path.join(__dirname, '..', 'assets', 'bottle-lobby-data.js'), 'utf8');

  const registered = openTab(null, {}).w.eval('BLStore.names()');

  /* Every top-level `let` is state by definition — it is declared
     mutable at module scope. Each one is either persisted or listed
     above; there is no third answer. */
  const lets = [...new Set([...src.matchAll(/^let\s+([A-Za-z_$][\w$]*)/gm)].map(m => m[1]))];
  const orphans = lets.filter(n => !registered.includes(n) && !TRANSIENT.hasOwnProperty(n));
  if (orphans.length)
    bad('top-level state that is neither persisted nor declared transient: ' + orphans.join(', ') +
        '\n      → add it to the BLStore.register block, or to TRANSIENT in this file with a reason');
  else ok('all ' + lets.length + ' top-level `let` bindings are classified (' +
          registered.length + ' persisted, ' + Object.keys(TRANSIENT).length + ' transient)');

  const stale = Object.keys(TRANSIENT).filter(n => !lets.includes(n));
  if (stale.length) bad('TRANSIENT names things that no longer exist: ' + stale.join(', '));
  else ok('the transient list has no leftovers');

  /* A `const` collection is not read-only. Two ways to change one, and
     until 3 Aug 2026 this check knew only the first:

       arr.push(x)        — an array method
       obj[k] = v         — a property write

     The second is how every `const` OBJECT in the page is mutated, so
     the whole class was invisible: `filters` had been unclassified
     since it was written, and the stakeholders pass added three more
     without anything saying so. Found while reviewing that pass; the
     gap was in the check, not in the page.

     Each name below is a decision with a reason, like TRANSIENT
     above — a bare list would rot into "whatever was there when
     someone last ran the test". */
  const TRANSIENT_CONSTS = {
    STAKEHOLDER_INDEX: 'a lookup built from `stakeholders` at load. Storing it would be storing a second copy of the master table — the very thing that table exists to prevent (A1)',
    stakeholderMisses: 'which unknown names have already been warned about in THIS page load',
    filters:           'which filter pill is active in the distributor network view — a reload starts on "All"',
    ordState:          'per-role Orders view state: open tab, status filter, open order, whether the shell was built',
    showState:         'the same for Wine Shows, plus which visibility preview is open',
    eventState:        'the same for My Events: open tab, open event, whether the shell was built. The event RECORDS persist; which one you had open does not',
    notifState:        'the same for Notifications. What has to survive is notifSeen, and that is registered (C9)'
  };

  const consts = [...new Set([...src.matchAll(/^const\s+([A-Za-z_$][\w$]*)\s*=\s*[[{]/gm)].map(m => m[1]))];
  const byMethod = n => new RegExp('\\b' + n + '\\.(push|splice|unshift|pop|shift|sort|reverse)\\s*\\(').test(src);
  /* `X[k] =`, `X.k =`, `X.k++`, `delete X[k]` — but not `X.k ==`. */
  const byWrite = n =>
    new RegExp('(?:^|[^\\w$.])' + n + '(?:\\[[^\\]\\n]*\\]|\\.[A-Za-z_$][\\w$]*)\\s*(?:=[^=]|\\+\\+|--)', 'm').test(src) ||
    new RegExp('delete\\s+' + n + '[\\[.]').test(src);

  const mutatedConsts = consts.filter(n => byMethod(n) || byWrite(n));
  const unclassified = mutatedConsts.filter(n =>
    !registered.includes(n) && !TRANSIENT_CONSTS.hasOwnProperty(n));
  if (unclassified.length)
    bad('mutated `const` collections that nobody classified: ' + unclassified.join(', ') +
        '\n      → register them (and make them `let`), or add them to TRANSIENT_CONSTS with a reason');
  else ok('all ' + mutatedConsts.length + ' mutated `const` collections are classified (' +
          mutatedConsts.filter(n => registered.includes(n)).length + ' persisted, ' +
          mutatedConsts.filter(n => TRANSIENT_CONSTS.hasOwnProperty(n)).length + ' transient)');

  /* The property-write half has to actually find something, or the
     day it stops working it reads as "nothing to classify". */
  const writes = consts.filter(n => !byMethod(n) && byWrite(n));
  if (!writes.length)
    bad('the property-write scan matched nothing at all — it is no longer detecting the class it was added for');
  else ok('property-written consts detected: ' + writes.join(', '));

  const staleConsts = Object.keys(TRANSIENT_CONSTS).filter(n => !mutatedConsts.includes(n));
  if (staleConsts.length) bad('TRANSIENT_CONSTS names things that are no longer mutated consts: ' + staleConsts.join(', '));
  else ok('the transient-const list has no leftovers');

  /* And the register block must actually match the running page. */
  const missing = registered.filter(n => !new RegExp('^(let|const)\\s+' + n + '\\b', 'm').test(src));
  if (missing.length) bad('registered names that no longer exist in the page: ' + missing.join(', '));
  else ok('every registered name is a real binding');
}

/* ── 9. A snapshot that breaks rendering heals itself ───────────── */
console.log('\n── a snapshot that breaks the page does not strand it');
{
  const area = makeStorageArea();
  const seed = openTab(area, { persist: true });
  act(seed.w, "simulateStaffRelease('WS-2602')"); await settle(seed.w);
  /* Same shape, impossible content: a confirmed product referring to
     an exhibitor list that no renderer can cope with. */
  const snap = read(area);
  snap.data.orders.forEach(o => { o.items = null; });
  area._data[KEY] = JSON.stringify(snap);

  const t = openTab(area, { persist: true });
  if (t.reloads() !== 1) bad('a snapshot that broke rendering did not trigger the one-shot reload');
  else ok('a snapshot that breaks rendering is thrown away and the page reloads once');
  if (area._data[KEY] !== undefined) bad('the breaking snapshot was left in place to break the reload too');
  else ok('the breaking snapshot is cleared before the reload');
}

/* ── A restored snapshot may not resurrect an abandoned format ────
   Every other date check in this repo reads the FIXTURES. The browser
   does not: the store applies a stored snapshot over them at start, so
   what a returning visitor actually holds is the snapshot. That gap is
   how 59 wine-show dates stayed in display format on the live site for
   a full pass while `assertISO` — which runs against the fixtures with
   persistence switched OFF — reported all-ISO and was right to.

   The shape fingerprint cannot close it: moving "14 Mar 2027" to
   "2027-03-14" leaves every key in place, so the snapshot stays
   structurally valid and is restored. Validating VALUES was considered
   and rejected — it would discard the whole demo on every data edit,
   which is the same as not saving at all (Serge). VERSION is the lever
   instead, bumped by hand in the commit that changes the format.

   So this checks the concrete case that actually happened: a snapshot
   written BEFORE the migration, holding the old format, must not reach
   the live state. It passes because VERSION went 1 → 2 with the
   migration; had the bump been forgotten, that snapshot would still be
   at the current version and would be restored, and this fails.

   The limit, stated rather than papered over: this cannot catch the
   NEXT format migration if someone forgets to bump again. There is no
   mechanical guard for that — only the note at VERSION in
   bottle-lobby-store.js and this section as the worked example. */
console.log('\n── a pre-migration snapshot cannot bring back the old format');
{
  const ISO = /^\d{4}-\d{2}-\d{2}$/;
  const toDisplay = v => {
    const m = ISO.exec(v || '');
    if (!m) return v;
    const M = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const [y, mo, d] = v.split('-');
    return d + ' ' + M[Number(mo) - 1] + ' ' + y;
  };
  const area = makeStorageArea();
  const seed = openTab(area, { persist: true });
  seed.w.eval("wineShows[0].title = wineShows[0].title");   /* touch, so a snapshot is written */
  nudge(seed.w); await settle(seed.w);

  /* Roll the stored dates back, keeping version and fingerprint valid
     — the snapshot a browser was really holding. */
  const snap = read(area);
  let rolled = 0;
  (snap.data.wineShows || []).forEach(s => {
    if (s.date && ISO.test(s.date)) { s.date = toDisplay(s.date); rolled++; }
    ['venueQuotedAt', 'venueAcceptedAt'].forEach(k => { if (s[k] && ISO.test(s[k])) { s[k] = toDisplay(s[k]); rolled++; } });
    (s.events || []).concat(s.attendees || [], s.interests || []).forEach(x => {
      if (x.at && ISO.test(x.at)) { x.at = toDisplay(x.at); rolled++; }
    });
  });
  /* Written by the store version that was current when those values
     were — that is what a returning visitor is actually holding. */
  snap.v = 1;
  area._data[KEY] = JSON.stringify(snap);

  if (!rolled) bad('nothing to roll back — the snapshot carried no ISO dates, so this check proves nothing');
  else {
    const t = openTab(area, { persist: true });
    const live = t.w.eval('JSON.parse(JSON.stringify(wineShows))');
    const stale = [];
    live.forEach(s => {
      if (s.date && !ISO.test(s.date)) stale.push(s.id + '.date="' + s.date + '"');
      ['venueQuotedAt', 'venueAcceptedAt'].forEach(k => { if (s[k] && !ISO.test(s[k])) stale.push(s.id + '.' + k); });
      (s.events || []).concat(s.attendees || [], s.interests || []).forEach(x => {
        if (x.at && !ISO.test(x.at)) stale.push(s.id + '.at="' + x.at + '"');
      });
    });
    if (stale.length)
      bad(stale.length + ' of ' + rolled + ' rolled-back date(s) survived into the live state: ' +
          stale.slice(0, 3).join(' · ') + ' — bump VERSION in bottle-lobby-store.js when the ' +
          'FORMAT of stored data changes; the shape fingerprint cannot see it');
    else ok('a snapshot holding ' + rolled + ' old-format dates does not reach the live state');
  }
}

/* ── A snapshot from before the product key cannot come back ──────
   The other half of the same lesson, and the reason it is checked
   rather than reasoned about: on 03.08 the shape fingerprint was
   blind to the date migration because only VALUES had changed, and
   the conclusion "so the fingerprint handles the rest" was mine and
   wrong once already.

   Adding `id` to the product rows changes KEYS, which is what a shape
   fingerprint is for — so no VERSION bump is needed here. That is a
   claim about a mechanism, so it gets a check: three of the four
   product books are registered, and a returning visitor is holding
   rows with no id at all.

   WHAT THE COMPARISON ACTUALLY COMPARES, because the obvious reading
   is wrong and cost a round of measuring. It is the WRITER's fixture
   hash, stored in the snapshot, against the READER's fixture hash.
   The snapshot's own data is never hashed. So a snapshot carrying
   today's fingerprint beside pre-key rows IS restored — no build ever
   writes that pair, but devtools can, and it is the edge of the
   guarantee rather than a hole in this check. It is also why the seed
   tab below is a patched BUILD and not an edited snapshot: only a
   real older build produces the older fingerprint.

   `BLStore.fingerprints()` returns a cached value computed once at
   register(), so stripping ids from the live arrays and re-reading it
   measures the cache and not the shape function. Measured properly,
   the two builds hash currentWinePortfolio as 7b89eeb8 and 2b0bc140.

   It matters more than it looks. tests/wine-identity.js runs with
   persistence switched off and reads the fixtures, so it would report
   "39 rows, every one carrying an id" while the browser in front of
   somebody held a portfolio with none — exactly the gap that let a
   green assertISO run sit next to a dashboard full of display
   dates. */
console.log('\n── a snapshot from before the product key does not come back');
{
  const BOOKS = ['currentWinePortfolio', 'rCurrentWineList', 'tCurrentWineSelection'];
  const area = makeStorageArea();

  /* The seed tab IS the previous build: every id removed from the
     source, so the fixture it registers, the fingerprint it computes
     and the snapshot it writes are all the pre-key ones. Editing a
     current snapshot by hand instead would leave the new fingerprint
     in place and test hand-edited storage, not a returning visitor. */
  const seed = openTab(area, { persist: true, patch: { from: /id:'PRD-\d{4}', /g, to: '' } });
  const seeded = seed.w.eval(BOOKS.map(b => b + '.length').join('+'));
  const withId = seed.w.eval(BOOKS.map(b => b + ".filter(function (r) { return r.id; }).length").join('+'));
  seed.w.eval('currentWinePortfolio[0].ownLabel = currentWinePortfolio[0].ownLabel');
  nudge(seed.w); await settle(seed.w);

  /* Kept verbatim: discarding a snapshot REMOVES it, so the tab below
     would otherwise open on empty storage and read as "the rows did
     not come back" for the wrong reason. */
  const raw = area._data[KEY];
  const snap = read(area);
  if (!snap) bad('the previous build wrote no snapshot — this check proves nothing');
  else if (withId) bad(withId + ' row(s) still carried an id in the seed tab — the patch did not remove the key');
  else if (!seeded) bad('the seed tab held no product rows at all');
  else {
    const t = openTab(area, { persist: true });
    const back = t.w.eval('(' + BOOKS.map(b => b + ".filter(function (r) { return !r.id; }).length").join('+') + ')');
    if (back)
      bad(back + ' of ' + seeded + ' id-less row(s) reached the live state — the shape ' +
          'fingerprint did not see the new key, so adding it needed a VERSION bump after all');
    else
      ok('a snapshot written by the build before the key, holding ' + seeded +
         ' id-less product rows, is discarded — the fingerprint sees a new KEY, ' +
         'which is what it could not do for the date migration (only values moved there)');

    /* Counter-check. The claim above is about ONE mechanism, so the
       mechanism gets switched off: with the fingerprint comparison
       gone, the same snapshot passes the version check and the id-less
       rows must come back. Without this the section would go green
       even if the store had stopped comparing shapes at all. */
    area._data[KEY] = raw;
    /* Two mechanisms now stand in front of an old-shape snapshot: the
       per-name fingerprint AND the schema record (the seed build's
       fixtures hash to another schema). To prove the fingerprint is
       real, BOTH are switched off — a snapshot then held back would
       mean some third thing does the work. */
    const blind = openTab(area, { persist: true, patch: [ {
      from: "else if (fp[e.name] !== fixtureFp[e.name]) changed.push(e.name + ' (shape changed)');",
      to:   "else if (false) changed.push(e.name + ' (shape changed)');" }, {
      from: 'if (schemaWhy) return schemaWhy;',
      to:   'if (false) return schemaWhy;' } ] });
    const returned = blind.w.eval('(' + BOOKS.map(b => b + ".filter(function (r) { return !r.id; }).length").join('+') + ')');
    if (returned === seeded)
      ok('caught: with the shape comparison and the schema record removed, all ' + returned +
         ' id-less rows return — those two are what stop them, not the version');
    else
      bad('with the comparisons removed only ' + returned + ' of ' + seeded +
          ' id-less rows returned — something else is doing this work, ' +
          'so the check above does not prove what it says');
  }
}

/* ── A snapshot from before the show products named keys ──────────
   Pass 3b moved `wineShows[].exhibitors[].products[].name` and
   `interests[].product` onto `productId`. `wineShows` is registered,
   so this is a KEY change in a persisted collection and the same
   mechanism applies — but "the same mechanism applies" is exactly the
   sentence that was wrong once already, so it is measured rather than
   assumed.

   IT ALSO SETTLES THE notifSeen QUESTION. The read marker's ids are
   built from rendered text (`notifId('wine', winery + '·' + label,
   at)`), so a changed label silently marks every notification unread
   again — and the shape fingerprint could not see that, because ids
   are strings either way. Measured across all 178 rendered surfaces
   before and after this pass: the labels are byte-identical, so no id
   moved. Nothing to bump. The fragility itself is real and is the
   "event identity" pass; it is not repaired here. */
console.log('\n── a snapshot from before the show products named keys');
{
  const area = makeStorageArea();
  /* The seed tab is the pre-3b build: the field is called `name`
     again, which is the shape change, and its own fingerprint follows. */
  const seed = openTab(area, { persist: true, patch: { from: /productId:'(PRD-\d{4})'/g, to: "name:'$1'" } });
  const oldShape = seed.w.eval(`(function () {
    var n = 0;
    wineShows.forEach(function (s) {
      (s.exhibitors || []).forEach(function (x) { (x.products || []).forEach(function (p) { if (!p.productId) n++; }); });
      (s.interests || []).forEach(function (i) { if (!i.productId) n++; });
    });
    return n;
  })()`);
  seed.w.eval("wineShows[0].title = wineShows[0].title");
  nudge(seed.w); await settle(seed.w);
  const raw = area._data[KEY];

  if (!raw) bad('the pre-3b build wrote no snapshot — this check proves nothing');
  else if (!oldShape) bad('the seed tab still had productId everywhere — the patch did not change the shape');
  else {
    const t = openTab(area, { persist: true });
    const back = t.w.eval(`(function () {
      var n = 0;
      wineShows.forEach(function (s) {
        (s.exhibitors || []).forEach(function (x) { (x.products || []).forEach(function (p) { if (!p.productId) n++; }); });
        (s.interests || []).forEach(function (i) { if (!i.productId) n++; });
      });
      return n;
    })()`);
    if (back)
      bad(back + ' of ' + oldShape + ' pre-3b show reference(s) reached the live state — every ' +
          'surface reading productId would render blank, and the fingerprint did not stop it');
    else
      ok('a snapshot holding ' + oldShape + ' show references in the old shape is discarded');

    area._data[KEY] = raw;
    /* Both guards off, as above: fingerprint and schema record. */
    const blind = openTab(area, { persist: true, patch: [ {
      from: "else if (fp[e.name] !== fixtureFp[e.name]) changed.push(e.name + ' (shape changed)');",
      to:   "else if (false) changed.push(e.name + ' (shape changed)');" }, {
      from: 'if (schemaWhy) return schemaWhy;',
      to:   'if (false) return schemaWhy;' } ] });
    const returned = blind.w.eval(`(function () {
      var n = 0;
      wineShows.forEach(function (s) {
        (s.exhibitors || []).forEach(function (x) { (x.products || []).forEach(function (p) { if (!p.productId) n++; }); });
        (s.interests || []).forEach(function (i) { if (!i.productId) n++; });
      });
      return n;
    })()`);
    if (returned === oldShape)
      ok('caught: with the shape comparison and the schema record removed, all ' + returned + ' come back — ' +
         'so it is those guards doing this and not the version number');
    else
      bad('with the comparisons removed only ' + returned + ' of ' + oldShape + ' came back — ' +
          'something else is doing this work and the check above does not prove what it says');
  }
}

/* ── A snapshot from before an ADDED ROW cannot hide it ───────────
   The third class, and the two above are why it needs its own check:
   guard 2 sees a new KEY, VERSION was bumped for a changed VALUE
   FORMAT — and neither of them describes a row simply being ADDED.

   THE FINGERPRINT IS BLIND TO IT BY CONSTRUCTION. An array folds to
   the UNION of its element shapes, so a collection with one more row
   of a shape it already holds hashes identically. That is not a bug in
   the fold; it is what makes optional fields work at all. The section
   below asserts the blindness rather than asserting around it: the old
   build's fingerprints for the three collections must come out EQUAL
   to today's, and only then does the version number mean anything.

   OBSERVED, not constructed. The D2D pass (06.08.2026) added three
   rows of existing shape — ORD-2043 to `orders`, the Hawesko ↔ Enoteca
   row to `partnerships`, Enoteca's listing to `listings` — and shipped
   without a bump. A returning visitor's snapshot restored over the new
   fixtures and the order and the partner card were gone from the
   running page. VERSION went 3 → 4 in the same commit as this check. */
console.log('\n── a snapshot from before an added row does not hide the row');
{
  const AT = "at:'2026-05-19'";
  /* The previous build, in three edits and one number. Anchored on the
     rows' own text so a later edit to any of them turns this red
     rather than quietly seeding today's page. */
  const ROWS_GONE = [
    { from: "  { distributor:'Hawesko GmbH', partner:'Enoteca Milano Import Srl', " + AT + ", activatedBy:'Bottle Lobby' }\n];",
      to:   "\n];" },
    { from: "  { holder:'Enoteca Milano Import Srl', productId:'PRD-1015', exclusive:false, listedAt:LISTED_AT, holderArticleNo:'EMI-0447', monthlyVolume:null, tradePrice:21.90 },\n",
      to:   '' },
    { from: "  { id:'ORD-2043', placed:'2026-06-16', buyer:'Enoteca Milano Import Srl', buyerType:'distributor',",
      to:   "  { id:'ORD-9999', placed:'2026-06-16', buyer:'REMOVED', buyerType:'distributor'," }
  ];
  /* THE VERSION ANCHOR IS READ, NOT TYPED. It named 4 literally, and
     the next bump would have made this patch stop applying — which
     openTab() reports as "the patch never applied", correctly, but only
     after somebody has spent a while wondering why. It now takes
     whatever the store ships and steps one back. */
  const CURRENT_VERSION = (() => {
    const m = fs.readFileSync(path.join(__dirname, '..', 'assets', 'bottle-lobby-store.js'), 'utf8')
      .match(/var VERSION\s*=\s*(\d+);/);
    if (!m) { bad('the store no longer declares a VERSION — this whole section cannot run'); return null; }
    return Number(m[1]);
  })();
  const OLD_VERSION = { from: '  var VERSION   = ' + CURRENT_VERSION + ';',
                        to:   '  var VERSION   = ' + (CURRENT_VERSION - 1) + ';' };

  const area = makeStorageArea();
  const seed = openTab(area, { persist: true, patch: ROWS_GONE.concat([OLD_VERSION]) });
  /* THE THIRD COUNT NAMES ITS ROW NOW, and that is a correction the
     own-label pass forced. It used to count every listing Enoteca holds,
     which was one — the Pouilly-Fumé the D2D pass added. Enoteca holds a
     second one since the own-label fixtures, on PRD-1028, and it has
     nothing to do with the build this seed is reconstructing. Counting
     the holder rather than the ROW made the check depend on Enoteca never
     taking on another wine, which is not a property anybody promised. */
  const gone = seed.w.eval(`(function () {
    return [ orders.filter(function (o) { return o.id === 'ORD-2043'; }).length,
             partnerships.filter(function (p) { return p.partner === 'Enoteca Milano Import Srl' && p.distributor === 'Hawesko GmbH'; }).length,
             listings.filter(function (l) { return l.holder === 'Enoteca Milano Import Srl' && l.productId === 'PRD-1015'; }).length ].join(',');
  })()`);

  if (gone !== '0,0,0') {
    bad('the seed tab still holds the D2D rows (' + gone + ') — the patches did not produce the older build');
  } else {
    seed.w.eval('orders[0].note = orders[0].note');   /* touch, so a snapshot is written */
    nudge(seed.w); await settle(seed.w);
    const snap = read(area);
    const today = openTab(null, {}).w.eval('JSON.stringify(BLStore.fingerprints())');

    if (!snap) {
      bad('the previous build wrote no snapshot — this check proves nothing');
    } else if (snap.v !== CURRENT_VERSION - 1) {
      bad('the seed tab wrote version ' + snap.v + ' — the VERSION patch did not take, so the discard below would be for the wrong reason');
    } else {
      /* THE POINT OF THE SECTION. If these differ, the fingerprint
         could have caught it and the version number was never the
         thing under test. */
      const same = ['orders', 'partnerships', 'listings']
        .filter(k => snap.fp[k] === JSON.parse(today)[k]);
      if (same.length !== 3)
        bad('the shape fingerprint DID change for ' + (3 - same.length) + ' of the three collections — ' +
            'then this is a guard-2 case and not a VERSION case, and the reasoning above is wrong');
      else
        ok('all three collections hash identically before and after the added rows — the fingerprint cannot see a row, only a shape');

      const t = openTab(area, { persist: true });
      const back = t.w.eval(`(function () {
        return [ orders.filter(function (o) { return o.id === 'ORD-2043'; }).length,
                 partnerships.filter(function (p) { return p.partner === 'Enoteca Milano Import Srl' && p.distributor === 'Hawesko GmbH'; }).length,
                 listings.filter(function (l) { return l.holder === 'Enoteca Milano Import Srl' && l.productId === 'PRD-1015'; }).length ].join(',');
      })()`);
      if (back !== '1,1,1')
        bad('after restoring the older snapshot the page holds ' + back + ' of the three D2D rows (want 1,1,1) — ' +
            'the snapshot was merged over the new fixtures; bump VERSION in bottle-lobby-store.js when fixture ROWS are added');
      else
        ok('an older snapshot written before the three rows is discarded, and the order, the partnership and the listing are all there');

      /* Counter-check: the same older build, but shipped WITHOUT the
         bump — the mistake this section exists for. Its snapshot then
         carries today's version and today's fingerprint, nothing
         refuses it, and the three rows must vanish. If they do not,
         something other than VERSION is doing the work above and this
         section proves nothing. */
      const area2 = makeStorageArea();
      const forgot = openTab(area2, { persist: true, patch: ROWS_GONE });
      forgot.w.eval('orders[0].note = orders[0].note');
      nudge(forgot.w); await settle(forgot.w);
      const unbumped = read(area2);
      if (!unbumped || unbumped.v !== CURRENT_VERSION) {
        bad('the un-bumped seed wrote version ' + (unbumped && unbumped.v) + ' — the counter-check never reached its own premise');
      } else {
        const t2 = openTab(area2, { persist: true });
        const hidden = t2.w.eval(`(function () {
          return [ orders.filter(function (o) { return o.id === 'ORD-2043'; }).length,
                   partnerships.filter(function (p) { return p.partner === 'Enoteca Milano Import Srl' && p.distributor === 'Hawesko GmbH'; }).length,
                   listings.filter(function (l) { return l.holder === 'Enoteca Milano Import Srl' && l.productId === 'PRD-1015'; }).length ].join(',');
        })()`);
        if (hidden === '0,0,0')
          ok('caught: with the bump left out, the identical snapshot IS restored and all three rows disappear — the version number is what stops it, and nothing else could have');
        else
          bad('without the bump the rows still came back (' + hidden + ') — something other than VERSION is refusing that snapshot, so the check above does not prove what it says');
      }
    }
  }
}

/* ── 10. The read-only public hydration path (A21.8, FP-13) ────────
   The canonical Participation Page reads the SAME snapshot the
   dashboard writes — through BLStore.hydrate(), never start(). This
   section lives HERE and not in tests/fair-participation.js for a
   measured reason: this file is the ONE harness allowed to run a
   live store (the kill-switch scan in section 1 fails every other
   harness that opts in), and hydration without a live store proves
   nothing. */
console.log('\n── the public page reads the snapshot and can never write it');
{
  const PAGE = path.join(__dirname, '..', 'bottle-lobby-fair-participation.html');
  function openPage(area, opts) {
    opts = opts || {};
    const errs = [];
    let html = loadDashboard(PAGE, { persist: true }).html;
    if (opts.patch) {
      const before = html;
      html = html.replace(opts.patch.from, opts.patch.to);
      if (html === before) throw new Error('openPage: patch never applied — ' + opts.patch.from);
    }
    const dom = new JSDOM(html, {
      runScripts: 'dangerously', pretendToBeVisual: true,
      url: 'http://localhost/bottle-lobby-fair-participation.html' + (opts.query || ''),
      beforeParse(w) {
        if (area) {
          const self = () => w;
          Object.defineProperty(w, 'localStorage', { value: area.api(self), configurable: true });
        }
        w.scrollTo = () => {};
      },
      virtualConsole: new VirtualConsole().on('jsdomError', e => {
        if (!/Not implemented: navigation/.test(e.message)) errs.push(e.message);
      })
    });
    const w = dom.window;
    w.__onStorage = () => {};
    if (area) area._tabs.push({ w });
    if (errs.length) { console.log('SCRIPT ERRORS:\n' + errs.join('\n')); process.exit(1); }
    return { w, d: w.document };
  }
  const pageText = tab => {
    const c = tab.d.body.cloneNode(true);
    [...c.querySelectorAll('script')].forEach(n => n.remove());
    return c.textContent;
  };

  /* (a) a saved dashboard change reaches the public page — ordinary
     save, ordinary open, no test-only handover (FP-13). */
  const area = makeStorageArea();
  const dash = enter(openTab(area, { persist: true }));
  act(dash.w, "setFairParticipationDescription('FP-9401','Domaine Lefèvre','Hydration probe — the saved sentence')");
  await settle(dash.w);
  const seeded = read(area);
  if (seeded && JSON.stringify(seeded.data.fairParticipations).includes('Hydration probe'))
    ok('the dashboard change sits in the ordinarily saved snapshot');
  else bad('the dashboard change never reached the snapshot — the rest of this section is meaningless');

  const page = openPage(area, { query: '?id=FP-9401' });
  if (/Hydration probe — the saved sentence/.test(pageText(page)))
    ok('the public page shows the CURRENT record after an ordinary open — hydrated from the same snapshot');
  else bad('the public page still renders the fixture after a saved dashboard change (FP-13)');

  /* (b) the read path never writes — save, reset and start are dead. */
  const frozen = area._data[KEY];
  if (page.w.eval('BLStore.isReadOnly()') === true) ok('hydrate() marked the page read-only');
  else bad('the public page is not read-only after hydrate()');
  const saved = page.w.eval('BLStore.save()');
  page.w.eval('BLStore.reset()');
  const started = page.w.eval('BLStore.start({})');
  nudge(page.w); await settle(page.w);
  if (saved === false && started === 'refused' && area._data[KEY] === frozen)
    ok('save(), reset() and start() are all dead on the hydrated page — storage stays byte-identical');
  else bad('the read path wrote, reset or wired autosave (FP-13)');
  if (page.w.eval('typeof fairAdmissions') === 'undefined' &&
      read(area).data.fairAdmissions)
    ok('the private collections never reach the page, and the snapshot keeps them untouched (FR-11)');
  else bad('private recruiting data crossed the hydration boundary');
  const refused = page.w.eval("BLStore.register({ fairAdmissions: [function () { return []; }, function () {}] }); BLStore.hydrate()");
  if (refused === 'refused' && area._data[KEY] === frozen)
    ok('registering a private collection against hydrate() is refused WHOLE — the allowlist is the boundary');
  else bad('hydrate() served a collection outside the fixed allowlist (FP-13)');

  /* (c) the counter-proof the pass was built to avoid: the same page
     wired through start() instead of the read-only entry. start()
     restores strictly (names beyond the page's registration discard
     the snapshot — a DELETE) and wires autosave, whose next save
     writes the page's partial registration. Either way the
     dashboard's full snapshot is gone. hydrate() exists because of
     exactly this, and the proof is that the damage is real. */
  {
    const area2 = makeStorageArea();
    const seed2 = enter(openTab(area2, { persist: true }));
    act(seed2.w, "setFairParticipationDescription('FP-9401','Domaine Lefèvre','probe two')");
    await settle(seed2.w);
    const full = read(area2);
    if (!full || !full.data.fairAdmissions) bad('could not seed the full snapshot for the counter-proof');
    else {
      const rogue = openPage(area2, {
        query: '?id=FP-9401',
        patch: { from: 'BLStore.hydrate();', to: 'BLStore.start({});' }
      });
      nudge(rogue.w); await settle(rogue.w);
      const after = read(area2);
      if (!after || !after.data || !after.data.fairAdmissions)
        ok('caught: the start() route destroys the dashboard\'s snapshot — fairAdmissions and every other private collection fall out of storage. The read-only entry is what prevents this, and nothing else could have');
      else bad('the start() route left the full snapshot intact — the read-only entry is not what protects it, so FP-13\'s reasoning is unproven');
    }
  }

  /* (d) no valid snapshot → the fixtures render; an invalid one is
     IGNORED under the store's one validity rule — and never deleted:
     the dashboard is the only writer. */
  {
    const empty = openPage(makeStorageArea(), { query: '?id=FP-9401' });
    if (/Burgundy table/.test(pageText(empty)))
      ok('with no snapshot at all, the page renders the canonical fixtures');
    else bad('the page needs a snapshot to render — the fixture fallback is broken');

    const area3 = makeStorageArea();
    const stale = JSON.parse(JSON.stringify(seeded));
    stale.v = stale.v - 1;
    area3._data[KEY] = JSON.stringify(stale);
    const old = openPage(area3, { query: '?id=FP-9401' });
    if (/Burgundy table/.test(pageText(old)) && !/Hydration probe/.test(pageText(old)) &&
        area3._data[KEY] === JSON.stringify(stale))
      ok('an outdated snapshot follows the store\'s own version rule — ignored, fixtures render, and the page DELETES nothing');
    else bad('the page restored, reinterpreted or deleted an outdated snapshot');

    const area4 = makeStorageArea();
    area4._data[KEY] = 'not readable json {';
    const corrupt = openPage(area4, { query: '?id=FP-9401' });
    if (/Burgundy table/.test(pageText(corrupt)) && area4._data[KEY] === 'not readable json {')
      ok('a corrupt snapshot is ignored and left in place — same answer, no write');
    else bad('the page wrote or crashed over a corrupt snapshot');
  }

  /* (e) THE SHARED CONTRACT (Codex correction, A21.8): the page must
     ignore every snapshot the dashboard would judge invalid — also
     about collections the page never loads. The schema record (`sh` +
     SCHEMA_HASH) is what carries that judgment across; first pin the
     constant to the live registration, or nothing below means much. */
  {
    const pin = enter(openTab(makeStorageArea(), { persist: true }));
    const live = pin.w.eval('BLStore.liveSchemaHash()');
    const pinned = pin.w.eval('BLStore.SCHEMA_HASH');
    if (live === pinned)
      ok('SCHEMA_HASH is pinned to the live registration (' + live + ') — the one contract has one value');
    else
      bad('SCHEMA_HASH is stale: constant ' + pinned + ', live ' + live +
          ' — update the constant in assets/bottle-lobby-store.js in the same commit (C8)');

    /* legacyGhost in data AND fp — the exact Codex reproduction. Two
       variants: sh left as written (integrity breaks), and sh
       recomputed over the tampered map (currency breaks). */
    const ghosted = JSON.parse(JSON.stringify(seeded));
    ghosted.data.legacyGhost = [];
    ghosted.fp.legacyGhost = 'deadbeef';
    const variants = [
      ['sh as written',   JSON.stringify(ghosted)],
      ['sh recomputed',   (() => { const g = JSON.parse(JSON.stringify(ghosted));
                                   g.sh = pin.w.eval('BLStore.schemaHashOf(' + JSON.stringify(g.fp) + ')');
                                   return JSON.stringify(g); })()]
    ];
    for (const [label, blob] of variants) {
      const areaG = makeStorageArea();
      areaG._data[KEY] = blob;
      const pageG = openPage(areaG, { query: '?id=FP-9401' });
      if (/Burgundy table/.test(pageText(pageG)) && !/Hydration probe/.test(pageText(pageG)) &&
          areaG._data[KEY] === blob)
        ok('legacyGhost (' + label + '): the page ignores the snapshot, renders fixtures, storage stays byte-identical');
      else bad('legacyGhost (' + label + '): the page hydrated a snapshot carrying an unknown collection (FP-13)');
      /* And the dashboard judges the SAME bytes invalid — both
         documents, one answer. */
      const dashG = openTab(areaG, { persist: true });
      if (dashG.w.eval("fairParticipationById('FP-9401').description").indexOf('Hydration probe') === -1 &&
          areaG._data[KEY] !== blob)
        ok('legacyGhost (' + label + '): the dashboard judges the same snapshot invalid too — discarded, fixtures live');
      else bad('legacyGhost (' + label + '): dashboard and page disagree about the same bytes');
    }

    /* A PRIVATE collection's fingerprint drifts — fairAdmissions, which
       the page never loads and must still judge by. sh recomputed, so
       only the currency check can catch it. */
    const priv = JSON.parse(JSON.stringify(seeded));
    priv.fp.fairAdmissions = 'deadbeef';
    priv.sh = pin.w.eval('BLStore.schemaHashOf(' + JSON.stringify(priv.fp) + ')');
    const privBlob = JSON.stringify(priv);
    const areaP = makeStorageArea();
    areaP._data[KEY] = privBlob;
    const pageP = openPage(areaP, { query: '?id=FP-9401' });
    if (/Burgundy table/.test(pageText(pageP)) && !/Hydration probe/.test(pageText(pageP)) &&
        areaP._data[KEY] === privBlob &&
        pageP.w.eval('typeof fairAdmissions') === 'undefined' &&
        pageP.w.eval("BLStore.names().sort().join(',')") === 'fairEditions,fairHalls,fairParticipations,fairSeries,fairStands')
      ok('a drifted PRIVATE fingerprint (fairAdmissions) invalidates the snapshot for the page too — judged without ever loading or exposing a private value');
    else bad('the page hydrated past a private-collection drift, or exposed one (FP-13)');

    /* The counter-proofs: without the shared contract, both ghosts
       hydrate — proving the checks above bite. The rogue pages carry
       the ghost/private snapshots and a store whose hydrate skips the
       contract. */
    const areaR = makeStorageArea();
    areaR._data[KEY] = variants[1][1];
    const rogueG = openPage(areaR, { query: '?id=FP-9401', patch: {
      from: 'var invalid = snapshotInvalidWhy(p);   /* the one shared contract */',
      to:   'var invalid = null;' } });
    const areaR2 = makeStorageArea();
    areaR2._data[KEY] = privBlob;
    const rogueP = openPage(areaR2, { query: '?id=FP-9401', patch: {
      from: 'var invalid = snapshotInvalidWhy(p);   /* the one shared contract */',
      to:   'var invalid = null;' } });
    if (/Hydration probe/.test(pageText(rogueG)) && /Hydration probe/.test(pageText(rogueP)))
      ok('caught: with the shared contract skipped, BOTH tampered snapshots hydrate on the page — the contract is what stops them, and nothing else could have');
    else bad('the tampered snapshots were held back even without the contract — something else does this work, so the checks above do not prove what they say');
  }
}

/* ── 11. The Wine Guide on the same read-only path (DIR-4, O5) ──────
   The public directory is the SECOND document to read the dashboard's
   snapshot, and it reads it through the same entry, the same
   allowlist and the same validity contract — that sameness is what is
   measured here, not a second mechanism. This section lives in this
   file for the reason section 10 does: this is the one harness allowed
   to run a live store, and a hydration check without one proves
   nothing.

   The visible act is a PUBLICATION: FE-7102 is the hybrid draft, on no
   directory by FS-6. Publishing it in the dashboard is an ordinary,
   permitted organizer act — and the directory has to show it after an
   ordinary reload, with nothing handed over between the two documents
   but storage. */
console.log('\n── the public directory reads the same snapshot, and can never write it');
{
  const GUIDE = path.join(__dirname, '..', 'bottle-lobby-wine-guide.html');
  function openGuide(area, opts) {
    opts = opts || {};
    const errs = [];
    let html = loadDashboard(GUIDE, { persist: true }).html;
    if (opts.patch) {
      const before = html;
      html = html.replace(opts.patch.from, opts.patch.to);
      if (html === before) throw new Error('openGuide: patch never applied — ' + opts.patch.from);
    }
    const dom = new JSDOM(html, {
      runScripts: 'dangerously', pretendToBeVisual: true,
      url: 'http://localhost/bottle-lobby-wine-guide.html',
      beforeParse(w) {
        if (area) {
          const self = () => w;
          Object.defineProperty(w, 'localStorage', { value: area.api(self), configurable: true });
        }
        w.scrollTo = () => {};
      },
      virtualConsole: new VirtualConsole().on('jsdomError', e => {
        if (!/Not implemented: navigation/.test(e.message)) errs.push(e.message);
      })
    });
    const w = dom.window;
    w.__onStorage = () => {};
    if (area) area._tabs.push({ w });
    if (errs.length) { console.log('SCRIPT ERRORS:\n' + errs.join('\n')); process.exit(1); }
    return { w, d: w.document };
  }
  const directoryText = tab => {
    const c = tab.d.getElementById('gpanel-events').cloneNode(true);
    [...c.querySelectorAll('script')].forEach(n => n.remove());
    return c.textContent;
  };

  /* (a) an ordinary save in the dashboard, an ordinary open of the
     Guide — and the draft that was on no directory is on it. */
  const area = makeStorageArea();
  const dash = enter(openTab(area, { persist: true }));
  const drafted = dash.w.eval("fairEditionById('FE-7102').status");
  act(dash.w, "publishFairEdition('FE-7102')");
  await settle(dash.w);
  const seeded = read(area);
  if (drafted === 'draft' && seeded &&
      seeded.data.fairEditions.find(e => e.id === 'FE-7102').status === 'published')
    ok('the publication sits in the ordinarily saved snapshot (draft → published)');
  else bad('the publication never reached the snapshot — the rest of this section is meaningless');

  const guide = openGuide(area);
  if (/Autumn edition/.test(directoryText(guide)) || guide.w.eval(
        "eventsFacetRows().some(r => r.entry.kind === 'fairEdition' && r.entry.rec.id === 'FE-7102')"))
    ok('the Guide lists the newly published edition after an ordinary open — hydrated from the same snapshot');
  else bad('the Guide still renders the fixtures after a saved dashboard change (DIR-4)');

  /* (b) the read path never writes. */
  const frozen = area._data[KEY];
  if (guide.w.eval('BLStore.isReadOnly()') === true) ok('hydrate() marked the Guide read-only');
  else bad('the Guide is not read-only after hydrate()');
  const saved = guide.w.eval('BLStore.save()');
  guide.w.eval('BLStore.reset()');
  const started = guide.w.eval('BLStore.start({})');
  nudge(guide.w); await settle(guide.w);
  if (saved === false && started === 'refused' && area._data[KEY] === frozen)
    ok('save(), reset() and start() are all dead on the Guide — storage stays byte-identical');
  else bad('the Guide wrote, reset or wired autosave (DIR-4)');

  /* (c) the allowlist is the boundary, and no private collection is
     registered or even present. */
  if (guide.w.eval("BLStore.names().sort().join(',')") ===
        'fairEditions,fairHalls,fairParticipations,fairSeries,fairStands' &&
      guide.w.eval('typeof fairAdmissions') === 'undefined' &&
      read(area).data.fairAdmissions)
    ok('the Guide registers exactly the public collections, loads no admission, and leaves the private ones in storage (FR-11)');
  else bad('the Guide registered or reached a private collection');
  const refused = guide.w.eval(
    "BLStore.register({ fairAdmissions: [function () { return []; }, function () {}] }); BLStore.hydrate()");
  if (refused === 'refused' && area._data[KEY] === frozen)
    ok('registering a private collection against hydrate() is refused WHOLE on this page too');
  else bad('hydrate() served the Guide a collection outside the fixed allowlist');

  /* (d) the counter-proof: the same page through start() destroys the
     dashboard's snapshot. This is why the read-only entry exists, and
     the proof is that the damage is real on THIS document as well. */
  {
    const area2 = makeStorageArea();
    const seed2 = enter(openTab(area2, { persist: true }));
    act(seed2.w, "publishFairEdition('FE-7102')");
    await settle(seed2.w);
    if (!read(area2) || !read(area2).data.fairAdmissions) bad('could not seed the full snapshot for the counter-proof');
    else {
      const rogue = openGuide(area2, { patch: { from: 'BLStore.hydrate();', to: 'BLStore.start({});' } });
      nudge(rogue.w); await settle(rogue.w);
      const after = read(area2);
      if (!after || !after.data || !after.data.fairAdmissions)
        ok('caught: the start() route destroys the dashboard\'s snapshot from the Guide too — the read-only entry is what prevents it');
      else bad('the start() route left the full snapshot intact — DIR-4\'s reasoning is unproven here');
    }
  }

  /* (e) no valid snapshot → fixtures; an invalid one → IGNORED under
     the store's ONE contract, and never deleted. */
  {
    const empty = openGuide(makeStorageArea());
    if (empty.w.eval("fairEditionById('FE-7102').status") === 'draft' &&
        !/Autumn edition/.test(directoryText(empty)))
      ok('with no snapshot at all, the Guide renders the canonical fixtures — and the draft stays off the directory');
    else bad('the Guide needs a snapshot to render, or listed a draft');

    const area3 = makeStorageArea();
    const stale = JSON.parse(JSON.stringify(seeded));
    stale.v = stale.v - 1;
    area3._data[KEY] = JSON.stringify(stale);
    const old = openGuide(area3);
    if (old.w.eval("fairEditionById('FE-7102').status") === 'draft' &&
        area3._data[KEY] === JSON.stringify(stale))
      ok('an outdated snapshot follows the store\'s own version rule — ignored, fixtures render, the Guide DELETES nothing');
    else bad('the Guide restored, reinterpreted or deleted an outdated snapshot');

    /* And the counter-proof that the SHARED contract is what did it:
       skip snapshotInvalidWhy() and the same stale bytes hydrate. */
    const area4 = makeStorageArea();
    area4._data[KEY] = JSON.stringify(stale);
    const rogue = openGuide(area4, { patch: {
      from: 'var invalid = snapshotInvalidWhy(p);   /* the one shared contract */',
      to:   'var invalid = null;' } });
    if (rogue.w.eval("fairEditionById('FE-7102').status") === 'published')
      ok('caught: with the shared contract skipped, the stale snapshot hydrates on the Guide — the contract is what stops it, and no second check exists to');
    else bad('the stale snapshot was held back even without the contract — the check above proves less than it says');
  }
}

console.log(fail ? '\n✗ ' + fail + ' failure(s)' : '\n✓ all checks passed');
process.exit(fail ? 1 : 0);

})();
