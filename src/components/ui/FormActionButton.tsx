"use client";

import { AsyncActionButton } from "./AsyncActionButton";

interface ActionResult {
  error?: string;
  success?: boolean;
}

type FormServerAction = (
  prevState: ActionResult | null,
  formData: FormData
) => Promise<ActionResult>;

interface FormActionButtonProps {
  label: string;
  confirmMessage: string;
  action: FormServerAction;
  fields: Record<string, string | null | undefined>;
  pendingLabel?: string;
  variant?: "primary" | "secondary" | "danger";
  size?: "sm" | "md";
  className?: string;
  wrapperClassName?: string;
  disabled?: boolean;
  refreshOnSuccess?: boolean;
  onSuccess?: () => void;
  align?: "start" | "end";
}

export function FormActionButton({
  action,
  fields,
  ...props
}: FormActionButtonProps) {
  return (
    <AsyncActionButton
      {...props}
      action={async () => {
        const formData = new FormData();
        Object.entries(fields).forEach(([key, value]) => {
          if (value != null) {
            formData.set(key, value);
          }
        });
        return action(null, formData);
      }}
    />
  );
}
