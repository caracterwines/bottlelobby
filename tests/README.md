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

## Still ad hoc

The structural checks are not in here yet — duplicate ids, div balance and
nesting, `onclick` handlers defined, CSS class cross-check, and `node --check`
on the extracted script block. They are run by hand each session and are the
remaining half of the C3 gap.
