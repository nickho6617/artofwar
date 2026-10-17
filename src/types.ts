// Domain types & constants for The Ancient Art of War

export type TerrainType = 'PLAINS' | 'FOREST' | 'MOUNTAIN' | 'FORT';
export type Faction = 'PLAYER' | 'AI';
export type UnitType = 'knights' | 'archers' | 'barbarians';
export type Stance = 'ADVANCE' | 'HOLD' | 'RETREAT';

export interface Squad {
  id: string;
  faction: Faction;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  condition: number;
  knights: number;
  archers: number;
  barbarians: number;
}

export interface TacticalCohort {
  faction: Faction;
  type: UnitType;
  hp: number;
  x: number;
  y: number;
  stance: Stance;
  cooldown: number;
  retreated: boolean;
}

export interface Arrow {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  t: number;
}

export interface Battle {
  attackerId: string;
  defenderId: string;
  terrain: TerrainType;
  cohorts: TacticalCohort[];
  arrows: Arrow[];
  playerMountain: boolean;
  aiMountain: boolean;
  playerCond: number;
  aiCond: number;
  selected: Set<UnitType> | UnitType[];
  aiTimer: number;
  isAmbush?: boolean;
  ambushFaction?: Faction | null;
  retreatBlocked?: Faction | null;
  elapsedTime?: number;
}

export interface GameState {
  mode: 'STRATEGIC' | 'TACTICAL' | 'GAME_OVER';
  winner: Faction | null;
  grid: TerrainType[][];
  flagPosition: { x: number; y: number }; // AI home flag (Player objective)
  playerFlag: { x: number; y: number };   // Player home flag
  squads: Squad[];
  activeBattle: Battle | null;
  selectedId: string | null;
  aiTimer: number;
  shatterMessage?: { text: string; time: number } | null;
}

// ───────────────────────── Commands ─────────────────────────
export type GameCommand =
  | { type: 'SELECT_SQUAD'; squadId: string | null }
  | { type: 'MARCH_SQUAD'; squadId: string; targetX: number; targetY: number }
  | { type: 'SELECT_TACTICAL'; unitType: 'all' | UnitType }
  | { type: 'SET_TACTICAL_STANCE'; stance: Stance }
  | { type: 'RESTART_GAME' };

// ───────────────────────── Dimensions & Constants ─────────────────────────
export const TILE = 50;
export const COLS = 16;
export const ROWS = 12;
export const W = 800;
export const H = 600;
export const AW = 800;
export const AH = 400;
export const AY = 100;

export const BASE_SPEED = 45;
export const ENGAGE_R = 25;
export const FLAG_R = 20;
export const TYPES: UnitType[] = ['knights', 'archers', 'barbarians'];

export const TERRAIN: Record<TerrainType, { speed: number; drain: number; color: string }> = {
  PLAINS: { speed: 1.0, drain: 1.0, color: '#5d8a3f' },
  FOREST: { speed: 0.7, drain: 1.2, color: '#2f5e32' },
  MOUNTAIN: { speed: 0.4, drain: 2.0, color: '#7d8084' },
  FORT: { speed: 0.5, drain: 0.0, color: '#6f8f45' },
};

export const STATS: Record<UnitType, { hp: number; speed: number; range: number; dps: number; label: string }> = {
  knights: { hp: 10, speed: 30, range: 0, dps: 1.0, label: 'K' },
  archers: { hp: 5, speed: 42, range: 240, dps: 0.9, label: 'A' },
  barbarians: { hp: 6, speed: 70, range: 0, dps: 1.3, label: 'B' },
};

// Combat rock-paper-scissors advantage multiplier: MULT[attacker][defender]
export const MULT: Record<UnitType, Record<UnitType, number>> = {
  knights: { knights: 1, archers: 2, barbarians: 0.5 },
  archers: { knights: 0.5, archers: 1, barbarians: 2 },
  barbarians: { knights: 2, archers: 0.5, barbarians: 1 },
};

export const MAP = [
  'MMPPFFPPPPFFPPMM',
  'MPPPFPPTPPPFPPPM',
  'PPFFPPMMMMPPFFPP',
  'PPFFPPPMMPPPFFPP',
  'FFPPPTPPPPPPTPFF',
  'FPPMMPPFFPPMMPPF',
  'FPPMMPPFFPPMMPPF',
  'FFPTPPPPPPPPTPFF',
  'PPFFPPPMMPPPFFPP',
  'PPFFPPMMMMPPFFPP',
  'MPPPFPPPTPPFPPPM',
  'MMPPFFPPPPFFPPMM',
];

export const CH: Record<string, TerrainType> = {
  P: 'PLAINS',
  F: 'FOREST',
  M: 'MOUNTAIN',
  T: 'FORT',
};
