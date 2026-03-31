import { cn } from "@/lib/utils";

type PageHeaderProps = {
  title: string;
  subtitle?: string;
  subtitleClassName?: string;
};

export function PageHeader({ title, subtitle, subtitleClassName }: PageHeaderProps) {
  return (
    <div className="mb-4">
      <h1 className="text-xl font-semibold tracking-tight text-slate-900 md:text-2xl">{title}</h1>
      {subtitle ? <p className={cn("mt-1 text-sm text-slate-600", subtitleClassName)}>{subtitle}</p> : null}
    </div>
  );
}
