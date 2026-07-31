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
| `check-static.js` | Structure rather than behaviour, and runs first: external assets present, non-empty and in the right order, JS syntax (the `node --check` step), duplicate ids, `getElementById` targets that exist, div balance and — via jsdom — that children have not escaped their container (B10), `onclick` handlers defined, CSS classes used in the markup defined, and that enum-driven class names like `ws-<stage>` cover the whole enum. Takes an optional file argument so a variant can be checked without touching the real file. |
| `load-dashboard.js` | Not a harness — the shared loader every harness reads the page through. See the section below; it is excluded from `run-all.js` on purpose, because a module that does nothing exits 0 and would read as a passing check. |

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

**One repair fell out of this.** `invite-render.js` never called
`process.exit(fail ? 1 : 0)`, so it exited 0 whatever it found. Every assertion
in it was decorative — `run-all.js` reads the exit code, and only an outright
crash ever reached it. It also collected `jsdomError`s and merely printed them.
Both are fixed; the file now ends like the other three.
