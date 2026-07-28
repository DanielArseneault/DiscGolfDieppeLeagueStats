import { prisma } from "@/lib/db";
import { getStandings } from "@/lib/standings";
import { computePoolSummaries, PoolPlacement } from "@/lib/pool-utils";
import { PlayerName, type PlayerLookup } from "@/components/player-name";
import { formatDate } from "@/lib/utils";
import { toPar } from "@/lib/design-helpers";
import Link from "next/link";
import { Division } from "@/generated/prisma/client";

export const revalidate = 60;

type Round = Awaited<ReturnType<typeof getRounds>>[number];

async function getRounds(leagueId: number) {
  return prisma.round.findMany({
    where: { leagueId },
    orderBy: { weekNumber: "desc" },
    include: {
      roundWinners: { orderBy: [{ division: "asc" }, { place: "asc" }] },
      ctpWinners: { orderBy: { hole: "asc" } },
      aceWinners: { orderBy: { hole: "asc" } },
      poolWinners: { orderBy: [{ pool: "asc" }, { place: "asc" }] },
      bobTag: true,
      results: {
        include: { player: true },
        orderBy: [{ division: "asc" }, { position: "asc" }],
      },
    },
  });
}

const COLS = "132px minmax(0,1.25fr) minmax(0,1.25fr) minmax(0,1.1fr) 116px";

export default async function RoundsPage({ searchParams }: { searchParams: Promise<{ league?: string }> }) {
  const { league: leagueParam } = await searchParams;

  const leagues = await prisma.league.findMany({ orderBy: { year: "desc" } });
  if (leagues.length === 0) return <p style={{ color: "var(--ink-muted)" }}>No leagues found.</p>;

  const selectedLeague = leagues.find((l) => l.id === Number(leagueParam)) ?? leagues[0];
  const rounds = await getRounds(selectedLeague.id);

  const hasChampionship = rounds.some((r) => r.isChampionship);
  const standings = hasChampionship ? await getStandings(selectedLeague.id) : [];

  const playerLookup: PlayerLookup = new Map();
  for (const round of rounds) {
    for (const result of round.results) {
      playerLookup.set(result.player.name.toLowerCase().trim(), result.player.id);
    }
  }

  const playedCount = rounds.filter((r) => !r.isChampionship).length;
  const latestId = rounds[0]?.id;

  return (
    <div className="space-y-8">
      <div
        className="-mx-8 -mt-14 px-8 pt-24 pb-10"
        style={{ background: "linear-gradient(to bottom, var(--hero-a), var(--bg-app))" }}
      >
        <div className="mx-auto max-w-[var(--container)]">
          <Link
            href={`/?league=${selectedLeague.id}`}
            className="font-[family-name:var(--font-mono)] text-xs uppercase tracking-[.14em]"
            style={{ color: "var(--ink-muted)" }}
          >
            ← Standings
          </Link>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1
                className="text-[36px] font-extrabold sm:text-[48px]"
                style={{ color: "var(--ink)", letterSpacing: "-0.035em", lineHeight: 1 }}
              >
                Rounds
              </h1>
              <p className="mt-2 font-[family-name:var(--font-mono)] text-sm" style={{ color: "var(--ink-muted)" }}>
                {playedCount} of {selectedLeague.qualifyingWeeks} rounds played · {formatDate(selectedLeague.startDate)} –{" "}
                {formatDate(selectedLeague.endDate)} · {selectedLeague.location}
              </p>
            </div>
            {leagues.length > 1 && (
              <div className="flex gap-1.5">
                {leagues.map((l) => (
                  <a
                    key={l.id}
                    href={`/rounds?league=${l.id}`}
                    className="nav-link rounded-[var(--r-pill)] px-2.5 py-1 font-[family-name:var(--font-mono)] text-xs"
                    style={
                      l.id === selectedLeague.id
                        ? { background: "var(--accent)", color: "var(--accent-ink)" }
                        : { background: "var(--chip-neutral)", color: "var(--ink-muted)" }
                    }
                  >
                    {l.year}
                  </a>
                ))}
              </div>
            )}
          </div>
          <div className="mt-4 flex flex-wrap gap-4 text-xs" style={{ color: "var(--ink-muted)" }}>
            <span className="flex items-center gap-1.5">
              <span className="h-[11px] w-[11px] rounded-full" style={{ border: "2px solid var(--positive)" }} />
              Closest to pin
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-[11px] w-[11px] rounded-[3px]" style={{ border: "2px solid var(--gold)" }} />
              BoB tag
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-[7px] w-[7px] rounded-full" style={{ background: "var(--gold)" }} />
              Ace
            </span>
          </div>
        </div>
      </div>

      {rounds.length === 0 ? (
        <p style={{ color: "var(--ink-muted)" }}>No rounds recorded yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-[var(--r-card)] border" style={{ borderColor: "var(--line)" }}>
          <div className="min-w-[860px]">
            <div
              className="grid px-6 py-3 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[.13em]"
              style={{ gridTemplateColumns: COLS, background: "var(--bg-subtle)", color: "var(--ink-muted)" }}
            >
              <div>Round</div>
              <div>Blue winner</div>
              <div>Red winner</div>
              <div>Awards</div>
              <div />
            </div>
            {rounds.map((round) =>
              round.isChampionship ? (
                <ChampionshipRow
                  key={round.id}
                  round={round}
                  standings={standings}
                  leagueId={selectedLeague.id}
                  playerLookup={playerLookup}
                  latest={round.id === latestId}
                />
              ) : (
                <RegularRow
                  key={round.id}
                  round={round}
                  leagueId={selectedLeague.id}
                  playerLookup={playerLookup}
                  latest={round.id === latestId}
                />
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function RoundCell({ href, title, meta }: { href: string; title: string; meta: string }) {
  return (
    <div className="min-w-0">
      <Link href={href} className="block truncate text-[16px] font-semibold" style={{ color: "var(--ink)" }}>
        {title}
      </Link>
      <p className="mt-0.5 truncate font-[family-name:var(--font-mono)] text-[11px]" style={{ color: "var(--ink-muted)" }}>
        {meta}
      </p>
    </div>
  );
}

function WinnerCell({
  name,
  playerId,
  leagueId,
  relativeScore,
  prize,
  extra,
}: {
  name?: string;
  playerId?: number;
  leagueId: number;
  relativeScore?: number;
  prize?: string | null;
  extra?: React.ReactNode;
}) {
  if (!name) return <span style={{ color: "var(--ink-muted)" }}>—</span>;
  return (
    <div className="min-w-0">
      <div className="flex items-baseline gap-2">
        {playerId ? (
          <Link href={`/players/${playerId}?league=${leagueId}`} className="min-w-0 truncate text-sm font-semibold" style={{ color: "var(--ink)" }}>
            {name}
          </Link>
        ) : (
          <span className="min-w-0 truncate text-sm font-semibold" style={{ color: "var(--ink)" }}>
            {name}
          </span>
        )}
        {relativeScore !== undefined && (
          <span className="shrink-0 font-[family-name:var(--font-mono)] text-xs" style={{ color: "var(--positive)" }}>
            {toPar(relativeScore)}
          </span>
        )}
      </div>
      {prize && (
        <p className="mt-0.5 font-[family-name:var(--font-mono)] text-[11px]" style={{ color: "var(--gold)" }}>
          {prize}
        </p>
      )}
      {extra}
    </div>
  );
}

function AwardsCell({
  ctpWinners,
  aceWinners,
  bobTag,
  playerLookup,
  leagueId,
}: {
  ctpWinners: { id: number; hole: number; playerName: string; prize: string | null }[];
  aceWinners: { id: number; hole: number; playerName: string }[];
  bobTag: { playerName: string } | null;
  playerLookup: PlayerLookup;
  leagueId: number;
}) {
  if (ctpWinners.length === 0 && aceWinners.length === 0 && !bobTag) {
    return <span style={{ color: "var(--ink-muted)" }}>—</span>;
  }
  return (
    <div className="space-y-1 text-xs">
      {ctpWinners.map((c) => (
        <div key={c.id} className="flex items-center gap-1.5">
          <span className="h-[11px] w-[11px] shrink-0 rounded-full" style={{ border: "2px solid var(--positive)" }} />
          <span style={{ color: "var(--ink-2)" }}>H{c.hole}</span>
          <PlayerName name={c.playerName} lookup={playerLookup} leagueId={leagueId} className="min-w-0 truncate font-medium" />
        </div>
      ))}
      {aceWinners.map((a) => (
        <div key={a.id} className="flex items-center gap-1.5">
          <span className="h-[7px] w-[7px] shrink-0 rounded-full" style={{ background: "var(--gold)" }} />
          <span style={{ color: "var(--ink-2)" }}>H{a.hole}</span>
          <PlayerName name={a.playerName} lookup={playerLookup} leagueId={leagueId} className="min-w-0 truncate font-medium" />
        </div>
      ))}
      {bobTag ? (
        <div className="flex items-center gap-1.5">
          <span className="h-[11px] w-[11px] shrink-0 rounded-[3px]" style={{ border: "2px solid var(--gold)" }} />
          <PlayerName name={bobTag.playerName} lookup={playerLookup} leagueId={leagueId} className="min-w-0 truncate font-medium" />
        </div>
      ) : (
        <p style={{ color: "var(--ink-muted)" }}>Not awarded this week</p>
      )}
    </div>
  );
}

function ActionsCell({ round, leagueId }: { round: Round; leagueId: number }) {
  return (
    <div className="flex flex-col items-end gap-1.5">
      {round.facebookUrl && (
        <a
          href={round.facebookUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="nav-link text-xs font-medium"
          style={{ color: "var(--ink-muted)" }}
        >
          {round.facebookLabel ?? "Recap"} ↗
        </a>
      )}
      <Link
        href={`/rounds/${round.id}?league=${leagueId}`}
        className="rounded-[var(--r-pill)] px-3 py-1 text-xs font-medium"
        style={{ background: "var(--accent-soft)", color: "var(--positive)" }}
      >
        Card →
      </Link>
    </div>
  );
}

function RowShell({ latest, children }: { latest: boolean; children: React.ReactNode }) {
  return (
    <div
      className="grid items-center gap-3 px-6 py-4"
      style={{ gridTemplateColumns: COLS, background: latest ? "var(--row-tint)" : "transparent", borderTop: "1px solid var(--line-3)" }}
    >
      {children}
    </div>
  );
}

function RegularRow({ round, leagueId, playerLookup, latest }: { round: Round; leagueId: number; playerLookup: PlayerLookup; latest: boolean }) {
  const blueResults = round.results.filter((r) => r.division === Division.BLUE);
  const redResults = round.results.filter((r) => r.division === Division.RED);
  const blueOverride1 = round.roundWinners.find((w) => w.division === Division.BLUE && w.place === 1);
  const redOverride1 = round.roundWinners.find((w) => w.division === Division.RED && w.place === 1);
  const blueLeader = blueResults.find((r) => r.position === 1);
  const redLeader = redResults.find((r) => r.position === 1);
  const blueLeaderName = blueOverride1?.playerName ?? blueLeader?.player.name;
  const redLeaderName = redOverride1?.playerName ?? redLeader?.player.name;

  return (
    <RowShell latest={latest}>
      <RoundCell
        href={`/rounds/${round.id}?league=${leagueId}`}
        title={`Week ${round.weekNumber}`}
        meta={`${formatDate(round.date)} · ${round.results.length} players`}
      />
      <WinnerCell
        name={blueLeaderName}
        playerId={blueOverride1 ? playerLookup.get(blueOverride1.playerName.toLowerCase().trim()) : blueLeader?.player.id}
        leagueId={leagueId}
        relativeScore={blueLeader?.relativeScore}
        prize={blueOverride1?.prize}
      />
      <WinnerCell
        name={redLeaderName}
        playerId={redOverride1 ? playerLookup.get(redOverride1.playerName.toLowerCase().trim()) : redLeader?.player.id}
        leagueId={leagueId}
        relativeScore={redLeader?.relativeScore}
        prize={redOverride1?.prize}
      />
      <AwardsCell
        ctpWinners={round.ctpWinners}
        aceWinners={round.aceWinners}
        bobTag={round.bobTag}
        playerLookup={playerLookup}
        leagueId={leagueId}
      />
      <ActionsCell round={round} leagueId={leagueId} />
    </RowShell>
  );
}

function ChampionshipRow({
  round,
  standings,
  leagueId,
  playerLookup,
  latest,
}: {
  round: Round;
  standings: Parameters<typeof computePoolSummaries>[1];
  leagueId: number;
  playerLookup: PlayerLookup;
  latest: boolean;
}) {
  const poolSummaries = computePoolSummaries(round.results, standings, round.poolWinners);
  const byPool = new Map(poolSummaries.map((s) => [s.pool, s.first]));
  const blueA = byPool.get("A");
  const blueB = byPool.get("B");
  const redC = byPool.get("C");
  const redD = byPool.get("D");

  const poolExtra = (label: string, p: PoolPlacement | null | undefined) =>
    p ? (
      <p className="mt-0.5 truncate text-xs" style={{ color: "var(--ink-muted)" }}>
        {label}:{" "}
        <PlayerName name={p.playerName} lookup={playerLookup} leagueId={leagueId} className="font-medium" style={{ color: "var(--ink-2)" }} />
      </p>
    ) : null;

  return (
    <RowShell latest={latest}>
      <RoundCell
        href={`/rounds/${round.id}?league=${leagueId}`}
        title="Championship"
        meta={`${formatDate(round.date)} · ${round.results.length} players`}
      />
      <WinnerCell
        name={blueA?.playerName}
        playerId={blueA ? playerLookup.get(blueA.playerName.toLowerCase().trim()) : undefined}
        leagueId={leagueId}
        relativeScore={blueA?.relativeScore}
        prize={blueA?.prize}
        extra={poolExtra("Pool B", blueB)}
      />
      <WinnerCell
        name={redC?.playerName}
        playerId={redC ? playerLookup.get(redC.playerName.toLowerCase().trim()) : undefined}
        leagueId={leagueId}
        relativeScore={redC?.relativeScore}
        prize={redC?.prize}
        extra={poolExtra("Pool D", redD)}
      />
      <AwardsCell
        ctpWinners={round.ctpWinners}
        aceWinners={round.aceWinners}
        bobTag={round.bobTag}
        playerLookup={playerLookup}
        leagueId={leagueId}
      />
      <ActionsCell round={round} leagueId={leagueId} />
    </RowShell>
  );
}
