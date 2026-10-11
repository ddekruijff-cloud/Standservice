"use client";

import { useActionState } from "react";
import { login } from "./actions";

export default function LoginPage() {
  const [error, action, pending] = useActionState(login, null);
  return (
    <main className="wrap">
      <section className="panel login">
        <div>
          <h1>Inloggen</h1>
          <p className="sub">Serviceopdrachten voor je beursstand, van melding tot afgerond.</p>
        </div>
        <form action={action}>
          <div className="field">
            <label htmlFor="code">Inlogcode</label>
            <input id="code" name="code" type="password" inputMode="numeric" autoComplete="current-password" required />
          </div>
          {error && <p className="error">{error}</p>}
          <button className="btn" type="submit" disabled={pending}>
            {pending ? "Bezig met inloggen…" : "Inloggen"}
          </button>
        </form>
      </section>
    </main>
  );
}
