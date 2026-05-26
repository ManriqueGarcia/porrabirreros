#!/usr/bin/env node
/**
 * Elimina una jornada de fútbol de DynamoDB (CONFIG, apuestas, resultados, ventana, reveal, historial)
 * y la quita del array `order` en FUT|CONFIG (grupo) o FUT/CONFIG (legacy).
 *
 * Uso (producción — Sporting no juega J36 / jornada duplicada por semana, etc.):
 *
 *   export AWS_REGION=eu-west-1
 *   export TABLE_NAME=PorraBirreros
 *   export PORRA_GROUP_ID=tu-grupo
 *   export PORRA_JORNADA_ID=J36   # opcional, default J36
 *
 *   node scripts/remove-futbol-jornada.mjs --dry-run
 *   node scripts/remove-futbol-jornada.mjs
 *
 * Legacy (sin G#):
 *   node scripts/remove-futbol-jornada.mjs --legacy
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, DeleteCommand, GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";

const TABLE = process.env.TABLE_NAME || process.env.DYNAMODB_TABLE || "";
const REGION = process.env.AWS_REGION || "eu-west-1";
const GROUP_ID = process.env.PORRA_GROUP_ID || "";
const JORNADA_ID = (process.env.PORRA_JORNADA_ID || "J36").trim();

const DRY = process.argv.includes("--dry-run");
const LEGACY = process.argv.includes("--legacy");

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

async function main() {
  if (!TABLE) die("Define TABLE_NAME o DYNAMODB_TABLE");
  if (!JORNADA_ID) die("Define PORRA_JORNADA_ID");
  if (!LEGACY && !GROUP_ID) die("Define PORRA_GROUP_ID o usa --legacy");

  const doc = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));

  if (LEGACY) {
    const rows = await queryAllPk(doc, `FUT#${JORNADA_ID}`);
    console.log(`Legacy pk=FUT#${JORNADA_ID}: ${rows.length} items`);
    for (const it of rows) {
      if (DRY) console.log(`[dry-run] Delete ${it.pk} ${it.sk}`);
      else await doc.send(new DeleteCommand({ TableName: TABLE, Key: { pk: it.pk, sk: it.sk } }));
    }
    const meta = await doc.send(new GetCommand({ TableName: TABLE, Key: { pk: "FUT", sk: "CONFIG" } }));
    const order = (meta.Item?.order || []).filter((id) => id !== JORNADA_ID);
    if (!DRY && meta.Item) {
      const { pk, sk, ...rest } = meta.Item;
      await doc.send(new PutCommand({ TableName: TABLE, Item: { pk: "FUT", sk: "CONFIG", ...rest, order } }));
    } else if (DRY) console.log("[dry-run] FUT/CONFIG order sin", JORNADA_ID, "→", order.join(","));
    console.log(DRY ? "Dry-run terminado." : "Legacy: jornada eliminada y order actualizado.");
    return;
  }

  const gpk = `G#${GROUP_ID}`;
  const prefix = `FUT#${JORNADA_ID}|`;
  const groupItems = await queryAllPk(doc, gpk);
  const toDelete = groupItems.filter((i) => i.sk?.startsWith(prefix));
  console.log(`${gpk} items con ${prefix}: ${toDelete.length}`);
  for (const it of toDelete) {
    if (DRY) console.log(`[dry-run] Delete ${it.pk} ${it.sk}`);
    else await doc.send(new DeleteCommand({ TableName: TABLE, Key: { pk: it.pk, sk: it.sk } }));
  }

  const futConf = await doc.send(new GetCommand({ TableName: TABLE, Key: { pk: gpk, sk: "FUT|CONFIG" } }));
  const order = (futConf.Item?.order || []).filter((id) => id !== JORNADA_ID);
  if (futConf.Item) {
    if (DRY) console.log("[dry-run] Put FUT|CONFIG order:", order.join(",") || "(vacío)");
    else {
      const { pk, sk, ...rest } = futConf.Item;
      await doc.send(new PutCommand({ TableName: TABLE, Item: { pk: gpk, sk: "FUT|CONFIG", ...rest, order } }));
    }
  } else {
    console.warn("No existe FUT|CONFIG en el grupo; order no actualizado.");
  }

  console.log(DRY ? "Dry-run terminado." : "Grupo: jornada eliminada y order actualizado.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
