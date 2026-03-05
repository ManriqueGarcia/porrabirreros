export const CACHE_BUST = "v20260301";

export const CONFIG = {
  participants: ["Antonio", "Carlos", "Pere", "Toni", "Manrique"],
  timezone: "Europe/Madrid",
  sessionTimeoutMs: 30 * 60 * 1000,
  questionAuthorsOrder: ["Pere", "Antonio", "Manrique", "Toni", "Carlos"],
  futbolTeams: ["Real Madrid", "FC Barcelona", "Real Sociedad", "Real Sporting de Gijón"],
  futbolDeadlineHour: "15:00",
};

export const LS_KEY = "porra_f1_clean_v3";
export const DEFAULT_PASSWORD_HASH = "3c9aed6bcbf0ebf23367e34557722796f040290945a9abc608599bda30c4c0d3";
export const RECOVERY_CODE_HASH = DEFAULT_PASSWORD_HASH;
export const ADMIN_SECRET_HASH = "3c456c5124d0660a8bc1b4a6c1e09f5e72c5de8fd36dd0c4ec4607bc22325652";
export const QUESTION_AUTHORS_ORDER = CONFIG.questionAuthorsOrder;
export const MADRID_TZ = CONFIG.timezone;
export const SESSION_TIMEOUT_MS = CONFIG.sessionTimeoutMs;
export const CURRENT_SEASON_YEAR = 2026;

export const FUTBOL_BASE_TEAMS = ["Real Madrid", "FC Barcelona", "Real Sociedad", "Real Sporting de Gijón"];
export const FUTBOL_DEFAULT_DEADLINE_HOUR = "15:00";

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
  "Antonio": "#c4544e", "Carlos": "#5a9abf", "Pere": "#5fb8a8",
  "Toni": "#c9874a", "Manrique": "#9078b0",
};

export const FALLBACK_COLORS = [
  "#c4544e", "#5a9abf", "#5fb8a8", "#c9874a", "#9078b0",
  "#b8a84e", "#b86b8a", "#6aad6a", "#5a9eb8", "#8eb85a",
];

export const REAL_HISTORICAL_2025_KEYS = ["las_vegas", "qatar", "abu_dhabi"];
export const REAL_HISTORICAL_2025_ROUNDS = [22, 23, 24];
