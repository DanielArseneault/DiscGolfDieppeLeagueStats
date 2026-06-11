import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const layouts = await prisma.courseLayout.findMany({
    include: {
      holePars: { orderBy: { holeNumber: "asc" } },
    },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(layouts);
}

export async function POST(req: Request) {
  const body = await req.json();

  const layout = await prisma.courseLayout.create({
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
  return NextResponse.json(layout, { status: 201 });
}
