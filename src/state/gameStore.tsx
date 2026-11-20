import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createInitialDatabase } from '../data/seedDatabase';
import { autoPickLineup } from '../engine/tactics';
import { createMatchSession } from '../engine/matchEngine';
import {
  advanceOneDay,
  commitMatchResult,
  evaluateContractOffer,
  evaluateTransferOffer,
  formatCurrency,
  generateSeasonFixtures,
  recalculateAllStandings,
} from '../engine/seasonEngine';
import { prefetchBackgrounds } from '../services/backgroundService';
import type {
  AudioSettings,
  BackgroundContext,
  Club,
  ContractOffer,
  Fixture,
  GameDatabase,
  GameScreen,
  GameState,
  LeagueId,
  MatchSessionState,
  NewsItem,
  Player,
  ResolvedMedia,
  SaveSlotMeta,
  TacticsState,
  TrainingState,
  TransferOffer,
} from '../types/game';

/* ============================================================================
 * INDEXEDDB PERSISTENCE (Supports ~4-10MB deep pyramid saves cleanly)
 * ============================================================================ */

const IDB_DB_NAME = 'cm0102_season2627_db';
const IDB_STORE_NAME = 'careers';
const IDB_PRIMARY_KEY = 'primary_career';
const META_LS_KEY = 'cm0102_2627_save_meta';
const AUDIO_LS_KEY = 'cm0102_2627_audio_settings';

const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
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
};

function openSaveDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE_NAME)) {
        db.createObjectStore(IDB_STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Failed to open IndexedDB'));
  });
}

async function saveGameToIndexedDb(state: GameState): Promise<void> {
  const db = await openSaveDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE_NAME, 'readwrite');
      tx.objectStore(IDB_STORE_NAME).put(state, IDB_PRIMARY_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('IndexedDB save failed'));
    });
  } finally {
    db.close();
  }
}

async function loadGameFromIndexedDb(): Promise<GameState | null> {
  const db = await openSaveDb();
  try {
    return await new Promise<GameState | null>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE_NAME, 'readonly');
      const req = tx.objectStore(IDB_STORE_NAME).get(IDB_PRIMARY_KEY);
      req.onsuccess = () => resolve((req.result as GameState | undefined) ?? null);
      req.onerror = () => reject(req.error ?? new Error('IndexedDB load failed'));
    });
  } finally {
    db.close();
  }
}

function readSavedMeta(): SaveSlotMeta | null {
  try {
    const raw = localStorage.getItem(META_LS_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SaveSlotMeta;
  } catch {
    return null;
  }
}

function writeSavedMeta(meta: SaveSlotMeta): void {
  try {
    localStorage.setItem(META_LS_KEY, JSON.stringify(meta));
  } catch {
    // ignore storage quota issues on tiny metadata
  }
}

function readAudioSettings(): AudioSettings {
  try {
    const raw = localStorage.getItem(AUDIO_LS_KEY);
    if (!raw) return DEFAULT_AUDIO_SETTINGS;
    return { ...DEFAULT_AUDIO_SETTINGS, ...(JSON.parse(raw) as Partial<AudioSettings>) };
  } catch {
    return DEFAULT_AUDIO_SETTINGS;
  }
}

function writeAudioSettings(settings: AudioSettings): void {
  try {
    localStorage.setItem(AUDIO_LS_KEY, JSON.stringify(settings));
  } catch {
    // ignore
  }
}

function createId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function buildFreshGameState(
  db: GameDatabase,
  clubId: string,
  managerName: string,
  managerNationality: string,
  audioSettings: AudioSettings
): GameState {
  const startDate = '2026-08-01';
  const chosenClub = db.clubs[clubId] ?? Object.values(db.clubs)[0];
  const resolvedClubId = chosenClub.id;
  const league = db.leagues[chosenClub.leagueId] ?? Object.values(db.leagues)[0];

  // Update manager name on user's chosen club
  const updatedClubs: Record<string, Club> = {
    ...db.clubs,
    [resolvedClubId]: {
      ...chosenClub,
      managerName,
    },
  };

  const fixtures = generateSeasonFixtures(db.leagues, updatedClubs, '2026-08-08');
  const standings = recalculateAllStandings(db.leagues, updatedClubs, fixtures);

  const welcomeNews: NewsItem[] = [
    {
      id: createId('news'),
      date: startDate,
      headline: `${chosenClub.name} appoint ${managerName} as new manager`,
      body: `The board of directors at ${chosenClub.name} have officially unveiled ${managerName} as the club's manager for the 2026/27 ${league.name} campaign.\n\nBoard Expectation: ${chosenClub.boardExpectation}.\nTransfer Budget: ${formatCurrency(chosenClub.finances.transferBudget)}.\nWeekly Wage Budget: ${formatCurrency(chosenClub.finances.wageBudgetWeekly)}/wk.\nHome Ground: ${chosenClub.stadium.name} (${chosenClub.stadium.capacity.toLocaleString()} capacity).`,
      category: 'board',
      read: false,
      relatedClubId: resolvedClubId,
      importance: 'urgent',
    },
    {
      id: createId('news'),
      date: startDate,
      headline: `${league.name} 2026/27 Season Preview`,
      body: `All ${league.clubIds.length} clubs across ${league.name} are finalizing pre-season preparations ahead of Matchday 1. Press SPACEBAR or click Continue to advance through the calendar toward your opening fixture.`,
      category: 'league',
      read: false,
      relatedClubId: resolvedClubId,
      importance: 'normal',
    },
    {
      id: createId('news'),
      date: startDate,
      headline: `Assistant Manager Briefing — Tactics & Wib-Wob Ready`,
      body: `Your squad is currently lined up in a ${chosenClub.tactics.formation} formation. Visit the Tactics screen to assign directional run arrows and fine-tune With-Ball / Without-Ball (Wib-Wob) 5x5 zone positioning before kick-off.`,
      category: 'training',
      read: false,
      relatedClubId: resolvedClubId,
      importance: 'normal',
    },
  ];

  return {
    initialized: true,
    seasonLabel: db.seasonLabel || '2026/27',
    currentDate: startDate,
    userClubId: resolvedClubId,
    manager: {
      name: managerName,
      nationality: managerNationality,
      clubId: resolvedClubId,
      reputation: Math.min(9000, Math.max(2500, Math.round(chosenClub.reputation * 0.8))),
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
    clubs: updatedClubs,
    players: db.players,
    fixtures,
    standings,
    transferOffers: [],
    contractOffers: [],
    shortlist: [],
    news: welcomeNews,
    activeMatch: null,
    audioSettings,
  };
}

function buildBackgroundContext(
  screen: GameScreen,
  state: GameState,
  selectedClubId: string,
  selectedPlayerId: string | null,
  selectedLeagueId: LeagueId
): BackgroundContext {
  const userClub = state.clubs[state.userClubId] ?? Object.values(state.clubs)[0];
  const viewedClub = state.clubs[selectedClubId] ?? userClub;
  const viewedLeague =
    state.leagues[selectedLeagueId] ??
    state.leagues[viewedClub.leagueId] ??
    Object.values(state.leagues)[0];

  if (screen === 'player' && selectedPlayerId && state.players[selectedPlayerId]) {
    const p = state.players[selectedPlayerId];
    const pClub = p.clubId ? state.clubs[p.clubId] : null;
    if (pClub) {
      return {
        kind: 'club',
        slug: `club-${pClub.id}`,
        title: pClub.name,
        subtitle: pClub.stadium.name,
        clubName: pClub.name,
        playerName: p.name,
        primaryQuery: pClub.stadium.wikiQuery || `${pClub.stadium.name} stadium`,
        fallbackQueries: [
          `${pClub.name} football stadium`,
          `${pClub.city} stadium`,
          'football stadium pitch floodlights',
        ],
        accentColor: pClub.colors.primary,
        secondaryColor: pClub.colors.secondary,
        directImageUrl: pClub.stadium.imageUrl,
      };
    }
    return {
      kind: 'club',
      slug: `free-agent-${p.nationalityCode.toLowerCase()}`,
      title: p.name,
      subtitle: `Free Agent · ${p.nationality}`,
      playerName: p.name,
      primaryQuery: `${p.nationality} national football stadium`,
      fallbackQueries: ['football stadium pitch floodlights', 'european football stadium'],
      accentColor: '#1d4ed8',
      secondaryColor: '#ffd84d',
    };
  }

  if (screen === 'match' && state.activeMatch) {
    const home = state.clubs[state.activeMatch.homeClubId] ?? userClub;
    const away = state.clubs[state.activeMatch.awayClubId];
    return {
      kind: 'match',
      slug: `match-${home.id}`,
      title: `${home.shortName} vs ${away?.shortName ?? 'Away'}`,
      subtitle: home.stadium.name,
      clubName: home.name,
      primaryQuery: home.stadium.wikiQuery || `${home.stadium.name} stadium`,
      fallbackQueries: [
        `${home.name} stadium floodlights`,
        'football stadium night crowd match',
      ],
      accentColor: home.colors.primary,
      secondaryColor: away?.colors.primary ?? home.colors.secondary,
      directImageUrl: home.stadium.imageUrl,
    };
  }

  if (screen === 'table' || screen === 'fixtures') {
    return {
      kind: 'competition',
      slug: `league-${viewedLeague.id}`,
      title: viewedLeague.name,
      subtitle: viewedLeague.country,
      primaryQuery: viewedLeague.bgQuery || `${viewedLeague.name} stadium`,
      fallbackQueries: [
        viewedLeague.wikipediaTitle,
        `${viewedLeague.country} football stadium`,
        'european football stadium floodlights',
      ],
      accentColor: viewedLeague.accentColor || '#1d4ed8',
      secondaryColor: '#ffd84d',
    };
  }

  if (screen === 'tactics') {
    return {
      kind: 'tactics',
      slug: `tactics-${userClub.id}`,
      title: `${userClub.shortName} Tactics`,
      subtitle: userClub.stadium.name,
      primaryQuery: userClub.stadium.wikiQuery || `${userClub.stadium.name} pitch`,
      fallbackQueries: ['football pitch aerial stadium', 'soccer stadium grass pitch'],
      accentColor: userClub.colors.primary,
      secondaryColor: userClub.colors.secondary,
      directImageUrl: userClub.stadium.imageUrl,
    };
  }

  if (screen === 'training') {
    return {
      kind: 'training',
      slug: `training-${userClub.country.toLowerCase()}`,
      title: `${userClub.shortName} Training Ground`,
      subtitle: userClub.city,
      primaryQuery: 'football training pitch grass stadium',
      fallbackQueries: [userClub.stadium.name, 'soccer training ground'],
      accentColor: '#16a34a',
      secondaryColor: userClub.colors.primary,
    };
  }

  if (screen === 'search') {
    return {
      kind: 'transfers',
      slug: 'transfers-scouting-network',
      title: 'Global Transfer Market',
      subtitle: 'Scouting & Negotiations',
      primaryQuery: 'football stadium aerial night lights',
      fallbackQueries: ['european football stadium architecture', userClub.stadium.name],
      accentColor: '#0284c7',
      secondaryColor: '#38e8d5',
    };
  }

  if (screen === 'finances') {
    return {
      kind: 'finances',
      slug: `club-${userClub.id}`,
      title: `${userClub.shortName} Finances`,
      subtitle: userClub.stadium.name,
      primaryQuery: userClub.stadium.wikiQuery || `${userClub.stadium.name} stadium`,
      fallbackQueries: [`${userClub.name} stadium`, 'modern football stadium'],
      accentColor: userClub.colors.primary,
      secondaryColor: '#ffd84d',
      directImageUrl: userClub.stadium.imageUrl,
    };
  }

  if (screen === 'news') {
    return {
      kind: 'news',
      slug: `club-${userClub.id}`,
      title: `${userClub.shortName} Manager Inbox`,
      subtitle: userClub.stadium.name,
      primaryQuery: userClub.stadium.wikiQuery || `${userClub.stadium.name} stadium`,
      fallbackQueries: ['football stadium tunnel night', `${userClub.city} football stadium`],
      accentColor: userClub.colors.primary,
      secondaryColor: userClub.colors.secondary,
      directImageUrl: userClub.stadium.imageUrl,
    };
  }

  // Default: 'squad' or 'club'
  const clubForBg = screen === 'club' ? viewedClub : userClub;
  return {
    kind: 'club',
    slug: `club-${clubForBg.id}`,
    title: clubForBg.name,
    subtitle: clubForBg.stadium.name,
    clubName: clubForBg.name,
    searchHint: clubForBg.stadium.wikiQuery,
    primaryQuery: clubForBg.stadium.wikiQuery || `${clubForBg.stadium.name} stadium`,
    fallbackQueries: [
      `${clubForBg.name} football stadium`,
      `${clubForBg.city} stadium`,
      viewedLeague.bgQuery,
    ],
    accentColor: clubForBg.colors.primary,
    secondaryColor: clubForBg.colors.secondary,
    directImageUrl: clubForBg.stadium.imageUrl,
  };
}

/* ============================================================================
 * REACT CONTEXT & STORE INTERFACE
 * ============================================================================ */

export interface GameStoreValue {
  state: GameState;
  activeScreen: GameScreen;
  selectedClubId: string;
  selectedPlayerId: string | null;
  selectedLeagueId: LeagueId;
  isNewGameOpen: boolean;
  savedMeta: SaveSlotMeta | null;
  isLoadingSave: boolean;
  lastSavedAt: string | null;
  toastMessage: string | null;
  mediaInfo: ResolvedMedia | null;
  backgroundContext: BackgroundContext;
  userClub: Club;
  userLeague: GameState['leagues'][string];
  userSquad: Player[];
  nextUserFixture: Fixture | null;
  hasNextMatchToday: boolean;
  unreadNewsCount: number;

  // Navigation
  navigate: (screen: GameScreen) => void;
  selectClub: (clubId: string) => void;
  selectPlayer: (playerId: string) => void;
  selectLeague: (leagueId: LeagueId) => void;
  goBackFromPlayer: () => void;
  setNewGameOpen: (open: boolean) => void;
  setMediaInfo: (media: ResolvedMedia) => void;

  // Core Career Actions
  startNewGame: (clubId: string, managerName: string, managerNationality: string) => void;
  saveGame: (silent?: boolean) => Promise<void>;
  loadSavedGame: () => Promise<void>;
  continueGame: () => void;
  playFixture: (fixtureId: string) => void;

  // Club Management Actions
  updateUserTactics: (nextTactics: TacticsState) => void;
  autoPickUserLineup: () => void;
  updateUserTraining: (training: TrainingState) => void;
  toggleShortlist: (playerId: string) => void;
  toggleTransferList: (playerId: string) => void;

  // Transfers & Contracts
  submitTransferOffer: (draft: Omit<TransferOffer, 'id' | 'status' | 'createdDate'>) => void;
  acceptCounterOffer: (offerId: string) => void;
  withdrawTransferOffer: (offerId: string) => void;
  submitContractOffer: (draft: Omit<ContractOffer, 'id' | 'status'>) => void;

  // News
  markNewsRead: (newsId: string) => void;
  markAllNewsRead: () => void;

  // Live Match & Audio
  updateActiveMatch: (nextSession: MatchSessionState) => void;
  finishActiveMatch: (completedSession: MatchSessionState) => void;
  updateAudioSettings: (patch: Partial<AudioSettings>) => void;
}

const GameStoreContext = createContext<GameStoreValue | null>(null);

export const GameStoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Build initial catalog once for New Game picker & default boot state
  const bootStateRef = useRef<GameState | null>(null);
  if (!bootStateRef.current) {
    const db = createInitialDatabase();
    const audio = readAudioSettings();
    const firstClubId = Object.keys(db.clubs)[0];
    const initial = buildFreshGameState(db, firstClubId, 'Manager', 'Slovenia', audio);
    initial.initialized = false; // Show New Game / Resume picker on first open
    bootStateRef.current = initial;
  }

  const [state, setState] = useState<GameState>(bootStateRef.current);
  const [activeScreen, setActiveScreen] = useState<GameScreen>('squad');
  const [previousScreen, setPreviousScreen] = useState<GameScreen>('squad');
  const [selectedClubId, setSelectedClubId] = useState<string>(bootStateRef.current.userClubId);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [selectedLeagueId, setSelectedLeagueId] = useState<LeagueId>(
    bootStateRef.current.clubs[bootStateRef.current.userClubId]?.leagueId ??
      Object.keys(bootStateRef.current.leagues)[0]
  );
  const [isNewGameOpen, setIsNewGameOpen] = useState<boolean>(true);
  const [savedMeta, setSavedMeta] = useState<SaveSlotMeta | null>(() => readSavedMeta());
  const [isLoadingSave, setIsLoadingSave] = useState<boolean>(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [mediaInfo, setMediaInfo] = useState<ResolvedMedia | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setToastMessage(null);
      toastTimerRef.current = null;
    }, 3600);
  }, []);

  const userClub = useMemo(
    () => state.clubs[state.userClubId] ?? Object.values(state.clubs)[0],
    [state.clubs, state.userClubId]
  );

  const userLeague = useMemo(
    () => state.leagues[userClub.leagueId] ?? Object.values(state.leagues)[0],
    [state.leagues, userClub.leagueId]
  );

  const userSquad = useMemo(
    () => Object.values(state.players).filter((p) => p.clubId === userClub.id),
    [state.players, userClub.id]
  );

  const nextUserFixture = useMemo(() => {
    const upcoming = state.fixtures
      .filter(
        (f) => !f.played && (f.homeClubId === userClub.id || f.awayClubId === userClub.id)
      )
      .sort((a, b) => a.date.localeCompare(b.date));
    return upcoming[0] ?? null;
  }, [state.fixtures, userClub.id]);

  const hasNextMatchToday = Boolean(nextUserFixture && nextUserFixture.date === state.currentDate);

  const unreadNewsCount = useMemo(
    () => state.news.reduce((acc, item) => acc + (item.read ? 0 : 1), 0),
    [state.news]
  );

  // Sync CSS custom properties with user club colors & glass overlay opacity
  useEffect(() => {
    const root = document.documentElement.style;
    root.setProperty('--cm-overlay-opacity', String(state.audioSettings.overlayOpacity ?? 0.72));
    root.setProperty('--cm-club-primary', userClub.colors.primary);
    root.setProperty('--cm-club-secondary', userClub.colors.secondary);
    root.setProperty('--cm-club-text', userClub.colors.text);
  }, [state.audioSettings.overlayOpacity, userClub.colors]);

  const backgroundContext = useMemo(
    () =>
      buildBackgroundContext(
        activeScreen,
        state,
        selectedClubId,
        selectedPlayerId,
        selectedLeagueId
      ),
    [activeScreen, state, selectedClubId, selectedPlayerId, selectedLeagueId]
  );

  // Save helper
  const persistState = useCallback(
    async (targetState: GameState, silent = false) => {
      try {
        await saveGameToIndexedDb(targetState);
        const club = targetState.clubs[targetState.userClubId];
        const lg = club ? targetState.leagues[club.leagueId] : undefined;
        const now = new Date();
        const meta: SaveSlotMeta = {
          savedAt: now.toISOString(),
          managerName: targetState.manager.name,
          clubId: targetState.userClubId,
          clubName: club?.name ?? targetState.userClubId,
          leagueName: lg?.name ?? '',
          currentDate: targetState.currentDate,
          seasonLabel: targetState.seasonLabel,
        };
        writeSavedMeta(meta);
        setSavedMeta(meta);
        const hh = String(now.getHours()).padStart(2, '0');
        const mm = String(now.getMinutes()).padStart(2, '0');
        setLastSavedAt(`${hh}:${mm}`);
        if (!silent) {
          showToast(`Career saved (${meta.clubName} — ${meta.currentDate})`);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Storage error';
        if (!silent) showToast(`Save failed: ${msg}`);
      }
    },
    [showToast]
  );

  const saveGame = useCallback(
    async (silent = false) => {
      await persistState(state, silent);
    },
    [persistState, state]
  );

  const loadSavedGame = useCallback(async () => {
    setIsLoadingSave(true);
    try {
      const loaded = await loadGameFromIndexedDb();
      if (!loaded) {
        showToast('No saved career found in IndexedDB.');
        return;
      }
      const restoredAudio = { ...DEFAULT_AUDIO_SETTINGS, ...loaded.audioSettings };
      const restored: GameState = {
        ...loaded,
        initialized: true,
        audioSettings: restoredAudio,
      };
      setState(restored);
      const club = restored.clubs[restored.userClubId];
      setSelectedClubId(restored.userClubId);
      if (club) setSelectedLeagueId(club.leagueId);
      setActiveScreen(restored.activeMatch ? 'match' : 'squad');
      setIsNewGameOpen(false);
      showToast(`Resumed ${club?.name ?? 'career'} (${restored.currentDate})`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      showToast(`Failed to load career: ${msg}`);
    } finally {
      setIsLoadingSave(false);
    }
  }, [showToast]);

  const startNewGame = useCallback(
    (clubId: string, managerName: string, managerNationality: string) => {
      const db = createInitialDatabase();
      const fresh = buildFreshGameState(
        db,
        clubId,
        managerName,
        managerNationality,
        state.audioSettings
      );
      setState(fresh);
      const club = fresh.clubs[fresh.userClubId];
      setSelectedClubId(fresh.userClubId);
      setSelectedLeagueId(club.leagueId);
      setSelectedPlayerId(null);
      setActiveScreen('squad');
      setIsNewGameOpen(false);
      showToast(`Welcome to ${club.name}, ${managerName}!`);

      // Warm smart background cache for club, league & top 2 stars
      const league = fresh.leagues[club.leagueId];
      const topStars = Object.values(fresh.players)
        .filter((p) => p.clubId === club.id)
        .sort((a, b) => b.currentAbility - a.currentAbility)
        .slice(0, 2);
      const toPrefetch: BackgroundContext[] = [
        buildBackgroundContext('squad', fresh, club.id, null, club.leagueId),
        buildBackgroundContext('table', fresh, club.id, null, league.id),
        ...topStars.map((p) =>
          buildBackgroundContext('player', fresh, club.id, p.id, club.leagueId)
        ),
      ];
      prefetchBackgrounds(toPrefetch);
    },
    [showToast, state.audioSettings]
  );

  // Navigation
  const navigate = useCallback(
    (screen: GameScreen) => {
      if (screen === 'squad') {
        setSelectedClubId(state.userClubId);
      }
      if (screen !== 'player') {
        setPreviousScreen(screen);
      }
      setActiveScreen(screen);
    },
    [state.userClubId]
  );

  const selectClub = useCallback(
    (clubId: string) => {
      if (!state.clubs[clubId]) return;
      setSelectedClubId(clubId);
      if (clubId === state.userClubId) {
        setActiveScreen('squad');
      } else {
        setPreviousScreen('club');
        setActiveScreen('club');
      }
    },
    [state.clubs, state.userClubId]
  );

  const selectPlayer = useCallback(
    (playerId: string) => {
      if (!state.players[playerId]) return;
      if (activeScreen !== 'player') {
        setPreviousScreen(activeScreen);
      }
      setSelectedPlayerId(playerId);
      setActiveScreen('player');
    },
    [activeScreen, state.players]
  );

  const selectLeague = useCallback((leagueId: LeagueId) => {
    setSelectedLeagueId(leagueId);
  }, []);

  const goBackFromPlayer = useCallback(() => {
    setActiveScreen(previousScreen === 'player' ? 'squad' : previousScreen);
  }, [previousScreen]);

  // Launch a specific matchday fixture
  const playFixture = useCallback(
    (fixtureId: string) => {
      const fixture = state.fixtures.find((f) => f.id === fixtureId);
      if (!fixture || fixture.played) return;
      const session = createMatchSession(fixture, state);
      setState((prev) => ({ ...prev, activeMatch: session }));
      setActiveScreen('match');
    },
    [state]
  );

  // Continue calendar / Matchday trigger (Spacebar or Continue button)
  const continueGame = useCallback(() => {
    if (state.activeMatch) {
      setActiveScreen('match');
      return;
    }

    // If user already has an unplayed match on currentDate -> enter Match Day!
    const matchToday = state.fixtures.find(
      (f) =>
        !f.played &&
        f.date === state.currentDate &&
        (f.homeClubId === state.userClubId || f.awayClubId === state.userClubId)
    );
    if (matchToday) {
      const session = createMatchSession(matchToday, state);
      setState((prev) => ({ ...prev, activeMatch: session }));
      setActiveScreen('match');
      return;
    }

    // Otherwise advance day-by-day (up to 7 days), stopping on matchday, urgent news, or transfer response
    let workingState = state;
    let finalReason: 'none' | 'matchday' | 'transfer_response' | 'urgent_news' = 'none';
    let foundMatch: Fixture | null = null;

    for (let step = 0; step < 7; step++) {
      const res = advanceOneDay(workingState);
      workingState = res.nextState;
      finalReason = res.stopReason;
      foundMatch = res.userMatchToday;
      if (foundMatch || finalReason !== 'none') {
        break;
      }
    }

    setState(workingState);

    if (foundMatch) {
      const oppId =
        foundMatch.homeClubId === workingState.userClubId
          ? foundMatch.awayClubId
          : foundMatch.homeClubId;
      const oppName = workingState.clubs[oppId]?.shortName ?? 'Opponent';
      showToast(`Match Day vs ${oppName}! Review tactics or press SPACE to Kick Off.`);
    } else if (finalReason === 'transfer_response') {
      showToast('Transfer response received in Manager News.');
    } else if (finalReason === 'urgent_news') {
      showToast('Urgent message arrived in Manager News.');
    }
  }, [showToast, state]);

  // Tactics & Training
  const updateUserTactics = useCallback((nextTactics: TacticsState) => {
    setState((prev) => {
      const club = prev.clubs[prev.userClubId];
      if (!club) return prev;
      return {
        ...prev,
        clubs: {
          ...prev.clubs,
          [club.id]: {
            ...club,
            tactics: nextTactics,
          },
        },
      };
    });
  }, []);

  const autoPickUserLineup = useCallback(() => {
    setState((prev) => {
      const club = prev.clubs[prev.userClubId];
      if (!club) return prev;
      const squad = Object.values(prev.players).filter((p) => p.clubId === club.id);
      const nextTactics = autoPickLineup(club.tactics, squad);
      return {
        ...prev,
        clubs: {
          ...prev.clubs,
          [club.id]: {
            ...club,
            tactics: nextTactics,
          },
        },
      };
    });
    showToast('Assistant Manager picked best available XI & bench.');
  }, [showToast]);

  const updateUserTraining = useCallback((training: TrainingState) => {
    setState((prev) => {
      const club = prev.clubs[prev.userClubId];
      if (!club) return prev;
      return {
        ...prev,
        clubs: {
          ...prev.clubs,
          [club.id]: {
            ...club,
            training,
          },
        },
      };
    });
  }, []);

  // Shortlist & Transfer Listing
  const toggleShortlist = useCallback((playerId: string) => {
    setState((prev) => {
      const exists = prev.shortlist.includes(playerId);
      return {
        ...prev,
        shortlist: exists
          ? prev.shortlist.filter((id) => id !== playerId)
          : [...prev.shortlist, playerId],
      };
    });
  }, []);

  const toggleTransferList = useCallback((playerId: string) => {
    setState((prev) => {
      const player = prev.players[playerId];
      if (!player || player.clubId !== prev.userClubId) return prev;
      return {
        ...prev,
        players: {
          ...prev.players,
          [playerId]: {
            ...player,
            transferListed: !player.transferListed,
          },
        },
      };
    });
  }, []);

  // Transfers & Contracts
  const submitTransferOffer = useCallback(
    (draft: Omit<TransferOffer, 'id' | 'status' | 'createdDate'>) => {
      const player = state.players[draft.playerId];
      const buyingClub = state.clubs[draft.fromClubId];
      const sellingClub = state.clubs[draft.toClubId];
      if (!player || !buyingClub || !sellingClub) return;

      if (draft.fee > buyingClub.finances.transferBudget) {
        showToast(
          `Insufficient transfer budget (${formatCurrency(buyingClub.finances.transferBudget)} available).`
        );
        return;
      }

      const offer: TransferOffer = {
        ...draft,
        id: createId('offer'),
        status: 'pending',
        createdDate: state.currentDate,
      };

      const evaluation = evaluateTransferOffer(offer, player, sellingClub, buyingClub);
      const finalized: TransferOffer = {
        ...offer,
        status: evaluation.status,
        counterFee: evaluation.counterFee,
        responseDate: state.currentDate,
        notes: evaluation.message,
      };

      const newsItem: NewsItem = {
        id: createId('news'),
        date: state.currentDate,
        headline:
          evaluation.status === 'accepted'
            ? `${sellingClub.shortName} accept ${formatCurrency(offer.fee)} bid for ${player.name}`
            : evaluation.status === 'countered'
              ? `${sellingClub.shortName} counter bid for ${player.name}`
              : `${sellingClub.shortName} reject bid for ${player.name}`,
        body: evaluation.message,
        category: 'transfer',
        read: false,
        relatedClubId: sellingClub.id,
        relatedPlayerId: player.id,
        importance: evaluation.status === 'accepted' ? 'high' : 'normal',
      };

      setState((prev) => ({
        ...prev,
        transferOffers: [finalized, ...prev.transferOffers],
        news: [newsItem, ...prev.news],
      }));

      showToast(evaluation.message);
    },
    [showToast, state.clubs, state.currentDate, state.players]
  );

  const acceptCounterOffer = useCallback(
    (offerId: string) => {
      const existing = state.transferOffers.find((o) => o.id === offerId);
      if (!existing || existing.status !== 'countered' || existing.counterFee === undefined) return;
      const buyer = state.clubs[existing.fromClubId];
      const player = state.players[existing.playerId];
      if (!buyer || !player) return;

      if (existing.counterFee > buyer.finances.transferBudget) {
        showToast(
          `Cannot meet counter-offer of ${formatCurrency(existing.counterFee)} — insufficient budget.`
        );
        return;
      }

      setState((prev) => ({
        ...prev,
        transferOffers: prev.transferOffers.map((o) =>
          o.id === offerId
            ? {
                ...o,
                fee: existing.counterFee!,
                status: 'accepted',
                responseDate: prev.currentDate,
                notes: 'Counter-offer matched. Proceed to contract negotiations.',
              }
            : o
        ),
      }));
      showToast(`Fee agreed for ${player.name}! Offer a contract to complete signing.`);
    },
    [showToast, state.clubs, state.players, state.transferOffers]
  );

  const withdrawTransferOffer = useCallback((offerId: string) => {
    setState((prev) => ({
      ...prev,
      transferOffers: prev.transferOffers.map((o) =>
        o.id === offerId ? { ...o, status: 'withdrawn' } : o
      ),
    }));
  }, []);

  const submitContractOffer = useCallback(
    (draft: Omit<ContractOffer, 'id' | 'status'>) => {
      const player = state.players[draft.playerId];
      const club = state.clubs[draft.clubId];
      if (!player || !club) return;

      const offer: ContractOffer = {
        ...draft,
        id: createId('contract'),
        status: 'pending',
      };

      const evaluation = evaluateContractOffer(offer, player, club);

      if (!evaluation.accepted) {
        const declined: ContractOffer = {
          ...offer,
          status: evaluation.counterWage ? 'countered' : 'rejected',
          counterWage: evaluation.counterWage,
          responseMessage: evaluation.message,
        };
        setState((prev) => ({
          ...prev,
          contractOffers: [declined, ...prev.contractOffers],
        }));
        showToast(evaluation.message);
        return;
      }

      // Contract accepted! Complete transfer or renewal cleanly.
      setState((prev) => {
        const curPlayer = prev.players[draft.playerId];
        const buyingClub = prev.clubs[draft.clubId];
        if (!curPlayer || !buyingClub) return prev;

        const isRenewal = curPlayer.clubId === buyingClub.id;
        const acceptedTransfer = draft.transferOfferId
          ? prev.transferOffers.find((o) => o.id === draft.transferOfferId)
          : prev.transferOffers.find(
              (o) =>
                o.playerId === curPlayer.id &&
                o.fromClubId === buyingClub.id &&
                o.status === 'accepted'
            );

        const transferFee = isRenewal ? 0 : (acceptedTransfer?.fee ?? 0);
        const totalUpfront = transferFee + draft.signingOnFee;
        const oldClubId = curPlayer.clubId;
        const oldClub = oldClubId && oldClubId !== buyingClub.id ? prev.clubs[oldClubId] : null;

        // Assign non-colliding squad number if joining a new club
        let assignedNumber = curPlayer.squadNumber;
        if (!isRenewal) {
          const taken = new Set(
            Object.values(prev.players)
              .filter((p) => p.clubId === buyingClub.id && p.squadNumber)
              .map((p) => p.squadNumber!)
          );
          if (!assignedNumber || taken.has(assignedNumber)) {
            for (let n = 1; n <= 99; n++) {
              if (!taken.has(n)) {
                assignedNumber = n;
                break;
              }
            }
          }
        }

        const currentYear = Number(prev.currentDate.slice(0, 4)) || 2026;
        const newExpiry = `${currentYear + draft.years}-06-30`;

        const updatedPlayer: Player = {
          ...curPlayer,
          clubId: buyingClub.id,
          wage: draft.weeklyWage,
          squadStatus: draft.squadStatus,
          contractExpires: newExpiry,
          releaseClause: draft.releaseClause,
          squadNumber: assignedNumber,
          transferListed: false,
          loanListed: false,
          morale: 'Very Good',
        };

        const updatedPlayers: Record<string, Player> = {
          ...prev.players,
          [curPlayer.id]: updatedPlayer,
        };

        const calcClubWages = (cid: string) =>
          Object.values(updatedPlayers)
            .filter((p) => p.clubId === cid)
            .reduce((sum, p) => sum + p.wage, 0);

        const nextClubs: Record<string, Club> = { ...prev.clubs };

        // Update buying club finances
        const buyTx = {
          id: createId('tx'),
          date: prev.currentDate,
          category: 'Transfer' as const,
          description: isRenewal
            ? `Contract renewal signing bonus (${curPlayer.name})`
            : `Signed ${curPlayer.name}${oldClub ? ` from ${oldClub.shortName}` : ' (Free Transfer)'}`,
          amount: -totalUpfront,
        };

        nextClubs[buyingClub.id] = {
          ...buyingClub,
          finances: {
            ...buyingClub.finances,
            balance: buyingClub.finances.balance - totalUpfront,
            transferBudget: Math.max(0, buyingClub.finances.transferBudget - transferFee),
            currentWeeklyWages: calcClubWages(buyingClub.id),
            monthlyTransactions: [buyTx, ...buyingClub.finances.monthlyTransactions].slice(0, 40),
          },
        };

        // Update selling club finances & strip player from their tactics if applicable
        if (oldClub) {
          const sellTx = {
            id: createId('tx'),
            date: prev.currentDate,
            category: 'Transfer' as const,
            description: `Sold ${curPlayer.name} to ${buyingClub.shortName}`,
            amount: transferFee,
          };
          const cleanedSlots = oldClub.tactics.startingXI.map((slot) =>
            slot.playerId === curPlayer.id ? { ...slot, playerId: null } : slot
          );
          const cleanedBench = oldClub.tactics.bench.filter((id) => id !== curPlayer.id);
          const oldClubRemainingSquad = Object.values(updatedPlayers).filter(
            (p) => p.clubId === oldClub.id
          );
          const patchedTactics = autoPickLineup(
            { ...oldClub.tactics, startingXI: cleanedSlots, bench: cleanedBench },
            oldClubRemainingSquad
          );

          nextClubs[oldClub.id] = {
            ...oldClub,
            tactics: patchedTactics,
            finances: {
              ...oldClub.finances,
              balance: oldClub.finances.balance + transferFee,
              transferBudget: oldClub.finances.transferBudget + Math.round(transferFee * 0.65),
              currentWeeklyWages: calcClubWages(oldClub.id),
              monthlyTransactions: [sellTx, ...oldClub.finances.monthlyTransactions].slice(0, 40),
            },
          };
        }

        const completedContract: ContractOffer = {
          ...offer,
          status: 'accepted',
          responseMessage: evaluation.message,
        };

        const newsHeadline = isRenewal
          ? `${curPlayer.name} signs new ${draft.years}-year deal at ${buyingClub.shortName}`
          : `${buyingClub.name} complete signing of ${curPlayer.name}${
              transferFee > 0 ? ` for ${formatCurrency(transferFee)}` : ' on a free transfer'
            }`;

        const signingNews: NewsItem = {
          id: createId('news'),
          date: prev.currentDate,
          headline: newsHeadline,
          body: `${curPlayer.name} has agreed personal terms worth ${formatCurrency(
            draft.weeklyWage
          )}/wk until ${newExpiry} (${draft.squadStatus}).`,
          category: 'transfer',
          read: false,
          relatedClubId: buyingClub.id,
          relatedPlayerId: curPlayer.id,
          importance: 'high',
        };

        return {
          ...prev,
          clubs: nextClubs,
          players: updatedPlayers,
          contractOffers: [completedContract, ...prev.contractOffers],
          transferOffers: acceptedTransfer
            ? prev.transferOffers.map((o) =>
                o.id === acceptedTransfer.id ? { ...o, status: 'completed' } : o
              )
            : prev.transferOffers,
          news: [signingNews, ...prev.news],
        };
      });

      showToast(
        player.clubId === club.id
          ? `${player.name} signed a new contract!`
          : `${player.name} has joined ${club.shortName}!`
      );
    },
    [showToast, state.clubs, state.players]
  );

  // News
  const markNewsRead = useCallback((newsId: string) => {
    setState((prev) => ({
      ...prev,
      news: prev.news.map((item) => (item.id === newsId ? { ...item, read: true } : item)),
    }));
  }, []);

  const markAllNewsRead = useCallback(() => {
    setState((prev) => ({
      ...prev,
      news: prev.news.map((item) => (item.read ? item : { ...item, read: true })),
    }));
  }, []);

  // Live Match
  const updateActiveMatch = useCallback((nextSession: MatchSessionState) => {
    setState((prev) => ({ ...prev, activeMatch: nextSession }));
  }, []);

  const finishActiveMatch = useCallback(
    (completedSession: MatchSessionState) => {
      const committed = commitMatchResult(state, completedSession);
      const cleaned: GameState = { ...committed, activeMatch: null };
      setState(cleaned);
      setActiveScreen('news');
      showToast(
        `Full Time: ${state.clubs[completedSession.homeClubId]?.shortName ?? 'Home'} ${
          completedSession.homeGoals
        } - ${completedSession.awayGoals} ${
          state.clubs[completedSession.awayClubId]?.shortName ?? 'Away'
        }`
      );
      void persistState(cleaned, true);
    },
    [persistState, showToast, state]
  );

  const updateAudioSettings = useCallback((patch: Partial<AudioSettings>) => {
    setState((prev) => {
      const next = { ...prev.audioSettings, ...patch };
      writeAudioSettings(next);
      return { ...prev, audioSettings: next };
    });
  }, []);

  const value: GameStoreValue = {
    state,
    activeScreen,
    selectedClubId,
    selectedPlayerId,
    selectedLeagueId,
    isNewGameOpen,
    savedMeta,
    isLoadingSave,
    lastSavedAt,
    toastMessage,
    mediaInfo,
    backgroundContext,
    userClub,
    userLeague,
    userSquad,
    nextUserFixture,
    hasNextMatchToday,
    unreadNewsCount,
    navigate,
    selectClub,
    selectPlayer,
    selectLeague,
    goBackFromPlayer,
    setNewGameOpen: setIsNewGameOpen,
    setMediaInfo,
    startNewGame,
    saveGame,
    loadSavedGame,
    continueGame,
    playFixture,
    updateUserTactics,
    autoPickUserLineup,
    updateUserTraining,
    toggleShortlist,
    toggleTransferList,
    submitTransferOffer,
    acceptCounterOffer,
    withdrawTransferOffer,
    submitContractOffer,
    markNewsRead,
    markAllNewsRead,
    updateActiveMatch,
    finishActiveMatch,
    updateAudioSettings,
  };

  return <GameStoreContext.Provider value={value}>{children}</GameStoreContext.Provider>;
};

export function useGameStore(): GameStoreValue {
  const ctx = useContext(GameStoreContext);
  if (!ctx) {
    throw new Error('useGameStore must be used within a GameStoreProvider');
  }
  return ctx;
}
