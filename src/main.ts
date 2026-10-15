import './style.css';
import { UnitType, Stance, Squad, W, H, GameCommand, GameState } from './types';
import { GameEngine, totalSquadUnits, dist, clamp } from './engine';
import { WasmGameEngine } from './wasmEngine';
import { GameRenderer } from './renderer';

interface IGameEngine {
  getState(): Readonly<GameState>;
  dispatch(command: GameCommand): void;
  tick(dt: number): void;
}

const canvas = document.getElementById('game') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;

let activeEngine: IGameEngine = new GameEngine();
const wasmEngine = new WasmGameEngine();
const renderer = new GameRenderer();

const statusTextEl = document.getElementById('status-text')!;
const engineBadgeEl = document.getElementById('engine-badge')!;
const tacPanel = document.getElementById('tactical-panel')!;
const helpPanel = document.getElementById('strategic-help')!;

// ───────────────────────── Wasm Initialization ─────────────────────────
async function bootstrapEngine() {
  try {
    await wasmEngine.init();
    activeEngine = wasmEngine;
    engineBadgeEl.textContent = 'Rust / WebAssembly Engine';
    engineBadgeEl.style.color = '#ffd860';
    engineBadgeEl.style.borderColor = 'rgba(255, 216, 96, 0.5)';
  } catch (err) {
    console.warn('WebAssembly engine failed to load, falling back to TypeScript engine:', err);
    engineBadgeEl.textContent = 'TypeScript Engine';
    engineBadgeEl.style.color = '#8fa3b8';
  }
}

bootstrapEngine();

// ───────────────────────── Input & Command Dispatch ─────────────────────────
function toCanvas(e: MouseEvent): { x: number; y: number } {
  const r = canvas.getBoundingClientRect();
  return {
    x: ((e.clientX - r.left) / r.width) * W,
    y: ((e.clientY - r.top) / r.height) * H,
  };
}

canvas.addEventListener('contextmenu', (e) => e.preventDefault());

canvas.addEventListener('mousedown', (e) => {
  const state = activeEngine.getState();
  if (state.mode === 'GAME_OVER') {
    activeEngine.dispatch({ type: 'RESTART_GAME' });
    return;
  }
  if (state.mode !== 'STRATEGIC') return;

  const pt = toCanvas(e);
  if (e.button === 0) {
    const hit = state.squads.find((s) => s.faction === 'PLAYER' && dist(s, pt) < 18);
    activeEngine.dispatch({ type: 'SELECT_SQUAD', squadId: hit ? hit.id : null });
  } else if (e.button === 2 && state.selectedId) {
    activeEngine.dispatch({
      type: 'MARCH_SQUAD',
      squadId: state.selectedId,
      targetX: clamp(pt.x, 0, W),
      targetY: clamp(pt.y, 0, H),
    });
  }
});

function selectUnit(which: 'all' | UnitType) {
  activeEngine.dispatch({ type: 'SELECT_TACTICAL', unitType: which });
}

function orderStance(st: Stance) {
  activeEngine.dispatch({ type: 'SET_TACTICAL_STANCE', stance: st });
}

document.querySelectorAll<HTMLButtonElement>('[data-sel]').forEach((btn) =>
  btn.addEventListener('click', () => selectUnit(btn.dataset.sel as 'all' | UnitType))
);

document.getElementById('cmd-advance')!.addEventListener('click', () => orderStance('ADVANCE'));
document.getElementById('cmd-hold')!.addEventListener('click', () => orderStance('HOLD'));
document.getElementById('cmd-retreat')!.addEventListener('click', () => orderStance('RETREAT'));
document.getElementById('restart')!.addEventListener('click', () => {
  activeEngine.dispatch({ type: 'RESTART_GAME' });
});

window.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  const map: Record<string, () => void> = {
    '1': () => selectUnit('all'),
    '2': () => selectUnit('knights'),
    '3': () => selectUnit('archers'),
    '4': () => selectUnit('barbarians'),
    a: () => orderStance('ADVANCE'),
    h: () => orderStance('HOLD'),
    r: () => orderStance('RETREAT'),
  };
  map[k]?.();
});

// ───────────────────────── HUD Updates ─────────────────────────
function updateHud() {
  const state = activeEngine.getState();
  const tac = state.mode === 'TACTICAL';
  tacPanel.classList.toggle('hidden', !tac);
  helpPanel.classList.toggle('hidden', tac);

  const pl = state.squads.filter((s) => s.faction === 'PLAYER');
  const ai = state.squads.filter((s) => s.faction === 'AI');
  const sumAll = (l: Squad[]) => l.reduce((s, q) => s + totalSquadUnits(q), 0);

  statusTextEl.textContent =
    state.mode === 'GAME_OVER'
      ? `Game over — ${state.winner === 'PLAYER' ? 'Victory' : 'Defeat'}`
      : `Blue: ${pl.length} squads / ${sumAll(pl)} men   ·   Red: ${ai.length} squads / ${sumAll(ai)} men`;

  if (tac && state.activeBattle) {
    const sel = state.activeBattle.selected;
    const isSelected = (unit: string): boolean => {
      if (unit === 'all') {
        return sel instanceof Set ? sel.size === 3 : sel.length === 3;
      }
      return sel instanceof Set
        ? sel.size === 1 && sel.has(unit as UnitType)
        : sel.length === 1 && sel.includes(unit as UnitType);
    };

    document.querySelectorAll<HTMLButtonElement>('[data-sel]').forEach((btn) => {
      const v = btn.dataset.sel!;
      btn.classList.toggle('active', isSelected(v));
    });
  }
}

// ───────────────────────── Main Loop ─────────────────────────
let last = performance.now();
function frame(now: number) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  activeEngine.tick(dt);
  renderer.render(ctx, activeEngine.getState());
  updateHud();

  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
