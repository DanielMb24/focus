import { cn } from "../../lib/cn";

/** Logo Focus (SVG vectoriel, net à toutes les tailles). */
export function Logo({ size = 36, className }: { size?: number; className?: string }) {
  return (
    <img
      src="/logo.svg"
      width={size}
      height={size}
      alt="Focus"
      draggable={false}
      className={cn("shrink-0 rounded-[28%]", className)}
      style={{ width: size, height: size }}
    />
  );
}
