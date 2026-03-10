export const CACHE_BUST = "v20260301";

export const CONFIG = {
  participants: ["Jugador1", "Jugador2", "Jugador3", "Jugador4", "Jugador5"],
  timezone: "Europe/Madrid",
  sessionTimeoutMs: 30 * 60 * 1000,
  questionAuthorsOrder: ["Jugador1", "Jugador2", "Jugador3", "Jugador4", "Jugador5"],
  futbolTeams: ["Equipo1", "Equipo2", "Equipo3", "Equipo4"],
  futbolDeadlineHour: "15:00",
};

// echo -n "TuPassword" | sha256sum
export const DEFAULT_PASSWORD_HASH = "0000000000000000000000000000000000000000000000000000000000000000";
export const RECOVERY_CODE_HASH = DEFAULT_PASSWORD_HASH;
export const ADMIN_SECRET_HASH = "0000000000000000000000000000000000000000000000000000000000000000";

export const QUESTION_AUTHORS_ORDER = CONFIG.questionAuthorsOrder;
export const MADRID_TZ = CONFIG.timezone;
export const SESSION_TIMEOUT_MS = CONFIG.sessionTimeoutMs;
export const CURRENT_SEASON_YEAR = 2026;

export const FUTBOL_BASE_TEAMS = CONFIG.futbolTeams;
export const FUTBOL_DEFAULT_DEADLINE_HOUR = CONFIG.futbolDeadlineHour;

export const DRIVER_TEAMS = {
  "Lando Norris": "McLaren", "Oscar Piastri": "McLaren",
  "Lewis Hamilton": "Ferrari", "Charles Leclerc": "Ferrari",
  "Max Verstappen": "Red Bull", "Liam Lawson": "Red Bull",
  "George Russell": "Mercedes", "Kimi Antonelli": "Mercedes",
  "Fernando Alonso": "Aston Martin", "Lance Stroll": "Aston Martin",
  "Pierre Gasly": "Alpine", "Franco Colapinto": "Alpine",
  "Esteban Ocon": "Haas", "Oliver Bearman": "Haas",
  "Isack Hadjar": "Racing Bulls", "Arvid Lindblad": "Racing Bulls",
  "Carlos Sainz": "Williams", "Alexander Albon": "Williams",
  "Nico Hülkenberg": "Audi", "Gabriel Bortoleto": "Audi",
  "Valtteri Bottas": "Cadillac", "Sergio Perez": "Cadillac",
};

export const TEAMS_ORDER_2025 = [
  "McLaren", "Ferrari", "Red Bull", "Mercedes", "Aston Martin",
  "Alpine", "Haas", "Racing Bulls", "Williams", "Audi", "Cadillac",
];

export const PILOT_COLORS = {
  "Jugador1": "#c4544e", "Jugador2": "#5a9abf", "Jugador3": "#5fb8a8",
  "Jugador4": "#c9874a", "Jugador5": "#9078b0",
};

export const FALLBACK_COLORS = [
  "#c4544e", "#5a9abf", "#5fb8a8", "#c9874a", "#9078b0",
  "#b8a84e", "#b86b8a", "#6aad6a", "#5a9eb8", "#8eb85a",
];

export const REAL_HISTORICAL_2025_KEYS = ["las_vegas", "qatar", "abu_dhabi"];
export const REAL_HISTORICAL_2025_ROUNDS = [22, 23, 24];
