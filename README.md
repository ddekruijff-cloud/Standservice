# Standservice

> Er zijn twee versies. De **Google Apps Script-versie** in [`apps-script/`](apps-script/) is de gekozen versie: een Google Sheet als database, zonder extra accounts. De Next.js-versie hieronder blijft bewaard als alternatief.

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
3. Maak in Supabase onder Authentication drie gebruikers aan (klant, serviceteam, beheerder). Mensen loggen in met alleen een inlogcode; geef elk account een andere code. Het wachtwoord in Supabase is `CODE_PREFIX` gevolgd door die code (bijvoorbeeld prefix `x7Kq…` en code `1234` geeft wachtwoord `x7Kq…1234`). Geef ze daarna een profiel:
   ```sql
   insert into public.profiles (id, role, display_name) values
     ('<uuid klant>', 'klant', 'Klant'),
     ('<uuid team>', 'team', 'Serviceteam'),
     ('<uuid beheerder>', 'admin', 'Beheerder');
   ```
4. Kopieer `.env.example` naar `.env.local`, vul de URL en anon key van het Supabase-project in, zet in `ACCOUNT_EMAILS` de e-mailadressen van de drie accounts en in `CODE_PREFIX` een lange willekeurige tekst. Gebruikers zien die adressen nooit; ze loggen in met alleen hun code.
5. `npm install` en daarna `npm run dev`.

Op Vercel zet je dezelfde vier variabelen onder Environment Variables, en koppel je het domein op dakru.nl.

## Nog te doen

- In Supabase onder Authentication > Rate Limits het aantal inlogpogingen beperken, zodat codes niet te raden zijn.

- Telefoonmelding naar het serviceteam bij een nieuwe opdracht (bijvoorbeeld web push of een app als Pushover).
- E-mail naar de klant bij een statuswijziging (bijvoorbeeld via Resend).

Beide staan als TODO in `src/app/opdrachten/actions.ts`.
