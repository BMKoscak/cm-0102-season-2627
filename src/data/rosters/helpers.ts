import type {
  Footedness,
  GoalkeepingAttributes,
  MentalAttributes,
  PhysicalAttributes,
  PositionCode,
  TechnicalAttributes,
} from '../../types/game';
import type { RealPlayerSeed } from '../../types/contracts';

export const M = (millions: number): number => Math.round(millions * 1_000_000);
export const K = (thousands: number): number => Math.round(thousands * 1_000);

export const NAT_NAMES: Record<string, string> = {
  ALB: 'Albania',
  ALG: 'Algeria',
  ANG: 'Angola',
  ARG: 'Argentina',
  ARM: 'Armenia',
  AUS: 'Australia',
  AUT: 'Austria',
  BEL: 'Belgium',
  BEN: 'Benin',
  BFA: 'Burkina Faso',
  BIH: 'Bosnia & Herzegovina',
  BRA: 'Brazil',
  BUL: 'Bulgaria',
  CAN: 'Canada',
  CHI: 'Chile',
  CIV: 'Ivory Coast',
  CMR: 'Cameroon',
  COD: 'DR Congo',
  COL: 'Colombia',
  CPV: 'Cape Verde',
  CRC: 'Costa Rica',
  CRO: 'Croatia',
  CUW: 'Curaçao',
  CYP: 'Cyprus',
  CZE: 'Czechia',
  DEN: 'Denmark',
  ECU: 'Ecuador',
  EGY: 'Egypt',
  ENG: 'England',
  ESP: 'Spain',
  EST: 'Estonia',
  FIN: 'Finland',
  FRA: 'France',
  GAB: 'Gabon',
  GAM: 'Gambia',
  GEO: 'Georgia',
  GER: 'Germany',
  GHA: 'Ghana',
  GRE: 'Greece',
  GUI: 'Guinea',
  GNB: 'Guinea-Bissau',
  HUN: 'Hungary',
  IDN: 'Indonesia',
  IRL: 'Republic of Ireland',
  IRN: 'Iran',
  ISL: 'Iceland',
  ISR: 'Israel',
  ITA: 'Italy',
  JAM: 'Jamaica',
  JPN: 'Japan',
  KOR: 'South Korea',
  KOS: 'Kosovo',
  LTU: 'Lithuania',
  LUX: 'Luxembourg',
  LVA: 'Latvia',
  MAR: 'Morocco',
  MEX: 'Mexico',
  MKD: 'North Macedonia',
  MLI: 'Mali',
  MLT: 'Malta',
  MNE: 'Montenegro',
  MOZ: 'Mozambique',
  NED: 'Netherlands',
  NGA: 'Nigeria',
  NIR: 'Northern Ireland',
  NOR: 'Norway',
  NZL: 'New Zealand',
  PAN: 'Panama',
  PAR: 'Paraguay',
  PER: 'Peru',
  POL: 'Poland',
  POR: 'Portugal',
  ROU: 'Romania',
  RSA: 'South Africa',
  RUS: 'Russia',
  SCO: 'Scotland',
  SEN: 'Senegal',
  SRB: 'Serbia',
  SUI: 'Switzerland',
  SUR: 'Suriname',
  SVK: 'Slovakia',
  SVN: 'Slovenia',
  SWE: 'Sweden',
  TOG: 'Togo',
  TUN: 'Tunisia',
  TUR: 'Turkey',
  UKR: 'Ukraine',
  URU: 'Uruguay',
  USA: 'United States',
  UZB: 'Uzbekistan',
  VEN: 'Venezuela',
  WAL: 'Wales',
  ZAM: 'Zambia',
  ZIM: 'Zimbabwe',
};

export interface CompactPlayerInput {
  id?: string;
  name: string;
  shortName?: string;
  clubId: string | null;
  nat: string;
  age: number; // as of August 1, 2026
  dob?: string;
  pos: PositionCode[];
  foot?: Footedness;
  num?: number;
  ca: number; // 1..200
  pa?: number; // 1..200
  wk?: boolean;
  rep?: number;
  val?: number; // EUR
  wage?: number; // weekly EUR
  exp?: string;
  caps?: number;
  goals?: number;
  careerApps?: number;
  careerGoals?: number;
  h?: number; // heightCm
  w?: number; // weightKg
  wiki?: string;
  t?: Partial<TechnicalAttributes>;
  m?: Partial<MentalAttributes>;
  p?: Partial<PhysicalAttributes>;
  g?: Partial<GoalkeepingAttributes>;
}

function stableHash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

export function slugifyPlayerName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/ø/g, 'o')
    .replace(/Ø/g, 'O')
    .replace(/ł/g, 'l')
    .replace(/Ł/g, 'L')
    .replace(/ß/g, 'ss')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function deriveShortName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length <= 1) return name;
  const particles = new Set(['van', 'de', 'del', 'della', 'di', 'da', 'dos', 'das', 'el', 'al', 'la', 'le', 'von', 'der', 'den', 'st.']);
  if (parts.length >= 3 && particles.has(parts[parts.length - 2].toLowerCase())) {
    return `${parts[0][0]}. ${parts[parts.length - 2]} ${parts[parts.length - 1]}`;
  }
  if (parts.length >= 3 && parts[parts.length - 1].toLowerCase() === 'jr.' || parts[parts.length - 1].toLowerCase() === 'júnior') {
    return `${parts[0]} Jr.`;
  }
  return `${parts[0][0]}. ${parts[parts.length - 1]}`;
}

function deriveDob(name: string, age: number): string {
  const h = stableHash(name);
  const month = (h % 12) + 1;
  const day = ((h >> 4) % 27) + 1;
  // As of 2026-08-01: if birthday is Jan-Jul, born in 2026 - age; if Aug-Dec, born in 2025 - age
  const birthYear = month <= 7 ? 2026 - age : 2025 - age;
  return `${birthYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function defaultHeightWeight(pos: PositionCode, seed: number): { heightCm: number; weightKg: number } {
  const jitter = (seed % 7) - 3;
  switch (pos) {
    case 'GK':
      return { heightCm: 190 + jitter, weightKg: 84 + Math.round(jitter * 0.8) };
    case 'DC':
      return { heightCm: 187 + jitter, weightKg: 81 + Math.round(jitter * 0.8) };
    case 'FC':
      return { heightCm: 183 + jitter, weightKg: 78 + Math.round(jitter * 0.7) };
    case 'DMC':
      return { heightCm: 182 + jitter, weightKg: 77 + Math.round(jitter * 0.7) };
    case 'DL':
    case 'DR':
    case 'MC':
      return { heightCm: 179 + jitter, weightKg: 74 + Math.round(jitter * 0.6) };
    default:
      return { heightCm: 176 + jitter, weightKg: 71 + Math.round(jitter * 0.6) };
  }
}

export function p(input: CompactPlayerInput): RealPlayerSeed {
  const seed = stableHash(input.name);
  const nationality = NAT_NAMES[input.nat] ?? input.nat;
  const primaryPos = input.pos[0];
  const hw = defaultHeightWeight(primaryPos, seed);
  const potentialAbility = Math.max(
    input.ca,
    input.pa ?? (input.age <= 21 ? Math.min(198, input.ca + 18) : input.age <= 24 ? Math.min(196, input.ca + 7) : input.ca)
  );
  const reputation =
    input.rep ??
    Math.min(
      9900,
      Math.max(
        1200,
        Math.round(input.ca * 48 + (input.caps ?? 0) * 14 + (input.wk ? 450 : 0) - 900)
      )
    );

  const hasOverrides = Boolean(input.t || input.m || input.p || input.g);
  const attributeOverrides = hasOverrides
    ? {
        ...(input.t ? { technical: input.t } : {}),
        ...(input.m ? { mental: input.m } : {}),
        ...(input.p ? { physical: input.p } : {}),
        ...(input.g ? { goalkeeping: input.g } : {}),
      }
    : undefined;

  return {
    id: input.id ?? slugifyPlayerName(input.name),
    name: input.name,
    shortName: input.shortName ?? deriveShortName(input.name),
    clubId: input.clubId,
    nationality,
    nationalityCode: input.nat,
    age: input.age,
    dateOfBirth: input.dob ?? deriveDob(input.name, input.age),
    positions: input.pos,
    preferredFoot: input.foot ?? 'right',
    heightCm: input.h ?? hw.heightCm,
    weightKg: input.w ?? hw.weightKg,
    ...(input.num !== undefined ? { squadNumber: input.num } : {}),
    currentAbility: input.ca,
    potentialAbility,
    ...(input.wk ? { isWonderkid: true } : {}),
    reputation,
    ...(input.val !== undefined ? { value: input.val } : {}),
    ...(input.wage !== undefined ? { wage: input.wage } : {}),
    contractExpires: input.clubId === null ? '' : (input.exp ?? '2028-06-30'),
    ...(input.careerApps !== undefined ? { careerApps: input.careerApps } : {}),
    ...(input.careerGoals !== undefined ? { careerGoals: input.careerGoals } : {}),
    internationalCaps: input.caps ?? 0,
    internationalGoals: input.goals ?? 0,
    wikiQuery: input.wiki ?? input.name,
    ...(attributeOverrides ? { attributeOverrides } : {}),
  };
}
