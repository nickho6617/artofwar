# Todo: Combining Decimated Squads into a Powerful Veteran Squad

## Task 1: Core Domain & Dual-Engine Merge Logic
**Description:** Add veteran and merge tracking fields to domain models, implement the `COMBINE_SQUADS` command, and build troop pooling, condition formula (+15% morale recovery), and +10% veteran combat damage buff across TypeScript and Rust engines.
**Acceptance criteria:**
- [x] `Squad` interface in `src/types.ts` and `crates/core/src/types.rs` includes `veteran?: boolean` and `mergeTargetId?: string | null`.
- [x] `GameCommand` includes `{ type: 'COMBINE_SQUADS'; sourceId: string; targetId: string }` in TS and Rust.
- [x] `combineSquads(sourceId, targetId)` correctly pools knights, archers, and barbarians (capped at squad max capacity).
- [x] Resulting squad receives troop-weighted condition average + 15% morale bonus (clamped to 100%) and has `veteran = true`.
- [x] Source squad is cleanly removed from `state.squads`.
- [x] Tactical combat deals 1.10x (+10%) damage when the attacker belongs to a veteran squad.
- [x] Unit tests in new `tests/combine_squads.test.ts` verify pooling, condition calculation, veteran buff, and capacity clamping.
**Verification:**
- [x] Tests pass: `npx vitest run tests/combine_squads.test.ts`
- [x] All tests pass: `npm test`
**Dependencies:** None
**Files touched:**
- `src/types.ts`
- `src/engine.ts`
- `crates/core/src/types.rs`
- `crates/core/src/simulation.rs`
- `tests/combine_squads.test.ts`

---

## Task 2: AI Autonomous Regrouping
**Description:** Enhance `aiThink()` so the AI evaluates depleted squads (< 12 men) and marches them toward the nearest friendly squad with capacity, automatically combining upon reaching rendezvous proximity ($\le 25\text{px}$).
**Acceptance criteria:**
- [x] When an AI squad has $< 12$ total men, `aiThink()` directs it toward the closest friendly AI squad with capacity instead of suicide-charging or getting shattered.
- [x] When two friendly AI squads are within merge radius ($\le 25\text{px}$) and one is depleted, they automatically combine into a reinforced veteran squad.
- [x] Prevents AI from creating invalid loops or targeting dead squads.
- [x] Unit tests in `tests/ai.test.ts` verify AI regrouping and combination behavior.
**Verification:**
- [x] Tests pass: `npx vitest run tests/ai.test.ts`
- [x] All tests pass: `npm test`
**Dependencies:** Task 1
**Files touched:**
- `src/engine.ts`
- `crates/core/src/simulation.rs`
- `tests/ai.test.ts`

---

## Task 3: Strategic Input & Rendezvous HUD Controls
**Description:** Implement the contextual "⚔️ Combine Squads" button and "March to Merge" order mode in the strategic HUD and input resolver.
**Acceptance criteria:**
- [x] When a selected player squad is within $35\text{px}$ of another friendly squad, the HUD displays a prominent button: `⚔️ Combine Squads (P0 + P1) ⭐`.
- [x] Clicking/tapping the Combine button dispatches `COMBINE_SQUADS` and merges the squads immediately.
- [x] When a squad is selected, HUD provides a "Rendezvous" button allowing the player to target an ally squad to march toward and merge upon contact.
- [x] Input interactions maintain complete mobile/touch ergonomics ($\ge 44\text{px}$ touch targets, no accidental map scrolling).
- [x] Input unit tests cover combine command dispatch and rendezvous resolution in `tests/input.test.ts`.
**Verification:**
- [x] Tests pass: `npx vitest run tests/input.test.ts`
- [x] Build succeeds: `npm run build:web`
**Dependencies:** Task 1
**Files touched:**
- `index.html`
- `src/input.ts`
- `src/main.ts`
- `src/style.css`
- `tests/input.test.ts`

---

## Task 4: Visual Feedback, Veteran FX & Tactical Display
**Description:** Add visual representation for Veteran squads (golden star ⭐ badge, golden halo ring), rendezvous march line, and floating banner announcements upon squad combination.
**Acceptance criteria:**
- [x] Strategic squad renderer in `src/renderer.ts` draws a gold star ⭐ badge and gold halo ring when `squad.veteran` is true.
- [x] When a squad is marching toward an ally on a rendezvous order, a distinctive golden dashed line connects them.
- [x] When squads combine, display a floating notification banner: `Player/Enemy squads combined into Veteran Force (... men, +10% DMG)!`.
- [x] Tactical arena displays a `⭐ VETERAN` badge next to the veteran squad's cohorts and HUD.
**Verification:**
- [x] Build succeeds: `npm run build`
- [x] All tests pass: `npm test` and `cargo test -p artofwar-core`
**Dependencies:** Task 1, Task 3
**Files touched:**
- `src/renderer.ts`
- `src/style.css`
- `index.html`
- `src/main.ts`
