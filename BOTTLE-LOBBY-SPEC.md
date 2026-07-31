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

**Semantics:** A follow adds the target to the follower's own "My Stars" list AND adds the follower to the target's "My Fans" list, generically across all pairings. The followed party gets a "X started following you" dashboard notification.

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
  source       enum('manual','reorder','deal','offer','promo'),
  placed_at,
  tax_mode     enum('net','vat'),          -- per order, see A14.6
  vat_rate, discount_pct, shipping_cost,
  carrier, tracking, eta,
  ship_status  enum('not_shipped','packing','in_transit','partial','delivered'),
  internal_note                            -- seller-only, never shown to the buyer
)

order_items (
  order_id FK, wine_id FK→wines,           -- reference, never a copy
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

### A14.6 Tax

`tax_mode` is set **per order**, not per account, because the same distributor sells domestically and across borders:

- `net` → reverse charge; VAT line shows 0.00 and the footer states "VAT to be accounted for by the recipient"
- `vat` → VAT line calculated at `vat_rate`

Wine-specific extras for the real build: excise duty number on documents, deposit (Pfand) handling, and country-of-destination VAT rules for cross-border sales.

### A14.7 Payment

`not_invoiced` → `invoiced` → `partial` → `paid`, with `overdue` **derived from the due date**, not stored as a stage. Payments are rows in `order_payments`, so partial payments accumulate naturally and the outstanding amount is always `total − sum(payments)`. A prepayment flag on the order blocks dispatch until paid in full.

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

### A16.3 Hosts

A show belongs to **one or more distributors**. Co-hosting requires an
active Distributor↔Distributor partnership (A6, A8) — the same gate as any
other joint commercial act. One host is the **lead** and submits for
approval; all hosts appear as organisers.

### A16.4 Exhibitors

Exhibitors are **producers** (A15). A distributor gets them two ways:

**Direct invitation** to a specific producer, optionally naming a wanted
product. The producer confirms, declines, or **confirms with a different
product** — the selection is a proposal, not an instruction.

**Open call** to a filtered set of the distributor's partnered producers.
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

**Venue** is either the distributor's own premises or a **partnered**
restaurant or retailer, by request. Hosting requires an active partnership;
attending does not.

The venue host sets a **catering contribution** (food and drink), settled
one of three ways:

| Mode | Effect |
|---|---|
| `split_by_products` | Divided across exhibitors **by number of products presented** — an exhibitor showing two wines carries twice the share of one showing a single wine |
| `host_covers` | The distributor pays it |
| `free` | The venue waives it, treating the show as its own marketing |

**Attendees** are restaurants and retailers. They are invited by the host,
or they find shows in their region and **request to attend without any
existing partnership** — a Wine Show is an entry point into the network,
not only an instrument between existing partners.

The host sets a **capacity**. Requests beyond it join a **waitlist** and
move up automatically when someone withdraws. Turning applicants away
outright would discard exactly the interest the show exists to create.

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

### A16.7 Where shows and events appear

**On the public profile (A11) of every participant** — host, exhibitor,
venue and attendee alike — as upcoming and, after `completed`, as history.
A winery's profile showing three fairs it presented at is a credential.

**Through the follow graph (A7).** Following an account subscribes you to
its appearances: a restaurant following a winery is notified when that
winery exhibits somewhere or holds its own event. This makes the follow
graph a distribution channel, not just a matchmaking signal.

**On the public website.** Shows in `planning` and `published` appear on the
Wine Shows page as cards with the hero image the distributor uploads when
creating the show, plus date, title and city, linking to a full listing.

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
  catering_mode enum('split_by_products','host_covers','free'),
  catering_total, capacity, menu_url,
  staff_note                       -- reason on changes_requested
)

wine_show_hosts      ( show_id FK, distributor_id FK )
wine_show_exhibitors ( show_id FK, producer_id FK,
                       status enum('invited','applied','confirmed','declined'),
                       source enum('invitation','open_call','producer_request') )
wine_show_products   ( show_id FK, producer_id FK, product_id FK → products,
                       proposed_by enum('host','producer'),
                       status enum('proposed','confirmed','declined') )
wine_show_open_calls ( show_id FK, producer_type_id, country_id, region_id,
                       appellation_id, component_id )   -- all nullable
wine_show_attendees  ( show_id FK, stakeholder_id FK,
                       status enum('invited','requested','confirmed',
                                   'declined','waitlisted') )
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

### A16.10 Computed, never stored

- **Whether a show may enter `planning`** — derived live from venue,
  exhibitor and product confirmations, not a flag someone sets.
- **A producer's catering share** — `catering_total × (own products ÷ all
  products)`, recomputed whenever the line-up changes.
- **Waitlist position** — derived from request order and current capacity.
- **What a given viewer sees** — computed from `stage` and the viewer's role,
  per A16.6. Never two stored versions of the same show.

### A16.11 Still open

- **Payment flow for the catering contribution.** The split is defined; how
  it is invoiced is not. Likely an order document (A14.5) between venue and
  exhibitors, but that needs deciding.
- **Ticketing or attendance fees** — not modelled. Shows are currently free
  to attend.

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

> **"My Events" and "Wine Shows" are different things and must stay separate nav items.** Wine Shows are trade fairs; My Events are the retailer's own in-store occasions (an in-store tasting, a wine dinner with a restaurant, an oenologist evening). The distributor already draws this line with *Wine Shows* vs *Client Events*. A future spec section will make Wine Shows a first-class feature — created by a distributor, producers joining as exhibitors, restaurants and retailers as venue or attendee, released by Bottle Lobby staff. Keep the two nav items apart so that section has a clean place to dock.

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

### ⚠️ The one real constraint — and when to fall back to manual upload

The GitHub connector has **no patch or diff operation**. `create_or_update_file` and `push_files` always replace the **entire file**, and that content must pass through Claude's output. Cost therefore scales with file size, not with the size of the change.

| File | Size | Verdict |
|---|---|---|
| Variety pages, wine article pages | ~10–27 KB | Unproblematic |
| Winery / distributor public profiles | ~40–68 KB | Fine |
| `restaurant-profile.html`, `retail-profile.html` | ~99–101 KB | Expensive |
| `why-join.html`, `distributor-profile.html` | ~110 KB | Expensive |
| `winery-profile.html`, `profile-demo.html` | ~144–148 KB | Expensive — one per session at most |
| **`bottle-lobby-dashboard.html`** | **~415 KB** | **Cannot be pushed at all** |

> The dashboard exceeds what fits in a single response. Any change to it is built locally and handed over as **that one file**, which Serge uploads via GitHub's *Add file → Upload files*.
>
> **Measured composition:** ~170 KB markup, ~120 KB JavaScript, ~43 KB CSS. Extracting CSS and JS into separate files would leave the HTML at ~170 KB and therefore **still unpushable** — which is why that refactor was assessed and rejected rather than assumed to help. Measure before recommending a refactor.

**Fallback rule:** when a session will make many changes to the large files above, work locally in the container and hand over the finished result — a single file, or a ZIP for multi-file work (max. 100 files per commit). This is an explicit, sanctioned exception, not a failure.

**Claude flags this proactively at the start of such a session** rather than discovering it halfway through.

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
| JS verification | `node --check` on the extracted script block, plus a DOM-stub harness for logic tests |

**OpenArt limitation:** No true alpha-channel transparency — "transparent background" renders a visible checkerboard as image content. Workaround: match the exact background hex in the prompt, or use chroma-key green (`#00FF00`) for external removal.


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
| D15 | Proposal to split `bottle-lobby-dashboard.html` into separate CSS and JS files so Claude could push it directly | **C3** — rejected after measuring | The file is ~170 KB markup, ~120 KB JS, ~43 KB CSS. Extracting CSS and JS leaves the HTML at ~170 KB — still unpushable. The refactor would have carried real risk for no gain. **Do not re-propose without measuring again.** |
| D16 | Distributor sidebar had a fourth-position **"Orders"** section with items "Incoming Orders / My Orders / Order History" | **B8** — renamed **"Commerce"** and promoted to second position, directly under Overview; items renamed **My Sales / My Purchases / Order History** | "Orders" undersold the commercial core and sat too low in the sidebar. "Commerce" reads as the primary workspace, and the buyer/seller-neutral "My Sales / My Purchases" pair names each direction plainly. Routing into the Orders sub-view (A14.8) is unchanged. |
| D17 | Distributor Promo Materials, Offers and Deals sat in their own **"Promotion"** nav section (the move recorded in D11) | **B8** — consolidated under the **"My Portfolio"** section, alongside My Wine Portfolio and My Labels | With Commerce promoted to the top, the remaining seller-owned instruments read more coherently as one "what I carry and how I promote it" group than as a thin standalone section. Supersedes the "Promotion" section named as the answer in D11; D11 remains valid history of the earlier My Profile → Promotion move. |
| D19 | Winery, Restaurant and Retail read their orders in card-list sections inside the profile page (`wsection-orders-in`, `rsection-orders`, `tsection-orders` …); Restaurant and Retail called their nav item **"My Orders"** | **A14.8** — all four roles use the same two-level Orders sub-view, driven by the `ORDER_ROLES` registry; the buying roles' nav item is now **"My Purchases"** | The card list could show an order but not work one: no payment, documents, shipping or line editing. Parameterising the existing sub-view rather than copying it keeps one implementation for a model that is one record seen from two sides (invariant 8). "My Purchases" makes the same act carry the same name in every role — the distributor already used it for buying, and "My Orders" no longer denotes anything specific there (D16). |
| D18 | Distributor dashboard profile was one long scrolling page; nav items were scroll targets to sections within it (the general case of D12, which covered Orders) | **B8** — every nav item opens its own discrete sub-page via `showDistributorView()`, showing exactly one section and hiding the rest; grouped views add an `.ord-tab` tab bar | A single scroll page made deep sections hard to reach and mixed unrelated content on screen at once. Discrete sub-pages give each area a clean working surface, consistent with the Orders sub-view (A14.8, D12). |
| D20 | The follow feature carried a different label per role: the winery showed **"Wine Fans"** and no follow list at all, Restaurant and Retail showed **"Wine Stars"** and no fan list, and only the distributor used **My Stars / My Fans**. The "My ___" convention was declared **Distributor-only** | **A7** — one uniform pair, **My Stars / My Fans**, in all four roles, both directions always shown; the "My ___" convention now applies everywhere (B8) | The follow graph is a single symmetric relation between any two stakeholder types (A7). Three names for two directions made it read as three separate features, and hiding one direction per role hid data that already existed — a winery follows accounts, a restaurant has followers. Wine-themed labels also tied a category-neutral relation to wine, against invariant 5. Note the direction of travel: the *convention* generalised, the *exception* did not survive. |
| D21 | Winery, Restaurant and Retail sidebars had one combined **"Network"** section, unprefixed labels (Basic Information, Wine Portfolio, Active Distributors, Distributor Requests …), an Orders section low in the list, and profile nav items that were scroll targets rather than sub-pages | **B8** — the same eight-section structure, the same "My ___" convention and the same sub-page mechanics as the distributor, minus whatever a role has nothing for | Four dashboards that behaved differently taught the user four navigations for one product, and the divergence was accidental — the distributor was simply rebuilt first (D16, D17, D18). Merging the two request directions into one **My Requests** section per role also removed a real inconsistency: the same partnership record was reachable under two different section names depending on who sent it. |

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
