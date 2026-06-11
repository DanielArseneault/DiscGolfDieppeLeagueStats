import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function RoundDetailLoading() {
  return (
    <div className="space-y-6">
      {/* Breadcrumb + title */}
      <div>
        <Skeleton className="h-4 w-32 mb-3" />
        <Skeleton className="h-9 w-56 mb-2" />
        <Skeleton className="h-4 w-44" />
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
