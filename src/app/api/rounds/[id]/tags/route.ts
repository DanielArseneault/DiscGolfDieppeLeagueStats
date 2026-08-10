import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";
import { normalizeTagInput } from "@/lib/tags";

interface TagUpdate {
  // A row has a resultId once its Result is synced from UDisc; before that,
  // it only has a checkInId (RoundCheckIn.tagBefore/tagAfter hold the tag
  // ladder edits in the meantime — see upsertResultsForRound, which seeds
  // Result.tagBefore/tagAfter from these when the Result is finally created).
  resultId?: number | null;
  checkInId?: number | null;
  tagBefore?: string | null;
  tagAfter?: string | null;
  leftEarly?: boolean;
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const roundId = Number(id);
  const { tags } = (await req.json()) as { tags: TagUpdate[] };

  const resultUpdates = tags.filter((t) => t.resultId != null);
  const checkInUpdates = tags.filter((t) => t.resultId == null && t.checkInId != null);

  const results = resultUpdates.length
    ? await prisma.$transaction(
        resultUpdates.map(({ resultId, tagBefore, tagAfter, leftEarly }) =>
          prisma.result.update({
            where: { id: resultId!, roundId },
            data: {
              ...(tagBefore !== undefined ? { tagBefore: tagBefore == null ? null : normalizeTagInput(tagBefore) } : {}),
              ...(tagAfter !== undefined ? { tagAfter: tagAfter == null ? null : normalizeTagInput(tagAfter) } : {}),
              ...(leftEarly !== undefined ? { leftEarly } : {}),
            },
          })
        )
      )
    : [];

  if (checkInUpdates.length > 0) {
    await prisma.$transaction(
      checkInUpdates.map(({ checkInId, tagBefore, tagAfter }) =>
        prisma.roundCheckIn.update({
          where: { id: checkInId!, roundId },
          data: {
            ...(tagBefore !== undefined ? { tagBefore: tagBefore == null ? null : normalizeTagInput(tagBefore) } : {}),
            ...(tagAfter !== undefined ? { tagAfter: tagAfter == null ? null : normalizeTagInput(tagAfter) } : {}),
          },
        })
      )
    );
  }

  const currentTagUpdates = resultUpdates.filter((t) => t.tagAfter !== undefined && t.tagAfter !== null);
  if (currentTagUpdates.length > 0) {
    await prisma.$transaction(
      currentTagUpdates.map((t) => {
        const result = results.find((r) => r.id === t.resultId)!;
        return prisma.player.update({
          where: { id: result.playerId },
          data: { currentTag: result.tagAfter },
        });
      })
    );
  }

  return NextResponse.json({ ok: true });
}
