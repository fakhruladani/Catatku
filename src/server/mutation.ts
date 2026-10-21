import "server-only";
import { refresh } from "next/cache";
import type { z } from "zod";
import { type ActionResult, runAction, type Service } from "./action";

/** runAction + refresh router client bila sukses. Dipakai oleh semua Server Action mutasi. */
export async function runMutation<S extends z.ZodType, O>(
  schema: S,
  rawInput: unknown,
  service: Service<z.output<S>, O>,
): Promise<ActionResult<O>> {
  const res = await runAction(schema, rawInput, service);
  if (res.ok) refresh();
  return res;
}
