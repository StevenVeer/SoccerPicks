import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pool } from './db.js';

// Personal, single-user tool — not meant to be exposed publicly.
// There is intentionally no login/auth on any of these routes.

const app = express();
const upload = multer({ storage: multer.memoryStorage() });
const VIDEO_DIR = process.env.VIDEO_DIR || '/data/videos';

app.use(cors());

const LEAGUES = [
  // Top competitions — shown first and selected by default.
  { key: 'soccer_epl', name: 'Premier League', country: 'England', tier: 'top' },
  { key: 'soccer_spain_la_liga', name: 'La Liga', country: 'Spain', tier: 'top' },
  { key: 'soccer_germany_bundesliga', name: 'Bundesliga', country: 'Germany', tier: 'top' },
  { key: 'soccer_italy_serie_a', name: 'Serie A', country: 'Italy', tier: 'top' },
  { key: 'soccer_france_ligue_one', name: 'Ligue 1', country: 'France', tier: 'top' },
  { key: 'soccer_netherlands_eredivisie', name: 'Eredivisie', country: 'Netherlands', tier: 'top' },
  { key: 'soccer_uefa_champs_league', name: 'Champions League', country: 'Europe', tier: 'top' },
  { key: 'soccer_uefa_europa_league', name: 'Europa League', country: 'Europe', tier: 'top' },

  // Other competitions — collapsed under "Overige competities" in the UI.
  { key: 'soccer_uefa_europa_conference_league', name: 'Conference League', country: 'Europe', tier: 'other' },
  { key: 'soccer_portugal_primeira_liga', name: 'Primeira Liga', country: 'Portugal', tier: 'other' },
  { key: 'soccer_sweden_allsvenskan', name: 'Allsvenskan', country: 'Sweden', tier: 'other' },
  { key: 'soccer_norway_eliteserien', name: 'Eliteserien', country: 'Norway', tier: 'other' },
  { key: 'soccer_efl_champ', name: 'Championship', country: 'England', tier: 'other' },
  { key: 'soccer_england_league1', name: 'League One', country: 'England', tier: 'other' },
  { key: 'soccer_england_league2', name: 'League Two', country: 'England', tier: 'other' },
  { key: 'soccer_fa_cup', name: 'FA Cup', country: 'England', tier: 'other' },
  { key: 'soccer_efl_cup', name: 'EFL Cup', country: 'England', tier: 'other' },
  { key: 'soccer_italy_serie_b', name: 'Serie B', country: 'Italy', tier: 'other' },
  { key: 'soccer_germany_bundesliga2', name: '2. Bundesliga', country: 'Germany', tier: 'other' },
  { key: 'soccer_france_ligue_two', name: 'Ligue 2', country: 'France', tier: 'other' },
  { key: 'soccer_spain_segunda_division', name: 'La Liga 2', country: 'Spain', tier: 'other' },
  { key: 'soccer_netherlands_eerste_divisie', name: 'Eerste Divisie', country: 'Netherlands', tier: 'other' },
  { key: 'soccer_spl', name: 'Scottish Premiership', country: 'Scotland', tier: 'other' },
  { key: 'soccer_belgium_first_div', name: 'Pro League', country: 'Belgium', tier: 'other' },
  { key: 'soccer_denmark_superliga', name: 'Superliga', country: 'Denmark', tier: 'other' },
  { key: 'soccer_turkey_super_league', name: 'Süper Lig', country: 'Turkey', tier: 'other' },
  { key: 'soccer_usa_mls', name: 'MLS', country: 'USA', tier: 'other' },
  { key: 'soccer_mexico_ligamx', name: 'Liga MX', country: 'Mexico', tier: 'other' },
  { key: 'soccer_brazil_campeonato', name: 'Brasileirão', country: 'Brazil', tier: 'other' },
  { key: 'soccer_argentina_primera_division', name: 'Primera División', country: 'Argentina', tier: 'other' },
  { key: 'soccer_saudi_pro_league', name: 'Saudi Pro League', country: 'Saudi Arabia', tier: 'other' },
  { key: 'soccer_australia_aleague', name: 'A-League', country: 'Australia', tier: 'other' },

  // More European cups — key names are our best guess and unverified against
  // a live API response; drop any that turn out not to exist.
  { key: 'soccer_germany_dfb_pokal', name: 'DFB-Pokal', country: 'Germany', tier: 'other' },
  { key: 'soccer_spain_copa_del_rey', name: 'Copa del Rey', country: 'Spain', tier: 'other' },
  { key: 'soccer_italy_coppa_italia', name: 'Coppa Italia', country: 'Italy', tier: 'other' },
  { key: 'soccer_france_coupe_de_france', name: 'Coupe de France', country: 'France', tier: 'other' },

  // International tournaments — same caveat; some are also only active
  // (return matches) during the tournament window itself.
  { key: 'soccer_fifa_world_cup', name: 'WK', country: 'International', tier: 'other' },
  { key: 'soccer_uefa_european_championship', name: 'EK', country: 'International', tier: 'other' },
  { key: 'soccer_uefa_nations_league', name: 'UEFA Nations League', country: 'International', tier: 'other' },
  { key: 'soccer_conmebol_copa_america', name: 'Copa América', country: 'International', tier: 'other' },
  { key: 'soccer_africa_cup_of_nations', name: 'Africa Cup of Nations', country: 'International', tier: 'other' },
];

const matchesCache = new Map();
const MATCH_CACHE_MS = 6 * 60 * 60 * 1000;
const CACHE_ENTRY_MAX_AGE_MS = 2 * 24 * 60 * 60 * 1000;

async function apiRequest(requestPath, apiKey) {
  const separator = requestPath.includes('?') ? '&' : '?';
  const response = await fetch(`https://api.the-odds-api.com/v4${requestPath}${separator}apiKey=${encodeURIComponent(apiKey)}`);
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || `The Odds API returned ${response.status}`);
  return data;
}

function normalizeMatch(event, league) {
  return {
    id: event.id,
    sportKey: league.key,
    kickoff: event.commence_time,
    status: new Date(event.commence_time) <= new Date() ? 'LIVE' : 'SCHEDULED',
    home: event.home_team,
    away: event.away_team,
    league: league.name,
    country: league.country,
    tier: league.tier,
  };
}

// TheSportsDB's shared "123" free key works without any signup, at low volume —
// fine for a personal, single-user tool like this one.
const SPORTSDB_API_KEY = process.env.SPORTSDB_API_KEY || '123';
const crestCache = new Map();
const CREST_CACHE_MS = 30 * 24 * 60 * 60 * 1000;
const CREST_NOT_FOUND = Symbol('crest-not-found');

async function fetchCrest(teamName) {
  const searchUrl = `https://www.thesportsdb.com/api/v1/json/${SPORTSDB_API_KEY}/searchteams.php?t=${encodeURIComponent(teamName)}`;
  const searchResponse = await fetch(searchUrl);
  if (!searchResponse.ok) {
    const body = await searchResponse.text().catch(() => '');
    throw new Error(`TheSportsDB search failed (${searchResponse.status}): ${body.slice(0, 200)}`);
  }
  const searchData = await searchResponse.json();
  const teams = searchData.teams || [];
  const team = teams.find((t) => t.strSport === 'Soccer') || teams[0];
  const badgeUrl = team?.strBadge;
  if (!badgeUrl) {
    console.warn(`[crest] no team/badge found for "${teamName}" (${teams.length} results)`);
    return null;
  }

  const imageResponse = await fetch(badgeUrl);
  if (!imageResponse.ok) throw new Error(`Crest image fetch failed (${imageResponse.status}) for ${badgeUrl}`);
  const contentType = imageResponse.headers.get('content-type') || 'image/png';
  const buffer = Buffer.from(await imageResponse.arrayBuffer());
  return { buffer, contentType };
}

app.get('/api/teams/crest', async (req, res) => {
  const name = (req.query.name || '').trim();
  if (!name) {
    res.status(400).json({ error: 'name is required' });
    return;
  }

  const key = name.toLowerCase();
  const cached = crestCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    if (cached.value === CREST_NOT_FOUND) {
      res.status(404).end();
    } else {
      res.set('Content-Type', cached.value.contentType);
      res.set('Cache-Control', 'public, max-age=86400');
      res.send(cached.value.buffer);
    }
    return;
  }

  try {
    const crest = await fetchCrest(name);
    const value = crest || CREST_NOT_FOUND;
    crestCache.set(key, { value, expiresAt: Date.now() + CREST_CACHE_MS });
    if (!crest) {
      res.status(404).end();
      return;
    }
    res.set('Content-Type', crest.contentType);
    res.set('Cache-Control', 'public, max-age=86400');
    res.send(crest.buffer);
  } catch (error) {
    console.error(`[crest] lookup failed for "${name}": ${error.message}`);
    res.status(502).json({ error: error.message });
  }
});

function dateBounds(date) {
  return {
    from: `${date}T00:00:00Z`,
    to: `${date}T23:59:59Z`,
  };
}

function pruneStaleCacheEntries() {
  const cutoff = Date.now() - CACHE_ENTRY_MAX_AGE_MS;
  for (const dateKey of matchesCache.keys()) {
    if (new Date(`${dateKey}T00:00:00Z`).getTime() < cutoff) {
      matchesCache.delete(dateKey);
    }
  }
}

app.get('/api/football/matches', async (req, res) => {
  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'ODDS_API_KEY is missing' });
    return;
  }

  try {
    pruneStaleCacheEntries();
    const date = req.query.date || new Date().toISOString().slice(0, 10);
    const cached = matchesCache.get(date);
    if (cached && cached.expiresAt > Date.now() && cached.value.matches.length > 0) {
      res.json(cached.value);
      return;
    }

    const bounds = dateBounds(date);
    const results = await Promise.all(LEAGUES.map(async (league) => {
      try {
        const query = `?commenceTimeFrom=${encodeURIComponent(bounds.from)}&commenceTimeTo=${encodeURIComponent(bounds.to)}`;
        const events = await apiRequest(`/sports/${league.key}/events${query}`, apiKey);
        return events.map((event) => normalizeMatch(event, league));
      } catch {
        return [];
      }
    }));
    const value = {
      matches: results.flat().sort((a, b) => new Date(a.kickoff) - new Date(b.kickoff)),
      leagues: LEAGUES.map(({ key, ...league }) => ({ id: key, ...league })),
    };
    matchesCache.set(date, { value, expiresAt: Date.now() + MATCH_CACHE_MS });
    res.json(value);
  } catch (error) {
    res.status(502).json({ error: error.message });
  }
});

function parseBoolean(value) {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return null;
}

async function saveUploadedFile(clientId, filename, file) {
  if (!file) return null;
  const dir = path.join(VIDEO_DIR, clientId);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, filename), file.buffer);
  return `/videos/${clientId}/${filename}`;
}

app.post('/api/archive', upload.fields([{ name: 'video', maxCount: 1 }, { name: 'overview', maxCount: 1 }]), async (req, res) => {
  const { clientId, title, handle, disclaimer, postedDate } = req.body;
  if (!clientId) {
    res.status(400).json({ error: 'clientId is required' });
    return;
  }

  try {
    const videoUrl = await saveUploadedFile(clientId, 'video.webm', req.files?.video?.[0]);
    const overviewImageUrl = await saveUploadedFile(clientId, 'overview.png', req.files?.overview?.[0]);
    const posted = parseBoolean(req.body.posted) ?? false;
    const result = parseBoolean(req.body.result);
    const picks = JSON.parse(req.body.picks || '[]');

    const { rows } = await pool.query(
      `insert into posted_videos (client_id, title, handle, disclaimer, video_url, overview_image_url, posted, posted_date, result, updated_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, now())
       on conflict (client_id) do update set
         title = excluded.title,
         handle = excluded.handle,
         disclaimer = excluded.disclaimer,
         video_url = coalesce(excluded.video_url, posted_videos.video_url),
         overview_image_url = coalesce(excluded.overview_image_url, posted_videos.overview_image_url),
         posted = excluded.posted,
         posted_date = excluded.posted_date,
         result = excluded.result,
         updated_at = now()
       returning *`,
      [clientId, title || null, handle || null, disclaimer || null, videoUrl, overviewImageUrl, posted, postedDate || null, result]
    );
    const video = rows[0];

    await pool.query('delete from video_picks where video_id = $1', [video.id]);
    if (Array.isArray(picks) && picks.length > 0) {
      const values = [];
      const params = [];
      picks.forEach((pick, index) => {
        const offset = params.length;
        values.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5})`);
        params.push(video.id, pick.match, pick.pick, pick.odds, index);
      });
      await pool.query(`insert into video_picks (video_id, match, pick, odds, position) values ${values.join(', ')}`, params);
    }

    res.json(video);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/archive/:clientId', async (req, res) => {
  const { clientId } = req.params;
  try {
    const { rows } = await pool.query('select id from posted_videos where client_id = $1', [clientId]);
    const video = rows[0];
    if (video) {
      await pool.query('delete from video_picks where video_id = $1', [video.id]);
      await pool.query('delete from posted_videos where id = $1', [video.id]);
    }
    await fs.rm(path.join(VIDEO_DIR, clientId), { recursive: true, force: true });
    res.status(204).end();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.use('/videos', express.static(VIDEO_DIR));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Soccer Picks API listening on port ${PORT}`);
});
