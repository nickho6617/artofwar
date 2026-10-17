# Implementation Plan: Combining Decimated Squads into a Powerful Veteran Squad

## Overview
In campaign gameplay, squads take casualties during tactical battles, often leaving decimated remnant forces (e.g., 2–8 men). Currently, there is no mechanism to merge or reorganize depleted squads. These small fragments clutter the strategic map, become vulnerable to the Shatter Remnants rule ($\le 4$ men captured instantly), and dilute player combat effectiveness.

This feature introduces **Squad Consolidation & Veteran Reinforcement**: allowing two depleted or decimated friendly squads to merge into a single reinforced, battle-hardened squad. The combined squad inherits pooled troop counts, a weighted condition with a **+15% Morale Consolidation boost**, and a permanent **Veteran Trait (⭐ +10% Combat Effectiveness)**. Both player controls (intuitive proximity HUD button + march-to-merge order) and autonomous AI routines ("Sun Tzu" regrouping) will support squad combination across both the **TypeScript fallback** and **Rust + WebAssembly** simulation cores.

---

## Architecture & Game Design Decisions

### 1. Merge Rules & Capacity Limits
- **Eligibility:** Any two friendly squads belonging to the same faction where at least one squad is depleted ($< 45$ total men, or depleted cohort).
- **Troop Consolidation:**
  - Knights, Archers, and Barbarians are pooled:
    $$\text{knights}_{\text{new}} = \min(25, s_1.\text{knights} + s_2.\text{knights})$$
    $$\text{archers}_{\text{new}} = \min(25, s_1.\text{archers} + s_2.\text{archers})$$
    $$\text{barbarians}_{\text{new}} = \min(25, s_1.\text{barbarians} + s_2.\text{barbarians})$$
  - Overall squad cap is standard max 45 men (or up to 50 for a super-reinforced squad).
- **Condition & Morale Recovery:**
  - Condition is calculated as the troop-weighted average of both squads plus a **+15% Morale Consolidation bonus** (clamped to 100%):
    $$\text{cond}_{\text{new}} = \min\left(100, \frac{s_1.\text{cond} \times n_1 + s_2.\text{cond} \times n_2}{n_1 + n_2} + 15\right)$$
- **"More Powerful" Veteran Trait (`veteran: boolean` or `veteranTier: number`):**
  - Combining battle-tested squads promotes the unit to **Veteran Squad** status (`veteran: true`).
  - In tactical combat, Veteran squads deal **+10% bonus damage** and have a distinctive visual identity (golden star badge ⭐, golden rim on the strategic map, and tactical banner).

### 2. Interaction Model & Ergonomics (Desktop & Mobile)
To prevent accidental merges during pincer maneuvers (where squads need to operate within 110px of each other), squad merging requires explicit intent:
1. **Contextual HUD Combine Button (Immediate Merge):**
   - When a squad $A$ is selected and within rendezvous range ($\le 35\text{px}$) of a friendly squad $B$, the strategic HUD surfaces a high-visibility button:
     `⚔️ Combine Squads (P0 + P1) ⭐`
   - Tapping/clicking the button immediately combines them into $A$ and removes $B$, showing an animated golden particle/ripple and notification banner.
2. **March-to-Merge Order (`MERGE_SQUADS_ORDER`):**
   - When a squad $A$ is selected, player can tap a "Rendezvous / Merge" button in the HUD to enter Merge Target mode, or right-click/target a friendly squad directly.
   - Squad $A$ marches toward Squad $B$; upon arriving within rendezvous distance ($\le 25\text{px}$), they automatically consolidate into a single veteran squad.
3. **Safety & Deselection:**
   - Standard tap-to-select and tap-to-march behaviors are preserved with zero regression.

### 3. AI Autonomous Regrouping ("Sun Tzu Regroup")
- During the AI decision cycle (`aiThink()` every 2.0s):
  - The AI evaluates its forces. If an AI squad is decimated ($< 12$ total men or in shatter danger $\le 4$ men), it searches for the nearest friendly AI squad that has capacity ($< 45$ men).
  - The AI issues a rendezvous order to march toward the ally squad.
  - When within merge radius ($\le 25\text{px}$), the AI squads automatically combine, creating a reinforced AI veteran squad and preventing easy mop-up captures.

### 4. Dual-Core Simulation Parity
- **TypeScript Engine (`src/engine.ts` & `src/types.ts`)**:
  - Add `veteran?: boolean` and optional `mergeTargetId?: string | null` to `Squad`.
  - Add `COMBINE_SQUADS` command to `GameCommand`:
    `{ type: 'COMBINE_SQUADS'; sourceId: string; targetId: string }`
  - Implement merge resolution logic, condition calculation, veteran buff, and combat damage multiplier.
- **Rust / WebAssembly Engine (`crates/core/src/types.rs` & `crates/core/src/simulation.rs`)**:
  - Add `pub veteran: bool` and `pub merge_target_id: Option<String>` to `Squad`.
  - Add `CombineSquads { source_id: String, target_id: String }` to `GameCommand`.
  - Implement identical merge arithmetic, condition formula, and tactical multiplier in Rust.

---

## Task Breakdown

### Phase 1: Engine Domain Types & Simulation Logic
- [ ] **Task 1: Core Domain & Dual-Engine Merge Logic**
  - Add `veteran` and `mergeTargetId` fields to `Squad` in `src/types.ts` and `crates/core/src/types.rs`.
  - Add `COMBINE_SQUADS` command to `GameCommand` in TS and Rust.
  - Implement `combineSquads(sourceId, targetId)` in `src/engine.ts` and `crates/core/src/simulation.rs`.
  - Incorporate the `veteran` damage bonus (+10%) in tactical combat damage calculation.
  - Implement rendezvous auto-merge when a squad reaches its `mergeTargetId`.
  - Unit tests in `tests/strategic_state.test.ts` and new `tests/combine_squads.test.ts`.

### Phase 2: AI Strategic Regrouping
- [ ] **Task 2: AI Decimated Squad Consolidation**
  - Update `aiThink()` in `src/engine.ts` and `simulation.rs`: AI detects depleted squads ($< 12$ men) and assigns them to rendezvous with the nearest friendly squad.
  - Trigger merge when AI squads arrive within distance ($\le 25\text{px}$).
  - Comprehensive unit tests in `tests/ai.test.ts`.

### Phase 3: Player Controls & HUD Interactions
- [ ] **Task 3: Strategic Input & Rendezvous Command**
  - Update `src/input.ts` to support merge-intent targeting (via HUD mode or targeted action).
  - Add contextual "⚔️ Combine Squads" action button in the strategic HUD when two friendly squads are within rendezvous range ($\le 35\text{px}$).
  - Add "Merge Order" button in HUD when a depleted squad is selected.
  - Unit tests in `tests/input.test.ts`.

### Phase 4: Visual Feedback & Rendering
- [ ] **Task 4: Veteran Squad Rendering & Consolidation FX**
  - Render golden star badge ⭐ and golden ring for Veteran squads on the campaign map in `src/renderer.ts`.
  - Display Veteran indicator in tactical combat cohort headers.
  - Add floating banner notification: *"Squads Combined! Veteran Force Formed (+10% Combat Bonus)"*.
  - Render dashed rendezvous link when a squad is marching to merge with an ally.

---

## Verification Plan

### Automated Tests
- `npm test`:
  - `tests/combine_squads.test.ts` verifying troop pooling, condition recovery, veteran buff, and capacity limits.
  - `tests/strategic_state.test.ts` verifying squad removal, state updates, and win condition checks.
  - `tests/ai.test.ts` verifying AI depleted squad regrouping behavior.
  - `tests/input.test.ts` verifying HUD and pointer interaction triggers.
- Production build:
  - `npm run build:web` (`tsc && vite build`)
  - `npm run build:wasm` (`cargo build ...`)

### Manual Verification
1. **Player Squad Combination:**
   - Deploy player squad into battle, retreat or take casualties until reduced to ~10 men.
   - March depleted squad next to another player squad ($\le 35\text{px}$).
   - Verify contextual "⚔️ Combine Squads" button appears in HUD with troop count preview.
   - Click Combine: verify squad counts merge, veteran ⭐ star appears, and notification pops up.
   - Enter tactical combat with the veteran squad: verify +10% combat efficiency and veteran marker.
2. **AI Squad Combination:**
   - Damage an AI squad down to 5 men. Observe AI strategic phase: AI squad retreats/marches toward an ally squad and combines upon meeting.
3. **Touch / Mobile Emulation:**
   - Verify Combine button meets $\ge 44\text{px}$ touch target height and responds smoothly to mobile taps without viewport jitter.
