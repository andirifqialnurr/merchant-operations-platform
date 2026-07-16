import type { StorybookConfig } from "@storybook/react-vite";

const config = {
  stories: ["../src/**/*.stories.@(js|jsx|mjs|ts|tsx)"],
  addons: [],
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
} satisfies StorybookConfig;

export default config;
