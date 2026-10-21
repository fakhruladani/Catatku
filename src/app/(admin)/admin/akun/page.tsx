import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { ChangePasswordForm } from "@/features/auth/change-password-form";
import { requireAdmin } from "@/server/auth/session";

export const metadata: Metadata = { title: "Akun admin" };

async function Content() {
  const admin = await requireAdmin();
  return <ChangePasswordForm username={admin.username} />;
}

export default function AdminAccountPage() {
  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title="Akun saya" description="Disarankan segera mengganti password bawaan admin." />
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <Content />
      </Suspense>
    </div>
  );
}
