import type { Metadata } from "next";
import { Suspense } from "react";
import { ResendVerificationForm } from "@/features/auth/simple-forms";

export const metadata: Metadata = { title: "Verifikasi email" };

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <ResendVerificationForm />
    </Suspense>
  );
}
