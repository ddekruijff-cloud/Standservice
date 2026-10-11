"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Elk van de drie accounts heeft een eigen inlogcode. Het wachtwoord in Supabase is CODE_PREFIX + code,
// zodat ook een korte code (Supabase eist minstens 6 tekens) werkt en het wachtwoord niet alleen uit de code bestaat.
// Welke accounts er zijn, staat in ACCOUNT_EMAILS, zodat gebruikers geen e-mailadres hoeven in te vullen.
const CODE_PREFIX = process.env.CODE_PREFIX ?? "";
const ACCOUNT_EMAILS = (process.env.ACCOUNT_EMAILS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

export async function login(_: string | null, formData: FormData) {
  const code = String(formData.get("code") ?? "").trim();
  if (!code) return "Vul je inlogcode in.";
  const supabase = await createClient();
  for (const email of ACCOUNT_EMAILS) {
    const { error } = await supabase.auth.signInWithPassword({ email, password: CODE_PREFIX + code });
    if (!error) redirect("/opdrachten");
  }
  return "Deze code is niet bekend. Controleer de code en probeer het opnieuw.";
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
