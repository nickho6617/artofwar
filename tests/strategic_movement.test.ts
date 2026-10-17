import { describe, it, expect } from 'vitest';
import { GameEngine, createInitialState, makeSquad } from '../src/engine';
import { GameState, BASE_SPEED, TERRAIN } from '../src/types';

describe('Strategic Movement & Terrain Modifiers', () => {
  it('dispatches MARCH_SQUAD to set squad target coordinates', () => {
    const engine = new GameEngine();
    const initial = engine.getState().squads.find((s) => s.id === 'P0')!;

    engine.dispatch({
      type: 'MARCH_SQUAD',
      squadId: 'P0',
      targetX: 300,
      targetY: 400,
    });

    const updated = engine.getState().squads.find((s) => s.id === 'P0')!;
    expect(updated.targetX).toBe(300);
    expect(updated.targetY).toBe(400);
  });

  it('clamps march target coordinates to canvas bounds [0, W] and [0, H]', () => {
    const engine = new GameEngine();
    engine.dispatch({
      type: 'MARCH_SQUAD',
      squadId: 'P0',
      targetX: -50,
      targetY: 9999,
    });

    const updated = engine.getState().squads.find((s) => s.id === 'P0')!;
    expect(updated.targetX).toBe(0);
    expect(updated.targetY).toBe(600); // H = 600
  });

  it('ignores march orders directed to AI squads from player commands', () => {
    const engine = new GameEngine();
    const aiSquad = engine.getState().squads.find((s) => s.id === 'A0')!;
    const originalX = aiSquad.targetX;
    const originalY = aiSquad.targetY;

    engine.dispatch({
      type: 'MARCH_SQUAD',
      squadId: 'A0',
      targetX: 0,
      targetY: 0,
    });

    const after = engine.getState().squads.find((s) => s.id === 'A0')!;
    expect(after.targetX).toBe(originalX);
    expect(after.targetY).toBe(originalY);
  });

  it('drains condition proportionally to terrain drain rate while marching', () => {
    const state: GameState = createInitialState();
    // Grid: row 0 is all PLAINS for testing
    state.grid[0] = new Array(16).fill('PLAINS');
    state.grid[1] = new Array(16).fill('FOREST');
    state.grid[2] = new Array(16).fill('MOUNTAIN');

    // Squad on Plains
    const pPlains = makeSquad('P0', 'PLAYER', 100, 25);
    pPlains.targetX = 500;
    pPlains.targetY = 25;
    pPlains.condition = 100;

    // Squad on Forest
    const pForest = makeSquad('P1', 'PLAYER', 100, 75);
    pForest.targetX = 500;
    pForest.targetY = 75;
    pForest.condition = 100;

    // Squad on Mountain
    const pMountain = makeSquad('P2', 'PLAYER', 100, 125);
    pMountain.targetX = 500;
    pMountain.targetY = 125;
    pMountain.condition = 100;

    state.squads = [pPlains, pForest, pMountain];
    const engine = new GameEngine(state);

    const dt = 1.0; // 1 second march
    engine.tick(dt);

    const sPlains = engine.getState().squads.find((s) => s.id === 'P0')!;
    const sForest = engine.getState().squads.find((s) => s.id === 'P1')!;
    const sMountain = engine.getState().squads.find((s) => s.id === 'P2')!;

    // Drain formula: 2.5 * terrain.drain * dt
    // Plains drain = 1.0 -> 2.5 drain -> 97.5 condition
    expect(sPlains.condition).toBeCloseTo(100 - 2.5 * TERRAIN.PLAINS.drain * dt, 1);
    // Forest drain = 1.2 -> 3.0 drain -> 97.0 condition
    expect(sForest.condition).toBeCloseTo(100 - 2.5 * TERRAIN.FOREST.drain * dt, 1);
    // Mountain drain = 2.0 -> 5.0 drain -> 95.0 condition
    expect(sMountain.condition).toBeCloseTo(100 - 2.5 * TERRAIN.MOUNTAIN.drain * dt, 1);
  });

  it('scales movement step according to terrain speed and condition', () => {
    const state: GameState = createInitialState();
    state.grid[0] = new Array(16).fill('PLAINS');
    state.grid[1] = new Array(16).fill('MOUNTAIN');

    // Full condition squad on Plains
    const pFast = makeSquad('P0', 'PLAYER', 50, 25);
    pFast.targetX = 300;
    pFast.targetY = 25;
    pFast.condition = 100;

    // 0 condition squad on Plains
    const pExhausted = makeSquad('P1', 'PLAYER', 50, 25);
    pExhausted.targetX = 300;
    pExhausted.targetY = 25;
    pExhausted.condition = 0;

    state.squads = [pFast, pExhausted];
    const engine = new GameEngine(state);

    const dt = 1.0;
    engine.tick(dt);

    const sFast = engine.getState().squads.find((s) => s.id === 'P0')!;
    const sExhausted = engine.getState().squads.find((s) => s.id === 'P1')!;

    const distFast = sFast.x - 50;
    const distExhausted = sExhausted.x - 50;

    // Fast squad: BASE_SPEED (45) * 1.0 * (0.6 + 100/250 = 1.0) * 1.0 = 45px
    expect(distFast).toBeCloseTo(BASE_SPEED * 1.0 * 1.0 * dt, 1);
    // Exhausted squad: BASE_SPEED (45) * 1.0 * (0.6 + 0/250 = 0.6) * 1.0 = 27px (60% speed)
    expect(distExhausted).toBeCloseTo(BASE_SPEED * 1.0 * 0.6 * dt, 1);
  });

  it('clamps condition to 0 when fatigue drains completely', () => {
    const state: GameState = createInitialState();
    const p = makeSquad('P0', 'PLAYER', 100, 100);
    p.targetX = 500;
    p.targetY = 100;
    p.condition = 1; // Almost exhausted

    state.squads = [p];
    const engine = new GameEngine(state);

    engine.tick(2.0); // 2 seconds march
    const s = engine.getState().squads.find((s) => s.id === 'P0')!;
    expect(s.condition).toBe(0);
  });

  describe('Post-Retreat Disengagement Buffer & Auto-Selection', () => {
    it('pushes retreating squad back 100px and sets retreatCooldown to 3.0s', () => {
      const state: GameState = createInitialState();
      const p = makeSquad('P0', 'PLAYER', 300, 300);
      const a = makeSquad('A0', 'AI', 315, 300);
      state.squads = [p, a];
      const engine = new GameEngine(state);

      // Engage battle
      engine.tick(0.05);
      expect(engine.getState().mode).toBe('TACTICAL');

      // Order retreat and eliminate player active presence via retreat
      const b = engine.getState().activeBattle!;
      b.cohorts.filter((c) => c.faction === 'PLAYER').forEach((c) => {
        c.retreated = true;
      });

      // Tick to trigger endBattle
      engine.tick(0.05);

      expect(engine.getState().mode).toBe('STRATEGIC');
      const pAfter = engine.getState().squads.find((s) => s.id === 'P0')!;
      // Pushback separation is 100px (initial dist was 15px along x)
      expect(pAfter.x).toBeLessThan(210); // 300 - 100 = 200
      expect(pAfter.retreatCooldown).toBeCloseTo(3.0, 1);
      expect(engine.getState().selectedId).toBe('P0');
    });

    it('prevents instant combat re-engagement while retreatCooldown is active', () => {
      const state: GameState = createInitialState();
      const p = makeSquad('P0', 'PLAYER', 300, 300);
      p.retreatCooldown = 2.5; // active cooldown
      const a = makeSquad('A0', 'AI', 310, 300); // 10px apart (< ENGAGE_R)
      state.squads = [p, a];

      const engine = new GameEngine(state);
      engine.tick(0.1);

      // Should remain in STRATEGIC mode due to cooldown
      expect(engine.getState().mode).toBe('STRATEGIC');
      expect(engine.getState().activeBattle).toBeNull();
      const pAfter = engine.getState().squads.find((s) => s.id === 'P0')!;
      expect(pAfter.retreatCooldown).toBeCloseTo(2.4, 1);
    });
  });
});
