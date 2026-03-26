"use client";

import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { AdminMobileMenu } from "@/components/admin/admin-mobile-menu";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f4f6f9] md:grid md:grid-cols-[260px_1fr]">
      <div className="hidden md:block">
        <AdminSidebar />
      </div>
      <main className="p-4 md:p-6">
        <div className="mb-4 md:hidden">
          <AdminMobileMenu />
        </div>
        {children}
      </main>
    </div>
  );
}
