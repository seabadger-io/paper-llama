import js from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier";
import globals from "globals";

export default [
  {
    ignores: [
      "node_modules/",
      "venv/",
      "backend/",
      "data/",
      "*.db",
      ".pytest_cache/"
    ]
  },
  js.configs.recommended,
  eslintConfigPrettier,
  {
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.node,
        // Custom globals
        Vue: "readonly",
        VueRouter: "readonly",
        axios: "readonly",
        turnstile: "readonly"
      }
    },
    rules: {
      "no-unused-vars": "warn"
    }
  }
];
