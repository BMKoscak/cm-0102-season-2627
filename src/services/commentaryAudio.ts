/**
 * Dual-Commentator Live Broadcast TTS Pipeline for CM 01/02 — Season 2026/27.
 *
 * Features:
 *  - Dual-Commentator Broadcast Pipeline:
 *      * `lead` (Play-by-Play): crisp British/English voice (`en-GB` preferred),
 *        dynamically modulated rate (1.05 -> 1.35) & pitch (0.98 -> 1.26) from excitement (1..10).
 *      * `analyst` (Color Commentator): distinct second English voice (deeper pitch 0.86..0.94,
 *        measured rate 0.98..1.06) for dead balls, tactical shifts, cards, subs, goals, HT/FT.
 *  - Pluggable TTS Providers:
 *      1. Default Zero-Config Web Speech API (`window.speechSynthesis`) with native `onboundary`
 *         word-tracking + smooth timer-based word progression fallback.
 *      2. Optional Neural TTS hooks (`openai`, `elevenlabs`, `local` Piper/Kokoro HTTP endpoint)
 *         with sequential Audio playback, LRU phrase audio cache, and automatic Web Speech fallback.
 *  - Automatic -8 dB crowd ducking via `stadiumAmbience.setDucking(true/false)`.
 *  - Smart queue management: goals & high-excitement moments immediately preempt low-excitement
 *    chatter so key moments speak instantaneously without backlog lag.
 */

import type { AudioSettings, CommentarySegment, TtsProvider } from '../types/game';
import type { CommentaryAudioService, SpeechSyncState } from '../types/contracts';
import { stadiumAmbience } from './stadiumAmbience';

interface WordSpan {
  word: string;
  start: number;
  end: number;
  cumWeightEnd: number;
}

interface QueuedSegment {
  segment: CommentarySegment;
  priority: number; // higher = more urgent (goals = 100)
  enqueuedAt: number;
  resolveDone?: () => void;
}

export interface ExtendedCommentaryAudioService extends CommentaryAudioService {
  subscribeSpeechState: (listener: (state: SpeechSyncState) => void) => () => void;
  getAvailableVoices: () => SpeechSynthesisVoice[];
  getSpeechState: () => SpeechSyncState;
  setMatchSpeed: (speed: number) => void;
  enqueueSegment: (
    segment: CommentarySegment,
    options?: { speed?: number; forceSpeak?: boolean }
  ) => void;
}

const MAX_PHRASE_CACHE = 120;
const MAX_QUEUE_NORMAL = 5;
const MAX_QUEUE_FAST = 2;
const NEURAL_FETCH_TIMEOUT_MS = 6500;

const DEFAULT_SETTINGS: AudioSettings = {
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

function tokenizeWords(text: string): WordSpan[] {
  const spans: WordSpan[] = [];
  const regex = /\S+/g;
  let match: RegExpExecArray | null;
  let totalWeight = 0;

  while ((match = regex.exec(text)) !== null) {
    const word = match[0];
    // Weight longer words and clause-ending punctuation slightly longer for accurate pacing
    const punctPause = /[.!?]$/.test(word) ? 3.5 : /[,;:—-]$/.test(word) ? 1.8 : 0;
    const weight = Math.max(2, word.length) + punctPause;
    totalWeight += weight;
    spans.push({
      word,
      start: match.index,
      end: match.index + word.length,
      cumWeightEnd: totalWeight,
    });
  }

  if (totalWeight > 0) {
    for (const s of spans) {
      s.cumWeightEnd = s.cumWeightEnd / totalWeight;
    }
  }
  return spans;
}

function findWordIndexByChar(spans: WordSpan[], charIndex: number): number {
  if (spans.length === 0) return -1;
  for (let i = 0; i < spans.length; i++) {
    if (charIndex <= spans[i].end) {
      return i;
    }
  }
  return spans.length - 1;
}

function findWordIndexByProgress(spans: WordSpan[], progress: number): number {
  if (spans.length === 0) return -1;
  const clamped = Math.max(0, Math.min(1, progress));
  for (let i = 0; i < spans.length; i++) {
    if (clamped <= spans[i].cumWeightEnd) {
      return i;
    }
  }
  return spans.length - 1;
}

class BroadcastCommentaryAudioEngine implements ExtendedCommentaryAudioService {
  private settings: AudioSettings = { ...DEFAULT_SETTINGS };
  private queue: QueuedSegment[] = [];
  private listeners = new Set<(state: SpeechSyncState) => void>();
  private phraseAudioCache = new Map<string, string>();

  private speaking = false;
  private ducked = false;
  private matchSpeed = 1;
  private playbackGeneration = 0;
  private currentItem: QueuedSegment | null = null;
  private activeAudioEl: HTMLAudioElement | null = null;
  private activeTimer: number | null = null;
  private activeSafetyTimer: number | null = null;
  private activeAbortController: AbortController | null = null;
  private cachedVoices: SpeechSynthesisVoice[] = [];
  private voicesListenerBound = false;

  private speechState: SpeechSyncState = {
    speaking: false,
    ducked: false,
    segment: null,
    activeWordIndex: -1,
    charIndex: 0,
    words: [],
  };

  constructor() {
    this.initVoiceDiscovery();
  }

  private initVoiceDiscovery(): void {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const loadVoices = () => {
      try {
        const list = window.speechSynthesis.getVoices();
        if (list && list.length > 0) {
          this.cachedVoices = list;
        }
      } catch {
        // ignore voice query errors
      }
    };

    loadVoices();

    if (!this.voicesListenerBound) {
      this.voicesListenerBound = true;
      try {
        window.speechSynthesis.addEventListener('voiceschanged', loadVoices);
      } catch {
        window.speechSynthesis.onvoiceschanged = loadVoices;
      }
    }
  }

  public getAvailableVoices(): SpeechSynthesisVoice[] {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return [];
    }
    try {
      const fresh = window.speechSynthesis.getVoices();
      if (fresh && fresh.length > 0) {
        this.cachedVoices = fresh;
      }
    } catch {
      // keep cached
    }
    return [...this.cachedVoices];
  }

  public getSpeechState(): SpeechSyncState {
    return this.speechState;
  }

  public subscribeSpeechState(listener: (state: SpeechSyncState) => void): () => void {
    this.listeners.add(listener);
    // Immediately deliver current snapshot so late subscribers sync on mount
    try {
      listener(this.speechState);
    } catch {
      // ignore subscriber errors
    }
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emitState(next: SpeechSyncState): void {
    this.speechState = next;
    for (const listener of this.listeners) {
      try {
        listener(next);
      } catch {
        // isolate listener exceptions
      }
    }
  }

  private setCrowdDucking(ducked: boolean): void {
    if (this.ducked === ducked) return;
    this.ducked = ducked;
    stadiumAmbience.setDucking(ducked);
  }

  public configure(settings: AudioSettings): void {
    const wasEnabled = this.settings.voiceEnabled;
    this.settings = { ...DEFAULT_SETTINGS, ...settings };

    // Update live HTMLAudio volume immediately if neural TTS is currently playing
    if (this.activeAudioEl) {
      this.activeAudioEl.volume = Math.max(0, Math.min(1, this.settings.voiceVolume));
    }

    if (wasEnabled && !this.settings.voiceEnabled) {
      this.stop();
    }
  }

  public setMatchSpeed(speed: number): void {
    this.matchSpeed = Math.max(1, Math.min(20, speed));
    if (this.matchSpeed >= 8 && this.queue.length > MAX_QUEUE_FAST) {
      // Drop oldest low-excitement queued chatter when speed ramps up
      this.queue = this.queue
        .filter((item) => item.priority >= 60)
        .slice(-MAX_QUEUE_FAST);
    }
  }

  public isSpeaking(): boolean {
    return this.speaking;
  }

  private computePriority(segment: CommentarySegment): number {
    if (segment.flashMode === 'flash-goal' || segment.excitement >= 10) return 100;
    if (segment.excitement >= 9 || segment.flashMode === 'flash-card') return 85;
    if (segment.flashMode === 'flash-chance' || segment.excitement >= 7) return 70;
    if (segment.speaker === 'analyst') return 55;
    return Math.max(10, segment.excitement * 6);
  }

  public enqueueSegment(
    segment: CommentarySegment,
    options?: { speed?: number; forceSpeak?: boolean }
  ): void {
    if (!segment || !segment.text || !segment.text.trim()) return;

    if (typeof options?.speed === 'number') {
      this.matchSpeed = Math.max(1, Math.min(20, options.speed));
    }

    const canSpeak = options?.forceSpeak || this.settings.voiceEnabled;
    if (!canSpeak) {
      return;
    }

    const priority = this.computePriority(segment);
    const isCritical = priority >= 85;
    const isFast = this.matchSpeed >= 8;

    // At high match speed (>= 8x), skip ambient low-excitement chatter if already speaking
    if (isFast && this.speaking && priority < 50 && !options?.forceSpeak) {
      return;
    }

    // Immediate preemption: if a GOAL or critical moment arrives while low-excitement chatter is active
    if (isCritical && this.currentItem && this.currentItem.priority < 80) {
      // Clear stale low-priority queued items but keep other critical items
      this.queue = this.queue.filter((q) => q.priority >= 80);
      this.queue.unshift({
        segment,
        priority,
        enqueuedAt: Date.now(),
      });
      this.interruptCurrentPlaybackOnly();
      void this.processQueue();
      return;
    }

    // Also prune stale low-priority queued items if a critical moment arrives behind another critical one
    if (isCritical) {
      this.queue = this.queue.filter((q) => q.priority >= 65);
    }

    const maxQueue = isFast ? MAX_QUEUE_FAST : MAX_QUEUE_NORMAL;
    if (this.queue.length >= maxQueue) {
      // Evict lowest-priority oldest entry
      let lowestIdx = 0;
      for (let i = 1; i < this.queue.length; i++) {
        if (this.queue[i].priority < this.queue[lowestIdx].priority) {
          lowestIdx = i;
        }
      }
      if (priority >= this.queue[lowestIdx].priority) {
        const removed = this.queue.splice(lowestIdx, 1)[0];
        removed?.resolveDone?.();
      } else {
        return;
      }
    }

    this.queue.push({
      segment,
      priority,
      enqueuedAt: Date.now(),
    });

    if (!this.speaking) {
      void this.processQueue();
    }
  }

  public stop(): void {
    this.playbackGeneration += 1;
    const pending = this.queue.splice(0, this.queue.length);
    for (const item of pending) {
      item.resolveDone?.();
    }
    this.interruptCurrentPlaybackOnly();
    this.speaking = false;
    this.currentItem = null;
    this.setCrowdDucking(false);
    this.emitState({
      speaking: false,
      ducked: false,
      segment: null,
      activeWordIndex: -1,
      charIndex: 0,
      words: [],
    });
  }

  private clearActiveTimers(): void {
    if (this.activeTimer !== null && typeof window !== 'undefined') {
      window.clearInterval(this.activeTimer);
      this.activeTimer = null;
    }
    if (this.activeSafetyTimer !== null && typeof window !== 'undefined') {
      window.clearTimeout(this.activeSafetyTimer);
      this.activeSafetyTimer = null;
    }
  }

  private interruptCurrentPlaybackOnly(): void {
    this.playbackGeneration += 1;
    this.clearActiveTimers();

    if (this.activeAbortController) {
      try {
        this.activeAbortController.abort();
      } catch {
        // ignore
      }
      this.activeAbortController = null;
    }

    if (this.activeAudioEl) {
      try {
        this.activeAudioEl.pause();
        this.activeAudioEl.currentTime = 0;
        this.activeAudioEl.onended = null;
        this.activeAudioEl.onerror = null;
      } catch {
        // ignore
      }
      this.activeAudioEl = null;
    }

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // ignore
      }
    }

    const doneCb = this.currentItem?.resolveDone;
    this.currentItem = null;
    doneCb?.();
  }

  private async processQueue(): Promise<void> {
    if (this.speaking && this.currentItem) return;

    while (this.queue.length > 0) {
      const next = this.queue.shift()!;
      this.currentItem = next;
      this.speaking = true;
      this.setCrowdDucking(true);

      const gen = ++this.playbackGeneration;
      const spans = tokenizeWords(next.segment.text);
      const words = spans.map((s) => s.word);

      this.emitState({
        speaking: true,
        ducked: this.ducked,
        segment: next.segment,
        activeWordIndex: words.length > 0 ? 0 : -1,
        charIndex: 0,
        words,
      });

      try {
        const playedViaNeural = await this.tryPlayNeuralTts(next.segment, spans, gen);
        if (!playedViaNeural && gen === this.playbackGeneration) {
          await this.playViaWebSpeech(next.segment, spans, gen);
        }
      } catch {
        // Never allow playback failure to wedge queue
      }

      if (gen === this.playbackGeneration) {
        this.clearActiveTimers();
        const doneCb = this.currentItem?.resolveDone;
        this.currentItem = null;
        doneCb?.();
      } else {
        // Interrupted by preemption or stop(); let the interrupting call drive the queue
        return;
      }
    }

    // Queue drained cleanly -> restore stadium crowd from -8 dB ducking
    this.speaking = false;
    this.currentItem = null;
    this.setCrowdDucking(false);
    this.emitState({
      speaking: false,
      ducked: false,
      segment: null,
      activeWordIndex: -1,
      charIndex: 0,
      words: [],
    });
  }

  /* ==========================================================================
   * VOICE SELECTION & MODULATION (DUAL-COMMENTATOR PAIRING)
   * ========================================================================== */

  private resolveVoices(): {
    lead: SpeechSynthesisVoice | null;
    analyst: SpeechSynthesisVoice | null;
  } {
    const voices = this.getAvailableVoices();
    if (voices.length === 0) return { lead: null, analyst: null };

    const findByName = (target?: string): SpeechSynthesisVoice | null => {
      if (!target || !target.trim()) return null;
      const trimmed = target.trim().toLowerCase();
      return (
        voices.find(
          (v) => v.name.toLowerCase() === trimmed || v.voiceURI.toLowerCase() === trimmed
        ) ?? null
      );
    };

    const english = voices.filter((v) => v.lang.toLowerCase().startsWith('en'));
    const pool = english.length > 0 ? english : voices;

    const scoreLeadVoice = (v: SpeechSynthesisVoice): number => {
      const lang = v.lang.toLowerCase();
      const name = v.name.toLowerCase();
      let score = 0;
      if (lang === 'en-gb') score += 30;
      else if (lang.startsWith('en-gb') || lang === 'en-ie' || lang === 'en-au') score += 20;
      else if (lang.startsWith('en-us')) score += 12;
      else if (lang.startsWith('en')) score += 8;

      if (/ryan|george|daniel|arthur|oliver|uk english male|british|alan/.test(name)) score += 18;
      if (/natural|online|google/.test(name)) score += 6;
      return score;
    };

    const scoreAnalystVoice = (v: SpeechSynthesisVoice, leadVoice: SpeechSynthesisVoice | null): number => {
      let score = 0;
      if (leadVoice && v.voiceURI !== leadVoice.voiceURI) score += 40;
      const lang = v.lang.toLowerCase();
      const name = v.name.toLowerCase();
      if (lang.startsWith('en-gb') || lang === 'en-ie' || lang === 'en-au') score += 20;
      else if (lang.startsWith('en-us')) score += 15;
      else if (lang.startsWith('en')) score += 8;

      if (/sonia|libby|hazel|david|mark|guy|uk english female|kate|martha|serena/.test(name)) {
        score += 12;
      }
      if (/natural|online|google/.test(name)) score += 5;
      return score;
    };

    const explicitLead = findByName(this.settings.leadVoiceName);
    const sortedForLead = [...pool].sort((a, b) => scoreLeadVoice(b) - scoreLeadVoice(a));
    const lead = explicitLead ?? sortedForLead[0] ?? null;

    const explicitAnalyst = findByName(this.settings.analystVoiceName);
    const sortedForAnalyst = [...pool].sort(
      (a, b) => scoreAnalystVoice(b, lead) - scoreAnalystVoice(a, lead)
    );
    const analyst = explicitAnalyst ?? sortedForAnalyst[0] ?? lead;

    return { lead, analyst };
  }

  private computeSpeechParams(segment: CommentarySegment): { rate: number; pitch: number } {
    const exc = Math.max(1, Math.min(10, segment.excitement || 5));
    const norm = (exc - 1) / 9; // 0..1
    const speedBoost = this.matchSpeed >= 6 ? Math.min(0.12, (this.matchSpeed - 5) * 0.015) : 0;

    if (segment.speaker === 'analyst') {
      // Measured, authoritative, slightly deeper Color Commentator voice
      const rate = Math.min(1.16, 0.98 + norm * 0.08 + speedBoost * 0.5);
      const pitch = 0.86 + norm * 0.08;
      return { rate, pitch };
    }

    // Play-by-Play Lead Commentator: calm midfield (1.05 / 0.98) -> thrilling goal/scramble (1.35 / 1.26)
    const rate = Math.min(1.45, 1.05 + norm * 0.3 + speedBoost);
    const pitch = 0.98 + norm * 0.28;
    return { rate, pitch };
  }

  /* ==========================================================================
   * PROVIDER 1: ZERO-CONFIG WEB SPEECH API (`window.speechSynthesis`)
   * ========================================================================== */

  private playViaWebSpeech(
    segment: CommentarySegment,
    spans: WordSpan[],
    gen: number
  ): Promise<void> {
    if (
      typeof window === 'undefined' ||
      !('speechSynthesis' in window) ||
      typeof SpeechSynthesisUtterance === 'undefined'
    ) {
      return this.playSilentTimedWords(segment, spans, gen);
    }

    return new Promise<void>((resolve) => {
      const utterance = new SpeechSynthesisUtterance(segment.text);
      const { lead, analyst } = this.resolveVoices();
      const chosenVoice = segment.speaker === 'analyst' ? analyst : lead;
      if (chosenVoice) {
        utterance.voice = chosenVoice;
        utterance.lang = chosenVoice.lang || 'en-GB';
      } else {
        utterance.lang = 'en-GB';
      }

      const { rate, pitch } = this.computeSpeechParams(segment);
      utterance.rate = rate;
      utterance.pitch = pitch;
      utterance.volume = Math.max(0, Math.min(1, this.settings.voiceVolume));

      const words = spans.map((s) => s.word);
      let sawNativeBoundary = false;
      let finished = false;
      const startedAt = Date.now();

      // Estimated duration for timer-based fallback word tracking
      const wordsPerSec = (155 / 60) * rate;
      const estimatedDurationMs = Math.max(
        900,
        Math.round((Math.max(1, words.length) / wordsPerSec) * 1000)
      );

      const finish = () => {
        if (finished) return;
        finished = true;
        this.clearActiveTimers();
        if (gen === this.playbackGeneration && words.length > 0) {
          this.emitState({
            speaking: true,
            ducked: this.ducked,
            segment,
            activeWordIndex: words.length - 1,
            charIndex: segment.text.length,
            words,
          });
        }
        resolve();
      };

      utterance.onboundary = (event: SpeechSynthesisEvent) => {
        if (finished || gen !== this.playbackGeneration) return;
        if (typeof event.charIndex === 'number' && event.charIndex >= 0) {
          sawNativeBoundary = true;
          const idx = findWordIndexByChar(spans, event.charIndex);
          this.emitState({
            speaking: true,
            ducked: this.ducked,
            segment,
            activeWordIndex: idx,
            charIndex: event.charIndex,
            words,
          });
        }
      };

      utterance.onend = finish;
      utterance.onerror = finish;

      // Fallback timer keeps word highlighting gliding smoothly if voice omits `onboundary`
      if (typeof window !== 'undefined' && words.length > 1) {
        this.activeTimer = window.setInterval(() => {
          if (finished || gen !== this.playbackGeneration || sawNativeBoundary) return;
          const elapsed = Date.now() - startedAt;
          const progress = Math.min(0.98, elapsed / estimatedDurationMs);
          const idx = findWordIndexByProgress(spans, progress);
          if (idx !== this.speechState.activeWordIndex) {
            this.emitState({
              speaking: true,
              ducked: this.ducked,
              segment,
              activeWordIndex: idx,
              charIndex: spans[idx]?.start ?? 0,
              words,
            });
          }
        }, 70);

        // Safety watchdog prevents Chromium speechSynthesis hang bugs
        this.activeSafetyTimer = window.setTimeout(() => {
          if (!finished && gen === this.playbackGeneration) {
            try {
              window.speechSynthesis.cancel();
            } catch {
              // ignore
            }
            finish();
          }
        }, Math.max(9000, estimatedDurationMs * 2.6 + 3000));
      }

      try {
        // Cancel any stale Chrome engine state before speaking next utterance
        window.speechSynthesis.speak(utterance);
      } catch {
        finish();
      }
    });
  }

  /**
   * Graceful fallback for environments without `speechSynthesis`.
   */
  private playSilentTimedWords(
    segment: CommentarySegment,
    spans: WordSpan[],
    gen: number
  ): Promise<void> {
    const words = spans.map((s) => s.word);
    const { rate } = this.computeSpeechParams(segment);
    const durationMs = Math.max(850, Math.round((Math.max(1, words.length) / ((160 / 60) * rate)) * 1000));

    return new Promise<void>((resolve) => {
      const startedAt = Date.now();
      this.activeTimer = window.setInterval(() => {
        if (gen !== this.playbackGeneration) {
          this.clearActiveTimers();
          resolve();
          return;
        }
        const progress = (Date.now() - startedAt) / durationMs;
        if (progress >= 1) {
          this.clearActiveTimers();
          resolve();
          return;
        }
        const idx = findWordIndexByProgress(spans, progress);
        if (idx !== this.speechState.activeWordIndex) {
          this.emitState({
            speaking: true,
            ducked: this.ducked,
            segment,
            activeWordIndex: idx,
            charIndex: spans[idx]?.start ?? 0,
            words,
          });
        }
      }, 75);
    });
  }

  /* ==========================================================================
   * PROVIDER 2: NEURAL TTS HOOKS (OpenAI / ElevenLabs / Local Piper-Kokoro)
   * ========================================================================== */

  private getPhraseCacheKey(provider: TtsProvider, segment: CommentarySegment): string {
    const excBucket = Math.round(Math.max(1, Math.min(10, segment.excitement || 5)) / 2);
    return `${provider}:${segment.speaker}:${excBucket}:${segment.text.trim().toLowerCase()}`;
  }

  private getCachedPhraseUrl(key: string): string | null {
    const url = this.phraseAudioCache.get(key);
    if (!url) return null;
    // Promote LRU
    this.phraseAudioCache.delete(key);
    this.phraseAudioCache.set(key, url);
    return url;
  }

  private putCachedPhraseUrl(key: string, blobUrl: string): void {
    this.phraseAudioCache.delete(key);
    this.phraseAudioCache.set(key, blobUrl);
    while (this.phraseAudioCache.size > MAX_PHRASE_CACHE) {
      const oldestKey = this.phraseAudioCache.keys().next().value;
      if (!oldestKey) break;
      const oldUrl = this.phraseAudioCache.get(oldestKey);
      this.phraseAudioCache.delete(oldestKey);
      if (oldUrl && oldUrl.startsWith('blob:')) {
        try {
          URL.revokeObjectURL(oldUrl);
        } catch {
          // ignore
        }
      }
    }
  }

  private async tryPlayNeuralTts(
    segment: CommentarySegment,
    spans: WordSpan[],
    gen: number
  ): Promise<boolean> {
    const provider = this.settings.ttsProvider;
    if (provider === 'webspeech') return false;

    if ((provider === 'openai' || provider === 'elevenlabs') && !this.settings.apiKey.trim()) {
      return false;
    }
    if (provider === 'local' && !this.settings.localEndpoint.trim()) {
      return false;
    }

    const cacheKey = this.getPhraseCacheKey(provider, segment);
    let audioUrl = this.getCachedPhraseUrl(cacheKey);

    if (!audioUrl) {
      const blob = await this.fetchNeuralAudioBlob(provider, segment);
      if (!blob || blob.size < 128 || gen !== this.playbackGeneration) {
        return false;
      }
      audioUrl = URL.createObjectURL(blob);
      this.putCachedPhraseUrl(cacheKey, audioUrl);
    }

    if (gen !== this.playbackGeneration) return true;

    return this.playAudioUrlWithWordSync(audioUrl, segment, spans, gen);
  }

  private async fetchNeuralAudioBlob(
    provider: TtsProvider,
    segment: CommentarySegment
  ): Promise<Blob | null> {
    const controller = new AbortController();
    this.activeAbortController = controller;
    const timeout = setTimeout(() => controller.abort(), NEURAL_FETCH_TIMEOUT_MS);

    try {
      const { rate } = this.computeSpeechParams(segment);

      if (provider === 'openai') {
        const res = await fetch('https://api.openai.com/v1/audio/speech', {
          method: 'POST',
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.settings.apiKey.trim()}`,
          },
          body: JSON.stringify({
            model: 'tts-1',
            input: segment.text,
            voice: segment.speaker === 'lead' ? 'fable' : 'onyx',
            speed: Math.max(0.75, Math.min(1.4, Number(rate.toFixed(2)))),
            response_format: 'mp3',
          }),
        });
        if (!res.ok) return null;
        return await res.blob();
      }

      if (provider === 'elevenlabs') {
        // Distinct British broadcast voices: Daniel (Play-by-Play) vs George (Color Analyst)
        const voiceId =
          segment.speaker === 'lead' ? 'onwK4e9ZLuTAKqWW03F9' : 'JBFqnCBsd6RMkjVDRZzb';
        const stability = segment.speaker === 'lead' ? Math.max(0.28, 0.62 - segment.excitement * 0.03) : 0.65;
        const style = segment.speaker === 'lead' ? Math.min(0.85, 0.2 + segment.excitement * 0.065) : 0.25;

        const res = await fetch(
          `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream?optimize_streaming_latency=3`,
          {
            method: 'POST',
            signal: controller.signal,
            headers: {
              'Content-Type': 'application/json',
              Accept: 'audio/mpeg',
              'xi-api-key': this.settings.apiKey.trim(),
            },
            body: JSON.stringify({
              text: segment.text,
              model_id: 'eleven_turbo_v2_5',
              voice_settings: {
                stability,
                similarity_boost: 0.78,
                style,
              },
            }),
          }
        );
        if (!res.ok) return null;
        return await res.blob();
      }

      if (provider === 'local') {
        const endpoint = this.settings.localEndpoint.trim();
        const isOpenAiCompat = /\/audio\/speech\/?$/i.test(endpoint);
        const body = isOpenAiCompat
          ? {
              model: 'kokoro',
              input: segment.text,
              voice: segment.speaker === 'lead' ? 'bm_george' : 'bm_lewis',
              speed: Number(rate.toFixed(2)),
            }
          : {
              text: segment.text,
              speaker: segment.speaker,
              voice:
                segment.speaker === 'lead'
                  ? 'en_GB-alan-medium'
                  : 'en_GB-northern_english_male-medium',
              speed: Number(rate.toFixed(2)),
              excitement: segment.excitement,
            };

        const res = await fetch(endpoint, {
          method: 'POST',
          signal: controller.signal,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) return null;
        return await res.blob();
      }

      return null;
    } catch {
      return null;
    } finally {
      clearTimeout(timeout);
      if (this.activeAbortController === controller) {
        this.activeAbortController = null;
      }
    }
  }

  private playAudioUrlWithWordSync(
    audioUrl: string,
    segment: CommentarySegment,
    spans: WordSpan[],
    gen: number
  ): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      if (typeof Audio === 'undefined') {
        resolve(false);
        return;
      }

      const audio = new Audio(audioUrl);
      audio.volume = Math.max(0, Math.min(1, this.settings.voiceVolume));
      this.activeAudioEl = audio;
      const words = spans.map((s) => s.word);

      let settled = false;
      const done = (ok: boolean) => {
        if (settled) return;
        settled = true;
        this.clearActiveTimers();
        if (this.activeAudioEl === audio) {
          this.activeAudioEl = null;
        }
        resolve(ok);
      };

      audio.onended = () => done(true);
      audio.onerror = () => done(false);

      if (typeof window !== 'undefined' && words.length > 0) {
        this.activeTimer = window.setInterval(() => {
          if (settled || gen !== this.playbackGeneration) return;
          if (audio.duration && Number.isFinite(audio.duration) && audio.duration > 0) {
            const progress = Math.min(1, audio.currentTime / audio.duration);
            const idx = findWordIndexByProgress(spans, progress);
            if (idx !== this.speechState.activeWordIndex) {
              this.emitState({
                speaking: true,
                ducked: this.ducked,
                segment,
                activeWordIndex: idx,
                charIndex: spans[idx]?.start ?? 0,
                words,
              });
            }
          }
        }, 55);
      }

      void audio.play().catch(() => {
        done(false);
      });
    });
  }

  /* ==========================================================================
   * BROADCAST VOICE TEST (LEAD + ANALYST DEMO)
   * ========================================================================== */

  public async testVoice(settings: AudioSettings): Promise<void> {
    const previousVoiceEnabled = this.settings.voiceEnabled;
    this.configure({ ...settings, voiceEnabled: true });
    this.stop();

    const demoLead: CommentarySegment = {
      id: `test-lead-${Date.now()}`,
      speaker: 'lead',
      text: 'Brilliant through ball into the box — strikes it first time — WHAT A GOAL into the top corner!',
      excitement: 9,
      teamSide: 'home',
      flashMode: 'flash-goal',
    };

    const demoAnalyst: CommentarySegment = {
      id: `test-analyst-${Date.now()}`,
      speaker: 'analyst',
      text: 'Superb tactical movement off the ball there. The full-back was pulled out of shape and they punished it ruthlessly.',
      excitement: 5,
      teamSide: 'home',
      flashMode: 'none',
    };

    const waitLead = new Promise<void>((resolve) => {
      this.queue.push({
        segment: demoLead,
        priority: 100,
        enqueuedAt: Date.now(),
        resolveDone: resolve,
      });
    });

    const waitAnalyst = new Promise<void>((resolve) => {
      this.queue.push({
        segment: demoAnalyst,
        priority: 90,
        enqueuedAt: Date.now(),
        resolveDone: resolve,
      });
    });

    void this.processQueue();
    await Promise.all([waitLead, waitAnalyst]);

    // Restore original voiceEnabled flag cleanly
    this.settings = { ...settings, voiceEnabled: previousVoiceEnabled };
  }
}

export const commentaryAudioEngine: ExtendedCommentaryAudioService =
  new BroadcastCommentaryAudioEngine();

export function subscribeSpeechState(listener: (state: SpeechSyncState) => void): () => void {
  return commentaryAudioEngine.subscribeSpeechState(listener);
}

export function getAvailableVoices(): SpeechSynthesisVoice[] {
  return commentaryAudioEngine.getAvailableVoices();
}

export default commentaryAudioEngine;
