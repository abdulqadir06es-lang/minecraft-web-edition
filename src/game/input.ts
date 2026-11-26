/** Unified input state fed by both desktop and touch controls. */

export interface InputState {
  // movement vector in local space: x strafe (-1..1), z forward (-1..1)
  moveX: number;
  moveZ: number;
  jump: boolean;
  sneak: boolean;
  sprint: boolean;
  // look deltas accumulated since last frame (radians)
  lookDX: number;
  lookDY: number;
  // one-shot actions (consumed by the game loop)
  breakPressed: boolean;
  placePressed: boolean;
  breakHeld: boolean;
  hotbarSelect: number | null; // 0-7
}

export function createInputState(): InputState {
  return {
    moveX: 0,
    moveZ: 0,
    jump: false,
    sneak: false,
    sprint: false,
    lookDX: 0,
    lookDY: 0,
    breakPressed: false,
    placePressed: false,
    breakHeld: false,
    hotbarSelect: null,
  };
}

export const isTouchDevice = (): boolean =>
  typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);
