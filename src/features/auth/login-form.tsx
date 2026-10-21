"use client";

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
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const { error } = await authClient.signIn.username({ username: username.trim().toLowerCase(), password });
    setPending(false);
    if (error) {
      setError(authErrorMessage(error));
      return;
    }
    // Tujuan akhir (buku kas / halaman admin) ditentukan server sesuai peran akun
    router.replace(safeNext(params.get("next"), "/"));
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Masuk</CardTitle>
        <CardDescription>Akun dibuat oleh admin. Lupa password? Hubungi admin.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
          {params.get("changed") === "1" && <p className="text-sm text-teal-700 dark:text-teal-400">Password diubah. Silakan masuk lagi.</p>}
          <FormError message={error} />
          <Field label="Username" htmlFor="username">
            <Input
              id="username"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
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
          <Button type="submit" size="lg" disabled={pending || !username || !password}>
            {pending ? "Memproses…" : "Masuk"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
