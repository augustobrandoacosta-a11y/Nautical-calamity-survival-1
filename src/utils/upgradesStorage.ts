import { PlayerUpgrades } from '../types/game';

const UPGRADES_STORAGE_KEY = 'nautical_calamity_upgrades';
const TOKENS_STORAGE_KEY = 'nautical_calamity_tokens';

export const DEFAULT_UPGRADES: PlayerUpgrades = {
  gripStrength: 0,
  thermalCoat: 0,
  flipperBoots: 0,
  extraFlares: 0,
  seaLegs: 0,
};

export const UPGRADE_TIER_COSTS = [100, 250, 500];

export interface UpgradeMeta {
  id: keyof PlayerUpgrades;
  title: string;
  shortDesc: string;
  icon: string;
  tierEffects: string[];
}

export const UPGRADES_METADATA: UpgradeMeta[] = [
  {
    id: 'gripStrength',
    title: 'Iron Grip',
    shortDesc: 'Hold onto railings & bulkheads longer when the ship tips or goes vertical.',
    icon: 'Hand',
    tierEffects: ['5.5s Hold (Base)', '7.5s Hold (+36%)', '10.0s Hold (+80%)', '13.5s Hold (+145%)'],
  },
  {
    id: 'seaLegs',
    title: 'Sea Legs',
    shortDesc: 'Maritime boots with corrugated soles that resist slope sliding down tilted decks.',
    icon: 'Footprints',
    tierEffects: ['Normal Slide', '-30% Slide Speed', '-55% Slide Speed', '-75% Slide Speed'],
  },
  {
    id: 'thermalCoat',
    title: 'Thermal Insulation',
    shortDesc: 'Woolen undergarments that slow lethal hypothermia when submerged in icy brine.',
    icon: 'Shield',
    tierEffects: ['Standard Chill', '-25% Freezing Rate', '-45% Freezing Rate', '-65% Freezing Rate'],
  },
  {
    id: 'flipperBoots',
    title: 'Swimming Fins',
    shortDesc: 'Increase swimming speed in choppy swells and climb rafts with ease.',
    icon: 'Fish',
    tierEffects: ['Standard Swim', '+25% Swim Speed', '+50% Swim Speed', '+75% Swim Speed'],
  },
  {
    id: 'extraFlares',
    title: 'Distress Flare Cache',
    shortDesc: 'Start each voyage equipped with extra signal flares to expedite rescue.',
    icon: 'Flame',
    tierEffects: ['2 Flares (Base)', '3 Starting Flares', '4 Starting Flares', '5 Starting Flares'],
  },
];

export function loadUpgrades(): PlayerUpgrades {
  if (typeof window === 'undefined') return { ...DEFAULT_UPGRADES };
  try {
    const raw = localStorage.getItem(UPGRADES_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_UPGRADES };
    return { ...DEFAULT_UPGRADES, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_UPGRADES };
  }
}

export function saveUpgrades(upgrades: PlayerUpgrades) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(UPGRADES_STORAGE_KEY, JSON.stringify(upgrades));
  } catch {}
}

export function loadTokens(): number {
  if (typeof window === 'undefined') return 150; // Starter tokens bonus
  try {
    const raw = localStorage.getItem(TOKENS_STORAGE_KEY);
    if (raw === null) return 150;
    return Math.max(0, parseInt(raw, 10) || 0);
  } catch {
    return 150;
  }
}

export function saveTokens(tokens: number) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(TOKENS_STORAGE_KEY, Math.max(0, Math.round(tokens)).toString());
  } catch {}
}
