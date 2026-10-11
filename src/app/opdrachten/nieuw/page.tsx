import { requireProfile } from "@/lib/session";
import { Header } from "../Header";
import { OrderForm } from "../OrderForm";
import { createOrder } from "../actions";

export default async function NewOrderPage() {
  const { user, profile } = await requireProfile();
  return (
    <main className="wrap">
      <Header profile={profile} email={user.email} />
      <section className="panel" style={{ maxWidth: 640 }}>
        <OrderForm action={createOrder} />
      </section>
    </main>
  );
}
