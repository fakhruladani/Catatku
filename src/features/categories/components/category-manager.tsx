"use client";

import { Archive, ArchiveRestore, Pencil, Plus } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Field, FormError } from "@/components/shared/field";
import { ICON_NAMES, IconBadge } from "@/components/shared/icon";
import { NativeSelect } from "@/components/shared/native-select";
import { ColorPicker, IconPicker } from "@/components/shared/pickers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { archiveCategoryAction, createCategoryAction, updateCategoryAction } from "../actions";
import type { CategoryDto } from "../service";

type Kind = "EXPENSE" | "INCOME";
type FormValues = { id?: string; type: Kind; name: string; parentId: string | null; icon: string; color: string };

export function CategoryManager({ categories }: { categories: CategoryDto[] }) {
  const [tab, setTab] = useState<Kind>("EXPENSE");
  const [showArchived, setShowArchived] = useState(false);
  const [dialog, setDialog] = useState<{ key: number; values: FormValues } | null>(null);
  const [pending, start] = useTransition();

  const roots = categories.filter((c) => c.type === tab && (showArchived || !c.archived));

  const toggleArchive = (c: CategoryDto) =>
    start(async () => {
      const res = await archiveCategoryAction({ id: c.id, archived: !c.archived });
      if (res.ok) toast.success(c.archived ? "Kategori dipulihkan" : "Kategori diarsipkan");
      else toast.error(res.error);
    });

  const item = (c: CategoryDto, isChild: boolean) => (
    <div key={c.id} className={`flex items-center gap-3 py-2 ${isChild ? "pl-10" : ""} ${c.archived ? "opacity-50" : ""}`}>
      <IconBadge icon={c.icon} color={c.color} className={isChild ? "size-7" : "size-9"} />
      <div className="min-w-0 flex-1">
        <span className="truncate">{c.name}</span>
        {c.archived && (
          <Badge variant="outline" className="ml-2">
            Diarsipkan
          </Badge>
        )}
      </div>
      {!isChild && !c.archived && (
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Tambah subkategori ${c.name}`}
          onClick={() => setDialog({ key: Date.now(), values: { type: c.type, name: "", parentId: c.id, icon: c.icon, color: c.color } })}
        >
          <Plus />
        </Button>
      )}
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`Ubah ${c.name}`}
        onClick={() =>
          setDialog({ key: Date.now(), values: { id: c.id, type: c.type, name: c.name, parentId: c.parentId, icon: c.icon, color: c.color } })
        }
      >
        <Pencil />
      </Button>
      {(
        <Button
          variant="ghost"
          size="icon-sm"
          disabled={pending}
          aria-label={c.archived ? `Pulihkan ${c.name}` : `Arsipkan ${c.name}`}
          onClick={() => toggleArchive(c)}
        >
          {c.archived ? <ArchiveRestore /> : <Archive />}
        </Button>
      )}
    </div>
  );

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-lg bg-muted p-1" role="tablist">
          {(["EXPENSE", "INCOME"] as const).map((k) => (
            <button
              key={k}
              role="tab"
              aria-selected={tab === k}
              onClick={() => setTab(k)}
              className={`rounded-md px-3 py-1 text-sm ${tab === k ? "bg-background shadow-sm" : "text-muted-foreground"}`}
            >
              {k === "EXPENSE" ? "Pengeluaran" : "Pemasukan"}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <Switch checked={showArchived} onCheckedChange={setShowArchived} /> Tampilkan arsip
          </label>
          <Button
            onClick={() =>
              setDialog({ key: Date.now(), values: { type: tab, name: "", parentId: null, icon: "tag", color: "#6366f1" } })
            }
          >
            <Plus /> Kategori
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="divide-y">
          {roots.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Belum ada kategori.</p>}
          {roots.map((c) => (
            <div key={c.id}>
              {item(c, false)}
              {c.children.filter((ch) => showArchived || !ch.archived).map((ch) => item(ch, true))}
            </div>
          ))}
        </CardContent>
      </Card>

      {dialog && (
        <CategoryFormDialog
          key={dialog.key}
          initial={dialog.values}
          parents={categories.filter((c) => c.type === dialog.values.type && !c.archived && c.id !== dialog.values.id)}
          hasChildren={Boolean(categories.find((c) => c.id === dialog.values.id)?.children.length)}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  );
}

function CategoryFormDialog({
  initial,
  parents,
  hasChildren,
  onClose,
}: {
  initial: FormValues;
  parents: CategoryDto[];
  hasChildren: boolean;
  onClose: () => void;
}) {
  const [v, setV] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const editing = Boolean(initial.id);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const res = editing
        ? await updateCategoryAction({ id: v.id, name: v.name, parentId: v.parentId, icon: v.icon, color: v.color })
        : await createCategoryAction({ type: v.type, name: v.name, parentId: v.parentId, icon: v.icon, color: v.color });
      if (!res.ok) {
        setError(res.error);
        setErrors(res.fieldErrors ?? {});
        return;
      }
      toast.success(editing ? "Kategori diperbarui" : "Kategori ditambahkan");
      onClose();
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {editing ? "Ubah kategori" : "Tambah kategori"} {v.type === "EXPENSE" ? "pengeluaran" : "pemasukan"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4" noValidate>
          <FormError message={error} />
          <Field label="Nama" htmlFor="c-name" error={errors.name}>
            <Input id="c-name" value={v.name} maxLength={40} onChange={(e) => setV({ ...v, name: e.target.value })} />
          </Field>
          {!hasChildren && (
            <Field label="Induk (opsional)" htmlFor="c-parent" error={errors.parentId} hint="Subkategori maksimal 1 level.">
              <NativeSelect
                id="c-parent"
                value={v.parentId ?? ""}
                onChange={(e) => setV({ ...v, parentId: e.target.value || null })}
              >
                <option value="">(Tanpa induk)</option>
                {parents.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          )}
          <Field label="Warna" error={errors.color}>
            <ColorPicker value={v.color} onChange={(c) => setV({ ...v, color: c })} />
          </Field>
          <Field label="Ikon" error={errors.icon}>
            <IconPicker icons={ICON_NAMES} value={v.icon} onChange={(i) => setV({ ...v, icon: i })} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Batal
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Menyimpan…" : "Simpan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
