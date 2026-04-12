import { type HTMLAttributes, type TdHTMLAttributes, type ThHTMLAttributes } from "react";

interface TableProps extends HTMLAttributes<HTMLTableElement> {
  /** テーブルをスクロール可能なコンテナで囲む */
  scrollable?: boolean;
}

export function Table({ scrollable = true, className = "", children, ...props }: TableProps) {
  const table = (
    <table
      className={["w-full border-collapse text-sm", className].join(" ")}
      {...props}
    >
      {children}
    </table>
  );

  if (scrollable) {
    return (
      <div className="w-full overflow-x-auto">
        {table}
      </div>
    );
  }

  return table;
}

export function TableHead({ className = "", children, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead className={["bg-[var(--color-bg-secondary)]", className].join(" ")} {...props}>
      {children}
    </thead>
  );
}

export function TableBody({ className = "", children, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody className={className} {...props}>
      {children}
    </tbody>
  );
}

export function TableRow({ className = "", children, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={[
        "border-b border-[var(--color-border)]",
        "even:bg-[#FAFAFA]",
        "hover:bg-[var(--color-accent-tint)] transition-colors duration-100",
        className,
      ].join(" ")}
      {...props}
    >
      {children}
    </tr>
  );
}

export function TableHeader({ className = "", children, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={[
        "px-4 py-3",
        "text-left text-xs font-semibold text-[var(--color-text-sub)]",
        "border-b border-[var(--color-border)]",
        "whitespace-nowrap",
        className,
      ].join(" ")}
      {...props}
    >
      {children}
    </th>
  );
}

export function TableCell({ className = "", children, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      className={[
        "px-4 py-3",
        "text-sm text-[var(--color-text)]",
        className,
      ].join(" ")}
      {...props}
    >
      {children}
    </td>
  );
}
