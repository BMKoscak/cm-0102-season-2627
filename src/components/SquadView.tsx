import React, { useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Building2,
  ClipboardList,
  Cross,
  DollarSign,
  Search,
  Shield,
  Sliders,
  Sparkles,
  Star,
  Tag,
  Users,
  Wand2,
} from 'lucide-react';
import type { SquadViewProps } from '../types/contracts';
import type {
  Club,
  League,
  MoraleLevel,
  Player,
  PositionCategory,
  PositionCode,
} from '../types/game';
import { calculateOverallRating, getPositionCategory } from '../engine/attributes';
import { formatCurrency } from '../engine/seasonEngine';

type SortKey =
  | 'picked'
  | 'number'
  | 'name'
  | 'pos'
  | 'age'
  | 'nat'
  | 'cond'
  | 'morale'
  | 'form'
  | 'apps'
  | 'goals'
  | 'assists'
  | 'avr'
  | 'value'
  | 'wage';

type SortDir = 'asc' | 'desc';

const POSITION_ORDER: Record<PositionCode, number> = {
  GK: 0,
  DL: 1,
  DC: 2,
  DR: 3,
  DMC: 4,
  ML: 5,
  MC: 6,
  MR: 7,
  AMC: 8,
  FL: 9,
  FC: 10,
  FR: 11,
};

const MORALE_RANK: Record<MoraleLevel, number> = {
  Superb: 6,
  'Very Good': 5,
  Good: 4,
  Okay: 3,
  Poor: 2,
  'Very Poor': 1,
};

const MORALE_COLOR: Record<MoraleLevel, string> = {
  Superb: '#4ade80',
  'Very Good': '#86efac',
  Good: '#38e8d5',
  Okay: '#cbd5e1',
  Poor: '#fbbf24',
  'Very Poor': '#f87171',
};

const POS_CLASS: Record<PositionCategory, string> = {
  GK: 'cm-pos-gk',
  DEF: 'cm-pos-def',
  MID: 'cm-pos-mid',
  FWD: 'cm-pos-fwd',
};

// Remember the user's club ID whenever viewing own squad so AI club inspection can show "Back to My Squad"
let lastKnownUserClubId: string | null = null;

function getConditionColor(cond: number): string {
  if (cond >= 88) return '#4ade80';
  if (cond >= 75) return '#a3e635';
  if (cond >= 62) return '#facc15';
  return '#f87171';
}

function getRatingColor(avr: number): string {
  if (avr >= 7.5) return '#ffd84d';
  if (avr >= 7.0) return '#38e8d5';
  if (avr >= 6.5) return '#e6eef9';
  return '#f87171';
}

function getAvgForm(form: number[]): number {
  if (!form || form.length === 0) return 0;
  return form.reduce((s, v) => s + v, 0) / form.length;
}

export const SquadView: React.FC<SquadViewProps> = ({
  club,
  isUserClub,
  squad,
  tactics,
  leagues,
  clubs,
  onSelectPlayer,
  onSelectClub,
  onOpenTactics,
  onAutoPick,
  onToggleTransferList,
}) => {
  if (isUserClub) {
    lastKnownUserClubId = club.id;
  }

  const [sortKey, setSortKey] = useState<SortKey>('picked');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [posFilter, setPosFilter] = useState<'ALL' | PositionCategory>('ALL');
  const [nameFilter, setNameFilter] = useState('');
  const [switcherLeagueId, setSwitcherLeagueId] = useState<string>(club.leagueId);

  const activeLeague: League | undefined = leagues[club.leagueId];
  const userClubRef: Club | null =
    !isUserClub && lastKnownUserClubId && clubs[lastKnownUserClubId]
      ? clubs[lastKnownUserClubId]
      : null;

  // Map picked status from tactics (XI role label + bench S1..S7)
  const pickedMap = useMemo(() => {
    const map = new Map<
      string,
      { label: string; rank: number; kind: 'xi' | 'bench' }
    >();
    tactics.startingXI.forEach((slot, idx) => {
      if (slot.playerId) {
        map.set(slot.playerId, {
          label: slot.roleLabel,
          rank: idx,
          kind: 'xi',
        });
      }
    });
    tactics.bench.forEach((pid, idx) => {
      if (pid && !map.has(pid)) {
        map.set(pid, {
          label: `S${idx + 1}`,
          rank: 20 + idx,
          kind: 'bench',
        });
      }
    });
    return map;
  }, [tactics]);

  // Sorted leagues for Quick Club Switcher
  const sortedLeagues = useMemo(() => {
    return Object.values(leagues).sort(
      (a, b) =>
        a.country.localeCompare(b.country) ||
        a.tier - b.tier ||
        b.reputation - a.reputation
    );
  }, [leagues]);

  // Clubs in the currently chosen switcher league (fallback to current club's league)
  const effectiveSwitcherLeagueId = leagues[switcherLeagueId]
    ? switcherLeagueId
    : club.leagueId;

  const switcherClubs = useMemo(() => {
    return Object.values(clubs)
      .filter((c) => c.leagueId === effectiveSwitcherLeagueId)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [clubs, effectiveSwitcherLeagueId]);

  // Squad KPIs
  const squadSummary = useMemo(() => {
    const total = squad.length;
    const avgAge =
      total > 0 ? squad.reduce((s, p) => s + p.age, 0) / total : 0;
    const avgOvr =
      total > 0
        ? squad.reduce((s, p) => s + calculateOverallRating(p), 0) / total
        : 0;
    const totalValue = squad.reduce((s, p) => s + p.value, 0);
    const weeklyWages = squad.reduce((s, p) => s + p.wage, 0);
    const injured = squad.filter((p) => p.injury !== null).length;
    const suspended = squad.filter((p) => p.suspendedMatches > 0).length;
    const wonderkids = squad.filter((p) => p.isWonderkid).length;
    const listed = squad.filter((p) => p.transferListed).length;
    const xiCount = tactics.startingXI.filter((s) => Boolean(s.playerId)).length;
    return {
      total,
      avgAge,
      avgOvr,
      totalValue,
      weeklyWages,
      injured,
      suspended,
      wonderkids,
      listed,
      xiCount,
    };
  }, [squad, tactics.startingXI]);

  // Filtered and sorted squad rows
  const displaySquad = useMemo(() => {
    const q = nameFilter.trim().toLowerCase();
    const filtered = squad.filter((p) => {
      if (posFilter !== 'ALL') {
        const primaryCat = getPositionCategory(p.positions[0] ?? 'MC');
        const matchesAny = p.positions.some(
          (pos) => getPositionCategory(pos) === posFilter
        );
        if (primaryCat !== posFilter && !matchesAny) return false;
      }
      if (q) {
        if (
          !p.name.toLowerCase().includes(q) &&
          !p.nationality.toLowerCase().includes(q) &&
          !p.positions.some((pos) => pos.toLowerCase().includes(q))
        ) {
          return false;
        }
      }
      return true;
    });

    const dir = sortDir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'picked': {
          const pa = pickedMap.get(a.id)?.rank ?? 100 + (POSITION_ORDER[a.positions[0]] ?? 99);
          const pb = pickedMap.get(b.id)?.rank ?? 100 + (POSITION_ORDER[b.positions[0]] ?? 99);
          cmp = pa - pb || b.currentAbility - a.currentAbility;
          break;
        }
        case 'number':
          cmp = (a.squadNumber ?? 999) - (b.squadNumber ?? 999);
          break;
        case 'name':
          cmp = a.name.localeCompare(b.name);
          break;
        case 'pos':
          cmp =
            (POSITION_ORDER[a.positions[0]] ?? 99) -
            (POSITION_ORDER[b.positions[0]] ?? 99);
          break;
        case 'age':
          cmp = a.age - b.age;
          break;
        case 'nat':
          cmp = a.nationalityCode.localeCompare(b.nationalityCode);
          break;
        case 'cond':
          cmp = a.condition - b.condition;
          break;
        case 'morale':
          cmp = (MORALE_RANK[a.morale] ?? 0) - (MORALE_RANK[b.morale] ?? 0);
          break;
        case 'form':
          cmp = getAvgForm(a.form) - getAvgForm(b.form);
          break;
        case 'apps':
          cmp =
            a.seasonStats.appearances +
            a.seasonStats.subAppearances * 0.5 -
            (b.seasonStats.appearances + b.seasonStats.subAppearances * 0.5);
          break;
        case 'goals':
          cmp = a.seasonStats.goals - b.seasonStats.goals;
          break;
        case 'assists':
          cmp = a.seasonStats.assists - b.seasonStats.assists;
          break;
        case 'avr':
          cmp = a.seasonStats.averageRating - b.seasonStats.averageRating;
          break;
        case 'value':
          cmp = a.value - b.value;
          break;
        case 'wage':
          cmp = a.wage - b.wage;
          break;
      }
      if (cmp === 0) return a.name.localeCompare(b.name);
      return cmp * dir;
    });
  }, [squad, posFilter, nameFilter, sortKey, sortDir, pickedMap]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      // Natural initial sort direction per column
      const descDefault: SortKey[] = [
        'cond',
        'morale',
        'form',
        'apps',
        'goals',
        'assists',
        'avr',
        'value',
        'wage',
      ];
      setSortDir(descDefault.includes(key) ? 'desc' : 'asc');
    }
  };

  const renderSortIcon = (key: SortKey) => {
    if (sortKey !== key) return null;
    return sortDir === 'asc' ? (
      <ArrowUp size={11} style={{ marginLeft: 3, verticalAlign: 'middle' }} />
    ) : (
      <ArrowDown size={11} style={{ marginLeft: 3, verticalAlign: 'middle' }} />
    );
  };

  const repStars = Math.max(1, Math.min(20, Math.round(club.reputation / 500)));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Club Header Panel */}
      <div
        className="cm-panel"
        style={{
          borderLeft: `4px solid ${club.colors.primary}`,
          position: 'relative',
        }}
      >
        <div
          className="cm-panel-header"
          style={{
            background: `linear-gradient(90deg, ${club.colors.primary}44 0%, rgba(20, 36, 62, 0.96) 55%, rgba(12, 22, 42, 0.96) 100%)`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            {club.badgeUrl ? (
              <img
                src={club.badgeUrl}
                alt={club.name}
                style={{
                  width: 30,
                  height: 30,
                  objectFit: 'contain',
                  flexShrink: 0,
                  filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.8))',
                }}
              />
            ) : (
              <div
                className="cm-club-shield"
                style={{
                  width: 30,
                  height: 30,
                  fontSize: 10.5,
                  backgroundColor: club.colors.primary,
                  color: club.colors.text,
                  borderColor: club.colors.secondary,
                }}
              >
                {club.threeLetterCode}
              </div>
            )}
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  flexWrap: 'wrap',
                }}
              >
                <span style={{ fontSize: 15, fontWeight: 800, color: '#ffffff', textTransform: 'none' }}>
                  {club.name}
                </span>
                {activeLeague && (
                  <span
                    style={{
                      fontSize: 10.5,
                      padding: '1px 6px',
                      background: 'rgba(255, 216, 77, 0.16)',
                      border: '1px solid rgba(255, 216, 77, 0.45)',
                      color: 'var(--cm-gold)',
                    }}
                  >
                    {activeLeague.name} · T{activeLeague.tier}
                  </span>
                )}
                {!isUserClub && (
                  <span
                    style={{
                      fontSize: 10,
                      padding: '1px 6px',
                      background: 'rgba(56, 232, 213, 0.16)',
                      border: '1px solid rgba(56, 232, 213, 0.45)',
                      color: 'var(--cm-cyan)',
                    }}
                  >
                    SCOUTING CLUB
                  </span>
                )}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            {userClubRef && (
              <button
                type="button"
                className="cm-btn cm-btn-sm cm-btn-gold"
                onClick={() => onSelectClub(userClubRef.id)}
              >
                <ArrowLeft size={12} />
                <span>Back to My Squad ({userClubRef.shortName})</span>
              </button>
            )}
            {isUserClub && (
              <>
                <button
                  type="button"
                  className="cm-btn cm-btn-sm cm-btn-gold"
                  onClick={onAutoPick}
                  title="Let Assistant Manager select best available Starting XI and Subs"
                >
                  <Wand2 size={12} />
                  <span>Auto-Pick XI</span>
                </button>
                <button
                  type="button"
                  className="cm-btn cm-btn-sm cm-btn-primary"
                  onClick={onOpenTactics}
                >
                  <Sliders size={12} />
                  <span>Open Tactics ({tactics.formation})</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Club Meta & Financial Strip */}
        <div
          className="cm-panel-body"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(195px, 1fr))',
            gap: 8,
            padding: '8px 10px',
            background: 'rgba(6, 12, 24, 0.45)',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div style={{ fontSize: 10.5, color: 'var(--cm-text-dim)', textTransform: 'uppercase' }}>
              Stadium & City
            </div>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: 5 }}>
              <Building2 size={13} color="#ffd84d" />
              <span>{club.stadium.name}</span>
            </div>
            <div className="cm-num" style={{ fontSize: 11, color: 'var(--cm-text-muted)' }}>
              Cap: {club.stadium.capacity.toLocaleString()} · {club.city}, {club.country} (Est. {club.founded})
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div style={{ fontSize: 10.5, color: 'var(--cm-text-dim)', textTransform: 'uppercase' }}>
              Manager & Reputation
            </div>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: 5 }}>
              <Shield size={13} color="#38e8d5" />
              <span>{club.managerName}</span>
            </div>
            <div className="cm-num" style={{ fontSize: 11, color: 'var(--cm-cyan)' }}>
              Rep: {repStars}/20 ({club.reputation.toLocaleString()}) · {club.boardExpectation}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div style={{ fontSize: 10.5, color: 'var(--cm-text-dim)', textTransform: 'uppercase' }}>
              Club Finances
            </div>
            <div className="cm-num" style={{ fontSize: 12.5, fontWeight: 700, color: club.finances.balance >= 0 ? 'var(--cm-lime)' : 'var(--cm-red)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <DollarSign size={13} />
              <span>Bal: {formatCurrency(club.finances.balance)}</span>
            </div>
            <div className="cm-num" style={{ fontSize: 11, color: 'var(--cm-gold)' }}>
              Budget: {formatCurrency(club.finances.transferBudget)} · Wages:{' '}
              {formatCurrency(squadSummary.weeklyWages)}/wk
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div style={{ fontSize: 10.5, color: 'var(--cm-text-dim)', textTransform: 'uppercase' }}>
              Squad Overview
            </div>
            <div className="cm-num" style={{ fontSize: 12.5, fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: 5 }}>
              <Users size={13} color="#60a5fa" />
              <span>
                {squadSummary.total} Players · XI: {squadSummary.xiCount}/11 · Avg Age{' '}
                {squadSummary.avgAge.toFixed(1)}
              </span>
            </div>
            <div className="cm-num" style={{ fontSize: 11, color: 'var(--cm-text-muted)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <span>Val: {formatCurrency(squadSummary.totalValue)}</span>
              {squadSummary.wonderkids > 0 && (
                <span style={{ color: 'var(--cm-gold)' }}>★ {squadSummary.wonderkids} WK</span>
              )}
              {squadSummary.injured > 0 && (
                <span style={{ color: 'var(--cm-red)' }}>✚ {squadSummary.injured} Inj</span>
              )}
              {squadSummary.suspended > 0 && (
                <span style={{ color: 'var(--cm-amber)' }}>■ {squadSummary.suspended} Sus</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Filter & Quick Club Switcher Bar */}
      <div
        className="cm-panel"
        style={{
          padding: '7px 10px',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 8,
        }}
      >
        {/* Left: Position & Name Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {(['ALL', 'GK', 'DEF', 'MID', 'FWD'] as const).map((cat) => (
            <button
              key={cat}
              type="button"
              className={`cm-tab ${posFilter === cat ? 'is-active' : ''}`}
              onClick={() => setPosFilter(cat)}
              style={{ padding: '3px 9px', fontSize: 11.5 }}
            >
              {cat}
            </button>
          ))}

          <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
            <Search
              size={13}
              color="#9ab0cf"
              style={{ position: 'absolute', left: 7, pointerEvents: 'none' }}
            />
            <input
              type="text"
              className="cm-input"
              value={nameFilter}
              onChange={(e) => setNameFilter(e.target.value)}
              placeholder="Filter player, nation, pos..."
              style={{ paddingLeft: 24, width: 180, fontSize: 12 }}
            />
          </div>
        </div>

        {/* Right: Quick Club Switcher across all 18 leagues */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span
            style={{
              fontSize: 11,
              color: 'var(--cm-text-muted)',
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <ClipboardList size={12} color="#ffd84d" />
            Inspect Club:
          </span>
          <select
            className="cm-select"
            value={effectiveSwitcherLeagueId}
            onChange={(e) => {
              const nextLgId = e.target.value;
              setSwitcherLeagueId(nextLgId);
              const firstClub = Object.values(clubs)
                .filter((c) => c.leagueId === nextLgId)
                .sort((a, b) => b.reputation - a.reputation)[0];
              if (firstClub) onSelectClub(firstClub.id);
            }}
            style={{ fontSize: 11.5, padding: '4px 7px', maxWidth: 185 }}
          >
            {sortedLeagues.map((lg) => (
              <option key={lg.id} value={lg.id}>
                [{lg.countryCode} T{lg.tier}] {lg.shortName}
              </option>
            ))}
          </select>

          <select
            className="cm-select"
            value={club.id}
            onChange={(e) => onSelectClub(e.target.value)}
            style={{ fontSize: 11.5, padding: '4px 7px', maxWidth: 190 }}
          >
            {switcherClubs.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Dense CM 01/02 Squad Table */}
      <div className="cm-panel">
        <div className="cm-table-wrap" style={{ maxHeight: 'calc(100vh - 285px)', overflowY: 'auto' }}>
          <table className="cm-table">
            <thead>
              <tr>
                <th className="is-sortable" onClick={() => handleSort('picked')}>
                  PKD{renderSortIcon('picked')}
                </th>
                <th
                  className="is-sortable"
                  style={{ textAlign: 'right' }}
                  onClick={() => handleSort('number')}
                >
                  No.{renderSortIcon('number')}
                </th>
                <th className="is-sortable" onClick={() => handleSort('name')}>
                  Name{renderSortIcon('name')}
                </th>
                <th className="is-sortable" onClick={() => handleSort('pos')}>
                  Pos{renderSortIcon('pos')}
                </th>
                <th
                  className="is-sortable"
                  style={{ textAlign: 'right' }}
                  onClick={() => handleSort('age')}
                >
                  Age{renderSortIcon('age')}
                </th>
                <th className="is-sortable" onClick={() => handleSort('nat')}>
                  Nat{renderSortIcon('nat')}
                </th>
                <th className="is-sortable" onClick={() => handleSort('cond')}>
                  Cond{renderSortIcon('cond')}
                </th>
                <th className="is-sortable" onClick={() => handleSort('morale')}>
                  Morale{renderSortIcon('morale')}
                </th>
                <th className="is-sortable" onClick={() => handleSort('form')}>
                  Form{renderSortIcon('form')}
                </th>
                <th
                  className="is-sortable"
                  style={{ textAlign: 'right' }}
                  onClick={() => handleSort('apps')}
                >
                  Apps{renderSortIcon('apps')}
                </th>
                <th
                  className="is-sortable"
                  style={{ textAlign: 'right' }}
                  onClick={() => handleSort('goals')}
                >
                  Gls{renderSortIcon('goals')}
                </th>
                <th
                  className="is-sortable"
                  style={{ textAlign: 'right' }}
                  onClick={() => handleSort('assists')}
                >
                  Ast{renderSortIcon('assists')}
                </th>
                <th
                  className="is-sortable"
                  style={{ textAlign: 'right' }}
                  onClick={() => handleSort('avr')}
                >
                  AvR{renderSortIcon('avr')}
                </th>
                <th
                  className="is-sortable"
                  style={{ textAlign: 'right' }}
                  onClick={() => handleSort('value')}
                >
                  Value{renderSortIcon('value')}
                </th>
                <th
                  className="is-sortable"
                  style={{ textAlign: 'right' }}
                  onClick={() => handleSort('wage')}
                >
                  Wage{renderSortIcon('wage')}
                </th>
                {isUserClub && <th style={{ textAlign: 'center' }}>List</th>}
              </tr>
            </thead>
            <tbody>
              {displaySquad.map((player) => {
                const picked = pickedMap.get(player.id);
                const primaryPos = player.positions[0] ?? 'MC';
                const secondaryPos = player.positions.slice(1, 3);
                const posCat = getPositionCategory(primaryPos);
                const condColor = getConditionColor(player.condition);
                const isCaptain = tactics.captainId === player.id;
                const hasPlayed =
                  player.seasonStats.appearances + player.seasonStats.subAppearances > 0;
                const appsText =
                  player.seasonStats.subAppearances > 0
                    ? `${player.seasonStats.appearances} (${player.seasonStats.subAppearances})`
                    : `${player.seasonStats.appearances}`;

                return (
                  <tr
                    key={player.id}
                    className={picked?.kind === 'xi' ? 'is-selected-row' : undefined}
                  >
                    {/* Picked Pill */}
                    <td>
                      {picked ? (
                        <span
                          className="cm-num"
                          style={{
                            display: 'inline-block',
                            minWidth: 34,
                            textAlign: 'center',
                            padding: '1px 5px',
                            fontSize: 10.5,
                            fontWeight: 800,
                            background:
                              picked.kind === 'xi'
                                ? 'rgba(34, 197, 94, 0.25)'
                                : 'rgba(56, 232, 213, 0.18)',
                            border:
                              picked.kind === 'xi'
                                ? '1px solid rgba(74, 222, 128, 0.65)'
                                : '1px solid rgba(56, 232, 213, 0.5)',
                            color: picked.kind === 'xi' ? '#86efac' : '#38e8d5',
                          }}
                        >
                          {picked.label}
                        </span>
                      ) : (
                        <span className="cm-num" style={{ color: 'var(--cm-text-dim)', paddingLeft: 10 }}>
                          -
                        </span>
                      )}
                    </td>

                    {/* Squad Number */}
                    <td
                      className="cm-num"
                      style={{ textAlign: 'right', color: 'var(--cm-text-muted)', width: 32 }}
                    >
                      {player.squadNumber ?? '-'}
                    </td>

                    {/* Name + CM Status Badges */}
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <button
                          type="button"
                          className="cm-link"
                          onClick={() => onSelectPlayer(player.id)}
                          style={{
                            color: player.injury
                              ? '#fca5a5'
                              : picked?.kind === 'xi'
                                ? '#ffffff'
                                : '#dbeafe',
                          }}
                        >
                          {player.name}
                        </button>
                        {isCaptain && (
                          <span
                            title="Club Captain"
                            className="cm-num"
                            style={{
                              fontSize: 9.5,
                              fontWeight: 800,
                              padding: '0 4px',
                              background: 'rgba(255, 216, 77, 0.22)',
                              border: '1px solid var(--cm-gold)',
                              color: 'var(--cm-gold)',
                            }}
                          >
                            C
                          </span>
                        )}
                        {player.isWonderkid && (
                          <span
                            title="Wonderkid Prospect"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 2,
                              fontSize: 9.5,
                              fontWeight: 700,
                              padding: '0 4px',
                              background: 'rgba(250, 204, 21, 0.16)',
                              border: '1px solid rgba(250, 204, 21, 0.5)',
                              color: '#ffd84d',
                            }}
                          >
                            <Star size={9} fill="#ffd84d" />
                            WK
                          </span>
                        )}
                        {player.injury && (
                          <span
                            title={`Injured: ${player.injury.type} (${player.injury.daysRemaining}d)`}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 2,
                              fontSize: 9.5,
                              fontWeight: 700,
                              padding: '0 4px',
                              background: 'rgba(220, 38, 38, 0.28)',
                              border: '1px solid #f87171',
                              color: '#fecaca',
                            }}
                          >
                            <Cross size={9} />
                            {player.injury.daysRemaining}d
                          </span>
                        )}
                        {player.suspendedMatches > 0 && (
                          <span
                            title={`Suspended for ${player.suspendedMatches} match(es)`}
                            style={{
                              fontSize: 9.5,
                              fontWeight: 800,
                              padding: '0 4px',
                              background:
                                player.suspendedMatches > 1
                                  ? 'rgba(220, 38, 38, 0.35)'
                                  : 'rgba(234, 179, 8, 0.28)',
                              border:
                                player.suspendedMatches > 1
                                  ? '1px solid #ef4444'
                                  : '1px solid #facc15',
                              color: player.suspendedMatches > 1 ? '#fca5a5' : '#fde047',
                            }}
                          >
                            SUS {player.suspendedMatches}
                          </span>
                        )}
                        {player.transferListed && (
                          <span
                            title="Transfer Listed"
                            style={{
                              fontSize: 9.5,
                              fontWeight: 700,
                              padding: '0 4px',
                              background: 'rgba(245, 158, 11, 0.22)',
                              border: '1px solid rgba(251, 191, 36, 0.6)',
                              color: '#fbbf24',
                            }}
                          >
                            LST
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Position */}
                    <td>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <span className={`cm-pos-pill ${POS_CLASS[posCat]}`}>
                          {primaryPos}
                        </span>
                        {secondaryPos.length > 0 && (
                          <span
                            className="cm-num"
                            style={{ fontSize: 10.5, color: 'var(--cm-text-dim)' }}
                          >
                            /{secondaryPos.join('/')}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Age */}
                    <td className="cm-num" style={{ textAlign: 'right' }}>
                      {player.age}
                    </td>

                    {/* Nationality */}
                    <td
                      className="cm-num"
                      title={player.nationality}
                      style={{ color: 'var(--cm-text-muted)', fontSize: 11.5 }}
                    >
                      {player.nationalityCode}
                    </td>

                    {/* Condition % Bar */}
                    <td>
                      <div className="cm-cond-bar">
                        <div className="cm-cond-track">
                          <div
                            className="cm-cond-fill"
                            style={{
                              width: `${Math.max(0, Math.min(100, player.condition))}%`,
                              backgroundColor: condColor,
                            }}
                          />
                        </div>
                        <span
                          className="cm-num"
                          style={{
                            fontSize: 11,
                            color: condColor,
                            minWidth: 32,
                            textAlign: 'right',
                          }}
                        >
                          {Math.round(player.condition)}%
                        </span>
                      </div>
                    </td>

                    {/* Morale */}
                    <td
                      style={{
                        fontSize: 11.5,
                        fontWeight: 600,
                        color: MORALE_COLOR[player.morale] ?? '#cbd5e1',
                      }}
                    >
                      {player.morale}
                    </td>

                    {/* Form (last 5 ratings) */}
                    <td>
                      {player.form && player.form.length > 0 ? (
                        <div style={{ display: 'inline-flex', gap: 2 }}>
                          {player.form.slice(-5).map((r, i) => (
                            <span
                              key={i}
                              className="cm-num"
                              title={`Recent match rating: ${r.toFixed(1)}`}
                              style={{
                                fontSize: 10,
                                padding: '0 3px',
                                background: 'rgba(6, 12, 24, 0.7)',
                                border: '1px solid rgba(124, 160, 208, 0.22)',
                                color: getRatingColor(r),
                                fontWeight: 700,
                              }}
                            >
                              {Math.round(r)}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="cm-num" style={{ color: 'var(--cm-text-dim)' }}>
                          —
                        </span>
                      )}
                    </td>

                    {/* Apps */}
                    <td className="cm-num" style={{ textAlign: 'right', color: 'var(--cm-text-muted)' }}>
                      {appsText}
                    </td>

                    {/* Goals */}
                    <td
                      className="cm-num"
                      style={{
                        textAlign: 'right',
                        fontWeight: player.seasonStats.goals > 0 ? 700 : 400,
                        color: player.seasonStats.goals > 0 ? 'var(--cm-gold)' : 'var(--cm-text-dim)',
                      }}
                    >
                      {player.seasonStats.goals}
                    </td>

                    {/* Assists */}
                    <td
                      className="cm-num"
                      style={{
                        textAlign: 'right',
                        color: player.seasonStats.assists > 0 ? 'var(--cm-cyan)' : 'var(--cm-text-dim)',
                      }}
                    >
                      {player.seasonStats.assists}
                    </td>

                    {/* Average Rating */}
                    <td
                      className="cm-num"
                      style={{
                        textAlign: 'right',
                        fontWeight: 700,
                        color: hasPlayed
                          ? getRatingColor(player.seasonStats.averageRating)
                          : 'var(--cm-text-dim)',
                      }}
                    >
                      {hasPlayed ? player.seasonStats.averageRating.toFixed(2) : '-'}
                    </td>

                    {/* Value */}
                    <td className="cm-num" style={{ textAlign: 'right', color: 'var(--cm-lime)' }}>
                      {formatCurrency(player.value)}
                    </td>

                    {/* Wage */}
                    <td className="cm-num" style={{ textAlign: 'right', color: 'var(--cm-text-muted)' }}>
                      {formatCurrency(player.wage)}/wk
                    </td>

                    {/* Quick Transfer List Toggle (User Club only) */}
                    {isUserClub && (
                      <td style={{ textAlign: 'center' }}>
                        <button
                          type="button"
                          className="cm-btn cm-btn-sm"
                          onClick={() => onToggleTransferList(player.id)}
                          title={
                            player.transferListed
                              ? 'Remove from Transfer List'
                              : 'Place on Transfer List'
                          }
                          style={{
                            padding: '1px 6px',
                            fontSize: 10.5,
                            borderColor: player.transferListed ? '#fbbf24' : undefined,
                            color: player.transferListed ? '#fde047' : 'var(--cm-text-muted)',
                            background: player.transferListed
                              ? 'rgba(180, 120, 12, 0.35)'
                              : undefined,
                          }}
                        >
                          <Tag size={10} />
                          <span>{player.transferListed ? 'Listed' : 'List'}</span>
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}

              {displaySquad.length === 0 && (
                <tr>
                  <td
                    colSpan={isUserClub ? 16 : 15}
                    style={{ textAlign: 'center', padding: 24, color: 'var(--cm-text-muted)' }}
                  >
                    <Sparkles size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                    No players match the current position or search filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default SquadView;
