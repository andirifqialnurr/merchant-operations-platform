import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import {
  PlatformEntitlementMatrix,
  type PlatformEntitlementMatrixProps,
} from "./platform-entitlement-matrix";

const matrixProps: PlatformEntitlementMatrixProps = {
  cells: [
    {
      enabled: true,
      moduleKey: "CORE_CATALOG",
      planCode: "CAFE_OPS",
      reasonLabel: "Termasuk default plan operasional.",
      source: "PLAN",
    },
    {
      enabled: true,
      moduleKey: "POS",
      planCode: "CAFE_OPS",
      reasonLabel: "Kasir aktif untuk plan ini.",
      source: "PLAN",
    },
    {
      disabled: true,
      disabledReason: "Module dasar selalu tersedia.",
      enabled: true,
      moduleKey: "CORE_TENANCY",
      planCode: "CAFE_OPS",
      reasonLabel: "Fondasi tenant wajib aktif.",
      source: "CORE",
    },
    {
      enabled: false,
      moduleKey: "KITCHEN_DISPLAY",
      planCode: "CAFE_OPS",
      reasonLabel: "Perlu aktivasi dapur.",
      source: "NONE",
    },
    {
      enabled: true,
      moduleKey: "POS",
      planCode: "POS_BASIC",
      reasonLabel: "Kasir tersedia pada plan basic.",
      source: "PLAN",
    },
  ],
  modules: [
    {
      kind: "CORE",
      key: "CORE_TENANCY",
      name: "Core Tenancy",
      purposeLabel: "Fondasi isolasi tenant dan scope akses.",
    },
    {
      kind: "COMMERCIAL",
      key: "CORE_CATALOG",
      name: "Core Catalog",
      purposeLabel: "Master menu dan komposisi produk.",
    },
    {
      kind: "COMMERCIAL",
      key: "POS",
      name: "POS",
      purposeLabel: "Kasir dan cart staff.",
    },
    {
      dependencyLabel: "Membutuhkan POS.",
      kind: "COMMERCIAL",
      key: "KITCHEN_DISPLAY",
      name: "Kitchen Display",
      purposeLabel: "Display dapur untuk ticket aktif.",
    },
  ],
  plans: [
    {
      code: "CAFE_OPS",
      name: "Cafe Operations",
      selected: true,
      tenantCountLabel: "18 tenant",
    },
    {
      code: "POS_BASIC",
      name: "POS Basic",
      tenantCountLabel: "9 tenant",
    },
  ],
  selectedPlanCode: "CAFE_OPS",
  sourceLabel: "Platform Owner",
  statusLabel: "Matrix tersinkron",
};

describe("PlatformEntitlementMatrix", () => {
  it("renders plan and module matrix without exposing hidden codes or sensitive data", () => {
    render(<PlatformEntitlementMatrix {...matrixProps} />);

    expect(screen.getByRole("region", { name: "Platform Entitlement Matrix" })).toBeVisible();
    expect(screen.getByRole("complementary", { name: "Plan Entitlement Matrix" })).toBeVisible();
    expect(screen.getByRole("region", { name: "Matrix module entitlement" })).toBeVisible();
    expect(screen.getByText("Cafe Operations")).toBeVisible();
    expect(screen.getByText("Kitchen Display")).toBeVisible();
    expect(screen.getByText("Membutuhkan POS.")).toBeVisible();
    expect(screen.getByText("3")).toBeVisible();
    expect(screen.queryAllByRole("textbox")).toHaveLength(0);
    expect(
      screen.queryByText(
        /CAFE_OPS|POS_BASIC|CORE_|KITCHEN_DISPLAY|payment|billing|invoice|token|audit|actor|timestamp|tenant-|customer|order/i,
      ),
    ).not.toBeInTheDocument();
  });

  it("calls actions with hidden plan and module values only", async () => {
    const onRefresh = vi.fn();
    const onSelectPlan = vi.fn();
    const onTogglePlanModule = vi.fn();
    const user = userEvent.setup();

    render(
      <PlatformEntitlementMatrix
        {...matrixProps}
        onRefresh={onRefresh}
        onSelectPlan={onSelectPlan}
        onTogglePlanModule={onTogglePlanModule}
      />,
    );

    await user.click(screen.getByRole("button", { name: /POS Basic/ }));
    expect(onSelectPlan).toHaveBeenCalledWith("POS_BASIC");

    await user.click(screen.getByRole("switch", { name: "Nonaktif" }));
    expect(onTogglePlanModule).toHaveBeenCalledWith("CAFE_OPS", "KITCHEN_DISPLAY", true);

    await user.click(screen.getByRole("button", { name: "Refresh Entitlement Matrix" }));
    expect(onRefresh).toHaveBeenCalledWith();
  });

  it("renders empty module state without fake matrix values", () => {
    render(<PlatformEntitlementMatrix {...matrixProps} cells={[]} modules={[]} />);

    expect(screen.getByText("Module entitlement belum tersedia.")).toBeVisible();
    expect(screen.getAllByText("0").length).toBeGreaterThan(0);
    expect(screen.queryByText("0 module aktif")).not.toBeInTheDocument();
  });

  it("rejects sensitive fields and unknown action props", () => {
    expect(() =>
      render(
        <PlatformEntitlementMatrix
          {...({
            ...matrixProps,
            modules: [{ ...matrixProps.modules[0], moduleId: "module-internal-01" }],
          } as unknown as PlatformEntitlementMatrixProps)}
        />,
      ),
    ).toThrow(/moduleId/);

    expect(() =>
      render(
        <PlatformEntitlementMatrix
          {...({
            ...matrixProps,
            cells: [{ ...matrixProps.cells[0], auditActor: "platform-owner" }],
          } as unknown as PlatformEntitlementMatrixProps)}
        />,
      ),
    ).toThrow(/auditActor/);

    expect(() =>
      render(
        <PlatformEntitlementMatrix
          {...({
            ...matrixProps,
            paymentPayload: {},
          } as unknown as PlatformEntitlementMatrixProps)}
        />,
      ),
    ).toThrow(/paymentPayload/);

    expect(() =>
      render(
        <PlatformEntitlementMatrix
          {...({
            ...matrixProps,
            onDeletePlan: () => undefined,
          } as PlatformEntitlementMatrixProps & { onDeletePlan: () => void })}
        />,
      ),
    ).toThrow(/onDeletePlan/);
  });

  it("passes an axe smoke test", async () => {
    const { container } = render(<PlatformEntitlementMatrix {...matrixProps} />);

    expect((await axe(container)).violations).toEqual([]);
  });
});
