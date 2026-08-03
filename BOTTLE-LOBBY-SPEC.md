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

---

## A2. Ownership Map — who owns what

| Data | Owner | Others get |
|---|---|---|
| Wines | Winery | Reference/FK relation |
| Awards | Winery (that earned it) | Reference |
| Press & Recognition | Winery | Reference |
| Trade Reviews | Written by Distributor/Restaurant/Retail, **published only with winery approval** | Reference |
| Wine Shows | Host | Participation relation |
| Orders | Shared record between buyer and seller | Both render the same row |
| Promo Materials | Distributor | Visible to active partners only |
| Exclusive Offers & Deals | Distributor | Visible to active partners only |
| Profile content / media | The stakeholder itself | Reference |

---

## A3. The Supply Chain Model

```
WINERY ─────────► DISTRIBUTOR ─────────► RESTAURANT
                                    └────► RETAIL
```

**Hard rule:** Restaurants and Retail source wine **exclusively via a Distributor partner**. Direct-from-winery sourcing for Restaurant/Retail **does not exist** in the model.

Consequences for the build:
- Restaurant/Retail never create or own wine data.
- Their "Wine List" / "Wine Selection" is a **picker/search over a connected distributor's portfolio** — never a creation form, never a winery-direct picker.
- The join-table relation records restaurant/retail-specific fields: glass price, bottle price, menu category.
- The **"View Distributors" popup** on wine article pages is the discovery mechanism for finding a distributor.

**Distributor portfolio:** Only wines actually taken on via purchase/partnership appear — never a winery's whole catalog automatically. The act of purchasing/partnering creates the relation.

**Own-Label:** A separate flag/relation layered on top of the winery→distributor wine link (which distributor exclusively licensed which wine). Never a separate copy of the wine.

**This rule governs the flow of goods, not the flow of money.** A distributor invoicing a producer for a service — a Wine Show catering contribution, `source: 'wine_show_catering'` (A16.11) — runs against the arrows above and is not a breach of them: no product changes hands, and such an order may not carry product lines at all. Only a route by which wine reaches a buyer is a supply chain shortcut. Wine bought off the back of a show (`wine_show_order`, A16.12) runs the arrows the normal way and is an ordinary purchase.

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
- Winery side: Network → Requests
- Stakeholder side: Network → Incoming Requests

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

All four roles use the same two-item **My Partners** sidebar section (B8). The distributor's first item is called *My Partnerships* because it partners with three role types; the other three partner only with distributors, so the more specific *My Distributors* is kept.

Each of these carries the same four-stage progress indicator, so both sides always see the identical stage of the identical request record.

**Prototype blueprint:** `partnerRequests` / `activePartners` / `renderPartnerNetwork()` and `incomingRequests` / `openIncomingAccept()` in the distributor/restaurant/retail profile files; `wineryRequests` / `wineryPartners` / `openAcceptModal()` / `confirmAccept()` / `declineRequest()` in `bottle-lobby-winery-profile.html`; `openPartnershipModal()` / `confirmPartnership()` on all public profiles; parameterised `partnershipCopy` object in `bottle-lobby-profile-demo.html`.

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

**Prototype blueprint:** shared `wineFollowGraph` array in `bottle-lobby-dashboard.html`; generic renderers `renderFansFor(entityName, listId, countId, emptyMsg)` and `renderWineStarsFor(followerName, listId, countId)` — **all four roles now call both**, with only the entity name differing; shared `roleAv` / `roleTag` / `followRoleLabel` maps covering all 4 types, plus a `wn-av-winery` / `rt-winery` CSS pair for the winery role.

> ⚠️ **Field-naming debt to fix in the real build:** in the prototype the *followed entity* field is still called `winery`, with an optional `followedType` that defaults to `'winery'` when omitted. That was backward compatibility with the first version, when only wineries could be followed. In the real build name it properly — `followed_id` / `followed_type` — and drop the default.

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

**Prototype state:** Matchmaking is not implemented. All four dashboards carry a non-functional "Matchmaking" nav item with a match-count badge, purely so the concept is visible in demos. The two widgets that *do* render ("New Distributor Matches" on the winery dashboard, "New Winery Matches" on the distributor dashboard) use hardcoded fit percentages. Nothing here is a blueprint — build it from this section, not from the mockup.

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

Both halves of the supply chain are real orders in the same table, distinguished only by `buyer_type` / `seller_type`. A distributor is the seller on one row and the buyer on another. **Restaurant and Retail can only ever buy from a Distributor** (A3); a Distributor buys from a Winery.

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
**Client Events** / **My Events** for a role's own occasions (B8).

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

Own events carry no such promise and need no release.

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
| `planning` | **Venue + at least one exhibitor + at least one product confirmed** | Publicly listed, but anonymised — see A16.6 |
| `pending_approval` | Distributor submits | Bottle Lobby staff review |
| `changes_requested` | Staff decline **with a written reason** | Back to the distributor, who amends and resubmits. Not terminal |
| `published` | Staff release | Full details public, invitations can go out |
| `completed` | After the event date | Moves to history on every participant's profile |
| `cancelled` | Host | All confirmed parties notified |
| `rescheduled` | Host sets a new date | **All exhibitor, venue and attendee confirmations reset to pending** |

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

### A16.6 Two levels of visibility

This is the rule that protects everyone involved.

**From `planning` — anonymised.** Title, date, city and thematic focus only:
*"Wine Show Rioja · 5 Dec 2026 · Düsseldorf · premium reds."* Neither
producers, nor products, nor the exact venue are named.

**From `published` — full.** Exhibitors, their products, the venue and the
programme are public.

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

### A16.8 Own events

Any of the four roles creates and manages these freely — no approval.
Invitations go to partnered stakeholders; the follow graph carries the
announcement further.

An event owner may additionally ask a producer or distributor to **sponsor**
the event or **join as an exhibitor**, which the invitee confirms or
declines. A retailer's vintage presentation with the winemaker present, or a
restaurant's winemaker dinner, are the typical shapes.

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

events            ( id, owner_id, owner_type, title, description,
                    event_date, location, hero_image_url, status )
event_invitations ( event_id FK, stakeholder_id FK,
                    role enum('guest','sponsor','exhibitor'),
                    status enum('invited','confirmed','declined') )
```

**Products are referenced, never copied** — `wine_show_products.product_id`
is a foreign key into `products`, owned by the producer (A1, A2). A show
lists which products are presented; it never holds product content.

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

- **Whether a show may enter `planning`** — derived live from venue,
  exhibitor and product confirmations, not a flag someone sets.
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
entry model belongs to own events (A16.8), where an owner may charge for
their own occasion. It must not migrate here: A16.5's waitlist exists because
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
(A16.4) and own events (A16.8).

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

`Overview → Commerce → My Portfolio → My Partners → Network → [role-specific] → Events / Tools → Account`

### The distributor sidebar

The distributor sidebar is split into **eight labelled nav-sections** in this order. This mirrors the live `#sidebar-distributor` markup in `bottle-lobby-dashboard.html` — the source of truth:

**1. Overview** — Dashboard · My Profile · Messages
**2. Commerce** — My Sales · My Purchases · Order History → all three open the **Orders sub-view** (A14.8) via `showDistributorOrders('incoming'|'outgoing'|'history')`, never a profile section
**3. My Portfolio** — My Wine Portfolio · My Labels · My Promo Materials · My Offers · My Deals
**4. My Partners** — My Partnerships (→ `dsection-active-partnerships`, grouped by region) · My Requests (→ `dsection-requests`)
**5. Network** — Matchmaking · My Opportunities · My Stars · My Fans
**6. Intelligence** — Trend Analytics · Portfolio Gaps · Market Reports
**7. Events** — Wine Shows · Client Events
**8. Account** — Settings

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

**Grouped sub-views render a tab bar; single-member ones don't.** Each role has its own `*_GROUPS` array. `D_GROUPS` defines the distributor's three grouped views — **My Portfolio** (Wine Portfolio · Labels · Promo Materials · Offers · Deals), **My Partners** (Partnerships · Requests) and **Network** (Opportunities · Stars · Fans). When the active section belongs to a group (`dGroupOf()`), a tab strip renders above the content in `#dprofile-tabs` using the **same `.ord-tab` styling as the Commerce (Orders) view**, with the current member marked active. Single-member sections (My Profile) render no tab bar. Matchmaking is not a group member — it is a non-functional demo nav item (A8), not a real section.

**"Preview Public Profile" appears on the My-Profile sub-page only** (`section === 'basics'`): the role's `*-topbar-actions-profile` group is shown there and hidden on every other sub-page. This holds for all four roles.

**Prototype blueprint:** `showDistributorView()`, the `D_SECTION_EL` / `D_NAV_EL` / `D_TITLES` maps, `D_GROUPS` + `dGroupOf()`, `#dprofile-tabs`, `openDistributorPublicPreview()` — all in `bottle-lobby-dashboard.html`. The other three roles carry the identical set under their own prefix: `W_*` / `#wprofile-tabs`, `R_*` / `#rprofile-tabs`, `T_*` / `#tprofile-tabs`, each with a `wGroupOf` / `rGroupOf` / `tGroupOf` lookup.

**Real build:** one route per section, with the group as the parent route segment — `/dashboard/portfolio/wines`, `/dashboard/partners/requests`. The tab bar is the group's layout; the sections are its children.

### The Winery sidebar

| # | Section | Nav items |
|---|---|---|
| 1 | Overview | Dashboard · My Profile · Messages |
| 2 | Commerce | My Sales · Order History |
| 3 | My Portfolio | My Wine Portfolio · My Press & Recognition |
| 4 | My Partners | My Distributors · My Requests |
| 5 | Network | Matchmaking · My Stars · My Fans |
| 6 | Market | Trend Reports · Consumer Data |
| 7 | Events | Wine Shows |
| 8 | Account | Settings |

**No "My Purchases"** — in this model a winery buys nothing on the platform (A3), so Commerce has two items, not three. **No Promo Materials / Offers / Deals** — those are distributor instruments aimed at restaurants and retailers (A9), not producer content. Branding & PR and Import Support keep their own **Services** section between Events and Account.

### The Restaurant sidebar

| # | Section | Nav items |
|---|---|---|
| 1 | Overview | Dashboard · My Profile · Messages |
| 2 | Commerce | My Purchases · Order History |
| 3 | My Portfolio | My Wine List |
| 4 | My Partners | My Distributors · My Requests |
| 5 | Network | Matchmaking · My Stars · My Fans |
| 6 | Discover | Browse Wines · Exclusive Offers · Exclusive Deals · Promo Materials |
| 7 | Tools | Wine List Builder · Food Pairing |
| 8 | Account | Settings |

**No "My Sales"** — a restaurant sells to guests, not on the platform. My Portfolio holds a single item and therefore renders no tab bar.

### The Retail sidebar

Identical to Restaurant, with three differences: **My Wine Selection** instead of My Wine List; **no Tools section**; and an own **Events** section holding **My Events** in position 7, ahead of Account.

> **"My Events" and "Wine Shows" are different things and must stay separate nav items.** Wine Shows are trade fairs; My Events are the retailer's own in-store occasions (an in-store tasting, a wine dinner with a restaurant, an oenologist evening). The distributor already draws this line with *Wine Shows* vs *Client Events*. **A16 is the section this docks into** — it specifies both and keeps them apart for the same reason: a Wine Show is released by Bottle Lobby staff, an own event never is.

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

### ⚠️ Two push channels — and which constraint applies to which

**From Claude Code: `git push`. No size limit, no special handling.** A local clone exists, `gh auth login` is set up, and a commit carries only the diff. `bottle-lobby-dashboard.html` is pushed this way like any other file. This is the default route for all substantial work.

**From Claude in chat: the GitHub MCP connector — and it has no patch or diff operation.** `create_or_update_file` and `push_files` always replace the **entire file**, and that content must pass through Claude's output. Cost therefore scales with file size, not with the size of the change. Measured 31 July 2026:

| File | Size | Via the connector |
|---|---|---|
| Variety pages | ~14–19 KB | Unproblematic |
| Wine article pages | ~29–31 KB | Unproblematic |
| Public profile pages, all 4 roles | ~48–68 KB | Fine |
| `BOTTLE-LOBBY-SPEC.md` | ~88 KB | Fine |
| `restaurant-profile.html`, `retail-profile.html` | ~100–101 KB | Expensive |
| `why-join.html`, `distributor-profile.html` | ~111 KB | Expensive |
| `winery-profile.html`, `profile-demo.html` | ~144–149 KB | Expensive — one per session at most |
| **`bottle-lobby-dashboard.html`** | **~473 KB** | **Not possible — exceeds a single response** |

**Fallback rule, chat sessions only:** when a chat session will make many changes to the large files above, work locally in the container and hand over the finished result — a single file, or a ZIP for multi-file work (max. 100 files per commit), which Serge uploads via GitHub's *Add file → Upload files*. This is an explicit, sanctioned exception, not a failure.

**Claude flags this proactively at the start of such a session** rather than discovering it halfway through — and states which channel it is on, since the answer differs entirely between Claude Code and chat.

> **Measured composition of the dashboard** (31 July 2026): ~186 KB markup, ~228 KB JavaScript, ~59 KB CSS. An earlier figure of ~170 / ~120 / ~43 KB was simply wrong — it did not even sum to the file size it claimed to describe. Extracting CSS and JS would leave the HTML at ~186 KB, still above what the connector handles comfortably; and with `git push` available the refactor has no motivation left at all (D15, D22). Measure before recommending a refactor.

## C4. Claude's active reminder duties

Claude proactively flags:
- **(a)** When a new permanent rule or architecture decision is made in-session that belongs in this spec → delivers the complete updated `BOTTLE-LOBBY-SPEC.md` as a file and explicitly reminds Serge to **replace** it in project knowledge (delete the old version).
- **(b)** When a session is heading toward heavy edits of the large files → proposes the local/manual-upload route up front (C3).
- **(c)** When two substantial changes would land in one handover → proposes splitting them, so a fault stays unambiguously attributable.

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

`tests/` is excluded from the deployed site in `netlify.toml` — the publish
directory is the repo root, so everything committed is served unless blocked.

**OpenArt limitation:** No true alpha-channel transparency — "transparent background" renders a visible checkerboard as image content. Workaround: match the exact background hex in the prompt, or use chroma-key green (`#00FF00`) for external removal.

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
holds yesterday's data, possibly without fields today's code expects. Two guards,
neither relying on anyone remembering anything: a `VERSION` constant for
deliberate invalidation, and a **shape fingerprint per collection computed from
the pristine fixtures** — add a field to `bottle-lobby-data.js` and the
fingerprint changes by itself, because the fixture is always the shape the new
code expects. A mismatch discards **everything, all or nothing**, and says so in
the toast. A partial restore would leave a half-migrated demo, which is worse
than starting clean. A snapshot that breaks rendering is thrown away and the page
reloads once.

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
