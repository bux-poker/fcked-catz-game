import * as THREE from 'three';
import type { CatCharacter } from './types';

export interface CatRig {
  root: THREE.Group;
  body: THREE.Group;
  board: THREE.Group;
}

/** Forward crouch while riding — used by game for tricks and steering reset. */
export const SKATE_BODY_LEAN = -0.34;

function mat(color: string, roughness = 0.85): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.05 });
}

function box(
  w: number,
  h: number,
  d: number,
  material: THREE.Material,
  x = 0,
  y = 0,
  z = 0,
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  return mesh;
}

function limb(
  radius: number,
  length: number,
  material: THREE.Material,
  x: number,
  y: number,
  z: number,
  rx = 0,
  ry = 0,
  rz = 0,
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(radius, length, 5, 10), material);
  mesh.position.set(x, y, z);
  mesh.rotation.set(rx, ry, rz);
  mesh.castShadow = true;
  return mesh;
}

function addEars(parent: THREE.Group, fur: THREE.Material, inner: THREE.Material) {
  for (const side of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.26, 6), fur);
    ear.position.set(side * 0.22, 0.44, -0.02);
    ear.rotation.z = side * -0.35;
    ear.castShadow = true;
    parent.add(ear);

    const innerEar = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.14, 6), inner);
    innerEar.position.set(side * 0.22, 0.42, -0.01);
    innerEar.rotation.z = side * -0.35;
    parent.add(innerEar);
  }
}

function addSunglasses(head: THREE.Group) {
  const frame = mat('#111111', 0.4);
  const lens = new THREE.MeshStandardMaterial({
    color: '#3d2817',
    roughness: 0.2,
    metalness: 0.3,
    transparent: true,
    opacity: 0.85,
  });
  head.add(box(0.09, 0.055, 0.07, frame, 0, 0.07, 0.32));
  head.add(box(0.22, 0.11, 0.07, lens, -0.15, 0.07, 0.32));
  head.add(box(0.22, 0.11, 0.07, lens, 0.15, 0.07, 0.32));
  head.add(box(0.46, 0.045, 0.05, frame, 0, 0.11, 0.32));
}

function addCap(head: THREE.Group, color: string) {
  const c = mat(color);
  const crown = new THREE.Mesh(new THREE.SphereGeometry(0.36, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), c);
  crown.position.set(0, 0.2, 0);
  crown.castShadow = true;
  head.add(crown);
  head.add(box(0.54, 0.045, 0.24, c, 0, 0.14, 0.4));
  head.add(box(0.2, 0.065, 0.02, mat('#ffd60a'), 0, 0.22, 0.37));
}

function addBeanie(head: THREE.Group, color: string) {
  const c = mat(color);
  const beanie = new THREE.Mesh(new THREE.SphereGeometry(0.35, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.62), c);
  beanie.position.set(0, 0.16, 0);
  beanie.castShadow = true;
  head.add(beanie);
  for (let i = 0; i < 8; i++) {
    const rib = box(0.045, 0.16, 0.48, mat('#000000', 1), 0, 0.14, 0);
    rib.rotation.y = (i / 8) * Math.PI;
    head.add(rib);
  }
}

function addBandana(head: THREE.Group, color: string) {
  const c = mat(color);
  const wrap = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.065, 8, 20), c);
  wrap.rotation.x = Math.PI / 2;
  wrap.position.set(0, 0.09, 0.05);
  wrap.castShadow = true;
  head.add(wrap);
  const knot = new THREE.Mesh(new THREE.SphereGeometry(0.085, 8, 8), c);
  knot.position.set(0.3, 0.02, -0.13);
  head.add(knot);
}

function addHoodie(body: THREE.Group, color: string) {
  const c = mat(color);
  body.add(box(0.56, 0.48, 0.36, c, 0, 0.58, -0.02));
  const hood = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), c);
  hood.position.set(0, 0.86, -0.1);
  hood.rotation.x = -0.3;
  hood.castShadow = true;
  body.add(hood);
  body.add(box(0.045, 0.22, 0.045, mat('#333333'), -0.09, 0.6, 0.17));
  body.add(box(0.045, 0.22, 0.045, mat('#333333'), 0.09, 0.6, 0.17));
}

function addJacket(body: THREE.Group, primary: string, accent: string) {
  const p = mat(primary);
  const a = mat(accent);
  body.add(box(0.58, 0.46, 0.38, p, 0, 0.58, -0.02));
  body.add(box(0.58, 0.09, 0.39, a, 0, 0.84, -0.02));
  body.add(box(0.13, 0.34, 0.045, a, -0.21, 0.6, 0.18));
  body.add(box(0.13, 0.34, 0.045, a, 0.21, 0.6, 0.18));
  body.add(box(0.045, 0.38, 0.02, mat('#888888'), 0, 0.58, 0.2));
  body.add(box(0.17, 0.11, 0.4, p, -0.36, 0.6, -0.02));
  body.add(box(0.17, 0.11, 0.4, p, 0.36, 0.6, -0.02));
}

function addSkateLegs(body: THREE.Group, fur: THREE.Material, shoe: THREE.Material) {
  const deckY = -0.34;

  // Front leg — bent over nose of board
  body.add(limb(0.085, 0.22, fur, -0.1, 0.28, 0.08, 0.55, 0, -0.2));
  body.add(limb(0.075, 0.2, fur, -0.12, 0.08, 0.28, 1.05, 0.15, -0.35));
  body.add(box(0.14, 0.06, 0.22, shoe, -0.14, deckY + 0.03, 0.38));

  // Back leg — deep bend on tail
  body.add(limb(0.09, 0.24, fur, 0.11, 0.3, -0.12, 0.75, 0, 0.15));
  body.add(limb(0.08, 0.22, fur, 0.14, 0.06, -0.28, 1.15, -0.1, 0.25));
  body.add(box(0.15, 0.06, 0.24, shoe, 0.15, deckY + 0.03, -0.4));
}

function addSkateArms(body: THREE.Group, fur: THREE.Material, outfit: THREE.Material) {
  // Lead arm — slightly forward for balance
  body.add(limb(0.065, 0.2, outfit, 0.34, 0.62, 0.14, -0.15, 0.1, -0.55));
  // Rear arm — out to the side
  body.add(limb(0.065, 0.2, fur, -0.36, 0.58, -0.06, 0.1, -0.05, 0.75));
}

function buildBoard(color: string, wheelColor: string): THREE.Group {
  const g = new THREE.Group();
  const deck = box(0.5, 0.08, 1.55, mat(color), 0, 0.1, 0);
  g.add(deck);

  const grip = box(0.44, 0.015, 1.2, mat('#2a2a2a', 1), 0, 0.145, 0.02);
  g.add(grip);

  const w = mat(wheelColor, 0.5);
  for (const [x, z] of [
    [-0.17, 0.55],
    [0.17, 0.55],
    [-0.17, -0.55],
    [0.17, -0.55],
  ]) {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.095, 0.065, 12), w);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, 0.04, z);
    wheel.castShadow = true;
    g.add(wheel);
  }
  return g;
}

export function buildCatRig(cat: CatCharacter): CatRig {
  const v = cat.visuals;
  const root = new THREE.Group();
  const body = new THREE.Group();
  const board = buildBoard(v.boardColor, v.wheelColor);

  const fur = mat(v.fur);
  const muzzleMat = mat(v.muzzle);
  const outfitMat = mat(v.outfitColor);
  const shoeMat = mat('#2b2b2b', 0.9);

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 0.42, 6, 12), fur);
  torso.position.set(0, 0.58, -0.04);
  torso.castShadow = true;
  body.add(torso);

  const head = new THREE.Group();
  head.position.set(0, 0.98, 0.04);
  head.rotation.x = 0.12;
  body.add(head);

  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.3, 14, 12), fur);
  skull.castShadow = true;
  head.add(skull);

  const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 10), muzzleMat);
  muzzle.position.set(0, -0.07, 0.2);
  muzzle.scale.set(1.1, 0.85, 0.9);
  head.add(muzzle);

  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), mat('#222222'));
  nose.position.set(0, -0.02, 0.3);
  head.add(nose);

  addEars(head, fur, muzzleMat);

  if (v.hasSunglasses) addSunglasses(head);

  if (v.headwear === 'cap') addCap(head, v.headwearColor);
  else if (v.headwear === 'beanie') addBeanie(head, v.headwearColor);
  else if (v.headwear === 'bandana') addBandana(head, v.headwearColor);

  if (v.hasEarring) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.055, 0.013, 6, 12),
      mat('#fbbf24', 0.3),
    );
    ring.position.set(-0.32, 0.02, 0.02);
    ring.rotation.y = Math.PI / 2;
    head.add(ring);
  }

  if (v.outfit === 'hoodie') addHoodie(body, v.outfitColor);
  else addJacket(body, v.outfitColor, v.outfitAccent ?? v.outfitColor);

  addSkateLegs(body, fur, shoeMat);
  addSkateArms(body, fur, outfitMat);

  body.position.set(0, 0.56, 0);
  body.rotation.x = SKATE_BODY_LEAN;

  root.add(board, body);
  return { root, body, board };
}

export function disposeCatRig(rig: CatRig) {
  rig.root.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      obj.geometry.dispose();
      const m = obj.material;
      if (Array.isArray(m)) m.forEach((x) => x.dispose());
      else m.dispose();
    }
  });
}
