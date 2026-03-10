import { CACHE_BUST } from "./config.js";
import { debounce } from "./utils.js";

export const API_BASE_URL = (window.PORRA_API_BASE || "").replace(/\/$/, "");

let _groupId = null;
export function setActiveGroupId(gid) { _groupId = gid || null; }
export function getActiveGroupId() { return _groupId; }

let _sessionToken = null;
export function setSessionToken(token) { _sessionToken = token || null; }
export function getSessionToken() { return _sessionToken; }

function groupPrefix() { return _groupId ? `/g/${_groupId}` : ""; }

function authHeaders() {
  const h = {};
  if (_sessionToken) h["Authorization"] = `Bearer ${_sessionToken}`;
  return h;
}

async function apiCall(method, path, user, body) {
  if (!API_BASE_URL) return null;
  const opts = {
    method,
    headers: { "Content-Type": "application/json", Accept: "application/json", ...authHeaders() },
  };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const fullPath = `${API_BASE_URL}${groupPrefix()}${path}`;
  const res = await fetch(fullPath, opts);
  if (res.status === 401) { onSessionExpired(); throw new Error("Sesión expirada"); }
  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`API ${method} ${path}: ${res.status} ${err}`);
  }
  return res.json();
}

// ─── State ───

let _stateETag = null;

export async function fetchRemoteState() {
  if (!API_BASE_URL) return null;
  const url = `${API_BASE_URL}${groupPrefix()}/state`;
  const hdrs = { Accept: "application/json", ...authHeaders() };
  if (_stateETag) hdrs["If-None-Match"] = _stateETag;
  const res = await fetch(url, { headers: hdrs });
  if (res.status === 304) return null;
  if (res.status === 404) return null;
  if (res.status === 401) { onSessionExpired(); return null; }
  if (!res.ok) throw new Error("Fetch remoto fallido");
  const etag = res.headers.get("ETag");
  if (etag) _stateETag = etag;
  return res.json();
}

export function resetStateETag() { _stateETag = null; }

let _onSessionExpired = null;
export function setOnSessionExpired(fn) { _onSessionExpired = fn; }
function onSessionExpired() { if (_onSessionExpired) _onSessionExpired(); }

export async function saveRemoteState(payload, user) {
  if (!API_BASE_URL) return;
  const url = `${API_BASE_URL}${groupPrefix()}/state`;
  const hdrs = { "Content-Type": "application/json", ...authHeaders() };
  const r = await fetch(url, { method: "PUT", headers: hdrs, body: JSON.stringify(payload) });
  if (r.status === 401) { onSessionExpired(); return; }
  if (!r.ok) throw new Error(`Save failed: ${r.status}`);
}

let _saveRemoteUser = "";
export function setSaveRemoteUser(u) { _saveRemoteUser = u || ""; }

export const saveRemoteDebounced = debounce((db) => {
  saveRemoteState(db, _saveRemoteUser).catch(err => console.warn("No se pudo guardar estado remoto", err));
}, 1500);

// ─── F1 Bets ───

export async function saveBetF1(raceKey, user, bet, deadline) {
  return apiCall("PUT", `/bets/f1/${raceKey}`, user, { bet, deadline });
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

export async function verifyPassword(username, passwordHash, groupId) {
  const resp = await fetch(`${API_BASE_URL}/auth/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ username, passwordHash, groupId: groupId || getActiveGroupId() }),
  });
  const data = await resp.json().catch(() => ({}));
  return !!data.valid;
}

export async function authLogin(username, passwordHash) {
  const resp = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, passwordHash }),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(data.error || "Error de autenticación");
  if (data.sessionToken) setSessionToken(data.sessionToken);
  return data;
}

export async function fetchUserGroups(username, reqUser) {
  const resp = await fetch(`${API_BASE_URL}/users/${encodeURIComponent(username)}/groups`, {
    headers: { Accept: "application/json", ...authHeaders() },
  });
  if (!resp.ok) return [];
  const data = await resp.json();
  return data.groups || [];
}

export async function fetchGroupsList(reqUser) {
  const resp = await fetch(`${API_BASE_URL}/groups/list`, {
    headers: { Accept: "application/json", ...authHeaders() },
  });
  if (!resp.ok) return [];
  const data = await resp.json();
  return data.groups || [];
}
