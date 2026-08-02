# HANDOFF — Sitzungsstand

> Nur das, was Git nicht selbst weiss: offene Punkte, naechste Schritte, laufende Entscheidungen.
> Dateiliste, Dateianzahl und Aenderungshistorie stehen in der Git-Historie — nicht hier.
> Dauerhafte Regeln stehen in `BOTTLE-LOBBY-SPEC.md`, kurze Invarianten in `CLAUDE.md` — nicht hier.

**Letzte Aktualisierung:** 2. August 2026

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

- **02.08.: Messages-Kette, Durchgang 2a — die Ableitung. Spec C9 geschrieben.**
  **Die Oberflaeche fehlt noch** (siehe „Offene Punkte" → 2b). Was steht:
  `notificationsFor(role)` liefert die Liste je Rolle, abgeleitet aus Orders,
  Show-Ereignissen, Anfragen und Follow-Graph; `notifUnread()` / `notifMarkAllSeen()`
  darueber. Der **Lesezeiger `notifSeen`** ist im `BLStore.register`-Block und das
  einzige Gespeicherte — Ids, keine Nachrichten.
  **Bedingung 2 im Datensatz statt in einer Textheuristik:** `logShow()` nimmt ein
  viertes Argument `scope`. Nur `scope:'show'` (Stage-Wechsel) geht an alle
  Beteiligten; die 24 uebrigen Log-Zeilen sind Kanten-Ereignisse und werden gar
  nicht gelesen. „Bistro Laurent invited to attend" erreicht Bodegas Ruiz damit
  nie — Serges Gegenbeispiel, jetzt strukturell ausgeschlossen statt per Filter.
  **Ein eigener Fehler, von der Probe gefunden:** die erste Fassung filterte
  Klasse 2 ueber `showsForRole()`. Das ist fuer Restaurant und Retail bewusst
  **weit** (A16.0, Nachfrageseite sieht alle oeffentlichen Shows) — Weinhaus
  Mueller bekam dadurch „Grande Rioja auf planning", eine Show ohne jede
  Beziehung zu ihm. Genau die Verletzung, gegen die Bedingung 2 geschrieben ist,
  und sie stand in meinem eigenen Code. Jetzt entscheidet `notifHasEdge()`;
  „darf ich es sehen" und „habe ich eine Beziehung dazu" sind zwei Fragen.
  **Neue Fixture WS-2605 „Rhein & Main Selection"** (Frankfurt, `planning`) — der
  einzige Regional-Fall in den Daten, weil jedes Haus in seiner eigenen Stadt
  sonst schon Location ist. Gemessen: der Eintrag nennt Titel, Datum, Stadt,
  Ausrichtung und **weder Aussteller noch Location**. Bewusst spaet datiert, sonst
  verdraengt sie „Nordic Selection" aus dem Stars-Feed und `follow-feed.js` faellt
  aus einem Grund um, der nichts mit ihr zu tun hat.
  Vier Harnesses zaehlten Shows hart und wurden nachgezogen (nicht bloss
  hochgezaehlt: `venue-request.js` benennt die neue Show jetzt).
  **Noch offen aus Durchgang 1:** die Show-Kanten sind nicht datiert — Aussteller,
  Weinvorschlaege und `venueStatus` haben kein `at`, nur `attendees[].at`. Fuer
  Klasse 1 faellt das nicht auf, weil `showAwaits()` einen Zustand beantwortet und
  kein Datum braucht. Sobald eine Kante ein Datum zeigen soll, ist es ein Thema.
- **02.08.: Messages-Kette, Durchgang 1 — die Felder, aus denen Benachrichtigungen
  abgeleitet werden koennen (Groundwork zu C9).** Rein mechanisch; sichtbar aendert
  sich nur das Datumsformat. Drei Quellen konnten die zwei Fragen, die eine
  Benachrichtigung stellt — **wer** und **wann** —, nicht beantworten:
  `logEvent(o, actor, text)` fuehrt jetzt einen Actor (17 Aufrufstellen; der
  Verkaeufer wird **explizit uebergeben statt angenommen**, damit die erste
  kaeuferseitige Aktion die Frage beantworten muss), `buildInitialLog()` gibt auch
  seinen drei synthetisierten Eintraegen einen, der Follow-Graph traegt `at`
  (16 Kanten), und die sieben Anfragedaten liegen in ISO statt im dritten
  Anzeigeformat („18 July 2026"). Auf dem Schirm gilt damit **ein** Datumsformat
  statt drei, gerendert ueber `orderDate()`.
  **Ein Eigenfehler im neuen Harness, gefunden bevor er zaehlte:** die Pruefung
  „eine Live-Aktion schreibt ihren Actor" rief `acceptOrder()` auf — eine Funktion,
  die gar nichts loggt — und pruefte danach den „confirmed"-Eintrag aus
  `buildInitialLog()`, also eine Fixture. Sie war gruen, ohne irgendetwas Lebendes
  zu belegen. Laeuft jetzt ueber `confirmOrder()`, zaehlt die Eintraege
  vorher/nachher und nennt den gelesenen Actor im Output, damit „gruen" nicht
  wieder heissen kann „nichts geprueft". Der Befund zu `acceptOrder()` selbst
  steht unter „Offene Punkte" und gehoert in Durchgang 2.
  Neues Harness `tests/notification-sources.js` — 13 statt 12.
  Im echten Chrome gegengeprueft (alle sieben Anfragezeilen formatiert, kein rohes
  ISO, kein `—`-Fallback). Veraltete `localStorage`-Staende brauchten nichts:
  `actor` und `at` aendern den Shape-Fingerprint, der Snapshot wird verworfen.
- **02.08. (nach Serges Browser-Test): Der Ausloeser war falsch gebaut — behoben.**
  Serge meldete, dass beim Anlegen einer Show nichts gespeichert wird, waehrend
  `BLStore.save()` von Hand sofort schreibt. **Im echten Chrome (lokal und live,
  ueber das DevTools-Protokoll gefahren) liess sich genau dieser Fall nicht
  nachstellen** — der Klick auf „Create Show →" blubbert nach `saveShow()` und
  speichert. Die Suche danach foerderte aber zwei echte Fehler zutage, die beide
  exakt Serges Messungen erklaeren:
  1. **Aenderung ohne nachfolgendes Event wurde NIE gespeichert.** Der Ausloeser
     haing daran, dass nach der Aenderung noch ein Event kommt — Serges dritte
     Messung, woertlich. Behoben durch einen **Heartbeat alle 2 s**, der nicht
     fragt, *ob geklickt wurde*, sondern *ob der Speicher noch zum Zustand passt*.
     Persistenz an die Art der Ausloesung zu binden war der eigentliche Fehler.
  2. **Nach einem Leeren des localStorage schrieb der Store nie wieder**, weil er
     seinen letzten Schreibvorgang im Arbeitsspeicher merkte. Genau das, was man
     beim Testen von Persistenz als Erstes tut — Serges erste Messung, die er
     grosszuegig als „richtig, nichts geaendert" gelesen hatte. Sie war es nicht.
     Verglichen wird jetzt gegen den **Speicherinhalt selbst**. Eine gemerkte
     Kopie des Speicherstands ist eine zweite Wahrheit ueber den Speicher — A1,
     auf den Store selbst angewandt.
  Beides im echten Browser gegengeprueft, vorher und nachher.
  **Und die Zusicherung, die gefehlt hat:** `tests/persistence.js` hatte den
  Round-Trip geprueft, indem es die Aktion aufrief **und den Klick selbst
  hinterherschickte** — es bewies damit, dass der Store serialisieren kann, und
  nannte das „der Ausloeser funktioniert". Neu ist ein Abschnitt, der die
  **echten Knoepfe** drueckt und danach nichts mehr anfasst, plus ein Fall ganz
  ohne Event. Gegenprobe gemacht: mit der alten Logik faellt er um.
  Merksatz fuer aehnliche Faelle: **einem Mechanismus, der auf Events reagiert,
  nie das Event liefern, das er selbst bemerken soll.**
- **02.08.: Der Prototyp vergisst nichts mehr — `localStorage`-Persistenz (Spec C8).**
  Neu: `assets/bottle-lobby-store.js`. 20 Sammlungen ueberdauern den Reload
  (24,3 KB gemessen), die aktive Rolle und die geoeffnete Ansicht bewusst nicht —
  das Dashboard startet normal. **Kein Mutationspunkt ruft `save()`:** der Store
  hoert auf `document` in der Bubble-Phase und schreibt gebuendelt, weil sich im
  Prototyp nichts ohne Benutzeraktion aendert. **Kein Speichern-Knopf** (Serges
  Entscheidung: die Aktionen *sind* die Bestaetigung, ein zweiter Klick erfaende
  den Zustand „eingeladen, aber nicht gespeichert"), stattdessen eine dezente
  „Saved"-Quittung in der demo-bar — nur bei einem Schreibvorgang, der wirklich
  stattfand. `↺ Reset demo` sitzt oben rechts in derselben Leiste wie „View as:",
  bewusst nicht unten bei „+ Host Wine Show", wo er wie eine Produktfunktion
  aussaehe. Zwei Tabs aktualisieren sich ohne Reload; ist ein Modal offen oder
  liegt der Fokus in einem Feld, wird **weder gezeichnet noch eingelesen**, und die
  Aenderung landet, sobald der Tab frei ist.
  **Veraltete Staende koennen nicht mehr wie Code-Fehler aussehen:** neben einer
  `VERSION` gibt es einen Shape-Fingerprint je Sammlung, berechnet aus den
  *Fixtures* — kommt in `bottle-lobby-data.js` ein Feld dazu, aendert er sich von
  selbst. Abweichung heisst alles verwerfen, ganz oder gar nicht, mit Hinweis im
  Toast. Ein Stand, der das Rendern bricht, fliegt raus und die Seite laedt einmal neu.
  **Korrektur zur Bestandsaufnahme:** `wineFollowGraph` wird heute nirgends
  veraendert (fuenf Referenzen, alle lesend) — auf Serges Wunsch trotzdem
  registriert, damit My Stars / My Fans am Tag, an dem Folgen ein Knopf wird, nicht
  vergessen werden. Bis dahin ist die Persistenz dort wirkungslos.
- **02.08.: `tests/persistence.js` — 12 statt 11 Harnesses.**
  Die wichtigste Zusicherung ist die Isolation: `tests/load-dashboard.js` setzt
  `window.BL_NO_PERSIST` jetzt selbst, an der einen Stelle, durch die alle
  Harnesses gehen — kein bestehender Harness musste angefasst werden, und ein
  kuenftiger mit `url:` kann die Persistenz nicht stillschweigend wieder
  einschalten. Der Test faehrt jsdom bewusst *mit* URL, damit ein echtes
  `localStorage` existiert und der Kill-Switch etwas beweisen muss statt nur
  jsdoms Leere. Dazu: Round-Trip, Fingerprint-/Versions-/JSON-Schaden, Zwei-Tab,
  Tipp-Schutz, Reset. **Und eine Vollstaendigkeitspruefung:** jedes Top-Level-`let`
  in Dashboard und `data.js` ist entweder registriert oder steht mit Begruendung auf
  der Transient-Liste (39 klassifiziert: 20 + 19); ein mutiertes `const`-Array faellt
  ebenfalls auf. Gegenprobe gemacht — ein eingeschmuggeltes `let sneakyNewState = []`
  laesst den Harness rot werden.

- **Entschieden 01.08.: Teilnehmer erscheinen ab `completed` auf dem eigenen Profil**
  (Anhang D **D30**). A16.7 sagte „Host, Aussteller, Location und Teilnehmer
  **gleichermassen**" — das war vor der Teilnehmerliste geschrieben und zu weit
  gefasst, denn A16.5 Regel 4 haelt die Gaesteliste beim Host, und fuenfzehn Profile
  mit „ich bin dort" ergeben genau diese Liste. **Serges Begruendung, jetzt in der
  Spec:** die Anwesenheit ist eine eigene Tatsache des Teilnehmers, die er zeigen
  darf — aber erst, wenn sie keine Auskunft ueber die Gegenwart mehr gibt. Vorher ist
  „ich bin dort" eine Aussage ueber die Gaesteliste, danach eine ueber die eigene
  Vergangenheit. Damit bleibt der Credential-Gedanke von A16.7 erhalten und Regel 4
  gilt genau so lange, wie sie etwas schuetzt.
  A16.7 hat statt „gleichermassen" jetzt **eine Zeile je Rolle mit eigenem Zeitpunkt**
  (Host `planning`, Aussteller und Location `published`, Teilnehmer `completed`),
  A16.5 Regel 4 die zeitliche Grenze. Derselbe Mechanismus wie A16.6 — eine Regel,
  die auf einer Flaeche gilt und auf der anderen nicht, gilt gar nicht — nur ist die
  Grenze hier zeitlich statt raeumlich.
- **A16.12-Kette, Durchgang 3c — Zuruecklegen. Die Kette ist damit komplett.**
  Entscheidung je vorbestelltem Wein beim Abschluss: bestellen oder mit Begruendung
  zuruecklegen. Ohne Begruendung wird abgelehnt — eine Begruendung, die niemand
  beantworten kann, ist eine Ablage. Der Winzer liest sie in seiner eigenen
  Show-Ansicht, der Gast liest „Not ordered this time · your note is kept" und hat
  einen Withdraw daneben, `releaseHeldWine()` ist die gelungene Verhandlung.
  **Serges Rennen-Frage strukturell beantwortet:** platzierbar ist eine
  Vorbestell-Zeile erst, wenn sie **tatsaechlich bestellt** ist — nicht wenn der Host
  es vorhat. Damit kann Zuruecklegen nie eine platzierte Order kuerzen, und ein Host,
  der erst naechste Woche entscheidet, erzeugt dazwischen kein Risiko. Ist ein Wein
  einmal oben bestellt, wird Zuruecklegen nicht mehr angeboten; ab da ist ein Ausfall
  Sache des Winzers und laeuft ueber A14.
  **Drei Befunde beim Testen:** (1) der Gast verlor die zurueckgelegte Notiz, sobald
  er den Rest platziert hatte — der eine Zweig, in dem eine „aufbewahrte" Notiz
  stillschweigend aufhoerte, aufbewahrt zu sein; (2) meine Leck-Pruefung am
  Winzer-Kasten war ein **Fehlalarm** — sie schlug auf der Zahl an, die der Host
  selbst in seine Begruendung geschrieben hatte, und haette uns beigebracht, die
  falsche Regel zu lockern; sie prueft jetzt nur, was das System beitraegt;
  (3) der Riegel „platzierbar = bestellt" war ungetestet, weil der Status ihn
  ohnehin abdeckt — der Test baut den Zustand jetzt direkt, sonst liest er sich
  als toter Code und faellt beim naechsten Durchgang raus.
- **A16.12-Kette, Durchgang 3b — Abschluss und beide Order-Richtungen.**
  `closeShowOrderList()` legt **je Winzer eine Sammelbestellung** an, ausschliesslich
  aus der Vorbestell-Spalte, und oeffnet die Gaesteseite. Die vorbereitete Order ist
  **kein Datensatz**, sondern berechnet — die eigenen Bedarfsmeldungen des Gastes als
  Order dargestellt, die er selbst platziert; damit bleibt A14.2 unangetastet
  („Platzieren gehoert dem Kaeufer"). Vorkasse voreingestellt aus
  `prepaymentDefault()`, einmal bei Anlage ausgewertet. Ein Gast ohne aktive
  Partnerschaft wird **in der Aktion** abgewiesen, nicht nur um den Knopf gebracht.
  Abschluss beendet das Schreiben der Liste.
  **Serges Warnung ernstgenommen:** die Gesamtsumme (78 Flaschen) taucht auf dem
  Abschluss-Kasten nirgends auf, nur die Vorbestell-Zahl (54). Die Fixture setzt die
  beiden Zahlen bewusst weit auseinander, damit eine Verwechslung sichtbar statt
  plausibel waere. Der Spaltenfilter sitzt auf dem Einkaufspfad **doppelt** — eine
  einzelne Mutation blieb gruen, deshalb pruefen die Tests beide zugleich, und im
  Code steht, warum das keine Redundanz ist.
  **Nebenbei repariert:** `renderWineShows` stuerzte ab, wenn eine Aktion lief, bevor
  die Ansicht dieser Rolle je geoeffnet war (Konsole, Harness). Renderer duerfen
  still zurueckkehren (B12).
- **A16.12-Kette, Durchgang 3a — die zwei Spalten sichtbar.** `lineKind()` liest das
  Portfolio des Hosts und antwortet je Zeile „stock" oder „preorder"; nichts davon
  wird gespeichert, also wechselt ein aufgenommener Wein die Spalte von selbst.
  Gast sieht es in Klartext je Zeile, samt Lieferzeit **nur** an Vorbestell-Zeilen —
  „14 Tage" ueber einen Lagerwein waere derselbe Fehler in die andere Richtung.
  Beim Host steht `preorderTally()` getrennt: die Zahl, auf der die Erstbestellung
  beim noch nicht gelisteten Winzer ruht.
  **Fixture nach Vorgabe:** Mueller-Thurgau ins Portfolio, damit *Loire & Mosel*
  beide Spalten **nebeneinander** zeigt — auf zwei Shows verteilt waere die
  Unterscheidung da, aber nicht vorgefuehrt.
  `tests/order-list.js` um fuenf Abschnitte erweitert, gegen fuenf Mutationen
  verifiziert.
  **Zwei Eigenfehler unterwegs, beide gefunden:** ein fehlendes Anfuehrungszeichen
  (Syntaxfehler, sofort von `node --check` gefangen) und eine zu grob gefasste
  Zusicherung — `querySelectorAll('div')` traf verschachtelte Eltern, sodass die
  Pruefung „keine Lieferzeit an der Lagerzeile" aus dem falschen Grund haette
  bestehen koennen. Jetzt je Zeile ueber das eine Mengenfeld isoliert.
  `check-static` kennt jetzt auch IDs, die Skripte als Literal ins Markup schreiben
  (`ol-lead` war sonst faelschlich „fehlend").
- **A16.12-Kette, Durchgang 2 — die Bestellliste auf der Show.** Gast mit Platz
  traegt seine Mengen selbst ein, der Host am Stand fuer ihn (`enteredBy`), beide
  ueber dieselbe Funktion `writeInterest()`. Auszaehlung live: Haeuser **und**
  Flaschen, weil 60 Flaschen von einem und von sechs Kaeufern verschiedene Befunde
  sind. Richtpreis liegt auf dem Show-Produkt, nie am Weinstamm des Winzers.
  **Drei Sichtbarkeitsregeln, alle geprueft:** ein Gast sieht nur seine eigenen
  Zeilen, der **Winzer sieht die Auszaehlung gar nicht** (sie ist die
  Verhandlungsposition des Distributors), die oeffentliche Karte nichts davon.
  Schreiben darf nur, wer einen **Platz** hat — nicht die Warteliste, die nicht im
  Raum war. Neues Harness `tests/order-list.js`, gegen sieben Mutationen verifiziert.
  **Ein Eigenfehler dabei, der Erwaehnung verdient:** eine globale Umbenennung von
  `of-wine` traf die Offers-Form mit; `check-static` fing die doppelte ID, aber
  nicht den auf das falsche Element zeigenden Verweis. Repariert. Fuer die
  Offers-Form gibt es kein Verhaltens-Harness — das ist die eigentliche Luecke.
- **A16.12-Kette, Durchgang 1 — Teilnehmer und Warteliste (A16.5).** Host laedt ein
  oder beantwortet Anfragen, Restaurant/Retail fragen von der Besucheransicht aus
  einen Platz an, nehmen Einladungen an, springen wieder ab.
  **Der Kern ist, dass nichts gespeichert wird:** `attendeeQueue()` schneidet die
  bestaetigten Teilnehmer in Anfragereihenfolge bei `capacity` — die ersten sitzen,
  der Rest wartet. Ein Rueckzug befoerdert dadurch den Naechsten, ohne dass irgendwo
  etwas laeuft; das Harness prueft das haerter als noetig, indem es die Zeile des
  Beguenstigten **byteweise vergleicht**. `waitlisted` ist aus dem Enum raus
  (Anhang D **D28**), `withdrawn` neu — Abspringen und Abgelehntwerden sind
  verschiedene Tatsachen.
  Dazu die vierte A16.5-Regel: die Teilnehmerliste ist das Buch des Hosts. Kein
  Teilnehmer sieht einen anderen, die Location bekommt eine Kopfzahl, die
  oeffentliche Karte nennt niemanden. Neues Harness `tests/attendees.js`, gegen
  sieben Mutationen verifiziert.
  Demo-Fixture mit Absicht: WS-2603 hat `capacity: 3` — eine Show, deren Raum nie
  voll wird, kann das einzige Verhalten nicht zeigen, das A16.5 verspricht.
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
  Referenzen in `partnerWinesPool`, nie Kopien. Spec um den Prototyp-Stand-Abschnitt ergaenzt (heute A16.13).
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
  Spec A16.7 und der Prototyp-Stand nachgezogen.
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
  verschwindet. A16.7 und der Prototyp-Stand nachgezogen.
- **Spec-Pflege 31.07.:** C3 unterscheidet jetzt die beiden Push-Kanaele (git aus Claude Code
  ohne Groessengrenze, MCP-Connector mit) statt pauschal "nicht pushbar"; Dateigroessen neu
  gemessen; Anhang D nach D18/D19 sortiert und um **D22** ergaenzt; der ueberholte
  Vorwaertsverweis in B8 zeigt jetzt auf A16.

---

## Offene Punkte

### Arbeit

### ▶ MESSAGES existiert nicht — aufgefallen 02.08., noch nicht gebaut

**Befund.** Es gibt `bumpMsgBadge()` und `clearMsgBadge()` und sonst nichts: kein
Array, kein Postfach, keine einzige echte Nachricht. Beim Nachsehen kamen zwei
Punkte dazu, die Serges Beschreibung noch unterbieten:

- **Der Nav-Eintrag „Messages" hat in allen vier Rollen kein `onclick`.** Er ist
  nicht leer, er ist tot — ein Klick tut nichts.
- **Winzer und Distributor haben fest verdrahtete Badges (`2` und `3`) ganz ohne
  `id`.** `bumpMsgBadge()` kann sie also gar nicht erreichen; verkabelt sind nur
  Restaurant (`rmsg-badge`) und Retail (`tmsg-badge`).
- Das „Messages"-Widget auf der Winzer-Uebersicht ist **handgeschriebenes
  Markup** mit drei erfundenen Nachrichten — darunter ausgerechnet
  „Vinoteca Roma started following you" und eine Show-Bestaetigung. Beides
  Ereignisse, zu denen es laengst echte Datensaetze gibt (`wineFollowGraph`,
  `wineShows.events`). Das ist ein A1-Verstoss, der im Markup sitzt.
- „View All →" ist ebenfalls tot.

**Betroffene Zusagen:** A16.11 Schritt 5 (Catering-Nachricht), Weinrueckweisung
(A16.4), Partnerschaftsanfragen (A6), Follow-Ereignis (A7 — „X started following
you" ist dort woertlich zugesagt).

**Einschaetzung: „Messages" sind zwei Features unter einem Namen, und nur eines
davon ist ein eigener Durchgang.**

**(a) Benachrichtigungen — abgeleitet, kein neuer Datensatz.** A16.11 Schritt 5
entscheidet das bereits selbst: *„one notification, two surfaces — not two
records (A1)"*. Eine Nachrichtentabelle waere eine Kopie dessen, was in
`wineShows.events`, `order_events`, den Anfrage-Stufen und `wineFollowGraph`
schon steht — und sie wuerde veralten: „Cantina Rossi schlaegt Grillo vor" bliebe
stehen, nachdem der Wein bestaetigt oder abgelehnt ist. Das ist Invariante 7,
woertlich. Messages gehoert also als **Abfrageschicht** ueber die vorhandenen
Sektionen gebaut, genau wie A10 den Wine Guide als Query-Layer ueber Produkte
beschreibt — nicht als Postfach.
**Eine einzige Sache muss dabei wirklich gespeichert werden:** ob ich etwas schon
gesehen habe. Das ist aus den Ereignissen nicht ableitbar. Es ist aber auch kein
Postfach, sondern ein **Lesezeiger** je Stakeholder (ein Zeitstempel oder eine
Menge gesehener Ereignis-Ids) — und damit genau die Art Zustand, die in den
`BLStore.register`-Block gehoert (C8). Erst damit wird das Badge ehrlich.
Aufwand: ueberschaubar. Die Ereignisse existieren und werden anderswo bereits
gerendert; es kommen ein Renderer, ein Lesezeiger und vier tote Nav-Eintraege
hinzu, die lebendig werden.

**(b) Korrespondenz — ein echter, eigener Datensatz.** „Hawesko GmbH: We'd love
to schedule a tasting for your Primitivo…" ist aus nichts ableitbar; das hat
jemand geschrieben. Das waere eine neue Tabelle, ein Verfassen-Dialog, Threads —
**und ein eigener Durchgang.** Vor allem aber eine offene Geschaeftsentscheidung:
Wer darf wem schreiben? Laeuft das an der Partnerschaft (A6) und am
Lieferweg (A3) vorbei? Ein Postfach, in dem ein Distributor einen Winzer ohne
Partnerschaft anschreiben kann, waere eine echte Aenderung am Modell und keine
Oberflaeche. **Nichts in A1–A16 verlangt (b) heute.**

**Empfehlung:** (a) als eigenen, mittelgrossen Durchgang bauen und dabei das
handgeschriebene Widget ersetzen. (b) nicht anfassen, bis es einen
Geschaeftsgrund gibt — und den dann zuerst in die Spec, nicht in den Code.

**▶ NAECHSTES: Durchgang 2b — die Oberflaeche.** Die Ableitung steht und ist
geprueft (13 Harnesses gruen), sichtbar ist davon noch **nichts**. Offen:
1. **Nav-Eintrag „Notifications" UEBER „Messages"** in allen vier Rollen, mit
   Badge aus `notifUnread(role).length`. Die vier `Messages`-Eintraege bleiben
   vorerst tot daneben stehen — sie sind Feature (b), Korrespondenz.
   Zu beachten: Winzer und Distributor haben fest verdrahtete Badges **ohne
   `id`** (`2` und `3`), die neuen brauchen welche.
2. **Die Unteransicht** je Rolle, nach dem Muster der Orders-/Shows-Ansicht
   (`*_SECTION_EL` / `*_NAV_EL` / `*_TITLES` / `*_GROUPS`), zwei Klassen
   getrennt dargestellt: „Awaiting you" und „For information".
3. **Das handgeschriebene Messages-Widget** auf der Winzer-Uebersicht ersetzen —
   es enthaelt drei erfundene Nachrichten, darunter „Vinoteca Roma started
   following you", zu der es laengst einen echten Datensatz gibt. A1-Verstoss
   im Markup, und der Renderer dafuer existiert jetzt.
4. **`tests/notifications.js`** — noch nicht geschrieben. Muss die drei
   Bedingungen, die zwei Klassen, die Regional-Ausnahme (samt Leck-Probe) und
   den Lesezeiger halten, und gegen absichtlich kaputte Fassungen laufen.
   Bis dahin ist die Ableitung nur von Hand gemessen, nicht zugesichert.

**▶ ERLEDIGT in Durchgang 2 — und die urspruengliche Diagnose war falsch.
`acceptOrder()` war toter Code, nicht eine Luecke im Audit-Trail.**

**Was ich am 02.08. gemeldet hatte:** „`acceptOrder()` setzt `o.stage =
'accepted'` und ruft `logEvent()` nicht — die Bestellung wechselt ihren Zustand,
und der Audit-Trail schweigt dazu." Serge hat das daraufhin verbindlich in
Durchgang 2 gezogen, mit der richtigen Begruendung, dass „Bestellung angenommen"
sonst als einziges naheliegendes Ereignis keine Benachrichtigung liefert.

**Was die Nachpruefung ergab:** `acceptOrder()` hatte **keine einzige
Aufrufstelle** im ganzen Repo — kein `onclick`, kein Aufruf aus einem Widget.
Der einzige Aufrufer war mein eigener Harness aus Durchgang 1. Die Funktion
konnte den Audit-Trail also gar nicht luecken lassen, weil sie nie lief. Der
Annahmepfad ist und war `confirmOrder()`, gebunden an den Knopf
„✓ Confirm Order", und der loggt seit Durchgang 1 korrekt mit Actor. Die Zusage,
um die es Serge ging, war bereits erfuellt — nur nicht dort, wo ich sie gesucht
hatte.

**Warum die Diagnose danebenging, und was daraus zu lernen ist:** ich hatte den
Befund aus dem Verhalten der Funktion abgeleitet, ohne zu pruefen, ob sie
ueberhaupt erreichbar ist. Bei totem Code ist „diese Funktion macht X falsch"
immer eine Aussage ueber nichts. **Erst die Aufrufstellen, dann den Rumpf
bewerten** — sonst wird toter Code als Fehler gemeldet und, schlimmer, als
Fehler repariert. Genau das war hier der Ausgang: Serges Auftrag lautete
reparieren, die Messung ergab loeschen.

**Erledigt:** `acceptOrder()` geloescht. Repariert waere sie ein **zweiter
Annahmepfad neben `confirmOrder()`** geworden — die Doppelung, die ich daneben
selbst als offene Frage notiert hatte, dann aber fest verdrahtet. Serges
Entscheidung dazu: „dein Befund schlaegt meinen Auftrag."

### ▶ Persistenz, moeglicher zweiter Durchgang — oeffentliche Seiten

Bewusst nicht mit ausgeliefert, damit ein Fehler eindeutig zuzuordnen bleibt (C4c).
Die 16 oeffentlichen Seiten (Wine-Shows-Seite, Winzer- und Distributor-Profile)
laden `assets/bottle-lobby-data.js` bereits. Sie koennten den gespeicherten
`wineShows`-Stand **nur lesend** uebernehmen — dann steht eine im Dashboard
angelegte Show sofort auf der oeffentlichen Seite. Im Investorengespraech ist das
ein starker Moment.

**Der Store kann das schon:** `BLStore.start({ strict: false })` akzeptiert einen
Schnappschuss, der mehr Sammlungen enthaelt, als die Seite registriert. Wichtig
dabei: diese Seiten duerfen **nie schreiben** — sie kennen nur `wineShows` und
wuerden die uebrigen 19 Sammlungen sonst beim Speichern loeschen. Ein `readOnly`-
Schalter im Store waere der saubere Weg, bevor das gebaut wird.

### ▶ NAECHSTER EINSTIEG BEI A16 — Stand 1. August 2026

**Gebaut und live gegengeprueft:** erster Dashboard-Durchgang, **A16.7 vollstaendig**,
**A16.11 Schritte 1–2** (Location-Anfrage + Bepreisung), **A16.5 Teilnehmer und
Warteliste**, und die **A16.12-Kette komplett** (Bestellliste → zwei Spalten →
Abschluss mit beiden Order-Richtungen → Zuruecklegen). Die Kette traegt end-to-end.

**Offen, in der Reihenfolge, die ich empfehlen wuerde:**

1. **Catering ab Schritt 3 (A16.11)** — Modus + Satz waehlen, Beitraege versenden,
   die verbindlichen Bestaetigungen mit A6-Mechanik (Checkbox, Knopf hart
   deaktiviert), der abgeleitete verbindliche Punkt und was er sperrt.
   **Warum zuerst:** vollstaendig spezifiziert, keine offene Entscheidung, und es ist
   das einzige angefangene Stueck — Schritte 1–2 liegen fertig da. Angefangenes zu
   Ende bringen, bevor Neues aufgemacht wird.
2. **Catering Schritte 7–9** (Vorkasse-Rechnung, Zahlung, Freigabe-Vorbedingung).
   **Der Reihenfolge-Zwang ist erfuellt:** er haengt an `orders.source`, und die zwei
   Werte sind mit A16.12 entschieden **und** halb gebaut — `wine_show_order` steht,
   `wine_show_catering` fehlt. Laesst sich mit 1 zusammenlegen, wenn dir groessere
   Pruefungen im Browser lieber sind.
3. **Oeffentliche Profile von Restaurant und Retail (A16.7 abschliessen)** — klein
   und **genau jetzt entsperrt**: A16.13 hielt fest, dass sie auf dem handgeschriebenen
   Leerzustand bleiben, „bis A16.5 und die Teilnehmerlisten existieren". Beides
   existiert seit heute, und die noetige Entscheidung ist gefallen (siehe unten):
   Location ab `published`, Teilnehmer ab `completed`. Beide Zeilen gehoeren in
   `publicParticipation()` — dieselbe Funktion, die schon Host und Aussteller
   beantwortet. **Nichts sonst darf lernen, die Frage getrennt zu beantworten**,
   sonst ist es die vierte Flaeche, vor der A16.6 warnt.
4. **Open Call mit Master-Data-Filtern (A16.4)** — unabhaengig, mittelgross; braucht
   Filter ueber Master-Daten, die es als echte Tabellen im Prototyp nicht gibt.
   Vorher klaeren, wie tief das nachgebaut wird.
5. **Eigene Events (A16.8)** — unabhaengig, groesste Flaeche fuer das wenigste neue
   Modell (vier Rollen, kein Freigabe-Gate). Gut, wenn ein breiter, risikoarmer
   Durchgang ansteht.

- **CACHE: NICHT erledigt — am 01.08. erneut aufgetreten.** Nach dem Push kam wieder
  die alte Fassung, erst `?v=cab9b93` holte die neue. Die Formulierung „praktisch
  erledigt" stand hier seit dem 31.07. und war zu optimistisch: gemessen war damals
  nur, dass **Netlify** korrekt ausliefert, nicht dass der **Browser** die neue
  Fassung nimmt. Beides bleibt wahr — der Server ist in Ordnung, der Browser-Cache
  ist es nicht.
  **Praktische Regel bis auf Weiteres: beim Gegenpruefen `?v=<commit>` anhaengen.**
  Ein `[[headers]]`-Block wuerde daran nichts aendern, er schriebe nur fest, was
  Netlify ohnehin sendet. Wenn es stoeren soll, waere der echte Hebel ein
  Cache-Buster im Dateinamen der Assets — eigener Punkt, nicht nebenbei.
  Der urspruengliche Befund vom 31.07. im Wortlaut, weil er weiter gilt:
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
  Chip, kein Badge.
  **Seit dem 01.08. naeher dran:** WS-2599 fuehrt jetzt einen Aussteller mit DREI
  Weinen (Cantina Rossi), alle `confirmed` — der Mehr-Wein-Fall existiert also in den
  Daten, nur der ausloesende Zustand (ein Vorschlag NEBEN einem bestaetigten Wein)
  nicht — die drei Weine wurden alle vom Host vorgeschlagen und bestaetigt, und der
  Winzer hat nach der Einigung keinen Knopf mehr, mit dem er einen vierten
  vorschlagen koennte.
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
- **A16.12 zweite Fassung (01.08.): der Ablauf ist geklaert.** Vier Ergaenzungen von
  Serge, alle in der Spec: (1) die **Winzer-Partnerschaft geht der Show voraus** —
  jetzt ausdrueckliche Voraussetzung in A16.4, und der Grund, warum die
  Sammelbestellung ueberhaupt ueber die Plattform laufen darf; (2) **zwei Arten von
  Wein auf derselben Show** — im Portfolio = Bestellung, zum Test = Vorbestellung,
  je Zeile berechnet, und die zweite Spalte IST das Instrument (A16.0 praezisiert);
  (3) **Zuruecklegen statt Fallenlassen**, mit Begruendung an den **Winzer** als
  Verhandlungsangebot, Meldungen bleiben erhalten (Anhang D **D29**);
  (4) **Neukunde**: Angebot → Vorkasse → Versand, und die Vorkasse ist
  **voreingestellt**, solange es zwischen den beiden noch keinen bezahlten Auftrag
  gibt (A14.7 nachgezogen — abgeleitet, aber einmalig bei Anlage, nicht live).
- **A16.7:** „Auf dem oeffentlichen Profil **jedes Beteiligten** — Host, Aussteller,
  Location und **Teilnehmer** gleichermassen."
- **A16.5 Regel 4:** „Die Teilnehmerliste ist das Buch des Hosts. Sie ist **nicht
  oeffentlich**, und kein Teilnehmer sieht einen anderen."

Beides zugleich geht nicht, und Punkt 3 oben laeuft genau hinein. Die Frage ist nicht
formal: darf ein Restaurant auf dem **eigenen** Profil zeigen „war auf der Grande
Rioja"? Als eigene Tatsache waere das plausibel — die Liste bliebe beim Host, die
Teilnahme gehoert dem Teilnehmer. **Aber** A16.6s Kernargument ist, dass sich Flaechen
zusammenlesen lassen: fuenfzehn Profile, die je „war dort" sagen, ergeben die
Gaesteliste, die Regel 4 zurueckhaelt. Denkbare Antworten: (a) Teilnehmer erscheinen
gar nicht, A16.7 wird korrigiert; (b) erst ab `completed`, wenn die Show gelaufen ist
und die Liste nichts mehr wert ist; (c) nur mit eigener Zustimmung je Show.
**Meine Neigung: (b)** — sie erhaelt den Credential-Gedanken von A16.7 („drei Messen
auf dem Profil sind ein Ausweis"), ohne dass die Liste vor oder waehrend der Show
rekonstruierbar wird. Entschieden ist nichts; das ist eine Sichtbarkeitsfrage und
gehoert dir.
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
  Catering-Beitrag als `orders`-Datensatz. **Die `orders`-Empfehlung ist inzwischen
  angenommen und halb gebaut:** `wine_show_order` steht (A16.12), fuer das Catering
  fehlt nur noch `wine_show_catering` samt der Wache „nie Produktzeilen" (Anhang D
  **D27**). Der Reihenfolge-Zwang „Rechnung erst nach A16.12" ist damit erfuellt.
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
  Durchlauf** — `check-static.js` zuerst (Syntax, doppelte IDs — inzwischen auch gegen IDs, die
  Skripte als Literal ins Markup schreiben —, div-Balance und Verschachtelung,
  onclick, CSS-Cross-Check, Enum-Klassen), dann die **zehn Verhaltens-Harnesses**.
  Neu in dieser Sitzung: `venue-request.js`, `attendees.js`, `order-list.js`.
  **Jedes neue Harness wird gegen absichtlich kaputte Fassungen gefahren, bevor es
  als fertig gilt** — in dieser Sitzung haben dabei dreimal Mutationen ueberlebt,
  die Pruefung war also jeweils schwaecher als sie aussah. Nichts davon muss noch von Hand nachgebaut werden.
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
