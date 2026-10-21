import { z } from "zod";
import { isPeriodKey } from "@/lib/period";
import { zId, zMoneyPositive, zPlainDate } from "@/lib/validation";

export const ENTRY_TYPES = ["INCOME", "EXPENSE"] as const;
export const ENTRY_TYPE_LABELS = { INCOME: "Masuk", EXPENSE: "Keluar" } as const;

export const zPeriodKey = z.string().refine(isPeriodKey, "Periode tidak valid");

const fields = {
  date: zPlainDate,
  type: z.enum(ENTRY_TYPES, { error: "Jenis harus Masuk atau Keluar" }),
  amount: zMoneyPositive,
  description: z.string().trim().max(200, "Keterangan maksimal 200 karakter").default(""),
  categoryId: zId.nullable().default(null),
};

export const createTransactionSchema = z.object(fields);

export const updateTransactionSchema = z.object({
  id: zId,
  date: fields.date.optional(),
  type: fields.type.optional(),
  amount: fields.amount.optional(),
  description: z.string().trim().max(200, "Keterangan maksimal 200 karakter").optional(),
  categoryId: zId.nullable().optional(),
});

export const deleteTransactionsSchema = z.object({ ids: z.array(zId).min(1).max(1000) });

/** Hasil paste dari Excel: sebagian baris memperbarui baris yang ada, sisanya baris baru. */
export const applyPasteSchema = z
  .object({
    updates: z.array(updateTransactionSchema).max(1000),
    creates: z.array(createTransactionSchema).max(1000),
  })
  .refine((v) => v.updates.length + v.creates.length > 0, "Tidak ada data")
  .refine((v) => v.updates.length + v.creates.length <= 1000, "Maksimal 1000 baris sekali paste");

export const sheetSchema = z.object({ periodKey: zPeriodKey });
export const yearSchema = z.object({ year: z.coerce.number().int().min(2000).max(2100) });

export type CreateTransactionInput = z.output<typeof createTransactionSchema>;
export type UpdateTransactionInput = z.output<typeof updateTransactionSchema>;
