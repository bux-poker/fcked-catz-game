import * as THREE from 'three';
import type { CatCharacter } from './types';

export interface CatRig {
  root: THREE.Group;
  body: THREE.Group;
  board: THREE.Group;
}

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

function addEars(parent: THREE.Group, fur: THREE.Material, inner: THREE.Material) {
  for (const side of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.22, 6), fur);
    ear.position.set(side * 0.2, 0.38, -0.02);
    ear.rotation.z = side * -0.35;
    ear.castShadow = true;
    parent.add(ear);

    const innerEar = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.12, 6), inner);
    innerEar.position.set(side * 0.2, 0.36, -0.01);
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
  const bridge = box(0.08, 0.05, 0.06, frame, 0, 0.06, 0.28);
  head.add(bridge);
  head.add(box(0.2, 0.1, 0.06, lens, -0.14, 0.06, 0.28));
  head.add(box(0.2, 0.1, 0.06, lens, 0.14, 0.06, 0.28));
  head.add(box(0.42, 0.04, 0.04, frame, 0, 0.1, 0.28));
}

function addCap(head: THREE.Group, color: string) {
  const c = mat(color);
  const crown = new THREE.Mesh(new THREE.SphereGeometry(0.34, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), c);
  crown.position.set(0, 0.18, 0);
  crown.castShadow = true;
  head.add(crown);
  head.add(box(0.5, 0.04, 0.22, c, 0, 0.12, 0.36));
  const logo = box(0.18, 0.06, 0.02, mat('#ffd60a'), 0, 0.2, 0.33);
  head.add(logo);
}

function addBeanie(head: THREE.Group, color: string) {
  const c = mat(color);
  const beanie = new THREE.Mesh(new THREE.SphereGeometry(0.33, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.62), c);
  beanie.position.set(0, 0.14, 0);
  beanie.castShadow = true;
  head.add(beanie);
  for (let i = 0; i < 8; i++) {
    const rib = box(0.04, 0.14, 0.44, mat('#000000', 1), 0, 0.12, 0);
    rib.rotation.y = (i / 8) * Math.PI;
    head.add(rib);
  }
}

function addBandana(head: THREE.Group, color: string) {
  const c = mat(color);
  const wrap = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.06, 8, 20), c);
  wrap.rotation.x = Math.PI / 2;
  wrap.position.set(0, 0.08, 0.05);
  wrap.castShadow = true;
  head.add(wrap);
  const knot = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), c);
  knot.position.set(0.28, 0.02, -0.12);
  head.add(knot);
}

function addHoodie(body: THREE.Group, color: string) {
  const c = mat(color);
  body.add(box(0.52, 0.42, 0.34, c, 0, 0.48, 0));
  const hood = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), c);
  hood.position.set(0, 0.72, -0.08);
  hood.rotation.x = -0.3;
  hood.castShadow = true;
  body.add(hood);
  body.add(box(0.04, 0.2, 0.04, mat('#333333'), -0.08, 0.5, 0.16));
  body.add(box(0.04, 0.2, 0.04, mat('#333333'), 0.08, 0.5, 0.16));
}

function addJacket(body: THREE.Group, primary: string, accent: string) {
  const p = mat(primary);
  const a = mat(accent);
  body.add(box(0.54, 0.4, 0.36, p, 0, 0.48, 0));
  body.add(box(0.54, 0.08, 0.37, a, 0, 0.72, 0));
  body.add(box(0.12, 0.3, 0.04, a, -0.2, 0.5, 0.17));
  body.add(box(0.12, 0.3, 0.04, a, 0.2, 0.5, 0.17));
  body.add(box(0.04, 0.34, 0.02, mat('#888888'), 0, 0.48, 0.19));
  body.add(box(0.16, 0.1, 0.38, p, -0.34, 0.5, 0));
  body.add(box(0.16, 0.1, 0.38, p, 0.34, 0.5, 0));
}

function addLegs(body: THREE.Group, fur: THREE.Material) {
  const poses = [
    { x: -0.14, z: 0.08, rx: 0.8 },
    { x: 0.14, z: 0.08, rx: 0.8 },
    { x: -0.14, z: -0.18, rx: -0.4 },
    { x: 0.14, z: -0.18, rx: -0.4 },
  ];
  for (const p of poses) {
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.18, 4, 8), fur);
    leg.position.set(p.x, 0.18, p.z);
    leg.rotation.x = p.rx;
    leg.castShadow = true;
    body.add(leg);
  }
}

function addArms(body: THREE.Group, fur: THREE.Material, outfit: THREE.Material) {
  const left = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.16, 4, 8), outfit);
  left.position.set(-0.32, 0.52, 0.05);
  left.rotation.z = 0.5;
  left.castShadow = true;
  body.add(left);

  const right = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.16, 4, 8), fur);
  right.position.set(0.32, 0.58, -0.1);
  right.rotation.z = -0.8;
  right.rotation.x = -0.3;
  right.castShadow = true;
  body.add(right);
}

function buildBoard(color: string, wheelColor: string): THREE.Group {
  const g = new THREE.Group();
  const deck = box(0.48, 0.07, 1.45, mat(color), 0, 0, 0);
  g.add(deck);
  const w = mat(wheelColor, 0.5);
  for (const [x, z] of [
    [-0.16, 0.5],
    [0.16, 0.5],
    [-0.16, -0.5],
    [0.16, -0.5],
  ]) {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.06, 12), w);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, -0.06, z);
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
  board.position.y = 0.1;

  const fur = mat(v.fur);
  const muzzleMat = mat(v.muzzle);
  const outfitMat = mat(v.outfitColor);

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.28, 6, 10), fur);
  torso.position.set(0, 0.42, 0);
  torso.castShadow = true;
  body.add(torso);

  const head = new THREE.Group();
  head.position.set(0, 0.72, 0.02);
  body.add(head);

  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.28, 14, 12), fur);
  skull.castShadow = true;
  head.add(skull);

  const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 10), muzzleMat);
  muzzle.position.set(0, -0.06, 0.18);
  muzzle.scale.set(1.1, 0.85, 0.9);
  head.add(muzzle);

  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), mat('#222222'));
  nose.position.set(0, -0.02, 0.28);
  head.add(nose);

  addEars(head, fur, muzzleMat);

  if (v.hasSunglasses) addSunglasses(head);

  if (v.headwear === 'cap') addCap(head, v.headwearColor);
  else if (v.headwear === 'beanie') addBeanie(head, v.headwearColor);
  else if (v.headwear === 'bandana') addBandana(head, v.headwearColor);

  if (v.hasEarring) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.05, 0.012, 6, 12),
      mat('#fbbf24', 0.3),
    );
    ring.position.set(-0.3, 0.02, 0.02);
    ring.rotation.y = Math.PI / 2;
    head.add(ring);
  }

  if (v.outfit === 'hoodie') addHoodie(body, v.outfitColor);
  else addJacket(body, v.outfitColor, v.outfitAccent ?? v.outfitColor);

  addLegs(body, outfitMat);
  addArms(body, fur, outfitMat);

  body.position.y = 0.22;
  body.rotation.x = -0.12;

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
