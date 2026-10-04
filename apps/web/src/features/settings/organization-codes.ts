/** Time zones of Indonesia, west to east. An outlet set to another zone keeps it. */
export const OUTLET_TIME_ZONES = ["Asia/Jakarta", "Asia/Makassar", "Asia/Jayapura"] as const;

function plainWords(name: string) {
  return (
    name
      .normalize("NFKD")
      // "é" was split into "e" and its accent; the accent is dropped, the letter kept.
      .replace(/\p{M}/gu, "")
      .replace(/[^A-Za-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
  );
}

/** "Kopi Lokal" becomes kopi-lokal: the stable address of a brand. */
export function slugFromName(name: string) {
  return plainWords(name).toLowerCase().slice(0, 80).replace(/-+$/, "");
}

/** "Cabang Dago" becomes CABANG-DAGO: the stable code of an outlet. */
export function outletCodeFromName(name: string) {
  return plainWords(name).toUpperCase().slice(0, 40).replace(/-+$/, "");
}
