import { prisma } from "@/lib/db";
import { Gender, MemberStatus } from "@/generated/prisma/client";

/** Matches by username first (if given), falling back to name — the same
 *  lookup UDisc imports have always used — then creates the player if
 *  neither matches. */
export async function findOrCreatePlayer(
  leagueId: number,
  info: { name: string; username?: string | null; pdgaNumber?: string | null; gender?: Gender | null }
) {
  const player = info.username
    ? await prisma.player.findFirst({ where: { username: info.username, leagueId } })
    : await prisma.player.findFirst({ where: { name: info.name, leagueId } });

  if (player) return player;

  return prisma.player.create({
    data: {
      name: info.name,
      pdgaNumber: info.pdgaNumber ?? null,
      username: info.username ?? null,
      gender: info.gender ?? null,
      memberStatus: MemberStatus.NON_MEMBER,
      league: { connect: { id: leagueId } },
    },
  });
}
