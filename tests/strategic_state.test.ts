import { describe, it, expect } from 'vitest';
import { GameEngine, createInitialState, makeSquad } from '../src/engine';
import { GameState } from '../src/types';

describe('Condition Recovery & Win Conditions', () => {
  describe('Condition Recovery', () => {
    it('recovers condition rapidly (+5.0/s) when idle inside a Fort', () => {
      const state: GameState = createInitialState();
      // Put a FORT tile at (0, 0)
      state.grid[0][0] = 'FORT';

      const s = makeSquad('P0', 'PLAYER', 25, 25);
      s.targetX = 25;
      s.targetY = 25;
      s.condition = 50;

      state.squads = [s];
      const engine = new GameEngine(state);

      engine.tick(2.0); // 2 seconds idle in Fort -> +10.0 condition

      const updated = engine.getState().squads[0];
      expect(updated.condition).toBeCloseTo(60, 1);
    });

    it('recovers condition slowly (+0.5/s) when idle in open Plains', () => {
      const state: GameState = createInitialState();
      state.grid[0][0] = 'PLAINS';

      const s = makeSquad('P0', 'PLAYER', 25, 25);
      s.targetX = 25;
      s.targetY = 25;
      s.condition = 50;

      state.squads = [s];
      const engine = new GameEngine(state);

      engine.tick(2.0); // 2 seconds idle in Plains -> +1.0 condition

      const updated = engine.getState().squads[0];
      expect(updated.condition).toBeCloseTo(51, 1);
    });

    it('does not exceed 100 maximum condition when recovering', () => {
      const state: GameState = createInitialState();
      state.grid[0][0] = 'FORT';

      const s = makeSquad('P0', 'PLAYER', 25, 25);
      s.targetX = 25;
      s.targetY = 25;
      s.condition = 98;

      state.squads = [s];
      const engine = new GameEngine(state);

      engine.tick(2.0); // Would add +10 -> capped at 100

      const updated = engine.getState().squads[0];
      expect(updated.condition).toBe(100);
    });
  });

  describe('Win Conditions', () => {
    it('declares PLAYER victory when a player squad reaches the AI home flag', () => {
      const state: GameState = createInitialState();
      const p = makeSquad('P0', 'PLAYER', state.flagPosition.x, state.flagPosition.y);
      p.targetX = state.flagPosition.x;
      p.targetY = state.flagPosition.y;

      const a = makeSquad('A0', 'AI', 100, 100);
      a.targetX = 100;
      a.targetY = 100;

      state.squads = [p, a];
      const engine = new GameEngine(state);

      engine.tick(0.1);

      expect(engine.getState().mode).toBe('GAME_OVER');
      expect(engine.getState().winner).toBe('PLAYER');
    });

    it('declares AI victory when an AI squad reaches the player home flag', () => {
      const state: GameState = createInitialState();
      const a = makeSquad('A0', 'AI', state.playerFlag.x, state.playerFlag.y);
      a.targetX = state.playerFlag.x;
      a.targetY = state.playerFlag.y;

      const p = makeSquad('P0', 'PLAYER', 100, 100);
      p.targetX = 100;
      p.targetY = 100;

      state.squads = [p, a];
      const engine = new GameEngine(state);

      engine.tick(0.1);

      expect(engine.getState().mode).toBe('GAME_OVER');
      expect(engine.getState().winner).toBe('AI');
    });

    it('declares PLAYER victory when all AI squads are eliminated', () => {
      const state: GameState = createInitialState();
      const p = makeSquad('P0', 'PLAYER', 100, 100);
      state.squads = [p]; // No AI squads

      const engine = new GameEngine(state);
      engine.tick(0.1);

      expect(engine.getState().mode).toBe('GAME_OVER');
      expect(engine.getState().winner).toBe('PLAYER');
    });

    it('declares AI victory when all PLAYER squads are eliminated', () => {
      const state: GameState = createInitialState();
      const a = makeSquad('A0', 'AI', 100, 100);
      state.squads = [a]; // No Player squads

      const engine = new GameEngine(state);
      engine.tick(0.1);

      expect(engine.getState().mode).toBe('GAME_OVER');
      expect(engine.getState().winner).toBe('AI');
    });

    it('resets game state upon RESTART_GAME command', () => {
      const state: GameState = createInitialState();
      state.mode = 'GAME_OVER';
      state.winner = 'PLAYER';

      const engine = new GameEngine(state);
      engine.dispatch({ type: 'RESTART_GAME' });

      expect(engine.getState().mode).toBe('STRATEGIC');
      expect(engine.getState().winner).toBeNull();
      expect(engine.getState().squads.length).toBe(8);
    });
  });
});
