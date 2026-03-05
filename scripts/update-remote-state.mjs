#!/usr/bin/env node
/**
 * Actualiza el estado remoto en AWS con los cambios de calendario 2026:
 * - basePoints a 0 para todos
 * - Limpia raceOverrides (el calendario 2026 tiene las fechas correctas)
 * - Mantiene usuarios, participantes, championships, bets/results históricos
 */
const API_BASE = process.env.PORRA_API_BASE || "";
if (!API_BASE) { console.error("Error: define PORRA_API_BASE en .env o como variable de entorno"); process.exit(1); }
const API_SECRET = process.env.PORRA_API_SECRET || "";

async function main() {
  const headers = { Accept: "application/json", "Content-Type": "application/json" };
  if (API_SECRET) headers["x-porra-secret"] = API_SECRET;

  const res = await fetch(`${API_BASE}/state`, { headers });
  if (!res.ok) throw new Error(`GET failed: ${res.status}`);
  const state = await res.json();

  state.meta = state.meta || {};
  state.meta.basePoints = {};
  state.meta.raceOverrides = {};
  state.meta.forceAutoStandings = true;
  if (!state.meta.teams || state.meta.teams.length === 0) state.meta.teams = [];

  const putRes = await fetch(`${API_BASE}/state`, {
    method: "PUT",
    headers,
    body: JSON.stringify(state),
  });
  if (!putRes.ok) throw new Error(`PUT failed: ${putRes.status}`);

  console.log("Estado remoto actualizado correctamente:");
  console.log("  - basePoints: todos a 0");
  console.log("  - raceOverrides: limpiados (usa calendario 2026 del JSON)");
}

main().catch((e) => {
  console.error("Error:", e.message);
  process.exit(1);
});
