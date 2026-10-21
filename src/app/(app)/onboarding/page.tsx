import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { listCategories } from "@/features/categories/service";
import { OnboardingWizard } from "@/features/onboarding/components/onboarding-wizard";
import { getPreferences } from "@/features/preferences/service";
import { requireCtx } from "@/server/auth/session";
import { getOwnProfile } from "@/server/db/self";

export const metadata: Metadata = { title: "Pengaturan awal" };

async function Content() {
  const ctx = await requireCtx();
  const [profile, categories, pref] = await Promise.all([getOwnProfile(ctx), listCategories(ctx), getPreferences(ctx)]);
  return (
    <OnboardingWizard
      profile={{ name: profile.name, nickname: profile.nickname, image: profile.image }}
      categories={categories}
      startDay={pref.financialMonthStartDay}
      openingBalance={pref.openingBalance}
    />
  );
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={<Skeleton className="mx-auto h-96 max-w-lg" />}>
      <Content />
    </Suspense>
  );
}
