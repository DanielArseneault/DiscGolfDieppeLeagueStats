import { prisma } from "@/lib/db";
import { getStandings } from "@/lib/standings";
import { notFound } from "next/navigation";
import { Division } from "@/generated/prisma/client";
import { formatDate } from "@/lib/utils";
import { toPar, toParAvg, signInk, tally } from "@/lib/design-helpers";
import { Card, CardContent } from "@/components/site-card";
import Link from "next/link";

export const revalidate = 60;

async function getPlayerData(playerId: number) {
  return prisma.player.findUnique({
    where: { id: playerId },
    include: {
      league: true,
      results: {
        include: { round: { select: { id: true, weekNumber: true, date: true, isChampionship: true } } },
        orderBy: { round: { weekNumber: "asc" } },
      },
    },
  });
}

type PlayerData = NonNullable<Awaited<ReturnType<typeof getPlayerData>>>;

function computeStats(results: PlayerData["results"]) {
  const qualifying = results.filter((r) => !r.round.isChampionship);
  const avg = qualifying.length > 0 ? qualifying.reduce((s, r) => s + r.relativeScore, 0) / qualifying.length : null;
  const best = qualifying.length > 0 ? Math.min(...qualifying.map((r) => r.relativeScore)) : null;
  const wins = qualifying.filter((r) => r.position === 1).length;
  const top3 = qualifying.filter((r) => r.position <= 3).length;
  return { qualifying, avg, best, wins, top3 };
}

// ── Picker (no players selected yet) ─────────────────────────────────────────

async function PickerPage({ leagueId, preA }: { leagueId: number | null; preA?: number }) {
  const league = leagueId ? await prisma.league.findUnique({ where: { id: leagueId } }) : await prisma.league.findFirst({ orderBy: { year: "desc" } });
  if (!league) notFound();

  const players = await prisma.player.findMany({ where: { leagueId: league.id }, orderBy: [{ division: "asc" }, { name: "asc" }] });
  const bluePlayers = players.filter((p) => p.division === Division.BLUE);
  const redPlayers = players.filter((p) => p.division === Division.RED);

  return (
    <div className="space-y-6 pt-4">
      <div>
        <h1 className="text-[32px] font-extrabold" style={{ color: "var(--ink)", letterSpacing: "-0.03em" }}>
          Head-to-head comparison
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--ink-muted)" }}>
          {league.name} · {league.year}
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form method="GET" action="/compare" className="space-y-5">
            <input type="hidden" name="league" value={league.id} />
            <div className="grid items-end gap-4 sm:grid-cols-[1fr_auto_1fr]">
              <PlayerSelect name="a" label="Player A" bluePlayers={bluePlayers} redPlayers={redPlayers} defaultValue={preA} />
              <div className="pb-2 text-center font-[family-name:var(--font-mono)] text-lg" style={{ color: "var(--ink-muted)" }}>
                VS
              </div>
              <PlayerSelect name="b" label="Player B" bluePlayers={bluePlayers} redPlayers={redPlayers} />
            </div>
            <button
              type="submit"
              className="w-full rounded-[var(--r-control)] px-6 py-2.5 text-sm font-semibold transition-colors sm:w-auto"
              style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
            >
              Compare →
            </button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function PlayerSelect({
  name,
  label,
  bluePlayers,
  redPlayers,
  defaultValue,
}: {
  name: string;
  label: string;
  bluePlayers: { id: number; name: string }[];
  redPlayers: { id: number; name: string }[];
  defaultValue?: number;
}) {
  return (
    <div className="space-y-1.5">
      <label className="font-[family-name:var(--font-mono)] text-xs uppercase tracking-[.13em]" style={{ color: "var(--ink-muted)" }}>
        {label}
      </label>
      <select
        name={name}
        defaultValue={defaultValue ?? ""}
        required
        className="w-full rounded-[var(--r-control)] border px-3 py-2 text-sm"
        style={{ borderColor: "var(--line)", background: "var(--bg-card)", color: "var(--ink)" }}
      >
        <option value="">Select a player…</option>
        <optgroup label="Blue division">
          {bluePlayers.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </optgroup>
        <optgroup label="Red division">
          {redPlayers.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </optgroup>
      </select>
    </div>
  );
}

// ── Main comparison ───────────────────────────────────────────────────────────

export default async function ComparePage({ searchParams }: { searchParams: Promise<{ a?: string; b?: string; league?: string }> }) {
  const { a, b, league: leagueParam } = await searchParams;
  const leagueId = leagueParam ? Number(leagueParam) : null;

  if (!a || !b) {
    return <PickerPage leagueId={leagueId} preA={a ? Number(a) : undefined} />;
  }

  const [playerA, playerB] = await Promise.all([getPlayerData(Number(a)), getPlayerData(Number(b))]);
  if (!playerA || !playerB) notFound();

  const league = playerA.league;
  const standings = await getStandings(league.id);
  const standingA = standings.find((s) => s.playerId === playerA.id);
  const standingB = standings.find((s) => s.playerId === playerB.id);
  const statsA = computeStats(playerA.results);
  const statsB = computeStats(playerB.results);

  const aByRound = new Map(playerA.results.filter((r) => !r.round.isChampionship).map((r) => [r.round.id, r]));
  const bByRound = new Map(playerB.results.filter((r) => !r.round.isChampionship).map((r) => [r.round.id, r]));
  const allRoundIds = new Set([...aByRound.keys(), ...bByRound.keys()]);

  const combined = [...allRoundIds]
    .map((id) => {
      const ar = aByRound.get(id);
      const br = bByRound.get(id);
      const meta = (ar ?? br)!.round;
      return {
        roundId: id,
        weekNumber: meta.weekNumber,
        date: meta.date,
        aScore: ar?.score ?? null,
        bScore: br?.score ?? null,
        aRel: ar?.relativeScore ?? null,
        bRel: br?.relativeScore ?? null,
      };
    })
    .sort((x, y) => x.weekNumber - y.weekNumber);

  const shared = combined.filter((r) => r.aRel != null && r.bRel != null) as {
    roundId: number; weekNumber: number; date: Date; aScore: number; bScore: number; aRel: number; bRel: number;
  }[];

  const t = tally(shared.map((r) => ({ a: r.aRel, b: r.bRel })));
  const ties = shared.length - t.aWins - t.bWins;
  const avgDiff = shared.length > 0 ? shared.reduce((s, r) => s + (r.aRel - r.bRel), 0) / shared.length : null;

  const leagueUrl = `/?league=${league.id}`;
  const crossDivision = playerA.division !== playerB.division;

  return (
    <div className="space-y-8">
      <MatchupHeader playerA={playerA} playerB={playerB} statsA={statsA} statsB={statsB} league={league} leagueUrl={leagueUrl} crossDivision={crossDivision} />

      {shared.length > 0 && (
        <Card>
          <CardContent className="pt-6" style={{ background: "var(--bg-inset)" }}>
            <p className="mb-4 text-center font-[family-name:var(--font-mono)] text-xs uppercase tracking-[.13em]" style={{ color: "var(--ink-muted)" }}>
              Head-to-head · {shared.length} round{shared.length !== 1 ? "s" : ""} played together
            </p>
            <div className="flex items-center gap-3">
              <div className="text-center">
                <div className="font-[family-name:var(--font-mono)] text-[56px] font-extrabold leading-none" style={{ color: "var(--a-ink)" }}>
                  {t.aWins}
                </div>
                <p className="mt-1 max-w-[9rem] truncate text-xs" style={{ color: "var(--ink-muted)" }}>
                  {playerA.name}
                </p>
              </div>
              <div className="flex-1">
                <div className="flex h-2 overflow-hidden rounded-[var(--r-chip)]" style={{ background: "var(--track)" }}>
                  <div style={{ width: t.aBar, background: "var(--a-bar)" }} />
                  <div style={{ width: t.bBar, background: "var(--b-bar)" }} />
                </div>
                {ties > 0 && (
                  <p className="mt-1.5 text-center text-xs" style={{ color: "var(--ink-muted)" }}>
                    {ties} tied
                  </p>
                )}
              </div>
              <div className="text-center">
                <div className="font-[family-name:var(--font-mono)] text-[56px] font-extrabold leading-none" style={{ color: "var(--b-ink)" }}>
                  {t.bWins}
                </div>
                <p className="mt-1 max-w-[9rem] truncate text-xs" style={{ color: "var(--ink-muted)" }}>
                  {playerB.name}
                </p>
              </div>
            </div>
            {avgDiff !== null && Math.abs(avgDiff) >= 0.05 && (
              <p className="mt-4 text-center text-sm" style={{ color: "var(--ink-3)" }}>
                {avgDiff < 0 ? playerA.name : playerB.name} averages{" "}
                <span className="font-semibold" style={{ color: "var(--ink)" }}>{t.strokeDelta}</span> stroke
                {t.strokeDelta !== "1.0" ? "s" : ""} better per round
              </p>
            )}
            {crossDivision && (
              <p className="mt-1 text-center text-xs" style={{ color: "var(--ink-muted)" }}>
                Compared by score relative to par
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {(standingA || standingB) && (
        <Card>
          <CardContent className="space-y-1 pt-6">
            <GroupHeading>Season standings</GroupHeading>
            <CompareRow
              valueA={standingA ? `#${standingA.rank}` : "–"}
              label="Division rank"
              valueB={standingB ? `#${standingB.rank}` : "–"}
              better={standingA && standingB ? (standingA.rank < standingB.rank ? "A" : standingA.rank > standingB.rank ? "B" : undefined) : undefined}
            />
            <CompareRow
              valueA={standingA ? (standingA.qualified ? "Qualified" : "Not qualified") : "–"}
              label="Status"
              valueB={standingB ? (standingB.qualified ? "Qualified" : "Not qualified") : "–"}
              small
            />
            <CompareRow
              valueA={standingA?.qualified ? String(standingA.qualifyingTotal) : "–"}
              label={`Best ${league.bestScoresCount} total`}
              valueB={standingB?.qualified ? String(standingB.qualifyingTotal) : "–"}
              better={
                standingA?.qualified && standingB?.qualified
                  ? standingA.qualifyingTotal < standingB.qualifyingTotal ? "A" : standingA.qualifyingTotal > standingB.qualifyingTotal ? "B" : undefined
                  : undefined
              }
            />
            <CompareRow
              valueA={standingA ? String(standingA.roundsPlayed) : "–"}
              label="Rounds played"
              valueB={standingB ? String(standingB.roundsPlayed) : "–"}
              small
            />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="space-y-1 pt-6">
          <GroupHeading>Scoring performance</GroupHeading>
          <CompareRow
            valueA={statsA.avg != null ? toParAvg(Math.round(statsA.avg * 100) / 100) : "–"}
            label="Scoring average"
            valueB={statsB.avg != null ? toParAvg(Math.round(statsB.avg * 100) / 100) : "–"}
            inkA={statsA.avg != null ? signInk(statsA.avg) : undefined}
            inkB={statsB.avg != null ? signInk(statsB.avg) : undefined}
            better={statsA.avg != null && statsB.avg != null ? (statsA.avg < statsB.avg ? "A" : statsA.avg > statsB.avg ? "B" : undefined) : undefined}
          />
          <CompareRow
            valueA={statsA.best != null ? toPar(statsA.best) : "–"}
            label="Best round"
            valueB={statsB.best != null ? toPar(statsB.best) : "–"}
            inkA={statsA.best != null ? signInk(statsA.best) : undefined}
            inkB={statsB.best != null ? signInk(statsB.best) : undefined}
            better={statsA.best != null && statsB.best != null ? (statsA.best < statsB.best ? "A" : statsA.best > statsB.best ? "B" : undefined) : undefined}
          />
          <CompareRow
            valueA={String(statsA.wins)}
            label="Wins"
            valueB={String(statsB.wins)}
            better={statsA.wins !== statsB.wins ? (statsA.wins > statsB.wins ? "A" : "B") : undefined}
          />
          <CompareRow
            valueA={String(statsA.top3)}
            label="Top 3 finishes"
            valueB={String(statsB.top3)}
            better={statsA.top3 !== statsB.top3 ? (statsA.top3 > statsB.top3 ? "A" : "B") : undefined}
          />
        </CardContent>
      </Card>

      {combined.length > 0 ? (
        <div>
          <h2 className="mb-4 text-[20px] font-bold tracking-[-0.02em]" style={{ color: "var(--ink)" }}>
            Round by round
          </h2>
          <div className="overflow-hidden rounded-[var(--r-card)] border" style={{ borderColor: "var(--line)" }}>
            <div
              className="grid px-6 py-3 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[.13em]"
              style={{ gridTemplateColumns: "120px minmax(0,1fr) 56px minmax(0,1fr)", background: "var(--bg-subtle)", color: "var(--ink-muted)" }}
            >
              <div>Round</div>
              <div className="truncate text-center">{playerA.name}</div>
              <div />
              <div className="truncate text-center">{playerB.name}</div>
            </div>
            {combined.map((r) => {
              const missing = r.aRel == null || r.bRel == null;
              const tie = !missing && r.aRel === r.bRel;
              const aWon = !missing && !tie && r.aRel! < r.bRel!;
              const bWon = !missing && !tie && r.bRel! < r.aRel!;
              const aInk = missing ? "var(--ink-muted)" : tie ? "var(--ink)" : aWon ? "var(--ink)" : "var(--ink-3)";
              const bInk = missing ? "var(--ink-muted)" : tie ? "var(--ink)" : bWon ? "var(--ink)" : "var(--ink-3)";
              const mark = missing ? "" : tie ? "=" : aWon ? "←" : "→";
              const markInk = missing ? "var(--ink-muted)" : tie ? "var(--ink-muted)" : aWon ? "var(--a-ink)" : "var(--b-ink)";
              return (
                <div
                  key={r.roundId}
                  className="grid items-center px-6 py-3"
                  style={{ gridTemplateColumns: "120px minmax(0,1fr) 56px minmax(0,1fr)", borderTop: "1px solid var(--line-3)" }}
                >
                  <div>
                    <Link href={`/rounds/${r.roundId}?league=${league.id}`} className="text-sm font-semibold" style={{ color: "var(--ink)" }}>
                      Week {r.weekNumber}
                    </Link>
                    <p className="font-[family-name:var(--font-mono)] text-[11px]" style={{ color: "var(--ink-muted)" }}>
                      {formatDate(r.date)}
                    </p>
                  </div>
                  <div className="text-center font-[family-name:var(--font-mono)] text-sm font-semibold" style={{ color: aInk }}>
                    {r.aScore != null ? (
                      <>
                        {r.aScore} <span className="text-xs font-normal">({toPar(r.aRel!)})</span>
                      </>
                    ) : (
                      <span className="text-xs font-normal" style={{ color: "var(--ink-muted)" }}>— did not card</span>
                    )}
                  </div>
                  <div className="text-center font-bold" style={{ color: markInk }}>{mark}</div>
                  <div className="text-center font-[family-name:var(--font-mono)] text-sm font-semibold" style={{ color: bInk }}>
                    {r.bScore != null ? (
                      <>
                        {r.bScore} <span className="text-xs font-normal">({toPar(r.bRel!)})</span>
                      </>
                    ) : (
                      <span className="text-xs font-normal" style={{ color: "var(--ink-muted)" }}>— did not card</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <Card>
          <CardContent className="py-10 text-center text-sm" style={{ color: "var(--ink-muted)" }}>
            These players haven&apos;t played in the same qualifying rounds yet.
          </CardContent>
        </Card>
      )}

      <div className="pb-2 text-center">
        <Link href={`/compare?league=${league.id}`} className="text-sm">
          ← Compare different players
        </Link>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function MatchupHeader({
  playerA,
  playerB,
  statsA,
  statsB,
  league,
  leagueUrl,
  crossDivision,
}: {
  playerA: PlayerData;
  playerB: PlayerData;
  statsA: ReturnType<typeof computeStats>;
  statsB: ReturnType<typeof computeStats>;
  league: PlayerData["league"];
  leagueUrl: string;
  crossDivision: boolean;
}) {
  const side = (player: PlayerData, stats: ReturnType<typeof computeStats>, align: "left" | "right") => {
    const dot = player.division === Division.BLUE ? "var(--blue-dot)" : "var(--red-dot)";
    const label = player.division === Division.BLUE ? "Blue division" : "Red division";
    return (
      <div className={align === "right" ? "min-w-0 text-right" : "min-w-0"}>
        <p
          className={`mb-1 flex items-center gap-1.5 font-[family-name:var(--font-mono)] text-xs uppercase tracking-[.13em] ${align === "right" ? "justify-end" : ""}`}
          style={{ color: "var(--ink-muted)" }}
        >
          {align === "left" && <span className="h-2 w-2 rounded-full" style={{ background: dot }} />}
          {label}
          {align === "right" && <span className="h-2 w-2 rounded-full" style={{ background: dot }} />}
        </p>
        <Link href={`/players/${player.id}?league=${league.id}`} className="block truncate text-[28px] font-extrabold sm:text-[36px]" style={{ color: "var(--ink)", letterSpacing: "-0.02em" }}>
          {player.name}
        </Link>
        <p className="mt-1 font-[family-name:var(--font-mono)] text-xs" style={{ color: "var(--ink-muted)" }}>
          {stats.qualifying.length} rounds · avg {stats.avg != null ? toParAvg(Math.round(stats.avg * 100) / 100) : "—"}
        </p>
      </div>
    );
  };

  return (
    <div className="-mx-8 -mt-14 px-8 pt-24 pb-8" style={{ background: "linear-gradient(to bottom, var(--hero-a), var(--bg-app))" }}>
      <div className="mx-auto max-w-[var(--container)]">
        <div className="flex items-center gap-1.5 font-[family-name:var(--font-mono)] text-xs uppercase tracking-[.14em]" style={{ color: "var(--ink-muted)" }}>
          <Link href={leagueUrl} className="nav-link" style={{ color: "var(--ink-muted)" }}>Standings</Link>
          <span>/</span>
          <span>Head-to-head</span>
        </div>
        <div className="mt-4 grid items-center gap-4" style={{ gridTemplateColumns: "minmax(0,1fr) 64px minmax(0,1fr)" }}>
          {side(playerA, statsA, "left")}
          <div className="text-center font-[family-name:var(--font-mono)] text-lg" style={{ color: "var(--ink-muted)" }}>VS</div>
          {side(playerB, statsB, "right")}
        </div>
        <p className="mt-4 text-center text-xs" style={{ color: "var(--ink-muted)" }}>
          {league.name} · {league.year}
          {crossDivision && " · Cross-division comparison"}
        </p>
      </div>
    </div>
  );
}

function GroupHeading({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-3 text-center font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[.13em]" style={{ color: "var(--ink-muted)" }}>
      {children}
    </p>
  );
}

function CompareRow({
  valueA,
  label,
  valueB,
  better,
  inkA,
  inkB,
  small,
}: {
  valueA: string;
  label: string;
  valueB: string;
  better?: "A" | "B";
  inkA?: string;
  inkB?: string;
  small?: boolean;
}) {
  const size = small ? "text-[13px]" : "text-base";
  return (
    <div className="grid items-center gap-2 py-2" style={{ gridTemplateColumns: "minmax(0,1fr) 190px minmax(0,1fr)", borderTop: "1px solid var(--line-3)" }}>
      <div className={`flex items-center justify-end gap-1.5 text-right font-[family-name:var(--font-mono)] font-semibold ${size}`} style={{ color: inkA ?? "var(--ink)" }}>
        {valueA}
        {better === "A" && <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: "var(--positive)" }} />}
      </div>
      <div className="text-center font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[.13em]" style={{ color: "var(--ink-muted)" }}>
        {label}
      </div>
      <div className={`flex items-center gap-1.5 font-[family-name:var(--font-mono)] font-semibold ${size}`} style={{ color: inkB ?? "var(--ink)" }}>
        {better === "B" && <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: "var(--positive)" }} />}
        {valueB}
      </div>
    </div>
  );
}
