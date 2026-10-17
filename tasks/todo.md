# Todo: Tactical Retreat Turnaround & Advance Controls

## Task 1: Symmetric Stance Scoping & Recall in Simulation Cores
**Description:** Update `SET_TACTICAL_STANCE` across TypeScript and Rust cores so that `ADVANCE` and `HOLD` reliably recall retreating cohorts, and provide a 1.5s turnaround grace period before permanent edge elimination.
**Acceptance criteria:**
- [x] In `src/engine.ts` and `crates/core/src/simulation.rs`, when `command.stance === 'ADVANCE'` or `'HOLD'` is dispatched, all retreating player cohorts (or selected cohorts) immediately switch stance and turn back toward the enemy.
- [x] Cohorts reaching the left edge linger for 1.5s before permanent `retreated = true` flag is set, enabling last-second turnaround orders.
- [x] Unit tests in `tests/tactical_combat.test.ts` verify that issuing `ADVANCE` after `RETREAT` turns all cohorts back to `ADVANCE` and resumes forward movement.
- [x] Cargo test in `crates/core/src/lib.rs` verifies identical stance switching in Rust core.
**Verification:**
- [x] Tests pass: `npx vitest run tests/tactical_combat.test.ts`
- [x] Cargo tests pass: `cargo test -p artofwar-core`
- [x] All tests pass: `npm test`
**Dependencies:** None
**Files likely touched:**
- `src/engine.ts`
- `crates/core/src/simulation.rs`
- `crates/core/src/lib.rs`
- `tests/tactical_combat.test.ts`

---

## Task 2: Active Stance Highlighting & Enhanced Cohort Stance Badges
**Description:** Add dynamic `.active` button states for tactical orders in `src/main.ts` and color-coded stance badges in `src/renderer.ts`.
**Acceptance criteria:**
- [x] Tactical order buttons (`#cmd-advance`, `#cmd-hold`, `#cmd-retreat`) receive `.active` styling based on the active stance of the selected cohorts.
- [x] CSS in `src/style.css` provides clear visual themes for active stance buttons: Green for Advance, Gold for Hold, Red for Retreat.
- [x] Cohort stance text in `src/renderer.ts` is rendered with distinctive color coding (`#6fe06f` for Advance, `#ffd860` for Hold, `#ff5252` for Retreat).
- [x] When archers are in `ADVANCE` but holding to fire within 240px, the badge displays `FIRING` or `ADVANCE (IN RANGE)` so players understand their behavior.
**Verification:**
- [x] Build succeeds: `npm run build:web`
- [x] Manual check: Order buttons visibly highlight upon clicking Advance / Hold / Retreat.
**Dependencies:** Task 1
**Files likely touched:**
- `src/main.ts`
- `src/style.css`
- `src/renderer.ts`

---

## Task 3: Strategic Disengagement Buffer & Auto-Selection
**Description:** Implement safe pushback separation ($100\text{px}$) and a 3-second disengagement grace period upon battle exit, with automatic squad selection for quick retreat maneuvering.
**Acceptance criteria:**
- [x] `endBattle` in `src/engine.ts` and `crates/core/src/simulation.rs` pushes retreating squads back $100\text{px}$ (up from $60\text{px}$).
- [x] Squads retreating from battle receive a 3.0s strategic engagement grace period preventing immediate re-engagement loops by pursuing AI squads.
- [x] The retreating squad is automatically selected (`selectedId = p.id`) upon return to the strategic map.
- [x] Strategic HUD displays clear instructions: `Squad P0 retreated · Tap map to march to safety or fort`.
- [x] Unit tests in `tests/strategic_movement.test.ts` verify the safe pushback distance and march resumption.
**Verification:**
- [x] Tests pass: `npx vitest run tests/strategic_movement.test.ts`
- [x] Full build succeeds: `npm run build`
- [x] All tests pass: `npm test` and `cargo test -p artofwar-core`
**Dependencies:** Task 1, Task 2
**Files likely touched:**
- `src/engine.ts`
- `crates/core/src/simulation.rs`
- `src/main.ts`
- `tests/strategic_movement.test.ts`
