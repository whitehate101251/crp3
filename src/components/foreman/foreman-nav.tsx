"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList, Home, User, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { useForcemanLanguage } from "@/providers/foreman-language-provider";
import { foremanTranslations } from "@/lib/translations/foreman";

export function ForemanNav() {
  const pathname = usePathname();
  const { language } = useForcemanLanguage();
  const t = foremanTranslations[language];

  const items = [
    { href: "/foreman", label: t.home, Icon: Home },
    { href: "/foreman/workers", label: t.workers, Icon: Users },
    { href: "/foreman/attendance", label: t.attendance, Icon: ClipboardList },
    { href: "/foreman/profile", label: t.profile, Icon: User },
  ];

  return (
    <nav className="glass-card fixed inset-x-3 bottom-3 z-20 grid grid-cols-4 gap-2 bg-white/85 p-2">
      {items.map(({ href, label, Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex min-h-12 flex-col items-center justify-center rounded-lg px-1 text-xs",
              active ? "bg-slate-800 text-white" : "text-slate-700",
            )}
          >
            <Icon className="mb-1 h-4 w-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
