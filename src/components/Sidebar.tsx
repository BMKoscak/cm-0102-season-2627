import React from 'react';
import {
  Calendar,
  ClipboardList,
  DollarSign,
  Dumbbell,
  FolderOpen,
  Mail,
  Play,
  Radio,
  Save,
  Search,
  Trophy,
  Users,
} from 'lucide-react';
import type { SidebarProps } from '../types/contracts';
import type { GameScreen } from '../types/game';

interface NavEntry {
  screen: GameScreen;
  label: string;
  icon: React.ReactNode;
  badge?: number | string;
  badgeGold?: boolean;
}

function formatSidebarDate(isoDate: string): string {
  const parts = isoDate.split('-').map(Number);
  if (parts.length !== 3) return isoDate;
  const dt = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  return `${days[dt.getUTCDay()]} ${dt.getUTCDate()} ${months[dt.getUTCMonth()]} ${dt.getUTCFullYear()}`;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeScreen,
  userClub,
  managerName,
  currentDate,
  unreadNewsCount,
  hasActiveMatch,
  hasNextMatchToday,
  onNavigate,
  onContinue,
  onSaveGame,
  onOpenNewGame,
  lastSavedAt,
}) => {
  const clubNav: NavEntry[] = [
    { screen: 'squad', label: 'Squad', icon: <Users size={14} /> },
    { screen: 'tactics', label: 'Tactics', icon: <ClipboardList size={14} /> },
    { screen: 'training', label: 'Training', icon: <Dumbbell size={14} /> },
    { screen: 'finances', label: 'Finances', icon: <DollarSign size={14} /> },
  ];

  const compNav: NavEntry[] = [
    { screen: 'fixtures', label: 'Fixtures', icon: <Calendar size={14} /> },
    { screen: 'table', label: 'League Table', icon: <Trophy size={14} /> },
  ];

  const scoutingNav: NavEntry[] = [
    { screen: 'search', label: 'Player Search', icon: <Search size={14} /> },
    {
      screen: 'news',
      label: 'Manager News',
      icon: <Mail size={14} />,
      badge: unreadNewsCount > 0 ? unreadNewsCount : undefined,
    },
  ];

  const renderNavBtn = (item: NavEntry) => {
    const isActive =
      activeScreen === item.screen ||
      (item.screen === 'squad' && activeScreen === 'club');
    return (
      <button
        key={item.screen}
        type="button"
        className={`cm-nav-item ${isActive ? 'is-active' : ''}`}
        onClick={() => onNavigate(item.screen)}
      >
        <span className="cm-nav-item-left">
          {item.icon}
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {item.label}
          </span>
        </span>
        {item.badge !== undefined && (
          <span className={`cm-nav-badge ${item.badgeGold ? 'is-gold' : ''}`}>
            {item.badge}
          </span>
        )}
      </button>
    );
  };

  return (
    <aside className="cm-sidebar" aria-label="Main Navigation">
      {/* Primary Continue Action + Club Identity */}
      <div className="cm-sidebar-club">
        <button
          type="button"
          className={`cm-btn-continue ${hasNextMatchToday || hasActiveMatch ? 'is-matchday' : ''}`}
          onClick={onContinue}
          title="Advance calendar or enter match (Spacebar)"
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Play size={14} fill="currentColor" />
            {hasActiveMatch
              ? 'To Match'
              : hasNextMatchToday
                ? 'Match Day'
                : 'Continue'}
          </span>
          <span className="cm-kbd">SPACE</span>
        </button>

        <div
          style={{
            marginTop: 9,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 7px',
            background: 'rgba(11, 20, 38, 0.72)',
            border: '1px solid var(--cm-border)',
            borderLeft: `4px solid ${userClub.colors.primary}`,
          }}
        >
          <div
            className="cm-club-shield"
            style={{
              width: 30,
              height: 30,
              fontSize: 10.5,
              backgroundColor: userClub.colors.primary,
              color: userClub.colors.text,
              borderColor: userClub.colors.secondary,
            }}
          >
            {userClub.threeLetterCode}
          </div>
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontWeight: 700,
                fontSize: 12.5,
                color: '#ffffff',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {userClub.shortName}
            </div>
            <div
              style={{
                fontSize: 11,
                color: 'var(--cm-text-muted)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {managerName}
            </div>
          </div>
        </div>

        <div
          className="cm-num"
          style={{
            marginTop: 6,
            fontSize: 11,
            color: 'var(--cm-gold)',
            textAlign: 'center',
            letterSpacing: '0.02em',
          }}
        >
          {formatSidebarDate(currentDate)}
        </div>
      </div>

      {/* Navigation Sections */}
      <nav className="cm-sidebar-nav">
        {hasActiveMatch && (
          <>
            <div className="cm-nav-section-label">Match In Progress</div>
            <button
              type="button"
              className={`cm-nav-item ${activeScreen === 'match' ? 'is-active' : ''}`}
              onClick={() => onNavigate('match')}
              style={{ borderColor: '#ef4444' }}
            >
              <span className="cm-nav-item-left">
                <Radio size={14} color="#f87171" />
                <span>Live Match</span>
              </span>
              <span className="cm-live-dot" />
            </button>
          </>
        )}

        <div className="cm-nav-section-label">Club Management</div>
        {clubNav.map(renderNavBtn)}

        <div className="cm-nav-section-label">Competitions</div>
        {compNav.map(renderNavBtn)}

        <div className="cm-nav-section-label">Scouting &amp; Mail</div>
        {scoutingNav.map(renderNavBtn)}
      </nav>

      {/* Footer Save / Load / New Game */}
      <div className="cm-sidebar-footer">
        <button
          type="button"
          className="cm-btn cm-btn-sm"
          onClick={onSaveGame}
          style={{ width: '100%', justifyContent: 'space-between' }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Save size={13} />
            Save Career
          </span>
          {lastSavedAt && (
            <span className="cm-num" style={{ fontSize: 10, color: 'var(--cm-lime)' }}>
              {lastSavedAt}
            </span>
          )}
        </button>

        <button
          type="button"
          className="cm-btn cm-btn-sm"
          onClick={onOpenNewGame}
          style={{ width: '100%', justifyContent: 'flex-start' }}
        >
          <FolderOpen size={13} />
          New / Load Game
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
