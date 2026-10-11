import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";
import type { Profile } from "./types";

export async function requireProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, display_name")
    .eq("id", user.id)
    .single<Profile>();
  if (!profile) throw new Error("Dit account heeft nog geen profiel. Vraag de beheerder om een rol toe te kennen.");
  return { supabase, user, profile, isStaff: profile.role !== "klant" };
}

export function parseStands(raw: string) {
  return [...new Set(raw.split(/[,\n]/).map((s) => s.trim().toUpperCase()).filter(Boolean))];
}

export function formatTime(iso: string) {
  return new Date(iso).toLocaleString("nl-NL", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Amsterdam",
  });
}
