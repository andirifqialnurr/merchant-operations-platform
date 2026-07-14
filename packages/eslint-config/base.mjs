import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

const baseConfig = tseslint.config(
  {
    ignores: ["dist/**", ".next/**", "coverage/**"],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/consistent-type-imports": "error",
    },
  },
);

export default baseConfig;
