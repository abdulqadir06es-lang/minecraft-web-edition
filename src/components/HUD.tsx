import { BLOCKS, BlockId } from '@/game/blocks';

/** Small 2D block icon: colored top + side bands per block id. */
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

export function BlockIcon({ id, size = 40 }: { id: BlockId; size?: number }) {
  const top = TOP_COLORS[id] ?? '#888';
  const side = SIDE_COLORS[id] ?? '#666';
  const isOre = [15, 16, 17, 18, 19].includes(id);
  const glow = id === 37;
  return (
    <div className="relative overflow-hidden rounded-sm border border-black/50" style={{ width: size * 0.8, height: size * 0.8 }}>
      <div className="h-1/2 w-full" style={{ background: top }} />
      <div className="h-1/2 w-full" style={{ background: side }} />
      {isOre && (
        <div className="absolute inset-0">
          <span className="absolute left-1/4 top-1/3 h-1 w-1.5 rounded-full" style={{ background: top, filter: 'brightness(1.3)' }} />
          <span className="absolute right-1/4 bottom-1/4 h-1.5 w-1 rounded-full" style={{ background: top, filter: 'brightness(1.2)' }} />
        </div>
      )}
      {glow && <div className="absolute inset-0 animate-pulse bg-yellow-200/30" />}
    </div>
  );
}

interface HotbarProps {
  slots: BlockId[];
  selected: number;
  onSelect: (i: number) => void;
}

export function Hotbar({ slots, selected, onSelect }: HotbarProps) {
  return (
    <div className="pointer-events-auto fixed bottom-2 left-1/2 z-30 flex -translate-x-1/2 gap-1 rounded border-2 border-black/60 bg-black/50 p-1 backdrop-blur-sm">
      {slots.map((id, i) => (
        <button
          key={i}
          onClick={() => onSelect(i)}
          onTouchEnd={(e) => {
            e.preventDefault();
            onSelect(i);
          }}
          className={`relative flex h-12 w-12 items-center justify-center border-2 ${
            selected === i ? 'border-white bg-white/20' : 'border-stone-600/60 bg-black/30'
          } hover:bg-white/10`}
          title={BLOCKS[id]?.name}
        >
          <BlockIcon id={id} size={36} />
          <span className="absolute bottom-0 right-0.5 text-[10px] font-bold text-white/80">{i + 1}</span>
        </button>
      ))}
    </div>
  );
}

interface InventoryProps {
  allBlocks: BlockId[];
  onSelect: (id: BlockId) => void;
  onClose: () => void;
  selectedSlot: number;
}

export function InventoryPanel({ allBlocks, onSelect, onClose, selectedSlot }: InventoryProps) {
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
        className="game-buttons max-h-[80vh] w-[min(680px,94vw)] overflow-auto rounded-lg border-4 border-black/60 bg-stone-800/95 p-5"
        onClick={(e) => e.stopPropagation()}
        onTouchEnd={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
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
        <p className="mb-3 text-xs text-stone-400">
          Tap a block to put it in hotbar slot {selectedSlot + 1}. Press E or ESC to close.
        </p>
        <div className="grid grid-cols-6 gap-2 sm:grid-cols-8">
          {allBlocks.map((id) => (
            <button
              key={id}
              title={BLOCKS[id]?.name}
              className="game-buttons flex flex-col items-center gap-1 rounded border-2 border-stone-600/60 bg-black/30 p-1.5 hover:border-white hover:bg-white/10"
              onClick={() => onSelect(id)}
              onTouchEnd={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onSelect(id);
              }}
            >
              <BlockIcon id={id} size={36} />
              <span className="w-full truncate text-center text-[9px] leading-tight text-stone-300">{BLOCKS[id]?.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
