"use client";

import { useEffect, useMemo, useState } from "react";
import { Pencil, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { GlassCard } from "@/components/shared/glass-card";
import { PageHeader } from "@/components/shared/page-header";
import { PageLoadingSkeleton } from "@/components/shared/page-loading-skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ROLE_LABELS } from "@/lib/constants";
import type { Site, User, UserRole } from "@/lib/types";
import { formatDate } from "@/lib/utils";

type EditForm = {
  name: string;
  father_name: string;
  username: string;
  phone: string;
  site_id: string;
  parent_id: string;
  password: string;
};

const initialEditForm: EditForm = {
  name: "",
  father_name: "",
  username: "",
  phone: "",
  site_id: "NONE",
  parent_id: "NONE",
  password: "",
};

export default function AdminManageUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [sites, setSites] = useState<Site[]>([]);
  const [siteIncharges, setSiteIncharges] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<UserRole | "ALL">("ALL");

  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState<EditForm>(initialEditForm);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        const [usersRes, sitesRes, siteInchargesRes] = await Promise.all([
          fetch("/api/users"),
          fetch("/api/sites"),
          fetch("/api/users?role=SITE_INCHARGE"),
        ]);

        if (!usersRes.ok || !sitesRes.ok || !siteInchargesRes.ok) {
          throw new Error("Failed to load users");
        }

        const [usersData, sitesData, siteInchargesData] = (await Promise.all([
          usersRes.json(),
          sitesRes.json(),
          siteInchargesRes.json(),
        ])) as [User[], Site[], User[]];

        const sessionRes = await fetch("/api/auth/session");
        const sessionData = sessionRes.ok
          ? ((await sessionRes.json()) as { user: User | null })
          : { user: null };

        setUsers(usersData.sort((a, b) => b.created_at.localeCompare(a.created_at)));
        setSites(sitesData);
        setSiteIncharges(siteInchargesData);
        setCurrentUser(sessionData.user);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Unable to load users");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  const siteNameById = useMemo(
    () => Object.fromEntries(sites.map((site) => [site.id, site.name])),
    [sites],
  );

  const userNameById = useMemo(
    () => {
      const map = Object.fromEntries(users.map((user) => [user.id, user.name || user.username]));
      // Also add siteIncharges to ensure parent SI names display correctly
      siteIncharges.forEach((user) => {
        if (!map[user.id]) {
          map[user.id] = user.name || user.username;
        }
      });
      return map;
    },
    [users, siteIncharges],
  );

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();

    return users.filter((user) => {
      const matchesRole = roleFilter === "ALL" ? true : user.role === roleFilter;
      const matchesSearch =
        !query ||
        (user.name ?? "").toLowerCase().includes(query) ||
        (user.username ?? "").toLowerCase().includes(query) ||
        (user.father_name ?? "").toLowerCase().includes(query) ||
        (user.phone ?? "").toLowerCase().includes(query);

      return matchesRole && matchesSearch;
    });
  }, [roleFilter, search, users]);

  const parentSiOptions = useMemo(() => {
    if (!editingUser || editingUser.role !== "FOREMAN") return [];
    if (editForm.site_id === "NONE") return siteIncharges;
    return siteIncharges.filter((si) => si.id !== editingUser.id && si.site_id === editForm.site_id);
  }, [editForm.site_id, editingUser, siteIncharges]);

  const openEditDialog = (user: User) => {
    setEditingUser(user);
    setEditForm({
      name: user.name ?? "",
      father_name: user.father_name ?? "",
      username: user.username ?? "",
      phone: user.phone ?? "",
      site_id: user.site_id ?? "NONE",
      parent_id: user.parent_id ?? "NONE",
      password: "",
    });
    setEditOpen(true);
  };

  const openDeleteDialog = (user: User) => {
    setDeletingUser(user);
    setDeleteOpen(true);
  };

  const handleSaveUser = async () => {
    if (!editingUser) return;

    try {
      setSaving(true);
      const payload: Record<string, string | null> = {};

      const normalizedName = editForm.name.trim();
      const normalizedFatherName = editForm.father_name.trim();
      const normalizedUsername = editForm.username.trim();
      const normalizedPhone = editForm.phone.trim();
      const normalizedPassword = editForm.password.trim();
      const normalizedSiteId =
        editingUser.role === "ADMIN" || editForm.site_id === "NONE" ? null : editForm.site_id;
      const normalizedParentId =
        editingUser.role === "FOREMAN" && editForm.parent_id !== "NONE" ? editForm.parent_id : null;

      if (normalizedName !== (editingUser.name ?? "")) {
        payload.name = normalizedName || null;
      }

      if (normalizedFatherName !== (editingUser.father_name ?? "")) {
        payload.father_name = normalizedFatherName || null;
      }

      if (normalizedUsername !== (editingUser.username ?? "")) {
        payload.username = normalizedUsername || null;
      }

      if (normalizedPhone !== (editingUser.phone ?? "")) {
        payload.phone = normalizedPhone || null;
      }

      if (normalizedSiteId !== editingUser.site_id) {
        payload.site_id = normalizedSiteId;
      }

      if (editingUser.role === "FOREMAN" && normalizedParentId !== editingUser.parent_id) {
        payload.parent_id = normalizedParentId;
      }

      if (normalizedPassword) {
        payload.password = normalizedPassword;
      }

      if (Object.keys(payload).length === 0) {
        toast.error("No changes to save");
        setSaving(false);
        return;
      }

      const response = await fetch(`/api/users/${editingUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "Failed to update user");
      }

      const updatedUser = (await response.json()) as User;
      setUsers((prev) => prev.map((user) => (user.id === updatedUser.id ? updatedUser : user)));

      if (updatedUser.role === "SITE_INCHARGE") {
        setSiteIncharges((prev) => prev.map((user) => (user.id === updatedUser.id ? updatedUser : user)));
      }

      toast.success("User updated");
      setEditOpen(false);
      setEditingUser(null);
      setEditForm(initialEditForm);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update user");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!deletingUser) return;

    try {
      setDeleting(true);
      const response = await fetch(`/api/users/${deletingUser.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "Failed to delete user");
      }

      setUsers((prev) => prev.filter((user) => user.id !== deletingUser.id));
      setSiteIncharges((prev) => prev.filter((user) => user.id !== deletingUser.id));
      toast.success("User deleted");
      setDeleteOpen(false);
      setDeletingUser(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete user");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Manage Users"
        subtitle="View, edit, reset passwords, and delete admin, site incharge, and foreman users"
      />

      <GlassCard className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by name, username, father name, or phone"
              className="pl-9"
            />
          </div>

          <div className="w-full lg:w-52">
            <Select value={roleFilter} onValueChange={(value) => setRoleFilter((value as UserRole | "ALL") ?? "ALL")}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Filter by role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All roles</SelectItem>
                <SelectItem value="ADMIN">Admin</SelectItem>
                <SelectItem value="SITE_INCHARGE">Site Incharge</SelectItem>
                <SelectItem value="FOREMAN">Foreman</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {loading ? (
          <PageLoadingSkeleton rows={5} />
        ) : filteredUsers.length === 0 ? (
          <p className="text-sm text-slate-500">No users found for the current search/filter.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Username</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Father Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Site</TableHead>
                <TableHead>Parent SI</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium text-slate-800">{user.name || user.username || "Unnamed user"}</TableCell>
                  <TableCell>{user.username || "—"}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{ROLE_LABELS[user.role]}</Badge>
                  </TableCell>
                  <TableCell>{user.father_name || "—"}</TableCell>
                  <TableCell>{user.phone || "—"}</TableCell>
                  <TableCell>{user.site_id ? siteNameById[user.site_id] ?? "Unknown site" : "Unassigned"}</TableCell>
                  <TableCell>{user.parent_id ? userNameById[user.parent_id] ?? "Unknown SI" : "—"}</TableCell>
                  <TableCell>{formatDate(user.created_at)}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={() => openEditDialog(user)}>
                        <Pencil className="h-3.5 w-3.5" />
                        Edit
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => openDeleteDialog(user)}
                        disabled={currentUser?.id === user.id}
                        title={currentUser?.id === user.id ? "You cannot delete your own account" : undefined}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        {currentUser?.id === user.id ? "Own Account" : "Delete"}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </GlassCard>

      <Dialog
        open={editOpen}
        onOpenChange={(open) => {
          setEditOpen(open);
          if (!open) {
            setEditingUser(null);
            setEditForm(initialEditForm);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update user details. Leave new password empty if it should stay unchanged.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="edit-name">Name</Label>
                <Input
                  id="edit-name"
                  value={editForm.name}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder="Full name"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-father-name">Father Name</Label>
                <Input
                  id="edit-father-name"
                  value={editForm.father_name}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, father_name: event.target.value }))}
                  placeholder="Father name"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-username">Username</Label>
                <Input
                  id="edit-username"
                  value={editForm.username}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, username: event.target.value }))}
                  placeholder="Username"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-phone">Phone</Label>
                <Input
                  id="edit-phone"
                  value={editForm.phone}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, phone: event.target.value }))}
                  placeholder="Phone"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-password">New Password</Label>
                <Input
                  id="edit-password"
                  type="password"
                  value={editForm.password}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, password: event.target.value }))}
                  placeholder="Leave blank to keep current"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Role</Label>
                <div className="flex h-10 items-center rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700">
                  {editingUser ? ROLE_LABELS[editingUser.role] : "—"}
                </div>
              </div>
            </div>

            {(editingUser?.role === "SITE_INCHARGE" || editingUser?.role === "FOREMAN") && (
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Site</Label>
                  <Select
                    value={editForm.site_id}
                    onValueChange={(value) =>
                      setEditForm((prev) => ({
                        ...prev,
                        site_id: value ?? "NONE",
                        parent_id: editingUser?.role === "FOREMAN" ? "NONE" : prev.parent_id,
                      }))
                    }
                  >
                    <SelectTrigger className="w-full">
                      <span>{editForm.site_id === "NONE" ? "Unassigned" : (siteNameById[editForm.site_id] ?? "Unknown")}</span>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NONE">Unassigned</SelectItem>
                      {sites.map((site) => (
                        <SelectItem key={site.id} value={site.id}>
                          {site.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {editingUser?.role === "FOREMAN" && (
                  <div className="space-y-1.5">
                    <Label>Parent SI</Label>
                    <Select
                      value={editForm.parent_id}
                      onValueChange={(value) =>
                        setEditForm((prev) => ({ ...prev, parent_id: value ?? "NONE" }))
                      }
                    >
                      <SelectTrigger className="w-full">
                        <span>{editForm.parent_id === "NONE" ? "Unassigned" : (userNameById[editForm.parent_id] ?? "Unknown SI")}</span>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="NONE">Unassigned</SelectItem>
                        {parentSiOptions.map((si) => (
                          <SelectItem key={si.id} value={si.id}>
                            {si.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSaveUser} disabled={saving}>
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleteOpen}
        onOpenChange={(open) => {
          setDeleteOpen(open);
          if (!open) {
            setDeletingUser(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
            <DialogDescription>
              {deletingUser
                ? `Delete ${deletingUser.name || deletingUser.username}? This action will also clean related assignments for site incharges and foremen.`
                : "Delete this user?"}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={handleDeleteUser} disabled={deleting}>
              {deleting ? "Deleting..." : "Delete User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}