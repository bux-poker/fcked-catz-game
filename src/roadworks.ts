import * as THREE from 'three';
import { laneCenterX, oppositeLane, WORLD, type Lane } from './world';

export const ROADWORKS_LENGTH = 6;
export const ROADWORKS_SPACING = 110;
const FIRST_ROADWORKS_Z = 55;
const CROSSROAD_CLEARANCE = 28;
const CROSSROAD_SPACING = 160;
const FIRST_CROSSROAD_Z = 80;
const LIGHT_CYCLE = 6;
const STOP_MARGIN = 2.2;

export type RoadworksPhase = 'lane-open' | 'lane-closed';

export interface RoadworksCarControl {
  canMove: boolean;
  divert: boolean;
  divertX: number;
  pastSite: boolean;
}

interface RoadworksSite {
  worldZ: number;
  lane: Lane;
  phase: RoadworksPhase;
  timer: number;
}

function flatMat(color: number): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide });
}

function stripeMat(red: boolean): THREE.MeshBasicMaterial {
  return flatMat(red ? 0xe63946 : 0xf1f1f1);
}

function addBox(
  parent: THREE.Object3D,
  w: number,
  h: number,
  d: number,
  x: number,
  y: number,
  z: number,
  mat: THREE.Material,
) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  parent.add(m);
}

function addBarrierPanel(parent: THREE.Object3D, x: number, z: number, rotY: number) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rotY;

  addBox(g, 0.08, 0.85, 1.1, 0, 0.42, 0, flatMat(0x222222));
  for (let i = 0; i < 5; i++) {
    addBox(g, 1.05, 0.14, 0.18, 0, 0.35 + (i % 2) * 0.14, -0.42 + i * 0.22, stripeMat(i % 2 === 0));
  }
  parent.add(g);
}

function makeTempSignal(): THREE.Group {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.07, 2.2, 8),
    flatMat(0x333333),
  );
  pole.position.y = 1.1;
  g.add(pole);

  const housing = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.62, 0.18), flatMat(0x1a1a1a));
  housing.position.y = 2.05;
  g.add(housing);

  const red = new THREE.Mesh(new THREE.CircleGeometry(0.08, 12), flatMat(0x440000));
  red.position.set(0, 2.2, 0.1);
  g.add(red);

  const green = new THREE.Mesh(new THREE.CircleGeometry(0.08, 12), flatMat(0x004411));
  green.position.set(0, 1.85, 0.1);
  g.add(green);

  g.userData.redLens = red;
  g.userData.greenLens = green;
  return g;
}

function updateTempSignal(pole: THREE.Group, greenLit: boolean) {
  const red = pole.userData.redLens as THREE.Mesh;
  const green = pole.userData.greenLens as THREE.Mesh;
  (red.material as THREE.MeshBasicMaterial).color.setHex(greenLit ? 0x440000 : 0xff2222);
  (green.material as THREE.MeshBasicMaterial).color.setHex(greenLit ? 0x33ff66 : 0x004411);
}

export function buildRoadworksVisual(lane: Lane): THREE.Group {
  const g = new THREE.Group();
  g.userData.lane = lane;
  g.userData.isRoadworks = true;

  const laneX = lane === 'left' ? WORLD.leftLane : WORLD.rightLane;
  const openSide = lane === 'left' ? 1 : -1;
  const roadMat = flatMat(0x2f2f2f);
  const pitMat = flatMat(0x1a1a1a);
  const woodMat = flatMat(0x8b6914);

  addBox(g, WORLD.laneHalfWidth * 1.9, 0.02, ROADWORKS_LENGTH, laneX, 0.01, 0, roadMat);

  addBox(g, 2.1, 0.35, 2.2, laneX, -0.12, 0, pitMat);

  const barrierOffsets: Array<{ x: number; z: number; rot: number }> = [
    { x: laneX - 1.05, z: -2.4, rot: 0 },
    { x: laneX + 1.05, z: -2.4, rot: 0 },
    { x: laneX - 1.05, z: 2.4, rot: Math.PI },
    { x: laneX + 1.05, z: 2.4, rot: Math.PI },
    { x: laneX, z: -3.1, rot: Math.PI / 2 },
    { x: laneX, z: 3.1, rot: -Math.PI / 2 },
  ];
  for (const b of barrierOffsets) {
    addBarrierPanel(g, b.x, b.z, b.rot);
  }

  const rampX = laneX + openSide * 0.95;
  for (const [i, zOff] of [
    [-0.55, -0.12],
    [0.55, 0.12],
  ] as const) {
    const plank = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.07, 2.4), woodMat);
    plank.position.set(rampX, 0.18 + i * 0.02, zOff);
    plank.rotation.x = -0.38;
    plank.rotation.z = openSide * 0.08;
    g.add(plank);
  }

  const worksSignal = makeTempSignal();
  worksSignal.position.set(laneX + openSide * 1.6, 0, -3.6);
  worksSignal.rotation.y = openSide > 0 ? -Math.PI / 2 : Math.PI / 2;
  g.userData.worksSignal = worksSignal;
  g.add(worksSignal);

  const clearSignal = makeTempSignal();
  clearSignal.position.set(laneX - openSide * 1.6, 0, 3.6);
  clearSignal.rotation.y = openSide > 0 ? Math.PI / 2 : -Math.PI / 2;
  g.userData.clearSignal = clearSignal;
  g.add(clearSignal);

  g.userData.holeX = laneX;
  g.userData.rampX = rampX;
  return g;
}

export function getRoadworksCentersInRange(z0: number, z1: number): number[] {
  const centers: number[] = [];
  let k = Math.floor((z0 - FIRST_ROADWORKS_Z - ROADWORKS_LENGTH) / ROADWORKS_SPACING);
  if (k < 0) k = 0;
  let z = FIRST_ROADWORKS_Z + k * ROADWORKS_SPACING;
  while (z <= z1 + ROADWORKS_LENGTH / 2) {
    if (z >= z0 - ROADWORKS_LENGTH / 2) centers.push(z);
    z += ROADWORKS_SPACING;
  }
  return centers;
}

export class RoadworksManager {
  private sites = new Map<string, RoadworksSite>();
  private active: RoadworksSite[] = [];

  update(dt: number, playerZ: number) {
    this.active = [];

    for (const worldZ of getRoadworksCentersInRange(playerZ - 20, playerZ + 120)) {
      const key = `${Math.round(worldZ)}`;
      let site = this.sites.get(key);
      if (!site) {
        const lane: Lane = this.laneForSite(worldZ);
        site = { worldZ, lane, phase: 'lane-closed', timer: Math.random() * 2 };
        this.sites.set(key, site);
      }

      site.timer += dt;
      if (site.timer >= LIGHT_CYCLE) {
        site.phase = site.phase === 'lane-closed' ? 'lane-open' : 'lane-closed';
        site.timer = 0;
      }

      this.active.push(site);
    }
  }

  clear() {
    this.sites.clear();
    this.active = [];
  }

  getActiveSites(): RoadworksSite[] {
    return this.active;
  }

  resolveCarControl(carZ: number, lane: Lane, vz: number): RoadworksCarControl {
    const free = { canMove: true, divert: false, divertX: 0, pastSite: false };
    if (Math.abs(vz) < 0.01) return free;

    for (const site of this.active) {
      const worksLane = site.lane;
      const clearLane = oppositeLane(worksLane);
      const half = ROADWORKS_LENGTH / 2;
      const influence = half + STOP_MARGIN + 9;
      if (Math.abs(carZ - site.worldZ) > influence) continue;

      const worksGreen = site.phase === 'lane-open';
      const pastSite =
        vz < 0 ? carZ < site.worldZ - half - 1 : carZ > site.worldZ + half + 1;
      if (pastSite) return { ...free, pastSite: true };

      if (lane === worksLane) {
        if (worksGreen) {
          const inDivertZone = this.inDivertZone(carZ, site.worldZ);
          return {
            canMove: true,
            divert: inDivertZone,
            divertX: laneCenterX(clearLane),
            pastSite: false,
          };
        }
        if (this.shouldStopBefore(carZ, site.worldZ, vz)) {
          return { canMove: false, divert: false, divertX: 0, pastSite: false };
        }
        return free;
      }

      if (lane === clearLane) {
        if (worksGreen && this.shouldStopBefore(carZ, site.worldZ, vz)) {
          return { canMove: false, divert: false, divertX: 0, pastSite: false };
        }
        return free;
      }
    }

    return free;
  }

  private inDivertZone(carZ: number, siteZ: number): boolean {
    return Math.abs(carZ - siteZ) <= ROADWORKS_LENGTH / 2 + 1.5;
  }

  private shouldStopBefore(carZ: number, siteZ: number, vz: number): boolean {
    const half = ROADWORKS_LENGTH / 2;
    const stopOncoming = siteZ + half + STOP_MARGIN;
    const stopAway = siteZ - half - STOP_MARGIN;
    if (vz < 0) return carZ <= stopOncoming && carZ > siteZ - half - 1;
    if (vz > 0) return carZ >= stopAway && carZ < siteZ + half + 1;
    return false;
  }

  updateVisuals(obstacles: Array<{ mesh: THREE.Object3D; kind: string }>) {
    for (const obj of obstacles) {
      if (obj.kind !== 'roadworks') continue;
      const lane = obj.mesh.userData.lane as Lane;
      const z = obj.mesh.position.z;
      let worksGreen = false;
      for (const site of this.active) {
        if (site.lane === lane && Math.abs(z - site.worldZ) < 0.5) {
          worksGreen = site.phase === 'lane-open';
          break;
        }
      }
      const worksSignal = obj.mesh.userData.worksSignal as THREE.Group | undefined;
      const clearSignal = obj.mesh.userData.clearSignal as THREE.Group | undefined;
      if (worksSignal) updateTempSignal(worksSignal, worksGreen);
      if (clearSignal) updateTempSignal(clearSignal, !worksGreen);
    }
  }

  laneForSite(worldZ: number): Lane {
    return Math.floor(worldZ / ROADWORKS_SPACING) % 2 === 0 ? 'left' : 'right';
  }

  shouldSpawn(playerZ: number): number | null {
    for (const z of getRoadworksCentersInRange(playerZ + 40, playerZ + 95)) {
      if (z <= playerZ + 38 || z >= playerZ + 90) continue;
      if (this.nearCrossroad(z)) continue;
      return z;
    }
    return null;
  }

  private nearCrossroad(z: number): boolean {
    if (z < FIRST_CROSSROAD_Z - CROSSROAD_CLEARANCE) return false;
    const crossZ =
      FIRST_CROSSROAD_Z +
      Math.round((z - FIRST_CROSSROAD_Z) / CROSSROAD_SPACING) * CROSSROAD_SPACING;
    return Math.abs(z - crossZ) < CROSSROAD_CLEARANCE;
  }
}
