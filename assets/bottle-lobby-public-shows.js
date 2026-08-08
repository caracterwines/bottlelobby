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
  follows:      function () { return []; }
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
   level this code has not been taught yet. */
function reachAdmits(show, level, viewer) {
  switch (level) {
    case 'public':       return true;
    case 'members':      return !!viewer.role;
    case 'wineries':
    case 'distributors':
    case 'restaurants':
    case 'retail':       return REACH_ROLE_VALUE[viewer.role] === level;
    case 'partners':     return !!viewer.entity &&
                                hostPartners(show.leadHost).indexOf(viewer.entity) !== -1;
    case 'community':    return !!viewer.entity &&
                                hostCommunity(show.leadHost).indexOf(viewer.entity) !== -1;
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
  return showReach(show).some(function (l) { return reachAdmits(show, l, viewer); });
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
function showDateValue(show) {
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const raw = show.date || '';
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (iso) return Number(iso[1]) * 10000 + Number(iso[2]) * 100 + Number(iso[3]);
  const m = /^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})$/.exec(raw);
  if (!m) return Number.MAX_SAFE_INTEGER;
  const mi = MONTHS.indexOf(m[2]);
  if (mi === -1) return Number.MAX_SAFE_INTEGER;
  return Number(m[3]) * 10000 + (mi + 1) * 100 + Number(m[1]);
}
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

  return '<button type="button" class="ws-teaser' + (past ? ' past' : '') + '">' +
    '<img class="ws-teaser-hero" src="' + showHeroImage(show) + '" alt="' + show.title + '">' +
    '<div class="ws-teaser-body">' +
      '<div class="ws-public-date">' + blDate(show.date) + ' · ' + show.city + chip + '</div>' +
      '<div class="ws-public-title">' + show.title + '</div>' +
      '<div class="ws-public-focus">' + show.focus + '</div>' +
      '<div class="ws-teaser-foot">' +
        '<span class="ws-teaser-note">' + note + '</span>' +
        '<span class="ws-teaser-more">Full listing →</span>' +
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
function mountShowCards(host, list, entity, viewer) {
  if (!host) return 0;
  host.innerHTML = list.map(function (s) {
    const level = publicLevelFor(s, viewer);
    const id = 'ws-listing-' + s.id + (entity ? '-' + entity.replace(/\W+/g, '') : '');
    const role = entity ? publicParticipation(s, entity) : null;
    return '<div class="ws-cell">' +
      publicShowTeaser(s, level, role).replace('<button type="button"',
        '<button type="button" aria-expanded="false" aria-controls="' + id + '"') +
      '<div class="ws-listing" id="' + id + '">' + publicShowCard(s, level) + '</div>' +
    '</div>';
  }).join('');

  /* One handler per card rather than one on the container: the cards
     are buttons, and a delegated listener would have to re-derive
     which one was hit. */
  Array.prototype.forEach.call(host.querySelectorAll('.ws-teaser'), function (btn) {
    btn.addEventListener('click', function () {
      const panel = btn.nextElementSibling;
      const open = panel.classList.toggle('open');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      btn.querySelector('.ws-teaser-more').textContent = open ? 'Close ↑' : 'Full listing →';
    });
  });
  return list.length;
}
