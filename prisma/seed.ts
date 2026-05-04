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

  const waiter2 = await prisma.user.upsert({
    where: { email: "waiter2@test.com" },
    update: {},
    create: { name: "Ana Petrović", email: "waiter2@test.com", hashedPassword, role: "WAITER" },
  });

  const waiter3 = await prisma.user.upsert({
    where: { email: "waiter3@test.com" },
    update: {},
    create: { name: "Stefan Đorđević", email: "waiter3@test.com", hashedPassword, role: "WAITER" },
  });

  const waiter4 = await prisma.user.upsert({
    where: { email: "waiter4@test.com" },
    update: {},
    create: { name: "Jelena Milošević", email: "waiter4@test.com", hashedPassword, role: "WAITER" },
  });

  const waiter5 = await prisma.user.upsert({
    where: { email: "waiter5@test.com" },
    update: {},
    create: { name: "Nikola Stanković", email: "waiter5@test.com", hashedPassword, role: "WAITER" },
  });

  const waiter6 = await prisma.user.upsert({
    where: { email: "waiter6@test.com" },
    update: {},
    create: { name: "Milica Vasić", email: "waiter6@test.com", hashedPassword, role: "WAITER" },
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

  await prisma.jobApplication.upsert({
    where: { jobPostId_waiterId: { jobPostId: job1.id, waiterId: waiter2.id } },
    update: {},
    create: {
      jobPostId: job1.id,
      waiterId: waiter2.id,
      coverNote: "Tri godine iskustva u a la carte restoranima.",
      status: "ACCEPTED",
    },
  });

  await prisma.jobApplication.upsert({
    where: { jobPostId_waiterId: { jobPostId: job1.id, waiterId: waiter3.id } },
    update: {},
    create: {
      jobPostId: job1.id,
      waiterId: waiter3.id,
      coverNote: "Iskusan konobar, dostupan odmah.",
      status: "ACCEPTED",
    },
  });

  await prisma.jobApplication.upsert({
    where: { jobPostId_waiterId: { jobPostId: job2.id, waiterId: waiter4.id } },
    update: {},
    create: {
      jobPostId: job2.id,
      waiterId: waiter4.id,
      coverNote: "Volim rad sa gostima, fleksibilna sam po pitanju smena.",
      status: "ACCEPTED",
    },
  });

  await prisma.jobApplication.upsert({
    where: { jobPostId_waiterId: { jobPostId: job3.id, waiterId: waiter5.id } },
    update: {},
    create: {
      jobPostId: job3.id,
      waiterId: waiter5.id,
      coverNote: "Radim šank dve godine, znam pripremu koktela.",
      status: "ACCEPTED",
    },
  });

  await prisma.jobApplication.upsert({
    where: { jobPostId_waiterId: { jobPostId: job3.id, waiterId: waiter6.id } },
    update: {},
    create: {
      jobPostId: job3.id,
      waiterId: waiter6.id,
      coverNote: "Dostupna za popodnevne i večernje smene.",
      status: "ACCEPTED",
    },
  });

  console.log("✓ Applications seeded");

  // ── Waiter Passports ─────────────────────────────────────────────────────

  const passport1 = await prisma.waiterPassport.upsert({
    where: { userId: waiter.id },
    update: {},
    create: {
      userId: waiter.id,
      score: 87,
      bio: "Konobar sa 5 godina iskustva u fine-dining i kafanama. Specijalizovan za somelijerstvo i koktel kulturu.",
      skills: ["fine dining", "sommelier", "cocktails", "wine"],
      languages: ["srpski", "engleski", "nemački"],
      yearsExperience: 5,
      currentlyAvailable: true,
      sanitaryBookValid: true,
      sanitaryExpiry: new Date("2026-12-31"),
      badges: ["sanitarna", "english_b2", "verified_history"],
      reviewCount: 8,
      totalEngagements: 12,
    },
  });

  const passport2 = await prisma.waiterPassport.upsert({
    where: { userId: waiter2.id },
    update: {},
    create: {
      userId: waiter2.id,
      score: 74,
      bio: "Fleksibilna konobarica dostupna za vikend smene i proslave.",
      skills: ["usluga", "kasa", "event service"],
      languages: ["srpski", "engleski"],
      yearsExperience: 3,
      currentlyAvailable: true,
      sanitaryBookValid: false,
      badges: ["verified_history"],
      reviewCount: 5,
      totalEngagements: 7,
    },
  });

  const passport3 = await prisma.waiterPassport.upsert({
    where: { userId: waiter3.id },
    update: {},
    create: {
      userId: waiter3.id,
      score: 91,
      bio: "Iskusan konobar, specijalizovan za noćni klub okruženja i bar servis.",
      skills: ["bar service", "cocktails", "nightlife", "flair"],
      languages: ["srpski", "engleski", "italijanski"],
      yearsExperience: 7,
      currentlyAvailable: false,
      sanitaryBookValid: true,
      sanitaryExpiry: new Date("2027-03-15"),
      badges: ["sanitarna", "english_b2", "sommelier", "verified_history", "hospitality_pro"],
      reviewCount: 15,
      totalEngagements: 23,
    },
  });

  const passport4 = await prisma.waiterPassport.upsert({
    where: { userId: waiter4.id },
    update: {},
    create: {
      userId: waiter4.id,
      score: 68,
      bio: "Mlada i motivišana konobarica, odlična komunikacija sa gostima.",
      skills: ["gost komunikacija", "usluga", "kasa"],
      languages: ["srpski"],
      yearsExperience: 2,
      currentlyAvailable: true,
      sanitaryBookValid: false,
      badges: [],
      reviewCount: 3,
      totalEngagements: 4,
    },
  });

  const passport5 = await prisma.waiterPassport.upsert({
    where: { userId: waiter5.id },
    update: {},
    create: {
      userId: waiter5.id,
      score: 82,
      bio: "Šanker sa iskustvom u barovima i noćnim klubovima. Znam pripremu svih vrsta koktela.",
      skills: ["bar service", "cocktails", "flair bartending", "wine"],
      languages: ["srpski", "engleski"],
      yearsExperience: 4,
      currentlyAvailable: true,
      sanitaryBookValid: true,
      sanitaryExpiry: new Date("2026-09-30"),
      badges: ["sanitarna", "verified_history"],
      reviewCount: 9,
      totalEngagements: 14,
    },
  });

  const passport6 = await prisma.waiterPassport.upsert({
    where: { userId: waiter6.id },
    update: {},
    create: {
      userId: waiter6.id,
      score: 79,
      bio: "Posvećena konobarica sa iskustvom u kafićima i restoranima.",
      skills: ["kafa", "latte art", "servis", "usluga"],
      languages: ["srpski", "engleski", "francuski"],
      yearsExperience: 4,
      currentlyAvailable: false,
      sanitaryBookValid: true,
      sanitaryExpiry: new Date("2026-11-20"),
      badges: ["sanitarna", "english_b2"],
      reviewCount: 6,
      totalEngagements: 9,
    },
  });

  console.log("✓ Passports seeded");

  // ── Waiter Trust Scores ───────────────────────────────────────────────────

  await prisma.passportTrustScore.upsert({
    where: { passportId: passport1.id },
    update: {},
    create: {
      passportId: passport1.id,
      punctuality: 90, skill: 88, guestCommunication: 85,
      personalHygiene: 92, teamwork: 86, speed: 84,
      composite: 87, sampleSize: 8,
    },
  });

  await prisma.passportTrustScore.upsert({
    where: { passportId: passport3.id },
    update: {},
    create: {
      passportId: passport3.id,
      punctuality: 95, skill: 93, guestCommunication: 90,
      personalHygiene: 94, teamwork: 89, speed: 91,
      composite: 92, sampleSize: 15,
    },
  });

  await prisma.passportTrustScore.upsert({
    where: { passportId: passport5.id },
    update: {},
    create: {
      passportId: passport5.id,
      punctuality: 85, skill: 84, guestCommunication: 80,
      personalHygiene: 88, teamwork: 82, speed: 83,
      composite: 84, sampleSize: 9,
    },
  });

  console.log("✓ Trust scores seeded");

  // ── Engagement Records ────────────────────────────────────────────────────

  await prisma.engagementRecord.upsert({
    where: { id: "seed-eng-1" },
    update: {},
    create: {
      id: "seed-eng-1",
      waiterId: waiter.id,
      venueId: venue1.id,
      engagementType: "FULL_TIME",
      startDate: new Date("2023-01-15"),
      endDate: new Date("2024-06-30"),
      verified: true,
      verifiedAt: new Date("2024-07-01"),
      notes: "Senior Konobar",
    },
  });

  await prisma.engagementRecord.upsert({
    where: { id: "seed-eng-2" },
    update: {},
    create: {
      id: "seed-eng-2",
      waiterId: waiter.id,
      venueId: venue2.id,
      engagementType: "WEEKEND",
      startDate: new Date("2024-07-01"),
      endDate: null,
      verified: true,
      verifiedAt: new Date("2024-08-01"),
      notes: "Šanker",
    },
  });

  await prisma.engagementRecord.upsert({
    where: { id: "seed-eng-3" },
    update: {},
    create: {
      id: "seed-eng-3",
      waiterId: waiter3.id,
      venueId: venue2.id,
      engagementType: "FULL_TIME",
      startDate: new Date("2022-03-01"),
      endDate: new Date("2023-12-31"),
      verified: true,
      verifiedAt: new Date("2024-01-05"),
      notes: "Bar Manager",
    },
  });

  await prisma.engagementRecord.upsert({
    where: { id: "seed-eng-4" },
    update: {},
    create: {
      id: "seed-eng-4",
      waiterId: waiter5.id,
      venueId: venue2.id,
      engagementType: "SEASONAL",
      startDate: new Date("2024-05-01"),
      endDate: null,
      verified: false,
    },
  });

  console.log("✓ Engagement records seeded");

  // ── Venue Trust Scores ────────────────────────────────────────────────────

  await prisma.venueTrustScore.upsert({
    where: { venueId: venue1.id },
    update: {},
    create: {
      venueId: venue1.id,
      atmosphere: 88, organization: 84, pay: 80,
      tips: 75, hygieneStandards: 90, management: 82,
      composite: 83, sampleSize: 6,
    },
  });

  await prisma.venueTrustScore.upsert({
    where: { venueId: venue2.id },
    update: {},
    create: {
      venueId: venue2.id,
      atmosphere: 76, organization: 78, pay: 74,
      tips: 82, hygieneStandards: 80, management: 75,
      composite: 77, sampleSize: 4,
    },
  });

  console.log("✓ Venue trust scores seeded");

  // ── Published Reviews ─────────────────────────────────────────────────────

  await prisma.review.upsert({
    where: { id: "seed-rev-1" },
    update: {},
    create: {
      id: "seed-rev-1",
      authorId: waiter.id,
      direction: "WAITER_TO_VENUE",
      venueId: venue1.id,
      overallRating: 84,
      comment: "Kafana Skadarlija je jedno od najlepših radnih mesta. Organizacija je odlična, gosti su kulturni, plata dolazi na vreme.",
      ratingAtmosphere: 88, ratingOrganization: 84, ratingPay: 80,
      ratingTips: 76, ratingHygieneWork: 90, ratingManagement: 82,
      status: "PUBLISHED",
      weight: 1.0,
      pendingUntil: new Date("2024-01-01"),
      publishedAt: new Date("2024-03-15"),
    },
  });

  await prisma.review.upsert({
    where: { id: "seed-rev-2" },
    update: {},
    create: {
      id: "seed-rev-2",
      authorId: waiter3.id,
      direction: "WAITER_TO_VENUE",
      venueId: venue2.id,
      overallRating: 76,
      comment: "Bar Mixer ima dobru atmosferu i redovne goste. Napojnice su ok, ali organizacija šihti mogla bi biti bolja.",
      ratingAtmosphere: 80, ratingOrganization: 72, ratingPay: 70,
      ratingTips: 84, ratingHygieneWork: 78, ratingManagement: 74,
      status: "PUBLISHED",
      weight: 1.0,
      pendingUntil: new Date("2024-01-01"),
      publishedAt: new Date("2024-04-02"),
    },
  });

  await prisma.review.upsert({
    where: { id: "seed-rev-3" },
    update: {},
    create: {
      id: "seed-rev-3",
      authorId: venueOwner.id,
      direction: "VENUE_TO_WAITER",
      subjectId: waiter.id,
      venueId: venue1.id,
      overallRating: 88,
      comment: "Marko je izuzetan konobar. Brz, pouzdan i odlično komunicira sa gostima. Topla preporuka.",
      ratingPunctuality: 92, ratingSkill: 88, ratingGuestCommunication: 86,
      ratingPersonalHygiene: 90, ratingTeamwork: 84, ratingSpeed: 86,
      status: "PUBLISHED",
      weight: 1.0,
      pendingUntil: new Date("2024-01-01"),
      publishedAt: new Date("2024-06-20"),
    },
  });

  await prisma.review.upsert({
    where: { id: "seed-rev-4" },
    update: {},
    create: {
      id: "seed-rev-4",
      authorId: venueOwner.id,
      direction: "VENUE_TO_WAITER",
      subjectId: waiter3.id,
      venueId: venue2.id,
      overallRating: 92,
      comment: "Stefan je profesionalac. Zna posao, gosti ga vole, uvek tačan.",
      ratingPunctuality: 96, ratingSkill: 92, ratingGuestCommunication: 90,
      ratingPersonalHygiene: 94, ratingTeamwork: 90, ratingSpeed: 92,
      status: "PUBLISHED",
      weight: 1.0,
      pendingUntil: new Date("2024-01-01"),
      publishedAt: new Date("2024-05-10"),
    },
  });

  console.log("✓ Reviews seeded");

  // ── Sanitary Books ────────────────────────────────────────────────────────

  await prisma.sanitaryBook.upsert({
    where: { userId: waiter.id },
    update: {},
    create: {
      userId: waiter.id,
      fileUrl: "https://example.com/sanitary/marko.pdf",
      status: "APPROVED",
      expiryDate: new Date("2026-12-31"),
      reviewedAt: new Date("2024-02-01"),
    },
  });

  await prisma.sanitaryBook.upsert({
    where: { userId: waiter3.id },
    update: {},
    create: {
      userId: waiter3.id,
      fileUrl: "https://example.com/sanitary/stefan.pdf",
      status: "APPROVED",
      expiryDate: new Date("2027-03-15"),
      reviewedAt: new Date("2024-01-15"),
    },
  });

  await prisma.sanitaryBook.upsert({
    where: { userId: waiter2.id },
    update: {},
    create: {
      userId: waiter2.id,
      fileUrl: "https://example.com/sanitary/ana.pdf",
      status: "PENDING",
      expiryDate: new Date("2026-08-20"),
    },
  });

  await prisma.sanitaryBook.upsert({
    where: { userId: waiter4.id },
    update: {},
    create: {
      userId: waiter4.id,
      fileUrl: "https://example.com/sanitary/jelena.pdf",
      status: "PENDING",
      expiryDate: new Date("2027-01-10"),
    },
  });

  console.log("✓ Sanitary books seeded");

  // ── Zones ─────────────────────────────────────────────────────────────────

  await prisma.venueZone.upsert({
    where: { id: "seed-zone-1" },
    update: {},
    create: {
      id: "seed-zone-1",
      name: "Savamala noćna zona",
      zoneType: "NIGHTLIFE",
      centerLat: 44.8103,
      centerLng: 20.4489,
      radiusKm: 0.8,
      projectedGrowthPercent: 35,
      operatorTip: "Visoka potražnja petkom i subotom 22h-04h. Preporučujemo ekstra angažmane za vikende.",
      geoJson: {},
      isActive: true,
    },
  });

  await prisma.venueZone.upsert({
    where: { id: "seed-zone-2" },
    update: {},
    create: {
      id: "seed-zone-2",
      name: "Stari Grad restoranska zona",
      zoneType: "TOURIST_AREA",
      centerLat: 44.8178,
      centerLng: 20.4590,
      radiusKm: 1.2,
      projectedGrowthPercent: 22,
      operatorTip: "Turistička sezona april–oktobar. Predlažemo konobara koji govori engleski.",
      geoJson: {},
      isActive: true,
    },
  });

  await prisma.venueZone.upsert({
    where: { id: "seed-zone-3" },
    update: {},
    create: {
      id: "seed-zone-3",
      name: "Studentski kvartal Vračar",
      zoneType: "STUDENT_AREA",
      centerLat: 44.8015,
      centerLng: 20.4758,
      radiusKm: 1.0,
      projectedGrowthPercent: 18,
      operatorTip: "Popodnevne smene su najpopularnije. Potražnja raste u ispitnim rokovima.",
      geoJson: {},
      isActive: true,
    },
  });

  console.log("✓ Zones seeded");

  // ── Headhunter + Saved Profiles ───────────────────────────────────────────

  const headhunter = await prisma.user.upsert({
    where: { email: "headhunter@test.com" },
    update: {},
    create: {
      name: "Jovana Filipović",
      email: "headhunter@test.com",
      hashedPassword,
      role: "HEADHUNTER",
    },
  });

  await prisma.savedProfile.upsert({
    where: { headhunterId_savedWaiterId: { headhunterId: headhunter.id, savedWaiterId: waiter.id } },
    update: {},
    create: {
      headhunterId: headhunter.id,
      savedWaiterId: waiter.id,
      notes: "Odličan kandidat za fine-dining projekte. Kontaktirati u avgustu.",
    },
  });

  await prisma.savedProfile.upsert({
    where: { headhunterId_savedWaiterId: { headhunterId: headhunter.id, savedWaiterId: waiter3.id } },
    update: {},
    create: {
      headhunterId: headhunter.id,
      savedWaiterId: waiter3.id,
      notes: "Top skor, iskusan. Prioritet za sledeći event.",
    },
  });

  console.log("✓ Headhunter and saved profiles seeded");

  // ── Invites ───────────────────────────────────────────────────────────────

  await prisma.invite.upsert({
    where: { id: "seed-invite-1" },
    update: {},
    create: {
      id: "seed-invite-1",
      senderId: venueOwner.id,
      recipientId: waiter5.id,
      type: "JOB_INVITE",
      message: "Zdravo Nikola, primili smo tvoj profil i zainteresovani smo za saradnju. Slobodan si za razgovor?",
      status: "PENDING",
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  console.log("✓ Invites seeded");

  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Test accounts (password: ${TEST_PASSWORD})
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Waiters:     waiter@test.com  (Marko Nikolić, skor 87)
               waiter2@test.com (Ana Petrović)
               waiter3@test.com (Stefan Đorđević, skor 91)
               waiter4@test.com (Jelena Milošević)
               waiter5@test.com (Nikola Stanković, skor 82)
               waiter6@test.com (Milica Vasić)
  Venue owner: venue@test.com  (2 venues, 4 posts)
  Headhunter:  headhunter@test.com (Jovana Filipović)
  Admin:       admin@test.com
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
