# Todo: Unit Testing Suite Tasks

## Task 1: Setup Vitest Test Framework
**Description:** Install and configure Vitest as the unit test runner for the TypeScript engine and utilities.
**Acceptance criteria:**
- [x] `vitest` installed in `devDependencies`.
- [x] `npm test` script configured in `package.json` to execute `vitest run`.
- [x] Test command executes successfully with at least one sample test.
**Verification:**
- [x] Tests pass: `npm test`
- [x] Build succeeds: `npm run build:web`
**Files touched:**
- `package.json`

---

## Task 2: Math & Utility Functions Unit Tests
**Description:** Implement unit tests for pure utility functions in `src/engine.ts`.
**Acceptance criteria:**
- [x] `dist()` correctly computes Euclidean distance between points.
- [x] `clamp()` properly bounds values within [min, max].
- [x] `totalSquadUnits()` correctly aggregates knights + archers + barbarians.
- [x] `cohortRadius()`, `cohortCount()`, and `isCohortActive()` return correct values and handle edge states (0 HP, dead cohorts).
**Verification:**
- [x] Tests pass: `npx vitest run tests/utils.test.ts`
**Files touched:**
- `tests/utils.test.ts`

---

## Task 3: Strategic Marching & Terrain Modifiers
**Description:** Test squad movement, march speeds, and condition drain across different terrain types.
**Acceptance criteria:**
- [x] March speeds follow terrain multipliers: Plains (1.0x), Forest (0.7x), Mountain (0.4x), Fort (0.5x).
- [x] Squad speed scales with condition: `BASE_SPEED * t.speed * (0.6 + s.condition / 250)`.
- [x] Condition drains while marching: `2.5 * terrain.drain * dt`.
- [x] Dispatched `MARCH_SQUAD` command updates squad target coordinates.
**Verification:**
- [x] Tests pass: `npx vitest run tests/strategic_movement.test.ts`
**Files touched:**
- `tests/strategic_movement.test.ts`

---

## Task 4: Condition Recovery & Win Conditions
**Description:** Test condition recovery when idle in fort vs. other terrain, and all game-over trigger conditions.
**Acceptance criteria:**
- [x] Idle squad in Fort recovers at `+5.0 condition/second`.
- [x] Idle squad in open terrain recovers at `+0.5 condition/second`.
- [x] Player victory triggers when AI has 0 squads or player reaches AI flag within 20px.
- [x] AI victory triggers when Player has 0 squads or AI reaches player flag within 20px.
**Verification:**
- [x] Tests pass: `npx vitest run tests/strategic_state.test.ts`
**Files touched:**
- `tests/strategic_state.test.ts`

---

## Task 5: Rock-Paper-Scissors Advantage & Combat Formulas
**Description:** Test tactical arena damage calculations, rock-paper-scissors multipliers, and mountain defense bonuses.
**Acceptance criteria:**
- [x] Advantage multiplier is 2.0x for winning match-up (K>A, A>B, B>K) and 0.5x for disadvantage.
- [x] Condition reduces damage output according to `0.5 + condition / 200` (down to 50% at 0 condition).
- [x] Mountain defense grants 1.25x damage reduction (+25% defense) to the defending squad.
- [x] Archers fire projectiles and apply cooldown.
**Verification:**
- [x] Tests pass: `npx vitest run tests/tactical_combat.test.ts`
**Files touched:**
- `tests/tactical_combat.test.ts`

---

## Task 6: Autonomous AI Heuristics
**Description:** Test the "Sun Tzu Lite" autonomous strategic and tactical AI decision algorithms.
**Acceptance criteria:**
- [x] Threat defense: AI squad diverts to defend flag when player squad comes within 150px.
- [x] Rest behavior: AI squad moves to nearest fort when condition falls below 40%.
- [x] Attack behavior: AI squad moves to attack nearest player squad/flag when condition > 70%.
- [x] Tactical retreat: AI cohorts set stance to `RETREAT` when outnumbered 4-to-1 (`sum(AI) < 0.25 * sum(Player)`).
**Verification:**
- [x] Tests pass: `npx vitest run tests/ai.test.ts`
**Files touched:**
- `tests/ai.test.ts`

---

## Task 7: Rust Core Mirror Tests & CI Integration
**Description:** Add comprehensive Rust unit tests to `crates/core` mirroring the mechanics and add test execution to GitHub Actions.
**Acceptance criteria:**
- [x] Rust tests verify rock-paper-scissors multipliers, terrain drains, condition scaling, and AI triggers.
- [x] `cargo test` passes cleanly.
- [x] `.github/workflows/deploy.yml` runs `npm test` before building static artifacts.
**Verification:**
- [x] Tests pass: `cargo test` and `npm test`
- [x] CI workflow validates on push
**Files touched:**
- `crates/core/src/lib.rs`
- `.github/workflows/deploy.yml`
