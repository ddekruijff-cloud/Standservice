# Standservice in Google Apps Script

Dezelfde app als de Next.js-versie, maar volledig in je eigen Google-account: een Google Sheet is de database en het script is de web app. Geen Supabase of Vercel nodig.

## Installeren (eenmalig, ongeveer tien minuten)

1. Maak een nieuwe Google Sheet aan, bijvoorbeeld "Standservice", en kies in de Sheet **Extensies > Apps Script**. Begon je los op script.google.com, dan kan dat ook: `setup` maakt dan zelf een Sheet "Standservice gegevens" aan in je Drive.
2. Open het script.
3. Vervang de inhoud van `Code.gs` door [Code.gs](Code.gs).
4. Klik op **+** naast Bestanden, kies **HTML**, noem het bestand `Index` en plak [Index.html](Index.html) erin.
5. Ga naar **Projectinstellingen** (tandwiel) en voeg onder **Script-eigenschappen** toe:
   | Eigenschap | Waarde | Voor wie |
   | --- | --- | --- |
   | `CODE_KLANT` | bijvoorbeeld `4821` | de klant |
   | `CODE_TEAM` | bijvoorbeeld `8756` | het serviceteam |
   | `CODE_ADMIN` | bijvoorbeeld `3390` | de beheerder |
   | `NTFY_TOPIC` | bijvoorbeeld `standservice-team-8f3k2q9x` (optioneel, zie Telefoonmeldingen) | het serviceteam |

   Vul bij Waarde alleen de code zelf in, zonder andere tekst. Geef elk account een andere code.
6. Kies bovenin de functie `setup` en klik op **Uitvoeren**. Geef de gevraagde toestemming. De tabbladen "Opdrachten" en "Tijdlijn" worden aangemaakt.
7. Klik op **Implementeren > Nieuwe implementatie**, kies type **Web-app**, zet **Uitvoeren als** op *Ikzelf* en **Wie heeft toegang** op *Iedereen*. Klik op **Implementeren**.
8. Kopieer de web-app-URL. Dat is het adres van de app; deel het met de klant en het team.

Na een wijziging in de code kies je **Implementeren > Implementaties beheren**, potloodje, versie **Nieuwe versie**. De URL blijft dan hetzelfde.

## Code werkt niet?

1. Kies in de editor de functie `checkSetup` en klik op **Uitvoeren**. Het logboek laat zien welke codes zijn ingesteld en zet de teller voor mislukte pogingen op nul.
2. Heb je de code in de editor aangepast? Kies dan **Implementeren > Implementaties beheren**, potloodje, versie **Nieuwe versie**. Anders draait de web-app nog op de oude code.

## Meldingen zonder app

- **In de app:** staat Standservice open bij het serviceteam (ook in een tabblad op de achtergrond), dan klinkt er bij een nieuwe opdracht een geluid, verschijnt er een melding en knippert de tabtitel. Daarvoor hoef je niets in te stellen.
- **Per e-mail:** zet in de Script-eigenschap `TEAM_EMAIL` het e-mailadres van het team (meerdere adressen scheiden met een komma). Bij elke nieuwe opdracht en elke opmerking van de klant komt er dan een e-mail met een link naar de app. Na het toevoegen vraagt Google één keer toestemming om e-mail te versturen: voer daarvoor `setup` nog een keer uit.

## Telefoonmeldingen via de ntfy-app (optioneel)

Meldingen lopen via de gratis app **ntfy** (App Store en Google Play). Je hebt geen account nodig.

| Eigenschap | Wie krijgt de melding | Wanneer |
| --- | --- | --- |
| `NTFY_TOPIC` | het serviceteam | nieuwe opdracht, opmerking van de klant |
| `NTFY_TOPIC_KLANT` | de klant | statuswijziging, opmerking van het team |

1. Bedenk per groep een lang, moeilijk te raden onderwerp, bijvoorbeeld `standservice-team-8f3k2q9x`. Iedereen die het onderwerp kent, kan de meldingen lezen.
2. Zet het onderwerp in de Script-eigenschap. Een nieuwe versie implementeren is daarvoor niet nodig.
3. Open ntfy op de telefoon, tik op **+** en abonneer je op hetzelfde onderwerp.

Tik je op een melding, dan opent de app.

## Hoe het werkt

- Inloggen gaat met alleen een code. De codes staan in de Script-eigenschappen, niet in de code.
- Na tien mislukte pogingen kan tien minuten niemand inloggen, zodat codes niet te raden zijn.
- Je logt één keer in per telefoon of computer; daarna blijf je 180 dagen ingelogd. Wijzig je de code van een account, dan moet iedereen met dat account opnieuw inloggen.
- Alle rechten worden op de server gecontroleerd: de klant kan de status niet aanpassen, alleen wijzigen zolang de status Nieuw is, en niets verwijderen. Alleen de beheerder kan verwijderen.
- De pagina ververst elke 30 seconden.
- Alle gegevens staan in de Sheet. Pas die niet met de hand aan terwijl mensen de app gebruiken.

## Op de telefoon

De app werkt op de telefoon: je ziet eerst de lijst, en een aangetikte opdracht opent op een eigen scherm met een knop terug. Zet de web-app-link op je beginscherm (Safari: Deel > Zet op beginscherm; Chrome: menu > Toevoegen aan startscherm), dan open je hem als een app.

## Eigen domein

Apps Script draait op een script.google.com-adres. Wil je dakru.nl gebruiken, zet dan bij je domeinbeheerder een doorverwijzing van bijvoorbeeld `service.dakru.nl` naar de web-app-URL.
