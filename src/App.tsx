import { useCallback, useEffect, useRef, useState } from 'react';
import { Game } from '@/game/Game';
import { allBlockIds, BLOCKS, BlockId, DEFAULT_HOTBAR } from '@/game/blocks';
import { UserProfile, getSession, getSkin, setSkin, startSession } from '@/game/storage';
import { useControls } from '@/hooks/useControls';
import { TitleScreen } from '@/components/TitleScreen';
import { Hotbar, InventoryPanel, BlockIcon } from '@/components/HUD';
import { PauseMenu } from '@/components/PauseMenu';
import { TouchControls } from '@/components/TouchControls';

type Phase = 'title' | 'playing' | 'paused';
const HOTBAR_SLOTS = 9;
const ALL_BLOCKS = allBlockIds();

function App() {
  const [phase, setPhase] = useState<Phase>('title');
  const [profile, setProfile] = useState<UserProfile | null>(() => getSession());
  const [fps, setFps] = useState(0);
  const [dayFactor, setDayFactor] = useState(1);
  const [target, setTarget] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState(0);
  const [hotbar, setHotbar] = useState<BlockId[]>([...DEFAULT_HOTBAR]);
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [touch] = useState(() => 'ontouchstart' in window || navigator.maxTouchPoints > 0);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);

  const startGame = useCallback((p: UserProfile) => {
    setProfile(p);
    startSession(p);
    setSkin(p.username, getSkin(p.username));
    setPhase('playing');
  }, []);

  // create / destroy the game when entering play
  useEffect(() => {
    if (phase !== 'playing' || !canvasRef.current || gameRef.current) return;
    const game = new Game(canvasRef.current, profile?.username ?? 'Guest', {
      onFps: setFps,
      onTime: setDayFactor,
      onTarget: setTarget,
    });
    gameRef.current = game;
    game.start();
    game.setSelectedSlot(0);

    return () => {
      if (document.pointerLockElement) document.exitPointerLock();
      game.dispose();
      gameRef.current = null;
    };
  }, [phase, profile]);

  const selectSlot = useCallback((slot: number) => {
    const next = ((slot % HOTBAR_SLOTS) + HOTBAR_SLOTS) % HOTBAR_SLOTS;
    setSelectedSlot(next);
    gameRef.current?.setSelectedSlot(next);
  }, []);

  const toggleInventory = useCallback(() => {
    setInventoryOpen((open) => !open);
    if (document.pointerLockElement) document.exitPointerLock();
  }, []);

  useControls(gameRef, phase === 'playing', selectSlot, toggleInventory);

  // pause/resume game loop + close inventory when paused
  useEffect(() => {
    const game = gameRef.current;
    if (!game) return;
    if (phase === 'playing') game.start();
    else {
      game.stop();
      setInventoryOpen(false);
      if (document.pointerLockElement) document.exitPointerLock();
    }
  }, [phase]);

  // ESC closes inventory
  useEffect(() => {
    if (!inventoryOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setInventoryOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [inventoryOpen]);

  const pickBlock = (id: BlockId) => {
    setHotbar((h) => {
      const next = [...h];
      next[selectedSlot] = id;
      return next;
    });
    gameRef.current?.setHotbarSlot(selectedSlot, id);
    setInventoryOpen(false);
  };

  const quit = () => setPhase('title');

  return (
    <div className="fixed inset-0 overflow-hidden bg-black font-mono">
      {phase !== 'title' && (
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" style={{ touchAction: 'none' }} />
      )}

      {phase === 'playing' && profile && (
        <>
          <div className="pointer-events-none fixed inset-x-0 top-0 z-30 flex items-center justify-between px-3 py-2">
            <div className="flex items-center gap-3 rounded bg-black/40 px-3 py-1.5 text-xs font-bold text-white backdrop-blur-sm">
              <span className="text-emerald-300">{fps} FPS</span>
              <span className="text-stone-300">{profile.username}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                className="pointer-events-auto flex items-center gap-2 rounded bg-black/40 px-3 py-1.5 text-sm font-bold text-white backdrop-blur-sm hover:bg-black/60"
                onClick={toggleInventory}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  toggleInventory();
                }}
              >
                Inventory
              </button>
              <span className="pointer-events-none rounded bg-black/40 px-2 py-1.5 text-lg backdrop-blur-sm" title={dayFactor > 0.35 ? 'Day' : 'Night'}>
                {dayFactor > 0.35 ? '☀️' : '🌙'}
              </span>
              <button
                className="pointer-events-auto flex items-center gap-2 rounded bg-black/40 px-3 py-1.5 text-sm font-bold text-white backdrop-blur-sm hover:bg-black/60"
                onClick={() => setPhase('paused')}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  setPhase('paused');
                }}
              >
                Pause
              </button>
            </div>
          </div>

          {/* crosshair */}
          <div className="pointer-events-none fixed left-1/2 top-1/2 z-30 -translate-x-1/2 -translate-y-1/2">
            <div className="relative h-6 w-6 opacity-80">
              <div className="absolute left-1/2 top-0 h-full w-0.5 -translate-x-1/2 bg-white mix-blend-difference" />
              <div className="absolute top-1/2 left-0 h-0.5 w-full -translate-y-1/2 bg-white mix-blend-difference" />
            </div>
          </div>

          {target && !touch && (
            <div className="pointer-events-none fixed left-1/2 top-[58%] z-30 -translate-x-1/2 rounded bg-black/40 px-2 py-1 text-xs text-stone-200">
              {target}
            </div>
          )}

          <div className="pointer-events-auto fixed bottom-2 left-1/2 z-30 flex -translate-x-1/2 gap-1 rounded border-2 border-black/60 bg-black/50 p-1 backdrop-blur-sm">
            {hotbar.map((id, i) => (
              <button
                key={i}
                onClick={() => selectSlot(i)}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  selectSlot(i);
                }}
                className={`relative flex h-12 w-12 items-center justify-center border-2 ${
                  selectedSlot === i ? 'border-white bg-white/20' : 'border-stone-600/60 bg-black/30'
                } hover:bg-white/10`}
                title={BLOCKS[id]?.name}
              >
                <BlockIcon id={id} size={36} />
                <span className="absolute bottom-0 right-0.5 text-[10px] font-bold text-white/80">{i + 1}</span>
              </button>
            ))}
          </div>

          {touch && <TouchControls gameRef={gameRef} />}
          {!touch && !inventoryOpen && (
            <p className="pointer-events-none fixed bottom-20 left-1/2 z-30 -translate-x-1/2 rounded bg-black/35 px-3 py-1 text-[11px] text-stone-300">
              WASD move · Space jump · Ctrl sprint · Click dig · Right-click place · E inventory · F5 view · Esc pause
            </p>
          )}
        </>
      )}

      {inventoryOpen && phase === 'playing' && (
        <InventoryPanel
          allBlocks={ALL_BLOCKS}
          onSelect={pickBlock}
          onClose={() => setInventoryOpen(false)}
          selectedSlot={selectedSlot}
        />
      )}

      {phase === 'paused' && profile && gameRef.current && (
        <PauseMenu game={gameRef.current} onResume={() => setPhase('playing')} onQuit={quit} username={profile.username} />
      )}

      {phase === 'title' && (
        <div
          className="absolute inset-0 z-40"
          style={{
            background:
              'repeating-conic-gradient(#5a5a5a 0% 25%, #6e6e6e 0% 50%) 50% / 32px 32px, linear-gradient(#3a3a3a, #1a1a1a)',
            imageRendering: 'pixelated',
          }}
        >
          <div className="absolute inset-0 bg-black/55" />
          <div className="relative h-full w-full">
            <TitleScreen onPlay={startGame} />
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
