import { prisma } from "@/lib/db";
import { getStandings } from "@/lib/standings";
import { computeHoleStats } from "@/lib/course-stats";
import { CourseStatsSection } from "@/components/course-stats-grid";
import { notFound } from "next/navigation";
import { Division, MemberStatus } from "@/generated/prisma/client";
import { formatDate } from "@/lib/utils";
import { toPar, toParAvg, signInk, roundChipTint } from "@/lib/design-helpers";
import { Card, CardContent } from "@/components/site-card";
import Link from "next/link";

export const revalidate = 60;

// Compute the player's division rank after each qualifying week, in chronological order.
function computeProgressiveStandings(
  allResults: Array<{
    playerId: number;
    score: number;
    round: { weekNumber: number };
    player: { division: Division };
  }>,
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
      if (r.player.division !== targetDivision) continue;
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

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

export default async function PlayerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

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

  const [standings, allLeagueResults, ctpWins, aceWins, layoutRound, allRounds] = await Promise.all([
    getStandings(player.leagueId),
    prisma.result.findMany({
      where: { round: { leagueId: player.leagueId, isChampionship: false, weekNumber: { lte: league.qualifyingWeeks } } },
      select: {
        playerId: true,
        score: true,
        relativeScore: true,
        holeScores: true,
        round: { select: { weekNumber: true } },
        player: { select: { division: true } },
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
    prisma.round.findFirst({
      where: { leagueId: player.leagueId, ...(player.division === Division.BLUE ? { blueLayoutId: { not: null } } : { redLayoutId: { not: null } }) },
      orderBy: { weekNumber: "desc" },
      include: {
        blueLayout: { include: { holePars: { orderBy: { holeNumber: "asc" } } } },
        redLayout: { include: { holePars: { orderBy: { holeNumber: "asc" } } } },
      },
    }),
    prisma.round.findMany({
      where: { leagueId: player.leagueId },
      orderBy: { weekNumber: "desc" },
      select: { id: true, weekNumber: true, date: true, isChampionship: true },
    }),
  ]);

  const standing = standings.find((s) => s.playerId === player.id);
  const resultByRoundId = new Map(player.results.map((r) => [r.round.id, r]));

  const rankByWeek = computeProgressiveStandings(allLeagueResults, player.id, player.division, league.bestScoresCount, league.minWeeks);

  const qualifyingResults = player.results.filter((r) => !r.round.isChampionship);
  const chronological = [...qualifyingResults].sort((a, b) => a.round.weekNumber - b.round.weekNumber);
  const avgScore = qualifyingResults.length > 0 ? qualifyingResults.reduce((s, r) => s + r.relativeScore, 0) / qualifyingResults.length : null;
  const bestRound = qualifyingResults.length > 0 ? Math.min(...qualifyingResults.map((r) => r.relativeScore)) : null;
  const wins = qualifyingResults.filter((r) => r.position === 1).length;
  const top3 = qualifyingResults.filter((r) => r.position <= 3).length;
  const rankValues = [...rankByWeek.values()].map((v) => v.rank);
  const avgRank = rankValues.length > 0 ? Math.round(rankValues.reduce((s, r) => s + r, 0) / rankValues.length) : null;

  const fieldResults = allLeagueResults.filter((r) => r.player.division === player.division);
  const fieldAvgScore = fieldResults.length > 0 ? fieldResults.reduce((s, r) => s + r.relativeScore, 0) / fieldResults.length : null;
  const fieldBestRound = fieldResults.length > 0 ? Math.min(...fieldResults.map((r) => r.relativeScore)) : null;
  const fieldPlayerCount = new Set(fieldResults.map((r) => r.playerId)).size;
  const fieldAvgRoundsPlayed = fieldPlayerCount > 0 ? fieldResults.length / fieldPlayerCount : null;

  const holePars = player.division === Division.BLUE ? layoutRound?.blueLayout?.holePars ?? [] : layoutRound?.redLayout?.holePars ?? [];
  const playerHoleStats = holePars.length > 0 ? computeHoleStats(qualifyingResults.map((r) => r.holeScores as Record<string, number>), holePars) : null;
  const fieldHoleStats = holePars.length > 0 ? computeHoleStats(fieldResults.map((r) => r.holeScores as Record<string, number>), holePars) : null;

  let roundBreakdown: {
    birdieOrBetterRate: number;
    parRate: number;
    bogeyOrWorseRate: number;
    eagles: number;
    aces: number;
    bestF9: number | null;
    f9Avg: number | null;
    bestB9: number | null;
    b9Avg: number | null;
  } | null = null;

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

  const leagueUrl = `/?league=${player.leagueId}`;
  const divisionLabel = player.division === Division.BLUE ? "Blue division" : "Red division";
  const divisionDot = player.division === Division.BLUE ? "var(--blue-dot)" : "var(--red-dot)";
  const divisionSurface = player.division === Division.BLUE ? "var(--blue-surface)" : "var(--red-surface)";
  const divisionInk = player.division === Division.BLUE ? "var(--blue-ink)" : "var(--red-ink)";
  const percentile = standing && standings.filter((s) => s.division === player.division).length > 0
    ? Math.max(1, Math.round((standing.rank / standings.filter((s) => s.division === player.division).length) * 100))
    : null;

  return (
    <div className="space-y-8">
      <Hero
        player={player}
        leagueUrl={leagueUrl}
        divisionLabel={divisionLabel}
        divisionDot={divisionDot}
        divisionSurface={divisionSurface}
        divisionInk={divisionInk}
        standing={standing}
        chronological={chronological}
      />

      {standing && (
        <div>
          <SectionTitle>
            {league.name} <span style={{ color: "var(--ink-muted)", fontWeight: 400 }}>· {league.year}</span>
          </SectionTitle>
          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "1px", background: "var(--line)" }}>
            <StatCell label="Best 4 rounds" value={standing.qualified ? String(standing.qualifyingTotal) : "–"} />
            <StatCell label="Scoring average" value={avgScore != null ? toParAvg(Math.round(avgScore * 100) / 100) : "–"} ink={avgScore != null ? signInk(avgScore) : undefined} />
            <StatCell label="Best round" value={bestRound != null ? toPar(bestRound) : "–"} ink={bestRound != null ? signInk(bestRound) : undefined} />
            <StatCell label="Top 3 finishes" value={String(top3)} />
          </div>
          {percentile != null && (
            <p className="mt-2 text-xs" style={{ color: "var(--ink-muted)" }}>
              {wins > 0 ? `${wins} win${wins !== 1 ? "s" : ""} · ` : ""}
              Top {percentile}% of the {divisionLabel.toLowerCase()} · {avgRank != null ? `avg. weekly rank #${avgRank}` : ""}
            </p>
          )}
        </div>
      )}

      {(chronological.length > 0 || roundBreakdown) && (
        <div className="grid gap-4 lg:grid-cols-2">
          {chronological.length > 1 && (
            <Card>
              <CardContent className="pt-6">
                <p className="mb-3 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[.13em]" style={{ color: "var(--ink-muted)" }}>
                  Score trend
                </p>
                <TrendChart rounds={chronological} />
              </CardContent>
            </Card>
          )}
          {roundBreakdown && (
            <Card>
              <CardContent className="space-y-4 pt-6">
                <div>
                  <p className="mb-2 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[.13em]" style={{ color: "var(--ink-muted)" }}>
                    Shot mix
                  </p>
                  <ShotMixBar breakdown={roundBreakdown} />
                </div>
                {(roundBreakdown.bestF9 != null || roundBreakdown.bestB9 != null) && (
                  <div className="grid grid-cols-2 gap-x-6 gap-y-3 pt-2 sm:grid-cols-4 sm:gap-x-8" style={{ borderTop: "1px solid var(--line-2)" }}>
                    {roundBreakdown.bestF9 != null && <CompactStat label="Best F9" value={toPar(roundBreakdown.bestF9)} ink={signInk(roundBreakdown.bestF9)} />}
                    {roundBreakdown.f9Avg != null && <CompactStat label="F9 avg" value={toParAvg(roundBreakdown.f9Avg)} ink={signInk(roundBreakdown.f9Avg)} />}
                    {roundBreakdown.bestB9 != null && <CompactStat label="Best B9" value={toPar(roundBreakdown.bestB9)} ink={signInk(roundBreakdown.bestB9)} />}
                    {roundBreakdown.b9Avg != null && <CompactStat label="B9 avg" value={toParAvg(roundBreakdown.b9Avg)} ink={signInk(roundBreakdown.b9Avg)} />}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {playerHoleStats && qualifyingResults.length > 0 && (
        <div>
          <SectionTitle>Hole performance</SectionTitle>
          <CourseStatsSection stats={playerHoleStats} fieldStats={fieldHoleStats ?? undefined} variant="compact" />
        </div>
      )}

      {standing && (
        <div>
          <SectionTitle>How he stacks up</SectionTitle>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StackCard
              label="Scoring average"
              mine={avgScore}
              field={fieldAvgScore}
              format={(v) => toParAvg(v)}
              reading={(mine, field) =>
                mine < field
                  ? `${(field - mine).toFixed(1)} strokes better than the field average`
                  : mine > field
                  ? `${(mine - field).toFixed(1)} strokes worse than the field average`
                  : "Matches the field average"
              }
              lowerIsBetter
            />
            <StackCard
              label="Best round"
              mine={bestRound}
              field={fieldBestRound}
              format={(v) => toPar(Math.round(v))}
              reading={(mine, field) => (mine <= field ? "Tied or better than the division's best round" : `${Math.round(mine - field)} strokes off the division's best`)}
              lowerIsBetter
            />
            <StackCard
              label="Birdie or better rate"
              mine={roundBreakdown?.birdieOrBetterRate ?? null}
              field={fieldBirdieRate}
              format={(v) => `${v.toFixed(1)}%`}
              reading={(mine, field) => (mine > field ? `${(mine - field).toFixed(1)} pts above the field rate` : mine < field ? `${(field - mine).toFixed(1)} pts below the field rate` : "Matches the field rate")}
            />
            <StackCard
              label="Rounds played"
              mine={standing.roundsPlayed}
              field={fieldAvgRoundsPlayed}
              format={(v) => v.toFixed(v % 1 === 0 ? 0 : 1)}
              reading={(mine, field) => (mine > field ? "More active than the average field player" : mine < field ? "Fewer rounds than the average field player" : "Matches the field average")}
            />
          </div>
        </div>
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
              const weekStanding = round.isChampionship ? null : rankByWeek.get(round.weekNumber) ?? null;
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

function StatCell({ label, value, ink }: { label: string; value: string; ink?: string }) {
  return (
    <div className="px-5 py-4" style={{ background: "var(--bg-card)" }}>
      <p className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[.13em]" style={{ color: "var(--ink-muted)" }}>
        {label}
      </p>
      <p className="mt-1 font-[family-name:var(--font-mono)] text-[26px] font-medium" style={{ color: ink ?? "var(--ink)" }}>
        {value}
      </p>
    </div>
  );
}

function CompactStat({ label, value, ink }: { label: string; value: string; ink?: string }) {
  return (
    <div>
      <div className="font-[family-name:var(--font-mono)] text-lg font-medium" style={{ color: ink ?? "var(--ink)" }}>
        {value}
      </div>
      <div className="text-xs" style={{ color: "var(--ink-muted)" }}>
        {label}
      </div>
    </div>
  );
}

type PlayerWithLeague = NonNullable<Awaited<ReturnType<typeof prisma.player.findUnique>>>;

function Hero({
  player,
  leagueUrl,
  divisionLabel,
  divisionDot,
  divisionSurface,
  divisionInk,
  standing,
  chronological,
}: {
  player: PlayerWithLeague;
  leagueUrl: string;
  divisionLabel: string;
  divisionDot: string;
  divisionSurface: string;
  divisionInk: string;
  standing: { rank: number; qualified: boolean } | undefined;
  chronological: { round: { weekNumber: number }; relativeScore: number }[];
}) {
  return (
    <div>
      <div className="-mx-8 -mt-14 px-8 pt-24 pb-8" style={{ background: "linear-gradient(to bottom, var(--hero-a), var(--bg-app))" }}>
        <div className="mx-auto max-w-[var(--container)]">
          <div className="flex items-center gap-1.5 font-[family-name:var(--font-mono)] text-xs uppercase tracking-[.14em]" style={{ color: "var(--ink-muted)" }}>
            <Link href={leagueUrl} className="nav-link" style={{ color: "var(--ink-muted)" }}>Standings</Link>
            <span>/</span>
            <span>{player.name}</span>
          </div>

          <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <span
                className="flex h-[76px] w-[76px] shrink-0 items-center justify-center rounded-full font-[family-name:var(--font-mono)] text-2xl font-semibold"
                style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
              >
                {initials(player.name)}
              </span>
              <div>
                <h1 className="text-[32px] font-extrabold sm:text-[42px]" style={{ color: "var(--ink)", letterSpacing: "-0.03em", lineHeight: 1 }}>
                  {player.name}
                </h1>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span
                    className="inline-flex items-center gap-1.5 rounded-[var(--r-pill)] px-2.5 py-1 font-[family-name:var(--font-mono)] text-xs"
                    style={{ background: divisionSurface, color: divisionInk }}
                  >
                    <span className="h-2 w-2 rounded-full" style={{ background: divisionDot }} />
                    {divisionLabel}
                  </span>
                  {player.memberStatus === MemberStatus.MEMBER && (
                    <span className="rounded-[var(--r-pill)] px-2.5 py-1 font-[family-name:var(--font-mono)] text-xs" style={{ background: "var(--chip-neutral)", color: "var(--ink-2)" }}>
                      Member
                    </span>
                  )}
                  {player.pdgaNumber && (
                    <a href={`https://www.pdga.com/player/${player.pdgaNumber}`} target="_blank" rel="noopener noreferrer" className="nav-link text-xs" style={{ color: "var(--ink-muted)", textDecoration: "underline" }}>
                      PDGA #{player.pdgaNumber}
                    </a>
                  )}
                  <Link
                    href={`/compare?a=${player.id}&league=${player.leagueId}`}
                    className="nav-link rounded-[var(--r-pill)] px-2.5 py-1 font-[family-name:var(--font-mono)] text-xs"
                    style={{ background: "var(--chip-neutral)", color: "var(--ink-2)" }}
                  >
                    Compare →
                  </Link>
                </div>
              </div>
            </div>

            {standing && (
              <div className="text-right">
                <div className="font-[family-name:var(--font-mono)] text-[64px] font-extrabold leading-none" style={{ color: "var(--positive)" }}>
                  #{standing.rank}
                </div>
                <p className="mt-1 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[.13em]" style={{ color: "var(--ink-muted)" }}>
                  In division
                </p>
                <span
                  className="mt-1 inline-block rounded-[var(--r-pill)] px-2.5 py-0.5 font-[family-name:var(--font-mono)] text-xs"
                  style={standing.qualified ? { background: "var(--accent-soft)", color: "var(--positive)" } : { background: "var(--chip-neutral)", color: "var(--ink-muted)" }}
                >
                  {standing.qualified ? "Qualified" : "Not yet qualified"}
                </span>
              </div>
            )}
          </div>

          {chronological.length > 0 && (
            <div className="mt-6 flex gap-2 overflow-x-auto pb-1">
              {chronological.map((r) => {
                const tint = roundChipTint(r.relativeScore, 0);
                return (
                  <div key={r.round.weekNumber} className="flex shrink-0 flex-col items-center gap-1">
                    <span className="rounded-[var(--r-chip)] px-2 py-1 font-[family-name:var(--font-mono)] text-xs font-medium" style={{ background: tint.bg, color: tint.fg }}>
                      {toPar(r.relativeScore)}
                    </span>
                    <span className="font-[family-name:var(--font-mono)] text-[10px]" style={{ color: "var(--ink-muted)" }}>
                      W{r.round.weekNumber}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TrendChart({ rounds }: { rounds: { round: { weekNumber: number }; relativeScore: number }[] }) {
  const width = 480;
  const height = 160;
  const padX = 16;
  const padTop = 28;
  const padBottom = 16;
  const values = rounds.map((r) => r.relativeScore);
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const range = max - min || 1;
  const x = (i: number) => padX + (i / Math.max(1, rounds.length - 1)) * (width - padX * 2);
  const y = (v: number) => padTop + (1 - (v - min) / range) * (height - padTop - padBottom);
  const points = rounds.map((r, i) => `${x(i)},${y(r.relativeScore)}`).join(" ");
  const parY = y(0);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full">
      <line x1={padX} y1={parY} x2={width - padX} y2={parY} stroke="var(--line-strong)" strokeWidth="1" strokeDasharray="4 3" />
      <polyline points={points} fill="none" stroke="var(--positive)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {rounds.map((r, i) => {
        const py = y(r.relativeScore);
        const labelAbove = py - padTop > 14;
        return (
          <g key={r.round.weekNumber}>
            <circle cx={x(i)} cy={py} r="3" fill="var(--positive)" />
            <text
              x={x(i)}
              y={labelAbove ? py - 8 : py + 16}
              textAnchor="middle"
              className="font-[family-name:var(--font-mono)] text-[15px] lg:text-[11px]"
              fontWeight="600"
              fill={signInk(r.relativeScore)}
            >
              {toPar(r.relativeScore)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function ShotMixBar({ breakdown }: { breakdown: { birdieOrBetterRate: number; parRate: number; bogeyOrWorseRate: number } }) {
  return (
    <div>
      <div className="flex h-3 overflow-hidden rounded-[var(--r-chip)]" style={{ background: "var(--track)" }}>
        <div style={{ width: `${breakdown.birdieOrBetterRate}%`, background: "var(--positive)" }} />
        <div style={{ width: `${breakdown.parRate}%`, background: "var(--neutral-bar)" }} />
        <div style={{ width: `${breakdown.bogeyOrWorseRate}%`, background: "var(--negative)" }} />
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-[family-name:var(--font-mono)] text-xs">
        <span style={{ color: "var(--positive)" }}>{breakdown.birdieOrBetterRate}% birdie+</span>
        <span style={{ color: "var(--ink-muted)" }}>{breakdown.parRate}% par</span>
        <span style={{ color: "var(--negative)" }}>{breakdown.bogeyOrWorseRate}% bogey+</span>
      </div>
    </div>
  );
}

function StackCard<T extends number>({
  label,
  mine,
  field,
  format,
  reading,
  lowerIsBetter,
}: {
  label: string;
  mine: T | null;
  field: T | null;
  format: (v: number) => string;
  reading: (mine: number, field: number) => string;
  lowerIsBetter?: boolean;
}) {
  const has = mine != null && field != null;
  const better = has ? (lowerIsBetter ? mine < field : mine > field) : false;
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[.13em]" style={{ color: "var(--ink-muted)" }}>
          {label}
        </p>
        <div className="mt-2 flex items-baseline gap-3">
          <span className="font-[family-name:var(--font-mono)] text-2xl font-semibold" style={{ color: has && better ? "var(--positive)" : "var(--ink)" }}>
            {mine != null ? format(mine) : "—"}
          </span>
          <span className="font-[family-name:var(--font-mono)] text-sm" style={{ color: "var(--ink-muted)" }}>
            vs {field != null ? format(field) : "—"}
          </span>
        </div>
        <p className="mt-2 text-xs" style={{ color: "var(--ink-3)" }}>
          {has ? reading(mine, field) : "Not enough data yet"}
        </p>
      </CardContent>
    </Card>
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

function formatPosition(pos: number): string {
  if (pos === 1) return "1st";
  if (pos === 2) return "2nd";
  if (pos === 3) return "3rd";
  const suffix = pos % 10 === 1 && pos !== 11 ? "st" : pos % 10 === 2 && pos !== 12 ? "nd" : pos % 10 === 3 && pos !== 13 ? "rd" : "th";
  return `${pos}${suffix}`;
}
