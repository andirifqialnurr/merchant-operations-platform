import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { AppShell, ContextSwitcher, UserMenu } from "./app-shell";

const labels = {
  closeNavigation: "Tutup navigasi",
  moreNavigation: "Lainnya",
  navigation: "Navigasi utama",
  openNavigation: "Buka navigasi",
  skipToContent: "Lewati navigasi",
};
const navigation = [
  { active: true, href: "/catalog", label: "Katalog" },
  { href: "/inventory", label: "Stok" },
];

describe("app shell", () => {
  it("renders navigation, context, account, and content landmarks", () => {
    render(
      <AppShell
        account={<span>Akun</span>}
        brand="Cafe Companion"
        context={<span>Kopi Senja</span>}
        footerNavigation={[{ href: "/modules", label: "Jelajahi modul" }]}
        labels={labels}
        navigation={navigation}
      >
        <h1>Produk</h1>
      </AppShell>,
    );
    expect(screen.getByRole("link", { name: "Lewati navigasi" })).toHaveAttribute(
      "href",
      "#ui-app-shell-content",
    );
    expect(screen.getByRole("main")).toHaveAttribute("id", "ui-app-shell-content");
    expect(screen.getAllByRole("navigation", { name: "Navigasi utama" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: "Katalog" })[0]).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getAllByRole("link", { name: "Jelajahi modul" }).length).toBeGreaterThan(0);
    expect(screen.getByText("Kopi Senja")).toBeInTheDocument();
  });

  it("opens the navigation drawer and closes it after navigating", async () => {
    const user = userEvent.setup();
    render(
      <AppShell brand="Cafe Companion" labels={labels} navigation={navigation}>
        Isi
      </AppShell>,
    );
    await user.click(screen.getByRole("button", { name: "Buka navigasi" }));
    const drawer = screen.getByRole("dialog", { name: "Navigasi utama" });
    const link = within(drawer).getByRole("link", { name: "Stok" });
    link.addEventListener("click", (event) => event.preventDefault());
    await user.click(link);
    expect(screen.queryByRole("dialog", { name: "Navigasi utama" })).not.toBeInTheDocument();
  });

  it("uses the app's link renderer when provided", () => {
    render(
      <AppShell
        brand="Cafe Companion"
        labels={labels}
        navigation={navigation}
        renderLink={(item, props) => <a {...props} data-router-link={item.label} />}
      >
        Isi
      </AppShell>,
    );
    expect(screen.getAllByRole("link", { name: "Stok" })[0]).toHaveAttribute(
      "data-router-link",
      "Stok",
    );
  });

  it("switches workspace and location from one place", async () => {
    const user = userEvent.setup();
    const workspace = vi.fn();
    const location = vi.fn();
    render(
      <ContextSwitcher
        label="Ganti bisnis atau outlet"
        locationId="l1"
        locationLabel="Outlet"
        locations={[
          { id: "l1", name: "Sudirman" },
          { id: "l2", name: "Kemang" },
        ]}
        onLocationChange={location}
        onWorkspaceChange={workspace}
        workspaceId="w1"
        workspaceLabel="Bisnis"
        workspaces={[
          { id: "w1", name: "Kopi Senja" },
          { id: "w2", name: "Roti Pagi" },
        ]}
      />,
    );
    const trigger = screen.getByRole("button", { name: "Ganti bisnis atau outlet" });
    expect(trigger).toHaveTextContent("Kopi Senja");
    expect(trigger).toHaveTextContent("Sudirman");
    await user.click(trigger);
    await user.click(
      within(screen.getByRole("group", { name: "Outlet" })).getByRole("button", { name: "Kemang" }),
    );
    expect(location).toHaveBeenCalledWith("l2");
    await user.click(trigger);
    await user.click(
      within(screen.getByRole("group", { name: "Bisnis" })).getByRole("button", {
        name: "Roti Pagi",
      }),
    );
    expect(workspace).toHaveBeenCalledWith("w2");
  });

  it("shows plain context without a trigger when there is nothing to switch", () => {
    render(
      <ContextSwitcher
        label="Ganti bisnis atau outlet"
        locationId="l1"
        locationLabel="Outlet"
        locations={[{ id: "l1", name: "Sudirman" }]}
        workspaceId="w1"
        workspaceLabel="Bisnis"
        workspaces={[{ id: "w1", name: "Kopi Senja" }]}
      />,
    );
    expect(screen.getByText("Kopi Senja")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("changes language and theme and signs out from the user menu", async () => {
    const user = userEvent.setup();
    const language = vi.fn();
    const theme = vi.fn();
    const signOut = vi.fn();
    render(
      <UserMenu
        email="andi@example.com"
        label="Menu akun"
        language={{
          label: "Bahasa",
          onChange: language,
          options: [
            { label: "Indonesia", value: "id" },
            { label: "English", value: "en" },
          ],
          value: "id",
        }}
        name="Andi Rifqi"
        onSignOut={signOut}
        signOutLabel="Keluar"
        theme={{
          label: "Tema",
          onChange: theme,
          options: [
            { label: "Terang", value: "light" },
            { label: "Gelap", value: "dark" },
            { label: "Sistem", value: "system" },
          ],
          value: "system",
        }}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Menu akun" }));
    expect(screen.getByText("andi@example.com")).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "English" }));
    expect(language).toHaveBeenCalledWith("en");
    await user.click(screen.getByRole("radio", { name: "Gelap" }));
    expect(theme).toHaveBeenCalledWith("dark");
    await user.click(screen.getByRole("button", { name: "Keluar" }));
    expect(signOut).toHaveBeenCalled();
  });
});
