import Link from "next/link";
import { logout } from "../login/actions";
import type { Profile } from "@/lib/types";

const ROLE_LABEL = { klant: "Klant", team: "Serviceteam", admin: "Beheerder" } as const;

export function Header({ profile }: { profile: Profile }) {
  return (
    <header className="top">
      <Link href="/opdrachten" className="brand">
        <h1>Standservice</h1>
      </Link>
      <div className="who">
        <span className="role">{ROLE_LABEL[profile.role]}</span>
        <form action={logout}>
          <button className="btn ghost small" type="submit">Uitloggen</button>
        </form>
      </div>
    </header>
  );
}
