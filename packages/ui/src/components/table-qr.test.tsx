import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import { TableQrManager, type TableQrManagerLabels, type TableQrRecord } from "./table-qr";

const labels: TableQrManagerLabels = {
  generate: "Buat QR",
  preview: (label) => `Preview QR ${label}`,
  print: "Cetak QR",
  region: (label) => `QR meja ${label}`,
  revoke: "Cabut QR",
  rotate: "Rotasi QR",
  status: { active: "Aktif", "not-generated": "Belum dibuat", revoked: "Dicabut" },
};

const activeTable: TableQrRecord = {
  id: "table-internal-01",
  label: "Meja 01",
  message: "QR siap dicetak untuk meja ini.",
  qrImageSrc: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'/%3E",
  status: "active",
};

describe("TableQrManager", () => {
  it("renders table label, QR status, and actions without exposing internal ids", () => {
    render(<TableQrManager labels={labels} table={activeTable} />);

    expect(screen.getByRole("region", { name: "QR meja Meja 01" })).toBeVisible();
    expect(screen.getByText("Aktif")).toBeVisible();
    expect(screen.getByRole("img", { name: "Preview QR Meja 01" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Buat QR" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cetak QR" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Rotasi QR" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Cabut QR" })).toBeEnabled();
    expect(screen.queryByText(/table-internal/)).not.toBeInTheDocument();
  });

  it("calls command handlers with the hidden table id", async () => {
    const onPrint = vi.fn();
    const onRevoke = vi.fn();
    const onRotate = vi.fn();
    const user = userEvent.setup();

    render(
      <TableQrManager
        labels={labels}
        onPrint={onPrint}
        onRevoke={onRevoke}
        onRotate={onRotate}
        table={activeTable}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Cetak QR" }));
    await user.click(screen.getByRole("button", { name: "Rotasi QR" }));
    await user.click(screen.getByRole("button", { name: "Cabut QR" }));

    expect(onPrint).toHaveBeenCalledWith("table-internal-01");
    expect(onRotate).toHaveBeenCalledWith("table-internal-01");
    expect(onRevoke).toHaveBeenCalledWith("table-internal-01");
  });

  it("enables generation only when QR is missing or revoked", async () => {
    const onGenerate = vi.fn();
    const user = userEvent.setup();

    render(
      <TableQrManager
        labels={labels}
        onGenerate={onGenerate}
        table={{ id: "table-internal-02", label: "Meja 02", status: "not-generated" }}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Buat QR" }));
    expect(onGenerate).toHaveBeenCalledWith("table-internal-02");
    expect(screen.getByRole("button", { name: "Cetak QR" })).toBeDisabled();
    expect(screen.queryByText(/table-internal/)).not.toBeInTheDocument();
  });

  it("rejects malformed QR data", () => {
    expect(() =>
      render(
        <TableQrManager labels={labels} table={{ id: "", label: "Meja 01", status: "active" }} />,
      ),
    ).toThrow(/id internal/);
    expect(() =>
      render(
        <TableQrManager labels={labels} table={{ id: "table-a", label: "", status: "active" }} />,
      ),
    ).toThrow(/label meja/);
    expect(() =>
      render(
        <TableQrManager
          labels={labels}
          table={{ id: "table-a", label: "Meja A", message: "", status: "active" }}
        />,
      ),
    ).toThrow(/Pesan status/);
  });

  it("passes an axe smoke test", async () => {
    const { container } = render(<TableQrManager labels={labels} table={activeTable} />);
    expect((await axe(container)).violations).toEqual([]);
  });
});
