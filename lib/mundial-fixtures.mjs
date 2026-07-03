/**
 * Calendario Mundial FIFA 2026 — jornadas precargadas (hora local estadio + kickoff UTC).
 * Partidos estrella de grupos editables en admin; eliminatorias con TBD.
 */

export const MUNDIAL_FIXTURES_VERSION = 2;

/** Favoritos que deben aparecer en el partido estrella de su grupo (España tiene partido propio). */
export const MUNDIAL_FAVORITE_TEAMS = [
  "Brasil",
  "Argentina",
  "España",
  "Alemania",
  "Portugal",
  "Francia",
  "Países Bajos",
];

/** Grupo → favorito obligatorio en el partido estrella (grupo H = España, partido dedicado). */
export const MUNDIAL_FAVORITE_BY_GROUP = {
  C: "Brasil",
  E: "Alemania",
  F: "Países Bajos",
  H: "España",
  I: "Francia",
  J: "Argentina",
  K: "Portugal",
};

const P = {
  "America/New_York": 4,
  "America/Chicago": 5,
  "America/Los_Angeles": 7,
  "America/Mexico_City": 6,
  "America/Monterrey": 6,
  "America/Toronto": 4,
  "America/Vancouver": 7,
};

const VENUE_TZ = {
  "Estadio Azteca": "America/Mexico_City",
  "Estadio Akron": "America/Mexico_City",
  "BMO Field": "America/Toronto",
  "SoFi Stadium": "America/Los_Angeles",
  "Gillette Stadium": "America/New_York",
  "BC Place": "America/Vancouver",
  "MetLife Stadium": "America/New_York",
  "Levi's Stadium": "America/Los_Angeles",
  "Lincoln Financial Field": "America/New_York",
  "NRG Stadium": "America/Chicago",
  "AT&T Stadium": "America/Chicago",
  "Estadio BBVA": "America/Monterrey",
  "Hard Rock Stadium": "America/New_York",
  "Mercedes-Benz Stadium": "America/New_York",
  "Lumen Field": "America/Los_Angeles",
  "Arrowhead Stadium": "America/Chicago",
};

function kickoffUtc(date, timeLocal, tz) {
  const [y, m, d] = date.split("-").map(Number);
  const [h, mi] = timeLocal.split(":").map((n) => parseInt(n, 10));
  return new Date(Date.UTC(y, m - 1, d, h + (P[tz] || 5), mi || 0)).toISOString();
}

function match(id, date, timeLocal, venue, city, home, away, opts = {}) {
  const timezone = VENUE_TZ[venue] || "America/New_York";
  return { matchId: id, home, away, kickoff: kickoffUtc(date, timeLocal, timezone), venue, city, timezone, ...opts };
}

function tbdMatch(id, date, timeLocal, venue, city, homeLabel, awayLabel) {
  return match(id, date, timeLocal, venue, city, "TBD", "TBD", { knockout: true, homeLabel, awayLabel });
}

function buildJornadas() {
  const list = [];
  list.push({
    id: "wc-md1",
    name: "Mundial · Fase grupos J1",
    phase: "groups",
    matches: [
      match(14, "2026-06-15", "12:00", "Mercedes-Benz Stadium", "Atlanta", "España", "Cabo Verde", { featured: "es" }),
      match(1, "2026-06-11", "13:00", "Estadio Azteca", "Ciudad de México", "México", "Sudáfrica", { featured: "A" }),
      match(3, "2026-06-12", "15:00", "BC Place", "Vancouver", "Canadá", "Suiza", { featured: "B" }),
      match(4, "2026-06-12", "18:00", "SoFi Stadium", "Los Ángeles", "Estados Unidos", "Paraguay", { featured: "D" }),
      match(7, "2026-06-13", "18:00", "MetLife Stadium", "Nueva York/NJ", "Brasil", "Marruecos", { featured: "C" }),
      match(10, "2026-06-14", "12:00", "NRG Stadium", "Houston", "Alemania", "Curazao", { featured: "E" }),
      match(11, "2026-06-14", "15:00", "AT&T Stadium", "Dallas", "Países Bajos", "Japón", { featured: "F" }),
      match(16, "2026-06-15", "12:00", "Lumen Field", "Seattle", "Bélgica", "Egipto", { featured: "G" }),
      match(17, "2026-06-16", "15:00", "MetLife Stadium", "Nueva York/NJ", "Francia", "Senegal", { featured: "I" }),
      match(19, "2026-06-16", "20:00", "Arrowhead Stadium", "Kansas City", "Argentina", "Argelia", { featured: "J" }),
      match(23, "2026-06-17", "12:00", "NRG Stadium", "Houston", "Portugal", "Rep. Dem. del Congo", { featured: "K" }),
      match(22, "2026-06-17", "15:00", "AT&T Stadium", "Dallas", "Inglaterra", "Croacia", { featured: "L" }),
    ],
  });
  list.push({
    id: "wc-md2",
    name: "Mundial · Fase grupos J2",
    phase: "groups",
    matches: [
      match(38, "2026-06-21", "12:00", "Mercedes-Benz Stadium", "Atlanta", "España", "Arabia Saudita", { featured: "es" }),
      match(28, "2026-06-18", "19:00", "Estadio Akron", "Guadalajara", "México", "Corea del Sur", { featured: "A" }),
      match(26, "2026-06-18", "12:00", "SoFi Stadium", "Los Ángeles", "Suiza", "Bosnia y Herzegovina", { featured: "B" }),
      match(29, "2026-06-19", "21:00", "Lincoln Financial Field", "Filadelfia", "Brasil", "Haití", { featured: "C" }),
      match(32, "2026-06-19", "12:00", "Lumen Field", "Seattle", "Estados Unidos", "Australia", { featured: "D" }),
      match(33, "2026-06-20", "16:00", "BMO Field", "Toronto", "Alemania", "Costa de Marfil", { featured: "E" }),
      match(35, "2026-06-20", "12:00", "NRG Stadium", "Houston", "Países Bajos", "Suecia", { featured: "F" }),
      match(39, "2026-06-21", "12:00", "SoFi Stadium", "Los Ángeles", "Bélgica", "Irán", { featured: "G" }),
      match(42, "2026-06-22", "17:00", "Lincoln Financial Field", "Filadelfia", "Francia", "Irak", { featured: "I" }),
      match(43, "2026-06-22", "12:00", "AT&T Stadium", "Dallas", "Argentina", "Austria", { featured: "J" }),
      match(47, "2026-06-23", "12:00", "NRG Stadium", "Houston", "Portugal", "Uzbekistán", { featured: "K" }),
      match(45, "2026-06-23", "16:00", "Gillette Stadium", "Boston", "Inglaterra", "Ghana", { featured: "L" }),
    ],
  });
  list.push({
    id: "wc-md3",
    name: "Mundial · Fase grupos J3",
    phase: "groups",
    matches: [
      match(66, "2026-06-26", "18:00", "Estadio Akron", "Guadalajara", "Uruguay", "España", { featured: "es" }),
      match(53, "2026-06-24", "19:00", "Estadio Azteca", "Ciudad de México", "Chequia", "México", { featured: "A" }),
      match(51, "2026-06-24", "12:00", "BC Place", "Vancouver", "Suiza", "Canadá", { featured: "B" }),
      match(49, "2026-06-24", "18:00", "Hard Rock Stadium", "Miami", "Escocia", "Brasil", { featured: "C" }),
      match(59, "2026-06-25", "19:00", "SoFi Stadium", "Los Ángeles", "Turquía", "Estados Unidos", { featured: "D" }),
      match(56, "2026-06-25", "16:00", "MetLife Stadium", "Nueva York/NJ", "Ecuador", "Alemania", { featured: "E" }),
      match(57, "2026-06-25", "18:00", "AT&T Stadium", "Dallas", "Países Bajos", "Suecia", { featured: "F" }),
      match(63, "2026-06-26", "20:00", "Lumen Field", "Seattle", "Egipto", "Irán", { featured: "G" }),
      match(61, "2026-06-26", "15:00", "Gillette Stadium", "Boston", "Noruega", "Francia", { featured: "I" }),
      match(70, "2026-06-27", "21:00", "AT&T Stadium", "Dallas", "Jordania", "Argentina", { featured: "J" }),
      match(71, "2026-06-27", "19:30", "Hard Rock Stadium", "Miami", "Colombia", "Portugal", { featured: "K" }),
      match(67, "2026-06-27", "17:00", "MetLife Stadium", "Nueva York/NJ", "Panamá", "Inglaterra", { featured: "L" }),
    ],
  });

  const r32raw = [
    [73, "2026-06-28", "12:00", "SoFi Stadium", "Los Ángeles", "2º Grupo A", "2º Grupo B"],
    [74, "2026-06-29", "16:30", "Gillette Stadium", "Boston", "1º Grupo E", "3º (A/B/C/D/F)"],
    [75, "2026-06-29", "19:00", "Estadio BBVA", "Monterrey", "1º Grupo F", "2º Grupo C"],
    [76, "2026-06-29", "12:00", "NRG Stadium", "Houston", "1º Grupo C", "2º Grupo F"],
    [77, "2026-06-30", "17:00", "MetLife Stadium", "Nueva York/NJ", "1º Grupo I", "3º (C/D/F/G/H)"],
    [78, "2026-06-30", "12:00", "AT&T Stadium", "Dallas", "2º Grupo E", "2º Grupo I"],
    [79, "2026-06-30", "19:00", "Estadio Azteca", "Ciudad de México", "1º Grupo A", "3º (C/E/F/H/I)"],
    [80, "2026-07-01", "12:00", "Mercedes-Benz Stadium", "Atlanta", "1º Grupo L", "3º (E/H/I/J/K)"],
    [81, "2026-07-01", "17:00", "Levi's Stadium", "San Francisco", "1º Grupo D", "3º (B/E/F/I/J)"],
    [82, "2026-07-01", "13:00", "Lumen Field", "Seattle", "1º Grupo G", "3º (A/E/H/I/J)"],
    [83, "2026-07-02", "19:00", "BMO Field", "Toronto", "2º Grupo K", "2º Grupo L"],
    [84, "2026-07-02", "12:00", "SoFi Stadium", "Los Ángeles", "1º Grupo H", "2º Grupo J"],
    [85, "2026-07-02", "20:00", "BC Place", "Vancouver", "1º Grupo B", "3º (E/F/G/I/J)"],
    [86, "2026-07-03", "18:00", "Hard Rock Stadium", "Miami", "1º Grupo J", "2º Grupo H"],
    [87, "2026-07-03", "20:30", "Arrowhead Stadium", "Kansas City", "1º Grupo K", "3º (D/E/I/J/L)"],
    [88, "2026-07-03", "13:00", "AT&T Stadium", "Dallas", "2º Grupo D", "2º Grupo G"],
  ];
  list.push({
    id: "wc-r32",
    name: "Mundial · Dieciseisavos",
    phase: "r32",
    matches: r32raw.map(([id, d, t, v, c, hl, al]) => tbdMatch(id, d, t, v, c, hl, al)),
  });

  const r16raw = [
    [89, "2026-07-04", "17:00", "Lincoln Financial Field", "Filadelfia", "Ganador P74", "Ganador P77"],
    [90, "2026-07-04", "12:00", "NRG Stadium", "Houston", "Ganador P73", "Ganador P75"],
    [91, "2026-07-05", "16:00", "MetLife Stadium", "Nueva York/NJ", "Ganador P76", "Ganador P78"],
    [92, "2026-07-05", "18:00", "Estadio Azteca", "Ciudad de México", "Ganador P79", "Ganador P80"],
    [93, "2026-07-06", "14:00", "AT&T Stadium", "Dallas", "Ganador P83", "Ganador P84"],
    [94, "2026-07-06", "17:00", "Lumen Field", "Seattle", "Ganador P81", "Ganador P82"],
    [95, "2026-07-07", "12:00", "Mercedes-Benz Stadium", "Atlanta", "Ganador P86", "Ganador P88"],
    [96, "2026-07-07", "13:00", "BC Place", "Vancouver", "Ganador P85", "Ganador P87"],
  ];
  list.push({
    id: "wc-r16",
    name: "Mundial · Octavos",
    phase: "r16",
    matches: r16raw.map(([id, d, t, v, c, hl, al]) => tbdMatch(id, d, t, v, c, hl, al)),
  });

  list.push({
    id: "wc-champion",
    name: "Mundial · ¿Quién ganará?",
    phase: "champion",
    deadline: "2026-07-04T16:59:00.000Z",
    matches: [],
  });

  const qfraw = [
    [97, "2026-07-09", "16:00", "Gillette Stadium", "Boston", "Ganador P89", "Ganador P90"],
    [98, "2026-07-10", "12:00", "SoFi Stadium", "Los Ángeles", "Ganador P93", "Ganador P94"],
    [99, "2026-07-11", "17:00", "Hard Rock Stadium", "Miami", "Ganador P91", "Ganador P92"],
    [100, "2026-07-11", "20:00", "Arrowhead Stadium", "Kansas City", "Ganador P95", "Ganador P96"],
  ];
  list.push({
    id: "wc-qf",
    name: "Mundial · Cuartos",
    phase: "qf",
    matches: qfraw.map(([id, d, t, v, c, hl, al]) => tbdMatch(id, d, t, v, c, hl, al)),
  });

  list.push({
    id: "wc-sf",
    name: "Mundial · Semifinal",
    phase: "sf",
    matches: [
      tbdMatch(101, "2026-07-14", "14:00", "AT&T Stadium", "Dallas", "Ganador P97", "Ganador P98"),
      tbdMatch(102, "2026-07-15", "15:00", "Mercedes-Benz Stadium", "Atlanta", "Ganador P99", "Ganador P100"),
    ],
  });
  list.push({
    id: "wc-3p",
    name: "Mundial · Tercer puesto",
    phase: "third",
    matches: [tbdMatch(103, "2026-07-18", "17:00", "Hard Rock Stadium", "Miami", "Perdedor SF1", "Perdedor SF2")],
  });
  list.push({
    id: "wc-final",
    name: "Mundial · Final",
    phase: "final",
    matches: [tbdMatch(104, "2026-07-19", "15:00", "MetLife Stadium", "Nueva York/NJ", "Ganador SF1", "Ganador SF2")],
  });
  return list;
}

const JORNADAS = buildJornadas();

export const MUNDIAL_JORNADA_ORDER = JORNADAS.map((j) => j.id);

export function buildMundialSeedState() {
  const jornadas = {};
  for (const j of JORNADAS) {
    const { matches, ...meta } = j;
    jornadas[j.id] = { ...meta, id: j.id, matches };
  }
  return {
    order: [...MUNDIAL_JORNADA_ORDER],
    jornadas,
    bets: {},
    results: {},
    betsWindow: {},
    betsReveal: {},
    betHistory: {},
  };
}

export function matchDisplayName(m) {
  if (!m) return { home: "—", away: "—" };
  const home = m.home === "TBD" ? (m.homeLabel || "TBD") : m.home;
  const away = m.away === "TBD" ? (m.awayLabel || "TBD") : m.away;
  return { home, away };
}

function matchHasTeam(m, team) {
  return m.home === team || m.away === team;
}

/** Comprueba que cada jornada de grupos incluye España y el favorito de cada grupo con estrella. */
export function validateMundialFavoriteStars(jornadas = JORNADAS) {
  const issues = [];
  for (const j of jornadas) {
    if (j.phase !== "groups") continue;
    const featured = (j.matches || []).filter((m) => m.featured);
    const esMatch = featured.find((m) => m.featured === "es");
    if (!esMatch || !matchHasTeam(esMatch, "España")) {
      issues.push(`${j.id}: falta partido de España`);
    }
    for (const [group, favorite] of Object.entries(MUNDIAL_FAVORITE_BY_GROUP)) {
      if (group === "H") continue;
      const star = featured.find((m) => m.featured === group);
      if (!star) {
        issues.push(`${j.id}: falta estrella grupo ${group}`);
        continue;
      }
      if (!matchHasTeam(star, favorite)) {
        issues.push(`${j.id} grupo ${group}: estrella sin ${favorite} (${star.home} vs ${star.away})`);
      }
    }
  }
  return issues;
}
