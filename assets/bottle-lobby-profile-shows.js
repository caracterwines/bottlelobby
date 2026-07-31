/* ══════════════════════════════════════════════════════════════════
   BOTTLE LOBBY — THE WINE SHOWS TAB ON A PUBLIC PROFILE (A16.7)
   ------------------------------------------------------------------
   Fifteen profile pages carry this tab. Fifteen copies of the logic
   would be fifteen chances for one of them to disclose something the
   others do not, so the pages carry no logic at all: each one declares
   only who it is.

       <div class="ws-profile-shows" data-entity="Cantina Rossi"></div>

   Everything else — which shows that account may be seen at, at what
   level, and how a card behaves — comes from
   bottle-lobby-public-shows.js, the same file the dashboard and the
   public Wine Shows page use.

   `data-entity` must match the name in the records exactly: it is the
   join key standing in for a foreign key (A16.9). A typo yields an
   empty tab rather than a wrong one, which is the right way round, and
   tests/profile-shows.js fails on any name that matches no account.

   Requires bottle-lobby-data.js and bottle-lobby-public-shows.js
   before it. Classic script, not a module.
════════════════════════════════════════════════════════════════════ */
(function () {
  const EMPTY = '<div class="ws-empty">No Wine Show participation yet.</div>';

  Array.prototype.forEach.call(
    document.querySelectorAll('.ws-profile-shows[data-entity]'),
    function (root) {
      const entity = root.getAttribute('data-entity');
      const mine = publicShowsForEntity(wineShows, entity);

      if (!mine.upcoming.length && !mine.past.length) {
        root.innerHTML = EMPTY;
        return;
      }

      /* Two groups, each only when it has something in it — an empty
         "Previously" heading reads as a missing list rather than as an
         account that has not exhibited yet. */
      root.innerHTML =
        (mine.upcoming.length ? '<div class="ws-grid" data-group="upcoming"></div>' : '') +
        (mine.past.length
          ? '<div class="ws-profile-past-head">Previously</div>' +
            '<div class="ws-grid" data-group="past"></div>'
          : '');

      mountShowCards(root.querySelector('[data-group="upcoming"]'), mine.upcoming, entity);
      mountShowCards(root.querySelector('[data-group="past"]'), mine.past, entity);
    }
  );
})();
