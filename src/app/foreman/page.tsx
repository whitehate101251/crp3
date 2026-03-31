"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { GlassCard } from "@/components/shared/glass-card";
import { PageHeader } from "@/components/shared/page-header";
import { STATUS_LABELS } from "@/lib/constants";
import type { ForemanDashboardStats } from "@/lib/types";
import { useUser } from "@/hooks/use-user";

export default function ForemanHomePage() {
  const { user, loading: userLoading } = useUser();
  const [stats, setStats] = useState<ForemanDashboardStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadStats() {
      try {
        const response = await fetch("/api/dashboard/foreman");
        if (!response.ok) {
          throw new Error("Unable to load dashboard stats");
        }

        const data = (await response.json()) as ForemanDashboardStats;
        if (!cancelled) {
          setStats(data);
        }
      } catch (error) {
        if (!cancelled) {
          toast.error(error instanceof Error ? error.message : "Failed to load dashboard");
        }
      } finally {
        if (!cancelled) {
          setStatsLoading(false);
        }
      }
    }

    loadStats();
    return () => {
      cancelled = true;
    };
  }, []);

  const todaySheetLabel = useMemo(() => {
    if (!stats?.todaySheetStatus || stats.todaySheetStatus === "NOT_STARTED") {
      return "Not Started";
    }
    return STATUS_LABELS[stats.todaySheetStatus] ?? "Not Started";
  }, [stats?.todaySheetStatus]);

  return (
    <div className="space-y-4">
      <PageHeader title="Timri Constructions" subtitle={user ? `Welcome back, ${user.name}` : "Mobile-first dashboard"} subtitleClassName="text-base" />
      <div className="grid gap-4">
        <Link href="/foreman/workers" className="block">
          <GlassCard>
          <p className="text-sm text-slate-600">My Workers</p>
          <p className="mt-1 text-2xl font-semibold">{statsLoading ? "..." : (stats?.workersCount ?? 0)}</p>
          </GlassCard>
        </Link>
        <GlassCard>
          <p className="text-sm text-slate-600">{"Today's Sheet"}</p>
          <p className="mt-1 text-base font-medium">{statsLoading ? "Loading..." : todaySheetLabel}</p>
        </GlassCard>
      </div>
      <Link href="/foreman/attendance" className="block rounded-2xl bg-green-600 px-4 py-4 text-center text-base font-semibold text-white">
        आज की हाज़िरी जमा करें
      </Link>

      {userLoading && <p className="text-xs text-slate-500">Loading session...</p>}
    </div>
  );
}
