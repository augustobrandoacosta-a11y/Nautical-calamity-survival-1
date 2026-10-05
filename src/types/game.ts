export type ShipId = 'titanic' | 'lusitania' | 'atlantic' | 'cruise' | 'britannic';

export type DisasterType = 
  | 'iceberg_split'
  | 'torpedo_list'
  | 'reef_capsize'
  | 'rogue_wave'
  | 'mine_explosion';

export interface ShipDefinition {
  id: ShipId;
  name: string;
  tagline: string;
  year: number;
  lengthMeters: number;
  passengersCapacity: number;
  disasterType: DisasterType;
  disasterTitle: string;
  description: string;
  disasterDescription: string;
  signatureMechanic: string;
  dangerRating: 1 | 2 | 3 | 4 | 5;
  image: string;
  colors: {
    hullBottom: string;
    hullTop: string;
    superstructure: string;
    deck: string;
    funnelBase: string;
    funnelTop: string;
    accent: string;
  };
  funnelCount: number;
  hasSplitting: boolean;
  maxPitch: number; // degrees bow down
  maxRoll: number; // degrees list
  sinkingDurationSeconds: number;
}

export type GamePhase = 'voting' | 'transition' | 'sinking' | 'gameover';

export interface PlayerUpgrades {
  gripStrength: number; // Tier 0-3: increases grab duration (5s -> 7s -> 9.5s -> 13s)
  thermalCoat: number;  // Tier 0-3: reduces hypothermia rate in icy water (-25%, -45%, -65%)
  flipperBoots: number; // Tier 0-3: increases swim speed (+25%, +50%, +75%)
  extraFlares: number;  // Tier 0-3: start with +1, +2, +3 flares
  seaLegs: number;      // Tier 0-3: reduces slope sliding speed (-30%, -55%, -75%)
}

export interface PlayerStats {
  health: number; // 0-100
  bodyTemp: number; // 0-100 (hypothermia drops fast in freezing sea water)
  fahrenheitTemp: number; // e.g. 98.6°F down to 60°F
  isSubmerged: boolean; // currently in icy ocean water
  stamina: number; // 0-100
  oxygen: number; // 0-100 (when underwater)
  hasLifejacket: boolean;
  inLifeboat: boolean;
  currentLifeboatId: string | null;
  flaresLeft: number;
  flaresFired: number;
  timeSurvived: number; // in seconds
  peakElevation: number; // max height above water
  isAlive: boolean;
  score: number;
  tokens: number; // currency for upgrades
  isGrabbing: boolean;
  grabStamina: number; // 0 to 100
  maxGrabStamina: number;
}

export interface BotSurvivor {
  id: string;
  name: string;
  meshIndex: number;
  isAlive: boolean;
  inLifeboat: boolean;
  position: { x: number; y: number; z: number };
  targetDeck: 'bow' | 'mid' | 'stern' | 'boat';
  panicLevel: number;
}

export interface ChatMessage {
  id: string;
  sender: string;
  text: string;
  isSystem?: boolean;
  isSos?: boolean;
  timestamp: string;
}

export interface SurvivalRecord {
  id: string;
  shipId: ShipId;
  shipName: string;
  survived: boolean;
  timeSurvived: number;
  flaresFired: number;
  usedLifeboat: boolean;
  date: string;
  badges: string[];
}
