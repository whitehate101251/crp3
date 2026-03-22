"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { GlassCard } from "@/components/shared/glass-card";
import { PageLoadingSkeleton } from "@/components/shared/page-loading-skeleton";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Site, User, UserRole } from "@/lib/types";

type UserForm = {
  name: string;
  father_name: string;
  username: string;
  phone: string;
  password: string;
  role: UserRole;
  site_id: string;
  parent_id: string;
};

const initialForm: UserForm = {
  name: "",
  father_name: "",
  username: "",
  phone: "",
  password: "",
  role: "SITE_INCHARGE",
  site_id: "NONE",
  parent_id: "NONE",
};

export default function AdminAddUserPage() {
  const [form, setForm] = useState<UserForm>(initialForm);
  const [sites, setSites] = useState<Site[]>([]);
  const [siteIncharges, setSiteIncharges] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function loadReferenceData() {
      try {
        const [sitesRes, sisRes] = await Promise.all([
          fetch("/api/sites"),
          fetch("/api/users?role=SITE_INCHARGE"),
        ]);

        if (!sitesRes.ok || !sisRes.ok) {
          throw new Error("Failed to load form data");
        }

        const [sitesData, sisData] = (await Promise.all([sitesRes.json(), sisRes.json()])) as [Site[], User[]];
        setSites(sitesData);
        setSiteIncharges(sisData);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Unable to load form data");
      } finally {
        setLoading(false);
      }
    }

    loadReferenceData();
  }, []);

  const parentSiOptions = useMemo(() => {
    if (form.site_id === "NONE") return siteIncharges;
    return siteIncharges.filter((si) => si.site_id === form.site_id);
  }, [form.site_id, siteIncharges]);

  const showSiteField = form.role === "SITE_INCHARGE" || form.role === "FOREMAN";
  const showParentField = form.role === "FOREMAN";

  const updateForm = <K extends keyof UserForm>(key: K, value: UserForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const resetForm = () => setForm(initialForm);

  const validate = () => {
    if (!form.name.trim()) return "Name is required";
    if (!form.username.trim()) return "Username is required";
    if (!form.password.trim()) return "Password is required";
    return null;
  };

  const handleSubmit = async () => {
    const validationError = validate();
    if (validationError) {
      toast.error(validationError);
      return;
    }

    try {
      setSubmitting(true);
      const response = await fetch("/api/users/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          father_name: form.father_name.trim() || null,
          username: form.username.trim(),
          phone: form.phone.trim() || null,
          password: form.password,
          role: form.role,
          site_id: showSiteField && form.site_id !== "NONE" ? form.site_id : null,
          parent_id: showParentField && form.parent_id !== "NONE" ? form.parent_id : null,
        }),
      });

      if (!response.ok) {
        const errorData = (await response.json()) as { error?: string };
        throw new Error(errorData.error ?? "Failed to create user");
      }

      toast.success("User created successfully");
      resetForm();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create user");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Add User" subtitle="Create Admin, Site Incharge, or Foreman account" />

      <GlassCard className="space-y-4">
        {loading ? (
          <PageLoadingSkeleton rows={4} />
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(event) => updateForm("name", event.target.value)}
                  placeholder="Full name"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="father-name">Father Name (optional)</Label>
                <Input
                  id="father-name"
                  value={form.father_name}
                  onChange={(event) => updateForm("father_name", event.target.value)}
                  placeholder="Father name"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  value={form.username}
                  onChange={(event) => updateForm("username", event.target.value)}
                  placeholder="Unique username"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="phone">Phone (optional)</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={form.phone}
                  onChange={(event) => updateForm("phone", event.target.value)}
                  placeholder="Phone number"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={form.password}
                  onChange={(event) => updateForm("password", event.target.value)}
                  placeholder="Initial password"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-1.5">
                <Label>Role</Label>
                <Select
                  value={form.role}
                  onValueChange={(value) => {
                    const role = (value as UserRole) ?? "SITE_INCHARGE";
                    setForm((prev) => ({
                      ...prev,
                      role,
                      site_id: role === "ADMIN" ? "NONE" : prev.site_id,
                      parent_id: role === "FOREMAN" ? prev.parent_id : "NONE",
                    }));
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ADMIN">Admin</SelectItem>
                    <SelectItem value="SITE_INCHARGE">Site Incharge</SelectItem>
                    <SelectItem value="FOREMAN">Foreman</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {showSiteField && (
                <div className="space-y-1.5">
                  <Label>Site</Label>
                  <Select
                    value={form.site_id}
                    onValueChange={(value) => {
                      const siteId = value ?? "NONE";
                      setForm((prev) => ({
                        ...prev,
                        site_id: siteId,
                        parent_id: prev.role === "FOREMAN" ? "NONE" : prev.parent_id,
                      }));
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select site" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NONE">Select site</SelectItem>
                      {sites.map((site) => (
                        <SelectItem key={site.id} value={site.id}>
                          {site.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {showParentField && (
                <div className="space-y-1.5">
                  <Label>Parent SI</Label>
                  <Select value={form.parent_id} onValueChange={(value) => updateForm("parent_id", value ?? "NONE")}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select parent SI" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NONE">Select SI</SelectItem>
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

            <div className="flex justify-end">
              <Button type="button" onClick={handleSubmit} disabled={submitting}>
                {submitting ? "Creating..." : "Create User"}
              </Button>
            </div>
          </>
        )}
      </GlassCard>
    </div>
  );
}
