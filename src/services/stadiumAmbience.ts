/**
 * Procedural Web Audio API Stadium Soundscape Engine for CM 01/02 — Season 2026/27.
 * 100% offline procedural synthesis (zero external mp3 dependencies):
 *  - Continuous stereo pink/brown noise through animated lowpass & bandpass crowd filters
 *  - Attendance-scaled stadium cauldron density
 *  - Dynamic excitement response (1..10): rising tension in final third & massive goal roar
 *  - Synthesized match SFX: dual-tone AM-flutter referee pea-whistle, goal roar eruption,
 *    woodwork clang + crowd gasp, save gasp, leather ball kick thump
 *  - Automatic -8 dB broadcast ducking (120ms attack / 350ms release) synced to commentary
 */

import type { AudioSettings, MatchEvent } from '../types/game';
import type { StadiumAmbienceService } from '../types/contracts';

/** Exact -8 dB linear gain factor (~0.3981) */
const DUCK_GAIN_LINEAR = Math.pow(10, -8 / 20);
const DUCK_ATTACK_SEC = 0.12;
const DUCK_RELEASE_SEC = 0.35;

export interface ExtendedStadiumAmbienceService extends StadiumAmbienceService {
  setDucking: (ducked: boolean) => void;
  isDucked: () => boolean;
  isRunning: () => boolean;
  unlock: () => void;
}

class ProceduralStadiumAmbience implements ExtendedStadiumAmbienceService {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private duckGain: GainNode | null = null;
  private excitementGain: GainNode | null = null;
  private crowdLowpass: BiquadFilterNode | null = null;
  private crowdBandpass: BiquadFilterNode | null = null;
  private rumbleGain: GainNode | null = null;
  private whistleBusGain: GainNode | null = null;

  private pinkSource: AudioBufferSourceNode | null = null;
  private brownSource: AudioBufferSourceNode | null = null;
  private lfoOsc: OscillatorNode | null = null;
  private lfoGain: GainNode | null = null;

  private pinkBuffer: AudioBuffer | null = null;
  private brownBuffer: AudioBuffer | null = null;

  private running = false;
  private ducked = false;
  private crowdEnabled = true;
  private crowdVolume = 0.35;
  private attendanceFactor = 0.85;
  private currentExcitement = 3;
  private decayTimer: number | null = null;
  private unlockBound = false;

  private readonly handleUserGestureUnlock = (): void => {
    this.unlock();
  };

  private getAudioContextCtor(): typeof AudioContext | null {
    if (typeof window === 'undefined') return null;
    const w = window as unknown as {
      AudioContext?: typeof AudioContext;
      webkitAudioContext?: typeof AudioContext;
    };
    return w.AudioContext ?? w.webkitAudioContext ?? null;
  }

  private ensureContext(): AudioContext | null {
    if (this.ctx && this.ctx.state !== 'closed') {
      return this.ctx;
    }
    const Ctor = this.getAudioContextCtor();
    if (!Ctor) return null;

    try {
      const ctx = new Ctor();
      this.ctx = ctx;

      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.value = -12;
      compressor.knee.value = 18;
      compressor.ratio.value = 6;
      compressor.attack.value = 0.005;
      compressor.release.value = 0.18;
      compressor.connect(ctx.destination);

      const masterGain = ctx.createGain();
      masterGain.gain.value = this.effectiveMasterVolume();
      masterGain.connect(compressor);
      this.masterGain = masterGain;

      const duckGain = ctx.createGain();
      duckGain.gain.value = this.ducked ? DUCK_GAIN_LINEAR : 1.0;
      duckGain.connect(masterGain);
      this.duckGain = duckGain;

      // Whistle bus bypasses full crowd ducking (attenuates only slightly) so ref whistles stay audible
      const whistleBus = ctx.createGain();
      whistleBus.gain.value = 0.85;
      whistleBus.connect(masterGain);
      this.whistleBusGain = whistleBus;

      const excitementGain = ctx.createGain();
      excitementGain.gain.value = 0.5;
      excitementGain.connect(duckGain);
      this.excitementGain = excitementGain;

      const crowdLowpass = ctx.createBiquadFilter();
      crowdLowpass.type = 'lowpass';
      crowdLowpass.frequency.value = 680;
      crowdLowpass.Q.value = 0.8;

      const crowdBandpass = ctx.createBiquadFilter();
      crowdBandpass.type = 'peaking';
      crowdBandpass.frequency.value = 520;
      crowdBandpass.Q.value = 1.1;
      crowdBandpass.gain.value = 4.5;

      crowdLowpass.connect(crowdBandpass);
      crowdBandpass.connect(excitementGain);

      this.crowdLowpass = crowdLowpass;
      this.crowdBandpass = crowdBandpass;

      const rumbleGain = ctx.createGain();
      rumbleGain.gain.value = 0.28;
      rumbleGain.connect(excitementGain);
      this.rumbleGain = rumbleGain;

      this.pinkBuffer = this.createPinkNoiseBuffer(ctx, 6);
      this.brownBuffer = this.createBrownNoiseBuffer(ctx, 6);

      if (ctx.state === 'suspended') {
        this.bindUnlockListeners();
      }

      return ctx;
    } catch {
      return null;
    }
  }

  private bindUnlockListeners(): void {
    if (this.unlockBound || typeof window === 'undefined') return;
    this.unlockBound = true;
    const opts: AddEventListenerOptions = { capture: true, passive: true };
    window.addEventListener('pointerdown', this.handleUserGestureUnlock, opts);
    window.addEventListener('keydown', this.handleUserGestureUnlock, opts);
    window.addEventListener('click', this.handleUserGestureUnlock, opts);
  }

  private unbindUnlockListeners(): void {
    if (!this.unlockBound || typeof window === 'undefined') return;
    this.unlockBound = false;
    const opts: AddEventListenerOptions = { capture: true };
    window.removeEventListener('pointerdown', this.handleUserGestureUnlock, opts);
    window.removeEventListener('keydown', this.handleUserGestureUnlock, opts);
    window.removeEventListener('click', this.handleUserGestureUnlock, opts);
  }

  public unlock(): void {
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') {
      void this.ctx
        .resume()
        .then(() => {
          this.unbindUnlockListeners();
        })
        .catch(() => {
          // Will retry on next user gesture
        });
    } else {
      this.unbindUnlockListeners();
    }
  }

  private effectiveMasterVolume(): number {
    if (!this.crowdEnabled) return 0;
    const clamped = Math.max(0, Math.min(1, this.crowdVolume));
    // Gentle perceptual curve with headroom so full volume feels rich without clipping
    return clamped * 0.65;
  }

  /**
   * Seamless 6-second stereo pink noise buffer using Paul Kellet's filter.
   */
  private createPinkNoiseBuffer(ctx: AudioContext, durationSec: number): AudioBuffer {
    const sampleRate = ctx.sampleRate;
    const length = Math.floor(sampleRate * durationSec);
    const buffer = ctx.createBuffer(2, length, sampleRate);
    const fadeSamples = Math.min(Math.floor(sampleRate * 0.25), Math.floor(length / 8));

    for (let ch = 0; ch < 2; ch++) {
      const data = buffer.getChannelData(ch);
      let b0 = 0;
      let b1 = 0;
      let b2 = 0;
      let b3 = 0;
      let b4 = 0;
      let b5 = 0;
      let b6 = 0;

      for (let i = 0; i < length; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        const pink = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
        b6 = white * 0.115926;
        data[i] = pink * 0.045;
      }

      // Crossfade loop seam so looping is 100% click-free
      for (let i = 0; i < fadeSamples; i++) {
        const t = i / fadeSamples;
        const tailIdx = length - fadeSamples + i;
        data[i] = data[i] * t + data[tailIdx] * (1 - t);
      }
    }

    return buffer;
  }

  /**
   * Seamless 6-second stereo brown noise buffer for low stadium terrace rumble.
   */
  private createBrownNoiseBuffer(ctx: AudioContext, durationSec: number): AudioBuffer {
    const sampleRate = ctx.sampleRate;
    const length = Math.floor(sampleRate * durationSec);
    const buffer = ctx.createBuffer(2, length, sampleRate);
    const fadeSamples = Math.min(Math.floor(sampleRate * 0.25), Math.floor(length / 8));

    for (let ch = 0; ch < 2; ch++) {
      const data = buffer.getChannelData(ch);
      let last = 0;
      for (let i = 0; i < length; i++) {
        const white = Math.random() * 2 - 1;
        last = (last + 0.025 * white) / 1.025;
        data[i] = last * 1.65;
      }

      for (let i = 0; i < fadeSamples; i++) {
        const t = i / fadeSamples;
        const tailIdx = length - fadeSamples + i;
        data[i] = data[i] * t + data[tailIdx] * (1 - t);
      }
    }

    return buffer;
  }

  public configure(settings: AudioSettings): void {
    this.crowdEnabled = Boolean(settings.crowdEnabled);
    this.crowdVolume = Number.isFinite(settings.crowdVolume)
      ? Math.max(0, Math.min(1, settings.crowdVolume))
      : 0.35;

    if (this.ctx && this.masterGain) {
      const now = this.ctx.currentTime;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.setTargetAtTime(this.effectiveMasterVolume(), now, 0.05);
    }
  }

  public start(attendance = 38000): void {
    const normalized = Math.max(2000, Math.min(90000, attendance));
    // Logarithmic scaling: 3,000 -> ~0.58, 35,000 -> ~0.92, 80,000 -> ~1.12
    this.attendanceFactor = 0.45 + 0.67 * (Math.log10(normalized / 1500) / Math.log10(60));

    const ctx = this.ensureContext();
    if (!ctx || !this.crowdLowpass || !this.rumbleGain || !this.pinkBuffer || !this.brownBuffer) {
      return;
    }

    if (ctx.state === 'suspended') {
      void ctx.resume().catch(() => {
        this.bindUnlockListeners();
      });
    }

    if (this.running) {
      this.applyExcitementCurve(this.currentExcitement, 0.4);
      return;
    }

    this.running = true;
    const now = ctx.currentTime;

    // Continuous stereo pink noise bed (crowd voices & terrace wash)
    const pinkSource = ctx.createBufferSource();
    pinkSource.buffer = this.pinkBuffer;
    pinkSource.loop = true;
    pinkSource.connect(this.crowdLowpass);
    pinkSource.start(now);
    this.pinkSource = pinkSource;

    // Continuous stereo brown noise bed (low stadium bowl resonance)
    const brownLowpass = ctx.createBiquadFilter();
    brownLowpass.type = 'lowpass';
    brownLowpass.frequency.value = 175;
    brownLowpass.connect(this.rumbleGain);

    const brownSource = ctx.createBufferSource();
    brownSource.buffer = this.brownBuffer;
    brownSource.loop = true;
    brownSource.connect(brownLowpass);
    brownSource.start(now);
    this.brownSource = brownSource;

    // Slow organic LFO breathing across the crowd filter so ambience feels alive
    const lfoOsc = ctx.createOscillator();
    lfoOsc.type = 'sine';
    lfoOsc.frequency.value = 0.14;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 95;
    lfoOsc.connect(lfoGain);
    lfoGain.connect(this.crowdLowpass.frequency);
    lfoOsc.start(now);
    this.lfoOsc = lfoOsc;
    this.lfoGain = lfoGain;

    // Smooth fade-in
    if (this.excitementGain) {
      this.excitementGain.gain.cancelScheduledValues(now);
      this.excitementGain.gain.setValueAtTime(0.01, now);
    }
    this.currentExcitement = 3;
    this.applyExcitementCurve(3, 0.75);
  }

  public stop(): void {
    this.running = false;
    if (this.decayTimer !== null && typeof window !== 'undefined') {
      window.clearTimeout(this.decayTimer);
      this.decayTimer = null;
    }

    if (this.ctx && this.excitementGain) {
      const now = this.ctx.currentTime;
      this.excitementGain.gain.cancelScheduledValues(now);
      this.excitementGain.gain.setTargetAtTime(0.0001, now, 0.08);
    }

    const oldPink = this.pinkSource;
    const oldBrown = this.brownSource;
    const oldLfo = this.lfoOsc;
    this.pinkSource = null;
    this.brownSource = null;
    this.lfoOsc = null;
    this.lfoGain = null;

    if (typeof window !== 'undefined') {
      window.setTimeout(() => {
        try {
          oldPink?.stop();
          oldPink?.disconnect();
        } catch {
          // ignore already stopped
        }
        try {
          oldBrown?.stop();
          oldBrown?.disconnect();
        } catch {
          // ignore
        }
        try {
          oldLfo?.stop();
          oldLfo?.disconnect();
        } catch {
          // ignore
        }
      }, 280);
    } else {
      try {
        oldPink?.stop();
        oldBrown?.stop();
        oldLfo?.stop();
      } catch {
        // ignore
      }
    }

    this.setDucking(false);
  }

  public isRunning(): boolean {
    return this.running;
  }

  public isDucked(): boolean {
    return this.ducked;
  }

  /**
   * Automatic -8 dB broadcast ducking when any commentator speaks:
   *  - Ducked: smoothly ramps to ~0.398 (-8 dB) over 120ms
   *  - Unducked: smoothly restores to 1.0 over 350ms
   */
  public setDucking(ducked: boolean): void {
    this.ducked = ducked;
    if (!this.ctx || !this.duckGain) return;

    const now = this.ctx.currentTime;
    const target = ducked ? DUCK_GAIN_LINEAR : 1.0;
    const duration = ducked ? DUCK_ATTACK_SEC : DUCK_RELEASE_SEC;

    this.duckGain.gain.cancelScheduledValues(now);
    this.duckGain.gain.setValueAtTime(this.duckGain.gain.value, now);
    this.duckGain.gain.linearRampToValueAtTime(target, now + duration);
  }

  public setExcitement(level: number): void {
    const clamped = Math.max(1, Math.min(10, Math.round(level)));
    this.currentExcitement = clamped;
    this.applyExcitementCurve(clamped, clamped >= 8 ? 0.22 : 0.45);

    if (typeof window !== 'undefined') {
      if (this.decayTimer !== null) {
        window.clearTimeout(this.decayTimer);
      }
      if (clamped > 3) {
        const holdMs = clamped >= 10 ? 4400 : clamped >= 8 ? 2600 : 1800;
        this.decayTimer = window.setTimeout(() => {
          this.decayTimer = null;
          if (this.running) {
            const nextLevel = Math.max(3, this.currentExcitement - 2);
            this.currentExcitement = nextLevel;
            this.applyExcitementCurve(nextLevel, 1.4);
          }
        }, holdMs);
      }
    }
  }

  private applyExcitementCurve(level: number, timeConstantSec: number): void {
    if (!this.ctx || !this.crowdLowpass || !this.crowdBandpass || !this.excitementGain || !this.rumbleGain) {
      return;
    }

    const now = this.ctx.currentTime;
    const norm = (Math.max(1, Math.min(10, level)) - 1) / 9; // 0..1

    // Lowpass opens upward smoothly as play enters the final third & explodes on goals
    const lpFreq =
      level >= 10
        ? 3400
        : level >= 7
          ? 1250 + (level - 7) * 420
          : 520 + norm * 900;

    // Bandpass presence peak rises from muffled chatter (420Hz) to electric cheer (960Hz)
    const bpFreq = 420 + norm * 540;
    const bpGain = 3.5 + norm * 5.0;

    // Overall crowd swell scaled by stadium attendance
    const baseGain =
      (level >= 10 ? 1.88 : level >= 8 ? 1.32 + (level - 8) * 0.2 : 0.48 + norm * 0.72) *
      this.attendanceFactor;

    const rumbleTarget = (0.22 + norm * 0.45 + (level >= 9 ? 0.25 : 0)) * this.attendanceFactor;

    this.crowdLowpass.frequency.setTargetAtTime(lpFreq, now, timeConstantSec);
    this.crowdBandpass.frequency.setTargetAtTime(bpFreq, now, timeConstantSec);
    this.crowdBandpass.gain.setTargetAtTime(bpGain, now, timeConstantSec);
    this.excitementGain.gain.setTargetAtTime(baseGain, now, timeConstantSec);
    this.rumbleGain.gain.setTargetAtTime(rumbleTarget, now, timeConstantSec);
  }

  public reactToEvent(event: MatchEvent): void {
    if (!event) return;
    if (!this.crowdEnabled) return;

    const ctx = this.ensureContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      void ctx.resume().catch(() => {
        this.bindUnlockListeners();
      });
    }

    this.setExcitement(event.excitementLevel ?? 4);

    switch (event.type) {
      case 'kickoff':
        this.triggerPeaWhistle([{ offset: 0, duration: 0.4 }]);
        this.triggerCrowdWave(1.3, 0.55, 1100);
        break;

      case 'halftime':
        this.triggerPeaWhistle([
          { offset: 0, duration: 0.18 },
          { offset: 0.32, duration: 0.5 },
        ]);
        this.triggerCrowdWave(1.8, 0.5, 950);
        break;

      case 'fulltime':
        this.triggerPeaWhistle([
          { offset: 0, duration: 0.16 },
          { offset: 0.28, duration: 0.16 },
          { offset: 0.58, duration: 0.65 },
        ]);
        this.triggerCrowdWave(3.2, 0.85, 1600);
        break;

      case 'foul':
        this.triggerPeaWhistle([{ offset: 0, duration: 0.28 }]);
        break;

      case 'yellow_card':
        this.triggerPeaWhistle([{ offset: 0, duration: 0.34 }]);
        this.triggerCrowdGasp(1.1, 0.48, 560, 390);
        break;

      case 'red_card':
        this.triggerPeaWhistle([{ offset: 0, duration: 0.46 }]);
        this.triggerCrowdGasp(1.9, 0.8, 620, 340);
        break;

      case 'penalty_awarded':
        this.triggerPeaWhistle([{ offset: 0, duration: 0.44 }]);
        this.triggerCrowdGasp(1.7, 0.85, 760, 420);
        break;

      case 'goal':
      case 'penalty_scored':
        this.triggerKickThump(0.35);
        this.triggerGoalRoar();
        break;

      case 'woodwork':
        this.triggerWoodworkClang();
        this.triggerCrowdGasp(1.6, 0.85, 720, 430);
        break;

      case 'shot_saved':
      case 'penalty_missed':
        this.triggerKickThump(0.28);
        this.triggerCrowdGasp(1.45, 0.72, 680, 420);
        break;

      case 'chance':
        this.triggerCrowdWave(1.1, 0.42, 1350);
        break;

      case 'shot_missed':
        this.triggerKickThump(0.25);
        this.triggerCrowdGasp(1.05, 0.45, 580, 390);
        break;

      case 'free_kick':
      case 'corner':
        this.triggerKickThump(0.22);
        this.triggerCrowdWave(0.95, 0.32, 1050);
        break;

      case 'tackle':
        this.triggerKickThump(0.16);
        break;

      case 'substitution':
        this.triggerCrowdWave(1.2, 0.35, 1200);
        break;

      default:
        break;
    }
  }

  /**
   * Authentic dual-tone referee pea-whistle (~2.8kHz - 3.3kHz with rapid 34Hz AM pea flutter).
   */
  private triggerPeaWhistle(blasts: Array<{ offset: number; duration: number }>): void {
    const ctx = this.ctx;
    const out = this.whistleBusGain;
    if (!ctx || !out) return;

    const baseTime = ctx.currentTime + 0.01;

    for (const blast of blasts) {
      const start = baseTime + blast.offset;
      const end = start + blast.duration;

      const osc1 = ctx.createOscillator();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(2840, start);
      osc1.frequency.linearRampToValueAtTime(2980, start + 0.05);
      osc1.frequency.setValueAtTime(2940, Math.max(start + 0.05, end - 0.06));
      osc1.frequency.linearRampToValueAtTime(2760, end);

      const osc2 = ctx.createOscillator();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(3220, start);
      osc2.frequency.linearRampToValueAtTime(3360, start + 0.05);
      osc2.frequency.linearRampToValueAtTime(3120, end);

      // Rapid pea-spin AM flutter (~34 Hz)
      const flutterLfo = ctx.createOscillator();
      flutterLfo.type = 'sine';
      flutterLfo.frequency.value = 34;

      const flutterDepth = ctx.createGain();
      flutterDepth.gain.value = 0.055;

      const amGain = ctx.createGain();
      amGain.gain.setValueAtTime(0.16, start);
      flutterLfo.connect(flutterDepth);
      flutterDepth.connect(amGain.gain);

      // Crisp whistle envelope
      const env = ctx.createGain();
      env.gain.setValueAtTime(0.0001, start);
      env.gain.linearRampToValueAtTime(0.95, start + 0.016);
      env.gain.setValueAtTime(0.88, Math.max(start + 0.02, end - 0.04));
      env.gain.exponentialRampToValueAtTime(0.0001, end + 0.02);

      const osc2Mix = ctx.createGain();
      osc2Mix.gain.value = 0.28;

      const whistleBand = ctx.createBiquadFilter();
      whistleBand.type = 'bandpass';
      whistleBand.frequency.value = 3020;
      whistleBand.Q.value = 2.6;

      osc1.connect(whistleBand);
      osc2.connect(osc2Mix);
      osc2Mix.connect(whistleBand);
      whistleBand.connect(amGain);
      amGain.connect(env);
      env.connect(out);

      osc1.start(start);
      osc2.start(start);
      flutterLfo.start(start);

      const stopAt = end + 0.04;
      osc1.stop(stopAt);
      osc2.stop(stopAt);
      flutterLfo.stop(stopAt);
    }
  }

  /**
   * Massive 4.2-second multi-layered stadium goal eruption roar + sub-bass terrace rumble.
   */
  private triggerGoalRoar(): void {
    const ctx = this.ctx;
    const out = this.duckGain;
    if (!ctx || !out || !this.pinkBuffer || !this.brownBuffer) return;

    const now = ctx.currentTime;
    const duration = 4.3;

    // Layer 1: Explosive stereo high-energy roar
    const roarSrc = ctx.createBufferSource();
    roarSrc.buffer = this.pinkBuffer;
    roarSrc.loop = true;

    const roarFilter = ctx.createBiquadFilter();
    roarFilter.type = 'bandpass';
    roarFilter.frequency.setValueAtTime(680, now);
    roarFilter.frequency.exponentialRampToValueAtTime(2150, now + 0.35);
    roarFilter.frequency.exponentialRampToValueAtTime(1320, now + 2.4);
    roarFilter.frequency.exponentialRampToValueAtTime(740, now + duration);
    roarFilter.Q.value = 0.65;

    const roarEnv = ctx.createGain();
    const peak = 1.65 * this.attendanceFactor;
    roarEnv.gain.setValueAtTime(0.001, now);
    roarEnv.gain.linearRampToValueAtTime(peak, now + 0.24);
    roarEnv.gain.setValueAtTime(peak * 0.92, now + 1.5);
    roarEnv.gain.exponentialRampToValueAtTime(0.001, now + duration);

    roarSrc.connect(roarFilter);
    roarFilter.connect(roarEnv);
    roarEnv.connect(out);

    // Layer 2: Deep terrace stomp & low-frequency crowd roar
    const subSrc = ctx.createBufferSource();
    subSrc.buffer = this.brownBuffer;
    subSrc.loop = true;

    const subFilter = ctx.createBiquadFilter();
    subFilter.type = 'lowpass';
    subFilter.frequency.value = 210;

    const subEnv = ctx.createGain();
    subEnv.gain.setValueAtTime(0.001, now);
    subEnv.gain.linearRampToValueAtTime(0.95 * this.attendanceFactor, now + 0.3);
    subEnv.gain.exponentialRampToValueAtTime(0.001, now + duration);

    subSrc.connect(subFilter);
    subFilter.connect(subEnv);
    subEnv.connect(out);

    roarSrc.start(now);
    subSrc.start(now);
    roarSrc.stop(now + duration + 0.05);
    subSrc.stop(now + duration + 0.05);
  }

  /**
   * Booming crowd "OOOOH!" gasp for woodwork, big saves, missed penalties, and red cards.
   */
  private triggerCrowdGasp(
    durationSec: number,
    intensity: number,
    startFreq: number,
    endFreq: number
  ): void {
    const ctx = this.ctx;
    const out = this.duckGain;
    if (!ctx || !out || !this.pinkBuffer) return;

    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.pinkBuffer;
    src.loop = true;

    const formant = ctx.createBiquadFilter();
    formant.type = 'bandpass';
    formant.frequency.setValueAtTime(startFreq, now);
    formant.frequency.exponentialRampToValueAtTime(Math.max(180, endFreq), now + durationSec * 0.85);
    formant.Q.value = 1.65;

    const env = ctx.createGain();
    const peak = intensity * this.attendanceFactor;
    env.gain.setValueAtTime(0.001, now);
    env.gain.linearRampToValueAtTime(peak, now + 0.14);
    env.gain.exponentialRampToValueAtTime(0.001, now + durationSec);

    src.connect(formant);
    formant.connect(env);
    env.connect(out);

    src.start(now);
    src.stop(now + durationSec + 0.05);
  }

  /**
   * Rising stadium applause / anticipation cheer wave.
   */
  private triggerCrowdWave(durationSec: number, intensity: number, peakFreq: number): void {
    const ctx = this.ctx;
    const out = this.duckGain;
    if (!ctx || !out || !this.pinkBuffer) return;

    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.pinkBuffer;
    src.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(peakFreq * 0.6, now);
    filter.frequency.linearRampToValueAtTime(peakFreq, now + durationSec * 0.35);
    filter.frequency.linearRampToValueAtTime(peakFreq * 0.7, now + durationSec);
    filter.Q.value = 0.9;

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.001, now);
    env.gain.linearRampToValueAtTime(intensity * this.attendanceFactor, now + durationSec * 0.25);
    env.gain.exponentialRampToValueAtTime(0.001, now + durationSec);

    src.connect(filter);
    filter.connect(env);
    env.connect(out);

    src.start(now);
    src.stop(now + durationSec + 0.05);
  }

  /**
   * Metallic goalpost / crossbar clang for woodwork events.
   */
  private triggerWoodworkClang(): void {
    const ctx = this.ctx;
    const out = this.whistleBusGain;
    if (!ctx || !out) return;

    const now = ctx.currentTime;
    const partials = [
      { freq: 410, gain: 0.22, decay: 0.28 },
      { freq: 865, gain: 0.14, decay: 0.2 },
      { freq: 1480, gain: 0.08, decay: 0.14 },
    ];

    for (const p of partials) {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(p.freq, now);

      const env = ctx.createGain();
      env.gain.setValueAtTime(0.001, now);
      env.gain.linearRampToValueAtTime(p.gain, now + 0.004);
      env.gain.exponentialRampToValueAtTime(0.0001, now + p.decay);

      osc.connect(env);
      env.connect(out);

      osc.start(now);
      osc.stop(now + p.decay + 0.02);
    }
  }

  /**
   * Subtle low-pass leather-ball kick thump for shots, free kicks, and corners.
   */
  private triggerKickThump(gainLevel: number): void {
    const ctx = this.ctx;
    const out = this.duckGain;
    if (!ctx || !out) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(145, now);
    osc.frequency.exponentialRampToValueAtTime(46, now + 0.095);

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.001, now);
    env.gain.linearRampToValueAtTime(gainLevel, now + 0.006);
    env.gain.exponentialRampToValueAtTime(0.0001, now + 0.11);

    osc.connect(env);
    env.connect(out);

    osc.start(now);
    osc.stop(now + 0.12);
  }
}

export const stadiumAmbience: ExtendedStadiumAmbienceService = new ProceduralStadiumAmbience();

export function setDucking(ducked: boolean): void {
  stadiumAmbience.setDucking(ducked);
}

export default stadiumAmbience;
