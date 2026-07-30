# HANDOFF — Sitzungsstand

> Nur das, was Git nicht selbst weiss: offene Punkte, naechste Schritte, laufende Entscheidungen.
> Dateiliste, Dateianzahl und Aenderungshistorie stehen im Repo bzw. in der Git-Historie — nicht hier.
> Dauerhafte Regeln stehen in `BOTTLE-LOBBY-SPEC.md` (Projektwissen), nicht hier.

**Letzte Aktualisierung:** 30. Juli 2026

---

## Infrastruktur

| | |
|---|---|
| Repo | `caracterwines/bottlelobby`, Branch `main` |
| Hosting | Netlify-Projekt `bottlelobby` |
| Live | https://bottlelobby.netlify.app |
| Deploy | automatisch bei jedem Push auf `main` (~7 s) |

Kein Build-Command, Publish-Directory = Repo-Root.

---

## Zuletzt abgeschlossen

- Migration von ZIP-Workflow auf GitHub + Netlify
- GitHub-App `claude-github-mcp-connector` installiert, Schreibzugriff auf `bottlelobby` bestaetigt
- Kompletter Projektstand ins Repo hochgeladen, Netlify-Auto-Deploy verifiziert
- **Bestellsystem (Orders) gebaut** — siehe unten

---

## Bestellsystem — Stand

Gebaut in `bottle-lobby-dashboard.html`: ein gemeinsames `orders`-Array als einzige Wahrheit,
beide Haelften der Lieferkette (Winery <- Distributor <- Restaurant/Retail).
Lebenszyklus `pending -> accepted -> shipped (+Trackingcode) -> delivered`,
plus Seitenzweige `declined` (Verkaeufer) und `cancelled` (Kaeufer).
Request-Buttons bei Exclusive Offers, Deals und Promo Materials erzeugen echte Pending-Orders.

Geprueft per Node-Harness: Statuswechsel, profiluebergreifende Sichtbarkeit,
Tracking-Durchreichung an den Kaeufer, Reorder, Badges.

**Noch nicht visuell im Browser gegengeprueft** — Serge prueft live.

---

## Offene Punkte

- **Datenarrays auslagern:** Bewusst NICHT im selben Durchgang wie das Bestellsystem gemacht, damit ein
  eventueller Fehler eindeutig zuzuordnen bleibt. Geplant: alle Demo-Datenarrays aus
  `bottle-lobby-dashboard.html` nach `assets/bottle-lobby-data.js`, kommentiert als Schema-Vorlage
  fuer den echten Supabase-Bau. Naechster eigener Arbeitsschritt.
- **Dashboard-Groesse:** `bottle-lobby-dashboard.html` ist ~365 KB und damit zu gross, als dass Claude sie
  direkt pushen koennte — Aenderungen daran gehen ueber lokalen Bau + manuellen Upload dieser einen Datei.
  Die Groessentabelle in der Spec (C3) nannte faelschlich 64 KB; das war der veraltete Repo-Stand.
- **Domain:** `caracterwines.de` als Domain/E-Mail steht noch, obwohl die Firma korrekt "Caracter Media GmbH" heisst.
- **Dashboard-Konsistenz:** Die Vier-Sektionen-Aufteilung der Sidebar und die "My ___"-Namenskonvention
  gibt es bisher nur im Distributor-Dashboard.
- **Matchmaking:** In Restaurant- und Retail-Dashboards nur ein nicht funktionaler Platzhalter-Tab.
- **Membership-Gate:** Restaurant- und Retailer-Profile im Wine Guide sind im Prototyp fuer alle sichtbar.
  Im echten Build hinter die Mitgliedschaft (Spec A10).
- **Uebersichts-Widgets:** Winery- und Distributor-Dashboard haben noch kein Orders-Widget auf der
  Startuebersicht (Restaurant und Retail schon). Bewusst ausgelassen, um die dichten Grid-Layouts
  nicht anzufassen.

---

## Hinweise fuer Claude

- Vor jedem Push: div/tag-Balance UND Verschachtelung pruefen, CSS-Klassen-Cross-Check laufen lassen.
- Bei `bottle-lobby-dashboard.html`: immer lokal bauen, `node --check` auf den Script-Block,
  dann als einzelne Datei zur Uebergabe.
