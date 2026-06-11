import * as XLSX from "xlsx";
import { Division } from "@/generated/prisma/client";

export interface ParsedResult {
  division: Division;
  position: number;
  name: string;
  pdgaNumber: string | null;
  username: string | null;
  eventRelativeScore: number;
  eventTotalScore: number;
  roundRelativeScore: number;
  roundTotalScore: number;
  holeScores: Record<number, number>;
  isDnf: boolean;
}

export interface ParsedImport {
  blueResults: ParsedResult[];
  redResults: ParsedResult[];
  inferredBluePar: number;
  inferredRedPar: number;
}

export function parseUDiscFile(buffer: ArrayBuffer): ParsedImport {
  const workbook = XLSX.read(new Uint8Array(buffer), { type: "array" });

  const blueResults: ParsedResult[] = [];
  const redResults: ParsedResult[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

    for (const row of rows) {
      const division = detectDivision(row, sheetName);
      if (!division) continue;

      const holeScores: Record<number, number> = {};
      for (let h = 1; h <= 18; h++) {
        const val = row[`hole_${h}`] ?? row[`Hole ${h}`] ?? row[`H${h}`];
        if (val !== undefined && val !== null && val !== "") {
          holeScores[h] = Number(val);
        }
      }

      const posStr = String(row["position"] ?? row["Position"] ?? "").toUpperCase();
      const isDnf = ["DNF", "DNS", "WD", "DQ"].includes(posStr);

      const result: ParsedResult = {
        division,
        position: isDnf ? 0 : (Number(row["position_raw"] ?? row["position"] ?? row["Position"] ?? 0) || 0),
        name: String(row["name"] ?? row["Name"] ?? row["PlayerName"] ?? ""),
        pdgaNumber: nullableString(row["pdga_number"] ?? row["PDGA Number"]),
        username: nullableString(row["username"] ?? row["Username"]),
        eventRelativeScore: Number(row["event_relative_score"] ?? row["event_score"] ?? 0),
        eventTotalScore: Number(row["event_total_score"] ?? row["total"] ?? 0),
        roundRelativeScore: Number(row["round_relative_score"] ?? row["round_score"] ?? 0),
        roundTotalScore: Number(row["round_total_score"] ?? row["score"] ?? 0),
        holeScores,
        isDnf,
      };

      if (!result.name) continue;
      if (isDnf) continue;

      if (division === Division.BLUE) {
        blueResults.push(result);
      } else {
        redResults.push(result);
      }
    }
  }

  const inferredBluePar = blueResults.length > 0
    ? blueResults[0].roundTotalScore - blueResults[0].roundRelativeScore
    : 60;

  const inferredRedPar = redResults.length > 0
    ? redResults[0].roundTotalScore - redResults[0].roundRelativeScore
    : 60;

  return { blueResults, redResults, inferredBluePar, inferredRedPar };
}

function detectDivision(row: Record<string, unknown>, sheetName: string): Division | null {
  const divValue = String(row["division"] ?? row["Division"] ?? "").toLowerCase();
  const sheetLower = sheetName.toLowerCase();

  if (divValue.includes("blue") || sheetLower.includes("blue")) return Division.BLUE;
  if (divValue.includes("red") || sheetLower.includes("red")) return Division.RED;
  return null;
}

function nullableString(val: unknown): string | null {
  if (val === undefined || val === null || val === "") return null;
  return String(val);
}
