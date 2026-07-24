import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import { CustomerQrContext, type CustomerQrContextMerchant } from "./customer-qr-context";

const merchant: CustomerQrContextMerchant = {
  banner: "Pesan langsung dari meja tanpa antre di kasir.",
  name: "Kopi Senja",
  outletName: "Cabang Meruya",
};

describe("CustomerQrContext", () => {
  it("renders merchant and table context without internal layout data", () => {
    render(
      <CustomerQrContext
        merchant={merchant}
        resolution={{
          message: "Pesanan akan dikirim ke staf setelah checkout.",
          status: "ready",
          tableLabel: "Meja 05",
        }}
      />,
    );

    expect(screen.getByRole("region", { name: "Konteks pesanan QR" })).toBeVisible();
    expect(screen.getByText("Kopi Senja")).toBeVisible();
    expect(screen.getByText("Cabang Meruya")).toBeVisible();
    expect(screen.getByText("Siap pesan")).toBeVisible();
    expect(screen.getByText("Meja 05")).toBeVisible();
    expect(screen.queryByText(/table-/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/grid|floor|token|session/i)).not.toBeInTheDocument();
  });

  it("starts ordering without exposing a table id argument", async () => {
    const onStartOrder = vi.fn();
    const user = userEvent.setup();

    render(
      <CustomerQrContext
        merchant={merchant}
        onStartOrder={onStartOrder}
        resolution={{ status: "ready", tableLabel: "Meja 05" }}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Mulai pesanan" }));
    expect(onStartOrder).toHaveBeenCalledWith();
  });

  it("keeps customer actions disabled while resolving or closed", () => {
    const { rerender } = render(
      <CustomerQrContext merchant={merchant} resolution={{ status: "resolving" }} />,
    );

    expect(screen.getByText("Memeriksa QR")).toBeVisible();
    expect(screen.getByRole("button", { name: "Mulai pesanan" })).toBeDisabled();
    expect(screen.queryByText("Meja")).not.toBeInTheDocument();

    rerender(
      <CustomerQrContext
        merchant={merchant}
        resolution={{ status: "closed", tableLabel: "Meja 05" }}
      />,
    );

    expect(screen.getByText("Tutup")).toBeVisible();
    expect(screen.getByRole("button", { name: "Mulai pesanan" })).toBeDisabled();
  });

  it("allows retry only for invalid QR state", async () => {
    const onRetry = vi.fn();
    const user = userEvent.setup();

    render(
      <CustomerQrContext
        merchant={merchant}
        onRetry={onRetry}
        resolution={{ status: "invalid" }}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Coba lagi" }));
    expect(onRetry).toHaveBeenCalledWith();
    expect(screen.queryByText("Meja")).not.toBeInTheDocument();
  });

  it("rejects malformed customer QR data", () => {
    expect(() =>
      render(
        <CustomerQrContext
          merchant={{ name: "" }}
          resolution={{ status: "ready", tableLabel: "Meja 01" }}
        />,
      ),
    ).toThrow(/nama merchant/);
    expect(() =>
      render(<CustomerQrContext merchant={merchant} resolution={{ status: "ready" }} />),
    ).toThrow(/label meja/);
    expect(() =>
      render(
        <CustomerQrContext
          merchant={{ logoSrc: "/logo.png", name: "Kopi Senja" }}
          resolution={{ status: "invalid" }}
        />,
      ),
    ).toThrow(/alt text/);
  });

  it("passes an axe smoke test", async () => {
    const { container } = render(
      <CustomerQrContext
        merchant={merchant}
        resolution={{ status: "ready", tableLabel: "Meja 05" }}
      />,
    );
    expect((await axe(container)).violations).toEqual([]);
  });
});
