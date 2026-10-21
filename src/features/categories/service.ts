import "server-only";
import type { z } from "zod";
import type { UserCtx } from "@/server/auth/session";
import { conflict, invalid, notFound } from "@/server/errors";
import type {
  archiveCategorySchema,
  CreateCategoryInput,
  listCategoriesSchema,
  UpdateCategoryInput,
} from "./schemas";

export interface CategoryDto {
  id: string;
  name: string;
  type: "INCOME" | "EXPENSE";
  parentId: string | null;
  icon: string;
  color: string;
  archived: boolean;
  children: CategoryDto[];
}

type Row = Awaited<ReturnType<UserCtx["db"]["category"]["findFirst"]>> & {};

function toDto(c: Row): CategoryDto {
  return {
    id: c.id,
    name: c.name,
    type: c.type,
    parentId: c.parentId,
    icon: c.icon,
    color: c.color,
    archived: c.archivedAt !== null,
    children: [],
  };
}

/** Kategori dalam bentuk pohon (induk -> subkategori). */
export async function listCategories(
  ctx: UserCtx,
  input: z.output<typeof listCategoriesSchema> = {},
): Promise<CategoryDto[]> {
  const rows = await ctx.db.category.findMany({
    where: {
      ...(input.type ? { type: input.type } : {}),
      ...(input.includeArchived ? {} : { archivedAt: null }),
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  const byId = new Map(rows.map((r) => [r.id, toDto(r)]));
  const roots: CategoryDto[] = [];
  for (const dto of byId.values()) {
    const parent = dto.parentId ? byId.get(dto.parentId) : undefined;
    if (parent) parent.children.push(dto);
    else if (!dto.parentId) roots.push(dto);
    // anak dari induk yang diarsipkan tidak tampil saat includeArchived=false
  }
  return roots;
}

async function findOwn(ctx: UserCtx, id: string) {
  const c = await ctx.db.category.findFirst({ where: { id } });
  if (!c) throw notFound("Kategori");
  return c;
}

/** Validasi induk: milik user, level teratas, tipe sama, tidak diarsipkan. */
async function assertValidParent(ctx: UserCtx, parentId: string, type: "INCOME" | "EXPENSE", selfId?: string) {
  if (parentId === selfId) throw invalid("Kategori tidak bisa menjadi induk dirinya sendiri");
  const parent = await ctx.db.category.findFirst({ where: { id: parentId } });
  if (!parent) throw notFound("Kategori induk");
  if (parent.parentId) throw invalid("Subkategori hanya boleh 1 level");
  if (parent.type !== type) throw invalid("Tipe kategori induk harus sama");
  if (parent.archivedAt) throw invalid("Kategori induk sudah diarsipkan");
}

export async function createCategory(ctx: UserCtx, input: CreateCategoryInput): Promise<{ id: string }> {
  if (input.parentId) await assertValidParent(ctx, input.parentId, input.type);
  const count = await ctx.db.category.count();
  return ctx.db.category.create({
    data: {
      userId: ctx.userId,
      name: input.name,
      type: input.type,
      parentId: input.parentId ?? null,
      icon: input.icon,
      color: input.color,
      sortOrder: count,
    },
    select: { id: true },
  });
}

export async function updateCategory(ctx: UserCtx, input: UpdateCategoryInput): Promise<{ id: string }> {
  const current = await findOwn(ctx, input.id);
  const parentId = input.parentId === undefined ? current.parentId : input.parentId;
  if (parentId !== current.parentId) {
    if (parentId) {
      const childCount = await ctx.db.category.count({ where: { parentId: current.id } });
      if (childCount > 0) throw invalid("Kategori yang punya subkategori tidak bisa dijadikan subkategori");
      await assertValidParent(ctx, parentId, current.type, current.id);
    }
  }
  await ctx.db.category.update({
    where: { id: input.id },
    data: { name: input.name, icon: input.icon, color: input.color, parentId },
  });
  return { id: input.id };
}

export async function archiveCategory(
  ctx: UserCtx,
  input: z.output<typeof archiveCategorySchema>,
): Promise<{ id: string }> {
  const c = await findOwn(ctx, input.id);
  if (!input.archived && c.parentId) {
    const parent = await ctx.db.category.findFirst({ where: { id: c.parentId } });
    if (parent?.archivedAt) throw conflict("Pulihkan kategori induknya terlebih dahulu");
  }
  const archivedAt = input.archived ? new Date() : null;
  await ctx.db.$transaction(async (tx) => {
    await tx.category.update({ where: { id: c.id }, data: { archivedAt } });
    // Mengarsipkan induk ikut mengarsipkan subkategorinya (memulihkan tidak otomatis)
    if (input.archived) {
      await tx.category.updateMany({ where: { parentId: c.id, archivedAt: null }, data: { archivedAt } });
    }
  });
  return { id: c.id };
}

async function isCategoryUsed(ctx: UserCtx, id: string): Promise<boolean> {
  const [tx, budgets] = await Promise.all([
    ctx.db.transaction.count({ where: { categoryId: id } }),
    ctx.db.budget.count({ where: { categoryId: id } }),
  ]);
  return tx + budgets > 0;
}

/**
 * Onboarding: pertahankan kategori yang dipilih.
 * Kategori lain dihapus bila belum dipakai, diarsipkan bila sudah dipakai.
 * Jika subkategori dipilih, induknya otomatis dipertahankan.
 */
export async function keepOnlyCategories(ctx: UserCtx, input: { keepIds: string[] }): Promise<{ kept: number }> {
  const all = await ctx.db.category.findMany({ select: { id: true, parentId: true } });
  const keep = new Set(input.keepIds.filter((id) => all.some((c) => c.id === id)));
  for (const c of all) {
    if (keep.has(c.id) && c.parentId) keep.add(c.parentId);
  }
  const removeChildrenFirst = all
    .filter((c) => !keep.has(c.id))
    .sort((a, b) => (a.parentId ? 0 : 1) - (b.parentId ? 0 : 1));

  for (const c of removeChildrenFirst) {
    const hasKeptChild = all.some((x) => x.parentId === c.id && keep.has(x.id));
    if (hasKeptChild) continue;
    if (await isCategoryUsed(ctx, c.id)) {
      await ctx.db.category.update({ where: { id: c.id }, data: { archivedAt: new Date() } });
    } else {
      const children = await ctx.db.category.count({ where: { parentId: c.id } });
      if (children === 0) await ctx.db.category.delete({ where: { id: c.id } });
      else await ctx.db.category.update({ where: { id: c.id }, data: { archivedAt: new Date() } });
    }
  }
  return { kept: keep.size };
}
