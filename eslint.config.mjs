import js from "@eslint/js";

export default [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        React: "readonly",
        ReactDOM: "readonly",
        window: "readonly",
        document: "readonly",
        localStorage: "readonly",
        sessionStorage: "readonly",
        navigator: "readonly",
        console: "readonly",
        fetch: "readonly",
        URL: "readonly",
        Blob: "readonly",
        AbortSignal: "readonly",
        setTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        crypto: "readonly",
        TextEncoder: "readonly",
        Date: "readonly",
        Map: "readonly",
        Set: "readonly",
        Promise: "readonly",
        Number: "readonly",
        JSON: "readonly",
        Array: "readonly",
        Object: "readonly",
        String: "readonly",
        Math: "readonly",
        Uint8Array: "readonly",
        parseInt: "readonly",
        isNaN: "readonly",
        encodeURIComponent: "readonly",
        globalThis: "readonly",
      },
    },
    rules: {
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "no-console": "off",
    },
  },
  {
    ignores: ["dist/**", "node_modules/**", "assets/**", ".entry_build.jsx"],
  },
  {
    files: [
      "porra-state-api.mjs",
      "porra-ai.mjs",
      "porra-*.mjs",
      "lib/**/*.mjs",
      "scripts/**/*.mjs",
      "tests/**/*.mjs",
      "e2e/**/*.mjs",
      "playwright.config.mjs",
      "build.mjs",
    ],
    languageOptions: {
      globals: {
        process: "readonly",
        Buffer: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
      },
    },
  },
  {
    files: ["sw.js"],
    languageOptions: {
      globals: {
        self: "readonly",
        caches: "readonly",
        fetch: "readonly",
        Request: "readonly",
        Response: "readonly",
        URL: "readonly",
      },
    },
  },
  {
    files: ["src/confetti.js", "src/utils.js"],
    languageOptions: {
      globals: {
        clearTimeout: "readonly",
        setTimeout: "readonly",
        performance: "readonly",
        requestAnimationFrame: "readonly",
        Image: "readonly",
        FileReader: "readonly",
      },
    },
  },
];
