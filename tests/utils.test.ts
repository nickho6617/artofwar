import { describe, it, expect } from 'vitest';
import {
  dist,
  clamp,
  totalSquadUnits,
  cohortCount,
  cohortRadius,
  isCohortActive,
  makeSquad,
} from '../src/engine';
import { TacticalCohort } from '../src/types';

describe('Math & Utility Functions', () => {
  describe('dist()', () => {
    it('calculates 0 distance for identical points', () => {
      expect(dist({ x: 10, y: 20 }, { x: 10, y: 20 })).toBe(0);
    });

    it('calculates correct Euclidean distance for 3-4-5 triangle', () => {
      expect(dist({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
    });

    it('handles negative coordinates properly', () => {
      expect(dist({ x: -10, y: -5 }, { x: -6, y: -2 })).toBe(5);
    });
  });

  describe('clamp()', () => {
    it('returns the value when inside [min, max]', () => {
      expect(clamp(50, 0, 100)).toBe(50);
    });

    it('clamps values below minimum', () => {
      expect(clamp(-10, 0, 100)).toBe(0);
    });

    it('clamps values above maximum', () => {
      expect(clamp(150, 0, 100)).toBe(100);
    });

    it('handles min equal to max', () => {
      expect(clamp(42, 50, 50)).toBe(50);
    });
  });

  describe('totalSquadUnits()', () => {
    it('sums knights, archers, and barbarians correctly', () => {
      const squad = makeSquad('P0', 'PLAYER', 100, 100);
      expect(totalSquadUnits(squad)).toBe(45); // 15 + 15 + 15
    });

    it('returns 0 when squad has no troops', () => {
      const squad = makeSquad('P0', 'PLAYER', 100, 100);
      squad.knights = 0;
      squad.archers = 0;
      squad.barbarians = 0;
      expect(totalSquadUnits(squad)).toBe(0);
    });
  });

  describe('cohortCount()', () => {
    it('calculates knight count from HP (10 HP/knight)', () => {
      const cohort: TacticalCohort = {
        faction: 'PLAYER',
        type: 'knights',
        hp: 100, // 10 knights
        x: 0,
        y: 0,
        stance: 'HOLD',
        cooldown: 0,
        retreated: false,
      };
      expect(cohortCount(cohort)).toBe(10);
    });

    it('calculates archer count from HP (5 HP/archer)', () => {
      const cohort: TacticalCohort = {
        faction: 'PLAYER',
        type: 'archers',
        hp: 35, // 7 archers
        x: 0,
        y: 0,
        stance: 'HOLD',
        cooldown: 0,
        retreated: false,
      };
      expect(cohortCount(cohort)).toBe(7);
    });

    it('rounds up partial soldier HP using ceil', () => {
      const cohort: TacticalCohort = {
        faction: 'PLAYER',
        type: 'knights',
        hp: 15, // 1 full knight (10 HP) + 1 wounded knight (5 HP) = 2 knights
        x: 0,
        y: 0,
        stance: 'HOLD',
        cooldown: 0,
        retreated: false,
      };
      expect(cohortCount(cohort)).toBe(2);
    });

    it('returns 0 when cohort HP is 0 or negative', () => {
      const cohort: TacticalCohort = {
        faction: 'PLAYER',
        type: 'barbarians',
        hp: 0,
        x: 0,
        y: 0,
        stance: 'HOLD',
        cooldown: 0,
        retreated: false,
      };
      expect(cohortCount(cohort)).toBe(0);
    });
  });

  describe('cohortRadius()', () => {
    it('scales radius based on unit count', () => {
      const smallCohort: TacticalCohort = {
        faction: 'PLAYER',
        type: 'knights',
        hp: 10, // 1 knight
        x: 0,
        y: 0,
        stance: 'HOLD',
        cooldown: 0,
        retreated: false,
      };
      const largeCohort: TacticalCohort = {
        faction: 'PLAYER',
        type: 'knights',
        hp: 160, // 16 knights
        x: 0,
        y: 0,
        stance: 'HOLD',
        cooldown: 0,
        retreated: false,
      };

      expect(cohortRadius(largeCohort)).toBeGreaterThan(cohortRadius(smallCohort));
      expect(cohortRadius(smallCohort)).toBeCloseTo(12 + Math.sqrt(1) * 3.2, 1);
      expect(cohortRadius(largeCohort)).toBeCloseTo(12 + Math.sqrt(16) * 3.2, 1);
    });
  });

  describe('isCohortActive()', () => {
    it('returns true when cohort has HP and has not retreated', () => {
      const cohort: TacticalCohort = {
        faction: 'PLAYER',
        type: 'knights',
        hp: 10,
        x: 0,
        y: 0,
        stance: 'ADVANCE',
        cooldown: 0,
        retreated: false,
      };
      expect(isCohortActive(cohort)).toBe(true);
    });

    it('returns false when HP is 0', () => {
      const cohort: TacticalCohort = {
        faction: 'PLAYER',
        type: 'knights',
        hp: 0,
        x: 0,
        y: 0,
        stance: 'ADVANCE',
        cooldown: 0,
        retreated: false,
      };
      expect(isCohortActive(cohort)).toBe(false);
    });

    it('returns false when cohort has retreated', () => {
      const cohort: TacticalCohort = {
        faction: 'PLAYER',
        type: 'knights',
        hp: 10,
        x: 0,
        y: 0,
        stance: 'RETREAT',
        cooldown: 0,
        retreated: true,
      };
      expect(isCohortActive(cohort)).toBe(false);
    });
  });
});
