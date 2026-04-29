#!/usr/bin/env node
/**
 * Empaqueta handlers con esbuild (formato CJS) y despliega en AWS Lambda (runtime nodejs24.x).
 * Nota: bundle ESM rompe @aws-sdk en runtime (Dynamic require of "buffer" is not supported).
 *
 * Regiones y funciones (cuenta del proyecto):
 * - eu-west-1: porra-ai
 * - us-east-1: porra-state-api, porra-state-api-dev, porra-get, porra-put
 *
 * Nota: en el repo, porra-get.mjs contiene la lógica PUT y porra-put.mjs la GET
 * (nombres históricos cruzados). El API Gateway enruta GET→Lambda porra-get y PUT→porra-put.
 *
 * Credenciales: usa el perfil AWS **`default`** (`~/.aws/credentials`). Para otro perfil:
 *   AWS_PROFILE=mi-perfil npm run deploy:lambda
 */
import { execFileSync, spawnSync } from "child_process";
import { mkdtempSync, readFileSync, rmSync, mkdirSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const ROOT = join(__dirname, "..");
const ESBUILD = join(ROOT, "node_modules", ".bin", "esbuild");

const RUNTIME = "nodejs24.x";
const TARGET = "node24";

/** Perfil AWS CLI: `default` si no defines la variable de entorno `AWS_PROFILE`. */
const AWS_PROFILE = process.env.AWS_PROFILE ?? "default";

const DEPLOYMENTS = [
  {
    region: "eu-west-1",
    functionName: "porra-ai",
    source: "porra-ai.mjs",
    outFile: "porra-ai.js",
    handler: "porra-ai.handler",
  },
  {
    region: "us-east-1",
    functionName: "porra-state-api",
    source: "porra-state-api.mjs",
    outFile: "porra-state-api.js",
    handler: "porra-state-api.handler",
  },
  {
    region: "us-east-1",
    functionName: "porra-state-api-dev",
    source: "porra-state-api.mjs",
    outFile: "porra-state-api.js",
    handler: "porra-state-api.handler",
  },
  {
    region: "us-east-1",
    functionName: "porra-get",
    source: "porra-put.mjs",
    outFile: "index.js",
    handler: "index.handler",
  },
  {
    region: "us-east-1",
    functionName: "porra-put",
    source: "porra-get.mjs",
    outFile: "index.js",
    handler: "index.handler",
  },
];

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, {
    encoding: "utf8",
    stdio: ["inherit", "pipe", "pipe"],
    ...opts,
  });
  if (r.status !== 0) {
    console.error(r.stderr || r.stdout);
    throw new Error(`${cmd} ${args.join(" ")} failed: ${r.status}`);
  }
  return r.stdout;
}

/** Invoca AWS CLI con `--profile` fijado (por defecto `default`). */
function aws(args) {
  return run("aws", ["--profile", AWS_PROFILE, ...args]);
}

function bundle(sourceFile, outPath) {
  execFileSync(
    ESBUILD,
    [
      join(ROOT, sourceFile),
      "--bundle",
      "--platform=node",
      `--target=${TARGET}`,
      "--format=cjs",
      `--outfile=${outPath}`,
    ],
    { stdio: "inherit" }
  );
}

function zipDir(dir, zipPath) {
  run("zip", ["-q", "-r", zipPath, "."], { cwd: dir });
}

function main() {
  const dry = process.argv.includes("--dry-run");
  console.log(`Perfil AWS: ${AWS_PROFILE}`);
  const tmp = mkdtempSync(join(tmpdir(), "porra-lambda-"));
  try {
    for (const d of DEPLOYMENTS) {
      const stage = join(tmp, d.functionName);
      mkdirSync(stage, { recursive: true });
      const outJs = join(stage, d.outFile);
      console.log(`\n→ ${d.functionName} (${d.region}): bundle ${d.source} → ${d.outFile}`);
      bundle(d.source, outJs);
      const zipPath = join(tmp, `${d.functionName}.zip`);
      zipDir(stage, zipPath);
      const size = readFileSync(zipPath).length;
      console.log(`   zip ${(size / 1024).toFixed(0)} KB`);

      if (dry) {
        console.log("   (dry-run: no aws)");
        continue;
      }

      aws([
        "lambda",
        "update-function-code",
        "--function-name",
        d.functionName,
        "--region",
        d.region,
        "--zip-file",
        `fileb://${zipPath}`,
      ]);

      aws([
        "lambda",
        "wait",
        "function-updated",
        "--function-name",
        d.functionName,
        "--region",
        d.region,
      ]);

      aws([
        "lambda",
        "update-function-configuration",
        "--function-name",
        d.functionName,
        "--region",
        d.region,
        "--runtime",
        RUNTIME,
      ]);

      aws([
        "lambda",
        "wait",
        "function-updated",
        "--function-name",
        d.functionName,
        "--region",
        d.region,
      ]);

      const rt = aws([
        "lambda",
        "get-function-configuration",
        "--function-name",
        d.functionName,
        "--region",
        d.region,
        "--query",
        "Runtime",
        "--output",
        "text",
      ]).trim();
      console.log(`   OK runtime=${rt}`);
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
  console.log("\nDespliegue completado.");
}

main();
