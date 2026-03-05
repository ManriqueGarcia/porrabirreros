import { CACHE_BUST } from "./config.js";
import { debounce } from "./utils.js";

export const API_BASE_URL = (window.PORRA_API_BASE || "").replace(/\/$/, "");
export const API_SECRET = window.PORRA_API_SECRET || "";
export const API_HEADERS = API_SECRET ? { "x-porra-secret": API_SECRET } : {};

let _groupId = null;
export function setActiveGroupId(gid) { _groupId = gid || null; }
export function getActiveGroupId() { return _groupId; }

function groupPrefix() { return _groupId ? `/g/${_groupId}` : ""; }

function userHeaders(user) {
  return { ...API_HEADERS, "x-porra-user": user || "" };
}

async function apiCall(method, path, user, body) {
  if (!API_BASE_URL) return null;
  const opts = {
    method,
    headers: { "Content-Type": "application/json", Accept: "application/json", ...userHeaders(user) },
  };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const fullPath = `${API_BASE_URL}${groupPrefix()}${path}`;
  const res = await fetch(fullPath, opts);
  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`API ${method} ${path}: ${res.status} ${err}`);
  }
  return res.json();
}

// ─── State ───

export async function fetchRemoteState() {
  if (!API_BASE_URL) return null;
  const url = `${API_BASE_URL}${groupPrefix()}/state`;
  const res = await fetch(url, { headers: { Accept: "application/json", ...API_HEADERS } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("Fetch remoto fallido");
  return res.json();
}

export async function saveRemoteState(payload) {
  if (!API_BASE_URL) return;
  const url = `${API_BASE_URL}${groupPrefix()}/state`;
  await fetch(url, { method: "PUT", headers: { "Content-Type": "application/json", ...API_HEADERS }, body: JSON.stringify(payload) });
}

export const saveRemoteDebounced = debounce((db) => {
  saveRemoteState(db).catch(err => console.warn("No se pudo guardar estado remoto", err));
}, 1500);

// ─── F1 Bets ───

export async function saveBetF1(raceKey, user, bet) {
  return apiCall("PUT", `/bets/f1/${raceKey}`, user, { bet });
}

// ─── Futbol Bets ───

export async function saveBetFutbol(jornadaId, user, bet) {
  return apiCall("PUT", `/bets/futbol/${jornadaId}`, user, { bet });
}

// ─── F1 Results (admin) ───

export async function saveResultF1(raceKey, user, result) {
  return apiCall("PUT", `/results/f1/${raceKey}`, user, { result });
}

// ─── Futbol Results (admin) ───

export async function saveResultFutbol(jornadaId, user, result) {
  return apiCall("PUT", `/results/futbol/${jornadaId}`, user, { result });
}

// ─── Users ───

export async function updateUser(targetUser, reqUser, updates) {
  return apiCall("PUT", `/users/${encodeURIComponent(targetUser)}`, reqUser, { updates });
}

export async function addUser(reqUser, userData) {
  return apiCall("POST", "/users", reqUser, userData);
}

export async function deleteUser(targetUser, reqUser) {
  return apiCall("DELETE", `/users/${encodeURIComponent(targetUser)}`, reqUser);
}

// ─── Meta (admin) ───

export async function saveMeta(user, meta) {
  return apiCall("PUT", "/meta", user, { meta });
}

// ─── Admin F1 ───

export async function adminF1(raceKey, user, type, data) {
  return apiCall("PUT", `/admin/f1/${raceKey}`, user, { type, data });
}

// ─── Admin Futbol ───

export async function adminFutbol(jornadaId, user, type, data) {
  return apiCall("PUT", `/admin/futbol/${jornadaId}`, user, { type, data });
}

// ─── Static assets ───

export async function loadCalendar() { const r = await fetch(`./assets/calendar_2026.json?${CACHE_BUST}`); return r.json(); }
export async function loadDrivers() { const r = await fetch(`./assets/drivers_2026.json?${CACHE_BUST}`); return r.json(); }
export async function loadTeams() { const r = await fetch(`./assets/teams_2026.json?${CACHE_BUST}`); return r.json(); }
export async function loadCircuits() { const r = await fetch(`./assets/circuits_2026.json?${CACHE_BUST}`); return r.json(); }
export async function loadHistorical(year) {
  const r = await fetch(`./assets/historical_${year}.json?${CACHE_BUST}`);
  if (!r.ok) { const e = new Error(`HTTP ${r.status}`); e.status = r.status; throw e; }
  return r.json();
}

// ─── Auth ───

export async function authLogin(username, passwordHash) {
  const resp = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...API_HEADERS },
    body: JSON.stringify({ username, passwordHash }),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(data.error || "Error de autenticación");
  return data;
}

export async function fetchUserGroups(username) {
  const resp = await fetch(`${API_BASE_URL}/users/${encodeURIComponent(username)}/groups`, {
    headers: { Accept: "application/json", ...API_HEADERS },
  });
  if (!resp.ok) return [];
  const data = await resp.json();
  return data.groups || [];
}

export async function fetchGroupsList() {
  const resp = await fetch(`${API_BASE_URL}/groups/list`, {
    headers: { Accept: "application/json", ...API_HEADERS },
  });
  if (!resp.ok) return [];
  const data = await resp.json();
  return data.groups || [];
}
