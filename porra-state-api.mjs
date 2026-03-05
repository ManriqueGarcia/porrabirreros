/**
 * Lambda: API de estado con DynamoDB
 * Rutas granulares con validacion server-side.
 * Env vars: TABLE_NAME, ALLOWED_ORIGIN, API_SECRET
 */
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient, GetCommand, PutCommand, DeleteCommand,
  QueryCommand, ScanCommand, BatchWriteCommand,
} from "@aws-sdk/lib-dynamodb";

const TABLE = process.env.TABLE_NAME || "PorraBirreros";
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "*";
const API_SECRET = process.env.API_SECRET || "";

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true },
});

function headers(extra = {}) {
  return {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Headers": "content-type,x-porra-secret,x-porra-user",
    "Access-Control-Allow-Methods": "GET,PUT,DELETE,OPTIONS",
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
  await client.send(new PutCommand({ TableName: TABLE, Item: { pk, sk, ...data } }));
}

async function deleteItem(pk, sk) {
  await client.send(new DeleteCommand({ TableName: TABLE, Key: { pk, sk } }));
}

async function queryByPk(pk) {
  const r = await client.send(new QueryCommand({
    TableName: TABLE,
    KeyConditionExpression: "pk = :pk",
    ExpressionAttributeValues: { ":pk": pk },
  }));
  return r.Items || [];
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

async function isAdmin(userName) {
  const user = await getItem(`USER#${userName}`, "PROFILE");
  return !!user?.isAdmin;
}

// GET /state - reconstruct full state from DynamoDB
async function getFullState() {
  const items = await scanAll();
  const state = {
    users: {}, participants: {}, bets: {}, results: {},
    betHistory: {}, betsWindow: {}, betsReveal: {},
    scoreAdjustments: {}, questionOwner: {}, questions: {},
    questionsStatus: {}, meta: {}, futbol: {
      order: [], jornadas: {}, bets: {}, results: {},
      betsWindow: {}, betsReveal: {}, betHistory: {},
    },
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

  // BatchWrite (25 items max per batch)
  for (let i = 0; i < ops.length; i += 25) {
    const batch = ops.slice(i, i + 25).map(item => ({
      PutRequest: { Item: item },
    }));
    await client.send(new BatchWriteCommand({
      RequestItems: { [TABLE]: batch },
    }));
  }

  return ops.length;
}

// ─── Route handlers ───

async function handleSaveBetF1(raceKey, reqUser, body) {
  if (!raceKey || !reqUser) return badReq("Faltan raceKey o user");
  const bet = body.bet || body;
  if (!bet.pole && !bet.podium) return badReq("Bet data incompleta");

  const ts = new Date().toISOString();
  const betData = {
    pole: bet.pole || "", podium: bet.podium || ["", "", ""],
    q: bet.q || ["", "", ""], submittedAt: ts, late: !!bet.late,
  };

  await putItem(`F1#${raceKey}`, `BET#${reqUser}`, betData);

  // Append to history
  const hist = await getItem(`F1#${raceKey}`, `HISTORY#${reqUser}`);
  const log = hist?.log || [];
  log.push({ ts, pole: betData.pole, podium: betData.podium, q: betData.q, late: betData.late });
  await putItem(`F1#${raceKey}`, `HISTORY#${reqUser}`, { log });

  return res(200, { ok: true, submittedAt: ts });
}

async function handleSaveBetFutbol(jornadaId, reqUser, body) {
  if (!jornadaId || !reqUser) return badReq("Faltan jornadaId o user");
  const bet = body.bet || body;

  const ts = new Date().toISOString();
  const betData = {
    matches: bet.matches || [], submittedAt: ts, late: !!bet.late,
  };

  await putItem(`FUT#${jornadaId}`, `BET#${reqUser}`, betData);

  const hist = await getItem(`FUT#${jornadaId}`, `HISTORY#${reqUser}`);
  const log = hist?.log || [];
  log.push({ ts, matches: betData.matches, late: betData.late });
  await putItem(`FUT#${jornadaId}`, `HISTORY#${reqUser}`, { log });

  return res(200, { ok: true, submittedAt: ts });
}

async function handleSaveResultF1(raceKey, reqUser, body) {
  if (!(await isAdmin(reqUser))) return forbidden("Solo admin puede guardar resultados");
  if (!raceKey) return badReq("Falta raceKey");
  const result = body.result || body;
  await putItem(`F1#${raceKey}`, "RESULT", {
    pole: result.pole || "", podium: result.podium || ["", "", ""],
  });
  return res(200, { ok: true });
}

async function handleSaveResultFutbol(jornadaId, reqUser, body) {
  if (!(await isAdmin(reqUser))) return forbidden("Solo admin puede guardar resultados");
  if (!jornadaId) return badReq("Falta jornadaId");
  const { pk, sk, ...resultData } = body.result || body;
  await putItem(`FUT#${jornadaId}`, "RESULT", resultData);
  return res(200, { ok: true });
}

async function handleUpdateUser(targetUser, reqUser, body) {
  if (reqUser !== targetUser && !(await isAdmin(reqUser))) {
    return forbidden("Solo puedes modificar tu propio perfil");
  }
  const existing = await getItem(`USER#${targetUser}`, "PROFILE");
  if (!existing) return notFound("Usuario no encontrado");

  const updates = body.updates || body;
  const allowed = ["passwordHash", "mustChange", "avatar"];
  if (await isAdmin(reqUser)) allowed.push("isAdmin", "blocked", "name");

  const merged = { ...existing };
  for (const key of allowed) {
    if (updates[key] !== undefined) merged[key] = updates[key];
  }

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
      await putItem(`F1#${raceKey}`, `BET#${userName}`, bet);
      break;
    }
    case "questions":
      const existing = await getItem("META", "QUESTIONS") || {};
      await putItem("META", "QUESTIONS", { ...existing, ...data });
      break;
    default:
      return badReq(`Tipo desconocido: ${type}`);
  }
  return res(200, { ok: true });
}

async function handleAdminFutbol(jornadaId, reqUser, body) {
  if (!(await isAdmin(reqUser))) return forbidden("Solo admin");
  const { type, data } = body;
  if (!type) return badReq("Falta type");

  switch (type) {
    case "jornada":
      await putItem(`FUT#${jornadaId}`, "CONFIG", data || {});
      if (data?.order) {
        const futConf = await getItem("FUT", "CONFIG") || {};
        await putItem("FUT", "CONFIG", { ...futConf, order: data.order });
      }
      break;
    case "window":
      await putItem(`FUT#${jornadaId}`, "WINDOW", data || {});
      break;
    case "reveal":
      await putItem(`FUT#${jornadaId}`, "REVEAL", data || {});
      break;
    case "bet": {
      const { userName, bet } = data;
      if (!userName) return badReq("Falta userName");
      await putItem(`FUT#${jornadaId}`, `BET#${userName}`, bet);
      break;
    }
    case "delete":
      const items = await queryByPk(`FUT#${jornadaId}`);
      for (const item of items) {
        await deleteItem(item.pk, item.sk);
      }
      break;
    default:
      return badReq(`Tipo desconocido: ${type}`);
  }
  return res(200, { ok: true });
}

async function handleAddUser(reqUser, body) {
  if (!(await isAdmin(reqUser))) return forbidden("Solo admin");
  const { name, passwordHash, isAdmin: isAdm } = body;
  if (!name) return badReq("Falta nombre");
  const existing = await getItem(`USER#${name}`, "PROFILE");
  if (existing) return badReq("El usuario ya existe");
  await putItem(`USER#${name}`, "PROFILE", {
    name, passwordHash: passwordHash || "", mustChange: true,
    isAdmin: !!isAdm, blocked: false, createdAt: new Date().toISOString(),
  });
  return res(200, { ok: true });
}

async function handleDeleteUser(targetUser, reqUser) {
  if (!(await isAdmin(reqUser))) return forbidden("Solo admin");
  if (reqUser === targetUser) return badReq("No puedes eliminarte a ti mismo");
  await deleteItem(`USER#${targetUser}`, "PROFILE");
  return res(200, { ok: true });
}

// ─── Main handler ───

export const handler = async (event) => {
  const method = event.requestContext?.http?.method || event.httpMethod || "GET";
  const rawPath = event.requestContext?.http?.path || event.rawPath || event.path || "/";
  const hdrs = Object.fromEntries(
    Object.entries(event.headers || {}).map(([k, v]) => [k.toLowerCase(), v])
  );

  if (method === "OPTIONS") return { statusCode: 204, headers: headers(), body: "" };

  if (API_SECRET && hdrs["x-porra-secret"] !== API_SECRET) {
    return forbidden("API secret invalido");
  }

  const reqUser = hdrs["x-porra-user"] || "";
  const path = rawPath.replace(/\/+$/, "") || "/";
  const segments = path.split("/").filter(Boolean);

  let body = {};
  if (event.body) {
    try { body = JSON.parse(event.body); } catch { return badReq("JSON invalido"); }
  }

  try {
    // GET /state
    if (method === "GET" && path === "/state") {
      const state = await getFullState();
      return res(200, state);
    }

    // PUT /state (backward compat / migration)
    if (method === "PUT" && path === "/state") {
      const count = await writeFullState(body);
      return res(200, { ok: true, items: count });
    }

    // PUT /bets/f1/{raceKey}
    if (method === "PUT" && segments[0] === "bets" && segments[1] === "f1" && segments[2]) {
      if (!reqUser) return forbidden("Falta x-porra-user");
      return handleSaveBetF1(segments[2], reqUser, body);
    }

    // PUT /bets/futbol/{jornadaId}
    if (method === "PUT" && segments[0] === "bets" && segments[1] === "futbol" && segments[2]) {
      if (!reqUser) return forbidden("Falta x-porra-user");
      return handleSaveBetFutbol(segments[2], reqUser, body);
    }

    // PUT /results/f1/{raceKey}
    if (method === "PUT" && segments[0] === "results" && segments[1] === "f1" && segments[2]) {
      if (!reqUser) return forbidden("Falta x-porra-user");
      return handleSaveResultF1(segments[2], reqUser, body);
    }

    // PUT /results/futbol/{jornadaId}
    if (method === "PUT" && segments[0] === "results" && segments[1] === "futbol" && segments[2]) {
      if (!reqUser) return forbidden("Falta x-porra-user");
      return handleSaveResultFutbol(segments[2], reqUser, body);
    }

    // PUT /users/{name}
    if (method === "PUT" && segments[0] === "users" && segments[1]) {
      if (!reqUser) return forbidden("Falta x-porra-user");
      return handleUpdateUser(decodeURIComponent(segments[1]), reqUser, body);
    }

    // POST /users (add new user)
    if (method === "POST" && segments[0] === "users") {
      if (!reqUser) return forbidden("Falta x-porra-user");
      return handleAddUser(reqUser, body);
    }

    // DELETE /users/{name}
    if (method === "DELETE" && segments[0] === "users" && segments[1]) {
      if (!reqUser) return forbidden("Falta x-porra-user");
      return handleDeleteUser(decodeURIComponent(segments[1]), reqUser);
    }

    // PUT /meta
    if (method === "PUT" && segments[0] === "meta") {
      if (!reqUser) return forbidden("Falta x-porra-user");
      return handleSaveMeta(reqUser, body);
    }

    // PUT /admin/f1/{raceKey}
    if (method === "PUT" && segments[0] === "admin" && segments[1] === "f1" && segments[2]) {
      if (!reqUser) return forbidden("Falta x-porra-user");
      return handleAdminF1(segments[2], reqUser, body);
    }

    // PUT /admin/futbol/{jornadaId}
    if (method === "PUT" && segments[0] === "admin" && segments[1] === "futbol" && segments[2]) {
      if (!reqUser) return forbidden("Falta x-porra-user");
      return handleAdminFutbol(segments[2], reqUser, body);
    }

    return notFound(`Ruta no encontrada: ${method} ${path}`);
  } catch (err) {
    console.error("Error:", err);
    return res(500, { error: "Error interno", detail: err.message });
  }
};
