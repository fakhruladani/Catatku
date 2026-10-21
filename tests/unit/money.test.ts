import { describe, expect, it } from "vitest";
import { formatRupiah, parseRupiahInput, sumBigInt, toBigInt } from "@/lib/money";
import { zMoney, zMoneyPositive } from "@/lib/validation";

describe("formatRupiah", () => {
  it("memformat sesuai gaya Indonesia tanpa spasi", () => {
    expect(formatRupiah(1250000n)).toBe("Rp1.250.000");
    expect(formatRupiah(0n)).toBe("Rp0");
    expect(formatRupiah(999n)).toBe("Rp999");
    expect(formatRupiah(1000n)).toBe("Rp1.000");
    expect(formatRupiah(-5000n)).toBe("-Rp5.000");
    expect(formatRupiah("123456789012")).toBe("Rp123.456.789.012");
  });

  it("tetap presisi untuk angka di atas Number.MAX_SAFE_INTEGER", () => {
    expect(formatRupiah(900719925474099312n)).toBe("Rp900.719.925.474.099.312");
  });
});

describe("parseRupiahInput", () => {
  it("menerima berbagai format input", () => {
    expect(parseRupiahInput("1.250.000")).toBe(1250000n);
    expect(parseRupiahInput("Rp1.250.000")).toBe(1250000n);
    expect(parseRupiahInput("rp 1.250.000")).toBe(1250000n);
    expect(parseRupiahInput("1250000")).toBe(1250000n);
    expect(parseRupiahInput("-5.000")).toBe(-5000n);
  });

  it("menolak desimal, pemisah salah, dan teks", () => {
    expect(parseRupiahInput("1.250.000,50")).toBeNull();
    expect(parseRupiahInput("12.50")).toBeNull();
    expect(parseRupiahInput("1.2345")).toBeNull();
    expect(parseRupiahInput("abc")).toBeNull();
    expect(parseRupiahInput("")).toBeNull();
  });
});

describe("zod money", () => {
  it("mengubah string/number menjadi bigint dan menolak float", () => {
    expect(zMoney.parse("1.000")).toBe(1000n);
    expect(zMoney.parse(2500)).toBe(2500n);
    expect(zMoney.safeParse(10.5).success).toBe(false);
    expect(zMoneyPositive.safeParse("0").success).toBe(false);
    expect(zMoneyPositive.safeParse("-1").success).toBe(false);
  });
});

describe("helpers", () => {
  it("toBigInt & sumBigInt", () => {
    expect(toBigInt("42")).toBe(42n);
    expect(() => toBigInt(1.5)).toThrow();
    expect(sumBigInt([1n, 2n, 3n])).toBe(6n);
  });
});
