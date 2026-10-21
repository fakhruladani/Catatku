import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { forUser, type ScopedDb } from "@/server/db/scoped";
import { auth } from "./auth";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image: string | null;
}

/** Satu-satunya sumber userId: sesi di server (aturan bisnis #8). Di-dedupe per request. */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const u = session.user;
  return { id: u.id, name: u.name, email: u.email, emailVerified: u.emailVerified, image: u.image ?? null };
});

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/masuk");
  return user;
}

export interface UserCtx {
  userId: string;
  db: ScopedDb;
}

/** Untuk Server Component: user + client ter-scope. */
export async function requireCtx(): Promise<UserCtx & { user: SessionUser }> {
  const user = await requireUser();
  return { user, userId: user.id, db: forUser(user.id) };
}
