import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import {
  Accordion,
  Avatar,
  Chart,
  DataTable,
  DescriptionList,
  MetricCard,
  Panel,
} from "./data-display";
describe("data display primitives", () => {
  it("renders accessible table and description list", () => {
    render(
      <>
        <DataTable columns={["Produk"]} rows={[["Kopi"]]} />
        <DescriptionList items={[{ label: "Outlet", value: "Sudirman" }]} />
      </>,
    );
    expect(screen.getByRole("columnheader", { name: "Produk" })).toBeInTheDocument();
    expect(screen.getByText("Sudirman")).toBeInTheDocument();
  });
  it("aligns numeric columns, tags column priority, and selects rows", async () => {
    const user = userEvent.setup();
    const select = vi.fn();
    render(
      <DataTable
        caption="Daftar produk"
        columns={["Produk", { align: "end", label: "Harga" }, { label: "Diperbarui", priority: 3 }]}
        onRowSelect={select}
        rows={[["Es kopi susu", "Rp25.000", "14 Jul 2026"]]}
      />,
    );
    expect(screen.getByRole("table", { name: "Daftar produk" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Harga" })).toHaveClass("ui-table__cell--end");
    expect(screen.getByRole("cell", { name: "Rp25.000" })).toHaveClass("ui-table__cell--end");
    expect(screen.getByRole("cell", { name: "14 Jul 2026" })).toHaveClass("ui-table__cell--p3");
    await user.click(screen.getByRole("cell", { name: "Es kopi susu" }));
    expect(select).toHaveBeenCalledWith(0);
    screen.getByRole("row", { name: /Es kopi susu/ }).focus();
    await user.keyboard("{Enter}");
    expect(select).toHaveBeenCalledTimes(2);
  });
  it("renders the empty slot when a table has no rows", () => {
    render(<DataTable columns={["Produk", "Harga"]} empty="Belum ada produk." rows={[]} />);
    expect(screen.getByRole("cell", { name: "Belum ada produk." })).toHaveAttribute("colspan", "2");
  });
  it("derives avatar initials from the first and last name", () => {
    render(
      <>
        <Avatar name="Andi Rifqi Alnur" />
        <Avatar name="Sari" />
      </>,
    );
    expect(screen.getByRole("img", { name: "Andi Rifqi Alnur" })).toHaveTextContent("AA");
    expect(screen.getByRole("img", { name: "Sari" })).toHaveTextContent("SA");
  });
  it("names a panel from its title and renders a metric", () => {
    render(
      <Panel actions={<button type="button">Ekspor</button>} title="Penjualan">
        <MetricCard change="+12% dari kemarin" label="Hari ini" value="Rp1.250.000" />
      </Panel>,
    );
    expect(screen.getByRole("region", { name: "Penjualan" })).toBeInTheDocument();
    expect(screen.getByText("Rp1.250.000")).toBeInTheDocument();
  });
  it("opens accordion", async () => {
    const user = userEvent.setup();
    render(<Accordion items={[{ title: "Rincian", content: "Isi rincian" }]} />);
    await user.click(screen.getByRole("button", { name: "Rincian" }));
    expect(screen.getByText("Isi rincian")).toBeInTheDocument();
  });
  it("renders chart loading, empty, and error states without mounting the renderer", () => {
    const chartProps = {
      categories: ["Sen", "Sel"],
      series: [{ data: [12, 20], name: "Pesanan" }],
      summary: "32 pesanan dalam dua hari.",
      title: "Tren pesanan",
      type: "line" as const,
    };
    const { container, rerender } = render(
      <Chart
        emptyTitle="Data belum tersedia"
        errorTitle="Terjadi kesalahan"
        retryLabel="Coba lagi"
        summaryLabel="Ringkasan data"
        {...chartProps}
        state="loading"
      />,
    );
    expect(screen.getByRole("region", { name: "Tren pesanan" })).toHaveAttribute(
      "aria-busy",
      "true",
    );
    expect(container.querySelector(".ui-skeleton")).not.toBeNull();

    rerender(
      <Chart
        emptyTitle="Data belum tersedia"
        errorTitle="Terjadi kesalahan"
        retryLabel="Coba lagi"
        summaryLabel="Ringkasan data"
        {...chartProps}
        state="empty"
      />,
    );
    expect(screen.getByText("Data belum tersedia")).toBeInTheDocument();
    expect(container.querySelector(".ui-skeleton")).toBeNull();

    rerender(
      <Chart
        emptyTitle="Data belum tersedia"
        summaryLabel="Ringkasan data"
        {...chartProps}
        errorTitle="Chart gagal dimuat"
        onRetry={vi.fn()}
        retryLabel="Muat ulang"
        state="error"
      />,
    );
    expect(screen.getByText("Chart gagal dimuat")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Muat ulang" })).toBeInTheDocument();
    expect(screen.getByText("32 pesanan dalam dua hari.")).toBeInTheDocument();
  });
  it("passes an axe smoke test", async () => {
    const { container } = render(
      <Panel title="Produk">
        <DataTable
          caption="Daftar produk"
          columns={["Produk", { align: "end", label: "Harga" }]}
          rows={[["Kopi", "Rp20.000"]]}
        />
      </Panel>,
    );
    expect((await axe(container)).violations).toEqual([]);
  });
});
