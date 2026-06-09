import * as THREE from 'three';
import type { RoadPiece } from './road';
import { WORLD } from './world';

export const GAP_WIDTH = 5;
const BUILDING_DEPTH = 4.5;
const CROSSROAD_SPACING = 160;
const FIRST_CROSSROAD_WORLD_Z = 80;

export type LightPhase = 'vertical-green' | 'vertical-red';

const VERTICAL_GREEN_TIME = 7;
const VERTICAL_RED_TIME = 5.5;

interface CrossroadState {
  phase: LightPhase;
  timer: number;
  worldZ: number;
}

function flatMat(color: number): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide });
}

export function getCrossroadCentersInRange(z0: number, z1: number): number[] {
  const centers: number[] = [];
  let k = Math.floor((z0 - FIRST_CROSSROAD_WORLD_Z - GAP_WIDTH) / CROSSROAD_SPACING);
  if (k < 0) k = 0;
  let z = FIRST_CROSSROAD_WORLD_Z + k * CROSSROAD_SPACING;
  while (z <= z1 + GAP_WIDTH / 2) {
    if (z >= z0 - GAP_WIDTH / 2) centers.push(z);
    z += CROSSROAD_SPACING;
  }
  return centers;
}

export function getCrossroadLocalZs(segmentLength: number, segmentWorldZ: number): number[] {
  return getCrossroadCentersInRange(segmentWorldZ, segmentWorldZ + segmentLength).map(
    (c) => c - segmentWorldZ,
  );
}

export function clipOutCrossroads(
  start: number,
  end: number,
): Array<{ start: number; end: number }> {
  const crosses = getCrossroadCentersInRange(start - GAP_WIDTH, end + GAP_WIDTH).filter(
    (c) => c + GAP_WIDTH / 2 > start && c - GAP_WIDTH / 2 < end,
  );
  if (crosses.length === 0) return [{ start, end }];

  crosses.sort((a, b) => a - b);
  const pieces: Array<{ start: number; end: number }> = [];
  let s = start;

  for (const cross of crosses) {
    const g0 = cross - GAP_WIDTH / 2;
    const g1 = cross + GAP_WIDTH / 2;
    if (s < g0 - 0.01) pieces.push({ start: s, end: Math.min(end, g0) });
    s = Math.max(s, g1);
  }
  if (s < end - 0.01) pieces.push({ start: s, end });
  return pieces.filter((p) => p.end - p.start > 0.4);
}

function makeSignalPole(axis: 'vertical' | 'horizontal'): THREE.Group {
  const g = new THREE.Group();
  g.userData.axis = axis;

  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.08, 2.4, 8),
    flatMat(0x333333),
  );
  pole.position.y = 1.2;
  g.add(pole);

  const housing = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.72, 0.22), flatMat(0x1a1a1a));
  housing.position.y = 2.15;
  g.add(housing);

  const red = new THREE.Mesh(new THREE.CircleGeometry(0.09, 12), flatMat(0x440000));
  red.position.set(0, 2.35, 0.12);
  g.add(red);

  const green = new THREE.Mesh(new THREE.CircleGeometry(0.09, 12), flatMat(0x004411));
  green.position.set(0, 1.95, 0.12);
  g.add(green);

  g.userData.redLens = red;
  g.userData.greenLens = green;
  return g;
}

function updateSignalPole(pole: THREE.Group, verticalGreen: boolean) {
  const axis = pole.userData.axis as 'vertical' | 'horizontal';
  const redOn = axis === 'vertical' ? !verticalGreen : verticalGreen;
  const greenOn = axis === 'vertical' ? verticalGreen : !verticalGreen;
  const red = pole.userData.redLens as THREE.Mesh;
  const green = pole.userData.greenLens as THREE.Mesh;
  (red.material as THREE.MeshBasicMaterial).color.setHex(redOn ? 0xff2222 : 0x440000);
  (green.material as THREE.MeshBasicMaterial).color.setHex(greenOn ? 0x33ff66 : 0x004411);
}

function updateLightsInGroup(group: THREE.Group, verticalGreen: boolean) {
  group.traverse((child) => {
    if (child instanceof THREE.Group && child.userData.axis) {
      updateSignalPole(child, verticalGreen);
    }
  });
}

const ROAD_COLOR = 0x2f2f2f;
const SIDEWALK_COLOR = 0x4a4a48;

function addMark(
  parent: THREE.Object3D,
  w: number,
  d: number,
  x: number,
  z: number,
  mat: THREE.Material,
  y = 0.013,
) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, y, z);
  parent.add(m);
}

export function buildCrossroadVisual(parent: THREE.Group, localZ: number): THREE.Group {
  const g = new THREE.Group();
  g.position.set(0, 0, localZ);
  g.userData.isCrossroad = true;
  g.userData.localZ = localZ;

  const lineMat = flatMat(0xffffff);
  const roadMat = flatMat(ROAD_COLOR);
  const swMat = flatMat(SIDEWALK_COLOR);
  const gapHalf = GAP_WIDTH / 2;
  const swX = WORLD.roadHalf + WORLD.sidewalkWidth / 2;
  const streetHalf = WORLD.sidewalkOuter + BUILDING_DEPTH + 0.5;
  const sw = WORLD.sidewalkWidth;

  addMark(g, streetHalf * 2, GAP_WIDTH, 0, 0, roadMat, 0.011);

  for (const corner of [
    { x: -swX, z: -gapHalf + sw / 2 },
    { x: swX, z: -gapHalf + sw / 2 },
    { x: -swX, z: gapHalf - sw / 2 },
    { x: swX, z: gapHalf - sw / 2 },
  ]) {
    addMark(g, sw, sw, corner.x, corner.z, swMat, 0.0115);
  }

  const stopW = 0.28;
  const edgeInset = WORLD.roadHalf - 0.05;

  addMark(g, WORLD.roadHalf * 2, stopW, 0, -gapHalf + 0.5, lineMat);
  addMark(g, WORLD.roadHalf * 2, stopW, 0, gapHalf - 0.5, lineMat);
  addMark(g, stopW, GAP_WIDTH - 0.6, -streetHalf + 0.65, 0, lineMat);
  addMark(g, stopW, GAP_WIDTH - 0.6, streetHalf - 0.65, 0, lineMat);

  for (const side of [-1, 1]) {
    addMark(g, 0.08, GAP_WIDTH - 0.15, side * edgeInset, 0, lineMat, 0.012);
  }

  for (let x = -streetHalf + 0.9; x < -WORLD.roadHalf - 0.4; x += 1.5) {
    addMark(g, 0.85, 0.1, x, 0, lineMat);
  }
  for (let x = WORLD.roadHalf + 0.4; x < streetHalf - 0.6; x += 1.5) {
    addMark(g, 0.85, 0.1, x, 0, lineMat);
  }

  const roadEdge = WORLD.roadHalf + 0.45;
  const sideEdge = WORLD.sidewalkOuter + 0.35;
  const stopLine = 0.55;
  const corners: Array<{ x: number; z: number; rot: number; axis: 'vertical' | 'horizontal' }> = [
    { x: -roadEdge, z: -gapHalf - stopLine, rot: 0, axis: 'vertical' },
    { x: roadEdge, z: -gapHalf - stopLine, rot: Math.PI, axis: 'vertical' },
    { x: -roadEdge, z: gapHalf + stopLine, rot: Math.PI, axis: 'vertical' },
    { x: roadEdge, z: gapHalf + stopLine, rot: 0, axis: 'vertical' },
    { x: -sideEdge, z: -0.55, rot: Math.PI / 2, axis: 'horizontal' },
    { x: sideEdge, z: -0.55, rot: -Math.PI / 2, axis: 'horizontal' },
    { x: -sideEdge, z: 0.55, rot: Math.PI / 2, axis: 'horizontal' },
    { x: sideEdge, z: 0.55, rot: -Math.PI / 2, axis: 'horizontal' },
  ];

  for (const c of corners) {
    const signal = makeSignalPole(c.axis);
    signal.position.set(c.x, 0, c.z);
    signal.rotation.y = c.rot;
    g.add(signal);
  }

  parent.add(g);
  return g;
}

function findCrossroadGroup(segment: THREE.Group, localZ: number): THREE.Group | undefined {
  for (const child of segment.children) {
    if (child.userData?.isCrossroad && child.userData.localZ === localZ) {
      return child as THREE.Group;
    }
  }
  return undefined;
}

export class CrossroadManager {
  private states = new Map<string, CrossroadState>();
  private active: CrossroadState[] = [];

  update(dt: number, pieces: RoadPiece[], segmentLength: number) {
    this.active = [];

    for (const piece of pieces) {
      const segmentWorldZ = piece.group.position.z;
      for (const localZ of getCrossroadLocalZs(segmentLength, segmentWorldZ)) {
        const worldZ = segmentWorldZ + localZ;
        const key = `${Math.round(worldZ * 2)}`;

        let state = this.states.get(key);
        if (!state) {
          state = { phase: 'vertical-green', timer: Math.random() * 2, worldZ };
          this.states.set(key, state);
        }
        state.worldZ = worldZ;

        state.timer += dt;
        const limit = state.phase === 'vertical-green' ? VERTICAL_GREEN_TIME : VERTICAL_RED_TIME;
        if (state.timer >= limit) {
          state.phase = state.phase === 'vertical-green' ? 'vertical-red' : 'vertical-green';
          state.timer = 0;
        }

        const group = findCrossroadGroup(piece.content, localZ);
        if (group) {
          updateLightsInGroup(group, state.phase === 'vertical-green');
        }

        this.active.push(state);
      }
    }
  }

  clear() {
    this.states.clear();
    this.active = [];
  }

  canMoveVertical(carZ: number, carVz: number): boolean {
    if (Math.abs(carVz) < 0.01) return true;
    for (const cross of this.active) {
      if (cross.phase !== 'vertical-red') continue;
      const stopZone = 5.5;
      if (carVz > 0 && carZ > cross.worldZ - stopZone && carZ < cross.worldZ + 1.2) return false;
      if (carVz < 0 && carZ < cross.worldZ + stopZone && carZ > cross.worldZ - 1.2) return false;
    }
    return true;
  }

  canMoveHorizontal(carZ: number, carX: number, carVx: number): boolean {
    if (Math.abs(carVx) < 0.01) return true;
    for (const cross of this.active) {
      if (cross.phase !== 'vertical-green') continue;
      if (Math.abs(carZ - cross.worldZ) > GAP_WIDTH * 0.55) continue;
      if (carVx > 0 && carX > -WORLD.roadHalf - 2 && carX < WORLD.roadHalf + 1) return false;
      if (carVx < 0 && carX < WORLD.roadHalf + 2 && carX > -WORLD.roadHalf - 1) return false;
    }
    return true;
  }

  shouldSpawnCrossTraffic(worldZ: number, playerZ: number): boolean {
    for (const cross of this.active) {
      if (Math.abs(cross.worldZ - worldZ) > 0.5) continue;
      if (cross.phase !== 'vertical-red') return false;
      if (cross.worldZ < playerZ + 15 || cross.worldZ > playerZ + 55) return false;
      return true;
    }
    return false;
  }

  getCrossroadZs(playerZ: number, ahead = 80): number[] {
    return this.active
      .filter((c) => c.worldZ > playerZ + 10 && c.worldZ < playerZ + ahead)
      .map((c) => c.worldZ);
  }

  isNearCrossroad(carZ: number, margin = 7): boolean {
    for (const cross of this.active) {
      if (Math.abs(carZ - cross.worldZ) < margin) return true;
    }
    return false;
  }
}
