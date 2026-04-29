import { describe, it, expect } from "vitest";
import { isCancelledF1RaceKey, CANCELLED_F1_RACE_KEYS } from "../lib/f1-cancelled-races.mjs";

describe("f1-cancelled-races", () => {
  it("marca bahrain y saudi_arabia; alinea con calendario cancelado", () => {
    expect(isCancelledF1RaceKey("bahrain")).toBe(true);
    expect(isCancelledF1RaceKey("saudi_arabia")).toBe(true);
    expect(isCancelledF1RaceKey("monaco")).toBe(false);
    expect(isCancelledF1RaceKey("")).toBe(false);
    expect(CANCELLED_F1_RACE_KEYS.size).toBeGreaterThanOrEqual(2);
  });
});
