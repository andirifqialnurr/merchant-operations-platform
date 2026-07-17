import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";
import { Alert, Badge, Progress, ToastStack } from "./feedback";
describe("feedback primitives", () => {
  it("renders semantic feedback and live regions", () => {
    render(
      <>
        <Badge tone="success">Lunas</Badge>
        <Alert tone="danger">Koneksi gagal.</Alert>
        <ToastStack items={[{ id: "1", message: "Tersimpan", tone: "success" }]} />
        <Progress label="Unggah" value={50} />
      </>,
    );
    expect(screen.getByText("Lunas")).toBeInTheDocument();
    expect(screen.getAllByRole("alert")).toHaveLength(1);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "50");
  });
  it("passes an axe smoke test", async () => {
    const { container } = render(
      <Alert title="Perhatian" tone="warning">
        Periksa data Anda.
      </Alert>,
    );
    expect((await axe(container)).violations).toEqual([]);
  });
});
