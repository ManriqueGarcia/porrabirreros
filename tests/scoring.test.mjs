import { describe, it, expect } from "vitest";
import {
  scoreForRace, computeGPWins, computeGlobalStandings,
  describeBetAgainstResult, buildStats, topList, hasRaceResults,
} from "../lib/scoring.mjs";

// ─── hasRaceResults ───

describe("hasRaceResults", () => {
  it("null/undefined → false", () => {
    expect(hasRaceResults(null)).toBe(false);
    expect(hasRaceResults(undefined)).toBe(false);
  });

  it("empty object → false", () => {
    expect(hasRaceResults({})).toBe(false);
  });

  it("empty strings in pole and podium → false", () => {
    expect(hasRaceResults({ pole: "", podium: ["", "", ""], qAnswers: ["", "", ""] })).toBe(false);
  });

  it("only qAnswers filled → false (need pole or podium)", () => {
    expect(hasRaceResults({ pole: "", podium: ["", "", ""], qAnswers: ["Sí", "No", "3"] })).toBe(false);
  });

  it("pole filled → true", () => {
    expect(hasRaceResults({ pole: "VER", podium: ["", "", ""] })).toBe(true);
  });

  it("podium partially filled → true", () => {
    expect(hasRaceResults({ pole: "", podium: ["VER", "", ""] })).toBe(true);
  });

  it("full results → true", () => {
    expect(hasRaceResults({ pole: "VER", podium: ["VER", "NOR", "LEC"], qAnswers: ["A", "B", "C"] })).toBe(true);
  });
});

// ─── scoreForRace ───

describe("scoreForRace", () => {
  const mkDb = (bet, result, adj) => ({
    bets: bet ? { gp1: { user1: bet } } : {},
    results: result ? { gp1: result } : {},
    scoreAdjustments: adj ? { gp1: { user1: adj } } : {},
  });

  it("full house = 11 pts (1 pole + 3 podium + 3 questions + 2 bonus pole+pod + 2 bonus pleno)", () => {
    const db = mkDb(
      { pole: "VER", podium: ["VER", "NOR", "LEC"], q: ["Sí", "No", "3"], submittedAt: "2025-01-01" },
      { pole: "VER", podium: ["VER", "NOR", "LEC"], qAnswers: ["Sí", "No", "3"] },
    );
    const s = scoreForRace(db, "gp1", "user1");
    expect(s.points).toBe(11);
    expect(s.hits).toBe(7);
    expect(s.exact).toBe(1);
    expect(s.fullHouse).toBe(true);
    expect(s.gotPole).toBe(true);
    expect(s.gotAllPodium).toBe(true);
    expect(s.gotAllQuestions).toBe(true);
    expect(s.pen).toBe(0);
    expect(s.missed).toBe(false);
    expect(s.late).toBe(false);
  });

  it("pole + podium correct, questions wrong → 6 pts (1+3+2 bonus)", () => {
    const db = mkDb(
      { pole: "VER", podium: ["VER", "NOR", "LEC"], q: ["X", "X", "X"], submittedAt: "2025-01-01" },
      { pole: "VER", podium: ["VER", "NOR", "LEC"], qAnswers: ["Sí", "No", "3"] },
    );
    const s = scoreForRace(db, "gp1", "user1");
    expect(s.points).toBe(6);
    expect(s.hits).toBe(4);
    expect(s.gotPole).toBe(true);
    expect(s.gotAllPodium).toBe(true);
    expect(s.gotAllQuestions).toBe(false);
    expect(s.fullHouse).toBe(false);
  });

  it("only pole correct → 1 pt", () => {
    const db = mkDb(
      { pole: "VER", podium: ["HAM", "SAI", "ALO"], q: ["X", "X", "X"], submittedAt: "2025-01-01" },
      { pole: "VER", podium: ["VER", "NOR", "LEC"], qAnswers: ["Sí", "No", "3"] },
    );
    const s = scoreForRace(db, "gp1", "user1");
    expect(s.points).toBe(1);
    expect(s.gotPole).toBe(true);
    expect(s.gotAllPodium).toBe(false);
  });

  it("only podium correct (no pole) → 3 pts podium + no pole+podium bonus", () => {
    const db = mkDb(
      { pole: "HAM", podium: ["VER", "NOR", "LEC"], q: ["X", "X", "X"], submittedAt: "2025-01-01" },
      { pole: "VER", podium: ["VER", "NOR", "LEC"], qAnswers: ["Sí", "No", "3"] },
    );
    const s = scoreForRace(db, "gp1", "user1");
    expect(s.points).toBe(3);
    expect(s.gotPole).toBe(false);
    expect(s.gotAllPodium).toBe(true);
    expect(s.exact).toBe(1);
  });

  it("partial podium (2 of 3 correct) → 2 pts", () => {
    const db = mkDb(
      { pole: "HAM", podium: ["VER", "NOR", "SAI"], q: ["X", "X", "X"], submittedAt: "2025-01-01" },
      { pole: "VER", podium: ["VER", "NOR", "LEC"], qAnswers: ["Sí", "No", "3"] },
    );
    const s = scoreForRace(db, "gp1", "user1");
    expect(s.points).toBe(2);
    expect(s.gotAllPodium).toBe(false);
    expect(s.exact).toBe(0);
  });

  it("questions are case-insensitive and trim-safe", () => {
    const db = mkDb(
      { pole: "HAM", podium: ["X", "X", "X"], q: [" sí ", " NO", "3 "], submittedAt: "2025-01-01" },
      { pole: "VER", podium: ["VER", "NOR", "LEC"], qAnswers: ["Sí", "No", "3"] },
    );
    const s = scoreForRace(db, "gp1", "user1");
    expect(s.hits).toBe(3);
  });

  it("no bet + results exist → -3 pts, missed=true", () => {
    const db = mkDb(null, { pole: "VER", podium: ["VER", "NOR", "LEC"] });
    const s = scoreForRace(db, "gp1", "user1");
    expect(s.points).toBe(-3);
    expect(s.missed).toBe(true);
    expect(s.pen).toBe(1);
  });

  it("no bet + no results → 0 pts, missed=false", () => {
    const db = mkDb(null, null);
    const s = scoreForRace(db, "gp1", "user1");
    expect(s.points).toBe(0);
    expect(s.missed).toBe(false);
  });

  it("bet exists but no results → 0 pts, no penalties", () => {
    const db = mkDb(
      { pole: "VER", podium: ["VER", "NOR", "LEC"], q: ["A", "B", "C"], submittedAt: "2025-01-01" },
      null,
    );
    const s = scoreForRace(db, "gp1", "user1");
    expect(s.points).toBe(0);
    expect(s.pen).toBe(0);
    expect(s.hits).toBe(0);
    expect(s.missed).toBe(false);
    expect(s.late).toBe(false);
  });

  it("incomplete bet + no results → 0 pts, no premature penalties", () => {
    const db = mkDb(
      { podium: ["HAM"], q: ["Sí", "No", "3"], submittedAt: "2025-01-01" },
      null,
    );
    const s = scoreForRace(db, "gp1", "user1");
    expect(s.points).toBe(0);
    expect(s.pen).toBe(0);
  });

  it("late bet + no results → 0 pts, no premature late penalty", () => {
    const db = mkDb(
      { pole: "VER", podium: ["VER", "NOR", "LEC"], q: [], submittedAt: "2025-01-01", late: true },
      null,
    );
    const s = scoreForRace(db, "gp1", "user1");
    expect(s.points).toBe(0);
    expect(s.pen).toBe(0);
    expect(s.late).toBe(false);
  });

  it("empty results object (all empty strings) → treated as no results", () => {
    const db = mkDb(
      { pole: "VER", podium: ["VER", "NOR", "LEC"], q: ["A", "B", "C"], submittedAt: "2025-01-01" },
      { pole: "", podium: ["", "", ""], qAnswers: ["", "", ""] },
    );
    const s = scoreForRace(db, "gp1", "user1");
    expect(s.points).toBe(0);
    expect(s.pen).toBe(0);
    expect(s.hits).toBe(0);
    expect(s.missed).toBe(false);
  });

  it("no bet + empty results object → 0 pts, not missed", () => {
    const db = mkDb(
      null,
      { pole: "", podium: ["", "", ""], qAnswers: ["", "", ""] },
    );
    const s = scoreForRace(db, "gp1", "user1");
    expect(s.points).toBe(0);
    expect(s.missed).toBe(false);
    expect(s.pen).toBe(0);
  });

  it("incomplete bet (no pole, <3 podium) → -1 penalty", () => {
    const db = mkDb(
      { podium: ["HAM"], q: [], submittedAt: "2025-01-01" },
      { pole: "VER", podium: ["VER", "NOR", "LEC"] },
    );
    const s = scoreForRace(db, "gp1", "user1");
    expect(s.pen).toBe(1);
    expect(s.points).toBe(-1);
  });

  it("late bet → -2 penalty", () => {
    const db = mkDb(
      { pole: "VER", podium: ["VER", "NOR", "LEC"], q: [], submittedAt: "2025-01-01", late: true },
      { pole: "VER", podium: ["VER", "NOR", "LEC"], qAnswers: [] },
    );
    const s = scoreForRace(db, "gp1", "user1");
    expect(s.late).toBe(true);
    expect(s.pen).toBeGreaterThan(0);
  });

  it("late + full podium correct → points reduced by 2", () => {
    const db = mkDb(
      { pole: "VER", podium: ["VER", "NOR", "LEC"], q: [], submittedAt: "2025-01-01", late: true },
      { pole: "VER", podium: ["VER", "NOR", "LEC"], qAnswers: [] },
    );
    const sLate = scoreForRace(db, "gp1", "user1");
    db.bets.gp1.user1.late = false;
    const sOnTime = scoreForRace(db, "gp1", "user1");
    expect(sOnTime.points - sLate.points).toBe(2);
  });

  it("manual adjustment is applied", () => {
    const db = mkDb(
      { pole: "X", podium: ["X", "X", "X"], q: [], submittedAt: "2025-01-01" },
      { pole: "VER", podium: ["VER", "NOR", "LEC"] },
      5,
    );
    const s = scoreForRace(db, "gp1", "user1");
    expect(s.manualAdj).toBe(5);
    expect(s.points).toBeGreaterThanOrEqual(4);
  });

  it("all wrong → 0 pts (no penalty if bet is complete)", () => {
    const db = mkDb(
      { pole: "HAM", podium: ["HAM", "SAI", "ALO"], q: ["X", "X", "X"], submittedAt: "2025-01-01" },
      { pole: "VER", podium: ["VER", "NOR", "LEC"], qAnswers: ["Sí", "No", "3"] },
    );
    const s = scoreForRace(db, "gp1", "user1");
    expect(s.points).toBe(0);
    expect(s.hits).toBe(0);
    expect(s.pen).toBe(0);
  });

  it("delegated bet (delegated=true) scores normally", () => {
    const db = mkDb(
      { pole: "VER", podium: ["VER", "NOR", "LEC"], q: ["A", "B", "C"], submittedAt: "2025-01-01", delegated: true },
      { pole: "VER", podium: ["VER", "NOR", "LEC"], qAnswers: ["A", "B", "C"] },
    );
    const s = scoreForRace(db, "gp1", "user1");
    expect(s.points).toBe(11);
    expect(s.late).toBe(false);
  });
});

// ─── computeGPWins ───

describe("computeGPWins", () => {
  it("awards win to sole leader per race", () => {
    const db = {
      bets: {
        gp1: {
          alice: { pole: "VER", podium: ["VER", "NOR", "LEC"], q: [], submittedAt: "2025-01-01" },
          bob:   { pole: "HAM", podium: ["HAM", "SAI", "ALO"], q: [], submittedAt: "2025-01-01" },
        },
      },
      results: { gp1: { pole: "VER", podium: ["VER", "NOR", "LEC"], qAnswers: [] } },
    };
    const wins = computeGPWins(db, [{ key: "gp1" }], ["alice", "bob"]);
    expect(wins.alice).toBe(1);
    expect(wins.bob).toBe(0);
  });

  it("no win when tied", () => {
    const db = {
      bets: {
        gp1: {
          alice: { pole: "VER", podium: ["X", "X", "X"], q: [], submittedAt: "2025-01-01" },
          bob:   { pole: "VER", podium: ["X", "X", "X"], q: [], submittedAt: "2025-01-01" },
        },
      },
      results: { gp1: { pole: "VER", podium: ["VER", "NOR", "LEC"], qAnswers: [] } },
    };
    const wins = computeGPWins(db, [{ key: "gp1" }], ["alice", "bob"]);
    expect(wins.alice).toBe(0);
    expect(wins.bob).toBe(0);
  });

  it("skips races without results", () => {
    const db = { bets: { gp1: { alice: { pole: "VER", podium: [], q: [] } } }, results: {} };
    const wins = computeGPWins(db, [{ key: "gp1" }], ["alice"]);
    expect(wins.alice).toBe(0);
  });

  it("skips races with empty results object", () => {
    const db = {
      bets: { gp1: { alice: { pole: "VER", podium: ["VER", "NOR", "LEC"], q: [], submittedAt: "2025-01-01" } } },
      results: { gp1: { pole: "", podium: ["", "", ""], qAnswers: ["", "", ""] } },
    };
    const wins = computeGPWins(db, [{ key: "gp1" }], ["alice"]);
    expect(wins.alice).toBe(0);
  });
});

// ─── computeGlobalStandings ───

describe("computeGlobalStandings", () => {
  it("sorts by points descending", () => {
    const db = {
      bets: {
        gp1: {
          alice: { pole: "VER", podium: ["VER", "NOR", "LEC"], q: [], submittedAt: "2025-01-01" },
          bob:   { pole: "HAM", podium: ["HAM", "SAI", "ALO"], q: [], submittedAt: "2025-01-01" },
        },
      },
      results: { gp1: { pole: "VER", podium: ["VER", "NOR", "LEC"], qAnswers: [] } },
    };
    const standings = computeGlobalStandings(db, [{ key: "gp1" }], ["alice", "bob"]);
    expect(standings[0].name).toBe("alice");
    expect(standings[1].name).toBe("bob");
    expect(standings[0].points).toBeGreaterThan(standings[1].points);
  });

  it("tiebreaker: wins > exact > hits > pen > avgSubmit", () => {
    const db = {
      bets: {
        gp1: {
          alice: { pole: "VER", podium: ["X", "X", "X"], q: [], submittedAt: "2025-01-02T00:00:00Z" },
          bob:   { pole: "VER", podium: ["X", "X", "X"], q: [], submittedAt: "2025-01-01T00:00:00Z" },
        },
      },
      results: { gp1: { pole: "VER", podium: ["VER", "NOR", "LEC"], qAnswers: [] } },
    };
    const standings = computeGlobalStandings(db, [{ key: "gp1" }], ["alice", "bob"]);
    expect(standings[0].points).toBe(standings[1].points);
    expect(standings[0].name).toBe("bob");
  });

  it("races without results do not affect standings", () => {
    const db = {
      bets: {
        gp1: {
          alice: { pole: "VER", podium: ["VER", "NOR", "LEC"], q: [], submittedAt: "2025-01-01" },
          bob:   { pole: "HAM", podium: ["HAM", "SAI", "ALO"], q: [], submittedAt: "2025-01-01" },
        },
        gp2: {
          alice: { q: ["Sí", "No", "3"], submittedAt: "2025-01-02" },
        },
      },
      results: { gp1: { pole: "VER", podium: ["VER", "NOR", "LEC"], qAnswers: [] } },
    };
    const standings = computeGlobalStandings(db, [{ key: "gp1" }, { key: "gp2" }], ["alice", "bob"]);
    const aliceWith = standings.find(s => s.name === "alice");
    const bobWith = standings.find(s => s.name === "bob");
    const dbNoGp2 = { ...db, bets: { gp1: db.bets.gp1 } };
    const standingsWithout = computeGlobalStandings(dbNoGp2, [{ key: "gp1" }], ["alice", "bob"]);
    const aliceWithout = standingsWithout.find(s => s.name === "alice");
    const bobWithout = standingsWithout.find(s => s.name === "bob");
    expect(aliceWith.points).toBe(aliceWithout.points);
    expect(bobWith.points).toBe(bobWithout.points);
  });

  it("empty results object does not count as completed race", () => {
    const db = {
      bets: {
        gp1: { alice: { pole: "VER", podium: ["VER", "NOR", "LEC"], q: [], submittedAt: "2025-01-01" } },
        gp2: { alice: { pole: "HAM", podium: ["HAM", "SAI", "ALO"], q: [], submittedAt: "2025-01-02" } },
      },
      results: {
        gp1: { pole: "VER", podium: ["VER", "NOR", "LEC"], qAnswers: [] },
        gp2: { pole: "", podium: ["", "", ""], qAnswers: ["", "", ""] },
      },
    };
    const standings = computeGlobalStandings(db, [{ key: "gp1" }, { key: "gp2" }], ["alice"]);
    const dbWithoutGp2 = {
      bets: { gp1: db.bets.gp1 },
      results: { gp1: db.results.gp1 },
    };
    const standingsWithout = computeGlobalStandings(dbWithoutGp2, [{ key: "gp1" }], ["alice"]);
    expect(standings[0].points).toBe(standingsWithout[0].points);
  });

  it("accumulates points across multiple races", () => {
    const db = {
      bets: {
        gp1: { alice: { pole: "VER", podium: ["VER", "NOR", "LEC"], q: ["A"], submittedAt: "2025-01-01" } },
        gp2: { alice: { pole: "HAM", podium: ["HAM", "SAI", "ALO"], q: ["X"], submittedAt: "2025-01-02" } },
      },
      results: {
        gp1: { pole: "VER", podium: ["VER", "NOR", "LEC"], qAnswers: ["A"] },
        gp2: { pole: "HAM", podium: ["HAM", "SAI", "ALO"], qAnswers: ["X"] },
      },
    };
    const standings = computeGlobalStandings(db, [{ key: "gp1" }, { key: "gp2" }], ["alice"]);
    // Each race: 1 pole + 3 pod + 1 q + 2 bonus(pole+pod) + 2 bonus(pleno) = 9 * 2 = 18
    expect(standings[0].points).toBe(18);
  });
});

// ─── describeBetAgainstResult ───

describe("describeBetAgainstResult", () => {
  it("no bet → -3 if results exist", () => {
    const r = describeBetAgainstResult(null, { pole: "VER", podium: ["VER", "NOR", "LEC"] });
    expect(r.points).toBe(-3);
    expect(r.items).toHaveLength(1);
  });

  it("no bet, no result → 0", () => {
    const r = describeBetAgainstResult(null, null);
    expect(r.points).toBe(0);
  });

  it("full house breakdown has bonus items", () => {
    const bet = { pole: "VER", podium: ["VER", "NOR", "LEC"], q: ["A", "B", "C"] };
    const res = { pole: "VER", podium: ["VER", "NOR", "LEC"], qAnswers: ["A", "B", "C"] };
    const r = describeBetAgainstResult(bet, res);
    expect(r.points).toBe(11);
    const bonusItems = r.items.filter(i => i.label.includes("Bonus"));
    expect(bonusItems.length).toBe(2);
  });

  it("manual adjustment appears in breakdown", () => {
    const bet = { pole: "X", podium: ["X", "X", "X"], q: [] };
    const res = { pole: "VER", podium: ["VER", "NOR", "LEC"] };
    const r = describeBetAgainstResult(bet, res, 3);
    const adjItem = r.items.find(i => i.label.includes("Ajuste manual"));
    expect(adjItem).toBeDefined();
    expect(adjItem.delta).toBe(3);
  });

  it("late bet shows penalty in breakdown", () => {
    const bet = { pole: "VER", podium: ["VER", "NOR", "LEC"], q: [], late: true };
    const res = { pole: "VER", podium: ["VER", "NOR", "LEC"] };
    const r = describeBetAgainstResult(bet, res);
    const lateItem = r.items.find(i => i.label.includes("fuera de plazo"));
    expect(lateItem).toBeDefined();
    expect(lateItem.delta).toBe(-2);
  });
});

// ─── topList ───

describe("topList", () => {
  it("sorts by value descending", () => {
    const result = topList({ a: 3, b: 5, c: 1 }, 3);
    expect(result[0].name).toBe("b");
    expect(result[0].value).toBe(5);
  });

  it("respects limit", () => {
    const result = topList({ a: 1, b: 2, c: 3, d: 4 }, 2);
    expect(result).toHaveLength(2);
  });

  it("handles empty/null input", () => {
    expect(topList(null)).toEqual([]);
    expect(topList({})).toEqual([]);
  });

  it("alphabetic tiebreaker for same value", () => {
    const result = topList({ b: 5, a: 5 });
    expect(result[0].name).toBe("a");
    expect(result[1].name).toBe("b");
  });
});

// ─── buildStats ───

describe("buildStats", () => {
  const db = {
    bets: {
      gp1: {
        alice: { pole: "VER", podium: ["VER", "NOR", "LEC"], q: ["A", "B", "C"], submittedAt: "2025-01-01" },
        bob:   { pole: "HAM", podium: ["HAM", "SAI", "ALO"], q: ["X", "X", "X"], submittedAt: "2025-01-01" },
      },
    },
    results: { gp1: { pole: "VER", podium: ["VER", "NOR", "LEC"], qAnswers: ["A", "B", "C"] } },
  };
  const races = [{ key: "gp1", grand_prix: "GP Test" }];

  it("identifies race winners", () => {
    const stats = buildStats(db, races, ["alice", "bob"]);
    expect(stats.winners[0].name).toBe("alice");
  });

  it("identifies full house achievers", () => {
    const stats = buildStats(db, races, ["alice", "bob"]);
    expect(stats.fulls[0].name).toBe("alice");
  });

  it("tracks hits leaders", () => {
    const stats = buildStats(db, races, ["alice", "bob"]);
    expect(stats.hitsLeaders[0].name).toBe("alice");
    expect(stats.hitsLeaders[0].value).toBe(7);
  });

  it("tracks vote distributions", () => {
    const stats = buildStats(db, races, ["alice", "bob"]);
    expect(stats.votePole.length).toBeGreaterThan(0);
  });

  it("skips races without results for scoring stats", () => {
    const dbNoRes = { ...db, results: {} };
    const stats = buildStats(dbNoRes, races, ["alice", "bob"]);
    expect(stats.winners).toEqual([]);
    expect(stats.votePole.length).toBeGreaterThan(0);
  });
});
