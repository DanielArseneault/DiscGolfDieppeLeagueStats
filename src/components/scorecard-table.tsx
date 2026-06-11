import { formatScore } from "@/lib/utils";

interface HolePar {
  holeNumber: number;
  par: number;
}

interface ResultRow {
  position: number;
  playerName: string;
  score: number;
  relativeScore: number;
  holeScores: Record<string, number>;
}

interface ScorecardTableProps {
  results: ResultRow[];
  holePars: HolePar[];
  divisionLabel: string;
}

export function ScorecardTable({ results, holePars, divisionLabel }: ScorecardTableProps) {
  const holes =
    holePars.length > 0
      ? holePars
      : Array.from({ length: 18 }, (_, i) => ({ holeNumber: i + 1, par: 3 }));

  const totalPar = holes.reduce((s, h) => s + h.par, 0);

  const posCounts = results.reduce<Record<number, number>>((acc, r) => {
    acc[r.position] = (acc[r.position] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div>
      <h3 className="font-semibold text-slate-700 mb-3 text-sm uppercase tracking-wide">
        {divisionLabel}
      </h3>
      <div className="overflow-x-auto rounded-lg border border-slate-200 shadow-sm">
        <table className="w-full text-xs min-w-max">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-3 py-2 text-center font-semibold text-slate-500 w-10">Pos</th>
              <th className="px-3 py-2 text-left font-semibold text-slate-500 min-w-[150px]">Name</th>
              <th className="px-3 py-2 text-center font-semibold text-slate-500 w-14">Total</th>
              <th className="px-3 py-2 text-center font-semibold text-slate-400 w-10">Thru</th>
              {holes.map((h) => (
                <th key={h.holeNumber} className="w-8 text-center font-semibold text-slate-600 p-0">
                  <div className="pt-2 pb-1 px-1">{h.holeNumber}</div>
                  <div className="text-[10px] text-slate-400 font-normal border-t border-slate-200 py-1">
                    {h.par}
                  </div>
                </th>
              ))}
              <th className="px-3 py-2 text-center font-semibold text-slate-600 w-14">
                <div className="pb-1">Round</div>
                <div className="text-[10px] text-slate-400 font-normal border-t border-slate-200 py-1">
                  {totalPar}
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {results.map((r, idx) => {
              const hs = r.holeScores;
              return (
                <tr
                  key={idx}
                  className={`border-b border-slate-100 hover:bg-green-50/40 transition-colors ${
                    idx % 2 === 1 ? "bg-slate-50/70" : "bg-white"
                  }`}
                >
                  <td className="px-3 py-2.5 text-center text-slate-500 font-medium">
                    {r.position === 0 ? "—" : posCounts[r.position] > 1 ? `T${r.position}` : r.position}
                  </td>
                  <td className="px-3 py-2.5 font-medium text-slate-800">{r.playerName}</td>
                  <td
                    className={`px-2 py-2.5 text-center font-semibold tabular-nums ${
                      r.relativeScore < 0
                        ? "text-sky-600"
                        : r.relativeScore > 0
                        ? "text-orange-500"
                        : "text-slate-500"
                    }`}
                  >
                    {formatScore(r.relativeScore)}
                  </td>
                  <td className="px-2 py-2.5 text-center text-slate-400">F</td>
                  {holes.map((h) => (
                    <td key={h.holeNumber} className="px-1 py-2 text-center">
                      <HoleScore score={hs[h.holeNumber]} par={h.par} />
                    </td>
                  ))}
                  <td className="px-2 py-2.5 text-center font-bold text-slate-800 tabular-nums">
                    {r.score}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function HoleScore({ score, par }: { score: number | undefined; par: number }) {
  if (!score) return <span className="text-slate-300">–</span>;
  const diff = score - par;

  if (diff <= -2) {
    return (
      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-sky-500 text-white font-bold text-[11px] ring-2 ring-sky-400 ring-offset-1">
        {score}
      </span>
    );
  }
  if (diff === -1) {
    return (
      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-sky-400 text-white font-medium text-[11px]">
        {score}
      </span>
    );
  }
  if (diff === 1) {
    return (
      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-orange-300 text-white font-medium text-[11px]">
        {score}
      </span>
    );
  }
  if (diff >= 2) {
    return (
      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-orange-500 text-white font-medium text-[11px] ring-2 ring-orange-400 ring-offset-1">
        {score}
      </span>
    );
  }
  return <span className="text-slate-700 text-[11px]">{score}</span>;
}
