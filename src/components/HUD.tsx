import { useMemo, useState } from 'react';
import { BLOCKS, BlockId } from '@/game/blocks';
// 🔌 CONNECTION POINT: textures.ts should export getBlockIcon(blockId) -> string (dataURL/URL)
// of a pre-rendered isometric 3D cube icon. If it's not available yet, we fall back to a
// CSS isometric cube built from the color bands below.
// import { getBlockIcon } from '@/game/textures';

/* ------------------------------------------------------------------ */
/*  Color palettes (fallback for the CSS isometric cube)               */
/* ------------------------------------------------------------------ */
const TOP_COLORS: Record<number, string> = {
  1: '#5e9d34', 2: '#86603f', 3: '#7d7d7d', 4: '#8a6a3c', 5: '#3c7828', 6: '#464646',
  7: '#3f7fd8', 8: '#a04637', 9: '#6e6e6e', 10: '#a2824e', 11: '#dbcf9f', 12: '#d0c390',
  13: '#887e7e', 14: '#cfe8f0', 15: '#4a4a4a', 16: '#6a5a3a', 17: '#8f6a4a', 18: '#8a7a3a',
  19: '#7a6a8a', 20: '#a05a4a', 21: '#f5fafc', 22: '#96c8f0', 23: '#181226', 24: '#be2823',
  25: '#8c693c', 26: '#826938', 27: '#a2824e', 28: '#c4b446', 29: '#e1781e', 30: '#6eaa28',
  31: '#a0a6b2', 32: '#6e2828', 33: '#ebebeb', 34: '#b4322d', 35: '#374bb4', 36: '#e1c83c',
  37: '#468237', 38: '#232326', 39: '#967846',
};
const SIDE_COLORS: Record<number, string> = {
  1: '#8a6a3c', 2: '#75543a', 3: '#6e6e6e', 4: '#68522f', 5: '#2f5c20', 6: '#333333',
  7: '#3568b4', 8: '#7d3a2e', 9: '#5a5a5a', 10: '#8a6f42', 11: '#c4b890', 12: '#b8ab82',
  13: '#746a6a', 14: '#b8d8e4', 15: '#3a3a28', 16: '#7a5a3e', 17: '#78683a', 18: '#786a88',
  19: '#88483e', 20: '#e0e6ea', 21: '#82b4dc', 22: '#100c1a', 23: '#9a2018', 24: '#7a5a34',
  25: '#6e5830', 26: '#a4943c', 27: '#c26818', 28: '#5a8a22', 29: '#8e94a0', 30: '#5a2020',
  31: '#d0d0d0', 32: '#98281f', 33: '#2c3a90', 34: '#c0a830', 35: '#3a6e2c', 36: '#1c1c20',
  37: '#7e6238',
};

/* ------------------------------------------------------------------ */
/*  Block classification helpers                                      */
/* ------------------------------------------------------------------ */
// Non-cube items that should render as flat sprites, not 3D cubes.
const FLAT_SPRITE_IDS = new Set<number>([12, 29, 30, 31, 32, 33, 34, 35, 36]);
// 12 = Torch-ish?, adjust as needed. Based on BLOCKS naming below we match by name instead,
// to be robust regardless of numeric ids.

const FLAT_SPRITE_NAMES = new Set<string>([
  'Torch',
  'Poppy',
  'Dandelion',
  'Tall Grass',
  'Cactus',
  'Dead Bush',
  'Snow Layer',
]);

function isFlatSprite(id: BlockId): boolean {
  const name = BLOCKS[id]?.name ?? '';
  return FLAT_SPRITE_NAMES.has(name);
}

/* ------------------------------------------------------------------ */
/*  Category classification                                           */
/* ------------------------------------------------------------------ */
type Category = 'All' | 'Building' | 'Nature' | 'Ores' | 'Decoration' | 'Special';
const CATEGORIES: Category[] = ['All', 'Building', 'Nature', 'Ores', 'Decoration', 'Special'];

const BUILDING_NAMES = new Set<string>([
  'Stone', 'Cobblestone', 'Oak Planks', 'Birch Planks', 'Spruce Planks', 'Sandstone',
  'Bricks', 'Stone Bricks', 'Glass', 'Oak Log', 'Birch Log', 'Spruce Log', 'Obsidian',
  'Netherrack', 'Soul Sand', 'Gravel', 'Clay', 'Snow', 'Ice', 'Packed Ice', 'Bookshelf',
  'Glowstone',
]);
const NATURE_NAMES = new Set<string>([
  'Grass', 'Dirt', 'Sand', 'Oak Leaves', 'Birch Leaves', 'Spruce Leaves', 'Cactus',
  'Poppy', 'Dandelion', 'Tall Grass', 'Dead Bush', 'Snow Layer', 'Water', 'Lava',
]);
const ORE_NAMES = new Set<string>([
  'Coal Ore', 'Iron Ore', 'Gold Ore', 'Diamond Ore', 'Redstone Ore', 'Lapis Ore',
  'Emerald Ore',
]);
const DECORATION_NAMES = new Set<string>([
  'Torch', 'Glowstone', 'Bookshelf', 'Poppy', 'Dandelion', 'Tall Grass',
]);
const SPECIAL_NAMES = new Set<string>([
  'Bedrock', 'TNT', 'Crafting Table', 'Furnace', 'Spawner', 'Obsidian', 'Nether Portal',
]);

function categoryOf(id: BlockId): Category {
  const name = BLOCKS[id]?.name ?? '';
  if (ORE_NAMES.has(name)) return 'Ores';
  if (NATURE_NAMES.has(name)) return 'Nature';
  if (DECORATION_NAMES.has(name)) return 'Decoration';
  if (SPECIAL_NAMES.has(name)) return 'Special';
  if (BUILDING_NAMES.has(name)) return 'Building';
  // Fallback heuristics based on name keywords
  if (/Ore/i.test(name)) return 'Ores';
  if (/(Leaves|Grass|Flower|Poppy|Dandelion|Bush|Cactus|Sand|Dirt)/i.test(name)) return 'Nature';
  if (/(Torch|Glow|Bookshelf|Flower)/i.test(name)) return 'Decoration';
  if (/(Bedrock|TNT|Furnace|Table|Spawner|Portal)/i.test(name)) return 'Special';
  return 'Building';
}

/* ------------------------------------------------------------------ */
/*  BlockIcon — 3D isometric cube (or flat sprite for non-cubes)      */
/* ------------------------------------------------------------------ */
interface BlockIconProps {
  id: BlockId;
  size?: number;
  /** When true, render as a flat sprite regardless of type (used for hotbar maybe). */
  forceFlat?: boolean;
}

export function BlockIcon({ id, size = 40, forceFlat = false }: BlockIconProps) {
  const top = TOP_COLORS[id] ?? '#888';
  const side = SIDE_COLORS[id] ?? '#666';

  // 🔌 CONNECTION POINT for textures.ts isometric icon generator.
  // getBlockIcon(id) is expected to return a dataURL/URL of a pre-rendered
  // isometric 3D cube. Uncomment the import at the top and the line below
  // once that function is available. For now we build the cube with CSS.
  // const iconUrl = getBlockIcon(id);
  const iconUrl: string | undefined = undefined; // <-- replaced by getBlockIcon(id)

  const flat = forceFlat || isFlatSprite(id);
  const isOre = [15, 16, 17, 18, 19].includes(id) || /Ore/i.test(BLOCKS[id]?.name ?? '');
  const glow = id === 37 || /Glowstone/i.test(BLOCKS[id]?.name ?? '');

  // ---- Flat sprite rendering (Torch, flowers, etc.) ----
  if (flat && !iconUrl) {
    return (
      <div
        className="relative flex items-center justify-center overflow-hidden"
        style={{ width: size, height: size }}
      >
        {/* Simple sprite built from shapes, colored by block palette */}
        <div className="relative h-3/4 w-3/4">
          <div
            className="absolute bottom-0 left-1/2 -translate-x-1/2 rounded-sm"
            style={{ width: '45%', height: '75%', background: side }}
          />
          <div
            className="absolute left-1/2 top-0 -translate-x-1/2 rounded-full"
            style={{ width: '70%', height: '45%', background: top }}
          />
          {glow && <div className="absolute inset-0 animate-pulse bg-yellow-200/30" />}
        </div>
      </div>
    );
  }

  // ---- If textures.ts provided a pre-rendered isometric icon, use it ----
  if (iconUrl) {
    return (
      <img
        src={iconUrl}
        alt={BLOCKS[id]?.name ?? 'block'}
        draggable={false}
        style={{ width: size, height: size, imageRendering: 'pixelated' }}
        className="select-none"
      />
    );
  }

  // ---- CSS isometric 3D cube fallback ----
  // A cube has 3 visible faces: top (brightest), left (medium), right (darkest).
  const cubeSize = size * 0.78;
  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: size, height: size, perspective: 200 }}
      aria-hidden
    >
      <div
        className="relative"
        style={{
          width: cubeSize * 0.58,
          height: cubeSize * 0.58,
          transformStyle: 'preserve-3d',
          transform: 'rotateX(-30deg) rotateY(45deg)',
        }}
      >
        {/* Top face — brightest */}
        <div
          className="absolute"
          style={{
            width: cubeSize * 0.58,
            height: cubeSize * 0.58,
            background: top,
            transform: `rotateX(90deg) translateZ(${cubeSize * 0.29}px)`,
            filter: 'brightness(1.15)',
          }}
        />
        {/* Left face — medium */}
        <div
          className="absolute"
          style={{
            width: cubeSize * 0.58,
            height: cubeSize * 0.58,
            background: side,
            transform: `rotateY(-90deg) translateZ(${cubeSize * 0.29}px)`,
            filter: 'brightness(0.9)',
          }}
        />
        {/* Right face — darkest */}
        <div
          className="absolute"
          style={{
            width: cubeSize * 0.58,
            height: cubeSize * 0.58,
            background: side,
            transform: `translateZ(${cubeSize * 0.29}px)`,
            filter: 'brightness(0.72)',
          }}
        />
        {/* Ore speckles on top face */}
        {isOre && (
          <div
            className="pointer-events-none absolute"
            style={{
              width: cubeSize * 0.58,
              height: cubeSize * 0.58,
              transform: `rotateX(90deg) translateZ(${cubeSize * 0.295}px)`,
              backgroundImage: `radial-gradient(circle at 25% 30%, ${top} 0 2px, transparent 3px),
                                radial-gradient(circle at 70% 60%, ${top} 0 2px, transparent 3px),
                                radial-gradient(circle at 45% 80%, ${top} 0 1.5px, transparent 3px)`,
              filter: 'brightness(1.4)',
            }}
          />
        )}
      </div>
      {glow && <div className="pointer-events-none absolute inset-0 animate-pulse bg-yellow-200/20" />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Minecraft-style slot                                              */
/* ------------------------------------------------------------------ */
interface SlotProps {
  children: React.ReactNode;
  selected?: boolean;
  onClick?: () => void;
  onTouchEnd?: (e: React.TouchEvent) => void;
  title?: string;
  className?: string;
  size?: number;
}

function MinecraftSlot({
  children,
  selected = false,
  onClick,
  onTouchEnd,
  title,
  className = '',
  size = 48,
}: SlotProps) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      onTouchEnd={onTouchEnd}
      style={{ width: size, height: size }}
      className={`group relative flex items-center justify-center border-2 ${
        selected
          ? 'border-white bg-white/20'
          : 'border-t-stone-400 border-l-stone-400 border-b-stone-900 border-r-stone-900 bg-stone-600/80'
      } hover:border-t-stone-300 hover:border-l-stone-300 hover:bg-stone-500/80 ${className}`}
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Hotbar                                                            */
/* ------------------------------------------------------------------ */
interface HotbarProps {
  slots: BlockId[];
  selected: number;
  onSelect: (i: number) => void;
}

export function Hotbar({ slots, selected, onSelect }: HotbarProps) {
  return (
    <div className="pointer-events-auto fixed bottom-2 left-1/2 z-30 flex -translate-x-1/2 gap-1 rounded border-2 border-black/60 bg-black/50 p-1 backdrop-blur-sm">
      {slots.map((id, i) => (
        <MinecraftSlot
          key={i}
          selected={selected === i}
          onClick={() => onSelect(i)}
          onTouchEnd={(e) => {
            e.preventDefault();
            onSelect(i);
          }}
          title={BLOCKS[id]?.name}
          size={48}
        >
          <BlockIcon id={id} size={36} />
          <span className="pointer-events-none absolute bottom-0 right-1 text-[10px] font-bold text-white/80">
            {i + 1}
          </span>
        </MinecraftSlot>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Tooltip                                                           */
/* ------------------------------------------------------------------ */
function Tooltip({ label }: { label: string }) {
  return (
    <span
      role="tooltip"
      className="pointer-events-none absolute -top-7 left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded border border-purple-300/40 bg-[#100010]/95 px-2 py-0.5 text-[11px] font-medium text-white shadow-lg"
    >
      {label}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  InventoryPanel                                                    */
/* ------------------------------------------------------------------ */
interface InventoryProps {
  allBlocks: BlockId[];
  onSelect: (id: BlockId) => void;
  onClose: () => void;
  selectedSlot: number;
}

export function InventoryPanel({ allBlocks, onSelect, onClose, selectedSlot }: InventoryProps) {
  const [activeCategory, setActiveCategory] = useState<Category>('All');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allBlocks.filter((id) => {
      const name = BLOCKS[id]?.name ?? '';
      const matchesCategory = activeCategory === 'All' || categoryOf(id) === activeCategory;
      const matchesSearch = q === '' || name.toLowerCase().includes(q);
      return matchesCategory && matchesSearch;
    });
  }, [allBlocks, activeCategory, search]);

  return (
    <div
      className="game-buttons absolute inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
      onTouchEnd={(e) => {
        if (e.target === e.currentTarget) {
          e.preventDefault();
          onClose();
        }
      }}
    >
      <div
        className="game-buttons flex max-h-[80vh] w-[min(720px,94vw)] flex-col overflow-hidden rounded-lg border-4 border-black/60 bg-stone-800/95"
        onClick={(e) => e.stopPropagation()}
        onTouchEnd={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-black/40 px-4 py-3">
          <h2 className="text-lg font-bold text-white">Creative Inventory</h2>
          <button
            className="game-buttons rounded border-b-2 border-red-900 bg-red-700 px-3 py-1.5 text-sm font-bold text-white hover:bg-red-600 active:border-b-0"
            onClick={onClose}
            onTouchEnd={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onClose();
            }}
          >
            Close (E)
          </button>
        </div>

        {/* Search + hint */}
        <div className="flex flex-col gap-2 px-4 pt-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search blocks..."
            className="w-full rounded border-2 border-stone-600 bg-stone-900/80 px-3 py-1.5 text-sm text-white placeholder-stone-500 outline-none focus:border-stone-400"
          />
          <p className="text-xs text-stone-400">
            Tap a block to put it in hotbar slot {selectedSlot + 1}. Press E or ESC to close.
          </p>
        </div>

        {/* Category tabs */}
        <div className="flex flex-wrap gap-1 px-4 pt-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategory(cat)}
              onTouchEnd={(e) => {
                e.preventDefault();
                setActiveCategory(cat);
              }}
              className={`rounded-t border-2 border-b-0 px-3 py-1 text-xs font-semibold transition-colors ${
                activeCategory === cat
                  ? 'border-stone-400 bg-stone-600 text-white'
                  : 'border-stone-700 bg-stone-900/60 text-stone-400 hover:bg-stone-700/60 hover:text-stone-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-auto border-t-2 border-stone-500/60 bg-stone-900/40 p-4">
          {filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-stone-500">No blocks match your search.</p>
          ) : (
            <div className="grid grid-cols-6 gap-2 sm:grid-cols-8">
              {filtered.map((id) => (
                <MinecraftSlot
                  key={id}
                  title={BLOCKS[id]?.name}
                  onClick={() => onSelect(id)}
                  onTouchEnd={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onSelect(id);
                  }}
                  size={56}
                  className="flex-col"
                >
                  <BlockIcon id={id} size={38} />
                  <span className="pointer-events-none w-full truncate text-center text-[9px] leading-tight text-stone-300">
                    {BLOCKS[id]?.name}
                  </span>
                  <span className="opacity-0 group-hover:opacity-100">
                    <Tooltip label={BLOCKS[id]?.name ?? 'Unknown'} />
                  </span>
                </MinecraftSlot>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}