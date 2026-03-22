"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { GlassCard } from "@/components/shared/glass-card";
import { PageHeader } from "@/components/shared/page-header";
import { LogoutButton } from "@/components/shared/logout-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Site } from "@/lib/types";
import { useUser } from "@/hooks/use-user";
import { useForcemanLanguage } from "@/providers/foreman-language-provider";
import { foremanTranslations } from "@/lib/translations/foreman";

const MAX_PHOTO_BYTES = 2 * 1024 * 1024;

export default function ForemanProfilePage() {
  const { user, loading: userLoading } = useUser();
  const { language, switchLanguage } = useForcemanLanguage();
  const t = foremanTranslations[language];

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [siteName, setSiteName] = useState<string>("Unassigned");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    setName(user.name);
    setPhone(user.phone ?? "");
    setPhotoUrl(user.photo_url ?? null);
  }, [user]);

  useEffect(() => {
    if (!user?.site_id) {
      setSiteName("Unassigned");
      return;
    }

    let cancelled = false;
    const sessionUser = user;

    async function loadSite() {
      try {
        const response = await fetch("/api/sites", { cache: "no-store" });
        if (!response.ok) return;

        const sites = (await response.json()) as Site[];
        if (cancelled) return;

        const currentSite = sites.find((site) => site.id === sessionUser.site_id);
        setSiteName(currentSite?.name ?? "Unassigned");
      } catch {
        if (!cancelled) {
          setSiteName("Unassigned");
        }
      }
    }

    loadSite();

    return () => {
      cancelled = true;
    };
  }, [user]);

  const initials = useMemo(() => {
    const source = name || user?.name || "Foreman";
    return source
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("");
  }, [name, user?.name]);

  const onPhotoChange = async (event: { target: HTMLInputElement; currentTarget: HTMLInputElement }) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      event.target.value = "";
      return;
    }

    if (file.size > MAX_PHOTO_BYTES) {
      toast.error("Photo size must be 2MB or less");
      event.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : null;
      setPhotoUrl(result);
      toast.success("Photo selected. Save profile to apply.");
    };
    reader.readAsDataURL(file);
  };

  const saveProfile = async () => {
    if (!user) return;
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }

    try {
      setSaving(true);
      const response = await fetch(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim() || null,
          photo_url: photoUrl,
        }),
      });

      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to update profile");
      }

      toast.success("Profile updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Profile update failed");
    } finally {
      setSaving(false);
    }
  };

  const handleLanguageChange = (newLang: "en" | "hi") => {
    switchLanguage(newLang);
    const successMsg = newLang === "en"
      ? foremanTranslations.en.languageChanged
      : foremanTranslations.hi.languageChanged;
    toast.success(successMsg);
  };

  return (
    <div className="space-y-4 pb-20">
      <PageHeader title={t.profile} subtitle="Manage your details and logout" />

      <GlassCard className="space-y-4">
        {userLoading || !user ? (
          <p className="text-sm text-slate-500">Loading profile...</p>
        ) : (
          <>
            <div className="flex items-center gap-4">
              {photoUrl ? (
                <Image
                  src={photoUrl}
                  alt="Profile"
                  width={72}
                  height={72}
                  unoptimized
                  className="h-[72px] w-[72px] rounded-full border border-slate-200 object-cover"
                />
              ) : (
                <div className="flex h-[72px] w-[72px] items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-lg font-semibold text-slate-700">
                  {initials || "F"}
                </div>
              )}

              <div className="space-y-1 text-xs text-slate-500">
                <p>Upload profile photo (max 2MB)</p>
                <Input type="file" accept="image/*" onChange={onPhotoChange} />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="foreman-profile-name">Name</Label>
                <Input id="foreman-profile-name" value={name} onChange={(event) => setName(event.target.value)} />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="foreman-profile-phone">PhoneNumber</Label>
                <Input id="foreman-profile-phone" value={phone} onChange={(event) => setPhone(event.target.value)} />
              </div>

              <div className="rounded-lg border border-slate-200 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Username</p>
                <p className="mt-1 text-sm font-medium text-slate-800">@{user.username}</p>
              </div>

              <div className="rounded-lg border border-slate-200 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Site</p>
                <p className="mt-1 text-sm font-medium text-slate-800">{siteName}</p>
              </div>
            </div>

            <Button type="button" className="w-full" onClick={saveProfile} disabled={saving}>
              {saving ? "Saving..." : "Save Profile"}
            </Button>
          </>
        )}
      </GlassCard>

      <GlassCard className="space-y-3">
        <h3 className="font-semibold text-slate-900">{t.language}</h3>
        <p className="text-sm text-slate-600">{t.selectLanguage}</p>
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant={language === "en" ? "default" : "outline"}
            onClick={() => handleLanguageChange("en")}
          >
            {t.english}
          </Button>
          <Button
            type="button"
            variant={language === "hi" ? "default" : "outline"}
            onClick={() => handleLanguageChange("hi")}
          >
            {t.hindi}
          </Button>
        </div>
      </GlassCard>

      <GlassCard className="space-y-3">
        <p className="text-center text-sm text-slate-600">Sign out from your account</p>
        <div className="flex justify-center">
          <LogoutButton className="h-12 w-full max-w-sm text-base" variant="destructive" label="Logout" />
        </div>
      </GlassCard>
    </div>
  );
}
