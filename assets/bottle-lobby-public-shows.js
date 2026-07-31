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
