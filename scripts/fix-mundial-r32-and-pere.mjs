#!/usr/bin/env node
/**
 * Script de arreglos mundiales:
 * 1. Añade CONFIGs de jornadas que faltan en DB (wc-md2, wc-md3, wc-r32, wc-r16, wc-qf, wc-sf)
 * 2. Corrige la apuesta de Pere en wc-md3: matches[6] de {home:2,away:1} a {home:3,away:0}
 */
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { buildMundialSeedState } from "../lib/mundial-fixtures.mjs";

const TABLE = "porra-f1";
const GROUP_ID = "birreros";
const REGION = "us-east-1";

const client = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }), {
  marshallOptions: { removeUndefinedValues: true },
});

async function putItem(pk, sk, data) {
  const { pk: _pk, sk: _sk, ...safeData } = data || {};
  await client.send(new PutCommand({ TableName: TABLE, Item: { pk, sk, ...safeData } }));
}

async function getItem(pk, sk) {
  const r = await client.send(new GetCommand({ TableName: TABLE, Key: { pk, sk } }));
  return r.Item || null;
}

const gpk = `G#${GROUP_ID}`;

async function main() {
  // 1. Añadir CONFIGs de jornadas que faltan
  const seed = buildMundialSeedState();
  const missingJornadas = ["wc-md2", "wc-md3", "wc-r32", "wc-r16", "wc-qf", "wc-sf"];

  for (const jornadaId of missingJornadas) {
    const sk = `MUN#${jornadaId}|CONFIG`;
    const existing = await getItem(gpk, sk);
    if (existing) {
      console.log(`  SKIP ${jornadaId} — ya existe en DB`);
      continue;
    }
    const jornada = seed.jornadas[jornadaId];
    if (!jornada) {
      console.error(`  ERROR: jornada ${jornadaId} no encontrada en seed`);
      continue;
    }
    await putItem(gpk, sk, jornada);
    console.log(`  OK añadida jornada ${jornadaId} (${jornada.name})`);
  }

  // 2. Corregir apuesta de Pere en wc-md3: matches[6] de {home:2,away:1} a {home:3,away:0}
  const pereBetSk = "MUN#wc-md3|BET#Pere";
  const pereBet = await getItem(gpk, pereBetSk);
  if (!pereBet) {
    console.error("ERROR: apuesta de Pere en wc-md3 no encontrada");
    return;
  }

  const oldMatch = pereBet.matches?.[6];
  console.log(`\nApuesta actual de Pere wc-md3[6]: home=${oldMatch?.home} away=${oldMatch?.away}`);

  if (!pereBet.matches || pereBet.matches.length <= 6) {
    console.error("ERROR: bet no tiene suficientes partidos");
    return;
  }

  const newMatches = [...pereBet.matches];
  newMatches[6] = { home: 3, away: 0 };

  await putItem(gpk, pereBetSk, { ...pereBet, matches: newMatches });
  console.log(`  OK corregida apuesta de Pere wc-md3[6]: {home:3,away:0}`);

  // 3. Actualizar historial de Pere en wc-md3 con la corrección
  const pereHistSk = "MUN#wc-md3|HISTORY#Pere";
  const pereHist = await getItem(gpk, pereHistSk);
  if (pereHist?.log?.length) {
    const lastEntry = pereHist.log[pereHist.log.length - 1];
    if (lastEntry?.matches?.[6]) {
      const newLog = [...pereHist.log];
      const lastIdx = newLog.length - 1;
      const updatedMatches = [...newLog[lastIdx].matches];
      updatedMatches[6] = { home: 3, away: 0 };
      newLog[lastIdx] = { ...newLog[lastIdx], matches: updatedMatches };
      await putItem(gpk, pereHistSk, { ...pereHist, log: newLog });
      console.log(`  OK actualizado historial de Pere wc-md3`);
    }
  }

  console.log("\nScript completado.");
}

main().catch(e => { console.error("ERROR:", e.message); process.exit(1); });
