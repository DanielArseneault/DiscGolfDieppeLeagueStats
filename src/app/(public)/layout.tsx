import { PublicHeader } from "@/components/public-header";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PublicHeader />
      <main className="flex-1 max-w-6xl mx-auto px-4 pt-14 pb-8 w-full">
        {children}
      </main>
      <footer className="bg-teal-800 border-t border-teal-700 mt-auto">
        <div className="max-w-6xl mx-auto px-4 py-6 text-center text-sm text-teal-200">
          ADG Dieppe Disc Golf Mixed Summer League · Sponsored by{" "}
          <span className="font-medium text-white">Atlantic Disc Golf</span>
        </div>
      </footer>
    </>
  );
}
