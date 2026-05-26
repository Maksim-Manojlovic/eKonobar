import { NextResponse } from "next/server";
import { withRole } from "@/lib/auth/with-role";
import { db } from "@/lib/core/db";
import { parseBody } from "@/lib/auth/parse-body";
import { z } from "zod";

const PassportPutSchema = z.object({
  bio:                  z.string().nullish(),
  skills:               z.array(z.string()).optional(),
  languages:            z.array(z.string()).optional(),
  yearsExperience:      z.number().min(0).optional(),
  currentlyAvailable:   z.boolean().optional(),
  profilePhoto:         z.string().nullish(),
  galleryPhotos:        z.array(z.string()).optional(),
  venueTypePreferences: z.array(z.string()).optional(),
});

export const GET = withRole("WAITER", async (_req, _ctx, session) => {
  const [passport, recentReviews] = await Promise.all([
    db.waiterPassport.findUnique({
      where: { userId: session.user.id },
      include: { trustScore: true },
    }),
    db.review.findMany({
      where: {
        subjectId: session.user.id,
        direction: "VENUE_TO_WAITER",
        status: "PUBLISHED",
        comment: { not: null },
      },
      orderBy: { publishedAt: "desc" },
      take: 3,
      select: {
        id: true,
        overallRating: true,
        comment: true,
        publishedAt: true,
        author: {
          select: {
            name: true,
            venues: { select: { name: true }, take: 1 },
          },
        },
      },
    }),
  ]);

  if (!passport) return NextResponse.json(null);
  return NextResponse.json({ ...passport, recentReviews });
});

export const PUT = withRole("WAITER", async (req, _ctx, session) => {
  const parsed = await parseBody(PassportPutSchema, req);
  if (!parsed.ok) return parsed.response;
  const { bio, skills, languages, yearsExperience, currentlyAvailable, profilePhoto, galleryPhotos, venueTypePreferences } = parsed.data;

  const existing = await db.waiterPassport.findUnique({
    where: { userId: session.user.id },
    select: { currentlyAvailable: true },
  });

  const availabilityDateUpdate =
    currentlyAvailable !== undefined
      ? currentlyAvailable
        ? existing && !existing.currentlyAvailable
          ? { lastAvailableDate: new Date() }
          : {}
        : { lastAvailableDate: null }
      : {};

  const passport = await db.waiterPassport.upsert({
    where: { userId: session.user.id },
    create: {
      userId: session.user.id,
      bio: bio ?? null,
      skills: Array.isArray(skills) ? skills : [],
      languages: Array.isArray(languages) ? languages : [],
      yearsExperience: yearsExperience != null ? Number(yearsExperience) : 0,
      currentlyAvailable: currentlyAvailable ?? true,
      venueTypePreferences: Array.isArray(venueTypePreferences) ? venueTypePreferences : [],
      galleryPhotos: Array.isArray(galleryPhotos) ? galleryPhotos.slice(0, 4) : [],
      ...(profilePhoto && { profilePhoto }),
      lastAvailableDate: currentlyAvailable !== false ? new Date() : null,
    },
    update: {
      ...(bio !== undefined && { bio: bio || null }),
      ...(skills !== undefined && { skills: Array.isArray(skills) ? skills : [] }),
      ...(languages !== undefined && { languages: Array.isArray(languages) ? languages : [] }),
      ...(yearsExperience !== undefined && { yearsExperience: Number(yearsExperience) }),
      ...(currentlyAvailable !== undefined && { currentlyAvailable }),
      ...(profilePhoto !== undefined && { profilePhoto }),
      ...(venueTypePreferences !== undefined && { venueTypePreferences: Array.isArray(venueTypePreferences) ? venueTypePreferences : [] }),
      ...(galleryPhotos !== undefined && { galleryPhotos: Array.isArray(galleryPhotos) ? galleryPhotos.slice(0, 4) : [] }),
      ...availabilityDateUpdate,
    },
    include: { trustScore: true },
  });

  if (profilePhoto) {
    await db.user.update({ where: { id: session.user.id }, data: { image: profilePhoto } });
  }

  return NextResponse.json(passport);
});
