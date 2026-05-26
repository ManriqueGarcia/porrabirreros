import { describe, it, expect } from "vitest";
import { futbolMatchPoints, mundialKnockoutBonus, scoreMundialJornada } from "../src/mundial-utils.js";
import { buildMundialSeedState } from "../lib/mundial-fixtures.mjs";

describe("mundial scoring", () => {
  it("90′ scoring matches futbol", () => {
    expect(futbolMatchPoints({ home: 2, away: 1 }, { home: 2, away: 1 })).toEqual({ points: 3, exact: true, sign: true });
    expect(futbolMatchPoints({ home: 1, away: 0 }, { home: 2, away: 1 })).toEqual({ points: 1, exact: false, sign: true });
  });

  it("knockout bonus points", () => {
    const pred = { home: 1, away: 1, extraTime: true, penalties: true, penWinner: "home" };
    const res = { home: 1, away: 1, extraTime: true, penalties: true, penWinner: "home" };
    expect(mundialKnockoutBonus(pred, res, true).points).toBe(4);
  });

  it("scores full jornada with penalties", () => {
    const seed = buildMundialSeedState();
    const jId = "wc-md1";
    const db = {
      mundial: {
        ...seed,
        results: {
          [jId]: {
            matches: [{ home: 2, away: 1, extraTime: false, penalties: false }],
          },
        },
        bets: {
          [jId]: {
            Alice: { matches: [{ home: 2, away: 1, extraTime: false, penalties: false }], submittedAt: "2026-01-01T00:00:00.000Z", late: false },
          },
        },
      },
    };
    const s = scoreMundialJornada(db, jId, "Alice");
    expect(s.points).toBe(3);
    expect(s.exact).toBe(1);
  });
});
