import { getSessionUser } from "@/server/auth/session";
import { readAvatar } from "@/server/avatar";

/** Foto profil milik user yang sedang login saja (userId dari sesi). */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const avatar = await readAvatar(user.id);
  if (!avatar) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(avatar.data), {
    headers: {
      "Content-Type": avatar.mime,
      "Cache-Control": "private, max-age=86400",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
