import * as THREE from 'three';
import { addBuildingsToSegment } from './buildings';
import { WORLD } from './world';

const SEGMENT_LENGTH = 40;
const SEGMENT_COUNT = 8;
const SEGMENT_OVERLAP = 1;

const ROAD_W = WORLD.roadHalf * 2;
const SW_W = WORLD.sidewalkWidth;
const GROUND_W = (WORLD.sidewalkOuter + 5) * 2;
const SEG_MESH_LEN = SEGMENT_LENGTH + SEGMENT_OVERLAP;

function flatMat(color: number): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide });
}

export interface RoadPiece {
  group: THREE.Group;
  content: THREE.Group;
}

function clearGroup(group: THREE.Group) {
  while (group.children.length > 0) {
    const child = group.children[0];
    group.remove(child);
    child.traverse((obj) => {
      if (obj instanceof THREE.Mesh) obj.geometry.dispose();
    });
  }
}

function rebuildSegmentContent(piece: RoadPiece) {
  clearGroup(piece.content);
  addBuildingsToSegment(piece.content, SEGMENT_LENGTH, piece.group.position.z);
}

export function buildRoad(scene: THREE.Scene): RoadPiece[] {
  const pieces: RoadPiece[] = [];
  const groundMat = flatMat(0x2f2f2f);
  const swMat = flatMat(0x4a4a48);
  const curbMat = flatMat(0x5a5a58);
  const lineMat = flatMat(0xffffff);

  for (let i = 0; i < SEGMENT_COUNT; i++) {
    const group = new THREE.Group();
    group.position.z = i * SEGMENT_LENGTH;

    const content = new THREE.Group();
    group.add(content);

    const ground = new THREE.Mesh(new THREE.PlaneGeometry(GROUND_W, SEG_MESH_LEN), groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, 0.01, SEGMENT_LENGTH / 2);
    group.add(ground);

    for (const side of [-1, 1] as const) {
      const sw = new THREE.Mesh(new THREE.PlaneGeometry(SW_W, SEG_MESH_LEN), swMat);
      sw.rotation.x = -Math.PI / 2;
      sw.position.set(side * (ROAD_W / 2 + SW_W / 2), 0.011, SEGMENT_LENGTH / 2);
      group.add(sw);
    }

    const curbL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.1, SEG_MESH_LEN), curbMat);
    curbL.position.set(-ROAD_W / 2 - 0.07, 0.05, SEGMENT_LENGTH / 2);
    group.add(curbL);
    const curbR = curbL.clone();
    curbR.position.x = ROAD_W / 2 + 0.07;
    group.add(curbR);

    const edgeL = new THREE.Mesh(new THREE.PlaneGeometry(0.1, SEG_MESH_LEN), lineMat);
    edgeL.rotation.x = -Math.PI / 2;
    edgeL.position.set(-ROAD_W / 2 + 0.05, 0.012, SEGMENT_LENGTH / 2);
    group.add(edgeL);
    const edgeR = edgeL.clone();
    edgeR.position.x = ROAD_W / 2 - 0.05;
    group.add(edgeR);

    for (let z = 2; z < SEGMENT_LENGTH; z += 4) {
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 2), lineMat);
      dash.rotation.x = -Math.PI / 2;
      dash.position.set(0, 0.013, z);
      group.add(dash);
    }

    const piece: RoadPiece = { group, content };
    rebuildSegmentContent(piece);

    scene.add(group);
    pieces.push(piece);
  }

  return pieces;
}

export function recycleRoad(pieces: RoadPiece[], playerZ: number) {
  const total = SEGMENT_LENGTH * pieces.length;
  for (const piece of pieces) {
    if (piece.group.position.z < playerZ - SEGMENT_LENGTH) {
      piece.group.position.z += total;
      rebuildSegmentContent(piece);
    }
  }
}

export function resetRoad(pieces: RoadPiece[]) {
  for (let i = 0; i < pieces.length; i++) {
    pieces[i].group.position.z = i * SEGMENT_LENGTH;
    rebuildSegmentContent(pieces[i]);
  }
}

export { SEGMENT_LENGTH };
