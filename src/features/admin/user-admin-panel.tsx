"use client";

import { KeyRound, Plus, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Field, FormError } from "@/components/shared/field";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { PasswordStrengthMeter } from "@/features/auth/password-strength-meter";
import { createUserAction, deleteUserAction, resetUserPasswordAction } from "@/server/admin/actions";

export interface UserRow {
  id: string;
  username: string;
  name: string;
  createdAt: string;
  lastLoginAt: string | null;
  transactionCount: number;
}

const fmt = (iso: string | null) =>
  iso
    ? new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(iso))
    : "Belum pernah";

type DialogState =
  | { kind: "create" }
  | { kind: "reset"; user: UserRow }
  | { kind: "delete"; user: UserRow }
  | null;

export function UserAdminPanel({ users }: { users: UserRow[] }) {
  const [dialog, setDialog] = useState<DialogState>(null);
  const [q, setQ] = useState("");
  const shown = users.filter((u) => `${u.username} ${u.name}`.toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Input className="max-w-xs" placeholder="Cari username / nama…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Cari user" />
        <Button onClick={() => setDialog({ kind: "create" })}>
          <Plus /> Tambah user
        </Button>
      </div>

      <Card className="py-0">
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-muted text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Username</th>
                <th className="px-3 py-2 text-left font-medium">Nama</th>
                <th className="px-3 py-2 text-left font-medium">Dibuat</th>
                <th className="px-3 py-2 text-left font-medium">Login terakhir</th>
                <th className="px-3 py-2 text-right font-medium">Baris transaksi</th>
                <th className="w-48 px-3 py-2 text-right font-medium">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {shown.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                    {users.length === 0 ? "Belum ada user. Klik “Tambah user”." : "Tidak ada yang cocok."}
                  </td>
                </tr>
              )}
              {shown.map((u) => (
                <tr key={u.id} className="border-t border-border/60">
                  <td className="px-3 py-2 font-medium">@{u.username}</td>
                  <td className="px-3 py-2">{u.name}</td>
                  <td className="px-3 py-2 text-muted-foreground">{fmt(u.createdAt)}</td>
                  <td className="px-3 py-2 text-muted-foreground">{fmt(u.lastLoginAt)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{u.transactionCount.toLocaleString("id-ID")}</td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="outline" onClick={() => setDialog({ kind: "reset", user: u })}>
                        <KeyRound /> Password
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => setDialog({ kind: "delete", user: u })}>
                        <Trash2 /> Hapus
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground">
        {users.length} user. Admin hanya melihat data akun. Isi catatan keuangan user tidak bisa dibuka dari sini.
      </p>

      {dialog?.kind === "create" && <CreateDialog onClose={() => setDialog(null)} />}
      {dialog?.kind === "reset" && <ResetDialog user={dialog.user} onClose={() => setDialog(null)} />}
      {dialog?.kind === "delete" && <DeleteDialog user={dialog.user} onClose={() => setDialog(null)} />}
    </div>
  );
}

function useSubmit() {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const run = (fn: () => Promise<{ ok: boolean; error?: string; fieldErrors?: Record<string, string[]> }>, onOk: () => void) =>
    start(async () => {
      const res = await fn();
      if (!res.ok) {
        setError(res.error ?? "Gagal");
        setFieldErrors(res.fieldErrors ?? {});
        return;
      }
      onOk();
    });
  return { pending, error, fieldErrors, run };
}

function CreateDialog({ onClose }: { onClose: () => void }) {
  const [v, setV] = useState({ username: "", name: "", password: "", confirm: "" });
  const { pending, error, fieldErrors, run } = useSubmit();
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => setV((x) => ({ ...x, [k]: e.target.value }));
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Tambah user</DialogTitle>
          <DialogDescription>Berikan username dan password ini kepada pengguna. Ia bisa mengganti passwordnya sendiri setelah login.</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            run(
              () => createUserAction(v),
              () => {
                toast.success(`User @${v.username.trim().toLowerCase()} dibuat`);
                onClose();
              },
            );
          }}
        >
          <FormError message={error} />
          <Field label="Username" htmlFor="nu-username" error={fieldErrors.username} hint="3–30 karakter: huruf kecil, angka, titik, garis bawah">
            <Input id="nu-username" autoCapitalize="none" spellCheck={false} autoComplete="off" value={v.username} onChange={set("username")} />
          </Field>
          <Field label="Nama" htmlFor="nu-name" error={fieldErrors.name}>
            <Input id="nu-name" autoComplete="off" value={v.name} onChange={set("name")} />
          </Field>
          <Field label="Password" htmlFor="nu-pw" error={fieldErrors.password}>
            <Input id="nu-pw" type="password" autoComplete="new-password" value={v.password} onChange={set("password")} />
            <PasswordStrengthMeter password={v.password} />
          </Field>
          <Field label="Ulangi password" htmlFor="nu-confirm" error={fieldErrors.confirm}>
            <Input id="nu-confirm" type="password" autoComplete="new-password" value={v.confirm} onChange={set("confirm")} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Batal
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Membuat…" : "Buat user"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ResetDialog({ user, onClose }: { user: UserRow; onClose: () => void }) {
  const [v, setV] = useState({ password: "", confirm: "" });
  const { pending, error, fieldErrors, run } = useSubmit();
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Atur password @{user.username}</DialogTitle>
          <DialogDescription>User akan otomatis dikeluarkan dari semua perangkat dan harus login dengan password baru.</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            run(
              () => resetUserPasswordAction({ userId: user.id, ...v }),
              () => {
                toast.success(`Password @${user.username} diganti`);
                onClose();
              },
            );
          }}
        >
          <FormError message={error} />
          <Field label="Password baru" htmlFor="rp-pw" error={fieldErrors.password}>
            <Input id="rp-pw" type="password" autoComplete="new-password" value={v.password} onChange={(e) => setV({ ...v, password: e.target.value })} />
            <PasswordStrengthMeter password={v.password} />
          </Field>
          <Field label="Ulangi password baru" htmlFor="rp-confirm" error={fieldErrors.confirm}>
            <Input id="rp-confirm" type="password" autoComplete="new-password" value={v.confirm} onChange={(e) => setV({ ...v, confirm: e.target.value })} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Batal
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Menyimpan…" : "Simpan password"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteDialog({ user, onClose }: { user: UserRow; onClose: () => void }) {
  const [confirmUsername, setConfirm] = useState("");
  const { pending, error, fieldErrors, run } = useSubmit();
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Hapus @{user.username} permanen?</DialogTitle>
          <DialogDescription>
            Akun beserta <b>seluruh</b> datanya ({user.transactionCount.toLocaleString("id-ID")} baris transaksi, kategori, anggaran) akan
            dihapus dan <b>tidak bisa dikembalikan</b>.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            run(
              () => deleteUserAction({ userId: user.id, confirmUsername }),
              () => {
                toast.success(`User @${user.username} dihapus`);
                onClose();
              },
            );
          }}
        >
          <FormError message={error} />
          <Field label={`Ketik "${user.username}" untuk konfirmasi`} htmlFor="del-confirm" error={fieldErrors.confirmUsername}>
            <Input id="del-confirm" autoComplete="off" autoCapitalize="none" value={confirmUsername} onChange={(e) => setConfirm(e.target.value)} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Batal
            </Button>
            <Button type="submit" variant="destructive" disabled={pending || confirmUsername.trim().toLowerCase() !== user.username}>
              {pending ? "Menghapus…" : "Hapus permanen"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
