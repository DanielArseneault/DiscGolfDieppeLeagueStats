import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function HomeLoading() {
  return (
    <div className="space-y-8">
      {/* Hero banner */}
      <div className="-mx-4 -mt-14 relative overflow-hidden mb-2">
        <div className="px-4 pt-16 pb-20 md:px-8 md:pt-24 md:pb-32 bg-slate-700 relative min-h-[200px]">
          <div className="relative space-y-2 mt-4">
            <Skeleton className="h-3 w-20 bg-slate-600" />
            <Skeleton className="h-9 w-64 bg-slate-600" />
            <Skeleton className="h-4 w-48 bg-slate-600" />
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1200 56" preserveAspectRatio="none" className="w-full h-8 md:h-14 fill-[#f8fafc]">
            <path d="M0,56 L0,28 C150,56 300,8 500,22 C700,36 900,4 1200,22 L1200,56 Z" />
          </svg>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 md:gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="border-slate-200">
            <CardContent className="pt-4 pb-4">
              <Skeleton className="h-8 w-10 mb-1.5" />
              <Skeleton className="h-3 w-24" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent round card */}
      <Card className="border-slate-200">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-2">
              <Skeleton className="h-5 w-52" />
              <Skeleton className="h-4 w-36" />
            </div>
            <Skeleton className="h-7 w-28 rounded-full shrink-0" />
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            {[0, 1].map((i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-7 w-full" />
                <Skeleton className="h-7 w-full" />
                <Skeleton className="h-7 w-full" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Standings */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-7 w-28 rounded-full" />
        </div>
        <Card className="border-slate-200">
          <CardContent className="pt-6 space-y-3">
            <Skeleton className="h-9 w-52" />
            {Array.from({ length: 7 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
