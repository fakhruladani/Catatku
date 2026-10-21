"use client";

import { Input } from "@/components/ui/input";
import { formatThousands } from "@/lib/money";

/**
 * Input nominal rupiah. Nilai disimpan sebagai string digit (mis. "1250000", "-5000"),
 * ditampilkan dengan pemisah ribuan ("1.250.000"). Tidak pernah memakai float.
 */
export function MoneyInput({
  value,
  onChange,
  allowNegative = false,
  id,
  name,
  invalid,
  placeholder = "0",
}: {
  value: string;
  onChange: (digits: string) => void;
  allowNegative?: boolean;
  id?: string;
  name?: string;
  invalid?: boolean;
  placeholder?: string;
}) {
  const display = /^-?\d+$/.test(value) ? formatThousands(value) : value === "-" ? "-" : "";
  return (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-sm text-muted-foreground">
        Rp
      </span>
      <Input
        id={id}
        name={name}
        inputMode="numeric"
        autoComplete="off"
        className="pl-9 tabular-nums"
        placeholder={placeholder}
        aria-invalid={invalid || undefined}
        value={display}
        onChange={(e) => {
          const raw = e.target.value;
          const neg = allowNegative && raw.trim().startsWith("-");
          const digits = raw.replace(/\D/g, "").replace(/^0+(?=\d)/, "").slice(0, 15);
          onChange(neg ? (digits ? `-${digits}` : "-") : digits);
        }}
      />
    </div>
  );
}
