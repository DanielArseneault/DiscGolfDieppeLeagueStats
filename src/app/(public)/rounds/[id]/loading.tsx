import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function RoundDetailLoading() {
  return (
    <div className="space-y-6">
      {/* Hero banner */}
      <div className="-mx-4 -mt-14 relative overflow-hidden mb-2">
        <div className="px-4 pt-16 pb-20 md:px-8 md:pt-24 md:pb-32 bg-slate-700 relative min-h-[200px]">
          <div className="relative space-y-2 mt-4">
            <Skeleton className="h-3 w-32 bg-slate-600" />
            <Skeleton className="h-9 w-48 bg-slate-600" />
            <Skeleton className="h-4 w-44 bg-slate-600" />
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1200 56" preserveAspectRatio="none" className="w-full h-8 md:h-14 fill-[#f8fafc]">
            <path d="M0,56 L0,28 C150,56 300,8 500,22 C700,36 900,4 1200,22 L1200,56 Z" />
          </svg>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-4">
        {[0, 1, 2].map((i) => (
          <Card key={i} className="border-slate-200">
            <CardContent className="pt-4 pb-4">
              <Skeleton className="h-8 w-12 mb-1.5" />
              <Skeleton className="h-3 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Scorecard tables */}
      {[0, 1].map((i) => (
        <Card key={i} className="border-slate-200">
          <CardContent className="pt-6 space-y-2">
            <Skeleton className="h-5 w-36 mb-4" />
            {Array.from({ length: 8 }).map((_, j) => (
              <Skeleton key={j} className="h-10 w-full" />
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
