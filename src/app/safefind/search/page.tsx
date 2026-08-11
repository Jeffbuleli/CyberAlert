import { redirect } from "next/navigation";

export default function SafefindSearchPage() {
  redirect("/safefind?mode=lost&tab=search");
}
