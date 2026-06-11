import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function RoundsLoading() {
  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="-mx-4 -mt-14 relative overflow-hidden mb-2">
        <div className="px-8 pt-24 pb-32 bg-slate-700 relative min-h-[220px]">
          <div className="relative space-y-2 mt-4">
            <Skeleton className="h-3 w-16 bg-slate-600" />
            <Skeleton className="h-10 w-56 bg-slate-600" />
            <Skeleton className="h-4 w-48 bg-slate-600" />
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1200 56" preserveAspectRatio="none" className="w-full h-14 fill-[#f8fafc]">
            <path d="M0,56 L0,28 C150,56 300,8 500,22 C700,36 900,4 1200,22 L1200,56 Z" />
          </svg>
        </div>
      </div>

      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i} className="border-slate-200">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2">
                  <Skeleton className="h-5 w-20" />
                  <Skeleton className="h-4 w-40" />
                </div>
                <Skeleton className="h-7 w-24 rounded-full shrink-0" />
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <Skeleton className="h-16 w-full rounded-lg" />
                <Skeleton className="h-16 w-full rounded-lg" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
