/**
 * Championship Manager 01/02 — Minute-by-Minute Match Engine & O(1) Quick Simulator
 * Implements MatchEngineModule from src/types/contracts.ts
 */

import type { MatchEngineModule, MatchTickResult } from '../types/contracts';
import type {
  Club,
  CommentaryFlashMode,
  CommentarySegment,
  Fixture,
  FixtureCard,
  FixtureGoal,
  GameState,
  LivePlayerMatchStat,
  MatchEvent,
  MatchEventType,
  MatchSessionState,
  MatchTeamStats,
  Player,
  RadarPlayerDot,
  TacticalSlot,
  TacticsState,
} from '../types/game';
import { calculatePositionRating, getPositionCategory } from './attributes';
import {
  autoPickLineup,
  computeTacticalStrength,
  getZoneCoordinates,
  RUN_ARROW_VECTORS,
} from './tactics';

const REFEREE_POOL: Record<string, string[]> = {
  England: ['Michael Oliver', 'Anthony Taylor', 'Chris Kavanagh', 'Simon Hooper', 'Robert Jones'],
  Spain: ['Jesús Gil Manzano', 'José María Sánchez', 'Alejandro Hernández', 'Ricardo de Burgos'],
  Italy: ['Marco Guida', 'Maurizio Mariani', 'Davide Massa', 'Simone Sozza'],
  Germany: ['Felix Zwayer', 'Daniel Siebert', 'Sascha Stegemann', 'Tobias Stieler'],
  France: ['Clément Turpin', 'François Letexier', 'Benoît Bastien', 'Jérôme Brisard'],
  Slovenia: ['Slavko Vinčić', 'Matej Jug', 'Rade Obrenović', 'David Šmajc'],
  Netherlands: ['Danny Makkelie', 'Serdar Gözübüyük', 'Allard Lindhout'],
  Portugal: ['Artur Soares Dias', 'João Pinheiro', 'Luís Godinho'],
  Scotland: ['John Beaton', 'Nick Walsh', 'Don Robertson'],
  Belgium: ['Erik Lambrechts', 'Lawrence Visser', 'Jasper Vergoote'],
  Croatia: ['Igor Pajač', 'Duje Strukan', 'Patrik Kolarić'],
  Austria: ['Harald Lechner', 'Sebastian Gishamer', 'Julian Weinberger'],
  Turkey: ['Halil Umut Meler', 'Atilla Karaoğlan', 'Arda Kardeşler'],
  Default: ['Szymon Marciniak', 'István Kovács', 'Glenn Nyberg', 'Espen Eskås', 'Slavko Vinčić'],
};

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function emptyTeamStats(): MatchTeamStats {
  return {
    possession: 50,
    shots: 0,
    shotsOnTarget: 0,
    corners: 0,
    fouls: 0,
    yellowCards: 0,
    redCards: 0,
    tacklesWon: 0,
    passesCompleted: 0,
    passesAttempted: 0,
    xg: 0,
  };
}

function cloneTactics(t: TacticsState): TacticsState {
  const withBall: Record<string, Array<{ x: number; y: number }>> = {};
  const withoutBall: Record<string, Array<{ x: number; y: number }>> = {};
  for (const k of Object.keys(t.wibWobGrid.withBall)) {
    withBall[k] = t.wibWobGrid.withBall[k].map((p) => ({ x: p.x, y: p.y }));
  }
  for (const k of Object.keys(t.wibWobGrid.withoutBall)) {
    withoutBall[k] = t.wibWobGrid.withoutBall[k].map((p) => ({ x: p.x, y: p.y }));
  }
  return {
    ...t,
    startingXI: t.startingXI.map((s) => ({ ...s })),
    bench: [...t.bench],
    wibWobGrid: { withBall, withoutBall },
    instructions: { ...t.instructions },
  };
}

function generateWeather(
  isoDate: string,
  country: string
): { weather: MatchSessionState['weather']; temperatureC: number } {
  const month = Number.parseInt(isoDate.slice(5, 7), 10) || 9;
  const southern = ['Spain', 'Italy', 'Portugal', 'Turkey', 'Croatia'].includes(country);
  const northern = ['England', 'Scotland', 'Germany', 'Netherlands', 'Belgium', 'Austria'].includes(
    country
  );

  let baseTemp = 16;
  if (month === 8 || month === 9) baseTemp = southern ? 25 : 19;
  else if (month === 10 || month === 4 || month === 5) baseTemp = southern ? 19 : 14;
  else if (month === 11 || month === 3) baseTemp = southern ? 14 : 9;
  else baseTemp = southern ? 11 : 4;

  const temp = clamp(baseTemp + randInt(-3, 4), -2, 33);
  const r = Math.random();
  let weather: MatchSessionState['weather'] = 'Clear';
  if (temp <= 1 && northern && r < 0.28) weather = 'Snow';
  else if (r < (northern ? 0.16 : 0.08)) weather = 'Heavy Rain';
  else if (r < (northern ? 0.38 : 0.22)) weather = 'Light Rain';
  else if (r < 0.56) weather = 'Overcast';
  else if (r < 0.7) weather = 'Breezy';

  return { weather, temperatureC: temp };
}

function estimateAttendance(homeClub: Club, awayClub: Club): number {
  const cap = Math.max(1500, homeClub.stadium.capacity);
  const repAvg = (homeClub.reputation + awayClub.reputation) / 2;
  const isDerby = homeClub.rivals.includes(awayClub.id) || awayClub.rivals.includes(homeClub.id);
  const baseFill = clamp(0.62 + (repAvg / 10000) * 0.34 + (isDerby ? 0.1 : 0), 0.52, 0.995);
  const jitter = (Math.random() - 0.5) * 0.06;
  return Math.round(cap * clamp(baseFill + jitter, 0.45, 0.998));
}

function tacticsToRadar(
  tx: number,
  ty: number,
  side: 'home' | 'away'
): { x: number; y: number } {
  if (side === 'home') {
    return { x: clamp(100 - ty, 3, 97), y: clamp(tx, 4, 96) };
  }
  return { x: clamp(ty, 3, 97), y: clamp(100 - tx, 4, 96) };
}

function radarBallToWibZone(
  ballX: number,
  ballY: number,
  side: 'home' | 'away'
): { row: number; col: number } {
  if (side === 'home') {
    const row = clamp(Math.floor((100 - ballX) / 20), 0, 4);
    const col = clamp(Math.floor(ballY / 20), 0, 4);
    return { row, col };
  }
  const row = clamp(Math.floor(ballX / 20), 0, 4);
  const col = clamp(Math.floor((100 - ballY) / 20), 0, 4);
  return { row, col };
}

function makeSegment(
  eventId: string,
  idx: number,
  speaker: 'lead' | 'analyst',
  text: string,
  excitement: number,
  teamSide: 'home' | 'away' | 'neutral',
  flashMode: CommentaryFlashMode
): CommentarySegment {
  return {
    id: `${eventId}-seg-${idx}`,
    speaker,
    text,
    excitement: clamp(Math.round(excitement), 1, 10),
    teamSide,
    flashMode,
  };
}

/**
 * Normalizes event timestamps so stoppage-time events stay anchored to 45' (1st half)
 * or 90' (2nd half) while encoding exact stoppage minutes in `second` (`over * 60 + sec`).
 * Keeps FixtureGoal/FixtureCard minutes strictly chronological and lets MatchDayView render 45'+N / 90'+N.
 */
function resolveEventClock(
  phase: MatchSessionState['phase'],
  rawMinute: number,
  rawSecond: number
): { minute: number; second: number; idTag: string } {
  const sec = clamp(Math.floor(rawSecond), 0, 59);
  if (phase === 'first_half' && rawMinute > 45) {
    const over = rawMinute - 45;
    return { minute: 45, second: over * 60 + sec, idTag: `45+${over}` };
  }
  if (phase === 'second_half' && rawMinute > 90) {
    const over = rawMinute - 90;
    return { minute: 90, second: over * 60 + sec, idTag: `90+${over}` };
  }
  const clampedMin = Math.max(1, rawMinute);
  return { minute: clampedMin, second: sec, idTag: String(clampedMin) };
}

function getEffectiveAttr(
  player: Player,
  rawAttr: number,
  stat?: LivePlayerMatchStat
): number {
  const cond = stat ? stat.condition : player.condition;
  const fatigueMult = 0.68 + 0.32 * (clamp(cond, 20, 100) / 100);
  return rawAttr * fatigueMult;
}

function getGoalkeeperRating(player: Player, stat?: LivePlayerMatchStat): number {
  const gk = player.attributes.goalkeeping;
  const raw = gk
    ? gk.reflexes * 0.3 +
      gk.handling * 0.25 +
      gk.oneOnOnes * 0.22 +
      gk.positioning * 0.23
    : player.attributes.physical.agility * 0.35 +
      player.attributes.mental.anticipation * 0.35 +
      player.attributes.mental.decisions * 0.3;
  return getEffectiveAttr(player, raw, stat);
}

function adjustRating(
  statsMap: Record<string, LivePlayerMatchStat>,
  playerId: string | undefined,
  delta: number
): void {
  if (!playerId) return;
  const st = statsMap[playerId];
  if (!st) return;
  st.rating = round1(clamp(st.rating + delta, 3.5, 10.0));
}

function computeTargetRadarPositions(
  tactics: TacticsState,
  side: 'home' | 'away',
  hasBall: boolean,
  ballX: number,
  ballY: number
): Array<{ x: number; y: number }> {
  const { row, col } = radarBallToWibZone(ballX, ballY, side);
  const zoneCoords = getZoneCoordinates(tactics, hasBall, row, col);
  const ins = tactics.instructions;

  // Mentality vertical shift on tactics pitch (smaller y = further forward)
  let mentalityShiftY = 0;
  if (ins.mentality === 'Defending') mentalityShiftY = 6;
  else if (ins.mentality === 'Attacking') mentalityShiftY = -5;
  else if (ins.mentality === 'Gung Ho') mentalityShiftY = -10;
  if (ins.menBehindBall && !hasBall) mentalityShiftY += 7;
  if (ins.pressing && !hasBall) mentalityShiftY -= 4;

  return tactics.startingXI.map((slot, idx) => {
    const z = zoneCoords[idx] ?? { x: slot.baseX, y: slot.baseY };
    if (idx === 0 || slot.roleLabel === 'GK') {
      return tacticsToRadar(z.x, z.y, side);
    }
    const arrow = hasBall ? RUN_ARROW_VECTORS[slot.runArrow] ?? { dx: 0, dy: 0 } : { dx: 0, dy: 0 };
    const tx = clamp(z.x + arrow.dx * 0.35, 5, 95);
    const ty = clamp(z.y + mentalityShiftY + arrow.dy * 0.4, 6, 91);
    return tacticsToRadar(tx, ty, side);
  });
}

function ensureValidLineup(
  club: Club,
  allPlayers: Record<string, Player>,
  isUserClub: boolean
): TacticsState {
  const cloned = cloneTactics(club.tactics);
  const hasInvalidSlot = cloned.startingXI.some((s) => {
    if (!s.playerId) return true;
    const p = allPlayers[s.playerId];
    if (!p) return true;
    if (!isUserClub && (p.injury !== null || p.suspendedMatches > 0)) return true;
    return false;
  });

  if (!hasInvalidSlot && cloned.startingXI.length === 11) {
    return cloned;
  }

  const clubSquad: Player[] = [];
  for (const id in allPlayers) {
    const p = allPlayers[id];
    if (p.clubId === club.id) clubSquad.push(p);
  }
  return autoPickLineup(cloned, clubSquad);
}

export function createMatchSession(fixture: Fixture, state: GameState): MatchSessionState {
  const homeClub = state.clubs[fixture.homeClubId];
  const awayClub = state.clubs[fixture.awayClubId];

  const userSide: MatchSessionState['userSide'] =
    fixture.homeClubId === state.userClubId
      ? 'home'
      : fixture.awayClubId === state.userClubId
      ? 'away'
      : 'neutral';

  const homeTactics = ensureValidLineup(homeClub, state.players, userSide === 'home');
  const awayTactics = ensureValidLineup(awayClub, state.players, userSide === 'away');

  const playerStats: Record<string, LivePlayerMatchStat> = {};
  const initPlayerStat = (pid: string | null) => {
    if (!pid || playerStats[pid]) return;
    const p = state.players[pid];
    playerStats[pid] = {
      playerId: pid,
      rating: 6.5,
      goals: 0,
      assists: 0,
      shots: 0,
      passes: 0,
      tackles: 0,
      saves: 0,
      yellowCards: 0,
      redCard: false,
      condition: clamp(p ? p.condition : 92, 45, 100),
    };
  };

  for (const s of homeTactics.startingXI) initPlayerStat(s.playerId);
  for (const b of homeTactics.bench) initPlayerStat(b);
  for (const s of awayTactics.startingXI) initPlayerStat(s.playerId);
  for (const b of awayTactics.bench) initPlayerStat(b);

  // Build initial 22 kickoff radar dots (each team strictly on their own half)
  const radarPlayers: RadarPlayerDot[] = [];
  const pushDots = (tactics: TacticsState, side: 'home' | 'away') => {
    tactics.startingXI.forEach((slot, idx) => {
      if (!slot.playerId) return;
      const p = state.players[slot.playerId];
      const base = tacticsToRadar(slot.baseX, slot.baseY, side);
      const kickoffX =
        side === 'home' ? clamp(base.x * 0.56, 5, 48.5) : clamp(50 + (base.x - 50) * 0.56, 51.5, 95);
      radarPlayers.push({
        playerId: slot.playerId,
        shirtNumber: p?.squadNumber ?? idx + 1,
        shortName: p?.shortName ?? slot.roleLabel,
        side,
        x: round1(kickoffX),
        y: round1(base.y),
        hasBall: side === 'home' && idx === 10,
        sentOff: false,
      });
    });
  };

  pushDots(homeTactics, 'home');
  pushDots(awayTactics, 'away');

  const { weather, temperatureC } = generateWeather(fixture.date, homeClub.country);
  const refs = REFEREE_POOL[homeClub.country] ?? REFEREE_POOL.Default;

  return {
    fixtureId: fixture.id,
    leagueId: fixture.leagueId,
    homeClubId: fixture.homeClubId,
    awayClubId: fixture.awayClubId,
    userSide,
    phase: 'pre_match',
    minute: 0,
    second: 0,
    addedTime: 0,
    paused: true,
    speed: 6,
    commentaryFrequency: 'extended',
    homeGoals: 0,
    awayGoals: 0,
    possessionSide: 'home',
    ballX: 50,
    ballY: 50,
    zoneRow: 2,
    zoneCol: 2,
    homeTactics,
    awayTactics,
    homeSubsUsed: 0,
    awaySubsUsed: 0,
    maxSubs: 5,
    homeStats: emptyTeamStats(),
    awayStats: emptyTeamStats(),
    playerStats,
    radarPlayers,
    events: [],
    activeEvent: null,
    activeSegmentIndex: 0,
    attendance: estimateAttendance(homeClub, awayClub),
    weather,
    temperatureC,
    refereeName: pick(refs),
    goals: [],
    cards: [],
    possessionTicksHome: 1,
    possessionTicksAway: 1,
  };
}

interface ActiveSlotPlayer {
  slotIndex: number;
  slot: TacticalSlot;
  player: Player;
  stat: LivePlayerMatchStat;
  radarX: number;
  radarY: number;
}

function collectActivePlayers(
  tactics: TacticsState,
  side: 'home' | 'away',
  hasBall: boolean,
  ballX: number,
  ballY: number,
  players: Record<string, Player>,
  playerStats: Record<string, LivePlayerMatchStat>
): ActiveSlotPlayer[] {
  const targets = computeTargetRadarPositions(tactics, side, hasBall, ballX, ballY);
  const list: ActiveSlotPlayer[] = [];
  for (let i = 0; i < tactics.startingXI.length; i++) {
    const slot = tactics.startingXI[i];
    if (!slot.playerId) continue;
    const player = players[slot.playerId];
    const stat = playerStats[slot.playerId];
    if (!player || !stat || stat.redCard) continue;
    list.push({
      slotIndex: i,
      slot,
      player,
      stat,
      radarX: targets[i].x,
      radarY: targets[i].y,
    });
  }
  return list;
}

function pickWeightedPlayer(
  pool: ActiveSlotPlayer[],
  weightFn: (item: ActiveSlotPlayer) => number
): ActiveSlotPlayer {
  let total = 0;
  const weights = pool.map((item) => {
    const w = Math.max(0.05, weightFn(item));
    total += w;
    return w;
  });
  let r = Math.random() * total;
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i];
    if (r <= 0) return pool[i];
  }
  return pool[pool.length - 1];
}

function findHighestRatedPlayer(
  playerStats: Record<string, LivePlayerMatchStat>,
  players: Record<string, Player>,
  allowedIds?: Set<string>
): { player: Player; stat: LivePlayerMatchStat } | null {
  let best: { player: Player; stat: LivePlayerMatchStat } | null = null;
  for (const pid in playerStats) {
    if (allowedIds && !allowedIds.has(pid)) continue;
    const st = playerStats[pid];
    const p = players[pid];
    if (!p) continue;
    if (!best || st.rating > best.stat.rating) {
      best = { player: p, stat: st };
    }
  }
  return best;
}

function updateRadarSmoothly(
  radarPlayers: RadarPlayerDot[],
  homeTactics: TacticsState,
  awayTactics: TacticsState,
  possessionSide: 'home' | 'away',
  ballX: number,
  ballY: number,
  carrierId: string | undefined,
  playerStats: Record<string, LivePlayerMatchStat>
): RadarPlayerDot[] {
  const homeTargets = computeTargetRadarPositions(
    homeTactics,
    'home',
    possessionSide === 'home',
    ballX,
    ballY
  );
  const awayTargets = computeTargetRadarPositions(
    awayTactics,
    'away',
    possessionSide === 'away',
    ballX,
    ballY
  );

  const slotIndexById = new Map<string, { side: 'home' | 'away'; idx: number }>();
  homeTactics.startingXI.forEach((s, idx) => {
    if (s.playerId) slotIndexById.set(s.playerId, { side: 'home', idx });
  });
  awayTactics.startingXI.forEach((s, idx) => {
    if (s.playerId) slotIndexById.set(s.playerId, { side: 'away', idx });
  });

  return radarPlayers.map((dot) => {
    const st = playerStats[dot.playerId];
    if (st?.redCard) {
      return { ...dot, hasBall: false, sentOff: true };
    }
    const info = slotIndexById.get(dot.playerId);
    if (!info) return { ...dot, hasBall: false };

    const target = info.side === 'home' ? homeTargets[info.idx] : awayTargets[info.idx];
    let tx = target.x;
    let ty = target.y;

    const isCarrier = dot.playerId === carrierId;
    if (isCarrier) {
      tx = clamp(ballX + (Math.random() - 0.5) * 2.5, 4, 96);
      ty = clamp(ballY + (Math.random() - 0.5) * 2.5, 5, 95);
    } else if (info.idx > 0) {
      // Subtle organic attraction toward the ball when nearby
      const dist = Math.hypot(tx - ballX, ty - ballY);
      if (dist < 28) {
        const pull = (1 - dist / 28) * 0.24;
        tx = clamp(tx + (ballX - tx) * pull + (Math.random() - 0.5) * 2.4, 4, 96);
        ty = clamp(ty + (ballY - ty) * pull + (Math.random() - 0.5) * 2.4, 5, 95);
      } else {
        tx = clamp(tx + (Math.random() - 0.5) * 2.0, 4, 96);
        ty = clamp(ty + (Math.random() - 0.5) * 2.0, 5, 95);
      }
    }

    // Smooth lerp (0.52) so players glide crisply between WIB/WOB shapes each tick
    const nextX = round1(dot.x + (tx - dot.x) * 0.54);
    const nextY = round1(dot.y + (ty - dot.y) * 0.54);

    return {
      ...dot,
      x: clamp(nextX, 3, 97),
      y: clamp(nextY, 4, 96),
      hasBall: isCarrier,
      sentOff: false,
    };
  });
}

function tryAiSubstitution(
  session: MatchSessionState,
  side: 'home' | 'away',
  players: Record<string, Player>,
  clubs: Record<string, Club>
): MatchEvent | null {
  const subsUsed = side === 'home' ? session.homeSubsUsed : session.awaySubsUsed;
  if (subsUsed >= Math.min(4, session.maxSubs)) return null;
  if (session.minute < 58 || session.minute > 87) return null;

  const tactics = side === 'home' ? session.homeTactics : session.awayTactics;
  if (tactics.bench.length === 0) return null;

  // Find tired, injured, booked-aggressive, or struggling outfield starter
  let outIdx = -1;
  let urgency = 0;
  for (let i = 1; i < tactics.startingXI.length; i++) {
    const pid = tactics.startingXI[i].playerId;
    if (!pid) continue;
    const st = session.playerStats[pid];
    if (!st || st.redCard) continue;
    let score = 0;
    if (st.injured) score += 100;
    if (st.condition < 64) score += (66 - st.condition) * 1.4;
    if (st.rating < 5.9) score += (6.0 - st.rating) * 14;
    if (st.yellowCards > 0 && (players[pid]?.attributes.mental.aggression ?? 10) >= 15) {
      score += 10;
    }
    if (score > urgency) {
      urgency = score;
      outIdx = i;
    }
  }

  if (outIdx < 0 || (urgency < 14 && Math.random() > 0.14)) return null;
  if (urgency < 80 && Math.random() > 0.34) return null;

  const outSlot = tactics.startingXI[outIdx];
  const outPlayerId = outSlot.playerId;
  if (!outPlayerId) return null;

  // Pick best positional replacement from bench
  let bestBenchId: string | null = null;
  let bestBenchScore = -1;
  for (const bid of tactics.bench) {
    const bp = players[bid];
    const bst = session.playerStats[bid];
    if (!bp || bst?.subbedOffMinute !== undefined || bst?.redCard) continue;
    if (bp.positions[0] === 'GK') continue;
    const fit = calculatePositionRating(bp, outSlot.roleLabel);
    if (fit > bestBenchScore) {
      bestBenchScore = fit;
      bestBenchId = bid;
    }
  }

  if (!bestBenchId) return null;

  const outPlayer = players[outPlayerId];
  const inPlayer = players[bestBenchId];
  const club = side === 'home' ? clubs[session.homeClubId] : clubs[session.awayClubId];

  outSlot.playerId = bestBenchId;
  tactics.bench = tactics.bench.filter((id) => id !== bestBenchId);
  if (side === 'home') session.homeSubsUsed += 1;
  else session.awaySubsUsed += 1;

  if (session.playerStats[outPlayerId]) {
    session.playerStats[outPlayerId].subbedOffMinute = session.minute;
  }
  if (!session.playerStats[bestBenchId]) {
    session.playerStats[bestBenchId] = {
      playerId: bestBenchId,
      rating: 6.5,
      goals: 0,
      assists: 0,
      shots: 0,
      passes: 0,
      tackles: 0,
      saves: 0,
      yellowCards: 0,
      redCard: false,
      condition: clamp(inPlayer?.condition ?? 96, 70, 100),
      subbedOnMinute: session.minute,
    };
  } else {
    session.playerStats[bestBenchId].subbedOnMinute = session.minute;
  }

  // Update radar dot cleanly
  session.radarPlayers = session.radarPlayers.map((dot) =>
    dot.playerId === outPlayerId
      ? {
          ...dot,
          playerId: bestBenchId!,
          shirtNumber: inPlayer?.squadNumber ?? dot.shirtNumber,
          shortName: inPlayer?.shortName ?? 'Sub',
          hasBall: false,
        }
      : dot
  );

  const eventId = `ev-${session.minute}-${session.events.length + 1}`;
  const outCond = Math.round(session.playerStats[outPlayerId]?.condition ?? 60);
  const outRating = (session.playerStats[outPlayerId]?.rating ?? 6.5).toFixed(1);

  const leadText = pick([
    `Substitution for ${club.shortName}: ${inPlayer?.name ?? 'Fresh legs'} comes on to replace ${outPlayer?.name ?? 'the tiring starter'}.`,
    `Change on the touchline by ${club.managerName} — ${outPlayer?.shortName ?? 'the midfielder'} heads off and ${inPlayer?.name ?? 'a substitute'} trots onto the pitch.`,
    `${club.shortName} turn to their bench in the ${session.minute}th minute: ${inPlayer?.name ?? 'fresh legs'} enters the fray for ${outPlayer?.shortName ?? 'his teammate'}.`,
  ]);

  const analystText = session.playerStats[outPlayerId]?.injured
    ? `Forced change there — ${outPlayer?.shortName} couldn't shake off that knock. ${inPlayer?.shortName} steps straight into the ${outSlot.roleLabel} role.`
    : `Sensible management. ${outPlayer?.shortName} was down to ${outCond}% fitness after posting a ${outRating} rating — ${inPlayer?.shortName} brings fresh legs into this ${tactics.formation}.`;

  return {
    id: eventId,
    minute: session.minute,
    second: randInt(0, 45),
    type: 'substitution',
    teamSide: side,
    clubId: club.id,
    primaryPlayerId: bestBenchId,
    secondaryPlayerId: outPlayerId,
    ballX: session.ballX,
    ballY: session.ballY,
    zoneRow: session.zoneRow,
    zoneCol: session.zoneCol,
    excitementLevel: 5,
    isKeyHighlight: true,
    segments: [
      makeSegment(eventId, 0, 'lead', leadText, 5, side, 'pulse'),
      makeSegment(eventId, 1, 'analyst', analystText, 4, side, 'none'),
    ],
  };
}

export function stepMatchTick(
  session: MatchSessionState,
  players: Record<string, Player>,
  clubs: Record<string, Club>
): MatchTickResult {
  if (session.phase === 'full_time') {
    return { nextSession: session, newEvent: null };
  }

  const homeClub = clubs[session.homeClubId];
  const awayClub = clubs[session.awayClubId];

  // Clone mutable slices cleanly
  const nextStatsMap: Record<string, LivePlayerMatchStat> = {};
  for (const pid in session.playerStats) {
    nextStatsMap[pid] = { ...session.playerStats[pid] };
  }

  const next: MatchSessionState = {
    ...session,
    homeTactics: cloneTactics(session.homeTactics),
    awayTactics: cloneTactics(session.awayTactics),
    homeStats: { ...session.homeStats },
    awayStats: { ...session.awayStats },
    playerStats: nextStatsMap,
    radarPlayers: session.radarPlayers.map((d) => ({ ...d })),
    events: [...session.events],
    goals: [...session.goals],
    cards: [...session.cards],
  };

  // ---------------- PRE-MATCH -> KICKOFF ----------------
  if (next.phase === 'pre_match') {
    next.phase = 'first_half';
    next.minute = 1;
    next.second = 0;
    next.addedTime = randInt(1, 3);
    next.paused = false;
    next.ballX = 50;
    next.ballY = 50;
    next.zoneRow = 2;
    next.zoneCol = 2;
    next.possessionSide = 'home';

    const eventId = `ev-kickoff-1`;
    const homeStarId = next.homeTactics.startingXI[10]?.playerId ?? next.homeTactics.startingXI[9]?.playerId;
    const awayStarId = next.awayTactics.startingXI[10]?.playerId ?? next.awayTactics.startingXI[9]?.playerId;
    const homeStar = homeStarId ? players[homeStarId] : undefined;
    const awayStar = awayStarId ? players[awayStarId] : undefined;

    const leadText = pick([
      `Referee ${next.refereeName} blows his whistle and we are UNDERWAY at ${homeClub.stadium.name}! ${homeClub.name} kick off against ${awayClub.name} in front of ${next.attendance.toLocaleString()} fans.`,
      `Peep! We're off under ${next.weather.toLowerCase()} skies (${next.temperatureC}°C) at ${homeClub.stadium.name} — ${homeClub.name} vs ${awayClub.name}!`,
    ]);
    const analystText = `Fascinating tactical battle ahead: ${homeClub.shortName} line up in a ${next.homeTactics.formation} (${next.homeTactics.instructions.mentality.toLowerCase()} mentality) while ${awayClub.shortName} counter with ${next.awayTactics.formation}. Keep an eye on ${homeStar?.name ?? homeClub.shortName} and ${awayStar?.name ?? awayClub.shortName} today.`;

    const ev: MatchEvent = {
      id: eventId,
      minute: 1,
      second: 0,
      type: 'kickoff',
      teamSide: 'neutral',
      ballX: 50,
      ballY: 50,
      zoneRow: 2,
      zoneCol: 2,
      excitementLevel: 6,
      isKeyHighlight: true,
      segments: [
        makeSegment(eventId, 0, 'lead', leadText, 6, 'neutral', 'pulse'),
        makeSegment(eventId, 1, 'analyst', analystText, 4, 'neutral', 'none'),
      ],
    };
    next.events.push(ev);
    next.activeEvent = ev;
    next.activeSegmentIndex = 0;
    return { nextSession: next, newEvent: ev };
  }

  // ---------------- HALF-TIME -> SECOND HALF ----------------
  if (next.phase === 'half_time') {
    next.phase = 'second_half';
    next.minute = 46;
    next.second = 0;
    next.addedTime = randInt(2, 5);
    next.paused = false;
    next.ballX = 50;
    next.ballY = 50;
    next.zoneRow = 2;
    next.zoneCol = 2;
    next.possessionSide = 'away';

    // Half-time breather recovers 4..6% condition for active starters
    for (const pid in next.playerStats) {
      const st = next.playerStats[pid];
      if (!st.redCard && st.subbedOffMinute === undefined) {
        st.condition = round1(clamp(st.condition + 5, 25, 100));
      }
    }

    const eventId = `ev-kickoff-2`;
    const leadText = `The second half is underway at ${homeClub.stadium.name}! ${awayClub.name} get the ball rolling with the score ${homeClub.shortName} ${next.homeGoals}–${next.awayGoals} ${awayClub.shortName}.`;
    const analystText =
      next.homeGoals === next.awayGoals
        ? `All square at the restart. Possession has been ${next.homeStats.possession}% to ${next.awayStats.possession}% — whoever controls midfield in the next fifteen minutes could grab this match by the scruff of the neck.`
        : `${next.homeGoals > next.awayGoals ? awayClub.shortName : homeClub.shortName} need a response now; expect their full-backs and midfielders to push higher up the pitch.`;

    const ev: MatchEvent = {
      id: eventId,
      minute: 46,
      second: 0,
      type: 'kickoff',
      teamSide: 'away',
      clubId: awayClub.id,
      ballX: 50,
      ballY: 50,
      zoneRow: 2,
      zoneCol: 2,
      excitementLevel: 5,
      isKeyHighlight: true,
      segments: [
        makeSegment(eventId, 0, 'lead', leadText, 5, 'neutral', 'pulse'),
        makeSegment(eventId, 1, 'analyst', analystText, 4, 'neutral', 'none'),
      ],
    };
    next.events.push(ev);
    next.activeEvent = ev;
    next.activeSegmentIndex = 0;
    return { nextSession: next, newEvent: ev };
  }

  // ---------------- ADVANCE MINUTE CLOCK ----------------
  next.minute += 1;
  next.second = randInt(4, 56);

  // Check Half-Time whistle
  if (next.phase === 'first_half' && next.minute > 45 + next.addedTime) {
    next.phase = 'half_time';
    next.minute = 45;
    next.second = 0;
    next.paused = true;
    next.ballX = 50;
    next.ballY = 50;

    const topPerformer = findHighestRatedPlayer(next.playerStats, players);
    const eventId = `ev-halftime`;
    const leadText = `HALF-TIME at ${homeClub.stadium.name}: ${homeClub.name} ${next.homeGoals}–${next.awayGoals} ${awayClub.name}!`;
    const analystText = `An absorbing first 45 minutes. ${homeClub.shortName} have had ${next.homeStats.possession}% possession and ${next.homeStats.shots} shots (xG ${next.homeStats.xg.toFixed(2)}), compared to ${awayClub.shortName}'s ${next.awayStats.shots} shots (xG ${next.awayStats.xg.toFixed(2)}). ${
      topPerformer
        ? `${topPerformer.player.name} has been the standout performer so far with a ${topPerformer.stat.rating.toFixed(1)} rating.`
        : 'Both managers will have plenty to discuss in the dressing room.'
    }`;

    const ev: MatchEvent = {
      id: eventId,
      minute: 45,
      second: 0,
      type: 'halftime',
      teamSide: 'neutral',
      ballX: 50,
      ballY: 50,
      zoneRow: 2,
      zoneCol: 2,
      excitementLevel: 6,
      isKeyHighlight: true,
      segments: [
        makeSegment(eventId, 0, 'lead', leadText, 6, 'neutral', 'pulse'),
        makeSegment(eventId, 1, 'analyst', analystText, 5, 'neutral', 'none'),
      ],
    };
    next.events.push(ev);
    next.activeEvent = ev;
    next.activeSegmentIndex = 0;
    return { nextSession: next, newEvent: ev };
  }

  // Check Full-Time whistle
  if (next.phase === 'second_half' && next.minute > 90 + next.addedTime) {
    next.phase = 'full_time';
    next.minute = 90;
    next.second = 0;
    next.paused = true;
    next.ballX = 50;
    next.ballY = 50;

    const motm = findHighestRatedPlayer(next.playerStats, players);
    const winnerText =
      next.homeGoals > next.awayGoals
        ? `Victory for ${homeClub.name}!`
        : next.awayGoals > next.homeGoals
        ? `A huge away triumph for ${awayClub.name}!`
        : `Honors even after a fierce 90 minutes!`;

    const eventId = `ev-fulltime`;
    const leadText = `FULL-TIME! ${homeClub.name} ${next.homeGoals}–${next.awayGoals} ${awayClub.name}! ${winnerText}`;
    const analystText = `What a contest at ${homeClub.stadium.name}. Final stats show ${homeClub.shortName} ${next.homeStats.shots} shots (${next.homeStats.xg.toFixed(2)} xG) to ${awayClub.shortName}'s ${next.awayStats.shots} shots (${next.awayStats.xg.toFixed(2)} xG). ${
      motm
        ? `My Man of the Match is ${motm.player.name} — an authoritative ${motm.stat.rating.toFixed(1)} display.`
        : ''
    }`;

    const ev: MatchEvent = {
      id: eventId,
      minute: 90,
      second: 0,
      type: 'fulltime',
      teamSide:
        next.homeGoals > next.awayGoals
          ? 'home'
          : next.awayGoals > next.homeGoals
          ? 'away'
          : 'neutral',
      ballX: 50,
      ballY: 50,
      zoneRow: 2,
      zoneCol: 2,
      excitementLevel: 9,
      isKeyHighlight: true,
      segments: [
        makeSegment(eventId, 0, 'lead', leadText, 9, 'neutral', 'pulse'),
        makeSegment(eventId, 1, 'analyst', analystText, 6, 'neutral', 'none'),
      ],
    };
    next.events.push(ev);
    next.activeEvent = ev;
    next.activeSegmentIndex = 0;
    return { nextSession: next, newEvent: ev };
  }

  // ---------------- LIVE STAMINA & CONDITION DRAIN ----------------
  const drainSide = (tactics: TacticsState) => {
    const ins = tactics.instructions;
    const pressMult = ins.pressing ? 1.32 : 0.96;
    const mentMult =
      ins.mentality === 'Gung Ho' ? 1.2 : ins.mentality === 'Attacking' ? 1.08 : 0.96;
    tactics.startingXI.forEach((slot, idx) => {
      if (!slot.playerId) return;
      const st = next.playerStats[slot.playerId];
      const p = players[slot.playerId];
      if (!st || !p || st.redCard) return;
      const staminaResist = 1.48 - (p.attributes.physical.stamina / 20) * 0.65;
      const natFitResist = 1.12 - (p.attributes.physical.naturalFitness / 20) * 0.22;
      const roleMult =
        idx === 0
          ? 0.28
          : slot.roleLabel === 'DL' ||
            slot.roleLabel === 'DR' ||
            slot.roleLabel === 'ML' ||
            slot.roleLabel === 'MR' ||
            slot.roleLabel === 'MC'
          ? 1.15
          : 0.92;
      const drain = 0.26 * staminaResist * natFitResist * roleMult * pressMult * mentMult;
      st.condition = round1(clamp(st.condition - drain, 28, 100));
    });
  };
  drainSide(next.homeTactics);
  drainSide(next.awayTactics);

  // ---------------- AI AUTOMATIC SUBSTITUTIONS ----------------
  if (next.userSide !== 'home') {
    const homeSubEv = tryAiSubstitution(next, 'home', players, clubs);
    if (homeSubEv) {
      next.events.push(homeSubEv);
      next.activeEvent = homeSubEv;
      next.activeSegmentIndex = 0;
      return { nextSession: next, newEvent: homeSubEv };
    }
  }
  if (next.userSide !== 'away') {
    const awaySubEv = tryAiSubstitution(next, 'away', players, clubs);
    if (awaySubEv) {
      next.events.push(awaySubEv);
      next.activeEvent = awaySubEv;
      next.activeSegmentIndex = 0;
      return { nextSession: next, newEvent: awaySubEv };
    }
  }

  // ---------------- ATTRIBUTE + WIB/WOB MINUTE SIMULATION ----------------
  const attSide = next.possessionSide;
  const defSide: 'home' | 'away' = attSide === 'home' ? 'away' : 'home';
  const attClub = attSide === 'home' ? homeClub : awayClub;
  const defClub = defSide === 'home' ? homeClub : awayClub;
  const attTactics = attSide === 'home' ? next.homeTactics : next.awayTactics;
  const defTactics = defSide === 'home' ? next.homeTactics : next.awayTactics;
  const attStats = attSide === 'home' ? next.homeStats : next.awayStats;
  const defStats = defSide === 'home' ? next.homeStats : next.awayStats;

  if (attSide === 'home') next.possessionTicksHome += 1;
  else next.possessionTicksAway += 1;
  const totalPossTicks = next.possessionTicksHome + next.possessionTicksAway;
  next.homeStats.possession = Math.round((next.possessionTicksHome / totalPossTicks) * 100);
  next.awayStats.possession = 100 - next.homeStats.possession;

  const attPlayers = collectActivePlayers(
    attTactics,
    attSide,
    true,
    next.ballX,
    next.ballY,
    players,
    next.playerStats
  );
  const defPlayers = collectActivePlayers(
    defTactics,
    defSide,
    false,
    next.ballX,
    next.ballY,
    players,
    next.playerStats
  );

  const attOutfield = attPlayers.filter((x) => x.slotIndex > 0);
  const defOutfield = defPlayers.filter((x) => x.slotIndex > 0);
  const defGk = defPlayers.find((x) => x.slotIndex === 0) ?? defPlayers[0];

  // Calculate local WIB/WOB zone dominance near current ball coordinates
  const calcLocalPresence = (list: ActiveSlotPlayer[], isAttacking: boolean): number => {
    let score = 0;
    for (const item of list) {
      if (item.slotIndex === 0) continue;
      const dist = Math.hypot(item.radarX - next.ballX, item.radarY - next.ballY);
      const proximity = Math.exp(-dist / 26);
      const techVal = isAttacking
        ? item.player.attributes.technical.passing * 0.35 +
          item.player.attributes.mental.creativity * 0.3 +
          item.player.attributes.technical.dribbling * 0.2 +
          item.player.attributes.mental.teamwork * 0.15
        : item.player.attributes.technical.tackling * 0.35 +
          item.player.attributes.technical.marking * 0.3 +
          item.player.attributes.mental.anticipation * 0.2 +
          item.player.attributes.mental.workRate * 0.15;
      score += proximity * getEffectiveAttr(item.player, techVal, item.stat);
    }
    return score;
  };

  const attZonePower =
    calcLocalPresence(attOutfield, true) *
    (attSide === 'home' ? 1.04 : 1.0) * // Slight home crowd boost
    (attTactics.instructions.mentality === 'Gung Ho'
      ? 1.12
      : attTactics.instructions.mentality === 'Attacking'
      ? 1.06
      : attTactics.instructions.mentality === 'Defending'
      ? 0.92
      : 1.0);

  const defZonePower =
    calcLocalPresence(defOutfield, false) *
    (defTactics.instructions.pressing ? 1.1 : 1.0) *
    (defTactics.instructions.menBehindBall ? 1.11 : 1.0) *
    (defTactics.instructions.tackling === 'Hard'
      ? 1.08
      : defTactics.instructions.tackling === 'Easy'
      ? 0.93
      : 1.0);

  const attAdv = clamp((attZonePower - defZonePower) / Math.max(12, attZonePower + defZonePower), -0.35, 0.35);

  // Pick ball carrier near ball
  const carrier = pickWeightedPlayer(attOutfield.length > 0 ? attOutfield : attPlayers, (item) => {
    const dist = Math.hypot(item.radarX - next.ballX, item.radarY - next.ballY);
    return Math.exp(-dist / 22) * (0.6 + item.player.attributes.technical.offTheBall / 25);
  });

  // Pick nearest defender contesting the carrier
  const marker = pickWeightedPlayer(defOutfield.length > 0 ? defOutfield : defPlayers, (item) => {
    const dist = Math.hypot(item.radarX - next.ballX, item.radarY - next.ballY);
    return Math.exp(-dist / 20) * (0.6 + item.player.attributes.mental.workRate / 25);
  });

  // Attacking progress toward opponent goal (0 = own goal, 100 = opponent goal)
  const attackDepth = attSide === 'home' ? next.ballX : 100 - next.ballX;
  const dir = attSide === 'home' ? 1 : -1;
  const eventClock = resolveEventClock(next.phase, next.minute, next.second);
  const eventId = `ev-${eventClock.idTag}-${next.events.length + 1}`;

  let eventType: MatchEventType = 'pass';
  let eventSide: 'home' | 'away' | 'neutral' = attSide;
  let primaryId: string | undefined = carrier.player.id;
  let secondaryId: string | undefined = marker.player.id;
  let excitement = 3;
  let isKey = false;
  const segments: CommentarySegment[] = [];

  // ---------------- CHECK RARE INJURY KNOCK ----------------
  const injuryProb =
    0.00055 *
    (carrier.player.attributes.physical.injuryProneness / 10) *
    (carrier.stat.condition < 62 ? 1.7 : 1.0) *
    (defTactics.instructions.tackling === 'Hard' ? 1.45 : 1.0);

  if (Math.random() < injuryProb && !carrier.stat.injured) {
    carrier.stat.injured = true;
    carrier.stat.condition = round1(Math.max(25, carrier.stat.condition - 18));
    eventType = 'injury';
    excitement = 7;
    isKey = true;
    segments.push(
      makeSegment(
        eventId,
        0,
        'lead',
        `Oh, worrying scenes for ${attClub.shortName} — ${carrier.player.name} pulls up clutching his hamstring after a challenge from ${marker.player.shortName}! The physio sprints onto the pitch.`,
        7,
        attSide,
        'flash-card'
      ),
      makeSegment(
        eventId,
        1,
        'analyst',
        `${attClub.managerName} will surely have to make a substitution here. ${carrier.player.shortName} is limping heavily and down to ${Math.round(carrier.stat.condition)}% condition.`,
        5,
        attSide,
        'none'
      )
    );
  } else {
    // ---------------- CHECK FOUL / CARD / PENALTY / FREE KICK ----------------
    const tackAgg =
      (marker.player.attributes.mental.aggression + marker.player.attributes.mental.bravery) / 40;
    const hardMod =
      defTactics.instructions.tackling === 'Hard'
        ? 1.48
        : defTactics.instructions.tackling === 'Easy'
        ? 0.62
        : 1.0;
    const pressFoulMod = defTactics.instructions.pressing ? 1.12 : 1.0;
    const foulProb = clamp(0.068 * (0.65 + tackAgg) * hardMod * pressFoulMod, 0.03, 0.16);

    if (Math.random() < foulProb) {
      defStats.fouls += 1;

      // Penalty if foul happens inside the opponent box!
      const inBox = attackDepth >= 82 && next.ballY >= 24 && next.ballY <= 76;
      if (inBox && Math.random() < 0.24) {
        // Resolve Penalty Kick immediately with full drama!
        const penTakerId = attTactics.penaltyTakerId;
        const penTaker =
          attPlayers.find((x) => x.player.id === penTakerId) ??
          pickWeightedPlayer(attOutfield, (x) => x.player.attributes.technical.penalties);

        const penSkill = getEffectiveAttr(
          penTaker.player,
          penTaker.player.attributes.technical.penalties * 0.55 +
            penTaker.player.attributes.technical.finishing * 0.25 +
            penTaker.player.attributes.mental.determination * 0.2,
          penTaker.stat
        );
        const gkSkill = defGk ? getGoalkeeperRating(defGk.player, defGk.stat) : 10;
        const scoreProb = clamp(0.77 + (penSkill - gkSkill) * 0.015, 0.58, 0.92);

        attStats.shots += 1;
        attStats.xg = round2(attStats.xg + 0.78);
        penTaker.stat.shots += 1;
        next.ballX = attSide === 'home' ? 90 : 10;
        next.ballY = 50;
        primaryId = penTaker.player.id;
        secondaryId = defGk?.player.id;
        isKey = true;

        if (Math.random() < scoreProb) {
          eventType = 'penalty_scored';
          attStats.shotsOnTarget += 1;
          if (attSide === 'home') next.homeGoals += 1;
          else next.awayGoals += 1;
          penTaker.stat.goals += 1;
          adjustRating(next.playerStats, penTaker.player.id, 0.95);
          adjustRating(next.playerStats, marker.player.id, -0.55);

          next.goals.push({
            minute: eventClock.minute,
            scorerId: penTaker.player.id,
            scorerName: penTaker.player.shortName,
            clubId: attClub.id,
            isPenalty: true,
          });
          excitement = 10;
          segments.push(
            makeSegment(
              eventId,
              0,
              'lead',
              `PENALTY AWARDED — AND SCORED! ${marker.player.shortName} clips ${carrier.player.shortName} in the area and ${penTaker.player.name} buries the spot-kick past ${defGk?.player.shortName ?? 'the keeper'}! ${homeClub.shortName} ${next.homeGoals}–${next.awayGoals} ${awayClub.shortName}!`,
              10,
              attSide,
              'flash-goal'
            ),
            makeSegment(
              eventId,
              1,
              'analyst',
              `Ice-cold nerves from ${penTaker.player.shortName} — sent ${defGk?.player.shortName ?? 'the goalkeeper'} the wrong way! That pushes ${penTaker.player.shortName} up to a ${penTaker.stat.rating.toFixed(1)} rating while ${marker.player.shortName} will be furious with himself.`,
              8,
              attSide,
              'pulse'
            )
          );
          // Kickoff reset
          next.possessionSide = defSide;
          next.ballX = 50;
          next.ballY = 50;
        } else {
          eventType = 'penalty_missed';
          attStats.shotsOnTarget += 1;
          if (defGk) {
            defGk.stat.saves += 1;
            adjustRating(next.playerStats, defGk.player.id, 0.95);
          }
          adjustRating(next.playerStats, penTaker.player.id, -0.75);
          excitement = 9;
          segments.push(
            makeSegment(
              eventId,
              0,
              'lead',
              `PENALTY SAVED!! ${penTaker.player.name} strikes low to the corner, but ${defGk?.player.name ?? 'the keeper'} guesses brilliantly and pushes it away! Unbelievable drama at ${homeClub.stadium.name}!`,
              9,
              defSide,
              'flash-chance'
            ),
            makeSegment(
              eventId,
              1,
              'analyst',
              `What a colossal moment! ${defGk?.player.shortName ?? 'The keeper'} is up to ${defGk?.stat.rating.toFixed(1) ?? '7.5'} now — saves like that swing entire matches!`,
              7,
              defSide,
              'pulse'
            )
          );
          next.possessionSide = defSide;
          next.ballX = attSide === 'home' ? 84 : 16;
        }
      } else {
        // Card check on foul
        const cardRoll = Math.random();
        const redThresh = defTactics.instructions.tackling === 'Hard' ? 0.025 : 0.01;
        const yellowThresh = defTactics.instructions.tackling === 'Hard' ? 0.34 : 0.22;

        if (cardRoll < redThresh) {
          eventType = 'red_card';
          eventSide = defSide;
          primaryId = marker.player.id;
          secondaryId = carrier.player.id;
          defStats.redCards += 1;
          marker.stat.redCard = true;
          adjustRating(next.playerStats, marker.player.id, -1.6);
          next.cards.push({
            minute: eventClock.minute,
            playerId: marker.player.id,
            playerName: marker.player.shortName,
            clubId: defClub.id,
            card: 'red',
          });
          excitement = 9;
          isKey = true;
          segments.push(
            makeSegment(
              eventId,
              0,
              'lead',
              `STRAIGHT RED CARD! ${marker.player.name} lunges in recklessly on ${carrier.player.name} and ${next.refereeName} reaches straight for his back pocket! ${defClub.shortName} are down to TEN MEN!`,
              9,
              defSide,
              'flash-card'
            ),
            makeSegment(
              eventId,
              1,
              'analyst',
              `No complaints whatsoever — studs showing and miles late. ${defClub.managerName} will have to reorganize that ${defTactics.formation} immediately; playing with ten men changes everything.`,
              7,
              defSide,
              'pulse'
            )
          );
        } else if (cardRoll < yellowThresh) {
          marker.stat.yellowCards += 1;
          if (marker.stat.yellowCards >= 2) {
            eventType = 'red_card';
            eventSide = defSide;
            primaryId = marker.player.id;
            secondaryId = carrier.player.id;
            defStats.yellowCards += 1;
            defStats.redCards += 1;
            marker.stat.redCard = true;
            adjustRating(next.playerStats, marker.player.id, -1.35);
            next.cards.push({
              minute: eventClock.minute,
              playerId: marker.player.id,
              playerName: marker.player.shortName,
              clubId: defClub.id,
              card: 'red',
            });
            excitement = 9;
            isKey = true;
            segments.push(
              makeSegment(
                eventId,
                0,
                'lead',
                `SECOND YELLOW — HE'S OFF!! ${marker.player.name} drags down ${carrier.player.shortName} and ${next.refereeName} flashes yellow followed by RED! ${defClub.name} are reduced to ten!`,
                9,
                defSide,
                'flash-card'
              ),
              makeSegment(
                eventId,
                1,
                'analyst',
                `Utterly rash when already on a booking! You could see that coming with ${defClub.shortName}'s ${defTactics.instructions.tackling.toLowerCase()} tackling.`,
                7,
                defSide,
                'pulse'
              )
            );
          } else {
            eventType = 'yellow_card';
            eventSide = defSide;
            primaryId = marker.player.id;
            secondaryId = carrier.player.id;
            defStats.yellowCards += 1;
            adjustRating(next.playerStats, marker.player.id, -0.35);
            next.cards.push({
              minute: eventClock.minute,
              playerId: marker.player.id,
              playerName: marker.player.shortName,
              clubId: defClub.id,
              card: 'yellow',
            });
            excitement = 6;
            isKey = true;
            segments.push(
              makeSegment(
                eventId,
                0,
                'lead',
                pick([
                  `Yellow card! ${marker.player.name} chops down ${carrier.player.shortName} to halt the attack, and ${next.refereeName} takes his name.`,
                  `${marker.player.name} goes into the referee's notebook for a cynical pull-back on ${carrier.player.name}.`,
                  `Caution shown to ${marker.player.name} (${defClub.shortName}) — mistimed slide tackle right in front of the dugouts.`,
                ]),
                6,
                defSide,
                'flash-card'
              ),
              makeSegment(
                eventId,
                1,
                'analyst',
                `He's walking a tightrope for the rest of this match now, sitting on a ${marker.stat.rating.toFixed(1)} rating. ${attClub.shortName} will look to run directly at him.`,
                4,
                defSide,
                'none'
              )
            );
          }
        } else if (attackDepth >= 66) {
          // Dangerous Free Kick in shooting / delivery range!
          eventType = 'free_kick';
          const takerId = attTactics.setPieceTakerId;
          const taker =
            attPlayers.find((x) => x.player.id === takerId) ??
            pickWeightedPlayer(attOutfield, (x) => x.player.attributes.technical.setPieces);
          primaryId = taker.player.id;

          const fkQuality = getEffectiveAttr(
            taker.player,
            taker.player.attributes.technical.setPieces * 0.55 +
              taker.player.attributes.technical.technique * 0.25 +
              taker.player.attributes.technical.longShots * 0.2,
            taker.stat
          );
          const gkQuality = defGk ? getGoalkeeperRating(defGk.player, defGk.stat) : 10;
          attStats.shots += 1;
          attStats.xg = round2(attStats.xg + 0.08);
          taker.stat.shots += 1;

          const fkGoalProb = clamp(0.065 + (fkQuality - gkQuality) * 0.008, 0.025, 0.16);
          const roll = Math.random();
          if (roll < fkGoalProb) {
            eventType = 'goal';
            attStats.shotsOnTarget += 1;
            if (attSide === 'home') next.homeGoals += 1;
            else next.awayGoals += 1;
            taker.stat.goals += 1;
            adjustRating(next.playerStats, taker.player.id, 1.25);
            if (defGk) adjustRating(next.playerStats, defGk.player.id, -0.2);
            next.goals.push({
              minute: eventClock.minute,
              scorerId: taker.player.id,
              scorerName: taker.player.shortName,
              clubId: attClub.id,
            });
            excitement = 10;
            isKey = true;
            segments.push(
              makeSegment(
                eventId,
                0,
                'lead',
                `WHAT A FREE-KICK!! ${taker.player.name} whips it up and over the wall into the top corner! ${defGk?.player.shortName ?? 'The keeper'} never had a prayer! ${homeClub.shortName} ${next.homeGoals}–${next.awayGoals} ${awayClub.shortName}!`,
                10,
                attSide,
                'flash-goal'
              ),
              makeSegment(
                eventId,
                1,
                'analyst',
                `Pure dead-ball artistry from ${taker.player.shortName} — Set Pieces ${taker.player.attributes.technical.setPieces} showing every ounce of quality! He's skyrocketed to a ${taker.stat.rating.toFixed(1)} rating.`,
                8,
                attSide,
                'pulse'
              )
            );
            next.possessionSide = defSide;
            next.ballX = 50;
            next.ballY = 50;
          } else if (roll < 0.48) {
            eventType = 'shot_saved';
            attStats.shotsOnTarget += 1;
            if (defGk) {
              defGk.stat.saves += 1;
              adjustRating(next.playerStats, defGk.player.id, 0.35);
            }
            excitement = 7;
            isKey = true;
            segments.push(
              makeSegment(
                eventId,
                0,
                'lead',
                `Dangerous free-kick by ${taker.player.name} curls around the wall, forcing a fingertip save from ${defGk?.player.name ?? 'the keeper'}!`,
                7,
                attSide,
                'flash-chance'
              ),
              makeSegment(
                eventId,
                1,
                'analyst',
                `Great positioning from ${defGk?.player.shortName ?? 'the goalkeeper'} (now ${defGk?.stat.rating.toFixed(1) ?? '7.0'}) — read the whip off ${taker.player.shortName}'s boot all the way.`,
                5,
                defSide,
                'none'
              )
            );
            next.possessionSide = defSide;
            next.ballX = attSide === 'home' ? 84 : 16;
          } else {
            excitement = 5;
            isKey = false;
            segments.push(
              makeSegment(
                eventId,
                0,
                'lead',
                `Free-kick to ${attClub.shortName} from 25 yards — ${taker.player.name} bends it over the wall, just inches over the crossbar!`,
                5,
                attSide,
                'pulse'
              )
            );
            next.possessionSide = defSide;
            next.ballX = attSide === 'home' ? 86 : 14;
          }
        } else {
          // Midfield foul
          eventType = 'foul';
          eventSide = defSide;
          primaryId = marker.player.id;
          secondaryId = carrier.player.id;
          excitement = 3;
          segments.push(
            makeSegment(
              eventId,
              0,
              'lead',
              pick([
                `Whistle blows — ${marker.player.name} catches ${carrier.player.shortName} late in midfield. Free-kick to ${attClub.shortName}.`,
                `${marker.player.shortName} bundles ${carrier.player.name} over on the turn; ${next.refereeName} awards a free-kick.`,
              ]),
              3,
              defSide,
              'none'
            )
          );
        }
      }
    } else if (attackDepth >= 62) {
      // ---------------- ATTACKING THIRD: CHANCES, CORNERS, SHOTS, GOALS ----------------
      const offsideCaught =
        defTactics.instructions.offsideTrap &&
        Math.random() <
          clamp(
            0.13 +
              (marker.player.attributes.mental.anticipation +
                marker.player.attributes.mental.teamwork -
                carrier.player.attributes.technical.offTheBall -
                carrier.player.attributes.physical.pace) *
                0.008,
            0.04,
            0.24
          );

      if (offsideCaught) {
        eventType = 'tackle';
        eventSide = defSide;
        excitement = 4;
        segments.push(
          makeSegment(
            eventId,
            0,
            'lead',
            `Flag is up! ${carrier.player.name} thought he was clean through, but ${defClub.shortName}'s offside trap springs to perfection!`,
            4,
            defSide,
            'none'
          )
        );
        next.possessionSide = defSide;
        next.ballX = clamp(next.ballX - dir * 16, 15, 85);
      } else {
        const phaseRoll = Math.random();

        // Corner kick (~13%)
        if (phaseRoll < 0.13) {
          attStats.corners += 1;
          const takerId = attTactics.setPieceTakerId;
          const taker =
            attPlayers.find((x) => x.player.id === takerId) ??
            pickWeightedPlayer(attOutfield, (x) => x.player.attributes.technical.crossing);
          const headerTarget = pickWeightedPlayer(
            attOutfield.filter((x) => x.player.id !== taker.player.id),
            (x) =>
              x.player.attributes.technical.heading * 1.4 +
              x.player.attributes.physical.jumping * 1.2 +
              x.player.attributes.physical.strength
          );

          next.ballX = attSide === 'home' ? 95 : 5;
          next.ballY = Math.random() < 0.5 ? 6 : 94;
          primaryId = headerTarget.player.id;
          secondaryId = taker.player.id;

          const aerialEdge =
            (headerTarget.player.attributes.technical.heading +
              headerTarget.player.attributes.physical.jumping -
              marker.player.attributes.technical.heading -
              marker.player.attributes.physical.jumping) /
            40;

          if (Math.random() < clamp(0.11 + aerialEdge * 0.08, 0.04, 0.22)) {
            // Corner goal!
            eventType = 'goal';
            attStats.shots += 1;
            attStats.shotsOnTarget += 1;
            attStats.xg = round2(attStats.xg + 0.16);
            if (attSide === 'home') next.homeGoals += 1;
            else next.awayGoals += 1;
            headerTarget.stat.shots += 1;
            headerTarget.stat.goals += 1;
            taker.stat.assists += 1;
            adjustRating(next.playerStats, headerTarget.player.id, 1.15);
            adjustRating(next.playerStats, taker.player.id, 0.6);
            adjustRating(next.playerStats, marker.player.id, -0.35);

            next.goals.push({
              minute: eventClock.minute,
              scorerId: headerTarget.player.id,
              scorerName: headerTarget.player.shortName,
              assistId: taker.player.id,
              assistName: taker.player.shortName,
              clubId: attClub.id,
            });
            excitement = 10;
            isKey = true;
            segments.push(
              makeSegment(
                eventId,
                0,
                'lead',
                `GOAL FROM THE CORNER!! ${taker.player.shortName} whips in a wicked delivery and ${headerTarget.player.name} powers a bullet header past ${defGk?.player.shortName ?? 'the keeper'}! ${homeClub.shortName} ${next.homeGoals}–${next.awayGoals} ${awayClub.shortName}!`,
                10,
                attSide,
                'flash-goal'
              ),
              makeSegment(
                eventId,
                1,
                'analyst',
                `Unstoppable leap by ${headerTarget.player.shortName}! He towered above ${marker.player.shortName} at the near post — ${headerTarget.player.shortName} jumps to a ${headerTarget.stat.rating.toFixed(1)} rating!`,
                8,
                attSide,
                'pulse'
              )
            );
            next.possessionSide = defSide;
            next.ballX = 50;
            next.ballY = 50;
          } else {
            eventType = 'corner';
            excitement = 5;
            segments.push(
              makeSegment(
                eventId,
                0,
                'lead',
                `Corner to ${attClub.shortName} — ${taker.player.shortName} swings it into the six-yard box, ${headerTarget.player.shortName} rises highest, but ${defClub.shortName} scramble it clear!`,
                5,
                attSide,
                'pulse'
              )
            );
            next.possessionSide = defSide;
            next.ballX = attSide === 'home' ? 76 : 24;
            next.ballY = randInt(25, 75);
          }
        } else if (phaseRoll < 0.62) {
          // ---------------- OPEN-PLAY SHOT ATTEMPT ----------------
          const isWideCross = next.ballY <= 22 || next.ballY >= 78;
          const isCounter = attTactics.instructions.counterAttack && Math.random() < 0.35;
          const beatOffsideTrap =
            defTactics.instructions.offsideTrap &&
            carrier.player.attributes.physical.pace >= 15 &&
            Math.random() < 0.25;

          // Pick shooter (weighted toward forwards / AMC / nearby attackers)
          const shooter = pickWeightedPlayer(
            attOutfield.length > 0 ? attOutfield : attPlayers,
            (item) => {
              const cat = getPositionCategory(item.slot.roleLabel);
              const posBias =
                cat === 'FWD' ? 4.2 : item.slot.roleLabel === 'AMC' ? 2.6 : cat === 'MID' ? 1.5 : 0.35;
              const distGoal = Math.hypot(
                item.radarX - (attSide === 'home' ? 92 : 8),
                item.radarY - 50
              );
              return posBias * Math.exp(-distGoal / 38) * (0.7 + item.player.attributes.technical.offTheBall / 22);
            }
          );

          // Pick assister (different from shooter)
          const assisterPool = attOutfield.filter((x) => x.player.id !== shooter.player.id);
          const assister =
            assisterPool.length > 0
              ? pickWeightedPlayer(assisterPool, (item) =>
                  isWideCross
                    ? item.player.attributes.technical.crossing * 1.6 +
                      item.player.attributes.technical.passing
                    : item.player.attributes.mental.creativity * 1.5 +
                      item.player.attributes.technical.passing * 1.4
                )
              : carrier;

          const isLongShot = attackDepth < 76 && !beatOffsideTrap && Math.random() < 0.45;
          const isHeader = isWideCross && !isLongShot && Math.random() < 0.55;

          const shotXg = isLongShot
            ? round2(0.04 + Math.random() * 0.06)
            : beatOffsideTrap || isCounter
            ? round2(0.28 + Math.random() * 0.24)
            : isHeader
            ? round2(0.11 + Math.random() * 0.14)
            : round2(0.12 + Math.random() * 0.2);

          attStats.shots += 1;
          attStats.xg = round2(attStats.xg + shotXg);
          shooter.stat.shots += 1;
          assister.stat.passes += 1;
          attStats.passesAttempted += 1;
          attStats.passesCompleted += 1;

          const shootSkill = isLongShot
            ? getEffectiveAttr(
                shooter.player,
                shooter.player.attributes.technical.longShots * 0.55 +
                  shooter.player.attributes.technical.technique * 0.3 +
                  shooter.player.attributes.mental.decisions * 0.15,
                shooter.stat
              )
            : isHeader
            ? getEffectiveAttr(
                shooter.player,
                shooter.player.attributes.technical.heading * 0.5 +
                  shooter.player.attributes.physical.jumping * 0.3 +
                  shooter.player.attributes.mental.anticipation * 0.2,
                shooter.stat
              )
            : getEffectiveAttr(
                shooter.player,
                shooter.player.attributes.technical.finishing * 0.5 +
                  shooter.player.attributes.technical.technique * 0.2 +
                  shooter.player.attributes.mental.decisions * 0.15 +
                  shooter.player.attributes.technical.offTheBall * 0.15,
                shooter.stat
              );

          const gkSkill = defGk ? getGoalkeeperRating(defGk.player, defGk.stat) : 10;
          const pressurePenalty = defTactics.instructions.menBehindBall ? 0.88 : 1.0;

          // Calibrated goal probability around shotXg scaled by shooter vs keeper duel
          const goalProb = clamp(
            shotXg * (0.76 + (shootSkill - gkSkill) * 0.032 + attAdv * 0.35) * pressurePenalty,
            0.03,
            0.42
          );
          const onTargetProb = clamp(
            0.46 + (shootSkill - 11) * 0.018 + (isLongShot ? -0.1 : 0.06),
            0.25,
            0.78
          );

          next.ballX = attSide === 'home' ? (isLongShot ? 78 : 92) : isLongShot ? 22 : 8;
          next.ballY = clamp(50 + randInt(-18, 18), 22, 78);
          primaryId = shooter.player.id;
          secondaryId = assister.player.id;

          const shotRoll = Math.random();
          if (shotRoll < goalProb) {
            // ---------------- GOAL!! ----------------
            eventType = 'goal';
            attStats.shotsOnTarget += 1;
            if (attSide === 'home') next.homeGoals += 1;
            else next.awayGoals += 1;

            shooter.stat.goals += 1;
            adjustRating(next.playerStats, shooter.player.id, 1.15);
            if (assister.player.id !== shooter.player.id) {
              assister.stat.assists += 1;
              adjustRating(next.playerStats, assister.player.id, 0.65);
            }
            if (defGk) adjustRating(next.playerStats, defGk.player.id, -0.25);
            adjustRating(next.playerStats, marker.player.id, -0.25);

            next.goals.push({
              minute: eventClock.minute,
              scorerId: shooter.player.id,
              scorerName: shooter.player.shortName,
              assistId: assister.player.id !== shooter.player.id ? assister.player.id : undefined,
              assistName:
                assister.player.id !== shooter.player.id ? assister.player.shortName : undefined,
              clubId: attClub.id,
            });

            excitement = 10;
            isKey = true;

            const scoreStr = `${homeClub.shortName} ${next.homeGoals}–${next.awayGoals} ${awayClub.shortName}`;
            const leadGoalLines = isLongShot
              ? [
                  `WHAT A SCREAMER!! ${shooter.player.name} unleashes an unstoppable thunderbolt from 25 yards into the top stanchion! ${scoreStr}!`,
                  `OH! ABSOLUTE WORLDIE BY ${shooter.player.name}! ${assister.player.shortName} lays it off and ${shooter.player.shortName} rifles it straight past ${defGk?.player.shortName ?? 'the keeper'}! ${scoreStr}!`,
                ]
              : isHeader
              ? [
                  `GOAL!! ${assister.player.name} whips an inch-perfect cross into the corridor of uncertainty and ${shooter.player.name} glances a clinical header home! ${scoreStr}!`,
                  `IT'S IN!! ${shooter.player.name} peels off his marker and meets ${assister.player.shortName}'s delivery with a thumping header! ${scoreStr}!`,
                ]
              : beatOffsideTrap || isCounter
              ? [
                  `GOAL ON THE BREAK!! ${assister.player.name} threads a razor-sharp ball in behind, ${shooter.player.name} leaves the defense for dead and slots calmly past ${defGk?.player.shortName ?? 'the keeper'}! ${scoreStr}!`,
                  `LIGHTNING COUNTER-ATTACK — GOAL!! ${shooter.player.name} races clear on goal and coolly tucks it into the bottom corner! ${homeClub.stadium.name} erupts! ${scoreStr}!`,
                ]
              : [
                  `GOAL!! ${shooter.player.name}!! Brilliant link-up with ${assister.player.shortName} and ${shooter.player.shortName} fires low and hard into the net! ${scoreStr}!`,
                  `HE'S DONE IT!! ${shooter.player.name} ghosts into the box, takes one touch from ${assister.player.shortName}'s pass, and buries it past ${defGk?.player.shortName ?? 'the keeper'}! ${scoreStr}!`,
                  `BACK OF THE NET!! ${shooter.player.name} shows lethal composure inside the penalty area to fire ${attClub.name} ahead — ${scoreStr}!`,
                ];

            const analystGoalLines = [
              `Take a bow, ${shooter.player.shortName}! That's ${shooter.stat.goals} goal${shooter.stat.goals > 1 ? 's' : ''} today and his rating surges to ${shooter.stat.rating.toFixed(1)}. ${assister.player.shortName}'s vision in that ${attTactics.formation} split ${defClub.shortName} wide open.`,
              beatOffsideTrap
                ? `${defClub.shortName}'s offside trap was caught flat-footed by ${shooter.player.shortName}'s pace! Clinical finish — he's now up to a ${shooter.stat.rating.toFixed(1)} rating.`
                : `You can see the WIB/WOB movement paying dividends for ${attClub.shortName} — overloads in the final third created a ${shotXg.toFixed(2)} xG opening and ${shooter.player.shortName} (${shooter.stat.rating.toFixed(1)}) punished them!`,
            ];

            segments.push(
              makeSegment(eventId, 0, 'lead', pick(leadGoalLines), 10, attSide, 'flash-goal'),
              makeSegment(eventId, 1, 'analyst', pick(analystGoalLines), 8, attSide, 'pulse')
            );

            // Reset to center spot for defending team kickoff
            next.possessionSide = defSide;
            next.ballX = 50;
            next.ballY = 50;
          } else if (shotRoll < goalProb + 0.065) {
            // ---------------- WOODWORK!! ----------------
            eventType = 'woodwork';
            adjustRating(next.playerStats, shooter.player.id, 0.2);
            excitement = 9;
            isKey = true;
            segments.push(
              makeSegment(
                eventId,
                0,
                'lead',
                pick([
                  `OFF THE CROSSBAR!! ${shooter.player.name} rattles the woodwork with a ferocious strike from ${assister.player.shortName}'s pass — the frame is still shaking!`,
                  `CLANG!! ${shooter.player.name} beats ${defGk?.player.shortName ?? 'the keeper'} all ends up, only to see his curling shot cannon back off the inside of the post!`,
                ]),
                9,
                attSide,
                'flash-chance'
              ),
              makeSegment(
                eventId,
                1,
                'analyst',
                `Inches away from glory! ${defClub.shortName} rode their luck there — ${attClub.shortName} are up to ${attStats.xg.toFixed(2)} xG and turning the screw.`,
                7,
                attSide,
                'pulse'
              )
            );
            next.possessionSide = defSide;
            next.ballX = attSide === 'home' ? 85 : 15;
          } else if (shotRoll < goalProb + 0.065 + onTargetProb * 0.68) {
            // ---------------- SHOT SAVED ----------------
            eventType = 'shot_saved';
            attStats.shotsOnTarget += 1;
            const isBigSave = shotXg >= 0.19;
            if (defGk) {
              defGk.stat.saves += 1;
              adjustRating(next.playerStats, defGk.player.id, isBigSave ? 0.45 : 0.25);
            }
            adjustRating(next.playerStats, shooter.player.id, 0.1);
            excitement = isBigSave ? 8 : 6;
            isKey = isBigSave;

            segments.push(
              makeSegment(
                eventId,
                0,
                'lead',
                isBigSave
                  ? pick([
                      `WHAT A SAVE BY ${defGk?.player.name.toUpperCase() ?? 'THE KEEPER'}!! ${shooter.player.name} fires from point-blank range, but ${defGk?.player.shortName ?? 'the goalkeeper'} flings out a strong hand to deny a certain goal!`,
                      `SUPERB STOP! ${shooter.player.name} connects sweetly after ${assister.player.shortName}'s cutback, yet ${defGk?.player.name ?? 'the keeper'} claws it away at full stretch!`,
                    ])
                  : pick([
                      `${shooter.player.name} tests ${defGk?.player.name ?? 'the keeper'} with a stinging drive — safely gathered at the second attempt.`,
                      `Sharp turn and shot by ${shooter.player.name}, parried away solidly by ${defGk?.player.shortName ?? 'the goalkeeper'}.`,
                    ]),
                excitement,
                isBigSave ? defSide : attSide,
                isBigSave ? 'flash-chance' : 'pulse'
              )
            );
            if (isBigSave) {
              segments.push(
                makeSegment(
                  eventId,
                  1,
                  'analyst',
                  `Top-drawer goalkeeping! ${defGk?.player.shortName ?? 'The keeper'} is up to ${defGk?.stat.saves ?? 1} saves and a ${defGk?.stat.rating.toFixed(1) ?? '7.2'} rating — keeping ${defClub.shortName} alive in this contest.`,
                  6,
                  defSide,
                  'none'
                )
              );
            }
            next.possessionSide = defSide;
            next.ballX = attSide === 'home' ? 84 : 16;
          } else {
            // ---------------- SHOT MISSED ----------------
            eventType = 'shot_missed';
            excitement = shotXg >= 0.2 ? 6 : 4;
            isKey = shotXg >= 0.22;
            segments.push(
              makeSegment(
                eventId,
                0,
                'lead',
                pick([
                  `${shooter.player.name} finds half a yard on the edge of the area, but drags his effort wide of the far post.`,
                  `Chance for ${attClub.shortName}! ${assister.player.shortName} picks out ${shooter.player.name}, who leans back and blazes it over the bar.`,
                  `${shooter.player.name} lets fly from distance — flashes just wide with ${defGk?.player.shortName ?? 'the keeper'} scrambling across!`,
                ]),
                excitement,
                attSide,
                shotXg >= 0.22 ? 'pulse' : 'none'
              )
            );
            next.possessionSide = defSide;
            next.ballX = attSide === 'home' ? 86 : 14;
            next.ballY = 50;
          }
        } else if (phaseRoll < 0.82) {
          // ---------------- DEFENSIVE TACKLE / INTERCEPTION IN FINAL THIRD ----------------
          eventType = 'tackle';
          eventSide = defSide;
          primaryId = marker.player.id;
          secondaryId = carrier.player.id;
          defStats.tacklesWon += 1;
          marker.stat.tackles += 1;
          adjustRating(next.playerStats, marker.player.id, 0.18);
          excitement = 5;
          segments.push(
            makeSegment(
              eventId,
              0,
              'lead',
              pick([
                `Crucial interception by ${marker.player.name}! Reads ${carrier.player.shortName}'s intentions and clears the danger for ${defClub.shortName}.`,
                `Timed to perfection! ${marker.player.name} slides in cleanly to dispossess ${carrier.player.name} right on the edge of the box.`,
                `${marker.player.name} stands strong against ${carrier.player.shortName} and shepherds the ball away calmly.`,
              ]),
              5,
              defSide,
              'none'
            )
          );
          next.possessionSide = defSide;
          next.ballX = clamp(next.ballX - dir * randInt(16, 28), 18, 82);
          next.ballY = clamp(next.ballY + randInt(-20, 20), 12, 88);
        } else {
          // ---------------- BIG CHANCE / DRIBBLE INTO BOX ----------------
          eventType = 'chance';
          excitement = 7;
          isKey = true;
          adjustRating(next.playerStats, carrier.player.id, 0.15);
          next.ballX = clamp(next.ballX + dir * randInt(6, 12), 10, 90);
          next.ballY = clamp(50 + randInt(-22, 22), 16, 84);
          segments.push(
            makeSegment(
              eventId,
              0,
              'lead',
              pick([
                `OOH! ${carrier.player.name} skips past ${marker.player.shortName} with dazzling footwork and drives into the penalty area!`,
                `${attClub.shortName} carve them open down the flank — ${carrier.player.name} bursts into space with options queuing up in the middle!`,
              ]),
              7,
              attSide,
              'flash-chance'
            )
          );
        }
      }
    } else {
      // ---------------- BUILD-UP & MIDFIELD PHASE (attackDepth < 67) ----------------
      const passTargetPool = attOutfield.filter((x) => x.player.id !== carrier.player.id);
      const receiver =
        passTargetPool.length > 0
          ? pickWeightedPlayer(passTargetPool, (x) => {
              const forwardness = attSide === 'home' ? x.radarX : 100 - x.radarX;
              return 0.6 + forwardness / 50 + x.player.attributes.technical.offTheBall / 20;
            })
          : carrier;

      const passStyle = attTactics.instructions.passing;
      const passSkill = getEffectiveAttr(
        carrier.player,
        carrier.player.attributes.technical.passing * 0.45 +
          carrier.player.attributes.mental.creativity * 0.25 +
          carrier.player.attributes.mental.decisions * 0.15 +
          carrier.player.attributes.mental.teamwork * 0.15,
        carrier.stat
      );
      const pressSkill = getEffectiveAttr(
        marker.player,
        marker.player.attributes.technical.tackling * 0.4 +
          marker.player.attributes.mental.anticipation * 0.35 +
          marker.player.attributes.mental.workRate * 0.25,
        marker.stat
      );

      const styleAccuracyMod =
        passStyle === 'Short'
          ? 0.08
          : passStyle === 'Mixed'
          ? 0.02
          : passStyle === 'Direct'
          ? -0.05
          : -0.11;
      const successProb = clamp(
        0.65 + (passSkill - pressSkill) * 0.015 + attAdv * 0.22 + styleAccuracyMod,
        0.38,
        0.88
      );

      attStats.passesAttempted += 1;

      if (Math.random() < successProb) {
        attStats.passesCompleted += 1;
        carrier.stat.passes += 1;
        adjustRating(next.playerStats, carrier.player.id, 0.04);

        const advanceDist =
          passStyle === 'Long Ball'
            ? randInt(28, 42)
            : passStyle === 'Direct'
            ? randInt(23, 35)
            : passStyle === 'Mixed'
            ? randInt(18, 29)
            : randInt(14, 24);

        next.ballX = clamp(next.ballX + dir * advanceDist, 8, 92);
        next.ballY = clamp(receiver.radarY + randInt(-10, 10), 8, 92);

        const isDribble =
          carrier.player.attributes.technical.dribbling >= 14 && Math.random() < 0.28;
        eventType = isDribble ? 'dribble' : 'pass';
        primaryId = carrier.player.id;
        secondaryId = receiver.player.id;
        excitement = next.ballX > 72 || next.ballX < 28 ? 5 : 3;

        segments.push(
          makeSegment(
            eventId,
            0,
            'lead',
            isDribble
              ? pick([
                  `${carrier.player.name} glides away from ${marker.player.shortName} with a sharp drop of the shoulder and surges forward for ${attClub.shortName}.`,
                  `Lovely turn by ${carrier.player.name}, carrying ${attClub.shortName} across the halfway line with pace!`,
                ])
              : passStyle === 'Direct' || passStyle === 'Long Ball'
              ? pick([
                  `${carrier.player.name} pings a raking diagonal ball forward looking for ${receiver.player.name} in the channels.`,
                  `Direct route from ${attClub.shortName} — ${carrier.player.shortName} launches it early up to ${receiver.player.name}.`,
                ])
              : pick([
                  `Crisp midfield interplay from ${attClub.shortName}: ${carrier.player.shortName} slides it neatly into the path of ${receiver.player.name}.`,
                  `${carrier.player.name} dictates the tempo, finding ${receiver.player.shortName} in a pocket of space.`,
                  `Patient build-up by ${attClub.shortName} as ${carrier.player.shortName} switches the point of attack to ${receiver.player.name}.`,
                ]),
            excitement,
            attSide,
            'none'
          )
        );
      } else {
        // Turnover / Midfield tackle!
        eventType = 'tackle';
        eventSide = defSide;
        primaryId = marker.player.id;
        secondaryId = carrier.player.id;
        defStats.tacklesWon += 1;
        marker.stat.tackles += 1;
        adjustRating(next.playerStats, marker.player.id, 0.14);
        excitement = defTactics.instructions.pressing ? 5 : 3;

        segments.push(
          makeSegment(
            eventId,
            0,
            'lead',
            defTactics.instructions.pressing
              ? pick([
                  `High press pays off! ${marker.player.name} snaps into ${carrier.player.shortName} and wins possession straight back for ${defClub.shortName}!`,
                  `${defClub.shortName} swarm the ball — ${marker.player.name} picks ${carrier.player.shortName}'s pocket in midfield!`,
                ])
              : pick([
                  `${marker.player.name} reads the pass cleanly and intercepts for ${defClub.shortName}.`,
                  `Strong challenge from ${marker.player.name} dispossesses ${carrier.player.shortName} cleanly.`,
                ]),
            excitement,
            defSide,
            'none'
          )
        );
        next.possessionSide = defSide;
        // Counter-attack spring forward if enabled
        if (defTactics.instructions.counterAttack) {
          next.ballX = clamp(next.ballX - dir * randInt(12, 22), 14, 86);
        }
      }
    }
  }

  // Update 5x5 radar zone indices
  next.zoneCol = clamp(Math.floor(next.ballX / 20), 0, 4);
  next.zoneRow = clamp(Math.floor(next.ballY / 20), 0, 4);

  // Smoothly animate all 22 radar player dots toward current WIB/WOB zone positions
  next.radarPlayers = updateRadarSmoothly(
    next.radarPlayers,
    next.homeTactics,
    next.awayTactics,
    next.possessionSide,
    next.ballX,
    next.ballY,
    primaryId,
    next.playerStats
  );

  const matchEvent: MatchEvent = {
    id: eventId,
    minute: eventClock.minute,
    second: eventClock.second,
    type: eventType,
    teamSide: eventSide,
    clubId: eventSide === 'home' ? homeClub.id : eventSide === 'away' ? awayClub.id : undefined,
    primaryPlayerId: primaryId,
    secondaryPlayerId: secondaryId,
    ballX: round1(next.ballX),
    ballY: round1(next.ballY),
    zoneRow: next.zoneRow,
    zoneCol: next.zoneCol,
    excitementLevel: excitement,
    isKeyHighlight: isKey,
    segments,
  };

  next.events.push(matchEvent);
  next.activeEvent = matchEvent;
  next.activeSegmentIndex = 0;

  return { nextSession: next, newEvent: matchEvent };
}

export function applyLiveSubstitution(
  session: MatchSessionState,
  side: 'home' | 'away',
  outPlayerId: string,
  inPlayerId: string,
  players: Record<string, Player>
): MatchSessionState {
  const subsUsed = side === 'home' ? session.homeSubsUsed : session.awaySubsUsed;
  if (subsUsed >= session.maxSubs) return session;

  const tactics = cloneTactics(side === 'home' ? session.homeTactics : session.awayTactics);
  const slotIdx = tactics.startingXI.findIndex((s) => s.playerId === outPlayerId);
  const benchIdx = tactics.bench.indexOf(inPlayerId);
  if (slotIdx === -1 || benchIdx === -1) return session;

  const outStat = session.playerStats[outPlayerId];
  if (outStat?.redCard) return session;

  tactics.startingXI[slotIdx] = {
    ...tactics.startingXI[slotIdx],
    playerId: inPlayerId,
  };
  tactics.bench = tactics.bench.filter((id) => id !== inPlayerId);

  const eventClock = resolveEventClock(session.phase, Math.max(1, session.minute), session.second);
  const nextStats: Record<string, LivePlayerMatchStat> = { ...session.playerStats };
  if (nextStats[outPlayerId]) {
    nextStats[outPlayerId] = {
      ...nextStats[outPlayerId],
      subbedOffMinute: eventClock.minute,
    };
  }
  const inPlayer = players[inPlayerId];
  const outPlayer = players[outPlayerId];
  nextStats[inPlayerId] = {
    ...(nextStats[inPlayerId] ?? {
      playerId: inPlayerId,
      rating: 6.5,
      goals: 0,
      assists: 0,
      shots: 0,
      passes: 0,
      tackles: 0,
      saves: 0,
      yellowCards: 0,
      redCard: false,
      condition: clamp(inPlayer?.condition ?? 96, 70, 100),
    }),
    subbedOnMinute: eventClock.minute,
  };

  const nextRadar = session.radarPlayers.map((dot) =>
    dot.playerId === outPlayerId
      ? {
          ...dot,
          playerId: inPlayerId,
          shirtNumber: inPlayer?.squadNumber ?? dot.shirtNumber,
          shortName: inPlayer?.shortName ?? 'Sub',
          hasBall: false,
        }
      : dot
  );

  const eventId = `ev-sub-${eventClock.idTag}-${session.events.length + 1}`;
  const outCond = Math.round(nextStats[outPlayerId]?.condition ?? 65);
  const outRating = (nextStats[outPlayerId]?.rating ?? 6.5).toFixed(1);
  const roleLabel = tactics.startingXI[slotIdx].roleLabel;

  const subEvent: MatchEvent = {
    id: eventId,
    minute: eventClock.minute,
    second: eventClock.second,
    type: 'substitution',
    teamSide: side,
    clubId: side === 'home' ? session.homeClubId : session.awayClubId,
    primaryPlayerId: inPlayerId,
    secondaryPlayerId: outPlayerId,
    ballX: session.ballX,
    ballY: session.ballY,
    zoneRow: session.zoneRow,
    zoneCol: session.zoneCol,
    excitementLevel: 5,
    isKeyHighlight: true,
    segments: [
      makeSegment(
        eventId,
        0,
        'lead',
        `Substitution! ${inPlayer?.name ?? 'Fresh legs'} replaces ${outPlayer?.name ?? 'the outgoing starter'} (${tactics.startingXI[slotIdx].roleLabel}).`,
        5,
        side,
        'pulse'
      ),
      makeSegment(
        eventId,
        1,
        'analyst',
        `Fresh energy injected into the ${roleLabel} slot. ${outPlayer?.shortName ?? 'He'} leaves the pitch on a ${outRating} rating at ${outCond}% condition — let's see what ${inPlayer?.shortName ?? 'the substitute'} can spark!`,
        4,
        side,
        'none'
      ),
    ],
  };

  return {
    ...session,
    homeTactics: side === 'home' ? tactics : session.homeTactics,
    awayTactics: side === 'away' ? tactics : session.awayTactics,
    homeSubsUsed: side === 'home' ? session.homeSubsUsed + 1 : session.homeSubsUsed,
    awaySubsUsed: side === 'away' ? session.awaySubsUsed + 1 : session.awaySubsUsed,
    playerStats: nextStats,
    radarPlayers: nextRadar,
    events: [...session.events, subEvent],
    activeEvent: subEvent,
    activeSegmentIndex: 0,
  };
}

export function applyLiveTacticsChange(
  session: MatchSessionState,
  side: 'home' | 'away',
  tactics: TacticsState
): MatchSessionState {
  const prev = side === 'home' ? session.homeTactics : session.awayTactics;
  const nextTactics = cloneTactics(tactics);

  const changes: string[] = [];
  if (prev.formation !== nextTactics.formation) {
    changes.push(`shape switched to ${nextTactics.formation}`);
  }
  if (prev.instructions.mentality !== nextTactics.instructions.mentality) {
    changes.push(`mentality set to ${nextTactics.instructions.mentality}`);
  }
  if (prev.instructions.passing !== nextTactics.instructions.passing) {
    changes.push(`${nextTactics.instructions.passing} passing`);
  }
  if (prev.instructions.tackling !== nextTactics.instructions.tackling) {
    changes.push(`${nextTactics.instructions.tackling} tackling`);
  }
  if (prev.instructions.pressing !== nextTactics.instructions.pressing) {
    changes.push(nextTactics.instructions.pressing ? 'Pressing ON' : 'Pressing OFF');
  }
  if (prev.instructions.offsideTrap !== nextTactics.instructions.offsideTrap) {
    changes.push(nextTactics.instructions.offsideTrap ? 'Offside Trap ON' : 'Offside Trap OFF');
  }
  if (prev.instructions.counterAttack !== nextTactics.instructions.counterAttack) {
    changes.push(
      nextTactics.instructions.counterAttack ? 'Counter-Attack ON' : 'Counter-Attack OFF'
    );
  }
  if (prev.instructions.menBehindBall !== nextTactics.instructions.menBehindBall) {
    changes.push(
      nextTactics.instructions.menBehindBall ? 'Men Behind Ball ON' : 'Men Behind Ball OFF'
    );
  }

  const summary =
    changes.length > 0 ? changes.join(', ') : 'WIB/WOB positional zones refined on the touchline';

  const eventClock = resolveEventClock(session.phase, Math.max(1, session.minute), session.second);
  const eventId = `ev-tac-${eventClock.idTag}-${session.events.length + 1}`;
  const tacEvent: MatchEvent = {
    id: eventId,
    minute: eventClock.minute,
    second: eventClock.second,
    type: 'tactical_change',
    teamSide: side,
    clubId: side === 'home' ? session.homeClubId : session.awayClubId,
    ballX: session.ballX,
    ballY: session.ballY,
    zoneRow: session.zoneRow,
    zoneCol: session.zoneCol,
    excitementLevel: 4,
    isKeyHighlight: true,
    segments: [
      makeSegment(
        eventId,
        0,
        'lead',
        `Tactical instructions shouted from the dugout: ${summary}.`,
        4,
        side,
        'pulse'
      ),
      makeSegment(
        eventId,
        1,
        'analyst',
        nextTactics.instructions.mentality === 'Gung Ho'
          ? `Throwing the kitchen sink at it now! Going Gung Ho leaves massive space behind, so watch out for counters.`
          : nextTactics.instructions.menBehindBall || nextTactics.instructions.mentality === 'Defending'
          ? `Shutting up shop from the touchline — tightening the defensive block and forcing the opposition to break down two compact banks.`
          : `Shrewd tactical adjustment from the manager (${summary}). Let's see if the players respond immediately in the midfield zones.`,
        4,
        side,
        'none'
      ),
    ],
  };

  const homeTac = side === 'home' ? nextTactics : session.homeTactics;
  const awayTac = side === 'away' ? nextTactics : session.awayTactics;
  const nextRadar = updateRadarSmoothly(
    session.radarPlayers,
    homeTac,
    awayTac,
    session.possessionSide,
    session.ballX,
    session.ballY,
    undefined,
    session.playerStats
  );

  return {
    ...session,
    homeTactics: homeTac,
    awayTactics: awayTac,
    radarPlayers: nextRadar,
    events: [...session.events, tacEvent],
    activeEvent: tacEvent,
    activeSegmentIndex: 0,
  };
}

/**
 * Knuth O(k) Poisson sample for ultra-fast realistic goal distribution.
 */
function samplePoisson(lambda: number): number {
  const L = Math.exp(-clamp(lambda, 0.15, 4.8));
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= Math.random();
  } while (p > L && k < 8);
  return k - 1;
}

/**
 * ULTRA-FAST O(1) sub-millisecond simulator for ~150 AI matches per matchday across all 18 leagues.
 * Never scans the entire 7,000-player map: reads ONLY the 22 startingXI IDs via direct hash lookups!
 */
export function simulateQuickMatch(
  fixture: Fixture,
  clubs: Record<string, Club>,
  players: Record<string, Player>
): Fixture {
  const homeClub = clubs[fixture.homeClubId];
  const awayClub = clubs[fixture.awayClubId];

  if (!homeClub || !awayClub) {
    return { ...fixture, played: true, homeGoals: 1, awayGoals: 1 };
  }

  const homeStr = computeTacticalStrength(homeClub.tactics, players);
  const awayStr = computeTacticalStrength(awayClub.tactics, players);

  // Extract the 11 starters via O(1) lookups
  const getStarters = (club: Club): Player[] => {
    const out: Player[] = [];
    const xi = club.tactics.startingXI;
    for (let i = 0; i < xi.length; i++) {
      const pid = xi[i].playerId;
      if (pid) {
        const p = players[pid];
        if (p) out.push(p);
      }
    }
    return out;
  };

  const homeXI = getStarters(homeClub);
  const awayXI = getStarters(awayClub);

  // Compute expected goals lambdas from tactical strengths + slight home advantage
  const homeEdge =
    (homeStr.attack + homeStr.midfield * 0.45 - (awayStr.defense + awayStr.goalkeeper * 0.55)) / 42;
  const awayEdge =
    (awayStr.attack + awayStr.midfield * 0.45 - (homeStr.defense + homeStr.goalkeeper * 0.55)) / 42;

  const homeLambda = clamp(1.48 * Math.exp(homeEdge * 0.74), 0.35, 3.8);
  const awayLambda = clamp(1.18 * Math.exp(awayEdge * 0.74), 0.28, 3.4);

  const homeGoals = samplePoisson(homeLambda);
  const awayGoals = samplePoisson(awayLambda);

  const goals: FixtureGoal[] = [];
  const pickScorerAndAssister = (xi: Player[], clubId: string, count: number) => {
    if (xi.length === 0 || count === 0) return;
    const outfield = xi.length > 1 ? xi.slice(1) : xi;

    for (let g = 0; g < count; g++) {
      let totalScorerW = 0;
      const weights = outfield.map((p) => {
        const cat = getPositionCategory(p.positions[0] ?? 'MC');
        const posW = cat === 'FWD' ? 4.8 : cat === 'MID' ? 2.1 : 0.45;
        const w = posW * (0.5 + p.attributes.technical.finishing / 16);
        totalScorerW += w;
        return w;
      });

      let r = Math.random() * totalScorerW;
      let scorer = outfield[0];
      for (let i = 0; i < outfield.length; i++) {
        r -= weights[i];
        if (r <= 0) {
          scorer = outfield[i];
          break;
        }
      }

      let assister: Player | undefined;
      if (Math.random() < 0.76 && outfield.length > 1) {
        const candidates = outfield.filter((p) => p.id !== scorer.id);
        let totalAstW = 0;
        const astWeights = candidates.map((p) => {
          const cat = getPositionCategory(p.positions[0] ?? 'MC');
          const posW = cat === 'MID' ? 3.2 : cat === 'FWD' ? 2.4 : 1.1;
          const w =
            posW *
            (0.4 +
              (p.attributes.mental.creativity + p.attributes.technical.passing) / 30);
          totalAstW += w;
          return w;
        });
        let ra = Math.random() * totalAstW;
        assister = candidates[0];
        for (let i = 0; i < candidates.length; i++) {
          ra -= astWeights[i];
          if (ra <= 0) {
            assister = candidates[i];
            break;
          }
        }
      }

      goals.push({
        minute: randInt(2, 90),
        scorerId: scorer.id,
        scorerName: scorer.shortName,
        assistId: assister?.id,
        assistName: assister?.shortName,
        clubId,
        isPenalty: Math.random() < 0.1,
      });
    }
  };

  pickScorerAndAssister(homeXI, homeClub.id, homeGoals);
  pickScorerAndAssister(awayXI, awayClub.id, awayGoals);
  goals.sort((a, b) => a.minute - b.minute);

  const cards: FixtureCard[] = [];
  const generateCards = (xi: Player[], club: Club): { yellows: number; reds: number } => {
    let yellows = 0;
    let reds = 0;
    const outfield = xi.length > 1 ? xi.slice(1) : xi;
    if (outfield.length === 0) return { yellows, reds };

    const hardBonus =
      club.tactics.instructions.tackling === 'Hard'
        ? 0.65
        : club.tactics.instructions.tackling === 'Easy'
        ? -0.45
        : 0;
    const yellowCount = clamp(Math.round(1.4 + hardBonus + (Math.random() - 0.5) * 2.4), 0, 5);
    const booked = new Set<string>();

    for (let i = 0; i < yellowCount; i++) {
      const p = outfield[Math.floor(Math.random() * outfield.length)];
      if (booked.has(p.id)) continue;
      booked.add(p.id);
      yellows++;
      cards.push({
        minute: randInt(12, 89),
        playerId: p.id,
        playerName: p.shortName,
        clubId: club.id,
        card: 'yellow',
      });
    }

    if (Math.random() < (club.tactics.instructions.tackling === 'Hard' ? 0.065 : 0.032)) {
      const p = outfield[Math.floor(Math.random() * outfield.length)];
      reds++;
      cards.push({
        minute: randInt(28, 88),
        playerId: p.id,
        playerName: p.shortName,
        clubId: club.id,
        card: 'red',
      });
    }
    return { yellows, reds };
  };

  const homeCards = generateCards(homeXI, homeClub);
  const awayCards = generateCards(awayXI, awayClub);
  cards.sort((a, b) => a.minute - b.minute);

  // Realistic derived match statistics
  const midDiff = homeStr.midfield - awayStr.midfield;
  const homePoss = Math.round(clamp(51 + midDiff * 0.45 + (Math.random() - 0.5) * 10, 32, 68));
  const awayPoss = 100 - homePoss;

  const homeShots = Math.max(homeGoals + 2, Math.round(homeLambda * 7.5 + randInt(1, 5)));
  const awayShots = Math.max(awayGoals + 2, Math.round(awayLambda * 7.2 + randInt(1, 5)));
  const homeSot = Math.min(homeShots, Math.max(homeGoals, Math.round(homeShots * (0.34 + Math.random() * 0.2))));
  const awaySot = Math.min(awayShots, Math.max(awayGoals, Math.round(awayShots * (0.34 + Math.random() * 0.2))));

  const homePassesAtt = Math.round(240 + homePoss * 4.8 + randInt(-30, 35));
  const awayPassesAtt = Math.round(240 + awayPoss * 4.8 + randInt(-30, 35));
  const homePassPct = clamp(0.73 + (homeStr.cohesion - 60) * 0.0025, 0.68, 0.9);
  const awayPassPct = clamp(0.73 + (awayStr.cohesion - 60) * 0.0025, 0.68, 0.9);

  const homeStats: MatchTeamStats = {
    possession: homePoss,
    shots: homeShots,
    shotsOnTarget: homeSot,
    corners: randInt(2, 9),
    fouls: randInt(7, 15),
    yellowCards: homeCards.yellows,
    redCards: homeCards.reds,
    tacklesWon: randInt(11, 24),
    passesAttempted: homePassesAtt,
    passesCompleted: Math.round(homePassesAtt * homePassPct),
    xg: round2(clamp(homeLambda * (0.78 + Math.random() * 0.45) + homeGoals * 0.22, 0.2, 4.9)),
  };

  const awayStats: MatchTeamStats = {
    possession: awayPoss,
    shots: awayShots,
    shotsOnTarget: awaySot,
    corners: randInt(2, 8),
    fouls: randInt(7, 15),
    yellowCards: awayCards.yellows,
    redCards: awayCards.reds,
    tacklesWon: randInt(11, 24),
    passesAttempted: awayPassesAtt,
    passesCompleted: Math.round(awayPassesAtt * awayPassPct),
    xg: round2(clamp(awayLambda * (0.78 + Math.random() * 0.45) + awayGoals * 0.22, 0.15, 4.6)),
  };

  // Pick Man of the Match (prefer top scorer on winning side, else highest rated starter)
  const winningClubId =
    homeGoals > awayGoals ? homeClub.id : awayGoals > homeGoals ? awayClub.id : null;
  const scoringCounts = new Map<string, number>();
  for (const g of goals) {
    const bonus = winningClubId && g.clubId === winningClubId ? 1.5 : 1;
    scoringCounts.set(g.scorerId, (scoringCounts.get(g.scorerId) ?? 0) + bonus);
  }
  let motmId: string | undefined;
  let bestScore = -1;
  for (const [pid, sc] of scoringCounts.entries()) {
    if (sc > bestScore) {
      bestScore = sc;
      motmId = pid;
    }
  }
  if (!motmId) {
    const pool = winningClubId === awayClub.id ? awayXI : homeXI;
    motmId = pool[0]?.id;
  }
  const motmRating = round1(clamp(7.5 + (bestScore > 0 ? bestScore * 0.55 : 0.3) + Math.random() * 0.5, 7.4, 9.8));

  return {
    ...fixture,
    played: true,
    homeGoals,
    awayGoals,
    attendance: estimateAttendance(homeClub, awayClub),
    goals,
    cards,
    manOfTheMatchId: motmId,
    manOfTheMatchRating: motmRating,
    homeStats,
    awayStats,
  };
}

// Compile-time contract conformance check
export const _matchEngineContract: MatchEngineModule = {
  createMatchSession,
  stepMatchTick,
  applyLiveSubstitution,
  applyLiveTacticsChange,
  simulateQuickMatch,
};
