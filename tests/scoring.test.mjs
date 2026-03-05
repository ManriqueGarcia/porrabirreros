import { describe, it, expect } from "vitest";
import { futbolSign, futbolMatchPoints, scoreForRace } from "../lib/scoring.mjs";

describe("futbolSign", () => {
  it("returns 1 for home win", () => expect(futbolSign({ home: 2, away: 1 })).toBe("1"));
  it("returns 2 for away win", () => expect(futbolSign({ home: 0, away: 3 })).toBe("2"));
  it("returns X for draw", () => expect(futbolSign({ home: 1, away: 1 })).toBe("X"));
  it("returns null for null input", () => expect(futbolSign(null)).toBeNull());
  it("returns null for missing home", () => expect(futbolSign({ away: 1 })).toBeNull());
});

describe("futbolMatchPoints", () => {
  it("exact match gives 3 points", () => {
    const r = futbolMatchPoints({ home: 2, away: 1 }, { home: 2, away: 1 });
    expect(r.points).toBe(3);
    expect(r.exact).toBe(true);
    expect(r.sign).toBe(true);
  });
  it("correct sign gives 1 point", () => {
    const r = futbolMatchPoints({ home: 3, away: 0 }, { home: 1, away: 0 });
    expect(r.points).toBe(1);
    expect(r.exact).toBe(false);
    expect(r.sign).toBe(true);
  });
  it("wrong prediction gives 0 points", () => {
    const r = futbolMatchPoints({ home: 2, away: 0 }, { home: 0, away: 1 });
    expect(r.points).toBe(0);
  });
  it("draw exact match", () => {
    const r = futbolMatchPoints({ home: 0, away: 0 }, { home: 0, away: 0 });
    expect(r.points).toBe(3);
    expect(r.exact).toBe(true);
  });
  it("draw sign match (different score)", () => {
    const r = futbolMatchPoints({ home: 1, away: 1 }, { home: 2, away: 2 });
    expect(r.points).toBe(1);
    expect(r.sign).toBe(true);
  });
  it("null prediction gives 0", () => {
    expect(futbolMatchPoints(null, { home: 1, away: 0 }).points).toBe(0);
  });
  it("null result gives 0", () => {
    expect(futbolMatchPoints({ home: 1, away: 0 }, null).points).toBe(0);
  });
});

describe("scoreForRace (F1)", () => {
  const db = {
    bets: { gp1: { user1: { pole: "VER", podium: ["VER", "NOR", "LEC"], q: ["Sí", "No", "3"], submittedAt: "2025-01-01" } } },
    results: { gp1: { pole: "VER", podium: ["VER", "NOR", "LEC"], qAnswers: ["Sí", "No", "3"] } },
  };

  it("full house scores maximum (pole+podium+questions+bonuses)", () => {
    const s = scoreForRace(db, "gp1", "user1");
    expect(s.points).toBe(11);
    expect(s.hits).toBe(7);
    expect(s.exact).toBe(1);
    expect(s.fullHouse).toBe(true);
    expect(s.missed).toBe(false);
  });

  it("no bet gives -3 when results exist", () => {
    const s = scoreForRace(db, "gp1", "nobody");
    expect(s.points).toBe(-3);
    expect(s.missed).toBe(true);
    expect(s.pen).toBe(1);
  });

  it("no bet gives 0 when no results", () => {
    const s = scoreForRace(db, "gp2", "nobody");
    expect(s.points).toBe(0);
    expect(s.missed).toBe(false);
  });

  it("only pole correct gives 1 point", () => {
    const dbPole = {
      bets: { gp1: { user1: { pole: "VER", podium: ["HAM", "SAI", "ALO"], q: ["", "", ""], submittedAt: "2025-01-01" } } },
      results: { gp1: { pole: "VER", podium: ["VER", "NOR", "LEC"], qAnswers: ["Sí", "No", "3"] } },
    };
    const s = scoreForRace(dbPole, "gp1", "user1");
    expect(s.hits).toBe(1);
    expect(s.gotPole).toBe(true);
    expect(s.gotAllPodium).toBe(false);
  });

  it("late bet applies -2 penalty", () => {
    const dbLate = {
      bets: { gp1: { user1: { pole: "VER", podium: ["VER", "NOR", "LEC"], q: ["", "", ""], submittedAt: "2025-01-01", late: true } } },
      results: { gp1: { pole: "VER", podium: ["VER", "NOR", "LEC"], qAnswers: ["Sí", "No", "3"] } },
    };
    const s = scoreForRace(dbLate, "gp1", "user1");
    expect(s.late).toBe(true);
    expect(s.pen).toBeGreaterThan(0);
  });

  it("incomplete bet (no pole, <3 podium) applies -1 penalty", () => {
    const dbInc = {
      bets: { gp1: { user1: { podium: ["VER"], q: [], submittedAt: "2025-01-01" } } },
      results: { gp1: { pole: "VER", podium: ["VER", "NOR", "LEC"] } },
    };
    const s = scoreForRace(dbInc, "gp1", "user1");
    expect(s.pen).toBe(1);
  });

  it("manual score adjustment is applied", () => {
    const dbAdj = {
      bets: { gp1: { user1: { pole: "", podium: ["", "", ""], q: [], submittedAt: "2025-01-01" } } },
      results: { gp1: { pole: "VER", podium: ["VER", "NOR", "LEC"] } },
      scoreAdjustments: { gp1: { user1: 5 } },
    };
    const s = scoreForRace(dbAdj, "gp1", "user1");
    expect(s.manualAdj).toBe(5);
  });
});
