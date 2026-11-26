import { BlockId } from './blocks';

/** Seeded value-noise hill terrain with caves and trees. */

export const WORLD_SIZE = 128; // blocks (X and Z)
export const WORLD_HEIGHT = 48; // blocks (Y)
export const SEA_LEVEL = 12;

export class World {
  /** Flat array: index = (y * WORLD_SIZE + z) * WORLD_SIZE + x */
  private data: Uint8Array;

  constructor(values?: Uint8Array) {
    this.data = values ?? new Uint8Array(WORLD_SIZE * WORLD_HEIGHT * WORLD_SIZE);
  }

  inBounds(x: number, y: number, z: number): boolean {
    return x >= 0 && x < WORLD_SIZE && y >= 0 && y < WORLD_HEIGHT && z >= 0 && z < WORLD_SIZE;
  }

  get(x: number, y: number, z: number): BlockId {
    if (!this.inBounds(x, y, z)) return BlockId.Air;
    return this.data[(y * WORLD_SIZE + z) * WORLD_SIZE + x] as BlockId;
  }

  set(x: number, y: number, z: number, id: BlockId): void {
    if (!this.inBounds(x, y, z)) return;
    this.data[(y * WORLD_SIZE + z) * WORLD_SIZE + x] = id;
  }

  /** Highest solid block y at column, or -1 if none. */
  surfaceY(x: number, z: number): number {
    for (let y = WORLD_HEIGHT - 1; y >= 0; y--) {
      const b = this.get(x, y, z);
      if (b !== BlockId.Air && b !== BlockId.Water) return y;
    }
    return -1;
  }

  serialize(): Uint8Array {
    return this.data;
  }

  static from(values: Uint8Array): World {
    return new World(new Uint8Array(values));
  }
}

/** Smooth 1-D/2-D value noise. */
function valueNoise2D(seed: number): (x: number, z: number) => number {
  const hash = (x: number, z: number) => {
    let h = seed + x * 374761393 + z * 668265263;
    h = (h ^ (h >> 13)) * 1274126177;
    return ((h ^ (h >> 16)) & 0x7fffffff) / 0x7fffffff;
  };
  const smooth = (t: number) => t * t * (3 - 2 * t);
  return (x: number, z: number) => {
    const xi = Math.floor(x);
    const zi = Math.floor(z);
    const xf = x - xi;
    const zf = z - zi;
    const a = hash(xi, zi);
    const b = hash(xi + 1, zi);
    const c = hash(xi, zi + 1);
    const d = hash(xi + 1, zi + 1);
    const u = smooth(xf);
    const v = smooth(zf);
    return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
  };
}

/** Generates base terrain: bedrock floor, stone core, dirt, grass top, water pools, caves. */
export function generateTerrain(seed = 42): World {
  const world = new World();
  const hills = valueNoise2D(seed);
  const hills2 = valueNoise2D(seed + 999);
  const caves = valueNoise2D(seed + 4242);

  const scale = 0.045; // hill frequency

  for (let x = 0; x < WORLD_SIZE; x++) {
    for (let z = 0; z < WORLD_SIZE; z++) {
      // rolling hills: two octaves
      const h =
        SEA_LEVEL +
        2 +
        Math.floor(hills(x * scale, z * scale) * 10 + hills2(x * scale * 2.3, z * scale * 2.3) * 4);

      for (let y = 0; y <= h; y++) {
        let block: BlockId;
        if (y === 0) block = BlockId.Bedrock;
        else if (y < h - 3) block = BlockId.Stone;
        else if (y < h) block = BlockId.Dirt;
        else block = BlockId.Grass;

        // caves: carve where cave noise is strong underground
        if (y > 1 && y < h - 2) {
          const c = caves(x * 0.08, y * 0.11) * 0.6 + caves(y * 0.09, z * 0.08) * 0.6;
          if (c > 0.62) block = BlockId.Air;
        }

        world.set(x, y, z, block);
      }
      // water fills up to sea level where terrain dips below it
      for (let y = h + 1; y <= SEA_LEVEL; y++) world.set(x, y, z, BlockId.Water);
    }
  }
  return world;
}

/** Scatters voxel oak trees on grass with space to grow. */
export function plantTrees(world: World, seed = 777, count = 90): void {
  const rng = makeRng(seed);
  let placed = 0;
  let attempts = 0;
  while (placed < count && attempts < count * 30) {
    attempts++;
    const x = 3 + Math.floor(rng() * (WORLD_SIZE - 6));
    const z = 3 + Math.floor(rng() * (WORLD_SIZE - 6));
    const y = world.surfaceY(x, z);
    if (y < 0) continue;
    if (world.get(x, y, z) !== BlockId.Grass) continue;
    if (y + 7 >= WORLD_HEIGHT) continue;
    // avoid crowding: check a 2-block radius trunk-free
    let clear = true;
    for (let dx = -2; dx <= 2 && clear; dx++)
      for (let dz = -2; dz <= 2 && clear; dz++) {
        const sy = world.surfaceY(x + dx, z + dz);
        if (sy >= 0 && world.get(x + dx, sy, z + dz) === BlockId.OakLog) clear = false;
      }
    if (!clear) continue;

    const trunk = 4 + Math.floor(rng() * 3);
    for (let i = 1; i <= trunk; i++) world.set(x, y + i, z, BlockId.OakLog);
    // leaf canopy: layered blob
    const top = y + trunk;
    for (let dy = -2; dy <= 1; dy++) {
      const r = dy <= -1 ? 2 : 1;
      for (let dx = -r; dx <= r; dx++)
        for (let dz = -r; dz <= r; dz++) {
          if (Math.abs(dx) === r && Math.abs(dz) === r && (dy > -1 || rng() > 0.5)) continue; // clipped corners
          if (world.get(x + dx, top + dy, z + dz) === BlockId.Air) world.set(x + dx, top + dy, z + dz, BlockId.OakLeaves);
        }
    }
    placed++;
  }
}

function makeRng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

/** Interface for the JSON world save format. */
export interface WorldSave {
  magic: 'mc-web-edition-world';
  version: 1;
  seed: number;
  size: { x: number; z: number; y: number };
  /** Sparse diff from generated terrain: only player-modified blocks. */
  edits: Array<{ x: number; y: number; z: number; id: number }>;
  player: { x: number; y: number; z: number; yaw: number; pitch: number };
}

/** Diffs current world against a fresh generated one to produce a sparse edit list. */
export function diffAgainstTerrain(world: World, seed: number): WorldSave['edits'] {
  const base = generateTerrain(seed);
  plantTrees(base, seed + 1);
  const edits: WorldSave['edits'] = [];
  for (let y = 0; y < WORLD_HEIGHT; y++)
    for (let z = 0; z < WORLD_SIZE; z++)
      for (let x = 0; x < WORLD_SIZE; x++) {
        const a = world.get(x, y, z);
        if (a !== base.get(x, y, z)) edits.push({ x, y, z, id: a });
      }
  return edits;
}

/** Applies a save's edits onto a freshly generated world. */
export function applySave(world: World, save: WorldSave): void {
  for (const e of save.edits) world.set(e.x, e.y, e.z, e.id as BlockId);
}
