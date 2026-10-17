import { describe, it, expect } from 'vitest';
import { GameEngine, createInitialState, makeSquad, dist } from '../src/engine';
import { GameState } from '../src/types';

describe('Autonomous AI Heuristics ("Sun Tzu Lite")', () => {
  describe('Strategic AI', () => {
    it('defends AI flag when a player squad approaches within 150px', () => {
      const state: GameState = createInitialState();
      // Place player squad 100px from AI flag
      const flag = state.flagPosition;
      const threat = makeSquad('P0', 'PLAYER', flag.x, flag.y + 100);
      const defender = makeSquad('A0', 'AI', flag.x + 80, flag.y + 40);
      defender.targetX = defender.x;
      defender.targetY = defender.y;

      state.squads = [threat, defender];
      state.aiTimer = 0; // Trigger aiThink immediately on tick

      const engine = new GameEngine(state);
      engine.tick(0.1);

      const aiSquad = engine.getState().squads.find((s) => s.id === 'A0')!;
      // Should target the threat's coordinates
      expect(aiSquad.targetX).toBe(threat.x);
      expect(aiSquad.targetY).toBe(threat.y);
    });

    it('orders exhausted AI squad (<40% condition) to retreat to the nearest Fort', () => {
      const state: GameState = createInitialState();
      // Clear threats near flag
      const distantPlayer = makeSquad('P0', 'PLAYER', 100, 500);

      const tiredAi = makeSquad('A0', 'AI', 300, 300);
      tiredAi.condition = 30; // Under 40%

      state.squads = [distantPlayer, tiredAi];
      state.aiTimer = 0;

      const engine = new GameEngine(state);
      const forts = engine.getForts();
      expect(forts.length).toBeGreaterThan(0);

      engine.tick(0.1);

      const aiSquad = engine.getState().squads.find((s) => s.id === 'A0')!;
      // Target should be the nearest fort
      const nearestFort = forts.reduce((best, f) =>
        dist(tiredAi, f) < dist(tiredAi, best) ? f : best
      );
      expect(aiSquad.targetX).toBe(nearestFort.x);
      expect(aiSquad.targetY).toBe(nearestFort.y);
    });

    it('orders healthy AI squad (>70% condition) to press attacks', () => {
      const state: GameState = createInitialState();
      const playerSquad = makeSquad('P0', 'PLAYER', 200, 450);
      const healthyAi = makeSquad('A0', 'AI', 200, 200);
      healthyAi.condition = 85;

      state.squads = [playerSquad, healthyAi];
      state.aiTimer = 0;

      const engine = new GameEngine(state);
      engine.tick(0.1);

      const aiSquad = engine.getState().squads.find((s) => s.id === 'A0')!;
      // Should target the player squad (or player flag)
      expect(aiSquad.targetX).toBe(playerSquad.x);
      expect(aiSquad.targetY).toBe(playerSquad.y);
    });

    it('orders decimated AI squad (<12 men) to regroup with nearest friendly AI squad with capacity', () => {
      const state: GameState = createInitialState();
      // Depleted AI squad
      const depletedAi = makeSquad('A0', 'AI', 150, 150);
      depletedAi.knights = 2;
      depletedAi.archers = 1;
      depletedAi.barbarians = 1; // 4 men total (< 12)

      // Friendly ally squad with capacity
      const allyAi = makeSquad('A1', 'AI', 250, 150);
      allyAi.knights = 10;
      allyAi.archers = 10;
      allyAi.barbarians = 10; // 30 men (< 45)

      // Player squad far away
      const farPlayer = makeSquad('P0', 'PLAYER', 700, 500);

      state.squads = [depletedAi, allyAi, farPlayer];
      state.aiTimer = 0;

      const engine = new GameEngine(state);
      engine.tick(0.1);

      const a0 = engine.getState().squads.find((s) => s.id === 'A0')!;
      expect(a0.mergeTargetId).toBe('A1');
      expect(a0.targetX).toBe(allyAi.x);
      expect(a0.targetY).toBe(allyAi.y);
    });
  });

  describe('Tactical AI', () => {
    it('orders AI retreat when outnumbered 4-to-1 (<25% of player force)', () => {
      const state: GameState = createInitialState();
      const p = makeSquad('P0', 'PLAYER', 200, 200);
      p.knights = 40; // 40 units

      const a = makeSquad('A0', 'AI', 210, 200);
      a.knights = 5; // 5 units (5 < 0.25 * 40 = 10 -> outnumbered > 4:1)
      a.archers = 0;
      a.barbarians = 0;

      state.squads = [p, a];
      const engine = new GameEngine(state);
      engine.tick(0.05); // Enters TACTICAL

      const b = engine.getState().activeBattle!;
      b.aiTimer = 0; // Trigger aiTactical on next tick

      engine.tick(0.05);

      const aiCohorts = b.cohorts.filter((c) => c.faction === 'AI');
      expect(aiCohorts.every((c) => c.stance === 'RETREAT')).toBe(true);
    });

    it('orders AI archers to HOLD when AI has archer superiority', () => {
      const state: GameState = createInitialState();
      const p = makeSquad('P0', 'PLAYER', 200, 200);
      p.knights = 10;
      p.archers = 5; // Player has 5 archers
      p.barbarians = 10;

      const a = makeSquad('A0', 'AI', 210, 200);
      a.knights = 10;
      a.archers = 15; // AI has 15 archers (superiority)
      a.barbarians = 10;

      state.squads = [p, a];
      const engine = new GameEngine(state);
      engine.tick(0.05);

      const b = engine.getState().activeBattle!;
      b.aiTimer = 0;

      engine.tick(0.05);

      const aiArchers = b.cohorts.find((c) => c.faction === 'AI' && c.type === 'archers')!;
      const aiKnights = b.cohorts.find((c) => c.faction === 'AI' && c.type === 'knights')!;

      expect(aiArchers.stance).toBe('HOLD');
      expect(aiKnights.stance).toBe('ADVANCE');
    });
  });
});
