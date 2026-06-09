import * as THREE from 'three';

const SKIN = [0xf4c49b, 0xd4a574, 0x8d5524, 0xffdbac];
const SHIRTS = [0xe63946, 0x457b9d, 0x2a9d8f, 0xf4a261, 0x9b5de5, 0x06d6a0];
const PANTS = [0x264653, 0x1d3557, 0x333333, 0x5c4033];

function mat(color: number, roughness = 0.85): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness });
}

export function makePedestrian(): THREE.Group {
  const g = new THREE.Group();
  const skin = mat(SKIN[Math.floor(Math.random() * SKIN.length)]);
  const shirt = mat(SHIRTS[Math.floor(Math.random() * SHIRTS.length)]);
  const pants = mat(PANTS[Math.floor(Math.random() * PANTS.length)]);

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.55, 0.28), shirt);
  torso.position.y = 0.92;
  torso.castShadow = true;
  g.add(torso);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 10), skin);
  head.position.y = 1.32;
  head.castShadow = true;
  g.add(head);

  const legL = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.32, 4, 8), pants);
  legL.position.set(-0.1, 0.42, 0);
  legL.castShadow = true;
  g.add(legL);

  const legR = legL.clone();
  legR.position.x = 0.1;
  g.add(legR);

  const armL = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.22, 4, 8), shirt);
  armL.position.set(-0.28, 0.95, 0);
  armL.rotation.z = 0.25;
  g.add(armL);

  const armR = armL.clone();
  armR.position.x = 0.28;
  armR.rotation.z = -0.25;
  g.add(armR);

  g.userData.walkPhase = Math.random() * Math.PI * 2;
  return g;
}

export function animatePedestrian(mesh: THREE.Object3D, dt: number) {
  mesh.userData.walkPhase = ((mesh.userData.walkPhase as number) ?? 0) + dt * 9;
  const swing = Math.sin(mesh.userData.walkPhase as number) * 0.35;
  mesh.children.forEach((child, i) => {
    if (i === 2) child.rotation.x = swing;
    if (i === 3) child.rotation.x = -swing;
  });
}
