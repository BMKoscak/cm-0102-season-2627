import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowDownLeft,
  ArrowDownRight,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowUpLeft,
  ArrowUpRight,
  CircleDot,
  Compass,
  Crosshair,
  ExternalLink,
  RefreshCw,
  RotateCcw,
  Shield,
  Sparkles,
  Swords,
  Users,
  Wand2,
  X,
} from 'lucide-react';
import { calculatePositionRating, getPositionCategory } from '../engine/attributes';
import {
  FORMATIONS,
  applyFormation,
  computeTacticalStrength,
  createDefaultWibWobGrid,
  getZoneCoordinates,
} from '../engine/tactics';
import type { TacticsViewProps } from '../types/contracts';
import type {
  FormationId,
  MoraleLevel,
  Player,
  PositionCode,
  RunArrow,
  TacticalSlot,
  TacticsState,
  TeamInstructions,
  WibWobPosition,
} from '../types/game';

type PitchMode = 'standard' | 'wib' | 'wob';

type SelectionTarget =
  | { kind: 'xi'; slotIndex: number }
  | { kind: 'bench'; benchIndex: number }
  | { kind: 'reserve'; playerId: string };

const FORMATION_ORDER: FormationId[] = [
  '4-4-2',
  '4-1-3-2',
  '4-3-3',
  '3-5-2',
  '4-2-3-1',
  '4-4-2-diamond',
];

const OUTFIELD_POSITIONS: PositionCode[] = [
  'DL',
  'DC',
  'DR',
  'DMC',
  'ML',
  'MC',
  'MR',
  'AMC',
  'FL',
  'FC',
  'FR',
];

const MENTALITY_OPTIONS: Array<{
  value: TeamInstructions['mentality'];
  label: string;
  hint: string;
}> = [
  { value: 'Defending', label: 'Defending', hint: 'Sit deep, protect box, low risk' },
  { value: 'Normal', label: 'Normal', hint: 'Balanced transition & shape' },
  { value: 'Attacking', label: 'Attacking', hint: 'Push full-backs & mids forward' },
  { value: 'Gung Ho', label: 'Gung Ho', hint: 'All-out assault, high exposure' },
];

const PASSING_OPTIONS: Array<{
  value: TeamInstructions['passing'];
  label: string;
  hint: string;
}> = [
  { value: 'Short', label: 'Short', hint: 'Patient possession triangles' },
  { value: 'Mixed', label: 'Mixed', hint: 'Adapt to space & runners' },
  { value: 'Direct', label: 'Direct', hint: 'Fast vertical balls into channels' },
  { value: 'Long Ball', label: 'Long Ball', hint: 'Early aerial supply to forwards' },
];

const TACKLING_OPTIONS: Array<{
  value: TeamInstructions['tackling'];
  label: string;
  hint: string;
}> = [
  { value: 'Easy', label: 'Easy', hint: 'Stay on feet, minimal fouls' },
  { value: 'Normal', label: 'Normal', hint: 'Standard competitive challenges' },
  { value: 'Hard', label: 'Hard', hint: 'Win duels aggressively, card risk' },
];

const RUN_ARROW_VECTORS: Record<RunArrow, { dx: number; dy: number }> = {
  none: { dx: 0, dy: 0 },
  N: { dx: 0, dy: -12 },
  NE: { dx: 9.5, dy: -9.5 },
  E: { dx: 12, dy: 0 },
  SE: { dx: 9.5, dy: 9.5 },
  S: { dx: 0, dy: 12 },
  SW: { dx: -9.5, dy: 9.5 },
  W: { dx: -12, dy: 0 },
  NW: { dx: -9.5, dy: -9.5 },
};

const COMPASS_CELLS: Array<{ arrow: RunArrow; label: string; icon: React.ReactNode }> = [
  { arrow: 'NW', label: 'Forward-Left', icon: <ArrowUpLeft size={13} /> },
  { arrow: 'N', label: 'Forward', icon: <ArrowUp size={13} /> },
  { arrow: 'NE', label: 'Forward-Right', icon: <ArrowUpRight size={13} /> },
  { arrow: 'W', label: 'Cut Left', icon: <ArrowLeft size={13} /> },
  { arrow: 'none', label: 'Hold Position', icon: <CircleDot size={12} /> },
  { arrow: 'E', label: 'Cut Right', icon: <ArrowRight size={13} /> },
  { arrow: 'SW', label: 'Drop Left', icon: <ArrowDownLeft size={13} /> },
  { arrow: 'S', label: 'Drop Deep', icon: <ArrowDown size={13} /> },
  { arrow: 'SE', label: 'Drop Right', icon: <ArrowDownRight size={13} /> },
];

const ZONE_ROW_NAMES = [
  'Opp. Box',
  'Attacking 3rd',
  'Midfield',
  'Defensive 3rd',
  'Own Box',
];

const ZONE_COL_NAMES = ['Left Wing', 'Left Channel', 'Center', 'Right Channel', 'Right Wing'];

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function getPosPillClass(pos: PositionCode): string {
  const cat = getPositionCategory(pos);
  if (cat === 'GK') return 'cm-pos-pill cm-pos-gk';
  if (cat === 'DEF') return 'cm-pos-pill cm-pos-def';
  if (cat === 'MID') return 'cm-pos-pill cm-pos-mid';
  return 'cm-pos-pill cm-pos-fwd';
}

function getSuitabilityColor(rating: number): string {
  if (rating >= 80) return '#4ade80';
  if (rating >= 66) return '#fde047';
  if (rating >= 50) return '#fb923c';
  return '#f87171';
}

function getConditionColor(cond: number): string {
  if (cond >= 85) return '#4ade80';
  if (cond >= 70) return '#a3e635';
  if (cond >= 55) return '#fbbf24';
  return '#f87171';
}

function getMoraleColor(morale: MoraleLevel): string {
  switch (morale) {
    case 'Superb':
      return '#38f2af';
    case 'Very Good':
      return '#4ade80';
    case 'Good':
      return '#93c5fd';
    case 'Okay':
      return '#cbd5e1';
    case 'Poor':
      return '#fbbf24';
    case 'Very Poor':
      return '#f87171';
  }
}

function moraleShort(morale: MoraleLevel): string {
  switch (morale) {
    case 'Superb':
      return 'SUP';
    case 'Very Good':
      return 'V.GD';
    case 'Good':
      return 'GOOD';
    case 'Okay':
      return 'OKAY';
    case 'Poor':
      return 'POOR';
    case 'Very Poor':
      return 'V.PR';
  }
}

function inferPositionFromCoords(x: number, y: number): PositionCode {
  if (y >= 84) return 'GK';
  if (y >= 64) {
    if (x < 28) return 'DL';
    if (x > 72) return 'DR';
    return 'DC';
  }
  if (y >= 54) {
    if (x < 24) return 'ML';
    if (x > 76) return 'MR';
    return 'DMC';
  }
  if (y >= 38) {
    if (x < 26) return 'ML';
    if (x > 74) return 'MR';
    return 'MC';
  }
  if (y >= 26) {
    if (x < 26) return 'FL';
    if (x > 74) return 'FR';
    return 'AMC';
  }
  if (x < 30) return 'FL';
  if (x > 70) return 'FR';
  return 'FC';
}

function getSurname(player: Player | undefined): string {
  if (!player) return 'EMPTY';
  const raw = player.shortName || player.name;
  const parts = raw.trim().split(/\s+/);
  return parts.length > 1 ? parts[parts.length - 1] : raw;
}

export const TacticsView: React.FC<TacticsViewProps> = ({
  club,
  squad,
  tactics,
  isLiveMatch = false,
  onUpdateTactics,
  onAutoPick,
  onSelectPlayer,
}) => {
  const [pitchMode, setPitchMode] = useState<PitchMode>('standard');
  const [activeZone, setActiveZone] = useState<{ row: number; col: number }>({ row: 2, col: 2 });
  const [selectedSlotIndex, setSelectedSlotIndex] = useState<number | null>(null);
  const [swapSelection, setSwapSelection] = useState<SelectionTarget | null>(null);
  const [draggingSlotIndex, setDraggingSlotIndex] = useState<number | null>(null);
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);

  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragOriginRef = useRef<{ startX: number; startY: number; moved: boolean } | null>(null);

  const playerMap = useMemo(() => {
    const map: Record<string, Player> = {};
    for (const p of squad) {
      map[p.id] = p;
    }
    return map;
  }, [squad]);

  const starterIds = useMemo(() => {
    const set = new Set<string>();
    for (const slot of tactics.startingXI) {
      if (slot.playerId) set.add(slot.playerId);
    }
    return set;
  }, [tactics.startingXI]);

  const benchIds = useMemo(() => {
    const set = new Set<string>();
    for (const pid of tactics.bench) {
      if (pid) set.add(pid);
    }
    return set;
  }, [tactics.bench]);

  const reserves = useMemo(() => {
    const posRank: Record<string, number> = { GK: 0, DEF: 1, MID: 2, FWD: 3 };
    return squad
      .filter((p) => !starterIds.has(p.id) && !benchIds.has(p.id))
      .sort((a, b) => {
        const pa = posRank[getPositionCategory(a.positions[0])] ?? 9;
        const pb = posRank[getPositionCategory(b.positions[0])] ?? 9;
        if (pa !== pb) return pa - pb;
        return b.currentAbility - a.currentAbility;
      });
  }, [squad, starterIds, benchIds]);

  const strength = useMemo(
    () => computeTacticalStrength(tactics, playerMap),
    [tactics, playerMap]
  );

  // Baseline default WibWob grid to detect customized cells and support single-zone reset
  const defaultWibWob = useMemo(
    () => createDefaultWibWobGrid(tactics.startingXI),
    [tactics.startingXI]
  );

  const activeZoneKey = `${activeZone.row}-${activeZone.col}`;

  const currentPitchCoords = useMemo<WibWobPosition[]>(() => {
    if (pitchMode === 'standard') {
      return tactics.startingXI.map((s) => ({ x: s.baseX, y: s.baseY }));
    }
    const coords = getZoneCoordinates(
      tactics,
      pitchMode === 'wib',
      activeZone.row,
      activeZone.col
    );
    if (coords && coords.length === tactics.startingXI.length) {
      return coords;
    }
    return tactics.startingXI.map((s) => ({ x: s.baseX, y: s.baseY }));
  }, [pitchMode, tactics, activeZone.row, activeZone.col]);

  const customizedZoneKeys = useMemo(() => {
    const set = new Set<string>();
    if (pitchMode === 'standard') return set;
    const grid = pitchMode === 'wib' ? tactics.wibWobGrid.withBall : tactics.wibWobGrid.withoutBall;
    const defGrid = pitchMode === 'wib' ? defaultWibWob.withBall : defaultWibWob.withoutBall;
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        const key = `${r}-${c}`;
        const cur = grid[key];
        const def = defGrid[key];
        if (!cur || !def || cur.length !== def.length) continue;
        for (let i = 0; i < cur.length; i++) {
          if (Math.abs(cur[i].x - def[i].x) > 1.5 || Math.abs(cur[i].y - def[i].y) > 1.5) {
            set.add(key);
            break;
          }
        }
      }
    }
    return set;
  }, [pitchMode, tactics.wibWobGrid, defaultWibWob]);

  // Helper: swap or assign players between Starting XI, Bench (7 slots), and Reserves
  const commitSwap = useCallback(
    (a: SelectionTarget, b: SelectionTarget) => {
      if (
        a.kind === b.kind &&
        ((a.kind === 'xi' && b.kind === 'xi' && a.slotIndex === b.slotIndex) ||
          (a.kind === 'bench' && b.kind === 'bench' && a.benchIndex === b.benchIndex) ||
          (a.kind === 'reserve' && b.kind === 'reserve' && a.playerId === b.playerId))
      ) {
        return;
      }

      const nextXI: TacticalSlot[] = tactics.startingXI.map((s) => ({ ...s }));
      const nextBench: Array<string | null> = Array.from({ length: 7 }, (_, i) => tactics.bench[i] ?? null);

      const getPid = (t: SelectionTarget): string | null => {
        if (t.kind === 'xi') return nextXI[t.slotIndex]?.playerId ?? null;
        if (t.kind === 'bench') return nextBench[t.benchIndex] ?? null;
        return t.playerId;
      };

      const setPid = (t: SelectionTarget, pid: string | null) => {
        if (t.kind === 'xi') {
          if (nextXI[t.slotIndex]) nextXI[t.slotIndex].playerId = pid;
        } else if (t.kind === 'bench') {
          nextBench[t.benchIndex] = pid;
        }
      };

      const pidA = getPid(a);
      const pidB = getPid(b);

      if (a.kind === 'reserve' && b.kind === 'reserve') {
        return;
      }

      setPid(a, pidB);
      setPid(b, pidA);

      // Deduplicate bench while keeping clean list of up to 7 playerIds
      const xiSet = new Set(nextXI.map((s) => s.playerId).filter(Boolean) as string[]);
      const cleanedBench = nextBench.filter(
        (pid, idx): pid is string =>
          Boolean(pid) && !xiSet.has(pid as string) && nextBench.indexOf(pid) === idx
      );

      onUpdateTactics({
        ...tactics,
        startingXI: nextXI,
        bench: cleanedBench.slice(0, 7),
      });
    },
    [tactics, onUpdateTactics]
  );

  const handleSelectTarget = useCallback(
    (target: SelectionTarget) => {
      if (target.kind === 'xi') {
        setSelectedSlotIndex(target.slotIndex);
      }
      if (!swapSelection) {
        setSwapSelection(target);
        return;
      }
      if (
        swapSelection.kind === target.kind &&
        ((swapSelection.kind === 'xi' && target.kind === 'xi' && swapSelection.slotIndex === target.slotIndex) ||
          (swapSelection.kind === 'bench' && target.kind === 'bench' && swapSelection.benchIndex === target.benchIndex) ||
          (swapSelection.kind === 'reserve' && target.kind === 'reserve' && swapSelection.playerId === target.playerId))
      ) {
        setSwapSelection(null);
        return;
      }
      commitSwap(swapSelection, target);
      setSwapSelection(null);
    },
    [swapSelection, commitSwap]
  );

  const handleRemoveFromBench = useCallback(
    (benchIndex: number, e: React.MouseEvent) => {
      e.stopPropagation();
      const nextBench = tactics.bench.filter((_, idx) => idx !== benchIndex);
      setSwapSelection(null);
      onUpdateTactics({
        ...tactics,
        bench: nextBench,
      });
    },
    [tactics, onUpdateTactics]
  );

  const handleFormationChange = useCallback(
    (formation: FormationId) => {
      const updated = applyFormation(tactics, formation, squad);
      setSwapSelection(null);
      setSelectedSlotIndex(null);
      onUpdateTactics(updated);
    },
    [tactics, squad, onUpdateTactics]
  );

  const handleSetRunArrow = useCallback(
    (slotIndex: number, arrow: RunArrow) => {
      const nextXI = tactics.startingXI.map((slot, idx) =>
        idx === slotIndex ? { ...slot, runArrow: arrow } : slot
      );
      onUpdateTactics({ ...tactics, startingXI: nextXI });
    },
    [tactics, onUpdateTactics]
  );

  const handleSetSlotRole = useCallback(
    (slotIndex: number, roleLabel: PositionCode) => {
      if (slotIndex === 0) return;
      const nextXI = tactics.startingXI.map((slot, idx) =>
        idx === slotIndex ? { ...slot, roleLabel } : slot
      );
      onUpdateTactics({ ...tactics, startingXI: nextXI });
    },
    [tactics, onUpdateTactics]
  );

  const handleUpdateInstructions = useCallback(
    (patch: Partial<TeamInstructions>) => {
      onUpdateTactics({
        ...tactics,
        instructions: {
          ...tactics.instructions,
          ...patch,
        },
      });
    },
    [tactics, onUpdateTactics]
  );

  const handleResetZone = useCallback(() => {
    if (pitchMode === 'standard') return;
    const defArr =
      pitchMode === 'wib'
        ? defaultWibWob.withBall[activeZoneKey]
        : defaultWibWob.withoutBall[activeZoneKey];
    if (!defArr) return;
    const cloned = defArr.map((p) => ({ x: p.x, y: p.y }));
    onUpdateTactics({
      ...tactics,
      wibWobGrid: {
        withBall:
          pitchMode === 'wib'
            ? { ...tactics.wibWobGrid.withBall, [activeZoneKey]: cloned }
            : tactics.wibWobGrid.withBall,
        withoutBall:
          pitchMode === 'wob'
            ? { ...tactics.wibWobGrid.withoutBall, [activeZoneKey]: cloned }
            : tactics.wibWobGrid.withoutBall,
      },
    });
  }, [pitchMode, defaultWibWob, activeZoneKey, tactics, onUpdateTactics]);

  const handleResetAllWibWob = useCallback(() => {
    onUpdateTactics({
      ...tactics,
      wibWobGrid: createDefaultWibWobGrid(tactics.startingXI),
    });
  }, [tactics, onUpdateTactics]);

  // Convert pointer event into 0..100 pitch SVG coordinates
  const pointerToPitch = useCallback((clientX: number, clientY: number): { x: number; y: number } => {
    const svg = svgRef.current;
    if (!svg) return { x: 50, y: 50 };
    const rect = svg.getBoundingClientRect();
    const relX = ((clientX - rect.left) / Math.max(1, rect.width)) * 100;
    const relY = ((clientY - rect.top) / Math.max(1, rect.height)) * 100;
    return { x: relX, y: relY };
  }, []);

  const handleTokenPointerDown = useCallback(
    (slotIndex: number, e: React.PointerEvent<SVGGElement>) => {
      e.stopPropagation();
      setSelectedSlotIndex(slotIndex);

      // GK stays in goal area; allow clicking to select/swap, block dragging out of box
      if (slotIndex === 0) {
        if (swapSelection) {
          handleSelectTarget({ kind: 'xi', slotIndex: 0 });
        }
        return;
      }

      const pt = pointerToPitch(e.clientX, e.clientY);
      dragOriginRef.current = { startX: pt.x, startY: pt.y, moved: false };
      setDraggingSlotIndex(slotIndex);
      setDragPos({
        x: currentPitchCoords[slotIndex]?.x ?? tactics.startingXI[slotIndex].baseX,
        y: currentPitchCoords[slotIndex]?.y ?? tactics.startingXI[slotIndex].baseY,
      });

      try {
        (e.currentTarget as Element).setPointerCapture(e.pointerId);
      } catch {
        // Ignore if pointer capture is unsupported
      }
    },
    [currentPitchCoords, handleSelectTarget, pointerToPitch, swapSelection, tactics.startingXI]
  );

  const handleTokenPointerMove = useCallback(
    (slotIndex: number, e: React.PointerEvent<SVGGElement>) => {
      if (draggingSlotIndex !== slotIndex) return;
      const pt = pointerToPitch(e.clientX, e.clientY);
      const clampedX = Math.round(clamp(pt.x, 7, 93));
      const clampedY = Math.round(clamp(pt.y, 8, 84));
      if (
        dragOriginRef.current &&
        (Math.abs(pt.x - dragOriginRef.current.startX) > 1.2 ||
          Math.abs(pt.y - dragOriginRef.current.startY) > 1.2)
      ) {
        dragOriginRef.current.moved = true;
      }
      setDragPos({ x: clampedX, y: clampedY });
    },
    [draggingSlotIndex, pointerToPitch]
  );

  const handleTokenPointerUp = useCallback(
    (slotIndex: number, e: React.PointerEvent<SVGGElement>) => {
      if (draggingSlotIndex !== slotIndex) return;
      try {
        (e.currentTarget as Element).releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }

      const wasMoved = dragOriginRef.current?.moved ?? false;
      const finalPos = dragPos;
      setDraggingSlotIndex(null);
      setDragPos(null);
      dragOriginRef.current = null;

      if (!wasMoved || !finalPos) {
        // Treated as click -> support quick swap if user had selected a squad player
        if (swapSelection) {
          handleSelectTarget({ kind: 'xi', slotIndex });
        }
        return;
      }

      if (pitchMode === 'standard') {
        const prevSlot = tactics.startingXI[slotIndex];
        const dx = prevSlot ? finalPos.x - prevSlot.baseX : 0;
        const dy = prevSlot ? finalPos.y - prevSlot.baseY : 0;
        const inferredRole = inferPositionFromCoords(finalPos.x, finalPos.y);
        const nextXI = tactics.startingXI.map((slot, idx) =>
          idx === slotIndex
            ? {
                ...slot,
                baseX: finalPos.x,
                baseY: finalPos.y,
                roleLabel: inferredRole === 'GK' ? slot.roleLabel : inferredRole,
              }
            : slot
        );

        // Propagate the base-shape drag delta cleanly to this slot across all 25 WIB/WOB zones
        const shiftTable = (table: Record<string, WibWobPosition[]>) => {
          const next: Record<string, WibWobPosition[]> = {};
          for (const key of Object.keys(table)) {
            const arr = table[key];
            if (!arr || !arr[slotIndex]) {
              next[key] = arr;
              continue;
            }
            next[key] = arr.map((pt, idx) =>
              idx === slotIndex
                ? {
                    x: Math.round(clamp(pt.x + dx, 6, 94) * 10) / 10,
                    y: Math.round(clamp(pt.y + dy, 7, 88) * 10) / 10,
                  }
                : pt
            );
          }
          return next;
        };

        onUpdateTactics({
          ...tactics,
          startingXI: nextXI,
          wibWobGrid: {
            withBall: shiftTable(tactics.wibWobGrid.withBall),
            withoutBall: shiftTable(tactics.wibWobGrid.withoutBall),
          },
        });
      } else {
        const baseZonePositions = currentPitchCoords.map((p) => ({ x: p.x, y: p.y }));
        baseZonePositions[slotIndex] = { x: finalPos.x, y: finalPos.y };

        onUpdateTactics({
          ...tactics,
          wibWobGrid: {
            withBall:
              pitchMode === 'wib'
                ? { ...tactics.wibWobGrid.withBall, [activeZoneKey]: baseZonePositions }
                : tactics.wibWobGrid.withBall,
            withoutBall:
              pitchMode === 'wob'
                ? { ...tactics.wibWobGrid.withoutBall, [activeZoneKey]: baseZonePositions }
                : tactics.wibWobGrid.withoutBall,
          },
        });
      }
    },
    [
      draggingSlotIndex,
      dragPos,
      swapSelection,
      handleSelectTarget,
      pitchMode,
      tactics,
      onUpdateTactics,
      currentPitchCoords,
      activeZoneKey,
    ]
  );

  const selectedSlot =
    selectedSlotIndex !== null ? tactics.startingXI[selectedSlotIndex] ?? null : null;
  const selectedSlotPlayer =
    selectedSlot?.playerId ? playerMap[selectedSlot.playerId] ?? null : null;

  const startingPlayersList = useMemo(
    () =>
      tactics.startingXI
        .map((s) => (s.playerId ? playerMap[s.playerId] : null))
        .filter((p): p is Player => Boolean(p)),
    [tactics.startingXI, playerMap]
  );

  const isTargetSelected = (t: SelectionTarget): boolean => {
    if (!swapSelection || swapSelection.kind !== t.kind) return false;
    if (t.kind === 'xi' && swapSelection.kind === 'xi') return t.slotIndex === swapSelection.slotIndex;
    if (t.kind === 'bench' && swapSelection.kind === 'bench')
      return t.benchIndex === swapSelection.benchIndex;
    if (t.kind === 'reserve' && swapSelection.kind === 'reserve')
      return t.playerId === swapSelection.playerId;
    return false;
  };

  const ballCenterX = activeZone.col * 20 + 10;
  const ballCenterY = activeZone.row * 20 + 10;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* TOP BAR: FORMATION, MODE TABS, TACTICAL STRENGTH STRIP */}
      <div className="cm-panel">
        <div className="cm-panel-header" style={{ flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              className="cm-club-shield"
              style={{
                width: 24,
                height: 24,
                fontSize: 9.5,
                backgroundColor: club.colors.primary,
                color: club.colors.text,
                borderColor: club.colors.secondary,
              }}
            >
              {club.threeLetterCode}
            </div>
            <span>
              {club.name} — Tactics &amp; Wib-Wob Board
              {isLiveMatch ? ' (LIVE TOUCHLINE)' : ''}
            </span>
          </div>

          {/* Formation Presets */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
            <span
              style={{
                fontSize: 10.5,
                color: 'var(--cm-text-muted)',
                marginRight: 2,
                textTransform: 'uppercase',
              }}
            >
              Formation:
            </span>
            {FORMATION_ORDER.map((fid) => {
              const tpl = FORMATIONS[fid];
              const isCurrent = tactics.formation === fid;
              return (
                <button
                  key={fid}
                  type="button"
                  className={`cm-btn cm-btn-sm ${isCurrent ? 'cm-btn-gold' : ''}`}
                  onClick={() => handleFormationChange(fid)}
                  title={tpl ? `${tpl.label} — ${tpl.description}` : fid}
                  style={{
                    fontFamily: 'var(--cm-font-mono)',
                    fontSize: 11,
                    padding: '3px 7px',
                  }}
                >
                  {fid === '4-4-2-diamond' ? '4-4-2 ◆' : fid}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tactical Strength Strip */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(115px, 1fr))',
            gap: 6,
            padding: '7px 10px',
            background: 'rgba(6, 12, 24, 0.72)',
            borderBottom: '1px solid var(--cm-border-subtle)',
          }}
        >
          {[
            { label: 'Attack', value: strength.attack, color: '#f87171', icon: <Swords size={12} /> },
            { label: 'Midfield', value: strength.midfield, color: '#4ade80', icon: <Compass size={12} /> },
            { label: 'Defense', value: strength.defense, color: '#60a5fa', icon: <Shield size={12} /> },
            { label: 'Goalkeeper', value: strength.goalkeeper, color: '#fde047', icon: <Users size={12} /> },
            { label: 'Cohesion', value: strength.cohesion, color: '#38e8d5', icon: <Sparkles size={12} /> },
            { label: 'Width', value: strength.width, color: '#c084fc', icon: <Crosshair size={12} /> },
          ].map((metric) => {
            const pct = clamp(Math.round(metric.value), 0, 100);
            return (
              <div
                key={metric.label}
                style={{
                  padding: '4px 7px',
                  background: 'rgba(12, 22, 42, 0.78)',
                  border: '1px solid var(--cm-border-subtle)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: 10.5,
                    color: 'var(--cm-text-muted)',
                    marginBottom: 3,
                  }}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ color: metric.color }}>{metric.icon}</span>
                    {metric.label}
                  </span>
                  <span className="cm-num" style={{ fontWeight: 700, color: '#ffffff' }}>
                    {pct}
                  </span>
                </div>
                <div
                  style={{
                    height: 5,
                    background: 'rgba(0,0,0,0.65)',
                    border: '1px solid rgba(160,196,240,0.2)',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${pct}%`,
                      height: '100%',
                      background: metric.color,
                      transition: 'width 0.25s ease',
                    }}
                  />
                </div>
              </div>
            );
          })}

          <div
            style={{
              padding: '4px 7px',
              background: 'rgba(12, 22, 42, 0.78)',
              border: `1px solid ${
                strength.pressingBonus > 0 ? 'rgba(56, 232, 213, 0.45)' : 'var(--cm-border-subtle)'
              }`,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
            }}
          >
            <div style={{ fontSize: 10.5, color: 'var(--cm-text-muted)' }}>Pressing Bonus</div>
            <div
              className="cm-num"
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: strength.pressingBonus > 0 ? 'var(--cm-cyan)' : 'var(--cm-text-dim)',
              }}
            >
              {strength.pressingBonus >= 0 ? `+${strength.pressingBonus.toFixed(1)}` : strength.pressingBonus.toFixed(1)}
            </div>
          </div>
        </div>
      </div>

      {/* MAIN 3-COLUMN TACTICS WORKSPACE */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(290px, 1.08fr) minmax(380px, 1.32fr) minmax(245px, 0.85fr)',
          gap: 10,
          alignItems: 'start',
        }}
      >
        {/* LEFT COLUMN: STARTING XI + BENCH + RESERVES */}
        <div className="cm-panel" style={{ maxHeight: 'calc(100vh - 188px)', overflow: 'hidden' }}>
          <div className="cm-panel-header">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Users size={13} />
              Squad Selection (11 + 7)
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              {swapSelection && (
                <button
                  type="button"
                  className="cm-btn cm-btn-sm cm-btn-danger"
                  onClick={() => setSwapSelection(null)}
                  title="Cancel selection"
                >
                  <X size={11} />
                  Cancel
                </button>
              )}
              <button
                type="button"
                className="cm-btn cm-btn-sm cm-btn-primary"
                onClick={() => {
                  setSwapSelection(null);
                  onAutoPick();
                }}
                title="Automatically pick best available XI & 7 substitutes"
              >
                <Wand2 size={12} />
                Auto-Pick Best XI
              </button>
            </div>
          </div>

          <div
            style={{
              padding: '5px 8px',
              background: swapSelection
                ? 'rgba(56, 232, 213, 0.16)'
                : 'rgba(6, 12, 24, 0.6)',
              borderBottom: '1px solid var(--cm-border-subtle)',
              fontSize: 11,
              color: swapSelection ? 'var(--cm-cyan)' : 'var(--cm-text-muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span>
              {swapSelection
                ? 'Select another player or slot to swap positions'
                : 'Click any two players/slots to swap · Click profile icon to inspect'}
            </span>
          </div>

          <div style={{ overflowY: 'auto', flex: 1 }}>
            {/* STARTING XI TABLE */}
            <table className="cm-table" style={{ fontSize: 11.5 }}>
              <thead>
                <tr>
                  <th style={{ width: 40 }}>Role</th>
                  <th>Starting XI</th>
                  <th style={{ width: 42, textAlign: 'right' }} title="Positional Suitability %">
                    Fit
                  </th>
                  <th style={{ width: 52, textAlign: 'right' }}>Cond</th>
                  <th style={{ width: 42, textAlign: 'center' }}>Mor</th>
                </tr>
              </thead>
              <tbody>
                {tactics.startingXI.map((slot) => {
                  const player = slot.playerId ? playerMap[slot.playerId] : undefined;
                  const fit = player ? Math.round(calculatePositionRating(player, slot.roleLabel)) : 0;
                  const isSwap = isTargetSelected({ kind: 'xi', slotIndex: slot.slotIndex });
                  const isPitchSel = selectedSlotIndex === slot.slotIndex;
                  return (
                    <tr
                      key={slot.slotIndex}
                      onClick={() => handleSelectTarget({ kind: 'xi', slotIndex: slot.slotIndex })}
                      className={isSwap ? 'is-selected-row' : isPitchSel ? 'is-user-row' : ''}
                      style={{ cursor: 'pointer' }}
                    >
                      <td>
                        <span className={getPosPillClass(slot.roleLabel)}>{slot.roleLabel}</span>
                      </td>
                      <td style={{ maxWidth: 145 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
                          <span
                            style={{
                              fontWeight: 600,
                              color: player ? '#ffffff' : 'var(--cm-red)',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {player ? player.shortName : '— Empty Slot —'}
                          </span>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>
                            {player?.injury && (
                              <span
                                title={`Injured: ${player.injury.type} (${player.injury.daysRemaining}d)`}
                                style={{
                                  fontSize: 9.5,
                                  fontWeight: 800,
                                  padding: '0 3px',
                                  background: '#991b1b',
                                  color: '#fecaca',
                                  border: '1px solid #f87171',
                                }}
                              >
                                INJ
                              </span>
                            )}
                            {player && player.suspendedMatches > 0 && (
                              <span
                                title={`Suspended (${player.suspendedMatches} match)`}
                                style={{
                                  fontSize: 9.5,
                                  fontWeight: 800,
                                  padding: '0 3px',
                                  background: '#854d0e',
                                  color: '#fef08a',
                                  border: '1px solid #facc15',
                                }}
                              >
                                SUS
                              </span>
                            )}
                            {slot.runArrow !== 'none' && (
                              <span
                                className="cm-num"
                                title={`Run arrow: ${slot.runArrow}`}
                                style={{
                                  fontSize: 9.5,
                                  color: 'var(--cm-gold)',
                                  padding: '0 3px',
                                  border: '1px solid rgba(255,216,77,0.45)',
                                }}
                              >
                                {slot.runArrow}
                              </span>
                            )}
                            {player && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onSelectPlayer(player.id);
                                }}
                                title={`Open ${player.name} profile`}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: 'var(--cm-text-dim)',
                                  cursor: 'pointer',
                                  padding: 1,
                                  display: 'inline-flex',
                                }}
                              >
                                <ExternalLink size={11} />
                              </button>
                            )}
                          </span>
                        </div>
                      </td>
                      <td className="cm-num" style={{ textAlign: 'right', fontWeight: 700, color: player ? getSuitabilityColor(fit) : 'var(--cm-text-dim)' }}>
                        {player ? `${fit}%` : '—'}
                      </td>
                      <td className="cm-num" style={{ textAlign: 'right' }}>
                        {player ? (
                          <span style={{ color: getConditionColor(player.condition), fontWeight: 700 }}>
                            {Math.round(player.condition)}%
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td
                        className="cm-num"
                        style={{
                          textAlign: 'center',
                          fontSize: 10,
                          fontWeight: 700,
                          color: player ? getMoraleColor(player.morale) : 'var(--cm-text-dim)',
                        }}
                        title={player?.morale}
                      >
                        {player ? moraleShort(player.morale) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* SUBSTITUTES BENCH (7 SLOTS) */}
            <div
              style={{
                padding: '5px 8px',
                background: 'rgba(20, 36, 62, 0.92)',
                borderTop: '1px solid var(--cm-border-bright)',
                borderBottom: '1px solid var(--cm-border)',
                fontSize: 10.5,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: 'var(--cm-gold)',
              }}
            >
              Substitutes Bench (7)
            </div>
            <table className="cm-table" style={{ fontSize: 11.5 }}>
              <tbody>
                {Array.from({ length: 7 }, (_, idx) => {
                  const pid = tactics.bench[idx];
                  const player = pid ? playerMap[pid] : undefined;
                  const isSwap = isTargetSelected({ kind: 'bench', benchIndex: idx });
                  return (
                    <tr
                      key={`bench-${idx}`}
                      onClick={() => handleSelectTarget({ kind: 'bench', benchIndex: idx })}
                      className={isSwap ? 'is-selected-row' : ''}
                      style={{ cursor: 'pointer' }}
                    >
                      <td style={{ width: 40 }}>
                        <span
                          className="cm-pos-pill"
                          style={{
                            background: 'rgba(71, 85, 105, 0.45)',
                            color: '#e2e8f0',
                            borderColor: 'rgba(148, 163, 184, 0.45)',
                          }}
                        >
                          S{idx + 1}
                        </span>
                      </td>
                      <td style={{ maxWidth: 145 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
                          <span
                            style={{
                              color: player ? '#e6eef9' : 'var(--cm-text-dim)',
                              fontStyle: player ? 'normal' : 'italic',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {player ? player.shortName : 'Empty Bench Slot'}
                          </span>
                          {player && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                              <span className={getPosPillClass(player.positions[0])} style={{ minWidth: 24, fontSize: 9.5, padding: '0 3px' }}>
                                {player.positions[0]}
                              </span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onSelectPlayer(player.id);
                                }}
                                title={`Open ${player.name} profile`}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: 'var(--cm-text-dim)',
                                  cursor: 'pointer',
                                  padding: 1,
                                  display: 'inline-flex',
                                }}
                              >
                                <ExternalLink size={11} />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => handleRemoveFromBench(idx, e)}
                                title="Move back to reserves"
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: '#f87171',
                                  cursor: 'pointer',
                                  padding: 1,
                                  display: 'inline-flex',
                                }}
                              >
                                <X size={11} />
                              </button>
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="cm-num" style={{ width: 48, textAlign: 'right' }}>
                        {player ? (
                          <span style={{ color: getConditionColor(player.condition) }}>
                            {Math.round(player.condition)}%
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td
                        className="cm-num"
                        style={{
                          width: 42,
                          textAlign: 'center',
                          fontSize: 10,
                          color: player ? getMoraleColor(player.morale) : 'var(--cm-text-dim)',
                        }}
                      >
                        {player ? moraleShort(player.morale) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* RESERVES */}
            <div
              style={{
                padding: '5px 8px',
                background: 'rgba(15, 27, 48, 0.94)',
                borderTop: '1px solid var(--cm-border)',
                borderBottom: '1px solid var(--cm-border)',
                fontSize: 10.5,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: 'var(--cm-text-muted)',
              }}
            >
              Reserves ({reserves.length})
            </div>
            <table className="cm-table" style={{ fontSize: 11.5 }}>
              <tbody>
                {reserves.map((player) => {
                  const isSwap = isTargetSelected({ kind: 'reserve', playerId: player.id });
                  const selectedRole =
                    swapSelection?.kind === 'xi'
                      ? tactics.startingXI[swapSelection.slotIndex]?.roleLabel
                      : undefined;
                  const fit = selectedRole
                    ? Math.round(calculatePositionRating(player, selectedRole))
                    : null;
                  return (
                    <tr
                      key={player.id}
                      onClick={() => handleSelectTarget({ kind: 'reserve', playerId: player.id })}
                      className={isSwap ? 'is-selected-row' : ''}
                      style={{ cursor: 'pointer' }}
                    >
                      <td style={{ width: 40 }}>
                        <span className={getPosPillClass(player.positions[0])}>
                          {player.positions[0]}
                        </span>
                      </td>
                      <td style={{ maxWidth: 145 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
                          <span
                            style={{
                              color: player.injury ? '#fca5a5' : 'var(--cm-text)',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {player.shortName}
                          </span>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                            {player.injury && (
                              <span
                                style={{
                                  fontSize: 9,
                                  padding: '0 3px',
                                  background: '#991b1b',
                                  color: '#fecaca',
                                }}
                              >
                                INJ
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectPlayer(player.id);
                              }}
                              title={`Open ${player.name} profile`}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--cm-text-dim)',
                                cursor: 'pointer',
                                padding: 1,
                                display: 'inline-flex',
                              }}
                            >
                              <ExternalLink size={11} />
                            </button>
                          </span>
                        </div>
                      </td>
                      <td
                        className="cm-num"
                        style={{
                          width: 46,
                          textAlign: 'right',
                          color: fit !== null ? getSuitabilityColor(fit) : getConditionColor(player.condition),
                        }}
                        title={fit !== null ? `Suitability for ${selectedRole}` : 'Condition'}
                      >
                        {fit !== null ? `${fit}%` : `${Math.round(player.condition)}%`}
                      </td>
                      <td
                        className="cm-num"
                        style={{
                          width: 42,
                          textAlign: 'center',
                          fontSize: 10,
                          color: getMoraleColor(player.morale),
                        }}
                      >
                        {moraleShort(player.morale)}
                      </td>
                    </tr>
                  );
                })}
                {reserves.length === 0 && (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', color: 'var(--cm-text-dim)', padding: 10 }}>
                      All squad players assigned
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* CENTER COLUMN: INTERACTIVE 2D PITCH + WIB-WOB 5x5 ZONE GRID */}
        <div className="cm-panel">
          <div className="cm-panel-header" style={{ flexWrap: 'wrap', gap: 6 }}>
            {/* 3 Editing Mode Tabs */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <button
                type="button"
                className={`cm-tab ${pitchMode === 'standard' ? 'is-active' : ''}`}
                onClick={() => setPitchMode('standard')}
                style={{ padding: '4px 9px', fontSize: 11.5 }}
              >
                Standard &amp; Runs
              </button>
              <button
                type="button"
                className={`cm-tab ${pitchMode === 'wib' ? 'is-active' : ''}`}
                onClick={() => setPitchMode('wib')}
                style={{
                  padding: '4px 9px',
                  fontSize: 11.5,
                  borderColor: pitchMode === 'wib' ? '#4ade80' : undefined,
                  color: pitchMode === 'wib' ? '#4ade80' : undefined,
                }}
              >
                With Ball (WIB)
              </button>
              <button
                type="button"
                className={`cm-tab ${pitchMode === 'wob' ? 'is-active' : ''}`}
                onClick={() => setPitchMode('wob')}
                style={{
                  padding: '4px 9px',
                  fontSize: 11.5,
                  borderColor: pitchMode === 'wob' ? '#fb923c' : undefined,
                  color: pitchMode === 'wob' ? '#fb923c' : undefined,
                }}
              >
                Without Ball (WOB)
              </button>
            </div>

            {pitchMode !== 'standard' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <button
                  type="button"
                  className="cm-btn cm-btn-sm"
                  onClick={handleResetZone}
                  title="Reset only the currently selected 5x5 zone to formation default"
                >
                  <RotateCcw size={11} />
                  Reset Zone
                </button>
                <button
                  type="button"
                  className="cm-btn cm-btn-sm cm-btn-danger"
                  onClick={handleResetAllWibWob}
                  title="Reset all 25 WIB and 25 WOB zones to formation default"
                >
                  <RefreshCw size={11} />
                  Reset All WIB-WOB
                </button>
              </div>
            )}
          </div>

          <div className="cm-panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {/* Mode Context Banner */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
                padding: '5px 8px',
                background:
                  pitchMode === 'wib'
                    ? 'rgba(22, 163, 74, 0.16)'
                    : pitchMode === 'wob'
                      ? 'rgba(234, 88, 12, 0.16)'
                      : 'rgba(15, 27, 48, 0.65)',
                border: `1px solid ${
                  pitchMode === 'wib'
                    ? 'rgba(74, 222, 128, 0.45)'
                    : pitchMode === 'wob'
                      ? 'rgba(251, 146, 60, 0.45)'
                      : 'var(--cm-border-subtle)'
                }`,
                fontSize: 11,
              }}
            >
              <span style={{ color: '#e6eef9' }}>
                {pitchMode === 'standard' ? (
                  <>
                    <strong>Drag</strong> outfield players to reshape · <strong>Click</strong> to assign{' '}
                    <span style={{ color: 'var(--cm-gold)' }}>Directional Run Arrows</span>
                  </>
                ) : pitchMode === 'wib' ? (
                  <>
                    <strong style={{ color: '#4ade80' }}>WITH BALL:</strong> Click any of the 25 zones to place the ball, then drag players to set attacking shifts.
                  </>
                ) : (
                  <>
                    <strong style={{ color: '#fb923c' }}>WITHOUT BALL:</strong> Click any of the 25 zones where opponent holds possession, then drag defensive shape.
                  </>
                )}
              </span>
              {pitchMode !== 'standard' && (
                <span
                  className="cm-num"
                  style={{
                    whiteSpace: 'nowrap',
                    color: 'var(--cm-gold)',
                    fontWeight: 700,
                    fontSize: 10.5,
                  }}
                >
                  R{activeZone.row + 1}·C{activeZone.col + 1} ({ZONE_ROW_NAMES[activeZone.row]} /{' '}
                  {ZONE_COL_NAMES[activeZone.col]})
                </span>
              )}
            </div>

            {/* 2D INTERACTIVE FOOTBALL PITCH SVG */}
            <div
              style={{
                position: 'relative',
                width: '100%',
                maxWidth: 480,
                margin: '0 auto',
                aspectRatio: '100 / 128',
                border: '2px solid rgba(168, 204, 248, 0.5)',
                boxShadow: 'inset 0 0 28px rgba(0, 0, 0, 0.55), 0 8px 24px rgba(0, 0, 0, 0.5)',
                background: '#0f4c24',
                userSelect: 'none',
                touchAction: 'none',
              }}
            >
              <svg
                ref={svgRef}
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                style={{ width: '100%', height: '100%', display: 'block' }}
              >
                <defs>
                  {/* Classic CM 01/02 Mowed Emerald Grass Stripes */}
                  <pattern id="cm-pitch-stripes" width="100" height="20" patternUnits="userSpaceOnUse">
                    <rect x="0" y="0" width="100" height="10" fill="#17612f" />
                    <rect x="0" y="10" width="100" height="10" fill="#135428" />
                  </pattern>
                  <marker
                    id="cm-run-arrowhead"
                    markerWidth="6"
                    markerHeight="6"
                    refX="4.5"
                    refY="3"
                    orient="auto"
                  >
                    <polygon points="0 0.6, 5.5 3, 0 5.4" fill="#ffd84d" />
                  </marker>
                  <marker
                    id="cm-run-arrowhead-active"
                    markerWidth="6"
                    markerHeight="6"
                    refX="4.5"
                    refY="3"
                    orient="auto"
                  >
                    <polygon points="0 0.6, 5.5 3, 0 5.4" fill="#38e8d5" />
                  </marker>
                </defs>

                {/* Turf Background */}
                <rect x="0" y="0" width="100" height="100" fill="url(#cm-pitch-stripes)" />

                {/* Pitch Markings */}
                <g stroke="rgba(235, 255, 240, 0.55)" strokeWidth="0.45" fill="none">
                  {/* Outer touchline & goal lines */}
                  <rect x="3" y="3" width="94" height="94" />
                  {/* Halfway line & Center Circle */}
                  <line x1="3" y1="50" x2="97" y2="50" />
                  <circle cx="50" cy="50" r="10.5" />
                  <circle cx="50" cy="50" r="0.7" fill="rgba(235, 255, 240, 0.75)" />

                  {/* Top Penalty Box (Opponent Goal — Attacking UP) */}
                  <rect x="22" y="3" width="56" height="15" />
                  <rect x="36" y="3" width="28" height="5.5" />
                  <circle cx="50" cy="13.2" r="0.6" fill="rgba(235, 255, 240, 0.75)" />
                  <path d="M 41 18 A 10 8 0 0 0 59 18" />
                  {/* Top Goal Mouth */}
                  <rect x="43" y="1.2" width="14" height="1.8" stroke="#ffd84d" strokeWidth="0.55" />

                  {/* Bottom Penalty Box (Own Goal) */}
                  <rect x="22" y="82" width="56" height="15" />
                  <rect x="36" y="91.5" width="28" height="5.5" />
                  <circle cx="50" cy="86.8" r="0.6" fill="rgba(235, 255, 240, 0.75)" />
                  <path d="M 41 82 A 10 8 0 0 1 59 82" />
                  {/* Bottom Goal Mouth */}
                  <rect x="43" y="97" width="14" height="1.8" stroke="rgba(235,255,240,0.8)" strokeWidth="0.55" />
                </g>

                {/* Attacking Direction Indicator */}
                <text
                  x="50"
                  y="6.2"
                  textAnchor="middle"
                  fill="rgba(255, 216, 77, 0.65)"
                  fontSize="2.2"
                  fontWeight="700"
                  letterSpacing="0.4"
                >
                  ▲ ATTACKING DIRECTION ▲
                </text>

                {/* INTERACTIVE 5x5 WIB/WOB ZONE GRID */}
                {pitchMode !== 'standard' && (
                  <g>
                    {Array.from({ length: 5 }, (_, row) =>
                      Array.from({ length: 5 }, (_, col) => {
                        const key = `${row}-${col}`;
                        const isActive = activeZone.row === row && activeZone.col === col;
                        const isCustom = customizedZoneKeys.has(key);
                        const activeStroke = pitchMode === 'wib' ? '#4ade80' : '#fb923c';
                        const activeFill =
                          pitchMode === 'wib'
                            ? 'rgba(74, 222, 128, 0.24)'
                            : 'rgba(251, 146, 60, 0.24)';
                        return (
                          <g
                            key={key}
                            onClick={() => setActiveZone({ row, col })}
                            style={{ cursor: 'pointer' }}
                          >
                            <rect
                              x={col * 20}
                              y={row * 20}
                              width={20}
                              height={20}
                              fill={
                                isActive
                                  ? activeFill
                                  : isCustom
                                    ? 'rgba(255, 216, 77, 0.09)'
                                    : 'rgba(6, 15, 24, 0.08)'
                              }
                              stroke={
                                isActive
                                  ? activeStroke
                                  : isCustom
                                    ? 'rgba(255, 216, 77, 0.45)'
                                    : 'rgba(220, 252, 231, 0.22)'
                              }
                              strokeWidth={isActive ? 0.85 : 0.3}
                            />
                            {isCustom && !isActive && (
                              <circle cx={col * 20 + 17.5} cy={row * 20 + 2.5} r={1.1} fill="#ffd84d" />
                            )}
                          </g>
                        );
                      })
                    )}

                    {/* Ball Marker in Active 5x5 Zone */}
                    <g style={{ pointerEvents: 'none' }}>
                      <circle
                        cx={ballCenterX}
                        cy={ballCenterY}
                        r={4.2}
                        fill={
                          pitchMode === 'wib'
                            ? 'rgba(74, 222, 128, 0.28)'
                            : 'rgba(251, 146, 60, 0.28)'
                        }
                      />
                      <circle
                        cx={ballCenterX}
                        cy={ballCenterY}
                        r={2.1}
                        fill="#ffffff"
                        stroke="#0f172a"
                        strokeWidth="0.55"
                      />
                      <circle cx={ballCenterX} cy={ballCenterY} r={0.7} fill="#0f172a" />
                    </g>
                  </g>
                )}

                {/* GHOST SHIFT LINES (Base -> WIB/WOB Shift) */}
                {pitchMode !== 'standard' &&
                  tactics.startingXI.map((slot, idx) => {
                    const target =
                      draggingSlotIndex === idx && dragPos
                        ? dragPos
                        : currentPitchCoords[idx] ?? { x: slot.baseX, y: slot.baseY };
                    const dist = Math.hypot(target.x - slot.baseX, target.y - slot.baseY);
                    if (dist < 1.5) return null;
                    return (
                      <g key={`shift-${idx}`} style={{ pointerEvents: 'none' }}>
                        <circle
                          cx={slot.baseX}
                          cy={slot.baseY}
                          r={1.1}
                          fill="rgba(255,255,255,0.28)"
                        />
                        <line
                          x1={slot.baseX}
                          y1={slot.baseY}
                          x2={target.x}
                          y2={target.y}
                          stroke={
                            pitchMode === 'wib'
                              ? 'rgba(74, 222, 128, 0.65)'
                              : 'rgba(251, 146, 60, 0.65)'
                          }
                          strokeWidth="0.55"
                          strokeDasharray="1.5 1.2"
                        />
                      </g>
                    );
                  })}

                {/* DIRECTIONAL RUN ARROWS (Standard Mode) */}
                {pitchMode === 'standard' &&
                  tactics.startingXI.map((slot, idx) => {
                    if (slot.runArrow === 'none') return null;
                    const pos =
                      draggingSlotIndex === idx && dragPos
                        ? dragPos
                        : { x: slot.baseX, y: slot.baseY };
                    const vec = RUN_ARROW_VECTORS[slot.runArrow];
                    const x2 = clamp(pos.x + vec.dx, 4, 96);
                    const y2 = clamp(pos.y + vec.dy, 4, 96);
                    const isSel = selectedSlotIndex === idx;
                    return (
                      <line
                        key={`arrow-${idx}`}
                        x1={pos.x}
                        y1={pos.y}
                        x2={x2}
                        y2={y2}
                        stroke={isSel ? '#38e8d5' : '#ffd84d'}
                        strokeWidth={isSel ? 1.1 : 0.85}
                        markerEnd={
                          isSel ? 'url(#cm-run-arrowhead-active)' : 'url(#cm-run-arrowhead)'
                        }
                        style={{ pointerEvents: 'none' }}
                      />
                    );
                  })}

                {/* 11 PLAYER TOKENS */}
                {tactics.startingXI.map((slot, idx) => {
                  const player = slot.playerId ? playerMap[slot.playerId] : undefined;
                  const coords =
                    draggingSlotIndex === idx && dragPos
                      ? dragPos
                      : currentPitchCoords[idx] ?? { x: slot.baseX, y: slot.baseY };
                  const isSel = selectedSlotIndex === idx;
                  const isDragging = draggingSlotIndex === idx;
                  const fit = player ? calculatePositionRating(player, slot.roleLabel) : 0;
                  const isGk = idx === 0;
                  const fillColor = isGk ? '#ca8a04' : club.colors.primary;
                  const strokeColor = isSel
                    ? '#38e8d5'
                    : isGk
                      ? '#fef08a'
                      : club.colors.secondary;
                  const textColor = isGk ? '#111827' : club.colors.text;

                  return (
                    <g
                      key={`token-${idx}`}
                      transform={`translate(${coords.x}, ${coords.y})`}
                      onPointerDown={(e) => handleTokenPointerDown(idx, e)}
                      onPointerMove={(e) => handleTokenPointerMove(idx, e)}
                      onPointerUp={(e) => handleTokenPointerUp(idx, e)}
                      style={{
                        cursor: isGk ? 'pointer' : isDragging ? 'grabbing' : 'grab',
                        transition: isDragging ? 'none' : 'transform 220ms cubic-bezier(0.22, 1, 0.36, 1)',
                      }}
                    >
                      {/* Outer selection halo */}
                      {isSel && (
                        <circle
                          cx={0}
                          cy={0}
                          r={5.1}
                          fill="rgba(56, 232, 213, 0.2)"
                          stroke="#38e8d5"
                          strokeWidth="0.6"
                        />
                      )}

                      {/* Drop shadow */}
                      <circle cx={0.4} cy={0.7} r={3.6} fill="rgba(0,0,0,0.55)" />

                      {/* Shirt Circle */}
                      <circle
                        cx={0}
                        cy={0}
                        r={3.5}
                        fill={fillColor}
                        stroke={strokeColor}
                        strokeWidth={isSel ? 0.9 : 0.65}
                      />

                      {/* Role / Number text inside circle */}
                      <text
                        x={0}
                        y={0.95}
                        textAnchor="middle"
                        fill={textColor}
                        fontSize="2.35"
                        fontWeight="800"
                        fontFamily="var(--cm-font-mono)"
                      >
                        {slot.roleLabel}
                      </text>

                      {/* Suitability indicator dot on top-right of token */}
                      {player && (
                        <circle
                          cx={2.9}
                          cy={-2.6}
                          r={1.05}
                          fill={getSuitabilityColor(fit)}
                          stroke="#060b14"
                          strokeWidth="0.35"
                        />
                      )}

                      {/* Player Surname Pill */}
                      <g transform="translate(0, 5.8)">
                        <rect
                          x={-9.5}
                          y={-1.9}
                          width={19}
                          height={3.6}
                          rx={0.7}
                          fill="rgba(6, 11, 20, 0.86)"
                          stroke={isSel ? '#38e8d5' : 'rgba(168, 204, 248, 0.35)'}
                          strokeWidth="0.28"
                        />
                        <text
                          x={0}
                          y={0.65}
                          textAnchor="middle"
                          fill={player ? '#ffffff' : '#f87171'}
                          fontSize="2.2"
                          fontWeight="700"
                        >
                          {getSurname(player).slice(0, 11)}
                        </text>
                      </g>
                    </g>
                  );
                })}
              </svg>
            </div>

            {/* CONTEXT CONTROLS BELOW PITCH: RUN ARROW COMPASS OR 5x5 MINI ZONE SELECTOR */}
            {pitchMode === 'standard' ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                  padding: '8px 10px',
                  background: 'rgba(6, 12, 24, 0.78)',
                  border: '1px solid var(--cm-border)',
                  flexWrap: 'wrap',
                }}
              >
                {selectedSlot ? (
                  <>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 160 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span className={getPosPillClass(selectedSlot.roleLabel)}>
                          {selectedSlot.roleLabel}
                        </span>
                        <strong style={{ color: '#fff', fontSize: 12.5 }}>
                          {selectedSlotPlayer ? selectedSlotPlayer.name : `Slot #${selectedSlot.slotIndex + 1}`}
                        </strong>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        {selectedSlot.slotIndex > 0 && (
                          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--cm-text-muted)' }}>
                            Role:
                            <select
                              className="cm-select"
                              value={selectedSlot.roleLabel}
                              onChange={(e) =>
                                handleSetSlotRole(selectedSlot.slotIndex, e.target.value as PositionCode)
                              }
                              style={{ padding: '2px 5px', fontSize: 11 }}
                            >
                              {OUTFIELD_POSITIONS.map((pos) => (
                                <option key={pos} value={pos}>
                                  {pos}
                                </option>
                              ))}
                            </select>
                          </label>
                        )}
                        {selectedSlotPlayer && (
                          <button
                            type="button"
                            className="cm-btn cm-btn-sm"
                            onClick={() => onSelectPlayer(selectedSlotPlayer.id)}
                          >
                            <ExternalLink size={11} />
                            Profile
                          </button>
                        )}
                      </div>
                    </div>

                    {/* 8-Way Run Arrow Pad */}
                    {selectedSlot.slotIndex > 0 ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ fontSize: 11, color: 'var(--cm-text-muted)' }}>
                          <div style={{ color: 'var(--cm-gold)', fontWeight: 700 }}>
                            Run Arrow
                          </div>
                          <div className="cm-num" style={{ fontSize: 10.5 }}>
                            {selectedSlot.runArrow === 'none' ? 'Hold' : selectedSlot.runArrow}
                          </div>
                        </div>
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(3, 28px)',
                            gap: 3,
                          }}
                        >
                          {COMPASS_CELLS.map((cell) => {
                            const active = selectedSlot.runArrow === cell.arrow;
                            return (
                              <button
                                key={cell.arrow}
                                type="button"
                                className={`cm-btn cm-btn-sm ${active ? 'cm-btn-gold' : ''}`}
                                onClick={() => handleSetRunArrow(selectedSlot.slotIndex, cell.arrow)}
                                title={cell.label}
                                style={{
                                  width: 28,
                                  height: 26,
                                  padding: 0,
                                }}
                              >
                                {cell.icon}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <span style={{ fontSize: 11, color: 'var(--cm-text-dim)' }}>
                        Goalkeeper holds penalty box zone
                      </span>
                    )}
                  </>
                ) : (
                  <div style={{ fontSize: 11.5, color: 'var(--cm-text-muted)' }}>
                    Click any outfield player on the pitch to set a <strong style={{ color: 'var(--cm-gold)' }}>Directional Run Arrow</strong> (N, NE, E, SE, S, SW, W, NW) or change their tactical role.
                  </div>
                )}
              </div>
            ) : (
              /* WIB/WOB Mini 5x5 Zone Selector */
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                  padding: '8px 10px',
                  background: 'rgba(6, 12, 24, 0.78)',
                  border: '1px solid var(--cm-border)',
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ flex: 1, minWidth: 165 }}>
                  <div
                    style={{
                      fontSize: 11.5,
                      fontWeight: 700,
                      color: pitchMode === 'wib' ? '#4ade80' : '#fb923c',
                      marginBottom: 3,
                    }}
                  >
                    Ball Zone: {ZONE_ROW_NAMES[activeZone.row]} — {ZONE_COL_NAMES[activeZone.col]}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--cm-text-muted)' }}>
                    Customized zones in this phase:{' '}
                    <strong className="cm-num" style={{ color: 'var(--cm-gold)' }}>
                      {customizedZoneKeys.size}/25
                    </strong>
                    {customizedZoneKeys.has(activeZoneKey) && (
                      <span style={{ color: 'var(--cm-cyan)', marginLeft: 6 }}>(Edited)</span>
                    )}
                  </div>
                  <div style={{ fontSize: 10.5, color: 'var(--cm-text-dim)', marginTop: 2 }}>
                    Dashed lines show shift from base shape. Top row = Opp. Box, Bottom = Own Box.
                  </div>
                </div>

                {/* Compact clickable 5x5 grid */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(5, 22px)',
                    gap: 2,
                    padding: 3,
                    background: 'rgba(13, 66, 32, 0.75)',
                    border: '1px solid var(--cm-border)',
                  }}
                  title="5x5 Pitch Zone Selector (Top = Opponent Box, Bottom = Own Box)"
                >
                  {Array.from({ length: 5 }, (_, r) =>
                    Array.from({ length: 5 }, (_, c) => {
                      const key = `${r}-${c}`;
                      const isActive = activeZone.row === r && activeZone.col === c;
                      const isCustom = customizedZoneKeys.has(key);
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setActiveZone({ row: r, col: c })}
                          title={`${ZONE_ROW_NAMES[r]} · ${ZONE_COL_NAMES[c]}`}
                          style={{
                            width: 22,
                            height: 16,
                            padding: 0,
                            cursor: 'pointer',
                            border: `1px solid ${
                              isActive
                                ? pitchMode === 'wib'
                                  ? '#4ade80'
                                  : '#fb923c'
                                : isCustom
                                  ? '#ffd84d'
                                  : 'rgba(255,255,255,0.2)'
                            }`,
                            background: isActive
                              ? pitchMode === 'wib'
                                ? 'rgba(74, 222, 128, 0.55)'
                                : 'rgba(251, 146, 60, 0.55)'
                              : isCustom
                                ? 'rgba(255, 216, 77, 0.22)'
                                : 'rgba(6, 12, 24, 0.55)',
                            color: '#fff',
                            fontSize: 9,
                            fontFamily: 'var(--cm-font-mono)',
                          }}
                        >
                          {isActive ? '●' : isCustom ? '·' : ''}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: CLASSIC CM 01/02 TEAM INSTRUCTIONS & ROLES */}
        <div className="cm-panel">
          <div className="cm-panel-header">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Shield size={13} />
              Team Instructions
            </span>
          </div>

          <div className="cm-panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Mentality */}
            <div>
              <div
                style={{
                  fontSize: 10.5,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: 'var(--cm-gold)',
                  marginBottom: 5,
                }}
              >
                Mentality
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                {MENTALITY_OPTIONS.map((opt) => {
                  const active = tactics.instructions.mentality === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      className={`cm-btn cm-btn-sm ${active ? 'cm-btn-gold' : ''}`}
                      onClick={() => handleUpdateInstructions({ mentality: opt.value })}
                      title={opt.hint}
                      style={{ justifyContent: 'center', padding: '5px 6px' }}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
              <div style={{ fontSize: 10.5, color: 'var(--cm-text-dim)', marginTop: 4 }}>
                {MENTALITY_OPTIONS.find((m) => m.value === tactics.instructions.mentality)?.hint}
              </div>
            </div>

            {/* Passing Style */}
            <div>
              <div
                style={{
                  fontSize: 10.5,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: 'var(--cm-gold)',
                  marginBottom: 5,
                }}
              >
                Passing Style
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                {PASSING_OPTIONS.map((opt) => {
                  const active = tactics.instructions.passing === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      className={`cm-btn cm-btn-sm ${active ? 'cm-btn-primary' : ''}`}
                      onClick={() => handleUpdateInstructions({ passing: opt.value })}
                      title={opt.hint}
                      style={{ justifyContent: 'center', padding: '5px 6px' }}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
              <div style={{ fontSize: 10.5, color: 'var(--cm-text-dim)', marginTop: 4 }}>
                {PASSING_OPTIONS.find((p) => p.value === tactics.instructions.passing)?.hint}
              </div>
            </div>

            {/* Tackling */}
            <div>
              <div
                style={{
                  fontSize: 10.5,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: 'var(--cm-gold)',
                  marginBottom: 5,
                }}
              >
                Tackling
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
                {TACKLING_OPTIONS.map((opt) => {
                  const active = tactics.instructions.tackling === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      className={`cm-btn cm-btn-sm ${
                        active
                          ? opt.value === 'Hard'
                            ? 'cm-btn-danger'
                            : 'cm-btn-primary'
                          : ''
                      }`}
                      onClick={() => handleUpdateInstructions({ tackling: opt.value })}
                      title={opt.hint}
                      style={{ justifyContent: 'center', padding: '5px 6px' }}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
              <div style={{ fontSize: 10.5, color: 'var(--cm-text-dim)', marginTop: 4 }}>
                {TACKLING_OPTIONS.find((t) => t.value === tactics.instructions.tackling)?.hint}
              </div>
            </div>

            {/* Metallic Tactical Toggles */}
            <div>
              <div
                style={{
                  fontSize: 10.5,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: 'var(--cm-gold)',
                  marginBottom: 5,
                }}
              >
                Special Instructions
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {(
                  [
                    {
                      key: 'pressing',
                      label: 'Pressing',
                      desc: 'Close down opponents high up pitch (+stamina drain)',
                    },
                    {
                      key: 'offsideTrap',
                      label: 'Offside Trap',
                      desc: 'Step defensive line up to catch runners offside',
                    },
                    {
                      key: 'counterAttack',
                      label: 'Counter-Attack',
                      desc: 'Break rapidly into space after winning possession',
                    },
                    {
                      key: 'menBehindBall',
                      label: 'Men Behind Ball',
                      desc: 'Drop wingers & midfielders deep when out of possession',
                    },
                  ] as const
                ).map((item) => {
                  const checked = tactics.instructions[item.key];
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => handleUpdateInstructions({ [item.key]: !checked })}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                        width: '100%',
                        padding: '6px 8px',
                        textAlign: 'left',
                        cursor: 'pointer',
                        background: checked
                          ? 'linear-gradient(90deg, rgba(56, 232, 213, 0.18) 0%, rgba(18, 34, 60, 0.92) 100%)'
                          : 'rgba(8, 16, 30, 0.72)',
                        border: `1px solid ${checked ? 'var(--cm-cyan)' : 'var(--cm-border)'}`,
                        boxShadow: 'var(--cm-bevel)',
                        color: checked ? '#ffffff' : 'var(--cm-text-muted)',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 12 }}>{item.label}</div>
                        <div style={{ fontSize: 10, color: 'var(--cm-text-dim)' }}>{item.desc}</div>
                      </div>
                      <span
                        className="cm-num"
                        style={{
                          padding: '2px 6px',
                          fontSize: 10,
                          fontWeight: 800,
                          background: checked ? 'rgba(56, 232, 213, 0.25)' : 'rgba(0,0,0,0.45)',
                          border: `1px solid ${checked ? 'var(--cm-cyan)' : 'rgba(148,163,184,0.3)'}`,
                          color: checked ? 'var(--cm-cyan)' : 'var(--cm-text-dim)',
                          flexShrink: 0,
                        }}
                      >
                        {checked ? 'ON' : 'OFF'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Captain & Set-Piece Takers */}
            <div
              style={{
                borderTop: '1px solid var(--cm-border-subtle)',
                paddingTop: 10,
                display: 'flex',
                flexDirection: 'column',
                gap: 7,
              }}
            >
              <div
                style={{
                  fontSize: 10.5,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: 'var(--cm-gold)',
                }}
              >
                Captain &amp; Set Pieces
              </div>

              <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 11, color: 'var(--cm-text-muted)' }}>
                Captain (Influence)
                <select
                  className="cm-select"
                  value={tactics.captainId ?? ''}
                  onChange={(e) =>
                    onUpdateTactics({ ...tactics, captainId: e.target.value || null })
                  }
                  style={{ fontSize: 11.5 }}
                >
                  <option value="">Auto-Select</option>
                  {startingPlayersList.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.shortName} (INF {p.attributes.mental.influence})
                    </option>
                  ))}
                </select>
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 11, color: 'var(--cm-text-muted)' }}>
                Penalty Taker (Penalties)
                <select
                  className="cm-select"
                  value={tactics.penaltyTakerId ?? ''}
                  onChange={(e) =>
                    onUpdateTactics({ ...tactics, penaltyTakerId: e.target.value || null })
                  }
                  style={{ fontSize: 11.5 }}
                >
                  <option value="">Auto-Select</option>
                  {startingPlayersList.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.shortName} (PEN {p.attributes.technical.penalties})
                    </option>
                  ))}
                </select>
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 11, color: 'var(--cm-text-muted)' }}>
                Free Kicks &amp; Corners (Set Pieces)
                <select
                  className="cm-select"
                  value={tactics.setPieceTakerId ?? ''}
                  onChange={(e) =>
                    onUpdateTactics({ ...tactics, setPieceTakerId: e.target.value || null })
                  }
                  style={{ fontSize: 11.5 }}
                >
                  <option value="">Auto-Select</option>
                  {startingPlayersList.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.shortName} (SP {p.attributes.technical.setPieces} / CRO {p.attributes.technical.crossing})
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TacticsView;
