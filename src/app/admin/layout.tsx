import { auth } from "@/auth";
import Link from "next/link";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  return (
    <div className="min-h-screen bg-slate-50">
      {session && (
        <div className="bg-slate-900 text-white">
          <div className="max-w-6xl mx-auto px-4 h-12 flex items-center gap-6 text-sm">
            <Link href="/admin" className="font-medium text-white">
              Admin
            </Link>
            <Link href="/admin/leagues" className="text-slate-400 hover:text-white transition-colors">
              Leagues
            </Link>
            <Link href="/admin/layouts" className="text-slate-400 hover:text-white transition-colors">
              Layouts
            </Link>
            <div className="ml-auto flex items-center gap-4">
              <Link href="/" className="text-slate-400 hover:text-white transition-colors">
                ← Public Site
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
