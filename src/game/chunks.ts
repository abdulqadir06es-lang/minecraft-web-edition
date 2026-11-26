import * as THREE from 'three';
import { BLOCKS, BlockId } from './blocks';
import { tileUV } from './textures';
import { World, WORLD_HEIGHT, WORLD_SIZE } from './world';

/** Builds merged, face-culled geometry for the whole world in chunks (greedy per-face culling). */

export const CHUNK_SIZE = 16; // X/Z blocks per chunk
const CHUNKS = WORLD_SIZE / CHUNK_SIZE; // 8x8 chunks

/** Face definitions: axis, dir, 4 corner offsets (CCW from outside), uv order. */
interface FaceDef {
  dir: [number, number, number];
  corners: Array<{ pos: [number, number, number]; uv: [number, number] }>;
}

const FACES: FaceDef[] = [
  // +X
  {
    dir: [1, 0, 0],
    corners: [
      { pos: [1, 1, 1], uv: [0, 1] },
      { pos: [1, 0, 1], uv: [0, 0] },
      { pos: [1, 1, 0], uv: [1, 1] },
      { pos: [1, 0, 0], uv: [1, 0] },
    ],
  },
  // -X
  {
    dir: [-1, 0, 0],
    corners: [
      { pos: [0, 1, 0], uv: [0, 1] },
      { pos: [0, 0, 0], uv: [0, 0] },
      { pos: [0, 1, 1], uv: [1, 1] },
      { pos: [0, 0, 1], uv: [1, 0] },
    ],
  },
  // +Y (top)
  {
    dir: [0, 1, 0],
    corners: [
      { pos: [0, 1, 1], uv: [0, 1] },
      { pos: [1, 1, 1], uv: [1, 1] },
      { pos: [0, 1, 0], uv: [0, 0] },
      { pos: [1, 1, 0], uv: [1, 0] },
    ],
  },
  // -Y (bottom)
  {
    dir: [0, -1, 0],
    corners: [
      { pos: [1, 0, 1], uv: [1, 0] },
      { pos: [0, 0, 1], uv: [0, 0] },
      { pos: [1, 0, 0], uv: [1, 1] },
      { pos: [0, 0, 0], uv: [0, 1] },
    ],
  },
  // +Z
  {
    dir: [0, 0, 1],
    corners: [
      { pos: [0, 1, 1], uv: [0, 1] },
      { pos: [0, 0, 1], uv: [0, 0] },
      { pos: [1, 1, 1], uv: [1, 1] },
      { pos: [1, 0, 1], uv: [1, 0] },
    ],
  },
  // -Z
  {
    dir: [0, 0, -1],
    corners: [
      { pos: [1, 1, 0], uv: [0, 1] },
      { pos: [1, 0, 0], uv: [0, 0] },
      { pos: [0, 1, 0], uv: [1, 1] },
      { pos: [0, 0, 0], uv: [1, 0] },
    ],
  },
];

export class ChunkManager {
  /** opaque and transparent meshes per chunk key */
  private meshes = new Map<string, { solid: THREE.Mesh; water: THREE.Mesh | null }>();
  private group = new THREE.Group();
  private dirty = new Set<string>();
  private materials: { solid: THREE.MeshLambertMaterial; water: THREE.MeshLambertMaterial };

  constructor(
    private world: World,
    atlas: THREE.Texture,
    private shadows: boolean
  ) {
    this.materials = {
      solid: new THREE.MeshLambertMaterial({ map: atlas, alphaTest: 0.5, transparent: false }),
      water: new THREE.MeshLambertMaterial({ map: atlas, transparent: true, opacity: 0.8, depthWrite: false }),
    };
  }

  get object3D(): THREE.Object3D {
    return this.group;
  }

  /** Queue a chunk rebuild (debounced, applied per frame). */
  markDirty(x: number, z: number): void {
    const cx = Math.floor(x / CHUNK_SIZE);
    const cz = Math.floor(z / CHUNK_SIZE);
    if (cx < 0 || cx >= CHUNKS || cz < 0 || cz >= CHUNKS) return;
    this.dirty.add(`${cx},${cz}`);
  }

  /** Rebuild chunk + neighbours (block edits touch shared faces). */
  rebuildAt(x: number, z: number): void {
    this.markDirty(x, z);
    const cx = Math.floor(x / CHUNK_SIZE);
    const cz = Math.floor(z / CHUNK_SIZE);
    if (x % CHUNK_SIZE === 0) this.markDirty((cx - 1) * CHUNK_SIZE, z);
    if (x % CHUNK_SIZE === CHUNK_SIZE - 1) this.markDirty((cx + 1) * CHUNK_SIZE, z);
    if (z % CHUNK_SIZE === 0) this.markDirty(x, (cz - 1) * CHUNK_SIZE);
    if (z % CHUNK_SIZE === CHUNK_SIZE - 1) this.markDirty(x, (cz + 1) * CHUNK_SIZE);
  }

  /** Rebuild up to N dirty chunks per call (spread work across frames). */
  processDirty(budget = 2): boolean {
    if (this.dirty.size === 0) return false;
    let n = 0;
    for (const key of this.dirty) {
      this.buildChunk(key);
      this.dirty.delete(key);
      if (++n >= budget) break;
    }
    return true;
  }

  get pending(): number {
    return this.dirty.size;
  }

  private buildChunk(key: string): void {
    const [cx, cz] = key.split(',').map(Number);
    const old = this.meshes.get(key);
    if (old) {
      this.group.remove(old.solid);
      old.solid.geometry.dispose();
      if (old.water) {
        this.group.remove(old.water);
        old.water.geometry.dispose();
      }
    }

    const positions: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];
    const wPos: number[] = [];
    const wNor: number[] = [];
    const wUv: number[] = [];
    const wCol: number[] = [];
    const wIdx: number[] = [];

    const x0 = cx * CHUNK_SIZE;
    const z0 = cz * CHUNK_SIZE;

    for (let x = x0; x < x0 + CHUNK_SIZE; x++)
      for (let z = z0; z < z0 + CHUNK_SIZE; z++)
        for (let y = 0; y < WORLD_HEIGHT; y++) {
          const id = this.world.get(x, y, z);
          if (id === BlockId.Air) continue;
          const def = BLOCKS[id];
          const isWater = id === BlockId.Water;

          for (let f = 0; f < 6; f++) {
            const face = FACES[f];
            const nx = x + face.dir[0];
            const ny = y + face.dir[1];
            const nz = z + face.dir[2];
            const nId = this.world.get(nx, ny, nz);
            const nDef = BLOCKS[nId];
            // hide face if neighbour is a solid opaque block, or same-liquid
            const hidden = nDef
              ? nId === id
                ? isWater || !def.transparent
                : nDef.solid && !nDef.transparent && !def.transparent
              : false;
            if (hidden) continue;
            // water top surface below air gets full height; sides adjacent to air only
            if (isWater && nId !== BlockId.Air && !(nDef && !nDef.solid)) continue;

            const tile = def.faces[f];
            const { u0, v0, u1, v1 } = tileUV(tile);
            const P = isWater ? wPos : positions;
            const N = isWater ? wNor : normals;
            const U = isWater ? wUv : uvs;
            const C = isWater ? wCol : colors;
            const I = isWater ? wIdx : indices;

            const base = P.length / 3;
            const shadeVal = f === 2 ? 1 : f === 3 ? 0.55 : 0.8 + (f % 2) * 0.12; // fake AO: top bright, bottom dark
            for (const c of face.corners) {
              // water surface slightly lower than full block
              const yOff = isWater && c.pos[1] === 1 ? -0.12 : 0;
              P.push(x + c.pos[0], y + c.pos[1] + yOff, z + c.pos[2]);
              N.push(face.dir[0], face.dir[1], face.dir[2]);
              U.push(u0 + (u1 - u0) * c.uv[0], v0 + (v1 - v0) * c.uv[1]);
              C.push(shadeVal, shadeVal, shadeVal);
            }
            I.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
          }
        }

    const make = (pos: number[], nor: number[], uv: number[], col: number[], idx: number[], mat: THREE.Material, shadow: boolean) => {
      if (pos.length === 0) return null;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      g.setIndex(idx);
      const m = new THREE.Mesh(g, mat);
      m.castShadow = shadow && this.shadows;
      m.receiveShadow = shadow && this.shadows;
      m.matrixAutoUpdate = false;
      this.group.add(m);
      return m;
    };

    const solid = make(positions, normals, uvs, colors, indices, this.materials.solid, true);
    const water = make(wPos, wNor, wUv, wCol, wIdx, this.materials.water, false);
    this.meshes.set(key, { solid: solid ?? new THREE.Mesh(new THREE.BufferGeometry()), water });
  }

  buildAll(): void {
    for (let cx = 0; cx < CHUNKS; cx++) for (let cz = 0; cz < CHUNKS; cz++) this.dirty.add(`${cx},${cz}`);
    while (this.processDirty(CHUNKS)) {
      /* build everything now */
    }
  }
}
