import { auth } from "@/auth";
import { AdminNav } from "@/components/admin/admin-nav";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  return (
    <div className="admin min-h-screen">
      {session && <AdminNav />}
      <div className="max-w-6xl mx-auto px-3 py-6 sm:px-4 sm:py-8">
        {children}
      </div>
    </div>
  );
}
