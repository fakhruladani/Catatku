"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Field, FormError } from "@/components/shared/field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import { zodFieldErrorsClient } from "@/lib/zod-client";
import { authErrorMessage } from "./auth-errors";
import { PasswordStrengthMeter } from "./password-strength-meter";
import { changePasswordSchema } from "./schemas";

/** Ganti password sendiri (user & admin). Sesi di perangkat lain otomatis dikeluarkan. */
export function ChangePasswordForm({ username }: { username: string }) {
  const router = useRouter();
  const [v, setV] = useState({ current: "", password: "", confirm: "" });
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(false);

  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => setV((x) => ({ ...x, [k]: e.target.value }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = changePasswordSchema.safeParse(v);
    if (!parsed.success) return setErrors(zodFieldErrorsClient(parsed.error));
    setErrors({});
    setPending(true);
    const { error } = await authClient.changePassword({
      currentPassword: parsed.data.current,
      newPassword: parsed.data.password,
      revokeOtherSessions: true,
    });
    setPending(false);
    if (error) return setError(authErrorMessage(error));
    setDone(true);
    setV({ current: "", password: "", confirm: "" });
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Ganti password</CardTitle>
        <CardDescription>
          Akun: <b>{username}</b>. Setelah diganti, login di perangkat lain akan dikeluarkan.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
          {done && <p className="text-sm text-teal-700 dark:text-teal-400">Password berhasil diganti.</p>}
          <FormError message={error} />
          {/* field username tersembunyi membantu password manager */}
          <input type="text" name="username" autoComplete="username" value={username} readOnly hidden />
          <Field label="Password saat ini" htmlFor="current" error={errors.current}>
            <Input id="current" type="password" autoComplete="current-password" value={v.current} onChange={set("current")} />
          </Field>
          <Field label="Password baru" htmlFor="newpw" error={errors.password}>
            <Input id="newpw" type="password" autoComplete="new-password" value={v.password} onChange={set("password")} />
            <PasswordStrengthMeter password={v.password} />
          </Field>
          <Field label="Ulangi password baru" htmlFor="confirm" error={errors.confirm}>
            <Input id="confirm" type="password" autoComplete="new-password" value={v.confirm} onChange={set("confirm")} />
          </Field>
          <div className="flex justify-end">
            <Button type="submit" disabled={pending}>
              {pending ? "Menyimpan…" : "Simpan password"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
