# Standservice

Serviceportaal voor beursstands. De klant dient opdrachten in per standnummer en volgt de status. Het serviceteam ontvangt de opdrachten, past de status aan en reageert met opmerkingen.

## Rollen

| Rol | Kan |
| --- | --- |
| Klant | Opdracht indienen, wijzigen zolang de status Nieuw is, opmerkingen plaatsen, status volgen. Kan niets verwijderen. |
| Serviceteam | Alle opdrachten zien, status aanpassen, opmerkingen plaatsen, zelf opdrachten aanmaken. |
| Beheerder | Alles wat het serviceteam kan, en opdrachten of opmerkingen verwijderen. |

Statussen: Nieuw, In behandeling, Afgerond, Geannuleerd. Elke opdracht heeft een tijdlijn met naam en tijdstip; indienen, wijzigen en statuswijzigingen worden automatisch vastgelegd.

De rechten worden in de database afgedwongen (Row Level Security en triggers in `supabase/migrations/0001_init.sql`), niet alleen in de interface.

## Techniek

Next.js (App Router, TypeScript), Supabase (PostgreSQL, Auth, Realtime) en hosting op Vercel.

## Opzetten

1. Maak een Supabase-project aan in de EU-regio.
2. Voer `supabase/migrations/0001_init.sql` uit in de SQL-editor.
3. Maak in Supabase onder Authentication drie gebruikers aan (klant, serviceteam, beheerder) en geef ze een profiel:
   ```sql
   insert into public.profiles (id, role, display_name) values
     ('<uuid klant>', 'klant', 'Klant'),
     ('<uuid team>', 'team', 'Serviceteam'),
     ('<uuid beheerder>', 'admin', 'Beheerder');
   ```
4. Kopieer `.env.example` naar `.env.local` en vul de URL en anon key van het Supabase-project in.
5. `npm install` en daarna `npm run dev`.

Op Vercel zet je dezelfde twee variabelen onder Environment Variables, en koppel je het domein op dakru.nl.

## Nog te doen

- Telefoonmelding naar het serviceteam bij een nieuwe opdracht (bijvoorbeeld web push of een app als Pushover).
- E-mail naar de klant bij een statuswijziging (bijvoorbeeld via Resend).

Beide staan als TODO in `src/app/opdrachten/actions.ts`.
