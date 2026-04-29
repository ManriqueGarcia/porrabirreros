/**
 * Claves de GP marcadas como canceladas en assets/calendar_*.json.
 * La Lambda rechaza escrituras F1 para estas carreras (alineado con scoring/UI).
 */
export const CANCELLED_F1_RACE_KEYS = new Set(["bahrain", "saudi_arabia"]);

export function isCancelledF1RaceKey(raceKey) {
  return typeof raceKey === "string" && CANCELLED_F1_RACE_KEYS.has(raceKey);
}
