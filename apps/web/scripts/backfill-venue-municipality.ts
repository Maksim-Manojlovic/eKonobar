#!/usr/bin/env node
/**
 * Backfill legacy free-text `Venue.municipality` values to canonical Belgrade
 * opštine, so waiter reach matching (`workMunicipalities has municipality`) and
 * the coverage choropleth work for venues created before the field was made a
 * canonical dropdown.
 *
 * DRY RUN BY DEFAULT — prints what it would change and touches nothing. Apply
 * with `--apply`. Run against whatever `DATABASE_URL` points at, so double-check
 * you are aiming at the intended database before `--apply`:
 *
 *   npx tsx scripts/backfill-venue-municipality.ts            # preview
 *   npx tsx scripts/backfill-venue-municipality.ts --apply    # write
 *
 * Rows whose value cannot be normalized are listed as UNRESOLVED and left as-is
 * for manual review — never guessed.
 */
import { PrismaClient } from "@prisma/client";
import { normalizeMunicipality } from "../src/lib/geo/municipalities";

const APPLY = process.argv.includes("--apply");
const db = new PrismaClient();

async function main() {
  const venues = await db.venue.findMany({ select: { id: true, name: true, municipality: true } });

  const changes = [];
  const unresolved = [];
  for (const v of venues) {
    const canonical = normalizeMunicipality(v.municipality ?? "");
    if (canonical === null) {
      unresolved.push(v);
    } else if (canonical !== v.municipality) {
      changes.push({ ...v, canonical });
    }
  }

  console.log(`Venues scanned: ${venues.length}`);
  console.log(`Already canonical: ${venues.length - changes.length - unresolved.length}`);
  console.log(`To normalize: ${changes.length}`);
  console.log(`Unresolved (manual review): ${unresolved.length}\n`);

  for (const c of changes) console.log(`  "${c.municipality}" → "${c.canonical}"   (${c.name})`);
  if (unresolved.length) {
    console.log("\nUNRESOLVED — left unchanged:");
    for (const u of unresolved) console.log(`  "${u.municipality}"   (${u.name}) [${u.id}]`);
  }

  if (!APPLY) {
    console.log("\nDRY RUN — no changes written. Re-run with --apply to persist.");
    return;
  }

  let done = 0;
  for (const c of changes) {
    await db.venue.update({ where: { id: c.id }, data: { municipality: c.canonical } });
    done++;
  }
  console.log(`\nApplied ${done} update(s).`);
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => db.$disconnect());
