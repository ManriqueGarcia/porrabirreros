#!/usr/bin/env node
/**
 * auto-bracket.mjs — Propaga ganadores/perdedores entre rondas KO
 *
 * Lee resultados introducidos por el admin en DynamoDB y actualiza
 * automáticamente los emparejamientos de la siguiente ronda.
 *
 * Funciona para: Octavos → Cuartos → Semis → (3er puesto + Final)
 *
 * Uso:
 *   node scripts/auto-bracket.mjs            # ejecutar una vez
 *   node scripts/auto-bracket.mjs --watch    # bucle cada 2h
 *   node scripts/auto-bracket.mjs --dry-run  # simular sin escribir en DB
 */
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";

const TABLE = "porra-f1";
const GROUP_ID = "birreros";
const REGION = "us-east-1";
const INTERVAL_MS = 2 * 60 * 60 * 1000; // 2 horas

const WATCH = process.argv.includes("--watch");
const DRY = process.argv.includes("--dry-run");

const client = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }), {
  marshallOptions: { removeUndefinedValues: true },
});

const KO_JORNADAS = ["wc-r32", "wc-r16", "wc-qf", "wc-sf", "wc-3p", "wc-final"];
// Rondas que pueden actualizarse (las que tienen TBD a resolver)
const TARGET_JORNADAS = ["wc-r16", "wc-qf", "wc-sf", "wc-3p", "wc-final"];

// --- DynamoDB helpers --------------------------------------------------------

async function getConfig(jornadaId) {
  const { Item } = await client.send(new GetCommand({
    TableName: TABLE,
    Key: { pk: `G#${GROUP_ID}`, sk: `MUN#${jornadaId}|CONFIG` },
  }));
  return Item ?? null;
}

async function getResult(jornadaId) {
  const { Item } = await client.send(new GetCommand({
    TableName: TABLE,
    Key: { pk: `G#${GROUP_ID}`, sk: `MUN#${jornadaId}|RESULT` },
  }));
  return Item ?? null;
}

async function saveConfig(jornadaId, item) {
  if (DRY) return;
  await client.send(new PutCommand({
    TableName: TABLE,
    Item: { ...item, pk: `G#${GROUP_ID}`, sk: `MUN#${jornadaId}|CONFIG` },
  }));
}

// --- Lógica de bracket -------------------------------------------------------

/**
 * Dado el CONFIG de un partido (con nombres de equipos) y su RESULT (con goles),
 * devuelve el nombre del equipo ganador, o null si no hay resultado completo.
 */
function determineWinner(configMatch, resultMatch) {
  if (!resultMatch) return null;
  const { home: hGoals, away: aGoals, penWinner } = resultMatch;
  if (hGoals == null || aGoals == null) return null;
  if (hGoals > aGoals) return configMatch.home;
  if (aGoals > hGoals) return configMatch.away;
  // Empate → prórroga/penaltis: necesitamos penWinner
  return penWinner ?? null;
}

function determineLoser(configMatch, resultMatch) {
  const winner = determineWinner(configMatch, resultMatch);
  if (!winner) return null;
  return winner === configMatch.home ? configMatch.away : configMatch.home;
}

/**
 * Parsea labels del tipo:
 *   "Ganador P74"   → { type: 'winner', matchId: 74 }
 *   "Perdedor P97"  → { type: 'loser',  matchId: 97 }
 *   "Ganador SF1"   → { type: 'winner', sfIndex: 0 }
 *   "Perdedor SF2"  → { type: 'loser',  sfIndex: 1 }
 */
function parseLabel(label) {
  if (!label) return null;
  let m;
  m = label.match(/^Ganador P(\d+)$/);
  if (m) return { type: "winner", matchId: Number(m[1]) };
  m = label.match(/^Perdedor P(\d+)$/);
  if (m) return { type: "loser", matchId: Number(m[1]) };
  m = label.match(/^Ganador SF(\d+)$/);
  if (m) return { type: "winner", sfIndex: Number(m[1]) - 1 };
  m = label.match(/^Perdedor SF(\d+)$/);
  if (m) return { type: "loser", sfIndex: Number(m[1]) - 1 };
  return null;
}

// --- Ciclo principal ---------------------------------------------------------

async function run() {
  const ts = new Date().toISOString().replace("T", " ").substring(0, 16);
  console.log(`\n[${ts}]${DRY ? " [DRY-RUN]" : ""} Revisando bracket mundial...`);

  // Cargar todos los CONFIG y RESULT
  const configs = {};
  const results = {};
  for (const jId of KO_JORNADAS) {
    [configs[jId], results[jId]] = await Promise.all([getConfig(jId), getResult(jId)]);
  }

  // Índice matchId → { configMatch, resultMatch }
  const matchIndex = {};
  for (const jId of KO_JORNADAS) {
    const cfg = configs[jId];
    const res = results[jId];
    (cfg?.matches ?? []).forEach((m, i) => {
      if (m.matchId == null) return;
      matchIndex[m.matchId] = {
        configMatch: m,
        resultMatch: res?.matches?.[i] ?? null,
      };
    });
  }

  // Acceso directo a los partidos de semifinal (para labels "SF1/SF2")
  const sfConfig = configs["wc-sf"]?.matches ?? [];
  const sfResult = results["wc-sf"]?.matches ?? [];

  let totalUpdated = 0;

  for (const jId of TARGET_JORNADAS) {
    const cfg = configs[jId];
    if (!cfg?.matches?.length) { console.log(`  WARN: ${jId} CONFIG no encontrado`); continue; }

    let changed = false;
    const updatedMatches = cfg.matches.map((m) => {
      const homeNeedsFill = m.home === "TBD";
      const awayNeedsFill = m.away === "TBD";
      if (!homeNeedsFill && !awayNeedsFill) return m;

      const resolveTeam = (label) => {
        const parsed = parseLabel(label);
        if (!parsed) return null;

        if (parsed.sfIndex !== undefined) {
          const sfCfg = sfConfig[parsed.sfIndex];
          const sfRes = sfResult[parsed.sfIndex];
          if (!sfCfg || sfCfg.home === "TBD") return null; // SF sin equipos aún
          return parsed.type === "winner"
            ? determineWinner(sfCfg, sfRes)
            : determineLoser(sfCfg, sfRes);
        }

        const entry = matchIndex[parsed.matchId];
        if (!entry) return null;
        if (entry.configMatch.home === "TBD") return null; // fuente aún sin equipos
        return parsed.type === "winner"
          ? determineWinner(entry.configMatch, entry.resultMatch)
          : determineLoser(entry.configMatch, entry.resultMatch);
      };

      const newHome = homeNeedsFill ? resolveTeam(m.homeLabel) : m.home;
      const newAway = awayNeedsFill ? resolveTeam(m.awayLabel) : m.away;

      const homeResolved = homeNeedsFill && newHome !== null;
      const awayResolved = awayNeedsFill && newAway !== null;
      if (!homeResolved && !awayResolved) return m;

      changed = true;
      return { ...m, home: newHome ?? m.home, away: newAway ?? m.away };
    });

    if (changed) {
      const updates = updatedMatches.filter((m, i) =>
        m.home !== cfg.matches[i].home || m.away !== cfg.matches[i].away
      );
      await saveConfig(jId, { ...cfg, matches: updatedMatches });
      for (const m of updates) {
        console.log(`  ✓ ${jId}: ${m.home} vs ${m.away} — ${m.kickoff?.substring(0, 16) ?? ""}`);
      }
      totalUpdated += updates.length;
    }
  }

  if (totalUpdated === 0) {
    console.log("  Sin cambios. Todos los TBDs pendientes de resultado.");
  } else {
    console.log(`  ${totalUpdated} partido(s) actualizado(s).`);
  }
}

async function main() {
  if (DRY) console.log("Modo DRY-RUN: no se escribirá en DynamoDB.\n");
  await run();
  if (WATCH) {
    const h = INTERVAL_MS / 3_600_000;
    console.log(`\nModo --watch: próxima revisión en ${h}h. Ctrl+C para detener.`);
    setInterval(run, INTERVAL_MS);
  }
}

main().catch(e => { console.error("ERROR:", e.message); process.exit(1); });
