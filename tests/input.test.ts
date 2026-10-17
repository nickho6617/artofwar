import { describe, it, expect } from 'vitest';
import {
  resolvePointerCommand,
  getHitRadius,
  domToCanvasCoords,
  DEFAULT_MOUSE_HIT_RADIUS,
} from '../src/input';
import { GameState, Squad, W, H } from '../src/types';

function createDummySquad(id: string, faction: 'PLAYER' | 'AI', x: number, y: number): Squad {
  return {
    id,
    faction,
    x,
    y,
    targetX: x,
    targetY: y,
    condition: 100,
    knights: 10,
    archers: 10,
    barbarians: 10,
  };
}

describe('Input Resolver: resolvePointerCommand', () => {
  const playerSquad1 = createDummySquad('P0', 'PLAYER', 175, 510);
  const playerSquad2 = createDummySquad('P1', 'PLAYER', 325, 510);
  const aiSquad = createDummySquad('A0', 'AI', 175, 90);

  const baseState: Pick<GameState, 'mode' | 'selectedId' | 'squads'> = {
    mode: 'STRATEGIC',
    selectedId: null,
    squads: [playerSquad1, playerSquad2, aiSquad],
  };

  it('selects a player squad when tapping on it with no squad selected', () => {
    const cmd = resolvePointerCommand(
      { x: 178, y: 512, button: 0 },
      baseState
    );
    expect(cmd).toEqual({ type: 'SELECT_SQUAD', squadId: 'P0' });
  });

  it('does nothing when tapping empty ground with no squad selected', () => {
    const cmd = resolvePointerCommand(
      { x: 500, y: 300, button: 0 },
      baseState
    );
    expect(cmd).toBeNull();
  });

  it('does not select enemy AI squads when tapped', () => {
    const cmd = resolvePointerCommand(
      { x: 175, y: 90, button: 0 },
      baseState
    );
    expect(cmd).toBeNull();
  });

  it('marches selected squad to target position when tapping empty ground', () => {
    const stateWithSelection = { ...baseState, selectedId: 'P0' };
    const cmd = resolvePointerCommand(
      { x: 400, y: 300, button: 0 },
      stateWithSelection
    );
    expect(cmd).toEqual({
      type: 'MARCH_SQUAD',
      squadId: 'P0',
      targetX: 400,
      targetY: 300,
    });
  });

  it('clamps march coordinates within canvas boundaries', () => {
    const stateWithSelection = { ...baseState, selectedId: 'P0' };
    const cmd = resolvePointerCommand(
      { x: -50, y: 999, button: 0 },
      stateWithSelection
    );
    expect(cmd).toEqual({
      type: 'MARCH_SQUAD',
      squadId: 'P0',
      targetX: 0,
      targetY: H,
    });
  });

  it('switches selection when tapping a different player squad while one is selected', () => {
    const stateWithSelection = { ...baseState, selectedId: 'P0' };
    const cmd = resolvePointerCommand(
      { x: 325, y: 510, button: 0 },
      stateWithSelection
    );
    expect(cmd).toEqual({ type: 'SELECT_SQUAD', squadId: 'P1' });
  });

  it('toggles selection off when tapping the currently selected squad again', () => {
    const stateWithSelection = { ...baseState, selectedId: 'P0' };
    const cmd = resolvePointerCommand(
      { x: 175, y: 510, button: 0 },
      stateWithSelection
    );
    expect(cmd).toEqual({ type: 'SELECT_SQUAD', squadId: null });
  });

  it('preserves desktop right-click to immediately march selected squad', () => {
    const stateWithSelection = { ...baseState, selectedId: 'P0' };
    const cmd = resolvePointerCommand(
      { x: 250, y: 350, button: 2 },
      stateWithSelection
    );
    expect(cmd).toEqual({
      type: 'MARCH_SQUAD',
      squadId: 'P0',
      targetX: 250,
      targetY: 350,
    });
  });

  it('ignores right-click if no squad is currently selected', () => {
    const cmd = resolvePointerCommand(
      { x: 250, y: 350, button: 2 },
      baseState
    );
    expect(cmd).toBeNull();
  });

  it('dispatches RESTART_GAME when clicked during GAME_OVER', () => {
    const gameOverState: Pick<GameState, 'mode' | 'selectedId' | 'squads'> = {
      mode: 'GAME_OVER',
      selectedId: null,
      squads: [],
    };
    const cmd = resolvePointerCommand(
      { x: 100, y: 100, button: 0 },
      gameOverState
    );
    expect(cmd).toEqual({ type: 'RESTART_GAME' });
  });

  it('returns null during TACTICAL mode', () => {
    const tacticalState: Pick<GameState, 'mode' | 'selectedId' | 'squads'> = {
      mode: 'TACTICAL',
      selectedId: null,
      squads: [],
    };
    const cmd = resolvePointerCommand(
      { x: 100, y: 100, button: 0 },
      tacticalState
    );
    expect(cmd).toBeNull();
  });

  it('emits COMBINE_SQUADS when targetMergeMode is active and tapping adjacent friendly squad', () => {
    // P0 selected at (175, 510), P1 adjacent at (195, 510) (distance 20 <= 35)
    const adjacentP1 = createDummySquad('P1', 'PLAYER', 195, 510);
    const selectedState: Pick<GameState, 'mode' | 'selectedId' | 'squads'> = {
      mode: 'STRATEGIC',
      selectedId: 'P0',
      squads: [playerSquad1, adjacentP1],
    };
    const cmd = resolvePointerCommand(
      { x: 195, y: 510, button: 0, targetMergeMode: true },
      selectedState
    );
    expect(cmd).toEqual({
      type: 'COMBINE_SQUADS',
      sourceId: 'P0',
      targetId: 'P1',
    });
  });
});

describe('Adaptive Hit Radius: getHitRadius', () => {
  it('returns default mouse hit radius for non-touch pointers', () => {
    expect(getHitRadius(800, false)).toBe(DEFAULT_MOUSE_HIT_RADIUS);
    expect(getHitRadius(400, false)).toBe(DEFAULT_MOUSE_HIT_RADIUS);
  });

  it('scales touch hit radius proportionally for mobile display widths', () => {
    // If canvas display width is 400px (phone screen), scale = 800 / 400 = 2.0
    // With 24 CSS px radius, canvas radius = 48
    const r400 = getHitRadius(400, true, 24);
    expect(r400).toBe(48);

    // If canvas display width is 800px (full desktop / tablet), scale = 1.0
    const r800 = getHitRadius(800, true, 24);
    expect(r800).toBe(24);
  });
});

describe('Coordinate Conversion: domToCanvasCoords', () => {
  const mockRect = { left: 100, top: 50, width: 400, height: 300 };

  it('accurately maps client coordinates into 800x600 canvas coordinate space', () => {
    // Top-left
    expect(domToCanvasCoords(100, 50, mockRect)).toEqual({ x: 0, y: 0 });
    // Center (200, 150 offset from rect top-left)
    expect(domToCanvasCoords(300, 200, mockRect)).toEqual({ x: 400, y: 300 });
    // Bottom-right (400, 300 offset)
    expect(domToCanvasCoords(500, 350, mockRect)).toEqual({ x: W, y: H });
  });

  it('handles zero or negative width/height safely', () => {
    expect(domToCanvasCoords(100, 50, { left: 0, top: 0, width: 0, height: 0 })).toEqual({
      x: 0,
      y: 0,
    });
  });
});
