import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { PreferencesForm } from "@/features/preferences/components/preferences-form";
import { getPreferences } from "@/features/preferences/service";
import { requireCtx } from "@/server/auth/session";

export const metadata: Metadata = { title: "Preferensi" };

async function Content() {
  const ctx = await requireCtx();
  const prefs = await getPreferences(ctx);
  return <PreferencesForm prefs={prefs} />;
}

export default function PreferencesPage() {
  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title="Preferensi" description="Tersimpan di akunmu, sama di semua perangkat." />
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <Content />
      </Suspense>
    </div>
  );
}
