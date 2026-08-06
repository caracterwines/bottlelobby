# Bottle Lobby — Project Instructions

B2B SaaS platform for the drinks trade, by Caracter Media GmbH.
Four stakeholder types: **Producers · Distributors · Restaurants · Retail**.
Wine is the launch category; the model must support other beverage categories (see below).

---

## ⚠️ Read this first

**`BOTTLE-LOBBY-SPEC.md` in this repo is the complete specification.**
Read it before designing any database schema, API route, or feature. It contains the
data model, the ownership rules, the workflows and the reasoning behind them.

This file only holds the invariants that must never be violated. When they and
anything else disagree, these win.

---

## What is in this repo right now

A **static HTML/CSS/vanilla-JS prototype** — an investor and stakeholder demo,
deployed at https://bottlelobby.netlify.app.

**It is a mockup, not a foundation.** It fakes relational links by duplicating content
across files. Read it for visual design and for behaviour logic; never port its
structure. The real build is Next.js + Supabase, written fresh.

The most useful thing in it is `bottle-lobby-dashboard.html`: its JavaScript data
arrays are effectively a working draft of the schema, and its interaction logic is a
blueprint. Every spec section ends with a "Prototype blueprint" pointer to the
relevant functions.

---

## Invariants

**1. Single source of truth.**
Whatever a stakeholder enters lives in exactly ONE place, owned by whoever entered it.
Everywhere else references it live. Never store a copy — not of products, awards, press,
reviews, media, or free text. An edit at the source updates everything, immediately,
with no separate action anywhere.

**2. Products belong to the producer.**
Distributors, restaurants and retailers get a foreign-key relation to the producer's
product record. They never create or own product data. `order_items.product_id` is a
reference, never a copy.

**3. The supply chain has no shortcuts.**
`Producer → Distributor → Restaurant / Retail`, and a distributor may also buy from
another distributor (A3 *Where a distributor sources*) — that lengthens the middle of
the chain, it does not open a shortcut.
Restaurants and Retail source **exclusively** via a Distributor partner. Direct
producer-to-restaurant sourcing does not exist in this model. Their "add product" action
is a picker over a connected distributor's portfolio — never a creation form.

**4. Master data is never free text.**
Every product attribute comes from centrally maintained tables, per category, with
cascades where the domain cascades (Country → Region → Appellation). Every cross-feature
match depends on products being the same *record*, not the same string.

**5. Build category-capable from day one.** *(spec A15)*
`producers.producer_type` (winery, distillery, brewery …), `categories`, per-category
`attribute_defs`, and `product_components` with an optional percentage — grape varieties,
grain bills, botanicals and base fruits are ONE concept, not four.
**Ship the interface wine-only.** Enabling spirits later must be inserting rows and
unhiding a filter, never a migration. Do NOT hard-wire "wine" into schema, queries or
routes — but do keep the visible labels ("Wine Guide", "Wine Shows", "Own Label")
wine-specific until the business decides otherwise.

**6. Partnership activation is admin-gated.**
`sent → accepted → contract_pending → active`. The final step is a manual confirmation
by Bottle Lobby staff after both signed contracts are received. This cannot be
automated away — it is the control point that enforces the exclusivity model.
An active partnership gates everything commercial, including the ability to order.

**7. Derived state is computed, never stored.**
Promo unlock status, deal free-goods entitlement, deal discount thresholds, Guide
facet counts, component hub statistics — all computed live from the underlying tables.
A stored flag goes stale the moment an input changes.
Two deliberate exceptions, both the same shape — a figure someone has already relied on
is a record, not a view: an **issued invoice PDF is frozen and archived** because it is a
legal record (A14.5), and a **catering contribution is pinned at the moment the producer
consents to it** (A16.11), so that a third party dropping out cannot raise what somebody
already agreed to pay.

**8. One order record, two perspectives.**
Buyer and seller read the same row and render it from their own side. Never two copies,
never a sync step. `order_events` is append-only and is the audit trail.

---

## Conventions

- Page content and code comments: **English**
- Conversation with Serge: **German**
- Company name is always **Caracter Media GmbH** (never "Caracter Wines GmbH")
- Commit messages: short, English, conventional-commit style (`feat:`, `fix:`, `chore:`)
- In Claude Code, push via **git** (`gh auth login` is set up) — never the GitHub MCP
  connector. The connector is the fallback for Claude in chat, where no local repo exists;
  it always replaces the whole file and is therefore many times more expensive.

---

## Other files

| File | Contents |
|---|---|
| `BOTTLE-LOBBY-SPEC.md` | The full specification — architecture, data model, conventions |
| `HANDOFF.md` | Open items and next steps only. Never rules. |

**Appendix D of the spec lists superseded decisions.** Those are history, not
instructions — never reintroduce them. If something in Appendix D looks like a good
idea, read why it was dropped before proposing it again.

**Sections A1–A14 are written in wine vocabulary** because wine is the launch category.
A15 defines how "winery" generalises to *producer* and "wine" to *product*. Build the
schema per A15; read the rest with that mapping in mind.
