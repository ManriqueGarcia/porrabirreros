/**
 * Lista fija de GP cancelados (mismo criterio que assets/calendar_*.json y lib/f1-cancelled-races.mjs).
 * Archivo separado para que el alias de build `config.js` → `config.local.js` no pueda borrar estos datos.
 */
export const CANCELLED_F1_RACE_KEYS = new Set(["bahrain", "saudi_arabia"]);

export function isKnownCancelledF1Key(raceKey) {
  return typeof raceKey === "string" && CANCELLED_F1_RACE_KEYS.has(raceKey);
}
