import { prisma } from "@/lib/db";
import { getStandings } from "@/lib/standings";
import { computePoolSummaries, PoolSummary } from "@/lib/pool-utils";
import { computeHoleStats } from "@/lib/course-stats";
import { notFound } from "next/navigation";
import { ScorecardTable } from "@/components/scorecard-table";
import { ScorecardTabs } from "@/components/scorecard-tabs";
import { CourseStatsSection } from "@/components/course-stats-grid";
import { ReactionBar, type ReactionCounts } from "@/components/reaction-bar";
import { PlayerName, type PlayerLookup } from "@/components/player-name";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/site-card";
import { SponsorLogo } from "@/components/sponsor-logo";
import { Division } from "@/generated/prisma/client";
import { formatDate } from "@/lib/utils";
import { toPar, signInk } from "@/lib/design-helpers";
import { SHOW_REACTIONS } from "@/lib/feature-flags";
import Link from "next/link";

export const revalidate = 60;

type ResultRow = {
  position: number;
  playerName: string;
  playerId?: number;
  score: number;
  relativeScore: number;
  holeScores: Record<string, number>;
};

function assignPositions(rows: ResultRow[]): ResultRow[] {
  const sorted = [...rows].sort((a, b) => a.relativeScore - b.relativeScore);
  let rank = 1;
  return sorted.map((r, i) => {
    if (i > 0 && sorted[i].relativeScore > sorted[i - 1].relativeScore) rank = i + 1;
    return { ...r, position: rank };
  });
}

async function getRound(id: number) {
  return prisma.round.findUnique({
    where: { id },
    include: {
      results: {
        include: { player: true },
        orderBy: [{ division: "asc" }, { position: "asc" }],
      },
      roundWinners: { orderBy: [{ division: "asc" }, { place: "asc" }] },
      ctpWinners: { orderBy: { hole: "asc" } },
      aceWinners: { orderBy: { hole: "asc" } },
      poolWinners: { orderBy: [{ pool: "asc" }, { place: "asc" }] },
      blueLayout: { include: { holePars: { orderBy: { holeNumber: "asc" } } } },
      redLayout: { include: { holePars: { orderBy: { holeNumber: "asc" } } } },
      bobTag: true,
      reactions: true,
      league: true,
    },
  });
}

type RoundWithIncludes = NonNullable<Awaited<ReturnType<typeof getRound>>>;

export default async function RoundPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ league?: string }>;
}) {
  const { id } = await params;
  const { league: leagueParam } = await searchParams;
  const backUrl = leagueParam ? `/rounds?league=${leagueParam}` : "/rounds";

  const round = await getRound(Number(id));

  if (!round || round.isDraft) notFound();

  const [prevRound, nextRound] = await Promise.all([
    prisma.round.findFirst({
      where: { leagueId: round.leagueId, weekNumber: { lt: round.weekNumber } },
      orderBy: { weekNumber: "desc" },
      select: { id: true, weekNumber: true },
    }),
    prisma.round.findFirst({
      where: { leagueId: round.leagueId, weekNumber: { gt: round.weekNumber } },
      orderBy: { weekNumber: "asc" },
      select: { id: true, weekNumber: true },
    }),
  ]);

  const playerLookup: PlayerLookup = new Map(round.results.map((r) => [r.player.name.toLowerCase().trim(), r.player.id]));

  const blueResults = round.results.filter((r) => r.division === Division.BLUE);
  const redResults = round.results.filter((r) => r.division === Division.RED);
  const lowRound = round.results.length > 0 ? round.results.reduce((min, r) => (r.relativeScore < min.relativeScore ? r : min)) : null;

  type PoolGroup = { pool: string; label: string; rows: ResultRow[] };
  let poolGroups: PoolGroup[] = [];
  let blueUnqualified: ResultRow[] = [];
  let redUnqualified: ResultRow[] = [];
  let poolSummaries: PoolSummary[] = [];

  if (round.isChampionship) {
    const standings = await getStandings(round.leagueId);
    poolSummaries = computePoolSummaries(round.results, standings, round.poolWinners);

    const playerPoolMap = new Map<number, string>();
    for (const s of standings) {
      if (s.championshipPool) playerPoolMap.set(s.playerId, s.championshipPool);
    }

    const groups: Record<string, ResultRow[]> = { A: [], B: [], C: [], D: [] };
    for (const result of round.results) {
      const pool = playerPoolMap.get(result.playerId);
      const row: ResultRow = {
        position: result.position,
        playerName: result.player.name,
        playerId: result.playerId,
        score: result.score,
        relativeScore: result.relativeScore,
        holeScores: result.holeScores as Record<string, number>,
      };
      if (pool) groups[pool].push(row);
      else if (result.division === Division.BLUE) blueUnqualified.push(row);
      else redUnqualified.push(row);
    }

    const poolLabels: Record<string, string> = { A: "Pool A", B: "Pool B", C: "Pool C", D: "Pool D" };
    poolGroups = (["A", "B", "C", "D"] as const)
      .filter((p) => groups[p].length > 0)
      .map((p) => ({ pool: p, label: poolLabels[p], rows: assignPositions(groups[p]) }));

    blueUnqualified = assignPositions(blueUnqualified);
    redUnqualified = assignPositions(redUnqualified);
  }

  const blueSummaries = poolSummaries.filter((w) => ["A", "B"].includes(w.pool));
  const redSummaries = poolSummaries.filter((w) => ["C", "D"].includes(w.pool));

  const countsFor = (target: string): ReactionCounts =>
    Object.fromEntries(round.reactions.filter((r) => r.target === target).map((r) => [r.emoji, r.count])) as ReactionCounts;

  return (
    <div className="space-y-8">
      <Hero
        round={round}
        backUrl={backUrl}
        prevRound={prevRound}
        nextRound={nextRound}
        totalPlayers={round.results.length}
        blueCount={blueResults.length}
        redCount={redResults.length}
        lowRound={lowRound}
      />

      {round.isChampionship ? (
        <ThreeCards>
          <WinnersCard title="Blue division" dot="var(--blue-dot)">
            <PoolWinnerRows pools={blueSummaries} playerLookup={playerLookup} leagueId={round.leagueId} />
          </WinnersCard>
          <WinnersCard title="Red division" dot="var(--red-dot)">
            <PoolWinnerRows pools={redSummaries} playerLookup={playerLookup} leagueId={round.leagueId} />
          </WinnersCard>
          <AwardsCard round={round} playerLookup={playerLookup} leagueId={round.leagueId} />
        </ThreeCards>
      ) : (
        <ThreeCards>
          <RegularWinnersCard division={Division.BLUE} round={round} results={blueResults} playerLookup={playerLookup} />
          <RegularWinnersCard division={Division.RED} round={round} results={redResults} playerLookup={playerLookup} />
          <AwardsCard round={round} playerLookup={playerLookup} leagueId={round.leagueId} />
        </ThreeCards>
      )}

      {SHOW_REACTIONS && (
        <Card>
          <CardFooter className="flex-wrap gap-x-6 gap-y-2">
            {round.isChampionship ? (
              <>
                {blueSummaries.length > 0 && <ReactionBar roundId={round.id} target="pool_blue" initialCounts={countsFor("pool_blue")} />}
                {redSummaries.length > 0 && <ReactionBar roundId={round.id} target="pool_red" initialCounts={countsFor("pool_red")} />}
              </>
            ) : (
              <>
                <ReactionBar roundId={round.id} target="winners_blue" initialCounts={countsFor("winners_blue")} />
                <ReactionBar roundId={round.id} target="winners_red" initialCounts={countsFor("winners_red")} />
              </>
            )}
            {round.ctpWinners.length > 0 && <ReactionBar roundId={round.id} target="ctp" initialCounts={countsFor("ctp")} />}
            {round.aceWinners.length > 0 && <ReactionBar roundId={round.id} target="ace" initialCounts={countsFor("ace")} />}
            {round.bobTag && <ReactionBar roundId={round.id} target="bob" initialCounts={countsFor("bob")} />}
          </CardFooter>
        </Card>
      )}

      <ScorecardTabs
        blueLabel="Blue division"
        redLabel="Red division"
        blueContent={
          blueResults.length > 0 ? (
            <>
              {round.isChampionship
                ? poolGroups
                    .filter((g) => ["A", "B"].includes(g.pool))
                    .map((g) => (
                      <ScorecardTable key={g.pool} divisionLabel={g.label} results={g.rows} holePars={round.blueLayout?.holePars ?? []} leagueId={round.leagueId} />
                    ))
                : (
                  <ScorecardTable
                    divisionLabel="Blue division"
                    results={assignPositions(
                      blueResults.map((r) => ({
                        position: r.position,
                        playerName: r.player.name,
                        playerId: r.playerId,
                        score: r.score,
                        relativeScore: r.relativeScore,
                        holeScores: r.holeScores as Record<string, number>,
                      }))
                    )}
                    holePars={round.blueLayout?.holePars ?? []}
                    leagueId={round.leagueId}
                  />
                )}
              {blueUnqualified.length > 0 && (
                <ScorecardTable divisionLabel="Blue — did not qualify" results={blueUnqualified} holePars={round.blueLayout?.holePars ?? []} leagueId={round.leagueId} />
              )}
              {round.blueLayout && (
                <CourseStatsSection stats={computeHoleStats(blueResults.map((r) => r.holeScores as Record<string, number>), round.blueLayout.holePars)} />
              )}
            </>
          ) : undefined
        }
        redContent={
          redResults.length > 0 ? (
            <>
              {round.isChampionship
                ? poolGroups
                    .filter((g) => ["C", "D"].includes(g.pool))
                    .map((g) => (
                      <ScorecardTable key={g.pool} divisionLabel={g.label} results={g.rows} holePars={round.redLayout?.holePars ?? []} leagueId={round.leagueId} />
                    ))
                : (
                  <ScorecardTable
                    divisionLabel="Red division"
                    results={assignPositions(
                      redResults.map((r) => ({
                        position: r.position,
                        playerName: r.player.name,
                        playerId: r.playerId,
                        score: r.score,
                        relativeScore: r.relativeScore,
                        holeScores: r.holeScores as Record<string, number>,
                      }))
                    )}
                    holePars={round.redLayout?.holePars ?? []}
                    leagueId={round.leagueId}
                  />
                )}
              {redUnqualified.length > 0 && (
                <ScorecardTable divisionLabel="Red — did not qualify" results={redUnqualified} holePars={round.redLayout?.holePars ?? []} leagueId={round.leagueId} />
              )}
              {round.redLayout && (
                <CourseStatsSection stats={computeHoleStats(redResults.map((r) => r.holeScores as Record<string, number>), round.redLayout.holePars)} />
              )}
            </>
          ) : undefined
        }
      />
    </div>
  );
}

// ── Hero ─────────────────────────────────────────────────────────────────────

function AdjacentChip({ round, direction }: { round: { id: number; weekNumber: number } | null; direction: "prev" | "next" }) {
  const arrow = direction === "prev" ? "←" : "→";
  const label = round ? `Week ${round.weekNumber}` : "—";
  const content = (
    <>
      {direction === "prev" && arrow} {label} {direction === "next" && arrow}
    </>
  );
  if (!round) {
    return (
      <span
        className="flex h-10 items-center rounded-[var(--r-control)] px-3 text-sm"
        style={{ color: "var(--on-photo-muted)", background: "var(--on-photo-scrim)", border: "1px dashed rgba(238,241,233,0.25)" }}
      >
        {content}
      </span>
    );
  }
  return (
    <Link
      href={`/rounds/${round.id}`}
      className="nav-link flex h-10 items-center rounded-[var(--r-control)] px-3 text-sm font-medium backdrop-blur-sm transition-colors hover:bg-[rgba(238,241,233,0.12)]"
      style={{ color: "var(--on-photo)", background: "var(--on-photo-scrim)", border: "1px solid rgba(238,241,233,0.4)" }}
    >
      {content}
    </Link>
  );
}

function Hero({
  round,
  backUrl,
  prevRound,
  nextRound,
  totalPlayers,
  blueCount,
  redCount,
  lowRound,
}: {
  round: RoundWithIncludes;
  backUrl: string;
  prevRound: { id: number; weekNumber: number } | null;
  nextRound: { id: number; weekNumber: number } | null;
  totalPlayers: number;
  blueCount: number;
  redCount: number;
  lowRound: { relativeScore: number; player: { name: string } } | null;
}) {
  return (
    <div>
      <div className="relative -mx-8 -mt-14 overflow-hidden">
        <div
          className="relative bg-cover px-8 pt-24 pb-10"
          style={{ backgroundImage: "url('/hero-rounds.jpg')", backgroundPosition: "50% 40%" }}
        >
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(to top, rgba(12,17,13,.96) 8%, rgba(12,17,13,.82) 42%, rgba(12,17,13,.58) 100%)",
            }}
          />
          <div className="relative mx-auto max-w-[var(--container)]">
            <div className="flex items-center gap-1.5 font-[family-name:var(--font-mono)] text-xs uppercase tracking-[.14em]" style={{ color: "var(--on-photo-muted)" }}>
              <Link href={backUrl} className="nav-link" style={{ color: "var(--on-photo-muted)" }}>Rounds</Link>
              <span>/</span>
              <span>{round.isChampionship ? "Championship" : `Week ${round.weekNumber}`}</span>
            </div>

            <div className="mt-3 flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <h1
                  className="text-[38px] font-extrabold sm:text-[54px]"
                  style={{ color: "var(--on-photo)", letterSpacing: "-0.035em", lineHeight: 0.98 }}
                >
                  {round.isChampionship ? "Championship" : `Week ${round.weekNumber}`}
                </h1>
                <p className="mt-2 text-sm" style={{ color: "var(--on-photo-2)" }}>
                  {formatDate(round.date)} · {round.league.name} · {round.league.location}
                </p>
              </div>
              <div className="shrink-0 self-start">
                <SponsorLogo />
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              {round.facebookUrl ? (
                <a
                  href={round.facebookUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="nav-link flex h-10 items-center rounded-[var(--r-pill)] px-4 text-sm font-medium backdrop-blur-sm transition-colors hover:bg-[rgba(238,241,233,0.12)]"
                  style={{ background: "var(--on-photo-scrim)", color: "var(--on-photo)", border: "1px solid rgba(238,241,233,0.4)" }}
                >
                  {round.facebookLabel ?? "Recap"} ↗
                </a>
              ) : (
                <span />
              )}
              <div className="flex items-center gap-2">
                <AdjacentChip round={prevRound} direction="prev" />
                <AdjacentChip round={nextRound} direction="next" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "1px", background: "var(--line)" }}>
        <StatCell label="Total players" value={String(totalPlayers)} />
        <StatCell label="Blue division" value={String(blueCount)} dot="var(--blue-dot)" />
        <StatCell label="Red division" value={String(redCount)} dot="var(--red-dot)" />
        <StatCell
          label="Low round"
          value={lowRound ? toPar(lowRound.relativeScore) : "—"}
          ink={lowRound ? signInk(lowRound.relativeScore) : undefined}
          detail={lowRound?.player.name}
        />
      </div>
    </div>
  );
}

function StatCell({ label, value, dot, ink, detail }: { label: string; value: string; dot?: string; ink?: string; detail?: string }) {
  return (
    <div className="px-5 py-4" style={{ background: "var(--bg-card)" }}>
      <div className="flex items-center gap-2">
        {dot && <span className="h-2 w-2 rounded-full" style={{ background: dot }} />}
        <span className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[.13em]" style={{ color: "var(--ink-muted)" }}>
          {label}
        </span>
      </div>
      <div className="mt-1 font-[family-name:var(--font-mono)] text-[26px] font-medium" style={{ color: ink ?? "var(--ink)" }}>
        {value}
      </div>
      {detail && (
        <div className="truncate text-xs" style={{ color: "var(--ink-muted)" }}>
          {detail}
        </div>
      )}
    </div>
  );
}

// ── Winners / awards cards ────────────────────────────────────────────────────

function ThreeCards({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:[grid-template-columns:minmax(0,1.2fr)_minmax(0,1.2fr)_minmax(0,1fr)]">
      {children}
    </div>
  );
}

function WinnersCard({ title, dot, children }: { title: string; dot: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="flex-row items-center gap-2 space-y-0">
        <span className="h-2 w-2 rounded-full" style={{ background: dot }} />
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5">{children}</CardContent>
    </Card>
  );
}

function PodiumEntry({ place, name, playerId, leagueId, relativeScore, prize }: { place: number; name: string; playerId?: number; leagueId: number; relativeScore?: number; prize?: string | null }) {
  return (
    <div
      className="grid items-center gap-2 rounded-[var(--r-panel)] px-2 py-1.5"
      style={{ gridTemplateColumns: "26px 1fr auto", background: place === 1 ? "var(--accent-soft)" : "transparent" }}
    >
      <span
        className="flex h-[24px] w-[24px] items-center justify-center rounded-full font-[family-name:var(--font-mono)] text-[11px]"
        style={place === 1 ? { background: "var(--accent)", color: "var(--accent-ink)" } : { border: "1px solid var(--line-strong)", color: "var(--ink-2)" }}
      >
        {place}
      </span>
      <div className="min-w-0">
        {playerId ? (
          <Link href={`/players/${playerId}?league=${leagueId}`} className="block truncate text-sm font-semibold" style={{ color: place === 1 ? "var(--positive)" : "var(--ink)" }}>
            {name}
          </Link>
        ) : (
          <span className="block truncate text-sm font-semibold" style={{ color: place === 1 ? "var(--positive)" : "var(--ink)" }}>
            {name}
          </span>
        )}
        {prize && (
          <span className="font-[family-name:var(--font-mono)] text-[10px]" style={{ color: "var(--gold)" }}>
            {prize}
          </span>
        )}
      </div>
      {relativeScore !== undefined && (
        <span className="font-[family-name:var(--font-mono)] text-xs" style={{ color: "var(--positive)" }}>
          {toPar(relativeScore)}
        </span>
      )}
    </div>
  );
}

function RegularWinnersCard({
  division,
  round,
  results,
  playerLookup,
}: {
  division: Division;
  round: RoundWithIncludes;
  results: RoundWithIncludes["results"];
  playerLookup: PlayerLookup;
}) {
  const savedFirst = round.roundWinners.find((w) => w.division === division && w.place === 1);
  const first = results.find((r) => r.position === 1);
  const firstName = savedFirst?.playerName ?? first?.player.name;
  const firstId = savedFirst ? playerLookup.get(savedFirst.playerName.toLowerCase().trim()) : first?.player.id;

  const savedSeconds = round.roundWinners.filter((w) => w.division === division && w.place === 2);
  const seconds =
    savedSeconds.length > 0
      ? savedSeconds.map((w) => ({ key: w.id, playerName: w.playerName, prize: w.prize, id: playerLookup.get(w.playerName.toLowerCase().trim()) }))
      : results.filter((r) => r.position === 2).map((r) => ({ key: r.id, playerName: r.player.name, prize: null as string | null, id: r.player.id }));

  return (
    <WinnersCard title={division === Division.BLUE ? "Blue division" : "Red division"} dot={division === Division.BLUE ? "var(--blue-dot)" : "var(--red-dot)"}>
      {!firstName && seconds.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--ink-muted)" }}>No results</p>
      ) : (
        <>
          {firstName && (
            <PodiumEntry place={1} name={firstName} playerId={firstId} leagueId={round.leagueId} relativeScore={first?.relativeScore} prize={savedFirst?.prize} />
          )}
          {seconds.map((s) => (
            <PodiumEntry key={s.key} place={2} name={s.playerName} playerId={s.id} leagueId={round.leagueId} prize={s.prize} />
          ))}
        </>
      )}
    </WinnersCard>
  );
}

function PoolWinnerRows({ pools, playerLookup, leagueId }: { pools: PoolSummary[]; playerLookup: PlayerLookup; leagueId: number }) {
  if (pools.length === 0) return <p className="text-sm" style={{ color: "var(--ink-muted)" }}>No results</p>;
  return (
    <>
      {pools.map((w) => (
        <div key={w.pool} className="space-y-1">
          <p className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[.13em]" style={{ color: "var(--ink-muted)" }}>
            Pool {w.pool}
          </p>
          {w.first && (
            <PodiumEntry place={1} name={w.first.playerName} playerId={playerLookup.get(w.first.playerName.toLowerCase().trim())} leagueId={leagueId} relativeScore={w.first.relativeScore} prize={w.first.prize} />
          )}
          {w.second && (
            <PodiumEntry place={2} name={w.second.playerName} playerId={playerLookup.get(w.second.playerName.toLowerCase().trim())} leagueId={leagueId} relativeScore={w.second.relativeScore} prize={w.second.prize} />
          )}
          {w.third && (
            <PodiumEntry place={3} name={w.third.playerName} playerId={playerLookup.get(w.third.playerName.toLowerCase().trim())} leagueId={leagueId} relativeScore={w.third.relativeScore} prize={w.third.prize} />
          )}
        </div>
      ))}
    </>
  );
}

function AwardsCard({ round, playerLookup, leagueId }: { round: RoundWithIncludes; playerLookup: PlayerLookup; leagueId: number }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Awards</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="mb-1.5 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[.13em]" style={{ color: "var(--ink-muted)" }}>
            Closest to pin
          </p>
          {round.ctpWinners.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--ink-muted)" }}>No CTP recorded</p>
          ) : (
            <div className="space-y-1.5">
              {round.ctpWinners.map((c) => (
                <div key={c.id} className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="h-[11px] w-[11px] shrink-0 rounded-full" style={{ border: "2px solid var(--positive)" }} />
                  <span style={{ color: "var(--ink-2)" }}>Hole {c.hole}:</span>
                  <PlayerName name={c.playerName} lookup={playerLookup} leagueId={leagueId} className="font-semibold" />
                  {c.prize && <span className="font-[family-name:var(--font-mono)] text-xs" style={{ color: "var(--gold)" }}>{c.prize}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
        {round.aceWinners.length > 0 && (
          <div>
            <p className="mb-1.5 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[.13em]" style={{ color: "var(--ink-muted)" }}>
              Aces
            </p>
            <div className="space-y-1.5">
              {round.aceWinners.map((a) => (
                <div key={a.id} className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="h-[7px] w-[7px] shrink-0 rounded-full" style={{ background: "var(--gold)" }} />
                  <span style={{ color: "var(--ink-2)" }}>Hole {a.hole}:</span>
                  <PlayerName name={a.playerName} lookup={playerLookup} leagueId={leagueId} className="font-semibold" />
                  {a.prizeAmount != null && <span className="font-[family-name:var(--font-mono)] text-xs" style={{ color: "var(--gold)" }}>${a.prizeAmount.toFixed(2)}</span>}
                </div>
              ))}
            </div>
          </div>
        )}
        <div>
          <p className="mb-1.5 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[.13em]" style={{ color: "var(--ink-muted)" }}>
            BoB tag
          </p>
          {round.bobTag ? (
            <div className="flex items-center gap-2 text-sm">
              <span className="h-[11px] w-[11px] shrink-0 rounded-[3px]" style={{ border: "2px solid var(--gold)" }} />
              <PlayerName name={round.bobTag.playerName} lookup={playerLookup} leagueId={leagueId} className="font-semibold" />
            </div>
          ) : (
            <p className="text-sm" style={{ color: "var(--ink-muted)" }}>Not awarded this week</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
