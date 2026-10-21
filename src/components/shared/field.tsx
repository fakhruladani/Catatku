import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";

export function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor?: string;
  error?: string[] | string;
  hint?: string;
  children: ReactNode;
}) {
  const msg = Array.isArray(error) ? error[0] : error;
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {msg ? (
        <p className="text-xs text-destructive" role="alert">
          {msg}
        </p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
      {message}
    </p>
  );
}
