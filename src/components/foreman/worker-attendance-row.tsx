"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { calculateTotalHours, clampXValue, clampYValue, cn } from "@/lib/utils";
import { X_MAX, Y_MAX } from "@/lib/constants";
import type { DraftWorkerRecord } from "@/lib/types";

type WorkerAttendanceRowProps = {
  worker: DraftWorkerRecord;
  onChange: (worker: DraftWorkerRecord) => void;
  onOpenDetail?: () => void;
};

export function WorkerAttendanceRow({ worker, onChange, onOpenDetail }: WorkerAttendanceRowProps) {
  const total = worker.present ? calculateTotalHours(worker.x_value, worker.y_value) : 0;

  return (
    <div className="glass-card rounded-2xl p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-slate-900">{worker.worker_name}</p>
        {onOpenDetail ? (
          <Button type="button" variant="outline" size="sm" onClick={onOpenDetail}>
            Open
          </Button>
        ) : null}
      </div>

      <div className="mb-3 grid grid-cols-2 gap-2">
        <Button
          type="button"
          className={cn("h-11 rounded-xl", worker.present ? "bg-green-600 hover:bg-green-600" : "bg-slate-200 text-slate-800 hover:bg-slate-300")}
          onClick={() => onChange({ ...worker, present: true })}
        >
          P
        </Button>
        <Button
          type="button"
          className={cn("h-11 rounded-xl", !worker.present ? "bg-red-600 hover:bg-red-600" : "bg-slate-200 text-slate-800 hover:bg-slate-300")}
          onClick={() => onChange({ ...worker, present: false, x_value: 0, y_value: 0 })}
        >
          A
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div>
          <p className="mb-1 text-xs text-slate-600">X</p>
          <Input
            type="number"
            min={0}
            max={X_MAX}
            className="[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            value={worker.x_value}
            disabled={!worker.present}
            onChange={(event) =>
              onChange({
                ...worker,
                x_value: clampXValue(Number(event.target.value || 0)),
              })
            }
          />
        </div>
        <div>
          <p className="mb-1 text-xs text-slate-600">Y</p>
          <Input
            type="number"
            min={0}
            max={Y_MAX}
            className="[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            value={worker.y_value}
            disabled={!worker.present}
            onChange={(event) =>
              onChange({
                ...worker,
                y_value: clampYValue(Number(event.target.value || 0)),
              })
            }
          />
        </div>
        <div>
          <p className="mb-1 text-xs text-slate-600">Total</p>
          <div className="flex h-8 items-center rounded-md border bg-white px-2 text-sm text-slate-800">{total}</div>
        </div>
      </div>
    </div>
  );
}
