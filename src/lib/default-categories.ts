/**
 * Template kategori default. Setiap user baru mendapat SALINAN miliknya sendiri.
 * `key` stabil dipakai onboarding untuk memilih kategori yang dipertahankan.
 */

export type DefaultCategory = {
  key: string;
  name: string;
  type: "INCOME" | "EXPENSE";
  icon: string;
  color: string;
  children?: { key: string; name: string }[];
};

export const DEFAULT_CATEGORIES: DefaultCategory[] = [
  // ── Pengeluaran ──
  {
    key: "makan", name: "Makan & Minum", type: "EXPENSE", icon: "utensils", color: "#f97316",
    children: [
      { key: "makan-luar", name: "Makan di luar" },
      { key: "belanja-dapur", name: "Belanja dapur" },
      { key: "jajan", name: "Kopi & jajan" },
    ],
  },
  {
    key: "transport", name: "Transportasi", type: "EXPENSE", icon: "car", color: "#0ea5e9",
    children: [
      { key: "bensin", name: "Bensin" },
      { key: "ojol", name: "Ojek online" },
      { key: "transum", name: "Transportasi umum" },
      { key: "parkir-tol", name: "Parkir & tol" },
    ],
  },
  {
    key: "tagihan", name: "Tagihan", type: "EXPENSE", icon: "receipt", color: "#eab308",
    children: [
      { key: "listrik", name: "Listrik" },
      { key: "air", name: "Air" },
      { key: "internet", name: "Internet & pulsa" },
    ],
  },
  {
    key: "tempat-tinggal", name: "Tempat Tinggal", type: "EXPENSE", icon: "house", color: "#8b5cf6",
    children: [
      { key: "sewa", name: "Sewa / kos" },
      { key: "perawatan-rumah", name: "Perawatan rumah" },
    ],
  },
  {
    key: "belanja", name: "Belanja", type: "EXPENSE", icon: "shopping-bag", color: "#ec4899",
    children: [
      { key: "pakaian", name: "Pakaian" },
      { key: "elektronik", name: "Elektronik" },
      { key: "rumah-tangga", name: "Kebutuhan rumah tangga" },
    ],
  },
  { key: "kesehatan", name: "Kesehatan", type: "EXPENSE", icon: "heart-pulse", color: "#ef4444" },
  { key: "pendidikan", name: "Pendidikan", type: "EXPENSE", icon: "graduation-cap", color: "#14b8a6" },
  {
    key: "hiburan", name: "Hiburan", type: "EXPENSE", icon: "clapperboard", color: "#a855f7",
    children: [
      { key: "langganan", name: "Langganan digital" },
      { key: "rekreasi", name: "Rekreasi" },
    ],
  },
  {
    key: "sosial", name: "Sosial & Donasi", type: "EXPENSE", icon: "hand-heart", color: "#22c55e",
    children: [
      { key: "zakat", name: "Zakat & sedekah" },
      { key: "hadiah-beri", name: "Hadiah" },
    ],
  },
  { key: "keluarga", name: "Keluarga", type: "EXPENSE", icon: "users", color: "#f59e0b" },
  { key: "perawatan-diri", name: "Perawatan Diri", type: "EXPENSE", icon: "sparkles", color: "#d946ef" },
  { key: "asuransi", name: "Asuransi", type: "EXPENSE", icon: "shield", color: "#64748b" },
  { key: "admin-pajak", name: "Biaya Admin & Pajak", type: "EXPENSE", icon: "landmark", color: "#78716c" },
  { key: "lainnya-keluar", name: "Lainnya", type: "EXPENSE", icon: "circle-ellipsis", color: "#737373" },

  // ── Pemasukan ──
  { key: "gaji", name: "Gaji", type: "INCOME", icon: "briefcase", color: "#16a34a" },
  { key: "bonus", name: "Bonus & THR", type: "INCOME", icon: "gift", color: "#65a30d" },
  { key: "usaha", name: "Usaha / Freelance", type: "INCOME", icon: "store", color: "#0d9488" },
  { key: "hadiah-terima", name: "Hadiah diterima", type: "INCOME", icon: "party-popper", color: "#ca8a04" },
  { key: "investasi-masuk", name: "Hasil investasi", type: "INCOME", icon: "trending-up", color: "#059669" },
  { key: "lainnya-masuk", name: "Lainnya", type: "INCOME", icon: "circle-ellipsis", color: "#737373" },
];
