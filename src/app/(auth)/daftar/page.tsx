import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { RegisterForm } from "@/features/auth/register-form";

export const metadata: Metadata = { title: "Daftar" };

async function Form() {
  await connection(); // baca env saat runtime, bukan saat build
  return <RegisterForm verificationRequired={process.env.EMAIL_VERIFICATION !== "false"} />;
}

export default function RegisterPage() {
  return (
    <Suspense>
      <Form />
    </Suspense>
  );
}
