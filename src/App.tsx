import React, { useEffect, useMemo } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { GameStoreProvider, useGameStore } from './state/gameStore';
import { BackgroundLayer } from './components/BackgroundLayer';
import { TopBar } from './components/TopBar';
import { Sidebar } from './components/Sidebar';
import { NewGameModal } from './components/NewGameModal';
import { SquadView } from './components/SquadView';
import { PlayerProfileView } from './components/PlayerProfileView';
import { TableFixturesView } from './components/TableFixturesView';
import { SearchTransfersView } from './components/SearchTransfersView';
import { NewsFinancesTrainingView } from './components/NewsFinancesTrainingView';
import { TacticsView } from './components/TacticsView';
import { MatchDayView } from './components/MatchDayView';

const GameShell: React.FC = () => {
  const store = useGameStore();
  const {
    state,
    activeScreen,
    selectedClubId,
    selectedPlayerId,
    selectedLeagueId,
    isNewGameOpen,
    savedMeta,
    isLoadingSave,
    lastSavedAt,
    toastMessage,
    mediaInfo,
    backgroundContext,
    userClub,
    userLeague,
    userSquad,
    nextUserFixture,
    hasNextMatchToday,
    unreadNewsCount,
  } = store;

  // Classic CM 01/02 Spacebar Continue shortcut (disabled while typing or inside live match)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space' && e.key !== ' ') return;
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      if (isNewGameOpen || activeScreen === 'match') return;
      if (document.querySelector('[role="dialog"]')) return;

      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (
          tag === 'INPUT' ||
          tag === 'TEXTAREA' ||
          tag === 'SELECT' ||
          tag === 'BUTTON' ||
          target.isContentEditable
        ) {
          return;
        }
      }

      e.preventDefault();
      store.continueGame();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeScreen, isNewGameOpen, store]);

  const allLeaguesList = useMemo(() => Object.values(state.leagues), [state.leagues]);
  const allClubsList = useMemo(() => Object.values(state.clubs), [state.clubs]);

  const viewedClub = state.clubs[selectedClubId] ?? userClub;
  const viewedSquad = useMemo(
    () =>
      viewedClub.id === userClub.id
        ? userSquad
        : Object.values(state.players).filter((p) => p.clubId === viewedClub.id),
    [state.players, userClub.id, userSquad, viewedClub.id]
  );

  const selectedPlayer = selectedPlayerId ? state.players[selectedPlayerId] ?? null : null;

  const renderMainScreen = () => {
    if (activeScreen === 'match' && state.activeMatch) {
      const homeClub = state.clubs[state.activeMatch.homeClubId] ?? userClub;
      const awayClub = state.clubs[state.activeMatch.awayClubId] ?? userClub;
      const matchLeague = state.leagues[state.activeMatch.leagueId] ?? userLeague;
      return (
        <MatchDayView
          session={state.activeMatch}
          homeClub={homeClub}
          awayClub={awayClub}
          players={state.players}
          league={matchLeague}
          audioSettings={state.audioSettings}
          onUpdateSession={store.updateActiveMatch}
          onUpdateAudioSettings={store.updateAudioSettings}
          onFinishMatch={store.finishActiveMatch}
          onSelectPlayer={store.selectPlayer}
        />
      );
    }

    if (activeScreen === 'player' && selectedPlayer) {
      const pClub = selectedPlayer.clubId ? state.clubs[selectedPlayer.clubId] ?? null : null;
      const pendingForPlayer = state.transferOffers.filter(
        (o) => o.playerId === selectedPlayer.id && o.status !== 'withdrawn'
      );
      return (
        <PlayerProfileView
          player={selectedPlayer}
          club={pClub}
          userClub={userClub}
          isUserPlayer={selectedPlayer.clubId === userClub.id}
          isShortlisted={state.shortlist.includes(selectedPlayer.id)}
          pendingOffers={pendingForPlayer}
          leagues={state.leagues}
          clubs={state.clubs}
          onBack={store.goBackFromPlayer}
          onSelectClub={store.selectClub}
          onToggleShortlist={store.toggleShortlist}
          onToggleTransferList={store.toggleTransferList}
          onSubmitTransferOffer={store.submitTransferOffer}
          onSubmitContractOffer={store.submitContractOffer}
          onAcceptCounterOffer={store.acceptCounterOffer}
        />
      );
    }

    if (activeScreen === 'tactics') {
      return (
        <TacticsView
          club={userClub}
          squad={userSquad}
          tactics={userClub.tactics}
          isLiveMatch={false}
          onUpdateTactics={store.updateUserTactics}
          onAutoPick={store.autoPickUserLineup}
          onSelectPlayer={store.selectPlayer}
        />
      );
    }

    if (activeScreen === 'table' || activeScreen === 'fixtures') {
      return (
        <TableFixturesView
          mode={activeScreen}
          activeLeagueId={selectedLeagueId}
          userClubId={userClub.id}
          currentDate={state.currentDate}
          leagues={state.leagues}
          clubs={state.clubs}
          players={state.players}
          fixtures={state.fixtures}
          standings={state.standings}
          onSelectLeague={store.selectLeague}
          onSelectClub={store.selectClub}
          onSelectPlayer={store.selectPlayer}
          onSwitchMode={(m: 'table' | 'fixtures') => store.navigate(m)}
          onPlayFixture={store.playFixture}
        />
      );
    }

    if (activeScreen === 'search') {
      return (
        <SearchTransfersView
          userClub={userClub}
          leagues={state.leagues}
          clubs={state.clubs}
          players={state.players}
          shortlist={state.shortlist}
          transferOffers={state.transferOffers}
          contractOffers={state.contractOffers}
          onSelectPlayer={store.selectPlayer}
          onSelectClub={store.selectClub}
          onToggleShortlist={store.toggleShortlist}
          onSubmitTransferOffer={store.submitTransferOffer}
          onAcceptCounterOffer={store.acceptCounterOffer}
          onWithdrawTransferOffer={store.withdrawTransferOffer}
          onSubmitContractOffer={store.submitContractOffer}
        />
      );
    }

    if (activeScreen === 'news' || activeScreen === 'finances' || activeScreen === 'training') {
      return (
        <NewsFinancesTrainingView
          mode={activeScreen}
          userClub={userClub}
          squad={userSquad}
          news={state.news}
          clubs={state.clubs}
          players={state.players}
          currentDate={state.currentDate}
          onSwitchMode={(m: 'news' | 'finances' | 'training') => store.navigate(m)}
          onMarkNewsRead={store.markNewsRead}
          onMarkAllNewsRead={store.markAllNewsRead}
          onUpdateTraining={store.updateUserTraining}
          onSelectPlayer={store.selectPlayer}
          onSelectClub={store.selectClub}
        />
      );
    }

    // Default: 'squad' or viewing another club ('club')
    const displayClub = activeScreen === 'club' ? viewedClub : userClub;
    const displaySquad = activeScreen === 'club' ? viewedSquad : userSquad;
    return (
      <SquadView
        club={displayClub}
        isUserClub={displayClub.id === userClub.id}
        squad={displaySquad}
        tactics={displayClub.tactics}
        leagues={state.leagues}
        clubs={state.clubs}
        onSelectPlayer={store.selectPlayer}
        onSelectClub={store.selectClub}
        onOpenTactics={() => store.navigate('tactics')}
        onAutoPick={store.autoPickUserLineup}
        onToggleTransferList={store.toggleTransferList}
      />
    );
  };

  return (
    <>
      <BackgroundLayer
        context={backgroundContext}
        audioSettings={state.audioSettings}
        onMediaResolved={store.setMediaInfo}
      />

      <div className="cm-shell">
        <TopBar
          userClub={userClub}
          league={userLeague}
          managerName={state.manager.name}
          currentDate={state.currentDate}
          nextFixture={nextUserFixture}
          clubs={state.clubs}
          audioSettings={state.audioSettings}
          mediaInfo={mediaInfo}
          hasActiveMatch={Boolean(state.activeMatch)}
          onContinue={store.continueGame}
          onUpdateAudioSettings={store.updateAudioSettings}
          onSelectClub={store.selectClub}
          onOpenMatch={() => store.navigate('match')}
        />

        <Sidebar
          activeScreen={activeScreen}
          userClub={userClub}
          managerName={state.manager.name}
          currentDate={state.currentDate}
          unreadNewsCount={unreadNewsCount}
          hasActiveMatch={Boolean(state.activeMatch)}
          hasNextMatchToday={hasNextMatchToday}
          onNavigate={store.navigate}
          onContinue={store.continueGame}
          onSaveGame={() => void store.saveGame(false)}
          onOpenNewGame={() => store.setNewGameOpen(true)}
          lastSavedAt={lastSavedAt}
        />

        <main className="cm-main">{renderMainScreen()}</main>
      </div>

      <NewGameModal
        isOpen={isNewGameOpen}
        canClose={state.initialized}
        leagues={allLeaguesList}
        clubs={allClubsList}
        savedMeta={savedMeta}
        isLoadingSave={isLoadingSave}
        onStartNewGame={store.startNewGame}
        onResumeSavedGame={() => void store.loadSavedGame()}
        onClose={() => store.setNewGameOpen(false)}
      />

      {toastMessage && (
        <div className="cm-toast" role="status" aria-live="polite">
          <CheckCircle2 size={15} color="#ffd84d" />
          <span>{toastMessage}</span>
        </div>
      )}
    </>
  );
};

export const App: React.FC = () => {
  return (
    <GameStoreProvider>
      <GameShell />
    </GameStoreProvider>
  );
};

export default App;
