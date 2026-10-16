import { GameCommand, GameState, Squad, W, H } from './types';
import { dist, clamp } from './engine';

export interface PointerInput {
  x: number;
  y: number;
  button: number;
  isTouch?: boolean;
  hitRadius?: number;
}

export const DEFAULT_MOUSE_HIT_RADIUS = 18;
export const DEFAULT_TOUCH_MIN_CSS_RADIUS = 24; // 48px touch diameter target

/**
 * Computes the adaptive hit radius in canvas coordinate units.
 * On mobile/touch devices, scales to guarantee at least minimum CSS pixel touch target.
 */
export function getHitRadius(
  canvasDisplayWidth: number,
  isTouch: boolean = false,
  minCssRadius: number = DEFAULT_TOUCH_MIN_CSS_RADIUS
): number {
  if (!isTouch) {
    return DEFAULT_MOUSE_HIT_RADIUS;
  }
  const scale = canvasDisplayWidth > 0 ? W / canvasDisplayWidth : 1;
  return Math.max(DEFAULT_MOUSE_HIT_RADIUS, Math.round(minCssRadius * scale));
}

/**
 * Converts a DOM PointerEvent/MouseEvent to game canvas coordinates.
 */
export function domToCanvasCoords(
  clientX: number,
  clientY: number,
  canvasRect: { left: number; top: number; width: number; height: number }
): { x: number; y: number } {
  if (canvasRect.width <= 0 || canvasRect.height <= 0) {
    return { x: 0, y: 0 };
  }
  return {
    x: ((clientX - canvasRect.left) / canvasRect.width) * W,
    y: ((clientY - canvasRect.top) / canvasRect.height) * H,
  };
}

/**
 * Pure resolver that translates pointer interactions into game commands.
 * Implements "Select-then-Move" for mobile/touch screens while keeping
 * desktop right-click completely backward-compatible.
 */
export function resolvePointerCommand(
  input: PointerInput,
  state: Pick<GameState, 'mode' | 'selectedId' | 'squads'>
): GameCommand | null {
  if (state.mode === 'GAME_OVER') {
    return { type: 'RESTART_GAME' };
  }

  if (state.mode !== 'STRATEGIC') {
    return null;
  }

  const { x, y, button } = input;
  const radius = input.hitRadius ?? (input.isTouch ? 36 : DEFAULT_MOUSE_HIT_RADIUS);

  // Desktop right-click: march currently selected squad immediately
  if (button === 2) {
    if (state.selectedId) {
      return {
        type: 'MARCH_SQUAD',
        squadId: state.selectedId,
        targetX: clamp(x, 0, W),
        targetY: clamp(y, 0, H),
      };
    }
    return null;
  }

  // Primary click / touch tap (button === 0)
  if (button === 0) {
    const pt = { x, y };
    const hitSquad = state.squads.find(
      (s: Squad) => s.faction === 'PLAYER' && dist(s, pt) < radius
    );

    // If no squad is currently selected
    if (!state.selectedId) {
      if (hitSquad) {
        return { type: 'SELECT_SQUAD', squadId: hitSquad.id };
      }
      return null;
    }

    // A squad is currently selected
    if (hitSquad) {
      if (hitSquad.id === state.selectedId) {
        // Tapping the already-selected squad toggles selection off
        return { type: 'SELECT_SQUAD', squadId: null };
      }
      // Tapping a different friendly squad switches selection
      return { type: 'SELECT_SQUAD', squadId: hitSquad.id };
    }

    // Tapping elsewhere on the map issues a march order to destination
    return {
      type: 'MARCH_SQUAD',
      squadId: state.selectedId,
      targetX: clamp(x, 0, W),
      targetY: clamp(y, 0, H),
    };
  }

  return null;
}
