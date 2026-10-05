import React, { useEffect, useRef, useState } from 'react';
import { GameEngine } from './game/GameEngine';
import { GamePhase, PlayerStats, PlayerUpgrades, ShipDefinition, ShipId, ChatMessage } from './types/game';
import { SHIPS_DATA } from './data/ships';
import { VotingLobbyOverlay } from './components/VotingLobbyOverlay';
import { SurvivalHUD } from './components/SurvivalHUD';
import { GameOverModal } from './components/GameOverModal';
import { MobileControls } from './components/MobileControls';
import { UpgradeShopModal } from './components/UpgradeShopModal';
import { loadUpgrades, saveUpgrades, loadTokens, saveTokens } from './utils/upgradesStorage';
import { sound } from './utils/soundEffects';
import {
  Anchor,
  HelpCircle,
  BookOpen,
  Volume2,
  VolumeX,
  X,
  Shield,
  LifeBuoy,
  Flame,
  AlertTriangle,
  Coins,
  Hand,
  Gamepad2
} from 'lucide-react';

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<GameEngine | null>(null);

  const [phase, setPhase] = useState<GamePhase>('voting');
  const [activeShip, setActiveShip] = useState<ShipDefinition>(SHIPS_DATA['titanic']);
  const [upgrades, setUpgrades] = useState<PlayerUpgrades>(loadUpgrades());
  const [showUpgradeModal, setShowUpgradeModal] = useState<boolean>(false);
  const [showJoystick, setShowJoystick] = useState<boolean>(true);

  const [stats, setStats] = useState<PlayerStats>({
    health: 100,
    bodyTemp: 100,
    fahrenheitTemp: 98.6,
    isSubmerged: false,
    stamina: 100,
    oxygen: 100,
    hasLifejacket: false,
    inLifeboat: false,
    currentLifeboatId: null,
    flaresLeft: 2,
    flaresFired: 0,
    timeSurvived: 0,
    peakElevation: 0,
    isAlive: true,
    score: 0,
    tokens: loadTokens(),
    isGrabbing: false,
    grabStamina: 100,
    maxGrabStamina: 100,
  });

  const [disasterProgress, setDisasterProgress] = useState<number>(0);
  const [disasterStage, setDisasterStage] = useState<string>('Calm Voyage');
  const [pitch, setPitch] = useState<number>(0);
  const [roll, setRoll] = useState<number>(0);
  const [rescueSeconds, setRescueSeconds] = useState<number>(110);
  const [interactPrompt, setInteractPrompt] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [showGuideModal, setShowGuideModal] = useState<boolean>(false);
  const [showFleetModal, setShowFleetModal] = useState<boolean>(false);

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      sender: 'Harbor Master',
      text: 'Welcome to Southampton Departure Terminal. Cast your vote for the voyage vessel.',
      isSystem: true,
      timestamp: '00:00',
    },
    {
      id: '2',
      sender: 'Capt. Smith',
      text: 'RMS Titanic is ready at dock #44. She is a magnificent liner.',
      timestamp: '00:01',
    },
  ]);

  const [gameOverResult, setGameOverResult] = useState<{
    survived: boolean;
    stats: PlayerStats;
    shipName: string;
  } | null>(null);

  // Initialize GameEngine
  useEffect(() => {
    if (!containerRef.current) return;

    const initialUpgrades = loadUpgrades();
    const initialTokens = loadTokens();

    const engine = new GameEngine(containerRef.current, {
      onStatsUpdate: (newStats) => setStats({ ...newStats }),
      onPhaseChange: (newPhase) => {
        setPhase(newPhase);
        if (newPhase === 'voting') {
          setGameOverResult(null);
        }
      },
      onChatMessage: (msg) => {
        setChatMessages((prev) => [...prev.slice(-20), msg]);
      },
      onDisasterProgress: (progress, stageTitle, currentPitch, currentRoll) => {
        setDisasterProgress(progress);
        setDisasterStage(stageTitle);
        setPitch(currentPitch);
        setRoll(currentRoll);
      },
      onGameOver: (survived, finalStats, shipName) => {
        setGameOverResult({ survived, stats: finalStats, shipName });
      },
      onPromptInteract: (prompt) => setInteractPrompt(prompt),
    });

    engine.setUpgrades(initialUpgrades);
    engineRef.current = engine;

    return () => {
      engine.stop();
    };
  }, []);

  // Update rescue countdown in sinking phase
  useEffect(() => {
    if (phase !== 'sinking') return;
    const interval = setInterval(() => {
      setRescueSeconds((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [phase]);

  const handleVoteShip = (shipId: ShipId) => {
    setActiveShip(SHIPS_DATA[shipId] || SHIPS_DATA['titanic']);
  };

  const handleForceLaunch = (shipId: ShipId) => {
    const selected = SHIPS_DATA[shipId] || SHIPS_DATA['titanic'];
    setActiveShip(selected);
    setRescueSeconds(selected.sinkingDurationSeconds);
    if (engineRef.current) {
      engineRef.current.launchShipVoyage(shipId);
    }
  };

  const handleReturnToLobby = () => {
    setGameOverResult(null);
    if (engineRef.current) {
      engineRef.current.loadLobby();
    }
  };

  const handleSendChatMessage = (text: string) => {
    const newMsg: ChatMessage = {
      id: String(Date.now()),
      sender: 'You',
      text: text.replace(/^\[You\]\s*/, ''),
      timestamp: 'NOW',
    };
    setChatMessages((prev) => [...prev.slice(-20), newMsg]);
  };

  const handleToggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    sound.setMuted(nextMuted);
  };

  const handleUpdateUpgrades = (newUpgrades: PlayerUpgrades, newTokens: number) => {
    setUpgrades(newUpgrades);
    setStats((prev) => ({ ...prev, tokens: newTokens }));
    if (engineRef.current) {
      engineRef.current.setUpgrades(newUpgrades);
    }
  };

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-slate-950 font-sans select-none">
      {/* 3D WebGL Canvas Container */}
      <div ref={containerRef} className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Top Bar Contract (Clean 3-Zone Header) */}
      <header className="absolute top-0 inset-x-0 h-14 z-30 flex items-center justify-between px-3 md:px-6 bg-slate-950/70 backdrop-blur-md border-b border-slate-800/80 pointer-events-auto">
        {/* Zone 1: Single text element wordmark */}
        <div className="flex items-center gap-2">
          <Anchor className="w-5 h-5 text-sky-400" />
          <span className="font-serif-maritime text-sm sm:text-base md:text-lg font-bold tracking-wide text-slate-100 whitespace-nowrap">
            Nautical Calamity
          </span>
        </div>

        {/* Zone 2: Clean text navigation links */}
        <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-slate-300">
          <button
            onClick={() => setShowFleetModal(true)}
            className="hover:text-sky-300 transition-colors cursor-pointer"
          >
            Vessel Archives
          </button>
          <button
            onClick={() => setShowGuideModal(true)}
            className="hover:text-sky-300 transition-colors cursor-pointer"
          >
            Survival Manual
          </button>
          <button
            onClick={() => setShowUpgradeModal(true)}
            className="hover:text-amber-300 transition-colors cursor-pointer flex items-center gap-1.5 text-amber-400"
          >
            <Coins className="w-3.5 h-3.5" />
            Equipment Upgrades
          </button>
          <span className="text-slate-500 font-mono-tabular">
            Phase: <strong className="text-sky-400 uppercase">{phase}</strong>
          </span>
        </nav>

        {/* Zone 3: 1-2 primary actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Tokens Button / Indicator */}
          <button
            onClick={() => setShowUpgradeModal(true)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-mono-tabular font-bold transition-colors cursor-pointer active:scale-95"
            title="Open Equipment Upgrades"
          >
            <Coins className="w-3.5 h-3.5 text-amber-400" />
            <span>{stats.tokens}</span>
          </button>

          <button
            onClick={handleToggleMute}
            className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white transition-colors cursor-pointer"
            title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
          </button>

          <button
            onClick={() => setShowGuideModal(true)}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Rules</span>
          </button>
        </div>
      </header>

      {/* Voting Lobby Overlay */}
      {phase === 'voting' && (
        <VotingLobbyOverlay
          onVoteShip={handleVoteShip}
          onForceLaunch={handleForceLaunch}
          chatMessages={chatMessages}
          onSendChatMessage={handleSendChatMessage}
          tokens={stats.tokens}
          onOpenUpgrades={() => setShowUpgradeModal(true)}
        />
      )}

      {/* Transition Screen: Spawning Selected Ship */}
      {phase === 'transition' && (
        <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center p-6 z-40 text-center animate-fade-in">
          <Anchor className="w-12 h-12 text-sky-400 mb-4 animate-bounce" />
          <h2 className="font-serif-maritime text-2xl md:text-3xl font-bold text-slate-100">
            ALL ABOARD {activeShip.name.toUpperCase()}!
          </h2>
          <p className="text-xs text-sky-300 font-medium mt-1">
            {activeShip.tagline}
          </p>
          <div className="mt-4 px-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-400 max-w-md">
            Teleporting all passengers aboard to promenade decks. Hold onto the ship when it tips!
          </div>
        </div>
      )}

      {/* Sinking Survival HUD */}
      {phase === 'sinking' && (
        <SurvivalHUD
          ship={activeShip}
          stats={stats}
          disasterProgress={disasterProgress}
          disasterStage={disasterStage}
          pitch={pitch}
          roll={roll}
          rescueSeconds={rescueSeconds}
          interactPrompt={interactPrompt}
          chatMessages={chatMessages}
          onFireFlare={() => engineRef.current?.fireFlare()}
          onToggleCamera={() => engineRef.current?.toggleCamera()}
          onSetGrab={(down) => engineRef.current?.setGrab(down)}
          isMuted={isMuted}
          onToggleMute={handleToggleMute}
        />
      )}

      {/* Game Over / Post-Sinking Debriefing Modal */}
      {phase === 'gameover' && gameOverResult && (
        <GameOverModal
          survived={gameOverResult.survived}
          stats={gameOverResult.stats}
          shipName={gameOverResult.shipName}
          onReturnToLobby={handleReturnToLobby}
          onOpenUpgrades={() => setShowUpgradeModal(true)}
        />
      )}

      {/* Mobile Touch Virtual Controls */}
      <MobileControls
        onMove={(x, y) => engineRef.current?.setVirtualMovement(x, y)}
        onJump={() => engineRef.current?.virtualJump()}
        onInteract={() => engineRef.current?.virtualInteract()}
        onFlare={() => engineRef.current?.virtualFlare()}
        onGrab={(isDown) => engineRef.current?.setGrab(isDown)}
        onToggleCamera={() => engineRef.current?.toggleCamera()}
        flaresLeft={stats.flaresLeft}
        isGrabbing={stats.isGrabbing}
        grabStamina={stats.grabStamina}
        isSinkingPhase={phase === 'sinking'}
      />

      {/* Equipment Upgrades Shop Modal */}
      {showUpgradeModal && (
        <UpgradeShopModal
          upgrades={upgrades}
          tokens={stats.tokens}
          onUpdateUpgrades={handleUpdateUpgrades}
          onClose={() => setShowUpgradeModal(false)}
        />
      )}

      {/* Vessel Archives Modal */}
      {showFleetModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="font-serif-maritime text-lg font-bold text-slate-100 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-sky-400" />
                Vessel Archives & Historic Calamities
              </h2>
              <button
                onClick={() => setShowFleetModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs text-slate-300">
              {Object.values(SHIPS_DATA).map((s) => (
                <div key={s.id} className="p-3 bg-slate-950 border border-slate-800/80 rounded-xl space-y-2">
                  <div className="flex items-baseline justify-between">
                    <h3 className="font-serif-maritime font-bold text-sm text-slate-100">
                      {s.name} ({s.year})
                    </h3>
                    <span className="text-[11px] text-amber-400 font-mono-tabular">
                      {s.lengthMeters}m · {s.passengersCapacity} passengers
                    </span>
                  </div>
                  <p className="text-slate-400">{s.description}</p>
                  <div className="p-2 bg-slate-900/60 rounded border border-slate-800 text-[11px]">
                    <strong className="text-rose-400">Calamity: </strong> {s.disasterDescription}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Survival Manual Modal */}
      {showGuideModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="font-serif-maritime text-lg font-bold text-slate-100 flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-sky-400" />
                Maritime Survival Manual
              </h2>
              <button
                onClick={() => setShowGuideModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-300">
              <div className="flex items-start gap-2.5">
                <Hand className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                <div>
                  <strong className="text-slate-100">Grabbing the Ship: </strong>
                  When a vessel tips over, rolls, or the stern rises vertically, hold <kbd className="px-1 bg-slate-800 rounded font-mono">[G]</kbd> on desktop or the on-screen <strong className="text-amber-300">GRAB</strong> button on mobile to cling to railings and bulkheads. You cannot hold on forever, so monitor your grip stamina!
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <Coins className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                <div>
                  <strong className="text-slate-100">Equipment Upgrades: </strong>
                  Earn tokens by surviving, firing flares, and boarding lifeboats. Spend them in the Upgrades shop on Iron Grip (longer hold), Thermal Coat (slows freezing), Swimming Fins, and Extra Starting Flares.
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <LifeBuoy className="w-4 h-4 text-sky-400 mt-0.5 shrink-0" />
                <div>
                  <strong className="text-slate-100">Lifeboats & Davits: </strong>
                  Walk up to lifeboats on the boat deck and press <kbd className="px-1 bg-slate-800 rounded font-mono">[E]</kbd> to board. Once deployed, lifeboats insulate you from freezing water.
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <Flame className="w-4 h-4 text-rose-400 mt-0.5 shrink-0" />
                <div>
                  <strong className="text-slate-100">Distress Flares: </strong>
                  Press <kbd className="px-1 bg-slate-800 rounded font-mono">[F]</kbd> to launch red flares skyward to speed up the rescue ship's arrival!
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowGuideModal(false)}
              className="w-full py-2.5 bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs rounded-xl cursor-pointer"
            >
              Understood, Captain
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
