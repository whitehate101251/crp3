import { LanguageProvider } from "@/providers/foreman-language-provider";
import { ForemanNav } from "@/components/foreman/foreman-nav";

export default function ForemanLayout({ children }: { children: React.ReactNode }) {
  return (
    <LanguageProvider>
      <div className="min-h-screen bg-[#f4f6f9] px-4 pb-24 pt-4 md:mx-auto md:max-w-3xl">
        {children}
        <ForemanNav />
      </div>
    </LanguageProvider>
  );
}
