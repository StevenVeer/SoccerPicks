# ⚽ Soccer Picks Studio

React (Vite) dashboard om TikTok-video's te maken voor soccer picks. Je typt per video een titel, account-handle, disclaimer en een lijst wedstrijden/picks/odds in; de app tekent daar live een 9:16 "ticket"-preview van en kan er een `.webm`-video van opnemen, met de gecombineerde odds (parlay) onderaan.

Wedstrijden worden automatisch opgehaald (gratis endpoint, geen odds). Odds typ je zelf in, of je klikt bij een gekozen wedstrijd op **Request live odds** om de echte quotes op te halen bij The Odds API — dat kost credits (gratis quotum is 500/maand), dus dat gebeurt alleen op eigen initiatief. Eén klik haalt in één API-call de odds op van *alle* wedstrijden van die competitie op die dag (de kosten zijn markets × regions, niet per wedstrijd), en het resultaat wordt in de Postgres-database bewaard (niet alleen in het geheugen, dus ook niet weg na een herstart van de containers) tot 3 uur na de aftrap van de laatste wedstrijd in die opvraag — daarna kunnen die wedstrijden toch niet meer opgevraagd worden bij The Odds API, dus wordt de rij automatisch opgeruimd. Boven de wedstrijdenlijst zie je hoeveel credits er nog over zijn, en na elke live-opvraag hoeveel die specifieke klik heeft gekost. Bij elke pick worden ook de teamlogo's opgehaald (via TheSportsDB, met de gratis test-key als default) en in het ticket getekend naast de teamnamen; ontbreekt een logo, dan valt de tekst gewoon terug op alleen de teamnaam.

Je kunt meerdere video's tegelijk beheren — elk met eigen picks — en ze allemaal in één keer genereren en als zip downloaden.

Naast de lokale opslag (localStorage + IndexedDB, altijd leidend) houdt de app ook een permanent archief bij in een zelf-gehoste Postgres-database, bediend door een eigen API-server — geen Supabase of andere externe dienst.

## Starten (Docker, aanbevolen)

```bash
cp .env.example .env
# vul POSTGRES_PASSWORD en ODDS_API_KEY in .env in
docker compose up -d --build
```

Open daarna `http://localhost:6060`. Na een `git pull` van nieuwe wijzigingen: herhaal dezelfde `docker compose up -d --build` om de containers herbouwd en herstart te krijgen.

## Starten (lokale ontwikkeling zonder Docker)

Vereist een lokaal draaiende Postgres-instantie met het `posted_videos`/`video_picks`-schema.

```bash
npm install
npm run dev            # frontend, http://localhost:5173

cd server
npm install
# .env met DATABASE_URL, ODDS_API_KEY en eventueel VIDEO_DIR / SPORTSDB_API_KEY
node index.js           # API, http://localhost:3001
```

Voor een productie-build van alleen de frontend:

```bash
npm run build
npm run preview
```

## Gebruik

1. Klik op **+ Nieuwe video** om een extra videoproject toe te voegen (of **⧉** op een bestaand project om het te dupliceren).
2. Kies in de wedstrijdenlijst een datum en een wedstrijd (deze worden automatisch opgehaald, zonder odds).
3. Klik eventueel op **Request live odds** om de echte quotes voor die competitie/dag op te halen (kost credits), of kies uit de 14 standaardpicks (bv. "Thuisteam wint", "Onder 2.5 doelpunten") en vul zelf de odds in die je ergens hebt opgezocht.
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
    teamCrests.js               – haalt en cachet teamlogo's op voor gebruik in de canvas
    archive.js                 – stuurt project + media naar de eigen archief-API (faalt stil)
server/
  index.js                    – Express-API: wedstrijden-proxy (`/api/football/matches`), live-odds-proxy (`/api/football/odds`, `/api/football/credits`, bewaart resultaten zelf in de `odds_cache`-tabel die de app bij de eerste aanvraag aanmaakt), teamlogo-proxy (`/api/teams/crest`) en archief (`/api/archive`)
  db.js                        – Postgres-connectiepool
```

Werkt het soepelst in Chrome (breedste ondersteuning voor `canvas.captureStream`).
