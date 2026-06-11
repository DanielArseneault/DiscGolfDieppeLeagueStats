import { Division } from "@/generated/prisma/client";

export interface RoundSummary {
  weekNumber: number;
  date: Date;
  totalPlayers: number;
  blueTop3: { name: string; score: number; relativeScore: number; position: number }[];
  redTop3: { name: string; score: number; relativeScore: number; position: number }[];
  ctpWinners: { hole: number; playerName: string }[];
}

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

  return `Week ${summary.weekNumber} is in the books! We had an incredible ${summary.totalPlayers} players out on the course.

${blueWinner ? `Blue Division was led by ${blueWinner.name} with a sharp ${formatScore(blueWinner.score, blueWinner.relativeScore)}.` : ""}
${redWinner ? `Red Division saw ${redWinner.name} come out on top with a strong ${formatScore(redWinner.score, redWinner.relativeScore)}.` : ""}

🏆 Blue Division Podium:
${bluePodium}

🏆 Red Division Podium:
${redPodium}

${ctpLines ? `🎯 CTP Winners:\n${ctpLines}\n` : ""}
Huge thanks to Atlantic Disc Golf for sponsoring the ADGDDGMSL Championship Series. Be sure to check out their store online and in person!

Same discin' time, same discin' place!

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

A special thank you to Atlantic Disc Golf for their continued support of the ADGDDGMSL Championship Series.`;
}
