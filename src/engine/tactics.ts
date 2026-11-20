/**
 * Championship Manager 01/02 — Formations, WIB/WOB 5x5 Grid & Tactical Strength Engine
 * Implements TacticsEngineModule from src/types/contracts.ts
 */

import type {
  FormationTemplate,
  TacticalStrengthReport,
  TacticsEngineModule,
} from '../types/contracts';
import type {
  FormationId,
  MoraleLevel,
  Player,
  PositionCategory,
  PositionCode,
  RunArrow,
  TacticalSlot,
  TacticsState,
  TeamInstructions,
  WibWobGrid,
  WibWobPosition,
} from '../types/game';
import {
  calculateOverallRating,
  calculatePositionRating,
  getPositionCategory,
} from './attributes';

export const RUN_ARROW_VECTORS: Record<RunArrow, { dx: number; dy: number }> = {
  none: { dx: 0, dy: 0 },
  N: { dx: 0, dy: -11 },
  NE: { dx: 8, dy: -8 },
  E: { dx: 11, dy: 0 },
  SE: { dx: 8, dy: 8 },
  S: { dx: 0, dy: 11 },
  SW: { dx: -8, dy: 8 },
  W: { dx: -11, dy: 0 },
  NW: { dx: -8, dy: -8 },
};

export const FORMATIONS: Record<FormationId, FormationTemplate> = {
  '4-4-2': {
    id: '4-4-2',
    label: '4-4-2 Classic',
    description: 'Balanced two-bank British shape with overlapping full-backs and twin strikers.',
    slots: [
      { roleLabel: 'GK', baseX: 50, baseY: 92, defaultArrow: 'none' },
      { roleLabel: 'DL', baseX: 15, baseY: 74, defaultArrow: 'N' },
      { roleLabel: 'DC', baseX: 38, baseY: 77, defaultArrow: 'none' },
      { roleLabel: 'DC', baseX: 62, baseY: 77, defaultArrow: 'none' },
      { roleLabel: 'DR', baseX: 85, baseY: 74, defaultArrow: 'N' },
      { roleLabel: 'ML', baseX: 14, baseY: 48, defaultArrow: 'N' },
      { roleLabel: 'MC', baseX: 39, baseY: 52, defaultArrow: 'none' },
      { roleLabel: 'MC', baseX: 61, baseY: 52, defaultArrow: 'N' },
      { roleLabel: 'MR', baseX: 86, baseY: 48, defaultArrow: 'N' },
      { roleLabel: 'FC', baseX: 38, baseY: 21, defaultArrow: 'none' },
      { roleLabel: 'FC', baseX: 62, baseY: 21, defaultArrow: 'none' },
    ],
  },
  '4-1-3-2': {
    id: '4-1-3-2',
    label: '4-1-3-2 CM Classic',
    description: 'Iconic CM 01/02 narrow diamond-box with a holding anchor and surging midfield trio.',
    slots: [
      { roleLabel: 'GK', baseX: 50, baseY: 92, defaultArrow: 'none' },
      { roleLabel: 'DL', baseX: 15, baseY: 74, defaultArrow: 'N' },
      { roleLabel: 'DC', baseX: 38, baseY: 77, defaultArrow: 'none' },
      { roleLabel: 'DC', baseX: 62, baseY: 77, defaultArrow: 'none' },
      { roleLabel: 'DR', baseX: 85, baseY: 74, defaultArrow: 'N' },
      { roleLabel: 'DMC', baseX: 50, baseY: 62, defaultArrow: 'none' },
      { roleLabel: 'MC', baseX: 27, baseY: 44, defaultArrow: 'NW' },
      { roleLabel: 'MC', baseX: 50, baseY: 45, defaultArrow: 'N' },
      { roleLabel: 'MC', baseX: 73, baseY: 44, defaultArrow: 'NE' },
      { roleLabel: 'FC', baseX: 38, baseY: 20, defaultArrow: 'none' },
      { roleLabel: 'FC', baseX: 62, baseY: 20, defaultArrow: 'none' },
    ],
  },
  '4-3-3': {
    id: '4-3-3',
    label: '4-3-3 Wing Attack',
    description: 'High-pressing modern 4-3-3 with inverted wingers cutting inside around a central #9.',
    slots: [
      { roleLabel: 'GK', baseX: 50, baseY: 92, defaultArrow: 'none' },
      { roleLabel: 'DL', baseX: 15, baseY: 74, defaultArrow: 'N' },
      { roleLabel: 'DC', baseX: 38, baseY: 77, defaultArrow: 'none' },
      { roleLabel: 'DC', baseX: 62, baseY: 77, defaultArrow: 'none' },
      { roleLabel: 'DR', baseX: 85, baseY: 74, defaultArrow: 'N' },
      { roleLabel: 'DMC', baseX: 50, baseY: 60, defaultArrow: 'none' },
      { roleLabel: 'MC', baseX: 32, baseY: 47, defaultArrow: 'N' },
      { roleLabel: 'MC', baseX: 68, baseY: 47, defaultArrow: 'N' },
      { roleLabel: 'FL', baseX: 18, baseY: 24, defaultArrow: 'NE' },
      { roleLabel: 'FC', baseX: 50, baseY: 18, defaultArrow: 'none' },
      { roleLabel: 'FR', baseX: 82, baseY: 24, defaultArrow: 'NW' },
    ],
  },
  '3-5-2': {
    id: '3-5-2',
    label: '3-5-2 Wing-Backs',
    description: 'Three centre-backs protected by flying wing-backs and a dominant central midfield.',
    slots: [
      { roleLabel: 'GK', baseX: 50, baseY: 92, defaultArrow: 'none' },
      { roleLabel: 'DC', baseX: 26, baseY: 77, defaultArrow: 'none' },
      { roleLabel: 'DC', baseX: 50, baseY: 79, defaultArrow: 'none' },
      { roleLabel: 'DC', baseX: 74, baseY: 77, defaultArrow: 'none' },
      { roleLabel: 'ML', baseX: 12, baseY: 51, defaultArrow: 'N' },
      { roleLabel: 'DMC', baseX: 38, baseY: 58, defaultArrow: 'none' },
      { roleLabel: 'MC', baseX: 62, baseY: 56, defaultArrow: 'N' },
      { roleLabel: 'MR', baseX: 88, baseY: 51, defaultArrow: 'N' },
      { roleLabel: 'AMC', baseX: 50, baseY: 37, defaultArrow: 'N' },
      { roleLabel: 'FC', baseX: 38, baseY: 20, defaultArrow: 'none' },
      { roleLabel: 'FC', baseX: 62, baseY: 20, defaultArrow: 'none' },
    ],
  },
  '4-2-3-1': {
    id: '4-2-3-1',
    label: '4-2-3-1 Double Pivot',
    description: 'Two holding midfielders shielding the back four while a creative #10 links the front three.',
    slots: [
      { roleLabel: 'GK', baseX: 50, baseY: 92, defaultArrow: 'none' },
      { roleLabel: 'DL', baseX: 15, baseY: 74, defaultArrow: 'N' },
      { roleLabel: 'DC', baseX: 38, baseY: 77, defaultArrow: 'none' },
      { roleLabel: 'DC', baseX: 62, baseY: 77, defaultArrow: 'none' },
      { roleLabel: 'DR', baseX: 85, baseY: 74, defaultArrow: 'N' },
      { roleLabel: 'DMC', baseX: 38, baseY: 59, defaultArrow: 'none' },
      { roleLabel: 'DMC', baseX: 62, baseY: 59, defaultArrow: 'none' },
      { roleLabel: 'FL', baseX: 17, baseY: 36, defaultArrow: 'NE' },
      { roleLabel: 'AMC', baseX: 50, baseY: 35, defaultArrow: 'N' },
      { roleLabel: 'FR', baseX: 83, baseY: 36, defaultArrow: 'NW' },
      { roleLabel: 'FC', baseX: 50, baseY: 18, defaultArrow: 'none' },
    ],
  },
  '4-4-2-diamond': {
    id: '4-4-2-diamond',
    label: '4-4-2 Diamond',
    description: 'Classic Serie A & CM 01/02 midfield diamond built around a trequartista behind two strikers.',
    slots: [
      { roleLabel: 'GK', baseX: 50, baseY: 92, defaultArrow: 'none' },
      { roleLabel: 'DL', baseX: 15, baseY: 74, defaultArrow: 'N' },
      { roleLabel: 'DC', baseX: 38, baseY: 77, defaultArrow: 'none' },
      { roleLabel: 'DC', baseX: 62, baseY: 77, defaultArrow: 'none' },
      { roleLabel: 'DR', baseX: 85, baseY: 74, defaultArrow: 'N' },
      { roleLabel: 'DMC', baseX: 50, baseY: 62, defaultArrow: 'none' },
      { roleLabel: 'MC', baseX: 30, baseY: 48, defaultArrow: 'NW' },
      { roleLabel: 'MC', baseX: 70, baseY: 48, defaultArrow: 'NE' },
      { roleLabel: 'AMC', baseX: 50, baseY: 34, defaultArrow: 'N' },
      { roleLabel: 'FC', baseX: 38, baseY: 19, defaultArrow: 'none' },
      { roleLabel: 'FC', baseX: 62, baseY: 19, defaultArrow: 'none' },
    ],
  },
};

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

/**
 * Generates an authentic CM 01/02 5x5 With-Ball / Without-Ball positional shift matrix.
 * Key format: "${row}-${col}" where row is 0..4 (0 = attacking third/top, 4 = own box/bottom)
 * and col is 0..4 (0 = left touchline, 4 = right touchline).
 */
export function createDefaultWibWobGrid(slots: TacticalSlot[]): WibWobGrid {
  const withBall: Record<string, WibWobPosition[]> = {};
  const withoutBall: Record<string, WibWobPosition[]> = {};

  for (let row = 0; row < 5; row++) {
    // Vertical zone center: row 0 -> y=10 (opponent box), row 2 -> y=50, row 4 -> y=90 (own box)
    const zoneY = row * 20 + 10;
    const attackProgress = (4 - row) / 4; // 0 in own box -> 1 in opponent box

    for (let col = 0; col < 5; col++) {
      const zoneX = col * 20 + 10;
      const key = `${row}-${col}`;

      const wibPositions: WibWobPosition[] = [];
      const wobPositions: WibWobPosition[] = [];

      for (let i = 0; i < slots.length; i++) {
        const slot = slots[i];
        const cat = getPositionCategory(slot.roleLabel);
        const arrow = RUN_ARROW_VECTORS[slot.runArrow] ?? { dx: 0, dy: 0 };
        const distFromCenter = slot.baseX - 50;
        const isWide =
          slot.roleLabel === 'DL' ||
          slot.roleLabel === 'DR' ||
          slot.roleLabel === 'ML' ||
          slot.roleLabel === 'MR' ||
          slot.roleLabel === 'FL' ||
          slot.roleLabel === 'FR' ||
          Math.abs(distFromCenter) >= 24;

        if (i === 0 || slot.roleLabel === 'GK') {
          // Goalkeeper: sweeps slightly higher with ball, protects line without ball
          const wibGkX = clamp(50 + (zoneX - 50) * 0.14, 42, 58);
          const wibGkY = clamp(91 - attackProgress * 7, 83, 94);
          wibPositions.push({ x: round1(wibGkX), y: round1(wibGkY) });

          const wobGkX = clamp(50 + (zoneX - 50) * 0.17, 41, 59);
          const wobGkY = clamp(94 - attackProgress * 4.5, 88, 96);
          wobPositions.push({ x: round1(wobGkX), y: round1(wobGkY) });
          continue;
        }

        // ---------------- WITH BALL (WIB) ----------------
        // Players push up, widen to stretch opposition, and execute directional run arrows
        let wibPushUp = 0;
        if (cat === 'DEF') {
          const isFullBack = slot.roleLabel === 'DL' || slot.roleLabel === 'DR';
          wibPushUp = isFullBack
            ? 8 + attackProgress * 18 // Full-backs overlap aggressively as ball advances
            : 4 + attackProgress * 15; // CBs step up to halfway line when attacking
        } else if (cat === 'MID') {
          const isHolding = slot.roleLabel === 'DMC';
          wibPushUp = isHolding
            ? 5 + attackProgress * 13
            : 8 + attackProgress * 15;
        } else {
          // Forwards pin the last defender and attack the box
          wibPushUp = 5 + attackProgress * 10;
        }

        // Spread wide in possession; CBs split to build out from the back in rows 3..4
        let wibSpreadX = 0;
        if (isWide) {
          wibSpreadX = Math.sign(distFromCenter) * (4.5 + attackProgress * 3.5);
        } else if (slot.roleLabel === 'DC' && row >= 3) {
          wibSpreadX = Math.sign(distFromCenter || (i % 2 === 0 ? -1 : 1)) * 5.0;
        }

        // Subtle shift toward ball flank to build passing triangles, while far-side attackers hold width
        const ballSideShiftWib = (zoneX - slot.baseX) * (cat === 'MID' ? 0.16 : 0.1);
        const wibX = clamp(slot.baseX + wibSpreadX + ballSideShiftWib + arrow.dx * 0.72, 6, 94);

        // Anchor slightly toward ball depth so midfield/defense support attacks naturally
        const depthPullWib = (zoneY - slot.baseY) * (cat === 'DEF' ? 0.14 : 0.18);
        const wibY = clamp(slot.baseY - wibPushUp + depthPullWib + arrow.dy * 0.78, 7, 87);
        wibPositions.push({ x: round1(wibX), y: round1(wibY) });

        // ---------------- WITHOUT BALL (WOB) ----------------
        // Team compacts centrally, shifts laterally toward the ball column, and drops into defensive block
        const ballDanger = row / 4; // 0 when opponent is in their own box -> 1 when in ours
        let wobDropBack = 0;
        if (cat === 'DEF') {
          wobDropBack = 2 + ballDanger * 11 - (1 - ballDanger) * 6;
        } else if (cat === 'MID') {
          wobDropBack = 5 + ballDanger * 18 - (1 - ballDanger) * 4;
        } else {
          // Forwards drop to halfway/midfield screen when defending deep, press high when opponent builds
          wobDropBack = 8 + ballDanger * 24 - (1 - ballDanger) * 3;
        }

        // Compact width inward toward 50, then slide whole block laterally toward ball column
        const compactBaseX = 50 + distFromCenter * 0.74;
        const blockSlideX = (zoneX - 50) * (cat === 'DEF' ? 0.34 : cat === 'MID' ? 0.38 : 0.28);
        const wobX = clamp(compactBaseX + blockSlideX, 10, 90);

        const depthPullWob = (zoneY - slot.baseY) * 0.15;
        const wobY = clamp(slot.baseY + wobDropBack + depthPullWob, 14, 90);
        wobPositions.push({ x: round1(wobX), y: round1(wobY) });
      }

      withBall[key] = wibPositions;
      withoutBall[key] = wobPositions;
    }
  }

  return { withBall, withoutBall };
}

function getMoraleBonus(morale: MoraleLevel): number {
  switch (morale) {
    case 'Superb':
      return 3.0;
    case 'Very Good':
      return 1.5;
    case 'Good':
      return 0;
    case 'Okay':
      return -1.0;
    case 'Poor':
      return -2.5;
    case 'Very Poor':
      return -4.0;
  }
}

function slotAvailabilityScore(player: Player, role: PositionCode): number {
  const posRating = calculatePositionRating(player, role);
  const condFactor = 0.62 + 0.38 * (clamp(player.condition, 20, 100) / 100);
  const moraleBonus = getMoraleBonus(player.morale);
  let availabilityPenalty = 0;
  if (player.injury) availabilityPenalty -= 65;
  if (player.suspendedMatches > 0) availabilityPenalty -= 80;
  return posRating * condFactor + moraleBonus + availabilityPenalty;
}

const ROLE_SCARCITY_ORDER: Record<PositionCode, number> = {
  GK: 0,
  DL: 1,
  DR: 2,
  FL: 3,
  FR: 4,
  DMC: 5,
  AMC: 6,
  ML: 7,
  MR: 8,
  FC: 9,
  DC: 10,
  MC: 11,
};

function chooseSpecialists(
  startingSlots: TacticalSlot[],
  squadById: Map<string, Player>
): {
  captainId: string | null;
  penaltyTakerId: string | null;
  setPieceTakerId: string | null;
} {
  const starters: Player[] = [];
  for (const s of startingSlots) {
    if (s.playerId) {
      const p = squadById.get(s.playerId);
      if (p) starters.push(p);
    }
  }
  if (starters.length === 0) {
    return { captainId: null, penaltyTakerId: null, setPieceTakerId: null };
  }

  const outfield = starters.filter((p) => p.positions[0] !== 'GK');
  const pool = outfield.length > 0 ? outfield : starters;

  let captain = starters[0];
  let captainScore = -1;
  for (const p of starters) {
    const score =
      p.attributes.mental.influence * 2.4 +
      p.attributes.mental.determination * 1.4 +
      p.attributes.mental.teamwork * 0.8 +
      Math.min(p.age, 33) * 0.35;
    if (score > captainScore) {
      captainScore = score;
      captain = p;
    }
  }

  let penTaker = pool[0];
  let penScore = -1;
  for (const p of pool) {
    const score =
      p.attributes.technical.penalties * 2.8 +
      p.attributes.technical.finishing * 1.1 +
      p.attributes.mental.determination * 0.7;
    if (score > penScore) {
      penScore = score;
      penTaker = p;
    }
  }

  let setTaker = pool[0];
  let setScore = -1;
  for (const p of pool) {
    const score =
      p.attributes.technical.setPieces * 2.8 +
      p.attributes.technical.crossing * 1.2 +
      p.attributes.technical.technique * 0.8 +
      p.attributes.technical.passing * 0.6;
    if (score > setScore) {
      setScore = score;
      setTaker = p;
    }
  }

  return {
    captainId: captain.id,
    penaltyTakerId: penTaker.id,
    setPieceTakerId: setTaker.id,
  };
}

export function autoPickLineup(tactics: TacticsState, squad: Player[]): TacticsState {
  const slots = tactics.startingXI.map((s) => ({ ...s, playerId: null as string | null }));
  const squadById = new Map<string, Player>();
  for (const p of squad) squadById.set(p.id, p);

  const eligible = squad.filter((p) => !p.injury && p.suspendedMatches === 0);
  const fallbackPool = squad.filter((p) => Boolean(p.injury) || p.suspendedMatches > 0);
  // Sort fallback pool by least severe unavailability
  fallbackPool.sort((a, b) => {
    const sevA = (a.suspendedMatches > 0 ? 100 : 0) + (a.injury?.daysRemaining ?? 0);
    const sevB = (b.suspendedMatches > 0 ? 100 : 0) + (b.injury?.daysRemaining ?? 0);
    return sevA - sevB;
  });

  const candidatePool = eligible.length >= slots.length ? eligible : [...eligible, ...fallbackPool];
  const usedIds = new Set<string>();

  // Assign slots in scarcity order so rare roles (GK, DL, DR, wingers) get natural specialists first
  const slotIndices = slots
    .map((s, idx) => ({ idx, priority: ROLE_SCARCITY_ORDER[s.roleLabel] ?? 10 }))
    .sort((a, b) => a.priority - b.priority)
    .map((x) => x.idx);

  for (const idx of slotIndices) {
    const role = slots[idx].roleLabel;
    let bestPlayer: Player | null = null;
    let bestScore = -Infinity;

    for (const p of candidatePool) {
      if (usedIds.has(p.id)) continue;
      const score = slotAvailabilityScore(p, role);
      if (score > bestScore) {
        bestScore = score;
        bestPlayer = p;
      }
    }

    if (bestPlayer) {
      slots[idx].playerId = bestPlayer.id;
      usedIds.add(bestPlayer.id);
    }
  }

  // Local 2-opt swap refinement across outfield slots (1..10) for globally sharper positional fit
  for (let pass = 0; pass < 3; pass++) {
    let improved = false;
    for (let i = 1; i < slots.length; i++) {
      for (let j = i + 1; j < slots.length; j++) {
        const pA = slots[i].playerId ? squadById.get(slots[i].playerId!) : undefined;
        const pB = slots[j].playerId ? squadById.get(slots[j].playerId!) : undefined;
        if (!pA || !pB) continue;

        const currentSum =
          slotAvailabilityScore(pA, slots[i].roleLabel) +
          slotAvailabilityScore(pB, slots[j].roleLabel);
        const swappedSum =
          slotAvailabilityScore(pA, slots[j].roleLabel) +
          slotAvailabilityScore(pB, slots[i].roleLabel);

        if (swappedSum > currentSum + 0.05) {
          slots[i].playerId = pB.id;
          slots[j].playerId = pA.id;
          improved = true;
        }
      }
    }
    if (!improved) break;
  }

  // Pick a balanced 7-man bench: 1 GK, 2 DEF, 2 MID, 2 FWD (then best remaining available)
  const remainingEligible = eligible
    .filter((p) => !usedIds.has(p.id))
    .sort((a, b) => {
      const scoreA = calculateOverallRating(a) * (0.7 + 0.3 * (a.condition / 100));
      const scoreB = calculateOverallRating(b) * (0.7 + 0.3 * (b.condition / 100));
      return scoreB - scoreA;
    });

  const bench: string[] = [];
  const benchSet = new Set<string>();
  const quotas: Array<{ cat: PositionCategory; count: number }> = [
    { cat: 'GK', count: 1 },
    { cat: 'DEF', count: 2 },
    { cat: 'MID', count: 2 },
    { cat: 'FWD', count: 2 },
  ];

  for (const { cat, count } of quotas) {
    let picked = 0;
    for (const p of remainingEligible) {
      if (picked >= count || bench.length >= 7) break;
      if (benchSet.has(p.id)) continue;
      if (getPositionCategory(p.positions[0] ?? 'MC') === cat) {
        bench.push(p.id);
        benchSet.add(p.id);
        picked++;
      }
    }
  }

  // Fill any remaining bench spots up to 7 with best remaining available players
  for (const p of remainingEligible) {
    if (bench.length >= 7) break;
    if (!benchSet.has(p.id)) {
      bench.push(p.id);
      benchSet.add(p.id);
    }
  }

  const starterIds = new Set(slots.map((s) => s.playerId).filter(Boolean) as string[]);
  const specialists = chooseSpecialists(slots, squadById);

  return {
    ...tactics,
    startingXI: slots,
    bench,
    captainId:
      tactics.captainId && starterIds.has(tactics.captainId)
        ? tactics.captainId
        : specialists.captainId,
    penaltyTakerId:
      tactics.penaltyTakerId && starterIds.has(tactics.penaltyTakerId)
        ? tactics.penaltyTakerId
        : specialists.penaltyTakerId,
    setPieceTakerId:
      tactics.setPieceTakerId && starterIds.has(tactics.setPieceTakerId)
        ? tactics.setPieceTakerId
        : specialists.setPieceTakerId,
  };
}

export function createDefaultTactics(formation: FormationId, squad: Player[]): TacticsState {
  const template = FORMATIONS[formation] ?? FORMATIONS['4-4-2'];
  const slots: TacticalSlot[] = template.slots.map((slot, idx) => ({
    slotIndex: idx,
    playerId: null,
    roleLabel: slot.roleLabel,
    baseX: slot.baseX,
    baseY: slot.baseY,
    runArrow: slot.defaultArrow,
  }));

  const defaultInstructions: TeamInstructions = {
    mentality: 'Normal',
    passing: 'Mixed',
    tackling: 'Normal',
    pressing: true,
    offsideTrap: false,
    counterAttack: false,
    menBehindBall: false,
  };

  const baseTactics: TacticsState = {
    formation: template.id,
    startingXI: slots,
    bench: [],
    wibWobGrid: createDefaultWibWobGrid(slots),
    instructions: defaultInstructions,
    captainId: null,
    penaltyTakerId: null,
    setPieceTakerId: null,
  };

  return autoPickLineup(baseTactics, squad);
}

export function applyFormation(
  current: TacticsState,
  formation: FormationId,
  squad: Player[]
): TacticsState {
  const template = FORMATIONS[formation] ?? FORMATIONS['4-4-2'];
  const slots: TacticalSlot[] = template.slots.map((slot, idx) => ({
    slotIndex: idx,
    playerId: null,
    roleLabel: slot.roleLabel,
    baseX: slot.baseX,
    baseY: slot.baseY,
    runArrow: slot.defaultArrow,
  }));

  const nextBase: TacticsState = {
    ...current,
    formation: template.id,
    startingXI: slots,
    wibWobGrid: createDefaultWibWobGrid(slots),
  };

  return autoPickLineup(nextBase, squad);
}

export function getZoneCoordinates(
  tactics: TacticsState,
  hasBall: boolean,
  row: number,
  col: number
): WibWobPosition[] {
  const r = clamp(Math.floor(row), 0, 4);
  const c = clamp(Math.floor(col), 0, 4);
  const key = `${r}-${c}`;
  const table = hasBall ? tactics.wibWobGrid?.withBall : tactics.wibWobGrid?.withoutBall;
  const coords = table?.[key];
  if (coords && coords.length === tactics.startingXI.length) {
    return coords;
  }
  return tactics.startingXI.map((slot) => ({ x: slot.baseX, y: slot.baseY }));
}

export function computeTacticalStrength(
  tactics: TacticsState,
  players: Record<string, Player>
): TacticalStrengthReport {
  let gkSum = 0;
  let gkCount = 0;
  let defSum = 0;
  let defCount = 0;
  let midSum = 0;
  let midCount = 0;
  let attSum = 0;
  let attCount = 0;

  let teamworkSum = 0;
  let workRateSum = 0;
  let staminaSum = 0;
  let passingSum = 0;
  let paceSum = 0;
  let anticipationSum = 0;
  let naturalFitCount = 0;
  let activeStarters = 0;

  let forwardArrowCount = 0;
  let lateralArrowCount = 0;
  let defArrowBackCount = 0;

  for (let i = 0; i < tactics.startingXI.length; i++) {
    const slot = tactics.startingXI[i];
    const player = slot.playerId ? players[slot.playerId] : undefined;
    if (!player) continue;

    activeStarters++;
    const condMult = 0.72 + 0.28 * (clamp(player.condition, 30, 100) / 100);
    const roleRating = calculatePositionRating(player, slot.roleLabel) * condMult;
    const cat = getPositionCategory(slot.roleLabel);

    if (player.positions.includes(slot.roleLabel)) {
      naturalFitCount++;
    }

    teamworkSum += player.attributes.mental.teamwork;
    workRateSum += player.attributes.mental.workRate;
    staminaSum += player.attributes.physical.stamina;
    passingSum += player.attributes.technical.passing;
    paceSum += player.attributes.physical.pace;
    anticipationSum += player.attributes.mental.anticipation;

    const arrow = RUN_ARROW_VECTORS[slot.runArrow] ?? { dx: 0, dy: 0 };
    if (arrow.dy < 0) forwardArrowCount++;
    if (arrow.dy > 0) defArrowBackCount++;
    if (arrow.dx !== 0) lateralArrowCount++;

    if (cat === 'GK') {
      gkSum += roleRating;
      gkCount++;
    } else if (cat === 'DEF') {
      defSum += roleRating;
      defCount++;
      if (slot.roleLabel === 'DL' || slot.roleLabel === 'DR') {
        midSum += roleRating * 0.25;
        midCount += 0.25;
      }
    } else if (cat === 'MID') {
      midSum += roleRating;
      midCount++;
      if (slot.roleLabel === 'DMC') {
        defSum += roleRating * 0.45;
        defCount += 0.45;
      } else if (slot.roleLabel === 'AMC' || slot.roleLabel === 'ML' || slot.roleLabel === 'MR') {
        attSum += roleRating * 0.35;
        attCount += 0.35;
      }
    } else {
      attSum += roleRating;
      attCount++;
      if (slot.roleLabel === 'FL' || slot.roleLabel === 'FR') {
        midSum += roleRating * 0.25;
        midCount += 0.25;
      }
    }
  }

  if (activeStarters === 0) {
    return {
      attack: 40,
      midfield: 40,
      defense: 40,
      goalkeeper: 40,
      cohesion: 40,
      width: 50,
      pressingBonus: 0,
    };
  }

  let attack = attCount > 0 ? attSum / attCount : 45;
  let midfield = midCount > 0 ? midSum / midCount : 45;
  let defense = defCount > 0 ? defSum / defCount : 45;
  const goalkeeper = gkCount > 0 ? gkSum / gkCount : 35;

  const avgTeamwork = teamworkSum / activeStarters;
  const avgWorkRate = workRateSum / activeStarters;
  const avgStamina = staminaSum / activeStarters;
  const avgPassing = passingSum / activeStarters;
  const avgPace = paceSum / activeStarters;
  const avgAnticipation = anticipationSum / activeStarters;

  // Evaluate WIB/WOB balance across representative zones (attacking row 1, midfield row 2, defensive row 3)
  let wibAttackDepth = 0;
  let wibWidthSpread = 0;
  let wobDefenseDepth = 0;
  let wobCompactness = 0;
  const sampleZones: Array<[number, number]> = [
    [1, 1],
    [1, 3],
    [2, 2],
    [3, 1],
    [3, 3],
  ];

  for (const [r, c] of sampleZones) {
    const wib = getZoneCoordinates(tactics, true, r, c);
    const wob = getZoneCoordinates(tactics, false, r, c);

    // Outfield players only (1..10)
    const wibOut = wib.slice(1);
    const wobOut = wob.slice(1);
    if (wibOut.length > 0) {
      const avgY = wibOut.reduce((acc, p) => acc + p.y, 0) / wibOut.length;
      const minX = Math.min(...wibOut.map((p) => p.x));
      const maxX = Math.max(...wibOut.map((p) => p.x));
      wibAttackDepth += 100 - avgY; // higher = further up the pitch
      wibWidthSpread += maxX - minX;
    }
    if (wobOut.length > 0) {
      const avgY = wobOut.reduce((acc, p) => acc + p.y, 0) / wobOut.length;
      const minX = Math.min(...wobOut.map((p) => p.x));
      const maxX = Math.max(...wobOut.map((p) => p.x));
      wobDefenseDepth += avgY; // higher = deeper defensive cover
      wobCompactness += 100 - (maxX - minX);
    }
  }

  const samples = sampleZones.length;
  const meanWibAttack = wibAttackDepth / samples; // ideal ~50..68
  const meanWibWidth = wibWidthSpread / samples; // ideal ~58..82
  const meanWobDepth = wobDefenseDepth / samples; // ideal ~55..74
  const meanWobCompact = wobCompactness / samples; // ideal ~35..58

  // WIB/WOB tactical modifiers
  const wibAttackMod = clamp((meanWibAttack - 54) * 0.22, -6, 6);
  const wobDefenseMod = clamp((meanWobDepth - 58) * 0.24, -7, 6);
  const wobCompactBonus = clamp((meanWobCompact - 40) * 0.14, -4, 4);

  attack += wibAttackMod + Math.min(4.5, forwardArrowCount * 0.75) - defArrowBackCount * 0.5;
  defense += wobDefenseMod + wobCompactBonus + defArrowBackCount * 1.1 - Math.max(0, forwardArrowCount - 5) * 0.9;

  // Apply CM 01/02 Team Instructions
  const ins = tactics.instructions;
  switch (ins.mentality) {
    case 'Defending':
      defense += 5.5;
      attack -= 5.0;
      break;
    case 'Normal':
      break;
    case 'Attacking':
      attack += 4.5;
      defense -= 3.5;
      break;
    case 'Gung Ho':
      attack += 8.5;
      midfield -= 1.5;
      defense -= 8.0;
      break;
  }

  switch (ins.passing) {
    case 'Short':
      midfield += (avgPassing - 10) * 0.55;
      break;
    case 'Mixed':
      midfield += 0.8;
      break;
    case 'Direct':
      attack += (avgPace - 10) * 0.45;
      break;
    case 'Long Ball':
      attack += (avgPace - 9) * 0.4;
      midfield -= 2.5;
      break;
  }

  if (ins.tackling === 'Hard') {
    defense += 2.6;
  } else if (ins.tackling === 'Easy') {
    defense -= 2.2;
  }

  let pressingBonus = 0;
  if (ins.pressing) {
    const pressQuality = (avgWorkRate * 0.55 + avgStamina * 0.45) / 20; // 0..1
    const wobHighPressBoost = clamp((66 - meanWobDepth) * 0.18, -2, 3.5);
    pressingBonus = Math.round(clamp(5 + pressQuality * 11 + wobHighPressBoost, 2, 20));
    midfield += pressingBonus * 0.25;
    defense += pressingBonus * 0.14;
  } else {
    pressingBonus = Math.round(clamp((avgWorkRate / 20) * 4, 0, 5));
  }

  if (ins.offsideTrap) {
    // Rewards high anticipation & teamwork; punishes disorganized backlines
    const trapFit = (avgAnticipation + avgTeamwork) / 2 - 11.5;
    defense += clamp(trapFit * 0.85, -4.5, 4.5);
  }

  if (ins.counterAttack) {
    const counterFit = (avgPace - 11) * 0.65;
    attack += clamp(1.5 + counterFit, -1.5, 5.5);
  }

  if (ins.menBehindBall) {
    defense += 4.8;
    attack -= 4.2;
  }

  // Cohesion: natural positional fit + teamwork + balanced WIB/WOB transition
  const naturalRatio = naturalFitCount / activeStarters;
  const wibWobHarmony =
    meanWibAttack >= 44 && meanWibAttack <= 74 && meanWobDepth >= 50 && meanWobDepth <= 80
      ? 5
      : -4;
  const cohesion = clamp(
    42 + naturalRatio * 34 + (avgTeamwork / 20) * 20 + wibWobHarmony,
    20,
    99
  );

  // Width: derived from WIB horizontal stretch + lateral arrows
  const width = clamp(meanWibWidth * 1.05 + lateralArrowCount * 2.5, 25, 99);

  return {
    attack: Math.round(clamp(attack, 1, 99)),
    midfield: Math.round(clamp(midfield, 1, 99)),
    defense: Math.round(clamp(defense, 1, 99)),
    goalkeeper: Math.round(clamp(goalkeeper, 1, 99)),
    cohesion: Math.round(cohesion),
    width: Math.round(width),
    pressingBonus,
  };
}

// Compile-time contract conformance check
export const _tacticsModuleContract: TacticsEngineModule = {
  FORMATIONS,
  createDefaultWibWobGrid,
  createDefaultTactics,
  applyFormation,
  autoPickLineup,
  getZoneCoordinates,
  computeTacticalStrength,
};
