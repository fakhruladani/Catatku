import "server-only";
import type { UserCtx } from "@/server/auth/session";
import { basePrisma } from "./base-client";

/**
 * Akses ke baris User MILIK SENDIRI. Selalu `where: { id: ctx.userId }`,
 * userId berasal dari sesi, tidak pernah dari input.
 */

export interface ProfileDto {
  id: string;
  name: string;
  nickname: string | null;
  email: string;
  image: string | null;
  onboardingCompletedAt: Date | null;
}

export async function getOwnProfile(ctx: Pick<UserCtx, "userId">): Promise<ProfileDto> {
  return basePrisma.user.findUniqueOrThrow({
    where: { id: ctx.userId },
    select: { id: true, name: true, nickname: true, email: true, image: true, onboardingCompletedAt: true },
  });
}

export async function updateOwnProfile(
  ctx: Pick<UserCtx, "userId">,
  data: { name?: string; nickname?: string | null; image?: string | null },
): Promise<void> {
  await basePrisma.user.update({ where: { id: ctx.userId }, data });
}

export async function markOnboardingCompleted(ctx: Pick<UserCtx, "userId">): Promise<void> {
  await basePrisma.user.updateMany({
    where: { id: ctx.userId, onboardingCompletedAt: null },
    data: { onboardingCompletedAt: new Date() },
  });
}
