import { z } from "zod";
import { zPassword } from "@/lib/validation";

export const changePasswordSchema = z
  .object({ current: z.string().min(1, "Isi password saat ini"), password: zPassword, confirm: z.string() })
  .refine((d) => d.password === d.confirm, { path: ["confirm"], message: "Password tidak sama" })
  .refine((d) => d.password !== d.current, { path: ["password"], message: "Password baru harus berbeda" });
