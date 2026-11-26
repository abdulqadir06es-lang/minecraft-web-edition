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
} as const;
export type BlockId = (typeof BlockId)[keyof typeof BlockId];

export interface BlockDef {
  id: BlockId;
  name: string;
  /** Tiles per face: +X, -X, +Y (top), -Y (bottom), +Z, -Z */
  faces: [number, number, number, number, number, number];
  /** Neighbour faces stay visible through this block (leaves, glass, water). */
  transparent?: boolean;
  solid: boolean; // collides with player
  breakable: boolean; // bedrock is not breakable
  /** Rendered unlit (glows). */
  emissive?: boolean;
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
} as const;

const t = TILE;

function uniform(name: string, tile: number, opts?: Partial<BlockDef>): BlockDef {
  return {
    id: BlockId[name as keyof typeof BlockId] as BlockId,
    name: name.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()).trim(),
    faces: [tile, tile, tile, tile, tile, tile],
    solid: true,
    breakable: true,
    ...opts,
  };
}

export const BLOCKS: Record<number, BlockDef> = {
  [BlockId.Grass]: {
    id: BlockId.Grass,
    name: 'Grass Block',
    faces: [t.grassSide, t.grassSide, t.grassTop, t.dirt, t.grassSide, t.grassSide],
    solid: true,
    breakable: true,
  },
  [BlockId.Dirt]: uniform('Dirt', t.dirt),
  [BlockId.Stone]: uniform('Stone', t.stone),
  [BlockId.Cobblestone]: uniform('Cobblestone', t.cobblestone),
  [BlockId.OakLog]: {
    id: BlockId.OakLog,
    name: 'Oak Log',
    faces: [t.logSide, t.logSide, t.logTop, t.logTop, t.logSide, t.logSide],
    solid: true,
    breakable: true,
  },
  [BlockId.OakPlanks]: uniform('Oak Planks', t.planks),
  [BlockId.OakLeaves]: uniform('Oak Leaves', t.leaves, { transparent: true }),
  [BlockId.Sand]: uniform('Sand', t.sand),
  [BlockId.Sandstone]: {
    id: BlockId.Sandstone,
    name: 'Sandstone',
    faces: [t.sandstoneSide, t.sandstoneSide, t.sandstoneTop, t.sandstoneTop, t.sandstoneSide, t.sandstoneSide],
    solid: true,
    breakable: true,
  },
  [BlockId.Gravel]: uniform('Gravel', t.gravel),
  [BlockId.Glass]: uniform('Glass', t.glass, { transparent: true }),
  [BlockId.Bricks]: uniform('Bricks', t.bricks),
  [BlockId.Bedrock]: uniform('Bedrock', t.bedrock, { breakable: false }),
  [BlockId.Water]: uniform('Water', t.water, { transparent: true, solid: false }),
  [BlockId.CoalOre]: uniform('Coal Ore', t.coalOre),
  [BlockId.IronOre]: uniform('Iron Ore', t.ironOre),
  [BlockId.GoldOre]: uniform('Gold Ore', t.goldOre),
  [BlockId.DiamondOre]: uniform('Diamond Ore', t.diamondOre),
  [BlockId.RedstoneOre]: uniform('Redstone Ore', t.redstoneOre),
  [BlockId.Snow]: uniform('Snow Block', t.snow),
  [BlockId.Ice]: uniform('Ice', t.ice, { transparent: true }),
  [BlockId.Obsidian]: uniform('Obsidian', t.obsidian),
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
  [BlockId.Sponge]: uniform('Sponge', t.sponge),
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
  [BlockId.Clay]: uniform('Clay', t.clay),
  [BlockId.Netherrack]: uniform('Netherrack', t.netherrack),
  [BlockId.WoolWhite]: uniform('Wool White', t.woolWhite),
  [BlockId.WoolRed]: uniform('Wool Red', t.woolRed),
  [BlockId.WoolBlue]: uniform('Wool Blue', t.woolBlue),
  [BlockId.WoolYellow]: uniform('Wool Yellow', t.woolYellow),
  [BlockId.WoolGreen]: uniform('Wool Green', t.woolGreen),
  [BlockId.WoolBlack]: uniform('Wool Black', t.woolBlack),
  [BlockId.Glowstone]: uniform('Glowstone', t.glowstone, { emissive: true }),
};

/** Blocks offered in the default hotbar (9 slots, keys 1-9). */
export const DEFAULT_HOTBAR: BlockId[] = [
  BlockId.Grass,
  BlockId.Dirt,
  BlockId.Stone,
  BlockId.OakLog,
  BlockId.OakPlanks,
  BlockId.Glass,
  BlockId.Bricks,
  BlockId.Glowstone,
  BlockId.TNT,
];

/** All placeable blocks for the creative inventory, in display order. */
export function allBlockIds(): BlockId[] {
  return Object.values(BLOCKS)
    .map((b) => b.id)
    .filter((id) => id !== BlockId.Air)
    .sort((a, b) => a - b);
}
