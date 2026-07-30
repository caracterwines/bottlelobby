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

- Migration von ZIP-Workflow auf GitHub + Netlify (30.07.2026)
- GitHub-App `claude-github-mcp-connector` installiert, Schreibzugriff auf `bottlelobby` bestaetigt
- Kompletter Projektstand aus `BottleLobby_Final_89_1.zip` ins Repo hochgeladen (Commit `eef1c7f`)
- Netlify-Auto-Deploy verifiziert

---

## Offene Punkte

- **Domain:** `caracterwines.de` als Domain/E-Mail steht noch, obwohl die Firma jetzt korrekt "Caracter Media GmbH" heisst. Serge muss entscheiden, ob die Domain ebenfalls wechselt.
- **Dashboard-Konsistenz:** Die Vier-Sektionen-Aufteilung der Sidebar (My Profile / My Partners / Promotion / Network) und die "My ___"-Namenskonvention gibt es bisher nur im Distributor-Dashboard. Winery, Restaurant und Retail haben weiterhin eine kombinierte "Network"-Sektion und die alten Labels.
- **Matchmaking:** In Restaurant- und Retail-Dashboards existiert nur ein nicht funktionaler Platzhalter-Tab, analog zu Winery/Distributor.
- **Membership-Gate:** Restaurant- und Retailer-Profile im Wine Guide sind im Prototyp fuer alle sichtbar. Im echten Build muessen sie hinter der Mitgliedschaft liegen (siehe Spec A10). Aktuell nur als Inline-Hinweis in der UI vermerkt.

---

## Naechste Schritte

Noch nicht festgelegt — wird zu Beginn der naechsten Session mit Serge abgestimmt.

---

## Hinweise fuer Claude

- Grosse Dateien (`winery-profile.html`, `profile-demo.html`, `why-join.html`, `distributor-profile.html`) kosten beim Push jeweils einen kompletten Datei-Rewrite. Bei vielen Aenderungen daran vorher den lokalen/ZIP-Weg vorschlagen (siehe Spec C3).
- Vor jedem Push: div/tag-Balance UND Verschachtelung pruefen, CSS-Klassen-Cross-Check laufen lassen.
