import { type HTMLAttributes } from "react";

type BadgeVariant = "default" | "accent" | "success" | "warning" | "error";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

/** border-radius: 9999px (ピル型) は禁止。最大 var(--radius-sm) = 4px */
const VARIANT_STYLES: Record<BadgeVariant, string> = {
  default:
    "bg-[var(--color-bg-secondary)] text-[var(--color-text-sub)] border border-[var(--color-border)]",
  accent:
    "bg-[var(--color-accent-tint)] text-[var(--color-accent)]",
  success:
    "bg-green-50 text-[var(--color-success)] border border-green-200",
  warning:
    "bg-yellow-50 text-[var(--color-warning)] border border-yellow-200",
  error:
    "bg-red-50 text-[var(--color-error)] border border-red-200",
};

export function Badge({
  variant = "default",
  className = "",
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={[
        "inline-flex items-center",
        "px-2 py-0.5",
        "text-xs font-medium",
        "rounded-[var(--radius-sm)]",
        VARIANT_STYLES[variant],
        className,
      ].join(" ")}
      {...props}
    >
      {children}
    </span>
  );
}
