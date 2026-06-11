import { prisma } from "@/lib/db";
import { PublicHeader } from "@/components/public-header";

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const leagues = await prisma.league.findMany({ orderBy: { year: "desc" } });

  return (
    <>
      <PublicHeader leagues={leagues} />
      <main className="flex-1 max-w-6xl mx-auto px-4 pt-14 pb-8 w-full">
        {children}
      </main>
      <footer className="bg-green-800 border-t border-green-700 mt-auto">
        <div className="max-w-6xl mx-auto px-4 py-6 text-center text-sm text-green-200">
          ADG Dieppe Disc Golf Mixed Summer League · Sponsored by{" "}
          <span className="font-medium text-white">Atlantic Disc Golf</span>
        </div>
      </footer>
    </>
  );
}
