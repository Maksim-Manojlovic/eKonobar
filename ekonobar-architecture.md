# eKonobar — Arhitekturni Dokument v1.0

## Pregled projekta

eKonobar je verifikovana platforma za ugostiteljski sektor u Srbiji koja konobara-
ma pruža prenosivi digitalni pasoš reputacije, vlasnicima lokala omogućava brzo
pronalaženje i verifikaciju osoblja, a headhunterima napredne alate za pretragu
talenata. Platforma direktno preslikava arhitekturu RentCheck-a — NextAuth JWT
sesije, Prisma + PostgreSQL, Mapbox mapa sa klasterovanjem, Bayesian scoring — ali
prilagođava sve entitete i logiku ugostitelju.

---

## 1. Arhitektura profila (Domain Logic)

### 1.1 Tiered Trust Model → tri tipa korisnika

| RentCheck uloga | eKonobar uloga | Šta kontroliše |
|---|---|---|
| `LANDLORD` | `VENUE_OWNER` | Profil lokala, galerija, oglasi, verifikacija iskustva |
| `TENANT` | `WAITER` | Digitalni pasoš, istorija angažmana, veštine, ocene |
| `AGENCY_MEMBER` | `HEADHUNTER` | Napredni filteri pretrage verifikovanih talenata |
| `ADMIN` | `ADMIN` | Moderacija, verifikacija, hotspot analitika |

### 1.2 Verifikacioni nivoi (preslikano na ugostiteljstvo)

```
ID_VERIFIED   → Potvrđen ličnim dokumentom (JMBG) — težina ocene ×1.2
GOLD          → Verifikovano invite kodom od vlasnika lokala
SILVER        → Verifikovano ugovorom o radu (admin odobrio)
UNVERIFIED    → Nepotvrđen nalog
```

### 1.3 Sanitarna knjižica kao poseban verifikacioni sloj

Svaki `WAITER` može uploadovati sanitarnu knjižicu. Admin odobrava → dobija
`sanitaryBookValid: true` badge na pasošu. Vlasnici lokala mogu filtrirati
oglase samo na kandidate sa validnom sanitarnom knjižicom.

---

## 2. Entiteti i relacije (Database Mapping)

### 2.1 Property → Venue (Lokal)

```
Property (RentCheck)          Venue (eKonobar)
─────────────────────         ─────────────────────
address                   →   address
municipality              →   municipality
price (kirija)            →   priceRange (min/max tip po satu)
images[]                  →   images[]
trustScore                →   trustScore (reputacija lokala)
growthInsights (JSON)     →   venueInsights (JSON — blizina zona, tip lokala)
deletedAt                 →   deletedAt (soft-delete)
latitude / longitude      →   latitude / longitude
```

**Novi tagovi za Venue:**
```prisma
cuisineTypes  String[]   // ["italiana", "fast food", "kafić", "fine dining"]
venueType     VenueType  // RESTAURANT | CAFE | BAR | CATERING | HOTEL | EVENT
capacity      Int?       // broj stolova / mesta
```

### 2.2 Review → dvosmerni + gostinski sistem

```
Review (RentCheck)             Review (eKonobar)
────────────────────           ─────────────────────────────────
TENANT_TO_PROPERTY         →   WAITER_TO_VENUE      (konobar ocenjuje lokal)
LANDLORD_TO_TENANT         →   VENUE_TO_WAITER      (lokal ocenjuje konobara)
(novo)                     →   GUEST_TO_WAITER      (gost ocenjuje konobara)
```

**Kategorije ocenjivanja:**

WAITER_TO_VENUE:
- `ratingAtmosphere` — Radna atmosfera
- `ratingOrganization` — Organizacija smena
- `ratingPay` — Redovnost isplate
- `ratingTips` — Sistem podele bakšiša
- `ratingHygiene` — Higijenske uslove
- `ratingManagement` — Komunikacija menadžmenta

VENUE_TO_WAITER:
- `ratingPunctuality` — Tačnost i pouzdanost
- `ratingSkill` — Profesionalne veštine
- `ratingCommunication` — Komunikacija sa gostima
- `ratingHygiene` — Lična higijena
- `ratingTeamwork` — Timski rad
- `ratingSpeed` — Brzina usluge

GUEST_TO_WAITER (zahteva geofencing proveru):
- `ratingFriendliness` — Ljubaznost
- `ratingSpeed` — Brzina usluge
- `ratingAttentiveness` — Pažljivost

### 2.3 Invite → JobPost (Oglas za posao)

```
Invite (RentCheck)             JobPost (eKonobar)
────────────────────           ─────────────────────────────────
expiresAt                  →   applicationDeadline
(jednokratni kod)          →   inviteCode (za direktno pozivanje)
```

**Novi model JobPost:**
```prisma
model JobPost {
  id              String        @id @default(cuid())
  venueId         String
  venue           Venue         @relation(...)
  ownerId         String
  owner           User          @relation(...)

  title           String        // "Iskusan konobar za vikende"
  description     String
  engagementType  EngagementType // FULL_TIME | SEASONAL | WEEKEND | CELEBRATION
  
  salaryMin       Float?
  salaryMax       Float?
  tipSystem       TipSystem     // INDIVIDUAL | SHARED | VENUE_POLICY
  tipDescription  String?       // "Bakšiš se deli 70/30 kuhinja-sala"

  sanitaryRequired Boolean @default(false) // Obavezna sanitarna knjižica
  
  startDate       DateTime?
  endDate         DateTime?     // null za stalne pozicije
  
  redAlert        Boolean @default(false)   // Hitna smena — pulsira na mapi
  redAlertNote    String?                   // "Potreban danas do 18h"
  
  applications    JobApplication[]
  status          JobPostStatus @default(ACTIVE)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([venueId, status])
  @@index([engagementType])
  @@index([redAlert])
}
```

### 2.4 RentalPassport → WaiterPassport (Digitalni pasoš)

```
RentalPassport                 WaiterPassport
────────────────────           ─────────────────────────────────
score                      →   score (0-100 Bayesian)
badges[]                   →   badges[] (iste logike, novi nazivi)
avgStayMonths              →   avgEngagementMonths
reviewCount                →   reviewCount
shareToken                 →   shareToken (vremenski ograničen link)
```

**Novi polja na WaiterPassport:**
```prisma
skills              String[]   // ["cocktail", "fine dining", "kafe aparat", "sommelier"]
languages           String[]   // ["srpski", "engleski", "nemački"]
yearsExperience     Int        @default(0)
sanitaryBookValid   Boolean    @default(false)
sanitaryExpiry      DateTime?
totalEngagements    Int        @default(0)
currentlyAvailable  Boolean    @default(true)
```

### 2.5 GrowthHotspot → VenueZone (Zone na mapi)

```
HotspotType (RentCheck)        ZoneType (eKonobar)
────────────────────           ─────────────────────────────────
EXPO                       →   FESTIVAL_ZONE   (Sajam, festival — sezonska potražnja)
METRO                      →   TRANSIT_HUB     (Čvorište prevoza — veći promet)
INFRASTRUCTURE             →   DEVELOPMENT     (Nova zona razvoja — perspektiva)
NIGHTLIFE                  →   NIGHTLIFE       (Noćni klubovi — vikend smene)
QUIET_ZONE                 →   TOURIST_AREA    (Turistička zona — sezonski rad)
STUDENT_FAKULTETI          →   STUDENT_AREA    (Studentska zona — gosti)
STUDENT_DOM                →   RESIDENTIAL     (Stambena zona — dostava)
```

---

## 3. Ključne funkcionalnosti

### 3.1 Map-Centric Search + Red Alert status

**Marker tipovi:**
```
Standardni marker     → siva/bela pilula sa cenom (€/h ili RSD)
Investment badge      → TrendingUp ikona ako je u perspektivnoj zoni
Red Alert marker      → crvena pulsirajuća tačka + hitna smena
```

**Red Alert implementacija:**
```typescript
// components/map/JobMarker.tsx
{job.redAlert && (
  <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-red-500 animate-ping" />
)}
```

**API filteri za /api/jobs/geojson:**
```
?swLat=&swLng=&neLat=&neLng=  — bounding box
?redAlert=true                  — samo hitne smene
?engagementType=WEEKEND         — tip angažmana
?sanitaryRequired=false         — bez obavezne sanitarne
?availableFrom=2025-06-01       — slobodni od datuma
```

### 3.2 Geofencing verifikacija gostinskih recenzija

Gostinska recenzija (`GUEST_TO_WAITER`) dozvoljena samo unutar radijusa lokala:

```typescript
// lib/geofence.ts
export function isInsideVenueRadius(
  guestLat: number,
  guestLng: number,
  venue: { latitude: number; longitude: number; reviewRadiusKm: number }
): boolean {
  const dist = haversineDistance(
    { lat: guestLat, lng: guestLng },
    { lat: venue.latitude, lng: venue.longitude }
  );
  return dist <= venue.reviewRadiusKm;
}
```

**API flow za GUEST_TO_WAITER:**
```
POST /api/reviews
  → validacija sesije (mora biti GUEST rola ili bilo koji korisnik)
  → if direction === GUEST_TO_WAITER:
      body mora sadržati { guestLatitude, guestLongitude }
      isInsideVenueRadius() → ako false → 403 + "Morate biti u lokalu da biste ostavili recenziju"
  → review kreiran sa status: PENDING, pendingUntil: now + 2h (kraće od RentCheck 48h)
  → geolocationHash: SHA-256(lat+lng+timestamp) → dokaz lokacije
```

**Venue model + radius:**
```prisma
reviewRadiusKm  Float  @default(0.15)  // 150m default za geofencing
```

### 3.3 Digitalni pasoš — automatska istorija rada

Svaki završen angažman automatski se dodaje u `EngagementHistory`:

```
Vlasnik lokala generiše invite kod za konobara
  → Konobar završi angažman
  → PATCH /api/jobs/applications/[id] { status: COMPLETED }
  → triggeruje automatski:
      addEngagementToPassport(waiterId, venueId, jobPostId)
      → kreira EngagementRecord (potvrđeno iskustvo)
      → recalculatePassportScore(waiterId)
      → updatuje WaiterPassport.totalEngagements++
      → updatuje WaiterPassport.avgEngagementMonths
```

**Model EngagementRecord:**
```prisma
model EngagementRecord {
  id            String   @id @default(cuid())
  waiterId      String
  waiter        User     @relation(...)
  venueId       String
  venue         Venue    @relation(...)
  jobPostId     String?
  jobPost       JobPost? @relation(...)
  
  startDate     DateTime
  endDate       DateTime?
  
  engagementType EngagementType
  verified       Boolean @default(false)  // true = vlasnik lokala potvrdio
  verifiedAt     DateTime?
  
  notes          String?   // privatna beleška konobara
  
  createdAt      DateTime @default(now())

  @@index([waiterId])
  @@index([venueId])
}
```

### 3.4 Transparentnost uslova rada (JobPost polja)

Svaki oglas *mora* sadržati (validacija na API nivou):

```typescript
// Obavezna polja za JobPost
const requiredFields = [
  'tipSystem',      // INDIVIDUAL | SHARED | VENUE_POLICY
  'tipDescription', // konkretan opis podele
  'sanitaryRequired', // boolean
  'engagementType', // tip angažmana
];
```

**UI prikaz na kartici oglasa:**
```
┌─────────────────────────────────────────┐
│ 🍽️ Konobar za fine dining             │
│ Restoran Dva Jelena · Skadarlija        │
├─────────────────────────────────────────┤
│ €8-12/h · Vikend · od 1. juna          │
│                                         │
│ 💰 Bakšiš: Zajednički fond, 60% sala   │
│ 📋 Sanitarna: Obavezna                  │
│ 📍 0.3 km od vas                        │
└─────────────────────────────────────────┘
```

---

## 4. Folder struktura

Preslikavamo RentCheck strukturu, menjamo nazive:

```
src/
  app/
    (public)/
      /          → landing page eKonobar
      /venues    → lista lokala (= marketplace)
      /venues/[id] → detalj lokala (= property detail)
      /jobs      → lista oglasa
      /jobs/[id] → detalj oglasa
      /passport/[shareToken] → javni profil konobara (read-only)
      /apply/[jobId] → forma za prijavu (= review wizard)
    (auth)/
      /login
      /register  → odvojeni onboarding za WAITER | VENUE_OWNER | HEADHUNTER
      /onboarding/waiter
      /onboarding/venue
    (dashboard)/
      waiter/    → konobar dashboard
        passport/ → uredi pasoš
        history/  → istorija angažmana
        jobs/     → pretraži oglase
      venue/     → vlasnik lokala dashboard
        jobs/          → moji oglasi
        jobs/new       → kreiraj oglas
        applications/  → prijave na oglase
        reviews/       → recenzije osoblja
        invites/       → pozivnice za verifikaciju
      headhunter/  → headhunter dashboard
        search/      → napredno pretraživanje
        saved/       → sačuvani profili
      admin/
        analytics/zones/  → upravljanje zonama (= hotspots)
        verifications/    → verifikacija sanitarnih knjižica
        moderation/       → moderacija recenzija
    api/
      venues/          → CRUD za lokal
      venues/geojson   → bounding-box GeoJSON za mapu
      jobs/            → CRUD za oglase
      jobs/geojson     → markeri za mapu sa Red Alert filterom
      jobs/applications/ → prijave na oglase
      reviews/         → POST review (sa geofencing provjerom)
      passport/        → GET | POST share token
      invites/         → generisanje pozivnica za verifikaciju
      admin/venues/[id]/ → hard-delete (GDPR)
      admin/zones/       → CRUD za zone na mapi
      verification/sanitary/ → upload sanitarne knjižice
  components/
    layout/   → DashboardShell, RoleGuard, Navbar, SessionExpiryToast (identično)
    ui/       → button, input, card, badge, dialog (identično)
    venue/
      VenueCard.tsx           → (= PropertyCard) sa Red Alert badge
      DeactivateVenueButton.tsx
      VenueInsightsBadge.tsx  → (= InvestmentRadarBadge)
    job/
      JobCard.tsx             → kartice oglasa sa tip/sanitary info
      JobPostForm.tsx         → multi-step forma za kreiranje oglasa
      RedAlertBadge.tsx       → pulsirajući badge
    review/
      ReviewWizard.tsx        → 3-step forma (= postojeći ReviewWizard)
      GuestReviewForm.tsx     → forma za goste (zahteva geolokaciju)
    passport/
      PassportCard.tsx        → (= existng PassportCard)
      EngagementTimeline.tsx  → vizualna istorija rada
      SkillBadges.tsx
    trust-score/
      TrustRadar.tsx          → Recharts radar (identičan, novi labeli)
    map/
      MapSearch.tsx           → (= postojeći MapSearch, nova logika filtera)
      RedAlertPulse.tsx       → animirani marker za hitne smene
    admin/
      ZoneRow.tsx             → (= HotspotRow)
      ZoneForm.tsx            → (= HotspotForm)
  lib/
    auth.ts         → identičan NextAuth setup
    db.ts           → db (soft-delete filter) + dbRaw
    trust-score.ts  → Bayesian scoring (novi labeli dimenzija)
    geofence.ts     → novi — Haversine + isInsideVenueRadius()
    analytics.ts    → getVenueZoneInsights (= getPropertyGrowthInsights)
    sync-scores.ts  → publishDueReviews + syncVenueTrustScore + syncPassportScore
    rate-limit.ts   → identičan DB-backed rate limiter
  design-system/
    tokens.ts       → novi color palette (topli tonovi, hospitality feel)
```

---

## 5. API Route maping (RentCheck → eKonobar)

| RentCheck endpoint | eKonobar endpoint | Napomena |
|---|---|---|
| `POST /api/invites` | `POST /api/invites` | Invite za verifikaciju radnog iskustva |
| `POST /api/reviews` | `POST /api/reviews` | Dodata geofencing provjera za GUEST tip |
| `GET /api/reviews?propertyId=` | `GET /api/reviews?venueId=` | |
| `GET /api/properties/geojson` | `GET /api/venues/geojson` | |
| (novo) | `GET /api/jobs/geojson` | Markeri oglasa + Red Alert |
| `GET /api/hotspots/public` | `GET /api/zones/public` | |
| `POST /api/passport/share` | `POST /api/passport/share` | identičan flow |
| `DELETE /api/admin/properties/[id]` | `DELETE /api/admin/venues/[id]` | GDPR hard-delete |

---

## 6. Score Sync workflow

```
publishDueReviews()               → isti mehanizam (PENDING → PUBLISHED posle 2h/48h)
syncVenueTrustScore(venueId)      → Bayesian po 6 kategorija za lokal
syncPassportScore(waiterId)       → Bayesian po 6 kategorija za konobara
isHighFriction()                  → threshold ≥60 → DISPUTED (identičan)
```

**Dimenzije Trust Radara:**

Za Venue (lokal):
```
atmosphere, organization, pay, tips, hygieneStandards, management
```

Za Waiter (konobar):
```
punctuality, skill, guestCommunication, personalHygiene, teamwork, speed
```

---

## 7. Kritična pravila (Gotchas nasleđeni iz RentCheck)

1. **Zvezdice × 20**: Korisnik bira 1-5 zvezdica → API prima 0-100. Konverzija na klijentu.
2. **db vs dbRaw**: `db` filtrira `deletedAt`. Admin stranice i sync-scores.ts koriste `dbRaw`.
3. **JWT staleness**: Promena uloge zahteva re-login. `session.user.role` dolazi iz tokena, ne iz DB.
4. **Prisma Json null**: Za brisanje `venueInsights`, koristiti `Prisma.DbNull`, ne `null`.
5. **react-map-gl v8**: Import uvek iz `react-map-gl/mapbox`, nikad iz `react-map-gl`.
6. **Geofencing**: `isInsideVenueRadius()` je async zbog Haversine — mora biti `await`-ovan.
7. **Red Alert cache**: `redAlert: true` oglasi se posebno indeksuju — ne koristiti scan po svim oglasima.
8. **Koordinatni jitter**: ~100m stabilan po venueId hash-u, identična logika iz RentCheck.

---

## 8. Environment varijable (dodatne)

```env
# Mapbox (identičan)
NEXT_PUBLIC_MAPBOX_TOKEN=pk.eyJ...

# Geofencing default radius (opciono, fallback u kodu)
DEFAULT_REVIEW_RADIUS_KM=0.15

# Red Alert notifikacije (opciono)
ALERT_WEBHOOK_URL=https://...
```

---

## 9. Preporučeni redosled implementacije

1. **Schema** — Kreirati novi `schema.prisma` sa svim modelima, `db:push`, `db:generate`
2. **Auth** — Kopirati `auth.ts`, ažurirati `Role` enum i JWT claims
3. **Core API rute** — `/api/venues`, `/api/jobs`, `/api/reviews` (sa geofencing)
4. **Passport** — `/api/passport`, `sync-scores.ts` sa novim dimenzijama
5. **Mapa** — `/api/venues/geojson`, `/api/jobs/geojson` sa Red Alert filterom
6. **Dashboard** — waiter | venue | headhunter | admin
7. **Geofencing** — `lib/geofence.ts` + integracija u review API
8. **Zone analitika** — admin panel za upravljanje zonama
9. **Seed** — demo data (lokali, konobari, oglasi, recenzije)

---

*eKonobar v1.0 arhitekturni dokument — generisano na osnovu RentCheck codebase-a*
