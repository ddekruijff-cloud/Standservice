import { notFound, redirect } from "next/navigation";
import { requireProfile } from "@/lib/session";
import type { Order } from "@/lib/types";
import { Header } from "../../Header";
import { OrderForm } from "../../OrderForm";
import { updateOrder } from "../../actions";

export default async function EditOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, profile } = await requireProfile();
  const { data: order } = await supabase
    .from("orders")
    .select("id, stands, description, status, created_at, updated_at")
    .eq("id", Number(id))
    .single<Order>();
  if (!order) notFound();
  if (order.status !== "nieuw") redirect(`/opdrachten?id=${order.id}`);
  return (
    <main className="wrap">
      <Header profile={profile} />
      <section className="panel" style={{ maxWidth: 640 }}>
        <OrderForm action={updateOrder.bind(null, order.id)} order={order} />
      </section>
    </main>
  );
}
