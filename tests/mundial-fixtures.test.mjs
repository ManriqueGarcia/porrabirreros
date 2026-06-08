import { describe, it, expect } from "vitest";
import {
  buildMundialSeedState,
  MUNDIAL_FAVORITE_TEAMS,
  validateMundialFavoriteStars,
} from "../lib/mundial-fixtures.mjs";

describe("mundial fixtures — favoritos en estrellas", () => {
  it("cada jornada de grupos incluye España y favoritos por grupo", () => {
    const issues = validateMundialFavoriteStars();
    expect(issues).toEqual([]);
  });

  it("MD1–MD3 tienen 12 partidos (España + estrella A–L)", () => {
    const seed = buildMundialSeedState();
    for (const id of ["wc-md1", "wc-md2", "wc-md3"]) {
      expect(seed.jornadas[id].matches).toHaveLength(12);
    }
  });

  it("los siete favoritos aparecen en el calendario de grupos", () => {
    const seed = buildMundialSeedState();
    const teams = new Set();
    for (const id of ["wc-md1", "wc-md2", "wc-md3"]) {
      for (const m of seed.jornadas[id].matches) {
        if (m.home !== "TBD") teams.add(m.home);
        if (m.away !== "TBD") teams.add(m.away);
      }
    }
    for (const fav of MUNDIAL_FAVORITE_TEAMS) {
      expect(teams.has(fav), `falta ${fav} en fase de grupos`).toBe(true);
    }
  });
});
