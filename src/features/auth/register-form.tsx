"use client";

import Link from "next/link";
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
import { registerSchema } from "./schemas";

export function RegisterForm({ verificationRequired }: { verificationRequired: boolean }) {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" });
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = registerSchema.safeParse(form);
    if (!parsed.success) {
      setErrors(zodFieldErrorsClient(parsed.error));
      return;
    }
    setErrors({});
    setPending(true);
    const { error } = await authClient.signUp.email({
      name: parsed.data.name,
      email: parsed.data.email,
      password: parsed.data.password,
      callbackURL: "/onboarding",
    });
    setPending(false);
    if (error) {
      setError(authErrorMessage(error));
      return;
    }
    if (verificationRequired) {
      setSentTo(parsed.data.email);
    } else {
      router.replace("/onboarding");
      router.refresh();
    }
  }

  if (sentTo) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Cek email kamu</CardTitle>
          <CardDescription>
            Kami mengirim tautan verifikasi ke <b>{sentTo}</b>. Akun aktif setelah email diverifikasi. Tautan berlaku 1 jam.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm">
          <Link className="underline" href={`/verifikasi-email?email=${encodeURIComponent(sentTo)}`}>
            Tidak menerima email? Kirim ulang
          </Link>
          <Link className="underline" href="/masuk">
            Kembali ke halaman masuk
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Buat akun</CardTitle>
        <CardDescription>Gratis. Data kamu hanya bisa dilihat oleh kamu sendiri.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
          <FormError message={error} />
          <Field label="Nama" htmlFor="name" error={errors.name}>
            <Input id="name" autoComplete="name" value={form.name} onChange={set("name")} />
          </Field>
          <Field label="Email" htmlFor="email" error={errors.email}>
            <Input id="email" type="email" autoComplete="email" value={form.email} onChange={set("email")} />
          </Field>
          <Field label="Password" htmlFor="password" error={errors.password}>
            <Input id="password" type="password" autoComplete="new-password" value={form.password} onChange={set("password")} />
            <PasswordStrengthMeter password={form.password} />
          </Field>
          <Field label="Ulangi password" htmlFor="confirm" error={errors.confirm}>
            <Input id="confirm" type="password" autoComplete="new-password" value={form.confirm} onChange={set("confirm")} />
          </Field>
          <Button type="submit" size="lg" disabled={pending}>
            {pending ? "Memproses…" : "Daftar"}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            Sudah punya akun?{" "}
            <Link href="/masuk" className="font-medium text-foreground underline-offset-4 hover:underline">
              Masuk
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
