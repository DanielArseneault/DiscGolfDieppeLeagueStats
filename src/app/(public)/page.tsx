import { prisma } from "@/lib/db";
import { getStandings } from "@/lib/standings";
import { computePoolSummaries, PoolSummary } from "@/lib/pool-utils";
import { computeHoleStats } from "@/lib/course-stats";
import { DivisionPanel } from "@/components/division-panel";
import { PlayerName, type PlayerLookup } from "@/components/player-name";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/site-card";
import { ReactionBar, type ReactionCounts } from "@/components/reaction-bar";
import { SponsorLogo } from "@/components/sponsor-logo";
import { Division } from "@/generated/prisma/client";
import { formatDate } from "@/lib/utils";
import { toPar, signInk } from "@/lib/design-helpers";
import { SHOW_REACTIONS } from "@/lib/feature-flags";
import Link from "next/link";

export const revalidate = 60;

type League = Awaited<ReturnType<typeof prisma.league.findMany>>[number];

async function getData(league: League) {
  const [standings, recentRound, qualifyingRoundsPlayed, allResults] = await Promise.all([
    getStandings(league.id),
    prisma.round.findFirst({
      where: { leagueId: league.id },
      orderBy: { weekNumber: "desc" },
      include: {
        results: {
          include: { player: true },
          orderBy: [{ division: "asc" }, { position: "asc" }],
        },
        roundWinners: { orderBy: [{ division: "asc" }, { place: "asc" }] },
        ctpWinners: { orderBy: { hole: "asc" } },
        poolWinners: { orderBy: [{ pool: "asc" }, { place: "asc" }] },
        blueLayout: { include: { holePars: { orderBy: { holeNumber: "asc" } } } },
        redLayout: { include: { holePars: { orderBy: { holeNumber: "asc" } } } },
        bobTag: true,
        reactions: true,
        _count: { select: { results: true } },
      },
    }),
    prisma.round.count({ where: { leagueId: league.id, isChampionship: false } }),
    prisma.result.findMany({
      where: { round: { leagueId: league.id } },
      select: { division: true, holeScores: true },
    }),
  ]);

  const poolSummaries: PoolSummary[] = recentRound?.isChampionship
    ? computePoolSummaries(recentRound.results, standings, recentRound.poolWinners)
    : [];

  const blueLeagueStats = recentRound?.blueLayout
    ? computeHoleStats(
        allResults.filter((r) => r.division === Division.BLUE).map((r) => r.holeScores as Record<string, number>),
        recentRound.blueLayout.holePars
      )
    : null;
  const redLeagueStats = recentRound?.redLayout
    ? computeHoleStats(
        allResults.filter((r) => r.division === Division.RED).map((r) => r.holeScores as Record<string, number>),
        recentRound.redLayout.holePars
      )
    : null;

  return { league, standings, recentRound, qualifyingRoundsPlayed, poolSummaries, blueLeagueStats, redLeagueStats };
}

const emptyState = (
  <div className="py-24 text-center">
    <h1 className="mb-2 text-2xl font-bold" style={{ color: "var(--ink)" }}>
      Welcome to Dieppe DGC League
    </h1>
    <p style={{ color: "var(--ink-muted)" }}>No league data yet. Visit the admin panel to get started.</p>
    <Link href="/admin" className="mt-4 inline-block text-sm">
      Go to Admin →
    </Link>
  </div>
);

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ league?: string; division?: string }>;
}) {
  const { league: leagueParam, division: divisionParam } = await searchParams;
  const leagueId = leagueParam ? Number(leagueParam) : null;

  let allLeagues: League[];
  let data: Awaited<ReturnType<typeof getData>>;

  if (leagueId) {
    const [leagues, leagueRow] = await Promise.all([
      prisma.league.findMany({ orderBy: { year: "desc" } }),
      prisma.league.findUnique({ where: { id: leagueId } }),
    ]);
    allLeagues = leagues;
    if (allLeagues.length === 0) return emptyState;
    const selectedLeague = leagueRow ?? allLeagues[0];
    data = await getData(selectedLeague);
  } else {
    allLeagues = await prisma.league.findMany({ orderBy: { year: "desc" } });
    if (allLeagues.length === 0) return emptyState;
    data = await getData(allLeagues[0]);
  }

  const { league, standings, recentRound, qualifyingRoundsPlayed, poolSummaries, blueLeagueStats, redLeagueStats } = data;

  const playerLookup: PlayerLookup = new Map(
    (recentRound?.results ?? []).map((r) => [r.player.name.toLowerCase().trim(), r.player.id])
  );

  const blueCount = standings.filter((s) => s.division === Division.BLUE).length;
  const redCount = standings.filter((s) => s.division === Division.RED).length;
  const qualifiedCount = standings.filter((s) => s.qualified).length;

  const initialDivision: Division =
    divisionParam === "red" ? Division.RED
    : divisionParam === "blue" ? Division.BLUE
    : blueCount > 0 ? Division.BLUE : Division.RED;

  return (
    <div className="space-y-8">
      <Hero league={league} allLeagues={allLeagues} />

      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "1px", background: "var(--line)" }}>
        <StatCell label="Blue division" value={blueCount} dot="var(--blue-dot)" />
        <StatCell label="Red division" value={redCount} dot="var(--red-dot)" />
        <StatCell label="Qualified" value={qualifiedCount} total={blueCount + redCount} />
        <StatCell label="Rounds played" value={qualifyingRoundsPlayed} total={league.qualifyingWeeks} />
      </div>

      {recentRound &&
        (recentRound.isChampionship ? (
          <ChampionshipResults round={recentRound} poolSummaries={poolSummaries} leagueId={league.id} playerLookup={playerLookup} />
        ) : (
          <RecentRound round={recentRound} leagueId={league.id} playerLookup={playerLookup} />
        ))}

      <DivisionPanel
        standings={standings}
        bestScoresCount={league.bestScoresCount}
        qualifyingWeeks={league.qualifyingWeeks}
        minWeeks={league.minWeeks}
        leagueId={league.id}
        blueCount={blueCount}
        redCount={redCount}
        blueStats={blueLeagueStats}
        redStats={redLeagueStats}
        initialDivision={initialDivision}
        standingsTitle={recentRound?.isChampionship ? "Final standings" : "Season standings"}
      />
    </div>
  );
}

function StatCell({ label, value, total, dot }: { label: string; value: number; total?: number; dot?: string }) {
  return (
    <div className="px-5 py-4" style={{ background: "var(--bg-card)" }}>
      <div className="flex items-center gap-2">
        {dot && <span className="h-2 w-2 rounded-full" style={{ background: dot }} />}
        <span className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[.13em]" style={{ color: "var(--ink-muted)" }}>
          {label}
        </span>
      </div>
      <div className="mt-1 font-[family-name:var(--font-mono)] text-[26px] font-medium" style={{ color: "var(--ink)" }}>
        {value}
        {total !== undefined && (
          <span className="text-base" style={{ color: "var(--ink-muted)" }}>
            {" "}
            / {total}
          </span>
        )}
      </div>
    </div>
  );
}

function Hero({ league, allLeagues }: { league: League; allLeagues: League[] }) {
  return (
    <div className="relative -mx-8 -mt-14 overflow-hidden">
      <div
        className="relative bg-cover px-8 pt-28 pb-10"
        style={{ backgroundImage: "url('/hero-basket.jpg')", backgroundPosition: "28% 30%" }}
      >
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to top, rgba(12,17,13,.96) 8%, rgba(12,17,13,.82) 42%, rgba(12,17,13,.58) 100%)",
          }}
        />
        <div className="relative mx-auto max-w-[var(--container)]">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p
                className="mb-1 font-[family-name:var(--font-mono)] text-xs uppercase tracking-[.14em]"
                style={{ color: "var(--on-photo-muted)" }}
              >
                Standings
              </p>
              <h1
                className="text-[32px] font-extrabold sm:text-[52px]"
                style={{ color: "var(--on-photo)", letterSpacing: "-0.035em", lineHeight: 1.02 }}
              >
                {league.name}
              </h1>
              {league.shortName && (
                <p className="mt-1 text-base font-medium" style={{ color: "var(--on-photo-2)" }}>
                  {league.shortName}
                </p>
              )}
              <p className="mt-2 text-sm" style={{ color: "var(--on-photo-2)" }}>
                {formatDate(league.startDate)} – {formatDate(league.endDate)} · {league.location}
              </p>
            </div>
            <div className="shrink-0 self-start">
              <SponsorLogo />
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            {league.facebookUrl ? (
              <a
                href={league.facebookUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="nav-link flex h-10 items-center gap-2 rounded-[var(--r-pill)] px-4 text-sm font-medium backdrop-blur-sm transition-colors hover:bg-[rgba(238,241,233,0.12)]"
                style={{ background: "var(--on-photo-scrim)", color: "var(--on-photo)", border: "1px solid rgba(238,241,233,0.4)" }}
              >
                League info &amp; registration →
              </a>
            ) : (
              <span />
            )}

            {allLeagues.length > 1 && (
              <div className="flex items-center gap-2">
                <span
                  className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[.14em]"
                  style={{ color: "var(--on-photo-muted)" }}
                >
                  Season
                </span>
                <div className="flex gap-1.5">
                  {allLeagues.map((l) => (
                    <a
                      key={l.id}
                      href={`/?league=${l.id}`}
                      className="nav-link rounded-[var(--r-pill)] px-2.5 py-1 font-[family-name:var(--font-mono)] text-xs transition-colors"
                      style={
                        l.id === league.id
                          ? { background: "var(--on-photo-accent)", color: "#141a16" }
                          : { color: "var(--on-photo-muted)" }
                      }
                    >
                      {l.year}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Normal round ──────────────────────────────────────────────────────────────

type GetDataResult = NonNullable<Awaited<ReturnType<typeof getData>>>;
type RoundData = NonNullable<GetDataResult["recentRound"]>;

function ScoreReading({ score, relativeScore }: { score: number; relativeScore: number }) {
  return (
    <span className="font-[family-name:var(--font-mono)] text-xs whitespace-nowrap">
      <span style={{ color: signInk(relativeScore) }}>{score}</span>{" "}
      <span style={{ color: "var(--ink-muted)" }}>({toPar(relativeScore)})</span>
    </span>
  );
}

function PodiumRow({
  place,
  name,
  playerId,
  leagueId,
  score,
  relativeScore,
  prize,
}: {
  place: number;
  name: string;
  playerId?: number;
  leagueId: number;
  score: number;
  relativeScore: number;
  prize?: string | null;
}) {
  const nameClass = "min-w-0 truncate text-sm font-semibold";
  const nameStyle = { color: place === 1 ? "var(--positive)" : "var(--ink)" };
  return (
    <div
      className="grid items-center gap-2 rounded-[var(--r-panel)] px-2 py-1.5"
      style={{ gridTemplateColumns: "26px 1fr auto", background: place === 1 ? "var(--accent-soft)" : "transparent" }}
    >
      <span
        className="flex h-[24px] w-[24px] items-center justify-center rounded-full font-[family-name:var(--font-mono)] text-[11px]"
        style={
          place === 1
            ? { background: "var(--accent)", color: "var(--accent-ink)" }
            : { border: "1px solid var(--line-strong)", color: "var(--ink-2)" }
        }
      >
        {place}
      </span>
      {playerId ? (
        <Link href={`/players/${playerId}?league=${leagueId}`} className={nameClass} style={nameStyle}>
          {name}
          {prize && (
            <span className="ml-2 font-[family-name:var(--font-mono)] text-[10px] font-normal" style={{ color: "var(--gold)" }}>
              {prize}
            </span>
          )}
        </Link>
      ) : (
        <span className={nameClass} style={nameStyle}>
          {name}
          {prize && (
            <span className="ml-2 font-[family-name:var(--font-mono)] text-[10px] font-normal" style={{ color: "var(--gold)" }}>
              {prize}
            </span>
          )}
        </span>
      )}
      <ScoreReading score={score} relativeScore={relativeScore} />
    </div>
  );
}

function RecentRound({ round, leagueId, playerLookup }: { round: RoundData; leagueId: number; playerLookup: PlayerLookup }) {
  const initialCounts = Object.fromEntries(
    round.reactions.filter((r) => r.target === "round").map((r) => [r.emoji, r.count])
  ) as ReactionCounts;

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle>Week {round.weekNumber} results</CardTitle>
          <p className="mt-1 font-[family-name:var(--font-mono)] text-xs" style={{ color: "var(--ink-muted)" }}>
            {formatDate(round.date)} · {round._count.results} players
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {round.facebookUrl && (
            <a
              href={round.facebookUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="nav-link shrink-0 rounded-[var(--r-pill)] px-3 py-1.5 text-sm font-medium"
              style={{ background: "var(--chip-neutral)", color: "var(--ink-2)" }}
            >
              {round.facebookLabel ?? "Recap"} ↗
            </a>
          )}
          <Link
            href={`/rounds/${round.id}?league=${leagueId}`}
            className="shrink-0 rounded-[var(--r-pill)] px-3 py-1.5 text-sm font-medium"
            style={{ background: "var(--accent-soft)", color: "var(--positive)" }}
          >
            Full scorecard →
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid md:grid-cols-2" style={{ gap: "1px", background: "var(--line)" }}>
          {([Division.BLUE, Division.RED] as Division[]).map((div) => {
            const top3 = round.results.filter((r) => r.division === div).slice(0, 3);
            const overrideWinner = round.roundWinners.find((w) => w.division === div && w.place === 1);
            const secondPrize = round.roundWinners.find((w) => w.division === div && w.place === 2 && w.prize)?.prize ?? null;
            return (
              <div key={div} className="p-4" style={{ background: "var(--bg-card)" }}>
                <p className="mb-2 flex items-center gap-1.5 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[.13em]" style={{ color: "var(--ink-muted)" }}>
                  <span className="h-2 w-2 rounded-full" style={{ background: div === Division.BLUE ? "var(--blue-dot)" : "var(--red-dot)" }} />
                  {div === Division.BLUE ? "Blue division" : "Red division"}
                </p>
                {top3.length === 0 ? (
                  <p className="text-sm" style={{ color: "var(--ink-muted)" }}>No results</p>
                ) : (
                  <div className="space-y-1">
                    {top3.map((r, i) => {
                      const displayName = i === 0 && overrideWinner ? overrideWinner.playerName : r.player.name;
                      const playerId =
                        i === 0 && overrideWinner
                          ? playerLookup.get(overrideWinner.playerName.toLowerCase().trim()) ?? r.player.id
                          : r.player.id;
                      const prize = i === 0 ? overrideWinner?.prize ?? null : i === 1 ? secondPrize : null;
                      return (
                        <PodiumRow
                          key={r.id}
                          place={i + 1}
                          name={displayName}
                          playerId={playerId}
                          leagueId={leagueId}
                          score={r.score}
                          relativeScore={r.relativeScore}
                          prize={prize}
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {round.ctpWinners.length > 0 && (
          <div className="mt-4 pt-4" style={{ borderTop: "1px solid var(--line-2)" }}>
            <p className="mb-2 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[.13em]" style={{ color: "var(--ink-muted)" }}>
              Closest to pin
            </p>
            <div className="space-y-1.5">
              {round.ctpWinners.map((c) => (
                <div key={c.id} className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="h-[11px] w-[11px] shrink-0 rounded-full" style={{ border: "2px solid var(--positive)" }} />
                  <span style={{ color: "var(--ink-2)" }}>Hole {c.hole}:</span>
                  <PlayerName name={c.playerName} lookup={playerLookup} leagueId={leagueId} className="font-semibold" />
                  {c.prize && (
                    <span className="font-[family-name:var(--font-mono)] text-xs" style={{ color: "var(--gold)" }}>
                      {c.prize}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
        {round.bobTag && (
          <div className="mt-4 pt-4" style={{ borderTop: "1px solid var(--line-2)" }}>
            <p className="mb-2 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[.13em]" style={{ color: "var(--ink-muted)" }}>
              BoB tag
            </p>
            <div className="flex items-center gap-2 text-sm">
              <span className="h-[11px] w-[11px] shrink-0 rounded-[3px]" style={{ border: "2px solid var(--gold)" }} />
              <PlayerName name={round.bobTag.playerName} lookup={playerLookup} leagueId={leagueId} className="font-semibold" />
            </div>
          </div>
        )}
      </CardContent>
      {SHOW_REACTIONS && (
        <CardFooter>
          <ReactionBar roundId={round.id} target="round" initialCounts={initialCounts} />
        </CardFooter>
      )}
    </Card>
  );
}

// ── Championship round ────────────────────────────────────────────────────────

function ChampionshipResults({
  round,
  poolSummaries,
  leagueId,
  playerLookup,
}: {
  round: RoundData;
  poolSummaries: PoolSummary[];
  leagueId: number;
  playerLookup: PlayerLookup;
}) {
  const initialCounts = Object.fromEntries(
    round.reactions.filter((r) => r.target === "round").map((r) => [r.emoji, r.count])
  ) as ReactionCounts;
  const bluePools = poolSummaries.filter((w) => ["A", "B"].includes(w.pool));
  const redPools = poolSummaries.filter((w) => ["C", "D"].includes(w.pool));

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle>Championship results</CardTitle>
          <p className="mt-1 font-[family-name:var(--font-mono)] text-xs" style={{ color: "var(--ink-muted)" }}>
            {formatDate(round.date)} · {round._count.results} players
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {round.facebookUrl && (
            <a
              href={round.facebookUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="nav-link rounded-[var(--r-pill)] px-3 py-1.5 text-sm font-medium"
              style={{ background: "var(--chip-neutral)", color: "var(--ink-2)" }}
            >
              {round.facebookLabel ?? "Recap"} ↗
            </a>
          )}
          <Link
            href={`/rounds/${round.id}?league=${leagueId}`}
            className="rounded-[var(--r-pill)] px-3 py-1.5 text-sm font-medium"
            style={{ background: "var(--accent-soft)", color: "var(--positive)" }}
          >
            Full scorecard →
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2 md:gap-6">
          <PoolColumn label="Blue division" dot="var(--blue-dot)" pools={bluePools} playerLookup={playerLookup} leagueId={leagueId} />
          <PoolColumn label="Red division" dot="var(--red-dot)" pools={redPools} playerLookup={playerLookup} leagueId={leagueId} />
        </div>
        {round.ctpWinners.length > 0 && (
          <div className="mt-4 pt-4" style={{ borderTop: "1px solid var(--line-2)" }}>
            <p className="mb-2 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[.13em]" style={{ color: "var(--ink-muted)" }}>
              Closest to pin
            </p>
            <div className="space-y-1.5">
              {round.ctpWinners.map((c) => (
                <div key={c.id} className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="h-[11px] w-[11px] shrink-0 rounded-full" style={{ border: "2px solid var(--positive)" }} />
                  <span style={{ color: "var(--ink-2)" }}>Hole {c.hole}:</span>
                  <PlayerName name={c.playerName} lookup={playerLookup} leagueId={leagueId} className="font-semibold" />
                  {c.prize && (
                    <span className="font-[family-name:var(--font-mono)] text-xs" style={{ color: "var(--gold)" }}>
                      {c.prize}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
      {SHOW_REACTIONS && (
        <CardFooter>
          <ReactionBar roundId={round.id} target="round" initialCounts={initialCounts} />
        </CardFooter>
      )}
    </Card>
  );
}

function PoolColumn({
  label,
  dot,
  pools,
  playerLookup,
  leagueId,
}: {
  label: string;
  dot: string;
  pools: PoolSummary[];
  playerLookup: PlayerLookup;
  leagueId: number;
}) {
  return (
    <div>
      <p className="mb-3 flex items-center gap-1.5 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[.13em]" style={{ color: "var(--ink-muted)" }}>
        <span className="h-2 w-2 rounded-full" style={{ background: dot }} />
        {label}
      </p>
      {pools.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--ink-muted)" }}>No results</p>
      ) : (
        <div className="space-y-3">
          {pools.map((w) => (
            <div key={w.pool} className="rounded-[var(--r-panel)] px-4 py-3" style={{ background: "var(--bg-inset)" }}>
              <p className="mb-2 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[.13em]" style={{ color: "var(--ink-muted)" }}>
                Pool {w.pool}
              </p>
              {w.first && (
                <PodiumRow
                  place={1}
                  name={w.first.playerName}
                  playerId={playerLookup.get(w.first.playerName.toLowerCase().trim())}
                  leagueId={leagueId}
                  score={w.first.score}
                  relativeScore={w.first.relativeScore}
                  prize={w.first.prize}
                />
              )}
              {w.second && (
                <PodiumRow
                  place={2}
                  name={w.second.playerName}
                  playerId={playerLookup.get(w.second.playerName.toLowerCase().trim())}
                  leagueId={leagueId}
                  score={w.second.score}
                  relativeScore={w.second.relativeScore}
                  prize={w.second.prize}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
