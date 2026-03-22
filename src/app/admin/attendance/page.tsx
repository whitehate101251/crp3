"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Calendar as CalendarIcon } from "lucide-react";
import { toast } from "sonner";
import { GlassCard } from "@/components/shared/glass-card";
import { PageLoadingSkeleton } from "@/components/shared/page-loading-skeleton";
import { PageHeader } from "@/components/shared/page-header";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  Calendar,
} from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { STATUS_LABELS } from "@/lib/constants";
import { cn, formatDate, getStatusColor } from "@/lib/utils";
import type { AttendanceRecord, AttendanceSheet, Site, User, Worker } from "@/lib/types";

const PAGE_SIZE = 10;

type SheetView = AttendanceSheet & {
  siteName: string;
  foremanName: string;
  workerCount: number;
};

export default function AdminAttendancePage() {
  const [allSheets, setAllSheets] = useState<AttendanceSheet[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [recordsBySheet, setRecordsBySheet] = useState<Record<string, AttendanceRecord[]>>({});
  const [expandedSheetIds, setExpandedSheetIds] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  const [siteFilter, setSiteFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [dateFilter, setDateFilter] = useState<string>("");
  const [dateOpen, setDateOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    async function loadData() {
      try {
        const [sheetRes, sitesRes, usersRes, workersRes] = await Promise.all([
          fetch("/api/attendance/sheets"),
          fetch("/api/sites"),
          fetch("/api/users"),
          fetch("/api/workers"),
        ]);

        if (!sheetRes.ok || !sitesRes.ok || !usersRes.ok || !workersRes.ok) {
          throw new Error("Failed to load attendance data");
        }

        const [sheetData, sitesData, usersData, workersData] = (await Promise.all([
          sheetRes.json(),
          sitesRes.json(),
          usersRes.json(),
          workersRes.json(),
        ])) as [AttendanceSheet[], Site[], User[], Worker[]];

        const sheetIds = sheetData.map((sheet) => sheet.id);
        const recordsEntries = await Promise.all(
          sheetIds.map(async (sheetId) => {
            const response = await fetch(`/api/attendance/records?sheet_id=${sheetId}`);
            if (!response.ok) return [sheetId, []] as const;
            const records = (await response.json()) as AttendanceRecord[];
            return [sheetId, records] as const;
          })
        );

        setAllSheets(sheetData.sort((a, b) => b.date.localeCompare(a.date)));
        setSites(sitesData);
        setUsers(usersData);
        setWorkers(workersData);
        setRecordsBySheet(Object.fromEntries(recordsEntries));
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Unable to load attendance");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  const siteNameById = useMemo(() => Object.fromEntries(sites.map((site) => [site.id, site.name])), [sites]);
  const userNameById = useMemo(() => Object.fromEntries(users.map((user) => [user.id, user.name])), [users]);
  const workerNameById = useMemo(() => Object.fromEntries(workers.map((worker) => [worker.id, worker.name])), [workers]);

  const filteredSheets = useMemo(() => {
    return allSheets.filter((sheet) => {
      if (siteFilter !== "ALL" && sheet.site_id !== siteFilter) return false;
      if (statusFilter !== "ALL" && sheet.status !== statusFilter) return false;
      if (dateFilter && sheet.date !== dateFilter) return false;
      return true;
    });
  }, [allSheets, siteFilter, statusFilter, dateFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredSheets.length / PAGE_SIZE));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const pagedSheets = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredSheets.slice(start, start + PAGE_SIZE).map((sheet) => ({
      ...sheet,
      siteName: siteNameById[sheet.site_id] ?? sheet.site_id,
      foremanName: userNameById[sheet.foreman_id] ?? sheet.foreman_id,
      workerCount: recordsBySheet[sheet.id]?.length ?? 0,
    })) as SheetView[];
  }, [currentPage, filteredSheets, recordsBySheet, siteNameById, userNameById]);

  const toggleExpand = (sheetId: string) => {
    setExpandedSheetIds((prev) => ({ ...prev, [sheetId]: !prev[sheetId] }));
  };

  const clearFilters = () => {
    setSiteFilter("ALL");
    setStatusFilter("ALL");
    setDateFilter("");
    setCurrentPage(1);
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Attendance" subtitle="All attendance sheets" />

      <GlassCard>
        <div className="grid gap-3 md:grid-cols-5">
          <div className="space-y-1">
            <p className="text-xs font-medium text-slate-500">Site</p>
            <Select
              value={siteFilter}
              onValueChange={(value) => {
                setSiteFilter(value ?? "ALL");
                setCurrentPage(1);
              }}
            >
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
            <p className="text-xs font-medium text-slate-500">Date</p>
            <Popover open={dateOpen} onOpenChange={setDateOpen}>
              <PopoverTrigger className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center justify-between">
                <span>{dateFilter ? formatDate(dateFilter) : "Select date"}</span>
                <CalendarIcon className="h-4 w-4 text-slate-500" />
              </PopoverTrigger>
              <PopoverContent align="start">
                <Calendar
                  mode="single"
                  selected={dateFilter ? new Date(dateFilter + "T00:00:00") : undefined}
                  onSelect={(date) => {
                    if (date) {
                      const year = date.getFullYear();
                      const month = String(date.getMonth() + 1).padStart(2, "0");
                      const day = String(date.getDate()).padStart(2, "0");
                      const isoDate = `${year}-${month}-${day}`;
                      setDateFilter(isoDate);
                      setCurrentPage(1);
                      setDateOpen(false);
                    }
                  }}
                />
                {dateFilter && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full mt-2"
                    onClick={() => {
                      setDateFilter("");
                      setCurrentPage(1);
                      setDateOpen(false);
                    }}
                  >
                    Clear Date
                  </Button>
                )}
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-1">
            <p className="text-xs font-medium text-slate-500">Status</p>
            <Select
              value={statusFilter}
              onValueChange={(value) => {
                setStatusFilter(value ?? "ALL");
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All status</SelectItem>
                <SelectItem value="SENT_TO_SI">{STATUS_LABELS.SENT_TO_SI}</SelectItem>
                <SelectItem value="SENT_TO_ADMIN">{STATUS_LABELS.SENT_TO_ADMIN}</SelectItem>
                <SelectItem value="APPROVED">{STATUS_LABELS.APPROVED}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-end gap-2">
            <Button type="button" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white" onClick={() => setCurrentPage(1)}>
              Search
            </Button>
            <Button type="button" variant="outline" className="flex-1" onClick={clearFilters}>
              Clear Filters
            </Button>
          </div>
        </div>
      </GlassCard>

      <GlassCard>
        {loading ? (
          <PageLoadingSkeleton rows={5} />
        ) : filteredSheets.length === 0 ? (
          <p className="text-sm text-slate-500">No attendance sheets found for current filters.</p>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Site</TableHead>
                  <TableHead>Foreman</TableHead>
                  <TableHead>Workers</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagedSheets.map((sheet) => {
                  const expanded = !!expandedSheetIds[sheet.id];
                  const records = recordsBySheet[sheet.id] ?? [];
                  return (
                    <Fragment key={sheet.id}>
                      <TableRow
                        className="cursor-pointer"
                        onClick={() => toggleExpand(sheet.id)}
                      >
                        <TableCell>{formatDate(sheet.date)}</TableCell>
                        <TableCell>{sheet.siteName}</TableCell>
                        <TableCell>{sheet.foremanName}</TableCell>
                        <TableCell>{sheet.workerCount}</TableCell>
                        <TableCell>
                          <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-semibold", getStatusColor(sheet.status))}>
                            {STATUS_LABELS[sheet.status]}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="inline-flex items-center gap-1 text-sm text-slate-600">
                            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            {expanded ? "Hide" : "View"}
                          </span>
                        </TableCell>
                      </TableRow>

                      {expanded && (
                        <TableRow>
                          <TableCell colSpan={6} className="bg-slate-50/70">
                            <div className="space-y-2">
                              <p className="text-xs font-medium text-slate-500">
                                Records · In {sheet.in_time ?? "--:--"} · Out {sheet.out_time ?? "--:--"}
                              </p>
                              <div className="overflow-x-auto">
                                <table className="w-full min-w-[700px] text-sm">
                                  <thead>
                                    <tr className="border-b border-slate-200 text-left">
                                      <th className="pb-2 pr-3 text-xs uppercase tracking-wide text-slate-500">Worker Name</th>
                                      <th className="pb-2 pr-3 text-xs uppercase tracking-wide text-slate-500">P/A</th>
                                      <th className="pb-2 pr-3 text-xs uppercase tracking-wide text-slate-500">X</th>
                                      <th className="pb-2 pr-3 text-xs uppercase tracking-wide text-slate-500">Y</th>
                                      <th className="pb-2 pr-3 text-xs uppercase tracking-wide text-slate-500">Total Hrs</th>
                                      <th className="pb-2 text-xs uppercase tracking-wide text-slate-500">Double Check</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {records.map((record) => (
                                      <tr key={record.id} className="border-b border-slate-100 last:border-0">
                                        <td className="py-2 pr-3">{workerNameById[record.worker_id] ?? record.worker_id}</td>
                                        <td className="py-2 pr-3">
                                          <span className={`inline-block rounded px-2 py-1 text-xs font-bold text-white ${record.present ? "bg-green-600" : "bg-red-600"}`}>
                                            {record.present ? "P" : "A"}
                                          </span>
                                        </td>
                                        <td className="py-2 pr-3">{record.x_value}</td>
                                        <td className="py-2 pr-3">{record.y_value}</td>
                                        <td className="py-2 pr-3">{record.total_hours}</td>
                                        <td className="py-2">{record.double_check ? "Yes" : "No"}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>

            <div className="mt-4 flex items-center justify-between gap-3">
              <p className="text-xs text-slate-500">
                Page {currentPage} of {totalPages} · {filteredSheets.length} total sheet{filteredSheets.length !== 1 ? "s" : ""}
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                >
                  Previous
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        )}
      </GlassCard>
    </div>
  );
}
