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
   `draft` and `pending_approval` are absent: nothing is public before
   the show has a venue, a confirmed exhibitor and a confirmed wine
   (A16.2), and nothing is fully public before Bottle Lobby releases it
   (A16.1). `changes_requested` is a show being reworked and is not a
   public state either. */
const PUBLIC_UPCOMING_STAGES = ['planning', 'published'];
const PUBLIC_PAST_STAGES     = ['completed'];

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
/* Upcoming soonest first; past most recent first. */
function publicShows(all, past) {
  const stages = past ? PUBLIC_PAST_STAGES : PUBLIC_UPCOMING_STAGES;
  return all.filter(s => stages.indexOf(s.stage) !== -1)
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
  const listable = PUBLIC_UPCOMING_STAGES.indexOf(show.stage) !== -1 ||
                   PUBLIC_PAST_STAGES.indexOf(show.stage) !== -1;
  if (!listable) return null;
  if (show.leadHost === entity) return 'host';
  if (publicLevelFor(show) !== 'full') return null;
  return confirmedExhibitors(show).some(e => e.producer === entity) ? 'exhibitor' : null;
}
const PARTICIPATION_LABEL = { host: 'Hosting', exhibitor: 'Exhibiting' };

/* Everything a profile page needs: the shows this entity may be seen
   at, split the way A16.7 asks for them — "upcoming and, after
   `completed`, as history". */
function publicShowsForEntity(all, entity) {
  const mine = all.filter(s => publicParticipation(s, entity));
  return {
    upcoming: publicShows(mine, false),
    past:     publicShows(mine, true)
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
  const note = level === 'anonymised'
    ? 'Exhibitors are named once they have accepted — never before.'
    : (past ? 'This show has taken place.' : 'Exhibitors, wines and venue confirmed.');
  /* Only set on a profile, where the question is what THIS account did
     at the show; on the Wine Shows page there is no such subject. */
  const chip = role && PARTICIPATION_LABEL[role]
    ? '<span class="ws-teaser-role">' + PARTICIPATION_LABEL[role] + '</span>' : '';

  return '<button type="button" class="ws-teaser' + (past ? ' past' : '') + '">' +
    '<img class="ws-teaser-hero" src="' + showHeroImage(show) + '" alt="' + show.title + '">' +
    '<div class="ws-teaser-body">' +
      '<div class="ws-public-date">' + show.date + ' · ' + show.city + chip + '</div>' +
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
    '<div class="ws-public-date">' + show.date + ' · ' + show.city + '</div>' +
    '<div class="ws-public-title">' + show.title + '</div>' +
    '<div class="ws-public-focus">' + show.focus + '</div>';

  if (level === 'anonymised') {
    return '<div class="ws-public">' + head +
      '<div class="ws-public-hidden">Exhibitors, their wines and the exact venue stay hidden until Bottle&nbsp;Lobby releases the show. ' +
      'An invited producer must not appear in public before accepting — a later decline would read as a withdrawal.</div>' +
    '</div>';
  }

  const exh = confirmedExhibitors(show);
  const lines = exh.length
    ? exh.map(e => '<div class="ws-public-line"><b>' + e.producer + '</b> — ' +
        (e.products.filter(p => p.status === 'confirmed').map(p => p.name).join(', ') || 'wines to be announced') +
      '</div>').join('')
    : '<div class="ws-public-line">Exhibitors to be announced.</div>';

  return '<div class="ws-public">' + head +
    '<div class="ws-public-line" style="margin-top:0.9rem"><b>Venue</b> · ' + show.venueName + '</div>' +
    '<div class="ws-public-line"><b>Capacity</b> · ' + show.capacity + ' guests</div>' +
    '<div style="margin-top:0.9rem;padding-top:0.8rem;border-top:1px solid rgba(247,243,238,0.08)">' + lines + '</div>' +
  '</div>';
}
/* The level a real visitor would get right now, from the stage alone. */
function publicLevelFor(show) {
  return (show.stage === 'published' || show.stage === 'completed') ? 'full' : 'anonymised';
}

/* ══ MOUNTING (A16.7) ════════════════════════════════════════════ */
/* Cards into a container, each with its full listing folded behind it,
   and the toggle wired. Shared by the Wine Shows page and all fifteen
   public profiles: the interaction is part of what the card IS, and
   fifteen copies of it would drift the same way fifteen copies of the
   renderer would.

   `entity`, when given, makes the card say what that account did at
   the show — the profile case. Returns how many were rendered. */
function mountShowCards(host, list, entity) {
  if (!host) return 0;
  host.innerHTML = list.map(function (s) {
    const level = publicLevelFor(s);
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
