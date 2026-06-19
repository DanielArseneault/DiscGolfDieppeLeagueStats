import { prisma } from "@/lib/db";
import { getStandings } from "@/lib/standings";
import { notFound } from "next/navigation";
import { Division } from "@/generated/prisma/client";
import { formatScore, formatDate } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";

export const revalidate = 60;

async function getPlayerData(playerId: number) {
  return prisma.player.findUnique({
    where: { id: playerId },
    include: {
      league: true,
      results: {
        include: {
          round: {
            select: { id: true, weekNumber: true, date: true, isChampionship: true },
          },
        },
        orderBy: { round: { weekNumber: "asc" } },
      },
    },
  });
}

type PlayerData = NonNullable<Awaited<ReturnType<typeof getPlayerData>>>;

function computeStats(results: PlayerData["results"]) {
  const qualifying = results.filter((r) => !r.round.isChampionship);
  const avg =
    qualifying.length > 0
      ? qualifying.reduce((s, r) => s + r.relativeScore, 0) / qualifying.length
      : null;
  const best =
    qualifying.length > 0 ? Math.min(...qualifying.map((r) => r.relativeScore)) : null;
  const wins = qualifying.filter((r) => r.position === 1).length;
  const top3 = qualifying.filter((r) => r.position <= 3).length;
  return { qualifying, avg, best, wins, top3 };
}

// ── Picker (no players selected yet) ─────────────────────────────────────────

async function PickerPage({ leagueId, preA }: { leagueId: number | null; preA?: number }) {
  const league = leagueId
    ? await prisma.league.findUnique({ where: { id: leagueId } })
    : await prisma.league.findFirst({ orderBy: { year: "desc" } });

  if (!league) notFound();

  const players = await prisma.player.findMany({
    where: { leagueId: league.id },
    orderBy: [{ division: "asc" }, { name: "asc" }],
  });

  const bluePlayers = players.filter((p) => p.division === Division.BLUE);
  const redPlayers = players.filter((p) => p.division === Division.RED);

  return (
    <div className="space-y-6 pt-4">
      <div>
        <h1 className="text-2xl font-black text-slate-900">Head-to-Head Comparison</h1>
        <p className="text-slate-500 text-sm mt-1">
          {league.name} · {league.year}
        </p>
      </div>

      <Card className="border-slate-200">
        <CardContent className="pt-6">
          <form method="GET" action="/compare" className="space-y-5">
            <input type="hidden" name="league" value={league.id} />
            <div className="grid sm:grid-cols-[1fr_auto_1fr] gap-4 items-end">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Player A
                </label>
                <select
                  name="a"
                  defaultValue={preA ?? ""}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Select a player…</option>
                  <optgroup label="Blue Division">
                    {bluePlayers.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Red Division">
                    {redPlayers.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>

              <div className="text-slate-400 font-black text-lg text-center pb-2">VS</div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Player B
                </label>
                <select
                  name="b"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Select a player…</option>
                  <optgroup label="Blue Division">
                    {bluePlayers.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Red Division">
                    {redPlayers.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>
            </div>

            <button
              type="submit"
              className="w-full sm:w-auto px-6 py-2 bg-green-700 hover:bg-green-800 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              Compare →
            </button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Main comparison ───────────────────────────────────────────────────────────

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<{ a?: string; b?: string; league?: string }>;
}) {
  const { a, b, league: leagueParam } = await searchParams;
  const leagueId = leagueParam ? Number(leagueParam) : null;

  if (!a || !b) {
    return <PickerPage leagueId={leagueId} preA={a ? Number(a) : undefined} />;
  }

  const [playerA, playerB] = await Promise.all([
    getPlayerData(Number(a)),
    getPlayerData(Number(b)),
  ]);

  if (!playerA || !playerB) notFound();

  const league = playerA.league;
  const standings = await getStandings(league.id);

  const standingA = standings.find((s) => s.playerId === playerA.id);
  const standingB = standings.find((s) => s.playerId === playerB.id);

  const statsA = computeStats(playerA.results);
  const statsB = computeStats(playerB.results);

  // Head-to-head: qualifying rounds where both played
  const aRoundMap = new Map(playerA.results.map((r) => [r.round.id, r]));
  const bRoundMap = new Map(playerB.results.map((r) => [r.round.id, r]));

  const h2hRounds = [...aRoundMap.entries()]
    .filter(([id, r]) => bRoundMap.has(id) && !r.round.isChampionship)
    .map(([id, aResult]) => {
      const bResult = bRoundMap.get(id)!;
      return {
        roundId: id,
        weekNumber: aResult.round.weekNumber,
        date: aResult.round.date,
        aScore: aResult.score,
        bScore: bResult.score,
        aRelScore: aResult.relativeScore,
        bRelScore: bResult.relativeScore,
      };
    })
    .sort((x, y) => x.weekNumber - y.weekNumber);

  let aWins = 0,
    bWins = 0,
    ties = 0;
  for (const r of h2hRounds) {
    if (r.aRelScore < r.bRelScore) aWins++;
    else if (r.bRelScore < r.aRelScore) bWins++;
    else ties++;
  }

  const avgDiff =
    h2hRounds.length > 0
      ? h2hRounds.reduce((s, r) => s + (r.aRelScore - r.bRelScore), 0) / h2hRounds.length
      : null;

  const leagueUrl = `/?league=${league.id}`;
  const crossDivision = playerA.division !== playerB.division;

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="-mx-4 -mt-14 relative overflow-hidden mb-2">
        <div className="px-4 pt-16 pb-20 md:px-8 md:pt-20 md:pb-24 text-white relative bg-slate-900">
          <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/30 to-transparent pointer-events-none" />
          <div className="relative">
            <div className="flex items-center gap-2 text-white/60 text-xs font-semibold uppercase tracking-widest mb-4">
              <Link href={leagueUrl} className="hover:text-white/90 transition-colors">
                Standings
              </Link>
              <span>/</span>
              <span>Head-to-Head</span>
            </div>

            <div className="flex items-center gap-4 sm:gap-8">
              {/* Player A */}
              <div className="flex-1 min-w-0">
                <Link
                  href={`/players/${playerA.id}?league=${league.id}`}
                  className="group block"
                >
                  <p
                    className={`text-xs font-semibold uppercase tracking-wide mb-1 ${playerA.division === Division.BLUE ? "text-blue-300" : "text-red-300"}`}
                  >
                    {playerA.division === Division.BLUE ? "🔵 Blue" : "🔴 Red"}
                  </p>
                  <h1 className="text-2xl sm:text-3xl font-black tracking-tight truncate group-hover:underline">
                    {playerA.name}
                  </h1>
                </Link>
              </div>

              <div className="shrink-0 text-white/30 text-xl sm:text-2xl font-black tracking-widest">
                VS
              </div>

              {/* Player B */}
              <div className="flex-1 min-w-0 text-right">
                <Link
                  href={`/players/${playerB.id}?league=${league.id}`}
                  className="group block"
                >
                  <p
                    className={`text-xs font-semibold uppercase tracking-wide mb-1 ${playerB.division === Division.BLUE ? "text-blue-300" : "text-red-300"}`}
                  >
                    {playerB.division === Division.BLUE ? "🔵 Blue" : "🔴 Red"}
                  </p>
                  <h1 className="text-2xl sm:text-3xl font-black tracking-tight truncate group-hover:underline">
                    {playerB.name}
                  </h1>
                </Link>
              </div>
            </div>

            <p className="text-white/40 text-xs mt-3">
              {league.name} · {league.year}
              {crossDivision && " · Cross-division comparison"}
            </p>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0">
          <svg
            viewBox="0 0 1200 56"
            preserveAspectRatio="none"
            className="w-full h-8 md:h-14 fill-[#f8fafc]"
          >
            <path d="M0,56 L0,28 C150,56 300,8 500,22 C700,36 900,4 1200,22 L1200,56 Z" />
          </svg>
        </div>
      </div>

      {/* Head-to-head record */}
      {h2hRounds.length > 0 && (
        <Card className="border-slate-200">
          <CardContent className="pt-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 text-center mb-4">
              Head-to-Head · {h2hRounds.length} round{h2hRounds.length !== 1 ? "s" : ""} played
              together
            </p>
            <div className="flex items-stretch">
              <div
                className={`flex-1 text-center py-5 rounded-l-xl border ${aWins > bWins ? "bg-emerald-50 border-emerald-200" : "bg-slate-50 border-slate-200"}`}
              >
                <div
                  className={`text-5xl font-black tabular-nums ${aWins > bWins ? "text-emerald-600" : "text-slate-300"}`}
                >
                  {aWins}
                </div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mt-2 px-3 truncate">
                  {playerA.name}
                </div>
              </div>

              {ties > 0 && (
                <div className="shrink-0 text-center px-5 py-5 bg-slate-100 border-y border-slate-200">
                  <div className="text-5xl font-black tabular-nums text-slate-300">{ties}</div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-400 mt-2">
                    Tied
                  </div>
                </div>
              )}

              <div
                className={`flex-1 text-center py-5 rounded-r-xl border ${bWins > aWins ? "bg-emerald-50 border-emerald-200" : "bg-slate-50 border-slate-200"}`}
              >
                <div
                  className={`text-5xl font-black tabular-nums ${bWins > aWins ? "text-emerald-600" : "text-slate-300"}`}
                >
                  {bWins}
                </div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mt-2 px-3 truncate">
                  {playerB.name}
                </div>
              </div>
            </div>

            {avgDiff !== null && Math.abs(avgDiff) >= 0.05 && (
              <p className="text-xs text-slate-500 text-center mt-3">
                {avgDiff < 0 ? playerA.name : playerB.name} averages{" "}
                <span className="font-semibold text-slate-700">
                  {Math.abs(Math.round(avgDiff * 10) / 10)}
                </span>{" "}
                stroke{Math.abs(Math.round(avgDiff * 10) / 10) !== 1 ? "s" : ""} better per round
              </p>
            )}
            {crossDivision && (
              <p className="text-xs text-slate-400 text-center mt-2">
                Compared by score relative to par
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Season standings */}
      {(standingA || standingB) && (
        <Card className="border-slate-200">
          <CardContent className="pt-5 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 text-center mb-4">
              Season Standings
            </p>
            <CompareRow
              valueA={standingA ? `#${standingA.rank}` : "–"}
              label="Division Rank"
              valueB={standingB ? `#${standingB.rank}` : "–"}
              winner={
                standingA && standingB
                  ? standingA.rank < standingB.rank
                    ? "A"
                    : standingA.rank > standingB.rank
                      ? "B"
                      : undefined
                  : undefined
              }
            />
            <CompareRow
              valueA={standingA ? (standingA.qualified ? "Qualified" : "Not Qualified") : "–"}
              label="Status"
              valueB={standingB ? (standingB.qualified ? "Qualified" : "Not Qualified") : "–"}
              colorA={standingA?.qualified ? "text-emerald-600" : "text-orange-500"}
              colorB={standingB?.qualified ? "text-emerald-600" : "text-orange-500"}
            />
            <CompareRow
              valueA={standingA?.qualified ? String(standingA.qualifyingTotal) : "–"}
              label={`Best ${league.bestScoresCount} Total`}
              valueB={standingB?.qualified ? String(standingB.qualifyingTotal) : "–"}
              winner={
                standingA?.qualified && standingB?.qualified
                  ? standingA.qualifyingTotal < standingB.qualifyingTotal
                    ? "A"
                    : standingA.qualifyingTotal > standingB.qualifyingTotal
                      ? "B"
                      : undefined
                  : undefined
              }
            />
            <CompareRow
              valueA={standingA ? String(standingA.roundsPlayed) : "–"}
              label="Rounds Played"
              valueB={standingB ? String(standingB.roundsPlayed) : "–"}
              winner={
                standingA && standingB
                  ? standingA.roundsPlayed > standingB.roundsPlayed
                    ? "A"
                    : standingA.roundsPlayed < standingB.roundsPlayed
                      ? "B"
                      : undefined
                  : undefined
              }
            />
          </CardContent>
        </Card>
      )}

      {/* Scoring stats */}
      <Card className="border-slate-200">
        <CardContent className="pt-5 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 text-center mb-4">
            Scoring Performance
          </p>
          <CompareRow
            valueA={statsA.avg != null ? formatScore(Math.round(statsA.avg * 10) / 10) : "–"}
            label="Scoring Avg"
            valueB={statsB.avg != null ? formatScore(Math.round(statsB.avg * 10) / 10) : "–"}
            colorA={
              statsA.avg != null
                ? statsA.avg < 0
                  ? "text-emerald-600"
                  : statsA.avg > 0
                    ? "text-orange-500"
                    : undefined
                : undefined
            }
            colorB={
              statsB.avg != null
                ? statsB.avg < 0
                  ? "text-emerald-600"
                  : statsB.avg > 0
                    ? "text-orange-500"
                    : undefined
                : undefined
            }
            winner={
              statsA.avg != null && statsB.avg != null
                ? statsA.avg < statsB.avg
                  ? "A"
                  : statsA.avg > statsB.avg
                    ? "B"
                    : undefined
                : undefined
            }
          />
          <CompareRow
            valueA={statsA.best != null ? formatScore(statsA.best) : "–"}
            label="Best Round"
            valueB={statsB.best != null ? formatScore(statsB.best) : "–"}
            colorA={
              statsA.best != null
                ? statsA.best < 0
                  ? "text-emerald-600"
                  : statsA.best > 0
                    ? "text-orange-500"
                    : undefined
                : undefined
            }
            colorB={
              statsB.best != null
                ? statsB.best < 0
                  ? "text-emerald-600"
                  : statsB.best > 0
                    ? "text-orange-500"
                    : undefined
                : undefined
            }
            winner={
              statsA.best != null && statsB.best != null
                ? statsA.best < statsB.best
                  ? "A"
                  : statsA.best > statsB.best
                    ? "B"
                    : undefined
                : undefined
            }
          />
          <CompareRow
            valueA={String(statsA.wins)}
            label="Wins"
            valueB={String(statsB.wins)}
            colorA={statsA.wins > 0 ? "text-amber-500" : undefined}
            colorB={statsB.wins > 0 ? "text-amber-500" : undefined}
            winner={
              statsA.wins !== statsB.wins
                ? statsA.wins > statsB.wins
                  ? "A"
                  : "B"
                : undefined
            }
          />
          <CompareRow
            valueA={String(statsA.top3)}
            label="Top 3 Finishes"
            valueB={String(statsB.top3)}
            colorA={statsA.top3 > 0 ? "text-amber-500" : undefined}
            colorB={statsB.top3 > 0 ? "text-amber-500" : undefined}
            winner={
              statsA.top3 !== statsB.top3
                ? statsA.top3 > statsB.top3
                  ? "A"
                  : "B"
                : undefined
            }
          />
        </CardContent>
      </Card>

      {/* Round-by-round */}
      {h2hRounds.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-slate-900 mb-3">Round-by-Round</h2>
          <div className="rounded-xl overflow-hidden border border-slate-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-700">
                  <th className="px-4 py-3 font-medium text-left text-slate-200">Round</th>
                  <th className="px-4 py-3 font-medium text-center text-slate-200 max-w-[120px]">
                    <span className="truncate block">{playerA.name}</span>
                  </th>
                  <th className="px-3 py-3 font-medium text-center text-slate-400 w-8"></th>
                  <th className="px-4 py-3 font-medium text-center text-slate-200 max-w-[120px]">
                    <span className="truncate block">{playerB.name}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {h2hRounds.map((r, idx) => {
                  const aWon = r.aRelScore < r.bRelScore;
                  const bWon = r.bRelScore < r.aRelScore;
                  return (
                    <tr
                      key={r.roundId}
                      className={`border-t border-slate-100 hover:bg-slate-50 transition-colors ${idx % 2 === 1 ? "bg-slate-50/50" : ""}`}
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/rounds/${r.roundId}?league=${league.id}`}
                          className="font-medium text-blue-600 hover:underline"
                        >
                          Week {r.weekNumber}
                        </Link>
                        <div className="text-xs text-slate-400 hidden sm:block">
                          {formatDate(r.date)}
                        </div>
                      </td>
                      <td
                        className={`px-4 py-3 text-center font-mono tabular-nums font-semibold ${
                          aWon
                            ? "text-emerald-600"
                            : bWon
                              ? "text-slate-400"
                              : "text-slate-600"
                        }`}
                      >
                        {r.aScore}{" "}
                        <span className="text-xs font-normal">({formatScore(r.aRelScore)})</span>
                      </td>
                      <td className="px-3 py-3 text-center text-xs text-slate-400 font-bold">
                        {aWon ? "←" : bWon ? "→" : "="}
                      </td>
                      <td
                        className={`px-4 py-3 text-center font-mono tabular-nums font-semibold ${
                          bWon
                            ? "text-emerald-600"
                            : aWon
                              ? "text-slate-400"
                              : "text-slate-600"
                        }`}
                      >
                        {r.bScore}{" "}
                        <span className="text-xs font-normal">({formatScore(r.bRelScore)})</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {h2hRounds.length === 0 && (
        <Card className="border-dashed border-slate-200">
          <CardContent className="py-10 text-center text-slate-400 text-sm">
            These players haven&apos;t played in the same qualifying rounds yet.
          </CardContent>
        </Card>
      )}

      <div className="text-center pb-2">
        <Link href={`/compare?league=${league.id}`} className="text-sm text-blue-600 hover:underline">
          ← Compare different players
        </Link>
      </div>
    </div>
  );
}

// ── CompareRow ────────────────────────────────────────────────────────────────

function CompareRow({
  valueA,
  label,
  valueB,
  winner,
  colorA,
  colorB,
}: {
  valueA: string;
  label: string;
  valueB: string;
  winner?: "A" | "B";
  colorA?: string;
  colorB?: string;
}) {
  const textA = colorA ?? (winner === "A" ? "text-slate-900" : winner === "B" ? "text-slate-400" : "text-slate-700");
  const textB = colorB ?? (winner === "B" ? "text-slate-900" : winner === "A" ? "text-slate-400" : "text-slate-700");

  return (
    <div className="flex items-center gap-2 py-1 border-b border-slate-100 last:border-0">
      <div className={`flex-1 flex items-center justify-end gap-1.5 text-base font-bold tabular-nums text-right ${textA}`}>
        {valueA}
        {winner === "A" && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />}
      </div>
      <div className="w-28 sm:w-36 shrink-0 text-center text-xs font-semibold uppercase tracking-wide text-slate-400 px-1">
        {label}
      </div>
      <div className={`flex-1 flex items-center gap-1.5 text-base font-bold tabular-nums ${textB}`}>
        {winner === "B" && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />}
        {valueB}
      </div>
    </div>
  );
}
