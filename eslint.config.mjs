import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  prettier,
  // `experiments/**` = scripts de recherche CLI (exécutés via tsx, hors application) :
  // console.log légitime, typage souple ; non soumis aux règles de l'app.
  globalIgnores([".next/**", "out/**", "build/**", "coverage/**", "next-env.d.ts", "experiments/**"]),
  {
    rules: {
      // TypeScript
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "warn",

      // React Hooks — évite les stale closures
      "react-hooks/exhaustive-deps": "warn",
      // Reset d'état en début d'effet = pattern valide dans ce projet
      "react-hooks/set-state-in-effect": "off",

      // Qualité générale
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },
]);

export default eslintConfig;
