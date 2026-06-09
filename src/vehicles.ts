import * as THREE from 'three';

const CAR_SCALE = 1.25;

const PALETTES = [
  { body: 0xe63946, trim: 0x9d0208, accent: 0xffd60a },
  { body: 0x1d3557, trim: 0x0b1f3a, accent: 0x48cae4 },
  { body: 0x2a9d8f, trim: 0x1b6b62, accent: 0xf4f1de },
  { body: 0xf4a261, trim: 0xc45d12, accent: 0x264653 },
  { body: 0x9b5de5, trim: 0x6a2c91, accent: 0x00f5d4 },
  { body: 0xffbe0b, trim: 0xfb8500, accent: 0x023047 },
  { body: 0x06d6a0, trim: 0x048a5e, accent: 0xff006e },
];

export type CarTrafficType = 'oncoming' | 'away' | 'cross';
type CarStyle = 'sedan' | 'hatch' | 'suv';

function darken(hex: number, amount = 0.22): number {
  const r = Math.max(0, ((hex >> 16) & 255) * (1 - amount));
  const g = Math.max(0, ((hex >> 8) & 255) * (1 - amount));
  const b = Math.max(0, (hex & 255) * (1 - amount));
  return (r << 16) | (g << 8) | b;
}

function toon(color: number): THREE.MeshToonMaterial {
  return new THREE.MeshToonMaterial({ color });
}

function gloss(color: number, opacity = 0.82): THREE.MeshToonMaterial {
  return new THREE.MeshToonMaterial({
    color,
    transparent: true,
    opacity,
  });
}

function addToonPart(
  parent: THREE.Group,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  position = new THREE.Vector3(),
  rotation = new THREE.Euler(),
  outline = 1.045,
): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.copy(position);
  mesh.rotation.copy(rotation);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  const outlineMesh = new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({ color: 0x141414, side: THREE.BackSide }),
  );
  outlineMesh.scale.setScalar(outline);
  mesh.add(outlineMesh);

  parent.add(mesh);
  return mesh;
}

function addWheel(parent: THREE.Group, x: number, z: number, rimColor: number) {
  const tire = addToonPart(
    parent,
    new THREE.CylinderGeometry(0.36, 0.36, 0.28, 16),
    toon(0x1a1a1a),
    new THREE.Vector3(x, 0.36, z),
    new THREE.Euler(0, 0, Math.PI / 2),
    1.03,
  );
  tire.renderOrder = 1;

  addToonPart(
    parent,
    new THREE.CylinderGeometry(0.26, 0.26, 0.3, 12),
    toon(0xf0f0f0),
    new THREE.Vector3(x, 0.36, z),
    new THREE.Euler(0, 0, Math.PI / 2),
    1.02,
  );

  addToonPart(
    parent,
    new THREE.CylinderGeometry(0.15, 0.15, 0.32, 10),
    toon(rimColor),
    new THREE.Vector3(x, 0.36, z),
    new THREE.Euler(0, 0, Math.PI / 2),
    1.02,
  );
}

function addWheelArch(parent: THREE.Group, x: number, z: number, paint: THREE.Material) {
  const arch = addToonPart(
    parent,
    new THREE.SphereGeometry(0.42, 12, 10, 0, Math.PI),
    paint,
    new THREE.Vector3(x, 0.38, z),
    new THREE.Euler(0, x > 0 ? -Math.PI / 2 : Math.PI / 2, 0),
    1.04,
  );
  arch.scale.set(1, 0.55, 1.1);
}

function buildSedan(
  g: THREE.Group,
  body: number,
  trim: number,
  accent: number,
  style: CarStyle,
) {
  const paint = toon(body);
  const paintDark = toon(darken(body));
  const trimMat = toon(trim);
  const chrome = toon(0xd8d8d8);
  const glass = gloss(0x7ec8e3);

  const length = style === 'suv' ? 3.9 : 3.75;
  const cabinH = style === 'suv' ? 0.95 : 0.72;
  const cabinZ = style === 'hatch' ? -0.05 : -0.18;

  addToonPart(
    g,
    new THREE.BoxGeometry(1.62, 0.52, length),
    paint,
    new THREE.Vector3(0, 0.48, 0),
  );

  addToonPart(
    g,
    new THREE.BoxGeometry(1.35, cabinH, style === 'hatch' ? 1.95 : 1.75),
    paint,
    new THREE.Vector3(0, 0.98, cabinZ),
  );

  if (style === 'hatch') {
    addToonPart(
      g,
      new THREE.BoxGeometry(1.65, 0.55, 1.1),
      paint,
      new THREE.Vector3(0, 1.02, -1.05),
      new THREE.Euler(-0.35, 0, 0),
    );
  }

  if (style === 'suv') {
    addToonPart(
      g,
      new THREE.BoxGeometry(1.75, 0.35, 3.6),
      paintDark,
      new THREE.Vector3(0, 1.28, -0.1),
    );
    addToonPart(
      g,
      new THREE.BoxGeometry(0.08, 0.06, 1.4),
      chrome,
      new THREE.Vector3(-0.82, 1.35, -0.2),
    );
    addToonPart(
      g,
      new THREE.BoxGeometry(0.08, 0.06, 1.4),
      chrome,
      new THREE.Vector3(0.82, 1.35, -0.2),
    );
  }

  addToonPart(
    g,
    new THREE.BoxGeometry(1.55, 0.48, 0.08),
    glass,
    new THREE.Vector3(0, 1.02, 0.82),
    new THREE.Euler(-0.42, 0, 0),
  );
  addToonPart(
    g,
    new THREE.BoxGeometry(1.45, 0.4, 0.08),
    glass,
    new THREE.Vector3(0, 1.0, -0.95),
    new THREE.Euler(0.3, 0, 0),
  );
  addToonPart(
    g,
    new THREE.BoxGeometry(1.35, 0.35, 0.06),
    glass,
    new THREE.Vector3(0, 1.0, 0.05),
  );

  addToonPart(
    g,
    new THREE.BoxGeometry(1.48, 0.22, 0.28),
    trimMat,
    new THREE.Vector3(0, 0.34, length / 2 + 0.02),
  );
  addToonPart(
    g,
    new THREE.BoxGeometry(1.48, 0.22, 0.28),
    trimMat,
    new THREE.Vector3(0, 0.34, -length / 2 - 0.02),
  );

  const grille = addToonPart(
    g,
    new THREE.BoxGeometry(1.1, 0.42, 0.12),
    trimMat,
    new THREE.Vector3(0, 0.52, length / 2 + 0.08),
  );
  grille.scale.set(1, 1, 0.6);

  for (let i = -2; i <= 2; i++) {
    addToonPart(
      g,
      new THREE.BoxGeometry(0.82, 0.05, 0.04),
      chrome,
      new THREE.Vector3(0, 0.44 + i * 0.08, length / 2 + 0.14),
    );
  }

  for (const side of [-1, 1]) {
    const head = addToonPart(
      g,
      new THREE.SphereGeometry(0.16, 12, 12),
      toon(0xfff3b0),
      new THREE.Vector3(side * 0.62, 0.58, length / 2 + 0.02),
    );
    head.scale.set(1.1, 0.85, 0.7);
    addToonPart(
      g,
      new THREE.SphereGeometry(0.09, 10, 10),
      toon(0xffffee),
      new THREE.Vector3(side * 0.62, 0.58, length / 2 + 0.1),
    );

    addToonPart(
      g,
      new THREE.BoxGeometry(0.22, 0.14, 0.08),
      toon(0xff3344),
      new THREE.Vector3(side * 0.62, 0.56, -length / 2 - 0.04),
    );
  }

  addToonPart(
    g,
    new THREE.BoxGeometry(0.14, 0.08, 0.22),
    chrome,
    new THREE.Vector3(0, 0.5, length / 2 + 0.16),
  );

  for (const side of [-1, 1]) {
    addToonPart(
      g,
      new THREE.BoxGeometry(0.06, 0.55, 0.35),
      paintDark,
      new THREE.Vector3(side * 0.98, 0.62, 0.1),
    );
    addToonPart(
      g,
      new THREE.BoxGeometry(0.14, 0.1, 0.18),
      paint,
      new THREE.Vector3(side * 1.04, 0.92, 0.35),
    );
    addToonPart(
      g,
      new THREE.SphereGeometry(0.08, 8, 8),
      chrome,
      new THREE.Vector3(side * 1.08, 0.92, 0.35),
    );
  }

  addToonPart(
    g,
    new THREE.BoxGeometry(0.06, 0.45, 1.2),
    toon(darken(body, 0.35)),
    new THREE.Vector3(0.99, 0.62, -0.05),
  );

  addToonPart(
    g,
    new THREE.BoxGeometry(1.5, 0.06, 0.12),
    toon(accent),
    new THREE.Vector3(0, 0.72, 0.15),
  );

  addToonPart(
    g,
    new THREE.BoxGeometry(0.55, 0.14, 0.08),
    toon(0xeeeeee),
    new THREE.Vector3(0, 0.4, -length / 2 - 0.12),
  );

  if (style !== 'suv' && Math.random() > 0.5) {
    addToonPart(
      g,
      new THREE.BoxGeometry(1.2, 0.08, 0.22),
      trimMat,
      new THREE.Vector3(0, 1.18, -1.05),
      new THREE.Euler(-0.2, 0, 0),
    );
  }

  addToonPart(
    g,
    new THREE.CylinderGeometry(0.04, 0.04, 0.18, 8),
    chrome,
    new THREE.Vector3(0.55, 1.22, -0.4),
  );

  const rimColor = accent;
  for (const [x, z] of [
    [-0.82, 1.15],
    [0.82, 1.15],
    [-0.82, -1.15],
    [0.82, -1.15],
  ]) {
    addWheelArch(g, x, z, paint);
    addWheel(g, x, z, rimColor);
  }
}

export function makeTrafficCar(type: CarTrafficType, color?: number): THREE.Group {
  const g = new THREE.Group();
  const palette = color
    ? { body: color, trim: darken(color), accent: 0xffffff }
    : PALETTES[Math.floor(Math.random() * PALETTES.length)];

  const styles: CarStyle[] = ['sedan', 'hatch', 'suv'];
  const style = styles[Math.floor(Math.random() * styles.length)];
  buildSedan(g, palette.body, palette.trim, palette.accent, style);

  g.scale.setScalar(CAR_SCALE);

  if (type === 'oncoming') g.rotation.y = Math.PI;
  if (type === 'cross') g.rotation.y = Math.PI / 2;

  g.userData.trafficType = type;
  return g;
}

export { CAR_SCALE };
