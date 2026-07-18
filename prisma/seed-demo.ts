/**
 * Demo seed — visible representation of the discovery features (map, reach,
 * coverage, Red Alert broadcast). ~10 venues + 50 waiters + job posts.
 *
 * Every row is tagged with the `@demo.ekonobar.rs` email domain so it can be
 * removed cleanly and re-run idempotently (the script deletes prior demo rows
 * before inserting). It NEVER touches non-demo data.
 *
 *   npx tsx prisma/seed-demo.ts            # seed (against whatever DATABASE_URL points at)
 *   npx tsx prisma/seed-demo.ts --clean    # only remove demo rows, insert nothing
 *
 * DOUBLE-CHECK which database DATABASE_URL points at before running — this
 * writes 60+ rows.
 */
import { PrismaClient, type VenueType, type PassportTier, type VerificationTier, type EngagementType, type TipSystem } from "@prisma/client";
import { hash } from "bcryptjs";
import { BELGRADE_MUNICIPALITIES } from "../src/lib/geo/municipalities";

const db = new PrismaClient();
const DEMO_DOMAIN = "demo.ekonobar.rs";
const PASSWORD = "Demo1234!";

// Approx opština centers (lng/lat) so map pins land in the right part of the city.
const OPSTINA_CENTER: Record<string, [number, number]> = {
  "Stari grad":   [20.459, 44.818],
  "Vračar":       [20.478, 44.799],
  "Savski venac": [20.455, 44.795],
  "Novi Beograd": [20.415, 44.812],
  "Zvezdara":     [20.520, 44.792],
  "Palilula":     [20.490, 44.812],
  "Voždovac":     [20.490, 44.772],
  "Rakovica":     [20.455, 44.745],
  "Čukarica":     [20.410, 44.760],
  "Zemun":        [20.411, 44.843],
  "Surčin":       [20.281, 44.796],
};

const VENUE_TYPES: VenueType[] = ["RESTAURANT", "CAFE", "BAR", "CATERING", "HOTEL", "EVENT"];
const ENGAGEMENTS: EngagementType[] = ["FULL_TIME", "SEASONAL", "WEEKEND", "CELEBRATION"];
const TIPS: TipSystem[] = ["INDIVIDUAL", "SHARED", "VENUE_POLICY"];
const VERIF: VerificationTier[] = ["UNVERIFIED", "SILVER", "GOLD", "ID_VERIFIED"];
const SKILLS = ["fine dining", "cocktails", "kafe aparat", "sommelier", "brza usluga", "šank", "catering", "vinska karta"];
const LANGS = ["srpski", "engleski", "nemački", "ruski", "italijanski"];

const FIRST = ["Marko", "Ana", "Stefan", "Jelena", "Nikola", "Milica", "Luka", "Sara", "Filip", "Ivana", "Đorđe", "Teodora", "Vuk", "Anja", "Petar", "Katarina", "Uroš", "Mina", "Lazar", "Nina"];
const LAST = ["Nikolić", "Petrović", "Jovanović", "Đorđević", "Stanković", "Ilić", "Marković", "Pavlović", "Kovačević", "Lukić"];

const VENUE_NAMES = ["Kafana Stari Grad", "Bistro Terazije", "Skadarlija Nights", "Beton Hala Bar", "Ada Lounge", "Vračar Coffee", "Zemun Kej", "Dorćol Platz", "Blok 45 Grill", "Kalemegdan View"];

const pick = <T,>(arr: T[], i: number) => arr[i % arr.length];
const rand = (n: number) => Math.floor(Math.random() * n);
const jitter = () => (Math.random() - 0.5) * 0.012; // ~±600m spread within an opština

async function clean() {
  // Order matters: child rows before users. All keyed by the demo email domain.
  const demoUsers = await db.user.findMany({ where: { email: { endsWith: `@${DEMO_DOMAIN}` } }, select: { id: true } });
  const ids = demoUsers.map(u => u.id);
  if (ids.length === 0) return console.log("No demo rows to clean.");
  const venues = await db.venue.findMany({ where: { ownerId: { in: ids } }, select: { id: true } });
  const venueIds = venues.map(v => v.id);
  await db.jobApplication.deleteMany({ where: { OR: [{ waiterId: { in: ids } }, { jobPost: { venueId: { in: venueIds } } }] } });
  await db.jobPost.deleteMany({ where: { venueId: { in: venueIds } } });
  await db.notification.deleteMany({ where: { userId: { in: ids } } });
  await db.waiterPassport.deleteMany({ where: { userId: { in: ids } } });
  await db.venue.deleteMany({ where: { ownerId: { in: ids } } });
  await db.user.deleteMany({ where: { id: { in: ids } } });
  console.log(`Cleaned ${ids.length} demo users and their venues/posts.`);
}

async function seed() {
  const hashed = await hash(PASSWORD, 12);
  const municipalities = Object.keys(OPSTINA_CENTER);

  // One owner owns all venues → log in as this account to see the full owner side.
  const owner = await db.user.create({
    data: { name: "Demo Vlasnik", email: `owner@${DEMO_DOMAIN}`, hashedPassword: hashed, role: "VENUE_OWNER" },
  });

  // ── 10 venues, spread across opštine ──────────────────────────────────────
  const venues = [];
  for (let i = 0; i < 10; i++) {
    const muni = municipalities[i % municipalities.length];
    const [lng, lat] = OPSTINA_CENTER[muni];
    const v = await db.venue.create({
      data: {
        ownerId: owner.id,
        name: VENUE_NAMES[i],
        address: `Ulica ${i + 1}, Beograd`,
        municipality: muni,
        venueType: pick(VENUE_TYPES, i),
        latitude: lat + jitter(),
        longitude: lng + jitter(),
        priceRangeMin: 300 + rand(4) * 100,
        priceRangeMax: 900 + rand(6) * 100,
        trustScore: 50 + rand(45),
        isActive: true,
      },
    });
    venues.push(v);
  }

  // ── ~18 job posts across venues, a few Red Alert ──────────────────────────
  let posts = 0;
  for (let i = 0; i < 18; i++) {
    const v = pick(venues, i);
    await db.jobPost.create({
      data: {
        venueId: v.id,
        ownerId: owner.id,
        title: pick(["Konobar", "Šanker", "Pomoćni konobar", "Sommelier", "Barista", "Runner"], i),
        description: "Tražimo pouzdanog člana tima. Fleksibilno radno vreme, dobra atmosfera.",
        engagementType: pick(ENGAGEMENTS, i),
        tipSystem: pick(TIPS, i),
        salaryMin: 60000 + rand(3) * 10000,
        salaryMax: 90000 + rand(4) * 10000,
        sanitaryRequired: i % 3 === 0,
        redAlert: i % 6 === 0, // ~3 Red Alert posts
        status: "ACTIVE",
      },
    });
    posts++;
  }

  // ── 50 waiters with reach, tiers, scores ──────────────────────────────────
  const now = Date.now();
  for (let i = 0; i < 50; i++) {
    const name = `${pick(FIRST, i)} ${pick(LAST, i)}`;
    const tier: PassportTier = i % 5 === 0 ? "PRO_PLUS" : i % 3 === 0 ? "PRO" : "FREE";
    const active = tier !== "FREE";
    // Reach: 1–3 opštine, weighted toward the urban core so coverage bars vary.
    const reachCount = 1 + rand(3);
    const reach = Array.from({ length: reachCount }, (_, k) => BELGRADE_MUNICIPALITIES[(i * 2 + k * 3) % 11]);
    const u = await db.user.create({
      data: {
        name,
        email: `waiter${i + 1}@${DEMO_DOMAIN}`,
        hashedPassword: hashed,
        role: "WAITER",
        verificationTier: pick(VERIF, i),
        phone: `+3816${1000000 + i}`,
      },
    });
    await db.waiterPassport.create({
      data: {
        userId: u.id,
        score: 40 + rand(56),
        skills: [pick(SKILLS, i), pick(SKILLS, i + 3)],
        languages: [LANGS[0], pick(LANGS, i)],
        yearsExperience: rand(12),
        sanitaryBookValid: i % 2 === 0,
        currentlyAvailable: i % 7 !== 0, // ~43 of 50 available
        workMunicipalities: [...new Set(reach)],
        passportTier: tier,
        subscriptionExpiresAt: active ? new Date(now + 30 * 864e5) : null,
        tierRank: tier === "PRO_PLUS" ? 2 : tier === "PRO" ? 1 : 0,
        bio: "Iskusan član tima, spreman za nove izazove.",
      },
    });
  }

  console.log(`Seeded: 1 owner, ${venues.length} venues, ${posts} job posts, 50 waiters.`);
  console.log(`Login — owner: owner@${DEMO_DOMAIN} · waiter: waiter1@${DEMO_DOMAIN} · password: ${PASSWORD}`);
}

async function main() {
  await clean();
  if (!process.argv.includes("--clean")) await seed();
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => db.$disconnect());
