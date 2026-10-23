import { getSessionCookie } from "better-auth/cookies";
import { type NextRequest, NextResponse } from "next/server";

/**
 * Pengecekan cepat (optimistic) berdasarkan keberadaan cookie sesi.
 * Validasi sesi yang sebenarnya dilakukan di server (requireUser / runAction).
 */
const PUBLIC_PATHS = ["/masuk"];

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const hasSession = Boolean(getSessionCookie(request));
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (!hasSession && !isPublic) {
    const url = new URL("/masuk", request.url);
    if (pathname !== "/") url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }
  // Catatan: user yang sudah login di /masuk diarahkan oleh halaman itu sendiri setelah sesi
  // divalidasi di server, bukan di sini, agar cookie kedaluwarsa tidak menyebabkan redirect loop.
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|svg|ico|webp)$).*)"],
};
