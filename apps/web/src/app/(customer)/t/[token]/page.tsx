import type { Metadata } from "next";
import { createTranslator } from "next-intl";

import { GuestOrderPage } from "@/features/self-order";
import { loadMessages, resolveLocale } from "@/i18n/server";

import { resolveOnServer } from "./resolution";

type Params = Promise<{ token: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { token } = await params;
  const locale = await resolveLocale();
  const t = createTranslator({ locale, messages: await loadMessages(locale), namespace: "guest" });
  const found = await resolveOnServer(token);
  const title =
    found?.merchantName && found.tableLabel
      ? t("metaTitle", { merchant: found.merchantName, table: found.tableLabel })
      : t("metaFallbackTitle");
  const description = t("metaDescription");
  return {
    description,
    openGraph: { description, title, type: "website" },
    // The address holds the table's key; it is for the guests at that table only.
    robots: { follow: false, index: false },
    title,
  };
}

export default async function GuestTablePage({ params }: { params: Params }) {
  const { token } = await params;
  return <GuestOrderPage token={token} />;
}
