import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import {
  PlatformTenantSubscriptionMaster,
  type PlatformTenantSubscriptionMasterProps,
} from "./platform-tenant-subscription-master";

const platformMasterProps: PlatformTenantSubscriptionMasterProps = {
  entitlements: [
    {
      enabled: true,
      key: "CORE_CATALOG",
      name: "Core Catalog",
      reasonLabel: "Tersedia dari plan operasional.",
      source: "PLAN",
    },
    {
      enabled: false,
      key: "KDS",
      name: "Kitchen Display",
      reasonLabel: "Menunggu aktivasi modul dapur.",
      source: "NONE",
    },
    {
      disabled: true,
      disabledReason: "Core tenancy selalu aktif.",
      enabled: true,
      key: "CORE_TENANCY",
      name: "Core Tenancy",
      reasonLabel: "Dibutuhkan oleh seluruh tenant.",
      source: "CORE",
    },
  ],
  selectedTenantId: "tenant-safe-01",
  sourceLabel: "Platform Owner",
  statusLabel: "Snapshot tersinkron",
  subscription: {
    endsAtLabel: "31 Juli 2027",
    planLabel: "Cafe Operations",
    startsAtLabel: "1 Agustus 2026",
    status: "ACTIVE",
  },
  tenants: [
    {
      id: "tenant-safe-01",
      name: "Kopi Senja",
      selected: true,
      status: "ACTIVE",
      subscriptionStatus: "ACTIVE",
    },
    {
      id: "tenant-safe-02",
      name: "Roti Pagi",
      status: "ACTIVE",
      subscriptionStatus: "TRIAL",
    },
  ],
};

describe("PlatformTenantSubscriptionMaster", () => {
  it("renders tenant, subscription, and entitlement master data without exposing internals", () => {
    render(<PlatformTenantSubscriptionMaster {...platformMasterProps} />);

    expect(
      screen.getByRole("region", { name: "Platform tenant subscription master" }),
    ).toBeVisible();
    expect(screen.getByRole("complementary", { name: "Daftar tenant platform" })).toBeVisible();
    expect(screen.getByRole("region", { name: "Subscription tenant platform" })).toBeVisible();
    expect(screen.getByRole("region", { name: "Entitlement module platform" })).toBeVisible();
    expect(screen.getByText("Kopi Senja")).toBeVisible();
    expect(screen.getByText("Cafe Operations")).toBeVisible();
    expect(screen.getByText("31 Juli 2027")).toBeVisible();
    expect(screen.getByText("Kitchen Display")).toBeVisible();
    expect(screen.getByText("2 aktif dari 3 modul")).toBeVisible();
    expect(screen.queryAllByRole("textbox")).toHaveLength(0);
    expect(
      screen.queryByText(
        /tenant-safe|CORE_CATALOG|CORE_TENANCY|payment|billing|invoice|token|audit|actor|timestamp|outlet|customer|order/i,
      ),
    ).not.toBeInTheDocument();
  });

  it("calls platform actions with hidden values only", async () => {
    const onChangeSubscriptionStatus = vi.fn();
    const onRefresh = vi.fn();
    const onSelectTenant = vi.fn();
    const onSetModuleEntitlement = vi.fn();
    const user = userEvent.setup();

    render(
      <PlatformTenantSubscriptionMaster
        {...platformMasterProps}
        onChangeSubscriptionStatus={onChangeSubscriptionStatus}
        onRefresh={onRefresh}
        onSelectTenant={onSelectTenant}
        onSetModuleEntitlement={onSetModuleEntitlement}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Roti Pagi/ }));
    expect(onSelectTenant).toHaveBeenCalledWith("tenant-safe-02");

    await user.click(screen.getByRole("radio", { name: "Ditahan" }));
    expect(onChangeSubscriptionStatus).toHaveBeenCalledWith("tenant-safe-01", "SUSPENDED");

    await user.click(screen.getAllByRole("switch")[1]!);
    expect(onSetModuleEntitlement).toHaveBeenCalledWith("tenant-safe-01", "KDS", true);

    await user.click(screen.getByRole("button", { name: "Refresh master platform" }));
    expect(onRefresh).toHaveBeenCalledWith();
  });

  it("renders empty subscription and entitlement states without fake zero values", () => {
    render(
      <PlatformTenantSubscriptionMaster
        {...platformMasterProps}
        entitlements={[]}
        subscription={null}
      />,
    );

    expect(screen.getByText("Subscription tenant belum tersedia.")).toBeVisible();
    expect(screen.getByText("Entitlement module belum tersedia.")).toBeVisible();
    expect(screen.getByText("Belum ada plan aktif")).toBeVisible();
    expect(screen.queryByText("0 modul")).not.toBeInTheDocument();
  });

  it("rejects tenant, subscription, billing, audit, and unknown action props", () => {
    expect(() =>
      render(
        <PlatformTenantSubscriptionMaster
          {...({
            ...platformMasterProps,
            tenants: [{ ...platformMasterProps.tenants[0], tenantId: "tenant-internal-01" }],
          } as unknown as PlatformTenantSubscriptionMasterProps)}
        />,
      ),
    ).toThrow(/tenantId/);

    expect(() =>
      render(
        <PlatformTenantSubscriptionMaster
          {...({
            ...platformMasterProps,
            subscription: { ...platformMasterProps.subscription, subscriptionId: "sub-01" },
          } as unknown as PlatformTenantSubscriptionMasterProps)}
        />,
      ),
    ).toThrow(/subscriptionId/);

    expect(() =>
      render(
        <PlatformTenantSubscriptionMaster
          {...({
            ...platformMasterProps,
            paymentPayload: {},
          } as unknown as PlatformTenantSubscriptionMasterProps)}
        />,
      ),
    ).toThrow(/paymentPayload/);

    expect(() =>
      render(
        <PlatformTenantSubscriptionMaster
          {...({
            ...platformMasterProps,
            onDeleteTenant: () => undefined,
          } as PlatformTenantSubscriptionMasterProps & { onDeleteTenant: () => void })}
        />,
      ),
    ).toThrow(/onDeleteTenant/);
  });

  it("passes an axe smoke test", async () => {
    const { container } = render(<PlatformTenantSubscriptionMaster {...platformMasterProps} />);

    expect((await axe(container)).violations).toEqual([]);
  });
});
