import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import { FileUpload, type FileUploadProps } from "./file-upload";

const base: FileUploadProps = {
  accept: "image/jpeg,image/png",
  chooseLabel: "Pilih gambar",
  hint: "JPG atau PNG. Maksimal 5 MB.",
  label: "Gambar produk",
  onSelect: () => undefined,
  replaceLabel: "Ganti",
};
const picture = () => new File(["x"], "kopi.png", { type: "image/png" });
const fileInput = (container: HTMLElement) =>
  container.querySelector<HTMLInputElement>('input[type="file"]')!;

describe("FileUpload", () => {
  it("starts with a neutral placeholder, what may be uploaded, and one button", () => {
    const { container } = render(<FileUpload {...base} />);

    expect(screen.getByRole("group", { name: "Gambar produk" })).toBeVisible();
    expect(screen.getByText("JPG atau PNG. Maksimal 5 MB.")).toBeVisible();
    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Pilih gambar" })).toBeEnabled();
    // No picture yet: an icon, not an image and not text.
    expect(container.querySelector(".ui-file-upload__preview img")).toBeNull();
    expect(container.querySelector(".ui-file-upload__preview svg")).not.toBeNull();
    expect(fileInput(container)).toHaveAttribute("accept", "image/jpeg,image/png");
  });

  it("hands the chosen file to the caller, also when the same file is chosen twice", async () => {
    const onSelect = vi.fn();
    const { container } = render(<FileUpload {...base} onSelect={onSelect} />);
    const file = picture();

    await userEvent.upload(fileInput(container), file);
    await userEvent.upload(fileInput(container), file);
    expect(onSelect).toHaveBeenCalledTimes(2);
    expect(onSelect).toHaveBeenLastCalledWith(file);
  });

  it("takes a file dropped on the field", () => {
    const onSelect = vi.fn();
    render(<FileUpload {...base} onSelect={onSelect} />);
    const group = screen.getByRole("group");
    const file = picture();

    fireEvent.dragOver(group);
    expect(group).toHaveAttribute("data-dragging", "true");
    fireEvent.drop(group, { dataTransfer: { files: [file] } });
    expect(onSelect).toHaveBeenCalledWith(file);
    expect(group).not.toHaveAttribute("data-dragging");
  });

  it("shows the picture and offers to replace or remove it", async () => {
    const onRemove = vi.fn();
    render(
      <FileUpload
        {...base}
        onRemove={onRemove}
        previewAlt="Kopi susu"
        previewUrl="blob:preview"
        removeLabel="Hapus"
      />,
    );

    expect(screen.getByRole("img", { name: "Kopi susu" })).toHaveAttribute("src", "blob:preview");
    expect(screen.getByRole("button", { name: "Ganti" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Pilih gambar" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Hapus" }));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it("offers no removal when the caller gives none", () => {
    render(<FileUpload {...base} previewUrl="blob:preview" />);
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });

  it("shows the progress and takes no other file while one is on its way", () => {
    const onSelect = vi.fn();
    const { container } = render(
      <FileUpload
        {...base}
        onSelect={onSelect}
        previewUrl="blob:preview"
        progress={40}
        progressLabel="Mengunggah 40%"
      />,
    );

    const bar = screen.getByRole("progressbar", { name: "Mengunggah 40%" });
    expect(bar).toHaveAttribute("aria-valuenow", "40");
    expect(screen.getByRole("button", { name: "Ganti" })).toBeDisabled();
    expect(fileInput(container)).toBeDisabled();
    fireEvent.drop(screen.getByRole("group"), { dataTransfer: { files: [picture()] } });
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("says why a file was refused and lets the person choose another", () => {
    render(<FileUpload {...base} error="Berkas kosong atau terlalu besar." />);

    expect(screen.getByRole("alert")).toHaveTextContent("Berkas kosong atau terlalu besar.");
    expect(screen.getByRole("group")).toHaveAttribute("data-invalid", "true");
    expect(screen.getByRole("button", { name: "Pilih gambar" })).toBeEnabled();
  });

  it("does nothing while disabled", () => {
    const onSelect = vi.fn();
    render(<FileUpload {...base} disabled onSelect={onSelect} />);
    expect(screen.getByRole("button", { name: "Pilih gambar" })).toBeDisabled();
    fireEvent.drop(screen.getByRole("group"), { dataTransfer: { files: [picture()] } });
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("passes an axe smoke test in every state", async () => {
    const { container } = render(
      <div>
        <FileUpload {...base} />
        <FileUpload
          {...base}
          label="Gambar kedua"
          onRemove={() => undefined}
          previewAlt="Kopi susu"
          previewUrl="blob:preview"
          progress={40}
          progressLabel="Mengunggah 40%"
          removeLabel="Hapus"
        />
        <FileUpload {...base} error="Jenis berkas ini tidak diizinkan." label="Gambar ketiga" />
      </div>,
    );
    expect((await axe(container)).violations).toEqual([]);
  });
});
