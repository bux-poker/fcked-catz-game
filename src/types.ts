export type GamePhase = 'select' | 'playing' | 'over';

export type TrickType = 'ollie' | 'kickflip' | 'heelflip' | 'tailgrab' | 'nosegrab';
export type AirTrickType = Exclude<TrickType, 'ollie'>;

export type HeadwearType = 'cap' | 'beanie' | 'bandana' | 'none';
export type OutfitType = 'hoodie' | 'jacket';

export interface CatVisuals {
  fur: string;
  muzzle: string;
  headwear: HeadwearType;
  headwearColor: string;
  outfit: OutfitType;
  outfitColor: string;
  outfitAccent?: string;
  hasSunglasses: boolean;
  hasEarring?: boolean;
  boardColor: string;
  wheelColor: string;
}

export interface CatCharacter {
  id: string;
  name: string;
  color: string;
  accent: string;
  portrait?: string;
  visuals: CatVisuals;
}

export interface GameConfig {
  baseSpeed: number;
  maxSpeed: number;
  speedRamp: number;
  lives: number;
  roadHalfWidth: number;
  playHalfWidth: number;
  steerSpeed: number;
  jumpHeight: number;
  jumpDuration: number;
  invulnMs: number;
  trickPoints: Record<AirTrickType, number>;
  olliePoints: number;
  rampTrickBonus: number;
  pointsPerMeter: number;
}

export const CONFIG: GameConfig = {
  baseSpeed: 13,
  maxSpeed: 32,
  speedRamp: 0.18,
  lives: 3,
  roadHalfWidth: 2.75,
  playHalfWidth: 4.5,
  steerSpeed: 16,
  jumpHeight: 2.1,
  jumpDuration: 0.7,
  invulnMs: 1200,
  trickPoints: { kickflip: 150, heelflip: 200, tailgrab: 200, nosegrab: 150 },
  olliePoints: 100,
  rampTrickBonus: 100,
  pointsPerMeter: 1,
};
