import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  normalizeTeamToken,
  teamNamesMatch,
  findKickoffForPair,
  mergeKickoffsFromApiMatches,
  enrichFutbolJornadaMatchesFromApi,
  fetchCompetitionMatches,
} from "../lib/laliga-fixtures.mjs";

describe("normalizeTeamToken / teamNamesMatch", () => {
  it("normalizes accents and fc suffix", () => {
    expect(normalizeTeamToken("Atlético de Madrid")).toContain("atletico");
    expect(teamNamesMatch("Real Madrid CF", "Real Madrid")).toBe(true);
  });
});

describe("findKickoffForPair", () => {
  const api = [
    {
      utcDate: "2026-05-10T16:00:00Z",
      homeTeam: { shortName: "Real Madrid", name: "Real Madrid CF" },
      awayTeam: { shortName: "Barça", name: "FC Barcelona" },
    },
    {
      utcDate: "2026-05-10T14:00:00Z",
      homeTeam: { shortName: "Athletic", name: "Athletic Club" },
      awayTeam: { shortName: "Almería", name: "UD Almería" },
    },
  ];

  it("matches home/away and returns earliest kickoff", () => {
    expect(findKickoffForPair("Real Madrid", "FC Barcelona", api)).toBe("2026-05-10T16:00:00.000Z");
  });

  it("returns null when no pair", () => {
    expect(findKickoffForPair("Celta", "Osasuna", api)).toBe(null);
  });
});

describe("mergeKickoffsFromApiMatches", () => {
  it("preserves existing kickoff and fills missing", () => {
    const api = [{
      utcDate: "2026-05-11T12:00:00Z",
      homeTeam: { name: "Sevilla FC" },
      awayTeam: { name: "Valencia CF" },
    }];
    const { matches, filled } = mergeKickoffsFromApiMatches(
      [
        { home: "Sevilla", away: "Valencia", kickoff: "2026-05-11T10:00:00.000Z" },
        { home: "Sevilla FC", away: "Valencia CF" },
      ],
      api,
    );
    expect(matches[0].kickoff).toBe("2026-05-11T10:00:00.000Z");
    expect(matches[1].kickoff).toBe("2026-05-11T12:00:00.000Z");
    expect(filled).toBe(1);
  });
});

describe("enrichFutbolJornadaMatchesFromApi", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("skips fetch when all matches have kickoff", async () => {
    const { data, meta } = await enrichFutbolJornadaMatchesFromApi(
      { id: "J1", matches: [{ home: "A", away: "B", kickoff: "2026-01-01T00:00:00Z" }] },
      { token: "x" },
    );
    expect(meta.reason).toBe("all_have_kickoff");
    expect(data.matches[0].kickoff).toBeDefined();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("skips when no token", async () => {
    const { meta } = await enrichFutbolJornadaMatchesFromApi(
      { matches: [{ home: "A", away: "B" }] },
      { token: "" },
    );
    expect(meta.reason).toBe("no_token");
  });

  it("fills from API response", async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({
        matches: [{
          utcDate: "2026-06-01T17:00:00Z",
          homeTeam: { name: "Girona FC" },
          awayTeam: { name: "Villarreal CF" },
        }],
      }),
    });
    const { data, meta } = await enrichFutbolJornadaMatchesFromApi(
      { id: "J2", matches: [{ home: "Girona", away: "Villarreal" }] },
      { token: "secret" },
    );
    expect(meta.filled).toBe(1);
    expect(data.matches[0].kickoff).toBe("2026-06-01T17:00:00.000Z");
  });
});

describe("fetchCompetitionMatches", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("uses matchday query when provided", async () => {
    global.fetch.mockResolvedValue({ ok: true, text: async () => '{"matches":[]}' });
    await fetchCompetitionMatches("tok", "PD", 34, 21);
    expect(fetch).toHaveBeenCalled();
    const url = fetch.mock.calls[0][0];
    expect(url).toContain("matchday=34");
    expect(fetch.mock.calls[0][1].headers["X-Auth-Token"]).toBe("tok");
  });
});
