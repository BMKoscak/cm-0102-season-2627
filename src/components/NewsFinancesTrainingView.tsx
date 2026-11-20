import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertCircle,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Building2,
  CheckCheck,
  Cross,
  DollarSign,
  Dumbbell,
  Mail,
  MailOpen,
  Shield,
  Sparkles,
  TrendingDown,
  TrendingUp,
  User,
  Wand2,
} from 'lucide-react';
import type { NewsFinancesTrainingViewProps } from '../types/contracts';
import type {
  FinanceCategory,
  NewsCategory,
  NewsItem,
  Player,
  PositionCategory,
  TrainingFocus,
  TrainingGroupKey,
  TrainingIntensity,
  TrainingState,
} from '../types/game';
import { getPositionCategory } from '../engine/attributes';
import { formatCurrency, formatDateCM } from '../engine/seasonEngine';

type NewsFilter = 'all' | 'transfer' | 'match' | 'injury' | 'board' | 'training' | 'scout';

const TRAINING_FOCUSES: TrainingFocus[] = [
  'General',
  'Goalkeeping',
  'Tactics',
  'Skills',
  'Shooting',
  'Fitness',
  'Rest',
];

const TRAINING_INTENSITIES: TrainingIntensity[] = ['Light', 'Medium', 'Intensive'];

const TRAINING_GROUPS: TrainingGroupKey[] = [
  'Goalkeepers',
  'Defenders',
  'Midfielders',
  'Forwards',
];

const POS_CLASS: Record<PositionCategory, string> = {
  GK: 'cm-pos-gk',
  DEF: 'cm-pos-def',
  MID: 'cm-pos-mid',
  FWD: 'cm-pos-fwd',
};

const CATEGORY_META: Record<NewsCategory, { label: string; color: string; bg: string }> = {
  match: { label: 'Match', color: '#86efac', bg: 'rgba(22, 163, 74, 0.24)' },
  transfer: { label: 'Transfer', color: '#38e8d5', bg: 'rgba(14, 165, 233, 0.24)' },
  injury: { label: 'Injury', color: '#fca5a5', bg: 'rgba(220, 38, 38, 0.28)' },
  board: { label: 'Board', color: '#ffd84d', bg: 'rgba(202, 138, 4, 0.28)' },
  training: { label: 'Training', color: '#a3e635', bg: 'rgba(101, 163, 13, 0.24)' },
  league: { label: 'League', color: '#93c5fd', bg: 'rgba(37, 99, 235, 0.24)' },
  media: { label: 'Scout / Media', color: '#d8b4fe', bg: 'rgba(147, 51, 234, 0.24)' },
};

function getPlayerTrainingGroup(player: Player): TrainingGroupKey {
  const cat = getPositionCategory(player.positions[0] ?? 'MC');
  if (cat === 'GK') return 'Goalkeepers';
  if (cat === 'DEF') return 'Defenders';
  if (cat === 'FWD') return 'Forwards';
  return 'Midfielders';
}

function getConditionColor(cond: number): string {
  if (cond >= 88) return '#4ade80';
  if (cond >= 75) return '#a3e635';
  if (cond >= 62) return '#facc15';
  return '#f87171';
}

function getConfidenceLabel(score: number): { text: string; color: string } {
  if (score >= 85) return { text: 'Untouchable', color: '#4ade80' };
  if (score >= 70) return { text: 'Very Pleased', color: '#86efac' };
  if (score >= 55) return { text: 'Satisfied', color: '#38e8d5' };
  if (score >= 40) return { text: 'Cautious', color: '#fbbf24' };
  return { text: 'Under Pressure', color: '#f87171' };
}

function getFitnessTrend(
  player: Player,
  focus: TrainingFocus,
  intensity: TrainingIntensity
): { label: string; color: string; dir: 'up' | 'flat' | 'down' | 'rehab' } {
  if (player.injury) {
    return { label: `Rehab (${player.injury.daysRemaining}d)`, color: '#f87171', dir: 'rehab' };
  }
  if (focus === 'Rest' || intensity === 'Light') {
    return { label: 'Recovering', color: '#4ade80', dir: 'up' };
  }
  if (intensity === 'Intensive' || focus === 'Fitness') {
    return {
      label: player.condition < 78 ? 'Fatigue Risk' : 'Heavy Load',
      color: player.condition < 78 ? '#f87171' : '#fbbf24',
      dir: 'down',
    };
  }
  return { label: 'Steady', color: '#38e8d5', dir: 'flat' };
}

export const NewsFinancesTrainingView: React.FC<NewsFinancesTrainingViewProps> = ({
  mode,
  userClub,
  squad,
  news,
  clubs,
  players,
  currentDate,
  onSwitchMode,
  onMarkNewsRead,
  onMarkAllNewsRead,
  onUpdateTraining,
  onSelectPlayer,
  onSelectClub,
}) => {
  const [newsFilter, setNewsFilter] = useState<NewsFilter>('all');
  const [selectedNewsId, setSelectedNewsId] = useState<string | null>(() => news[0]?.id ?? null);

  const unreadCount = useMemo(
    () => news.reduce((acc, item) => acc + (item.read ? 0 : 1), 0),
    [news]
  );

  // Filtered news list
  const filteredNews = useMemo<NewsItem[]>(() => {
    return news.filter((item) => {
      if (newsFilter === 'all') return true;
      if (newsFilter === 'scout') return item.category === 'league' || item.category === 'media';
      return item.category === newsFilter;
    });
  }, [news, newsFilter]);

  // Keep selected news article synced when new items arrive or filter changes
  useEffect(() => {
    if (filteredNews.length === 0) {
      setSelectedNewsId(null);
      return;
    }
    if (!selectedNewsId || !filteredNews.some((n) => n.id === selectedNewsId)) {
      setSelectedNewsId(filteredNews[0].id);
    }
  }, [filteredNews, selectedNewsId]);

  const activeArticle: NewsItem | null = useMemo(
    () => filteredNews.find((n) => n.id === selectedNewsId) ?? filteredNews[0] ?? null,
    [filteredNews, selectedNewsId]
  );

  const handleSelectArticle = (item: NewsItem) => {
    setSelectedNewsId(item.id);
    if (!item.read) {
      onMarkNewsRead(item.id);
    }
  };

  // ==================== FINANCES CALCULATIONS ====================
  const financesSummary = useMemo(() => {
    const fin = userClub.finances;
    const liveWeeklyWages = squad.reduce((s, p) => s + p.wage, 0);
    const weeklyWages = liveWeeklyWages > 0 ? liveWeeklyWages : fin.currentWeeklyWages;
    const wagePct =
      fin.wageBudgetWeekly > 0
        ? Math.round((weeklyWages / fin.wageBudgetWeekly) * 100)
        : 0;
    const wageHeadroom = fin.wageBudgetWeekly - weeklyWages;
    const estHomeMatchesPerYear = 19;
    const estSelloutGate = Math.round(userClub.stadium.capacity * fin.ticketPriceAvg * 0.85);
    const estAnnualGate = estSelloutGate * estHomeMatchesPerYear;
    const estAnnualWages = weeklyWages * 52;

    // Aggregate actual ledger transactions by category
    const byCat: Record<FinanceCategory, number> = {
      'Gate Receipts': 0,
      'TV Revenue': 0,
      Sponsorship: 0,
      'Prize Money': 0,
      Transfer: 0,
      Wages: 0,
      Upkeep: 0,
    };
    let totalIncomeTx = 0;
    let totalExpenseTx = 0;
    for (const tx of fin.monthlyTransactions) {
      byCat[tx.category] = (byCat[tx.category] ?? 0) + tx.amount;
      if (tx.amount >= 0) totalIncomeTx += tx.amount;
      else totalExpenseTx += Math.abs(tx.amount);
    }

    return {
      fin,
      weeklyWages,
      wagePct,
      wageHeadroom,
      estSelloutGate,
      estAnnualGate,
      estAnnualWages,
      byCat,
      totalIncomeTx,
      totalExpenseTx,
    };
  }, [userClub, squad]);

  // ==================== TRAINING HELPERS ====================
  const training: TrainingState = userClub.training;

  const groupStats = useMemo(() => {
    const map: Record<TrainingGroupKey, { count: number; avgCond: number }> = {
      Goalkeepers: { count: 0, avgCond: 0 },
      Defenders: { count: 0, avgCond: 0 },
      Midfielders: { count: 0, avgCond: 0 },
      Forwards: { count: 0, avgCond: 0 },
    };
    for (const p of squad) {
      const g = getPlayerTrainingGroup(p);
      map[g].count += 1;
      map[g].avgCond += p.condition;
    }
    for (const g of TRAINING_GROUPS) {
      if (map[g].count > 0) {
        map[g].avgCond = Math.round(map[g].avgCond / map[g].count);
      }
    }
    return map;
  }, [squad]);

  const sortedTrainingSquad = useMemo(() => {
    const order: Record<TrainingGroupKey, number> = {
      Goalkeepers: 0,
      Defenders: 1,
      Midfielders: 2,
      Forwards: 3,
    };
    return [...squad].sort(
      (a, b) =>
        order[getPlayerTrainingGroup(a)] - order[getPlayerTrainingGroup(b)] ||
        b.currentAbility - a.currentAbility
    );
  }, [squad]);

  const handleSetOverallIntensity = (intensity: TrainingIntensity) => {
    const updatedGroups = { ...training.groups };
    for (const key of TRAINING_GROUPS) {
      updatedGroups[key] = { ...updatedGroups[key], intensity };
    }
    onUpdateTraining({
      ...training,
      overallIntensity: intensity,
      groups: updatedGroups,
    });
  };

  const handleUpdateGroup = (
    groupKey: TrainingGroupKey,
    patch: Partial<{ focus: TrainingFocus; intensity: TrainingIntensity }>
  ) => {
    const cur = training.groups[groupKey] ?? {
      group: groupKey,
      focus: 'General' as TrainingFocus,
      intensity: training.overallIntensity,
    };
    onUpdateTraining({
      ...training,
      groups: {
        ...training.groups,
        [groupKey]: { ...cur, ...patch },
      },
    });
  };

  const handleSetPlayerOverride = (playerId: string, focus: TrainingFocus | 'DEFAULT') => {
    const nextOverrides = { ...training.playerFocusOverrides };
    if (focus === 'DEFAULT') {
      delete nextOverrides[playerId];
    } else {
      nextOverrides[playerId] = focus;
    }
    onUpdateTraining({
      ...training,
      playerFocusOverrides: nextOverrides,
    });
  };

  const handleAutoAssignTraining = () => {
    const nextOverrides: Record<string, TrainingFocus> = {};
    for (const p of squad) {
      if (p.injury || p.condition < 74) {
        nextOverrides[p.id] = 'Rest';
      } else if (p.condition < 84) {
        nextOverrides[p.id] = 'Fitness';
      }
    }
    onUpdateTraining({
      ...training,
      overallIntensity: 'Medium',
      groups: {
        Goalkeepers: { group: 'Goalkeepers', focus: 'Goalkeeping', intensity: 'Medium' },
        Defenders: { group: 'Defenders', focus: 'Tactics', intensity: 'Medium' },
        Midfielders: { group: 'Midfielders', focus: 'Skills', intensity: 'Medium' },
        Forwards: { group: 'Forwards', focus: 'Shooting', intensity: 'Medium' },
      },
      playerFocusOverrides: nextOverrides,
    });
  };

  const boardConf = getConfidenceLabel(userClub.boardConfidence);
  const fanConf = getConfidenceLabel(userClub.fanConfidence);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Shared Top Mode Switcher Bar */}
      <div className="cm-panel">
        <div
          className="cm-panel-header"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              type="button"
              className={`cm-tab ${mode === 'news' ? 'is-active' : ''}`}
              onClick={() => onSwitchMode('news')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px' }}
            >
              <Mail size={12} />
              <span>Manager News</span>
              {unreadCount > 0 && <span className="cm-nav-badge">{unreadCount}</span>}
            </button>
            <button
              type="button"
              className={`cm-tab ${mode === 'finances' ? 'is-active' : ''}`}
              onClick={() => onSwitchMode('finances')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px' }}
            >
              <DollarSign size={12} />
              <span>Club Finances</span>
            </button>
            <button
              type="button"
              className={`cm-tab ${mode === 'training' ? 'is-active' : ''}`}
              onClick={() => onSwitchMode('training')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px' }}
            >
              <Dumbbell size={12} />
              <span>Training Schedules</span>
            </button>
          </div>

          <span className="cm-num" style={{ fontSize: 11, color: 'var(--cm-text-muted)' }}>
            {userClub.name} · {formatDateCM(currentDate)}
          </span>
        </div>
      </div>

      {/* ==================== MODE 1: MANAGER NEWS INBOX ==================== */}
      {mode === 'news' && (
        <div className="cm-panel">
          {/* Category Filter + Mark All Read Toolbar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 8,
              padding: '7px 10px',
              background: 'rgba(13, 24, 44, 0.88)',
              borderBottom: '1px solid var(--cm-border)',
            }}
          >
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {(
                [
                  { id: 'all', label: `All (${news.length})` },
                  { id: 'transfer', label: 'Transfer' },
                  { id: 'match', label: 'Match' },
                  { id: 'injury', label: 'Injury' },
                  { id: 'board', label: 'Board' },
                  { id: 'training', label: 'Training' },
                  { id: 'scout', label: 'Scout / League' },
                ] as const
              ).map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  className={`cm-tab ${newsFilter === cat.id ? 'is-active' : ''}`}
                  onClick={() => setNewsFilter(cat.id)}
                  style={{ padding: '3px 9px', fontSize: 11.5 }}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              className="cm-btn cm-btn-sm"
              disabled={unreadCount === 0}
              onClick={onMarkAllNewsRead}
            >
              <CheckCheck size={12} />
              <span>Mark All Read ({unreadCount})</span>
            </button>
          </div>

          {/* Classic CM 01/02 Split-Pane Inbox */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(290px, 390px) 1fr',
              minHeight: 460,
              maxHeight: 'calc(100vh - 235px)',
              overflow: 'hidden',
            }}
          >
            {/* Left List */}
            <div
              style={{
                borderRight: '1px solid var(--cm-border)',
                overflowY: 'auto',
                background: 'rgba(6, 12, 24, 0.72)',
              }}
            >
              {filteredNews.map((item) => {
                const isSelected = activeArticle?.id === item.id;
                const catStyle = CATEGORY_META[item.category] ?? CATEGORY_META.media;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelectArticle(item)}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '9px 10px',
                      border: 'none',
                      borderBottom: '1px solid rgba(124, 160, 208, 0.14)',
                      borderLeft: isSelected
                        ? '3px solid var(--cm-gold)'
                        : item.read
                          ? '3px solid transparent'
                          : '3px solid var(--cm-cyan)',
                      background: isSelected
                        ? 'rgba(34, 58, 98, 0.72)'
                        : item.read
                          ? 'transparent'
                          : 'rgba(20, 40, 72, 0.42)',
                      color: 'var(--cm-text)',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 6,
                      }}
                    >
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                        {!item.read ? (
                          <Mail size={12} color="#ffd84d" />
                        ) : (
                          <MailOpen size={12} color="#667d9e" />
                        )}
                        <span
                          style={{
                            fontSize: 9.5,
                            fontWeight: 800,
                            textTransform: 'uppercase',
                            padding: '1px 5px',
                            background: catStyle.bg,
                            color: catStyle.color,
                          }}
                        >
                          {catStyle.label}
                        </span>
                        {item.importance === 'urgent' && (
                          <span
                            style={{
                              fontSize: 9.5,
                              fontWeight: 800,
                              padding: '1px 4px',
                              background: 'rgba(220, 38, 38, 0.35)',
                              color: '#fca5a5',
                            }}
                          >
                            URGENT
                          </span>
                        )}
                      </div>
                      <span className="cm-num" style={{ fontSize: 10.5, color: 'var(--cm-text-dim)' }}>
                        {formatDateCM(item.date)}
                      </span>
                    </div>

                    <div
                      style={{
                        fontSize: 12.5,
                        fontWeight: item.read ? 500 : 800,
                        color: item.read ? 'var(--cm-text-muted)' : '#ffffff',
                        lineHeight: 1.3,
                      }}
                    >
                      {item.headline}
                    </div>
                  </button>
                );
              })}

              {filteredNews.length === 0 && (
                <div style={{ padding: 28, textAlign: 'center', color: 'var(--cm-text-muted)' }}>
                  No inbox messages in this category.
                </div>
              )}
            </div>

            {/* Right Article Reader */}
            <div
              style={{
                overflowY: 'auto',
                padding: '14px 16px',
                background: 'rgba(8, 15, 28, 0.65)',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}
            >
              {activeArticle ? (
                <>
                  {(() => {
                    const catStyle = CATEGORY_META[activeArticle.category] ?? CATEGORY_META.media;
                    const relPlayer = activeArticle.relatedPlayerId
                      ? players[activeArticle.relatedPlayerId]
                      : undefined;
                    const relClub = activeArticle.relatedClubId
                      ? clubs[activeArticle.relatedClubId]
                      : undefined;

                    return (
                      <>
                        <div
                          style={{
                            borderBottom: '1px solid var(--cm-border)',
                            paddingBottom: 10,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 6,
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: 8,
                            }}
                          >
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                              <span
                                style={{
                                  fontSize: 10.5,
                                  fontWeight: 800,
                                  textTransform: 'uppercase',
                                  padding: '2px 7px',
                                  background: catStyle.bg,
                                  color: catStyle.color,
                                }}
                              >
                                {catStyle.label}
                              </span>
                              {activeArticle.importance === 'urgent' && (
                                <span
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 4,
                                    fontSize: 10.5,
                                    fontWeight: 800,
                                    padding: '2px 7px',
                                    background: 'rgba(220, 38, 38, 0.35)',
                                    border: '1px solid #f87171',
                                    color: '#fecaca',
                                  }}
                                >
                                  <AlertCircle size={11} />
                                  URGENT ATTENTION
                                </span>
                              )}
                            </div>
                            <span className="cm-num" style={{ fontSize: 11.5, color: 'var(--cm-gold)' }}>
                              {formatDateCM(activeArticle.date)}
                            </span>
                          </div>

                          <h2
                            style={{
                              margin: 0,
                              fontSize: 17,
                              fontWeight: 800,
                              color: '#ffffff',
                              lineHeight: 1.3,
                            }}
                          >
                            {activeArticle.headline}
                          </h2>
                        </div>

                        {/* Body Paragraphs */}
                        <div
                          style={{
                            fontSize: 13,
                            lineHeight: 1.6,
                            color: '#dce7f7',
                            whiteSpace: 'pre-line',
                          }}
                        >
                          {activeArticle.body}
                        </div>

                        {/* Linked Entities & Action Buttons */}
                        <div
                          style={{
                            marginTop: 'auto',
                            paddingTop: 12,
                            borderTop: '1px solid var(--cm-border-subtle)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            flexWrap: 'wrap',
                            gap: 8,
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            {relPlayer && (
                              <button
                                type="button"
                                className="cm-btn cm-btn-sm cm-btn-gold"
                                onClick={() => onSelectPlayer(relPlayer.id)}
                              >
                                <User size={12} />
                                <span>View Player: {relPlayer.name}</span>
                              </button>
                            )}
                            {relClub && (
                              <button
                                type="button"
                                className="cm-btn cm-btn-sm cm-btn-primary"
                                onClick={() => onSelectClub(relClub.id)}
                              >
                                <Building2 size={12} />
                                <span>Inspect Club: {relClub.shortName}</span>
                              </button>
                            )}
                            {activeArticle.category === 'board' && (
                              <button
                                type="button"
                                className="cm-btn cm-btn-sm"
                                onClick={() => onSwitchMode('finances')}
                              >
                                <DollarSign size={12} />
                                <span>Open Finances</span>
                              </button>
                            )}
                            {(activeArticle.category === 'training' ||
                              activeArticle.category === 'injury') && (
                              <button
                                type="button"
                                className="cm-btn cm-btn-sm"
                                onClick={() => onSwitchMode('training')}
                              >
                                <Dumbbell size={12} />
                                <span>Adjust Training</span>
                              </button>
                            )}
                          </div>

                          {!activeArticle.read && (
                            <button
                              type="button"
                              className="cm-btn cm-btn-sm"
                              onClick={() => onMarkNewsRead(activeArticle.id)}
                            >
                              <CheckCheck size={12} />
                              <span>Mark Read</span>
                            </button>
                          )}
                        </div>
                      </>
                    );
                  })()}
                </>
              ) : (
                <div style={{ padding: 30, textAlign: 'center', color: 'var(--cm-text-muted)' }}>
                  Select a news item from your Manager Inbox to read details.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==================== MODE 2: CLUB FINANCES ==================== */}
      {mode === 'finances' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Top KPI Strip */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(215px, 1fr))',
              gap: 10,
            }}
          >
            <div className="cm-panel">
              <div className="cm-panel-header">Club Balance</div>
              <div className="cm-panel-body">
                <div
                  className="cm-num"
                  style={{
                    fontSize: 22,
                    fontWeight: 800,
                    color: financesSummary.fin.balance >= 0 ? 'var(--cm-lime)' : 'var(--cm-red)',
                  }}
                >
                  {formatCurrency(financesSummary.fin.balance)}
                </div>
                <div style={{ fontSize: 11, color: 'var(--cm-text-muted)', marginTop: 3 }}>
                  Status:{' '}
                  <strong style={{ color: financesSummary.fin.balance >= 0 ? '#86efac' : '#fca5a5' }}>
                    {financesSummary.fin.balance >= 25_000_000
                      ? 'Rich / Secure'
                      : financesSummary.fin.balance >= 0
                        ? 'Okay'
                        : 'Insecure (Overdrawn)'}
                  </strong>
                </div>
              </div>
            </div>

            <div className="cm-panel">
              <div className="cm-panel-header">Remaining Transfer Budget</div>
              <div className="cm-panel-body">
                <div className="cm-num" style={{ fontSize: 22, fontWeight: 800, color: 'var(--cm-gold)' }}>
                  {formatCurrency(financesSummary.fin.transferBudget)}
                </div>
                <div style={{ fontSize: 11, color: 'var(--cm-text-muted)', marginTop: 3 }}>
                  Available immediately for upfront transfer fees
                </div>
              </div>
            </div>

            <div className="cm-panel">
              <div className="cm-panel-header">Weekly Wage Bill</div>
              <div className="cm-panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span className="cm-num" style={{ fontSize: 18, fontWeight: 800, color: '#fff' }}>
                    {formatCurrency(financesSummary.weeklyWages)}/wk
                  </span>
                  <span className="cm-num" style={{ fontSize: 11, color: 'var(--cm-text-muted)' }}>
                    / {formatCurrency(financesSummary.fin.wageBudgetWeekly)}
                  </span>
                </div>
                <div
                  style={{
                    height: 9,
                    background: 'rgba(6, 12, 24, 0.85)',
                    border: '1px solid var(--cm-border)',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${Math.min(100, financesSummary.wagePct)}%`,
                      height: '100%',
                      background:
                        financesSummary.wagePct > 100
                          ? '#ef4444'
                          : financesSummary.wagePct >= 85
                            ? '#facc15'
                            : '#4ade80',
                    }}
                  />
                </div>
                <div
                  className="cm-num"
                  style={{
                    fontSize: 11,
                    color: financesSummary.wageHeadroom >= 0 ? '#86efac' : '#fca5a5',
                  }}
                >
                  {financesSummary.wageHeadroom >= 0
                    ? `${formatCurrency(financesSummary.wageHeadroom)}/wk under budget (${financesSummary.wagePct}%)`
                    : `${formatCurrency(Math.abs(financesSummary.wageHeadroom))}/wk OVER budget!`}
                </div>
              </div>
            </div>

            <div className="cm-panel">
              <div className="cm-panel-header">Board Confidence & Target</div>
              <div className="cm-panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Shield size={13} color="#ffd84d" />
                  <span>{userClub.boardExpectation}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                    <span style={{ color: 'var(--cm-text-muted)' }}>Board:</span>
                    <span className="cm-num" style={{ color: boardConf.color, fontWeight: 700 }}>
                      {userClub.boardConfidence}% ({boardConf.text})
                    </span>
                  </div>
                  <div style={{ height: 6, background: 'rgba(6, 12, 24, 0.85)', border: '1px solid var(--cm-border-subtle)' }}>
                    <div style={{ width: `${userClub.boardConfidence}%`, height: '100%', background: boardConf.color }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                    <span style={{ color: 'var(--cm-text-muted)' }}>Supporters:</span>
                    <span className="cm-num" style={{ color: fanConf.color, fontWeight: 700 }}>
                      {userClub.fanConfidence}% ({fanConf.text})
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 2-Column Breakdown: Annual Income/Expenditure vs Recent Ledger */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(280px, 380px) 1fr',
              gap: 10,
            }}
          >
            {/* Revenue & Cost Breakdown */}
            <div className="cm-panel">
              <div className="cm-panel-header">
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <TrendingUp size={13} />
                  Income & Expenditure Overview
                </span>
              </div>
              <div className="cm-panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#86efac' }}>
                  Projected Annual Revenue
                </div>
                {[
                  { label: 'TV / Broadcast Deal', amount: financesSummary.fin.tvRevenueAnnual },
                  { label: 'Sponsorship & Merchandising', amount: financesSummary.fin.sponsorIncomeAnnual },
                  {
                    label: `Est. Gate Receipts (€${financesSummary.fin.ticketPriceAvg} avg)`,
                    amount: financesSummary.estAnnualGate,
                  },
                ].map((row) => (
                  <div
                    key={row.label}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: 12,
                      paddingBottom: 4,
                      borderBottom: '1px solid rgba(124, 160, 208, 0.12)',
                    }}
                  >
                    <span style={{ color: 'var(--cm-text-muted)' }}>{row.label}</span>
                    <span className="cm-num" style={{ color: 'var(--cm-lime)', fontWeight: 700 }}>
                      +{formatCurrency(row.amount)}
                    </span>
                  </div>
                ))}

                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    color: '#fca5a5',
                    marginTop: 4,
                  }}
                >
                  Projected Annual Outgoings
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: 12,
                    paddingBottom: 4,
                    borderBottom: '1px solid rgba(124, 160, 208, 0.12)',
                  }}
                >
                  <span style={{ color: 'var(--cm-text-muted)' }}>Player Wages (52 weeks)</span>
                  <span className="cm-num" style={{ color: 'var(--cm-red)', fontWeight: 700 }}>
                    -{formatCurrency(financesSummary.estAnnualWages)}
                  </span>
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: 12,
                    paddingBottom: 4,
                    borderBottom: '1px solid rgba(124, 160, 208, 0.12)',
                  }}
                >
                  <span style={{ color: 'var(--cm-text-muted)' }}>Net Transfer Activity (Season)</span>
                  <span
                    className="cm-num"
                    style={{
                      color:
                        financesSummary.byCat.Transfer >= 0 ? 'var(--cm-lime)' : 'var(--cm-red)',
                      fontWeight: 700,
                    }}
                  >
                    {financesSummary.byCat.Transfer >= 0 ? '+' : ''}
                    {formatCurrency(financesSummary.byCat.Transfer)}
                  </span>
                </div>

                <div
                  style={{
                    marginTop: 4,
                    padding: '7px 9px',
                    background: 'rgba(6, 12, 24, 0.72)',
                    border: '1px solid var(--cm-border-subtle)',
                    fontSize: 11.5,
                    display: 'flex',
                    justifyContent: 'space-between',
                  }}
                >
                  <span style={{ color: 'var(--cm-text-muted)' }}>Est. Home Matchday Gate:</span>
                  <span className="cm-num" style={{ color: 'var(--cm-cyan)', fontWeight: 700 }}>
                    {formatCurrency(financesSummary.estSelloutGate)}
                  </span>
                </div>
              </div>
            </div>

            {/* Recent Financial Ledger */}
            <div className="cm-panel">
              <div className="cm-panel-header">
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <TrendingDown size={13} />
                  Club Cashflow Ledger ({financesSummary.fin.monthlyTransactions.length})
                </span>
                <span className="cm-num" style={{ fontSize: 11, color: 'var(--cm-text-muted)' }}>
                  In: +{formatCurrency(financesSummary.totalIncomeTx)} · Out: -
                  {formatCurrency(financesSummary.totalExpenseTx)}
                </span>
              </div>
              <div className="cm-table-wrap" style={{ maxHeight: 360, overflowY: 'auto' }}>
                <table className="cm-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Category</th>
                      <th>Description</th>
                      <th style={{ textAlign: 'right' }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {financesSummary.fin.monthlyTransactions.map((tx) => (
                      <tr key={tx.id}>
                        <td className="cm-num" style={{ color: 'var(--cm-text-muted)', fontSize: 11 }}>
                          {formatDateCM(tx.date)}
                        </td>
                        <td>
                          <span
                            style={{
                              fontSize: 10.5,
                              padding: '1px 6px',
                              background: 'rgba(20, 36, 62, 0.85)',
                              border: '1px solid var(--cm-border-subtle)',
                              color: 'var(--cm-cyan)',
                            }}
                          >
                            {tx.category}
                          </span>
                        </td>
                        <td style={{ whiteSpace: 'normal' }}>{tx.description}</td>
                        <td
                          className="cm-num"
                          style={{
                            textAlign: 'right',
                            fontWeight: 700,
                            color: tx.amount >= 0 ? 'var(--cm-lime)' : 'var(--cm-red)',
                          }}
                        >
                          {tx.amount >= 0 ? '+' : ''}
                          {formatCurrency(tx.amount)}
                        </td>
                      </tr>
                    ))}
                    {financesSummary.fin.monthlyTransactions.length === 0 && (
                      <tr>
                        <td colSpan={4} style={{ textAlign: 'center', padding: 24, color: 'var(--cm-text-muted)' }}>
                          No financial transactions logged yet this season. Advance days or complete
                          a matchday to see gate receipts and wages posted here.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== MODE 3: TRAINING SCHEDULES ==================== */}
      {mode === 'training' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Global Training Intensity & Auto-Assign Bar */}
          <div className="cm-panel">
            <div
              className="cm-panel-body"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 10,
                padding: '8px 12px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--cm-gold)', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <Activity size={14} />
                  Overall Workload:
                </span>
                <div style={{ display: 'flex', gap: 4 }}>
                  {TRAINING_INTENSITIES.map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      className={`cm-tab ${training.overallIntensity === lvl ? 'is-active' : ''}`}
                      onClick={() => handleSetOverallIntensity(lvl)}
                      style={{ padding: '4px 11px', fontSize: 11.5 }}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
                <span style={{ fontSize: 11, color: 'var(--cm-text-muted)' }}>
                  {training.overallIntensity === 'Light'
                    ? 'Faster condition recovery, minimal injury risk'
                    : training.overallIntensity === 'Intensive'
                      ? 'Fastest attribute growth, higher fatigue & injury risk'
                      : 'Balanced fitness maintenance & attribute progression'}
                </span>
              </div>

              <button
                type="button"
                className="cm-btn cm-btn-sm cm-btn-gold"
                onClick={handleAutoAssignTraining}
              >
                <Wand2 size={12} />
                <span>Auto-Assign Schedules</span>
              </button>
            </div>
          </div>

          {/* 4 Positional Group Schedule Cards */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(225px, 1fr))',
              gap: 10,
            }}
          >
            {TRAINING_GROUPS.map((groupKey) => {
              const cfg = training.groups[groupKey] ?? {
                group: groupKey,
                focus: 'General' as TrainingFocus,
                intensity: training.overallIntensity,
              };
              const stats = groupStats[groupKey];
              const condColor = getConditionColor(stats.avgCond);

              return (
                <div key={groupKey} className="cm-panel">
                  <div className="cm-panel-header">
                    <span>{groupKey}</span>
                    <span className="cm-num" style={{ fontSize: 10.5, color: 'var(--cm-text-muted)' }}>
                      {stats.count} players · Avg{' '}
                      <span style={{ color: condColor }}>{stats.avgCond}%</span>
                    </span>
                  </div>
                  <div className="cm-panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      <label style={{ fontSize: 11, color: 'var(--cm-text-dim)', textTransform: 'uppercase' }}>
                        Schedule Focus
                      </label>
                      <select
                        className="cm-select"
                        value={cfg.focus}
                        onChange={(e) =>
                          handleUpdateGroup(groupKey, { focus: e.target.value as TrainingFocus })
                        }
                      >
                        {TRAINING_FOCUSES.map((f) => (
                          <option key={f} value={f}>
                            {f}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      <label style={{ fontSize: 11, color: 'var(--cm-text-dim)', textTransform: 'uppercase' }}>
                        Group Intensity
                      </label>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {TRAINING_INTENSITIES.map((lvl) => (
                          <button
                            key={lvl}
                            type="button"
                            className={`cm-tab ${cfg.intensity === lvl ? 'is-active' : ''}`}
                            onClick={() => handleUpdateGroup(groupKey, { intensity: lvl })}
                            style={{ flex: 1, padding: '3px 6px', fontSize: 11, textAlign: 'center' }}
                          >
                            {lvl}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Weekly Coach Report & Recent Improvements Strip */}
          {(training.lastWeeklyReport || training.recentImprovements.length > 0) && (
            <div className="cm-panel" style={{ borderColor: 'rgba(74, 222, 128, 0.4)' }}>
              <div className="cm-panel-header">
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <Sparkles size={13} color="#4ade80" />
                  Coach&apos;s Weekly Training Report
                </span>
              </div>
              <div className="cm-panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {training.lastWeeklyReport && (
                  <div style={{ fontSize: 12, color: 'var(--cm-text)' }}>
                    {training.lastWeeklyReport}
                  </div>
                )}
                {training.recentImprovements.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {training.recentImprovements.slice(0, 12).map((imp, idx) => (
                      <button
                        key={`${imp.playerId}-${imp.attribute}-${idx}`}
                        type="button"
                        onClick={() => onSelectPlayer(imp.playerId)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5,
                          padding: '3px 8px',
                          background:
                            imp.delta >= 0
                              ? 'rgba(22, 163, 74, 0.22)'
                              : 'rgba(220, 38, 38, 0.22)',
                          border:
                            imp.delta >= 0
                              ? '1px solid rgba(74, 222, 128, 0.5)'
                              : '1px solid rgba(248, 113, 113, 0.5)',
                          color: '#fff',
                          fontSize: 11.5,
                          cursor: 'pointer',
                        }}
                      >
                        <strong>{imp.playerName}</strong>
                        <span style={{ color: 'var(--cm-text-muted)' }}>{imp.attribute}</span>
                        <span
                          className="cm-num"
                          style={{
                            fontWeight: 800,
                            color: imp.delta >= 0 ? '#4ade80' : '#f87171',
                          }}
                        >
                          {imp.delta >= 0 ? `+${imp.delta} ▲` : `${imp.delta} ▼`}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Individual Squad Training Assignments Table */}
          <div className="cm-panel">
            <div className="cm-panel-header">
              <span>Individual Squad Training Assignments ({squad.length})</span>
              <span style={{ fontSize: 11, color: 'var(--cm-text-muted)', textTransform: 'none' }}>
                Override individual players (e.g., Rest fatigued starters or focus Fitness)
              </span>
            </div>
            <div className="cm-table-wrap" style={{ maxHeight: 'calc(100vh - 430px)', overflowY: 'auto' }}>
              <table className="cm-table">
                <thead>
                  <tr>
                    <th>Player</th>
                    <th>Pos</th>
                    <th style={{ textAlign: 'right' }}>Age</th>
                    <th>Group</th>
                    <th>Condition</th>
                    <th>Fitness Trend</th>
                    <th>Assigned Schedule</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedTrainingSquad.map((player) => {
                    const groupKey = getPlayerTrainingGroup(player);
                    const groupCfg = training.groups[groupKey] ?? {
                      group: groupKey,
                      focus: 'General' as TrainingFocus,
                      intensity: training.overallIntensity,
                    };
                    const override = training.playerFocusOverrides[player.id];
                    const effectiveFocus = override ?? groupCfg.focus;
                    const trend = getFitnessTrend(player, effectiveFocus, groupCfg.intensity);
                    const condColor = getConditionColor(player.condition);
                    const primaryPos = player.positions[0] ?? 'MC';

                    return (
                      <tr key={player.id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <button
                              type="button"
                              className="cm-link"
                              onClick={() => onSelectPlayer(player.id)}
                            >
                              {player.name}
                            </button>
                            {player.injury && (
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 2,
                                  fontSize: 9.5,
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
                          </div>
                        </td>
                        <td>
                          <span className={`cm-pos-pill ${POS_CLASS[getPositionCategory(primaryPos)]}`}>
                            {primaryPos}
                          </span>
                        </td>
                        <td className="cm-num" style={{ textAlign: 'right' }}>
                          {player.age}
                        </td>
                        <td style={{ fontSize: 11.5, color: 'var(--cm-text-muted)' }}>
                          {groupKey}
                        </td>
                        <td>
                          <div className="cm-cond-bar">
                            <div className="cm-cond-track" style={{ width: 54 }}>
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
                              style={{ fontSize: 11.5, color: condColor, minWidth: 34, textAlign: 'right' }}
                            >
                              {Math.round(player.condition)}%
                            </span>
                          </div>
                        </td>
                        <td>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              fontSize: 11.5,
                              fontWeight: 600,
                              color: trend.color,
                            }}
                          >
                            {trend.dir === 'up' && <ArrowUp size={12} />}
                            {trend.dir === 'down' && <ArrowDown size={12} />}
                            {trend.dir === 'flat' && <ArrowRight size={12} />}
                            {trend.dir === 'rehab' && <Cross size={11} />}
                            <span>{trend.label}</span>
                          </span>
                        </td>
                        <td>
                          <select
                            className="cm-select"
                            value={override ?? 'DEFAULT'}
                            onChange={(e) =>
                              handleSetPlayerOverride(
                                player.id,
                                e.target.value as TrainingFocus | 'DEFAULT'
                              )
                            }
                            style={{
                              fontSize: 11.5,
                              padding: '3px 7px',
                              borderColor: override ? 'var(--cm-gold)' : undefined,
                              color: override ? 'var(--cm-gold)' : 'var(--cm-text)',
                            }}
                          >
                            <option value="DEFAULT">Group Default ({groupCfg.focus})</option>
                            {TRAINING_FOCUSES.map((f) => (
                              <option key={f} value={f}>
                                Override: {f}
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NewsFinancesTrainingView;
