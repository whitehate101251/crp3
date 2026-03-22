"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { WorkerFormFields, type WorkerFormValues } from "@/components/shared/worker-form-fields";
import { GlassCard } from "@/components/shared/glass-card";
import { PageLoadingSkeleton } from "@/components/shared/page-loading-skeleton";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { User, Worker } from "@/lib/types";
import { useUser } from "@/hooks/use-user";

const initialWorkerForm: WorkerFormValues = {
  name: "",
  father_name: "",
  phone_number: "",
  aadhar_card: "",
  worker_type: "",
};

export default function SiteInchargeForemenPage() {
  const { user, loading: userLoading } = useUser();
  const [foremen, setForemen] = useState<User[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [expandedForemanIds, setExpandedForemanIds] = useState<Record<string, boolean>>({});
  const [workerDialogOpen, setWorkerDialogOpen] = useState(false);
  const [selectedForemanId, setSelectedForemanId] = useState<string | null>(null);
  const [workerForm, setWorkerForm] = useState<WorkerFormValues>(initialWorkerForm);
  const [editingWorkerId, setEditingWorkerId] = useState<string | null>(null);

  const [savingWorkerFor, setSavingWorkerFor] = useState<string | null>(null);
  const [deletingWorkerId, setDeletingWorkerId] = useState<string | null>(null);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (userLoading || !user) return;
    const sessionUser = user;

    let cancelled = false;
    async function loadData() {
      setLoadingData(true);
      try {
        const [usersRes, workersRes] = await Promise.all([
          fetch("/api/users?role=FOREMAN"),
          fetch(`/api/workers?site_id=${sessionUser.site_id}`),
        ]);

        if (!usersRes.ok || !workersRes.ok) {
          throw new Error("Failed to load foremen data");
        }

        const [usersData, workersData] = (await Promise.all([usersRes.json(), workersRes.json()])) as [User[], Worker[]];
        if (cancelled) return;

        const filteredForemen = usersData.filter((entry) => entry.parent_id === sessionUser.id && entry.site_id === sessionUser.site_id);
        setForemen(filteredForemen);
        setWorkers(workersData.filter((entry) => filteredForemen.some((foreman) => foreman.id === entry.foreman_id)));
      } catch (error) {
        if (!cancelled) {
          toast.error(error instanceof Error ? error.message : "Unable to load foremen");
        }
      } finally {
        if (!cancelled) {
          setLoadingData(false);
        }
      }
    }

    loadData();
    return () => {
      cancelled = true;
    };
  }, [user, userLoading]);

  const workerCountByForeman = useMemo(() => {
    const map: Record<string, number> = {};
    workers.forEach((worker) => {
      map[worker.foreman_id] = (map[worker.foreman_id] ?? 0) + 1;
    });
    return map;
  }, [workers]);

  const toggleExpanded = (foremanId: string) => {
    setExpandedForemanIds((prev) => ({ ...prev, [foremanId]: !prev[foremanId] }));
  };

  const openAddWorkerDialog = (foremanId: string) => {
    setSelectedForemanId(foremanId);
    setWorkerForm(initialWorkerForm);
    setEditingWorkerId(null);
    setWorkerDialogOpen(true);
  };

  const openEditWorkerDialog = (worker: Worker) => {
    setSelectedForemanId(worker.foreman_id);
    setWorkerForm({
      name: worker.name,
      father_name: worker.father_name,
      phone_number: worker.phone_number,
      aadhar_card: worker.aadhar_card || "",
      worker_type: worker.worker_type || "",
    });
    setEditingWorkerId(worker.id);
    setWorkerDialogOpen(true);
  };

  const createWorker = async (foremanId: string) => {
    if (!user || !user.site_id) return;
    const name = workerForm.name.trim();
    const fatherName = workerForm.father_name.trim();
    const phoneNumber = workerForm.phone_number.trim();

    if (!name || !fatherName || !phoneNumber) {
      toast.error("Name, FatherName, and PhoneNumber are required");
      return;
    }

    if (!/^\d{10}$/.test(phoneNumber)) {
      toast.error("PhoneNumber must be 10 digits");
      return;
    }

    try {
      setSavingWorkerFor(foremanId);
      const isEditing = !!editingWorkerId;
      const url = isEditing ? `/api/workers/${editingWorkerId}` : "/api/workers";
      const method = isEditing ? "PATCH" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          father_name: fatherName,
          phone_number: phoneNumber,
          aadhar_card: workerForm.aadhar_card.trim() || null,
          worker_type: workerForm.worker_type.trim() || null,
          ...(isEditing ? {} : { foreman_id: foremanId, site_id: user.site_id }),
        }),
      });

      if (!response.ok) {
        const errorData = (await response.json()) as { error?: string };
        throw new Error(errorData.error ?? "Failed to add worker");
      }

      const created = (await response.json()) as Worker;
      if (isEditing) {
        setWorkers((prev) =>
          prev.map((w) => (w.id === editingWorkerId ? created : w))
        );
      } else {
        setWorkers((prev) => [created, ...prev]);
      }
      setWorkerDialogOpen(false);
      setSelectedForemanId(null);
      setEditingWorkerId(null);
      setWorkerForm(initialWorkerForm);
      toast.success(isEditing ? "Worker updated" : "Worker added");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : (editingWorkerId ? "Failed to update worker" : "Failed to add worker"),
      );
    } finally {
      setSavingWorkerFor(null);
    }
  };

  const deleteWorker = async (workerId: string) => {
    try {
      setDeletingWorkerId(workerId);
      const response = await fetch(`/api/workers/${workerId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorData = (await response.json()) as { error?: string };
        throw new Error(errorData.error ?? "Failed to delete worker");
      }

      setWorkers((prev) => prev.filter((worker) => worker.id !== workerId));
      toast.success("Worker deleted");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete worker");
    } finally {
      setDeletingWorkerId(null);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Manage Foremen" subtitle="Foremen and worker assignments" />

      {userLoading || loadingData ? (
        <PageLoadingSkeleton rows={4} />
      ) : foremen.length === 0 ? (
        <GlassCard>
          <p className="text-sm text-slate-500">No foremen found under your account.</p>
        </GlassCard>
      ) : (
        <div className="space-y-3">
          {foremen.map((foreman) => {
            const isExpanded = !!expandedForemanIds[foreman.id];
            const foremanWorkers = workers.filter((worker) => worker.foreman_id === foreman.id);

            return (
              <GlassCard key={foreman.id}>
                <div className="space-y-3">
                  <button
                    type="button"
                    className="flex w-full items-start justify-between text-left"
                    onClick={() => toggleExpanded(foreman.id)}
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{foreman.name}</p>
                      <p className="text-xs text-slate-500">@{foreman.username}</p>
                      <p className="text-xs text-slate-500">{foreman.phone ?? "No phone"}</p>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-600">
                      <span>{workerCountByForeman[foreman.id] ?? 0} workers</span>
                      {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="space-y-3 border-t border-slate-200 pt-3">
                      <div className="space-y-1">
                        <p className="text-xs font-semibold text-slate-500">Workers</p>
                        {foremanWorkers.length === 0 ? (
                          <p className="text-sm text-slate-500">No workers yet.</p>
                        ) : (
                          <div className="space-y-1.5">
                            {foremanWorkers.map((worker) => (
                              <div key={worker.id} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700">
                                <div>
                                  <p className="font-medium text-slate-800">{worker.name}</p>
                                  <p className="text-xs text-slate-500">Father: {worker.father_name}</p>
                                  <p className="text-xs text-slate-500">Phone: {worker.phone_number}</p>
                                  <p className="text-xs text-slate-500">Aadhar: {worker.aadhar_card || "-"}</p>
                                  <p className="text-xs text-slate-500">Worker Type: {worker.worker_type || "-"}</p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => openEditWorkerDialog(worker)}
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100"
                                  aria-label="Edit worker"
                                >
                                  <Pencil className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => deleteWorker(worker.id)}
                                  disabled={deletingWorkerId === worker.id}
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-md text-red-600 hover:bg-red-50 disabled:opacity-50"
                                  aria-label="Delete worker"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="flex justify-end">
                        <Button type="button" onClick={() => openAddWorkerDialog(foreman.id)}>
                          Add Worker
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </GlassCard>
            );
          })}
        </div>
      )}

      <Dialog
        open={workerDialogOpen}
        onOpenChange={(open) => {
          setWorkerDialogOpen(open);
          if (!open) {
            setSelectedForemanId(null);
            setWorkerForm(initialWorkerForm);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingWorkerId ? "Edit Worker" : "Add Worker"}</DialogTitle>
            <DialogDescription>Required: Name, FatherName, PhoneNumber</DialogDescription>
          </DialogHeader>

          <WorkerFormFields values={workerForm} onChange={setWorkerForm} />

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setWorkerDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!selectedForemanId || !!savingWorkerFor}
              onClick={() => {
                if (!selectedForemanId) return;
                createWorker(selectedForemanId);
              }}
            >
              {savingWorkerFor ? (editingWorkerId ? "Updating..." : "Adding...") : (editingWorkerId ? "Update Worker" : "Add Worker")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
