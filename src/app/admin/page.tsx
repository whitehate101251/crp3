"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { GlassCard } from "@/components/shared/glass-card";
import { PageHeader } from "@/components/shared/page-header";
import { PageLoadingSkeleton } from "@/components/shared/page-loading-skeleton";
import type { AdminDashboardStats, User } from "@/lib/types";

export default function AdminHomePage() {
  const [user, setUser] = useState<User | null>(null);
  const [stats, setStats] = useState<AdminDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadDashboard() {
      try {
        const [sessionRes, statsRes] = await Promise.all([
          fetch("/api/auth/session", { cache: "no-store" }),
          fetch("/api/dashboard/admin", { cache: "no-store" }),
        ]);

        if (!sessionRes.ok || !statsRes.ok) {
          throw new Error("Unable to load dashboard");
        }

        const sessionJson = (await sessionRes.json()) as { user: User };
        const statsJson = (await statsRes.json()) as AdminDashboardStats;

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
        <PageHeader title="Welcome back" subtitle="Loading..." />
        <PageLoadingSkeleton rows={4} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader title={user ? `Welcome back, ${user.name}` : "Welcome back"} />
      <div className="grid gap-4 md:grid-cols-3">
        <GlassCard>
          <p className="text-sm text-slate-600">Total Sites</p>
          <p className="mt-1 text-2xl font-semibold">{stats?.totalSites ?? 0}</p>
        </GlassCard>
        <GlassCard>
          <p className="text-sm text-slate-600">Total Workers</p>
          <p className="mt-1 text-2xl font-semibold">{stats?.totalWorkers ?? 0}</p>
        </GlassCard>
        <GlassCard>
          <p className="text-sm text-slate-600">Pending Approvals</p>
          <p className="mt-1 text-2xl font-semibold">{stats?.pendingApprovals ?? 0}</p>
        </GlassCard>
      </div>
      <GlassCard>
        <p className="mb-2 text-sm text-slate-600">Recent 3 submissions</p>
        <div className="space-y-2 text-sm text-slate-700">
          {(stats?.recentSubmissions ?? []).map((sheet) => (
            <div key={sheet.id} className="flex items-center justify-between rounded-xl bg-white/60 px-3 py-2">
              <span>{sheet.date}</span>
              <span>{sheet.status}</span>
            </div>
          ))}
        </div>
      </GlassCard>
      <GlassCard>
        <p className="mb-2 text-sm text-slate-600">Quick Actions</p>
        <div className="flex flex-wrap gap-2 text-sm">
          <Link className="rounded-lg bg-slate-800 px-3 py-2 text-white" href="/admin/approval">
            Open Approvals
          </Link>
          <Link className="rounded-lg bg-slate-700 px-3 py-2 text-white" href="/admin/sites">
            Manage Sites
          </Link>
          <Link className="rounded-lg bg-slate-700 px-3 py-2 text-white" href="/admin/add-user">
            Add User
          </Link>
        </div>
      </GlassCard>
    </div>
  );
}
