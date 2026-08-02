/* ══════════════════════════════════════════════════════════════════
   BOTTLE LOBBY — DEMO PERSISTENCE (prototype only, spec C8)
   ------------------------------------------------------------------
   The prototype forgot everything on reload: every change lived in a
   JS variable and nowhere else. Preparing a Wine Show before a meeting
   and then working on it during the meeting was impossible. This file
   gives those variables a lifetime longer than the page.

   WHAT THIS IS NOT. It is not a second source of truth. Nothing ever
   READS from localStorage — every consumer goes on reading the same
   arrays it always read. All that is stored is a serialisation of
   those same records, and it is written back into the same bindings on
   the next load. Invariant 1 is untouched: one record, referenced
   everywhere, never copied.

   IT DISAPPEARS WITHOUT REPLACEMENT. In the Supabase build persistence
   IS the database. This file is then deleted, not ported.

   ------------------------------------------------------------------
   WHY THE PAGE HANDS US GETTERS AND SETTERS

   A top-level `let` in a classic script is NOT a property of `window`.
   `window['orders']` is undefined; the binding lives in the global
   declarative record. So a generic store cannot find the state by
   name — the page has to hand it over:

       BLStore.register({ orders: [() => orders, v => { orders = v }] })

   That register block is the ONE place that lists what persists, and
   tests/persistence.js fails the build if a new top-level `let` shows
   up that is neither registered nor declared deliberately transient.

   NOBODY CALLS save(). Fifteen arrays wired by hand would be fifteen
   places to forget, and the failure would be silent. Instead the store
   watches for work to do, in two independent ways — and the second one
   exists because the first was not enough.

     · DOM events on `document`, bubble phase, so they arrive after the
       inline onclick handlers have run. This is what makes a save feel
       immediate.
     · A HEARTBEAT that simply compares the state to what is in storage
       and writes if they differ.

   The heartbeat is not belt-and-braces, it is the actual guarantee.
   The first version had only the event listener, and it was wrong in a
   way that measured perfectly and still lost data: it saved only when
   an event arrived AFTER the change. Every ordinary action does bubble
   a click afterwards, so it looked complete — but anything that
   changed state without a trailing event was never written at all, and
   nothing anywhere said so. Tying persistence to how a change was
   triggered was the mistake; the heartbeat asks the only question that
   actually matters — does storage still match the state?

   COMPARE AGAINST STORAGE, NEVER AGAINST A VARIABLE. The same version
   remembered its last write in memory and skipped writing when the new
   snapshot matched it. Clear localStorage in devtools — the first
   thing anyone does when testing persistence — and the store went on
   believing its work was already saved, writing nothing until the
   state happened to change again. A cache of what is in storage is a
   second source of truth about storage, and it went stale exactly like
   any other copy (invariant 1, applied to ourselves).

   The whole snapshot measured 24.3 KB on 2 Aug 2026, so it is always
   written whole. No dirty tracking, nothing that can drift apart.

   ------------------------------------------------------------------
   VERSIONING — because a stale snapshot reads like a code bug

   After a push the browser holds yesterday's data, possibly without
   fields today's code expects. Hunting that looks exactly like hunting
   a bug in the new code. Two guards, and neither relies on anyone
   remembering anything:

     1. VERSION — bumped by hand for a deliberate throw-away.
     2. A shape fingerprint per collection, computed at register time
        from the PRISTINE FIXTURES — the union of keys, recursively.
        Add `interests` to a show in bottle-lobby-data.js and the
        fingerprint changes by itself, because the fixture is always
        the shape the new code expects.

   A mismatch discards EVERYTHING, all or nothing. A partial restore
   would leave a half-migrated demo — shows from today, orders from
   last week — and that is worse than starting clean. The discard is
   announced, never silent.

   ------------------------------------------------------------------
   ISOLATION FROM THE TEST HARNESSES

   A harness that leaked state into the next one would be the worst
   possible side effect of this file: the checks that are supposed to
   be the safety net would become the thing that lies. Three layers:

     1. jsdom builds its DOM without a `url`, so the origin is opaque
        and `localStorage` is not even defined in the page (measured,
        2 Aug 2026). The store then does nothing.
     2. `window.BL_NO_PERSIST` switches it off outright.
     3. tests/load-dashboard.js — the one door every harness goes
        through — sets that switch itself, so a future harness that
        gives jsdom a `url:` cannot quietly re-enable persistence.

   tests/persistence.js asserts all of this, including that a poisoned
   localStorage is ignored.
════════════════════════════════════════════════════════════════════ */
window.BLStore = (function () {
  'use strict';

  var KEY       = 'bottle-lobby-demo';
  var VERSION   = 1;
  var DEBOUNCE  = 200;   /* ms after the last event before a write */
  var HEARTBEAT = 2000;  /* ms between "does storage still match?" checks */
  var POLL      = 500;   /* ms between retries while the tab is busy */
  var HEAL_KEY  = 'bottle-lobby-demo-healed';

  var entries      = [];   /* { name, get, set } in registration order */
  var fixtureFp    = {};   /* name → hash of the pristine fixture shape */
  var hooks        = {};   /* redraw / afterRestore / onSaved / notify / onExternal */
  var strict       = true;
  var saveTimer    = null;
  var beatTimer    = null;
  var pollTimer    = null;
  var applying     = false;/* true while an external change is being taken in */
  var pendingExt   = false;
  var started      = false;

  /* ── Storage access ──────────────────────────────────────────────
     Everything funnels through here so the kill switch, an opaque
     origin and Safari's private mode are one decision, not three.

     Decided once and remembered. The write probe is the only way to
     tell a private-mode localStorage (present, throws on write) from a
     working one — but every probe write is a `storage` event in every
     other tab, and this runs on each save. Answered once, it is a
     one-off; answered every time, it is a stream of events the other
     tabs have to filter out. */
  var lsCache;
  function storage() {
    if (window.BL_NO_PERSIST) return null;
    if (lsCache !== undefined) return lsCache;
    try {
      var ls = window.localStorage;
      if (!ls) return (lsCache = null);
      ls.setItem(KEY + '-probe', '1');
      ls.removeItem(KEY + '-probe');
      return (lsCache = ls);
    } catch (e) { return (lsCache = null); }
  }

  /* ── Shape fingerprint ───────────────────────────────────────────
     An array folds to the UNION of its element shapes, so fixtures
     with optional fields (a show with `interests`, one without) still
     produce one stable string. Depth is capped because the answer only
     has to be stable, not exhaustive. */
  function shape(v, depth) {
    if (depth > 6) return '*';
    if (Array.isArray(v)) {
      var set = {};
      for (var i = 0; i < v.length; i++) set[shape(v[i], depth + 1)] = 1;
      return '[' + Object.keys(set).sort().join('|') + ']';
    }
    if (v && typeof v === 'object') {
      return '{' + Object.keys(v).sort().map(function (k) {
        return k + ':' + shape(v[k], depth + 1);
      }).join(',') + '}';
    }
    return v === null ? 'null' : typeof v;
  }

  /* FNV-1a, 32 bit. Only has to change when the shape changes. */
  function hash(s) {
    var h = 0x811c9dc5;
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = (h * 0x01000193) >>> 0;
    }
    return h.toString(16);
  }

  function serialise() {
    var data = {};
    entries.forEach(function (e) { data[e.name] = e.get(); });
    return JSON.stringify(data);
  }

  /* ── Registration ────────────────────────────────────────────────
     Called BEFORE start(), so `get()` still returns the untouched
     fixture — which is exactly the shape the current code expects. */
  function register(map) {
    Object.keys(map).forEach(function (name) {
      var pair = map[name];
      if (typeof pair[0] !== 'function' || typeof pair[1] !== 'function')
        throw new Error('BLStore.register: "' + name + '" needs a [getter, setter] pair');
      if (fixtureFp.hasOwnProperty(name))
        throw new Error('BLStore.register: "' + name + '" registered twice');
      entries.push({ name: name, get: pair[0], set: pair[1] });
      fixtureFp[name] = hash(shape(pair[0](), 0));
    });
  }

  function discard(why) {
    var ls = storage();
    if (ls) { try { ls.removeItem(KEY); } catch (e) {} }
    if (window.console && console.info)
      console.info('[BLStore] stored demo data discarded — ' + why);
    return 'discarded';
  }

  /* Returns 'restored' | 'empty' | 'discarded' | 'inactive'. */
  function restore() {
    var ls = storage();
    if (!ls) return 'inactive';
    var raw;
    try { raw = ls.getItem(KEY); } catch (e) { return 'inactive'; }
    if (!raw) return 'empty';

    var p;
    try { p = JSON.parse(raw); } catch (e) {
      return discard('the snapshot is not readable JSON');
    }
    if (!p || typeof p !== 'object' || !p.data || typeof p.data !== 'object')
      return discard('the snapshot has no data block');
    if (p.v !== VERSION)
      return discard('it was written by store version ' + p.v + ', this is ' + VERSION);

    /* All or nothing: name every mismatch, then throw the lot away. */
    var fp = p.fp || {}, changed = [];
    entries.forEach(function (e) {
      if (!p.data.hasOwnProperty(e.name)) changed.push(e.name + ' (missing)');
      else if (fp[e.name] !== fixtureFp[e.name]) changed.push(e.name + ' (shape changed)');
    });
    if (strict) {
      var known = {};
      entries.forEach(function (e) { known[e.name] = 1; });
      Object.keys(p.data).forEach(function (n) {
        if (!known[n]) changed.push(n + ' (no longer persisted)');
      });
    }
    if (changed.length) return discard(changed.join(', '));

    entries.forEach(function (e) { e.set(p.data[e.name]); });
    if (hooks.afterRestore) hooks.afterRestore();
    /* Nothing to remember here: the next save() reads storage itself
       and finds it already matching, so a restore never bounces back
       out as a write. */
    return 'restored';
  }

  /* ── Writing ─────────────────────────────────────────────────────
     The comparison is against what is IN STORAGE, so the answer stays
     true no matter what happened to storage behind our back — cleared
     in devtools, wiped by another tab, never written in the first
     place. Silent when storage already matches, so the "Saved" flash
     means something was really written rather than something was
     clicked.

     serialise() is inside the try on purpose: it used to sit outside,
     where a throw would escape through the timer callback, kill the
     pending save and leave nothing behind but a console line. */
  function save() {
    if (applying) return false;
    var ls = storage();
    if (!ls) return false;

    var payload;
    try {
      payload = '{"v":' + VERSION + ',"fp":' + JSON.stringify(fixtureFp) +
                ',"data":' + serialise() + '}';
    } catch (e) {
      if (window.console && console.warn)
        console.warn('[BLStore] could not serialise the demo state — ' + (e && e.message));
      return false;
    }

    var current = null;
    try { current = ls.getItem(KEY); } catch (e) {}
    if (current === payload) return false;

    try { ls.setItem(KEY, payload); }
    catch (e) {
      if (window.console && console.warn)
        console.warn('[BLStore] could not write — ' + (e && e.message));
      return false;
    }
    if (hooks.onSaved) hooks.onSaved();
    return true;
  }

  function scheduleSave() {
    if (applying) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(save, DEBOUNCE);
  }

  /* ── Cross-tab ───────────────────────────────────────────────────
     localStorage is shared across tabs of one origin anyway, so F5
     would do. Redrawing without the F5 is what makes two tabs side by
     side a moment rather than an instruction.

     The guard Serge asked for: while a modal is open or a field has
     the focus we take in NOTHING — not the redraw, and not the data
     either. Re-assigning the arrays under an open form would leave
     that form writing into an object that has just been thrown away. */
  function busy() {
    if (document.querySelector('.modal-overlay.active, .pr-overlay.active, #role-picker.show'))
      return true;
    var a = document.activeElement;
    if (!a) return false;
    var t = (a.tagName || '').toUpperCase();
    return t === 'INPUT' || t === 'TEXTAREA' || t === 'SELECT' || a.isContentEditable === true;
  }

  function attempt() {
    if (!pendingExt) return;
    if (busy()) {
      if (!pollTimer) pollTimer = setInterval(attempt, POLL);
      return;
    }
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
    pendingExt = false;

    /* The key being gone means another tab hit Reset. Following it is
       the point of a reset before a meeting: one click clears every
       tab, not just the one that was clicked in. */
    var ls = storage();
    if (ls && ls.getItem(KEY) === null) { window.location.reload(); return; }

    applying = true;
    var outcome;
    try { outcome = restore(); } finally { applying = false; }
    if (outcome === 'restored') {
      if (hooks.redraw) hooks.redraw();
      if (hooks.onExternal) hooks.onExternal();
    }
  }

  function onStorage(e) {
    /* e.key is null when another tab called clear(). */
    if (e.key !== null && e.key !== KEY) return;
    pendingExt = true;
    attempt();
  }

  /* ── Reset ───────────────────────────────────────────────────────
     A reload, not just a wipe: it clears the transient state too — the
     open sub-view, the active tab, half-filled modals — which is what
     "start clean" has to mean before a meeting. */
  function reset() {
    var ls = storage();
    if (ls) { try { ls.removeItem(KEY); } catch (e) {} }
    /* Stop beforeunload AND the heartbeat from writing the state
       straight back — the heartbeat would otherwise notice within two
       seconds that storage no longer matches and helpfully undo the
       reset. */
    applying = true;
    clearTimeout(saveTimer);
    clearInterval(beatTimer);
    window.location.reload();
  }

  function markHealed(v) {
    try {
      if (v) window.sessionStorage.setItem(HEAL_KEY, '1');
      else window.sessionStorage.removeItem(HEAL_KEY);
    } catch (e) {}
  }
  function alreadyHealed() {
    try { return window.sessionStorage.getItem(HEAL_KEY) === '1'; } catch (e) { return false; }
  }

  /* ── start ───────────────────────────────────────────────────────
     opts: redraw, afterRestore, onSaved, notify, onExternal, strict.
     Returns the restore outcome, which the harnesses assert on. */
  function start(opts) {
    opts = opts || {};
    hooks = opts;
    if (opts.strict === false) strict = false;
    started = true;

    if (!storage()) return 'inactive';

    var outcome = restore();

    if (outcome === 'restored' && hooks.redraw) {
      /* If yesterday's data breaks a renderer, the page must not die
         half-drawn with no way back but devtools. Throw the snapshot
         away and reload once — a loop is worse than a broken demo, so
         the second attempt reports instead of reloading again. */
      try {
        hooks.redraw();
        markHealed(false);
      } catch (err) {
        discard('it broke rendering — ' + (err && err.message));
        if (!alreadyHealed()) { markHealed(true); window.location.reload(); return 'healing'; }
        if (window.console && console.error) console.error('[BLStore] redraw failed twice', err);
        if (hooks.notify) hooks.notify('✗ Demo data could not be restored — starting fresh');
        return 'failed';
      }
    }
    if (outcome === 'discarded' && hooks.notify)
      hooks.notify('↺ Demo data was reset — the prototype has been updated');

    /* Immediacy … */
    ['click', 'change', 'submit', 'keyup', 'input'].forEach(function (t) {
      document.addEventListener(t, scheduleSave, false);
    });
    /* … and the guarantee. An event tells us a change was LIKELY; this
       asks whether one actually happened, which is the only question
       that cannot be answered wrongly. A change made with no event
       after it — from a timer, from the console, from a handler that
       swallows its own click — is written within HEARTBEAT ms rather
       than never. */
    beatTimer = setInterval(save, HEARTBEAT);
    window.addEventListener('beforeunload', function () {
      clearTimeout(saveTimer);
      save();
    });
    window.addEventListener('storage', onStorage);
    /* A pending external change lands as soon as the tab is free. */
    document.addEventListener('click', attempt, false);
    document.addEventListener('focusout', attempt, false);

    return outcome;
  }

  return {
    register: register,
    start:    start,
    save:     save,
    restore:  restore,
    reset:    reset,
    /* Read-only surface for the harnesses and for the console. */
    isActive:     function () { return started && !!storage(); },
    names:        function () { return entries.map(function (e) { return e.name; }); },
    fingerprints: function () { var c = {}; Object.keys(fixtureFp).forEach(function (k) { c[k] = fixtureFp[k]; }); return c; },
    KEY:          KEY,
    VERSION:      VERSION
  };
})();
