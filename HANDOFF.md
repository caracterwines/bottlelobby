# Bottle Lobby — Projekt-Übergabe für neuen Chat

**Für Claude:** Lies dieses Dokument vollständig bevor du irgendetwas änderst.
**Kommunikation:** Serge schreibt Deutsch → antworte auf Deutsch. Seiteninhalt = Englisch.
**Stand:** `BottleLobby_Final_89` · 99 HTML + images/ · 0 Fehler (Div, JS, Links) · Distributor: neue "Promotion"-Sektion (My Promo Materials/My Offers/My Deals), über "Network" positioniert

---

## 1. Projekt-Kontext

Statischer HTML/CSS/JS Prototyp von "Bottle Lobby" — B2B SaaS für 4 Weinhandels-Steakholder.
Serge Khaled, Caracter Media GmbH, Karlsbad. Passwort index.html: Kongos88. Live: bottlelobby.netlify.app
Echte Plattform: Next.js/Supabase — Architektur in Claude Memory (30 Einträge) + MEMORY-EINTRAEGE.md.

---

## 2. Zuletzt implementiert

Exclusive Offers/Deals System — siehe Abschnitt 9 (jetzt „Aktueller Zustand", nicht mehr offen).
Nächste offene Punkte: Admin Panel für Partnerschafts-Freischaltung, Impressum vervollständigen, Domain-Entscheidung.
Immer nach Änderungen: sitegesamten Sweep + vollständiges ZIP aller Dateien liefern.

---

## 3. Design-System

Hintergrund #0e0b0b | Text #f7f3ee | Weinrot #6b1a1a | Gold #b8975a
Schriften: Cormorant Garamond (Headings), Inter (Body)

Kanonischer Header: nav padding 1.4rem 3rem, nav-logo 1.35rem, nav-links gap 1.5rem / 0.66rem
11 Links: Market, The Lobby, Why Lobbying, How it Works, Wine Guide, Wine Shows, Own Label, The App, About, Membership, Partners
+ "← Wine Guide" (btn-outline) + "Send Message" (btn-gold)
Referenz-Datei: bottle-lobby-distributor-enoteca-milano-import-srl.html

Kanonischer Footer: 4 Spalten Platform/Company/Account/Contact, "© 2026 Caracter Media GmbH"
Floating-CTA: Member Login + Join Now. NICHT auf dashboard.html oder index.html.
Referenz-Datei: bottle-lobby.html

---

## 4. Datei-Inventar (99 HTML)

KERNSEITEN (13):
index.html (Passwort Kongos88) · bottle-lobby.html (Footer-Referenz) · bottle-lobby-market.html
bottle-lobby-platform.html · bottle-lobby-why-join.html · bottle-lobby-own-label.html
bottle-lobby-wine-guide.html (5 Tabs: Wines/Wineries/Distributors/Restaurants/Retailers)
bottle-lobby-wine-shows.html · bottle-lobby-app.html · bottle-lobby-about.html
bottle-lobby-investor.html · bottle-lobby-contact.html · bottle-lobby-contact-us.html

DASHBOARD & OWNER (5):
bottle-lobby-dashboard.html (#winery/#distributor/#restaurant/#retail)
bottle-lobby-winery-profile.html (Owner Cantina Rossi)
bottle-lobby-distributor-profile.html (Legacy, orphaned)
bottle-lobby-restaurant-profile.html (Owner Bistro Laurent + ?preview=embed)
bottle-lobby-retail-profile.html (Owner Weinhaus Müller + ?preview=embed)
WARNUNG: restaurant-profile/retail-profile NUR für eingeloggten Besitzer. Nie extern verlinken.

PROFIL DEMO SEITE (1): bottle-lobby-profile-demo.html

WINZER-PROFILE (6) — Template: cantina-rossi:
bottle-lobby-winery-cantina-rossi.html (TEMPLATE)
bottle-lobby-winery-domaine-lefevre.html
bottle-lobby-winery-chateau-belrieu.html
bottle-lobby-winery-weingut-schmitt.html
bottle-lobby-winery-henri-dubois-domaine.html
bottle-lobby-winery-bodegas-ruiz.html

DISTRIBUTOR-PROFILE (7) — Template: hawesko-gmbh:
bottle-lobby-distributor-hawesko-gmbh.html (TEMPLATE)
bottle-lobby-distributor-enoteca-milano-import-srl.html (Header-Referenz)
bottle-lobby-distributor-vinorama-nordic-ab.html
bottle-lobby-distributor-iberian-wine-partners-sl.html
bottle-lobby-distributor-la-maison-du-vin-distribution.html
bottle-lobby-distributor-aktiv-getraenke.html
bottle-lobby-distributor-hamberger.html

RESTAURANT-PROFILE — öffentliche Einzelseiten (3):
bottle-lobby-restaurant-bistro-laurent.html (Frankfurt)
bottle-lobby-restaurant-osteria-marconi.html (Milan)
bottle-lobby-restaurant-casa-elena.html (Barcelona)

RETAIL-PROFILE — öffentliche Einzelseiten (4):
bottle-lobby-retail-weinhaus-mueller.html (Munich)
bottle-lobby-retail-vinoteca-roma.html (Rome)
bottle-lobby-retail-cave-a-vins-lyon.html (Lyon)
bottle-lobby-retail-vinstuen-kobenhavn.html (Copenhagen)

WEIN-ARTIKEL (41):
Own-Label (11): primitivo-sicilia-igt · primitivo-riserva · catarratto-biologico · grillo-sicilia-doc
nero-davola-sicilia-doc · rosato-di-sicilia · sauvignon-blanc-sancerre · chardonnay-chablis-premier-cru
tempranillo-rioja-crianza · riesling-spatlese-mosel · merlot-bordeaux-superieur

Regelportfolio je 5:
Cantina Rossi: rosso-di-contrada · trinacria-bianco · baglio-rosso · terra-rossa · costa-bianca
Château Belrieu: chateau-belrieu-grand-vin · blanc-de-belrieu · le-second-de-belrieu · rose-de-belrieu · bordeaux-tradition
Domaine Lefèvre: bourgogne-passetoutgrain · cremant-de-bourgogne · bourgogne-aligote · macon-villages · bourgogne-rouge-pinot-noir
Weingut Schmitt: muller-thurgau-mosel · elbling-mosel · spatburgunder-mosel · riesling-kabinett-trocken-mosel · mosel-sekt-brut
Henri Dubois: sancerre-rouge · sancerre-rose · cremant-de-loire · pouilly-fume · menetou-salon
Bodegas Ruiz: rioja-reserva · rioja-blanco · rioja-rosado · rioja-gran-reserva · rioja-cosecha

REBSORTEN-HUB (19): bottle-lobby-variety-{slug}.html — existieren, NICHT mehr von Wein-Artikeln verlinkt.
Rebsorten-Links: bottle-lobby-wine-guide.html?grape=<encoded>#wines

---

## 5. Welt-Modell (feste Namen — nie erfinden)

WINERIES & DISTRIBUTOREN:
Cantina Rossi (Sicily) → Hawesko GmbH + Enoteca Milano Import Srl
Domaine Lefèvre (Burgundy) → Hawesko GmbH
Château Belrieu (Bordeaux) → Hawesko GmbH
Weingut Schmitt (Mosel) → Hawesko GmbH
Henri Dubois Domaine (Loire) → Hawesko GmbH + La Maison du Vin Distribution
Bodegas Ruiz (Rioja) → Iberian Wine Partners S.L.

DISTRIBUTOR → RESTAURANT/RETAIL:
Hawesko GmbH → Bistro Laurent (Frankfurt), Weinhaus Müller (Munich), Vinstuen København
Enoteca Milano → Osteria Marconi (Milan), Vinoteca Roma (Rome)
Iberian Wine Partners → Casa Elena (Barcelona)
La Maison du Vin → Cave à Vins Lyon (Lyon)

FOLLOW-GRAPH (wineFollowGraph in dashboard.html):
Bistro Laurent → Cantina Rossi, Château Belrieu
Weinhaus Müller → Cantina Rossi
Vinstuen København → Henri Dubois Domaine
Osteria Marconi → Cantina Rossi
Vinoteca Roma → Cantina Rossi
Casa Elena → Weingut Schmitt
Cave à Vins Lyon → Domaine Lefèvre

---

## 6. Kanonische Verlinkungsregeln

BACK-BUTTONS:
Winzer-Profile → wine-guide.html#wineries
Distributor-Profile → wine-guide.html#distributors
Wein-Artikel → wine-guide.html#wines
Restaurant-Profile → wine-guide.html#restaurants
Retail-Profile → wine-guide.html#retailers

BREADCRUMB (Wein-Artikel): Country / Region / Winery-Link / Wine Name
REBSORTEN-LINKS: ?grape=<url-encoded>#wines — NICHT auf Hub-Seiten
DISTRIBUTOR-POPUP: "View Distributors" → Modal, gruppiert Land/Bundesland/Stadt

HERO-BUTTONS (ALLE öffentlichen Profile, Reihenfolge fix):
1. "Request Partnership" — btn-gold — IMMER ERSTE POSITION
2. Rollenspezifisch — btn-gold-outline (Request Tasting/Become a Customer/Discuss Wine List/Wine Selection)
3. "Send Inquiry" — btn-outline
4. "🔖 Save & Follow" — btn-outline follow-btn — IMMER LETZTE POSITION

---

## 7. Dashboard-Architektur

SIDEBAR-STRUKTUR:
Winery: Dashboard/Messages | Basic Info/Wine Portfolio/Press/My Distributors/Wine Fans | Incoming Requests
Distributor: Dashboard/Messages | [My Profile: My Information/My Wine Portfolio/My Labels] |
  [My Partners: My Partnerships/My Requests] | [Promotion: My Promo Materials/My Offers/My Deals] |
  [Network: Matchmaking/My Opportunities/My Stars/My Fans]
Restaurant: Dashboard/Messages(rmsg-badge) | Basic Info/Wine List/My Distributors/Wine Stars | Exclusive Offers/Exclusive Deals/Promo Materials
Retail: Dashboard/Messages(tmsg-badge) | Basic Info/Wine Selection/My Distributors/Wine Stars | Events/Exclusive Offers/Exclusive Deals/Promo Materials

SEKTIONS-IDs:
Winery (w): wsection-fans, wsection-incoming-requests, wsection-active-distributors
Distributor (d): dsection-basics, dsection-wines, dsection-active-partnerships, dsection-requests
  (kombiniert Incoming+Outgoing, Incoming zuerst), dsection-promo, dsection-offers, dsection-deals,
  dsection-opportunities, dsection-winestars, dsection-fans
Restaurant (r): rsection-winestars, rsection-offers(roffers-list), rsection-deals(rdeals-list), rsection-promo(rpromo-list)
Retail (t): tsection-winestars, tsection-offers(toffers-list), tsection-deals(tdeals-list), tsection-promo(tpromo-list)

HINWEIS: Nur beim Distributor umbenannt (nicht bei Winery/Restaurant/Retail): "Basic Information"→"My Information",
"Wine Portfolio"→"My Wine Portfolio", "Promo Materials"→"My Promo Materials", "Opportunities"→"My Opportunities",
"Wine Stars"→"My Stars", "Wine Fans"→"My Fans" — Nav-Label UND Content-Titel gemeinsam.
"My Offers" (Einzel-Angebote) und "My Deals" (Mengen-Deals) sind zwei separate Nav-Reiter, scrollen aber beide
in denselben Seitenbereich (Exclusive Offers direkt über Exclusive Deals).
SIDEBAR-STRUKTUR (nur Distributor, 4 Nav-Sektionen statt ursprünglich einer "Network"-Sektion):
1. "My Profile" — nur noch My Information, My Wine Portfolio, My Labels
2. "My Partners" — My Partnerships, My Requests (aktive/potenzielle Partner)
3. "Promotion" — My Promo Materials, My Offers, My Deals (aus "My Profile" herausgelöst, gleicher
   Sektions-Stil wie "Network", direkt darüber positioniert)
4. "Network" — Matchmaking, My Opportunities, My Stars, My Fans
Noch NICHT auf Winery/Restaurant/Retail übertragen — die behalten die alte, kombinierte Struktur mit
Promo Materials unter dem Haupt-Profil-Nav und den unpräfixierten Labels.
Wine Stars/Wine Fans beim Distributor: generischer wineFollowGraph — Distributor kann Winzer/Restaurants/Retailer
folgen (My Stars) und von ihnen gefolgt werden (My Fans), analog zum bestehenden Winery-Fans/Restaurant-Retail-
Wine-Stars-Muster, jetzt aber rollenübergreifend (roleAv/roleTag/followRoleLabel decken alle 4 Typen ab).
REQUESTS-UMBAU (nur Distributor, noch nicht auf Winery/Restaurant/Retail übertragen): "My Partnerships" scrollt
weiterhin zu "Active Partnerships" oben. Direkt danach kommt jetzt eine neue kombinierte Sektion "Requests"
(dsection-requests) — Incoming Requests (stf-incoming/ir-list) ZUERST, dann Outgoing Requests darunter
(stf-requests/pn-request-list + "How a partnership is formed"-Box) — beide als Unter-Label (.wn-group-title,
Gold-Caps) statt eigenem vollem Section-Header, damit es wie EINE Sektion wirkt. Eigener Sidebar-Reiter
"My Requests" (dnav-requests, im "My Partners"-Block direkt unter "My Partnerships") scrollt direkt dorthin.

---

## 8. Promo Materials — Vollständige Implementierung

DEMO-DATEN (5 Positionen):
1. 12 Wine Glasses — cumulative, 60 Fl. Sauvignon Blanc Sancerre → UNLOCKED (60/60) → zeigt Claim-Button
2. 20 Tasting Stands — newlisting, Riesling Spätlese Mosel → locked
3. 12 Wine Menu Cards — ordervalue €2000 → Restaurant locked (€1450), Retail unlocked (€2150)
4. 1 Decanter — single-order, 60 Fl. Chardonnay Chablis → locked
5. 6 Ice Buckets — cumulative, 60 Fl. Primitivo IGT → 48/60 in progress

DREI ZUSTÄNDE:
locked: Progress + Aktions-Button (Order Now/Add to List/Start Order/Order N Now)
unlocked_unclaimed: 🎉 + Claim-Button + Banner + Messages-Badge-Erhöhung
claimed: ✓ Claimed, fertig

WICHTIG: condLabel(m) gibt Bedingungstext aus — wird auf Restaurant/Retail-Seite in Gold angezeigt.
Jede Zeile zeigt: Icon + Name + Beschreibung + condLabel (Weinname + Menge/€)

DATENBANK (echter Build):
promo_materials: id, distributor_id(FK), name, description, image_url, quantity_per_customer,
  condition_type('volume'|'order_value'), condition_wine_id(FK→wines), condition_bottle_qty,
  condition_order_value, order_mode('cumulative'|'single_order'), status, created_at
promo_claims: partner_id, promo_material_id, claimed_at

AUTOMATION:
INSERT promo_materials → Notification alle aktiven Partner
Schwellenwert überschritten → Notification Partner (bumpMsgBadge)
Claim → Notification Distributor (clearMsgBadge beim Partner)

---

## 9. Exclusive Offers & Deals — IMPLEMENTIERT

Distributor hat den Nav-Reiter "My Offers" (Bugfix: war zuvor doppelt vorhanden und tot, ohne Sektion dahinter) mit 2 CRUD-Unterteilen:

TEIL 1 — EXCLUSIVE OFFERS (Einzel-Wein-Angebote), Sektion dsection-offers:
- Distributor wählt Wein aus Portfolio
- Legt fest: Rabatt-% ODER kostenloses Probier-Paket (gratis) + optionaler Tag (z.B. "New Arrival")
- Sichtbar bei Restaurant/Retail in "Exclusive Offers"-Sektion (roffers-list/toffers-list)

TEIL 2 — EXCLUSIVE DEALS (Mengen-Push, IMMER Einzelbestellung, nie kumulativ), Sektion dsection-deals:
Typ A — Prozentrabatt: Wein wählen + Mindestmenge + Rabatt-Dropdown (5%–50%)
Typ B — Freiware: Reinsortig (Wein-Picker) ODER Gemischt (2+ Weine, Checkboxen) + Ratio-Dropdown (60:6 / 120:12 / 120:24 / 600:180)
  Freiware proportional bei Gemischt: anteilig über die gewählten Weine verteilt.
Sichtbar bei Restaurant/Retail in neuer "Exclusive Deals"-Sektion (rdeals-list/tdeals-list), direkt unter Exclusive Offers.

DEMO-DATEN:
Exclusive Offers:
  - Nero d'Avola Sicilia DOC (Cantina Rossi) → 20% Rabatt, "New Arrival"
  - Pouilly-Fumé (Henri Dubois Domaine) → 6 Flaschen kostenlos, "Introductory Offer"
  (Hinweis: die ursprünglichen Spec-Platzhalter Grenache Blanc/Vermentino existierten nicht im echten
  Hawesko-Portfolio — durch reale Portfolio-Weine ersetzt, um Single-Source-of-Truth zu wahren.)

Exclusive Deals (exakt wie ursprünglich gewünscht, da echte Portfolio-Weine):
  - Typ A: Merlot Bordeaux Supérieur → kaufe 120 → 25% Rabatt
  - Typ B reinsortig: Sauvignon Blanc Sancerre → 60:6
  - Typ B gemischt: Primitivo Sicilia IGT + Baglio Rosso → 120:12 proportional

REQUEST-BUTTON: analog zu Promo Materials, aber KEIN Claim-Workflow — direkte Bestellanfrage jederzeit,
fügt Wein(e) automatisch zur Wine List/Selection hinzu falls noch nicht vorhanden, Toast + Message-Badge.

JS: exclusiveOffers[]/exclusiveDeals[] · offerLabel(o)/dealLabel(d) · renderDistributorOffers/Deals
openOfferModal/saveOffer/deleteOffer · openDealModal/toggleDealType/toggleDealSubtype/saveDeal/deleteDeal
renderExclusiveOffersRestaurant/Retail + renderExclusiveDealsRestaurant/Retail
offerCardHtml/dealCardHtml + handleOfferRequestR/T + handleDealRequestR/T (nutzen promoWineToListEntry())

DATENBANK (echter Build):
exclusive_offers: id, distributor_id(FK), offer_type('discount'|'freesample'), wine_id(FK→wines),
  discount_pct, free_bottles, tag, description, status
exclusive_deals: id, distributor_id(FK), deal_type('discount'|'freegoods'), wine_id(FK→wines, nullable
  bei gemischt), deal_wine_ids(FK-Array für gemischt), subtype('single'|'mixed'),
  ratio_enum('60:6'|'120:12'|'120:24'|'600:180'), min_qty, discount_pct, status
Sichtbarkeit: dieselbe active-partnership-Regel wie Promo Materials. "Request" erzeugt einen
Order/Inquiry-Datensatz, keinen Claim (es gibt keine Freischalt-Bedingung zu tracken).

---

## 10. JS-Funktionsreferenz (dashboard.html)

NAVIGATION: switchDashboard(role,btn) | showWineryView/showDistributorView/showRestaurantView/showRetailView(view,section)

PROMO MATERIALS:
promoMaterials[] (global, 5 Einträge)
rPromoProgress/tPromoProgress = {bottleCounts:{}, orderValue:N, singleOrdered:{}, claimed:{}}
condLabel(m) | isPromoUnlocked(m,wineList,prog) | promoCardHtml(m,wineList,prog,viewerFn,claimFn)
unclaimedBannerHtml(items,wineList,prog)
renderDistributorPromo() | renderRestaurantPromo() | renderRetailPromo()
openPromoModal() | closePromoModal() | togglePromoCondition() | savePromoMaterial() | deletePromoMaterial(id)
handlePromoRequestR(id) | handlePromoClaimR(id) | handlePromoRequestT(id) | handlePromoClaimT(id)
bumpMsgBadge(id) | clearMsgBadge(id)

EXCLUSIVE OFFERS & DEALS (fertig implementiert, kein Claim-Workflow):
exclusiveOffers[] | exclusiveDeals[] (Distributor-eigen)
offerLabel(o) | dealLabel(d)
renderDistributorOffers() | renderDistributorDeals()
openOfferModal()/closeOfferModal()/toggleOfferType()/saveOffer()/deleteOffer(id)
openDealModal()/closeDealModal()/toggleDealType()/toggleDealSubtype()/saveDeal()/deleteDeal(id)
renderExclusiveOffersRestaurant()/Retail() | renderExclusiveDealsRestaurant()/Retail()
offerCardHtml(o,fn) | dealCardHtml(d,fn)
handleOfferRequestR/T(id) | handleDealRequestR/T(id)

FOLLOW/STARS (generisch, alle 4 Rollen): wineFollowGraph[] (follower/followerType + winery=followed-Name/followedType)
roleAv{} | roleTag{} | followRoleLabel{} | renderFansFor(entityName,listId,countId,emptyMsg) | renderWineStarsFor(followerName,listId,countId)
renderWineryFans() | renderDistributorFans() | renderRestaurantWineStars() | renderRetailWineStars() | renderDistributorWineStars()
renderDistributorOpportunities() | goToWineShowPlanning()

WINE LISTS: rCurrentWineList[] | tCurrentWineSelection[] | rPartnerWinesPool[] | tPartnerWinesPool[]
renderWineListR() | renderWineSelectionT()

GENERAL: showToast(msg) | switchTab(tab,btn)

MODAL-CSS-KLASSEN: frow, ffield, flabel, finput, fselect, fsel-wrap, ftextarea, cb-grid, cb-item

---

## 11. Verifikation (nach jeder Änderung)

import re, os, subprocess
ROOT = '/home/claude/bl/'
files = sorted(f for f in os.listdir(ROOT) if f.endswith('.html'))
bad_div, bad_js = [], []
for f in files:
    t = open(ROOT+f, encoding='utf-8', errors='ignore').read()
    o,c = len(re.findall(r'<div\b',t)), len(re.findall(r'</div>',t))
    if o!=c: bad_div.append((f,o,c))
    scripts = re.findall(r'<script>(.*?)</script>',t,re.S)
    if scripts:
        open('/tmp/check.js','w',encoding='utf-8').write('\n'.join(scripts))
        r = subprocess.run(['node','--check','/tmp/check.js'],capture_output=True,text=True)
        if r.returncode!=0: bad_js.append((f,r.stderr[:200]))
print(f'Total: {len(files)} | Div: {len(bad_div)} | JS: {len(bad_js)}')

---

## 12. Architektur-Kernprinzipien (Kurzfassung)

Single Source of Truth: Weine→Winzer | Awards/Press→Winzer | Promo Materials→Distributor | Wine Shows→Gastgeber
Restaurant/Retail sourcen NUR über Distributor (nie direkt vom Winzer).
Partnerschaft: sent→accepted→contract_pending→active (letzter Schritt MANUELL im Admin-Panel).
Freischalt-Status: NIEMALS gespeichert, immer live aus orders/wine-list-Tabellen.
Wine Guide Restaurants/Retailers: im echten Build nur für zahlende Mitglieder sichtbar.

---

*BottleLobby_Final_84 · Juli 2026 · Caracter Media GmbH*
