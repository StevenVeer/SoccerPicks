import { loadEnv } from 'vite';

const LEAGUES = [
  { id: 39, name: 'Premier League', country: 'England' },
  { id: 140, name: 'La Liga', country: 'Spain' },
  { id: 135, name: 'Serie A', country: 'Italy' },
  { id: 78, name: 'Bundesliga', country: 'Germany' },
  { id: 61, name: 'Ligue 1', country: 'France' },
  { id: 88, name: 'Eredivisie', country: 'Netherlands' },
  { id: 113, name: 'Allsvenskan', country: 'Sweden' },
  { id: 103, name: 'Eliteserien', country: 'Norway' },
];

const matchesCache = new Map();
const oddsCache = new Map();
const MATCH_CACHE_MS = 5 * 60 * 1000;
const ODDS_CACHE_MS = 60 * 1000;

function jsonResponse(response, status = 200) {
  return new Response(JSON.stringify(response), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function currentSeason(date) {
  return date.getUTCMonth() >= 6 ? date.getUTCFullYear() : date.getUTCFullYear() - 1;
}

async function apiRequest(path, apiKey) {
  const response = await fetch(`https://v3.football.api-sports.io${path}`, {
    headers: { 'x-apisports-key': apiKey },
  });
  const data = await response.json();
  if (!response.ok || data.errors && Object.keys(data.errors).length) {
    const providerError = Object.values(data.errors || {})[0];
    throw new Error(providerError || data.message || `API-Football returned ${response.status}`);
  }
  return data.response || [];
}

function normalizeMatch(item, league) {
  return {
    id: item.fixture.id,
    kickoff: item.fixture.date,
    status: item.fixture.status.short,
    home: item.teams.home.name,
    away: item.teams.away.name,
    homeLogo: item.teams.home.logo,
    awayLogo: item.teams.away.logo,
    leagueId: league.id,
    league: league.name,
    country: league.country,
  };
}

function normalizeOdds(response) {
  const bookmakers = response.flatMap((entry) => entry.bookmakers || []);
  const bookmaker = bookmakers[0];
  if (!bookmaker) return { bookmaker: null, markets: [] };

  const markets = bookmaker.bets
    .filter((market) => ['Match Winner', 'Goals Over/Under', 'Both Teams Score'].includes(market.name))
    .map((market) => ({
      name: market.name,
      outcomes: market.values
        .filter((outcome) => outcome.odd)
        .map((outcome) => ({ label: outcome.value, odds: Number(outcome.odd) })),
    }))
    .filter((market) => market.outcomes.length > 0);

  return { bookmaker: bookmaker.name, markets, updatedAt: new Date().toISOString() };
}

export function apiFootballPlugin() {
  return {
    name: 'soccer-picks-api-football',
    configureServer(server) {
      server.middlewares.use('/api/football', async (request, response) => {
        const env = loadEnv(server.config.mode, process.cwd(), '');
        const apiKey = env.API_FOOTBALL_KEY;
        if (!apiKey) {
          response.statusCode = 500;
          response.end(JSON.stringify({ error: 'API_FOOTBALL_KEY is missing from .env' }));
          return;
        }

        const url = new URL(request.url, 'http://localhost');
        try {
          if (url.pathname === '/matches') {
            const date = url.searchParams.get('date') || new Date().toISOString().slice(0, 10);
            const cached = matchesCache.get(date);
            if (cached && cached.expiresAt > Date.now()) {
              response.setHeader('Content-Type', 'application/json');
              response.end(JSON.stringify(cached.value));
              return;
            }

            const season = currentSeason(new Date(`${date}T12:00:00Z`));
            const results = await Promise.all(
              LEAGUES.map(async (league) => {
                const fixtures = await apiRequest(`/fixtures?league=${league.id}&season=${season}&date=${date}`, apiKey);
                return fixtures.map((fixture) => normalizeMatch(fixture, league));
              })
            );
            const value = { matches: results.flat().sort((a, b) => new Date(a.kickoff) - new Date(b.kickoff)), leagues: LEAGUES };
            matchesCache.set(date, { value, expiresAt: Date.now() + MATCH_CACHE_MS });
            response.setHeader('Content-Type', 'application/json');
            response.end(JSON.stringify(value));
            return;
          }

          if (url.pathname === '/odds') {
            const fixtureId = url.searchParams.get('fixture');
            if (!fixtureId) {
              response.end(JSON.stringify({ error: 'fixture is required' }));
              return;
            }
            const cached = oddsCache.get(fixtureId);
            if (cached && cached.expiresAt > Date.now()) {
              response.setHeader('Content-Type', 'application/json');
              response.end(JSON.stringify(cached.value));
              return;
            }
            const value = normalizeOdds(await apiRequest(`/odds?fixture=${fixtureId}`, apiKey));
            oddsCache.set(fixtureId, { value, expiresAt: Date.now() + ODDS_CACHE_MS });
            response.setHeader('Content-Type', 'application/json');
            response.end(JSON.stringify(value));
            return;
          }

          response.end(JSON.stringify({ error: 'Unknown API route' }));
        } catch (error) {
          response.statusCode = 502;
          response.setHeader('Content-Type', 'application/json');
          response.end(JSON.stringify({ error: error.message }));
        }
      });
    },
  };
}
