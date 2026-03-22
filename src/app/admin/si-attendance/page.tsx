"use client";

import { useEffect, useMemo, useState } from "react";
import { Calendar as CalendarIcon } from "lucide-react";
import { toast } from "sonner";
import { GlassCard } from "@/components/shared/glass-card";
import { PageHeader } from "@/components/shared/page-header";
import { PageLoadingSkeleton } from "@/components/shared/page-loading-skeleton";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
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
import { formatDate } from "@/lib/utils";
import type { SIAttendanceEntry } from "@/lib/types";

const toLocalDateString = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const parseLocalDate = (value: string) => {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
};

const TODAY = toLocalDateString(new Date());

export default function AdminSIAttendancePage() {
  const [entries, setEntries] = useState<SIAttendanceEntry[]>([]);
  const [selectedDate, setSelectedDate] = useState(TODAY);
  const [manualDateInput, setManualDateInput] = useState(TODAY);
  const [dateOpen, setDateOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadEntries() {
      try {
        setLoading(true);
        const response = await fetch(`/api/attendance/si-attendance?date=${selectedDate}`);
        if (!response.ok) {
          throw new Error("Failed to load SI attendance");
        }

        const data = (await response.json()) as SIAttendanceEntry[];
        setEntries(data.sort((a, b) => a.name.localeCompare(b.name)));
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Unable to load SI attendance");
      } finally {
        setLoading(false);
      }
    }

    loadEntries();
  }, [selectedDate]);

  const summary = useMemo(() => {
    const present = entries.filter((entry) => entry.status === "PRESENT").length;
    const absent = entries.filter((entry) => entry.status === "ABSENT").length;
    return { present, absent };
  }, [entries]);

  const applyManualDate = () => {
    if (!manualDateInput) {
      toast.error("Please select a valid date");
      return;
    }
    setSelectedDate(manualDateInput);
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="SI Attendance"
        subtitle="Site Incharge self-attendance history"
      />

      <GlassCard>
        <div className="grid gap-3 md:grid-cols-[1fr_220px_auto]">
          <div className="space-y-1">
            <p className="text-xs font-medium text-slate-500">History Date</p>
            <Popover open={dateOpen} onOpenChange={setDateOpen}>
              <PopoverTrigger className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center justify-between">
                <span>{selectedDate ? formatDate(selectedDate) : "Select date"}</span>
                <CalendarIcon className="h-4 w-4 text-slate-500" />
              </PopoverTrigger>
              <PopoverContent align="start">
                <Calendar
                  mode="single"
                  selected={selectedDate ? parseLocalDate(selectedDate) : undefined}
                  onSelect={(date) => {
                    if (!date) return;
                    const isoDate = toLocalDateString(date);
                    setSelectedDate(isoDate);
                    setManualDateInput(isoDate);
                    setDateOpen(false);
                  }}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-1">
            <p className="text-xs font-medium text-slate-500">Manual Date</p>
            <Input
              type="date"
              value={manualDateInput}
              onChange={(event) => setManualDateInput(event.target.value)}
            />
          </div>

          <div className="flex items-end">
            <Button type="button" className="w-full md:w-auto" onClick={applyManualDate}>
              Load Date
            </Button>
          </div>
        </div>
      </GlassCard>

      <GlassCard>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-slate-800">
            Attendance on {formatDate(selectedDate)}
          </p>
          <div className="flex items-center gap-2 text-xs font-semibold">
            <span className="rounded-full bg-green-100 px-2.5 py-1 text-green-700">
              Present: {summary.present}
            </span>
            <span className="rounded-full bg-red-100 px-2.5 py-1 text-red-700">
              Absent: {summary.absent}
            </span>
          </div>
        </div>

        {loading ? (
          <PageLoadingSkeleton rows={4} />
        ) : entries.length === 0 ? (
          <p className="text-sm text-slate-500">No Site Incharge users found for this date.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Father Name</TableHead>
                <TableHead>Phone Number</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell>{formatDate(entry.date)}</TableCell>
                  <TableCell className="font-medium text-slate-800">{entry.name}</TableCell>
                  <TableCell>{entry.father_name ?? "—"}</TableCell>
                  <TableCell>{entry.phone_number ?? "—"}</TableCell>
                  <TableCell>
                    <span
                      className={
                        entry.status === "PRESENT"
                          ? "inline-flex rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-700"
                          : "inline-flex rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700"
                      }
                    >
                      {entry.status === "PRESENT" ? "Present" : "Absent"}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </GlassCard>
    </div>
  );
}
