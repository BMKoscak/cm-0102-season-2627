/**
 * Exact Module Contracts & React Component Prop Interfaces for every swarm worker.
 * Owned by @architect. Workers MUST export exact function/component names and matching signatures.
 *
 * EXPORT CONVENTION:
 * - Every React view component MUST export BOTH a named export matching its filename
 *   (e.g. `export const SquadView: React.FC<SquadViewProps> = ...`) AND `export default SquadView`.
 * - Audio/ambience singletons MUST be named exports (`export const commentaryAudio`, `export const stadiumAmbience`).
 */

import type {
  AudioSettings,
  BackgroundContext,
  Club,
  ClubColors,
  CommentarySegment,
  ContractOffer,
  Fixture,
  Footedness,
  FormationId,
  GameDatabase,
  GameScreen,
  GameState,
  GoalkeepingAttributes,
  League,
  LeagueId,
  MatchEvent,
  MatchSessionState,
  MentalAttributes,
  NewsItem,
  PhysicalAttributes,
  Player,
  PositionCategory,
  PositionCode,
  ResolvedMedia,
  RunArrow,
  SaveSlotMeta,
  StandingRow,
  TacticalSlot,
  TacticsState,
  TechnicalAttributes,
  TrainingState,
  TransferOffer,
  TransferOfferStatus,
  WibWobGrid,
  WibWobPosition,
} from './game';

/* ============================================================================
 * 1. DATABASE WORKERS — Cleanly Split Across 4 Modules
 *   - src/data/leagues.ts      (18 playable leagues across 12 countries, tier 1 & 2)
 *   - src/data/clubs.ts        (~300 clubs across all 18 leagues)
 *   - src/data/realPlayers.ts  (Curated 2026/27 real squads, wonderkids & free agents)
 *   - src/data/seedDatabase.ts (Assembler + deterministic positional squad filler)
 * ============================================================================ */

export interface ClubSeed {
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
  stadiumName: string;
  stadiumCapacity: number;
  stadiumWikiQuery?: string;
  balance: number; // EUR
  transferBudget: number; // EUR
  wageBudgetWeekly: number; // EUR
  boardExpectation: string;
  managerName: string;
  defaultFormation: FormationId;
  rivals?: string[];
  wikiQuery?: string;
  theSportsDbTeamId?: string;
}

export interface RealPlayerSeed {
  id?: string; // auto-generated slug if omitted
  name: string;
  shortName?: string;
  clubId: string | null; // null = Free Agent / Unattached
  nationality: string;
  nationalityCode: string;
  age: number; // as of August 2026
  dateOfBirth?: string;
  positions: PositionCode[];
  preferredFoot?: Footedness;
  heightCm?: number;
  weightKg?: number;
  squadNumber?: number;
  currentAbility: number; // 1..200
  potentialAbility?: number; // 1..200
  isWonderkid?: boolean;
  reputation?: number; // 1..10000
  value?: number; // EUR
  wage?: number; // weekly EUR
  contractExpires?: string; // ISO YYYY-MM-DD
  careerApps?: number;
  careerGoals?: number;
  internationalCaps?: number;
  internationalGoals?: number;
  wikiQuery?: string;
  attributeOverrides?: {
    technical?: Partial<TechnicalAttributes>;
    mental?: Partial<MentalAttributes>;
    physical?: Partial<PhysicalAttributes>;
    goalkeeping?: Partial<GoalkeepingAttributes>;
  };
}

export interface HydratedClubMedia {
  badgeUrl?: string;
  stadiumImageUrl?: string;
}

export interface HydratedMediaCatalog {
  generatedAt: string;
  clubs: Record<string, HydratedClubMedia>;
  players: Record<string, string>; // playerId -> imageUrl
}

/** src/data/leagues.ts */
export interface LeaguesDataModule {
  LEAGUES_DATA: League[];
}

/** src/data/clubs.ts */
export interface ClubsDataModule {
  CLUBS_SEED: ClubSeed[];
}

/** src/data/realPlayers.ts */
export interface RealPlayersDataModule {
  REAL_PLAYERS_SEED: RealPlayerSeed[];
}

/** src/data/seedDatabase.ts */
export interface SeedDatabaseModule {
  LEAGUES_META: League[];
  CLUBS_DATA: Club[];
  createInitialDatabase: () => GameDatabase;
}

/* ============================================================================
 * 2. ENGINE WORKER — src/engine/*
 *   NOTE: With ~300 clubs across 18 leagues (~150 matches per matchday),
 *   simulateQuickMatch MUST stay O(1) / sub-millisecond so Continue feels instant!
 * ============================================================================ */

export type AttributeTier = 'low' | 'mid' | 'high' | 'elite';

export interface AttributeDescriptor<K extends string = string> {
  key: K;
  label: string;
  shortLabel: string;
}

export interface AttributeGroupsMeta {
  technical: AttributeDescriptor<keyof TechnicalAttributes>[];
  mental: AttributeDescriptor<keyof MentalAttributes>[];
  physical: AttributeDescriptor<keyof PhysicalAttributes>[];
}

/** src/engine/attributes.ts */
export interface AttributesEngineModule {
  ATTRIBUTE_GROUPS: AttributeGroupsMeta;
  getAttributeTier: (value: number) => AttributeTier;
  getPositionCategory: (position: PositionCode) => PositionCategory;
  isNaturalPosition: (player: Player, position: PositionCode) => boolean;
  calculatePositionRating: (player: Player, position: PositionCode) => number; // 0..100
  calculateOverallRating: (player: Player) => number; // 1..99
  estimatePlayerValue: (player: Player, leagueReputation?: number) => number; // leagueReputation 1..20
  estimateWeeklyWage: (player: Player) => number;
}

export interface FormationTemplate {
  id: FormationId;
  label: string;
  description: string;
  slots: Array<{
    roleLabel: PositionCode;
    baseX: number;
    baseY: number;
    defaultArrow: RunArrow;
  }>;
}

export interface TacticalStrengthReport {
  attack: number;
  midfield: number;
  defense: number;
  goalkeeper: number;
  cohesion: number;
  width: number;
  pressingBonus: number;
}

/** src/engine/tactics.ts */
export interface TacticsEngineModule {
  FORMATIONS: Record<FormationId, FormationTemplate>;
  createDefaultWibWobGrid: (slots: TacticalSlot[]) => WibWobGrid;
  createDefaultTactics: (formation: FormationId, squad: Player[]) => TacticsState;
  applyFormation: (current: TacticsState, formation: FormationId, squad: Player[]) => TacticsState;
  autoPickLineup: (tactics: TacticsState, squad: Player[]) => TacticsState;
  getZoneCoordinates: (
    tactics: TacticsState,
    hasBall: boolean,
    row: number,
    col: number
  ) => WibWobPosition[];
  computeTacticalStrength: (
    tactics: TacticsState,
    players: Record<string, Player>
  ) => TacticalStrengthReport;
}

export interface MatchTickResult {
  nextSession: MatchSessionState;
  newEvent: MatchEvent | null;
}

/** src/engine/matchEngine.ts */
export interface MatchEngineModule {
  createMatchSession: (fixture: Fixture, state: GameState) => MatchSessionState;
  stepMatchTick: (
    session: MatchSessionState,
    players: Record<string, Player>,
    clubs: Record<string, Club>
  ) => MatchTickResult;
  applyLiveSubstitution: (
    session: MatchSessionState,
    side: 'home' | 'away',
    outPlayerId: string,
    inPlayerId: string,
    players: Record<string, Player>
  ) => MatchSessionState;
  applyLiveTacticsChange: (
    session: MatchSessionState,
    side: 'home' | 'away',
    tactics: TacticsState
  ) => MatchSessionState;
  simulateQuickMatch: (
    fixture: Fixture,
    clubs: Record<string, Club>,
    players: Record<string, Player>
  ) => Fixture;
}

export interface AdvanceDayResult {
  nextState: GameState;
  userMatchToday: Fixture | null;
  stopReason: 'none' | 'matchday' | 'transfer_response' | 'urgent_news';
}

export interface TransferEvaluationResult {
  status: TransferOfferStatus;
  counterFee?: number;
  message: string;
}

export interface ContractEvaluationResult {
  accepted: boolean;
  counterWage?: number;
  message: string;
}

export interface WeeklyTrainingResult {
  updatedPlayers: Player[];
  updatedTraining: TrainingState;
  newsItem?: NewsItem;
}

/** src/engine/seasonEngine.ts */
export interface SeasonEngineModule {
  generateSeasonFixtures: (
    leagues: Record<LeagueId, League>,
    clubs: Record<string, Club>,
    seasonStartDate?: string
  ) => Fixture[];
  recalculateStandings: (
    leagueId: LeagueId,
    clubs: Record<string, Club>,
    fixtures: Fixture[]
  ) => StandingRow[];
  recalculateAllStandings: (
    leagues: Record<LeagueId, League>,
    clubs: Record<string, Club>,
    fixtures: Fixture[]
  ) => Record<LeagueId, StandingRow[]>;
  advanceOneDay: (state: GameState) => AdvanceDayResult;
  commitMatchResult: (state: GameState, completedSession: MatchSessionState) => GameState;
  evaluateTransferOffer: (
    offer: TransferOffer,
    player: Player,
    sellingClub: Club,
    buyingClub: Club
  ) => TransferEvaluationResult;
  evaluateContractOffer: (
    offer: ContractOffer,
    player: Player,
    club: Club
  ) => ContractEvaluationResult;
  processWeeklyTraining: (
    club: Club,
    squad: Player[],
    date: string
  ) => WeeklyTrainingResult;
  formatCurrency: (amount: number) => string;
  formatDateCM: (isoDate: string) => string;
}

/* ============================================================================
 * 3. MEDIA WORKER — src/services/* & src/components/BackgroundLayer.tsx
 * ============================================================================ */

/** src/services/backgroundService.ts */
export interface BackgroundServiceModule {
  resolveBackground: (ctx: BackgroundContext) => Promise<ResolvedMedia>;
  prefetchBackgrounds: (contexts: BackgroundContext[]) => void;
  clearBackgroundCache: () => Promise<void>;
  buildFallbackSvgDataUrl: (ctx: BackgroundContext) => string;
}

export interface SpeechSyncState {
  speaking: boolean;
  ducked: boolean;
  segment: CommentarySegment | null;
  activeWordIndex: number;
  charIndex: number;
  words: string[];
}

/** src/services/commentaryAudio.ts (exports singleton `commentaryAudioEngine`) */
export interface CommentaryAudioService {
  configure: (settings: AudioSettings) => void;
  enqueueSegment: (segment: CommentarySegment) => void;
  stop: () => void;
  isSpeaking: () => boolean;
  testVoice: (settings: AudioSettings) => Promise<void>;
  subscribeSpeechState?: (listener: (state: SpeechSyncState) => void) => () => void;
  getAvailableVoices?: () => SpeechSynthesisVoice[];
}

/** src/services/stadiumAmbience.ts (exports singleton `stadiumAmbience`) */
export interface StadiumAmbienceService {
  configure: (settings: AudioSettings) => void;
  start: (attendance?: number) => void;
  stop: () => void;
  reactToEvent: (event: MatchEvent) => void;
  setExcitement: (level: number) => void;
  setDucking?: (ducked: boolean) => void;
}

/** src/components/BackgroundLayer.tsx */
export interface BackgroundLayerProps {
  context: BackgroundContext;
  audioSettings: AudioSettings;
  onMediaResolved?: (media: ResolvedMedia) => void;
}

/* ============================================================================
 * 4. UI-CLUB WORKER — src/components/{Squad,PlayerProfile,TableFixtures,SearchTransfers,NewsFinancesTraining}View.tsx
 * ============================================================================ */

export interface SquadViewProps {
  club: Club;
  isUserClub: boolean;
  squad: Player[];
  tactics: TacticsState;
  leagues: Record<LeagueId, League>;
  clubs: Record<string, Club>;
  onSelectPlayer: (playerId: string) => void;
  onSelectClub: (clubId: string) => void;
  onOpenTactics: () => void;
  onAutoPick: () => void;
  onToggleTransferList: (playerId: string) => void;
}

export interface PlayerProfileViewProps {
  player: Player;
  club: Club | null;
  userClub: Club;
  isUserPlayer: boolean;
  isShortlisted: boolean;
  pendingOffers: TransferOffer[];
  leagues: Record<LeagueId, League>;
  clubs: Record<string, Club>;
  onBack: () => void;
  onSelectClub: (clubId: string) => void;
  onToggleShortlist: (playerId: string) => void;
  onToggleTransferList: (playerId: string) => void;
  onSubmitTransferOffer: (offer: Omit<TransferOffer, 'id' | 'status' | 'createdDate'>) => void;
  onSubmitContractOffer: (offer: Omit<ContractOffer, 'id' | 'status'>) => void;
  onAcceptCounterOffer: (offerId: string) => void;
}

export interface TableFixturesViewProps {
  mode: 'table' | 'fixtures';
  activeLeagueId: LeagueId;
  userClubId: string;
  currentDate: string;
  leagues: Record<LeagueId, League>;
  clubs: Record<string, Club>;
  players: Record<string, Player>;
  fixtures: Fixture[];
  standings: Record<LeagueId, StandingRow[]>;
  onSelectLeague: (leagueId: LeagueId) => void;
  onSelectClub: (clubId: string) => void;
  onSelectPlayer: (playerId: string) => void;
  onSwitchMode: (mode: 'table' | 'fixtures') => void;
  onPlayFixture?: (fixtureId: string) => void;
}

export interface SearchTransfersViewProps {
  userClub: Club;
  leagues: Record<LeagueId, League>;
  clubs: Record<string, Club>;
  players: Record<string, Player>;
  shortlist: string[];
  transferOffers: TransferOffer[];
  contractOffers: ContractOffer[];
  onSelectPlayer: (playerId: string) => void;
  onSelectClub: (clubId: string) => void;
  onToggleShortlist: (playerId: string) => void;
  onSubmitTransferOffer: (offer: Omit<TransferOffer, 'id' | 'status' | 'createdDate'>) => void;
  onAcceptCounterOffer: (offerId: string) => void;
  onWithdrawTransferOffer: (offerId: string) => void;
  onSubmitContractOffer: (offer: Omit<ContractOffer, 'id' | 'status'>) => void;
}

export interface NewsFinancesTrainingViewProps {
  mode: 'news' | 'finances' | 'training';
  userClub: Club;
  squad: Player[];
  news: NewsItem[];
  clubs: Record<string, Club>;
  players: Record<string, Player>;
  currentDate: string;
  onSwitchMode: (mode: 'news' | 'finances' | 'training') => void;
  onMarkNewsRead: (newsId: string) => void;
  onMarkAllNewsRead: () => void;
  onUpdateTraining: (training: TrainingState) => void;
  onSelectPlayer: (playerId: string) => void;
  onSelectClub: (clubId: string) => void;
}

/* ============================================================================
 * 5. UI-MATCH WORKER — src/components/TacticsView.tsx & MatchDayView.tsx
 * ============================================================================ */

export interface TacticsViewProps {
  club: Club;
  squad: Player[];
  tactics: TacticsState;
  isLiveMatch?: boolean;
  onUpdateTactics: (nextTactics: TacticsState) => void;
  onAutoPick: () => void;
  onSelectPlayer: (playerId: string) => void;
}

export interface MatchDayViewProps {
  session: MatchSessionState;
  homeClub: Club;
  awayClub: Club;
  players: Record<string, Player>;
  league: League;
  audioSettings: AudioSettings;
  onUpdateSession: (nextSession: MatchSessionState) => void;
  onUpdateAudioSettings: (patch: Partial<AudioSettings>) => void;
  onFinishMatch: (completedSession: MatchSessionState) => void;
  onSelectPlayer: (playerId: string) => void;
}

/* ============================================================================
 * 6. APP SHELL / NAVIGATION HELPERS
 * ============================================================================ */

export interface SidebarProps {
  activeScreen: GameScreen;
  userClub: Club;
  managerName: string;
  currentDate: string;
  unreadNewsCount: number;
  hasActiveMatch: boolean;
  hasNextMatchToday: boolean;
  onNavigate: (screen: GameScreen) => void;
  onContinue: () => void;
  onSaveGame: () => void;
  onOpenNewGame: () => void;
  lastSavedAt: string | null;
}

export interface TopBarProps {
  userClub: Club;
  league: League;
  managerName: string;
  currentDate: string;
  nextFixture: Fixture | null;
  clubs: Record<string, Club>;
  audioSettings: AudioSettings;
  mediaInfo: ResolvedMedia | null;
  hasActiveMatch: boolean;
  onContinue: () => void;
  onUpdateAudioSettings: (patch: Partial<AudioSettings>) => void;
  onSelectClub: (clubId: string) => void;
  onOpenMatch: () => void;
}

export interface NewGameModalProps {
  isOpen: boolean;
  canClose: boolean;
  leagues: League[];
  clubs: Club[];
  savedMeta: SaveSlotMeta | null;
  isLoadingSave: boolean;
  onStartNewGame: (clubId: string, managerName: string, managerNationality: string) => void;
  onResumeSavedGame: () => void;
  onClose: () => void;
}
