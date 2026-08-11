"use client";

import { Button } from "@/components/ui/primitives";

export function LogoutButton() {
  return (
    <Button
      variant="ghost"
      type="button"
      onClick={async () => {
        await fetch("/api/auth/logout", {
          method: "POST",
          credentials: "include",
        });
        window.location.assign("/");
      }}
    >
      Déconnexion
    </Button>
  );
}
