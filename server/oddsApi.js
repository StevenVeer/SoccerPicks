import { loadEnv } from 'vite';

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

async function apiRequest(path, apiKey) {
  const separator = path.includes('?') ? '&' : '?';
  const response = await fetch(`https://api.the-odds-api.com/v4${path}${separator}apiKey=${encodeURIComponent(apiKey)}`);
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

export function oddsApiPlugin() {
  return {
    name: 'soccer-picks-odds-api',
    configureServer(server) {
      server.middlewares.use('/api/football', async (request, response) => {
        const env = loadEnv(server.config.mode, process.cwd(), '');
        const apiKey = env.THE_ODDS_API_KEY;
        response.setHeader('Content-Type', 'application/json');
        if (!apiKey) {
          response.statusCode = 500;
          response.end(JSON.stringify({ error: 'THE_ODDS_API_KEY is missing from .env' }));
          return;
        }

        const url = new URL(request.url, 'http://localhost');
        try {
          if (url.pathname === '/matches') {
            pruneStaleCacheEntries();
            const date = url.searchParams.get('date') || new Date().toISOString().slice(0, 10);
            const cached = matchesCache.get(date);
            if (cached && cached.expiresAt > Date.now() && cached.value.matches.length > 0) {
              response.end(JSON.stringify(cached.value));
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
            response.end(JSON.stringify(value));
            return;
          }

          response.statusCode = 404;
          response.end(JSON.stringify({ error: 'Unknown API route' }));
        } catch (error) {
          response.statusCode = 502;
          response.end(JSON.stringify({ error: error.message }));
        }
      });
    },
  };
}
