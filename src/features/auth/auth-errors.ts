/** Terjemahan error Better Auth ke pesan Indonesia (tanpa membocorkan apakah email terdaftar). */
export function authErrorMessage(err: { code?: string; status?: number; message?: string } | null | undefined): string {
  if (!err) return "Terjadi kesalahan. Coba lagi.";
  if (err.status === 429) return "Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi.";
  switch (err.code) {
    case "INVALID_EMAIL_OR_PASSWORD":
      return "Email atau password salah.";
    case "EMAIL_NOT_VERIFIED":
      return "Email belum diverifikasi. Cek kotak masuk kamu, atau kirim ulang tautan verifikasi.";
    case "USER_ALREADY_EXISTS":
    case "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL":
      return "Email sudah terdaftar. Silakan masuk atau gunakan email lain.";
    case "PASSWORD_TOO_SHORT":
      return "Password minimal 8 karakter.";
    case "PASSWORD_TOO_LONG":
      return "Password terlalu panjang.";
    case "INVALID_TOKEN":
      return "Tautan tidak valid atau sudah kedaluwarsa. Minta tautan baru.";
    case "INVALID_EMAIL":
      return "Email tidak valid.";
    default:
      return "Terjadi kesalahan. Coba lagi.";
  }
}

/** Hanya izinkan redirect ke path internal. */
export function safeNext(next: string | null | undefined, fallback = "/buku"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}
