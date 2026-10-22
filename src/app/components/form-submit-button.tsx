"use client";

import { useFormStatus } from "react-dom";

export function FormSubmitButton({ children, className = "quiet-button", pendingLabel = "Сохраняем…" }: { children: React.ReactNode; className?: string; pendingLabel?: string }) {
  const { pending } = useFormStatus();
  return <button className={className} type="submit" disabled={pending}>{pending ? pendingLabel : children}</button>;
}
