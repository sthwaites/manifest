import { defineConfig, globalIgnores } from "eslint/config"
import nextVitals from "eslint-config-next/core-web-vitals"
import nextTypescript from "eslint-config-next/typescript"

export default defineConfig([
  ...nextVitals,
  ...nextTypescript,
  {
    settings: {
      next: {
        rootDir: ["./", "./sandbox/"],
      },
    },
    rules: {
      "@next/next/no-img-element": "off",
      "@typescript-eslint/triple-slash-reference": "off",
      "react-hooks/refs": "off",
      "react-hooks/set-state-in-effect": "off",
    },
  },
  globalIgnores([
    ".next/**",
    ".next-*/**",
    "coverage/**",
    "dist/**",
    "node_modules/**",
    "sandbox/.next/**",
    "sandbox/.next-*/**",
    "sandbox/coverage/**",
    "sandbox/dist/**",
    "tmp/manifest-next-dev-*/**",
  ]),
])
