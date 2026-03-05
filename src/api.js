import { CACHE_BUST } from "./config.js";
import { debounce } from "./utils.js";

export const API_BASE_URL = (window.PORRA_API_BASE || "").replace(/\/$/, "");
export const API_SECRET = window.PORRA_API_SECRET || "";
export const API_HEADERS = API_SECRET ? { "x-porra-secret": API_SECRET } : {};

export async function fetchRemoteState() {
  if (!API_BASE_URL) return null;
  const res = await fetch(`${API_BASE_URL}/state`, { headers: { "Accept": "application/json", ...API_HEADERS } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("Fetch remoto fallido");
  return res.json();
}

export async function saveRemoteState(payload) {
  if (!API_BASE_URL) return;
  await fetch(`${API_BASE_URL}/state`, { method: "PUT", headers: { "Content-Type": "application/json", ...API_HEADERS }, body: JSON.stringify(payload) });
}

export const saveRemoteDebounced = debounce((db) => {
  saveRemoteState(db).catch(err => console.warn("No se pudo guardar estado remoto", err));
}, 1500);

export async function loadCalendar() { const r = await fetch(`./assets/calendar_2026.json?${CACHE_BUST}`); return r.json(); }
export async function loadDrivers() { const r = await fetch(`./assets/drivers_2026.json?${CACHE_BUST}`); return r.json(); }
export async function loadTeams() { const r = await fetch(`./assets/teams_2026.json?${CACHE_BUST}`); return r.json(); }
export async function loadCircuits() { const r = await fetch(`./assets/circuits_2026.json?${CACHE_BUST}`); return r.json(); }
export async function loadHistorical(year) {
  const r = await fetch(`./assets/historical_${year}.json?${CACHE_BUST}`);
  if (!r.ok) { const e = new Error(`HTTP ${r.status}`); e.status = r.status; throw e; }
  return r.json();
}
