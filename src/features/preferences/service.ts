import "server-only";
import type { UserCtx } from "@/server/auth/session";
import type { UpdatePreferencesInput } from "./schemas";

export interface PreferencesDto {
  theme: "LIGHT" | "DARK" | "SYSTEM";
  financialMonthStartDay: number;
  openingBalance: bigint;
}

export async function getPreferences(ctx: UserCtx): Promise<PreferencesDto> {
  let pref = await ctx.db.userPreference.findUnique({ where: { userId: ctx.userId } });
  if (!pref) pref = await ctx.db.userPreference.create({ data: { userId: ctx.userId } });
  return {
    theme: pref.theme,
    financialMonthStartDay: pref.financialMonthStartDay,
    openingBalance: pref.openingBalance,
  };
}

export async function updatePreferences(ctx: UserCtx, input: UpdatePreferencesInput): Promise<PreferencesDto> {
  await getPreferences(ctx); // pastikan baris ada
  await ctx.db.userPreference.update({
    where: { userId: ctx.userId },
    data: {
      ...(input.theme ? { theme: input.theme } : {}),
      ...(input.financialMonthStartDay ? { financialMonthStartDay: input.financialMonthStartDay } : {}),
      ...(input.openingBalance !== undefined ? { openingBalance: input.openingBalance } : {}),
    },
  });
  return getPreferences(ctx);
}
