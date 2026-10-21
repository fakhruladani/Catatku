import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAdminPanel } from "@/features/admin/user-admin-panel";
import { listUsers } from "@/server/admin/service";
import { requireAdmin } from "@/server/auth/session";

export const metadata: Metadata = { title: "Manajemen user" };

async function Content() {
  const admin = await requireAdmin();
  const users = await listUsers({ adminId: admin.id });
  return (
    <UserAdminPanel
      users={users.map((u) => ({
        ...u,
        createdAt: u.createdAt.toISOString(),
        lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
      }))}
    />
  );
}

export default function AdminPage() {
  return (
    <>
      <PageHeader title="Manajemen user" description="Hanya admin yang bisa membuat akun. Tambah, atur ulang password, atau hapus user." />
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <Content />
      </Suspense>
    </>
  );
}
