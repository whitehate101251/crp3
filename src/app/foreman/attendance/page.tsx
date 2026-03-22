"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays } from "lucide-react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import { GlassCard } from "@/components/shared/glass-card";
import { PageLoadingSkeleton } from "@/components/shared/page-loading-skeleton";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { TimePicker } from "@/components/foreman/time-picker";
import { WorkerModal } from "@/components/foreman/worker-modal";
import { WorkerAttendanceRow } from "@/components/foreman/worker-attendance-row";
import { useDraft } from "@/hooks/use-draft";
import { useForcemanLanguage } from "@/providers/foreman-language-provider";
import { cn } from "@/lib/utils";
import { foremanTranslations } from "@/lib/translations/foreman";
import type { DraftAttendance, DraftWorkerRecord, User, Worker } from "@/lib/types";

function todayIso() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function createEmptyRecords(workers: Worker[]): DraftWorkerRecord[] {
  return workers.map((worker) => ({
    worker_id: worker.id,
    worker_name: worker.name,
    father_name: worker.father_name,
    present: false,
    x_value: 0,
    y_value: 0,
  }));
}

export default function ForemanAttendancePage() {
  const router = useRouter();
  const { language } = useForcemanLanguage();
  const t = foremanTranslations[language];

  const [user, setUser] = useState<User | null>(null);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [date, setDate] = useState(todayIso());
  const [inTime, setInTime] = useState("09:00");
  const [outTime, setOutTime] = useState("18:00");
  const [confirmChecked, setConfirmChecked] = useState(false);
  const [records, setRecords] = useState<DraftWorkerRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [activeWorkerIndex, setActiveWorkerIndex] = useState<number | null>(null);
  const [pendingDate, setPendingDate] = useState<string | null>(null);
  const [dateOpen, setDateOpen] = useState(false);
  const [draftHydrated, setDraftHydrated] = useState(false);

  const { saveDraft, loadDraft, deleteDraft, hasDraft } = useDraft(user?.id ?? null, date);

  useEffect(() => {
    async function initialize() {
      setLoading(true);

      try {
        const sessionRes = await fetch("/api/auth/session", { cache: "no-store" });
        if (!sessionRes.ok) {
          router.push("/login");
          return;
        }

        const sessionJson = await sessionRes.json();
        const sessionUser = sessionJson.user as User;
        setUser(sessionUser);

        const workersRes = await fetch(`/api/workers?foreman_id=${sessionUser.id}`, { cache: "no-store" });
        const workersJson = (await workersRes.json()) as Worker[];
        setWorkers(workersJson);
      } catch {
        toast.error("Failed to load attendance context");
      } finally {
        setLoading(false);
      }
    }

    initialize();
  }, [router]);

  useEffect(() => {
    if (!user || !workers.length) return;

    const draft = loadDraft();
    if (!draft) {
      setInTime("09:00");
      setOutTime("18:00");
      setRecords(createEmptyRecords(workers));
      setConfirmChecked(false);
      setDraftHydrated(true);
      return;
    }

    const recordsByWorkerId = new Map(
      (draft.workers ?? []).map((record) => [record.worker_id, record] as const),
    );

    const mergedRecords = workers.map((worker) => {
      const existing = recordsByWorkerId.get(worker.id);
      if (!existing) {
        return {
          worker_id: worker.id,
          worker_name: worker.name,
          father_name: worker.father_name,
          present: false,
          x_value: 0,
          y_value: 0,
        } satisfies DraftWorkerRecord;
      }

      return {
        ...existing,
        worker_name: worker.name,
        father_name: worker.father_name,
      } satisfies DraftWorkerRecord;
    });

    setInTime(draft.in_time || "09:00");
    setOutTime(draft.out_time || "18:00");
    setRecords(mergedRecords);
    setConfirmChecked(false);
    setDraftHydrated(true);
  }, [date, loadDraft, user, workers]);

  useEffect(() => {
    if (!user || !workers.length || !draftHydrated) return;

    const timer = window.setTimeout(() => {
      saveDraft({
        date,
        in_time: inTime,
        out_time: outTime,
        workers: records,
      });
    }, 200);

    return () => window.clearTimeout(timer);
  }, [date, draftHydrated, inTime, outTime, records, saveDraft, user, workers.length]);

  const activeWorker = useMemo(() => {
    if (activeWorkerIndex === null) return null;
    return records[activeWorkerIndex] ?? null;
  }, [activeWorkerIndex, records]);

  const hasUnsavedData = useMemo(() => {
    if (!records.length) return false;
    if (inTime !== "09:00" || outTime !== "18:00") return true;
    return records.some((record) => record.present || record.x_value !== 0 || record.y_value !== 0);
  }, [inTime, outTime, records]);

  const hasPresentWithZeroHours = useMemo(
    () => records.some((record) => record.present && record.x_value === 0 && record.y_value === 0),
    [records],
  );

  const updateWorker = (updated: DraftWorkerRecord) => {
    setRecords((current) => current.map((record) => (record.worker_id === updated.worker_id ? updated : record)));
  };

  const saveCurrentDraft = () => {
    if (!user) return;
    const payload: DraftAttendance = {
      date,
      in_time: inTime,
      out_time: outTime,
      workers: records,
    };
    saveDraft(payload);
    toast.success(t.draftSaved);
  };

  const loadCurrentDraft = () => {
    const draft = loadDraft();
    if (!draft) {
      toast.error(t.noDraftFound);
      return;
    }

    setInTime(draft.in_time || "09:00");
    setOutTime(draft.out_time || "18:00");
    setRecords(draft.workers || []);
    setConfirmChecked(false);
    toast.success(t.draftLoaded);
  };

  const changeDateWithGuard = (nextDate: string) => {
    if (nextDate === date) return;
    if (!hasUnsavedData) {
      setDraftHydrated(false);
      setDate(nextDate);
      return;
    }

    const shouldSwitch = window.confirm(t.unsavedData);
    if (shouldSwitch) {
      setDraftHydrated(false);
      setDate(nextDate);
      setConfirmChecked(false);
    } else {
      setPendingDate(date);
    }
  };

  const submitAttendance = async () => {
    if (!user) return;
    if (!confirmChecked) {
      toast.error(t.confirmAttendance);
      return;
    }
    if (!records.length) {
      toast.error(t.noWorkerRecords);
      return;
    }
    if (hasPresentWithZeroHours) {
      toast.error(t.presentWithZeroHours);
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch("/api/attendance/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          in_time: inTime,
          out_time: outTime,
          records: records.map((record) => ({
            worker_id: record.worker_id,
            present: record.present,
            x_value: record.present ? record.x_value : 0,
            y_value: record.present ? record.y_value : 0,
          })),
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        toast.error(data.error ?? "Submit failed");
        return;
      }

      deleteDraft();
      toast.success(t.submittedSuccess);
      router.push("/foreman");
      router.refresh();
    } catch {
      toast.error(t.submitFailed);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <PageHeader title={t.attendance} subtitle={t.loadingContext} />
        <PageLoadingSkeleton rows={4} />
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-20">
      <PageHeader title={t.attendance} subtitle={t.markDailyAttendance} />

      <GlassCard className="space-y-3">
        <div className="rounded-xl border border-slate-200/70 bg-white/70 p-3">
          <div className="grid gap-3 sm:grid-cols-3">
            {/* Date – click anywhere to open calendar */}
            <div className="space-y-1 sm:col-span-1">
              <Label className="inline-flex items-center gap-1">
                <CalendarDays className="h-3.5 w-3.5" />
                {t.date}
              </Label>
              <Popover open={dateOpen} onOpenChange={setDateOpen}>
                <PopoverTrigger
                  className={cn(
                    "flex h-11 w-full items-center gap-2 rounded-md border border-slate-200 bg-white/70 px-3 text-sm font-medium text-slate-800",
                    "shadow-sm transition-all hover:border-slate-300 hover:bg-white focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-1",
                  )}
                >
                  <CalendarDays className="h-4 w-4 shrink-0 text-slate-400" />
                  <span className="flex-1 text-left">
                    {format(parseISO(pendingDate ?? date), "dd MMM yyyy")}
                  </span>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start" sideOffset={6}>
                  <Calendar
                    mode="single"
                    selected={parseISO(pendingDate ?? date)}
                    onSelect={(day) => {
                      if (!day) return;
                      const iso = format(day, "yyyy-MM-dd");
                      setPendingDate(iso);
                      changeDateWithGuard(iso);
                      setPendingDate(null);
                      setDateOpen(false);
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* In Time */}
            <div className="space-y-1">
              <Label className="inline-flex items-center gap-1">
                {t.inTime}
              </Label>
              <TimePicker id="in-time" value={inTime} onChange={setInTime} label={t.inTime} />
            </div>

            {/* Out Time */}
            <div className="space-y-1">
              <Label className="inline-flex items-center gap-1">
                {t.outTime}
              </Label>
              <TimePicker id="out-time" value={outTime} onChange={setOutTime} label={t.outTime} />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button type="button" variant="outline" className="relative h-11" onClick={loadCurrentDraft}>
            {t.loadDraft}
            {hasDraft() ? <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-green-500" aria-hidden="true" /> : null}
          </Button>
          <Button type="button" variant="outline" className="h-11" onClick={saveCurrentDraft}>
            {t.saveDraft}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="col-span-2 h-11"
            onClick={() => {
              const confirmed = window.confirm(t.loadingContext);
              if (confirmed) {
                deleteDraft();
                setRecords(createEmptyRecords(workers));
                setInTime("09:00");
                setOutTime("18:00");
                setConfirmChecked(false);
              }
            }}
          >
            {t.clearDraft}
          </Button>
        </div>
      </GlassCard>

      <div className="space-y-3">
        {records.length === 0 ? (
          <GlassCard>
            <p className="text-sm text-slate-500">{t.noWorkersFound}</p>
          </GlassCard>
        ) : (
          records.map((worker, index) => (
            <WorkerAttendanceRow
              key={worker.worker_id}
              worker={worker}
              onChange={updateWorker}
              onOpenDetail={() => setActiveWorkerIndex(index)}
            />
          ))
        )}
      </div>

      <GlassCard className="space-y-3">
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <Checkbox checked={confirmChecked} onCheckedChange={(value) => setConfirmChecked(value === true)} />
          {t.confirmAttendance}
        </label>

        <Button type="button" className="h-12 w-full text-base" disabled={!confirmChecked || submitting || hasPresentWithZeroHours} onClick={submitAttendance}>
          {submitting ? `${t.submit}...` : t.submit}
        </Button>
      </GlassCard>

      <WorkerModal
        open={activeWorkerIndex !== null}
        onOpenChange={(open) => {
          if (!open) setActiveWorkerIndex(null);
        }}
        worker={activeWorker}
        onChange={updateWorker}
        onPrev={() => {
          if (!records.length || activeWorkerIndex === null) return;
          setActiveWorkerIndex((activeWorkerIndex - 1 + records.length) % records.length);
        }}
        onNext={() => {
          if (!records.length || activeWorkerIndex === null) return;
          setActiveWorkerIndex((activeWorkerIndex + 1) % records.length);
        }}
      />
    </div>
  );
}
