import * as THREE from 'three';
import { buildCrossroadVisual, clipOutCrossroads, getCrossroadLocalZs } from './crossroads';
import { WORLD } from './world';

/** Muted cartoon facade tones — warm grey and brown. */
const FACADE_COLORS = [
  0xa39e96, 0x9a938b, 0xb0a89f, 0x8f8880, 0xa8a098, 0x968f87,
  0xada59c, 0x918a82, 0x9f978f, 0xa5a098, 0x8c857d, 0xaab2a8,
];

const AWNING_SOLID_COLORS = [
  0x7a5555, 0x55667a, 0x5f7a55, 0x7a6a55, 0x557a70, 0x65557a,
  0x8a5050, 0x456a55, 0x6a5545, 0x505a7a,
];

const OUTLINE_COLOR = 0x1a1816;
const OUTLINE_SCALE = 1.058;
const FRAME_COLOR = 0xeee9df;
const FRAME_SHADOW = 0x4a4540;

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

function hexToCss(hex: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgb(${r}, ${g}, ${b})`;
}

function createCartoonBrickTexture(baseColor: number): THREE.CanvasTexture {
  const cached = brickCache.get(baseColor);
  if (cached) return cached;

  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const [br, bg, bb] = hexToRgb(baseColor);
  const mortar = `rgb(${Math.min(255, br + 28)}, ${Math.min(255, bg + 24)}, ${Math.min(255, bb + 20)})`;

  ctx.fillStyle = mortar;
  ctx.fillRect(0, 0, size, size);

  const brickW = 44;
  const brickH = 18;
  const mortarPx = 4;
  const rows = Math.ceil(size / (brickH + mortarPx)) + 1;

  for (let row = 0; row < rows; row++) {
    const y = row * (brickH + mortarPx);
    const offset = row % 2 === 0 ? 0 : brickW / 2;
    const cols = Math.ceil((size + brickW) / (brickW + mortarPx)) + 1;

    for (let col = -1; col < cols; col++) {
      const x = col * (brickW + mortarPx) + offset;
      const tone = (row + col) % 3;
      const shade = tone === 0 ? -6 : tone === 1 ? 4 : -2;
      const r = Math.max(0, Math.min(255, br + shade));
      const g = Math.max(0, Math.min(255, bg + shade - 1));
      const b = Math.max(0, Math.min(255, bb + shade - 2));

      ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
      ctx.fillRect(x + mortarPx / 2, y + mortarPx / 2, brickW, brickH);

      ctx.fillStyle = `rgba(255, 255, 255, ${tone === 1 ? 0.12 : 0.05})`;
      ctx.fillRect(x + mortarPx / 2 + 3, y + mortarPx / 2 + 2, brickW - 6, 4);
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

  ctx.fillStyle = '#f5f2ec';
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = '#d63b36';
  ctx.lineWidth = 12;
  for (let i = -size; i < size * 2; i += 16) {
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
  return solidMat(AWNING_SOLID_COLORS[seed % AWNING_SOLID_COLORS.length]);
}

function getCartoonGlassTexture(): THREE.CanvasTexture {
  if (glassTexture) return glassTexture;

  const w = 80;
  const h = 110;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#8ec8e8');
  sky.addColorStop(0.45, '#5a9fc4');
  sky.addColorStop(1, '#3d7aa8');
  ctx.fillStyle = sky;
  ctx.fillRect(8, 8, w - 16, h - 16);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.72)';
  ctx.beginPath();
  ctx.ellipse(26, 24, 14, 9, -0.4, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(14, 52);
  ctx.lineTo(66, 38);
  ctx.stroke();

  ctx.strokeStyle = hexToCss(FRAME_SHADOW);
  ctx.lineWidth = 5;
  ctx.strokeRect(6, 6, w - 12, h - 12);

  ctx.strokeStyle = hexToCss(FRAME_COLOR);
  ctx.lineWidth = 3;
  ctx.strokeRect(8, 8, w - 16, h - 16);

  ctx.strokeStyle = hexToCss(FRAME_SHADOW);
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(w / 2, 10);
  ctx.lineTo(w / 2, h - 10);
  ctx.moveTo(10, h * 0.42);
  ctx.lineTo(w - 10, h * 0.42);
  ctx.stroke();

  glassTexture = new THREE.CanvasTexture(canvas);
  glassTexture.colorSpace = THREE.SRGBColorSpace;
  return glassTexture;
}

function brickMat(color: number, width: number, height: number): THREE.MeshBasicMaterial {
  const tex = createCartoonBrickTexture(color);
  const mat = new THREE.MeshBasicMaterial({ map: tex.clone() });
  mat.map!.wrapS = THREE.RepeatWrapping;
  mat.map!.wrapT = THREE.RepeatWrapping;
  mat.map!.repeat.set(Math.max(1, width / 2.2), Math.max(1, height / 2));
  return mat;
}

function solidMat(color: number): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({ color });
}

function glassMat(): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    map: getCartoonGlassTexture(),
    transparent: true,
    opacity: 1,
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
      new THREE.MeshBasicMaterial({ color: OUTLINE_COLOR, side: THREE.BackSide }),
    );
    ol.scale.setScalar(OUTLINE_SCALE);
    mesh.add(ol);
  }
  parent.add(mesh);
  return mesh;
}

function addCartoonWindow(
  parent: THREE.Group,
  x: number,
  y: number,
  z: number,
  seed: number,
) {
  const frameW = 0.88;
  const frameH = 1.08;
  const glassW = 0.68;
  const glassH = 0.82;
  const depth = 0.1;

  addPart(
    parent,
    new THREE.BoxGeometry(frameW, frameH, depth),
    solidMat(FRAME_COLOR),
    x,
    y,
    z,
    true,
  );

  addPart(
    parent,
    new THREE.BoxGeometry(frameW + 0.06, frameH + 0.06, depth * 0.55),
    solidMat(FRAME_SHADOW),
    x,
    y,
    z - 0.025,
    false,
  );

  addPart(
    parent,
    new THREE.BoxGeometry(glassW, glassH, depth * 0.65),
    glassMat(),
    x,
    y + 0.02,
    z + 0.02,
    true,
  );

  addPart(
    parent,
    new THREE.BoxGeometry(0.06, glassH, depth * 0.7),
    solidMat(FRAME_COLOR),
    x,
    y + 0.02,
    z + 0.025,
    true,
  );
  addPart(
    parent,
    new THREE.BoxGeometry(glassW, 0.06, depth * 0.7),
    solidMat(FRAME_COLOR),
    x,
    y + 0.02,
    z + 0.025,
    true,
  );

  addPart(
    parent,
    new THREE.BoxGeometry(frameW + 0.04, 0.1, depth + 0.04),
    solidMat(seed % 4 === 0 ? lighten(FRAME_COLOR, 0.04) : FRAME_SHADOW),
    x,
    y - frameH / 2 - 0.04,
    z + 0.01,
    true,
  );
}

function makeFacade(width: number, height: number, depth: number, seed: number): THREE.Group {
  const g = new THREE.Group();
  const wallColor = FACADE_COLORS[seed % FACADE_COLORS.length];
  const trimColor = darken(wallColor, 0.28);
  const roofColor = darken(wallColor, 0.35);

  const wall = brickMat(wallColor, width, height);
  const trimMat = solidMat(trimColor);

  addPart(g, new THREE.BoxGeometry(width, height, depth), wall, 0, height / 2, 0, true);

  const floors = Math.max(2, Math.floor(height / 2.2));
  for (let f = 0; f < floors; f++) {
    const y = 1.25 + f * 2.15;
    const cols = Math.max(2, Math.floor(width / 1.45));
    for (let c = 0; c < cols; c++) {
      const wx = -width / 2 + 0.85 + c * 1.38;
      addCartoonWindow(g, wx, y, depth / 2 + 0.04, seed + f + c);
    }
  }

  addPart(
    g,
    new THREE.BoxGeometry(width + 0.14, 0.42, depth + 0.14),
    solidMat(roofColor),
    0,
    height + 0.14,
    0,
    true,
  );
  addPart(
    g,
    new THREE.BoxGeometry(width + 0.06, 0.12, depth + 0.08),
    solidMat(lighten(roofColor, 0.08)),
    0,
    height + 0.38,
    0,
    true,
  );

  if (seed % 3 !== 1) {
    for (let i = -1; i <= 1; i += 2) {
      addPart(
        g,
        new THREE.BoxGeometry(0.14, height * 0.92, 0.14),
        trimMat,
        i * (width / 2 - 0.08),
        height / 2,
        depth / 2 + 0.02,
        true,
      );
    }
  }

  const awning = addPart(
    g,
    new THREE.BoxGeometry(width * 0.72, 0.1, 0.95),
    awningMat(seed),
    0,
    1.65,
    depth / 2 + 0.48,
    true,
  );
  awning.rotation.x = -0.22;

  if (seed % 2 === 0) {
    addPart(
      g,
      new THREE.BoxGeometry(0.55, 1.85, 0.55),
      solidMat(lighten(trimColor, 0.05)),
      width * 0.28,
      0.92,
      depth / 2 + 0.22,
      true,
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
