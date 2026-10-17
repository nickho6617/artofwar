# The Ancient Art of War

[![Live Demo](https://img.shields.io/badge/Play_Live-GitHub_Pages-brightgreen?style=for-the-badge&logo=github)](https://nickho6617.github.io/artofwar/)

A lightweight, high-performance browser tribute to the 1984 real-time tactics classic *The Ancient Art of War* (Evry & Dave Murry / Brøderbund). 

Built without external game engines, this prototype proves out the classic dual-layer loop: strategic campaign maneuvering on a topographic map combined with zoomed-in, real-time tactical auto-battles. It features a dual-core simulation runtime: a primary **Rust + WebAssembly engine** with an automatic **TypeScript fallback**.

---

## Gameplay & Mechanics

### 1. Strategic Campaign Map
* **16×12 Topographic Grid:** Navigate across four terrain types that dynamically influence march speed, fatigue drain, mountain defense, and ambush opportunities.
* **Condition (Fatigue) System:** Marching exhausts squads (`0–100%`). Fatigued squads march slower and deal down to **50% less damage** in battle. Stationing idle squads inside a **Fort** rapidly restores Condition.
* **Shatter Remnants:** When a large squad ($\ge 10$ men) intercepts a broken remnant force ($\le 4$ men), the remnant is instantly overrun and captured on the strategic map. This bypasses tedious 1-second skirmishes against isolated survivors.
* **Squad Consolidation & Veteran Reinforcement:** Decimated and depleted squads can rendezvous and merge. Consolidated squads pool troops (up to 25 per cohort), inherit weighted Condition plus a **+15% Morale Recovery boost**, and earn **Veteran Squad** status (⭐ **+10% Combat Damage multiplier**).
* **Win Conditions:** Capture the enemy command flag or eliminate all opposing squads while protecting your own home flag.

| Terrain | March Speed | March Drain | Idle Recovery | Tactical & Strategic Traits |
| :--- | :--- | :--- | :--- | :--- |
| **Plains** (Light Green) | `1.00x` | `2.5/s` | `+0.5/s` | Baseline terrain |
| **Forest** (Dark Green) | `0.70x` | `3.0/s` | `+0.5/s` | **Ambush Advantage**: Stationary squads ambush intruders |
| **Mountain** (Grey) | `0.40x` | `5.0/s` | `+0.5/s` | **`1.25x` (+25% Combat Defense)** |
| **Fortress** (Brown) | `0.50x` | `0.0/s` | **`+5.0/s`** | Rapid Condition recovery |

### 2. Tactical Battle Arena
When opposing squads collide on the campaign map, the game pauses and zooms into the Tactical Arena. Squads deploy into up to three distinct unit cohorts:

* **Knights (Heavy Infantry):** High HP melee anchors. **2.0x vs. Archers** | *0.5x vs. Barbarians*.
* **Archers (Ranged):** Volley fire with simulated projectile flight paths. **2.0x vs. Barbarians** | *0.5x vs. Knights*.
* **Barbarians (Shock Troops):** Swift, high-DPS flankers. **2.0x vs. Knights** | *0.5x vs. Archers*.

### 3. Ambush, Pincer & Pursuit Mechanics
To counter hit-and-run abuse (e.g. retreating archers escaping repeatedly before melee troops can reach them), tactical battles incorporate Sun Tzu's principles of entrapment and pursuit:

* **Forest Ambush (`⚡ AMBUSH`):** Initiated when fighting an enemy while stationary in a **Forest** tile. Ambusher cohorts deploy 60px forward, and the ambushed force's retreat stance is locked for the first 6 seconds, giving attackers time to close distance and strike.
* **Pincer Cut-Off (`⚔️ PINCER`):** If a second friendly squad is within flanking range ($\le 110\text{px}$ on the strategic map), the encounter becomes a pincer maneuver. The enemy's escape edge is designated `BLOCKED`. Cornered units attempting to retreat off a blocked boundary cannot escape and are overwhelmed.
* **Fair Pursuit Deployment:** Enemy archer-only cohorts without melee screening deploy further forward ($x = 220$), preventing instant border escapes.

### 4. "Sun Tzu Lite" Autonomous AI
* **Strategic Layer (Evaluated every 2.0s):** Defends the home flag if hostile squads venture within 150px, dispatches exhausted squads (<40% Condition) to rest at the nearest Fort, and presses attacks against player squads or the player flag when healthy (>70% Condition).
* **Tactical Layer (Evaluated every 0.5s):** Adapts cohort stances based on archer count advantages and sounds a general retreat when outnumbered **4-to-1** (`<25%` of enemy force).

---

## Controls & Interface

### Strategic Map
* **Desktop:** Left-Click a blue squad to select, then Right-Click any tile to issue a march order waypoint.
* **Touch / Mobile:** Tap a friendly squad to select, then tap destination tile to march.

### Tactical Arena
| Key / Button | Action |
| :--- | :--- |
| `1` | Select **All** Cohorts |
| `2` | Select **Knights** Only |
| `3` | Select **Archers** Only |
| `4` | Select **Barbarians** Only |
| `A` / **Advance** | Selected cohorts close in and engage target |
| `H` / **Hold Ground** | Selected cohorts hold position, engaging only enemies within range |
| `R` / **Retreat!** | Selected cohorts withdraw toward edge to preserve remaining troops |

### Safety & Mobile UX
* **Protected Restart:** The **Restart Game** button is housed safely in the top header bar, completely isolated from combat command buttons to prevent accidental restarts on touchscreens.
* **Safety Guards:** Includes a confirmation prompt and transition cooldown preventing misclicks immediately following combat.

---

## Architecture & Tech Stack

* **Rendering:** HTML5 2D `<canvas>` with custom pixel-art, condition-ring overlays, and tactical HUD indicators (`⚡ AMBUSH`, `⚔️ PINCER`, `BLOCKED`).
* **Dual-Core Simulation Engine:**
  * **Primary (Rust / Wasm):** High-efficiency deterministic game loop in `crates/core`, compiled to `wasm32-unknown-unknown`.
  * **Fallback (TypeScript):** Mirror TS engine in `src/engine.ts` ensuring seamless instant boot in any environment.
* **Tooling:** Vite, TypeScript, Vitest, Cargo.

---

## Getting Started

### Prerequisites
* **Node.js** (v18+) and **npm**
* *(Optional, for recompiling Wasm core)*: **Rust** (`cargo`) with target `wasm32-unknown-unknown`

### Local Development
```bash
# Install frontend dependencies
npm install

# Run unit test suite
npm test

# Start the Vite development server
npm run dev
```

### Build for Production
```bash
# Build Wasm simulation binary and bundle frontend
npm run build

# Or build web-only frontend with TypeScript engine
npm run build:web

# Preview production build locally
npm run preview
```
The compiled output in `dist/` is static HTML/JS/WASM and can be deployed to Cloudflare Pages, GitHub Pages, Vercel, or AWS S3.
