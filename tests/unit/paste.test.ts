import { describe, expect, it } from "vitest";
import {
  mapPastedGrid,
  matchCategory,
  parseAmountLoose,
  parseDateLoose,
  parseTypeLoose,
  splitTsv,
} from "@/lib/paste";

describe("splitTsv", () => {
  it("memecah baris & kolom, mengabaikan baris kosong", () => {
    expect(splitTsv("a\tb\r\nc\td\n\n")).toEqual([
      ["a", "b"],
      ["c", "d"],
    ]);
  });
  it("mendukung sel ber-kutip dari Excel", () => {
    expect(splitTsv('"makan\tsiang"\t"kata ""enak"""\nx\ty')).toEqual([
      ["makan\tsiang", 'kata "enak"'],
      ["x", "y"],
    ]);
  });
});

describe("parseDateLoose (format Indonesia d/m/y)", () => {
  it.each([
    ["2026-10-21", "2026-10-21"],
    ["21/10/2026", "2026-10-21"],
    ["21-10-26", "2026-10-21"],
    ["1/2/2026", "2026-02-01"],
    ["21 Okt 2026", "2026-10-21"],
    ["21 Oktober", "2026-10-21"],
    ["5 agustus 2026", "2026-08-05"],
    ["21/10", "2026-10-21"],
    ["46316", "2026-10-21"],
  ])("%s -> %s", (input, out) => {
    expect(parseDateLoose(input, 2026)).toBe(out);
  });
  it("menolak tanggal tidak valid", () => {
    expect(parseDateLoose("31/02/2026", 2026)).toBeNull();
    expect(parseDateLoose("kemarin", 2026)).toBeNull();
  });
});

describe("parseAmountLoose", () => {
  it.each([
    ["Rp1.250.000", 1_250_000n],
    ["Rp 1.250.000", 1_250_000n],
    ["1,250,000", 1_250_000n],
    ["1250000", 1_250_000n],
    ["1.250.000,00", 1_250_000n],
    ["-50.000", -50_000n],
    ["(50.000)", -50_000n],
    ["-Rp50.000", -50_000n],
    ["IDR 75000", 75_000n],
  ])("%s -> %s", (input, out) => {
    expect(parseAmountLoose(input)).toBe(out);
  });
  it("menolak desimal non-nol, nol, dan teks", () => {
    expect(parseAmountLoose("12.50")).toBeNull();
    expect(parseAmountLoose("1.250.000,50")).toBeNull();
    expect(parseAmountLoose("0")).toBeNull();
    expect(parseAmountLoose("abc")).toBeNull();
  });
});

describe("parseTypeLoose", () => {
  it("memahami bahasa sehari-hari", () => {
    expect(parseTypeLoose("Masuk")).toBe("INCOME");
    expect(parseTypeLoose("pemasukan")).toBe("INCOME");
    expect(parseTypeLoose("Pengeluaran")).toBe("EXPENSE");
    expect(parseTypeLoose("k")).toBe("EXPENSE");
    expect(parseTypeLoose("??")).toBeNull();
  });
});

describe("mapPastedGrid", () => {
  const opts = { defaultYear: 2026, fallbackType: "EXPENSE" as const };

  it("memetakan 5 kolom dari kolom Tanggal dan melewati header", () => {
    const grid = splitTsv(
      "Tanggal\tKeterangan\tJenis\tKategori\tNominal\n21/10/2026\tGaji\tMasuk\tGaji\tRp8.500.000\n22/10/2026\tMakan\tKeluar\tMakan di luar\t35.000",
    );
    expect(mapPastedGrid(grid, "date", opts)).toEqual([
      { date: "2026-10-21", description: "Gaji", type: "INCOME", categoryName: "Gaji", amount: 8_500_000n, invalid: [] },
      { date: "2026-10-22", description: "Makan", type: "EXPENSE", categoryName: "Makan di luar", amount: 35_000n, invalid: [] },
    ]);
  });

  it("mulai dari kolom Keterangan; nominal negatif tanpa jenis = keluar", () => {
    const grid = splitTsv("Parkir\t\t\t-5.000\nBonus\t\t\t1.000.000");
    const rows = mapPastedGrid(grid, "description", { ...opts, fallbackType: "INCOME" });
    expect(rows[0]).toMatchObject({ description: "Parkir", type: "EXPENSE", amount: 5_000n });
    expect(rows[1]).toMatchObject({ description: "Bonus", type: "INCOME", amount: 1_000_000n });
  });

  it("menandai sel yang tidak terbaca", () => {
    const rows = mapPastedGrid([["kemarin", "x", "??", "", "abc"]], "date", opts);
    expect(rows[0]!.invalid.sort()).toEqual(["amount", "date", "type"]);
  });
});

describe("matchCategory", () => {
  const cats = [
    { id: "1", name: "Makan & Minum", type: "EXPENSE" as const, parentName: null },
    { id: "2", name: "Makan di luar", type: "EXPENSE" as const, parentName: "Makan & Minum" },
    { id: "3", name: "Lainnya", type: "EXPENSE" as const, parentName: null },
    { id: "4", name: "Lainnya", type: "INCOME" as const, parentName: null },
  ];
  it("cocokkan nama tanpa beda huruf besar/kecil & sesuai jenis", () => {
    expect(matchCategory("makan di luar", "EXPENSE", cats)).toBe("2");
    expect(matchCategory("Makan & Minum > Makan di luar", "EXPENSE", cats)).toBe("2");
    expect(matchCategory("Lainnya", "INCOME", cats)).toBe("4");
    expect(matchCategory("Lainnya", "EXPENSE", cats)).toBe("3");
    expect(matchCategory("Tidak ada", "EXPENSE", cats)).toBeNull();
    expect(matchCategory("Makan di luar", "INCOME", cats)).toBeNull();
  });
});

describe("parseAmountInput (singkatan saat mengetik)", () => {
  it.each([
    ["35rb", 35_000n],
    ["35k", 35_000n],
    ["1,5jt", 1_500_000n],
    ["1.5jt", 1_500_000n],
    ["2 juta", 2_000_000n],
    ["-20rb", -20_000n],
    ["1.250.000", 1_250_000n],
  ])("%s -> %s", async (input, out) => {
    const { parseAmountInput } = await import("@/lib/paste");
    expect(parseAmountInput(input)).toBe(out);
  });
});
