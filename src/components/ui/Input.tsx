import { type InputHTMLAttributes, forwardRef } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  function Input({ label, error, hint, className = "", id, ...props }, ref) {
    const inputId = id ?? (label ? label.replace(/\s+/g, "-").toLowerCase() : undefined);

    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label
            htmlFor={inputId}
            className="text-sm font-medium text-[var(--color-text)]"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={[
            "h-9 w-full",
            "px-3",
            "text-sm text-[var(--color-text)]",
            "bg-white",
            "border rounded-[var(--radius-sm)]",
            "placeholder:text-[var(--color-text-muted)]",
            "transition-colors duration-150",
            "outline-none",
            error
              ? "border-[var(--color-error)] focus:border-[var(--color-error)] focus:ring-1 focus:ring-[var(--color-error)]"
              : "border-[var(--color-border-strong)] focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)]",
            "disabled:bg-[var(--color-bg-secondary)] disabled:cursor-not-allowed disabled:opacity-60",
            className,
          ].join(" ")}
          {...props}
        />
        {hint && !error && (
          <p className="text-xs text-[var(--color-text-muted)]">{hint}</p>
        )}
        {error && (
          <p className="text-xs text-[var(--color-error)]" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }
);
