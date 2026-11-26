import React from 'react';

/**
 * Unified tap handlers for a button so it fires exactly once on BOTH touch and mouse.
 * preventDefault() on touchend suppresses the synthesized click, preventing double-fire.
 */
export function tap(cb: () => void): {
  onClick: (e: React.MouseEvent) => void;
  onTouchEnd: (e: React.TouchEvent) => void;
} {
  return {
    onClick: (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      cb();
    },
    onTouchEnd: (e: React.TouchEvent) => {
      e.preventDefault();
      e.stopPropagation();
      cb();
    },
  };
}

/** Press-and-hold handlers (jump button etc.): down/up on touch and mouse. */
export function hold(onDown: () => void, onUp: () => void): {
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchEnd: (e: React.TouchEvent) => void;
  onTouchCancel: (e: React.TouchEvent) => void;
  onMouseDown: (e: React.MouseEvent) => void;
  onMouseUp: (e: React.MouseEvent) => void;
  onMouseLeave: (e: React.MouseEvent) => void;
} {
  return {
    onTouchStart: (e) => {
      e.preventDefault();
      e.stopPropagation();
      onDown();
    },
    onTouchEnd: (e) => {
      e.preventDefault();
      e.stopPropagation();
      onUp();
    },
    onTouchCancel: () => onUp(),
    onMouseDown: (e) => {
      e.preventDefault();
      onDown();
    },
    onMouseUp: () => onUp(),
    onMouseLeave: () => onUp(),
  };
}
