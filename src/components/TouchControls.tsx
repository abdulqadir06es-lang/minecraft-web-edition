import { useEffect, useRef, useState } from 'react';
import { Game } from '@/game/Game';

/** On-screen mobile controls: analog joystick (left), look-drag (right half), action buttons. */

interface Props {
  gameRef: React.MutableRefObject<Game | null>;
}

export function TouchControls({ gameRef }: Props) {
  const joystickRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);
  const [jumpPressed, setJumpPressed] = useState(false);

  useEffect(() => {
    const game = gameRef.current;
    if (!game) return;
    const input = game.inputState;
    const canvas = game.renderer.domElement;

    // ---- joystick ----
    let joyActive = false;
    let joyId = -1;
    let joyCX = 0;
    let joyCY = 0;
    const JOY_RADIUS = 52;

    const joyStart = (e: TouchEvent) => {
      const t = e.changedTouches[0];
      joyActive = true;
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
        input.moveX = dx / JOY_RADIUS;
        input.moveZ = -dy / JOY_RADIUS;
        input.sprint = len > JOY_RADIUS * 0.95;
        if (knobRef.current) knobRef.current.style.transform = `translate(${dx}px, ${dy}px)`;
      }
    };
    const joyEnd = (e: TouchEvent) => {
      for (const t of Array.from(e.changedTouches)) {
        if (t.identifier !== joyId) continue;
        joyActive = false;
        joyId = -1;
        input.moveX = 0;
        input.moveZ = 0;
        input.sprint = false;
        if (knobRef.current) knobRef.current.style.transform = 'translate(0px, 0px)';
      }
    };

    const joystick = joystickRef.current;
    if (joystick) {
      joystick.addEventListener('touchstart', joyStart, { passive: true });
      window.addEventListener('touchmove', joyMove, { passive: true });
      window.addEventListener('touchend', joyEnd, { passive: true });
      window.addEventListener('touchcancel', joyEnd, { passive: true });
    }

    // ---- look drag (right half of screen, excluding buttons) ----
    let lookId = -1;
    let lastX = 0;
    let lastY = 0;
    const lookStart = (e: TouchEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('[data-ui]')) return; // buttons handle their own touches
      for (const t of Array.from(e.changedTouches)) {
        if (t.clientX < window.innerWidth * 0.35 && !lookId) continue; // left edge reserved for joystick area
        if (lookId !== -1) continue;
        lookId = t.identifier;
        lastX = t.clientX;
        lastY = t.clientY;
      }
    };
    const lookMove = (e: TouchEvent) => {
      for (const t of Array.from(e.changedTouches)) {
        if (t.identifier !== lookId) continue;
        input.lookDX += (t.clientX - lastX) * 0.006;
        input.lookDY += (t.clientY - lastY) * 0.006;
        lastX = t.clientX;
        lastY = t.clientY;
      }
    };
    const lookEnd = (e: TouchEvent) => {
      for (const t of Array.from(e.changedTouches)) {
        if (t.identifier === lookId) lookId = -1;
      }
    };

    canvas.addEventListener('touchstart', lookStart, { passive: true });
    window.addEventListener('touchmove', lookMove, { passive: true });
    window.addEventListener('touchend', lookEnd, { passive: true });
    window.addEventListener('touchcancel', lookEnd, { passive: true });

    // prevent double-tap zoom etc on canvas
    const prevent = (e: Event) => e.preventDefault();
    canvas.addEventListener('touchstart', prevent, { passive: false });

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
    };
  }, [gameRef]);

  const pressJump = (on: boolean) => {
    const game = gameRef.current;
    if (!game) return;
    game.inputState.jump = on;
    setJumpPressed(on);
  };

  const btn =
    'select-none touch-none flex items-center justify-center rounded-xl border-2 border-black/50 bg-black/40 text-white backdrop-blur-sm active:bg-white/30 font-bold';

  return (
    <div className="pointer-events-none fixed inset-0 z-20" style={{ touchAction: 'none' }}>
      {/* joystick zone */}
      <div
        ref={joystickRef}
        className="pointer-events-auto absolute bottom-6 left-6 h-32 w-32 rounded-full border-2 border-white/30 bg-black/25 backdrop-blur-sm"
      >
        <div
          ref={knobRef}
          className="absolute left-1/2 top-1/2 h-14 w-14 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/50 bg-white/25"
        />
      </div>

      {/* action buttons (right side) */}
      <div className="absolute bottom-6 right-6 flex flex-col items-end gap-3">
        <div className="flex gap-3">
          <button
            data-ui
            className={`${btn} h-16 w-16 text-2xl`}
            onTouchStart={(e) => {
              e.stopPropagation();
              gameRef.current?.tryBreak();
            }}
          >
            ⛏️
          </button>
          <button
            data-ui
            className={`${btn} h-16 w-16 text-2xl`}
            onTouchStart={(e) => {
              e.stopPropagation();
              gameRef.current?.tryPlace();
            }}
          >
            🧱
          </button>
        </div>
        <button
          data-ui
          className={`${btn} h-16 w-40 text-sm tracking-widest ${jumpPressed ? 'bg-white/30' : ''}`}
          onTouchStart={(e) => {
            e.stopPropagation();
            pressJump(true);
          }}
          onTouchEnd={(e) => {
            e.stopPropagation();
            pressJump(false);
          }}
        >
          JUMP
        </button>
      </div>
    </div>
  );
}
