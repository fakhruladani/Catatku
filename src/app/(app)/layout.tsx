import Link from "next/link";
import { Suspense } from "react";
import { UserMenu } from "@/components/shared/user-menu";
import { ThemeSync } from "@/components/theme-provider";
import { Skeleton } from "@/components/ui/skeleton";
import { getPreferences } from "@/features/preferences/service";
import { requireCtx } from "@/server/auth/session";
import { getOwnProfile } from "@/server/db/self";

/** Bagian header yang butuh sesi — di-stream di balik Suspense (Cache Components). */
async function SessionChrome() {
  const ctx = await requireCtx();
  const [profile, pref] = await Promise.all([getOwnProfile(ctx), getPreferences(ctx)]);
  return (
    <>
      <ThemeSync theme={pref.theme} />
      {!profile.onboardingCompletedAt && (
        <Link href="/onboarding" className="hidden rounded-md bg-amber-500/15 px-2 py-1 text-xs text-amber-700 sm:block dark:text-amber-300">
          Lengkapi pengaturan awal
        </Link>
      )}
      <span className="hidden text-sm text-muted-foreground sm:block">Halo, {profile.nickname || profile.name.split(" ")[0]}</span>
      <UserMenu name={profile.nickname || profile.name} email={profile.email} image={profile.image} />
    </>
  );
}

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 flex h-12 shrink-0 items-center justify-between gap-3 border-b bg-background/95 px-4 backdrop-blur">
        <Link href="/buku" className="flex items-center gap-2 text-base font-semibold tracking-tight">
          <span className="inline-flex size-6 items-center justify-center rounded bg-emerald-600 text-xs font-bold text-white">C</span>
          Catatku
        </Link>
        <div className="flex items-center gap-3">
          <Suspense fallback={<Skeleton className="size-8 rounded-full" />}>
            <SessionChrome />
          </Suspense>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-3 pt-3 pb-16 md:px-5">{children}</main>
    </div>
  );
}
