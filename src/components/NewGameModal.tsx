import React, { useMemo, useState } from 'react';
import {
  Building2,
  CheckCircle2,
  Globe,
  Play,
  RotateCcw,
  Search,
  Shield,
  Trophy,
  User,
  X,
} from 'lucide-react';
import type { NewGameModalProps } from '../types/contracts';
import type { Club, League } from '../types/game';

const NATIONALITIES = [
  'Slovenia',
  'England',
  'Spain',
  'Italy',
  'Germany',
  'France',
  'Netherlands',
  'Portugal',
  'Scotland',
  'Belgium',
  'Croatia',
  'Austria',
  'Turkey',
  'Argentina',
  'Brazil',
  'Ireland',
  'Norway',
  'Sweden',
  'Serbia',
  'Bosnia & Herzegovina',
  'United States',
];

function formatCompactMoney(amount: number): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}€${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}€${Math.round(abs / 1_000)}K`;
  return `${sign}€${Math.round(abs)}`;
}

interface CountryGroup {
  country: string;
  countryCode: string;
  maxRep: number;
  leagues: League[];
}

export const NewGameModal: React.FC<NewGameModalProps> = ({
  isOpen,
  canClose,
  leagues,
  clubs,
  savedMeta,
  isLoadingSave,
  onStartNewGame,
  onResumeSavedGame,
  onClose,
}) => {
  const [managerName, setManagerName] = useState('Alex Ferguson');
  const [managerNationality, setManagerNationality] = useState('Slovenia');
  const [selectedLeagueId, setSelectedLeagueId] = useState<string>(
    () => leagues[0]?.id ?? 'premier-league'
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClubId, setSelectedClubId] = useState<string>(() => clubs[0]?.id ?? '');

  // Group leagues by Country -> sorted by highest league reputation (desc), then Tier 1 -> Tier 2
  const countryGroups = useMemo<CountryGroup[]>(() => {
    const map = new Map<string, CountryGroup>();
    for (const lg of leagues) {
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
  }, [leagues]);

  const leagueById = useMemo(() => {
    const rec: Record<string, League> = {};
    for (const lg of leagues) rec[lg.id] = lg;
    return rec;
  }, [leagues]);

  const clubCountByLeague = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const c of clubs) {
      counts[c.leagueId] = (counts[c.leagueId] ?? 0) + 1;
    }
    return counts;
  }, [clubs]);

  const trimmedQuery = searchQuery.trim().toLowerCase();

  const visibleClubs = useMemo<Club[]>(() => {
    let list: Club[];
    if (trimmedQuery.length >= 2) {
      // Global fast search across all ~300 clubs!
      list = clubs.filter((c) => {
        const lg = leagueById[c.leagueId];
        return (
          c.name.toLowerCase().includes(trimmedQuery) ||
          c.shortName.toLowerCase().includes(trimmedQuery) ||
          c.city.toLowerCase().includes(trimmedQuery) ||
          c.country.toLowerCase().includes(trimmedQuery) ||
          c.stadium.name.toLowerCase().includes(trimmedQuery) ||
          (lg && lg.name.toLowerCase().includes(trimmedQuery))
        );
      });
    } else if (selectedLeagueId === '__ALL__') {
      list = clubs;
    } else {
      list = clubs.filter((c) => c.leagueId === selectedLeagueId);
    }
    return [...list].sort((a, b) => b.reputation - a.reputation || a.name.localeCompare(b.name));
  }, [clubs, leagueById, selectedLeagueId, trimmedQuery]);

  const selectedClub = useMemo(
    () => clubs.find((c) => c.id === selectedClubId) ?? visibleClubs[0] ?? clubs[0] ?? null,
    [clubs, selectedClubId, visibleClubs]
  );

  const selectedClubLeague = selectedClub ? leagueById[selectedClub.leagueId] : null;

  if (!isOpen) return null;

  const handleSelectLeague = (leagueId: string) => {
    setSelectedLeagueId(leagueId);
    setSearchQuery('');
    const firstInLeague = clubs
      .filter((c) => leagueId === '__ALL__' || c.leagueId === leagueId)
      .sort((a, b) => b.reputation - a.reputation)[0];
    if (firstInLeague) {
      setSelectedClubId(firstInLeague.id);
    }
  };

  const handleStart = () => {
    if (!selectedClub) return;
    const finalName = managerName.trim() || 'Manager';
    onStartNewGame(selectedClub.id, finalName, managerNationality);
  };

  return (
    <div className="cm-modal-backdrop" role="dialog" aria-modal="true" aria-label="New Career Setup">
      <div className="cm-modal">
        {/* Title Bar */}
        <div
          className="cm-panel-header"
          style={{
            padding: '10px 14px',
            fontSize: 13.5,
            background:
              'linear-gradient(90deg, rgba(22, 42, 76, 0.98) 0%, rgba(12, 24, 46, 0.98) 100%)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Trophy size={17} color="#ffd84d" />
            <span>CHAMPIONSHIP MANAGER 01/02 — SEASON 2026/27</span>
            <span
              className="cm-num"
              style={{
                fontSize: 11,
                padding: '2px 7px',
                background: 'rgba(56, 232, 213, 0.14)',
                border: '1px solid rgba(56, 232, 213, 0.45)',
                color: 'var(--cm-cyan)',
              }}
            >
              {leagues.length} Leagues · {countryGroups.length} Nations · {clubs.length} Clubs
            </span>
          </div>
          {canClose && (
            <button type="button" className="cm-btn cm-btn-sm" onClick={onClose} title="Close">
              <X size={14} />
            </button>
          )}
        </div>

        {/* Resume Saved Career Banner (if IndexedDB save exists) */}
        {savedMeta && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              padding: '9px 14px',
              background:
                'linear-gradient(90deg, rgba(22, 101, 52, 0.42) 0%, rgba(12, 32, 54, 0.72) 100%)',
              borderBottom: '1px solid rgba(110, 231, 183, 0.45)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <RotateCcw size={16} color="#4ade80" />
              <div>
                <div style={{ fontWeight: 700, color: '#ecfdf5', fontSize: 12.5 }}>
                  Saved Career Found: {savedMeta.clubName} ({savedMeta.leagueName})
                </div>
                <div style={{ fontSize: 11.5, color: '#a7f3d0' }}>
                  Manager: {savedMeta.managerName} · In-Game Date: {savedMeta.currentDate} · Saved:{' '}
                  {new Date(savedMeta.savedAt).toLocaleString()}
                </div>
              </div>
            </div>
            <button
              type="button"
              className="cm-btn cm-btn-gold"
              disabled={isLoadingSave}
              onClick={onResumeSavedGame}
            >
              <Play size={13} fill="currentColor" />
              <span>{isLoadingSave ? 'Loading Save...' : 'Resume Saved Career'}</span>
            </button>
          </div>
        )}

        {/* Manager Profile Inputs */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12,
            padding: '9px 14px',
            background: 'rgba(13, 24, 44, 0.85)',
            borderBottom: '1px solid var(--cm-border)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <User size={14} color="#ffd84d" />
            <label htmlFor="cm-mgr-name" style={{ fontSize: 12, fontWeight: 600, color: 'var(--cm-text-muted)' }}>
              Manager Name:
            </label>
            <input
              id="cm-mgr-name"
              type="text"
              className="cm-input"
              value={managerName}
              onChange={(e) => setManagerName(e.target.value)}
              placeholder="Enter manager name"
              style={{ width: 200 }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <Globe size={14} color="#38e8d5" />
            <label htmlFor="cm-mgr-nat" style={{ fontSize: 12, fontWeight: 600, color: 'var(--cm-text-muted)' }}>
              Nationality:
            </label>
            <select
              id="cm-mgr-nat"
              className="cm-select"
              value={managerNationality}
              onChange={(e) => setManagerNationality(e.target.value)}
            >
              {NATIONALITIES.map((nat) => (
                <option key={nat} value={nat}>
                  {nat}
                </option>
              ))}
            </select>
          </div>

          <div style={{ flex: 1, minWidth: 210, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Search size={14} color="#9ab0cf" />
            <input
              type="text"
              className="cm-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Quick search any club, city, stadium or league..."
              style={{ width: '100%' }}
            />
          </div>
        </div>

        {/* Main 2-Column Selector: Country & Tier Pyramid | Club Table */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '236px minmax(0, 1fr)',
            flex: 1,
            minHeight: 340,
            maxHeight: '52vh',
            overflow: 'hidden',
          }}
        >
          {/* Left: Country & Tier Pyramid */}
          <div
            style={{
              borderRight: '1px solid var(--cm-border)',
              overflowY: 'auto',
              background: 'rgba(6, 12, 24, 0.72)',
              padding: '6px',
            }}
          >
            <button
              type="button"
              className={`cm-nav-item ${selectedLeagueId === '__ALL__' && !trimmedQuery ? 'is-active' : ''}`}
              onClick={() => handleSelectLeague('__ALL__')}
              style={{ marginBottom: 6 }}
            >
              <span className="cm-nav-item-left">
                <Globe size={13} />
                <span>All Playable Clubs</span>
              </span>
              <span className="cm-nav-badge is-gold">{clubs.length}</span>
            </button>

            {countryGroups.map((group) => (
              <div key={group.country} style={{ marginBottom: 7 }}>
                <div
                  style={{
                    fontSize: 10.5,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    color: 'var(--cm-text-muted)',
                    padding: '4px 6px 2px',
                    display: 'flex',
                    justifyContent: 'space-between',
                  }}
                >
                  <span>{group.country}</span>
                  <span className="cm-num" style={{ color: 'var(--cm-text-dim)' }}>
                    {group.countryCode}
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {group.leagues.map((lg) => {
                    const active = selectedLeagueId === lg.id && trimmedQuery.length < 2;
                    return (
                      <button
                        key={lg.id}
                        type="button"
                        className={`cm-nav-item ${active ? 'is-active' : ''}`}
                        onClick={() => handleSelectLeague(lg.id)}
                        style={{ padding: '5px 8px', fontSize: 12 }}
                      >
                        <span className="cm-nav-item-left" style={{ minWidth: 0 }}>
                          <span
                            className="cm-num"
                            style={{
                              fontSize: 9.5,
                              padding: '0 4px',
                              background:
                                lg.tier === 1
                                  ? 'rgba(255, 216, 77, 0.16)'
                                  : 'rgba(148, 163, 184, 0.16)',
                              color: lg.tier === 1 ? 'var(--cm-gold)' : 'var(--cm-text-muted)',
                              border: '1px solid rgba(255,255,255,0.14)',
                            }}
                          >
                            T{lg.tier}
                          </span>
                          <span
                            style={{
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {lg.shortName}
                          </span>
                        </span>
                        <span className="cm-num" style={{ fontSize: 10.5, color: 'var(--cm-text-dim)' }}>
                          {clubCountByLeague[lg.id] ?? lg.clubIds.length}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Right: Club List */}
          <div style={{ overflow: 'auto', minWidth: 0, background: 'rgba(8, 15, 28, 0.7)' }}>
            {trimmedQuery.length >= 2 && (
              <div
                style={{
                  padding: '5px 10px',
                  fontSize: 11.5,
                  color: 'var(--cm-cyan)',
                  background: 'rgba(14, 30, 56, 0.9)',
                  borderBottom: '1px solid var(--cm-border)',
                }}
              >
                Searching all {clubs.length} clubs for &ldquo;{searchQuery}&rdquo; — {visibleClubs.length}{' '}
                matches
              </div>
            )}
            <table className="cm-table" style={{ tableLayout: 'auto', width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ padding: '6px 6px' }}>Club</th>
                  <th style={{ padding: '6px 6px' }}>League</th>
                  <th style={{ padding: '6px 6px' }}>Stadium</th>
                  <th style={{ textAlign: 'right', padding: '6px 6px' }}>Rep</th>
                  <th style={{ textAlign: 'right', padding: '6px 6px' }}>Budget</th>
                  <th style={{ padding: '6px 6px' }}>Board Target</th>
                </tr>
              </thead>
              <tbody>
                {visibleClubs.map((club) => {
                  const isSel = selectedClub?.id === club.id;
                  const lg = leagueById[club.leagueId];
                  const leagueLabel = lg ? `${lg.shortName} (${lg.countryCode})` : club.leagueId;
                  return (
                    <tr
                      key={club.id}
                      className={isSel ? 'is-user-row' : undefined}
                      onClick={() => setSelectedClubId(club.id)}
                      onDoubleClick={handleStart}
                      style={{ cursor: 'pointer' }}
                    >
                      <td style={{ padding: '5px 6px', maxWidth: 190, overflow: 'hidden', textOverflow: 'ellipsis' }} title={club.name}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                          <span
                            className="cm-club-shield"
                            style={{
                              width: 21,
                              height: 21,
                              fontSize: 8.5,
                              backgroundColor: club.colors.primary,
                              color: club.colors.text,
                              borderColor: club.colors.secondary,
                            }}
                          >
                            {club.threeLetterCode}
                          </span>
                          <span
                            style={{
                              fontWeight: isSel ? 700 : 600,
                              color: isSel ? '#ffd84d' : '#fff',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {club.name}
                          </span>
                        </div>
                      </td>
                      <td
                        style={{
                          padding: '5px 6px',
                          color: 'var(--cm-text-muted)',
                          fontSize: 11.5,
                          maxWidth: 140,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                        title={leagueLabel}
                      >
                        {leagueLabel}
                      </td>
                      <td
                        style={{
                          padding: '5px 6px',
                          color: 'var(--cm-text-muted)',
                          fontSize: 11.5,
                          maxWidth: 195,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                        title={`${club.stadium.name} (${club.stadium.capacity.toLocaleString()})`}
                      >
                        {club.stadium.name}{' '}
                        <span className="cm-num" style={{ color: 'var(--cm-text-dim)' }}>
                          ({club.stadium.capacity.toLocaleString()})
                        </span>
                      </td>
                      <td className="cm-num" style={{ padding: '5px 6px', textAlign: 'right', color: 'var(--cm-cyan)' }}>
                        {Math.round(club.reputation / 500)}/20
                      </td>
                      <td className="cm-num" style={{ padding: '5px 6px', textAlign: 'right', color: 'var(--cm-lime)' }}>
                        {formatCompactMoney(club.finances.transferBudget)}
                      </td>
                      <td
                        style={{
                          padding: '5px 6px',
                          fontSize: 11.5,
                          color: 'var(--cm-text-muted)',
                          maxWidth: 175,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                        title={club.boardExpectation}
                      >
                        {club.boardExpectation}
                      </td>
                    </tr>
                  );
                })}
                {visibleClubs.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: 24, color: 'var(--cm-text-muted)' }}>
                      No clubs matched &ldquo;{searchQuery}&rdquo;. Try another city, club, or country name.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer: Selected Club Preview & Take Charge Button */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 14,
            padding: '10px 14px',
            background: 'rgba(13, 24, 44, 0.96)',
            borderTop: '1px solid var(--cm-border-bright)',
          }}
        >
          {selectedClub ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
              <div
                className="cm-club-shield"
                style={{
                  width: 40,
                  height: 40,
                  fontSize: 12.5,
                  backgroundColor: selectedClub.colors.primary,
                  color: selectedClub.colors.text,
                  borderColor: selectedClub.colors.secondary,
                }}
              >
                {selectedClub.threeLetterCode}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontWeight: 700, fontSize: 14, color: '#ffffff' }}>
                    {selectedClub.name}
                  </span>
                  {selectedClubLeague && (
                    <span style={{ fontSize: 11.5, color: 'var(--cm-gold)' }}>
                      {selectedClubLeague.name} · Tier {selectedClubLeague.tier}
                    </span>
                  )}
                </div>
                <div
                  style={{
                    fontSize: 11.5,
                    color: 'var(--cm-text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    flexWrap: 'wrap',
                  }}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <Building2 size={12} /> {selectedClub.stadium.name} (
                    {selectedClub.stadium.capacity.toLocaleString()})
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <Shield size={12} /> Target: {selectedClub.boardExpectation}
                  </span>
                  <span className="cm-num" style={{ color: 'var(--cm-lime)' }}>
                    Budget: {formatCompactMoney(selectedClub.finances.transferBudget)} · Balance:{' '}
                    {formatCompactMoney(selectedClub.finances.balance)}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ color: 'var(--cm-text-muted)' }}>Select a club to begin</div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            {canClose && (
              <button type="button" className="cm-btn" onClick={onClose}>
                Cancel
              </button>
            )}
            <button
              type="button"
              className="cm-btn cm-btn-gold"
              disabled={!selectedClub}
              onClick={handleStart}
              style={{ padding: '8px 16px', fontSize: 13 }}
            >
              <CheckCircle2 size={15} />
              <span>Take Charge of {selectedClub?.shortName ?? 'Club'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NewGameModal;
