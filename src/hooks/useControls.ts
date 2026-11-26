import { useEffect, useRef } from 'react';
import { Game } from '@/game/Game';
import { isTouchDevice } from '@/game/input';

/** Wires desktop (keyboard + pointer lock mouse) and mobile (touch handled by UI components
 *  writing into the same InputState) controls to the game instance. */
export function useControls(
  gameRef: React.MutableRefObject<Game | null>,
  active: boolean,
  onSelectSlot: (slot: number) => void,
  onToggleInventory: () => void
): { touch: boolean } {
  const touch = useRef(isTouchDevice()).current;

  useEffect(() => {
    if (!active) return;
    const game = gameRef.current;
    if (!game) return;
    const input = game.inputState;

    const keys = new Set<string>();
    const applyKeys = () => {
      input.moveX = (keys.has('d') || keys.has('arrowright') ? 1 : 0) - (keys.has('a') || keys.has('arrowleft') ? 1 : 0);
      // forward (W/Up) sets moveZ = +1; Game.ts converts +forward to camera direction
      input.moveZ = (keys.has('w') || keys.has('arrowup') ? 1 : 0) - (keys.has('s') || keys.has('arrowdown') ? 1 : 0);
      input.jump = keys.has(' ');
      input.sneak = keys.has('shift') && !keys.has('control');
      input.sprint = keys.has('control');
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const k = e.key.toLowerCase();
      keys.add(k);
      applyKeys();
      if (k >= '1' && k <= '9') onSelectSlot(Number(k) - 1);
      if (k === 'e') {
        e.preventDefault();
        onToggleInventory();
      }
      if (k === 'f5') {
        e.preventDefault();
        game.setThirdPerson(!game.isThirdPerson);
      }
      if (k === ' ') e.preventDefault();
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keys.delete(e.key.toLowerCase());
      applyKeys();
    };
    const onBlur = () => {
      keys.clear();
      applyKeys();
      input.breakHeld = false;
    };

    // --- mouse (pointer lock) ---
    const canvas = game.renderer.domElement;
    let locked = false;

    const requestLock = () => {
      if (!locked && !touch) void canvas.requestPointerLock();
      game.sound.resume();
    };

    const onPointerLockChange = () => {
      locked = document.pointerLockElement === canvas;
      if (!locked) input.breakHeld = false;
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!locked) return;
      input.lookDX += e.movementX * 0.0026;
      input.lookDY += e.movementY * 0.0026;
    };

    const onMouseDown = (e: MouseEvent) => {
      if (!locked) {
        requestLock();
        return;
      }
      e.preventDefault();
      if (e.button === 0) input.breakHeld = true;
      else if (e.button === 2) game.tryPlace();
      else if (e.button === 1) {
        e.preventDefault();
        game.setThirdPerson(!game.isThirdPerson);
      }
    };
    const onMouseUp = (e: MouseEvent) => {
      if (e.button === 0) input.breakHeld = false;
    };
    const onContextMenu = (e: Event) => e.preventDefault();
    const onWheel = (e: WheelEvent) => {
      // works with or without pointer lock, like Minecraft
      e.preventDefault();
      if ((e.target as HTMLElement).closest('[data-ui-panel]')) return;
      onSelectSlot(game.selectedSlot + (e.deltaY > 0 ? 1 : -1));
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    document.addEventListener('pointerlockchange', onPointerLockChange);
    document.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('contextmenu', onContextMenu);
    window.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('pointerlockchange', onPointerLockChange);
      document.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('contextmenu', onContextMenu);
      window.removeEventListener('wheel', onWheel);
    };
  }, [active, gameRef, onSelectSlot, onToggleInventory, touch]);

  return { touch };
}
