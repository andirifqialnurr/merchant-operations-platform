import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

import baseConfig from "./base.mjs";

const nextConfig = [
  ...baseConfig,
  ...nextVitals,
  ...nextTypeScript,
  {
    ignores: [".next/**", "next-env.d.ts"],
  },
];

export default nextConfig;
