# The Ancient Art of War

[![Live Demo](https://img.shields.io/badge/Play_Live-GitHub_Pages-brightgreen?style=for-the-badge&logo=github)](https://nickho6617.github.io/artofwar/)

A lightweight, high-performance browser tribute to the 1984 real-time tactics classic *The Ancient Art of War* (Evry & Dave Murry / Brøderbund). 

Built without external game engines, this prototype proves out the classic dual-layer loop: strategic campaign maneuvering on a topographic map combined with zoomed-in, real-time tactical auto-battles. It features a dual-core simulation runtime: a primary **Rust + WebAssembly engine** with an automatic **TypeScript fallback**.

---

## Gameplay & Mechanics

### 1. Strategic Campaign Map
* **16×12 Topographic Grid:** Navigate across four terrain types that dynamically influence march speed, fatigue drain, and mountain defensive positioning.
* **Condition (Fatigue) System:** Marching exhausts squads (`0–100%`). Fatigued squads march slower and deal down to **50% less damage** in battle. Stationing idle squads inside a **Fort** rapidly restores Condition.
* **Win Conditions:** Capture the enemy command flag or eliminate all opposing squads while protecting your own home flag.

| Terrain | March Speed | March Drain | Idle Recovery | Tactical Combat Defense |
| :--- | :--- | :--- | :--- | :--- |
| **Plains** (Light Green) | `1.00x` | `2.5/s` | `+0.5/s` | Baseline (`1.0x`) |
| **Forest** (Dark Green) | `0.70x` | `3.0/s` | `+0.5/s` | Baseline (`1.0x`) |
| **Mountain** (Grey) | `0.40x` | `5.0/s` | `+0.5/s` | **`1.25x` (+25% Def)** |
| **Fortress** (Brown) | `0.50x` | `0.0/s` | **`+5.0/s`** | Baseline (`1.0x`) |

### 2. Tactical Battle Arena
When opposing squads collide on the campaign map, the game pauses and zooms into the Tactical Arena. Squads deploy into up to three distinct unit cohorts:

* **Knights (Heavy Infantry):** High HP melee anchors. **2.0x vs. Archers** | *0.5x vs. Barbarians*.
* **Archers (Ranged):** Volley fire with simulated projectile flight paths. **2.0x vs. Barbarians** | *0.5x vs. Knights*.
* **Barbarians (Shock Troops):** Swift, high-DPS flankers. **2.0x vs. Knights** | *0.5x vs. Archers*.

### 3. "Sun Tzu Lite" Autonomous AI
* **Strategic Layer (Evaluated every 2.0s):** Defends the home flag if hostile squads venture within 150px, dispatches exhausted squads (<40% Condition) to rest at the nearest Fort, and presses attacks against player squads or the player flag when healthy (>70% Condition).
* **Tactical Layer (Evaluated every 0.5s):** Adapts cohort stances based on archer count advantages and sounds a general retreat when outnumbered **4-to-1** (`<25%` of enemy force).

---

## Controls

### Strategic Map
* **Left-Click (Blue Squad):** Select friendly squad.
* **Right-Click (Tile):** Issue march order waypoint.

### Tactical Arena
| Key / Button | Action |
| :--- | :--- |
| `1` | Select **All** Cohorts |
| `2` | Select **Knights** Only |
| `3` | Select **Archers** Only |
| `4` | Select **Barbarians** Only |
| `A` / **Advance** | Selected cohorts close in and engage target |
| `H` / **Hold Ground** | Selected cohorts hold position, engaging only enemies within range |
| `R` / **Retreat!** | Selected cohorts withdraw to safety, preserving remaining troops |

*When the game concludes, click anywhere on the canvas or click **Restart Game** to play again.*

---

## Architecture & Tech Stack

* **Rendering:** HTML5 2D `<canvas>` with custom pixel-art and condition-ring overlays.
* **Dual-Core Simulation Engine:**
  * **Primary (Rust / Wasm):** High-efficiency deterministic game loop in `crates/core`, compiled to `wasm32-unknown-unknown`.
  * **Fallback (TypeScript):** Mirror TS engine in `src/engine.ts` ensuring seamless instant boot in any environment.
* **Tooling:** Vite, TypeScript, Cargo.

---

## Getting Started

### Prerequisites
* **Node.js** (v18+) and **npm**
* *(Optional, for recompiling Wasm core)*: **Rust** (`cargo`) with target `wasm32-unknown-unknown`

### Local Development
```bash
# Install frontend dependencies
npm install

# Start the Vite development server (defaults to TypeScript engine if wasm is not rebuilt)
npm run dev
```

### Build for Production
```bash
# Build Wasm simulation binary and bundle frontend
npm run build

# Preview production build locally
npm run preview
```
The compiled output in `dist/` is static HTML/JS/WASM and can be deployed to Cloudflare Pages, GitHub Pages, Vercel, or AWS S3.
