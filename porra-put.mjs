import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";

const TABLE = process.env.STATE_TABLE;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "*";
const API_SECRET = process.env.API_SECRET || "";
const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));

function buildHeaders(extra = {}) {
  return {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Headers": "content-type,x-porra-secret",
    "Access-Control-Allow-Methods": "GET,OPTIONS",
    "Cache-Control": "no-store, max-age=0, must-revalidate",
    ...extra,
  };
}

export const handler = async (event) => {
  if (!TABLE) {
    console.error("Missing STATE_TABLE env var");
    return { statusCode: 500, headers: buildHeaders(), body: JSON.stringify({ error: "Server error" }) };
  }
  if (event?.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: buildHeaders(), body: "" };
  }
  const headers = Object.fromEntries(Object.entries(event?.headers || {}).map(([k, v]) => [k.toLowerCase(), v]));
  if (API_SECRET && headers["x-porra-secret"] !== API_SECRET) {
    return { statusCode: 401, headers: buildHeaders(), body: JSON.stringify({ error: "Unauthorized" }) };
  }
  try {
    const result = await docClient.send(new GetCommand({
      TableName: TABLE,
      Key: { pk: "state", sk: "state" },
    }));
    const payload = result.Item?.data || {};
    return {
      statusCode: result.Item ? 200 : 404,
      headers: buildHeaders(),
      body: JSON.stringify(payload),
    };
  } catch (err) {
    console.error("porra-get failed", err);
    return {
      statusCode: 500,
      headers: buildHeaders(),
      body: JSON.stringify({ error: "Server error" }),
    };
  }
};
