"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Field, FormError } from "@/components/shared/field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import { authErrorMessage, safeNext } from "./auth-errors";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [unverified, setUnverified] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setUnverified(false);
    const { error } = await authClient.signIn.email({ email: email.trim(), password });
    setPending(false);
    if (error) {
      setError(authErrorMessage(error));
      setUnverified(error.code === "EMAIL_NOT_VERIFIED");
      return;
    }
    router.replace(safeNext(params.get("next")));
    router.refresh();
  }

  const verified = params.get("verified") === "1";
  const reset = params.get("reset") === "1";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Masuk</CardTitle>
        <CardDescription>Masuk ke akun Catatku kamu.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
          {verified && <p className="text-sm text-emerald-600">Email berhasil diverifikasi. Silakan masuk.</p>}
          {reset && <p className="text-sm text-emerald-600">Password berhasil diubah. Silakan masuk.</p>}
          <FormError message={error} />
          {unverified && (
            <Link className="text-sm underline" href={`/verifikasi-email?email=${encodeURIComponent(email)}`}>
              Kirim ulang tautan verifikasi
            </Link>
          )}
          <Field label="Email" htmlFor="email">
            <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label="Password" htmlFor="password">
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          <div className="flex justify-end">
            <Link href="/lupa-password" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
              Lupa password?
            </Link>
          </div>
          <Button type="submit" size="lg" disabled={pending || !email || !password}>
            {pending ? "Memproses…" : "Masuk"}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            Belum punya akun?{" "}
            <Link href="/daftar" className="font-medium text-foreground underline-offset-4 hover:underline">
              Daftar
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
