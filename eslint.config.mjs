import globals from "globals";
import js from "@eslint/js";

export default [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "script",
      globals: {
        ...globals.browser,
      },
    },
    rules: {
      // Warn on unused vars but allow underscore-prefixed intentional ones
      "no-unused-vars": ["warn", { varsIgnorePattern: "^_", argsIgnorePattern: "^_" }],
      // Catch real mistakes
      "no-undef": "error",
      "no-constant-condition": "error",
      "no-unreachable": "error",
    },
  },
];
