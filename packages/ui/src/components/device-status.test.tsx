import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";

import {
  DeviceStatusBadge,
  NetworkSyncIndicator,
  StaleDataBanner,
  type DeviceStatus,
  type NetworkSyncState,
} from "./device-status";

describe("DeviceStatusBadge", () => {
  it("gives each status its own tone and shows the caller's words", () => {
    const cases: Array<[DeviceStatus, string, string]> = [
      ["PENDING", "Menunggu aktivasi", "ui-badge--warning"],
      ["ACTIVE", "Aktif", "ui-badge--success"],
      ["REVOKED", "Dicabut", "ui-badge--neutral"],
    ];
    for (const [status, label, tone] of cases) {
      const { unmount } = render(<DeviceStatusBadge label={label} status={status} />);
      const badge = screen.getByText(label);
      expect(badge).toHaveClass(tone);
      expect(badge).toHaveAttribute("data-status", status);
      unmount();
    }
  });
});

describe("NetworkSyncIndicator", () => {
  it("announces every state as a status with its words", () => {
    const states: Array<[NetworkSyncState, string]> = [
      ["online", "Tersambung"],
      ["syncing", "Menyinkronkan"],
      ["reconnecting", "Menyambung ulang"],
      ["offline", "Offline"],
    ];
    for (const [state, label] of states) {
      const { unmount } = render(<NetworkSyncIndicator label={label} state={state} />);
      const status = screen.getByRole("status");
      expect(status).toHaveAttribute("data-state", state);
      expect(within(status).getByText(label)).toBeVisible();
      unmount();
    }
  });

  it("keeps the words for screen readers and as a tooltip when compact", () => {
    render(<NetworkSyncIndicator compact label="Offline" state="offline" />);
    const text = screen.getByText("Offline");
    expect(text).toHaveClass("ui-visually-hidden");
    expect(screen.getByTitle("Offline")).toBeInTheDocument();
  });

  it("spins only while something is in progress", () => {
    const { container, rerender } = render(
      <NetworkSyncIndicator label="Offline" state="offline" />,
    );
    expect(container.querySelector(".ui-network-sync__icon--spin")).toBeNull();
    rerender(<NetworkSyncIndicator label="Menyambung ulang" state="reconnecting" />);
    expect(container.querySelector(".ui-network-sync__icon--spin")).not.toBeNull();
  });

  it("passes an axe smoke test", async () => {
    const { container } = render(
      <div>
        <NetworkSyncIndicator label="Offline" state="offline" />
        <NetworkSyncIndicator compact label="Menyinkronkan" state="syncing" />
      </div>,
    );
    expect((await axe(container)).violations).toEqual([]);
  });
});

describe("StaleDataBanner", () => {
  it("says why the data may be old, when it was fetched, and offers one action", async () => {
    const { container } = render(
      <StaleDataBanner
        action={<button type="button">Muat ulang</button>}
        lastUpdatedLabel="Terakhir diperbarui 10.42"
      >
        Data di layar mungkin sudah berubah.
      </StaleDataBanner>,
    );
    const banner = screen.getByRole("status");
    expect(within(banner).getByText("Data di layar mungkin sudah berubah.")).toBeVisible();
    expect(within(banner).getByText("Terakhir diperbarui 10.42")).toBeVisible();
    expect(within(banner).getAllByRole("button")).toHaveLength(1);
    expect((await axe(container)).violations).toEqual([]);
  });

  it("cannot be dismissed and works without a time or an action", () => {
    render(<StaleDataBanner>Data di layar mungkin sudah berubah.</StaleDataBanner>);
    const banner = screen.getByRole("status");
    expect(within(banner).queryByRole("button")).not.toBeInTheDocument();
    expect(banner.querySelector(".ui-stale-data__time")).toBeNull();
  });
});
