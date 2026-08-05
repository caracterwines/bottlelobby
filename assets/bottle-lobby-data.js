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

   THE GAP WAS MEASURED, AND IT IS NOT ONE GAP BUT TWO. Six of the
   seven — PRD-1020 … PRD-1025 — carry `status:'Own-Label'` in the
   public Wine Guide and an `active`/`pending` `legacyOwnLabel` on
   their listing. Two independent sources, the same six wines, the
   same boundary. A17.9 says an own-label product is visible to the
   producing winery, the exclusive distributor and Bottle Lobby and to
   nobody else; this pool is what every buyer browses. Adding those
   six here would not complete a catalogue, it would break A17.9 —
   which tests/wine-shows.js already found once and said so.

   PRD-1026 is the seventh and the only one with no own-label claim
   anywhere: 'Standard' in the Guide, `legacyOwnLabel:false` on its
   listing. It is added below. The other six stay out ON PURPOSE, and
   HANDOFF carries why — the open question is not whether to loosen
   A17.9 but whether all six are own labels at all. */
const partnerWinesPool = [
  { id:'PRD-1001', winery:'Cantina Rossi', name:'Catarratto Biologico', vintage:2023, type:'White', note:'Organic', origin:'Sicilia DOC, Sicily', url:'bottle-lobby-wine-catarratto-biologico.html', at:'2025-03-14' },
  { id:'PRD-1002', winery:'Cantina Rossi', name:'Grillo Sicilia DOC', vintage:2023, type:'White', note:'Own-Label Available', origin:'Sicilia DOC, Sicily', url:'bottle-lobby-wine-grillo-sicilia-doc.html', at:'2025-04-02' },
  { id:'PRD-1003', winery:'Cantina Rossi', name:"Nero d'Avola Sicilia DOC", vintage:2022, type:'Red', note:'Own-Label Available', origin:'Sicilia DOC, Sicily', url:'bottle-lobby-wine-nero-davola-sicilia-doc.html', at:'2025-05-20' },
  { id:'PRD-1004', winery:'Cantina Rossi', name:'Primitivo Riserva', vintage:2020, type:'Red', note:'Riserva · Premium Tier', origin:'Alcamo DOC, Sicily', url:'bottle-lobby-wine-primitivo-riserva.html', at:'2025-02-11' },
  { id:'PRD-1005', winery:'Cantina Rossi', name:'Rosato di Sicilia', vintage:2023, type:'Rosé', note:'Own-Label Available', origin:'Sicilia DOC, Sicily', url:'bottle-lobby-wine-rosato-di-sicilia.html', at:'2025-06-09' },
  { id:'PRD-1006', winery:'Cantina Rossi', name:'Rosso di Contrada', vintage:2023, type:'Red', note:'Standard', origin:'Sicilia DOC, Sicily', url:'bottle-lobby-wine-rosso-di-contrada.html', at:'2025-09-16' },
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
  { id:'PRD-1027', winery:'Cantina Rossi', name:'Terra Rossa', vintage:2022, type:'Red', note:'Standard', origin:'Sicilia DOC, Sicily', url:'bottle-lobby-wine-terra-rossa.html', at:'2025-07-22' },
  { id:'PRD-1007', winery:'Cantina Rossi', name:'Trinacria Bianco', vintage:2023, type:'White', note:'Standard', origin:'Terre Siciliane IGT, Sicily', url:'bottle-lobby-wine-trinacria-bianco.html', at:'2025-11-04' },
  /* The two deliberate ones: added AFTER somebody started following. */
  { id:'PRD-1008', winery:'Cantina Rossi', name:'Baglio Rosso', vintage:2021, type:'Red', note:'Standard', origin:'Terre Siciliane IGT, Sicily', url:'bottle-lobby-wine-baglio-rosso.html', at:'2026-04-20' },
  { id:'PRD-1009', winery:'Cantina Rossi', name:'Costa Bianca', vintage:2023, type:'White', note:'Standard', origin:'Terre Siciliane IGT, Sicily', url:'bottle-lobby-wine-costa-bianca.html', at:'2026-05-28' },
  { id:'PRD-1010', winery:'Domaine Lefèvre', name:'Bourgogne Passetoutgrain', vintage:2023, type:'Red', note:'Standard', origin:'Bourgogne Passetoutgrain AOC, France', url:'bottle-lobby-wine-bourgogne-passetoutgrain.html', at:'2025-10-07' },
  { id:'PRD-1011', winery:'Domaine Lefèvre', name:'Crémant de Bourgogne', vintage:2022, type:'White', note:'Standard', origin:'Crémant de Bourgogne AOC, France', url:'bottle-lobby-wine-cremant-de-bourgogne.html', at:'2025-08-19' },
  { id:'PRD-1012', winery:'Domaine Lefèvre', name:'Bourgogne Aligoté', vintage:2023, type:'White', note:'Standard', origin:'Bourgogne Aligoté AOC, France', url:'bottle-lobby-wine-bourgogne-aligote.html', at:'2026-01-15' },
  { id:'PRD-1013', winery:'Domaine Lefèvre', name:'Mâcon-Villages', vintage:2023, type:'White', note:'Standard', origin:'Mâcon-Villages AOC, France', url:'bottle-lobby-wine-macon-villages.html', at:'2026-02-26' },
  { id:'PRD-1014', winery:'Henri Dubois Domaine', name:'Sancerre Rouge', vintage:2022, type:'Red', note:'Standard', origin:'Sancerre AOC, Loire Valley', url:'bottle-lobby-wine-sancerre-rouge.html', at:'2025-07-03' },
  { id:'PRD-1015', winery:'Henri Dubois Domaine', name:'Pouilly-Fumé', vintage:2023, type:'White', note:'Standard', origin:'Pouilly-Fumé AOC, Loire Valley', url:'bottle-lobby-wine-pouilly-fume.html', at:'2025-12-08' },
  { id:'PRD-1016', winery:'Bodegas Ruiz', name:'Rioja Reserva', vintage:2019, type:'Red', note:'Standard', origin:'Rioja DOCa, Spain', url:'bottle-lobby-wine-rioja-reserva.html', at:'2025-09-10' },
  { id:'PRD-1017', winery:'Bodegas Ruiz', name:'Rioja Blanco', vintage:2023, type:'White', note:'Standard', origin:'Rioja DOCa, Spain', url:'bottle-lobby-wine-rioja-blanco.html', at:'2026-06-20' },
  { id:'PRD-1018', winery:'Weingut Schmitt', name:'Müller-Thurgau — Mosel', vintage:2023, type:'White', note:'Standard', origin:'Mosel QbA, Germany', url:'bottle-lobby-wine-muller-thurgau-mosel.html', at:'2026-07-25' },
  { id:'PRD-1019', winery:'Weingut Schmitt', name:'Spätburgunder — Mosel', vintage:2022, type:'Red', note:'Standard', origin:'Mosel QbA, Germany', url:'bottle-lobby-wine-spatburgunder-mosel.html', at:'2026-01-22' },

  /* ── Château Belrieu — the producer's first catalogue row ────────
     Backfilled under A3, and the same shape as Terra Rossa above: the
     wine has an article page, a public Wine Guide entry and a line in
     three profile books, and only the producer's catalogue did not
     carry it. A3 adds the missing record.

     WHY THIS ONE AND NOT THE OTHER SIX. It is the only one of the
     seven that claims no own label anywhere — Guide 'Standard',
     `legacyOwnLabel:false`. The six that do are held back; see the
     header above and HANDOFF.

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
  { id:'PRD-1026', winery:'Château Belrieu', name:'Château Belrieu Grand Vin', vintage:2019, type:'Red', note:'Standard', origin:'Bordeaux Supérieur AOC, Bordeaux', url:'bottle-lobby-wine-chateau-belrieu-grand-vin.html', at:'2025-10-28' }
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

let wineShows = [
  { id:'WS-2604', title:'Sicilia Prima', date:'2027-03-14', city:'Frankfurt',
    focus:'Sicilian indigenous varieties for the on-trade',
    heroImage:'images/hamburg-glasses.jpg',
    stage:'draft', leadHost:'Hawesko GmbH',
    venueType:'partner_venue', venueEntity:'Bistro Laurent',
    venueName:'Bistro Laurent, Frankfurt', venueStatus:'requested',
    capacity:60, exhibitors:[], attendees:[],
    events:[
      { at:'2026-07-30', actor:'Hawesko GmbH', text:'Show created as a draft' },
      { at:'2026-07-30', actor:'Hawesko GmbH', text:'Venue request sent to Bistro Laurent' } ] },

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
    venueType:'partner_venue', venueEntity:'Vinstuen København',
    venueName:'Vinstuen København, Copenhagen', venueStatus:'quoted',
    cateringTotal:1250, venueQuotedAt:'2026-07-27',
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
      { at:'2026-07-21', actor:'Hawesko GmbH', text:'Submitted to Bottle Lobby for release', scope:'show' },
      { at:'2026-07-24', actor:'Hawesko GmbH', text:'Venue request sent to Vinstuen København' },
      { at:'2026-07-27', actor:'Vinstuen København', text:'Quoted € 1,250 for room and catering' } ] },

  { id:'WS-2603', title:'Loire & Mosel', date:'2026-09-18', city:'Hamburg',
    focus:'Cool-climate whites, two rivers',
    heroImage:'images/hamburg-tasting-room.jpg',
    stage:'published', leadHost:'Hawesko GmbH',
    venueType:'host_premises', venueEntity:null,
    venueName:'Hawesko Tasting Loft, Hamburg', venueStatus:'not_required',
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
    venueType:'partner_venue', venueEntity:'Weinhaus Müller',
    venueName:'Weinhaus Müller, Munich', venueStatus:'accepted',
    cateringTotal:780, venueQuotedAt:'2026-02-09', venueAcceptedAt:'2026-02-11',
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
