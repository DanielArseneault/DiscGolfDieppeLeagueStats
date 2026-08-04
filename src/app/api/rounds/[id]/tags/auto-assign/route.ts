import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";
import { Division, Gender } from "@/generated/prisma/client";
import { BOB_TAG, tagRank } from "@/lib/tags";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const roundId = Number(id);

  const round = await prisma.round.findUnique({
    where: { id: roundId },
    include: { results: { include: { player: true } } },
  });
  if (!round) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const assignments: { resultId: number; playerId: number; tagAfter: string }[] = [];

  // Female players get their own tag pool within each division, separate from
  // everyone else — the two groups never compete for the same tag numbers.
  for (const division of [Division.BLUE, Division.RED]) {
    for (const isFemalePool of [true, false]) {
      // Ties (equal position) are broken by previous tag — whoever held the lower
      // (better) tag before the round keeps priority for the lower tag after. BoB
      // (no numbered tag) always ranks below every numbered tag.
      //
      // Players marked leftEarly (left the round before it finished and had their
      // next tag assigned manually) are excluded from the shuffle entirely — their
      // tagAfter is left untouched, and the tag number they brought in doesn't get
      // redistributed to anyone else.
      const pool = round.results
        .filter(
          (r) =>
            r.division === division &&
            r.tagBefore != null &&
            !r.leftEarly &&
            (r.player.gender === Gender.FEMALE) === isFemalePool
        )
        .sort((a, b) => a.position - b.position || tagRank(a.tagBefore) - tagRank(b.tagBefore));

      // The number of numbered tags in circulation is conserved across the shuffle:
      // the best finishers in the pool take the numbers, and everyone else — even
      // someone who brought in a number — drops to BoB. BoB itself is an unlimited
      // shared bucket, so anyone can hold it at once.
      const numberedTags = pool
        .map((r) => r.tagBefore!)
        .filter((t) => t !== BOB_TAG)
        .map((t) => parseInt(t, 10))
        .sort((a, b) => a - b);

      pool.forEach((result, i) => {
        const tagAfter = i < numberedTags.length ? String(numberedTags[i]) : BOB_TAG;
        assignments.push({ resultId: result.id, playerId: result.playerId, tagAfter });
      });
    }
  }

  await prisma.$transaction([
    ...assignments.map((a) =>
      prisma.result.update({ where: { id: a.resultId }, data: { tagAfter: a.tagAfter } })
    ),
    ...assignments.map((a) =>
      prisma.player.update({ where: { id: a.playerId }, data: { currentTag: a.tagAfter } })
    ),
  ]);

  const updated = await prisma.round.findUnique({
    where: { id: roundId },
    include: { results: { include: { player: true } } },
  });

  return NextResponse.json(updated);
}
