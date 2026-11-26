import { useEffect, useRef, useState } from 'react';
import { Game } from '@/game/Game';
import { hold } from '@/hooks/tap';

/** On-screen mobile controls: analog joystick (left), look-drag on the world, action buttons. */

interface Props {
  /** Game instance; listeners attach as soon as it exists. */
  game: Game | null;
}

export function TouchControls({ game }: Props) {
  const joystickRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);
  const [jumpPressed, setJumpPressed] = useState(false);

  useEffect(() => {
    if (!game) return;
    const input = game.inputState;
    const canvas = game.domElement;

    // ---- joystick (bottom-left) ----
    let joyId = -1;
    let joyCX = 0;
    let joyCY = 0;
    const JOY_RADIUS = 52;

    const joyStart = (e: TouchEvent) => {
      e.preventDefault(); // keep the synthesized click away; this zone is movement-only
      const t = e.changedTouches[0];
      joyId = t.identifier;
      joyCX = t.clientX;
      joyCY = t.clientY;
      game.sound.resume();
    };
    const joyMove = (e: TouchEvent) => {
      for (const t of Array.from(e.changedTouches)) {
        if (t.identifier !== joyId) continue;
        let dx = t.clientX - joyCX;
        let dy = t.clientY - joyCY;
        const len = Math.hypot(dx, dy);
        if (len > JOY_RADIUS) {
          dx = (dx / len) * JOY_RADIUS;
          dy = (dy / len) * JOY_RADIUS;
        }
        // push up (negative dy) = forward (positive moveZ, Game converts to camera-forward)
        input.moveX = dx / JOY_RADIUS;
        input.moveZ = -dy / JOY_RADIUS;
        input.sprint = len > JOY_RADIUS * 0.95;
        if (knobRef.current) knobRef.current.style.transform = `translate(${dx}px, ${dy}px)`;
      }
    };
    const joyEnd = (e: TouchEvent) => {
      for (const t of Array.from(e.changedTouches)) {
        if (t.identifier !== joyId) continue;
        joyId = -1;
        input.moveX = 0;
        input.moveZ = 0;
        input.sprint = false;
        if (knobRef.current) knobRef.current.style.transform = 'translate(0px, 0px)';
      }
    };

    const joystick = joystickRef.current;
    if (joystick) {
      joystick.addEventListener('touchstart', joyStart, { passive: false });
      window.addEventListener('touchmove', joyMove, { passive: false });
      window.addEventListener('touchend', joyEnd);
      window.addEventListener('touchcancel', joyEnd);
    }

    // ---- look drag anywhere on the canvas + tap-to-break ----
    let lookId = -1;
    let lastX = 0;
    let lastY = 0;
    let startXSnap = 0;
    let startYSnap = 0;
    let startTime = 0;
    let moved = false;

    const lookStart = (e: TouchEvent) => {
      game.sound.resume();
      for (const t of Array.from(e.changedTouches)) {
        if (lookId !== -1) continue; // one look finger at a time
        lookId = t.identifier;
        lastX = t.clientX;
        lastY = t.clientY;
        startXSnap = t.clientX;
        startYSnap = t.clientY;
        startTime = performance.now();
        moved = false;
      }
    };
    const lookMove = (e: TouchEvent) => {
      for (const t of Array.from(e.changedTouches)) {
        if (t.identifier !== lookId) continue;
        const dx = t.clientX - lastX;
        const dy = t.clientY - lastY;
        input.lookDX += dx * 0.0055;
        input.lookDY += dy * 0.0055;
        lastX = t.clientX;
        lastY = t.clientY;
        if (Math.hypot(t.clientX - startXSnap, t.clientY - startYSnap) > 12) moved = true;
      }
    };
    const lookEnd = (e: TouchEvent) => {
      for (const t of Array.from(e.changedTouches)) {
        if (t.identifier !== lookId) continue;
        lookId = -1;
        // short, still tap directly on the world breaks the targeted block (Minecraft PE style)
        const quick = performance.now() - startTime < 300;
        if (quick && !moved) game.tryBreak();
      }
    };

    canvas.addEventListener('touchstart', lookStart, { passive: true });
    window.addEventListener('touchmove', lookMove, { passive: false });
    window.addEventListener('touchend', lookEnd);
    window.addEventListener('touchcancel', lookEnd);

    // block browser gestures (double-tap zoom, pull-to-refresh) on the canvas
    const prevent = (e: Event) => e.preventDefault();
    canvas.addEventListener('touchstart', prevent, { passive: false });
    const preventGesture = (e: Event) => e.preventDefault();
    document.addEventListener('gesturestart', preventGesture);

    return () => {
      if (joystick) {
        joystick.removeEventListener('touchstart', joyStart);
      }
      window.removeEventListener('touchmove', joyMove);
      window.removeEventListener('touchend', joyEnd);
      window.removeEventListener('touchcancel', joyEnd);
      canvas.removeEventListener('touchstart', lookStart);
      window.removeEventListener('touchmove', lookMove);
      window.removeEventListener('touchend', lookEnd);
      window.removeEventListener('touchcancel', lookEnd);
      canvas.removeEventListener('touchstart', prevent);
      document.removeEventListener('gesturestart', preventGesture);
    };
  }, [game]);

  const pressJump = (on: boolean) => {
    if (!game) return;
    game.inputState.jump = on;
    setJumpPressed(on);
  };
  const jumpHold = hold(
    () => pressJump(true),
    () => pressJump(false)
  );
  const action = (fn: (g: Game) => void) => (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (game) fn(game);
  };

  const btn =
    'game-buttons select-none flex items-center justify-center rounded-xl border-2 border-black/50 bg-black/40 text-white backdrop-blur-sm active:bg-white/30 font-bold';

  return (
    <div className="pointer-events-none fixed inset-0 z-20" style={{ touchAction: 'none' }}>
      {/* joystick zone */}
      <div
        ref={joystickRef}
        className="pointer-events-auto absolute bottom-24 left-6 h-32 w-32 touch-none rounded-full border-2 border-white/30 bg-black/25 backdrop-blur-sm"
        style={{ touchAction: 'none' }}
      >
        <div
          ref={knobRef}
          className="absolute left-1/2 top-1/2 h-14 w-14 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/50 bg-white/25"
        />
      </div>

      {/* action buttons (right side) */}
      <div className="absolute bottom-24 right-6 flex flex-col items-end gap-3">
        <div className="flex gap-3">
          <button
            data-ui
            className={`${btn} h-16 w-16 text-2xl`}
            style={{ touchAction: 'none' }}
            onTouchStart={action((g) => g.tryBreak())}
            onClick={action((g) => g.tryBreak())}
          >
            Pick
          </button>
          <button
            data-ui
            className={`${btn} h-16 w-16 text-2xl`}
            style={{ touchAction: 'none' }}
            onTouchStart={action((g) => g.tryPlace())}
            onClick={action((g) => g.tryPlace())}
          >
            Place
          </button>
        </div>
        <button
          data-ui
          className={`${btn} h-16 w-40 text-sm tracking-widest ${jumpPressed ? 'bg-white/30' : ''}`}
          style={{ touchAction: 'none' }}
          {...jumpHold}
        >
          JUMP
        </button>
      </div>
    </div>
  );
}
