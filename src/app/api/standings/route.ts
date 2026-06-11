import { NextResponse } from "next/server";
import { getStandings } from "@/lib/standings";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const leagueId = Number(searchParams.get("leagueId") ?? 1);
  const standings = await getStandings(leagueId);
  return NextResponse.json(standings);
}
