"use client";

import { useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { Check, ChevronDown, ChevronRight, Download, Pencil, Search, Trash2, X } from "lucide-react";
import ExcelJS from "exceljs";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "sonner";
import { GlassCard } from "@/components/shared/glass-card";
import { PageLoadingSkeleton } from "@/components/shared/page-loading-skeleton";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDate } from "@/lib/utils";
import type { AttendanceRecord, AttendanceSheet, Site, User, Worker } from "@/lib/types";

type RecordRow = {
  id: string;
  date: string;
  workerName: string;
  siteName: string;
  siteInchargeName: string;
  foremanName: string;
  present: boolean;
  xValue: number;
  yValue: number;
  totalHours: number;
  doubleCheck: boolean;
  siteId: string;
  foremanId: string;
};

type EditingRow = {
  xValue: number;
  yValue: number;
  present?: boolean;
};

type Filters = {
  workerSearch: string;
  siteFilter: string;
  foremanFilter: string;
  fromDate: string;
  toDate: string;
};

type ForemanGroup = {
  foremanId: string;
  foremanName: string;
  rows: RecordRow[];
};

type SiteInchargeGroup = {
  siteInchargeName: string;
  foremen: ForemanGroup[];
};

type SiteDateGroup = {
  siteId: string;
  siteName: string;
  date: string;
  siteIncharges: SiteInchargeGroup[];
};

type ExportFormat = "CSV" | "EXCEL" | "PDF";

type PivotExportResponse = {
  from: string;
  to: string;
  dates: string[];
  rows: {
    name: string;
    values: Record<string, number | null>;
  }[];
  footer: {
    foremanName: string;
    siteInchargeName: string;
    siteName: string;
  };
};

type PreparedExportRow = {
  name: string;
  dateValues: Array<number | "">;
  totalHours: number;
  totalHaziri: number;
};

const defaultFilters: Filters = {
  workerSearch: "",
  siteFilter: "ALL",
  foremanFilter: "ALL",
  fromDate: "",
  toDate: "",
};

function toIsoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function csvCell(value: string | number | null | undefined) {
  if (value === null || value === undefined) return "";
  const raw = String(value);
  if (raw.includes(",") || raw.includes("\n") || raw.includes('"')) {
    return `"${raw.replaceAll('"', '""')}"`;
  }
  return raw;
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function buildCsv(payload: PivotExportResponse) {
  const dateLabels = payload.dates.map((date) => format(parseISO(date), "dd/MM/yyyy"));
  const preparedRows: PreparedExportRow[] = payload.rows.map((row) => {
    const dateValues = payload.dates.map((date) => {
      const value = row.values[date];
      return value === null || value === undefined ? "" : Number(value);
    });

    const totalHours = dateValues.reduce<number>((sum, value) => sum + (typeof value === "number" ? value : 0), 0);
    const totalHaziri = Number((totalHours / 8).toFixed(2));

    return {
      name: row.name,
      dateValues,
      totalHours,
      totalHaziri,
    };
  });

  const header = ["**Name**", ...dateLabels.map((d) => `**${d}**`), "", "", "**Total Hours**", "", "", "**Total Haziri**"];
  const dataRows = preparedRows.map((row) => [`**${row.name}**`, ...row.dateValues.map((v) => (typeof v === "number" ? `**${v}**` : v)), "", "", `**${row.totalHours}**`, "", "", `**${row.totalHaziri}**`]);
  const footerRows = [
    [],
    ["**Foreman Name**", `**${payload.footer.foremanName}**`],
    ["**Site Incharge Name**", `**${payload.footer.siteInchargeName}**`],
    ["**Site Name**", `**${payload.footer.siteName}**`],
  ];

  return [...[header], ...dataRows, ...footerRows].map((row) => row.map(csvCell).join(",")).join("\n");
}


async function buildExcel(payload: PivotExportResponse) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Attendance");

  const dateLabels = payload.dates.map((date) => format(parseISO(date), "dd/MM/yyyy"));
  const preparedRows: PreparedExportRow[] = payload.rows.map((row) => {
    const dateValues = payload.dates.map((date) => {
      const value = row.values[date];
      return value === null || value === undefined ? "" : Number(value);
    });

    const totalHours = dateValues.reduce<number>((sum, value) => sum + (typeof value === "number" ? value : 0), 0);
    const totalHaziri = Number((totalHours / 8).toFixed(2));

    return {
      name: row.name,
      dateValues,
      totalHours,
      totalHaziri,
    };
  });

  const header = ["Name", ...dateLabels, "", "", "Total Hours", "", "", "Total Haziri"];
  sheet.addRow(header);

  for (const row of preparedRows) {
    sheet.addRow([row.name, ...row.dateValues, "", "", row.totalHours, "", "", row.totalHaziri]);
  }

  sheet.addRow([]);
  const foremanRow = sheet.addRow(["Foreman Name", payload.footer.foremanName]);
  const inchargeRow = sheet.addRow(["Site Incharge Name", payload.footer.siteInchargeName]);
  const siteRow = sheet.addRow(["Site Name", payload.footer.siteName]);

  for (const footerRow of [foremanRow, inchargeRow, siteRow]) {
    footerRow.getCell(1).font = { bold: true };
    footerRow.getCell(2).font = { bold: true };
  }

  const dateStartCol = 2;
  const dateEndCol = dateStartCol + dateLabels.length - 1;
  const totalHoursCol = dateEndCol + 3;
  const totalHaziriCol = totalHoursCol + 3;

  const headerRow = sheet.getRow(1);
  headerRow.height = 92;

  for (let col = 1; col <= totalHaziriCol; col += 1) {
    const cell = headerRow.getCell(col);
    cell.font = { bold: true };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" },
    };
  }

  for (let col = dateStartCol; col <= dateEndCol; col += 1) {
    const cell = headerRow.getCell(col);
    cell.alignment = {
      vertical: "middle",
      horizontal: "center",
      textRotation: 90,
      wrapText: true,
    };
  }

  sheet.getColumn(1).width = 26;
  for (let col = dateStartCol; col <= dateEndCol; col += 1) {
    sheet.getColumn(col).width = 6;
  }
  sheet.getColumn(dateEndCol + 1).width = 4;
  sheet.getColumn(dateEndCol + 2).width = 4;
  sheet.getColumn(totalHoursCol).width = 14;
  sheet.getColumn(totalHoursCol + 1).width = 4;
  sheet.getColumn(totalHoursCol + 2).width = 4;
  sheet.getColumn(totalHaziriCol).width = 14;

  for (let rowIndex = 2; rowIndex <= preparedRows.length + 1; rowIndex += 1) {
    const excelRow = sheet.getRow(rowIndex);
    for (let col = 1; col <= totalHaziriCol; col += 1) {
      const cell = excelRow.getCell(col);
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
      cell.alignment = {
        vertical: "middle",
        horizontal: col === 1 ? "left" : "center",
      };

      if (col === 1 || (col >= dateStartCol && col <= dateEndCol) || col === totalHoursCol || col === totalHaziriCol) {
        if (typeof cell.value === "string" || typeof cell.value === "number") {
          cell.font = { bold: true };
        }
      }
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

function buildPdf(payload: PivotExportResponse) {
  const dateLabels = payload.dates.map((date) => format(parseISO(date), "dd/MM/yyyy"));
  const verticalDateLabels = dateLabels.map((label) => label.split("").join("\n"));
  const preparedRows: PreparedExportRow[] = payload.rows.map((row) => {
    const dateValues = payload.dates.map((date) => {
      const value = row.values[date];
      return value === null || value === undefined ? "" : Number(value);
    });

    const totalHours = dateValues.reduce<number>((sum, value) => sum + (typeof value === "number" ? value : 0), 0);
    const totalHaziri = Number((totalHours / 8).toFixed(2));

    return {
      name: row.name,
      dateValues,
      totalHours,
      totalHaziri,
    };
  });

  const headRow = ["Name", ...verticalDateLabels, "", "", "Total Hours", "", "", "Total Haziri"];
  const bodyRows = preparedRows.map((row) => [row.name, ...row.dateValues, "", "", row.totalHours, "", "", row.totalHaziri]);

  const doc = new jsPDF({ orientation: payload.dates.length > 7 ? "landscape" : "portrait" });

  autoTable(doc, {
    head: [headRow],
    body: bodyRows,
    startY: 12,
    styles: { fontSize: 7, cellPadding: 1.4, halign: "center", valign: "middle", fontStyle: "normal" },
    headStyles: { fillColor: [0, 0, 0], textColor: 255, fontStyle: "bold" },
    bodyStyles: { fontStyle: "normal" },
    didParseCell: (data) => {
      if (data.section === "head" && data.column.index > 0 && data.column.index <= payload.dates.length) {
        data.cell.styles.fontSize = 5.5;
        data.cell.styles.minCellHeight = 24;
      }

      if (data.column.index === 0) {
        data.cell.styles.halign = "left";
        if (data.section === "body") {
          data.cell.styles.fontStyle = "bold";
        }
      } else if (data.section === "body" && (data.column.index <= payload.dates.length || data.column.index > payload.dates.length + 2)) {
        data.cell.styles.fontStyle = "bold";
      }
    },
  });

  const finalY = (doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? 20;
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text(`Foreman Name: ${payload.footer.foremanName}`, 14, finalY + 8);
  doc.text(`Site Incharge Name: ${payload.footer.siteInchargeName}`, 14, finalY + 14);
  doc.text(`Site Name: ${payload.footer.siteName}`, 14, finalY + 20);
  doc.setFont("helvetica", "normal");

  return doc.output("blob");
}

export default function AdminAttendanceRecordsPage() {
  const [rows, setRows] = useState<RecordRow[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [foremen, setForemen] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  const [filterInputs, setFilterInputs] = useState<Filters>(defaultFilters);
  const [appliedFilters, setAppliedFilters] = useState<Filters>(defaultFilters);

  const [expandedSiteDates, setExpandedSiteDates] = useState<Record<string, boolean>>({});
  const [expandedIncharges, setExpandedIncharges] = useState<Record<string, boolean>>({});
  const [expandedForemen, setExpandedForemen] = useState<Record<string, boolean>>({});

  const [editingRows, setEditingRows] = useState<Record<string, EditingRow>>({});
  const [savingByRow, setSavingByRow] = useState<Record<string, boolean>>({});
  const [deletingByRow, setDeletingByRow] = useState<Record<string, boolean>>({});
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [exportFromDate, setExportFromDate] = useState("");
  const [exportToDate, setExportToDate] = useState("");
  const [exportFormat, setExportFormat] = useState<ExportFormat>("EXCEL");
  const [exportForemanSearch, setExportForemanSearch] = useState("");
  const [selectedExportForeman, setSelectedExportForeman] = useState<User | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportDateError, setExportDateError] = useState("");

  useEffect(() => {
    async function loadData() {
      try {
        const [sheetsRes, usersRes, sitesRes, workersRes] = await Promise.all([
          fetch("/api/attendance/sheets"),
          fetch("/api/users"),
          fetch("/api/sites"),
          fetch("/api/workers"),
        ]);

        if (!sheetsRes.ok || !usersRes.ok || !sitesRes.ok || !workersRes.ok) {
          throw new Error("Failed to load attendance records");
        }

        const [sheets, users, sitesData, workers] = (await Promise.all([
          sheetsRes.json(),
          usersRes.json(),
          sitesRes.json(),
          workersRes.json(),
        ])) as [AttendanceSheet[], User[], Site[], Worker[]];

        const siteNameById = Object.fromEntries(sitesData.map((site) => [site.id, site.name]));
        const userNameById = Object.fromEntries(users.map((user) => [user.id, user.name]));
        const workerNameById = Object.fromEntries(workers.map((worker) => [worker.id, worker.name]));

        const inchargeBySiteId = new Map<string, string>();
        for (const user of users) {
          if (user.role === "SITE_INCHARGE" && user.site_id) {
            const existing = inchargeBySiteId.get(user.site_id);
            inchargeBySiteId.set(user.site_id, existing ? `${existing}, ${user.name}` : user.name);
          }
        }

        const recordsBySheetEntries = await Promise.all(
          sheets.map(async (sheet) => {
            const recordsRes = await fetch(`/api/attendance/records?sheet_id=${sheet.id}`);
            if (!recordsRes.ok) {
              return [sheet.id, [] as AttendanceRecord[]] as const;
            }
            const records = (await recordsRes.json()) as AttendanceRecord[];
            return [sheet.id, records] as const;
          }),
        );

        const recordsBySheet = Object.fromEntries(recordsBySheetEntries);

        const flattenedRows: RecordRow[] = sheets.flatMap((sheet) => {
          const records = recordsBySheet[sheet.id] ?? [];
          return records.map((record) => ({
            id: record.id,
            date: sheet.date,
            workerName: workerNameById[record.worker_id] ?? record.worker_id,
            siteName: siteNameById[sheet.site_id] ?? sheet.site_id,
            siteInchargeName: inchargeBySiteId.get(sheet.site_id) ?? "Unassigned",
            foremanName: userNameById[sheet.foreman_id] ?? sheet.foreman_id,
            present: record.present,
            xValue: record.x_value,
            yValue: record.y_value,
            totalHours: record.total_hours,
            doubleCheck: record.double_check,
            siteId: sheet.site_id,
            foremanId: sheet.foreman_id,
          }));
        });

        setRows(flattenedRows.sort((a, b) => b.date.localeCompare(a.date)));
        setSites(sitesData);
        setForemen(users.filter((user) => user.role === "FOREMAN"));
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Unable to load records");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (appliedFilters.siteFilter !== "ALL" && row.siteId !== appliedFilters.siteFilter) return false;
      if (appliedFilters.foremanFilter !== "ALL" && row.foremanId !== appliedFilters.foremanFilter) return false;
      if (appliedFilters.fromDate && row.date < appliedFilters.fromDate) return false;
      if (appliedFilters.toDate && row.date > appliedFilters.toDate) return false;
      if (appliedFilters.workerSearch && !row.workerName.toLowerCase().includes(appliedFilters.workerSearch.toLowerCase())) return false;
      return true;
    });
  }, [rows, appliedFilters]);

  const groupedRows = useMemo<SiteDateGroup[]>(() => {
    const siteDateMap = new Map<string, Map<string, Map<string, RecordRow[]>>>();

    for (const row of filteredRows) {
      const siteDateKey = `${row.siteId}||${row.siteName}||${row.date}`;
      if (!siteDateMap.has(siteDateKey)) {
        siteDateMap.set(siteDateKey, new Map());
      }

      const inchargeMap = siteDateMap.get(siteDateKey)!;
      const inchargeKey = row.siteInchargeName;
      if (!inchargeMap.has(inchargeKey)) {
        inchargeMap.set(inchargeKey, new Map());
      }

      const foremanMap = inchargeMap.get(inchargeKey)!;
      const foremanKey = `${row.foremanId}||${row.foremanName}`;
      if (!foremanMap.has(foremanKey)) {
        foremanMap.set(foremanKey, []);
      }

      foremanMap.get(foremanKey)!.push(row);
    }

    return [...siteDateMap.entries()]
      .map(([siteDateKey, inchargeMap]) => {
        const [siteId, siteName, date] = siteDateKey.split("||");

        const siteIncharges: SiteInchargeGroup[] = [...inchargeMap.entries()]
          .map(([siteInchargeName, foremanMap]) => {
            const foremen: ForemanGroup[] = [...foremanMap.entries()]
              .map(([foremanKey, records]) => {
                const [foremanId, foremanName] = foremanKey.split("||");
                return {
                  foremanId,
                  foremanName,
                  rows: records.slice().sort((a, b) => a.workerName.localeCompare(b.workerName)),
                };
              })
              .sort((a, b) => a.foremanName.localeCompare(b.foremanName));

            return { siteInchargeName, foremen };
          })
          .sort((a, b) => a.siteInchargeName.localeCompare(b.siteInchargeName));

        return { siteId, siteName, date, siteIncharges };
      })
      .sort((a, b) => {
        const dateCmp = b.date.localeCompare(a.date);
        if (dateCmp !== 0) return dateCmp;
        return a.siteName.localeCompare(b.siteName);
      });
  }, [filteredRows]);

  const exportForemanSuggestions = useMemo(() => {
    const query = exportForemanSearch.trim().toLowerCase();
    if (!query) return [];

    return foremen
      .filter((foreman) => foreman.name.toLowerCase().includes(query))
      .slice(0, 6);
  }, [exportForemanSearch, foremen]);

  const applyFilters = () => {
    setAppliedFilters(filterInputs);
  };

  const clearFilters = () => {
    setFilterInputs(defaultFilters);
    setAppliedFilters(defaultFilters);
  };

  const toggleEdit = (row: RecordRow) => {
    setEditingRows((prev) => {
      if (prev[row.id]) {
        const updated = { ...prev };
        delete updated[row.id];
        return updated;
      }
      return { ...prev, [row.id]: { xValue: row.xValue, yValue: row.yValue, present: row.present } };
    });
  };

  const updateEditingValue = (rowId: string, field: "xValue" | "yValue" | "present", value: number | boolean) => {
    setEditingRows((prev) => {
      const edited = prev[rowId];
      if (!edited) return prev;

      if (field === "present") {
        return {
          ...prev,
          [rowId]: { ...edited, present: value as boolean },
        };
      }

      const numValue = Number.isFinite(value) ? Math.max(0, value as number) : 0;
      return {
        ...prev,
        [rowId]: { ...edited, [field]: numValue },
      };
    });
  };

  const saveRow = async (rowId: string) => {
    const edit = editingRows[rowId];
    if (!edit) return;

    const targetRow = rows.find((row) => row.id === rowId);
    const isPresent = edit.present !== undefined ? edit.present : targetRow?.present;

    if (isPresent && edit.xValue === 0 && edit.yValue === 0) {
      toast.error("You cannot save this record while status is Present with X=0 and Y=0. Please enter X or Y above 0.");
      return;
    }

    try {
      setSavingByRow((prev) => ({ ...prev, [rowId]: true }));
      const response = await fetch("/api/attendance/records", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          record_id: rowId,
          x_value: edit.xValue,
          y_value: edit.yValue,
          present: edit.present !== undefined ? edit.present : undefined,
        }),
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "Failed to update record");
      }

      const updated = (await response.json()) as AttendanceRecord;

      setRows((prev) =>
        prev.map((row) =>
          row.id === rowId
            ? {
                ...row,
                xValue: updated.x_value,
                yValue: updated.y_value,
                totalHours: updated.total_hours,
                present: updated.present,
              }
            : row,
        ),
      );

      setEditingRows((prev) => {
        const updatedState = { ...prev };
        delete updatedState[rowId];
        return updatedState;
      });

      toast.success("Attendance record updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update record");
    } finally {
      setSavingByRow((prev) => ({ ...prev, [rowId]: false }));
    }
  };

  const deleteRow = async (row: RecordRow) => {
    const confirmDelete = window.confirm(`Delete attendance entry for ${row.workerName} on ${formatDate(row.date)}?`);
    if (!confirmDelete) return;

    try {
      setDeletingByRow((prev) => ({ ...prev, [row.id]: true }));
      const response = await fetch("/api/attendance/records", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ record_id: row.id }),
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "Failed to delete record");
      }

      setRows((prev) => prev.filter((entry) => entry.id !== row.id));
      setEditingRows((prev) => {
        const updated = { ...prev };
        delete updated[row.id];
        return updated;
      });
      toast.success("Attendance entry deleted");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to delete record");
    } finally {
      setDeletingByRow((prev) => ({ ...prev, [row.id]: false }));
    }
  };

  const openExportModal = () => {
    const today = toIsoDate(new Date());
    setExportFromDate(appliedFilters.fromDate || today);
    setExportToDate(appliedFilters.toDate || today);
    setExportDateError("");

    if (appliedFilters.foremanFilter !== "ALL") {
      const activeForeman = foremen.find((item) => item.id === appliedFilters.foremanFilter) ?? null;
      setSelectedExportForeman(activeForeman);
      setExportForemanSearch(activeForeman?.name ?? "");
    } else {
      setSelectedExportForeman(null);
      setExportForemanSearch("");
    }

    setExportFormat("EXCEL");
    setIsExportOpen(true);
  };

  const exportNow = async () => {
    if (!exportFromDate || !exportToDate) {
      toast.error("Please select both From and To dates");
      return;
    }

    if (exportDateError || exportFromDate > exportToDate) {
      toast.error("From date cannot be after To date");
      return;
    }

    try {
      setIsExporting(true);
      const params = new URLSearchParams({ from: exportFromDate, to: exportToDate });
      if (selectedExportForeman) {
        params.set("foreman_id", selectedExportForeman.id);
      }

      const response = await fetch(`/api/attendance/export?${params.toString()}`);
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "Failed to prepare export");
      }

      const payload = (await response.json()) as PivotExportResponse;
      const dateStamp = format(new Date(), "yyyyMMdd_HHmm");
      const foremanLabel = selectedExportForeman?.name.replace(/\s+/g, "_") ?? "All_Foremen";
      const fileBase = `${foremanLabel}_${payload.from}_to_${payload.to}_${dateStamp}`;

      if (exportFormat === "CSV") {
        const csv = buildCsv(payload);
        triggerDownload(new Blob([csv], { type: "text/csv;charset=utf-8" }), `${fileBase}.csv`);
      } else if (exportFormat === "EXCEL") {
        const excelBlob = await buildExcel(payload);
        triggerDownload(excelBlob, `${fileBase}.xlsx`);
      } else {
        const pdfBlob = buildPdf(payload);
        triggerDownload(pdfBlob, `${fileBase}.pdf`);
      }

      setIsExportOpen(false);
      toast.success("Export downloaded successfully");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Export failed");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <PageHeader title="Attendance Records" subtitle="Grouped by Site + Date → Site Incharge → Foreman" />
        <Button type="button" onClick={openExportModal} className="w-full md:mt-1 md:w-auto">
          <Download className="mr-2 h-4 w-4" />
          Export
        </Button>
      </div>

      <GlassCard>
        <div className="grid gap-3 md:grid-cols-7">
          <div className="space-y-1">
            <p className="text-xs font-medium text-slate-500">Worker Name</p>
            <Input
              type="text"
              placeholder="Search worker..."
              value={filterInputs.workerSearch}
              onChange={(event) => setFilterInputs((prev) => ({ ...prev, workerSearch: event.target.value }))}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  applyFilters();
                }
              }}
            />
          </div>

          <div className="space-y-1">
            <p className="text-xs font-medium text-slate-500">Site</p>
            <Select value={filterInputs.siteFilter} onValueChange={(value) => setFilterInputs((prev) => ({ ...prev, siteFilter: value ?? "ALL" }))}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All sites" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All sites</SelectItem>
                {sites.map((site) => (
                  <SelectItem key={site.id} value={site.id}>
                    {site.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <p className="text-xs font-medium text-slate-500">Foreman</p>
            <Select value={filterInputs.foremanFilter} onValueChange={(value) => setFilterInputs((prev) => ({ ...prev, foremanFilter: value ?? "ALL" }))}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All foremen" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All foremen</SelectItem>
                {foremen.map((foreman) => (
                  <SelectItem key={foreman.id} value={foreman.id}>
                    {foreman.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <p className="text-xs font-medium text-slate-500">From</p>
            <Input 
              type="date" 
              value={filterInputs.fromDate} 
              onChange={(event) => {
                setFilterInputs((prev) => ({ ...prev, fromDate: event.target.value }));
                setAppliedFilters((prev) => ({ ...prev, fromDate: event.target.value }));
              }} 
            />
          </div>

          <div className="space-y-1">
            <p className="text-xs font-medium text-slate-500">To</p>
            <Input 
              type="date" 
              value={filterInputs.toDate} 
              onChange={(event) => {
                setFilterInputs((prev) => ({ ...prev, toDate: event.target.value }));
                setAppliedFilters((prev) => ({ ...prev, toDate: event.target.value }));
              }} 
            />
          </div>

          <div className="flex items-end">
            <Button type="button" className="w-full" onClick={applyFilters}>
              <Search className="mr-2 h-4 w-4" />
              Search
            </Button>
          </div>

          <div className="flex items-end">
            <Button type="button" variant="outline" className="w-full" onClick={clearFilters}>
              Clear Filters
            </Button>
          </div>
        </div>
      </GlassCard>

      <GlassCard>
        {loading ? (
          <PageLoadingSkeleton rows={6} />
        ) : groupedRows.length === 0 ? (
          <p className="text-sm text-slate-500">No records found for selected filters.</p>
        ) : (
          <div className="space-y-3">
            {groupedRows.map((siteDateGroup) => {
              const siteDateKey = `${siteDateGroup.siteId}|${siteDateGroup.date}`;
              const isSiteDateExpanded = expandedSiteDates[siteDateKey] ?? false;
              const siteDateCount = siteDateGroup.siteIncharges.reduce(
                (sum, incharge) => sum + incharge.foremen.reduce((inner, foreman) => inner + foreman.rows.length, 0),
                0,
              );

              return (
                <div key={siteDateKey} className="rounded-xl border border-slate-200 bg-white/70">
                  <button
                    type="button"
                    onClick={() => setExpandedSiteDates((prev) => ({ ...prev, [siteDateKey]: !isSiteDateExpanded }))}
                    className="flex w-full items-center justify-between px-4 py-3 text-left"
                  >
                    <div className="flex items-center gap-2">
                      {isSiteDateExpanded ? <ChevronDown className="h-4 w-4 text-slate-500" /> : <ChevronRight className="h-4 w-4 text-slate-500" />}
                      <p className="font-semibold text-slate-800">
                        {siteDateGroup.siteName} · {formatDate(siteDateGroup.date)}
                      </p>
                    </div>
                    <p className="text-xs text-slate-500">{siteDateCount} records</p>
                  </button>

                  {isSiteDateExpanded && (
                    <div className="space-y-2 border-t border-slate-100 p-3">
                      {siteDateGroup.siteIncharges.map((incharge) => {
                        const inchargeKey = `${siteDateKey}|${incharge.siteInchargeName}`;
                        const isInchargeExpanded = expandedIncharges[inchargeKey] ?? false;
                        const inchargeCount = incharge.foremen.reduce((sum, foreman) => sum + foreman.rows.length, 0);

                        return (
                          <div key={inchargeKey} className="rounded-lg border border-slate-200 bg-white/80">
                            <button
                              type="button"
                              onClick={() => setExpandedIncharges((prev) => ({ ...prev, [inchargeKey]: !isInchargeExpanded }))}
                              className="flex w-full items-center justify-between px-3 py-2 text-left"
                            >
                              <div className="flex items-center gap-2">
                                {isInchargeExpanded ? <ChevronDown className="h-4 w-4 text-slate-500" /> : <ChevronRight className="h-4 w-4 text-slate-500" />}
                                <p className="text-sm font-semibold text-slate-800">{incharge.siteInchargeName}</p>
                              </div>
                              <p className="text-xs text-slate-500">{inchargeCount} records</p>
                            </button>

                            {isInchargeExpanded && (
                              <div className="space-y-2 border-t border-slate-100 p-2">
                                {incharge.foremen.map((foreman) => {
                                  const foremanKey = `${inchargeKey}|${foreman.foremanId}`;
                                  const isForemanExpanded = expandedForemen[foremanKey] ?? false;

                                  return (
                                    <div key={foremanKey} className="rounded-md border border-slate-200 bg-white">
                                      <button
                                        type="button"
                                        onClick={() => setExpandedForemen((prev) => ({ ...prev, [foremanKey]: !isForemanExpanded }))}
                                        className="flex w-full items-center justify-between px-3 py-2 text-left"
                                      >
                                        <div className="flex items-center gap-2">
                                          {isForemanExpanded ? <ChevronDown className="h-4 w-4 text-slate-500" /> : <ChevronRight className="h-4 w-4 text-slate-500" />}
                                          <p className="text-sm font-medium text-slate-700">{foreman.foremanName}</p>
                                        </div>
                                        <p className="text-xs text-slate-500">{foreman.rows.length} workers</p>
                                      </button>

                                      {isForemanExpanded && (
                                        <div className="overflow-x-auto border-t border-slate-100 p-2">
                                          <table className="w-full min-w-[760px] text-sm">
                                            <thead>
                                              <tr className="border-b border-slate-200 text-left">
                                                <th className="pb-2 pr-3 text-xs uppercase tracking-wide text-slate-500">Worker</th>
                                                <th className="pb-2 pr-3 text-xs uppercase tracking-wide text-slate-500">P/A</th>
                                                <th className="pb-2 pr-3 text-xs uppercase tracking-wide text-slate-500">X</th>
                                                <th className="pb-2 pr-3 text-xs uppercase tracking-wide text-slate-500">Y</th>
                                                <th className="pb-2 pr-3 text-xs uppercase tracking-wide text-slate-500">Total</th>
                                                <th className="pb-2 pr-3 text-xs uppercase tracking-wide text-slate-500">Double Check</th>
                                                <th className="pb-2 text-xs uppercase tracking-wide text-slate-500">Actions</th>
                                              </tr>
                                            </thead>
                                            <tbody>
                                              {foreman.rows.map((row) => {
                                                const isEditing = !!editingRows[row.id];
                                                const isSaving = !!savingByRow[row.id];
                                                const isDeleting = !!deletingByRow[row.id];
                                                const editValue = editingRows[row.id];
                                                const displayPresent = editValue?.present !== undefined ? editValue.present : row.present;

                                                return (
                                                  <tr key={row.id} className="border-b border-slate-100 last:border-0">
                                                    <td className="py-2 pr-3">{row.workerName}</td>
                                                    <td className="py-2 pr-3">
                                                      {isEditing ? (
                                                        <button
                                                          type="button"
                                                          onClick={() => updateEditingValue(row.id, "present", !displayPresent)}
                                                          className={`rounded px-2 py-1 text-xs font-bold text-white ${displayPresent ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"}`}
                                                          disabled={isSaving || isDeleting}
                                                        >
                                                          {displayPresent ? "P" : "A"}
                                                        </button>
                                                      ) : (
                                                        <span className={`inline-block rounded px-2 py-1 text-xs font-bold text-white ${row.present ? "bg-green-600" : "bg-red-600"}`}>
                                                          {row.present ? "P" : "A"}
                                                        </span>
                                                      )}
                                                    </td>
                                                    <td className="py-2 pr-3">
                                                      {isEditing ? (
                                                        <Input
                                                          type="number"
                                                          min={0}
                                                          value={editValue?.xValue ?? 0}
                                                          onChange={(event) => updateEditingValue(row.id, "xValue", Number(event.target.value))}
                                                          className="h-8 w-20"
                                                          disabled={isSaving || isDeleting || !displayPresent}
                                                        />
                                                      ) : (
                                                        row.xValue
                                                      )}
                                                    </td>
                                                    <td className="py-2 pr-3">
                                                      {isEditing ? (
                                                        <Input
                                                          type="number"
                                                          min={0}
                                                          value={editValue?.yValue ?? 0}
                                                          onChange={(event) => updateEditingValue(row.id, "yValue", Number(event.target.value))}
                                                          className="h-8 w-20"
                                                          disabled={isSaving || isDeleting || !displayPresent}
                                                        />
                                                      ) : (
                                                        row.yValue
                                                      )}
                                                    </td>
                                                    <td className="py-2 pr-3">{row.totalHours}</td>
                                                    <td className="py-2 pr-3">{row.doubleCheck ? "Yes" : "No"}</td>
                                                    <td className="py-2">
                                                      {isEditing ? (
                                                        <div className="flex items-center gap-2">
                                                          <Button
                                                            type="button"
                                                            size="icon"
                                                            variant="outline"
                                                            className="h-8 w-8"
                                                            onClick={() => saveRow(row.id)}
                                                            disabled={isSaving || isDeleting}
                                                          >
                                                            <Check className="h-4 w-4 text-green-600" />
                                                          </Button>
                                                          <Button
                                                            type="button"
                                                            size="icon"
                                                            variant="outline"
                                                            className="h-8 w-8"
                                                            onClick={() => toggleEdit(row)}
                                                            disabled={isSaving || isDeleting}
                                                          >
                                                            <X className="h-4 w-4 text-red-600" />
                                                          </Button>
                                                        </div>
                                                      ) : (
                                                        <div className="flex items-center gap-2">
                                                          <Button
                                                            type="button"
                                                            size="icon"
                                                            variant="outline"
                                                            className="h-8 w-8"
                                                            onClick={() => toggleEdit(row)}
                                                            disabled={isDeleting}
                                                          >
                                                            <Pencil className="h-4 w-4" />
                                                          </Button>
                                                          <Button
                                                            type="button"
                                                            size="icon"
                                                            variant="outline"
                                                            className="h-8 w-8"
                                                            onClick={() => deleteRow(row)}
                                                            disabled={isDeleting}
                                                          >
                                                            <Trash2 className="h-4 w-4 text-red-600" />
                                                          </Button>
                                                        </div>
                                                      )}
                                                    </td>
                                                  </tr>
                                                );
                                              })}
                                            </tbody>
                                          </table>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </GlassCard>

      <Dialog open={isExportOpen} onOpenChange={setIsExportOpen}>
        <DialogContent className="max-w-lg rounded-2xl border border-black bg-white p-5 text-black shadow-none">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-black">Export Attendance</DialogTitle>
            <DialogDescription className="text-sm text-neutral-600">
              Choose date range, optional foreman, and file format.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-600">From date</p>
                <Input
                  type="date"
                  value={exportFromDate}
                  max={exportToDate || undefined}
                  onChange={(event) => {
                    const nextFromDate = event.target.value;
                    setExportFromDate(nextFromDate);

                    if (exportToDate && nextFromDate && exportToDate < nextFromDate) {
                      setExportToDate(nextFromDate);
                      setExportDateError("To Date cannot be earlier than From Date. It has been adjusted automatically.");
                      return;
                    }

                    setExportDateError("");
                  }}
                  className="h-12 w-full min-w-0 border-black/30 px-4 text-base text-black"
                />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-600">To date</p>
                <Input
                  type="date"
                  value={exportToDate}
                  min={exportFromDate || undefined}
                  onChange={(event) => {
                    const nextToDate = event.target.value;
                    setExportToDate(nextToDate);

                    if (exportFromDate && nextToDate && nextToDate < exportFromDate) {
                      setExportDateError("To Date cannot be earlier than From Date.");
                      return;
                    }

                    setExportDateError("");
                  }}
                  aria-invalid={!!exportDateError}
                  className="h-12 w-full min-w-0 border-black/30 px-4 text-base text-black"
                />
              </div>
            </div>

            {exportDateError ? <p className="text-xs font-medium text-black">{exportDateError}</p> : null}

            <div className="relative space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-600">Foreman (optional)</p>
              <Input
                type="text"
                value={exportForemanSearch}
                onChange={(event) => {
                  setExportForemanSearch(event.target.value);
                  setSelectedExportForeman(null);
                }}
                placeholder="Search foreman by name"
                className="border-black/30 text-black"
              />

              {selectedExportForeman ? (
                <div className="flex items-center justify-between rounded-md border border-black/20 bg-white px-3 py-2 text-sm">
                  <span>Selected: {selectedExportForeman.name}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedExportForeman(null);
                      setExportForemanSearch("");
                    }}
                    className="text-xs font-semibold text-black"
                  >
                    Clear
                  </button>
                </div>
              ) : null}

              {!selectedExportForeman && exportForemanSuggestions.length > 0 ? (
                <div className="absolute z-20 mt-1 w-full rounded-md border border-black/20 bg-white p-1 shadow-sm">
                  {exportForemanSuggestions.map((foreman) => (
                    <button
                      key={foreman.id}
                      type="button"
                      onClick={() => {
                        setSelectedExportForeman(foreman);
                        setExportForemanSearch(foreman.name);
                      }}
                      className="block w-full rounded px-2 py-2 text-left text-sm text-black hover:bg-neutral-100"
                    >
                      {foreman.name}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-600">File format</p>
              <Select value={exportFormat} onValueChange={(value) => setExportFormat(value as ExportFormat)}>
                <SelectTrigger className="border-black/30 text-black">
                  <SelectValue placeholder="Select file format" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CSV">CSV</SelectItem>
                  <SelectItem value="EXCEL">Excel</SelectItem>
                  <SelectItem value="PDF">PDF</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="-mx-5 -mb-5 border-t border-black/10 bg-white px-5 py-4">
            <Button
              type="button"
              variant="outline"
              className="border-black text-black"
              onClick={() => setIsExportOpen(false)}
              disabled={isExporting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={exportNow}
              className="bg-black text-white hover:bg-black/90"
              disabled={isExporting || !!exportDateError}
            >
              {isExporting ? "Exporting..." : "Export Now"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
