"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { GlassCard } from "@/components/shared/glass-card";
import { PageHeader } from "@/components/shared/page-header";
import { PageLoadingSkeleton } from "@/components/shared/page-loading-skeleton";
import type { SiteInchargeDashboardStats, User } from "@/lib/types";

export default function SiteInchargeHomePage() {
  const [user, setUser] = useState<User | null>(null);
  const [stats, setStats] = useState<SiteInchargeDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadDashboard() {
      try {
        const [sessionRes, statsRes] = await Promise.all([
          fetch("/api/auth/session", { cache: "no-store" }),
          fetch("/api/dashboard/si", { cache: "no-store" }),
        ]);

        if (!sessionRes.ok || !statsRes.ok) {
          throw new Error("Unable to load dashboard");
        }

        const sessionJson = (await sessionRes.json()) as { user: User };
        const statsJson = (await statsRes.json()) as SiteInchargeDashboardStats;

        if (!cancelled) {
          setUser(sessionJson.user ?? null);
          setStats(statsJson);
        }
      } catch (error) {
        if (!cancelled) {
          toast.error(error instanceof Error ? error.message : "Failed to load dashboard");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadDashboard();

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        <PageHeader title="Timri Constructions" subtitle="Loading..." subtitleClassName="text-base" />
        <PageLoadingSkeleton rows={3} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Timri Constructions" subtitle={user ? `Welcome back, ${user.name}` : "Mobile-first temporary dashboard"} subtitleClassName="text-base" />
      <Link href="/site-incharge/review" className="block">
        <GlassCard className="space-y-2">
          <p className="text-sm text-slate-600">Pending Reviews</p>
          <p className="text-2xl font-semibold">{stats?.pendingReviews ?? 0}</p>
        </GlassCard>
      </Link>
      <Link href="/site-incharge/foremen" className="block">
        <GlassCard className="space-y-2">
          <p className="text-sm text-slate-600">My Foremens</p>
          <p className="text-2xl font-semibold">{stats?.foremenCount ?? 0}</p>
        </GlassCard>
      </Link>
      <GlassCard className="space-y-2">
        <p className="text-sm text-slate-600">{"Today's status"}</p>
        <p className="text-sm font-medium text-slate-800">{stats?.todayStatus ?? "No data"}</p>
        <div className="space-y-1.5 pt-1">
          {(stats?.recentSubmissions ?? []).length === 0 ? (
            <p className="text-xs text-slate-500">No recent submissions for today.</p>
          ) : (
            stats?.recentSubmissions.map((submission) => (
              <div key={submission.sheet_id} className="flex items-center justify-between rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs">
                <span className="font-medium text-slate-700">{submission.foreman_name}</span>
                <span className="text-slate-500">{format(new Date(submission.submission_time), "hh:mm a")}</span>
              </div>
            ))
          )}
        </div>
      </GlassCard>
      <Link href="/site-incharge/review" className="block rounded-xl bg-slate-800 px-4 py-4 text-center text-sm font-medium text-white">
        Review Attendance
      </Link>
    </div>
  );
}
