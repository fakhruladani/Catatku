import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/features/auth/simple-forms";

export const metadata: Metadata = { title: "Lupa password" };

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
