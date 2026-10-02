import type messages from "../../messages/id.json";

import type { Locale } from "./locale";

/** Makes translation keys type-checked against the Indonesian dictionary. */
declare module "next-intl" {
  interface AppConfig {
    Locale: Locale;
    Messages: typeof messages;
  }
}
