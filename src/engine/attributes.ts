/**
 * Championship Manager 01/02 — Attributes, Positional Ratings & Valuation Engine
 * Implements AttributesEngineModule from src/types/contracts.ts
 */

import type {
  AttributesEngineModule,
  AttributeGroupsMeta,
  AttributeTier,
} from '../types/contracts';
import type {
  MentalAttributes,
  PhysicalAttributes,
  Player,
  PositionCategory,
  PositionCode,
  TechnicalAttributes,
} from '../types/game';

export const ATTRIBUTE_GROUPS: AttributeGroupsMeta = {
  technical: [
    { key: 'crossing', label: 'Crossing', shortLabel: 'CRO' },
    { key: 'dribbling', label: 'Dribbling', shortLabel: 'DRI' },
    { key: 'finishing', label: 'Finishing', shortLabel: 'FIN' },
    { key: 'heading', label: 'Heading', shortLabel: 'HEA' },
    { key: 'longShots', label: 'Long Shots', shortLabel: 'LSH' },
    { key: 'marking', label: 'Marking', shortLabel: 'MAR' },
    { key: 'offTheBall', label: 'Off the Ball', shortLabel: 'OTB' },
    { key: 'passing', label: 'Passing', shortLabel: 'PAS' },
    { key: 'penalties', label: 'Penalties', shortLabel: 'PEN' },
    { key: 'setPieces', label: 'Set Pieces', shortLabel: 'SET' },
    { key: 'tackling', label: 'Tackling', shortLabel: 'TAC' },
    { key: 'technique', label: 'Technique', shortLabel: 'TEC' },
  ],
  mental: [
    { key: 'aggression', label: 'Aggression', shortLabel: 'AGG' },
    { key: 'anticipation', label: 'Anticipation', shortLabel: 'ANT' },
    { key: 'bravery', label: 'Bravery', shortLabel: 'BRA' },
    { key: 'creativity', label: 'Creativity', shortLabel: 'CRE' },
    { key: 'decisions', label: 'Decisions', shortLabel: 'DEC' },
    { key: 'determination', label: 'Determination', shortLabel: 'DET' },
    { key: 'flair', label: 'Flair', shortLabel: 'FLA' },
    { key: 'influence', label: 'Influence', shortLabel: 'INF' },
    { key: 'teamwork', label: 'Teamwork', shortLabel: 'TEA' },
    { key: 'workRate', label: 'Work Rate', shortLabel: 'WRK' },
  ],
  physical: [
    { key: 'acceleration', label: 'Acceleration', shortLabel: 'ACC' },
    { key: 'agility', label: 'Agility', shortLabel: 'AGI' },
    { key: 'balance', label: 'Balance', shortLabel: 'BAL' },
    { key: 'injuryProneness', label: 'Injury Proneness', shortLabel: 'INJ' },
    { key: 'jumping', label: 'Jumping', shortLabel: 'JUM' },
    { key: 'naturalFitness', label: 'Natural Fitness', shortLabel: 'NAT' },
    { key: 'pace', label: 'Pace', shortLabel: 'PAC' },
    { key: 'stamina', label: 'Stamina', shortLabel: 'STA' },
    { key: 'strength', label: 'Strength', shortLabel: 'STR' },
  ],
};

export function getAttributeTier(value: number): AttributeTier {
  if (value >= 18) return 'elite';
  if (value >= 15) return 'high';
  if (value >= 10) return 'mid';
  return 'low';
}

export function getPositionCategory(position: PositionCode): PositionCategory {
  switch (position) {
    case 'GK':
      return 'GK';
    case 'DL':
    case 'DC':
    case 'DR':
      return 'DEF';
    case 'DMC':
    case 'ML':
    case 'MC':
    case 'MR':
    case 'AMC':
      return 'MID';
    case 'FL':
    case 'FC':
    case 'FR':
      return 'FWD';
  }
}

export function isNaturalPosition(player: Player, position: PositionCode): boolean {
  return player.positions.includes(position);
}

interface PositionWeights {
  technical?: Partial<Record<keyof TechnicalAttributes, number>>;
  mental?: Partial<Record<keyof MentalAttributes, number>>;
  physical?: Partial<Record<keyof PhysicalAttributes, number>>;
}

const POSITION_WEIGHTS: Record<Exclude<PositionCode, 'GK'>, PositionWeights> = {
  DC: {
    technical: { marking: 4.0, tackling: 4.0, heading: 3.2, passing: 1.4, technique: 1.0 },
    mental: { anticipation: 3.0, decisions: 2.8, bravery: 2.5, determination: 2.0, teamwork: 1.8, aggression: 1.5, influence: 1.2 },
    physical: { strength: 3.2, jumping: 2.8, pace: 2.0, acceleration: 1.5, balance: 1.4, stamina: 1.4 },
  },
  DL: {
    technical: { tackling: 3.2, marking: 2.8, crossing: 2.6, passing: 2.0, dribbling: 1.6, technique: 1.5, offTheBall: 1.4 },
    mental: { anticipation: 2.4, decisions: 2.2, workRate: 2.6, teamwork: 2.2, determination: 1.6 },
    physical: { pace: 3.0, acceleration: 2.8, stamina: 3.0, agility: 2.0, balance: 1.6, strength: 1.6 },
  },
  DR: {
    technical: { tackling: 3.2, marking: 2.8, crossing: 2.6, passing: 2.0, dribbling: 1.6, technique: 1.5, offTheBall: 1.4 },
    mental: { anticipation: 2.4, decisions: 2.2, workRate: 2.6, teamwork: 2.2, determination: 1.6 },
    physical: { pace: 3.0, acceleration: 2.8, stamina: 3.0, agility: 2.0, balance: 1.6, strength: 1.6 },
  },
  DMC: {
    technical: { tackling: 3.6, marking: 2.8, passing: 3.0, technique: 1.8, longShots: 1.2, heading: 1.2 },
    mental: { decisions: 3.0, anticipation: 3.0, teamwork: 2.8, workRate: 2.8, bravery: 2.0, aggression: 1.8, determination: 2.0, creativity: 1.4 },
    physical: { stamina: 2.8, strength: 2.6, balance: 1.8, pace: 1.4, jumping: 1.2 },
  },
  MC: {
    technical: { passing: 3.8, technique: 2.8, tackling: 2.0, offTheBall: 2.2, longShots: 1.8, dribbling: 1.8, crossing: 1.0 },
    mental: { creativity: 3.2, decisions: 3.2, teamwork: 3.0, workRate: 2.8, anticipation: 2.2, determination: 1.8, flair: 1.2 },
    physical: { stamina: 3.0, balance: 1.8, agility: 1.6, pace: 1.5, strength: 1.6, acceleration: 1.4 },
  },
  ML: {
    technical: { crossing: 3.4, dribbling: 3.2, technique: 2.6, passing: 2.4, offTheBall: 2.4, finishing: 1.4 },
    mental: { flair: 2.4, creativity: 2.2, workRate: 2.4, decisions: 2.0, teamwork: 2.0, anticipation: 1.8 },
    physical: { pace: 3.4, acceleration: 3.2, stamina: 2.8, agility: 2.4, balance: 1.8 },
  },
  MR: {
    technical: { crossing: 3.4, dribbling: 3.2, technique: 2.6, passing: 2.4, offTheBall: 2.4, finishing: 1.4 },
    mental: { flair: 2.4, creativity: 2.2, workRate: 2.4, decisions: 2.0, teamwork: 2.0, anticipation: 1.8 },
    physical: { pace: 3.4, acceleration: 3.2, stamina: 2.8, agility: 2.4, balance: 1.8 },
  },
  AMC: {
    technical: { passing: 3.4, technique: 3.2, dribbling: 3.0, offTheBall: 2.8, finishing: 2.4, longShots: 2.4, crossing: 1.2 },
    mental: { creativity: 3.8, flair: 3.0, decisions: 2.8, anticipation: 2.4, teamwork: 2.0, determination: 1.6 },
    physical: { agility: 2.6, acceleration: 2.4, balance: 2.2, pace: 2.0, stamina: 1.8 },
  },
  FL: {
    technical: { dribbling: 3.6, finishing: 3.0, crossing: 2.6, technique: 2.8, offTheBall: 3.0, passing: 2.0, longShots: 1.4 },
    mental: { flair: 3.0, anticipation: 2.4, decisions: 2.2, creativity: 2.2, determination: 1.6, workRate: 1.4 },
    physical: { pace: 3.8, acceleration: 3.6, agility: 2.8, balance: 2.2, stamina: 1.8 },
  },
  FR: {
    technical: { dribbling: 3.6, finishing: 3.0, crossing: 2.6, technique: 2.8, offTheBall: 3.0, passing: 2.0, longShots: 1.4 },
    mental: { flair: 3.0, anticipation: 2.4, decisions: 2.2, creativity: 2.2, determination: 1.6, workRate: 1.4 },
    physical: { pace: 3.8, acceleration: 3.6, agility: 2.8, balance: 2.2, stamina: 1.8 },
  },
  FC: {
    technical: { finishing: 4.4, offTheBall: 3.6, heading: 2.6, dribbling: 2.4, technique: 2.4, passing: 1.4, longShots: 1.4, penalties: 0.8 },
    mental: { anticipation: 3.2, decisions: 2.6, determination: 2.2, flair: 2.0, bravery: 1.6, teamwork: 1.4 },
    physical: { pace: 2.8, acceleration: 2.8, strength: 2.6, jumping: 2.2, agility: 2.0, balance: 2.0 },
  },
};

const COMPATIBLE_POSITIONS: Record<PositionCode, PositionCode[]> = {
  GK: [],
  DL: ['DR', 'DC', 'ML'],
  DR: ['DL', 'DC', 'MR'],
  DC: ['DL', 'DR', 'DMC'],
  DMC: ['DC', 'MC'],
  MC: ['DMC', 'AMC', 'ML', 'MR'],
  ML: ['DL', 'MC', 'MR', 'FL'],
  MR: ['DR', 'MC', 'ML', 'FR'],
  AMC: ['MC', 'FL', 'FR', 'FC'],
  FL: ['ML', 'FR', 'AMC', 'FC'],
  FR: ['MR', 'FL', 'AMC', 'FC'],
  FC: ['FL', 'FR', 'AMC'],
};

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function computeGoalkeeperWeightedAvg(player: Player): number {
  const { mental, physical, goalkeeping } = player.attributes;
  if (goalkeeping) {
    const num =
      goalkeeping.handling * 4.2 +
      goalkeeping.reflexes * 4.4 +
      goalkeeping.oneOnOnes * 3.4 +
      goalkeeping.positioning * 3.8 +
      mental.anticipation * 2.4 +
      mental.decisions * 2.4 +
      mental.bravery * 2.0 +
      mental.influence * 1.4 +
      physical.agility * 2.6 +
      physical.jumping * 2.2 +
      physical.balance * 1.4 +
      physical.strength * 1.4;
    const den = 4.2 + 4.4 + 3.4 + 3.8 + 2.4 + 2.4 + 2.0 + 1.4 + 2.6 + 2.2 + 1.4 + 1.4;
    return num / den;
  }
  // Fallback when goalkeeping sub-object is omitted
  const num =
    mental.anticipation * 3.0 +
    mental.decisions * 3.0 +
    mental.bravery * 2.6 +
    mental.determination * 1.8 +
    mental.influence * 1.6 +
    physical.agility * 3.4 +
    physical.jumping * 3.0 +
    physical.balance * 2.0 +
    physical.strength * 2.0 +
    player.attributes.technical.passing * 1.2;
  const den = 3.0 + 3.0 + 2.6 + 1.8 + 1.6 + 3.4 + 3.0 + 2.0 + 2.0 + 1.2;
  return num / den;
}

function computeOutfieldWeightedAvg(player: Player, position: Exclude<PositionCode, 'GK'>): number {
  const weights = POSITION_WEIGHTS[position];
  const { technical, mental, physical } = player.attributes;
  let sum = 0;
  let totalWeight = 0;

  if (weights.technical) {
    for (const key of Object.keys(weights.technical) as Array<keyof TechnicalAttributes>) {
      const w = weights.technical[key];
      if (w && w > 0) {
        sum += technical[key] * w;
        totalWeight += w;
      }
    }
  }
  if (weights.mental) {
    for (const key of Object.keys(weights.mental) as Array<keyof MentalAttributes>) {
      const w = weights.mental[key];
      if (w && w > 0) {
        sum += mental[key] * w;
        totalWeight += w;
      }
    }
  }
  if (weights.physical) {
    for (const key of Object.keys(weights.physical) as Array<keyof PhysicalAttributes>) {
      const w = weights.physical[key];
      if (w && w > 0) {
        sum += physical[key] * w;
        totalWeight += w;
      }
    }
  }

  return totalWeight > 0 ? sum / totalWeight : 10;
}

function getPositionalFamiliarity(player: Player, targetPosition: PositionCode): number {
  const primary = player.positions[0];
  if (primary === targetPosition) return 1.0;
  if (player.positions.includes(targetPosition)) return 0.96;

  const isNaturalGk = player.positions.includes('GK');
  if (targetPosition === 'GK' && !isNaturalGk) return 0.24;
  if (targetPosition !== 'GK' && isNaturalGk && player.positions.length === 1) return 0.26;

  for (const naturalPos of player.positions) {
    if (COMPATIBLE_POSITIONS[naturalPos]?.includes(targetPosition)) {
      return 0.85;
    }
  }

  const targetCat = getPositionCategory(targetPosition);
  for (const naturalPos of player.positions) {
    if (getPositionCategory(naturalPos) === targetCat) {
      return 0.79;
    }
  }

  return 0.6;
}

export function calculatePositionRating(player: Player, position: PositionCode): number {
  const weightedAvg =
    position === 'GK'
      ? computeGoalkeeperWeightedAvg(player)
      : computeOutfieldWeightedAvg(player, position);

  // Map 1..20 average into 0..100 scale, blended gently with CA/2 for authentic CM calibration
  const attrScore = (weightedAvg / 20) * 100;
  const caScore = clamp(player.currentAbility / 2, 1, 100);
  const blended = attrScore * 0.72 + caScore * 0.28;
  const familiarity = getPositionalFamiliarity(player, position);

  return Math.round(clamp(blended * familiarity, 1, 100));
}

export function calculateOverallRating(player: Player): number {
  if (!player.positions || player.positions.length === 0) {
    return Math.round(clamp(player.currentAbility / 2, 1, 99));
  }
  let best = 1;
  for (const pos of player.positions) {
    const score = calculatePositionRating(player, pos);
    if (score > best) best = score;
  }
  const caNormalized = clamp(player.currentAbility / 2, 1, 99);
  return Math.round(clamp(best * 0.68 + caNormalized * 0.32, 1, 99));
}

function roundMarketValue(raw: number): number {
  if (raw <= 0) return 0;
  if (raw < 50_000) return Math.round(raw / 5_000) * 5_000;
  if (raw < 500_000) return Math.round(raw / 25_000) * 25_000;
  if (raw < 5_000_000) return Math.round(raw / 100_000) * 100_000;
  if (raw < 25_000_000) return Math.round(raw / 250_000) * 250_000;
  return Math.round(raw / 500_000) * 500_000;
}

export function estimatePlayerValue(player: Player, leagueReputation = 14): number {
  const ca = clamp(player.currentAbility, 40, 200);
  const pa = clamp(player.potentialAbility ?? ca, ca, 200);
  const age = clamp(player.age, 15, 45);
  const repFactor = 0.38 + (clamp(leagueReputation, 1, 20) / 20) * 0.82; // ~0.42..1.20

  // Exponential curve calibrated to 2026/27 EUR football market:
  // CA 70 -> ~100K, CA 100 -> ~1.1M, CA 130 -> ~10M, CA 155 -> ~36M, CA 175 -> ~82M, CA 190 -> ~145M
  const norm = Math.max(0, (ca - 52) / 148);
  const baseEur = 55_000 + Math.pow(norm, 3.45) * 165_000_000;

  // Age multiplier
  let ageMult = 1.0;
  if (age <= 19) ageMult = 1.24;
  else if (age <= 22) ageMult = 1.22;
  else if (age <= 25) ageMult = 1.12;
  else if (age <= 27) ageMult = 1.02;
  else if (age <= 29) ageMult = 0.88;
  else if (age <= 31) ageMult = 0.64;
  else if (age <= 33) ageMult = 0.38;
  else if (age <= 35) ageMult = 0.2;
  else ageMult = 0.1;

  // Wonderkid & PA upside premium for young players
  let potentialPremium = 0;
  if (age <= 23 && pa > ca) {
    const gap = pa - ca;
    const paNorm = Math.max(0, (pa - 52) / 148);
    const futureValue = Math.pow(paNorm, 3.35) * 140_000_000;
    const youthFactor = age <= 19 ? 0.38 : age <= 21 ? 0.28 : 0.16;
    potentialPremium = futureValue * youthFactor * Math.min(1, gap / 35);
    if (player.isWonderkid) {
      potentialPremium *= 1.22;
    }
  }

  // Position market premium (forwards & creative mids fetch slightly more than GKs)
  const primaryCat = getPositionCategory(player.positions[0] ?? 'MC');
  const posMult =
    primaryCat === 'FWD' ? 1.12 : primaryCat === 'MID' ? 1.04 : primaryCat === 'DEF' ? 0.96 : 0.84;

  // Reputation nudge
  const playerRepMult = 0.82 + (clamp(player.reputation, 500, 10000) / 10000) * 0.36;

  // Contract length modifier (if contracted)
  let contractMult = 1.0;
  if (player.clubId && player.contractExpires) {
    const expiryYear = Number.parseInt(player.contractExpires.slice(0, 4), 10);
    if (!Number.isNaN(expiryYear)) {
      const yearsLeft = expiryYear - 2026;
      if (yearsLeft <= 1) contractMult = 0.72;
      else if (yearsLeft === 2) contractMult = 0.9;
      else if (yearsLeft >= 4) contractMult = 1.08;
    }
  }

  const rawValue =
    (baseEur * ageMult + potentialPremium) * repFactor * posMult * playerRepMult * contractMult;

  return Math.max(15_000, roundMarketValue(rawValue));
}

export function estimateWeeklyWage(player: Player): number {
  const ca = clamp(player.currentAbility, 40, 200);
  const age = clamp(player.age, 15, 45);
  const norm = Math.max(0, (ca - 50) / 150);

  // Weekly EUR calibrated to 2026/27:
  // CA 75 -> ~900, CA 100 -> ~3.2K, CA 130 -> ~24K, CA 155 -> ~82K, CA 175 -> ~185K, CA 190 -> ~310K
  let raw = 350 + Math.pow(norm, 3.35) * 355_000;

  // Youngsters on early contracts earn less; established prime pros earn peak wages
  if (age <= 18) raw *= 0.45;
  else if (age <= 20) raw *= 0.65;
  else if (age <= 22) raw *= 0.82;
  else if (age <= 30) raw *= 1.05;
  else if (age <= 33) raw *= 0.92;
  else raw *= 0.72;

  const repMult = 0.75 + (clamp(player.reputation, 500, 10000) / 10000) * 0.48;
  raw *= repMult;

  if (raw < 2_000) return Math.max(300, Math.round(raw / 50) * 50);
  if (raw < 10_000) return Math.round(raw / 250) * 250;
  if (raw < 50_000) return Math.round(raw / 500) * 500;
  return Math.round(raw / 1_000) * 1_000;
}

// Compile-time contract conformance check
export const _attributesModuleContract: AttributesEngineModule = {
  ATTRIBUTE_GROUPS,
  getAttributeTier,
  getPositionCategory,
  isNaturalPosition,
  calculatePositionRating,
  calculateOverallRating,
  estimatePlayerValue,
  estimateWeeklyWage,
};
