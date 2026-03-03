import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";

const TABLE = process.env.STATE_TABLE;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "*";
const API_SECRET = process.env.API_SECRET || "";
const MAX_BODY_BYTES = 500 * 1024; // 500KB máximo para evitar abusos
const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));

function buildHeaders(extra = {}) {
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Headers": "content-type,x-porra-secret",
    "Access-Control-Allow-Methods": "PUT,OPTIONS",
    "Cache-Control": "no-store, max-age=0, must-revalidate",
    ...extra,
  };
}

function unauthorized() {
  return {
    statusCode: 401,
    headers: buildHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ error: "Unauthorized" }),
  };
}

function badRequest(message) {
  return {
    statusCode: 400,
    headers: buildHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ error: message }),
  };
}

export const handler = async (event) => {
  if (!TABLE) {
    console.error("Missing STATE_TABLE env var");
    return { statusCode: 500, headers: buildHeaders(), body: "" };
  }
  const headers = Object.fromEntries(Object.entries(event.headers || {}).map(([k, v]) => [k.toLowerCase(), v]));
  if (API_SECRET && headers["x-porra-secret"] !== API_SECRET) {
    return unauthorized();
  }
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: buildHeaders(), body: "" };
  }
  const bodyStr = event.body || "";
  if (!bodyStr) return badRequest("Empty body");
  if (Buffer.byteLength(bodyStr, "utf8") > MAX_BODY_BYTES) return badRequest("Payload too large");

  let payload;
  try {
    payload = JSON.parse(bodyStr);
  } catch {
    return badRequest("Invalid JSON");
  }
  if (typeof payload !== "object" || payload === null) return badRequest("Payload must be an object");

  try {
    await docClient.send(new PutCommand({
      TableName: TABLE,
      Item: {
        pk: "state",
        sk: "state",
        data: payload,
        updatedAt: new Date().toISOString(),
      },
    }));
    return {
      statusCode: 204,
      headers: buildHeaders(),
      body: "",
    };
  } catch (err) {
    console.error("porra-put failed", err);
    return {
      statusCode: 500,
      headers: buildHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ error: "Server error" }),
    };
  }
};
