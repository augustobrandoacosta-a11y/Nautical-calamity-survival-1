import React, { useEffect } from 'react';
import { PlayerStats, SurvivalRecord } from '../types/game';
import confetti from 'canvas-confetti';
import { Trophy, Skull, Clock, Flame, LifeBuoy, ArrowUpRight, RotateCcw, Award, Coins } from 'lucide-react';
import { sound } from '../utils/soundEffects';

interface GameOverModalProps {
  survived: boolean;
  stats: PlayerStats;
  shipName: string;
  onReturnToLobby: () => void;
  onOpenUpgrades?: () => void;
}

export const GameOverModal: React.FC<GameOverModalProps> = ({
  survived,
  stats,
  shipName,
  onReturnToLobby,
  onOpenUpgrades,
}) => {
  const [countdown, setCountdown] = React.useState<number>(5);
  const [isPaused, setIsPaused] = React.useState<boolean>(false);

  useEffect(() => {
    if (survived) {
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
        });
      } catch (err) {
        // Safe confetti fallback
      }
    }
  }, [survived]);

  // Automated round restart: Teleport everyone back to the lobby
  useEffect(() => {
    if (isPaused) return;
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onReturnToLobby();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isPaused, onReturnToLobby]);

  // Compute Badges
  const badges: string[] = [];
  if (survived) badges.push('Unsinkable Survivor');
  if (stats.inLifeboat) badges.push('Lifeboat Veteran');
  if (stats.flaresFired >= 2) badges.push('Flare Master');
  if (stats.hasLifejacket) badges.push('Safety Prepared');
  if (stats.peakElevation > 25) badges.push('Stern Clinger');
  if (stats.timeSurvived > 60) badges.push('Iron Will');

  const minutes = Math.floor(stats.timeSurvived / 60);
  const seconds = Math.floor(stats.timeSurvived % 60);
  const timeFormatted = `${minutes}m ${seconds}s`;

  return (
    <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 md:p-4 z-40 animate-fade-in overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-5 md:p-6 shadow-2xl space-y-5 text-center my-auto">
        {/* Outcome Header */}
        <div className="flex flex-col items-center gap-2.5">
          <div
            className={`w-14 h-14 md:w-16 md:h-16 rounded-2xl flex items-center justify-center border shadow-xl ${
              survived
                ? 'bg-emerald-950/80 border-emerald-600 text-emerald-400'
                : 'bg-rose-950/80 border-rose-600 text-rose-400'
            }`}
          >
            {survived ? <Trophy className="w-7 h-7 md:w-8 md:h-8" /> : <Skull className="w-7 h-7 md:w-8 md:h-8" />}
          </div>

          <div>
            <h2 className="font-serif-maritime text-xl md:text-2xl font-bold tracking-wide text-slate-100">
              {survived ? 'RESCUED & SURVIVED!' : 'LOST TO THE SEA'}
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              {survived
                ? `You endured the sinking of ${shipName} until rescue cutters arrived!`
                : `You succumbed to the freezing depths during the sinking of ${shipName}.`}
            </p>
          </div>

          {/* Tokens Balance pill */}
          <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 border border-amber-500/40 rounded-full text-xs font-mono-tabular font-bold text-amber-300">
            <Coins className="w-3.5 h-3.5 text-amber-400" />
            <span>Balance: {stats.tokens} Tokens</span>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-2.5 text-center">
            <Clock className="w-4 h-4 mx-auto text-sky-400 mb-1" />
            <div className="text-[10px] text-slate-400 uppercase">Survival Time</div>
            <div className="font-mono-tabular text-sm font-bold text-slate-100">
              {timeFormatted}
            </div>
          </div>

          <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-2.5 text-center">
            <LifeBuoy className="w-4 h-4 mx-auto text-amber-400 mb-1" />
            <div className="text-[10px] text-slate-400 uppercase">Lifeboat</div>
            <div className="font-mono-tabular text-sm font-bold text-slate-100">
              {stats.inLifeboat ? 'Boarded' : 'None'}
            </div>
          </div>

          <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-2.5 text-center">
            <Flame className="w-4 h-4 mx-auto text-rose-400 mb-1" />
            <div className="text-[10px] text-slate-400 uppercase">Flares Fired</div>
            <div className="font-mono-tabular text-sm font-bold text-slate-100">
              {stats.flaresFired}
            </div>
          </div>

          <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-2.5 text-center">
            <ArrowUpRight className="w-4 h-4 mx-auto text-emerald-400 mb-1" />
            <div className="text-[10px] text-slate-400 uppercase">Peak Height</div>
            <div className="font-mono-tabular text-sm font-bold text-slate-100">
              {Math.round(stats.peakElevation)}m
            </div>
          </div>
        </div>

        {/* Badges Earned */}
        {badges.length > 0 && (
          <div className="space-y-1.5 text-left">
            <div className="text-xs text-slate-400 flex items-center gap-1.5 font-medium">
              <Award className="w-3.5 h-3.5 text-amber-400" />
              Badges Earned
            </div>
            <div className="flex flex-wrap gap-1.5">
              {badges.map((b) => (
                <span
                  key={b}
                  className="px-2.5 py-1 bg-slate-950 border border-slate-800 text-[11px] font-medium text-amber-300 rounded-lg"
                >
                  ★ {b}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Auto-Restart Banner */}
        <div className="bg-slate-950/80 border border-sky-500/30 rounded-xl p-3 space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-sky-300 flex items-center gap-1.5">
              <RotateCcw className={`w-3.5 h-3.5 text-sky-400 ${!isPaused ? 'animate-spin' : ''}`} />
              Restarting Round
            </span>
            <span className="font-mono-tabular font-bold text-amber-300">
              {isPaused ? 'Paused for Shop' : `Returning in ${countdown}s`}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 text-left">
            Ship has completed sinking. Teleporting everyone back to the Departure Lobby for next ship vote.
          </p>
          {!isPaused && (
            <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
              <div
                className="h-full bg-sky-500 transition-all duration-1000 ease-linear"
                style={{ width: `${(countdown / 5) * 100}%` }}
              />
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-2.5">
          {onOpenUpgrades && (
            <button
              onClick={() => {
                sound.playClick();
                setIsPaused(true);
                onOpenUpgrades();
              }}
              className="w-full sm:w-1/2 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-amber-950/60 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
            >
              <Coins className="w-4 h-4" />
              Equipment Upgrades
            </button>
          )}

          <button
            onClick={() => {
              sound.playClick();
              onReturnToLobby();
            }}
            className="w-full sm:flex-1 py-2.5 bg-sky-600 hover:bg-sky-500 active:scale-95 text-white font-semibold text-xs rounded-xl shadow-lg shadow-sky-950 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            Return to Terminal Now ({countdown}s)
          </button>
        </div>
      </div>
    </div>
  );
};
