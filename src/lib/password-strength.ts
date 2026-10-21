export type PasswordStrength = { score: 0 | 1 | 2 | 3 | 4; label: string };

const COMMON = new Set([
  "password", "password1", "12345678", "123456789", "qwerty123", "11111111",
  "iloveyou", "admin123", "rahasia1", "bismillah", "indonesia", "sayang123",
]);

/** Heuristik sederhana di sisi client; tidak menggantikan validasi server (min. 8 karakter). */
export function passwordStrength(pw: string): PasswordStrength {
  if (!pw) return { score: 0, label: "" };
  if (pw.length < 8 || COMMON.has(pw.toLowerCase())) return { score: 0, label: "Sangat lemah" };
  let score = 0;
  if (pw.length >= 12) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (/(.)\1{2,}/.test(pw)) score = Math.max(0, score - 1);
  const s = Math.min(4, score) as PasswordStrength["score"];
  const labels = ["Lemah", "Lemah", "Cukup", "Kuat", "Sangat kuat"];
  return { score: s, label: labels[s] };
}
