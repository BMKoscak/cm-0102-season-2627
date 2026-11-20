/**
 * Automated Runtime & Integration Verification Suite
 * Championship Manager 01/02 — Season 2026/27
 *
 * Run via: node tests/verify_runtime.mjs
 */

import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const results = [];
let failedCount = 0;

async function runCheck(name, fn) {
  const t0 = performance.now();
  try {
    const detail = await fn();
    const ms = Math.round((performance.now() - t0) * 10) / 10;
    results.push({ name, ok: true, ms, detail: detail ?? '' });
    console.log(`  [PASS] ${name} (${ms}ms)${detail ? ` — ${detail}` : ''}`);
  } catch (err) {
    failedCount++;
    const ms = Math.round((performance.now() - t0) * 10) / 10;
    const msg = err instanceof Error ? err.message : String(err);
    results.push({ name, ok: false, ms, detail: msg });
    console.error(`  [FAIL] ${name} (${ms}ms) — ${msg}`);
  }
}

function isFiniteNum(v) {
  return typeof v === 'number' && Number.isFinite(v);
}

function assertValidAttr1To20(val, label) {
  assert.ok(
    isFiniteNum(val) && Number.isInteger(val) && val >= 1 && val <= 20,
    `Invalid attribute ${label}: ${val}`
  );
}

async function main() {
  console.log('=== CM 01/02 (Season 2026/27) Runtime Verification Suite ===\n');

  const vite = await createServer({
    root: ROOT_DIR,
    server: { middlewareMode: true, hmr: false },
    appType: 'custom',
    logLevel: 'error',
  });

  try {
    const seedMod = await vite.ssrLoadModule('/src/data/seedDatabase.ts');
    const tacticsMod = await vite.ssrLoadModule('/src/engine/tactics.ts');
    const matchMod = await vite.ssrLoadModule('/src/engine/matchEngine.ts');
    const seasonMod = await vite.ssrLoadModule('/src/engine/seasonEngine.ts');
    const attrMod = await vite.ssrLoadModule('/src/engine/attributes.ts');
    const bgMod = await vite.ssrLoadModule('/src/services/backgroundService.ts');

    let db;
    let fixtures;
    let standings;
    let baseState;

    // -------------------------------------------------------------------------
    // 1. DATABASE INTEGRITY
    // -------------------------------------------------------------------------
    console.log('[1] Database Integrity (createInitialDatabase)');

    await runCheck('Database counts: 18 leagues, 310 clubs, >=7,000 players', () => {
      db = seedMod.createInitialDatabase();
      const leagueList = Object.values(db.leagues);
      const clubList = Object.values(db.clubs);
      const playerList = Object.values(db.players);

      assert.equal(leagueList.length, 18, `Expected 18 leagues, got ${leagueList.length}`);
      assert.equal(clubList.length, 310, `Expected 310 clubs, got ${clubList.length}`);
      assert.ok(playerList.length >= 7000, `Expected >= 7000 players, got ${playerList.length}`);

      const freeAgents = playerList.filter((p) => p.clubId === null);
      const wonderkids = playerList.filter((p) => p.isWonderkid);
      assert.ok(freeAgents.length > 0, 'Expected at least 1 free agent');
      assert.ok(wonderkids.length > 0, 'Expected at least 1 wonderkid');

      return `${leagueList.length} leagues, ${clubList.length} clubs, ${playerList.length} players (${freeAgents.length} free agents, ${wonderkids.length} wonderkids)`;
    });

    await runCheck('Zero orphan clubIds & league<->club referential integrity', () => {
      let orphanPlayers = 0;
      let badLeagueRefs = 0;

      for (const lg of Object.values(db.leagues)) {
        for (const cid of lg.clubIds) {
          const c = db.clubs[cid];
          if (!c || c.leagueId !== lg.id) badLeagueRefs++;
        }
      }
      for (const c of Object.values(db.clubs)) {
        const lg = db.leagues[c.leagueId];
        if (!lg || !lg.clubIds.includes(c.id)) badLeagueRefs++;
      }
      for (const p of Object.values(db.players)) {
        if (p.clubId !== null && !db.clubs[p.clubId]) {
          orphanPlayers++;
        }
      }

      assert.equal(badLeagueRefs, 0, `Found ${badLeagueRefs} league<->club mismatches`);
      assert.equal(orphanPlayers, 0, `Found ${orphanPlayers} orphan player clubIds`);
      return '0 orphan clubIds, 0 league mismatches';
    });

    await runCheck('All 31+ CM attributes strictly 1..20 integers, 0 NaN fields', () => {
      const techKeys = [
        'crossing', 'dribbling', 'finishing', 'heading', 'longShots', 'marking',
        'offTheBall', 'passing', 'penalties', 'setPieces', 'tackling', 'technique',
      ];
      const mentKeys = [
        'aggression', 'anticipation', 'bravery', 'creativity', 'decisions',
        'determination', 'flair', 'influence', 'teamwork', 'workRate',
      ];
      const physKeys = [
        'acceleration', 'agility', 'balance', 'injuryProneness', 'jumping',
        'naturalFitness', 'pace', 'stamina', 'strength',
      ];
      const gkKeys = ['handling', 'reflexes', 'oneOnOnes', 'positioning'];

      let checkedAttrs = 0;
      for (const p of Object.values(db.players)) {
        assert.ok(p.name && p.shortName, `Player ${p.id} missing name/shortName`);
        assert.ok(p.nationality && p.nationalityCode, `Player ${p.id} missing nationality/code`);
        assert.ok(Array.isArray(p.positions) && p.positions.length >= 1, `Player ${p.id} missing positions`);
        assert.ok(isFiniteNum(p.age) && p.age >= 15 && p.age <= 48, `Player ${p.id} invalid age ${p.age}`);
        assert.ok(isFiniteNum(p.currentAbility) && p.currentAbility >= 1 && p.currentAbility <= 200, `Invalid CA on ${p.id}`);
        assert.ok(isFiniteNum(p.value) && p.value >= 0, `Invalid value on ${p.id}`);
        assert.ok(isFiniteNum(p.wage) && p.wage >= 0, `Invalid wage on ${p.id}`);
        assert.ok(isFiniteNum(p.condition) && p.condition >= 0 && p.condition <= 100, `Invalid condition on ${p.id}`);

        for (const k of techKeys) {
          assertValidAttr1To20(p.attributes.technical[k], `${p.id}.technical.${k}`);
          checkedAttrs++;
        }
        for (const k of mentKeys) {
          assertValidAttr1To20(p.attributes.mental[k], `${p.id}.mental.${k}`);
          checkedAttrs++;
        }
        for (const k of physKeys) {
          assertValidAttr1To20(p.attributes.physical[k], `${p.id}.physical.${k}`);
          checkedAttrs++;
        }
        if (p.attributes.goalkeeping) {
          for (const k of gkKeys) {
            assertValidAttr1To20(p.attributes.goalkeeping[k], `${p.id}.goalkeeping.${k}`);
            checkedAttrs++;
          }
        }
      }
      return `${checkedAttrs.toLocaleString()} attributes verified in [1..20] with 0 NaNs`;
    });

    await runCheck('All 310 clubs have valid 11 starters, 7 bench, 25 WIB & 25 WOB zones', () => {
      const expectedKeys = [];
      for (let r = 0; r < 5; r++) {
        for (let c = 0; c < 5; c++) expectedKeys.push(`${r}-${c}`);
      }

      for (const club of Object.values(db.clubs)) {
        const t = club.tactics;
        assert.equal(t.startingXI.length, 11, `${club.id}: expected 11 startingXI slots`);
        assert.equal(t.bench.length, 7, `${club.id}: expected 7 bench players, got ${t.bench.length}`);

        const seen = new Set();
        for (const slot of t.startingXI) {
          assert.ok(slot.playerId, `${club.id}: empty startingXI slot ${slot.slotIndex}`);
          assert.ok(!seen.has(slot.playerId), `${club.id}: duplicate starter ${slot.playerId}`);
          const p = db.players[slot.playerId];
          assert.ok(p && p.clubId === club.id, `${club.id}: starter ${slot.playerId} not in club`);
          seen.add(slot.playerId);
        }
        for (const bid of t.bench) {
          assert.ok(!seen.has(bid), `${club.id}: duplicate/overlapping bench player ${bid}`);
          const p = db.players[bid];
          assert.ok(p && p.clubId === club.id, `${club.id}: bench player ${bid} not in club`);
          seen.add(bid);
        }

        const wibKeys = Object.keys(t.wibWobGrid.withBall);
        const wobKeys = Object.keys(t.wibWobGrid.withoutBall);
        assert.equal(wibKeys.length, 25, `${club.id}: expected 25 WIB zones, got ${wibKeys.length}`);
        assert.equal(wobKeys.length, 25, `${club.id}: expected 25 WOB zones, got ${wobKeys.length}`);

        for (const key of expectedKeys) {
          const wib = t.wibWobGrid.withBall[key];
          const wob = t.wibWobGrid.withoutBall[key];
          assert.ok(Array.isArray(wib) && wib.length === 11, `${club.id}: invalid WIB[${key}]`);
          assert.ok(Array.isArray(wob) && wob.length === 11, `${club.id}: invalid WOB[${key}]`);
          for (let i = 0; i < 11; i++) {
            assert.ok(
              isFiniteNum(wib[i].x) && wib[i].x >= 0 && wib[i].x <= 100 &&
              isFiniteNum(wib[i].y) && wib[i].y >= 0 && wib[i].y <= 100,
              `${club.id}: WIB[${key}][${i}] out of 0..100`
            );
            assert.ok(
              isFiniteNum(wob[i].x) && wob[i].x >= 0 && wob[i].x <= 100 &&
              isFiniteNum(wob[i].y) && wob[i].y >= 0 && wob[i].y <= 100,
              `${club.id}: WOB[${key}][${i}] out of 0..100`
            );
          }
        }

        // Check finances finite
        const f = club.finances;
        for (const field of ['balance', 'transferBudget', 'wageBudgetWeekly', 'currentWeeklyWages']) {
          assert.ok(isFiniteNum(f[field]), `${club.id}: NaN finance field ${field}`);
        }
      }
      return '310/310 clubs passed (11 XI + 7 bench + 25x2 WIB/WOB zones)';
    });

    // -------------------------------------------------------------------------
    // 2. SEASON FIXTURES & STANDINGS
    // -------------------------------------------------------------------------
    console.log('\n[2] Season Scheduler & Standings (generateSeasonFixtures / recalculateAllStandings)');

    await runCheck('Balanced fixtures across all 18 leagues', () => {
      fixtures = seasonMod.generateSeasonFixtures(db.leagues, db.clubs, '2026-08-08');
      assert.ok(fixtures.length > 3000, `Expected >3000 fixtures, got ${fixtures.length}`);

      const byLeague = new Map();
      for (const f of fixtures) {
        assert.notEqual(f.homeClubId, f.awayClubId, `Self-match found: ${f.id}`);
        assert.match(f.date, /^\d{4}-\d{2}-\d{2}$/, `Invalid date ${f.date}`);
        if (!byLeague.has(f.leagueId)) byLeague.set(f.leagueId, []);
        byLeague.get(f.leagueId).push(f);
      }

      assert.equal(byLeague.size, 18, `Expected fixtures in 18 leagues, got ${byLeague.size}`);

      for (const lg of Object.values(db.leagues)) {
        const lgFixtures = byLeague.get(lg.id) ?? [];
        const n = lg.clubIds.length;
        const cycles = Math.max(1, lg.rounds || (n <= 10 ? 4 : 2));
        const expectedTotal = ((n * (n - 1)) / 2) * cycles;
        assert.equal(
          lgFixtures.length,
          expectedTotal,
          `${lg.id}: expected ${expectedTotal} fixtures, got ${lgFixtures.length}`
        );

        const homeCounts = new Map();
        const awayCounts = new Map();
        const clubDates = new Map();
        for (const cid of lg.clubIds) {
          homeCounts.set(cid, 0);
          awayCounts.set(cid, 0);
          clubDates.set(cid, new Set());
        }

        for (const f of lgFixtures) {
          homeCounts.set(f.homeClubId, (homeCounts.get(f.homeClubId) ?? 0) + 1);
          awayCounts.set(f.awayClubId, (awayCounts.get(f.awayClubId) ?? 0) + 1);
          assert.ok(
            !clubDates.get(f.homeClubId).has(f.date),
            `${lg.id}: club ${f.homeClubId} double-booked on ${f.date}`
          );
          assert.ok(
            !clubDates.get(f.awayClubId).has(f.date),
            `${lg.id}: club ${f.awayClubId} double-booked on ${f.date}`
          );
          clubDates.get(f.homeClubId).add(f.date);
          clubDates.get(f.awayClubId).add(f.date);
        }

        const expectedPerClub = (n - 1) * cycles;
        for (const cid of lg.clubIds) {
          const h = homeCounts.get(cid);
          const a = awayCounts.get(cid);
          assert.equal(h + a, expectedPerClub, `${lg.id}/${cid}: expected ${expectedPerClub} matches, got ${h + a}`);
          if (cycles % 2 === 0) {
            assert.equal(h, a, `${lg.id}/${cid}: unbalanced home (${h}) vs away (${a})`);
          }
        }
      }
      return `${fixtures.length.toLocaleString()} balanced fixtures across 18 leagues`;
    });

    await runCheck('recalculateAllStandings initializes all 18 tables cleanly', () => {
      standings = seasonMod.recalculateAllStandings(db.leagues, db.clubs, fixtures);
      assert.equal(Object.keys(standings).length, 18);
      for (const lg of Object.values(db.leagues)) {
        const rows = standings[lg.id];
        assert.equal(rows.length, lg.clubIds.length, `${lg.id}: table size mismatch`);
        rows.forEach((row, idx) => {
          assert.equal(row.position, idx + 1);
          assert.equal(row.played, 0);
          assert.equal(row.points, 0);
        });
      }
      return '18 league tables initialized with exact club counts';
    });

    // Build GameState matching gameStore.tsx structure
    const userClubId = db.clubs['arsenal'] ? 'arsenal' : Object.keys(db.clubs)[0];
    baseState = {
      initialized: true,
      seasonLabel: db.seasonLabel,
      currentDate: '2026-08-01',
      userClubId,
      manager: {
        name: 'QA Verifier',
        nationality: 'Slovenia',
        clubId: userClubId,
        reputation: 7000,
        daysInCharge: 1,
        matchesPlayed: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        trophies: [],
      },
      leagues: db.leagues,
      clubs: db.clubs,
      players: db.players,
      fixtures,
      standings,
      transferOffers: [],
      contractOffers: [],
      shortlist: [],
      news: [],
      activeMatch: null,
      audioSettings: {
        voiceEnabled: false,
        crowdEnabled: true,
        crowdVolume: 0.35,
        voiceVolume: 0.85,
        ttsProvider: 'webspeech',
        apiKey: '',
        localEndpoint: 'http://localhost:5002/api/tts',
        scanlines: false,
        vignette: true,
        overlayOpacity: 0.72,
      },
    };

    await runCheck('IndexedDB structuredClone safety on full initial GameState', () => {
      const cloned = structuredClone(baseState);
      assert.equal(Object.keys(cloned.players).length, Object.keys(baseState.players).length);
      return 'structuredClone succeeded cleanly (~7k players, 310 clubs)';
    });

    // -------------------------------------------------------------------------
    // 3. FULL 90-MINUTE LIVE MATCH SIMULATION
    // -------------------------------------------------------------------------
    console.log('\n[3] Live 90-Minute Match Engine & Commit Pipeline');

    await runCheck('Full 90-min live match: lead+analyst commentary, ratings, radar bounds, live tactics & sub, commitMatchResult', () => {
      // Find first user home fixture so we also verify gate receipts
      const userFixture =
        baseState.fixtures.find((f) => f.homeClubId === userClubId) ??
        baseState.fixtures.find((f) => f.homeClubId === userClubId || f.awayClubId === userClubId);
      assert.ok(userFixture, 'No fixture found for user club');

      const stateAtMatchDate = { ...baseState, currentDate: userFixture.date };
      let session = matchMod.createMatchSession(userFixture, stateAtMatchDate);
      assert.equal(session.phase, 'pre_match');
      assert.equal(session.radarPlayers.length, 22);
      structuredClone(session);

      const userSide = session.userSide;
      assert.ok(userSide === 'home' || userSide === 'away');

      let didLiveTactics = false;
      let didLiveSub = false;
      let subInPlayerId = null;
      let subOutPlayerId = null;
      let ticks = 0;
      const MAX_TICKS = 400;

      while (session.phase !== 'full_time' && ticks < MAX_TICKS) {
        ticks++;
        const { nextSession } = matchMod.stepMatchTick(session, stateAtMatchDate.players, stateAtMatchDate.clubs);
        session = nextSession;

        // Validate bounds on EVERY tick
        assert.ok(isFiniteNum(session.ballX) && session.ballX >= 0 && session.ballX <= 100, `ballX OOB: ${session.ballX}`);
        assert.ok(isFiniteNum(session.ballY) && session.ballY >= 0 && session.ballY <= 100, `ballY OOB: ${session.ballY}`);
        assert.ok(session.zoneRow >= 0 && session.zoneRow <= 4, `zoneRow OOB: ${session.zoneRow}`);
        assert.ok(session.zoneCol >= 0 && session.zoneCol <= 4, `zoneCol OOB: ${session.zoneCol}`);

        for (const dot of session.radarPlayers) {
          assert.ok(
            isFiniteNum(dot.x) && dot.x >= 0 && dot.x <= 100 &&
            isFiniteNum(dot.y) && dot.y >= 0 && dot.y <= 100,
            `Radar dot ${dot.playerId} OOB (${dot.x}, ${dot.y})`
          );
        }
        for (const st of Object.values(session.playerStats)) {
          assert.ok(
            isFiniteNum(st.rating) && st.rating >= 1.0 && st.rating <= 10.0,
            `Rating OOB for ${st.playerId}: ${st.rating}`
          );
          assert.ok(
            isFiniteNum(st.condition) && st.condition >= 0 && st.condition <= 100,
            `Condition OOB for ${st.playerId}: ${st.condition}`
          );
        }

        // Test live tactics change around minute 30
        if (!didLiveTactics && session.phase === 'first_half' && session.minute >= 30) {
          const curTac = userSide === 'home' ? session.homeTactics : session.awayTactics;
          const patched = {
            ...curTac,
            instructions: { ...curTac.instructions, mentality: 'Attacking', passing: 'Direct', pressing: true },
          };
          const prevEvLen = session.events.length;
          session = matchMod.applyLiveTacticsChange(session, userSide, patched);
          assert.equal(session.events.length, prevEvLen + 1, 'Tactics change did not emit event');
          const lastEv = session.events[session.events.length - 1];
          assert.equal(lastEv.type, 'tactical_change');
          const afterTac = userSide === 'home' ? session.homeTactics : session.awayTactics;
          assert.equal(afterTac.instructions.mentality, 'Attacking');
          didLiveTactics = true;
        }

        // Test live substitution around minute 62
        if (!didLiveSub && session.phase === 'second_half' && session.minute >= 62) {
          const curTac = userSide === 'home' ? session.homeTactics : session.awayTactics;
          // Pick an outfield starter who hasn't been sent off
          const outSlot = curTac.startingXI.slice(1).find((s) => s.playerId && !session.playerStats[s.playerId]?.redCard);
          const inBenchId = curTac.bench.find((id) => id && !session.playerStats[id]?.redCard);
          assert.ok(outSlot && outSlot.playerId && inBenchId, 'Could not find valid sub pair');
          subOutPlayerId = outSlot.playerId;
          subInPlayerId = inBenchId;

          const prevSubs = userSide === 'home' ? session.homeSubsUsed : session.awaySubsUsed;
          session = matchMod.applyLiveSubstitution(session, userSide, subOutPlayerId, subInPlayerId, stateAtMatchDate.players);
          const nextSubs = userSide === 'home' ? session.homeSubsUsed : session.awaySubsUsed;
          assert.equal(nextSubs, prevSubs + 1, 'Subs used did not increment');
          assert.ok(session.playerStats[subOutPlayerId].subbedOffMinute !== undefined, 'Missing subbedOffMinute');
          assert.ok(session.playerStats[subInPlayerId].subbedOnMinute !== undefined, 'Missing subbedOnMinute');
          assert.ok(session.radarPlayers.some((d) => d.playerId === subInPlayerId), 'Subbed-in player missing from radar');
          didLiveSub = true;

          // Verify mid-match structuredClone safety
          structuredClone({ ...stateAtMatchDate, activeMatch: session });
        }
      }

      assert.equal(session.phase, 'full_time', `Match did not reach full_time within ${MAX_TICKS} ticks (phase=${session.phase}, min=${session.minute})`);
      assert.ok(didLiveTactics, 'Live tactics test did not execute');
      assert.ok(didLiveSub, 'Live substitution test did not execute');

      // Verify first-half stoppage events stay capped at minute <= 45 and second-half <= 90
      const htIdx = session.events.findIndex((ev) => ev.type === 'halftime');
      assert.ok(htIdx > 0, 'Missing halftime event');
      for (let i = 0; i <= htIdx; i++) {
        assert.ok(
          session.events[i].minute <= 45,
          `First-half event ${session.events[i].id} has minute ${session.events[i].minute} > 45`
        );
      }
      for (let i = htIdx + 1; i < session.events.length; i++) {
        assert.ok(
          session.events[i].minute <= 90,
          `Second-half event ${session.events[i].id} has minute ${session.events[i].minute} > 90`
        );
      }

      let leadSegments = 0;
      let analystSegments = 0;
      for (const ev of session.events) {
        for (const seg of ev.segments) {
          if (seg.speaker === 'lead') leadSegments++;
          if (seg.speaker === 'analyst') analystSegments++;
        }
      }
      assert.ok(leadSegments > 10, `Expected >10 lead segments, got ${leadSegments}`);
      assert.ok(analystSegments > 2, `Expected >2 analyst segments, got ${analystSegments}`);

      const changedRatings = Object.values(session.playerStats).filter((st) => st.rating !== 6.5).length;
      assert.ok(changedRatings >= 10, `Expected >=10 players with updated ratings, got ${changedRatings}`);

      // Commit match result
      const prevBalance = stateAtMatchDate.clubs[userClubId].finances.balance;
      const committed = seasonMod.commitMatchResult(stateAtMatchDate, session);
      assert.equal(committed.activeMatch, null);
      assert.equal(committed.manager.matchesPlayed, 1);

      const committedFix = committed.fixtures.find((f) => f.id === userFixture.id);
      assert.ok(committedFix && committedFix.played === true, 'Fixture not marked played');
      assert.equal(committedFix.homeGoals, session.homeGoals);
      assert.equal(committedFix.awayGoals, session.awayGoals);

      const table = committed.standings[userFixture.leagueId];
      const homeRow = table.find((r) => r.clubId === userFixture.homeClubId);
      const awayRow = table.find((r) => r.clubId === userFixture.awayClubId);
      assert.equal(homeRow.played, 1);
      assert.equal(awayRow.played, 1);

      const newBalance = committed.clubs[userClubId].finances.balance;
      assert.ok(isFiniteNum(newBalance), 'Club balance became NaN after commitMatchResult');
      if (userFixture.homeClubId === userClubId) {
        assert.ok(newBalance > prevBalance, 'Home gate receipts did not increase balance');
      }

      // Verify subbed-in player got subAppearances === 1 (not starter appearances!)
      const subInAfter = committed.players[subInPlayerId];
      assert.equal(
        subInAfter.seasonStats.subAppearances,
        1,
        `Subbed-on player ${subInAfter.name} should have subAppearances=1, got subAppearances=${subInAfter.seasonStats.subAppearances}, appearances=${subInAfter.seasonStats.appearances}`
      );
      assert.equal(
        subInAfter.seasonStats.appearances,
        0,
        `Subbed-on player ${subInAfter.name} should have appearances=0, got ${subInAfter.seasonStats.appearances}`
      );

      // Verify subbed-out starter got appearances === 1, subAppearances === 0
      const subOutAfter = committed.players[subOutPlayerId];
      assert.equal(subOutAfter.seasonStats.appearances, 1, `Subbed-off starter should have appearances=1`);
      assert.equal(subOutAfter.seasonStats.subAppearances, 0, `Subbed-off starter should have subAppearances=0`);

      structuredClone(committed);

      return `${session.homeGoals}-${session.awayGoals} in ${ticks} ticks (${leadSegments} lead / ${analystSegments} analyst segs, ${changedRatings} ratings updated)`;
    });

    // -------------------------------------------------------------------------
    // 4. CALENDAR PROGRESSION (advanceOneDay)
    // -------------------------------------------------------------------------
    console.log('\n[4] Multi-League Calendar Progression (advanceOneDay)');

    await runCheck('advanceOneDay simulates multi-league matchdays cleanly & stops on user matchday', () => {
      let cur = baseState;
      let daysAdvanced = 0;
      let stoppedOnUserMatch = null;

      while (daysAdvanced < 30) {
        const res = seasonMod.advanceOneDay(cur);
        cur = res.nextState;
        daysAdvanced++;
        if (res.userMatchToday) {
          stoppedOnUserMatch = res.userMatchToday;
          assert.equal(res.stopReason, 'matchday');
          assert.equal(res.userMatchToday.played, false, 'User match should remain unplayed on matchday');
          break;
        }
      }

      assert.ok(stoppedOnUserMatch, 'Did not reach user matchday within 30 days');

      // Check AI matches played across all 18 leagues with 0 orphaned past AI fixtures
      const playedFixtures = cur.fixtures.filter((f) => f.played);
      const leaguesWithPlayed = new Set(playedFixtures.map((f) => f.leagueId));
      const orphanedAiFixtures = cur.fixtures.filter(
        (f) =>
          !f.played &&
          f.date <= cur.currentDate &&
          f.homeClubId !== userClubId &&
          f.awayClubId !== userClubId
      );
      assert.equal(
        orphanedAiFixtures.length,
        0,
        `Found ${orphanedAiFixtures.length} unplayed past AI fixtures on/before ${cur.currentDate}`
      );
      assert.ok(playedFixtures.length >= 100, `Expected >=100 AI fixtures played across Round 1, got ${playedFixtures.length}`);
      assert.equal(leaguesWithPlayed.size, 18, `Expected all 18 leagues to play Round 1, got ${leaguesWithPlayed.size}`);

      // Verify standings & club finances have zero NaN
      for (const lid of leaguesWithPlayed) {
        const rows = cur.standings[lid];
        assert.ok(rows.some((r) => r.played > 0), `Standings not updated for ${lid}`);
        for (const r of rows) {
          assert.ok(isFiniteNum(r.points) && isFiniteNum(r.goalDifference), `NaN in standings ${lid}`);
        }
      }
      assert.ok(isFiniteNum(cur.clubs[userClubId].finances.balance), 'User club balance became NaN');
      structuredClone(cur);

      return `Advanced ${daysAdvanced}d to ${cur.currentDate}, stopped on user matchday; ${playedFixtures.length} AI fixtures across ${leaguesWithPlayed.size} leagues`;
    });

    // -------------------------------------------------------------------------
    // 5. TRANSFERS & CONTRACTS (CLUB PLAYERS & FREE AGENTS)
    // -------------------------------------------------------------------------
    console.log('\n[5] Transfer & Contract Negotiation Engine');

    await runCheck('evaluateTransferOffer returns rejected, countered & accepted states', () => {
      const buyingClub = db.clubs[userClubId];
      // Pick a club player at a different club with reasonable valuation
      const targetPlayer = Object.values(db.players).find(
        (p) => p.clubId !== null && p.clubId !== userClubId && p.value >= 1_000_000 && !p.releaseClause
      );
      assert.ok(targetPlayer && targetPlayer.clubId, 'No club target player found');
      const sellingClub = db.clubs[targetPlayer.clubId];

      const makeOffer = (fee) => ({
        id: 'test-offer',
        playerId: targetPlayer.id,
        fromClubId: buyingClub.id,
        toClubId: sellingClub.id,
        fee,
        sellOnPercent: 0,
        status: 'pending',
        createdDate: '2026-08-01',
      });

      const lowRes = seasonMod.evaluateTransferOffer(makeOffer(Math.round(targetPlayer.value * 0.25)), targetPlayer, sellingClub, buyingClub);
      assert.equal(lowRes.status, 'rejected', `Expected lowball bid rejected, got ${lowRes.status}`);

      // Binary search or scan multiplier to hit countered range
      let counterRes = null;
      for (const mult of [0.85, 1.0, 1.15, 1.35, 1.6, 2.0]) {
        const res = seasonMod.evaluateTransferOffer(makeOffer(Math.round(targetPlayer.value * mult)), targetPlayer, sellingClub, buyingClub);
        if (res.status === 'countered') {
          counterRes = res;
          break;
        }
      }
      assert.ok(counterRes && isFiniteNum(counterRes.counterFee) && counterRes.counterFee > 0, 'Did not produce a valid counter-offer');

      const highRes = seasonMod.evaluateTransferOffer(makeOffer(Math.round(counterRes.counterFee * 1.15)), targetPlayer, sellingClub, buyingClub);
      assert.equal(highRes.status, 'accepted', `Expected generous bid accepted, got ${highRes.status}`);

      // Release clause automatic acceptance
      const clausePlayer = { ...targetPlayer, releaseClause: 10_000_000 };
      const clauseRes = seasonMod.evaluateTransferOffer(makeOffer(10_000_000), clausePlayer, sellingClub, buyingClub);
      assert.equal(clauseRes.status, 'accepted', 'Release clause did not trigger automatic acceptance');

      return `rejected / countered (€${(counterRes.counterFee / 1e6).toFixed(1)}M) / accepted / release-clause verified`;
    });

    await runCheck('evaluateContractOffer handles both club players and free agents (clubId === null)', () => {
      const club = db.clubs[userClubId];

      // 1. Club player
      const clubPlayer = Object.values(db.players).find(
        (p) => p.clubId !== null && p.clubId !== userClubId && p.reputation <= club.reputation + 500
      );
      assert.ok(clubPlayer, 'No suitable club player found');

      const lowClubContract = seasonMod.evaluateContractOffer(
        {
          id: 'c1',
          playerId: clubPlayer.id,
          clubId: club.id,
          squadStatus: 'Important First Team',
          weeklyWage: 500,
          signingOnFee: 0,
          years: 3,
          status: 'pending',
        },
        clubPlayer,
        club
      );
      assert.equal(lowClubContract.accepted, false);
      assert.ok(isFiniteNum(lowClubContract.counterWage) && lowClubContract.counterWage > 500, 'Expected counterWage for club player');

      const highClubContract = seasonMod.evaluateContractOffer(
        {
          id: 'c2',
          playerId: clubPlayer.id,
          clubId: club.id,
          squadStatus: 'Important First Team',
          weeklyWage: Math.round(lowClubContract.counterWage * 1.15),
          signingOnFee: 100_000,
          years: 3,
          status: 'pending',
        },
        clubPlayer,
        club
      );
      assert.equal(highClubContract.accepted, true, `Expected counter-matched offer accepted: ${highClubContract.message}`);

      // 2. Free agent (clubId === null)
      const freeAgent = Object.values(db.players).find((p) => p.clubId === null);
      assert.ok(freeAgent, 'No free agent found in database');

      const lowFreeContract = seasonMod.evaluateContractOffer(
        {
          id: 'c3',
          playerId: freeAgent.id,
          clubId: club.id,
          squadStatus: 'Squad Rotation',
          weeklyWage: 250,
          signingOnFee: 0,
          years: 2,
          status: 'pending',
        },
        freeAgent,
        club
      );
      assert.equal(lowFreeContract.accepted, false);
      assert.ok(isFiniteNum(lowFreeContract.counterWage) && lowFreeContract.counterWage > 250, 'Expected counterWage for free agent');

      const highFreeContract = seasonMod.evaluateContractOffer(
        {
          id: 'c4',
          playerId: freeAgent.id,
          clubId: club.id,
          squadStatus: 'Important First Team',
          weeklyWage: Math.round(lowFreeContract.counterWage * 1.2),
          signingOnFee: 50_000,
          years: 2,
          status: 'pending',
        },
        freeAgent,
        club
      );
      assert.equal(highFreeContract.accepted, true, `Expected free agent offer accepted: ${highFreeContract.message}`);

      return `Club player (${clubPlayer.shortName}) & Free Agent (${freeAgent.name}) counter + accept verified`;
    });

    // -------------------------------------------------------------------------
    // 6. TACTICS WIB/WOB & BACKGROUND FALLBACK HELPERS
    // -------------------------------------------------------------------------
    console.log('\n[6] Tactics WIB/WOB Lookup & Background Service Null-Safety');

    await runCheck('getZoneCoordinates uses row 0..4, col 0..4 ("row-col") and stays in bounds', () => {
      const club = db.clubs[userClubId];
      for (let r = 0; r < 5; r++) {
        for (let c = 0; c < 5; c++) {
          const wib = tacticsMod.getZoneCoordinates(club.tactics, true, r, c);
          const wob = tacticsMod.getZoneCoordinates(club.tactics, false, r, c);
          assert.equal(wib.length, 11);
          assert.equal(wob.length, 11);
          assert.deepEqual(wib, club.tactics.wibWobGrid.withBall[`${r}-${c}`]);
          assert.deepEqual(wob, club.tactics.wibWobGrid.withoutBall[`${r}-${c}`]);
        }
      }
      const strength = tacticsMod.computeTacticalStrength(club.tactics, db.players);
      for (const k of ['attack', 'midfield', 'defense', 'goalkeeper', 'cohesion', 'width', 'pressingBonus']) {
        assert.ok(isFiniteNum(strength[k]), `NaN tactical strength.${k}`);
      }
      const overall = attrMod.calculateOverallRating(Object.values(db.players)[0]);
      assert.ok(isFiniteNum(overall) && overall >= 1 && overall <= 99);
      return 'All 50 zone lookups + tactical strength verified';
    });

    await runCheck('buildFallbackSvgDataUrl handles club & free-agent contexts safely', () => {
      const clubSvg = bgMod.buildFallbackSvgDataUrl({
        kind: 'club',
        slug: 'club-arsenal',
        title: 'Arsenal',
        subtitle: 'Emirates Stadium',
        primaryQuery: 'Emirates Stadium',
        fallbackQueries: [],
        accentColor: '#EF0107',
        secondaryColor: '#FFFFFF',
      });
      const freeAgentSvg = bgMod.buildFallbackSvgDataUrl({
        kind: 'player',
        slug: 'free-agent-ita',
        title: 'Free Agent Star',
        subtitle: 'Free Agent',
        primaryQuery: 'Free Agent Star footballer',
        fallbackQueries: [],
        accentColor: '#1d4ed8',
      });
      assert.ok(clubSvg.startsWith('data:image/svg+xml'));
      assert.ok(freeAgentSvg.startsWith('data:image/svg+xml'));
      return 'Club & free-agent fallback SVGs generated cleanly';
    });
  } finally {
    await vite.close();
  }

  console.log(`\n=== SUMMARY: ${results.length - failedCount}/${results.length} checks passed, ${failedCount} failed ===`);
  if (failedCount > 0) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
