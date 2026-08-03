import { auth } from "@/auth";
import { AdminNav } from "@/components/admin/admin-nav";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  return (
    <div className="admin min-h-screen">
      {session && (
        <div
          className="sticky top-0 z-50 backdrop-blur-[10px]"
          style={{ background: "var(--bg-nav)", borderBottom: "1px solid var(--line-2)" }}
        >
          <AdminNav />
        </div>
      )}
      <div className="max-w-6xl mx-auto px-4 py-8">
        {children}
      </div>
    </div>
  );
}
