"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/shared/glass-card";
import { PageHeader } from "@/components/shared/page-header";

export default function GlobalError({
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
    <div className="space-y-4">
      <PageHeader title="Something went wrong" subtitle="Please retry the last action." />
      <GlassCard className="space-y-3">
        <p className="text-sm text-slate-600">An unexpected error occurred while rendering this page.</p>
        <Button type="button" onClick={reset}>
          Try again
        </Button>
      </GlassCard>
    </div>
  );
}
