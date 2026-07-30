# Bottle Lobby — Project Instructions

B2B SaaS platform for the wine trade, by Caracter Media GmbH.
Four stakeholder types: **Wineries · Distributors · Restaurants · Retail**.

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
Everywhere else references it live. Never store a copy — not of wines, awards, press,
reviews, media, or free text. An edit at the source updates everything, immediately,
with no separate action anywhere.

**2. Wines belong to the winery.**
Distributors, restaurants and retailers get a foreign-key relation to the winery's wine
record. They never create or own wine data. `order_items.wine_id` is a reference,
never a copy.

**3. The supply chain has no shortcuts.**
`Winery → Distributor → Restaurant / Retail`.
Restaurants and Retail source **exclusively** via a Distributor partner. Direct
winery-to-restaurant sourcing does not exist in this model. Their "add wine" action is
a picker over a connected distributor's portfolio — never a creation form.

**4. Master data is never free text.**
Vintage, Grape Variety, Country, Region, Appellation, Aging Duration and Aging Method
come from centrally maintained tables. Country → Region → Appellation cascades.
Every cross-feature match depends on wines being the same *record*, not the same string.

**5. Partnership activation is admin-gated.**
`sent → accepted → contract_pending → active`. The final step is a manual confirmation
by Bottle Lobby staff after both signed contracts are received. This cannot be
automated away — it is the control point that enforces the exclusivity model.
An active partnership gates everything commercial, including the ability to order.

**6. Derived state is computed, never stored.**
Promo unlock status, deal free-goods entitlement, deal discount thresholds, Wine Guide
facet counts, variety hub statistics — all computed live from the underlying tables.
A stored flag goes stale the moment an input changes.
The one deliberate exception: an **issued invoice PDF is frozen and archived**, because
it is a legal record.

**7. One order record, two perspectives.**
Buyer and seller read the same row and render it from their own side. Never two copies,
never a sync step. `order_events` is append-only and is the audit trail.

---

## Conventions

- Page content and code comments: **English**
- Conversation with Serge: **German**
- Company name is always **Caracter Media GmbH** (never "Caracter Wines GmbH")
- Commit messages: short, English, conventional-commit style (`feat:`, `fix:`, `chore:`)

---

## Other files

| File | Contents |
|---|---|
| `BOTTLE-LOBBY-SPEC.md` | The full specification — architecture, data model, conventions |
| `HANDOFF.md` | Open items and next steps only. Never rules. |

**Appendix D of the spec lists superseded decisions.** Those are history, not
instructions — never reintroduce them. If something in Appendix D looks like a good
idea, read why it was dropped before proposing it again.
