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
const btnCombine = document.getElementById('btn-combine') as HTMLButtonElement;
const btnRendezvous = document.getElementById('btn-rendezvous') as HTMLButtonElement;
const btnDeselect = document.getElementById('btn-deselect')!;

let rendezvousMode = false;

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

  // If rendezvous mode is active and player taps another friendly squad
  if (rendezvousMode && state.selectedId && e.button === 0) {
    const hitSquad = state.squads.find(
      (s: Squad) => s.faction === 'PLAYER' && s.id !== state.selectedId && Math.hypot(s.x - pt.x, s.y - pt.y) < radius
    );
    if (hitSquad) {
      const cur = state.squads.find((s) => s.id === state.selectedId);
      if (cur) {
        cur.mergeTargetId = hitSquad.id;
        activeEngine.dispatch({
          type: 'MARCH_SQUAD',
          squadId: cur.id,
          targetX: hitSquad.x,
          targetY: hitSquad.y,
        });
      }
      rendezvousMode = false;
      btnRendezvous.classList.remove('active');
      return;
    }
  }

  const cmd = resolvePointerCommand(
    {
      x: pt.x,
      y: pt.y,
      button: e.button,
      isTouch,
      hitRadius: radius,
      targetMergeMode: rendezvousMode,
    },
    state
  );

  if (cmd) {
    if (cmd.type === 'MARCH_SQUAD') {
      renderer.addWaypointRipple(cmd.targetX, cmd.targetY);
      rendezvousMode = false;
      btnRendezvous.classList.remove('active');
    }
    activeEngine.dispatch(cmd);
  }
});

btnDeselect.addEventListener('click', () => {
  rendezvousMode = false;
  btnRendezvous.classList.remove('active');
  activeEngine.dispatch({ type: 'SELECT_SQUAD', squadId: null });
});

btnRendezvous.addEventListener('click', () => {
  rendezvousMode = !rendezvousMode;
  btnRendezvous.classList.toggle('active', rendezvousMode);
  if (rendezvousMode) {
    selectionTextEl.textContent = 'Tap ally squad to rendezvous & merge';
  }
});

btnCombine.addEventListener('click', () => {
  const state = activeEngine.getState();
  if (!state.selectedId) return;
  const cur = state.squads.find((s) => s.id === state.selectedId);
  if (!cur) return;

  const nearbyAlly = state.squads.find(
    (s) => s.faction === 'PLAYER' && s.id !== cur.id && Math.hypot(s.x - cur.x, s.y - cur.y) <= 35
  );

  if (nearbyAlly) {
    activeEngine.dispatch({
      type: 'COMBINE_SQUADS',
      sourceId: cur.id,
      targetId: nearbyAlly.id,
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

let prevBattleActive = false;
let lastBattleEndTime = 0;

document.getElementById('restart')!.addEventListener('click', () => {
  // Prevent accidental restart from rapid taps when exiting tactical battle
  if (performance.now() - lastBattleEndTime < 1000) {
    return;
  }
  const state = activeEngine.getState();
  if (state.mode !== 'GAME_OVER') {
    const ok = window.confirm('Restart game? Current battle progress will be lost.');
    if (!ok) return;
  }
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
  if (prevBattleActive && !tac) {
    lastBattleEndTime = performance.now();
  }
  prevBattleActive = tac;

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
    const vetBadge = sq?.veteran ? ' ⭐ VETERAN' : '';

    // Check if an ally is close enough to combine immediately (<= 35px)
    const nearbyAlly = sq
      ? state.squads.find(
          (s) => s.faction === 'PLAYER' && s.id !== sq.id && Math.hypot(s.x - sq.x, s.y - sq.y) <= 35
        )
      : null;

    if (nearbyAlly) {
      btnCombine.classList.remove('hidden');
      btnCombine.textContent = `⚔️ Combine with ${nearbyAlly.id} (${totalSquadUnits(nearbyAlly)} men) ⭐`;
    } else {
      btnCombine.classList.add('hidden');
    }

    if (rendezvousMode) {
      selectionTextEl.textContent = `Squad ${state.selectedId}${vetBadge}: Tap ally squad to rendezvous & merge`;
    } else if (nearbyAlly) {
      selectionTextEl.textContent = `Squad ${state.selectedId}${vetBadge} adjacent to ${nearbyAlly.id} · Tap Combine or map to march`;
    } else {
      selectionTextEl.textContent = `Squad ${state.selectedId}${vetBadge} (${men} men) selected · Tap map to march`;
    }
  } else {
    btnCombine.classList.add('hidden');
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
