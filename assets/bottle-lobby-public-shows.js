/* ══════════════════════════════════════════════════════════════════
   BOTTLE LOBBY — THE PUBLIC VIEW OF A WINE SHOW
   ------------------------------------------------------------------
   The one renderer for what a non-participant is allowed to see. The
   dashboard uses it to preview both levels side by side; the public
   Wine Shows page and the public profiles will render the very same
   function.

   There must never be a second implementation. Two renderers would be
   two answers to "what may this visitor see", and A16.6 is the rule
   that protects an invited producer from appearing in public before
   accepting — a rule that only holds if it is enforced in one place.

   Requires bottle-lobby-data.js to be loaded first, and — for the level
   a real visitor gets — nothing else: the level is computed from the
   show's own stage, never stored (A16.10).

   Classic script, not a module. See the note in bottle-lobby-data.js.
════════════════════════════════════════════════════════════════════ */

/* Who counts as an exhibitor in public: those who have said yes. An
   invited-but-unanswered producer is deliberately absent from every
   public surface (A16.6). */
function confirmedExhibitors(show) {
  return show.exhibitors.filter(e => e.status === 'confirmed');
}

/* The photo a card leads with (A16.9 `hero_image_url`). A show created
   before the field existed, or saved without a choice, still renders. */
function showHeroImage(show) {
  return show.heroImage || SHOW_HERO_FALLBACK;
}

/* ══ THE CARD SHELL'S IMAGE AREA — ONE LOGIC, TWO STATES (DIR-3) ══ */
/* Every card sort in the directory leads with the same area, and the
   area has exactly two answers: the record's picture, or — where the
   MODEL gives the record no picture at all — a typographic band saying
   what kind of thing this is.

   THE SECOND STATE IS THE MEASURED ONE, and it is why this is one
   function rather than three inline <img> tags. Hero media are their
   own pass: a fair edition and a fair participation have no image
   field and will not get one here. The two ways round that would both
   be worse than the band — an empty grey frame reads as a picture that
   failed to load, and borrowing SHOW_HERO_FALLBACK would put a
   photograph of somebody else's tasting room on a stranger's fair and
   call it theirs (A1, one step before the data even exists).

   `alt` is passed through as the callers always passed it, unescaped,
   so the two existing card sorts emit byte-identical markup; the band,
   which is new, goes through the one escaper. */
function cardHeroHtml(cls, image, alt, band) {
  if (image) return '<img class="' + cls + '" src="' + image + '" alt="' + alt + '">';
  return '<div class="' + cls + ' bl-hero-band"><span>' + notifEsc(band || '') + '</span></div>';
}

/* Which shows a visitor may see listed at all, and in what order.
   `planning` is listed because that is where recruiting happens and an
   anonymised listing names nobody (A16.6, D38): a show is here as soon
   as its host's basics stand. `draft` is absent because it has not even
   those. `pending_approval` is absent because a show under Final Review
   is a show being decided on, and `changes_requested` is one being
   reworked — neither is a state to show the public. Nothing is fully
   public before Bottle Lobby releases it (A16.1). */
const PUBLIC_UPCOMING_STAGES = ['planning', 'published'];
const PUBLIC_PAST_STAGES     = ['completed'];
function showListable(show) {
  return PUBLIC_UPCOMING_STAGES.indexOf(show.stage) !== -1 ||
         PUBLIC_PAST_STAGES.indexOf(show.stage) !== -1;
}

/* ══ REACH — WHO MAY FIND THE SHOW (A16.14a/b) ═══════════════════ */
/* THE PLATFORM'S REACH TAXONOMY, DEFINED EXACTLY ONCE, and it lives
   here rather than in the dashboard because this is the file that
   answers "what may this visitor see" — the taxonomy and its reader
   in one place, or they drift like any other pair of copies. Wine
   Shows, member events (A16.8), own-label visibility (A17.13a) and
   campaigns (A16.14e) all REFERENCE this list; none redefines the
   levels and none adds a private one.

   'partners' = active business relations (the Network nav section).
   'community' = the follow side (My Stars / My Fans). The generic
   value 'network' deliberately does not exist: that word names a nav
   section and a section key and may not also name a reach level (D39).
   'matchmaking' is deliberately absent too — named in the interface,
   shown locked, with its reason on screen, until A8 exists (C2). */
const REACH_LEVELS = ['public','members','wineries','distributors',
                      'restaurants','retail','partners','community'];

/* The dashboard's role names are not the taxonomy's. One map, here,
   beside the values it maps onto — a second one anywhere else would be
   a second answer to which audience a role belongs to. */
const REACH_ROLE_VALUE = {
  winery:'wineries', distributor:'distributors',
  restaurant:'restaurants', retail:'retail'
};

/* THE VIEWER, and the reason this whole section is one function: a
   class-1 surface has to answer "may THIS reader find this show" for a
   role, for a named house, and for somebody who is neither. Three
   questions with three answers would be three places to get it wrong,
   so they are one question with one shape.

   `entity` is the house, `role` its dashboard role. An anonymous
   visitor has neither, and that is not a special case — it is simply
   the viewer that matches no role and appears in nobody's books. */
const SHOW_ANON = { entity:null, role:null };
function showViewer(entity, role) {
  return { entity: entity || null, role: role || null };
}

/* Deduplicated on the way out: a house in two selected groups sees the
   show once, and an accidental duplicate in the data changes nothing.
   A show with no reach at all is found by nobody — the protective
   direction, and the host cockpit says so in words. */
function showReach(show) {
  if (!Array.isArray(show.reach)) return [];
  const seen = {}, out = [];
  show.reach.forEach(function (v) { if (!seen[v]) { seen[v] = 1; out.push(v); } });
  return out;
}

/* Whose show it is (WS-2). Not an audience — the host and the people
   who have said yes ARE the show, and no reach setting may lock them
   out of it. A venue that has only been ASKED is deliberately absent:
   it is not a confirmed participant, and it reaches the show through
   its own direct relation, which is a class-2 route.

   Membership only. Nothing here is ever rendered, or it would be the
   name disclosure A16.6 forbids before `published`. */
function showParties(show) {
  const out = [show.leadHost];
  confirmedExhibitors(show).forEach(function (e) { out.push(e.producer); });
  (show.attendees || []).forEach(function (a) {
    if (a.status === 'confirmed') out.push(a.stakeholder);
  });
  if (show.venueEntity && show.venueStatus === 'accepted') out.push(show.venueEntity);
  return out;
}

/* `partnerships` and `wineFollowGraph` are top-level `let`s in the
   dashboard — and a top-level `let` in a classic script is NOT a
   property of `window`, so this file cannot reach them by name. The
   page hands them over, exactly as it hands its state to BLStore and
   for exactly the same JS fact. GETTERS, never the arrays: a captured
   array is a copy of a binding and goes stale the moment the store
   restores a snapshot over it (invariant 1, applied to ourselves).

   A public page registers nothing, and that is not a degraded answer:
   an anonymous visitor has no entity, so 'partners' and 'community'
   could never have admitted them anyway. Absent book, empty book. */
const REACH_BOOKS = {
  partnerships: function () { return []; },
  follows:      function () { return []; },
  /* Where a house sits, for the geographic narrowing member events add
     on top of the levels (A16.8). See eventNarrowsOut(): an absent book
     answers null, and null fails a narrowing rather than passing it. */
  viewerCity:   function () { return null; }
};
function registerReachBooks(map) {
  Object.keys(map).forEach(function (k) {
    if (typeof map[k] !== 'function')
      throw new Error('registerReachBooks: "' + k + '" needs a getter');
    REACH_BOOKS[k] = map[k];
  });
}
/* 'partners' resolves over the HOST's active business relations, read
   from both ends of the one partnership row (A6). */
function hostPartners(host) {
  return (REACH_BOOKS.partnerships() || []).filter(function (p) {
    return p.distributor === host || p.partner === host;
  }).map(function (p) { return p.distributor === host ? p.partner : p.distributor; });
}
/* 'community' is the host's follow side — the houses that follow them
   (My Fans) and the houses they follow (My Stars), A7. */
function hostCommunity(host) {
  const out = [];
  (REACH_BOOKS.follows() || []).forEach(function (f) {
    if (f.winery === host)   out.push(f.follower);
    if (f.follower === host) out.push(f.winery);
  });
  return out;
}

/* EVERY ENTRY PERMITS; NONE FORBIDS. There is no precedence and no
   self-contradicting combination, which is exactly why reach is a
   multi-select and not a ladder — so this is an `.some()` over the
   selected values and can never be anything else. An unknown value
   permits nothing rather than everything: the safe direction for a
   level this code has not been taught yet.

   IT TAKES A HOST, NOT A SHOW, and that is the whole of what member
   events needed from this function (A16.14b: the taxonomy is
   referenced, never redefined). It only ever read `show.leadHost`, so
   widening the parameter is a rename rather than a generalisation —
   and it is what stops a second admission arithmetic from being
   written for the second event kind. One taxonomy, one reader, two
   kinds of record asking it. */
function reachAdmits(host, level, viewer) {
  switch (level) {
    case 'public':       return true;
    case 'members':      return !!viewer.role;
    case 'wineries':
    case 'distributors':
    case 'restaurants':
    case 'retail':       return REACH_ROLE_VALUE[viewer.role] === level;
    case 'partners':     return !!viewer.entity &&
                                hostPartners(host).indexOf(viewer.entity) !== -1;
    case 'community':    return !!viewer.entity &&
                                hostCommunity(host).indexOf(viewer.entity) !== -1;
    default:             return false;
  }
}

/* ONE DERIVATION FOR EVERY CLASS-1 SURFACE (A16.14a): the Wine Shows
   page, the public profiles, the follow feed, the regional
   notification and the dashboards' Discover lists all ask this and
   nothing else. A second implementation would be a second answer to
   "may this reader find this show", and the day the two disagree is
   the day the quieter one is wrong.

   The order of the three gates is the rule, in order:

     1. THE STAGE. `draft`, `pending_approval` and `changes_requested`
        are on no public or directory surface at all. That is not reach
        and no reach value reopens it.
     2. WS-2. Within a listed stage the host and the confirmed
        participants always find their own show.
     3. WS-3. From `published` the reach FALLS AWAY. A released show
        stands on the open website, and filtering a public URL for
        members is a promise the URL cannot keep. Reach may still order
        a directory — it never gates the route.

   Only then does reach decide, and EXCLUDED MEANS INVISIBLE: the
   caller drops the show entirely. No greyed card, no count, no
   placeholder — an anonymised tile reads "something is happening here,
   and not with you", which in a competitive trade is information in
   itself (WS-4). */
function showVisibleTo(show, viewer) {
  viewer = viewer || SHOW_ANON;
  if (!showListable(show)) return false;
  if (viewer.entity && showParties(show).indexOf(viewer.entity) !== -1) return true;
  if (publicLevelFor(show) === 'full') return true;
  return showReach(show).some(function (l) { return reachAdmits(show.leadHost, l, viewer); });
}

/* ══ MEMBER EVENTS — THE SECOND KIND (A16.8) ═════════════════════ */
/* THE SISTER OF showVisibleTo(), AND IT IS A SISTER RATHER THAN A
   GENERALISATION FOR ONE REASON, WHICH IS THE THIRD GATE.

   What the two kinds SHARE is everything below the gates: the reach
   taxonomy (REACH_LEVELS), the role map, the books, and reachAdmits()
   itself. A16.14b says the levels are defined once and referenced;
   nothing here defines a level, adds one, or reads a second list.

   What they do NOT share is the order and the meaning of the gates:

     1. LISTABLE. A show's listable stages are `planning` and
        `published`, because `planning` is where recruiting happens.
        An event has no recruiting stage — `draft` is the host still
        writing, and it is on no directory at all.
     2. THE PARTIES. A show's are host, confirmed exhibitors, confirmed
        attendees and an accepted venue. An event's are its host and
        whoever is actually on it. Same rule (WS-2's: you cannot be
        locked out of your own event), different membership.
     3. AND THIS ONE IS INVERTED. WS-3 makes reach fall away from
        `published`, because a RELEASED SHOW STANDS ON THE OPEN
        WEBSITE — Bottle Lobby put it there, and filtering a public URL
        for members is a promise the URL cannot keep.

        A member event's `published` is not that act. The host
        published it himself; nobody released anything and no
        guarantee was given (A16.8, ME-3). So the stored reach GOES ON
        DECIDING after publication, and an event that named only its
        partners stays unfindable by everybody else for good. Folding
        this into showVisibleTo() with a `kind` flag would put the two
        opposite answers inside one branch, and the branch would be
        read as an accident within a week.

   `invited-only` is not a ninth reach value: it is `reach:[]`, which
   admits nobody, while the houses actually asked reach the event
   through gate 2. A level that means "nobody except" would be a
   private level, and A16.14b forbids adding one. */
const EVENT_UPCOMING_STATUS = ['published', 'postponed'];
const EVENT_PAST_STATUS     = ['completed'];

/* Delisting is a MODERATION act (A16.8). It takes the event off every
   directory surface and it writes nothing into `reviews` — that
   register carries release semantics, and a moderation decision
   wearing a release row would be the very confusion ME-3 exists to
   prevent. The record keeps its own `moderation` field and its own log
   line, and reads as what it is. */
function eventListable(ev) {
  if (ev.moderation && ev.moderation.status === 'delisted') return false;
  return EVENT_UPCOMING_STATUS.indexOf(ev.status) !== -1 ||
         EVENT_PAST_STATUS.indexOf(ev.status) !== -1;
}

/* Whose event it is. `sent` and `viewed` are deliberately NOT here: a
   house that has merely been asked has not joined anything, and it
   reaches the invitation through its own relation rather than through
   the directory. Membership only — nothing here is ever rendered. */
const EVENT_ON_IT = ['accepted', 'confirmed', 'attended'];
function eventParties(ev) {
  const out = [ev.host];
  (ev.participants || []).forEach(function (p) {
    if (EVENT_ON_IT.indexOf(p.status) !== -1) out.push(p.stakeholder);
  });
  return out;
}

/* Geographic narrowing (A16.8), and it NARROWS — it never widens. A
   level that did not admit this viewer is not rescued by them being in
   the right city.

   The viewer's city comes from a registered book for the same JS
   reason the partnership book exists: `stakeholders` is a top-level
   `let` in the dashboard and not a property of `window`. A public page
   registers nothing, so an absent book answers `undefined` — and an
   unknown city fails a narrowing rather than passing it. That is the
   protective direction and it is also the honest one: `stakeholders`
   records `city` only where it is actually known, so "no city" is a
   real state of the data, not a lookup failure to route around. */
function eventNarrowsOut(ev, viewer) {
  if (!ev.reachCity && !ev.reachRegion && !ev.reachCountry) return false;
  const here = viewer.entity ? REACH_BOOKS.viewerCity(viewer.entity) : null;
  if (ev.reachCity)   return !here || here.city    !== ev.reachCity;
  if (ev.reachRegion) return !here || here.region  !== ev.reachRegion;
  return !here || here.country !== ev.reachCountry;
}

function eventReach(ev) {
  if (!Array.isArray(ev.reach)) return [];
  const seen = {}, out = [];
  ev.reach.forEach(function (v) { if (!seen[v]) { seen[v] = 1; out.push(v); } });
  return out;
}

function eventVisibleTo(ev, viewer) {
  viewer = viewer || SHOW_ANON;
  if (!eventListable(ev)) return false;
  if (viewer.entity && eventParties(ev).indexOf(viewer.entity) !== -1) return true;
  if (eventNarrowsOut(ev, viewer)) return false;
  return eventReach(ev).some(function (l) { return reachAdmits(ev.host, l, viewer); });
}

/* Upcoming soonest first, past most recent first — publicShows()' own
   shape, over the second collection. Nothing else is shared: the two
   lists stay two lists and are only ever joined by a caller that wants
   a directory, which is what "the directory is derived" means (ME-1). */
function visibleEvents(all, past, viewer) {
  const statuses = past ? EVENT_PAST_STATUS : EVENT_UPCOMING_STATUS;
  return (all || []).filter(function (e) {
    return statuses.indexOf(e.status) !== -1 && eventVisibleTo(e, viewer);
  }).sort(function (a, b) {
    return past ? blDateValue(b.date) - blDateValue(a.date)
                : blDateValue(a.date) - blDateValue(b.date);
  });
}

/* A place at a member event, computed and never stored — the same
   arithmetic as a Wine Show's, over `requestedAt` against `capacity`
   (A16.10, D28). Only a CONFIRMED guest consumes a place, or a host
   could fill his own room by inviting sixty people who never replied. */
function eventTakenPlaces(ev) {
  return (ev.participants || []).filter(function (p) {
    return p.role === 'guest' && p.status === 'confirmed';
  }).length;
}
function eventFreePlaces(ev) {
  return Math.max(0, (ev.capacity || 0) - eventTakenPlaces(ev));
}

/* ONE date formatter, and it lives here because this is the file every
   surface loads — the dashboard and all 16 public pages. The dashboard
   had `orderDate()` and the public pages had nothing, printing the raw
   field instead; that worked only while the raw field happened to be
   readable prose. It no longer is, and adding a second formatter to
   the asset would be the same mistake one layer down (C9's "one
   formatter, not four"). `orderDate()` in the dashboard now delegates
   here, so its call sites did not have to move.

   Accepts either format and returns the display form. An unreadable
   value comes back unchanged rather than as "Invalid Date" — B12: what
   we know is the string we were given. */
function blDate(v) {
  if (!v) return '—';
  var iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (!iso) return v;
  var d = new Date(v + 'T00:00:00');
  if (isNaN(d)) return v;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/* Sorting needs the date parsed. Returns a comparable yyyymmdd number;
   an unreadable date sorts last rather than throwing.

   BOTH FORMATS, and the ISO branch comes first. This function used to
   match the display form alone — "05 Dec 2026" — and silently returned
   MAX_SAFE_INTEGER for anything else. That is the dangerous shape: an
   ISO date would not have crashed here, it would have sorted every
   show to the end and quietly reordered the public "What's Coming"
   list. Widening the reader BEFORE the data moves is the whole point;
   the other order leaves the sort broken in between, and broken
   without a symptom. */
/* THE COMPARATOR TAKES THE DATE, and the two record kinds each pass
   their own field in. Member events sort by exactly this arithmetic
   (A16.14d sorts one derived directory by date), and a second parser
   for the second kind would be the fourth copy of blDate()'s own
   lesson — a sort that disagrees with itself across two card sorts in
   one list is worse than one that is simply wrong. */
function blDateValue(raw) {
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  raw = raw || '';
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (iso) return Number(iso[1]) * 10000 + Number(iso[2]) * 100 + Number(iso[3]);
  const m = /^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})$/.exec(raw);
  if (!m) return Number.MAX_SAFE_INTEGER;
  const mi = MONTHS.indexOf(m[2]);
  if (mi === -1) return Number.MAX_SAFE_INTEGER;
  return Number(m[3]) * 10000 + (mi + 1) * 100 + Number(m[1]);
}
function showDateValue(show) { return blDateValue(show.date); }
/* Upcoming soonest first; past most recent first — and only what this
   viewer may find at all (A16.14b). `viewer` defaults to the anonymous
   one, so the public Wine Shows page and the fifteen public profiles
   get the strangers' answer without asking for it, and a dashboard
   surface has to say who is reading before it gets more.

   SORTING IS BY DATE AND STAYS BY DATE. Reach may order a directory
   (A16.14b) — it is a placement input, never an access one, and the
   day it becomes an ordering input it must not quietly become the
   other thing here. */
function publicShows(all, past, viewer) {
  const stages = past ? PUBLIC_PAST_STAGES : PUBLIC_UPCOMING_STAGES;
  return all.filter(s => stages.indexOf(s.stage) !== -1 && showVisibleTo(s, viewer))
            .sort((a, b) => past ? showDateValue(b) - showDateValue(a)
                                 : showDateValue(a) - showDateValue(b));
}

/* ══ A SHOW ON SOMEBODY'S PROFILE (A16.7) ════════════════════════ */
/* A16.7 puts a show on the public profile of every participant. A16.6
   decides which of them may be named, and the two have to be read
   together — so this returns the role a given entity may be SHOWN as,
   or null.

   The host may always be shown. A show in `planning` is publicly
   listed under its host's name, and the host is the one announcing it;
   nothing in A16.6 protects them.

   An exhibitor may be shown only from `published` — even once they
   have confirmed. That looks like an inconsistency and is the whole
   mechanism: an anonymised show is publicly listed under its title, so
   a profile saying "Exhibiting at Grande Rioja" would give away what
   the Wine Shows page withholds. Anonymisation holds across surfaces
   or it holds nowhere.

   Spec: A16.6, "Anonymisation holds across every surface at once", and
   the role table in A16.7. Read those before loosening this. */
function publicParticipation(show, entity) {
  if (!showListable(show)) return null;
  if (show.leadHost === entity) return 'host';
  if (publicLevelFor(show) !== 'full') return null;
  return confirmedExhibitors(show).some(e => e.producer === entity) ? 'exhibitor' : null;
}
const PARTICIPATION_LABEL = { host: 'Hosting', exhibitor: 'Exhibiting' };

/* Everything a profile page needs: the shows this entity may be seen
   at, split the way A16.7 asks for them — "upcoming and, after
   `completed`, as history". */
/* A profile page is a class-1 surface, so the reader's reach decides
   here too: a profile may not become the way round an exclusion. The
   filter is publicShows()' own, applied twice on the same list. */
function publicShowsForEntity(all, entity, viewer) {
  const mine = all.filter(s => publicParticipation(s, entity));
  return {
    upcoming: publicShows(mine, false, viewer),
    past:     publicShows(mine, true,  viewer)
  };
}

/* ══ THE CARD (A16.7) ════════════════════════════════════════════ */
/* Hero image, date, city, title, focus — the whole of what A16.6
   grants at the anonymised level, so one card serves both levels. The
   note is the point rather than an apology: an invited producer who has
   not yet accepted is being protected, and saying so turns a gap in the
   listing into the reason to trust it. */
function publicShowTeaser(show, level, role) {
  const past = PUBLIC_PAST_STAGES.indexOf(show.stage) !== -1;
  /* The member's note leads with the recruiting state where there is
     one: a directory whose cards all read the same sentence makes the
     one show that is actually looking for exhibitors invisible in the
     only sense that matters. */
  const note = level === 'anonymised'
    ? 'Exhibitors are named once they have accepted — never before.'
    : level === 'member'
      ? (show.applications_open ? showApplicationsLine(show)
                                : confirmedExhibitors(show).length + ' exhibitor(s) confirmed · ' +
                                  showFreePlaces(show) + ' place(s) left')
      : (past ? 'This show has taken place.' : 'Exhibitors, wines and venue confirmed.');
  /* Only set on a profile, where the question is what THIS account did
     at the show; on the Wine Shows page there is no such subject. */
  const chip = role && PARTICIPATION_LABEL[role]
    ? '<span class="ws-teaser-role">' + PARTICIPATION_LABEL[role] + '</span>' : '';

  /* `bl-expand` / `bl-expand-more` are the NEUTRAL hooks of the one
     expand interaction (DIR-3) — they carry no promise and no styling
     of their own, which is exactly why the fair card may wear them
     while `ws-teaser` stays a Wine Show's alone (SHOW_CARD_CLASSES). */
  return '<button type="button" class="ws-teaser bl-expand' + (past ? ' past' : '') + '">' +
    cardHeroHtml('ws-teaser-hero', showHeroImage(show), show.title) +
    '<div class="ws-teaser-body">' +
      '<div class="ws-public-date">' + blDate(show.date) + ' · ' + show.city + chip + '</div>' +
      '<div class="ws-public-title">' + show.title + '</div>' +
      '<div class="ws-public-focus">' + show.focus + '</div>' +
      '<div class="ws-teaser-foot">' +
        '<span class="ws-teaser-note">' + note + '</span>' +
        '<span class="ws-teaser-more bl-expand-more">Full listing →</span>' +
      '</div>' +
    '</div>' +
  '</button>';
}

/* ══ THE TWO VISIBILITY LEVELS (A16.6) ═══════════════════════════ */
/* One function, two levels, computed from the single show record —
   never two stored versions (A16.10). */
function publicShowCard(show, level) {
  const head =
    '<div class="ws-public-date">' + blDate(show.date) + ' · ' + show.city + '</div>' +
    '<div class="ws-public-title">' + show.title + '</div>' +
    '<div class="ws-public-focus">' + show.focus + '</div>';

  if (level === 'anonymised') {
    return '<div class="ws-public">' + head +
      '<div class="ws-public-hidden">Exhibitors, their wines and the exact venue stay hidden until Bottle&nbsp;Lobby releases the show. ' +
      'An invited producer must not appear in public before accepting — a later decline would read as a withdrawal.</div>' +
      '<div class="ws-public-line" style="margin-top:0.9rem">Join Bottle&nbsp;Lobby to see the shape of this show — ' +
      'venue status, capacity, how many exhibitors are confirmed and whether it is taking applications.</div>' +
    '</div>';
  }

  /* THE MEMBER LEVEL (A16.6, A16.14a). Every figure below is a COUNT or
     a STATUS. Read the list once more before adding to it: the moment
     one line here resolves to a name, the anonymisation is gone — and
     it is gone on every surface at once, because they all render from
     this one function. */
  if (level === 'member') {
    const kv = (k, v) => '<div class="ws-public-line"><b>' + k + '</b> · ' + v + '</div>';
    const free = showFreePlaces(show);
    return '<div class="ws-public">' + head +
      '<div style="margin-top:0.9rem">' +
        kv('Host', show.leadHost) +
        kv('Venue', showVenueStatusLine(show)) +
        kv('Capacity', show.capacity + ' guests') +
        kv('Places left', free + (free ? '' : ' — the room is full')) +
        kv('Exhibitors confirmed', confirmedExhibitors(show).length) +
        kv('Applications', showApplicationsLine(show)) +
      '</div>' +
      '<div class="ws-public-hidden" style="margin-top:0.9rem">Counts, not names. Who is exhibiting, ' +
      'what they are pouring and the exact venue are named when Bottle&nbsp;Lobby releases the show — ' +
      'a producer who has been invited but has not answered must not appear anywhere before they accept.</div>' +
    '</div>';
  }

  const exh = confirmedExhibitors(show);
  const lines = exh.length
    ? exh.map(e => '<div class="ws-public-line"><b>' + e.producer + '</b> — ' +
        (e.products.filter(p => p.status === 'confirmed').map(p => wineLabel(p.productId)).join(', ') || 'wines to be announced') +
      '</div>').join('')
    : '<div class="ws-public-line">Exhibitors to be announced.</div>';

  return '<div class="ws-public">' + head +
    '<div class="ws-public-line" style="margin-top:0.9rem"><b>Venue</b> · ' + show.venueName + '</div>' +
    '<div class="ws-public-line"><b>Capacity</b> · ' + show.capacity + ' guests</div>' +
    '<div style="margin-top:0.9rem;padding-top:0.8rem;border-top:1px solid rgba(247,243,238,0.08)">' + lines + '</div>' +
  '</div>';
}
/* THREE LEVELS, not two (A16.6). The stage decides whether anything is
   released at all; below that, WHO IS READING decides how much of the
   SHAPE of the show is legible. A show that is meant to recruit has to
   show a member enough to want in, and a stranger less than that.

   The anonymisation is unchanged in both cases, and that is the whole
   point of the split: a member sees COUNTS, never IDENTITIES. Nothing
   at the member level names an exhibitor, an applicant or an invitee
   (WS-1) — it names the shape of the room, not the people in it. */
function publicLevelFor(show, viewer) {
  if (show.stage === 'published' || show.stage === 'completed') return 'full';
  return (viewer && viewer.role) ? 'member' : 'anonymised';
}

/* THE VENUE STATUS WITHOUT THE VENUE. A16.14a grants a member the
   status and withholds the place "before venue_accepted", and the two
   halves of that sentence are one rule: a restaurant that has only been
   ASKED must not be announced as the venue — a later decline would read
   as a withdrawal, which is A16.6's own argument about producers.

   The host's own premises are status-only too. They need no third
   party's consent, but they are still the exact venue of an anonymised
   show, and A16.6 withholds that from everyone until `published`. */
function showVenueStatusLine(show) {
  if (show.venueStatus === 'accepted') return show.venueName;
  if (show.venueType !== 'partner_venue') return 'The host\'s own premises';
  if (show.venueStatus === 'requested')   return 'A partner venue has been asked — not settled yet';
  if (show.venueStatus === 'quoted')      return 'A partner venue has quoted — not settled yet';
  if (show.venueStatus === 'declined')    return 'The venue asked has declined — another is being sought';
  return 'Not settled yet';
}

/* Places left, computed from the same arithmetic the seat queue uses:
   only CONFIRMED attendees consume capacity, or a host could fill their
   own room by inviting sixty people who never replied (A16.5, A16.10). */
function showFreePlaces(show) {
  const taken = (show.attendees || []).filter(a => a.status === 'confirmed').length;
  return Math.max(0, (show.capacity || 0) - taken);
}

/* One sentence for the recruiting state, and it says the closed case
   out loud. A show that is not taking applications and a show whose
   field was never set look identical in the data; a blank line would
   let a reader assume the first. */
function showApplicationsLine(show) {
  if (!show.applications_open) return 'Not open for applications';
  return show.application_deadline
    ? 'Open for applications until ' + blDate(show.application_deadline)
    : 'Open for applications';
}

/* ══ MOUNTING (A16.7) ════════════════════════════════════════════ */
/* Cards into a container, each with its full listing folded behind it,
   and the toggle wired. Shared by the Wine Shows page and all fifteen
   public profiles: the interaction is part of what the card IS, and
   fifteen copies of it would drift the same way fifteen copies of the
   renderer would.

   `entity`, when given, makes the card say what that account did at
   the show — the profile case. `viewer` says who is reading, which is
   what decides between the anonymised and the member level; omitting
   it is the strangers' answer, which is what the public pages want.
   Returns how many were rendered. */
/* The cell and its wiring, factored so the derived directory below can
   DELEGATE to them rather than carry a second copy of the show cell —
   a fourth renderer of the A16.6 promise is always the one that
   discloses something the others do not. */
function showCellHtml(s, entity, viewer) {
  const level = publicLevelFor(s, viewer);
  const id = 'ws-listing-' + s.id + (entity ? '-' + entity.replace(/\W+/g, '') : '');
  const role = entity ? publicParticipation(s, entity) : null;
  return '<div class="ws-cell">' +
    publicShowTeaser(s, level, role).replace('<button type="button"',
      '<button type="button" aria-expanded="false" aria-controls="' + id + '"') +
    '<div class="ws-listing" id="' + id + '">' + publicShowCard(s, level) + '</div>' +
  '</div>';
}
/* THE ONE EXPAND INTERACTION, FOR EVERY CARD SORT THAT HAS ONE
   (DIR-3). One handler per card rather than one on the container: the
   cards are buttons, and a delegated listener would have to re-derive
   which one was hit.

   IT SELECTS ON A NEUTRAL CLASS, and that is the whole of the O5
   generalisation. The alternative — a second toggle beside this one
   for the fair card — is the copy DIR-3 forbids, and it is the kind
   of copy that stays right for about a week. The alternative in the
   other direction, renaming `.ws-teaser` into a neutral shell class,
   was measured and rejected: SHOW_CARD_CLASSES names ws-teaser,
   ws-public and ws-listing as the WINE SHOW GUARANTEE MARKERS, so
   dissolving them would dissolve the contract ME-3 rests on and give
   every other sort the show's own coat. The shell is shared exactly
   where it carries no promise.

   The closed label is read off the button rather than typed here, so
   each sort keeps its own wording and the open state is the one thing
   this function decides. */
function wireExpandableCards(host) {
  Array.prototype.forEach.call(host.querySelectorAll('.bl-expand'), function (btn) {
    const label = btn.querySelector('.bl-expand-more');
    const shut  = label ? label.textContent : '';
    btn.addEventListener('click', function () {
      const panel = btn.nextElementSibling;
      const open = panel.classList.toggle('open');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (label) label.textContent = open ? 'Close ↑' : shut;
    });
  });
}
function mountShowCards(host, list, entity, viewer) {
  if (!host) return 0;
  host.innerHTML = list.map(function (s) { return showCellHtml(s, entity, viewer); }).join('');
  wireExpandableCards(host);
  return list.length;
}

/* ══ THE MEMBER-EVENT CARD (A16.14d, ME-3) ═══════════════════════ */
/* "Cards are reused, never copied. Wine Shows keep their card; member
   events get a MATCHING one that must not assert the Bottle Lobby
   guarantee." Matching, not identical — and the difference is the
   point of the whole section: a reviewed, platform-released show and a
   self-published event may sit in one list and MAY NOT MAKE THE SAME
   PROMISE (A16.8).

   So this is a second card sort with its own marker and its own
   markup, deliberately not the show teaser with different words in it.
   The guarantee a Wine Show sells is what a member event borrowing its
   look would spend, and a look is borrowed by reusing a class long
   before anybody rewrites a sentence.

   THE MARKERS BELOW ARE THE MEASUREMENT. They are the phrases and the
   classes by which the show card asserts the platform's promise, named
   here rather than typed into a harness, so the rule is checked
   against what the show card ACTUALLY says (C7: a contract test over
   vocabulary). Add a guarantee phrase to publicShowCard() and add it
   here in the same breath — tests/member-events.js asserts the event
   card carries none of them. */
const SHOW_GUARANTEE_MARKERS = [
  'Bottle&nbsp;Lobby releases the show',
  'Exhibitors, wines and venue confirmed.'
];
const SHOW_CARD_CLASSES = ['ws-teaser', 'ws-public', 'ws-listing'];

/* THE NON-RELEASE WORDING, from the A16.8 box, in one place because it
   appears in two: on the card here, and at the publish act in the host
   cockpit. A host reads it before he publishes and a reader reads it
   on the result — the same sentence, or the two drift and one of them
   becomes the reassuring version. */
const MEMBER_EVENT_DISCLAIMER =
  'A member event, published by its host. Bottle Lobby neither reviews nor releases it ' +
  'and gives no guarantee for it — that is what a Wine Show is and this is not.';

/* ══ WHO MAY BE NAMED ON THE CARD (ME-5, D42) ════════════════════ */
/* A confirmed `winemaker` or `exhibitor` may be named on the public
   surfaces of a PUBLISHED member event — after their explicit
   acceptance and never before it. Everybody else stays a head count:
   applicants, unanswered invitations, guests, sponsors and general
   participants appear on no public surface (before acceptance a name
   lives only in the invitee's own view and the host's, which are
   cockpit panes, not cards).

   The status gate is eventListable(): `published`, `postponed` and
   `completed` are all states the HOST has published, `draft` is on no
   directory, and a delisted event renders no card at all. The naming
   is a permission the acceptance carries — it is NOT the Bottle Lobby
   release vocabulary, and the card's disclaimer stands unchanged
   beside it (ME-3). */
const EVENT_NAMEABLE_ROLES  = ['winemaker', 'exhibitor'];
const EVENT_NAMEABLE_STATUS = ['accepted', 'attended'];
function eventNamedLineup(ev) {
  if (!eventListable(ev)) return [];
  return (ev.participants || []).filter(function (p) {
    return EVENT_NAMEABLE_ROLES.indexOf(p.role) !== -1 &&
           EVENT_NAMEABLE_STATUS.indexOf(p.status) !== -1;
  });
}

function memberEventCard(ev) {
  const free = eventFreePlaces(ev);
  const named = eventNamedLineup(ev);
  const lineup = named.length
    ? '<div class="me-card-lineup">' + named.map(function (p) {
        return 'With <b>' + p.stakeholder + '</b> — ' + p.role;
      }).join(' · ') + '</div>'
    : '';
  const note = ev.applicationsOpen
    ? (ev.applicationDeadline
        ? 'Open for applications until ' + blDate(ev.applicationDeadline)
        : 'Open for applications')
    : (ev.registrationMode === 'rsvp'
        ? free + ' place(s) left of ' + (ev.capacity || 0)
        : 'By invitation');
  const paid = ev.isPaid && ev.priceNote
    ? '<div class="me-card-paid">' + ev.priceNote + '</div>' : '';

  return '<div class="me-card">' +
    cardHeroHtml('me-card-hero', ev.heroImage || SHOW_HERO_FALLBACK, ev.title) +
    '<div class="me-card-body">' +
      /* THE MARKER. It leads, before the date and the title, because a
         reader scanning a mixed directory decides what kind of thing
         he is looking at first and reads the rest second. */
      '<div class="me-card-kind"><span class="me-kind-dot"></span>Member Event</div>' +
      '<div class="me-card-date">' + blDate(ev.date) + (ev.city ? ' · ' + ev.city : '') + '</div>' +
      '<div class="me-card-title">' + ev.title + '</div>' +
      '<div class="me-card-host">Hosted by ' + ev.host + '</div>' +
      lineup +
      '<div class="me-card-note">' + note + '</div>' +
      paid +
      '<div class="me-card-disclaim">' + MEMBER_EVENT_DISCLAIMER + '</div>' +
    '</div>' +
  '</div>';
}

/* Cards into a container, the mountShowCards() shape for the second
   kind. No fold-out listing: everything a member event grants a reader
   is on the card, because there is no anonymisation to unfold — that
   mechanism protects an invited producer at a show under review, and
   an event under review does not exist. Returns how many were
   rendered. */
function eventCellHtml(ev) {
  return '<div class="me-cell" data-event-id="' + ev.id + '">' + memberEventCard(ev) + '</div>';
}
function mountEventCards(host, list) {
  if (!host) return 0;
  host.innerHTML = list.map(eventCellHtml).join('');
  return list.length;
}

/* ══ THE DERIVED DIRECTORY (A16.14d, DIR-1..DIR-3) ═══════════════ */
/* Wine Guide → Events: ONE mixed, chronological list over FOUR record
   sorts since O5 — Wine Shows, member events, published fair editions
   and publicly released fair participations. It is a COMPOSITION, not
   a store: every entry is the record its own derivation answers with,
   in one date order, and every cell delegates to that sort's own
   renderer. Nothing here holds a copy, invents a field, or gives two
   sorts one card (ME-1, ME-3, DIR-1, DIR-3).

   Upcoming sorts soonest first, past most recent first — the shape all
   four source lists already have, applied across the join so the
   directory cannot disagree with itself between two card sorts.

   THE SOURCES ARRIVE AS ONE OBJECT rather than as four positional
   arguments, because the next sort would make it five and the caller
   would start passing nulls to reach the flag behind them. */
function directoryEntries(sources, past, viewer) {
  sources = sources || {};
  const out = publicShows(sources.shows || [], past, viewer)
    .map(function (rec) { return { kind: 'show', rec: rec }; })
    .concat(visibleEvents(sources.events || [], past, viewer)
      .map(function (rec) { return { kind: 'event', rec: rec }; }))
    .concat(publicFairEditions(sources.fairEditions || [], past)
      .map(function (rec) { return { kind: 'fairEdition', rec: rec }; }))
    .concat(publicFairParticipations(sources.fairParticipations || [], past)
      .map(function (rec) { return { kind: 'fairParticipation', rec: rec }; }));
  return out.sort(function (a, b) {
    const av = blDateValue(directoryEntryDate(a)), bv = blDateValue(directoryEntryDate(b));
    return past ? bv - av : av - bv;
  });
}

/* ONE CELL PER SORT, chosen here and composed there. A single renderer
   over all four would be the mixed promise A16.14d spends a section
   keeping apart: a released Wine Show, a self-published member event,
   an organizer's fair and one exhibitor's stand are four different
   statements about who vouches for what. */
const DIRECTORY_CELL = {
  show:              function (rec, viewer) { return showCellHtml(rec, null, viewer); },
  event:             function (rec)         { return eventCellHtml(rec); },
  fairEdition:       function (rec)         { return fairEditionCellHtml(rec); },
  fairParticipation: function (rec)         { return fairParticipationCellHtml(rec); }
};
function mountDirectory(host, entries, viewer) {
  if (!host) return 0;
  host.innerHTML = entries.map(function (en) {
    const cell = DIRECTORY_CELL[en.kind];
    return cell ? cell(en.rec, viewer) : '';
  }).join('');
  wireExpandableCards(host);
  return entries.length;
}

/* ── FOUR RECORD SORTS, THREE EVENT FAMILIES (DIR-2) ──────────────
   The family a reader filters by, mapped in ONE place. A fair edition
   and a fair participation are both a Fair: a participation is a
   concrete exhibitor presence AT a fair, not a fourth kind of event,
   and the day it becomes a top-level option the reader is asked to
   choose between a thing and a part of it. Its own record sort stays
   legible on its card, which is where that distinction belongs. */
const DIRECTORY_FAMILIES = ['Wine Show', 'Member Event', 'Fair'];
const DIRECTORY_FAMILY_OF = {
  show:'Wine Show', event:'Member Event',
  fairEdition:'Fair', fairParticipation:'Fair'
};
function directoryEntryFamily(en) { return DIRECTORY_FAMILY_OF[en.kind] || null; }

/* The edition an entry hangs on — itself for an edition, the
   referenced one for a participation, null for the other two sorts.
   Every fair fact below resolves through this and through nothing
   stored on the entry (FP-3). */
function directoryEntryEdition(en) {
  if (en.kind === 'fairEdition')       return en.rec;
  if (en.kind === 'fairParticipation') return fairEditionById(en.rec.editionId);
  return null;
}
/* The date the whole list sorts and splits by. A show and an event
   carry their own; a fair sorts on its first fair day, and a
   participation sorts with the fair it is at rather than on its own
   attendance days — a stand is not an event of its own. */
function directoryEntryDate(en) {
  const ed = directoryEntryEdition(en);
  return ed ? ed.startDate : (en.rec.date || '');
}
function directoryEntryCity(en) {
  const ed = directoryEntryEdition(en);
  return (ed ? ed.city : en.rec.city) || '';
}
/* Only ever answered inside the Fair family — the two other sorts have
   no fair type, and a facet built over this must not offer one to a
   reader who is not looking at fairs (DIR-5). */
function directoryEntryFairType(en) {
  const ed = directoryEntryEdition(en);
  return ed ? (FAIR_TYPE_LABEL[ed.fairType] || null) : null;
}
/* Display wording for the member event's host role. It is NOT a second
   taxonomy: the platform's audience taxonomy is REACH_LEVELS and its
   role map is REACH_ROLE_VALUE, and neither is touched or duplicated
   here — this is four words for four values already on the record. */
const DIRECTORY_HOST_ROLE_LABEL = {
  winery:'Winery', distributor:'Distributor', restaurant:'Restaurant', retail:'Retail'
};
function directoryEntryHostRole(en) {
  return en.kind === 'event' ? (DIRECTORY_HOST_ROLE_LABEL[en.rec.hostRole] || null) : null;
}
/* What a text search reads. Derived from the records at ask time, like
   everything else here — never a stored search field. */
function directoryEntryText(en) {
  const ed = en.kind === 'fairParticipation' ? directoryEntryEdition(en) : null;
  const s  = ed && fairSeriesById(ed.seriesId);
  if (en.kind === 'fairEdition') {
    const own = fairSeriesById(en.rec.seriesId);
    return [own ? own.name : '', en.rec.city, en.rec.venue].join(' ');
  }
  if (en.kind === 'fairParticipation')
    return [en.rec.org, s ? s.name : '', ed ? ed.city : ''].join(' ');
  return [en.rec.title, en.rec.city, en.rec.host || en.rec.leadHost || ''].join(' ');
}

/* ══ THE TWO FAIR SORTS ON THE DIRECTORY (A19, A21, DIR-1) ═══════ */
/* Published editions only, and only through the ONE findability
   derivation (A19.3). A draft is on no directory, a cancelled edition
   is no longer a published one, and neither gets a second chance from
   a second reader here. Upcoming/past is fairEditionPast()'s answer,
   also the one derivation. */
function publicFairEditions(all, past) {
  return (all || []).filter(function (ed) {
    return fairEditionDiscoverable(ed) && fairEditionPast(ed) === !!past;
  }).sort(function (a, b) {
    return past ? blDateValue(b.startDate) - blDateValue(a.startDate)
                : blDateValue(a.startDate) - blDateValue(b.startDate);
  });
}
/* Participations only through the TRIPLE GATE (A21.7, FP-11), which
   already contains the edition's findability — so a withdrawn or
   rescinded stand, and any stand at an unpublished edition, is absent
   without this function knowing why. No admission is read anywhere on
   this path: applicants, open invitations, rejected and merely
   admitted organisations have no route onto a public surface (FR-11).
   `standId` and the represented houses are not asked here either;
   visibility is one question and content is another. */
function publicFairParticipations(all, past) {
  return (all || []).filter(function (p) {
    if (!fairParticipationPublic(p)) return false;
    return fairEditionPast(fairEditionById(p.editionId)) === !!past;
  }).sort(function (a, b) {
    const ae = fairEditionById(a.editionId), be = fairEditionById(b.editionId);
    const av = blDateValue(ae.startDate), bv = blDateValue(be.startDate);
    return past ? bv - av : av - bv;
  });
}

/* THE EXHIBITOR PRESENCES OF AN EDITION, DERIVED (invariant 7, DIR-7).
   A count that is stored is a count that is wrong the moment somebody
   withdraws, so there is none: the number on the card is the length of
   this list, asked at render time, through the same gate the
   participation cards pass. */
function fairEditionExhibitors(ed) {
  return fairParticipations.filter(function (p) {
    return p.editionId === ed.id && fairParticipationPublic(p);
  });
}
/* REPRESENTED WINERIES, and they are named that on the surface for the
   reason FP-2 gives: a represented house is CONTENT on somebody else's
   stand, not an exhibitor of its own. Only the houses actually
   represented at the booth count — `representedAtBooth` is its own
   explicit statement and is never inferred from the other one (FP-7).
   Deduplicated across stands: a winery on two distributor tables is
   one house at the fair. */
function fairEditionRepresentedWineries(ed) {
  const seen = {}, out = [];
  fairEditionExhibitors(ed).forEach(function (p) {
    (p.representing || []).forEach(function (r) {
      if (r.representedAtBooth && !seen[r.winery]) { seen[r.winery] = 1; out.push(r.winery); }
    });
  });
  return out;
}

/* ── THE EXTERNAL TICKET / ACCREDITATION LINK (A19.5, DIR-6) ──────
   O5 is this field's first public reader, and the rendering rules are
   the field's own rules read at the other end.

   THE VALIDITY QUESTION IS THE WRITE ACT'S, ASKED BY THE SAME
   FUNCTION: fairTicketingUrlValid() lives in the data asset and both
   ends call it. A record that reached storage before the check
   existed, or by any route that skipped it, is caught here — which is
   only true while there is one of it.

   NULL OR INVALID RENDERS NOTHING AT ALL: no button, and no reserved
   empty area either. A frame with nothing in it is a promise the
   record cannot keep, and on a card it reads as a link that failed
   rather than as a fair that sells its tickets elsewhere. */
function fairTicketingUrl(ed) {
  const v = ed && ed.externalTicketingUrl;
  return (v && fairTicketingUrlValid(v)) ? v : null;
}
function fairTicketingLinkHtml(ed) {
  const url = fairTicketingUrl(ed);
  if (!url) return '';
  /* Opened in its own context, and safely: the target may be anybody's
     ticket shop, so it gets no handle on this window and no referrer
     (`noopener` is already the Bestand's pattern on every other
     outbound link). The caption is the ONE derivation over the fair
     type — Trade Accreditation · Consumer Tickets · Hybrid Tickets &
     Accreditation — and it is stored nowhere (A19.5, invariant 7). */
  return '<a class="fe-ticket" href="' + notifEsc(url) + '" target="_blank" rel="noopener noreferrer">' +
    notifEsc(FAIR_TICKETING_LABEL[ed.fairType] || '') + ' ↗</a>';
}

/* ── THE FAIR EDITION CARD ────────────────────────────────────────
   The third card sort, and it makes the third statement. A Wine Show
   carries Bottle Lobby's review and release; a member event carries
   none and says so (ME-3); a fair carries its VERIFIED ORGANIZER —
   Bottle Lobby checked the workspace (A18.4) and the fair brand
   (A19.4), and reviewed neither the edition nor what happens at it.
   Three different sentences, three cards, one shell.

   The wording lives here, once, like MEMBER_EVENT_DISCLAIMER: the
   moment it is retyped anywhere it becomes the reassuring version. */
const FAIR_EDITION_DISCLAIMER =
  'A fair edition, published by the organizer who runs it. Bottle Lobby verifies the ' +
  'organizer and the fair brand — it does not review or release the edition, and this is ' +
  'neither a Wine Show nor a member event.';

function fairEditionCellHtml(ed) {
  const series = fairSeriesById(ed.seriesId);
  const past   = fairEditionPast(ed);
  const id     = 'fe-listing-' + ed.id;
  const ex     = fairEditionExhibitors(ed);
  const dates  = blDate(ed.startDate) + (ed.endDate ? ' – ' + blDate(ed.endDate) : '');
  /* DERIVED, AND ONLY WHAT THE MODEL HOLDS (DIR-7). Exhibitor
     presences are participation rows and nothing else. There is no
     visitor, attendee, ticket or expected-reach figure anywhere on
     this card, because no such registration exists in the model — a
     number nobody records is a number nobody may print. */
  const note = ex.length
    ? ex.length + ' exhibitor presence(s) published'
    : 'No exhibitor has published a stand here yet.';

  return '<div class="fe-cell" data-edition-id="' + notifEsc(ed.id) + '">' +
    '<button type="button" class="fe-teaser bl-expand' + (past ? ' past' : '') +
      '" aria-expanded="false" aria-controls="' + id + '">' +
      cardHeroHtml('fe-teaser-hero', null, '', FAIR_TYPE_LABEL[ed.fairType] || 'Fair') +
      '<div class="fe-teaser-body">' +
        '<div class="fe-card-kind"><span class="fe-kind-dot"></span>Fair · ' +
          notifEsc(FAIR_TYPE_LABEL[ed.fairType] || '') + '</div>' +
        '<div class="fe-card-date">' + dates + ' · ' + notifEsc(ed.city) + '</div>' +
        '<div class="fe-card-title">' + notifEsc(series ? series.name : '') + '</div>' +
        '<div class="fe-card-note">' + note + '</div>' +
        '<div class="fe-teaser-foot">' +
          '<span class="fe-card-disclaim">' + FAIR_EDITION_DISCLAIMER + '</span>' +
          '<span class="fe-teaser-more bl-expand-more">Full listing →</span>' +
        '</div>' +
      '</div>' +
    '</button>' +
    '<div class="fe-listing" id="' + id + '">' + fairEditionListingHtml(ed) + '</div>' +
  '</div>';
}

/* The listing behind the fair card — everything the edition record and
   its participations publicly say, composed live and copied nowhere.
   The exhibitors link at the ONE canonical Participation Page (A21.7);
   the directory builds no detail view of its own. */
function fairEditionListingHtml(ed) {
  const ex   = fairEditionExhibitors(ed);
  const reps = fairEditionRepresentedWineries(ed);
  const kv = function (k, v) { return '<div class="ws-public-line"><b>' + k + '</b> · ' + v + '</div>'; };
  const lines = ex.length
    ? ex.map(function (p) {
        const stand = p.standId ? fairStands.find(function (x) { return x.id === p.standId; }) : null;
        return '<div class="ws-public-line">' +
          '<a class="fpp-link" href="bottle-lobby-fair-participation.html?id=' +
            encodeURIComponent(p.id) + '">' + notifEsc(p.org) + '</a>' +
          (stand ? ' — Stand ' + notifEsc(stand.label) : '') +
        '</div>';
      }).join('')
    : '<div class="ws-public-line">Exhibitor presences appear here as exhibitors publish their stands.</div>';

  return (ed.description ? '<div class="fe-listing-desc">' + notifEsc(ed.description) + '</div>' : '') +
    kv('Where', notifEsc(ed.venue || ed.city)) +
    kv('Fair days', blDate(ed.startDate) + (ed.endDate ? ' – ' + blDate(ed.endDate) : ' (one day)')) +
    kv('Type', notifEsc(FAIR_TYPE_LABEL[ed.fairType] || '')) +
    (reps.length ? kv('Represented wineries', reps.map(notifEsc).join(' · ')) : '') +
    '<div class="fe-listing-head">Exhibitor presences</div>' + lines +
    fairTicketingLinkHtml(ed);
}

/* ── THE FAIR PARTICIPATION CARD ──────────────────────────────────
   The fourth sort, and the only one whose whole content already has a
   canonical page: this card is a way IN, not a second rendering of it.
   So it is a link rather than an expander — there is nothing to unfold
   that the page does not say better, and a fold-out here would be the
   parallel detail view A21.7 rules out. */
const FAIR_PARTICIPATION_DISCLAIMER =
  'One exhibitor\'s own presence at a fair, published by the exhibiting house.';

function fairParticipationCellHtml(p) {
  const ed     = fairEditionById(p.editionId);
  const series = ed && fairSeriesById(ed.seriesId);
  const stand  = p.standId ? fairStands.find(function (x) { return x.id === p.standId; }) : null;
  const hall   = stand ? fairHalls.find(function (h) { return h.id === stand.hallId; }) : null;
  const past   = ed ? fairEditionPast(ed) : false;
  const reps   = (p.representing || []).filter(function (r) { return r.representedAtBooth; });
  const where  = stand
    ? 'Stand ' + notifEsc(stand.label) + (hall ? ' · ' + notifEsc(hall.name) : '')
    : 'Stand to be announced';

  return '<div class="fp-cell" data-participation-id="' + notifEsc(p.id) + '">' +
    '<a class="fp-card' + (past ? ' past' : '') + '" href="bottle-lobby-fair-participation.html?id=' +
      encodeURIComponent(p.id) + '">' +
      cardHeroHtml('fp-card-hero', null, '', 'Exhibitor presence') +
      '<div class="fp-card-body">' +
        '<div class="fe-card-kind"><span class="fe-kind-dot"></span>Fair · Exhibitor presence</div>' +
        '<div class="fe-card-date">' +
          (ed ? blDate(ed.startDate) + (ed.endDate ? ' – ' + blDate(ed.endDate) : '') + ' · ' + notifEsc(ed.city) : '') +
        '</div>' +
        '<div class="fe-card-title">' + notifEsc(p.org) + '</div>' +
        '<div class="fp-card-at">at ' + notifEsc(series ? series.name : '') + ' · ' + where + '</div>' +
        (reps.length
          ? '<div class="fp-card-reps">Represented wineries · ' + reps.map(function (r) {
              return notifEsc(r.winery); }).join(' · ') + '</div>'
          : '') +
        '<div class="fe-teaser-foot">' +
          '<span class="fe-card-disclaim">' + FAIR_PARTICIPATION_DISCLAIMER + '</span>' +
          '<span class="fe-teaser-more">Participation page →</span>' +
        '</div>' +
      '</div>' +
    '</a>' +
  '</div>';
}

/* ══ THE CANONICAL FAIR — public derivations (A19, A21) ══════════ */
/* Moved/defined here in O4 (A21.8): this file is the one answer to
   "what may this visitor see", and the fair's visibility questions
   belong beside the shows' — a second visibility asset would split
   exactly that principle. Requires bottle-lobby-data.js first, as
   everything here does. */

/* ONE escaper for typed text on the way to the DOM. It moved here
   from the dashboard with the participation renderer, because the
   renderer prints exhibitor- and organizer-typed text (descriptions,
   names) on public pages too — and a second escaper beside the one
   the dashboard already trusted would be the drift D26 describes,
   one layer down. The dashboard keeps calling it by this name. */
function notifEsc(v) {
  return String(v == null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* ── THE ONE FINDABILITY DERIVATION (A19.3, FS-6) ─────────────────
   Published → publicly findable by default, all three fair types; a
   draft is findable by nobody outside the owning workspace, and a
   cancelled edition is no longer a published one. Read by the
   organizer surface, the harnesses and — since O4 — the canonical
   Participation Page as gate factor (c) (A21.7). O5's directory
   becomes its next reader, never a second answer. Findability is NOT
   entitlement: no application, appointment or other business action
   hangs off it. */
function fairEditionDiscoverable(ed) {
  return !!ed && ed.status === 'published';
}

/* "Past" is DERIVED, never stored (A19.3): the edition is over when its
   last fair day lies behind the demo's today. Moved here from the
   dashboard with O5 — the directory splits Coming up from Previously by
   exactly this question, and the organizer cockpit asks the same one.
   A one-day edition carries `endDate` null and answers on its start.

   Note what this does NOT do: it is not a visibility question. A past
   published edition is still discoverable; it is simply listed under
   Previously, exactly as a completed Wine Show is. */
function fairEditionPast(ed) {
  return (ed.endDate || ed.startDate) < SHOW_TODAY;
}

/* ── THE TRIPLE GATE, AS ONE DERIVATION (A21.7, FP-11) ────────────
   Publicly rendered means: admitted AND an explicitly created,
   ACTIVE participation AND a published edition — all three at once.
   Factor (a) needs no read here and MUST NOT get one: only an
   admitted organisation can have created the row (the creation
   entitlement, A21.1), `admitted` is final (A20.2), and the
   admission records are private to the dashboard (FR-11) — a public
   gate reading them would drag them onto every public page. Factor
   (b) is the row's own status; factor (c) is the ONE findability
   derivation above, referenced and never re-answered.

   Everything public asks THIS function — the dashboard's "open your
   page" link and the canonical Participation Page alike. A second
   implementation would be a second answer to "may the public see
   this stand", and the day the two disagree is the day somebody's
   withdrawn participation is still on the open web. */
function fairParticipationPublic(p) {
  if (!p || p.status !== 'active') return false;
  return fairEditionDiscoverable(fairEditionById(p.editionId));
}

/* Occupancy, DERIVED (A21.5, FP-8): the stand's occupant is the one
   ACTIVE participation naming it — an ended participation frees its
   stand by this filter alone, with no inventory edit anywhere. At
   most one active row per stand is the invariant the assignment act
   refuses on; this reader answers over whatever the data says. */
function fairStandOccupant(standId) {
  return fairParticipations.find(function (p) {
    return p.standId === standId && p.status === 'active';
  }) || null;
}

/* ══ THE CANONICAL PARTICIPATION PAGE — the one renderer (A21.7) ══ */
/* A stakeholder or wine renders as a REAL link exactly where the
   Bestand carries a target (`stakeholders.url`, the product row's
   `url`) — and as plain text where it does not. No invented target:
   a link that has to be guessed is worse than none (the A12 lesson,
   the data.js `url` rule). Names resolve from the canonical records
   at render time; nothing here reads a copy (FP-14). */
function fairStakeholderLink(name) {
  const st = stakeholder(name);
  return st && st.url
    ? '<a class="fpp-link" href="' + notifEsc(st.url) + '">' + notifEsc(st.name) + '</a>'
    : notifEsc(name);
}
function fairWineLine(ref) {
  const wRow = wineByRef(ref);
  if (!wRow) return '';   /* an unresolvable reference renders nothing (ME-6) */
  const label = notifEsc(wRow.name + ' ' + wRow.vintage);
  return '<li class="fpp-wine">' +
    (wRow.url ? '<a class="fpp-link" href="' + notifEsc(wRow.url) + '">' + label + '</a>' : label) +
    '<span class="fpp-wine-type">' + notifEsc(wRow.type) + '</span></li>';
}
/* The TWO presence statements, rendered as the two statements they
   are — each with its own explicit answer, never folded into one
   line and never one inferred from the other (FP-7). */
function fairPresenceChips(rep) {
  return '<span class="fpp-flag' + (rep.representedAtBooth ? ' on' : '') + '">Represented at booth · ' +
           (rep.representedAtBooth ? 'yes' : 'no') + '</span>' +
         '<span class="fpp-flag' + (rep.personallyAttending ? ' on' : '') + '">Personally attending · ' +
           (rep.personallyAttending ? 'yes' : 'no') + '</span>';
}

/* COMPOSES, NEVER COPIES (A21.7): exhibitor identity from the
   stakeholder record, edition and series facts from their records,
   hall and stand labels resolved live from the inventory, wines
   through the one product resolver. The caller has already asked
   fairParticipationPublic() — this function renders content, it does
   not re-decide visibility, and nothing here reads an admission. */
function fairParticipationPageHtml(p) {
  const ed = fairEditionById(p.editionId);
  const s  = ed && fairSeriesById(ed.seriesId);
  const st = stakeholder(p.org);
  const dates = ed
    ? blDate(ed.startDate) + (ed.endDate ? ' – ' + blDate(ed.endDate) : '')
    : '';
  const stand = p.standId ? fairStands.find(function (x) { return x.id === p.standId; }) : null;
  const hall  = stand ? fairHalls.find(function (h) { return h.id === stand.hallId; }) : null;
  const place = stand
    ? 'Stand ' + notifEsc(stand.label) + (hall ? ' · ' + notifEsc(hall.name) : '')
    : 'Stand to be announced';
  const days = (p.days && p.days.length)
    ? p.days.map(blDate).join(' · ')
    : 'Attendance days to be announced';

  let content = '';
  if (p.orgType === 'winery') {
    const wines = (p.products || []).map(function (x) { return fairWineLine(x.productId); }).join('');
    content = wines
      ? '<div class="fpp-block-title">Presented Wines</div><ul class="fpp-wines">' + wines + '</ul>'
      : '';
  } else {
    /* GROUPED BY WINERY (A21.7): each represented house is one group
       with its own two presence statements and its own wines — no
       mixed pool, no foreign bottle in a group. */
    content = (p.representing || []).map(function (rep) {
      const wines = (rep.products || []).map(function (x) { return fairWineLine(x.productId); }).join('');
      return '<div class="fpp-rep">' +
        '<div class="fpp-rep-head">' + fairStakeholderLink(rep.winery) + fairPresenceChips(rep) + '</div>' +
        (wines ? '<ul class="fpp-wines">' + wines + '</ul>' : '') +
      '</div>';
    }).join('');
    if (content) content = '<div class="fpp-block-title">Represented Wineries &amp; Their Wines</div>' + content;
  }

  return '<div class="fpp">' +
    '<div class="fpp-kicker">Fair participation</div>' +
    '<h2 class="fpp-exhibitor">' + fairStakeholderLink(p.org) + '</h2>' +
    '<div class="fpp-role">' + notifEsc(st.type === 'distributor' ? 'Distributor' : 'Winery') +
      (st.region ? ' · ' + notifEsc(st.region) : '') + '</div>' +
    (ed ? '<div class="fpp-edition">' +
      '<div class="fpp-edition-name">' + notifEsc(s ? s.name : '') + '</div>' +
      '<div class="fpp-edition-facts">' + dates + ' · ' + notifEsc(FAIR_TYPE_LABEL[ed.fairType] || '') +
        '<br>' + notifEsc(ed.city) + (ed.venue ? ' — ' + notifEsc(ed.venue) : '') + '</div>' +
    '</div>' : '') +
    '<div class="fpp-facts">' +
      '<div class="fpp-fact"><b>Where</b>' + place + '</div>' +
      '<div class="fpp-fact"><b>Fair days attended</b>' + days + '</div>' +
    '</div>' +
    (p.description ? '<p class="fpp-desc">' + notifEsc(p.description) + '</p>' : '') +
    content +
  '</div>';
}
