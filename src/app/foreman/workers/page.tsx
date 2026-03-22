"use client";

import { useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { GlassCard } from "@/components/shared/glass-card";
import { PageHeader } from "@/components/shared/page-header";
import { PageLoadingSkeleton } from "@/components/shared/page-loading-skeleton";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { WorkerFormFields } from "@/components/shared/worker-form-fields";
import type { Worker } from "@/lib/types";
import { useUser } from "@/hooks/use-user";

type WorkerForm = {
  name: string;
  father_name: string;
  phone_number: string;
  aadhar_card: string;
  worker_type: string;
};

const initialForm: WorkerForm = {
  name: "",
  father_name: "",
  phone_number: "",
  aadhar_card: "",
  worker_type: "",
};

export default function ForemanWorkersPage() {
  const { user, loading: userLoading } = useUser();

  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loadingWorkers, setLoadingWorkers] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingWorkerId, setEditingWorkerId] = useState<string | null>(null);
  const [form, setForm] = useState<WorkerForm>(initialForm);

  useEffect(() => {
    if (userLoading || !user) return;

    let cancelled = false;
    const sessionUser = user;

    async function loadWorkers() {
      setLoadingWorkers(true);
      try {
        const response = await fetch(`/api/workers?foreman_id=${sessionUser.id}`, { cache: "no-store" });
        if (!response.ok) {
          throw new Error("Unable to load workers");
        }

        const data = (await response.json()) as Worker[];
        if (!cancelled) {
          setWorkers(data);
        }
      } catch (error) {
        if (!cancelled) {
          toast.error(error instanceof Error ? error.message : "Failed to load workers");
        }
      } finally {
        if (!cancelled) {
          setLoadingWorkers(false);
        }
      }
    }

    loadWorkers();

    return () => {
      cancelled = true;
    };
  }, [user, userLoading]);

  const sortedWorkers = useMemo(
    () => workers.slice().sort((a, b) => a.name.localeCompare(b.name)),
    [workers],
  );

  const resetForm = () => {
    setForm(initialForm);
    setEditingWorkerId(null);
  };

  const openCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = (worker: Worker) => {
    setForm({
      name: worker.name,
      father_name: worker.father_name,
      phone_number: worker.phone_number,
      aadhar_card: worker.aadhar_card ?? "",
      worker_type: worker.worker_type ?? "",
    });
    setEditingWorkerId(worker.id);
    setDialogOpen(true);
  };

  const saveWorker = async () => {
    if (!user) return;

    if (!form.name.trim() || !form.father_name.trim() || !form.phone_number.trim()) {
      toast.error("Name, FatherName, and PhoneNumber are required");
      return;
    }

    if (!/^\d{10}$/.test(form.phone_number.trim())) {
      toast.error("PhoneNumber must be 10 digits");
      return;
    }

    const payload = {
      name: form.name.trim(),
      father_name: form.father_name.trim(),
      phone_number: form.phone_number.trim(),
      aadhar_card: form.aadhar_card.trim() || null,
      worker_type: form.worker_type.trim() || null,
      foreman_id: user.id,
      site_id: user.site_id,
    };

    try {
      setSaving(true);
      const response = await fetch(editingWorkerId ? `/api/workers/${editingWorkerId}` : "/api/workers", {
        method: editingWorkerId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as Worker | { error?: string };
      if (!response.ok) {
        throw new Error("error" in data ? (data.error ?? "Failed to save worker") : "Failed to save worker");
      }

      const savedWorker = data as Worker;
      setWorkers((current) => {
        if (editingWorkerId) {
          return current.map((worker) => (worker.id === editingWorkerId ? savedWorker : worker));
        }
        return [savedWorker, ...current];
      });

      toast.success(editingWorkerId ? "Worker updated" : "Worker added");
      setDialogOpen(false);
      resetForm();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save worker");
    } finally {
      setSaving(false);
    }
  };

  const deleteWorker = async (workerId: string) => {
    const confirmed = window.confirm("Delete this worker?");
    if (!confirmed) return;

    try {
      setDeletingId(workerId);
      const response = await fetch(`/api/workers/${workerId}`, { method: "DELETE" });
      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to delete worker");
      }

      setWorkers((current) => current.filter((worker) => worker.id !== workerId));
      toast.success("Worker deleted");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete worker");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-4 pb-20">
      <PageHeader title="My Workers" subtitle="Add, edit, and delete worker details" />

      <div className="flex justify-end">
        <Button type="button" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Add Worker
        </Button>
      </div>

      {userLoading || loadingWorkers ? (
        <PageLoadingSkeleton rows={4} />
      ) : sortedWorkers.length === 0 ? (
        <GlassCard>
          <p className="text-sm text-slate-500">No workers found. Add your first worker.</p>
        </GlassCard>
      ) : (
        <div className="space-y-3">
          {sortedWorkers.map((worker) => (
            <GlassCard key={worker.id} className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{worker.name}</p>
                  <p className="text-xs text-slate-500">Father: {worker.father_name}</p>
                  <p className="text-xs text-slate-500">Phone: {worker.phone_number}</p>
                  <p className="text-xs text-slate-500">Aadhar: {worker.aadhar_card || "-"}</p>
                  <p className="text-xs text-slate-500">Worker Type: {worker.worker_type || "-"}</p>
                </div>
                <div className="flex gap-2">
                  <Button type="button" size="icon" variant="outline" onClick={() => openEdit(worker)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="destructive"
                    onClick={() => deleteWorker(worker.id)}
                    disabled={deletingId === worker.id}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      )}

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            resetForm();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingWorkerId ? "Edit Worker" : "Add Worker"}</DialogTitle>
            <DialogDescription>Required: Name, FatherName, PhoneNumber</DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <WorkerFormFields values={form} onChange={setForm} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={saveWorker} disabled={saving}>
              {saving ? "Saving..." : editingWorkerId ? "Update Worker" : "Add Worker"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
