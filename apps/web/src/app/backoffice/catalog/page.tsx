import { redirect } from "next/navigation";

/** The catalog moved to /catalog; keep old bookmarks working. */
export default function LegacyCatalogPage() {
  redirect("/catalog");
}
