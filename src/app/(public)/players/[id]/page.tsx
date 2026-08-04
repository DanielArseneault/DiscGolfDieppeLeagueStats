import { prisma } from "@/lib/db";
import { getStandings, pickPrimaryStanding } from "@/lib/standings";
import { computeHoleStats } from "@/lib/course-stats";
import { notFound } from "next/navigation";
import { Division } from "@/generated/prisma/client";
import { formatDate } from "@/lib/utils";
import { toPar, signInk } from "@/lib/design-helpers";
import { PlayerDivisionView, type DivisionViewData } from "@/components/player-division-view";
import Link from "next/link";

export const revalidate = 60;

// Compute the player's rank within `targetDivision` after each qualifying week, in
// chronological order. Filters on the result's own division, not the player's — a
// player's Blue-week results belong to the Blue field regardless of what other
// divisions they've played in other weeks.
function computeProgressiveStandings(
  allResults: Array<{ playerId: number; score: number; division: Division; round: { weekNumber: number } }>,
  targetPlayerId: number,
  targetDivision: Division,
  bestScoresCount: number,
  minWeeks: number
): Map<number, { rank: number; change: number | null }> {
  const weeks = [...new Set(allResults.map((r) => r.round.weekNumber))].sort((a, b) => a - b);
  const rankByWeek = new Map<number, { rank: number; change: number | null }>();
  let prevRank: number | null = null;

  for (const week of weeks) {
    const subset = allResults.filter((r) => r.round.weekNumber <= week);
    const playerScores = new Map<number, number[]>();
    for (const r of subset) {
      if (r.division !== targetDivision) continue;
      if (!playerScores.has(r.playerId)) playerScores.set(r.playerId, []);
      playerScores.get(r.playerId)!.push(r.score);
    }

    const entries = [...playerScores.entries()].map(([pid, scores]) => {
      const best = [...scores].sort((a, b) => a - b).slice(0, bestScoresCount);
      const total = best.reduce((s, x) => s + x, 0);
      const qualified = scores.length >= minWeeks;
      return { playerId: pid, qualifyingTotal: total, qualified, roundsPlayed: scores.length };
    });

    entries.sort((a, b) => {
      if (a.qualified !== b.qualified) return a.qualified ? -1 : 1;
      const aBucket = Math.min(a.roundsPlayed, bestScoresCount);
      const bBucket = Math.min(b.roundsPlayed, bestScoresCount);
      if (aBucket !== bBucket) return bBucket - aBucket;
      return a.qualifyingTotal - b.qualifyingTotal;
    });

    const rank = entries.findIndex((e) => e.playerId === targetPlayerId) + 1;
    if (rank === 0) continue;

    const change = prevRank != null ? prevRank - rank : null;
    rankByWeek.set(week, { rank, change });
    prevRank = rank;
  }

  return rankByWeek;
}

function formatPosition(pos: number): string {
  if (pos === 1) return "1st";
  if (pos === 2) return "2nd";
  if (pos === 3) return "3rd";
  const suffix = pos % 10 === 1 && pos !== 11 ? "st" : pos % 10 === 2 && pos !== 12 ? "nd" : pos % 10 === 3 && pos !== 13 ? "rd" : "th";
  return `${pos}${suffix}`;
}

export default async function PlayerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ division?: string }>;
}) {
  const { id } = await params;
  const { division: divisionParam } = await searchParams;

  const player = await prisma.player.findUnique({
    where: { id: Number(id) },
    include: {
      league: true,
      results: {
        include: { round: { select: { id: true, weekNumber: true, date: true, isChampionship: true } } },
        orderBy: { round: { weekNumber: "desc" } },
      },
    },
  });

  if (!player) notFound();

  const { league } = player;

  const playerDivisions = [...new Set(player.results.map((r) => r.division))].sort((a, b) => (a === Division.BLUE ? -1 : b === Division.BLUE ? 1 : 0));

  const [standings, allLeagueResults, ctpWins, aceWins, layoutRounds, allRounds] = await Promise.all([
    getStandings(player.leagueId),
    prisma.result.findMany({
      where: { round: { leagueId: player.leagueId, isChampionship: false, weekNumber: { lte: league.qualifyingWeeks } } },
      select: {
        playerId: true,
        division: true,
        score: true,
        relativeScore: true,
        holeScores: true,
        round: { select: { weekNumber: true } },
      },
    }),
    prisma.ctpWinner.findMany({
      where: { playerName: player.name, round: { leagueId: player.leagueId } },
      include: { round: { select: { id: true, weekNumber: true } } },
      orderBy: { round: { weekNumber: "asc" } },
    }),
    prisma.aceWinner.findMany({
      where: { playerName: player.name, round: { leagueId: player.leagueId } },
      include: { round: { select: { id: true, weekNumber: true } } },
      orderBy: { round: { weekNumber: "asc" } },
    }),
    Promise.all(
      playerDivisions.map((division) =>
        prisma.round.findFirst({
          where: { leagueId: player.leagueId, ...(division === Division.BLUE ? { blueLayoutId: { not: null } } : { redLayoutId: { not: null } }) },
          orderBy: { weekNumber: "desc" },
          include: {
            blueLayout: { include: { holePars: { orderBy: { holeNumber: "asc" } } } },
            redLayout: { include: { holePars: { orderBy: { holeNumber: "asc" } } } },
          },
        })
      )
    ),
    prisma.round.findMany({
      where: { leagueId: player.leagueId },
      orderBy: { weekNumber: "desc" },
      select: { id: true, weekNumber: true, date: true, isChampionship: true },
    }),
  ]);

  const resultByRoundId = new Map(player.results.map((r) => [r.round.id, r]));
  const rankByWeekByDivision = new Map(
    playerDivisions.map((division) => [
      division,
      computeProgressiveStandings(allLeagueResults, player.id, division, league.bestScoresCount, league.minWeeks),
    ])
  );

  const views: DivisionViewData[] = playerDivisions.map((division, i) => {
    const standing = standings.find((s) => s.playerId === player.id && s.division === division);
    const qualifyingResults = player.results.filter((r) => !r.round.isChampionship && r.division === division);
    const chronological = [...qualifyingResults].sort((a, b) => a.round.weekNumber - b.round.weekNumber);
    const avgScore = qualifyingResults.length > 0 ? qualifyingResults.reduce((s, r) => s + r.relativeScore, 0) / qualifyingResults.length : null;
    const bestRound = qualifyingResults.length > 0 ? Math.min(...qualifyingResults.map((r) => r.relativeScore)) : null;
    const wins = qualifyingResults.filter((r) => r.position === 1).length;
    const top3 = qualifyingResults.filter((r) => r.position <= 3).length;
    const rankByWeek = rankByWeekByDivision.get(division)!;
    const rankValues = [...rankByWeek.values()].map((v) => v.rank);
    const avgRank = rankValues.length > 0 ? Math.round(rankValues.reduce((s, r) => s + r, 0) / rankValues.length) : null;

    const fieldResults = allLeagueResults.filter((r) => r.division === division);
    const fieldAvgScore = fieldResults.length > 0 ? fieldResults.reduce((s, r) => s + r.relativeScore, 0) / fieldResults.length : null;
    const fieldBestRound = fieldResults.length > 0 ? Math.min(...fieldResults.map((r) => r.relativeScore)) : null;
    const fieldPlayerCount = new Set(fieldResults.map((r) => r.playerId)).size;
    const fieldAvgRoundsPlayed = fieldPlayerCount > 0 ? fieldResults.length / fieldPlayerCount : null;

    const layoutRound = layoutRounds[i];
    const holePars = division === Division.BLUE ? layoutRound?.blueLayout?.holePars ?? [] : layoutRound?.redLayout?.holePars ?? [];
    const playerHoleStats = holePars.length > 0 ? computeHoleStats(qualifyingResults.map((r) => r.holeScores as Record<string, number>), holePars) : null;
    const fieldHoleStats = holePars.length > 0 ? computeHoleStats(fieldResults.map((r) => r.holeScores as Record<string, number>), holePars) : null;

    let roundBreakdown: DivisionViewData["roundBreakdown"] = null;

    if (holePars.length > 0 && qualifyingResults.length > 0) {
      const parByHole = new Map(holePars.map((h) => [h.holeNumber, h.par]));
      const f9Pars = holePars.filter((h) => h.holeNumber <= 9);
      const b9Pars = holePars.filter((h) => h.holeNumber >= 10);
      const totalF9Par = f9Pars.reduce((s, h) => s + h.par, 0);
      const totalB9Par = b9Pars.reduce((s, h) => s + h.par, 0);

      let birdieOrBetter = 0,
        pars = 0,
        bogeyOrWorse = 0,
        eagles = 0,
        aces = 0,
        totalHoles = 0;
      const f9RelScores: number[] = [];
      const b9RelScores: number[] = [];

      for (const result of qualifyingResults) {
        const hs = result.holeScores as Record<string, number> | null;
        if (!hs) continue;
        let f9Score = 0,
          b9Score = 0;
        for (const [holeStr, score] of Object.entries(hs)) {
          const holeNum = parseInt(holeStr, 10);
          const par = parByHole.get(holeNum);
          if (par == null || isNaN(score)) continue;
          totalHoles++;
          const diff = score - par;
          if (diff <= -1) birdieOrBetter++;
          else if (diff === 0) pars++;
          else bogeyOrWorse++;
          if (diff <= -2) eagles++;
          if (score === 1) aces++;
          if (holeNum <= 9) f9Score += score;
          else b9Score += score;
        }
        if (totalF9Par > 0 && f9Pars.every((h) => hs[String(h.holeNumber)] != null)) f9RelScores.push(f9Score - totalF9Par);
        if (totalB9Par > 0 && b9Pars.length > 0 && b9Pars.every((h) => hs[String(h.holeNumber)] != null)) b9RelScores.push(b9Score - totalB9Par);
      }

      const pct = (n: number) => (totalHoles > 0 ? Math.round((n / totalHoles) * 1000) / 10 : 0);
      const avg = (arr: number[]) => (arr.length > 0 ? Math.round((arr.reduce((s, x) => s + x, 0) / arr.length) * 10) / 10 : null);

      roundBreakdown = {
        birdieOrBetterRate: pct(birdieOrBetter),
        parRate: pct(pars),
        bogeyOrWorseRate: pct(bogeyOrWorse),
        eagles,
        aces,
        bestF9: f9RelScores.length > 0 ? Math.min(...f9RelScores) : null,
        f9Avg: avg(f9RelScores),
        bestB9: b9RelScores.length > 0 ? Math.min(...b9RelScores) : null,
        b9Avg: avg(b9RelScores),
      };
    }

    const fieldBirdieRate =
      fieldHoleStats && fieldResults.length > 0 && holePars.length > 0
        ? Math.round((fieldHoleStats.reduce((s, h) => s + h.birdies + h.eagles, 0) / (fieldResults.length * holePars.length)) * 1000) / 10
        : null;

    const divisionCount = standings.filter((s) => s.division === division).length;
    const percentile = standing && divisionCount > 0 ? Math.max(1, Math.round((standing.rank / divisionCount) * 100)) : null;

    return {
      division,
      standing: standing ? { rank: standing.rank, qualified: standing.qualified, roundsPlayed: standing.roundsPlayed, qualifyingTotal: standing.qualifyingTotal } : null,
      chronological: chronological.map((r) => ({ weekNumber: r.round.weekNumber, relativeScore: r.relativeScore })),
      avgScore,
      bestRound,
      wins,
      top3,
      avgRank,
      percentile,
      fieldAvgScore,
      fieldBestRound,
      fieldAvgRoundsPlayed,
      fieldBirdieRate,
      playerHoleStats,
      fieldHoleStats,
      roundBreakdown,
    };
  });

  const leagueUrl = `/?league=${player.leagueId}`;

  const primaryStanding = pickPrimaryStanding(standings, player.id);
  const defaultDivision =
    (divisionParam === "red" ? Division.RED : divisionParam === "blue" ? Division.BLUE : undefined) ??
    primaryStanding?.division ??
    playerDivisions[0] ??
    Division.BLUE;

  return (
    <div className="space-y-8">
      {views.length > 0 && (
        <PlayerDivisionView
          player={{ id: player.id, name: player.name, pdgaNumber: player.pdgaNumber, memberStatus: player.memberStatus }}
          league={{ id: league.id, name: league.name, year: league.year }}
          leagueUrl={leagueUrl}
          views={views}
          initialDivision={defaultDivision}
        />
      )}

      {allRounds.length > 0 && (
        <div>
          <SectionTitle>Round history</SectionTitle>
          <div className="overflow-hidden rounded-[var(--r-card)] border" style={{ borderColor: "var(--line)" }}>
            <div
              className="grid grid-cols-[1fr_54px_54px_64px] px-4 py-3 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[.13em] sm:grid-cols-[1fr_100px_90px_90px_120px] sm:px-6"
              style={{ background: "var(--bg-subtle)", color: "var(--ink-muted)" }}
            >
              <div>Round</div>
              <div className="text-center">Score</div>
              <div className="text-center">+/−</div>
              <div className="text-center">Position</div>
              <div className="hidden text-center sm:block">Standing</div>
            </div>
            {allRounds.map((round) => {
              const result = resultByRoundId.get(round.id);
              const weekRankMap = result ? rankByWeekByDivision.get(result.division) : undefined;
              const weekStanding = round.isChampionship || !weekRankMap ? null : weekRankMap.get(round.weekNumber) ?? null;
              return (
                <div
                  key={round.id}
                  className="grid grid-cols-[1fr_54px_54px_64px] items-center px-4 py-2.5 sm:grid-cols-[1fr_100px_90px_90px_120px] sm:px-6 sm:py-3"
                  style={{ borderTop: "1px solid var(--line-3)" }}
                >
                  <div>
                    <Link href={`/rounds/${round.id}?league=${player.leagueId}`} className="text-sm font-semibold" style={{ color: "var(--ink)" }}>
                      {round.isChampionship ? "Championship" : `Week ${round.weekNumber}`}
                    </Link>
                    <p className="font-[family-name:var(--font-mono)] text-[11px] whitespace-nowrap" style={{ color: "var(--ink-muted)" }}>
                      {formatDate(round.date)}
                    </p>
                  </div>
                  <div className="text-center font-[family-name:var(--font-mono)] text-sm" style={{ color: "var(--ink-2)" }}>
                    {result ? result.score : <span style={{ color: "var(--ink-muted)" }}>DNS</span>}
                  </div>
                  <div className="text-center font-[family-name:var(--font-mono)] text-sm font-semibold" style={{ color: result ? signInk(result.relativeScore) : "var(--ink-muted)" }}>
                    {result ? toPar(result.relativeScore) : "—"}
                  </div>
                  <div className="text-center text-sm" style={{ color: "var(--ink-2)" }}>
                    {result ? formatPosition(result.position) : <span style={{ color: "var(--ink-muted)" }}>—</span>}
                  </div>
                  <div className="hidden text-center sm:block">
                    {weekStanding ? (
                      <span className="inline-flex items-center gap-1.5 font-[family-name:var(--font-mono)] text-sm">
                        <span style={{ color: "var(--ink)" }}>#{weekStanding.rank}</span>
                        <RankChange change={weekStanding.change} />
                      </span>
                    ) : (
                      <span style={{ color: "var(--ink-muted)" }}>—</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {(ctpWins.length > 0 || aceWins.length > 0) && (
        <div className="flex flex-wrap items-center gap-4 rounded-[var(--r-card)] border px-6 py-4" style={{ borderColor: "var(--line)", background: "var(--bg-inset)" }}>
          {ctpWins.map((c) => (
            <Link key={c.id} href={`/rounds/${c.round.id}?league=${player.leagueId}`} className="flex items-center gap-1.5 text-sm">
              <span className="h-[11px] w-[11px] rounded-full" style={{ border: "2px solid var(--positive)" }} />
              <span style={{ color: "var(--ink-2)" }}>Week {c.round.weekNumber} · Hole {c.hole}</span>
            </Link>
          ))}
          {aceWins.map((a) => (
            <Link key={a.id} href={`/rounds/${a.round.id}?league=${player.leagueId}`} className="flex items-center gap-1.5 text-sm">
              <span className="h-[7px] w-[7px] rounded-full" style={{ background: "var(--gold)" }} />
              <span style={{ color: "var(--ink-2)" }}>
                Week {a.round.weekNumber} · Hole {a.hole}
                {a.prizeAmount != null ? ` · $${a.prizeAmount.toFixed(2)}` : ""}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-4 text-[20px] font-bold tracking-[-0.02em]" style={{ color: "var(--ink)" }}>
      {children}
    </h2>
  );
}

function RankChange({ change }: { change: number | null }) {
  if (change === null) return <span className="text-xs" style={{ color: "var(--ink-muted)" }}>new</span>;
  if (change === 0) return <span className="text-xs" style={{ color: "var(--ink-muted)" }}>—</span>;
  return (
    <span className="text-xs font-semibold" style={{ color: change > 0 ? "var(--positive)" : "var(--negative)" }}>
      {change > 0 ? "↑" : "↓"}
      {Math.abs(change)}
    </span>
  );
}
