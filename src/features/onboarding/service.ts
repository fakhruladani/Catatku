import "server-only";
import { z } from "zod";
import { keepOnlyCategories } from "@/features/categories/service";
import { zStartDay } from "@/features/preferences/schemas";
import { updatePreferences } from "@/features/preferences/service";
import { zId, zMoney } from "@/lib/validation";
import type { UserCtx } from "@/server/auth/session";
import { markOnboardingCompleted, updateOwnProfile } from "@/server/db/self";

export const profileStepSchema = z.object({
  nickname: z.string().trim().max(30, "Nama panggilan maksimal 30 karakter").optional().default(""),
});
export const openingStepSchema = z.object({ openingBalance: zMoney });
export const categoriesStepSchema = z.object({ keepIds: z.array(zId).max(200) });
export const monthStartStepSchema = z.object({ financialMonthStartDay: zStartDay });

export async function saveProfileStep(ctx: UserCtx, input: z.output<typeof profileStepSchema>) {
  await updateOwnProfile(ctx, { nickname: input.nickname || null });
  return null;
}

export async function saveOpeningStep(ctx: UserCtx, input: z.output<typeof openingStepSchema>) {
  await updatePreferences(ctx, { openingBalance: input.openingBalance });
  return null;
}

export async function saveCategoriesStep(ctx: UserCtx, input: z.output<typeof categoriesStepSchema>) {
  return keepOnlyCategories(ctx, input);
}

/** Langkah terakhir: simpan tanggal awal bulan lalu tandai onboarding selesai. */
export async function finishOnboarding(ctx: UserCtx, input: z.output<typeof monthStartStepSchema>) {
  await updatePreferences(ctx, { financialMonthStartDay: input.financialMonthStartDay });
  await markOnboardingCompleted(ctx);
  return null;
}
