# Championship Manager 01/02 — Season 2026/27 Edition

**Play Online:** https://bmkoscak.github.io/cm-0102-season-2627/

A fast-paced, authentic football management game inspired by **Championship Manager: Season 01/02**, rebuilt for the **2026/2027 football season** with a deep European league pyramid, dynamic online stadium & player portrait fetching, and live dual-commentator spoken match audio.

## Key Features
- **Deep 2026/2027 European Pyramid:** **18 playable leagues across 13 countries** (including Tier 1 & Tier 2 pyramids for England, Spain, Italy, Germany, and Slovenia plus France, Netherlands, Portugal, Scotland, Belgium, Croatia, Austria, and Turkey), **310 real clubs**, and **7,169 playable players** (**974 hand-curated real 2026/27 players**, **137 wonderkids**, and **36 Day-1 free agents**).
- **Classic 1–20 Attribute Engine:** Authentic 3-column Technical (12) / Mental (10) / Physical (9) + Goalkeeping (4) schema with classic color tiers and fast attribute-filtered scouting across all 7,169 players.
- **Tactics & "Wib-Wob" (With/Without Ball) 5×5 Grid:** 6 classic formations, drag-and-drop pitch board, 8-way directional run arrows, editable 25-zone With-Ball & Without-Ball positional shifts, and classic Team Instructions.
- **Dynamic Online Stadium & Portrait Engine:** Context-aware `BackgroundService` querying TheSportsDB, Wikipedia PageImages, and Unsplash with `<16ms` browser IndexedDB Blob caching (+ local disk cache in dev) behind CM 01/02's dark glass readability overlay.
- **Live Dual-Commentator Broadcast & Stadium Ambience:** Zero-config Web Speech API Play-by-Play + Color Analyst voices (plus optional OpenAI TTS / ElevenLabs / local Piper or Kokoro hooks), procedural Web Audio stadium ambience with automatic `-8 dB` voice ducking, 2D WIB-WOB radar, `1x`–`20x` speed control, and synchronized flashing team-colored commentary banner.
- **Live Roster Hydrator:** Run `node scripts/hydrate_db.js` to fetch live squad & stadium updates from TheSportsDB, Wikipedia/Wikidata, and OpenFootball into `src/data/hydrated_overrides.json`.

## Local Development

```bash
npm install
npm run dev
```

### Live Database Hydration
```bash
# Dry-run hydration on top clubs
node scripts/hydrate_db.js --top6 --limit 10 --dry-run

# Hydrate specific clubs
node scripts/hydrate_db.js --club arsenal,olimpija-ljubljana,maribor
```

### Verification & Production Build
```bash
npm run typecheck
node tests/verify_runtime.mjs
npm run build
```
