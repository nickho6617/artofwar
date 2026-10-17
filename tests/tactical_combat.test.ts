import { describe, it, expect } from 'vitest';
import { GameEngine, createInitialState, makeSquad } from '../src/engine';
import { GameState, MULT, STATS } from '../src/types';

describe('Tactical Combat Arena & Multipliers', () => {
  describe('Rock-Paper-Scissors Advantage Multipliers (MULT)', () => {
    it('gives Knights 2.0x vs Archers and 0.5x vs Barbarians', () => {
      expect(MULT.knights.archers).toBe(2.0);
      expect(MULT.knights.barbarians).toBe(0.5);
      expect(MULT.knights.knights).toBe(1.0);
    });

    it('gives Archers 2.0x vs Barbarians and 0.5x vs Knights', () => {
      expect(MULT.archers.barbarians).toBe(2.0);
      expect(MULT.archers.knights).toBe(0.5);
      expect(MULT.archers.archers).toBe(1.0);
    });

    it('gives Barbarians 2.0x vs Knights and 0.5x vs Archers', () => {
      expect(MULT.barbarians.knights).toBe(2.0);
      expect(MULT.barbarians.archers).toBe(0.5);
      expect(MULT.barbarians.barbarians).toBe(1.0);
    });
  });

  describe('Battle Engagement & Cohort Setup', () => {
    it('initiates tactical battle when opposing squads collide within ENGAGE_R (25px)', () => {
      const state: GameState = createInitialState();
      const p = makeSquad('P0', 'PLAYER', 200, 200);
      const a = makeSquad('A0', 'AI', 215, 200); // 15px apart (<25px)

      state.squads = [p, a];
      const engine = new GameEngine(state);

      engine.tick(0.05);

      expect(engine.getState().mode).toBe('TACTICAL');
      expect(engine.getState().activeBattle).not.toBeNull();
      expect(engine.getState().activeBattle!.attackerId).toBe('P0');
      expect(engine.getState().activeBattle!.defenderId).toBe('A0');
      expect(engine.getState().activeBattle!.cohorts.length).toBe(6); // 3 player + 3 AI cohorts
    });

    it('initializes cohort HP proportionally to unit counts in the squad', () => {
      const state: GameState = createInitialState();
      const p = makeSquad('P0', 'PLAYER', 200, 200);
      p.knights = 10;
      p.archers = 5;
      p.barbarians = 8;

      const a = makeSquad('A0', 'AI', 210, 200);
      state.squads = [p, a];
      const engine = new GameEngine(state);

      engine.tick(0.05);

      const b = engine.getState().activeBattle!;
      const pKnights = b.cohorts.find((c) => c.faction === 'PLAYER' && c.type === 'knights')!;
      const pArchers = b.cohorts.find((c) => c.faction === 'PLAYER' && c.type === 'archers')!;
      const pBarbs = b.cohorts.find((c) => c.faction === 'PLAYER' && c.type === 'barbarians')!;

      expect(pKnights.hp).toBe(10 * STATS.knights.hp);
      expect(pArchers.hp).toBe(5 * STATS.archers.hp);
      expect(pBarbs.hp).toBe(8 * STATS.barbarians.hp);
    });
  });

  describe('Tactical Commands & Stances', () => {
    it('sets tactical stance for selected cohorts', () => {
      const state: GameState = createInitialState();
      const p = makeSquad('P0', 'PLAYER', 200, 200);
      const a = makeSquad('A0', 'AI', 210, 200);
      state.squads = [p, a];

      const engine = new GameEngine(state);
      engine.tick(0.05); // Enters TACTICAL

      // Select knights only
      engine.dispatch({ type: 'SELECT_TACTICAL', unitType: 'knights' });
      engine.dispatch({ type: 'SET_TACTICAL_STANCE', stance: 'ADVANCE' });

      const b = engine.getState().activeBattle!;
      const k = b.cohorts.find((c) => c.faction === 'PLAYER' && c.type === 'knights')!;
      const arch = b.cohorts.find((c) => c.faction === 'PLAYER' && c.type === 'archers')!;

      expect(k.stance).toBe('ADVANCE');
      expect(arch.stance).toBe('HOLD'); // Unchanged
    });

    it('sets stance for all player cohorts when RETREAT is issued regardless of selection', () => {
      const state: GameState = createInitialState();
      const p = makeSquad('P0', 'PLAYER', 200, 200);
      const a = makeSquad('A0', 'AI', 210, 200);
      state.squads = [p, a];

      const engine = new GameEngine(state);
      engine.tick(0.05);

      engine.dispatch({ type: 'SELECT_TACTICAL', unitType: 'archers' });
      engine.dispatch({ type: 'SET_TACTICAL_STANCE', stance: 'RETREAT' });

      const b = engine.getState().activeBattle!;
      const playerCohorts = b.cohorts.filter((c) => c.faction === 'PLAYER');

      expect(playerCohorts.every((c) => c.stance === 'RETREAT')).toBe(true);
    });
  });

  describe('Combat Simulation & Casualties', () => {
    it('converts surviving cohort HP back into squad troop counts when battle concludes', () => {
      const state: GameState = createInitialState();
      const p = makeSquad('P0', 'PLAYER', 200, 200);
      const a = makeSquad('A0', 'AI', 210, 200);
      const aDistant = makeSquad('A1', 'AI', 500, 500); // Prevents instant game over when A0 is wiped
      state.squads = [p, a, aDistant];

      const engine = new GameEngine(state);
      engine.tick(0.05);

      // Force wipe AI cohorts
      const b = engine.getState().activeBattle!;
      b.cohorts.filter((c) => c.faction === 'AI').forEach((c) => (c.hp = 0));

      // Reduce player knight HP to 5 (only 1 wounded knight surviving out of 15)
      const pK = b.cohorts.find((c) => c.faction === 'PLAYER' && c.type === 'knights')!;
      pK.hp = 5;

      engine.tick(0.05); // End battle triggers

      expect(engine.getState().mode).toBe('STRATEGIC');
      const survivingPlayer = engine.getState().squads.find((s) => s.id === 'P0')!;
      expect(survivingPlayer.knights).toBe(1);

      // AI squad was wiped -> removed from squads list
      const survivingAi = engine.getState().squads.find((s) => s.id === 'A0');
      expect(survivingAi).toBeUndefined();
    });
  });

  describe('Ambush, Pincer & Shatter Remnant Mechanics', () => {
    it('captures overpowered enemy remnants (<=4 men) without entering tactical battle', () => {
      const state: GameState = createInitialState();
      const p = makeSquad('P0', 'PLAYER', 200, 200);
      const a = makeSquad('A0', 'AI', 210, 200);
      a.knights = 0;
      a.archers = 2; // Only 2 archers left
      a.barbarians = 0;
      const aOther = makeSquad('A1', 'AI', 600, 100);

      state.squads = [p, a, aOther];
      const engine = new GameEngine(state);
      engine.tick(0.05);

      // Squad shattered & captured!
      expect(engine.getState().mode).toBe('STRATEGIC');
      expect(engine.getState().activeBattle).toBeNull();
      expect(engine.getState().squads.find((s) => s.id === 'A0')).toBeUndefined();
      expect(engine.getState().shatterMessage?.text).toContain('shattered & captured');
    });

    it('triggers Forest Ambush when stationary in forest and locks retreat', () => {
      const state: GameState = createInitialState();
      // Grid [0, 4] is 'F' (FOREST)
      const p = makeSquad('P0', 'PLAYER', 4 * 50 + 25, 0 * 50 + 25);
      p.targetX = p.x;
      p.targetY = p.y; // stationary

      const a = makeSquad('A0', 'AI', p.x + 10, p.y);
      const aOther = makeSquad('A1', 'AI', 600, 100);
      state.squads = [p, a, aOther];

      const engine = new GameEngine(state);
      engine.tick(0.05);

      expect(engine.getState().mode).toBe('TACTICAL');
      const b = engine.getState().activeBattle!;
      expect(b.isAmbush).toBe(true);
      expect(b.ambushFaction).toBe('PLAYER');

      // AI tries to retreat but cannot during ambush shock
      b.cohorts.filter((c) => c.faction === 'AI').forEach((c) => (c.hp = 1));
      engine.tick(0.5);
      const aiArchers = b.cohorts.find((c) => c.faction === 'AI' && c.type === 'archers')!;
      expect(aiArchers.stance).not.toBe('RETREAT');
    });

    it('triggers Pincer and blocks retreat when a second friendly squad is near', () => {
      const state: GameState = createInitialState();
      const p1 = makeSquad('P0', 'PLAYER', 300, 300);
      const p2 = makeSquad('P1', 'PLAYER', 250, 300); // Nearby flanking squad (< 110px)
      const a = makeSquad('A0', 'AI', 315, 300);

      state.squads = [p1, p2, a];
      const engine = new GameEngine(state);
      engine.tick(0.05);

      expect(engine.getState().mode).toBe('TACTICAL');
      const b = engine.getState().activeBattle!;
      expect(b.retreatBlocked).toBe('AI');
    });
  });
});
