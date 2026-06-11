"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function PublicError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="text-4xl mb-4">⚠️</div>
      <h2 className="text-xl font-semibold text-slate-900 mb-2">Something went wrong</h2>
      <p className="text-slate-500 text-sm mb-6">
        There was a problem loading this page. Please try again.
      </p>
      <Button onClick={reset} variant="outline">
        Try again
      </Button>
    </div>
  );
}
