import { prisma } from "@/lib/db";
import { getStandings } from "@/lib/standings";
import { computePoolSummaries, PoolSummary } from "@/lib/pool-utils";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatScore } from "@/lib/utils";
import Link from "next/link";
import { Division } from "@/generated/prisma/client";

export const revalidate = 60;

type Round = Awaited<ReturnType<typeof getRounds>>[number];
type PlayerLookup = Map<string, number>;

async function getRounds(leagueId: number) {
  return prisma.round.findMany({
    where: { leagueId },
    orderBy: { weekNumber: "desc" },
    include: {
      roundWinners: { orderBy: [{ division: "asc" }, { place: "asc" }] },
      ctpWinners: { orderBy: { hole: "asc" } },
      aceWinners: { orderBy: { hole: "asc" } },
      poolWinners: { orderBy: [{ pool: "asc" }, { place: "asc" }] },
      results: {
        include: { player: true },
        orderBy: [{ division: "asc" }, { position: "asc" }],
      },
    },
  });
}

// Renders a player name as a link if found in the lookup, plain text otherwise.
function PlayerName({ name, lookup, className }: { name: string; lookup: PlayerLookup; className?: string }) {
  const id = lookup.get(name.toLowerCase().trim());
  if (!id) return <span className={className}>{name}</span>;
  return (
    <Link href={`/players/${id}`} className={`hover:underline ${className ?? ""}`}>
      {name}
    </Link>
  );
}

export default async function RoundsPage({ searchParams }: { searchParams: Promise<{ league?: string }> }) {
  const { league: leagueParam } = await searchParams;

  const leagues = await prisma.league.findMany({ orderBy: { year: "desc" } });
  if (leagues.length === 0) return <p className="text-slate-500">No leagues found.</p>;

  const selectedLeague = leagues.find((l) => l.id === Number(leagueParam)) ?? leagues[0];
  const rounds = await getRounds(selectedLeague.id);

  // Only fetch standings if there's a championship round — needed for pool assignment
  const hasChampionship = rounds.some((r) => r.isChampionship);
  const standings = hasChampionship ? await getStandings(selectedLeague.id) : [];

  // Build name→id lookup from all results across all rounds
  const playerLookup: PlayerLookup = new Map();
  for (const round of rounds) {
    for (const result of round.results) {
      playerLookup.set(result.player.name.toLowerCase().trim(), result.player.id);
    }
  }

  return (
    <div className="space-y-6">
      {/* Hero banner */}
      <div className="-mx-4 -mt-14 relative overflow-hidden mb-2">
        <div
          className="px-8 pt-24 pb-32 text-white relative bg-cover"
          style={{ backgroundImage: "url('/hero-rounds.jpg')", backgroundPosition: "50% 40%" }}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-black/65 via-black/40 to-black/30 pointer-events-none" />
          <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/40 to-transparent pointer-events-none" />
          <div className="relative">
            <p className="text-white/60 text-xs font-semibold uppercase tracking-widest mb-1">Rounds</p>
            <h1 className="text-4xl font-black tracking-tight drop-shadow-sm">{selectedLeague.name}</h1>
            <p className="text-white/80 mt-2 text-sm">
              {formatDate(selectedLeague.startDate)} – {formatDate(selectedLeague.endDate)} · {selectedLeague.location}
            </p>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1200 56" preserveAspectRatio="none" className="w-full h-14 fill-[#f8fafc]">
            <path d="M0,56 L0,28 C150,56 300,8 500,22 C700,36 900,4 1200,22 L1200,56 Z" />
          </svg>
        </div>
      </div>

      {rounds.length === 0 ? (
        <p className="text-slate-500">No rounds recorded yet.</p>
      ) : (
        <div className="space-y-4">
          {rounds.map((round) =>
            round.isChampionship
              ? <ChampionshipCard key={round.id} round={round} standings={standings} leagueId={selectedLeague.id} playerLookup={playerLookup} />
              : <RegularRoundCard key={round.id} round={round} leagueId={selectedLeague.id} playerLookup={playerLookup} />
          )}
        </div>
      )}
    </div>
  );
}

// ── Regular round card ────────────────────────────────────────────────────────

function RegularRoundCard({ round, leagueId, playerLookup }: { round: Round; leagueId: number; playerLookup: PlayerLookup }) {
  const blueResults = round.results.filter((r) => r.division === Division.BLUE);
  const redResults = round.results.filter((r) => r.division === Division.RED);

  // Use winner overrides if set, otherwise fall back to computed position
  const blueOverride1 = round.roundWinners.find((w) => w.division === Division.BLUE && w.place === 1);
  const redOverride1 = round.roundWinners.find((w) => w.division === Division.RED && w.place === 1);

  const blueLeaderName = blueOverride1?.playerName ?? blueResults.find((r) => r.position === 1)?.player.name;
  const redLeaderName = redOverride1?.playerName ?? redResults.find((r) => r.position === 1)?.player.name;
  const blueLeaderScore = blueResults.find((r) => r.position === 1)?.relativeScore;
  const redLeaderScore = redResults.find((r) => r.position === 1)?.relativeScore;

  return (
    <div className="rounded-xl overflow-hidden border border-slate-200 hover:shadow-md transition-all">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-700 to-slate-600 px-5 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div className="flex items-baseline gap-3 min-w-0">
          <h3 className="text-white font-bold text-lg shrink-0">Week {round.weekNumber}</h3>
          <span className="text-slate-300 text-sm truncate">{formatDate(round.date)}</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {round.facebookUrl && (
            <a
              href={round.facebookUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-white bg-white/15 hover:bg-white/25 border border-white/20 px-3 py-0.5 rounded-full transition-colors"
            >
              {round.facebookLabel ?? "Recap"} ↗
            </a>
          )}
          <Link
            href={`/rounds/${round.id}?league=${leagueId}`}
            className="text-sm font-medium text-white bg-white/15 hover:bg-white/25 border border-white/20 px-3 py-0.5 rounded-full transition-colors"
          >
            Scorecard →
          </Link>
          {blueResults.length > 0 && (
            <span className="text-sm text-white bg-white/15 px-2.5 py-0.5 rounded-full">🔵 {blueResults.length}</span>
          )}
          {redResults.length > 0 && (
            <span className="text-sm text-white bg-white/15 px-2.5 py-0.5 rounded-full">🔴 {redResults.length}</span>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="bg-slate-50 px-5 py-4 space-y-3">
        {(blueLeaderName || redLeaderName) && (
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Leaders</p>
            <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2">
              {blueLeaderName && (
                <div className="flex items-center gap-2">
                  <span className="text-blue-500 shrink-0">🔵</span>
                  <PlayerName name={blueLeaderName} lookup={playerLookup} className="font-semibold text-slate-800 text-sm truncate" />
                  {blueLeaderScore !== undefined && (
                    <span className={`font-mono text-sm font-bold shrink-0 ${
                      blueLeaderScore < 0 ? "text-emerald-600" : blueLeaderScore > 0 ? "text-orange-500" : "text-slate-500"
                    }`}>
                      {formatScore(blueLeaderScore)}
                    </span>
                  )}
                </div>
              )}
              {redLeaderName && (
                <div className="flex items-center gap-2">
                  <span className="text-red-500 shrink-0">🔴</span>
                  <PlayerName name={redLeaderName} lookup={playerLookup} className="font-semibold text-slate-800 text-sm truncate" />
                  {redLeaderScore !== undefined && (
                    <span className={`font-mono text-sm font-bold shrink-0 ${
                      redLeaderScore < 0 ? "text-emerald-600" : redLeaderScore > 0 ? "text-orange-500" : "text-slate-500"
                    }`}>
                      {formatScore(redLeaderScore)}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {round.ctpWinners.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Closest to Pin</p>
            <div className="flex flex-wrap gap-2">
              {round.ctpWinners.map((c) => (
                <Badge key={c.id} className="bg-orange-100 text-orange-800 border border-orange-200 hover:bg-orange-100">
                  🎯 Hole {c.hole}: <PlayerName name={c.playerName} lookup={playerLookup} className="font-semibold hover:underline" />
                </Badge>
              ))}
            </div>
          </div>
        )}

        {round.aceWinners.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Ace Winners</p>
            <div className="flex flex-wrap gap-2">
              {round.aceWinners.map((a) => (
                <Badge key={a.id} className="bg-purple-100 text-purple-800 border border-purple-200 hover:bg-purple-100">
                  🦅 Hole {a.hole}: <PlayerName name={a.playerName} lookup={playerLookup} className="font-semibold hover:underline" />{a.prizeAmount != null ? ` · $${a.prizeAmount.toFixed(2)}` : ""}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Championship card ─────────────────────────────────────────────────────────

function ChampionshipCard({ round, standings, leagueId, playerLookup }: { round: Round; standings: Parameters<typeof computePoolSummaries>[1]; leagueId: number; playerLookup: PlayerLookup }) {
  const poolSummaries = computePoolSummaries(round.results, standings, round.poolWinners);
  const bluePools = poolSummaries.filter((s) => ["A", "B"].includes(s.pool));
  const redPools = poolSummaries.filter((s) => ["C", "D"].includes(s.pool));

  return (
    <div className="rounded-xl overflow-hidden border border-amber-300 hover:shadow-md transition-all">
      {/* Header */}
      <div className="bg-gradient-to-r from-amber-700 to-amber-600 px-5 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div className="flex items-baseline gap-3 min-w-0">
          <h3 className="text-white font-bold text-lg shrink-0">🏆 Championship</h3>
          <span className="text-amber-100 text-sm truncate">{formatDate(round.date)}</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {round.facebookUrl && (
            <a
              href={round.facebookUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-white bg-white/15 hover:bg-white/25 border border-white/20 px-3 py-0.5 rounded-full transition-colors"
            >
              {round.facebookLabel ?? "Recap"} ↗
            </a>
          )}
          <Link
            href={`/rounds/${round.id}?league=${leagueId}`}
            className="text-sm font-medium text-white bg-white/15 hover:bg-white/25 border border-white/20 px-3 py-0.5 rounded-full transition-colors"
          >
            Scorecard →
          </Link>
          {round.results.filter((r) => r.division === Division.BLUE).length > 0 && (
            <span className="text-sm text-white bg-white/15 px-2.5 py-0.5 rounded-full">🔵 {round.results.filter((r) => r.division === Division.BLUE).length}</span>
          )}
          {round.results.filter((r) => r.division === Division.RED).length > 0 && (
            <span className="text-sm text-white bg-white/15 px-2.5 py-0.5 rounded-full">🔴 {round.results.filter((r) => r.division === Division.RED).length}</span>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="bg-amber-50 px-5 py-4 space-y-3">
        {(bluePools.length > 0 || redPools.length > 0) && (
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide">Pool Winners</p>
            <div className="grid sm:grid-cols-2 gap-x-6 gap-y-3">
              {bluePools.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-2">🔵 Blue</p>
                  <div className="space-y-1.5">
                    {bluePools.map((s) => s.first && (
                      <div key={s.pool} className="flex items-center gap-2">
                        <span className="text-base shrink-0">🥇</span>
                        <span className="text-xs font-semibold text-amber-700 w-14 shrink-0">Pool {s.pool}</span>
                        <PlayerName name={s.first.playerName} lookup={playerLookup} className="font-medium text-slate-800 text-sm truncate hover:underline" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {redPools.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-red-500 uppercase tracking-wide mb-2">🔴 Red</p>
                  <div className="space-y-1.5">
                    {redPools.map((s) => s.first && (
                      <div key={s.pool} className="flex items-center gap-2">
                        <span className="text-base shrink-0">🥇</span>
                        <span className="text-xs font-semibold text-amber-700 w-14 shrink-0">Pool {s.pool}</span>
                        <PlayerName name={s.first.playerName} lookup={playerLookup} className="font-medium text-slate-800 text-sm truncate hover:underline" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {round.ctpWinners.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide">Closest to Pin</p>
            <div className="flex flex-wrap gap-2">
              {round.ctpWinners.map((c) => (
                <Badge key={c.id} className="bg-orange-100 text-orange-800 border border-orange-200 hover:bg-orange-100">
                  🎯 Hole {c.hole}: <PlayerName name={c.playerName} lookup={playerLookup} className="font-semibold hover:underline" />
                </Badge>
              ))}
            </div>
          </div>
        )}

        {round.aceWinners.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide">Ace Winners</p>
            <div className="flex flex-wrap gap-2">
              {round.aceWinners.map((a) => (
                <Badge key={a.id} className="bg-purple-100 text-purple-800 border border-purple-200 hover:bg-purple-100">
                  🦅 Hole {a.hole}: <PlayerName name={a.playerName} lookup={playerLookup} className="font-semibold hover:underline" />{a.prizeAmount != null ? ` · $${a.prizeAmount.toFixed(2)}` : ""}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
