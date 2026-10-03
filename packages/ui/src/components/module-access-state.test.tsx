import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";

import { ModuleAccessState, type ModuleAccessReason } from "./module-access-state";

const reasons: ModuleAccessReason[] = [
  "not-entitled",
  "tier-required",
  "provisioning",
  "setup-required",
  "paused",
  "permission-denied",
  "subscription-suspended",
];

describe("ModuleAccessState", () => {
  it("gives every reason its own variant instead of one generic message", () => {
    for (const reason of reasons) {
      const { container, unmount } = render(
        <ModuleAccessState
          description={`Description for ${reason}`}
          reason={reason}
          title={reason}
        />,
      );
      const state = screen.getByRole("status");
      expect(state).toHaveClass(`ui-module-access--${reason}`);
      expect(within(state).getByRole("heading", { name: reason })).toBeVisible();
      expect(container.querySelectorAll(".ui-module-access")).toHaveLength(1);
      unmount();
    }
  });

  it("marks only the provisioning state as busy", () => {
    const { rerender } = render(
      <ModuleAccessState description="Being prepared." reason="provisioning" title="Installing" />,
    );
    expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "true");

    rerender(
      <ModuleAccessState
        description="Ask the owner."
        reason="permission-denied"
        title="No access"
      />,
    );
    expect(screen.getByRole("status")).not.toHaveAttribute("aria-busy");
  });

  it("shows the setup checklist with what is done and what is left, and one action", () => {
    render(
      <ModuleAccessState
        action={<button type="button">Continue setup</button>}
        description="Two steps left."
        reason="setup-required"
        steps={[
          { done: true, label: "Name the first register" },
          { done: false, label: "Choose a receipt size" },
        ]}
        stepsLabel="Setup steps"
        title="Finish setting up the cashier"
      />,
    );

    const steps = within(screen.getByRole("list", { name: "Setup steps" })).getAllByRole(
      "listitem",
    );
    expect(steps.map((step) => [step.textContent, step.dataset.done])).toEqual([
      ["Name the first register", "true"],
      ["Choose a receipt size", "false"],
    ]);
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });

  it("renders no list and no action when none is given", () => {
    render(
      <ModuleAccessState description="Not included." reason="not-entitled" title="Not included" />,
    );
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("passes an axe smoke test for every reason", async () => {
    const { container } = render(
      <main>
        {reasons.map((reason) => (
          <ModuleAccessState
            description={`Description for ${reason}`}
            key={reason}
            reason={reason}
            steps={reason === "setup-required" ? [{ done: false, label: "One step" }] : []}
            stepsLabel="Setup steps"
            title={`Title for ${reason}`}
          />
        ))}
      </main>,
    );
    expect((await axe(container)).violations).toEqual([]);
  });
});
