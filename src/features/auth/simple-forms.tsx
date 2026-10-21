"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Field, FormError } from "@/components/shared/field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import { zodFieldErrorsClient } from "@/lib/zod-client";
import { authErrorMessage } from "./auth-errors";
import { PasswordStrengthMeter } from "./password-strength-meter";
import { resetPasswordSchema } from "./schemas";

/** Kirim ulang tautan verifikasi. Respons selalu sama agar tidak membocorkan email terdaftar. */
export function ResendVerificationForm() {
  const params = useSearchParams();
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const tokenError = params.get("error");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const { error } = await authClient.sendVerificationEmail({ email: email.trim(), callbackURL: "/onboarding" });
    setPending(false);
    if (error && error.status === 429) return setError(authErrorMessage(error));
    setDone(true);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Verifikasi email</CardTitle>
        <CardDescription>
          {tokenError ? "Tautan verifikasi tidak valid atau kedaluwarsa. " : ""}Masukkan email kamu untuk menerima tautan verifikasi baru.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {done ? (
          <p className="text-sm">Jika email tersebut terdaftar dan belum diverifikasi, tautan baru sudah dikirim. Cek kotak masuk & folder spam.</p>
        ) : (
          <form onSubmit={onSubmit} className="grid gap-4">
            <FormError message={error} />
            <Field label="Email" htmlFor="email">
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </Field>
            <Button type="submit" disabled={pending || !email}>
              {pending ? "Mengirim…" : "Kirim tautan"}
            </Button>
          </form>
        )}
        <Link href="/masuk" className="mt-4 block text-sm underline">
          Kembali ke halaman masuk
        </Link>
      </CardContent>
    </Card>
  );
}

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const { error } = await authClient.requestPasswordReset({ email: email.trim(), redirectTo: "/reset-password" });
    setPending(false);
    if (error && error.status === 429) return setError(authErrorMessage(error));
    setDone(true);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Lupa password</CardTitle>
        <CardDescription>Kami akan mengirim tautan untuk membuat password baru.</CardDescription>
      </CardHeader>
      <CardContent>
        {done ? (
          <p className="text-sm">Jika email tersebut terdaftar, tautan reset sudah dikirim (berlaku 1 jam).</p>
        ) : (
          <form onSubmit={onSubmit} className="grid gap-4">
            <FormError message={error} />
            <Field label="Email" htmlFor="email">
              <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </Field>
            <Button type="submit" disabled={pending || !email}>
              {pending ? "Mengirim…" : "Kirim tautan reset"}
            </Button>
          </form>
        )}
        <Link href="/masuk" className="mt-4 block text-sm underline">
          Kembali ke halaman masuk
        </Link>
      </CardContent>
    </Card>
  );
}

export function ResetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token");
  const [form, setForm] = useState({ password: "", confirm: "" });
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<string | null>(params.get("error") ? "Tautan tidak valid atau sudah kedaluwarsa." : null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return setError("Tautan tidak valid. Minta tautan reset baru.");
    const parsed = resetPasswordSchema.safeParse(form);
    if (!parsed.success) return setErrors(zodFieldErrorsClient(parsed.error));
    setErrors({});
    setPending(true);
    const { error } = await authClient.resetPassword({ newPassword: parsed.data.password, token });
    setPending(false);
    if (error) return setError(authErrorMessage(error));
    router.replace("/masuk?reset=1");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Buat password baru</CardTitle>
        <CardDescription>Semua sesi login lain akan dikeluarkan setelah password diubah.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
          <FormError message={error} />
          <Field label="Password baru" htmlFor="password" error={errors.password}>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            />
            <PasswordStrengthMeter password={form.password} />
          </Field>
          <Field label="Ulangi password" htmlFor="confirm" error={errors.confirm}>
            <Input
              id="confirm"
              type="password"
              autoComplete="new-password"
              value={form.confirm}
              onChange={(e) => setForm((f) => ({ ...f, confirm: e.target.value }))}
            />
          </Field>
          <Button type="submit" disabled={pending || !token}>
            {pending ? "Menyimpan…" : "Simpan password"}
          </Button>
          {!token && (
            <Link href="/lupa-password" className="text-sm underline">
              Minta tautan reset baru
            </Link>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
