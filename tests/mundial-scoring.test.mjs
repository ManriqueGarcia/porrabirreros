import { describe, it, expect } from "vitest";
import { futbolMatchPoints, mundialKnockoutBonus, scoreMundialJornada } from "../src/mundial-utils.js";
import { buildMundialSeedState } from "../lib/mundial-fixtures.mjs";

describe("mundial scoring", () => {
  it("90′ scoring matches futbol", () => {
    expect(futbolMatchPoints({ home: 2, away: 1 }, { home: 2, away: 1 })).toEqual({ points: 3, exact: true, sign: true });
    expect(futbolMatchPoints({ home: 1, away: 0 }, { home: 2, away: 1 })).toEqual({ points: 1, exact: false, sign: true });
  });

  it("knockout bonus points when 90′ sign is correct", () => {
    // empate apuesta → betDraw=true; penaltis+ganador: +1+1=2 (extraTime ya no puntúa)
    const pred = { home: 1, away: 1, penalties: true, penWinner: "home" };
    const res = { home: 1, away: 1, extraTime: true, penalties: true, penWinner: "home" };
    expect(mundialKnockoutBonus(pred, res, true, true).points).toBe(2);
  });

  it("knockout bonus zero when 90′ sign is wrong", () => {
    const pred = { home: 2, away: 0, penalties: true, penWinner: "home" };
    const res = { home: 1, away: 1, extraTime: true, penalties: true, penWinner: "home" };
    expect(mundialKnockoutBonus(pred, res, true, false).points).toBe(0);
  });

  it("knockout bonus counts with sign hit but inexact 90′ score", () => {
    // apuesta 2-2 (empate) con penaltis+ganador; resultado 1-1 → sign ok → bonos aplican
    const pred = { home: 2, away: 2, penalties: true, penWinner: "home" };
    const res = { home: 1, away: 1, extraTime: true, penalties: true, penWinner: "home" };
    expect(futbolMatchPoints(pred, res).sign).toBe(true);
    expect(mundialKnockoutBonus(pred, res, true, true).points).toBe(2);
  });

  it("KO jornada: inexact 90′ with sign still earns KO bonus via scoreMundialJornada", () => {
    const seed = buildMundialSeedState();
    const jId = "wc-r32";
    const db = {
      mundial: {
        ...seed,
        results: {
          [jId]: {
            matches: [{ home: 1, away: 1, extraTime: true, penalties: true, penWinner: "home" }],
          },
        },
        bets: {
          [jId]: {
            Alice: {
              matches: [{ home: 2, away: 2, extraTime: true, penalties: true, penWinner: "home" }],
              submittedAt: "2026-01-01T00:00:00.000Z",
              late: false,
            },
          },
        },
      },
    };
    const s = scoreMundialJornada(db, jId, "Alice");
    expect(s.exact).toBe(0);
    expect(s.signs).toBe(1);
    expect(s.points).toBe(3); // signo +1, penaltis +1, ganador +1
  });

  it("scores high two-digit results (e.g. 21-0)", () => {
    const seed = buildMundialSeedState();
    const jId = "wc-md1";
    const db = {
      mundial: {
        ...seed,
        results: {
          [jId]: {
            matches: [{ home: 21, away: 0, extraTime: false, penalties: false }],
          },
        },
        bets: {
          [jId]: {
            Alice: { matches: [{ home: 21, away: 0, extraTime: false, penalties: false }], submittedAt: "2026-01-01T00:00:00.000Z", late: false },
            Bob: { matches: [{ home: 10, away: 0, extraTime: false, penalties: false }], submittedAt: "2026-01-01T00:00:00.000Z", late: false },
          },
        },
      },
    };
    expect(scoreMundialJornada(db, jId, "Alice").points).toBe(3);
    expect(scoreMundialJornada(db, jId, "Bob").points).toBe(1);
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
