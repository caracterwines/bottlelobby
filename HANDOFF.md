# HANDOFF — Sitzungsstand

> Nur das, was Git nicht selbst weiss: offene Punkte, naechste Schritte, laufende Entscheidungen.
> Dateiliste, Dateianzahl und Aenderungshistorie stehen in der Git-Historie — nicht hier.
> Dauerhafte Regeln stehen in `BOTTLE-LOBBY-SPEC.md`, kurze Invarianten in `CLAUDE.md` — nicht hier.

**Letzte Aktualisierung:** 10. August 2026

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

## ▶ EINSTIEG — Stand 10. August 2026

> **Was Git nicht weiss, steht hier. Alles andere nicht.** Diese Datei fuehrt
> keine Chronik: was gebaut wurde, wann und von wem, beantwortet `git log`
> besser. Hier stehen offene Punkte, Geschaeftsfragen und Fallen — und die
> Begruendungen dazu, die sonst nirgends stehen.
>
> Dauerhafte Regeln gehoeren in `BOTTLE-LOBBY-SPEC.md`, kurze Invarianten in
> `CLAUDE.md`. Findet sich hier eine Regel, ist sie am falschen Ort.

**Baum sauber, `main` gepusht, 28 Harnesses gruen** (nachgezaehlt 10.08. — `platform-partners.js` kam mit Durchgang 11 dazu, davor `campaigns.js` mit 10, `wine-guide-page.js` mit 9, `member-events.js` mit 7, `shows-reach.js`/`shows-release.js` mit 5 und 6). **`BLStore.VERSION` steht auf 8** — Durchgang 11 hat gemessen einen Bump gebraucht (eine Fixture-Zeile in der BESTEHENDEN Sammlung `reviews`; Begruendung im Block zu Durchgang 11 unten und am `VERSION` selbst).

### Womit eine Sitzung anfaengt

```
node tests/run-all.js        →  28 Harnesses, muss gruen sein, bevor irgendetwas beginnt
node tests/serve.js          →  http://localhost:8765   (no-store — NIE python http.server)
node tests/stamp-assets.js   →  nach jeder Aenderung an assets/, sonst wird check-static rot
```

**Vor jedem Browser-Befund `transferSize` lesen.** `0` heisst Cache, ein paar
hundert Byte heissen 304, nur nahe der dekodierten Groesse ist es frisch. **Vier
Fehlmessungen an einem Tag kamen genau daher** (Spec C7, „Browser acceptance").

### Wo die Regeln liegen

`BOTTLE-LOBBY-SPEC.md` ist die Autoritaet und waechst. **Niemand liest sie ganz —
also je Durchgang die geltenden Abschnitte benennen**, sonst wird nach
Plausibilitaet statt nach Spec gebaut. `CLAUDE.md` hat die acht Invarianten,
Anhang D die abgeloesten Entscheidungen (**D1–D44** — nie ohne Blick dorthin
etwas wiedervorschlagen).

Arbeitsregeln, die diesen Tag ueberdauern und in **C3/C7** stehen: jeden Commit
eines mehrteiligen Durchgangs **einzeln pushen**, sobald er fertig ist; Fixtures
nicht wachsen lassen, damit jede Meldungsart vorkommt; eine Zusicherung ueber
einen Leerfall nennt den **Grund**, nicht den Zustand; eine Mutation, die sich auf
eine Fixture verlaesst, gilt nur, solange die zufaellig passt; und beim Nachtragen
von Stammdaten ist das **frueheste abhaengige Ereignis die Obergrenze**.

---

### Die Konsolidierung A16/A17 — 1, 3 und 4 liegen; 2 und 5–11 stehen aus

Der Spec-Durchgang (Durchgang 1) ist am **6. August 2026** gelaufen: §5.1–§5.9
der freigegebenen Vorlage sind in `BOTTLE-LOBBY-SPEC.md` uebertragen, **D37–D39**
stehen in Anhang D, **A16.14 (a–e)**, **A16.15**, **A17.9a/9b**, **A17.13a** sind
neu, **B8** und **C6** nachgezogen. **Kein Code, keine Fixtures, kein HTML** —
das war die Auftragsgrenze.

**Was Git nicht weiss und hier stehen muss:** die Vorlage
`KONSOLIDIERUNG-A16-A17-EVENTS-COMMUNITY-DRAFT.md` liegt **nicht mehr im
Repo** — sie ist ausserhalb archiviert; im Repo-Root ist sie am 06.08.
nachgemessen nicht vorhanden. Ihre **normativen Teile stehen vollstaendig in
der Spec** (§5.1–§5.9, D37–D39, A16.14, A16.15, A17.9a/9b, A17.13a); nichts
Geltendes haengt noch an ihr. Was mit ihr aus dem Repo verschwunden ist, sind
die **Messungen** der Prompts 66–68 — die Herleitung, nicht die Regel. Diese
Zeile stand bis zum 06.08. im Praesens („liegt untracked im Repo-Root") und
war damit falsch; wer die Datei dort sucht, sucht vergeblich.

Reihenfolge der restlichen Durchgaenge, je einzeln gepusht — die Begruendung
steht in der Vorlage §11 und ist Serges Ordnungsregel: erst Woerter und
Wahrheiten stabilisieren, dann nach aussen bauen.

| # | Durchgang | Inhalt |
|---|---|---|
| 2 | **Taxonomie + Rename** | Reach-Konstanten; Network→Community / My Partners→Network ueber alle vier Navs, `*_GROUPS`, `*_TITLES`, plus NAV-1 im Harness. ⚠ **Nach Map-Position und Id umbenennen, nie per String** — `network` heisst im Code zweierlei (D39) |
| 3 | **Own-Label-Datenkern** | `marketGrants` an den Projektbedingungen; OL-15-Ableitung; OL-14 + Betrag/Waehrung-Snapshot am Gebuehrenereignis; neues `tests/own-label-grants.js` |
| 4 | ~~**Saparavi-Fixtures**~~ | **Gebaut am 06.08. als D2D-Grundlage** — siehe den Block unter der Tabelle |
| 5 | **Shows: Reichweite + Recruiting** | `reach[]`, `applications_open`, Deadline, Bewerbungsablauf ueber die vorhandenen A16.9-Status, Discover-Unteransicht, Mitgliederstufe |
| 6 | **Shows: Final Review + Freigabe** | Veroeffentlichungs-Checkliste inkl. Contributions, gespeicherter Review, Reset bei materieller Aenderung, WS-6/WS-7 |
| 7 | ~~**Member Events, Basis + Cockpit (Distributor)**~~ | **Gebaut am 08.08.** — siehe den Block unter der Tabelle. Externe Messen (`event_kind:'external_fair'`) sind bewusst NICHT dabei |
| 8 | ~~**Member Events, Ausrollen**~~ | **Gebaut am 08.08.** — siehe den Block unter der Tabelle. Die Bewerberseite ist bewusst NICHT dabei (Durchgang 9) |
| 9 | ~~**Wine Guide → Events + Bewerberseite**~~ | **Gebaut am 09.08.** — siehe den Block unter der Tabelle. Dazu die ME-5-Korrektur (D42) und das ausgeschriebene Messe-Modell in der Spec |
| 10 | ~~**Kampagnen + Benachrichtigungen**~~ | **Gebaut am 10.08.** — siehe den Block unter der Tabelle. Ankuendigung/Erinnerung getrennt, Empfaenger-Snapshot, C9-Bedingungen; die Publikumsregel ist neu entschieden (**D43**) |
| 11 | **`bottle-lobby-own-label.html` neu** | Die Seite behauptet das alte Modell in ~20 Passagen (Zeilen 206–453) — **das alte Modell IST ihr Argument**, also Neuschrift, nicht Korrektur. Die zwei *konkreten* Falschaussagen sind mit dem A17-Fixture-Durchgang weg (siehe den Block unter der Tabelle); die **Argumentation** steht unveraendert. **Muss nach dem A17-Fixture-Durchgang**, sonst wird die Seite zweimal geschrieben. ⚠ **Nummernkollision:** der am 10.08. gebaute „Durchgang 11" ist der **Platform-Partner-Durchgang** (V4, Block unter der Tabelle), nicht diese Zeile — die Neuschrift bleibt offen |

**Zwischen den Durchgaengen jeweils eine Browser-Abnahme** — klicken statt
Funktionen aufrufen, `transferSize` vorher lesen (C7).

> **Durchgang 3 ist gebaut, mit einem benannten Rest.** Datensaetze und
> Lesungen stehen in der Seite (`ownLabelProjects`, `marketGrants`,
> `ownLabelFeeEvents`, `ownLabelListingDerived()`, `ownLabelOrderRight()`,
> `ownLabelFeeEvent()`). Die Arrays blieben damals **leer**, mit Fixtures nur in
> `tests/own-label-grants.js`; **seit dem A17-Fixture-Durchgang tragen sie echte
> Zeilen** — der Rest ist eingeloest. Grund damals, gemessen: keine der sechs ueberbrueckten
> Listing-Zeilen hat eine gelieferte Bestellung ihres erzeugenden Weinguts an
> Hawesko — ORD-2029 ist die einzige gelieferte Weingut→Distributor-Order und
> traegt PRD-1008, das nicht ueberbrueckt ist. Eine Projektzeile in der Seite
> haette die Ableitung fuer alle sechs auf `false` gestellt, A17.14 haette die
> `legacyOwnLabel`-Bruecke im selben Commit verlangt, und „My Labels" waere leer
> — reparabel nur durch eine **erfundene** Erstlieferung, die A17.14 im selben
> Atemzug verbietet. **Die Aufloesung war keine Lieferung, sondern eine
> Klassifikation:** die sechs brauchten nie eine, weil keine davon ein Own Label
> ist (D41).
>
> **Durchgang 4 ist gebaut, und er ist die GRUNDLAGE, nicht der Saparavi-Fall.**
> Was liegt: die Spec-Korrektur zuerst (A3 traegt die Bezugsregel in neun
> Punkten, A14.1 geweitet, Invariante 3 nachgezogen, **D40**), dann die
> D2D-Partnerschaftszeile Hawesko ↔ Enoteca (19.05.2026), Enotecas Listing auf
> **PRD-1015** mit eigenem `tradePrice` 21.90 gegen Haweskos 17.20, die
> A→B-Order **ORD-2043** (180 Fl., 16.06.2026, `accepted`) und der
> `dealFreeGoodsFor()`-Ausschluss fuer D→D. `tests/supply-chain.js` traegt den
> Fall mit vier Beweisen und zwei Mutationen.
>
> **Bewusst ein GEWOEHNLICHER Wein.** Own Label, Grants und der Saparavi-Fall
> selbst gehoeren in den A17-Fixture-Durchgang; hier war der Punkt, dass die
> Plattform den Weg **ohne** A17 zulaesst — ein normaler Wein wird nie
> abgewiesen, weil kein Projekt existiert (A3 Punkt 7). Die Produktwahl ist
> begruendet: PRD-1015 ist der einzige gewoehnliche Wein in Haweskos Buch, den
> Enoteca nicht ueber seine eigene Cantina-Rossi-Partnerschaft erreicht **und**
> der einen quotierten Preis traegt.
>
> **Der A17-Fixture-Durchgang ist gebaut (07.08.), neun einzeln gepushte
> Commits — und er hat mit einer Klassifikation angefangen, nicht mit Code.**
> Die sechs ueberbrueckten Listing-Zeilen sind **keine Own Labels und waren es
> nie**: Erzeugerweine unter der Marke des Erzeugers plus eine
> Vertriebsexklusivitaet. **Warum, mit Belegen: Spec D41** — hier nicht
> wiederholt. Daraus folgte alles Weitere:
>
> - **A17.0-Zahlen korrigiert**, A17.14 sagt jetzt, dass an `ownLabel:true`
>   nichts abzuleiten war, und **D41** haelt die abgeloeste Lesart fest.
> - **`legacyOwnLabel` und `listingOwnLabelStatus()` sind weg** — die Bruecke aus
>   Durchgang 3 ist abgebaut, alle Leser haengen an `ownLabelListingDerived()`.
>   `tests/listings.js` §6d meldet die Migration abgeschlossen und dreht damit
>   die Richtung: sie wird jetzt rot, wenn die Bruecke *zurueckkommt*.
> - **Vier Projekte ueber den ganzen Bogen:** OLP-101 (Relabel auf PRD-1020,
>   `productId` null) · OLP-102 (Bespoke, `developmentReferenceWineId` PRD-1004)
>   · OLP-103 → **PRD-1029** „Hanseatischer Roter", nach Gate 2 erzeugt, Erstorder
>   `accepted`, **nicht geliefert, nicht gelistet, korrekt nicht oeffentlich**
>   (`url: null`, keine Guide-Zeile — A17.9) · OLP-104 → **PRD-1028**
>   „Hanseatischer Weisser", Erstlieferung bestaetigt, Primary Listing aktiv,
>   **vollstaendige Artikelseite und Guide-Zeile**.
> - **Die Saparavi-Struktur auf Own-Label-Ebene:** Enoteca listet PRD-1028 mit
>   eigenem `tradePrice` und eigener Artikelnummer, **ohne Primary-Badge und
>   nicht in Enotecas „My Labels"** (A17.9b), gedeckt von einem
>   Unterdistributions-Grant. **Die Gebuehr fiel einmal an** — Weingut→Hawesko,
>   nicht erneut Hawesko→Enoteca.
> - **Sichtbare Produktwahrheit:** keine Guide-Zeile, kein Ribbon und kein Badge
>   nennt mehr einen normalen Erzeugerwein ein fertiges Own Label.
>   „Own-Label Available", „fertiges Own Label" und „Primary Listing aktiv" sind
>   drei getrennte Aussagen mit drei Wortlauten.
>
> **Bewusst offen geblieben, und das ist keine Nachlaessigkeit:**
> · die **Neufassung von `bottle-lobby-own-label.html`** ist Durchgang 11 — die
>   zwei konkreten Falschaussagen (das *Real Example* und die Rechner-Notiz,
>   beide nannten PRD-1022 „own-labeled for Hawesko") sind korrigiert und nennen
>   jetzt PRD-1028, aber **die Seite argumentiert weiter das alte Modell**;
> · es gibt **keine echte Oberflaeche fuer die Programmzulassung** — die
>   A17.1-Bedingungen und die A17.8-Datensaetze liegen und werden gelesen, aber
>   Aufnahme, Consent und Vertragsfreigabe passieren nirgends per Klick, und
>   „+ Start a New Own-Label" oeffnet noch keinen Projektantrag
>   (`canStartOwnLabelProject()` traegt die Pruefung samt sechs Absagegruenden
>   bereits — es fehlt nur der Dialog davor);
> · **Cantina Rossis Winery-Flaechen** rendern ihre elf Portfoliozeilen weiter
>   getippt statt aus dem Buch; die Zeilen tragen seit diesem Durchgang
>   `data-product`, der Vollrender ist damit vorbereitet, aber nicht gebaut.

> **Durchgang 7 ist gebaut (08.08.), drei einzeln committete Schritte, ein
> Push.** Was Git nicht selbst sagt:
>
> - **`reachAdmits()` nimmt jetzt einen HOST statt einer Show.** Es hat immer nur
>   `show.leadHost` gelesen, also ist die Weitung eine Umbenennung — und sie ist
>   der Grund, warum fuer die zweite Art **keine zweite Reichweiten-Arithmetik**
>   entstanden ist. Die Taxonomie aus A16.14b wird referenziert, nicht kopiert.
> - **`eventVisibleTo()` ist eine Schwesterfunktion und kein Flag, weil das
>   dritte Tor INVERTIERT ist.** WS-3 laesst die Reichweite ab `published`
>   fallen, weil Bottle Lobby die Show auf die offene Website gestellt hat. Beim
>   Member Event ist `published` der Akt des Hosts — die gespeicherte Reichweite
>   entscheidet weiter. Beides in einen Zweig zu falten haette zwei
>   entgegengesetzte Antworten in eine Bedingung gelegt.
> - **Moderation schreibt KEINE `reviews`-Zeile**, und das ist die Entscheidung,
>   nicht das Weglassen einer Zeile: das Register traegt Release-Semantik
>   (WS-6), eine Sperre darin waere ein Eintrag im Freigaberegister fuer etwas,
>   das nie freigegeben wurde. Das Delisting liegt mit Grund auf dem Event
>   selbst (`moderation`) und im eigenen Log.
> - **Drei Harnesses haben echte Luecken gefunden** und wurden dort geweitet, wo
>   die Regel wirklich verschoben ist: die Discover-Zaehlung leitet jetzt ueber
>   BEIDE Kartensorten ab statt ueber eine · der neue transiente Zustand
>   (`activeEventRole`, `eventState`) ist mit Begruendung klassifiziert ·
>   `location:` ist in `tests/stakeholders.js` **neben einem Haus-Schluessel**
>   verboten statt als Teilstring. Die Adresse eines Abends ist keine Kopie
>   eines Hauses; ein flaches Verbot haette das Event-Record gezwungen, ein
>   zweites Wort fuer „wo das stattfindet" zu erfinden.
> - **C8 gemessen, nicht gelesen:** die 24 vorhandenen Sammlungen hashen
>   identisch, `memberEvents` und `eventSeq` sind neu. Ein Snapshot im Format
>   des Vorstands wurde eingespielt und kam mit
>   `discarded — memberEvents (missing), eventSeq (missing)` zurueck. **Kein
>   VERSION-Bump noetig** — eine neue Registrierung verwirft Alt-Snapshots
>   selbst. Das gilt nur, solange keine Zeile in eine BESTEHENDE Sammlung
>   kommt; dann greift die Regel aus C8 wieder.
>
> **Benannte Reste aus Durchgang 7 — die beiden mit Ziel 8 sind mit Durchgang 8
> erledigt** (toter Retail-Nav-Eintrag · getippte *Cantina Rossi Tasting*), die
> Bewerberseite mit Durchgang 9; was danach offen bleibt, steht im Block zu
> Durchgang 9 unten.
> · **Durchgang 10** — `event_campaigns` und damit **ME-4** sind nicht gebaut,
>   und `tests/member-events.js` sagt das ausdruecklich, statt eine Pruefung
>   ueber ein nicht existierendes Feature zu fuehren.
> · **Externe Messen** sind nicht gebaut — der alte Plan „eigener
>   Kleindurchgang" ist seit Durchgang 11 **durch den Fair-Track ersetzt**
>   (V4-Entscheid vom 10.08., Roadmap O2–O15 im Block zu Durchgang 11 unten).
>   **Das Modell steht seit Durchgang 9 ausgeschrieben in A16.8** (kanonische
>   Messe, deren Eigentuemer seit Durchgang 11 ein verifizierter
>   Organizer-Workspace ist — A18, D44; Teilnahmezeile je Aussteller,
>   Standtermine als eigener beidseitiger Ablauf ohne Order), damit bis dahin
>   nichts als Ersatzkonstruktion modelliert wird.

> **Durchgang 8 ist gebaut (08.08.), fuenf einzeln committete Schritte, ein
> Push.** Was Git nicht selbst sagt:
>
> - **Der Zuschnitt ist beim Messen kleiner geworden, nicht groesser.** Die
>   Discover-Kartensorte war auf allen vier Rollen schon da: `renderWineShows()`
>   ist seit Durchgang 7 rollenparametrisiert und mountet die zweite Sorte
>   selbst. Punkt 4 des Auftrags war damit eine **Abnahme, kein Bau** — und das
>   ist genau der Ertrag daraus, dass Durchgang 7 sein Cockpit von Anfang an
>   ueber `role` geschrieben hat, obwohl nur eine Rolle verdrahtet war.
> - **Ein neuer Tab, und er hat einen Grund.** A16.8 nennt fuenf Listen; Durchgang
>   7 hatte vier. **Upcoming** ist die Liste der Events, auf denen man IST, ohne
>   sie zu veranstalten — ohne sie verschwindet eine angenommene Einladung im
>   Moment des Annehmens aus dem Cockpit, und die Rolle, die zu jemand anderem
>   geht, hat keine Flaeche, die das sagt.
> - **Der Detailbereich trennt sich, und die Host-Akte sind ABWESEND statt
>   deaktiviert.** Ein ausgegrauter *Publish*-Knopf auf fremdem Event behauptet,
>   es gaebe den Akt fuer diesen Leser. Angenommen und abgesagt wird ueber
>   `respondToEventInvite()` / `rsvpToEvent()` — dieselben zwei Funktionen, die
>   das Host-Pane zum Simulieren ruft; ein zweiter Annahmeweg waere ein zweiter
>   Ort, an dem `accepted` etwas bedeutet.
> - **Ein einziges Fixture, und nur weil es fehlte.** Restaurant und Retail
>   veranstalten seit Durchgang 7 (ME-3102, ME-3101), Hawesko zwei. Das Weingut
>   veranstaltete nichts, also haette sein Cockpit den Leerzustand vorgefuehrt
>   und sonst nichts — **ME-3105** (Harvest Days in Contrada Ferla) schliesst
>   genau diese Luecke und traegt die eine offene Einladung auf der Retail-Seite.
>   Nichts wurde verdraengt oder umklassifiziert.
> - **`BLStore.VERSION` steht auf 6, und die Messung spricht gegen die
>   Notwendigkeit.** Beide Fingerabdruck-Saetze wurden verglichen: genau EINE der
>   26 Sammlungen hat sich geaendert, `memberEvents` (`92c5d5c0` → `2de22954`).
>   Wache 2 haette den Alt-Snapshot also selbst verworfen — der Bump steht
>   trotzdem, wegen des **Grundes**: ME-3105 ist die erste Zeile mit
>   `reachCountry:null`, und haette das Weingut wie die anderen auf ein Land
>   eingeengt, waere gar nichts passiert und die Zeile waere bei jedem
>   Rueckkehrer verschwunden. Ein Schutz, der an einem zufaellig leeren Feld
>   haengt, ist keiner.
> - **Die *Cantina Rossi Tasting* ist ERSATZLOS weg, und das war ein Messbefund.**
>   Das Fixture hatte laengst entschieden, was der Abend ist: ME-3101, veranstaltet
>   von Weinhaus Müller, Hawesko als bestaetigter Gast darauf. Ihn im
>   Wine-Shows-Widget unter einem zweiten Gastgeber nachzubauen waere die Kopie
>   aus ME-1 gewesen und haette ein Member Event unter eine Ueberschrift
>   gestellt, die *Wine Shows* verspricht (ME-3). Die zweite getippte Karte des
>   Widgets (*French Whites Showcase*) ist unberuehrt.
> - **Ein Fehler nebenbei, weil der neue Nav-Eintrag ihn geerbt haette:** aus den
>   Wine Shows in die Orders zu gehen liess *Wine Shows* markiert. `ORDER_ROLES`
>   und die drei Rollen-Router kennen die beiden Events-Eintraege jetzt.
>
> **Was Durchgang 8 bewusst NICHT gebaut hat:** die Bewerberseite (9), der
> Wine-Guide-Events-Tab (9), Kampagnen und ME-4 (10), oeffentliche
> Event-Flaechen, externe Messen. `applyToEvent()` wird weiterhin nur ueber das
> Host-Pane erreicht — Annehmen und Ablehnen einer Bewerbung —, und das ist die
> Wiederverwendung, nicht ein halber Bewerbungsablauf.
>
> **Browser-Abnahme, mit einer genannten Einschraenkung:** Screenshots kommen in
> dieser Erweiterungsumgebung nicht zustande (Injection-Timeout bei ~950 KB
> Dokument, zweimal, dann nicht weiter versucht — C7). Abgenommen wurde ueber
> gerenderten DOM, berechnete Darstellung und echte Klicks auf echte Elemente:
> voller Anlegen-und-Publizieren-Pfad auf dem Weingut (ME-3106, danach ueber
> `BLStore.reset()` wieder entfernt), Host-Rechte und Gast-Antwort je Rolle,
> Retail-Navigation, Discover-Karten samt Rahmenfarbe (kein geborgtes Show-Gold),
> und WS-2604 unveraendert.

> **Durchgang 9 ist gebaut (09.08.), sieben lokal committete Schritte, ein
> Push.** Wine Guide → Events, die Bewerberansicht, die Host-Weinauswahl und
> die ME-5-Korrektur. Was Git nicht selbst sagt:
>
> - **Die Spec ging voraus, und sie muss ins Projektwissen.** ME-5 ist ersetzt
>   (bestaetigte Geschaeftsentscheidung, alte Fassung als **D42** in Anhang D):
>   ein bestaetigter `winemaker`/`exhibitor` wird nach ausdruecklicher Annahme
>   auf den oeffentlichen Flaechen eines VEROEFFENTLICHTEN Events genannt;
>   Gaeste, Bewerber, offene Einladungen, Sponsoren und allgemeine Teilnehmer
>   bleiben Kopfzahlen. Dazu ist das Modell **externer Messen** in A16.8
>   ausgeschrieben — nur Text, kein Code, damit keine Ersatzkonstruktion
>   entsteht (eine ProWein-Teilnahme wird NIE als Member Event modelliert).
> - **Wines & Program: der Host entscheidet, aus dem eigenen Buch** —
>   `eventAssortment(role)` liest je Rolle Katalogzeilen, Portfolio, Wine List
>   oder Selection; gespeichert wird nur `{productId}`. Bewusst KEIN
>   Show-Vorschlagsmodell. **ME-3101s sortimentsfremde Zeilen bleiben**: es
>   sind die Weine des akzeptierten Gastwinzers, einmal vom Host benannt; ein
>   Mechanismus dafuer ist bewusst nicht gebaut (Spekulationsverbot).
> - **Die Nennung sitzt im Asset** (`eventNamedLineup()` neben der Karte):
>   Status-Tor ist `eventListable()` — published/postponed/completed sind
>   alles Host-Publikationen, ein Draft nennt niemanden, ein delisteter
>   rendert keine Karte. Papier-Ton, kein Show-Gold, Disclaimer unveraendert.
> - **Der Bewerberweg ist die Wiederverwendung, kein zweiter Ablauf:**
>   Discover-Karte → „Open this event" (Dashboard-Append wie bei den Shows,
>   damit die oeffentlichen Seiten keinen toten Link erben) → Apply im
>   You-Kasten. Eine Zeile source `application`/status `applied`; der Host
>   antwortet auf DERSELBEN Zeile; declined bleibt lesbar.
>   `eventsIAppliedTo()` LISTET die eigene Bewerbung im Invitations-Tab,
>   zaehlt sie aber nicht in „Waiting for You" — sie wartet auf den Host.
> - **Der Guide laedt erstmals die Assets** (data + public-shows, gestempelt)
>   und bekommt den sechsten Tab `#events`: EIN gemischt chronologisches
>   Verzeichnis, `directoryEntries()`/`mountDirectory()` DELEGIEREN an die
>   faktorierten Zellbauer (`showCellHtml`/`wireShowCells`/`eventCellHtml`) —
>   kein kopiertes Kartenmarkup. Filter nur ueber echte Daten: Art (nur
>   solange beide Sorten vorkommen) und Stadt (nur Staedte mit Eintraegen).
>   Alle Alt-Hashes und `?grape=<name>#wines` gemessen unveraendert.
>   Neuer Harness **`tests/wine-guide-page.js`** (der 26.).
> - **Ein Fixture-Eingriff, begruendet:** ME-3102 traegt `public` — das
>   bezahlte Endkunden-Dinner, dessen externer Buchungslink gerade NICHT auf
>   die Mitgliedschaft zielt — und verliert die Deutschland-Einengung, die
>   der eigenen `city`-Notiz („narrows to nothing") widersprach und mit der
>   `public` kein Leser je passiert haette (eine Einengung laesst jeden ohne
>   bekannten Ort durchfallen, den Anonymen zuerst).
> - **`VERSION` 6 → 7, und die Messung korrigierte die Vorhersage:** der
>   Fingerprint bewegte sich DOCH (die Union faltet GANZE Zeilen-Shapes,
>   `memberEvents` 2de22954 → 39a547a0, als einzige von 26). Der Bump steht
>   trotzdem — der `public`-String selbst ist unsichtbar, und ein Schutz, der
>   an einer zufaelligen Feldkombination haengt, ist keiner. Begruendung am
>   `VERSION` in `assets/bottle-lobby-store.js`.
> - **Browser-Abnahme mit derselben genannten Einschraenkung wie Durchgang 8:**
>   Screenshots scheitern am Injection-Timeout (auch auf der 77-KB-Guide-
>   Seite, zweimal, dann nicht weiter versucht). Abgenommen ueber gerenderten
>   DOM, berechnete Darstellung und echte Klicks, `transferSize` vorher
>   gelesen: Host-Weinauswahl mit Gegenprobe (PRD-1002 nie im Picker) ·
>   publish → invite → Annahme aus der Winery-Ansicht mit Vorher/Nachher der
>   Nennung · ME-3103-Karte nennt Akzeptierte und weder den offen
>   Eingeladenen noch Gaeste · voller Bewerbungsweg samt Decline-Lesbarkeit ·
>   Guide `#events` anonym (Reach, Mischsortierung, Filter, beide
>   Kartensorten, Join-Hinweis, Papier-Rahmen statt Gold) ·
>   `?grape=Chardonnay#wines` unveraendert · WS-2604 unveraendert ·
>   Durchgang-8-Gastantwort auf ME-3105 unveraendert. Danach `BLStore.reset()`.
>   Ein Kuriosum dieser Umgebung: das JavaScript-Tool blockte einmal die
>   AUSGABE eines Schritts (DLP-Filter), der Schritt selbst war gelaufen —
>   nachgeprueft ueber den Datenzustand, bevor weitergemacht wurde.
>
> **Was Durchgang 9 bewusst NICHT gebaut hat:** Kampagnen und **ME-4** (→ 10) ·
> externe Messen (eigener Durchgang; das Modell steht jetzt in A16.8) ·
> oeffentliche Member-Event-Detailseiten (benannt offen; die Karte ist die
> ganze oeffentliche Flaeche) · eine Automatik fuer Gastwinzer-Weine
> ausserhalb des Host-Sortiments (Spekulationsverbot, ME-3101 bleibt der
> dokumentierte Fall) · ein Ruecknahmeweg fuer Bewerbungen (nicht beauftragt,
> nicht erfunden).

> **Durchgang 10 ist gebaut (10.08.), fuenf lokal committete Schritte, ein
> Push.** Kampagnen fuer beide Traegersorten, Suppressions, die abgeleitete
> Empfaenger-Benachrichtigung — und die Spec ging voraus. Was Git nicht
> selbst sagt:
>
> - **Die Publikumsregel ist NEU ENTSCHIEDEN, und die Spec muss ins
>   Projektwissen.** Ein Announcement geht an die EIGENEN Fans des Hosts
>   (eingehende A7-Kanten), optional plus die eigenen aktiven Partner —
>   nie an ein Reach-Segment. Die abgeloeste Fassung („goes to a reach
>   segment") ist **D43**; A16.14b nennt Kampagnen nicht mehr als
>   Reach-Konsumenten, A16.8 ist nachgezogen, C9 klassifiziert die
>   Suppression als Eingaberecord neben dem Read-Marker.
> - **Es gibt KEINE gemeinsame Detailstelle fuer Show und Event** — das
>   war die eine Messung, die den Auftragstext korrigiert hat. Die „eine
>   parametrisierte Stelle" ist deshalb die FUNKTION: `campaignBox(role,
>   subjectType, subject)`, gemountet in `renderShowDetail()` und
>   `renderEventDetail()`, beide Male nur fuer den Host und absent statt
>   deaktiviert fuer alle anderen.
> - **Die C9-Sichtbarkeit je Empfaenger hat zwei Tueren, und das ist eine
>   Entscheidung:** die Klasse-1-Ableitung (`showVisibleTo`/
>   `eventVisibleTo`) ODER die EIGENE Zeile auf dem Traeger. Ein offen
>   Eingeladener besteht die Verzeichnis-Sichtbarkeit nicht (EVENT_ON_IT
>   kennt `sent`/`viewed` nicht), erreicht den Traeger aber ueber seine
>   Einladung — C9 erbt die Flaeche, und fuer ihn IST die Einladung die
>   Flaeche. Ohne die zweite Tuer haette ein Reminder genau die Haeuser
>   verloren, um die es ihm geht.
> - **`partnerships` hat kein `status`-Feld, und der Resolver verlaesst
>   sich darauf:** jede Zeile IST eine aktive Partnerschaft (Aktivierung
>   ist der manuelle Bottle-Lobby-Akt, Invariante 6); Anfragen leben in
>   den vier Request-Buechern. „Aktive eigene Partner" ist deshalb
>   `partnershipsOf()` ohne Filter — ein erfundenes Statusfeld waere D36
>   eine Etage hoeher gewesen.
> - **Der Fixture-Snapshot ist HERGELEITET, nicht behauptet:** CMP-4001
>   (Hawesko, ME-3103, Fans + Partner) — 10 Kandidaten, Bistro Laurent
>   faellt an seine Announcement-Preference, vier fallen an der
>   Deutschland-Einengung ohne eigene Zeile, fuenf bleiben. Die Rechnung
>   steht als Kommentar an der Fixture, und `tests/campaigns.js` prueft
>   Snapshot gegen Live-Aufloesung auf Gleichheit.
> - **Eine Zahl, die zufaellig stimmt, und der Harness weiss es:** die
>   Reminder-Zahl auf ME-3103 (6) ist zufaellig gleich der Groesse von
>   Haweskos Community (auch 6) — die MENGEN unterscheiden sich (Domaine
>   Lefevre drin, Chateau Belrieu nicht). Der Harness und die Abnahme
>   pruefen die Menge, nie die Zahl.
> - **Versandstempel:** ein Live-Versand stempelt `SHOW_TODAY`
>   (2026-07-31), wie jede andere Mutation der Seite; die Fixture traegt
>   ihr Autorschaftsdatum (05.08.) nach C7-Konvention. Zwei Konventionen,
>   beide vorgefunden, keine neu erfunden.
> - **C8 gemessen, nicht gelesen:** alle 26 Bestandssammlungen hashen
>   identisch, `eventCampaigns`, `campaignSeq` und
>   `communicationSuppressions` sind reine Neuregistrierungen — ein
>   Alt-Snapshot wird von `restore()` selbst verworfen, **kein
>   VERSION-Bump** (dieselbe Lage wie Durchgang 7). Der C8-Roundtrip der
>   neuen Sammlungen ist in der Abnahme nebenbei belegt: ein Live-Versand
>   ueberlebte den Reload und verschwand erst mit `BLStore.reset()`.
> - **Ein Bestands-Harness hat den Durchgang gefangen:** die
>   Ziel-Whitelist in `tests/notifications.js` §9 kannte `event` nicht
>   und wurde rot — genau ihre Aufgabe. Sie spiegelt jetzt
>   `notifDestination()` inklusive des neuen Zweigs; den Klick auf beide
>   Oeffnungswege fuehrt `tests/campaigns.js` echt aus.
> - **Messbefund am Rande, benannt statt still:** die Tabelle „What each
>   file guards" in `tests/README.md` fuehrt seit Durchgang 5 keine neuen
>   Harnesses mehr (shows-reach, member-events, wine-guide-page,
>   campaigns fehlen alle). Die Spec benennt Harness-Heimaten seit A16.15
>   selbst; die Tabelle gehoert beim naechsten Test-Pflegepunkt
>   nachgezogen oder auf die Spec-Verweise reduziert — hier nicht getan,
>   weil es vier Durchgaenge Rueckstand ist und nicht dieser eine.
> - **Browser-Abnahme am finalen Stand, mit derselben genannten
>   Einschraenkung wie Durchgang 8/9** (keine Screenshot-Serie versucht):
>   gerenderter DOM, berechnete Darstellung, echte Klicks,
>   `transferSize` vorher gelesen (983 KB frisch). Voller Bogen:
>   Announcement auf ME-3103 angelegt — Vorschau zeigt Zahl, nie Namen —
>   bestaetigt, versendet, Protokollzeile sichtbar; Abbruch versendet
>   nichts; Draft- und Completed-Traeger mit benanntem Grund abgelehnt;
>   Cantina Rossi sieht die abgeleitete Benachrichtigung und landet per
>   Klick auf dem bestehenden Discover→Detail-Pane als Leser (keine
>   Host-Akte); Bistro Laurent (Suppression) sieht keine Kampagnenzeile;
>   Teilnehmer-/Order-/Partnerschaftszaehler vor und nach dem Versand
>   identisch; WS-2604 unveraendert funktionsfaehig samt neuer Box;
>   Guide `#events` unveraendert (ein oeffentliches Event, die
>   freigegebene Show, NICHT die Hausmesse). Danach `BLStore.reset()`,
>   Fixtures nachgemessen unberuehrt.
>
> **Was Durchgang 10 bewusst NICHT gebaut hat:** eine
> Suppressions-Einstellungsoberflaeche (nur Datensatz + Resolver; die
> Oberflaeche ist ein benannter Restpunkt und gehoert in den Durchgang,
> der Empfaenger-Einstellungen baut) · externe Messen (eigener
> Durchgang, Modell steht in A16.8) · oeffentliche
> Member-Event-Detailseiten (weiter benannt offen) · ein
> Nachrichten-/Inbox-System (C9 bleibt eine Query; die einzige neue
> Speicherung ist der Kampagnen-Snapshot, und der ist ein Beleg, kein
> Postfach).

> **Durchgang 11 ist gebaut (10.08.), fuenf lokal committete Schritte, ein
> Push.** Die kleinste kohaerente Partner-/Organizer-Grundlage nach Serges
> V4-Architekturentscheid (10.08.): Kategorie **Verified Platform Partners**
> getrennt von den vier Handelsrollen, erste aktive Capability **Organizer**.
> Die Spec ging voraus (**A18** neu, **D44** in Anhang D) **und muss ins
> Projektwissen.** Was Git nicht selbst sagt:
>
> - **Das V4-Dokument liegt NICHT im Repo.** Die gesperrte Zielnavigation des
>   Organizer-Cockpits (V4 §6) und die Anker O2–O15 sind deshalb aus den im
>   Auftrag benannten Fair-Funktionen abgeleitet, nicht aus dem Dokument
>   selbst. Stimmen Wortlaute nicht, ist die Korrektur billig: alles steht in
>   EINEM Ort, `PARTNER_LOCKED_NAV` im Dashboard.
> - **Die Verifikation ist eine `reviews`-Zeile, und das Register trug die
>   Erweiterung gemessen:** `REVIEW_SUBJECT_TYPES` gewinnt `partner` nach dem
>   `show`-Praezedenz aus Durchgang 6 (Invariante 6: EIN Ort fuer die
>   Autoritaet der Plattform). Kein zweites Pruefregister, kein getipptes
>   `verified`-Flag — die Kennzeichnung faellt mit der Zeile
>   (`partnerVerificationApproved()`, RVW-3004).
> - **Der Umschalter-Messbefund, der den Zuschnitt getragen hat:** NICHTS im
>   Dashboard iteriert ueber die Umschalter-Liste — ORDER_ROLES, SHOW_ROLES,
>   EVENT_ROLES, `stakeholders`, REACH_ROLE_VALUE und der Kampagnen-Resolver
>   sind parallele, hartkodierte Vierer-Strukturen. Die fuenfte Sicht leckt
>   also bauartbedingt nirgends hinein; `tests/platform-partners.js` sichert
>   diesen IST-Zustand mit Gegenmutationen (Einmischen → rot) und verbietet
>   ausdruecklich NICHT den spaeter gemessenen Organizer-Follow.
> - **`VERSION` 7 → 8, gemessen:** alle 29 Bestandssammlungen hashen
>   identisch, `platformPartners` (8d34c198) ist der einzige neue Print. Der
>   Bump kommt von **RVW-3004 in der BESTEHENDEN Sammlung `reviews`** (die
>   D2D-Klasse; `reviewSeq` 3004 → 3005 wandert mit). Das Gegenargument — die
>   Neuregistrierung im selben Commit verwirft Alt-Snapshots ohnehin — ist am
>   `VERSION` benannt und verworfen: ein Schutz, der an einer
>   Nachbarregistrierung im selben Commit haengt, ist keiner.
> - **Ein Fixture, fiktiv mit Absicht:** „Atrium Fairs GmbH" (PP-9001) —
>   keine reale Messe- oder Medienmarke wird je Demo-Datum; reale Namen
>   bleiben Spec-Prosa (A16.8). C7-Decke eingehalten: Verifikationsdatum
>   15.07. liegt vor `SHOW_TODAY`, weil das Cockpit „heute" einen
>   verifizierten Organizer zeigt. `media_partner` ist zulaessiger WERT und
>   nirgends instanziert — Gegenmutation im Harness haelt das rot.
> - **Follow ist ausschliesslich Geschaeftssemantik in A18.5:** gerichtete
>   Beziehung, keine Handelspartnerschaft, kein Request Partnership. **A7 ist
>   technisch unveraendert**; ob der bestehende Follow-Speicher sicher
>   generalisiert oder ein abgegrenzter Weg noetig ist, misst ein **eigener
>   Follow-Messdurchgang** (O-Reihe), vorher wird nichts gebaut.
> - **Browser-Abnahme am finalen Stand, mit der bekannten Einschraenkung**
>   (Screenshot-/Injection-Timeout am ~1-MB-Dokument, EIN Versuch, keine
>   Serie — C7; abgenommen ueber gerenderten DOM, berechnete Darstellung und
>   echte Element-Klicks, `transferSize` vorher gelesen, 999 KB frisch):
>   fuenfter, abgesetzter Umschalter-Eintrag (Trenner, gestrichelt, aktiv
>   gruen statt Handels-Gold) · Organizer-Sicht: Leerzustand benennt die
>   kommenden Fair-Funktionen, alle 8 Zielnavigations-Eintraege sichtbar
>   gesperrt mit Grund auf der Zeile, Organization Profile mit abgeleiteter
>   Verified-Kennzeichnung + Disclaimer · Navigation vollstaendig
>   durchgesehen: einzige erreichbare Aktionen sind die zwei
>   Cockpit-Eintraege und der Logo-Link, keine Handelsflaeche ·
>   Stichproben unveraendert: Distributor-Dashboard (Fans 3 = abgeleitet,
>   10 Partnerzeilen, kein Partner-Leak), WS-2604 (planning, „Open for
>   applications until 31 Jan 2027"), Guide `#events` (5 Listings, kein
>   Partner-Leak) · C8-Roundtrip: Snapshot v8 traegt `platformPartners` und
>   RVW-3004; danach `BLStore.reset()`, Fixtures nachgemessen unberuehrt.
>
> **Roadmap Fair-Track (V4, O2–O15) — spaetere Ziel-Durchgaenge, kein
> Auftragsbestand:** Fair Series & Editions · Exhibitor Recruiting mit
> Bewerbungs-/Zulassungsworkflow · Staende & Hallen · Fair Participation
> Pages · Termine & Agenda · **Organizer-Profil & Follow (O9/O10, mit
> vorgelagertem Follow-Messdurchgang)** · Opportunities ·
> **Fair-Benachrichtigungen/Organizer-Kommunikation als D10-Erweiterung
> (O11)** · Hero-Medien mit zweigeteilter Abhaengigkeit ·
> Marketing-/Why-Join-Rollout der in A18.6 festgelegten EN-Formeln. Die
> exakten Anker-Wortlaute stehen im V4-Dokument ausserhalb des Repos.
>
> **Was Durchgang 11 bewusst NICHT gebaut hat:** alles im Fair-Track oben ·
> Registrierungsweg fuer Partner · oeffentliche Partner-Flaechen ·
> Media-Partner-Oberflaechen jeder Art (Wert reserviert, sonst nichts) ·
> Aenderungen an Wine-Show-, Member-Event-, Kampagnen- und A7-Mechanik ausser
> der einen praezisen A16.8-Ersetzung (D44).

---

### Arbeitsorganisation — Serges Vorgabe vom 08.08.

Dauerhafte Konvention, nicht der Stand einer Sitzung. Sie steht hier und nicht
in der Spec, weil sie regelt, **wie** gearbeitet wird, nicht was gilt.

1. **`/clear` vor jedem Durchgang.** Ein Durchgang faengt mit leerem Kontext an
   und mit einem Auftrag, der seinen Zuschnitt selbst nennt. Was aus dem
   Zuschnitt herausfaellt, bekommt einen **benannten Ziel-Durchgang**, nie ein
   „spaeter".
2. **Gezielt messen, nicht neu vermessen.** Am Anfang werden **nur die
   Unbekannten** gemessen, kompakt; was in Spec oder HANDOFF steht, wird
   gelesen und nicht nachgezaehlt. **Ein Widerspruch stoppt den Teilschritt** —
   mit einem kurzen, entscheidungsreifen Befund statt einer Umgehung.
3. **Lokale Commits, ein Sammel-Push.** Atomar committen, waehrend gebaut wird;
   **ein** Push am Ende. Ein Zwischen-Push als Wiederherstellungspunkt ist
   erlaubt, wenn ein Durchgang lang ist.
4. **Testumfang: `node tests/run-all.js` einmal am Ende, vollstaendig gruen.**
   Eine neue Zusicherung geht in denselben Commit wie das, was sie motiviert
   hat (C7). Jede Invariante mit **`expectRed`-Gegenprobe** — eine Pruefung, die
   unter ihrer eigenen Gegenmutation gruen bleibt, ist keine.
5. **Gezielte Browser-Abnahme am Ende**, nicht nach jedem Schritt: die
   Hauptpfade des Durchgangs, geklickt statt aufgerufen, plus eine Stichprobe
   auf etwas, das unveraendert geblieben sein muss.
6. **Ein kompakter Abschlussbericht.** Finaler SHA · Commit-Liste kurz ·
   zuschnittsaendernde Messbefunde · Testergebnis · Browser-Ergebnis · offene
   Restpunkte · C8-Ergebnis · Spec-Hinweis. Im Sendevermerk ausserdem **Modell
   und Denkaufwand**.

---

**Nicht Teil dieser Konsolidierung:** das **Matchmaking-Cockpit** (A8, Seek/Offer).
Eigener vermessener Durchgang danach; bis dahin bleibt `matchmaking` als
Reichweitenoption sichtbar gesperrt, mit Begruendung auf dem Schirm.

---

### Offen, in dieser Reihenfolge sinnvoll

> **Korrektur vom 4. August, Serges Vorgabe: Punkt 1 ist nicht mehr der naechste
> Schritt.** Supabase kommt erst, wenn **A16.8 (eigene Events)**, **A8
> (Matchmaking)** und **Messages** entschieden sind. Solange dort noch Tabellen
> entstehen, waere jede Modelaenderung in Supabase eine Migration statt einer
> Stunde Arbeit.

**Die Produktschluessel-Kette (04.08.) ist abgeschlossen und abgenommen** — Repo,
Daten und Sichtpruefung ueber alle Flaechen und Rollen. Der letzte Fund der
Sichtpruefung, ein totes „+ Add line", ist mit `74be029` repariert.

**Die Listings-Kette (05.08.) ist abgeschlossen und abgenommen**, Repo und
Browser, in vier einzeln gepushten Schritten:

| | |
|---|---|
| `4b738a5` | Die Order-Zeile haelt fest, was tatsaechlich geliefert wurde: `vintage` und `batchOrLot`, eingefroren bei `accepted`. Dokumente lesen nur den Snapshot. |
| `339a881` | Sieben leere Zusicherungen in vier Harnesses repariert — siehe die Regel in **C7**. |
| `7e9606c` | `listings` als Beziehungszeile je (Halter, Linie). `wineUnitPrice` ist weg; jeder Preis hat einen Besitzer. |
| `2df920a` | „My Labels" aus den Daten, Zaehler gerechnet, `dnav-labels`. |

Aus diesen zwei Tagen liegt Folgendes:

- **A4 HERKUNFTSANGABEN — hochgestuft, und der Grund ist neu.** Fuenf der sechs
  handgetippten Herkunftsangaben in „My Labels" waren **praeziser als der
  Katalog**: „Sancerre AOC, Loire Valley" gegen „Loire Valley, France",
  „Bordeaux Superieur AOC, France" gegen „Bordeaux, France", „Rioja DOCa
  (Crianza), Rioja Alta" gegen „Rioja Alta, Spain". Seit `2df920a` rendert die
  Seite die groebere Angabe, weil der Katalog der Besitzer ist.
  **Das ist die erste sichtbare Verschlechterung der Woche** — und dieselbe
  Mechanik wie dreimal zuvor: die Unschaerfe war unsichtbar, solange dieselbe
  Angabe an zwei Orten lag.
  **Die sechs genauen Angaben stehen in `2df920a` in der Historie und sind der
  Pruefstein fuer die Kaskade:** kann Country → Region → Appellation
  „Sancerre AOC, Loire Valley" nicht wiedergeben, ist sie zu grob.
  **Diese Verschlechterung ist am 05.08. behoben** — fuenf Katalogzeilen tragen
  die praezise Angabe jetzt selbst, gehoben von Artikelseite und Guide, die bei
  allen fuenf uebereinstimmten. Der A4-Durchgang faengt deshalb nicht mehr bei
  „grob gegen praezise" an, sondern bei den zwei Punkten darunter:

  **ERSTER MESSPUNKT DES A4-DURCHGANGS, und der schaerfste Befund des Tages:**
  **„Terre Siciliane IGT" wird auf drei Katalogzeilen als `origin` benutzt
  (PRD-1007, 1008, 1009) und steht selbst nicht in `wineGeoData`.** Die
  Stammdatentabelle kennt fuer Sizilien fuenf Appellationen — Sicilia DOC,
  Alcamo DOC, Etna DOC, Cerasuolo di Vittoria DOCG, Marsala DOC — und diese
  nicht. **Der Katalog verletzt Invariante 4 also genau dort, wo er praezise
  ist.** Die Kaskade muss diese Angabe wiedergeben koennen, sonst ist sie zu
  grob; das ist der Pruefstein neben „Sancerre AOC, Loire Valley".

  **Zweiter Messpunkt: die Konvention ist uneinheitlich, gemessen 05.08.**
  Zwoelf der 21 Katalogzeilen schreiben Appellation, **Region**
  („Sicilia DOC, Sicily", „Sancerre AOC, Loire Valley"), acht schreiben
  Appellation, **Land** („Rioja DOCa, Spain", „Mosel QbA, Germany",
  „Bourgogne Aligote AOC, France"). Der 05.08.-Durchgang hat die Region-Form
  benutzt, weil sie die Mehrheit ist, und die acht Land-Zeilen **bewusst nicht
  angefasst**: eine bereits praezise Zeile umzuschreiben ist der A4-Durchgang,
  nicht das Nachtragen einer fehlenden.
- **Die verbliebenen festen `profile-section-count`.** Nachgemessen am 07.08.:
  **19 Zaehler, 16 mit Id und zur Laufzeit gerechnet, 3 fest im Markup** — und
  **keiner der 3 ist heute nachweislich falsch.** Beide am 05.08. falschen sind
  weg, aber auf zwei verschiedene Weisen, und die zweite ist die interessante:
  · `My Wine Portfolio (5)` beim Distributor ist mit dem A17-Fixture-Durchgang
    zu `dportfolio-count` geworden und wird gerechnet — jetzt **15** Zeilen in
    `currentWinePortfolio`, weil PRD-1028 dazugekommen ist;
  · `My Wine Portfolio (11)` beim Winzer **stimmt jetzt zufaellig**: Cantina
    Rossi hat mit PRD-1022 aus D41 die elfte Katalogzeile bekommen, also 11
    getippte Zeilen gegen 11 im Buch. **Eine falsche Zahl, die durch eine
    Datenaenderung richtig wurde, ist nicht reparierter Code** — sie geht beim
    naechsten Hinzufuegen wieder kaputt, genau wie `My Wine List (3)` und
    `My Wine Selection (3)`. Fix ist bei allen drei derselbe: aus der Liste
    rechnen.
Danach in dieser Reihenfolge:

- **A3 Retail-Bedingung** — Weinhaus Muellers Auswahl und seine Einkaeufe sind
  **disjunkt**, und seine Auswahl ist zeilengleich mit Bistro Laurents
  Weinkarte. Nach A3 per Ergaenzung: drei Einkaeufe nachtragen (Datum nach der
  C7-Obergrenze, und `tPromoProgress` behauptet bereits 60 Fl. Sauvignon Blanc
  und 48 Fl. Primitivo, die keine Order traegt), drei gekaufte Weine aufnehmen,
  3 → 6. **Spec D35 sagt, was zu tun ist — nicht, dass es getan sei;** die Zeile
  stand bis zum 4.8. faelschlich im Praeteritum, daher die neue Tempus-Regel in
  **C4**.
- **Katalog vervollstaendigen — nur zur Haelfte moeglich, und der Grund ist der
  naechste Punkt.** Nachgemessen am 07.08.: **42 Artikelseiten und 42
  Guide-Zeilen, deckungsgleich**, 28 davon von einem `PRD-`Datensatz benannt,
  **14 verwaist**. Keine der 14 ist eine leere Huelse: **alle 42 Artikelseiten
  tragen exakt 16 Spec-Felder**, einen Erzeugerlink und eine Guide-Zeile.
  Cantina Rossi hat **null** Verwaiste, die anderen fuenf Erzeuger tragen alle 14.
  Von den sieben Weinen, die nur im Distributor-Buch standen, sind alle sieben
  im Katalog: PRD-1026 am 05.08., **die uebrigen sechs mit dem
  A17-Fixture-Durchgang** — sobald sie als normale Erzeugerweine klassifiziert
  waren (D41), gab es keinen Grund mehr, sie draussen zu lassen; sie tragen jetzt
  `ownLabelAvailability` und stehen jedem Distributor im Picker offen.
  `partnerWinesPool` hat damit **27 Zeilen**, insgesamt sind **29 `PRD-`
  Schluessel** vergeben (die 27 plus PRD-1028 und PRD-1029).
  Offen bleiben die 14 verwaisten Artikelseiten; sie haengen zu elf an
  Distributor-Erzeuger-Paaren ohne Partnerschaftszeile. Vorbedingung fuer das
  abgeleitete Portfolio.
- **~~Own-Label-Sichtbarkeit gegen A17.9~~ — ES GAB NIE EINEN WIDERSPRUCH.**
  *Der Punkt stand am 05.08. hier als offene Geschaeftsfrage. Er beruhte auf
  einem Lesefehler von mir, und er bleibt benannt statt getilgt — es ist
  derselbe Fehler wie in A17.0a, und er passiert ein drittes Mal, wenn ihn
  niemand aufschreibt.*
  **Der Fehler: A17.9 als Dauerzustand gelesen, wo er eine PHASENREGEL ist.**
  Der Absatz heisst „Visible ≠ in the book" und beschreibt das Fenster zwischen
  Produkterzeugung und Erstlieferung, mit rein physischer Begruendung — ein Own
  Label existiert nicht, bevor es gemacht ist. **Nach der Erstlieferung ist es
  ein normales Produkt im Buch seines Distributors.** Das ist genau die
  Kollabierung, die A17.0a auseinanderhaelt: *erzeugt ist nicht gefuehrt.*
  **Was A17.9 DAUERHAFT verbietet, ist etwas anderes:** kein anderer Distributor
  sieht das Produkt im **Picker**, darf es auswaehlen, bestellen oder ins Buch
  nehmen; der Winzer darf es niemand anderem anbieten. Das sind
  **Handlungsrechte, keine Anzeigerechte** — und die Tabelle in **A17.13** sagt
  das in ihrer letzten Zeile bereits so („an exclusive product, **in any
  picker**").
  A17.9 traegt seit dem 05.08. einen Satz, der die zwei Ebenen ausdruecklich
  trennt, damit die Fehllesart nicht noch einmal moeglich ist.
  **Nachtrag 07.08., und er raeumt den Rest weg:** dieser Punkt bezog sich auf
  die sechs ueberbrueckten Weine, und die sind **keine Own Labels** (D41). Ihr
  Fehlen im Erzeugerkatalog war also gar kein A17.9-Fall, sondern eine
  Mockup-Luecke — sie stehen seit dem A17-Fixture-Durchgang im Pool. **Der
  A17.9-Fall wird jetzt von den richtigen Zeilen getragen**, und zwar an beiden
  Enden: **PRD-1029** ist erzeugt und vor der Erstlieferung nirgends oeffentlich,
  **PRD-1028** ist nach der Erstlieferung Artikelseite und Guide-Zeile — und
  keines von beiden steht in einem fremden Picker.
  **Die Reichweitenfrage ist am 06.08. entschieden** und steht als **A17.13a**
  in der Spec — der primaere Distributor stellt sie waehrend der Pipeline je
  Produkt ein, sie greift mit der Erstlieferung, und die Stufen sind die
  Taxonomie aus **A16.14b**. Der „Still open"-Block ist ersatzlos weg.
- **Die drei Katalogkopien auf den Profilseiten (D34) — eigener Durchgang,
  haengt am Punkt darueber.** Gemessen 05.08.:
  `bottle-lobby-restaurant-profile.html` und `bottle-lobby-retail-profile.html`
  sind **Zeile fuer Zeile byte-identisch** — kein einziges abweichendes Feld. Es
  sind nicht zwei Buecher, es ist ein Buch in zwei Dateien. Beide tragen 19
  Zeilen, in denen **jedes `winery`-Feld „Hawesko GmbH" heisst** statt des
  Erzeugers; `type`, `note` und `origin` stimmen dagegen ueberall mit der
  23-Zeilen-Fassung in `bottle-lobby-distributor-profile.html` ueberein. **Der
  Fehler steckt in genau einer Spalte.** Die 19 sind eine echte Teilmenge der 23;
  es fehlen vier, alle von Cantina Rossi (Grillo Sicilia DOC, Nero d'Avola
  Sicilia DOC, Primitivo Riserva, Rosato di Sicilia).
- **Zwei Datierungsluecken bei den Partnerschaften**, beide 05.08. gemessen,
  beide **nicht** repariert — Invariante 6, nur frueher:
  `LISTED_AT` ist pauschal `2026-06-01`, und **drei Hawesko-Listings liegen damit
  vor der Partnerschaft, die sie erst erlaubt**: Bodegas Ruiz (1 Tag),
  Chateau Belrieu (29 Tage), Weingut Schmitt (35 Tage). Der Kommentar an
  `LISTED_AT` begruendet das Datum gegen ORD-2029 als fruehestes abhaengiges
  Ereignis — die Partnerschaftsdaten wurden dabei nicht mitgeprueft.
  Dazu nennt der Wine Guide **acht Distributor-Erzeuger-Paare, fuer die es keine
  Partnerschaftszeile gibt** (Aktiv Getraenke → Domaine Lefevre / Weingut
  Schmitt · Hamberger → dieselben zwei · Enoteca Milano → Domaine Lefevre /
  Chateau Belrieu · La Maison du Vin → Henri Dubois · Iberian Wine Partners →
  Bodegas Ruiz). **Elf der 14 verwaisten Artikelseiten haengen an genau diesen
  Paaren** — deshalb gehoert dieser Punkt vor das Nachtragen der 14.
- **Ereignis-Identitaet** — `notifId()` baut Schluessel aus Anzeigetext, die 26
  `events[]`-Eintraege tragen `{at, actor, text}` und keine Id. Dieselbe
  Krankheit wie der Weinname, eine Ebene hoeher.
- **Das abgeleitete Portfolio** — die Verschaerfung vom 4.8. (bestellt **oder**
  mit Zusage praesentiert). Gemessen: von 14 Buchweinen haben **7 weder noch**,
  und **5 kaemen neu hinzu**. Braucht vorher Schluessel, Katalog und die
  Antwort auf die A16.12-Kollision (Regel 2 macht die Vorbestell-Spalte
  strukturell unerreichbar — 4 von 6 Zeilen klappen um, WS-2603 verliert seine
  ganz).

1. ~~**Der Supabase-Start**~~ — *siehe Korrektur oben; ruecken hinter A16.8, A8
   und Messages.* Der Prototyp faelscht drei tragende Dinge (keine Anmeldung,
   keine Rollentrennung auf Serverebene, keine Zugriffsrechte). Regeln: **Spec C7b**.
2. **Die KPI-Kacheln** — alle 16 vermessen: 12 ableitbar, 4 reine Erfindung, kein
   einziges der 16 Deltas hat eine Zeitreihe. Die Entscheidung ist
   **geschaeftlich**, nicht technisch: Plattformzustand oder Unternehmensgroesse.
3. ~~**Herkunftsangaben vereinheitlichen (A4)**~~ — *hochgestuft, siehe oben.*
   Stand hier, solange es nur um Einheitlichkeit ging: **die Uneinheitlichkeit
   war nicht sichtbar, weil dieselben Strings an drei Orten lagen. Erst ein Buch
   macht eine Stammdatenfrage stellbar.** Seit `2df920a` ist es mehr als das —
   eine Fläche zeigt weniger als vorher.
4. **Messages (b), Korrespondenz** — wartet weiter auf die Geschaeftsfrage: wer
   darf wem schreiben, und laeuft das an A6 und A3 vorbei?

Dazu drei kleinere Punkte unter „Aus den Funden vom 03.08." — der
wiederhergestellte Zustand, den nichts prueft, das vergessbare `VERSION`-Bump und
`SHOW_TODAY` als feste Konstante.

---

## Was gebaut wurde — Wegweiser in die Historie

> Diese Datei fuehrt keine Chronik. **Git weiss, WAS gebaut wurde, wann und von
> wem** — hier steht nur, was Git nicht weiss: warum eine Entscheidung so fiel,
> was offen ist, und welche Falle wieder zuschnappt.
>
> Die Regeln aus diesen Durchgaengen stehen in `BOTTLE-LOBBY-SPEC.md`, nicht
> hier. Wer einen Durchgang nachlesen will, nimmt `git show <hash>` — die
> Commit-Messages tragen die Begruendung.

**Die Produktschluessel-Kette (04.08.)** — ein Produkt ist ein Datensatz mit
opakem Schluessel, kein Name. Fuenf Durchgaenge, abgeschlossen und abgenommen;
der letzte Fund war ein totes „+ Add line" (`74be029`).

**Die Listings-Kette (05.08.)** — vier einzeln gepushte und abgenommene Schritte:

| | |
|---|---|
| `4b738a5` | Die Order-Zeile haelt fest, was tatsaechlich geliefert wurde: `vintage` und `batchOrLot`, eingefroren bei `accepted`. Dokumente lesen nur den Snapshot. |
| `339a881` | Sieben leere Zusicherungen in vier Harnesses repariert. |
| `7e9606c` | `listings` als Beziehungszeile je (Halter, Linie). `wineUnitPrice` ist weg; jeder Preis hat einen Besitzer. |
| `2df920a` | „My Labels" aus den Daten, Zaehler gerechnet, `dnav-labels`. |

Davor, in der Historie: Weinbuch je Distributor, Partnerzahlen abgeleitet,
Stakeholder-Kette, Messages-Kette 1–2c, Persistenz, Asset-Stempel, ISO-Umstellung
des Show-Subsystems, A16.5/.7/.11/.12.

---

## Offene Punkte

### Aus den Funden vom 03.08. — keiner davon dringend

**1. Der wiederhergestellte Zustand wird von nichts geprueft.** `assertISO` und
seine Art laufen mit **abgeschalteter Persistenz** — sie lesen die Fixtures. Der
Browser haelt einen Snapshot, und fuer den gibt es keinen Riegel ausser dem
einen Datumsfall in `tests/persistence.js`. Das Muster dahinter ist dasselbe wie
bei zwei Buechern fuer eine Sache, nur liegt die zweite Fassung nicht im Repo,
sondern im Speicher des Browsers — deshalb findet sie keine Suche im Quelltext.

**2. Die naechste Format-Migration kann den `VERSION`-Bump wieder vergessen.**
Ausgesprochene Grenze, kein Versehen — Begruendung und Beleg stehen jetzt in
**Spec C8**. Ein mechanischer Riegel existiert nicht; eine „Format-Generation"
neben `VERSION` ist **bewusst nicht gebaut**, weil sie die Disziplin nur
verschiebt.
*Am 05.08. ist die Grenze zum zweiten Mal erreicht und diesmal getroffen worden.
Der Katalog-Durchgang hat sechs `origin`-Werte und
einen Weinnamen in drei registrierten Sammlungen geaendert, alle Schluessel
unverandert — fuer den Fingerprint unsichtbar. **Nachgewiesen statt vermutet:**
ein Snapshot aus einem zurueckgepatchten Build, ueber die neuen Fixtures
wiederhergestellt, lieferte auf heutigem Code weiterhin „Loire Valley, France"
und „Primitivo Sicilia IGT 2022". Der Nachweis ist reproduzierbar mit
`openTab(area, {patch})` aus `tests/persistence.js` — **die Bauart, die dafuer
da ist, und der bisher einzige Weg, diesen Fall ehrlich zu zeigen.***
*Seit dem A17-Fixture-Durchgang steht `VERSION` auf **5**. Der Bump ist gemessen
begruendet, nicht vorsorglich: die Fingerprints wurden vor und nach dem
Durchgang Sammlung fuer Sammlung verglichen, **zwei von 22 haben ihre Form
geaendert** (`orders`, und `listings` durch den Wegfall von `legacyOwnLabel`).
`currentWinePortfolio` ist der Grund fuer den Bump — es hat mit PRD-1028 eine
Zeile derselben Form dazubekommen, und ein Array faltet auf die **Vereinigung**
der Elementformen, ist fuer Riegel 2 also bauartbedingt unsichtbar. Die
Begruendung steht ausgeschrieben an `VERSION` in `assets/bottle-lobby-store.js`.*

**3. `SHOW_TODAY` ist eine feste Konstante (`'2026-07-31'`).** Faellt nicht auf,
weil die Demo-Daten darum herum gebaut sind. Bis echte Zeit ins Spiel kommt ist
es die richtige Wahl: ein wanderndes „heute" macht jede Abnahme
unreproduzierbar.

### Geschaeftsfragen, die bei Serge liegen

**Die KPI-Kacheln — vollstaendig vermessen 03.08., Entscheidung offen.**
Alle 16 (vier je Rolle) einzeln geprueft: **12 waeren ableitbar, 4 sind reine
Erfindung, und kein einziges der 16 Deltas hat eine Zeitreihe.**

Drei Muster tragen die Entscheidung:

1. **Acht Kacheln sind exakt zaehlbar und schlicht falsch.** „Active Wineries
   **12**" gegen tatsaechlich **6** ist die groesste falsche Zahl, die noch
   steht — und in der Demo die am leichtesten nachzuzaehlende.
2. **Vier sind Schaufensterzahlen** (Profile Views, Avg. Margin ×2, Distributor
   Matches). Die kann keine Ableitung retten.
3. **Zwei Groessenordnungen brechen die Demo-Erzaehlung, wenn man sie zaehlt:**
   „Bottles Moved 180k" wird zu **348**, „Bottles in Distribution 24k" zu
   **1.428**. Das ist der eigentliche Konflikt: eine ehrliche Zahl aus
   Demo-Fixtures sieht aus wie ein Unternehmen ohne Geschaeft.

**Die Frage ist geschaeftlich:** zeigt die Uebersicht *Plattformzustand* (dann
alle 12 ableiten, die 4 und alle 16 Deltas streichen) oder *Unternehmensgroesse*
(dann sind es bewusst Marktzahlen und gehoeren gekennzeichnet, nicht in dieselbe
Kachelreihe wie zaehlbare Werte)? **Der heutige Mischzustand ist der einzige, der
nicht verteidigt werden kann.** Die Antwort gehoert zuerst in die Spec.

**Messages (b), Korrespondenz — wer darf wem schreiben?**
Teil (a), die abgeleiteten Benachrichtigungen, ist gebaut. Teil (b) ist ein
echter eigener Datensatz: „Hawesko GmbH: We'd love to schedule a tasting…" ist
aus nichts ableitbar, das hat jemand geschrieben. Neue Tabelle, Verfassen-Dialog,
Threads — **und vorher eine Geschaeftsentscheidung.** Ein Postfach, in dem ein
Distributor einen Winzer **ohne Partnerschaft** anschreiben kann, ist eine
Aenderung am Modell (A6, A3) und keine Oberflaeche. **Nichts in A1–A17 verlangt
(b) heute.** Die vier `Messages`-Nav-Eintraege stehen weiter tot neben
„Notifications".

**Spec, HANDOFF und CLAUDE.md sind unter der Demo-Domain abrufbar**
(`bottlelobby.netlify.app/BOTTLE-LOBBY-SPEC.md` → 200), weil das
Publish-Directory das Repo-Root ist. Das GitHub-Repo ist ohnehin oeffentlich,
eine Netlify-Sperre gewinnt also wenig — trotzdem eine bewusste Entscheidung
wert, weil dort das vollstaendige Geschaeftsmodell steht. `netlify.toml` koennte
sie mit derselben Redirect-Regel wie `/tests/*` ausschliessen.

**Zwei tote CSS-Klassen: `.profile-badge` und `.badge-own-label`.** Benutzt,
nirgends definiert — Reste der Vor-B9-Konvention. **Kein sichtbarer Defekt**,
alle betroffenen Elemente setzen ihre Werte inline. Seit dem
A17-Fixture-Durchgang stehen sie nicht mehr im Markup, sondern werden von den
Renderern als **Klartext-Literale** ausgegeben; `check-static.js` zaehlt genau
solche Literale seit demselben Durchgang mit, sonst waeren die beiden lautlos
als „nicht mehr benutzt" durchgefallen. Zum Aufraeumen
braucht es zwei optische Entscheidungen, und die liegen bei euch: bleiben die
Inline-Styles und die Klassennamen fallen weg, oder wandern die Werte in echte
Regeln? Solange nichts entschieden ist, fuehrt `check-static.js` sie in
`KNOWN_UNSTYLED`, mit Pruefung in beide Richtungen — die Liste kann das Problem
also nicht ueberleben.

**Kein Rueckweg aus `planning`.** Wird ein beidseitig bestaetigter Wein spaeter
abgelehnt, faellt `showReadiness` auf `false`, die Show bleibt aber in
`planning`. A16.2 kennt keinen Rueckweg, und einen zu erfinden waere ueber den
Auftrag hinausgegangen. Entweder A16.2 um eine Ruecknahme ergaenzen oder bewusst
festhalten, dass `planning` einmal erreicht bestehen bleibt — **offene
Entscheidung, kein Fehler.**

**Der `Simulate Bottle Lobby release (demo)`-Knopf muss weg**, sobald es eine
Admin-Oberflaeche gibt. Er steht nur da, weil der Prototyp kein Staff-Panel hat.
Im Investorengespraech ist die Freigabe das Verkaufsargument (A16.1) — nicht als
Provisorium praesentieren.

**Domain:** `caracterwines.de` steht noch, obwohl die Firma korrekt
**Caracter Media GmbH** heisst.

### Fallen und Merkposten, die noch gelten

**`exhibitorTurn()` kuerzt bei mehreren Weinen ab.** Die Funktion sagt „irgendein
`confirmed` Wein → niemand am Zug". Liegt neben einem bestaetigten Wein ein
weiterer Vorschlag, ist der fuer **beide** Seiten unsichtbar — kein Kasten, kein
Chip, kein Badge. Erreichbar, sobald ein Aussteller mehrere Weine praesentieren
kann, und **A16.4 sieht das ausdruecklich vor** („three wineries with two wines
each"). Dann muss `exhibitorTurn` pro Wein statt pro Aussteller antworten.

**`showAwaits()` zaehlt ein vorliegendes Location-Angebot bewusst NICHT als
Aufgabe des Hosts**, weil er es noch nicht annehmen kann. Sobald die verbindliche
Annahme existiert, gehoert `venueTurn(show) === 'host'` dort hinein — die Stelle
ist im Code so kommentiert.

**`settled_otherwise` fehlt im Prototyp.** A14.7 hatte nie eine „abweichend
vereinbart"-Stufe; sie ist mit A16.11 neu angelegt worden, weil ohne sie eine
ausserhalb der Plattform beglichene Rechnung die Show-Freigabe dauerhaft
blockiert. `PAY_LABEL` kennt sie noch nicht.

**Marge-Block fuer die Winery bleibt bewusst aus**
(`ORDER_ROLES.winery.margin = false`): es gibt kein Feld fuer Produktionskosten,
eine geschaetzte Zahl waere ein A1-Verstoss. Anschalten, sobald echte Kostendaten
existieren. Aus demselben Grund fehlt die **Bestandspruefung** im Auftragsdetail
(A14.9) — sie braucht zuerst ein Lagerbestandsfeld.

**Datenarrays auslagern — angefangen, nicht fertig.** `wineShows` liegt in
`assets/bottle-lobby-data.js`, alle uebrigen Arrays stehen im Dashboard. Der Weg
ist gebahnt und getestet (`tests/load-dashboard.js`), das naechste Array ist also
billig — aber **jeweils ein eigener Durchgang**, damit Fehler zuzuordnen bleiben.

**Persistenz auf den oeffentlichen Seiten — moeglicher zweiter Durchgang.**
Die 16 oeffentlichen Seiten laden `assets/bottle-lobby-data.js` bereits und
koennten den gespeicherten `wineShows`-Stand **nur lesend** uebernehmen; eine im
Dashboard angelegte Show stuende sofort oeffentlich. `BLStore.start({ strict:
false })` kann das schon. **Wichtig: diese Seiten duerfen nie schreiben** — sie
kennen nur `wineShows` und wuerden die uebrigen Sammlungen sonst beim Speichern
loeschen. Ein `readOnly`-Schalter im Store waere der saubere Weg davor.

**Offen bei A16, in empfohlener Reihenfolge:** Catering ab Schritt 3 (A16.11,
vollstaendig spezifiziert, keine offene Entscheidung, und das einzige
angefangene Stueck) · Catering 7–9 (`wine_show_catering` fehlt noch als
`orders.source`) · oeffentliche Profile von Restaurant und Retail · Open Call mit
Master-Data-Filtern (A16.4). **Member Events (A16.8) haengen jetzt an den
Durchgaengen 7 und 8 der Konsolidierung** und stehen nicht mehr einzeln hier.

---

## Hinweise fuer Claude

- **Alle Pruefungen liegen in `tests/`**, einmalig `cd tests && npm install`
  (nur jsdom). Danach ist **`node tests/run-all.js` der komplette Durchlauf** —
  `check-static.js` zuerst, dann die Verhaltens-Harnesses.
  **Jedes neue Harness wird gegen absichtlich kaputte Fassungen gefahren, bevor
  es als fertig gilt** — es sind schon dreimal Mutationen ueberlebt, die Pruefung
  war also jeweils schwaecher als sie aussah.
- **`.ws-*` und `.wse-*` sind zwei verschiedene Praefixe.** Der
  Klassen-Cross-Check muss beide erfassen, sonst faellt eine fehlende
  Statusklasse durch.
- **jsdom laedt `<script src>` nicht.** Ein externes Script wird geparst und
  **nie ausgefuehrt**, ohne Warnung. Deshalb lesen alle Harnesses die Seite ueber
  `tests/load-dashboard.js`. **Jede kuenftige Auslagerung muss ueber diesen
  Loader gehen.** Ausfuehrlich in `tests/README.md`.
