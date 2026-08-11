import { parse, HTMLElement } from "node-html-parser";
import { Division } from "@/generated/prisma/client";

export interface ParsedParticipant {
  division: Division;
  name: string;
  username: string | null;
  pdgaNumber: string | null;
}

/**
 * Parses a UDisc event's /participants page (server-rendered HTML, not a
 * download). Used before a round starts, when /leaderboard/export has no
 * rows yet but players have already registered on UDisc.
 *
 * Division is tracked by walking the DOM in document order and updating
 * "current division" whenever a `<div class="text-lg font-bold">Blue|Red</div>`
 * heading is passed — that div is UDisc's pool-section label and (unlike the
 * longer "Pool Blue Layout - Mixed" text) appears nowhere else on the page.
 */
export function parseUDiscParticipants(html: string): ParsedParticipant[] {
  // Strip HTML comments first — UDisc splits text like "@username" into
  // "@<!-- -->username" for hydration, and comment nodes would otherwise
  // need special-casing during text extraction.
  const root = parse(html.replace(/<!--[\s\S]*?-->/g, ""));

  const participants: ParsedParticipant[] = [];
  let currentDivision: Division | null = null;

  function walk(el: HTMLElement) {
    for (const child of el.childNodes) {
      if (!(child instanceof HTMLElement)) continue;

      if (
        child.tagName === "DIV" &&
        child.classList.contains("text-lg") &&
        child.classList.contains("font-bold")
      ) {
        const label = child.text.trim().toLowerCase();
        if (label === "blue") currentDivision = Division.BLUE;
        else if (label === "red") currentDivision = Division.RED;
      } else if (
        currentDivision &&
        child.tagName === "P" &&
        child.classList.contains("mb-1") &&
        child.classList.contains("leading-none")
      ) {
        const name = child.text.trim();
        if (name) {
          const card = child.parentNode?.parentNode;
          const cardEl = card instanceof HTMLElement ? card : null;
          participants.push({
            division: currentDivision,
            name,
            username: extractUsername(cardEl),
            pdgaNumber: extractPdgaNumber(cardEl),
          });
        }
      }

      walk(child);
    }
  }

  walk(root);
  return participants;
}

function extractUsername(card: HTMLElement | null): string | null {
  if (!card) return null;
  const usernameP = card
    .querySelectorAll("p.leading-none")
    .find((p) => !p.classList.contains("mb-1"));
  if (!usernameP) return null;
  const text = usernameP.text.trim().replace(/^@/, "").trim();
  return text || null;
}

function extractPdgaNumber(card: HTMLElement | null): string | null {
  if (!card) return null;
  for (const a of card.querySelectorAll("a")) {
    const match = (a.getAttribute("href") ?? "").match(/pdga\.com\/player\/(\d+)/);
    if (match) return match[1];
  }
  return null;
}
