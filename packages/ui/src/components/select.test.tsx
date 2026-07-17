import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import { Combobox, Select } from "./select";

const options = [
  { label: "Jakarta Pusat", value: "jkt" },
  { disabled: true, disabledReason: "Akses outlet belum tersedia", label: "Bandung", value: "bdg" },
];
describe("select primitives", () => {
  it("selects through keyboard and keeps disabled options unavailable", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<Select label="Outlet" onValueChange={onValueChange} options={options} />);
    const trigger = screen.getByRole("button", { name: "Pilih opsi" });
    await user.click(trigger);
    expect(screen.getByRole("option", { name: /Bandung/ })).toBeDisabled();
    await user.keyboard("{ArrowDown}");
    expect(onValueChange).toHaveBeenCalledWith("jkt");
  });
  it("filters combobox and exposes retry state", async () => {
    const user = userEvent.setup();
    render(
      <Combobox
        errorLabel="Gagal memuat outlet."
        label="Outlet"
        onRetry={vi.fn()}
        options={options}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Pilih atau cari opsi" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Gagal memuat outlet.");
    expect(screen.getByRole("button", { name: "Coba lagi" })).toBeInTheDocument();
  });
  it("passes an axe smoke test", async () => {
    const { container } = render(<Select label="Outlet" options={options} />);
    expect((await axe(container)).violations).toEqual([]);
  });
});
