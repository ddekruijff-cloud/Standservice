"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { parseStands, requireProfile } from "@/lib/session";
import type { Status } from "@/lib/types";

function readOrderForm(formData: FormData) {
  const stands = parseStands(String(formData.get("stands") ?? ""));
  const description = String(formData.get("description") ?? "").trim();
  if (!stands.length || !description) {
    throw new Error("Vul minstens één standnummer en een omschrijving in.");
  }
  return { stands, description };
}

export async function createOrder(formData: FormData) {
  const { supabase } = await requireProfile();
  const { data, error } = await supabase.from("orders").insert(readOrderForm(formData)).select("id").single();
  if (error) throw new Error(error.message);
  // TODO: telefoonmelding naar het serviceteam (zie README).
  revalidatePath("/opdrachten");
  redirect(`/opdrachten?id=${data.id}`);
}

export async function updateOrder(id: number, formData: FormData) {
  const { supabase } = await requireProfile();
  const { error } = await supabase.from("orders").update(readOrderForm(formData)).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/opdrachten");
  redirect(`/opdrachten?id=${id}`);
}

export async function setStatus(id: number, status: Status) {
  const { supabase, isStaff } = await requireProfile();
  if (!isStaff) throw new Error("Alleen het serviceteam kan de status aanpassen.");
  const { error } = await supabase.from("orders").update({ status }).eq("id", id);
  if (error) throw new Error(error.message);
  // TODO: e-mail naar de klant over de nieuwe status (zie README).
  revalidatePath("/opdrachten");
}

export async function addRemark(id: number, formData: FormData) {
  const { supabase, user, profile } = await requireProfile();
  const body = String(formData.get("remark") ?? "").trim();
  if (!body) return;
  const { error } = await supabase
    .from("order_events")
    .insert({ order_id: id, author: user.id, author_name: profile.display_name, kind: "remark", body });
  if (error) throw new Error(error.message);
  revalidatePath("/opdrachten");
}

export async function deleteRemark(eventId: number) {
  const { supabase, profile } = await requireProfile();
  if (profile.role !== "admin") throw new Error("Alleen de beheerder kan opmerkingen verwijderen.");
  const { error } = await supabase.from("order_events").delete().eq("id", eventId);
  if (error) throw new Error(error.message);
  revalidatePath("/opdrachten");
}

export async function deleteOrder(id: number) {
  const { supabase, profile } = await requireProfile();
  if (profile.role !== "admin") throw new Error("Alleen de beheerder kan opdrachten verwijderen.");
  const { error } = await supabase.from("orders").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/opdrachten");
  redirect("/opdrachten");
}
