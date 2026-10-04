import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";

import { PermissionMatrix, type PermissionMatrixProps } from "./permission-matrix";

const props: PermissionMatrixProps = {
  caption: "Izin tiap peran",
  columns: [
    { key: "owner", label: "Pemilik" },
    { key: "cashier", label: "Kasir" },
  ],
  grantedLabel: "Boleh",
  groups: [
    {
      key: "selling",
      label: "Penjualan dan kasir",
      rows: [
        { granted: new Set(["owner", "cashier"]), key: "order.create", label: "Membuat pesanan" },
        { granted: new Set(["owner"]), key: "payment.refund", label: "Mengembalikan uang" },
      ],
    },
    {
      key: "catalog",
      label: "Katalog",
      rows: [{ granted: new Set(["owner"]), key: "catalog.manage", label: "Mengubah produk" }],
    },
  ],
  notGrantedLabel: "Tidak",
  permissionLabel: "Izin",
};

describe("PermissionMatrix", () => {
  it("puts permissions down and roles across, grouped by part of the business", () => {
    render(<PermissionMatrix {...props} />);

    const table = screen.getByRole("table", { name: "Izin tiap peran" });
    expect(
      within(table)
        .getAllByRole("columnheader")
        .map((cell) => cell.textContent),
    ).toEqual(["Izin", "Pemilik", "Kasir", "Penjualan dan kasir", "Katalog"]);
    expect(
      within(table)
        .getAllByRole("rowheader")
        .map((cell) => cell.textContent),
    ).toEqual(["Membuat pesanan", "Mengembalikan uang", "Mengubah produk"]);
  });

  it("says in words whether a role has a permission, not only with a mark", () => {
    render(<PermissionMatrix {...props} />);

    const refund = screen.getByRole("row", { name: /Mengembalikan uang/ });
    const cells = within(refund).getAllByRole("cell");
    expect(cells.map((cell) => cell.textContent)).toEqual(["Boleh", "Tidak"]);
    expect(cells[0]).toHaveAttribute("data-granted", "true");
    expect(cells[0]?.querySelector("svg")).not.toBeNull();
    // A role without the permission shows an empty cell: easier to scan than a column of crosses.
    expect(cells[1]).toHaveAttribute("data-granted", "false");
    expect(cells[1]?.querySelector("svg")).toBeNull();
  });

  it("offers nothing to change: it is for reading", () => {
    render(<PermissionMatrix {...props} />);
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("can be scrolled with the keyboard when the roles do not fit", () => {
    render(<PermissionMatrix {...props} />);
    const region = screen.getByRole("region", { name: "Izin tiap peran" });
    expect(region).toHaveAttribute("tabindex", "0");
  });

  it("passes an axe smoke test", async () => {
    const { container } = render(<PermissionMatrix {...props} />);
    expect((await axe(container)).violations).toEqual([]);
  });
});
