"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Elk van de drie accounts heeft een eigen inlogcode; die code is het wachtwoord van het account in Supabase.
// Welke accounts er zijn, staat in ACCOUNT_EMAILS, zodat gebruikers geen e-mailadres hoeven in te vullen.
const ACCOUNT_EMAILS = (process.env.ACCOUNT_EMAILS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

export async function login(_: string | null, formData: FormData) {
  const code = String(formData.get("code") ?? "").trim();
  if (!code) return "Vul je inlogcode in.";
  const supabase = await createClient();
  for (const email of ACCOUNT_EMAILS) {
    const { error } = await supabase.auth.signInWithPassword({ email, password: code });
    if (!error) redirect("/opdrachten");
  }
  return "Deze code is niet bekend. Controleer de code en probeer het opnieuw.";
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
