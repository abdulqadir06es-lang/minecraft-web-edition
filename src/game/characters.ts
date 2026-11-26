import * as THREE from 'three';

/** Builds blocky characters (Steve, Creeper, Pig) out of box meshes with walk/idle animation. */

function colorMaterial(hex: number, canvasTex?: THREE.Texture): THREE.MeshLambertMaterial {
  return new THREE.MeshLambertMaterial(canvasTex ? { map: canvasTex } : { color: hex });
}

function box(
  w: number,
  h: number,
  d: number,
  mat: THREE.Material,
  x: number,
  y: number,
  z: number
): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = false;
  return m;
}

/** A limb pivoted at its top (shoulder/hip) for swing animation. */
function limb(w: number, h: number, d: number, mat: THREE.Material, px: number, py: number, pz: number): THREE.Group {
  const pivot = new THREE.Group();
  pivot.position.set(px, py, pz);
  const mesh = box(w, h, d, mat, 0, -h / 2, 0);
  pivot.add(mesh);
  return pivot;
}

export interface CharacterRig {
  group: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  head: THREE.Group;
}

/** Steve: blue shirt, purple pants, skin-tone head/arms. */
export function createSteve(): CharacterRig {
  const g = new THREE.Group();
  const skin = colorMaterial(0xc68e63);
  const shirt = colorMaterial(0x2f9edb);
  const pants = colorMaterial(0x4a3f8f);
  const hair = colorMaterial(0x4a2f1b);
  const eyeW = colorMaterial(0xffffff);
  const eyeB = colorMaterial(0x3b2de0);
  const mouth = colorMaterial(0x7a4a35);

  // legs (0.25 wide each), torso 0.5 wide, all in block units where 1 block = 1
  const leftLeg = limb(0.24, 0.75, 0.24, pants, -0.125, 0.75, 0);
  const rightLeg = limb(0.24, 0.75, 0.24, pants, 0.125, 0.75, 0);
  // torso
  const torso = box(0.5, 0.75, 0.25, shirt, 0, 1.125, 0);
  // arms
  const leftArm = limb(0.22, 0.75, 0.22, skin, -0.36, 1.5, 0);
  const rightArm = limb(0.22, 0.75, 0.22, skin, 0.36, 1.5, 0);
  // head with simple pixel face
  const head = new THREE.Group();
  head.position.set(0, 1.5, 0);
  const headMesh = box(0.5, 0.5, 0.5, skin, 0, 0.25, 0);
  const hairTop = box(0.52, 0.12, 0.52, hair, 0, 0.45, 0);
  const eyeL = box(0.08, 0.08, 0.02, eyeW, -0.11, 0.28, 0.26);
  const eyeR = box(0.08, 0.08, 0.02, eyeW, 0.11, 0.28, 0.26);
  const pupilL = box(0.04, 0.08, 0.021, eyeB, -0.09, 0.28, 0.262);
  const pupilR = box(0.04, 0.08, 0.021, eyeB, 0.13, 0.28, 0.262);
  const mouthMesh = box(0.14, 0.05, 0.021, mouth, 0.02, 0.13, 0.262);
  head.add(headMesh, hairTop, eyeL, eyeR, pupilL, pupilR, mouthMesh);

  g.add(leftLeg, rightLeg, torso, leftArm, rightArm, head);
  return { group: g, leftArm, rightArm, leftLeg, rightLeg, head };
}

/** Creeper: green speckled body, four stubby legs, iconic sad face. */
export function createCreeper(): CharacterRig {
  const g = new THREE.Group();
  const green = colorMaterial(0x4fa04f);
  const dark = colorMaterial(0x2f6e2f);
  const black = colorMaterial(0x0a0a0a);

  const body = box(0.5, 0.9, 0.3, green, 0, 0.95, 0);
  const head = new THREE.Group();
  head.position.set(0, 1.4, 0);
  const headMesh = box(0.5, 0.5, 0.5, green, 0, 0.25, 0);
  // face: two square eyes + drooping mouth
  const eyeL = box(0.12, 0.12, 0.02, black, -0.13, 0.3, 0.26);
  const eyeR = box(0.12, 0.12, 0.02, black, 0.13, 0.3, 0.26);
  const mouthL = box(0.08, 0.16, 0.02, black, -0.07, 0.12, 0.26);
  const mouthR = box(0.08, 0.16, 0.02, black, 0.07, 0.12, 0.26);
  const mouthM = box(0.08, 0.1, 0.02, black, 0, 0.08, 0.26);
  const patch1 = box(0.1, 0.1, 0.505, dark, 0.2, 0.5, 0);
  const patch2 = box(0.1, 0.1, 0.505, dark, -0.22, 0.3, 0);
  head.add(headMesh, eyeL, eyeR, mouthL, mouthR, mouthM, patch1, patch2);

  const legs: THREE.Group[] = [];
  const legPositions: Array<[number, number]> = [
    [-0.14, -0.16],
    [0.14, -0.16],
    [-0.14, 0.16],
    [0.14, 0.16],
  ];
  for (const [lx, lz] of legPositions) {
    const l = limb(0.2, 0.5, 0.2, green, lx, 0.5, lz);
    legs.push(l);
    g.add(l);
  }
  g.add(body, head);
  // map legs onto rig slots (front pair = "arms", back pair = "legs")
  return { group: g, leftArm: legs[0], rightArm: legs[1], leftLeg: legs[2], rightLeg: legs[3], head };
}

/** Pig: pink box body, snout, four legs. */
export function createPig(): CharacterRig {
  const g = new THREE.Group();
  const pink = colorMaterial(0xeea3a3);
  const darkPink = colorMaterial(0xd98888);
  const snoutC = colorMaterial(0xcf7b7b);
  const black = colorMaterial(0x1a1a1a);

  const body = box(0.6, 0.5, 0.9, pink, 0, 0.65, 0);
  const head = new THREE.Group();
  head.position.set(0, 0.7, 0.5);
  const headMesh = box(0.45, 0.45, 0.4, pink, 0, 0, 0.1);
  const snout = box(0.2, 0.14, 0.06, snoutC, 0, -0.05, 0.32);
  const nostrilL = box(0.04, 0.06, 0.02, darkPink, -0.05, -0.05, 0.355);
  const nostrilR = box(0.04, 0.06, 0.02, darkPink, 0.05, -0.05, 0.355);
  const eyeL = box(0.07, 0.07, 0.02, black, -0.14, 0.1, 0.31);
  const eyeR = box(0.07, 0.07, 0.02, black, 0.14, 0.1, 0.31);
  head.add(headMesh, snout, nostrilL, nostrilR, eyeL, eyeR);

  const legs: THREE.Group[] = [];
  const legPositions: Array<[number, number]> = [
    [-0.18, 0.28],
    [0.18, 0.28],
    [-0.18, -0.28],
    [0.18, -0.28],
  ];
  for (const [lx, lz] of legPositions) {
    const l = limb(0.18, 0.4, 0.18, pink, lx, 0.4, lz);
    legs.push(l);
    g.add(l);
  }
  g.add(body, head);
  return { group: g, leftArm: legs[0], rightArm: legs[1], leftLeg: legs[2], rightLeg: legs[3], head };
}

/** Applies walk cycle swing to a rig. phase in radians, amplitude scales with speed. */
export function animateRig(rig: CharacterRig, walkPhase: number, speed01: number, dt: number): void {
  const swing = Math.sin(walkPhase) * 0.8 * speed01;
  const swing2 = Math.sin(walkPhase + Math.PI) * 0.8 * speed01;
  const idle = Math.sin(performance.now() * 0.002) * 0.05 * (1 - speed01);

  rig.leftArm.rotation.x = swing + idle;
  rig.rightArm.rotation.x = swing2 + idle;
  rig.leftLeg.rotation.x = swing2;
  rig.rightLeg.rotation.x = swing;
}
