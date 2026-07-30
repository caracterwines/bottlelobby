# HANDOFF — Sitzungsstand

> Nur das, was Git nicht selbst weiss: offene Punkte, naechste Schritte, laufende Entscheidungen.
> Dateiliste, Dateianzahl und Aenderungshistorie stehen in der Git-Historie — nicht hier.
> Dauerhafte Regeln stehen in `BOTTLE-LOBBY-SPEC.md`, kurze Invarianten in `CLAUDE.md` — nicht hier.

**Letzte Aktualisierung:** 30. Juli 2026

---

## Infrastruktur

| | |
|---|---|
| Repo | `caracterwines/bottlelobby`, Branch `main` |
| Hosting | Netlify-Projekt `bottlelobby` |
| Live | https://bottlelobby.netlify.app |
| Deploy | automatisch bei jedem Push auf `main` (~5 s) |

Kein Build-Command, Publish-Directory = Repo-Root.

---

## Zuletzt abgeschlossen

- Migration von ZIP-Workflow auf GitHub + Netlify; Schreibzugriff des Connectors eingerichtet
- Bestellsystem gebaut: gemeinsames `orders`-Modell ueber beide Haelften der Lieferkette
- Auftragsverwaltung als eigene Unteransicht im Distributor-Dashboard (Liste + Detail,
  Dokumente, Zahlung, Versand, Marge, automatische Deal-/Promo-Erkennung)
- Dokumentationsstruktur konsolidiert: Spec im Repo + Projektwissen, `CLAUDE.md` im Repo-Root,
  Anhang D (ueberholte Entscheidungen) und Anhang E (Ablagen) angelegt
- Distributor-Sidebar: Orders-Sektion nach oben zwischen "Overview" und "My Profile" verschoben,
  umbenannt in **Commerce**; "Incoming Orders" → **My Sales**, "My Orders" → **My Purchases**
- Spec B8 auf die reale 8-Sektionen-Distributor-Sidebar synchronisiert (Commerce statt Orders,
  My Portfolio statt Promotion); Anhang D um **D16** (Orders→Commerce) und **D17**
  (Promotion→My Portfolio) ergaenzt

---

## Offene Punkte

### Arbeit
- **Winery-, Restaurant- und Retail-Dashboard** auf dieselbe Orders-Unteransicht heben,
  die der Distributor jetzt hat. Aktuell haben sie nur die einfachen Karten-Sektionen.
  Dabei auch die Sektions-Aufteilung und die "My ___"-Namenskonvention angleichen.
- **Datenarrays auslagern** nach `assets/bottle-lobby-data.js`, kommentiert als Schema-Vorlage
  fuer den Supabase-Bau. Bewusst noch nicht gemacht, damit Fehler eindeutig zuzuordnen bleiben.
- **Bestandspruefung** im Auftragsdetail gegen das Wine Portfolio des Distributors
  (Spec A14.9) — braucht zuerst ein Lagerbestandsfeld; eine erfundene Zahl waere ein
  Verstoss gegen A1.
- **Uebersichts-Widgets:** Winery und Distributor haben auf ihrer Startuebersicht noch
  kein Orders-Widget (Restaurant und Retail schon).
- **Domain:** `caracterwines.de` steht noch, obwohl die Firma korrekt "Caracter Media GmbH" heisst.

---

## Hinweise fuer Claude

- `bottle-lobby-dashboard.html` ist ~415 KB und **nicht pushbar**. Immer lokal bauen,
  `node --check` auf den Script-Block, DOM-Stub-Harness fuer die Logik, dann als
  einzelne Datei zur manuellen Uebergabe.
- Vor jeder Uebergabe: div/tag-Balance UND Verschachtelung pruefen, doppelte IDs,
  onclick-Funktionen definiert, CSS-Klassen-Cross-Check.
- Weinnamen muessen exakt zwischen `orders`, `promoMaterials` und `exclusiveDeals`
  uebereinstimmen, sonst greifen die automatischen Erkennungen stillschweigend nicht.
