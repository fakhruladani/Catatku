"use server";

import { refresh } from "next/cache";
import type { z } from "zod";
import { type ActionResult, toActionError, zodFieldErrors } from "@/server/action";
import { getSessionUser } from "@/server/auth/session";
import {
  type AdminCtx,
  createUser,
  createUserSchema,
  deleteUser,
  deleteUserSchema,
  resetPasswordSchema,
  resetUserPassword,
} from "./service";

async function runAdmin<S extends z.ZodType, O>(
  schema: S,
  raw: unknown,
  fn: (ctx: AdminCtx, input: z.output<S>) => Promise<O>,
): Promise<ActionResult<O>> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Sesi berakhir. Silakan masuk lagi." };
  if (user.role !== "ADMIN") return { ok: false, error: "Hanya admin yang boleh melakukan ini" };
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Periksa kembali isian", fieldErrors: zodFieldErrors(parsed.error) };
  try {
    const data = await fn({ adminId: user.id }, parsed.data);
    refresh();
    return { ok: true, data };
  } catch (e) {
    return toActionError(e);
  }
}

export async function createUserAction(input: unknown) {
  return runAdmin(createUserSchema, input, createUser);
}
export async function resetUserPasswordAction(input: unknown) {
  return runAdmin(resetPasswordSchema, input, resetUserPassword);
}
export async function deleteUserAction(input: unknown) {
  return runAdmin(deleteUserSchema, input, deleteUser);
}
