import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  ArrowRightLeft,
  ChevronDown,
  ChevronUp,
  CloudRain,
  CloudSun,
  Eye,
  EyeOff,
  FastForward,
  Flag,
  Mic,
  Pause,
  Play,
  Radio,
  Settings2,
  Shield,
  Sliders,
  Snowflake,
  Sun,
  Volume2,
  VolumeX,
  Waves,
  Wind,
  X,
  Zap,
} from 'lucide-react';
import { calculatePositionRating } from '../engine/attributes';
import {
  applyLiveSubstitution,
  applyLiveTacticsChange,
  stepMatchTick,
} from '../engine/matchEngine';
import { FORMATIONS, createDefaultWibWobGrid } from '../engine/tactics';
import { commentaryAudioEngine } from '../services/commentaryAudio';
import { stadiumAmbience } from '../services/stadiumAmbience';
import type { MatchDayViewProps, SpeechSyncState } from '../types/contracts';
import type {
  AudioSettings,
  Club,
  CommentaryFlashMode,
  CommentaryFrequency,
  CommentarySegment,
  FormationId,
  LivePlayerMatchStat,
  MatchEvent,
  MatchEventType,
  MatchSessionState,
  Player,
  TacticalSlot,
  TacticsState,
  TeamInstructions,
  TtsProvider,
} from '../types/game';

const FORMATION_ORDER: FormationId[] = [
  '4-4-2',
  '4-1-3-2',
  '4-3-3',
  '3-5-2',
  '4-2-3-1',
  '4-4-2-diamond',
];

const KEY_EVENT_TYPES = new Set<MatchEventType>([
  'kickoff',
  'goal',
  'penalty_awarded',
  'penalty_scored',
  'penalty_missed',
  'woodwork',
  'shot_saved',
  'red_card',
  'injury',
  'halftime',
  'fulltime',
]);

const EXTENDED_EVENT_TYPES = new Set<MatchEventType>([
  ...KEY_EVENT_TYPES,
  'chance',
  'shot_missed',
  'yellow_card',
  'free_kick',
  'corner',
  'substitution',
  'tactical_change',
]);

function shouldBroadcastEvent(event: MatchEvent, freq: CommentaryFrequency): boolean {
  if (freq === 'full') return true;
  if (freq === 'key') {
    return event.isKeyHighlight || KEY_EVENT_TYPES.has(event.type);
  }
  return (
    event.isKeyHighlight ||
    EXTENDED_EVENT_TYPES.has(event.type) ||
    event.excitementLevel >= 5
  );
}

function getTickIntervalMs(speed: number): number {
  const clamped = Math.max(1, Math.min(20, speed));
  return Math.max(70, Math.min(1250, Math.round(1250 / Math.pow(clamped, 0.92))));
}

function formatMatchClock(session: MatchSessionState): string {
  if (session.phase === 'pre_match') return 'PRE-MATCH';
  if (session.phase === 'half_time') return 'HT';
  if (session.phase === 'full_time') return 'FT';
  if (session.phase === 'first_half') {
    if (session.minute > 45) {
      const over = session.minute - 45;
      const cap = session.addedTime > 0 ? Math.min(over, session.addedTime) : over;
      return `45'+${cap}`;
    }
    if (session.minute === 45 && session.second >= 60) {
      return `45'+${Math.floor(session.second / 60)}`;
    }
  }
  if (session.phase === 'second_half') {
    if (session.minute > 90) {
      const over = session.minute - 90;
      const cap = session.addedTime > 0 ? Math.min(over, session.addedTime) : over;
      return `90'+${cap}`;
    }
    if (session.minute === 90 && session.second >= 60) {
      return `90'+${Math.floor(session.second / 60)}`;
    }
  }
  return `${session.minute}'`;
}

function formatEventTimestamp(
  ev: MatchEvent,
  evIndex: number,
  halftimeIndex: number,
  phase: MatchSessionState['phase']
): string {
  if (ev.type === 'halftime') return 'HT';
  if (ev.type === 'fulltime') return 'FT';

  const maybeAdded = (ev as MatchEvent & { addedMinute?: number }).addedMinute;
  if (typeof maybeAdded === 'number' && maybeAdded > 0) {
    return `${ev.minute}'+${maybeAdded}`;
  }

  const isSecondHalfKickoff = ev.id === 'ev-kickoff-2';
  const isFirstHalf =
    !isSecondHalfKickoff &&
    (halftimeIndex !== -1
      ? evIndex >= 0 && evIndex < halftimeIndex
      : phase === 'pre_match' || phase === 'first_half' || phase === 'half_time');

  if (isFirstHalf) {
    if (ev.minute > 45) {
      return `45'+${ev.minute - 45}`;
    }
    if (ev.minute === 45 && ev.second >= 60) {
      return `45'+${Math.floor(ev.second / 60)}`;
    }
  } else {
    if (ev.minute > 90) {
      return `90'+${ev.minute - 90}`;
    }
    if (ev.minute === 90 && ev.second >= 60) {
      return `90'+${Math.floor(ev.second / 60)}`;
    }
  }

  return `${ev.minute}'`;
}

function getRatingColor(rating: number): string {
  if (rating >= 8.5) return '#38f2af';
  if (rating >= 7.5) return '#fde047';
  if (rating >= 6.5) return '#e6eef9';
  if (rating >= 5.5) return '#fbbf24';
  return '#f87171';
}

function getConditionColor(cond: number): string {
  if (cond >= 82) return '#4ade80';
  if (cond >= 68) return '#a3e635';
  if (cond >= 52) return '#fbbf24';
  return '#f87171';
}

function getFlashClass(mode: CommentaryFlashMode | undefined): string {
  switch (mode) {
    case 'flash-goal':
      return 'cm-flash-goal';
    case 'flash-chance':
      return 'cm-flash-chance';
    case 'flash-card':
      return 'cm-flash-card';
    case 'pulse':
      return 'cm-flash-pulse';
    default:
      return '';
  }
}

function getWeatherIcon(weather: MatchSessionState['weather']): React.ReactNode {
  switch (weather) {
    case 'Clear':
      return <Sun size={12} color="#fde047" />;
    case 'Overcast':
      return <CloudSun size={12} color="#cbd5e1" />;
    case 'Light Rain':
    case 'Heavy Rain':
      return <CloudRain size={12} color="#60a5fa" />;
    case 'Breezy':
      return <Wind size={12} color="#93c5fd" />;
    case 'Snow':
      return <Snowflake size={12} color="#e0f2fe" />;
  }
}

function getEventBadge(type: MatchEventType): { label: string; color: string } {
  switch (type) {
    case 'goal':
    case 'penalty_scored':
      return { label: 'GOAL', color: '#4ade80' };
    case 'penalty_awarded':
      return { label: 'PEN', color: '#fde047' };
    case 'penalty_missed':
      return { label: 'MISS', color: '#fb923c' };
    case 'woodwork':
      return { label: 'POST', color: '#fde047' };
    case 'shot_saved':
      return { label: 'SAVE', color: '#38e8d5' };
    case 'chance':
    case 'shot_missed':
      return { label: 'SHOT', color: '#93c5fd' };
    case 'yellow_card':
      return { label: 'YC', color: '#facc15' };
    case 'red_card':
      return { label: 'RC', color: '#ef4444' };
    case 'substitution':
      return { label: 'SUB', color: '#38e8d5' };
    case 'tactical_change':
      return { label: 'TAC', color: '#c084fc' };
    case 'injury':
      return { label: 'INJ', color: '#f87171' };
    case 'corner':
      return { label: 'COR', color: '#94a3b8' };
    case 'free_kick':
      return { label: 'FK', color: '#94a3b8' };
    case 'kickoff':
      return { label: 'KO', color: '#fde047' };
    case 'halftime':
      return { label: 'HT', color: '#fde047' };
    case 'fulltime':
      return { label: 'FT', color: '#fde047' };
    default:
      return { label: 'PLAY', color: '#64748b' };
  }
}

/**
 * Safely switches formation mid-match while keeping the exact 11 on-pitch players
 * and current bench intact (never illegally swapping subbed/sent-off players).
 */
function reshapeLiveFormation(
  current: TacticsState,
  newFormation: FormationId,
  players: Record<string, Player>
): TacticsState {
  const tpl = FORMATIONS[newFormation];
  if (!tpl) return current;

  const gkId = current.startingXI[0]?.playerId ?? null;
  const outfieldIds = current.startingXI
    .slice(1)
    .map((s) => s.playerId)
    .filter((id): id is string => Boolean(id));

  const remaining = [...outfieldIds];
  const nextSlots: TacticalSlot[] = tpl.slots.map((slotTpl, idx) => {
    if (idx === 0) {
      return {
        slotIndex: 0,
        playerId: gkId,
        roleLabel: slotTpl.roleLabel,
        baseX: slotTpl.baseX,
        baseY: slotTpl.baseY,
        runArrow: 'none',
      };
    }

    // Greedily pick best-fitting active outfield player for this new slot
    let bestIdx = 0;
    let bestScore = -1;
    for (let i = 0; i < remaining.length; i++) {
      const p = players[remaining[i]];
      const score = p ? calculatePositionRating(p, slotTpl.roleLabel) : 0;
      if (score > bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    }
    const chosenId = remaining.length > 0 ? remaining.splice(bestIdx, 1)[0] : null;
    return {
      slotIndex: idx,
      playerId: chosenId,
      roleLabel: slotTpl.roleLabel,
      baseX: slotTpl.baseX,
      baseY: slotTpl.baseY,
      runArrow: slotTpl.defaultArrow,
    };
  });

  return {
    ...current,
    formation: newFormation,
    startingXI: nextSlots,
    wibWobGrid: createDefaultWibWobGrid(nextSlots),
  };
}

interface BallTrailPoint {
  x: number;
  y: number;
}

export const MatchDayView: React.FC<MatchDayViewProps> = ({
  session,
  homeClub,
  awayClub,
  players,
  league,
  audioSettings,
  onUpdateSession,
  onUpdateAudioSettings,
  onFinishMatch,
  onSelectPlayer,
}) => {
  const [centerTab, setCenterTab] = useState<'commentary' | 'stats'>('commentary');
  const [showAllFeed, setShowAllFeed] = useState<boolean>(false);
  const [audioPopoverOpen, setAudioPopoverOpen] = useState<boolean>(false);
  const [showApiKey, setShowApiKey] = useState<boolean>(false);
  const [isTestingVoices, setIsTestingVoices] = useState<boolean>(false);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [tacticsDrawerOpen, setTacticsDrawerOpen] = useState<boolean>(false);
  const [subOutId, setSubOutId] = useState<string>('');
  const [subInId, setSubInId] = useState<string>('');
  const [ballTrail, setBallTrail] = useState<BallTrailPoint[]>([]);
  const [silentSegmentIdx, setSilentSegmentIdx] = useState<number>(0);

  const [speechState, setSpeechState] = useState<SpeechSyncState>({
    speaking: false,
    ducked: false,
    segment: null,
    activeWordIndex: -1,
    charIndex: 0,
    words: [],
  });

  const sessionRef = useRef<MatchSessionState>(session);
  sessionRef.current = session;

  const audioSettingsRef = useRef<AudioSettings>(audioSettings);
  audioSettingsRef.current = audioSettings;

  const ambienceStartedRef = useRef<boolean>(false);
  const dramaticPauseUntilRef = useRef<number>(0);

  const clubsMap = useMemo<Record<string, Club>>(
    () => ({
      [homeClub.id]: homeClub,
      [awayClub.id]: awayClub,
    }),
    [homeClub, awayClub]
  );

  const activeFrequency: CommentaryFrequency =
    audioSettings.commentaryFrequency ?? session.commentaryFrequency ?? 'extended';

  // Configure audio services whenever settings or match speed change
  useEffect(() => {
    commentaryAudioEngine.configure(audioSettings);
    stadiumAmbience.configure(audioSettings);
  }, [audioSettings]);

  useEffect(() => {
    commentaryAudioEngine.setMatchSpeed?.(session.speed);
  }, [session.speed]);

  // Subscribe to word-for-word commentary speech state + load available browser voices
  useEffect(() => {
    const refreshVoices = () => {
      const fromEngine = commentaryAudioEngine.getAvailableVoices?.();
      if (fromEngine && fromEngine.length > 0) {
        setAvailableVoices(fromEngine);
      } else if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        setAvailableVoices(window.speechSynthesis.getVoices());
      }
    };

    refreshVoices();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.addEventListener?.('voiceschanged', refreshVoices);
    }

    const unsub = commentaryAudioEngine.subscribeSpeechState?.((next: SpeechSyncState) => {
      setSpeechState(next);
    });

    return () => {
      unsub?.();
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.removeEventListener?.('voiceschanged', refreshVoices);
      }
    };
  }, []);

  // Stop audio cleanly on unmount
  useEffect(() => {
    return () => {
      commentaryAudioEngine.stop();
      stadiumAmbience.stop();
      ambienceStartedRef.current = false;
    };
  }, []);

  // Track ball trail smoothly as ball coordinates change
  useEffect(() => {
    setBallTrail((prev) => {
      const last = prev[prev.length - 1];
      if (last && Math.hypot(last.x - session.ballX, last.y - session.ballY) < 0.8) {
        return prev;
      }
      return [...prev.slice(-6), { x: session.ballX, y: session.ballY }];
    });
  }, [session.ballX, session.ballY]);

  // Step through multi-segment event display when voice is disabled so Analyst text also appears
  useEffect(() => {
    setSilentSegmentIdx(0);
    const activeEv = session.activeEvent;
    if (!activeEv || activeEv.segments.length <= 1 || audioSettings.voiceEnabled) return;
    const timer = window.setTimeout(() => {
      setSilentSegmentIdx(1);
    }, 1800);
    return () => window.clearTimeout(timer);
  }, [session.activeEvent?.id, audioSettings.voiceEnabled]);

  const ensureAmbienceRunning = useCallback((attendance: number) => {
    if (!ambienceStartedRef.current) {
      stadiumAmbience.configure(audioSettingsRef.current);
      stadiumAmbience.start(attendance);
      ambienceStartedRef.current = true;
    }
  }, []);

  const dispatchEventAudio = useCallback((event: MatchEvent | null, freq: CommentaryFrequency) => {
    if (!event) return;
    stadiumAmbience.setExcitement(event.excitementLevel);
    stadiumAmbience.reactToEvent(event);

    if (
      (event.type === 'goal' || event.type === 'penalty_scored' || event.type === 'red_card') &&
      sessionRef.current.speed <= 10
    ) {
      dramaticPauseUntilRef.current = Date.now() + 1700;
    }

    if (audioSettingsRef.current.voiceEnabled && shouldBroadcastEvent(event, freq)) {
      for (const seg of event.segments) {
        commentaryAudioEngine.enqueueSegment(seg, { speed: sessionRef.current.speed });
      }
    }
  }, []);

  // Primary match actions: Kick Off, Play/Pause, Second Half, Finish Match
  const handlePrimaryFlowAction = useCallback(() => {
    const cur = sessionRef.current;
    if (cur.phase === 'pre_match') {
      ensureAmbienceRunning(cur.attendance);
      commentaryAudioEngine.configure(audioSettingsRef.current);
      const { nextSession, newEvent } = stepMatchTick(
        { ...cur, paused: false },
        players,
        clubsMap
      );
      const started: MatchSessionState = {
        ...nextSession,
        phase: nextSession.phase === 'pre_match' ? 'first_half' : nextSession.phase,
        paused: false,
      };
      onUpdateSession(started);
      dispatchEventAudio(newEvent, activeFrequency);
      return;
    }

    if (cur.phase === 'half_time') {
      ensureAmbienceRunning(cur.attendance);
      const { nextSession, newEvent } = stepMatchTick(
        { ...cur, paused: false },
        players,
        clubsMap
      );
      const resumed: MatchSessionState = {
        ...nextSession,
        phase: nextSession.phase === 'half_time' ? 'second_half' : nextSession.phase,
        paused: false,
      };
      onUpdateSession(resumed);
      dispatchEventAudio(newEvent, activeFrequency);
      return;
    }

    if (cur.phase === 'full_time') {
      commentaryAudioEngine.stop();
      stadiumAmbience.stop();
      ambienceStartedRef.current = false;
      onFinishMatch(cur);
      return;
    }

    // Toggle Play / Pause during active halves
    if (cur.paused) {
      ensureAmbienceRunning(cur.attendance);
    }
    onUpdateSession({ ...cur, paused: !cur.paused });
  }, [
    activeFrequency,
    clubsMap,
    dispatchEventAudio,
    ensureAmbienceRunning,
    onFinishMatch,
    onUpdateSession,
    players,
  ]);

  // Spacebar shortcut inside MatchDayView (disabled behind open dialogs or while focused on controls)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space' && e.key !== ' ') return;
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      if (document.querySelector('[role="dialog"]')) return;
      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (
          tag === 'INPUT' ||
          tag === 'TEXTAREA' ||
          tag === 'SELECT' ||
          tag === 'BUTTON' ||
          target.isContentEditable
        ) {
          return;
        }
      }
      e.preventDefault();
      handlePrimaryFlowAction();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handlePrimaryFlowAction]);

  // Core Match Simulation Loop
  useEffect(() => {
    if (
      session.paused ||
      session.phase === 'pre_match' ||
      session.phase === 'half_time' ||
      session.phase === 'full_time'
    ) {
      return;
    }

    ensureAmbienceRunning(session.attendance);

    const intervalMs = getTickIntervalMs(session.speed);
    const timerId = window.setInterval(() => {
      const cur = sessionRef.current;
      if (
        cur.paused ||
        cur.phase === 'pre_match' ||
        cur.phase === 'half_time' ||
        cur.phase === 'full_time'
      ) {
        return;
      }

      if (Date.now() < dramaticPauseUntilRef.current) {
        return;
      }

      const { nextSession, newEvent } = stepMatchTick(cur, players, clubsMap);
      onUpdateSession(nextSession);

      const freq =
        audioSettingsRef.current.commentaryFrequency ??
        nextSession.commentaryFrequency ??
        'extended';
      dispatchEventAudio(newEvent, freq);

      if (nextSession.phase === 'full_time') {
        stadiumAmbience.setExcitement(6);
      }
    }, intervalMs);

    return () => window.clearInterval(timerId);
  }, [
    session.paused,
    session.phase,
    session.speed,
    session.attendance,
    clubsMap,
    players,
    onUpdateSession,
    dispatchEventAudio,
    ensureAmbienceRunning,
  ]);

  const handleSpeedChange = useCallback(
    (nextSpeed: number) => {
      onUpdateSession({ ...sessionRef.current, speed: Math.max(1, Math.min(20, nextSpeed)) });
    },
    [onUpdateSession]
  );

  const handleFrequencyChange = useCallback(
    (freq: CommentaryFrequency) => {
      onUpdateSession({ ...sessionRef.current, commentaryFrequency: freq });
      onUpdateAudioSettings({ commentaryFrequency: freq });
    },
    [onUpdateSession, onUpdateAudioSettings]
  );

  const handleTestVoices = useCallback(async () => {
    setIsTestingVoices(true);
    try {
      await commentaryAudioEngine.testVoice(audioSettings);
    } finally {
      setIsTestingVoices(false);
    }
  }, [audioSettings]);

  // Live substitution handler for the user's side
  const managedSide: 'home' | 'away' | null =
    session.userSide === 'home' || session.userSide === 'away' ? session.userSide : null;

  const handleMakeSubstitution = useCallback(() => {
    if (!managedSide || !subOutId || !subInId) return;
    const cur = sessionRef.current;
    const next = applyLiveSubstitution(cur, managedSide, subOutId, subInId, players);
    onUpdateSession(next);
    setSubOutId('');
    setSubInId('');
    if (next.events.length > cur.events.length) {
      dispatchEventAudio(next.events[next.events.length - 1], activeFrequency);
    }
  }, [managedSide, subOutId, subInId, players, onUpdateSession, dispatchEventAudio, activeFrequency]);

  const handleLiveInstructionPatch = useCallback(
    (patch: Partial<TeamInstructions>) => {
      if (!managedSide) return;
      const cur = sessionRef.current;
      const curTactics = managedSide === 'home' ? cur.homeTactics : cur.awayTactics;
      const updatedTactics: TacticsState = {
        ...curTactics,
        instructions: {
          ...curTactics.instructions,
          ...patch,
        },
      };
      const next = applyLiveTacticsChange(cur, managedSide, updatedTactics);
      onUpdateSession(next);
      if (next.events.length > cur.events.length) {
        dispatchEventAudio(next.events[next.events.length - 1], activeFrequency);
      }
    },
    [managedSide, onUpdateSession, dispatchEventAudio, activeFrequency]
  );

  const handleLiveFormationChange = useCallback(
    (formation: FormationId) => {
      if (!managedSide) return;
      const cur = sessionRef.current;
      const curTactics = managedSide === 'home' ? cur.homeTactics : cur.awayTactics;
      if (curTactics.formation === formation) return;
      const reshaped = reshapeLiveFormation(curTactics, formation, players);
      const next = applyLiveTacticsChange(cur, managedSide, reshaped);
      onUpdateSession(next);
      if (next.events.length > cur.events.length) {
        dispatchEventAudio(next.events[next.events.length - 1], activeFrequency);
      }
    },
    [managedSide, players, onUpdateSession, dispatchEventAudio, activeFrequency]
  );

  // Compute home/away goal tickers
  const homeGoalsList = useMemo(
    () => session.goals.filter((g) => g.clubId === homeClub.id),
    [session.goals, homeClub.id]
  );
  const awayGoalsList = useMemo(
    () => session.goals.filter((g) => g.clubId === awayClub.id),
    [session.goals, awayClub.id]
  );

  // Chronological lookup for consistent first-half / second-half stoppage time labels
  const halftimeIndex = useMemo(
    () => session.events.findIndex((e) => e.type === 'halftime'),
    [session.events]
  );

  const eventIndexById = useMemo(() => {
    const map = new Map<string, number>();
    session.events.forEach((ev, idx) => map.set(ev.id, idx));
    return map;
  }, [session.events]);

  const getGoalMinuteLabel = useCallback(
    (goal: MatchSessionState['goals'][number]): string => {
      const matchEvIdx = session.events.findIndex(
        (ev) =>
          (ev.type === 'goal' || ev.type === 'penalty_scored') &&
          ev.primaryPlayerId === goal.scorerId &&
          ev.minute === goal.minute
      );
      if (matchEvIdx !== -1) {
        return formatEventTimestamp(
          session.events[matchEvIdx],
          matchEvIdx,
          halftimeIndex,
          session.phase
        );
      }
      if (goal.minute > 90) return `90'+${goal.minute - 90}`;
      return `${goal.minute}'`;
    },
    [session.events, halftimeIndex, session.phase]
  );

  // Filtered or full commentary log (newest first)
  const displayedEvents = useMemo(() => {
    const rev = [...session.events].reverse();
    if (showAllFeed) return rev.slice(0, 120);
    return rev.filter((ev) => shouldBroadcastEvent(ev, activeFrequency)).slice(0, 100);
  }, [session.events, showAllFeed, activeFrequency]);

  // Compute Match Momentum (-50 = full away, 0 = even, +50 = full home)
  const homeMomentumPct = useMemo(() => {
    const recent = session.events.slice(-12);
    let score = 0;
    for (const ev of recent) {
      const dir = ev.teamSide === 'home' ? 1 : ev.teamSide === 'away' ? -1 : 0;
      score += dir * (ev.excitementLevel || 2);
    }
    const possDiff = (session.homeStats.possession - 50) * 0.45;
    const raw = 50 + Math.max(-42, Math.min(42, score * 1.15 + possDiff));
    return Math.round(raw);
  }, [session.events, session.homeStats.possession]);

  // Determine Active Bottom Commentary Bar state (synced with SpeechSyncState if speaking)
  const fallbackEvent =
    session.activeEvent ??
    (session.events.length > 0 ? session.events[session.events.length - 1] : null);
  const fallbackSegment: CommentarySegment | null = fallbackEvent
    ? fallbackEvent.segments[
        Math.min(silentSegmentIdx, Math.max(0, fallbackEvent.segments.length - 1))
      ] ?? null
    : null;

  const isLiveSpeaking = Boolean(speechState.speaking && speechState.segment);
  const bannerSegment = isLiveSpeaking ? speechState.segment : fallbackSegment;
  const bannerTeamSide = bannerSegment?.teamSide ?? fallbackEvent?.teamSide ?? 'neutral';
  const bannerFlashMode = bannerSegment?.flashMode ?? 'none';
  const bannerExcitement = bannerSegment?.excitement ?? fallbackEvent?.excitementLevel ?? 2;
  const isAudioDucked =
    speechState.ducked || (isLiveSpeaking && audioSettings.crowdEnabled);

  const barColors = useMemo(() => {
    if (bannerTeamSide === 'home') {
      return {
        primary: homeClub.colors.primary,
        secondary: homeClub.colors.secondary,
        text: homeClub.colors.text,
      };
    }
    if (bannerTeamSide === 'away') {
      return {
        primary: awayClub.colors.primary,
        secondary: awayClub.colors.secondary,
        text: awayClub.colors.text,
      };
    }
    return {
      primary: '#122442',
      secondary: '#7ca0d0',
      text: '#e6eef9',
    };
  }, [bannerTeamSide, homeClub.colors, awayClub.colors]);

  const bannerWords = useMemo(() => {
    if (isLiveSpeaking && speechState.words.length > 0) {
      return speechState.words;
    }
    const text =
      bannerSegment?.text ??
      (session.phase === 'pre_match'
        ? `Welcome to ${homeClub.stadium.name}! ${homeClub.name} take on ${awayClub.name} in ${league.name}. Press SPACE or click Kick Off to begin.`
        : 'Waiting for match action...');
    return text.split(/\s+/).filter(Boolean);
  }, [
    isLiveSpeaking,
    speechState.words,
    bannerSegment?.text,
    session.phase,
    homeClub.stadium.name,
    homeClub.name,
    awayClub.name,
    league.name,
  ]);

  // Helper to render Left or Right Team Lineup & Live Ratings Panel
  const renderLineupPanel = (side: 'home' | 'away') => {
    const club = side === 'home' ? homeClub : awayClub;
    const tactics = side === 'home' ? session.homeTactics : session.awayTactics;
    const subsUsed = side === 'home' ? session.homeSubsUsed : session.awaySubsUsed;
    const isUserPanel = managedSide === side;

    const activeStarterIds = new Set(
      tactics.startingXI.map((s) => s.playerId).filter(Boolean) as string[]
    );

    // Players subbed off from this club
    const subbedOffPlayers = Object.values(session.playerStats)
      .filter((st) => {
        if (st.subbedOffMinute === undefined) return false;
        const p = players[st.playerId];
        return p && p.clubId === club.id && !activeStarterIds.has(st.playerId);
      })
      .sort((a, b) => (a.subbedOffMinute ?? 0) - (b.subbedOffMinute ?? 0));

    // Eligible sub-out and sub-in lists for user team
    const eligibleOut: Array<{
      slot: TacticalSlot;
      player: Player;
      stat: LivePlayerMatchStat | undefined;
    }> = [];
    for (const slot of tactics.startingXI) {
      const p = slot.playerId ? players[slot.playerId] : undefined;
      const st = slot.playerId ? session.playerStats[slot.playerId] : undefined;
      if (p && !st?.redCard) {
        eligibleOut.push({ slot, player: p, stat: st });
      }
    }

    const eligibleIn: Array<{
      player: Player;
      stat: LivePlayerMatchStat | undefined;
    }> = [];
    for (const pid of tactics.bench) {
      const p = players[pid];
      const st = session.playerStats[pid];
      if (!p || activeStarterIds.has(pid)) continue;
      if (st?.subbedOffMinute !== undefined || st?.redCard || st?.injured) continue;
      eligibleIn.push({ player: p, stat: st });
    }

    const canSub =
      isUserPanel &&
      subsUsed < session.maxSubs &&
      session.phase !== 'full_time' &&
      eligibleIn.length > 0;

    return (
      <div
        className="cm-panel"
        style={{
          borderTop: `3px solid ${club.colors.primary}`,
          overflow: 'hidden',
        }}
      >
        <div
          className="cm-panel-header"
          style={{
            background: `linear-gradient(90deg, ${club.colors.primary}44 0%, rgba(16,29,50,0.96) 65%)`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
            <span
              className="cm-club-shield"
              style={{
                width: 20,
                height: 20,
                fontSize: 8.5,
                backgroundColor: club.colors.primary,
                color: club.colors.text,
                borderColor: club.colors.secondary,
              }}
            >
              {club.threeLetterCode}
            </span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {club.shortName}
            </span>
            <span
              className="cm-num"
              style={{
                fontSize: 10,
                padding: '0 4px',
                background: 'rgba(0,0,0,0.45)',
                border: '1px solid var(--cm-border)',
                color: '#cbd5e1',
              }}
            >
              {tactics.formation}
            </span>
          </div>

          <span className="cm-num" style={{ fontSize: 10.5, color: 'var(--cm-text-muted)' }}>
            Subs {subsUsed}/{session.maxSubs}
          </span>
        </div>

        {/* 11 Active Players Table */}
        <div style={{ overflowX: 'auto' }}>
          <table className="cm-table" style={{ fontSize: 11 }}>
            <thead>
              <tr>
                <th style={{ width: 32 }}>Pos</th>
                <th>Player</th>
                <th style={{ width: 42, textAlign: 'right' }}>Cond</th>
                <th style={{ width: 34, textAlign: 'right' }}>Rat</th>
              </tr>
            </thead>
            <tbody>
              {tactics.startingXI.map((slot) => {
                const p = slot.playerId ? players[slot.playerId] : undefined;
                const st = slot.playerId ? session.playerStats[slot.playerId] : undefined;
                const rating = st?.rating ?? 6.5;
                const cond = Math.round(st?.condition ?? p?.condition ?? 90);
                const sentOff = Boolean(st?.redCard);

                return (
                  <tr
                    key={`${side}-slot-${slot.slotIndex}`}
                    style={{
                      opacity: sentOff ? 0.48 : 1,
                      background: sentOff ? 'rgba(153, 27, 27, 0.22)' : undefined,
                    }}
                  >
                    <td className="cm-num" style={{ fontSize: 10, color: 'var(--cm-text-muted)', fontWeight: 700 }}>
                      {slot.roleLabel}
                    </td>
                    <td style={{ maxWidth: 138 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 3 }}>
                        {p ? (
                          <button
                            type="button"
                            className="cm-link"
                            onClick={() => onSelectPlayer(p.id)}
                            style={{
                              fontSize: 11.5,
                              color: sentOff ? '#fca5a5' : '#e6eef9',
                              textDecoration: sentOff ? 'line-through' : 'none',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              maxWidth: 96,
                            }}
                            title={p.name}
                          >
                            {p.shortName}
                          </button>
                        ) : (
                          <span style={{ color: 'var(--cm-text-dim)' }}>—</span>
                        )}

                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
                          {st && st.subbedOnMinute !== undefined && (
                            <span
                              className="cm-num"
                              title={`Subbed on at ${st.subbedOnMinute}'`}
                              style={{ fontSize: 9, color: '#4ade80', fontWeight: 700 }}
                            >
                              ↑{st.subbedOnMinute}&apos;
                            </span>
                          )}
                          {st && st.goals > 0 && (
                            <span
                              className="cm-num"
                              title={`${st.goals} goal(s)`}
                              style={{ fontSize: 10, color: '#4ade80', fontWeight: 800 }}
                            >
                              ⚽{st.goals > 1 ? st.goals : ''}
                            </span>
                          )}
                          {st && st.assists > 0 && (
                            <span
                              className="cm-num"
                              title={`${st.assists} assist(s)`}
                              style={{
                                fontSize: 9.5,
                                color: '#38e8d5',
                                fontWeight: 700,
                              }}
                            >
                              A{st.assists > 1 ? st.assists : ''}
                            </span>
                          )}
                          {st && st.yellowCards > 0 && !st.redCard && (
                            <span
                              title="Yellow Card"
                              style={{
                                display: 'inline-block',
                                width: 7,
                                height: 10,
                                background: '#facc15',
                                border: '1px solid #854d0e',
                              }}
                            />
                          )}
                          {st?.redCard && (
                            <span
                              title="Sent Off (Red Card)"
                              style={{
                                display: 'inline-block',
                                width: 7,
                                height: 10,
                                background: '#ef4444',
                                border: '1px solid #7f1d1d',
                              }}
                            />
                          )}
                          {st?.injured && (
                            <span
                              title="Injured"
                              style={{
                                fontSize: 9,
                                fontWeight: 800,
                                padding: '0 2px',
                                background: '#991b1b',
                                color: '#fecaca',
                              }}
                            >
                              +
                            </span>
                          )}
                        </span>
                      </div>
                    </td>
                    <td className="cm-num" style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
                        <span style={{ fontSize: 10, color: getConditionColor(cond), fontWeight: 700 }}>
                          {cond}%
                        </span>
                        <div style={{ width: 32, height: 3, background: 'rgba(0,0,0,0.6)' }}>
                          <div
                            style={{
                              width: `${Math.max(0, Math.min(100, cond))}%`,
                              height: '100%',
                              background: getConditionColor(cond),
                            }}
                          />
                        </div>
                      </div>
                    </td>
                    <td
                      className="cm-num"
                      style={{
                        textAlign: 'right',
                        fontWeight: 800,
                        fontSize: 11.5,
                        color: getRatingColor(rating),
                      }}
                    >
                      {rating.toFixed(1)}
                    </td>
                  </tr>
                );
              })}

              {/* Subbed-Off Players */}
              {subbedOffPlayers.map((st) => {
                const p = players[st.playerId];
                if (!p) return null;
                return (
                  <tr key={`${side}-off-${p.id}`} style={{ opacity: 0.62 }}>
                    <td className="cm-num" style={{ fontSize: 9.5, color: '#f87171' }}>
                      ↓{st.subbedOffMinute}&apos;
                    </td>
                    <td>
                      <button
                        type="button"
                        className="cm-link"
                        onClick={() => onSelectPlayer(p.id)}
                        style={{ fontSize: 11, color: 'var(--cm-text-muted)' }}
                      >
                        {p.shortName}
                      </button>
                      {st.goals > 0 && (
                        <span style={{ marginLeft: 4, fontSize: 9.5, color: '#4ade80' }}>
                          ⚽{st.goals > 1 ? st.goals : ''}
                        </span>
                      )}
                    </td>
                    <td className="cm-num" style={{ textAlign: 'right', fontSize: 10, color: 'var(--cm-text-dim)' }}>
                      OFF
                    </td>
                    <td
                      className="cm-num"
                      style={{ textAlign: 'right', fontWeight: 700, color: getRatingColor(st.rating) }}
                    >
                      {st.rating.toFixed(1)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* USER TEAM LIVE SUBSTITUTIONS & QUICK TACTICAL TWEAKS DRAWER */}
        {isUserPanel && (
          <div
            style={{
              borderTop: '1px solid var(--cm-border-bright)',
              background: 'rgba(8, 15, 29, 0.92)',
              padding: 8,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            {/* Quick Live Substitution */}
            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 5,
                }}
              >
                <span
                  style={{
                    fontSize: 10.5,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    color: 'var(--cm-cyan)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <ArrowRightLeft size={12} />
                  Live Substitution ({session.maxSubs - subsUsed} left)
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <select
                  className="cm-select"
                  value={subOutId}
                  onChange={(e) => setSubOutId(e.target.value)}
                  disabled={!canSub}
                  style={{ fontSize: 11, padding: '4px 6px' }}
                >
                  <option value="">Player OFF (Pitch)...</option>
                  {eligibleOut.map(({ slot, player, stat }) => (
                    <option key={player.id} value={player.id}>
                      [{slot.roleLabel}] {player.shortName} · {Math.round(stat?.condition ?? player.condition)}% ·{' '}
                      {(stat?.rating ?? 6.5).toFixed(1)}
                    </option>
                  ))}
                </select>

                <select
                  className="cm-select"
                  value={subInId}
                  onChange={(e) => setSubInId(e.target.value)}
                  disabled={!canSub}
                  style={{ fontSize: 11, padding: '4px 6px' }}
                >
                  <option value="">Player ON (Bench)...</option>
                  {eligibleIn.map(({ player, stat }) => (
                    <option key={player.id} value={player.id}>
                      [{player.positions[0]}] {player.shortName} ·{' '}
                      {Math.round(stat?.condition ?? player.condition)}%
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  className="cm-btn cm-btn-sm cm-btn-primary"
                  disabled={!canSub || !subOutId || !subInId}
                  onClick={handleMakeSubstitution}
                  style={{ width: '100%' }}
                >
                  <ArrowRightLeft size={12} />
                  Confirm Substitution
                </button>
              </div>
            </div>

            {/* Collapsible Live Tactical Tweaks Drawer */}
            <div style={{ borderTop: '1px solid var(--cm-border-subtle)', paddingTop: 6 }}>
              <button
                type="button"
                className="cm-btn cm-btn-sm"
                onClick={() => setTacticsDrawerOpen((o) => !o)}
                style={{
                  width: '100%',
                  justifyContent: 'space-between',
                  borderColor: tacticsDrawerOpen ? 'var(--cm-gold)' : undefined,
                  color: tacticsDrawerOpen ? 'var(--cm-gold)' : undefined,
                }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <Sliders size={12} />
                  Live Tactical Tweaks
                </span>
                {tacticsDrawerOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              </button>

              {tacticsDrawerOpen && (
                <div
                  style={{
                    marginTop: 7,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 7,
                    padding: 7,
                    background: 'rgba(6, 12, 24, 0.78)',
                    border: '1px solid var(--cm-border)',
                  }}
                >
                  {/* Formation */}
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--cm-gold)', fontWeight: 700, marginBottom: 3 }}>
                      FORMATION
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 3 }}>
                      {FORMATION_ORDER.map((fid) => (
                        <button
                          key={fid}
                          type="button"
                          className={`cm-btn cm-btn-sm ${tactics.formation === fid ? 'cm-btn-gold' : ''}`}
                          onClick={() => handleLiveFormationChange(fid)}
                          disabled={session.phase === 'full_time'}
                          title={FORMATIONS[fid]?.label ?? fid}
                          style={{ fontSize: 10, padding: '2px 4px', fontFamily: 'var(--cm-font-mono)' }}
                        >
                          {fid === '4-4-2-diamond' ? '4-4-2 ◆' : fid}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Mentality */}
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--cm-gold)', fontWeight: 700, marginBottom: 3 }}>
                      MENTALITY
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3 }}>
                      {(['Defending', 'Normal', 'Attacking', 'Gung Ho'] as const).map((m) => (
                        <button
                          key={m}
                          type="button"
                          className={`cm-btn cm-btn-sm ${tactics.instructions.mentality === m ? 'cm-btn-gold' : ''}`}
                          onClick={() => handleLiveInstructionPatch({ mentality: m })}
                          disabled={session.phase === 'full_time'}
                          style={{ fontSize: 10.5, padding: '3px 5px' }}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Passing */}
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--cm-gold)', fontWeight: 700, marginBottom: 3 }}>
                      PASSING
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3 }}>
                      {(['Short', 'Mixed', 'Direct', 'Long Ball'] as const).map((p) => (
                        <button
                          key={p}
                          type="button"
                          className={`cm-btn cm-btn-sm ${tactics.instructions.passing === p ? 'cm-btn-primary' : ''}`}
                          onClick={() => handleLiveInstructionPatch({ passing: p })}
                          disabled={session.phase === 'full_time'}
                          style={{ fontSize: 10.5, padding: '3px 5px' }}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Tackling */}
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--cm-gold)', fontWeight: 700, marginBottom: 3 }}>
                      TACKLING
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 3 }}>
                      {(['Easy', 'Normal', 'Hard'] as const).map((t) => (
                        <button
                          key={t}
                          type="button"
                          className={`cm-btn cm-btn-sm ${
                            tactics.instructions.tackling === t
                              ? t === 'Hard'
                                ? 'cm-btn-danger'
                                : 'cm-btn-primary'
                              : ''
                          }`}
                          onClick={() => handleLiveInstructionPatch({ tackling: t })}
                          disabled={session.phase === 'full_time'}
                          style={{ fontSize: 10.5, padding: '3px 4px' }}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Checkboxes */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                    {(
                      [
                        { key: 'pressing', label: 'Pressing' },
                        { key: 'offsideTrap', label: 'Offside Trap' },
                        { key: 'counterAttack', label: 'Counter-Atk' },
                        { key: 'menBehindBall', label: 'Men Behind' },
                      ] as const
                    ).map((item) => {
                      const on = tactics.instructions[item.key];
                      return (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() => handleLiveInstructionPatch({ [item.key]: !on })}
                          disabled={session.phase === 'full_time'}
                          style={{
                            padding: '4px 6px',
                            fontSize: 10.5,
                            fontWeight: 700,
                            cursor: 'pointer',
                            background: on ? 'rgba(56, 232, 213, 0.2)' : 'rgba(12, 22, 42, 0.72)',
                            border: `1px solid ${on ? 'var(--cm-cyan)' : 'var(--cm-border)'}`,
                            color: on ? 'var(--cm-cyan)' : 'var(--cm-text-muted)',
                            textAlign: 'left',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                          }}
                        >
                          <span>{item.label}</span>
                          <span className="cm-num" style={{ fontSize: 9.5 }}>
                            {on ? 'ON' : 'OFF'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  // Helper for mirrored stats comparison rows
  const renderStatRow = (
    label: string,
    homeVal: number,
    awayVal: number,
    formatter: (n: number) => string = (n) => String(n)
  ) => {
    const total = Math.max(0.001, homeVal + awayVal);
    const homePct = Math.round((homeVal / total) * 100);
    const awayPct = 100 - homePct;
    return (
      <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 11.5,
          }}
        >
          <span className="cm-num" style={{ fontWeight: 700, color: '#ffffff', minWidth: 42 }}>
            {formatter(homeVal)}
          </span>
          <span style={{ fontSize: 10.5, color: 'var(--cm-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            {label}
          </span>
          <span className="cm-num" style={{ fontWeight: 700, color: '#ffffff', minWidth: 42, textAlign: 'right' }}>
            {formatter(awayVal)}
          </span>
        </div>
        <div
          style={{
            display: 'flex',
            height: 6,
            background: 'rgba(0,0,0,0.55)',
            border: '1px solid rgba(168,204,248,0.2)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${homeVal === 0 && awayVal === 0 ? 50 : homePct}%`,
              background: homeClub.colors.primary,
              borderRight: '1px solid rgba(255,255,255,0.45)',
              transition: 'width 0.3s ease',
            }}
          />
          <div
            style={{
              width: `${homeVal === 0 && awayVal === 0 ? 50 : awayPct}%`,
              background: awayClub.colors.primary,
              transition: 'width 0.3s ease',
            }}
          />
        </div>
      </div>
    );
  };

  const homePassPct =
    session.homeStats.passesAttempted > 0
      ? Math.round((session.homeStats.passesCompleted / session.homeStats.passesAttempted) * 100)
      : 0;
  const awayPassPct =
    session.awayStats.passesAttempted > 0
      ? Math.round((session.awayStats.passesCompleted / session.awayStats.passesAttempted) * 100)
      : 0;

  const isRunning =
    !session.paused &&
    (session.phase === 'first_half' || session.phase === 'second_half');

  const finalThirdExcitement =
    (session.ballX >= 75 || session.ballX <= 25) && bannerExcitement >= 6;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        height: 'calc(100vh - 78px)',
        minHeight: 520,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <style>{`
        .cm-match-scoreboard {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
          align-items: stretch;
          background: rgba(7, 13, 25, 0.85);
        }
        .cm-match-deck {
          display: grid;
          grid-template-columns: minmax(225px, 0.9fr) minmax(380px, 1.55fr) minmax(225px, 0.9fr);
          gap: 8px;
          align-items: start;
        }
        @media (max-width: 1099px) {
          .cm-match-deck {
            grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
          }
          .cm-match-deck-center {
            grid-column: 1 / -1;
            order: -1;
          }
        }
        @media (max-width: 720px) {
          .cm-match-deck {
            grid-template-columns: minmax(0, 1fr);
          }
          .cm-match-scoreboard {
            grid-template-columns: minmax(0, 1fr);
          }
        }
      `}</style>
      {/* ====================================================================
       * 1. TOP BROADCAST & MATCH CONTROL BAR
       * ==================================================================== */}
      <div
        className="cm-panel"
        style={{ position: 'relative', zIndex: 35, overflow: 'visible', flexShrink: 0 }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 8,
            padding: '7px 10px',
            background: 'var(--cm-header-grad)',
          }}
        >
          {/* Left: Primary Match Flow Control + Speed Slider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {session.phase === 'pre_match' ? (
              <button
                type="button"
                className="cm-btn cm-btn-gold"
                onClick={handlePrimaryFlowAction}
              >
                <Play size={14} fill="currentColor" />
                Kick Off
                <span className="cm-kbd">SPACE</span>
              </button>
            ) : session.phase === 'half_time' ? (
              <button
                type="button"
                className="cm-btn cm-btn-gold"
                onClick={handlePrimaryFlowAction}
              >
                <Play size={14} fill="currentColor" />
                Start Second Half
                <span className="cm-kbd">SPACE</span>
              </button>
            ) : session.phase === 'full_time' ? (
              <button
                type="button"
                className="cm-btn cm-btn-gold"
                onClick={handlePrimaryFlowAction}
              >
                <Flag size={14} />
                Continue to Post-Match Report
                <span className="cm-kbd">SPACE</span>
              </button>
            ) : (
              <button
                type="button"
                className={`cm-btn ${session.paused ? 'cm-btn-gold' : 'cm-btn-primary'}`}
                onClick={handlePrimaryFlowAction}
              >
                {session.paused ? (
                  <>
                    <Play size={13} fill="currentColor" />
                    Resume
                  </>
                ) : (
                  <>
                    <Pause size={13} fill="currentColor" />
                    Pause
                  </>
                )}
                <span className="cm-kbd">SPACE</span>
              </button>
            )}

            {/* Match Speed Slider (1x..20x) */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '3px 8px',
                background: 'rgba(6, 12, 24, 0.72)',
                border: '1px solid var(--cm-border)',
              }}
            >
              <FastForward size={13} color="#ffd84d" />
              <span style={{ fontSize: 10.5, color: 'var(--cm-text-muted)', fontWeight: 700 }}>
                SPEED
              </span>
              <input
                type="range"
                min={1}
                max={20}
                step={1}
                value={session.speed}
                onChange={(e) => handleSpeedChange(Number(e.target.value))}
                style={{ width: 92, accentColor: '#ffd84d', cursor: 'pointer' }}
                title="Match Simulation Speed (1x to 20x)"
              />
              <span
                className="cm-num"
                style={{
                  fontSize: 11.5,
                  fontWeight: 800,
                  color: 'var(--cm-gold)',
                  minWidth: 28,
                  textAlign: 'right',
                }}
              >
                {session.speed}x
              </span>
            </div>

            {/* Commentary Frequency Selector */}
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 2,
                padding: 2,
                background: 'rgba(6, 12, 24, 0.72)',
                border: '1px solid var(--cm-border)',
              }}
              title="Commentary Frequency Filter"
            >
              {(
                [
                  { id: 'key', label: 'Key Highlights' },
                  { id: 'extended', label: 'Extended' },
                  { id: 'full', label: 'Full 90' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  className={`cm-btn cm-btn-sm ${activeFrequency === opt.id ? 'cm-btn-primary' : ''}`}
                  onClick={() => handleFrequencyChange(opt.id)}
                  style={{
                    padding: '2px 7px',
                    fontSize: 10.5,
                    border: activeFrequency === opt.id ? undefined : '1px solid transparent',
                    background: activeFrequency === opt.id ? undefined : 'transparent',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Right: Voice Toggle, Crowd & Voice Volume Sliders, Neural TTS Config Popover */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="cm-btn cm-btn-sm"
              onClick={() => {
                const nextEnabled = !audioSettings.voiceEnabled;
                if (!nextEnabled) commentaryAudioEngine.stop();
                onUpdateAudioSettings({ voiceEnabled: nextEnabled });
              }}
              style={{
                borderColor: audioSettings.voiceEnabled ? 'var(--cm-cyan)' : undefined,
                color: audioSettings.voiceEnabled ? 'var(--cm-cyan)' : 'var(--cm-text-dim)',
              }}
              title="Toggle Live Dual-Commentator Voice Broadcast"
            >
              {audioSettings.voiceEnabled ? <Volume2 size={13} /> : <VolumeX size={13} />}
              <span>Voice {audioSettings.voiceEnabled ? 'ON' : 'OFF'}</span>
            </button>

            <label
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                fontSize: 10.5,
                color: 'var(--cm-text-muted)',
                background: 'rgba(6, 12, 24, 0.65)',
                border: '1px solid var(--cm-border-subtle)',
                padding: '2px 6px',
              }}
              title="Stadium Crowd Ambience Volume"
            >
              <Waves size={12} color={audioSettings.crowdEnabled ? '#4ade80' : '#64748b'} />
              <span>Crowd</span>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(audioSettings.crowdVolume * 100)}
                onChange={(e) => {
                  const vol = Number(e.target.value) / 100;
                  onUpdateAudioSettings({ crowdVolume: vol, crowdEnabled: vol > 0 });
                }}
                style={{ width: 56, accentColor: '#4ade80', cursor: 'pointer' }}
              />
              <span className="cm-num" style={{ minWidth: 26, textAlign: 'right', color: '#e6eef9' }}>
                {Math.round(audioSettings.crowdVolume * 100)}%
              </span>
            </label>

            <label
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                fontSize: 10.5,
                color: 'var(--cm-text-muted)',
                background: 'rgba(6, 12, 24, 0.65)',
                border: '1px solid var(--cm-border-subtle)',
                padding: '2px 6px',
              }}
              title="Commentary Voice Volume"
            >
              <Mic size={12} color={audioSettings.voiceEnabled ? '#38e8d5' : '#64748b'} />
              <span>Vox</span>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(audioSettings.voiceVolume * 100)}
                onChange={(e) =>
                  onUpdateAudioSettings({ voiceVolume: Number(e.target.value) / 100 })
                }
                style={{ width: 56, accentColor: '#38e8d5', cursor: 'pointer' }}
              />
              <span className="cm-num" style={{ minWidth: 26, textAlign: 'right', color: '#e6eef9' }}>
                {Math.round(audioSettings.voiceVolume * 100)}%
              </span>
            </label>

            {/* Audio / Neural TTS Config Popover Trigger */}
            <button
              type="button"
              className={`cm-btn cm-btn-sm ${audioPopoverOpen ? 'cm-btn-gold' : ''}`}
              onClick={() => setAudioPopoverOpen((open) => !open)}
              title="Configure Web Speech & Neural TTS Broadcast Voices"
            >
              <Settings2 size={13} />
              <span>TTS Config</span>
            </button>
          </div>
        </div>

        {/* FLOATING AUDIO / NEURAL TTS CONFIG POPOVER */}
        {audioPopoverOpen && (
          <div
            className="cm-panel cm-panel-solid"
            style={{
              position: 'absolute',
              right: 10,
              top: 'calc(100% + 6px)',
              width: 'min(390px, 92vw)',
              zIndex: 60,
              boxShadow: '0 14px 36px rgba(0, 0, 0, 0.85)',
              borderColor: 'var(--cm-gold)',
            }}
          >
            <div className="cm-panel-header">
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Radio size={13} />
                Broadcast Audio &amp; Neural TTS
              </span>
              <button
                type="button"
                onClick={() => setAudioPopoverOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--cm-text-muted)',
                  cursor: 'pointer',
                  padding: 2,
                  display: 'inline-flex',
                }}
              >
                <X size={14} />
              </button>
            </div>

            <div className="cm-panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {/* TTS Provider */}
              <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 11, color: 'var(--cm-text-muted)' }}>
                Commentary TTS Engine
                <select
                  className="cm-select"
                  value={audioSettings.ttsProvider}
                  onChange={(e) =>
                    onUpdateAudioSettings({ ttsProvider: e.target.value as TtsProvider })
                  }
                >
                  <option value="webspeech">Web Speech API (Zero-Config Local Browser)</option>
                  <option value="openai">OpenAI TTS (Neural Broadcast)</option>
                  <option value="elevenlabs">ElevenLabs (Ultra-Natural Neural)</option>
                  <option value="local">Local Piper / Kokoro HTTP Endpoint</option>
                </select>
              </label>

              {/* Voice Selectors (Lead & Analyst) */}
              {audioSettings.ttsProvider === 'webspeech' && (
                <>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 11, color: 'var(--cm-text-muted)' }}>
                    Lead Play-by-Play Voice
                    <select
                      className="cm-select"
                      value={audioSettings.leadVoiceName ?? ''}
                      onChange={(e) =>
                        onUpdateAudioSettings({ leadVoiceName: e.target.value || undefined })
                      }
                    >
                      <option value="">Auto (Best English / en-GB Broadcast)</option>
                      {availableVoices.map((v) => (
                        <option key={`lead-${v.name}-${v.lang}`} value={v.name}>
                          {v.name} ({v.lang})
                        </option>
                      ))}
                    </select>
                  </label>

                  <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 11, color: 'var(--cm-text-muted)' }}>
                    Color Analyst Voice
                    <select
                      className="cm-select"
                      value={audioSettings.analystVoiceName ?? ''}
                      onChange={(e) =>
                        onUpdateAudioSettings({ analystVoiceName: e.target.value || undefined })
                      }
                    >
                      <option value="">Auto (Distinct Secondary Voice)</option>
                      {availableVoices.map((v) => (
                        <option key={`analyst-${v.name}-${v.lang}`} value={v.name}>
                          {v.name} ({v.lang})
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              )}

              {/* API Key Input for OpenAI / ElevenLabs */}
              {(audioSettings.ttsProvider === 'openai' ||
                audioSettings.ttsProvider === 'elevenlabs') && (
                <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 11, color: 'var(--cm-text-muted)' }}>
                  {audioSettings.ttsProvider === 'openai' ? 'OpenAI API Key' : 'ElevenLabs API Key'}
                  <div style={{ display: 'flex', gap: 4 }}>
                    <input
                      type={showApiKey ? 'text' : 'password'}
                      className="cm-input"
                      placeholder={
                        audioSettings.ttsProvider === 'openai' ? 'sk-...' : 'xi-api-key...'
                      }
                      value={audioSettings.apiKey}
                      onChange={(e) => onUpdateAudioSettings({ apiKey: e.target.value })}
                      style={{ flex: 1 }}
                    />
                    <button
                      type="button"
                      className="cm-btn cm-btn-sm"
                      onClick={() => setShowApiKey((s) => !s)}
                      title={showApiKey ? 'Hide key' : 'Show key'}
                    >
                      {showApiKey ? <EyeOff size={13} /> : <Eye size={13} />}
                    </button>
                  </div>
                  <span style={{ fontSize: 10, color: 'var(--cm-text-dim)' }}>
                    Automatically falls back to Web Speech API if unconfigured or offline.
                  </span>
                </label>
              )}

              {/* Local Piper / Kokoro Endpoint */}
              {audioSettings.ttsProvider === 'local' && (
                <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 11, color: 'var(--cm-text-muted)' }}>
                  Local Piper / Kokoro HTTP TTS Endpoint
                  <input
                    type="text"
                    className="cm-input"
                    placeholder="http://localhost:5002/api/tts"
                    value={audioSettings.localEndpoint}
                    onChange={(e) => onUpdateAudioSettings({ localEndpoint: e.target.value })}
                  />
                  <span style={{ fontSize: 10, color: 'var(--cm-text-dim)' }}>
                    POST JSON <code>{'{ text, speaker, excitement }'}</code> returning audio stream.
                  </span>
                </label>
              )}

              {/* Test Broadcast Voices Button */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingTop: 4 }}>
                <button
                  type="button"
                  className="cm-btn cm-btn-primary"
                  disabled={isTestingVoices}
                  onClick={() => void handleTestVoices()}
                  style={{ flex: 1 }}
                >
                  <Volume2 size={14} />
                  {isTestingVoices ? 'Testing Voices...' : 'Test Broadcast Voices'}
                </button>
                <button
                  type="button"
                  className="cm-btn cm-btn-sm"
                  onClick={() => commentaryAudioEngine.stop()}
                >
                  Stop
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ====================================================================
       * 2. CLASSIC CM 01/02 SCOREBOARD HEADER
       * ==================================================================== */}
      <div className="cm-panel" style={{ flexShrink: 0 }}>
        <div className="cm-match-scoreboard">
          {/* Home Club Banner */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              padding: '9px 14px',
              background: `linear-gradient(90deg, ${homeClub.colors.primary}dd 0%, ${homeClub.colors.primary}55 78%, transparent 100%)`,
              borderRight: `2px solid ${homeClub.colors.secondary}66`,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                className="cm-club-shield"
                style={{
                  width: 38,
                  height: 38,
                  fontSize: 12,
                  backgroundColor: homeClub.colors.primary,
                  color: homeClub.colors.text,
                  borderColor: homeClub.colors.secondary,
                }}
              >
                {homeClub.threeLetterCode}
              </div>
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 17,
                    fontWeight: 800,
                    color: '#ffffff',
                    textShadow: '0 1px 3px rgba(0,0,0,0.85)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {homeClub.name}
                  {session.userSide === 'home' && (
                    <span
                      style={{
                        marginLeft: 7,
                        fontSize: 9.5,
                        padding: '1px 5px',
                        background: 'rgba(255, 216, 77, 0.25)',
                        border: '1px solid var(--cm-gold)',
                        color: 'var(--cm-gold)',
                        verticalAlign: 'middle',
                      }}
                    >
                      YOU
                    </span>
                  )}
                </div>
                {/* Home Goalscorer Ticker */}
                <div
                  style={{
                    fontSize: 11,
                    color: '#e2e8f0',
                    marginTop: 2,
                    minHeight: 15,
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 8,
                    textShadow: '0 1px 2px rgba(0,0,0,0.85)',
                  }}
                >
                  {homeGoalsList.map((g, i) => (
                    <span key={`hg-${i}`} className="cm-num">
                      ⚽ {g.scorerName} {getGoalMinuteLabel(g)}
                      {g.isPenalty ? ' (p)' : g.isOwnGoal ? ' (og)' : ''}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Center Score & Match Clock */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '8px 22px',
              background: 'rgba(6, 11, 20, 0.94)',
              minWidth: 168,
            }}
          >
            <div
              className="cm-num"
              style={{
                fontSize: 31,
                fontWeight: 900,
                letterSpacing: '0.06em',
                lineHeight: 1,
                color: '#ffffff',
                textShadow: '0 0 14px rgba(255, 216, 77, 0.35)',
              }}
            >
              {session.homeGoals}{' '}
              <span style={{ color: 'var(--cm-text-dim)', fontSize: 24 }}>-</span>{' '}
              {session.awayGoals}
            </div>

            <div
              style={{
                marginTop: 5,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '2px 9px',
                background:
                  session.phase === 'full_time'
                    ? 'rgba(255, 216, 77, 0.2)'
                    : isRunning
                      ? 'rgba(220, 38, 38, 0.28)'
                      : 'rgba(30, 52, 88, 0.65)',
                border: `1px solid ${
                  session.phase === 'full_time'
                    ? 'var(--cm-gold)'
                    : isRunning
                      ? '#ef4444'
                      : 'var(--cm-border)'
                }`,
              }}
            >
              {isRunning && <span className="cm-live-dot" />}
              <span
                className="cm-num"
                style={{
                  fontSize: 12,
                  fontWeight: 800,
                  color:
                    session.phase === 'full_time'
                      ? 'var(--cm-gold)'
                      : isRunning
                        ? '#fecaca'
                        : '#e6eef9',
                }}
              >
                {formatMatchClock(session)}
              </span>
            </div>
          </div>

          {/* Away Club Banner */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'flex-end',
              padding: '9px 14px',
              background: `linear-gradient(270deg, ${awayClub.colors.primary}dd 0%, ${awayClub.colors.primary}55 78%, transparent 100%)`,
              borderLeft: `2px solid ${awayClub.colors.secondary}66`,
              textAlign: 'right',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexDirection: 'row-reverse' }}>
              <div
                className="cm-club-shield"
                style={{
                  width: 38,
                  height: 38,
                  fontSize: 12,
                  backgroundColor: awayClub.colors.primary,
                  color: awayClub.colors.text,
                  borderColor: awayClub.colors.secondary,
                }}
              >
                {awayClub.threeLetterCode}
              </div>
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 17,
                    fontWeight: 800,
                    color: '#ffffff',
                    textShadow: '0 1px 3px rgba(0,0,0,0.85)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {session.userSide === 'away' && (
                    <span
                      style={{
                        marginRight: 7,
                        fontSize: 9.5,
                        padding: '1px 5px',
                        background: 'rgba(255, 216, 77, 0.25)',
                        border: '1px solid var(--cm-gold)',
                        color: 'var(--cm-gold)',
                        verticalAlign: 'middle',
                      }}
                    >
                      YOU
                    </span>
                  )}
                  {awayClub.name}
                </div>
                {/* Away Goalscorer Ticker */}
                <div
                  style={{
                    fontSize: 11,
                    color: '#e2e8f0',
                    marginTop: 2,
                    minHeight: 15,
                    display: 'flex',
                    flexWrap: 'wrap',
                    justifyContent: 'flex-end',
                    gap: 8,
                    textShadow: '0 1px 2px rgba(0,0,0,0.85)',
                  }}
                >
                  {awayGoalsList.map((g, i) => (
                    <span key={`ag-${i}`} className="cm-num">
                      ⚽ {g.scorerName} {getGoalMinuteLabel(g)}
                      {g.isPenalty ? ' (p)' : g.isOwnGoal ? ' (og)' : ''}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Venue / Attendance / Referee / Weather Sub-Strip */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 10,
            padding: '4px 12px',
            background: 'rgba(6, 12, 24, 0.85)',
            borderTop: '1px solid var(--cm-border-subtle)',
            fontSize: 11,
            color: 'var(--cm-text-muted)',
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <strong style={{ color: 'var(--cm-gold)' }}>{league.name}</strong>
            <span style={{ opacity: 0.4 }}>|</span>
            <span>
              {homeClub.stadium.name}, {homeClub.stadium.city}
            </span>
          </span>

          <span className="cm-num" style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
            <span>Att: {session.attendance.toLocaleString()}</span>
            <span style={{ opacity: 0.4 }}>|</span>
            <span>Ref: {session.refereeName}</span>
            <span style={{ opacity: 0.4 }}>|</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              {getWeatherIcon(session.weather)}
              {session.weather} {session.temperatureC}°C
            </span>
          </span>
        </div>
      </div>

      {/* ====================================================================
       * 3. MAIN MATCH DECK (SCROLLABLE 3-PANEL RESPONSIVE LAYOUT)
       * ==================================================================== */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          overflowX: 'hidden',
          paddingBottom: 12,
          paddingRight: 2,
        }}
      >
        <div className="cm-match-deck">
          {/* LEFT PANEL: HOME LINEUP & RATINGS */}
          {renderLineupPanel('home')}

          {/* CENTER PANEL: LIVE 2D TACTICAL RADAR + TABBED STATS / COMMENTARY LOG */}
          <div
            className="cm-match-deck-center"
            style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}
          >
          {/* LIVE 2D TACTICAL RADAR */}
          <div className="cm-panel">
            <div className="cm-panel-header" style={{ padding: '5px 10px' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Activity size={13} />
                2D Tactical Radar (WIB-WOB Live)
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 10.5 }}>
                <span
                  className="cm-num"
                  style={{
                    padding: '1px 6px',
                    background:
                      session.possessionSide === 'home'
                        ? `${homeClub.colors.primary}aa`
                        : `${awayClub.colors.primary}aa`,
                    border: '1px solid rgba(255,255,255,0.35)',
                    color: '#ffffff',
                    fontWeight: 700,
                  }}
                >
                  POSS: {session.possessionSide === 'home' ? homeClub.threeLetterCode : awayClub.threeLetterCode}
                </span>
                <span className="cm-num" style={{ color: 'var(--cm-text-muted)' }}>
                  Zone R{session.zoneRow + 1}·C{session.zoneCol + 1}
                </span>
              </div>
            </div>

            <div style={{ padding: 8, background: 'rgba(6, 12, 24, 0.72)' }}>
              <div
                style={{
                  position: 'relative',
                  width: '100%',
                  aspectRatio: '100 / 64',
                  border: '2px solid rgba(168, 204, 248, 0.45)',
                  background: '#115328',
                  boxShadow: finalThirdExcitement
                    ? '0 0 22px rgba(255, 216, 77, 0.35), inset 0 0 26px rgba(0,0,0,0.5)'
                    : 'inset 0 0 26px rgba(0,0,0,0.5)',
                  transition: 'box-shadow 0.3s ease',
                  overflow: 'hidden',
                }}
              >
                <svg
                  viewBox="0 0 100 64"
                  preserveAspectRatio="none"
                  style={{ width: '100%', height: '100%', display: 'block' }}
                >
                  <defs>
                    <pattern id="cm-radar-stripes" width="20" height="64" patternUnits="userSpaceOnUse">
                      <rect x="0" y="0" width="10" height="64" fill="#17612f" />
                      <rect x="10" y="0" width="10" height="64" fill="#135428" />
                    </pattern>
                    <radialGradient id="cm-excitement-glow-right" cx="92%" cy="50%" r="32%">
                      <stop offset="0%" stopColor="rgba(255, 216, 77, 0.48)" />
                      <stop offset="60%" stopColor="rgba(239, 68, 68, 0.18)" />
                      <stop offset="100%" stopColor="rgba(239, 68, 68, 0)" />
                    </radialGradient>
                    <radialGradient id="cm-excitement-glow-left" cx="8%" cy="50%" r="32%">
                      <stop offset="0%" stopColor="rgba(255, 216, 77, 0.48)" />
                      <stop offset="60%" stopColor="rgba(239, 68, 68, 0.18)" />
                      <stop offset="100%" stopColor="rgba(239, 68, 68, 0)" />
                    </radialGradient>
                  </defs>

                  {/* Mowed Turf */}
                  <rect x="0" y="0" width="100" height="64" fill="url(#cm-radar-stripes)" />

                  {/* 5x5 Active Tactical Zone Highlight */}
                  <g>
                    {Array.from({ length: 5 }, (_, r) =>
                      Array.from({ length: 5 }, (_, c) => {
                        const isActiveZone = session.zoneRow === r && session.zoneCol === c;
                        return (
                          <rect
                            key={`z-${r}-${c}`}
                            x={c * 20}
                            y={r * 12.8}
                            width={20}
                            height={12.8}
                            fill={
                              isActiveZone
                                ? session.possessionSide === 'home'
                                  ? `${homeClub.colors.primary}38`
                                  : `${awayClub.colors.primary}38`
                                : 'none'
                            }
                            stroke={
                              isActiveZone
                                ? 'rgba(255, 216, 77, 0.65)'
                                : 'rgba(220, 252, 231, 0.10)'
                            }
                            strokeWidth={isActiveZone ? 0.55 : 0.2}
                          />
                        );
                      })
                    )}
                  </g>

                  {/* Final-Third Excitement Glow */}
                  {finalThirdExcitement && session.ballX >= 75 && (
                    <rect x="60" y="0" width="40" height="64" fill="url(#cm-excitement-glow-right)" />
                  )}
                  {finalThirdExcitement && session.ballX <= 25 && (
                    <rect x="0" y="0" width="40" height="64" fill="url(#cm-excitement-glow-left)" />
                  )}

                  {/* Pitch Lines (Horizontal: Home attacks Left -> Right) */}
                  <g stroke="rgba(235, 255, 240, 0.55)" strokeWidth="0.38" fill="none">
                    <rect x="2.5" y="2.5" width="95" height="59" />
                    <line x1="50" y1="2.5" x2="50" y2="61.5" />
                    <circle cx="50" cy="32" r="8.2" />
                    <circle cx="50" cy="32" r="0.6" fill="rgba(235,255,240,0.8)" />

                    {/* Left Box (Home Defends) */}
                    <rect x="2.5" y="14" width="14.5" height="36" />
                    <rect x="2.5" y="23" width="5.2" height="18" />
                    <circle cx="12.5" cy="32" r="0.5" fill="rgba(235,255,240,0.8)" />
                    <path d="M 17 25 A 7 8 0 0 1 17 39" />
                    <rect x="0.8" y="27" width="1.7" height="10" stroke={homeClub.colors.secondary} />

                    {/* Right Box (Away Defends) */}
                    <rect x="83" y="14" width="14.5" height="36" />
                    <rect x="92.3" y="23" width="5.2" height="18" />
                    <circle cx="87.5" cy="32" r="0.5" fill="rgba(235,255,240,0.8)" />
                    <path d="M 83 25 A 7 8 0 0 0 83 39" />
                    <rect x="97.5" y="27" width="1.7" height="10" stroke={awayClub.colors.secondary} />
                  </g>

                  {/* Subtle Direction Labels */}
                  <text x="5" y="5.8" fill="rgba(255,255,255,0.45)" fontSize="2.2" fontWeight="700">
                    {homeClub.threeLetterCode} →
                  </text>
                  <text
                    x="95"
                    y="5.8"
                    textAnchor="end"
                    fill="rgba(255,255,255,0.45)"
                    fontSize="2.2"
                    fontWeight="700"
                  >
                    ← {awayClub.threeLetterCode}
                  </text>

                  {/* Ball Trail */}
                  {ballTrail.length > 1 && (
                    <polyline
                      fill="none"
                      stroke="rgba(255, 255, 255, 0.55)"
                      strokeWidth="0.6"
                      strokeDasharray="1.4 1.2"
                      points={ballTrail
                        .map((pt) => `${pt.x},${(pt.y / 100) * 64}`)
                        .join(' ')}
                    />
                  )}

                  {/* 22 Animated Player Dots */}
                  {session.radarPlayers.map((dot) => {
                    if (dot.sentOff) return null;
                    const club = dot.side === 'home' ? homeClub : awayClub;
                    const px = Math.max(3, Math.min(97, dot.x));
                    const py = Math.max(3, Math.min(61, (dot.y / 100) * 64));
                    return (
                      <g
                        key={dot.playerId}
                        transform={`translate(${px}, ${py})`}
                        style={{
                          transition: 'transform 320ms cubic-bezier(0.22, 1, 0.36, 1)',
                        }}
                      >
                        {dot.hasBall && (
                          <circle
                            cx={0}
                            cy={0}
                            r={3.5}
                            fill="rgba(255, 216, 77, 0.28)"
                            stroke="#ffd84d"
                            strokeWidth="0.5"
                          />
                        )}
                        <circle cx={0.3} cy={0.5} r={2.2} fill="rgba(0,0,0,0.5)" />
                        <circle
                          cx={0}
                          cy={0}
                          r={2.15}
                          fill={club.colors.primary}
                          stroke={dot.hasBall ? '#ffd84d' : club.colors.secondary}
                          strokeWidth={dot.hasBall ? 0.65 : 0.45}
                        />
                        <text
                          x={0}
                          y={0.75}
                          textAnchor="middle"
                          fill={club.colors.text}
                          fontSize="1.85"
                          fontWeight="800"
                          fontFamily="var(--cm-font-mono)"
                        >
                          {dot.shirtNumber}
                        </text>
                        {dot.hasBall && (
                          <g transform="translate(0, 4.1)">
                            <rect
                              x={-7.5}
                              y={-1.45}
                              width={15}
                              height={2.6}
                              rx={0.5}
                              fill="rgba(6, 11, 20, 0.88)"
                              stroke="#ffd84d"
                              strokeWidth="0.22"
                            />
                            <text
                              x={0}
                              y={0.45}
                              textAnchor="middle"
                              fill="#ffd84d"
                              fontSize="1.7"
                              fontWeight="700"
                            >
                              {dot.shortName.slice(0, 10)}
                            </text>
                          </g>
                        )}
                      </g>
                    );
                  })}

                  {/* Animated Ball Marker */}
                  <g
                    transform={`translate(${Math.max(2, Math.min(98, session.ballX))}, ${Math.max(
                      2,
                      Math.min(62, (session.ballY / 100) * 64)
                    )})`}
                    style={{ transition: 'transform 260ms ease-out' }}
                  >
                    <circle cx={0} cy={0} r={2.4} fill="rgba(255,255,255,0.22)" />
                    <circle
                      cx={0}
                      cy={0}
                      r={1.35}
                      fill="#ffffff"
                      stroke="#0f172a"
                      strokeWidth="0.4"
                    />
                  </g>
                </svg>
              </div>
            </div>
          </div>

          {/* TABBED LOWER PANEL: COMMENTARY FEED & LIVE MATCH STATS */}
          <div className="cm-panel" style={{ flex: 1 }}>
            <div className="cm-panel-header" style={{ padding: '4px 8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <button
                  type="button"
                  className={`cm-tab ${centerTab === 'commentary' ? 'is-active' : ''}`}
                  onClick={() => setCenterTab('commentary')}
                  style={{ padding: '3px 9px', fontSize: 11.5 }}
                >
                  Commentary Log ({session.events.length})
                </button>
                <button
                  type="button"
                  className={`cm-tab ${centerTab === 'stats' ? 'is-active' : ''}`}
                  onClick={() => setCenterTab('stats')}
                  style={{ padding: '3px 9px', fontSize: 11.5 }}
                >
                  Live Match Stats
                </button>
              </div>

              {centerTab === 'commentary' && (
                <button
                  type="button"
                  className="cm-btn cm-btn-sm"
                  onClick={() => setShowAllFeed((v) => !v)}
                  style={{ fontSize: 10, padding: '2px 6px' }}
                >
                  {showAllFeed ? 'Showing: All' : `Filter: ${activeFrequency.toUpperCase()}`}
                </button>
              )}
            </div>

            <div className="cm-panel-body" style={{ padding: 8 }}>
              {centerTab === 'commentary' ? (
                <div
                  style={{
                    maxHeight: 270,
                    overflowY: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 5,
                    paddingRight: 2,
                  }}
                >
                  {displayedEvents.length === 0 ? (
                    <div
                      style={{
                        textAlign: 'center',
                        padding: 24,
                        color: 'var(--cm-text-dim)',
                        fontSize: 12,
                      }}
                    >
                      Press <strong>Kick Off</strong> or <strong>SPACE</strong> to start live match commentary.
                    </div>
                  ) : (
                    displayedEvents.map((ev) => {
                      const badge = getEventBadge(ev.type);
                      const evTimeLabel = formatEventTimestamp(
                        ev,
                        eventIndexById.get(ev.id) ?? -1,
                        halftimeIndex,
                        session.phase
                      );
                      const borderAccent =
                        ev.teamSide === 'home'
                          ? homeClub.colors.primary
                          : ev.teamSide === 'away'
                            ? awayClub.colors.primary
                            : '#64748b';
                      return (
                        <div
                          key={ev.id}
                          style={{
                            padding: '6px 8px',
                            background:
                              ev.type === 'goal' || ev.type === 'penalty_scored'
                                ? 'rgba(22, 101, 52, 0.34)'
                                : ev.type === 'red_card'
                                  ? 'rgba(153, 27, 27, 0.30)'
                                  : 'rgba(8, 16, 30, 0.72)',
                            border: '1px solid var(--cm-border-subtle)',
                            borderLeft: `3px solid ${borderAccent}`,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 4,
                          }}
                        >
                          {ev.segments.map((seg) => (
                            <div
                              key={seg.id}
                              style={{
                                display: 'flex',
                                alignItems: 'baseline',
                                gap: 6,
                                fontSize: 12,
                              }}
                            >
                              <span
                                className="cm-num"
                                style={{
                                  fontSize: 10.5,
                                  fontWeight: 700,
                                  color: 'var(--cm-gold)',
                                  minWidth: 38,
                                  whiteSpace: 'nowrap',
                                  flexShrink: 0,
                                }}
                              >
                                {evTimeLabel}
                              </span>
                              <span
                                className="cm-num"
                                style={{
                                  fontSize: 9,
                                  fontWeight: 800,
                                  padding: '0 4px',
                                  border: `1px solid ${
                                    seg.speaker === 'analyst' ? 'var(--cm-cyan)' : badge.color
                                  }`,
                                  color:
                                    seg.speaker === 'analyst' ? 'var(--cm-cyan)' : badge.color,
                                  flexShrink: 0,
                                }}
                              >
                                {seg.speaker === 'analyst' ? 'ANALYST' : badge.label}
                              </span>
                              <span
                                style={{
                                  color: seg.speaker === 'analyst' ? '#bae6fd' : '#f1f5f9',
                                  fontStyle: seg.speaker === 'analyst' ? 'italic' : 'normal',
                                  fontWeight:
                                    ev.type === 'goal' || ev.type === 'penalty_scored' ? 700 : 500,
                                }}
                              >
                                {seg.text}
                              </span>
                            </div>
                          ))}
                        </div>
                      );
                    })
                  )}
                </div>
              ) : (
                /* LIVE MATCH STATS */
                <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                  {/* Momentum Meter */}
                  <div
                    style={{
                      padding: '6px 8px',
                      background: 'rgba(6, 12, 24, 0.75)',
                      border: '1px solid var(--cm-border)',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: 10.5,
                        marginBottom: 4,
                      }}
                    >
                      <span style={{ fontWeight: 700, color: '#ffffff' }}>
                        {homeClub.threeLetterCode} ({homeMomentumPct}%)
                      </span>
                      <span
                        style={{
                          color: 'var(--cm-gold)',
                          fontWeight: 700,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        <Zap size={11} />
                        MATCH MOMENTUM
                      </span>
                      <span style={{ fontWeight: 700, color: '#ffffff' }}>
                        ({100 - homeMomentumPct}%) {awayClub.threeLetterCode}
                      </span>
                    </div>
                    <div
                      style={{
                        height: 8,
                        display: 'flex',
                        background: 'rgba(0,0,0,0.65)',
                        border: '1px solid rgba(168,204,248,0.28)',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          width: `${homeMomentumPct}%`,
                          background: `linear-gradient(90deg, ${homeClub.colors.primary}, #ffd84d)`,
                          transition: 'width 0.4s ease',
                        }}
                      />
                      <div
                        style={{
                          width: `${100 - homeMomentumPct}%`,
                          background: `linear-gradient(270deg, ${awayClub.colors.primary}, #38e8d5)`,
                          transition: 'width 0.4s ease',
                        }}
                      />
                    </div>
                  </div>

                  {renderStatRow(
                    'Possession',
                    session.homeStats.possession,
                    session.awayStats.possession,
                    (n) => `${n}%`
                  )}
                  {renderStatRow('Shots', session.homeStats.shots, session.awayStats.shots)}
                  {renderStatRow(
                    'On Target',
                    session.homeStats.shotsOnTarget,
                    session.awayStats.shotsOnTarget
                  )}
                  {renderStatRow(
                    'Expected Goals (xG)',
                    session.homeStats.xg,
                    session.awayStats.xg,
                    (n) => n.toFixed(2)
                  )}
                  {renderStatRow('Pass Accuracy', homePassPct, awayPassPct, (n) => `${n}%`)}
                  {renderStatRow('Corners', session.homeStats.corners, session.awayStats.corners)}
                  {renderStatRow('Tackles Won', session.homeStats.tacklesWon, session.awayStats.tacklesWon)}
                  {renderStatRow('Fouls', session.homeStats.fouls, session.awayStats.fouls)}
                  {renderStatRow(
                    'Yellow Cards',
                    session.homeStats.yellowCards,
                    session.awayStats.yellowCards
                  )}
                  {renderStatRow(
                    'Red Cards',
                    session.homeStats.redCards,
                    session.awayStats.redCards
                  )}
                </div>
              )}
            </div>
          </div>

          {/* FULL-TIME CALLOUT BANNER */}
          {session.phase === 'full_time' && (
            <div
              className="cm-panel"
              style={{
                borderColor: 'var(--cm-gold)',
                background: 'linear-gradient(90deg, rgba(180, 120, 12, 0.25), rgba(11, 20, 38, 0.94))',
              }}
            >
              <div
                style={{
                  padding: '10px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  flexWrap: 'wrap',
                }}
              >
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--cm-gold)' }}>
                    FULL-TIME: {homeClub.shortName} {session.homeGoals} - {session.awayGoals}{' '}
                    {awayClub.shortName}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--cm-text-muted)' }}>
                    Stats, player ratings, gate receipts &amp; league standings are ready to commit.
                  </div>
                </div>
                <button
                  type="button"
                  className="cm-btn cm-btn-gold"
                  onClick={handlePrimaryFlowAction}
                >
                  <Shield size={14} />
                  Continue to Post-Match Report
                </button>
              </div>
            </div>
          )}
        </div>

          {/* RIGHT PANEL: AWAY LINEUP & RATINGS */}
          {renderLineupPanel('away')}
        </div>
      </div>

      {/* ====================================================================
       * 4. ICONIC CM 01/02 FLASHING TEAM-COLORED BOTTOM COMMENTARY BAR
       *    Docked cleanly below the scrollable match deck (zero overlap)
       * ==================================================================== */}
      <div
        className={`cm-commentary-bar ${getFlashClass(bannerFlashMode)}`}
        style={
          {
            flexShrink: 0,
            zIndex: 30,
            '--cm-bar-primary': barColors.primary,
            '--cm-bar-secondary': barColors.secondary,
            '--cm-bar-text': barColors.text,
          } as React.CSSProperties
        }
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          {/* Left: Speaker Badge + Word-by-Word Synchronized Commentary */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 220 }}>
            <span
              className="cm-num"
              style={{
                padding: '2px 7px',
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: '0.06em',
                background: 'rgba(0, 0, 0, 0.52)',
                border: `1px solid ${
                  bannerSegment?.speaker === 'analyst' ? '#38e8d5' : '#ffd84d'
                }`,
                color: bannerSegment?.speaker === 'analyst' ? '#38e8d5' : '#ffd84d',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              {bannerSegment?.speaker === 'analyst' ? 'COLOR ANALYST' : 'PLAY-BY-PLAY'}
            </span>

            {fallbackEvent && (
              <span
                className="cm-num"
                style={{
                  fontSize: 12,
                  fontWeight: 800,
                  padding: '1px 5px',
                  background: 'rgba(0,0,0,0.42)',
                  border: '1px solid rgba(255,255,255,0.28)',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                {formatEventTimestamp(
                  fallbackEvent,
                  eventIndexById.get(fallbackEvent.id) ?? -1,
                  halftimeIndex,
                  session.phase
                )}
              </span>
            )}

            {/* Progressive Word-by-Word Highlight */}
            <div style={{ lineHeight: 1.35, fontSize: 14.5 }}>
              {bannerWords.map((word, idx) => {
                const isCurrent = isLiveSpeaking && idx === speechState.activeWordIndex;
                const isSpoken =
                  isLiveSpeaking &&
                  speechState.activeWordIndex >= 0 &&
                  idx < speechState.activeWordIndex;
                const isUpcoming =
                  isLiveSpeaking &&
                  speechState.activeWordIndex >= 0 &&
                  idx > speechState.activeWordIndex;

                return (
                  <span
                    key={`${bannerSegment?.id ?? 'idle'}-w-${idx}`}
                    style={{
                      display: 'inline-block',
                      marginRight: 5,
                      padding: isCurrent ? '0 3px' : 0,
                      borderRadius: 2,
                      backgroundColor: isCurrent ? 'rgba(255, 216, 77, 0.92)' : 'transparent',
                      color: isCurrent ? '#060b14' : 'inherit',
                      textShadow: isCurrent ? 'none' : undefined,
                      opacity: isUpcoming ? 0.62 : isSpoken ? 1 : 1,
                      transform: isCurrent ? 'scale(1.04)' : 'none',
                      transition: 'background-color 90ms ease, opacity 120ms ease',
                    }}
                  >
                    {word}
                  </span>
                );
              })}
            </div>
          </div>

          {/* Right: -8 dB Audio Ducking Indicator + Excitement LED Meter (1..10) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            {isAudioDucked && (
              <span
                className="cm-num"
                title="Crowd ambience automatically ducked by -8 dB during voice commentary"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '2px 6px',
                  fontSize: 10,
                  fontWeight: 800,
                  background: 'rgba(0, 0, 0, 0.58)',
                  border: '1px solid #38e8d5',
                  color: '#38e8d5',
                  whiteSpace: 'nowrap',
                }}
              >
                <Volume2 size={11} />
                -8 dB DUCK
              </span>
            )}

            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '3px 7px',
                background: 'rgba(0, 0, 0, 0.48)',
                border: '1px solid rgba(255, 255, 255, 0.25)',
              }}
              title={`Broadcast Excitement Level: ${bannerExcitement}/10`}
            >
              <span className="cm-num" style={{ fontSize: 9.5, opacity: 0.85 }}>
                EXC
              </span>
              <div style={{ display: 'inline-flex', alignItems: 'flex-end', gap: 2, height: 14 }}>
                {Array.from({ length: 10 }, (_, i) => {
                  const lvl = i + 1;
                  const lit = lvl <= bannerExcitement;
                  const color =
                    lvl >= 9 ? '#ef4444' : lvl >= 6 ? '#facc15' : '#4ade80';
                  return (
                    <span
                      key={`exc-${lvl}`}
                      style={{
                        display: 'inline-block',
                        width: 3,
                        height: 5 + Math.round((lvl / 10) * 9),
                        background: lit ? color : 'rgba(255,255,255,0.18)',
                        boxShadow: lit && lvl >= 8 ? `0 0 6px ${color}` : 'none',
                      }}
                    />
                  );
                })}
              </div>
              <span className="cm-num" style={{ fontSize: 10.5, fontWeight: 800, minWidth: 16 }}>
                {bannerExcitement}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MatchDayView;
