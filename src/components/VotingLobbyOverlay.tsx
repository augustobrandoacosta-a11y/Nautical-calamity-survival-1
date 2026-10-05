import React, { useState, useEffect } from 'react';
import { ShipDefinition, ShipId, ChatMessage } from '../types/game';
import { SHIPS_DATA, BOT_PASSENGERS_LIST, BOT_VOTE_QUOTES } from '../data/ships';
import { sound } from '../utils/soundEffects';
import { Anchor, Users, Compass, Flame, Clock, Sparkles, AlertTriangle, Play, ShieldAlert, Coins } from 'lucide-react';

interface VotingLobbyOverlayProps {
  onVoteShip: (shipId: ShipId) => void;
  onForceLaunch: (selectedShipId: ShipId) => void;
  chatMessages: ChatMessage[];
  onSendChatMessage: (text: string) => void;
  tokens: number;
  onOpenUpgrades: () => void;
}

export const VotingLobbyOverlay: React.FC<VotingLobbyOverlayProps> = ({
  onVoteShip,
  onForceLaunch,
  chatMessages,
  onSendChatMessage,
  tokens,
  onOpenUpgrades,
}) => {
  const [selectedVote, setSelectedVote] = useState<ShipId>('titanic');
  const [countdown, setCountdown] = useState<number>(20);
  const [votes, setVotes] = useState<Record<ShipId, number>>({
    titanic: 4,
    lusitania: 2,
    atlantic: 1,
    cruise: 2,
    britannic: 1,
  });
  const [chatInput, setChatInput] = useState<string>('');

  const shipsList = Object.values(SHIPS_DATA);
  const totalVotes = Object.values(votes).reduce((a, b) => a + b, 0);

  // Simulated passenger votes and chat during countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          // Find winning ship
          const winningShip = (Object.keys(votes) as ShipId[]).reduce((a, b) =>
            votes[a] >= votes[b] ? a : b
          );
          onForceLaunch(winningShip);
          return 0;
        }

        // Random bot vote tick
        if (Math.random() < 0.45) {
          const shipKeys = Object.keys(SHIPS_DATA) as ShipId[];
          const randomShip = shipKeys[Math.floor(Math.random() * shipKeys.length)];
          setVotes((v) => ({ ...v, [randomShip]: v[randomShip] + 1 }));

          // Bot quote in chat
          if (Math.random() < 0.3) {
            const randomBot = BOT_PASSENGERS_LIST[Math.floor(Math.random() * BOT_PASSENGERS_LIST.length)];
            const randomQuote = BOT_VOTE_QUOTES[Math.floor(Math.random() * BOT_VOTE_QUOTES.length)];
            onSendChatMessage(`[${randomBot}] ${randomQuote}`);
          }
        }

        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [votes, onForceLaunch, onSendChatMessage]);

  const handleSelectShip = (shipId: ShipId) => {
    sound.playClick();
    setSelectedVote(shipId);
    setVotes((v) => ({ ...v, [shipId]: v[shipId] + 1 }));
    onVoteShip(shipId);
  };

  const handleQuickLaunch = () => {
    sound.playClick();
    onForceLaunch(selectedVote);
  };

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    onSendChatMessage(`[You] ${chatInput.trim()}`);
    setChatInput('');
  };

  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-4 md:p-6 z-20">
      {/* Top Header & Countdown Banner */}
      <header className="pointer-events-auto flex flex-col md:flex-row items-center justify-between gap-4 bg-slate-950/85 backdrop-blur-md border border-slate-800 rounded-xl px-5 py-3 shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-sky-950 border border-sky-800/80 flex items-center justify-center text-sky-400">
            <Anchor className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-serif-maritime text-lg md:text-xl font-bold tracking-wide text-slate-100 flex items-center gap-2">
              Departure Terminal · Passenger Ballot
            </h1>
            <p className="text-xs text-slate-400">
              Vote for the next vessel to spawn. All survivors teleport aboard at departure.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 sm:gap-4">
          {/* Equipment Upgrades Shop Button */}
          <button
            onClick={() => {
              sound.playClick();
              onOpenUpgrades();
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/40 rounded-lg text-amber-300 text-xs font-semibold shadow transition-all cursor-pointer active:scale-95"
          >
            <Coins className="w-3.5 h-3.5 text-amber-400" />
            <span>Upgrades</span>
            <span className="font-mono-tabular px-1.5 py-0.2 bg-amber-500/20 rounded text-[11px] text-amber-200">
              {tokens}
            </span>
          </button>

          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg">
            <Clock className="w-4 h-4 text-amber-400 animate-pulse" />
            <span className="text-xs text-slate-400 hidden sm:inline">Departure:</span>
            <span className="font-mono-tabular text-sm font-bold text-amber-400">
              00:{countdown.toString().padStart(2, '0')}
            </span>
          </div>

          <button
            onClick={handleQuickLaunch}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-sky-600 hover:bg-sky-500 active:scale-95 text-white font-semibold text-xs rounded-lg shadow-lg shadow-sky-950 transition-all cursor-pointer whitespace-nowrap"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            Spawn Now
          </button>
        </div>
      </header>

      {/* Main Ballot Cards Grid */}
      <div className="pointer-events-auto my-auto max-w-6xl w-full mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 md:gap-4 overflow-y-auto max-h-[62vh] py-2 pr-1">
        {shipsList.map((ship) => {
          const isSelected = selectedVote === ship.id;
          const voteCount = votes[ship.id] || 0;
          const votePercentage = Math.round((voteCount / totalVotes) * 100) || 0;

          return (
            <div
              key={ship.id}
              onClick={() => handleSelectShip(ship.id)}
              className={`group relative flex flex-col justify-between rounded-xl overflow-hidden cursor-pointer transition-all duration-200 border text-left bg-slate-900/90 backdrop-blur-sm ${
                isSelected
                  ? 'border-sky-400 ring-2 ring-sky-400/40 shadow-xl shadow-sky-950/80 -translate-y-1'
                  : 'border-slate-800 hover:border-slate-700 hover:bg-slate-800/80'
              }`}
            >
              {/* Ship Image Preview */}
              <div className="relative h-32 w-full overflow-hidden bg-slate-950">
                <img
                  src={ship.image}
                  alt={ship.name}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  onError={(e) => {
                    // Fallback to stylized SVG graphic if image path issue occurs
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/30 to-transparent" />

                {/* Vote Percentage Badge */}
                <div className="absolute top-2 right-2 px-2 py-0.5 bg-slate-950/80 backdrop-blur-md rounded border border-slate-700 text-[11px] font-mono-tabular font-semibold text-sky-300">
                  {voteCount} votes ({votePercentage}%)
                </div>

                {/* Splitting indicator */}
                {ship.hasSplitting && (
                  <div className="absolute top-2 left-2 px-1.5 py-0.5 bg-red-950/80 border border-red-700/80 rounded text-[10px] text-red-300 flex items-center gap-1 font-medium">
                    <AlertTriangle className="w-2.5 h-2.5" />
                    Hull Splits!
                  </div>
                )}
              </div>

              {/* Card Body */}
              <div className="p-3 flex flex-col flex-grow justify-between gap-2">
                <div>
                  <div className="flex items-baseline justify-between">
                    <h3 className="font-serif-maritime font-bold text-sm text-slate-100 group-hover:text-sky-300 transition-colors">
                      {ship.name}
                    </h3>
                    <span className="text-[11px] text-slate-400 font-mono-tabular">
                      {ship.year}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 line-clamp-2 mt-1 leading-snug">
                    {ship.disasterTitle}
                  </p>
                </div>

                {/* Mechanic Preview */}
                <div className="p-2 rounded bg-slate-950/60 border border-slate-800 text-[10px] text-slate-300 leading-tight">
                  <span className="text-amber-400 font-medium">Hazard: </span>
                  {ship.signatureMechanic}
                </div>

                {/* Vote CTA Button */}
                <button
                  className={`w-full py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
                    isSelected
                      ? 'bg-sky-500 text-white shadow-md'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {isSelected ? '✓ Voted' : 'Vote Vessel'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom Live Chat & Survivor Controls Info */}
      <footer className="pointer-events-auto flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-slate-950/90 backdrop-blur-md border border-slate-800 rounded-xl p-3 shadow-xl">
        {/* Chat / Passenger Radio */}
        <div className="flex-1 flex flex-col gap-1.5">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Users className="w-3.5 h-3.5 text-sky-400" />
            <span className="font-medium text-slate-300">Passenger Quarters Chat</span>
            <span>·</span>
            <span>{BOT_PASSENGERS_LIST.length + 1} online</span>
          </div>

          <div className="h-12 overflow-y-auto pr-2 space-y-1 text-xs font-mono-tabular text-slate-300">
            {chatMessages.slice(-3).map((msg) => (
              <div key={msg.id} className="truncate">
                <span className="text-sky-400 font-medium">{msg.sender}:</span>{' '}
                <span className="text-slate-200">{msg.text}</span>
              </div>
            ))}
          </div>

          <form onSubmit={handleSendChat} className="flex gap-2">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Say something to fellow passengers..."
              className="flex-1 bg-slate-900 border border-slate-700/80 rounded-lg px-3 py-1 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500"
            />
            <button
              type="submit"
              className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-xs font-medium rounded-lg text-slate-200 cursor-pointer"
            >
              Send
            </button>
          </form>
        </div>

        {/* Controls Guide */}
        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 border-t md:border-t-0 md:border-l border-slate-800 pt-2 md:pt-0 md:pl-4">
          <div className="flex items-center gap-1.5">
            <kbd className="px-1.5 py-0.5 bg-slate-900 border border-slate-700 rounded text-[11px] text-slate-200 font-mono">
              WASD
            </kbd>
            <span>Move</span>
          </div>
          <div className="flex items-center gap-1.5">
            <kbd className="px-1.5 py-0.5 bg-slate-900 border border-slate-700 rounded text-[11px] text-slate-200 font-mono">
              Space
            </kbd>
            <span>Jump</span>
          </div>
          <div className="flex items-center gap-1.5">
            <kbd className="px-1.5 py-0.5 bg-slate-900 border border-slate-700 rounded text-[11px] text-slate-200 font-mono">
              E
            </kbd>
            <span>Lifeboats</span>
          </div>
          <div className="flex items-center gap-1.5">
            <kbd className="px-1.5 py-0.5 bg-slate-900 border border-slate-700 rounded text-[11px] text-slate-200 font-mono">
              F
            </kbd>
            <span>Signal Flare</span>
          </div>
          <div className="flex items-center gap-1.5">
            <kbd className="px-1.5 py-0.5 bg-slate-900 border border-slate-700 rounded text-[11px] text-slate-200 font-mono">
              V
            </kbd>
            <span>Camera</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
