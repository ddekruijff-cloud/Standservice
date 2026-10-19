# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Wat dit is

Serviceportaal voor beursstands: de klant dient opdrachten in per standnummer, het serviceteam past de status aan en beide plaatsen opmerkingen. Drie rollen (`klant`, `team`, `admin`), vier statussen (Nieuw, In behandeling, Afgerond, Geannuleerd) en per opdracht een tijdlijn. De rechten per rol staan in `README.md`.

Interface, foutmeldingen en codecommentaar zijn in het Nederlands. Houd dat zo.

## Twee losse versies van dezelfde app

- **`apps-script/` is de gekozen versie** (Google Apps Script met een Google Sheet als database). Werk hierin, tenzij er expliciet om de Next.js-versie wordt gevraagd.
- **`src/` + `supabase/`** is een Next.js/Supabase-versie die als alternatief bewaard blijft. Neem wijzigingen niet vanzelf over naar de andere versie.

De twee delen geen code. Ze verschillen ook in details: Next.js slaat statussen op als `nieuw`/`in_behandeling` en zet ze om met `statusLabel`, Apps Script slaat de Nederlandse labels direct op. In Apps Script kan alleen de klant opdrachten indienen (`createOrder` weigert team en beheerder).

## Commando's

Apps Script heeft geen lokale tooling (geen clasp, geen build, geen tests). Je test een wijziging door `Code.gs`/`Index.html` in de Apps Script-editor te plakken en een nieuwe versie te implementeren: **Implementeren > Implementaties beheren > Nieuwe versie**. Zonder nieuwe versie draait de web-app nog op de oude code. Met `checkSetup` in de editor zie je welke codes zijn ingesteld, en het zet de teller voor mislukte inlogpogingen op nul.

Next.js-versie:

```bash
npm install
npm run dev     # lokaal, vereist .env.local (zie .env.example)
npm run build
npm run lint    # alleen typecheck: tsc --noEmit, er is geen ESLint
```

Er zijn geen tests.

## Architectuur: Apps Script (`apps-script/`)

- **`Code.gs`** is de server. `doGet` serveert `Index.html`. Elke publieke functie (`listOrders`, `getOrder`, `createOrder`, `updateOrder`, `setStatus`, `addRemark`, `deleteRemark`, `deleteOrder`, `getNotifySetup`) krijgt als eerste argument het sessietoken en roept als eerste `role_(token)` aan. Alle rechten worden hier gecontroleerd, niet in de HTML.
- **Functies die eindigen op `_` zijn privé**: Apps Script staat niet toe dat de client ze via `google.script.run` aanroept. Hulpfuncties moeten die underscore houden; een functie zonder underscore is publiek vanuit de browser.
- **Database**: de tabbladen `Opdrachten` en `Tijdlijn`. De kolomvolgorde staat in `ORDER_HEADERS`/`EVENT_HEADERS`, en code als `found.values[3]` (status) of `getRange(row, 6)` (gewijzigd) gaat uit van die posities. Elke schrijfactie loopt via `withLock_`. Tekst die de gebruiker invoert gaat door `text_()` (voorvoegsel `'`), zodat Sheets er geen formule of getal van maakt. Tijdlijnregels schrijf je zelf met `addEvent_`.
- **Inloggen**: alleen met een code. De codes staan in de Script-eigenschappen `CODE_KLANT`/`CODE_TEAM`/`CODE_ADMIN`. Sessies staan als `sess:<token>` in de Script-eigenschappen, met de CacheService ervoor. Een sessie bevat een hash van de code, dus als een code verandert, wordt die sessie ongeldig. Na `MAX_FAILED_LOGINS` mislukte pogingen is inloggen tien minuten geblokkeerd.
- **`SESSIE_VERLOPEN`** is een vaste foutstring: `call()` in `Index.html` herkent hem en logt de gebruiker dan uit. Gebruik hem niet voor andere fouten.
- **Meldingen**: `notifyTeam_` (ntfy via `NTFY_TOPIC` + e-mail via `TEAM_EMAIL`) en `notifyKlant_` (ntfy via `NTFY_TOPIC_KLANT`). Beide zijn optioneel en mogen nooit een actie laten mislukken (try/catch, `muteHttpExceptions`). Heeft een nieuwe Google-dienst een extra OAuth-scope nodig, voeg die dan toe aan `oauthScopes` in `appsscript.json`.
- **`Index.html`** is één bestand met CSS en vanilla JS, zonder framework of build. Het token staat in `localStorage` onder `standservice`. De pagina ververst elke 30 seconden (niet als er een veld focus heeft). Op de telefoon wisselt `showDetail()` tussen lijst en detail. HTML wordt met template strings opgebouwd: zet gebruikersinvoer altijd door `esc()`.

## Architectuur: Next.js (`src/`, `supabase/`)

- Next.js 15 App Router met React 19 en server actions (`src/app/**/actions.ts`), Supabase via `@supabase/ssr`, gehost op Vercel. Het alias `@/*` wijst naar `src/*`.
- **De rechten zitten in de database**: Row Level Security en triggers in `supabase/migrations/0001_init.sql`. De rolcontroles in `actions.ts` zijn alleen voor nette foutmeldingen. Een nieuwe regel hoort in de migratie.
- **De tijdlijn wordt door triggers gevuld**: `orders_log_event` legt indienen, wijzigen en statuswijzigingen vast, en `order_events_touch_order` werkt `updated_at` bij als er een opmerking bijkomt. De app voegt alleen opmerkingen (`kind: 'remark'`) zelf toe.
- **Inloggen** (`src/app/login/actions.ts`): de gebruiker vult alleen een code in. De server probeert voor elk adres in `ACCOUNT_EMAILS` `signInWithPassword` met `CODE_PREFIX + code`. `src/middleware.ts` stuurt niet-ingelogde gebruikers naar `/login`. `requireProfile()` in `src/lib/session.ts` haalt de rol op uit `profiles`.
- `LiveRefresh.tsx` luistert via Supabase Realtime naar `orders` en `order_events` en roept dan `router.refresh()` aan.
- Nog open (TODO in `src/app/opdrachten/actions.ts`): een melding aan het team bij een nieuwe opdracht en een e-mail aan de klant bij een statuswijziging.
