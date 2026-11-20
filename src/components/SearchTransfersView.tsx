import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Bookmark,
  Check,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  FileSignature,
  Filter,
  Handshake,
  Plus,
  RotateCcw,
  Search,
  Sliders,
  Sparkles,
  Star,
  Trash2,
  X,
} from 'lucide-react';
import type { SearchTransfersViewProps } from '../types/contracts';
import type {
  GoalkeepingAttributes,
  MentalAttributes,
  PhysicalAttributes,
  Player,
  PositionCategory,
  PositionCode,
  SquadStatus,
  TechnicalAttributes,
} from '../types/game';
import {
  ATTRIBUTE_GROUPS,
  calculateOverallRating,
  estimateWeeklyWage,
  getPositionCategory,
} from '../engine/attributes';
import { formatCurrency, formatDateCM } from '../engine/seasonEngine';

type MainTab = 'search' | 'transfers';
type AvailabilityFilter = 'all' | 'free' | 'listed' | 'wonderkids' | 'shortlist';
type PositionFilterValue = 'ALL' | PositionCategory | PositionCode;
type SearchSortKey = 'name' | 'club' | 'pos' | 'age' | 'nat' | 'ovr' | 'avr' | 'value' | 'wage';
type SortDir = 'asc' | 'desc';

type AttrGroupName = 'technical' | 'mental' | 'physical' | 'goalkeeping';

interface AttributeOption {
  id: string; // e.g. 'technical.finishing'
  group: AttrGroupName;
  key: string;
  label: string;
}

interface AttributeRule {
  id: string;
  attrId: string;
  minValue: number;
}

const PAGE_SIZE = 50;

const POS_CLASS: Record<PositionCategory, string> = {
  GK: 'cm-pos-gk',
  DEF: 'cm-pos-def',
  MID: 'cm-pos-mid',
  FWD: 'cm-pos-fwd',
};

const EXACT_POSITIONS: PositionCode[] = [
  'GK',
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

const SQUAD_STATUSES: SquadStatus[] = [
  'Indispensable',
  'Important First Team',
  'Squad Rotation',
  'Backup',
  'Hot Prospect',
  'Not Needed',
];

const GK_ATTR_OPTIONS: AttributeOption[] = [
  { id: 'goalkeeping.handling', group: 'goalkeeping', key: 'handling', label: 'Handling (GK)' },
  { id: 'goalkeeping.reflexes', group: 'goalkeeping', key: 'reflexes', label: 'Reflexes (GK)' },
  { id: 'goalkeeping.oneOnOnes', group: 'goalkeeping', key: 'oneOnOnes', label: 'One on Ones (GK)' },
  { id: 'goalkeeping.positioning', group: 'goalkeeping', key: 'positioning', label: 'Positioning (GK)' },
];

function getPlayerAttrValue(player: Player, attrId: string): number {
  const [group, key] = attrId.split('.') as [AttrGroupName, string];
  if (group === 'technical') {
    return player.attributes.technical[key as keyof TechnicalAttributes] ?? 0;
  }
  if (group === 'mental') {
    return player.attributes.mental[key as keyof MentalAttributes] ?? 0;
  }
  if (group === 'physical') {
    return player.attributes.physical[key as keyof PhysicalAttributes] ?? 0;
  }
  if (group === 'goalkeeping') {
    return player.attributes.goalkeeping?.[key as keyof GoalkeepingAttributes] ?? 1;
  }
  return 0;
}

function getOfferStatusStyle(status: string): React.CSSProperties {
  switch (status) {
    case 'accepted':
    case 'completed':
      return {
        background: 'rgba(34, 197, 94, 0.25)',
        border: '1px solid #4ade80',
        color: '#86efac',
      };
    case 'countered':
      return {
        background: 'rgba(250, 204, 21, 0.24)',
        border: '1px solid #facc15',
        color: '#fde047',
      };
    case 'rejected':
      return {
        background: 'rgba(239, 68, 68, 0.25)',
        border: '1px solid #f87171',
        color: '#fca5a5',
      };
    case 'withdrawn':
      return {
        background: 'rgba(100, 116, 139, 0.25)',
        border: '1px solid #64748b',
        color: '#94a3b8',
      };
    default:
      return {
        background: 'rgba(56, 232, 213, 0.2)',
        border: '1px solid #38e8d5',
        color: '#38e8d5',
      };
  }
}

export const SearchTransfersView: React.FC<SearchTransfersViewProps> = ({
  userClub,
  leagues,
  clubs,
  players,
  shortlist,
  transferOffers,
  contractOffers,
  onSelectPlayer,
  onSelectClub,
  onToggleShortlist,
  onSubmitTransferOffer,
  onAcceptCounterOffer,
  onWithdrawTransferOffer,
  onSubmitContractOffer,
}) => {
  const [mainTab, setMainTab] = useState<MainTab>('search');

  // Search filters
  const [rawQuery, setRawQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [posFilter, setPosFilter] = useState<PositionFilterValue>('ALL');
  const [leagueFilter, setLeagueFilter] = useState<string>('ALL');
  const [nationFilter, setNationFilter] = useState<string>('ALL');
  const [maxAge, setMaxAge] = useState<number>(0); // 0 = Any
  const [maxValueMode, setMaxValueMode] = useState<string>('ANY');
  const [availability, setAvailability] = useState<AvailabilityFilter>('all');
  const [attrRules, setAttrRules] = useState<AttributeRule[]>([]);

  // Sorting & Pagination
  const [sortKey, setSortKey] = useState<SearchSortKey>('ovr');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [page, setPage] = useState<number>(1);

  // Transfer Centre sub-filter
  const [offerFilter, setOfferFilter] = useState<'active' | 'all' | 'outgoing' | 'incoming'>('active');

  // Inline Transfer / Contract Negotiation Modal
  const [negModal, setNegModal] = useState<{
    mode: 'transfer' | 'contract';
    player: Player;
    transferOfferId?: string;
    initialWage?: number;
    initialFee?: number;
  } | null>(null);

  // Negotiation form states
  const [offerFee, setOfferFee] = useState<number>(0);
  const [installmentMonths, setInstallmentMonths] = useState<0 | 6 | 12 | 18 | 24>(0);
  const [installmentAmount, setInstallmentAmount] = useState<number>(0);
  const [sellOnPercent, setSellOnPercent] = useState<number>(0);

  const [squadStatus, setSquadStatus] = useState<SquadStatus>('Important First Team');
  const [weeklyWage, setWeeklyWage] = useState<number>(10_000);
  const [signingOnFee, setSigningOnFee] = useState<number>(50_000);
  const [contractYears, setContractYears] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [useReleaseClause, setUseReleaseClause] = useState<boolean>(false);
  const [releaseClause, setReleaseClause] = useState<number>(5_000_000);

  // Debounce text input cleanly so typing stays 60fps across 7,000 players
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(rawQuery.trim().toLowerCase());
      setPage(1);
    }, 150);
    return () => window.clearTimeout(timer);
  }, [rawQuery]);

  // All attribute options built from engine's ATTRIBUTE_GROUPS
  const attributeOptions = useMemo<AttributeOption[]>(() => {
    const list: AttributeOption[] = [];
    for (const d of ATTRIBUTE_GROUPS.technical) {
      list.push({ id: `technical.${d.key}`, group: 'technical', key: d.key, label: d.label });
    }
    for (const d of ATTRIBUTE_GROUPS.mental) {
      list.push({ id: `mental.${d.key}`, group: 'mental', key: d.key, label: d.label });
    }
    for (const d of ATTRIBUTE_GROUPS.physical) {
      list.push({ id: `physical.${d.key}`, group: 'physical', key: d.key, label: d.label });
    }
    list.push(...GK_ATTR_OPTIONS);
    return list;
  }, []);

  // Pre-index all ~6,500-7,000 players + overall rating cache once per players map change
  const { allPlayers, overallById, nationsList } = useMemo(() => {
    const arr = Object.values(players);
    const ovrMap = new Map<string, number>();
    const nationSet = new Set<string>();
    for (let i = 0; i < arr.length; i++) {
      const p = arr[i];
      ovrMap.set(p.id, calculateOverallRating(p));
      if (p.nationality) nationSet.add(p.nationality);
    }
    return {
      allPlayers: arr,
      overallById: ovrMap,
      nationsList: Array.from(nationSet).sort((a, b) => a.localeCompare(b)),
    };
  }, [players]);

  const sortedLeagues = useMemo(() => {
    return Object.values(leagues).sort(
      (a, b) =>
        a.country.localeCompare(b.country) ||
        a.tier - b.tier ||
        b.reputation - a.reputation
    );
  }, [leagues]);

  const shortlistSet = useMemo(() => new Set(shortlist), [shortlist]);

  // Fast single-pass filter + sort across all ~7,000 players
  const filteredPlayers = useMemo(() => {
    const budgetCap = userClub.finances.transferBudget;
    let maxValNum: number | null = null;
    if (maxValueMode === 'FREE') maxValNum = 0;
    else if (maxValueMode === 'BUDGET') maxValNum = budgetCap;
    else if (maxValueMode !== 'ANY') maxValNum = Number(maxValueMode);

    const isCategoryPos =
      posFilter === 'GK' || posFilter === 'DEF' || posFilter === 'MID' || posFilter === 'FWD';

    const matched: Player[] = [];
    for (let i = 0; i < allPlayers.length; i++) {
      const p = allPlayers[i];

      // Availability
      if (availability === 'free' && p.clubId !== null) continue;
      if (availability === 'listed' && !p.transferListed) continue;
      if (availability === 'wonderkids' && !p.isWonderkid) continue;
      if (availability === 'shortlist' && !shortlistSet.has(p.id)) continue;

      // Age
      if (maxAge > 0 && p.age > maxAge) continue;

      // Max Value
      if (maxValNum !== null) {
        if (maxValNum === 0) {
          if (p.clubId !== null && p.value > 0) continue;
        } else if (p.value > maxValNum) {
          continue;
        }
      }

      // Nation
      if (nationFilter !== 'ALL' && p.nationality !== nationFilter) continue;

      // League
      if (leagueFilter !== 'ALL') {
        const pClub = p.clubId ? clubs[p.clubId] : null;
        if (!pClub || pClub.leagueId !== leagueFilter) continue;
      }

      // Position
      if (posFilter !== 'ALL') {
        if (isCategoryPos) {
          let hit = false;
          for (let j = 0; j < p.positions.length; j++) {
            if (getPositionCategory(p.positions[j]) === posFilter) {
              hit = true;
              break;
            }
          }
          if (!hit) continue;
        } else if (!p.positions.includes(posFilter as PositionCode)) {
          continue;
        }
      }

      // Minimum attribute rules (up to 3)
      if (attrRules.length > 0) {
        let passedAll = true;
        for (let r = 0; r < attrRules.length; r++) {
          const rule = attrRules[r];
          if (getPlayerAttrValue(p, rule.attrId) < rule.minValue) {
            passedAll = false;
            break;
          }
        }
        if (!passedAll) continue;
      }

      // Text query (name, shortName, club name, nationality)
      if (debouncedQuery) {
        const pClub = p.clubId ? clubs[p.clubId] : null;
        const hitName = p.name.toLowerCase().includes(debouncedQuery);
        const hitClub = pClub ? pClub.name.toLowerCase().includes(debouncedQuery) : false;
        const hitNat = p.nationality.toLowerCase().includes(debouncedQuery);
        if (!hitName && !hitClub && !hitNat) continue;
      }

      matched.push(p);
    }

    const dir = sortDir === 'asc' ? 1 : -1;
    matched.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'name':
          cmp = a.name.localeCompare(b.name);
          break;
        case 'club': {
          const ca = a.clubId ? clubs[a.clubId]?.shortName ?? '' : 'Free Agent';
          const cb = b.clubId ? clubs[b.clubId]?.shortName ?? '' : 'Free Agent';
          cmp = ca.localeCompare(cb);
          break;
        }
        case 'pos':
          cmp = (a.positions[0] ?? '').localeCompare(b.positions[0] ?? '');
          break;
        case 'age':
          cmp = a.age - b.age;
          break;
        case 'nat':
          cmp = a.nationalityCode.localeCompare(b.nationalityCode);
          break;
        case 'ovr':
          cmp = (overallById.get(a.id) ?? 0) - (overallById.get(b.id) ?? 0);
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
      if (cmp === 0) return b.currentAbility - a.currentAbility;
      return cmp * dir;
    });

    return matched;
  }, [
    allPlayers,
    availability,
    shortlistSet,
    maxAge,
    maxValueMode,
    userClub.finances.transferBudget,
    nationFilter,
    leagueFilter,
    clubs,
    posFilter,
    attrRules,
    debouncedQuery,
    sortKey,
    sortDir,
    overallById,
  ]);

  const totalPages = Math.max(1, Math.ceil(filteredPlayers.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagePlayers = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filteredPlayers.slice(start, start + PAGE_SIZE);
  }, [filteredPlayers, safePage]);

  // Active offers counts for Transfer Centre badge
  const activeOfferCount = useMemo(
    () =>
      transferOffers.filter(
        (o) =>
          o.status === 'pending' || o.status === 'countered' || o.status === 'accepted'
      ).length +
      contractOffers.filter((c) => c.status === 'pending' || c.status === 'countered').length,
    [transferOffers, contractOffers]
  );

  const visibleTransferOffers = useMemo(() => {
    return transferOffers.filter((o) => {
      if (offerFilter === 'active') {
        return o.status === 'pending' || o.status === 'countered' || o.status === 'accepted';
      }
      if (offerFilter === 'outgoing') return o.fromClubId === userClub.id;
      if (offerFilter === 'incoming') return o.toClubId === userClub.id;
      return true;
    });
  }, [transferOffers, offerFilter, userClub.id]);

  // Open Negotiation Modal helpers
  const openTransferEditor = (player: Player, initialFee?: number) => {
    const startFee =
      initialFee ?? Math.max(50_000, Math.round((player.value * 1.05) / 50_000) * 50_000);
    setOfferFee(startFee);
    setInstallmentMonths(0);
    setInstallmentAmount(0);
    setSellOnPercent(0);
    setNegModal({ mode: 'transfer', player, initialFee: startFee });
  };

  const openContractEditor = (
    player: Player,
    transferOfferId?: string,
    suggestedWage?: number
  ) => {
    const est = Math.max(
      1_000,
      Math.round(Math.max(player.wage, estimateWeeklyWage(player)) / 500) * 500
    );
    const startWage = suggestedWage ?? est;
    setWeeklyWage(startWage);
    setSigningOnFee(Math.round(Math.max(20_000, startWage * 5) / 5_000) * 5_000);
    setContractYears(player.age <= 24 ? 4 : player.age <= 30 ? 3 : 2);
    setSquadStatus(
      player.currentAbility >= 145
        ? 'Indispensable'
        : player.currentAbility >= 120
          ? 'Important First Team'
          : player.isWonderkid
            ? 'Hot Prospect'
            : 'Squad Rotation'
    );
    setUseReleaseClause(false);
    setReleaseClause(Math.max(1_000_000, Math.round((player.value * 2.2) / 500_000) * 500_000));
    setNegModal({ mode: 'contract', player, transferOfferId, initialWage: startWage });
  };

  const handleSort = (key: SearchSortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      const descKeys: SearchSortKey[] = ['ovr', 'avr', 'value', 'wage'];
      setSortDir(descKeys.includes(key) ? 'desc' : 'asc');
    }
    setPage(1);
  };

  const renderSortIcon = (key: SearchSortKey) => {
    if (sortKey !== key) return null;
    return sortDir === 'asc' ? (
      <ArrowUp size={11} style={{ marginLeft: 3, verticalAlign: 'middle' }} />
    ) : (
      <ArrowDown size={11} style={{ marginLeft: 3, verticalAlign: 'middle' }} />
    );
  };

  const resetAllFilters = () => {
    setRawQuery('');
    setDebouncedQuery('');
    setPosFilter('ALL');
    setLeagueFilter('ALL');
    setNationFilter('ALL');
    setMaxAge(0);
    setMaxValueMode('ANY');
    setAvailability('all');
    setAttrRules([]);
    setPage(1);
  };

  const addAttributeRule = () => {
    if (attrRules.length >= 3) return;
    const defaults = ['technical.finishing', 'physical.pace', 'mental.determination'];
    const nextAttr =
      defaults.find((d) => !attrRules.some((r) => r.attrId === d)) ??
      attributeOptions[0]?.id ??
      'technical.passing';
    setAttrRules((prev) => [
      ...prev,
      { id: `rule-${Date.now()}-${prev.length}`, attrId: nextAttr, minValue: 15 },
    ]);
    setPage(1);
  };

  const applyScoutPreset = (preset: 'wonderkids' | 'free' | 'finisher' | 'pace') => {
    resetAllFilters();
    if (preset === 'wonderkids') {
      setAvailability('wonderkids');
      setMaxAge(21);
      setSortKey('ovr');
      setSortDir('desc');
    } else if (preset === 'free') {
      setAvailability('free');
      setSortKey('ovr');
      setSortDir('desc');
    } else if (preset === 'finisher') {
      setPosFilter('FWD');
      setAttrRules([
        { id: 'p-fin', attrId: 'technical.finishing', minValue: 16 },
        { id: 'p-otb', attrId: 'technical.offTheBall', minValue: 14 },
      ]);
    } else if (preset === 'pace') {
      setAttrRules([
        { id: 'p-pace', attrId: 'physical.pace', minValue: 17 },
        { id: 'p-acc', attrId: 'physical.acceleration', minValue: 16 },
      ]);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Top Mode & Budget Bar */}
      <div className="cm-panel">
        <div className="cm-panel-header" style={{ flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Search size={14} color="#ffd84d" />
            <span>Global Scouting & Transfer Market</span>
            <span className="cm-num" style={{ fontSize: 11, color: 'var(--cm-cyan)' }}>
              ({allPlayers.length.toLocaleString()} Players Indexed)
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span className="cm-num" style={{ fontSize: 11.5, color: 'var(--cm-lime)' }}>
              Transfer Budget: {formatCurrency(userClub.finances.transferBudget)}
            </span>
            <span className="cm-num" style={{ fontSize: 11.5, color: 'var(--cm-gold)' }}>
              Wage Room:{' '}
              {formatCurrency(
                userClub.finances.wageBudgetWeekly - userClub.finances.currentWeeklyWages
              )}
              /wk
            </span>
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 8,
            padding: '7px 10px',
            background: 'rgba(10, 18, 34, 0.85)',
          }}
        >
          <div style={{ display: 'flex', gap: 5 }}>
            <button
              type="button"
              className={`cm-tab ${mainTab === 'search' ? 'is-active' : ''}`}
              onClick={() => setMainTab('search')}
            >
              <Search size={12} style={{ marginRight: 5, verticalAlign: 'middle' }} />
              Player Search ({filteredPlayers.length.toLocaleString()})
            </button>
            <button
              type="button"
              className={`cm-tab ${mainTab === 'transfers' ? 'is-active' : ''}`}
              onClick={() => setMainTab('transfers')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <Handshake size={12} />
              <span>Transfer Centre & Negotiations</span>
              {activeOfferCount > 0 && (
                <span className="cm-nav-badge is-gold">{activeOfferCount}</span>
              )}
            </button>
          </div>

          {/* Quick CM Scout Presets */}
          {mainTab === 'search' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 10.5, color: 'var(--cm-text-dim)', textTransform: 'uppercase' }}>
                Scout Presets:
              </span>
              <button
                type="button"
                className="cm-btn cm-btn-sm"
                onClick={() => applyScoutPreset('wonderkids')}
              >
                <Star size={11} color="#ffd84d" /> Wonderkids
              </button>
              <button
                type="button"
                className="cm-btn cm-btn-sm"
                onClick={() => applyScoutPreset('free')}
              >
                <Sparkles size={11} color="#4ade80" /> Free Bargains
              </button>
              <button
                type="button"
                className="cm-btn cm-btn-sm"
                onClick={() => applyScoutPreset('finisher')}
              >
                Clinical 16+
              </button>
              <button
                type="button"
                className="cm-btn cm-btn-sm"
                onClick={() => applyScoutPreset('pace')}
              >
                Pace 17+
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ==================== TAB 1: PLAYER SEARCH ==================== */}
      {mainTab === 'search' && (
        <>
          {/* Filters & Attribute Rules Panel */}
          <div className="cm-panel">
            <div
              className="cm-panel-body"
              style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '8px 10px' }}
            >
              {/* Primary Filters Row */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(180px, 1.5fr) repeat(5, minmax(110px, 1fr))',
                  gap: 7,
                }}
              >
                {/* Search Input */}
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <Search
                    size={13}
                    color="#9ab0cf"
                    style={{ position: 'absolute', left: 8, pointerEvents: 'none' }}
                  />
                  <input
                    type="text"
                    className="cm-input"
                    value={rawQuery}
                    onChange={(e) => setRawQuery(e.target.value)}
                    placeholder="Player name, club, or nation..."
                    style={{ width: '100%', paddingLeft: 26, paddingRight: 24 }}
                  />
                  {rawQuery && (
                    <button
                      type="button"
                      onClick={() => {
                        setRawQuery('');
                        setDebouncedQuery('');
                      }}
                      style={{
                        position: 'absolute',
                        right: 6,
                        background: 'none',
                        border: 'none',
                        color: 'var(--cm-text-muted)',
                        cursor: 'pointer',
                        padding: 0,
                      }}
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>

                {/* Position */}
                <select
                  className="cm-select"
                  value={posFilter}
                  onChange={(e) => {
                    setPosFilter(e.target.value as PositionFilterValue);
                    setPage(1);
                  }}
                >
                  <option value="ALL">All Positions</option>
                  <optgroup label="Groups">
                    <option value="GK">GK — Goalkeepers</option>
                    <option value="DEF">DEF — Defenders</option>
                    <option value="MID">MID — Midfielders</option>
                    <option value="FWD">FWD — Forwards</option>
                  </optgroup>
                  <optgroup label="Exact Position">
                    {EXACT_POSITIONS.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </optgroup>
                </select>

                {/* League */}
                <select
                  className="cm-select"
                  value={leagueFilter}
                  onChange={(e) => {
                    setLeagueFilter(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="ALL">All Leagues</option>
                  {sortedLeagues.map((lg) => (
                    <option key={lg.id} value={lg.id}>
                      [{lg.countryCode} T{lg.tier}] {lg.shortName}
                    </option>
                  ))}
                </select>

                {/* Nation */}
                <select
                  className="cm-select"
                  value={nationFilter}
                  onChange={(e) => {
                    setNationFilter(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="ALL">All Nations ({nationsList.length})</option>
                  {nationsList.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>

                {/* Max Age */}
                <select
                  className="cm-select"
                  value={maxAge}
                  onChange={(e) => {
                    setMaxAge(Number(e.target.value));
                    setPage(1);
                  }}
                >
                  <option value={0}>Any Age</option>
                  <option value={19}>Age ≤ 19</option>
                  <option value={21}>Age ≤ 21</option>
                  <option value={23}>Age ≤ 23</option>
                  <option value={26}>Age ≤ 26</option>
                  <option value={30}>Age ≤ 30</option>
                  <option value={35}>Age ≤ 35</option>
                </select>

                {/* Max Value */}
                <select
                  className="cm-select"
                  value={maxValueMode}
                  onChange={(e) => {
                    setMaxValueMode(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="ANY">Any Value</option>
                  <option value="BUDGET">Within Budget</option>
                  <option value="FREE">Free (€0)</option>
                  <option value="500000">≤ €500K</option>
                  <option value="2000000">≤ €2M</option>
                  <option value="5000000">≤ €5M</option>
                  <option value="15000000">≤ €15M</option>
                  <option value="40000000">≤ €40M</option>
                  <option value="80000000">≤ €80M</option>
                </select>
              </div>

              {/* Availability Pills + Attribute Rule Builder */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 8,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                  <Filter size={12} color="#9ab0cf" />
                  {(
                    [
                      { id: 'all', label: 'All' },
                      { id: 'free', label: 'Free Agents' },
                      { id: 'listed', label: 'Transfer Listed' },
                      { id: 'wonderkids', label: '★ Wonderkids' },
                      { id: 'shortlist', label: `Shortlist (${shortlist.length})` },
                    ] as const
                  ).map((av) => (
                    <button
                      key={av.id}
                      type="button"
                      className={`cm-tab ${availability === av.id ? 'is-active' : ''}`}
                      onClick={() => {
                        setAvailability(av.id);
                        setPage(1);
                      }}
                      style={{ padding: '3px 8px', fontSize: 11 }}
                    >
                      {av.label}
                    </button>
                  ))}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="cm-btn cm-btn-sm cm-btn-primary"
                    disabled={attrRules.length >= 3}
                    onClick={addAttributeRule}
                  >
                    <Plus size={12} />
                    <span>Add Attribute Rule ({attrRules.length}/3)</span>
                  </button>
                  <button
                    type="button"
                    className="cm-btn cm-btn-sm"
                    onClick={resetAllFilters}
                  >
                    <RotateCcw size={11} />
                    <span>Reset</span>
                  </button>
                </div>
              </div>

              {/* Active Minimum Attribute Filter Chips */}
              {attrRules.length > 0 && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 8,
                    padding: '6px 8px',
                    background: 'rgba(6, 12, 24, 0.72)',
                    border: '1px solid rgba(56, 232, 213, 0.35)',
                  }}
                >
                  <span
                    style={{
                      fontSize: 10.5,
                      fontWeight: 700,
                      color: 'var(--cm-cyan)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <Sliders size={11} />
                    MIN ATTRIBUTES:
                  </span>
                  {attrRules.map((rule) => (
                    <div
                      key={rule.id}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                        padding: '2px 6px',
                        background: 'rgba(16, 29, 52, 0.92)',
                        border: '1px solid var(--cm-border)',
                      }}
                    >
                      <select
                        className="cm-select"
                        value={rule.attrId}
                        onChange={(e) => {
                          const val = e.target.value;
                          setAttrRules((prev) =>
                            prev.map((r) => (r.id === rule.id ? { ...r, attrId: val } : r))
                          );
                          setPage(1);
                        }}
                        style={{ padding: '2px 5px', fontSize: 11.5 }}
                      >
                        <optgroup label="Technical">
                          {attributeOptions
                            .filter((o) => o.group === 'technical')
                            .map((o) => (
                              <option key={o.id} value={o.id}>
                                {o.label}
                              </option>
                            ))}
                        </optgroup>
                        <optgroup label="Mental">
                          {attributeOptions
                            .filter((o) => o.group === 'mental')
                            .map((o) => (
                              <option key={o.id} value={o.id}>
                                {o.label}
                              </option>
                            ))}
                        </optgroup>
                        <optgroup label="Physical">
                          {attributeOptions
                            .filter((o) => o.group === 'physical')
                            .map((o) => (
                              <option key={o.id} value={o.id}>
                                {o.label}
                              </option>
                            ))}
                        </optgroup>
                        <optgroup label="Goalkeeping">
                          {attributeOptions
                            .filter((o) => o.group === 'goalkeeping')
                            .map((o) => (
                              <option key={o.id} value={o.id}>
                                {o.label}
                              </option>
                            ))}
                        </optgroup>
                      </select>

                      <span className="cm-num" style={{ color: 'var(--cm-gold)', fontWeight: 700 }}>
                        ≥
                      </span>
                      <input
                        type="number"
                        className="cm-input cm-num"
                        min={1}
                        max={20}
                        value={rule.minValue}
                        onChange={(e) => {
                          const v = Math.max(1, Math.min(20, Number(e.target.value) || 1));
                          setAttrRules((prev) =>
                            prev.map((r) => (r.id === rule.id ? { ...r, minValue: v } : r))
                          );
                          setPage(1);
                        }}
                        style={{ width: 48, padding: '2px 5px', fontSize: 11.5, textAlign: 'center' }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setAttrRules((prev) => prev.filter((r) => r.id !== rule.id));
                          setPage(1);
                        }}
                        title="Remove attribute rule"
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#f87171',
                          cursor: 'pointer',
                          padding: 2,
                          display: 'inline-flex',
                        }}
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Paginated Results Table */}
          <div className="cm-panel">
            {/* Top Pagination Strip */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '6px 10px',
                background: 'rgba(13, 24, 44, 0.85)',
                borderBottom: '1px solid var(--cm-border)',
                fontSize: 11.5,
              }}
            >
              <span className="cm-num" style={{ color: 'var(--cm-text-muted)' }}>
                Showing{' '}
                <strong style={{ color: '#fff' }}>
                  {filteredPlayers.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1}–
                  {Math.min(safePage * PAGE_SIZE, filteredPlayers.length)}
                </strong>{' '}
                of{' '}
                <strong style={{ color: 'var(--cm-gold)' }}>
                  {filteredPlayers.length.toLocaleString()}
                </strong>{' '}
                players
              </span>

              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <button
                  type="button"
                  className="cm-btn cm-btn-sm"
                  disabled={safePage <= 1}
                  onClick={() => setPage(1)}
                >
                  First
                </button>
                <button
                  type="button"
                  className="cm-btn cm-btn-sm"
                  disabled={safePage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft size={12} />
                </button>
                <span className="cm-num" style={{ padding: '0 8px', color: 'var(--cm-gold)' }}>
                  Page {safePage} / {totalPages}
                </span>
                <button
                  type="button"
                  className="cm-btn cm-btn-sm"
                  disabled={safePage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  <ChevronRight size={12} />
                </button>
                <button
                  type="button"
                  className="cm-btn cm-btn-sm"
                  disabled={safePage >= totalPages}
                  onClick={() => setPage(totalPages)}
                >
                  Last
                </button>
              </div>
            </div>

            <div className="cm-table-wrap" style={{ maxHeight: 'calc(100vh - 385px)', overflowY: 'auto' }}>
              <table className="cm-table">
                <thead>
                  <tr>
                    <th style={{ width: 32, textAlign: 'center' }} title="Shortlist">
                      ★
                    </th>
                    <th className="is-sortable" onClick={() => handleSort('name')}>
                      Name{renderSortIcon('name')}
                    </th>
                    <th className="is-sortable" onClick={() => handleSort('club')}>
                      Club{renderSortIcon('club')}
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
                    <th
                      className="is-sortable"
                      style={{ textAlign: 'right' }}
                      onClick={() => handleSort('ovr')}
                    >
                      Ovr{renderSortIcon('ovr')}
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
                    <th style={{ textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {pagePlayers.map((p) => {
                    const pClub = p.clubId ? clubs[p.clubId] : null;
                    const isUserOwn = p.clubId === userClub.id;
                    const isSaved = shortlistSet.has(p.id);
                    const primaryPos = p.positions[0] ?? 'MC';
                    const ovr = overallById.get(p.id) ?? 50;
                    const hasApps =
                      p.seasonStats.appearances + p.seasonStats.subAppearances > 0;

                    return (
                      <tr key={p.id} className={isUserOwn ? 'is-user-row' : undefined}>
                        <td style={{ textAlign: 'center' }}>
                          <button
                            type="button"
                            onClick={() => onToggleShortlist(p.id)}
                            title={isSaved ? 'Remove from Shortlist' : 'Add to Shortlist'}
                            style={{
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              padding: 0,
                              color: isSaved ? '#ffd84d' : 'var(--cm-text-dim)',
                            }}
                          >
                            <Bookmark size={13} fill={isSaved ? '#ffd84d' : 'none'} />
                          </button>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <button
                              type="button"
                              className="cm-link"
                              onClick={() => onSelectPlayer(p.id)}
                            >
                              {p.name}
                            </button>
                            {p.isWonderkid && (
                              <span
                                title="Wonderkid"
                                style={{
                                  fontSize: 9.5,
                                  fontWeight: 800,
                                  padding: '0 4px',
                                  background: 'rgba(250, 204, 21, 0.2)',
                                  border: '1px solid rgba(250, 204, 21, 0.5)',
                                  color: '#ffd84d',
                                }}
                              >
                                ★WK
                              </span>
                            )}
                            {p.transferListed && (
                              <span
                                style={{
                                  fontSize: 9.5,
                                  fontWeight: 700,
                                  padding: '0 4px',
                                  background: 'rgba(245, 158, 11, 0.22)',
                                  border: '1px solid #fbbf24',
                                  color: '#fde047',
                                }}
                              >
                                LST
                              </span>
                            )}
                          </div>
                        </td>
                        <td>
                          {pClub ? (
                            <button
                              type="button"
                              className="cm-link"
                              onClick={() => onSelectClub(pClub.id)}
                              style={{ color: 'var(--cm-text-muted)', fontWeight: 500 }}
                            >
                              {pClub.shortName}
                            </button>
                          ) : (
                            <span
                              style={{
                                fontSize: 10.5,
                                fontWeight: 700,
                                color: '#86efac',
                              }}
                            >
                              Free Agent
                            </span>
                          )}
                        </td>
                        <td>
                          <span
                            className={`cm-pos-pill ${POS_CLASS[getPositionCategory(primaryPos)]}`}
                          >
                            {primaryPos}
                          </span>
                        </td>
                        <td className="cm-num" style={{ textAlign: 'right' }}>
                          {p.age}
                        </td>
                        <td
                          className="cm-num"
                          title={p.nationality}
                          style={{ color: 'var(--cm-text-muted)', fontSize: 11.5 }}
                        >
                          {p.nationalityCode}
                        </td>
                        <td
                          className="cm-num"
                          style={{
                            textAlign: 'right',
                            fontWeight: 800,
                            color:
                              ovr >= 82
                                ? '#ffd84d'
                                : ovr >= 72
                                  ? '#38e8d5'
                                  : ovr >= 62
                                    ? '#fff'
                                    : 'var(--cm-text-muted)',
                          }}
                        >
                          {ovr}
                        </td>
                        <td
                          className="cm-num"
                          style={{
                            textAlign: 'right',
                            color: hasApps ? 'var(--cm-cyan)' : 'var(--cm-text-dim)',
                          }}
                        >
                          {hasApps ? p.seasonStats.averageRating.toFixed(2) : '—'}
                        </td>
                        <td
                          className="cm-num"
                          style={{ textAlign: 'right', color: 'var(--cm-lime)' }}
                        >
                          {pClub ? formatCurrency(p.value) : 'FREE'}
                        </td>
                        <td
                          className="cm-num"
                          style={{ textAlign: 'right', color: 'var(--cm-text-muted)' }}
                        >
                          {pClub ? `${formatCurrency(p.wage)}/wk` : '—'}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {isUserOwn ? (
                            <button
                              type="button"
                              className="cm-btn cm-btn-sm"
                              onClick={() => onSelectPlayer(p.id)}
                              style={{ padding: '2px 7px', fontSize: 10.5 }}
                            >
                              Squad
                            </button>
                          ) : !pClub ? (
                            <button
                              type="button"
                              className="cm-btn cm-btn-sm cm-btn-gold"
                              onClick={() => openContractEditor(p)}
                              style={{ padding: '2px 7px', fontSize: 10.5 }}
                            >
                              Sign Free
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="cm-btn cm-btn-sm cm-btn-primary"
                              onClick={() => openTransferEditor(p)}
                              style={{ padding: '2px 7px', fontSize: 10.5 }}
                            >
                              Bid
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}

                  {pagePlayers.length === 0 && (
                    <tr>
                      <td
                        colSpan={11}
                        style={{ textAlign: 'center', padding: 28, color: 'var(--cm-text-muted)' }}
                      >
                        No players matched your scouting filters. Try relaxing an attribute rule or
                        age/value cap.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ==================== TAB 2: TRANSFER CENTRE & NEGOTIATIONS ==================== */}
      {mainTab === 'transfers' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Transfer Offers Panel */}
          <div className="cm-panel">
            <div className="cm-panel-header" style={{ flexWrap: 'wrap' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Handshake size={14} />
                Transfer Bids & Negotiations ({visibleTransferOffers.length})
              </span>
              <div style={{ display: 'flex', gap: 4 }}>
                {(
                  [
                    { id: 'active', label: 'Active' },
                    { id: 'outgoing', label: 'Outgoing' },
                    { id: 'incoming', label: 'Incoming' },
                    { id: 'all', label: 'All History' },
                  ] as const
                ).map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    className={`cm-tab ${offerFilter === f.id ? 'is-active' : ''}`}
                    onClick={() => setOfferFilter(f.id)}
                    style={{ padding: '2px 8px', fontSize: 11 }}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="cm-table-wrap">
              <table className="cm-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Player</th>
                    <th>From → To</th>
                    <th style={{ textAlign: 'right' }}>Offer Package</th>
                    <th>Status</th>
                    <th>Notes</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleTransferOffers.map((offer) => {
                    const p = players[offer.playerId];
                    const buyer = clubs[offer.fromClubId];
                    const seller = clubs[offer.toClubId];
                    const isOutgoing = offer.fromClubId === userClub.id;
                    return (
                      <tr key={offer.id}>
                        <td className="cm-num" style={{ color: 'var(--cm-text-muted)', fontSize: 11 }}>
                          {formatDateCM(offer.createdDate)}
                        </td>
                        <td>
                          {p ? (
                            <button
                              type="button"
                              className="cm-link"
                              onClick={() => onSelectPlayer(p.id)}
                            >
                              {p.name}
                            </button>
                          ) : (
                            offer.playerId
                          )}
                        </td>
                        <td style={{ fontSize: 11.5 }}>
                          <span style={{ color: isOutgoing ? 'var(--cm-gold)' : '#fff', fontWeight: 600 }}>
                            {buyer?.shortName ?? offer.fromClubId}
                          </span>
                          <span style={{ color: 'var(--cm-text-dim)', margin: '0 5px' }}>→</span>
                          <span>{seller?.shortName ?? offer.toClubId}</span>
                        </td>
                        <td className="cm-num" style={{ textAlign: 'right' }}>
                          <div style={{ color: 'var(--cm-lime)', fontWeight: 700 }}>
                            {formatCurrency(offer.fee)}
                          </div>
                          {(offer.installments || offer.sellOnPercent > 0) && (
                            <div style={{ fontSize: 10, color: 'var(--cm-text-dim)' }}>
                              {offer.installments
                                ? `+${formatCurrency(offer.installments.amount)}/${offer.installments.months}m`
                                : ''}
                              {offer.sellOnPercent > 0 ? ` · ${offer.sellOnPercent}% sell-on` : ''}
                            </div>
                          )}
                        </td>
                        <td>
                          <span
                            className="cm-num"
                            style={{
                              fontSize: 10,
                              fontWeight: 800,
                              textTransform: 'uppercase',
                              padding: '2px 6px',
                              ...getOfferStatusStyle(offer.status),
                            }}
                          >
                            {offer.status}
                          </span>
                          {offer.status === 'countered' && offer.counterFee !== undefined && (
                            <div
                              className="cm-num"
                              style={{ fontSize: 10.5, color: 'var(--cm-gold)', marginTop: 2 }}
                            >
                              Ask: {formatCurrency(offer.counterFee)}
                            </div>
                          )}
                        </td>
                        <td
                          style={{
                            fontSize: 11.5,
                            color: 'var(--cm-text-muted)',
                            maxWidth: 230,
                            whiteSpace: 'normal',
                          }}
                        >
                          {offer.notes ?? '—'}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: 5, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                            {isOutgoing &&
                              offer.status === 'countered' &&
                              offer.counterFee !== undefined && (
                                <button
                                  type="button"
                                  className="cm-btn cm-btn-sm cm-btn-gold"
                                  onClick={() => onAcceptCounterOffer(offer.id)}
                                >
                                  <Check size={11} />
                                  <span>Accept {formatCurrency(offer.counterFee)}</span>
                                </button>
                              )}
                            {isOutgoing && offer.status === 'accepted' && p && (
                              <button
                                type="button"
                                className="cm-btn cm-btn-sm cm-btn-gold"
                                onClick={() => openContractEditor(p, offer.id)}
                              >
                                <FileSignature size={11} />
                                <span>Offer Contract</span>
                              </button>
                            )}
                            {isOutgoing && offer.status === 'rejected' && p && p.clubId && (
                              <button
                                type="button"
                                className="cm-btn cm-btn-sm cm-btn-primary"
                                onClick={() =>
                                  openTransferEditor(
                                    p,
                                    Math.round((offer.fee * 1.2) / 50_000) * 50_000
                                  )
                                }
                              >
                                New Bid
                              </button>
                            )}
                            {isOutgoing &&
                              (offer.status === 'pending' ||
                                offer.status === 'countered' ||
                                offer.status === 'accepted') && (
                                <button
                                  type="button"
                                  className="cm-btn cm-btn-sm cm-btn-danger"
                                  onClick={() => onWithdrawTransferOffer(offer.id)}
                                  title="Withdraw Offer"
                                >
                                  <Trash2 size={11} />
                                </button>
                              )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {visibleTransferOffers.length === 0 && (
                    <tr>
                      <td
                        colSpan={7}
                        style={{ textAlign: 'center', padding: 22, color: 'var(--cm-text-muted)' }}
                      >
                        No transfer offers in this view. Use Player Search to scout targets and make
                        a bid.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Contract Negotiations Panel */}
          <div className="cm-panel">
            <div className="cm-panel-header">
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <FileSignature size={14} />
                Contract Negotiations ({contractOffers.length})
              </span>
            </div>
            <div className="cm-table-wrap">
              <table className="cm-table">
                <thead>
                  <tr>
                    <th>Player</th>
                    <th>Role</th>
                    <th style={{ textAlign: 'right' }}>Wage / Wk</th>
                    <th style={{ textAlign: 'right' }}>Signing Fee</th>
                    <th style={{ textAlign: 'center' }}>Yrs</th>
                    <th>Status</th>
                    <th>Agent Response</th>
                    <th style={{ textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {contractOffers.map((co) => {
                    const p = players[co.playerId];
                    return (
                      <tr key={co.id}>
                        <td>
                          {p ? (
                            <button
                              type="button"
                              className="cm-link"
                              onClick={() => onSelectPlayer(p.id)}
                            >
                              {p.name}
                            </button>
                          ) : (
                            co.playerId
                          )}
                        </td>
                        <td style={{ fontSize: 11.5 }}>{co.squadStatus}</td>
                        <td className="cm-num" style={{ textAlign: 'right', color: 'var(--cm-gold)' }}>
                          {formatCurrency(co.weeklyWage)}/wk
                        </td>
                        <td className="cm-num" style={{ textAlign: 'right', color: 'var(--cm-text-muted)' }}>
                          {formatCurrency(co.signingOnFee)}
                        </td>
                        <td className="cm-num" style={{ textAlign: 'center' }}>
                          {co.years}y
                        </td>
                        <td>
                          <span
                            className="cm-num"
                            style={{
                              fontSize: 10,
                              fontWeight: 800,
                              textTransform: 'uppercase',
                              padding: '2px 6px',
                              ...getOfferStatusStyle(co.status),
                            }}
                          >
                            {co.status}
                          </span>
                        </td>
                        <td
                          style={{
                            fontSize: 11.5,
                            color: 'var(--cm-text-muted)',
                            maxWidth: 250,
                            whiteSpace: 'normal',
                          }}
                        >
                          {co.responseMessage ?? '—'}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {p && (co.status === 'countered' || co.status === 'rejected') && (
                            <button
                              type="button"
                              className="cm-btn cm-btn-sm cm-btn-gold"
                              onClick={() =>
                                openContractEditor(
                                  p,
                                  co.transferOfferId,
                                  co.counterWage ??
                                    Math.round((co.weeklyWage * 1.15) / 500) * 500
                                )
                              }
                            >
                              <DollarSign size={11} />
                              <span>
                                {co.counterWage
                                  ? `Match ${formatCurrency(co.counterWage)}/wk`
                                  : 'Revise Terms'}
                              </span>
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}

                  {contractOffers.length === 0 && (
                    <tr>
                      <td
                        colSpan={8}
                        style={{ textAlign: 'center', padding: 20, color: 'var(--cm-text-muted)' }}
                      >
                        No contract negotiations logged yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ==================== INLINE TRANSFER / CONTRACT NEGOTIATION MODAL ==================== */}
      {negModal && (
        <div
          className="cm-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Negotiation Editor"
          onClick={() => setNegModal(null)}
        >
          <div
            className="cm-modal"
            style={{ width: 'min(580px, 95vw)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="cm-panel-header">
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                {negModal.mode === 'transfer' ? (
                  <Handshake size={14} />
                ) : (
                  <FileSignature size={14} />
                )}
                <span>
                  {negModal.mode === 'transfer'
                    ? `Transfer Bid — ${negModal.player.name}`
                    : `Contract Offer — ${negModal.player.name}`}
                </span>
              </span>
              <button
                type="button"
                className="cm-btn cm-btn-sm"
                onClick={() => setNegModal(null)}
              >
                <X size={13} />
              </button>
            </div>

            {negModal.mode === 'transfer' && negModal.player.clubId ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!negModal.player.clubId) return;
                  onSubmitTransferOffer({
                    playerId: negModal.player.id,
                    fromClubId: userClub.id,
                    toClubId: negModal.player.clubId,
                    fee: Math.max(0, Math.round(offerFee)),
                    installments:
                      installmentMonths !== 0 && installmentAmount > 0
                        ? { amount: Math.round(installmentAmount), months: installmentMonths }
                        : undefined,
                    sellOnPercent,
                  });
                  setNegModal(null);
                  setMainTab('transfers');
                }}
                style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 11 }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 8,
                    padding: '8px 10px',
                    background: 'rgba(13, 24, 44, 0.85)',
                    border: '1px solid var(--cm-border)',
                    fontSize: 12,
                  }}
                >
                  <div>
                    Club: <strong>{clubs[negModal.player.clubId]?.name ?? negModal.player.clubId}</strong>
                  </div>
                  <div className="cm-num">
                    Valuation:{' '}
                    <span style={{ color: 'var(--cm-lime)', fontWeight: 700 }}>
                      {formatCurrency(negModal.player.value)}
                    </span>
                  </div>
                  <div className="cm-num">
                    Budget:{' '}
                    <span style={{ color: 'var(--cm-gold)', fontWeight: 700 }}>
                      {formatCurrency(userClub.finances.transferBudget)}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--cm-text-muted)' }}>
                    Upfront Fee (EUR)
                  </label>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                    <input
                      type="number"
                      className="cm-input cm-num"
                      min={0}
                      step={50_000}
                      value={offerFee}
                      onChange={(e) => setOfferFee(Math.max(0, Number(e.target.value) || 0))}
                      style={{ width: 170, fontWeight: 700 }}
                    />
                    {[
                      { label: 'Val', mult: 1.0 },
                      { label: '+15%', mult: 1.15 },
                      { label: '+30%', mult: 1.3 },
                    ].map((pr) => (
                      <button
                        key={pr.label}
                        type="button"
                        className="cm-btn cm-btn-sm"
                        onClick={() =>
                          setOfferFee(
                            Math.round((negModal.player.value * pr.mult) / 50_000) * 50_000
                          )
                        }
                      >
                        {pr.label}
                      </button>
                    ))}
                  </div>
                  {offerFee > userClub.finances.transferBudget && (
                    <span style={{ fontSize: 11.5, color: 'var(--cm-red)' }}>
                      Fee exceeds available transfer budget.
                    </span>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--cm-text-muted)' }}>
                      Installments
                    </label>
                    <select
                      className="cm-select"
                      value={installmentMonths}
                      onChange={(e) => {
                        const m = Number(e.target.value) as 0 | 6 | 12 | 18 | 24;
                        setInstallmentMonths(m);
                        if (m === 0) setInstallmentAmount(0);
                        else if (installmentAmount === 0) {
                          setInstallmentAmount(
                            Math.max(
                              100_000,
                              Math.round((negModal.player.value * 0.25) / 50_000) * 50_000
                            )
                          );
                        }
                      }}
                    >
                      <option value={0}>None</option>
                      <option value={6}>6 Months</option>
                      <option value={12}>12 Months</option>
                      <option value={18}>18 Months</option>
                      <option value={24}>24 Months</option>
                    </select>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--cm-text-muted)' }}>
                      Installment Amount (EUR)
                    </label>
                    <input
                      type="number"
                      className="cm-input cm-num"
                      disabled={installmentMonths === 0}
                      min={0}
                      step={50_000}
                      value={installmentAmount}
                      onChange={(e) =>
                        setInstallmentAmount(Math.max(0, Number(e.target.value) || 0))
                      }
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                    <label style={{ fontWeight: 700, color: 'var(--cm-text-muted)' }}>
                      Sell-On Clause
                    </label>
                    <span className="cm-num" style={{ color: 'var(--cm-cyan)', fontWeight: 700 }}>
                      {sellOnPercent}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={50}
                    step={5}
                    value={sellOnPercent}
                    onChange={(e) => setSellOnPercent(Number(e.target.value))}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                  <button type="button" className="cm-btn" onClick={() => setNegModal(null)}>
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="cm-btn cm-btn-gold"
                    disabled={offerFee > userClub.finances.transferBudget}
                  >
                    <Handshake size={13} />
                    <span>Submit Transfer Bid</span>
                  </button>
                </div>
              </form>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  onSubmitContractOffer({
                    playerId: negModal.player.id,
                    clubId: userClub.id,
                    transferOfferId: negModal.transferOfferId,
                    squadStatus,
                    weeklyWage: Math.max(500, Math.round(weeklyWage)),
                    signingOnFee: Math.max(0, Math.round(signingOnFee)),
                    years: contractYears,
                    releaseClause:
                      useReleaseClause && releaseClause > 0 ? Math.round(releaseClause) : undefined,
                  });
                  setNegModal(null);
                  setMainTab('transfers');
                }}
                style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 11 }}
              >
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--cm-text-muted)' }}>
                      Squad Status
                    </label>
                    <select
                      className="cm-select"
                      value={squadStatus}
                      onChange={(e) => setSquadStatus(e.target.value as SquadStatus)}
                    >
                      {SQUAD_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--cm-text-muted)' }}>
                      Contract Years
                    </label>
                    <select
                      className="cm-select"
                      value={contractYears}
                      onChange={(e) =>
                        setContractYears(Number(e.target.value) as 1 | 2 | 3 | 4 | 5)
                      }
                    >
                      {([1, 2, 3, 4, 5] as const).map((y) => (
                        <option key={y} value={y}>
                          {y} {y === 1 ? 'Year' : 'Years'}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--cm-text-muted)' }}>
                      Weekly Wage (EUR/wk)
                    </label>
                    <input
                      type="number"
                      className="cm-input cm-num"
                      min={500}
                      step={500}
                      value={weeklyWage}
                      onChange={(e) => setWeeklyWage(Math.max(500, Number(e.target.value) || 0))}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--cm-text-muted)' }}>
                      Signing-On Fee (EUR)
                    </label>
                    <input
                      type="number"
                      className="cm-input cm-num"
                      min={0}
                      step={5_000}
                      value={signingOnFee}
                      onChange={(e) =>
                        setSigningOnFee(Math.max(0, Number(e.target.value) || 0))
                      }
                    />
                  </div>
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                    padding: '6px 10px',
                    background: 'rgba(6, 12, 24, 0.72)',
                    border: '1px solid var(--cm-border-subtle)',
                  }}
                >
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                    <input
                      type="checkbox"
                      checked={useReleaseClause}
                      onChange={(e) => setUseReleaseClause(e.target.checked)}
                    />
                    <span>Release Clause</span>
                  </label>
                  <input
                    type="number"
                    className="cm-input cm-num"
                    disabled={!useReleaseClause}
                    min={0}
                    step={250_000}
                    value={releaseClause}
                    onChange={(e) =>
                      setReleaseClause(Math.max(0, Number(e.target.value) || 0))
                    }
                    style={{ width: 165 }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                  <button type="button" className="cm-btn" onClick={() => setNegModal(null)}>
                    Cancel
                  </button>
                  <button type="submit" className="cm-btn cm-btn-gold">
                    <FileSignature size={13} />
                    <span>Submit Contract Offer</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchTransfersView;
