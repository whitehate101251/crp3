import { GlassCard } from "@/components/shared/glass-card";
import { Skeleton } from "@/components/ui/skeleton";

type PageLoadingSkeletonProps = {
  rows?: number;
};

export function PageLoadingSkeleton({ rows = 3 }: PageLoadingSkeletonProps) {
  return (
    <GlassCard className="space-y-3">
      <Skeleton className="h-5 w-40" />
      {Array.from({ length: rows }).map((_, index) => (
        <Skeleton key={`skeleton-row-${index}`} className="h-10 w-full" />
      ))}
    </GlassCard>
  );
}
