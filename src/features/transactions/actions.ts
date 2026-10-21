"use server";

import { runMutation } from "@/server/mutation";
import {
  applyPasteSchema,
  createTransactionSchema,
  deleteTransactionsSchema,
  updateTransactionSchema,
} from "./schemas";
import { applyPaste, createTransaction, deleteTransactions, updateTransaction } from "./service";

export async function createTransactionAction(input: unknown) {
  return runMutation(createTransactionSchema, input, createTransaction);
}
export async function updateTransactionAction(input: unknown) {
  return runMutation(updateTransactionSchema, input, updateTransaction);
}
export async function deleteTransactionsAction(input: unknown) {
  return runMutation(deleteTransactionsSchema, input, deleteTransactions);
}
export async function applyPasteAction(input: unknown) {
  return runMutation(applyPasteSchema, input, applyPaste);
}
