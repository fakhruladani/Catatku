import ExcelJS from "exceljs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildYearWorkbook } from "@/features/export/xlsx";
import * as tx from "@/features/transactions/service";
import { basePrisma, createTestUser, resetDb } from "../support/db";

let A: Awaited<ReturnType<typeof createTestUser>>;
let B: Awaited<ReturnType<typeof createTestUser>>;

beforeAll(async () => {
  await resetDb();
  A = await createTestUser("Ana");
  B = await createTestUser("Beni");
  await tx.createTransaction(A, { date: "2026-03-10", type: "INCOME", amount: 2_000_000n, description: "Gaji A", categoryId: null });
  await tx.createTransaction(A, { date: "2026-03-11", type: "EXPENSE", amount: 150_000n, description: "Makan A", categoryId: null });
  await tx.createTransaction(B, { date: "2026-03-12", type: "EXPENSE", amount: 777_777n, description: "Rahasia B", categoryId: null });
});
afterAll(() => basePrisma.$disconnect());

describe("ekspor Excel", () => {
  it("berisi 12 sheet bulan + rekap, hanya data milik user", async () => {
    const buf = await buildYearWorkbook(A, 2026);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as unknown as ArrayBuffer);
    expect(wb.worksheets.map((w) => w.name)).toEqual([
      "Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des", "Rekap Tahunan",
    ]);
    const mar = wb.getWorksheet("Mar")!;
    const descs: string[] = [];
    mar.eachRow((r) => descs.push(String(r.getCell(3).value ?? "")));
    expect(descs).toContain("Gaji A");
    expect(descs).toContain("Makan A");
    expect(descs.join("|")).not.toContain("Rahasia B");
    // baris data pertama di bawah "Saldo awal" punya rumus saldo berjalan
    expect(mar.getCell("G4").value).toMatchObject({ formula: 'G3+IF(D4="Masuk",F4,-F4)' });
    const rekap = wb.getWorksheet("Rekap Tahunan")!;
    expect(rekap.getCell("B5").value).toBe(2_000_000);
    expect(rekap.getCell("C5").value).toBe(150_000);
  });
});
