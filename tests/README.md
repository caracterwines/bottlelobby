# Tests

jsdom harnesses for `bottle-lobby-dashboard.html`. They load the real file,
run its scripts, and drive the actual functions — no stubs, no copies of the
logic under test.

They exist because C3 requires a DOM harness for logic that counts, but never
said where one lives. Every earlier harness was written, run once and thrown
away, so the same assertions were re-derived from scratch each session and
regressions could only be caught by whoever happened to remember them.

**New assurances belong here, not in a scratchpad.** If a bug is found and
fixed, add the assertion that would have caught it.

## Setup

```
cd tests
npm install      # jsdom only
npm test         # runs every harness, one line each
```

A single harness: `node tests/wine-handshake.js` from the repo root, or
`node wine-handshake.js` from inside `tests/`.

Node 18+ . `npm install` writes `tests/node_modules/`, which is git-ignored.
The `package.json` sits in `tests/` on purpose — the repo root is Netlify's
publish directory, and a `package.json` there invites the build image to
treat the site as a Node project.

## What each file guards

| File | Guards |
|---|---|
| `sidebar-routing.js` | The four dashboards' sidebar and sub-page routing (B8, D18, D21). Walks all 36 profile sub-pages: exactly one section visible, one nav item active, the right topbar title, tab bar only for multi-member groups, "Preview Public Profile" only on My Profile. Also that entering the Orders sub-view clears the profile nav, and that My Stars / My Fans are populated in all four roles (A7, D20). |
| `wine-shows.js` | The Wine Shows sub-view end to end (A16): view isolation against dashboard/profile/orders, runtime id uniqueness with both shells live, per-role lists, the two visibility levels of A16.6, the computed readiness checklist of A16.10, invite → counter-propose → host confirm → auto-promotion, the approval gate and its demo-labelled release button, the decline path, and that every show product resolves to a wine in `partnerWinesPool` rather than being a copy. |
| `wine-handshake.js` | The two-sided wine confirmation (A16.4, D23). Both sides of every path, including the full round trip `host declines → producer proposes again → host confirms → planning`. Contains the regression test for the dead end where a producer could confirm without naming a wine, leaving the show stuck in `draft`. |
| `invite-render.js` | That `saveInvite()` actually renders. Three entry paths down to the DOM, after a reported case where "Exhibitors & Wines" looked empty. |
| `check-static.js` | Structure rather than behaviour, and runs first: external assets present, non-empty and in the right order, JS syntax (the `node --check` step), duplicate ids, `getElementById` targets that exist, div balance and — via jsdom — that children have not escaped their container (B10), `onclick` handlers defined, CSS classes used in the markup defined, and that enum-driven class names like `ws-<stage>` cover the whole enum. Takes an optional file argument so a variant can be checked without touching the real file. Also sweeps **all 42 wine article pages** — the first structural coverage they have ever had, added when an own-label product needed one written from scratch: canonical nav and footer, div balance, unique ids, a four-part breadcrumb whose third part links to the **producer**, a `wineData` record carrying all 16 spec fields, and grape links into the Wine Guide with no raw characters in the query. It reports the page count, so a page that stops matching the glob cannot pass by disappearing. |
| `public-shows-page.js` | `bottle-lobby-wine-shows.html` — the public face of A16.7, and the first public page with any coverage at all. That the section renders matters less than that it renders **less** than the dashboard: no `draft` or `pending_approval` show is listed, and a `planning` show names none of its exhibitors, none of their wines and not the venue, while still showing date, city and focus. Also the expanding listing (closed on load, independent per card, `aria-expanded` in step) and that every hero image exists in the repo. |
| `profile-shows.js` | The Wine Shows tab on all fifteen public winery and distributor profiles (A16.7). Every page is loaded and driven, not sampled. Checks that each account is listed at exactly the shows A16.6 permits naming it at — host from `planning`, exhibitor only from `published` — that the role chip matches, that pages with nothing show the empty state, and that no page names an exhibitor, wine or venue of a still-anonymised show. Also re-checks the structure of these pages, since they were rewritten by script: div balance, duplicate ids, and no show titles left hard-coded. |
| `follow-feed.js` | The follow graph as an announcement channel (A16.7) — the third surface a show appears on. Checks that the **From Your Stars** widget on all four overviews announces exactly what the public profiles would show: a follower of a host hears about a `planning` show, a follower of a producer confirmed at one hears nothing. Also that releasing a show reaches its host's followers immediately, and that the demo graph still contains the followed-but-anonymised pair without which the whole file passes vacuously. |
| `persistence.js` | Demo persistence (spec C8) — and above all its **isolation from every other harness**. Checks that `load-dashboard.js` switches the store off by default, that no other harness opts back in, and that two pages in one process cannot see each other's state; then the round trip, that transient state (role, open view, modal targets) is never stored, that a stale snapshot ends as an announced discard rather than a merge, the two-tab update, the guard that freezes a tab while a modal is open or a field has focus, and reset. Ends with a completeness check: every top-level `let` in the dashboard and `bottle-lobby-data.js` is either registered or on an explicit transient list with a reason, and the same for every **mutated `const` collection**. That second half used to look only for array methods (`push`, `splice`) and therefore missed the entire class of `const` OBJECTS changed by property write — `filters` had been unclassified since it was written. It now catches `X[k] =`, `X.k =`, `X.k++` and `delete X.k` too, and asserts that the property-write scan still matches something, so the day it stops working it does not read as "nothing to classify". It is the only file that opts into persistence, and it runs jsdom **with** a URL so a real `localStorage` exists — otherwise the kill-switch checks would be proving that jsdom has no storage rather than that the switch works. |
| `stakeholders.js` | The two master tables (A1, A6). That `stakeholders` is well formed and every public profile url resolves to a real page (A11); that **every name reaching `stakeholder()` is in it**, driven by running all 19 renderers and the four notification lists rather than trusting load-time; that the two guest-list-only houses are deliberately absent and still exercised; that no array anywhere carries a house's `avatar`, `location`, `roleLabel` or follow type any more; that at least one avatar differs from its naive initials, so nobody computes the field away; that a partnership exists as ONE row with a distributor end, an ISO date and an activating actor; that the three formerly duplicated pairs read the **same date off the rendered cards at both ends**; and that an unknown house renders name-only with a console warning (B12). Five mutations put each old mistake back. |
| `show-modals.js` | The five Wine Show dialogs, and the reason it exists: the stakeholders pass shipped a `TypeError` in `saveShow()` that a green suite let through, because no harness had ever opened a show modal. Every section first asserts that the action **completed without throwing**, then what it produced: creating a show with a partner venue names the venue's city, the venue and guest pickers offer only the demand side, the exhibitor picker only producers the **host** carries (A16.4), nobody already on the show is offered twice, and all three wine pickers fill. Four mutations, the first of which restores the shipped crash line for line. |
| `own-label-program.js` | The programme, the three acts and the gates (A17.1, A17.2, A17.3, A17.7, A17.8, A17.12) — **OL-3, OL-4, OL-6, OL-11, OL-13**. Drives the page's own rows rather than fixtures of its own: eight memberships, eight consents, eight contracts, twelve reviews. Checks that every reference resolves in both directions and that every company named is a stakeholder of the matching type with a resolving profile (A2, A11); that no membership row carries a status, a boolean or a screen name, and that each of A17.1's **six conditions** taken away in turn makes the reading move; that a consent, a contract, its approval and the admission are **four separate rows**, and that an approved contract admits nobody on its own; that the seven A17.2 tab states and the A17.3 badge are read from the record, with at least three distinct states present so A17.14's arc is visible; that every project's two houses were admitted **at its request date** and hold a partnership (OL-11); that no sentence is shared between a programme and a project consent text, and that a project consent never predates its own membership (OL-13); that gate 1 counts **parties**, not contract rows; and A17.4's `canStartOwnLabelProject` with all five of its refusals measured over real houses and real wines, the no-partnership case produced by taking a partnership away, and a re-derivation of every project phase from the raw records so the arc is checked by double entry rather than by a threshold somebody has to bump. that the first order's quantity and unit price are the ones both terms rows agreed at gate 2; OL-2 structurally — no fee key on the distributor's terms row and no distributor renderer reaching one; OL-14 over the shipped ledger, where every stored event must be one the builder would have produced; and A17.9b on the page's own rows — the downstream holder's ordinary listing with its own price and article number, absent from his My Labels, the A→B order covered by a grant and refused a fee, and the ordinary D2D order beside it that A17 must still say nothing about (D40). Three mutations. |
| `own-label-grants.js` | Market Grants, the fee chain and the Primary Own-Label Listing (A17.9a, A17.9b, A17.10, A17.12) — **OL-14, OL-15, MG-1, MG-2**. Carries its own fixtures, because the page's `ownLabelProjects`, `marketGrants` and `ownLabelFeeEvents` are deliberately empty until the A17 fixture pass supplies the first delivery that would let the `legacyOwnLabel` bridge be torn out (A17.14). Checks that a grant is a combinable record over all seven A17.9a dimensions and that a named dimension with nothing to match is a **no**; that `ownLabel` on a listing derives from exactly two conditions, with the downstream holder's own first delivery as the counter-check; that a fee event exists only on the producing winery's sale and carries its amount, currency and tariff version as a snapshot; that an order right needs a partnership **and** a grant and does not move when reach is set to `public`; and that the derivation reaches **no** screen while the bridge is still the one reading. Seven mutations, one of which was found weakened and re-aimed. |
| `load-dashboard.js` | Not a harness — the shared loader every harness reads the page through. See the section below; it is excluded from `run-all.js` on purpose, because a module that does nothing exits 0 and would read as a passing check. **It also injects `window.BL_NO_PERSIST`**, so persistence is off in every harness without any of them having to remember. |

## The pitfall: jsdom does not fetch `<script src>`

**Read this before extracting anything else out of the dashboard.**

With the options every harness here uses —

```js
new JSDOM(html, { runScripts: 'dangerously' })
```

— an external script is parsed, left in the DOM, and **never executed**.
jsdom only fetches subresources when told to (`resources: 'usable'`), and that
loads asynchronously, which would force all four harnesses to become async.

So the harnesses read the page through `loadDashboard()`, which resolves every
`<script src>` against the file's own directory and splices the contents in as
an inline block at the position the tag occupied. Document order is preserved —
that is the whole contract, since `bottle-lobby-data.js` must run before the
block that reads it. A missing or empty asset throws there instead of surfacing
later as an unexplained `undefined`.

What the failure actually looks like, measured rather than assumed:

| Surface | Without the loader |
|---|---|
| `check-static.js` | **Saw nothing at all.** Its script regex matched a bare `<script>` only, so the extracted code fell outside every structural check — syntax, `onclick`, `getElementById`, CSS classes — with no signal of any kind. |
| The four behaviour harnesses | Loud, not silent: the page throws `ReferenceError: wineShows is not defined` on load. Three of them guard on `jsdomError` before asserting and stop there. |

The dangerous half was `check-static.js`. It is now the check that closes the
hole: it fails the run if a declared asset is missing, empty, or loaded after
the file that reads it.

**Any future extraction must go through `loadDashboard()`.** A new harness that
calls `fs.readFileSync` on the dashboard directly is testing a page with holes
in it.

## Two assertions worth keeping

`wine-handshake.js` carries a **vocabulary contract**: it parses
`exhibitorTurn()` out of the source, collects the string literals it can
return, and checks that every `SHOW_ROLES[*].side` is one of them — and that
every returned value is claimed by a role.

This exists because of a bug that no behavioural test caught. `SHOW_ROLES`
said `side:'exhibitor'` while `exhibitorTurn()` returned `'producer'`. Both
values were reasonable; they were simply two names for one concept, so every
comparison between them was silently false and the winery's badge, list sort
and chips were dead. Verified by re-introducing the bug: the behavioural
tests stayed green and only the contract failed.

The same file also asserts that the **demo fixtures reach both sides** of the
handshake. A contract can hold while the fixtures only ever exercise one
side, which leaves the other untested for the wrong reason.

`follow-feed.js` carries the sharpest version of that idea. Its subject is a
leak that can only happen if some account follows a producer confirmed at a
still-anonymised show — and when it was written, no such pair existed in the
demo graph. Every assertion passed, and all of them passed **vacuously**. The
pair was added to `wineFollowGraph` on purpose (Weinhaus Müller follows
Bodegas Ruiz, confirmed at Grande Rioja), and the harness now fails if it is
ever removed. A test whose subject cannot occur is not a passing test.

## Known and tolerated

`check-static.js` carries one short allowlist, with the reason inline:

- `KNOWN_UNSTYLED` — `profile-badge` and `badge-own-label` are leftovers of the
  pre-B9 naming convention. Every element carrying them styles itself inline,
  so there is no visual defect, but the class names are dead weight. Removing
  them is a visual decision across 17 elements; tracked in HANDOFF.

It is checked in **both** directions: an entry that no longer applies fails the
run, so the allowlist cannot quietly outlive the problem.

Enum-driven class names carry no allowlist. Every state in `SHOW_STAGES` and
`PARTY_STATES` must have a rule even when the state is not reachable through
the UI yet — an unstyled pill otherwise reveals itself the first time the state
occurs, which is the worst moment to find out.

## Verifying the checks themselves

A check that never fails is worse than no check. Both `check-static.js` and the
vocabulary contract in `wine-handshake.js` were verified by re-introducing the
faults they are meant to catch — duplicate id, escaped container, missing CSS
class, renamed `onclick` target, syntax error, and the `side` vocabulary
mismatch. Do the same when adding a check: mutate a copy, confirm it fails.

    node check-static.js /tmp/mutant.html

The asset checks were verified the same way, against three mutations:

| Mutation | Caught by |
|---|---|
| Asset file deleted | `check-static.js` by name; all five harnesses fail |
| Asset file emptied | `check-static.js` by name; all five harnesses fail |
| Asset present and parsing, but throwing at run time | The four behaviour harnesses. `check-static.js` passes, correctly — nothing is statically wrong with it |

That third row is the division of labour working: a static check should not
claim to know what a file does when it runs.

The A16.7 checks were verified against four more, run against a **copy of the
repo** rather than the working tree — `rsync` excluding `tests/node_modules`
and `.git`, with `node_modules` symlinked back in:

| Mutation | Caught by |
|---|---|
| `publicLevelFor()` always returns `'full'` | `public-shows-page.js` names the leaked exhibitors, wines and venue; `wine-shows.js` catches it too |
| `'draft'` added to `PUBLIC_UPCOMING_STAGES` | `public-shows-page.js`: *non-public stages listed: Sicilia Prima (draft)* |
| Shared stylesheet emptied | `check-static.js`, by filename |
| One rule deleted from the shared stylesheet | `check-static.js`: *emitted by the shared renderer, no CSS rule: `.ws-teaser-hero`* |

Mutating a copy is the better habit: the mutation cannot survive a crashed
run or a forgotten restore, and the working tree is never in a state where an
interrupted session would leave something broken behind.

The profile tab added three more, again on a copy:

| Mutation | Caught by |
|---|---|
| Exhibitors made visible from `planning` | `profile-shows.js`: Bodegas Ruiz and Weingut Schmitt list *Grande Rioja* without hosting it |
| One `data-entity` misspelt | `profile-shows.js`: *data-entity "Bodegas Ruis" but the page is about "Bodegas Ruiz"* |
| A hand-written show left in a profile's markup | `profile-shows.js`: *show titles hard-coded — Primavera Italiana* |

And three for the announcement channel:

| Mutation | Caught by |
|---|---|
| Feed derived from raw participation instead of `publicParticipation()` | `follow-feed.js`: *feed announces Bodegas Ruiz at the anonymised "Grande Rioja"* |
| `renderAppearanceWidgets()` dropped from `refreshShows()` | `follow-feed.js`: followers of the host are not told when a show is released |
| The followed-but-anonymised fixture edge removed | `follow-feed.js` fails outright — see the note above |

Persistence was verified against the faults it exists to prevent — including two
that shipped and were found in the browser rather than here:

| Mutation | Caught by |
|---|---|
| `let sneakyNewState = []` added to the dashboard | `persistence.js`: *top-level state that is neither persisted nor declared transient: sneakyNewState* |
| The save heartbeat removed | `persistence.js`: *a change with no event after it was never saved* |
| The last write remembered in memory instead of compared against storage | `persistence.js`: *after the storage was cleared behind its back, the store never wrote again* |

> **Never supply the event the mechanism is supposed to notice.** The save
> trigger passed a round-trip check that called the action and then dispatched
> the click *itself* — proving only that the store could serialise. Both faults
> above lived behind that. The checks now press the real buttons and touch
> nothing afterwards, and one changes state with no event at all. Note that the
> real-button check alone still passes against the broken version, because that
> click does bubble afterwards; it took the no-event case to expose it.

The isolation checks need the opposite kind of care: they can pass for the wrong
reason. At an opaque origin jsdom provides no `localStorage` at all, so a
kill-switch check would succeed against a page that could not have persisted
anything either way. `persistence.js` therefore gives jsdom a URL, which makes
the storage real and the switch load-bearing. Any future check of this kind
should ask the same question first: *would this still pass if the feature were
removed entirely?*

Two assertions in `profile-shows.js` were wrong before they were right, and
both errors are worth knowing about. The first tried to validate
`data-entity` against the names appearing in the show records — but an
account with no shows is legitimately absent from them, so nine correct
pages failed. There is no account registry in the prototype; the check now
compares against the page's own `<title>`, which catches the realistic fault
(a mangled name) without pretending to validate against something that does
not exist. The second forbade naming any exhibitor of an anonymised show
anywhere on a page, which broke on Weingut Schmitt — anonymous at Grande
Rioja and rightly named at Loire & Mosel, on the same profile. The
assertion is now scoped to the anonymised show's own card.

**One repair fell out of this.** `invite-render.js` never called
`process.exit(fail ? 1 : 0)`, so it exited 0 whatever it found. Every assertion
in it was decorative — `run-all.js` reads the exit code, and only an outright
crash ever reached it. It also collected `jsdomError`s and merely printed them.
Both are fixed; the file now ends like the other three.
