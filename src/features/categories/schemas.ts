import { z } from "zod";
import { zColor, zIcon, zId, zName } from "@/lib/validation";

export const CATEGORY_TYPES = ["INCOME", "EXPENSE"] as const;

export const createCategorySchema = z.object({
  name: zName("Nama kategori", 40),
  type: z.enum(CATEGORY_TYPES, { error: "Jenis kategori tidak valid" }),
  parentId: zId.nullable().optional(),
  icon: zIcon,
  color: zColor,
});

export const updateCategorySchema = z.object({
  id: zId,
  name: zName("Nama kategori", 40),
  parentId: zId.nullable().optional(),
  icon: zIcon,
  color: zColor,
});

export const archiveCategorySchema = z.object({ id: zId, archived: z.boolean() });

export const listCategoriesSchema = z.object({
  type: z.enum(CATEGORY_TYPES).optional(),
  includeArchived: z.boolean().optional(),
});

export type CreateCategoryInput = z.output<typeof createCategorySchema>;
export type UpdateCategoryInput = z.output<typeof updateCategorySchema>;
