import "server-only";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { invalid } from "./errors";

export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
const EXT = ["jpg", "png", "webp"] as const;
type Ext = (typeof EXT)[number];
const MIME: Record<Ext, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" };

function dir(): string {
  return path.resolve(process.env.UPLOAD_DIR ?? "./.uploads", "avatars");
}

/** Deteksi tipe dari magic bytes (bukan dari nama file / Content-Type kiriman client). */
export function sniffImage(buf: Uint8Array): Ext | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpg";
  if (buf.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((b, i) => buf[i] === b)) return "png";
  if (
    buf.length >= 12 &&
    String.fromCharCode(...buf.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...buf.slice(8, 12)) === "WEBP"
  )
    return "webp";
  return null;
}

/** userId berasal dari sesi; nama file = userId sehingga tidak bisa menimpa milik orang lain. */
export async function saveAvatar(userId: string, file: File): Promise<void> {
  if (!/^[a-zA-Z0-9_-]+$/.test(userId)) throw invalid("User tidak valid");
  if (file.size === 0) throw invalid("File kosong");
  if (file.size > AVATAR_MAX_BYTES) throw invalid("Ukuran foto maksimal 2 MB");
  const buf = new Uint8Array(await file.arrayBuffer());
  const ext = sniffImage(buf);
  if (!ext) throw invalid("Format foto harus JPG, PNG, atau WebP");
  await mkdir(dir(), { recursive: true });
  await removeAvatar(userId);
  await writeFile(path.join(dir(), `${userId}.${ext}`), buf, { mode: 0o600 });
}

export async function removeAvatar(userId: string): Promise<void> {
  await Promise.all(EXT.map((e) => unlink(path.join(dir(), `${userId}.${e}`)).catch(() => undefined)));
}

export async function readAvatar(userId: string): Promise<{ data: Buffer; mime: string } | null> {
  for (const e of EXT) {
    try {
      const data = await readFile(path.join(dir(), `${userId}.${e}`));
      return { data, mime: MIME[e] };
    } catch {
      /* coba ekstensi berikutnya */
    }
  }
  return null;
}
