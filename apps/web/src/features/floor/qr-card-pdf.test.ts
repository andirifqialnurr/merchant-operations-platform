import assert from "node:assert/strict";
import test from "node:test";

import { pdfWithJpeg } from "./qr-card-pdf.ts";

test("the PDF has an A6 page, the picture, and a cross-reference that points at each object", () => {
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 0xff, 0xd9]);
  const pdf = pdfWithJpeg(jpeg, { height: 1480, width: 1050 }, { height: 148, width: 105 });
  const text = new TextDecoder("latin1").decode(pdf);
  assert.ok(text.startsWith("%PDF-1.4"));
  assert.ok(text.endsWith("%%EOF\n"));
  // 105 × 148 mm in points.
  assert.match(text, /\/MediaBox \[0 0 298 420\]/);
  assert.match(text, /\/Width 1050 \/Height 1480/);
  assert.match(text, /\/Length 9 >>/);

  const xref = Number(/startxref\n(\d+)/.exec(text)?.[1]);
  assert.ok(text.slice(xref).startsWith("xref"));
  const entries = [...text.slice(xref).matchAll(/^(\d{10}) 00000 n $/gm)].map((match) =>
    Number(match[1]),
  );
  assert.equal(entries.length, 5);
  entries.forEach((offset, index) => {
    assert.ok(text.slice(offset).startsWith(`${index + 1} 0 obj`), `object ${index + 1}`);
  });
});
