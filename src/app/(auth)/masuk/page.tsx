import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { LoginForm } from "@/features/auth/login-form";
import { getSessionUser } from "@/server/auth/session";

export const metadata: Metadata = { title: "Masuk" };

async function RedirectIfAuthed() {
  if (await getSessionUser()) redirect("/buku");
  return null;
}

export default function LoginPage() {
  return (
    <Suspense>
      <RedirectIfAuthed />
      <LoginForm />
    </Suspense>
  );
}
