/* ══════════════════════════════════════════════════════════════════
   BOTTLE LOBBY — SHARED DEMO DATA
   ------------------------------------------------------------------
   Every surface that shows a Wine Show reads THIS file: the dashboard,
   the public Wine Shows page and the public profiles. That is invariant
   1 applied to the prototype — one record, referenced everywhere, never
   copied. The alternative was 21 hand-maintained copies and the drift
   A12 describes for the variety pages.

   Loaded as a CLASSIC script, deliberately not a module: the prototype
   is opened over file:// as often as over http, and file:// blocks
   modules. Top-level let/const still reach every other script on the
   page, so load order is the only contract — this file first.

   Read this as the draft schema for the Supabase build. Field names
   follow A16.9; the nesting stands in for the join tables (`exhibitors`
   for wine_show_exhibitors, `products` for wine_show_products, `events`
   for wine_show_events).

   Nothing computed lives here. Stage transitions, whose turn it is and
   what a given viewer may see are all derived at read time (A16.10).
════════════════════════════════════════════════════════════════════ */

/* The show photography available to the prototype. A real distributor
   uploads a file (A16.9 `hero_image_url`); a static mockup has no server
   to upload to, so the create-show modal picks from what ships in
   images/. Same field, same rendering — only the input differs. */
const SHOW_HERO_IMAGES = [
  { file:'images/duesseldorf-tasting-wide.jpg', label:'Tasting room, wide' },
  { file:'images/duesseldorf-pouring.jpg',      label:'Pouring at the table' },
  { file:'images/duesseldorf-presenter.jpg',    label:'Presenter with the room' },
  { file:'images/hamburg-tasting-room.jpg',     label:'Tasting room, Hamburg' },
  { file:'images/hamburg-glasses.jpg',          label:'Glasses, close' }
];
/* A show without a photo still has to render. */
const SHOW_HERO_FALLBACK = 'images/duesseldorf-tasting-wide.jpg';

/* One record per show. `exhibitors[].products[].name` is a REFERENCE by
   name into the producer's own range (`partnerWinesPool` in the
   dashboard), never product content — A16.9, invariant 2.

   VENUE FIELDS (A16.9, A16.11 steps 1–2). `venueEntity` is the join key
   standing in for `venue_id`; `venueName` is only the display address.
   `venueStatus` runs `not_required → requested → quoted → accepted`,
   with `declined` off to the side. `cateringTotal` is the VENUE'S
   number: it is entered once, by the venue, and read everywhere else —
   the host never retypes it (A1).

   The three states are all present on purpose, so every side of the
   flow has something to show without clicking first:
     WS-2604  requested  → Bistro Laurent has a request to answer
     WS-2602  quoted     → the host has a price to look at
     WS-2599  accepted   → Weinhaus Müller has hosted one, in history

   ATTENDEES (A16.5, A16.9). `stakeholder` is the join key standing in
   for `stakeholder_id`. `status` holds only the DECISION — there is no
   `waitlisted` value, because holding a seat is computed from request
   order against `capacity` (A16.10, D28). Array order IS request
   order; nothing else records it.

   Attending needs no partnership, and the fixtures say so: Restaurant
   Hafenkante and Vinoteca Alster appear nowhere in `activePartners`.

   THE ORDER LIST (A16.12). `indicativePrice` sits on the confirmed
   product and belongs to the HOST — it is his number about somebody
   else's wine, and it is never binding. `interests` are what the show
   floor writes: one row per (attendee, product), `status:'open'`
   until a closing turns them into order lines. WS-2603 carries a
   worked example because it is the only released show with a full
   room — the tally there is what a host reads on the evening. */
/* ══════════════════════════════════════════════════════════════════
   THE PRODUCERS' CATALOGUE AND THE ONE RESOLVER — moved here in 3b
   ------------------------------------------------------------------
   Both used to live in the dashboard, and pass 3b is what made that
   impossible. A show product is a REFERENCE into a producer's range
   (A16.9), and SEVENTEEN public pages render those references — none
   of which loads the dashboard. While the reference was the string
   "Pouilly-Fumé 2023" that went unnoticed, because a name renders
   without being resolved. A key does not: a public page holding a key
   and no catalogue can only print the key.

   So the catalogue and the resolver belong in the file EVERY surface
   loads, which is this one — same move and same reason as blDate().
   The distributor's book and the buyers' lists stay in the dashboard:
   they are that page's own state, and allProducts() reaches them
   through the global lexical scope classic scripts share.
══════════════════════════════════════════════════════════════════ */
/* `url` is the wine's public article page — a FIELD, not a rule. It was
   added with C9 pass 2b, where a notification names the wine somebody
   is waiting on and links to it.

   Deriving it from the name instead ("Primitivo Riserva" →
   bottle-lobby-wine-primitivo-riserva.html) was the obvious shortcut
   and is the one thing not to do here: invariant 4 exists because a
   cross-feature match has to be the same RECORD, and this prototype has
   already paid for string matching twice (the em dash in "Riesling
   Spätlese — Mosel", A14.4). A wine with no article page gets no `url`
   and is then named without a link — no link beats a guessed one.

   `at` is the day the producer added the wine to their range, and it
   was added for the same reason `url` was: C9 requires every source to
   answer **who** and **when** about every event it emits, and "a new
   wine" is an event. `who` needs no field — the producer owns the
   record (invariant 2), so the actor IS `winery`. Without `at` the row
   could not be sorted and, worse, the read marker could not stay
   stable, because the notification id carries the date.

   The dates are not decoration. They decide who hears about which
   wine: a wine only reaches a reader whose relation to the producer
   already existed when it was added (see notifWineryEdge). Baglio
   Rosso sits between Bistro Laurent's follow and Weinhaus Müller's on
   purpose — one of them hears about it, the other does not, and both
   are right. */

/* ── `id` — THE PRODUCT KEY (pass 1 of 5) ──────────────────────────
   Nothing reads it yet. It exists first so that the readers can be
   widened before any reference moves — moving the data first would
   leave every name comparison silently finding nothing, which renders
   as an empty surface rather than an error.

   WHAT IT REPLACES. 91 wine references across eleven sources, 52 of
   them joined by NAME. The same bottle is spelled two ways on purpose
   in ten cases, because the show surface appends the vintage:
   "Pouilly-Fumé" in the book, "Pouilly-Fumé 2023" on the show floor.
   A join that has to strip a trailing four-digit year to work is a
   guess with good odds, not a key.

   WHY IT IS OPAQUE and not the slug that `url` already carries.
   Renaming. A16 has the appellation master-data pass ahead of it (A4),
   several wine names carry their appellation, and the origin strings
   are already measured as inconsistent. A slug-shaped key leaves only
   bad options when a name changes: stay and lie, or follow and prove
   it was never an identifier. Two reasonable slugifiers already
   disagree about exactly one of these 26 wines — "Nero d'Avola",
   apostrophe dropped or turned into a separator — and that
   disagreement fails as a silent 404, not as an error.

   `PRD-`, not `W-`: invariant 5 says the entity is a PRODUCT. A wine
   prefix would have to be migrated the day spirits are switched on,
   and `W-` is the obvious prefix for a winery once stakeholders get
   ids of their own. Taken today: ORD, WS, and QU/PF/PP/IN/DN/CN from
   DOC_TYPES.

   `id` sits FIRST, before the name, so a fixture row still says what
   it is at a glance. That is the whole payment for readability — at a
   reference site there is no such trick, which is why pass 2 brings
   wineLabel(id) and why every harness finding prints the resolved
   label rather than the bare id.

   `url` stays beside it and keeps its own job: it is the ADDRESS of
   the article page and may change. An id is never rendered, a url is
   never compared — tests/wine-identity.js holds both halves.

   Numbering follows partnerWinesPool first, because a product record
   belongs to its producer (invariant 2). PRD-1020 … PRD-1026 existed
   only in the distributor's book: seven wines nobody's catalogue
   knew. The numbering records that gap rather than smoothing it.

   THE GAP IS CLOSED, AND THE ANSWER WAS THE ONE THIS COMMENT ASKED
   FOR. It used to end: "the open question is not whether to loosen
   A17.9 but whether all six are own labels at all." Measured — none of
   the six is one (D41). Each is the producer's own appellation wine
   under the producer's brand; five of their article pages give the
   own-label ribbon the reason *exclusive distribution through
   Hawesko*, which is precisely what A17.0b's last paragraph puts
   outside A17, and the sixth (PRD-1022) reads *Own-Label Available* on
   its own page — the capability, not the product.

   The reasoning that kept them out therefore falls with them. This
   pool is an ORDER LIST, and A17.9 keeps an own-label product out of
   any picker but its primary distributor's — but an ordinary wine
   belongs in its producer's catalogue, which is A3 in one sentence:
   answer a contradiction by adding the missing record. All six are
   added below.

   WHAT DECIDED IT, and it is the argument that refuted itself:
   PRD-1026 sat in exactly the same gap — in the distributor's book,
   in the Guide, on an article page, in no producer catalogue — and
   claimed **no** own label anywhere. So the gap was never six own
   labels; it was seven mockup rows that lived only in the
   distributor's book, and PRD-1026 was simply the first one repaired.
   PRD-1027 was the same case one file over.

   The real own labels are PRD-1028 and PRD-1029, they are new records
   with `brandOwner:'Hawesko GmbH'`, and they are deliberately NOT in
   this pool — for the action right A17.9 actually names, now with a
   product it applies to. See `ownLabelProducts` in the dashboard.

   `ownLabelAvailability` REPLACES `note:'Own-Label Available'`
   (A17.0a, D36): a capability is a field with three values, not free
   text beside other free text. `note` keeps what it was for — the
   producer's own remark about the wine — and the three rows that
   carried the availability in it now read 'Standard' there and carry
   `'on_request'` in the field. Seven wines across four producers are
   open to requests; every other row is `'unavailable'`, which is the
   honest default rather than a refusal.

   (A17.9's three-party VISIBILITY is a phase, not a permanent state —
   it ends at the first delivery. Reading it as permanent once made
   these fixtures look like a breach; A17.9 now spells the two levels
   apart, and HANDOFF keeps the misreading on record.) */
const partnerWinesPool = [
  { id:'PRD-1001', winery:'Cantina Rossi', name:'Catarratto Biologico', vintage:2023, type:'White', note:'Organic', ownLabelAvailability:'unavailable', origin:'Sicilia DOC, Sicily', url:'bottle-lobby-wine-catarratto-biologico.html', at:'2025-03-14' },
  { id:'PRD-1002', winery:'Cantina Rossi', name:'Grillo Sicilia DOC', vintage:2023, type:'White', note:'Standard', ownLabelAvailability:'on_request', origin:'Sicilia DOC, Sicily', url:'bottle-lobby-wine-grillo-sicilia-doc.html', at:'2025-04-02' },
  { id:'PRD-1003', winery:'Cantina Rossi', name:"Nero d'Avola Sicilia DOC", vintage:2022, type:'Red', note:'Standard', ownLabelAvailability:'on_request', origin:'Sicilia DOC, Sicily', url:'bottle-lobby-wine-nero-davola-sicilia-doc.html', at:'2025-05-20' },
  { id:'PRD-1004', winery:'Cantina Rossi', name:'Primitivo Riserva', vintage:2020, type:'Red', note:'Riserva · Premium Tier', ownLabelAvailability:'unavailable', origin:'Alcamo DOC, Sicily', url:'bottle-lobby-wine-primitivo-riserva.html', at:'2025-02-11' },
  { id:'PRD-1005', winery:'Cantina Rossi', name:'Rosato di Sicilia', vintage:2023, type:'Rosé', note:'Standard', ownLabelAvailability:'on_request', origin:'Sicilia DOC, Sicily', url:'bottle-lobby-wine-rosato-di-sicilia.html', at:'2025-06-09' },
  { id:'PRD-1006', winery:'Cantina Rossi', name:'Rosso di Contrada', vintage:2023, type:'Red', note:'Standard', ownLabelAvailability:'unavailable', origin:'Sicilia DOC, Sicily', url:'bottle-lobby-wine-rosso-di-contrada.html', at:'2025-09-16' },
  /* Backfilled 4 Aug 2026 under A3: the price table carried a trade price
     for this wine, the article page and the public Wine Guide carry the
     wine, and only the producer's catalogue did not. A3 says add the
     missing record rather than remove the offending one.
     `at` is fixture authorship and bounded: the Wine Guide names Enoteca
     Milano as its distributor, and that partnership starts 2026-05-11, so
     the wine cannot be younger than that (C7 — the earliest dependent
     event is the ceiling). Placed in the 2025 block because that is the
     class it belongs to: publicly listed all along, unlike the two 2026
     rows above, which are dated late on purpose to demonstrate A8. */
  { id:'PRD-1027', winery:'Cantina Rossi', name:'Terra Rossa', vintage:2022, type:'Red', note:'Standard', ownLabelAvailability:'unavailable', origin:'Sicilia DOC, Sicily', url:'bottle-lobby-wine-terra-rossa.html', at:'2025-07-22' },
  { id:'PRD-1007', winery:'Cantina Rossi', name:'Trinacria Bianco', vintage:2023, type:'White', note:'Standard', ownLabelAvailability:'unavailable', origin:'Terre Siciliane IGT, Sicily', url:'bottle-lobby-wine-trinacria-bianco.html', at:'2025-11-04' },
  /* The two deliberate ones: added AFTER somebody started following. */
  { id:'PRD-1008', winery:'Cantina Rossi', name:'Baglio Rosso', vintage:2021, type:'Red', note:'Standard', ownLabelAvailability:'unavailable', origin:'Terre Siciliane IGT, Sicily', url:'bottle-lobby-wine-baglio-rosso.html', at:'2026-04-20' },
  { id:'PRD-1009', winery:'Cantina Rossi', name:'Costa Bianca', vintage:2023, type:'White', note:'Standard', ownLabelAvailability:'unavailable', origin:'Terre Siciliane IGT, Sicily', url:'bottle-lobby-wine-costa-bianca.html', at:'2026-05-28' },
  { id:'PRD-1010', winery:'Domaine Lefèvre', name:'Bourgogne Passetoutgrain', vintage:2023, type:'Red', note:'Standard', ownLabelAvailability:'unavailable', origin:'Bourgogne Passetoutgrain AOC, France', url:'bottle-lobby-wine-bourgogne-passetoutgrain.html', at:'2025-10-07' },
  { id:'PRD-1011', winery:'Domaine Lefèvre', name:'Crémant de Bourgogne', vintage:2022, type:'White', note:'Standard', ownLabelAvailability:'unavailable', origin:'Crémant de Bourgogne AOC, France', url:'bottle-lobby-wine-cremant-de-bourgogne.html', at:'2025-08-19' },
  { id:'PRD-1012', winery:'Domaine Lefèvre', name:'Bourgogne Aligoté', vintage:2023, type:'White', note:'Standard', ownLabelAvailability:'unavailable', origin:'Bourgogne Aligoté AOC, France', url:'bottle-lobby-wine-bourgogne-aligote.html', at:'2026-01-15' },
  { id:'PRD-1013', winery:'Domaine Lefèvre', name:'Mâcon-Villages', vintage:2023, type:'White', note:'Standard', ownLabelAvailability:'on_request', origin:'Mâcon-Villages AOC, France', url:'bottle-lobby-wine-macon-villages.html', at:'2026-02-26' },
  { id:'PRD-1014', winery:'Henri Dubois Domaine', name:'Sancerre Rouge', vintage:2022, type:'Red', note:'Standard', ownLabelAvailability:'unavailable', origin:'Sancerre AOC, Loire Valley', url:'bottle-lobby-wine-sancerre-rouge.html', at:'2025-07-03' },
  { id:'PRD-1015', winery:'Henri Dubois Domaine', name:'Pouilly-Fumé', vintage:2023, type:'White', note:'Standard', ownLabelAvailability:'unavailable', origin:'Pouilly-Fumé AOC, Loire Valley', url:'bottle-lobby-wine-pouilly-fume.html', at:'2025-12-08' },
  { id:'PRD-1016', winery:'Bodegas Ruiz', name:'Rioja Reserva', vintage:2019, type:'Red', note:'Standard', ownLabelAvailability:'unavailable', origin:'Rioja DOCa, Spain', url:'bottle-lobby-wine-rioja-reserva.html', at:'2025-09-10' },
  { id:'PRD-1017', winery:'Bodegas Ruiz', name:'Rioja Blanco', vintage:2023, type:'White', note:'Standard', ownLabelAvailability:'unavailable', origin:'Rioja DOCa, Spain', url:'bottle-lobby-wine-rioja-blanco.html', at:'2026-06-20' },
  { id:'PRD-1018', winery:'Weingut Schmitt', name:'Müller-Thurgau — Mosel', vintage:2023, type:'White', note:'Standard', ownLabelAvailability:'unavailable', origin:'Mosel QbA, Germany', url:'bottle-lobby-wine-muller-thurgau-mosel.html', at:'2026-07-25' },
  { id:'PRD-1019', winery:'Weingut Schmitt', name:'Spätburgunder — Mosel', vintage:2022, type:'Red', note:'Standard', ownLabelAvailability:'unavailable', origin:'Mosel QbA, Germany', url:'bottle-lobby-wine-spatburgunder-mosel.html', at:'2026-01-22' },

  /* ── Château Belrieu — the producer's first catalogue row ────────
     Backfilled under A3, and the same shape as Terra Rossa above: the
     wine has an article page, a public Wine Guide entry and a line in
     three profile books, and only the producer's catalogue did not
     carry it. A3 adds the missing record.

     WHY THIS ONE FIRST, AND WHY IT DECIDED THE OTHER SIX. It was the
     only one of the seven claiming no own label anywhere — Guide
     'Standard', no bridge value — so it came across on 5 Aug while the
     six were held back. That asymmetry is what made the group
     legible a day later: a wine with no own-label claim sitting in the
     identical gap means the gap was never about own label at all
     (D41). The six follow below.

     `note` IS LIFTED, NOT CHOSEN. 'Standard' is what the
     distributor-, restaurant- and retail-profile books each already
     write on this row, and what the Guide's `status` says. Four
     hand-written sources, one answer. The Guide's status is NOT the
     same field as `note` (A17.0a/D36 keep those apart) — it is used
     here as corroboration, not as the source.

     `origin` follows the Appellation, Region convention, so the
     region and not the country stands second — 'Bordeaux', which the
     article page and the Guide both give. The distributor's book row
     said ', France' and is aligned in the same pass, so the two books
     do not start disagreeing about a wine they now both carry.

     `at` IS FIXTURE AUTHORSHIP, and it is bounded TWICE. C7 gives the
     ceiling: Hawesko's listing of this wine is dated 2026-06-01 and
     nothing may depend on a record older than itself. The tighter
     bound is notifNewWines() — Bistro Laurent has followed Château
     Belrieu since 2026-04-27, so any `at` after that day announces
     this wine to them as new. It has been on the public Guide all
     along; that would be an overstatement of exactly the kind this
     chain removes. Placed in the 2025 block for the same reason
     Terra Rossa was: publicly listed all along. Measured after —
     notification counts unchanged at 13 / 27 / 18 / 13. */
  { id:'PRD-1026', winery:'Château Belrieu', name:'Château Belrieu Grand Vin', vintage:2019, type:'Red', note:'Standard', ownLabelAvailability:'unavailable', origin:'Bordeaux Supérieur AOC, Bordeaux', url:'bottle-lobby-wine-chateau-belrieu-grand-vin.html', at:'2025-10-28' },

  /* ── The last six of the seven — the ex-bridge wines (A3, D41) ───
     One per producer, and the spread is the finding rather than a
     convenience: the six were never one distributor's own-label range,
     they were six different houses' appellation wines that had only
     ever been written down in one book.

     NOTHING IS INVENTED HERE. Every field is lifted from the
     distributor's own row for the same wine, which has carried
     producer, name, vintage, type, the precise `origin` and the article
     page since the catalogue pass — and each of those was itself
     sourced or corroborated there. This commit moves the record to its
     owner (invariant 2); it does not author one.

     `note:'Standard'` on all six, and that is now the measured answer
     rather than the default. What the article pages actually claim is a
     DISTRIBUTION EXCLUSIVITY ("Exclusive to Hawesko in northern Germany
     and Scandinavia"), and an exclusivity is a relation between two
     houses, not a remark about a wine — so it does not belong in a
     producer's `note`. It has no record anywhere in this prototype,
     which is a NAMED GAP and not something to fill by hand: A17.9's
     source exclusivity covers own labels only, D40 point 8 deliberately
     leaves the ordinary distribution agreement named and not modelled,
     and `listings.exclusive` is the buyer's own marking on their own
     list. HANDOFF carries it.

     `ownLabelAvailability`: PRD-1020, PRD-1022 and PRD-1024 read
     `'on_request'`, the other three `'unavailable'`. PRD-1022's own
     article page says *Own-Label Available* in as many words. PRD-1020
     must be open, because a relabel project (OLP-101) may only be
     opened on a wine that is — A17.4 asks exactly that, and it is
     A17.0b's own example. PRD-1024 is Serge's decision and the nearest
     true reading of a screen: it carried the bridge's only `'pending'`
     value, and a project in negotiation was never a claim that a
     finished own label existed.

     `at` IS FIXTURE AUTHORSHIP, bounded the same way PRD-1026 and
     PRD-1027 were and for the same reason. C7's ceiling is Hawesko's
     listing of each, 2026-06-01; the tighter bound is notifNewWines(),
     which announces any wine dated after a follower's edge as new —
     and all six have been on public article pages and in the public
     Guide all along, so announcing them now would be the overstatement
     this chain exists to remove. All six sit in the 2025 block.
     Measured before and after: notification counts unchanged at
     28 / 13 / 18 / 13 (distributor / winery / restaurant / retail). */
  { id:'PRD-1020', winery:'Henri Dubois Domaine', name:'Sauvignon Blanc — Sancerre', vintage:2023, type:'White', note:'Standard', ownLabelAvailability:'on_request', origin:'Sancerre AOC, Loire Valley', url:'bottle-lobby-wine-sauvignon-blanc-sancerre.html', at:'2025-05-06' },
  { id:'PRD-1021', winery:'Domaine Lefèvre', name:'Chardonnay — Chablis Premier Cru', vintage:2022, type:'White', note:'Standard', ownLabelAvailability:'unavailable', origin:'Chablis Premier Cru AOC, Burgundy', url:'bottle-lobby-wine-chardonnay-chablis-premier-cru.html', at:'2025-06-17' },
  { id:'PRD-1022', winery:'Cantina Rossi', name:'Primitivo — Alcamo DOC', vintage:2022, type:'Red', note:'Standard', ownLabelAvailability:'on_request', origin:'Alcamo DOC, Sicily', url:'bottle-lobby-wine-primitivo-sicilia-igt.html', at:'2025-01-21' },
  { id:'PRD-1023', winery:'Bodegas Ruiz', name:'Tempranillo — Rioja Crianza', vintage:2021, type:'Red', note:'Standard', ownLabelAvailability:'unavailable', origin:'Rioja DOCa (Crianza), Rioja Alta', url:'bottle-lobby-wine-tempranillo-rioja-crianza.html', at:'2025-08-05' },
  { id:'PRD-1024', winery:'Weingut Schmitt', name:'Riesling Spätlese — Mosel', vintage:2023, type:'White', note:'Standard', ownLabelAvailability:'on_request', origin:'Mosel Spätlese (Prädikatswein), Mosel', url:'bottle-lobby-wine-riesling-spatlese-mosel.html', at:'2025-09-23' },
  { id:'PRD-1025', winery:'Château Belrieu', name:'Merlot — Bordeaux Supérieur', vintage:2021, type:'Red', note:'Standard', ownLabelAvailability:'unavailable', origin:'Bordeaux Supérieur AOC, Bordeaux', url:'bottle-lobby-wine-merlot-bordeaux-superieur.html', at:'2025-04-15' }
];

/* ══════════════════════════════════════════════════════════════════
   ONE QUESTION: WHICH PRODUCT IS THIS? (pass 2 of 5, moved here in 3b)
   ------------------------------------------------------------------
   The readers are widened here, and the references still name names.
   That order is the whole point: a comparison taught to expect a key
   throws nothing when it is handed a name — it finds nothing, and a
   surface renders empty. Widening first means every step after this
   one can be verified by the surface still being right.

   ONE FUNCTION, because twenty-one places asked this question and
   each answered it itself. They did not all ask it the same way:
   some matched producer and name, some name alone, some name plus
   vintage — and the show surface spells the vintage into the name,
   so "Pouilly-Fumé" and "Pouilly-Fumé 2023" were two strings for one
   bottle in ten cases. Every one of those readings is preserved
   below; what changes is that there is now a single place where they
   live, and a single place for pass 4 to delete the name branch.

   `book` NARROWS THE SEARCH, and that is a rule rather than a
   shortcut: orderItem() has to answer null for a wine outside the
   seller's portfolio (invariant 3), not find it in somebody else's
   book. A call without a book is asking "does this platform know
   this product at all", which is a different question.
══════════════════════════════════════════════════════════════════ */
const PRODUCT_ID = /^PRD-\d{4}$/;

/* Every product row the page knows, whichever book it sits in.

   The try/catch is not defensive noise, it is the only way to ask.
   This file evaluates top to bottom and several renderers run while
   it does — before the buyers' lists further down exist. A `let` in
   its temporal dead zone throws on `typeof` too, so the guard used
   everywhere else in this file (`typeof x !== 'undefined'`) does not
   work here and fails loudly rather than quietly. A book that is not
   there yet contributes nothing; every caller that depends on a
   specific book passes it explicitly. */
function bookOrEmpty(read) {
  try { const v = read(); return Array.isArray(v) ? v : []; } catch (e) { return []; }
}
function allProducts() {
  return [].concat(
    bookOrEmpty(function () { return partnerWinesPool; }),
    /* The own-label products are products, and every reader that asks
       "does this platform know this key" has to find them — My Labels,
       the order lines of the first orders, the derived listing. They are
       NOT in `partnerWinesPool` and that is an action right rather than
       a filing choice (A17.9); this is the question that does not ask
       about rights at all. */
    bookOrEmpty(function () { return ownLabelProducts; }),
    bookOrEmpty(function () { return currentWinePortfolio; }),
    bookOrEmpty(function () { return rCurrentWineList; }),
    bookOrEmpty(function () { return tCurrentWineSelection; })
  );
}

/* A reference → the product row it names, or null. A KEY, or a record
   carrying one. Nothing else.

   THE NAME BRANCH IS GONE (pass 4 of 5). It accepted a bare name and,
   for the show surface, "<name> <vintage>" — the widening that let
   passes 3a–3c move 91 references while every surface stayed right.
   With it removed, anything still handing over a name resolves to
   null and renders empty, which is the point: a check after this cut
   is worth more than one before it, because a leftover cannot hide
   behind a string that happens to read correctly.

   It is deliberately NOT lenient about shape. A `{winery, name}` pair
   used to be accepted for the three pickers; they pass the key in
   their onclick now, so nothing escapes an apostrophe or an em dash
   any more — which is the failure A14.4 records. */
function wineByRef(ref, book) {
  const rows = book || allProducts();
  if (!ref || !rows.length) return null;
  const id = typeof ref === 'object' ? ref.id : ref;
  if (typeof id !== 'string' || !PRODUCT_ID.test(id)) return null;
  return rows.find(r => r.id === id) || null;
}

/* THE ONE LABEL. Six places built "name vintage" by hand, which is
   how the same bottle came to be spelled two ways; same shape and
   same reason as blDate(). An unresolvable reference is printed as it
   arrived rather than swallowed — a wine nobody's book knows is a
   finding, not a blank. */
function wineLabel(ref, book) {
  const p = wineByRef(ref, book);
  return p ? p.name + ' ' + p.vintage : noProduct(ref, 'wineLabel');
}

/* ── MAY THIS WINE BE ASKED ABOUT? (A17.0a, A17.4) ───────────────
   The SECOND of A17.0a's four levels, and the one that used to be free
   text — `note:'Own-Label Available'`, sitting beside 'Organic' and
   'Riserva · Premium Tier' as though a capability and a tasting remark
   were the same kind of statement. That is D36, and the field replaces
   the note rather than joining it.

   IT SAYS ONE THING AND NOT THREE. It says only whether a PROJECT MAY
   BE STARTED. It does not make the wine an own label, does not restrict
   ordinary distribution, and a wine open to requests stays ordinarily
   tradeable — PRD-1020 is open, is on two buyers' lists, carries a
   promo and a deal, and is sold every month. Whether a finished own
   label exists is the third level (a product with a gate-2 project);
   whether a distributor carries one is the fourth (OL-15). Three
   different answers, and this function may never be used for the other
   two.

   AN UNKNOWN PRODUCT IS 'unavailable', NOT null. A wine nobody's book
   knows cannot be asked about, and the only caller that cares is a
   picker deciding whether to offer a project — where "no" is the safe
   and true answer. A missing field reads the same way: the honest
   default for a house that has said nothing is that it has said no. */
const OWN_LABEL_AVAILABILITY = ['unavailable', 'on_request', 'available'];
function ownLabelAvailabilityOf(ref, book) {
  const p = wineByRef(ref, book);
  const v = p && p.ownLabelAvailability;
  return OWN_LABEL_AVAILABILITY.indexOf(v) === -1 ? 'unavailable' : v;
}
function ownLabelOnRequest(ref, book) {
  return ownLabelAvailabilityOf(ref, book) !== 'unavailable';
}

/* wineLabel() names the BOTTLING — name and vintage — because that is
   what a show product and a portfolio row have always shown. A promo
   condition, an offer and a deal name the WINE and have never carried
   a vintage: "Buy 60 bottles of Sauvignon Blanc — Sancerre". Whether
   a deal ought to name the vintage is a business question, not a
   consequence of giving products keys, so the printed text is left
   exactly where it was and the question is left open. */
/* An unresolvable reference prints NOTHING, and says so on the
   console. Returning the reference itself was right while names were
   still travelling — it kept a surface readable mid-migration. After
   pass 4 it would be the opposite: a stray name would render as
   itself and look correct, which is precisely the failure this whole
   chain exists to make impossible. */
function noProduct(ref, who) {
  if (window.console && console.warn)
    console.warn('[product] ' + who + ': "' + ref + '" is not a product key — nothing to show');
  return '';
}
function wineName(ref)   { const p = wineByRef(ref); return p ? p.name : noProduct(ref, 'wineName'); }
function wineWinery(ref) { const p = wineByRef(ref); return p ? p.winery : ''; }

/* Two references, one bottle? Where both sides resolve this is an id
   comparison. Where one does not — a name no book carries — it falls
   back to the string equality it replaces, so this pass changes no
   answer it does not have to. The fallback is the measure of what is
   left to do, and pass 4 removes it along with the name branch. */
/* Two references, one product? An id comparison, and nothing else.
   The string fallback that stood here was the measure of what was
   left to do; there is nothing left, so a reference that does not
   resolve is not equal to anything — including another one that does
   not resolve. Two unknowns are not a match. */
function sameWine(a, b, book) {
  const pa = wineByRef(a, book), pb = wineByRef(b, book);
  return !!pa && !!pb && pa.id === pb.id;
}

/* `reach` is the host's answer to "who may FIND this show" (A16.14b),
   and it is a MULTI-SELECT: every entry permits, none forbids, and a
   house in two selected groups sees the show once. It gates the class-1
   surfaces before `published` and nothing at all from `published` on —
   a released show stands on the open website (WS-3).

   Every fixture carries an explicit value. Four of them read ['public']
   because that is the surface they stand on TODAY: a reach decision
   introduced after the fact must not retroactively narrow visibility
   somebody has already been shown. WS-2605 in particular carries the
   regional-notification fixture that tests/notifications.js asserts.

   A show with no `reach` at all is found by nobody but its host and its
   confirmed participants. That is the protective direction — and the
   host cockpit says so in words rather than leaving a silent gap. */
let wineShows = [
  /* THE RECRUITING FIXTURE, and the one D38 is written about (A16.2,
     Appendix D): `planning` with zero exhibitors and zero wines. The
     old trigger would have held it in `draft` until it had a confirmed
     exhibitor — which is the contradiction D38 names, because
     recruiting is what `planning` is FOR.

     It is also the restricted open call: reach names wineries and
     Hawesko's own active partners, so the two groups that could
     actually exhibit or attend find it, and an anonymous visitor does
     not. Measured consequence, and it is the point rather than a side
     effect: Bistro Laurent, Weinhaus Müller and Vinstuen København
     hold active Hawesko partnerships and therefore DO see it through
     'partners'. Invisible means an unpartnered restaurant or retailer
     and the open web — not "every buyer". */
  { id:'WS-2604', title:'Sicilia Prima', date:'2027-03-14', city:'Frankfurt',
    focus:'Sicilian indigenous varieties for the on-trade',
    heroImage:'images/hamburg-glasses.jpg',
    stage:'planning', leadHost:'Hawesko GmbH',
    reach:['wineries','partners'],
    applications_open:true, application_deadline:'2027-01-31',
    venueType:'partner_venue', venueEntity:'Bistro Laurent',
    venueName:'Bistro Laurent, Frankfurt', venueStatus:'requested',
    capacity:60, exhibitors:[], attendees:[],
    events:[
      { at:'2026-07-30', actor:'Hawesko GmbH', text:'Show created as a draft' },
      { at:'2026-07-30', actor:'Hawesko GmbH', text:'Venue request sent to Bistro Laurent' },
      { at:'2026-07-30', actor:'Hawesko GmbH', text:'Basics stand — show listed in Planning', scope:'show' },
      { at:'2026-07-30', actor:'Hawesko GmbH', text:'Open for applications from wineries and partners until 31 Jan 2027' } ] },

  /* Deliberate fixture for C9's regional exception. Bistro Laurent sits
     in Frankfurt and has NOTHING to do with this show — not host, not
     venue, not exhibitor, not guest. It is the only pair in the data
     that produces a "New Wine Show in your region" entry, and without
     it the exception would be covered by construction only, exactly
     like the Bodegas Ruiz follow edge for A16.6. `planning` on purpose:
     the show is publicly listed but anonymised, so the notification is
     the capped one — title, date, city, focus and nothing else.
     tests/notifications.js asserts this pair exists and fails if it
     is removed. */
  /* Dated after the other upcoming shows on purpose: the "From Your
     Stars" feed shows only the next few, and an earlier date here would
     push Nordic Selection out of it — which is what tests/follow-feed.js
     asserts about, not about this show. The regional rule does not care
     when the show is, only where. */
  { id:'WS-2605', title:'Rhein & Main Selection', date:'2027-02-20', city:'Frankfurt',
    focus:'German riesling and pinot for the Rhein-Main on-trade',
    heroImage:'images/hamburg-glasses.jpg',
    stage:'planning', leadHost:'Hawesko GmbH',
    /* ['public'] read off the surface it stands on: this is the show
       the regional notification is derived from, and that derivation
       only reaches a stranger's eyes at all because the show is
       publicly listed (C9 condition 3). */
    reach:['public'],
    applications_open:false, application_deadline:null,
    venueType:'host_premises', venueEntity:null,
    venueName:'Hawesko Rhein-Main Loft, Frankfurt', venueStatus:'not_required',
    capacity:50, attendees:[],
    exhibitors:[
      { producer:'Weingut Schmitt', status:'confirmed', source:'invitation',
        products:[ { productId:'PRD-1019', proposedBy:'host', status:'confirmed' } ] } ],
    events:[
      { at:'2026-07-20', actor:'Hawesko GmbH', text:'Show created as a draft' },
      { at:'2026-07-26', actor:'Weingut Schmitt', text:'Confirmed with Spätburgunder — Mosel 2022' },
      { at:'2026-07-26', actor:'Bottle Lobby', text:'Venue, exhibitor and product confirmed — show moved to Planning', scope:'show' } ] },

  { id:'WS-2601', title:'Grande Rioja', date:'2026-12-05', city:'Düsseldorf',
    focus:'Premium reds from Rioja and Sicily',
    heroImage:'images/duesseldorf-tasting-wide.jpg',
    stage:'planning', leadHost:'Hawesko GmbH',
    /* Serge's decision, 6 Aug 2026: the open, anonymised listing — the
       one an anonymous visitor finds on the public Wine Shows page.
       It is the counterpart WS-2604 is read against. */
    reach:['public'],
    applications_open:false, application_deadline:null,
    venueType:'host_premises', venueEntity:null,
    venueName:'Hawesko Tasting Loft, Hamburg', venueStatus:'not_required',
    capacity:80,
    attendees:[
      { stakeholder:'Vinstuen København', source:'invitation', status:'confirmed', at:'2026-07-20' },
      { stakeholder:'Bistro Laurent',     source:'invitation', status:'invited',   at:'2026-07-29' }
    ],
    exhibitors:[
      { producer:'Bodegas Ruiz', status:'confirmed', source:'invitation',
        products:[ { productId:'PRD-1016', proposedBy:'host', status:'confirmed' } ] },
      /* Producer proposed, host has not answered — the host is at turn. */
      { producer:'Weingut Schmitt', status:'confirmed', source:'invitation',
        products:[ { productId:'PRD-1019', proposedBy:'producer', status:'proposed' } ] },
      { producer:'Cantina Rossi', status:'invited', source:'invitation',
        products:[ { productId:'PRD-1004', proposedBy:'host', status:'proposed' } ] }
    ],
    events:[
      { at:'2026-07-12', actor:'Hawesko GmbH', text:'Show created as a draft' },
      { at:'2026-07-14', actor:'Hawesko GmbH', text:'Bodegas Ruiz invited with Rioja Reserva 2019' },
      { at:'2026-07-17', actor:'Bodegas Ruiz', text:'Confirmed with Rioja Reserva 2019' },
      { at:'2026-07-17', actor:'Hawesko GmbH', text:'Confirmed Rioja Reserva 2019 for Bodegas Ruiz' },
      { at:'2026-07-17', actor:'Bottle Lobby', text:'Venue, exhibitor and product confirmed — show moved to Planning', scope:'show' },
      { at:'2026-07-24', actor:'Hawesko GmbH', text:'Weingut Schmitt invited — no wine proposed' },
      { at:'2026-07-26', actor:'Weingut Schmitt', text:'Proposed Spätburgunder — Mosel 2022' },
      { at:'2026-07-28', actor:'Hawesko GmbH', text:'Cantina Rossi invited with Primitivo Riserva 2020' },
      { at:'2026-07-29', actor:'Hawesko GmbH', text:'Bistro Laurent invited to attend' } ] },

  { id:'WS-2602', title:'Nordic Selection', date:'2027-01-22', city:'Copenhagen',
    focus:'Mediterranean whites for Scandinavian kitchens',
    heroImage:'images/duesseldorf-pouring.jpg',
    stage:'pending_approval', leadHost:'Hawesko GmbH',
    reach:['public'],
    applications_open:false, application_deadline:null,
    /* ACCEPTED, not merely quoted, and that is a D38 consequence: the
       publish precondition is now the host's binding acceptance of the
       venue's offer (A16.11 step 6, A16.14c). A show sitting under Final
       Review with an unanswered quote would be a state the platform
       cannot produce. `host_covers` for the same reason — a cost split
       has to be named before a show may be submitted, and this one
       charges nobody. */
    venueType:'partner_venue', venueEntity:'Vinstuen København',
    venueName:'Vinstuen København, Copenhagen', venueStatus:'accepted',
    cateringTotal:1250, venueQuotedAt:'2026-07-27', venueAcceptedAt:'2026-07-29',
    cateringMode:'host_covers',
    capacity:50, attendees:[],
    exhibitors:[
      { producer:'Cantina Rossi', status:'confirmed', source:'invitation',
        products:[ { productId:'PRD-1002', proposedBy:'producer', status:'confirmed' } ] },
      { producer:'Henri Dubois Domaine', status:'confirmed', source:'invitation',
        products:[ { productId:'PRD-1015', proposedBy:'host', status:'confirmed' } ] }
    ],
    events:[
      { at:'2026-07-02', actor:'Hawesko GmbH', text:'Show created as a draft' },
      { at:'2026-07-08', actor:'Cantina Rossi', text:'Confirmed with Grillo Sicilia DOC 2023 instead of the proposed wine' },
      { at:'2026-07-09', actor:'Henri Dubois Domaine', text:'Confirmed with Pouilly-Fumé 2023' },
      { at:'2026-07-24', actor:'Hawesko GmbH', text:'Venue request sent to Vinstuen København' },
      { at:'2026-07-27', actor:'Vinstuen København', text:'Quoted € 1,250 for room and catering' },
      { at:'2026-07-29', actor:'Hawesko GmbH', text:"Accepted Vinstuen København's offer of € 1,250 for room and catering — the show is committed", scope:'show' },
      { at:'2026-07-29', actor:'Hawesko GmbH', text:'Set the cost split: I carry the cost — no contribution is charged' },
      /* Last, because it is: nothing may be submitted before the
         checklist stands, so the submission cannot predate the
         acceptance and the split (A16.14c). It was dated 21 Jul while
         the preconditions sat at `planning`. */
      { at:'2026-07-30', actor:'Hawesko GmbH', text:'Submitted to Bottle Lobby for Final Review', scope:'show' } ] },

  { id:'WS-2603', title:'Loire & Mosel', date:'2026-09-18', city:'Hamburg',
    focus:'Cool-climate whites, two rivers',
    heroImage:'images/hamburg-tasting-room.jpg',
    stage:'published', leadHost:'Hawesko GmbH',
    /* Carried for completeness, and deliberately without effect: from
       `published` the reach falls away and the show stands on the open
       route whatever it says (WS-3). It is history on this row, not a
       gate. */
    reach:['public'],
    applications_open:false, application_deadline:null,
    venueType:'host_premises', venueEntity:null,
    venueName:'Hawesko Tasting Loft, Hamburg', venueStatus:'not_required',
    /* A released show has to satisfy the checklist that released it, and
       naming who carries the cost is one of its lines (A16.14c). Its own
       premises and nobody charged — which is what RVW-3001 records. */
    cateringMode:'host_covers',
    /* Deliberately small so the waitlist is reachable in the demo: three
       seats, three confirmed, one more asking. A real tasting seats more;
       a fixture that never fills its room cannot show the one behaviour
       A16.5 promises — that a withdrawal promotes the next person with
       nobody doing anything. */
    capacity:3,
    /* Named while the show is still running, which A16.12 allows and
       prefers: a guest writing a list at the table can read "about 14
       days" there and then. */
    deliveryLead:14,
    attendees:[
      { stakeholder:'Bistro Laurent',        source:'invitation', status:'confirmed', at:'2026-06-02' },
      { stakeholder:'Restaurant Hafenkante', source:'request',    status:'confirmed', at:'2026-06-09' },
      { stakeholder:'Vinoteca Alster',       source:'request',    status:'confirmed', at:'2026-06-14' },
      { stakeholder:'Weinhaus Müller',       source:'request',    status:'requested', at:'2026-07-28' }
    ],
    exhibitors:[
      { producer:'Henri Dubois Domaine', status:'confirmed', source:'invitation',
        products:[ { productId:'PRD-1014', proposedBy:'host', status:'confirmed',
                     indicativePrice:14.5 } ] },
      { producer:'Weingut Schmitt', status:'confirmed', source:'invitation',
        products:[ { productId:'PRD-1018', proposedBy:'host', status:'confirmed',
                     indicativePrice:8.9 } ] }
    ],
    /* Two houses have written a list, a third has not yet — so the
       tally shows something and the demo still has an empty seat to
       fill by hand. */
    interests:[
      { attendee:'Restaurant Hafenkante', productId:'PRD-1014',
        qty:24, enteredBy:'attendee', status:'open', at:'2026-09-18' },
      { attendee:'Restaurant Hafenkante', productId:'PRD-1018',
        qty:12, enteredBy:'attendee', status:'open', at:'2026-09-18' },
      { attendee:'Vinoteca Alster', productId:'PRD-1014',
        qty:36, enteredBy:'host', status:'open', at:'2026-09-18' }
    ],
    events:[
      { at:'2026-05-20', actor:'Hawesko GmbH', text:'Show created as a draft' },
      { at:'2026-06-02', actor:'Weingut Schmitt', text:'Confirmed with Müller-Thurgau — Mosel 2023' },
      { at:'2026-06-04', actor:'Henri Dubois Domaine', text:'Confirmed with Sancerre Rouge 2022' },
      { at:'2026-06-11', actor:'Hawesko GmbH', text:'Submitted to Bottle Lobby for release', scope:'show' },
      { at:'2026-06-15', actor:'Bottle Lobby', text:'Released — full details are now public', scope:'show' },
      { at:'2026-07-28', actor:'Weinhaus Müller', text:'Requested a place at the show' },
      { at:'2026-09-18', actor:'Restaurant Hafenkante', text:'Wrote an order list: 24 × Sancerre Rouge 2022, 12 × Müller-Thurgau — Mosel 2023' },
      { at:'2026-09-18', actor:'Hawesko GmbH', text:'Wrote an order list for Vinoteca Alster: 36 × Sancerre Rouge 2022' } ] },

  { id:'WS-2599', title:'Primavera Italiana', date:'2026-04-12', city:'Munich',
    focus:'Italian spring releases',
    heroImage:'images/duesseldorf-presenter.jpg',
    stage:'completed', leadHost:'Hawesko GmbH',
    reach:['public'],
    applications_open:false, application_deadline:null,
    venueType:'partner_venue', venueEntity:'Weinhaus Müller',
    venueName:'Weinhaus Müller, Munich', venueStatus:'accepted',
    cateringTotal:780, venueQuotedAt:'2026-02-09', venueAcceptedAt:'2026-02-11',
    cateringMode:'host_covers',
    capacity:65,
    attendees:[
      { stakeholder:'Bistro Laurent',  source:'invitation', status:'confirmed', at:'2026-02-20' },
      { stakeholder:'Vinoteca Alster', source:'request',    status:'confirmed', at:'2026-03-01' }
    ],
    exhibitors:[
      /* Two wines from one exhibitor, which A16.4 allows outright, and
         they sit in the two different columns of A16.12: the Primitivo
         is in the distributor's portfolio, the Nero d'Avola is not. */
      { producer:'Cantina Rossi', status:'confirmed', source:'invitation',
        products:[ { productId:'PRD-1003', proposedBy:'host', status:'confirmed',
                     indicativePrice:11.5 },
                   { productId:'PRD-1022', proposedBy:'host', status:'confirmed',
                     indicativePrice:13.9 },
                   /* The thin one, on purpose: six bottles from a single
                      house is exactly the case a host holds back and takes
                      to the producer (A16.12). It belongs to Cantina Rossi
                      rather than a fourth winery so the producer's own side
                      of the negotiation is reachable in the demo — the
                      winery dashboard IS Cantina Rossi. A show where
                      everything clears would demonstrate the closing but
                      never the negotiation. */
                   { productId:'PRD-1001', proposedBy:'host', status:'confirmed',
                     indicativePrice:9.9 } ] }
    ],
    /* The show that gets CLOSED in the demo: it is over (`completed`),
       both columns carry demand, and the two figures are deliberately
       far apart — 54 bottles of pre-order against 78 asked for in all.
       Only the 54 may ever reach the purchase order, and numbers this
       distinguishable are what makes a mix-up visible rather than
       plausible.

       Vinoteca Alster is in no partnership with Hawesko, so their
       prepared order has to wait for one (A6) — the case A16.12
       describes and the reason the show is called an entry point. */
    interests:[
      { attendee:'Bistro Laurent', productId:'PRD-1003',
        qty:18, enteredBy:'attendee', status:'open', at:'2026-04-12' },
      { attendee:'Bistro Laurent', productId:'PRD-1022',
        qty:24, enteredBy:'attendee', status:'open', at:'2026-04-12' },
      { attendee:'Vinoteca Alster', productId:'PRD-1003',
        qty:36, enteredBy:'host', status:'open', at:'2026-04-12' },
      { attendee:'Bistro Laurent', productId:'PRD-1001',
        qty:6, enteredBy:'attendee', status:'open', at:'2026-04-12' }
    ],
    events:[
      { at:'2026-02-02', actor:'Hawesko GmbH', text:'Show created as a draft' },
      { at:'2026-02-06', actor:'Hawesko GmbH', text:'Venue request sent to Weinhaus Müller' },
      { at:'2026-02-09', actor:'Weinhaus Müller', text:'Quoted € 780 for room and catering' },
      { at:'2026-02-11', actor:'Hawesko GmbH', text:"Accepted Weinhaus Müller's offer" },
      { at:'2026-02-19', actor:'Cantina Rossi', text:"Confirmed with Nero d'Avola Sicilia DOC 2022" },
      { at:'2026-03-01', actor:'Bottle Lobby', text:'Released — full details are now public', scope:'show' },
      { at:'2026-04-13', actor:'Bottle Lobby', text:'Show completed', scope:'show' } ] }
];

/* ══════════════════════════════════════════════════════════════════
   MEMBER EVENTS (A16.8, A16.9 `events`)
   ------------------------------------------------------------------
   THE SECOND KIND, AND IT IS A SEPARATE RECORD. `wineShows` and
   `memberEvents` are two truths of two different kinds; the directory
   that shows them together is DERIVED and holds neither (ME-1). No
   show is copied in here, no event is copied into `wineShows`, and no
   surface keeps a third copy of either.

   WHAT SEPARATES THEM IS THE PROMISE, NOT THE SIZE. A Wine Show is a
   Bottle Lobby format: pipeline, contracts, cost release, a stored
   `reviews` row and the platform's guarantee (A16.1). A member event
   is created by a member and PUBLISHED BY THAT MEMBER — no gate, no
   Final Review, no release row, and therefore no guarantee marker
   anywhere on it (ME-3). Bottle Lobby may delist one on moderation
   grounds; that is a moderation act and must never look like a
   release.

   ONE MODEL FOR ALL FOUR ROLES. `host` + `hostRole` is the only thing
   that differs between a distributor's house fair and a restaurant's
   winemaker dinner. There is no per-role event model, and building
   four would be D21 before the fact rather than after.

   Field names follow A16.9's `events` table; the nesting stands in for
   the join tables — `participants` for event_participants (which
   EXTENDS event_invitations, see below), `products` for event_products,
   `log` for the append-only history.

   PARTICIPANTS: ONE TABLE, FIVE FACTS. A16.9 is explicit that
   `event_participants` extends `event_invitations` rather than standing
   beside it — two tables holding the same pair with two status chains
   would be D32 one level down. So an invitation is not a second row: it
   is the ORIGIN of a participant row, recorded as `source:'invitation'`
   with `status:'sent'`. The five facts A16.8 names read off one row:

     invitation   source:'invitation', status 'sent' → 'viewed'
     application  source:'application', status 'applied'
     acceptance   status:'accepted'      (as a participant, in a role)
     RSVP         status:'confirmed'     (as a guest, holding a place)
     attendance   status:'attended' | 'no_show'

   `waitlisted` IS NOT A STORED VALUE, exactly as for a Wine Show
   (D28, A16.10): a place is computed from `requestedAt` against
   `capacity`. Array order is request order, as it is for attendees.

   WINES ARE `productId` REFERENCES AND NOTHING ELSE (ME-6, invariant
   2, A15.2a). A typed wine name here would be a copy of somebody
   else's product record, and tests/member-events.js fails on one.

   REACH is the taxonomy of A16.14b BY REFERENCE — the same eight
   values the shows use, read by the same admission arithmetic in
   bottle-lobby-public-shows.js. There is no event-only level and no
   private one. `invited-only` is not a ninth value: it is `reach:[]`,
   which admits nobody, while the people actually asked reach the event
   through their own participant row.

   `reachCity` / `reachRegion` / `reachCountry` narrow within a level;
   they never widen one.

   `city` IS NOT `reachCity` AND IS NOT A VENUE. A16.9 gives `events` a
   free-text `location` and A16.8 forbids formalising the venue on
   speculation — neither of which says what city the evening is in, and
   A16.14d filters the directory by city in as many words. So the
   record carries the one string that answers it. Where the event
   happens and whom the host wants to reach are two facts: ME-3102 is
   in Frankfurt and narrows to nothing, ME-3101 is in Munich and
   narrows to Munich, and only the second pair happens to agree.

   DATES. Today is 8 Aug 2026 (C7). The two published events sit in the
   coming autumn, the draft in the following spring — a draft that a
   host is still writing is naturally further out than the two he has
   already announced. The `log` rows are bounded by them.
══════════════════════════════════════════════════════════════════ */
let memberEvents = [
  /* A16.8's own first example: "a retailer's vintage presentation with
     the winemaker present". Weinhaus Müller hosts, Cantina Rossi comes
     as the winemaker — and Weinhaus Müller follows Cantina Rossi in
     `wineFollowGraph` (03.05.2026), so the relation the invitation
     rests on already exists in the data rather than being asserted
     here for the first time.

     REACH is `partners` + `community`: an in-store evening is for the
     houses this retailer actually trades with and the ones that follow
     him. Narrowed to Munich, which is Weinhaus Müller's own city — the
     narrowing is honest here because an in-store evening genuinely
     cannot be attended from Copenhagen. */
  { id:'ME-3101', title:'Sicilia — Vintage Presentation with the Winemaker',
    host:'Weinhaus Müller', hostRole:'retail',
    category:'seasonal presentation',
    date:'2026-11-14', time:'18:30', city:'Munich',
    description:'Four Sicilian vintages poured and talked through by the producer, in the shop after hours. ' +
                'Trade guests and regular customers of the house.',
    location:'Weinhaus Müller, Sendlinger Str. 22, 80331 Munich',
    locationEntity:'Weinhaus Müller',
    heroImage:'images/duesseldorf-pouring.jpg',
    status:'published',
    capacity:35,
    reach:['partners','community'],
    reachCountry:'Germany', reachRegion:null, reachCity:'Munich',
    registrationMode:'rsvp',
    applicationsOpen:false, applicationDeadline:null,
    isPaid:false, priceNote:null, externalLink:null,
    moderation:null,
    /* Cantina Rossi's own range, by key. The host names which of the
       producer's wines are poured; he never describes them. */
    products:[ { productId:'PRD-1022' }, { productId:'PRD-1003' },
               { productId:'PRD-1001' }, { productId:'PRD-1004' } ],
    participants:[
      { stakeholder:'Weinhaus Müller', role:'host',      source:'own',        status:'confirmed', requestedAt:'2026-08-03' },
      /* The winemaker: invited, and he accepted. `accepted` is being ON
         the event in a role; `confirmed` below is holding a place as a
         guest. A16.8 keeps them apart on purpose. */
      { stakeholder:'Cantina Rossi',   role:'winemaker', source:'invitation', status:'accepted',  requestedAt:'2026-08-04' },
      { stakeholder:'Hawesko GmbH',    role:'guest',     source:'invitation', status:'confirmed', requestedAt:'2026-08-05' },
      /* Asked, has opened it, has not answered. The state that exists
         so the host can see the difference between silence and a no. */
      { stakeholder:'Bistro Laurent',  role:'guest',     source:'invitation', status:'viewed',    requestedAt:'2026-08-05' }
    ],
    log:[
      { at:'2026-08-03', actor:'Weinhaus Müller', text:'Event created as a draft' },
      { at:'2026-08-04', actor:'Weinhaus Müller', text:'Invitation sent to Cantina Rossi as winemaker' },
      { at:'2026-08-04', actor:'Cantina Rossi',   text:'Accepted as winemaker' },
      { at:'2026-08-05', actor:'Weinhaus Müller', text:'Published to partners and community, Munich', scope:'event' },
      { at:'2026-08-06', actor:'Hawesko GmbH',    text:'RSVP — attending as a guest' } ] },

  /* A16.8's second example: a restaurant's winemaker dinner. Bistro
     Laurent hosts, Henri Dubois Domaine pours — and Hawesko carries
     Henri Dubois (partnership 17.02.2026), so the wines on the table
     are ones this room can actually order afterwards (invariant 3).
     That is provenance, not an order: ME-2 says the evening creates
     none.

     APPLICATIONS ARE OPEN, which is the other shape A16.8 names — "a
     restaurant's Rioja evening where wineries apply as participants".
     Château Belrieu has applied and is waiting; the application is a
     task on the host's side and nothing else has happened because of
     it (ME-2). */
  { id:'ME-3102', title:'Winemaker Dinner — Loire, Five Courses',
    host:'Bistro Laurent', hostRole:'restaurant',
    category:'winemaker dinner',
    date:'2026-10-09', time:'19:00', city:'Frankfurt',
    description:'Five courses against five Loire bottles, with the producer at the table. ' +
                'A second producer may still join — applications are open until the end of September.',
    location:'Bistro Laurent, Bockenheimer Landstr. 12, 60323 Frankfurt am Main',
    locationEntity:'Bistro Laurent',
    heroImage:'images/hamburg-tasting-room.jpg',
    status:'published',
    capacity:24,
    /* `public` ADDED IN DURCHGANG 9, and this row is the one place it
       is honest: this is A16.8's paid END-CUSTOMER evening, and the
       external booking link's audience is by definition not the
       membership — a consumer dinner announced only to members and
       wineries advertises to everyone except the people meant to book
       it. The original pair stays: `members` finds the trade guests,
       `wineries` the appliers. Reach is a multi-select and every entry
       permits (A16.14b), so nothing narrows by this.
       It is also, deliberately, the ONE public member event: the
       anonymous Wine Guide directory (A16.14d) has a member-event card
       to show because a member event really is public, not because a
       fixture was reclassified for test coverage.

       THE GERMANY NARROWING IS GONE IN THE SAME BREATH, and the row's
       own documentation had already decided that: the `city` note
       above describes ME-3102 as the event that "narrows to nothing"
       — the stored country was the one field contradicting it. A
       narrowing fails every viewer without a known location, the
       anonymous reader first of all (eventNarrowsOut, the protective
       direction), so `public` beside a country narrowing would be a
       reach no reader can ever pass. People travel to a five-course
       dinner as they travel to a harvest (ME-3105's own argument). */
    reach:['public','members','wineries'],
    reachCountry:null, reachRegion:null, reachCity:null,
    registrationMode:'application',
    applicationsOpen:true, applicationDeadline:'2026-09-30',
    /* A16.8's paid end-customer case, and deliberately the whole of it:
       a flag, a price note and an off-platform link. No checkout, no
       consumer account, no ticket record anywhere (ME-7). */
    isPaid:true, priceNote:'€ 95 per guest, wines included — booked with the restaurant directly',
    externalLink:'https://bistro-laurent.example/winemaker-dinner',
    moderation:null,
    products:[ { productId:'PRD-1015' }, { productId:'PRD-1014' }, { productId:'PRD-1020' } ],
    participants:[
      { stakeholder:'Bistro Laurent',        role:'host',        source:'own',         status:'confirmed', requestedAt:'2026-07-20' },
      { stakeholder:'Henri Dubois Domaine',  role:'winemaker',   source:'invitation',  status:'accepted',  requestedAt:'2026-07-22' },
      { stakeholder:'Hawesko GmbH',          role:'sponsor',     source:'invitation',  status:'accepted',  requestedAt:'2026-07-24' },
      /* APPLIED, and it stops there. No participant role is granted, no
         place is held, no order exists — the row says "asked to be let
         in" and the host has not answered (ME-2). */
      { stakeholder:'Château Belrieu',       role:'participant', source:'application', status:'applied',   requestedAt:'2026-08-01' },
      { stakeholder:'Vinstuen København',    role:'guest',       source:'invitation',  status:'declined',  requestedAt:'2026-07-25' }
    ],
    log:[
      { at:'2026-07-20', actor:'Bistro Laurent',       text:'Event created as a draft' },
      { at:'2026-07-22', actor:'Bistro Laurent',       text:'Invitation sent to Henri Dubois Domaine as winemaker' },
      { at:'2026-07-23', actor:'Henri Dubois Domaine', text:'Accepted as winemaker' },
      { at:'2026-07-26', actor:'Bistro Laurent',       text:'Published to public, members and wineries', scope:'event' },
      { at:'2026-07-26', actor:'Bistro Laurent',       text:'Opened for applications until 30 Sep 2026' },
      { at:'2026-08-01', actor:'Château Belrieu',      text:'Applied to take part' } ] },

  /* THE DISTRIBUTOR'S OWN TWO, because the first full cockpit is built
     on his dashboard (A16.8, D21) and a cockpit with nothing in two of
     its three lists demonstrates nothing.

     Published: the house fair from A16.8's distributor row. Reach is
     `partners` + `restaurants` + `retail` — his own trade, plus the two
     buying roles he wants in the room. No `public`: a trade fair for
     one distributor's customers is not a public announcement. */
  { id:'ME-3103', title:'Hanseatic House Fair — Autumn Portfolio',
    host:'Hawesko GmbH', hostRole:'distributor',
    category:'house fair',
    date:'2026-09-24', time:'11:00', city:'Hamburg',
    description:'The full autumn portfolio open all day, producers present at their own tables. ' +
                'For customers of the house and the restaurants and retailers we work with.',
    location:'Speicherstadt Kesselhaus, Am Sandtorkai 30, 20457 Hamburg',
    locationEntity:null,
    heroImage:'images/hamburg-glasses.jpg',
    status:'published',
    capacity:120,
    reach:['partners','restaurants','retail'],
    reachCountry:'Germany', reachRegion:null, reachCity:null,
    registrationMode:'rsvp',
    applicationsOpen:false, applicationDeadline:null,
    isPaid:false, priceNote:null, externalLink:null,
    moderation:null,
    products:[ { productId:'PRD-1022' }, { productId:'PRD-1013' },
               { productId:'PRD-1020' }, { productId:'PRD-1024' } ],
    participants:[
      { stakeholder:'Hawesko GmbH',         role:'host',        source:'own',        status:'confirmed', requestedAt:'2026-06-15' },
      { stakeholder:'Cantina Rossi',        role:'exhibitor',   source:'invitation', status:'accepted',  requestedAt:'2026-06-18' },
      { stakeholder:'Domaine Lefèvre',      role:'exhibitor',   source:'invitation', status:'accepted',  requestedAt:'2026-06-18' },
      { stakeholder:'Henri Dubois Domaine', role:'exhibitor',   source:'invitation', status:'sent',      requestedAt:'2026-06-18' },
      { stakeholder:'Bistro Laurent',       role:'guest',       source:'invitation', status:'confirmed', requestedAt:'2026-06-22' },
      { stakeholder:'Weinhaus Müller',      role:'guest',       source:'invitation', status:'confirmed', requestedAt:'2026-06-23' },
      { stakeholder:'Osteria Marconi',      role:'guest',       source:'invitation', status:'viewed',    requestedAt:'2026-06-23' }
    ],
    log:[
      { at:'2026-06-15', actor:'Hawesko GmbH',    text:'Event created as a draft' },
      { at:'2026-06-18', actor:'Hawesko GmbH',    text:'Invitations sent to three producers as exhibitors' },
      { at:'2026-06-19', actor:'Cantina Rossi',   text:'Accepted as exhibitor' },
      { at:'2026-06-19', actor:'Domaine Lefèvre', text:'Accepted as exhibitor' },
      { at:'2026-06-25', actor:'Hawesko GmbH',    text:'Published to partners, restaurants and retail', scope:'event' } ] },

  /* THE DRAFT, and the cockpit needs one: `draft` is on no directory at
     all, so this is the row that proves the Discover list is filtered
     by status rather than merely sorted by it. Its reach is already
     chosen — a host picks the audience while writing, and publishing is
     what makes the choice bite. */
  { id:'ME-3104', title:'Own Label Presentation — Spring Lines',
    host:'Hawesko GmbH', hostRole:'distributor',
    category:'own-label presentation',
    date:'2027-03-11', time:'17:00', city:'Tornesch',
    description:'First pour of the spring own-label lines for the restaurants and retailers carrying them.',
    location:'Hawesko GmbH, Tornesch',
    locationEntity:'Hawesko GmbH',
    heroImage:'images/duesseldorf-tasting-wide.jpg',
    status:'draft',
    capacity:40,
    reach:['partners'],
    reachCountry:'Germany', reachRegion:null, reachCity:null,
    registrationMode:'rsvp',
    applicationsOpen:false, applicationDeadline:null,
    isPaid:false, priceNote:null, externalLink:null,
    moderation:null,
    products:[],
    participants:[
      { stakeholder:'Hawesko GmbH', role:'host', source:'own', status:'confirmed', requestedAt:'2026-08-07' }
    ],
    log:[
      { at:'2026-08-07', actor:'Hawesko GmbH', text:'Event created as a draft' } ] },

  /* THE WINERY'S OWN, AND IT IS THE ONE ROW THE ROLLOUT NEEDED. When
     the cockpit went to all four roles, three of them already hosted
     something — Weinhaus Müller has ME-3101, Bistro Laurent has
     ME-3102, Hawesko has two. The winery hosted nothing, so its
     cockpit would have demonstrated the empty state and nothing else.
     One row, and only one: A16.8's winery examples are estate
     occasions, and a second would have been decoration.

     WHY IT DOES NOT NARROW GEOGRAPHICALLY. `reach` is partners +
     community — this estate's distributors and the houses that follow
     it — and every one of those is in Germany or northern Italy. An
     Alcamo narrowing would have been honest about the address and
     wrong about the audience: people travel to a harvest, which is
     exactly the case ME-3101's Munich narrowing is NOT (an in-store
     evening cannot be attended from Copenhagen). Two events, two
     answers, and the field is what carries the difference.

     WEINHAUS MÜLLER IS ASKED AND HAS NOT ANSWERED. That is not
     decoration either: it is the one open invitation on the retail
     side, and it is what makes "accept · decline · RSVP" reachable
     from a cockpit that is not the host's. Hawesko has answered and
     holds a place, so the two states sit side by side on one record.

     Today is 8 Aug 2026 (C7); a Sicilian harvest is September, and the
     log rows are bounded by both. */
  { id:'ME-3105', title:'Harvest Days in Contrada Ferla',
    host:'Cantina Rossi', hostRole:'winery',
    category:'harvest event',
    date:'2026-09-19', time:'10:00', city:'Alcamo',
    description:'Two days in the vineyard and the cellar during the harvest: the Nero d\'Avola coming in, ' +
                'the 2023 whites out of steel, and the Riserva tasted from barrel. For the houses that ' +
                'carry these wines and the ones that follow the estate.',
    location:'Cantina Rossi, Contrada Ferla, 91011 Alcamo TP',
    locationEntity:'Cantina Rossi',
    heroImage:'images/lebanon-vineyard.jpg',
    status:'published',
    capacity:30,
    reach:['partners','community'],
    reachCountry:null, reachRegion:null, reachCity:null,
    registrationMode:'rsvp',
    applicationsOpen:false, applicationDeadline:null,
    isPaid:false, priceNote:null, externalLink:null,
    moderation:null,
    /* The estate's own wines, by key. A producer naming his own range
       is still a reference and never a description (ME-6). */
    products:[ { productId:'PRD-1003' }, { productId:'PRD-1004' },
               { productId:'PRD-1002' }, { productId:'PRD-1007' } ],
    participants:[
      { stakeholder:'Cantina Rossi',   role:'host',  source:'own',        status:'confirmed', requestedAt:'2026-07-28' },
      { stakeholder:'Hawesko GmbH',    role:'guest', source:'invitation', status:'confirmed', requestedAt:'2026-07-30' },
      /* Asked, nothing answered. The row the retail cockpit acts on. */
      { stakeholder:'Weinhaus Müller', role:'guest', source:'invitation', status:'sent',      requestedAt:'2026-08-04' }
    ],
    log:[
      { at:'2026-07-28', actor:'Cantina Rossi', text:'Event created as a draft' },
      { at:'2026-07-30', actor:'Cantina Rossi', text:'Invitation sent to Hawesko GmbH as guest' },
      { at:'2026-07-31', actor:'Hawesko GmbH',  text:'RSVP — attending as a guest' },
      { at:'2026-08-02', actor:'Cantina Rossi', text:'Published to partners and community', scope:'event' },
      { at:'2026-08-04', actor:'Cantina Rossi', text:'Invitation sent to Weinhaus Müller as guest' } ] }
];
