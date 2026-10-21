import { describe, expect, it } from "vitest";
import {
  currentPeriodKey,
  formatPeriodLabel,
  fromDbDate,
  getPeriodKeyForDate,
  getPeriodRange,
  lastNPeriods,
  shiftPeriod,
  toDbDate,
  todayInJakarta,
} from "@/lib/period";

describe("getPeriodRange", () => {
  it("startDay 1 = bulan kalender", () => {
    expect(getPeriodRange("2026-10", 1)).toEqual({ key: "2026-10", start: "2026-10-01", end: "2026-10-31" });
    expect(getPeriodRange("2028-02", 1).end).toBe("2028-02-29"); // kabisat
    expect(getPeriodRange("2026-02", 1).end).toBe("2026-02-28");
  });

  it("startDay 25: periode Oktober = 25 Sep – 24 Okt (contoh di spesifikasi)", () => {
    expect(getPeriodRange("2026-10", 25)).toEqual({ key: "2026-10", start: "2026-09-25", end: "2026-10-24" });
  });

  it("melintasi pergantian tahun", () => {
    expect(getPeriodRange("2027-01", 25)).toEqual({ key: "2027-01", start: "2026-12-25", end: "2027-01-24" });
  });

  it("startDay 28 di bulan Maret (sebelumnya Februari)", () => {
    expect(getPeriodRange("2026-03", 28)).toEqual({ key: "2026-03", start: "2026-02-28", end: "2026-03-27" });
  });

  it("menolak startDay di luar 1..28", () => {
    expect(() => getPeriodRange("2026-10", 0)).toThrow();
    expect(() => getPeriodRange("2026-10", 29)).toThrow();
    expect(() => getPeriodRange("2026-10", 31)).toThrow();
    expect(() => getPeriodRange("2026-13", 1)).toThrow();
  });
});

describe("getPeriodKeyForDate", () => {
  it("startDay 1", () => {
    expect(getPeriodKeyForDate("2026-10-01", 1)).toBe("2026-10");
    expect(getPeriodKeyForDate("2026-10-31", 1)).toBe("2026-10");
  });

  it("startDay 25: batas periode", () => {
    expect(getPeriodKeyForDate("2026-10-24", 25)).toBe("2026-10");
    expect(getPeriodKeyForDate("2026-10-25", 25)).toBe("2026-11");
    expect(getPeriodKeyForDate("2026-09-25", 25)).toBe("2026-10");
    expect(getPeriodKeyForDate("2026-12-25", 25)).toBe("2027-01");
  });

  it("konsisten dengan getPeriodRange untuk setiap tanggal dalam setahun dan setiap startDay", () => {
    for (let startDay = 1; startDay <= 28; startDay++) {
      for (let d = new Date(Date.UTC(2026, 0, 1)); d.getUTCFullYear() === 2026; d.setUTCDate(d.getUTCDate() + 1)) {
        const date = d.toISOString().slice(0, 10);
        const r = getPeriodRange(getPeriodKeyForDate(date, startDay), startDay);
        expect(date >= r.start && date <= r.end, `${date} startDay=${startDay}`).toBe(true);
      }
    }
  });

  it("periode berurutan tidak tumpang tindih dan tidak berlubang", () => {
    for (const startDay of [1, 10, 25, 28]) {
      let key = "2025-11";
      for (let i = 0; i < 15; i++) {
        const cur = getPeriodRange(key, startDay);
        const nextR = getPeriodRange(shiftPeriod(key, 1), startDay);
        const dayAfterEnd = new Date(`${cur.end}T00:00:00Z`);
        dayAfterEnd.setUTCDate(dayAfterEnd.getUTCDate() + 1);
        expect(nextR.start).toBe(dayAfterEnd.toISOString().slice(0, 10));
        key = shiftPeriod(key, 1);
      }
    }
  });
});

describe("helpers periode", () => {
  it("shiftPeriod & lastNPeriods", () => {
    expect(shiftPeriod("2026-01", -1)).toBe("2025-12");
    expect(shiftPeriod("2026-12", 1)).toBe("2027-01");
    expect(lastNPeriods("2026-02", 3)).toEqual(["2025-12", "2026-01", "2026-02"]);
    expect(lastNPeriods("2026-10", 12)).toHaveLength(12);
  });

  it("zona waktu Asia/Jakarta (UTC+7)", () => {
    // 2026-10-20 18:30 UTC = 2026-10-21 01:30 WIB
    const now = new Date("2026-10-20T18:30:00Z");
    expect(todayInJakarta(now)).toBe("2026-10-21");
    expect(currentPeriodKey(21, now)).toBe("2026-11");
    expect(currentPeriodKey(22, now)).toBe("2026-10");
  });

  it("konversi kolom @db.Date tidak bergeser", () => {
    expect(fromDbDate(toDbDate("2026-10-21"))).toBe("2026-10-21");
    expect(() => toDbDate("2026-02-30")).toThrow();
  });

  it("label", () => {
    expect(formatPeriodLabel("2026-10")).toBe("Oktober 2026");
  });
});
