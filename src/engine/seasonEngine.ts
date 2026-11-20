/**
 * Championship Manager 01/02 — Season Scheduler, Standings, Calendar Engine, Transfers & Training
 * Implements SeasonEngineModule from src/types/contracts.ts
 */

import type {
  AdvanceDayResult,
  ContractEvaluationResult,
  SeasonEngineModule,
  TransferEvaluationResult,
  WeeklyTrainingResult,
} from '../types/contracts';
import type {
  Club,
  ContractOffer,
  Fixture,
  GameState,
  League,
  LeagueId,
  MatchSessionState,
  MoraleLevel,
  NewsItem,
  Player,
  StandingRow,
  TrainingFocus,
  TrainingGroupKey,
  TrainingImprovement,
  TransferOffer,
} from '../types/game';
import {
  estimatePlayerValue,
  estimateWeeklyWage,
  getPositionCategory,
} from './attributes';
import { simulateQuickMatch } from './matchEngine';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

const MORALE_ORDER: MoraleLevel[] = [
  'Very Poor',
  'Poor',
  'Okay',
  'Good',
  'Very Good',
  'Superb',
];

const INJURY_TYPES = [
  { type: 'Pulled Hamstring', minDays: 10, maxDays: 21 },
  { type: 'Groin Strain', minDays: 7, maxDays: 16 },
  { type: 'Twisted Ankle', minDays: 8, maxDays: 18 },
  { type: 'Thigh Bruise', minDays: 4, maxDays: 9 },
  { type: 'Calf Strain', minDays: 7, maxDays: 15 },
  { type: 'Knee Twist', minDays: 14, maxDays: 28 },
];

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function parseIsoUtc(isoDate: string): Date {
  const [y, m, d] = isoDate.split('-').map((n) => Number.parseInt(n, 10));
  return new Date(Date.UTC(y || 2026, (m || 8) - 1, d || 1));
}

function formatIsoUtc(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addDaysIso(isoDate: string, days: number): string {
  const dt = parseIsoUtc(isoDate);
  dt.setUTCDate(dt.getUTCDate() + days);
  return formatIsoUtc(dt);
}

function shiftMorale(current: MoraleLevel, delta: number): MoraleLevel {
  const idx = MORALE_ORDER.indexOf(current);
  const nextIdx = clamp((idx === -1 ? 3 : idx) + delta, 0, MORALE_ORDER.length - 1);
  return MORALE_ORDER[nextIdx];
}

export function formatCurrency(amount: number): string {
  if (!Number.isFinite(amount)) return '€0';
  const sign = amount < 0 ? '-' : '';
  const abs = Math.abs(amount);

  if (abs >= 1_000_000) {
    const millions = abs / 1_000_000;
    const formatted =
      millions >= 100
        ? Math.round(millions).toString()
        : millions >= 10
        ? (Math.round(millions * 10) / 10).toString().replace(/\.0$/, '')
        : (Math.round(millions * 100) / 100).toString().replace(/(\.\d*[1-9])0+$|\.0+$/, '$1');
    return `${sign}€${formatted}M`;
  }
  if (abs >= 1_000) {
    const thousands = abs / 1_000;
    const formatted =
      thousands >= 100
        ? Math.round(thousands).toString()
        : (Math.round(thousands * 10) / 10).toString().replace(/\.0$/, '');
    return `${sign}€${formatted}K`;
  }
  return `${sign}€${Math.round(abs)}`;
}

export function formatDateCM(isoDate: string): string {
  if (!isoDate || isoDate.length < 10) return isoDate || '';
  const dt = parseIsoUtc(isoDate);
  const dayName = DAY_NAMES[dt.getUTCDay()];
  const dayNum = String(dt.getUTCDate()).padStart(2, '0');
  const monthName = MONTH_NAMES[dt.getUTCMonth()];
  const year = dt.getUTCFullYear();
  return `${dayName} ${dayNum} ${monthName} ${year}`;
}

/**
 * Generates a balanced single round-robin using the standard Circle / Berger algorithm.
 * Returns array of rounds; each round is array of [homeClubId, awayClubId].
 */
function buildSingleRoundRobin(clubIds: string[]): Array<Array<[string, string]>> {
  const teams = [...clubIds];
  if (teams.length % 2 === 1) {
    teams.push('__BYE__');
  }
  const n = teams.length;
  const numRounds = n - 1;
  const half = n / 2;

  const fixed = teams[0];
  const rotating = teams.slice(1);
  const rounds: Array<Array<[string, string]>> = [];

  for (let r = 0; r < numRounds; r++) {
    const roundPairs: Array<[string, string]> = [];
    const circle = [fixed, ...rotating];

    for (let i = 0; i < half; i++) {
      const t1 = circle[i];
      const t2 = circle[n - 1 - i];
      if (t1 === '__BYE__' || t2 === '__BYE__') continue;

      // Alternate home/away cleanly each round using Berger parity
      const flip = i === 0 ? r % 2 === 1 : (r + i) % 2 === 1;
      roundPairs.push(flip ? [t2, t1] : [t1, t2]);
    }

    rounds.push(roundPairs);
    // Rotate clockwise
    const last = rotating.pop();
    if (last !== undefined) rotating.unshift(last);
  }

  return rounds;
}

/**
 * Computes realistic Saturday/Wednesday matchday calendar dates for a league's rounds
 * spanning August 2026 -> May 2027.
 */
function buildRoundCalendar(totalRounds: number, firstMatchdayIso: string): string[] {
  // Snap firstMatchdayIso to Saturday (UTC day 6)
  const startDt = parseIsoUtc(firstMatchdayIso);
  const startDow = startDt.getUTCDay();
  const offsetToSat = (6 - startDow + 7) % 7;
  const firstSat = addDaysIso(firstMatchdayIso, offsetToSat);

  // Build 40 Saturday weekend dates + midweek Wednesday dates between them
  const weekendDates: string[] = [];
  for (let w = 0; w < 42; w++) {
    weekendDates.push(addDaysIso(firstSat, w * 7));
  }

  if (totalRounds <= 38) {
    // Spread nicely across the 40-week European season (Aug -> May)
    const dates: string[] = [];
    const maxWeekIdx = Math.min(39, Math.max(totalRounds - 1, 36));
    for (let r = 0; r < totalRounds; r++) {
      const weekIdx =
        totalRounds === 1 ? 0 : Math.round((r / (totalRounds - 1)) * maxWeekIdx);
      dates.push(weekendDates[weekIdx]);
    }
    // Guarantee strictly increasing dates (bump collisions by +3 or +7 days)
    for (let i = 1; i < dates.length; i++) {
      if (dates[i] <= dates[i - 1]) {
        dates[i] = addDaysIso(dates[i - 1], 7);
      }
    }
    return dates;
  }

  // Dense leagues (42-match Segunda, 46-match EFL Championship):
  // Interleave midweek Wednesday fixtures evenly among the 40 Saturdays
  const extraMidweeks = totalRounds - 39;
  const midweekSlotIndices = new Set<number>();
  for (let m = 0; m < extraMidweeks; m++) {
    const slot = Math.min(38, Math.max(1, Math.round(((m + 1) / (extraMidweeks + 1)) * 37)));
    midweekSlotIndices.add(slot);
  }
  let fallbackSlot = 2;
  while (midweekSlotIndices.size < extraMidweeks && fallbackSlot < 39) {
    midweekSlotIndices.add(fallbackSlot);
    fallbackSlot += 2;
  }

  const dates: string[] = [];
  for (let w = 0; w < 40 && dates.length < totalRounds; w++) {
    dates.push(weekendDates[w]);
    if (midweekSlotIndices.has(w) && dates.length < totalRounds) {
      dates.push(addDaysIso(weekendDates[w], 4)); // Wednesday night under floodlights
    }
  }
  while (dates.length < totalRounds) {
    dates.push(addDaysIso(dates[dates.length - 1], 4));
  }
  return dates;
}

const WEEKEND_KICKOFFS = ['12:30', '15:00', '15:00', '15:00', '15:00', '17:30', '20:00'];
const MIDWEEK_KICKOFFS = ['19:45', '19:45', '20:00', '20:00'];

export function generateSeasonFixtures(
  leagues: Record<LeagueId, League>,
  clubs: Record<string, Club>,
  seasonStartDate = '2026-08-08'
): Fixture[] {
  const allFixtures: Fixture[] = [];

  for (const leagueId of Object.keys(leagues)) {
    const league = leagues[leagueId];
    // Collect valid clubIds belonging to this league
    const clubIds =
      league.clubIds && league.clubIds.length > 0
        ? league.clubIds.filter((id) => Boolean(clubs[id]))
        : Object.values(clubs)
            .filter((c) => c.leagueId === leagueId)
            .map((c) => c.id);

    if (clubIds.length < 2) continue;

    // Deterministic light shuffle based on leagueId so fixtures don't mirror alphabetical order
    const orderedIds = [...clubIds];
    let hash = 0;
    for (let i = 0; i < leagueId.length; i++) {
      hash = (hash * 31 + leagueId.charCodeAt(i)) >>> 0;
    }
    for (let i = orderedIds.length - 1; i > 0; i--) {
      hash = (hash * 1664525 + 1013904223) >>> 0;
      const j = hash % (i + 1);
      const tmp = orderedIds[i];
      orderedIds[i] = orderedIds[j];
      orderedIds[j] = tmp;
    }

    const baseCycle = buildSingleRoundRobin(orderedIds);
    const numCycles = Math.max(1, league.rounds || (orderedIds.length <= 10 ? 4 : 2));
    const fullRounds: Array<Array<[string, string]>> = [];

    for (let cycle = 0; cycle < numCycles; cycle++) {
      const reverseHomeAway = cycle % 2 === 1;
      for (const roundPairs of baseCycle) {
        fullRounds.push(
          roundPairs.map(([h, a]) => (reverseHomeAway ? [a, h] : [h, a]))
        );
      }
    }

    const roundDates = buildRoundCalendar(fullRounds.length, seasonStartDate);

    for (let rIdx = 0; rIdx < fullRounds.length; rIdx++) {
      const roundNum = rIdx + 1;
      const baseDate = roundDates[rIdx];
      const dow = parseIsoUtc(baseDate).getUTCDay();
      const isWeekend = dow === 6 || dow === 0;
      const pairs = fullRounds[rIdx];

      for (let mIdx = 0; mIdx < pairs.length; mIdx++) {
        const [homeClubId, awayClubId] = pairs[mIdx];
        // For Tier 1 weekend rounds, shift ~2 featured fixtures to Sunday for realism
        const isSundaySlot =
          isWeekend && league.tier === 1 && pairs.length >= 8 && mIdx >= pairs.length - 2;
        const matchDate = isSundaySlot ? addDaysIso(baseDate, 1) : baseDate;
        const kickoffTime = isWeekend
          ? isSundaySlot
            ? mIdx === pairs.length - 1
              ? '16:30'
              : '14:00'
            : WEEKEND_KICKOFFS[mIdx % WEEKEND_KICKOFFS.length]
          : MIDWEEK_KICKOFFS[mIdx % MIDWEEK_KICKOFFS.length];

        allFixtures.push({
          id: `fix-${leagueId}-r${roundNum}-${mIdx}`,
          leagueId,
          round: roundNum,
          date: matchDate,
          kickoffTime,
          homeClubId,
          awayClubId,
          played: false,
          homeGoals: 0,
          awayGoals: 0,
          goals: [],
          cards: [],
        });
      }
    }
  }

  allFixtures.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    if (a.kickoffTime !== b.kickoffTime) return a.kickoffTime < b.kickoffTime ? -1 : 1;
    return a.id < b.id ? -1 : 1;
  });

  return allFixtures;
}

function buildLeagueTableFromFixtures(
  leagueId: LeagueId,
  clubs: Record<string, Club>,
  leagueFixtures: Fixture[]
): StandingRow[] {
  const rowsByClub = new Map<string, StandingRow>();

  for (const id in clubs) {
    const c = clubs[id];
    if (c.leagueId === leagueId) {
      rowsByClub.set(c.id, {
        position: 0,
        clubId: c.id,
        clubName: c.name,
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        goalDifference: 0,
        points: 0,
        form: [],
      });
    }
  }

  for (let i = 0; i < leagueFixtures.length; i++) {
    const f = leagueFixtures[i];
    if (!f.played) continue;

    const home = rowsByClub.get(f.homeClubId);
    const away = rowsByClub.get(f.awayClubId);
    if (!home || !away) continue;

    home.played += 1;
    away.played += 1;
    home.goalsFor += f.homeGoals;
    home.goalsAgainst += f.awayGoals;
    away.goalsFor += f.awayGoals;
    away.goalsAgainst += f.homeGoals;

    if (f.homeGoals > f.awayGoals) {
      home.won += 1;
      home.points += 3;
      away.lost += 1;
      home.form.push('W');
      away.form.push('L');
    } else if (f.homeGoals < f.awayGoals) {
      away.won += 1;
      away.points += 3;
      home.lost += 1;
      home.form.push('L');
      away.form.push('W');
    } else {
      home.drawn += 1;
      away.drawn += 1;
      home.points += 1;
      away.points += 1;
      home.form.push('D');
      away.form.push('D');
    }

    if (home.form.length > 5) home.form.shift();
    if (away.form.length > 5) away.form.shift();
  }

  const table = Array.from(rowsByClub.values());
  for (const row of table) {
    row.goalDifference = row.goalsFor - row.goalsAgainst;
  }

  table.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
    if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
    if (b.won !== a.won) return b.won - a.won;
    return a.clubName.localeCompare(b.clubName);
  });

  for (let i = 0; i < table.length; i++) {
    table[i].position = i + 1;
  }

  return table;
}

export function recalculateStandings(
  leagueId: LeagueId,
  clubs: Record<string, Club>,
  fixtures: Fixture[]
): StandingRow[] {
  const leagueFixtures: Fixture[] = [];
  for (let i = 0; i < fixtures.length; i++) {
    const f = fixtures[i];
    if (f.played && f.leagueId === leagueId) {
      leagueFixtures.push(f);
    }
  }
  return buildLeagueTableFromFixtures(leagueId, clubs, leagueFixtures);
}

export function recalculateAllStandings(
  leagues: Record<LeagueId, League>,
  clubs: Record<string, Club>,
  fixtures: Fixture[]
): Record<LeagueId, StandingRow[]> {
  const byLeague: Record<LeagueId, Fixture[]> = {};
  for (const lid in leagues) {
    byLeague[lid] = [];
  }
  for (let i = 0; i < fixtures.length; i++) {
    const f = fixtures[i];
    if (f.played && byLeague[f.leagueId]) {
      byLeague[f.leagueId].push(f);
    }
  }

  const result: Record<LeagueId, StandingRow[]> = {};
  for (const lid in leagues) {
    result[lid] = buildLeagueTableFromFixtures(lid, clubs, byLeague[lid]);
  }
  return result;
}

function getPlayerTrainingGroup(player: Player): TrainingGroupKey {
  const cat = getPositionCategory(player.positions[0] ?? 'MC');
  if (cat === 'GK') return 'Goalkeepers';
  if (cat === 'DEF') return 'Defenders';
  if (cat === 'MID') return 'Midfielders';
  return 'Forwards';
}

const FOCUS_ATTR_MAP: Record<
  Exclude<TrainingFocus, 'Rest'>,
  Array<{ group: 'technical' | 'mental' | 'physical' | 'goalkeeping'; key: string; label: string }>
> = {
  General: [
    { group: 'technical', key: 'passing', label: 'Passing' },
    { group: 'technical', key: 'technique', label: 'Technique' },
    { group: 'mental', key: 'decisions', label: 'Decisions' },
    { group: 'mental', key: 'teamwork', label: 'Teamwork' },
    { group: 'physical', key: 'stamina', label: 'Stamina' },
  ],
  Fitness: [
    { group: 'physical', key: 'stamina', label: 'Stamina' },
    { group: 'physical', key: 'strength', label: 'Strength' },
    { group: 'physical', key: 'pace', label: 'Pace' },
    { group: 'physical', key: 'acceleration', label: 'Acceleration' },
    { group: 'physical', key: 'agility', label: 'Agility' },
  ],
  Tactics: [
    { group: 'mental', key: 'anticipation', label: 'Anticipation' },
    { group: 'mental', key: 'decisions', label: 'Decisions' },
    { group: 'mental', key: 'teamwork', label: 'Teamwork' },
    { group: 'technical', key: 'marking', label: 'Marking' },
    { group: 'technical', key: 'offTheBall', label: 'Off the Ball' },
  ],
  Skills: [
    { group: 'technical', key: 'dribbling', label: 'Dribbling' },
    { group: 'technical', key: 'technique', label: 'Technique' },
    { group: 'technical', key: 'passing', label: 'Passing' },
    { group: 'technical', key: 'crossing', label: 'Crossing' },
    { group: 'mental', key: 'creativity', label: 'Creativity' },
  ],
  Shooting: [
    { group: 'technical', key: 'finishing', label: 'Finishing' },
    { group: 'technical', key: 'longShots', label: 'Long Shots' },
    { group: 'technical', key: 'penalties', label: 'Penalties' },
    { group: 'technical', key: 'heading', label: 'Heading' },
    { group: 'technical', key: 'setPieces', label: 'Set Pieces' },
  ],
  Goalkeeping: [
    { group: 'goalkeeping', key: 'handling', label: 'Handling' },
    { group: 'goalkeeping', key: 'reflexes', label: 'Reflexes' },
    { group: 'goalkeeping', key: 'oneOnOnes', label: 'One on Ones' },
    { group: 'goalkeeping', key: 'positioning', label: 'Positioning' },
    { group: 'physical', key: 'agility', label: 'Agility' },
  ],
};

export function processWeeklyTraining(
  club: Club,
  squad: Player[],
  date: string
): WeeklyTrainingResult {
  const newImprovements: TrainingImprovement[] = [];
  const injuredInTraining: string[] = [];

  const updatedPlayers = squad.map((player) => {
    const groupKey = getPlayerTrainingGroup(player);
    const groupCfg = club.training.groups[groupKey];
    const focus: TrainingFocus =
      club.training.playerFocusOverrides[player.id] ?? groupCfg?.focus ?? 'General';
    const intensity = groupCfg?.intensity ?? club.training.overallIntensity ?? 'Medium';

    if (player.injury) {
      return player;
    }

    let nextCondition = player.condition;
    if (focus === 'Rest') {
      nextCondition = clamp(player.condition + 8, 50, 100);
      return { ...player, condition: round1(nextCondition) };
    }

    if (intensity === 'Light') nextCondition = clamp(player.condition + 3, 45, 100);
    else if (intensity === 'Medium') nextCondition = clamp(player.condition - 1, 45, 100);
    else nextCondition = clamp(player.condition - 4.5, 42, 100);

    // Small injury risk on Intensive training
    const knockProb =
      (intensity === 'Intensive' ? 0.018 : intensity === 'Medium' ? 0.004 : 0.001) *
      (player.attributes.physical.injuryProneness / 10);

    if (Math.random() < knockProb) {
      const inj = INJURY_TYPES[randInt(0, INJURY_TYPES.length - 1)];
      injuredInTraining.push(`${player.shortName} (${inj.type})`);
      return {
        ...player,
        condition: round1(Math.max(40, nextCondition - 10)),
        injury: { type: inj.type, daysRemaining: randInt(inj.minDays, inj.maxDays) },
      };
    }

    // Attribute development roll for players with PA headroom (strongest for U24 wonderkids)
    const pa = player.potentialAbility ?? player.currentAbility + (player.age <= 22 ? 12 : 2);
    const headroom = Math.max(0, pa - player.currentAbility);
    const intensityMult = intensity === 'Intensive' ? 1.45 : intensity === 'Medium' ? 1.0 : 0.6;
    const ageMult =
      player.age <= 20
        ? 1.55
        : player.age <= 23
        ? 1.15
        : player.age <= 26
        ? 0.65
        : player.age <= 29
        ? 0.22
        : 0.05;
    const mentalDrive =
      (player.attributes.mental.determination + player.attributes.mental.workRate) / 30;
    const growProb = clamp(
      0.065 * intensityMult * ageMult * mentalDrive * Math.min(1.4, headroom / 12 + 0.15),
      0,
      0.32
    );

    if (headroom > 0 && Math.random() < growProb) {
      const candidates = FOCUS_ATTR_MAP[focus] ?? FOCUS_ATTR_MAP.General;
      const chosen = candidates[randInt(0, candidates.length - 1)];
      const clonedAttrs = {
        technical: { ...player.attributes.technical },
        mental: { ...player.attributes.mental },
        physical: { ...player.attributes.physical },
        goalkeeping: player.attributes.goalkeeping
          ? { ...player.attributes.goalkeeping }
          : undefined,
      };

      let improved = false;
      if (chosen.group === 'technical') {
        const k = chosen.key as keyof typeof clonedAttrs.technical;
        if (clonedAttrs.technical[k] < 20) {
          clonedAttrs.technical[k] += 1;
          improved = true;
        }
      } else if (chosen.group === 'mental') {
        const k = chosen.key as keyof typeof clonedAttrs.mental;
        if (clonedAttrs.mental[k] < 20) {
          clonedAttrs.mental[k] += 1;
          improved = true;
        }
      } else if (chosen.group === 'physical') {
        const k = chosen.key as keyof typeof clonedAttrs.physical;
        if (clonedAttrs.physical[k] < 20) {
          clonedAttrs.physical[k] += 1;
          improved = true;
        }
      } else if (chosen.group === 'goalkeeping' && clonedAttrs.goalkeeping) {
        const k = chosen.key as keyof typeof clonedAttrs.goalkeeping;
        if (clonedAttrs.goalkeeping[k] < 20) {
          clonedAttrs.goalkeeping[k] += 1;
          improved = true;
        }
      }

      if (improved) {
        newImprovements.push({
          playerId: player.id,
          playerName: player.name,
          attribute: chosen.label,
          delta: 1,
          date,
        });
        return {
          ...player,
          condition: round1(nextCondition),
          currentAbility: Math.min(pa, player.currentAbility + 1),
          attributes: clonedAttrs,
        };
      }
    }

    // Gentle veteran physical decline (age >= 34)
    if (player.age >= 34 && Math.random() < 0.025 * (1.2 - player.attributes.physical.naturalFitness / 25)) {
      const decKeys: Array<keyof typeof player.attributes.physical> = [
        'pace',
        'acceleration',
        'stamina',
      ];
      const dk = decKeys[randInt(0, decKeys.length - 1)];
      if (player.attributes.physical[dk] > 6) {
        return {
          ...player,
          condition: round1(nextCondition),
          attributes: {
            ...player.attributes,
            physical: {
              ...player.attributes.physical,
              [dk]: player.attributes.physical[dk] - 1,
            },
          },
        };
      }
    }

    return { ...player, condition: round1(nextCondition) };
  });

  const mergedImprovements = [...newImprovements, ...club.training.recentImprovements].slice(0, 25);

  const reportParts: string[] = [];
  if (newImprovements.length > 0) {
    const highlights = newImprovements
      .slice(0, 4)
      .map((im) => `${im.playerName} (+1 ${im.attribute})`)
      .join(', ');
    reportParts.push(`Notable progress on the training pitch: ${highlights}.`);
  } else {
    reportParts.push(`Steady week of ${club.training.overallIntensity.toLowerCase()} training with good squad sharpness.`);
  }
  if (injuredInTraining.length > 0) {
    reportParts.push(`Training knocks reported: ${injuredInTraining.join(', ')}.`);
  }

  const lastWeeklyReport = reportParts.join(' ');
  const updatedTraining = {
    ...club.training,
    lastWeeklyReport,
    recentImprovements: mergedImprovements,
  };

  let newsItem: NewsItem | undefined;
  if (newImprovements.length > 0 || injuredInTraining.length > 0) {
    newsItem = {
      id: `news-train-${date}-${Math.floor(Math.random() * 10000)}`,
      date,
      headline:
        injuredInTraining.length > 0
          ? `Training Ground Injury Alert at ${club.shortName}`
          : `Weekly Training Report: ${newImprovements.length} Player${newImprovements.length > 1 ? 's' : ''} Impressed`,
      body: lastWeeklyReport,
      category: injuredInTraining.length > 0 ? 'injury' : 'training',
      read: false,
      relatedClubId: club.id,
      relatedPlayerId: newImprovements[0]?.playerId,
      importance: injuredInTraining.length > 0 ? 'high' : 'normal',
    };
  }

  return { updatedPlayers, updatedTraining, newsItem };
}

export function evaluateTransferOffer(
  offer: TransferOffer,
  player: Player,
  sellingClub: Club,
  buyingClub: Club
): TransferEvaluationResult {
  // Automatic release clause trigger!
  if (player.releaseClause && player.releaseClause > 0 && offer.fee >= player.releaseClause) {
    return {
      status: 'accepted',
      message: `${sellingClub.name} have no choice but to accept your ${formatCurrency(offer.fee)} offer after meeting ${player.name}'s minimum fee release clause.`,
    };
  }

  // Calculate fair asking price
  const baseVal = Math.max(player.value, estimatePlayerValue(player, 14));
  let askingPrice = baseVal * 1.12;

  if (player.transferListed) askingPrice *= 0.76;
  if (player.squadStatus === 'Not Needed') askingPrice *= 0.78;
  else if (player.squadStatus === 'Backup') askingPrice *= 0.92;
  else if (player.squadStatus === 'Indispensable') askingPrice *= 1.38;
  else if (player.squadStatus === 'Important First Team') askingPrice *= 1.18;

  if (player.isWonderkid || (player.age <= 21 && (player.potentialAbility ?? 0) >= 160)) {
    askingPrice *= 1.25;
  }

  // Contract expiring soon reduces leverage
  if (player.contractExpires) {
    const expiryYear = Number.parseInt(player.contractExpires.slice(0, 4), 10);
    if (!Number.isNaN(expiryYear) && expiryYear <= 2027) {
      askingPrice *= 0.78;
    }
  }

  // Rival tax
  const isRival =
    sellingClub.rivals.includes(buyingClub.id) || buyingClub.rivals.includes(sellingClub.id);
  if (isRival) {
    askingPrice *= 1.35;
  }

  // Compute present value of the incoming bid
  let effectiveBid = offer.fee;
  if (offer.installments && offer.installments.amount > 0) {
    const m = offer.installments.months;
    const disc = m <= 6 ? 0.92 : m <= 12 ? 0.85 : m <= 18 ? 0.78 : 0.72;
    effectiveBid += offer.installments.amount * disc;
  }
  if (offer.sellOnPercent > 0) {
    const youthFactor = player.age <= 22 ? 1.35 : player.age <= 26 ? 0.85 : 0.35;
    effectiveBid += (offer.sellOnPercent / 100) * baseVal * 0.42 * youthFactor;
  }

  const ratio = effectiveBid / Math.max(10_000, askingPrice);

  if (ratio >= 0.95) {
    return {
      status: 'accepted',
      message: `${sellingClub.name} have ACCEPTED your transfer bid (${formatCurrency(offer.fee)}${
        offer.installments?.amount
          ? ` + ${formatCurrency(offer.installments.amount)} over ${offer.installments.months}m`
          : ''
      }${offer.sellOnPercent > 0 ? ` + ${offer.sellOnPercent}% sell-on` : ''}) for ${player.name}. You now have permission to negotiate personal terms.`,
    };
  }

  if (ratio >= 0.68) {
    const rawCounter = Math.max(offer.fee * 1.12, askingPrice * 0.97);
    const step = rawCounter >= 10_000_000 ? 500_000 : rawCounter >= 1_000_000 ? 100_000 : 25_000;
    const counterFee = Math.round(rawCounter / step) * step;

    return {
      status: 'countered',
      counterFee,
      message: `${sellingClub.name} have COUNTERED your offer for ${player.name}. ${
        isRival ? 'Given the fierce rivalry between the clubs, they' : 'Their board'
      } are demanding ${formatCurrency(counterFee)} upfront to sanction a deal.`,
    };
  }

  return {
    status: 'rejected',
    message: `${sellingClub.name} have REJECTED your ${formatCurrency(offer.fee)} bid for ${player.name} out of hand. They value the player closer to ${formatCurrency(Math.round(askingPrice / 50_000) * 50_000)}.`,
  };
}

export function evaluateContractOffer(
  offer: ContractOffer,
  player: Player,
  club: Club
): ContractEvaluationResult {
  const isFreeAgent = player.clubId === null;
  const isRenewal = player.clubId === club.id;

  // Huge prestige mismatch rejection (unless free agent or renewal)
  if (!isFreeAgent && !isRenewal && player.reputation - club.reputation > 3200) {
    return {
      accepted: false,
      message: `${player.name}'s agent informs you that the player has no interest in joining ${club.name} at this stage of his career, citing a desire to play at a higher level.`,
    };
  }

  // Baseline desired weekly wage
  let demandedWage = Math.max(player.wage, estimateWeeklyWage(player));
  if (isFreeAgent) {
    demandedWage *= 0.88; // Unattached players eager to sign
  } else if (isRenewal) {
    demandedWage *= 1.06; // Modest pay bump for renewal
  } else {
    demandedWage *= 1.12; // Relocation / transfer raise
  }

  // Reputation adjustment
  const repDiff = club.reputation - player.reputation;
  if (repDiff > 1200) demandedWage *= 0.93;
  else if (repDiff < -1200) demandedWage *= 1.2;

  // Squad status expectation vs player quality
  const statusRank: Record<ContractOffer['squadStatus'], number> = {
    Indispensable: 5,
    'Important First Team': 4,
    'Squad Rotation': 3,
    'Hot Prospect': 2,
    Backup: 1,
    'Not Needed': 0,
  };
  const expectedRank =
    player.currentAbility >= 155
      ? 5
      : player.currentAbility >= 135
      ? 4
      : player.age <= 20
      ? 2
      : 3;
  const offeredRank = statusRank[offer.squadStatus];

  if (offeredRank === 0 && !isFreeAgent) {
    return {
      accepted: false,
      message: `${player.name} flatly refuses to sign a contract as 'Not Needed'. Offer a more respectful squad role.`,
    };
  }
  if (offeredRank < expectedRank - 1) {
    demandedWage *= 1.24;
  } else if (offeredRank > expectedRank) {
    demandedWage *= 0.94;
  }

  // Contract length fit by age
  if (player.age >= 33 && offer.years >= 4) demandedWage *= 0.94;
  if (player.age <= 25 && offer.years === 1) demandedWage *= 1.14;

  // Amortize signing-on fee into effective weekly value
  const weeklySignOnCredit = (offer.signingOnFee / Math.max(1, offer.years * 52)) * 0.85;
  const effectiveWeekly = offer.weeklyWage + weeklySignOnCredit;

  // Release clause incentive for ambitious youngsters
  const releaseBonus =
    offer.releaseClause &&
    offer.releaseClause > 0 &&
    offer.releaseClause <= Math.max(player.value * 2.5, 45_000_000) &&
    player.age <= 24
      ? 1.05
      : 1.0;

  if (effectiveWeekly * releaseBonus >= demandedWage * 0.94) {
    return {
      accepted: true,
      message: `${player.name} is delighted to sign a ${offer.years}-year contract with ${club.name} on ${formatCurrency(offer.weeklyWage)}/wk as '${offer.squadStatus}'!`,
    };
  }

  const step = demandedWage >= 50_000 ? 1_000 : demandedWage >= 10_000 ? 500 : 250;
  const counterWage = Math.max(
    offer.weeklyWage + step,
    Math.round((demandedWage - weeklySignOnCredit * 0.6) / step) * step
  );

  return {
    accepted: false,
    counterWage,
    message: `${player.name}'s representative feels the offer falls short of his client's expectations. They have countered requesting ${formatCurrency(counterWage)}/wk on a ${offer.years}-year deal.`,
  };
}

/**
 * Updates participating players' season stats after an O(1) quick-simulated AI match.
 */
function applyQuickMatchPlayerStats(
  completed: Fixture,
  clubs: Record<string, Club>,
  playersMap: Record<string, Player>
): void {
  const goalCounts = new Map<string, number>();
  const assistCounts = new Map<string, number>();
  const yellowCounts = new Map<string, number>();
  const redSet = new Set<string>();

  for (const g of completed.goals) {
    goalCounts.set(g.scorerId, (goalCounts.get(g.scorerId) ?? 0) + 1);
    if (g.assistId) {
      assistCounts.set(g.assistId, (assistCounts.get(g.assistId) ?? 0) + 1);
    }
  }
  for (const c of completed.cards) {
    if (c.card === 'yellow') {
      yellowCounts.set(c.playerId, (yellowCounts.get(c.playerId) ?? 0) + 1);
    } else {
      redSet.add(c.playerId);
    }
  }

  const applySide = (clubId: string, goalsFor: number, goalsAgainst: number) => {
    const club = clubs[clubId];
    if (!club) return;
    const resultBase = goalsFor > goalsAgainst ? 7.05 : goalsFor === goalsAgainst ? 6.65 : 6.25;
    const cleanSheet = goalsAgainst === 0;

    for (let i = 0; i < club.tactics.startingXI.length; i++) {
      const pid = club.tactics.startingXI[i].playerId;
      if (!pid) continue;
      const p = playersMap[pid];
      if (!p) continue;

      const g = goalCounts.get(pid) ?? 0;
      const a = assistCounts.get(pid) ?? 0;
      const yc = yellowCounts.get(pid) ?? 0;
      const rc = redSet.has(pid) ? 1 : 0;
      const isMotm = completed.manOfTheMatchId === pid;
      const cat = getPositionCategory(p.positions[0] ?? 'MC');

      let rating = isMotm
        ? completed.manOfTheMatchRating ?? 8.2
        : resultBase +
          g * 0.9 +
          a * 0.55 +
          (cleanSheet && (cat === 'GK' || cat === 'DEF') ? 0.4 : 0) -
          yc * 0.3 -
          rc * 1.4 +
          (Math.random() - 0.5) * 0.8;
      rating = round1(clamp(rating, 4.5, 9.8));

      const prev = p.seasonStats;
      const nextRatingSum = round1(prev.ratingSum + rating);
      const nextRatingCount = prev.ratingCount + 1;
      const nextForm = [...p.form, rating].slice(-5);
      const totalYellows = prev.yellowCards + yc;
      const nextSuspended =
        rc > 0
          ? p.suspendedMatches + 1
          : yc > 0 && totalYellows % 5 === 0
          ? p.suspendedMatches + 1
          : p.suspendedMatches;

      playersMap[pid] = {
        ...p,
        condition: round1(clamp(p.condition - randInt(12, 22), 45, 100)),
        suspendedMatches: nextSuspended,
        form: nextForm,
        seasonStats: {
          ...prev,
          appearances: prev.appearances + 1,
          goals: prev.goals + g,
          assists: prev.assists + a,
          cleanSheets: prev.cleanSheets + (cleanSheet && (cat === 'GK' || cat === 'DEF') ? 1 : 0),
          manOfTheMatch: prev.manOfTheMatch + (isMotm ? 1 : 0),
          ratingSum: nextRatingSum,
          ratingCount: nextRatingCount,
          averageRating: round1(nextRatingSum / nextRatingCount),
          yellowCards: totalYellows,
          redCards: prev.redCards + rc,
          minutesPlayed: prev.minutesPlayed + (rc > 0 ? 62 : 90),
        },
      };
    }
  };

  applySide(completed.homeClubId, completed.homeGoals, completed.awayGoals);
  applySide(completed.awayClubId, completed.awayGoals, completed.homeGoals);
}

export function advanceOneDay(state: GameState): AdvanceDayResult {
  const nextDate = addDaysIso(state.currentDate, 1);
  const dt = parseIsoUtc(nextDate);
  const dayOfWeek = dt.getUTCDay(); // 1 = Monday
  const dayOfMonth = dt.getUTCDate();

  let stopReason: AdvanceDayResult['stopReason'] = 'none';
  let userMatchToday: Fixture | null = null;

  const nextPlayers: Record<string, Player> = { ...state.players };
  const nextClubs: Record<string, Club> = { ...state.clubs };
  const newNews: NewsItem[] = [];

  // 1. Daily player fitness recovery & injury countdown (only clone players needing change!)
  for (const pid in state.players) {
    const p = state.players[pid];
    if (p.injury) {
      const rem = p.injury.daysRemaining - 1;
      if (rem <= 0) {
        nextPlayers[pid] = {
          ...p,
          injury: null,
          condition: round1(clamp(Math.max(p.condition, 78) + 6, 70, 96)),
        };
        if (p.clubId === state.userClubId) {
          newNews.push({
            id: `news-fit-${nextDate}-${pid}`,
            date: nextDate,
            headline: `${p.name} Returns to Full Training`,
            body: `Good news from the medical room: ${p.name} has recovered from his ${p.injury.type.toLowerCase()} and is available for selection again.`,
            category: 'injury',
            read: false,
            relatedClubId: state.userClubId,
            relatedPlayerId: pid,
            importance: 'normal',
          });
        }
      } else {
        nextPlayers[pid] = {
          ...p,
          injury: { ...p.injury, daysRemaining: rem },
        };
      }
    } else if (p.condition < 100) {
      const recovery = 6.5 + (p.attributes.physical.naturalFitness / 20) * 5.5;
      nextPlayers[pid] = {
        ...p,
        condition: round1(Math.min(100, p.condition + recovery)),
      };
    }
  }

  // 2. Monday Weekly Training + Weekly Wages (and 1st-of-month Sponsor/TV income)
  const userClub = nextClubs[state.userClubId];
  if (userClub && dayOfWeek === 1) {
    const userSquad: Player[] = [];
    for (const pid in nextPlayers) {
      if (nextPlayers[pid].clubId === userClub.id) {
        userSquad.push(nextPlayers[pid]);
      }
    }

    const trainRes = processWeeklyTraining(userClub, userSquad, nextDate);
    for (const up of trainRes.updatedPlayers) {
      nextPlayers[up.id] = up;
    }
    if (trainRes.newsItem) {
      newNews.push(trainRes.newsItem);
    }

    const weeklyWageBill = userSquad.reduce((sum, p) => sum + p.wage, 0);
    const wageTx = {
      id: `tx-wages-${nextDate}`,
      date: nextDate,
      category: 'Wages' as const,
      description: `Weekly squad wages (${userSquad.length} players)`,
      amount: -weeklyWageBill,
    };

    nextClubs[userClub.id] = {
      ...userClub,
      training: trainRes.updatedTraining,
      finances: {
        ...userClub.finances,
        currentWeeklyWages: weeklyWageBill,
        balance: userClub.finances.balance - weeklyWageBill,
        monthlyTransactions: [wageTx, ...userClub.finances.monthlyTransactions].slice(0, 40),
      },
    };
  }

  if (nextClubs[state.userClubId] && dayOfMonth === 1) {
    const uc = nextClubs[state.userClubId];
    const monthlyTv = Math.round(uc.finances.tvRevenueAnnual / 12);
    const monthlySponsor = Math.round(uc.finances.sponsorIncomeAnnual / 12);
    const txs = [...uc.finances.monthlyTransactions];
    if (monthlyTv > 0) {
      txs.unshift({
        id: `tx-tv-${nextDate}`,
        date: nextDate,
        category: 'TV Revenue',
        description: 'Monthly league broadcast distribution',
        amount: monthlyTv,
      });
    }
    if (monthlySponsor > 0) {
      txs.unshift({
        id: `tx-sp-${nextDate}`,
        date: nextDate,
        category: 'Sponsorship',
        description: 'Monthly commercial & shirt sponsorship',
        amount: monthlySponsor,
      });
    }
    nextClubs[uc.id] = {
      ...uc,
      finances: {
        ...uc.finances,
        balance: uc.finances.balance + monthlyTv + monthlySponsor,
        monthlyTransactions: txs.slice(0, 40),
      },
    };
  }

  // 3. Evaluate Pending Transfer Offers submitted prior to today
  const nextTransferOffers = state.transferOffers.map((offer) => {
    if (offer.status !== 'pending' || offer.createdDate >= nextDate) {
      return offer;
    }
    const targetPlayer = nextPlayers[offer.playerId];
    const sellingClub = nextClubs[offer.toClubId];
    const buyingClub = nextClubs[offer.fromClubId];
    if (!targetPlayer || !sellingClub || !buyingClub) return offer;

    const evalRes = evaluateTransferOffer(offer, targetPlayer, sellingClub, buyingClub);
    if (offer.fromClubId === state.userClubId) {
      if (stopReason === 'none') stopReason = 'transfer_response';
      newNews.push({
        id: `news-tr-${nextDate}-${offer.id}`,
        date: nextDate,
        headline:
          evalRes.status === 'accepted'
            ? `Transfer Bid ACCEPTED for ${targetPlayer.name}!`
            : evalRes.status === 'countered'
            ? `${sellingClub.shortName} Counter Offer for ${targetPlayer.name}`
            : `${sellingClub.shortName} Reject Bid for ${targetPlayer.name}`,
        body: evalRes.message,
        category: 'transfer',
        read: false,
        relatedClubId: sellingClub.id,
        relatedPlayerId: targetPlayer.id,
        importance: evalRes.status === 'accepted' ? 'urgent' : 'high',
      });
    }

    return {
      ...offer,
      status: evalRes.status,
      counterFee: evalRes.counterFee,
      responseDate: nextDate,
      notes: evalRes.message,
    };
  });

  // 4. Periodic Scout Report on the 12th of each month (authentic CM 01/02 flavor!)
  if (dayOfMonth === 12 && userClub) {
    const scoutPool: Player[] = [];
    for (const pid in nextPlayers) {
      const p = nextPlayers[pid];
      if (
        p.clubId !== userClub.id &&
        (p.isWonderkid || p.clubId === null) &&
        p.value <= Math.max(userClub.finances.transferBudget * 1.1, 2_000_000)
      ) {
        scoutPool.push(p);
        if (scoutPool.length >= 60) break;
      }
    }
    if (scoutPool.length > 0) {
      const gem = scoutPool[randInt(0, scoutPool.length - 1)];
      const gemClub = gem.clubId ? nextClubs[gem.clubId]?.name : 'Unattached (Free Agent)';
      newNews.push({
        id: `news-scout-${nextDate}-${gem.id}`,
        date: nextDate,
        headline: `Chief Scout Report: ${gem.name} (${gem.positions[0]}, ${gem.age})`,
        body: `Your scouting network recommends keeping a close eye on ${gem.name} (${gemClub}). Rated CA ${gem.currentAbility}${
          gem.isWonderkid ? ' and tagged as a top Wonderkid prospect' : ''
        }, he is valued at ${gem.clubId ? formatCurrency(gem.value) : 'FREE'}.`,
        category: 'transfer',
        read: false,
        relatedPlayerId: gem.id,
        relatedClubId: gem.clubId ?? undefined,
        importance: 'normal',
      });
    }
  }

  // 5. Simulate ALL non-user matches scheduled on or before nextDate (fast O(1) per match!)
  const dirtyLeagues = new Set<LeagueId>();
  let fixturesChanged = false;
  const nextFixtures = state.fixtures.map((fix) => {
    if (fix.played || fix.date > nextDate) return fix;

    if (fix.homeClubId === state.userClubId || fix.awayClubId === state.userClubId) {
      if (!userMatchToday) {
        userMatchToday = fix;
      }
      stopReason = 'matchday';
      return fix; // Keep unplayed for live broadcast matchday!
    }

    fixturesChanged = true;
    dirtyLeagues.add(fix.leagueId);
    const completed = simulateQuickMatch(fix, nextClubs, nextPlayers);
    applyQuickMatchPlayerStats(completed, nextClubs, nextPlayers);
    return completed;
  });

  // 6. Recalculate standings ONLY for leagues that played today
  let nextStandings = state.standings;
  if (dirtyLeagues.size > 0) {
    nextStandings = { ...state.standings };
    for (const lid of dirtyLeagues) {
      nextStandings[lid] = recalculateStandings(lid, nextClubs, nextFixtures);
    }
  }

  // Check if any urgent non-matchday news occurred
  if (stopReason === 'none' && newNews.some((n) => n.importance === 'urgent')) {
    stopReason = 'urgent_news';
  }

  const nextState: GameState = {
    ...state,
    currentDate: nextDate,
    manager: {
      ...state.manager,
      daysInCharge: state.manager.daysInCharge + 1,
    },
    clubs: nextClubs,
    players: nextPlayers,
    fixtures: fixturesChanged ? nextFixtures : state.fixtures,
    standings: nextStandings,
    transferOffers: nextTransferOffers,
    news: newNews.length > 0 ? [...newNews, ...state.news].slice(0, 120) : state.news,
  };

  return {
    nextState,
    userMatchToday,
    stopReason,
  };
}

export function commitMatchResult(
  state: GameState,
  completedSession: MatchSessionState
): GameState {
  const homeClub = state.clubs[completedSession.homeClubId];
  const awayClub = state.clubs[completedSession.awayClubId];

  const onPitchAtEndIds = new Set<string>([
    ...(completedSession.homeTactics.startingXI.map((s) => s.playerId).filter(Boolean) as string[]),
    ...(completedSession.awayTactics.startingXI.map((s) => s.playerId).filter(Boolean) as string[]),
  ]);

  // Determine Man of the Match across players who actually participated
  let motmId: string | undefined;
  let motmRating = 0;
  for (const pid in completedSession.playerStats) {
    const st = completedSession.playerStats[pid];
    const participated =
      st.subbedOnMinute !== undefined ||
      st.subbedOffMinute !== undefined ||
      onPitchAtEndIds.has(pid);
    if (!participated) continue;
    if (st.rating > motmRating) {
      motmRating = st.rating;
      motmId = pid;
    }
  }

  // 1. Update matching fixture
  const nextFixtures = state.fixtures.map((f) => {
    if (f.id !== completedSession.fixtureId) return f;
    return {
      ...f,
      played: true,
      homeGoals: completedSession.homeGoals,
      awayGoals: completedSession.awayGoals,
      attendance: completedSession.attendance,
      goals: completedSession.goals,
      cards: completedSession.cards,
      manOfTheMatchId: motmId,
      manOfTheMatchRating: motmRating ? round1(motmRating) : undefined,
      homeStats: completedSession.homeStats,
      awayStats: completedSession.awayStats,
    };
  });

  // 2. Update players who featured (and decrement suspensions for squad players who sat out)
  const nextPlayers: Record<string, Player> = { ...state.players };
  const homeWon = completedSession.homeGoals > completedSession.awayGoals;
  const awayWon = completedSession.awayGoals > completedSession.homeGoals;
  const isDraw = completedSession.homeGoals === completedSession.awayGoals;

  // Decrement suspensions for suspended players at either club who did not play
  for (const pid in nextPlayers) {
    const p = nextPlayers[pid];
    if (
      (p.clubId === completedSession.homeClubId || p.clubId === completedSession.awayClubId) &&
      p.suspendedMatches > 0 &&
      !completedSession.playerStats[pid]
    ) {
      nextPlayers[pid] = { ...p, suspendedMatches: Math.max(0, p.suspendedMatches - 1) };
    }
  }

  for (const pid in completedSession.playerStats) {
    const st = completedSession.playerStats[pid];
    const p = nextPlayers[pid];
    if (!p) continue;

    const playedAsSub = st.subbedOnMinute !== undefined;
    const playedAsStarter =
      !playedAsSub && (onPitchAtEndIds.has(pid) || st.subbedOffMinute !== undefined);
    if (!playedAsStarter && !playedAsSub) continue; // Unused sub on bench

    const isHome = p.clubId === completedSession.homeClubId;
    const teamWon = isHome ? homeWon : awayWon;
    const teamConceded = isHome ? completedSession.awayGoals : completedSession.homeGoals;
    const cat = getPositionCategory(p.positions[0] ?? 'MC');

    const mins =
      st.subbedOnMinute !== undefined && st.subbedOffMinute !== undefined
        ? Math.max(1, st.subbedOffMinute - st.subbedOnMinute)
        : st.subbedOffMinute !== undefined
        ? Math.max(1, st.subbedOffMinute)
        : st.subbedOnMinute !== undefined
        ? Math.max(1, 90 - st.subbedOnMinute)
        : 90;

    const prev = p.seasonStats;
    const nextRatingSum = round1(prev.ratingSum + st.rating);
    const nextRatingCount = prev.ratingCount + 1;
    const nextYellows = prev.yellowCards + st.yellowCards;
    const nextReds = prev.redCards + (st.redCard ? 1 : 0);

    let nextSuspended = p.suspendedMatches;
    if (st.redCard) nextSuspended += 1;
    else if (st.yellowCards > 0 && Math.floor(nextYellows / 5) > Math.floor(prev.yellowCards / 5)) {
      nextSuspended += 1;
    }

    const moraleDelta =
      st.rating >= 8.0 || teamWon ? 1 : !isDraw && st.rating < 6.2 ? -1 : 0;

    let nextInjury = p.injury;
    if (st.injured && !nextInjury) {
      const inj = INJURY_TYPES[randInt(0, INJURY_TYPES.length - 1)];
      nextInjury = { type: inj.type, daysRemaining: randInt(inj.minDays, inj.maxDays) };
    }

    nextPlayers[pid] = {
      ...p,
      condition: round1(clamp(st.condition, 35, 100)),
      morale: shiftMorale(p.morale, moraleDelta),
      injury: nextInjury,
      suspendedMatches: nextSuspended,
      form: [...p.form, round1(st.rating)].slice(-5),
      seasonStats: {
        ...prev,
        appearances: prev.appearances + (playedAsStarter ? 1 : 0),
        subAppearances: prev.subAppearances + (playedAsSub ? 1 : 0),
        goals: prev.goals + st.goals,
        assists: prev.assists + st.assists,
        cleanSheets:
          prev.cleanSheets + (teamConceded === 0 && (cat === 'GK' || cat === 'DEF') ? 1 : 0),
        manOfTheMatch: prev.manOfTheMatch + (motmId === pid ? 1 : 0),
        ratingSum: nextRatingSum,
        ratingCount: nextRatingCount,
        averageRating: round1(nextRatingSum / nextRatingCount),
        yellowCards: nextYellows,
        redCards: nextReds,
        minutesPlayed: prev.minutesPlayed + mins,
      },
    };
  }

  // 3. Update Manager record, Club Finances (gate receipts), and Board Confidence
  const userIsHome = completedSession.homeClubId === state.userClubId;
  const userIsAway = completedSession.awayClubId === state.userClubId;
  let nextManager = state.manager;
  const nextClubs: Record<string, Club> = { ...state.clubs };
  let boardReaction = '';

  if (userIsHome || userIsAway) {
    const userGoals = userIsHome ? completedSession.homeGoals : completedSession.awayGoals;
    const oppGoals = userIsHome ? completedSession.awayGoals : completedSession.homeGoals;
    const userClub = nextClubs[state.userClubId];
    const oppClub = userIsHome ? awayClub : homeClub;

    const won = userGoals > oppGoals;
    const drew = userGoals === oppGoals;
    const lost = userGoals < oppGoals;
    const isDerby = userClub.rivals.includes(oppClub.id);

    nextManager = {
      ...state.manager,
      matchesPlayed: state.manager.matchesPlayed + 1,
      wins: state.manager.wins + (won ? 1 : 0),
      draws: state.manager.draws + (drew ? 1 : 0),
      losses: state.manager.losses + (lost ? 1 : 0),
      goalsFor: state.manager.goalsFor + userGoals,
      goalsAgainst: state.manager.goalsAgainst + oppGoals,
      reputation: clamp(
        state.manager.reputation + (won ? (isDerby ? 45 : 22) : drew ? 4 : -15),
        500,
        10000
      ),
    };

    const repGap = oppClub.reputation - userClub.reputation;
    const confDelta = won
      ? 4 + (repGap > 800 ? 3 : 0) + (isDerby ? 3 : 0)
      : drew
      ? repGap > 800
        ? 2
        : repGap < -1200
        ? -2
        : 0
      : -(4 + (repGap < -1000 ? 3 : 0) + (isDerby ? 3 : 0));

    let nextFinances = userClub.finances;
    if (userIsHome) {
      const gateIncome = Math.round(
        completedSession.attendance * Math.max(12, userClub.finances.ticketPriceAvg)
      );
      nextFinances = {
        ...userClub.finances,
        balance: userClub.finances.balance + gateIncome,
        monthlyTransactions: [
          {
            id: `tx-gate-${completedSession.fixtureId}`,
            date: state.currentDate,
            category: 'Gate Receipts' as const,
            description: `Matchday gate vs ${awayClub.shortName} (${completedSession.attendance.toLocaleString()} att.)`,
            amount: gateIncome,
          },
          ...userClub.finances.monthlyTransactions,
        ].slice(0, 40),
      };
    }

    const nextBoardConf = clamp(userClub.boardConfidence + confDelta, 10, 100);
    const nextFanConf = clamp(userClub.fanConfidence + confDelta * 1.2, 10, 100);

    nextClubs[userClub.id] = {
      ...userClub,
      finances: nextFinances,
      boardConfidence: Math.round(nextBoardConf),
      fanConfidence: Math.round(nextFanConf),
    };

    boardReaction = won
      ? isDerby
        ? `The board and supporters are ecstatic after defeating bitter rivals ${oppClub.name}!`
        : `The board are pleased with the victory over ${oppClub.name}.`
      : drew
      ? `The board view the draw against ${oppClub.name} as a reasonable result.`
      : `The board expressed concern following the defeat to ${oppClub.name}.`;
  }

  // 4. Recalculate league standings
  const nextStandings = {
    ...state.standings,
    [completedSession.leagueId]: recalculateStandings(
      completedSession.leagueId,
      nextClubs,
      nextFixtures
    ),
  };

  // 5. Post-Match Newspaper Report in Manager Inbox
  const motmPlayer = motmId ? nextPlayers[motmId] : undefined;
  const scorersSummary =
    completedSession.goals.length > 0
      ? `Goals: ${completedSession.goals
          .map(
            (g) =>
              `${g.scorerName} (${g.minute}'${g.isPenalty ? ' pen' : ''})`
          )
          .join(', ')}.`
      : 'Neither side could break the deadlock in a tight tactical battle.';

  const matchReportNews: NewsItem = {
    id: `news-match-${completedSession.fixtureId}`,
    date: state.currentDate,
    headline: `FT: ${homeClub.shortName} ${completedSession.homeGoals}–${completedSession.awayGoals} ${awayClub.shortName}`,
    body: `${homeClub.name} ${completedSession.homeGoals}–${completedSession.awayGoals} ${awayClub.name} at ${homeClub.stadium.name} (Att: ${completedSession.attendance.toLocaleString()}). ${scorersSummary} ${
      motmPlayer
        ? `Man of the Match: ${motmPlayer.name} (${motmRating.toFixed(1)}). `
        : ''
    }${boardReaction}`,
    category: 'match',
    read: false,
    relatedClubId: state.userClubId,
    relatedPlayerId: motmId,
    relatedFixtureId: completedSession.fixtureId,
    importance: 'normal',
  };

  return {
    ...state,
    manager: nextManager,
    clubs: nextClubs,
    players: nextPlayers,
    fixtures: nextFixtures,
    standings: nextStandings,
    news: [matchReportNews, ...state.news].slice(0, 120),
    activeMatch: null,
  };
}

// Compile-time contract conformance check
export const _seasonEngineContract: SeasonEngineModule = {
  generateSeasonFixtures,
  recalculateStandings,
  recalculateAllStandings,
  advanceOneDay,
  commitMatchResult,
  evaluateTransferOffer,
  evaluateContractOffer,
  processWeeklyTraining,
  formatCurrency,
  formatDateCM,
};
