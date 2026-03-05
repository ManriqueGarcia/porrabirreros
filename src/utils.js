import { useState, useEffect } from "react";
import { LS_KEY, DEFAULT_PASSWORD_HASH, ADMIN_SECRET_HASH, MADRID_TZ, SESSION_TIMEOUT_MS } from "./config.js";

export const nowISO = () => new Date().toISOString();

export function loadDB() {
  try { return JSON.parse(localStorage.getItem(LS_KEY)) || {}; } catch { return {}; }
}

function _saveDBNow(db) {
  try {
    const safe = { ...db };
    delete safe.users;
    if (safe.meta) {
      const m = { ...safe.meta };
      delete m.adminSecret;
      delete m.adminSecretHash;
      safe.meta = m;
    }
    localStorage.setItem(LS_KEY, JSON.stringify(safe));
  } catch (e) { console.warn("No se pudo guardar en localStorage", e); }
}

let _saveDBTimer = null;
export function saveDB(db) { clearTimeout(_saveDBTimer); _saveDBTimer = setTimeout(() => _saveDBNow(db), 300); }

export function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

export function generateSessionToken() {
  return crypto.getRandomValues(new Uint8Array(16)).reduce((s, b) => s + b.toString(16).padStart(2, "0"), "");
}

export function createSession(username, groups) {
  const token = generateSessionToken();
  const session = { user: username, token, created: Date.now(), groups: groups || [] };
  sessionStorage.setItem("porra_session", JSON.stringify(session));
  return session;
}

export function getSession() {
  try { const s = JSON.parse(sessionStorage.getItem("porra_session") || "null"); if (!s?.user || !s?.token) return null; return s; } catch { return null; }
}

export function clearSession() {
  sessionStorage.removeItem("porra_session");
  sessionStorage.removeItem("porra_session_user");
}

export async function hashPassword(pwd) {
  const data = new TextEncoder().encode(pwd || "");
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, "0")).join("");
}

export async function passwordMatches(user, pwd) {
  if (!user) return false;
  const h = await hashPassword(pwd);
  if (user.passwordHash) return h === user.passwordHash;
  if (user.password) return h === await hashPassword(user.password);
  return false;
}

export async function verifyAdminSecret(input, dbMeta) {
  const inputHash = await hashPassword(input);
  if (dbMeta?.adminSecretHash) return inputHash === dbMeta.adminSecretHash;
  if (dbMeta?.adminSecret) return input === dbMeta.adminSecret;
  return inputHash === ADMIN_SECRET_HASH;
}

export function getOffsetInMinutes(date, timeZone) {
  const dtf = new Intl.DateTimeFormat("en-US", { timeZone, hour12: false, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const parts = dtf.formatToParts(date).reduce((acc, p) => { acc[p.type] = p.value; return acc; }, {});
  const asUTC = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second));
  return (asUTC - date.getTime()) / 60000;
}

export function toZonedDate(dateStr, timeStr, timeZone) {
  if (!dateStr || !timeStr) return null;
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm] = timeStr.split(":").map(Number);
  const tz = timeZone || MADRID_TZ;
  const utcGuess = Date.UTC(y, m - 1, d, hh, mm, 0, 0);
  const offsetMinutes = getOffsetInMinutes(new Date(utcGuess), tz);
  return new Date(utcGuess - offsetMinutes * 60000);
}

export function formatDateTime(date, timeZone) {
  return date.toLocaleString("es-ES", { timeZone: timeZone || MADRID_TZ, weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });
}

export function formatTime(date, timeZone) {
  return date.toLocaleTimeString([], { timeZone: timeZone || MADRID_TZ, hour: "2-digit", minute: "2-digit" });
}

export function useNow(intervalMs = 30000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const id = setInterval(() => setNow(new Date()), intervalMs); return () => clearInterval(id); }, [intervalMs]);
  return now;
}

export function shareBet(text) {
  if (navigator.share) navigator.share({ title: "Porra Birreros", text }).catch(() => {});
  else window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, "_blank");
}

export function exportCSV(filename, headers, rows) {
  const bom = "\uFEFF";
  const csv = bom + [headers.join(";"), ...rows.map(r => r.map(c => String(c ?? "").replace(/;/g, ",")).join(";"))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export function parseLocalDateTime(input) {
  if (!input) return null;
  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

export function toLocalDateTimeInput(date) {
  if (!date) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function nextFridayAt1500() {
  const now = new Date();
  const day = now.getDay();
  const diff = (5 - day + 7) % 7 || 7;
  const target = new Date(now);
  target.setDate(now.getDate() + diff);
  target.setHours(15, 0, 0, 0);
  return target;
}

export function exportPDF(title, headers, rows) {
  const style = `<style>
    body{font-family:system-ui,sans-serif;padding:20px;color:#222}
    h1{font-size:18px;margin-bottom:12px}
    table{border-collapse:collapse;width:100%;font-size:13px}
    th,td{border:1px solid #ccc;padding:6px 10px;text-align:left}
    th{background:#f5f5f5;font-weight:600}
    tr:nth-child(even){background:#fafafa}
    .footer{margin-top:16px;font-size:10px;color:#999}
  </style>`;
  const tableRows = rows.map(r =>
    `<tr>${r.map(c => `<td>${c ?? ""}</td>`).join("")}</tr>`
  ).join("");
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>${style}</head><body>
    <h1>${title}</h1>
    <table><thead><tr>${headers.map(h => `<th>${h}</th>`).join("")}</tr></thead><tbody>${tableRows}</tbody></table>
    <div class="footer">Porra Birreros — Generado el ${new Date().toLocaleDateString("es-ES")}</div>
    <script>window.onload=()=>{window.print();setTimeout(()=>window.close(),500);}<\/script>
  </body></html>`;
  const w = window.open("", "_blank");
  if (w) { w.document.write(html); w.document.close(); }
}

export function betsAreEqual(prev, next) {
  if (!prev || !next) return false;
  const samePole = (prev.pole || "") === (next.pole || "");
  const samePodium = (prev.podium || []).join("|") === (next.podium || []).join("|");
  const sameQ = (prev.q || []).join("|") === (next.q || []).join("|");
  return samePole && samePodium && sameQ;
}

export const MAX_AVATAR_BASE64 = 120000;
export function resizeImageToDataUrl(file, maxW = 128, maxH = 128, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const c = document.createElement("canvas");
      let w = img.width, h = img.height;
      if (w > maxW || h > maxH) { const r = Math.min(maxW / w, maxH / h); w = Math.round(w * r); h = Math.round(h * r); }
      c.width = w; c.height = h;
      const ctx = c.getContext("2d");
      ctx.drawImage(img, 0, 0, w, h);
      let dataUrl = c.toDataURL("image/jpeg", quality);
      while (dataUrl.length > MAX_AVATAR_BASE64 && quality > 0.3) { quality -= 0.1; dataUrl = c.toDataURL("image/jpeg", quality); }
      resolve(dataUrl);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Error cargando imagen")); };
    img.src = url;
  });
}
export function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(new Error("Error leyendo archivo"));
    r.readAsDataURL(file);
  });
}

const _loginAttempts = { count: 0, lockedUntil: 0 };
export function checkLoginRateLimit() {
  if (Date.now() < _loginAttempts.lockedUntil) {
    const secs = Math.ceil((_loginAttempts.lockedUntil - Date.now()) / 1000);
    return { allowed: false, msg: `Demasiados intentos. Espera ${secs}s.` };
  }
  return { allowed: true };
}
export function recordLoginFailure() {
  _loginAttempts.count++;
  if (_loginAttempts.count >= 5) _loginAttempts.lockedUntil = Date.now() + 60000;
  else if (_loginAttempts.count >= 3) _loginAttempts.lockedUntil = Date.now() + 15000;
}
export function resetLoginAttempts() { _loginAttempts.count = 0; _loginAttempts.lockedUntil = 0; }
