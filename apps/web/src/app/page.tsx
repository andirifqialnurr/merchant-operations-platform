import { redirect } from "next/navigation";

/** The app has no landing page of its own; signed-in work starts in the backoffice. */
export default function HomePage() {
  redirect("/catalog");
}
