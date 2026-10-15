"use client";

import QRCode from "qrcode";

import { pdfWithJpeg } from "./qr-card-pdf";

export type QrCardFormat = "a6" | "sticker";

/** Paper size, and the picture size it is drawn at (10–12 dots per mm). */
export const QR_CARD_FORMATS: Record<
  QrCardFormat,
  { mm: { height: number; width: number }; px: { height: number; width: number } }
> = {
  a6: { mm: { height: 148, width: 105 }, px: { height: 1480, width: 1050 } },
  sticker: { mm: { height: 50, width: 50 }, px: { height: 600, width: 600 } },
};

export type QrCardText = {
  /** Both languages in one line: the card is read by every guest. */
  instructions: string;
  outletName: string;
  tableLabel: string;
};

/** The largest size, up to `max`, at which `text` fits in `width`. */
function fitFont(
  context: CanvasRenderingContext2D,
  text: string,
  width: number,
  max: number,
  weight: number,
  family: string,
) {
  let size = max;
  do {
    context.font = `${weight} ${size}px ${family}`;
    if (context.measureText(text).width <= width) return size;
    size -= 2;
  } while (size > 12);
  return size;
}

/**
 * Draws a table's QR card: the outlet, the table, the QR, and how to use it.
 * Black on white whatever the screen theme, so it prints the same everywhere.
 */
export async function drawQrCard(format: QrCardFormat, url: string, text: QrCardText) {
  const { px } = QR_CARD_FORMATS[format];
  const canvas = document.createElement("canvas");
  canvas.width = px.width;
  canvas.height = px.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is not available.");
  const family = getComputedStyle(document.body).fontFamily || "sans-serif";
  context.fillStyle = "white";
  context.fillRect(0, 0, px.width, px.height);
  context.fillStyle = "black";
  context.textAlign = "center";
  context.textBaseline = "alphabetic";
  const center = px.width / 2;
  const margin = Math.round(px.width * 0.08);
  const inner = px.width - margin * 2;

  const qr = document.createElement("canvas");
  if (format === "a6") {
    fitFont(context, text.outletName, inner, 64, 600, family);
    context.fillText(text.outletName, center, 150);
    fitFont(context, text.tableLabel, inner, 200, 700, family);
    context.fillText(text.tableLabel, center, 380);
    const size = 760;
    await QRCode.toCanvas(qr, url, { errorCorrectionLevel: "M", margin: 2, width: size });
    context.drawImage(qr, center - size / 2, 450, size, size);
    fitFont(context, text.instructions, inner, 46, 500, family);
    context.fillText(text.instructions, center, 1320);
  } else {
    const size = 440;
    await QRCode.toCanvas(qr, url, { errorCorrectionLevel: "M", margin: 1, width: size });
    context.drawImage(qr, center - size / 2, 30, size, size);
    fitFont(context, text.tableLabel, inner, 76, 700, family);
    context.fillText(text.tableLabel, center, 545);
  }
  return canvas;
}

function download(blob: Blob, fileName: string) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

/** A file name from the table's label, safe on every system. */
export function cardFileName(tableLabel: string, format: QrCardFormat, extension: string) {
  const name = tableLabel.replace(/[^A-Za-z0-9-]+/g, "-").replace(/^-+|-+$/g, "") || "meja";
  return `qr-${name}-${format}.${extension}`;
}

export async function downloadPng(canvas: HTMLCanvasElement, fileName: string) {
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (blob) download(blob, fileName);
}

export async function downloadPdf(
  canvas: HTMLCanvasElement,
  format: QrCardFormat,
  fileName: string,
) {
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.95),
  );
  if (!blob) return;
  const jpeg = new Uint8Array(await blob.arrayBuffer());
  const pdf = pdfWithJpeg(
    jpeg,
    { height: canvas.height, width: canvas.width },
    QR_CARD_FORMATS[format].mm,
  );
  download(new Blob([pdf.buffer as ArrayBuffer], { type: "application/pdf" }), fileName);
}

/** Prints the card alone, at its paper size, from a window of its own. */
export function printCard(canvas: HTMLCanvasElement, format: QrCardFormat, title: string) {
  const { mm } = QR_CARD_FORMATS[format];
  const view = window.open("", "_blank", "noopener=no,width=480,height=640");
  if (!view) return false;
  const image = view.document.createElement("img");
  image.src = canvas.toDataURL("image/png");
  image.alt = title;
  image.style.cssText = `display:block;width:${mm.width}mm;height:${mm.height}mm`;
  const style = view.document.createElement("style");
  style.textContent = `@page{size:${mm.width}mm ${mm.height}mm;margin:0}html,body{margin:0}`;
  view.document.title = title;
  view.document.head.append(style);
  view.document.body.append(image);
  image.onload = () => {
    view.focus();
    view.print();
  };
  return true;
}
