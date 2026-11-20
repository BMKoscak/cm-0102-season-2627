/**
 * Single Source of Truth for ALL Championship Manager 01/02 (Season 2026/27) Data Models.
 * Owned by @architect. All workers import types exclusively from here and ./contracts.
 *
 * Supports a deep multi-nation, multi-tier pyramid (18+ playable leagues across 12 countries,
 * ~300 clubs, ~6,500-7,000 players including free agents & wonderkids).
 */

/** Open string ID to support 18+ leagues across multiple countries and tiers. */
export type LeagueId = string;

export type PositionCode =
  | 'GK'
  | 'DL'
  | 'DC'
  | 'DR'
  | 'DMC'
  | 'ML'
  | 'MC'
  | 'MR'
  | 'AMC'
  | 'FL'
  | 'FC'
  | 'FR';

export type PositionCategory = 'GK' | 'DEF' | 'MID' | 'FWD';

export type Footedness = 'left' | 'right' | 'both';

export type SquadStatus =
  | 'Indispensable'
  | 'Important First Team'
  | 'Squad Rotation'
  | 'Backup'
  | 'Hot Prospect'
  | 'Not Needed';

export type MoraleLevel =
  | 'Superb'
  | 'Very Good'
  | 'Good'
  | 'Okay'
  | 'Poor'
  | 'Very Poor';

/**
 * Exact CM 01/02 Technical Attributes (12 attributes, all 1..20)
 */
export interface TechnicalAttributes {
  crossing: number;
  dribbling: number;
  finishing: number;
  heading: number;
  longShots: number;
  marking: number;
  offTheBall: number;
  passing: number;
  penalties: number;
  setPieces: number;
  tackling: number;
  technique: number;
}

/**
 * Exact CM 01/02 Mental Attributes (10 attributes, all 1..20)
 */
export interface MentalAttributes {
  aggression: number;
  anticipation: number;
  bravery: number;
  creativity: number;
  decisions: number;
  determination: number;
  flair: number;
  influence: number;
  teamwork: number;
  workRate: number;
}

/**
 * Exact CM 01/02 Physical Attributes (9 attributes, all 1..20)
 */
export interface PhysicalAttributes {
  acceleration: number;
  agility: number;
  balance: number;
  injuryProneness: number;
  jumping: number;
  naturalFitness: number;
  pace: number;
  stamina: number;
  strength: number;
}

/**
 * Optional Goalkeeping ratings (1..20) used by GKs in addition to the 3 core CM 01/02 groups.
 */
export interface GoalkeepingAttributes {
  handling: number;
  reflexes: number;
  oneOnOnes: number;
  positioning: number;
}

export interface PlayerAttributes {
  technical: TechnicalAttributes;
  mental: MentalAttributes;
  physical: PhysicalAttributes;
  goalkeeping?: GoalkeepingAttributes;
}

export interface PlayerInjury {
  type: string;
  daysRemaining: number;
}

export interface PlayerSeasonStats {
  appearances: number;
  subAppearances: number;
  goals: number;
  assists: number;
  cleanSheets: number;
  manOfTheMatch: number;
  averageRating: number;
  ratingSum: number;
  ratingCount: number;
  yellowCards: number;
  redCards: number;
  minutesPlayed: number;
}

export interface PlayerHistoryEntry {
  season: string;
  clubName: string;
  apps: number;
  goals: number;
  assists: number;
  avgRating: number;
}

export interface Player {
  id: string;
  name: string;
  shortName: string;
  clubId: string | null; // null = Free Agent / Unattached
  nationality: string;
  nationalityCode: string; // e.g. 'ENG', 'SVN', 'ESP'
  age: number; // as of August 2026
  dateOfBirth: string; // ISO YYYY-MM-DD
  positions: PositionCode[]; // positions[0] is natural primary position
  preferredFoot: Footedness;
  heightCm: number;
  weightKg: number;
  squadNumber?: number;
  attributes: PlayerAttributes;
  currentAbility: number; // 1..200
  potentialAbility?: number; // 1..200
  isWonderkid?: boolean;
  reputation: number; // 1..10000
  value: number; // EUR
  wage: number; // weekly EUR
  contractExpires: string; // ISO YYYY-MM-DD (empty string for free agents)
  releaseClause?: number;
  squadStatus: SquadStatus;
  transferListed: boolean;
  loanListed: boolean;
  condition: number; // 0..100
  morale: MoraleLevel;
  injury: PlayerInjury | null;
  suspendedMatches: number;
  careerApps?: number;
  careerGoals?: number;
  internationalCaps?: number;
  internationalGoals?: number;
  seasonStats: PlayerSeasonStats;
  careerHistory: PlayerHistoryEntry[];
  form: number[]; // last up to 5 match ratings (1..10)
  wikiQuery?: string;
  imageUrl?: string;
}

export interface StadiumInfo {
  name: string;
  city: string;
  country: string;
  capacity: number;
  pitchCondition: 'Perfect' | 'Good' | 'Average' | 'Heavy';
  builtYear?: number;
  wikiQuery?: string;
  imageUrl?: string;
}

export interface ClubColors {
  primary: string; // Hex e.g. '#EF0107'
  secondary: string; // Hex e.g. '#FFFFFF'
  text: string; // Contrasting readable text hex on primary
  accent?: string;
}

export type FinanceCategory =
  | 'Transfer'
  | 'Wages'
  | 'Gate Receipts'
  | 'TV Revenue'
  | 'Sponsorship'
  | 'Prize Money'
  | 'Upkeep';

export interface FinanceTransaction {
  id: string;
  date: string;
  category: FinanceCategory;
  description: string;
  amount: number; // positive = income, negative = expenditure
}

export interface ClubFinances {
  balance: number;
  transferBudget: number;
  wageBudgetWeekly: number;
  currentWeeklyWages: number;
  ticketPriceAvg: number;
  sponsorIncomeAnnual: number;
  tvRevenueAnnual: number;
  monthlyTransactions: FinanceTransaction[];
}

export type FormationId =
  | '4-4-2'
  | '4-1-3-2'
  | '4-3-3'
  | '3-5-2'
  | '4-2-3-1'
  | '4-4-2-diamond';

export type RunArrow = 'none' | 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW';

/**
 * Tactics Pitch Coordinate Convention (vertical pitch, attacking UPWARD):
 * - baseX: 0..100 (0 = left touchline, 50 = center, 100 = right touchline)
 * - baseY: 0..100 (8 = opponent penalty box / top, 50 = halfway, 92 = own GK / bottom)
 */
export interface TacticalSlot {
  slotIndex: number; // 0..10 (0 is always GK)
  playerId: string | null;
  roleLabel: PositionCode;
  baseX: number;
  baseY: number;
  runArrow: RunArrow;
}

export interface WibWobPosition {
  x: number; // 0..100 (left to right on vertical tactics pitch)
  y: number; // 0..100 (opponent goal at top 0, own goal at bottom 100)
}

/**
 * Classic CM 01/02 "With Ball / Without Ball" 5x5 pitch zone positioning.
 * Key format: "${row}-${col}" where row is 0..4 (top/attacking third -> bottom/own box)
 * and col is 0..4 (left touchline -> right touchline).
 * Each zone maps to 11 WibWobPosition entries matching startingXI[0..10].
 */
export interface WibWobGrid {
  withBall: Record<string, WibWobPosition[]>;
  withoutBall: Record<string, WibWobPosition[]>;
}

export interface TeamInstructions {
  mentality: 'Defending' | 'Normal' | 'Attacking' | 'Gung Ho';
  passing: 'Short' | 'Mixed' | 'Direct' | 'Long Ball';
  tackling: 'Easy' | 'Normal' | 'Hard';
  pressing: boolean;
  offsideTrap: boolean;
  counterAttack: boolean;
  menBehindBall: boolean;
}

export interface TacticsState {
  formation: FormationId;
  startingXI: TacticalSlot[]; // Always length 11
  bench: string[]; // Up to 7 playerIds
  wibWobGrid: WibWobGrid;
  instructions: TeamInstructions;
  captainId?: string | null;
  penaltyTakerId?: string | null;
  setPieceTakerId?: string | null;
}

export type TrainingIntensity = 'Light' | 'Medium' | 'Intensive';
export type TrainingFocus =
  | 'General'
  | 'Fitness'
  | 'Tactics'
  | 'Skills'
  | 'Shooting'
  | 'Goalkeeping'
  | 'Rest';

export type TrainingGroupKey = 'Goalkeepers' | 'Defenders' | 'Midfielders' | 'Forwards';

export interface TrainingGroupConfig {
  group: TrainingGroupKey;
  focus: TrainingFocus;
  intensity: TrainingIntensity;
}

export interface TrainingImprovement {
  playerId: string;
  playerName: string;
  attribute: string;
  delta: number;
  date: string;
}

export interface TrainingState {
  overallIntensity: TrainingIntensity;
  groups: Record<TrainingGroupKey, TrainingGroupConfig>;
  playerFocusOverrides: Record<string, TrainingFocus>;
  lastWeeklyReport?: string;
  recentImprovements: TrainingImprovement[];
}

export interface Club {
  id: string;
  name: string;
  shortName: string;
  threeLetterCode: string;
  leagueId: LeagueId;
  country: string;
  city: string;
  founded: number;
  reputation: number; // 1..10000
  colors: ClubColors;
  stadium: StadiumInfo;
  finances: ClubFinances;
  boardExpectation: string;
  boardConfidence: number; // 0..100
  fanConfidence: number; // 0..100
  managerName: string;
  defaultFormation: FormationId;
  tactics: TacticsState;
  training: TrainingState;
  rivals: string[];
  wikiQuery?: string;
  theSportsDbTeamId?: string;
  badgeUrl?: string;
}

export interface League {
  id: LeagueId;
  name: string;
  shortName: string;
  country: string;
  countryCode: string; // e.g. 'ENG', 'SVN', 'ESP', 'ITA', 'GER', 'FRA', 'NED', 'POR', 'SCO', 'BEL', 'CRO', 'AUT', 'TUR'
  tier: 1 | 2;
  reputation: number; // 1..20 scale
  clubIds: string[];
  rounds: number; // e.g. 2 for 18-24 team leagues, 4 for 10-team leagues
  promotionLeagueId?: LeagueId;
  relegationLeagueId?: LeagueId;
  promotionSpots: number;
  playoffSpots: number;
  relegationSpots: number;
  uclSpots: number;
  uelSpots: number;
  ueclSpots: number;
  theSportsDbLeagueId?: string;
  wikipediaTitle: string;
  trophyName: string;
  accentColor: string;
  bgQuery: string;
}

export interface ManagerProfile {
  name: string;
  nationality: string;
  clubId: string;
  reputation: number;
  daysInCharge: number;
  matchesPlayed: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  trophies: string[];
}

export type TransferOfferStatus =
  | 'pending'
  | 'accepted'
  | 'rejected'
  | 'countered'
  | 'withdrawn'
  | 'completed';

export interface TransferOffer {
  id: string;
  playerId: string;
  fromClubId: string; // buying club
  toClubId: string; // selling club
  fee: number;
  installments?: { amount: number; months: 6 | 12 | 18 | 24 };
  sellOnPercent: number; // 0..50
  status: TransferOfferStatus;
  counterFee?: number;
  createdDate: string;
  responseDate?: string;
  notes?: string;
}

export type ContractOfferStatus = 'pending' | 'accepted' | 'rejected' | 'countered';

export interface ContractOffer {
  id: string;
  playerId: string;
  clubId: string;
  transferOfferId?: string;
  squadStatus: SquadStatus;
  weeklyWage: number;
  signingOnFee: number;
  years: 1 | 2 | 3 | 4 | 5;
  releaseClause?: number;
  status: ContractOfferStatus;
  counterWage?: number;
  responseMessage?: string;
}

export type NewsCategory =
  | 'match'
  | 'transfer'
  | 'injury'
  | 'board'
  | 'training'
  | 'league'
  | 'media';

export interface NewsItem {
  id: string;
  date: string;
  headline: string;
  body: string;
  category: NewsCategory;
  read: boolean;
  relatedClubId?: string;
  relatedPlayerId?: string;
  relatedFixtureId?: string;
  importance: 'normal' | 'high' | 'urgent';
}

export interface FixtureGoal {
  minute: number;
  scorerId: string;
  scorerName: string;
  assistId?: string;
  assistName?: string;
  clubId: string;
  isPenalty?: boolean;
  isOwnGoal?: boolean;
}

export interface FixtureCard {
  minute: number;
  playerId: string;
  playerName: string;
  clubId: string;
  card: 'yellow' | 'red';
}

export interface MatchTeamStats {
  possession: number; // 0..100 integer
  shots: number;
  shotsOnTarget: number;
  corners: number;
  fouls: number;
  yellowCards: number;
  redCards: number;
  tacklesWon: number;
  passesCompleted: number;
  passesAttempted: number;
  xg: number;
}

export interface Fixture {
  id: string;
  leagueId: LeagueId;
  round: number;
  date: string; // ISO YYYY-MM-DD
  kickoffTime: string; // e.g. '15:00'
  homeClubId: string;
  awayClubId: string;
  played: boolean;
  homeGoals: number;
  awayGoals: number;
  attendance?: number;
  goals: FixtureGoal[];
  cards: FixtureCard[];
  manOfTheMatchId?: string;
  manOfTheMatchRating?: number;
  homeStats?: MatchTeamStats;
  awayStats?: MatchTeamStats;
}

export interface StandingRow {
  position: number;
  clubId: string;
  clubName: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  form: Array<'W' | 'D' | 'L'>;
}

export type MatchEventType =
  | 'kickoff'
  | 'pass'
  | 'dribble'
  | 'chance'
  | 'shot_saved'
  | 'shot_missed'
  | 'woodwork'
  | 'goal'
  | 'penalty_awarded'
  | 'penalty_scored'
  | 'penalty_missed'
  | 'free_kick'
  | 'corner'
  | 'tackle'
  | 'foul'
  | 'yellow_card'
  | 'red_card'
  | 'injury'
  | 'substitution'
  | 'halftime'
  | 'fulltime'
  | 'tactical_change';

export type CommentaryFlashMode =
  | 'none'
  | 'pulse'
  | 'flash-goal'
  | 'flash-card'
  | 'flash-chance';

export interface CommentarySegment {
  id: string;
  speaker: 'lead' | 'analyst';
  text: string;
  excitement: number; // 1..10
  teamSide: 'home' | 'away' | 'neutral';
  flashMode: CommentaryFlashMode;
}

/**
 * Match Radar Coordinate Convention (horizontal pitch, Home attacks Left -> Right):
 * - ballX: 0..100 (0 = home goal line, 100 = away goal line)
 * - ballY: 0..100 (0 = top touchline, 100 = bottom touchline)
 * - zoneRow: 0..4 (top -> bottom pitch lanes)
 * - zoneCol: 0..4 (0 = home box -> 4 = away box)
 */
export interface MatchEvent {
  id: string;
  minute: number;
  second: number;
  type: MatchEventType;
  teamSide: 'home' | 'away' | 'neutral';
  clubId?: string;
  primaryPlayerId?: string;
  secondaryPlayerId?: string;
  ballX: number;
  ballY: number;
  zoneRow: number;
  zoneCol: number;
  excitementLevel: number; // 1..10
  isKeyHighlight: boolean;
  segments: CommentarySegment[];
}

export interface RadarPlayerDot {
  playerId: string;
  shirtNumber: number;
  shortName: string;
  side: 'home' | 'away';
  x: number; // 0..100
  y: number; // 0..100
  hasBall: boolean;
  sentOff?: boolean;
}

export interface LivePlayerMatchStat {
  playerId: string;
  rating: number; // 1.0..10.0
  goals: number;
  assists: number;
  shots: number;
  passes: number;
  tackles: number;
  saves: number;
  yellowCards: number;
  redCard: boolean;
  condition: number; // 0..100 live condition
  subbedOffMinute?: number;
  subbedOnMinute?: number;
  injured?: boolean;
}

export type CommentaryFrequency = 'key' | 'extended' | 'full';
export type MatchPhase = 'pre_match' | 'first_half' | 'half_time' | 'second_half' | 'full_time';

export interface MatchSessionState {
  fixtureId: string;
  leagueId: LeagueId;
  homeClubId: string;
  awayClubId: string;
  userSide: 'home' | 'away' | 'neutral';
  phase: MatchPhase;
  minute: number;
  second: number;
  addedTime: number;
  paused: boolean;
  speed: number; // 1..20 (classic CM 01/02 speed bar)
  commentaryFrequency: CommentaryFrequency;
  homeGoals: number;
  awayGoals: number;
  possessionSide: 'home' | 'away';
  ballX: number;
  ballY: number;
  zoneRow: number;
  zoneCol: number;
  homeTactics: TacticsState;
  awayTactics: TacticsState;
  homeSubsUsed: number;
  awaySubsUsed: number;
  maxSubs: number;
  homeStats: MatchTeamStats;
  awayStats: MatchTeamStats;
  playerStats: Record<string, LivePlayerMatchStat>;
  radarPlayers: RadarPlayerDot[];
  events: MatchEvent[];
  activeEvent: MatchEvent | null;
  activeSegmentIndex: number;
  attendance: number;
  weather: 'Clear' | 'Overcast' | 'Light Rain' | 'Heavy Rain' | 'Breezy' | 'Snow';
  temperatureC: number;
  refereeName: string;
  goals: FixtureGoal[];
  cards: FixtureCard[];
  possessionTicksHome: number;
  possessionTicksAway: number;
}

export type BackgroundContextKind =
  | 'home'
  | 'club'
  | 'player'
  | 'league'
  | 'competition'
  | 'match'
  | 'tactics'
  | 'transfers'
  | 'training'
  | 'finances'
  | 'news';

export interface BackgroundContext {
  kind: BackgroundContextKind;
  slug: string;
  title: string;
  subtitle?: string;
  primaryQuery: string;
  fallbackQueries: string[];
  accentColor: string;
  secondaryColor?: string;
  directImageUrl?: string;
  playerName?: string;
  clubName?: string;
  searchHint?: string;
}

export type MediaSource =
  | 'indexeddb'
  | 'disk-cache'
  | 'thesportsdb'
  | 'wikipedia'
  | 'unsplash'
  | 'fallback';

export interface ResolvedMedia {
  slug: string;
  url: string;
  source: MediaSource;
  latencyMs: number;
  cached?: boolean;
  label?: string;
  attribution?: string;
  title?: string;
}

export type TtsProvider = 'webspeech' | 'openai' | 'elevenlabs' | 'local';

export interface AudioSettings {
  voiceEnabled: boolean;
  crowdEnabled: boolean;
  crowdVolume: number; // 0..1
  voiceVolume: number; // 0..1
  ttsProvider: TtsProvider;
  apiKey: string;
  localEndpoint: string;
  leadVoiceName?: string;
  analystVoiceName?: string;
  commentaryFrequency?: CommentaryFrequency;
  scanlines: boolean;
  vignette: boolean;
  overlayOpacity: number; // 0.55..0.90
}

export type GameScreen =
  | 'squad'
  | 'tactics'
  | 'training'
  | 'fixtures'
  | 'table'
  | 'search'
  | 'finances'
  | 'news'
  | 'player'
  | 'club'
  | 'match';

export interface GameDatabase {
  seasonLabel: string;
  leagues: Record<LeagueId, League>;
  clubs: Record<string, Club>;
  players: Record<string, Player>;
}

export interface SaveSlotMeta {
  savedAt: string;
  managerName: string;
  clubId: string;
  clubName: string;
  leagueName: string;
  currentDate: string;
  seasonLabel: string;
}

export interface GameState {
  initialized: boolean;
  seasonLabel: string;
  currentDate: string; // ISO YYYY-MM-DD, starts '2026-08-01'
  userClubId: string;
  manager: ManagerProfile;
  leagues: Record<LeagueId, League>;
  clubs: Record<string, Club>;
  players: Record<string, Player>;
  fixtures: Fixture[];
  standings: Record<LeagueId, StandingRow[]>;
  transferOffers: TransferOffer[];
  contractOffers: ContractOffer[];
  shortlist: string[];
  news: NewsItem[];
  activeMatch: MatchSessionState | null;
  audioSettings: AudioSettings;
}
