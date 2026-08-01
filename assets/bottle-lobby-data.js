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
  { id:'WS-2604', title:'Sicilia Prima', date:'14 Mar 2027', city:'Frankfurt',
    focus:'Sicilian indigenous varieties for the on-trade',
    heroImage:'images/hamburg-glasses.jpg',
    stage:'draft', leadHost:'Hawesko GmbH',
    venueType:'partner_venue', venueEntity:'Bistro Laurent',
    venueName:'Bistro Laurent, Frankfurt', venueStatus:'requested',
    capacity:60, exhibitors:[], attendees:[],
    events:[
      { at:'30 Jul 2026', actor:'Hawesko GmbH', text:'Show created as a draft' },
      { at:'30 Jul 2026', actor:'Hawesko GmbH', text:'Venue request sent to Bistro Laurent' } ] },

  { id:'WS-2601', title:'Grande Rioja', date:'05 Dec 2026', city:'Düsseldorf',
    focus:'Premium reds from Rioja and Sicily',
    heroImage:'images/duesseldorf-tasting-wide.jpg',
    stage:'planning', leadHost:'Hawesko GmbH',
    venueType:'host_premises', venueEntity:null,
    venueName:'Hawesko Tasting Loft, Hamburg', venueStatus:'not_required',
    capacity:80,
    attendees:[
      { stakeholder:'Vinstuen København', source:'invitation', status:'confirmed', at:'20 Jul 2026' },
      { stakeholder:'Bistro Laurent',     source:'invitation', status:'invited',   at:'29 Jul 2026' }
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
      { at:'12 Jul 2026', actor:'Hawesko GmbH', text:'Show created as a draft' },
      { at:'14 Jul 2026', actor:'Hawesko GmbH', text:'Bodegas Ruiz invited with Rioja Reserva 2019' },
      { at:'17 Jul 2026', actor:'Bodegas Ruiz', text:'Confirmed with Rioja Reserva 2019' },
      { at:'17 Jul 2026', actor:'Hawesko GmbH', text:'Confirmed Rioja Reserva 2019 for Bodegas Ruiz' },
      { at:'17 Jul 2026', actor:'Bottle Lobby', text:'Venue, exhibitor and product confirmed — show moved to Planning' },
      { at:'24 Jul 2026', actor:'Hawesko GmbH', text:'Weingut Schmitt invited — no wine proposed' },
      { at:'26 Jul 2026', actor:'Weingut Schmitt', text:'Proposed Spätburgunder — Mosel 2022' },
      { at:'28 Jul 2026', actor:'Hawesko GmbH', text:'Cantina Rossi invited with Primitivo Riserva 2020' },
      { at:'29 Jul 2026', actor:'Hawesko GmbH', text:'Bistro Laurent invited to attend' } ] },

  { id:'WS-2602', title:'Nordic Selection', date:'22 Jan 2027', city:'Copenhagen',
    focus:'Mediterranean whites for Scandinavian kitchens',
    heroImage:'images/duesseldorf-pouring.jpg',
    stage:'pending_approval', leadHost:'Hawesko GmbH',
    venueType:'partner_venue', venueEntity:'Vinstuen København',
    venueName:'Vinstuen København, Copenhagen', venueStatus:'quoted',
    cateringTotal:1250, venueQuotedAt:'27 Jul 2026',
    capacity:50, attendees:[],
    exhibitors:[
      { producer:'Cantina Rossi', status:'confirmed', source:'invitation',
        products:[ { name:'Grillo Sicilia DOC 2023', proposedBy:'producer', status:'confirmed' } ] },
      { producer:'Henri Dubois Domaine', status:'confirmed', source:'invitation',
        products:[ { name:'Pouilly-Fumé 2023', proposedBy:'host', status:'confirmed' } ] }
    ],
    events:[
      { at:'02 Jul 2026', actor:'Hawesko GmbH', text:'Show created as a draft' },
      { at:'08 Jul 2026', actor:'Cantina Rossi', text:'Confirmed with Grillo Sicilia DOC 2023 instead of the proposed wine' },
      { at:'09 Jul 2026', actor:'Henri Dubois Domaine', text:'Confirmed with Pouilly-Fumé 2023' },
      { at:'21 Jul 2026', actor:'Hawesko GmbH', text:'Submitted to Bottle Lobby for release' },
      { at:'24 Jul 2026', actor:'Hawesko GmbH', text:'Venue request sent to Vinstuen København' },
      { at:'27 Jul 2026', actor:'Vinstuen København', text:'Quoted € 1,250 for room and catering' } ] },

  { id:'WS-2603', title:'Loire & Mosel', date:'18 Sep 2026', city:'Hamburg',
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
      { stakeholder:'Bistro Laurent',        source:'invitation', status:'confirmed', at:'02 Jun 2026' },
      { stakeholder:'Restaurant Hafenkante', source:'request',    status:'confirmed', at:'09 Jun 2026' },
      { stakeholder:'Vinoteca Alster',       source:'request',    status:'confirmed', at:'14 Jun 2026' },
      { stakeholder:'Weinhaus Müller',       source:'request',    status:'requested', at:'28 Jul 2026' }
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
        qty:24, enteredBy:'attendee', status:'open', at:'18 Sep 2026' },
      { attendee:'Restaurant Hafenkante', product:'Müller-Thurgau — Mosel 2023',
        qty:12, enteredBy:'attendee', status:'open', at:'18 Sep 2026' },
      { attendee:'Vinoteca Alster', product:'Sancerre Rouge 2022',
        qty:36, enteredBy:'host', status:'open', at:'18 Sep 2026' }
    ],
    events:[
      { at:'20 May 2026', actor:'Hawesko GmbH', text:'Show created as a draft' },
      { at:'02 Jun 2026', actor:'Weingut Schmitt', text:'Confirmed with Müller-Thurgau — Mosel 2023' },
      { at:'04 Jun 2026', actor:'Henri Dubois Domaine', text:'Confirmed with Sancerre Rouge 2022' },
      { at:'11 Jun 2026', actor:'Hawesko GmbH', text:'Submitted to Bottle Lobby for release' },
      { at:'15 Jun 2026', actor:'Bottle Lobby', text:'Released — full details are now public' },
      { at:'28 Jul 2026', actor:'Weinhaus Müller', text:'Requested a place at the show' },
      { at:'18 Sep 2026', actor:'Restaurant Hafenkante', text:'Wrote an order list: 24 × Sancerre Rouge 2022, 12 × Müller-Thurgau — Mosel 2023' },
      { at:'18 Sep 2026', actor:'Hawesko GmbH', text:'Wrote an order list for Vinoteca Alster: 36 × Sancerre Rouge 2022' } ] },

  { id:'WS-2599', title:'Primavera Italiana', date:'12 Apr 2026', city:'Munich',
    focus:'Italian spring releases',
    heroImage:'images/duesseldorf-presenter.jpg',
    stage:'completed', leadHost:'Hawesko GmbH',
    venueType:'partner_venue', venueEntity:'Weinhaus Müller',
    venueName:'Weinhaus Müller, Munich', venueStatus:'accepted',
    cateringTotal:780, venueQuotedAt:'09 Feb 2026', venueAcceptedAt:'11 Feb 2026',
    capacity:65,
    attendees:[
      { stakeholder:'Bistro Laurent',  source:'invitation', status:'confirmed', at:'20 Feb 2026' },
      { stakeholder:'Vinoteca Alster', source:'request',    status:'confirmed', at:'01 Mar 2026' }
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
        qty:18, enteredBy:'attendee', status:'open', at:'12 Apr 2026' },
      { attendee:'Bistro Laurent', product:'Primitivo Sicilia IGT 2022',
        qty:24, enteredBy:'attendee', status:'open', at:'12 Apr 2026' },
      { attendee:'Vinoteca Alster', product:"Nero d'Avola Sicilia DOC 2022",
        qty:36, enteredBy:'host', status:'open', at:'12 Apr 2026' },
      { attendee:'Bistro Laurent', product:'Catarratto Biologico 2023',
        qty:6, enteredBy:'attendee', status:'open', at:'12 Apr 2026' }
    ],
    events:[
      { at:'02 Feb 2026', actor:'Hawesko GmbH', text:'Show created as a draft' },
      { at:'06 Feb 2026', actor:'Hawesko GmbH', text:'Venue request sent to Weinhaus Müller' },
      { at:'09 Feb 2026', actor:'Weinhaus Müller', text:'Quoted € 780 for room and catering' },
      { at:'11 Feb 2026', actor:'Hawesko GmbH', text:"Accepted Weinhaus Müller's offer" },
      { at:'19 Feb 2026', actor:'Cantina Rossi', text:"Confirmed with Nero d'Avola Sicilia DOC 2022" },
      { at:'01 Mar 2026', actor:'Bottle Lobby', text:'Released — full details are now public' },
      { at:'13 Apr 2026', actor:'Bottle Lobby', text:'Show completed' } ] }
];
