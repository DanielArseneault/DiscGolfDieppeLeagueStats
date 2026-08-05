import { parse, HTMLElement } from "node-html-parser";
import { Division } from "@/generated/prisma/client";

export interface ParsedParticipant {
  division: Division;
  name: string;
  username: string | null;
  pdgaNumber: string | null;
}

const DIVISION_LABELS: Record<string, Division> = {
  blue: Division.BLUE,
  red: Division.RED,
};

/** Parses a UDisc event's `/participants` page HTML into a flat, division-tagged list.
 *  The page has no stable test ids — division headers and participant cards are
 *  matched by their Tailwind classes, which is what UDisc's own markup exposes. */
export function parseUDiscParticipants(html: string): ParsedParticipant[] {
  const root = parse(html);

  const headers = root.querySelectorAll("div.text-lg.font-bold");
  const divisionHeaders = headers.filter((el) => DIVISION_LABELS[el.text.trim().toLowerCase()]);

  if (divisionHeaders.length === 0) {
    throw new Error("Could not find any division sections — UDisc's participants page format may have changed.");
  }

  const nameNodes = root.querySelectorAll("p.mb-1.leading-none");
  const participants: ParsedParticipant[] = [];

  for (const nameNode of nameNodes) {
    const name = nameNode.text.trim();
    if (!name) continue;

    const division = divisionForNode(nameNode, divisionHeaders);
    if (!division) continue;

    // Name and username share a parent ("card"); the PDGA link lives in a
    // sibling of that parent, so it needs the row (grandparent) to find it.
    const card = nameNode.parentNode as HTMLElement | null;
    const row = card?.parentNode as HTMLElement | null;

    const usernameNode = card?.querySelector("div.text-subtle p.leading-none");
    const usernameText = usernameNode?.text.trim() ?? "";
    const username = usernameText.startsWith("@") ? usernameText.slice(1).trim() || null : null;

    const pdgaLink = row?.querySelector('a[href*="pdga.com/player/"]');
    const pdgaMatch = pdgaLink?.getAttribute("href")?.match(/\/player\/(\d+)/);
    const pdgaNumber = pdgaMatch ? pdgaMatch[1] : null;

    participants.push({ division, name, username, pdgaNumber });
  }

  if (participants.length === 0) {
    throw new Error("Found division sections but no participant names — UDisc's participants page format may have changed.");
  }

  return participants;
}

/** Nodes are matched by document order: a participant belongs to whichever
 *  division header last appeared before it in the raw HTML. */
function divisionForNode(node: HTMLElement, divisionHeaders: HTMLElement[]): Division | null {
  let current: Division | null = null;
  for (const header of divisionHeaders) {
    if (header.range[0] > node.range[0]) break;
    current = DIVISION_LABELS[header.text.trim().toLowerCase()] ?? current;
  }
  return current;
}
