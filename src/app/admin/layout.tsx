import { auth } from "@/auth";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const isLoginPage = false; // handled by middleware, but layout still wraps login

  return (
    <div className="min-h-screen bg-slate-50">
      {session && (
        <div className="bg-slate-900 text-white">
          <div className="max-w-6xl mx-auto px-4 h-12 flex items-center gap-6 text-sm">
            <span className="font-medium text-slate-300">Admin</span>
            <Link href="/admin" className="text-slate-400 hover:text-white transition-colors">Dashboard</Link>
            <Link href="/admin/import" className="text-slate-400 hover:text-white transition-colors">Import</Link>
            <Link href="/admin/layouts" className="text-slate-400 hover:text-white transition-colors">Layouts</Link>
            <div className="ml-auto flex items-center gap-4">
              <Link href="/" className="text-slate-400 hover:text-white transition-colors">← Public Site</Link>
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
