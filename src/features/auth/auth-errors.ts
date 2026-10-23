/** Terjemahan error Better Auth ke pesan Indonesia (tanpa membocorkan apakah username terdaftar). */
export function authErrorMessage(err: { code?: string; status?: number; message?: string } | null | undefined): string {
  if (!err) return "Terjadi kesalahan. Coba lagi.";
  if (err.status === 429) return "Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi.";
  switch (err.code) {
    case "INVALID_USERNAME_OR_PASSWORD":
    case "INVALID_EMAIL_OR_PASSWORD":
      return "Username atau password salah.";
    case "INVALID_PASSWORD":
      return "Password saat ini salah.";
    case "PASSWORD_TOO_SHORT":
      return "Password minimal 8 karakter.";
    case "PASSWORD_TOO_LONG":
      return "Password terlalu panjang.";
    default:
      return "Terjadi kesalahan. Coba lagi.";
  }
}

/** Hanya izinkan redirect ke path internal. */
export function safeNext(next: string | null | undefined, fallback = "/buku"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}
