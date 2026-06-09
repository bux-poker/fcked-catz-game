import * as THREE from 'three';
import { buildCrossroadVisual, clipOutCrossroads, getCrossroadLocalZs } from './crossroads';
import { WORLD } from './world';

/** Muted facade tones — faint grey and brown only. */
const FACADE_COLORS = [
  0x8f8a82, 0x847f78, 0x9a948c, 0x7a756e, 0x928b83, 0x867e76,
  0x9b9389, 0x807870, 0x8c857d, 0x918a82, 0x7e7871, 0x969088,
];

const AWNING_SOLID_COLORS = [
  0x6b4f4f, 0x4f5d6b, 0x5a6b4f, 0x6b5a4f, 0x4f6b63, 0x5c4f6b,
  0x7a4a4a, 0x3d5a4a, 0x5a4a3d, 0x4a4a6b,
];

const BUILDING_DEPTH = 4.5;

const brickCache = new Map<number, THREE.CanvasTexture>();
let glassTexture: THREE.CanvasTexture | null = null;
let stripedAwningTexture: THREE.CanvasTexture | null = null;

function darken(hex: number, amount = 0.18): number {
  const r = ((hex >> 16) & 255) * (1 - amount);
  const g = ((hex >> 8) & 255) * (1 - amount);
  const b = (hex & 255) * (1 - amount);
  return (r << 16) | (g << 8) | b;
}

function lighten(hex: number, amount = 0.12): number {
  const r = Math.min(255, ((hex >> 16) & 255) * (1 + amount));
  const g = Math.min(255, ((hex >> 8) & 255) * (1 + amount));
  const b = Math.min(255, (hex & 255) * (1 + amount));
  return (r << 16) | (g << 8) | b;
}

function hexToRgb(hex: number): [number, number, number] {
  return [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];
}

function createBrickTexture(baseColor: number): THREE.CanvasTexture {
  const cached = brickCache.get(baseColor);
  if (cached) return cached;

  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const [br, bg, bb] = hexToRgb(baseColor);
  const mortar = `rgb(${Math.min(255, br + 18)}, ${Math.min(255, bg + 16)}, ${Math.min(255, bb + 14)})`;

  ctx.fillStyle = mortar;
  ctx.fillRect(0, 0, size, size);

  const brickW = 36;
  const brickH = 14;
  const mortarPx = 2;
  const rows = Math.ceil(size / (brickH + mortarPx)) + 1;

  for (let row = 0; row < rows; row++) {
    const y = row * (brickH + mortarPx);
    const offset = row % 2 === 0 ? 0 : brickW / 2;
    const cols = Math.ceil((size + brickW) / (brickW + mortarPx)) + 1;

    for (let col = -1; col < cols; col++) {
      const x = col * (brickW + mortarPx) + offset;
      const shade = ((row * 3 + col) % 5) * 4 - 8;
      const r = Math.max(0, Math.min(255, br + shade));
      const g = Math.max(0, Math.min(255, bg + shade - 1));
      const b = Math.max(0, Math.min(255, bb + shade - 2));
      ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
      ctx.fillRect(x + mortarPx / 2, y + mortarPx / 2, brickW, brickH);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  brickCache.set(baseColor, tex);
  return tex;
}

function getStripedAwningTexture(): THREE.CanvasTexture {
  if (stripedAwningTexture) return stripedAwningTexture;

  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#f2f0ec';
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = '#c73e3a';
  ctx.lineWidth = 10;
  for (let i = -size; i < size * 2; i += 14) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + size, size);
    ctx.stroke();
  }

  stripedAwningTexture = new THREE.CanvasTexture(canvas);
  stripedAwningTexture.wrapS = THREE.RepeatWrapping;
  stripedAwningTexture.wrapT = THREE.RepeatWrapping;
  stripedAwningTexture.colorSpace = THREE.SRGBColorSpace;
  return stripedAwningTexture;
}

function awningMat(seed: number): THREE.MeshBasicMaterial {
  if (seed % 3 === 0) {
    const tex = getStripedAwningTexture().clone();
    tex.repeat.set(3, 1);
    return new THREE.MeshBasicMaterial({ map: tex });
  }
  const color = AWNING_SOLID_COLORS[seed % AWNING_SOLID_COLORS.length];
  return solidMat(color);
}

function getGlassTexture(): THREE.CanvasTexture {
  if (glassTexture) return glassTexture;

  const w = 64;
  const h = 96;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createLinearGradient(0, 0, w * 0.35, h * 0.4);
  grad.addColorStop(0, '#9eb4c8');
  grad.addColorStop(0.35, '#5f7386');
  grad.addColorStop(1, '#3d4f5e');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = 'rgba(210, 228, 242, 0.45)';
  ctx.fillRect(4, 4, w * 0.42, h * 0.22);

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, w - 1, h - 1);

  glassTexture = new THREE.CanvasTexture(canvas);
  glassTexture.colorSpace = THREE.SRGBColorSpace;
  return glassTexture;
}

function brickMat(color: number, width: number, height: number): THREE.MeshBasicMaterial {
  const tex = createBrickTexture(color);
  const mat = new THREE.MeshBasicMaterial({ map: tex.clone() });
  mat.map!.wrapS = THREE.RepeatWrapping;
  mat.map!.wrapT = THREE.RepeatWrapping;
  mat.map!.repeat.set(Math.max(1, width / 1.8), Math.max(1, height / 1.6));
  return mat;
}

function solidMat(color: number): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({ color });
}

function glassMat(): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    map: getGlassTexture(),
    transparent: true,
    opacity: 0.92,
  });
}

function addPart(
  parent: THREE.Object3D,
  geo: THREE.BufferGeometry,
  mat: THREE.Material,
  x: number,
  y: number,
  z: number,
  outline = false,
) {
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  if (outline) {
    const ol = new THREE.Mesh(
      geo,
      new THREE.MeshBasicMaterial({ color: 0x2e2c29, side: THREE.BackSide }),
    );
    ol.scale.setScalar(1.03);
    mesh.add(ol);
  }
  parent.add(mesh);
  return mesh;
}

function makeFacade(width: number, height: number, depth: number, seed: number): THREE.Group {
  const g = new THREE.Group();
  const wallColor = FACADE_COLORS[seed % FACADE_COLORS.length];
  const trimColor = darken(wallColor, 0.22);

  const wall = brickMat(wallColor, width, height);
  const trimMat = solidMat(trimColor);
  const windowMat = glassMat();

  addPart(g, new THREE.BoxGeometry(width, height, depth), wall, 0, height / 2, 0);

  const floors = Math.max(2, Math.floor(height / 2.2));
  for (let f = 0; f < floors; f++) {
    const y = 1.2 + f * 2.1;
    const cols = Math.max(2, Math.floor(width / 1.4));
    for (let c = 0; c < cols; c++) {
      const wx = -width / 2 + 0.8 + c * 1.35;
      addPart(
        g,
        new THREE.BoxGeometry(0.75, 0.95, 0.08),
        windowMat,
        wx,
        y,
        depth / 2 + 0.02,
        true,
      );
      addPart(
        g,
        new THREE.BoxGeometry(0.82, 0.08, 0.1),
        solidMat(darken(trimColor, 0.08)),
        wx,
        y - 0.58,
        depth / 2 + 0.02,
      );
    }
  }

  addPart(g, new THREE.BoxGeometry(width + 0.1, 0.35, depth + 0.12), trimMat, 0, height + 0.12, 0);

  const awning = addPart(
    g,
    new THREE.BoxGeometry(width * 0.7, 0.08, 0.9),
    awningMat(seed),
    0,
    1.6,
    depth / 2 + 0.45,
  );
  awning.rotation.x = -0.2;

  if (seed % 2 === 0) {
    addPart(
      g,
      new THREE.BoxGeometry(0.5, 1.8, 0.5),
      solidMat(lighten(trimColor, 0.06)),
      width * 0.3,
      0.9,
      depth / 2 + 0.2,
    );
  }

  return g;
}

function buildingWidth(blockIndex: number): number {
  return 3.5 + (blockIndex % 3) * 0.8;
}

function placeBuilding(
  parent: THREE.Group,
  side: -1 | 1,
  localZ: number,
  width: number,
  blockIndex: number,
) {
  const h = 5 + (blockIndex % 5) * 1.6;
  const building = makeFacade(width, h, BUILDING_DEPTH, blockIndex * 7 + (side > 0 ? 3 : 0));
  const outerX = WORLD.sidewalkOuter + BUILDING_DEPTH / 2 + 0.15;
  building.position.set(side * outerX, 0, localZ + width / 2);
  building.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
  parent.add(building);
}

export function addBuildingsToSegment(
  parent: THREE.Group,
  segmentLength: number,
  segmentWorldZ: number,
) {
  while (parent.children.length > 0) {
    parent.remove(parent.children[0]);
  }

  for (const localZ of getCrossroadLocalZs(segmentLength, segmentWorldZ)) {
    buildCrossroadVisual(parent, localZ);
  }

  for (const side of [-1, 1] as const) {
    let worldZ = 0;
    let blockIdx = 0;

    while (worldZ + buildingWidth(blockIdx) < segmentWorldZ && blockIdx < 10000) {
      worldZ += buildingWidth(blockIdx);
      blockIdx++;
    }

    while (worldZ < segmentWorldZ + segmentLength - 0.25 && blockIdx < 10000) {
      const w = buildingWidth(blockIdx);
      const blockEnd = worldZ + w;
      const visibleStart = Math.max(worldZ, segmentWorldZ);
      const visibleEnd = Math.min(blockEnd, segmentWorldZ + segmentLength);

      if (visibleEnd > visibleStart + 0.4) {
        for (const clip of clipOutCrossroads(visibleStart, visibleEnd)) {
          const localZ = clip.start - segmentWorldZ;
          const width = clip.end - clip.start;
          placeBuilding(parent, side, localZ, width, blockIdx);
        }
      }

      worldZ = blockEnd;
      blockIdx++;
    }
  }
}

export { BUILDING_DEPTH };
