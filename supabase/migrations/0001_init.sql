-- Standservice: opdrachten per beursstand, met tijdlijn.
-- Rollen: klant (dient in, volgt status), team (past status aan), admin (team + verwijderen).

create type public.user_role as enum ('klant', 'team', 'admin');
create type public.order_status as enum ('nieuw', 'in_behandeling', 'afgerond', 'geannuleerd');
create type public.event_kind as enum ('created', 'edit', 'status', 'remark');

-- Eén profiel per account. Rol en naam zet de beheerder in Supabase.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.user_role not null default 'klant',
  display_name text not null
);

create table public.orders (
  id bigint generated always as identity (start with 1000) primary key,
  stands text[] not null check (cardinality(stands) > 0),
  description text not null check (length(trim(description)) > 0),
  status public.order_status not null default 'nieuw',
  created_by uuid not null default auth.uid() references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.order_events (
  id bigint generated always as identity primary key,
  order_id bigint not null references public.orders (id) on delete cascade,
  author uuid not null default auth.uid() references auth.users (id),
  author_name text not null,
  kind public.event_kind not null,
  body text not null,
  created_at timestamptz not null default now()
);

create index order_events_order_id_idx on public.order_events (order_id, created_at);
create index orders_status_idx on public.orders (status, updated_at desc);

-- Hulpfuncties
create function public.current_role() returns public.user_role
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

create function public.current_name() returns text
language sql stable security definer set search_path = public as $$
  select display_name from public.profiles where id = auth.uid()
$$;

create function public.status_label(s public.order_status) returns text
language sql immutable as $$
  select case s
    when 'nieuw' then 'Nieuw'
    when 'in_behandeling' then 'In behandeling'
    when 'afgerond' then 'Afgerond'
    when 'geannuleerd' then 'Geannuleerd'
  end
$$;

-- Bewaakt wat een klant mag wijzigen: alleen stands en omschrijving, en alleen zolang de status Nieuw is.
create function public.orders_before_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if public.current_role() = 'klant' then
    if old.status <> 'nieuw' then
      raise exception 'Een opdracht kan alleen gewijzigd worden zolang de status Nieuw is.';
    end if;
    if new.status <> old.status then
      raise exception 'Alleen het serviceteam kan de status aanpassen.';
    end if;
  end if;
  new.id := old.id;
  new.created_by := old.created_by;
  new.created_at := old.created_at;
  new.updated_at := now();
  return new;
end $$;

create trigger orders_before_update before update on public.orders
for each row execute function public.orders_before_update();

-- Schrijft indienen, wijzigen en statuswijzigingen automatisch in de tijdlijn.
create function public.orders_log_event() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  who text := coalesce(public.current_name(), 'Onbekend');
begin
  if tg_op = 'INSERT' then
    insert into public.order_events (order_id, author_name, kind, body)
    values (new.id, who, 'created', 'Opdracht ingediend');
  elsif new.status <> old.status then
    insert into public.order_events (order_id, author_name, kind, body)
    values (new.id, who, 'status', 'Status gewijzigd naar ' || public.status_label(new.status));
  elsif new.stands <> old.stands or new.description <> old.description then
    insert into public.order_events (order_id, author_name, kind, body)
    values (new.id, who, 'edit', 'Opdracht gewijzigd');
  end if;
  return new;
end $$;

create trigger orders_log_event after insert or update on public.orders
for each row execute function public.orders_log_event();

-- Een opmerking zet de laatste wijziging van de opdracht bij.
create function public.order_events_touch_order() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.orders set updated_at = now() where id = new.order_id and new.kind = 'remark';
  return new;
end $$;

create trigger order_events_touch_order after insert on public.order_events
for each row when (new.kind = 'remark') execute function public.order_events_touch_order();

-- Rechten per rij. Er is één klant, dus elk ingelogd account ziet alle opdrachten.
alter table public.profiles enable row level security;
alter table public.orders enable row level security;
alter table public.order_events enable row level security;

create policy "eigen profiel lezen" on public.profiles
  for select to authenticated using (true);

create policy "opdrachten lezen" on public.orders
  for select to authenticated using (true);

create policy "opdracht indienen" on public.orders
  for insert to authenticated with check (created_by = auth.uid() and status = 'nieuw');

create policy "opdracht wijzigen" on public.orders
  for update to authenticated
  using (public.current_role() in ('team', 'admin') or status = 'nieuw')
  with check (true);

create policy "opdracht verwijderen" on public.orders
  for delete to authenticated using (public.current_role() = 'admin');

create policy "tijdlijn lezen" on public.order_events
  for select to authenticated using (true);

create policy "opmerking plaatsen" on public.order_events
  for insert to authenticated
  with check (kind = 'remark' and author = auth.uid() and author_name = public.current_name());

create policy "opmerking verwijderen" on public.order_events
  for delete to authenticated using (public.current_role() = 'admin' and kind = 'remark');

-- Live bijwerken voor nieuwe opdrachten en statuswijzigingen.
alter publication supabase_realtime add table public.orders, public.order_events;
