import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { ChangePasswordForm } from "@/features/auth/change-password-form";
import { requireUser } from "@/server/auth/session";

export const metadata: Metadata = { title: "Akun & password" };

async function Content() {
  const user = await requireUser();
  return <ChangePasswordForm username={user.username} />;
}

export default function AccountPage() {
  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title="Akun & password" />
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <Content />
      </Suspense>
    </div>
  );
}
