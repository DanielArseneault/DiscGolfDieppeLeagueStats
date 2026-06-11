import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();

  await prisma.holePar.deleteMany({ where: { courseLayoutId: Number(id) } });

  const layout = await prisma.courseLayout.update({
    where: { id: Number(id) },
    data: {
      name: body.name,
      description: body.description ?? null,
      holePars: {
        create: (body.holePars as { holeNumber: number; par: number }[]).map((hp) => ({
          holeNumber: hp.holeNumber,
          par: hp.par,
        })),
      },
    },
    include: { holePars: { orderBy: { holeNumber: "asc" } } },
  });
  return NextResponse.json(layout);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.courseLayout.delete({ where: { id: Number(id) } });
  return new NextResponse(null, { status: 204 });
}
