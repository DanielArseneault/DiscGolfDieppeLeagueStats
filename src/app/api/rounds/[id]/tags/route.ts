import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";

interface TagUpdate {
  resultId: number;
  tagBefore?: number | null;
  tagAfter?: number | null;
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { tags } = (await req.json()) as { tags: TagUpdate[] };

  const results = await prisma.$transaction(
    tags.map(({ resultId, tagBefore, tagAfter }) =>
      prisma.result.update({
        where: { id: resultId, roundId: Number(id) },
        data: {
          ...(tagBefore !== undefined ? { tagBefore } : {}),
          ...(tagAfter !== undefined ? { tagAfter } : {}),
        },
      })
    )
  );

  const currentTagUpdates = tags.filter((t) => t.tagAfter !== undefined && t.tagAfter !== null);
  if (currentTagUpdates.length > 0) {
    await prisma.$transaction(
      currentTagUpdates.map((t) => {
        const result = results.find((r) => r.id === t.resultId)!;
        return prisma.player.update({
          where: { id: result.playerId },
          data: { currentTag: t.tagAfter },
        });
      })
    );
  }

  return NextResponse.json({ ok: true });
}
