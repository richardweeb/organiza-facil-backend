import js from "@eslint/js";
import importPlugin from "eslint-plugin-import";
import tseslint from "typescript-eslint";

export default [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: { import: importPlugin },
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
    },
    rules: {
      "no-console": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/consistent-type-imports": ["warn", { prefer: "type-imports" }],
      "import/order": [
        "warn",
        {
          "newlines-between": "always",
          "alphabetize": { order: "asc", caseInsensitive: true }
        }
      ]
    }
  },
  {
    ignores: ["dist/**", "node_modules/**", "data/**"]
  }
];
