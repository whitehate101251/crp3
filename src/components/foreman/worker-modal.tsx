"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { calculateTotalHours, clampXValue, clampYValue, cn } from "@/lib/utils";
import { X_MAX, Y_MAX } from "@/lib/constants";
import { useForcemanLanguage } from "@/providers/foreman-language-provider";
import { foremanTranslations } from "@/lib/translations/foreman";
import type { DraftWorkerRecord } from "@/lib/types";

type WorkerModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  worker: DraftWorkerRecord | null;
  onChange: (worker: DraftWorkerRecord) => void;
  onPrev: () => void;
  onNext: () => void;
};

export function WorkerModal({ open, onOpenChange, worker, onChange, onPrev, onNext }: WorkerModalProps) {
  const { language } = useForcemanLanguage();
  const t = foremanTranslations[language];
  
  if (!worker) return null;

  const total = worker.present ? calculateTotalHours(worker.x_value, worker.y_value) : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-[92vh] max-w-[96vw] rounded-2xl p-4 sm:max-w-md" showCloseButton>
        <DialogHeader>
          <DialogTitle className="flex flex-col gap-1">
            <span>{worker.worker_name}</span>
            <span className="text-xs font-normal text-slate-500">{t.father}: {worker.father_name || "—"}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              className={cn("h-14 text-lg", worker.present ? "bg-green-600 hover:bg-green-600" : "bg-slate-200 text-slate-800 hover:bg-slate-300")}
              onClick={() => onChange({ ...worker, present: true })}
            >
              {t.present}
            </Button>
            <Button
              type="button"
              className={cn("h-14 text-lg", !worker.present ? "bg-red-600 hover:bg-red-600" : "bg-slate-200 text-slate-800 hover:bg-slate-300")}
              onClick={() => onChange({ ...worker, present: false, x_value: 0, y_value: 0 })}
            >
              {t.absent}
            </Button>
          </div>

          <div className="space-y-3">
            <div>
              <p className="mb-1 text-xs text-slate-600">{t.x} (0-{X_MAX})</p>
              <Input
                inputMode="numeric"
                type="number"
                min={0}
                max={X_MAX}
                className="h-12 text-base"
                disabled={!worker.present}
                value={worker.x_value}
                onChange={(event) => onChange({ ...worker, x_value: clampXValue(Number(event.target.value || 0)) })}
                onFocus={(event) => {
                  if (event.target.value === "0") {
                    event.target.value = "";
                  }
                }}
                onBlur={(event) => {
                  if (event.target.value === "") {
                    event.target.value = "0";
                    onChange({ ...worker, x_value: 0 });
                  }
                }}
              />
            </div>
            <div>
              <p className="mb-1 text-xs text-slate-600">{t.y} (0-{Y_MAX})</p>
              <Input
                inputMode="numeric"
                type="number"
                min={0}
                max={Y_MAX}
                className="h-12 text-base"
                disabled={!worker.present}
                value={worker.y_value}
                onChange={(event) => onChange({ ...worker, y_value: clampYValue(Number(event.target.value || 0)) })}
                onFocus={(event) => {
                  if (event.target.value === "0") {
                    event.target.value = "";
                  }
                }}
                onBlur={(event) => {
                  if (event.target.value === "") {
                    event.target.value = "0";
                    onChange({ ...worker, y_value: 0 });
                  }
                }}
              />
            </div>
            <div className="rounded-xl border bg-slate-50 p-3 text-sm text-slate-700">{t.totalHours}: {total}</div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant="outline" className="h-12" onClick={onPrev}>
              {t.previous}
            </Button>
            <Button type="button" variant="outline" className="h-12" onClick={onNext}>
              {t.next}
            </Button>
          </div>

          <Button type="button" className="h-12 w-full text-base" onClick={() => onOpenChange(false)}>
            {t.okay}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
