import { redirect } from "next/navigation";

export default function SafefindLostPage() {
  redirect("/safefind?mode=lost");
}
