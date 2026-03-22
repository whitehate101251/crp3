import { SIBottomNav } from "@/components/site-incharge/si-bottom-nav";

export default function SiteInchargeLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f4f6f9] px-4 pb-24 pt-4 md:mx-auto md:max-w-3xl md:pb-6">
      {children}
      <SIBottomNav />
    </div>
  );
}
