import React from 'react';
import {
  CalendarClock,
  Monitor,
  Play,
  Radio,
  Sparkles,
  Volume2,
  VolumeX,
  Waves,
} from 'lucide-react';
import type { TopBarProps } from '../types/contracts';

function formatShortDate(isoDate: string): string {
  const parts = isoDate.split('-').map(Number);
  if (parts.length !== 3) return isoDate;
  const dt = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  return `${days[dt.getUTCDay()]} ${dt.getUTCDate()} ${months[dt.getUTCMonth()]}`;
}

export const TopBar: React.FC<TopBarProps> = ({
  userClub,
  league,
  managerName,
  currentDate,
  nextFixture,
  clubs,
  audioSettings,
  mediaInfo,
  hasActiveMatch,
  onContinue,
  onUpdateAudioSettings,
  onSelectClub,
  onOpenMatch,
}) => {
  const isHome = nextFixture ? nextFixture.homeClubId === userClub.id : false;
  const opponentId = nextFixture
    ? isHome
      ? nextFixture.awayClubId
      : nextFixture.homeClubId
    : null;
  const opponent = opponentId ? clubs[opponentId] : null;
  const isMatchToday = Boolean(nextFixture && nextFixture.date === currentDate);

  return (
    <header className="cm-topbar">
      {/* Left: Brand & Club Header */}
      <div className="cm-topbar-left">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            paddingRight: 10,
            borderRight: '1px solid var(--cm-border)',
            minWidth: 0,
            overflow: 'hidden',
          }}
        >
          <div
            className="cm-club-shield"
            style={{
              width: 32,
              height: 32,
              fontSize: 11,
              backgroundColor: userClub.colors.primary,
              color: userClub.colors.text,
              borderColor: userClub.colors.secondary,
              cursor: 'pointer',
            }}
            onClick={() => onSelectClub(userClub.id)}
            title={`View ${userClub.name}`}
          >
            {userClub.threeLetterCode}
          </div>
          <div style={{ minWidth: 0, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
              <button
                type="button"
                className="cm-link"
                onClick={() => onSelectClub(userClub.id)}
                title={userClub.name}
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: '#ffffff',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  minWidth: 0,
                }}
              >
                {userClub.name}
              </button>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  padding: '1px 5px',
                  background: 'rgba(255, 216, 77, 0.16)',
                  border: '1px solid rgba(255, 216, 77, 0.45)',
                  color: 'var(--cm-gold)',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                {league.shortName}
              </span>
            </div>
            <div className="cm-topbar-subtitle">
              <span>CM 01/02 · 2026/27</span>
              <span style={{ opacity: 0.4 }}>|</span>
              <span>Mgr: {managerName}</span>
              <span style={{ opacity: 0.4 }}>|</span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {userClub.stadium.name}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Center: Next Fixture Preview / Active Match Indicator */}
      <div
        className="cm-topbar-center"
        style={{
          background: hasActiveMatch
            ? 'rgba(153, 27, 27, 0.42)'
            : isMatchToday
              ? 'rgba(180, 120, 12, 0.34)'
              : 'rgba(6, 12, 24, 0.58)',
          border: `1px solid ${
            hasActiveMatch
              ? '#f87171'
              : isMatchToday
                ? 'var(--cm-gold)'
                : 'var(--cm-border)'
          }`,
        }}
      >
        {hasActiveMatch ? (
          <button
            type="button"
            className="cm-link"
            onClick={onOpenMatch}
            title="LIVE MATCH IN PROGRESS — Return to Touchline"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              color: '#fecaca',
              fontSize: 12,
              whiteSpace: 'nowrap',
              flexShrink: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            <span className="cm-live-dot" style={{ flexShrink: 0 }} />
            <Radio size={13} style={{ flexShrink: 0 }} />
            <span>
              LIVE MATCH<span className="cm-topbar-live-extra"> IN PROGRESS — Return to Touchline</span>
            </span>
          </button>
        ) : nextFixture && opponent ? (
          <>
            <CalendarClock
              size={14}
              color={isMatchToday ? '#ffd84d' : '#9ab0cf'}
              style={{ flexShrink: 0 }}
            />
            <span
              className="cm-num"
              style={{
                fontSize: 11.5,
                color: isMatchToday ? 'var(--cm-gold)' : 'var(--cm-text-muted)',
                fontWeight: 700,
                whiteSpace: 'nowrap',
              }}
            >
              {isMatchToday ? 'TODAY' : formatShortDate(nextFixture.date)} · {nextFixture.kickoffTime}
            </span>
            <span style={{ color: 'var(--cm-text-dim)' }}>|</span>
            <span style={{ fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              <span
                style={{
                  fontWeight: 700,
                  color: isHome ? 'var(--cm-lime)' : 'var(--cm-cyan)',
                  marginRight: 5,
                }}
              >
                {isHome ? '(H)' : '(A)'}
              </span>
              vs{' '}
              <button
                type="button"
                className="cm-link"
                onClick={() => onSelectClub(opponent.id)}
                style={{ color: '#ffffff' }}
              >
                {opponent.shortName}
              </button>
            </span>
          </>
        ) : (
          <span style={{ fontSize: 11.5, color: 'var(--cm-text-muted)', whiteSpace: 'nowrap' }}>
            Season Schedule Complete
          </span>
        )}
      </div>

      {/* Right: Media Cache Badge, Audio & CRT Quick Toggles, Continue */}
      <div className="cm-topbar-right">
        {mediaInfo && (
          <span
            className="cm-num cm-topbar-bg-pill"
            title={`Dynamic background source: ${mediaInfo.source} (${mediaInfo.latencyMs}ms)${
              mediaInfo.attribution ? ` — ${mediaInfo.attribution}` : ''
            }`}
            style={{
              fontSize: 10,
              padding: '2px 6px',
              background: 'rgba(6, 12, 24, 0.65)',
              border: '1px solid var(--cm-border-subtle)',
              color:
                mediaInfo.source === 'indexeddb' || mediaInfo.source === 'disk-cache'
                  ? 'var(--cm-lime)'
                  : 'var(--cm-text-muted)',
              whiteSpace: 'nowrap',
            }}
          >
            BG {mediaInfo.source} {Math.round(mediaInfo.latencyMs)}ms
          </span>
        )}

        <button
          type="button"
          className="cm-btn cm-btn-sm"
          onClick={() => onUpdateAudioSettings({ voiceEnabled: !audioSettings.voiceEnabled })}
          title={audioSettings.voiceEnabled ? 'Mute Voice Commentary' : 'Enable Voice Commentary'}
          style={{
            borderColor: audioSettings.voiceEnabled ? 'var(--cm-cyan)' : undefined,
            color: audioSettings.voiceEnabled ? 'var(--cm-cyan)' : 'var(--cm-text-dim)',
          }}
        >
          {audioSettings.voiceEnabled ? <Volume2 size={13} /> : <VolumeX size={13} />}
          <span className="cm-topbar-btn-label">Voice</span>
        </button>

        <button
          type="button"
          className="cm-btn cm-btn-sm"
          onClick={() => onUpdateAudioSettings({ crowdEnabled: !audioSettings.crowdEnabled })}
          title={audioSettings.crowdEnabled ? 'Mute Stadium Crowd' : 'Enable Stadium Crowd'}
          style={{
            borderColor: audioSettings.crowdEnabled ? 'var(--cm-lime)' : undefined,
            color: audioSettings.crowdEnabled ? 'var(--cm-lime)' : 'var(--cm-text-dim)',
          }}
        >
          <Waves size={13} />
          <span className="cm-topbar-btn-label">Crowd</span>
        </button>

        <button
          type="button"
          className="cm-btn cm-btn-sm"
          onClick={() => onUpdateAudioSettings({ scanlines: !audioSettings.scanlines })}
          title="Toggle Retro CRT Scanlines"
          style={{
            borderColor: audioSettings.scanlines ? 'var(--cm-gold)' : undefined,
            color: audioSettings.scanlines ? 'var(--cm-gold)' : 'var(--cm-text-dim)',
          }}
        >
          <Monitor size={13} />
        </button>

        <button
          type="button"
          className="cm-btn cm-btn-sm"
          onClick={() => onUpdateAudioSettings({ vignette: !audioSettings.vignette })}
          title="Toggle Vignette Overlay"
          style={{
            borderColor: audioSettings.vignette ? 'var(--cm-gold)' : undefined,
            color: audioSettings.vignette ? 'var(--cm-gold)' : 'var(--cm-text-dim)',
          }}
        >
          <Sparkles size={13} />
        </button>

        <button
          type="button"
          className={`cm-btn cm-btn-sm ${isMatchToday || hasActiveMatch ? 'cm-btn-gold' : 'cm-btn-primary'}`}
          onClick={onContinue}
          title="Continue (Spacebar)"
        >
          <Play size={12} fill="currentColor" />
          <span>{hasActiveMatch ? 'Match' : isMatchToday ? 'Kick Off' : 'Continue'}</span>
        </button>
      </div>
    </header>
  );
};

export default TopBar;
