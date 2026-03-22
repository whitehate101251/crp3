"use client";

import { useEffect, useRef, useState } from "react";
import { Clock3 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface TimePickerProps {
  value: string; // "HH:MM"
  onChange: (value: string) => void;
  label?: string;
  id?: string;
}

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0"));

export function TimePicker({ value, onChange, label, id }: TimePickerProps) {
  const [open, setOpen] = useState(false);

  const [parsedHour = "09", rawMinute = "00"] = value.split(":");
  const parsedMinuteNumber = Number.parseInt(rawMinute, 10);
  const minuteStep = Math.round((Number.isNaN(parsedMinuteNumber) ? 0 : parsedMinuteNumber) / 5) * 5;
  const hour = parsedHour;
  const minute = String(minuteStep === 60 ? 55 : minuteStep).padStart(2, "0");

  const hourListRef = useRef<HTMLDivElement>(null);
  const minuteListRef = useRef<HTMLDivElement>(null);

  function scrollToSelected(container: HTMLDivElement | null, selectedValue: string) {
    if (!container) return;
    const el = container.querySelector<HTMLButtonElement>(`[data-value="${selectedValue}"]`);
    if (el) {
      el.scrollIntoView({ block: "center", behavior: "instant" });
    }
  }

  // Scroll selected item into view when popover opens
  useEffect(() => {
    if (!open) return;
    requestAnimationFrame(() => {
      scrollToSelected(hourListRef.current, hour);
      scrollToSelected(minuteListRef.current, minute);
    });
  }, [open, hour, minute]);

  function selectHour(h: string) {
    onChange(`${h}:${minute}`);
  }

  function selectMinute(m: string) {
    onChange(`${hour}:${m}`);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        id={id}
        className={cn(
          "flex h-11 w-full items-center gap-2 rounded-md border border-slate-200 bg-white/70 px-3 text-sm font-medium text-slate-800",
          "shadow-sm transition-all hover:border-slate-300 hover:bg-white focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-1",
        )}
        aria-label={label ?? "Select time"}
      >
        <Clock3 className="h-4 w-4 shrink-0 text-slate-400" />
        <span className="flex-1 text-left tabular-nums">
          {hour}:{minute}
        </span>
        <span className="text-xs text-slate-400">{parseInt(hour, 10) < 12 ? "AM" : "PM"}</span>
      </PopoverTrigger>

      <PopoverContent
        className="w-52 p-0 shadow-xl"
        align="start"
        sideOffset={6}
      >
        <div className="flex divide-x divide-slate-100 overflow-hidden rounded-lg">
          {/* Hour column */}
          <div className="flex flex-1 flex-col">
            <div className="border-b border-slate-100 bg-slate-50 py-1.5 text-center text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Hour
            </div>
            <div
              ref={hourListRef}
              className="h-52 overflow-y-auto overscroll-contain scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {HOURS.map((h) => (
                <button
                  key={h}
                  data-value={h}
                  type="button"
                  onClick={() => selectHour(h)}
                  className={cn(
                    "w-full py-2 text-center text-sm transition-colors",
                    h === hour
                      ? "bg-slate-900 font-semibold text-white"
                      : "text-slate-700 hover:bg-slate-100",
                  )}
                >
                  {h}
                </button>
              ))}
            </div>
          </div>

          {/* Minute column */}
          <div className="flex flex-1 flex-col">
            <div className="border-b border-slate-100 bg-slate-50 py-1.5 text-center text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Min
            </div>
            <div
              ref={minuteListRef}
              className="h-52 overflow-y-auto overscroll-contain scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {MINUTES.map((m) => (
                <button
                  key={m}
                  data-value={m}
                  type="button"
                  onClick={() => selectMinute(m)}
                  className={cn(
                    "w-full py-2 text-center text-sm transition-colors",
                    m === minute
                      ? "bg-slate-900 font-semibold text-white"
                      : "text-slate-700 hover:bg-slate-100",
                  )}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="border-t border-slate-100 px-3 py-2 text-center text-xs text-slate-400">
          Tap hour &amp; minute to set time
        </div>
      </PopoverContent>
    </Popover>
  );
}
