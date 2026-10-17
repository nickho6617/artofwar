import {
  GameState,
  Faction,
  UnitType,
  TILE,
  COLS,
  ROWS,
  W,
  H,
  AW,
  AH,
  AY,
  TERRAIN,
  STATS,
} from './types';
import {
  totalSquadUnits,
  dist,
  cohortCount,
  cohortRadius,
} from './engine';

interface WaypointRipple {
  x: number;
  y: number;
  age: number;
  maxAge: number;
}

export class GameRenderer {
  private ripples: WaypointRipple[] = [];

  public addWaypointRipple(x: number, y: number): void {
    this.ripples.push({ x, y, age: 0, maxAge: 0.5 });
  }

  public render(ctx: CanvasRenderingContext2D, state: Readonly<GameState>, dt: number = 0.016): void {
    ctx.clearRect(0, 0, W, H);
    if (state.mode === 'STRATEGIC') {
      this.drawStrategic(ctx, state, dt);
    } else if (state.mode === 'TACTICAL') {
      this.drawTactical(ctx, state);
    } else {
      this.drawGameOver(ctx, state);
    }
  }

  private drawStrategic(ctx: CanvasRenderingContext2D, state: Readonly<GameState>, dt: number = 0.016): void {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const t = state.grid[r][c];
        const x = c * TILE;
        const y = r * TILE;
        ctx.fillStyle = TERRAIN[t].color;
        ctx.fillRect(x, y, TILE, TILE);
        ctx.strokeStyle = 'rgba(0,0,0,0.08)';
        ctx.strokeRect(x, y, TILE, TILE);

        if (t === 'FOREST') {
          ctx.fillStyle = '#1f4423';
          for (const [ox, oy] of [
            [14, 16],
            [34, 14],
            [24, 32],
            [12, 38],
            [38, 36],
          ]) {
            ctx.beginPath();
            ctx.arc(x + ox, y + oy, 7, 0, Math.PI * 2);
            ctx.fill();
          }
        } else if (t === 'MOUNTAIN') {
          ctx.fillStyle = '#5f6266';
          ctx.beginPath();
          ctx.moveTo(x + 5, y + 44);
          ctx.lineTo(x + 22, y + 10);
          ctx.lineTo(x + 40, y + 44);
          ctx.fill();
          ctx.fillStyle = '#e8eaec';
          ctx.beginPath();
          ctx.moveTo(x + 16, y + 22);
          ctx.lineTo(x + 22, y + 10);
          ctx.lineTo(x + 28, y + 22);
          ctx.fill();
        } else if (t === 'FORT') {
          ctx.fillStyle = '#7a5532';
          ctx.fillRect(x + 9, y + 13, 32, 28);
          ctx.fillStyle = '#5a3d22';
          for (let i = 0; i < 4; i++) ctx.fillRect(x + 9 + i * 9, y + 7, 5, 7);
          ctx.fillStyle = '#2a1a0c';
          ctx.fillRect(x + 21, y + 28, 8, 13);
        }
      }
    }

    this.drawFlag(ctx, state.flagPosition.x, state.flagPosition.y, '#e0443a');
    this.drawFlag(ctx, state.playerFlag.x, state.playerFlag.y, '#3b8be0');

    for (const s of state.squads) {
      const sel = s.id === state.selectedId;
      const col = s.faction === 'PLAYER' ? '#3b8be0' : '#e0443a';
      const isRendezvous = !!s.mergeTargetId;

      if (s.faction === 'PLAYER' && dist(s, { x: s.targetX, y: s.targetY }) > 2) {
        ctx.setLineDash(isRendezvous ? [3, 3] : [5, 5]);
        ctx.strokeStyle = isRendezvous ? 'rgba(255, 216, 96, 0.85)' : 'rgba(255,255,255,0.6)';
        ctx.lineWidth = isRendezvous ? 2 : 1;
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(s.targetX, s.targetY);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.lineWidth = 1;

        // Waypoint destination marker
        ctx.fillStyle = '#ffd860';
        ctx.beginPath();
        ctx.arc(s.targetX, s.targetY, 3, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = 'rgba(255, 216, 96, 0.6)';
        ctx.beginPath();
        ctx.arc(s.targetX, s.targetY, 7, 0, Math.PI * 2);
        ctx.stroke();
      }

      if (sel) {
        ctx.strokeStyle = '#ffd860';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(s.x, s.y, 20, 0, Math.PI * 2);
        ctx.stroke();
        ctx.lineWidth = 1;
      }

      // Golden halo for Veteran squads
      if (s.veteran) {
        ctx.strokeStyle = '#ffd860';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(s.x, s.y, 18, 0, Math.PI * 2);
        ctx.stroke();
        ctx.lineWidth = 1;
      }

      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 6;
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(s.x, s.y, 15, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = s.veteran ? '#ffd860' : 'rgba(255,255,255,0.8)';
      ctx.lineWidth = s.veteran ? 2 : 1;
      ctx.stroke();
      ctx.lineWidth = 1;

      ctx.fillStyle = '#fff';
      ctx.font = 'bold 12px Inter';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(totalSquadUnits(s)), s.x, s.y + 1);

      // Veteran star icon above squad
      if (s.veteran) {
        ctx.font = '11px sans-serif';
        ctx.fillText('⭐', s.x, s.y - 18);
      }

      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(s.x - 16, s.y + 19, 32, 5);
      ctx.fillStyle =
        s.condition > 60 ? '#6fe06f' : s.condition > 30 ? '#e8c53a' : '#e0503a';
      ctx.fillRect(s.x - 16, s.y + 19, 32 * (s.condition / 100), 5);
    }

    // Floating shatter / capture message
    if (state.shatterMessage && state.shatterMessage.time > 0) {
      ctx.save();
      ctx.fillStyle = 'rgba(20, 15, 10, 0.9)';
      ctx.strokeStyle = '#e8c56a';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(W / 2 - 200, 16, 400, 34, 8);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#ffd860';
      ctx.font = 'bold 13px Inter';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`⚡ ${state.shatterMessage.text}`, W / 2, 33);
      ctx.restore();
    }

    // Draw & advance animated waypoint ripples
    for (let i = this.ripples.length - 1; i >= 0; i--) {
      const r = this.ripples[i];
      r.age += dt;
      if (r.age >= r.maxAge) {
        this.ripples.splice(i, 1);
        continue;
      }
      const progress = r.age / r.maxAge;
      const radius = 6 + progress * 24;
      const alpha = (1 - progress) * 0.85;
      ctx.strokeStyle = `rgba(255, 216, 96, ${alpha})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(r.x, r.y, radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = 1;
    }
  }

  private drawFlag(ctx: CanvasRenderingContext2D, x: number, y: number, col: string): void {
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(x, y + 14, 14, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#3a2a1a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x, y + 14);
    ctx.lineTo(x, y - 16);
    ctx.stroke();
    ctx.lineWidth = 1;

    const wave = Math.sin(performance.now() / 300) * 2;
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(x, y - 16);
    ctx.lineTo(x + 20, y - 10 + wave);
    ctx.lineTo(x, y - 4);
    ctx.fill();
  }

  private drawTactical(ctx: CanvasRenderingContext2D, state: Readonly<GameState>): void {
    const b = state.activeBattle!;
    const p = state.squads.find((s) => s.id === b.attackerId)!;
    const a = state.squads.find((s) => s.id === b.defenderId)!;

    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#1d150e');
    g.addColorStop(1, '#0f0b07');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#e8c56a';
    ctx.font = '800 26px Cinzel';
    ctx.fillText('BATTLE', W / 2, 34);

    ctx.font = '13px Inter';
    ctx.fillStyle = '#b9a98f';
    const bonus = b.playerMountain
      ? ' · You hold the high ground (+25% def)'
      : b.aiMountain
      ? ' · Enemy holds the high ground'
      : '';

    let statusDetail = `Terrain: ${b.terrain}${bonus}`;
    if (b.retreatBlocked) {
      statusDetail += ` · ⚔️ PINCER: ${b.retreatBlocked === 'AI' ? 'Enemy' : 'Player'} retreat is BLOCKED!`;
    } else if (b.isAmbush) {
      const timeLeft = Math.max(0, Math.ceil(6.0 - (b.elapsedTime || 0)));
      if (timeLeft > 0) {
        statusDetail += ` · ⚡ AMBUSH: ${b.ambushFaction === 'PLAYER' ? 'Enemy' : 'Player'} retreat locked (${timeLeft}s)`;
      } else {
        statusDetail += ` · ⚡ AMBUSH: Ambush shock has passed`;
      }
    }
    ctx.fillText(statusDetail, W / 2, 62);

    const sum = (f: Faction) =>
      b.cohorts.filter((c) => c.faction === f && c.hp > 0).reduce((s, c) => s + cohortCount(c), 0);
    ctx.font = 'bold 16px Inter';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#5ea6ff';
    const playerVetLabel = b.playerVeteran ? ' ⭐ VETERAN' : '';
    ctx.fillText(`BLUE ${sum('PLAYER')}  ·  cond ${Math.round(p.condition)}${playerVetLabel}`, 20, 34);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ff6a5e';
    const aiVetLabel = b.aiVeteran ? '⭐ VETERAN · ' : '';
    ctx.fillText(`${aiVetLabel}cond ${Math.round(a.condition)}  ·  ${sum('AI')} RED`, W - 20, 34);

    // Tactical arena floor
    ctx.save();
    ctx.translate(0, AY);
    const fg = ctx.createLinearGradient(0, 0, AW, 0);
    const base =
      b.terrain === 'MOUNTAIN'
        ? ['#6b6e70', '#808386']
        : b.terrain === 'FOREST'
        ? ['#2b5530', '#376a3b']
        : ['#4f7c37', '#5f8f43'];
    fg.addColorStop(0, base[0]);
    fg.addColorStop(0.5, base[1]);
    fg.addColorStop(1, base[0]);
    ctx.fillStyle = fg;
    ctx.fillRect(0, 0, AW, AH);
    ctx.fillStyle = 'rgba(59,139,224,0.15)';
    ctx.fillRect(0, 0, 8, AH);
    ctx.fillStyle = 'rgba(224,68,58,0.15)';
    ctx.fillRect(AW - 8, 0, 8, AH);

    // Pincer Wall Blockers
    if (b.retreatBlocked === 'AI') {
      ctx.fillStyle = 'rgba(224,68,58,0.4)';
      ctx.fillRect(AW - 16, 0, 16, AH);
      ctx.fillStyle = '#ff938a';
      ctx.font = 'bold 11px Cinzel';
      ctx.textAlign = 'center';
      ctx.fillText('BLOCKED', AW - 34, AH / 2);
    }
    if (b.retreatBlocked === 'PLAYER') {
      ctx.fillStyle = 'rgba(59,139,224,0.4)';
      ctx.fillRect(0, 0, 16, AH);
      ctx.fillStyle = '#79b8ff';
      ctx.font = 'bold 11px Cinzel';
      ctx.textAlign = 'center';
      ctx.fillText('BLOCKED', 34, AH / 2);
    }

    for (const ar of b.arrows) {
      const x = ar.x1 + (ar.x2 - ar.x1) * ar.t;
      const y = ar.y1 + (ar.y2 - ar.y1) * ar.t - Math.sin(ar.t * Math.PI) * 40;
      ctx.fillStyle = '#fff6d0';
      ctx.beginPath();
      ctx.arc(x, y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    for (const c of b.cohorts) {
      if (c.hp <= 0) continue;
      const r = cohortRadius(c);
      const w = r * 2;
      const h = r * 1.5;
      const isP = c.faction === 'PLAYER';

      ctx.globalAlpha = c.retreated ? 0.3 : 1;
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 8;
      ctx.fillStyle = isP ? '#3b8be0' : '#e0443a';
      ctx.beginPath();
      ctx.roundRect(c.x - w / 2, c.y - h / 2, w, h, 6);
      ctx.fill();
      ctx.shadowBlur = 0;

      const hasSelectedType =
        b.selected instanceof Set
          ? b.selected.has(c.type)
          : (b.selected as UnitType[]).includes(c.type);
      const sel = isP && hasSelectedType;
      ctx.strokeStyle = sel ? '#ffd860' : 'rgba(255,255,255,0.5)';
      ctx.lineWidth = sel ? 3 : 1;
      ctx.stroke();
      ctx.lineWidth = 1;

      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.font = 'bold 15px Cinzel';
      ctx.fillText(STATS[c.type].label, c.x, c.y - 6);
      ctx.font = 'bold 12px Inter';
      ctx.fillText(String(cohortCount(c)), c.x, c.y + 9);
      ctx.font = '10px Inter';
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.fillText(c.stance, c.x, c.y + h / 2 + 10);
      ctx.globalAlpha = 1;
    }
    ctx.restore();

    ctx.font = '12px Inter';
    ctx.fillStyle = '#9c8d75';
    ctx.textAlign = 'center';
    ctx.fillText(
      'Knights ▶ Archers  ·  Archers ▶ Barbarians  ·  Barbarians ▶ Knights   (2× / 0.5×)',
      W / 2,
      530
    );
    ctx.fillText('Retreat to the left edge to escape with survivors', W / 2, 554);
  }

  private drawGameOver(ctx: CanvasRenderingContext2D, state: Readonly<GameState>): void {
    this.drawStrategic(ctx, state);
    ctx.fillStyle = 'rgba(10,6,3,0.7)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '800 54px Cinzel';
    ctx.fillStyle = state.winner === 'PLAYER' ? '#e8c56a' : '#e0503a';
    ctx.fillText(state.winner === 'PLAYER' ? 'VICTORY' : 'DEFEAT', W / 2, H / 2 - 20);
    ctx.font = '16px Inter';
    ctx.fillStyle = '#d8ccb6';
    ctx.fillText(
      state.winner === 'PLAYER'
        ? '“The supreme art of war is to subdue the enemy without fighting.”'
        : 'Your banner has fallen. Click to try again.',
      W / 2,
      H / 2 + 30
    );
  }
}
