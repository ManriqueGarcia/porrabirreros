import { describe, it, expect } from "vitest";

/** Réplica mínima de validateMundialResult (porra-state-api.mjs) para regresión. */
function validateMundialResult(result) {
  if (result.matches && !Array.isArray(result.matches)) return "matches debe ser un array";
  if (result.matches && result.matches.length > 20) return "demasiados partidos";
  if (result.matches) {
    for (const m of result.matches) {
      if (!m || typeof m !== "object") return "partido inválido";
      const h = Number(m.home), a = Number(m.away);
      if (!Number.isInteger(h) || h < 0 || h > 99) return "marcador fuera de rango";
      if (!Number.isInteger(a) || a < 0 || a > 99) return "marcador fuera de rango";
    }
  }
  return null;
}

describe("mundial result validation", () => {
  it("accepts two-digit scores 0-99", () => {
    expect(validateMundialResult({ matches: [{ home: 21, away: 0 }] })).toBeNull();
    expect(validateMundialResult({ matches: [{ home: 10, away: 9 }] })).toBeNull();
  });

  it("rejects scores above 99", () => {
    expect(validateMundialResult({ matches: [{ home: 100, away: 0 }] })).toBe("marcador fuera de rango");
  });
});
