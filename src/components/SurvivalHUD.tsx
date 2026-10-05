import React from 'react';
import { PlayerStats, ShipDefinition, ChatMessage } from '../types/game';
import {
  Heart,
  ThermometerSnowflake,
  Shield,
  Flame,
  Radio,
  Clock,
  Eye,
  Volume2,
  VolumeX,
  Compass,
  AlertTriangle,
  LifeBuoy,
  Hand,
  Coins
} from 'lucide-react';
import { sound } from '../utils/soundEffects';

interface SurvivalHUDProps {
  ship: ShipDefinition;
  stats: PlayerStats;
  disasterProgress: number;
  disasterStage: string;
  pitch: number;
  roll: number;
  rescueSeconds: number;
  interactPrompt: string | null;
  chatMessages: ChatMessage[];
  onFireFlare: () => void;
  onToggleCamera: () => void;
  onSetGrab: (isGrabbing: boolean) => void;
  isMuted: boolean;
  onToggleMute: () => void;
}

export const SurvivalHUD: React.FC<SurvivalHUDProps> = ({
  ship,
  stats,
  disasterProgress,
  disasterStage,
  pitch,
  roll,
  rescueSeconds,
  interactPrompt,
  chatMessages,
  onFireFlare,
  onToggleCamera,
  onSetGrab,
  isMuted,
  onToggleMute,
}) => {
  const isHypothermic = stats.bodyTemp < 40;
  const isCriticalHealth = stats.health < 30;
  const isSevereIncline = Math.abs(pitch) > 20 || Math.abs(roll) > 20;

  const minutes = Math.floor(rescueSeconds / 60);
  const seconds = Math.floor(rescueSeconds % 60);
  const formattedRescueTime = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-3 md:p-5 z-20">
      {/* Cold Vignette / Blood Screen Overlay when in danger */}
      {(isHypothermic || stats.isSubmerged) && (
        <div className="absolute inset-0 vignette-cold pointer-events-none animate-pulse flex items-start justify-center pt-24">
          {stats.isSubmerged && (
            <div className="px-4 py-2 bg-sky-950/90 border border-cyan-400 text-cyan-100 rounded-xl shadow-2xl backdrop-blur-md text-xs font-bold flex items-center gap-2 animate-bounce">
              <ThermometerSnowflake className="w-4 h-4 text-cyan-300 animate-spin" />
              <span>FREEZING SEA WATER (28°F)! CLIMB OUT ONTO DECK, RAFT, OR LIFEBOAT!</span>
            </div>
          )}
        </div>
      )}
      {isCriticalHealth && (
        <div className="absolute inset-0 vignette-disaster pointer-events-none animate-pulse" />
      )}

      {/* Top HUD: Player Vitals & Disaster Status */}
      <div className="pointer-events-auto flex flex-col md:flex-row items-stretch md:items-start justify-between gap-3">
        {/* Left: Player Vitals */}
        <div className="bg-slate-950/85 backdrop-blur-md border border-slate-800 rounded-xl p-3 shadow-xl max-w-sm w-full space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-200 tracking-wide flex items-center gap-1.5">
              <span>SURVIVOR STATUS</span>
              <span className="flex items-center gap-1 text-[11px] text-amber-400 font-mono-tabular">
                <Coins className="w-3 h-3" /> {stats.tokens}
              </span>
            </span>
            <div className="flex items-center gap-1.5">
              {stats.inLifeboat ? (
                <span className="text-[10px] font-medium px-2 py-0.5 bg-emerald-950/80 border border-emerald-700 text-emerald-300 rounded">
                  In Lifeboat
                </span>
              ) : stats.isSubmerged ? (
                <span className="text-[10px] font-bold px-2 py-0.5 bg-cyan-950 border border-cyan-400 text-cyan-300 rounded animate-pulse">
                  Freezing in Water
                </span>
              ) : stats.hasLifejacket ? (
                <span className="text-[10px] font-medium px-2 py-0.5 bg-amber-950/80 border border-amber-700 text-amber-300 rounded">
                  Lifejacket On
                </span>
              ) : (
                <span className="text-[10px] font-medium px-2 py-0.5 bg-slate-800 text-slate-400 rounded">
                  No Lifejacket
                </span>
              )}
            </div>
          </div>

          {/* Health Bar */}
          <div>
            <div className="flex justify-between text-[11px] mb-1 font-mono-tabular">
              <span className="flex items-center gap-1 text-rose-400 font-medium">
                <Heart className="w-3.5 h-3.5 fill-rose-500 text-rose-500" /> Health
              </span>
              <span className="text-slate-300 font-semibold">{Math.round(stats.health)}%</span>
            </div>
            <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
              <div
                className={`h-full transition-all duration-200 ${
                  stats.health > 50
                    ? 'bg-emerald-500'
                    : stats.health > 25
                    ? 'bg-amber-500'
                    : 'bg-rose-600 animate-pulse'
                }`}
                style={{ width: `${Math.max(0, Math.min(100, stats.health))}%` }}
              />
            </div>
          </div>

          {/* Body Temperature / Hypothermia Bar (Fahrenheit & Percent) */}
          <div>
            <div className="flex justify-between text-[11px] mb-1 font-mono-tabular">
              <span className={`flex items-center gap-1 font-medium ${stats.isSubmerged ? 'text-cyan-300 animate-pulse font-bold' : 'text-sky-400'}`}>
                <ThermometerSnowflake className={`w-3.5 h-3.5 ${stats.isSubmerged ? 'animate-spin' : ''}`} />
                <span>{stats.isSubmerged ? 'Freezing (28°F Water)' : 'Body Temperature'}</span>
              </span>
              <span className={`font-semibold ${isHypothermic || stats.isSubmerged ? 'text-cyan-300 font-bold animate-pulse' : 'text-slate-300'}`}>
                {(stats.fahrenheitTemp || 98.6).toFixed(1)}°F ({Math.round(stats.bodyTemp)}%)
              </span>
            </div>
            <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
              <div
                className={`h-full transition-all duration-200 ${
                  stats.bodyTemp > 50
                    ? 'bg-sky-500'
                    : stats.bodyTemp > 25
                    ? 'bg-cyan-400'
                    : 'bg-cyan-200 animate-pulse'
                }`}
                style={{ width: `${Math.max(0, Math.min(100, stats.bodyTemp))}%` }}
              />
            </div>
          </div>

          {/* Grip Stamina Bar (For Grab Button / Key [G]) */}
          <div>
            <div className="flex justify-between text-[11px] mb-1 font-mono-tabular">
              <span className={`flex items-center gap-1 font-medium ${stats.isGrabbing ? 'text-amber-400 font-bold animate-pulse' : 'text-slate-400'}`}>
                <Hand className="w-3.5 h-3.5" /> {stats.isGrabbing ? 'GRIPPING SHIP [G]' : 'Grip Stamina [G]'}
              </span>
              <span className={`font-semibold ${stats.grabStamina < 25 ? 'text-rose-400 animate-pulse' : 'text-slate-300'}`}>
                {Math.round(stats.grabStamina)}%
              </span>
            </div>
            <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
              <div
                className={`h-full transition-all duration-150 ${
                  stats.isGrabbing
                    ? stats.grabStamina > 30
                      ? 'bg-amber-400'
                      : 'bg-rose-500 animate-pulse'
                    : stats.grabStamina > 30
                    ? 'bg-slate-400'
                    : 'bg-rose-400'
                }`}
                style={{ width: `${Math.max(0, Math.min(100, stats.grabStamina))}%` }}
              />
            </div>
          </div>
        </div>

        {/* Center / Right: Ship Disaster Telemetry */}
        <div className="bg-slate-950/85 backdrop-blur-md border border-slate-800 rounded-xl p-3 shadow-xl max-w-md w-full space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-serif-maritime font-bold text-sm text-slate-100 flex items-center gap-2">
                {ship.name}
              </h2>
              <span className="text-[11px] text-amber-400 font-medium">
                {disasterStage}
              </span>
            </div>

            {/* Rescue Timer */}
            <div className="text-right">
              <div className="text-[10px] text-slate-400 uppercase tracking-wider flex items-center gap-1 justify-end">
                <Clock className="w-3 h-3 text-sky-400" />
                Rescue Vessel
              </div>
              <div className="font-mono-tabular text-sm font-bold text-sky-300">
                {formattedRescueTime}
              </div>
            </div>
          </div>

          {/* Ship Sinking Progress */}
          <div>
            <div className="flex justify-between text-[11px] mb-1 font-mono-tabular text-slate-300">
              <span>Flooding Progress</span>
              <span>{Math.round(disasterProgress * 100)}%</span>
            </div>
            <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
              <div
                className="h-full bg-gradient-to-r from-sky-600 via-amber-500 to-rose-600 transition-all duration-300"
                style={{ width: `${Math.min(100, disasterProgress * 100)}%` }}
              />
            </div>
          </div>

          {/* Incline Pitch & Roll Angles */}
          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800 text-[11px] font-mono-tabular text-slate-400">
            <div>
              <span className="text-slate-500">Bow Pitch: </span>
              <span className="text-slate-200 font-semibold">{pitch}° Down</span>
            </div>
            <div>
              <span className="text-slate-500">List Angle: </span>
              <span className="text-slate-200 font-semibold">{roll}°</span>
            </div>
          </div>
        </div>
      </div>

      {/* Severe Incline & Grab Warning Banner */}
      {isSevereIncline && !stats.inLifeboat && (
        <div className="pointer-events-auto mx-auto my-2 max-w-md bg-amber-950/85 border border-amber-500/80 text-amber-200 px-4 py-2 rounded-xl shadow-xl backdrop-blur-md flex items-center justify-between gap-3 animate-pulse">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="text-xs font-semibold">
              {stats.isGrabbing
                ? 'Holding on tight! Prevented slide!'
                : 'Deck is tipping steeply! Hold [G] or GRAB button!'}
            </span>
          </div>
          <button
            onMouseDown={() => onSetGrab(true)}
            onMouseUp={() => onSetGrab(false)}
            onTouchStart={() => onSetGrab(true)}
            onTouchEnd={() => onSetGrab(false)}
            className="hidden sm:flex items-center gap-1 px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-lg shadow cursor-pointer active:scale-95"
          >
            <Hand className="w-3.5 h-3.5" />
            {stats.isGrabbing ? 'HOLDING' : 'HOLD GRAB'}
          </button>
        </div>
      )}

      {/* Center Interactive Action Notification Prompt */}
      {interactPrompt && (
        <div className="pointer-events-auto mx-auto my-auto max-w-lg bg-sky-950/90 border border-sky-400 text-sky-100 px-5 py-2.5 rounded-xl shadow-2xl backdrop-blur-md flex items-center gap-3 animate-bounce">
          <LifeBuoy className="w-5 h-5 text-sky-300 animate-spin" />
          <span className="text-xs md:text-sm font-semibold tracking-wide">
            {interactPrompt}
          </span>
        </div>
      )}

      {/* Bottom Row: SOS Radio Chat & Action Controls */}
      <div className="pointer-events-auto flex flex-col md:flex-row items-end md:items-center justify-between gap-3">
        {/* Live SOS Distress Radio Messages */}
        <div className="bg-slate-950/85 backdrop-blur-md border border-slate-800 rounded-xl p-2.5 shadow-xl max-w-md w-full">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400 pb-1 border-b border-slate-800/80 mb-1.5">
            <Radio className="w-3.5 h-3.5 text-rose-500 animate-pulse" />
            <span className="font-semibold text-slate-300">Marconi Wireless / Passenger Distress</span>
          </div>

          <div className="h-14 overflow-y-auto space-y-1 text-xs font-mono-tabular">
            {chatMessages.slice(-3).map((m) => (
              <div key={m.id} className="truncate">
                <span className={m.isSos ? 'text-rose-400 font-bold' : 'text-sky-400 font-medium'}>
                  {m.sender}:
                </span>{' '}
                <span className="text-slate-200">{m.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Action Controls & Flare Gun */}
        <div className="flex items-center gap-2">
          {/* Desktop Grab Button */}
          <button
            onMouseDown={() => onSetGrab(true)}
            onMouseUp={() => onSetGrab(false)}
            className={`hidden sm:flex items-center gap-2 px-3 py-2.5 rounded-xl font-semibold text-xs shadow-xl transition-all cursor-pointer ${
              stats.isGrabbing
                ? 'bg-amber-500 text-slate-950 shadow-amber-950/80 ring-2 ring-amber-300'
                : 'bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700'
            }`}
          >
            <Hand className="w-4 h-4 text-amber-400" />
            <span>{stats.isGrabbing ? 'Grabbing Ship' : 'Grab Railing'}</span>
            <kbd className="px-1 py-0.5 bg-black/40 rounded text-[10px] font-mono">
              [G]
            </kbd>
          </button>

          {/* Signal Flare Button */}
          <button
            onClick={onFireFlare}
            disabled={stats.flaresLeft <= 0}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-xs shadow-xl transition-all cursor-pointer ${
              stats.flaresLeft > 0
                ? 'bg-rose-600 hover:bg-rose-500 active:scale-95 text-white shadow-rose-950/80'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
            }`}
          >
            <Flame className="w-4 h-4 fill-current text-amber-300" />
            <span>Launch Flare ({stats.flaresLeft})</span>
            <kbd className="hidden sm:inline px-1 py-0.5 bg-black/40 rounded text-[10px] font-mono">
              [F]
            </kbd>
          </button>

          {/* Camera View Toggle */}
          <button
            onClick={onToggleCamera}
            className="p-2.5 bg-slate-900 hover:bg-slate-800 active:scale-95 border border-slate-800 rounded-xl text-slate-300 hover:text-white transition-colors cursor-pointer shadow-lg"
            title="Toggle 1st / 3rd Person View (V)"
          >
            <Eye className="w-4 h-4" />
          </button>

          {/* Sound Toggle */}
          <button
            onClick={onToggleMute}
            className="p-2.5 bg-slate-900 hover:bg-slate-800 active:scale-95 border border-slate-800 rounded-xl text-slate-300 hover:text-white transition-colors cursor-pointer shadow-lg"
            title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
          </button>
        </div>
      </div>
    </div>
  );
};

