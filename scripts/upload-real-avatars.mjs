#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const DIR = path.join(process.cwd(), "avatares_reales");
const PARTICIPANTES = process.env.PORRA_PARTICIPANTS?.split(",") || ["Jugador1", "Jugador2", "Jugador3"];
const MODOS = ["f1", "futbol"];

// Formatos permitidos
const EXTS = [".png", ".jpg", ".jpeg", ".webp"];

function getFile(name, mode) {
  for (const ext of EXTS) {
    const file = path.join(DIR, `${name}-${mode}${ext}`);
    if (fs.existsSync(file)) return file;
  }
  return null;
}

function getMimeType(file) {
  const ext = path.extname(file).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  return "image/jpeg";
}

async function run() {
  if (!fs.existsSync(DIR)) {
    console.error(`❌ La carpeta ${DIR} no existe. Créala y mete ahí las imágenes.`);
    process.exit(1);
  }

  const f1Avatars = {};
  const futbolAvatars = {};
  let encontrados = 0;

  for (const name of PARTICIPANTES) {
    // Buscar F1
    const fileF1 = getFile(name, "f1");
    if (fileF1) {
      const b64 = fs.readFileSync(fileF1).toString("base64");
      f1Avatars[name] = `data:${getMimeType(fileF1)};base64,${b64}`;
      encontrados++;
      console.log(`✅ Encontrado ${name} F1`);
    } else {
      console.log(`⚠️  Falta ${name}-f1`);
    }

    // Buscar Futbol
    const fileFutbol = getFile(name, "futbol");
    if (fileFutbol) {
      const b64 = fs.readFileSync(fileFutbol).toString("base64");
      futbolAvatars[name] = `data:${getMimeType(fileFutbol)};base64,${b64}`;
      encontrados++;
      console.log(`✅ Encontrado ${name} Fútbol`);
    } else {
      console.log(`⚠️  Falta ${name}-futbol`);
    }
  }

  if (encontrados === 0) {
    console.error("❌ No se encontró ninguna imagen válida.");
    process.exit(1);
  }

  console.log(`\nSubiendo ${encontrados} imágenes a DynamoDB...`);

  const avatarsM = {};
  for (const [name, url] of Object.entries(f1Avatars)) {
    avatarsM[name] = { S: url };
  }
  
  const avatarsFutbolM = {};
  for (const [name, url] of Object.entries(futbolAvatars)) {
    avatarsFutbolM[name] = { S: url };
  }

  // Obtenemos los avatares actuales de la BD para hacer merge (por si solo subes 1 o 2 imágenes nuevas)
  const tbl = process.env.DYNAMODB_TABLE || "PorraBirreros";
  const grp = process.env.PORRA_GROUP_ID || "tu-grupo";
  const rgn = process.env.AWS_REGION || "eu-west-1";
  let currentMeta = null;
  try {
    const res = execSync(`aws dynamodb get-item --table-name ${tbl} --region ${rgn} --key '{"pk":{"S":"G#${grp}"},"sk":{"S":"META|CONFIG"}}' --projection-expression "avatars,avatarsFutbol"`, { encoding: "utf8" });
    const parsed = JSON.parse(res);
    if (parsed.Item) {
      if (parsed.Item.avatars?.M) Object.assign(avatarsM, parsed.Item.avatars.M, avatarsM); // Prioriza los nuevos
      if (parsed.Item.avatarsFutbol?.M) Object.assign(avatarsFutbolM, parsed.Item.avatarsFutbol.M, avatarsFutbolM);
    }
  } catch (err) {
    console.warn("No se pudo obtener el estado previo, se sobreescribirán.");
  }

  const updateExpr = "SET avatars = :av, avatarsFutbol = :avf";
  const exprValues = JSON.stringify({
    ":av": { M: avatarsM },
    ":avf": { M: avatarsFutbolM },
  });

  const cmd = `aws dynamodb update-item --table-name ${tbl} --region ${rgn} --key '${JSON.stringify({
    pk: { S: `G#${grp}` },
    sk: { S: "META|CONFIG" },
  })}' --update-expression '${updateExpr}' --expression-attribute-values '${exprValues}'`;

  try {
    execSync(cmd, { stdio: "pipe" });
    console.log("🎉 ¡Imágenes subidas a la base de datos correctamente!");
  } catch (err) {
    console.error("❌ Error al subir:", err.stderr?.toString() || err.message);
  }
}

run();