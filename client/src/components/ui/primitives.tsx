import { ReactNode } from "react";
import { Inbox } from "lucide-react";
import { cn } from "../../lib/cn";

export function Button({ children, variant = "primary", className, ...p }: { children: ReactNode; variant?: "primary" | "ghost" | "outline" | "danger" } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...p}
      className={cn(
        "btn-press inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition focus:outline-none disabled:opacity-50",
        variant === "primary" && "bg-blue-700 text-white hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500",
        variant === "ghost" && "text-stone-600 hover:bg-stone-200/60 hover:text-stone-900 dark:text-zinc-300 dark:hover:bg-zinc-800",
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
    <div className={cn("card-lift rounded-xl border border-stone-200 bg-white shadow-subtle dark:border-zinc-800 dark:bg-zinc-900", className)}>
      <div className="p-4">{children}</div>
    </div>
  );
}

export function EmptyState({ title, hint, action }: { title: string; hint: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-stone-300 bg-white px-6 py-12 text-center dark:border-zinc-700 dark:bg-zinc-900">
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-stone-100 text-stone-500 dark:bg-zinc-800 dark:text-zinc-300">
        <Inbox size={20} />
      </span>
      <p className="mt-3 text-sm font-bold">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-stone-500">{hint}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("shimmer rounded-xl", className)} />;
}

const tones: Record<string, string> = {
  default: "bg-stone-200/70 text-stone-700 dark:bg-zinc-800 dark:text-zinc-200",
  red: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  amber: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  green: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  blue: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
};

export function Badge({ children, tone = "default" }: { children: ReactNode; tone?: keyof typeof tones }) {
  return <span className={cn("inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium", tones[tone])}>{children}</span>;
}

