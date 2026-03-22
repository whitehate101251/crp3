"use client";

import { useState } from "react";
import { toast } from "sonner";
import { GlassCard } from "@/components/shared/glass-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const onLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ username, password }),
      });

      const data = (await response.json()) as { error?: string; redirectTo?: string };

      if (!response.ok) {
        toast.error(data.error ?? "Login failed");
        return;
      }

      const redirectTo = data.redirectTo ?? "/";
      window.location.assign(redirectTo);
    } catch {
      toast.error("Unable to login. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <GlassCard className="w-full max-w-md" padding="lg">
        <h1 className="text-2xl font-semibold text-slate-900">Construction ERP</h1>
        <p className="mt-1 text-sm text-slate-600">Temporary login for functional UI setup.</p>

        <form className="mt-6 space-y-4" onSubmit={onLogin}>
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input id="username" placeholder="Enter username" required value={username} onChange={(event) => setUsername(event.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" placeholder="Enter password" required value={password} onChange={(event) => setPassword(event.target.value)} />
          </div>

          <Button type="submit" className="w-full bg-slate-800 hover:bg-slate-700" disabled={loading}>
            {loading ? "Logging in..." : "Login"}
          </Button>
        </form>

      </GlassCard>
    </main>
  );
}
