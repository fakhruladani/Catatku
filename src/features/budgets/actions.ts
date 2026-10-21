"use server";

import { runMutation } from "@/server/mutation";
import { setBudget, setBudgetSchema } from "./service";

export async function setBudgetAction(input: unknown) {
  return runMutation(setBudgetSchema, input, setBudget);
}
