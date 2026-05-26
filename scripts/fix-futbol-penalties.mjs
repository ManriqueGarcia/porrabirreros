#!/usr/bin/env node
/**
 * Correcciones puntuales en DynamoDB para la porra de fútbol.
 *
 * 1) Quitar penalización fuera de plazo (late) en la ÚLTIMA jornada del order
 *    para TODOS los usuarios que tengan apuesta guardada.
 * 2) Quitar late en TODAS las apuestas de fútbol de un usuario (p. ej. Paula)
 *    para eliminar los -2 acumulados por fuera de plazo.
 *
 * NO corrige por sí solo:
 *   - "No participó" (-3): no hay item BET; hay que cargar apuesta desde admin.
 *   - "Apuesta catastrófica" (-1): marcadores mal sin late; no es penalización fuera de plazo.
 *
 * Uso (producción, perfil AWS con permisos DynamoDB):
 *
 *   export AWS_REGION=eu-west-1
 *   export TABLE_NAME=PorraBirreros
 *   export PORRA_GROUP_ID=tu-grupo
 *
 *   node scripts/fix-futbol-penalties.mjs --dry-run --last-jornada-all --user-clear-late=Paula
 *   node scripts/fix-futbol-penalties.mjs --last-jornada-all --user-clear-late=Paula
 *
 * Modo legacy (pk = FUT#jornadaId, sk = BET#usuario; meta en FUT / CONFIG):
 *   node scripts/fix-futbol-penalties.mjs --legacy --dry-run --last-jornada-all --user-clear-late=Paula
 *
 * Forzar id de última jornada:
 *   export PORRA_JORNADA_ID=J38
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";

const TABLE = process.env.TABLE_NAME || process.env.DYNAMODB_TABLE || "";
const REGION = process.env.AWS_REGION || "eu-west-1";
const GROUP_ID = process.env.PORRA_GROUP_ID || "";
const FORCED_JORNADA_ID = process.env.PORRA_JORNADA_ID || "";

const argv = new Set(process.argv.slice(2));
const DRY = argv.has("--dry-run");
const LEGACY = argv.has("--legacy");
const LAST_ALL = argv.has("--last-jornada-all");
let USER_ARG = "";
for (const a of process.argv) {
  if (a.startsWith("--user-clear-late=")) USER_ARG = a.slice("--user-clear-late=".length);
}

function die(msg) {
  console.error(msg);
  process.exit(1);
}

async function queryAllPk(doc, pk) {
  const items = [];
  let ExclusiveStartKey;
  do {
    const r = await doc.send(new QueryCommand({
      TableName: TABLE,
      KeyConditionExpression: "pk = :pk",
      ExpressionAttributeValues: { ":pk": pk },
      ExclusiveStartKey,
    }));
    items.push(...(r.Items || []));
    ExclusiveStartKey = r.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return items;
}

function stripKeys(item) {
  const { pk, sk, ...rest } = item;
  return rest;
}

async function putBet(doc, pk, sk, nextData) {
  if (DRY) {
    console.log(`[dry-run] Put ${pk} ${sk} late=${nextData.late}`);
    return;
  }
  await doc.send(new PutCommand({ TableName: TABLE, Item: { pk, sk, ...nextData } }));
}

function lastFromOrder(order, fallbackIds) {
  if (FORCED_JORNADA_ID) return FORCED_JORNADA_ID;
  if (order?.length) return order[order.length - 1];
  if (fallbackIds?.length) return fallbackIds.sort().at(-1) || "";
  return "";
}

async function main() {
  if (!TABLE) die("Define TABLE_NAME o DYNAMODB_TABLE");
  if (!LAST_ALL && !USER_ARG) die("Indica al menos --last-jornada-all y/o --user-clear-late=Nombre");
  if (!LEGACY && !GROUP_ID) die("Define PORRA_GROUP_ID (o usa --legacy)");

  const doc = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));

  let lastJornada = "";
  let groupItems = [];

  if (LEGACY) {
    const meta = await doc.send(new GetCommand({ TableName: TABLE, Key: { pk: "FUT", sk: "CONFIG" } }));
    const order = meta.Item?.order || [];
    lastJornada = LAST_ALL ? lastFromOrder(order, []) : "";
    if (LAST_ALL && !lastJornada) die("Legacy: sin order en FUT/CONFIG; define PORRA_JORNADA_ID");

    if (LAST_ALL) {
      const rows = await queryAllPk(doc, `FUT#${lastJornada}`);
      let n = 0;
      for (const item of rows) {
        if (!item.sk?.startsWith("BET#")) continue;
        if (!item.late) continue;
        const data = stripKeys(item);
        data.late = false;
        await putBet(doc, item.pk, item.sk, data);
        n++;
      }
      console.log(DRY ? "Modo dry-run." : "OK.");
      console.log(`Legacy última jornada ${lastJornada}: late→false en ${n} apuestas`);
    }
    if (USER_ARG) {
      let u = 0;
      for (const jId of order.length ? order : []) {
        const rows = await queryAllPk(doc, `FUT#${jId}`);
        const bet = rows.find((i) => i.sk === `BET#${USER_ARG}`);
        if (bet?.late) {
          const data = stripKeys(bet);
          data.late = false;
          await putBet(doc, bet.pk, bet.sk, data);
          u++;
        }
      }
      console.log(`Legacy usuario "${USER_ARG}": late→false en ${u} apuestas (solo jornadas en order)`);
    }
    return;
  }


  groupItems = await queryAllPk(doc, `G#${GROUP_ID}`);
  const futMeta = groupItems.find((i) => i.sk === "FUT|CONFIG");
  const order = futMeta?.order || [];
  const configJornadas = [
    ...new Set(
      groupItems
        .filter((i) => i.sk?.startsWith("FUT#") && i.sk?.endsWith("|CONFIG"))
        .map((i) => i.sk.split("|")[0].replace("FUT#", "")),
    ),
  ];
  lastJornada = LAST_ALL ? lastFromOrder(order, configJornadas) : "";
  if (LAST_ALL && !lastJornada) die("Grupo: sin order ni CONFIG de jornadas; define PORRA_JORNADA_ID");

  const gpk = `G#${GROUP_ID}`;
  let updatedLast = 0;
  let updatedUser = 0;

  if (LAST_ALL) {
    const prefix = `FUT#${lastJornada}|BET#`;
    for (const item of groupItems) {
      if (item.pk !== gpk || !item.sk?.startsWith(prefix)) continue;
      if (!item.late) continue;
      const data = stripKeys(item);
      data.late = false;
      await putBet(doc, item.pk, item.sk, data);
      updatedLast++;
    }
  }

  if (USER_ARG) {
    const jornadasToWalk = order.length ? order : configJornadas;
    for (const jId of jornadasToWalk) {
      const sk = `FUT#${jId}|BET#${USER_ARG}`;
      const item = groupItems.find((i) => i.pk === gpk && i.sk === sk);
      if (item?.late) {
        const data = stripKeys(item);
        data.late = false;
        await putBet(doc, item.pk, item.sk, data);
        updatedUser++;
      }
    }
  }

  console.log(DRY ? "Modo dry-run (sin escrituras)." : "Escrituras aplicadas.");
  if (LAST_ALL) console.log(`Última jornada: ${lastJornada} — late→false (todos): ${updatedLast}`);
  if (USER_ARG) console.log(`Usuario "${USER_ARG}" — late→false (jornadas en order): ${updatedUser}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
