/**
 * Dynamic Context-Aware Online Media & Caching Service for CM 01/02 — Season 2026/27.
 *
 * Priority Live-Fetching Waterfall (100% CORS-safe):
 *  1. In-memory LRU map (<1ms)
 *     -> Browser IndexedDB (`cm0102_media_cache`) storing BOTH resolved URL metadata AND Blob (<16ms)
 *     -> Local disk cache via Vite middleware `GET /api/bg-cache?slug=<slug>`
 *  2. TheSportsDB API (free v1/json/3: searchteams, searchplayers, search_all_leagues)
 *  3. Wikipedia REST PageImages + generator=search fallback (origin=*)
 *  4. Curated deterministic high-res Unsplash Football/Stadium fallback
 *     + procedural dark floodlit stadium SVG (`buildFallbackSvgDataUrl`) when offline
 */

import type { BackgroundContext, MediaSource, ResolvedMedia } from '../types/game';
import type { BackgroundServiceModule } from '../types/contracts';

export interface ResolvedMediaResult extends ResolvedMedia {
  cached: boolean;
  label: string;
}

interface MemoryCacheEntry {
  media: ResolvedMediaResult;
  isBlobUrl: boolean;
  expiresAt: number;
}

interface IndexedDbMediaRecord {
  slug: string;
  remoteUrl: string;
  source: MediaSource;
  attribution?: string;
  title?: string;
  label?: string;
  blob?: Blob;
  updatedAt: number;
  ttlMs: number;
}

const IDB_NAME = 'cm0102_media_cache';
const IDB_VERSION = 1;
const IDB_STORE = 'media';

const MAX_MEMORY_ENTRIES = 85;
const MEMORY_FALLBACK_TTL_MS = 60_000;
const MEMORY_LIVE_TTL_MS = 30 * 60_000;
const IDB_LIVE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const IDB_UNSPLASH_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

const DISK_CACHE_TIMEOUT_MS = 900;
const API_TIMEOUT_MS = 4200;

/**
 * Curated live-verified (HTTP 200) high-resolution Unsplash football photography (CORS-friendly CDN).
 * Selected deterministically by slug hash when live APIs miss or rate-limit.
 */
const STADIUM_UNSPLASH_URLS: readonly string[] = [
  'https://images.unsplash.com/photo-1522778119026-d647f0596c20?auto=format&fit=crop&w=1920&q=80',
  'https://images.unsplash.com/photo-1489944440615-453fc2b6a9a9?auto=format&fit=crop&w=1920&q=80',
  'https://images.unsplash.com/photo-1577223625816-7546f13df25d?auto=format&fit=crop&w=1920&q=80',
  'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?auto=format&fit=crop&w=1920&q=80',
  'https://images.unsplash.com/photo-1518091043644-c1d4457512c6?auto=format&fit=crop&w=1920&q=80',
  'https://images.unsplash.com/photo-1459865264687-595d652de67e?auto=format&fit=crop&w=1920&q=80',
  'https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=1920&q=80',
  'https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?auto=format&fit=crop&w=1920&q=80',
  'https://images.unsplash.com/photo-1556056504-5c7696c4c28d?auto=format&fit=crop&w=1920&q=80',
];

const LEAGUE_UNSPLASH_URLS: readonly string[] = [
  'https://images.unsplash.com/photo-1522778119026-d647f0596c20?auto=format&fit=crop&w=1920&q=80',
  'https://images.unsplash.com/photo-1577223625816-7546f13df25d?auto=format&fit=crop&w=1920&q=80',
  'https://images.unsplash.com/photo-1489944440615-453fc2b6a9a9?auto=format&fit=crop&w=1920&q=80',
  'https://images.unsplash.com/photo-1518091043644-c1d4457512c6?auto=format&fit=crop&w=1920&q=80',
];

const THESPORTSDB_API_BASE = 'https://www.thesportsdb.com/api/v1/json/123';

/** Exact TheSportsDB league IDs for all 18 playable leagues + UEFA Champions League */
const LEAGUE_SPORTSDB_IDS: Record<string, string> = {
  'premier-league': '4328',
  'efl-championship': '4329',
  'la-liga': '4335',
  'segunda-division': '4400',
  'serie-a': '4332',
  'serie-b': '4394',
  bundesliga: '4331',
  '2-bundesliga': '4399',
  'ligue-1': '4334',
  prvaliga: '4691',
  '2-snl': '4692',
  eredivisie: '4337',
  'primeira-liga': '4344',
  'scottish-premiership': '4330',
  'belgian-pro-league': '4338',
  'supersport-hnl': '4629',
  'austrian-bundesliga': '4621',
  'super-lig': '4339',
  'champions-league': '4480',
};

const TRAINING_UNSPLASH_URLS: readonly string[] = [
  'https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=1920&q=80',
  'https://images.unsplash.com/photo-1517466787929-bc90951d0974?auto=format&fit=crop&w=1920&q=80',
  'https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?auto=format&fit=crop&w=1920&q=80',
];

const PLAYER_UNSPLASH_URLS: readonly string[] = [
  'https://images.unsplash.com/photo-1517466787929-bc90951d0974?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1551958219-acbc608c6377?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1560272564-c83b66b1ad12?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?auto=format&fit=crop&w=1200&q=80',
];

const memoryLru = new Map<string, MemoryCacheEntry>();
const inFlightRequests = new Map<string, Promise<ResolvedMediaResult>>();
let cachedDbPromise: Promise<IDBDatabase | null> | null = null;
const isLocalHost =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname === '[::1]');
let diskCacheAvailable: boolean | null = isLocalHost ? null : false;

/* ============================================================================
 * HELPERS
 * ============================================================================ */

function sanitizeSlug(raw: string): string {
  const cleaned = raw
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 110);
  return cleaned || 'default-stadium';
}

function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function nowMs(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

function elapsedMs(start: number): number {
  return Math.max(0.1, Math.round((nowMs() - start) * 10) / 10);
}

function isOnline(): boolean {
  if (typeof navigator === 'undefined') return true;
  return navigator.onLine !== false;
}

function normalizeRemoteUrl(url?: string | null): string | null {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('//')) return `https:${trimmed}`;
  if (trimmed.startsWith('http://')) return `https://${trimmed.slice(7)}`;
  if (trimmed.startsWith('https://')) return trimmed;
  return null;
}

function cleanQueryPhrase(raw: string): string {
  const collapsed = raw.replace(/\s+/g, ' ').trim();
  // Remove redundant duplicate suffix like "Emirates Stadium stadium" or "Stadion Stožice stadium"
  if (/\b(stadium|stadion|arena|park|ground|field|dome|estadio|estádio|stade|stadio)\b/i.test(collapsed)) {
    return collapsed.replace(/\s+(stadium|pitch)$/i, '').trim();
  }
  return collapsed;
}

function deriveClubSearchNames(ctx: BackgroundContext): string[] {
  const names: string[] = [];
  const pushUnique = (val?: string) => {
    if (!val) return;
    const cleaned = val
      .replace(/\s+(Tactics|Finances|Manager Inbox|Training Ground)$/i, '')
      .replace(/\s+(football\s+)?stadium$/i, '')
      .trim();
    if (cleaned.length >= 2 && !names.some((n) => n.toLowerCase() === cleaned.toLowerCase())) {
      names.push(cleaned);
    }
  };

  if (ctx.clubName) {
    pushUnique(ctx.clubName);
  }

  if (ctx.kind === 'match' && ctx.title.includes(' vs ')) {
    pushUnique(ctx.title.split(' vs ')[0]);
    const fromSlug = ctx.slug.replace(/^match-/, '').replace(/-/g, ' ');
    pushUnique(fromSlug);
  } else {
    pushUnique(ctx.title);
    if (ctx.slug.startsWith('club-') || ctx.slug.startsWith('tactics-')) {
      pushUnique(ctx.slug.replace(/^(club|tactics)-/, '').replace(/-/g, ' '));
    }
  }

  for (const q of ctx.fallbackQueries ?? []) {
    if (/stadium/i.test(q) && !/european|modern|football stadium|soccer/i.test(q)) {
      pushUnique(q);
    }
  }

  return names.slice(0, 3);
}

function deriveLabel(ctx: BackgroundContext): string {
  if (ctx.kind === 'player') {
    return ctx.title || 'Player Portrait';
  }
  if (ctx.subtitle && ctx.subtitle.trim()) {
    return ctx.subtitle.trim();
  }
  return ctx.title || 'Stadium';
}

function isUsableWikimediaImage(
  src: string,
  width?: number,
  height?: number,
  isPlayer = false
): boolean {
  const lower = src.toLowerCase();
  if (lower.endsWith('.svg') || lower.includes('.svg/')) return false;
  const blockedPatterns = [
    'flag_of_',
    'locator_map',
    'location_map',
    'blank_',
    'commons-logo',
    'wikipedia-logo',
    'question_book',
    'edit-clear',
    'kit_body',
    'kit_left_arm',
    'kit_shorts',
    'soccerball',
    'red_pog',
    'coat_of_arms',
    'emblem_of_',
    'map_of_',
    'icon_',
    'logo',
    'crest',
    'badge',
    'shield',
  ];
  for (const pat of blockedPatterns) {
    if (lower.includes(pat)) return false;
  }

  if (typeof width === 'number' && typeof height === 'number') {
    if (isPlayer) {
      if (width < 180 || height < 180) return false;
    } else {
      if (width < 360 || height < 200) return false;
      // Avoid very tall portrait images for full-bleed stadium/league backgrounds
      if (height > width * 1.15) return false;
    }
  }

  return true;
}

async function fetchWithTimeout(
  url: string,
  timeoutMs: number,
  init?: RequestInit
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

/* ============================================================================
 * MEMORY LRU CACHE
 * ============================================================================ */

function getFromMemory(slug: string): ResolvedMediaResult | null {
  const entry = memoryLru.get(slug);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    memoryLru.delete(slug);
    if (entry.isBlobUrl) {
      scheduleBlobRevoke(entry.media.url);
    }
    return null;
  }
  // LRU promote to MRU
  memoryLru.delete(slug);
  memoryLru.set(slug, entry);
  return entry.media;
}

function setInMemory(
  slug: string,
  media: ResolvedMediaResult,
  isBlobUrl: boolean,
  ttlMs: number
): void {
  const existing = memoryLru.get(slug);
  if (existing && existing.isBlobUrl && existing.media.url !== media.url) {
    scheduleBlobRevoke(existing.media.url);
  }
  memoryLru.delete(slug);
  memoryLru.set(slug, {
    media,
    isBlobUrl,
    expiresAt: Date.now() + ttlMs,
  });

  while (memoryLru.size > MAX_MEMORY_ENTRIES) {
    const oldestKey = memoryLru.keys().next().value;
    if (!oldestKey) break;
    const evicted = memoryLru.get(oldestKey);
    memoryLru.delete(oldestKey);
    if (evicted?.isBlobUrl) {
      scheduleBlobRevoke(evicted.media.url);
    }
  }
}

function scheduleBlobRevoke(url: string): void {
  if (!url.startsWith('blob:') || typeof URL === 'undefined' || typeof URL.revokeObjectURL !== 'function') {
    return;
  }
  if (typeof window !== 'undefined') {
    window.setTimeout(() => {
      try {
        URL.revokeObjectURL(url);
      } catch {
        // ignore
      }
    }, 10_000);
  }
}

/* ============================================================================
 * INDEXEDDB PERSISTENT MEDIA CACHE (`cm0102_media_cache`)
 * ============================================================================ */

function openMediaDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') {
    return Promise.resolve(null);
  }
  if (cachedDbPromise) return cachedDbPromise;

  cachedDbPromise = new Promise<IDBDatabase | null>((resolve) => {
    try {
      const req = indexedDB.open(IDB_NAME, IDB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE, { keyPath: 'slug' });
        }
      };
      req.onsuccess = () => {
        const db = req.result;
        db.onclose = () => {
          cachedDbPromise = null;
        };
        resolve(db);
      };
      req.onerror = () => {
        cachedDbPromise = null;
        resolve(null);
      };
    } catch {
      cachedDbPromise = null;
      resolve(null);
    }
  });

  return cachedDbPromise;
}

async function readFromIndexedDb(slug: string): Promise<IndexedDbMediaRecord | null> {
  const db = await openMediaDb();
  if (!db) return null;

  return new Promise<IndexedDbMediaRecord | null>((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).get(slug);
      req.onsuccess = () => {
        const rec = req.result as IndexedDbMediaRecord | undefined;
        if (!rec) {
          resolve(null);
          return;
        }
        if (Date.now() - rec.updatedAt > (rec.ttlMs || IDB_LIVE_TTL_MS)) {
          resolve(null);
          return;
        }
        resolve(rec);
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function writeToIndexedDb(record: IndexedDbMediaRecord): Promise<void> {
  const db = await openMediaDb();
  if (!db) return;

  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

async function clearIndexedDb(): Promise<void> {
  const db = await openMediaDb();
  if (!db) return;

  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

/* ============================================================================
 * LOCAL DISK CACHE MIDDLEWARE (`/api/bg-cache`)
 * ============================================================================ */

async function readFromDiskCache(
  slug: string,
  ctx: BackgroundContext,
  startTime: number
): Promise<ResolvedMediaResult | null> {
  if (diskCacheAvailable === false) return null;

  try {
    const res = await fetchWithTimeout(
      `/api/bg-cache?slug=${encodeURIComponent(slug)}`,
      DISK_CACHE_TIMEOUT_MS
    );

    if (res.status === 404) {
      diskCacheAvailable = true;
      return null;
    }

    const contentType = (res.headers.get('content-type') || '').toLowerCase();
    if (!res.ok || !contentType.startsWith('image/')) {
      return null;
    }

    diskCacheAvailable = true;
    const blob = await res.blob();
    if (blob.size < 256) return null;

    const rawAttribution = res.headers.get('x-bg-attribution');
    const rawSourceUrl = res.headers.get('x-bg-source-url');
    const attribution = rawAttribution ? safeDecodeHeader(rawAttribution) : 'Local Disk Cache';
    const sourceUrl = rawSourceUrl
      ? safeDecodeHeader(rawSourceUrl)
      : `/api/bg-cache?slug=${encodeURIComponent(slug)}`;

    const blobUrl = URL.createObjectURL(blob);
    const label = deriveLabel(ctx);

    const media: ResolvedMediaResult = {
      slug,
      url: blobUrl,
      source: 'disk-cache',
      latencyMs: elapsedMs(startTime),
      attribution,
      title: ctx.title,
      cached: true,
      label,
    };

    setInMemory(slug, media, true, MEMORY_LIVE_TTL_MS);

    // Mirror blob into IndexedDB asynchronously for sub-2ms repeat loads
    void writeToIndexedDb({
      slug,
      remoteUrl: sourceUrl,
      source: 'disk-cache',
      attribution,
      title: ctx.title,
      label,
      blob,
      updatedAt: Date.now(),
      ttlMs: IDB_LIVE_TTL_MS,
    });

    return media;
  } catch {
    return null;
  }
}

function safeDecodeHeader(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * Fire-and-forget persistence of a newly resolved remote URL into BOTH:
 *  1. IndexedDB metadata immediately (and Blob once downloaded)
 *  2. Local disk cache via `POST /api/bg-cache` (which also bypasses CORS to produce a same-origin Blob!)
 */
function persistMediaAsync(
  slug: string,
  remoteUrl: string,
  source: MediaSource,
  attribution: string,
  title: string,
  label: string
): void {
  const ttlMs = source === 'unsplash' ? IDB_UNSPLASH_TTL_MS : IDB_LIVE_TTL_MS;

  // Step 1: Persist URL metadata into IndexedDB right away
  void writeToIndexedDb({
    slug,
    remoteUrl,
    source,
    attribution,
    title,
    label,
    updatedAt: Date.now(),
    ttlMs,
  });

  // Step 2: Persist to local disk `/cache/backgrounds/` & hydrate Blob into IndexedDB
  void (async () => {
    let hydratedBlob: Blob | null = null;

    // 2A. Try Vite disk-cache middleware first (server-side fetch avoids any CORS restriction)
    if (diskCacheAvailable !== false) {
      try {
        const postRes = await fetchWithTimeout('/api/bg-cache', 11_000, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            slug,
            remoteUrl,
            attribution,
            sourceUrl: remoteUrl,
          }),
        });
        if (postRes.ok) {
          diskCacheAvailable = true;
          const payload = (await postRes.json()) as { ok?: boolean; localUrl?: string };
          if (payload.ok && payload.localUrl) {
            const localRes = await fetchWithTimeout(payload.localUrl, 4000);
            if (localRes.ok && (localRes.headers.get('content-type') || '').startsWith('image/')) {
              const b = await localRes.blob();
              if (b.size > 256) hydratedBlob = b;
            }
          }
        }
      } catch {
        // Static build or dev server not reachable; fall back to direct CORS blob fetch
      }
    }

    // 2B. Direct CORS blob fetch if disk cache did not supply a blob
    if (!hydratedBlob) {
      try {
        const imgRes = await fetchWithTimeout(remoteUrl, 6000, { mode: 'cors' });
        if (imgRes.ok && (imgRes.headers.get('content-type') || '').startsWith('image/')) {
          const b = await imgRes.blob();
          if (b.size > 256) hydratedBlob = b;
        }
      } catch {
        // Remote host restricts CORS fetch; metadata URL is still safely cached in IndexedDB!
      }
    }

    if (hydratedBlob) {
      await writeToIndexedDb({
        slug,
        remoteUrl,
        source,
        attribution,
        title,
        label,
        blob: hydratedBlob,
        updatedAt: Date.now(),
        ttlMs,
      });
    }
  })();
}

/* ============================================================================
 * LIVE PROVIDER 1: TheSportsDB (v1/json/123)
 * ============================================================================ */

interface SportsDbResult {
  url: string;
  attribution: string;
}

async function fetchJsonSafe<T>(url: string, timeoutMs: number): Promise<T | null> {
  const res = await fetchWithTimeout(url, timeoutMs);
  if (!res.ok) return null;
  const contentType = (res.headers.get('content-type') || '').toLowerCase();
  if (!contentType.includes('json')) return null;
  return (await res.json()) as T;
}

async function fetchFromTheSportsDb(ctx: BackgroundContext): Promise<SportsDbResult | null> {
  if (!isOnline()) return null;

  try {
    if (ctx.kind === 'player') {
      const playerName = (ctx.playerName || ctx.title || ctx.primaryQuery)
        .replace(/\s+footballer$/i, '')
        .trim();
      if (!playerName) return null;

      const data = await fetchJsonSafe<{
        player?: Array<{
          strPlayer?: string;
          strSport?: string;
          strTeam?: string;
          strCutout?: string | null;
          strRender?: string | null;
          strThumb?: string | null;
          strFanart1?: string | null;
        }> | null;
      }>(`${THESPORTSDB_API_BASE}/searchplayers.php?p=${encodeURIComponent(playerName)}`, API_TIMEOUT_MS);
      if (!data) return null;

      const candidates = (data.player ?? []).filter(
        (p) => !p.strSport || p.strSport.toLowerCase() === 'soccer'
      );
      if (candidates.length === 0) return null;

      const targetLower = playerName.toLowerCase();
      const clubLower = (ctx.clubName || ctx.subtitle || '').toLowerCase();

      let best = candidates[0];
      let bestScore = -1;
      for (const p of candidates) {
        let score = 0;
        const pName = (p.strPlayer || '').toLowerCase();
        if (pName === targetLower) score += 10;
        else if (pName.includes(targetLower) || targetLower.includes(pName)) score += 5;
        if (clubLower && (p.strTeam || '').toLowerCase().includes(clubLower)) score += 6;
        if (p.strCutout) score += 4;
        if (p.strThumb) score += 3;
        if (p.strRender) score += 2;
        if (score > bestScore) {
          bestScore = score;
          best = p;
        }
      }

      const rawUrl = best.strCutout || best.strRender || best.strThumb || best.strFanart1;
      const url = normalizeRemoteUrl(rawUrl);
      if (url) {
        return {
          url,
          attribution: `TheSportsDB · ${best.strPlayer || playerName}`,
        };
      }
      return null;
    }

    if (ctx.kind === 'league' || ctx.kind === 'competition') {
      // 1. Direct league ID lookup (returns official strFanart1 / strBanner / strTrophy reliably)
      const slugLeagueKey = ctx.slug.replace(/^(league|competition)-/, '');
      const knownLeagueId = LEAGUE_SPORTSDB_IDS[slugLeagueKey];
      if (knownLeagueId) {
        const lookupData = await fetchJsonSafe<{
          leagues?: Array<{
            strLeague?: string;
            strFanart1?: string | null;
            strFanart2?: string | null;
            strFanart3?: string | null;
            strBanner?: string | null;
            strTrophy?: string | null;
            strPoster?: string | null;
          }> | null;
        }>(`${THESPORTSDB_API_BASE}/lookupleague.php?id=${encodeURIComponent(knownLeagueId)}`, API_TIMEOUT_MS);

        const lg = lookupData?.leagues?.[0];
        if (lg) {
          const rawUrl =
            lg.strFanart1 ||
            lg.strFanart2 ||
            lg.strFanart3 ||
            lg.strBanner ||
            lg.strTrophy ||
            lg.strPoster;
          const url = normalizeRemoteUrl(rawUrl);
          if (url) {
            return {
              url,
              attribution: `TheSportsDB · ${lg.strLeague || ctx.title}`,
            };
          }
        }
      }

      // 2. Fallback: search_all_leagues by country
      const country = (ctx.subtitle || '').trim();
      if (!country) return null;

      const data = await fetchJsonSafe<{
        countries?: Array<{
          strLeague?: string;
          strLeagueAlternate?: string;
          strFanart1?: string | null;
          strFanart2?: string | null;
          strTrophy?: string | null;
          strBanner?: string | null;
          strPoster?: string | null;
        }> | null;
      }>(
        `${THESPORTSDB_API_BASE}/search_all_leagues.php?s=Soccer&c=${encodeURIComponent(country)}`,
        API_TIMEOUT_MS
      );
      if (!data) return null;

      const leagues = data.countries ?? [];
      if (leagues.length === 0) return null;

      const target = ctx.title.toLowerCase();
      const matched = leagues.find((lg) => {
        const name = (lg.strLeague || '').toLowerCase();
        const alt = (lg.strLeagueAlternate || '').toLowerCase();
        return (
          name === target ||
          name.includes(target) ||
          target.includes(name) ||
          alt.includes(target)
        );
      });

      if (matched) {
        const rawUrl =
          matched.strFanart1 ||
          matched.strFanart2 ||
          matched.strBanner ||
          matched.strTrophy ||
          matched.strPoster;
        const url = normalizeRemoteUrl(rawUrl);
        if (url) {
          return {
            url,
            attribution: `TheSportsDB · ${matched.strLeague || ctx.title}`,
          };
        }
      }
      return null;
    }

    // Club / Match / Tactics / Finances / News / Home -> team stadium thumbnail / fanart
    if (
      ctx.kind === 'club' ||
      ctx.kind === 'match' ||
      ctx.kind === 'tactics' ||
      ctx.kind === 'finances' ||
      ctx.kind === 'news' ||
      ctx.kind === 'home'
    ) {
      const clubQueries = deriveClubSearchNames(ctx);
      const stadiumHint = (ctx.subtitle || '').toLowerCase();

      for (const teamQuery of clubQueries) {
        const data = await fetchJsonSafe<{
          teams?: Array<{
            strTeam?: string;
            strSport?: string;
            strStadium?: string;
            strStadiumThumb?: string | null;
            strFanart1?: string | null;
            strFanart2?: string | null;
            strFanart3?: string | null;
            strFanart4?: string | null;
            strBanner?: string | null;
          }> | null;
        }>(`${THESPORTSDB_API_BASE}/searchteams.php?t=${encodeURIComponent(teamQuery)}`, API_TIMEOUT_MS);
        if (!data) continue;

        const teams = (data.teams ?? []).filter(
          (t) => !t.strSport || t.strSport.toLowerCase() === 'soccer'
        );
        if (teams.length === 0) continue;

        const targetLower = teamQuery.toLowerCase();
        let best = teams[0];
        let bestScore = -1;
        for (const t of teams) {
          let score = 0;
          const tName = (t.strTeam || '').toLowerCase();
          const tStad = (t.strStadium || '').toLowerCase();
          if (tName === targetLower) score += 10;
          else if (tName.includes(targetLower) || targetLower.includes(tName)) score += 6;
          if (stadiumHint && tStad && (tStad.includes(stadiumHint) || stadiumHint.includes(tStad))) {
            score += 8;
          }
          if (t.strStadiumThumb) score += 6;
          if (t.strFanart1) score += 4;
          if (score > bestScore) {
            bestScore = score;
            best = t;
          }
        }

        const rawUrl =
          best.strStadiumThumb ||
          best.strFanart1 ||
          best.strFanart2 ||
          best.strFanart3 ||
          best.strFanart4 ||
          best.strBanner;
        const url = normalizeRemoteUrl(rawUrl);
        if (url) {
          return {
            url,
            attribution: `TheSportsDB · ${best.strStadium || best.strTeam || teamQuery}`,
          };
        }
      }
    }
  } catch {
    // Graceful waterfall fallthrough to Wikipedia
  }

  return null;
}

/* ============================================================================
 * LIVE PROVIDER 2: Wikipedia PageImages + Search API (`origin=*`)
 * ============================================================================ */

interface WikiImagePage {
  title?: string;
  index?: number;
  thumbnail?: {
    source?: string;
    width?: number;
    height?: number;
  };
  original?: {
    source?: string;
    width?: number;
    height?: number;
  };
}

interface WikiResult {
  url: string;
  attribution: string;
}

function buildWikipediaCandidates(ctx: BackgroundContext): string[] {
  const candidates: string[] = [];
  const pushUnique = (raw?: string) => {
    if (!raw) return;
    const cleaned = cleanQueryPhrase(raw);
    if (cleaned.length < 3) return;
    if (!candidates.some((c) => c.toLowerCase() === cleaned.toLowerCase())) {
      candidates.push(cleaned);
    }
  };

  if (ctx.kind === 'player') {
    pushUnique(ctx.playerName);
    pushUnique(ctx.title);
    pushUnique(ctx.searchHint);
    pushUnique(ctx.primaryQuery);
    for (const q of ctx.fallbackQueries ?? []) {
      pushUnique(q);
    }
  } else if (ctx.kind === 'league' || ctx.kind === 'competition') {
    for (const q of ctx.fallbackQueries ?? []) {
      pushUnique(q);
    }
    pushUnique(ctx.searchHint);
    pushUnique(ctx.title);
    pushUnique(ctx.primaryQuery);
  } else {
    // Prioritize exact stadium title (ctx.subtitle is e.g. "Emirates Stadium", "Stadion Stožice", "Ljudski vrt")
    if (ctx.subtitle && !/scouting|free agent/i.test(ctx.subtitle)) {
      pushUnique(ctx.subtitle);
    }
    pushUnique(ctx.searchHint);
    pushUnique(ctx.primaryQuery);
    for (const q of ctx.fallbackQueries ?? []) {
      pushUnique(q);
    }
  }

  return candidates.slice(0, 4);
}

async function fetchFromWikipedia(ctx: BackgroundContext): Promise<WikiResult | null> {
  if (!isOnline()) return null;

  const isPlayer = ctx.kind === 'player';
  const candidates = buildWikipediaCandidates(ctx);
  if (candidates.length === 0) return null;

  // Step 1: Exact PageImages batch lookup (1 fast HTTP call for up to 3 exact titles)
  try {
    const batchTitles = candidates.slice(0, 3).join('|');
    const url =
      `https://en.wikipedia.org/w/api.php?action=query&prop=pageimages` +
      `&piprop=thumbnail|original&pithumbsize=${isPlayer ? 960 : 1920}` +
      `&titles=${encodeURIComponent(batchTitles)}&redirects=1&format=json&origin=*`;

    const res = await fetchWithTimeout(url, API_TIMEOUT_MS);
    if (res.ok) {
      const data = (await res.json()) as {
        query?: { pages?: Record<string, WikiImagePage> };
      };
      const pages = Object.values(data.query?.pages ?? {});
      for (const page of pages) {
        const thumb = page.thumbnail;
        if (
          thumb?.source &&
          isUsableWikimediaImage(thumb.source, thumb.width, thumb.height, isPlayer)
        ) {
          const normalized = normalizeRemoteUrl(thumb.source);
          if (normalized) {
            return {
              url: normalized,
              attribution: `Wikimedia · ${page.title || candidates[0]}`,
            };
          }
        }
      }
    }
  } catch {
    // Fall through to generator=search
  }

  // Step 2: Wikipedia Search Generator fallback (handles accents, nicknames, club-to-stadium jumps)
  const searchQuery = isPlayer
    ? `${ctx.title} footballer`
    : candidates[0] || ctx.primaryQuery || ctx.title;

  try {
    const searchUrl =
      `https://en.wikipedia.org/w/api.php?action=query&generator=search` +
      `&gsrsearch=${encodeURIComponent(searchQuery)}&gsrlimit=6` +
      `&prop=pageimages&piprop=thumbnail&pithumbsize=${isPlayer ? 960 : 1920}` +
      `&pilicense=any&format=json&origin=*`;

    const res = await fetchWithTimeout(searchUrl, API_TIMEOUT_MS);
    if (res.ok) {
      const data = (await res.json()) as {
        query?: { pages?: Record<string, WikiImagePage> };
      };
      const pages = Object.values(data.query?.pages ?? []).sort(
        (a, b) => (a.index ?? 99) - (b.index ?? 99)
      );
      for (const page of pages) {
        const thumb = page.thumbnail;
        if (
          thumb?.source &&
          isUsableWikimediaImage(thumb.source, thumb.width, thumb.height, isPlayer)
        ) {
          const normalized = normalizeRemoteUrl(thumb.source);
          if (normalized) {
            return {
              url: normalized,
              attribution: `Wikimedia · ${page.title || searchQuery}`,
            };
          }
        }
      }
    }
  } catch {
    // Fall through to Unsplash curated fallback
  }

  return null;
}

/* ============================================================================
 * CURATED UNSPLASH FALLBACK & PROCEDURAL FLOODLIT STADIUM SVG
 * ============================================================================ */

function selectCuratedUnsplash(ctx: BackgroundContext, slug: string): { url: string; attribution: string } {
  const idx = hashString(`${ctx.kind}:${slug}:${ctx.subtitle ?? ctx.title}`);
  if (ctx.kind === 'player') {
    return {
      url: PLAYER_UNSPLASH_URLS[idx % PLAYER_UNSPLASH_URLS.length],
      attribution: 'Unsplash · Football Action',
    };
  }
  if (ctx.kind === 'training') {
    return {
      url: TRAINING_UNSPLASH_URLS[idx % TRAINING_UNSPLASH_URLS.length],
      attribution: 'Unsplash · Training Pitch',
    };
  }
  if (ctx.kind === 'league' || ctx.kind === 'competition') {
    return {
      url: LEAGUE_UNSPLASH_URLS[idx % LEAGUE_UNSPLASH_URLS.length],
      attribution: 'Unsplash · Competition Stadium',
    };
  }
  return {
    url: STADIUM_UNSPLASH_URLS[idx % STADIUM_UNSPLASH_URLS.length],
    attribution: 'Unsplash · Floodlit Stadium',
  };
}

function safeHexColor(color: string | undefined, fallback: string): string {
  if (!color) return fallback;
  const trimmed = color.trim();
  if (/^#[0-9a-fA-F]{3,8}$/.test(trimmed)) return trimmed;
  return fallback;
}

/**
 * Procedural dark floodlit stadium pitch SVG data URL (100% offline, <1ms, zero white flash).
 */
export function buildFallbackSvgDataUrl(ctx: BackgroundContext): string {
  const accent = safeHexColor(ctx?.accentColor, '#1d4ed8');
  const secondary = safeHexColor(ctx?.secondaryColor, '#ffd84d');
  const isPlayer = ctx?.kind === 'player';

  const svg = isPlayer
    ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 960" preserveAspectRatio="xMidYMid slice">
  <defs>
    <radialGradient id="spot" cx="50%" cy="28%" r="65%">
      <stop offset="0%" stop-color="${accent}" stop-opacity="0.58"/>
      <stop offset="55%" stop-color="#0b1528" stop-opacity="0.92"/>
      <stop offset="100%" stop-color="#050912" stop-opacity="1"/>
    </radialGradient>
    <linearGradient id="rim" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${secondary}" stop-opacity="0.4"/>
      <stop offset="100%" stop-color="${accent}" stop-opacity="0.1"/>
    </linearGradient>
  </defs>
  <rect width="800" height="960" fill="url(#spot)"/>
  <circle cx="400" cy="270" r="195" fill="none" stroke="url(#rim)" stroke-width="2" opacity="0.5"/>
  <circle cx="400" cy="270" r="245" fill="none" stroke="${secondary}" stroke-width="1" opacity="0.18"/>
  <path d="M400 175c48 0 84 38 84 88 0 54-36 96-84 96s-84-42-84-96c0-50 36-88 84-88z" fill="#13223b" stroke="${secondary}" stroke-opacity="0.35" stroke-width="2"/>
  <path d="M210 660c20-132 102-198 190-198s170 66 190 198l18 300H192z" fill="#0f1d34" stroke="${accent}" stroke-opacity="0.55" stroke-width="3"/>
  <path d="M350 470l50 62 50-62" fill="none" stroke="${secondary}" stroke-opacity="0.55" stroke-width="5"/>
  <rect x="0" y="830" width="800" height="130" fill="#050912" opacity="0.72"/>
</svg>`
    : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid slice">
  <defs>
    <linearGradient id="sky" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#050a14"/>
      <stop offset="52%" stop-color="#0b172b"/>
      <stop offset="100%" stop-color="#07121e"/>
    </linearGradient>
    <radialGradient id="flLeft" cx="18%" cy="16%" r="48%">
      <stop offset="0%" stop-color="#e8f3ff" stop-opacity="0.55"/>
      <stop offset="28%" stop-color="${accent}" stop-opacity="0.32"/>
      <stop offset="100%" stop-color="#050a14" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="flRight" cx="82%" cy="16%" r="48%">
      <stop offset="0%" stop-color="#fff4d6" stop-opacity="0.5"/>
      <stop offset="28%" stop-color="${secondary}" stop-opacity="0.22"/>
      <stop offset="100%" stop-color="#050a14" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="pitch" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#0d3a24"/>
      <stop offset="45%" stop-color="#114b2d"/>
      <stop offset="100%" stop-color="#092919"/>
    </linearGradient>
  </defs>
  <rect width="1920" height="1080" fill="url(#sky)"/>
  <rect width="1920" height="1080" fill="url(#flLeft)"/>
  <rect width="1920" height="1080" fill="url(#flRight)"/>
  <!-- Stadium roof & upper tiers -->
  <path d="M0 440 Q960 285 1920 440 L1920 650 L0 650 Z" fill="#091322" opacity="0.92"/>
  <path d="M0 460 Q960 320 1920 460" fill="none" stroke="${accent}" stroke-width="5" opacity="0.65"/>
  <path d="M0 535 Q960 415 1920 535" fill="none" stroke="${secondary}" stroke-width="2" opacity="0.32"/>
  <path d="M0 610 Q960 515 1920 610" fill="none" stroke="#9ab0cf" stroke-width="1.5" opacity="0.2"/>
  <!-- Twin floodlight towers -->
  <g fill="#f8fafc" opacity="0.9">
    <rect x="295" y="135" width="90" height="32" rx="4"/>
    <rect x="1535" y="135" width="90" height="32" rx="4"/>
  </g>
  <g stroke="#334b6e" stroke-width="6" opacity="0.7">
    <line x1="340" y1="167" x2="310" y2="410"/>
    <line x1="1580" y1="167" x2="1610" y2="410"/>
  </g>
  <!-- Floodlight beams -->
  <polygon points="340,167 980,740 160,740" fill="#dbeafe" opacity="0.06"/>
  <polygon points="1580,167 1760,740 940,740" fill="#fef3c7" opacity="0.05"/>
  <!-- Perspective pitch & mowed stripes -->
  <polygon points="0,635 1920,635 1920,1080 0,1080" fill="url(#pitch)"/>
  <g opacity="0.14" fill="#34d399">
    <polygon points="140,635 330,635 210,1080 -80,1080"/>
    <polygon points="520,635 710,635 670,1080 410,1080"/>
    <polygon points="900,635 1090,635 1130,1080 870,1080"/>
    <polygon points="1280,635 1470,635 1590,1080 1330,1080"/>
    <polygon points="1660,635 1850,635 2040,1080 1790,1080"/>
  </g>
  <!-- Crisp chalk pitch markings -->
  <g stroke="#e2f8ec" stroke-opacity="0.34" stroke-width="3" fill="none">
    <line x1="80" y1="670" x2="1840" y2="670"/>
    <line x1="960" y1="670" x2="960" y2="1080"/>
    <ellipse cx="960" cy="835" rx="220" ry="62"/>
    <polygon points="540,670 1380,670 1500,775 420,775"/>
  </g>
</svg>`;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/* ============================================================================
 * CORE RESOLVER
 * ============================================================================ */

async function resolveBackgroundInternal(
  ctx: BackgroundContext,
  slug: string
): Promise<ResolvedMediaResult> {
  const startTime = nowMs();
  const label = deriveLabel(ctx);

  // 1A. In-memory LRU map (<1ms)
  const memHit = getFromMemory(slug);
  if (memHit) {
    return {
      ...memHit,
      latencyMs: elapsedMs(startTime),
      cached: true,
    };
  }

  // 1B. IndexedDB (`cm0102_media_cache`) storing BOTH metadata AND Blob (<16ms)
  const idbRecord = await readFromIndexedDb(slug);
  if (idbRecord) {
    if (idbRecord.blob && idbRecord.blob.size > 256) {
      const blobUrl = URL.createObjectURL(idbRecord.blob);
      const result: ResolvedMediaResult = {
        slug,
        url: blobUrl,
        source: 'indexeddb',
        latencyMs: elapsedMs(startTime),
        attribution: idbRecord.attribution || 'IndexedDB Cache',
        title: idbRecord.title || ctx.title,
        cached: true,
        label: idbRecord.label || label,
      };
      setInMemory(slug, result, true, MEMORY_LIVE_TTL_MS);
      return result;
    }

    if (idbRecord.remoteUrl) {
      const result: ResolvedMediaResult = {
        slug,
        url: idbRecord.remoteUrl,
        source: 'indexeddb',
        latencyMs: elapsedMs(startTime),
        attribution: idbRecord.attribution || 'IndexedDB Cache',
        title: idbRecord.title || ctx.title,
        cached: true,
        label: idbRecord.label || label,
      };
      setInMemory(slug, result, false, MEMORY_LIVE_TTL_MS);
      // Opportunistically upgrade metadata entry with Blob in background
      if (isOnline() && idbRecord.remoteUrl.startsWith('https://')) {
        persistMediaAsync(
          slug,
          idbRecord.remoteUrl,
          idbRecord.source,
          result.attribution || '',
          result.title || ctx.title,
          result.label
        );
      }
      return result;
    }
  }

  // 1C. Local disk cache via Vite middleware (`GET /api/bg-cache?slug=<slug>`)
  const diskHit = await readFromDiskCache(slug, ctx, startTime);
  if (diskHit) {
    return diskHit;
  }

  // Offline fast-path: procedural floodlit stadium SVG (<1ms)
  if (!isOnline()) {
    const fallbackResult: ResolvedMediaResult = {
      slug,
      url: buildFallbackSvgDataUrl(ctx),
      source: 'fallback',
      latencyMs: elapsedMs(startTime),
      attribution: 'Procedural Floodlit Pitch (Offline)',
      title: ctx.title,
      cached: false,
      label,
    };
    setInMemory(slug, fallbackResult, false, MEMORY_FALLBACK_TTL_MS);
    return fallbackResult;
  }

  // 1D. Direct pre-hydrated URL (e.g. from hydrated_overrides.json)
  const directUrl = normalizeRemoteUrl(ctx.directImageUrl);
  if (directUrl) {
    const directSource: MediaSource = directUrl.includes('thesportsdb')
      ? 'thesportsdb'
      : directUrl.includes('wikimedia') || directUrl.includes('wikipedia')
        ? 'wikipedia'
        : 'unsplash';
    const attribution = `Pre-hydrated · ${label}`;
    const result: ResolvedMediaResult = {
      slug,
      url: directUrl,
      source: directSource,
      latencyMs: elapsedMs(startTime),
      attribution,
      title: ctx.title,
      cached: false,
      label,
    };
    setInMemory(slug, result, false, MEMORY_LIVE_TTL_MS);
    persistMediaAsync(slug, directUrl, directSource, attribution, ctx.title, label);
    return result;
  }

  // 2. TheSportsDB API
  const sportsDbHit = await fetchFromTheSportsDb(ctx);
  if (sportsDbHit) {
    const result: ResolvedMediaResult = {
      slug,
      url: sportsDbHit.url,
      source: 'thesportsdb',
      latencyMs: elapsedMs(startTime),
      attribution: sportsDbHit.attribution,
      title: ctx.title,
      cached: false,
      label,
    };
    setInMemory(slug, result, false, MEMORY_LIVE_TTL_MS);
    persistMediaAsync(slug, sportsDbHit.url, 'thesportsdb', sportsDbHit.attribution, ctx.title, label);
    return result;
  }

  // 3. Wikipedia PageImages / Wikimedia Commons API
  const wikiHit = await fetchFromWikipedia(ctx);
  if (wikiHit) {
    const result: ResolvedMediaResult = {
      slug,
      url: wikiHit.url,
      source: 'wikipedia',
      latencyMs: elapsedMs(startTime),
      attribution: wikiHit.attribution,
      title: ctx.title,
      cached: false,
      label,
    };
    setInMemory(slug, result, false, MEMORY_LIVE_TTL_MS);
    persistMediaAsync(slug, wikiHit.url, 'wikipedia', wikiHit.attribution, ctx.title, label);
    return result;
  }

  // 4. Deterministic curated Unsplash high-res football/stadium fallback
  const unsplashHit = selectCuratedUnsplash(ctx, slug);
  const unsplashResult: ResolvedMediaResult = {
    slug,
    url: unsplashHit.url,
    source: 'unsplash',
    latencyMs: elapsedMs(startTime),
    attribution: unsplashHit.attribution,
    title: ctx.title,
    cached: false,
    label,
  };
  setInMemory(slug, unsplashResult, false, MEMORY_LIVE_TTL_MS);
  persistMediaAsync(slug, unsplashHit.url, 'unsplash', unsplashHit.attribution, ctx.title, label);
  return unsplashResult;
}

/**
 * Context-aware background & portrait media resolver implementing `BackgroundServiceModule`.
 */
export async function resolveBackground(ctx: BackgroundContext): Promise<ResolvedMediaResult> {
  const inferredTitle =
    ctx.title || ctx.playerName || ctx.clubName || ctx.primaryQuery || 'Stadium';
  const inferredSubtitle =
    ctx.subtitle || (ctx.kind === 'player' ? ctx.clubName : undefined);
  const inferredPrimary =
    ctx.primaryQuery ||
    ctx.searchHint ||
    (ctx.kind === 'player' && ctx.playerName ? `${ctx.playerName} footballer` : inferredTitle);

  const safeCtx: BackgroundContext = {
    kind: ctx.kind || 'club',
    slug: ctx.slug || `${ctx.kind || 'club'}-${inferredTitle}`,
    title: inferredTitle,
    subtitle: inferredSubtitle,
    primaryQuery: inferredPrimary,
    fallbackQueries: Array.isArray(ctx.fallbackQueries) ? ctx.fallbackQueries : [],
    accentColor: ctx.accentColor || '#1d4ed8',
    secondaryColor: ctx.secondaryColor,
    directImageUrl: ctx.directImageUrl,
    playerName: ctx.playerName,
    clubName: ctx.clubName,
    searchHint: ctx.searchHint,
  };

  const slug = sanitizeSlug(safeCtx.slug);

  // Fast-path synchronous memory hit avoids promise wrapper overhead when already hot
  const hot = getFromMemory(slug);
  if (hot) {
    return { ...hot, latencyMs: 0.2, cached: true };
  }

  const existing = inFlightRequests.get(slug);
  if (existing) return existing;

  const task = resolveBackgroundInternal(safeCtx, slug)
    .catch((): ResolvedMediaResult => ({
      slug,
      url: buildFallbackSvgDataUrl(safeCtx),
      source: 'fallback',
      latencyMs: 1,
      attribution: 'Procedural Floodlit Pitch',
      title: safeCtx.title,
      cached: false,
      label: deriveLabel(safeCtx),
    }))
    .finally(() => {
      inFlightRequests.delete(slug);
    });

  inFlightRequests.set(slug, task);
  return task;
}

/**
 * Convenience helper for PlayerProfileView portrait cutouts & action shots.
 */
export function resolvePlayerPortrait(
  playerName: string,
  clubName?: string | null,
  searchHint?: string,
  directImageUrl?: string,
  accentColor = '#1d4ed8'
): Promise<ResolvedMediaResult> {
  const slug = sanitizeSlug(`player-portrait-${playerName}`);
  return resolveBackground({
    kind: 'player',
    slug,
    title: playerName,
    subtitle: clubName || 'Free Agent',
    primaryQuery: searchHint || `${playerName} footballer`,
    fallbackQueries: [playerName, clubName ? `${playerName} ${clubName}` : `${playerName} soccer`],
    accentColor,
    directImageUrl,
  });
}

/**
 * Background prefetcher with bounded concurrency and idle scheduling.
 */
export function prefetchBackgrounds(contexts: BackgroundContext[]): void {
  if (!Array.isArray(contexts) || contexts.length === 0) return;

  const unique: BackgroundContext[] = [];
  const seen = new Set<string>();
  for (const ctx of contexts) {
    const slug = sanitizeSlug(ctx.slug || ctx.title);
    if (!seen.has(slug) && !memoryLru.has(slug)) {
      seen.add(slug);
      unique.push(ctx);
    }
  }
  if (unique.length === 0) return;

  const runQueue = () => {
    let cursor = 0;
    const workers = Math.min(2, unique.length);
    const next = async (): Promise<void> => {
      while (cursor < unique.length) {
        const item = unique[cursor++];
        try {
          await resolveBackground(item);
        } catch {
          // ignore background prefetch failures
        }
      }
    };
    for (let i = 0; i < workers; i++) {
      void next();
    }
  };

  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    (window as unknown as { requestIdleCallback: (cb: () => void, opts?: { timeout: number }) => void }).requestIdleCallback(
      runQueue,
      { timeout: 1500 }
    );
  } else {
    setTimeout(runQueue, 120);
  }
}

/**
 * Clears in-memory LRU map, IndexedDB `cm0102_media_cache`, and local disk cache `/api/bg-cache`.
 */
export async function clearBackgroundCache(): Promise<void> {
  for (const entry of memoryLru.values()) {
    if (entry.isBlobUrl) {
      scheduleBlobRevoke(entry.media.url);
    }
  }
  memoryLru.clear();
  inFlightRequests.clear();

  await Promise.allSettled([
    clearIndexedDb(),
    fetchWithTimeout('/api/bg-cache', 2500, { method: 'DELETE' }).catch(() => undefined),
  ]);
}

const backgroundServiceModule: BackgroundServiceModule = {
  resolveBackground,
  prefetchBackgrounds,
  clearBackgroundCache,
  buildFallbackSvgDataUrl,
};

export default backgroundServiceModule;
