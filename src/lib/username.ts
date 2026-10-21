/** Aturan username (sama dengan CHECK di database). */
export const USERNAME_MIN = 3;
export const USERNAME_MAX = 30;
export const USERNAME_RE = /^[a-z0-9_.]{3,30}$/;

export const normalizeUsername = (u: string) => u.trim().toLowerCase();

/** Email internal (Better Auth mewajibkan kolom email unik). Tidak dipakai untuk login / dikirimi email. */
export const internalEmail = (username: string) => `${username}@users.catatku.invalid`;
