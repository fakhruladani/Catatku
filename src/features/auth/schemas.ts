import { z } from "zod";
import { zEmail, zName, zPassword } from "@/lib/validation";

export const registerSchema = z
  .object({
    name: zName("Nama", 60),
    email: zEmail,
    password: zPassword,
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, { path: ["confirm"], message: "Password tidak sama" });

export const resetPasswordSchema = z
  .object({ password: zPassword, confirm: z.string() })
  .refine((d) => d.password === d.confirm, { path: ["confirm"], message: "Password tidak sama" });
