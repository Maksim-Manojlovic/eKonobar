import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

const TEST_PASSWORD = "Test1234!";

async function main() {
  const hashedPassword = await hash(TEST_PASSWORD, 12);

  // ── Users ────────────────────────────────────────────────────────────────

  const waiter = await prisma.user.upsert({
    where: { email: "waiter@test.com" },
    update: {},
    create: { name: "Marko Nikolić", email: "waiter@test.com", hashedPassword, role: "WAITER" },
  });

  const venueOwner = await prisma.user.upsert({
    where: { email: "venue@test.com" },
    update: {},
    create: { name: "Petar Jovanović", email: "venue@test.com", hashedPassword, role: "VENUE_OWNER" },
  });

  await prisma.user.upsert({
    where: { email: "admin@test.com" },
    update: {},
    create: { name: "Test Admin", email: "admin@test.com", hashedPassword, role: "ADMIN" },
  });

  console.log("✓ Users seeded");

  // ── Venues ───────────────────────────────────────────────────────────────

  const venue1 = await prisma.venue.upsert({
    where: { id: "seed-venue-1" },
    update: {},
    create: {
      id: "seed-venue-1",
      ownerId: venueOwner.id,
      name: "Kafana Skadarlija",
      address: "Skadarska 32",
      municipality: "Stari Grad",
      city: "Beograd",
      venueType: "RESTAURANT",
      latitude: 44.8185,
      longitude: 20.4625,
      capacity: 80,
      phone: "+381 11 123 4567",
      website: "kafanaskadarlija.rs",
      instagram: "@kafanaskadarlija",
      priceRangeMin: 2000,
      priceRangeMax: 4500,
      trustScore: 86,
    },
  });

  const venue2 = await prisma.venue.upsert({
    where: { id: "seed-venue-2" },
    update: {},
    create: {
      id: "seed-venue-2",
      ownerId: venueOwner.id,
      name: "Bar Mixer",
      address: "Knez Mihailova 14",
      municipality: "Stari Grad",
      city: "Beograd",
      venueType: "BAR",
      latitude: 44.8196,
      longitude: 20.4572,
      capacity: 40,
      phone: "+381 11 234 5678",
      instagram: "@barmixer_bgd",
      priceRangeMin: 1800,
      priceRangeMax: 3500,
      trustScore: 78,
    },
  });

  console.log("✓ Venues seeded");

  // ── Job Posts ─────────────────────────────────────────────────────────────

  const job1 = await prisma.jobPost.upsert({
    where: { id: "seed-job-1" },
    update: {},
    create: {
      id: "seed-job-1",
      venueId: venue1.id,
      ownerId: venueOwner.id,
      title: "Senior Konobar",
      description: "Tražimo iskusnog konobara za stalno radno mesto. Minimalno 2 godine iskustva u fine-dining okruženju. Poznavanje engleskog jezika je prednost.",
      engagementType: "FULL_TIME",
      tipSystem: "INDIVIDUAL",
      salaryMin: 85000,
      salaryMax: 100000,
      sanitaryRequired: true,
      status: "ACTIVE",
    },
  });

  const job2 = await prisma.jobPost.upsert({
    where: { id: "seed-job-2" },
    update: {},
    create: {
      id: "seed-job-2",
      venueId: venue1.id,
      ownerId: venueOwner.id,
      title: "Konobar — vikend smene",
      description: "Potreban konobar za subotu i nedjelju. Radno iskustvo poželjno ali nije obavezno. Mladi tim, dobra atmosfera.",
      engagementType: "WEEKEND",
      tipSystem: "SHARED",
      salaryMin: 3000,
      salaryMax: 3500,
      sanitaryRequired: true,
      redAlert: true,
      redAlertNote: "Potreban već ovaj vikend!",
      status: "ACTIVE",
    },
  });

  const job3 = await prisma.jobPost.upsert({
    where: { id: "seed-job-3" },
    update: {},
    create: {
      id: "seed-job-3",
      venueId: venue2.id,
      ownerId: venueOwner.id,
      title: "Šank-asistent",
      description: "Tražimo šank-asistenta za popodnevne i večernje smene. Potrebno poznavanje koktela i rada za šankom.",
      engagementType: "SEASONAL",
      tipSystem: "INDIVIDUAL",
      salaryMin: 2500,
      salaryMax: 3000,
      sanitaryRequired: false,
      status: "ACTIVE",
    },
  });

  const job4 = await prisma.jobPost.upsert({
    where: { id: "seed-job-4" },
    update: {},
    create: {
      id: "seed-job-4",
      venueId: venue2.id,
      ownerId: venueOwner.id,
      title: "Konobar za proslavu",
      description: "Jednokratni angažman za privatnu proslavu 15. maja. Iskustvo na privatnim proslavama je prednost.",
      engagementType: "CELEBRATION",
      tipSystem: "VENUE_POLICY",
      tipDescription: "Bakšiš pripada konobarima u celosti.",
      salaryMin: 4000,
      salaryMax: 4000,
      sanitaryRequired: true,
      status: "FILLED",
    },
  });

  console.log("✓ Job posts seeded");

  // ── Applications ─────────────────────────────────────────────────────────

  await prisma.jobApplication.upsert({
    where: { jobPostId_waiterId: { jobPostId: job1.id, waiterId: waiter.id } },
    update: {},
    create: {
      jobPostId: job1.id,
      waiterId: waiter.id,
      coverNote: "Imam 4 godine iskustva u fine-dining restoranima. Pričam engleski i nemački. Sanitarna knjižica je važeća.",
      status: "PENDING",
    },
  });

  await prisma.jobApplication.upsert({
    where: { jobPostId_waiterId: { jobPostId: job2.id, waiterId: waiter.id } },
    update: {},
    create: {
      jobPostId: job2.id,
      waiterId: waiter.id,
      coverNote: "Slobodan ovaj vikend, mogu odmah.",
      status: "ACCEPTED",
    },
  });

  console.log("✓ Applications seeded");

  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Test accounts (password: ${TEST_PASSWORD})
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Waiter:      waiter@test.com
  Venue owner: venue@test.com  (2 venues, 4 posts)
  Admin:       admin@test.com
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
