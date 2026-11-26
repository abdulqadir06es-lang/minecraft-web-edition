import * as THREE from 'three';
import { World, WORLD_SIZE, WORLD_HEIGHT } from './world';

/** AABB voxel collision + gravity for player and mobs. */

export interface PhysicsBody {
  position: THREE.Vector3; // feet center
  velocity: THREE.Vector3;
  width: number; // AABB x/z size
  height: number;
  onGround: boolean;
}

/** Does an AABB at pos overlap any solid voxel? */
function collides(world: World, pos: THREE.Vector3, width: number, height: number): boolean {
  const half = width / 2;
  const minX = Math.floor(pos.x - half + 1e-6);
  const maxX = Math.floor(pos.x + half - 1e-6);
  const minY = Math.floor(pos.y + 1e-6);
  const maxY = Math.floor(pos.y + height - 1e-6);
  const minZ = Math.floor(pos.z - half + 1e-6);
  const maxZ = Math.floor(pos.z + half - 1e-6);
  for (let x = minX; x <= maxX; x++)
    for (let y = minY; y <= maxY; y++)
      for (let z = minZ; z <= maxZ; z++) {
        if (x < 0 || x >= WORLD_SIZE || z < 0 || z >= WORLD_SIZE || y < 0 || y >= WORLD_HEIGHT) {
          // world border acts as solid walls
          if (y < 0 || x < 0 || x >= WORLD_SIZE || z < 0 || z >= WORLD_SIZE) return true;
          continue;
        }
        if (world.get(x, y, z) !== 0 && world.get(x, y, z) !== 7) return true; // everything except air and water is solid
      }
  return false;
}

const GRAVITY = -24;
const MAX_FALL = 40;

/** Integrates one physics step with axis-separated collision resolution. */
export function stepBody(body: PhysicsBody, world: World, dt: number, inWater: boolean): void {
  body.velocity.y += (inWater ? GRAVITY * 0.35 : GRAVITY) * dt;
  body.velocity.y = Math.max(body.velocity.y, inWater ? -4 : -MAX_FALL);

  const dx = body.velocity.x * dt;
  const dy = body.velocity.y * dt;
  const dz = body.velocity.z * dt;

  // X axis
  const oldX = body.position.x;
  body.position.x += dx;
  if (collides(world, body.position, body.width, body.height)) {
    body.position.x = oldX;
    body.velocity.x = 0;
  }
  // Z axis
  const oldZ = body.position.z;
  body.position.z += dz;
  if (collides(world, body.position, body.width, body.height)) {
    body.position.z = oldZ;
    body.velocity.z = 0;
  }
  // Y axis
  const oldY = body.position.y;
  body.position.y += dy;
  if (collides(world, body.position, body.width, body.height)) {
    body.position.y = oldY;
    if (dy < 0) body.onGround = true;
    body.velocity.y = 0;
  } else if (dy < 0) {
    body.onGround = false;
  }
}

/** Water check: is the body's center submerged? */
export function isInWater(body: PhysicsBody, world: World): boolean {
  return world.get(Math.floor(body.position.x), Math.floor(body.position.y + 0.5), Math.floor(body.position.z)) === 7;
}

/** Finds a safe spawn: surface height at world center-ish column. */
export function findSpawn(world: World): THREE.Vector3 {
  for (let r = 0; r < 40; r++) {
    const x = Math.floor(WORLD_SIZE / 2) + (r % 7) - 3;
    const z = Math.floor(WORLD_SIZE / 2) + (r % 5) - 2;
    const y = world.surfaceY(x, z);
    if (y > 0 && y + 3 < WORLD_HEIGHT) return new THREE.Vector3(x + 0.5, y + 1.05, z + 0.5);
  }
  return new THREE.Vector3(WORLD_SIZE / 2, WORLD_HEIGHT - 5, WORLD_SIZE / 2);
}
