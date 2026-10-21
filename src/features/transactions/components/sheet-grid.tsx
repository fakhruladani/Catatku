"use client";

import { Keyboard, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { CategoryDto } from "@/features/categories/service";
import { compareRows, type EntryType, runningBalances, totalsOf } from "@/lib/finance/cashbook";
import { formatRupiah, formatThousands } from "@/lib/money";
import {
  type EditableColumn,
  mapPastedGrid,
  matchCategory,
  parseAmountInput,
  parseDateLoose,
  parseTypeLoose,
  splitTsv,
} from "@/lib/paste";
import { formatPlainDate, parsePlainDate } from "@/lib/period";
import {
  applyPasteAction,
  createTransactionAction,
  deleteTransactionsAction,
  updateTransactionAction,
} from "../actions";
import type { TxRowDto } from "../service";

/** Kolom tampilan. 0 = nomor baris, 6 = saldo (hanya baca). */
const COLS = [
  { key: "no", label: "#", editable: false, width: "w-10" },
  { key: "date", label: "Tanggal", editable: true, width: "w-28" },
  { key: "description", label: "Keterangan", editable: true, width: "min-w-48" },
  { key: "type", label: "Jenis", editable: true, width: "w-24" },
  { key: "category", label: "Kategori", editable: true, width: "w-48" },
  { key: "amount", label: "Nominal", editable: true, width: "w-36" },
  { key: "balance", label: "Saldo", editable: false, width: "w-36" },
] as const;
const FIRST_COL = 1;
const LAST_COL = 6;
const DRAFT = "__draft__";

type Draft = { date: string; description: string; type: EntryType; categoryId: string | null };
type Active = { row: string; col: number };
type Editing = { value: string };

interface FlatCat {
  id: string;
  name: string;
  label: string;
  type: EntryType;
  color: string;
  archived: boolean;
  parentName: string | null;
}

function flatten(tree: CategoryDto[]): FlatCat[] {
  const out: FlatCat[] = [];
  for (const c of tree) {
    out.push({ id: c.id, name: c.name, label: c.name, type: c.type, color: c.color, archived: c.archived, parentName: null });
    for (const ch of c.children) {
      out.push({
        id: ch.id,
        name: ch.name,
        label: `${c.name} › ${ch.name}`,
        type: ch.type,
        color: ch.color,
        archived: ch.archived || c.archived,
        parentName: c.name,
      });
    }
  }
  return out;
}

const dmy = (d: string) => {
  const { y, m, day } = parsePlainDate(d);
  return `${String(day).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;
};

export function SheetGrid({
  periodKey,
  periodStart,
  periodEnd,
  openingBalance,
  rows: serverRows,
  categories,
  today,
}: {
  periodKey: string;
  periodStart: string;
  periodEnd: string;
  openingBalance: bigint;
  rows: TxRowDto[];
  categories: CategoryDto[];
  today: string;
}) {
  const cats = useMemo(() => flatten(categories), [categories]);
  const catById = useMemo(() => new Map(cats.map((c) => [c.id, c])), [cats]);
  const defaultDate = today >= periodStart && today <= periodEnd ? today : periodEnd;
  const year = Number(periodEnd.slice(0, 4));

  const [rows, setRows] = useState(serverRows);
  const [draft, setDraft] = useState<Draft>({ date: defaultDate, description: "", type: "EXPENSE", categoryId: null });
  // Sinkron dengan data server setelah refresh (pola "adjust state saat render", tanpa effect)
  const [prevServer, setPrevServer] = useState({ rows: serverRows, defaultDate });
  if (prevServer.rows !== serverRows || prevServer.defaultDate !== defaultDate) {
    if (prevServer.defaultDate !== defaultDate) setDraft((d) => ({ ...d, date: defaultDate }));
    setPrevServer({ rows: serverRows, defaultDate });
    setRows(serverRows);
  }

  const [activeState, setActive] = useState<Active>({ row: DRAFT, col: 2 });
  const [editing, setEditingState] = useState<Editing | null>(null);
  // Ref cermin agar commit tidak terjadi dua kali (Enter lalu blur)
  const editingRef = useRef<Editing | null>(null);
  const setEditing = (v: Editing | null) => {
    editingRef.current = v;
    setEditingState(v);
  };
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [anchor, setAnchor] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLInputElement | HTMLSelectElement | null>(null);

  const sorted = useMemo(() => [...rows].sort(compareRows), [rows]);
  const balances = useMemo(() => runningBalances(openingBalance, sorted), [openingBalance, sorted]);
  const totals = useMemo(() => totalsOf(sorted), [sorted]);
  const order = useMemo(() => [...sorted.map((r) => r.id), DRAFT], [sorted]);

  // Jika baris aktif hilang (dihapus/pindah bulan), anggap baris draft yang aktif
  const active: Active = useMemo(
    () => (order.includes(activeState.row) ? activeState : { row: DRAFT, col: activeState.col }),
    [order, activeState],
  );

  // Kembalikan fokus ke grid — kecuali editor baru sudah dibuka (jangan curi fokus editor)
  const focusGrid = () =>
    requestAnimationFrame(() => {
      if (!editingRef.current) containerRef.current?.focus({ preventScroll: true });
    });

  useEffect(() => {
    const el = containerRef.current?.querySelector<HTMLElement>(`[data-cell="${active.row}:${active.col}"]`);
    el?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [active]);

  useEffect(() => {
    if (editing) requestAnimationFrame(() => editorRef.current?.focus());
  }, [editing]);

  const track = async <T,>(p: Promise<T>): Promise<T> => {
    setBusy((b) => b + 1);
    try {
      return await p;
    } finally {
      setBusy((b) => b - 1);
    }
  };

  // ───────── nilai sel ─────────
  const rowById = (id: string) => sorted.find((r) => r.id === id);

  const cellText = (rowId: string, col: number): string => {
    if (rowId === DRAFT) {
      const k = COLS[col]!.key;
      if (k === "date") return dmy(draft.date);
      if (k === "description") return draft.description;
      if (k === "type") return draft.type === "INCOME" ? "Masuk" : "Keluar";
      if (k === "category") return draft.categoryId ? (catById.get(draft.categoryId)?.label ?? "") : "";
      return "";
    }
    const r = rowById(rowId);
    if (!r) return "";
    switch (COLS[col]!.key) {
      case "date":
        return dmy(r.date);
      case "description":
        return r.description;
      case "type":
        return r.type === "INCOME" ? "Masuk" : "Keluar";
      case "category":
        return r.categoryId ? (catById.get(r.categoryId)?.label ?? "") : "";
      case "amount":
        return formatThousands(r.amount);
      case "balance": {
        const i = sorted.findIndex((x) => x.id === rowId);
        return formatThousands(balances[i] ?? 0n);
      }
      default:
        return "";
    }
  };

  // ───────── simpan ─────────
  const saveUpdate = async (id: string, patch: Partial<Omit<TxRowDto, "id" | "seq">>) => {
      const before = rows;
      setRows((rs) =>
        rs.map((r) => {
          if (r.id !== id) return r;
          const next = { ...r, ...patch };
          if (patch.type && patch.categoryId === undefined && r.categoryId && catById.get(r.categoryId)?.type !== patch.type) {
            next.categoryId = null;
          }
          return next;
        }),
      );
      const res = await track(updateTransactionAction({ id, ...patch }));
      if (!res.ok) {
        setRows(before);
        toast.error(res.error);
      } else if (patch.date && (patch.date < periodStart || patch.date > periodEnd)) {
        toast.info(`Baris dipindah ke tanggal ${formatPlainDate(patch.date)} (tab bulan lain)`);
      }
  };

  const createFromDraft = async (d: Draft, amount: bigint) => {
    const res = await track(
      createTransactionAction({
        date: d.date,
        type: d.type,
        amount: amount.toString(),
        description: d.description,
        categoryId: d.categoryId,
      }),
    );
    if (!res.ok) {
      toast.error(res.error);
      return false;
    }
    setRows((rs) => [...rs, res.data]);
    // Tanggal & jenis dipertahankan untuk baris berikutnya (seperti mengisi buku kas)
    setDraft({ date: d.date, description: "", type: d.type, categoryId: null });
    if (d.date < periodStart || d.date > periodEnd) toast.info(`Tersimpan di tanggal ${formatPlainDate(d.date)} (tab bulan lain)`);
    return true;
  };

  /** Simpan nilai teks ke sel. Mengembalikan false bila nilai tidak valid. */
  const commitValue = (rowId: string, col: number, raw: string): boolean => {
    const key = COLS[col]!.key;
    const isDraft = rowId === DRAFT;
    const r = isDraft ? null : rowById(rowId);
    const type: EntryType = isDraft ? draft.type : (r?.type ?? "EXPENSE");

    if (key === "date") {
      const d = parseDateLoose(raw, year);
      if (!d) {
        toast.error("Tanggal tidak valid. Contoh: 21/10/2026 atau 21 Okt");
        return false;
      }
      if (isDraft) setDraft((x) => ({ ...x, date: d }));
      else if (r && d !== r.date) void saveUpdate(rowId, { date: d });
      return true;
    }
    if (key === "description") {
      const v = raw.trim().slice(0, 200);
      if (isDraft) setDraft((x) => ({ ...x, description: v }));
      else if (r && v !== r.description) void saveUpdate(rowId, { description: v });
      return true;
    }
    if (key === "type") {
      const t = parseTypeLoose(raw) ?? (raw === "INCOME" || raw === "EXPENSE" ? (raw as EntryType) : null);
      if (!t) {
        toast.error("Jenis: ketik M (Masuk) atau K (Keluar)");
        return false;
      }
      if (isDraft)
        setDraft((x) => ({
          ...x,
          type: t,
          categoryId: x.categoryId && catById.get(x.categoryId)?.type !== t ? null : x.categoryId,
        }));
      else if (r && t !== r.type) void saveUpdate(rowId, { type: t });
      return true;
    }
    if (key === "category") {
      const id = raw === "" ? null : raw;
      if (id && catById.get(id)?.type !== type) return false;
      if (isDraft) setDraft((x) => ({ ...x, categoryId: id }));
      else if (r && id !== r.categoryId) void saveUpdate(rowId, { categoryId: id });
      return true;
    }
    if (key === "amount") {
      if (raw.trim() === "") return true;
      const a = parseAmountInput(raw);
      if (a === null) {
        toast.error("Nominal tidak valid. Contoh: 35000, 35.000, 35rb, 1,5jt");
        return false;
      }
      const abs = a < 0n ? -a : a;
      if (isDraft) {
        const d = a < 0n ? { ...draft, type: "EXPENSE" as const } : draft;
        void createFromDraft(d, abs);
      } else if (r) {
        const patch: Partial<TxRowDto> = {};
        if (abs !== r.amount) patch.amount = abs;
        if (a < 0n && r.type !== "EXPENSE") patch.type = "EXPENSE";
        if (Object.keys(patch).length) void saveUpdate(rowId, patch);
      }
      return true;
    }
    return true;
  };

  // ───────── navigasi ─────────
  const move = (dRow: number, dCol: number, wrap = false) => {
    setActive((a) => {
      let ri = order.indexOf(a.row);
      if (ri === -1) ri = order.length - 1;
      let c = a.col + dCol;
      if (wrap) {
        if (c > LAST_COL - 1) {
          c = FIRST_COL;
          ri += 1;
        } else if (c < FIRST_COL) {
          c = LAST_COL - 1;
          ri -= 1;
        }
      }
      ri = Math.max(0, Math.min(order.length - 1, ri + dRow));
      c = Math.max(FIRST_COL, Math.min(LAST_COL, c));
      return { row: order[ri]!, col: c };
    });
  };

  const startEdit = (initial?: string) => {
    const col = COLS[active.col]!;
    if (!col.editable) return;
    if (col.key === "type" && initial === undefined) {
      // Enter di kolom Jenis = tukar Masuk/Keluar
      const cur = active.row === DRAFT ? draft.type : rowById(active.row)?.type;
      commitValue(active.row, active.col, cur === "INCOME" ? "EXPENSE" : "INCOME");
      return;
    }
    let value = initial;
    if (value === undefined) {
      if (col.key === "category") {
        value = active.row === DRAFT ? (draft.categoryId ?? "") : (rowById(active.row)?.categoryId ?? "");
      } else if (col.key === "amount") {
        const r = rowById(active.row);
        value = r ? r.amount.toString() : "";
      } else value = cellText(active.row, active.col);
    }
    setEditing({ value });
  };

  const finishEdit = (commit: boolean, then?: () => void) => {
    const cur = editingRef.current;
    if (!cur) return;
    editingRef.current = null;
    if (commit && !commitValue(active.row, active.col, cur.value)) {
      editingRef.current = cur; // nilai tidak valid: tetap di mode edit
      return;
    }
    setEditing(null);
    then?.();
    focusGrid();
  };

  const deleteRows = (ids: string[]) => {
    if (ids.length === 0) return;
    if (!confirm(`Hapus ${ids.length} baris? Tindakan ini tidak bisa dibatalkan.`)) return;
    const before = rows;
    setRows((rs) => rs.filter((r) => !ids.includes(r.id)));
    setSelected(new Set());
    startTransition(async () => {
      const res = await track(deleteTransactionsAction({ ids }));
      if (!res.ok) {
        setRows(before);
        toast.error(res.error);
      } else toast.success(`${res.data.deleted} baris dihapus`);
    });
  };

  const onGridKeyDown = (e: React.KeyboardEvent) => {
    if (editingRef.current) {
      // Editor belum sempat menerima fokus (mengetik sangat cepat): jangan sampai huruf hilang
      if (e.target === containerRef.current && e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setEditing({ value: editingRef.current.value + e.key });
      }
      return;
    }
    const mod = e.ctrlKey || e.metaKey;
    switch (e.key) {
      case "ArrowUp":
        e.preventDefault();
        return move(-1, 0);
      case "ArrowDown":
        e.preventDefault();
        return move(1, 0);
      case "ArrowLeft":
        e.preventDefault();
        return move(0, -1);
      case "ArrowRight":
        e.preventDefault();
        return move(0, 1);
      case "Tab":
        e.preventDefault();
        return move(0, e.shiftKey ? -1 : 1, true);
      case "Home":
        e.preventDefault();
        return setActive((a) => ({ ...a, col: FIRST_COL }));
      case "End":
        e.preventDefault();
        return mod ? setActive({ row: DRAFT, col: active.col }) : setActive((a) => ({ ...a, col: LAST_COL - 1 }));
      case "Enter":
      case "F2":
        e.preventDefault();
        return startEdit();
      case "Escape":
        setSelected(new Set());
        return;
      case "Delete":
      case "Backspace": {
        e.preventDefault();
        if (selected.size > 0) return deleteRows([...selected]);
        if (mod && active.row !== DRAFT) return deleteRows([active.row]);
        const key = COLS[active.col]!.key;
        if (key === "description" || key === "category") commitValue(active.row, active.col, "");
        return;
      }
    }
    if (e.key.length === 1 && !mod && !e.altKey) {
      const key = COLS[active.col]!.key;
      if (key === "type") {
        const t = parseTypeLoose(e.key);
        if (t) {
          e.preventDefault();
          commitValue(active.row, active.col, t);
        }
        return;
      }
      if (key === "category") {
        e.preventDefault();
        return startEdit();
      }
      if (COLS[active.col]!.editable) {
        e.preventDefault();
        startEdit(e.key);
      }
    }
  };

  const onEditorKeyDown = (e: React.KeyboardEvent) => {
    // Jangan sampai event ikut diproses handler grid (bubbling) -> pindah sel dua kali
    e.stopPropagation();
    if (e.key === "Enter") {
      e.preventDefault();
      const wasDraftAmount = active.row === DRAFT && COLS[active.col]!.key === "amount";
      finishEdit(true, () => (wasDraftAmount ? setActive({ row: DRAFT, col: 2 }) : move(1, 0)));
    } else if (e.key === "Tab") {
      e.preventDefault();
      finishEdit(true, () => move(0, e.shiftKey ? -1 : 1, true));
    } else if (e.key === "Escape") {
      e.preventDefault();
      finishEdit(false);
    }
  };

  // ───────── salin & tempel ─────────
  const onCopy = (e: React.ClipboardEvent) => {
    if (editing) return;
    e.preventDefault();
    const ids = selected.size > 0 ? order.filter((id) => selected.has(id)) : null;
    const text = ids
      ? ids.map((id) => [1, 2, 3, 4, 5].map((c) => cellText(id, c)).join("\t")).join("\n")
      : cellText(active.row, active.col);
    e.clipboardData.setData("text/plain", text);
    toast.success(ids ? `${ids.length} baris disalin` : "Sel disalin");
  };

  const onPaste = (e: React.ClipboardEvent) => {
    if (editing) return;
    const text = e.clipboardData.getData("text/plain");
    if (!text) return;
    e.preventDefault();
    const grid = splitTsv(text);
    if (grid.length === 0) return;
    const colKey = COLS[active.col]!.key;
    const startColumn: EditableColumn =
      colKey === "date" || colKey === "description" || colKey === "type" || colKey === "category" || colKey === "amount"
        ? colKey
        : "date";

    // Satu sel -> isi sel aktif
    if (grid.length === 1 && grid[0]!.length === 1) {
      const v = grid[0]![0]!;
      if (colKey === "category") {
        const type = active.row === DRAFT ? draft.type : (rowById(active.row)?.type ?? "EXPENSE");
        const id = matchCategory(v, type, cats);
        if (!id) return void toast.error(`Kategori "${v}" tidak ditemukan untuk jenis ini`);
        commitValue(active.row, active.col, id);
      } else if (COLS[active.col]!.editable) commitValue(active.row, active.col, v);
      return;
    }

    const parsed = mapPastedGrid(grid, startColumn, { defaultYear: year, fallbackType: draft.type });
    const startIdx = active.row === DRAFT ? sorted.length : sorted.findIndex((r) => r.id === active.row);
    const updates: Record<string, unknown>[] = [];
    const creates: Record<string, unknown>[] = [];
    let skipped = 0;
    let unknownCat = 0;
    let invalidCells = 0;

    parsed.forEach((p, i) => {
      invalidCells += p.invalid.length;
      const target = sorted[startIdx + i];
      if (target) {
        const type = p.type ?? target.type;
        const patch: Record<string, unknown> = { id: target.id };
        if (p.date) patch.date = p.date;
        if (p.description !== undefined) patch.description = p.description;
        if (p.type) patch.type = p.type;
        if (p.amount !== undefined) patch.amount = p.amount.toString();
        if (p.categoryName !== undefined) {
          const id = matchCategory(p.categoryName, type, cats);
          if (id) patch.categoryId = id;
          else unknownCat++;
        }
        if (Object.keys(patch).length > 1) updates.push(patch);
      } else {
        if (p.amount === undefined) {
          skipped++;
          return;
        }
        const type = p.type ?? draft.type;
        const categoryId = p.categoryName ? matchCategory(p.categoryName, type, cats) : null;
        if (p.categoryName && !categoryId) unknownCat++;
        creates.push({
          date: p.date ?? draft.date,
          type,
          amount: p.amount.toString(),
          description: p.description ?? "",
          categoryId,
        });
      }
    });

    if (updates.length + creates.length === 0) {
      toast.error("Tidak ada data yang bisa ditempel. Pastikan kolom Nominal berisi angka.");
      return;
    }
    startTransition(async () => {
      const res = await track(applyPasteAction({ updates, creates }));
      if (!res.ok) return void toast.error(res.error);
      const notes = [
        res.data.created ? `${res.data.created} baris ditambahkan` : "",
        res.data.updated ? `${res.data.updated} baris diperbarui` : "",
        skipped ? `${skipped} dilewati (nominal kosong)` : "",
        unknownCat ? `${unknownCat} kategori tidak dikenali` : "",
        invalidCells ? `${invalidCells} sel tidak terbaca` : "",
      ].filter(Boolean);
      toast.success(notes.join(" · "));
    });
  };

  // ───────── render ─────────
  const renderEditor = (rowId: string, col: number) => {
    const key = COLS[col]!.key;
    const type: EntryType = rowId === DRAFT ? draft.type : (rowById(rowId)?.type ?? "EXPENSE");
    const common = "h-full w-full bg-background px-2 text-sm outline-none ring-2 ring-primary";
    if (key === "category") {
      const current = rowId === DRAFT ? draft.categoryId : rowById(rowId)?.categoryId;
      return (
        <select
          ref={(el) => {
            editorRef.current = el;
          }}
          aria-label="Kategori"
          autoFocus
          className={common}
          value={editing!.value}
          onChange={(e) => {
            editingRef.current = null;
            commitValue(rowId, col, e.target.value);
            setEditing(null);
            focusGrid();
          }}
          onKeyDown={onEditorKeyDown}
          onBlur={() => finishEdit(false)}
        >
          <option value="">— Tanpa kategori —</option>
          {cats
            .filter((c) => c.type === type && (!c.archived || c.id === current))
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
        </select>
      );
    }
    return (
      <input
        ref={(el) => {
          editorRef.current = el;
        }}
        aria-label={COLS[col]!.label}
        autoFocus
        onFocus={(e) => {
          const len = e.currentTarget.value.length;
          e.currentTarget.setSelectionRange(len, len);
        }}
        className={`${common} ${key === "amount" ? "text-right tabular-nums" : ""}`}
        value={editing!.value}
        inputMode={key === "amount" ? "decimal" : undefined}
        placeholder={key === "date" ? "dd/mm/yyyy" : key === "amount" ? "35000 / 35rb" : undefined}
        onChange={(e) => setEditing({ value: e.target.value })}
        onKeyDown={onEditorKeyDown}
        onBlur={() => finishEdit(true)}
      />
    );
  };

  const cell = (rowId: string, col: number, idx: number) => {
    const isActive = active.row === rowId && active.col === col;
    const key = COLS[col]!.key;
    const r = rowId === DRAFT ? null : rowById(rowId);
    const isEditing = isActive && editing !== null;
    const align = key === "amount" || key === "balance" ? "text-right tabular-nums" : "";
    let content: React.ReactNode = cellText(rowId, col);
    let tone = "";
    if (key === "no") content = rowId === DRAFT ? <Plus className="mx-auto size-3.5 text-muted-foreground" /> : idx + 1;
    if (key === "type") {
      const t = rowId === DRAFT ? draft.type : r?.type;
      tone = t === "INCOME" ? "text-teal-700 dark:text-teal-400" : "text-orange-600 dark:text-orange-400";
    }
    if (key === "amount" && r) tone = r.type === "INCOME" ? "text-teal-700 dark:text-teal-400" : "";
    if (key === "balance" && r) {
      const i = sorted.findIndex((x) => x.id === rowId);
      if ((balances[i] ?? 0n) < 0n) tone = "text-rose-600";
    }
    if (key === "category" && content) {
      const c = catById.get((rowId === DRAFT ? draft.categoryId : r?.categoryId) ?? "");
      content = (
        <span className="flex items-center gap-1.5 truncate">
          <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: c?.color }} />
          <span className="truncate">{c?.name}</span>
        </span>
      );
    }
    if (rowId === DRAFT && !isEditing) {
      if (key === "description" && !draft.description) content = <span className="text-muted-foreground/60">Ketik keterangan…</span>;
      if (key === "amount") content = <span className="text-muted-foreground/60">Nominal</span>;
      if (key === "category" && !draft.categoryId) content = <span className="text-muted-foreground/60">—</span>;
    }
    return (
      <td
        key={col}
        data-cell={`${rowId}:${col}`}
        className={`relative h-9 scroll-mt-[4.5rem] scroll-mb-11 border-r border-b border-border/70 px-2 text-sm whitespace-nowrap ${COLS[col]!.width} ${align} ${tone} ${
          key === "no" ? "cursor-pointer bg-muted/40 text-center text-xs text-muted-foreground select-none" : ""
        } ${key === "balance" ? "bg-muted/20" : ""} ${isActive && !isEditing ? "outline-2 -outline-offset-2 outline-primary" : ""} ${
          isEditing ? "p-0" : ""
        } ${selected.has(rowId) ? "bg-primary/10" : ""}`}
        onMouseDown={(e) => {
          if (isEditing) return;
          if (key === "no" && rowId !== DRAFT) {
            e.preventDefault();
            setSelected((s) => {
              const next = new Set(e.metaKey || e.ctrlKey ? s : []);
              if (e.shiftKey && anchor) {
                const a = order.indexOf(anchor);
                const b = order.indexOf(rowId);
                for (let i = Math.min(a, b); i <= Math.max(a, b); i++) if (order[i] !== DRAFT) next.add(order[i]!);
              } else if (s.has(rowId) && s.size === 1) next.delete(rowId);
              else next.add(rowId);
              return next;
            });
            setAnchor(rowId);
            focusGrid();
            return;
          }
          if (editing) finishEdit(true);
          const wasActive = isActive;
          setActive({ row: rowId, col: Math.max(FIRST_COL, col) });
          if (!e.shiftKey) setSelected(new Set());
          // Ketuk sel yang sudah aktif = mulai edit (ramah layar sentuh)
          if (wasActive && COLS[col]!.editable) {
            e.preventDefault();
            setTimeout(() => startEditFor(rowId, col), 0);
          } else focusGrid();
        }}
        onDoubleClick={() => COLS[col]!.editable && startEditFor(rowId, col)}
      >
        {isEditing ? renderEditor(rowId, col) : <div className="truncate">{content}</div>}
      </td>
    );
  };

  // startEdit untuk sel tertentu (dipakai klik/dobel klik)
  const startEditFor = (rowId: string, col: number) => {
    setActive({ row: rowId, col });
    const key = COLS[col]!.key;
    if (key === "type") {
      const cur = rowId === DRAFT ? draft.type : rowById(rowId)?.type;
      commitValue(rowId, col, cur === "INCOME" ? "EXPENSE" : "INCOME");
      return;
    }
    let value: string;
    if (key === "category") value = rowId === DRAFT ? (draft.categoryId ?? "") : (rowById(rowId)?.categoryId ?? "");
    else if (key === "amount") value = rowById(rowId)?.amount.toString() ?? "";
    else value = cellText(rowId, col);
    setEditing({ value });
  };

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setActive({ row: DRAFT, col: 2 });
            focusGrid();
          }}
        >
          <Plus /> Baris baru
        </Button>
        {selected.size > 0 && (
          <Button size="sm" variant="destructive" onClick={() => deleteRows([...selected])}>
            <Trash2 /> Hapus {selected.size} baris
          </Button>
        )}
        <span className="text-xs text-muted-foreground" aria-live="polite">
          {busy > 0 ? "Menyimpan…" : "Tersimpan otomatis"}
        </span>
        <details className="ml-auto text-xs text-muted-foreground">
          <summary className="flex cursor-pointer items-center gap-1 select-none">
            <Keyboard className="size-3.5" /> Pintasan
          </summary>
          <div className="absolute right-4 z-20 mt-1 grid w-72 gap-1 rounded-lg border bg-popover p-3 text-popover-foreground shadow-md">
            <span>Ketik langsung untuk mengisi sel · Enter/F2 edit</span>
            <span>Enter simpan & turun · Tab simpan & ke kanan · Esc batal</span>
            <span>Panah untuk pindah sel · Ctrl+End ke baris baru</span>
            <span>Jenis: tekan M (Masuk) / K (Keluar)</span>
            <span>Nominal: 35000, 35.000, 35rb, 1,5jt · minus = Keluar</span>
            <span>Klik nomor baris untuk memilih (Shift = rentang) · Delete hapus</span>
            <span>Ctrl+C / Ctrl+V: salin & tempel dari Excel / Google Sheets</span>
          </div>
        </details>
      </div>

      <div
        ref={containerRef}
        tabIndex={0}
        role="grid"
        aria-label={`Buku kas ${periodKey}`}
        aria-rowcount={order.length + 1}
        className="relative max-h-[calc(100dvh-15rem)] overflow-auto rounded-lg border bg-card outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        onKeyDown={onGridKeyDown}
        onCopy={onCopy}
        onPaste={onPaste}
      >
        <table className="w-full min-w-[920px] table-fixed border-separate border-spacing-0">
          <colgroup>
            <col className="w-10" />
            <col className="w-28" />
            <col />
            <col className="w-24" />
            <col className="w-48" />
            <col className="w-36" />
            <col className="w-36" />
          </colgroup>
          <thead className="sticky top-0 z-10 bg-muted text-xs font-medium text-muted-foreground">
            <tr>
              {COLS.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  className={`h-8 border-r border-b px-2 text-left font-medium ${
                    c.key === "amount" || c.key === "balance" ? "text-right" : ""
                  } ${c.key === "no" ? "text-center" : ""}`}
                >
                  {c.label}
                </th>
              ))}
            </tr>
            <tr className="bg-muted/60 text-[11px]">
              <td className="border-r border-b" />
              <td colSpan={5} className="border-r border-b px-2 py-1 italic">
                Saldo awal periode
              </td>
              <td className={`border-b px-2 py-1 text-right tabular-nums ${openingBalance < 0n ? "text-rose-600" : ""}`}>
                {formatThousands(openingBalance)}
              </td>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, i) => (
              <tr key={r.id} aria-rowindex={i + 2}>
                {COLS.map((_, c) => cell(r.id, c, i))}
              </tr>
            ))}
            <tr className="bg-muted/10">{COLS.map((_, c) => cell(DRAFT, c, sorted.length))}</tr>
          </tbody>
          <tfoot className="sticky bottom-0 z-10 bg-muted text-sm font-medium">
            <tr>
              <td className="border-t border-r" />
              <td colSpan={2} className="border-t border-r px-2 py-1.5">
                Total ({sorted.length} baris)
              </td>
              <td colSpan={2} className="border-t border-r px-2 py-1.5 text-xs font-normal">
                <span className="text-teal-700 dark:text-teal-400">Masuk {formatRupiah(totals.income)}</span>
                <span className="mx-1 text-muted-foreground">·</span>
                <span className="text-orange-600 dark:text-orange-400">Keluar {formatRupiah(totals.expense)}</span>
              </td>
              <td className={`border-t border-r px-2 py-1.5 text-right tabular-nums ${totals.net < 0n ? "text-rose-600" : ""}`}>
                {totals.net >= 0n ? "+" : ""}
                {formatThousands(totals.net)}
              </td>
              <td className="border-t px-2 py-1.5 text-right tabular-nums">{formatThousands(openingBalance + totals.net)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
