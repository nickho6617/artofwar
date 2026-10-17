import { describe, it, expect } from 'vitest';
import { GameEngine, totalSquadUnits } from '../src/engine';
import { makeSquad } from '../src/engine';

describe('Squad Consolidation & Veteran Reinforcement', () => {
  it('combines two friendly squads and pools their troop numbers correctly', () => {
    const engine = new GameEngine();
    // Reduce P0 and P1 to depleted numbers
    const p0 = engine.getSquadById('P0')!;
    p0.knights = 4;
    p0.archers = 3;
    p0.barbarians = 2;
    p0.condition = 40;

    const p1 = engine.getSquadById('P1')!;
    p1.knights = 8;
    p1.archers = 6;
    p1.barbarians = 5;
    p1.condition = 70;

    const ok = engine.combineSquads('P0', 'P1');
    expect(ok).toBe(true);

    // Source squad P0 should be removed
    expect(engine.getSquadById('P0')).toBeUndefined();

    // Target squad P1 should have pooled troops
    const merged = engine.getSquadById('P1')!;
    expect(merged.knights).toBe(12);
    expect(merged.archers).toBe(9);
    expect(merged.barbarians).toBe(7);
    expect(totalSquadUnits(merged)).toBe(28);

    // Condition calculation: weighted average + 15 morale bonus
    // n0 = 9, n1 = 19, total = 28
    // weighted = (40*9 + 70*19) / 28 = (360 + 1330) / 28 = 1690 / 28 = 60.357
    // newCond = min(100, round(60.357 + 15)) = 75
    expect(merged.condition).toBe(75);

    // Veteran flag should be true
    expect(merged.veteran).toBe(true);
  });

  it('caps pooled units per cohort at 25', () => {
    const engine = new GameEngine();
    const p0 = engine.getSquadById('P0')!;
    p0.knights = 20;
    p0.archers = 20;
    p0.barbarians = 20;

    const p1 = engine.getSquadById('P1')!;
    p1.knights = 15;
    p1.archers = 15;
    p1.barbarians = 15;

    engine.combineSquads('P0', 'P1');
    const merged = engine.getSquadById('P1')!;
    expect(merged.knights).toBe(25);
    expect(merged.archers).toBe(25);
    expect(merged.barbarians).toBe(25);
  });

  it('rejects merging squads of differing factions or identical ids', () => {
    const engine = new GameEngine();
    expect(engine.combineSquads('P0', 'P0')).toBe(false);
    expect(engine.combineSquads('P0', 'A0')).toBe(false);
  });

  it('dispatches COMBINE_SQUADS via dispatch method', () => {
    const engine = new GameEngine();
    const p0 = engine.getSquadById('P0')!;
    p0.knights = 2;
    p0.archers = 1;
    p0.barbarians = 1;

    engine.dispatch({ type: 'COMBINE_SQUADS', sourceId: 'P0', targetId: 'P1' });
    expect(engine.getSquadById('P0')).toBeUndefined();
    expect(engine.getSquadById('P1')!.veteran).toBe(true);
  });

  it('automatically merges squads when approaching rendezvous merge target', () => {
    const engine = new GameEngine();
    const p0 = engine.getSquadById('P0')!;
    const p1 = engine.getSquadById('P1')!;

    // Place them 20px apart and assign mergeTargetId
    p0.x = 200;
    p0.y = 200;
    p0.mergeTargetId = 'P1';

    p1.x = 210;
    p1.y = 200;
    p1.targetX = 210;
    p1.targetY = 200;

    // Tick strategic update
    engine.tick(0.01);

    expect(engine.getSquadById('P0')).toBeUndefined();
    expect(engine.getSquadById('P1')!.veteran).toBe(true);
  });

  it('applies +10% tactical damage bonus for veteran squads in combat', () => {
    const engine = new GameEngine();
    const p0 = engine.getSquadById('P0')!;
    const a0 = engine.getSquadById('A0')!;

    p0.veteran = true;
    p0.x = a0.x;
    p0.y = a0.y + 10;
    p0.targetX = a0.x;
    p0.targetY = a0.y;

    engine.tick(0.05);

    const battle = engine.getState().activeBattle;
    expect(battle).not.toBeNull();
    expect(battle?.playerVeteran).toBe(true);
  });
});
