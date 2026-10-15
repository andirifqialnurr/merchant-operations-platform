import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import {
  UnplacedTableTray,
  type UnplacedTableTrayItem,
  type UnplacedTableTrayLabels,
} from "./table-layout-tray";

const labels: UnplacedTableTrayLabels = {
  count: (count) => `${count} meja`,
  empty: "Tidak ada meja yang menunggu ditempatkan.",
  place: (label) => `Tempatkan ${label}`,
  title: "Meja belum ditempatkan",
};

const items: readonly UnplacedTableTrayItem[] = [
  { id: "table-internal-01", label: "Meja 01" },
  { id: "table-internal-02", label: "Meja Patio" },
  { disabled: true, id: "table-internal-03", label: "Meja Servis", reason: "Belum aktif" },
];

describe("UnplacedTableTray", () => {
  it("renders visible labels and derived counts without exposing internal ids", () => {
    render(<UnplacedTableTray labels={labels} items={items} selectedId="table-internal-02" />);

    expect(screen.getByRole("region", { name: "Meja belum ditempatkan" })).toBeVisible();
    expect(screen.getByText("3 meja")).toBeVisible();
    expect(screen.getByRole("button", { name: "Tempatkan Meja 01" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Tempatkan Meja Patio" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Meja Servis, Belum aktif" })).toBeDisabled();
    expect(screen.queryByText(/table-internal/)).not.toBeInTheDocument();
  });

  it("calls placement with the hidden internal id", async () => {
    const onPlaceItem = vi.fn();
    const user = userEvent.setup();

    render(<UnplacedTableTray labels={labels} items={items} onPlaceItem={onPlaceItem} />);
    await user.click(screen.getByRole("button", { name: "Tempatkan Meja 01" }));

    expect(onPlaceItem).toHaveBeenCalledWith("table-internal-01");
  });

  it("renders an empty state", () => {
    render(<UnplacedTableTray labels={labels} items={[]} />);
    expect(screen.getByRole("status")).toHaveTextContent(
      "Tidak ada meja yang menunggu ditempatkan.",
    );
  });

  it("rejects malformed tray data", () => {
    expect(() =>
      render(<UnplacedTableTray labels={labels} items={[{ id: "", label: "Meja 01" }]} />),
    ).toThrow(/id internal/);
    expect(() =>
      render(
        <UnplacedTableTray
          labels={labels}
          items={[
            { id: "table-a", label: "Meja A" },
            { id: "table-a", label: "Meja B" },
          ]}
        />,
      ),
    ).toThrow(/duplikat/);
    expect(() =>
      render(<UnplacedTableTray labels={labels} items={[{ id: "table-a", label: "" }]} />),
    ).toThrow(/label meja/);
  });

  it("passes an axe smoke test", async () => {
    const { container } = render(<UnplacedTableTray labels={labels} items={items} />);
    expect((await axe(container)).violations).toEqual([]);
  });
});
