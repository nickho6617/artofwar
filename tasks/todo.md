# Todo: Mobile & Touch-Friendly Controls Tasks

## Task 1: Input Resolver & Interaction Logic
**Description:** Extract and implement a cross-platform input interaction resolver that handles "Select-then-Move" (tap to select, tap ground to march, tap self to toggle deselect, right-click to march immediately).
**Acceptance criteria:**
- [x] Clicking/tapping a player squad when none is selected emits `SELECT_SQUAD` with that squad's ID.
- [x] Clicking/tapping an empty map location when a squad is selected emits `MARCH_SQUAD` with clamped target coordinates.
- [x] Clicking/tapping a different player squad when one is already selected switches selection to the new squad.
- [x] Clicking/tapping the currently selected squad toggles selection off (`SELECT_SQUAD` with `null`).
- [x] Right-clicking (`button === 2`) with a selected squad immediately dispatches `MARCH_SQUAD` regardless of target type.
- [x] Pure interaction resolver logic is covered by unit tests in `tests/input.test.ts`.
**Verification:**
- [x] Tests pass: `npx vitest run tests/input.test.ts`
- [x] All tests pass: `npm test`
**Dependencies:** None
**Files likely touched:**
- `src/input.ts` (new)
- `src/main.ts`
- `tests/input.test.ts` (new)

---

## Task 2: Touch Hit Detection, Pointer Events & Touch Hygiene
**Description:** Migrate canvas mouse listeners to Pointer Events, implement dynamic hit-radius scaling for touch devices (ensuring minimum 44px equivalent target diameter), and prevent unwanted browser scrolling/zooming on the canvas.
**Acceptance criteria:**
- [x] Canvas listens to `pointerdown` rather than standard `mousedown`.
- [x] Adaptive squad selection radius scales up for touch events (`pointerType === 'touch'`) to guarantee at least 24 CSS pixels radius (~48px diameter touch target).
- [x] Canvas has CSS `touch-action: none` (or `manipulation`) to prevent accidental scrolling, pinch zooming, and pull-to-refresh while tapping/dragging.
- [x] Context menu remains suppressed on canvas (`contextmenu.preventDefault()`).
**Verification:**
- [x] Build succeeds: `npm run build:web`
- [x] Manual check: Canvas tap interactions register cleanly without viewport pan/zoom jitter.
**Dependencies:** Task 1
**Files likely touched:**
- `src/main.ts`
- `src/style.css`

---

## Task 3: Responsive HUD, Waypoint Feedback & Accessible Controls
**Description:** Update the HUD and UI styling to provide clear visual feedback for touch marching, accessible button sizing, and platform-neutral instructions.
**Acceptance criteria:**
- [x] When a squad is selected in strategic mode, the HUD displays a "Squad selected · Tap map to march" notice with a quick "Deselect" button.
- [x] When a march order is issued, an animated waypoint pulse / target marker appears on canvas at `(targetX, targetY)`.
- [x] Strategic help panel text is updated to platform-neutral copy: `Tap or click squad to select · Tap map or right-click to march`.
- [x] Tactical buttons (`#tactical-panel button` and action buttons) have at least 44px touch target height with comfortable mobile padding and spacing.
- [x] Game controls remain fully functional on both small phone screens (320px-430px wide) and desktop displays.
**Verification:**
- [x] Tests pass: `npm test`
- [x] Build succeeds: `npm run build:web`
- [x] Manual check in browser: Complete strategic march and tactical battle using touch / click emulation.
**Dependencies:** Task 1, Task 2
**Files likely touched:**
- `index.html`
- `src/main.ts`
- `src/renderer.ts`
- `src/style.css`
