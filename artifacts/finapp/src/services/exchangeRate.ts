const CACHE_KEY = 'finapp_rates_cache';
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

interface RateCache {
  base: string;
  rates: Record<string, number>;
  timestamp: number;
}

export async function getExchangeRate(from: string, to: string): Promise<number> {
  if (from === to) return 1;

  const cached = getFromCache(from);
  if (cached) {
    return cached.rates[to] ?? 1;
  }

  try {
    const res = await fetch(`https://api.exchangerate-api.com/v4/latest/${from}`);
    if (!res.ok) throw new Error('Rate fetch failed');
    const data = await res.json();
    saveToCache(from, data.rates);
    return data.rates[to] ?? 1;
  } catch {
    return 1;
  }
}

function getFromCache(base: string): RateCache | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY + '_' + base);
    if (!raw) return null;
    const cache: RateCache = JSON.parse(raw);
    if (Date.now() - cache.timestamp > CACHE_TTL) return null;
    return cache;
  } catch {
    return null;
  }
}

function saveToCache(base: string, rates: Record<string, number>) {
  const cache: RateCache = { base, rates, timestamp: Date.now() };
  localStorage.setItem(CACHE_KEY + '_' + base, JSON.stringify(cache));
}
