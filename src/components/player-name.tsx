import Link from "next/link";

export type PlayerLookup = Map<string, number>;

/** Renders a free-text winner/award name as a link when it matches a known player
 *  (case-insensitive), plain text otherwise. Shared across standings, rounds, and
 *  round-detail pages, which all resolve free-text names against a per-page lookup. */
export function PlayerName({
  name,
  lookup,
  leagueId,
  className,
  style,
}: {
  name: string;
  lookup: PlayerLookup;
  leagueId: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const id = lookup.get(name.toLowerCase().trim());
  if (!id) return <span className={className} style={style}>{name}</span>;
  return (
    <Link href={`/players/${id}?league=${leagueId}`} className={className} style={style}>
      {name}
    </Link>
  );
}
