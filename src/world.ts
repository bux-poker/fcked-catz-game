/** Road / sidewalk layout (metres-ish, world X axis). */
export const WORLD = {
  roadHalf: 2.75,
  sidewalkWidth: 1.75,
  leftLane: -1.38,
  rightLane: 1.38,
  leftSidewalk: -3.625,
  rightSidewalk: 3.625,
  sidewalkOuter: 4.5,
  playHalfWidth: 4.5,
  laneHalfWidth: 1.32,
  carHalfWidth: 1.42,
  carHalfLength: 2.5,
  pedestrianHalfWidth: 0.42,
  pedestrianHalfLength: 0.55,
  centerGapHalf: 0.55,
} as const;

export type Lane = 'left' | 'right';

export function laneBounds(lane: Lane): { min: number; max: number } {
  if (lane === 'left') return { min: -WORLD.roadHalf, max: -0.08 };
  return { min: 0.08, max: WORLD.roadHalf };
}

export function isInLane(x: number, lane: Lane): boolean {
  const b = laneBounds(lane);
  return x >= b.min && x <= b.max;
}

export function isOnSidewalk(x: number): boolean {
  const onLeft = x <= -WORLD.roadHalf - 0.1 && x >= -WORLD.sidewalkOuter;
  const onRight = x >= WORLD.roadHalf + 0.1 && x <= WORLD.sidewalkOuter;
  return onLeft || onRight;
}

export function isInCenterGap(x: number): boolean {
  return Math.abs(x) < WORLD.centerGapHalf;
}

export function laneForX(x: number): Lane | null {
  if (isInLane(x, 'left')) return 'left';
  if (isInLane(x, 'right')) return 'right';
  return null;
}

export function oppositeLane(lane: Lane): Lane {
  return lane === 'left' ? 'right' : 'left';
}

export function laneCenterX(lane: Lane): number {
  return lane === 'left' ? WORLD.leftLane : WORLD.rightLane;
}
