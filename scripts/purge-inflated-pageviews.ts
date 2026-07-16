// One-off cleanup of PageView rows inflated by Next.js prefetch requests
// (middleware-based tracking couldn't tell prefetches from real views).
// Run: npx tsx --env-file=.env.local scripts/purge-inflated-pageviews.ts
// Delete this file afterwards.
import { prisma } from "../src/lib/db";

async function main() {
  // Claude's curl test row from verifying the new client-side flow
  const test = await prisma.pageView.deleteMany({
    where: { visitorId: "bb31bcee-86c1-4a46-af04-957574cf45ae" },
  });
  // the prefetch burst visitor (157 rows: every player page x3 within ~2s)
  const burst = await prisma.pageView.deleteMany({
    where: { visitorId: "e019414f-8484-4c2a-9d52-02472c83ead6" },
  });
  console.log("test rows deleted:", test.count, "| burst rows deleted:", burst.count);

  // collapse rapid-fire duplicates (same visitor+path within 10s = RSC/prefetch echoes)
  const rows = await prisma.pageView.findMany({ orderBy: { createdAt: "asc" } });
  const lastSeen = new Map<string, number>();
  const dupes: number[] = [];
  for (const r of rows) {
    const key = `${r.visitorId}|${r.path}`;
    const t = r.createdAt.getTime();
    const prev = lastSeen.get(key);
    if (prev !== undefined && t - prev < 10_000) dupes.push(r.id);
    else lastSeen.set(key, t);
  }
  if (dupes.length) await prisma.pageView.deleteMany({ where: { id: { in: dupes } } });
  console.log("duplicate echoes deleted:", dupes.length);
  console.log("remaining total:", await prisma.pageView.count());
}

main().finally(() => process.exit(0));
