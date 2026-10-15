import { publicQrResolutionSchema, type PublicQrResolution } from "@merchant/contracts";

/**
 * The table a QR leads to, asked of the API from the server so a shared link
 * shows the merchant's name. Nothing at all when the API cannot say.
 */
export async function resolveOnServer(token: string): Promise<PublicQrResolution | null> {
  const api = process.env.API_URL ?? "http://localhost:4001";
  try {
    const response = await fetch(
      `${api}/api/v1/public/table-qr/${encodeURIComponent(token.slice(0, 100))}`,
      { cache: "no-store" },
    );
    if (!response.ok) return null;
    const parsed = publicQrResolutionSchema.safeParse(await response.json());
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
