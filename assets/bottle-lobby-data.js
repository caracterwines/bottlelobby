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
   dashboard), never product content — A16.9, invariant 2. */
let wineShows = [
  { id:'WS-2604', title:'Sicilia Prima', date:'14 Mar 2027', city:'Hamburg',
    focus:'Sicilian indigenous varieties for the on-trade',
    heroImage:'images/hamburg-glasses.jpg',
    stage:'draft', leadHost:'Hawesko GmbH',
    venueType:'host_premises', venueName:'Hawesko Tasting Loft, Hamburg',
    capacity:60, exhibitors:[],
    events:[ { at:'30 Jul 2026', actor:'Hawesko GmbH', text:'Show created as a draft' } ] },

  { id:'WS-2601', title:'Grande Rioja', date:'05 Dec 2026', city:'Düsseldorf',
    focus:'Premium reds from Rioja and Sicily',
    heroImage:'images/duesseldorf-tasting-wide.jpg',
    stage:'planning', leadHost:'Hawesko GmbH',
    venueType:'host_premises', venueName:'Hawesko Tasting Loft, Hamburg',
    capacity:80,
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
      { at:'28 Jul 2026', actor:'Hawesko GmbH', text:'Cantina Rossi invited with Primitivo Riserva 2020' } ] },

  { id:'WS-2602', title:'Nordic Selection', date:'22 Jan 2027', city:'Copenhagen',
    focus:'Mediterranean whites for Scandinavian kitchens',
    heroImage:'images/duesseldorf-pouring.jpg',
    stage:'pending_approval', leadHost:'Hawesko GmbH',
    venueType:'host_premises', venueName:'Hawesko Nordic Office, Copenhagen',
    capacity:50,
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
      { at:'21 Jul 2026', actor:'Hawesko GmbH', text:'Submitted to Bottle Lobby for release' } ] },

  { id:'WS-2603', title:'Loire & Mosel', date:'18 Sep 2026', city:'Hamburg',
    focus:'Cool-climate whites, two rivers',
    heroImage:'images/hamburg-tasting-room.jpg',
    stage:'published', leadHost:'Hawesko GmbH',
    venueType:'host_premises', venueName:'Hawesko Tasting Loft, Hamburg',
    capacity:70,
    exhibitors:[
      { producer:'Henri Dubois Domaine', status:'confirmed', source:'invitation',
        products:[ { name:'Sancerre Rouge 2022', proposedBy:'host', status:'confirmed' } ] },
      { producer:'Weingut Schmitt', status:'confirmed', source:'invitation',
        products:[ { name:'Müller-Thurgau — Mosel 2023', proposedBy:'host', status:'confirmed' } ] }
    ],
    events:[
      { at:'20 May 2026', actor:'Hawesko GmbH', text:'Show created as a draft' },
      { at:'02 Jun 2026', actor:'Weingut Schmitt', text:'Confirmed with Müller-Thurgau — Mosel 2023' },
      { at:'04 Jun 2026', actor:'Henri Dubois Domaine', text:'Confirmed with Sancerre Rouge 2022' },
      { at:'11 Jun 2026', actor:'Hawesko GmbH', text:'Submitted to Bottle Lobby for release' },
      { at:'15 Jun 2026', actor:'Bottle Lobby', text:'Released — full details are now public' } ] },

  { id:'WS-2599', title:'Primavera Italiana', date:'12 Apr 2026', city:'Munich',
    focus:'Italian spring releases',
    heroImage:'images/duesseldorf-presenter.jpg',
    stage:'completed', leadHost:'Hawesko GmbH',
    venueType:'host_premises', venueName:'Hawesko Süd, Munich',
    capacity:65,
    exhibitors:[
      { producer:'Cantina Rossi', status:'confirmed', source:'invitation',
        products:[ { name:"Nero d'Avola Sicilia DOC 2022", proposedBy:'host', status:'confirmed' } ] }
    ],
    events:[
      { at:'02 Feb 2026', actor:'Hawesko GmbH', text:'Show created as a draft' },
      { at:'19 Feb 2026', actor:'Cantina Rossi', text:"Confirmed with Nero d'Avola Sicilia DOC 2022" },
      { at:'01 Mar 2026', actor:'Bottle Lobby', text:'Released — full details are now public' },
      { at:'13 Apr 2026', actor:'Bottle Lobby', text:'Show completed' } ] }
];
