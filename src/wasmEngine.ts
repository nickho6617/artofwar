import { GameCommand, GameState } from './types';
import { createInitialState } from './engine';

interface WasmExports {
  memory: WebAssembly.Memory;
  engine_alloc: (size: number) => number;
  engine_dealloc: (ptr: number, size: number) => void;
  engine_reset: () => void;
  engine_tick: (dt: number) => void;
  engine_dispatch_json: (ptr: number, len: number) => number;
  engine_get_state_json_len: () => number;
  engine_get_state_json_ptr: () => number;
  engine_get_mode: () => number;
}

export class WasmGameEngine {
  private exports: WasmExports | null = null;
  private cachedState: GameState = createInitialState();
  private encoder = new TextEncoder();
  private decoder = new TextDecoder('utf-8');

  public async init(wasmUrl = './artofwar_core.wasm'): Promise<void> {
    const response = await fetch(wasmUrl);
    const buffer = await response.arrayBuffer();
    const result = await WebAssembly.instantiate(buffer, {
      env: {},
    });

    this.exports = result.instance.exports as unknown as WasmExports;
    this.exports.engine_reset();
    this.refreshState();
  }

  public isReady(): boolean {
    return this.exports !== null;
  }

  public getState(): Readonly<GameState> {
    return this.cachedState;
  }

  public dispatch(command: GameCommand): void {
    if (!this.exports) return;

    const jsonStr = JSON.stringify(command);
    const bytes = this.encoder.encode(jsonStr);
    const ptr = this.exports.engine_alloc(bytes.length);

    try {
      const memoryView = new Uint8Array(this.exports.memory.buffer, ptr, bytes.length);
      memoryView.set(bytes);
      this.exports.engine_dispatch_json(ptr, bytes.length);
      this.refreshState();
    } finally {
      this.exports.engine_dealloc(ptr, bytes.length);
    }
  }

  public tick(dt: number): void {
    if (!this.exports) return;
    this.exports.engine_tick(dt);
    this.refreshState();
  }

  private refreshState(): void {
    if (!this.exports) return;
    const len = this.exports.engine_get_state_json_len();
    if (len === 0) return;

    const ptr = this.exports.engine_get_state_json_ptr();
    const memoryView = new Uint8Array(this.exports.memory.buffer, ptr, len);
    const jsonStr = this.decoder.decode(memoryView);
    try {
      const parsed = JSON.parse(jsonStr) as GameState;
      // Convert selected array back to Set for UI compatibility if needed
      if (parsed.activeBattle && Array.isArray(parsed.activeBattle.selected)) {
        parsed.activeBattle.selected = new Set(parsed.activeBattle.selected);
      }
      this.cachedState = parsed;
    } catch (e) {
      console.error('Failed to parse Wasm game state JSON:', e);
    }
  }
}
