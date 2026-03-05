import { build } from "esbuild";
import { readFileSync, writeFileSync, mkdirSync, cpSync, rmSync, existsSync } from "fs";
import { execSync } from "child_process";

const DIST = "dist";

console.log("🔨 Build Porra Birreros...\n");

// Clean dist
if (existsSync(DIST)) rmSync(DIST, { recursive: true });
mkdirSync(DIST, { recursive: true });

// 1. Build JS — prepend React imports so esbuild can bundle them
console.log("📦 Compilando app.jsx...");
const appCode = readFileSync("app.jsx", "utf-8");
const entryCode = [
  'import React from "react";',
  'import ReactDOM from "react-dom/client";',
  "globalThis.React = React;",
  "globalThis.ReactDOM = ReactDOM;",
  "",
  appCode
    .replace(/^\/\*\s*global React,?\s*ReactDOM\s*\*\/\n?/m, "")
].join("\n");

const tmpEntry = ".entry_build.jsx";
writeFileSync(tmpEntry, entryCode);

await build({
  entryPoints: [tmpEntry],
  bundle: true,
  minify: true,
  sourcemap: true,
  outfile: `${DIST}/app.js`,
  target: "es2020",
  format: "iife",
  jsx: "automatic",
  define: { "process.env.NODE_ENV": '"production"' },
  legalComments: "none",
});

rmSync(tmpEntry);
console.log("  ✅ dist/app.js");

// 2. Build CSS — Tailwind v4
console.log("🎨 Compilando CSS (Tailwind)...");
try {
  execSync(`npx @tailwindcss/cli -i ./src.css -o ./${DIST}/styles.css --minify`, {
    stdio: "pipe",
  });
  console.log("  ✅ dist/styles.css");
} catch (err) {
  console.error("  ❌ Error en Tailwind:", err.stderr?.toString() || err.message);
  process.exit(1);
}

// 3. Build index.html — remove CDN deps, add compiled files
console.log("📄 Generando index.html...");
let html = readFileSync("index.html", "utf-8");

// Remove Tailwind CDN
html = html.replace(/<script src="https:\/\/cdn\.tailwindcss\.com"><\/script>\n?\s*/g, "");

// Remove vendor scripts (react, react-dom, babel)
html = html.replace(/<script src="\.\/assets\/vendor\/react\.js[^"]*"><\/script>\n?\s*/g, "");
html = html.replace(/<script src="\.\/assets\/vendor\/react-dom\.js[^"]*"><\/script>\n?\s*/g, "");
html = html.replace(/<script src="\.\/assets\/vendor\/babel\.js[^"]*"><\/script>\n?\s*/g, "");

// Remove inline <style> block (now in styles.css)
html = html.replace(/<style>[\s\S]*?<\/style>\n?\s*/g, "");

// Remove Babel script tag, replace with compiled JS
html = html.replace(
  /<script type="text\/babel"[^>]*src="\.\/app\.jsx[^"]*"[^>]*><\/script>/g,
  '<script src="./app.js"></script>'
);

// Add stylesheet link in <head>
html = html.replace(
  "</head>",
  '  <link rel="stylesheet" href="./styles.css">\n</head>'
);

// Update CSP — remove CDN refs and unsafe-eval (no more Babel runtime)
html = html.replace(
  /content="default-src 'self';[^"]*"/,
  `content="default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; img-src 'self' data: https://images.unsplash.com; connect-src 'self' https://porra.manriquegarcia.com https://x7gnt5ifb4.execute-api.eu-west-1.amazonaws.com https://api.jolpi.ca; font-src 'self' data:; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self';"`
);

// Remove load verification script (no longer needed without Babel)
html = html.replace(/<script>\s*\/\/ Verificar que los scripts[\s\S]*?<\/script>\n?\s*/g, "");

writeFileSync(`${DIST}/index.html`, html);
console.log("  ✅ dist/index.html");

// 4. Copy assets (excluding vendor — no longer needed)
console.log("📁 Copiando assets...");
cpSync("assets", `${DIST}/assets`, {
  recursive: true,
  filter: (src) => !src.includes("assets/vendor"),
});
console.log("  ✅ dist/assets/");

// Summary
const jsSize = (readFileSync(`${DIST}/app.js`).length / 1024).toFixed(1);
const cssSize = (readFileSync(`${DIST}/styles.css`).length / 1024).toFixed(1);
const oldBabelSize = existsSync("assets/vendor/babel.js")
  ? (readFileSync("assets/vendor/babel.js").length / 1024).toFixed(0)
  : "?";
const oldReactSize = existsSync("assets/vendor/react.js")
  ? ((readFileSync("assets/vendor/react.js").length + readFileSync("assets/vendor/react-dom.js").length) / 1024).toFixed(0)
  : "?";

console.log(`
✨ Build completado!

  dist/app.js     ${jsSize} KB  (app + React minificados)
  dist/styles.css ${cssSize} KB  (Tailwind + CSS custom)

  Eliminados:
    babel.js        ${oldBabelSize} KB  ← ya no se necesita
    react.js+dom    ${oldReactSize} KB  ← bundled en app.js
    tailwind CDN    ~100 KB  ← precompilado

  → Total ahorrado en carga: ~${(Number(oldBabelSize) + 100).toFixed(0)} KB
`);
