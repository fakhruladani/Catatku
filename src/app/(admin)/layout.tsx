import Link from "next/link";
import { Suspense } from "react";
import { UserMenu } from "@/components/shared/user-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { requireAdmin } from "@/server/auth/session";

async function AdminChrome() {
  const admin = await requireAdmin();
  return <UserMenu name={admin.name} username={admin.username} image={null} settingsHref="/admin/akun" />;
}

export default function AdminLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 flex h-12 items-center justify-between gap-3 border-b bg-background/95 px-4 backdrop-blur">
        <div className="flex items-center gap-4">
          <Link href="/admin" className="flex items-center gap-2 text-base font-semibold tracking-tight">
            <span className="inline-flex size-6 items-center justify-center rounded bg-emerald-600 text-xs font-bold text-white">C</span>
            Catatku <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">Admin</span>
          </Link>
          <nav className="flex gap-3 text-sm text-muted-foreground">
            <Link href="/admin" className="hover:text-foreground">
              User
            </Link>
            <Link href="/admin/akun" className="hover:text-foreground">
              Akun saya
            </Link>
          </nav>
        </div>
        <Suspense fallback={<Skeleton className="size-8 rounded-full" />}>
          <AdminChrome />
        </Suspense>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-4">{children}</main>
    </div>
  );
}
