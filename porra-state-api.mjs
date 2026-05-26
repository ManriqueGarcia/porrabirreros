/**
 * Lambda: API de estado con DynamoDB
 * Rutas granulares con validacion server-side.
 * Env vars: TABLE_NAME, ALLOWED_ORIGIN, API_SECRET
 * Opcional fútbol (horarios La Liga vía football-data.org): FOOTBALL_DATA_ORG_TOKEN, FOOTBALL_DATA_COMPETITION_ID (default PD), FOOTBALL_DATA_DATE_RANGE_DAYS
 */
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient, GetCommand, PutCommand, DeleteCommand,
  QueryCommand, ScanCommand, BatchWriteCommand, UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { createHash, randomBytes } from "crypto";
import { isCancelledF1RaceKey } from "./lib/f1-cancelled-races.mjs";
import { enrichFutbolJornadaMatchesFromApi } from "./lib/laliga-fixtures.mjs";

const TABLE = process.env.TABLE_NAME || "PorraBirreros";
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "*";
const API_SECRET = process.env.API_SECRET || "";
const LOG_LEVEL = process.env.LOG_LEVEL || "info";

function log(level, action, data) {
  const levels = { debug: 0, info: 1, warn: 2, error: 3 };
  if ((levels[level] ?? 1) < (levels[LOG_LEVEL] ?? 1)) return;
  const entry = { ts: new Date().toISOString(), level, action, ...data };
  console[level === "error" ? "error" : level === "warn" ? "warn" : "log"](JSON.stringify(entry));
}

const RATE_WINDOW_MS = 60_000;
const AUTH_RATE_MAX = 10;
const WRITE_RATE_MAX = 30;
const _rateBuckets = new Map();

function checkRateLimit(key, max = AUTH_RATE_MAX) {
  const now = Date.now();
  let bucket = _rateBuckets.get(key);
  if (!bucket || now - bucket.start > RATE_WINDOW_MS) {
    bucket = { start: now, count: 0 };
    _rateBuckets.set(key, bucket);
  }
  bucket.count++;
  if (_rateBuckets.size > 2000) {
    for (const [k, v] of _rateBuckets) {
      if (now - v.start > RATE_WINDOW_MS) _rateBuckets.delete(k);
    }
  }
  return bucket.count <= max;
}

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true },
});

function sanitizeState(state) {
  const s = { ...state };
  if (s.users) {
    const users = {};
    for (const [name, u] of Object.entries(s.users)) {
      const { passwordHash: _passwordHash, ...safe } = u;
      users[name] = safe;
    }
    s.users = users;
  }
  if (s.meta) {
    const { adminSecretHash: _ash, adminSecret: _as, ...safeMeta } = s.meta;
    s.meta = safeMeta;
  }
  return s;
}

function safeDecodeURI(str) {
  try { return decodeURIComponent(str); } catch { return null; }
}

function isValidId(id) {
  return typeof id === "string" && /^[a-zA-Z0-9_-]{1,50}$/.test(id);
}

function isValidUserName(name) {
  if (!name || typeof name !== "string") return false;
  if (name.length > 50) return false;
  return !/[|#]/.test(name);
}

/** Bravuconada opcional; mismo límite que el cliente (120). */
function sanitizeTrashtalk(bet) {
  const raw = bet?.trashtalk;
  if (raw == null || raw === "") return "";
  if (typeof raw !== "string") return "";
  return raw.trim().slice(0, 120);
}

function normalizeBetTrashtalk(bet) {
  if (!bet || typeof bet !== "object") return bet;
  const out = { ...bet };
  const tt = sanitizeTrashtalk(out);
  if (tt) out.trashtalk = tt; else delete out.trashtalk;
  return out;
}

function validateF1Bet(bet) {
  if (typeof bet.pole !== "undefined" && typeof bet.pole !== "string") return "pole debe ser string";
  if (bet.pole && bet.pole.length > 100) return "pole demasiado largo";
  if (bet.podium && (!Array.isArray(bet.podium) || bet.podium.length > 5)) return "podium inválido";
  if (bet.podium && bet.podium.some(d => typeof d !== "string" || d.length > 100)) return "valor de podium inválido";
  if (bet.q && (!Array.isArray(bet.q) || bet.q.length > 10)) return "preguntas inválidas";
  if (bet.q && bet.q.some(a => typeof a !== "string" || a.length > 500)) return "respuesta demasiado larga";
  if (bet.trashtalk != null && bet.trashtalk !== "" && typeof bet.trashtalk !== "string") return "trashtalk debe ser string";
  if (typeof bet.trashtalk === "string" && bet.trashtalk.length > 120) return "trashtalk demasiado largo";
  return null;
}

function validateF1Result(result) {
  if (typeof result.pole !== "undefined" && typeof result.pole !== "string") return "pole debe ser string";
  if (result.pole && result.pole.length > 100) return "pole demasiado largo";
  if (result.podium && (!Array.isArray(result.podium) || result.podium.length > 5)) return "podium inválido";
  if (result.podium && result.podium.some(d => typeof d !== "string" || d.length > 100)) return "valor de podium inválido";
  return null;
}

function validateFutbolResult(result) {
  if (result.matches && !Array.isArray(result.matches)) return "matches debe ser un array";
  if (result.matches && result.matches.length > 20) return "demasiados partidos";
  if (result.matches) {
    for (const m of result.matches) {
      if (!m || typeof m !== "object") return "partido inválido";
      const h = Number(m.home), a = Number(m.away);
      if (!Number.isInteger(h) || h < 0 || h > 99) return "marcador fuera de rango";
      if (!Number.isInteger(a) || a < 0 || a > 99) return "marcador fuera de rango";
    }
  }
  return null;
}

function validateFutbolBet(bet) {
  if (!Array.isArray(bet.matches)) return "matches debe ser un array";
  if (bet.matches.length > 20) return "demasiados partidos";
  for (const m of bet.matches) {
    if (!m || typeof m !== "object") return "partido inválido";
    const h = Number(m.home), a = Number(m.away);
    if (!Number.isInteger(h) || h < 0 || h > 99) return "marcador fuera de rango (0-99)";
    if (!Number.isInteger(a) || a < 0 || a > 99) return "marcador fuera de rango (0-99)";
  }
  if (bet.trashtalk != null && bet.trashtalk !== "" && typeof bet.trashtalk !== "string") return "trashtalk debe ser string";
  if (typeof bet.trashtalk === "string" && bet.trashtalk.length > 120) return "trashtalk demasiado largo";
  return null;
}

function validateMundialMatchExtras(m) {
  if (m.extraTime != null && typeof m.extraTime !== "boolean") return "extraTime inválido";
  if (m.penalties != null && typeof m.penalties !== "boolean") return "penalties inválido";
  if (m.penWinner != null && m.penWinner !== "home" && m.penWinner !== "away") return "penWinner inválido";
  return null;
}

function validateMundialBet(bet) {
  const base = validateFutbolBet(bet);
  if (base) return base;
  for (const m of bet.matches || []) {
    const ex = validateMundialMatchExtras(m);
    if (ex) return ex;
  }
  return null;
}

function validateMundialResult(result) {
  const base = validateFutbolResult(result);
  if (base) return base;
  for (const m of result.matches || []) {
    const ex = validateMundialMatchExtras(m);
    if (ex) return ex;
  }
  return null;
}

const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

function generateSessionToken() {
  return randomBytes(32).toString("hex");
}

async function createServerSession(username) {
  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  await putItem(`SESSION#${token}`, "META", { username, createdAt: new Date().toISOString(), expiresAt });
  return token;
}

async function validateSession(token) {
  if (!token || token.length < 16) return null;
  const session = await getItem(`SESSION#${token}`, "META");
  if (!session) return null;
  if (new Date(session.expiresAt).getTime() < Date.now()) {
    deleteItem(`SESSION#${token}`, "META").catch(() => {});
    return null;
  }
  return session.username;
}

function extractBearerToken(hdrs) {
  const auth = hdrs["authorization"] || "";
  return auth.startsWith("Bearer ") ? auth.substring(7).trim() : null;
}

function headers(extra = {}) {
  return {
    "Content-Type": "application/json",
    "X-Content-Type-Options": "nosniff",
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Headers": "content-type,x-porra-group,authorization,accept,if-none-match",
    "Access-Control-Allow-Methods": "GET,PUT,POST,DELETE,OPTIONS",
    "Access-Control-Expose-Headers": "ETag",
    "Cache-Control": "no-store",
    ...extra,
  };
}

function res(code, body) {
  return { statusCode: code, headers: headers(), body: JSON.stringify(body) };
}

function forbidden(msg = "Forbidden") { return res(403, { error: msg }); }
function badReq(msg = "Bad request") { return res(400, { error: msg }); }
function notFound(msg = "Not found") { return res(404, { error: msg }); }

async function getItem(pk, sk) {
  const r = await client.send(new GetCommand({ TableName: TABLE, Key: { pk, sk } }));
  return r.Item || null;
}

async function putItem(pk, sk, data) {
  const { pk: _pk, sk: _sk, ...safeData } = data || {};
  await client.send(new PutCommand({ TableName: TABLE, Item: { pk, sk, ...safeData } }));
}

async function appendToHistory(pk, sk, entry) {
  try {
    await client.send(new UpdateCommand({
      TableName: TABLE,
      Key: { pk, sk },
      UpdateExpression: "SET #log = list_append(if_not_exists(#log, :empty), :entry)",
      ExpressionAttributeNames: { "#log": "log" },
      ExpressionAttributeValues: { ":empty": [], ":entry": [entry] },
    }));
  } catch (err) {
    console.error("appendToHistory fallback to putItem", err);
    const hist = await getItem(pk, sk);
    const log = hist?.log || [];
    log.push(entry);
    await putItem(pk, sk, { log });
  }
}

async function deleteItem(pk, sk) {
  await client.send(new DeleteCommand({ TableName: TABLE, Key: { pk, sk } }));
}

async function queryByPk(pk) {
  let items = [], lastKey;
  do {
    const r = await client.send(new QueryCommand({
      TableName: TABLE,
      KeyConditionExpression: "pk = :pk",
      ExpressionAttributeValues: { ":pk": pk },
      ExclusiveStartKey: lastKey,
    }));
    items = items.concat(r.Items || []);
    lastKey = r.LastEvaluatedKey;
  } while (lastKey);
  return items;
}

async function scanAll() {
  let items = [], lastKey;
  do {
    const r = await client.send(new ScanCommand({
      TableName: TABLE, ExclusiveStartKey: lastKey,
    }));
    items = items.concat(r.Items || []);
    lastKey = r.LastEvaluatedKey;
  } while (lastKey);
  return items;
}

async function batchWriteWithRetry(requestItems, maxRetries = 3) {
  let result = await client.send(new BatchWriteCommand({ RequestItems: requestItems }));
  let unprocessed = result.UnprocessedItems;
  let attempt = 0;
  while (unprocessed && Object.keys(unprocessed).length && attempt < maxRetries) {
    attempt++;
    await new Promise(r => setTimeout(r, attempt * 200));
    result = await client.send(new BatchWriteCommand({ RequestItems: unprocessed }));
    unprocessed = result.UnprocessedItems;
  }
  if (unprocessed && Object.keys(unprocessed).length) {
    console.error("BatchWrite: items no procesados tras reintentos", JSON.stringify(Object.keys(unprocessed)));
    throw new Error(`BatchWrite: ${Object.keys(unprocessed).length} tablas con items no procesados`);
  }
}

async function resolveUser(inputName) {
  if (!inputName) return "";
  const exact = await getItem(`USER#${inputName}`, "PROFILE");
  if (exact) return inputName;
  const capitalized = inputName.charAt(0).toUpperCase() + inputName.slice(1).toLowerCase();
  if (capitalized !== inputName) {
    const cap = await getItem(`USER#${capitalized}`, "PROFILE");
    if (cap) return capitalized;
  }
  return "";
}

async function isAdmin(userName) {
  const user = await getItem(`USER#${userName}`, "PROFILE");
  if (!user) return false;
  if (user.isAdmin) return true;
  const r = user.adminRoles;
  return !!(r?.general || r?.f1 || r?.futbol || r?.mundial);
}

// GET /state - reconstruct full state from DynamoDB
async function getFullState() {
  const items = await scanAll();
  const emptyJornadaPorra = () => ({
    order: [], jornadas: {}, bets: {}, results: {},
    betsWindow: {}, betsReveal: {}, betHistory: {},
  });
  const state = {
    users: {}, participants: {}, bets: {}, results: {},
    betHistory: {}, betsWindow: {}, betsReveal: {},
    scoreAdjustments: {}, questionOwner: {}, questions: {},
    questionsStatus: {}, meta: {}, futbol: emptyJornadaPorra(),
    mundial: emptyJornadaPorra(),
  };

  for (const item of items) {
    const { pk, sk, ...data } = item;

    if (pk === "META" && sk === "CONFIG") {
      Object.assign(state.meta, data);
    } else if (pk === "META" && sk === "OVERRIDES") {
      state.meta.raceOverrides = data.raceOverrides || {};
    } else if (pk === "META" && sk === "AVATARS") {
      state.meta.avatars = data.avatars || {};
    } else if (pk === "META" && sk === "QUESTIONS") {
      state.questionOwner = data.questionOwner || {};
      state.questions = data.questions || {};
      state.questionsStatus = data.questionsStatus || {};
    } else if (pk.startsWith("USER#")) {
      const name = pk.replace("USER#", "");
      state.users[name] = data;
      state.participants[name] = { name, createdAt: data.createdAt };
    } else if (pk.startsWith("F1#") && sk === "RESULT") {
      const raceKey = pk.replace("F1#", "");
      state.results[raceKey] = data;
    } else if (pk.startsWith("F1#") && sk.startsWith("BET#")) {
      const raceKey = pk.replace("F1#", "");
      const userName = sk.replace("BET#", "");
      if (!state.bets[raceKey]) state.bets[raceKey] = {};
      state.bets[raceKey][userName] = data;
    } else if (pk.startsWith("F1#") && sk.startsWith("HISTORY#")) {
      const raceKey = pk.replace("F1#", "");
      const userName = sk.replace("HISTORY#", "");
      if (!state.betHistory[raceKey]) state.betHistory[raceKey] = {};
      state.betHistory[raceKey][userName] = data.log || [];
    } else if (pk.startsWith("F1#") && sk === "WINDOW") {
      const raceKey = pk.replace("F1#", "");
      state.betsWindow[raceKey] = data;
    } else if (pk.startsWith("F1#") && sk === "REVEAL") {
      const raceKey = pk.replace("F1#", "");
      state.betsReveal[raceKey] = data;
    } else if (pk.startsWith("F1#") && sk === "ADJUST") {
      const raceKey = pk.replace("F1#", "");
      state.scoreAdjustments[raceKey] = data.adjustments || {};
    } else if (pk === "FUT" && sk === "CONFIG") {
      state.futbol.order = data.order || [];
      if (data.jornadasV3) state.meta.futbolJornadasV3 = true;
    } else if (pk.startsWith("FUT#") && sk === "CONFIG") {
      const jId = pk.replace("FUT#", "");
      state.futbol.jornadas = state.futbol.jornadas || {};
      state.futbol.jornadas[jId] = data;
    } else if (pk.startsWith("FUT#") && sk === "RESULT") {
      const jId = pk.replace("FUT#", "");
      state.futbol.results[jId] = data;
    } else if (pk.startsWith("FUT#") && sk.startsWith("BET#")) {
      const jId = pk.replace("FUT#", "");
      const userName = sk.replace("BET#", "");
      if (!state.futbol.bets[jId]) state.futbol.bets[jId] = {};
      state.futbol.bets[jId][userName] = data;
    } else if (pk.startsWith("FUT#") && sk.startsWith("HISTORY#")) {
      const jId = pk.replace("FUT#", "");
      const userName = sk.replace("HISTORY#", "");
      if (!state.futbol.betHistory[jId]) state.futbol.betHistory[jId] = {};
      state.futbol.betHistory[jId][userName] = data.log || [];
    } else if (pk.startsWith("FUT#") && sk === "WINDOW") {
      const jId = pk.replace("FUT#", "");
      state.futbol.betsWindow[jId] = data;
    } else if (pk.startsWith("FUT#") && sk === "REVEAL") {
      const jId = pk.replace("FUT#", "");
      state.futbol.betsReveal[jId] = data;
    } else if (pk === "MUN" && sk === "CONFIG") {
      state.mundial.order = data.order || [];
      if (data.mundialSeeded) state.meta.mundialSeeded = true;
    } else if (pk.startsWith("MUN#") && sk === "CONFIG") {
      const jId = pk.replace("MUN#", "");
      state.mundial.jornadas[jId] = data;
    } else if (pk.startsWith("MUN#") && sk === "RESULT") {
      const jId = pk.replace("MUN#", "");
      state.mundial.results[jId] = data;
    } else if (pk.startsWith("MUN#") && sk.startsWith("BET#")) {
      const jId = pk.replace("MUN#", "");
      const userName = sk.replace("BET#", "");
      if (!state.mundial.bets[jId]) state.mundial.bets[jId] = {};
      state.mundial.bets[jId][userName] = data;
    } else if (pk.startsWith("MUN#") && sk.startsWith("HISTORY#")) {
      const jId = pk.replace("MUN#", "");
      const userName = sk.replace("HISTORY#", "");
      if (!state.mundial.betHistory[jId]) state.mundial.betHistory[jId] = {};
      state.mundial.betHistory[jId][userName] = data.log || [];
    } else if (pk.startsWith("MUN#") && sk === "WINDOW") {
      const jId = pk.replace("MUN#", "");
      state.mundial.betsWindow[jId] = data;
    } else if (pk.startsWith("MUN#") && sk === "REVEAL") {
      const jId = pk.replace("MUN#", "");
      state.mundial.betsReveal[jId] = data;
    }
  }

  state.meta.seeded = true;
  return state;
}

// Decompose full state and write to DynamoDB (for migration / PUT /state)
async function writeFullState(state) {
  const ops = [];

  // Meta
  const { avatars, raceOverrides, ...metaRest } = state.meta || {};
  ops.push({ pk: "META", sk: "CONFIG", ...metaRest });
  if (raceOverrides) ops.push({ pk: "META", sk: "OVERRIDES", raceOverrides });
  if (avatars) ops.push({ pk: "META", sk: "AVATARS", avatars });
  ops.push({
    pk: "META", sk: "QUESTIONS",
    questionOwner: state.questionOwner || {},
    questions: state.questions || {},
    questionsStatus: state.questionsStatus || {},
  });

  // Users
  for (const [name, u] of Object.entries(state.users || {})) {
    const createdAt = state.participants?.[name]?.createdAt || u.createdAt;
    ops.push({ pk: `USER#${name}`, sk: "PROFILE", ...u, createdAt });
  }

  // F1 bets & results
  for (const [rk, result] of Object.entries(state.results || {})) {
    ops.push({ pk: `F1#${rk}`, sk: "RESULT", ...result });
  }
  for (const [rk, raceBets] of Object.entries(state.bets || {})) {
    for (const [name, bet] of Object.entries(raceBets || {})) {
      ops.push({ pk: `F1#${rk}`, sk: `BET#${name}`, ...bet });
    }
  }
  for (const [rk, raceHistory] of Object.entries(state.betHistory || {})) {
    for (const [name, log] of Object.entries(raceHistory || {})) {
      ops.push({ pk: `F1#${rk}`, sk: `HISTORY#${name}`, log });
    }
  }
  for (const [rk, w] of Object.entries(state.betsWindow || {})) {
    ops.push({ pk: `F1#${rk}`, sk: "WINDOW", ...w });
  }
  for (const [rk, r] of Object.entries(state.betsReveal || {})) {
    ops.push({ pk: `F1#${rk}`, sk: "REVEAL", ...r });
  }
  for (const [rk, adj] of Object.entries(state.scoreAdjustments || {})) {
    ops.push({ pk: `F1#${rk}`, sk: "ADJUST", adjustments: adj });
  }

  // Futbol
  const fut = state.futbol || {};
  ops.push({ pk: "FUT", sk: "CONFIG", order: fut.order || [], jornadasV3: true });
  for (const [jId, j] of Object.entries(fut.jornadas || {})) {
    ops.push({ pk: `FUT#${jId}`, sk: "CONFIG", ...j });
  }
  for (const [jId, r] of Object.entries(fut.results || {})) {
    ops.push({ pk: `FUT#${jId}`, sk: "RESULT", ...r });
  }
  for (const [jId, jBets] of Object.entries(fut.bets || {})) {
    for (const [name, bet] of Object.entries(jBets || {})) {
      ops.push({ pk: `FUT#${jId}`, sk: `BET#${name}`, ...bet });
    }
  }
  for (const [jId, jHist] of Object.entries(fut.betHistory || {})) {
    for (const [name, log] of Object.entries(jHist || {})) {
      ops.push({ pk: `FUT#${jId}`, sk: `HISTORY#${name}`, log });
    }
  }
  for (const [jId, w] of Object.entries(fut.betsWindow || {})) {
    ops.push({ pk: `FUT#${jId}`, sk: "WINDOW", ...w });
  }
  for (const [jId, r] of Object.entries(fut.betsReveal || {})) {
    ops.push({ pk: `FUT#${jId}`, sk: "REVEAL", ...r });
  }

  const mun = state.mundial || {};
  ops.push({ pk: "MUN", sk: "CONFIG", order: mun.order || [], mundialSeeded: !!state.meta?.mundialSeeded });
  for (const [jId, j] of Object.entries(mun.jornadas || {})) {
    ops.push({ pk: `MUN#${jId}`, sk: "CONFIG", ...j });
  }
  for (const [jId, r] of Object.entries(mun.results || {})) {
    ops.push({ pk: `MUN#${jId}`, sk: "RESULT", ...r });
  }
  for (const [jId, jBets] of Object.entries(mun.bets || {})) {
    for (const [name, bet] of Object.entries(jBets || {})) {
      ops.push({ pk: `MUN#${jId}`, sk: `BET#${name}`, ...bet });
    }
  }
  for (const [jId, jHist] of Object.entries(mun.betHistory || {})) {
    for (const [name, log] of Object.entries(jHist || {})) {
      ops.push({ pk: `MUN#${jId}`, sk: `HISTORY#${name}`, log });
    }
  }
  for (const [jId, w] of Object.entries(mun.betsWindow || {})) {
    ops.push({ pk: `MUN#${jId}`, sk: "WINDOW", ...w });
  }
  for (const [jId, r] of Object.entries(mun.betsReveal || {})) {
    ops.push({ pk: `MUN#${jId}`, sk: "REVEAL", ...r });
  }

  for (let i = 0; i < ops.length; i += 25) {
    const batch = ops.slice(i, i + 25).map(item => ({
      PutRequest: { Item: item },
    }));
    await batchWriteWithRetry({ [TABLE]: batch });
  }

  return ops.length;
}

// ─── Route handlers ───

async function resolveF1Deadline(pkPrefix, raceKey, clientDeadline, getItemFn, putItemFn) {
  const windowData = await getItemFn(pkPrefix, raceKey, "WINDOW");
  if (windowData?.forceClosed) return { blocked: true };
  if (windowData?.deadline) return { deadline: new Date(windowData.deadline) };
  const deadlineItem = await getItemFn(pkPrefix, raceKey, "DEADLINE");
  if (deadlineItem?.deadline) return { deadline: new Date(deadlineItem.deadline) };
  if (clientDeadline) {
    await putItemFn(pkPrefix, raceKey, "DEADLINE", { deadline: clientDeadline });
    return { deadline: new Date(clientDeadline) };
  }
  return { deadline: null };
}

function computeDeadlineFromKickoffs(jornadaConfig) {
  const matches = jornadaConfig?.matches;
  if (!matches?.length) return null;
  const kickoffs = matches.map(m => m.kickoff ? new Date(m.kickoff).getTime() : NaN).filter(t => !Number.isNaN(t));
  if (!kickoffs.length) return null;
  return new Date(Math.min(...kickoffs) - 60_000);
}

async function resolveFutbolDeadline(pkPrefix, jornadaId, getItemFn) {
  const windowData = await getItemFn(pkPrefix, jornadaId, "WINDOW");
  if (windowData?.forceClosed) return { blocked: true };
  const jornadaConfig = await getItemFn(pkPrefix, jornadaId, "CONFIG");
  const kickoffDeadline = computeDeadlineFromKickoffs(jornadaConfig);
  if (kickoffDeadline) return { deadline: kickoffDeadline };
  if (jornadaConfig?.deadline) return { deadline: new Date(jornadaConfig.deadline) };
  return { deadline: null };
}

async function handleSaveBetF1(raceKey, reqUser, body) {
  if (!raceKey || !reqUser) { log("warn", "bet_f1_reject", { reason: "missing_params", raceKey, user: reqUser }); return badReq("Faltan raceKey o user"); }
  if (!isValidId(raceKey)) { log("warn", "bet_f1_reject", { reason: "invalid_raceKey", raceKey, user: reqUser }); return badReq("raceKey inválido"); }
  if (isCancelledF1RaceKey(raceKey)) { log("warn", "bet_f1_reject", { reason: "cancelled", raceKey, user: reqUser }); return badReq("Gran Premio cancelado — no se admiten apuestas"); }
  const bet = body.bet || body;
  if (!bet.pole && (!bet.podium || !Array.isArray(bet.podium))) { log("warn", "bet_f1_reject", { reason: "incomplete", raceKey, user: reqUser }); return badReq("Bet data incompleta"); }
  const f1Err = validateF1Bet(bet);
  if (f1Err) { log("warn", "bet_f1_reject", { reason: "validation", raceKey, user: reqUser, detail: f1Err }); return badReq(f1Err); }

  const dl = await resolveF1Deadline("F1#", raceKey, body.deadline,
    (_, rk, sk) => getItem(`F1#${rk}`, sk),
    (_, rk, sk, data) => putItem(`F1#${rk}`, sk, data));
  if (dl.blocked) { log("warn", "bet_f1_reject", { reason: "closed", raceKey, user: reqUser }); return forbidden("Las apuestas están cerradas por el admin"); }

  const serverNow = new Date();
  const late = dl.deadline ? serverNow >= dl.deadline : false;
  const ts = serverNow.toISOString();
  const tt = sanitizeTrashtalk(bet);
  const betData = {
    pole: bet.pole || "", podium: bet.podium || ["", "", ""],
    q: bet.q || ["", "", ""], submittedAt: ts, late,
  };
  if (tt) betData.trashtalk = tt;

  await putItem(`F1#${raceKey}`, `BET#${reqUser}`, betData);
  await appendToHistory(`F1#${raceKey}`, `HISTORY#${reqUser}`, { ts, pole: betData.pole, podium: betData.podium, q: betData.q, late });

  log("info", "bet_f1_saved", { raceKey, user: reqUser, late, pole: betData.pole });
  return res(200, { ok: true, submittedAt: ts, late });
}

async function handleSaveBetFutbol(jornadaId, reqUser, body) {
  if (!jornadaId || !reqUser) { log("warn", "bet_futbol_reject", { reason: "missing_params", jornadaId, user: reqUser }); return badReq("Faltan jornadaId o user"); }
  if (!isValidId(jornadaId)) { log("warn", "bet_futbol_reject", { reason: "invalid_jornadaId", jornadaId, user: reqUser }); return badReq("jornadaId inválido"); }
  const bet = body.bet || body;
  const futErr = validateFutbolBet(bet);
  if (futErr) { log("warn", "bet_futbol_reject", { reason: "validation", jornadaId, user: reqUser, detail: futErr }); return badReq(futErr); }

  const dl = await resolveFutbolDeadline("FUT#", jornadaId,
    (_, jId, sk) => getItem(`FUT#${jId}`, sk));
  if (dl.blocked) { log("warn", "bet_futbol_reject", { reason: "closed", jornadaId, user: reqUser }); return forbidden("Las apuestas están cerradas por el admin"); }

  const serverNow = new Date();
  const late = dl.deadline ? serverNow >= dl.deadline : false;
  const ts = serverNow.toISOString();
  const tt = sanitizeTrashtalk(bet);
  const betData = { matches: bet.matches || [], submittedAt: ts, late };
  if (tt) betData.trashtalk = tt;

  await putItem(`FUT#${jornadaId}`, `BET#${reqUser}`, betData);
  await appendToHistory(`FUT#${jornadaId}`, `HISTORY#${reqUser}`, { ts, matches: betData.matches, late });

  log("info", "bet_futbol_saved", { jornadaId, user: reqUser, late, matchCount: betData.matches.length });
  return res(200, { ok: true, submittedAt: ts, late });
}

async function handleSaveBetMundial(jornadaId, reqUser, body) {
  if (!jornadaId || !reqUser) { log("warn", "bet_mundial_reject", { reason: "missing_params", jornadaId, user: reqUser }); return badReq("Faltan jornadaId o user"); }
  if (!isValidId(jornadaId)) { log("warn", "bet_mundial_reject", { reason: "invalid_jornadaId", jornadaId, user: reqUser }); return badReq("jornadaId inválido"); }
  const bet = body.bet || body;
  const munErr = validateMundialBet(bet);
  if (munErr) { log("warn", "bet_mundial_reject", { reason: "validation", jornadaId, user: reqUser, detail: munErr }); return badReq(munErr); }

  const dl = await resolveFutbolDeadline("MUN#", jornadaId, (_, jId, sk) => getItem(`MUN#${jId}`, sk));
  if (dl.blocked) { log("warn", "bet_mundial_reject", { reason: "closed", jornadaId, user: reqUser }); return forbidden("Las apuestas están cerradas por el admin"); }

  const serverNow = new Date();
  const late = dl.deadline ? serverNow >= dl.deadline : false;
  const ts = serverNow.toISOString();
  const tt = sanitizeTrashtalk(bet);
  const betData = { matches: bet.matches || [], submittedAt: ts, late };
  if (tt) betData.trashtalk = tt;

  await putItem(`MUN#${jornadaId}`, `BET#${reqUser}`, betData);
  await appendToHistory(`MUN#${jornadaId}`, `HISTORY#${reqUser}`, { ts, matches: betData.matches, late });

  log("info", "bet_mundial_saved", { jornadaId, user: reqUser, late, matchCount: betData.matches.length });
  return res(200, { ok: true, submittedAt: ts, late });
}

async function handleSaveResultMundial(jornadaId, reqUser, body) {
  if (!(await isAdmin(reqUser))) return forbidden("Solo admin puede guardar resultados");
  if (!jornadaId) return badReq("Falta jornadaId");
  if (!isValidId(jornadaId)) return badReq("jornadaId inválido");
  const { pk: _pk, sk: _sk, ...resultData } = body.result || body;
  const resErr = validateMundialResult(resultData);
  if (resErr) return badReq(resErr);
  await putItem(`MUN#${jornadaId}`, "RESULT", resultData);
  return res(200, { ok: true });
}

async function handleAdminMundial(jornadaId, reqUser, body) {
  if (!(await isAdmin(reqUser))) return forbidden("Solo admin");
  const { type, data } = body;
  if (!type) return badReq("Falta type");
  if (!isValidId(jornadaId)) return badReq("jornadaId inválido");

  switch (type) {
    case "jornada": {
      const saved = data || {};
      await putItem(`MUN#${jornadaId}`, "CONFIG", saved);
      if (saved?.order) {
        const munConf = await getItem("MUN", "CONFIG") || {};
        await putItem("MUN", "CONFIG", { ...munConf, order: saved.order });
      }
      log("info", "mundial_jornada_saved", { jornadaId });
      return res(200, { ok: true, jornada: saved });
    }
    case "window":
      await putItem(`MUN#${jornadaId}`, "WINDOW", data || {});
      break;
    case "reveal":
      await putItem(`MUN#${jornadaId}`, "REVEAL", data || {});
      break;
    case "bet": {
      const { userName, bet } = data;
      if (!userName) return badReq("Falta userName");
      if (!isValidUserName(userName)) return badReq("Nombre de usuario no válido");
      const admErr = validateMundialBet(bet || {});
      if (admErr) return badReq(admErr);
      await putItem(`MUN#${jornadaId}`, `BET#${userName}`, normalizeBetTrashtalk(bet));
      break;
    }
    case "delete": {
      const items = await queryByPk(`MUN#${jornadaId}`);
      for (const item of items) await deleteItem(item.pk, item.sk);
      break;
    }
    default:
      return badReq(`Tipo desconocido: ${type}`);
  }
  return res(200, { ok: true });
}

async function handleSaveResultF1(raceKey, reqUser, body) {
  if (!(await isAdmin(reqUser))) return forbidden("Solo admin puede guardar resultados");
  if (!raceKey) return badReq("Falta raceKey");
  if (!isValidId(raceKey)) return badReq("raceKey inválido");
  if (isCancelledF1RaceKey(raceKey)) return badReq("Gran Premio cancelado — no se publican resultados");
  const result = body.result || body;
  const resErr = validateF1Result(result);
  if (resErr) return badReq(resErr);
  await putItem(`F1#${raceKey}`, "RESULT", {
    pole: result.pole || "", podium: result.podium || ["", "", ""],
  });
  return res(200, { ok: true });
}

async function handleSaveResultFutbol(jornadaId, reqUser, body) {
  if (!(await isAdmin(reqUser))) return forbidden("Solo admin puede guardar resultados");
  if (!jornadaId) return badReq("Falta jornadaId");
  if (!isValidId(jornadaId)) return badReq("jornadaId inválido");
  const { pk: _pk, sk: _sk, ...resultData } = body.result || body;
  const resErr = validateFutbolResult(resultData);
  if (resErr) return badReq(resErr);
  await putItem(`FUT#${jornadaId}`, "RESULT", resultData);
  return res(200, { ok: true });
}

async function handleUpdateUser(targetUser, reqUser, body) {
  if (!isValidUserName(targetUser)) return badReq("Nombre de usuario no válido");
  if (reqUser !== targetUser && !(await isAdmin(reqUser))) {
    return forbidden("Solo puedes modificar tu propio perfil");
  }
  const existing = await getItem(`USER#${targetUser}`, "PROFILE");
  if (!existing) return notFound("Usuario no encontrado");

  const updates = body.updates || body;
  const allowed = ["passwordHash", "mustChange", "avatar"];
  if (await isAdmin(reqUser)) allowed.push("isAdmin", "blocked", "porras", "adminRoles");

  const merged = { ...existing };
  for (const key of allowed) {
    if (updates[key] !== undefined) merged[key] = updates[key];
  }
  merged.name = targetUser;

  await putItem(`USER#${targetUser}`, "PROFILE", merged);
  return res(200, { ok: true });
}

async function handleSaveMeta(reqUser, body) {
  if (!(await isAdmin(reqUser))) return forbidden("Solo admin");
  const meta = body.meta || body;
  const { avatars, raceOverrides, ...metaRest } = meta;

  if (metaRest && Object.keys(metaRest).length) {
    const existing = await getItem("META", "CONFIG") || {};
    await putItem("META", "CONFIG", { ...existing, ...metaRest });
  }
  if (raceOverrides !== undefined) {
    await putItem("META", "OVERRIDES", { raceOverrides });
  }
  if (avatars !== undefined) {
    await putItem("META", "AVATARS", { avatars });
  }
  return res(200, { ok: true });
}

async function handleAdminF1(raceKey, reqUser, body) {
  if (!(await isAdmin(reqUser))) return forbidden("Solo admin");
  const { type, data } = body;
  if (!type) return badReq("Falta type");
  if (!isValidId(raceKey)) return badReq("raceKey inválido");
  if (type !== "questions" && isCancelledF1RaceKey(raceKey)) {
    return badReq("Gran Premio cancelado — no se puede modificar desde la API");
  }

  switch (type) {
    case "window":
      await putItem(`F1#${raceKey}`, "WINDOW", data || {});
      break;
    case "reveal":
      await putItem(`F1#${raceKey}`, "REVEAL", data || {});
      break;
    case "adjust":
      await putItem(`F1#${raceKey}`, "ADJUST", { adjustments: data || {} });
      break;
    case "bet": {
      const { userName, bet } = data;
      if (!userName) return badReq("Falta userName");
      if (!isValidUserName(userName)) return badReq("Nombre de usuario no válido");
      const admF1Err = validateF1Bet(bet || {});
      if (admF1Err) return badReq(admF1Err);
      await putItem(`F1#${raceKey}`, `BET#${userName}`, normalizeBetTrashtalk(bet));
      break;
    }
    case "questions": {
      const existingQ = await getItem("META", "QUESTIONS") || {};
      await putItem("META", "QUESTIONS", { ...existingQ, ...data });
      break;
    }
    default:
      return badReq(`Tipo desconocido: ${type}`);
  }
  return res(200, { ok: true });
}

async function handleAdminFutbol(jornadaId, reqUser, body) {
  if (!(await isAdmin(reqUser))) return forbidden("Solo admin");
  const { type, data } = body;
  if (!type) return badReq("Falta type");
  if (!isValidId(jornadaId)) return badReq("jornadaId inválido");

  let responseExtra = null;

  switch (type) {
    case "jornada": {
      const raw = data || {};
      const { data: saved, meta } = await enrichFutbolJornadaMatchesFromApi(raw, {
        token: process.env.FOOTBALL_DATA_ORG_TOKEN || "",
        competitionId: process.env.FOOTBALL_DATA_COMPETITION_ID,
        futureDays: Number(process.env.FOOTBALL_DATA_DATE_RANGE_DAYS) || 21,
      });
      await putItem(`FUT#${jornadaId}`, "CONFIG", saved);
      if (saved?.order) {
        const futConf = await getItem("FUT", "CONFIG") || {};
        await putItem("FUT", "CONFIG", { ...futConf, order: saved.order });
      }
      log("info", "futbol_jornada_saved", { jornadaId, kickoffEnrichment: meta });
      responseExtra = { kickoffEnrichment: meta, jornada: saved };
      break;
    }
    case "window":
      await putItem(`FUT#${jornadaId}`, "WINDOW", data || {});
      break;
    case "reveal":
      await putItem(`FUT#${jornadaId}`, "REVEAL", data || {});
      break;
    case "bet": {
      const { userName, bet } = data;
      if (!userName) return badReq("Falta userName");
      if (!isValidUserName(userName)) return badReq("Nombre de usuario no válido");
      const admFutErr = validateFutbolBet(bet || {});
      if (admFutErr) return badReq(admFutErr);
      await putItem(`FUT#${jornadaId}`, `BET#${userName}`, normalizeBetTrashtalk(bet));
      break;
    }
    case "delete": {
      const items = await queryByPk(`FUT#${jornadaId}`);
      for (const item of items) {
        await deleteItem(item.pk, item.sk);
      }
      break;
    }
    default:
      return badReq(`Tipo desconocido: ${type}`);
  }
  return res(200, responseExtra ? { ok: true, ...responseExtra } : { ok: true });
}

async function handleAddUser(reqUser, body) {
  if (!(await isAdmin(reqUser))) return forbidden("Solo admin");
  const { name, passwordHash, isAdmin: isAdm, porras } = body;
  if (!name) return badReq("Falta nombre");
  if (!isValidUserName(name)) return badReq("Nombre contiene caracteres no válidos");
  const existing = await getItem(`USER#${name}`, "PROFILE");
  if (existing) return badReq("El usuario ya existe");
  await putItem(`USER#${name}`, "PROFILE", {
    name, passwordHash: passwordHash || "", mustChange: true,
    isAdmin: !!isAdm, blocked: false, createdAt: new Date().toISOString(),
    porras: porras || { f1: true, futbol: true },
  });
  return res(200, { ok: true });
}

async function handleDeleteUser(targetUser, reqUser) {
  if (!isValidUserName(targetUser)) return badReq("Nombre de usuario no válido");
  if (!(await isAdmin(reqUser))) return forbidden("Solo admin");
  if (reqUser === targetUser) return badReq("No puedes eliminarte a ti mismo");
  await deleteItem(`USER#${targetUser}`, "PROFILE");
  const allItems = await scanAll();
  const userBets = allItems.filter(i =>
    (i.sk === `BET#${targetUser}`) || (i.sk === `HISTORY#${targetUser}`)
  );
  for (const item of userBets) await deleteItem(item.pk, item.sk);
  return res(200, { ok: true });
}

// ─── Group management ───

function generateCode(len = 8) {
  const chars = "abcdefghijkmnpqrstuvwxyz23456789";
  let code = "";
  const bytes = randomBytes(len);
  for (let i = 0; i < len; i++) code += chars[bytes[i] % chars.length];
  return code;
}

async function handleCreateGroup(body) {
  const { name, adminUser, adminPasswordHash, sports } = body;
  if (!name?.trim()) return badReq("Falta nombre del grupo");
  if (!adminUser?.trim()) return badReq("Falta nombre de admin");
  if (!adminPasswordHash) return badReq("Falta contraseña");
  if (!Array.isArray(sports) || !sports.length) return badReq("Selecciona al menos un deporte");
  const validSports = ["f1", "futbol"];
  if (sports.some(s => !validSports.includes(s))) return badReq("Deporte no válido");
  if (name.trim().length > 100) return badReq("Nombre de grupo demasiado largo");
  if (adminUser.trim().length > 50) return badReq("Nombre de admin demasiado largo");
  if (!isValidUserName(adminUser.trim())) return badReq("Nombre de admin contiene caracteres no válidos");

  const groupId = generateCode(10);
  const inviteCode = generateCode(8);
  const now = new Date().toISOString();

  await putItem("GROUPS", `G#${groupId}`, {
    name: name.trim(), groupId, inviteCode, sports,
    createdAt: now, adminUser: adminUser.trim(), memberCount: 1,
  });
  await putItem(`INVITE#${inviteCode}`, "META", { groupId, groupName: name.trim() });

  const gpk = `G#${groupId}`;
  await putItem(gpk, "META|CONFIG", {
    adminSecretHash: adminPasswordHash, seeded: true,
    drivers: [], teams: [], championships: {}, basePoints: {},
  });
  await putItem(gpk, `USER#${adminUser.trim()}|PROFILE`, {
    name: adminUser.trim(), passwordHash: adminPasswordHash,
    mustChange: false, isAdmin: true, blocked: false, createdAt: now,
    porras: { f1: sports.includes("f1"), futbol: sports.includes("futbol") },
  });
  await writeUIDX(adminUser.trim(), groupId, name.trim());

  return res(201, { ok: true, groupId, inviteCode, name: name.trim() });
}

async function handleGetInvite(code) {
  if (!code || code.length > 50 || !/^[a-zA-Z0-9_-]+$/.test(code)) return badReq("Formato de código inválido");
  const item = await getItem(`INVITE#${code}`, "META");
  if (!item) return notFound("Código de invitación no válido");
  return res(200, { groupId: item.groupId, groupName: item.groupName });
}

async function handleJoinGroup(groupId, body) {
  const { name, passwordHash, inviteCode } = body;
  if (!name?.trim()) return badReq("Falta nombre de usuario");
  if (!passwordHash) return badReq("Falta contraseña");
  if (!inviteCode) return badReq("Falta código de invitación");
  if (!isValidUserName(name.trim())) return badReq("Nombre de usuario contiene caracteres no válidos");

  const groupMeta = await getItem("GROUPS", `G#${groupId}`);
  if (!groupMeta) return notFound("Grupo no encontrado");
  if (groupMeta.inviteCode !== inviteCode) return forbidden("Código de invitación incorrecto");

  const gpk = `G#${groupId}`;
  const trimmedName = name.trim();
  const now = new Date().toISOString();
  try {
    await client.send(new PutCommand({
      TableName: TABLE,
      Item: {
        pk: gpk, sk: `USER#${trimmedName}|PROFILE`,
        name: trimmedName, passwordHash, mustChange: false,
        isAdmin: false, blocked: false, createdAt: now,
        porras: { f1: (groupMeta.sports || []).includes("f1"), futbol: (groupMeta.sports || []).includes("futbol") },
      },
      ConditionExpression: "attribute_not_exists(pk)",
    }));
  } catch (err) {
    if (err.name === "ConditionalCheckFailedException") return badReq("No se pudo completar el registro. Prueba con otro nombre.");
    throw err;
  }
  await writeUIDX(name.trim(), groupId, groupMeta.name);

  try {
    await client.send(new UpdateCommand({
      TableName: TABLE,
      Key: { pk: "GROUPS", sk: `G#${groupId}` },
      UpdateExpression: "ADD memberCount :inc",
      ExpressionAttributeValues: { ":inc": 1 },
    }));
  } catch {
    const updated = { ...groupMeta, memberCount: (groupMeta.memberCount || 1) + 1 };
    await putItem("GROUPS", `G#${groupId}`, updated);
  }

  return res(200, { ok: true, groupId, userName: name.trim() });
}

async function getGroupState(groupId) {
  const items = await queryByPk(`G#${groupId}`);
  const emptyJornadaPorra = () => ({
    order: [], jornadas: {}, bets: {}, results: {},
    betsWindow: {}, betsReveal: {}, betHistory: {},
  });
  const state = {
    users: {}, participants: {}, bets: {}, results: {},
    betHistory: {}, betsWindow: {}, betsReveal: {},
    scoreAdjustments: {}, questionOwner: {}, questions: {},
    questionsStatus: {}, meta: {}, futbol: emptyJornadaPorra(),
    mundial: emptyJornadaPorra(),
  };

  for (const item of items) {
    const { pk: _pk, sk, ...data } = item;
    const pipeIdx = sk.indexOf("|");
    if (pipeIdx === -1) continue;
    const ePk = sk.substring(0, pipeIdx);
    const eSk = sk.substring(pipeIdx + 1);

    if (ePk === "META" && eSk === "CONFIG") {
      Object.assign(state.meta, data);
    } else if (ePk === "META" && eSk === "OVERRIDES") {
      state.meta.raceOverrides = data.raceOverrides || {};
    } else if (ePk === "META" && eSk === "AVATARS") {
      state.meta.avatars = data.avatars || {};
    } else if (ePk === "META" && eSk === "QUESTIONS") {
      state.questionOwner = data.questionOwner || {};
      state.questions = data.questions || {};
      state.questionsStatus = data.questionsStatus || {};
    } else if (ePk.startsWith("USER#")) {
      const name = ePk.replace("USER#", "");
      state.users[name] = data;
      state.participants[name] = { name, createdAt: data.createdAt };
    } else if (ePk.startsWith("F1#") && eSk === "RESULT") {
      state.results[ePk.replace("F1#", "")] = data;
    } else if (ePk.startsWith("F1#") && eSk.startsWith("BET#")) {
      const rk = ePk.replace("F1#", "");
      if (!state.bets[rk]) state.bets[rk] = {};
      state.bets[rk][eSk.replace("BET#", "")] = data;
    } else if (ePk.startsWith("F1#") && eSk.startsWith("HISTORY#")) {
      const rk = ePk.replace("F1#", "");
      if (!state.betHistory[rk]) state.betHistory[rk] = {};
      state.betHistory[rk][eSk.replace("HISTORY#", "")] = data.log || [];
    } else if (ePk.startsWith("F1#") && eSk === "WINDOW") {
      state.betsWindow[ePk.replace("F1#", "")] = data;
    } else if (ePk.startsWith("F1#") && eSk === "REVEAL") {
      state.betsReveal[ePk.replace("F1#", "")] = data;
    } else if (ePk.startsWith("F1#") && eSk === "ADJUST") {
      state.scoreAdjustments[ePk.replace("F1#", "")] = data.adjustments || {};
    } else if (ePk === "FUT" && eSk === "CONFIG") {
      state.futbol.order = data.order || [];
      if (data.jornadasV3) state.meta.futbolJornadasV3 = true;
    } else if (ePk.startsWith("FUT#") && eSk === "CONFIG") {
      state.futbol.jornadas[ePk.replace("FUT#", "")] = data;
    } else if (ePk.startsWith("FUT#") && eSk === "RESULT") {
      state.futbol.results[ePk.replace("FUT#", "")] = data;
    } else if (ePk.startsWith("FUT#") && eSk.startsWith("BET#")) {
      const jId = ePk.replace("FUT#", "");
      if (!state.futbol.bets[jId]) state.futbol.bets[jId] = {};
      state.futbol.bets[jId][eSk.replace("BET#", "")] = data;
    } else if (ePk.startsWith("FUT#") && eSk.startsWith("HISTORY#")) {
      const jId = ePk.replace("FUT#", "");
      if (!state.futbol.betHistory[jId]) state.futbol.betHistory[jId] = {};
      state.futbol.betHistory[jId][eSk.replace("HISTORY#", "")] = data.log || [];
    } else if (ePk.startsWith("FUT#") && eSk === "WINDOW") {
      state.futbol.betsWindow[ePk.replace("FUT#", "")] = data;
    } else if (ePk.startsWith("FUT#") && eSk === "REVEAL") {
      state.futbol.betsReveal[ePk.replace("FUT#", "")] = data;
    } else if (ePk === "MUN" && eSk === "CONFIG") {
      state.mundial.order = data.order || [];
      if (data.mundialSeeded) state.meta.mundialSeeded = true;
    } else if (ePk.startsWith("MUN#") && eSk === "CONFIG") {
      state.mundial.jornadas[ePk.replace("MUN#", "")] = data;
    } else if (ePk.startsWith("MUN#") && eSk === "RESULT") {
      state.mundial.results[ePk.replace("MUN#", "")] = data;
    } else if (ePk.startsWith("MUN#") && eSk.startsWith("BET#")) {
      const jId = ePk.replace("MUN#", "");
      if (!state.mundial.bets[jId]) state.mundial.bets[jId] = {};
      state.mundial.bets[jId][eSk.replace("BET#", "")] = data;
    } else if (ePk.startsWith("MUN#") && eSk.startsWith("HISTORY#")) {
      const jId = ePk.replace("MUN#", "");
      if (!state.mundial.betHistory[jId]) state.mundial.betHistory[jId] = {};
      state.mundial.betHistory[jId][eSk.replace("HISTORY#", "")] = data.log || [];
    } else if (ePk.startsWith("MUN#") && eSk === "WINDOW") {
      state.mundial.betsWindow[ePk.replace("MUN#", "")] = data;
    } else if (ePk.startsWith("MUN#") && eSk === "REVEAL") {
      state.mundial.betsReveal[ePk.replace("MUN#", "")] = data;
    }
  }

  state.meta.seeded = true;
  return state;
}

async function resolveUserInGroup(groupId, inputName) {
  if (!inputName) return "";
  const gpk = `G#${groupId}`;
  const exact = await getItem(gpk, `USER#${inputName}|PROFILE`);
  if (exact) return inputName;
  const items = await queryByPk(gpk);
  const userItems = items.filter(i => i.sk.startsWith("USER#") && i.sk.endsWith("|PROFILE"));
  const match = userItems.find(i => {
    const name = i.sk.substring(5, i.sk.indexOf("|"));
    return name.toLowerCase() === inputName.trim().toLowerCase();
  });
  return match ? match.sk.substring(5, match.sk.indexOf("|")) : "";
}

async function isAdminInGroup(groupId, userName) {
  const user = await getItem(`G#${groupId}`, `USER#${userName}|PROFILE`);
  if (!user) return false;
  if (user.isAdmin) return true;
  const r = user.adminRoles;
  return !!(r?.general || r?.f1 || r?.futbol || r?.mundial);
}

// Group-aware item helpers
async function gGetItem(gid, oldPk, oldSk) { return getItem(`G#${gid}`, `${oldPk}|${oldSk}`); }
async function gPutItem(gid, oldPk, oldSk, data) { return putItem(`G#${gid}`, `${oldPk}|${oldSk}`, data); }
async function gDeleteItem(gid, oldPk, oldSk) { return deleteItem(`G#${gid}`, `${oldPk}|${oldSk}`); }

// ─── User Index (UIDX) — maps username → groups ───

async function writeUIDX(username, groupId, groupName) {
  await putItem(`UIDX#${username.trim().toLowerCase()}`, `G#${groupId}`, {
    groupId, groupName: groupName || "",
    joinedAt: new Date().toISOString(),
    username: username.trim(),
  });
}

async function deleteUIDX(username, groupId) {
  await deleteItem(`UIDX#${username.trim().toLowerCase()}`, `G#${groupId}`);
}

async function getUserGroups(username) {
  const items = await queryByPk(`UIDX#${username.trim().toLowerCase()}`);
  return items.map(i => ({
    groupId: i.groupId,
    groupName: i.groupName || "",
    joinedAt: i.joinedAt || "",
    username: i.username || username.trim(),
  })).sort((a, b) => (a.joinedAt || "").localeCompare(b.joinedAt || ""));
}

async function handleAuthLogin(body) {
  const { username, passwordHash } = body;
  if (!username?.trim()) { log("warn", "auth_reject", { reason: "no_username" }); return badReq("Falta nombre de usuario"); }
  if (!passwordHash) { log("warn", "auth_reject", { reason: "no_password", user: username.trim() }); return badReq("Falta contraseña"); }
  const groups = await getUserGroups(username.trim());
  if (!groups.length) { log("warn", "auth_reject", { reason: "no_groups", user: username.trim() }); return res(401, { error: "Credenciales incorrectas" }); }
  const validGroups = [];
  let canonicalName = username.trim();
  for (const g of groups) {
    const input = username.trim();
    const cap = input.charAt(0).toUpperCase() + input.slice(1).toLowerCase();
    const namesToTry = [...new Set([cap, input, g.username])];
    for (const tryName of namesToTry) {
      const profile = await gGetItem(g.groupId, `USER#${tryName}`, "PROFILE");
      if (!profile || profile.blocked) continue;
      if (profile.passwordHash === passwordHash) {
        canonicalName = profile.name || tryName;
        validGroups.push({
          groupId: g.groupId,
          groupName: g.groupName,
          joinedAt: g.joinedAt,
          mustChange: !!profile.mustChange,
        });
        break;
      }
    }
  }
  if (!validGroups.length) { log("warn", "auth_fail", { user: username.trim(), groupCount: groups.length }); return res(401, { error: "Credenciales incorrectas" }); }
  log("info", "auth_login", { user: canonicalName, groupCount: validGroups.length });
  const sessionToken = await createServerSession(canonicalName);
  return res(200, { username: canonicalName, groups: validGroups, sessionToken });
}

// ─── Main handler ───

/** Login/verify desde el navegador no envían x-porra-secret; el secreto es solo para scripts/backend. */
function isPublicPasswordAuthRoute(method, segments) {
  if (method !== "POST") return false;
  if (segments[0] === "auth" && (segments[1] === "login" || segments[1] === "verify")) return true;
  if (segments.length >= 3 && segments[1] === "auth" && (segments[2] === "login" || segments[2] === "verify")) {
    return true;
  }
  return false;
}

export const handler = async (event) => {
  const method = event.requestContext?.http?.method || event.httpMethod || "GET";
  const rawPath = event.requestContext?.http?.path || event.rawPath || event.path || "/";
  const hdrs = Object.fromEntries(
    Object.entries(event.headers || {}).map(([k, v]) => [k.toLowerCase(), v])
  );
  const path = rawPath.replace(/\/+$/, "") || "/";
  const segments = path.split("/").filter(Boolean);

  if (method === "OPTIONS") return { statusCode: 204, headers: headers(), body: "" };

  if (ALLOWED_ORIGIN !== "*") {
    const reqOrigin = hdrs["origin"] || "";
    if (reqOrigin && reqOrigin !== ALLOWED_ORIGIN) {
      return res(403, { error: "Origin no permitido" });
    }
  }

  if (API_SECRET && !isPublicPasswordAuthRoute(method, segments)) {
    if (hdrs["x-porra-secret"] !== API_SECRET) return forbidden("API secret invalido");
  }

  const bearerToken = extractBearerToken(hdrs);
  let rawUser = "";
  if (bearerToken) {
    const sessionUser = await validateSession(bearerToken);
    if (!sessionUser) { log("warn", "session_expired", { ip: event.requestContext?.http?.sourceIp || "unknown", method, path }); return res(401, { error: "Sesión expirada. Vuelve a iniciar sesión." }); }
    rawUser = sessionUser;
  }

  let body = {};
  if (event.body) {
    try { body = JSON.parse(event.body); } catch { return badReq("JSON invalido"); }
  }

  const clientIp = event.requestContext?.http?.sourceIp || event.requestContext?.identity?.sourceIp || "unknown";
  if (method === "PUT" || method === "DELETE") {
    if (!checkRateLimit(`write:${clientIp}`, WRITE_RATE_MAX)) {
      return res(429, { error: "Demasiadas peticiones. Espera un momento." });
    }
  }

  try {
    // GET /state (legacy, admin-only — deprecated in favor of /g/{gid}/state)
    if (method === "GET" && path === "/state") {
      if (!rawUser) return forbidden("Autenticación requerida");
      const reqUser = await resolveUser(rawUser);
      if (!(await isAdmin(reqUser))) return forbidden("Solo admin puede acceder al estado legacy");
      const state = await getFullState();
      return res(200, sanitizeState(state));
    }

    // PUT /state (admin-only, preserves existing passwordHash)
    if (method === "PUT" && path === "/state") {
      const reqUser = rawUser ? await resolveUser(rawUser) : "";
      if (!(await isAdmin(reqUser))) return forbidden("Solo admin puede sobrescribir estado");
      for (const [name, u] of Object.entries(body.users || {})) {
        if (!u.passwordHash) {
          const existing = await getItem(`USER#${name}`, "PROFILE");
          if (existing?.passwordHash) u.passwordHash = existing.passwordHash;
        }
      }
      const count = await writeFullState(body);
      return res(200, { ok: true, items: count });
    }

    // POST /auth/login
    if (method === "POST" && segments[0] === "auth" && segments[1] === "login") {
      if (!checkRateLimit(`login:${clientIp}`)) {
        return res(429, { error: "Demasiados intentos. Espera un minuto." });
      }
      return await handleAuthLogin(body);
    }
    // POST /auth/verify — server-side password verification
    if (method === "POST" && segments[0] === "auth" && segments[1] === "verify") {
      if (!checkRateLimit(`verify:${clientIp}`)) {
        return res(429, { error: "Demasiados intentos. Espera un minuto." });
      }
      const { username, passwordHash, groupId } = body;
      if (!username?.trim() || !passwordHash) return badReq("Faltan datos");
      if (groupId) {
        if (!isValidId(groupId)) return badReq("groupId inválido");
        const resolved = await resolveUserInGroup(groupId, username.trim());
        if (!resolved) return res(200, { valid: false });
        const profile = await gGetItem(groupId, `USER#${resolved}`, "PROFILE");
        return res(200, { valid: !!(profile && profile.passwordHash === passwordHash) });
      }
      const groups = await getUserGroups(username.trim());
      for (const g of groups) {
        const input = username.trim();
        const cap = input.charAt(0).toUpperCase() + input.slice(1).toLowerCase();
        const namesToTry = [...new Set([cap, input, g.username])];
        for (const tryName of namesToTry) {
          const profile = await gGetItem(g.groupId, `USER#${tryName}`, "PROFILE");
          if (profile && profile.passwordHash === passwordHash) return res(200, { valid: true });
        }
      }
      return res(200, { valid: false });
    }
    // GET /users/{name}/groups (requires matching user or admin)
    if (method === "GET" && segments[0] === "users" && segments[1] && segments[2] === "groups") {
      const targetName = safeDecodeURI(segments[1]);
      if (targetName === null) return badReq("Formato de URL inválido");
      if (!rawUser) return forbidden("Autenticación requerida");
      if (rawUser.trim().toLowerCase() !== targetName.trim().toLowerCase()) {
        const callerGroups = await getUserGroups(rawUser.trim());
        let callerIsAdmin = false;
        for (const g of callerGroups) {
          if (await isAdminInGroup(g.groupId, await resolveUserInGroup(g.groupId, rawUser.trim()))) {
            callerIsAdmin = true; break;
          }
        }
        if (!callerIsAdmin) return forbidden("No tienes permiso");
      }
      return res(200, { groups: await getUserGroups(targetName) });
    }
    // GET /groups/list (requires admin in any group)
    if (method === "GET" && segments[0] === "groups" && segments[1] === "list") {
      if (!rawUser) return forbidden("Autenticación requerida");
      const callerGroups = await getUserGroups(rawUser.trim());
      let callerIsAdmin = false;
      for (const g of callerGroups) {
        if (await isAdminInGroup(g.groupId, await resolveUserInGroup(g.groupId, rawUser.trim()))) {
          callerIsAdmin = true; break;
        }
      }
      if (!callerIsAdmin) return forbidden("Solo admin");
      const items = await queryByPk("GROUPS");
      return res(200, { groups: items.map(i => ({ groupId: i.groupId, name: i.name, memberCount: i.memberCount || 0, sports: i.sports || [] })) });
    }
    // POST /seed-uidx/{groupId} - admin-only migration endpoint
    if (method === "POST" && segments[0] === "seed-uidx" && segments[1]) {
      const gid = segments[1];
      if (!isValidId(gid)) return badReq("groupId inválido");
      if (!rawUser) return forbidden("Autenticación requerida");
      const reqUser = await resolveUserInGroup(gid, rawUser);
      if (!(await isAdminInGroup(gid, reqUser))) return forbidden("Solo admin");
      const groupMeta = await getItem("GROUPS", `G#${gid}`);
      if (!groupMeta) return notFound("Grupo no encontrado");
      const state = await getGroupState(gid);
      let count = 0;
      for (const [name] of Object.entries(state.users || {})) {
        await writeUIDX(name, gid, groupMeta.name);
        count++;
      }
      return res(200, { ok: true, count });
    }

    // ─── Group routes ───
    // POST /groups
    if (method === "POST" && segments[0] === "groups" && !segments[1]) {
      if (!checkRateLimit(`create:${clientIp}`)) {
        return res(429, { error: "Demasiados intentos. Espera un minuto." });
      }
      return await handleCreateGroup(body);
    }
    // GET /invite/{code}
    if (method === "GET" && segments[0] === "invite" && segments[1]) {
      if (!checkRateLimit(`invite:${clientIp}`, WRITE_RATE_MAX)) {
        return res(429, { error: "Demasiadas peticiones. Espera un momento." });
      }
      return await handleGetInvite(segments[1]);
    }
    // POST /groups/{groupId}/join
    if (method === "POST" && segments[0] === "groups" && segments[1] && segments[2] === "join") {
      if (!isValidId(segments[1])) return badReq("groupId inválido");
      if (!checkRateLimit(`join:${clientIp}`)) {
        return res(429, { error: "Demasiados intentos. Espera un minuto." });
      }
      return await handleJoinGroup(segments[1], body);
    }
    // Validate groupId for all /g/ routes
    if (segments[0] === "g" && segments[1] && !isValidId(segments[1])) {
      return badReq("groupId inválido");
    }

    // GET /g/{groupId}/state
    if (method === "GET" && segments[0] === "g" && segments[1] && segments[2] === "state") {
      if (!rawUser) return forbidden("Autenticación requerida");
      const gid = segments[1];
      const memberName = await resolveUserInGroup(gid, rawUser);
      if (!memberName) return forbidden("No perteneces a este grupo");
      const state = await getGroupState(gid);
      const body = JSON.stringify(sanitizeState(state));
      const etag = `"${createHash("md5").update(body).digest("hex")}"`;
      const inm = hdrs["if-none-match"];
      if (inm && inm === etag) {
        return { statusCode: 304, headers: headers({ ETag: etag }), body: "" };
      }
      return { statusCode: 200, headers: headers({ ETag: etag }), body };
    }
    // PUT /g/{groupId}/bets/f1/{raceKey}
    if (method === "PUT" && segments[0] === "g" && segments[1] && segments[2] === "bets" && segments[3] === "f1" && segments[4]) {
      const gid = segments[1];
      const reqUser = rawUser ? await resolveUserInGroup(gid, rawUser) : "";
      if (!reqUser) { log("warn", "bet_f1_reject", { reason: "no_user", group: gid, rawUser }); return forbidden("Falta x-porra-user o usuario no encontrado"); }
      const rk = segments[4];
      const bet = body.bet || body;
      const f1Err = validateF1Bet(bet);
      if (f1Err) { log("warn", "bet_f1_reject", { reason: "validation", group: gid, raceKey: rk, user: reqUser, detail: f1Err }); return badReq(f1Err); }

      const dl = await resolveF1Deadline(gid, rk, body.deadline,
        (g, r, sk) => gGetItem(g, `F1#${r}`, sk),
        (g, r, sk, data) => gPutItem(g, `F1#${r}`, sk, data));
      if (dl.blocked) { log("warn", "bet_f1_reject", { reason: "closed", group: gid, raceKey: rk, user: reqUser }); return forbidden("Las apuestas están cerradas por el admin"); }

      const serverNow = new Date();
      const late = dl.deadline ? serverNow >= dl.deadline : false;
      const ts = serverNow.toISOString();
      const tt = sanitizeTrashtalk(bet);
      const betData = { pole: bet.pole || "", podium: bet.podium || ["","",""], q: bet.q || ["","",""], submittedAt: ts, late };
      if (tt) betData.trashtalk = tt;
      await gPutItem(gid, `F1#${rk}`, `BET#${reqUser}`, betData);
      await appendToHistory(`G#${gid}`, `F1#${rk}|HISTORY#${reqUser}`, { ts, pole: betData.pole, podium: betData.podium, q: betData.q, late });
      log("info", "bet_f1_saved", { group: gid, raceKey: rk, user: reqUser, late, pole: betData.pole });
      return res(200, { ok: true, submittedAt: ts, late });
    }
    // PUT /g/{groupId}/bets/futbol/{jId}
    if (method === "PUT" && segments[0] === "g" && segments[1] && segments[2] === "bets" && segments[3] === "futbol" && segments[4]) {
      const gid = segments[1];
      const reqUser = rawUser ? await resolveUserInGroup(gid, rawUser) : "";
      if (!reqUser) { log("warn", "bet_futbol_reject", { reason: "no_user", group: gid, rawUser }); return forbidden("Falta x-porra-user"); }
      const jId = segments[4];
      const bet = body.bet || body;
      const futErr = validateFutbolBet(bet);
      if (futErr) { log("warn", "bet_futbol_reject", { reason: "validation", group: gid, jornadaId: jId, user: reqUser, detail: futErr }); return badReq(futErr); }

      const dl = await resolveFutbolDeadline(gid, jId,
        (g, j, sk) => gGetItem(g, `FUT#${j}`, sk));
      if (dl.blocked) { log("warn", "bet_futbol_reject", { reason: "closed", group: gid, jornadaId: jId, user: reqUser }); return forbidden("Las apuestas están cerradas por el admin"); }

      const serverNow = new Date();
      const late = dl.deadline ? serverNow >= dl.deadline : false;
      const ts = serverNow.toISOString();
      const tt = sanitizeTrashtalk(bet);
      const betData = { matches: bet.matches || [], submittedAt: ts, late };
      if (tt) betData.trashtalk = tt;
      await gPutItem(gid, `FUT#${jId}`, `BET#${reqUser}`, betData);
      await appendToHistory(`G#${gid}`, `FUT#${jId}|HISTORY#${reqUser}`, { ts, matches: betData.matches, late });
      log("info", "bet_futbol_saved", { group: gid, jornadaId: jId, user: reqUser, late, matchCount: betData.matches.length });
      return res(200, { ok: true, submittedAt: ts, late });
    }
    // PUT /g/{groupId}/bets/mundial/{jId}
    if (method === "PUT" && segments[0] === "g" && segments[1] && segments[2] === "bets" && segments[3] === "mundial" && segments[4]) {
      const gid = segments[1];
      const reqUser = rawUser ? await resolveUserInGroup(gid, rawUser) : "";
      if (!reqUser) { log("warn", "bet_mundial_reject", { reason: "no_user", group: gid }); return forbidden("Falta x-porra-user"); }
      const jId = segments[4];
      const bet = body.bet || body;
      const munErr = validateMundialBet(bet);
      if (munErr) return badReq(munErr);
      const dl = await resolveFutbolDeadline(gid, jId, (g, j, sk) => gGetItem(g, `MUN#${j}`, sk));
      if (dl.blocked) return forbidden("Las apuestas están cerradas por el admin");
      const serverNow = new Date();
      const late = dl.deadline ? serverNow >= dl.deadline : false;
      const ts = serverNow.toISOString();
      const tt = sanitizeTrashtalk(bet);
      const betData = { matches: bet.matches || [], submittedAt: ts, late };
      if (tt) betData.trashtalk = tt;
      await gPutItem(gid, `MUN#${jId}`, `BET#${reqUser}`, betData);
      await appendToHistory(`G#${gid}`, `MUN#${jId}|HISTORY#${reqUser}`, { ts, matches: betData.matches, late });
      log("info", "bet_mundial_saved", { group: gid, jornadaId: jId, user: reqUser, late });
      return res(200, { ok: true, submittedAt: ts, late });
    }
    // PUT /g/{groupId}/users/{name}
    if (method === "PUT" && segments[0] === "g" && segments[1] && segments[2] === "users" && segments[3]) {
      const gid = segments[1];
      const reqUser = rawUser ? await resolveUserInGroup(gid, rawUser) : "";
      if (!reqUser) return forbidden("Falta x-porra-user");
      const targetUser = safeDecodeURI(segments[3]);
      if (targetUser === null) return badReq("Formato de URL inválido");
      if (!isValidUserName(targetUser)) return badReq("Nombre de usuario no válido");
      if (reqUser !== targetUser && !(await isAdminInGroup(gid, reqUser))) return forbidden("Solo puedes modificar tu propio perfil");
      const existing = await gGetItem(gid, `USER#${targetUser}`, "PROFILE");
      if (!existing) return notFound("Usuario no encontrado");
      const updates = body.updates || body;
      const allowed = ["passwordHash", "mustChange", "avatar"];
      if (await isAdminInGroup(gid, reqUser)) allowed.push("isAdmin", "blocked", "porras", "adminRoles");
      const merged = { ...existing };
      for (const key of allowed) { if (updates[key] !== undefined) merged[key] = updates[key]; }
      merged.name = targetUser;
      await gPutItem(gid, `USER#${targetUser}`, "PROFILE", merged);
      return res(200, { ok: true });
    }
    // PUT /g/{groupId}/meta
    if (method === "PUT" && segments[0] === "g" && segments[1] && segments[2] === "meta") {
      const gid = segments[1];
      const reqUser = rawUser ? await resolveUserInGroup(gid, rawUser) : "";
      if (!(await isAdminInGroup(gid, reqUser))) return forbidden("Solo admin");
      const meta = body.meta || body;
      const { avatars, raceOverrides, ...metaRest } = meta;
      if (metaRest && Object.keys(metaRest).length) {
        const existing = await gGetItem(gid, "META", "CONFIG") || {};
        await gPutItem(gid, "META", "CONFIG", { ...existing, ...metaRest });
      }
      if (raceOverrides !== undefined) await gPutItem(gid, "META", "OVERRIDES", { raceOverrides });
      if (avatars !== undefined) await gPutItem(gid, "META", "AVATARS", { avatars });
      return res(200, { ok: true });
    }
    // PUT /g/{groupId}/results/f1/{raceKey}
    if (method === "PUT" && segments[0] === "g" && segments[1] && segments[2] === "results" && segments[3] === "f1" && segments[4]) {
      const gid = segments[1];
      const reqUser = rawUser ? await resolveUserInGroup(gid, rawUser) : "";
      if (!(await isAdminInGroup(gid, reqUser))) return forbidden("Solo admin puede guardar resultados");
      const result = body.result || body;
      const f1ResErr = validateF1Result(result);
      if (f1ResErr) return badReq(f1ResErr);
      await gPutItem(gid, `F1#${segments[4]}`, "RESULT", { pole: result.pole || "", podium: result.podium || ["","",""] });
      return res(200, { ok: true });
    }
    // PUT /g/{groupId}/results/futbol/{jId}
    if (method === "PUT" && segments[0] === "g" && segments[1] && segments[2] === "results" && segments[3] === "futbol" && segments[4]) {
      const gid = segments[1];
      const reqUser = rawUser ? await resolveUserInGroup(gid, rawUser) : "";
      if (!(await isAdminInGroup(gid, reqUser))) return forbidden("Solo admin puede guardar resultados");
      const { pk: _pk, sk: _sk, ...resultData } = body.result || body;
      const futResErr = validateFutbolResult(resultData);
      if (futResErr) return badReq(futResErr);
      await gPutItem(gid, `FUT#${segments[4]}`, "RESULT", resultData);
      return res(200, { ok: true });
    }
    // PUT /g/{groupId}/results/mundial/{jId}
    if (method === "PUT" && segments[0] === "g" && segments[1] && segments[2] === "results" && segments[3] === "mundial" && segments[4]) {
      const gid = segments[1];
      const reqUser = rawUser ? await resolveUserInGroup(gid, rawUser) : "";
      if (!(await isAdminInGroup(gid, reqUser))) return forbidden("Solo admin puede guardar resultados");
      const { pk: _pk, sk: _sk, ...resultData } = body.result || body;
      const munResErr = validateMundialResult(resultData);
      if (munResErr) return badReq(munResErr);
      await gPutItem(gid, `MUN#${segments[4]}`, "RESULT", resultData);
      return res(200, { ok: true });
    }
    // POST /g/{groupId}/users (add user)
    if (method === "POST" && segments[0] === "g" && segments[1] && segments[2] === "users" && !segments[3]) {
      const gid = segments[1];
      const reqUser = rawUser ? await resolveUserInGroup(gid, rawUser) : "";
      if (!(await isAdminInGroup(gid, reqUser))) return forbidden("Solo admin");
      const { name, passwordHash, isAdmin: isAdm, porras } = body;
      if (!name) return badReq("Falta nombre");
      if (!isValidUserName(name)) return badReq("Nombre contiene caracteres no válidos");
      const existing = await gGetItem(gid, `USER#${name}`, "PROFILE");
      if (existing) return badReq("El usuario ya existe");
      await gPutItem(gid, `USER#${name}`, "PROFILE", {
        name, passwordHash: passwordHash || "", mustChange: true,
        isAdmin: !!isAdm, blocked: false, createdAt: new Date().toISOString(),
        porras: porras || { f1: true, futbol: true },
      });
      const groupInfo = await getItem("GROUPS", `G#${gid}`);
      await writeUIDX(name, gid, groupInfo?.name || "");
      return res(200, { ok: true });
    }
    // DELETE /g/{groupId}/users/{name}
    if (method === "DELETE" && segments[0] === "g" && segments[1] && segments[2] === "users" && segments[3]) {
      const gid = segments[1];
      const reqUser = rawUser ? await resolveUserInGroup(gid, rawUser) : "";
      if (!(await isAdminInGroup(gid, reqUser))) return forbidden("Solo admin");
      const targetUser = safeDecodeURI(segments[3]);
      if (targetUser === null) return badReq("Formato de URL inválido");
      if (!isValidUserName(targetUser)) return badReq("Nombre de usuario no válido");
      if (reqUser === targetUser) return badReq("No puedes eliminarte a ti mismo");
      await gDeleteItem(gid, `USER#${targetUser}`, "PROFILE");
      await deleteUIDX(targetUser, gid);
      const groupItems = await queryByPk(`G#${gid}`);
      const userDataItems = groupItems.filter(i =>
        i.sk.includes(`BET#${targetUser}|`) || i.sk.includes(`|BET#${targetUser}`) ||
        i.sk.includes(`HISTORY#${targetUser}|`) || i.sk.includes(`|HISTORY#${targetUser}`)
      );
      for (const item of userDataItems) await deleteItem(item.pk, item.sk);
      return res(200, { ok: true });
    }
    // PUT /g/{groupId}/admin/f1/{raceKey}
    if (method === "PUT" && segments[0] === "g" && segments[1] && segments[2] === "admin" && segments[3] === "f1" && segments[4]) {
      const gid = segments[1];
      const reqUser = rawUser ? await resolveUserInGroup(gid, rawUser) : "";
      if (!(await isAdminInGroup(gid, reqUser))) return forbidden("Solo admin");
      const { type, data } = body;
      if (!type) return badReq("Falta type");
      const raceKey = segments[4];
      switch (type) {
        case "window": await gPutItem(gid, `F1#${raceKey}`, "WINDOW", data || {}); break;
        case "reveal": await gPutItem(gid, `F1#${raceKey}`, "REVEAL", data || {}); break;
        case "adjust": await gPutItem(gid, `F1#${raceKey}`, "ADJUST", { adjustments: data || {} }); break;
        case "bet": {
          const { userName, bet } = data;
          if (!userName) return badReq("Falta userName");
          if (!isValidUserName(userName)) return badReq("Nombre de usuario no válido");
          const gAdmF1Err = validateF1Bet(bet || {});
          if (gAdmF1Err) return badReq(gAdmF1Err);
          await gPutItem(gid, `F1#${raceKey}`, `BET#${userName}`, normalizeBetTrashtalk(bet));
          break;
        }
        case "questions": {
          const existing = await gGetItem(gid, "META", "QUESTIONS") || {};
          await gPutItem(gid, "META", "QUESTIONS", { ...existing, ...data });
          break;
        }
        default: return badReq(`Tipo desconocido: ${type}`);
      }
      return res(200, { ok: true });
    }
    // PUT /g/{groupId}/admin/futbol/{jId}
    if (method === "PUT" && segments[0] === "g" && segments[1] && segments[2] === "admin" && segments[3] === "futbol" && segments[4]) {
      const gid = segments[1];
      const reqUser = rawUser ? await resolveUserInGroup(gid, rawUser) : "";
      if (!(await isAdminInGroup(gid, reqUser))) return forbidden("Solo admin");
      const { type, data } = body;
      if (!type) return badReq("Falta type");
      const jornadaId = segments[4];
      let futbolJornadaExtra = null;
      switch (type) {
        case "jornada": {
          const raw = data || {};
          const { data: saved, meta } = await enrichFutbolJornadaMatchesFromApi(raw, {
            token: process.env.FOOTBALL_DATA_ORG_TOKEN || "",
            competitionId: process.env.FOOTBALL_DATA_COMPETITION_ID,
            futureDays: Number(process.env.FOOTBALL_DATA_DATE_RANGE_DAYS) || 21,
          });
          await gPutItem(gid, `FUT#${jornadaId}`, "CONFIG", saved);
          if (saved?.order) {
            const futConf = await gGetItem(gid, "FUT", "CONFIG") || {};
            await gPutItem(gid, "FUT", "CONFIG", { ...futConf, order: saved.order });
          }
          log("info", "futbol_jornada_saved", { group: gid, jornadaId, kickoffEnrichment: meta });
          futbolJornadaExtra = { kickoffEnrichment: meta, jornada: saved };
          break;
        }
        case "window": await gPutItem(gid, `FUT#${jornadaId}`, "WINDOW", data || {}); break;
        case "reveal": await gPutItem(gid, `FUT#${jornadaId}`, "REVEAL", data || {}); break;
        case "bet": {
          const { userName, bet } = data;
          if (!userName) return badReq("Falta userName");
          if (!isValidUserName(userName)) return badReq("Nombre de usuario no válido");
          const gAdmFutErr = validateFutbolBet(bet || {});
          if (gAdmFutErr) return badReq(gAdmFutErr);
          await gPutItem(gid, `FUT#${jornadaId}`, `BET#${userName}`, normalizeBetTrashtalk(bet));
          break;
        }
        case "delete": {
          const items = await queryByPk(`G#${gid}`);
          const futItems = items.filter(i => i.sk.startsWith(`FUT#${jornadaId}|`));
          for (const item of futItems) await deleteItem(item.pk, item.sk);
          break;
        }
        default: return badReq(`Tipo desconocido: ${type}`);
      }
      return res(200, futbolJornadaExtra ? { ok: true, ...futbolJornadaExtra } : { ok: true });
    }
    // PUT /g/{groupId}/admin/mundial/{jId}
    if (method === "PUT" && segments[0] === "g" && segments[1] && segments[2] === "admin" && segments[3] === "mundial" && segments[4]) {
      const gid = segments[1];
      const reqUser = rawUser ? await resolveUserInGroup(gid, rawUser) : "";
      if (!(await isAdminInGroup(gid, reqUser))) return forbidden("Solo admin");
      const { type, data } = body;
      if (!type) return badReq("Falta type");
      const jornadaId = segments[4];
      let mundialExtra = null;
      switch (type) {
        case "jornada": {
          const saved = data || {};
          await gPutItem(gid, `MUN#${jornadaId}`, "CONFIG", saved);
          if (saved?.order) {
            const munConf = await gGetItem(gid, "MUN", "CONFIG") || {};
            await gPutItem(gid, "MUN", "CONFIG", { ...munConf, order: saved.order });
          }
          mundialExtra = { jornada: saved };
          break;
        }
        case "window": await gPutItem(gid, `MUN#${jornadaId}`, "WINDOW", data || {}); break;
        case "reveal": await gPutItem(gid, `MUN#${jornadaId}`, "REVEAL", data || {}); break;
        case "bet": {
          const { userName, bet } = data;
          if (!userName || !isValidUserName(userName)) return badReq("userName inválido");
          const admErr = validateMundialBet(bet || {});
          if (admErr) return badReq(admErr);
          await gPutItem(gid, `MUN#${jornadaId}`, `BET#${userName}`, normalizeBetTrashtalk(bet));
          break;
        }
        case "delete": {
          const items = await queryByPk(`G#${gid}`);
          const munItems = items.filter((i) => i.sk.startsWith(`MUN#${jornadaId}|`));
          for (const item of munItems) await deleteItem(item.pk, item.sk);
          break;
        }
        default: return badReq(`Tipo desconocido: ${type}`);
      }
      return res(200, mundialExtra ? { ok: true, ...mundialExtra } : { ok: true });
    }
    // POST /migrate-to-group - admin-only, migrates legacy data to a group
    if (method === "POST" && segments[0] === "migrate-to-group") {
      const reqUser = rawUser ? await resolveUser(rawUser) : "";
      if (!(await isAdmin(reqUser))) return forbidden("Solo admin puede migrar datos");
      const { groupId: targetGroupId, groupName, inviteCode: customInvite } = body;
      if (!targetGroupId) return badReq("Falta groupId");
      if (!isValidId(targetGroupId)) return badReq("groupId inválido");
      const existingGroup = await getItem("GROUPS", `G#${targetGroupId}`);
      if (existingGroup) return badReq("El grupo destino ya existe. Elige otro groupId.");
      const state = await getFullState();
      if (!state.meta?.seeded) return badReq("No hay datos legacy para migrar");
      const inviteCode = customInvite || generateCode(8);
      const adminUser = Object.entries(state.users || {}).find(([_, u]) => u.isAdmin)?.[0] || "";
      const now = new Date().toISOString();
      await putItem("GROUPS", `G#${targetGroupId}`, {
        name: groupName || "Grupo Migrado", groupId: targetGroupId, inviteCode,
        sports: ["f1", "futbol"], createdAt: now, adminUser,
        memberCount: Object.keys(state.users || {}).length,
      });
      await putItem(`INVITE#${inviteCode}`, "META", { groupId: targetGroupId, groupName: groupName || "Grupo Migrado" });
      const ops = [];
      const gpk = `G#${targetGroupId}`;
      const { avatars, raceOverrides, ...metaRest } = state.meta || {};
      ops.push({ pk: gpk, sk: "META|CONFIG", ...metaRest });
      if (raceOverrides) ops.push({ pk: gpk, sk: "META|OVERRIDES", raceOverrides });
      if (avatars) ops.push({ pk: gpk, sk: "META|AVATARS", avatars });
      ops.push({ pk: gpk, sk: "META|QUESTIONS", questionOwner: state.questionOwner || {}, questions: state.questions || {}, questionsStatus: state.questionsStatus || {} });
      for (const [name, u] of Object.entries(state.users || {})) {
        ops.push({ pk: gpk, sk: `USER#${name}|PROFILE`, ...u, createdAt: state.participants?.[name]?.createdAt || u.createdAt });
      }
      for (const [rk, result] of Object.entries(state.results || {})) ops.push({ pk: gpk, sk: `F1#${rk}|RESULT`, ...result });
      for (const [rk, raceBets] of Object.entries(state.bets || {})) {
        for (const [name, bet] of Object.entries(raceBets || {})) ops.push({ pk: gpk, sk: `F1#${rk}|BET#${name}`, ...bet });
      }
      for (const [rk, rh] of Object.entries(state.betHistory || {})) {
        for (const [name, log] of Object.entries(rh || {})) ops.push({ pk: gpk, sk: `F1#${rk}|HISTORY#${name}`, log });
      }
      for (const [rk, w] of Object.entries(state.betsWindow || {})) ops.push({ pk: gpk, sk: `F1#${rk}|WINDOW`, ...w });
      for (const [rk, r] of Object.entries(state.betsReveal || {})) ops.push({ pk: gpk, sk: `F1#${rk}|REVEAL`, ...r });
      for (const [rk, adj] of Object.entries(state.scoreAdjustments || {})) ops.push({ pk: gpk, sk: `F1#${rk}|ADJUST`, adjustments: adj });
      const fut = state.futbol || {};
      ops.push({ pk: gpk, sk: "FUT|CONFIG", order: fut.order || [], jornadasV3: true });
      for (const [jId, j] of Object.entries(fut.jornadas || {})) ops.push({ pk: gpk, sk: `FUT#${jId}|CONFIG`, ...j });
      for (const [jId, r] of Object.entries(fut.results || {})) ops.push({ pk: gpk, sk: `FUT#${jId}|RESULT`, ...r });
      for (const [jId, jB] of Object.entries(fut.bets || {})) {
        for (const [name, bet] of Object.entries(jB || {})) ops.push({ pk: gpk, sk: `FUT#${jId}|BET#${name}`, ...bet });
      }
      const munMig = state.mundial || {};
      ops.push({ pk: gpk, sk: "MUN|CONFIG", order: munMig.order || [], mundialSeeded: !!state.meta?.mundialSeeded });
      for (const [jId, j] of Object.entries(munMig.jornadas || {})) ops.push({ pk: gpk, sk: `MUN#${jId}|CONFIG`, ...j });
      for (const [jId, r] of Object.entries(munMig.results || {})) ops.push({ pk: gpk, sk: `MUN#${jId}|RESULT`, ...r });
      for (const [jId, jB] of Object.entries(munMig.bets || {})) {
        for (const [name, bet] of Object.entries(jB || {})) ops.push({ pk: gpk, sk: `MUN#${jId}|BET#${name}`, ...bet });
      }
      for (let i = 0; i < ops.length; i += 25) {
        const batch = ops.slice(i, i + 25).map(item => ({ PutRequest: { Item: item } }));
        await batchWriteWithRetry({ [TABLE]: batch });
      }
      return res(200, { ok: true, groupId: targetGroupId, inviteCode, items: ops.length });
    }
    // PUT /g/{groupId}/state (admin-only, preserves existing passwordHash)
    if (method === "PUT" && segments[0] === "g" && segments[1] && segments[2] === "state") {
      const gid = segments[1];
      if (!isValidId(gid)) return badReq("groupId inválido");
      const reqUser = rawUser ? await resolveUserInGroup(gid, rawUser) : "";
      if (!(await isAdminInGroup(gid, reqUser))) return forbidden("Solo admin puede sobrescribir estado");
      const state = body;
      for (const [name, u] of Object.entries(state.users || {})) {
        if (!u.passwordHash) {
          const existing = await gGetItem(gid, `USER#${name}`, "PROFILE");
          if (existing?.passwordHash) u.passwordHash = existing.passwordHash;
        }
      }
      const ops = [];
      const gpk = `G#${gid}`;
      const { avatars, raceOverrides, ...metaRest } = state.meta || {};
      ops.push({ pk: gpk, sk: "META|CONFIG", ...metaRest });
      if (raceOverrides) ops.push({ pk: gpk, sk: "META|OVERRIDES", raceOverrides });
      if (avatars) ops.push({ pk: gpk, sk: "META|AVATARS", avatars });
      ops.push({ pk: gpk, sk: "META|QUESTIONS", questionOwner: state.questionOwner || {}, questions: state.questions || {}, questionsStatus: state.questionsStatus || {} });
      for (const [name, u] of Object.entries(state.users || {})) {
        ops.push({ pk: gpk, sk: `USER#${name}|PROFILE`, ...u, createdAt: state.participants?.[name]?.createdAt || u.createdAt });
      }
      for (const [rk, result] of Object.entries(state.results || {})) ops.push({ pk: gpk, sk: `F1#${rk}|RESULT`, ...result });
      for (const [rk, raceBets] of Object.entries(state.bets || {})) {
        for (const [name, bet] of Object.entries(raceBets || {})) ops.push({ pk: gpk, sk: `F1#${rk}|BET#${name}`, ...bet });
      }
      for (const [rk, rh] of Object.entries(state.betHistory || {})) {
        for (const [name, log] of Object.entries(rh || {})) ops.push({ pk: gpk, sk: `F1#${rk}|HISTORY#${name}`, log });
      }
      for (const [rk, w] of Object.entries(state.betsWindow || {})) ops.push({ pk: gpk, sk: `F1#${rk}|WINDOW`, ...w });
      for (const [rk, r] of Object.entries(state.betsReveal || {})) ops.push({ pk: gpk, sk: `F1#${rk}|REVEAL`, ...r });
      for (const [rk, adj] of Object.entries(state.scoreAdjustments || {})) ops.push({ pk: gpk, sk: `F1#${rk}|ADJUST`, adjustments: adj });
      const fut = state.futbol || {};
      ops.push({ pk: gpk, sk: "FUT|CONFIG", order: fut.order || [], jornadasV3: true });
      for (const [jId, j] of Object.entries(fut.jornadas || {})) ops.push({ pk: gpk, sk: `FUT#${jId}|CONFIG`, ...j });
      for (const [jId, r] of Object.entries(fut.results || {})) ops.push({ pk: gpk, sk: `FUT#${jId}|RESULT`, ...r });
      for (const [jId, jB] of Object.entries(fut.bets || {})) {
        for (const [name, bet] of Object.entries(jB || {})) ops.push({ pk: gpk, sk: `FUT#${jId}|BET#${name}`, ...bet });
      }
      const mun = state.mundial || {};
      ops.push({ pk: gpk, sk: "MUN|CONFIG", order: mun.order || [], mundialSeeded: !!state.meta?.mundialSeeded });
      for (const [jId, j] of Object.entries(mun.jornadas || {})) ops.push({ pk: gpk, sk: `MUN#${jId}|CONFIG`, ...j });
      for (const [jId, r] of Object.entries(mun.results || {})) ops.push({ pk: gpk, sk: `MUN#${jId}|RESULT`, ...r });
      for (const [jId, jB] of Object.entries(mun.bets || {})) {
        for (const [name, bet] of Object.entries(jB || {})) ops.push({ pk: gpk, sk: `MUN#${jId}|BET#${name}`, ...bet });
      }
      for (let i = 0; i < ops.length; i += 25) {
        const batch = ops.slice(i, i + 25).map(item => ({ PutRequest: { Item: item } }));
        await batchWriteWithRetry({ [TABLE]: batch });
      }
      return res(200, { ok: true, items: ops.length });
    }

    const reqUser = rawUser ? await resolveUser(rawUser) : "";

    // PUT /bets/f1/{raceKey}
    if (method === "PUT" && segments[0] === "bets" && segments[1] === "f1" && segments[2]) {
      if (!reqUser) return forbidden("Falta x-porra-user o usuario no encontrado");
      return await handleSaveBetF1(segments[2], reqUser, body);
    }

    // PUT /bets/futbol/{jornadaId}
    if (method === "PUT" && segments[0] === "bets" && segments[1] === "futbol" && segments[2]) {
      if (!reqUser) return forbidden("Falta x-porra-user");
      return await handleSaveBetFutbol(segments[2], reqUser, body);
    }

    // PUT /bets/mundial/{jornadaId}
    if (method === "PUT" && segments[0] === "bets" && segments[1] === "mundial" && segments[2]) {
      if (!reqUser) return forbidden("Falta x-porra-user");
      return await handleSaveBetMundial(segments[2], reqUser, body);
    }

    // PUT /results/f1/{raceKey}
    if (method === "PUT" && segments[0] === "results" && segments[1] === "f1" && segments[2]) {
      if (!reqUser) return forbidden("Falta x-porra-user");
      return await handleSaveResultF1(segments[2], reqUser, body);
    }

    // PUT /results/futbol/{jornadaId}
    if (method === "PUT" && segments[0] === "results" && segments[1] === "futbol" && segments[2]) {
      if (!reqUser) return forbidden("Falta x-porra-user");
      return await handleSaveResultFutbol(segments[2], reqUser, body);
    }

    // PUT /results/mundial/{jornadaId}
    if (method === "PUT" && segments[0] === "results" && segments[1] === "mundial" && segments[2]) {
      if (!reqUser) return forbidden("Falta x-porra-user");
      return await handleSaveResultMundial(segments[2], reqUser, body);
    }

    // PUT /users/{name}
    if (method === "PUT" && segments[0] === "users" && segments[1]) {
      if (!reqUser) return forbidden("Falta x-porra-user");
      const targetUser = safeDecodeURI(segments[1]);
      if (targetUser === null) return badReq("Formato de URL inválido");
      return await handleUpdateUser(targetUser, reqUser, body);
    }

    // POST /users (add new user)
    if (method === "POST" && segments[0] === "users") {
      if (!reqUser) return forbidden("Falta x-porra-user");
      return await handleAddUser(reqUser, body);
    }

    // DELETE /users/{name}
    if (method === "DELETE" && segments[0] === "users" && segments[1]) {
      if (!reqUser) return forbidden("Falta x-porra-user");
      const delUser = safeDecodeURI(segments[1]);
      if (delUser === null) return badReq("Formato de URL inválido");
      return await handleDeleteUser(delUser, reqUser);
    }

    // PUT /meta
    if (method === "PUT" && segments[0] === "meta") {
      if (!reqUser) return forbidden("Falta x-porra-user");
      return await handleSaveMeta(reqUser, body);
    }

    // PUT /admin/f1/{raceKey}
    if (method === "PUT" && segments[0] === "admin" && segments[1] === "f1" && segments[2]) {
      if (!reqUser) return forbidden("Falta x-porra-user");
      return await handleAdminF1(segments[2], reqUser, body);
    }

    // PUT /admin/futbol/{jornadaId}
    if (method === "PUT" && segments[0] === "admin" && segments[1] === "futbol" && segments[2]) {
      if (!reqUser) return forbidden("Falta x-porra-user");
      return await handleAdminFutbol(segments[2], reqUser, body);
    }

    // PUT /admin/mundial/{jornadaId}
    if (method === "PUT" && segments[0] === "admin" && segments[1] === "mundial" && segments[2]) {
      if (!reqUser) return forbidden("Falta x-porra-user");
      return await handleAdminMundial(segments[2], reqUser, body);
    }

    return notFound(`Ruta no encontrada: ${method} ${path}`);
  } catch (err) {
    log("error", "lambda_unhandled", { method, path, user: reqUser, error: err?.message, stack: err?.stack });
    return res(500, { error: "Error interno" });
  }
};
