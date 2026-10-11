# Standservice in Google Apps Script

Dezelfde app als de Next.js-versie, maar volledig in je eigen Google-account: een Google Sheet is de database en het script is de web app. Geen Supabase of Vercel nodig.

## Installeren (eenmalig, ongeveer tien minuten)

1. Maak een nieuwe Google Sheet aan, bijvoorbeeld "Standservice".
2. Kies in de Sheet **Extensies > Apps Script**.
3. Vervang de inhoud van `Code.gs` door [Code.gs](Code.gs).
4. Klik op **+** naast Bestanden, kies **HTML**, noem het bestand `Index` en plak [Index.html](Index.html) erin.
5. Ga naar **Projectinstellingen** (tandwiel) en voeg onder **Script-eigenschappen** toe:
   | Eigenschap | Waarde |
   | --- | --- |
   | `CODE_KLANT` | inlogcode van de klant |
   | `CODE_TEAM` | inlogcode van het serviceteam |
   | `CODE_ADMIN` | inlogcode van de beheerder |
   | `NTFY_TOPIC` | optioneel, zie Telefoonmelding |

   Geef elk account een andere code.
6. Kies bovenin de functie `setup` en klik op **Uitvoeren**. Geef de gevraagde toestemming. De tabbladen "Opdrachten" en "Tijdlijn" worden aangemaakt.
7. Klik op **Implementeren > Nieuwe implementatie**, kies type **Web-app**, zet **Uitvoeren als** op *Ikzelf* en **Wie heeft toegang** op *Iedereen*. Klik op **Implementeren**.
8. Kopieer de web-app-URL. Dat is het adres van de app; deel het met de klant en het team.

Na een wijziging in de code kies je **Implementeren > Implementaties beheren**, potloodje, versie **Nieuwe versie**. De URL blijft dan hetzelfde.

## Telefoonmelding bij een nieuwe opdracht

Installeer de gratis app **ntfy** op je telefoon, abonneer je op een lang, moeilijk te raden onderwerp (bijvoorbeeld `standservice-8f3k2q9x`) en zet datzelfde onderwerp in de eigenschap `NTFY_TOPIC`. Bij elke nieuwe opdracht krijgt het team dan een melding.

## Hoe het werkt

- Inloggen gaat met alleen een code. De codes staan in de Script-eigenschappen, niet in de code.
- Na tien mislukte pogingen kan tien minuten niemand inloggen, zodat codes niet te raden zijn.
- Een sessie blijft zes uur geldig.
- Alle rechten worden op de server gecontroleerd: de klant kan de status niet aanpassen, alleen wijzigen zolang de status Nieuw is, en niets verwijderen. Alleen de beheerder kan verwijderen.
- De pagina ververst elke 30 seconden.
- Alle gegevens staan in de Sheet. Pas die niet met de hand aan terwijl mensen de app gebruiken.

## Eigen domein

Apps Script draait op een script.google.com-adres. Wil je dakru.nl gebruiken, zet dan bij je domeinbeheerder een doorverwijzing van bijvoorbeeld `service.dakru.nl` naar de web-app-URL.
