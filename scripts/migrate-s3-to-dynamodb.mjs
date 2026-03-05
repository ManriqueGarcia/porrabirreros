#!/usr/bin/env node
/**
 * Migra el state.json de S3 a DynamoDB.
 * Usa la misma Lambda para descomponer el estado en items DynamoDB.
 *
 * Uso:
 *   PORRA_API_BASE=https://tu-api.com node scripts/migrate-s3-to-dynamodb.mjs
 *
 * Prerequisitos:
 * - La Lambda porra-state-api.mjs debe estar desplegada y conectada a DynamoDB
 * - El state.json debe estar accesible via GET /state en la API actual (S3)
 */
const API_BASE = process.env.PORRA_API_BASE || "";
const API_SECRET = process.env.PORRA_API_SECRET || "";
const NEW_API_BASE = process.env.NEW_API_BASE || API_BASE;

if (!API_BASE) {
  console.error("Error: define PORRA_API_BASE (API actual con S3)");
  process.exit(1);
}

async function main() {
  const hdrs = { Accept: "application/json", "Content-Type": "application/json" };
  if (API_SECRET) hdrs["x-porra-secret"] = API_SECRET;

  console.log("1. Descargando state.json desde API actual...");
  const getRes = await fetch(`${API_BASE}/state`, { headers: hdrs });
  if (!getRes.ok) throw new Error(`GET /state fallo: ${getRes.status}`);
  const state = await getRes.json();

  const users = Object.keys(state.users || {});
  const races = Object.keys(state.results || {});
  const bets = Object.keys(state.bets || {});
  const futJornadas = Object.keys(state.futbol?.jornadas || {});

  console.log(`   Usuarios: ${users.join(", ")}`);
  console.log(`   Carreras con resultado: ${races.length}`);
  console.log(`   Carreras con apuestas: ${bets.length}`);
  console.log(`   Jornadas futbol: ${futJornadas.length}`);
  console.log("");

  console.log("2. Escribiendo estado en DynamoDB via PUT /state...");
  const putRes = await fetch(`${NEW_API_BASE}/state`, {
    method: "PUT",
    headers: hdrs,
    body: JSON.stringify(state),
  });
  if (!putRes.ok) {
    const err = await putRes.text();
    throw new Error(`PUT /state fallo: ${putRes.status} - ${err}`);
  }
  const result = await putRes.json();
  console.log(`   Items escritos en DynamoDB: ${result.items}`);
  console.log("");

  console.log("3. Verificando: GET /state desde DynamoDB...");
  const verifyRes = await fetch(`${NEW_API_BASE}/state`, { headers: hdrs });
  if (!verifyRes.ok) throw new Error(`GET /state verificacion fallo: ${verifyRes.status}`);
  const verifyState = await verifyRes.json();

  const vUsers = Object.keys(verifyState.users || {});
  const vRaces = Object.keys(verifyState.results || {});
  const vBets = Object.keys(verifyState.bets || {});

  console.log(`   Usuarios: ${vUsers.length} (original: ${users.length})`);
  console.log(`   Resultados: ${vRaces.length} (original: ${races.length})`);
  console.log(`   Apuestas: ${vBets.length} (original: ${bets.length})`);
  console.log("");

  if (vUsers.length === users.length && vRaces.length === races.length) {
    console.log("Migracion completada correctamente.");
  } else {
    console.warn("ATENCION: Los conteos no coinciden. Revisa manualmente.");
  }
}

main().catch((e) => {
  console.error("Error:", e.message);
  process.exit(1);
});
