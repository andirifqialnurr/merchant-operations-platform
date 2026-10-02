import { redirect } from "next/navigation";

/** The sell screen is not built yet; the cashier starts at the shift. */
export default function PosRoute() {
  redirect("/pos/shift");
}
