"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight, X, UserPlus } from "lucide-react";
import { GlassCard } from "@/components/shared/glass-card";
import { PageLoadingSkeleton } from "@/components/shared/page-loading-skeleton";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import type { Site, User, Worker } from "@/lib/types";
import { formatDate } from "@/lib/utils";

type SiteFormState = {
  name: string;
  location: string;
  incharge_id: string;
};

const initialFormState: SiteFormState = {
  name: "",
  location: "",
  incharge_id: "NONE",
};

export default function AdminSitesPage() {
  const [sites, setSites] = useState<Site[]>([]);
  const [siteIncharges, setSiteIncharges] = useState<User[]>([]);
  const [foremen, setForemen] = useState<User[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);

  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [expandedSiteIds, setExpandedSiteIds] = useState<Record<string, boolean>>({});

  const [formState, setFormState] = useState<SiteFormState>(initialFormState);
  const [editingSite, setEditingSite] = useState<Site | null>(null);
  const [deletingSite, setDeletingSite] = useState<Site | null>(null);

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Foreman assign
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignTargetSiteId, setAssignTargetSiteId] = useState<string | null>(null);
  const [foremanSearch, setForemanSearch] = useState("");
  const [assigningForeman, setAssigningForeman] = useState<string | null>(null);

  // Foreman unassign
  const [unassignOpen, setUnassignOpen] = useState(false);
  const [unassignTarget, setUnassignTarget] = useState<User | null>(null);
  const [unassignTargetSiteName, setUnassignTargetSiteName] = useState("");
  const [unassigning, setUnassigning] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        const [sitesRes, inchargeRes, foremenRes, workersRes] = await Promise.all([
          fetch("/api/sites"),
          fetch("/api/users?role=SITE_INCHARGE"),
          fetch("/api/users?role=FOREMAN"),
          fetch("/api/workers"),
        ]);

        if (!sitesRes.ok || !inchargeRes.ok || !foremenRes.ok || !workersRes.ok) {
          throw new Error("Failed to load site data");
        }

        const sitesData = (await sitesRes.json()) as Site[];
        const inchargeData = (await inchargeRes.json()) as User[];
        const foremenData = (await foremenRes.json()) as User[];
        const workersData = (await workersRes.json()) as Worker[];

        setSites(sitesData.sort((a, b) => b.created_at.localeCompare(a.created_at)));
        setSiteIncharges(inchargeData);
        setForemen(foremenData);
        setWorkers(workersData);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Unable to load sites");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  const inchargeNameById = useMemo(
    () => Object.fromEntries(siteIncharges.map((user) => [user.id, user.name || user.username || "Unnamed incharge"])),
    [siteIncharges]
  );

  const workerCountBySiteId = useMemo(() => {
    const counts: Record<string, number> = {};
    workers.forEach((worker) => {
      counts[worker.site_id] = (counts[worker.site_id] || 0) + 1;
    });
    return counts;
  }, [workers]);

  const foremanCountBySiteId = useMemo(() => {
    const counts: Record<string, number> = {};
    foremen.forEach((foreman) => {
      if (foreman.site_id) {
        counts[foreman.site_id] = (counts[foreman.site_id] || 0) + 1;
      }
    });
    return counts;
  }, [foremen]);

  const resetForm = () => setFormState(initialFormState);

  const openAddDialog = () => {
    resetForm();
    setAddOpen(true);
  };

  const openEditDialog = (site: Site) => {
    setEditingSite(site);
    setFormState({
      name: site.name,
      location: site.location ?? "",
      incharge_id: site.incharge_id ?? "NONE",
    });
    setEditOpen(true);
  };

  const openDeleteDialog = (site: Site) => {
    setDeletingSite(site);
    setDeleteOpen(true);
  };

  const toggleExpandSite = (siteId: string) => {
    setExpandedSiteIds((prev) => ({ ...prev, [siteId]: !prev[siteId] }));
  };

  const handleCreateSite = async () => {
    if (!formState.name.trim()) {
      toast.error("Site name is required");
      return;
    }

    try {
      setSaving(true);
      const response = await fetch("/api/sites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formState.name.trim(),
          location: formState.location.trim() || null,
          incharge_id: formState.incharge_id === "NONE" ? null : formState.incharge_id,
        }),
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "Failed to create site");
      }

      const created = (await response.json()) as Site;
      setSites((prev) => [created, ...prev]);
      toast.success("Site created");
      setAddOpen(false);
      resetForm();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create site");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateSite = async () => {
    if (!editingSite) return;
    if (!formState.name.trim()) {
      toast.error("Site name is required");
      return;
    }

    try {
      setSaving(true);
      const response = await fetch(`/api/sites/${editingSite.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
        name: formState.name.trim(),
        location: formState.location.trim() || null,
        incharge_id: formState.incharge_id === "NONE" ? null : formState.incharge_id,
        }),
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "Failed to update site");
      }

      const updated = (await response.json()) as Site;
      setSites((prev) => prev.map((site) => (site.id === updated.id ? updated : site)));
      toast.success("Site updated");
      setEditOpen(false);
      setEditingSite(null);
      resetForm();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update site");
    } finally {
      setSaving(false);
    }
  };

  const openAssignForeman = (siteId: string) => {
    setAssignTargetSiteId(siteId);
    setForemanSearch("");
    setAssignOpen(true);
  };

  const handleAssignForeman = async (foremanId: string) => {
    if (!assignTargetSiteId) return;
    try {
      setAssigningForeman(foremanId);
      
      // Get the site to find its incharge_id
      const siteRes = await fetch(`/api/sites`);
      if (!siteRes.ok) {
        throw new Error("Failed to fetch sites");
      }
      const allSites = (await siteRes.json()) as Site[];
      const targetSite = allSites.find((s) => s.id === assignTargetSiteId);
      
      if (!targetSite) {
        throw new Error("Site not found");
      }
      
      // Assign foreman with both site_id and parent_id (incharge_id)
      const response = await fetch(`/api/users/${foremanId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          site_id: assignTargetSiteId,
          parent_id: targetSite.incharge_id || null,
        }),
      });
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "Failed to assign foreman");
      }
      const updated = (await response.json()) as User;
      setForemen((prev) => prev.map((f) => (f.id === updated.id ? updated : f)));
      toast.success("Foreman assigned");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to assign foreman");
    } finally {
      setAssigningForeman(null);
    }
  };

  const openUnassignConfirm = (foreman: User, siteName: string) => {
    setUnassignTarget(foreman);
    setUnassignTargetSiteName(siteName);
    setUnassignOpen(true);
  };

  const handleUnassignForeman = async () => {
    if (!unassignTarget) return;
    try {
      setUnassigning(true);
      const response = await fetch(`/api/users/${unassignTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ site_id: null, parent_id: null }),
      });
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "Failed to unassign foreman");
      }
      const updated = (await response.json()) as User;
      setForemen((prev) => prev.map((f) => (f.id === updated.id ? updated : f)));
      toast.success("Foreman unassigned");
      setUnassignOpen(false);
      setUnassignTarget(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to unassign foreman");
    } finally {
      setUnassigning(false);
    }
  };

  const handleDeleteSite = async () => {
    if (!deletingSite) return;

    try {
      setDeleting(true);
      const response = await fetch(`/api/sites/${deletingSite.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "Failed to delete site");
      }

      setSites((prev) => prev.filter((site) => site.id !== deletingSite.id));
      toast.success("Site deleted");
      setDeleteOpen(false);
      setDeletingSite(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete site");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Manage Sites" subtitle="Create, assign, edit and remove sites" />

      <GlassCard>
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-800">Sites</p>
          <Button type="button" onClick={openAddDialog}>
            <Plus className="h-4 w-4" />
            Add Site
          </Button>
        </div>

        {loading ? (
          <PageLoadingSkeleton rows={4} />
        ) : sites.length === 0 ? (
          <p className="text-sm text-slate-500">No sites created yet.</p>
        ) : (
          <div className="space-y-2">
            {sites.map((site) => {
              const isExpanded = !!expandedSiteIds[site.id];
              const workerCount = workerCountBySiteId[site.id] || 0;
              const foremanCount = foremanCountBySiteId[site.id] || 0;
              const siteForemen = foremen.filter((f) => f.site_id === site.id);

              return (
                <div
                  key={site.id}
                  className="rounded-lg border border-slate-200 overflow-hidden"
                >
                  <div className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors">
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => toggleExpandSite(site.id)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          toggleExpandSite(site.id);
                        }
                      }}
                      className="flex items-center gap-3 text-left flex-1 cursor-pointer"
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-slate-500 flex-shrink-0" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-slate-500 flex-shrink-0" />
                      )}
                      <div className="flex-1">
                        <p className="font-medium text-slate-800">{site.name}</p>
                        <div className="flex gap-4 text-sm text-slate-600 mt-1">
                          <span>{site.location || "No location"}</span>
                          <span>Incharge: {site.incharge_id ? inchargeNameById[site.incharge_id] ?? "Unknown" : "Unassigned"}</span>
                          <span>{workerCount} workers</span>
                          <span>{foremanCount} foremen</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        type="button"
                        onClick={() => openEditDialog(site)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Edit
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        type="button"
                        onClick={() => openDeleteDialog(site)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </Button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-slate-200 bg-slate-50 p-4">
                      <div className="space-y-3">
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <p className="text-sm font-semibold text-slate-700">Assigned Foremen</p>
                            <button
                              type="button"
                              title="Assign a foreman"
                              onClick={() => openAssignForeman(site.id)}
                              className="flex items-center justify-center h-5 w-5 rounded-full bg-slate-800 hover:bg-slate-700 transition-colors text-white flex-shrink-0"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>
                          {siteForemen.length === 0 ? (
                            <p className="text-sm text-slate-500">No foremen assigned</p>
                          ) : (
                            <div className="space-y-1">
                              {siteForemen.map((foreman) => {
                                const displayName = foreman.name || foreman.username || "Unnamed foreman";

                                return (
                                  <div key={foreman.id} className="flex items-center gap-2">
                                    <span className="text-sm text-slate-700">• {displayName}</span>
                                    <button
                                      type="button"
                                      title={`Remove ${displayName}`}
                                      onClick={() => openUnassignConfirm(foreman, site.name)}
                                      className="flex items-center justify-center h-4 w-4 rounded-full bg-red-100 hover:bg-red-200 transition-colors text-red-600 flex-shrink-0"
                                    >
                                      <X className="h-2.5 w-2.5" />
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-700 mb-2">Additional Info</p>
                          <p className="text-sm text-slate-600">Created: {formatDate(site.created_at)}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </GlassCard>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Site</DialogTitle>
            <DialogDescription>Create a new site and optionally assign a Site Incharge.</DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="site-name">Name</Label>
              <Input
                id="site-name"
                value={formState.name}
                onChange={(event) => setFormState((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="Site name"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="site-location">Location</Label>
              <Input
                id="site-location"
                value={formState.location}
                onChange={(event) => setFormState((prev) => ({ ...prev, location: event.target.value }))}
                placeholder="Location"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Assign Incharge</Label>
              <Select value={formState.incharge_id} onValueChange={(value) => setFormState((prev) => ({ ...prev, incharge_id: value ?? "NONE" }))}>
                <SelectTrigger className="w-full">
                  <span className="truncate text-left">
                    {formState.incharge_id === "NONE" ? "Unassigned" : (inchargeNameById[formState.incharge_id] ?? "Unknown incharge")}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">Unassigned</SelectItem>
                  {siteIncharges.map((incharge) => (
                    <SelectItem key={incharge.id} value={incharge.id}>
                      {incharge.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleCreateSite} disabled={saving}>
              {saving ? "Saving..." : "Create Site"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={editOpen}
        onOpenChange={(open) => {
          setEditOpen(open);
          if (!open) {
            setEditingSite(null);
            resetForm();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Site</DialogTitle>
            <DialogDescription>Update site details and assigned incharge.</DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-site-name">Name</Label>
              <Input
                id="edit-site-name"
                value={formState.name}
                onChange={(event) => setFormState((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="Site name"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-site-location">Location</Label>
              <Input
                id="edit-site-location"
                value={formState.location}
                onChange={(event) => setFormState((prev) => ({ ...prev, location: event.target.value }))}
                placeholder="Location"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Assign Incharge</Label>
              <Select value={formState.incharge_id} onValueChange={(value) => setFormState((prev) => ({ ...prev, incharge_id: value ?? "NONE" }))}>
                <SelectTrigger className="w-full">
                  <span className="truncate text-left">
                    {formState.incharge_id === "NONE" ? "Unassigned" : (inchargeNameById[formState.incharge_id] ?? "Unknown incharge")}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">Unassigned</SelectItem>
                  {siteIncharges.map((incharge) => (
                    <SelectItem key={incharge.id} value={incharge.id}>
                      {incharge.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleUpdateSite} disabled={saving}>
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleteOpen}
        onOpenChange={(open) => {
          setDeleteOpen(open);
          if (!open) setDeletingSite(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Site</DialogTitle>
            <DialogDescription>
              {deletingSite
                ? `Are you sure you want to delete "${deletingSite.name}"? This will fail if attendance history exists.`
                : "Are you sure you want to delete this site?"}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={handleDeleteSite} disabled={deleting}>
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Foreman Dialog */}
      <Dialog
        open={assignOpen}
        onOpenChange={(open) => {
          setAssignOpen(open);
          if (!open) {
            setAssignTargetSiteId(null);
            setForemanSearch("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              Assign Foreman
            </DialogTitle>
            <DialogDescription>
              Search and select a foreman to assign to this site.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Search foreman</label>
              <input
                type="text"
                value={foremanSearch}
                onChange={(e) => setForemanSearch(e.target.value)}
                placeholder="Type foreman name…"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500"
                autoFocus
              />
            </div>

            {(() => {
              const alreadyAssigned = new Set(
                foremen.filter((f) => f.site_id === assignTargetSiteId).map((f) => f.id)
              );
              const filtered = foremen.filter(
                (f) =>
                  !alreadyAssigned.has(f.id) &&
                  `${f.name ?? ""} ${f.username ?? ""}`.toLowerCase().includes(foremanSearch.toLowerCase())
              );

              if (filtered.length === 0) {
                return (
                  <p className="text-sm text-slate-500 py-2">
                    {foremanSearch
                      ? "No matching foremen found"
                      : "All foremen are already assigned to this site"}
                  </p>
                );
              }

              return (
                <div className="max-h-60 overflow-y-auto space-y-1 rounded-md border border-slate-200 p-1">
                  {filtered.map((foreman) => {
                    const displayName = foreman.name || foreman.username || "Unnamed foreman";

                    return (
                      <button
                        key={foreman.id}
                        type="button"
                        onClick={() => handleAssignForeman(foreman.id)}
                        disabled={assigningForeman === foreman.id}
                        className="w-full flex items-center justify-between rounded px-3 py-2 text-sm text-left hover:bg-slate-100 transition-colors disabled:opacity-60"
                      >
                        <span className="font-medium text-slate-800">{displayName}</span>
                        <span className="text-xs text-slate-500">
                          {foreman.site_id ? "Currently at another site" : "Unassigned"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              );
            })()}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAssignOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Unassign Foreman Confirmation Dialog */}
      <Dialog
        open={unassignOpen}
        onOpenChange={(open) => {
          setUnassignOpen(open);
          if (!open) setUnassignTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Foreman</DialogTitle>
            <DialogDescription>
              {unassignTarget
                ? `Remove "${unassignTarget.name}" from "${unassignTargetSiteName}"? Their site assignment will be cleared.`
                : "Remove this foreman from the site?"}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setUnassignOpen(false)}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={handleUnassignForeman} disabled={unassigning}>
              {unassigning ? "Removing..." : "Remove"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
