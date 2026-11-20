#!/usr/bin/env node
/**
 * Championship Manager 01/02 — Season 2026/27
 * Live Database Hydration & Media Enrichment Utility (Node 24 ESM, zero external deps)
 *
 * Queries:
 *  1. TheSportsDB API (free key "3") — club lookup, squad players, badges, stadium thumbs
 *  2. Wikipedia REST API / PageImages & Wikidata — high-res stadium photos & structured QIDs
 *  3. OpenFootball JSON (github.com/openfootball/football.json) — league club registry cross-check
 *
 * Usage:
 *   node scripts/hydrate_db.js --dry-run --limit 2
 *   node scripts/hydrate_db.js --league prvaliga
 *   node scripts/hydrate_db.js --club arsenal,olimpija-ljubljana
 *   node scripts/hydrate_db.js --top6 --limit 12
 *   node scripts/hydrate_db.js --all
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

const CLUBS_TS_PATH = path.join(PROJECT_ROOT, 'src', 'data', 'clubs.ts');
const LEAGUES_TS_PATH = path.join(PROJECT_ROOT, 'src', 'data', 'leagues.ts');
const OVERRIDES_JSON_PATH = path.join(PROJECT_ROOT, 'src', 'data', 'hydrated_overrides.json');

const USER_AGENT = 'CM0102-Season2627-Hydrator/1.0 (Node24; Educational Football Sim)';
const TOP6_LEAGUES = new Set([
  'premier-league',
  'la-liga',
  'serie-a',
  'bundesliga',
  'ligue-1',
  'prvaliga',
]);

const THESPORTSDB_API_KEY = process.env.THESPORTSDB_API_KEY || '123';
const THESPORTSDB_BASE = `https://www.thesportsdb.com/api/v1/json/${THESPORTSDB_API_KEY}`;

const OPENFOOTBALL_LEAGUE_CODES = {
  'premier-league': 'en.1',
  'efl-championship': 'en.2',
  'la-liga': 'es.1',
  'segunda-division': 'es.2',
  'serie-a': 'it.1',
  'serie-b': 'it.2',
  bundesliga: 'de.1',
  '2-bundesliga': 'de.2',
  'ligue-1': 'fr.1',
  eredivisie: 'nl.1',
  'primeira-liga': 'pt.1',
  'belgian-pro-league': 'be.1',
  'austrian-bundesliga': 'at.1',
  'super-lig': 'tr.1',
};

const NATIONALITY_TO_CODE = {
  england: 'ENG',
  'united kingdom': 'ENG',
  scotland: 'SCO',
  wales: 'WAL',
  'northern ireland': 'NIR',
  ireland: 'IRL',
  spain: 'ESP',
  italy: 'ITA',
  germany: 'GER',
  france: 'FRA',
  slovenia: 'SVN',
  netherlands: 'NED',
  portugal: 'POR',
  belgium: 'BEL',
  croatia: 'CRO',
  austria: 'AUT',
  turkey: 'TUR',
  brazil: 'BRA',
  argentina: 'ARG',
  serbia: 'SRB',
  'bosnia and herzegovina': 'BIH',
  'bosnia-herzegovina': 'BIH',
  nigeria: 'NGA',
  'ivory coast': 'CIV',
  "cote d'ivoire": 'CIV',
  morocco: 'MAR',
  japan: 'JPN',
  norway: 'NOR',
  denmark: 'DEN',
  sweden: 'SWE',
  poland: 'POL',
  'czech republic': 'CZE',
  czechia: 'CZE',
  switzerland: 'SUI',
  colombia: 'COL',
  uruguay: 'URU',
  'united states': 'USA',
  usa: 'USA',
  canada: 'CAN',
  mexico: 'MEX',
  'south korea': 'KOR',
  'korea republic': 'KOR',
  australia: 'AUS',
  ghana: 'GHA',
  senegal: 'SEN',
  cameroon: 'CMR',
  egypt: 'EGY',
  algeria: 'ALG',
  ukraine: 'UKR',
  greece: 'GRE',
  hungary: 'HUN',
  slovakia: 'SVK',
  romania: 'ROU',
  ecuador: 'ECU',
  chile: 'CHI',
  paraguay: 'PAR',
};

/* ============================================================================
 * CLI ARGUMENT PARSING
 * ============================================================================ */

function printUsage() {
  console.log(`
Championship Manager 01/02 (Season 2026/27) — Live DB Hydrator

Options:
  --league <id>    Filter by league id (comma-separated or repeatable)
  --club <id>      Filter by club id (comma-separated or repeatable)
  --top6           Target the 6 flagship leagues (PL, La Liga, Serie A, Bundesliga, Ligue 1, PrvaLiga)
  --all            Target all 18 leagues (~310 clubs)
  --limit <n>      Maximum number of clubs to hydrate
  --delay <ms>     Polite delay between API requests in ms (default: 260)
  --dry-run        Fetch & compute hydration without writing hydrated_overrides.json
  --help, -h       Show this help message
`);
}

function parseArgs(argv) {
  const opts = {
    leagues: [],
    clubs: [],
    top6: false,
    all: false,
    dryRun: false,
    limit: null,
    delayMs: 260,
    help: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      opts.help = true;
    } else if (arg === '--dry-run') {
      opts.dryRun = true;
    } else if (arg === '--top6') {
      opts.top6 = true;
    } else if (arg === '--all') {
      opts.all = true;
    } else if (arg === '--league' && argv[i + 1]) {
      opts.leagues.push(...argv[++i].split(',').map((s) => s.trim()).filter(Boolean));
    } else if (arg.startsWith('--league=')) {
      opts.leagues.push(...arg.slice(9).split(',').map((s) => s.trim()).filter(Boolean));
    } else if (arg === '--club' && argv[i + 1]) {
      opts.clubs.push(...argv[++i].split(',').map((s) => s.trim()).filter(Boolean));
    } else if (arg.startsWith('--club=')) {
      opts.clubs.push(...arg.slice(7).split(',').map((s) => s.trim()).filter(Boolean));
    } else if (arg === '--limit' && argv[i + 1]) {
      const n = Number.parseInt(argv[++i], 10);
      if (Number.isFinite(n) && n > 0) opts.limit = n;
    } else if (arg.startsWith('--limit=')) {
      const n = Number.parseInt(arg.slice(8), 10);
      if (Number.isFinite(n) && n > 0) opts.limit = n;
    } else if (arg === '--delay' && argv[i + 1]) {
      const n = Number.parseInt(argv[++i], 10);
      if (Number.isFinite(n) && n >= 0) opts.delayMs = n;
    }
  }

  return opts;
}

/* ============================================================================
 * ZERO-DEPENDENCY PARSERS FOR src/data/leagues.ts & src/data/clubs.ts
 * ============================================================================ */

async function loadSeedMetadata() {
  const [leaguesSrc, clubsSrc] = await Promise.all([
    fs.readFile(LEAGUES_TS_PATH, 'utf8'),
    fs.readFile(CLUBS_TS_PATH, 'utf8'),
  ]);

  // Parse league IDs, names, country, reputation, theSportsDbLeagueId
  const leagues = [];
  const leagueBlockRegex =
    /id:\s*'([^']+)'[\s\S]*?name:\s*'([^']+)'[\s\S]*?country:\s*'([^']+)'[\s\S]*?reputation:\s*(\d+)/g;
  let lm;
  while ((lm = leagueBlockRegex.exec(leaguesSrc)) !== null) {
    leagues.push({
      id: lm[1],
      name: lm[2],
      country: lm[3],
      reputation: Number.parseInt(lm[4], 10),
    });
  }

  // Parse buildLeagueClubs('league-id', 'Country', [ ... ]) blocks from clubs.ts
  const clubs = [];
  const sectionRegex =
    /buildLeagueClubs\(\s*'([^']+)'\s*,\s*'([^']+)'\s*,\s*\[([\s\S]*?)\]\s*\)/g;
  let sm;
  while ((sm = sectionRegex.exec(clubsSrc)) !== null) {
    const leagueId = sm[1];
    const country = sm[2];
    const body = sm[3];

    // Match each tuple row line (handling escaped quotes like K\'lautern or d\'Italia)
    const strToken = `(?:'((?:\\\\'|[^'])*)'|"((?:\\\\"|[^"])*)")`;
    const rowRegex = new RegExp(
      `\\[\\s*'([^']+)'\\s*,\\s*${strToken}\\s*,\\s*${strToken}\\s*,\\s*'([^']+)'\\s*,\\s*${strToken}\\s*,\\s*(\\d+)\\s*,\\s*(\\d+)\\s*,\\s*'[^']+'\\s*,\\s*'[^']+'\\s*,\\s*'[^']+'\\s*,\\s*${strToken}\\s*,\\s*(\\d+)\\s*,\\s*${strToken}`,
      'g'
    );
    const unesc = (s) => (s ? s.replace(/\\'/g, "'").replace(/\\"/g, '"') : '');
    let rm;
    while ((rm = rowRegex.exec(body)) !== null) {
      const id = rm[1];
      const name = unesc(rm[2] ?? rm[3]);
      const shortName = unesc(rm[4] ?? rm[5]);
      const code = rm[6];
      const city = unesc(rm[7] ?? rm[8]);
      const founded = Number.parseInt(rm[9], 10);
      const reputation = Number.parseInt(rm[10], 10);
      const stadiumName = unesc(rm[11] ?? rm[12]);
      const stadiumCapacity = Number.parseInt(rm[13], 10);
      const stadiumWikiQuery = unesc(rm[14] ?? rm[15]);

      clubs.push({
        id,
        name,
        shortName,
        threeLetterCode: code,
        leagueId,
        country,
        city,
        founded,
        reputation,
        stadiumName,
        stadiumCapacity,
        stadiumWikiQuery,
      });
    }
  }

  return { leagues, clubs };
}

/* ============================================================================
 * POLITE HTTP CLIENT (RETRIES, TIMEOUT, RATE LIMITING)
 * ============================================================================ */

const hostLastRequestAt = new Map();

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJsonWithRetry(url, { retries = 2, timeoutMs = 8000, delayMs = 260 } = {}) {
  const host = new URL(url).host;
  const lastAt = hostLastRequestAt.get(host) ?? 0;
  const elapsed = Date.now() - lastAt;
  if (elapsed < delayMs) {
    await sleep(delayMs - elapsed);
  }
  hostLastRequestAt.set(host, Date.now());

  let lastError = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'application/json',
        },
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (res.status === 429) {
        const backoff = (attempt + 1) * 900;
        await sleep(backoff);
        continue;
      }
      if (!res.ok) {
        return { ok: false, status: res.status, data: null, error: `HTTP ${res.status}` };
      }
      const data = await res.json();
      return { ok: true, status: res.status, data, error: null };
    } catch (err) {
      clearTimeout(timer);
      lastError = err instanceof Error ? err.message : String(err);
      if (attempt < retries) {
        await sleep((attempt + 1) * 500);
      }
    }
  }

  return { ok: false, status: 0, data: null, error: lastError ?? 'Network failure' };
}

/* ============================================================================
 * DETERMINISTIC CM 01/02 31-ATTRIBUTE MAPPER
 * ============================================================================ */

function fnv1a(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function createRng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
}

function clampAttr(v) {
  return clamp(Math.round(v), 1, 20);
}

function slugify(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function mapPositionString(rawPos) {
  const p = String(rawPos || '').toLowerCase();
  if (p.includes('goalkeeper') || p === 'gk') return ['GK'];
  if (p.includes('left-back') || p.includes('left back') || p.includes('left wing-back')) return ['DL', 'ML'];
  if (p.includes('right-back') || p.includes('right back') || p.includes('right wing-back')) return ['DR', 'MR'];
  if (p.includes('centre-back') || p.includes('center-back') || p.includes('centre back') || p.includes('center back') || p.includes('defender')) return ['DC'];
  if (p.includes('defensive mid')) return ['DMC', 'MC'];
  if (p.includes('attacking mid')) return ['AMC', 'MC'];
  if (p.includes('left wing') || p.includes('left forward')) return ['FL', 'ML'];
  if (p.includes('right wing') || p.includes('right forward')) return ['FR', 'MR'];
  if (p.includes('left mid')) return ['ML', 'FL'];
  if (p.includes('right mid')) return ['MR', 'FR'];
  if (p.includes('midfield')) return ['MC'];
  if (p.includes('striker') || p.includes('centre-forward') || p.includes('center-forward') || p.includes('forward')) return ['FC'];
  return ['MC'];
}

function computeAgeAugust2026(dateBorn) {
  if (!dateBorn || typeof dateBorn !== 'string') return 24;
  const m = dateBorn.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return 24;
  const year = Number.parseInt(m[1], 10);
  const month = Number.parseInt(m[2], 10);
  let age = 2026 - year;
  if (month > 8) age -= 1;
  return clamp(age, 16, 42);
}

function parseHeightCm(strHeight) {
  if (!strHeight) return undefined;
  const mCm = String(strHeight).match(/(\d{3})\s*cm/i);
  if (mCm) return clamp(Number.parseInt(mCm[1], 10), 158, 210);
  const mMeters = String(strHeight).match(/(1\.\d{2}|2\.\d{2})\s*m/i);
  if (mMeters) return clamp(Math.round(Number.parseFloat(mMeters[1]) * 100), 158, 210);
  return undefined;
}

function parseWeightKg(strWeight) {
  if (!strWeight) return undefined;
  const mKg = String(strWeight).match(/(\d{2,3})\s*kg/i);
  if (mKg) return clamp(Number.parseInt(mKg[1], 10), 54, 108);
  return undefined;
}

function parseMarketValueHint(strSigning) {
  if (!strSigning) return null;
  const s = String(strSigning).replace(/,/g, '');
  const m = s.match(/([0-9]+(?:\.[0-9]+)?)\s*(m|million|k)?/i);
  if (!m) return null;
  const num = Number.parseFloat(m[1]);
  if (!Number.isFinite(num) || num <= 0) return null;
  const unit = (m[2] || '').toLowerCase();
  if (unit === 'm' || unit === 'million') return Math.round(num * 1_000_000);
  if (unit === 'k') return Math.round(num * 1_000);
  if (num > 50_000) return Math.round(num);
  return null;
}

function nationalityToCode(nationality, fallbackCode = 'ENG') {
  if (!nationality) return fallbackCode;
  const norm = nationality.trim().toLowerCase();
  if (NATIONALITY_TO_CODE[norm]) return NATIONALITY_TO_CODE[norm];
  return nationality.trim().slice(0, 3).toUpperCase();
}

/**
 * Generates deterministic 31-attribute CM 01/02 overrides (12 technical, 10 mental, 9 physical + GK)
 * calibrated from currentAbility, positions, and age.
 */
function buildCm0102Attributes(playerName, ca, positions, age) {
  const rng = createRng(fnv1a(`hydrate-attr|${playerName}|${ca}|${positions.join(',')}`));
  const primary = positions[0] ?? 'MC';
  const base = 3.2 + (clamp(ca, 45, 200) / 200) * 13.8;
  const j = () => (rng() - 0.5) * 3.0;
  const youthPace = age <= 23 ? 0.8 : age >= 32 ? -1.4 : 0;
  const expMent = age >= 29 ? 1.1 : age <= 19 ? -1.0 : 0;

  const isGK = primary === 'GK';
  const isDef = primary === 'DC' || primary === 'DL' || primary === 'DR';
  const isMid = primary === 'DMC' || primary === 'MC' || primary === 'ML' || primary === 'MR' || primary === 'AMC';
  const isFwd = primary === 'FC' || primary === 'FL' || primary === 'FR';
  const isWide = primary === 'DL' || primary === 'DR' || primary === 'ML' || primary === 'MR' || primary === 'FL' || primary === 'FR';

  const technical = {
    crossing: clampAttr(base + (isWide ? 1.8 : isGK ? -5.5 : -1.2) + j()),
    dribbling: clampAttr(base + (isFwd || primary === 'AMC' ? 1.8 : isGK ? -5.5 : isDef ? -1.8 : 0.8) + j()),
    finishing: clampAttr(base + (primary === 'FC' ? 2.5 : isFwd ? 1.6 : isGK ? -6.5 : isDef ? -3.4 : -0.4) + j()),
    heading: clampAttr(base + (primary === 'DC' ? 2.3 : primary === 'FC' ? 1.3 : isGK ? -3.0 : -1.0) + j()),
    longShots: clampAttr(base + (isMid ? 0.9 : isFwd ? 0.6 : isGK ? -6.0 : -2.2) + j()),
    marking: clampAttr(base + (primary === 'DC' ? 2.5 : isDef || primary === 'DMC' ? 1.6 : isGK ? -4.5 : -2.8) + j()),
    offTheBall: clampAttr(base + (isFwd ? 2.1 : isMid ? 1.0 : isGK ? -5.5 : -1.4) + j()),
    passing: clampAttr(base + (primary === 'MC' || primary === 'AMC' ? 2.1 : isMid ? 1.4 : isGK ? -1.0 : 0.2) + j()),
    penalties: clampAttr(base + (primary === 'FC' ? 1.2 : isGK ? -4.5 : -0.8) + j()),
    setPieces: clampAttr(base + (primary === 'AMC' ? 1.2 : isGK ? -4.0 : -0.6) + j()),
    tackling: clampAttr(base + (primary === 'DC' ? 2.5 : isDef || primary === 'DMC' ? 1.8 : isGK ? -4.5 : -2.6) + j()),
    technique: clampAttr(base + (isFwd || primary === 'AMC' || primary === 'MC' ? 1.6 : isGK ? -2.0 : 0.2) + j()),
  };

  const mental = {
    aggression: clampAttr(10 + (isDef || primary === 'DMC' ? 1.5 : -0.4) + (rng() - 0.5) * 5.5),
    anticipation: clampAttr(base + 1.3 + expMent + j()),
    bravery: clampAttr(base + (isDef || isGK || primary === 'DMC' ? 1.6 : 0.2) + j()),
    creativity: clampAttr(base + (primary === 'AMC' || primary === 'MC' ? 2.0 : isDef || isGK ? -2.2 : 0.5) + j()),
    decisions: clampAttr(base + 1.3 + expMent + j()),
    determination: clampAttr(base + 1.1 + j()),
    flair: clampAttr(base + (isFwd || primary === 'AMC' ? 1.8 : isDef || isGK ? -2.6 : 0.3) + j()),
    influence: clampAttr(base - 0.4 + expMent * 1.3 + j()),
    teamwork: clampAttr(base + (isMid || isDef ? 1.3 : 0.5) + j()),
    workRate: clampAttr(base + (isMid || isWide ? 1.4 : isGK ? -1.0 : 0.5) + j()),
  };

  const naturalFitness = clampAttr(12 + (rng() - 0.5) * 5.0);
  const physical = {
    acceleration: clampAttr(base + (isWide || isFwd ? 2.0 : isGK ? -2.0 : 0.2) + youthPace + j()),
    agility: clampAttr(base + (isGK || isFwd || isWide ? 1.6 : 0.4) + j()),
    balance: clampAttr(base + 0.9 + j()),
    injuryProneness: clampAttr(8.5 + (age >= 31 ? 2.0 : -0.5) + (rng() - 0.5) * 6.0),
    jumping: clampAttr(base + (primary === 'DC' || isGK ? 2.1 : primary === 'FC' ? 1.2 : -0.4) + j()),
    naturalFitness,
    pace: clampAttr(base + (isWide || isFwd ? 2.1 : isGK ? -2.5 : 0.2) + youthPace + j()),
    stamina: clampAttr(base + (isMid || isWide ? 1.7 : isGK ? -1.4 : 0.6) + j()),
    strength: clampAttr(base + (primary === 'DC' || primary === 'DMC' || primary === 'FC' ? 1.8 : 0.2) + j()),
  };

  const result = { technical, mental, physical };
  if (isGK) {
    result.goalkeeping = {
      handling: clampAttr(base + 2.2 + j()),
      reflexes: clampAttr(base + 2.4 + j()),
      oneOnOnes: clampAttr(base + 1.8 + j()),
      positioning: clampAttr(base + 2.0 + expMent * 0.6 + j()),
    };
  }
  return result;
}

/* ============================================================================
 * LIVE SOURCE FETCHERS: THESPORTSDB, WIKIPEDIA/WIKIDATA, OPENFOOTBALL
 * ============================================================================ */

async function fetchTheSportsDbClub(club, delayMs) {
  const queries = [club.name, club.shortName].filter(Boolean);
  for (const q of queries) {
    const url = `${THESPORTSDB_BASE}/searchteams.php?t=${encodeURIComponent(q)}`;
    const res = await fetchJsonWithRetry(url, { delayMs, retries: 1 });
    if (!res.ok || !Array.isArray(res.data?.teams)) continue;

    // Pick best matching Soccer team
    const match =
      res.data.teams.find(
        (t) =>
          String(t.strSport || '').toLowerCase() === 'soccer' &&
          (String(t.strCountry || '').toLowerCase() === club.country.toLowerCase() ||
            slugify(t.strTeam) === slugify(club.name))
      ) ??
      res.data.teams.find((t) => String(t.strSport || '').toLowerCase() === 'soccer');

    if (match) return match;
  }
  return null;
}

async function fetchTheSportsDbSquad(teamId, delayMs) {
  if (!teamId) return [];
  const url = `${THESPORTSDB_BASE}/lookup_all_players.php?id=${encodeURIComponent(teamId)}`;
  const res = await fetchJsonWithRetry(url, { delayMs, retries: 1 });
  if (!res.ok || !Array.isArray(res.data?.player)) return [];
  return res.data.player.filter((p) => p && p.strPlayer);
}

async function fetchWikipediaStadiumMedia(stadiumQuery, delayMs) {
  if (!stadiumQuery) return null;
  const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(
    stadiumQuery.replace(/\s+/g, '_')
  )}`;
  const summaryRes = await fetchJsonWithRetry(summaryUrl, { delayMs, retries: 1 });
  if (summaryRes.ok && summaryRes.data) {
    const img =
      summaryRes.data.originalimage?.source ?? summaryRes.data.thumbnail?.source ?? null;
    const wikibaseItem = summaryRes.data.wikibase_item ?? null;
    if (img || wikibaseItem) {
      return {
        imageUrl: img,
        wikibaseItem,
        title: summaryRes.data.title ?? stadiumQuery,
      };
    }
  }

  // Fallback to MediaWiki search + PageImages
  const searchUrl =
    `https://en.wikipedia.org/w/api.php?action=query&format=json&generator=search` +
    `&gsrsearch=${encodeURIComponent(`${stadiumQuery} stadium`)}&gsrlimit=2` +
    `&prop=pageimages|pageprops&piprop=original|thumbnail&pithumbsize=1600&ppprop=wikibase_item`;
  const searchRes = await fetchJsonWithRetry(searchUrl, { delayMs, retries: 1 });
  const pages = searchRes.ok ? Object.values(searchRes.data?.query?.pages ?? {}) : [];
  for (const page of pages) {
    const img = page?.original?.source ?? page?.thumbnail?.source ?? null;
    if (img) {
      return {
        imageUrl: img,
        wikibaseItem: page?.pageprops?.wikibase_item ?? null,
        title: page.title ?? stadiumQuery,
      };
    }
  }
  return null;
}

async function fetchWikidataCapacity(qid, delayMs) {
  if (!qid) return null;
  const url = `https://www.wikidata.org/wiki/Special:EntityData/${encodeURIComponent(qid)}.json`;
  const res = await fetchJsonWithRetry(url, { delayMs, retries: 1, timeoutMs: 6000 });
  if (!res.ok) return null;
  const entity = res.data?.entities?.[qid];
  const claim = entity?.claims?.P1083?.[0]?.mainsnak?.datavalue?.value?.amount;
  if (!claim) return null;
  const parsed = Number.parseInt(String(claim).replace(/^\+/, ''), 10);
  return Number.isFinite(parsed) && parsed > 500 ? parsed : null;
}

async function fetchOpenFootballLeagueClubs(leagueId, delayMs) {
  const code = OPENFOOTBALL_LEAGUE_CODES[leagueId];
  if (!code) return null;
  const seasons = ['2026-27', '2025-26', '2024-25'];
  for (const season of seasons) {
    const url = `https://raw.githubusercontent.com/openfootball/football.json/master/${season}/${code}.json`;
    const res = await fetchJsonWithRetry(url, { delayMs, retries: 1, timeoutMs: 6000 });
    if (res.ok && Array.isArray(res.data?.matches)) {
      const names = new Set();
      for (const m of res.data.matches) {
        if (m.team1) names.add(String(m.team1));
        if (m.team2) names.add(String(m.team2));
      }
      if (names.size > 0) {
        return {
          season,
          leagueName: res.data.name || leagueId,
          clubs: [...names].map((name) => ({ name })),
        };
      }
    }
  }
  return null;
}

/* ============================================================================
 * MAIN HYDRATION PIPELINE
 * ============================================================================ */

async function main() {
  const startedAt = Date.now();
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    printUsage();
    return;
  }

  const { leagues, clubs } = await loadSeedMetadata();
  const leaguesById = new Map(leagues.map((l) => [l.id, l]));

  // Select target clubs from CLI flags
  let selectedClubs = clubs;
  if (opts.clubs.length > 0) {
    const clubSet = new Set(opts.clubs.map((s) => s.toLowerCase()));
    selectedClubs = clubs.filter((c) => clubSet.has(c.id.toLowerCase()));
  } else if (opts.leagues.length > 0) {
    const leagueSet = new Set(opts.leagues.map((s) => s.toLowerCase()));
    selectedClubs = clubs.filter((c) => leagueSet.has(c.leagueId.toLowerCase()));
  } else if (opts.top6 || !opts.all) {
    selectedClubs = clubs.filter((c) => TOP6_LEAGUES.has(c.leagueId));
  }

  if (opts.limit && selectedClubs.length > opts.limit) {
    selectedClubs = selectedClubs.slice(0, opts.limit);
  }

  console.log('====================================================================');
  console.log(' CM 01/02 (Season 2026/27) — Live Database & Media Hydrator');
  console.log('====================================================================');
  console.log(
    ` Seed Catalog : ${leagues.length} leagues | ${clubs.length} clubs`
  );
  console.log(
    ` Target Scope : ${selectedClubs.length} clubs | Mode: ${opts.dryRun ? 'DRY-RUN (no file write)' : 'LIVE WRITE'} | Delay: ${opts.delayMs}ms`
  );
  console.log('--------------------------------------------------------------------');

  // Read existing overrides file cleanly
  let existingOverrides = {
    schemaVersion: 1,
    seasonLabel: '2026/27',
    generatedAt: new Date().toISOString(),
    sources: ['thesportsdb', 'wikipedia', 'wikidata', 'openfootball'],
    clubs: {},
    players: {},
  };
  try {
    const raw = await fs.readFile(OVERRIDES_JSON_PATH, 'utf8');
    existingOverrides = { ...existingOverrides, ...JSON.parse(raw) };
  } catch {
    // start fresh if missing
  }

  const stats = {
    clubsProcessed: 0,
    theSportsDbClubHits: 0,
    theSportsDbPlayersMapped: 0,
    wikipediaStadiumHits: 0,
    wikidataCapacityHits: 0,
    openFootballLeagueHits: 0,
    openFootballClubMatches: 0,
    fallbacks: 0,
  };

  // Pre-fetch OpenFootball league club registries for unique targeted leagues
  const openFootballCache = new Map();
  const targetLeagueIds = [...new Set(selectedClubs.map((c) => c.leagueId))];
  for (const leagueId of targetLeagueIds) {
    if (!OPENFOOTBALL_LEAGUE_CODES[leagueId]) continue;
    const ofData = await fetchOpenFootballLeagueClubs(leagueId, opts.delayMs);
    if (ofData) {
      openFootballCache.set(leagueId, ofData);
      stats.openFootballLeagueHits++;
      console.log(
        ` [OpenFootball] Loaded ${ofData.clubs.length} clubs for ${leagueId} (${ofData.season})`
      );
    }
  }

  const updatedClubs = { ...(existingOverrides.clubs ?? {}) };
  const updatedPlayers = { ...(existingOverrides.players ?? {}) };

  for (const club of selectedClubs) {
    stats.clubsProcessed++;
    const league = leaguesById.get(club.leagueId);
    const clubPatch = { ...(updatedClubs[club.id] ?? {}) };
    const hitTags = [];

    // 1. OpenFootball cross-check
    const ofLeague = openFootballCache.get(club.leagueId);
    if (ofLeague) {
      const ofMatch = ofLeague.clubs.find((c) => {
        const ofSlug = slugify(c.name);
        const clubSlug = slugify(club.name);
        const shortSlug = slugify(club.shortName);
        return (
          ofSlug === clubSlug ||
          ofSlug.includes(clubSlug) ||
          clubSlug.includes(ofSlug) ||
          (shortSlug.length >= 4 && ofSlug.includes(shortSlug)) ||
          (c.code && c.code.toUpperCase() === club.threeLetterCode.toUpperCase())
        );
      });
      if (ofMatch) {
        stats.openFootballClubMatches++;
        hitTags.push(`OpenFootball:${ofMatch.code || ofMatch.name}`);
      }
    }

    // 2. TheSportsDB club + squad hydration
    const tsdbClub = await fetchTheSportsDbClub(club, opts.delayMs);
    if (tsdbClub) {
      stats.theSportsDbClubHits++;
      clubPatch.theSportsDbTeamId = tsdbClub.idTeam;
      if (tsdbClub.strBadge || tsdbClub.strTeamBadge) {
        clubPatch.badgeUrl = tsdbClub.strBadge || tsdbClub.strTeamBadge;
      }
      if (tsdbClub.strStadiumThumb) {
        clubPatch.stadiumImageUrl = tsdbClub.strStadiumThumb;
      }
      if (tsdbClub.strStadium) {
        clubPatch.stadiumName = tsdbClub.strStadium;
      }
      const cap = Number.parseInt(tsdbClub.intStadiumCapacity, 10);
      if (Number.isFinite(cap) && cap > 500) {
        clubPatch.stadiumCapacity = cap;
      }
      hitTags.push(`TSDB#${tsdbClub.idTeam}`);

      // Fetch squad players from TheSportsDB
      const rawPlayers = await fetchTheSportsDbSquad(tsdbClub.idTeam, opts.delayMs);
      let mappedCount = 0;
      for (const rp of rawPlayers) {
        const name = String(rp.strPlayer || '').trim();
        if (!name || /manager|coach/i.test(String(rp.strPosition || ''))) continue;

        const positions = mapPositionString(rp.strPosition);
        const age = computeAgeAugust2026(rp.dateBorn);
        const valueHint = parseMarketValueHint(rp.strSigning);
        const rng = createRng(fnv1a(`ca|${club.id}|${name}`));

        // Calibrate CA from club reputation + optional transfer fee hint
        const clubBaseCa = clamp(Math.round(42 + (club.reputation / 10000) * 124), 66, 166);
        const valueBonus = valueHint
          ? clamp(Math.round(Math.log10(Math.max(100_000, valueHint) / 1_000_000) * 12), -6, 18)
          : 0;
        const ca = clamp(Math.round(clubBaseCa + valueBonus + (rng() - 0.5) * 18), 58, 188);
        const pa = clamp(age <= 22 ? ca + 14 + Math.floor(rng() * 14) : ca + 2, ca, 195);

        const key = slugify(`${name}-${club.id}`);
        const num = Number.parseInt(rp.strNumber, 10);

        updatedPlayers[key] = {
          id: key,
          name,
          clubId: club.id,
          nationality: rp.strNationality || club.country,
          nationalityCode: nationalityToCode(rp.strNationality, league?.country?.slice(0, 3).toUpperCase() || 'ENG'),
          age,
          dateOfBirth: rp.dateBorn && /^\d{4}-\d{2}-\d{2}/.test(rp.dateBorn) ? rp.dateBorn.slice(0, 10) : undefined,
          positions,
          heightCm: parseHeightCm(rp.strHeight),
          weightKg: parseWeightKg(rp.strWeight),
          squadNumber: Number.isFinite(num) && num >= 1 && num <= 99 ? num : undefined,
          currentAbility: ca,
          potentialAbility: pa,
          imageUrl: rp.strCutout || rp.strThumb || undefined,
          wikiQuery: `${name} footballer`,
          attributeOverrides: buildCm0102Attributes(name, ca, positions, age),
        };
        mappedCount++;
        stats.theSportsDbPlayersMapped++;
      }
      if (mappedCount > 0) {
        hitTags.push(`${mappedCount} players`);
      }
    }

    // 3. Wikipedia PageImages + Wikidata enrichment for stadium photography & capacity
    const wikiMedia = await fetchWikipediaStadiumMedia(club.stadiumWikiQuery, opts.delayMs);
    if (wikiMedia?.imageUrl) {
      stats.wikipediaStadiumHits++;
      if (!clubPatch.stadiumImageUrl) {
        clubPatch.stadiumImageUrl = wikiMedia.imageUrl;
      }
      hitTags.push('WikiImg');
    }
    if (wikiMedia?.wikibaseItem && !clubPatch.stadiumCapacity) {
      const wdCap = await fetchWikidataCapacity(wikiMedia.wikibaseItem, opts.delayMs);
      if (wdCap) {
        stats.wikidataCapacityHits++;
        clubPatch.stadiumCapacity = wdCap;
        hitTags.push(`WD:${wdCap}`);
      }
    }

    if (hitTags.length === 0) {
      stats.fallbacks++;
      hitTags.push('Fallback(seed)');
    } else {
      updatedClubs[club.id] = clubPatch;
    }

    console.log(
      ` [${String(stats.clubsProcessed).padStart(3, ' ')}/${selectedClubs.length}] ${club.name.padEnd(26, ' ')} (${club.leagueId}) -> ${hitTags.join(' | ')}`
    );
  }

  const nextOutput = {
    schemaVersion: 1,
    seasonLabel: '2026/27',
    generatedAt: new Date().toISOString(),
    sources: ['thesportsdb', 'wikipedia', 'wikidata', 'openfootball'],
    clubs: updatedClubs,
    players: updatedPlayers,
  };

  if (!opts.dryRun) {
    await fs.writeFile(OVERRIDES_JSON_PATH, `${JSON.stringify(nextOutput, null, 2)}\n`, 'utf8');
  }

  const elapsedSec = ((Date.now() - startedAt) / 1000).toFixed(2);
  console.log('--------------------------------------------------------------------');
  console.log(' Hydration Summary Report');
  console.log('--------------------------------------------------------------------');
  console.log(` Clubs Processed         : ${stats.clubsProcessed}`);
  console.log(` TheSportsDB Club Hits   : ${stats.theSportsDbClubHits}`);
  console.log(` TheSportsDB Players     : ${stats.theSportsDbPlayersMapped} mapped to 31 CM 01/02 attributes`);
  console.log(` Wikipedia Stadium Hits  : ${stats.wikipediaStadiumHits}`);
  console.log(` Wikidata Capacity Hits  : ${stats.wikidataCapacityHits}`);
  console.log(` OpenFootball Matches    : ${stats.openFootballClubMatches} (${stats.openFootballLeagueHits} leagues loaded)`);
  console.log(` Graceful Seed Fallbacks : ${stats.fallbacks}`);
  console.log(` Output File             : ${opts.dryRun ? '(dry-run — not written)' : OVERRIDES_JSON_PATH}`);
  console.log(` Total Duration          : ${elapsedSec}s`);
  console.log('====================================================================');
}

main().catch((err) => {
  console.error('[hydrate_db] Fatal error:', err);
  process.exitCode = 1;
});
