"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

type LogoutButtonProps = {
  className?: string;
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  label?: string;
};

export function LogoutButton({ className, variant = "outline", label = "Logout" }: LogoutButtonProps) {
  const router = useRouter();

  const onLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  return (
    <Button type="button" variant={variant} className={className} onClick={onLogout}>
      {label}
    </Button>
  );
}
