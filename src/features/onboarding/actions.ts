"use server";

import { refresh } from "next/cache";
import type { ActionResult } from "@/server/action";
import { toActionError } from "@/server/action";
import { getSessionUser } from "@/server/auth/session";
import { removeAvatar, saveAvatar } from "@/server/avatar";
import { updateOwnProfile } from "@/server/db/self";
import { runMutation } from "@/server/mutation";
import {
  categoriesStepSchema,
  finishOnboarding,
  monthStartStepSchema,
  openingStepSchema,
  profileStepSchema,
  saveCategoriesStep,
  saveOpeningStep,
  saveProfileStep,
} from "./service";

export async function saveProfileStepAction(input: unknown) {
  return runMutation(profileStepSchema, input, saveProfileStep);
}
export async function saveOpeningStepAction(input: unknown) {
  return runMutation(openingStepSchema, input, saveOpeningStep);
}
export async function saveCategoriesStepAction(input: unknown) {
  return runMutation(categoriesStepSchema, input, saveCategoriesStep);
}
export async function finishOnboardingAction(input: unknown) {
  return runMutation(monthStartStepSchema, input, finishOnboarding);
}

/** Upload foto profil (FormData field "avatar"). userId diambil dari sesi. */
export async function uploadAvatarAction(formData: FormData): Promise<ActionResult<{ image: string }>> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Sesi berakhir. Silakan masuk lagi." };
  const file = formData.get("avatar");
  if (!(file instanceof File)) return { ok: false, error: "Pilih foto terlebih dahulu" };
  try {
    await saveAvatar(user.id, file);
    const image = `/api/avatar?v=${Date.now()}`;
    await updateOwnProfile({ userId: user.id }, { image });
    refresh();
    return { ok: true, data: { image } };
  } catch (err) {
    return toActionError(err);
  }
}

export async function removeAvatarAction(): Promise<ActionResult<null>> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Sesi berakhir. Silakan masuk lagi." };
  await removeAvatar(user.id);
  await updateOwnProfile({ userId: user.id }, { image: null });
  refresh();
  return { ok: true, data: null };
}
