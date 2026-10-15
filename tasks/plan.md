# Implementation Plan: Comprehensive Unit Testing Suite

## Overview
Establish a robust, automated unit testing foundation covering both the TypeScript simulation engine (`src/engine.ts`) and the Rust/Wasm simulation engine (`crates/core`). Testing will verify math/formulas, rock-paper-scissors combat mechanics, squad marching and stamina drain/recovery, autonomous AI decision making, win/loss conditions, and cross-engine parity.

---

## Architecture Decisions

1. **Test Runner for Web/TypeScript:**
   * **Vitest** is selected as the test runner for TypeScript.
   * *Rationale:* Native Vite integration, zero configuration needed for TypeScript/ESM, fast execution, and identical API to Jest (`describe`, `it`, `expect`).

2. **Test Granularity & Organization:**
   * `tests/engine/` for pure logic and math helpers (`dist`, `clamp`, `totalSquadUnits`, `cohortRadius`).
   * `tests/strategic/` for strategic movement, terrain multipliers, condition fatigue drain, and fort recovery.
   * `tests/tactical/` for tactical battle initiation, cohort setup, rock-paper-scissors multipliers, projectile combat, and casualties.
   * `tests/ai/` for strategic heuristics (defend flag, rest in fort, press attack) and tactical retreats.
   * `crates/core/tests/` for expanded Rust unit tests mirroring all engine behaviors.

3. **CI/CD Integration:**
   * Add automated test verification steps to GitHub Actions (`.github/workflows/deploy.yml` or a dedicated test workflow) to prevent regressions on push.

---

## Task List

### Phase 1: Test Infrastructure & Helper Verification
- [ ] **Task 1: Setup Vitest Test Framework**
  - Install `vitest` as a dev dependency.
  - Add `"test": "vitest run"` and `"test:watch": "vitest"` scripts to `package.json`.
  - Add test badge/documentation to `README.md`.
- [ ] **Task 2: Math & Utility Functions Unit Tests**
  - Unit tests for `dist()`, `clamp()`, `totalSquadUnits()`, `cohortRadius()`, `cohortCount()`, and `isCohortActive()`.
  - Verify edge cases (zero units, clamped boundaries, negative coordinates).

### Checkpoint: Foundation
- [ ] `npm test` runs and passes.
- [ ] TypeScript compiles cleanly with `npm run build:web`.

---

### Phase 2: Strategic Simulation & Movement Tests
- [ ] **Task 3: Strategic Marching & Terrain Modifiers**
  - Verify march speed scaling per terrain: Plains (1.0x), Forest (0.7x), Mountain (0.4x), Fort (0.5x).
  - Verify condition fatigue drain per terrain: Plains (2.5/s), Forest (3.0/s), Mountain (5.0/s).
  - Verify condition scaling on movement speed (`0.6 + condition / 250`).
- [ ] **Task 4: Condition Recovery & Win Conditions**
  - Verify idle squads in Fort recover condition at `+5.0/s`.
  - Verify idle squads on non-fort terrain recover at `+0.5/s`.
  - Verify win conditions: Player captures AI flag, AI captures Player flag, total squad annihilation.

### Checkpoint: Strategic Mechanics
- [ ] Strategic map tests pass.
- [ ] Win condition edge cases verified.

---

### Phase 3: Tactical Combat Arena & AI Heuristics
- [ ] **Task 5: Rock-Paper-Scissors Advantage & Damage Formulas**
  - Verify damage multipliers: Knights 2x vs Archers, Archers 2x vs Barbarians, Barbarians 2x vs Knights (and 0.5x reverse counters).
  - Verify condition penalty multiplier (`0.5 + condition / 200`) down to 50% damage at 0% condition.
  - Verify Mountain terrain defense bonus (`1.25x` / +25% defense).
  - Verify Archer ranged projectile cooldown and volley triggers.
- [ ] **Task 6: AI Decision Making ("Sun Tzu Lite")**
  - Strategic AI: Flag defense trigger when player squad is within 150px.
  - Strategic AI: Retreat/rest order to nearest fort when condition < 40%.
  - Strategic AI: Attack nearest target when condition > 70%.
  - Tactical AI: Automatic retreat trigger when outnumbered 4-to-1 (`sum(AI) < 0.25 * sum(Player)`).
- [ ] **Task 7: Rust Core Mirror Tests & CI Integration**
  - Expand `crates/core` Rust tests to cover identical rules in Rust.
  - Update GitHub Actions workflow to run `cargo test` and `npm test` before building.

### Checkpoint: Complete
- [ ] Both `npm test` and `cargo test` pass with 100% success.
- [ ] All acceptance criteria met across all modules.

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
| :--- | :--- | :--- |
| Floating point rounding discrepancies between TS and Rust | Low | Use approx/epsilon assertions (e.g. `toBeCloseTo`) for dt integration calculations. |
| Non-deterministic random values in combat cooldowns | Med | Initialize initial cooldowns or control dt in unit tests to test predictable state steps. |
| Test suite execution time | Low | Keep all unit tests in-memory with zero I/O; suite completes in under 1 second. |

---

## Open Questions & Verification
- No blocking questions. All core formulas and rules are specified in `src/engine.ts` and `crates/core/src/simulation.rs`.
