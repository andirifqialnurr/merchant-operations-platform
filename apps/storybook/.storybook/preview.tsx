import type { Decorator, Preview } from "@storybook/react-vite";
import { type ReactNode, useLayoutEffect } from "react";

import "@merchant/ui/styles/primitives.css";
import "@merchant/ui/styles/tokens.css";
import "@merchant/ui/styles/merchant-presets.css";
import "@merchant/ui/styles/tailwind-theme.css";
import "@merchant/ui/styles/typography.css";
import "@merchant/ui/styles/foundation.css";
import "@merchant/ui/styles/button.css";
import "@merchant/ui/styles/text-field.css";
import "@merchant/ui/styles/selection-control.css";
import "@merchant/ui/styles/select.css";
import "@merchant/ui/styles/numeric-date.css";
import "@merchant/ui/styles/feedback.css";
import "@merchant/ui/styles/floor-selector.css";
import "@merchant/ui/styles/overlay.css";
import "@merchant/ui/styles/navigation.css";
import "@merchant/ui/styles/data-display.css";
import "@merchant/ui/styles/pos-catalog.css";
import "@merchant/ui/styles/pos-modifier.css";
import "@merchant/ui/styles/pos-cart.css";
import "@merchant/ui/styles/money-display.css";
import "@merchant/ui/styles/pos-payment.css";
import "@merchant/ui/styles/pos-shift.css";
import "@merchant/ui/styles/table-layout-canvas.css";
import "@merchant/ui/styles/table-layout-tray.css";
import "@merchant/ui/styles/table-layout-tools.css";
import "@merchant/ui/styles/table-qr.css";
import "@merchant/ui/styles/table-tile.css";

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
