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

   ONE deliberate exception since O4 (A21.8): hydrate(), the READ-ONLY
   public entry. The canonical Participation Page has to show the same
   current records the dashboard saved, and "the next load" of a public
   page IS a read of this snapshot. hydrate() applies the snapshot to
   the page's registered bindings under the SAME validity rules
   restore() uses — one parser, two entries, never a second
   interpretation — and differs in exactly two ways: it accepts only
   the fixed PUBLIC_COLLECTIONS allowlist, and it NEVER writes: no
   save, no discard, no reset, no listener, no heartbeat. The
   dashboard remains the only writer.

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

   THE DIVISION BETWEEN THEM, and it cost a day to learn: the
   fingerprint sees SHAPE, never VALUES. A migration that changes the
   FORMAT of a value while leaving every key in place is invisible to
   it — and correctly so, because hashing values would mean discarding
   the whole demo on every data edit, which is the same as not saving
   at all.

   That makes VERSION the lever for exactly this case, and guard 2's
   "neither relies on anyone remembering anything" does NOT extend to
   it. When the fixtures change the FORM of what they hold — 59 wine
   show dates moving from "14 Mar 2027" to ISO — the snapshot stays
   structurally valid, is restored over the new fixtures, and a
   returning visitor keeps the old values for good. It looks precisely
   like the asset cache serving a stale file, and it was mistaken for
   one twice.

   The same blindness has a second face, and it was learned later
   (06.08.2026): an array folds to the UNION of its element shapes, so
   ADDING A ROW of a shape already present changes nothing either. New
   fixture rows are therefore as invisible as a changed value format —
   the returning visitor keeps a collection that is simply shorter than
   the one the build ships.

   So: change the FORMAT of stored data, or ADD FIXTURE ROWS to a
   registered collection, and bump VERSION in the same commit.

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
  /* 2 — the wine-show date migration (03.08.2026). 59 fields moved
     from display format to ISO with every key unchanged, so the shape
     fingerprint could not see it and every returning visitor kept the
     old values. See the note above before changing this.

     3 — the catalogue pass (05.08.2026). Same class, same blindness:
     six `origin` values in `currentWinePortfolio` moved from a region
     to an appellation, and one wine was renamed in THREE registered
     collections at once — currentWinePortfolio, rCurrentWineList and
     tCurrentWineSelection. Every key unchanged, so the fingerprint
     sees nothing.

     MEASURED, not assumed. A snapshot was seeded from a patched build
     carrying the old values and restored over the new fixtures: the
     page then reported `origin` "Loire Valley, France" and
     `wineLabel("PRD-1022")` "Primitivo Sicilia IGT 2022" — the old
     answers, permanently, on today's code. That is exactly the
     symptom this counter exists for.

     4 — the D2D pass (06.08.2026), and it is a THIRD class of
     blindness rather than a repeat of the second. Nothing changed
     shape and nothing changed format: three ROWS were ADDED to
     existing collections — ORD-2043 to `orders`, the Hawesko ↔
     Enoteca row to `partnerships`, Enoteca's Pouilly-Fumé listing to
     `listings` — each one the same shape as the rows beside it. The
     fingerprint folds an array to the UNION of its element shapes, so
     rows are invisible to it BY CONSTRUCTION: a collection with one
     more row of a known shape hashes identically.

     OBSERVED LIVE, not deduced: an older snapshot restored over the
     new fixtures and ORD-2043 and the Enoteca partner card were gone
     from the running page — the fixture rows were there, the snapshot
     overwrote the collections that held them.

     The rule to carry forward: VERSION is the lever whenever a
     returning visitor's snapshot would be WRONG, and that is broader
     than "the format changed". Added fixture rows are wrong in the
     same way — the demo shows less than the build ships.

     5 — the A17 own-label fixture pass (07.08.2026), and it is the
     THIRD class again rather than a repeat: rows added to registered
     collections, plus one collection that lost a key.

     MEASURED, NOT ASSUMED. The two fingerprint sets were captured from
     the pre-pass build and from this one and compared, collection by
     collection. Exactly TWO of the twenty-two changed shape — `orders`
     and `listings`, the latter because `legacyOwnLabel` came off every
     row. The other twenty hash identically, and `currentWinePortfolio`
     is the one that makes the bump necessary: it gained PRD-1028, the
     first own-label product to enter the book, and the row is the same
     shape as the fourteen beside it. An array folds to the UNION of its
     element shapes, so guard 2 cannot see it by construction.

     What a returning visitor would otherwise keep: a book without the
     own label, orders without the two first orders and without the
     A→B sub-distribution order, and listings that still carry the
     removed bridge field. The last of those is the dangerous one — the
     page reads own-label status from a derivation now, and a restored
     listing with a stale field would simply be ignored while the wine
     it belongs to disappeared from My Labels.

     6 — the member-event rollout (08.08.2026). ONE row added to an
     existing collection: ME-3105, the winery's own harvest event,
     without which the winery cockpit demonstrates an empty state and
     nothing else.

     MEASURED, AND THE MEASUREMENT ARGUES AGAINST ITSELF. The two
     fingerprint sets were captured before and after: exactly one of
     the 26 collections changed, and it is `memberEvents`
     (92c5d5c0 → 2de22954). So guard 2 WOULD have discarded an old
     snapshot on its own — and the bump is here anyway, because of
     WHY it changed. The new row is the first with `reachCountry:null`
     where the four before it all carry a string, and the union of
     element shapes moved for that reason alone. Had the estate's
     event narrowed to Italy like the others narrow to Germany,
     nothing would have changed and the row would have vanished for
     every returning visitor. A protection that rests on one field
     happening to be null is not a protection; Durchgang 7 could skip
     the bump because `memberEvents` was a NEW registration, and this
     is the case its own note said would bring the C8 rule back.

     7 — Wine Guide → Events (09.08.2026). VALUE changes on one row of
     an existing collection: ME-3102 gains `public` in its reach and
     drops the Germany narrowing (its own `city` note had already
     described it as narrowing to nothing).

     MEASURED, AND THE MEASUREMENT CORRECTED THE PREDICTION. The
     prediction was "no shape change — `reachCountry:null` already
     exists on ME-3105". Wrong, and usefully so: the array folds to
     the union of WHOLE-ROW shape strings, not per-field types, and
     ME-3102's combination of nullable fields (priceNote, externalLink,
     applicationDeadline all strings) makes its row shape unique — so
     flipping its `reachCountry` to null DID move `memberEvents`
     (2de22954 → 39a547a0, the only one of 26), and guard 2 would have
     discarded an old snapshot on its own. The bump stands anyway, for
     Durchgang 8's reason one step further: the `public` string itself
     is invisible (an array of strings folds to [string]), and the
     discard only happens because this row's OTHER nullable fields
     happen to make it unique. A protection that rests on a
     coincidental field combination is not a protection. The C8 rule
     in one line: change the FORMAT or the VALUES stored state depends
     on, bump VERSION in the same commit.

     8 — the platform-partner pass (10.08.2026). One fixture row added
     to an EXISTING collection: RVW-3004, the partner verification in
     `reviews` (subjectType 'partner', A18.4), plus `reviewSeq` moving
     3004 → 3005 with it.

     MEASURED: the two fingerprint sets were compared collection by
     collection — all 29 existing collections hash identically, the
     only difference is the NEW registration `platformPartners`
     (8d34c198). So guard 2 cannot see the row (the D2D class, by
     construction), and a restored old snapshot would drop the one row
     the Verified badge derives from (PP-4) while handing `reviewSeq`
     back an id that already exists.

     THE COUNTER-ARGUMENT IS ON THE TABLE AND LOSES: the same commit
     registers `platformPartners`, and restore() discards any snapshot
     missing a registered name — so every pre-pass snapshot dies at
     that gate first, and the bump looks redundant. It stands anyway,
     for the Durchgang-7 note's own reason: the new-registration
     discard protects only as long as no row lands in an EXISTING
     collection, and this pass is exactly that case. A protection that
     rests on a neighbouring registration in the same commit is a
     protection that silently vanishes the day either half is
     reverted, split or cherry-picked alone.

     9 — the fair pass (10.08.2026), and it is Durchgang 11's
     constellation repeated exactly. One fixture row added to the
     EXISTING `reviews` collection: RVW-3005, the series brand review
     (subjectType 'fair_series', A19.4b), with `reviewSeq` moving
     3005 → 3006 beside it.

     MEASURED against the pre-pass build (630c8e9): all 30 existing
     collections hash identically; the only new prints are the four
     NEW registrations fairSeries, fairSeriesSeq, fairEditions,
     fairEditionSeq. So guard 2 cannot see the row (the D2D class, by
     construction — RVW-3005 has the same row shape as RVW-3004), and
     a restored v8 snapshot would drop the one row the series brand
     badge and the publish gate derive from (FS-3b) while handing
     `reviewSeq` back an id that already exists. The new-registration
     discard would catch it TODAY — and the Durchgang-11 sentence
     above says why that is not the protection: it vanishes the day
     either half is reverted, split or cherry-picked alone.

     10 — the participation pass, O4 (13.08.2026). Fixture rows added
     to FOUR existing collections: FE-7103 (the summer edition) to
     `fairEditions`, FH-9202 to `fairHalls`, FB-9303/FB-9304 to
     `fairStands`, FA-9105 to `fairAdmissions` — plus their seqs
     moving beside them.

     MEASURED against the pre-pass build (9a2873b): 39 of the 40
     existing collections hash identically. The hall, stand and
     admission rows are the D2D class by construction — same row
     shapes as their neighbours, invisible to guard 2. `fairEditions`
     DID move (5d7845b2 → 9c98d288), and for the Durchgang-12 reason
     that is not the protection: FE-7103's combination of nullable
     fields (endDate null beside a set ticketing URL) happens to make
     its whole-row shape unique — had the summer day carried an end
     date, guard 2 would have seen nothing at all. A protection that
     rests on a coincidental field combination is not a protection.
     The two NEW registrations (fairParticipations + seq) would also
     discard every pre-pass snapshot today — and that is the
     neighbouring-registration protection the Durchgang-11 note says
     vanishes the day either half is reverted or split alone.

     What a returning v9 visitor would otherwise keep: no summer
     edition, no summer inventory, no FA-9105 — the admitted ground
     under the distributor participation fixture — while the seqs
     would reissue FE-7103/FH-9202/FB-9303 ids that already exist.

     11 — the shared-validity correction, O4/Codex (13.08.2026), and
     it is the FORMAT class in the rule's own words: the snapshot
     blob gains the `sh` schema record (see SCHEMA_HASH below) so the
     read-only public page can make the SAME validity judgment the
     dashboard makes — including about collections it never loads. No
     fixture changed (all 40 fingerprints measured identical); the
     STORED FORMAT did, and a v10 snapshot carries no schema record,
     so the bump is the honest lever rather than leaning on the new
     check to reject what the old format cannot say.

     12 — O5, and it is the D2D class in its plainest form: the pass
     adds ROWS to collections that were already registered and whose
     shape does not move — a second fair series (FS-7002), three
     published editions under it (FE-7104/7105/7106), the second
     brand-review row (RVW-3006), and the three counters stepped past
     them. Guard 2 fingerprints SHAPE, so it sees exactly none of that
     by construction, and a returning v11 visitor would otherwise keep
     a snapshot in which the consumer and hybrid editions, their two
     new cities and the edition with no ticketing link simply do not
     exist — while `fairEditionSeq` reissues ids that now do. Measured,
     not predicted: the fingerprints were compared before and after and
     all 40 are identical, which is precisely why the bump is the only
     lever left.

     O7 — MEASURED, AND IT NEEDS NO BUMP. The pass changes the FORM of
     an already registered collection: `fairParticipations` gains
     `appointmentsOpen` on every row (A22.4). Guard 2 fingerprints
     SHAPE, so it sees that by construction — and the shared contract
     sees it a second time, because the shape change moved
     SCHEMA_HASH (6d204f48 → 9b503d88, set in the same commit as the
     field, C8; the two new registrations of the following commit
     moved it on to b29a32a, again in their own commit), and every older snapshot carries the old `sh` and
     breaks on check (5) before a single value is read. A pre-O7
     snapshot is therefore already refused twice over, by both
     documents, without VERSION moving. The pass ALSO adds two new
     registrations (fairAppointmentSlots / fairAppointments and their
     seqs), which would discard older snapshots a third time — and
     that alone is expressly NOT a bump reason (the Durchgang-11
     note above says why: a neighbouring registration's protection
     vanishes the day it is reverted or split). The lever stays where
     it is because the FIELD, not the neighbour, does the work.

     O9 — MEASURED, AND IT NEEDS NO BUMP EITHER, for O7's reason. Two
     of 47 prints move against the O7 build (e0ffd0b): `platformPartners`
     (8d34c198 → ac24c394) because the partner row gains its canonical
     `url` — a real field on the row, so guard 2 sees it by
     construction, not by a coincidental nullable combination — and the
     NEW registration `partnerFollows` (3eb21263, the bounded partner
     follow store, A23/D47). The other 45 hash identically: no row was
     added to an existing collection, no value changed format. Both
     changes move SCHEMA_HASH (b29a32a → b33a99e8, set in this same
     commit), so every older snapshot breaks on check (5) in both
     documents before a value is read; the new registration would
     discard it a second time, and that alone is expressly not a bump
     reason. The lever stays where it is. */
  var VERSION   = 12;
  var DEBOUNCE  = 200;   /* ms after the last event before a write */
  var HEARTBEAT = 2000;  /* ms between "does storage still match?" checks */
  var POLL      = 500;   /* ms between retries while the tab is busy */
  var HEAL_KEY  = 'bottle-lobby-demo-healed';

  /* ── THE SCHEMA RECORD (A21.8, Codex correction 13.08.2026) ──────
     The public page must ignore every snapshot the dashboard would
     judge invalid — including one whose PRIVATE collections drifted,
     which the page can never fingerprint itself (it must not even
     load them). So a snapshot carries `sh`: the hash of its own
     complete fp map, and THIS constant names the hash of the current
     canonical schema. One shared contract then decides validity for
     both documents (snapshotSchemaWhy below):

       (3) data and fp name the same collections;
       (4) sh matches the snapshot's own fp map — a tampered or
           hand-extended map (the legacyGhost case) breaks here;
       (5) sh matches THIS constant — a snapshot written under any
           other schema, private collections included, breaks here
           without the page ever reading a private value.

     THE CONSTANT IS HAND-PINNED AND HARNESS-ENFORCED, deliberately:
     the fingerprints themselves stay computed from the pristine
     fixtures (guard 2 is untouched), and tests/persistence.js fails
     the build the moment this value stops matching the dashboard's
     live registration — with the new value in the failure message.
     C8 gains the matching duty: when fixtures change SHAPE, the same
     commit updates SCHEMA_HASH (the harness names the value; VERSION
     keeps its own, separate rule). */
  var SCHEMA_HASH = 'b33a99e8';

  var entries      = [];   /* { name, get, set } in registration order */
  var fixtureFp    = {};   /* name → hash of the pristine fixture shape */
  var hooks        = {};   /* redraw / afterRestore / onSaved / notify / onExternal */
  var readOnly     = false;/* set by hydrate(); kills every write path */
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

  /* The schema record: one stable string over a whole fp map, hashed.
     save() stamps every snapshot with the LIVE value (the truth of
     this document's fixtures — automatic, like the fingerprints);
     the contract compares against SCHEMA_HASH (the pinned canonical
     value). In a healthy build the two are identical, and the
     persistence harness keeps them so. */
  function serialiseSchema(fp) {
    return Object.keys(fp).sort().map(function (k) { return k + ':' + fp[k]; }).join('|');
  }
  function schemaHashOf(fp) { return hash(serialiseSchema(fp)); }
  function liveSchemaHash() { return schemaHashOf(fixtureFp); }

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

  /* ── Snapshot validity, decided ONCE ─────────────────────────────
     restore() and hydrate() must never disagree about what a valid
     snapshot is — a second interpretation of the same bytes would be
     the drift this file exists to prevent. snapshotInvalidWhy() IS
     the one contract, whole: structure, version, the schema record
     (names, integrity, currency — see SCHEMA_HASH above), and every
     name THIS document registered present with the fixture's shape.
     The schema half is what lets the read-only page judge collections
     it never loads; the old strict check in restore() ("no longer
     persisted") is subsumed by it and no longer lives anywhere else.
     What the two entries DO with an invalid snapshot stays theirs:
     the dashboard discards it (it owns the storage), the read-only
     page merely ignores it. */
  function snapshotSchemaWhy(p) {
    var fp = p.fp;
    if (!fp || typeof fp !== 'object' || typeof p.sh !== 'string')
      return 'the snapshot carries no schema record';
    /* (3) data and fp must name the SAME collections — a stored
       collection nobody fingerprinted, or the reverse, is a snapshot
       nobody wrote whole. */
    var dataKeys = Object.keys(p.data).sort().join(','),
        fpKeys   = Object.keys(fp).sort().join(',');
    if (dataKeys !== fpKeys)
      return 'data and schema record disagree about the stored collections';
    /* (4) integrity: the schema record must describe exactly this fp
       map — an entry added or edited by hand breaks here. */
    if (schemaHashOf(fp) !== p.sh)
      return 'the schema record does not match the stored collections';
    /* (5) currency: written under the CURRENT canonical schema — an
       older or foreign schema (a private collection reshaped, a name
       added or dropped) breaks here, without reading any value. */
    if (p.sh !== SCHEMA_HASH)
      return 'it was written under another schema (' + p.sh + ', current ' + SCHEMA_HASH + ')';
    return null;
  }
  function snapshotInvalidWhy(p) {
    if (!p || typeof p !== 'object' || !p.data || typeof p.data !== 'object')
      return 'the snapshot has no data block';
    if (p.v !== VERSION)
      return 'it was written by store version ' + p.v + ', this is ' + VERSION;
    var schemaWhy = snapshotSchemaWhy(p);
    if (schemaWhy) return schemaWhy;
    var fp = p.fp || {}, changed = [];
    entries.forEach(function (e) {
      if (!p.data.hasOwnProperty(e.name)) changed.push(e.name + ' (missing)');
      else if (fp[e.name] !== fixtureFp[e.name]) changed.push(e.name + ' (shape changed)');
    });
    return changed.length ? changed.join(', ') : null;
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
    /* All or nothing: the ONE contract decides, then the lot goes. */
    var why = snapshotInvalidWhy(p);
    if (why) return discard(why);

    entries.forEach(function (e) { e.set(p.data[e.name]); });
    if (hooks.afterRestore) hooks.afterRestore();
    /* Nothing to remember here: the next save() reads storage itself
       and finds it already matching, so a restore never bounces back
       out as a write. */
    return 'restored';
  }

  /* ── The READ-ONLY public entry (O4, A21.8) ──────────────────────
     For pages that RENDER the demo state without owning it — the
     canonical Participation Page first. It differs from start() in
     everything start() wires: no event listeners, no heartbeat, no
     beforeunload save, no storage handler — after hydrate() this
     page's store cannot write, and save()/reset() are dead on it.

     THE ALLOWLIST IS FIXED HERE, in platform code, like the
     recruiting read path's field list (A20.7): only these public
     collections may ever be hydrated on a public page. A page that
     registers anything else — fairAdmissions above all — is refused
     WHOLE, before any read. Private recruiting records never reach a
     public page (FR-11, A21.8).

     An invalid or outdated snapshot follows the store's ONE validity
     interpretation (snapshotInvalidWhy) and is IGNORED, never
     deleted: deleting is a write, and the dashboard is the only
     writer. With no usable snapshot the page simply renders the
     fixtures it loaded.

     Returns 'hydrated' | 'empty' | 'ignored' | 'refused' | 'inactive'. */
  var PUBLIC_COLLECTIONS = ['fairSeries', 'fairEditions', 'fairHalls',
                            'fairStands', 'fairParticipations'];
  function hydrate() {
    readOnly = true;   /* first thing: whatever happens, this page never writes */
    var alien = entries.map(function (e) { return e.name; })
      .filter(function (n) { return PUBLIC_COLLECTIONS.indexOf(n) === -1; });
    if (alien.length) {
      if (window.console && console.warn)
        console.warn('[BLStore] hydrate refused — not public collections: ' + alien.join(', '));
      return 'refused';
    }
    var ls = storage();
    if (!ls) return 'inactive';
    var raw;
    try { raw = ls.getItem(KEY); } catch (e) { return 'inactive'; }
    if (!raw) return 'empty';
    var p;
    try { p = JSON.parse(raw); } catch (e) { return ignore('the snapshot is not readable JSON'); }
    var invalid = snapshotInvalidWhy(p);   /* the one shared contract */
    if (invalid) return ignore(invalid);
    entries.forEach(function (e) { e.set(p.data[e.name]); });
    hydrated = p;   /* the validated snapshot, kept for the public verdicts below */
    return 'hydrated';
  }
  function ignore(why) {
    if (window.console && console.info)
      console.info('[BLStore] stored demo data ignored on this read-only page — ' + why);
    return 'ignored';
  }

  /* ── The PUBLIC VERDICT — one register, no row leaves it (A23.4) ──
     A public page has to say whether a platform partner is verified
     (A18.4) and whether a fair brand is approved (A19.4) — each the
     LAST WORD of the `reviews` register (PP-4, FS-3), which is private:
     it carries Bottle Lobby's own notes and rows about memberships,
     contracts, projects and show releases, is not in the hydration
     allowlist and never will be. So the store — already the platform's
     public read boundary — derives the verdict INSIDE this closure over
     the validated snapshot and hands out the verdict alone: never a
     row, never a note, never a date. The real build does this as a
     server function over `reviews` behind RLS; this is its stand-in.

     THE ALLOWLIST IS FIXED HERE, in platform code, exactly like
     PUBLIC_COLLECTIONS: only these approval types have a public verdict,
     each about the one subject type it belongs to. Nothing widens it —
     not a page, not a parameter, not a stored value.

     ONE derivation for both documents: lastWord() is the last row about
     (subjectType, subjectId) with that approvalType — the dashboard's
     partnerVerificationLatest() / seriesBrandLatest() call it over the
     live register, publicVerdict() calls it over the snapshot's. Two
     callers, one answer.

     Returns true (last word approved), false (last word not approved,
     or no row about the subject), or null (no readable word: no valid
     snapshot on this device — the register's fixture ground lives in
     the dashboard document by design, so a page opened before the demo
     state exists has nothing to derive from and renders no badge;
     A23.4 names this limit). A type outside the allowlist is refused
     with a warning and answers null. */
  var PUBLIC_VERDICTS = Object.freeze({
    partner_verification: 'partner',
    series_brand_review:  'fair_series'
  });
  var hydrated = null;   /* set by hydrate() on a valid snapshot only */
  function lastWord(rows, subjectType, subjectId, approvalType) {
    var last = null;
    (rows || []).forEach(function (r) {
      if (r && r.subjectType === subjectType && r.subjectId === subjectId &&
          r.approvalType === approvalType) last = r;
    });
    return last;
  }
  function publicVerdict(approvalType, subjectId) {
    if (!PUBLIC_VERDICTS.hasOwnProperty(approvalType)) {
      if (window.console && console.warn)
        console.warn('[BLStore] publicVerdict refused — "' + approvalType + '" has no public verdict');
      return null;
    }
    if (!hydrated || !hydrated.data || !Array.isArray(hydrated.data.reviews)) return null;
    var last = lastWord(hydrated.data.reviews, PUBLIC_VERDICTS[approvalType], subjectId, approvalType);
    return !!last && last.reviewStatus === 'approved';
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
    if (readOnly) return false;   /* a hydrated page never writes (A21.8) */
    if (applying) return false;
    var ls = storage();
    if (!ls) return false;

    var payload;
    try {
      /* `sh` is stamped from the LIVE registration — automatic, like
         the fingerprints beside it. A build whose SCHEMA_HASH went
         stale therefore writes snapshots its own contract refuses:
         loud on the next load, and red in the harness long before. */
      payload = '{"v":' + VERSION + ',"sh":"' + liveSchemaHash() + '"' +
                ',"fp":' + JSON.stringify(fixtureFp) +
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
    if (readOnly) return;         /* a hydrated page never writes (A21.8) */
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
     opts: redraw, afterRestore, onSaved, notify, onExternal.
     Returns the restore outcome, which the harnesses assert on. */
  function start(opts) {
    if (readOnly) {               /* hydrate() ran — this page must not wire autosave */
      if (window.console && console.error)
        console.error('[BLStore] start() refused after hydrate() — this page is read-only');
      return 'refused';
    }
    /* The pinned contract value must be the live one — screamed here,
       and failed for good in tests/persistence.js, which prints the
       value to paste. */
    if (liveSchemaHash() !== SCHEMA_HASH && window.console && console.error)
      console.error('[BLStore] SCHEMA_HASH is stale — the fixtures changed shape; set it to ' +
                    liveSchemaHash() + ' in the same commit (C8)');
    opts = opts || {};
    hooks = opts;
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
    hydrate:  hydrate,
    /* The public verdict path (A23.4): the ONE last-word derivation and
       the row-free public entry over the validated snapshot. */
    lastWord:      lastWord,
    publicVerdict: publicVerdict,
    PUBLIC_VERDICTS: PUBLIC_VERDICTS,
    /* Read-only surface for the harnesses and for the console. */
    PUBLIC_COLLECTIONS: PUBLIC_COLLECTIONS.slice(),
    SCHEMA_HASH:  SCHEMA_HASH,
    schemaHashOf: schemaHashOf,
    liveSchemaHash: liveSchemaHash,
    isReadOnly:   function () { return readOnly; },
    isActive:     function () { return started && !!storage(); },
    names:        function () { return entries.map(function (e) { return e.name; }); },
    fingerprints: function () { var c = {}; Object.keys(fixtureFp).forEach(function (k) { c[k] = fixtureFp[k]; }); return c; },
    KEY:          KEY,
    VERSION:      VERSION
  };
})();
