import './style.css';
import { UnitType, Stance, Squad, GameCommand, GameState } from './types';
import { GameEngine, totalSquadUnits } from './engine';
import { WasmGameEngine } from './wasmEngine';
import { GameRenderer } from './renderer';
import { domToCanvasCoords, getHitRadius, resolvePointerCommand } from './input';

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
const selectionIndicatorEl = document.getElementById('selection-indicator')!;
const selectionTextEl = document.getElementById('selection-text')!;
const helpInstructionsEl = document.getElementById('help-instructions')!;
const btnDeselect = document.getElementById('btn-deselect')!;

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
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

canvas.addEventListener('pointerdown', (e: PointerEvent) => {
  const state = activeEngine.getState();
  const rect = canvas.getBoundingClientRect();
  const pt = domToCanvasCoords(e.clientX, e.clientY, rect);
  const isTouch = e.pointerType === 'touch' || e.pointerType === 'pen';
  const radius = getHitRadius(rect.width, isTouch);

  const cmd = resolvePointerCommand(
    {
      x: pt.x,
      y: pt.y,
      button: e.button,
      isTouch,
      hitRadius: radius,
    },
    state
  );

  if (cmd) {
    if (cmd.type === 'MARCH_SQUAD') {
      renderer.addWaypointRipple(cmd.targetX, cmd.targetY);
    }
    activeEngine.dispatch(cmd);
  }
});

btnDeselect.addEventListener('click', () => {
  activeEngine.dispatch({ type: 'SELECT_SQUAD', squadId: null });
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

  const hasSelection = state.mode === 'STRATEGIC' && !!state.selectedId;
  selectionIndicatorEl.classList.toggle('hidden', !hasSelection);
  helpInstructionsEl.classList.toggle('hidden', hasSelection);

  if (hasSelection) {
    const sq = state.squads.find((s) => s.id === state.selectedId);
    const men = sq ? totalSquadUnits(sq) : 0;
    selectionTextEl.textContent = `Squad ${state.selectedId} (${men} men) selected · Tap map to march`;
  }

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
  renderer.render(ctx, activeEngine.getState(), dt);
  updateHud();

  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
