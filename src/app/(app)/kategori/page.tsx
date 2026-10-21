import type { Metadata } from "next";
import { Suspense } from "react";
import { WorkbookTabs } from "@/components/shared/workbook-tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { CategoryManager } from "@/features/categories/components/category-manager";
import { listCategories } from "@/features/categories/service";
import { getPreferences } from "@/features/preferences/service";
import { currentPeriodKey, isPeriodKey } from "@/lib/period";
import { requireCtx } from "@/server/auth/session";

export const metadata: Metadata = { title: "Kategori" };

async function Content({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const ctx = await requireCtx();
  const [categories, pref] = await Promise.all([listCategories(ctx, { includeArchived: true }), getPreferences(ctx)]);
  const p = typeof sp.p === "string" && isPeriodKey(sp.p) ? sp.p : currentPeriodKey(pref.financialMonthStartDay);
  return (
    <div className="grid gap-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Kategori</h1>
        <p className="text-xs text-muted-foreground">
          Kategori milik akunmu sendiri. Kategori yang sudah dipakai hanya bisa diarsipkan (data lama tetap aman).
        </p>
      </div>
      <CategoryManager categories={categories} />
      <WorkbookTabs kind="kategori" periodKey={p} />
    </div>
  );
}

export default function KategoriPage(props: PageProps<"/kategori">) {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <Content searchParams={props.searchParams} />
    </Suspense>
  );
}
