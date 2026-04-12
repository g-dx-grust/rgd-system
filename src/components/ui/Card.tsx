import { type HTMLAttributes } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: "none" | "sm" | "md" | "lg";
}

const PADDING_STYLES = {
  none: "",
  sm: "p-3",
  md: "p-4",
  lg: "p-6",
} as const;

export function Card({
  padding = "md",
  className = "",
  children,
  ...props
}: CardProps) {
  return (
    <div
      className={[
        "bg-white",
        "border border-[var(--color-border)]",
        "rounded-[var(--radius-sm)]",
        "shadow-[0_1px_3px_rgba(0,0,0,0.08)]",
        PADDING_STYLES[padding],
        className,
      ].join(" ")}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className = "", children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={[
        "flex items-center justify-between",
        "pb-3 mb-4",
        "border-b border-[var(--color-border)]",
        className,
      ].join(" ")}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardTitle({ className = "", children, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      className={[
        "text-base font-semibold text-[var(--color-text)]",
        className,
      ].join(" ")}
      {...props}
    >
      {children}
    </h2>
  );
}
