import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { forUser, type ScopedDb } from "@/server/db/scoped";
import { auth } from "./auth";

export type Role = "USER" | "ADMIN";

export interface SessionUser {
  id: string;
  name: string;
  username: string;
  role: Role;
  image: string | null;
}

/** Satu-satunya sumber userId & peran: sesi di server (aturan bisnis #8). Di-dedupe per request. */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const u = session.user as typeof session.user & { username?: string | null; role?: string | null };
  return {
    id: u.id,
    name: u.name,
    username: u.username ?? "",
    role: u.role === "ADMIN" ? "ADMIN" : "USER",
    image: u.image ?? null,
  };
});

/** Halaman buku kas: hanya user biasa. Admin diarahkan ke halaman manajemen akun. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/masuk");
  if (user.role === "ADMIN") redirect("/admin");
  return user;
}

/** Halaman admin: hanya ADMIN. User biasa diarahkan ke buku kas. */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/masuk");
  if (user.role !== "ADMIN") redirect("/buku");
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
