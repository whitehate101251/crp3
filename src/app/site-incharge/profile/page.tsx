"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { GlassCard } from "@/components/shared/glass-card";
import { LogoutButton } from "@/components/shared/logout-button";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Site } from "@/lib/types";
import { useUser } from "@/hooks/use-user";

type PasswordForm = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

const initialPasswordForm: PasswordForm = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
};

export default function SiteInchargeProfilePage() {
  const { user, loading: userLoading } = useUser();
  const [sites, setSites] = useState<Site[]>([]);
  const [sitesLoading, setSitesLoading] = useState(true);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  const [passwordForm, setPasswordForm] = useState<PasswordForm>(initialPasswordForm);
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    if (!user) return;
    setName(user.name ?? "");
    setPhone(user.phone ?? "");
  }, [user]);

  useEffect(() => {
    let cancelled = false;

    async function loadSites() {
      try {
        const response = await fetch("/api/sites");
        if (!response.ok) {
          throw new Error("Unable to load sites");
        }
        const data = (await response.json()) as Site[];
        if (!cancelled) {
          setSites(data);
        }
      } catch {
        if (!cancelled) {
          setSites([]);
        }
      } finally {
        if (!cancelled) {
          setSitesLoading(false);
        }
      }
    }

    loadSites();
    return () => {
      cancelled = true;
    };
  }, []);

  const siteName = useMemo(() => {
    if (!user?.site_id) return "Unassigned";
    return sites.find((site) => site.id === user.site_id)?.name ?? user.site_id;
  }, [sites, user?.site_id]);

  const handleSaveProfile = async () => {
    if (!user) return;
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }

    try {
      setSavingProfile(true);
      const response = await fetch(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim() || null,
        }),
      });

      if (!response.ok) {
        const errorData = (await response.json()) as { error?: string };
        throw new Error(errorData.error ?? "Failed to update profile");
      }

      toast.success("Profile updated");
      setIsEditingProfile(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update profile");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleCancelProfileEdit = () => {
    if (!user) return;
    setName(user.name ?? "");
    setPhone(user.phone ?? "");
    setIsEditingProfile(false);
  };

  const handlePasswordChange = async () => {
    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      toast.error("All password fields are required");
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error("New password and confirm password must match");
      return;
    }

    try {
      setSavingPassword(true);
      const response = await fetch("/api/auth/change-password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(passwordForm),
      });

      if (!response.ok) {
        const errorData = (await response.json()) as { error?: string };
        throw new Error(errorData.error ?? "Failed to update password");
      }

      toast.success("Password updated");
      setPasswordForm(initialPasswordForm);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update password");
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Profile" subtitle="Manage site incharge profile (offline mode)" />

      <GlassCard className="space-y-4">
        <p className="text-sm font-semibold text-slate-800">Profile Details</p>

        {userLoading ? (
          <p className="text-sm text-slate-500">Loading profile...</p>
        ) : !user ? (
          <p className="text-sm text-slate-500">No active session.</p>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="si-name">Name</Label>
                <Input id="si-name" value={name} onChange={(event) => setName(event.target.value)} readOnly={!isEditingProfile} />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="si-username">Username</Label>
                <Input id="si-username" value={user.username} readOnly />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="si-phone">Phone</Label>
                <Input id="si-phone" value={phone} onChange={(event) => setPhone(event.target.value)} readOnly={!isEditingProfile} />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="si-site">Site</Label>
                <Input id="si-site" value={sitesLoading ? "Loading..." : siteName} readOnly />
              </div>
            </div>

            {!isEditingProfile ? (
              <div className="flex justify-end">
                <Button type="button" onClick={() => setIsEditingProfile(true)}>
                  Edit
                </Button>
              </div>
            ) : (
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={handleCancelProfileEdit} disabled={savingProfile}>
                  Cancel
                </Button>
                <Button type="button" onClick={handleSaveProfile} disabled={savingProfile}>
                  {savingProfile ? "Saving..." : "Save"}
                </Button>
              </div>
            )}
          </>
        )}
      </GlassCard>

      <GlassCard className="space-y-4">
        <p className="text-sm font-semibold text-slate-800">Change Password</p>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="si-current-password">Current Password</Label>
            <Input
              id="si-current-password"
              type="password"
              value={passwordForm.currentPassword}
              onChange={(event) => setPasswordForm((prev) => ({ ...prev, currentPassword: event.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="si-new-password">New Password</Label>
            <Input
              id="si-new-password"
              type="password"
              value={passwordForm.newPassword}
              onChange={(event) => setPasswordForm((prev) => ({ ...prev, newPassword: event.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="si-confirm-password">Confirm Password</Label>
            <Input
              id="si-confirm-password"
              type="password"
              value={passwordForm.confirmPassword}
              onChange={(event) => setPasswordForm((prev) => ({ ...prev, confirmPassword: event.target.value }))}
            />
          </div>
        </div>

        <div className="flex justify-end">
          <Button type="button" onClick={handlePasswordChange} disabled={savingPassword || userLoading || !user}>
            {savingPassword ? "Updating..." : "Update Password"}
          </Button>
        </div>
      </GlassCard>

      <div className="flex justify-center pt-2">
        <LogoutButton
          variant="destructive"
          label="Logout"
          className="h-12 w-full max-w-sm text-base font-semibold"
        />
      </div>
    </div>
  );
}
