import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Check, Store } from "lucide-react";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import { AppIcon } from "./app-icon";

describe("AppIcon", () => {
  it("exposes a labelled icon to assistive technology", () => {
    render(<AppIcon icon={Store} label="Merchant outlet" />);

    expect(screen.getByRole("img", { name: "Merchant outlet" })).toBeInTheDocument();
  });

  it("keeps decorative icons hidden from the accessibility tree", () => {
    render(<AppIcon icon={Check} />);

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(document.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("supports user-event interaction in the component harness", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();

    render(<button onClick={onClick}>Toggle preview</button>);
    await user.click(screen.getByRole("button", { name: "Toggle preview" }));

    expect(onClick).toHaveBeenCalledOnce();
  });

  it("passes an axe smoke test", async () => {
    const { container } = render(<AppIcon icon={Store} label="Merchant outlet" />);

    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });
});
