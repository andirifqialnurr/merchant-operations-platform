import type { Decorator, Preview } from "@storybook/react-vite";
import { type ReactNode, useLayoutEffect } from "react";

import "./preview.css";

function PreviewThemeBoundary({
  children,
  resolvedTheme,
}: {
  children: ReactNode;
  resolvedTheme: string;
}) {
  useLayoutEffect(() => {
    document.documentElement.dataset.themePreview = resolvedTheme;
  }, [resolvedTheme]);

  return (
    <div className="storybook-preview-root" data-theme-preview={resolvedTheme}>
      {children}
    </div>
  );
}

const withDesignSystemTheme: Decorator = (Story, context) => {
  const selectedTheme = String(context.globals.theme ?? "system");
  const resolvedTheme =
    selectedTheme === "system"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : selectedTheme;

  return (
    <PreviewThemeBoundary resolvedTheme={resolvedTheme}>
      <Story />
    </PreviewThemeBoundary>
  );
};

const preview: Preview = {
  decorators: [withDesignSystemTheme],
  globalTypes: {
    theme: {
      description: "Preview theme for the Merchant design system",
      toolbar: {
        dynamicTitle: true,
        icon: "circlehollow",
        items: [
          { value: "system", title: "System", icon: "browser" },
          { value: "light", title: "Light", icon: "sun" },
          { value: "dark", title: "Dark", icon: "moon" },
        ],
        title: "Theme",
      },
    },
  },
  initialGlobals: {
    theme: "system",
  },
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    layout: "centered",
    viewport: {
      options: {
        mobile: { name: "Mobile", styles: { height: "844px", width: "390px" } },
        tabletPortrait: { name: "Tablet portrait", styles: { height: "1024px", width: "768px" } },
        tabletLandscape: { name: "Tablet landscape", styles: { height: "768px", width: "1024px" } },
        desktop: { name: "Desktop", styles: { height: "900px", width: "1440px" } },
        largeDisplay: { name: "Large display", styles: { height: "1080px", width: "1920px" } },
      },
    },
  },
};

export default preview;
