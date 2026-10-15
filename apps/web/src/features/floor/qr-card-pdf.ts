/**
 * A one-page PDF holding one JPEG picture that fills the page. Small enough
 * to write by hand, so printing a QR card needs no PDF library.
 */
export function pdfWithJpeg(
  jpeg: Uint8Array,
  picture: { height: number; width: number },
  pageMm: { height: number; width: number },
): Uint8Array {
  const toPoints = (mm: number) => Math.round((mm * 72) / 25.4);
  const width = toPoints(pageMm.width);
  const height = toPoints(pageMm.height);
  const encoder = new TextEncoder();
  const parts: Uint8Array[] = [];
  const offsets: number[] = [];
  let length = 0;
  const push = (part: string | Uint8Array) => {
    const bytes = typeof part === "string" ? encoder.encode(part) : part;
    parts.push(bytes);
    length += bytes.length;
  };
  const object = (body: () => void) => {
    offsets.push(length);
    body();
  };

  push("%PDF-1.4\n");
  object(() => push("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n"));
  object(() => push("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n"));
  object(() =>
    push(
      `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] ` +
        "/Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>\nendobj\n",
    ),
  );
  object(() => {
    push(
      `4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${picture.width} /Height ${picture.height} ` +
        `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`,
    );
    push(jpeg);
    push("\nendstream\nendobj\n");
  });
  const draw = `q ${width} 0 0 ${height} 0 0 cm /Im0 Do Q`;
  object(() => push(`5 0 obj\n<< /Length ${draw.length} >>\nstream\n${draw}\nendstream\nendobj\n`));

  const xref = length;
  push(`xref\n0 ${offsets.length + 1}\n0000000000 65535 f \n`);
  for (const offset of offsets) push(`${String(offset).padStart(10, "0")} 00000 n \n`);
  push(`trailer\n<< /Size ${offsets.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);

  const pdf = new Uint8Array(length);
  let at = 0;
  for (const part of parts) {
    pdf.set(part, at);
    at += part.length;
  }
  return pdf;
}
