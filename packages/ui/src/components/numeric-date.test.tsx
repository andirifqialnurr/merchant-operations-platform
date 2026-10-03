import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import { DatePicker, MoneyInput, NumericInput, TimeInput } from "./numeric-date";

describe("numeric and date primitives", () => {
  it("filters numeric input and formats Indonesian money", async () => {
    const user = userEvent.setup();
    const change = vi.fn();
    render(
      <>
        <NumericInput aria-label="Jumlah" onValueChange={change} value="" />
        <MoneyInput aria-label="Harga" value={50000} />
      </>,
    );
    await user.type(screen.getByLabelText("Jumlah"), "12abc");
    expect(change).toHaveBeenCalledWith("1");
    expect(screen.getByDisplayValue("Rp50.000")).toBeInTheDocument();
  });
  it("selects a date and validates 24-hour time", async () => {
    const user = userEvent.setup();
    const change = vi.fn();
    render(
      <>
        <DatePicker
          placeholder="Pilih tanggal"
          nextMonthLabel="Bulan berikutnya"
          previousMonthLabel="Bulan sebelumnya"
          label="Tanggal transaksi"
          onValueChange={change}
        />
        <TimeInput formatError="Gunakan format 24 jam, misalnya 18:30." label="Jam mulai" />
      </>,
    );
    await user.click(screen.getByRole("button", { name: "Pilih tanggal" }));
    await user.click(screen.getAllByRole("button", { name: "1" })[0]!);
    expect(change).toHaveBeenCalled();
    await user.type(screen.getByLabelText("Jam mulai"), "25:00");
    expect(screen.getByRole("alert")).toHaveTextContent("24 jam");
  });
  it("keeps the local calendar date and aligns the first day to its weekday", async () => {
    const user = userEvent.setup();
    const change = vi.fn();
    render(
      <DatePicker
        placeholder="Pilih opsi"
        nextMonthLabel="Bulan berikutnya"
        previousMonthLabel="Bulan sebelumnya"
        label="Tanggal"
        onValueChange={change}
        value="2026-08-15"
      />,
    );
    await user.click(screen.getByRole("button", { name: "15 Agu 2026" }));
    const first = screen.getByRole("button", { name: "1" });
    // 1 August 2026 is a Saturday: seventh column when the week starts on Sunday.
    expect(first).toHaveStyle({ gridColumnStart: "7" });
    await user.click(first);
    expect(change).toHaveBeenCalledWith("2026-08-01");
  });
  it("passes an axe smoke test", async () => {
    const { container } = render(<MoneyInput aria-label="Harga jual" value={25000} />);
    expect((await axe(container)).violations).toEqual([]);
  });
});
