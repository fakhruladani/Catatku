"use client";

import { passwordStrength } from "@/lib/password-strength";

const COLORS = ["bg-red-500", "bg-orange-500", "bg-yellow-500", "bg-lime-500", "bg-emerald-500"];

export function PasswordStrengthMeter({ password }: { password: string }) {
  if (!password) return null;
  const { score, label } = passwordStrength(password);
  return (
    <div className="grid gap-1" aria-live="polite">
      <div className="flex gap-1">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={`h-1 flex-1 rounded-full ${i < Math.max(1, score) ? COLORS[score] : "bg-muted"}`} />
        ))}
      </div>
      <span className="text-xs text-muted-foreground">Kekuatan: {label}</span>
    </div>
  );
}
