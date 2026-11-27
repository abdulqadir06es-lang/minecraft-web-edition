/** Block type ids — stable, used in world save files. Never renumber existing ids. */
export const BlockId = {
  Air: 0,
  Grass: 1,
  Dirt: 2,
  Stone: 3,
  OakLog: 4,
  OakLeaves: 5,
  Bedrock: 6,
  Water: 7,
  Bricks: 8,
  Cobblestone: 9,
  OakPlanks: 10,
  Sand: 11,
  Sandstone: 12,
  Gravel: 13,
  Glass: 14,
  CoalOre: 15,
  IronOre: 16,
  GoldOre: 17,
  DiamondOre: 18,
  RedstoneOre: 19,
  Snow: 20,
  Ice: 21,
  Obsidian: 22,
  TNT: 23,
  CraftingTable: 24,
  Bookshelf: 25,
  Sponge: 26,
  Pumpkin: 27,
  Melon: 28,
  Clay: 29,
  Netherrack: 30,
  WoolWhite: 31,
  WoolRed: 32,
  WoolBlue: 33,
  WoolYellow: 34,
  WoolGreen: 35,
  WoolBlack: 36,
  Glowstone: 37,
  // --- v3 additions ---
  EmeraldOre: 38,
  LapisOre: 39,
  Lava: 40,
  Torch: 41,
  FlowerRed: 42,
  FlowerYellow: 43,
  TallGrass: 44,
  Cactus: 45,
  SpruceLeaves: 46,
  SnowLayer: 47,
  DeadBush: 48,
} as const;
export type BlockId = (typeof BlockId)[keyof typeof BlockId];

/** How a block is rendered. */
export enum RenderKind {
  Cube = 0, // normal full cube
  Cross = 1, // two intersecting quads (flowers, grass)
  Torch = 2, // small stick + emissive tip
  Liquid = 3, // lowered top surface, no collision
}

export interface BlockDef {
  id: BlockId;
  name: string;
  /** Tiles per face: +X, -X, +Y (top), -Y (bottom), +Z, -Z */
  faces: [number, number, number, number, number, number];
  /** Neighbour faces stay visible through this block. */
  transparent?: boolean;
  solid: boolean; // collides with player
  breakable: boolean; // bedrock is not breakable
  emissive?: boolean; // rendered unlit / full-bright
  lightLevel?: number; // 0..1, used by flood-fill lighting
  kind?: RenderKind;
  /** Gravity-affected: falls when support is removed (sand, gravel). */
  gravity?: boolean;
  /** Deals damage on contact (cactus, lava). */
  damage?: number;
  /** Instant break (plants). */
  instant?: boolean;
}

/** Tile indices into the atlas grid, assigned by textures.ts in the same order. */
export const TILE = {
  grassTop: 0,
  grassSide: 1,
  dirt: 2,
  stone: 3,
  cobblestone: 4,
  logSide: 5,
  logTop: 6,
  planks: 7,
  leaves: 8,
  sand: 9,
  sandstoneTop: 10,
  sandstoneSide: 11,
  gravel: 12,
  glass: 13,
  bricks: 14,
  bedrock: 15,
  water: 16,
  coalOre: 17,
  ironOre: 18,
  goldOre: 19,
  diamondOre: 20,
  redstoneOre: 21,
  snow: 22,
  ice: 23,
  obsidian: 24,
  tntSide: 25,
  tntTop: 26,
  craftingTop: 27,
  craftingSide: 28,
  bookshelf: 29,
  sponge: 30,
  pumpkinSide: 31,
  pumpkinTop: 32,
  pumpkinFace: 33,
  melonSide: 34,
  melonTop: 35,
  clay: 36,
  netherrack: 37,
  woolWhite: 38,
  woolRed: 39,
  woolBlue: 40,
  woolYellow: 41,
  woolGreen: 42,
  woolBlack: 43,
  glowstone: 44,
  // --- v3 additions ---
  emeraldOre: 45,
  lapisOre: 46,
  lava: 47,
  torch: 48,
  flowerRed: 49,
  flowerYellow: 50,
  tallGrass: 51,
  cactusSide: 52,
  cactusTop: 53,
  spruceLeaves: 54,
  snowLayer: 55,
  deadBush: 56,
} as const;

const t = TILE;

function uniform(id: BlockId, name: string, tile: number, opts?: Partial<BlockDef>): BlockDef {
  return {
    id,
    name,
    faces: [tile, tile, tile, tile, tile, tile],
    solid: true,
    breakable: true,
    ...opts,
  };
}

function byName(name: string): BlockId {
  return BlockId[name.replace(/ /g, '') as keyof typeof BlockId];
}
void byName;

export const BLOCKS: Record<number, BlockDef> = {
  [BlockId.Grass]: {
    id: BlockId.Grass,
    name: 'Grass Block',
    faces: [t.grassSide, t.grassSide, t.grassTop, t.dirt, t.grassSide, t.grassSide],
    solid: true,
    breakable: true,
  },
  [BlockId.Dirt]: uniform(BlockId.Dirt, 'Dirt', t.dirt),
  [BlockId.Stone]: uniform(BlockId.Stone, 'Stone', t.stone),
  [BlockId.Cobblestone]: uniform(BlockId.Cobblestone, 'Cobblestone', t.cobblestone),
  [BlockId.OakLog]: {
    id: BlockId.OakLog,
    name: 'Oak Log',
    faces: [t.logSide, t.logSide, t.logTop, t.logTop, t.logSide, t.logSide],
    solid: true,
    breakable: true,
  },
  [BlockId.OakPlanks]: uniform(BlockId.OakPlanks, 'Oak Planks', t.planks),
  [BlockId.OakLeaves]: uniform(BlockId.OakLeaves, 'Oak Leaves', t.leaves, { transparent: true }),
  [BlockId.Sand]: uniform(BlockId.Sand, 'Sand', t.sand, { gravity: true }),
  [BlockId.Sandstone]: {
    id: BlockId.Sandstone,
    name: 'Sandstone',
    faces: [t.sandstoneSide, t.sandstoneSide, t.sandstoneTop, t.sandstoneTop, t.sandstoneSide, t.sandstoneSide],
    solid: true,
    breakable: true,
  },
  [BlockId.Gravel]: uniform(BlockId.Gravel, 'Gravel', t.gravel, { gravity: true }),
  [BlockId.Glass]: uniform(BlockId.Glass, 'Glass', t.glass, { transparent: true }),
  [BlockId.Bricks]: uniform(BlockId.Bricks, 'Bricks', t.bricks),
  [BlockId.Bedrock]: uniform(BlockId.Bedrock, 'Bedrock', t.bedrock, { breakable: false }),
  [BlockId.Water]: uniform(BlockId.Water, 'Water', t.water, { transparent: true, solid: false, kind: RenderKind.Liquid }),
  [BlockId.CoalOre]: uniform(BlockId.CoalOre, 'Coal Ore', t.coalOre),
  [BlockId.IronOre]: uniform(BlockId.IronOre, 'Iron Ore', t.ironOre),
  [BlockId.GoldOre]: uniform(BlockId.GoldOre, 'Gold Ore', t.goldOre),
  [BlockId.DiamondOre]: uniform(BlockId.DiamondOre, 'Diamond Ore', t.diamondOre),
  [BlockId.RedstoneOre]: uniform(BlockId.RedstoneOre, 'Redstone Ore', t.redstoneOre),
  [BlockId.Snow]: uniform(BlockId.Snow, 'Snow Block', t.snow),
  [BlockId.Ice]: uniform(BlockId.Ice, 'Ice', t.ice, { transparent: true }),
  [BlockId.Obsidian]: uniform(BlockId.Obsidian, 'Obsidian', t.obsidian),
  [BlockId.TNT]: {
    id: BlockId.TNT,
    name: 'TNT',
    faces: [t.tntSide, t.tntSide, t.tntTop, t.tntTop, t.tntSide, t.tntSide],
    solid: true,
    breakable: true,
  },
  [BlockId.CraftingTable]: {
    id: BlockId.CraftingTable,
    name: 'Crafting Table',
    faces: [t.craftingSide, t.craftingSide, t.craftingTop, t.planks, t.craftingSide, t.craftingSide],
    solid: true,
    breakable: true,
  },
  [BlockId.Bookshelf]: {
    id: BlockId.Bookshelf,
    name: 'Bookshelf',
    faces: [t.bookshelf, t.bookshelf, t.planks, t.planks, t.bookshelf, t.bookshelf],
    solid: true,
    breakable: true,
  },
  [BlockId.Sponge]: uniform(BlockId.Sponge, 'Sponge', t.sponge),
  [BlockId.Pumpkin]: {
    id: BlockId.Pumpkin,
    name: 'Pumpkin',
    faces: [t.pumpkinSide, t.pumpkinSide, t.pumpkinTop, t.pumpkinTop, t.pumpkinFace, t.pumpkinSide],
    solid: true,
    breakable: true,
  },
  [BlockId.Melon]: {
    id: BlockId.Melon,
    name: 'Melon',
    faces: [t.melonSide, t.melonSide, t.melonTop, t.melonTop, t.melonSide, t.melonSide],
    solid: true,
    breakable: true,
  },
  [BlockId.Clay]: uniform(BlockId.Clay, 'Clay', t.clay),
  [BlockId.Netherrack]: uniform(BlockId.Netherrack, 'Netherrack', t.netherrack),
  [BlockId.WoolWhite]: uniform(BlockId.WoolWhite, 'Wool White', t.woolWhite),
  [BlockId.WoolRed]: uniform(BlockId.WoolRed, 'Wool Red', t.woolRed),
  [BlockId.WoolBlue]: uniform(BlockId.WoolBlue, 'Wool Blue', t.woolBlue),
  [BlockId.WoolYellow]: uniform(BlockId.WoolYellow, 'Wool Yellow', t.woolYellow),
  [BlockId.WoolGreen]: uniform(BlockId.WoolGreen, 'Wool Green', t.woolGreen),
  [BlockId.WoolBlack]: uniform(BlockId.WoolBlack, 'Wool Black', t.woolBlack),
  [BlockId.Glowstone]: uniform(BlockId.Glowstone, 'Glowstone', t.glowstone, { emissive: true, lightLevel: 1 }),
  // --- v3 additions ---
  [BlockId.EmeraldOre]: uniform(BlockId.EmeraldOre, 'Emerald Ore', t.emeraldOre),
  [BlockId.LapisOre]: uniform(BlockId.LapisOre, 'Lapis Lazuli', t.lapisOre),
  [BlockId.Lava]: uniform(BlockId.Lava, 'Lava', t.lava, {
    transparent: true,
    solid: false,
    kind: RenderKind.Liquid,
    emissive: true,
    lightLevel: 1,
    damage: 20,
  }),
  [BlockId.Torch]: {
    id: BlockId.Torch,
    name: 'Torch',
    faces: [t.torch, t.torch, t.torch, t.torch, t.torch, t.torch],
    transparent: true,
    solid: false,
    breakable: true,
    emissive: true,
    lightLevel: 0.9,
    kind: RenderKind.Torch,
    instant: true,
  },
  [BlockId.FlowerRed]: {
    id: BlockId.FlowerRed,
    name: 'Poppy',
    faces: [t.flowerRed, t.flowerRed, t.flowerRed, t.flowerRed, t.flowerRed, t.flowerRed],
    transparent: true,
    solid: false,
    breakable: true,
    kind: RenderKind.Cross,
    instant: true,
  },
  [BlockId.FlowerYellow]: {
    id: BlockId.FlowerYellow,
    name: 'Dandelion',
    faces: [t.flowerYellow, t.flowerYellow, t.flowerYellow, t.flowerYellow, t.flowerYellow, t.flowerYellow],
    transparent: true,
    solid: false,
    breakable: true,
    kind: RenderKind.Cross,
    instant: true,
  },
  [BlockId.TallGrass]: {
    id: BlockId.TallGrass,
    name: 'Tall Grass',
    faces: [t.tallGrass, t.tallGrass, t.tallGrass, t.tallGrass, t.tallGrass, t.tallGrass],
    transparent: true,
    solid: false,
    breakable: true,
    kind: RenderKind.Cross,
    instant: true,
  },
  [BlockId.Cactus]: {
    id: BlockId.Cactus,
    name: 'Cactus',
    faces: [t.cactusSide, t.cactusSide, t.cactusTop, t.cactusTop, t.cactusSide, t.cactusSide],
    transparent: true,
    solid: true,
    breakable: true,
    damage: 4,
  },
  [BlockId.SpruceLeaves]: uniform(BlockId.SpruceLeaves, 'Spruce Leaves', t.spruceLeaves, { transparent: true }),
  [BlockId.SnowLayer]: {
    id: BlockId.SnowLayer,
    name: 'Snow Layer',
    faces: [t.snowLayer, t.snowLayer, t.snowLayer, t.snowLayer, t.snowLayer, t.snowLayer],
    transparent: true,
    solid: false,
    breakable: true,
    instant: true,
  },
  [BlockId.DeadBush]: {
    id: BlockId.DeadBush,
    name: 'Dead Bush',
    faces: [t.deadBush, t.deadBush, t.deadBush, t.deadBush, t.deadBush, t.deadBush],
    transparent: true,
    solid: false,
    breakable: true,
    kind: RenderKind.Cross,
    instant: true,
  },
};

/** Default hotbar (9 slots, keys 1-9). */
export const DEFAULT_HOTBAR: BlockId[] = [
  BlockId.Grass,
  BlockId.Dirt,
  BlockId.Stone,
  BlockId.OakLog,
  BlockId.OakPlanks,
  BlockId.Glass,
  BlockId.Glowstone,
  BlockId.Torch,
  BlockId.TNT,
];

/** All placeable blocks for the creative inventory, in display order. */
export function allBlockIds(): BlockId[] {
  return Object.values(BLOCKS)
    .map((b) => b.id)
    .filter((id) => id !== BlockId.Air)
    .sort((a, b) => a - b);
}

export const isSolidId = (id: BlockId): boolean => BLOCKS[id]?.solid ?? false;
export const isTransparentId = (id: BlockId): boolean => BLOCKS[id]?.transparent ?? false;
