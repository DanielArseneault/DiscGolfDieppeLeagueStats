import { auth } from "@/auth";
import Link from "next/link";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  return (
    <div className="min-h-screen bg-slate-50">
      {session && (
        <div className="bg-slate-900 text-white">
          <div className="max-w-6xl mx-auto px-4 h-12 flex items-center justify-between text-sm">
            <div className="flex items-center gap-4 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              <Link href="/admin" className="font-medium text-white shrink-0">
                Admin
              </Link>
              <Link href="/admin/leagues" className="text-slate-400 hover:text-white transition-colors shrink-0">
                Leagues
              </Link>
              <Link href="/admin/layouts" className="text-slate-400 hover:text-white transition-colors shrink-0">
                Layouts
              </Link>
            </div>
            <div className="flex items-center gap-4 shrink-0 ml-4">
              <Link href="/" className="text-slate-400 hover:text-white transition-colors">
                <span className="hidden sm:inline">← Public Site</span>
                <span className="sm:hidden">← Site</span>
              </Link>
              <form action="/api/auth/signout" method="POST">
                <button type="submit" className="text-slate-400 hover:text-white transition-colors">
                  Sign out
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
      <div className="max-w-6xl mx-auto px-4 py-8">
        {children}
      </div>
    </div>
  );
}
