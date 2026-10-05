import React from 'react';
import { PlayerUpgrades } from '../types/game';
import {
  UPGRADES_METADATA,
  UPGRADE_TIER_COSTS,
  saveUpgrades,
  saveTokens,
} from '../utils/upgradesStorage';
import { sound } from '../utils/soundEffects';
import {
  X,
  Coins,
  Hand,
  Footprints,
  Shield,
  Fish,
  Flame,
  Check,
  ChevronRight,
  Sparkles
} from 'lucide-react';

interface UpgradeShopModalProps {
  upgrades: PlayerUpgrades;
  tokens: number;
  onUpdateUpgrades: (newUpgrades: PlayerUpgrades, newTokens: number) => void;
  onClose: () => void;
}

export const UpgradeShopModal: React.FC<UpgradeShopModalProps> = ({
  upgrades,
  tokens,
  onUpdateUpgrades,
  onClose,
}) => {
  const getIcon = (iconName: string) => {
    switch (iconName) {
      case 'Hand':
        return <Hand className="w-5 h-5 text-amber-400" />;
      case 'Footprints':
        return <Footprints className="w-5 h-5 text-sky-400" />;
      case 'Shield':
        return <Shield className="w-5 h-5 text-emerald-400" />;
      case 'Fish':
        return <Fish className="w-5 h-5 text-cyan-400" />;
      case 'Flame':
        return <Flame className="w-5 h-5 text-rose-400" />;
      default:
        return <Sparkles className="w-5 h-5 text-amber-400" />;
    }
  };

  const handleBuyUpgrade = (key: keyof PlayerUpgrades) => {
    const currentTier = upgrades[key];
    if (currentTier >= 3) return;

    const cost = UPGRADE_TIER_COSTS[currentTier];
    if (tokens < cost) return;

    sound.playUpgradeBuy();
    const newTokens = tokens - cost;
    const newUpgrades: PlayerUpgrades = {
      ...upgrades,
      [key]: currentTier + 1,
    };

    saveUpgrades(newUpgrades);
    saveTokens(newTokens);
    onUpdateUpgrades(newUpgrades, newTokens);
  };

  return (
    <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-3 md:p-6 animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 md:p-5 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-950/80 border border-amber-600/80 flex items-center justify-center text-amber-400 shadow-md">
              <Coins className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-serif-maritime text-base md:text-lg font-bold text-slate-100 flex items-center gap-2">
                Maritime Survival Equipment
              </h2>
              <p className="text-xs text-slate-400">
                Upgrade your survivor gear to hold onto the ship longer & endure icy waters.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Tokens Balance Pill */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-950 border border-amber-600/60 rounded-xl text-xs font-mono-tabular font-bold text-amber-300 shadow-inner">
              <Coins className="w-3.5 h-3.5 text-amber-400" />
              <span>{tokens}</span>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Upgrades List */}
        <div className="p-4 md:p-5 overflow-y-auto space-y-3.5 divide-y divide-slate-800/60">
          {UPGRADES_METADATA.map((meta) => {
            const currentTier = upgrades[meta.id];
            const isMaxed = currentTier >= 3;
            const nextCost = !isMaxed ? UPGRADE_TIER_COSTS[currentTier] : 0;
            const canAfford = tokens >= nextCost && !isMaxed;

            return (
              <div
                key={meta.id}
                className="pt-3.5 first:pt-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="flex items-start gap-3">
                  <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 shrink-0 mt-0.5">
                    {getIcon(meta.icon)}
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-serif-maritime font-bold text-sm text-slate-100">
                        {meta.title}
                      </h3>
                      {/* Tier Dots */}
                      <div className="flex items-center gap-1 ml-1">
                        {[1, 2, 3].map((star) => (
                          <div
                            key={star}
                            className={`w-2 h-2 rounded-full transition-colors ${
                              star <= currentTier
                                ? 'bg-amber-400 shadow-sm shadow-amber-400/50'
                                : 'bg-slate-800 border border-slate-700'
                            }`}
                          />
                        ))}
                      </div>
                    </div>

                    <p className="text-xs text-slate-400 leading-snug">
                      {meta.shortDesc}
                    </p>

                    <div className="text-[11px] font-mono-tabular text-sky-300">
                      Current: <span className="font-medium text-slate-200">{meta.tierEffects[currentTier]}</span>
                      {!isMaxed && (
                        <span className="text-slate-400 ml-2">
                          → Next: <strong className="text-amber-300">{meta.tierEffects[currentTier + 1]}</strong>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Upgrade Button */}
                <div className="sm:self-center shrink-0">
                  {isMaxed ? (
                    <div className="flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-950/60 border border-emerald-800/80 rounded-xl text-emerald-400 text-xs font-semibold">
                      <Check className="w-3.5 h-3.5" />
                      MAX TIER
                    </div>
                  ) : (
                    <button
                      onClick={() => handleBuyUpgrade(meta.id)}
                      disabled={!canAfford}
                      className={`w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold shadow-md transition-all cursor-pointer ${
                        canAfford
                          ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold active:scale-95 shadow-amber-950/60'
                          : 'bg-slate-800/80 border border-slate-700/80 text-slate-500 cursor-not-allowed'
                      }`}
                    >
                      <Coins className="w-3.5 h-3.5 text-amber-300" />
                      <span>{nextCost} Tokens</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between text-xs text-slate-400">
          <span>Earn tokens by surviving, deploying lifeboats & firing flares.</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white font-medium rounded-lg transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
