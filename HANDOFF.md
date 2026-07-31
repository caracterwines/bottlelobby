# HANDOFF — Sitzungsstand

> Nur das, was Git nicht selbst weiss: offene Punkte, naechste Schritte, laufende Entscheidungen.
> Dateiliste, Dateianzahl und Aenderungshistorie stehen in der Git-Historie — nicht hier.
> Dauerhafte Regeln stehen in `BOTTLE-LOBBY-SPEC.md`, kurze Invarianten in `CLAUDE.md` — nicht hier.

**Letzte Aktualisierung:** 31. Juli 2026

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
  My Portfolio statt Promotion) und um die Sub-Page-Mechanik ergaenzt (jeder Nav-Punkt eine
  eigene Unterseite via `showDistributorView`, Reiterleiste bei Mehrfach-Gruppen, Preview nur
  auf My Profile); Anhang D um **D16** (Orders→Commerce), **D17** (Promotion→My Portfolio)
  und **D18** (Scrollseite→Unterseiten) ergaenzt
- **Orders-Unteransicht fuer alle vier Rollen.** Statt vier Kopien ein Modul, parametrisiert
  ueber `ORDER_ROLES` (Entitaet, ID-Praefix, Seite, Reiter, Marge-Flag); die Huelle baut
  `orderShellHtml()`, deshalb waechst die Datei trotz drei neuer Auftragsverwaltungen kaum
  (+305/−303 Zeilen). Reiter folgen der Position in der Lieferkette: Winery My Sales,
  Restaurant/Retail My Purchases, Distributor beides. Kaeuferseite hat jetzt eigene KPIs
  (In Transit / To Pay / Spend) und im Detail "Cancel Order" bzw. "Reorder". Die alten
  Kartenlisten samt `orderCardHtml`/`paintOrders` sind raus, Badges und Uebersichts-Widgets
  bleiben. Dokumente tragen den Briefkopf des jeweiligen Verkaeufers (`SELLER_PROFILES`).
  Spec A14.8/A14.9 und B8 nachgezogen, Anhang D um **D19** ergaenzt.
- **Orders-Widget auf der Startuebersicht von Winery und Distributor** ("Open Sales",
  ueber der ersten Widget-Reihe). `orderWidgetRow` ist jetzt perspektivabhaengig:
  Verkaeufer sehen "Ordered by {Kunde}", Kaeufer weiterhin "Via {Lieferant}".
  Sortierung zeigt offene Bestaetigungen zuerst, maximal drei Zeilen.
- **Sidebar-Angleich fuer Winery, Restaurant und Retail.** Alle vier Rollen haben jetzt
  dieselbe Sektionsfolge (Overview → Commerce → My Portfolio → My Partners → Network →
  rollenspezifisch → Events/Tools → Account), dieselbe "My ___"-Konvention und dieselbe
  Unterseiten-Mechanik: je Rolle ein `*_SECTION_EL` / `*_NAV_EL` / `*_TITLES` / `*_GROUPS`-Satz,
  Reiterleiste bei Mehrfach-Gruppen, "Preview Public Profile" nur noch auf My Profile.
  Die beiden Anfrage-Richtungen liegen pro Rolle in einer gemeinsamen **My Requests**-Sektion
  (eingehend oben), wie beim Distributor. Spec B8 deckt jetzt alle vier Rollen ab,
  A6 nachgezogen, Anhang D um **D21** ergaenzt.
- **"My Stars" / "My Fans" gelten jetzt in allen vier Rollen** — "Wine Stars" und "Wine Fans"
  sind weg, und die "My ___"-Konvention ist nicht mehr distributor-only. Neu angelegt:
  My Stars bei der Winery, My Fans bei Restaurant und Retail; alle vier Rollen rufen jetzt
  beide generischen Renderer. Spec A7 auf eine einheitliche Tabelle umgestellt,
  Anhang D um **D20** ergaenzt.

---

## Offene Punkte

### Arbeit
- **Wine Shows als eigener Spec-Abschnitt** — naechstes grosses Thema. Der Distributor legt
  eine Messe an, Hersteller treten als Aussteller bei, Restaurant und Retail als Location
  oder Teilnehmer, Freigabe durch Bottle-Lobby-Staff. Die Nav-Punkte sind dafuer schon sauber
  getrennt: **Wine Shows** = Messen (Winery, Distributor), **Client Events** / **My Events**
  = eigene Veranstaltungen (Distributor, Retail). Diese Trennung nicht wieder einebnen.
- **Marge-Block fuer die Winery** bleibt bewusst aus (`ORDER_ROLES.winery.margin = false`):
  es gibt kein Feld fuer Produktionskosten, eine geschaetzte Zahl waere ein A1-Verstoss.
  Anschalten, sobald echte Kostendaten existieren.
- **Datenarrays auslagern** nach `assets/bottle-lobby-data.js`, kommentiert als Schema-Vorlage
  fuer den Supabase-Bau. Bewusst noch nicht gemacht, damit Fehler eindeutig zuzuordnen bleiben.
- **Bestandspruefung** im Auftragsdetail gegen das Wine Portfolio des Distributors
  (Spec A14.9) — braucht zuerst ein Lagerbestandsfeld; eine erfundene Zahl waere ein
  Verstoss gegen A1.
- **Domain:** `caracterwines.de` steht noch, obwohl die Firma korrekt "Caracter Media GmbH" heisst.

---

## Hinweise fuer Claude

- `bottle-lobby-dashboard.html` ist ~415 KB. Ueber **git push** ist das kein Problem —
  die alte Notiz "nicht pushbar" galt dem MCP-Connector, der immer die ganze Datei
  ersetzt. Immer lokal bauen und pruefen: `node --check` auf den extrahierten
  Script-Block, dann das DOM-Stub-Harness fuer die Logik.
- Vor jeder Uebergabe: div/tag-Balance UND Verschachtelung pruefen, doppelte IDs,
  onclick-Funktionen definiert, CSS-Klassen-Cross-Check.
- Weinnamen muessen exakt zwischen `orders`, `promoMaterials` und `exclusiveDeals`
  uebereinstimmen, sonst greifen die automatischen Erkennungen stillschweigend nicht.
