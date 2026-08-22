# ⚽ Soccer Picks Studio

React (Vite) dashboard om TikTok-video's te maken voor soccer picks. Je typt per video een titel, account-handle, disclaimer en een lijst wedstrijden/picks/odds in; de app tekent daar live een 9:16 "ticket"-preview van en kan er een `.webm`-video van opnemen, met de gecombineerde odds (parlay) onderaan.

Wedstrijden worden automatisch opgehaald (gratis endpoint, geen odds); de odds zelf typ je zelf in, gebaseerd op een vaste lijst standaardpicks.

Je kunt meerdere video's tegelijk beheren — elk met eigen picks — en ze allemaal in één keer genereren en als zip downloaden.

## Starten

```bash
npm install
npm run dev
```

Open daarna de URL die Vite toont (meestal `http://localhost:5173`).

Voor een productie-build:

```bash
npm run build
npm run preview
```

## Gebruik

1. Klik op **+ Nieuwe video** om een extra videoproject toe te voegen (of **⧉** op een bestaand project om het te dupliceren).
2. Kies in de wedstrijdenlijst een datum en een wedstrijd (deze worden automatisch opgehaald, zonder odds).
3. Kies uit de 14 standaardpicks (bv. "Thuisteam wint", "Onder 2.5 doelpunten") en vul zelf de odds in die je ergens hebt opgezocht.
4. Vul per project account en disclaimer in — max. 8 picks per video.
5. Klik op **Video genereren** per project, of op **Genereer alle video's** om ze allemaal tegelijk op te nemen.
6. Download losse video's via de knop onder de preview, of alles ineens via **Download alles (.zip)**.

De video's worden lokaal in de browser opgenomen (canvas + MediaRecorder) als `.webm`. Accepteert TikTok dat bestand niet direct? Zet het dan gratis om naar `.mp4`, bijvoorbeeld via CloudConvert, voordat je uploadt.

## Projectstructuur

```
src/
  App.jsx                 – beheert de lijst video-projecten, batch-generatie en zip-download
  components/
    ProjectCard.jsx        – één video-project: formulier, picklijst, preview, opname
  lib/
    canvasRenderer.js       – tekent het ticket-frame op canvas (herbruikbaar per project)
    videoRecorder.js         – canvas.captureStream + MediaRecorder opnamelogica
    timeline.js               – animatietiming (intro, picks, parlay-reveal, outro)
    utils.js                   – kleine hulpfuncties (clamp, slugify, rounded rects, ...)
    pickTemplates.js          – vaste lijst van 14 standaard weddenschap-types per wedstrijd
server/
  oddsApi.js                – Vite dev-middleware die wedstrijden ophaalt via The Odds API `/events`
```

Werkt het soepelst in Chrome (breedste ondersteuning voor `canvas.captureStream`).
