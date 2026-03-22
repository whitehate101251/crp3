"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { ArrowLeft, CheckCheck, Pencil, Send, ClipboardList } from "lucide-react";
import { GlassCard } from "@/components/shared/glass-card";
import { PageHeader } from "@/components/shared/page-header";
import type { AttendanceSheet, AttendanceRecord, Worker, User } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { X_MAX, Y_MAX } from "@/lib/constants";

type EditableRecord = AttendanceRecord & { worker_name: string };
type AttendanceRecordWithName = AttendanceRecord & { worker_name?: string };

export default function SiteInchargeReviewPage() {
  const [sheets, setSheets] = useState<AttendanceSheet[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<AttendanceSheet | null>(null);
  const [records, setRecords] = useState<EditableRecord[]>([]);
  const [foremanMap, setForemanMap] = useState<Record<string, string>>({});
  const [workerMap, setWorkerMap] = useState<Record<string, string>>({});
  const [editingByRecord, setEditingByRecord] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirmReviewed, setConfirmReviewed] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [sheetsRes, usersRes, workersRes] = await Promise.all([
          fetch("/api/attendance/sheets?status=SENT_TO_SI"),
          fetch("/api/users"),
          fetch("/api/workers"),
        ]);
        const sheetsData: AttendanceSheet[] = await sheetsRes.json();
        const usersData: User[] = await usersRes.json();
        const workersData: Worker[] = await workersRes.json();

        setSheets(sheetsData.sort((a, b) => b.date.localeCompare(a.date)));
        setForemanMap(Object.fromEntries(usersData.map((u) => [u.id, u.name])));
        setWorkerMap(Object.fromEntries(workersData.map((w) => [w.id, w.name])));
      } catch {
        toast.error("Failed to load data");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const openSheet = useCallback(
    async (sheet: AttendanceSheet) => {
      setSelectedSheet(sheet);
      setConfirmReviewed(false);
      setLoadingRecords(true);
      try {
        const res = await fetch(`/api/attendance/records?sheet_id=${sheet.id}`);
        const data: AttendanceRecordWithName[] = await res.json();
        setRecords(
          data.map((r) => ({ 
            ...r, 
            worker_name: r.worker_name ?? workerMap[r.worker_id] ?? r.worker_id 
          }))
        );
        setEditingByRecord({});
      } catch {
        toast.error("Failed to load records");
      } finally {
        setLoadingRecords(false);
      }
    },
    [workerMap]
  );

  const closeSheet = () => {
    setSelectedSheet(null);
    setRecords([]);
    setEditingByRecord({});
    setConfirmReviewed(false);
  };

  const updateRecord = (
    id: string,
    field: "present" | "x_value" | "y_value" | "double_check",
    value: number | boolean
  ) => {
    setRecords((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const updated = { ...r, [field]: value };
        if (field === "present" && value === false) {
          updated.double_check = false;
        }
        updated.total_hours = updated.present ? updated.x_value * 8 + updated.y_value : 0;
        return updated;
      })
    );
  };

  const isAllChecked = records.length > 0 && records.every((r) => r.double_check);
  const hasPresentWithZeroHours = records.some((r) => r.present && r.x_value === 0 && r.y_value === 0);

  const toggleCheckAll = () => {
    const nextChecked = !isAllChecked;
    setRecords((prev) => prev.map((r) => ({ ...r, double_check: nextChecked })));
  };

  const toggleEditRecord = (id: string) => {
    setEditingByRecord((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleForward = async () => {
    if (!selectedSheet) return;
    if (!confirmReviewed) {
      toast.error("Please confirm you reviewed all attendance entries");
      return;
    }
    if (!isAllChecked) {
      toast.error("Please double-check all entries before forwarding");
      return;
    }
    if (hasPresentWithZeroHours) {
      toast.error("You cannot forward this sheet. A present worker has X=0 and Y=0. Please enter X or Y above 0.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/attendance/review", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sheet_id: selectedSheet.id,
          records: records.map((r) => ({
            id: r.id,
            present: r.present,
            x_value: r.present ? r.x_value : 0,
            y_value: r.present ? r.y_value : 0,
            double_check: r.double_check,
          })),
        }),
      });
      if (!res.ok) {
        const err: { error: string } = await res.json();
        throw new Error(err.error);
      }
      toast.success("Sheet forwarded to Admin");
      setSheets((prev) => prev.filter((s) => s.id !== selectedSheet.id));
      closeSheet();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Forward failed");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Loading skeleton ──────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-4">
        <PageHeader title="Review Attendance" subtitle="Double-check and forward sheets to Admin" />
        <GlassCard>
          <p className="text-sm text-slate-500 animate-pulse">Loading sheets…</p>
        </GlassCard>
      </div>
    );
  }

  // ── Detail view ───────────────────────────────────────────────
  if (selectedSheet) {
    const presentCount = records.filter((r) => r.present).length;
    const checkedCount = records.filter((r) => r.double_check).length;

    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-start gap-3">
          <button
            onClick={closeSheet}
            className="mt-1 flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <PageHeader
            title={`${formatDate(selectedSheet.date)} — ${foremanMap[selectedSheet.foreman_id] ?? "Foreman"}`}
            subtitle={`In: ${selectedSheet.in_time ?? "—"}  ·  Out: ${selectedSheet.out_time ?? "—"}`}
          />
        </div>

        {loadingRecords ? (
          <GlassCard>
            <p className="text-sm text-slate-500 animate-pulse">Loading records…</p>
          </GlassCard>
        ) : (
          <>
            {/* Records table */}
            <GlassCard>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm text-slate-600">
                  <span className="font-semibold text-slate-800">{records.length}</span> workers ·{" "}
                  <span className="text-green-600 font-medium">{presentCount} present</span> ·{" "}
                  <span className="text-blue-600 font-medium">{checkedCount} checked</span>
                </p>
                <button
                  onClick={toggleCheckAll}
                  className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  {isAllChecked ? "Uncheck All" : "Check All"}
                </button>
              </div>

              <div className="overflow-x-auto -mx-1">
                <table className="w-full text-sm min-w-[520px]">
                  <thead>
                    <tr className="border-b border-slate-200 text-left">
                      <th className="pb-2 pr-4 text-xs font-semibold text-slate-500 uppercase tracking-wide">Worker</th>
                      <th className="pb-2 pr-4 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                      <th className="pb-2 pr-4 text-xs font-semibold text-slate-500 uppercase tracking-wide w-20">X</th>
                      <th className="pb-2 pr-4 text-xs font-semibold text-slate-500 uppercase tracking-wide w-20">Y</th>
                      <th className="pb-2 pr-4 text-xs font-semibold text-slate-500 uppercase tracking-wide">Hrs</th>
                      <th className="pb-2 text-xs font-semibold text-slate-500 uppercase tracking-wide text-center">✓</th>
                      <th className="pb-2 text-xs font-semibold text-slate-500 uppercase tracking-wide text-right">Edit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((rec) => (
                      <tr key={rec.id} className="border-b border-slate-100 last:border-0">
                        {(() => {
                          const isEditing = !!editingByRecord[rec.id];
                          return (
                            <>
                        <td className="py-2.5 pr-4 font-medium text-slate-800">{rec.worker_name}</td>
                        <td className="py-2.5 pr-4">
                          {isEditing ? (
                            <button
                              type="button"
                              onClick={() => updateRecord(rec.id, "present", !rec.present)}
                              className={`inline-flex h-8 min-w-20 items-center justify-center rounded-full px-3 text-xs font-bold transition-colors ${
                                rec.present
                                  ? "bg-green-100 text-green-700 hover:bg-green-200"
                                  : "bg-red-100 text-red-700 hover:bg-red-200"
                              }`}
                            >
                              {rec.present ? "Present" : "Absent"}
                            </button>
                          ) : (
                            <span
                              className={`inline-block rounded-full px-2 py-0.5 text-xs font-bold transition-colors ${
                                rec.present
                                  ? "bg-green-100 text-green-700"
                                  : "bg-red-100 text-red-700"
                              }`}
                            >
                              {rec.present ? "Present" : "Absent"}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 pr-4">
                          <input
                            type="number"
                            inputMode="numeric"
                            min={0}
                            max={X_MAX}
                            value={rec.x_value}
                            disabled={!isEditing || !rec.present}
                            onChange={(e) =>
                              updateRecord(
                                rec.id,
                                "x_value",
                                Math.min(X_MAX, Math.max(0, Number(e.target.value) || 0))
                              )
                            }
                            onFocus={(e) => {
                              if (e.target.value === "0") {
                                e.target.value = "";
                              }
                            }}
                            onBlur={(e) => {
                              if (e.target.value === "") {
                                e.target.value = "0";
                                updateRecord(rec.id, "x_value", 0);
                              }
                            }}
                            className="w-16 px-2 py-1.5 text-sm border border-slate-200 rounded-lg text-center
                              disabled:bg-slate-100 disabled:text-slate-400
                              focus:outline-none focus:ring-2 focus:ring-blue-400/60"
                          />
                        </td>
                        <td className="py-2.5 pr-4">
                          <input
                            type="number"
                            inputMode="numeric"
                            min={0}
                            max={Y_MAX}
                            value={rec.y_value}
                            disabled={!isEditing || !rec.present}
                            onChange={(e) =>
                              updateRecord(
                                rec.id,
                                "y_value",
                                Math.min(Y_MAX, Math.max(0, Number(e.target.value) || 0))
                              )
                            }
                            onFocus={(e) => {
                              if (e.target.value === "0") {
                                e.target.value = "";
                              }
                            }}
                            onBlur={(e) => {
                              if (e.target.value === "") {
                                e.target.value = "0";
                                updateRecord(rec.id, "y_value", 0);
                              }
                            }}
                            className="w-16 px-2 py-1.5 text-sm border border-slate-200 rounded-lg text-center
                              disabled:bg-slate-100 disabled:text-slate-400
                              focus:outline-none focus:ring-2 focus:ring-blue-400/60"
                          />
                        </td>
                        <td className="py-2.5 pr-4 tabular-nums text-slate-700">
                          {rec.total_hours}h
                        </td>
                        <td className="py-2.5 text-center">
                          <input
                            type="checkbox"
                            checked={rec.double_check}
                            onChange={(e) => updateRecord(rec.id, "double_check", e.target.checked)}
                            className="h-4 w-4 cursor-pointer rounded accent-blue-600"
                          />
                        </td>
                        <td className="py-2.5 text-right">
                          <button
                            type="button"
                            onClick={() => toggleEditRecord(rec.id)}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            {isEditing ? "Done" : "Edit"}
                          </button>
                        </td>
                            </>
                          );
                        })()}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </GlassCard>

            <GlassCard>
              <label className="mb-3 flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={confirmReviewed}
                  onChange={(event) => setConfirmReviewed(event.target.checked)}
                  className="h-4 w-4 rounded accent-blue-600"
                />
                I have reviewed all attendance entries
              </label>

              <button
                onClick={handleForward}
                disabled={submitting || !confirmReviewed || !isAllChecked || hasPresentWithZeroHours}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3.5 font-bold text-white shadow-sm transition-colors
                  hover:bg-blue-700 active:bg-blue-800
                  disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
                {submitting ? "Forwarding…" : "Forward to Admin"}
              </button>
            </GlassCard>
          </>
        )}
      </div>
    );
  }

  // ── List view ─────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <PageHeader
        title="Review Attendance"
        subtitle={`${sheets.length} sheet${sheets.length !== 1 ? "s" : ""} pending review`}
      />

      {sheets.length === 0 ? (
        <GlassCard>
          <div className="flex flex-col items-center py-10 gap-2 text-slate-400">
            <ClipboardList className="w-12 h-12 text-slate-200" />
            <p className="font-semibold text-slate-500">No sheets pending review</p>
            <p className="text-xs">Foremen submissions will appear here</p>
          </div>
        </GlassCard>
      ) : (
        <div className="space-y-3">
          {sheets.map((sheet) => (
            <GlassCard key={sheet.id}>
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-bold text-slate-800">{formatDate(sheet.date)}</p>
                  <p className="text-sm text-slate-500 truncate">
                    {foremanMap[sheet.foreman_id] ?? sheet.foreman_id}
                  </p>
                  {(sheet.in_time || sheet.out_time) && (
                    <p className="text-xs text-slate-400 mt-0.5">
                      {sheet.in_time ?? "—"} → {sheet.out_time ?? "—"}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => openSheet(sheet)}
                  className="shrink-0 flex items-center gap-2 px-4 py-2
                    bg-blue-600 hover:bg-blue-700 active:bg-blue-800
                    text-white text-sm font-semibold rounded-lg transition-colors"
                >
                  Review
                </button>
              </div>
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  );
}
