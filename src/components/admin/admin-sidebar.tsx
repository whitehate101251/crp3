"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  CheckSquare,
  ClipboardList,
  FileSpreadsheet,
  LayoutDashboard,
  Settings2,
  User,
  UserPlus,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const adminNavItems = [
  { href: "/admin", label: "Home", Icon: LayoutDashboard },
  { href: "/admin/approval", label: "Admin Approval", Icon: CheckSquare },
  { href: "/admin/sites", label: "Manage Sites", Icon: Building2 },
  { href: "/admin/add-user", label: "Add User", Icon: UserPlus },
  { href: "/admin/manage-users", label: "Manage Users", Icon: Settings2 },
  { href: "/admin/attendance", label: "Status", Icon: ClipboardList },
  { href: "/admin/attendance-records", label: "Attendance Records", Icon: FileSpreadsheet },
  { href: "/admin/si-attendance", label: "SI Attendance", Icon: Users },
  { href: "/admin/profile", label: "Profile", Icon: User },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="glass-card h-full min-h-screen w-full p-4">
      <p className="mb-4 px-2 text-lg font-semibold text-slate-700">Timri Constructions</p>
      <nav className="space-y-1">
        {adminNavItems.map(({ href, label, Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-slate-800 text-white"
                  : "text-slate-700 hover:bg-white/80 hover:text-slate-900",
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
