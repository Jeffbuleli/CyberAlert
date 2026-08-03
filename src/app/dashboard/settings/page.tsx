import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { Section } from "@/components/ui/primitives";
import { ProfileForm } from "@/components/dashboard/profile-form";
import { ChangePasswordForm } from "@/components/dashboard/change-password-form";
import { LogoutButton } from "@/components/dashboard/logout-button";

export default async function SettingsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  return (
    <Section className="py-10 sm:py-14">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link
            href="/dashboard"
            className="text-sm font-semibold text-[var(--ca-accent)] hover:underline"
          >
            ← Mon espace
          </Link>
          <h1 className="mt-2 text-2xl font-extrabold text-[var(--ca-ink)]">Paramètres</h1>
          <p className="mt-1 text-sm text-[var(--ca-ink-muted)]">
            Profil, sécurité du compte et session.
          </p>
        </div>
        <LogoutButton />
      </div>

      <div className="mx-auto grid max-w-xl gap-6">
        <ProfileForm
          initialName={user.name || ""}
          email={user.email}
          emailVerified={Boolean(user.emailVerifiedAt)}
        />
        <div>
          <h2 className="mb-3 font-semibold text-[var(--ca-ink)]">Sécurité du compte</h2>
          <ChangePasswordForm />
        </div>
      </div>
    </Section>
  );
}
