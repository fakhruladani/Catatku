"use server";

import { runMutation } from "@/server/mutation";
import { updatePreferencesSchema } from "./schemas";
import { updatePreferences } from "./service";

export async function updatePreferencesAction(input: unknown) {
  return runMutation(updatePreferencesSchema, input, updatePreferences);
}
