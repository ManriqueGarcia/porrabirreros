/**
 * Tests funcionales de la API contra el entorno de dev.
 *
 * Variables de entorno:
 *   TEST_API_BASE   – URL base de la API dev (default: https://dev.porra.manriquegarcia.com)
 *   TEST_API_SECRET – Secret de la API (si aplica)
 *   SKIP_CLEANUP    – Si es "1", no borra los datos al final (para inspeccionar en frontend)
 *
 * Ejecutar:
 *   SKIP_CLEANUP=1 npx vitest run tests/api-functional.test.mjs
 */
import { describe, it, expect } from "vitest";

const API_BASE = (process.env.TEST_API_BASE || "https://dev.porra.manriquegarcia.com").replace(/\/$/, "");
const API_SECRET = process.env.TEST_API_SECRET || "";

const TEST_PREFIX = `_test_${Date.now()}`;
const TEST_GROUP_NAME = `Porra Test ${TEST_PREFIX}`;
const TEST_ADMIN_USER = `Admin${TEST_PREFIX}`;
const TEST_REGULAR_USER = `Usuario${TEST_PREFIX}`;
// SHA-256 of "test123"
const TEST_PASSWORD_HASH = "ecd71870d1963316a97e3ac3408c9835ad8cf0f3c1bc703527c30265534f75ae";

// Carreras reales del calendario F1 2026
const F1_RACE_1 = "australia";
const F1_RACE_2 = "china";

// Jornada de fútbol de test
const FUTBOL_JORNADA_ID = `jornada${TEST_PREFIX}`;

let groupId = "";
let inviteCode = "";
const tokens = {};
let activeToken = "";

function apiHeaders() {
  const h = { "Content-Type": "application/json", Accept: "application/json" };
  if (API_SECRET) h["x-porra-secret"] = API_SECRET;
  if (activeToken) h["Authorization"] = `Bearer ${activeToken}`;
  return h;
}

async function api(method, path, user, body) {
  if (user && tokens[user]) activeToken = tokens[user];
  const opts = { method, headers: apiHeaders() };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const resp = await fetch(`${API_BASE}${path}`, opts);
  const text = await resp.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  return { status: resp.status, data };
}

function apiNoAuth(method, path, body) {
  const saved = activeToken;
  activeToken = "";
  const result = api(method, path, null, body);
  activeToken = saved;
  return result;
}

async function login(username, passwordHash) {
  const resp = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, passwordHash }),
  });
  const data = await resp.json().catch(() => ({}));
  if (data.sessionToken) {
    tokens[username] = data.sessionToken;
    activeToken = data.sessionToken;
  }
  return { status: resp.status, data };
}

function skipIfNoApi() {
  try { new URL(API_BASE); } catch { return true; }
  return false;
}

// ═══════════════════════════════════════════════════════════════
//  1. GRUPO Y AUTENTICACIÓN
// ═══════════════════════════════════════════════════════════════

describe("API — Grupos y Autenticación", () => {
  const skip = skipIfNoApi();

  it.skipIf(skip)("POST /groups — crea un grupo nuevo", async () => {
    const { status, data } = await api("POST", "/groups", null, {
      name: TEST_GROUP_NAME,
      adminUser: TEST_ADMIN_USER,
      adminPasswordHash: TEST_PASSWORD_HASH,
      sports: ["f1", "futbol"],
    });
    expect(status).toBe(201);
    expect(data.ok).toBe(true);
    groupId = data.groupId;
    inviteCode = data.inviteCode;
  });

  it.skipIf(skip)("GET /invite/{code} — valida código de invitación", async () => {
    if (!inviteCode) return;
    const { status, data } = await api("GET", `/invite/${inviteCode}`);
    expect(status).toBe(200);
    expect(data.groupId).toBe(groupId);
  });

  it.skipIf(skip)("GET /invite/invalid — código inválido → 404", async () => {
    const { status } = await api("GET", "/invite/codigoinvalido99");
    expect(status).toBe(404);
  });

  it.skipIf(skip)("POST /groups/{id}/join — usuario se une al grupo", async () => {
    if (!groupId) return;
    const { status, data } = await api("POST", `/groups/${groupId}/join`, null, {
      name: TEST_REGULAR_USER,
      passwordHash: TEST_PASSWORD_HASH,
      inviteCode,
    });
    expect(status).toBe(200);
    expect(data.ok).toBe(true);
  });

  it.skipIf(skip)("POST /groups/{id}/join — código incorrecto → 403", async () => {
    if (!groupId) return;
    const { status } = await api("POST", `/groups/${groupId}/join`, null, {
      name: "intruder", passwordHash: TEST_PASSWORD_HASH, inviteCode: "wrongcode",
    });
    expect(status).toBe(403);
  });

  it.skipIf(skip)("POST /groups/{id}/join — nombre duplicado → 400", async () => {
    if (!groupId) return;
    const { status } = await api("POST", `/groups/${groupId}/join`, null, {
      name: TEST_REGULAR_USER, passwordHash: TEST_PASSWORD_HASH, inviteCode,
    });
    expect(status).toBe(400);
  });

  it.skipIf(skip)("POST /auth/login — login admin correcto", async () => {
    if (!groupId) return;
    const { status, data } = await login(TEST_ADMIN_USER, TEST_PASSWORD_HASH);
    expect(status).toBe(200);
    expect(data.groups.length).toBeGreaterThan(0);
    expect(data.sessionToken).toBeTruthy();
  });

  it.skipIf(skip)("POST /auth/login — login regular user", async () => {
    if (!groupId) return;
    const { status, data } = await login(TEST_REGULAR_USER, TEST_PASSWORD_HASH);
    expect(status).toBe(200);
    expect(data.sessionToken).toBeTruthy();
  });

  it.skipIf(skip)("POST /auth/login — contraseña incorrecta → 401", async () => {
    const { status } = await api("POST", "/auth/login", null, {
      username: TEST_ADMIN_USER, passwordHash: "0000000000000000000000000000000000000000000000000000000000000000",
    });
    expect(status).toBe(401);
  });

  it.skipIf(skip)("POST /auth/verify — verifica password correcto", async () => {
    if (!groupId) return;
    const { status, data } = await api("POST", "/auth/verify", null, {
      username: TEST_ADMIN_USER, passwordHash: TEST_PASSWORD_HASH, groupId,
    });
    expect(status).toBe(200);
    expect(data.valid).toBe(true);
  });

  it.skipIf(skip)("POST /auth/verify — password incorrecto → valid=false", async () => {
    const { status, data } = await api("POST", "/auth/verify", null, {
      username: TEST_ADMIN_USER, passwordHash: "bad", groupId,
    });
    expect(status).toBe(200);
    expect(data.valid).toBe(false);
  });

  it.skipIf(skip)("GET /g/{id}/state — devuelve estado sin passwordHash", async () => {
    if (!groupId) return;
    const { status, data } = await api("GET", `/g/${groupId}/state`, TEST_ADMIN_USER);
    expect(status).toBe(200);
    expect(data.users[TEST_ADMIN_USER]).toBeDefined();
    expect(data.users[TEST_ADMIN_USER].passwordHash).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════
//  2. APUESTAS F1 — usuario normal + admin
// ═══════════════════════════════════════════════════════════════

describe("API — Apuestas F1", () => {
  const skip = skipIfNoApi();

  // -- Apuesta del usuario regular para Australia --
  it.skipIf(skip)("usuario regular guarda apuesta F1 (Australia)", async () => {
    if (!groupId) return;
    const { status, data } = await api("PUT", `/g/${groupId}/bets/f1/${F1_RACE_1}`, TEST_REGULAR_USER, {
      bet: { pole: "Lando Norris", podium: ["Lando Norris", "Charles Leclerc", "Max Verstappen"], q: ["Sí", "Hamilton", "42"] },
    });
    expect(status).toBe(200);
    expect(data.submittedAt).toBeTruthy();
  });

  // -- Apuesta del admin para Australia --
  it.skipIf(skip)("admin guarda su propia apuesta F1 (Australia)", async () => {
    if (!groupId) return;
    const { status } = await api("PUT", `/g/${groupId}/bets/f1/${F1_RACE_1}`, TEST_ADMIN_USER, {
      bet: { pole: "Max Verstappen", podium: ["Max Verstappen", "Lewis Hamilton", "Oscar Piastri"], q: ["No", "Norris", "38"] },
    });
    expect(status).toBe(200);
  });

  // -- Admin sube resultado F1 Australia --
  it.skipIf(skip)("admin guarda resultado F1 (Australia)", async () => {
    if (!groupId) return;
    const { status } = await api("PUT", `/g/${groupId}/results/f1/${F1_RACE_1}`, TEST_ADMIN_USER, {
      result: { pole: "Lando Norris", podium: ["Lando Norris", "Max Verstappen", "Charles Leclerc"], qAnswers: ["Sí", "Norris", "42"] },
    });
    expect(status).toBe(200);
  });

  // -- Admin abre ventana de apuestas y reveal --
  it.skipIf(skip)("admin abre ventana de apuestas (Australia)", async () => {
    if (!groupId) return;
    const { status } = await api("PUT", `/g/${groupId}/admin/f1/${F1_RACE_1}`, TEST_ADMIN_USER, {
      type: "window", data: { forceOpen: false, forceClosed: false },
    });
    expect(status).toBe(200);
  });

  it.skipIf(skip)("admin activa reveal de apuestas (Australia)", async () => {
    if (!groupId) return;
    const { status } = await api("PUT", `/g/${groupId}/admin/f1/${F1_RACE_1}`, TEST_ADMIN_USER, {
      type: "reveal", data: { forceShow: true },
    });
    expect(status).toBe(200);
  });

  // -- Apuesta delegada para China (admin la mete por el usuario) --
  it.skipIf(skip)("admin crea apuesta delegada F1 (China) para el usuario", async () => {
    if (!groupId) return;
    const { status } = await api("PUT", `/g/${groupId}/admin/f1/${F1_RACE_2}`, TEST_ADMIN_USER, {
      type: "bet",
      data: {
        userName: TEST_REGULAR_USER,
        bet: {
          pole: "Charles Leclerc", podium: ["Charles Leclerc", "Carlos Sainz", "Fernando Alonso"],
          q: ["No", "Leclerc", "55"], submittedAt: new Date().toISOString(), delegated: true,
        },
      },
    });
    expect(status).toBe(200);
  });

  // -- Admin también apuesta en China --
  it.skipIf(skip)("admin guarda su apuesta F1 (China)", async () => {
    if (!groupId) return;
    const { status } = await api("PUT", `/g/${groupId}/bets/f1/${F1_RACE_2}`, TEST_ADMIN_USER, {
      bet: { pole: "Lewis Hamilton", podium: ["Lewis Hamilton", "George Russell", "Lando Norris"], q: ["Sí", "Hamilton", "30"] },
    });
    expect(status).toBe(200);
  });

  // -- Admin sube resultado China --
  it.skipIf(skip)("admin guarda resultado F1 (China)", async () => {
    if (!groupId) return;
    const { status } = await api("PUT", `/g/${groupId}/results/f1/${F1_RACE_2}`, TEST_ADMIN_USER, {
      result: { pole: "Charles Leclerc", podium: ["Charles Leclerc", "Carlos Sainz", "Max Verstappen"], qAnswers: ["No", "Leclerc", "50"] },
    });
    expect(status).toBe(200);
  });

  it.skipIf(skip)("admin activa reveal (China)", async () => {
    if (!groupId) return;
    const { status } = await api("PUT", `/g/${groupId}/admin/f1/${F1_RACE_2}`, TEST_ADMIN_USER, {
      type: "reveal", data: { forceShow: true },
    });
    expect(status).toBe(200);
  });

  // -- Verificaciones --
  it.skipIf(skip)("apuestas y resultados F1 persisten en estado", async () => {
    if (!groupId) return;
    const { data } = await api("GET", `/g/${groupId}/state`, TEST_ADMIN_USER);

    // Australia
    expect(data.bets[F1_RACE_1][TEST_REGULAR_USER].pole).toBe("Lando Norris");
    expect(data.bets[F1_RACE_1][TEST_ADMIN_USER].pole).toBe("Max Verstappen");
    expect(data.results[F1_RACE_1].pole).toBe("Lando Norris");
    expect(data.betsReveal[F1_RACE_1].forceShow).toBe(true);

    // China — apuesta delegada
    expect(data.bets[F1_RACE_2][TEST_REGULAR_USER].delegated).toBe(true);
    expect(data.bets[F1_RACE_2][TEST_REGULAR_USER].pole).toBe("Charles Leclerc");
    expect(data.results[F1_RACE_2].pole).toBe("Charles Leclerc");
    expect(data.betsReveal[F1_RACE_2].forceShow).toBe(true);
  });

  it.skipIf(skip)("historial F1 se acumula", async () => {
    if (!groupId) return;
    const { data } = await api("GET", `/g/${groupId}/state`, TEST_ADMIN_USER);
    const history = data.betHistory?.[F1_RACE_1]?.[TEST_REGULAR_USER];
    expect(Array.isArray(history)).toBe(true);
    expect(history.length).toBeGreaterThanOrEqual(1);
  });

  it.skipIf(skip)("usuario sin header → 401", async () => {
    if (!groupId) return;
    const { status } = await apiNoAuth("PUT", `/g/${groupId}/bets/f1/${F1_RACE_1}`, {
      bet: { pole: "VER", podium: ["VER", "NOR", "LEC"], q: [] },
    });
    expect([401, 403]).toContain(status);
  });

  it.skipIf(skip)("usuario normal no puede guardar resultado → 403", async () => {
    if (!groupId) return;
    const { status } = await api("PUT", `/g/${groupId}/results/f1/${F1_RACE_1}`, TEST_REGULAR_USER, {
      result: { pole: "HAM", podium: ["HAM", "SAI", "ALO"] },
    });
    expect(status).toBe(403);
  });

  it.skipIf(skip)("usuario normal no puede hacer admin F1 → 403", async () => {
    if (!groupId) return;
    const { status } = await api("PUT", `/g/${groupId}/admin/f1/${F1_RACE_1}`, TEST_REGULAR_USER, {
      type: "window", data: { forceOpen: true },
    });
    expect(status).toBe(403);
  });
});

// ═══════════════════════════════════════════════════════════════
//  3. APUESTAS FÚTBOL — jornada completa
// ═══════════════════════════════════════════════════════════════

describe("API — Apuestas Fútbol", () => {
  const skip = skipIfNoApi();

  // -- Admin crea la jornada --
  it.skipIf(skip)("admin crea jornada de fútbol con order", async () => {
    if (!groupId) return;
    // Crear jornada
    const { status } = await api("PUT", `/g/${groupId}/admin/futbol/${FUTBOL_JORNADA_ID}`, TEST_ADMIN_USER, {
      type: "jornada",
      data: {
        id: FUTBOL_JORNADA_ID,
        name: "Jornada Test",
        matches: [
          { home: "Real Madrid", away: "FC Barcelona" },
          { home: "Real Sociedad", away: "Sporting de Gijón" },
          { home: "Atlético Madrid", away: "Valencia CF" },
        ],
        deadline: "2026-04-01T15:00:00Z",
        order: [FUTBOL_JORNADA_ID],
      },
    });
    expect(status).toBe(200);
  });

  // -- Usuario regular apuesta --
  it.skipIf(skip)("usuario regular guarda apuesta fútbol", async () => {
    if (!groupId) return;
    const { status, data } = await api("PUT", `/g/${groupId}/bets/futbol/${FUTBOL_JORNADA_ID}`, TEST_REGULAR_USER, {
      bet: {
        matches: [
          { home: 2, away: 1 },
          { home: 1, away: 1 },
          { home: 0, away: 0 },
        ],
      },
    });
    expect(status).toBe(200);
    expect(data.submittedAt).toBeTruthy();
  });

  // -- Admin apuesta --
  it.skipIf(skip)("admin guarda su apuesta fútbol", async () => {
    if (!groupId) return;
    const { status } = await api("PUT", `/g/${groupId}/bets/futbol/${FUTBOL_JORNADA_ID}`, TEST_ADMIN_USER, {
      bet: {
        matches: [
          { home: 3, away: 2 },
          { home: 0, away: 1 },
          { home: 1, away: 0 },
        ],
      },
    });
    expect(status).toBe(200);
  });

  // -- Admin sube resultado --
  it.skipIf(skip)("admin guarda resultado fútbol", async () => {
    if (!groupId) return;
    const { status } = await api("PUT", `/g/${groupId}/results/futbol/${FUTBOL_JORNADA_ID}`, TEST_ADMIN_USER, {
      result: {
        matches: [
          { home: 2, away: 1 },
          { home: 0, away: 0 },
          { home: 1, away: 0 },
        ],
      },
    });
    expect(status).toBe(200);
  });

  // -- Admin activa reveal --
  it.skipIf(skip)("admin activa reveal fútbol", async () => {
    if (!groupId) return;
    const { status } = await api("PUT", `/g/${groupId}/admin/futbol/${FUTBOL_JORNADA_ID}`, TEST_ADMIN_USER, {
      type: "reveal", data: { forceShow: true },
    });
    expect(status).toBe(200);
  });

  // -- Admin crea apuesta delegada fútbol para el usuario --
  // (sobreescribe la apuesta anterior del usuario, simulando que el admin la introduce)
  it.skipIf(skip)("admin crea apuesta delegada fútbol para el usuario", async () => {
    if (!groupId) return;
    const { status } = await api("PUT", `/g/${groupId}/admin/futbol/${FUTBOL_JORNADA_ID}`, TEST_ADMIN_USER, {
      type: "bet",
      data: {
        userName: TEST_REGULAR_USER,
        bet: {
          matches: [
            { home: 2, away: 1 },
            { home: 0, away: 0 },
            { home: 1, away: 1 },
          ],
          submittedAt: new Date().toISOString(),
          delegated: true,
        },
      },
    });
    expect(status).toBe(200);
  });

  // -- Verificaciones --
  it.skipIf(skip)("jornada, apuestas, resultado y reveal persisten", async () => {
    if (!groupId) return;
    const { data } = await api("GET", `/g/${groupId}/state`, TEST_ADMIN_USER);
    const fut = data.futbol;

    expect(fut.jornadas[FUTBOL_JORNADA_ID]).toBeDefined();
    expect(fut.jornadas[FUTBOL_JORNADA_ID].name).toBe("Jornada Test");
    expect(fut.jornadas[FUTBOL_JORNADA_ID].matches).toHaveLength(3);

    expect(fut.results[FUTBOL_JORNADA_ID]).toBeDefined();
    expect(fut.results[FUTBOL_JORNADA_ID].matches).toHaveLength(3);

    // Apuesta delegada del usuario
    const userBet = fut.bets[FUTBOL_JORNADA_ID]?.[TEST_REGULAR_USER];
    expect(userBet).toBeDefined();
    expect(userBet.delegated).toBe(true);

    // Apuesta del admin
    expect(fut.bets[FUTBOL_JORNADA_ID]?.[TEST_ADMIN_USER]).toBeDefined();

    // Reveal activo
    expect(fut.betsReveal?.[FUTBOL_JORNADA_ID]?.forceShow).toBe(true);
  });

  it.skipIf(skip)("usuario normal no puede hacer admin fútbol → 403", async () => {
    if (!groupId) return;
    const { status } = await api("PUT", `/g/${groupId}/admin/futbol/${FUTBOL_JORNADA_ID}`, TEST_REGULAR_USER, {
      type: "window", data: { forceOpen: true },
    });
    expect(status).toBe(403);
  });

  it.skipIf(skip)("usuario normal no puede guardar resultado fútbol → 403", async () => {
    if (!groupId) return;
    const { status } = await api("PUT", `/g/${groupId}/results/futbol/${FUTBOL_JORNADA_ID}`, TEST_REGULAR_USER, {
      result: { matches: [{ home: 0, away: 0 }] },
    });
    expect(status).toBe(403);
  });
});

// ═══════════════════════════════════════════════════════════════
//  4. GESTIÓN DE USUARIOS
// ═══════════════════════════════════════════════════════════════

describe("API — Gestión de Usuarios", () => {
  const skip = skipIfNoApi();
  const EXTRA_USER = `extra${TEST_PREFIX}`;

  it.skipIf(skip)("admin añade usuario", async () => {
    if (!groupId) return;
    const { status } = await api("POST", `/g/${groupId}/users`, TEST_ADMIN_USER, {
      name: EXTRA_USER, passwordHash: TEST_PASSWORD_HASH, porras: { f1: true, futbol: true },
    });
    expect(status).toBe(200);
  });

  it.skipIf(skip)("usuario añadido aparece en estado", async () => {
    if (!groupId) return;
    const { data } = await api("GET", `/g/${groupId}/state`, TEST_ADMIN_USER);
    expect(data.users[EXTRA_USER]).toBeDefined();
  });

  it.skipIf(skip)("admin modifica usuario (bloquear)", async () => {
    if (!groupId) return;
    const { status } = await api("PUT", `/g/${groupId}/users/${EXTRA_USER}`, TEST_ADMIN_USER, {
      updates: { blocked: true },
    });
    expect(status).toBe(200);
  });

  it.skipIf(skip)("usuario normal no puede modificar a otro → 403", async () => {
    if (!groupId) return;
    const { status } = await api("PUT", `/g/${groupId}/users/${TEST_ADMIN_USER}`, TEST_REGULAR_USER, {
      updates: { blocked: true },
    });
    expect(status).toBe(403);
  });

  it.skipIf(skip)("usuario puede modificar su propio perfil", async () => {
    if (!groupId) return;
    const { status } = await api("PUT", `/g/${groupId}/users/${TEST_REGULAR_USER}`, TEST_REGULAR_USER, {
      updates: { avatar: "test_avatar" },
    });
    expect(status).toBe(200);
  });

  it.skipIf(skip)("admin elimina usuario extra", async () => {
    if (!groupId) return;
    const { status } = await api("DELETE", `/g/${groupId}/users/${EXTRA_USER}`, TEST_ADMIN_USER);
    expect(status).toBe(200);
  });

  it.skipIf(skip)("usuario eliminado ya no aparece", async () => {
    if (!groupId) return;
    const { data } = await api("GET", `/g/${groupId}/state`, TEST_ADMIN_USER);
    expect(data.users[EXTRA_USER]).toBeUndefined();
  });

  it.skipIf(skip)("admin no puede eliminarse a sí mismo → 400", async () => {
    if (!groupId) return;
    const { status } = await api("DELETE", `/g/${groupId}/users/${TEST_ADMIN_USER}`, TEST_ADMIN_USER);
    expect(status).toBe(400);
  });
});

// ═══════════════════════════════════════════════════════════════
//  5. META
// ═══════════════════════════════════════════════════════════════

describe("API — Meta", () => {
  const skip = skipIfNoApi();

  it.skipIf(skip)("admin actualiza meta", async () => {
    if (!groupId) return;
    const { status } = await api("PUT", `/g/${groupId}/meta`, TEST_ADMIN_USER, {
      meta: { testFlag: true },
    });
    expect(status).toBe(200);
  });

  it.skipIf(skip)("meta persiste", async () => {
    if (!groupId) return;
    const { data } = await api("GET", `/g/${groupId}/state`, TEST_ADMIN_USER);
    expect(data.meta.testFlag).toBe(true);
  });

  it.skipIf(skip)("usuario normal no puede actualizar meta → 403", async () => {
    if (!groupId) return;
    const { status } = await api("PUT", `/g/${groupId}/meta`, TEST_REGULAR_USER, {
      meta: { testFlag: false },
    });
    expect(status).toBe(403);
  });
});

// ═══════════════════════════════════════════════════════════════
//  6. RESUMEN — imprime datos para acceder desde el frontend
// ═══════════════════════════════════════════════════════════════

describe("API — Resumen de datos de test", () => {
  const skip = skipIfNoApi();

  it.skipIf(skip)("imprime credenciales del grupo de test", () => {
    console.log("\n╔══════════════════════════════════════════════════════════════╗");
    console.log("║              DATOS DEL GRUPO DE TEST EN DEV                ║");
    console.log("╠══════════════════════════════════════════════════════════════╣");
    console.log(`║  Group ID:       ${groupId}`);
    console.log(`║  Invite Code:    ${inviteCode}`);
    console.log(`║  Admin User:     ${TEST_ADMIN_USER}`);
    console.log(`║  Regular User:   ${TEST_REGULAR_USER}`);
    console.log(`║  Contraseña:     test123`);
    console.log("╠══════════════════════════════════════════════════════════════╣");
    console.log("║  DATOS CREADOS:                                            ║");
    console.log(`║  F1 Australia:   apuestas ambos + resultado + reveal       ║`);
    console.log(`║  F1 China:       delegada (user) + admin + resultado       ║`);
    console.log(`║  Fútbol:         jornada 3 partidos + apuestas + resultado ║`);
    console.log(`║                  + apuesta delegada (user) + reveal        ║`);
    console.log("╚══════════════════════════════════════════════════════════════╝\n");
    expect(groupId).toBeTruthy();
  });
});

// ═══════════════════════════════════════════════════════════════
//  7. RUTAS Y VALIDACIÓN
// ═══════════════════════════════════════════════════════════════

describe("API — Rutas y validación", () => {
  const skip = skipIfNoApi();

  it.skipIf(skip)("ruta inexistente → 404", async () => {
    const { status } = await api("GET", "/nonexistent/path");
    expect(status).toBe(404);
  });

  it.skipIf(skip)("groupId inválido → 400", async () => {
    const { status } = await api("GET", "/g/invalid!!id/state");
    expect(status).toBe(400);
  });

  it.skipIf(skip)("OPTIONS → 204 (CORS preflight)", async () => {
    const resp = await fetch(`${API_BASE}/g/${groupId || "test"}/state`, {
      method: "OPTIONS", headers: apiHeaders(),
    });
    expect(resp.status).toBe(204);
  });
});

// ═══════════════════════════════════════════════════════════════
//  8. LIMPIEZA (solo si SKIP_CLEANUP no está activo)
// ═══════════════════════════════════════════════════════════════

describe("API — Limpieza", () => {
  const skip = skipIfNoApi() || !!process.env.SKIP_CLEANUP;

  it.skipIf(skip)("elimina usuarios de test del grupo", async () => {
    if (!groupId) return;
    await api("DELETE", `/g/${groupId}/users/${TEST_REGULAR_USER}`, TEST_ADMIN_USER);
    const { data } = await api("GET", `/g/${groupId}/state`, TEST_ADMIN_USER);
    expect(data.users[TEST_REGULAR_USER]).toBeUndefined();
  });
});
