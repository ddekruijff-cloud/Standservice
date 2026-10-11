import Link from "next/link";
import type { Order } from "@/lib/types";

export function OrderForm({
  action,
  order,
}: {
  action: (formData: FormData) => Promise<void>;
  order?: Order;
}) {
  return (
    <div className="detail">
      <div>
        <h2>{order ? `Opdracht #${order.id} wijzigen` : "Nieuwe opdracht"}</h2>
        <p className="sub">
          {order
            ? "Je kunt een opdracht wijzigen zolang de status Nieuw is."
            : "Vul de standnummers in en beschrijf wat er nodig is."}
        </p>
      </div>
      <form action={action}>
        <div className="field">
          <label htmlFor="stands">Standnummers</label>
          <input id="stands" name="stands" required placeholder="Bijv. 3.B14, 3.B16" defaultValue={order?.stands.join(", ")} />
          <p className="hint">Meerdere stands scheid je met een komma.</p>
        </div>
        <div className="field">
          <label htmlFor="description">Omschrijving</label>
          <textarea id="description" name="description" required placeholder="Bijv. Stroom valt steeds uit op de achterwand" defaultValue={order?.description} />
        </div>
        <div className="btns">
          <button className="btn" type="submit">{order ? "Wijziging opslaan" : "Opdracht indienen"}</button>
          <Link className="btn ghost" href={order ? `/opdrachten?id=${order.id}` : "/opdrachten"}>Annuleren</Link>
        </div>
      </form>
    </div>
  );
}
