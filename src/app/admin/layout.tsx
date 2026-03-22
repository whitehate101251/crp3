"use client";

import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { ProfileDropdown } from "@/components/admin/profile-dropdown";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f4f6f9] md:grid md:grid-cols-[260px_1fr]">
      <div className="hidden md:block">
        <AdminSidebar />
      </div>
      <main className="p-4 md:p-6">
        <div className="mb-4 flex items-center justify-end">
          <ProfileDropdown />
        </div>
        {children}
      </main>
    </div>
  );
}
