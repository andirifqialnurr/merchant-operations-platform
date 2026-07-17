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
        <DatePicker label="Tanggal transaksi" onValueChange={change} />
        <TimeInput label="Jam mulai" />
      </>,
    );
    await user.click(screen.getByRole("button", { name: "Pilih tanggal" }));
    await user.click(screen.getAllByRole("button", { name: "1" })[0]!);
    expect(change).toHaveBeenCalled();
    await user.type(screen.getByLabelText("Jam mulai"), "25:00");
    expect(screen.getByRole("alert")).toHaveTextContent("24 jam");
  });
  it("passes an axe smoke test", async () => {
    const { container } = render(<MoneyInput aria-label="Harga jual" value={25000} />);
    expect((await axe(container)).violations).toEqual([]);
  });
});
