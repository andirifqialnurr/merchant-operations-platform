import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

class TestResizeObserver {
  disconnect() {
    return undefined;
  }

  observe() {
    return undefined;
  }

  unobserve() {
    return undefined;
  }
}

class TestIntersectionObserver {
  readonly root = null;
  readonly rootMargin = "";
  readonly scrollMargin = "";
  readonly thresholds = [];

  disconnect() {
    return undefined;
  }

  observe() {
    return undefined;
  }

  takeRecords() {
    return [];
  }

  unobserve() {
    return undefined;
  }
}

Document.prototype.getAnimations ??= function getAnimations() {
  return [];
};
Element.prototype.getAnimations ??= function getAnimations() {
  return [];
};

globalThis.matchMedia ??= function matchMedia(query: string) {
  return {
    addEventListener: () => undefined,
    addListener: () => undefined,
    dispatchEvent: () => false,
    matches: false,
    media: query,
    onchange: null,
    removeEventListener: () => undefined,
    removeListener: () => undefined,
  };
};
globalThis.IntersectionObserver ??=
  TestIntersectionObserver as unknown as typeof IntersectionObserver;
globalThis.ResizeObserver ??= TestResizeObserver;

afterEach(() => {
  cleanup();
});
