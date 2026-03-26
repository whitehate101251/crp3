"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardCheck, Home, User, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/site-incharge", label: "Home", Icon: Home },
  { href: "/site-incharge/review", label: "Review", Icon: ClipboardCheck },
  { href: "/site-incharge/foremen", label: "Foremen", Icon: Users },
  { href: "/site-incharge/profile", label: "Profile", Icon: User },
];

export function SIBottomNav() {
  const pathname = usePathname();

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
