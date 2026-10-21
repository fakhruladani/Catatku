import "server-only";
import ExcelJS from "exceljs";
import { getYearlyRecap } from "@/features/recap/service";
import { getSheet } from "@/features/transactions/service";
import { formatPeriodLabel, formatPeriodRange, periodKey as makeKey } from "@/lib/period";
import type { UserCtx } from "@/server/auth/session";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const RP = '"Rp"#,##0;[Red]-"Rp"#,##0';
const HEADER_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE5E7EB" } };

/** Nominal aman diubah ke number untuk Excel (batas nominal aplikasi < 2^53). */
const num = (v: bigint) => Number(v);

function styleHeader(row: ExcelJS.Row) {
  row.font = { bold: true };
  row.eachCell((c) => {
    c.fill = HEADER_FILL;
    c.border = { bottom: { style: "thin" } };
  });
}

/**
 * Workbook satu tahun buku: 12 sheet bulan (dengan rumus saldo berjalan & total)
 * + sheet Rekap Tahunan. Semua data diambil lewat service ter-scope milik user.
 */
export async function buildYearWorkbook(ctx: UserCtx, year: number): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Catatku";
  wb.created = new Date();

  const recap = await getYearlyRecap(ctx, { year });

  for (let m = 1; m <= 12; m++) {
    const key = makeKey(year, m);
    const sheet = await getSheet(ctx, { periodKey: key });
    const catName = new Map<string, string>();
    for (const c of sheet.categories) {
      catName.set(c.id, c.name);
      for (const ch of c.children) catName.set(ch.id, `${c.name} › ${ch.name}`);
    }

    const ws = wb.addWorksheet(MONTHS[m - 1]!, { views: [{ state: "frozen", ySplit: 3 }] });
    ws.columns = [
      { key: "no", width: 5 },
      { key: "date", width: 12 },
      { key: "desc", width: 36 },
      { key: "type", width: 9 },
      { key: "cat", width: 30 },
      { key: "amount", width: 16 },
      { key: "balance", width: 16 },
    ];
    ws.mergeCells("A1:G1");
    ws.getCell("A1").value = `Buku Kas ${formatPeriodLabel(key)} (${formatPeriodRange(sheet.period)})`;
    ws.getCell("A1").font = { bold: true, size: 13 };
    styleHeader(ws.addRow(["#", "Tanggal", "Keterangan", "Jenis", "Kategori", "Nominal", "Saldo"]));
    const opening = ws.addRow(["", "", "Saldo awal periode", "", "", "", num(sheet.openingBalance)]);
    opening.font = { italic: true };

    const first = opening.number + 1;
    sheet.rows.forEach((r, i) => {
      const rowNum = first + i;
      ws.addRow([
        i + 1,
        new Date(`${r.date}T00:00:00Z`),
        r.description,
        r.type === "INCOME" ? "Masuk" : "Keluar",
        r.categoryId ? (catName.get(r.categoryId) ?? "") : "",
        num(r.amount),
        { formula: `G${rowNum - 1}+IF(D${rowNum}="Masuk",F${rowNum},-F${rowNum})` },
      ]);
    });
    const last = first + sheet.rows.length - 1;
    ws.getColumn("date").numFmt = "dd/mm/yyyy";
    ws.getColumn("amount").numFmt = RP;
    ws.getColumn("balance").numFmt = RP;

    ws.addRow([]);
    const range = sheet.rows.length > 0 ? `D${first}:D${last}` : `D${first}:D${first}`;
    const amt = sheet.rows.length > 0 ? `F${first}:F${last}` : `F${first}:F${first}`;
    const tIn = ws.addRow(["", "", "Total pemasukan", "", "", { formula: `SUMIF(${range},"Masuk",${amt})` }]);
    const tOut = ws.addRow(["", "", "Total pengeluaran", "", "", { formula: `SUMIF(${range},"Keluar",${amt})` }]);
    ws.addRow(["", "", "Selisih", "", "", { formula: `F${tIn.number}-F${tOut.number}` }]);
    ws.addRow(["", "", "Saldo akhir", "", "", { formula: `G${opening.number}+F${tIn.number}-F${tOut.number}` }]);
    for (let r = tIn.number; r <= tIn.number + 3; r++) ws.getRow(r).font = { bold: true };
    ws.autoFilter = { from: { row: 2, column: 1 }, to: { row: 2, column: 7 } };
  }

  // ── Rekap tahunan ──
  const ws = wb.addWorksheet("Rekap Tahunan");
  ws.getCell("A1").value = `Rekap Tahun ${year}`;
  ws.getCell("A1").font = { bold: true, size: 13 };
  styleHeader(ws.addRow(["Bulan", "Pemasukan", "Pengeluaran", "Selisih", "Saldo akhir"]));
  recap.monthly.forEach((m, i) => ws.addRow([MONTHS[i], num(m.income), num(m.expense), num(m.net), num(m.closingBalance)]));
  const total = ws.addRow(["Total", num(recap.totals.income), num(recap.totals.expense), num(recap.totals.net), num(recap.closingBalance)]);
  total.font = { bold: true };
  ws.addRow([]);
  styleHeader(ws.addRow(["Pengeluaran per kategori", ...MONTHS, "Total", "Rata-rata/bln"]));
  for (const p of recap.expensePivot) ws.addRow([p.name, ...p.months.map(num), num(p.total), num(p.average)]);
  ws.addRow([]);
  styleHeader(ws.addRow(["Pemasukan per kategori", ...MONTHS, "Total", "Rata-rata/bln"]));
  for (const p of recap.incomePivot) ws.addRow([p.name, ...p.months.map(num), num(p.total), num(p.average)]);
  ws.getColumn(1).width = 28;
  for (let c = 2; c <= 15; c++) {
    ws.getColumn(c).width = 14;
    ws.getColumn(c).numFmt = RP;
  }

  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out as ArrayBuffer);
}
