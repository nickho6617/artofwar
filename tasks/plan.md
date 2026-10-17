# Implementation Plan: Tactical Retreat Turnaround & Responsive Advance Controls

## Overview & Problem Diagnosis
Currently, when a player orders a retreat during a tactical auto-battle, attempting to order an advance again appears broken or unresponsive. A deep architectural trace reveals five interconnected root causes across simulation logic and UI feedback:

1. **Asymmetric Stance Scoping:**
   In both `src/engine.ts` and `crates/core/src/simulation.rs`, the `SET_TACTICAL_STANCE` handler implements asymmetric logic:
   ```ts
   // Retreat applies to ALL player cohorts unconditionally:
   (command.stance === 'RETREAT' || hasType)
   ```
   When `Retreat` (`R`) is clicked, **all** cohorts are forced into `RETREAT`. However, when the player subsequently clicks `Advance` (`A`), the command only applies to `hasType` (the currently selected cohort filter). If the player previously selected `Knights` or `Archers`, clicking `Advance` only orders that single cohort to advance—the rest of the squad continues fleeing toward the boundary and vanishes from the battlefield!

2. **Rapid, Permanent Edge Elimination (`retreated = true`):**
   Archers deploy at $x = 120$ and Barbarians at $x = 230$. When retreating at full speed ($44\text{–}74\text{px/s}$), cohorts reach the left edge ($x \le \text{radius}$) in **under 2.1 seconds**. The instant a cohort touches the border, `c.retreated = true` is set. Because `isCohortActive()` requires `!c.retreated`, these units are permanently disqualified from active combat. Any `Advance` order issued even 2 seconds after a retreat cannot recall them.

3. **Archers Stand Still When Switched to Advance Within Range:**
   When archers switch from `RETREAT` to `ADVANCE`, `updateTactical` evaluates:
   ```ts
   if (edge <= reach) { /* Shoot arrows without moving */ }
   else if (c.stance === 'ADVANCE') { /* Move forward */ }
   ```
   Because archers have `reach = 240px`, any enemy within 240px causes archers to stop in their tracks and fire. Without active stance feedback, players assume the archers failed to register the `Advance` order and are stuck.

4. **Zero Visual Feedback on Active Stance Buttons:**
   Unit selection buttons (`All`, `Knights`, `Archers`, `Barbarians`) have `.active` CSS state. However, the order buttons (`cmd-advance`, `cmd-hold`, `cmd-retreat`) have **no `.active` state** in `updateHud()`. Players have no visual confirmation of whether their Advance or Hold order took effect.

5. **Post-Battle Immediate Re-engagement Trap:**
   When all cohorts retreat off the screen, the squad is pushed back only $60\text{px}$ on the strategic map with `selectedId = null`. Because pursuing AI squads have $>70$ Condition, the AI immediately charges and re-engages the player squad within 1.5 seconds, trapping the player in an inescapable combat loop.

---

## Architecture Decisions

### 1. Symmetric & Squad-Aware Stance Dispatch (Dual-Engine Parity)
- In both `src/engine.ts` and `crates/core/src/simulation.rs`:
  - When `command.stance === 'ADVANCE'` or `'HOLD'` is dispatched:
    - If `b.selected` is `'all'` OR if all active cohorts are currently in `RETREAT`, the command applies to **all** active player cohorts.
    - This allows a single tap of `Advance` or pressing `A` to immediately rally the entire retreating squad and turn them back into the fray.
  - If a specific cohort filter is selected (e.g. `Knights`), clicking `Advance` switches that cohort to `ADVANCE`, while `All` -> `Advance` switches the entire army.

### 2. Turnaround Window & Border Grace Period
- Cohorts that have reached the retreat border ($x \le \text{radius}$) will linger in a border buffer for **1.5 seconds** before being permanently marked `c.retreated = true`.
- If an `ADVANCE` or `HOLD` command is received while lingering at the border, the cohort resets its retreat status, turns around, and marches back into battle.
- This gives players an intuitive, forgiving window to correct misclicks or adapt tactical decisions without losing their entire army.

### 3. Tactical HUD Stance Highlighting & Visual Indicators
- In `src/main.ts`, update `updateHud()` to dynamically toggle `.active` on `#cmd-advance`, `#cmd-hold`, and `#cmd-retreat` based on the stance of the currently selected cohort(s).
- In `src/renderer.ts`, render color-coded stance badges under each cohort:
  - `ADVANCE`: Vibrant Green (`#6fe06f`)
  - `HOLD`: Warm Gold (`#ffd860`)
  - `RETREAT`: Crimson Red (`#ff5252`)
- For archers in `ADVANCE` within firing range, display `FIRING` or `ADVANCE (IN RANGE)` so players understand why archers are holding position to fire volleys.

### 4. Strategic Disengagement Grace Period & Auto-Selection
- When a squad finishes retreating from battle:
  - Increase the safe pushback distance from $60\text{px}$ to **$100\text{px}$**.
  - Add a **3.0-second disengagement cooldown** (`retreatCooldown: 3.0`) during which enemy AI squads will not immediately re-engage the retreating squad.
  - Automatically select the retreating squad (`selectedId = p.id`) upon return to the strategic map and display an actionable HUD prompt:
    `Squad P0 retreated! Tap map to march to safety or fort.`

---

## Task Breakdown

### Phase 1: Symmetric Tactical Stance Dispatch & Turnaround Logic
- [ ] **Task 1: Symmetric Stance Scoping & Recall in Simulation Cores**
  - Update `SET_TACTICAL_STANCE` in `src/engine.ts` and `crates/core/src/simulation.rs` so that `ADVANCE` and `HOLD` recall all retreating cohorts when general squad advance is ordered.
  - Implement a 1.5s border turnaround grace window so squads touching the boundary can turn around and advance if ordered before battle ends.
  - Unit tests in `tests/tactical_combat.test.ts` verifying that issuing `ADVANCE` after `RETREAT` immediately turns cohorts back toward enemies across both TS and Rust engines.

### Phase 2: Tactical HUD Stance States & Cohort Feedback
- [ ] **Task 2: Active Stance Highlighting & Enhanced Cohort Stance Badges**
  - Update `updateHud()` in `src/main.ts` to toggle `.active` on `#cmd-advance`, `#cmd-hold`, and `#cmd-retreat`.
  - Add `.cmd.advance.active`, `.cmd.hold.active`, `.cmd.retreat.active` button styles in `src/style.css`.
  - Color-code cohort stance text in `src/renderer.ts` with distinct green/gold/red badges.
  - Clarify archer range-engagement status (`FIRING` / `ADVANCE`).

### Phase 3: Strategic Disengagement & Seamless Post-Battle Recovery
- [ ] **Task 3: Strategic Disengagement Buffer & Auto-Selection**
  - Increase post-retreat pushback distance to $100\text{px}$ in `endBattle` (`src/engine.ts` and `simulation.rs`).
  - Add a 3.0s strategic engagement grace period preventing immediate re-engagement loops.
  - Auto-select the retreating squad upon battle exit so players can instantly issue march orders to safety.
  - Unit tests in `tests/strategic_movement.test.ts` verifying disengagement and march resumption.

---

## Verification Plan

### Automated Tests
- `npm test`:
  - `tests/tactical_combat.test.ts`: test issuing `RETREAT`, then issuing `ADVANCE`, verifying all cohorts turn back to `ADVANCE` and move forward.
  - `tests/strategic_movement.test.ts`: test post-retreat squad selection and movement.
- `cargo test -p artofwar-core`:
  - Verify Rust core handles `SetTacticalStance` symmetry and turnaround logic.
- `npm run build`:
  - Verify Wasm compilation and Vite production build.

### Manual Verification
1. **In-Battle Retreat and Advance:**
   - Engage an enemy squad on the campaign map to enter Tactical Arena.
   - Click `Retreat` (or press `R`): verify all cohorts turn around and march left toward the border; verify `#cmd-retreat` is highlighted in red.
   - Click `Advance` (or press `A`): verify all cohorts immediately halt retreat, turn around, and advance toward enemy lines; verify `#cmd-advance` is highlighted in green.
   - Verify cohort stance labels reflect `ADVANCE` in green.
2. **Post-Battle Recovery:**
   - Allow a squad to fully retreat off the map.
   - Verify return to strategic map has squad auto-selected with $100\text{px}$ safe separation.
   - Tap ground to march toward a fort without immediate AI collision.
