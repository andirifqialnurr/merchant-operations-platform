import baseConfig from "@merchant/eslint-config/base";

export default [...baseConfig, { ignores: ["storybook-static/**", "test-results/**"] }];
