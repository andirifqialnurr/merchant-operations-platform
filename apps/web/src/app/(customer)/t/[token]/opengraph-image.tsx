import { ImageResponse } from "next/og";

import { resolveOnServer } from "./resolution";

export const size = { height: 630, width: 1200 };
export const contentType = "image/png";

/** The preview a messaging app shows for a shared table link: whose menu it is. */
export default async function Image({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const found = await resolveOnServer(token);
  return new ImageResponse(
    <div
      style={{
        background: "rgb(249 250 251)", // color-guardrails-ignore-line: rendered to a PNG, outside the theme.
        color: "rgb(17 24 39)", // color-guardrails-ignore-line: rendered to a PNG, outside the theme.
        display: "flex",
        flexDirection: "column",
        height: "100%",
        justifyContent: "center",
        padding: 96,
        width: "100%",
      }}
    >
      <div style={{ fontSize: 88, fontWeight: 700, lineHeight: 1.1 }}>
        {found?.merchantName ?? "Cafe Companion"}
      </div>
      {found?.outletName ? (
        <div
          style={{
            color: "rgb(75 85 99)", // color-guardrails-ignore-line: rendered to a PNG, outside the theme.
            fontSize: 44,
            marginTop: 24,
          }}
        >
          {found.outletName}
        </div>
      ) : null}
    </div>,
    size,
  );
}
