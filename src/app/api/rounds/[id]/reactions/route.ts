import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const target = searchParams.get("target") ?? "round";

  const reactions = await prisma.roundReaction.findMany({
    where: { roundId: Number(id), target },
    select: { emoji: true, count: true },
  });
  return NextResponse.json(reactions);
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { emoji, action, target = "round" } = await req.json() as {
    emoji: string;
    action: "add" | "remove";
    target?: string;
  };

  const ALLOWED_EMOJIS = ["👍", "❤️", "🔥", "😂", "🤯", "😮", "👏", "💪", "😢", "😡"];
  if (!ALLOWED_EMOJIS.includes(emoji)) {
    return NextResponse.json({ error: "Invalid emoji" }, { status: 400 });
  }

  const delta = action === "remove" ? -1 : 1;

  const reaction = await prisma.roundReaction.upsert({
    where: { roundId_emoji_target: { roundId: Number(id), emoji, target } },
    create: { roundId: Number(id), emoji, target, count: Math.max(0, delta) },
    update: { count: { increment: delta } },
  });

  if (reaction.count < 0) {
    await prisma.roundReaction.update({
      where: { id: reaction.id },
      data: { count: 0 },
    });
    reaction.count = 0;
  }

  return NextResponse.json({ emoji: reaction.emoji, count: reaction.count });
}
