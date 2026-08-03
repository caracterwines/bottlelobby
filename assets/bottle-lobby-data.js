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
        products:[ { name:'Spätburgunder — Mosel 2022', proposedBy:'host', status:'confirmed' } ] } ],
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
        products:[ { name:'Rioja Reserva 2019', proposedBy:'host', status:'confirmed' } ] },
      /* Producer proposed, host has not answered — the host is at turn. */
      { producer:'Weingut Schmitt', status:'confirmed', source:'invitation',
        products:[ { name:'Spätburgunder — Mosel 2022', proposedBy:'producer', status:'proposed' } ] },
      { producer:'Cantina Rossi', status:'invited', source:'invitation',
        products:[ { name:'Primitivo Riserva 2020', proposedBy:'host', status:'proposed' } ] }
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
        products:[ { name:'Grillo Sicilia DOC 2023', proposedBy:'producer', status:'confirmed' } ] },
      { producer:'Henri Dubois Domaine', status:'confirmed', source:'invitation',
        products:[ { name:'Pouilly-Fumé 2023', proposedBy:'host', status:'confirmed' } ] }
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
        products:[ { name:'Sancerre Rouge 2022', proposedBy:'host', status:'confirmed',
                     indicativePrice:14.5 } ] },
      { producer:'Weingut Schmitt', status:'confirmed', source:'invitation',
        products:[ { name:'Müller-Thurgau — Mosel 2023', proposedBy:'host', status:'confirmed',
                     indicativePrice:8.9 } ] }
    ],
    /* Two houses have written a list, a third has not yet — so the
       tally shows something and the demo still has an empty seat to
       fill by hand. */
    interests:[
      { attendee:'Restaurant Hafenkante', product:'Sancerre Rouge 2022',
        qty:24, enteredBy:'attendee', status:'open', at:'2026-09-18' },
      { attendee:'Restaurant Hafenkante', product:'Müller-Thurgau — Mosel 2023',
        qty:12, enteredBy:'attendee', status:'open', at:'2026-09-18' },
      { attendee:'Vinoteca Alster', product:'Sancerre Rouge 2022',
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
        products:[ { name:"Nero d'Avola Sicilia DOC 2022", proposedBy:'host', status:'confirmed',
                     indicativePrice:11.5 },
                   { name:'Primitivo Sicilia IGT 2022', proposedBy:'host', status:'confirmed',
                     indicativePrice:13.9 },
                   /* The thin one, on purpose: six bottles from a single
                      house is exactly the case a host holds back and takes
                      to the producer (A16.12). It belongs to Cantina Rossi
                      rather than a fourth winery so the producer's own side
                      of the negotiation is reachable in the demo — the
                      winery dashboard IS Cantina Rossi. A show where
                      everything clears would demonstrate the closing but
                      never the negotiation. */
                   { name:'Catarratto Biologico 2023', proposedBy:'host', status:'confirmed',
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
      { attendee:'Bistro Laurent', product:"Nero d'Avola Sicilia DOC 2022",
        qty:18, enteredBy:'attendee', status:'open', at:'2026-04-12' },
      { attendee:'Bistro Laurent', product:'Primitivo Sicilia IGT 2022',
        qty:24, enteredBy:'attendee', status:'open', at:'2026-04-12' },
      { attendee:'Vinoteca Alster', product:"Nero d'Avola Sicilia DOC 2022",
        qty:36, enteredBy:'host', status:'open', at:'2026-04-12' },
      { attendee:'Bistro Laurent', product:'Catarratto Biologico 2023',
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
