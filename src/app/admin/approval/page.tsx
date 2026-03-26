"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, CheckCircle2, Pencil, Check, X, Search } from "lucide-react";
import { GlassCard } from "@/components/shared/glass-card";
import { PageLoadingSkeleton } from "@/components/shared/page-loading-skeleton";
import { PageHeader } from "@/components/shared/page-header";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/utils";
import type { AttendanceRecord, AttendanceSheet, Site, User } from "@/lib/types";

type SheetWithMeta = AttendanceSheet & {
  siteName: string;
  foremanName: string;
  workerCount: number;
};

type EditingRecord = {
  x_value: number;
  y_value: number;
  present?: boolean;
};

export default function AdminApprovalPage() {
  const [pendingSheets, setPendingSheets] = useState<SheetWithMeta[]>([]);
  const [todayApprovedSheets, setTodayApprovedSheets] = useState<SheetWithMeta[]>([]);
  const [recordsBySheet, setRecordsBySheet] = useState<Record<string, AttendanceRecord[]>>({});
  const [workerNameById, setWorkerNameById] = useState<Record<string, string>>({});
  const [expandedSheetIds, setExpandedSheetIds] = useState<Record<string, boolean>>({});
  const [editingByRecord, setEditingByRecord] = useState<Record<string, EditingRecord>>({});
  const [savingByRecord, setSavingByRecord] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [approvingSheetId, setApprovingSheetId] = useState<string | null>(null);
  const [approvingAll, setApprovingAll] = useState(false);
  const [searchInput, setSearchInput] = useState("");

  const fetchRecords = useCallback(async (sheetId: string) => {
    const response = await fetch(`/api/attendance/records?sheet_id=${sheetId}`);
    if (!response.ok) throw new Error("Failed to load records");
    return (await response.json()) as AttendanceRecord[];
  }, []);

  useEffect(() => {
    async function loadPageData() {
      try {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, "0");
        const day = String(now.getDate()).padStart(2, "0");
        const today = `${year}-${month}-${day}`;
        const [pendingRes, approvedTodayRes, sitesRes, usersRes, workersRes] = await Promise.all([
          fetch("/api/attendance/sheets?status=SENT_TO_ADMIN"),
          fetch(`/api/attendance/sheets?status=APPROVED&approved_on=${today}`),
          fetch("/api/sites"),
          fetch("/api/users"),
          fetch("/api/workers"),
        ]);

        if (!pendingRes.ok || !approvedTodayRes.ok || !sitesRes.ok || !usersRes.ok || !workersRes.ok) {
          throw new Error("Failed to load approval data");
        }

        const [pendingData, approvedData, sitesData, usersData, workersData] = (await Promise.all([
          pendingRes.json(),
          approvedTodayRes.json(),
          sitesRes.json(),
          usersRes.json(),
          workersRes.json(),
        ])) as [AttendanceSheet[], AttendanceSheet[], Site[], User[], Array<{ id: string; name: string }>];

        const siteNameById = Object.fromEntries(sitesData.map((site) => [site.id, site.name]));
        const userNameById = Object.fromEntries(usersData.map((user) => [user.id, user.name]));
        setWorkerNameById(Object.fromEntries(workersData.map((worker) => [worker.id, worker.name])));

        const uniqueSheetIds = [...new Set([...pendingData, ...approvedData].map((sheet) => sheet.id))];
        const recordEntries = await Promise.all(
          uniqueSheetIds.map(async (sheetId) => {
            const records = await fetchRecords(sheetId);
            return [sheetId, records] as const;
          })
        );
        const recordMap = Object.fromEntries(recordEntries);
        setRecordsBySheet(recordMap);

        const attachMeta = (sheet: AttendanceSheet): SheetWithMeta => ({
          ...sheet,
          siteName: siteNameById[sheet.site_id] ?? sheet.site_id,
          foremanName: userNameById[sheet.foreman_id] ?? sheet.foreman_id,
          workerCount: recordMap[sheet.id]?.length ?? 0,
        });

        setPendingSheets(pendingData.map(attachMeta).sort((a, b) => b.date.localeCompare(a.date)));
        setTodayApprovedSheets(
          approvedData
            .map(attachMeta)
            .sort((a, b) => (b.approved_at ?? b.created_at).localeCompare(a.approved_at ?? a.created_at))
        );
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Unable to load approvals");
      } finally {
        setLoading(false);
      }
    }

    loadPageData();
  }, [fetchRecords]);

  const filteredPendingSheets = useMemo(() => {
    const query = searchInput.trim().toLowerCase();
    if (!query) return pendingSheets;
    return pendingSheets.filter(
      (sheet) =>
        sheet.foremanName.toLowerCase().includes(query) ||
        sheet.siteName.toLowerCase().includes(query) ||
        sheet.date.includes(query)
    );
  }, [pendingSheets, searchInput]);

  const toggleExpand = async (sheetId: string) => {
    setExpandedSheetIds((prev) => ({ ...prev, [sheetId]: !prev[sheetId] }));

    if (recordsBySheet[sheetId]) return;
    try {
      const records = await fetchRecords(sheetId);
      setRecordsBySheet((prev) => ({ ...prev, [sheetId]: records }));
    } catch {
      toast.error("Could not load worker records");
    }
  };

  const toggleEditRecord = (recordId: string, record?: AttendanceRecord) => {
    if (record && !editingByRecord[recordId]) {
      setEditingByRecord((prev) => ({
        ...prev,
        [recordId]: { x_value: record.x_value, y_value: record.y_value, present: record.present },
      }));
    } else {
      setEditingByRecord((prev) => {
        const updated = { ...prev };
        delete updated[recordId];
        return updated;
      });
    }
  };

  const updateEditingRecord = (recordId: string, field: "x_value" | "y_value" | "present", value: number | boolean) => {
    setEditingByRecord((prev) => ({
      ...prev,
      [recordId]: { ...prev[recordId], [field]: value },
    }));
  };

  const saveEditedRecord = async (recordId: string) => {
    const editedData = editingByRecord[recordId];
    if (!editedData) return;

    const targetRecord = Object.values(recordsBySheet)
      .flat()
      .find((record) => record.id === recordId);

    // Enforce consistency rules
    const isPresent = editedData.present !== undefined ? editedData.present : targetRecord?.present;
    if (isPresent && editedData.x_value === 0 && editedData.y_value === 0) {
      toast.error("You cannot save this record while status is Present with X=0 and Y=0. Please enter X or Y above 0.");
      return;
    }

    // Auto-set X and Y to 0 when Absent
    const finalXValue = isPresent ? editedData.x_value : 0;
    const finalYValue = isPresent ? editedData.y_value : 0;

    try {
      setSavingByRecord((prev) => ({ ...prev, [recordId]: true }));
      const response = await fetch("/api/attendance/records", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          record_id: recordId,
          x_value: finalXValue,
          y_value: finalYValue,
          present: editedData.present !== undefined ? editedData.present : undefined,
        }),
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "Failed to update record");
      }

      const updatedRecord = (await response.json()) as AttendanceRecord;

      setRecordsBySheet((prev) => {
        const updated = { ...prev };
        for (const sheetId in updated) {
          updated[sheetId] = updated[sheetId].map((record) =>
            record.id === recordId
              ? {
                  ...record,
                  x_value: updatedRecord.x_value,
                  y_value: updatedRecord.y_value,
                  total_hours: updatedRecord.total_hours,
                  present: updatedRecord.present,
                }
              : record,
          );
        }
        return updated;
      });

      setEditingByRecord((prev) => {
        const updated = { ...prev };
        delete updated[recordId];
        return updated;
      });

      toast.success("Record updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update record");
    } finally {
      setSavingByRecord((prev) => ({ ...prev, [recordId]: false }));
    }
  };

  const approveSheet = async (sheet: SheetWithMeta) => {
    const sheetRecords = recordsBySheet[sheet.id] ?? [];
    const hasInvalidPresentHours = sheetRecords.some((record) => record.present && record.x_value === 0 && record.y_value === 0);
    if (hasInvalidPresentHours) {
      toast.error("You cannot approve this sheet. A present worker has X=0 and Y=0. Please correct values first.");
      return;
    }

    const shouldApprove = window.confirm(`Approve attendance sheet for ${sheet.foremanName} on ${formatDate(sheet.date)}?`);
    if (!shouldApprove) return;

    try {
      setApprovingSheetId(sheet.id);
      const response = await fetch("/api/attendance/approve", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sheet_id: sheet.id }),
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "Approval failed");
      }

      toast.success("Sheet approved");
      setPendingSheets((prev) => prev.filter((entry) => entry.id !== sheet.id));

      setTodayApprovedSheets((prev) => [{ ...sheet, status: "APPROVED", approved_at: new Date().toISOString() }, ...prev]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Approval failed");
    } finally {
      setApprovingSheetId(null);
    }
  };

  const approveAllSheets = async () => {
    if (pendingSheets.length === 0) return;

    const shouldApproveAll = window.confirm("This will approve all of the attendances pending for admin approval. Do you want to continue?");
    if (!shouldApproveAll) return;

    const sheetsToApprove = [...pendingSheets];

    try {
      setApprovingAll(true);

      const results = await Promise.all(
        sheetsToApprove.map(async (sheet) => {
          const response = await fetch("/api/attendance/approve", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sheet_id: sheet.id }),
          });

          if (!response.ok) {
            const data = (await response.json()) as { error?: string };
            return {
              ok: false as const,
              sheet,
              error: data.error ?? "Approval failed",
            };
          }

          const updatedSheet = (await response.json()) as AttendanceSheet;
          return {
            ok: true as const,
            sheet,
            approvedAt: updatedSheet.approved_at ?? new Date().toISOString(),
          };
        })
      );

      const succeeded = results.filter((result) => result.ok);
      const failed = results.filter((result) => !result.ok);

      if (succeeded.length > 0) {
        const approvedIds = new Set(succeeded.map((result) => result.sheet.id));
        setPendingSheets((prev) => prev.filter((sheet) => !approvedIds.has(sheet.id)));
        setTodayApprovedSheets((prev) => [
          ...succeeded.map((result) => ({
            ...result.sheet,
            status: "APPROVED" as const,
            approved_at: result.approvedAt,
          })),
          ...prev,
        ]);
        toast.success(`Approved ${succeeded.length} sheet${succeeded.length === 1 ? "" : "s"}`);
      }

      if (failed.length > 0) {
        const firstError = failed[0].error;
        toast.error(`${failed.length} sheet${failed.length === 1 ? "" : "s"} could not be approved. ${firstError}`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Approve all failed");
    } finally {
      setApprovingAll(false);
    }
  };

  const renderRecordTable = (sheetId: string) => {
    const records = recordsBySheet[sheetId] ?? [];
    if (records.length === 0) {
      return <p className="text-sm text-slate-500">No records found.</p>;
    }

    return (
      <div className="overflow-x-auto">
        <table className="w-full min-w-[700px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left">
              <th className="pb-2 pr-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Worker Name</th>
              <th className="pb-2 pr-3 text-xs font-semibold uppercase tracking-wide text-slate-500">P/A</th>
              <th className="pb-2 pr-3 text-xs font-semibold uppercase tracking-wide text-slate-500">X</th>
              <th className="pb-2 pr-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Y</th>
              <th className="pb-2 pr-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Total Hrs</th>
              <th className="pb-2 pr-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Double Check</th>
              <th className="pb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Action</th>
            </tr>
          </thead>
          <tbody>
            {records.map((record) => {
              const isEditing = !!editingByRecord[record.id];
              const isSaving = !!savingByRecord[record.id];
              const editData = editingByRecord[record.id];
              const displayPresent = editData?.present !== undefined ? editData.present : record.present;

              return (
                <tr key={record.id} className="border-b border-slate-100 last:border-0">
                  <td className="py-2 pr-3 text-slate-700">{workerNameById[record.worker_id] ?? record.worker_id}</td>
                  <td className="py-2 pr-3 font-medium">
                    {isEditing ? (
                      <button
                        onClick={() => updateEditingRecord(record.id, "present", !displayPresent)}
                        className={`rounded px-2 py-1 text-xs font-bold text-white transition-colors ${
                          displayPresent ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"
                        }`}
                        disabled={isSaving}
                      >
                        {displayPresent ? "P" : "A"}
                      </button>
                    ) : (
                      <span className={`inline-block rounded px-2 py-1 text-xs font-bold text-white ${record.present ? "bg-green-600" : "bg-red-600"}`}>
                        {record.present ? "P" : "A"}
                      </span>
                    )}
                  </td>
                  <td className="py-2 pr-3">
                    {isEditing ? (
                      <Input
                        type="number"
                        value={editData?.x_value ?? ""}
                        onChange={(e) => updateEditingRecord(record.id, "x_value", parseFloat(e.target.value) || 0)}
                        className="h-7 w-16 text-sm"
                        disabled={isSaving || !displayPresent}
                      />
                    ) : (
                      record.x_value
                    )}
                  </td>
                  <td className="py-2 pr-3">
                    {isEditing ? (
                      <Input
                        type="number"
                        value={editData?.y_value ?? ""}
                        onChange={(e) => updateEditingRecord(record.id, "y_value", parseFloat(e.target.value) || 0)}
                        className="h-7 w-16 text-sm"
                        disabled={isSaving || !displayPresent}
                      />
                    ) : (
                      record.y_value
                    )}
                  </td>
                  <td className="py-2 pr-3">{record.total_hours}</td>
                  <td className="py-2 pr-3">{record.double_check ? "Yes" : "No"}</td>
                  <td className="py-2">
                    {isEditing ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => saveEditedRecord(record.id)}
                          className="text-green-600 hover:text-green-700"
                          disabled={isSaving}
                        >
                          <Check className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => toggleEditRecord(record.id)}
                          className="text-red-600 hover:text-red-700"
                          disabled={isSaving}
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => toggleEditRecord(record.id, record)}
                        className="text-slate-500 hover:text-slate-700"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Admin Approval" subtitle="Review and approve submitted attendance sheets" />

      <GlassCard>
        <div className="mb-4 space-y-3">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-slate-400" />
            <Input
              type="text"
              placeholder="Search by foreman name, site, or date..."
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              className="h-9 bg-white/50"
            />
          </div>
        </div>

        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-800">Pending Approvals</p>
          <button
            type="button"
            onClick={approveAllSheets}
            disabled={loading || approvingAll || pendingSheets.length === 0}
            className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {approvingAll ? "Approving all..." : `Approve all (${pendingSheets.length})`}
          </button>
        </div>

        {loading ? (
          <PageLoadingSkeleton rows={3} />
        ) : filteredPendingSheets.length === 0 ? (
          <p className="text-sm text-slate-500">{searchInput ? "No sheets match your search." : "No pending sheets"}</p>
        ) : (
          <div className="space-y-3">
            {filteredPendingSheets.map((sheet) => {
              const isExpanded = !!expandedSheetIds[sheet.id];
              const isApproving = approvingSheetId === sheet.id;
              const sheetRecords = recordsBySheet[sheet.id] ?? [];
              const hasInvalidPresentHours = sheetRecords.some((record) => record.present && record.x_value === 0 && record.y_value === 0);
              return (
                <div key={sheet.id} className="rounded-lg border border-slate-200 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => toggleExpand(sheet.id)}
                      className="flex items-center gap-2 text-left"
                    >
                      {isExpanded ? <ChevronDown className="h-4 w-4 text-slate-500" /> : <ChevronRight className="h-4 w-4 text-slate-500" />}
                      <div>
                        <p className="font-medium text-slate-800">{sheet.siteName} · {formatDate(sheet.date)}</p>
                        <p className="text-sm text-slate-500">{sheet.foremanName} · {sheet.workerCount} workers</p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => approveSheet(sheet)}
                      disabled={approvingAll || isApproving || hasInvalidPresentHours}
                      className="rounded-lg bg-green-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isApproving ? "Approving..." : "Approve"}
                    </button>
                  </div>

                  {isExpanded && <div className="mt-3">{renderRecordTable(sheet.id)}</div>}
                </div>
              );
            })}
          </div>
        )}
      </GlassCard>

      <details className="group rounded-xl border border-slate-200 bg-white/80 p-4 shadow-sm" open={false}>
        <summary className="flex cursor-pointer list-none items-center justify-between">
          <span className="text-sm font-semibold text-slate-800">Today&apos;s Approved</span>
          <span className="text-xs text-slate-500 group-open:hidden">Expand</span>
          <span className="hidden text-xs text-slate-500 group-open:inline">Collapse</span>
        </summary>

        <div className="mt-3">
          {loading ? (
            <PageLoadingSkeleton rows={2} />
          ) : todayApprovedSheets.length === 0 ? (
            <p className="text-sm text-slate-500">No approved sheets for today.</p>
          ) : (
            <div className="space-y-3">
              {todayApprovedSheets.map((sheet) => (
                <div key={sheet.id} className="rounded-lg border border-slate-200 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-slate-800">{sheet.siteName} · {formatDate(sheet.date)}</p>
                      <p className="text-sm text-slate-500">{sheet.foremanName} · {sheet.workerCount} workers</p>
                    </div>
                    <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-700">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Approved
                    </span>
                  </div>
                  {renderRecordTable(sheet.id)}
                </div>
              ))}
            </div>
          )}
        </div>
      </details>

    </div>
  );
}
