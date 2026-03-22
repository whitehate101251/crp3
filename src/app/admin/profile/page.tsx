"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { GlassCard } from "@/components/shared/glass-card";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { User } from "@/lib/types";

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

export default function AdminProfilePage() {
  const [user, setUser] = useState<User | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [passwordForm, setPasswordForm] = useState<PasswordForm>(initialPasswordForm);
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    async function loadSession() {
      try {
        const response = await fetch("/api/auth/session");
        if (!response.ok) {
          throw new Error("Unable to load session");
        }

        const data = (await response.json()) as { user: User | null };
        if (!data.user) {
          throw new Error("User not found");
        }

        setUser(data.user);
        setName(data.user.name ?? "");
        setPhone(data.user.phone ?? "");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to load profile");
      } finally {
        setLoading(false);
      }
    }

    loadSession();
  }, []);

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
        throw new Error(errorData.error ?? "Profile update failed");
      }

      const updatedUser = (await response.json()) as User;
      setUser(updatedUser);
      setName(updatedUser.name ?? "");
      setPhone(updatedUser.phone ?? "");
      toast.success("Profile updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Profile update failed");
    } finally {
      setSavingProfile(false);
    }
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
        throw new Error(errorData.error ?? "Password update failed");
      }

      toast.success("Password updated");
      setPasswordForm(initialPasswordForm);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Password update failed");
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Profile" subtitle="Manage admin profile (offline testing mode)" />

      <GlassCard className="space-y-4">
        <p className="text-sm font-semibold text-slate-800">Profile Details</p>

        {loading ? (
          <p className="text-sm text-slate-500">Loading profile...</p>
        ) : !user ? (
          <p className="text-sm text-slate-500">Profile unavailable.</p>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="admin-name">Name</Label>
                <Input id="admin-name" value={name} onChange={(event) => setName(event.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="admin-username">Username</Label>
                <Input id="admin-username" value={user.username} readOnly />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="admin-phone">Phone</Label>
                <Input id="admin-phone" value={phone} onChange={(event) => setPhone(event.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="admin-role">Role</Label>
                <Input id="admin-role" value={user.role} readOnly />
              </div>
            </div>

            <div className="flex justify-end">
              <Button type="button" onClick={handleSaveProfile} disabled={savingProfile}>
                {savingProfile ? "Saving..." : "Save Profile"}
              </Button>
            </div>
          </>
        )}
      </GlassCard>

      <GlassCard className="space-y-4">
        <p className="text-sm font-semibold text-slate-800">Change Password</p>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="current-password">Current Password</Label>
            <Input
              id="current-password"
              type="password"
              value={passwordForm.currentPassword}
              onChange={(event) => setPasswordForm((prev) => ({ ...prev, currentPassword: event.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-password">New Password</Label>
            <Input
              id="new-password"
              type="password"
              value={passwordForm.newPassword}
              onChange={(event) => setPasswordForm((prev) => ({ ...prev, newPassword: event.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm-password">Confirm Password</Label>
            <Input
              id="confirm-password"
              type="password"
              value={passwordForm.confirmPassword}
              onChange={(event) => setPasswordForm((prev) => ({ ...prev, confirmPassword: event.target.value }))}
            />
          </div>
        </div>

        <div className="flex justify-end">
          <Button type="button" onClick={handlePasswordChange} disabled={savingPassword || loading || !user}>
            {savingPassword ? "Updating..." : "Update Password"}
          </Button>
        </div>
      </GlassCard>
    </div>
  );
}
