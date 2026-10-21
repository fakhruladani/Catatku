"use client";

import { Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Field, FormError } from "@/components/shared/field";
import { IconBadge } from "@/components/shared/icon";
import { MoneyInput } from "@/components/shared/money-input";
import { NativeSelect } from "@/components/shared/native-select";
import { initials } from "@/components/shared/user-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import type { CategoryDto } from "@/features/categories/service";
import { currentPeriodKey, formatPeriodRange, getPeriodRange } from "@/lib/period";
import {
  finishOnboardingAction,
  saveCategoriesStepAction,
  saveOpeningStepAction,
  saveProfileStepAction,
  uploadAvatarAction,
} from "../actions";

const STEPS = ["Profil", "Saldo awal", "Kategori", "Periode"];

export function OnboardingWizard({
  profile,
  categories,
  startDay,
  openingBalance,
}: {
  profile: { name: string; nickname: string | null; image: string | null };
  categories: CategoryDto[];
  startDay: number;
  openingBalance: bigint;
}) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const [nickname, setNickname] = useState(profile.nickname ?? profile.name.split(" ")[0] ?? "");
  const [image, setImage] = useState(profile.image);
  const fileRef = useRef<HTMLInputElement>(null);
  const [opening, setOpening] = useState(openingBalance === 0n ? "" : openingBalance.toString());
  const [keep, setKeep] = useState<Set<string>>(() => new Set(categories.flatMap((c) => [c.id, ...c.children.map((ch) => ch.id)])));
  const [day, setDay] = useState(startDay);

  const next = () => {
    setError(null);
    setStep((s) => s + 1);
  };

  function doStep(fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) {
    start(async () => {
      const res = await fn();
      if (!res.ok) {
        setError(res.error ?? "Gagal menyimpan");
        return;
      }
      if (after) after();
      else next();
    });
  }

  function onAvatar(file: File | undefined) {
    if (!file) return;
    const fd = new FormData();
    fd.set("avatar", file);
    start(async () => {
      const res = await uploadAvatarAction(fd);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setImage(res.data.image);
      toast.success("Foto profil disimpan");
    });
  }

  const toggle = (c: CategoryDto, checked: boolean) => {
    const s = new Set(keep);
    if (c.parentId === null) [c.id, ...c.children.map((ch) => ch.id)].forEach((id) => (checked ? s.add(id) : s.delete(id)));
    else if (checked) {
      s.add(c.id);
      s.add(c.parentId);
    } else s.delete(c.id);
    setKeep(s);
  };

  return (
    <div className="mx-auto grid max-w-lg gap-4 py-2">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Langkah {step} dari 4 · {STEPS[step - 1]}
        </div>
        <Button variant="ghost" size="sm" onClick={() => router.push("/buku")}>
          Lewati
        </Button>
      </div>
      <Progress value={(step / 4) * 100} />
      <FormError message={error} />

      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Halo! Mau dipanggil apa?</CardTitle>
            <CardDescription>Dipakai untuk sapaan di aplikasi.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="flex items-center gap-4">
              <Avatar className="size-16">
                {image && <AvatarImage src={image} alt="" />}
                <AvatarFallback>{initials(nickname || profile.name)}</AvatarFallback>
              </Avatar>
              <div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => onAvatar(e.target.files?.[0])}
                />
                <Button variant="outline" size="sm" disabled={pending} onClick={() => fileRef.current?.click()}>
                  <Upload /> Unggah foto (opsional)
                </Button>
                <p className="mt-1 text-xs text-muted-foreground">JPG/PNG/WebP, maks. 2 MB</p>
              </div>
            </div>
            <Field label="Nama panggilan" htmlFor="nick">
              <Input id="nick" maxLength={30} value={nickname} onChange={(e) => setNickname(e.target.value)} />
            </Field>
          </CardContent>
          <CardFooter className="justify-end">
            <Button disabled={pending} onClick={() => doStep(() => saveProfileStepAction({ nickname }))}>
              Lanjut
            </Button>
          </CardFooter>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Berapa saldo kas kamu sekarang?</CardTitle>
            <CardDescription>
              Jadi titik awal saldo berjalan di buku kas. Boleh dikosongkan (Rp0) dan diubah nanti di Pengaturan.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Field label="Saldo awal" htmlFor="opening">
              <MoneyInput id="opening" allowNegative value={opening} onChange={setOpening} />
            </Field>
          </CardContent>
          <CardFooter className="justify-between">
            <Button variant="ghost" onClick={() => setStep(1)}>
              Kembali
            </Button>
            <Button
              disabled={pending}
              onClick={() => doStep(() => saveOpeningStepAction({ openingBalance: opening && opening !== "-" ? opening : "0" }))}
            >
              Lanjut
            </Button>
          </CardFooter>
        </Card>
      )}

      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>Pilih kategori</CardTitle>
            <CardDescription>Hilangkan centang kategori yang tidak kamu pakai. Bisa ditambah/diubah kapan saja di tab Kategori.</CardDescription>
          </CardHeader>
          <CardContent className="grid max-h-[50dvh] gap-4 overflow-y-auto">
            {(["EXPENSE", "INCOME"] as const).map((type) => (
              <div key={type} className="grid gap-1">
                <div className="text-sm font-medium">{type === "EXPENSE" ? "Pengeluaran" : "Pemasukan"}</div>
                {categories
                  .filter((c) => c.type === type)
                  .map((c) => (
                    <div key={c.id} className="grid gap-1">
                      <label className="flex items-center gap-2 py-1">
                        <Checkbox checked={keep.has(c.id)} onCheckedChange={(v) => toggle(c, Boolean(v))} />
                        <IconBadge icon={c.icon} color={c.color} className="size-6" />
                        <span className="text-sm">{c.name}</span>
                      </label>
                      {c.children.map((ch) => (
                        <label key={ch.id} className="flex items-center gap-2 py-0.5 pl-8">
                          <Checkbox checked={keep.has(ch.id)} onCheckedChange={(v) => toggle(ch, Boolean(v))} />
                          <span className="text-sm text-muted-foreground">{ch.name}</span>
                        </label>
                      ))}
                    </div>
                  ))}
              </div>
            ))}
          </CardContent>
          <CardFooter className="justify-between">
            <Button variant="ghost" onClick={() => setStep(2)}>
              Kembali
            </Button>
            <Button disabled={pending} onClick={() => doStep(() => saveCategoriesStepAction({ keepIds: [...keep] }))}>
              Lanjut
            </Button>
          </CardFooter>
        </Card>
      )}

      {step === 4 && (
        <Card>
          <CardHeader>
            <CardTitle>Kapan bulan keuanganmu dimulai?</CardTitle>
            <CardDescription>Biasanya tanggal gajian. Tab bulan, rekap, dan anggaran mengikuti periode ini.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            <Field label="Tanggal awal bulan" htmlFor="day">
              <NativeSelect id="day" value={day} onChange={(e) => setDay(Number(e.target.value))}>
                {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>
                    Tanggal {d}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <p className="text-sm text-muted-foreground">Periode saat ini: {formatPeriodRange(getPeriodRange(currentPeriodKey(day), day))}</p>
          </CardContent>
          <CardFooter className="justify-between">
            <Button variant="ghost" onClick={() => setStep(3)}>
              Kembali
            </Button>
            <Button
              disabled={pending}
              onClick={() =>
                doStep(
                  () => finishOnboardingAction({ financialMonthStartDay: day }),
                  () => {
                    toast.success("Siap! Mulai catat di buku kas.");
                    router.push("/buku");
                  },
                )
              }
            >
              Selesai
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}
