# Implementation Plan: Mobile & Touch-Friendly Browser Controls

## Overview
Currently, strategic squad control relies on desktop mouse conventions: left-click (`e.button === 0`) to select a squad, and right-click (`e.button === 2`) to march. On mobile browsers and touch devices:
1. Touch taps only register as primary clicks (`button: 0`). Right-click (`button: 2`) does not exist naturally (long-press is slow, prone to browser context menus, text selection, and callout popups).
2. The squad selection hit radius is fixed at 18 canvas units. On mobile viewports (e.g. 390px wide), this scales down to under 9 CSS pixels, making squad selection difficult and frustrating.
3. Canvas interaction lacks `touch-action` control, leading to accidental page scrolling, double-tap zoom, and pull-to-refresh gestures.
4. Strategic help text specifically states *"Left-click a blue squad to select / Right-click to march"*, which is misleading and unhelpful on mobile devices.

This plan introduces a unified, accessible **"Tap-to-Select, Tap-to-March"** interaction model that seamlessly supports touch screens, mobile browsers, trackpads, and desktop mice with zero regression.

---

## Architecture Decisions

### 1. Two-Step Interaction Model ("Select-then-Move")
- **When no squad is selected:**
  - Tapping or clicking any friendly (blue) squad selects it.
  - Tapping empty ground does nothing (or clears selection).
- **When a squad is selected:**
  - Tapping another friendly squad switches selection to that squad.
  - Tapping the currently selected squad deselects it (toggle off).
  - Tapping anywhere else on the map (empty ground, enemy squads, enemy flag) immediately issues a `MARCH_SQUAD` order to those coordinates.
  - Desktop right-click remains fully supported: right-clicking any destination immediately issues a march order to that point, preserving desktop muscle memory.

### 2. Adaptive Hit Sizing for Touch
- On desktop mice, precision is high (~18 canvas pixels).
- For touch events (`pointerType === 'touch'` or touch events), expand the hit detection tolerance dynamically based on canvas bounding box to guarantee at least 24 CSS pixels radius (48px diameter touch target conforming to WCAG / Apple HIG guidelines), preventing missed taps.

### 3. Gesture and Touch Hygiene
- Apply `touch-action: none` (or `manipulation`) to the canvas in CSS and attach `pointerdown` / `pointerup` handlers with `preventDefault()` on touch interaction to suppress unwanted browser pinch-zoom, double-tap zoom, and vertical drag scrolling.

### 4. Contextual Mobile HUD & Visual Feedback
- Add an explicit mobile-friendly HUD indicator when a squad is selected: displaying the selected squad's status with an immediate "Cancel / Deselect" button and "Tap map to march" hint.
- Update the strategic help panel text to be platform-neutral:
  `Tap or click squad to select · Tap map or right-click to march`
- Ensure tactical panel buttons (`#tactical-panel button`) meet the 44px minimum touch target height with adequate touch margins for thumb navigation on mobile screens.
- Add brief waypoint / ripple feedback on the canvas at the march target when a march order is dispatched so players receive instant confirmation.

---

## Task Breakdown

### Phase 1: Input Abstraction & Interaction Logic
- [ ] **Task 1: Input Resolver & Interaction Logic**
  - Extract canvas input handling logic into a clean, testable helper/state machine (`handleMapPointerDown` or input handler).
  - Implement two-step selection: tap squad to select, tap new squad to switch, tap selected squad to deselect, tap ground to march.
  - Retain immediate right-click (`button === 2`) for desktop users.
  - Add comprehensive unit tests verifying selection, switching, deselection, and marching flows.

### Phase 2: Touch Ergonomics & Viewport Styling
- [ ] **Task 2: Touch Hit Detection, Pointer Events & Touch Hygiene**
  - Migrate canvas click listeners to Pointer Events (`pointerdown`) with `pointerType` detection.
  - Calculate adaptive hit radius ensuring >= 44px touch targets on smaller viewports.
  - Configure `touch-action: none` on the canvas in `src/style.css` to eliminate browser zoom/scroll interference.

### Phase 3: UI, Feedback & Platform Guidance
- [ ] **Task 3: Responsive HUD, Waypoint Feedback & Accessible Controls**
  - Add contextual march hint and deselect button in the strategic HUD when a squad is active.
  - Render immediate waypoint ripple/marker at target coordinates on march dispatch in `renderer.ts`.
  - Update strategic instructions in `index.html` to platform-neutral copy.
  - Enhance tactical panel button touch targets (`min-height: 44px`, mobile-friendly spacing) in `src/style.css`.

---

## Verification Plan

### Automated Tests
- Focused unit tests: `npm test` (verifying new input handling tests alongside existing engine and combat suites).
- Production build: `npm run build:web` (`tsc && vite build`).

### Manual Checkpoints
- **Mobile Emulation / Touch Verification:**
  - Emulate mobile device in DevTools (e.g. iPhone 14 / Pixel 7).
  - Tap blue squad -> squad is selected with visible highlight.
  - Tap terrain -> squad marches to target coordinates with waypoint indicator.
  - Tap blue squad again -> squad deselects without marching.
  - Verify canvas does not scroll or zoom while tapping/swiping.
  - In tactical battle mode, tap unit buttons (All, Knights, Archers, Barbarians) and command buttons (Advance, Hold, Retreat) to confirm smooth finger tapping.
- **Desktop Verification:**
  - Left-click squad to select.
  - Right-click terrain to march.
  - Verify desktop behavior is 100% backward-compatible.
