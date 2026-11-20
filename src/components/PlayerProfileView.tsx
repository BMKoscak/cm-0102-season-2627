import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Award,
  Bookmark,
  Check,
  Cross,
  DollarSign,
  FileSignature,
  Globe,
  Handshake,
  Shield,
  Sparkles,
  Star,
  Tag,
  TrendingUp,
  User,
  X,
} from 'lucide-react';
import type { PlayerProfileViewProps } from '../types/contracts';
import type {
  BackgroundContext,
  GoalkeepingAttributes,
  MoraleLevel,
  Player,
  PositionCategory,
  PositionCode,
  ResolvedMedia,
  SquadStatus,
  TransferOffer,
} from '../types/game';
import {
  ATTRIBUTE_GROUPS,
  calculateOverallRating,
  calculatePositionRating,
  estimateWeeklyWage,
  getAttributeTier,
  getPositionCategory,
  isNaturalPosition,
} from '../engine/attributes';
import { formatCurrency, formatDateCM } from '../engine/seasonEngine';
import { resolveBackground } from '../services/backgroundService';

const SQUAD_STATUSES: SquadStatus[] = [
  'Indispensable',
  'Important First Team',
  'Squad Rotation',
  'Backup',
  'Hot Prospect',
  'Not Needed',
];

const POS_CLASS: Record<PositionCategory, string> = {
  GK: 'cm-pos-gk',
  DEF: 'cm-pos-def',
  MID: 'cm-pos-mid',
  FWD: 'cm-pos-fwd',
};

const MORALE_COLOR: Record<MoraleLevel, string> = {
  Superb: '#4ade80',
  'Very Good': '#86efac',
  Good: '#38e8d5',
  Okay: '#cbd5e1',
  Poor: '#fbbf24',
  'Very Poor': '#f87171',
};

const GK_ATTRS: Array<{ key: keyof GoalkeepingAttributes; label: string }> = [
  { key: 'handling', label: 'Handling' },
  { key: 'reflexes', label: 'Reflexes' },
  { key: 'oneOnOnes', label: 'One on Ones' },
  { key: 'positioning', label: 'Positioning' },
];

// Coordinates on vertical mini pitch (viewBox 0 0 140 190, attacking upward)
const PITCH_POSITIONS: Array<{ code: PositionCode; x: number; y: number }> = [
  { code: 'FL', x: 30, y: 34 },
  { code: 'FC', x: 70, y: 26 },
  { code: 'FR', x: 110, y: 34 },
  { code: 'AMC', x: 70, y: 60 },
  { code: 'ML', x: 24, y: 92 },
  { code: 'MC', x: 70, y: 92 },
  { code: 'MR', x: 116, y: 92 },
  { code: 'DMC', x: 70, y: 120 },
  { code: 'DL', x: 26, y: 146 },
  { code: 'DC', x: 70, y: 148 },
  { code: 'DR', x: 114, y: 146 },
  { code: 'GK', x: 70, y: 174 },
];

/** Authentic CM 01/02 1..20 attribute color styling:
 *  1-9 muted slate | 10-14 crisp white | 15-17 bright cyan | 18-20 glowing CM gold/yellow
 */
function getCmAttributeStyle(val: number): React.CSSProperties {
  if (val >= 18) {
    return {
      color: '#ffd84d',
      textShadow: '0 0 9px rgba(255, 216, 77, 0.55)',
      fontWeight: 800,
    };
  }
  if (val >= 15) {
    return {
      color: '#38e8d5',
      textShadow: '0 0 6px rgba(56, 232, 213, 0.35)',
      fontWeight: 700,
    };
  }
  if (val >= 10) {
    return {
      color: '#eef5ff',
      fontWeight: 600,
    };
  }
  return {
    color: '#7a8fa8',
    fontWeight: 500,
  };
}

function getConditionColor(cond: number): string {
  if (cond >= 88) return '#4ade80';
  if (cond >= 75) return '#a3e635';
  if (cond >= 62) return '#facc15';
  return '#f87171';
}

function getFootLabel(foot: Player['preferredFoot']): string {
  if (foot === 'both') return 'Either (Two-Footed)';
  if (foot === 'left') return 'Left';
  return 'Right';
}

export const PlayerProfileView: React.FC<PlayerProfileViewProps> = ({
  player,
  club,
  userClub,
  isUserPlayer,
  isShortlisted,
  pendingOffers,
  leagues,
  clubs,
  onBack,
  onSelectClub,
  onToggleShortlist,
  onToggleTransferList,
  onSubmitTransferOffer,
  onSubmitContractOffer,
  onAcceptCounterOffer,
}) => {
  const [portraitMedia, setPortraitMedia] = useState<ResolvedMedia | null>(null);
  const [portraitError, setPortraitError] = useState<boolean>(false);
  const [loadingPortrait, setLoadingPortrait] = useState<boolean>(false);

  // Inline negotiation modal state
  const [modalMode, setModalMode] = useState<'none' | 'transfer' | 'contract'>('none');
  const [linkedTransferOfferId, setLinkedTransferOfferId] = useState<string | undefined>(
    undefined
  );

  // Transfer bid form state
  const [offerFee, setOfferFee] = useState<number>(Math.max(0, player.value));
  const [installmentMonths, setInstallmentMonths] = useState<0 | 6 | 12 | 18 | 24>(0);
  const [installmentAmount, setInstallmentAmount] = useState<number>(0);
  const [sellOnPercent, setSellOnPercent] = useState<number>(0);

  // Contract form state
  const fairWage = useMemo(() => {
    const est = estimateWeeklyWage(player);
    return Math.max(1_000, Math.round(Math.max(player.wage, est) / 500) * 500);
  }, [player]);

  const [squadStatus, setSquadStatus] = useState<SquadStatus>(
    player.currentAbility >= 145
      ? 'Indispensable'
      : player.currentAbility >= 120
        ? 'Important First Team'
        : player.isWonderkid
          ? 'Hot Prospect'
          : 'Squad Rotation'
  );
  const [weeklyWage, setWeeklyWage] = useState<number>(fairWage);
  const [signingOnFee, setSigningOnFee] = useState<number>(
    Math.round(Math.max(25_000, fairWage * 6) / 5_000) * 5_000
  );
  const [contractYears, setContractYears] = useState<1 | 2 | 3 | 4 | 5>(
    player.age <= 24 ? 4 : player.age <= 30 ? 3 : 2
  );
  const [useReleaseClause, setUseReleaseClause] = useState<boolean>(false);
  const [releaseClause, setReleaseClause] = useState<number>(
    Math.max(1_000_000, Math.round((player.value * 2.2) / 500_000) * 500_000)
  );

  // Reset form defaults when switching to a different player
  useEffect(() => {
    setModalMode('none');
    setLinkedTransferOfferId(undefined);
    setOfferFee(Math.max(50_000, player.value));
    setInstallmentMonths(0);
    setInstallmentAmount(0);
    setSellOnPercent(0);
    setWeeklyWage(fairWage);
    setSigningOnFee(Math.round(Math.max(25_000, fairWage * 6) / 5_000) * 5_000);
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
  }, [player.id, player.value, player.age, player.currentAbility, player.isWonderkid, fairWage]);

  // Fetch live player portrait overlay via backgroundService
  useEffect(() => {
    let active = true;
    setPortraitError(false);
    setLoadingPortrait(true);
    setPortraitMedia(null);

    const ctx: BackgroundContext = {
      kind: 'player',
      slug: `player-${player.id}`,
      title: player.name,
      subtitle: club ? club.name : 'Free Agent',
      primaryQuery: player.wikiQuery || `${player.name} footballer`,
      fallbackQueries: [
        `${player.name} football player`,
        club ? `${club.name} footballer` : `${player.nationality} national football team`,
      ],
      accentColor: club?.colors.primary ?? '#1d4ed8',
      secondaryColor: club?.colors.secondary ?? '#ffffff',
      directImageUrl: player.imageUrl,
    };

    resolveBackground(ctx)
      .then((media) => {
        if (!active) return;
        setPortraitMedia(media);
        setLoadingPortrait(false);
      })
      .catch(() => {
        if (!active) return;
        setPortraitError(true);
        setLoadingPortrait(false);
      });

    return () => {
      active = false;
    };
  }, [player.id, player.name, player.wikiQuery, player.imageUrl, player.nationality, club]);

  const clubLeague = club ? leagues[club.leagueId] : undefined;
  const isFreeAgent = !club;
  const isGoalkeeper =
    player.positions.includes('GK') || Boolean(player.attributes.goalkeeping);
  const overallRating = useMemo(() => calculateOverallRating(player), [player]);

  const acceptedOfferForUser: TransferOffer | undefined = useMemo(
    () =>
      pendingOffers.find(
        (o) => o.fromClubId === userClub.id && o.status === 'accepted'
      ),
    [pendingOffers, userClub.id]
  );

  const counteredOfferForUser: TransferOffer | undefined = useMemo(
    () =>
      pendingOffers.find(
        (o) =>
          o.fromClubId === userClub.id &&
          o.status === 'countered' &&
          o.counterFee !== undefined
      ),
    [pendingOffers, userClub.id]
  );

  const openTransferModal = () => {
    setOfferFee(Math.max(50_000, Math.round((player.value * 1.05) / 50_000) * 50_000));
    setInstallmentMonths(0);
    setInstallmentAmount(0);
    setSellOnPercent(0);
    setModalMode('transfer');
  };

  const openContractModal = (transferOfferId?: string) => {
    setLinkedTransferOfferId(transferOfferId);
    setModalMode('contract');
  };

  const handleTransferSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!club) return;
    onSubmitTransferOffer({
      playerId: player.id,
      fromClubId: userClub.id,
      toClubId: club.id,
      fee: Math.max(0, Math.round(offerFee)),
      installments:
        installmentMonths !== 0 && installmentAmount > 0
          ? { amount: Math.round(installmentAmount), months: installmentMonths }
          : undefined,
      sellOnPercent,
    });
    setModalMode('none');
  };

  const handleContractSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmitContractOffer({
      playerId: player.id,
      clubId: userClub.id,
      transferOfferId: linkedTransferOfferId ?? acceptedOfferForUser?.id,
      squadStatus,
      weeklyWage: Math.max(500, Math.round(weeklyWage)),
      signingOnFee: Math.max(0, Math.round(signingOnFee)),
      years: contractYears,
      releaseClause: useReleaseClause && releaseClause > 0 ? Math.round(releaseClause) : undefined,
    });
    setModalMode('none');
  };

  const condColor = getConditionColor(player.condition);
  const hasPlayed =
    player.seasonStats.appearances + player.seasonStats.subAppearances > 0;
  const showPortraitImg =
    Boolean(portraitMedia?.url) && !portraitError && portraitMedia?.source !== 'fallback';

  const clubPrimary = club?.colors.primary ?? '#1e3a5f';
  const clubSecondary = club?.colors.secondary ?? '#38e8d5';
  const clubText = club?.colors.text ?? '#ffffff';

  const renderAttributeRow = (label: string, val: number, keyId: string, note?: string) => {
    const tier = getAttributeTier(val);
    const barPct = Math.max(5, Math.min(100, (val / 20) * 100));
    const barColor =
      val >= 18
        ? 'rgba(255, 216, 77, 0.32)'
        : val >= 15
          ? 'rgba(56, 232, 213, 0.24)'
          : val >= 10
            ? 'rgba(147, 197, 253, 0.14)'
            : 'rgba(122, 143, 168, 0.09)';

    return (
      <div
        key={keyId}
        title={note ? `${label}: ${val}/20 — ${note}` : `${label}: ${val}/20`}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          padding: '4px 8px',
          borderBottom: '1px solid rgba(124, 160, 208, 0.10)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: `${barPct}%`,
            background: `linear-gradient(90deg, ${barColor} 0%, transparent 100%)`,
            pointerEvents: 'none',
          }}
        />
        <span
          style={{
            position: 'relative',
            fontSize: 12,
            color: val >= 15 ? '#f1f5f9' : 'var(--cm-text-muted)',
            fontWeight: val >= 18 ? 700 : 500,
          }}
        >
          {label}
          {keyId === 'injuryProneness' && (
            <span style={{ fontSize: 10, color: 'var(--cm-text-dim)', marginLeft: 4 }}>
              (low=fit)
            </span>
          )}
        </span>
        <span
          className={`cm-attr-val cm-attr-${tier}`}
          style={{
            position: 'relative',
            fontSize: 13.5,
            ...getCmAttributeStyle(val),
          }}
        >
          {val}
        </span>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Top Action & Identity Header */}
      <div
        className="cm-panel"
        style={{
          borderLeft: `4px solid ${clubPrimary}`,
        }}
      >
        <div
          className="cm-panel-header"
          style={{
            background: `linear-gradient(90deg, ${clubPrimary}55 0%, rgba(18, 34, 58, 0.96) 55%, rgba(10, 18, 34, 0.96) 100%)`,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <button type="button" className="cm-btn cm-btn-sm" onClick={onBack}>
              <ArrowLeft size={13} />
              <span>Back</span>
            </button>

            {player.squadNumber !== undefined && (
              <span
                className="cm-num"
                style={{
                  padding: '2px 7px',
                  fontSize: 13,
                  fontWeight: 800,
                  background: clubPrimary,
                  color: clubText,
                  border: `1px solid ${clubSecondary}`,
                }}
              >
                #{player.squadNumber}
              </span>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 16, fontWeight: 800, color: '#ffffff', textTransform: 'none' }}>
                {player.name}
              </span>
              {player.positions.map((pos) => (
                <span
                  key={pos}
                  className={`cm-pos-pill ${POS_CLASS[getPositionCategory(pos)]}`}
                >
                  {pos}
                </span>
              ))}
              {player.isWonderkid && (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 3,
                    fontSize: 10.5,
                    fontWeight: 800,
                    padding: '1px 6px',
                    background: 'rgba(250, 204, 21, 0.22)',
                    border: '1px solid var(--cm-gold)',
                    color: 'var(--cm-gold)',
                  }}
                >
                  <Star size={11} fill="#ffd84d" />
                  WONDERKID
                </span>
              )}
              {isFreeAgent && (
                <span
                  style={{
                    fontSize: 10.5,
                    fontWeight: 700,
                    padding: '1px 6px',
                    background: 'rgba(34, 197, 94, 0.22)',
                    border: '1px solid #4ade80',
                    color: '#86efac',
                  }}
                >
                  FREE AGENT
                </span>
              )}
              {player.transferListed && (
                <span
                  style={{
                    fontSize: 10.5,
                    fontWeight: 700,
                    padding: '1px 6px',
                    background: 'rgba(245, 158, 11, 0.22)',
                    border: '1px solid #fbbf24',
                    color: '#fde047',
                  }}
                >
                  TRANSFER LISTED
                </span>
              )}
              {player.injury && (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 3,
                    fontSize: 10.5,
                    fontWeight: 700,
                    padding: '1px 6px',
                    background: 'rgba(220, 38, 38, 0.3)',
                    border: '1px solid #f87171',
                    color: '#fecaca',
                  }}
                >
                  <Cross size={10} />
                  {player.injury.type} ({player.injury.daysRemaining}d)
                </span>
              )}
              {player.suspendedMatches > 0 && (
                <span
                  style={{
                    fontSize: 10.5,
                    fontWeight: 700,
                    padding: '1px 6px',
                    background: 'rgba(234, 179, 8, 0.28)',
                    border: '1px solid #facc15',
                    color: '#fde047',
                  }}
                >
                  SUSPENDED ({player.suspendedMatches}m)
                </span>
              )}
            </div>
          </div>

          {/* Right Action Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="cm-btn cm-btn-sm"
              onClick={() => onToggleShortlist(player.id)}
              style={{
                borderColor: isShortlisted ? 'var(--cm-gold)' : undefined,
                color: isShortlisted ? 'var(--cm-gold)' : undefined,
              }}
            >
              <Bookmark size={12} fill={isShortlisted ? '#ffd84d' : 'none'} />
              <span>{isShortlisted ? 'Shortlisted' : 'Shortlist'}</span>
            </button>

            {isUserPlayer ? (
              <>
                <button
                  type="button"
                  className="cm-btn cm-btn-sm"
                  onClick={() => onToggleTransferList(player.id)}
                  style={{
                    borderColor: player.transferListed ? '#fbbf24' : undefined,
                    color: player.transferListed ? '#fde047' : undefined,
                  }}
                >
                  <Tag size={12} />
                  <span>{player.transferListed ? 'Remove from List' : 'Transfer List'}</span>
                </button>
                <button
                  type="button"
                  className="cm-btn cm-btn-sm cm-btn-primary"
                  onClick={() => openContractModal(undefined)}
                >
                  <FileSignature size={12} />
                  <span>Offer New Contract</span>
                </button>
              </>
            ) : isFreeAgent ? (
              <button
                type="button"
                className="cm-btn cm-btn-sm cm-btn-gold"
                onClick={() => openContractModal(undefined)}
              >
                <FileSignature size={12} />
                <span>Approach to Sign (Free)</span>
              </button>
            ) : acceptedOfferForUser ? (
              <button
                type="button"
                className="cm-btn cm-btn-sm cm-btn-gold"
                onClick={() => openContractModal(acceptedOfferForUser.id)}
              >
                <FileSignature size={12} />
                <span>Offer Contract (Fee Agreed!)</span>
              </button>
            ) : (
              <button
                type="button"
                className="cm-btn cm-btn-sm cm-btn-gold"
                onClick={openTransferModal}
              >
                <Handshake size={12} />
                <span>Make Transfer Offer</span>
              </button>
            )}
          </div>
        </div>

        {/* Hero Strip: Dynamic Portrait Overlay + Bio/Contract + Mini Pitch Heatmap */}
        <div
          className="cm-panel-body"
          style={{
            display: 'grid',
            gridTemplateColumns: '154px 1fr 148px',
            gap: 12,
            alignItems: 'stretch',
            background: 'rgba(6, 12, 24, 0.52)',
          }}
        >
          {/* Dynamic Player Portrait Overlay Card */}
          <div
            style={{
              position: 'relative',
              height: 192,
              border: `1px solid ${clubSecondary}66`,
              background: `linear-gradient(180deg, ${clubPrimary}38 0%, rgba(7, 13, 25, 0.94) 100%)`,
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: 'inset 0 0 18px rgba(0, 0, 0, 0.6)',
            }}
          >
            {showPortraitImg && portraitMedia ? (
              <img
                src={portraitMedia.url}
                alt={player.name}
                onError={() => setPortraitError(true)}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  objectPosition: 'center top',
                  display: 'block',
                }}
              />
            ) : (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  padding: 10,
                  textAlign: 'center',
                }}
              >
                <svg width="78" height="86" viewBox="0 0 80 88" fill="none">
                  <circle cx="40" cy="24" r="15" fill={clubPrimary} stroke={clubSecondary} strokeWidth="2" />
                  <path
                    d="M14 82 C14 58, 25 46, 40 46 C55 46, 66 58, 66 82 Z"
                    fill={clubPrimary}
                    stroke={clubSecondary}
                    strokeWidth="2"
                  />
                  <text
                    x="40"
                    y="72"
                    textAnchor="middle"
                    fill={clubText}
                    fontSize="16"
                    fontWeight="800"
                    fontFamily="monospace"
                  >
                    {player.squadNumber ?? player.positions[0]}
                  </text>
                </svg>
                <span style={{ fontSize: 10, color: 'var(--cm-text-muted)' }}>
                  {loadingPortrait ? 'Loading portrait...' : club?.threeLetterCode ?? 'FREE'}
                </span>
              </div>
            )}

            {/* Bottom glass caption over portrait */}
            <div
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: 0,
                padding: '4px 6px',
                background: 'linear-gradient(180deg, transparent 0%, rgba(4, 9, 18, 0.92) 45%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: 10,
              }}
            >
              <span className="cm-num" style={{ color: 'var(--cm-gold)', fontWeight: 700 }}>
                OVR {overallRating}
              </span>
              <span className="cm-num" style={{ color: 'var(--cm-text-dim)' }}>
                {portraitMedia ? portraitMedia.source : '...'}
              </span>
            </div>
          </div>

          {/* Center: Bio, Contract & Season Stats Grid */}
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 8, minWidth: 0 }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: 10,
              }}
            >
              {/* Personal Bio */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div
                  style={{
                    fontSize: 10.5,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    color: 'var(--cm-gold)',
                    borderBottom: '1px solid var(--cm-border-subtle)',
                    paddingBottom: 2,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                  }}
                >
                  <User size={11} />
                  <span>Personal Profile</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '88px 1fr', gap: '3px 6px', fontSize: 12 }}>
                  <span style={{ color: 'var(--cm-text-dim)' }}>Club:</span>
                  <span>
                    {club ? (
                      <button
                        type="button"
                        className="cm-link"
                        onClick={() => onSelectClub(club.id)}
                        style={{ color: '#ffffff' }}
                      >
                        {club.name}
                        {clubLeague ? ` (${clubLeague.shortName})` : ''}
                      </button>
                    ) : (
                      <span style={{ color: 'var(--cm-lime)', fontWeight: 700 }}>Free Agent</span>
                    )}
                  </span>
                  <span style={{ color: 'var(--cm-text-dim)' }}>Age / DOB:</span>
                  <span className="cm-num">
                    {player.age} ({formatDateCM(player.dateOfBirth)})
                  </span>
                  <span style={{ color: 'var(--cm-text-dim)' }}>Nationality:</span>
                  <span>
                    <Globe size={11} style={{ marginRight: 4, verticalAlign: 'middle', color: '#38e8d5' }} />
                    {player.nationality}{' '}
                    <span className="cm-num" style={{ color: 'var(--cm-text-dim)' }}>
                      ({player.nationalityCode})
                    </span>
                  </span>
                  <span style={{ color: 'var(--cm-text-dim)' }}>Height / Wt:</span>
                  <span className="cm-num">
                    {player.heightCm} cm · {player.weightKg} kg
                  </span>
                  <span style={{ color: 'var(--cm-text-dim)' }}>Foot:</span>
                  <span>{getFootLabel(player.preferredFoot)}</span>
                  <span style={{ color: 'var(--cm-text-dim)' }}>Int&apos;l Caps:</span>
                  <span className="cm-num">
                    {player.internationalCaps ?? 0} caps / {player.internationalGoals ?? 0} gls
                  </span>
                </div>
              </div>

              {/* Contract & Valuation */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div
                  style={{
                    fontSize: 10.5,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    color: 'var(--cm-gold)',
                    borderBottom: '1px solid var(--cm-border-subtle)',
                    paddingBottom: 2,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                  }}
                >
                  <DollarSign size={11} />
                  <span>Contract & Status</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '94px 1fr', gap: '3px 6px', fontSize: 12 }}>
                  <span style={{ color: 'var(--cm-text-dim)' }}>Est. Value:</span>
                  <span className="cm-num" style={{ color: 'var(--cm-lime)', fontWeight: 700 }}>
                    {formatCurrency(player.value)}
                  </span>
                  <span style={{ color: 'var(--cm-text-dim)' }}>Weekly Wage:</span>
                  <span className="cm-num" style={{ color: 'var(--cm-gold)' }}>
                    {isFreeAgent ? 'Unattached' : `${formatCurrency(player.wage)} / wk`}
                  </span>
                  <span style={{ color: 'var(--cm-text-dim)' }}>Expires:</span>
                  <span className="cm-num">
                    {player.contractExpires ? formatDateCM(player.contractExpires) : 'None'}
                  </span>
                  <span style={{ color: 'var(--cm-text-dim)' }}>Squad Status:</span>
                  <span>{player.squadStatus}</span>
                  <span style={{ color: 'var(--cm-text-dim)' }}>Release Clause:</span>
                  <span className="cm-num" style={{ color: player.releaseClause ? 'var(--cm-cyan)' : 'var(--cm-text-dim)' }}>
                    {player.releaseClause ? formatCurrency(player.releaseClause) : 'None'}
                  </span>
                  <span style={{ color: 'var(--cm-text-dim)' }}>Reputation:</span>
                  <span className="cm-num" style={{ color: 'var(--cm-cyan)' }}>
                    {Math.max(1, Math.min(20, Math.round(player.reputation / 500)))}/20
                  </span>
                </div>
              </div>
            </div>

            {/* Season Stats & Condition/Morale Bar */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 10,
                padding: '6px 10px',
                background: 'rgba(13, 24, 44, 0.85)',
                border: '1px solid var(--cm-border-subtle)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                <div>
                  <span style={{ fontSize: 10, color: 'var(--cm-text-dim)', display: 'block' }}>
                    APPS
                  </span>
                  <span className="cm-num" style={{ fontWeight: 700, color: '#fff' }}>
                    {player.seasonStats.appearances}
                    {player.seasonStats.subAppearances > 0
                      ? ` (${player.seasonStats.subAppearances})`
                      : ''}
                  </span>
                </div>
                <div>
                  <span style={{ fontSize: 10, color: 'var(--cm-text-dim)', display: 'block' }}>
                    GOALS
                  </span>
                  <span className="cm-num" style={{ fontWeight: 700, color: 'var(--cm-gold)' }}>
                    {player.seasonStats.goals}
                  </span>
                </div>
                <div>
                  <span style={{ fontSize: 10, color: 'var(--cm-text-dim)', display: 'block' }}>
                    ASSISTS
                  </span>
                  <span className="cm-num" style={{ fontWeight: 700, color: 'var(--cm-cyan)' }}>
                    {player.seasonStats.assists}
                  </span>
                </div>
                <div>
                  <span style={{ fontSize: 10, color: 'var(--cm-text-dim)', display: 'block' }}>
                    AVG RATING
                  </span>
                  <span
                    className="cm-num"
                    style={{
                      fontWeight: 800,
                      color: hasPlayed
                        ? player.seasonStats.averageRating >= 7.5
                          ? '#ffd84d'
                          : player.seasonStats.averageRating >= 7.0
                            ? '#38e8d5'
                            : '#fff'
                        : 'var(--cm-text-dim)',
                    }}
                  >
                    {hasPlayed ? player.seasonStats.averageRating.toFixed(2) : '—'}
                  </span>
                </div>
                <div>
                  <span style={{ fontSize: 10, color: 'var(--cm-text-dim)', display: 'block' }}>
                    MOTM / CARDS
                  </span>
                  <span className="cm-num" style={{ fontSize: 12 }}>
                    <span style={{ color: 'var(--cm-gold)' }}>{player.seasonStats.manOfTheMatch}★</span>{' '}
                    <span style={{ color: '#facc15' }}>{player.seasonStats.yellowCards}Y</span>{' '}
                    <span style={{ color: '#f87171' }}>{player.seasonStats.redCards}R</span>
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                <div>
                  <span style={{ fontSize: 10, color: 'var(--cm-text-dim)', display: 'block' }}>
                    CONDITION
                  </span>
                  <div className="cm-cond-bar">
                    <div className="cm-cond-track" style={{ width: 64 }}>
                      <div
                        className="cm-cond-fill"
                        style={{
                          width: `${Math.max(0, Math.min(100, player.condition))}%`,
                          backgroundColor: condColor,
                        }}
                      />
                    </div>
                    <span className="cm-num" style={{ fontWeight: 700, color: condColor }}>
                      {Math.round(player.condition)}%
                    </span>
                  </div>
                </div>
                <div>
                  <span style={{ fontSize: 10, color: 'var(--cm-text-dim)', display: 'block' }}>
                    MORALE
                  </span>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: MORALE_COLOR[player.morale] ?? '#cbd5e1',
                    }}
                  >
                    {player.morale}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Mini Positional Pitch Heatmap */}
          <div
            style={{
              background: 'rgba(6, 18, 12, 0.85)',
              border: '1px solid rgba(74, 222, 128, 0.35)',
              padding: 4,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div
              style={{
                fontSize: 9.5,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: '#86efac',
              }}
            >
              Position Map
            </div>
            <svg viewBox="0 0 140 190" style={{ width: '100%', height: 168 }}>
              {/* Pitch stripes & markings */}
              <rect x="4" y="4" width="132" height="182" fill="#0d3b1e" stroke="#4ade80" strokeOpacity="0.45" strokeWidth="1.2" />
              <rect x="4" y="34" width="132" height="30" fill="#104523" opacity="0.55" />
              <rect x="4" y="94" width="132" height="30" fill="#104523" opacity="0.55" />
              <rect x="4" y="154" width="132" height="32" fill="#104523" opacity="0.55" />
              <line x1="4" y1="95" x2="136" y2="95" stroke="#4ade80" strokeOpacity="0.35" strokeWidth="1" />
              <circle cx="70" cy="95" r="18" fill="none" stroke="#4ade80" strokeOpacity="0.35" strokeWidth="1" />
              <rect x="34" y="4" width="72" height="26" fill="none" stroke="#4ade80" strokeOpacity="0.35" strokeWidth="1" />
              <rect x="34" y="160" width="72" height="26" fill="none" stroke="#4ade80" strokeOpacity="0.35" strokeWidth="1" />

              {PITCH_POSITIONS.map(({ code, x, y }) => {
                const isPrimary = player.positions[0] === code;
                const isNat = isNaturalPosition(player, code);
                const rating = Math.round(calculatePositionRating(player, code));
                const isCompetent = !isNat && rating >= 62;
                const fill = isPrimary
                  ? '#4ade80'
                  : isNat
                    ? '#38e8d5'
                    : isCompetent
                      ? '#fde047'
                      : 'rgba(148, 163, 184, 0.25)';
                const radius = isPrimary ? 9 : isNat ? 7.5 : isCompetent ? 5.5 : 3.5;

                return (
                  <g key={code}>
                    <title>{`${code}: ${isPrimary ? 'Natural (Primary)' : isNat ? 'Natural' : isCompetent ? 'Accomplished' : 'Unsuited'} (${rating}/100)`}</title>
                    {isPrimary && (
                      <circle cx={x} cy={y} r="12" fill="none" stroke="#ffd84d" strokeWidth="1.5" opacity="0.9" />
                    )}
                    <circle
                      cx={x}
                      cy={y}
                      r={radius}
                      fill={fill}
                      stroke={isPrimary || isNat ? '#04120a' : 'none'}
                      strokeWidth="1"
                    />
                    {(isPrimary || isNat) && (
                      <text
                        x={x}
                        y={y + 3}
                        textAnchor="middle"
                        fontSize="7"
                        fontWeight="800"
                        fill="#04120a"
                        fontFamily="monospace"
                      >
                        {code}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>
        </div>
      </div>

      {/* Pending / Active Transfer Offers Banner for this Player */}
      {pendingOffers.length > 0 && (
        <div className="cm-panel" style={{ borderColor: 'rgba(255, 216, 77, 0.55)' }}>
          <div className="cm-panel-header">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Handshake size={13} />
              Active Transfer Offers ({pendingOffers.length})
            </span>
          </div>
          <div className="cm-panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {pendingOffers.map((offer) => {
              const buyer = clubs[offer.fromClubId];
              const seller = clubs[offer.toClubId];
              return (
                <div
                  key={offer.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 8,
                    padding: '6px 10px',
                    background: 'rgba(13, 24, 44, 0.85)',
                    border: '1px solid var(--cm-border)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <span
                      className="cm-num"
                      style={{
                        fontSize: 10.5,
                        fontWeight: 800,
                        textTransform: 'uppercase',
                        padding: '2px 6px',
                        background:
                          offer.status === 'accepted'
                            ? 'rgba(34, 197, 94, 0.25)'
                            : offer.status === 'countered'
                              ? 'rgba(250, 204, 21, 0.25)'
                              : offer.status === 'rejected'
                                ? 'rgba(239, 68, 68, 0.25)'
                                : 'rgba(56, 232, 213, 0.2)',
                        color:
                          offer.status === 'accepted'
                            ? '#86efac'
                            : offer.status === 'countered'
                              ? '#fde047'
                              : offer.status === 'rejected'
                                ? '#fca5a5'
                                : '#38e8d5',
                      }}
                    >
                      {offer.status}
                    </span>
                    <span style={{ fontSize: 12 }}>
                      <strong>{buyer?.shortName ?? offer.fromClubId}</strong> bid{' '}
                      <span className="cm-num" style={{ color: 'var(--cm-gold)', fontWeight: 700 }}>
                        {formatCurrency(offer.fee)}
                      </span>
                      {offer.installments && (
                        <span style={{ color: 'var(--cm-text-muted)' }}>
                          {' '}
                          + {formatCurrency(offer.installments.amount)}/{offer.installments.months}m
                        </span>
                      )}
                      {offer.sellOnPercent > 0 && (
                        <span style={{ color: 'var(--cm-text-muted)' }}>
                          {' '}
                          · {offer.sellOnPercent}% sell-on
                        </span>
                      )}
                      {seller && (
                        <span style={{ color: 'var(--cm-text-dim)' }}> to {seller.shortName}</span>
                      )}
                    </span>
                    {offer.notes && (
                      <span style={{ fontSize: 11.5, color: 'var(--cm-text-muted)', fontStyle: 'italic' }}>
                        &ldquo;{offer.notes}&rdquo;
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {offer.status === 'countered' &&
                      offer.counterFee !== undefined &&
                      offer.fromClubId === userClub.id && (
                        <button
                          type="button"
                          className="cm-btn cm-btn-sm cm-btn-gold"
                          onClick={() => onAcceptCounterOffer(offer.id)}
                        >
                          <Check size={12} />
                          <span>Accept Counter ({formatCurrency(offer.counterFee)})</span>
                        </button>
                      )}
                    {offer.status === 'accepted' &&
                      offer.fromClubId === userClub.id &&
                      !isUserPlayer && (
                        <button
                          type="button"
                          className="cm-btn cm-btn-sm cm-btn-primary"
                          onClick={() => openContractModal(offer.id)}
                        >
                          <FileSignature size={12} />
                          <span>Negotiate Contract</span>
                        </button>
                      )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ICONIC CM 01/02 3-COLUMN 1-20 ATTRIBUTE LAYOUT */}
      <div className="cm-panel">
        <div className="cm-panel-header">
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <TrendingUp size={13} />
            Player Attributes (1–20 Scale)
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 10.5, textTransform: 'none' }}>
            <span className="cm-num" style={{ color: '#7a8fa8' }}>1–9 Low</span>
            <span className="cm-num" style={{ color: '#eef5ff' }}>10–14 Avg</span>
            <span className="cm-num" style={{ color: '#38e8d5' }}>15–17 High</span>
            <span className="cm-num" style={{ color: '#ffd84d' }}>18–20 Elite</span>
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
            gap: 0,
            background: 'rgba(7, 13, 25, 0.72)',
          }}
        >
          {/* Column 1: Technical (12) */}
          <div style={{ borderRight: '1px solid var(--cm-border)' }}>
            <div
              style={{
                padding: '5px 8px',
                background: 'rgba(20, 36, 62, 0.85)',
                borderBottom: '1px solid var(--cm-border)',
                fontSize: 11,
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: 'var(--cm-cyan)',
              }}
            >
              Technical ({ATTRIBUTE_GROUPS.technical.length})
            </div>
            {ATTRIBUTE_GROUPS.technical.map((desc) =>
              renderAttributeRow(
                desc.label,
                player.attributes.technical[desc.key],
                desc.key
              )
            )}
          </div>

          {/* Column 2: Mental (10) */}
          <div style={{ borderRight: '1px solid var(--cm-border)' }}>
            <div
              style={{
                padding: '5px 8px',
                background: 'rgba(20, 36, 62, 0.85)',
                borderBottom: '1px solid var(--cm-border)',
                fontSize: 11,
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: 'var(--cm-gold)',
              }}
            >
              Mental ({ATTRIBUTE_GROUPS.mental.length})
            </div>
            {ATTRIBUTE_GROUPS.mental.map((desc) =>
              renderAttributeRow(
                desc.label,
                player.attributes.mental[desc.key],
                desc.key
              )
            )}
          </div>

          {/* Column 3: Physical (9) + Goalkeeping if GK */}
          <div>
            <div
              style={{
                padding: '5px 8px',
                background: 'rgba(20, 36, 62, 0.85)',
                borderBottom: '1px solid var(--cm-border)',
                fontSize: 11,
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: 'var(--cm-lime)',
              }}
            >
              Physical ({ATTRIBUTE_GROUPS.physical.length})
            </div>
            {ATTRIBUTE_GROUPS.physical.map((desc) =>
              renderAttributeRow(
                desc.label,
                player.attributes.physical[desc.key],
                desc.key,
                desc.key === 'injuryProneness'
                  ? 'Lower values mean fewer injuries'
                  : undefined
              )
            )}

            {isGoalkeeper && player.attributes.goalkeeping && (
              <>
                <div
                  style={{
                    padding: '5px 8px',
                    background: 'rgba(133, 77, 14, 0.45)',
                    borderTop: '1px solid rgba(253, 224, 71, 0.45)',
                    borderBottom: '1px solid rgba(253, 224, 71, 0.35)',
                    fontSize: 11,
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    color: '#fde047',
                  }}
                >
                  Goalkeeping (4)
                </div>
                {GK_ATTRS.map((desc) =>
                  renderAttributeRow(
                    desc.label,
                    player.attributes.goalkeeping![desc.key],
                    desc.key
                  )
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Career History Table */}
      {player.careerHistory && player.careerHistory.length > 0 && (
        <div className="cm-panel">
          <div className="cm-panel-header">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Award size={13} />
              Career History
            </span>
            {player.careerApps !== undefined && (
              <span className="cm-num" style={{ fontSize: 11, color: 'var(--cm-text-muted)' }}>
                Career Totals: {player.careerApps} Apps · {player.careerGoals ?? 0} Goals
              </span>
            )}
          </div>
          <div className="cm-table-wrap">
            <table className="cm-table">
              <thead>
                <tr>
                  <th>Season</th>
                  <th>Club</th>
                  <th style={{ textAlign: 'right' }}>Apps</th>
                  <th style={{ textAlign: 'right' }}>Goals</th>
                  <th style={{ textAlign: 'right' }}>Assists</th>
                  <th style={{ textAlign: 'right' }}>AvR</th>
                </tr>
              </thead>
              <tbody>
                {player.careerHistory.map((h, idx) => (
                  <tr key={`${h.season}-${h.clubName}-${idx}`}>
                    <td className="cm-num" style={{ color: 'var(--cm-gold)' }}>
                      {h.season}
                    </td>
                    <td style={{ fontWeight: 600 }}>{h.clubName}</td>
                    <td className="cm-num" style={{ textAlign: 'right' }}>
                      {h.apps}
                    </td>
                    <td className="cm-num" style={{ textAlign: 'right', color: 'var(--cm-gold)' }}>
                      {h.goals}
                    </td>
                    <td className="cm-num" style={{ textAlign: 'right', color: 'var(--cm-cyan)' }}>
                      {h.assists}
                    </td>
                    <td className="cm-num" style={{ textAlign: 'right', fontWeight: 700 }}>
                      {h.avgRating.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Classic Interactive Transfer Offer / Contract Negotiation Modal */}
      {modalMode !== 'none' && (
        <div
          className="cm-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label={modalMode === 'transfer' ? 'Make Transfer Offer' : 'Contract Negotiation'}
          onClick={() => setModalMode('none')}
        >
          <div
            className="cm-modal"
            style={{ width: 'min(580px, 95vw)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="cm-panel-header">
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                {modalMode === 'transfer' ? <Handshake size={14} /> : <FileSignature size={14} />}
                <span>
                  {modalMode === 'transfer'
                    ? `Make Transfer Offer — ${player.name}`
                    : isUserPlayer
                      ? `Offer New Contract — ${player.name}`
                      : `Contract Negotiation — ${player.name}`}
                </span>
              </span>
              <button
                type="button"
                className="cm-btn cm-btn-sm"
                onClick={() => setModalMode('none')}
              >
                <X size={13} />
              </button>
            </div>

            {modalMode === 'transfer' && club ? (
              <form
                onSubmit={handleTransferSubmit}
                style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}
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
                    Selling Club: <strong>{club.name}</strong>
                  </div>
                  <div className="cm-num">
                    Player Value:{' '}
                    <span style={{ color: 'var(--cm-lime)', fontWeight: 700 }}>
                      {formatCurrency(player.value)}
                    </span>
                  </div>
                  <div className="cm-num">
                    Your Budget:{' '}
                    <span style={{ color: 'var(--cm-gold)', fontWeight: 700 }}>
                      {formatCurrency(userClub.finances.transferBudget)}
                    </span>
                  </div>
                </div>

                {/* Upfront Transfer Fee */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--cm-text-muted)' }}>
                    Upfront Transfer Fee (EUR)
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
                    ].map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        className="cm-btn cm-btn-sm"
                        onClick={() =>
                          setOfferFee(
                            Math.round((player.value * preset.mult) / 50_000) * 50_000
                          )
                        }
                      >
                        {preset.label}
                      </button>
                    ))}
                    {player.releaseClause && (
                      <button
                        type="button"
                        className="cm-btn cm-btn-sm cm-btn-gold"
                        onClick={() => setOfferFee(player.releaseClause!)}
                      >
                        Clause ({formatCurrency(player.releaseClause)})
                      </button>
                    )}
                  </div>
                  {offerFee > userClub.finances.transferBudget && (
                    <span style={{ fontSize: 11.5, color: 'var(--cm-red)' }}>
                      Warning: Bid exceeds remaining transfer budget (
                      {formatCurrency(userClub.finances.transferBudget)}).
                    </span>
                  )}
                </div>

                {/* Installments */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 10,
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--cm-text-muted)' }}>
                      Monthly Installments
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
                            Math.max(100_000, Math.round((player.value * 0.25) / 50_000) * 50_000)
                          );
                        }
                      }}
                    >
                      <option value={0}>No Installments</option>
                      <option value={6}>Over 6 Months</option>
                      <option value={12}>Over 12 Months</option>
                      <option value={18}>Over 18 Months</option>
                      <option value={24}>Over 24 Months</option>
                    </select>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--cm-text-muted)' }}>
                      Installment Total (EUR)
                    </label>
                    <input
                      type="number"
                      className="cm-input cm-num"
                      min={0}
                      step={50_000}
                      disabled={installmentMonths === 0}
                      value={installmentAmount}
                      onChange={(e) =>
                        setInstallmentAmount(Math.max(0, Number(e.target.value) || 0))
                      }
                    />
                  </div>
                </div>

                {/* Sell-On Clause */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                    <label style={{ fontWeight: 700, color: 'var(--cm-text-muted)' }}>
                      Next Transfer Sell-On Clause
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

                {/* Package Summary */}
                <div
                  style={{
                    padding: '8px 10px',
                    background: 'rgba(6, 12, 24, 0.85)',
                    border: '1px solid var(--cm-border-subtle)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: 12,
                  }}
                >
                  <span style={{ color: 'var(--cm-text-muted)' }}>Total Transfer Package:</span>
                  <span className="cm-num" style={{ fontSize: 14, fontWeight: 800, color: 'var(--cm-gold)' }}>
                    {formatCurrency(offerFee + (installmentMonths > 0 ? installmentAmount : 0))}
                    {sellOnPercent > 0 ? ` + ${sellOnPercent}% sell-on` : ''}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                  <button
                    type="button"
                    className="cm-btn"
                    onClick={() => setModalMode('none')}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="cm-btn cm-btn-gold"
                    disabled={offerFee > userClub.finances.transferBudget}
                  >
                    <Handshake size={13} />
                    <span>Submit Official Bid</span>
                  </button>
                </div>
              </form>
            ) : (
              <form
                onSubmit={handleContractSubmit}
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
                    Current Wage:{' '}
                    <span className="cm-num" style={{ color: 'var(--cm-text)' }}>
                      {isFreeAgent ? 'Free Agent' : `${formatCurrency(player.wage)}/wk`}
                    </span>
                  </div>
                  <div className="cm-num">
                    Expected:{' '}
                    <span style={{ color: 'var(--cm-cyan)', fontWeight: 700 }}>
                      ~{formatCurrency(fairWage)}/wk
                    </span>
                  </div>
                  <div className="cm-num">
                    Wage Budget:{' '}
                    <span style={{ color: 'var(--cm-lime)', fontWeight: 700 }}>
                      {formatCurrency(
                        Math.max(
                          0,
                          userClub.finances.wageBudgetWeekly -
                            userClub.finances.currentWeeklyWages
                        )
                      )}
                      /wk free
                    </span>
                  </div>
                </div>

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
                      {SQUAD_STATUSES.map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--cm-text-muted)' }}>
                      Contract Length
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
                          {y} {y === 1 ? 'Year' : 'Years'} (until {2026 + y})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--cm-text-muted)' }}>
                      Weekly Wage (EUR / wk)
                    </label>
                    <input
                      type="number"
                      className="cm-input cm-num"
                      min={500}
                      step={500}
                      value={weeklyWage}
                      onChange={(e) => setWeeklyWage(Math.max(500, Number(e.target.value) || 0))}
                    />
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button
                        type="button"
                        className="cm-btn cm-btn-sm"
                        onClick={() => setWeeklyWage(fairWage)}
                      >
                        Fair
                      </button>
                      <button
                        type="button"
                        className="cm-btn cm-btn-sm"
                        onClick={() =>
                          setWeeklyWage(Math.round((fairWage * 1.15) / 500) * 500)
                        }
                      >
                        +15%
                      </button>
                      <button
                        type="button"
                        className="cm-btn cm-btn-sm"
                        onClick={() =>
                          setWeeklyWage(Math.round((fairWage * 1.3) / 500) * 500)
                        }
                      >
                        +30%
                      </button>
                    </div>
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

                {/* Release Clause */}
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
                  <label
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 7,
                      fontSize: 12,
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={useReleaseClause}
                      onChange={(e) => setUseReleaseClause(e.target.checked)}
                    />
                    <span>Minimum Fee Release Clause</span>
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
                  <button
                    type="button"
                    className="cm-btn"
                    onClick={() => setModalMode('none')}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="cm-btn cm-btn-gold">
                    <FileSignature size={13} />
                    <span>Offer Contract Terms</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Quick hint bar if countered offer exists */}
      {counteredOfferForUser && counteredOfferForUser.counterFee !== undefined && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '7px 12px',
            background: 'rgba(180, 120, 12, 0.25)',
            border: '1px solid var(--cm-gold)',
            fontSize: 12,
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Sparkles size={13} color="#ffd84d" />
            <span>
              Selling club countered at{' '}
              <strong className="cm-num" style={{ color: 'var(--cm-gold)' }}>
                {formatCurrency(counteredOfferForUser.counterFee)}
              </strong>
              .
            </span>
          </span>
          <button
            type="button"
            className="cm-btn cm-btn-sm cm-btn-gold"
            onClick={() => onAcceptCounterOffer(counteredOfferForUser.id)}
          >
            <Shield size={12} />
            <span>Match Counter-Offer</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default PlayerProfileView;
