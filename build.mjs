import { build } from "esbuild";
import { readFileSync, writeFileSync, mkdirSync, cpSync, rmSync, existsSync, renameSync, readdirSync } from "fs";
import { execSync } from "child_process";
import { createHash } from "crypto";
import { gzipSync } from "zlib";
import { resolve } from "path";

function loadEnv() {
  const env = {};
  const envFiles = [".env", ".env.local"];
  for (const f of envFiles) {
    if (!existsSync(f)) continue;
    for (const line of readFileSync(f, "utf-8").split("\n")) {
      const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*"?([^"#]*)"?\s*$/);
      if (m) env[m[1]] = m[2].trim();
    }
  }
  return env;
}

const dotenv = loadEnv();
const PORRA_API_BASE = process.env.PORRA_API_BASE || dotenv.PORRA_API_BASE || "";
const PORRA_AI_URL = process.env.PORRA_AI_URL || dotenv.PORRA_AI_URL || "";
const PORRA_DOMAIN = process.env.PORRA_DOMAIN || dotenv.PORRA_DOMAIN || "";

const useLocalConfig = existsSync("src/config.local.js");
if (useLocalConfig) {
  console.log("📌 Usando src/config.local.js (configuración local)\n");
} else {
  console.log("⚠️  No se encontró src/config.local.js — usando config.js genérico\n");
  console.log("   Copia src/config.js a src/config.local.js y personaliza tus datos.\n");
}

function contentHash(filepath) {
  return createHash("md5").update(readFileSync(filepath)).digest("hex").slice(0, 8);
}

function gzipFile(filepath) {
  const data = readFileSync(filepath);
  const compressed = gzipSync(data, { level: 9 });
  writeFileSync(`${filepath}.gz`, compressed);
  const ratio = ((1 - compressed.length / data.length) * 100).toFixed(0);
  return { original: data.length, compressed: compressed.length, ratio };
}

const DIST = "dist";

console.log("🔨 Build Porra Birreros...\n");

if (existsSync(DIST)) rmSync(DIST, { recursive: true });
mkdirSync(DIST, { recursive: true });

// 1. Build JS (modular entry point)
console.log("📦 Compilando src/index.jsx...");
try {
  const esbuildPlugins = [];
  if (useLocalConfig) {
    esbuildPlugins.push({
      name: "config-local",
      setup(b) {
        b.onResolve({ filter: /\.\/config\.js$/ }, (args) => {
          if (args.importer && args.importer.includes("src/")) {
            return { path: resolve("src/config.local.js") };
          }
        });
      },
    });
  }

  await build({
    entryPoints: ["src/index.jsx"],
    bundle: true,
    minify: true,
    sourcemap: true,
    outfile: `${DIST}/app.js`,
    target: "es2020",
    format: "iife",
    jsx: "automatic",
    define: { "process.env.NODE_ENV": '"production"' },
    legalComments: "none",
    plugins: esbuildPlugins,
  });

  console.log("  ✅ dist/app.js");
} catch (err) {
  console.error("  ❌ Error compilando JS:", err.message);
  process.exit(1);
}

// 2. Build CSS — Tailwind v4
console.log("🎨 Compilando CSS (Tailwind)...");
try {
  execSync(`npx @tailwindcss/cli -i ./src.css -o ./${DIST}/styles.css --minify`, { stdio: "pipe" });
  console.log("  ✅ dist/styles.css");
} catch (err) {
  console.error("  ❌ Error en Tailwind:", err.stderr?.toString() || err.message);
  process.exit(1);
}

// 3. Build index.html
console.log("📄 Generando index.html...");
let html = readFileSync("index.html", "utf-8");

html = html.replace(/<script src="https:\/\/cdn\.tailwindcss\.com"><\/script>\n?\s*/g, "");
html = html.replace(/<script src="\.\/assets\/vendor\/react\.js[^"]*"><\/script>\n?\s*/g, "");
html = html.replace(/<script src="\.\/assets\/vendor\/react-dom\.js[^"]*"><\/script>\n?\s*/g, "");
html = html.replace(/<script src="\.\/assets\/vendor\/babel\.js[^"]*"><\/script>\n?\s*/g, "");
html = html.replace(/<style>[\s\S]*?<\/style>\n?\s*/g, "");

const jsHash = contentHash(`${DIST}/app.js`);
const cssHash = contentHash(`${DIST}/styles.css`);
const jsHashed = `app.${jsHash}.js`;
const cssHashed = `styles.${cssHash}.css`;

renameSync(`${DIST}/app.js`, `${DIST}/${jsHashed}`);
renameSync(`${DIST}/app.js.map`, `${DIST}/${jsHashed}.map`);
renameSync(`${DIST}/styles.css`, `${DIST}/${cssHashed}`);
console.log(`  📎 app.js → ${jsHashed}`);
console.log(`  📎 styles.css → ${cssHashed}`);

html = html.replace(
  /<script type="text\/babel"[^>]*src="\.\/app\.jsx[^"]*"[^>]*><\/script>/g,
  `<script src="./${jsHashed}"></script>`
);
html = html.replace("</head>", `  <link rel="stylesheet" href="./${cssHashed}">\n</head>`);

const connectSources = ["'self'", "https://api.jolpi.ca"];
if (PORRA_API_BASE) connectSources.push(PORRA_API_BASE);
if (PORRA_AI_URL) connectSources.push(PORRA_AI_URL);
html = html.replace(
  /content="default-src 'self';[^"]*"/,
  `content="default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; img-src 'self' data: https://images.unsplash.com; connect-src ${connectSources.join(" ")}; font-src 'self' data:; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self';"`
);

if (PORRA_DOMAIN) {
  html = html.replace(/content="https:\/\/[^"]*"/, `content="${PORRA_DOMAIN}"`);
  html = html.replace(/href="https:\/\/porra\.[^"]*"/, `href="${PORRA_DOMAIN}"`);
} else {
  html = html.replace(/<meta property="og:url"[^>]*>\n?\s*/g, "");
  html = html.replace(/<link rel="preconnect" href="https:\/\/porra\.[^"]*">\n?\s*/g, "");
}

html = html.replace(
  /window\.PORRA_API_BASE\s*=\s*"[^"]*"/,
  `window.PORRA_API_BASE = "${PORRA_API_BASE}"`
);
html = html.replace(
  /window\.PORRA_AI_URL\s*=\s*"[^"]*"/,
  `window.PORRA_AI_URL = "${PORRA_AI_URL}"`
);

html = html.replace(/<script>\s*\/\/ Verificar que los scripts[\s\S]*?<\/script>\n?\s*/g, "");

writeFileSync(`${DIST}/index.html`, html);
console.log("  ✅ dist/index.html");

// 4. Copy assets (excluding vendor)
console.log("📁 Copiando assets...");
cpSync("assets", `${DIST}/assets`, {
  recursive: true,
  filter: (src) => !src.includes("assets/vendor"),
});
console.log("  ✅ dist/assets/");

// 5. Copy PWA files
if (existsSync("manifest.json")) { cpSync("manifest.json", `${DIST}/manifest.json`); console.log("  ✅ manifest.json"); }
if (existsSync("sw.js")) { cpSync("sw.js", `${DIST}/sw.js`); console.log("  ✅ sw.js"); }

// 6. Optimize images (convert large JPGs to WebP if sharp available, otherwise compress)
console.log("🖼️ Optimizando imágenes...");
const imgDir = `${DIST}/assets/avatars`;
if (existsSync(imgDir)) {
  for (const file of readdirSync(imgDir)) {
    if (/\.(jpg|jpeg)$/i.test(file)) {
      const fp = `${imgDir}/${file}`;
      const size = readFileSync(fp).length;
      if (size > 500_000) {
        console.log(`  ⚠️  ${file}: ${(size/1024).toFixed(0)} KB (considerar comprimir manualmente)`);
      }
    }
  }
}
const bgImg = `${DIST}/assets/avatars/connor-coyne-OgqWLzWRSaI-unsplash.jpg`;
if (existsSync(bgImg)) {
  const size = readFileSync(bgImg).length;
  if (size > 500_000) {
    console.log(`  ⚠️  Imagen fútbol: ${(size/1024).toFixed(0)} KB — comprimir con: npx sharp-cli -i ${bgImg} -o ${bgImg} --quality 75`);
  }
}

// 6. Gzip pre-compression for JS and CSS
console.log("🗜️  Pre-comprimiendo (gzip)...");
const jsGz = gzipFile(`${DIST}/${jsHashed}`);
const cssGz = gzipFile(`${DIST}/${cssHashed}`);
const htmlGz = gzipFile(`${DIST}/index.html`);
console.log(`  ${jsHashed}.gz   ${(jsGz.compressed/1024).toFixed(1)} KB (${jsGz.ratio}% reducción)`);
console.log(`  ${cssHashed}.gz  ${(cssGz.compressed/1024).toFixed(1)} KB (${cssGz.ratio}% reducción)`);
console.log(`  index.html.gz     ${(htmlGz.compressed/1024).toFixed(1)} KB (${htmlGz.ratio}% reducción)`);

// Summary
const jsSize = (readFileSync(`${DIST}/${jsHashed}`).length / 1024).toFixed(1);
const cssSize = (readFileSync(`${DIST}/${cssHashed}`).length / 1024).toFixed(1);
const oldBabelSize = existsSync("assets/vendor/babel.js")
  ? (readFileSync("assets/vendor/babel.js").length / 1024).toFixed(0)
  : "?";
const oldReactSize = existsSync("assets/vendor/react.js")
  ? ((readFileSync("assets/vendor/react.js").length + readFileSync("assets/vendor/react-dom.js").length) / 1024).toFixed(0)
  : "?";

console.log(`
✨ Build completado!

  dist/${jsHashed}     ${jsSize} KB (gzip: ${(jsGz.compressed/1024).toFixed(1)} KB)
  dist/${cssHashed} ${cssSize} KB (gzip: ${(cssGz.compressed/1024).toFixed(1)} KB)

  Eliminados:
    babel.js        ${oldBabelSize} KB  ← ya no se necesita
    react.js+dom    ${oldReactSize} KB  ← bundled en app.js
    tailwind CDN    ~100 KB  ← precompilado

  → Total ahorrado en carga: ~${(Number(oldBabelSize) + 100).toFixed(0)} KB
`);
