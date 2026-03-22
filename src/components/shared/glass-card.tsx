import { cn } from "@/lib/utils";

type GlassCardProps = {
  children: React.ReactNode;
  className?: string;
  padding?: "none" | "sm" | "md" | "lg";
};

const paddingClass: Record<NonNullable<GlassCardProps["padding"]>, string> = {
  none: "",
  sm: "p-3",
  md: "p-4",
  lg: "p-6",
};

export function GlassCard({ children, className, padding = "md" }: GlassCardProps) {
  return <div className={cn("glass-card", paddingClass[padding], className)}>{children}</div>;
}
