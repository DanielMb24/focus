import { ReactNode } from "react";
import { Inbox } from "lucide-react";
import { cn } from "../../lib/cn";

export function Button({ children, variant = "primary", className, ...p }: { children: ReactNode; variant?: "primary" | "ghost" | "outline" | "danger" | "soft" } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...p}
      className={cn(
        "btn-press inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition focus:outline-none disabled:opacity-50",
        variant === "primary" && "bg-[#1d4ed8] text-white hover:bg-[#1e40af]",
        variant === "soft" && "bg-stone-100 text-stone-800 hover:bg-stone-200 dark:bg-zinc-800 dark:text-zinc-100",
        variant === "ghost" && "text-stone-600 hover:bg-stone-100 hover:text-stone-900 dark:text-zinc-300 dark:hover:bg-zinc-800",
        variant === "outline" && "border border-stone-300 bg-white hover:border-stone-500 dark:border-zinc-700 dark:bg-zinc-900",
        variant === "danger" && "bg-red-700 text-white hover:bg-red-800",
        className
      )}
    >
      {children}
    </button>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("card-lift card-app dark:border-zinc-800 dark:bg-zinc-900", className)}>
      <div className="p-4">{children}</div>
    </div>
  );
}

export function EmptyState({ title, hint, action }: { title: string; hint: string; action?: ReactNode }) {
  return (
    <div className="empty-dots flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#c9cfdb] bg-white px-6 py-12 text-center dark:border-zinc-700 dark:bg-zinc-900">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#eaf0ff] text-[#1d4ed8] ring-8 ring-[#f2f5ff] dark:bg-zinc-800 dark:text-zinc-200 dark:ring-zinc-800/50">
        <Inbox size={22} />
      </span>
      <p className="font-display mt-4 text-[19px] font-bold">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-stone-500">{hint}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("shimmer rounded-xl", className)} />;
}

const tones: Record<string, string> = {
  default: "bg-stone-100 text-stone-600 dark:bg-zinc-800 dark:text-zinc-200",
  red: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300",
  amber: "bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  green: "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  blue: "bg-blue-50 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  violet: "bg-stone-100 text-stone-600 dark:bg-violet-950 dark:text-violet-300",
};

export function Badge({ children, tone = "default" }: { children: ReactNode; tone?: keyof typeof tones }) {
  return <span className={cn("inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide", tones[tone])}>{children}</span>;
}

/** Pastille icône discrète (encre sur fond pierre). */
export function IconTile({ tone = "bg-stone-100 text-stone-700", children, className }: { tone?: string; children: ReactNode; className?: string }) {
  return (
    <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", tone, className)}>
      {children}
    </span>
  );
}

