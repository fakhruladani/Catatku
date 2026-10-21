"use client";

import { Check } from "lucide-react";
import { COLOR_SWATCHES, DynamicIcon } from "./icon";

export function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Warna">
      {COLOR_SWATCHES.map((c) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={value === c}
          aria-label={c}
          onClick={() => onChange(c)}
          className="inline-flex size-7 items-center justify-center rounded-full ring-offset-2 ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
          style={{ backgroundColor: c }}
        >
          {value === c && <Check className="size-4 text-white" />}
        </button>
      ))}
    </div>
  );
}

export function IconPicker({ value, onChange, icons }: { value: string; onChange: (i: string) => void; icons: readonly string[] }) {
  return (
    <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Ikon">
      {icons.map((i) => (
        <button
          key={i}
          type="button"
          role="radio"
          aria-checked={value === i}
          aria-label={i}
          onClick={() => onChange(i)}
          className={`inline-flex size-9 items-center justify-center rounded-lg border ${
            value === i ? "border-foreground bg-muted" : "border-transparent hover:bg-muted/60"
          }`}
        >
          <DynamicIcon name={i} className="size-4" />
        </button>
      ))}
    </div>
  );
}
