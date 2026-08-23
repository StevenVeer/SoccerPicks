// Team crest images, fetched from our own server (which proxies TheSportsDB)
// and cached in memory so repeated lookups for the same team are free and so
// the canvas can draw them synchronously once loaded.
const cache = new Map(); // teamName -> HTMLImageElement | null
const pending = new Map(); // teamName -> Promise<HTMLImageElement | null>

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Could not load crest: ${url}`));
    img.src = url;
  });
}

// Picks store the match as a single "Home - Away" string; split it back out.
export function splitMatchTeams(match) {
  const [home, ...rest] = (match || '').split(' - ');
  const away = rest.join(' - ').trim();
  return away ? [home.trim(), away] : [(home || '').trim(), ''];
}

// Synchronous lookup for use inside canvas draw calls: undefined = not
// requested yet, null = requested but no crest found, Image = ready to draw.
export function getCachedCrest(teamName) {
  return cache.get((teamName || '').trim());
}

export function loadCrest(teamName) {
  const key = (teamName || '').trim();
  if (!key) return Promise.resolve(null);
  if (cache.has(key)) return Promise.resolve(cache.get(key));
  if (pending.has(key)) return pending.get(key);

  const promise = loadImage(`/api/teams/crest?name=${encodeURIComponent(key)}`)
    .then((img) => {
      cache.set(key, img);
      return img;
    })
    .catch((err) => {
      console.warn(`[teamCrests] no crest for "${key}": ${err.message}`);
      cache.set(key, null);
      return null;
    })
    .finally(() => pending.delete(key));

  pending.set(key, promise);
  return promise;
}

// Kicks off (and resolves once done with) loading every team crest referenced
// by a project's picks, so drawPickRow's synchronous cache reads succeed.
export function preloadCrestsForPicks(picks) {
  const names = new Set();
  (picks || []).forEach((pick) => {
    const [home, away] = splitMatchTeams(pick.match);
    if (home) names.add(home);
    if (away) names.add(away);
  });
  return Promise.all([...names].map(loadCrest));
}
