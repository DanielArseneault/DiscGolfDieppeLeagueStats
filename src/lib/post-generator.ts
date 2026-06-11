const HASHTAGS = `#dieppediscdemons #dieppediscgolf #discgolfleague #discgolfdieppe #discgolfawesome #discgolflife #discgolfing #udisc #cityofdieppe #villededieppe #atlanticdiscgolf #CTP`;

function formatScore(score: number, relative: number): string {
  const rel = relative === 0 ? "E" : relative > 0 ? `+${relative}` : `${relative}`;
  return `${score} (${rel})`;
}

function ordinalWin(n: number): string {
  if (n === 1) return "1st";
  if (n === 2) return "2nd";
  if (n === 3) return "3rd";
  return `${n}th`;
}

export interface RoundSummary {
  weekNumber: number;
  date: Date;
  totalPlayers: number;
  blueTop3: { name: string; score: number; relativeScore: number; position: number }[];
  redTop3: { name: string; score: number; relativeScore: number; position: number }[];
  ctpWinners: { hole: number; playerName: string }[];
  aceWinners: { hole: number; playerName: string; prizeAmount?: number | null }[];
}

export interface ChampionshipSummary {
  date: Date;
  totalPlayers: number;
  poolResults: Array<{
    pool: string;
    first: string | null;
    second: string | null;
  }>;
  ctpWinners: { hole: number; playerName: string }[];
  aceWinners: { hole: number; playerName: string; prizeAmount?: number | null }[];
}

export function generateFacebookPost(summary: RoundSummary): string {
  const blueWinner = summary.blueTop3[0];
  const redWinner = summary.redTop3[0];

  const bluePodium = summary.blueTop3
    .map((p, i) => `${ordinalWin(i + 1)} – ${p.name}${i === 0 ? ` (${formatScore(p.score, p.relativeScore)})` : ""}`)
    .join("\n");

  const redPodium = summary.redTop3
    .map((p, i) => `${ordinalWin(i + 1)} – ${p.name}${i === 0 ? ` (${formatScore(p.score, p.relativeScore)})` : ""}`)
    .join("\n");

  const ctpLines = summary.ctpWinners
    .map((c) => `• Hole ${c.hole} – ${c.playerName}`)
    .join("\n");

  const aceLines = summary.aceWinners
    .map((a) => `• Hole ${a.hole} – ${a.playerName}${a.prizeAmount ? ` ($${a.prizeAmount.toFixed(2)})` : ""}`)
    .join("\n");

  return `Week ${summary.weekNumber} is in the books! We had an incredible ${summary.totalPlayers} players out on the course.

${blueWinner ? `Blue Division was led by ${blueWinner.name} with a sharp ${formatScore(blueWinner.score, blueWinner.relativeScore)}.` : ""}
${redWinner ? `Red Division saw ${redWinner.name} come out on top with a strong ${formatScore(redWinner.score, redWinner.relativeScore)}.` : ""}

🏆 Blue Division Podium:
${bluePodium}

🏆 Red Division Podium:
${redPodium}

${ctpLines ? `🎯 CTP Winners:\n${ctpLines}\n` : ""}${aceLines ? `🦅 Ace Winners:\n${aceLines}\n` : ""}Huge thanks to Atlantic Disc Golf for sponsoring the ADGDDGMSL Championship Series. Be sure to check out their store online and in person!

Same discin' time, same discin' place!

${HASHTAGS}`;
}

export function generateChampionshipPost(summary: ChampionshipSummary): string {
  const poolSection = summary.poolResults
    .filter((p) => p.first || p.second)
    .map((p) => {
      const lines = [`Pool ${p.pool}`];
      if (p.first) lines.push(`🥇 ${p.first}`);
      if (p.second) lines.push(`🥈 ${p.second}`);
      return lines.join("\n");
    })
    .join("\n\n");

  const ctpLines = summary.ctpWinners
    .map((c) => `🎯 Hole ${c.hole} – ${c.playerName}`)
    .join("\n");

  const aceLines = summary.aceWinners
    .map((a) => `🦅 Hole ${a.hole} – ${a.playerName}${a.prizeAmount ? ` ($${a.prizeAmount.toFixed(2)})` : ""}`)
    .join("\n");

  return `🏆 Championship Night Recap – ADG Dieppe Summer League 🏆
Last night marked the conclusion of the Atlantic Disc Golf Dieppe Disc Golf Mixed Summer League. ${summary.totalPlayers} players came out for an unforgettable finale.

Highlights:
✅ ${summary.totalPlayers} players came out for the final night

Championship Results
${poolSection}

${ctpLines ? `CTP Winners\n${ctpLines}\n\n` : ""}${aceLines ? `Ace Winners\n${aceLines}\n\n` : ""}A massive thank you to Atlantic Disc Golf for their ongoing support of this league. Be sure to show them some love in-store or online for all your disc golf needs.

And of course, thank you to every volunteer and every player who helped make this series such a success. Stay tuned for what's coming next!

${HASHTAGS}`;
}

export function generateNewspaperBody(summary: RoundSummary): string {
  const blueWinner = summary.blueTop3[0];
  const redWinner = summary.redTop3[0];

  const bluePodium = summary.blueTop3
    .map((p, i) => `${ordinalWin(i + 1)} – ${p.name}`)
    .join(", ");

  const redPodium = summary.redTop3
    .map((p, i) => `${ordinalWin(i + 1)} – ${p.name}`)
    .join(", ");

  return `DIEPPE, N.B. — Week ${summary.weekNumber} of the ADGDDGMSL brought out ${summary.totalPlayers} players ready to compete.

${blueWinner ? `In the Blue Division, ${blueWinner.name} took the top spot with a ${formatScore(blueWinner.score, blueWinner.relativeScore)}.` : ""}
${redWinner ? `The Red Division was claimed by ${redWinner.name}.` : ""}

Blue Division: ${bluePodium}

Red Division: ${redPodium}

${summary.ctpWinners.length > 0 ? `CTP winners: ${summary.ctpWinners.map(c => `${c.playerName} (Hole ${c.hole})`).join(", ")}.` : ""}
${summary.aceWinners.length > 0 ? `Ace winners: ${summary.aceWinners.map(a => `${a.playerName} (Hole ${a.hole}${a.prizeAmount ? `, $${a.prizeAmount.toFixed(2)}` : ""})`).join(", ")}.` : ""}

A special thank you to Atlantic Disc Golf for their continued support of the ADGDDGMSL Championship Series.`;
}
