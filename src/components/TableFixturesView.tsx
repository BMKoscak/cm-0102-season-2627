import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  Award,
  Calendar,
  ChevronLeft,
  ChevronRight,
  FileText,
  Flame,
  Globe,
  Play,
  Shield,
  Star,
  Trophy,
  Users,
  X,
} from 'lucide-react';
import type { TableFixturesViewProps } from '../types/contracts';
import type {
  Club,
  Fixture,
  League,
  Player,
  PositionCategory,
  StandingRow,
} from '../types/game';
import { getPositionCategory } from '../engine/attributes';
import { formatDateCM } from '../engine/seasonEngine';

type TableSubTab = 'standings' | 'scorers' | 'assists' | 'ratings';
type FixtureScope = 'league' | 'my_club';

interface CountryGroup {
  country: string;
  countryCode: string;
  maxRep: number;
  leagues: League[];
}

interface ZoneInfo {
  color: string;
  label: string;
}

const POS_CLASS: Record<PositionCategory, string> = {
  GK: 'cm-pos-gk',
  DEF: 'cm-pos-def',
  MID: 'cm-pos-mid',
  FWD: 'cm-pos-fwd',
};

function getStandingZone(pos: number, totalRows: number, league: League): ZoneInfo | null {
  if (totalRows <= 0) return null;

  // Relegation at bottom takes precedence if overlapping
  if (league.relegationSpots > 0 && pos > totalRows - league.relegationSpots) {
    return { color: '#ef4444', label: 'Relegation' };
  }

  if (league.tier === 2) {
    if (league.promotionSpots > 0 && pos <= league.promotionSpots) {
      return {
        color: pos === 1 ? '#ffd84d' : '#4ade80',
        label: pos === 1 ? 'Champions & Promotion' : 'Automatic Promotion',
      };
    }
    if (
      league.playoffSpots > 0 &&
      pos <= league.promotionSpots + league.playoffSpots
    ) {
      return { color: '#38e8d5', label: 'Promotion Playoffs' };
    }
    return null;
  }

  // Tier 1 European places & Champions
  if (pos === 1) {
    return {
      color: '#ffd84d',
      label: league.uclSpots > 0 ? 'Champions & UCL' : 'League Champions',
    };
  }
  if (league.uclSpots > 0 && pos <= league.uclSpots) {
    return { color: '#3b82f6', label: 'UEFA Champions League' };
  }
  if (league.uelSpots > 0 && pos <= league.uclSpots + league.uelSpots) {
    return { color: '#f59e0b', label: 'UEFA Europa League' };
  }
  if (
    league.ueclSpots > 0 &&
    pos <= league.uclSpots + league.uelSpots + league.ueclSpots
  ) {
    return { color: '#10b981', label: 'UEFA Conference League' };
  }
  return null;
}

function getMonthKey(isoDate: string): string {
  return isoDate.slice(0, 7); // YYYY-MM
}

function formatMonthLabel(monthKey: string): string {
  const [yr, mo] = monthKey.split('-').map(Number);
  if (!yr || !mo) return monthKey;
  const names = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  return `${names[mo - 1] ?? mo} ${yr}`;
}

export const TableFixturesView: React.FC<TableFixturesViewProps> = ({
  mode,
  activeLeagueId,
  userClubId,
  currentDate,
  leagues,
  clubs,
  players,
  fixtures,
  standings,
  onSelectLeague,
  onSelectClub,
  onSelectPlayer,
  onSwitchMode,
  onPlayFixture,
}) => {
  const [tableTab, setTableTab] = useState<TableSubTab>('standings');
  const [fixtureScope, setFixtureScope] = useState<FixtureScope>('my_club');
  const [selectedRound, setSelectedRound] = useState<number | 'all'>('all');
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [reportFixtureId, setReportFixtureId] = useState<string | null>(null);

  const leagueList = useMemo(() => Object.values(leagues), [leagues]);
  const activeLeague: League =
    leagues[activeLeagueId] ?? leagueList[0];

  // Country-grouped 18-league pyramid selector
  const countryGroups = useMemo<CountryGroup[]>(() => {
    const map = new Map<string, CountryGroup>();
    for (const lg of leagueList) {
      const existing = map.get(lg.country);
      if (existing) {
        existing.leagues.push(lg);
        existing.maxRep = Math.max(existing.maxRep, lg.reputation);
      } else {
        map.set(lg.country, {
          country: lg.country,
          countryCode: lg.countryCode,
          maxRep: lg.reputation,
          leagues: [lg],
        });
      }
    }
    const groups = Array.from(map.values());
    for (const g of groups) {
      g.leagues.sort((a, b) => a.tier - b.tier || b.reputation - a.reputation);
    }
    groups.sort((a, b) => b.maxRep - a.maxRep || a.country.localeCompare(b.country));
    return groups;
  }, [leagueList]);

  // Active league standings
  const activeStandings: StandingRow[] = useMemo(() => {
    return standings[activeLeague?.id] ?? [];
  }, [standings, activeLeague?.id]);

  // Players in active league for Top Scorers / Assists / Avg Rating sub-tabs
  const leaguePlayers = useMemo<Player[]>(() => {
    if (!activeLeague) return [];
    const clubIdSet = new Set(activeLeague.clubIds);
    return Object.values(players).filter(
      (p) => p.clubId !== null && clubIdSet.has(p.clubId)
    );
  }, [players, activeLeague]);

  const topScorers = useMemo(() => {
    return [...leaguePlayers]
      .sort(
        (a, b) =>
          b.seasonStats.goals - a.seasonStats.goals ||
          b.seasonStats.assists - a.seasonStats.assists ||
          b.seasonStats.averageRating - a.seasonStats.averageRating ||
          b.currentAbility - a.currentAbility
      )
      .slice(0, 25);
  }, [leaguePlayers]);

  const topAssisters = useMemo(() => {
    return [...leaguePlayers]
      .sort(
        (a, b) =>
          b.seasonStats.assists - a.seasonStats.assists ||
          b.seasonStats.goals - a.seasonStats.goals ||
          b.seasonStats.averageRating - a.seasonStats.averageRating ||
          b.currentAbility - a.currentAbility
      )
      .slice(0, 25);
  }, [leaguePlayers]);

  const topRated = useMemo(() => {
    const withApps = leaguePlayers.filter(
      (p) => p.seasonStats.appearances + p.seasonStats.subAppearances > 0
    );
    const pool = withApps.length > 0 ? withApps : leaguePlayers;
    return [...pool]
      .sort(
        (a, b) =>
          b.seasonStats.averageRating - a.seasonStats.averageRating ||
          b.seasonStats.goals - a.seasonStats.goals ||
          b.currentAbility - a.currentAbility
      )
      .slice(0, 25);
  }, [leaguePlayers]);

  // Fixtures for selected scope
  const scopedFixtures = useMemo(() => {
    if (fixtureScope === 'my_club') {
      return fixtures
        .filter((f) => f.homeClubId === userClubId || f.awayClubId === userClubId)
        .sort((a, b) => a.date.localeCompare(b.date) || a.round - b.round);
    }
    return fixtures
      .filter((f) => f.leagueId === activeLeague?.id)
      .sort((a, b) => a.round - b.round || a.date.localeCompare(b.date));
  }, [fixtures, fixtureScope, userClubId, activeLeague?.id]);

  // Distinct rounds & months available in scopedFixtures
  const availableRounds = useMemo(() => {
    const set = new Set<number>();
    for (const f of scopedFixtures) set.add(f.round);
    return Array.from(set).sort((a, b) => a - b);
  }, [scopedFixtures]);

  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    for (const f of scopedFixtures) set.add(getMonthKey(f.date));
    return Array.from(set).sort();
  }, [scopedFixtures]);

  // Auto-select current round when switching to Selected League in Fixtures mode
  useEffect(() => {
    if (fixtureScope === 'league' && availableRounds.length > 0) {
      const nextUnplayed = scopedFixtures.find((f) => !f.played);
      if (nextUnplayed) {
        setSelectedRound(nextUnplayed.round);
      } else {
        setSelectedRound(availableRounds[availableRounds.length - 1]);
      }
      setSelectedMonth('all');
    } else if (fixtureScope === 'my_club') {
      setSelectedRound('all');
      setSelectedMonth('all');
    }
  }, [fixtureScope, activeLeague?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const filteredFixtures = useMemo(() => {
    return scopedFixtures.filter((f) => {
      if (selectedRound !== 'all' && f.round !== selectedRound) return false;
      if (selectedMonth !== 'all' && getMonthKey(f.date) !== selectedMonth) return false;
      return true;
    });
  }, [scopedFixtures, selectedRound, selectedMonth]);

  const reportFixture: Fixture | null = useMemo(
    () => (reportFixtureId ? fixtures.find((f) => f.id === reportFixtureId) ?? null : null),
    [fixtures, reportFixtureId]
  );

  const promotionLeague = activeLeague?.promotionLeagueId
    ? leagues[activeLeague.promotionLeagueId]
    : undefined;
  const relegationLeague = activeLeague?.relegationLeagueId
    ? leagues[activeLeague.relegationLeagueId]
    : undefined;

  const renderClubCell = (clubId: string, bold = false) => {
    const c: Club | undefined = clubs[clubId];
    if (!c) return <span>{clubId}</span>;
    return (
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
        <span
          className="cm-club-shield"
          style={{
            width: 20,
            height: 20,
            fontSize: 8.5,
            backgroundColor: c.colors.primary,
            color: c.colors.text,
            borderColor: c.colors.secondary,
          }}
        >
          {c.threeLetterCode}
        </span>
        <button
          type="button"
          className="cm-link"
          onClick={(e) => {
            e.stopPropagation();
            onSelectClub(c.id);
          }}
          style={{
            color: c.id === userClubId ? 'var(--cm-gold)' : '#ffffff',
            fontWeight: bold || c.id === userClubId ? 700 : 600,
          }}
        >
          {c.name}
        </button>
      </div>
    );
  };

  const renderStatBar = (label: string, homeVal: number, awayVal: number, suffix = '') => {
    const total = Math.max(0.01, homeVal + awayVal);
    const homePct = Math.round((homeVal / total) * 100);
    const awayPct = 100 - homePct;
    return (
      <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 11.5,
          }}
        >
          <span className="cm-num" style={{ fontWeight: 700, color: '#fff' }}>
            {homeVal}
            {suffix}
          </span>
          <span style={{ color: 'var(--cm-text-muted)', fontSize: 11 }}>{label}</span>
          <span className="cm-num" style={{ fontWeight: 700, color: '#fff' }}>
            {awayVal}
            {suffix}
          </span>
        </div>
        <div
          style={{
            display: 'flex',
            height: 6,
            background: 'rgba(6, 12, 24, 0.85)',
            border: '1px solid var(--cm-border-subtle)',
            overflow: 'hidden',
          }}
        >
          <div style={{ width: `${homePct}%`, background: '#38e8d5' }} />
          <div style={{ width: `${awayPct}%`, background: '#ffd84d' }} />
        </div>
      </div>
    );
  };

  const renderPlayerLeaderTable = (list: Player[], highlightCol: 'goals' | 'assists' | 'avr') => (
    <div className="cm-table-wrap" style={{ maxHeight: 'calc(100vh - 340px)', overflowY: 'auto' }}>
      <table className="cm-table">
        <thead>
          <tr>
            <th style={{ width: 38, textAlign: 'right' }}>#</th>
            <th>Player</th>
            <th>Club</th>
            <th>Pos</th>
            <th style={{ textAlign: 'right' }}>Apps</th>
            <th style={{ textAlign: 'right' }}>Gls</th>
            <th style={{ textAlign: 'right' }}>Ast</th>
            <th style={{ textAlign: 'right' }}>AvR</th>
          </tr>
        </thead>
        <tbody>
          {list.map((p, idx) => {
            const pClub = p.clubId ? clubs[p.clubId] : null;
            const pos = p.positions[0] ?? 'MC';
            const hasApps = p.seasonStats.appearances + p.seasonStats.subAppearances > 0;
            return (
              <tr key={p.id} className={p.clubId === userClubId ? 'is-user-row' : undefined}>
                <td className="cm-num" style={{ textAlign: 'right', color: idx < 3 ? 'var(--cm-gold)' : 'var(--cm-text-dim)', fontWeight: 700 }}>
                  {idx + 1}
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
                    {p.isWonderkid && <Star size={10} color="#ffd84d" fill="#ffd84d" />}
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
                    '—'
                  )}
                </td>
                <td>
                  <span className={`cm-pos-pill ${POS_CLASS[getPositionCategory(pos)]}`}>
                    {pos}
                  </span>
                </td>
                <td className="cm-num" style={{ textAlign: 'right', color: 'var(--cm-text-muted)' }}>
                  {p.seasonStats.appearances}
                  {p.seasonStats.subAppearances > 0 ? ` (${p.seasonStats.subAppearances})` : ''}
                </td>
                <td
                  className="cm-num"
                  style={{
                    textAlign: 'right',
                    fontWeight: highlightCol === 'goals' ? 800 : 600,
                    color: highlightCol === 'goals' ? 'var(--cm-gold)' : '#fff',
                  }}
                >
                  {p.seasonStats.goals}
                </td>
                <td
                  className="cm-num"
                  style={{
                    textAlign: 'right',
                    fontWeight: highlightCol === 'assists' ? 800 : 600,
                    color: highlightCol === 'assists' ? 'var(--cm-cyan)' : '#fff',
                  }}
                >
                  {p.seasonStats.assists}
                </td>
                <td
                  className="cm-num"
                  style={{
                    textAlign: 'right',
                    fontWeight: highlightCol === 'avr' ? 800 : 600,
                    color: hasApps
                      ? highlightCol === 'avr'
                        ? '#ffd84d'
                        : '#38e8d5'
                      : 'var(--cm-text-dim)',
                  }}
                >
                  {hasApps ? p.seasonStats.averageRating.toFixed(2) : '—'}
                </td>
              </tr>
            );
          })}
          {list.length === 0 && (
            <tr>
              <td colSpan={8} style={{ textAlign: 'center', padding: 20, color: 'var(--cm-text-muted)' }}>
                No league player statistics recorded yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Country-Grouped Deep 18-League Pyramid Selector */}
      <div className="cm-panel">
        <div className="cm-panel-header" style={{ flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Globe size={14} color="#ffd84d" />
            <span>Competitions Pyramid ({leagueList.length} Leagues · {countryGroups.length} Nations)</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button
              type="button"
              className={`cm-tab ${mode === 'table' ? 'is-active' : ''}`}
              onClick={() => onSwitchMode('table')}
              style={{ padding: '3px 10px', fontSize: 11.5 }}
            >
              <Trophy size={12} style={{ marginRight: 5, verticalAlign: 'middle' }} />
              League Table
            </button>
            <button
              type="button"
              className={`cm-tab ${mode === 'fixtures' ? 'is-active' : ''}`}
              onClick={() => onSwitchMode('fixtures')}
              style={{ padding: '3px 10px', fontSize: 11.5 }}
            >
              <Calendar size={12} style={{ marginRight: 5, verticalAlign: 'middle' }} />
              Fixtures & Results
            </button>
          </div>
        </div>

        {/* Compact country-grouped selector strip */}
        <div
          className="cm-panel-body"
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 6,
            padding: '7px 9px',
            background: 'rgba(6, 12, 24, 0.58)',
          }}
        >
          {countryGroups.map((group) => (
            <div
              key={group.country}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '3px 5px',
                background: 'rgba(13, 24, 44, 0.78)',
                border: '1px solid var(--cm-border-subtle)',
              }}
            >
              <span
                className="cm-num"
                title={group.country}
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  color: 'var(--cm-text-dim)',
                  padding: '0 3px',
                }}
              >
                {group.countryCode}
              </span>
              {group.leagues.map((lg) => {
                const isActive = activeLeague?.id === lg.id;
                return (
                  <button
                    key={lg.id}
                    type="button"
                    onClick={() => onSelectLeague(lg.id)}
                    title={`${lg.country} — ${lg.name} (Tier ${lg.tier})`}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '2px 7px',
                      fontSize: 11,
                      fontWeight: isActive ? 700 : 500,
                      cursor: 'pointer',
                      border: isActive
                        ? '1px solid var(--cm-gold)'
                        : '1px solid rgba(124, 160, 208, 0.2)',
                      background: isActive
                        ? 'linear-gradient(180deg, rgba(255, 216, 77, 0.25) 0%, rgba(30, 58, 102, 0.9) 100%)'
                        : 'rgba(10, 18, 34, 0.85)',
                      color: isActive ? 'var(--cm-gold)' : 'var(--cm-text)',
                    }}
                  >
                    <span
                      className="cm-num"
                      style={{
                        fontSize: 9,
                        padding: '0 3px',
                        background:
                          lg.tier === 1
                            ? 'rgba(255, 216, 77, 0.16)'
                            : 'rgba(148, 163, 184, 0.16)',
                        color: lg.tier === 1 ? 'var(--cm-gold)' : 'var(--cm-text-muted)',
                      }}
                    >
                      T{lg.tier}
                    </span>
                    <span>{lg.shortName}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Active League Header Banner */}
      {activeLeague && (
        <div
          className="cm-panel"
          style={{
            borderLeft: `4px solid ${activeLeague.accentColor || '#ffd84d'}`,
            padding: '7px 12px',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 8,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <Trophy size={16} color={activeLeague.accentColor || '#ffd84d'} />
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>
                {activeLeague.name}{' '}
                <span style={{ fontSize: 11.5, color: 'var(--cm-text-muted)', fontWeight: 500 }}>
                  — {activeLeague.country} (Tier {activeLeague.tier})
                </span>
              </div>
              <div className="cm-num" style={{ fontSize: 11, color: 'var(--cm-text-muted)' }}>
                Trophy: {activeLeague.trophyName} · {activeLeague.clubIds.length} Clubs · Rep:{' '}
                {activeLeague.reputation}/20
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            {promotionLeague && (
              <button
                type="button"
                className="cm-btn cm-btn-sm"
                onClick={() => onSelectLeague(promotionLeague.id)}
                title={`Jump up to ${promotionLeague.name}`}
              >
                <ArrowUpRight size={12} color="#4ade80" />
                <span>Tier 1: {promotionLeague.shortName}</span>
              </button>
            )}
            {relegationLeague && (
              <button
                type="button"
                className="cm-btn cm-btn-sm"
                onClick={() => onSelectLeague(relegationLeague.id)}
                title={`Jump down to ${relegationLeague.name}`}
              >
                <ArrowDownRight size={12} color="#f87171" />
                <span>Tier 2: {relegationLeague.shortName}</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* ==================== TABLE MODE ==================== */}
      {mode === 'table' && activeLeague && (
        <div className="cm-panel">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '6px 10px',
              background: 'rgba(13, 24, 44, 0.85)',
              borderBottom: '1px solid var(--cm-border)',
              flexWrap: 'wrap',
              gap: 8,
            }}
          >
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {(
                [
                  { id: 'standings', label: 'League Standings' },
                  { id: 'scorers', label: 'Top Scorers' },
                  { id: 'assists', label: 'Most Assists' },
                  { id: 'ratings', label: 'Highest AvR' },
                ] as const
              ).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`cm-tab ${tableTab === t.id ? 'is-active' : ''}`}
                  onClick={() => setTableTab(t.id)}
                  style={{ padding: '4px 10px', fontSize: 11.5 }}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <span className="cm-num" style={{ fontSize: 11, color: 'var(--cm-text-muted)' }}>
              Date: {formatDateCM(currentDate)}
            </span>
          </div>

          {tableTab === 'standings' && (
            <>
              <div className="cm-table-wrap" style={{ maxHeight: 'calc(100vh - 360px)', overflowY: 'auto' }}>
                <table className="cm-table">
                  <thead>
                    <tr>
                      <th style={{ width: 42, textAlign: 'right' }}>Pos</th>
                      <th>Club</th>
                      <th style={{ textAlign: 'right' }}>P</th>
                      <th style={{ textAlign: 'right' }}>W</th>
                      <th style={{ textAlign: 'right' }}>D</th>
                      <th style={{ textAlign: 'right' }}>L</th>
                      <th style={{ textAlign: 'right' }}>GF</th>
                      <th style={{ textAlign: 'right' }}>GA</th>
                      <th style={{ textAlign: 'right' }}>GD</th>
                      <th style={{ textAlign: 'right' }}>Pts</th>
                      <th>Form</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeStandings.map((row) => {
                      const zone = getStandingZone(
                        row.position,
                        activeStandings.length,
                        activeLeague
                      );
                      const isUser = row.clubId === userClubId;
                      return (
                        <tr
                          key={row.clubId}
                          className={isUser ? 'is-user-row' : undefined}
                          style={{
                            cursor: 'pointer',
                            borderLeft: zone
                              ? `4px solid ${zone.color}`
                              : '4px solid transparent',
                          }}
                          onClick={() => onSelectClub(row.clubId)}
                          title={zone ? `${row.clubName} — ${zone.label}` : row.clubName}
                        >
                          <td
                            className="cm-num"
                            style={{
                              textAlign: 'right',
                              fontWeight: 800,
                              color: zone ? zone.color : 'var(--cm-text-muted)',
                            }}
                          >
                            {row.position}
                          </td>
                          <td>{renderClubCell(row.clubId, isUser)}</td>
                          <td className="cm-num" style={{ textAlign: 'right' }}>
                            {row.played}
                          </td>
                          <td className="cm-num" style={{ textAlign: 'right', color: '#86efac' }}>
                            {row.won}
                          </td>
                          <td className="cm-num" style={{ textAlign: 'right', color: 'var(--cm-text-muted)' }}>
                            {row.drawn}
                          </td>
                          <td className="cm-num" style={{ textAlign: 'right', color: '#fca5a5' }}>
                            {row.lost}
                          </td>
                          <td className="cm-num" style={{ textAlign: 'right' }}>
                            {row.goalsFor}
                          </td>
                          <td className="cm-num" style={{ textAlign: 'right' }}>
                            {row.goalsAgainst}
                          </td>
                          <td
                            className="cm-num"
                            style={{
                              textAlign: 'right',
                              color:
                                row.goalDifference > 0
                                  ? 'var(--cm-lime)'
                                  : row.goalDifference < 0
                                    ? 'var(--cm-red)'
                                    : 'var(--cm-text-muted)',
                            }}
                          >
                            {row.goalDifference > 0
                              ? `+${row.goalDifference}`
                              : row.goalDifference}
                          </td>
                          <td
                            className="cm-num"
                            style={{
                              textAlign: 'right',
                              fontWeight: 800,
                              fontSize: 13,
                              color: isUser ? 'var(--cm-gold)' : '#ffffff',
                            }}
                          >
                            {row.points}
                          </td>
                          <td>
                            <div style={{ display: 'inline-flex', gap: 3 }}>
                              {row.form.slice(-5).map((res, idx) => (
                                <span
                                  key={idx}
                                  className="cm-num"
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    width: 17,
                                    height: 17,
                                    fontSize: 10,
                                    fontWeight: 800,
                                    background:
                                      res === 'W'
                                        ? 'rgba(34, 197, 94, 0.35)'
                                        : res === 'D'
                                          ? 'rgba(148, 163, 184, 0.28)'
                                          : 'rgba(239, 68, 68, 0.35)',
                                    border:
                                      res === 'W'
                                        ? '1px solid #4ade80'
                                        : res === 'D'
                                          ? '1px solid #94a3b8'
                                          : '1px solid #f87171',
                                    color:
                                      res === 'W'
                                        ? '#86efac'
                                        : res === 'D'
                                          ? '#e2e8f0'
                                          : '#fca5a5',
                                  }}
                                >
                                  {res}
                                </span>
                              ))}
                              {row.form.length === 0 && (
                                <span className="cm-num" style={{ color: 'var(--cm-text-dim)' }}>
                                  —
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Zone Key Legend */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 12,
                  padding: '6px 10px',
                  background: 'rgba(6, 12, 24, 0.72)',
                  borderTop: '1px solid var(--cm-border-subtle)',
                  fontSize: 11,
                  color: 'var(--cm-text-muted)',
                }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 10, height: 10, background: '#ffd84d', display: 'inline-block' }} />
                  Champions
                </span>
                {activeLeague.tier === 1 && activeLeague.uclSpots > 0 && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ width: 10, height: 10, background: '#3b82f6', display: 'inline-block' }} />
                    UCL ({activeLeague.uclSpots})
                  </span>
                )}
                {activeLeague.tier === 1 && activeLeague.uelSpots > 0 && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ width: 10, height: 10, background: '#f59e0b', display: 'inline-block' }} />
                    UEL ({activeLeague.uelSpots})
                  </span>
                )}
                {activeLeague.tier === 1 && activeLeague.ueclSpots > 0 && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ width: 10, height: 10, background: '#10b981', display: 'inline-block' }} />
                    UECL ({activeLeague.ueclSpots})
                  </span>
                )}
                {activeLeague.tier === 2 && activeLeague.promotionSpots > 0 && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ width: 10, height: 10, background: '#4ade80', display: 'inline-block' }} />
                    Promotion ({activeLeague.promotionSpots})
                  </span>
                )}
                {activeLeague.tier === 2 && activeLeague.playoffSpots > 0 && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ width: 10, height: 10, background: '#38e8d5', display: 'inline-block' }} />
                    Playoffs ({activeLeague.playoffSpots})
                  </span>
                )}
                {activeLeague.relegationSpots > 0 && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ width: 10, height: 10, background: '#ef4444', display: 'inline-block' }} />
                    Relegation ({activeLeague.relegationSpots})
                  </span>
                )}
              </div>
            </>
          )}

          {tableTab === 'scorers' && renderPlayerLeaderTable(topScorers, 'goals')}
          {tableTab === 'assists' && renderPlayerLeaderTable(topAssisters, 'assists')}
          {tableTab === 'ratings' && renderPlayerLeaderTable(topRated, 'avr')}
        </div>
      )}

      {/* ==================== FIXTURES MODE ==================== */}
      {mode === 'fixtures' && activeLeague && (
        <div className="cm-panel">
          {/* Scope + Round/Month Filter Toolbar */}
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <button
                type="button"
                className={`cm-tab ${fixtureScope === 'my_club' ? 'is-active' : ''}`}
                onClick={() => setFixtureScope('my_club')}
                style={{ padding: '4px 10px', fontSize: 11.5 }}
              >
                <Shield size={12} style={{ marginRight: 5, verticalAlign: 'middle' }} />
                My Club Schedule
              </button>
              <button
                type="button"
                className={`cm-tab ${fixtureScope === 'league' ? 'is-active' : ''}`}
                onClick={() => setFixtureScope('league')}
                style={{ padding: '4px 10px', fontSize: 11.5 }}
              >
                <Trophy size={12} style={{ marginRight: 5, verticalAlign: 'middle' }} />
                {activeLeague.shortName} Fixtures
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              {/* Round Stepper & Dropdown */}
              {availableRounds.length > 0 && (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                  <button
                    type="button"
                    className="cm-btn cm-btn-sm"
                    disabled={
                      selectedRound === 'all' ||
                      availableRounds.indexOf(selectedRound) <= 0
                    }
                    onClick={() => {
                      if (selectedRound === 'all') return;
                      const idx = availableRounds.indexOf(selectedRound);
                      if (idx > 0) setSelectedRound(availableRounds[idx - 1]);
                    }}
                    title="Previous Round"
                  >
                    <ChevronLeft size={12} />
                  </button>
                  <select
                    className="cm-select"
                    value={selectedRound}
                    onChange={(e) =>
                      setSelectedRound(
                        e.target.value === 'all' ? 'all' : Number(e.target.value)
                      )
                    }
                    style={{ fontSize: 11.5, padding: '3px 7px' }}
                  >
                    <option value="all">All Rounds ({availableRounds.length})</option>
                    {availableRounds.map((r) => (
                      <option key={r} value={r}>
                        Matchday {r}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="cm-btn cm-btn-sm"
                    disabled={
                      selectedRound === 'all' ||
                      availableRounds.indexOf(selectedRound) >= availableRounds.length - 1
                    }
                    onClick={() => {
                      if (selectedRound === 'all') return;
                      const idx = availableRounds.indexOf(selectedRound);
                      if (idx >= 0 && idx < availableRounds.length - 1) {
                        setSelectedRound(availableRounds[idx + 1]);
                      }
                    }}
                    title="Next Round"
                  >
                    <ChevronRight size={12} />
                  </button>
                </div>
              )}

              {/* Month Filter */}
              <select
                className="cm-select"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                style={{ fontSize: 11.5, padding: '3px 7px' }}
              >
                <option value="all">All Months</option>
                {availableMonths.map((mk) => (
                  <option key={mk} value={mk}>
                    {formatMonthLabel(mk)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Fixtures List Table */}
          <div className="cm-table-wrap" style={{ maxHeight: 'calc(100vh - 340px)', overflowY: 'auto' }}>
            <table className="cm-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th style={{ width: 42 }}>Rd</th>
                  <th style={{ textAlign: 'right' }}>Home</th>
                  <th style={{ textAlign: 'center', width: 78 }}>Score</th>
                  <th>Away</th>
                  <th>Venue / Scorers</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredFixtures.map((fix) => {
                  const home = clubs[fix.homeClubId];
                  const away = clubs[fix.awayClubId];
                  const involvesUser =
                    fix.homeClubId === userClubId || fix.awayClubId === userClubId;
                  const isTodayUserMatch =
                    !fix.played && fix.date === currentDate && involvesUser;

                  // Determine result color for user club
                  let scoreBg = 'rgba(13, 24, 44, 0.85)';
                  let scoreBorder = 'var(--cm-border)';
                  let scoreColor = '#ffffff';
                  if (fix.played && involvesUser) {
                    const userGoals =
                      fix.homeClubId === userClubId ? fix.homeGoals : fix.awayGoals;
                    const oppGoals =
                      fix.homeClubId === userClubId ? fix.awayGoals : fix.homeGoals;
                    if (userGoals > oppGoals) {
                      scoreBg = 'rgba(22, 163, 74, 0.35)';
                      scoreBorder = '#4ade80';
                      scoreColor = '#86efac';
                    } else if (userGoals < oppGoals) {
                      scoreBg = 'rgba(220, 38, 38, 0.35)';
                      scoreBorder = '#f87171';
                      scoreColor = '#fca5a5';
                    } else {
                      scoreBg = 'rgba(234, 179, 8, 0.25)';
                      scoreBorder = '#facc15';
                      scoreColor = '#fde047';
                    }
                  }

                  const goalSummary = fix.goals
                    .slice(0, 4)
                    .map((g) => `${g.scorerName.split(' ').slice(-1)[0]} ${g.minute}'`)
                    .join(', ');

                  return (
                    <tr
                      key={fix.id}
                      className={involvesUser ? 'is-user-row' : undefined}
                      onClick={() => {
                        if (fix.played) setReportFixtureId(fix.id);
                      }}
                      style={{ cursor: fix.played ? 'pointer' : 'default' }}
                    >
                      <td className="cm-num" style={{ color: fix.date === currentDate ? 'var(--cm-gold)' : 'var(--cm-text-muted)' }}>
                        {formatDateCM(fix.date)}{' '}
                        <span style={{ color: 'var(--cm-text-dim)', fontSize: 10.5 }}>
                          {fix.kickoffTime}
                        </span>
                      </td>
                      <td className="cm-num" style={{ color: 'var(--cm-text-dim)' }}>
                        R{fix.round}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {renderClubCell(fix.homeClubId, fix.homeClubId === userClubId)}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span
                          className="cm-num"
                          style={{
                            display: 'inline-block',
                            minWidth: 54,
                            padding: '2px 7px',
                            fontWeight: 800,
                            fontSize: 12.5,
                            background: scoreBg,
                            border: `1px solid ${scoreBorder}`,
                            color: fix.played ? scoreColor : 'var(--cm-text-dim)',
                          }}
                        >
                          {fix.played ? `${fix.homeGoals} - ${fix.awayGoals}` : 'vs'}
                        </span>
                      </td>
                      <td>
                        {renderClubCell(fix.awayClubId, fix.awayClubId === userClubId)}
                      </td>
                      <td
                        style={{
                          fontSize: 11.5,
                          color: 'var(--cm-text-muted)',
                          maxWidth: 260,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {fix.played ? (
                          <span>
                            {goalSummary || 'Goalless draw'}
                            {fix.goals.length > 4 ? ` +${fix.goals.length - 4}` : ''}
                            {fix.attendance ? (
                              <span className="cm-num" style={{ color: 'var(--cm-text-dim)', marginLeft: 8 }}>
                                ({fix.attendance.toLocaleString()})
                              </span>
                            ) : null}
                          </span>
                        ) : (
                          <span>
                            {home?.stadium.name ?? 'Stadium'}
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {isTodayUserMatch && onPlayFixture ? (
                          <button
                            type="button"
                            className="cm-btn cm-btn-sm cm-btn-gold"
                            onClick={(e) => {
                              e.stopPropagation();
                              onPlayFixture(fix.id);
                            }}
                          >
                            <Play size={11} fill="currentColor" />
                            <span>Play Match</span>
                          </button>
                        ) : fix.played ? (
                          <button
                            type="button"
                            className="cm-btn cm-btn-sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setReportFixtureId(fix.id);
                            }}
                          >
                            <FileText size={11} />
                            <span>Report</span>
                          </button>
                        ) : (
                          <span className="cm-num" style={{ fontSize: 10.5, color: 'var(--cm-text-dim)' }}>
                            {away ? 'Scheduled' : ''}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}

                {filteredFixtures.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: 24, color: 'var(--cm-text-muted)' }}>
                      No fixtures found for the selected round/month filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ==================== MATCH REPORT DRAWER / MODAL ==================== */}
      {reportFixture && (
        <div
          className="cm-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Match Report"
          onClick={() => setReportFixtureId(null)}
        >
          <div
            className="cm-modal"
            style={{ width: 'min(720px, 95vw)' }}
            onClick={(e) => e.stopPropagation()}
          >
            {(() => {
              const home = clubs[reportFixture.homeClubId];
              const away = clubs[reportFixture.awayClubId];
              const lg = leagues[reportFixture.leagueId];
              const motm = reportFixture.manOfTheMatchId
                ? players[reportFixture.manOfTheMatchId]
                : undefined;

              const timeline = [
                ...reportFixture.goals.map((g, i) => ({
                  key: `g-${i}`,
                  minute: g.minute,
                  side: g.clubId === reportFixture.homeClubId ? ('home' as const) : ('away' as const),
                  kind: 'goal' as const,
                  playerId: g.scorerId,
                  label: `${g.scorerName}${g.isPenalty ? ' (pen)' : ''}${g.isOwnGoal ? ' (OG)' : ''}${
                    g.assistName ? ` — ast: ${g.assistName}` : ''
                  }`,
                })),
                ...reportFixture.cards.map((c, i) => ({
                  key: `c-${i}`,
                  minute: c.minute,
                  side: c.clubId === reportFixture.homeClubId ? ('home' as const) : ('away' as const),
                  kind: c.card === 'red' ? ('red' as const) : ('yellow' as const),
                  playerId: c.playerId,
                  label: c.playerName,
                })),
              ].sort((a, b) => a.minute - b.minute);

              return (
                <>
                  <div className="cm-panel-header">
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                      <Flame size={14} color="#ffd84d" />
                      <span>
                        Match Report — {lg?.name ?? reportFixture.leagueId} (Round {reportFixture.round})
                      </span>
                    </span>
                    <button
                      type="button"
                      className="cm-btn cm-btn-sm"
                      onClick={() => setReportFixtureId(null)}
                    >
                      <X size={13} />
                    </button>
                  </div>

                  {/* Scoreboard Header */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr auto 1fr',
                      alignItems: 'center',
                      gap: 12,
                      padding: '14px 16px',
                      background:
                        'linear-gradient(180deg, rgba(20, 38, 66, 0.94) 0%, rgba(9, 17, 32, 0.96) 100%)',
                      borderBottom: '1px solid var(--cm-border)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10 }}>
                      <button
                        type="button"
                        className="cm-link"
                        onClick={() => {
                          setReportFixtureId(null);
                          if (home) onSelectClub(home.id);
                        }}
                        style={{ fontSize: 16, fontWeight: 800, color: '#fff', textAlign: 'right' }}
                      >
                        {home?.name ?? reportFixture.homeClubId}
                      </button>
                      {home && (
                        <span
                          className="cm-club-shield"
                          style={{
                            width: 32,
                            height: 32,
                            fontSize: 10.5,
                            backgroundColor: home.colors.primary,
                            color: home.colors.text,
                            borderColor: home.colors.secondary,
                          }}
                        >
                          {home.threeLetterCode}
                        </span>
                      )}
                    </div>

                    <div
                      className="cm-num"
                      style={{
                        padding: '6px 16px',
                        fontSize: 24,
                        fontWeight: 900,
                        background: 'rgba(6, 12, 24, 0.9)',
                        border: '2px solid var(--cm-gold)',
                        color: 'var(--cm-gold)',
                      }}
                    >
                      {reportFixture.homeGoals} - {reportFixture.awayGoals}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {away && (
                        <span
                          className="cm-club-shield"
                          style={{
                            width: 32,
                            height: 32,
                            fontSize: 10.5,
                            backgroundColor: away.colors.primary,
                            color: away.colors.text,
                            borderColor: away.colors.secondary,
                          }}
                        >
                          {away.threeLetterCode}
                        </span>
                      )}
                      <button
                        type="button"
                        className="cm-link"
                        onClick={() => {
                          setReportFixtureId(null);
                          if (away) onSelectClub(away.id);
                        }}
                        style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}
                      >
                        {away?.name ?? reportFixture.awayClubId}
                      </button>
                    </div>
                  </div>

                  {/* Venue, Attendance & MOTM Strip */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: 10,
                      padding: '7px 14px',
                      background: 'rgba(6, 12, 24, 0.85)',
                      borderBottom: '1px solid var(--cm-border-subtle)',
                      fontSize: 11.5,
                      color: 'var(--cm-text-muted)',
                    }}
                  >
                    <span>
                      {formatDateCM(reportFixture.date)} · {home?.stadium.name ?? 'Stadium'}
                      {reportFixture.attendance ? (
                        <>
                          {' '}
                          · <Users size={11} style={{ verticalAlign: 'middle' }} />{' '}
                          <span className="cm-num">{reportFixture.attendance.toLocaleString()}</span>
                        </>
                      ) : null}
                    </span>
                    {motm && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                        <Award size={13} color="#ffd84d" />
                        <span>Man of the Match:</span>
                        <button
                          type="button"
                          className="cm-link"
                          onClick={() => {
                            setReportFixtureId(null);
                            onSelectPlayer(motm.id);
                          }}
                          style={{ color: 'var(--cm-gold)' }}
                        >
                          {motm.name}
                        </button>
                        {reportFixture.manOfTheMatchRating && (
                          <span className="cm-num" style={{ color: '#4ade80', fontWeight: 700 }}>
                            ({reportFixture.manOfTheMatchRating.toFixed(1)})
                          </span>
                        )}
                      </span>
                    )}
                  </div>

                  {/* Body: Timeline & Match Stats */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns:
                        reportFixture.homeStats && reportFixture.awayStats
                          ? '1fr 1fr'
                          : '1fr',
                      gap: 14,
                      padding: 14,
                      overflowY: 'auto',
                    }}
                  >
                    {/* Key Events Timeline */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 800,
                          textTransform: 'uppercase',
                          color: 'var(--cm-gold)',
                          borderBottom: '1px solid var(--cm-border-subtle)',
                          paddingBottom: 3,
                        }}
                      >
                        Goals & Discipline Timeline
                      </div>
                      {timeline.length === 0 ? (
                        <div style={{ fontSize: 12, color: 'var(--cm-text-dim)', padding: '8px 0' }}>
                          No goals or cards recorded in this match.
                        </div>
                      ) : (
                        timeline.map((ev) => (
                          <div
                            key={ev.key}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8,
                              padding: '4px 7px',
                              background: 'rgba(13, 24, 44, 0.72)',
                              border: '1px solid var(--cm-border-subtle)',
                              fontSize: 12,
                            }}
                          >
                            <span
                              className="cm-num"
                              style={{
                                minWidth: 28,
                                fontWeight: 800,
                                color: 'var(--cm-gold)',
                              }}
                            >
                              {ev.minute}&apos;
                            </span>
                            <span
                              style={{
                                fontSize: 10,
                                fontWeight: 800,
                                padding: '1px 5px',
                                background:
                                  ev.kind === 'goal'
                                    ? 'rgba(34, 197, 94, 0.3)'
                                    : ev.kind === 'red'
                                      ? 'rgba(220, 38, 38, 0.35)'
                                      : 'rgba(234, 179, 8, 0.3)',
                                color:
                                  ev.kind === 'goal'
                                    ? '#86efac'
                                    : ev.kind === 'red'
                                      ? '#fca5a5'
                                      : '#fde047',
                              }}
                            >
                              {ev.kind === 'goal'
                                ? 'GOAL'
                                : ev.kind === 'red'
                                  ? 'RED'
                                  : 'YC'}
                            </span>
                            <span style={{ color: 'var(--cm-text-dim)', fontSize: 10.5 }}>
                              [{ev.side === 'home' ? home?.threeLetterCode : away?.threeLetterCode}]
                            </span>
                            <button
                              type="button"
                              className="cm-link"
                              onClick={() => {
                                if (players[ev.playerId]) {
                                  setReportFixtureId(null);
                                  onSelectPlayer(ev.playerId);
                                }
                              }}
                              style={{ fontWeight: ev.kind === 'goal' ? 700 : 500 }}
                            >
                              {ev.label}
                            </button>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Team Match Stats */}
                    {reportFixture.homeStats && reportFixture.awayStats && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <div
                          style={{
                            fontSize: 11,
                            fontWeight: 800,
                            textTransform: 'uppercase',
                            color: 'var(--cm-cyan)',
                            borderBottom: '1px solid var(--cm-border-subtle)',
                            paddingBottom: 3,
                          }}
                        >
                          Match Statistics
                        </div>
                        {renderStatBar(
                          'Possession',
                          reportFixture.homeStats.possession,
                          reportFixture.awayStats.possession,
                          '%'
                        )}
                        {renderStatBar(
                          'Shots',
                          reportFixture.homeStats.shots,
                          reportFixture.awayStats.shots
                        )}
                        {renderStatBar(
                          'Shots on Target',
                          reportFixture.homeStats.shotsOnTarget,
                          reportFixture.awayStats.shotsOnTarget
                        )}
                        {renderStatBar(
                          'Expected Goals (xG)',
                          Number(reportFixture.homeStats.xg.toFixed(2)),
                          Number(reportFixture.awayStats.xg.toFixed(2))
                        )}
                        {renderStatBar(
                          'Corners',
                          reportFixture.homeStats.corners,
                          reportFixture.awayStats.corners
                        )}
                        {renderStatBar(
                          'Fouls',
                          reportFixture.homeStats.fouls,
                          reportFixture.awayStats.fouls
                        )}
                        {renderStatBar(
                          'Tackles Won',
                          reportFixture.homeStats.tacklesWon,
                          reportFixture.awayStats.tacklesWon
                        )}
                        {renderStatBar(
                          'Pass Accuracy',
                          reportFixture.homeStats.passesAttempted > 0
                            ? Math.round(
                                (reportFixture.homeStats.passesCompleted /
                                  reportFixture.homeStats.passesAttempted) *
                                  100
                              )
                            : 0,
                          reportFixture.awayStats.passesAttempted > 0
                            ? Math.round(
                                (reportFixture.awayStats.passesCompleted /
                                  reportFixture.awayStats.passesAttempted) *
                                  100
                              )
                            : 0,
                          '%'
                        )}
                      </div>
                    )}
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
};

export default TableFixturesView;
