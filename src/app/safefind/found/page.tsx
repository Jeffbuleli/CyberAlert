import { redirect } from "next/navigation";

export default function SafefindFoundPage() {
  redirect("/safefind?mode=found");
}
