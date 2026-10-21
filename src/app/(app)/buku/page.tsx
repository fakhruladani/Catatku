import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getPreferences } from "@/features/preferences/service";
import { currentPeriodKey } from "@/lib/period";
import { requireCtx } from "@/server/auth/session";

async function Go() {
  const ctx = await requireCtx();
  const pref = await getPreferences(ctx);
  redirect(`/buku/${currentPeriodKey(pref.financialMonthStartDay)}`);
  return null;
}

/** /buku -> tab bulan berjalan */
export default function BukuIndex() {
  return (
    <Suspense>
      <Go />
    </Suspense>
  );
}
