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
- **Wine Shows im Prototyp, erster Durchgang** — bewusst schmal, aber durchgaengig:
  Distributor legt eine Show an (Modal mit Location-Wahl und Kapazitaet), laedt einen
  Aussteller gezielt ein (optional mit Wunschwein aus dessen eigenem Sortiment), die
  Winery bestaetigt, lehnt ab oder bestaetigt mit einem anderen Wein. Liste und Detail
  nach dem Muster der Orders-Ansicht, getrieben von `SHOW_ROLES` — gleiche Form wie
  `ORDER_ROLES`, vorerst nur zwei Rollen. Der Uebergang `draft → planning` wird aus dem
  Datensatz berechnet (Location + bestaetigter Aussteller + bestaetigter Wein) und als
  Checkliste angezeigt, nicht per Hand geschaltet. Beide Sichtbarkeitsstufen aus A16.6
  stehen im Detail nebeneinander, aus einem Datensatz gerendert. Weine sind
  Referenzen in `partnerWinesPool`, nie Kopien. Spec um A16.12 (Prototyp-Stand) ergaenzt.
- **Spec-Abschnitt A16 "Wine Shows & Events"** angelegt (nach A15, vor Teil B). Trennt Messen
  mit Staff-Freigabe von eigenen Veranstaltungen ohne Freigabe, definiert Lifecycle,
  Aussteller-Einladung und Open Call, Location/Catering-Aufteilung, Warteliste, die zwei
  Sichtbarkeitsstufen (ab `planning` anonymisiert, ab `published` vollstaendig) und die
  Tabellen. Anhang D bleibt unberuehrt — es wird nichts abgeloest. A1 verweist jetzt auf A16
  als ausgearbeitetes Beispiel des Single-Source-of-Truth-Musters.
- **"My Stars" / "My Fans" gelten jetzt in allen vier Rollen** — "Wine Stars" und "Wine Fans"
  sind weg, und die "My ___"-Konvention ist nicht mehr distributor-only. Neu angelegt:
  My Stars bei der Winery, My Fans bei Restaurant und Retail; alle vier Rollen rufen jetzt
  beide generischen Renderer. Spec A7 auf eine einheitliche Tabelle umgestellt,
  Anhang D um **D20** ergaenzt.
- **Spec-Pflege 31.07.:** C3 unterscheidet jetzt die beiden Push-Kanaele (git aus Claude Code
  ohne Groessengrenze, MCP-Connector mit) statt pauschal "nicht pushbar"; Dateigroessen neu
  gemessen; Anhang D nach D18/D19 sortiert und um **D22** ergaenzt; der ueberholte
  Vorwaertsverweis in B8 zeigt jetzt auf A16.

---

## Offene Punkte

### Arbeit
- **UNGEKLAERT: Aussteller-Einladung greift im Browser moeglicherweise nicht.**
  Beim Durchklicken der Live-Seite blieb "Exhibitors & Wines" nach `saveInvite()`
  leer. Weder im jsdom-Harness noch beim statischen Lesen des Codes reproduzierbar.

  **Geprueft und ausgeschlossen — nicht erneut abklopfen:**
  - Alle drei Klickpfade im Harness bis auf DOM-Ebene: der Aussteller steht danach
    im Datensatz UND im gerenderten Kasten.
  - *Leeres Producer-Dropdown* (frueherer Verdacht 3): **widerlegt.** 5 Winery-Partner,
    jede der fuenf Shows hat noch 3-5 einladbare uebrig. Der Toast "Pick a producer
    first" kann gar nicht ausgeloest werden.
  - *Modal-Klasse*: alle sechs Aufrufe schalten `active`, `.modal-overlay.active
    { display:flex }` existiert, konsistent mit allen 42 Modal-Schaltungen der Datei.
  - *CSS*: alle im Aussteller-Kasten benutzten Klassen sind definiert, keine mit
    `display:none`. Relevant, weil jsdom kein CSS auswertet — ein gruenes Harness
    schliesst eine reine Sichtbarkeitsursache nicht aus.

  **Kontext zum Klickpfad:** Von den fuenf Demo-Shows ist nur WS-2604 "Sicilia Prima"
  (`draft`) ohne Aussteller, und sie steht ganz oben — nur dort erscheint ueberhaupt
  "No exhibitors invited yet". Der `+ Invite Exhibitor`-Knopf existiert nur bei
  `draft`, `planning` und `changes_requested`.

  **Naechster Schritt:** Hard Reload (Cmd-Shift-R), einladen, dann in der Konsole:
  `({rolle: activeShowRole, offen: showState[activeShowRole].openId, eingeladenAuf: inviteShowId, daten: wineShows.map(s => s.id+' '+s.stage+' ['+s.exhibitors.map(e=>e.producer+':'+e.status).join(' | ')+']')})`
  Steht der Aussteller in `daten`, der Kasten bleibt aber leer -> Render-Problem.
  Steht er nicht drin -> `saveInvite` laeuft nicht durch. Damit ist es in einem
  Durchgang eingegrenzt.
- **`.wse-applied` ist nicht definiert** — es gibt nur `wse-invited`, `-confirmed`,
  `-declined`, `-proposed`. Folgenlos, bis A16.4 (Open Call) den Status `applied`
  einfuehrt. Der Klassen-Cross-Check hatte `.ws-*` geprueft und das Praefix `wse-`
  dabei nicht erfasst.
- **Wine Shows — die naechsten Durchgaenge.** Der erste ist gebaut (siehe unten),
  der Rest steht noch aus, jeder als eigener Schritt und keiner vom anderen blockiert:
  Open Call mit Master-Data-Filtern (A16.4), Location-Anfrage an Restaurant/Retail
  samt Bestaetigung (A16.5), Catering-Aufteilung, Teilnehmer-Einladungen und Warteliste,
  eigene Events fuer alle vier Rollen (A16.8), und die Darstellung auf den oeffentlichen
  Profilen und der Website (A16.7). Restaurant und Retail bekommen ihre
  Wine-Shows-Unteransicht erst mit den Location- und Teilnehmer-Schritten —
  deshalb hat `SHOW_ROLES` bisher nur zwei Eintraege.
- **Der `Simulate Bottle Lobby release (demo)`-Knopf muss weg**, sobald es eine
  Admin-Oberflaeche gibt. Er steht nur da, weil der Prototyp kein Staff-Panel hat,
  ist als Demo beschriftet und nennt daneben den echten Weg. Im Investorengespraech
  ist die Freigabe das Verkaufsargument (A16.1) — nicht als Provisorium praesentieren.
- **Catering-Abrechnung und Tickets** sind in A16.11 bewusst offen gelassen und
  brauchen eine Entscheidung, bevor der Catering-Schritt gebaut wird.
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

- `bottle-lobby-dashboard.html` ist ~473 KB (31.07. nachgemessen). Ueber **git push**
  ist das kein Problem — die Groessengrenze gilt allein dem MCP-Connector, der immer
  die ganze Datei ersetzt. Spec C3 unterscheidet die beiden Kanaele jetzt sauber.
  Immer lokal bauen und pruefen: `node --check` auf den extrahierten Script-Block,
  dann das DOM-Stub-Harness fuer die Logik.
- **`.ws-*` und `.wse-*` sind zwei verschiedene Praefixe.** Der Klassen-Cross-Check
  muss beide erfassen — sonst faellt eine fehlende Statusklasse durch (siehe oben).
- Vor jeder Uebergabe: div/tag-Balance UND Verschachtelung pruefen, doppelte IDs,
  onclick-Funktionen definiert, CSS-Klassen-Cross-Check.
- Weinnamen muessen exakt zwischen `orders`, `promoMaterials` und `exclusiveDeals`
  uebereinstimmen, sonst greifen die automatischen Erkennungen stillschweigend nicht.
