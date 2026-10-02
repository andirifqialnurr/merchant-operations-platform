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
      // Icons come from Tabler and are rendered through AppIcon.
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              message: "Use @tabler/icons-react and render it through AppIcon.",
              name: "lucide-react",
            },
          ],
        },
      ],
    },
  },
);

export default baseConfig;
