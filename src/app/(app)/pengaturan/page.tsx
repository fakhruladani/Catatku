import { ChevronRight, KeyRound, SlidersHorizontal, Tags } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = { title: "Pengaturan" };

const ITEMS = [
  { href: "/pengaturan/akun", label: "Akun & password", desc: "Ganti password", icon: KeyRound },
  { href: "/pengaturan/preferensi", label: "Preferensi", desc: "Saldo awal, tanggal awal bulan, tema", icon: SlidersHorizontal },
  { href: "/kategori", label: "Kategori", desc: "Kelola kategori pemasukan & pengeluaran", icon: Tags },
];

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title="Pengaturan" />
      <Card>
        <CardContent className="divide-y">
          {ITEMS.map(({ href, label, desc, icon: Icon }) => (
            <Link key={href} href={href} className="flex items-center gap-3 py-3">
              <Icon className="size-5 text-muted-foreground" />
              <div className="flex-1">
                <div className="font-medium">{label}</div>
                <div className="text-sm text-muted-foreground">{desc}</div>
              </div>
              <ChevronRight className="size-4 text-muted-foreground" />
            </Link>
          ))}
        </CardContent>
      </Card>
      <Link href="/buku" className="mt-4 inline-block text-sm text-muted-foreground hover:underline">
        ← Kembali ke buku kas
      </Link>
    </div>
  );
}
