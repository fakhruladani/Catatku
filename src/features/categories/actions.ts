"use server";

import { runMutation } from "@/server/mutation";
import { archiveCategorySchema, createCategorySchema, updateCategorySchema } from "./schemas";
import { archiveCategory, createCategory, updateCategory } from "./service";

export async function createCategoryAction(input: unknown) {
  return runMutation(createCategorySchema, input, createCategory);
}
export async function updateCategoryAction(input: unknown) {
  return runMutation(updateCategorySchema, input, updateCategory);
}
export async function archiveCategoryAction(input: unknown) {
  return runMutation(archiveCategorySchema, input, archiveCategory);
}
