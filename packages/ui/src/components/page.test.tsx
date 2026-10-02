import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import { Button } from "./button";
import { Chip, FilterBar, PageHeader } from "./page";

describe("page patterns", () => {
  it("renders a page header with one title and its actions, without a description", () => {
    const { container } = render(
      <PageHeader
        primaryAction={<Button>Tambah produk</Button>}
        secondaryActions={<Button variant="secondary">Impor</Button>}
        title="Produk"
      />,
    );
    expect(screen.getByRole("heading", { level: 1, name: "Produk" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tambah produk" })).toBeInTheDocument();
    expect(container.querySelector("p")).toBeNull();
  });

  it("toggles and removes chips", async () => {
    const user = userEvent.setup();
    const toggle = vi.fn();
    const remove = vi.fn();
    render(
      <>
        <Chip onClick={toggle} selected>
          Aktif
        </Chip>
        <Chip onRemove={remove} removeLabel="Hapus filter Kategori: Kopi">
          Kategori: Kopi
        </Chip>
      </>,
    );
    const toggleChip = screen.getByRole("button", { name: "Aktif" });
    expect(toggleChip).toHaveAttribute("aria-pressed", "true");
    await user.click(toggleChip);
    expect(toggle).toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Hapus filter Kategori: Kopi" }));
    expect(remove).toHaveBeenCalled();
  });

  it("searches, shows active filters as chips, and resets", async () => {
    const user = userEvent.setup();
    const search = vi.fn();
    const removeChip = vi.fn();
    const reset = vi.fn();
    render(
      <FilterBar
        chips={[
          {
            key: "status",
            label: "Status: Aktif",
            onRemove: removeChip,
            removeLabel: "Hapus filter Status: Aktif",
          },
        ]}
        onReset={reset}
        resetLabel="Reset"
        search={{
          clearLabel: "Hapus pencarian",
          label: "Cari produk",
          onChange: search,
          placeholder: "Cari produk",
          value: "",
        }}
      >
        <button type="button">Status</button>
      </FilterBar>,
    );
    await user.type(screen.getByRole("textbox", { name: "Cari produk" }), "k");
    expect(search).toHaveBeenCalledWith("k");
    expect(screen.getByRole("button", { name: "Status" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Hapus filter Status: Aktif" }));
    expect(removeChip).toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Reset" }));
    expect(reset).toHaveBeenCalled();
  });

  it("hides chips and reset when no filter is active", () => {
    render(<FilterBar onReset={vi.fn()} resetLabel="Reset" />);
    expect(screen.queryByRole("button", { name: "Reset" })).not.toBeInTheDocument();
  });

  it("passes an axe smoke test", async () => {
    const { container } = render(
      <main>
        <PageHeader primaryAction={<Button>Tambah produk</Button>} title="Produk" />
        <FilterBar
          chips={[
            {
              key: "status",
              label: "Status: Aktif",
              onRemove: () => undefined,
              removeLabel: "Hapus filter Status: Aktif",
            },
          ]}
          search={{
            clearLabel: "Hapus pencarian",
            label: "Cari produk",
            onChange: () => undefined,
            value: "kopi",
          }}
        />
      </main>,
    );
    expect((await axe(container)).violations).toEqual([]);
  });
});
