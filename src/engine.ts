import {
  TerrainType,
  Faction,
  UnitType,
  Stance,
  Squad,
  TacticalCohort,
  Battle,
  GameState,
  GameCommand,
  TILE,
  COLS,
  ROWS,
  W,
  H,
  AW,
  AH,
  BASE_SPEED,
  ENGAGE_R,
  FLAG_R,
  TYPES,
  TERRAIN,
  STATS,
  MULT,
  MAP,
  CH,
} from './types';

export const totalSquadUnits = (s: Squad) => s.knights + s.archers + s.barbarians;
export const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y);
export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
export const cohortCount = (c: TacticalCohort) =>
  Math.max(0, Math.ceil(c.hp / STATS[c.type].hp - 1e-6));
export const cohortRadius = (c: TacticalCohort) => 12 + Math.sqrt(cohortCount(c)) * 3.2;
export const isCohortActive = (c: TacticalCohort) => c.hp > 0 && !c.retreated;

export function makeSquad(id: string, faction: Faction, x: number, y: number): Squad {
  return {
    id,
    faction,
    x,
    y,
    targetX: x,
    targetY: y,
    condition: 100,
    knights: 15,
    archers: 15,
    barbarians: 15,
  };
}

export function createInitialState(): GameState {
  return {
    mode: 'STRATEGIC',
    winner: null,
    grid: MAP.map((r) => r.split('').map((c) => CH[c])),
    flagPosition: { x: 425, y: 40 },
    playerFlag: { x: 425, y: 560 },
    squads: [
      ...[175, 325, 525, 675].map((x, i) => makeSquad('P' + i, 'PLAYER', x, 510)),
      ...[175, 325, 525, 675].map((x, i) => makeSquad('A' + i, 'AI', x, 90)),
    ],
    activeBattle: null,
    selectedId: null,
    aiTimer: 1,
  };
}

export class GameEngine {
  private state: GameState;

  constructor(initialState?: GameState) {
    this.state = initialState ? JSON.parse(JSON.stringify(initialState)) : createInitialState();
  }

  public getState(): Readonly<GameState> {
    return this.state;
  }

  public dispatch(command: GameCommand): void {
    switch (command.type) {
      case 'SELECT_SQUAD': {
        if (this.state.mode === 'STRATEGIC') {
          this.state.selectedId = command.squadId;
        }
        break;
      }
      case 'MARCH_SQUAD': {
        if (this.state.mode === 'STRATEGIC') {
          const squad = this.getSquadById(command.squadId);
          if (squad && squad.faction === 'PLAYER') {
            squad.targetX = clamp(command.targetX, 0, W);
            squad.targetY = clamp(command.targetY, 0, H);
          }
        }
        break;
      }
      case 'SELECT_TACTICAL': {
        if (this.state.mode === 'TACTICAL' && this.state.activeBattle) {
          this.state.activeBattle.selected = new Set(
            command.unitType === 'all' ? TYPES : [command.unitType]
          );
        }
        break;
      }
      case 'SET_TACTICAL_STANCE': {
        if (this.state.mode === 'TACTICAL' && this.state.activeBattle) {
          const b = this.state.activeBattle;
          for (const c of b.cohorts) {
            const hasType =
              b.selected instanceof Set
                ? b.selected.has(c.type)
                : (b.selected as UnitType[]).includes(c.type);
            if (
              c.faction === 'PLAYER' &&
              isCohortActive(c) &&
              (command.stance === 'RETREAT' || hasType)
            ) {
              c.stance = command.stance;
            }
          }
        }
        break;
      }
      case 'RESTART_GAME': {
        this.state = createInitialState();
        break;
      }
    }
  }

  public tick(dt: number): void {
    if (this.state.mode === 'STRATEGIC') {
      this.updateStrategic(dt);
    } else if (this.state.mode === 'TACTICAL') {
      this.updateTactical(dt);
    }
  }

  public getSquadById(id: string): Squad | undefined {
    return this.state.squads.find((s) => s.id === id);
  }

  public terrainAt(x: number, y: number): TerrainType {
    const c = clamp(Math.floor(x / TILE), 0, COLS - 1);
    const r = clamp(Math.floor(y / TILE), 0, ROWS - 1);
    return this.state.grid[r][c];
  }

  public getForts(): { x: number; y: number }[] {
    const out: { x: number; y: number }[] = [];
    this.state.grid.forEach((row, r) =>
      row.forEach((t, c) => {
        if (t === 'FORT') out.push({ x: c * TILE + 25, y: r * TILE + 25 });
      })
    );
    return out;
  }

  // ───────────────────────── Strategic Update ─────────────────────────
  private updateStrategic(dt: number): void {
    for (const s of this.state.squads) {
      const dx = s.targetX - s.x;
      const dy = s.targetY - s.y;
      const d = Math.hypot(dx, dy);
      const terr = this.terrainAt(s.x, s.y);
      const t = TERRAIN[terr];

      if (d > 1) {
        const step = Math.min(d, BASE_SPEED * t.speed * (0.6 + s.condition / 250) * dt);
        s.x += (dx / d) * step;
        s.y += (dy / d) * step;
        s.condition = Math.max(0, s.condition - 2.5 * t.drain * dt);
      } else {
        s.condition = Math.min(100, s.condition + (terr === 'FORT' ? 5 : 0.5) * dt);
      }
    }

    this.state.aiTimer -= dt;
    if (this.state.aiTimer <= 0) {
      this.aiThink();
      this.state.aiTimer = 2;
    }

    if (this.checkWin()) return;

    for (const p of this.state.squads.filter((s) => s.faction === 'PLAYER')) {
      for (const a of this.state.squads.filter((s) => s.faction === 'AI')) {
        if (dist(p, a) < ENGAGE_R) {
          this.startBattle(p, a);
          return;
        }
      }
    }
  }

  private checkWin(): boolean {
    const pl = this.state.squads.filter((s) => s.faction === 'PLAYER');
    const ai = this.state.squads.filter((s) => s.faction === 'AI');
    let w: Faction | null = null;

    if (!ai.length || pl.some((p) => dist(p, this.state.flagPosition) < FLAG_R)) {
      w = 'PLAYER';
    } else if (!pl.length || ai.some((a) => dist(a, this.state.playerFlag) < FLAG_R)) {
      w = 'AI';
    }

    if (w) {
      this.state.mode = 'GAME_OVER';
      this.state.winner = w;
      return true;
    }
    return false;
  }

  private aiThink(): void {
    const ai = this.state.squads.filter((s) => s.faction === 'AI');
    const pl = this.state.squads.filter((s) => s.faction === 'PLAYER');
    if (!ai.length || !pl.length) return;

    const order = (s: Squad, t: { x: number; y: number }) => {
      s.targetX = t.x;
      s.targetY = t.y;
    };
    const nearest = <T extends { x: number; y: number }>(from: Squad, list: T[]) =>
      list.reduce((b, c) => (dist(from, c) < dist(from, b) ? c : b));
    const busy = new Set<string>();

    // 1. Defend flag
    const threat = pl.find((p) => dist(p, this.state.flagPosition) < 150);
    if (threat) {
      const def = ai.reduce((b, c) => (dist(c, threat) < dist(b, threat) ? c : b));
      order(def, threat);
      busy.add(def.id);
    }

    for (const a of ai) {
      if (busy.has(a.id)) continue;
      const resting = this.terrainAt(a.x, a.y) === 'FORT' && a.condition < 90;
      if (a.condition < 40 || resting) {
        // 2. Rest
        const f = nearest(a, this.getForts());
        order(a, f);
        continue;
      }
      if (a.condition > 70) {
        // 3. Attack
        order(a, nearest(a, [...pl, this.state.playerFlag] as { x: number; y: number }[] as Squad[]));
      }
    }
  }

  // ───────────────────────── Tactical Arena ─────────────────────────
  private startBattle(p: Squad, a: Squad): void {
    const cohorts: TacticalCohort[] = [];
    const layout: Record<UnitType, [number, number]> = {
      knights: [210, 120],
      archers: [90, 200],
      barbarians: [210, 280],
    };

    for (const [sq, f] of [
      [p, 'PLAYER'],
      [a, 'AI'],
    ] as [Squad, Faction][]) {
      for (const t of TYPES) {
        if (sq[t] <= 0) continue;
        const [lx, ly] = layout[t];
        cohorts.push({
          faction: f,
          type: t,
          hp: sq[t] * STATS[t].hp,
          x: f === 'PLAYER' ? lx : AW - lx,
          y: ly,
          stance: 'HOLD',
          cooldown: Math.random() * 0.5,
          retreated: false,
        });
      }
    }

    this.state.activeBattle = {
      attackerId: p.id,
      defenderId: a.id,
      terrain: this.terrainAt((p.x + a.x) / 2, (p.y + a.y) / 2),
      cohorts,
      arrows: [],
      playerMountain: this.terrainAt(p.x, p.y) === 'MOUNTAIN',
      aiMountain: this.terrainAt(a.x, a.y) === 'MOUNTAIN',
      playerCond: p.condition,
      aiCond: a.condition,
      selected: new Set(TYPES),
      aiTimer: 0,
    };
    this.state.selectedId = null;
    this.state.mode = 'TACTICAL';
  }

  private dealDamage(b: Battle, att: TacticalCohort, def: TacticalCohort, base: number): void {
    const cond = att.faction === 'PLAYER' ? b.playerCond : b.aiCond;
    const condMult = 0.5 + cond / 200;
    const defBonus = (def.faction === 'PLAYER' ? b.playerMountain : b.aiMountain) ? 1.25 : 1;
    def.hp -= (base * MULT[att.type][def.type] * condMult) / defBonus;
  }

  private aiTactical(b: Battle): void {
    const sum = (f: Faction, t?: UnitType) =>
      b.cohorts
        .filter((c) => c.faction === f && isCohortActive(c) && (!t || c.type === t))
        .reduce((s, c) => s + cohortCount(c), 0);
    const aiCoh = b.cohorts.filter((c) => c.faction === 'AI' && isCohortActive(c));
    if (sum('AI') < 0.25 * sum('PLAYER')) {
      aiCoh.forEach((c) => (c.stance = 'RETREAT'));
      return;
    }
    for (const c of aiCoh) {
      if (c.stance === 'RETREAT') continue;
      c.stance =
        c.type === 'archers'
          ? sum('AI', 'archers') > sum('PLAYER', 'archers')
            ? 'HOLD'
            : 'ADVANCE'
          : 'ADVANCE';
    }
  }

  private updateTactical(dt: number): void {
    const b = this.state.activeBattle!;
    b.aiTimer -= dt;
    if (b.aiTimer <= 0) {
      this.aiTactical(b);
      b.aiTimer = 0.5;
    }

    for (const c of b.cohorts) {
      if (!isCohortActive(c)) continue;
      const st = STATS[c.type];
      if (c.stance === 'RETREAT') {
        const edgeX = c.faction === 'PLAYER' ? 0 : AW;
        c.x += Math.sign(edgeX - c.x) * st.speed * 1.2 * dt;
        if (
          (c.faction === 'PLAYER' && c.x - cohortRadius(c) <= 0) ||
          (c.faction === 'AI' && c.x + cohortRadius(c) >= AW)
        ) {
          c.retreated = true;
        }
        continue;
      }

      const foes = b.cohorts.filter((o) => o.faction !== c.faction && isCohortActive(o));
      if (!foes.length) continue;
      const tgt = foes.reduce((best, o) => (dist(c, o) < dist(c, best) ? o : best));
      const d = dist(c, tgt);
      const edge = d - cohortRadius(c) - cohortRadius(tgt);
      const reach = st.range || 4;

      if (edge <= reach) {
        if (c.type === 'archers') {
          c.cooldown -= dt;
          if (c.cooldown <= 0) {
            c.cooldown = 1;
            this.dealDamage(b, c, tgt, cohortCount(c) * st.dps);
            b.arrows.push({ x1: c.x, y1: c.y, x2: tgt.x, y2: tgt.y, t: 0 });
          }
        } else {
          this.dealDamage(b, c, tgt, cohortCount(c) * st.dps * dt);
        }
      } else if (c.stance === 'ADVANCE') {
        const step = Math.min(edge - reach + 1, st.speed * dt);
        c.x += ((tgt.x - c.x) / d) * step;
        c.y += ((tgt.y - c.y) / d) * step;
      }
      c.x = clamp(c.x, 0, AW);
      c.y = clamp(c.y, cohortRadius(c), AH - cohortRadius(c));
    }

    // Separate allied blocks so they don't stack
    for (const a of b.cohorts) {
      for (const o of b.cohorts) {
        if (a === o || a.faction !== o.faction || !isCohortActive(a) || !isCohortActive(o)) continue;
        const d = dist(a, o) || 0.01;
        const min = cohortRadius(a) + cohortRadius(o);
        if (d < min) {
          const push = (min - d) / 2;
          a.x += ((a.x - o.x) / d) * push;
          a.y += ((a.y - o.y) / d) * push;
        }
      }
    }

    b.arrows.forEach((a) => (a.t += dt * 3));
    b.arrows = b.arrows.filter((a) => a.t < 1);

    const pActive = b.cohorts.some((c) => c.faction === 'PLAYER' && isCohortActive(c));
    const aActive = b.cohorts.some((c) => c.faction === 'AI' && isCohortActive(c));
    if (!pActive || !aActive) {
      this.endBattle(b, pActive, aActive);
    }
  }

  private endBattle(b: Battle, pActive: boolean, aActive: boolean): void {
    const p = this.getSquadById(b.attackerId)!;
    const a = this.getSquadById(b.defenderId)!;

    for (const [sq, f] of [
      [p, 'PLAYER'],
      [a, 'AI'],
    ] as [Squad, Faction][]) {
      for (const t of TYPES) {
        sq[t] = b.cohorts
          .filter((c) => c.faction === f && c.type === t && c.hp > 0)
          .reduce((s, c) => s + cohortCount(c), 0);
      }
      sq.condition = Math.max(0, sq.condition - 10);
    }

    const pushBack = (loser: Squad, from: Squad) => {
      const d = dist(loser, from) || 1;
      const ux = d > 1 ? (loser.x - from.x) / d : 0;
      const uy =
        d > 1 ? (loser.y - from.y) / d : loser.faction === 'PLAYER' ? 1 : -1;
      loser.x = clamp(loser.x + ux * 60, 10, W - 10);
      loser.y = clamp(loser.y + uy * 60, 10, H - 10);
      loser.targetX = loser.x;
      loser.targetY = loser.y;
    };

    if (!pActive) pushBack(p, a);
    if (!aActive) pushBack(a, p);
    if (pActive) {
      p.targetX = p.x;
      p.targetY = p.y;
    }

    this.state.squads = this.state.squads.filter((s) => totalSquadUnits(s) > 0);
    this.state.activeBattle = null;
    this.state.mode = 'STRATEGIC';
    this.checkWin();
  }
}
