import { describe, it, expect } from "vitest";
import {
  futbolSign, futbolMatchPoints, scoreFutbolJornada,
  computeFutbolStandings, computeFutbolJornadaWins,
  listFutbolJornadas, defaultFutbolState,
  computeDeadlineFromKickoffs, getEffectiveDeadline,
} from "../lib/scoring.mjs";

// ─── futbolSign ───

describe("futbolSign", () => {
  it("home win → '1'", () => expect(futbolSign({ home: 2, away: 1 })).toBe("1"));
  it("away win → '2'", () => expect(futbolSign({ home: 0, away: 3 })).toBe("2"));
  it("draw → 'X'", () => expect(futbolSign({ home: 1, away: 1 })).toBe("X"));
  it("0-0 draw → 'X'", () => expect(futbolSign({ home: 0, away: 0 })).toBe("X"));
  it("null → null", () => expect(futbolSign(null)).toBeNull());
  it("missing home → null", () => expect(futbolSign({ away: 1 })).toBeNull());
  it("missing away → null", () => expect(futbolSign({ home: 1 })).toBeNull());
  it("NaN values → null", () => expect(futbolSign({ home: NaN, away: 1 })).toBeNull());
});

// ─── futbolMatchPoints ───

describe("futbolMatchPoints", () => {
  it("exact match → 3 pts", () => {
    const r = futbolMatchPoints({ home: 2, away: 1 }, { home: 2, away: 1 });
    expect(r.points).toBe(3);
    expect(r.exact).toBe(true);
    expect(r.sign).toBe(true);
  });

  it("correct sign → 1 pt", () => {
    const r = futbolMatchPoints({ home: 3, away: 0 }, { home: 1, away: 0 });
    expect(r.points).toBe(1);
    expect(r.exact).toBe(false);
    expect(r.sign).toBe(true);
  });

  it("wrong prediction → 0 pts", () => {
    const r = futbolMatchPoints({ home: 2, away: 0 }, { home: 0, away: 1 });
    expect(r.points).toBe(0);
    expect(r.exact).toBe(false);
    expect(r.sign).toBe(false);
  });

  it("draw exact 0-0 → 3 pts", () => {
    const r = futbolMatchPoints({ home: 0, away: 0 }, { home: 0, away: 0 });
    expect(r.points).toBe(3);
    expect(r.exact).toBe(true);
  });

  it("draw sign match (different score) → 1 pt", () => {
    const r = futbolMatchPoints({ home: 1, away: 1 }, { home: 2, away: 2 });
    expect(r.points).toBe(1);
    expect(r.sign).toBe(true);
  });

  it("null prediction → 0 pts", () => {
    expect(futbolMatchPoints(null, { home: 1, away: 0 }).points).toBe(0);
  });

  it("null result → 0 pts", () => {
    expect(futbolMatchPoints({ home: 1, away: 0 }, null).points).toBe(0);
  });

  it("string numbers still compare correctly", () => {
    const r = futbolMatchPoints({ home: "2", away: "1" }, { home: 2, away: 1 });
    expect(r.points).toBe(3);
    expect(r.exact).toBe(true);
  });
});

// ─── scoreFutbolJornada ───

describe("scoreFutbolJornada", () => {
  const mkDb = (bet, result, jornadaConfig) => ({
    futbol: {
      jornadas: jornadaConfig ? { j1: jornadaConfig } : {},
      bets: bet ? { j1: { user1: bet } } : {},
      results: result ? { j1: result } : {},
    },
  });

  it("pending (no results) → 0 pts, pending=true", () => {
    const s = scoreFutbolJornada(mkDb({ matches: [] }, null), "j1", "user1");
    expect(s.pending).toBe(true);
    expect(s.points).toBe(0);
  });

  it("all exact matches → 3 pts each", () => {
    const db = mkDb(
      { matches: [{ home: 2, away: 1 }, { home: 0, away: 0 }] },
      { matches: [{ home: 2, away: 1 }, { home: 0, away: 0 }] },
    );
    const s = scoreFutbolJornada(db, "j1", "user1");
    expect(s.points).toBe(6);
    expect(s.exact).toBe(2);
    expect(s.signs).toBe(2);
    expect(s.goalDiff).toBe(0);
  });

  it("all sign matches (not exact) → 1 pt each", () => {
    const db = mkDb(
      { matches: [{ home: 3, away: 0 }, { home: 1, away: 1 }] },
      { matches: [{ home: 1, away: 0 }, { home: 2, away: 2 }] },
    );
    const s = scoreFutbolJornada(db, "j1", "user1");
    expect(s.points).toBe(2);
    expect(s.exact).toBe(0);
    expect(s.signs).toBe(2);
  });

  it("no bet → -3 missing penalty", () => {
    const db = mkDb(null, { matches: [{ home: 1, away: 0 }] });
    const s = scoreFutbolJornada(db, "j1", "user1");
    expect(s.points).toBe(-3);
    expect(s.missed).toBe(true);
    expect(s.missingPenalty).toBe(-3);
    // goalDiff = 10 (per unmatched match) + 40 (missing penalty) = 50
    expect(s.goalDiff).toBe(50);
  });

  it("late bet → -2 penalty", () => {
    const db = mkDb(
      { matches: [{ home: 2, away: 1 }], late: true },
      { matches: [{ home: 2, away: 1 }] },
    );
    const s = scoreFutbolJornada(db, "j1", "user1");
    expect(s.late).toBe(true);
    expect(s.latePenalty).toBe(-2);
    expect(s.points).toBe(1);
  });

  it("catastrophic (all wrong, on time) → -1 penalty", () => {
    const db = mkDb(
      { matches: [{ home: 2, away: 0 }, { home: 0, away: 3 }] },
      { matches: [{ home: 0, away: 1 }, { home: 2, away: 0 }] },
    );
    const s = scoreFutbolJornada(db, "j1", "user1");
    expect(s.points).toBe(-1);
    expect(s.catPenalty).toBe(-1);
  });

  it("catastrophic does NOT apply if late", () => {
    const db = mkDb(
      { matches: [{ home: 2, away: 0 }], late: true },
      { matches: [{ home: 0, away: 1 }] },
    );
    const s = scoreFutbolJornada(db, "j1", "user1");
    expect(s.catPenalty).toBe(0);
    expect(s.latePenalty).toBe(-2);
    expect(s.points).toBe(-2);
  });

  it("catastrophic does NOT apply if missed", () => {
    const db = mkDb(null, { matches: [{ home: 1, away: 0 }] });
    const s = scoreFutbolJornada(db, "j1", "user1");
    expect(s.catPenalty).toBe(0);
    expect(s.missingPenalty).toBe(-3);
  });

  it("goalDiff calculated correctly", () => {
    const db = mkDb(
      { matches: [{ home: 3, away: 0 }] },
      { matches: [{ home: 1, away: 2 }] },
    );
    const s = scoreFutbolJornada(db, "j1", "user1");
    expect(s.goalDiff).toBe(Math.abs(3 - 1) + Math.abs(0 - 2));
  });

  it("missing predictions add goalDiff=10 per match", () => {
    const db = mkDb(
      { matches: [null, null] },
      { matches: [{ home: 1, away: 0 }, { home: 2, away: 2 }] },
    );
    const s = scoreFutbolJornada(db, "j1", "user1");
    expect(s.goalDiff).toBe(20);
  });

  it("items array describes each match", () => {
    const jornada = { id: "j1", matches: [{ home: "Madrid", away: "Barça" }] };
    const db = mkDb(
      { matches: [{ home: 2, away: 1 }] },
      { matches: [{ home: 2, away: 1 }] },
      jornada,
    );
    const s = scoreFutbolJornada(db, "j1", "user1");
    expect(s.items.length).toBeGreaterThan(0);
    expect(s.items[0].label).toContain("Madrid");
  });

  it("delegated bet scores normally (no late penalty)", () => {
    const db = mkDb(
      { matches: [{ home: 2, away: 1 }], delegated: true },
      { matches: [{ home: 2, away: 1 }] },
    );
    const s = scoreFutbolJornada(db, "j1", "user1");
    expect(s.points).toBe(3);
    expect(s.latePenalty).toBe(0);
  });
});

// ─── computeFutbolJornadaWins ───

describe("computeFutbolJornadaWins", () => {
  it("awards win to sole leader per jornada", () => {
    const dbFutbol = {
      jornadas: { j1: { id: "j1" } },
      bets: {
        j1: {
          alice: { matches: [{ home: 2, away: 1 }] },
          bob:   { matches: [{ home: 0, away: 3 }] },
        },
      },
      results: { j1: { matches: [{ home: 2, away: 1 }] } },
    };
    const wins = computeFutbolJornadaWins(dbFutbol, ["alice", "bob"], [{ id: "j1" }]);
    expect(wins.alice).toBe(1);
    expect(wins.bob).toBe(0);
  });

  it("no win when tied", () => {
    const dbFutbol = {
      jornadas: {},
      bets: {
        j1: {
          alice: { matches: [{ home: 1, away: 0 }] },
          bob:   { matches: [{ home: 2, away: 0 }] },
        },
      },
      results: { j1: { matches: [{ home: 3, away: 0 }] } },
    };
    const wins = computeFutbolJornadaWins(dbFutbol, ["alice", "bob"], [{ id: "j1" }]);
    expect(wins.alice).toBe(0);
    expect(wins.bob).toBe(0);
  });
});

// ─── computeFutbolStandings ───

describe("computeFutbolStandings", () => {
  it("sorts by points descending", () => {
    const dbFutbol = {
      jornadas: {},
      bets: {
        j1: {
          alice: { matches: [{ home: 2, away: 1 }] },
          bob:   { matches: [{ home: 0, away: 3 }] },
        },
      },
      results: { j1: { matches: [{ home: 2, away: 1 }] } },
    };
    const s = computeFutbolStandings(dbFutbol, ["alice", "bob"], [{ id: "j1" }]);
    expect(s[0].name).toBe("alice");
    expect(s[0].points).toBeGreaterThan(s[1].points);
  });

  it("goalDiff as tiebreaker", () => {
    const dbFutbol = {
      jornadas: {},
      bets: {
        j1: {
          alice: { matches: [{ home: 2, away: 0 }] },
          bob:   { matches: [{ home: 5, away: 0 }] },
        },
      },
      results: { j1: { matches: [{ home: 3, away: 0 }] } },
    };
    const s = computeFutbolStandings(dbFutbol, ["alice", "bob"], [{ id: "j1" }]);
    expect(s[0].points).toBe(s[1].points);
    // alice: |2-3|+|0-0|=1, bob: |5-3|+|0-0|=2 → alice wins tiebreak
    expect(s[0].name).toBe("alice");
    expect(s[0].goalDiff).toBeLessThan(s[1].goalDiff);
  });

  it("accumulates across multiple jornadas", () => {
    const dbFutbol = {
      jornadas: {},
      bets: {
        j1: { alice: { matches: [{ home: 2, away: 1 }] } },
        j2: { alice: { matches: [{ home: 0, away: 0 }] } },
      },
      results: {
        j1: { matches: [{ home: 2, away: 1 }] },
        j2: { matches: [{ home: 0, away: 0 }] },
      },
    };
    const s = computeFutbolStandings(dbFutbol, ["alice"], [{ id: "j1" }, { id: "j2" }]);
    expect(s[0].points).toBe(6);
    expect(s[0].exact).toBe(2);
  });

  it("penCount tracks missed + late", () => {
    const dbFutbol = {
      jornadas: {},
      bets: { j1: {}, j2: { alice: { matches: [{ home: 1, away: 0 }], late: true } } },
      results: {
        j1: { matches: [{ home: 1, away: 0 }] },
        j2: { matches: [{ home: 1, away: 0 }] },
      },
    };
    const s = computeFutbolStandings(dbFutbol, ["alice"], [{ id: "j1" }, { id: "j2" }]);
    expect(s[0].missed).toBe(1);
    expect(s[0].late).toBe(1);
    expect(s[0].penCount).toBe(2);
  });
});

// ─── listFutbolJornadas ───

describe("listFutbolJornadas", () => {
  it("returns jornadas in custom order if provided", () => {
    const futbol = {
      order: ["j2", "j1"],
      jornadas: {
        j1: { id: "j1", name: "Jornada 1" },
        j2: { id: "j2", name: "Jornada 2" },
      },
    };
    const list = listFutbolJornadas(futbol);
    expect(list[0].id).toBe("j2");
    expect(list[1].id).toBe("j1");
  });

  it("sorts by deadline when no custom order", () => {
    const futbol = {
      order: [],
      jornadas: {
        j1: { id: "j1", name: "A", deadline: "2025-03-01T15:00:00Z" },
        j2: { id: "j2", name: "B", deadline: "2025-02-01T15:00:00Z" },
      },
    };
    const list = listFutbolJornadas(futbol);
    expect(list[0].id).toBe("j2");
  });

  it("handles empty jornadas", () => {
    expect(listFutbolJornadas({})).toEqual([]);
    expect(listFutbolJornadas(null)).toEqual([]);
  });

  it("filters out missing jornadas from order", () => {
    const futbol = {
      order: ["j1", "j_missing", "j2"],
      jornadas: {
        j1: { id: "j1", name: "Jornada 1" },
        j2: { id: "j2", name: "Jornada 2" },
      },
    };
    const list = listFutbolJornadas(futbol);
    expect(list).toHaveLength(2);
  });
});

// ─── computeDeadlineFromKickoffs ───

describe("computeDeadlineFromKickoffs", () => {
  it("returns null when no matches", () => {
    expect(computeDeadlineFromKickoffs(null)).toBeNull();
    expect(computeDeadlineFromKickoffs({})).toBeNull();
    expect(computeDeadlineFromKickoffs({ matches: [] })).toBeNull();
  });

  it("returns null when no matches have kickoff", () => {
    const j = { matches: [{ home: "A", away: "B" }, { home: "C", away: "D" }] };
    expect(computeDeadlineFromKickoffs(j)).toBeNull();
  });

  it("returns 1 minute before earliest kickoff", () => {
    const j = {
      matches: [
        { home: "A", away: "B", kickoff: "2026-04-25T21:00:00Z" },
        { home: "C", away: "D", kickoff: "2026-04-25T18:30:00Z" },
        { home: "E", away: "F", kickoff: "2026-04-26T16:00:00Z" },
      ],
    };
    const dl = computeDeadlineFromKickoffs(j);
    expect(dl).toBeInstanceOf(Date);
    expect(dl.toISOString()).toBe("2026-04-25T18:29:00.000Z");
  });

  it("ignores matches without kickoff", () => {
    const j = {
      matches: [
        { home: "A", away: "B" },
        { home: "C", away: "D", kickoff: "2026-04-25T20:00:00Z" },
      ],
    };
    const dl = computeDeadlineFromKickoffs(j);
    expect(dl.toISOString()).toBe("2026-04-25T19:59:00.000Z");
  });
});

// ─── getEffectiveDeadline ───

describe("getEffectiveDeadline", () => {
  it("returns explicit deadline when present", () => {
    const j = { deadline: "2026-04-25T21:00:00Z", matches: [{ home: "A", away: "B", kickoff: "2026-04-25T18:00:00Z" }] };
    const dl = getEffectiveDeadline(j);
    expect(dl.toISOString()).toBe("2026-04-25T21:00:00.000Z");
  });

  it("falls back to kickoff-based deadline when no explicit deadline", () => {
    const j = { matches: [{ home: "A", away: "B", kickoff: "2026-04-25T18:00:00Z" }] };
    const dl = getEffectiveDeadline(j);
    expect(dl.toISOString()).toBe("2026-04-25T17:59:00.000Z");
  });

  it("returns null when neither deadline nor kickoffs", () => {
    const j = { matches: [{ home: "A", away: "B" }] };
    expect(getEffectiveDeadline(j)).toBeNull();
  });
});

// ─── defaultFutbolState ───

describe("defaultFutbolState", () => {
  it("returns all required keys", () => {
    const s = defaultFutbolState();
    expect(s).toHaveProperty("order");
    expect(s).toHaveProperty("jornadas");
    expect(s).toHaveProperty("bets");
    expect(s).toHaveProperty("results");
    expect(s).toHaveProperty("betsWindow");
    expect(s).toHaveProperty("betsReveal");
    expect(s).toHaveProperty("betHistory");
  });

  it("returns empty collections", () => {
    const s = defaultFutbolState();
    expect(s.order).toEqual([]);
    expect(Object.keys(s.jornadas)).toHaveLength(0);
  });
});
