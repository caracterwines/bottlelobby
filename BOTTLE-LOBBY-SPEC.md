# BOTTLE LOBBY — MASTER SPECIFICATION

> **Status:** Single source of truth for all permanent rules.
> **Scope:** Architecture, data model, conventions. Not session state — that lives in `HANDOFF.md` in the repo.
> **Language note:** Written in English because it doubles as the developer handoff for the real Next.js/Supabase build. Communication with Serge remains German.
> **Maintenance rule:** This file is REPLACED, never appended. When a rule changes, a full new version is delivered and swapped in the project knowledge.

---

## 0. PROJECT CONTEXT

**Company:** Caracter Media GmbH (Karlsbad, Baden, Germany)
*Not* "Caracter Wines GmbH" — that name was used incorrectly in earlier sessions and has been corrected sitewide. Domain/email `caracterwines.de` currently unchanged.

**Product:** Bottle Lobby — B2B SaaS platform connecting four wine trade stakeholder types:
Wineries · Distributors · Restaurants · Retail (Fachhandel)

**Core value proposition:** Structured networking and discoverability across the wine trade.

**Team:** Serge Khaled (co-founder, marketing) · Kelly (management)

**Current phase:** Static HTML/CSS/vanilla-JS prototype for investor and stakeholder demos.
**Target build:** Next.js / Supabase with a fully relational data model, to be built with Claude Code.

**Live infrastructure:**

| | |
|---|---|
| Repository | `caracterwines/bottlelobby` (public), default branch `main` |
| Hosting | Netlify project `bottlelobby` |
| Live URL | https://bottlelobby.netlify.app |
| Deploy trigger | Automatic on every push to `main` (~7 s build) |

**Critical framing:** The prototype fakes relational linking through content duplication across files. This is an acknowledged mockup shortcut, never the target architecture. Every duplication in the prototype maps to a relation in the real build.

**Design system:**
| Token | Value |
|---|---|
| Background | `#0e0b0b` |
| Text | `#f7f3ee` |
| Wine red | `#6b1a1a` |
| Gold | `#b8975a` |
| Headings | Cormorant Garamond |
| Body | Inter |

---

# PART A — DATA ARCHITECTURE (real platform build)

> **Terminology note:** Sections A1–A14 are written in wine vocabulary — "winery", "wine",
> "grape variety" — because wine is the launch category. **A15 generalises this to any
> beverage category** (spirits, beer, cider). Read "winery" as *producer* and "wine" as
> *product* throughout; A15 defines the mapping. The schema must be built category-capable
> from the first migration, even though the interface ships wine-only.

## A1. The Single-Source-of-Truth Rule

**The one rule everything else derives from:**

> Whatever a stakeholder enters or uploads lives in exactly ONE place, owned by whoever entered it. Every other place it appears must reference that source live — never store a copy. Edit at the source once → updates everywhere immediately, with zero separate action anywhere else.

This applies to **everything**:
- Wines
- Awards
- Press & Recognition
- Trade Reviews
- Wine Shows
- Orders
- Images / media uploads (Photos & Media, Media Gallery)
- Free text (About/Story, tasting notes, descriptions)

**Reference pattern to follow:** Wine Shows already model this correctly — an event is created once by its host; other stakeholders get a participation/attendee relation to that same single event record. Orders follow the identical shape: one record, two parties, two perspectives. Use this as the template for how Wines, Awards, Press and Reviews relations are built.

**A16 works this pattern out in full** — hosts, exhibitors, venue, attendees and products all hang off one `wine_shows` record, and every product on a show is a foreign key into the producer's own `products` table, never a copy. Read it as the worked example of this rule.

**A2 records what the rule costs when it is missed.** The two things every other record refers to — a stakeholder's own identity, and the partnership between two of them — were the last to get an owner, and by then both had already drifted in the prototype: the same house wore two different badges on two dashboards, and one partnership carried two different start dates. Neither looked wrong on screen, which is the point. A second copy does not announce itself; it renders perfectly until the day it renders differently.

---

## A2. Ownership Map — who owns what

| Data | Owner | Others get |
|---|---|---|
| **Stakeholder identity** — name, type, badge, region, city, public page | **The stakeholder itself, in one `stakeholders` row** | A foreign key. Never a copy of the name, the badge or the page |
| Wines | Winery | Reference/FK relation |
| Awards | Winery (that earned it) | Reference |
| Press & Recognition | Winery | Reference |
| Trade Reviews | Written by Distributor/Restaurant/Retail, **published only with winery approval** | Reference |
| Wine Shows | Host | Participation relation |
| Partnerships | **Neither party — the relation is its own record**, one row with two ends | Both render the same row from their own side (A6) |
| Orders | Shared record between buyer and seller | Both render the same row |
| Promo Materials | Distributor | Visible to active partners only |
| Exclusive Offers & Deals | Distributor | Visible to active partners only |
| Profile content / media | The stakeholder itself | Reference |

### Identity is data, and it belongs to nobody's list

The first row is the one that is easiest to skip and the one that was
actually violated. A house's own name, badge, region and public page are not
"details on a partner card" — they are the house's record, and every list that
mentions the house references it.

**What it cost when they were not:** the prototype carried type, badge, region
and public page inside twelve arrays at once — the partner lists of all four
roles, the eight request lists and the follow graph. They had already drifted.
Hawesko GmbH rendered as **HW** wherever an array stored a badge and as **HG**
wherever a renderer computed one from the name, on two dashboards at the same
time, and neither was identifiably wrong. The winery's partner list carried no
public page at all, so the winery was the one role that could not reach its own
partner's profile (A11).

Two consequences the real build must keep:

- **A badge is a field, not a computation.** Initials look derivable until
  "Cave à Vins Lyon" comes out as *CÀ*. Two letters a house is known by are a
  choice somebody made, and a choice is data.
- **Absence is a legitimate answer.** A house that appears only as a name on a
  guest list has no identity record, and inventing one so a lookup succeeds is
  the same violation from the other direction. A lookup that misses says so —
  it renders the name, omits what it does not know, and reports the miss (B12).

---

## A3. The Supply Chain Model

```
WINERY ─────────► DISTRIBUTOR ─────────► RESTAURANT
                    ▲      │        └────► RETAIL
                    └──────┘
              a distributor may also buy
              from another distributor
```

**Hard rule:** Restaurants and Retail source wine **exclusively via a Distributor partner**. Direct-from-winery sourcing for Restaurant/Retail **does not exist** in the model.

The loop at the distributor is the second sourcing route, and it is ordinary trade rather than an exception — see *Where a distributor sources* below.

Consequences for the build:
- Restaurant/Retail never create or own wine data.
- Their "Wine List" / "Wine Selection" is a **picker/search over a connected distributor's portfolio** — never a creation form, never a winery-direct picker.
- The join-table relation records restaurant/retail-specific fields: glass price, bottle price, menu category.
- The **"View Distributors" popup** on wine article pages is the discovery mechanism for finding a distributor.

**Distributor portfolio:** Only wines actually taken on via purchase/partnership appear — never a winery's whole catalog automatically. The act of purchasing/partnering creates the relation.

**Own-Label:** Not a flag on the winery→distributor wine link. An own label is **its own product**, created by the winery out of a project, and the distributor's own-label status is **derived on his listing** from two conditions — first commercial delivery confirmed, and holder = the project's primary distributor. The model is A17 (A17.0a, A17.0b, A17.9, A17.12); the earlier flag reading is Appendix D **D36**, **D37** and **D41**. A producer-owned brand sold exclusively by one distributor is **not** an own label — it is an ordinary product plus a distribution exclusivity (A17.0b, D41).

### Where a distributor sources — the rule in full

A8 has named **Distributor ↔ Distributor portfolio supplementation** as a case since
it was written, and A17.9b describes the downstream holder in detail. The chain above
never said it out loud, so the rule is stated here once, for **ordinary wine**, and
own label is the special case rather than the other way round.

1. **A distributor buys wine from a winery OR from another distributor.** Both are
   ordinary purchases, and both are the same order record read from two sides (A14.1).
2. **A may sell ordinary wines he lawfully carries to B**, provided an **active A↔B
   partnership** exists (A6) and A's ordinary distribution agreement permits this
   route, this territory and this channel.
3. **Sub-distribution is not an own-label privilege.** Where A is the exclusive
   distributor for the whole winery and the agreement permits sub-distribution, A may
   resell single wines or his entire eligible range to B. **The platform does not
   restrict this route to own labels** — the A17 machinery exists for own-label
   products and says nothing about ordinary trade.
4. **Nothing is copied.** B receives **his own listing per wine taken on**: the same
   `productId`, his own `tradePrice`, his own article number, his own commercial
   fields. The listing key is `(holder, productId)` (A15.2a), so this needs no schema
   change and no second product record — invariant 2 holds unchanged.
5. **The producer stays the winery. B's source and seller is A.** Five facts stay
   apart here exactly as they do in A17.9b: producer · source · seller · holder ·
   distribution right.
6. **The A→B order creates nothing else.** No partnership, no purchase right and no
   exclusivity arises between B and the winery. An order is a purchase, never a
   relation.
7. **A17 Market Grants are checked for own-label products ONLY.** An ordinary wine is
   never refused because no project or grant exists — `ownLabelOrderRight()` answers
   `null` for a product with no project, and a `null` is silence, not a refusal.
8. **What governs an ordinary wine is the partnership, A's listing, and whatever
   distribution reach the contract fixes. That agreement is NAMED here, not
   modelled.** There is deliberately no second grant construct beside A17.9a: one
   structure for own-label grants and a parallel one for ordinary contracts is D36 a
   third time. If the platform ever has to enforce ordinary distribution terms, it
   gets its own measured pass and this sentence is where it starts.
9. **Restaurant and Retail still buy exclusively from a Distributor.** D2D changes
   nothing at the end of the chain — it lengthens the middle, it does not open a
   shortcut.

**This rule governs the flow of goods, not the flow of money.** A distributor invoicing a producer for a service — a Wine Show catering contribution, `source: 'wine_show_catering'` (A16.11) — runs against the arrows above and is not a breach of them: no product changes hands, and such an order may not carry product lines at all. Only a route by which wine reaches a buyer is a supply chain shortcut. Wine bought off the back of a show (`wine_show_order`, A16.12) runs the arrows the normal way and is an ordinary purchase.

### Whoever advertises, discounts or names a wine as a promo condition, carries it

An Exclusive Offer, an Exclusive Deal or a promo condition over a wine **outside
the distributor's own portfolio is the same invariant 3 gap as a sale, only
delayed** — it fires the moment somebody accepts. The order line then has to name
a producer the distributor has no relation with, and goods move down a route that
does not exist.

This is a rule, not a case-by-case judgement, because it re-forms every time
somebody writes a new offer. Concretely: the wine named by any commercial record
must be in the book of the house making the promise, and `tests/supply-chain.js`
asserts it over offers, deals and promo materials alike.

Measured when the rule was written: three wines — Nero d'Avola, Baglio Rosso and
Pouilly-Fumé — were being offered or discounted by a distributor that did not
carry them. One had already been sold downstream, one had 180 bottles delivered
in, and one was still only a promise. **The one that had not fired yet is the
reason this is a rule**: nothing distinguished it from the other two except
timing.

### Removing goods is not a repair when they have already moved

When the data says a wine reached a buyer, the sale is the harder fact. Deleting
the wine to make a rule hold leaves orders pointing at something that no longer
exists — the same contradiction, moved somewhere quieter. Add the missing
relation instead, and date it correctly (C7: the earliest dependent event is the
ceiling).

Applied twice on 3 August 2026: Château Belrieu gained the partnership two
orders already depended on, and eight wines that buyers had been choosing and
being sold for months were taken into the distributor's portfolio rather than
withdrawn from the picker.

**Generalised on 4 August 2026, Serge's rule and it governs every correction
from here:** when a rule and the data disagree, **add the missing record rather
than remove the offending one**. A deleted row takes a fact with it and obliges
whoever deletes it to prove nothing depended on it; a backfilled order adds one
and only has to be dated correctly. It also leaves the demo richer rather than
thinner — more paths through the product are exercised, not fewer.

> **The boundary against C7, because the two rules sit next to each other and
> are not the same rule.** C7 forbids growing the fixtures *so that every message
> type reaches every role* — an empty case with a nameable reason demonstrates
> the problem the platform solves. This rule is about a fact the model says must
> exist and the data does not carry. So: **never grow to make a check green;
> grow to record a fact that ought to be there.** Château Belrieu's *"0 wines in
> your portfolio"* stays — that is an empty case with a reason. A wine sold
> without a matching purchase gets the purchase — that is a missing fact.

### A list is an offer; a shelf is stock

Restaurant and Retail do not carry the same condition, and treating them alike
was wrong:

| | What the list is | Condition for a wine to appear |
|---|---|---|
| **Restaurant** — Wine List | an **offer**. The guest orders, then it is delivered | an active distributor partnership, and the wine in that distributor's portfolio |
| **Retail** — Wine Selection | a **shelf**. The customer carries the bottle out | additionally **an order of their own** — a sample order or trial bottles are enough |

A retailer cannot sell a bottle they do not have; a wine list can name a wine
that arrives tomorrow. This is Serge's decision of 4 August 2026 and it
supersedes the uniform rule of 3 August (Appendix D **D35**).

> **The rule holds; the prototype does not carry it yet.** Weinhaus Müller's
> selection is still the three wines it has never bought, and the pass that
> brings the data to this rule — *A3 retail condition* — is queued behind
> `listings`. D35 records what has to happen and what has not happened. Read the
> table above as the condition to build to, not as a description of the fixtures.

It is worth noticing that this is **the same distinction three times over**, at
three points in the chain: stock versus pre-order on a Wine Show (A16.12),
portfolio versus stock at the distributor, and shelf versus menu at the buyer.
In each case the weaker condition is a *relationship* and the stronger one is a
*purchase*. A rule that says the same thing in three places is usually the right
one.

---

## A4. Master Data (admin-maintained, never free text)

These wine attribute fields must **never** be free-text inputs for wineries. They are selected from shared master-data tables maintained centrally in an admin panel:

| Field | Type |
|---|---|
| Vintage | Select |
| Grape Variety | **Multi-select** (blends) |
| Country | Select — top of cascade |
| Region | Select — depends on Country |
| Appellation | Select — depends on Region |
| Aging Duration | Select, realistic month range (~3–60) |
| Aging Method | Fixed enum: stainless steel, concrete, oak barrique types, foudre, amphora, etc. |

**Cascading hierarchy:** Country → Region → Appellation. Region options depend on selected Country; Appellation options depend on selected Region.

**Coverage goal:** Every wine-producing country's real regions/appellations, and eventually every grape variety worldwide — not a starter subset.

> **Why this matters beyond data hygiene:** every automation that matches a wine across features — promo thresholds, deal ratios, order lines, variety hub pages — depends on wines being the same *record*, not the same *string*. See the naming-drift warning in A14.4.

**Prototype blueprint:** `bottle-lobby-winery-profile.html` Edit Wine modal — `wineGeoData` cascading object, `grapeVarietiesUnique` array, `agingMethods` array, `populateRegions()` / `populateAppellations()`.

---

## A5. Awards, Press & Trade Reviews

### Awards
Owned by the winery, entered once, linked to a specific wine. **Structured template, never free text:**

- Competition/Award name
- Year
- Wine (FK)
- **One-or-many Result rows** (child table, one-to-many — a single competition can award multiple results)
- Link to organisation
- Optional certificate/medal upload → shown as clickable thumbnail on the wine article page

**Result Type** is a central admin-maintained enum, and it drives whether a value input appears and what it asks for:

| Result Type | Value asked |
|---|---|
| Points | Score |
| Star Rating | Stars |
| Trophy | Trophy name |
| Best in Class | Class |
| Grand Prize | Prize name |
| Other | Free description |
| Gold / Silver / Bronze / Grand Gold Medal | *(none — the medal IS the result)* |
| Recommended | *(none)* |

### Press & Trade Coverage
Owned by the winery. Structured template:
Magazine/Organisation + Date + Article title + Short description + Link to article + optional PDF/scan upload (for print pieces with no online version).

### Trade Reviews
Written by distributors/restaurants/retailers from **their** profiles about a winery's wine.

**Approval workflow is mandatory.** A review arrives with status `pending` and does **not** appear on the wine article page until the winery approves it in their dashboard. The winery sees reviewer name, role, stars, text and which wine, then Approve & publish or Decline. Approved reviews can be unpublished again later.

Statuses: `pending` / `approved` / `declined`

**Prototype blueprint:** `bottle-lobby-winery-profile.html` — `awardsData`, `pressData`, `reviewsData` arrays; `awardResultTypes` + `resultValueConfig` enums; `openAwardModal()` / `openPressModal()` / `approveReview()`.

---

## A6. Partnership Workflow

Partnerships work in **both directions**. A distributor/restaurant/retailer requests a partnership with a winery; a winery can equally request one from a distributor/restaurant/retailer. "Request Partnership" buttons exist on all public profiles of all four types, plus previews and every tab of the Profile Demo Page.

Until a partnership is confirmed, the requesting side only sees the public summary — not the full profile, direct contact or wines.

### Four-stage workflow (`partnership_requests` table, `stage` field)

**1. `sent`**
Requester clicks "Request Partnership" on the other party's public profile. A modal shows the exclusivity clause. The confirm button is **hard-disabled** and only enables when the "I agree" checkbox is ticked.
The clause is **mirrored** by direction:
- Stakeholder → Winery: confirms exclusive import/distribution/resale of that winery's products only via the platform.
- Winery → Stakeholder: confirms exclusive export/distribution/sale of its wines to that partner only via the platform.

Both include: no channels outside the platform; no passing on contact details or commercial terms to third parties without written consent.

**2. `accepted`**
The receiving side accepts in their own dashboard and confirms the mirrored clause with its own checkbox (same hard-disabled-until-ticked rule).
- Winery side: **Network → My Requests**
- Stakeholder side: **Network → My Requests**

Both sides reach the same record under the same path. The two directions are stacked inside that one section — Incoming Requests first, Outgoing Requests below (B8). The older wording here named *Network → Requests* and *Network → Incoming Requests*, two paths that predate the section merge (D21) and the section rename (D39) and no longer exist.

**3. `contract_pending`**
Bottle Lobby sends **two contracts**, one to each side. Both must be completed, signed and returned. Every partnership therefore always involves two signed contracts.

**4. `active`**
**Bottle Lobby staff confirm the partnership manually in the internal company admin panel once BOTH signed contracts have been received.** Only this admin confirmation moves the partner into "Active Partners"/"Active Wineries" and unlocks full profile access, direct contact and wine listing.

> This admin-gated final step is deliberate and must exist in the real build. It is the control point that enforces the exclusivity model and **cannot be automated away.**

**An active partnership is the gate for everything commercial:** promo materials, exclusive offers, exclusive deals and **the ability to place an order** (A14) are all visible only between actively partnered parties.

> ⚠️ **A free-text inbox would be a side entrance around this gate, and must not be
> built as a surface decision.** Person-to-person correspondence — a distributor
> writing to a winery it has no partnership with — bypasses the whole of A6 and
> the admin confirmation that enforces it: the parties would be in contact,
> agreeing terms, with none of it passing the control point invariant 6 exists
> to protect. Notifications are a different thing and are fine, because they are
> *derived from records that already exist* and disclose nothing the recipient
> could not already see (A16.11 step 5, A7). **If a real inbox is ever wanted,
> the question to answer first is not how to build it but who may write to whom
> — and the answer belongs in this section before any of it is built.**

### Where each role manages partnerships

| Role | Sections in their dashboard |
|---|---|
| Winery | **My Distributors** (confirmed, grouped by region, showing how many of the winery's wines they list) · **My Requests** (incoming + outgoing stacked in one section, incoming first; incoming carries accept/decline + clause modal) |
| Distributor | **My Partnerships** (grouped by region) · **My Requests** (incoming + outgoing stacked in one section, incoming first) |
| Restaurant / Retail | **My Distributors** · **My Requests** (incoming + outgoing stacked in one section, incoming first) |

All four roles use the same two-item **Network** sidebar section (B8, D39). The distributor's first item is called *My Partnerships* because it partners with three role types; the other three partner only with distributors, so the more specific *My Distributors* is kept.

Each of these carries the same four-stage progress indicator, so both sides always see the identical stage of the identical request record.

### One record, two ends — and what a second copy costs

**A partnership is a single row naming its two ends.** Not a list per dashboard.
The sentence above — *"both sides always see the identical stage of the
identical request record"* — is only true if there is one record; with a book
per role it is a hope maintained by hand.

**Measured, not feared.** The prototype kept four books (`activePartners`,
`wineryPartners`, and one each for restaurant and retail), and three
partnerships existed in two of them at once. They had drifted: the
Weinhaus Müller ↔ Hawesko partnership was dated **14 Apr 2026** in the
distributor's book and **"March 2026"** in the retailer's own list, and nothing
in the system could say which was right. Neither screen looked wrong.

Two things follow for the schema:

- **Every partnership has exactly one distributor.** The other three roles
  partner only with distributors (invariant 3), so the row may name its ends
  — `distributor` and `partner` — rather than holding an unordered pair. Each
  end asks for its own list and renders from its own side, exactly as an order
  does (invariant 8).
- **A derivation that needs "the other party" reads it off the row.** Asking a
  global "the distributor" works only while there is one, and it hides the
  assumption instead of stating it. Concretely: a Wine Show's pickers offer the
  **host's** partners (A16.4), not a platform-wide list, and *"X now has a
  distributor"* (A8) takes the producer's **first** partnership — gaining a route
  to the trade is an event that happens once, not once per distributor.

**Activation date and actor belong on the row.** `at` in ISO, comparable rather
than a display string, and `activated_by` — because a partnership goes active
on a manual Bottle Lobby confirmation (invariant 6), and a notification derived
from it must not invent who did that (C9).

> **A partnership added after the fact cannot start after the first sale made
> through it** — that is the same contradiction one step quieter. When a
> relation is backfilled, the earliest record depending on it is the ceiling
> for its date. The general rule and the procedure are in **C7**; it applies to
> any master row added retroactively, not only to partnerships.

**A figure on a partner card is counted, never stored** (invariant 7). The row
holds the relation and nothing else: who, when, who activated it. Every number
beside it — how many of a producer's wines a distributor carries, how many
wines a buyer can source through this partnership — is a count of the
distributor's portfolio at the moment of rendering.

They were stored once, and it went the way stored figures go. Cantina Rossi's
card read *"6 wines in your portfolio"* where the portfolio held **1**, Weingut
Schmitt's read 1 where it held **2**, and the restaurant and the retailer named
**5** and **6** for the identical book. Nothing on either screen looked wrong.

Three rules came out of the repair:

- **Name the book before counting it.** The prototype had three wine lists that
  could plausibly be called "their portfolio". Only one is owned by anybody:
  the distributor writes it, and it is the one that persists. The other two are
  pickers — `const`, never written, byte-identical copies of each other, and
  their producer field holds the *supplier*, so they cannot answer invariant 2
  at all. A list that cannot name the producer is a menu, not a portfolio.
- **No book is not an empty book.** A distributor with no portfolio record
  yields `null`, not an empty list, and the card names no figure. *"0 wines"*
  is a claim that the house carries nothing; what is actually known is that
  there is nothing here to count. Same distinction as A2's unknown stakeholder.
- **A derived figure obliges its surface to move.** A stored number is stale by
  design and behaves consistently; a derived one is wrong the moment its input
  changes and the screen does not follow. Pulling one wine into a portfolio
  changes a number on partner cards in **all four roles**, and every one of
  them has to be repainted by that single action — no second click, no reload.

**Prototype blueprint:** `portfolioOf(distributor)` / `portfolioCount(distributor, producer)`
and `partnerMetaFor(row, me)` in `bottle-lobby-dashboard.html`, next to
`currentWinePortfolio`; `refreshPortfolioCounts()` after every write to it.
Guarded by `tests/partner-counts.js`, which counts the book itself rather than
asking `portfolioCount()` — under the mutation it exists to catch, asking the
product would be circular.

**Prototype blueprint:** one `partnerships` array in `bottle-lobby-dashboard.html` — four fields, `distributor` / `partner` / `at` / `activatedBy` — read through `partnershipsOf(me)` / `partnerSide(row, me)` / `arePartners(a, b)`; `renderPartnerNetwork()` (distributor), `renderWineryNetwork()`, `renderRestaurantNetwork()` and `renderRetailNetwork()` all render that one array from their own end. Requests are still per role — `partnerRequests` / `incomingRequests` / `wineryRequests` / `wineryOutgoingRequests` and the restaurant and retail pairs, with `openAcceptModal()` / `confirmAccept()` / `declineRequest()` / `openIncomingAccept()`; they hold no pair that exists twice today, but they are the same shape and the same argument applies when they are built for real. `openPartnershipModal()` / `confirmPartnership()` on all public profiles; parameterised `partnershipCopy` object in `bottle-lobby-profile-demo.html`. Guarded by `tests/stakeholders.js` (the relation) and `tests/partner-counts.js` (the figures).

---

## A7. Follow Feature (My Stars / My Fans)

Following works between **any two stakeholder types** — not just Restaurant/Retail → Winery. Every public profile of all four types has a "🔖 Save & Follow" button.

**Semantics:** A follow adds the target to the follower's own "My Stars" list AND adds the follower to the target's "My Fans" list, generically across all pairings. The followed party gets a "X started following you" dashboard notification. Following needs no partnership, and this notification is the reason that is safe: it is derived from the follow record itself and says nothing the followed party could not already read in My Fans. A message someone *writes* is the opposite case — see the warning in A6.

This follow/fan graph is the **core data signal for Matchmaking**.

### Naming per role

Both directions carry the same label in every role — the follow graph is one symmetric relation, and naming it differently per dashboard obscured that:

| Role | "who I follow" | "who follows me" |
|---|---|---|
| Winery | **My Stars** | **My Fans** |
| Distributor | **My Stars** | **My Fans** |
| Restaurant / Retail | **My Stars** | **My Fans** |

Every role shows **both** directions. The earlier per-role labels ("Wine Stars", "Wine Fans") and the hidden cells are gone — see Appendix D (D20).

### Network and Community are two different lists

**Network** is the business side: confirmed partnerships, requests, contracts, trade relations — everything A6 governs. **Community** is the follow side: My Stars (whom I follow), My Fans (who follows me), the signals arising from them, opportunities, and later matchmaking results. `Save & Follow` stays the entry to Community; the partnership workflow stays the entry to Network. Both are sidebar sections in all four roles (B8), and the rename that gave them these names is Appendix D (D39).

**A follow is not a partnership, and it is not marketing consent.** It is a directed edge and a signal, nothing more. It creates no commercial right, obliges nobody, and does not license anyone to address the follower. Every commercial gate in this model reads the partnership (A6), never the follow graph.

**Privacy rules on the community side**, and each of them is the reason the graph can carry announcements at all (A16.7):

- **No foreign follow graph is exported.** A house reads its own two lists. Nobody downloads somebody else's community, and no feature resolves one into a recipient list for a third party (A16.14e).
- **Only the explanation signals a suggestion actually needs are shown**, never the underlying graph in full (A8).
- **Blocks, unsubscribes and notification preferences are respected everywhere**, including on announcements the host is entitled to send.
- **A community is never used automatically by anyone else.** A winery exhibiting at a distributor's show does not thereby address the distributor's fans.

**Community notifications derive from real data changes and relations only** — the three conditions of C9, applied to this graph: a followed winery publishes a wine · a star exhibits at a show (the existing *From Your Stars* feed, A16.7) · a followed restaurant or retailer publishes a member event (A16.8) · a new explainable opportunity exists (A8) · an offer matches a stated seek (A8). Never a stored feed, never a message table.

**An edge is only the edge:** who follows whom, and since when. Everything about either house — its type, badge, region and public page — comes from that house's own record (A2), and the edge stores none of it. It used to store all four, describing the *follower*, which meant a house carried its own profile once per follow: Hawesko GmbH four times over.

**Prototype blueprint:** shared `wineFollowGraph` array in `bottle-lobby-dashboard.html`, three fields per row — `follower` / `winery` / `at`; generic renderers `renderFansFor(entityName, listId, countId, emptyMsg)` and `renderWineStarsFor(followerName, listId, countId)` — **all four roles now call both**, with only the entity name differing; shared `roleAv` / `roleTag` / `roleLabel` maps covering all 4 types, plus a `wn-av-winery` / `rt-winery` CSS pair for the winery role.

> ⚠️ **Field-naming debt to fix in the real build:** in the prototype the *followed entity* field is still called `winery`. That was backward compatibility with the first version, when only wineries could be followed. In the real build name it properly — `followed_id`. The companion `followedType` field is already gone: what the followed account **is** was never the edge's fact to hold, and `stakeholder(name).type` answers it from the one place that owns it.

Demo data deliberately spans all four types (Cantina Rossi, Château Belrieu and Bistro Laurent follow Hawesko GmbH; Hawesko follows Henri Dubois Domaine, Weinhaus Müller and Osteria Marconi) so the cross-type model is visible without explanation.

---

## A8. Matchmaking

A two-sided **"I'm seeking / I'm offering"** system for **all four** stakeholder types — not only Winery↔Distributor.

Every stakeholder states both what they're SEEKING and what they're OFFERING; the system matches on either side. Example: a Restaurant seeks a distributor in its region; a Distributor separately seeks Spanish restaurants in a region — these two searches match each other.

**Matching dimensions** (extensible — start simple, add later):
- Geography / region
- Grape variety or wine style sought
- Distributor's Wine Portfolio matched against what a Restaurant/Retail seeks
- Event-driven needs (a Restaurant needing wines for an event; either side wanting to host/co-host a Wine Show)

**Same-type pairings must also be supported:**

| Pairing | Use case |
|---|---|
| Winery ↔ Winery | Co-create a wine/cuvée; buy/sell bulk wine or must (OEM-style supply); co-host Wine Shows; joint events |
| Restaurant ↔ Restaurant | Co-organize events |
| Distributor ↔ Distributor | Plan events; exchange/supplement wine portfolios |
| Retail ↔ Retail | Collective/bulk ordering for better purchasing conditions |

All same-type pairings follow the same 4-stage partnership workflow (A6).

**Key cross-referencing use case:** If a Distributor sees that one of their own Restaurant/Retail partners follows a Winery they don't yet carry, but another Distributor already has that Winery under contract, the first Distributor can request a Distributor↔Distributor partnership with the second specifically to pull that Winery's wines into their own portfolio (referenced, never duplicated).

**The same relation read from the follower's end — built as a notification (C9).** The case above is written from the Distributor's side only. The other direction is a match in its own right: **"a winery I follow now has a distributor."** For a Restaurant that means a wine it could not source until now has become orderable — the supply chain has no shortcuts (invariant 3), so a followed winery without a distributor partner is exactly a wine out of reach. The trigger is a new `active` partnership on a winery somebody follows, which is the follow graph (A7) and the partnership stage (A6) read together; both exist.

It is a **notification, not a list to visit** — see C9, which also carries the second signal of the same shape ("a new wine" at a producer I partner with or follow) and the rule that both must ask one function whether a relation exists. Matchmaking proper is still unbuilt; these two are its first arrivals.

Note that *"a winery I follow is exhibiting at a show"* is **not** part of this — it already exists as the "From Your Stars" feed (A16.7) and needs nothing here.

**A8 needs a surface where matches arrive, not only a list to visit.** Matchmaking is specified as something a stakeholder goes and looks at. The notification list (C9) is the first place a match can arrive unbidden, and the regional notification is the first real application of A8 rather than an exception to C9 — see C9 for why that reframing matters and what it does *not* change.

### The seek/offer model, stated in full

Every stakeholder maintains two lists, and both are theirs alone:

| | Holds |
|---|---|
| **I seek** | wines, styles, origins, varieties, own-label opportunities, distributors, wineries, locations, wine shows, member events, services |
| **I offer** | wines, own-label production, distribution, market grants (A17.9a), locations, events, catering, promotional material, services |

Each entry carries criteria: category · tags · geography · channel · validity · volume or capacity · visibility · audience. This is the specification of the model, not a build order — the cockpit that edits these lists is its own pass (below).

### An opportunity is explained, or it is noise

**Every opportunity names the concrete reason it exists.** A percentage is not a reason, and a suggestion nobody can check is a suggestion nobody acts on. The reasons this model can already produce, all from data that exists:

- several of my partners follow the same winery
- a restaurant partner of mine follows a winery in my portfolio
- a stakeholder seeks what I offer, or offers what I seek
- a member event fits my profile (A16.8)
- a location fits an event I am planning
- a wine-show demand fits my wines (A16.4 open calls)
- several of my customers share an origin interest
- a distributor holds a market grant that fits (A17.9a)

**An opportunity creates nothing.** No partnership, no order, no invitation, no participation, no market grant, no contract arises from one being shown. What it offers are deliberate next steps the reader takes: view profile · follow · send an inquiry · request a partnership · request a tasting · invite · apply. This is the same line A17.13a draws between reach and agreement, and A16.14b draws between finding a show and acting on it — visibility never creates an action right.

**Prototype state:** Matchmaking is not implemented. All four dashboards carry a non-functional "Matchmaking" nav item with a match-count badge, purely so the concept is visible in demos. The two widgets that *do* render ("New Distributor Matches" on the winery dashboard, "New Winery Matches" on the distributor dashboard) use hardcoded fit percentages. Nothing here is a blueprint — build it from this section, not from the mockup.

> **A known defect, recorded rather than patched.** "My Opportunities" on the distributor dashboard offers **Hawesko GmbH to Hawesko GmbH** as *"New winery for you"* — a role and self-reference error at once: the suggested house is neither a winery nor a different house. It is hardcoded, and it dies with the widget when this section is built. Recorded so the finding is not measured a third time.

**The matchmaking cockpit is not part of the A16/A17 work.** It gets its own measured pass after the shows, own-label and member-event passes have landed, for the reason C2 gives: this section is the query layer over four relations, and the relations are still moving. Until that pass runs, `matchmaking` is deliberately **not** a value in the reach taxonomy (A16.14b) — it is shown in the interface, locked, with its reason on screen, so a reader sees why the feature is worth building rather than finding an option that quietly does nothing.

**Where the real matching data comes from:** the follow/fan graph (A7), the wine portfolio relations (A3), the master-data fields (A4) and stated seek/offer preferences. All four already exist as tables; Matchmaking is a query layer over them, not a new data silo.

---

## A9. Partner Incentive Systems

Both owned by the Distributor (single source of truth), both visible **only** to Restaurant/Retail with an ACTIVE partnership relation. Reuses the `partnership_requests` active model — never a separate materials/offers-to-customer table.

### Promo Materials

`promo_materials` table: `id`, `distributor_id` FK, `name`, `description`, `image_url`, `quantity_per_customer`, `condition_type` (`volume` | `order_value` | `new_listing`), `condition_wine_id` FK→wines (nullable), `condition_bottle_qty`, `condition_order_value`, `order_mode` (`cumulative` | `single_order`), `status`, `created_at`

- `cumulative` sums bottles across all orders over time; `single_order` checks one order line-item alone.
- **Unlock status is NEVER stored** — always computed live from existing orders/wine-list tables.

Three claim states per partner + material:

| State | Behaviour |
|---|---|
| `locked` | Progress bar + action button (Order Now / Order N Now / Add to List / Start Order) |
| `unlocked_unclaimed` | 🎉 badge + banner, notifies partner. No `promo_claims` row yet |
| `claimed` | Partner clicked Claim → INSERTs `promo_claims` row, notifies distributor |

> The **distributor side** of this lives inside the order (A14.4): when a customer's order pushes them over a threshold, the order detail flags the promo material as due for that delivery. That flag is computed, never stored.

### Exclusive Offers & Deals

Two **separate** distributor nav items:
- **My Offers** — single-wine % discount or free sample pack, optional tag
- **My Deals** — always single-order quantity deals. Type A: % discount at a minimum bottle qty. Type B: free goods, ratio dropdown (60:6 / 120:12 / 120:24 / 600:180), single-varietal or mixed case, free goods apply proportionally.

Restaurant/Retail get read-only "Exclusive Offers" and "Exclusive Deals" sections rendered live from the distributor's arrays.

**Unlike Promo Materials there is NO unlock/claim workflow.** Partners click "Request" any time → this **creates a real order** in stage `pending` (A14), carrying `source = 'offer'` or `'deal'`.

**Real build tables:**
- `exclusive_offers`: `id`, `distributor_id` FK, `offer_type`, `wine_id` FK→wines, `discount_pct`, `free_bottles`, `tag`, `description`, `status`
- `exclusive_deals`: `id`, `distributor_id` FK, `deal_type`, `wine_id` FK→wines (nullable for mixed), `deal_wine_ids` FK-array, `subtype`, `ratio` enum, `min_qty`, `discount_pct`, `status`

Same active-partnership visibility rule as Promo Materials.

**Prototype blueprint** (all in `bottle-lobby-dashboard.html`):
- Promo: `promoMaterials`, `condLabel()`, `isPromoUnlocked()`, `promoCardHtml()`, `unclaimedBannerHtml()`, `handlePromoRequestR/T()`, `handlePromoClaimR/T()`, `bumpMsgBadge()` / `clearMsgBadge()`, `openPromoModal()` / `savePromoMaterial()`
- Offers/Deals: `exclusiveOffers`, `exclusiveDeals`, `offerLabel()` / `dealLabel()`, `renderDistributorOffers/Deals()`, `openOfferModal()` / `saveOffer()` / `deleteOffer()`, `openDealModal()` / `toggleDealType()` / `toggleDealSubtype()` / `saveDeal()` / `deleteDeal()`, `renderExclusiveOffers/DealsRestaurant/Retail()`, `offerCardHtml()` / `dealCardHtml()`, `handleOfferRequestR/T()` / `handleDealRequestR/T()`

> **Demo-data discipline worth carrying over:** every offer and deal points at a wine that is genuinely in Hawesko's portfolio. An earlier draft used invented wine names, which would have shown a distributor promoting a wine they do not carry — a single-source-of-truth violation visible to any attentive investor. Demo data must obey the model too.

---

## A10. Wine Guide as a Query Layer

The Wine Guide must be a **pure query/aggregation layer** over the relational data — never a separately populated index.

| Tab | Implementation |
|---|---|
| Wines | Live `SELECT` over the wines table, joined to winery/distributor |
| Wineries | Derived aggregate view (`GROUP BY`) — name, region, grapes grown, wine count, distributor partners, own-label SKU count |
| Distributors | Same aggregate pattern |
| Restaurants | Aggregate view — **membership-gated** |
| Retailers | Aggregate view — **membership-gated** |
| **Events** | Live query over `wine_shows` and `events`, joined into one derived directory — **role- and reach-dependent** (A16.14d) |

**Events is the last tab, after Retailers**, and it is a projection, not a sixth store: a show is never copied into `events` and an event is never copied into `wine_shows` (ME-1). What the tab renders is the same authoritative record the dashboards and the public Wine Shows page render, through the same visibility functions (A16.6, A16.14a).

**All filter facets and counts computed live from the current filtered result set** (classic faceted search pattern), so a new wine/winery/distributor appears and is instantly filterable the moment it's entered — with zero separate action.

**Membership gate:** Restaurant and Retailer profiles in the Wine Guide must only be visible to logged-in, paying members. Winery and distributor profiles remain publicly visible to everyone (they benefit from being found by non-members). Restaurant/retail buyer identities are gated behind membership to protect them from being scraped or solicited outside the platform. This is an admin-panel-level access control in the real backend. The static prototype deliberately shows all profiles to everyone, with an inline UI note flagging this as temporary.

**Prototype blueprint:** `bottle-lobby-wine-guide.html` — one JS `wines` array as source of truth; wineries/distributors and every filter facet computed from it, never hardcoded. `restaurantsData` / `retailersData` plug into the same generic `filterConfig` / `state` / `renderResults()` engine.

---

## A11. Individual Public Profile Pages

Each Winery, Distributor, Restaurant and Retailer must have its own **dedicated, individually-URLed public profile page** — never a shared generic template file.

```
/winery/cantina-rossi
/distributor/hawesko-gmbh
/restaurant/bistro-laurent
/retail/weinhaus-mueller
```

This is the canonical public destination that wine article pages, search results, and other stakeholders' links point to.

**Three distinct page types — do not confuse them:**

| Type | File pattern (prototype) | Purpose |
|---|---|---|
| Individual public profile | `bottle-lobby-{role}-{slug}.html` | The real public destination for all cross-links |
| Owner dashboard profile | `bottle-lobby-{role}-profile.html` | Owner's own edit/preview page. **Never** an external "view profile" destination |
| Profile Demo Page | `bottle-lobby-profile-demo.html` | Multi-tab concept demo for investors/prospects. **Never** linked as a real profile destination |

The individual public page renders live from the same single source of truth the owner edits in their dashboard. Any change the owner saves propagates automatically.

---

## A12. Grape Variety Hub Pages

Since Grape Variety is master data (A4), each variety hub page (`/variety/nero-davola`) must be a **dynamic route** that queries the wines table live for every wine containing that grape — **including as one component of a multi-variety blend**. Never a hand-authored static page. Stats ("Wines Listed", "Wineries") are live-computed aggregates, never hand-counted.

Correspondingly: **any** place a wine's Grape Variety is displayed (article page, cards, search results) must render **every** variety in the value as a link automatically — a rendering-component guarantee tied to the master-data field itself, not something a developer adds per wine.

> **What this prevents:** In the static prototype, hand-authored variety hub pages needed manual, error-prone retroactive updates every time a new wine used that grape — and 5 existing single-variety wines were never linked to their already-existing hub page at all, because linking wasn't automatic. A live-query architecture eliminates this whole class of drift.

---

## A13. Preview Public Profile (embed mode)

The "Preview Public Profile" modal opened from any dashboard must show **only** the stakeholder's own profile content (hero, tabs, stats sidebar) plus the "✦ This is how [other roles] see your profile" context banner.

**Hidden in preview:** outer site navigation, the Public/Edit toggle bar, the banner's own "Edit Profile →" button, the "Member Login"/"Join Now" floating CTA. None of these make sense for a stakeholder already logged in previewing their own page.

**Real build:** Always renders the CURRENTLY LOGGED-IN stakeholder's own real, live profile record — never a hardcoded example. Effectively their own public profile page in a stripped-down "embed" mode.

**Prototype blueprint:** `?preview=embed` URL query param, checked by a small inline script right after `<body>` on every individual public profile page and the shared restaurant/retail profile pages. If present, adds class `embed-preview` to `<html>`; CSS hides `<nav>`, `.preview-banner`'s inner button, and `.floating-cta`. Modal sizing: `max-width: min(1400px, 96vw)`, `height: min(88vh, 900px)`.

---

## A14. Orders & Order Management

> The commercial core of the platform. Everything else — profiles, matchmaking, offers, deals, promo materials — exists to make an order happen. This section is the build brief for it.

### A14.1 One record, two perspectives

**There is exactly ONE order record.** Buyer and seller never hold their own copy, never sync, never reconcile. Both dashboards read the same row and render it from their own side. This is the Wine Shows pattern (A1) applied to commerce.

```
WINERY  ◄────── order ──────  DISTRIBUTOR  ◄────── order ──────  RESTAURANT
                                                            └──  RETAIL
```

Both halves of the supply chain are real orders in the same table, distinguished only by `buyer_type` / `seller_type`. A distributor is the seller on one row and the buyer on another. **Restaurant and Retail can only ever buy from a Distributor** (A3); a Distributor buys from a winery **or from another distributor** (A3, A17.9b) — that second row is an ordinary order too, with a distributor on both ends.

Wines on an order are **referenced, never copied** — `order_items.wine_id` is a foreign key into `wines`, which the winery owns. An order line stores commercial terms (quantity, prices, discount), never wine content.

### A14.2 Lifecycle

```
pending ──► accepted ──► shipped ──► delivered
   │            │
   │            └──► cancelled   (buyer, only while pending)
   └──► declined                 (seller)
```

| Stage | Who triggers | What happens |
|---|---|---|
| `pending` | **Buyer** places the order | Appears in the buyer's "My Orders" and in the seller's "Incoming Orders" with a badge |
| `accepted` | **Seller** confirms | Ship status moves to `packing`; buyer notified |
| `shipped` | **Seller** marks shipped | Carrier, tracking code and ETA captured; buyer sees them immediately |
| `delivered` | **Seller** marks delivered | Order closes and moves to Order History on both sides |
| `declined` | **Seller** | Terminal |
| `cancelled` | **Buyer**, only while `pending` | Terminal |

**Rule:** every transition belongs to the seller, except placing and cancelling, which belong to the buyer.

A separate `ship_status` runs alongside the stage for warehouse reality:
`not_shipped` → `packing` → `in_transit` → `partial` (part-shipment) → `delivered`.

### A14.3 Tables

```sql
orders (
  id, buyer_id, buyer_type, seller_id, seller_type,
  stage        enum('pending','accepted','shipped','delivered','declined','cancelled'),
  source       enum('manual','reorder','deal','offer','promo',
                    'wine_show_order','wine_show_catering'),
  wine_show_id FK → wine_shows (nullable),   -- both show sources (A16.11, A16.12)
  placed_at,
  tax_mode     enum('net','vat'),          -- per order, see A14.6
  vat_rate, discount_pct, shipping_cost,
  carrier, tracking, eta,
  ship_status  enum('not_shipped','packing','in_transit','partial','delivered'),
  internal_note                            -- seller-only, never shown to the buyer
)

order_items (
  order_id FK, wine_id FK→wines,           -- reference, never a copy.
                                           -- Nullable ONLY on a service order
                                           -- (source = 'wine_show_catering',
                                           -- A16.11). A 'wine_show_order' row
                                           -- always names a product (A16.12)
  description,                             -- service lines only, where wine_id is null
  qty, unit_price, cost_price,             -- cost_price drives the margin block
  discount_pct, is_free                    -- is_free = deal free goods, priced at 0
)

order_documents ( order_id FK, type enum(...), number, issued_at, pdf_url )
order_payments  ( order_id FK, amount, method, received_at )
order_events    ( order_id FK, at, actor, text )    -- activity timeline
```

**`order_events` is append-only.** Every state change, price change, document issue and payment writes one row. It is the audit trail, and it is what makes a disputed order resolvable.

### A14.4 What must be computed live, never stored

The most important rule in this section. Three things look like order fields and are **not**:

**1. Promo material due.** Computed from `promo_materials` against the order and the customer's cumulative volume:

| `condition_type` | `order_mode` | Check |
|---|---|---|
| `volume` | `cumulative` | Sum the customer's bottles of that wine across all orders; if ≥ threshold → due |
| `volume` | `single_order` | Check this order's line alone |
| `order_value` | — | Compare against this order's total |
| `new_listing` | — | The wine appearing on this order at all |

The order detail then shows: *"Promo material due — 12 Wine Glasses. Triggered by cumulative total of 60 bottles reached. Include it with this delivery."*

**2. Deal free goods.** Computed from `exclusive_deals.ratio` (e.g. `60:6`) against the qualifying quantity on the order — single-varietal, or summed across a mixed case. When met, the seller applies it with one action, which **inserts a new order line** with `is_free = true` and `unit_price = 0`. The line is real and appears on the delivery note; the order total is unchanged.

**3. Deal quantity discount.** When the order reaches `min_qty`, the entitlement to `discount_pct` is flagged and can be applied to `orders.discount_pct` with one action.

> **Why computed, not stored:** the customer can still change quantities before confirmation. A stored flag would go stale the moment a line is edited. Computing on render means the entitlement is always truthful.

> ⚠️ **Naming drift is the failure mode here.** These matches only work if the wine is the same *record*. In the prototype they silently failed because an order said `Riesling Spätlese Mosel` while the promo said `Riesling Spätlese — Mosel`. In the real build, `wine_id` foreign keys make this class of bug impossible — which is exactly why A4 master data is non-negotiable.

### A14.5 Documents

Six types, each with its own number sequence and issue date:

| Type | Prefix | Effect when issued |
|---|---|---|
| Quotation | `QU` | none |
| Proforma Invoice | `PF` | none |
| Prepayment Invoice | `PP` | payment status → `invoiced`, due date set |
| Invoice | `IN` | payment status → `invoiced`, due date set from payment terms |
| Delivery Note | `DN` | no prices shown, delivery address used |
| Credit Note | `CN` | offsets against the next invoice |

Documents render from the live order. **In the real build the generated PDF must be frozen and archived at issue time** (`pdf_url`), because an invoice is a legal record and must not change when the order is later edited. This is the one place where a snapshot is correct and the single-source-of-truth rule yields to accounting law.

`PP` carries a second job: it is the instrument for a Wine Show catering contribution, host to producer (A16.11). Nothing about the document changes — only what the order underneath it is for.

### A14.6 Tax

`tax_mode` is set **per order**, not per account, because the same distributor sells domestically and across borders:

- `net` → reverse charge; VAT line shows 0.00 and the footer states "VAT to be accounted for by the recipient"
- `vat` → VAT line calculated at `vat_rate`

Wine-specific extras for the real build: excise duty number on documents, deposit (Pfand) handling, and country-of-destination VAT rules for cross-border sales.

### A14.7 Payment

`not_invoiced` → `invoiced` → `partial` → `paid`, with `overdue` **derived from the due date**, not stored as a stage. Payments are rows in `order_payments`, so partial payments accumulate naturally and the outstanding amount is always `total − sum(payments)`. A prepayment flag on the order blocks dispatch until paid in full.

**Prepayment defaults to on where the two parties have no settled trading history** — no order between them that has reached `delivered` and `paid`. It is preset at order creation, stored from then on as the decision it is, and the seller may clear it. The condition is derived rather than a "new customer" flag, which would go stale the day it stopped being true; and it is evaluated once rather than live, or the flag would clear itself mid-order while the goods were still on the shelf. This is what makes the first order to a partner won at a Wine Show (A16.12) run quotation → prepayment → dispatch without anybody remembering to set it.

`settled_otherwise` is a fifth terminal status alongside `paid`: the seller records that the balance was cleared outside the platform — offset, cash, an arrangement between two people who know each other. It closes the order without inventing a payment row, and it is what stops an unpayable invoice blocking a Wine Show release (A16.11, step 8). It never means "waived silently": the seller has to set it, and it lands in `order_events` like everything else.

### A14.8 UI structure — non-negotiable

**Orders is its own sub-view**, on the same level as Dashboard and My Profile. It is *not* a section of the profile page. It exists for **all four roles** — one module, parameterised by role, never four copies. Two levels:

**Level 1 — order list.**
KPI row, tabs, status filter pills built from the stages actually present, and full-text search across order number, counterparty and wine. Each row carries a source chip, payment pill and stage pill.

Tabs follow the role's position in the chain (A3): a producer sells only (**My Sales · Order History**), a restaurant and a retailer buy only (**My Purchases · Order History**), a distributor does both (**My Sales · My Purchases · Order History**).

The KPI set follows the same split and is computed live (invariant 7), never stored:

| Side | KPIs |
|---|---|
| Selling | Open Orders · Awaiting Payment (with outstanding amount) · Ready to Ship (with bottle count) · Revenue |
| Buying | Open Orders · In Transit (with bottle count) · To Pay (with outstanding amount) · Spend |

**Service orders are listed but not shipped.** A `source: 'wine_show_catering'` order (A16.11) has no lines with a product on them, so every bottle count and both shipping KPIs — Ready to Ship, In Transit — must skip it, and the shipping block and delivery note do not apply. It still appears in the list with its own source chip and still counts towards Revenue, Spend and the payment KPIs, because the money is real and the producer has to find the invoice to pay it.

**Level 2 — order detail.** The working surface:

| Block | Contents |
|---|---|
| Header | Order no., stage, payment status, action bar. Seller: Confirm · Decline · Mark Shipped · Mark Delivered · Cancel. Buyer: Cancel Order while `pending`, Reorder once closed |
| Automatic flags | Promo due · deal free goods · deal discount — each with one-click apply |
| Line items | Wine, winery, qty, unit price, line discount, line total; add/remove lines. **Editable only while `pending` or `accepted`** |
| Totals | Net · order discount · shipping · VAT (switchable) · total |
| Documents | Six types, generate + preview |
| Customer / Supplier | Delivery address, invoice address, payment terms |
| Payment | Status, method, received, outstanding, due date, record payment, require prepayment |
| Shipping | Carrier, tracking, ETA, status incl. part-shipment |
| Margin | Purchase cost vs net revenue vs gross margin — **seller-only, never visible to the buyer**, and only where a purchase cost actually exists (the distributor). A producer's cost of production is not held anywhere, so the block is off for that role rather than filled with an invented figure (A1) |
| Internal note | Seller-only |
| Activity | Append-only timeline |

**Editability rule:** once an order is `shipped`, lines freeze. Corrections after that are a credit note, not an edit — same as any real trade system.

### A14.9 Still open

- **Stock check** against the distributor's own portfolio, with an under-coverage warning linking to a restock order with the winery. Deliberately not built in the prototype: there is no stock data, and inventing a number would have violated A1.

**Prototype blueprint:** `bottle-lobby-dashboard.html` — `ORDER_ROLES` (the role registry: entity, id prefix, side, tabs, margin flag), `ordState` / `activeOrderRole`, `orderShellHtml()`, `showOrders()` / `renderOrders()` / `ordersForTab()` / `orderKpis()` / `openOrderDetail()` / `renderOrderDetail()`, `normalizeOrder()`, the money chain `orderNet` → `orderDiscountAmt` → `orderSubtotal` → `orderVatAmt` → `orderGrand` plus `orderMargin`, `promoDueFor()` / `dealFreeGoodsFor()` / `applyFreeGoods()` / `applyDealDiscount()`, `DOC_TYPES` / `generateDoc()` / `openDocPreview()`, `openPayModal()` / `savePayment()`, `logEvent()`.

---

## A15. Planned Generalisation — Beverage Categories Beyond Wine

> **Decision:** the data model must be category-capable **from the first migration**. The
> interface ships wine-only at launch. Adding spirits later must be a configuration step,
> never a schema migration.
>
> **Why this timing:** before the first tables exist, this costs almost nothing. Afterwards
> it is expensive, because schema, queries, facets and UI would all be hard-wired to wine.
> Retrofitting it into the static prototype would be days of renaming throwaway code — do
> not do that either. This section exists so Claude Code finds the decision *before*
> designing the schema.

### A15.1 Producers, not wineries

The "Winery" stakeholder type becomes **Producer**, carrying a type from a maintained enum:

```sql
producers (
  id, name, producer_type_id FK → producer_types, …
)
producer_types (  -- admin-maintained, extensible
  id, key, label     -- winery, distillery, brewery, cidery, meadery, …
)
```

The four stakeholder types are therefore **Producer · Distributor · Restaurant · Retail**.
When registering, the producer picks their type; that choice drives which categories they
may create products in, and which attribute set those products get.

Everything in A6 (partnerships), A7 (follow), A8 (matchmaking) and A14 (orders) is written
against stakeholder types, not against "winery" specifically — those sections need no change
beyond the rename.

### A15.2 Products, not wines

```sql
categories (  -- admin-maintained
  id, key, label, producer_type_id      -- wine, whisky, gin, schnapps, beer, …
)
products (
  id, producer_id FK, category_id FK,
  name, abv, volume_ml, …               -- only genuinely universal fields live here
)
```

**Category-specific attributes are rows, not columns:**

```sql
attribute_defs (      -- what a category asks for
  id, category_id FK, key, label,
  input_type   enum('select','multiselect','number','text'),
  is_cascading, parent_attribute_id FK nullable,   -- Country → Region → Appellation
  sort_order
)
attribute_values (    -- the master data itself (A4)
  id, attribute_def_id FK, value, parent_value_id FK nullable
)
product_attributes (
  product_id FK, attribute_def_id FK, attribute_value_id FK
)
```

This is A4's master-data rule generalised: **still never free text**, still centrally
maintained, still cascading where the domain cascades. Wine keeps Vintage, Country, Region,
Appellation, Aging Duration, Aging Method. Whisky gets Cask Type, Age Statement, Peated,
Region (Speyside, Islay …). Gin gets Style and Botanical origin. Each category's set is
data, not code.

### A15.2a The product key is opaque — decided 4 Aug 2026

`products.id` is a key and nothing else. It is never rendered, never parsed, never
computed, and it is **not the slug**. The prototype carries it as `PRD-nnnn`;
Supabase carries a uuid, with the slug beside it as `products.slug`.

**Measured before deciding.** 91 product references live across eleven sources in
the prototype, and **52 of them joined by name**. Ten bottles already carry two
spellings, because the show surface appends the vintage — `Pouilly-Fumé` in the
book, `Pouilly-Fumé 2023` on the show floor. A join that strips a trailing
four-digit year to bridge that is a guess with good odds, and A14.4 records what
this project has already paid for string matching.

**Why not the slug, which every product row already carries as `url`.** It is
complete and unique — measured: 39 rows, 26 URLs, 26 products, no collision, no
split, no dead link. It is nonetheless an **address**, and addresses change.
Renaming is not hypothetical here: A4 puts Country → Region → Appellation on
master data, several product names carry their appellation, and the origin
strings are already measured as inconsistent. A slug-shaped key leaves only bad
options the day a name changes — **stay and lie, or follow and prove it was never
an identifier**.

A slug is also not reproducible. Two reasonable slugifiers — one folding
diacritics through NFD, one treating them as separators — agree on 25 of the
prototype's 26 wines and disagree on exactly one: `Nero d'Avola Sicilia DOC`,
where the apostrophe is either dropped or turned into a separator. **One in 26,
and the symptom is a silent 404**, not an error.

**`PRD-`, not `W-`.** Invariant 5: the entity is a product. A wine-shaped prefix
would have to be migrated the day spirits are switched on, and `W-` is the
obvious prefix for a winery once stakeholders get keys of their own. Prefixes
already taken: `ORD` (orders), `WS` (wine shows), and `QU`/`PF`/`PP`/`IN`/`DN`/`CN`
(A14.5 documents).

**What it costs, and how that is paid.** An opaque key is unreadable, and the
place that comes due is a fixture under review and a failure message. So: `id`
sits **first in the row**, before the name, so a record still says what it is at
a glance; reference sites resolve through `wineLabel(id)`; and
`tests/wine-identity.js` prints the resolved label on every finding, never the
bare key. That file also holds the two halves apart — **an id is never rendered,
a url is never compared** — and fails on zero references, because a check that
examined nothing cannot be green.

> **Adding the key needed no `VERSION` bump, and that was measured rather than
> reasoned.** A new field changes the *keys* of a persisted row, which is exactly
> what the shape fingerprint sees — unlike the date migration, where only values
> moved and the fingerprint was blind (A14 / store notes). Measured: the pre-key
> build hashes `currentWinePortfolio` as `7b89eeb8`, today's as `2b0bc140`.
> `tests/persistence.js` seeds a snapshot from a build with the key removed and
> asserts it is discarded, then removes the fingerprint comparison and asserts
> the 20 id-less rows come back. Without the second half the first would pass
> even if the store had stopped comparing shapes altogether.
>
> **What the fingerprint does NOT do, and it is worth stating because it looks
> like it should.** The comparison is between the *writer's* fixture hash, stored
> in the snapshot, and the *reader's* fixture hash. It never hashes the
> snapshot's own data. So a snapshot carrying today's fingerprint beside
> pre-key rows **is restored** — measured: 20 id-less rows reach the live state.
> That is not reachable from a browser, because no build ever writes that pair;
> it is reachable from devtools, and it is the boundary of the guarantee.
> `BLStore.fingerprints()` is likewise a cached value computed once at
> `register()`, so editing the live arrays and re-reading it measures the cache,
> not the shape function.
>
> ⚠️ **How to measure a snapshot at all, and it is the same shape as the
> `transferSize` rule in C7 — a probe that reloads measures its own
> interference.** `BLStore.start()` installs a `beforeunload` listener that calls
> `save()`, so a `location.reload()` writes the LIVE state over the snapshot you
> just injected, *before* the page goes away. Both readings taken that way said
> "discarded" and were reading their own write. **Write the snapshot from a page
> where the store does not run** — `index.html` — then navigate to the dashboard.
> Done that way the measurement holds: 20 id-less rows reach the live state.
> Confirmed in the browser, 4 August 2026.

**One resolver, and it is widened before anything moves (pass 2).** `wineByRef(ref,
book)` answers a key, a record, a `{producer, name}` pair or a bare name;
`wineLabel(ref)` is the single composition of `"name vintage"`, which six places
had built by hand; `sameWine(a, b)` compares two references. `book` narrows the
search and that is a **rule** — `orderItem()` has to answer null for a product
outside the seller's portfolio (invariant 3), not find it in somebody else's.

The order is the point and it is the lesson of the ISO conversion restated: a
comparison taught to expect a key throws nothing when handed a name, it finds
nothing, and the surface renders empty. So the readers are widened while the
references still name names; each later pass is then verifiable by the surface
still being right. 31 join sites now ask the resolver, and the only two name
comparisons left in the page are the legacy branch inside it — `wine-identity.js`
counts them and names them, so the number shrinking is visible and it growing is
a failure.

> Routing `sameWine()` through the key changes **five** raw comparisons from
> false to true, all of one shape: an order line naming a product without a
> vintage against a show product carrying one. All five sit behind
> `orderedUpstream()`, which is gated on `wineShowId`, and no order carries one —
> so no answer on any surface moves. It is named here rather than left to be
> discovered, because it is the first place where the key would have corrected
> something, and passes 3a–3c turn the rest of that class from latent into real.

**The order side names products (pass 3a).** `order_items` carry `product_id`,
`qty` and `unit_price` and nothing else about the product; `wine` and `winery`
are gone from the line. That is invariant 2 made structural rather than checked:
a line used to carry a producer as a string, so it could credit one the seller's
book disagreed with — the break that started this chain — and
`tests/supply-chain.js` had to compare the two answers. **There is one answer
now, so the contradiction cannot be written down**, and that check was deleted
rather than kept; what stands in its place asserts the copy stays gone. Trade
prices are keyed by product for the same reason.

> **Terra Rossa, and it is the first application of A3's 4 August rule.** The
> price table carried a trade price for a wine that existed on its own article
> page, on Cantina Rossi's public profile, on two variety pages and in the Wine
> Guide — and in no catalogue. The record was added, not the price removed.
> Its `at` is fixture authorship and it is **bounded, not chosen**: the Wine
> Guide names Enoteca Milano as its distributor and that partnership begins
> 2026-05-11, so under C7 the wine cannot be younger than the earliest fact that
> depends on it. Placed at 2025-07-22, inside the 2025 block, because that is the
> class it belongs to — publicly listed all along, unlike the two 2026 rows that
> are dated late on purpose to demonstrate A8. Measured after: notification
> counts unchanged at 13 / 27 / 18 / 13, which is the point — a wine that has
> been on the public guide for a year is news to nobody.

**The show surface names products (pass 3b), and the catalogue moved to reach it.**
`wine_show_products.product_id` and `wine_show_interests.product_id`. A16.9 always
called these references into a producer's range; they stored `"<name> <vintage>"`,
which is the second spelling every join had to bridge.

What forced the move: **seventeen public pages render those references and none of
them loads the dashboard**, where the catalogue lived. A name renders without
being resolved, so nobody noticed; a key cannot, and a public page holding a key
and no catalogue can only print the key. So `partnerWinesPool` and the resolver
now live in `assets/bottle-lobby-data.js` — the file every surface loads — for the
same reason and by the same move as `blDate()`. The distributor's book and the
buyers' lists stay on the dashboard: they are that page's own state.

> **Verified by comparison, not by argument.** 178 rendered surfaces were captured
> before the pass and after it — every show list and detail pane in all four roles,
> both tabs, all six shows, the public cards, the A16.12 order lists, the prepared
> orders, and every notification id and line of text. **178 of 178 identical.** Two
> real defects turned up that way and only that way: the producer's invitation box
> and the "Your Turn" box read `p.name` and rendered *"invited you to exhibit with
> undefined"*.
>
> **`BLStore.VERSION` was NOT bumped, and that is the measured answer rather than
> an omission.** The concern was `notifSeen`: notification ids are built from
> rendered text, so a changed label silently marks everything unread, and the shape
> fingerprint cannot see it because ids are strings either way. The comparison
> above includes every notification id — none moved, because `wineLabel()` produces
> exactly the string the show fixtures used to store. Separately, `wineShows` is a
> registered collection whose *keys* changed, so a pre-3b snapshot is discarded by
> the fingerprint anyway; `tests/persistence.js` seeds one from a patched build and
> asserts it, with the comparison-removed counter-check beside it. **The fragility
> is still real** — an id built from a label is an id that moves when the label
> does — and it is the *event identity* pass, not this one.
>
> **And the general answer, Serge's, which settles this without measuring it
> again: `restore()` is ALL OR NOTHING.** It names every mismatch and then throws
> the whole snapshot away. So whenever a *registered* collection changes shape, a
> returning visitor loses the entire stored state anyway — `notifSeen` included,
> whatever its ids say. A `VERSION` bump in that situation does exactly the same
> thing and repairs nothing. The bump is for the case the fingerprint cannot see:
> **values** changing format inside an unchanged shape, which is what the date
> migration was.

**The name branch is gone (pass 4 of 5), and that is what makes a check worth
running.** `wineByRef()` takes a key, or a record carrying one, and nothing else;
`sameWine()` is an id comparison with no string fallback; `wineLabel()` and
`wineName()` return **nothing** for a reference they cannot resolve, and warn.

Serge's reason for cutting before the browser pass rather than after: while a
name still resolved, any site that had been missed went on working and looked
correct. After the cut it answers null and renders empty. **A pass over the
surfaces now checks 3b and 3c as well, under the one condition where a leftover
actually shows.** Measured after the cut: the 178 show surfaces and the 37
commercial surfaces are still byte-identical to their pre-3b and pre-3c
captures, and a sweep driving **326 renderers, views and modals** raises **zero**
resolver warnings and zero script errors.

> Returning the reference itself was right while names were travelling — it kept
> a surface readable mid-migration. Keeping it afterwards would have been the
> opposite: a stray name would render as itself and look correct, which is
> exactly the failure this chain exists to make impossible.

**The commercial records name products (pass 3c), and the name is gone.**
`promo_materials.product_id`, `exclusive_offers.product_id`,
`exclusive_deals.product_ids`. `winery` is gone from offers and deals for the
same reason it left the order line: it was a copy of the producer, and the
buyer's row derives it. No stored wine name is left anywhere in the prototype.

> **The bridge that was holding, and it is why this pass was worth doing rather
> than deferring.** Serge's observation while accepting 3b: `dealFreeGoodsFor()`
> still matched a deal's `wineName` against an order line's *key* and answered
> **correctly**, because the resolver took either. That is the shape of a defect
> this project has paid for twice — a thing that works for a reason nobody
> intended, until the reason is removed.

> **The three commercial modals offered wines the distributor does not carry.**
> Under a label reading *"from your Wine Portfolio"*, the promo, offer and deal
> forms held hand-typed option lists naming, between them, **seven wines outside
> the book** — Rosato di Sicilia, Château Belrieu Grand Vin, Rioja Blanco, Rioja
> Reserva, Spätburgunder, Bourgogne Aligoté, Tempranillo. An offer over a wine
> outside your book is the invariant-3 gap A3 describes, and here it was
> creatable through the interface, upstream of where `tests/supply-chain.js`
> catches it. They are filled from `portfolioOf()` now, key as value and label as
> text, the same shape as the show modals.

> **Verified the way 3b was, on the surfaces Serge named.** 37 commercial
> surfaces captured before and after — every promo tile at both buyers with its
> unlocked/claimed state, both offer and deal lists in all three roles, every
> order's promo-due and deal-goods computation, and the order details that carry
> the banners. **37 of 37 identical**, including *"Deal threshold reached — 120
> bottles of Merlot — Bordeaux Supérieur qualifies for 25% off"* on ORD-2037.
> Three real defects showed up only in that comparison: the deal banner printed
> the key, the buyers' offer and deal rows had lost the producer, and every
> commercial label had silently gained a vintage.

**Which is why there are two accessors and not one — decided 4 August 2026.**
`wineLabel()` names the **bottling**, name and vintage, because that is what a
show product and a portfolio row have always shown: a show is one evening and a
guest tastes one bottling. `wineName()` names the **wine**, without a vintage,
and that is what a promo condition, an offer and a deal use.

**Serge's reasoning, and it settles the question rather than deferring it: a deal
runs for months and a vintage turns over.** A deal reading *"Buy 120 bottles of
Merlot — Bordeaux Supérieur 2021"* would quietly stop matching the moment the
producer moves to 2022 — it would not fail, it would simply find nothing, which
is the failure mode this whole chain exists to remove. So a deal, an offer and a
promo condition are on the **wine**.

The opposite case is real and is **not** a labelling question: a distributor
wanting to clear one specific vintage needs an optional *"applies to vintage X"*
field on the deal, which the matching then honours. That is its own pass, and
naming it here is what keeps somebody from solving it by putting the vintage
back into the label.

> **A fourth catalogue, found by the collision the previous pass created.**
> `bottle-lobby-distributor-profile.html` declares its own `partnerWinesPool` of 23
> rows, which became a `SyntaxError` the moment the shared one existed. It is not a
> smaller copy but a **different** one: it carries ten wines the catalogue does not,
> including **all five of Château Belrieu's** — a producer with no catalogue row at
> all — and three whose article pages are among the 15 orphans; it is missing seven
> the catalogue does carry. Renamed rather than merged, because merging is a data
> decision with a date on every row. The other two profile pages carry a 19-row copy
> each whose every `winery` field reads *Hawesko GmbH* — the supplier-as-producer
> defect D34 records as deleted, still alive on two pages nobody reads from. All of
> it belongs to the "complete the catalogue" pass.

> **A sixth book, found while doing this and not touched here.**
> `bottle-lobby-wine-guide.html` carries **40 product rows with slug-shaped ids
> of their own**, 15 of which no dashboard book knows — the same 15 orphaned
> article pages. It belongs to the "complete the catalogue" pass, together with
> Château Belrieu's six wines that exist on the site and in no catalogue at all.

### A15.2b A product is a wine line, not a bottling — decided 4 Aug 2026

**`products.id` names the wine across vintages.** The stable key is the line;
the vintage or batch is the physical execution of it. Serge's decision, and it
settles a contradiction the own-label work exposed (A17.11): exclusivity has to
follow a line across vintages, while every order has to name the bottles that
actually shipped. Both cannot be true while a product carries one vintage and an
order line carries none.

**What hangs on the line:** listings, distributor portfolios, own-label projects,
exclusivity, brand, offers, deals, promotions, and the public article page. All of
them are statements about *the wine*, and none of them wants to be re-made every
autumn.

**What hangs on the execution:** the order line, the delivery, the documents.

    orderLine.productId      the line
    orderLine.vintage        the vintage actually ordered and shipped
    orderLine.batchOrLot     where the producer works in batches

> **The order line stores the vintage; it never reads it back off the product.**
> A rollover would otherwise rewrite last year's paperwork — the same failure as
> recomputing a historic fee from today's rate (A17, OL-12). This is not a
> convenience field, it is the record of what was traded.

**Frozen when the order is accepted**, because that is when both sides commit:
the product name as displayed, the vintage, the batch where there is one, the
article number, quantity, price, and whatever technical or tax identifiers the
documents need. Invoices, delivery notes, order confirmations and credit notes
read **only** from that snapshot. **A vintage rollover never alters a historic
document.**

**The model must not assume one live vintage per line.** A producer may carry two
vintages of the same wine at once, and a distributor may hold both. The full shape
is

    product  →  productVintage (bottling / batch)  →  orderLine references one

and the first build may collapse the middle step, storing the vintage and batch
immutably on the order line — **provided nothing anywhere assumes a line has
exactly one relevant vintage.** That assumption is the thing being ruled out; the
table is only how it is eventually expressed.

**Offers, deals and promotions attach to the line.** Where an action should apply
to one vintage or batch only, it carries an optional restriction. Unrestricted, it
covers the line and whatever vintages are orderable at the time — which is the
answer to the deal-vintage question left open earlier on 4 August (A15.2a), now
closed: the label stays vintage-free, and the *restriction* is where a vintage
belongs if it is wanted at all.

### A15.3 Components — the generalisation of grape variety

Grape variety is already a multi-select because of blends. That exact shape covers every
other category, so it becomes **one** concept rather than four:

```sql
components (          -- admin-maintained master data
  id, name,
  component_type enum('grape','grain','botanical','fruit','hop','other')
)
product_components (
  product_id FK, component_id FK,
  pct numeric nullable              -- share, where the category uses one
)
```

| Category | What is selected | Shape |
|---|---|---|
| Wine | Grape varieties | many, optional % (cuvée) |
| Whisky | Grain bill | many, optional % (mash bill) |
| Gin | Botanicals | many, no % |
| Fruit brandy | Base fruit | usually one |
| Beer | Hops / malts | many, optional % |

**Consequences that come for free:**
- **Hub pages (A12)** stay one dynamic route, parameterised by component type:
  `/grape/nero-davola`, `/botanical/juniper`, `/grain/barley`. Same live query, same
  live-computed statistics, same rule that *every* component in a product renders as a link.
- **The Guide (A10)** stays the same faceted query layer. Category becomes one more facet;
  the component facet is filtered by the selected category so a wine search never offers
  "Juniper".

### A15.4 What does NOT change

Roughly two thirds of the model is beverage-neutral and must not be touched:

- The supply chain rule (A3): Restaurant/Retail buy exclusively via a Distributor
- The four-stage, admin-gated partnership workflow (A6)
- Follow / fans (A7) and Matchmaking (A8)
- Promo materials, offers and deals (A9)
- **The entire order system (A14)** — `order_items.wine_id` simply becomes `product_id`
- Single source of truth (A1) and the ownership map (A2), with "Winery" read as "Producer"

A spirits importer works exactly like a wine importer. That is the whole point.

### A15.5 Launch scope — broad model, narrow face

**Build the schema category-capable. Ship the interface wine-only.**

Positioning is the reason, not technology. "Bottle Lobby for the wine trade" is a sharp
proposition with a clear audience; "a platform for beverages in general" competes with
generic B2B marketplaces and loses the argument for why a winemaker specifically should be
there. Widening the visible product too early is usually a step backwards in investor and
trade conversations.

So at launch: one row in `categories` (wine), one row in `producer_types` (winery), and the
category facet hidden in the UI. Enabling spirits later is inserting rows and unhiding a
filter — not a migration.

**Brand vocabulary stays wine-flavoured while wine is the only live category.** "Wine Guide",
"Wine Shows", "Wine List", "Own Label" are product names, not schema. When a second category
goes live, these need neutral equivalents decided deliberately — it is a naming exercise, not
a refactor. Keep the *database* neutral from day one; keep the *labels* wine-specific until
the business decides otherwise.

> **Open business decision, not a technical one:** whether and when to widen beyond wine is
> Serge and Kelly's call. This section only guarantees that the answer stays cheap either way.

---

## A16. Wine Shows & Events

> A1 names Wine Shows as the reference pattern for every relation in this
> model: one record, created once by its host, everyone else attached to it.
> This section works that pattern out in full. It is also the feature that
> ties the others together — partnerships (A6), the follow graph (A7),
> matchmaking (A8), public profiles (A11) and producer types (A15) all meet
> here.

**Two different things, never merged:**

| | Wine Show | Event |
|---|---|---|
| Owner | Distributor(s) only | Any of the four roles |
| Purpose | Trade fair — producers present to buyers | The owner's own occasion |
| Approval | **Bottle Lobby staff must release it** | None — freely managed |
| Examples | "Grande Rioja", Düsseldorf, 5 Dec | In-store tasting, winemaker dinner, winery anniversary |

The nav items stay separate in every dashboard: **Wine Shows** for fairs,
**My Events** for a role's own occasions (B8, A16.8).

### A16.0 Why a Wine Show exists

Read this first. Everything below is shaped by it, and without it the
feature reads as marketing — which it is not.

**A Wine Show is the distributor's instrument for minimising risk.** A
distributor wants to work with a producer they do not yet list. Buying in
on a hunch means paying for stock that may not move. So instead they put on
a show, present the producer's wines to their own restaurant and retail
customers, and **collect orders during the event** — an order list goes
round the room. What comes back is consolidated into **one targeted order to
the producer** (A14). They buy only what somebody has already asked for.

```
Wine Show ──► orders collected from restaurants and retailers
                        │
                        └──► ONE consolidated order to the producer (A14)
```

**Demand first, purchase after.** That is the whole point, and it is why a
Wine Show is the run-up to an order rather than an occasion in its own
right.

**Where the risk actually sits, precisely.** Two kinds of wine stand on the
same table (A16.12): ones the distributor already lists, which a guest can
simply order, and the ones they are testing, which nobody has bought yet.
Only the second column is the instrument. What it produces is a number the
distributor has never had before — **how many bottles of an unlisted wine
their own customer base actually wants** — and it turns the first order to a
new producer from an estimate into a total. That is the sentence the whole
of A16.12 exists to make true.

**What follows for the build — Restaurants and Retail are the demand side.**
They have to be able to *find* shows, or the instrument does not work at
all. Their dashboards therefore list **every show A16.6 makes visible to
them** — anonymised from `planning`, full from `published` — exactly as a
visitor sees them on the public page, and not merely the ones they are
involved in. Discovery is the feature.

> Do not narrow this to "shows I take part in". It reads as the tidy
> implementation and quietly removes the audience the show exists to reach.
> The rule is the same one A16.6 states for the public surfaces, applied
> to a dashboard: same records, same two levels, same function.

**Being the venue is a separate thing, layered on top.** It is a gesture
from a distributor to an existing customer they supply heavily, and it pays
that customer three ways: contact with other restaurants and retailers,
a closer relationship with the wineries, and the standing that comes from
hosting a show carrying Bottle Lobby's name (A16.1). A venue is asked
directly and individually — which is why the venue relation reaches a
restaurant through `venue_id` and never through the public listing, while
*seeing* the show needs no relation at all.

> **The mechanism is specified in A16.12 and not yet built.** Until it is,
> the platform supports the *occasion* but not the *instrument*.

### A16.1 Why Wine Shows carry an approval gate

A Wine Show is a **Bottle Lobby product**. The platform vouches for it, so
staff confirm every show manually in the internal admin panel once date,
venue, exhibitors and products are settled. Same control point as
partnership activation (A6), same reason: what carries the platform's name
is checked by the platform.

Member events carry no such promise and need no release (A16.8).

### A16.2 Lifecycle

```
draft ──► planning ──► pending_approval ──► published ──► completed
                              │
                              └──► changes_requested ──┐
                                    (staff note)       │
                                    ◄──────────────────┘

published ──► cancelled      all parties notified
published ──► rescheduled    new date, every confirmation must be renewed
```

| Stage | Trigger | Meaning |
|---|---|---|
| `draft` | Distributor creates the show | Visible to the host only |
| `planning` | **The host's basics stand: title, date, city, focus** | Listed at whatever reach the host set, and anonymised — see A16.6 and A16.14a. This is where recruiting happens |
| `pending_approval` | Distributor submits — UI label **Final Review** | Bottle Lobby staff review. The **publish preconditions** (A16.14c) are what the submit button waits for, and the release is a stored `reviews` row, not a computed state |
| `changes_requested` | Staff decline **with a written reason** | Back to the distributor, who amends and resubmits. Not terminal |
| `published` | Staff release | Full details public, invitations can go out |
| `completed` | After the event date | Moves to history on every participant's profile |
| `cancelled` | Host | All confirmed parties notified |
| `rescheduled` | Host sets a new date | **All exhibitor, venue and attendee confirmations reset to pending** |

**`planning` begins with the host's basics, and the old trigger's checks moved
to publish.** Venue, confirmed exhibitors and confirmed products used to be the
condition for entering `planning`. They are now **publish preconditions**,
checked before `pending_approval` (A16.14c). See Appendix D (D38).

> **Why:** recruiting happens *inside* `planning` (A16.4, A16.14c). A show that
> may only enter `planning` once it has a confirmed exhibitor can never recruit
> its first one — the stage that exists to find participants was gated on
> already having them. The fixture WS-2604, sitting at zero wines, is that rule
> being observed rather than an accident.
>
> Listing early is safe because A16.6 makes it safe: an anonymised show names
> nobody. And nothing is given away by moving the checks, because the platform's
> guarantee has never attached at `planning` — it attaches at `published`
> (A16.1), which is exactly where the checks now sit.

**`pending_approval` carries the UI label "Final Review".** The stored stage
keeps its name; the label is what the host and the staff screen read. There is
no separate Final Review stage, and adding one would duplicate
`pending_approval` exactly. `changes_requested` stays its return path.

**A material change is answered differently in each stage**, and the rule is the
`rescheduled` mechanism generalised: `draft` and `planning` — ordinary editing.
`pending_approval` — affected consents reset. `published` — affected parties are
notified, those affected renew their consent, and the show needs a **new Bottle
Lobby release**. `completed` — read-only; a later correction is a traceable
correction event, never an edit (WS-7).

> `rescheduled` deliberately invalidates every confirmation. A producer who
> agreed to 5 December did not agree to 12 February, and a venue may not be
> free. Silently carrying confirmations over would fake consent.

**Both terminal moves are barred once money is committed.** From the
commitment point defined in A16.11 — the first binding contribution
confirmation, or the host's acceptance of the venue's offer, whichever comes
first — `cancelled` and `rescheduled` are unreachable, and the buttons are
gone rather than disabled.

> **Why:** `rescheduled` resets every confirmation, and a confirmation is now
> a payment obligation. Resetting one would revoke a commitment somebody else
> has already acted on — the venue has booked staff, the host has invoiced.
> `cancelled` is the same problem without the new date.
>
> This does not mean a committed show can never fall through. It means
> unwinding it is **not a lifecycle transition**: it is a commercial reversal
> — credit notes against the issued prepayment invoices (A14.5 `CN`),
> handled by Bottle Lobby staff, who are already the release gate (A16.1).
> The host does not get a button that quietly leaves other people out of
> pocket.

### A16.3 Hosts

A show belongs to **one or more distributors**. Co-hosting requires an
active Distributor↔Distributor partnership (A6, A8) — the same gate as any
other joint commercial act. One host is the **lead** and submits for
approval; all hosts appear as organisers.

### A16.4 Exhibitors

Exhibitors are **producers** (A15).

**An exhibitor must already be an active partner of the host (A6), before
the show.** This is a precondition, not a detail: the distributor invites
the producer, the two conclude a partnership, and only then does the
producer exhibit. Everything downstream depends on it — the wines shown are
drawn from the producer's own range, which needs the partnership to be
visible at all; and the consolidated order the show produces (A16.12) is an
order between two parties, which A6 permits only between active partners. A
show is where a partnership is **used**, not where one is skipped.

> A producer may still approach a distributor unprompted and ask to exhibit
> (below). Where no partnership exists yet, that approach is a **partnership
> request first** (A6) and an exhibitor invitation after it — never an
> exhibitor row that quietly stands in for one.

**This is deliberately not symmetric with attendees.** A restaurant or
retailer attends with no partnership at all (A16.5) and needs one only to
buy (A16.12). A producer needs one to exhibit in the first place. The
difference is what each is doing there: a guest is a guest, while an
exhibitor's goods are being presented for sale on the distributor's behalf,
which is precisely what a partnership authorises. Do not "tidy" the two into
one rule.

A distributor gets exhibitors two ways:

**Direct invitation** to a specific producer, optionally naming a wanted
product. The producer confirms, declines, or **confirms with a different
product**.

**Naming a product is a proposal in either direction, never an
instruction — and the other side always confirms it.** Whoever puts a
product forward does not get to settle it alone:

| Who proposes | Who confirms | If they decline |
|---|---|---|
| Host names a wanted product in the invitation | **Producer** | Producer counter-proposes, or declines the invitation outright |
| Host invites without naming one | Producer proposes → **Host** confirms | Back to the producer, who proposes another |
| Producer counter-proposes instead of the host's choice | **Host** | Back to the producer, who proposes another |

A product counts towards the show only once **both** sides have agreed
it — that is what `wine_show_products.status = 'confirmed'` means, and
it is why `proposed_by` and `status` are two separate fields (A16.9).

Declining a *product* never ends the participation: the producer stays a
confirmed exhibitor and is asked for another wine. Only declining the
*invitation* removes them.

**A product the other side turned down is used up** and is not offered
again. A product the producer merely swapped away from is not — that was
the host's own suggestion, so coming back to it is reasonable. Which of
the two a `declined` row is follows from `proposed_by`: only the host
answers a producer's proposal, and only the producer replaces the host's.
Declined rows stay in the table as history; they are never deleted.

A producer cannot take a place on a show without naming a product. There
is no state in which somebody is exhibiting but presenting nothing — the
acceptance and the product choice are one act. See Appendix D (D23).

**Open call** to a filtered set of the distributor's partnered producers —
partnered, because of the precondition above; an open call reaches the
producers a distributor already works with, not the open market.
Filters, all drawn from existing master data (A4, A15):

| Filter | Source |
|---|---|
| Producer type | `producer_types` — winery, distillery, brewery … |
| Country | master data, top of the cascade |
| Region | depends on Country |
| Appellation | depends on Region |
| Component | producers holding a given grape variety, grain, botanical … |

Matching producers see the call under **Wine Shows** in their dashboard,
with full event and venue detail, and can apply. A producer can also
approach a distributor unprompted and ask to exhibit, or propose holding a
show together.

A show may mix producer types and categories freely — three wineries with
two wines each, plus a brandy and a whisky, is one show.

### A16.5 Venue, attendees and cost

> **Two words, two parties — keep them apart.** The **host** is the
> organising distributor (A16.3). The **venue** is the restaurant or
> retailer providing the room, naming the price and organising the
> catering. Both act in the settlement flow, so "venue host" is never
> used: the venue is not a host, and the host is not the venue. Where
> the host uses their own premises, the two coincide in one account and
> no venue request exists.

**Venue** is either the distributor's own premises or a **partnered**
restaurant or retailer, by request. Hosting requires an active partnership;
attending does not.

**The venue names the price** for room and catering together, in its own
dashboard, and organises the catering. That figure enters the show record
directly — the host never retypes it (A1) — and the host is notified. The
notification is a step of its own, not a silent update: the host has to
learn what the show will cost before deciding how to pass it on.

The host then chooses how the cost reaches the exhibitors, one of four ways:

| Mode | Effect |
|---|---|
| `fixed_per_product` | **Default.** A fixed amount per presented product, set by the host. An exhibitor showing two wines pays twice a single-wine exhibitor, but nobody's amount depends on anybody else's presence |
| `split_by_products` | The venue's total divided across exhibitors **by number of products presented** — the same ratio, but every amount moves when the line-up moves |
| `host_covers` | The distributor pays it |
| `free` | The venue waives it, treating the show as its own marketing |

The full settlement — who confirms what, when the amounts stop moving, and
how they are invoiced — is **A16.11**.

**Attendees** are restaurants and retailers. They are invited by the host,
or they find shows in their region and **request to attend without any
existing partnership** — a Wine Show is an entry point into the network,
not only an instrument between existing partners. Finding them is not a
courtesy: they are the demand the show is convened to measure (A16.0).

The host sets a **capacity**. Requests beyond it join a **waitlist** and
move up automatically when someone withdraws. Turning applicants away
outright would discard exactly the interest the show exists to create.

**Four rules make that work:**

**1. A seat is computed, never stored.** The stored fact is that both sides
said yes; who currently holds one of the `capacity` seats and who is on the
waitlist follows from **request order** against the capacity (A16.10). This
is what makes "move up automatically" true rather than a job somebody has to
run: a withdrawal removes a row, and the next person is seated by the same
arithmetic that seated the first. A stored `waitlisted` status would need a
cascade to maintain and would be wrong the moment anyone left.

**2. Only confirmed attendees consume capacity.** An unanswered invitation
holds nothing. Otherwise a host could fill their own room by inviting
sixty people who never replied, and the waitlist would form behind an
empty hall.

**3. Invitations go to partners; requests are the route for everyone else.**
The host invites from the accounts they already work with, and anyone else
finds the show and asks — which is A16.5's own point about a Wine Show being
an entry into the network, and A16.0's about reaching the demand side. No
partnership is required to attend, and none is created by attending.

**4. The attendee list is the host's book, until the show is over.** It is
not public, and one attendee never sees another. The distributor's customer
list is the thing they are least willing to hand over, and a show they
organise must not publish it as a side effect. The **venue** is told how
many are coming and not who — the same rule that governs the line-up
(A16.6), for the same reason: what catering needs is a head count.

**The bound is `completed`, not for ever.** From then an attendee may show
their own attendance on their own profile (A16.7), because at that point
the sentence reports on their past rather than on who is in the room. The
host's list as a *list* is never published — what changes is that each
attendee's own fact stops giving it away. A rule kept past the point where
it protects anything stops being a protection and becomes a habit.

Once published, a venue restaurant may upload the **menu**.

### A16.6 Visibility — three public levels, two surface classes

This is the rule that protects everyone involved.

**From `planning` — anonymised.** Title, date, city and thematic focus only:
*"Wine Show Rioja · 5 Dec 2026 · Düsseldorf · premium reds."* Neither
producers, nor products, nor the exact venue are named.

**From `published` — full.** Exhibitors, their products, the venue and the
programme are public.

**Between a stranger and a participant sits a third level: the member.** A show
that is meant to recruit has to show a member enough to want in, and a stranger
less than that. The anonymisation is unchanged in both cases — what differs is
how much of the *shape* of the show is legible:

| Viewer | before `published` | from `published` |
|---|---|---|
| not a member | title, date, city, focus + *"Join to see who's exhibiting"* | everything released |
| **member** (any role), reach allows | the same **plus**: venue *status* (not the venue itself before `venue_accepted`), capacity, host, confirmed-exhibitor **count**, places left, `applications_open` and its deadline | everything released |
| member, reach excludes | **the show does not exist for them** — no card, no title, no count | everything released |

A member sees counts, never identities. Which members a show reaches at all is
the host's reach setting (A16.14b).

**Two surface classes, and they answer different questions.** Every surface
belongs to exactly one, and every renderer states which one it serves:

**Class 1 — public and directory surfaces.** The Wine Shows page,
`/wine-show/{slug}`, Wine Guide → Events, public profiles, the follow feed, the
dashboards' Discover lists and the marketing pages. The table above is the whole
rule here, and **no exhibitor, applicant or invitee is named before `published`**
— confirmed or not.

**Class 2 — working surfaces.** The host's cockpit, a participant's own view of
the show, the venue's detail section. Access here follows **role in the show**,
never reach, and it is not anonymisation's job:

- **The host sees everything of his show, always** — every application,
  invitation, confirmed exhibitor, wine, attendee, cost and consent. A16.4's
  handshake presupposes exactly this.
- **A confirmed exhibitor** sees the show data relevant to him and the
  information released for internal collaboration: the line-up he is part of,
  the programme, his own costs and agreements. Never another exhibitor's
  contracts or costs (A16.11).
- **The confirmed venue** sees the confirmed exhibitors, the programme and the
  **head count** — never attendee identities, guest profiles, contact data,
  interests or messages. Count and identity are two different permissions
  (A16.5 rule 4).
- **An unconfirmed applicant is named in exactly two views: his own and the
  host's.** Nowhere else, including other exhibitors' working views.

> **The two classes must never be merged.** The day class-2 access is granted by
> reach, or class-1 anonymisation is "relaxed" because the viewer happens to be
> confirmed somewhere else, the protection is gone. **Reach decides who may find
> the show (class 1); role decides who works inside it (class 2); acceptance and
> release decide whose names class 1 shows.** The single-answer rule below
> extends to this distinction: a renderer that cannot say which class it serves
> is a renderer that will eventually answer as the other one.

> **Why:** an invited producer must not appear publicly before accepting —
> a later decline would read as a withdrawal. A restaurant must not be
> announced as a venue while nothing is settled. Anonymised early listing
> still lets the show build interest without committing anyone.

**Anonymisation holds across every surface at once.** It is a property of
the show, not of the page a visitor happens to be on: the Wine Shows page,
the participants' public profiles, search, and anything added later all
answer the question the same way, from the same function.

> **Why this is a second, independent reason — and the stronger one:** the
> first reason above is about an *unanswered* invitation, so it stops
> applying the moment a producer confirms. That is the trap. An anonymised
> show is still **publicly listed under its title**. If a confirmed
> producer's own profile then showed *"Exhibiting at Wine Show Rioja"*, a
> reader who has seen both pages knows exactly who is exhibiting — and the
> anonymisation on the first page bought nothing. A promise kept on one
> surface and broken on another is not a weaker promise; it is no promise.
>
> So the rule is not "hide producers who have not answered yet". It is
> "before `published`, no surface associates a producer with this show" —
> which is why an exhibitor appears on their own profile only from
> `published`, while the host, who is the one announcing the show, appears
> from `planning`. See the table in A16.7.
>
> Do not "simplify" this by letting confirmed exhibitors through early. It
> looks like an inconsistency and is the whole mechanism.

### A16.7 Where shows and events appear

**On the public profile (A11) of every participant** — host, exhibitor,
venue and attendee — as upcoming and, after `completed`, as history. A
winery's profile showing three fairs it presented at is a credential.

**But not all of them from the same moment.** Each role appears as soon as
its appearing gives nothing away that another rule is holding back:

| Role | Appears on their profile from | Because |
|---|---|---|
| Host | `planning` | They are the one announcing the show. A16.6 protects producers, products and the venue — not the announcer |
| Exhibitor | `published` — **not** `planning`, even once they have confirmed | An anonymised show is publicly listed under its title, so a profile saying "exhibiting at Grande Rioja" gives away exactly what the listing withholds |
| Venue | `published` | The exact venue is part of what A16.6 protects, for the same reason and until the same moment |
| Attendee | **`completed`** | Their attendance is their own fact to show — but only once it no longer reports on the present. See below |

The exhibitor rule is stricter than the "a later decline would read as a
withdrawal" reasoning alone requires, and that is the point: anonymisation
holds across surfaces, or it holds nowhere. The full argument is in A16.6,
under *Anonymisation holds across every surface at once* — read it before
changing this table.

> **Why an attendee waits for `completed`.** Being at a show is a fact
> about the attendee, and they may show it. Before and during the show,
> however, *"I am going to Grande Rioja"* is not a statement about
> themselves — it is a statement about the **guest list**, which A16.5 rule
> 4 keeps as the host's book. Fifteen profiles each saying "I will be
> there" reconstruct exactly the list that rule withholds. Afterwards the
> same sentence is a statement about their own past, and the list it once
> belonged to has nothing left to protect.
>
> This is A16.6's mechanism again: **a rule that holds on one surface and
> not on another holds nowhere** — only here the boundary is in time rather
> than across surfaces. And it keeps both halves intact: A16.7's credential
> survives, and A16.5 rule 4 applies for exactly as long as it protects
> something. See Appendix D (D30).

**Through the follow graph (A7).** Following an account subscribes you to
its appearances: a restaurant following a winery is notified when that
winery exhibits somewhere or holds its own event. This makes the follow
graph a distribution channel, not just a matchmaking signal.

The feed is a **third public surface**, and the rule above applies to it
unchanged: it announces an appearance only where the participant's own
profile would show it. A follower of a producer confirmed at a show still
in `planning` is told nothing — the show is anonymised, and a notification
naming the producer would be the same leak by another route. A follower of
the **host** is told from `planning`, because the host is public from
`planning`.

> Never derive the feed from "shows my stars take part in". That reads as
> the obvious implementation and quietly turns the announcement channel
> into the one place A16.6 does not hold.

**In the Restaurant and Retail dashboards.** Their Wine Shows sub-view lists
the same shows a visitor sees, at the same two levels — they are the demand
side and have to find shows (A16.0). This is a **fourth surface** and the
rule holds on it unchanged: it renders through the same visibility functions
as the public page, the profiles and the feed, and a dashboard is not a
licence to show more. A show they are additionally the **venue** of carries
its own detail section on top, because that is a relation and not a listing.

**On the public website.** Shows in `planning` and `published` appear on the
Wine Shows page as cards with the hero image the distributor uploads when
creating the show, plus date, title and city, linking to a full listing.

That listing is **its own route, `/wine-show/{slug}`** — a show is a thing
people forward, and a shared link has to survive leaving the page it was
found on, exactly as A11 requires for profiles and A12 for varieties. The
route renders at whichever visibility level A16.6 grants; it does not become
a second, more generous surface.

> **Prototype deviation, deliberate.** The static mockup has no router, and
> one hand-maintained file per show is precisely the duplication A12 warns
> about. It therefore renders the full listing as an expanding layer on the
> Wine Shows page itself. Same data, same renderer, no URL — the one thing
> the real build must add back.

### A16.8 Member events — "My Events"

Any of the four roles creates and manages these freely — no approval.
Invitations go to concrete recipients — partnered stakeholders, fans, or other
contacts the host names one by one (A16.14e's first kind). An announcement
about the event goes to the host's own fans and optionally his own active
partners, and no further (A16.14e); the follow graph is never a relay. An event owner
may additionally ask a producer or distributor to **sponsor** the event or
**join as an exhibitor**, which the invitee confirms or declines. A retailer's
vintage presentation with the winemaker present, or a restaurant's winemaker
dinner, are the typical shapes.

**What separates the two event kinds, and it is not a matter of size.** A Wine
Show is a **Bottle Lobby format**: show pipeline, contracts, cost releases, a
stored Bottle Lobby review and the platform's guarantee (A16.1). A member event
is created independently by a member: no contractual Bottle Lobby release, no
automatic guarantee, no gates — but subject to the platform rules and to
moderation. Bottle Lobby may block or delist a member event on moderation
grounds; **that is not a release act and must never look like one.**

> **A member-event publication may never look like a Bottle Lobby release.** The
> guarantee is what a Wine Show sells (A16.0, A16.1), and a self-published event
> wearing the same marker would spend it. This is a rule about the card as much
> as about the record: the two kinds may share a directory (A16.14d) and may not
> share a promise.

**One model for all four roles.** Distributor, winery, restaurant and retailer
share one event model. There is no per-role event data model — the first full
cockpit is built on the distributor dashboard, and the same components are then
reused role-dependently. Four dashboards behaving differently taught the user
four navigations for one product once already (D21); this is that lesson applied
before the fact rather than after.

**Lifecycle.** `draft → published → completed`, with optional `cancelled` and
`postponed`. **The host publishes himself.** No gate 1, no gate 2, no Final
Review — those belong to the format that carries the platform's name.

**Location.** Own premises · a restaurant · a retail location · a winery · a
distributor location · a fairground · a free-text address, optionally with a
linked Bottle Lobby entity. **A plain address is enough**; no partner-location
request is required. Where another member is later to be formally involved as
venue, an invitation and confirmation process may grow out of A16.11's shapes —
it is not required for the first pass and must not be built speculatively.

**Wines and participants.** Presented wines are **only** real `productId`
references (invariant 2, A15.2a) — a wine name never becomes an independent copy
(ME-6). Participants may be wineries, distributors, restaurants, retailers,
exhibitors, sponsors and special guests, in these roles:

    host · co-host · exhibitor · sponsor · guest · speaker · winemaker · participant

Sponsor, exhibitor, guest and participant are **different relations**, not four
words for attendance. They live in `event_participants` (A16.9), which extends
`event_invitations` rather than standing beside it.

**Invitations, applications, RSVP — five separate facts.** The host may invite
network partners, fans, stars, selected community contacts, customers,
wineries, distributors, restaurants and retailers — each a concrete recipient
named one by one (A16.14e's first kind), never an audience; the announcement
audience is narrower and its rule lives in A16.14e. Per event the host may also
**allow applications** — a restaurant's Rioja evening where wineries apply as
participants. The five facts are: invitation · application · acceptance as
participant · RSVP as guest · actual attendance. Status values, only as many as
are needed:

    draft · sent · viewed · applied · accepted · declined · withdrawn ·
    waitlisted* · confirmed · attended · no-show

\* **Seats and waitlist places are computed** from request order against
capacity, exactly as for a Wine Show (A16.5 rule 1, A16.10, D28).
`waitlisted` may exist as a computed display state and never as a stored one.

**None of these creates an order.** An application is not a participation, and
an invitation, application, RSVP, attendance confirmation, community
announcement or sponsor commitment creates no order and no partnership (ME-2).
A pre-order or order stays its own transaction and may carry the event or show
id as provenance — which is what A16.12 already does for shows.

**Visibility.** Reach per the taxonomy in A16.14b, plus geographic narrowing
(country · region · city) and `invited-only`. Only members in Frankfurt · only
restaurants · only partners · only my own community · all members. **Geographic
reach, Market Grants (A17.9a), visibility and actual admission are four
different things**, and visibility creates no confirmed participation. `members`
reach does not mean public internet visibility: public, members, partners and
community are distinct levels, and each means what A16.14b says it means.

> **A restaurant's or retailer's member event follows the event's stored reach,
> not the profile's gate.** If the host explicitly selects `public`, the event
> may appear publicly in the Events directory — the card is the host announcing
> himself, which is A16.7's host rule. This does **not** make the otherwise
> membership-gated restaurant or retail profile public (A10): the card links
> only what that gate allows, and the profile keeps its own rule. Two rules, two
> subjects; neither one relaxes the other.

**Publishing and notifications.** On publish the event becomes visible to the
chosen reach. The host's own fans — and, if he includes them, his own active
partners — may receive an in-app notification, under C9's conditions and with
the suppression record respected (A16.14e, A7). No participation, invitation or
partnership arises from a notification.

**Paid end-customer events.** Restaurants and retailers may announce paid
consumer events. **Bottle Lobby stays B2B:** the first pass carries a paid/free
flag, a price note, an external booking or contact link, and the host
information — and nothing else. **No consumer ticketing, no consumer accounts,
no checkout** without a separate decision (ME-7).

**External fairs — a later model, stated now so nothing substitutes for it.**
ProWein, Vinitaly and the rest exist in this repo today only as marketing prose
and as *award* strings; no structured fair data exists anywhere, so the model
starts clean — and none of it is built yet. This block is the shape it takes
when its own pass comes, written down so that no stand-in gets modelled in the
meantime:

- One **canonical record per fair** (`events.event_kind = 'external_fair'`),
  and **no member is its host**. If a fair exists canonically, a member records
  a **participation**, never a copy of the fair.
- A separate **participation row per exhibiting member**: hall, booth, the fair
  days the member attends, a description, and the presented wines as
  `productId` references (ME-6). Nothing about the fair itself is repeated on
  the participation row.
- **Optional meeting slots and invitations** hang off the participation. A
  **booked booth appointment does not make the booking house a fair
  participant** — exhibiting and holding an appointment are two different
  facts.
- The appointment has its **own two-sided flow** — request · confirmation ·
  counter-proposal — and it is a calendar act, not a commercial one: **a booth
  appointment creates no order**. A later order may reference the fair or the
  appointment as **provenance** only, exactly as A16.12 lets an order carry a
  show id.
- **Visibility:** public are the participation, the booth, the days, the
  presented wines and the fact that meetings can be requested. Concrete slots
  and the booking act are for entitled members. What was discussed, who the
  counterpart was and the full calendar belong to the two sides of each
  appointment and to nobody else.
- Explicitly out of scope: running a fair, ticketing, organiser management. The
  existing Vinitaly award strings stay what they are — recognition (A5), not
  participation — and nothing is migrated into fair records.
- **A ProWein participation is never modelled as a member event of a winery** —
  not as a stopgap and not for a demo. That stand-in would put a host on a fair
  that has none and a self-published card on somebody else's format; the
  canonical fair plus a participation row is the only shape this ever takes.

**The cockpit.** The list splits into Drafts · Published · Upcoming ·
Invitations & Applications · Past. The detail level carries Overview · Event
Details · Location · Wines & Program · Exhibitors/Participants · Sponsors ·
Invitations & Applications · Guests/RSVP · Communications · Visibility &
Publishing · Activity/History. It may reuse Wine-Show UI parts and **never
inherits their gate, cost or review logic** — that is the demarcation above,
expressed in components.

**Role examples**, for fixtures and category seeds. Structured but extensible;
not every marketing name becomes a technical type:

| Role | Typical events |
|---|---|
| Distributor | house fair · portfolio presentation · own-label presentation · summer-white event · themed tasting · client event · wine presentation |
| Winery | harvest event · harvest festival · anniversary · cellar event · wine presentation · fair participation · estate event |
| Restaurant | winemaker dinner · themed menu · Rioja evening · white-wine evening · food-and-wine event · end-customer event |
| Retail | after hours · seasonal presentation · summer-wine event · Halloween wines · red-wine night · promotion event |

**Navigation, all four roles: Events → Wine Shows · My Events** (B8). The
distributor's former *Client Events* is replaced by **My Events**; nothing
migrates, because there is nothing behind it — it is a dead `<div>` with no map
entry, no container and no renderer. Retail's *My Events* nav is equally dead,
but its dashboard already carries **hand-written** event content: a stat card
claiming three planned events, an "Upcoming Events" widget with three typed
rows, and matching prose. Card and widget agree only because both were typed —
the D36 shape. **They are rendered from `events` data and the typed versions
retired**, including the duplicate *"Cantina Rossi Tasting"*, which exists twice
with two different dates on two hardcoded surfaces and no shared record; the
fixture decides what that event actually is.

**Storage: two truths, one derived directory.** `wine_shows` and `events` stay
separate records of different kinds, joined by a **derived** directory
projection (A16.14d). No shared base record, no show copied into `events`, no
event copied into `wine_shows`, and no per-surface copy of either (ME-1).

### A16.9 Tables

```sql
wine_shows (
  id, title, hero_image_url, focus_text, event_date, city,
  stage        enum('draft','planning','pending_approval','changes_requested',
                    'published','completed','cancelled','rescheduled'),
  lead_host_id FK → distributors,
  venue_type   enum('host_premises','partner_venue'),
  venue_id     FK → stakeholders (nullable),
  venue_status enum('not_required','requested','quoted','accepted','declined'),
  catering_total,                  -- the venue's price for room + catering.
                                   -- Owned by the venue, entered once, never
                                   -- retyped by the host (A1)
  venue_quoted_at, venue_accepted_at,   -- the host's binding acceptance
  catering_mode enum('fixed_per_product','split_by_products',
                     'host_covers','free'),
  catering_rate_per_product,       -- the host's number, fixed_per_product only
  capacity, menu_url,
  reach[],                         -- multi-select, A16.14b taxonomy. Decides who
                                   -- may FIND the show; meaningless from
                                   -- `published` (WS-3)
  applications_open  bool,         -- may producers apply during `planning`?
  application_deadline,
  staff_note                       -- reason on changes_requested
)

wine_show_hosts      ( show_id FK, distributor_id FK )
wine_show_exhibitors ( show_id FK, producer_id FK,
                       status enum('invited','applied','confirmed',
                                   'declined','lapsed'),
                       source enum('invitation','open_call','producer_request'),
                       -- A16.11 contribution, one per exhibitor
                       contribution_quoted, contribution_basis,
                       contribution_quoted_at, contribution_deadline,
                       contribution_consented,      -- the consented ceiling
                       contribution_consented_at,
                       contribution_order_id FK → orders (nullable) )
wine_show_products   ( show_id FK, producer_id FK, product_id FK → products,
                       proposed_by enum('host','producer'),
                       status enum('proposed','confirmed','declined') )
wine_show_open_calls ( show_id FK, producer_type_id, country_id, region_id,
                       appellation_id, component_id )   -- all nullable
wine_show_attendees  ( show_id FK, stakeholder_id FK,
                       source enum('invitation','request'),
                       status enum('invited','requested','confirmed',
                                   'declined','withdrawn'),
                       requested_at )    -- the order seats are handed out in
wine_show_events     ( show_id FK, at, actor, text )    -- append-only trail

events            ( id, owner_id, owner_type,      -- = host, hostRole (A16.8)
                    event_kind enum('member_event','external_fair'),
                    title, description, theme,
                    event_date, event_time, timezone,
                    location,                      -- free-text address …
                    location_entity_id FK → stakeholders (nullable),  -- … or a linked house
                    hero_image_url, status,
                    capacity,
                    reach[],                       -- A16.14b taxonomy
                    reach_country, reach_region, reach_city,   -- geographic narrowing
                    registration_mode enum('none','rsvp','application'),
                    is_paid bool, price_note,      -- B2B only — no checkout (ME-7)
                    external_link )                -- booking or info, off-platform
                                                   -- history: `event_log`, same shape
                                                   -- as wine_show_events

event_invitations ( event_id FK, stakeholder_id FK,
                    role enum('guest','sponsor','exhibitor'),
                    status enum('invited','confirmed','declined') )

event_participants ( event_id FK, stakeholder_id FK,
                     role enum('host','co_host','exhibitor','sponsor','guest',
                               'speaker','winemaker','participant'),
                     status enum('draft','sent','viewed','applied','accepted',
                                 'declined','withdrawn','confirmed',
                                 'attended','no_show'),
                     requested_at )   -- the order seats are handed out in.
                                      -- `waitlisted` is NOT here: it is computed
                                      -- from requested_at against capacity (D28)

event_products    ( event_id FK, product_id FK → products )   -- references only

event_campaigns   ( id, subject_type enum('show','event'), subject_id,
                    kind enum('announcement','reminder'),
                    audience_query, sent_at, sent_by, preview_seen_at )
event_campaign_recipients ( campaign_id FK, stakeholder_id FK )
                                      -- the resolved audience, SNAPSHOT at send,
                                      -- deduplicated, suppressions subtracted;
                                      -- read internally, shown only as a count

communication_suppressions ( recipient FK,
                    kind enum('block','unsubscribe','preference'),
                    sender FK,        -- NULL = global, any sender
                    campaign_kind enum('announcement','reminder'),
                                      -- NULL = both kinds
                    at )              -- ONE resolver reads all three kinds
                                      -- (A16.14e); no settings surface yet
```

**Products are referenced, never copied** — `wine_show_products.product_id`
is a foreign key into `products`, owned by the producer (A1, A2). A show
lists which products are presented; it never holds product content.
`event_products` is the same rule for the second event kind (ME-6).

**`event_participants` extends `event_invitations`, it does not stand beside
it.** The invitation table answers *who was asked, in what role, and what did
they say*; the participants table answers *who is actually in this event, in what
role, and where does that stand* — including the applications the invitation
table has no direction for. Two tables holding the same pair with two status
chains would be D32 again, one level down; the invitation row is the origin of a
participant row and never a second copy of it.

**A show's release is a stored act, and `reviews` is where it lives.**
`reviews.subjectType` (A17.8) gains **`show`** alongside `membership · contract ·
project`. A `published` show without an approved review row is a harness failure
(WS-6) — `published` is never derived from the publish preconditions alone,
because a computed checklist reaching green is not the same fact as Bottle Lobby
having said yes (A16.1, invariant 6). It is the same table, the same shape and
the same authority as the own-label gates; nothing new is built for it.

`wine_show_events` is append-only, like `order_events` (A14.3): every
invitation, confirmation, decline, staff decision and reschedule writes one
row. It is what makes a disputed show reconstructable.

**The contribution fields sit on the exhibitor row, not in a table of their
own.** There is exactly one contribution per exhibitor per show, so a
separate table would only add a second key for the same pair — and the
contribution has to die with the participation it belongs to. Its history
is not lost: every quote, confirmation, recalculation and lapse writes a
`wine_show_events` row like everything else.

`contribution_consented` and `contribution_basis` are **stored on purpose**,
against invariant 7, for the reason set out in A16.11: an amount somebody has
agreed to pay must not move underneath them. `lapsed` is a status of its own
rather than a reuse of `declined`, because a missed deadline and a refusal
are different facts — one may be re-invited without ceremony, the other has
answered.

### A16.10 Computed, never stored

- **Whether a show may be published** — derived live from venue, exhibitor,
  product, cost and consent state, not a flag someone sets. This is the old
  `planning` trigger, moved to where it belongs (A16.2, A16.14c, D38). Entering
  `planning` needs only the host's basics and is not a computation.
- **Whether a member event is visible to a given viewer** — computed from its
  `reach[]`, its geographic narrowing and the viewer's relations (A16.8,
  A16.14b). Never a stored per-viewer list.
- **A seat or waitlist place at a member event** — the same arithmetic as a Wine
  Show, over `event_participants.requested_at` against `capacity` (D28).
- **Which side has to act next** — derived from `proposed_by` and
  `status` on the product together with the exhibitor's own status. A
  product proposed by the host waits on the producer, one proposed by
  the producer waits on the host, and a confirmed one waits on nobody
  (A16.4). Never store a "whose turn" marker: it would be a second
  source for something the two existing fields already answer, and it
  would go stale the moment either side acts.
- **A producer's contribution — computed until they agree to it, fixed
  afterwards.** Before the quote goes out it is live: `products × rate`
  under `fixed_per_product`, `catering_total × (own ÷ all products)` under
  `split_by_products`, nothing under `host_covers` and `free`. At
  confirmation the agreed figure is written to `contribution_consented` and
  becomes a **ceiling**: what the producer owes is
  `min(current computation, consented ceiling)`. A recalculation may lower
  it silently and can never raise it.
  > **Why this one is stored** (A16.11): live computation and consent are
  > incompatible once money is involved. Leave it live, and a producer who
  > agreed to €400 owes €500 the moment somebody else drops out — an
  > increase they never saw, caused by a third party. The ceiling is the
  > same deliberate exception A14.5 makes for an issued invoice PDF, and
  > for the same reason: a figure someone has relied on is a record, not a
  > view. The *shape* stays computed — only the agreed number is pinned.
- **Whether the show is committed** — derived, never a flag: true as soon
  as one `contribution_consented` exists or `venue_accepted_at` is set.
  This is what closes off `cancelled` and `rescheduled` (A16.2).
- **The host's coverage** — `catering_total − Σ contributions`. Positive is
  the gap the host carries, negative the margin they keep. Under
  `split_by_products` it is zero until the host absorbs a gap; under
  `fixed_per_product` it is the host's own commercial call.
- **Whether a show may be submitted for approval** — every contribution
  settled (A16.11), on top of the existing readiness checks. Never a flag:
  it is the sum over the exhibitor rows.
- **A seat, and the waitlist position** — the confirmed attendees in request
  order; the first `capacity` of them hold seats, the rest are the waitlist,
  in that order. Neither is stored, which is precisely why a withdrawal
  promotes the next person without anything running (A16.5).
- **What a given viewer sees** — computed from `stage` and the viewer's role,
  per A16.6. Never two stored versions of the same show.

### A16.11 Catering settlement

The one place in a Wine Show where money moves. It runs on the vocabulary of
A16.5: the **host** is the organising distributor, the **venue** is the
restaurant or retailer providing room and catering.

**Two relations, never merged into one number:**

```
VENUE ──── quotes room + catering ────► HOST ──── charges a contribution ────► EXHIBITORS
       (one price, the venue's number)        (per exhibitor, the host's number)
```

The venue never bills a producer and never learns what a producer paid. What
the two numbers do not cover, the host carries.

**What an exhibitor is shown is the basis actually used — no more.** Under
`split_by_products` that is the venue's total and the product count, because
the amount *is* that division and quoting a share without its divisor would
be unreadable. Under `fixed_per_product` it is the rate and the number of
wines: `2 × €250`. The venue's quote is **deliberately not shown** there, and
neither is the host's coverage.

> **This is a decision, not a side effect of the mode — do not "fix" it.**
> Under a fixed price the producer is buying a stand at a stated price, the
> same way a stand is booked at any fair: the price is the price, and what it
> costs the organiser to provide it is the organiser's business. Disclosing
> the venue's quote alongside would invite a negotiation about the host's
> margin that the producer is not party to — and it would leak the venue's
> commercial terms to a third party who is not in that relationship. It would
> also make the host's own risk public: under `fixed_per_product` the
> coverage moves with every dropout (A16.10), so the number would swing for
> reasons that have nothing to do with the producer and change nothing about
> what they owe.
>
> The producer is not left in the dark about *their own* amount. The rate,
> the wine count and the arithmetic are all on the quote, and a fixed rate is
> the one mode where the amount is fully predictable before the line-up is
> even settled. Traceability of one's own figure is what is owed here;
> visibility into somebody else's cost base is not.

#### The flow

| # | Who | Act | What it writes |
|---|---|---|---|
| 1 | Host | Requests a partnered restaurant or retailer as venue (A16.5) | `venue_id`, `venue_status = requested` |
| 2 | **Venue** | Names one price for room and catering, and organises the catering | `catering_total`, `venue_quoted_at`, `venue_status = quoted` — and **notifies the host**. The figure enters the show directly; the host does not retype it (A1) |
| 3 | Host | Picks the mode and, for `fixed_per_product`, the rate | `catering_mode`, `catering_rate_per_product` |
| 4 | Host | **Dispatches the contributions.** Possible only once the venue has quoted **and** every exhibitor's product is confirmed (A16.4) — both computed, not ticked | `contribution_quoted`, `contribution_basis`, `contribution_deadline` per exhibitor |
| 5 | — | The producer is told **twice**: under Messages and in their Wine Shows section | one notification, two surfaces — not two records (A1) |
| 6 | **Producer** / **Host** | The binding step, both sides: the producer confirms their amount, the host accepts the venue's offer. **Mechanics exactly as A6:** a modal stating the obligation, a checkbox, and a confirm button hard-disabled until it is ticked | `contribution_consented(_at)` · `venue_accepted_at`, `venue_status = accepted` |
| 7 | Host | Issues each producer a **prepayment invoice** (A14.5 `PP`) | payment status → `invoiced`, due date set |
| 8 | Host | Marks each contribution **paid** or **settled otherwise** (A14.7) | `order_payments` row, or the `settled_otherwise` status |
| 9 | **Bottle Lobby staff** | Release the show — A16.1 unchanged, only its precondition grew: no show goes public with contributions outstanding | `stage = published` |

Steps 1–2 are A16.5's venue request; steps 3–9 are this section. Note the
order: the participation confirmation of A16.4 comes **first** and is about
the wine, the contribution confirmation here comes second and is about the
money. They are never merged — a producer agrees to exhibit before anybody
can say what exhibiting costs, and asking for both in one click would be
asking for consent to an amount that does not exist yet.

#### The commitment point

**From the first consent — a producer's, or the host's acceptance of the
venue's offer, whichever lands first — the show is committed.** It is not a
stage and not a flag; it is derived (A16.10) from those two facts.

What it locks:

| | Before | After |
|---|---|---|
| `cancelled` / `rescheduled` | Available | **Gone** (A16.2) |
| A consented amount | May change freely | May only fall, never rise |
| `catering_mode`, rate, venue quote | Editable | Frozen |
| An exhibitor leaving | Free | Only by agreement — the participation is as binding as the payment. Swapping the wine (A16.4) stays open; showing nothing does not |
| Covering a shortfall | Recalculate, or absorb | **Absorb only** |

#### When an exhibitor drops out

The obvious answer — remove them, recalculate, send it round again — can
loop: if a second producer falls away in the second round, everybody
confirms a third time, days before the fair. Four rules together make that
impossible rather than merely unlikely.

**1. `fixed_per_product` is the default mode.** A fixed amount per presented
wine means a dropout changes **nobody's** amount — only the host's coverage.
The cascade is ruled out by construction, not managed after the fact, and it
matches how fairs actually work: a stand costs what it costs, it is not a
share of the organiser's invoice. `split_by_products` stays for hosts who
want to pass the venue's bill through one-to-one; rules 2 and 3 exist for
them.

**2. Every quote carries a deadline.** Whoever has not confirmed by then
drops out automatically — `status = lapsed`. The host never has to throw
anybody out, which is the point: removing a partner by hand is a
relationship act, and it should not be the price of an unanswered email.

**3. A fresh consent is needed only for an increase.** A recalculation that
lowers an amount passes through in silence — consent to €400 covers €350.
One that would raise a consented amount is **refused**, not applied; for an
exhibitor who has not confirmed yet it replaces the quote and restarts their
deadline.

**4. The host may carry the difference.** Instead of recalculating, the host
absorbs the gap: everyone else keeps their amount and hears nothing about
it. It is a decision per show — whether calm and a settled line-up are worth
more than the shortfall.

> Rule 4 is not a convenience. After the commitment point it is the **only**
> remaining route, because rule 3 has closed the other one. Build it as part
> of the lifecycle, not as a nice-to-have button.

#### Invoicing — proposed: an `orders` record

*Recommendation, to be confirmed before the invoicing pass is built.*

**Use `orders`, with `source: 'wine_show_catering'` and a `wine_show_id`.**
Everything
the settlement needs already exists there and works for all four roles:
the `PP` prepayment invoice with its own number sequence (A14.5), the payment
chain with partial payments and derived `overdue` (A14.7), the two-sided
single record (invariant 8) — the host sees a sale, the producer a purchase,
of one row. A parallel invoicing path would mean a second document sequence,
a second payment table and a second UI: precisely the duplication invariant 1
exists to prevent.

Three things must be true for it to hold:

1. **`order_items.product_id` becomes nullable**, for service lines carrying
   a description instead — *"Wine Show participation · Grande Rioja · 2
   wines"*. Invariant 2 is untouched: where a line names a product it is
   still a foreign key, never a copy.
2. **A `wine_show_catering` order can never carry product lines.** That is
   the guard that keeps it from looking like a supply-chain shortcut, and it
   makes the direction inversion safe: here the distributor is the seller and
   the producer the buyer, the reverse of A3's flow. **A3 constrains the flow
   of goods, not the flow of money.** A service invoice between two partnered
   parties is not a channel for products.
   > The guard belongs to **this value**, not to shows in general. Orders that
   > come out of a show's order list (`wine_show_order`, A16.12) run the
   > normal way down the chain and always carry product lines. One value for
   > both would have made the guard wrong the moment A16.12 was built.
3. **It stays out of the shipping and stock KPIs** (A14.8). There is nothing
   to pack and nothing in transit; "Ready to Ship" and every bottle count
   must skip these orders. They belong in the list with a source chip of
   their own, because the producer has to find and pay the invoice.

The show's own surface still shows the contribution and its status directly —
it links to the order rather than re-rendering it.

#### Not this: attendance fees

**Restaurants and retailers attend a Wine Show free of charge.** The paid-
entry model belongs to member events (A16.8), where a host may charge for
their own occasion — and even there only as a flag, a price note and an
external link, never as a checkout (ME-7). It must not migrate here: A16.5's waitlist exists because
a Wine Show is an entry point into the network, and a fair that charges its
buyers to walk in is a different product. The only money in a Wine Show flows
producer → host → venue.

#### Still open

- **Legal effect of the click confirmation.** Sufficient for the prototype,
  undecided as law: whether ticking a box and pressing a button creates an
  enforceable payment obligation is a question for a lawyer, not for this
  document. Open with it: whether the host needs a **signed acceptance of
  the venue's offer** on top, given that Bottle Lobby already sends real
  contracts for partnerships (A6). Two very different amounts are involved —
  a producer's contribution and a venue's whole invoice — and they may not
  deserve the same instrument.
- **The `orders` recommendation above**, until confirmed.
- **Cross-border VAT on the contribution.** A14.6 sets `tax_mode` per order;
  a German distributor charging an Italian producer for a fair in Düsseldorf
  is a case nobody has worked through yet.

### A16.12 The order list — from a show to an order

A16.0 says why a Wine Show exists: present an unlisted producer's wines,
collect orders on the spot, buy only what somebody has asked for. This
section is that mechanism. It is the **instrument**; A16.11 is the
housekeeping around it.

#### What is written on the show floor is not an order

Three reasons, all of them already rules elsewhere:

| | |
|---|---|
| The person entering may not be a partner | A Wine Show is an entry point into the network (A16.5) — but ordering needs an **active** partnership (A6) |
| The wine is not in the distributor's portfolio | Only wines actually taken on appear there, and it is the purchase that creates the relation (A3). Testing an unlisted producer is the whole point |
| Nobody has committed to supply anything | An order has a seller who stands behind it. At the moment of entry, no one does |

So the show floor writes an **interest** — one row per attendee per product,
in `wine_show_interests`. It is not an order in a different coat: it may
come from a stranger, it may never convert, and one that lapses must leave
no trace in order history or in any KPI. Modelling it as an `orders` row
with a special stage would put all three of those problems inside the table
A14 keeps clean.

#### Who may enter one

| Who | Case |
|---|---|
| The attendee | on their own device |
| The host's staff | at the stand, on the attendee's behalf — the real-world normal case |
| **Never the producer** | they do not hold the distributor's customer relationships (A2, A3) |

`entered_by` records which. What can be picked is not a form but the show's
own line-up: the **confirmed `wine_show_products`** (A16.4). References
again, never product content.

**Only an attendee who holds a seat** (A16.5) may enter one — not somebody
on the waitlist, not somebody who merely found the show in their dashboard,
and **not anybody once the list is closed**: the host has bought against
those figures, so a line added afterwards would be an order with no stock
behind it. From closing on the list is placed, not edited. This falls straight out of what the signal is for: its worth is
that the person **tasted the wine**, and a waitlisted account was not in the
room. It is the same rule as "never from the public listing" below, applied
to the one case that looks like an exception and is not.

**The producer is not shown the tally.** They see that they are exhibiting
and, in time, an order; they do not see how many houses asked for what
before that order is placed. The consolidated purchase is the distributor's
negotiating position, and handing over the demand behind it before he has
bought would be handing over his hand. What the producer eventually
receives — one order for a stated quantity — says everything they need and
nothing they are not party to.

#### The indicative price

A quantity entered without a price is a wish, not a demand signal — the
attendee has no idea what they are letting themselves in for, and the
distributor cannot read the number as intent. A binding price is equally
impossible: the distributor has not bought the wine yet and does not know
what it costs him.

So: **`wine_show_products.indicative_price`, set by the host, shown to the
attendee, and explicitly non-binding.** It is the host's number about
somebody else's product — the same ownership shape as the catering rate in
A16.11, and the reason it sits on the show-product row rather than on the
product, which the producer owns (A2).

**The binding price appears exactly once: in the sales order the attendee
places.** They see the final figure before placing, so no version of the
consent problem A16.11 had to solve can arise here.

#### Two kinds of wine on the same table

This is the distinction everything else in this section turns on, and the
attendee has to see it on every line:

| | In the host's portfolio already | Being tested at this show |
|---|---|---|
| What a line is | an **order** | a **pre-order** |
| Stock | held; A3's relation already exists | none — the host has not bought it |
| Delivery | as usual | after the show, at the lead time below |
| What it feeds | the sales order alone | the **consolidated purchase order**, and then the sales order |
| What it is worth to the host | ordinary revenue | **the instrument** (A16.0): how many bottles of an unlisted wine their customers actually want |

**Which of the two a line is, is computed** — from whether the product is in
the host's portfolio at that moment (A3), never a flag on the show. A wine
can move from the second column to the first between one show and the next,
and that is the mechanism working.

**The attendee is told per line, in plain words:** *"In stock — delivered as
usual"* against *"Pre-order — about 14 days after the show"*. Getting this
wrong is not cosmetic: somebody waits weeks for a wine they could have had
on Tuesday, or clears shelf space for one that has not been bought yet.

> Both kinds may sit on **one** sales order — a guest orders what they
> tasted, and where it comes from is the host's problem, not theirs. A14
> already carries that: `partial` ship status is a part-shipment (A14.2),
> and the stocked half goes out while the pre-ordered half is still coming.
> Splitting into two orders would produce two records from one act for no
> gain the buyer can see.

#### The tally is computed

*"Rioja Reserva 2019 · 7 houses · 138 bottles"* is `SUM(qty)` over the
interests, live (invariant 7). Never a stored total: attendees are still
entering while the host is reading it.

#### Closing the show

From `completed` (A16.2) the host works the tally, per **pre-ordered** wine —
stocked lines need no decision, they simply sell:

- **Place it** — with the quantity **raised** if they want full cases or a
  buffer. Raising is their commercial decision.
- **Hold it back, with a reason** — the numbers did not carry the listing
  this time.

Lowering the consolidated quantity below what was asked for is not a closing
decision — that case is the producer's inability to supply, below.

#### Holding back cannot strike an order somebody has already placed

Closing does two things at once — purchase orders out, the guests' door
open — so the obvious worry is a race: a guest places, and the host then
holds that wine back, leaving an order for goods nobody will ever buy in.

**One rule removes it: a pre-order line is placeable only once the host has
actually ordered it.** Not "decided to", not "intends to" — ordered, with a
purchase order to point at. It follows that:

- a held-back line was **never placeable**, so holding back cannot shorten
  anything; there is nothing to cancel and nobody to apologise to;
- an **undecided** line is not placeable either, so a host who closes now and
  makes up their mind next week creates no exposure in between;
- once a wine **is** ordered upstream, holding it back is no longer offered.
  From that moment the only thing that can go wrong is the producer failing
  to supply, which is a different event with a different cause and is already
  routed into A14 (`declined`, or lines edited while they are still editable,
  or a credit note). **Do not let that case be renamed "held back"** — one is
  the host choosing not to buy, the other is the producer unable to sell.

A guest's prepared order therefore contains exactly what the distributor can
actually deliver: their stocked lines, plus the pre-ordered lines that are on
their way. The rest is a note, not an order line — which is the same
distinction the message to the pre-orderer makes below.

**Holding back is not a refusal, and the model must not render it as one.**
It opens a negotiation. The reason goes **to the producer**, who can answer
it: carry the freight, improve the terms, accept a smaller first delivery —
a listing can be worth more to them than the margin on one pallet. Some
wines need two or three shows before they carry themselves, and the held
pre-orders are the argument for the next round, which is why they are kept
(see *A held-back interest is kept*, below, and A8).

> So the reason is a **message to a partner, not an archive entry**. A
> distributor who writes "only 18 bottles, I need 60 to justify the freight"
> has said something the producer can act on. The same fact filed away says
> nothing to anybody.

**What the pre-orderer is told — decided, with the argument, because both
answers are defensible.** A flat *"not available"* is honest and wrong: the
wine may well arrive after the next show, and a guest told "no" stops
asking, which destroys the demand signal that A8 and the next round both
live on. So the line is not refused; it is **not ordered yet**:

> *"Not ordered this time. Your note is kept, and you will hear if that
> changes."*

Three constraints keep that from becoming a false promise:

1. **No date and no "coming soon".** Nothing may imply the wine will be
   listed, because nobody knows yet.
2. **The line leaves the prepared order.** A line sitting in an order looks
   like an obligation; a kept note looks like interest, which is what it is.
3. **The tally is not quoted in the message.** *"96 bottles were asked for"*
   would hand one guest the room's demand, which is the host's book (A16.5,
   rule 4) — the near-miss worth naming, because the sentence writes itself.

The pre-orderer keeps one action: withdraw the note. Nothing may hang on a
list for ever without the person who wrote it being able to take it off.

**And the negotiation can succeed.** A held-back wine may be **released
later** — the producer carried the freight, or the terms improved — which
places the purchase order at that point and makes the kept notes placeable
again. That is what turns *"you will hear if that changes"* from a
politeness into a mechanism. It is also why the interests were kept: without
them the second round would start from nothing.

> **One caution about the reason text.** The system never shows a producer
> the tally (above). The host writing *"only 18 bottles, I need 60 to justify
> the freight"* is disclosing a figure **by choice**, in a message they are
> composing to a partner, which is theirs to make. The rule is about what the
> platform reveals on its own, not about what a distributor may decide to
> tell somebody.

#### One act, two directions

```
interests ──► CLOSING ──┬──► one order per PRODUCER    (purchase)
                        └──► one order per ATTENDEE    (sales)
```

One order per producer, not one per show: each producer is a separate
supplier with a separate invoice. "One targeted order" means one instead of
the seven separate ones the seven attendees would otherwise have caused.

**Upstream** is an ordinary A14 order — `source: 'wine_show_order'`,
`wine_show_id` set, lines with real `product_id`s. It is also the act that
brings the wine into the distributor's portfolio, which A3 already
specifies; nothing new is needed for that.

**Downstream the buyer still places the order.** A14.2 gives placing to the
buyer and every other transition to the seller, and that rule survives
here intact: the host **prepares** each attendee's order from their own
interests, and the attendee places it with one action after seeing the
final price, the quantity and — per line — whether it ships from stock or
is a pre-order. An interest is a signal; placing is an act; the two are not
merged.

#### Why any of this is allowed: the partnerships are already there

Both ends of a show are settled before an order can exist, and they are
settled at different times:

| | When | Rule |
|---|---|---|
| **Producer** | **Before the show.** Invited, partnership concluded, then exhibits | A16.4 — exhibiting requires an active partnership. So when the consolidated order is placed, the producer **is** a partner and A6 is satisfied without anything special happening |
| **Attendee** | **After the show, if at all.** Attends as a guest with no partnership; needs one only to buy | A16.5 for attending, A6 for buying |

That asymmetry is the reason A16.12 works at all, and it is worth stating
because it is invisible in the flow: the upstream order needs no new
permission, while the downstream one may have to wait for a partnership that
does not exist yet.

**For an attendee who is not a partner, the prepared order waits.** The
partnership request goes first (A6) — precisely the pipeline A16.5 means by
"entry point into the network" — and the order becomes placeable when it
goes active. Nothing is lost in the meantime: the interest keeps its place.

**And for that first order, the route is quotation → prepayment → dispatch**
(A14.5 `QU`, then `PP`; A14.7's prepayment flag blocks dispatch until paid
in full). Not an invoice on account. Nothing needs building — the documents
and the flag exist; what is new is only which of them a show-sourced order
reaches for by default.

#### What the attendee actually has to be told: how long it takes

The normal case is not scarcity. It is **lead time**. The wine exists; the
distributor simply does not have it yet, because the whole model is to order
it after the show. Somebody who tasted a wine on Thursday and wants it on
their list needs to know whether that means next week or next month.

So the host names a **lead time** — *"about 14 days after the show"* — and
the attendee sees it on the lines it applies to. **By closing at the
latest**, and earlier if the host already knows it: guests write their lists
during the show, and a pre-order line that can say "about 14 days" while
they are standing there is worth more than one that says so afterwards. Until
it is named the line reads *"delivered after the show"*, with no figure
invented to fill the gap. It belongs to **pre-order lines only**: a wine already
in the portfolio ships as usual and saying "14 days" about it would be
wrong in the other direction. That is a figure on the show, not a mechanism:

| | |
|---|---|
| `wine_shows.delivery_lead` | The host's expectation, named once at closing and shown on every prepared order from that show |
| `orders.eta` (A14.3) | The real date, once the goods are actually moving |

The two are deliberately different fields. An expectation given before
anybody ordered is not a delivery date, and writing it into `eta` would turn
a sentence into a promise the shipping block then reports on.

#### When the producer cannot supply — the exception

It happens: a vintage sells out, or the producer turns the consolidated
order down. **This needs no machinery of its own.** The purchase order is an
ordinary A14 order and A14.2 already has `declined` for exactly this; what
follows is the ordinary order flow — the affected sales orders are edited
while their lines are still editable, or corrected by credit note once they
are not (A14.8).

Two things hold, and both are already rules elsewhere:

- **The attendee is told, with the reason.** A change to a number somebody
  has acted on is never silent — the same principle A16.11 states for the
  catering contribution.
- **One attendee never learns another's quantity.** The distributor's book
  stays the distributor's (A16.5, rule 4).

#### Two `source` values, not one

`orders.source` gets **both** show values, and they are opposites:

| Value | Direction | Lines | Purpose |
|---|---|---|---|
| `wine_show_order` | Distributor **buys** from the producer, and sells on to attendees — the normal chain (A3) | **Always** product lines | The instrument |
| `wine_show_catering` | Distributor **invoices** the producer for a service — against the chain | **Never** product lines | The settlement (A16.11) |

**The guard is per value, not per feature:** a `wine_show_catering` order
may never carry a product line — that is what keeps the direction inversion
from looking like a supply-chain shortcut (A3) — while a `wine_show_order`
must carry them. A single `wine_show` value with one guard covering both
was the earlier draft and is superseded (Appendix D, D27).

#### Prepayment is the default for a first order, and that default is computed

**Recommendation, and the answer to "should it be preset":** yes — preset,
visible, and switchable off by the seller.

The condition is not "is this a new customer", which would be a stored flag
going stale the day it stops being true. It is derived: **prepayment defaults
to on while there is no settled trading history between these two parties** —
no order between them that has reached `delivered` and `paid`. The first
order to a freshly won partner therefore arrives with the flag set, and the
second one, after the first has been paid, does not. Nobody maintains
anything.

> **The distinction that matters:** the flag on the order is **stored** —
> it is a decision, and it must not change under a live order. What is
> computed is only its **initial value**. A live-computed flag would clear
> itself the moment the first invoice was paid, possibly while the goods were
> still on the shelf. Set at creation, then left alone.

Defaulting is not forcing. The seller can clear it, and clearing it is then a
deliberate act by the party carrying the risk — which is the point.

#### Tables

```sql
wine_show_interests (
  show_id     FK → wine_shows,
  attendee_id FK → wine_show_attendees,   -- who was at the show, A16.5
  product_id  FK → products,              -- reference, never a copy
  qty,
  entered_by  enum('attendee','host'),
  status      enum('open','ordered','held_back','withdrawn'),
  hold_reason,                            -- goes to the PRODUCER, not to an archive
  order_id    FK → orders (nullable)      -- set when it becomes a sales line
)
```

`held_back` replaces the earlier `lapsed`: a wine not taken this round is a
decision with a reason and an open negotiation, not an expiry (Appendix D,
D29).

`wine_show_products` gains `indicative_price` (host-owned, non-binding);
`wine_shows` gains `delivery_lead`, named at closing. `orders` already
carries `wine_show_id` from A16.11; both show sources use it.

An interest is only ever written while the show is `published` or
`completed` — never from the public listing, for the reason below.

#### Computed, never stored

- **The tally per wine** — `SUM(qty)` over open interests.
- **The proposed allocation under short supply** — pro rata, recomputed
  whenever the delivered quantity changes. What the host *decides* is
  stored, as order lines; the proposal never is.
- **Whether a line is an order or a pre-order** — from the product being in
  the host's portfolio at that moment (A3). Never stored on the show: a wine
  taken on between two shows changes column by itself, which is the whole
  mechanism.
- **Whether a pre-ordered line may be placed at all** — from a purchase
  order for that wine existing, not from the host's intention. This is what
  makes holding back safe at any moment (above).
- **Whether an attendee may place their prepared order** — from the
  partnership being active (A6), not from a flag on the interest.
- **Whether prepayment is preset on a new order** — from there being no
  settled order between the two parties yet. Computed once, at creation,
  and then stored as the decision it is.
- **What is still outstanding against a purchase order** — from the order's
  own lines and ship status (A14), not from anything held on the show.

#### Where this section lives, and why

**In A16, not A14.** The process has no life without the show — its
`wine_show_id` is never null, it starts on the show floor and it ends when
the show is closed. A14 describes what an order *is*; this describes an act
that *produces* orders, and what comes out the other end is an ordinary A14
order in every respect. Putting it in A14 would give that section a second
creation path and a special case, for a mechanism that belongs to the show.
A14 gains only the mechanical parts: the two `source` values and the
`wine_show_id` column.

#### Two rules about when an interest exists, and how long

**Only during or after the show — never from the public listing.** The
tempting version lets a visitor mark a wine from the Wine Shows page and
makes the tally readable earlier. It is the wrong feature: **the value of
the signal is that somebody tasted the wine.** A note made from a web page
is a different thing wearing the same name, and allowing both would mix them
in one column with no way to tell them apart afterwards. A pre-order page is
a decision of its own, not a side effect of this one.

**A held-back interest is kept, never deleted.** *"Three restaurants wanted
this wine and it came to nothing"* is precisely the market intelligence A8
trades in — arguably worth more than a fulfilled one, because it names
demand nobody is currently serving. `status = 'held_back'` is therefore a
resting state, not a tombstone: it is the evidence the host takes back to the
producer, and the starting figure for the next show. The rows stay put like
every other history in this model (A16.4's declined products, `order_events`,
`wine_show_events`).

### A16.13 Prototype state

**Prototype blueprint:** the `SHOW_ROLES` registry — same shape as
`ORDER_ROLES` (A14.8), now all four roles across three `side` values
(`host` · `producer` · `venue`) — `showWineShows()` / `renderWineShows()` /
`renderShowDetail()` for the two-level list-and-detail sub-view,
`showReadiness()` + `promoteIfReady()` for A16.10, and the
`wine-show-modal` / `show-invite-modal` / `show-product-modal` trio plus
`wine-show-venue-modal` / `wine-show-quote-modal` for the venue relation.
All in `bottle-lobby-dashboard.html`.

**Who sees which show is one function per question, never a filter written
twice:** `showsForRole()` (which shows reach a role at all),
`isShowParticipant()` (working detail or the visitor pane),
`showAwaits()` (list sort, row chip, KPI and sidebar badge — four readers,
one answer) and `visibleTrail()` (which rows of the append-only trail a side
may read). The last one exists because the first version of the venue pass
hid the line-up in the exhibitor box and then printed it in the history box
two boxes below: **a rule enforced in one renderer and forgotten in the next
is not a weaker rule, it is none** — the same sentence A16.6 makes about
surfaces, one level down.

**Shared, because the public surfaces need the same records (A16.7):**

| File | Holds |
|---|---|
| `assets/bottle-lobby-data.js` | `wineShows` — one record per show, exhibitors and products nested as relations. Also `SHOW_HERO_IMAGES` / `SHOW_HERO_FALLBACK`. Read it as the draft schema for the Supabase build. |
| `assets/bottle-lobby-public-shows.js` | `publicShowCard(show, level)` and `publicLevelFor(show)` for the two levels of A16.6, `publicShowTeaser(show, level)` for the A16.7 card, `publicShows(all, past)` + `PUBLIC_UPCOMING_STAGES` / `PUBLIC_PAST_STAGES` for which shows a stranger may see listed, plus `confirmedExhibitors()`, `showHeroImage()`, `showDateValue()`. |
| `assets/bottle-lobby-public-shows.css` | Every class those renderers emit. Sharing the renderer and copying its stylesheet would only have moved the drift from structure to appearance. |
| `assets/bottle-lobby-profile-shows.js` | The Wine Shows tab on the fifteen public winery and distributor profiles. Each page declares only `<div class="ws-profile-shows" data-entity="…">`; the name is the join key standing in for a foreign key. |

`publicParticipation(show, entity)` is where the A16.6/A16.7 table above
lives, and `mountShowCards()` renders the cards and wires the expanding
listing for every surface at once — the Wine Shows page, all fifteen
profiles and the dashboard preview.

The announcement channel stays in the dashboard, since it is not a public
page: `starsOf()`, `followedAppearances()` and `paintAppearanceWidget()`
fill a **From Your Stars** widget on all four overviews. It asks
`publicParticipation()` the same question the public surfaces ask, which is
what keeps it from becoming the exception.

The dashboard, the public Wine Shows page and the public profiles load
these two files rather than carrying their own copy. A second renderer
would be a second answer to "what may this visitor see", and the whole
point of A16.6 is that there is one. Both are **classic scripts, not
modules** — the prototype is opened over `file://` as well as over http,
and `file://` blocks modules. Load order is the only contract: data first.

`hero_image_url` exists as `heroImage` on every record. A real host
uploads; a static mockup has no server, so the create-show modal picks
from the photography in `images/`. Same field, same rendering.

**Built so far:** hosting a show, inviting an exhibitor with an optional
wanted wine, the full two-sided wine handshake of A16.4 — the producer
answers the host's proposal, the host answers the producer's, and either
may decline a wine without ending the participation — the lifecycle
stages, the computed readiness checklist, and both visibility levels side
by side. `exhibitorTurn(show, exhibitor)` is the single computed answer to
"who is at turn"; both dashboards, the sidebar badges, the list sort and
the per-exhibitor chips read it, so the two sides can never disagree.

**Built for the venue relation (A16.11 steps 1–2):** Restaurant and Retail
have their own Wine Shows sub-view. It lists **every show A16.6 makes
visible to them** (A16.0) and opens a browsed show as the public listing,
rendered by the same `publicShowTeaser()` / `publicShowCard()` the website
uses — the dashboard is the fourth surface and gets no licence of its own.
A show they are the **venue** of is added whatever its stage, sorts first
and carries the request box: name one price for room and catering, or
decline. The price lands in the show record and the host reads it there,
with a chip naming the amount on their list row — the quote is announced,
never a silent update. Three disclosure rules hold around it, all tested in
`tests/venue-request.js`: an exhibitor never sees the venue's quote, a venue
sees head counts rather than names until the show is released, and the
search box matches producer names only where the viewer may already read
them.

**Built for attendees (A16.5):** invitations from the host, requests from
anyone at all — attending needs no partnership — accept, decline, withdraw,
and the waitlist. `attendeeQueue()` cuts the confirmed attendees in request
order at `capacity`; a withdrawal promotes the next person because the same
arithmetic is asked again, with nothing to run and nothing to keep in step
(D28). The attendee list renders for the host alone: an attendee sees only
their own standing, the venue a head count, the public card nobody at all.
`tests/attendees.js` compares the promoted attendee's record byte for byte
before and after, which is the check that fails if anybody ever stores the
standing.

**Not built yet.** Two chains and two loose ends:

**Built for the order list (A16.12):** the show floor writes interests and
the host reads the tally. `writeInterest()` is the single mutation, so the
attendee's own list and the host writing at the stand cannot enforce the
rules twice and differently; a quantity of zero removes the row rather than
storing one. `mayWriteOrderList()` admits an attendee **holding a seat** at a
released show and nobody else — not the waitlist, who were not in the room.
Three disclosure rules, each tested: a guest sees only their own lines, the
producer sees no tally at all, and the public card carries none of it.
`indicativePrice` lives on the show product, never on the producer's own
record.

**Built for holding back (A16.12):** the closing takes a decision per
pre-ordered wine — place it, or hold it back with a reason — **before**
anything is created and before the guests' door opens. The reason goes to
the producer, who reads it in their own show detail; a hold-back with no
reason is refused, because a reason nobody can answer is a filing. Held
interests rest as `held_back` and the guest reads *"not ordered this time,
your note is kept"* on every branch of their own box, with a withdraw
beside it. `releaseHeldWine()` is the negotiation succeeding: it places the
purchase order at that point and reopens the kept notes.

**Built for the closing (A16.12):** `closeShowOrderList()` places **one
purchase order per producer out of the pre-order column alone** and opens the
guests' side; `preparedOrderFor()` is **computed, not a record** — the
guest's own interests rendered as an order they place themselves, which is
what keeps A14.2's rule intact. Both show sources carry `wine_show_order`
and a `wineShowId`. Prepayment is preset from `prepaymentDefault()` — no
settled order between the two parties — evaluated once at creation and
stored from then on. A guest with no active partnership is refused **in the
action**, not merely denied the button. Closing ends the writing window.

> The column filter sits on the purchase path **twice**, in
> `consolidatedOrders()` and again in `preorderInterests()`. Deliberate:
> either alone produces the right order, so dropping one keeps every test
> green while leaving the rule on a single point of failure — and the
> failure it guards against is buying wine that is already on the shelf,
> which surfaces at the loading bay weeks later. `tests/order-list.js`
> proves the pair by mutating both at once.

**Built for the two columns (A16.12):** `lineKind()` reads the host's
portfolio and answers stock or pre-order per line; nothing about the column
is stored, so a wine taken on between two shows changes column by itself.
The guest's list says which in words on every line and carries the lead time
on pre-order lines only — the mistake in the other direction is claiming
"14 days" for a wine on the shelf. The host's box separates ordinary revenue
from `preorderTally()`, the figure their first order to an unlisted producer
rests on (A16.0). The demo fixture puts both columns on **one** show, because
a distinction split across two shows is present but never demonstrated.

**Not built yet.** Two chains and two loose ends:

**The order list (A16.12) — the closing.** One consolidated order per
producer, a prepared order per attendee that the attendee places
themselves, and `delivery_lead` shown before they do.

**The rest of the catering settlement (A16.11 steps 3–9)** — steps 1–2 are
built. Steps 3–8 touch nothing the order list touches; **step 9, the
invoicing, must come after A16.12**, because both share `orders.source` and
the guard that hangs off it (D27).

Loose ends, independent of both: open calls with master-data filters
(A16.4) and member events (A16.8).

**A16.7 was built in three passes, all done.** The shared assets above were
the first. The public Wine Shows page is the second — an Upcoming Shows
section placed **after** the Case Study, because the page has to explain the
format before real dates mean anything, with the past shows below it and the
full listing as an expanding layer. The third is the Wine Shows tab on the
fifteen public winery and distributor profiles, rendering from the same
records: six list shows, nine show an empty state, and the two producers
confirmed at an anonymised show appear on neither, per the table in A16.7.

A fourth pass added the follow graph as the announcement channel — the
**From Your Stars** widget on all four overviews, reading the same
visibility function as the two public surfaces. **A16.7 is complete.**

The demo graph carries a deliberate fixture for it: Weinhaus Müller
follows Bodegas Ruiz, who is *confirmed* at the anonymised Grande Rioja.
Their feed stays empty, which is the rule demonstrated rather than merely
asserted. `tests/follow-feed.js` fails if that pair is ever removed,
because without it every other assertion in the file passes vacuously.

Restaurant and Retail profiles still carry their hand-written empty state.
**Both relations they need now exist** — venue (A16.11 steps 1–2) and
attendee (A16.5) — so the pass is unblocked, and the rule it must implement
is the role table in A16.7: venue from `published`, attendee from
`completed`. `publicParticipation()` answers only `host` and `exhibitor`
today and is where those two rows belong; nothing else should learn to
answer the question separately. Their dashboards already carry the feed,
since A16.7's own example is a restaurant following a winery.

Which shows a stranger may see listed is itself derived (A16.10), not a
curated list: `planning` and `published` are upcoming, `completed` is
history, and `draft`, `pending_approval` and `changes_requested` are absent
entirely. The dashboard's "What the public sees" preview renders the card
and the listing through the same two functions the page calls, so a host is
shown exactly what a visitor will get.

> ⚠️ The prototype carries a **`Simulate Bottle Lobby release (demo)`**
> button on `pending_approval`, labelled as a demo shortcut and sitting next
> to a note naming the real mechanism. There is no admin panel in the
> mockup. Do not let that button imply the gate is optional — A16.1 is the
> control point, and in the real build the host can never release their own
> show. Delete the button the moment an admin surface exists.

### A16.14 The show as a marketplace

A16.1–A16.13 specify a show as an **instrument**: who may host it, who exhibits,
what it costs, what it produces. This section specifies it as a **listing** —
who may find it, how they get in, and where it is found. Without those three the
format works only between houses that already know each other, which is the one
thing A16.0 says a Wine Show exists to change.

#### A16.14a Visibility on the marketplace

**A16.6 is the rule and is not restated here.** What belongs in this section is
which surfaces it governs, because a marketplace adds surfaces faster than
anything else in this model:

| Class | Surfaces | Access decided by |
|---|---|---|
| **1 — public and directory** | Wine Shows page · `/wine-show/{slug}` · Wine Guide → Events · public profiles · the follow feed · the dashboards' Discover lists · marketing pages | **reach** (A16.14b), then the three-level table in A16.6 |
| **2 — working** | the host's cockpit · a participant's own view of the show · the venue's detail section | **role in the show**, never reach |

Every new surface declares its class before it declares anything else. A surface
that cannot say which class it belongs to is the surface that will one day
answer as the other one — which is A16.6's own argument about renderers, applied
to the thing being rendered.

#### A16.14b Reach — the host decides, and it is a multi-select

    reach: [ 'public', 'members', 'wineries', 'distributors', 'restaurants',
             'retail', 'partners', 'community' ]

**This is the platform's reach taxonomy and it is defined once, here.** Wine
Shows, member events (A16.8), own-label visibility (A17.13a) and any later
community feature **reference this list**. None of them redefines the levels,
and none of them adds a private one. **Campaigns do not resolve against it**:
reach decides who may *find* a carrier, a campaign audience is the host's own
graph (A16.14e, D43) — every recipient must still pass the carrier's
visibility, so reach keeps its gate without ever becoming an address book.

- **Every entry permits; none forbids.** A house in two selected groups sees the
  show once, deduplicated. There is no precedence and no self-contradicting
  combination — which is precisely why it is a multi-select and not a ladder.
- **`partners`** = active business relations (Network, A6, B8). **`community`** =
  follow and community segments (My Stars / My Fans, A7). **The generic value
  `network` does not exist** — the word names a nav section and must not also
  name a reach level (D39).
- **`matchmaking` is deliberately absent as a value**, and deliberately **named
  in the interface, shown locked, with its reason on screen**. The reader sees
  why A8 is worth building instead of finding an option that quietly does
  nothing. It unlocks when the real matchmaking model exists, not before.
- **Host and confirmed participants always see their show.** They are not an
  audience, they are the show, and no setting can lock a host out of his own
  event (WS-2).
- **Excluded means invisible, not anonymised.** No greyed card, no count, no
  placeholder. An anonymised tile reads *"something is happening here, and not
  with you"*, which in a competitive trade is information in itself (WS-4).
- **From `published` the reach falls away** for the published page (WS-3). A
  released show stands on the open website, and filtering a public URL for
  members is a promise the URL cannot keep. Role or geographic reach chosen for
  *discovery placement* may still order a directory — it never gates the route.

> **Reach decides who may FIND the show. Acceptance and release decide WHICH
> NAMES it shows. Neither ever creates an action right** — no order, no
> participation, no partnership follows from being able to see something. This
> is the same sentence A17.13a makes about an own-label product and MG-1 makes
> about a market grant; it is one rule with three applications, and it is the
> one most often eroded by a helpful button.

#### A16.14c Recruiting, Final Review, and the stored release

**Recruiting is an activity inside `planning`** — not a new show and not a new
stage (D38). Two fields carry it: `applications_open` and `application_deadline`
(A16.9), on top of the `wine_show_open_calls` filters that already exist (A16.4)
and the free-places arithmetic that is already computed (A16.10).

A planning listing may show: title, date, city, theme, description, wanted wines
and exhibitors, the deadline, free places, the hero image and the planning
status. It may **never** show: unconfirmed applicants, unconfirmed invitations,
confidential contracts or costs, private messages, or attendee identities.

**A producer applies — A16.4 mirrored, not doubled.** An application is a
`wine_show_exhibitors` row with `status:'applied'` and
`source:'producer_request'` (or `open_call`), naming a wine by **product key**
(never a typed name, A15.2a; and the wine must be the applicant's own,
invariant 2) — or asking to be considered without naming one. From there:

| Transition | Meaning |
|---|---|
| `applied → accepted` | the host confirms; from here it is an ordinary exhibitor entry and A16.4 is unchanged |
| `applied → declined` | with a reason, kept on the row — a resting state like `held_back` (D29), not a deletion |

**An application creates nothing** — no exhibitor confirmation, no
participation, no order (WS-5). On the host's side it is a task; on the
applicant's side it reads *"applied, waiting for the host"*. Invitation and
application states, only as many as are needed:

    draft · sent · invited · viewed · applied · accepted · declined ·
    withdrawn · expired

> **`accepted` is the act of accepting, never a second exhibitor status.**
> The one status of a producer who is on the show is `confirmed` (A16.4), and
> `confirmed_exhibitors` is the single gate deciding who may be named in public
> — it must have exactly one input. Read the row above as "the host accepts, and
> the row becomes `confirmed`"; two words for one state is the defect D26 names.

**Publish preconditions — the old planning trigger, arriving where it belongs.**
All of these before **Submit to Bottle Lobby** becomes active:

- the host's final confirmation
- the venue's date, services and terms accepted
- the required exhibitors and wines confirmed (A16.4)
- total costs fixed
- the per-bearer cost split fixed (A16.11 contributions)
- every affected bearer has consented to their share
- the required documents present

And **Bottle Lobby still decides manually** (A16.1). The checklist is what makes
the submit button legitimate; it is not what makes the show public.

**The release is a stored act, never a computed one.** `reviews` gains
`subjectType:'show'` (A16.9, A17.8), and a `published` show without an approved
review row is a harness failure (WS-6). `pending_approval` carries the UI label
**Final Review**; `changes_requested` stays its return path. Material changes
after that point follow the rule in A16.2 — reset in `pending_approval`, notify
and re-release in `published`, correction events in `completed` (WS-7) — and the
A16.11 commitment bar is untouched by all of it.

#### A16.14d Discovery — one directory, several surfaces

**A Discover list beside the cockpit tabs:** every upcoming show the viewer is
allowed to see (A16.6, A16.14b), sorted by date, filterable by city, region and
focus. This is the piece the growth argument rests on — **a reach setting
without a directory changes nothing**, because it only decides who *would* see a
show nobody can browse for.

The three public surfaces read the **same** records through the **same**
renderers — the A16.6 single-answer rule, already implemented as
`publicShows()` / `publicShowCard()` / `publicParticipation()` (A16.13):

1. **`/bottle-lobby#shows`** — explains and markets the format. Not a directory.
2. **The standalone Wine Shows page** — a curated landing: format, background,
   case studies, selected upcoming and past shows.
3. **Wine Guide → Events** (A10) — the full filterable directory over Wine
   Shows, member events and, where they exist, external fairs and
   participations. Role- and reach-dependent; for a non-member it is today's
   public page plus the join prompt.

**Filters only where real data covers them** — no invented counts, no empty
categories: kind (Wine Show / Member Event / external fair) · stage (Planning /
Published / Upcoming / Completed) · date · country, region, city · event category
· wine colour, origin, variety, style · theme · host role · relation (Hosted by
Me / Participating / Invited / Applied / My Events / Other Events).

**Cards are reused, never copied.** Wine Shows keep their card; member events get
a matching one that **must not assert the Bottle Lobby guarantee** (ME-3). A
reviewed, platform-released show and a self-published event may sit in one list
and may not make the same promise (A16.8).

#### A16.14e Communication — three kinds, kept apart

| Kind | Goes to | Changes |
|---|---|---|
| **Direct Invitation** | a concrete recipient, for a concrete role or action | the invitation status — it is acceptable and declinable |
| **Community Announcement** | the host's **own fans** — the incoming follow edges of his A7 graph — optionally plus his **own active partners** (A6); the audience rule below | **nothing.** No invitation, application, participation, partnership or order arises from one |
| **Reminder / Operational Update** | those already on the carrier — the reminder rule below | **nothing on its own** — a date change or venue note is information, not a renewed consent (that is A16.2's material-change rule) |

Collapsing the second into the first is how a marketing mail becomes an
obligation somebody never entered.

**Campaigns**, for both event kinds, one mechanism (`event_campaigns`, A16.9):

- resolve the audience **before** sending, and store the recipients as a
  **snapshot** — a campaign is answerable for who it actually reached, not for
  who a query would return today
- deduplicate; subtract the suppression record (below); and every recipient
  must pass C9's visibility condition for the carrier itself — a campaign never
  shows anybody an event he could not have found
- preview before send, then an explicit send confirmation — no confirmation, no
  send, and an abandoned preview stores nothing
- an auditable send log
- **never disclose the recipient list** — every surface shows counts, never
  names, the sender's own included

**The announcement audience — own fans, and nothing wider.** Allowed: the
incoming follow edges of the host's own A7 graph (his fans), optionally plus his
own active partners (A6). Not allowed, structurally: accounts the host himself
follows (his outgoing edges — following somebody is not their consent to be
addressed) · global role or member groups · the reach taxonomy (A16.14b gates
*finding*, never *addressing*; the carrier's discovery reach is untouched by
this rule and never feeds the audience) · the community or partners of a
participant, winery, exhibitor or venue. The first form of this rule —
announcement to a reach segment — is **D43**.

**The reminder audience never re-resolves a community.** Wine Shows: confirmed
exhibitors and confirmed attendees, plus open invitations. Member events:
accepted or confirmed participant roles, plus open invitations. Excluded:
applicants, the declined, the withdrawn, no-shows, the host himself, and a
venue without an explicit participation row.

**Stages.** An announcement needs an upcoming, visible carrier — a show in
`planning` or `published`, a member event in `published` or `postponed`; never
`draft`, `pending_approval`, `changes_requested` or `completed`. A reminder
needs a carrier that is not over, and it is **never a substitute for a
material-change consent** (A16.2, WS-7).

**Suppressions.** `communication_suppressions` (A16.9) holds three distinct
kinds — `block` · `unsubscribe` · `preference` — each row naming the recipient,
the kind, the sender scope (one concrete sender, or global) and the campaign
kind it covers (announcement, reminder, or both), with its date. **One resolver
reads all three**, for both campaign kinds. A settings surface for the
recipient is a later, named pass; the record and the resolver are not.

**Volume limit.** One central, configurable demo constant — never derived from
the fixtures. A send that would exceed it is **rejected in full, with the limit
named**: no silent capping, no partial send.

**The host may address his own community, and nobody else's.** A participating
winery does not thereby reach the host's fans, and a **venue never exports or
reuses attendee data** — A16.5 rule 4 is not suspended by a campaign tool
(ME-4).

### A16.15 Invariants

Wine Shows:

- **WS-1 — reach never names an unconfirmed producer or applicant.** Measured on
  the rendered surfaces, at every reach level, not on the data behind them.
- **WS-2 — reach never excludes the host or a confirmed participant.**
- **WS-3 — reach is meaningless from `published`.** Asserted so that nobody
  later filters a public page.
- **WS-4 — an excluded show is absent.** No card, no title, no count.
- **WS-5 — an application creates no exhibitor confirmation, no participation
  and no order.**
- **WS-6 — no `published` show without an approved `reviews` row**
  (`subjectType: 'show'`).
- **WS-7 — a material change in `pending_approval` or `published` resets or
  renews the affected consents.**

Member events:

- **ME-1 — no `wine_shows` row inside `events`, and no event copied per
  surface.** The directory is derived.
- **ME-2 — publish, announcement, RSVP, application and sponsoring create no
  order and no partnership.**
- **ME-3 — no Bottle Lobby guarantee marker on a member event**; a moderation
  block is not a release act.
- **ME-4 — campaigns carry a recipient snapshot**, deduplicated, and resolve no
  foreign community.
- **ME-5 — guests, general participants, applicants and unanswered invitations
  are never named on venue or participant surfaces** — those show head counts,
  never identities. One naming is allowed: a confirmed **`winemaker` or
  `exhibitor`** may be named on the public surfaces of a **published** member
  event, after their explicit acceptance and never before it — until then the
  name appears only in their own view and the host's. The event itself stays
  gated by its stored reach (A16.14b), and a public naming is neither a release
  act nor a guarantee (ME-3). The first, blanket form of this rule is D42.
- **ME-6 — event wines resolve to product keys.** A typed wine name is a harness
  failure (A15.2a).
- **ME-7 — no consumer checkout or ticketing structures exist.**

**Harness homes:** `tests/shows-reach.js` for WS-1..WS-5 and
`tests/shows-release.js` for WS-6 and WS-7 — **with guards
that actually look**, which is the A16.6 lesson (C7) — and a new
`tests/member-events.js` for ME-1..ME-7. Each derives independently and compares
against the rendered surfaces rather than the arrays behind them. **ME-4 and the
A16.14e campaign rules live in their own `tests/campaigns.js`** — announcement
audience, reminder resolution, stages, the suppression resolver and the volume
limit, for both carrier kinds.

---

## A17. Own Label

*Written 4 August 2026 from Serge's business decisions.*

Own Label is the first area where **Bottle Lobby is a party to the transaction
rather than the place it happens**. Everywhere else two houses trade and the
platform records and protects it. Here Bottle Lobby admits the companies,
contracts with each of them, approves twice, and is paid per bottle. That is the
reason for a programme with its own contracts, two review gates, and a written
consent at every step — and why this section is long for a feature with three
rows behind it today.

---

### A17.0 Normal wine is the platform; own label is an addition to it

**Bottle Lobby is not an own-label marketplace.** The ordinary route — producer →
distributor → restaurant or retailer — is the business. A normal wine keeps every
ability it has today and none of them depends on own label: a producer publishes
it; several suitable distributors may carry it; it enters a book with no project
behind it; it is resold onward; it uses ordinary orders, offers and promotions; it
carries no exclusivity; and **it never triggers a bottle fee**.

**Measured, 4 August 2026 — the demo baseline.** The catalogue holds **20 products
across 5 producers**, of which **3 advertise own-label work and 17 do not**. The
distributor's book holds **14 wines, 3 own label and 11 ordinary**. Roughly one in
six.

**Re-measured, 5 August 2026, after the catalogue pass.** The producer catalogue
holds **21 products across 6 producers**; the distributor's book holds **14
wines**; across every book the platform knows **27 distinct products** — plus
ordinary wines merely marked open to own-label requests, which is a capability and
not a product (A17.0a).

> **The 5 August classification was wrong, and D41 records it.** That measurement
> called **6 of the 27 finished own labels**, counting the six bridged listings
> PRD-1020 … PRD-1025. **None of the six was an own label.** Every one of them is
> the producer's own appellation wine, under the producer's brand, on an article
> page written in the producer's name — and five of those pages give the
> own-label ribbon the same reason: *exclusive distribution through Hawesko*.
> That is the case **A17.0b's last paragraph excludes by name**: a producer-owned
> brand sold exclusively by one distributor is an ordinary product plus a
> distribution exclusivity, and it is out of scope here. The sixth, PRD-1022,
> contradicted the flag on its own page, which reads *Own-Label Available* — the
> capability, not the product.

**Re-measured, 6 August 2026, after the own-label fixture pass.** The producer
catalogue holds **21 products across 6 producers**, all ordinary; **2** finished
own-label products exist, each with its own `PRD-` key, `brandOwner` = Hawesko
and a gate-2-approved project behind it; **1 of the 2 is active** — its first
commercial delivery is confirmed, so its primary distributor's listing derives
`ownLabel` and it is in the book. The other exists and is deliberately **not** in
the book (A17.9). The distributor's book holds **15 wines, 1 own label and 14
ordinary**; across every book the platform knows **29 distinct products, 2 of
which are finished own labels** — plus **5** ordinary wines across **2 producers**
marked open to own-label requests, and **2** projects in flight carrying no
product at all.

> **OL-10 is a fixture rule, not a domain rule.** The demo keeps ordinary wine in
> the clear majority so a reader can see what the platform is. That is a statement
> about *this catalogue*, not about the trade: a real distributor may specialise
> entirely in own label, and nothing in the model forbids it. The invariant is
> checked against the fixtures and is silent about production.
>
> **So is the ratio itself: two own labels among 29 products is a FIXTURE
> DECISION, not a market observation.** It is built that way on purpose, so the
> whole pipeline is visible at once in an investor conversation — ordinary wines,
> wines open to requests, a project in flight and finished, active own labels,
> the four states this section asks for, all on screen together. **What the
> pipeline demonstrates does not depend on the count**: one project per stage is
> one stage visible, and the 5 August figure of six was six copies of the last
> stage that had never reached it. Nobody should read either ratio as a claim
> about how much of the trade is own label. **That is precisely why OL-10 is a
> fixture invariant and not a domain rule** — a domain rule would be asserting
> something about the world that this catalogue is in no position to assert.

The fixtures must show four states a reader can tell apart at a glance: ordinary
wines · ordinary wines open to own-label requests · projects in flight · finished,
active own-label products.

### A17.0a The word that means four things

**Measured, and it changes the model.** The prototype uses "own label" for facts
at four different levels:

| Level | Today | Becomes |
|---|---|---|
| A company **may take part** in the programme | nothing | an active `ownLabelProgramMemberships` row |
| A wine **may be asked about** | `note:'Own-Label Available'` — free text on 3 rows, all Cantina Rossi | `products.ownLabelAvailability` |
| A **finished own-label product** exists | nothing | the winery created it from a **gate-2-approved** project |
| A distributor **carries** an own label — the **Primary Own-Label Listing** | `ownLabel:true` on 3 portfolio rows | derived — first commercial order delivered **and** the listing holder is the project's **primary** distributor |

One phrase, four facts, no way to tell them apart in code — the same shape as the
three wine books (D34) and the four partner lists (D32). **Capability, project,
finished product and active listing are four different things** and each gets its
own home.

The last two are the pair most easily collapsed, and collapsing them is exactly
what would put a wine on a restaurant's list before a bottle exists:

    project passed gate 2, winery created the product  →  a finished own label
    first commercial order delivered                   →  active in the book

**The fourth fact is the Primary Own-Label Listing, and "primary" is load-bearing.**
The listing that reads as own label is the **project's primary distributor's**
listing — the one this product was created for. A product may reach further down
the trade (A17.9b), and a downstream holder's listing is an ordinary listing: own
price, own article number, and no own-label status. Saying "one distributor
carries it" without naming which one is how the fourth fact quietly becomes a
fifth (A17.12, OL-15).

**A finished own-label product is created from a gate-2-approved project; its
active distributor listing and its `ownLabel` status are derived only after the
first order has been delivered.** Between those two moments the product exists and
is visible to the winery, the exclusive distributor and Bottle Lobby — inside the
project and in the first-order draft — and to nobody else (A17.9). The rule
*product created ≠ active in the portfolio* holds throughout.

    ownLabelAvailability:  unavailable · on_request · available

It says only whether a project **may be started**. It does not make the base wine
an own label, does not restrict ordinary distribution, and a wine open to requests
**stays ordinarily tradeable** unless a specific exclusivity agreement says
otherwise. The free-text note is replaced, not supplemented.

**A programme admission is not a product offer.** A winery admitted to the
programme has said *this house can do own-label work*. It has not said *every wine
of mine is available*. The second statement is made per product, afterwards.

### A17.0b An own label is its own product

Hawesko's Sancerre under Hawesko's brand is not Henri Dubois' Sancerre: different
brand, different label, possibly different bottle, its own article page, its own
key. An own label ends as a **new `PRD-` record**, produced by the winery
(`winery` stays the producer — invariant 2 does not bend) and **branded by the
distributor**, which the project records.

That is what `ownLabel:true` was doing wrong on a base wine: marking the
producer's product with a fact about somebody else's business.

**Brand ownership, first version:** `brandOwner = distributor`, always. A
producer-owned brand sold exclusively by one distributor is **not** an own label
in the sense of A17; it is an ordinary product plus a distribution exclusivity,
and it is out of scope here.

---

### A17.1 The programme — admission before anything else

**A normal Bottle Lobby account is not enough, and neither is a partnership.**
Both sides apply to the own-label programme, and Bottle Lobby signs a **framework
contract with each of them separately**, before any project exists:

    Bottle Lobby ↔ Distributor
    Bottle Lobby ↔ Winery

    Application → consent recorded → framework contract sent
      → signed contract returned → Bottle Lobby reviews → company admitted

**One model for both roles.** `ownLabelProgramMemberships` carries a `companyRole`
of `distributor` or `winery`; the two applications ask different questions and
travel the identical path. Two tables would be the same state machine written
twice, and a copy drifts (D33).

    { id, companyId, companyRole, applicationData, submittedAt,
      consentId, contractId, reviewId,
      validFrom, validUntil, suspendedAt, terminatedAt,
      createdAt, updatedAt }

**No `isOwnLabelPartner` boolean anywhere.** Membership is **read**, from six
conditions:

    active(m) =  m.submittedAt
             AND m.consentId resolves to a consent
             AND the contract at m.contractId is approved
             AND the review at m.reviewId is approved
             AND today is within [validFrom, validUntil]
             AND not m.suspendedAt AND not m.terminatedAt

> **`applicationStatus` is not stored either, and that is a deliberate deviation
> from the field list.** Every step it would describe is already an act with a
> date somewhere else — submitted, consented, contract sent, contract returned,
> under review, approved, revision required. A status field beside them is a
> seventh copy that can disagree with all six, and this project has paid for that
> shape twice. What the interface needs is a **label**, and a label is computed.

**The application content** is `applicationData` — a form, versioned with the
programme terms, not a column per question. Distributor asks about territories,
channels, customer network, expected volumes, wine types and regions, own-brand
experience, brand and design competence, target markets, and which Bottle Lobby
services are wanted. Winery asks about production capacity, minimum and annual
volumes, available wine types, bespoke cuvée capability, bottling and packaging,
bottles and closures, label options, lead times, export capability, target
markets, certifications, private-label experience, sample capability, support
wanted, and the responsible contact.

**Suspension keeps the history.** A suspended or expired membership blocks **new**
projects. Existing projects, orders, contracts and documents stay visible and
readable. Nothing is deleted, ever — the record of what was agreed is the point.

#### What each role confirms on admission

The framework contract is where the general obligations live, and the admission
records these confirmations. **They belong to the programme, per company — a
project contract carries only project-specific terms and never repeats them**
(A17.7, OL-13).

**The winery confirms:**

- to sell, supply or export own-label products **only via Bottle Lobby**, or
  with the prior documented knowledge and consent of Bottle Lobby
- no circumvention by side agreement
- to accept the fixed per-bottle fee (A17.10)
- to report correct quantities and order data
- to honour the concrete project agreements

**The distributor confirms:**

- to order own-label products from the winery **only via Bottle Lobby**, or with
  prior documented consent
- no circumvention
- to honour the agreed source and platform binding (A17.9)
- **downstream sales only within the agreed Market Grants** (A17.9a)

**The platform binding holds for both parties, and an informal exception does
not suffice.** Bottle Lobby stands as guarantor for the agreement, the
exclusivity and the trade route; A17.9's variation rule — the agreement varied or
ended, with a Bottle Lobby approval — is the only exit from any of it.

#### The contract order is serial, and each step waits on a Bottle Lobby check

The two framework contracts are separate documents, and the project request does
not travel until the right one has been checked (A5, A17.6):

    distributor's signed contract checked by Bottle Lobby
      → the request reaches the winery as an EFFECTIVE project request
    winery's signed contract checked, GATE 1 released
      → the winery's acceptance reaches the distributor as an EFFECTIVE commitment

A request that arrives before the check is not a request the other side can act
on, and this is why: the whole point of admitting companies before projects
exist is that neither side is ever negotiating with an unvetted counterparty.
Checkbox consent, signed contract and Bottle Lobby review remain **three separate
stored facts** (OL-4); gates 1 and 2 remain **two separate stored manual
reviews**; and only the winery ever creates the product (invariant 2, A17.9).

### A17.2 The Own Label tab before admission

Both roles see the **`Own Label`** navigation item as soon as their ordinary
account is live. Before programme approval it does not show a cockpit and it is
**not a locked screen** — it is the page that sells the programme: what an own
label is, what the programme gives, how the pipeline runs, that Bottle Lobby
secures the exclusivity and the platform handling, what the obligations are, how
relabelling and bespoke development differ, how design, samples, contracts and
orders work, which optional services exist, and that an application and a
framework contract are required.

    Call to action:  Apply to Become an Own Label Partner

**Seven states, and every one of them is read from the membership record**, never
stored as a screen name:

| State | What the tab shows |
|---|---|
| not applied | programme, pipeline, benefits, requirements, the button |
| application submitted | *Application submitted*, a summary, *Waiting for Bottle Lobby* |
| contract sent | *Own Label Partner Agreement sent*, sign and return |
| contract under review | *Contract under review*, *Waiting for Bottle Lobby* |
| changes required | *Application requires changes*, Bottle Lobby's note, a way to complete it |
| approved | the full cockpit: projects, pipeline, tasks, designs, samples, contracts, first orders, active products |
| suspended / expired | the state and its explanation, no new projects, existing work still visible, a way to renew or make contact |

### A17.3 Public badge

An approved company carries a public mark — *Verified Own Label Partner*,
*Own Label Winery Partner*, *Own Label Distributor Partner* — on its profile, in
search, in the network, in the own-label area, and on suitable wine profiles.

**Derived from a currently valid membership and from nothing else.** On
suspension, expiry or termination it disappears the same day, with no field to
remember to clear. Historic projects and contracts are untouched: the badge says
*is a partner now*, not *was ever one*.

---

### A17.4 Preconditions for a project request

A distributor may open a project only when this reads true:

    canStartOwnLabelProject(distributor, winery, product)

      active programme membership for the distributor
      AND active programme membership for the winery
      AND neither suspended nor expired
      AND an active partnership between the two houses
      AND the product belongs to that winery
      AND the product's ownLabelAvailability is 'on_request' or 'available'
      AND no conflicting exclusivity blocks it

**Every term is read, none is stored**, and the whole function is a reading of
records that already exist. The refusals name the missing condition rather than
saying no:

| Missing | What is said |
|---|---|
| distributor not admitted | *Apply to become an Own Label Partner* |
| winery not admitted | *Winery is not currently an Own Label Partner* |
| product closed | *Own Label not available for this wine* |
| no partnership | *Partnership required* |

**No project record is created in any of these cases.** A refused request leaves
nothing behind — an empty project in a "blocked" state would be a fifth way to
describe the same conditions.

### A17.5 Two product routes, chosen at request time

The distributor picks one:

    Rebrand an existing wine   ·   Develop a new wine with the winery

**Route A — relabel.** Cuvée, varieties, vinification, ageing, the underlying
vintage or batch and the technical values are unchanged. Brand, product name,
front and back label, packaging and possibly bottle and closure change, as long as
the liquid does not.

    creationType: 'relabel_existing_wine'
    sourceWineId:  <the producer's existing product>     // required

Technical figures are **referenced from the source, not copied** — the rule that
has governed wines since A1. A correction on the source reaches the own label,
which is correct: it is the same liquid.

**Route B — bespoke.** A different cuvée, other varieties, another vinification or
ageing, a different origin or classification, its own production batch, or a wine
developed from nothing.

    creationType: 'bespoke_new_wine'
    sourceWineId:  null
    developmentReferenceWineId: <optional>

The reference is **development history and nothing else**: it never feeds a
technical value, is never shown as the new wine's origin, and never implies the
two are the same wine. **A false lineage is worse than none** — it puts a second
answer to "what is in this bottle" into the data.

> **What is frozen is the agreement, not the wine.** The specification approved at
> gate 2 is kept as an immutable snapshot, exactly as a consent is. Technical data
> on a relabel stays live through the reference. Two different questions, two
> different answers.

Alongside the route the distributor states the opening picture: wine type, style,
varieties, target market, volume, first-order quantity, target price, territory,
desired start, design responsibility, and an optional message. **This is a brief,
not a specification** — it is what the negotiation starts from.

---

### A17.6 The pipeline

    Programme application → consent → framework contract → Bottle Lobby approval
      → cockpit unlocked
      → distributor chooses rebrand or develop
      → project request
      → project consents + project agreement → GATE 1 → project active
      → negotiation · product and cuvée · design and brand      (in parallel)
      → agreement to sample
      → sample prepared → shipped → received → approved
      → final terms (addendum if terms moved) → GATE 2
      → winery creates the product from the project
      → first-order draft → distributor sends it → winery accepts
      → production → shipping → delivery
      → active in the distributor's portfolio

**Stages 2–4 run in parallel and are a summary, not gates.** Only gates 1 and 2
belong to Bottle Lobby; the first order is the distributor's own act and is never
sent automatically.

**Version one needs no negotiation chat and no redline system.** It needs the
**current specification plus a legible history**: the spec as it stands, and every
change with actor and date — the same shape as an order's `log` and a show's
`events`. A conversation layer can be added later without moving anything.

### A17.7 Contract hierarchy, and how repetition is avoided

Three levels, three documents, and **each obligation is written in exactly one of
them.**

**Level A — the framework contracts.** Bottle Lobby with each company separately.
Programme participation, platform binding, anti-circumvention, roles and duties,
Bottle Lobby's economic participation in principle, audit and documentation
duties, suspension and termination.

**Level B — the project agreement, gate 1.** Only this project's particulars: the
wine or the development brief, territory, term, quantities, price or price frame,
exclusivity scope, design responsibility, project-specific duties.

> **Both companies have already signed level A, so gate 1 does not restate it —
> it incorporates it by version.** The project consent stores the
> `programTermsVersion` the company accepted, and the modal's clause text is short
> and points at those terms rather than reprinting them. This is checkable: a
> sentence may not appear in both texts, and a project consent may not be recorded
> while the referenced programme membership is inactive.

**Level C — the final specification or addendum, gate 2.** After the sample: final
wine, cuvée and technical execution, brand, label, bottle and packaging, price,
minimum quantity, first-order quantity, territory, term. Where terms moved, an
addendum; where they did not, a confirmation without a new document.

**Three acts, never one.** A pop-up acceptance, a signed contract and a Bottle
Lobby approval are three records at every level. None may be created, implied or
advanced by the presence of another.

---

### A17.8 Records

Seven, each answering one question.

**`ownLabelProgramMemberships`** — may this company take part (A17.1).

**`ownLabelProjects`** — the working relationship and where it stands.

    { id, distributor, producer, creationType, sourceWineId,
      developmentReferenceWineId, productId, stage, brandOwner,
      requestedAt, requestedBy }

`productId` stays **null until the winery creates the product after gate 2**
(A17.9). *This corrects the V1 draft, which allowed it from stage 5.*

**`ownLabelTerms`** — party-scoped, two rows per project.

Shared terms (territory, term, minimum quantity, first-order quantity, spec)
appear on both and must agree — checkable. **The fee appears only on the winery's
row**; the distributor's row has no fee field at all, so there is nothing to hide
(A17.10).

**`consents`** — append-only, never edited.

    { id, subjectType, subjectId, party, role, termsType, termsVersion,
      textSnapshot, byUser, forCompany, at, language }

`subjectType` ∈ `membership · project`. Programme consent and project consent are
the same act on different subjects — one shape, two callers.

**`contracts`** — one shape for programme, project and addendum.

    { id, subjectType, subjectId, party, kind, status,
      sentAt, receivedAt, docNo }

`kind` ∈ `program_agreement · project_agreement · addendum`.
`status` ∈ `preparing · sent · received · under_review · approved ·
revision_required · rejected`. **One list, party as a field** — not one chain per
side.

**`reviews`** — Bottle Lobby's approvals, and the only place its authority lives.

    { id, subjectType, subjectId, gateNumber, reviewStatus,
      reviewedBy, reviewedAt, reviewNotes, approvalType }

`subjectType` ∈ `membership · contract · project`. Programme admission, contract
approval and both gates are the same act on different subjects. When the Bottle
Lobby operations role is built it writes these rows and nothing else changes.

**`ownLabelFeeEvents`** — append-only ledger (A17.10).

### A17.9 The winery creates the product

**The distributor may never write a product record in the producer's name.**
Invariant 2 is not a preference: a wine created by somebody else is a second
answer to who made it.

After `sample_approved` → final terms confirmed → gate 2 approved, the winery gets
one button:

    Create Own-Label Product from Project

Prefilled from the project: creation type, source wine if relabel, distributor,
product name, brand, label, packaging, bottle, closure, cuvée, varieties,
technical specification, territory, term, minimum quantity, first-order quantity,
design files. The winery reviews it, fills the technical fields only it can
answer, and confirms. **Prefilled is not created** — the approved specification
stays the origin of the values, and the product is a new record the producer signs
off.

**Exclusive assignment: one stored pointer.** The product carries

    ownLabelProjectId: <project>

and nothing more. Exclusive distributor, agreement, term, territory and commercial
status are **derived from that project**. A stored `exclusiveDistributorId` would
be a copy of a fact the project already holds, and **D33** records what happens
next: the copy survives, the source moves, two surfaces disagree, and nothing can
say which is right.

Consequences, all read from that one pointer: only the producing winery edits the
technical data; **the winery may supply nobody but the project's primary
distributor, and no other distributor may order the product from the winery**;
the winery may not offer it elsewhere. An exception requires the agreement to be
varied or ended **and** a Bottle Lobby approval.

**The exclusivity locks the source, not the customer** (D37). What the agreement
protects is the winery's channel: one primary distributor buys this product from
the house that makes it, and nobody else does. What it never claimed to protect
is who that distributor may then sell to — that is the distributor's own trade,
bounded by the **Market Grants** agreed in the project (A17.9a). The earlier
wording read the lock one step too far down the chain and would have made a
perfectly ordinary onward sale look like a breach.

**Visible ≠ in the book.** After creation the product is visible to the winery,
the exclusive distributor and Bottle Lobby — on the distributor's side **inside
the project and in the first-order draft**, not in his portfolio. It enters the
active book on **confirmed delivery of the first commercial order**. Samples are
not commercial orders and never activate it.

> **A deliberate exception to "ordering is enough", and the reason is physical.**
> For an ordinary wine the producer holds stock, so the purchase is the moment the
> distributor can honestly promise it onward. **An own label does not exist until
> it is made** — the first order triggers production. Putting it on a restaurant's
> wine list before a bottle exists would be a promise on nothing. One rule, two
> moments: *a wine enters the book when it can honestly be promised on.*

**The three-party visibility above is a PHASE, not a permanent state — and the
two levels must not be collapsed.** It holds **until the first commercial order
is delivered**. After that the product is as visible as anything else in its
distributor's book: it has an article page, it appears in the Wine Guide, a
restaurant can find it, and it is sold. **A product nobody may see is a product
nobody can buy.**

What survives that moment is not visibility but **the action rights**, and those
are permanent: **the winery supplies only the primary distributor, and no other
distributor may order the product from the winery**; the winery may not offer it
elsewhere. A17.13 states it in exactly those terms, and A17.9a says what the
primary distributor may do downstream with what he has bought.

> **Why this is spelled out.** The paragraph above was read once as a permanent
> three-party visibility, which made the demo fixtures look like a breach: six
> wines then believed to be finished own labels sat on public article pages and in
> the public Wine Guide, and they belonged there. It is the same collapse A17.0a
> exists to prevent — *created is not carried* — one level further on. **Display
> right and action right are two different questions, and only the second one is
> forever.**
>
> **Those six turned out not to be own labels at all (D41), and that does not
> weaken this reading — it is the first case that tests it.** The active own label
> PRD-1028 has a public article page and a Wine Guide row *because* its first
> delivery is confirmed; PRD-1029 has neither, because its first order is only
> accepted. Two products, one project shape, and the boundary between them is a
> delivery rather than a setting.

### A17.9a Market Grants — what the primary distributor may do downstream

Source exclusivity (A17.9, D37) says the winery supplies only distributor A and
that no other distributor orders from the winery. It says nothing about **A's own
trade**, and A's own trade is the reason he took the project on. What governs it
is a set of **Market Grants** agreed in the project.

**A single "resale allowed" boolean and one territory string cannot carry the
real shapes** — a supermarket grant for one country, a sub-distribution grant for
one region, a named key account — and a field that cannot carry the shape gets
used for all of them until it means four things. That is D36, and this is the
pass that refuses to repeat it; the pair is recorded as superseded in **D37** so
it is not proposed a second time.

`marketGrants` are **combinable records on the project's terms**. Every dimension
is optional and they combine freely:

| Dimension | Examples |
|---|---|
| Geography | country · region or state · city · a narrower named territory |
| Channel | gastronomy · retail · supermarket · discount supermarket · e-commerce · wholesale · sub-distribution |
| Named key accounts | a specific chain, named on the grant |
| Intermediaries | which agencies or intermediaries are admitted |
| Validity | a period |
| Volume | a quantity or volume ceiling |
| Further conditions | free text on the grant, part of the agreement |

**A grant is an agreement fact, and reach is a display setting.** They are not two
views of one thing:

| | decides | who sets it | varied by |
|---|---|---|---|
| **Market Grant** | **who A may SUPPLY, where and through which channel** | the project's terms, both parties | varying the agreement (A17.9's rule) |
| **Reach** | **who SEES the product** | the primary distributor, freely | changing a setting |

**Visibility never creates an order or distribution right (MG-1).** There is no
order button without an active partnership *and* a covering grant, at any reach
level. This is the same sentence A16.14b makes about a Wine Show, and it fails
in the same way: by somebody adding a button to a card that was only ever meant
to be readable.

### A17.9b The downstream distributor or agency

A second distributor or agency **B** may end up carrying the product. What
changes and what does not:

- **B orders from A, never from the winery (MG-2).** The source stays A. An order
  line for an own-label product whose seller is the winery and whose buyer is not
  the primary distributor does not exist.
- **B does not become the primary own-label holder**, and does not become brand
  owner. The product stays an own-label product **at product level** — its
  `ownLabelProjectId` is unchanged, and so is everything derived from it.
- **B needs three things:** an active partnership with A (A6, and A8 already
  names Distributor↔Distributor portfolio supplementation as a case), a **Market
  Grant that covers him**, and a listing of his own.
- **B's listing is an ordinary listing.** It shows the sourcing via A and the
  downstream right; it carries **B's own `tradePrice` and `holderArticleNo`**,
  both of which are already per holder; and it **never appears in B's My Labels**
  (A17.12, OL-15).

**Five separate facts, and collapsing any two of them is the defect this section
exists to prevent:** brand owner · producing winery · primary distributor ·
source · distribution right.

**The A→B order is an ordinary order.** Nothing in the order model forbids a
distributor-to-distributor sale — `ORDER_ROLES` names roles, never pairings, and
`placeOrder()` refuses only an order with no line left. What is missing is
fixtures, not architecture. One exclusion is required and is a real finding:
`dealFreeGoodsFor()` exits only on `sellerType !== 'distributor'`, so on a
distributor-to-distributor line it would fire — deal free goods are a customer
incentive (A9) and have no meaning between two distributors.

### A17.10 The fee

**A centrally set fixed amount per bindingly ordered own-label bottle, paid by the
winery.**

    { feeType:'per_bottle', feePerBottle, feeCurrency,
      feePayer:'winery', feeTrigger:'accepted_order_line', feeTermsVersion }

`feeType` exists so a later percentage or tiered model needs no migration; only
`per_bottle` is offered in the interface.

**The amount is central and non-negotiable.** It is not per project, not editable
by either party, and neither the winery nor the distributor negotiates it — the
winery simply prices it into its offer. **A tariff change happens only as a new
central contract and tariff version, for contracts concluded afterwards.**
Existing fee events and contract states are never changed retroactively; there is
no path that reprices history.

> **Why "central" is written into the model rather than into a policy
> document.** A per-project fee would make the fee a term, a term is negotiated,
> and a negotiated platform fee is a different business from the one A17
> describes. The tariff version is the only place the number can move, and it
> moves forward only.

**Why the distributor does not see it.** The winery prices its offer with the fee
inside: wanting €5.00 net at a €0.25 fee, it offers €5.25. The distributor is
quoted one price and pays it, as in any trade. What he is not shown is the
winery's internal split. Enforced by **where the row lives**, not by a display
rule — the distributor's `ownLabelTerms` has no fee field. That is the difference
between a secret and an omission, and only the second survives a browser with
developer tools open.

**Trigger, decided:** the accepted order line.

| Moment | Fee |
|---|---|
| `draft`, `submitted` | none |
| **`accepted`** | **accrues** |
| cancelled before shipment | reversed |
| quantity reduced before shipment | adjusted |
| free sample | never |
| approved external transaction | accrues, unless Bottle Lobby waived it in writing |
| after shipment | corrected only by a traceable credit or fee adjustment |

**`ownLabelFeeEvents` — append-only, and the rate travels with the event.**

    { id, type, projectId, orderId, orderLineId, bottles,
      feePerBottle, feeCurrency, feeTermsVersion, at, note, invoiceId }

`type` ∈ `accrued · adjusted · reversed · waived`.

**The historically valid amount and currency are stored on every fee event as an
immutable snapshot**, beside `feeTermsVersion` — that is what `feePerBottle` and
`feeCurrency` are doing on the row above, and they are not a convenience copy.
The version alone would only name a document; the amount has to be readable from
the event itself, because that is what a ledger line means.

**The fee accrues once, at the top of the chain**, on the producing winery's
accepted order line to the primary distributor:

| Order | Fee |
|---|---|
| winery → primary distributor A | **accrues** |
| A → downstream distributor B (A17.9b) | none |
| B → restaurant or retail | none |
| A → restaurant or retail | none |

**OL-14** states this as an invariant: an own-label fee event may exist only
where the seller is the **producing winery** of the product. Anything further
down the chain is ordinary trade in a product that has already been paid for
once, and charging it again would make the fee a turnover tax on the chain rather
than a fee on production.

> **A historic fee is never recomputed from the current terms.** The rate and its
> version are written into the event at accrual and read back from there forever.
> A correction is a **new event**, never an edit of an old one, and an event that
> a fee invoice already references is closed: it can be answered by a credit
> event, not changed. This is the same discipline as a consent snapshot, applied
> to money.

**Fee invoicing.** The distributor receives an ordinary winery invoice for the
full purchase price and sees no fee. Bottle Lobby invoices the winery separately.

    document type: bottle_lobby_fee_invoice
    visible to:    the winery ✓   Bottle Lobby ✓   distributor ✗   buyers ✗

The invoice or its annex lists the underlying orders, bottle counts, rates and
corrections — which is why the ledger carries the order and line, not just a
total.

**Platform binding — two valid paths and no third.** Every own-label bottle moves
either through a platform order for the project's product, or through an exception
approved **in writing beforehand** by Bottle Lobby and documented against the
project afterwards. The distributor may not order or reorder outside the platform;
the winery may not sell, export, deliver or invoice outside it. An approved
exception remains fee-bearing unless waived in writing. Free samples are separate
and never automatically fee-bearing.

### A17.11 Vintage policy on a relabel

**Exclusivity follows the agreed wine line across vintages for the term of the
contract.** A new vintage does not need a new project or a new gate 1.

The winery enters the new vintage, supplies its technical data, informs the
distributor, offers a new sample where that is sensible, and the vintage release
is documented in the project. Where the new vintage matches the agreed line and
specification, a **simplified release inside the existing project** is enough.
Where it does not, the project returns to product development and passes gate 2
again, or takes an addendum.

**Every order names the actual vintage or batch.** The model behind that sentence
is **A15.2b** — a product is a wine line, the vintage and the batch live on the
order line, and a historic document is never re-read from the product. It is a
product-model rule that applies to every wine, not only to own labels; **A17.18**
carries the two consequences specific to this section.

---

### A17.12 Stored versus derived

**An act is stored; a state is read.**

| Fact | Stored / derived | Why |
|---|---|---|
| an application was submitted | **stored** (`submittedAt`) | an act with a date |
| a consent was given | **stored** | an act, at a moment, by a person |
| a contract was sent / returned | **stored** | acts with dates |
| Bottle Lobby approved | **stored** (`reviews`) | an act with an actor — invariant 6 |
| a fee accrued, was adjusted, reversed, waived | **stored** (`ownLabelFeeEvents`) | acts, and money must be replayable |
| **programme membership active** | **derived** from six conditions (A17.1) | a boolean beside them can disagree with all six |
| **the tab's state** | **derived** from the membership record | seven screens, no screen name in the data |
| **the public badge** | **derived** from a valid membership | nothing to clear on suspension |
| **`canStartOwnLabelProject`** | **derived** | a reading of records that already exist |
| **`project_active`** | **derived**: an approved gate-1 review exists | otherwise a project reads active after a contract is withdrawn |
| **`approved_for_first_order`** | **derived**: an approved gate-2 review exists | same |
| gate 1 is *permitted* | **derived**: both parties hold an approved project contract | a precondition is a reading, not a flag |
| **exclusive distributor of a product** | **derived** from `ownLabelProjectId` | a stored copy drifts — D33 |
| **`commercialStatus`** (ordinary / own-label exclusive) | **derived**: the product carries an `ownLabelProjectId` whose project passed gate 2 | one pointer, one reading — it says the product **is** an own label, not that anyone carries it yet |
| **`ownLabel` on a listing** — the Primary Own-Label Listing | **derived**, from **two** conditions: the first commercial delivery is confirmed (A17.9) **and** the listing holder is the project's **primary distributor** | replaces today's stored flag. Without the second condition a downstream holder's first delivery would mark his row as own label too (A17.9b) |
| **`marketGrants`** | **stored** on the project's terms | an agreement fact, varied only with the agreement (A17.9a) |
| **fee owed on an order** | **derived** from the ledger | invariant 7 |
| what changed since the first contract | **derived** from the spec history | a diff is never a field |
| technical data of a relabel | **referenced** from the source | same liquid, one record |

**Stage is stored**, deliberately, and it is the one exception worth naming.
Stages 2–4 describe where a *conversation* stands and leave no mechanical trace to
derive from. Everything a stage could be checked against — consents, contracts,
reviews, sample events, the first order — is stored separately, so a stage that
disagrees with the facts is a finding rather than an authority.

### A17.13 Visibility

| Fact | Distributor | Winery | Bottle Lobby |
|---|---|---|---|
| project, stage, spec | ✓ | ✓ | ✓ |
| shared terms | ✓ | ✓ | ✓ |
| **fee per bottle, fee events, fee invoice** | **✗** | ✓ | ✓ |
| agreed bottle price | ✓ | ✓ | ✓ |
| own consents and contracts | ✓ | ✓ | ✓ |
| the other side's contract *status* | ✓ (as *waiting for the winery*) | ✓ | ✓ |
| the other side's contract *contents* | ✗ | ✗ | ✓ |
| application content of the other side | ✗ | ✗ | ✓ |
| review notes | ✗ | ✗ | ✓ |
| an exclusive product — **orderable from the winery** | only its primary distributor | its producer | ✓ |
| an exclusive product — **visible** | per its reach (A17.13a) | its producer | ✓ |

**The prototype cannot enforce any of this.** There is no login and no server;
every array is readable from the console. These are **display rules today and
access rules in Supabase** — this table is the RLS specification and should be
read as such. The one rule that must not wait is the fee, and it is handled
structurally instead (A17.8, A17.10).

While Bottle Lobby has no role of its own, both sides show **"Waiting for Bottle
Lobby"** and approvals advance through controlled fixture actions. The `reviews`
row still names Bottle Lobby as the actor — the model does not pretend the acts
are the parties' own.

### A17.13a The reach of a live own-label product

**Decided.** The primary distributor prepares the reach **during the pipeline**,
in the own-label cockpit, per product. It takes effect when the product enters
his book — the confirmed delivery of the first commercial order (A17.9). The
levels and their rules are **the taxonomy of A16.14b, by reference**; this
section defines no levels of its own, and the generic value `network` is not one
of them (D39).

**The line that must not fall:**

| | decides | who sets it |
|---|---|---|
| **Reach** | **who SEES it** | the primary distributor, freely, changeable |
| **Agreement** | **who may ACT on it** | the project (A17.9, A17.9a), fixed for the term |

**Reach can never widen an action right.** Even at reach `public`, ordering the
product **from the winery** stays with the primary distributor, and buying it
onward follows partnerships and Market Grants (A17.9a), not visibility. A viewer
outside those rights sees a card with no order button — that is the setting doing
its job, not a limitation of it. A17.9's exclusivity is an agreement between two
parties, and a display control cannot vary it; only the agreement can, by being
varied or ended with a Bottle Lobby approval.

> **Showing an unfinished own label to selected houses is a different feature.**
> A "forthcoming" listing with a waiting list is a good idea and is **out of
> scope here** — it gets its own pass. Folding it into this setting is exactly
> the overloading pattern D36 records: one control quietly acquiring a second
> meaning because the second meaning had nowhere else to go.

### A17.14 Fixtures and migration

The existing `ownLabel:true` on **PRD-1020**, **PRD-1021**, **PRD-1022** does not
become derived — **it becomes nothing, because there was nothing to derive.**
Those wines, and the three the `legacyOwnLabel` bridge later backfilled beside
them (PRD-1023, PRD-1024, PRD-1025), are **producer-branded wines with a
distribution exclusivity**, which A17.0b's last paragraph puts outside this
section. The flag is removed in the pass that gives Hawesko its **first real
own-label projects**, and those projects name **new products** — not these six.
D41 carries the measurement and the reasoning.

What the six become, per wine: five stay ordinary wines and keep every ability
A17.0 lists; **PRD-1020** additionally serves as the `sourceWineId` of a relabel
project, which is exactly A17.0b's own example; **PRD-1022** and **PRD-1024**
carry `ownLabelAvailability:'on_request'`, the capability their own article pages
have been claiming all along. **Nothing about them is deleted** — a wine that was
never an own label loses a badge, not a record.

The hand-written "My Labels" panel — `dlabels-list`, six typed rows against three
flagged wines, no script writing into it — is rendered from data in the same pass,
and it renders **projects**, not listings: a project before its first delivery has
no listing to render (A17.9) and is the one thing the panel most needs to show.

The demo shows the whole arc: a distributor application in flight · a winery
contract under review · an admitted distributor · an admitted winery with no
project · a project in negotiation · one in product or design work · a sample
shipped · a sample approved with gate 2 open · a first order outstanding · one
active own label.

**Every project needs a programme membership dated before it.** A project whose
companies were admitted afterwards is a contradiction the fixtures must not carry.

Own-label availability is **spread across several producers** — the three rows
originally carrying it were all Cantina Rossi, which would make every early-stage
project come from one house. It now sits on **7 wines across 4 producers**, and
the four projects name **four different producers** (Henri Dubois Domaine, Cantina
Rossi, Bodegas Ruiz, Domaine Lefèvre), so no house owns the feature. Ordinary
wines stay clearly in the majority (A17.0).

**The source of the availability values, because a capability is a claim too.**
Three come from the producer's own catalogue, where `note:'Own-Label Available'`
already stood (PRD-1002, PRD-1003, PRD-1005 — the note is replaced by the field,
not supplemented). One comes from its own article page, which reads *Own-Label
Available* where every surface around it read *Own-Label* (PRD-1022). Two are
**required by A17.4 and are therefore not choices at all**: a relabel project may
only be opened on a wine that is open to requests, so PRD-1020 (OLP-101) and
PRD-1013 (OLP-104) must be — and PRD-1020 is A17.0b's own worked example. The
seventh is **Serge's decision, and it is the nearest true reading of a screen**
rather than a measurement: PRD-1024 carried the bridge's only `'pending'` value,
and a pending project was never a claim that a finished own label existed — *open
to requests* is what that row has been trying to say for months. The winery
dashboard's five typed badges are **not** a source; they are derived from this
field in the same pass, and two of them (PRD-1001, PRD-1004) disappear because no
producer record ever said so.

**No contradictory orders, no invented history.** The build measures before
placing anything; nothing here is a licence to create an order.

**The downstream chain needs fixtures, not architecture.** A17.9b describes a
route the model already permits and the demo has never shown: a
Distributor↔Distributor partnership row, a listing held by the second
distributor with its **own** `tradePrice` (the key is `(holder, productId)`, so
this needs no schema change), and the A→B order itself. The one code change that
belongs with it is the `dealFreeGoodsFor()` exclusion for
distributor-to-distributor lines (A17.9a). `promoDueFor()` needs nothing: a
`buyerType` of `distributor` reaches no progress table and is already silently
correct.

**Known demo contradictions, recorded rather than quietly fixed.** They were
listed so that nobody measures them a third time, and the fixture pass closed most
of them. Closed: My Labels and My Wine Portfolio showing different counts · the
Riesling's contradictory own-label status · the distributor appearing able to set
an own-label checkbox · the Wine Guide, the six article pages and the winery
dashboard each naming a different one of A17.0a's four levels *Own-Label*. Still
open, and deliberately: **"Start a New Own-Label" starts no real project** and
**programme admission is absent from the interface entirely** — the records exist
and are read, but no screen writes them, because the Bottle Lobby operations role
does not exist yet (A17.13). **There is no freely editable own-label checkbox in
this model** (A17.12) — the one on screen is a mockup artefact, and it is disabled
until the panel it sits on is rebuilt.

### A17.15 Invariants

- **OL-1 — every own-label bottle has a path.** Platform order for the project, or
  a documented exception with a prior written approval. Samples excluded and never
  fee-bearing. Nothing else is valid.
- **OL-2 — the fee is not on the distributor's side.** No structure his dashboard
  reads contains `feePerBottle`, no fee event or fee invoice is reachable from his
  role, and no rendered distributor surface shows the number.
- **OL-3 — a consent is immutable.** Never edited or deleted; changing a terms text
  never alters an existing `textSnapshot`.
- **OL-4 — three different acts.** Consent, signed contract and Bottle Lobby
  approval are three records at every level. None implies or advances another.
- **OL-5 — an order for an own-label product names its project.**
- **OL-6 — no derived state is stored.** Not membership, not the tab state, not the
  badge, not `project_active`, not `approved_for_first_order`, not `ownLabel`, not
  a fee total.
- **OL-7 — no other distributor can reach an exclusive product.** Measured over
  every product control in all four roles, the way `wine-identity.js` measures
  them.
- **OL-8 — a product record is created by its producer.** No path in another role
  writes a product row.
- **OL-9 — lineage is never invented.** `bespoke_new_wine` implies
  `sourceWineId === null`, and `developmentReferenceWineId` never feeds a technical
  field on any surface.
- **OL-10 — the demo keeps ordinary wine in the majority.** A fixture invariant
  (A17.0), silent about production.
- **OL-11 — no project without two active memberships.** No project record exists
  whose distributor or winery was not admitted at the time it was created.
- **OL-12 — a fee event is never rewritten.** Corrections are new events; an event
  referenced by a fee invoice is closed. A historic rate is read from its event,
  never recomputed from current terms.
- **OL-13 — programme text is not restated in a project text.** No clause sentence
  appears in both, and a project consent references the programme terms version
  the company accepted.
- **OL-14 — a fee event exists only where the seller is the producing winery of
  the product** (A17.10), and it carries its amount and currency as a snapshot.
  No fee accrues anywhere further down the chain.
- **OL-15 — `ownLabel` on a listing derives from two conditions and no others:**
  the first commercial delivery is confirmed **and** the holder is the project's
  primary distributor. No legacy field feeds a fee or a right; the
  `legacyOwnLabel` / `listingOwnLabelStatus()` bridge is removed with this pass
  rather than extended toward the new rule.
- **MG-1 — visibility never yields an order or distribution right.** No order
  button without an active partnership **and** a covering Market Grant, at any
  reach level (A17.9a, A17.13a).
- **MG-2 — no own-label order line whose seller is the winery and whose buyer is
  not the primary distributor** (A17.9b).

> **OL-14 and OL-15 arrived as "OL-5" and "OL-6" in the consolidation draft,
> where those numbers were free.** They are not free here — OL-5 and OL-6 have
> named other rules since A17 was written, and renumbering nine invariants to
> make room would break every reference to them. The rules are the approved ones;
> only the identifiers are new. Noted so the draft and the spec can be read
> against each other.

**Harness homes:** `tests/listings.js` gains OL-15 (it already enforces that the
`legacyOwnLabel` bridge is not extended); a new `tests/own-label-grants.js`
carries MG-1, MG-2 and OL-14; `tests/supply-chain.js` gains the
distributor-to-distributor case — partnership present, so the order is green, and
deal free goods absent from the line.

### A17.16 Tests — `tests/own-label.js`

Each section with the counter-check that makes it worth running:

1. **Membership is read, not stored.** No boolean field anywhere; remove a consent
   or expire a validity and the company must stop reading as admitted.
2. **The tab's seven states** each derive from the record. Mutation: store a screen
   name — red.
3. **`canStartOwnLabelProject`** refuses each of its four conditions separately and
   **creates no record** when it does.
4. **Stage agrees with acts.** Move a stage past a gate with no review — red.
5. **Three acts, never inferred.** Remove a consent and leave the contract; remove
   the review and leave both contracts. Both must stop the project reading active.
6. **The fee is on one side only.** Scan the distributor's structures and rendered
   surfaces. Mutation: put `feePerBottle` on his terms row — red.
7. **Consents immutable.** Change a terms text; every snapshot byte-identical.
8. **Fee ledger replay.** Recompute every project's fee from its events and match
   the invoices. Mutation: edit an accrued event in place — red.
9. **OL-1, the path.** Every own-label order line belongs to a project; bottle
   counts reconcile to orders plus approved exceptions. Zero references is a
   failure.
10. **Exclusivity in the pickers.** Drive every product control in all four roles.
    Mutation: point the project at another distributor — the wine must move, both
    directions red when it does not.
11. **Lineage.** Every bespoke row has a null source; no rendered technical value
    traces to `developmentReferenceWineId`.
12. **The mix.** Print ordinary against own-label counts on the green line so a
    drift is visible before it is a problem.

The harvest is **discovered, not listed**, the green line names its reach, and zero
found is a broken check rather than a clean result.

### A17.17 Build order

1. **`listings`** — the foundation. A project hangs off a (holder, product)
   relation. **One question must be settled first: A17.18.**
2. **Programme: application, consent, framework contract, admission** — the
   membership record, the information page, the seven tab states, the badge.
3. **Project: consents, project agreement, Gate 1** — the modals, the review.
4. **Negotiation, design, sample, Gate 2** — the spec history, the second review.
5. **Product creation, first order, portfolio activation** — and `ownLabel` derived
   at last.
6. **The fee ledger and the fee invoice.**
7. **The Bottle Lobby operations role** — a fifth role that writes `reviews` and
   changes nothing else.

### A17.18 The vintage question — decided

**A product is a wine line (A15.2b).** Exclusivity follows the agreed line across
vintages for the term; every order line stores the vintage and batch it actually
carries, and historic documents read only from that. The full decision, including
what is frozen when an order is accepted and why offers and deals attach to the
line, lives in **A15.2b** — it is a product-model rule, not an own-label one, and
own label is only where the contradiction first became visible.

Two consequences inside this section:

- **A new vintage needs no new gate 1.** The winery releases it, supplies the
  technical data, informs the distributor, offers a sample where that is sensible,
  and the release is documented in the project. Within the agreed specification a
  **simplified vintage release inside the existing project** is enough; outside it,
  the project returns to product development and takes gate 2 or an addendum
  (A17.11).
- **Both routes carry it.** A relabel references the producer's existing line and
  its orders name the vintage of that line. A bespoke own label **is its own line**
  and may itself run several vintages or production batches during the term.

---

# PART B — PROTOTYPE CONVENTIONS

> These are the rules that keep the static mockup consistent. Every one exists because something broke.

## B1. Canonical Header Nav

Applies to **all public pages**, no exceptions.

| Property | Value |
|---|---|
| `nav-logo` font-size | `1.35rem` |
| `nav-logo` font | Cormorant Garamond, weight 300, letter-spacing `0.18em` |
| `nav-links` gap | `1.5rem` |
| `nav-links a` font-size | `0.66rem`, letter-spacing `0.07em` |
| `nav` padding | `1.4rem 3rem` |
| `nav` background | `backdrop-filter: blur(4px)` |

**Must always include the FULL 11-item menu:**
Market · The Lobby · Why Lobbying · How it Works · Wine Guide · Wine Shows · Own Label · The App · About · Membership · Partners

**Plus** a "Send Message" button (`btn btn-gold`) next to the "← Wine Guide" button (`btn btn-outline`) on the right.

❌ Never a stripped-down header with just logo and one small button.
❌ Never the `0.75rem` / `2.5rem`-gap variant or the `1.1rem` logo variant.

> **What went wrong:** Two later-added distributor profiles (`aktiv-getraenke`, `hamberger`) shipped with an old incomplete header and it went unnoticed. Also: the restaurant/retail base template was cloned from a toggle-nav header that never defined `.nav-links` / `.btn` CSS, making the nav render as an unstyled bullet list.
>
> **Discipline:** Always diff a new/edited page's header against an already-correct one (e.g. `bottle-lobby-distributor-enoteca-milano-import-srl.html`) before considering it done.

---

## B2. Canonical Footer + Floating CTA

Reference implementation: `bottle-lobby.html`.

Applies to all genuinely public-facing pages AND the 4 stakeholder self-service pages. **NOT** used on `bottle-lobby-dashboard.html` or `index.html` (internal/login screens).

**Structure:**
```html
<footer>
  <div class="footer-top">
    <div class="footer-brand">
      <!-- logo + "© 2026 Caracter Media GmbH"
           + "Where great wines find their market." + mission line -->
    </div>
    <div class="footer-divider"></div>
    <div class="footer-sitemap">
      <!-- exactly 4 .footer-col blocks -->
    </div>
  </div>
</footer>
```

Plus a separate fixed-position `.floating-cta` pill (Member Login + Join Now, dark rounded background, `backdrop-filter` blur, bottom-right).

**The 4 footer columns:**

| Platform | Company | Account | Contact |
|---|---|---|---|
| Wine Guide | Market | Dashboard | Contact Us |
| Wine Shows | The Lobby | Public Profile | Partners |
| Own Label | About | Apply | Imprint |
| The App | Why Join | | |

> **What went wrong:** Both the header pass and the footer pass only ADDED new CSS without removing OLDER conflicting rules already in the file (an older grid-based footer, a "footer-strip" mini-footer). Since the CSS cascade only overrides properties a later rule explicitly re-declares, a leftover `display:grid` on `footer` silently broke the layout — even though the new markup was present and passed automated checks.
>
> **Discipline:** Search the whole file for **every** pre-existing `footer` / `.footer-*` selector, **including inside `@media` blocks**, and remove them. Don't just append. Then diff the rendered result against `bottle-lobby.html`.

---

## B3. Profile Page Templates

**Winery template:** `bottle-lobby-winery-cantina-rossi.html`
- `profile-hero` with vineyard/city background text
- `profile-tabs`: About / Wines / Reviews / Wine Shows
- `facts-grid`
- `wines-grid` with `wine-card`s linking to real wine detail pages
- Sidebar widgets: Profile Stats · Press & Recognition · Media Gallery · Profile Completion · Contact · Target Distribution

**Distributor template:** `bottle-lobby-distributor-hawesko-gmbh.html`
- Same structure
- Tabs: About / Wines / Winery Partners / Reviews / Wine Shows
- Distribution Regions sidebar widget

❌ Never use a simpler or older template for new pages.

---

## B4. Hero Actions — button order and colouring

Applies to **all** public profile pages (all 4 roles) and all 4 tabs of the Profile Demo Page.

| # | Button | Style |
|---|---|---|
| 1 | **Request Partnership** | Solid gold (`btn-gold` / `btn-sm btn-gold`) — always leftmost/primary |
| 2 | Role-specific action | `.btn-gold-outline` (transparent bg, 1px solid gold border, gold text) |
| 3 | Send Inquiry | Plain `btn-outline` |
| 4 | 🔖 Save & Follow | Plain outline + `.follow-btn` — **always last** |

**Role-specific second action:**
- Winery → "Request Tasting"
- Distributor → "Become a Customer"
- Restaurant → "Discuss Wine List"
- Retail → "Discuss Wine Selection"

❌ Never place Save & Follow anywhere but last.
❌ Never give the role-specific button the same solid-gold treatment as Request Partnership.

---

## B5. Sidebar Widget Positioning

Any new sidebar info widget/box (Press & Recognition, Own-Label Wines, Media Gallery, etc.) goes **directly above** the "Profile Completion" box, in views where that box appears.

**Profile Completion visibility:**

| Page | Shown? |
|---|---|
| `bottle-lobby-{role}-profile.html` (owner-facing, all 4 roles) | ✅ Yes |
| …including their "Public Profile" preview toggle | ✅ Yes (only the owner ever sees it) |
| `bottle-lobby-winery-{slug}.html` / `-distributor-{slug}.html` etc. | ❌ No |
| All 4 tabs of `bottle-lobby-profile-demo.html` | ❌ No |

On external-facing pages it is replaced entirely by the Media Gallery box.

---

## B6. Navigation & Back-Button Conventions

| Page type | Back button | Target |
|---|---|---|
| Winery profile | `← Wine Guide` | `bottle-lobby-wine-guide.html#wineries` |
| Distributor profile | `← Wine Guide` | `bottle-lobby-wine-guide.html#distributors` |
| Wine article/detail | `← Wine Guide` | `bottle-lobby-wine-guide.html#wines` |

❌ Never `← [Winery/Distributor Name]` on a wine article page.

---

## B7. Wine Article Page Conventions

### Breadcrumb
Always exactly four parts:

```
Country / Region / Winery (linked) / Wine Name (current, unlinked)
```

Example: `Italy / Sicily / Cantina Rossi / Costa Bianca`

- Country and Region are **plain text** (no hub pages for these).
- Both pulled from the **same** `wineData.attributes` Country/Region master-data fields shown in that wine's own Wine Details table — never re-typed, never a different value.
- The winery link points to `bottle-lobby-winery-{slug}.html` — **never** a distributor or grape variety hub.

> Older pages inconsistently showed "Distributor / Grape Variety / Wine Name" or "Winery / Grape Variety / Wine Name". Fixed — don't reintroduce.

### Grape Variety links
Point to the **Wine Guide's filtered view**, not the static variety hub page:

```
bottle-lobby-wine-guide.html?grape=<url-encoded grape name>#wines
```

- The Wine Guide reads the `grape` query param on load (separate from the `#wines`/`#wineries`/`#distributors` tab hash) and pre-selects that value in the Grape Variety facet — same AND-logic facet as the sidebar checkboxes.
- **For blends, each grape gets its OWN separate link with its own query param.** e.g. Baglio Rosso's "Nero d'Avola, Cabernet Sauvignon" renders as two independent links.
- URL-encode properly: spaces → `%20`, apostrophes → `%27`.

⚠️ **Do NOT carry the backslash from the JS string escape** (`d\'Avola` in source) into the encoded value. The param must decode to the clean name `Nero d'Avola` with no backslash, or the filter won't match.

### Buttons
- **"View Distributors"** (not "View at [Name]") — opens a popup modal listing all distributors carrying that wine, grouped by Country → State/Bundesland, sorted by City, each row linking to the real distributor profile page.
- **"View Winery"** (not "View Full Portfolio").

A wine's `distributor` field in `bottle-lobby-wine-guide.html` is **always an array** (multiple distributors per wine). Distributor objects need `country` / `state` / `hq` (city) fields for this grouping.

---

## B8. Dashboard Sidebar (all four roles)

**All four dashboards share one sidebar structure.** The distributor is the reference implementation and is specified in full below; Winery, Restaurant and Retail follow the same section order and the same sub-page mechanics, and simply omit the sections they have nothing for — the order of the remaining ones never changes:

`Overview → Commerce → My Portfolio → Network → Community → [role-specific] → Events / Tools → Account`

> **Two sections were renamed, and the pair has to be read together (D39).**
> **Network** is what used to be called *My Partners* — the business relations.
> **Community** is what used to be called *Network* — the follow side. The words
> did not shift by one; they swapped meanings, which is why the rename is one
> commit across all four roles and this spec table, and never two.
>
> ⏳ **The prototype rename is its own pass**, and it renames **by map position
> and by id, never by string.** The string `network` names two different things
> in the dashboard code: the *section key* `network` — the partnerships list, a
> member of the group `partners`, with nav ids `wnav-` / `dnav-` / `rnav-` /
> `tnav-network` — and the *group key* `'network'`, which is Matchmaking · Stars
> · Fans. A find-and-replace would rename the wrong one, silently. The
> acceptance for that pass greps for the absence of cross-hits.

### The distributor sidebar

The distributor sidebar is split into **eight labelled nav-sections** in this order. This mirrors the live `#sidebar-distributor` markup in `bottle-lobby-dashboard.html` — the source of truth:

**1. Overview** — Dashboard · My Profile · Messages
**2. Commerce** — My Sales · My Purchases · Order History → all three open the **Orders sub-view** (A14.8) via `showDistributorOrders('incoming'|'outgoing'|'history')`, never a profile section
**3. My Portfolio** — My Wine Portfolio · My Labels · My Promo Materials · My Offers · My Deals
**4. Network** — My Partnerships (→ `dsection-active-partnerships`, grouped by region) · My Requests (→ `dsection-requests`)
**5. Community** — Matchmaking · My Opportunities · My Stars · My Fans
**6. Intelligence** — Trend Analytics · Portfolio Gaps · Market Reports
**7. Events** — Wine Shows · **My Events**
**8. Account** — Settings

> **"Client Events" is gone and nothing migrated with it.** The item was a dead
> `<div>` — no id, no handler, no entry in `D_SECTION_EL` / `D_NAV_EL` /
> `D_TITLES` / `D_GROUPS`, no container and no renderer. It is **replaced** by
> **My Events** (A16.8), which is the name Retail already used, so the same
> feature carries the same name in every role — the D20 direction of travel.

> **Commerce** is the renamed, promoted former "Orders" section: it now sits directly below Overview (previously fourth), and its two order-list items were renamed — **Incoming Orders → My Sales**, **My Orders → My Purchases** (Order History unchanged). Routing into the Orders sub-view (A14.8) is unchanged. See Appendix D (D16). Promo Materials, Offers and Deals no longer form a standalone "Promotion" section; they now sit under **My Portfolio** next to Wine Portfolio and Labels (D17).

Within **My Requests**, a single "Requests" heading holds both directions stacked vertically:
1. **Incoming Requests** first (`stf-incoming` filter pills, `ir-list`)
2. **Outgoing Requests** below (`stf-requests` filter pills, `pn-request-list`, plus the "How a partnership is formed" info box)

Both sub-groups use the `.wn-group-title` gold-caps label style rather than their own full `profile-section-title`, so they read as one section.

### The "My ___" naming convention

**It applies in every role**, not just the distributor, and to any new nav item added anywhere. Rename **both** the nav label AND the corresponding `profile-section-title` / topbar-title together (including the role's `*_TITLES` map).

**It applies to nav items that address the role's *own* holdings.** Instruments that belong to somebody else stay unprefixed: the Exclusive Offers, Exclusive Deals and Promo Materials a Restaurant or Retailer sees are the *distributor's*, published to them (A2, A9) — calling them "My Offers" there would assert an ownership the model places elsewhere. The distributor sidebar already observes this distinction: Matchmaking, Trend Analytics, Wine Shows and Settings carry no "My" either.

The one deliberate near-collision: the Restaurant's **My Wine List** and the Retailer's **My Wine Selection**. The *list* is theirs; the wines on it are not — they are references into a distributor's portfolio (A3, invariant 2). The noun carries that distinction, which is why neither is called "My Wines".

### Nav items are sub-pages, not scroll targets

Since the sidebar rebuild, every profile nav item opens its **own discrete sub-page**; there is no long scrolling profile page anywhere. `showDistributorView(view, section)` swaps the profile view in, hides the Dashboard and Orders views, then shows exactly the one section matching `section` and hides all others (`D_SECTION_EL` map), and scrolls to top (D18). `showWineryView` / `showRestaurantView` / `showRetailView` are the same function over the role's own maps (D21).

**Grouped sub-views render a tab bar; single-member ones don't.** Each role has its own `*_GROUPS` array. `D_GROUPS` defines the distributor's three grouped views — **My Portfolio** (Wine Portfolio · Labels · Promo Materials · Offers · Deals), **Network** (Partnerships · Requests) and **Community** (Opportunities · Stars · Fans). When the active section belongs to a group (`dGroupOf()`), a tab strip renders above the content in `#dprofile-tabs` using the **same `.ord-tab` styling as the Commerce (Orders) view**, with the current member marked active. Single-member sections (My Profile) render no tab bar. Matchmaking is not a group member — it is a non-functional demo nav item (A8), not a real section.

**"Preview Public Profile" appears on the My-Profile sub-page only** (`section === 'basics'`): the role's `*-topbar-actions-profile` group is shown there and hidden on every other sub-page. This holds for all four roles.

**Prototype blueprint:** `showDistributorView()`, the `D_SECTION_EL` / `D_NAV_EL` / `D_TITLES` maps, `D_GROUPS` + `dGroupOf()`, `#dprofile-tabs`, `openDistributorPublicPreview()` — all in `bottle-lobby-dashboard.html`. The other three roles carry the identical set under their own prefix: `W_*` / `#wprofile-tabs`, `R_*` / `#rprofile-tabs`, `T_*` / `#tprofile-tabs`, each with a `wGroupOf` / `rGroupOf` / `tGroupOf` lookup.

**Real build:** one route per section, with the group as the parent route segment — `/dashboard/portfolio/wines`, `/dashboard/partners/requests`. The tab bar is the group's layout; the sections are its children.

### The Winery sidebar

| # | Section | Nav items |
|---|---|---|
| 1 | Overview | Dashboard · My Profile · Messages |
| 2 | Commerce | My Sales · Order History |
| 3 | My Portfolio | My Wine Portfolio · My Press & Recognition |
| 4 | Network | My Distributors · My Requests |
| 5 | Community | Matchmaking · My Stars · My Fans |
| 6 | Market | Trend Reports · Consumer Data |
| 7 | Events | Wine Shows · **My Events** |
| 8 | Account | Settings |

**No "My Purchases"** — in this model a winery buys nothing on the platform (A3), so Commerce has two items, not three. **No Promo Materials / Offers / Deals** — those are distributor instruments aimed at restaurants and retailers (A9), not producer content. Branding & PR and Import Support keep their own **Services** section between Events and Account.

### The Restaurant sidebar

| # | Section | Nav items |
|---|---|---|
| 1 | Overview | Dashboard · My Profile · Messages |
| 2 | Commerce | My Purchases · Order History |
| 3 | My Portfolio | My Wine List |
| 4 | Network | My Distributors · My Requests |
| 5 | Community | Matchmaking · My Stars · My Fans |
| 6 | Discover | Browse Wines · Exclusive Offers · Exclusive Deals · Promo Materials |
| 7 | Events | Wine Shows · **My Events** |
| 8 | Tools | Wine List Builder · Food Pairing |
| 9 | Account | Settings |

**No "My Sales"** — a restaurant sells to guests, not on the platform. My Portfolio holds a single item and therefore renders no tab bar. **The Events section is new**: a restaurant hosts winemaker dinners and themed evenings, which is A16.8's own example, and it was the only role with nowhere to put them.

### The Retail sidebar

Identical to Restaurant, with two differences: **My Wine Selection** instead of My Wine List, and **no Tools section** — so Events sits at position 7 and Account at 8.

> **"My Events" and "Wine Shows" are different things and must stay separate nav items.** Wine Shows are trade fairs; My Events are the role's own occasions — an in-store tasting, a winemaker dinner, an oenologist evening, a distributor's house fair. **A16 is the section this docks into** — A16.1 for the show, A16.8 for the event — and it keeps them apart for the reason that governs everything else about the pair: a Wine Show is released by Bottle Lobby staff and carries the platform's guarantee; a member event never is and never does.

> **All four roles now carry Events → Wine Shows · My Events** (A16.8). One event model, four navigations — the correction of an asymmetry that was accidental rather than decided: Retail had My Events, the distributor had a dead "Client Events", and Winery and Restaurant had nowhere at all.

**NAV-1 — the visible sidebar group labels per role match the tables above.** No harness checks them today, which is why the rename can go wrong without anything turning red; the rename pass closes that gap (`tests/sidebar-routing.js`).

---

## B9. CSS — Two Naming Conventions (known hazard)

The project has two CSS naming conventions due to iterative history. **Mixing them causes silent layout bugs.**

| Older files (winery/distributor profiles) | Newer files (restaurant/retail profiles) |
|---|---|
| `.profile-hero` | `.hero-content` |
| `.profile-avatar-large` | `.hero-avatar` |
| `.profile-badge` | `.badge` |
| `.wine-card` | `.wine-row` |
| `.sidebar-widget` | `.widget` |
| `.dist-region` | `.partner-card` |

**Always run an automated Python class-definition cross-check before delivery.**

---

## B10. Div Nesting — count balance is NOT proof

⚠️ **A div open/close COUNT match across a whole file does not prove correct nesting.**

**The bug found (now fixed):** Several winery profile pages had:
```html
<div class="wines-grid"><div class="wine-card" ...>
  ...
</div></div>
```
The closing pair closed **both** the wine-card AND the wines-grid after only the first card. With exactly one wine-card this is invisible — div counts still balance perfectly. But once more wine-cards are added as siblings, they land structurally **outside** `.wines-grid` and lose its flex layout, border and background grouping.

**Canonical correct structure** (reference: `bottle-lobby-winery-cantina-rossi.html`):
```html
<div class="wines-grid">
  <div class="wine-card">...</div>
  <div class="wine-card">...</div>
</div>
```
`.wines-grid` stands alone on its own line; each `.wine-card` is a clean sibling; `.wines-grid` only closes after the LAST card.

**Discipline:** When adding wine-cards to any profile page, explicitly verify this nesting — not just a div-balance count. Diff the opening/closing pattern against Cantina Rossi.

---

## B11. Naming

- The multi-tab demo page is always called **"Profil Demo Seite" / "Profile Demo Page"** in conversation, filename always `bottle-lobby-profile-demo.html`.
- Company is always **Caracter Media GmbH**.

---

## B12. An action never fails silently

Every function reachable from a button ends in one of two ways: it does
something and says so with a `showToast()`, or it does nothing and says
**why**. A bare `return` in an action path is forbidden.

```js
if (!me) return;                                   // ❌
if (!me) { showToast('✗ …'); return; }             // ✅
```

> **Why:** a guard that is unreachable through the UI today is reachable
> from the console, from a test harness, and from the next pass that adds a
> second entry point. When it fires silently the click looks like it worked,
> and the time goes into looking for a rendering bug that is not there —
> which is exactly how two sessions were spent before this rule existed.
> The cost of the alternative is one line.

**Applies to actions, not to renderers.** A render function that returns
early because its container is not on screen is correct and silent by
design (`paintAppearanceWidget`, `hideShowsView`). The distinction is
whether a person just clicked something.

---

# PART C — WORKING METHOD

> **Changed 30 July 2026:** the ZIP-based handoff was replaced by a live GitHub → Netlify pipeline. The rules below supersede the previous "full ZIP after every session" method.

## C1. The pipeline

```
Claude pushes to GitHub  →  Netlify deploys automatically  →  live in ~7 s
```

| | |
|---|---|
| Repo | `caracterwines/bottlelobby` · branch `main` |
| Netlify project | `bottlelobby` |
| Live | https://bottlelobby.netlify.app |
| Build command | none (static site, publish directory = repo root) |

**The repo is the single source of truth for code.** No document describes what the HTML contains — read the repo.

**Claude must never assume it still has write access.** The GitHub MCP connector requires the `Claude Github MCP Connector` GitHub App to be *installed* on the account (not merely authorised) with `Contents: Read and write` for this repo. Authorising ≠ installing — see C5.

## C2. Where knowledge lives

Four places, each with exactly one job — the full table is **Appendix E**, which is the authoritative version. In short:

**1. `BOTTLE-LOBBY-SPEC.md` — in the repo, and mirrored into project knowledge.**
This file. Only permanent rules. On change: the complete new version is pushed to the repo *and* delivered for the project knowledge, where it **replaces** the old copy — never appended, never two copies side by side. Git keeps every previous version, so replacing destroys nothing.

**2. `CLAUDE.md` — repo root.**
Short, under ~100 lines. The hard invariants plus the instruction to read this spec before designing schema or features. Claude Code loads it automatically at session start and re-reads it after context compaction.

**3. `HANDOFF.md` — repo root, NOT in project knowledge.**
Deliberately short. Git already records file lists, counts and what changed — Claude reads that from the repo directly. `HANDOFF.md` holds only what Git cannot know: open items, next steps, decisions in progress and their reasoning.

**4. Claude's chat memory — pointers only.**
Hard cap of 30 entries, so entries silently fall out. Anything durable belongs in this file, not there.

Serge no longer uploads anything at the start of a new chat. Claude reads the repo itself.

## C3. Delivery rhythm

**Default:** Claude edits the file(s) and pushes directly. Netlify deploys. Serge checks the live URL.

- Work iteratively with **artifact previews** for visual problems before pushing.
- Update `HANDOFF.md` in the same push whenever open items or next steps change.
- Use **Python scripts** for systematic multi-file changes, then push the result.
- Run div/tag balance checks AND nesting verification after every structural edit.
- Run `node --check` on the extracted script block of any file with substantial JavaScript, and a DOM-stub harness for logic that matters.
- Run the CSS class cross-check before pushing.
- Commit messages: short, in English, conventional-commit style (`fix:`, `feat:`, `chore:`).

### Push each commit of a multi-part pass as it lands, never in a batch

A pass that produces several commits pushes each one **when it is finished**,
not all of them at the end. The reason is not tidiness: **it is the only way the
reviewer sees a commit on its own.** Batched, the first commit is checked
through the lens of the last, and a defect it introduced reads as an artefact of
whatever came after it.

Measured cost: in the stakeholder pass the `TypeError` from commit 1 —
`saveShow()` still reading `region` off a partnership row — survived
undiscovered because nothing was pushed until the pass was complete. A single
push after commit 1 would have put it in front of a browser with nothing else
in the diff to explain it.

This also gives every commit its own deploy, which is what makes "reproduced
against the pushed version" a sentence anyone can check.

### ⚠️ Two push channels — and which constraint applies to which

**From Claude Code: `git push`. No size limit, no special handling.** A local clone exists, `gh auth login` is set up, and a commit carries only the diff. `bottle-lobby-dashboard.html` is pushed this way like any other file. This is the default route for all substantial work.

**From Claude in chat: the GitHub MCP connector — and it has no patch or diff operation.** `create_or_update_file` and `push_files` always replace the **entire file**, and that content must pass through Claude's output. Cost therefore scales with file size, not with the size of the change. Measured 31 July 2026:

| File | Size | Via the connector |
|---|---|---|
| Variety pages | ~14–20 KB | Unproblematic |
| Wine article pages | ~29–32 KB | Unproblematic |
| Public profile pages, all 4 roles | ~50–69 KB | Fine |
| `restaurant-profile.html`, `retail-profile.html` | ~102–103 KB | Expensive |
| `why-join.html`, `distributor-profile.html` | ~113 KB | Expensive |
| `winery-profile.html`, `profile-demo.html` | ~147–153 KB | Expensive — one per session at most |
| **`HANDOFF.md`** | **~102 KB** | **Expensive — and see the note below** |
| **`BOTTLE-LOBBY-SPEC.md`** | **~226 KB** | **No longer possible from chat** |
| **`bottle-lobby-dashboard.html`** | **~650 KB** | **Not possible — exceeds a single response** |

> **Re-measured 4 August 2026, and two rows changed category.** The sizes above
> are read from the GitHub API, not remembered. Two of them move a document out
> of the channel it used to travel on:
>
> - **The spec has outgrown the connector.** It was ~88 KB when this table was
>   first written and is ~226 KB now. A chat session can no longer push it —
>   the complete file would have to pass through one response. From here it goes
>   by `git push` from Claude Code, or as a single manual upload; the copy for
>   the project knowledge is delivered as a file either way, so both copies stay
>   byte-identical.
> - **`HANDOFF.md` is ~102 KB**, and its own opening rule says it holds only
>   open items, next steps and decisions in progress. A file that size is a
>   change log. Completed passes belong in the Git history, which already has
>   them; what stays is what Git cannot know.

**Fallback rule, chat sessions only:** when a chat session will make many changes to the large files above, work locally in the container and hand over the finished result — a single file, or a ZIP for multi-file work (max. 100 files per commit), which Serge uploads via GitHub's *Add file → Upload files*. This is an explicit, sanctioned exception, not a failure.

**Claude flags this proactively at the start of such a session** rather than discovering it halfway through — and states which channel it is on, since the answer differs entirely between Claude Code and chat.

> **Measured composition of the dashboard** (31 July 2026): ~186 KB markup, ~228 KB JavaScript, ~59 KB CSS. An earlier figure of ~170 / ~120 / ~43 KB was simply wrong — it did not even sum to the file size it claimed to describe. Extracting CSS and JS would leave the HTML at ~186 KB, still above what the connector handles comfortably; and with `git push` available the refactor has no motivation left at all (D15, D22). Measure before recommending a refactor.

## C4. Claude's active reminder duties

Claude proactively flags:
- **(a)** When a new permanent rule or architecture decision is made in-session that belongs in this spec → delivers the complete updated `BOTTLE-LOBBY-SPEC.md` as a file and explicitly reminds Serge to **replace** it in project knowledge (delete the old version).
- **(b)** When a session is heading toward heavy edits of the large files → proposes the local/manual-upload route up front (C3).
- **(c)** When two substantial changes would land in one handover → proposes splitting them, so a fault stays unambiguously attributable.

### The tense rule — added 4 August 2026, and it binds Serge as much as Claude

**A paragraph describing a change to DATA is written in the past tense only once
a commit contains it. Until then it says what is to be done.**

This came out of D35. The row was written in the past — *"three purchases
backfilled, three bought wines added, the selection growing 3 → 6"* — on the day
the rule was decided and before any of it happened. The data still stood exactly
as the row's own measurement described it.

**Why it is worse here than in code.** This file is the authority; it is read as
the record of what is true. A past-tense sentence about data is a claim that the
fixtures already conform, and the next pass builds on it without checking. That
is the same defect this whole product-key chain exists to remove — one fact in
two places, drifting — only in the document that is supposed to arbitrate.

The correction has a shape worth reusing: **the decision stays, the measurement
stays, and only the sentence about the repair moves into the future**, together
with the route and an explicit note that it has not been carried out. Nothing is
deleted, because the measurement is what makes the pending work checkable when
somebody finally does it.

A rule and a fixture are different claims. Write rules in the present, data in
whatever tense the commit log can support.

## C5. Connector setup (for when it breaks again)

Diagnosed 30 July 2026 after repeated `403 Resource not accessible by integration` errors:

1. The GitHub App **`claude-github-mcp-connector` must be installed**, not just authorised. Authorising grants identity + public read only. Install URL:
   `https://github.com/apps/claude-github-mcp-connector/installations/new`
   → *Only select repositories* → `bottlelobby` → Install.
   The callback may land on a `state: Field required` error page — harmless if the URL contains `setup_action=install` and an `installation_id`.
2. Verify at `https://github.com/settings/installations`: the entry must show `Read and write access to code` and list `caracterwines/bottlelobby`.
3. In Claude, add the **custom** connector `https://api.githubcopilot.com/mcp`. The built-in "GitHub-Integration" is **not** the same thing — it only attaches repo files to chats and exposes no write tools.
4. In the connector panel, a second tool group (Create or update file, Push files, Create branch …) must appear alongside the read-only tools. Set to "always allow".
5. Enable the connector for the conversation via the "+" menu.

## C6. Communication

- All development communication with Serge: **German**
- All page content: **English**
- Present honest trade-off assessments before implementing, not silent decisions.
- Ask structured clarifying questions rather than guessing when feedback is vague.
- Measure before recommending a refactor, and report the numbers even when they overturn Claude's own proposal.
- Serge's vocabulary: "Steakholder" = Stakeholder; "freigestellt/freistellen" = image background removal.

### The prompt convention

Every prompt Claude writes in chat for Serge to paste into Claude Code carries a
heading of exactly this form — bold title, `·`, italic dispatch note, one line:

**PROMPT 46 V2 (Weinbuch) — Portfolio wird ableitbar** · *jetzt senden · ersetzt V1*

- **Without exception, every prompt carries this heading.** Not only the long
  ones, not only the ones that start a pass: a measurement, a question, an
  acceptance and a one-line correction all get one. The convention is referential
  (below), and a reference only works if there is nothing to except.
- **The heading always sits outside the copy block.** What Serge pastes is the
  prompt; the heading is how the message is addressed, and pasting it into the
  terminal puts a title where an instruction belongs.
- **The number runs across the whole project, not per chat.** This is the part
  that has already gone wrong: read as "per conversation", a new chat restarts
  at 1 and one and the same pass ends up carrying two numbers. At the start of a
  new chat Claude looks up the last number used rather than guessing or
  restarting.
- **A revision keeps its number and gains a version suffix** — `V2`, `V3`. A
  superseded prompt is never renumbered. The pair `46` / `46 V2` is what makes
  "V1 was never in the terminal" a statement anybody can check.
- **A revision is always delivered as a complete copy block**, never as a diff
  and never as "in prompt 46, replace paragraph three". The whole point of the
  version suffix is that exactly one text carries that number; a patch against a
  superseded text leaves two half-prompts and no way to say which was pasted.
- **Format follows the content, and the content is never shortened to fit it.**
  A multi-part build order whose context, task, business rules, constraints,
  acceptance and verification benefit from hard separation is written as **XML**;
  a short measurement, question or acceptance is written as **Markdown**, where
  the XML overhead buys nothing.
- **A prompt references spec sections by ID rather than restating them.** The
  spec is the authority and it is in the repo; a restated rule in a prompt is a
  second copy that can disagree with it (A1, one level up from the data).
- **The dispatch note is mandatory**, never omitted: *jetzt senden* · *direkt
  nach 46, keine Antwort abwarten* · *erst wenn 46 beantwortet ist* · *als
  eigener Durchgang, nicht heute*.
- Around the prompt the actions are numbered — send, wait, bring the answer
  back — so the message reads as instructions rather than prose, and the prompt
  itself sits in one code block with nothing above it inside that block.

The purpose is referential: Serge says "schick 46" or "46 V2 ist raus" instead
of describing which prompt he means.

### When the terminal gets cleared

Claude states with every prompt whether the Claude Code session is cleared
first. Two cases, and they pull in opposite directions:

- **Clear** when a new pass begins that builds on nothing from the previous one,
  or when a prompt was superseded before it ran. A revoked instruction left
  sitting in the context window is the dangerous kind of leftover — nothing in
  the window says which of the two versions is current.
- **Do not clear** when a measurement or a partial commit is in the window that
  the next step rests on. A multi-part pass keeps its context until the last
  commit lands.

Absent a statement, no clear. And a paste never goes into a non-empty input
line: the residue of the previous line ends up at the head of the new
instruction, which is how a superseded *"mach den Schnittvorschlag"* nearly
started a pass nobody had asked for.

## C7. Tools

| Purpose | Tool |
|---|---|
| Prototype stack | Static HTML / CSS / vanilla JS |
| Future build | Next.js / Supabase (via Claude Code) |
| Version control + deploy | GitHub MCP connector → Netlify auto-deploy |
| Image generation | OpenArt (`gpt-image-2`, poll with `openart_creation_get` + `historyId`) |
| Multi-file changes | Python scripting in the container, then push |
| JS verification | `cd tests && npm test` — structural checks and DOM harnesses in one run (jsdom) |
| Test harnesses | `tests/` in the repo root |
| Browser acceptance | `node tests/serve.js` → `http://localhost:8765`. Never `python3 -m http.server` — see "Browser acceptance" below |
| Prototype persistence | `localStorage` via `assets/bottle-lobby-store.js` — demo only, see C8 |

**Harnesses live in `tests/`, never in a scratchpad.** They load the real
`bottle-lobby-dashboard.html`, run its scripts and drive the actual functions.
**A new assurance goes into that directory as part of the same change that
motivated it** — when a bug is found and fixed, the assertion that would have
caught it is committed alongside the fix. A harness written in a scratchpad is
thrown away, which is why the same checks were re-derived every session and
regressions were caught only by whoever remembered them.

Two kinds of assertion have already earned their place there and are worth
copying when a similar situation arises:

- **Contract tests over vocabulary.** When two pieces of code compare values
  from what should be one set of names, assert that the sets match — parse the
  producing function, collect what it can return, check the consumers against
  it. A mismatch of this kind is invisible to behavioural tests: both sides
  look reasonable, the comparison is simply always false.
- **Fixture-reachability tests.** Assert that the demo data actually exercises
  each branch a contract covers. A contract can hold while the fixtures only
  ever reach one side of it.

`tests/check-static.js` carries the structural half — the `node --check` step,
duplicate ids, div balance, `onclick` handlers, CSS cross-check — so the whole
of the "usual checks" is one command and nothing is re-derived by hand.

> **B10 needs a parser, not a counter.** A balanced div count does not prove
> correct nesting, and neither does a depth check: a closing pair that shuts a
> child *and* its container leaves both intact while the following siblings
> land outside. `check-static.js` therefore parses the markup and asserts that
> known children still resolve to their container via `closest()`. Add a pair
> whenever a new container carries layout its children depend on.

> **Verify a new check by breaking the file on purpose.** Copy it, introduce
> the exact fault, and confirm the check fails — `node check-static.js
> <copy>`. A check that has never failed is an assumption, not a guarantee;
> two of the checks here only became trustworthy after a mutation exposed that
> they did not fire.

> ⚠️ **A mutation has to be observable and faithful, or it certifies nothing.**
> Three ways one passes while proving the opposite of what it claims, all three
> met in a single pass (3 Aug 2026) and all three recorded at the mutation that
> hit them:
>
> 1. **Unobservable.** The fault is real and the fixtures cannot show it —
>    "compute the badge from the name" was applied where every demo house's
>    initials happen to match its badge. Move the mutation to where the fault
>    would actually be visible, or build the state that makes it visible.
> 2. **Mis-aimed.** Two renderers shared a line, `String.replace` took the
>    first, and the check read the second. Anchor a patch on text that names
>    its target, and make the builder return `null` when a patch does not
>    apply so a miss cannot read as "the check held".
> 3. **Weakened.** The most dangerous one. Reproducing part of a defect can
>    produce a milder symptom that the current code handles: restoring only
>    where a value came from, while the fix had also added a guard, turned a
>    crash into a shorter string. The file would then be certified against a
>    bug it cannot see — worse than no check, because it reads as safety.
>    Put the defect back in its **shipped shape**, line for line.

### A browser acceptance CLICKS. It does not call functions.

**Serge's rule, from his own mistake on 4 August 2026, and it is the first rule
of the section because everything below it is worthless without it.** He called
`openOrderDetail('ORD-2037')` from the console to save a few clicks. The function
expects other state; mid-rebuild it threw and left a blank page — which reads
exactly like the defect one is looking for.

**What is being accepted is what a person gets, and the way there is part of
what is being accepted.** A direct call skips the router that hides the other
views, the renderer that repaints the badge, the guard that refuses the action,
and the empty-state branch (B12) — every one of which has produced a real finding
in this repo. A pass that reaches the detail pane by calling into it has tested
the pane and nothing else.

It also removes a whole class of false alarms: a thrown call leaves the page in a
state no user can reach, and the next thing anybody looks at is wrong for a
reason that has nothing to do with the build.

The one exception is **reading**: `performance.getEntriesByType('resource')`,
counting rows, checking a global. Reading state is not driving it.

### A sweep over renderers proves nothing about inputs

**The companion rule, and it comes from a hole in a check of ours rather than
from a habit.** Pass 4 was closed with a sweep that drove **326** renderers,
views and modals and reported zero resolver warnings and zero script errors. It
was true and it was not enough: Serge found a defect by clicking, minutes later.

`addLine()` opened a native `prompt()` and handed whatever was typed to
`orderItem()`. After pass 4 a typed name resolves to null, so pressing OK did
**nothing at all** — two lines before, two lines after, the total unchanged, and
one console line as the only trace.

**A render pass drives what DRAWS. It cannot reach what RESPONDS.** A product
reference that only comes into existence when somebody types, picks or checks a
box is invisible to it by construction — and so is every guard, every toast and
every dialog on the far side of a click. Four more sites turned up in the same
sweep afterwards: the exhibitor handshake wrote *"Decline **undefined** for
Weingut Schmitt?"* into a `confirm()` while the event log beside it, rendered,
was correct.

So: **an acceptance drives the input paths one at a time** — open the modal, pick
the thing, press the button, read what came back. And a check that claims to
cover a change has to say which of the two it did.

### The write-path blind spot — a named class, not three accidents

**Three defects in three days, all on a click path, all invisible to every
renderer sweep and every assertion over fixtures.** Named here on 5 August 2026,
because the third one made it a pattern rather than a run of bad luck.

| | What was wrong | Why nothing saw it |
|---|---|---|
| **04.08** `addLine()` | did nothing at all on OK | the path exists only once somebody types |
| **05.08** `placePreparedOrder()` | built every guest order line with **no product key**, from `l.name` — a field `preparedOrderFor()` has never returned | the order list is open in the fixture, so placing it is one click past where anybody got |
| **05.08** `confirmAddWine()` ×3 | a wine pulled into any of the three books carried **no `id`** | the fixtures were seeded with keys; only a wine added *at runtime* lacked one |

**The rule: a path that only comes into existence through an INPUT is reached by
no render pass and by no assertion over fixture data.** A renderer draws what is
already there. An assertion over fixtures reads what was written by hand. Neither
of them ever runs the code that turns a click into a record — and that code is
where a reference is *created*, which is exactly where a wrong one gets in.

Two obligations follow, and they are cheap:

- **The acceptance drives the write paths**, not only the surfaces. Add the wine,
  place the order, save the line — then read back what was stored, not what was
  drawn. The three above were all found by doing this, twice by Serge and once by
  looking because the first two had been.
- **A pass that introduces or removes a field counts its WRITE paths one by one,
  not only its readers.** The listings pass widened five readers and found three
  writers that had never carried the key at all. Readers are easy to find because
  something on screen goes wrong when you miss one; a writer that omits a field
  fails silently and only in data nobody has looked at yet.

It is the same shape as the deleted-field rule further down — *a search, not an
intention* — with the search running over writers instead of over harnesses.

### Widen the reader before you move the data

**The order is the rule, and reversing it breaks things silently.** Move the
readers first so they accept both the old shape and the new one; only then move
the data; only then delete the old branch.

From the ISO conversion of the show subsystem, 3 August 2026. `showDateValue()`
read **only** the display format and answered `MAX_SAFE_INTEGER` for anything
else. An ISO date would not have thrown there — it would have sorted every show
to the end and quietly inverted "What's Coming". Data moved first, into a reader
that cannot read it, produces no error and no blank page: it produces a *wrong
order*, which nobody looks at twice.

The same order carried the product-key chain (widen `wineByRef()`, move 91
references, then delete the name branch) and the listings pass (create the row,
widen the readers, then remove the old fields). It is the reason a migration can
be checked at every step instead of only at the end.

**And the guard that comes with it: a widened reader must not name a format.**
The new check in `public-shows-page.js` rewrites every show date into the *other*
format and demands the same order — so it still holds after the migration, rather
than becoming a test of the state it was written in.

### Never hand an event-driven mechanism the event it is meant to notice

`tests/persistence.js` checked the store's round-trip by calling the action **and
dispatching the click itself**. It proved the store can serialise, and called
that "the trigger works". The trigger was in fact broken for any change with no
event after it — which is what Serge measured in the browser while the harness
was green.

**A test that supplies the signal is testing the half after the signal.** Press
the real button and then touch nothing; and include one case where no event
follows at all.

### Check the call sites before judging the body

**For dead code, "this function does X wrong" is always a statement about
nothing.** `acceptOrder()` was reported as an audit-trail hole on 2 August 2026
— it set `stage = 'accepted'` and never logged. The finding was derived from the
body without asking whether anything reached it: the function had **no call site
in the repo**, and its only caller was the harness written for the report. The
real accept path, `confirmOrder()`, had been logging correctly with an actor all
along.

The cost of skipping this is not a wasted hour, it is a repair: a fix would have
turned dead code into a **second accept path** beside the live one. Serge's
instruction was to repair it; the measurement said delete it, and deleting it was
right — *"dein Befund schlägt meinen Auftrag."*

### A test may derive a second time; only the product needs one answer

Invariant 1 governs the product, not the harness. Where a check exists to catch
"the wrong source was consulted", asking the product for the answer is
**circular** — green and wrong at the same time.

So `tests/partner-counts.js` counts `currentWinePortfolio` itself rather than
calling `portfolioCount()`; `tests/notifications.js` computes the permitted set
from `wineFollowGraph` and the partnerships rather than calling
`notifWineryEdge()`; `tests/supply-chain.js` has its `chainReader` derive the
chain instead of asking `portfolioOf()` — those helpers are exactly what the
mutations patch.

The second derivation is not duplication; it is the independent witness. What is
compared is the **rendered surface**, because that is where the drift shows.

### Native `prompt()`, `confirm()` and `alert()` are foreign bodies

A native dialog cannot be styled and cannot be translated. Its buttons come from
the operating system in the **browser's** language — *"Abbrechen"* in an
otherwise entirely English product — and nothing in it can be *selected*: text is
text, and only the input line accepts anything. That is three defects in one
control, and the third is the dangerous one, because it invites a typed string
where a key is required.

The last `prompt()` was removed on 4 August 2026 and
`tests/wine-identity.js` fails if one comes back. `confirm()` survives at
twenty destructive actions and `alert()` at three placeholders; both are
**stated here as debt**, not endorsed. Neither can put a wrong reference into the
data, which is why they are not urgent — and neither belongs in a finished
product.

### Browser acceptance: serve it with `tests/serve.js`, and read `transferSize`

    node tests/serve.js     → http://localhost:8765

**Not `python3 -m http.server`.** Python sends `Last-Modified` and no
`Cache-Control` at all, and a response carrying no freshness information may be
cached *heuristically* (RFC 9111 §4.2.2) — commonly 10% of the age since
Last-Modified — and served **without any request reaching the server**. Edit an
asset, reload inside that window, and the browser hands back the old file.

The failure has a shape worth recognising, because it cost three wrong findings
in one day and each one looked like a code regression:

- `bottle-lobby-dashboard.html` is 660 KB and leaves the heuristic window
  quickly; `assets/bottle-lobby-data.js` is 17 KB and does not. So **the page
  comes back new and its data comes back old** — a state no amount of reading
  the source can account for.
- **A query string on the page does not reach the assets.** `?v=abc` changes the
  address of the HTML; the `<script src="assets/bottle-lobby-data.js">` inside
  it is unchanged, and that is the URL the cache is keyed on.
- The symptom is a renderer that silently produces nothing, because the new
  page calls a function the old asset does not define.

`tests/serve.js` sends `no-store` on every response — deliberately stricter than
production. Local acceptance must never be the reason a finding is wrong.

**The live site does not have this problem, measured rather than assumed.**
Netlify serves every file, assets included, with:

    cache-control: public,max-age=0,must-revalidate

`max-age=0` makes a response stale immediately and `must-revalidate` forbids
serving it without asking, so a deploy is picked up on the next load and the
ETag turns the check into a 304.

### Three stations, in this order — and the third is not the first repeated

A pass is not finished because jsdom is content.

1. **Terminal.** Harnesses green, `node --check`, and **Claude Code checks its
   own work in the browser** over `tests/serve.js` as soon as a change is
   visible on screen. Not "if there is time" — a renderer that silently draws
   nothing passes every structural check there is.
2. **Repo.** The commit is really on `main`, verified through the GitHub API
   (`list_commits` / `get_file_contents`), **never** through
   `raw.githubusercontent.com` — that endpoint answers from a cache and has
   twice produced a false *"not pushed"*.
3. **Chrome, by Claude in chat, independently.** Against the live deploy, with
   `transferSize` read before any finding and `?v=<commit>` as the cache buster.

**Station 3 is not station 1 done twice.** One runs against a local server
sending `no-store`, the other against the real deploy in a real browser profile,
and the gap between them is exactly where the finding of 3 August lived: a
restored `localStorage` snapshot that was invisible in the source and invisible
in the local run, and that beat the fresh fixtures.

When the extension cannot get its script into the 660 KB dashboard page — it
happens — the sentence is **"only checked the source, did not see the
surface"**, said out loud rather than quietly omitted. Station 1 then carries
the acceptance, and both sides know which one did.

### The asset stamps

    node tests/stamp-assets.js          → rewrite the stamps
    node tests/stamp-assets.js --check  → report only

Every asset reference carries `?v=<8 hex>` — the first eight characters of a
**SHA-256 over the file's content**. Content, never the commit hash: a commit
hash changes on every commit, so every visitor would re-fetch every asset after
every push even when nothing in them moved. A content hash changes exactly when
the file changes, which is the only moment a cache should be invalidated.

They are **defence in depth, not the primary fix** — Netlify's headers above
already force revalidation. What the stamps add is independence from any cache
between the file and the reader: a proxy, a browser being generous, a local
server configured differently, a copy opened from disk. The URL itself changes,
so a stale copy cannot be the right answer to it.

The hash is generated, never typed. Nothing in 17 HTML files is maintained by
hand; the stamper writes them and the check recomputes them.

> **A stale stamp is worse than no stamp.** Unstamped, a browser may serve an
> old copy for as long as its heuristic freshness lasts — a window. Stamped and
> not regenerated after an edit, the URL still names the old version, so the old
> copy stays *correct* forever and the window becomes permanent. This is why
> `tests/check-static.js` recomputes the hash and compares rather than checking
> that a `?v=` is present: "somebody added a stamp once" is precisely the state
> that produces the permanent form of the bug.

The check reports its own reach — *"67 asset references across 99 HTML files
checked, 5 distinct assets"* — and **fails on zero**. A restructuring that moved
the references out of `src="…"` would otherwise leave it green having examined
nothing, which is the failure `assertISO` was rebuilt for. Same rule, second
place: a check that cannot say what it covered is indistinguishable from one
that covered nothing.

`stamp-assets.js` is in `NOT_HARNESSES`: run without arguments it rewrites the
HTML, so `npm test` would quietly repair a stale stamp instead of reporting it,
and a test run would mutate the repo.

**Before reporting any browser finding, check what was actually transferred:**

    performance.getEntriesByType('resource')
      .filter(r => /assets\//.test(r.name))
      .map(r => [r.name.split('/').pop(), r.transferSize, r.decodedBodySize])

`transferSize: 0` means it never left the cache. A few hundred bytes against a
much larger `decodedBodySize` means a 304 — the server was asked and said
nothing changed. Only a transfer near the decoded size is a fresh copy. A
measurement taken without this check is a measurement of the cache.

### An assertion tied to a computed state can be invalidated by correct work

A check that rests on something **derived** — a column, a count, a status — can go
red because the product improved. When it does, the assertion moves or inverts.
**The fixtures do not follow it.**

WS-2599's pre-order column emptied when the distributor took its three wines into
the portfolio. `lineKind()` reads the portfolio live, so the column moved by
itself: the show produced the first orders in April, and the producer is listed
now. That is A16.0 finishing its own story, and the assertion that counted
pre-order decisions was describing a moment, not a rule.

The repair is the inverse assertion — *a show with no pre-orders asks the host
for no decision* — which is the more useful statement anyway. The alternative was
to give a completed April show a wine nobody has covered in four months, so that
a test stays green: a green test and data nobody can believe.

> **Corollary, and it cost three separate repairs in one day: a mutation that
> relies on a fixture is valid only as long as that fixture happens to fit.**
>
> Each of these was a real change to the product that the check could no longer
> see: "compute the badge from the name" where every fixture's initials matched
> anyway; "the invite picker offers every producer" once every producer had
> become a partner; "the winery sentence inflects on the count" once that winery
> held five wines instead of one.
>
> A mutation must **build the state that makes its defect visible**, in the check
> itself. Choosing the subject by property rather than by name is the cheaper
> half of the same discipline — pick the producer that *has* exactly one wine,
> and fail loudly when the data no longer offers one, instead of naming a
> producer that had one when the check was written.

### A removed field must be swept out of every harness — a search, not an intention

**A test that reads a deleted field does not go red. It goes quietly useless and
keeps reporting success.** `undefined` compares, concatenates and passes a regex
without complaint, so the assertion still runs, still prints its ✓, and no longer
looks at anything.

Decided 5 August 2026, after `tests/order-list.js` was found asserting
`/Catarratto/.test(i.wine)` — `wine` had been removed from order lines by pass 4
of the product-key chain. The regex ran against `undefined`, never matched, and
the guard against a held-back wine reaching a purchase order had been reporting
success ever since. It was passing while `placePreparedOrder()` built every guest
order line with no product key at all.

**The rule: when a field is removed, the source of every harness is searched for
it before the pass is called finished, and each hit is either rewritten against
the replacement or deleted.** A search run, not a good intention — the whole
point is that nothing else will tell you.

The sweep on the day the rule was written found **seven vacuous assertions across
four harnesses**, all from the same two removals (`products[].name` in pass 3b,
`items[].wine` in pass 4):

| Harness | What it claimed to prove | What it actually did |
|---|---|---|
| `follow-feed.js` | an anonymised show's wines never reach the feed | `html.includes(undefined)` |
| `profile-shows.js` | the same, on 15 profile pages | `scoped.includes(undefined)` |
| `public-shows-page.js` | the same, on the public page | filtered an array of `undefined` to empty |
| `order-list.js` ×4 | the producer's record is untouched; a wine changes column; a held-back wine is not ordered; no stocked wine is re-ordered | matched nothing, and one of them spliced a deep copy at index −1 |

Three of those were the **disclosure** guards for A16.6. Nothing had been checking
that an anonymised show does not name its wines, on any surface, since pass 3b.

Two lessons beyond the rule itself. **Repairing a vacuous check is finding work,
not tidying** — the repaired show-product check immediately went red on a real
question (an own-label wine is legitimately absent from `partnerWinesPool`, so
the assertion had to be the resolver and the exhibitor, not the pool). And **a
vacuous read hides a second defect underneath it**: the column check was mutating
a JSON round-trip of the portfolio, which no correct key would have fixed.

### Do not grow the fixtures until every message type reaches every role

Demo data is not a coverage matrix. **An empty case with a legible reason is
worth more than complete coverage**, because it shows the problem the platform
exists to solve.

Bistro Laurent gets no supply notification, and the reason is that Château
Belrieu had no distributor. That absence *is* the pitch: invariant 3 says
restaurants source exclusively through a distributor, so a producer without one
is unreachable — and a viewer who notices the gap has understood the model
faster than any filled-in row could have taught them. Adding a partnership so
the row appears would have deleted the demonstration in order to complete a
table.

So when a role is missing a message type, first ask whether the absence is
*true*. If it is, keep it and make the reason visible. Fixtures are only
extended when the gap is an accident of authorship rather than a fact of the
model.

> **The same rule applies to the assurances.** An assertion that pins an empty
> case must state the REASON, not just the state — otherwise it defends the
> emptiness once the reason stops holding.
>
> `tests/notifications.js` asserted *"the restaurant has NO supply row"*. That
> was only ever shorthand for *"Cantina Rossi already had a distributor when
> Bistro Laurent followed it, and Château Belrieu had none"*. The moment Château
> Belrieu gained one — because two orders already depended on it — the assertion
> failed while the product was right, and the tempting repair was to loosen it.
> It was **replaced, not loosened**: the stale case is now named explicitly and
> the live case is required positively, so the section can no longer pass by the
> restaurant simply having nothing.
>
> Read a red assertion over an empty case as a question — *is the reason still
> true?* — before touching either side.

### A narrative that survives two corrections without being checked is not a diagnosis

A description of a defect has to be re-checked **against its object** every time
it is corrected. One that keeps being refined — a different id, a different
field, a different explanation — while nobody re-reads the record it claims to
describe has stopped being a diagnosis and become a story that everyone is
maintaining together.

It happened here in full. A wine-show date question produced, in sequence: a
claim about `ORD-2035` being a draft, a correction naming `ORD-2039` instead, and
a correction of that correction — three passes, each plausible, over a dataset
that contains **no draft order at all**. The narrative was internally consistent
the whole way and never once true. What ended it was not a better argument but
`orders.filter(o => o.stage === 'draft')` returning `[]`.

So:

- **Re-read the record on every correction, not only on the first claim.** A
  correction is a new assertion about the same object and needs the same
  evidence. "You're right, it's actually X" is a claim, not a fix.
- **Quote the record, do not describe it.** `ORD-2039  placed 2026-07-23
  stage 'accepted'` ends a disagreement that three paragraphs of reasoning
  cannot.
- **Count the class before arguing about the instance.** If the claim is "a
  draft is being counted", the first question is how many drafts exist. Zero
  settles it without anybody having to be wrong about an id.
- **Agreement is not evidence.** Two people converging on the same wrong id
  makes it likelier to survive, not likelier to be true. Concretely: everyone
  had searched for the same thing and found nothing, and treated the shared
  absence as confirmation.

The rule generalises past defects to any factual claim about the data. The
harness discipline above (mutation testing, missed-target guards) exists for the
same reason at a smaller scale: a check that cannot fail proves nothing, and a
diagnosis that cannot be falsified is the same object in prose.

### Backfilling master data: the earliest dependent event is the ceiling

When a record is added **retroactively** — a relation that should always have
existed, a master row something already points at — its date is not free. It
must be **on or before the earliest event that depends on it.**

A partnership that begins *after* the first sale made through it is not a
repair. It is the same contradiction one step quieter: the goods still moved
before the relation existed, and now the dataset asserts both. The version that
is easy to miss is the one where the numbers look plausible and only the
ordering is wrong, because nothing renders the comparison.

So the procedure when filling a gap in master data is:

1. **Find every record that already depends on the missing one** — orders,
   events, follow edges, log entries — before choosing a date. That set is
   usually larger than the one that exposed the gap: the Château Belrieu
   partnership surfaced through one order and there were two.
2. **Count only what actually happened.** A date on its own is not an event;
   the stage says whether it occurred. A draft that was never sent, or a
   cancelled order, carries a date and depends on nothing — treating it as a
   dependency would pull the ceiling earlier than the facts require and could
   force a relation to be backdated past its own beginning. Read the stage,
   not the timestamp.

   *No such case exists in this prototype* — all ten orders sit in `pending`,
   `accepted`, `shipped` or `delivered`, every one of which happened, so the
   Château Belrieu ceiling was unaffected. The rule is written for the real
   build, where drafts and cancellations will exist.
3. **Take the earliest of them as the ceiling.**
4. **Look for a floor as well.** Related records often pin the date from below,
   which turns an invention into a deduction. Château Belrieu began following
   Hawesko on 28 Jun 2026 and the earlier of the two orders was placed on 2 Jul
   2026, so the activation date was chosen from a two-day window rather than
   from nothing.
5. **Say in the record itself that the date is fixture authorship,** and say
   what pins it. Both such dates in this prototype carry that note — Enoteca
   Milano ↔ Cantina Rossi, and Château Belrieu — so that a later reader can
   tell an invented date from a measured one.

This is not a partnership rule; it applies to any master row added after the
fact. It is recorded here rather than in A6 for that reason.

**Check it against the whole set, not the row you just wrote.** A single
backfilled row is easy to reason about; the assurance worth having is that
*every* relation still precedes its first dependent event. In this prototype
all ten partnerships do, and the tightest is Weingut Schmitt — active 6 Jul
2026, first order 21 Jul 2026.

`tests/` is excluded from the deployed site in `netlify.toml` — the publish
directory is the repo root, so everything committed is served unless blocked.

**OpenArt limitation:** No true alpha-channel transparency — "transparent background" renders a visible checkerboard as image content. Workaround: match the exact background hex in the prompt, or use chroma-key green (`#00FF00`) for external removal.

## C7b. How the Supabase build starts

**The precondition first: this pass does not start yet.** Three areas of the
prototype still move the data model — member events for all four roles (A16.8),
Matchmaking (A8), and Messages, where the business question of *who may write to
whom* is unanswered and decides whether a message table exists at all. While
tables are still being created there, a model change in Supabase is a
**migration instead of an hour's work**, and the translation this pass produces
would be describing a moving target. Serge's decision, 4 August 2026; it
supersedes the HANDOFF entry that listed the Supabase start as the next item.

The order is therefore: A16.8 · A8 · Messages · **then** the pass below.

**Before the first feature, one pass of its own.** The brief for it is a single
question:

> *"Read the spec and tell me what has to be DIFFERENT in the Supabase build
> from what is described here."*

Not "start building". The reason is that this document describes a **prototype
that fakes three things**, and every one of them is load-bearing in the real
build:

- **no sign-in** — there is no account, no session, no identity;
- **no role separation on the server** — a demo-bar button decides who you are;
- **no access control** — every dashboard is in one HTML file and every record is
  reachable from the console.

Here the role switcher decides what is visible. In Supabase that has to be a
**database rule**. A spec read straight through will describe the surface
faithfully and reproduce all three fictions underneath it.

**This pass is the worked example.** The buyer's picker was pointed at the
distributor's portfolio precisely so a restaurant *cannot choose* a wine with no
supply chain behind it — the guard moved out of the surface and into the logic.
In Supabase that same rule belongs in the database **as well**: a constraint or an
RLS policy that refuses the row. Otherwise only the interface protects it, and an
interface is something you can go around. Read `tests/supply-chain.js` as the
statement of what the constraint has to enforce — it names all four links.

Three things to settle in that pass:

**(a) Name the governing sections, every time.** The spec is ~226 KB. Nobody
reads it whole per task, so each pass states which sections apply to it — and
"the whole spec" is not an answer. Unnamed, the work gets built by plausibility
instead of by specification, which is how a prototype's conventions get promoted
into a schema.

**(b) What falls away with no replacement.** `BLStore`, the shape fingerprint,
the asset stamps, `localStorage` itself, `tests/serve.js`. All of it exists
because the prototype has no server. Carrying any of it across would be carrying
the scaffolding into the building. The **reasoning** behind them still applies —
"a stale snapshot must not look like a code bug" becomes a migration question —
but not one line of the code.

**(c) What travels.** The spec, Appendix D, the invariants, the data shapes in
`assets/bottle-lobby-data.js` — read that as the draft schema, not as fixtures —
and **the harnesses**, because they describe behaviour rather than
implementation. "A buyer may not be offered a wine outside their distributor's
book" is true of any implementation; the jsdom around it is not.

Appendix D travels for its own reason: it records decisions that were taken and
then dropped, with why. Without it the same superseded ideas get re-proposed,
and in a new stack they look new.

## C8. Prototype persistence — `localStorage`

**Scope: the prototype only. This is deleted, not ported, when Supabase arrives.**

Until 2 Aug 2026 the dashboard forgot everything on reload: every change lived in
a JS variable and nowhere else. Preparing a Wine Show before a meeting and then
working on it *during* the meeting was impossible, which was the prototype's
largest single weakness as a demo. Supabase is the right answer, but the data
model is still moving — A16.12 was recut three times in one day — and migrations
for a model that has not settled are expensive. `assets/bottle-lobby-store.js`
buys the demo behaviour now at a fraction of that cost.

**A1 is untouched.** Nothing ever *reads* from `localStorage`; every consumer goes
on reading the same arrays it always read. What is stored is a serialisation of
those same records, written back into the same bindings on the next load. There
is no second truth and no copy — only a longer lifetime for the one record.

| | |
|---|---|
| Persists | 20 collections: `wineShows`, `orders` (+ the `orderSeq` / `docSeq` counters), the four roles' portfolios, partnership requests, promo materials and progress, offers, deals, press, follow graph |
| Never persists | the active role, the open sub-view, the open tab, and every modal's target id — a reload starts the dashboard normally |
| Size | 24.3 KB measured 2 Aug 2026, so the whole snapshot is always written; no dirty tracking |
| Reset | `↺ Reset demo` in the demo bar, next to "View as:" — clears storage and reloads, in every open tab |

**Nobody calls `save()`.** Wiring each array by hand would be fifteen places to
forget, and the failure would be silent. The store watches for work instead, in
two independent ways: DOM events on `document` in the bubble phase, which make a
save feel immediate, and a **heartbeat** every two seconds that simply asks
whether storage still matches the state.

> **The heartbeat is the guarantee, not a belt-and-braces extra.** The first
> version had only the event listener, on the reasoning that state never changes
> except as a consequence of a user action. That reasoning is true of the
> prototype today and still produced a shipped bug: the save was triggered by the
> event arriving *after* the change, so anything that changed state without a
> trailing event was never written at all, and nothing anywhere said so. Tying
> persistence to *how* a change was triggered is the error. The heartbeat asks
> the only question that cannot be answered wrongly — does storage still match?

> **Compare against storage, never against a variable.** That same version
> remembered its last write in memory and skipped writing when the new snapshot
> matched it. Clearing `localStorage` in devtools — the first thing anyone does
> when testing persistence — left the store believing its work was already saved,
> writing nothing until the state happened to change again. A remembered copy of
> what is in storage is a second source of truth about storage, and it went stale
> exactly like any other copy. This is invariant 1 applied to the store itself.

**No save button anywhere, but a receipt.** The actions already *are* the
confirmation — "Send Invitation", "Close the order list", "Confirm this wine". A
second click afterwards would only ask whether you meant it, and would invent a
state — *invited but not saved* — that does not exist in this model. Instead a
"Saved" marker flashes in the demo bar, and only on a write that really happened.
The forms keep their own existing save buttons ("Save prices & lead time"); those
sit at the right level and are unaffected.

**A stale snapshot must never read like a code bug.** After a push the browser
holds yesterday's data, possibly without fields today's code expects. Two guards:
a `VERSION` constant for deliberate invalidation, and a **shape fingerprint per
collection computed from the pristine fixtures** — add a field to
`bottle-lobby-data.js` and the fingerprint changes by itself, because the fixture
is always the shape the new code expects. A mismatch discards **everything, all
or nothing**, and says so in the toast. A partial restore would leave a
half-migrated demo, which is worse than starting clean. A snapshot that breaks
rendering is thrown away and the page reloads once.

> **Correction, 3 August 2026 — this passage used to claim the two guards rely on
> nobody remembering anything. That is false for one case, and the case
> occurred.** The fingerprint sees STRUCTURE, never VALUES, and that is right:
> extending it to values would discard everything on every data change, and the
> changed values are precisely what a user wants kept.
>
> **A format migration is therefore invisible to it.** 59 show dates went from
> `'14 Mar 2027'` to ISO; not one key moved; the snapshot stayed formally valid
> and won against the fresh fixtures. The page loaded new code over old data and
> the symptom was a renderer producing nothing — which reads exactly like a
> regression in the code just written.
>
> **The only lever is `VERSION`, bumped by hand in the same commit that changes
> the format.** That does rely on memory, there is no mechanical bolt for it, and
> saying so is the point: an unstated limit gets trusted. A "format generation"
> beside `VERSION` was considered and deliberately not built — it moves the same
> discipline one level up rather than removing it. Held by
> `tests/persistence.js` for the case that actually happened.
>
> **The measurement rule that came with it:** a snapshot restored from storage is
> not checked by anything that runs against the fixtures. `assertISO` and its
> kind run with persistence off and said "all ISO" while the browser held a
> non-ISO snapshot — both statements true, about different data.

**Cross-tab, without a reload.** `localStorage` is shared across tabs of one
origin, so F5 would do — but redrawing without the F5 is what makes two tabs side
by side a moment rather than an instruction: the distributor loads a wine and it
appears in the winery tab. The `storage` event drives it. While a modal is open
or a field has the focus the receiving tab takes in **nothing** — neither the
redraw nor the data, because re-assigning the arrays under an open form would
leave that form writing into a discarded object — and the change lands as soon as
the tab is free.

> **Known limit, deliberately not solved:** the whole snapshot is written at
> once, so it is last-writer-wins. Two tabs changing different things at the same
> moment means the later write takes the earlier one with it. For "one side acts,
> the other watches" that is right; this is not a sync engine and should not be
> mistaken for a preview of one.

**A harness must trigger the action, not stand in for it.** The trigger bug above
survived a harness that looked thorough, because the harness called the action
and *then dispatched the click itself* — so it proved the store could serialise
and called that "the trigger works". The checks now drive the real buttons and
touch nothing afterwards, and one of them changes state with no event at all.
The general rule when testing a mechanism that reacts to events: **never supply
the event the mechanism is supposed to notice on its own.**

**One place, and a check that keeps it one place.** What persists is listed in a
single `BLStore.register` block at the end of the dashboard's script — necessary
because a top-level `let` in a classic script is not a property of `window`, so
the store cannot find state by name and the page must hand over getter/setter
pairs. `tests/persistence.js` fails the build when a new top-level `let` appears
that is neither registered nor on its explicit transient list with a reason, and
when a `const` collection is mutated behind the registry's back.

**Persistence is off in every harness.** A harness writing state that the next
one reads back would turn the safety net into the thing that hides the break.
`tests/load-dashboard.js` — the one door all harnesses go through — injects
`window.BL_NO_PERSIST` itself, so no harness has to remember and a future harness
that gives jsdom a `url:` cannot silently switch persistence back on.
`tests/persistence.js` opts back in for itself and asserts the isolation from
both sides, against a real `localStorage`.

**When Supabase arrives:** delete `assets/bottle-lobby-store.js`, the register
block, `redrawAll()`, the demo-bar controls and `tests/persistence.js`. Nothing
else refers to any of it — that is what "never reads from storage" bought.

---

## C9. Notifications — derived, never a message table

**Unlike C8, this section does not die with the prototype.** The three conditions
below are product rules and hold on the real platform; only the storage note at
the end is prototype-specific.

**There is no `notifications` table and no inbox.** A notification is a *query*
over records that already exist — `order_events`, a show's event log, the
partnership request stages, the follow graph — in the same way A10 makes the Wine
Guide a query layer over products rather than a second catalogue. A stored copy
would violate invariant 1 and then go stale in the ordinary course of business:
"Cantina Rossi proposes Grillo" would sit in the inbox after the wine had been
confirmed or declined, which is invariant 7 word for word.

A16.11 step 5 already decided this for its own case — *"one notification, two
surfaces — not two records (A1)"*. C9 generalises it.

### The three conditions

An event becomes a notification for a reader when **all three** hold.

| | Condition | Why it exists |
|---|---|---|
| **1** | **Somebody else caused it.** `actor !== my entity`. | What I did myself is not news to me. This is the first thing the query has to know, and it is why every event source has to carry an actor at all (see below). |
| **2** | **It touches MY relation to the thing — not merely the thing.** Only the party the event is actually about. | Narrow on purpose. Not "what third parties do inside an object I am also in". |
| **3** | **I am allowed to see it anyway.** The notification inherits the visibility rules of the surface it points at: A16.6 for shows, the buyer/seller perspective for orders. | A notification must never reveal more than the section it came from. Without this, Notifications becomes the next surface on which A16.6 leaks — and silently. |

**Condition 2, by example.** A show at which Bodegas Ruiz exhibits records
"Bistro Laurent invited to attend". Somebody else triggered it (condition 1
passes), and it happened inside a record Bodegas Ruiz is part of — and it is
still **not** a notification for them. The guest list is the host's book
(A16.5 rule 4). Their relation to the show is *exhibiting*; who else is in the
room is not their edge.

This is why notifications are derived **per relation**, not by forwarding an
object's event log to everyone attached to that object. Deriving from a shared
log is exactly the mistake condition 2 rules out.

#### Condition 2 has a start date

An event that happened **before my relation existed** did not touch my relation,
because there was none. A wine added to a producer's range in 2025 is not news to
somebody who started following in 2026 — it is catalogue, and the producer's page
has carried it all along.

This is **not a recency filter**, and the difference is the point. A filter is a
guess about how long something stays interesting, and nobody has stated one; the
bound falls out of condition 2 itself and therefore needs no rule of its own. For
"a winery I follow now has a distributor" it is also simply what the sentence
says: a producer who already had a distributor when I started following does not
*now* have one.

In practice this is what stops a new relation from opening with a wall of back
catalogue — without anyone having to decide how many rows is too many.

> **It follows that every relation must carry the date it began.** The follow
> graph gained `at` for this (A7); an active partnership carries the day it was
> confirmed. A relation with no start date cannot bound anything, and the failure
> is silent in the usual direction: everything gets through.

### Two classes, both notifications

| Class | Meaning | Derived from |
|---|---|---|
| **Awaiting you** | Something needs a decision from me | `showAwaits()` / `exhibitorTurn()` — **the same functions the Wine Shows badge uses** |
| **For information** | No action needed, but my relation to the thing changed — e.g. "show moved to `planning`" | The state change itself |

The first class must not grow its own answer to "does this need me?". Two
functions answering that question is two answers, and they will disagree.

### The regional notification — the one named exception

**"New Wine Show in your region"** goes to restaurants and retailers **in the
show's city who have nothing to do with it**. This is the single deliberate
violation of condition 2, and it is named here so that it stays the only one.

It needs no matchmaking: the show's city and the stakeholder's location both
exist already. A distributor creating a show in Frankfurt is how the Frankfurt
houses hear about it — the demand side (A16.0) finding out that something is
happening near them.

**Precisely because it breaks condition 2, condition 3 is not optional here.**
On a `planning` show the notification may carry only what A16.6 shows publicly:
title, date, city, focus. **No exhibitors, no wines, no venue.**

#### It should become a matchmaking hit, not stay a hard-wired rule

As built, the rule is *same city → notify*. That is **an assumption about the
user that nobody stated**: a restaurant that never attends trade shows gets it
anyway, because it happens to be in the right place.

The right shape is an **A8 match**. The restaurant states what it is seeking —
"wine shows in Frankfurt", "Spanish reds" — and the notification stops being an
exception and becomes the fulfilment of something that was actually asked for. A
rule *about* the user turns into an answer *to* them. This also gives A8 its
first surface where matches arrive rather than having to be visited, and makes
the regional class A8's first real application.

> **For whoever implements this: condition 2 stays broken, and condition 3 stays
> mandatory.** A search query is not a relation. The restaurant still has nothing
> to do with the show — it has a matching interest, which is a different thing.
> So even a stakeholder who explicitly asked for shows in Frankfurt sees only
> title, date, city and focus on a `planning` show. **The anonymisation protects
> the exhibitor, not the viewer** (A16.6); who is looking, and why, does not enter
> into it. Resolving "they asked for it, so they may see more" would be the
> silent A16.6 leak this whole section exists to prevent.

### The two A8 signals — something became buyable

Two sources exist for the demand side alone, and both are A8 matches arriving
rather than events being forwarded (A8, "a surface where matches arrive").

| Source | Who it reaches | Why it is a notification and not noise |
|---|---|---|
| **"A winery I follow now has a distributor"** | Whoever follows that producer **and is a Restaurant or Retailer** | Invariant 3 is what makes it news: they source exclusively through a distributor, so a followed producer without one is a range they cannot reach at all. The moment a partnership goes `active`, that range becomes orderable for the first time. |
| **"A new wine"** | Whoever has a relation to that producer — an **active partnership or a follow** | Condition 2, unchanged: a new wine at *any* producer is nobody's notification. |

**Both must ask one and the same question** — "do I have a relation to this
producer, and since when?" A second function answering it is a second answer, and
the wider one wins silently; this is the mistake condition 2 already cost us once.
The same function supplies the start date the bound above needs.

**The supply signal is the demand side's only.** A distributor hearing that a
producer they follow has signed with somebody else is a different sentence and
does not belong here. Note that this gate is easy to leave untested — it is
covered by construction as long as no producer or distributor happens to follow a
producer who signs later, and a bolt nobody can trip reads as dead code.

The wine row follows the destination table below: **a plain link from the
product's `url`, new tab, no popup**, and a product with no article page is named
and not linked.

### The surface — and the one rule that is load-bearing

The list is a **worklist above a record**: "Awaiting you" and "For information"
are drawn apart, never interleaved. Mixing them hands the reader the sorting job
the two classes already did. The sidebar badge counts the **unread** part, not
the derivation — a badge that counts everything looks right on day one and stops
being actionable the moment anything is read.

**A row opens the thing it is about, on the surface that already renders it.**
Notifications is a query layer; it must not become a place where things are
rendered a second time.

| The row is about | It opens | Never |
|---|---|---|
| A wine show | A popup whose body is the **public show card at the level the show's stage grants** — the same renderer the public Wine Shows page and the public profiles call | Its own rendering of the show |
| A stakeholder | That stakeholder's **real public profile page, embedded** | A second profile renderer |
| A wine | A **plain link** to the wine's article page, new tab | A popup |
| An order, a partnership request | The Orders view / the Requests section that already exists | A copy of either |

**The wine show popup is where this pass could have gone wrong, and the reason
is condition 3.** The list reaches a restaurant that merely browses (A16.0) and,
through the regional exception, a house with no relation to the show at all. A
popup that rendered the show itself would be a **fourth surface** — the one place
where A16.6's anonymisation does not hold — and it would leak silently, because
a fuller card looks like a better card. So the popup shows the public card **to
everybody, participants included**, and the way to the working view is a link
into the existing Wine Shows route, which decides for itself what that viewer
may see. A participant losing one click is the price of the rule holding
everywhere at once.

**A link to a wine is a reference, not a string.** The article page comes from a
`url` on the product record. Deriving it from the product's name — slugifying
"Primitivo Riserva" into a filename — would make a cross-feature link depend on
string equality, which is what invariant 4 exists to prevent, and this project
has already paid for it once (A14.4, the em dash in "Riesling Spätlese — Mosel").
**A product with no article page is named without a link.** No link beats a
guessed one.

### What this requires of the sources

Every source has to answer two questions about every event: **who** and **when**.
Three could not, and were fixed on 2 Aug 2026 ahead of this section:
`order_events` carried no actor at all; the follow graph carried no date, so A7's
promised "X started following you" could not be placed in time; and partnership
requests carried a third date format. `tests/notification-sources.js` holds these
open, because a missing field is invisible at the notification end — the event
simply never appears, and an empty list looks like a quiet day.

The two A8 sources cost two more, for the same reason:

- **A product carries the day it was added to the range.** The actor needs no
  field — the producer owns the record (invariant 2), so the actor *is* the
  producer.
- **An active partnership carries the day it was confirmed and by whom.** The
  "whom" is not either party: activation is a manual confirmation by Bottle Lobby
  staff (invariant 6), and putting that in the record rather than assuming it in
  the derivation is exactly what this section asks of a source.

**The one thing that is genuinely stored: the read marker.** Whether I have seen
something cannot be derived from the events. It is not an inbox — it is a
per-stakeholder marker (a timestamp, or a set of seen event ids), and in the
prototype it belongs in the `BLStore.register` block like any other state (C8).
Without it the badge cannot be honest.

**And one input record beside it, not inside it: the suppression.**
`communication_suppressions` (A16.14e, A16.9) is stored too — but it is the
recipient's *declaration*, an input like a follow or a partnership request, not
notification state. The read marker stays the only thing the notification
mechanism itself stores.

---

# APPENDIX D — SUPERSEDED DECISIONS

> **Purpose:** nothing is lost, but nothing contradicts either. Every entry here was once a live rule and is **no longer in force**. The reasoning is kept so a later reader — human or Claude Code — understands *why* the current rule looks the way it does, and does not "helpfully" reintroduce the old one.
>
> **These are not instructions.** If anything below conflicts with Parts A–C, Parts A–C win, always.
>
> The full change history lives in Git: `git log --follow BOTTLE-LOBBY-SPEC.md`.

| # | Superseded rule | Replaced by | Why it changed |
|---|---|---|---|
| D1 | Restaurants could source wine **directly from a winery**, with the join relation recording the route (direct vs via distributor) | **A3** — exclusively via a Distributor partner | The direct route contradicted the commercial model. The distributor is the paying party and the exclusivity holder; a direct channel would have made the platform bypassable. |
| D2 | Profile Completion shown on all profile pages | **B5** — owner-facing only, replaced by the Media Gallery on external pages | Completion percentage is a private nudge to the owner. Showing it publicly advertises an incomplete profile to the exact people who should be impressed by it. |
| D3 | Wine Guide back-links pointed to `bottle-lobby-wine-guide.html` without a hash | **B6** — hash deep links per page type | Returning to the top of the Wines tab from a distributor page lost the user's place. |
| D4 | Wine article Grape Variety linked to the static hub page `bottle-lobby-variety-{slug}.html` | **B7** — links to the Wine Guide's filtered view with a `?grape=` query param | The hand-authored hub pages drifted out of date (A12). The filtered Wine Guide is always current because it is a live query. |
| D5 | Wine article breadcrumbs variously showed "Distributor / Grape Variety / Wine" or "Winery / Grape Variety / Wine" | **B7** — always Country / Region / Winery / Wine | The old forms mixed commercial relationships into what should be a provenance trail, and were inconsistent between pages. |
| D6 | Wine article distributor button read "View at [Name]"; winery button read "View Full Portfolio" | **B7** — "View Distributors" (modal, all distributors) and "View Winery" | A wine can have several distributors. A single-name button silently hid the others. |
| D7 | A wine's `distributor` field was a single value | **B7** — always an array | Same reason as D6. |
| D8 | The combined demo page was `bottle-lobby-profile-public.html` | **B11** — `bottle-lobby-profile-demo.html`, called "Profil Demo Seite" | The old name implied it was somebody's real public profile. It is a concept demo and must never be linked as a profile destination (A11). |
| D9 | Company name "Caracter Wines GmbH" | **§0** — Caracter Media GmbH | Wrong legal name, corrected sitewide. The domain `caracterwines.de` is deliberately unchanged pending a separate decision. |
| D10 | Bistro Laurent and Weinhaus Müller had no dedicated public profile pages; links pointed at `bottle-lobby-restaurant-profile.html` / `-retail-profile.html` | **A11** — dedicated per-entity public pages for all four roles | Those files are the *owner's* edit/preview pages and show the Public/Edit toggle bar. Sending outside visitors there exposed owner chrome. |
| D11 | Promo Materials, Offers and Deals sat under the distributor's "My Profile" nav section | **B8** — their own "Promotion" section | They are commercial instruments aimed at customers, not profile content. |
| D12 | Orders were three scroll-target sections inside the distributor's profile page | **A14.8** — Orders is its own sub-view with a list and a detail level | Order management is the commercial core and needs a working surface, not a section of a long page. |
| D13 | Handover was a full ZIP of every file after each change, uploaded manually to Netlify | **Part C** — GitHub → Netlify pipeline, Claude pushes directly | Two manual steps became none for most files. The ZIP survives only as an explicit fallback for the oversized files (C3). |
| D14 | `HANDOFF.md` carried file lists, file counts and change history | **C2** — only open items, next steps and reasoning | Git already knows the rest, and duplicated inventories go stale silently. |
| D15 | Proposal to split `bottle-lobby-dashboard.html` into separate CSS and JS files so Claude could push it directly | **C3** — rejected after measuring | The file is ~170 KB markup, ~120 KB JS, ~43 KB CSS. Extracting CSS and JS leaves the HTML at ~170 KB — still unpushable. The refactor would have carried real risk for no gain. **Do not re-propose without measuring again.** *(Re-measured 31 July 2026: the composition stated here was wrong — actually ~186 KB markup, ~228 KB JS, ~59 KB CSS. The conclusion stands and is now stronger, since `git push` from Claude Code removes the motivation entirely — C3, D22.)* |
| D16 | Distributor sidebar had a fourth-position **"Orders"** section with items "Incoming Orders / My Orders / Order History" | **B8** — renamed **"Commerce"** and promoted to second position, directly under Overview; items renamed **My Sales / My Purchases / Order History** | "Orders" undersold the commercial core and sat too low in the sidebar. "Commerce" reads as the primary workspace, and the buyer/seller-neutral "My Sales / My Purchases" pair names each direction plainly. Routing into the Orders sub-view (A14.8) is unchanged. |
| D17 | Distributor Promo Materials, Offers and Deals sat in their own **"Promotion"** nav section (the move recorded in D11) | **B8** — consolidated under the **"My Portfolio"** section, alongside My Wine Portfolio and My Labels | With Commerce promoted to the top, the remaining seller-owned instruments read more coherently as one "what I carry and how I promote it" group than as a thin standalone section. Supersedes the "Promotion" section named as the answer in D11; D11 remains valid history of the earlier My Profile → Promotion move. |
| D18 | Distributor dashboard profile was one long scrolling page; nav items were scroll targets to sections within it (the general case of D12, which covered Orders) | **B8** — every nav item opens its own discrete sub-page via `showDistributorView()`, showing exactly one section and hiding the rest; grouped views add an `.ord-tab` tab bar | A single scroll page made deep sections hard to reach and mixed unrelated content on screen at once. Discrete sub-pages give each area a clean working surface, consistent with the Orders sub-view (A14.8, D12). |
| D19 | Winery, Restaurant and Retail read their orders in card-list sections inside the profile page (`wsection-orders-in`, `rsection-orders`, `tsection-orders` …); Restaurant and Retail called their nav item **"My Orders"** | **A14.8** — all four roles use the same two-level Orders sub-view, driven by the `ORDER_ROLES` registry; the buying roles' nav item is now **"My Purchases"** | The card list could show an order but not work one: no payment, documents, shipping or line editing. Parameterising the existing sub-view rather than copying it keeps one implementation for a model that is one record seen from two sides (invariant 8). "My Purchases" makes the same act carry the same name in every role — the distributor already used it for buying, and "My Orders" no longer denotes anything specific there (D16). |
| D20 | The follow feature carried a different label per role: the winery showed **"Wine Fans"** and no follow list at all, Restaurant and Retail showed **"Wine Stars"** and no fan list, and only the distributor used **My Stars / My Fans**. The "My ___" convention was declared **Distributor-only** | **A7** — one uniform pair, **My Stars / My Fans**, in all four roles, both directions always shown; the "My ___" convention now applies everywhere (B8) | The follow graph is a single symmetric relation between any two stakeholder types (A7). Three names for two directions made it read as three separate features, and hiding one direction per role hid data that already existed — a winery follows accounts, a restaurant has followers. Wine-themed labels also tied a category-neutral relation to wine, against invariant 5. Note the direction of travel: the *convention* generalised, the *exception* did not survive. |
| D21 | Winery, Restaurant and Retail sidebars had one combined **"Network"** section, unprefixed labels (Basic Information, Wine Portfolio, Active Distributors, Distributor Requests …), an Orders section low in the list, and profile nav items that were scroll targets rather than sub-pages | **B8** — the same eight-section structure, the same "My ___" convention and the same sub-page mechanics as the distributor, minus whatever a role has nothing for | Four dashboards that behaved differently taught the user four navigations for one product, and the divergence was accidental — the distributor was simply rebuilt first (D16, D17, D18). Merging the two request directions into one **My Requests** section per role also removed a real inconsistency: the same partnership record was reachable under two different section names depending on who sent it. |
| D22 | C3 stated flatly that `bottle-lobby-dashboard.html` **"cannot be pushed at all"**, with a file-size table measured before the Wine Shows pass | **C3** — the limit belongs to the MCP connector, not to the repo. From Claude Code `git push` handles the file like any other; the whole-file constraint and the size table apply to **chat sessions only** | The unqualified wording pushed work onto the manual-upload route even where a local clone was available — slower, and it needs a step from Serge for no reason. The sizes were stale too: the dashboard had grown from ~415 KB to ~473 KB, and the recorded composition was wrong (D15). |
| D23 | A product named on a Wine Show was settled by **one side alone**: the prototype's `saveCounter` wrote `status:'confirmed'` for a wine the producer chose, and the producer's `Confirm` accepted the host's wine without the host ever being asked again. Accepting an invitation was also possible **without naming a product** | **A16.4** — whoever proposes a product, the *other* side confirms it; `confirmed` means both sides agreed. Accepting a place and naming a product are one act, so a confirmed exhibitor always has a product on the table | The one-sided version contradicted the sentence directly above it in A16.4 — that a named product is a proposal, not an instruction — and it only held that view in the host→producer direction. It also carried a real defect: inviting without a wine and then confirming left `products` empty, so `showReadiness` never saw a confirmed product and the show sat in `draft` for good with no way out. `proposed_by` and `status` were already two separate fields (A16.9); the fix was to start reading them together rather than to change the schema. |
| D24 | The catering contribution had three modes, of which `split_by_products` was the only one that charged exhibitors, and a producer's share was **live-computed throughout** — `catering_total × (own ÷ all products)`, "recomputed whenever the line-up changes" (A16.10) | **A16.5 / A16.10 / A16.11** — four modes with `fixed_per_product` as the default, and the amount computed only **until the producer consents to it**, then held as a ceiling that may fall but never rise | Live computation and consent cannot coexist once money is involved: a producer who agreed to €400 owed €500 the moment a third party dropped out, without ever seeing the increase. Recalculating and re-collecting consent instead had no natural end — a second dropout restarts the round for everyone, days before the fair. `fixed_per_product` removes the cascade by construction rather than managing it, and matches how a stand is really booked: at a price, not as a share of the organiser's invoice. `split_by_products` survives for hosts who pass the venue's bill through one-to-one. |
| D25 | `cancelled` and `rescheduled` were available to the host at any time, with `rescheduled` resetting every confirmation | **A16.2** — both barred from the commitment point (A16.11); unwinding a committed show is a credit note handled by staff, not a lifecycle transition | Resetting confirmations was right while a confirmation only meant "I will come". Once it is a payment obligation, the reset revokes something a third party has already acted on — the venue has booked staff, the host has invoiced. The mechanism did not become wrong, its reach did. |
| D26 | A16.5 called the restaurant or retailer providing the room the **"venue host"**, while A16.3 calls the organising distributor the **host** | **A16.5 / A16.11** — **host** is the distributor, **venue** is the restaurant or retailer; "venue host" is not used | Harmless while only one of them acted. The settlement flow (A16.11) has both parties acting in the same nine steps, quoting to and confirming with each other, and one word for two roles in one flow is a defect waiting to be read the wrong way. The prototype's field names (`venueType`, `venueName`) were already on the right side of this. |
| D30 | A16.7 put every participant on their public profile **"host, exhibitor, venue and attendee alike"**, from the same moment | **A16.7 / A16.5** — a row per role with its own moment: host from `planning`, exhibitor and venue from `published`, **attendee from `completed`**; A16.5 rule 4 gains the matching bound | "Alike" was written before attendees were modelled and turned out to be too broad: A16.5 rule 4 keeps the guest list as the host's book, and fifteen profiles each saying "I will be there" reconstruct precisely that list. Deferring the attendee to `completed` keeps both halves whole — the credential A16.7 is after, and the protection rule 4 is after — because the same sentence reports on the guest list before the show and on the attendee's own past afterwards. The boundary is temporal where A16.6's is spatial; the mechanism ("a rule that holds on one surface and not another holds nowhere") is the same one. |
| D29 | A16.12 closed a wine the tally did not carry by letting the interests **`lapse`**, with the attendees "told plainly that the wine will not be listed" | **A16.12** — the host **holds it back with a reason**, the reason goes to the **producer** as a message they can answer, the interests are kept as `held_back`, and the pre-orderer is told *"not ordered this time, your note is kept"* rather than refused | "Lapsed" described an expiry, and the flat refusal ended a conversation that in this trade has barely started: a producer can carry the freight or improve the terms, and some wines need two or three shows before they carry themselves. Both of the old behaviours also destroyed the signal — a guest told "no" stops asking, and A8 loses exactly the demand nobody is serving yet. Only the wording of the guest's message was ever in doubt; the reason reaching the producer was the substantive change. |
| D28 | `wine_show_attendees.status` carried **`waitlisted`** as a stored value, alongside a rule that the waitlist "moves up automatically" | **A16.5 / A16.9 / A16.10** — the status records only the decision (`invited` · `requested` · `confirmed` · `declined` · `withdrawn`); holding a seat or a waitlist place is computed from request order against capacity | The two could not both be true. A stored `waitlisted` has to be rewritten for everyone behind a departing attendee, which is a cascade, not an automatic move-up — and it is stale between the withdrawal and the rewrite. Computing it makes the promise in A16.5 literally true. `withdrawn` was added in the same breath: leaving of your own accord and being turned down are different facts, and only one of them may be re-invited without ceremony (the same distinction `lapsed` draws in A16.11). **Superseded before it was ever built.** |
| D27 | `orders.source` was to gain a single **`wine_show`** value, guarded by "a `wine_show` order can never carry product lines" (A16.11) | **A16.12 / A14.3** — two opposite values, `wine_show_order` (goods, down the chain, always product lines) and `wine_show_catering` (service, against the chain, never product lines), each with its own guard | The single value was drafted while the catering settlement was the only money a show produced, and it was already wrong: the show's *purpose* is the consolidated purchase (A16.0), which is a product order sourced from a show. One value would have forced the guard to be either useless or false. **Superseded before it was ever built** — noted here because the decision was taken, not because code changed. |
| D31 | A stakeholder's own identity — type, badge, region, public page — lived **inside every list that mentioned the house**: the partner lists of all four roles, the eight request lists and the follow graph, twelve arrays in all | **A2** — one `stakeholders` record per house; every list holds a reference and asks for the rest | Not a decision anybody took, which is why it survived so long: each list was written on its own and each one needed a badge. The result was measurable drift before anything was built on it — Hawesko GmbH rendered **HW** where a badge was stored and **HG** where one was computed from the name, on two dashboards at once, and neither was identifiably the wrong one. The winery's list had no public page field at all, so the winery was the only role that could not reach its partner's profile (A11). Two rules came out of the repair: a badge is a **field**, because initials look derivable until "Cave à Vins Lyon" comes out *CÀ*; and a house that legitimately has no record must make a lookup **say so** rather than render blank (B12). |
| D32 | An active partnership was **one list per dashboard** — `activePartners`, `wineryPartners`, and one each for restaurant and retail — while A6 already said both sides "see the identical stage of the identical request record" | **A6** — one `partnerships` row naming its two ends (`distributor`, `partner`), read from either side, with `at` in ISO and `activated_by` | The two statements could not both be true, and the copy had already drifted: Weinhaus Müller ↔ Hawesko was dated **14 Apr 2026** in one book and **"March 2026"** in the other, with nothing able to say which was right. Naming the ends removed three assumptions that had been invisible while only one book existed — a Wine Show's pickers now offer the **host's** partners rather than a platform-wide list (A16.4), `arePartners(a, b)` replaced a lookup that silently supplied "the distributor", and *"X now has a distributor"* takes the producer's **first** partnership, because gaining a route to the trade happens once and not once per distributor. |
| D33 | Each end of a partnership carried its **own display figure as a stored field** on the row — `distributorMeta` ("6 wines in your portfolio") on the distributor's end, `partnerWines` on the other three | **A6 / invariant 7** — the row holds the relation only; every figure beside it is counted from the distributor's portfolio at render time, through `portfolioOf()` / `portfolioCount()` | Storing them survived the merge into one `partnerships` row (D32) because a figure looks like a property of the relation. It is not — it is a property of a book that changes without the relation changing, and by the time it was measured two of the four were already false on screen: Cantina Rossi's card claimed **6** where the portfolio held **1**, Weingut Schmitt's claimed **1** where it held **2**, and the restaurant and retailer named **5** and **6** for the identical book, neither matching it. The repair forced a question nobody had answered: **which of three wine lists is "their portfolio"**. Only one is owned by anyone — the distributor writes it and it persists; the other two are pickers whose producer field holds the *supplier*, so they cannot answer invariant 2 and are not portfolios at all. Two rules came with it: a house with no book yields `null` rather than an empty one, because *"0 wines"* claims something nothing here knows (A2's unknown stakeholder, again); and a derived figure obliges every surface showing it to be repainted by the action that moved it — one wine pulled in changes a number in all four roles, and leaving them standing is a defect the harnesses could not see and the browser could. |
| D34 | A distributor's wines lived in **three lists**: `currentWinePortfolio` (6 wines, owned and written), and two byte-identical picker pools of 10 whose `winery` field held the **supplier** — so `wineryOfWine()` existed to guess the producer, defaulting to *Cantina Rossi* | **A3 / A6 / invariant 2** — one book per distributor, every row naming its real producer; both buyer pickers read it through `portfolioOf()`, and the pools are gone | The pools could not answer "who made this", which is invariant 2, and nothing checked a partnership when a wine went onto a buyer's list. That is how a distributor came to offer — and twice sell — wines of a producer it had no partnership with. Merging them forced the question nobody had answered: **which of the three lists is the portfolio**. Only one was owned by anybody. The attribution was sourced rather than invented: 6 rows were already correct, 3 came from the producers' own book, 1 from an order line, and exactly **1** by hand, with **zero contradictions** where two lists named the same wine. The book grew 6 → 14, because three further wines were being advertised or discounted without being carried at all — an offer over a wine outside your book is the same gap as a sale, only delayed (A3). Deleted with it: `wineryOfWine()`, which was measurably wrong twice; three `fileGuess` slug derivations that rebuilt a URL the record already carried (A14.4); and `note`, which duplicated `ownLabel` and carried the buyer's own *Exclusive* marking into the distributor's book (A1). |
| D35 | Restaurant and Retail were treated **alike**: a wine could go on either list as long as an active distributor partnership existed and the wine sat in that distributor's portfolio — no purchase of their own required | **A3** — the restaurant condition stands; Retail additionally needs **an order of its own**, a sample order or trial bottles being enough | The two lists are not the same kind of object. A wine list is an **offer**: the guest orders, the bottle is delivered just in time, and naming a wine that arrives tomorrow is normal trade. A retail selection is a **shelf**: the customer carries the bottle out of the shop, and a retailer cannot sell what they do not have. Measured when the rule was written (4 Aug 2026), the prototype showed exactly why it had gone unnoticed — Weinhaus Müller's selection held Sauvignon Blanc, Chardonnay and Primitivo, **the same three wines as Bistro Laurent's list, line for line**, while its actual purchases were Merlot (156 bottles across two orders), Nero d'Avola and Catarratto. The two sets were **disjoint**: nothing on the shelf had been bought, nothing bought was on the shelf. Serge's decision. **The repair is NOT done — the data still stands as measured above, and this row said otherwise until 4 Aug 2026.** It is its own pass, *A3 retail condition*, queued behind `listings`, and it goes by extension rather than removal (A3): backfill three purchases for the three wines already on the shelf, add the three bought wines to the selection, 3 → 6, at which point the retail selection differs from the restaurant's list for the first time. The backfilled orders take their dates from C7 — the earliest dependent event is the ceiling — and there is already a dependent fact to reconcile with: `tPromoProgress.bottleCounts` asserts **60 bottles of Sauvignon Blanc and 48 of Primitivo that no order carries**, so the backfill has to agree with quantities the promo progress has been claiming all along. That second home for the same fact is itself what `listings` absorbs, which is why the two passes run in that order. |
| D36 | "Own label" named **four different facts with one phrase**: whether a company may take part in the programme (nothing at all), whether a wine may be asked about (`note:'Own-Label Available'` — free text beside other free text, on 3 rows, all Cantina Rossi), whether a **finished own-label product** exists (nothing at all), and whether a distributor actually **carries** one (`ownLabel:true`, stored on 3 portfolio rows) | **A17.0a** — four homes: an active `ownLabelProgramMemberships` row · `products.ownLabelAvailability` (`unavailable · on_request · available`) · the finished product, created by the winery from a **gate-2-approved** project · and a portfolio flag **derived only once the first commercial order has been delivered** | The same shape as the three wine books (D34) and the four partner lists (D32), one level further down, and it had already produced its first visible defect: the hand-written "My Labels" panel claimed **six** wines where the data carried **three**, because no script ever wrote into it. A capability is a property of the producer's wine; a project is a working relationship with a lifecycle; a finished own label is **its own product** with its own key, brand, article page and article number, produced by the winery (invariant 2 does not bend) and branded by the distributor. Marking the producer's wine with `ownLabel:true` was recording a fact about somebody else's business on a record that does not belong to them. The flag does not survive beside its replacement: it is removed in the pass that gives those three wines real projects. The last two levels are the pair most easily collapsed — a product created is **not** a product carried, and *product created ≠ active in the portfolio* is the rule that keeps a wine off a restaurant's list before a bottle of it exists (A17.9). |
| D37 | Own-label exclusivity was read as a lock on the **customer**: no other distributor sees the product, may select it, order it or take it into a book. Measured at **five spec locations** — A17.9 *Consequences* · A17.9 *Visible ≠ in the book* · the A17.13 table row *an exclusive product, in any picker* · A17.13 *Reach can never widen an action right* · the A17.12 row *`ownLabel` on a listing* | **A17.9 / A17.9a / A17.9b / A17.12 / A17.13a** — exclusivity locks the **source**: the winery may supply nobody but the primary distributor A, and no other distributor may order the product **from the winery**. A sells onward within his agreed **Market Grants** (A17.9a). A downstream holder B gets an ordinary listing — no own-label status, his own `tradePrice`, which the listing key already carries per holder — while the product stays an own-label product at product level. Only A's listing derives `ownLabel`, and now from **two** conditions: first commercial delivery confirmed **and** holder = the project's primary distributor. The fee accrues once, winery → A (OL-14, OL-15) | The lock was written one step too far down the chain, and at that distance it forbids ordinary trade: a distributor who has bought the goods may resell them, and every real own-label arrangement says where and through which channel. Read as written, the fifth location would additionally have marked **B's** listing as own label on B's own first delivery — the same collapse A17.0a exists to prevent, arriving through a different door. The draft that produced this correction first proposed a `resaleAllowed` boolean and a single `resaleTerritory` string; **that pair is superseded here before it ever entered the spec**, because a country grant, a channel grant, a sub-distribution grant and a named key account cannot share one field without becoming D36 a second time. |
| D38 | A16.2's `planning` entry trigger: **venue + at least one exhibitor + at least one product confirmed** before a show is publicly listed | **A16.2 / A16.14c** — `planning` begins with the host's basics (title, date, city, focus). Venue, exhibitors, products, fixed costs, the per-bearer split and every affected consent become **publish preconditions**, checked before `pending_approval` | Recruiting happens *inside* `planning` (A16.4, A16.14c), so a show that may only enter `planning` with a confirmed exhibitor can never recruit its first one — the stage that exists to find participants was gated on already having them. The fixture WS-2604 sitting at zero wines is that contradiction observed, not an accident. Nothing is given away by moving the checks: A16.6's anonymisation makes an early listing safe, and the platform's guarantee has never attached at `planning` — it attaches at `published` (A16.1), which is exactly where the old trigger's checks now sit. |
| D39 | The sidebar sections **My Partners** and **Network** (B8, all four roles); and, from the withdrawn A16.14 draft, `'network'` as a **reach value** | **B8 / A16.14b** — **Network** = the business relations (former My Partners: My Partnerships / My Distributors · My Requests). **Community** = the follow side (former Network: Matchmaking · My Opportunities · My Stars · My Fans). The reach taxonomy names those two levels `partners` and `community`; the generic value `network` does not exist | Two sections did not shift by one, they **swapped meanings**, so any split delivery leaves a window in which the word "Network" means the old section on one screen and the new one on another — which is why the rename is one commit across all four navs and this spec table. The reach value went for the same reason one level down: a nav section and a reach level may not be the same word, or a reader has to know which of the two a filter is talking about. Note the hazard the rename pass inherits: in the dashboard code the string `network` **already** names two different things — the partnerships *section key* (with its `*nav-network` ids) and the Matchmaking/Stars/Fans *group key* — so the rename goes by map position and id, never by string replacement. |
| D40 | **A3's chain as the complete sourcing rule** — `WINERY → DISTRIBUTOR → RESTAURANT/RETAIL` and nothing else — together with **A14.1's narrow sentence** *"a Distributor buys from a Winery"*, and A3's own leftover reading of own label as *"a separate flag/relation layered on top of the winery→distributor wine link"* | **A3** *Where a distributor sources* — a distributor buys from a winery **or from another distributor**; A may sell ordinary wines he lawfully carries to B on an active A↔B partnership within his own distribution agreement; sub-distribution is not an own-label privilege; B gets his own listing on the same `productId` with his own `tradePrice` and article number; producer stays the winery and B's seller is A; the A→B order creates no relation; A17 grants are checked for **own-label products only**; the ordinary distribution agreement is **named, not modelled**; Restaurant and Retail still buy exclusively from a distributor. A14.1 widened to match; the own-label sentence now points at A17 (D36, D37) | The rule was never meant to forbid this and three places already assumed it did not: **A8** has named Distributor↔Distributor portfolio supplementation since it was written, **A17.9b** describes the downstream holder in full, and `ORDER_ROLES` names roles rather than pairings — only the chain diagram and one sentence in A14.1 said otherwise. Left as written, the platform would have permitted a distributor to resell an **own label** while forbidding him to resell an **ordinary wine**, which is exactly backwards: the own-label route is the constrained one, and ordinary trade is the case the whole model rests on. Serge named the contradiction from the business side — the Saparavi case (HANDOFF pass 4) and plain sub-distribution both need this route, and neither is an own label. What is deliberately NOT added: a second grant construct for ordinary distribution terms — A17.9a exists for own-label grants, and building its twin for ordinary contracts would be D36 a third time, so point 8 names the agreement and stops there. |
| D41 | **The six bridged listings read as finished own labels** — PRD-1020 Sauvignon Blanc — Sancerre · PRD-1021 Chardonnay — Chablis Premier Cru · PRD-1022 Primitivo — Alcamo DOC · PRD-1023 Tempranillo — Rioja Crianza · PRD-1024 Riesling Spätlese — Mosel · PRD-1025 Merlot — Bordeaux Supérieur. Carried at **three spec locations**: the A17.0 re-measurement of 5 Aug 2026 (*"27 distinct products, 6 of which are finished own labels"*, and *"14 wines, 6 of them own label and 8 ordinary"*) · the A17.14 migration sentence (*"the existing `ownLabel:true` on PRD-1020, PRD-1021, PRD-1022 becomes derived … the pass that gives those wines real projects"*) · and, in the prototype, `legacyOwnLabel:'active'`/`'pending'` on six listings, `status:'Own-Label'` on ten Wine Guide rows, an *Own Label* ribbon on six article pages, a six-row typed *Own-Label Portfolio* widget, two typed counters reading **5** and a *Real Example* on `bottle-lobby-own-label.html` | **A17.0b last paragraph** — none of the six is an own label. Each is the producer's own appellation wine, under the producer's brand, on an article page written in the producer's name; five of those pages give the ribbon the reason *exclusive distribution through Hawesko*, which is **a producer-owned brand plus a distribution exclusivity and explicitly out of scope**. The six become: five ordinary wines keeping every A17.0 ability; **PRD-1020** additionally the `sourceWineId` of a relabel project (A17.0b's own example); **PRD-1022** and **PRD-1024** carrying `ownLabelAvailability:'on_request'`. Hawesko's real own labels are **two new `PRD-` records** with `brandOwner:'Hawesko GmbH'`, each out of a gate-2-approved project, one active and one created-but-undelivered. A17.0's counts and A17.14's migration sentence are corrected accordingly | **The definition beats the fixture observation, and the fixtures said so themselves.** A17.0b was written on 4 Aug and its closing paragraph excludes this exact arrangement by name; the 5 Aug re-measurement counted the flags it found instead of testing them against it, and A17.14 then wrote the count into a migration plan. **The article pages are the evidence, and they were always public**: `bottle-lobby-wine-sauvignon-blanc-sancerre.html` describes the wine as *"Henri Dubois Domaine farms its Sauvignon Blanc …"* and justifies the ribbon with *"Exclusive to Hawesko in northern Germany and Scandinavia"* — brand and exclusivity in one sentence, and only the second one is true. **PRD-1022 contradicted the flag on its own page**, which reads *Own-Label Available* — a capability where three other surfaces claimed a product, which is D36 surviving inside its own replacement. **The strongest counter-argument refuted itself**: the six are absent from `partnerWinesPool`, and A17.9 does forbid an own-label product from appearing in another distributor's picker — but **PRD-1026 sat in exactly the same gap with no own-label claim anywhere**, so the gap is seven mockup rows that lived only in the distributor's book, not six own labels; `assets/bottle-lobby-data.js` recorded the doubt in writing (*"the open question is not whether to loosen A17.9 but whether all six are own labels at all"*). **What the misreading would have cost, measured**: those six wines are named by 7 of 11 orders, 4 of 5 promo materials, 3 of 3 exclusive deals and both buyers' wine lists. As own labels every one of those movements would need a covering Market Grant under MG-1 — the model would have started refusing ordinary trade in order to protect a brand nobody owns, which is D40's error one level down. As ordinary wines, not one of those fixtures changes. |
| D42 | **ME-5 as first written: "venue and participant surfaces show head counts, never identities, until `completed`"** — no name on any public member-event surface before the event was over, the confirmed winemaker's included | **A16.15 ME-5** — differentiated: guests, general participants, applicants and unanswered invitations stay unnamed and stay head counts; a confirmed **`winemaker` or `exhibitor`** may be named on the public surfaces of a **published** member event after their explicit acceptance and never before it; until acceptance the name appears only in the invitee's own view and the host's; the event itself stays gated by its stored reach (A16.14b); and a public naming is neither a release act nor a guarantee (ME-3) | **The blanket rule protected the one party A16.6's logic does not apply to.** Anonymisation exists for the invited-but-undecided, whose later decline would read as a withdrawal — and that protection stays in full: `sent`, `viewed`, `applied`, declined and withdrawn names appear on no public surface. But a winemaker dinner whose card may not say which winemaker is coming advertises nothing — naming the confirmed producer is the point of the event, and being named on a published event is part of what the producer says yes to when accepting. Confirmed business decision, 8 Aug 2026: **acceptance is the consent line; `completed` was one event too late.** The naming is a permission, not an obligation, and it is not the Bottle Lobby release vocabulary — a member event still promises nothing (ME-3). |
| D43 | **The announcement audience as first written: a Community Announcement "goes to a reach segment (A16.14b)"** — A16.14b listed campaigns among the features that resolve against the reach taxonomy, and A16.8 said *"the follow graph carries the announcement further"*, so an announcement could have addressed `public`, `members`, a whole role group, or hopped beyond the host's own fans | **A16.14e / A16.14b / A16.8** — an announcement goes to the host's **own fans** (the incoming edges of his A7 graph), optionally plus his **own active partners** (A6), and to nobody else; outgoing edges, role and member groups, and the community or partners of a participant, winery, exhibitor or venue are structurally out; reach keeps deciding who may *find* the carrier and never feeds the audience; every recipient must still pass C9's visibility | Serge's decision, 10 Aug 2026. Reach answers *"who may find this?"* — a permission the reader exercises; an audience answers *"whom may I address?"* — an act the sender performs, and A7 had already said both that a follow is not marketing consent and that no foreign graph resolves into a recipient list for a third party. Reading the audience off the reach taxonomy collided with its own neighbours: `public` and `members` would have made a campaign a broadcast over people with no relation to the sender, and WS-3 — reach falls away from `published` — would have left a published show with **no defined audience at the exact stage where announcing matters most**. The incoming follow edge is the one relation where the recipient himself chose the sender; that is why it, and not the taxonomy, is the audience. |

---

# APPENDIX E — HOW THIS DOCUMENTATION IS ORGANISED

Four places, each with exactly one job. Getting these confused is how knowledge gets lost.

| Where | What lives there | Who reads it | Lifecycle |
|---|---|---|---|
| **`BOTTLE-LOBBY-SPEC.md` in the repo** | This file. The complete, permanent specification. | Claude Code, Claude in chat, Serge | Grows. Replaced as a whole; **Git keeps every previous version** |
| **Project knowledge (claude.ai)** | A copy of this same file | Claude in chat, loaded automatically | Replaced on every change — never appended, never two copies |
| **`CLAUDE.md` in the repo root** | Short. The hard invariants plus the instruction to read this spec before designing anything | Claude Code, automatically at session start | Rarely changes; deliberately kept under ~100 lines |
| **`HANDOFF.md` in the repo root** | Open items, next steps, decisions in progress | Claude in chat | Changes constantly; never contains rules |

**Claude's memory is deliberately NOT on this list.** It has a hard 30-entry cap, so anything durable stored there is eventually evicted without warning. Memory holds only pointers to this file. If a rule exists only in memory, it is at risk — move it here.

**When a rule changes:** update the rule in place in Parts A–C, add a row to Appendix D explaining what it replaced and why, deliver the complete file, and push it. The old wording survives in Git; the old *reasoning* survives in Appendix D; and there is never more than one live answer to any question.

---

*End of specification.*
