"use client";

import { useFormStatus } from "react-dom";

export function FormSubmitButton({ children, className = "quiet-button", pendingLabel, disabled = false }: { children: React.ReactNode; className?: string; pendingLabel: string; disabled?: boolean }) {
  const { pending } = useFormStatus();
  return <button className={className} type="submit" disabled={pending || disabled}>{pending ? pendingLabel : children}</button>;
}
