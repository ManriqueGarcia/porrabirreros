#!/usr/bin/env node
/**
 * Inserta la jornada wc-champion en DynamoDB y actualiza el order en MUN|CONFIG.
 * Ejecutar desde el directorio raíz del proyecto con credenciales AWS activas.
 */
import { DynamoDBClient, GetItemCommand, PutItemCommand, UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";

const TABLE = "porra-f1";
const PK = "G#birreros";
const REGION = "us-east-1";

const client = new DynamoDBClient({ region: REGION });

const CHAMPION_JORNADA = {
  id: "wc-champion",
  name: "Mundial · ¿Quién ganará?",
  phase: "champion",
  deadline: "2026-07-04T16:59:00.000Z",
  matches: [],
};

async function get(sk) {
  const res = await client.send(new GetItemCommand({
    TableName: TABLE,
    Key: marshall({ pk: PK, sk }),
  }));
  return res.Item ? unmarshall(res.Item) : null;
}

async function main() {
  // 1. Leer CONFIG global de mundial para obtener el order actual
  const globalConfig = await get("MUN|CONFIG");
  if (!globalConfig) {
    console.error("ERROR: No se encontró MUN|CONFIG. ¿Está inicializado el mundial?");
    process.exit(1);
  }
  const mundial = globalConfig.state ? JSON.parse(globalConfig.state) : globalConfig;
  const currentOrder = mundial.order || [];
  console.log("Order actual:", currentOrder);

  if (currentOrder.includes("wc-champion")) {
    console.log("wc-champion ya está en el order. Nada que hacer para el order.");
  }

  // 2. Insertar CONFIG de la jornada wc-champion
  const jornadaSk = "MUN#wc-champion|CONFIG";
  const existing = await get(jornadaSk);
  if (existing) {
    console.log("La jornada wc-champion ya existe en DynamoDB:", existing);
  } else {
    await client.send(new PutItemCommand({
      TableName: TABLE,
      Item: marshall({
        pk: PK,
        sk: jornadaSk,
        ...CHAMPION_JORNADA,
      }),
    }));
    console.log("✅ Insertada jornada wc-champion");
  }

  // 3. Actualizar el order en MUN|CONFIG para incluir wc-champion después de wc-r16
  if (!currentOrder.includes("wc-champion")) {
    const r16Idx = currentOrder.indexOf("wc-r16");
    const newOrder = [...currentOrder];
    if (r16Idx >= 0) {
      newOrder.splice(r16Idx + 1, 0, "wc-champion");
    } else {
      // Si no hay wc-r16, añadir al final antes de wc-qf
      const qfIdx = newOrder.indexOf("wc-qf");
      if (qfIdx >= 0) newOrder.splice(qfIdx, 0, "wc-champion");
      else newOrder.push("wc-champion");
    }
    console.log("Nuevo order:", newOrder);

    // El estado global puede estar en globalConfig.state (JSON string) o como campos directos
    if (globalConfig.state) {
      const parsed = JSON.parse(globalConfig.state);
      parsed.order = newOrder;
      if (parsed.jornadas) parsed.jornadas["wc-champion"] = { ...CHAMPION_JORNADA };
      await client.send(new UpdateItemCommand({
        TableName: TABLE,
        Key: marshall({ pk: PK, sk: "MUN|CONFIG" }),
        UpdateExpression: "SET #s = :s",
        ExpressionAttributeNames: { "#s": "state" },
        ExpressionAttributeValues: marshall({ ":s": JSON.stringify(parsed) }),
      }));
    } else {
      // Guardar order directamente
      await client.send(new UpdateItemCommand({
        TableName: TABLE,
        Key: marshall({ pk: PK, sk: "MUN|CONFIG" }),
        UpdateExpression: "SET #o = :o",
        ExpressionAttributeNames: { "#o": "order" },
        ExpressionAttributeValues: marshall({ ":o": newOrder }),
      }));
    }
    console.log("✅ Order actualizado en MUN|CONFIG");
  }

  console.log("\n✅ Migración completa. La jornada 'Mundial · ¿Quién ganará?' está lista.");
}

main().catch((err) => { console.error(err); process.exit(1); });
