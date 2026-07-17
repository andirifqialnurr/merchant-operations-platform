import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { Accordion, Chart, DataTable, DescriptionList } from "./data-display";
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
    const { rerender } = render(<Chart {...chartProps} state="loading" />);
    expect(screen.getByLabelText("Tren pesanan")).toHaveAttribute("aria-busy", "true");

    rerender(<Chart {...chartProps} state="empty" />);
    expect(screen.getByText("Data chart belum tersedia")).toBeInTheDocument();

    rerender(<Chart {...chartProps} state="error" />);
    expect(screen.getByText("Terjadi kesalahan")).toBeInTheDocument();
  });
});
