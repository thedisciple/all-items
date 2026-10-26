"use client";

import { useFormStatus } from "react-dom";
import { InventoryField } from "./inventory-provider";

export function FormSubmitButton({ children, className = "quiet-button", pendingLabel, disabled = false, label }: { children: React.ReactNode; className?: string; pendingLabel: string; disabled?: boolean; label?: string }) {
  const { pending } = useFormStatus();
  return <><InventoryField/><button aria-label={label} title={label} className={className} type="submit" disabled={pending || disabled}>{pending ? pendingLabel : children}</button></>;
}
