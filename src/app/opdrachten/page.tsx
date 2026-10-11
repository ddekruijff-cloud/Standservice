import Link from "next/link";
import { formatTime, requireProfile } from "@/lib/session";
import { STATUSES, statusLabel, type Order, type OrderEvent, type Status } from "@/lib/types";
import { Header } from "./Header";
import { addRemark, deleteOrder, deleteRemark, setStatus } from "./actions";
import { LiveRefresh } from "./LiveRefresh";

type Search = Promise<{ status?: string; id?: string }>;

export default async function OrdersPage({ searchParams }: { searchParams: Search }) {
  const { status, id } = await searchParams;
  const { supabase, profile, isStaff } = await requireProfile();

  const { data: orders = [] } = await supabase
    .from("orders")
    .select("id, stands, description, status, created_at, updated_at")
    .order("updated_at", { ascending: false })
    .returns<Order[]>();

  const filter = STATUSES.some((s) => s.value === status) ? (status as Status) : null;
  const visible = (orders ?? []).filter((o) => !filter || o.status === filter);
  const selectedId = id ? Number(id) : visible[0]?.id;
  const selected = (orders ?? []).find((o) => o.id === selectedId);

  const { data: events = [] } = selected
    ? await supabase
        .from("order_events")
        .select("id, order_id, author_name, kind, body, created_at")
        .eq("order_id", selected.id)
        .order("created_at", { ascending: false })
        .returns<OrderEvent[]>()
    : { data: [] as OrderEvent[] };

  const href = (p: { status?: Status | null; id?: number }) => {
    const q = new URLSearchParams();
    if (p.status) q.set("status", p.status);
    if (p.id) q.set("id", String(p.id));
    const s = q.toString();
    return s ? `/opdrachten?${s}` : "/opdrachten";
  };

  return (
    <main className="wrap">
      <LiveRefresh />
      <Header profile={profile} />

      <nav className="counts" aria-label="Filter op status">
        <Link className="count" aria-current={!filter} href={href({})}>
          <strong>{orders?.length ?? 0}</strong>
          <span>Alle</span>
        </Link>
        {STATUSES.map((s) => (
          <Link key={s.value} className="count" aria-current={filter === s.value} href={href({ status: s.value })}>
            <strong>{orders?.filter((o) => o.status === s.value).length ?? 0}</strong>
            <span>{s.label}</span>
          </Link>
        ))}
      </nav>

      <div className="grid">
        <section className="panel">
          <div className="row">
            <h2>{isStaff ? "Binnengekomen opdrachten" : "Mijn opdrachten"}</h2>
            <Link className="btn small" href="/opdrachten/nieuw">Nieuwe opdracht</Link>
          </div>
          <p className="sub">
            {filter ? `Status: ${statusLabel(filter)}` : "Alle opdrachten"}, laatst gewijzigd bovenaan.
          </p>
          <ul className="list">
            {visible.length === 0 && <li className="empty">Geen opdrachten met deze status.</li>}
            {visible.map((o) => (
              <li key={o.id}>
                <Link className={`item ${o.id === selected?.id ? "selected" : ""}`} href={href({ status: filter, id: o.id })}>
                  <div className="row">
                    <Stands stands={o.stands} />
                    <Pill status={o.status} />
                  </div>
                  <p className="text">{o.description}</p>
                  <span className="meta">#{o.id} · laatste wijziging {formatTime(o.updated_at)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="panel">
          {!selected ? (
            <div className="empty">Kies een opdracht in de lijst, of dien een nieuwe in.</div>
          ) : (
            <div className="detail">
              <div>
                <div className="row">
                  <h2>Opdracht #{selected.id}</h2>
                  <Pill status={selected.status} />
                </div>
                <span className="meta">
                  Ingediend {formatTime(selected.created_at)} · laatste wijziging {formatTime(selected.updated_at)}
                </span>
              </div>
              <Stands stands={selected.stands} />
              <div>
                <span className="lbl">Omschrijving</span>
                <p className="text">{selected.description}</p>
                {profile.role === "klant" &&
                  (selected.status === "nieuw" ? (
                    <div className="btns" style={{ marginTop: 10 }}>
                      <Link className="btn ghost small" href={`/opdrachten/${selected.id}/wijzigen`}>Opdracht wijzigen</Link>
                    </div>
                  ) : (
                    <p className="hint">Wijzigen kan alleen zolang de status Nieuw is. Verwijderen kan niet.</p>
                  ))}
              </div>

              {isStaff && (
                <div>
                  <span className="lbl">Status</span>
                  <div className="statusset">
                    {STATUSES.map((s) => (
                      <form key={s.value} action={setStatus.bind(null, selected.id, s.value)}>
                        <button
                          type="submit"
                          className={selected.status === s.value ? `s-${s.value}` : ""}
                          aria-pressed={selected.status === s.value}
                          disabled={selected.status === s.value}
                        >
                          {s.label}
                        </button>
                      </form>
                    ))}
                  </div>
                  <p className="hint">De klant krijgt een e-mail bij elke statuswijziging.</p>
                </div>
              )}

              <form action={addRemark.bind(null, selected.id)}>
                <div className="field">
                  <label htmlFor="remark">Opmerking toevoegen</label>
                  <textarea
                    id="remark"
                    name="remark"
                    required
                    placeholder={isStaff ? "Bijv. Monteur komt om 14:00 langs" : "Bijv. We zijn tot 17:00 op de stand"}
                  />
                </div>
                <div className="btns">
                  <button className="btn" type="submit">Opmerking plaatsen</button>
                </div>
              </form>

              <div>
                <span className="lbl">Tijdlijn</span>
                <ul className="timeline">
                  {(events ?? []).map((e) => (
                    <li key={e.id} className={e.kind === "remark" ? "" : "ev"}>
                      <div className="head">
                        <b>{e.author_name}</b>
                        <span className="meta">{formatTime(e.created_at)}</span>
                        {profile.role === "admin" && e.kind === "remark" && (
                          <form action={deleteRemark.bind(null, e.id)}>
                            <button className="linkbtn" type="submit">Verwijderen</button>
                          </form>
                        )}
                      </div>
                      <span className="text">{e.body}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {profile.role === "admin" && (
                <details className="confirm">
                  <summary className="btn danger small">Opdracht verwijderen</summary>
                  <p className="meta">
                    De hele tijdlijn verdwijnt. Kies Geannuleerd als je de geschiedenis wilt bewaren.
                  </p>
                  <form action={deleteOrder.bind(null, selected.id)}>
                    <button className="btn danger small" type="submit">Definitief verwijderen</button>
                  </form>
                </details>
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function Pill({ status }: { status: Status }) {
  return <span className={`pill s-${status}`}>{statusLabel(status)}</span>;
}

function Stands({ stands }: { stands: string[] }) {
  return (
    <div className="stands">
      {stands.map((s) => (
        <span key={s} className="stand">{s}</span>
      ))}
    </div>
  );
}
