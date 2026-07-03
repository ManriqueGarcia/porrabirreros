#!/usr/bin/env node
/**
 * Actualiza los emparejamientos reales de octavos (wc-r16).
 * Reemplaza home/away "TBD" con los equipos confirmados del Mundial 2026.
 *
 * Emparejamientos (ganadores de dieciseisavos, 28 jun – 3 jul):
 *  P73 Canada def. Sudáfrica     P74 Paraguay def. Alemania (pens)
 *  P75 Marruecos def. P.Bajos (pens)  P76 Brasil def. Japón
 *  P77 Francia def. Suecia        P78 Noruega def. Costa de Marfil
 *  P79 México def. Ecuador        P80 Inglaterra def. R.D. Congo
 *  P81 Estados Unidos def. Bosnia P82 Bélgica def. Senegal (AET)
 *  P83 Portugal def. Croacia      P84 España def. Austria
 *  P85 Suiza def. Argelia         P86 Argentina def. Cabo Verde
 *  P87 Colombia def. Ghana        P88 Egipto def. Australia (pens)
 */
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";

const TABLE = "porra-f1";
const GROUP_ID = "birreros";
const REGION = "us-east-1";

const client = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }), {
  marshallOptions: { removeUndefinedValues: true },
});

// Orden según r16raw en mundial-fixtures.mjs (índice = posición en el array DB)
const REAL_TEAMS = [
  { home: "Paraguay",       away: "Francia"    }, // 0: match 89 — Filadelfia, 4 jul 21:00 UTC (Ganador P74 vs P77)
  { home: "Canadá",         away: "Marruecos"  }, // 1: match 90 — Houston, 4 jul 17:00 UTC    (Ganador P73 vs P75)
  { home: "Brasil",         away: "Noruega"    }, // 2: match 91 — NY/NJ, 5 jul 20:00 UTC      (Ganador P76 vs P78)
  { home: "México",         away: "Inglaterra" }, // 3: match 92 — Ciudad de México, 6 jul UTC  (Ganador P79 vs P80)
  { home: "Portugal",       away: "España"     }, // 4: match 93 — Dallas, 6 jul 19:00 UTC      (Ganador P83 vs P84)
  { home: "Estados Unidos", away: "Bélgica"    }, // 5: match 94 — Seattle, 7 jul 00:00 UTC     (Ganador P81 vs P82)
  { home: "Argentina",      away: "Egipto"     }, // 6: match 95 — Atlanta, 7 jul 16:00 UTC     (Ganador P86 vs P88)
  { home: "Suiza",          away: "Colombia"   }, // 7: match 96 — Vancouver, 7 jul 20:00 UTC   (Ganador P85 vs P87)
];

async function main() {
  const pk = `G#${GROUP_ID}`;
  const sk = `MUN#wc-r16|CONFIG`;

  const { Item } = await client.send(new GetCommand({ TableName: TABLE, Key: { pk, sk } }));
  if (!Item) { console.error("ERROR: MUN#wc-r16|CONFIG no encontrado"); process.exit(1); }

  const updatedMatches = Item.matches.map((m, i) => {
    const teams = REAL_TEAMS[i];
    if (!teams) { console.warn(`  WARN: no hay equipos definidos para índice ${i}`); return m; }
    return { ...m, home: teams.home, away: teams.away };
  });

  await client.send(new PutCommand({ TableName: TABLE, Item: { ...Item, pk, sk, matches: updatedMatches } }));
  console.log("OK — wc-r16 actualizado con equipos reales:");
  updatedMatches.forEach((m, i) => console.log(`  [${i}] ${m.home} vs ${m.away} — ${m.kickoff?.substring(0,16)}`));
}

main().catch(e => { console.error("ERROR:", e.message); process.exit(1); });
