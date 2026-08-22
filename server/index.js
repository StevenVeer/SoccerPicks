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
  { key: 'soccer_epl', name: 'Premier League', country: 'England' },
  { key: 'soccer_spain_la_liga', name: 'La Liga', country: 'Spain' },
  { key: 'soccer_italy_serie_a', name: 'Serie A', country: 'Italy' },
  { key: 'soccer_germany_bundesliga', name: 'Bundesliga', country: 'Germany' },
  { key: 'soccer_france_ligue_one', name: 'Ligue 1', country: 'France' },
  { key: 'soccer_netherlands_eredivisie', name: 'Eredivisie', country: 'Netherlands' },
  { key: 'soccer_sweden_allsvenskan', name: 'Allsvenskan', country: 'Sweden' },
  { key: 'soccer_norway_eliteserien', name: 'Eliteserien', country: 'Norway' },
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
  };
}

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
    const results = [];
    for (const league of LEAGUES) {
      try {
        const query = `?commenceTimeFrom=${encodeURIComponent(bounds.from)}&commenceTimeTo=${encodeURIComponent(bounds.to)}`;
        const events = await apiRequest(`/sports/${league.key}/events${query}`, apiKey);
        results.push(events.map((event) => normalizeMatch(event, league)));
      } catch {
        results.push([]);
      }
    }
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

app.use('/videos', express.static(VIDEO_DIR));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Soccer Picks API listening on port ${PORT}`);
});
