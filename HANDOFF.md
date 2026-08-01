# HANDOFF — Sitzungsstand

> Nur das, was Git nicht selbst weiss: offene Punkte, naechste Schritte, laufende Entscheidungen.
> Dateiliste, Dateianzahl und Aenderungshistorie stehen in der Git-Historie — nicht hier.
> Dauerhafte Regeln stehen in `BOTTLE-LOBBY-SPEC.md`, kurze Invarianten in `CLAUDE.md` — nicht hier.

**Letzte Aktualisierung:** 1. August 2026

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

- **A16.11, Durchgang 1 — Location-Anfrage und Bepreisung** (A16.11 Schritte 1–2).
  Restaurant und Retail haben jetzt eine eigene Wine-Shows-Unteransicht; `SHOW_ROLES`
  hat vier Eintraege und drei `side`-Werte (host · producer · venue). Der Distributor
  fragt eine partnerschaftliche Location an, die nennt EINEN Preis fuer Raum und
  Catering, der Betrag landet im Show-Datensatz und der Host liest ihn dort — Chip
  „Venue quoted €X" auf seiner Listenzeile, kein stiller Vorgang. Neu abgeleitet:
  `venueTurn()`, `venueSettled()` (eine bloss angefragte Location erfuellt die
  Readiness NICHT mehr), `isMyVenue()`, `isShowParticipant()`, `showAwaits()` als
  einzige Antwort fuer Sortierung/Chip/KPI/Badge.
  **Die Korrektur mittendrin, und der eigentliche Ertrag des Durchgangs:** Restaurant
  und Retail sehen *alle* oeffentlich sichtbaren Shows, nicht nur die, bei denen sie
  Location sind — sie sind die Nachfrageseite (neu: **A16.0**). Die erste Fassung
  filterte ueber `venueEntity` und haette genau das Publikum ausgesperrt, fuer das
  eine Show stattfindet.
  **Drei Lecks, alle beim Bauen gefunden, keins davon offensichtlich:** der
  History-Trail zeigte jeder Seite alles (Location las die Ausstellerliste, Winzer
  las den Location-Preis) → `visibleTrail()`; die Listenzeile zeigte Location und
  Weinzahl auch bei anonymisierten Shows; die Suche traf Produzentennamen in
  anonymisierten Shows, war also ein Nachschlagewerk fuer genau das, was A16.6
  zurueckhaelt. Neues Harness `tests/venue-request.js`, gegen zehn Mutationen
  verifiziert.
- **A16.11 „Catering settlement" — Spec zuerst, Bau folgt.** Neun Schritte von der
  Location-Anfrage bis zur Staff-Freigabe, der **verbindliche Punkt** (erste Zusage
  oder Angebotsannahme, abgeleitet — kein Flag) und was er sperrt, vier Regeln gegen
  die Neuberechnungs-Schleife bei Winzer-Ausfall, und die Empfehlung, den Beitrag als
  `orders`-Datensatz zu fuehren. Mitgezogen: **A16.5** (Vokabular host/venue, vierter
  Modus `fixed_per_product` als Standard), **A16.2** (`cancelled`/`rescheduled` ab dem
  verbindlichen Punkt gesperrt), **A16.9** (Beitragsfelder auf der Aussteller-Zeile,
  Status `lapsed`), **A16.10** (berechnet bis zur Zusage, danach Obergrenze),
  **A3** (Warenfluss ≠ Geldfluss), **A14.3/.5/.7/.8** (Service-Auftrag,
  `settled_otherwise`, keine Versand-KPIs), **CLAUDE.md** Invariante 7 (zweite
  Ausnahme). Anhang D um **D24–D26** ergaenzt.
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
- **Weinwahl auf einer Show ist beidseitig** (A16.4, Anhang D **D23**). Wer einen Wein
  vorschlaegt, die andere Seite bestaetigt ihn — in beide Richtungen. `saveCounter`
  schrieb bisher einseitig `confirmed`, der Host wurde nie gefragt. Neu: der Host hat
  einen eigenen Kasten "Wines Awaiting Your Confirmation" mit Confirm/Decline, der
  Winzer einen zustandsabhaengigen Kasten (Einladung / eigener Vorschlag wartet /
  Host hat abgelehnt / beidseitig einig). Eine Weinablehnung beendet nie die Teilnahme.
  Wer am Zug ist, berechnet `exhibitorTurn()` aus `proposedBy` + `status` — Badges,
  Sortierung, Listen-Chip und Aussteller-Chips lesen alle dieselbe Funktion, damit
  beide Seiten nie widersprechen (A16.10).
  **Miterledigt:** die Sackgasse, dass ein Winzer ohne benannten Wein bestaetigen
  konnte — `products` blieb leer, `showReadiness` sah nie einen Wein, die Show hing
  dauerhaft in `draft`. Es gibt jetzt keinen "Confirm"-Knopf ohne Wein mehr, sondern
  "Choose a wine & confirm"; Zusage und Weinwahl sind ein Schritt.
- **A16.7, Durchgang 0 — Datenauslagerung.** `wineShows` und der oeffentliche
  Renderer liegen jetzt in `assets/bottle-lobby-data.js` und
  `assets/bottle-lobby-public-shows.js`; das Dashboard laedt sie als klassische
  Scripts (keine Module — `file://` blockt die). Sichtbar aendert sich nichts
  ausser dem neuen Hero-Bild-Feld im Create-Show-Modal (`heroImage`, A16.9,
  Auswahl ueber `images/` mit Vorschau). Damit koennen die oeffentlichen Seiten
  in den naechsten Durchgaengen dieselben Datensaetze und **denselben**
  `publicShowCard()` lesen, statt sie 21-fach zu kopieren.
  **Der riskante Teil war die Testinfrastruktur** — siehe unten.
  Spec A16.7 und A16.12 nachgezogen.
- **A16.7, Durchgang 1 — die oeffentliche Wine-Shows-Seite.** Neuer Abschnitt
  „What's Coming" **unter** der Case Study (die Seite muss das Format erklaeren,
  bevor echte Termine etwas bedeuten), Vergangenes darunter, Detailschicht klappt
  auf. Gerendert aus denselben Datensaetzen und demselben `publicShowCard()` wie
  die Dashboard-Vorschau. Neu im geteilten Renderer: `publicShowTeaser()` fuer
  die Karte mit Hero-Bild und `publicShows()` fuer die Frage, welche Shows ein
  Fremder ueberhaupt gelistet sieht — `draft` und `pending_approval` gar nicht.
  **Die CSS musste mitwandern** (`assets/bottle-lobby-public-shows.css`): ein
  geteilter Renderer mit kopiertem Stylesheet haette die Drift nur von der
  Struktur in die Optik verschoben. Die Dashboard-Vorschau zeigt jetzt Karte
  **und** Listing, also genau das, was die oeffentliche Seite baut.
  Neues Harness `tests/public-shows-page.js` — die erste oeffentliche Seite
  ueberhaupt mit Pruefungen. Gegen vier Mutationen verifiziert.
- **A16.7, Durchgang 2 — der Wine-Shows-Reiter auf 15 oeffentlichen Profilen.**
  Winery- und Distributor-Seiten trugen dort erfundene Veranstaltungen; jetzt
  steht in jeder Datei nur noch `<div class="ws-profile-shows"
  data-entity="…">`, alles andere kommt aus den geteilten Assets.
  **Die inhaltliche Entscheidung des Durchgangs:** ab wann ein Beteiligter
  genannt werden darf. Der Host ab `planning` — er kuendigt die Show an, und
  A16.6 schuetzt Produzenten, Weine und Location, nicht den Ankuendiger. Der
  Aussteller erst ab `published`, **auch wenn er laengst zugesagt hat**: die
  anonymisierte Show ist oeffentlich gelistet, und stuende ihr Titel auch auf
  dem Profil des Produzenten, verriete das Zusammenlesen beider Seiten genau
  das, was A16.6 zurueckhaelt. Ergebnis in der Demo: Bodegas Ruiz und Weingut
  Schmitt sind bei Grande Rioja bestaetigt und erscheinen dort nirgends.
  Sechs Profile listen Shows, neun zeigen den Leerzustand — denselben, den
  Restaurant und Retail schon hatten. A16.7 um die Rollentabelle ergaenzt.
  Neues Harness `tests/profile-shows.js` faehrt alle 15 Seiten. Gegen drei
  Mutationen verifiziert.
- **A16.7, Durchgang 3 — Follow-Graph als Ankuendigungskanal. A16.7 ist damit
  komplett.** Widget **From Your Stars** auf allen vier Uebersichten, auch bei
  Restaurant und Retail: A16.7s eigenes Beispiel ist ein Restaurant, das einer
  Winery folgt, und das ist genau die Rolle, die weder hosten noch ausstellen
  kann. Der Feed ist die **dritte oeffentliche Flaeche** und fragt deshalb
  dieselbe `publicParticipation()` wie Wine-Shows-Seite und Profile — wer einem
  bei einer anonymisierten Show bestaetigten Produzenten folgt, erfaehrt nichts;
  wer dem Host folgt, erfaehrt ab `planning` davon.
  **Neue Demo-Kante mit Absicht:** Weinhaus Mueller folgt Bodegas Ruiz, die bei
  Grande Rioja bestaetigt sind — der Feed bleibt leer. Ohne dieses Paar liefe
  `tests/follow-feed.js` ins Leere, deshalb faellt es durch, wenn die Kante
  verschwindet. A16.7 und A16.12 nachgezogen.
- **Spec-Pflege 31.07.:** C3 unterscheidet jetzt die beiden Push-Kanaele (git aus Claude Code
  ohne Groessengrenze, MCP-Connector mit) statt pauschal "nicht pushbar"; Dateigroessen neu
  gemessen; Anhang D nach D18/D19 sortiert und um **D22** ergaenzt; der ueberholte
  Vorwaertsverweis in B8 zeigt jetzt auf A16.

---

## Offene Punkte

### Arbeit
- **CACHE: praktisch erledigt, aber nicht durch eine Konfiguration.** Am 31.07.
  live gegengeprueft: alle Dateien liefern `public, max-age=0, must-revalidate`,
  und die neue Fassung kam **ohne** Cache-Buster durch.
  **Wichtig fuer den naechsten, der hier sucht:** `netlify.toml` hat *keinen*
  `[[headers]]`-Block und hatte nie einen — der Header ist Netlifys Standard
  fuer HTML. Es wurde also nichts konfiguriert, es war von Anfang an so.
  Damit ist auch die urspruengliche Beobachtung (nach einem Push kam die alte
  Fassung, erst `?cb=1` half) nicht durch einen fehlenden Header erklaert,
  sondern vermutlich durch den Browser-Cache. Ein `[[headers]]`-Block waere
  weiterhin moeglich, aendert aber nichts am gemessenen Ergebnis — er wuerde
  nur festschreiben, was Netlify ohnehin tut.
- **LATENT: `exhibitorTurn()` kuerzt bei mehreren Weinen ab.** Die Funktion sagt
  "irgendein `confirmed` Wein → niemand am Zug". Liegt neben einem bestaetigten Wein
  ein weiterer Vorschlag, ist der fuer beide Seiten unsichtbar — kein Kasten, kein
  Chip, kein Badge. Heute nicht erreichbar, weil ein Aussteller genau einen Wein
  fuehrt und der Winzer nach der Einigung keinen Knopf mehr hat.
  **Wird erreichbar, sobald ein Aussteller mehrere Weine praesentieren kann** — und
  das sieht A16.4 ausdruecklich vor ("three wineries with two wines each"). Dann muss
  `exhibitorTurn` pro Wein statt pro Aussteller antworten, und die Kaesten muessen
  mehrere offene Vorschlaege zeigen koennen. Nicht vergessen, wenn der Mehr-Wein-Fall
  gebaut wird.
- **OEFFENTLICH: Spec, HANDOFF und CLAUDE.md sind unter der Demo-Domain abrufbar**
  (`bottlelobby.netlify.app/BOTTLE-LOBBY-SPEC.md` → 200), weil das Publish-Directory
  das Repo-Root ist. Das GitHub-Repo ist ohnehin oeffentlich, eine Netlify-Sperre
  gewinnt also wenig — trotzdem eine bewusste Entscheidung wert, weil dort das
  vollstaendige Geschaeftsmodell steht. `netlify.toml` koennte sie mit derselben
  Redirect-Regel wie `/tests/*` ausschliessen.
- **A14.7 hatte keine „abweichend vereinbart"-Stufe** — entgegen der Annahme bei der
  A16.11-Entscheidung. Die Kette war `not_invoiced → invoiced → partial → paid` plus
  abgeleitetes `overdue`, mehr nicht. `settled_otherwise` ist mit A16.11 **neu
  angelegt** worden, nicht bloss weiterverwendet: ohne sie blockiert eine
  ausserhalb der Plattform beglichene Rechnung die Show-Freigabe dauerhaft.
  Im Prototyp fehlt sie noch — `PAY_LABEL` kennt sie nicht.
- **Kein Rueckweg aus `planning`.** Wird ein bereits beidseitig bestaetigter Wein
  spaeter abgelehnt, faellt `showReadiness` auf `false`, die Show bleibt aber in
  `planning` und rutscht nicht nach `draft` zurueck. A16.2 kennt keinen Rueckweg,
  und einen zu erfinden waere ueber den Auftrag hinausgegangen. Entweder A16.2 um
  eine Ruecknahme ergaenzen oder bewusst festhalten, dass `planning` einmal erreicht
  bestehen bleibt — offene Entscheidung, kein Fehler.
- **Zwei tote CSS-Klassen: `.profile-badge` und `.badge-own-label`.** Beide werden
  im Markup benutzt (17 bzw. 10 Elemente), sind aber nirgends definiert — Reste der
  Vor-B9-Konvention, als `.profile-badge` noch der Name fuer das war, was heute
  `.badge` heisst. **Kein sichtbarer Defekt:** alle betroffenen Elemente setzen
  `background`, `color` und `font-size` inline, sehen also richtig aus.
  Zum Aufraeumen sind zwei Entscheidungen noetig, und beide sind optisch, deshalb
  liegen sie bei euch: bleiben die Inline-Styles und die Klassennamen fallen
  ersatzlos weg, oder wandern die Werte in echte Regeln und die Inline-Styles raus?
  17 Elemente sind betroffen, das Ergebnis ist in der Demo sichtbar.
  Solange nichts entschieden ist, verwaltet `check-static.js` sie in
  `KNOWN_UNSTYLED` — mit Pruefung in beide Richtungen, die Liste kann das Problem
  also nicht ueberleben.
- **DIE GROESSTE OFFENE LUECKE: die Bestellliste aus A16.0.** Waehrend der Show
  Bestellungen von Restaurants und Retailern einsammeln und daraus EINE
  Sammelbestellung beim Winzer machen — das ist der Zweck der Wine Show, und A14
  kennt davon nichts: kein show-basierter Auftrag, kein Konsolidierungsschritt, keine
  Verbindung von `wine_shows` zur entstehenden `orders`-Zeile. Braucht eine eigene
  Entscheidung vor dem Bau. Bis dahin traegt die Plattform den *Anlass*, aber nicht
  das *Instrument*.
- **Wine Shows — die naechsten Durchgaenge.** Gebaut sind der erste Dashboard-Durchgang,
  **A16.7 vollstaendig** und **A16.11 Schritte 1–2** (Location-Anfrage + Bepreisung).
  Offen: Open Call mit Master-Data-Filtern (A16.4), Teilnehmer-Einladungen und
  Warteliste (A16.5), eigene Events (A16.8), die Bestellliste oben — und die
  **Catering-Abrechnung ab Schritt 3**: Modus + Satz, Versand der Beitraege, die
  verbindlichen Bestaetigungen mit A6-Mechanik, Rechnung und Zahlung.
  **Beim naechsten Durchgang nicht vergessen:** `showAwaits()` zaehlt ein
  vorliegendes Location-Angebot bewusst NICHT als Aufgabe des Hosts, weil er es noch
  nicht annehmen kann. Sobald die verbindliche Annahme existiert, gehoert
  `venueTurn(show) === 'host'` dort hinein — die Stelle ist im Code so kommentiert.
  Restaurant und Retail bekommen ihre Wine-Shows-Unteransicht erst mit den Location-
  und Teilnehmer-Schritten — deshalb hat `SHOW_ROLES` bisher nur zwei Eintraege, und
  deshalb bleiben ihre sieben Profilseiten beim handgeschriebenen Leerzustand.
  Ihre Dashboards haben den Feed aber schon.
- **Die vierte Flaeche kommt bestimmt.** Show-Sichtbarkeit haengt jetzt an genau
  einer Funktion, `publicParticipation()`, und drei Flaechen fragen sie: oeffentliche
  Seite, Profile, Feed. Suche, Matchmaking-Vorschlaege oder eine E-Mail-Benachrichtigung
  waeren die naechsten — **sie muessen dieselbe Funktion fragen.** Wer stattdessen
  „Shows, an denen mein Stern teilnimmt" implementiert, baut den einen Ort, an dem
  A16.6 nicht gilt. Steht so in A16.6 und A16.7.
- **Der `Simulate Bottle Lobby release (demo)`-Knopf muss weg**, sobald es eine
  Admin-Oberflaeche gibt. Er steht nur da, weil der Prototyp kein Staff-Panel hat,
  ist als Demo beschriftet und nennt daneben den echten Weg. Im Investorengespraech
  ist die Freigabe das Verkaufsargument (A16.1) — nicht als Provisorium praesentieren.
- **Catering-Abrechnung: entschieden und spezifiziert (A16.11), noch nicht gebaut.**
  Offen sind dort nur noch drei Punkte, zwei davon nicht von uns entscheidbar:
  die **Rechtswirkung der Klick-Bestaetigung** (Jurist, plus die Frage, ob der
  Distributor eine unterschriebene Angebotsannahme braucht), **grenzueberschreitende
  Umsatzsteuer** auf den Beitrag, und die **`orders`-Empfehlung** aus A16.11 —
  Catering-Beitrag als `orders`-Datensatz mit `source: 'wine_show'` statt eigener
  Tabelle. Die ersten beiden Bau-Durchgaenge (Location-Anfrage, Bepreisung) haengen
  nicht daran; der Rechnungs-Durchgang schon.
  **Tickets bleiben draussen** — bezahlter Eintritt gehoert zu eigenen Events (A16.8),
  steht jetzt ausdruecklich so in A16.11.
- **Marge-Block fuer die Winery** bleibt bewusst aus (`ORDER_ROLES.winery.margin = false`):
  es gibt kein Feld fuer Produktionskosten, eine geschaetzte Zahl waere ein A1-Verstoss.
  Anschalten, sobald echte Kostendaten existieren.
- **Datenarrays auslagern — angefangen, nicht fertig.** `wineShows` liegt in
  `assets/bottle-lobby-data.js`, weil A16.7 es brauchte. Alle uebrigen Arrays
  stehen weiter im Dashboard. Der Weg ist jetzt gebahnt und getestet
  (`tests/load-dashboard.js`), das naechste Array ist also billig — aber
  jeweils ein eigener Durchgang, damit Fehler zuzuordnen bleiben.
- **Bestandspruefung** im Auftragsdetail gegen das Wine Portfolio des Distributors
  (Spec A14.9) — braucht zuerst ein Lagerbestandsfeld; eine erfundene Zahl waere ein
  Verstoss gegen A1.
- **Domain:** `caracterwines.de` steht noch, obwohl die Firma korrekt "Caracter Media GmbH" heisst.

---

## Hinweise fuer Claude

- **Alle Pruefungen liegen in `tests/`** und brauchen einmalig
  `cd tests && npm install` (nur jsdom). Danach ist **`npm test` der komplette
  Durchlauf** — `check-static.js` zuerst (Syntax, doppelte IDs, div-Balance und
  Verschachtelung, onclick, CSS-Cross-Check, Enum-Klassen), dann die vier
  Verhaltens-Harnesses. Nichts davon muss noch von Hand nachgebaut werden.
  `tests/node_modules/` ist git-ignoriert, `netlify.toml` sperrt `/tests/*` auf
  der Live-Seite. Neue Zusicherungen gehoeren dorthin, nicht in den Scratchpad
  (Spec C7) — und eine neue Pruefung erst als fertig melden, wenn sie an einer
  absichtlich kaputten Kopie auch wirklich fehlschlaegt.

- `bottle-lobby-dashboard.html` ist ~473 KB (31.07. nachgemessen). Ueber **git push**
  ist das kein Problem — die Groessengrenze gilt allein dem MCP-Connector, der immer
  die ganze Datei ersetzt. Spec C3 unterscheidet die beiden Kanaele jetzt sauber.
  Immer lokal bauen und pruefen: `node --check` auf den extrahierten Script-Block,
  dann das DOM-Stub-Harness fuer die Logik.
- **`.ws-*` und `.wse-*` sind zwei verschiedene Praefixe.** Der Klassen-Cross-Check
  muss beide erfassen — sonst faellt eine fehlende Statusklasse durch (siehe oben).
- **jsdom laedt `<script src>` nicht.** Mit den Optionen, die alle Harnesses
  benutzen, wird ein externes Script geparst und **nie ausgefuehrt** — ohne
  Warnung. Deshalb lesen alle Harnesses die Seite jetzt ueber
  `tests/load-dashboard.js`, das die Assets in Dokumentreihenfolge einsetzt.
  `check-static.js` sah davor gar nichts: sein Regex traf nur nacktes
  `<script>`, ausgelagerter Code fiel also aus jeder Strukturpruefung heraus.
  **Jede kuenftige Auslagerung muss ueber diesen Loader gehen.** Ausfuehrlich
  in `tests/README.md`.
- **Zwei Vorschaeden in `invite-render.js` mitrepariert:** die Datei rief nie
  `process.exit(fail ? 1 : 0)` und wertete gesammelte jsdom-Fehler nicht aus.
  Sie ist seit jeher mit 0 beendet worden, egal was sie fand — jede Zusicherung
  darin war fuer `npm test` folgenlos, nur ein echter Absturz kam durch.
  Falls jemand eine dortige Pruefung fuer bestanden hielt: das war sie nicht.
- Vor jeder Uebergabe: div/tag-Balance UND Verschachtelung pruefen, doppelte IDs,
  onclick-Funktionen definiert, CSS-Klassen-Cross-Check.
- Weinnamen muessen exakt zwischen `orders`, `promoMaterials` und `exclusiveDeals`
  uebereinstimmen, sonst greifen die automatischen Erkennungen stillschweigend nicht.
