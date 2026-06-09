import * as THREE from 'three';
import { buildCatRig, disposeCatRig, SKATE_BODY_LEAN, type CatRig } from './catModel';
import { BUILDING_DEPTH } from './buildings';
import { CrossroadManager } from './crossroads';
import { buildRoad, recycleRoad, resetRoad, SEGMENT_LENGTH, type RoadPiece } from './road';
import type { AirTrickType, CatCharacter } from './types';
import { CONFIG } from './types';
import { InputManager, TouchSteering } from './input';
import { animatePedestrian, makePedestrian } from './pedestrians';
import { makeTrafficCar } from './vehicles';
import { buildRoadworksVisual, RoadworksManager } from './roadworks';
import { isInCenterGap, laneCenterX, laneForX, WORLD, type Lane } from './world';

type ObstacleKind = 'car' | 'car-cross' | 'roadworks' | 'pedestrian';

interface WorldObject {
  mesh: THREE.Object3D;
  kind: ObstacleKind;
  hit?: boolean;
}

export class Game {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(62, 1, 0.1, 250);
  private clock = new THREE.Clock();

  private player = new THREE.Group();
  private catRig: CatRig | null = null;
  private playerX = 0;
  private playerZ = 0;
  private groundY = 0.48;

  private speed = CONFIG.baseSpeed;
  private runTime = 0;
  private distance = 0;
  private score = 0;
  private lives = CONFIG.lives;
  private invuln = 0;
  private airborne = false;
  private jumpT = 0;
  private airTrick: AirTrickType | null = null;
  private trickT = 0;
  private jumpedFromRamp = false;

  private roadPieces: RoadPiece[] = [];
  private obstacles: WorldObject[] = [];
  private spawnZ = 40;
  private spawnCooldown = 0;
  private pedestrianCooldown = 0;
  private readonly spawnAheadMin = 38;
  private readonly spawnAheadMax = 105;
  private readonly minObstaclesAhead = 7;
  private readonly minPedestriansAhead = 4;
  private readonly carFollowGap = WORLD.carHalfLength * 2 + 1.4;
  private spawnedCrossTraffic = new Set<number>();
  private spawnedRoadworks = new Set<number>();
  private crossroadManager = new CrossroadManager();
  private roadworksManager = new RoadworksManager();
  private playing = false;

  private input: InputManager;
  private touchSteer: TouchSteering;

  onHud?: (lives: number, score: number) => void;
  onGameOver?: (score: number) => void;
  onTrick?: (name: string, points: number) => void;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x2f2f2f);
    this.renderer.shadowMap.enabled = true;

    this.input = new InputManager(canvas);
    this.touchSteer = new TouchSteering(canvas);

    this.input.onAction((a) => {
      if (a.type === 'ollie') this.tryOllie();
      else this.tryAirTrick(a.trick);
    });
    this.setupLights();
    this.setupWorld();
    this.setupPlayer();
    this.setupCamera();

    window.addEventListener('resize', () => this.resize());
    this.resize();
  }

  setCharacter(cat: CatCharacter) {
    if (this.catRig) {
      this.player.remove(this.catRig.root);
      disposeCatRig(this.catRig);
    }
    this.catRig = buildCatRig(cat);
    this.player.add(this.catRig.root);
  }

  start() {
    this.playing = true;
    this.runTime = 0;
    this.distance = 0;
    this.score = 0;
    this.lives = CONFIG.lives;
    this.speed = CONFIG.baseSpeed;
    this.invuln = 0;
    this.playerX = 0;
    this.playerZ = 0;
    this.airborne = false;
    this.jumpT = 0;
    this.airTrick = null;
    this.jumpedFromRamp = false;
    this.input.setAirborne(false);
    this.spawnCooldown = 0;
    this.pedestrianCooldown = 0;
    this.spawnedCrossTraffic.clear();
    this.spawnedRoadworks.clear();
    this.crossroadManager.clear();
    this.roadworksManager.clear();
    resetRoad(this.roadPieces);
    this.clearObstacles();
    this.seedObstacles();
    this.updatePlayerTransform();
    this.updateCamera();
    this.syncHud();
  }

  stop() {
    this.playing = false;
  }

  tick() {
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.renderer.render(this.scene, this.camera);

    if (!this.playing) return;

    this.runTime += dt;
    this.speed = Math.min(CONFIG.maxSpeed, CONFIG.baseSpeed + CONFIG.speedRamp * this.runTime);
    this.distance += this.speed * dt;
    this.score += Math.round(this.speed * dt * CONFIG.pointsPerMeter);

    const steer = this.touchSteer.steer || this.input.steer;
    const steerMul = this.airborne ? 0.45 : 1;
    this.playerX = THREE.MathUtils.clamp(
      this.playerX + steer * CONFIG.steerSpeed * steerMul * dt,
      -CONFIG.playHalfWidth,
      CONFIG.playHalfWidth,
    );

    this.playerZ += this.speed * dt;
    this.updateJump(dt);
    this.updateTrick(dt);
    this.updatePlayerTransform();
    recycleRoad(this.roadPieces, this.playerZ);
    this.crossroadManager.update(dt, this.roadPieces, SEGMENT_LENGTH);
    this.roadworksManager.update(dt, this.playerZ);
    this.updateSpawner(dt);
    this.updatePedestrianSpawner(dt);
    this.updateCrossTrafficSpawner();
    this.updateRoadworksSpawner();
    this.updateObstacles(dt);
    this.roadworksManager.updateVisuals(this.obstacles);
    this.checkCollisions();
    this.updateCamera();

    if (this.invuln > 0) this.invuln -= dt * 1000;
    this.syncHud();
  }

  private tryOllie() {
    if (!this.playing || this.airborne) return;
    this.airborne = true;
    this.jumpT = 0;
    this.airTrick = null;
    this.trickT = 0;
    this.jumpedFromRamp = this.jumpedFromRamp || this.isOnRamp();
    this.input.setAirborne(true);
  }

  private tryAirTrick(type: AirTrickType) {
    if (!this.playing || !this.airborne || this.airTrick) return;
    this.airTrick = type;
    this.trickT = 0;
  }

  private updateJump(dt: number) {
    if (!this.airborne) return;
    this.jumpT += dt;
    if (this.jumpT >= CONFIG.jumpDuration) {
      this.landJump();
    }
  }

  private landJump() {
    const rampBonus = this.jumpedFromRamp ? CONFIG.rampTrickBonus : 0;
    this.score += CONFIG.olliePoints;

    let popupName = 'OLLIE';
    let popupPts = CONFIG.olliePoints;

    if (this.airTrick) {
      this.score += CONFIG.trickPoints[this.airTrick];
      popupName = this.trickLabel(this.airTrick);
      popupPts = CONFIG.trickPoints[this.airTrick];
    }

    if (rampBonus > 0) {
      this.score += rampBonus;
      popupPts += rampBonus;
    }

    this.onTrick?.(popupName, popupPts);

    this.airborne = false;
    this.jumpT = 0;
    this.airTrick = null;
    this.jumpedFromRamp = false;
    this.input.setAirborne(false);
    this.resetTrickPose();
  }

  private trickLabel(trick: AirTrickType): string {
    const labels: Record<AirTrickType, string> = {
      kickflip: 'KICKFLIP',
      heelflip: 'HEELFLIP',
      tailgrab: 'TAIL GRAB',
      nosegrab: 'NOSE GRAB',
    };
    return labels[trick];
  }

  private isOnRamp(): boolean {
    const px = this.playerX;
    const pz = this.playerZ;
    for (const obj of this.obstacles) {
      if (obj.kind !== 'roadworks') continue;
      const rampX = obj.mesh.userData.rampX as number;
      const worksZ = obj.mesh.position.z;
      if (Math.abs(pz - worksZ) < 2.8 && Math.abs(px - rampX) < 1.1) return true;
    }
    return false;
  }

  private resetTrickPose() {
    if (!this.catRig) return;
    this.catRig.board.rotation.set(0, 0, 0);
    this.catRig.body.rotation.set(SKATE_BODY_LEAN, 0, 0);
  }

  private updateTrick(dt: number) {
    if (!this.airTrick || !this.catRig) return;
    this.trickT += dt;
    const t = Math.min(1, this.trickT / 0.35);
    const { board, body } = this.catRig;
    if (this.airTrick === 'kickflip') {
      board.rotation.z = t * Math.PI * 2;
    } else if (this.airTrick === 'heelflip') {
      board.rotation.z = -t * Math.PI * 2;
    } else if (this.airTrick === 'tailgrab') {
      body.rotation.x = SKATE_BODY_LEAN - 0.55 * Math.sin(t * Math.PI);
      body.rotation.z = 0.25 * Math.sin(t * Math.PI);
      board.rotation.x = 0.2 * Math.sin(t * Math.PI);
    } else if (this.airTrick === 'nosegrab') {
      body.rotation.x = SKATE_BODY_LEAN + 0.35 * Math.sin(t * Math.PI);
      body.rotation.z = -0.2 * Math.sin(t * Math.PI);
      board.rotation.x = -0.25 * Math.sin(t * Math.PI);
    }
  }

  private playerHeight(): number {
    if (!this.airborne) return this.groundY;
    const t = this.jumpT / CONFIG.jumpDuration;
    return this.groundY + Math.sin(t * Math.PI) * CONFIG.jumpHeight;
  }

  private updatePlayerTransform() {
    this.player.position.set(this.playerX, this.playerHeight(), this.playerZ);
    if (this.catRig && this.airTrick !== 'tailgrab' && this.airTrick !== 'nosegrab') {
      const steer = this.touchSteer.steer || this.input.steer;
      this.catRig.body.rotation.z = THREE.MathUtils.lerp(
        this.catRig.body.rotation.z,
        steer * 0.35,
        0.15,
      );
    }
    if (this.invuln > 0) {
      this.player.visible = Math.floor(this.invuln / 80) % 2 === 0;
    } else {
      this.player.visible = true;
    }
  }

  private updateCamera() {
    const camX = this.playerX * 0.25;
    const camY = 6.5;
    const camBack = 9;
    const lookAhead = 58;

    this.camera.position.set(camX, camY, this.playerZ - camBack);
    this.camera.lookAt(camX, 0.6, this.playerZ + lookAhead);
  }

  private seedObstacles() {
    this.spawnZ = this.playerZ + this.spawnAheadMin;
    const horizon = this.playerZ + this.spawnAheadMax;
    while (this.spawnZ < horizon) {
      this.spawnEntry(this.spawnZ);
      this.spawnZ += 16 + Math.random() * 22;
    }
    for (let z = 25; z < horizon; z += 12 + Math.random() * 10) {
      this.spawnPedestrianGroup(z);
    }
  }

  private obstaclesAhead(): number {
    return this.obstacles.filter(
      (o) => o.mesh.position.z > this.playerZ + 8,
    ).length;
  }

  private updateSpawner(dt: number) {
    this.spawnCooldown -= dt;

    const minZ = this.playerZ + this.spawnAheadMin;
    if (this.spawnZ < minZ) this.spawnZ = minZ;

    const horizon = this.playerZ + this.spawnAheadMax;
    const needMore = this.obstaclesAhead() < this.minObstaclesAhead;

    if (!needMore && this.spawnCooldown > 0) return;
    if (this.spawnZ >= horizon) return;

    this.spawnEntry(this.spawnZ);
    this.spawnZ += 16 + Math.random() * 22;

    const t = (this.speed - CONFIG.baseSpeed) / (CONFIG.maxSpeed - CONFIG.baseSpeed);
    this.spawnCooldown = needMore ? 0 : THREE.MathUtils.lerp(1.6, 0.55, t);
  }

  private spawnEntry(z: number) {
    const roll = Math.random();
    if (roll < 0.22) {
      this.spawnPedestrianGroup(z);
      return;
    }
    if (Math.random() < 0.38) {
      this.spawnTrafficCar(z, 'left');
      this.spawnTrafficCar(z + THREE.MathUtils.randFloat(1.5, 4), 'right');
    } else {
      this.spawnTrafficCar(z, Math.random() > 0.5 ? 'left' : 'right');
    }
    if (Math.random() < 0.55) {
      this.spawnPedestrianGroup(z + THREE.MathUtils.randFloat(-8, 8));
    }
  }

  private pedestriansAhead(): number {
    return this.obstacles.filter(
      (o) => o.kind === 'pedestrian' && o.mesh.position.z > this.playerZ + 5,
    ).length;
  }

  private updatePedestrianSpawner(dt: number) {
    this.pedestrianCooldown -= dt;
    if (this.pedestrianCooldown > 0) return;
    if (this.pedestriansAhead() >= 8) return;

    const z = this.playerZ + 35 + Math.random() * 65;
    this.spawnPedestrianGroup(z);

    const needMore = this.pedestriansAhead() < this.minPedestriansAhead;
    this.pedestrianCooldown = needMore ? 0.25 : 0.55 + Math.random() * 0.65;
  }

  private spawnTrafficCar(z: number, lane: Lane) {
    const oncoming = lane === 'left';
    const car = makeTrafficCar(oncoming ? 'oncoming' : 'away');
    car.position.set(oncoming ? WORLD.leftLane : WORLD.rightLane, 0, z);
    const vz = oncoming ? -18 : 11;
    car.userData.vz = vz;
    car.userData.baseVz = vz;
    car.userData.vx = 0;
    car.userData.lane = lane;
    this.obstacles.push({ mesh: car, kind: 'car' });
    this.scene.add(car);
  }

  private spawnPedestrianGroup(z: number) {
    const onLeft = Math.random() > 0.5;
    const baseX = onLeft ? WORLD.leftSidewalk : WORLD.rightSidewalk;
    const asPair = Math.random() < 0.48;
    const count = asPair ? 2 : 1;
    const speed = 2.2 + Math.random() * 2.2;

    for (let i = 0; i < count; i++) {
      const ped = makePedestrian();
      const xOffset = asPair ? (i === 0 ? -0.32 : 0.32) : 0;
      const zOffset = asPair ? i * 0.55 : 0;
      ped.position.set(baseX + xOffset, 0, z + zOffset);
      ped.rotation.y = 0;
      ped.userData.vz = speed;
      this.obstacles.push({ mesh: ped, kind: 'pedestrian' });
      this.scene.add(ped);
    }
  }

  private updateCrossTrafficSpawner() {
    for (const worldZ of this.crossroadManager.getCrossroadZs(this.playerZ)) {
      const key = Math.round(worldZ * 2) / 2;
      if (this.spawnedCrossTraffic.has(key)) continue;
      if (!this.crossroadManager.shouldSpawnCrossTraffic(worldZ, this.playerZ)) continue;
      if (Math.random() > 0.55) continue;

      this.spawnCrossTraffic(worldZ);
      this.spawnedCrossTraffic.add(key);
    }

    for (const key of this.spawnedCrossTraffic) {
      if (key < this.playerZ - 50) this.spawnedCrossTraffic.delete(key);
    }
  }

  private updateRoadworksSpawner() {
    const z = this.roadworksManager.shouldSpawn(this.playerZ);
    if (z === null) return;
    const key = Math.round(z);
    if (this.spawnedRoadworks.has(key)) return;

    const lane = this.roadworksManager.laneForSite(z);
    const works = buildRoadworksVisual(lane);
    works.position.set(0, 0, z);
    this.obstacles.push({ mesh: works, kind: 'roadworks' });
    this.scene.add(works);
    this.spawnedRoadworks.add(key);

    for (const k of this.spawnedRoadworks) {
      if (k < this.playerZ - 60) this.spawnedRoadworks.delete(k);
    }
  }

  private spawnCrossTraffic(z: number) {
    const streetEdge = WORLD.sidewalkOuter + BUILDING_DEPTH + 1.6;
    const side = Math.random() > 0.5 ? 1 : -1;
    const car = makeTrafficCar('cross');
    car.position.set(side * streetEdge, 0, z + THREE.MathUtils.randFloatSpread(0.4));
    car.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
    car.userData.vx = -side * 13;
    car.userData.baseVx = car.userData.vx;
    car.userData.vz = 0;
    this.obstacles.push({ mesh: car, kind: 'car-cross' });
    this.scene.add(car);
  }

  private updateObstacles(dt: number) {
    for (const obj of this.obstacles) {
      if (obj.kind === 'car') {
        const baseVz = (obj.mesh.userData.baseVz as number) ?? 0;
        const lane = obj.mesh.userData.lane as Lane;
        const carZ = obj.mesh.position.z;
        const crossOk = this.crossroadManager.canMoveVertical(carZ, baseVz);
        const works = this.roadworksManager.resolveCarControl(carZ, lane, baseVz);
        let vz = crossOk && works.canMove ? baseVz : 0;
        vz = this.applyFollowGap(obj, lane, vz);
        obj.mesh.position.z += vz * dt;

        const homeX = laneCenterX(lane);
        this.updateCarLaneX(obj, works, homeX, dt);
      } else if (obj.kind === 'car-cross') {
        const baseVx = (obj.mesh.userData.baseVx as number) ?? 0;
        const vx = this.crossroadManager.canMoveHorizontal(
          obj.mesh.position.z,
          obj.mesh.position.x,
          baseVx,
        )
          ? baseVx
          : 0;
        obj.mesh.position.x += vx * dt;
      } else if (obj.kind === 'pedestrian') {
        const vz = (obj.mesh.userData.vz as number) ?? 0;
        obj.mesh.position.z += vz * dt;
      }
      if (obj.kind === 'pedestrian') animatePedestrian(obj.mesh, dt);
      if (obj.mesh.position.z < this.playerZ - 35) {
        this.scene.remove(obj.mesh);
        obj.hit = true;
      }
      if (obj.kind === 'car-cross' && Math.abs(obj.mesh.position.x) > 12) {
        this.scene.remove(obj.mesh);
        obj.hit = true;
      }
    }
    this.obstacles = this.obstacles.filter((o) => !o.hit);
  }

  private applyFollowGap(car: WorldObject, lane: Lane, vz: number): number {
    if (Math.abs(vz) < 0.01) return 0;

    const carZ = car.mesh.position.z;
    for (const other of this.obstacles) {
      if (other.kind !== 'car' || other === car) continue;
      if ((other.mesh.userData.lane as Lane) !== lane) continue;

      const otherZ = other.mesh.position.z;
      if (vz < 0) {
        if (otherZ >= carZ - 0.2) continue;
        if (carZ - otherZ < this.carFollowGap) return 0;
      } else {
        if (otherZ <= carZ + 0.2) continue;
        if (otherZ - carZ < this.carFollowGap) return 0;
      }
    }
    return vz;
  }

  private updateCarLaneX(
    car: WorldObject,
    works: { divert: boolean; divertX: number; pastSite: boolean },
    homeX: number,
    dt: number,
  ) {
    const carZ = car.mesh.position.z;
    const nearCross = this.crossroadManager.isNearCrossroad(carZ, 8);

    if (nearCross || works.pastSite || !works.divert) {
      car.mesh.position.x = homeX;
      car.mesh.userData.worksDiverted = false;
      return;
    }

    car.mesh.userData.worksDiverted = true;
    car.mesh.position.x = THREE.MathUtils.lerp(car.mesh.position.x, works.divertX, dt * 3.5);
  }

  private checkCollisions() {
    const px = this.playerX;
    const pz = this.playerZ;
    const py = this.playerHeight();

    if (this.invuln <= 0 && isInCenterGap(px) && this.carsFlankingCenter(pz)) {
      this.takeHit();
      return;
    }

    for (const obj of this.obstacles) {
      const dx = Math.abs(obj.mesh.position.x - px);
      const dz = Math.abs(obj.mesh.position.z - pz);

      if (obj.kind === 'roadworks') {
        const lane = obj.mesh.userData.lane as Lane;
        const holeX = obj.mesh.userData.holeX as number;
        const rampX = obj.mesh.userData.rampX as number;
        const worksZ = obj.mesh.position.z;

        if (dz < 2.8 && Math.abs(px - rampX) < 1.1) {
          this.jumpedFromRamp = true;
          if (!this.airborne && py < 1.1) {
            this.tryOllie();
          }
          continue;
        }

        if (this.invuln > 0) continue;

        const playerLane = laneForX(px);
        if (
          !this.airborne &&
          playerLane === lane &&
          Math.abs(pz - worksZ) < 1.4 &&
          Math.abs(px - holeX) < 1.15 &&
          py < 1.2
        ) {
          this.takeHit();
          continue;
        }

        if (!this.airborne && dz < 3.2 && dx < 1.35 && Math.abs(px - holeX) > 0.5 && py < 1.3) {
          this.takeHit();
        }
        continue;
      }

      if (this.invuln > 0) continue;

      if (obj.kind === 'car') {
        if (dz < WORLD.carHalfLength + 0.3 && dx < WORLD.carHalfWidth + 0.35 && py < 1.35) {
          this.takeHit();
          obj.hit = true;
          this.scene.remove(obj.mesh);
        }
        continue;
      }

      if (obj.kind === 'pedestrian') {
        if (dx < WORLD.pedestrianHalfWidth && dz < WORLD.pedestrianHalfLength && py < 1.2) {
          this.takeHit();
          obj.hit = true;
          this.scene.remove(obj.mesh);
        }
        continue;
      }

      if (dx < WORLD.carHalfWidth && dz < WORLD.carHalfLength && py < 1.35) {
        this.takeHit();
        obj.hit = true;
        this.scene.remove(obj.mesh);
      }
    }
  }

  private carsFlankingCenter(playerZ: number): boolean {
    let leftNear = false;
    let rightNear = false;
    for (const obj of this.obstacles) {
      if (obj.kind !== 'car') continue;
      if (Math.abs(obj.mesh.position.z - playerZ) > WORLD.carHalfLength + 0.5) continue;
      const lane = obj.mesh.userData.lane as Lane;
      if (lane === 'left') leftNear = true;
      if (lane === 'right') rightNear = true;
    }
    return leftNear && rightNear;
  }

  private takeHit() {
    this.lives -= 1;
    this.invuln = CONFIG.invulnMs;
    if (this.lives <= 0) {
      this.playing = false;
      this.onGameOver?.(this.score);
    }
  }

  private clearObstacles() {
    for (const o of this.obstacles) this.scene.remove(o.mesh);
    this.obstacles = [];
  }

  private syncHud() {
    this.onHud?.(this.lives, this.score);
  }

  private setupLights() {
    this.scene.background = new THREE.Color(0x87ceeb);
    this.scene.fog = null;

    const hemi = new THREE.HemisphereLight(0xffffff, 0x445533, 1.1);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xffffff, 1.4);
    sun.position.set(8, 24, 6);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    this.scene.add(sun);
  }

  private setupWorld() {
    this.roadPieces = buildRoad(this.scene);
  }

  private setupPlayer() {
    this.scene.add(this.player);
  }

  private setupCamera() {
    this.camera.position.set(0, 6.5, -9);
  }

  private resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }
}
