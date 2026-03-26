import { SIBottomNav } from "@/components/site-incharge/si-bottom-nav";

export default function SiteInchargeLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f4f6f9] px-4 pb-24 pt-4 md:mx-auto md:max-w-5xl lg:max-w-6xl">
      {children}
      <SIBottomNav />
    </div>
  );
}
