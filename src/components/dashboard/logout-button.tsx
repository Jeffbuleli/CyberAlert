"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/primitives";

export function LogoutButton() {
  const router = useRouter();
  return (
    <Button
      variant="ghost"
      type="button"
      onClick={async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        router.push("/");
        router.refresh();
      }}
    >
      Déconnexion
    </Button>
  );
}
