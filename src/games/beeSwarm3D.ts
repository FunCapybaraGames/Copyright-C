import { soundEngine } from '../soundEngine';
import { vfx } from '../vfxEngine';
import { BeeSaveData } from '../types';

interface Flower3D {
  x: number;
  z: number;
  y: number;
  col: 'w' | 'r' | 'b';
  p: number;
  max: number;
  rg: number;
}

interface Bee3D {
  t: 'w' | 'r' | 'b' | 'gifted';
  x: number;
  y: number;
  z: number;
  tgt?: Flower3D | null;
  ct: number;
}

interface Mob3D {
  id: string;
  type: 'beetle' | 'ladybug';
  x: number;
  z: number;
  hp: number;
  maxHp: number;
  speed: number;
}

interface Sprinkler3D {
  x: number;
  z: number;
  range: number;
  life: number;
}

export const HIVE_PLOTS_3D = [
  { id: 0, name: 'Plot 1', x: -18, z: 27, padX: -18, padZ: 23 },
  { id: 1, name: 'Plot 2', x: -6, z: 27, padX: -6, padZ: 23 },
  { id: 2, name: 'Plot 3', x: 6, z: 27, padX: 6, padZ: 23 },
  { id: 3, name: 'Plot 4', x: 18, z: 27, padX: 18, padZ: 23 },
];

export class BeeSwarmSimulator3DGame {
  private canvas!: HTMLCanvasElement;
  private onScoreUpdate!: (score: number, extra?: string) => void;

  public honey = 0;
  public total = 0;
  public bag = { w: 0, r: 0, b: 0 };
  public bagCap = 500;
  public bees: Bee3D[] = [];
  public flowers: Flower3D[] = [];
  public mobs: Mob3D[] = [];
  public sprinklers: Sprinkler3D[] = [];

  // Multiplayer Room Plot & Crew
  public myPlotId = 0;
  public otherPlayers: any[] = [];

  // 3D Player State
  public px = 0;
  public pz = 15;
  public py = 0;
  public pAngle = 0;
  public pVy = 0;
  public isGrounded = true;
  public toolSwing = 0;

  // 3D Camera
  private camX = 0;
  private camY = 6;
  private camZ = 24;

  private time = 0;
  private swingCooldown = 0;
  public isConverting = false;
  private prevE = false;
  private prevSpace = false;

  public bearDialog = false;

  public setRoomData(plotId: number, otherPlayers: any[]) {
    this.myPlotId = plotId;
    this.otherPlayers = otherPlayers;
  }

  public init(
    canvas: HTMLCanvasElement,
    onScoreUpdate: (score: number, extra?: string) => void,
    savedData?: BeeSaveData
  ) {
    this.canvas = canvas;
    this.onScoreUpdate = onScoreUpdate;
    this.time = 0;
    this.px = 0;
    this.pz = 15;
    this.py = 0;
    this.pAngle = 0;
    this.pVy = 0;
    this.isConverting = false;
    this.sprinklers = [];
    this.mobs = [];

    if (savedData) {
      this.honey = savedData.honey || 0;
      this.total = savedData.total || 0;
      this.bagCap = (savedData.bagLv || 0) > 0 ? 1200 : 500;
      this.bees = (savedData.bees || ['w', 'r', 'b']).map((t, i) => ({
        t,
        x: (i - 2) * 1.5,
        y: 2,
        z: 15,
        ct: 0,
      }));
    } else {
      this.honey = 0;
      this.total = 0;
      this.bagCap = 500;
      this.bees = [
        { t: 'w', x: -1.5, y: 2, z: 15, ct: 0 },
        { t: 'r', x: 0, y: 2, z: 15, ct: 0 },
        { t: 'b', x: 1.5, y: 2, z: 15, ct: 0 },
        { t: 'gifted', x: 0, y: 2.8, z: 15, ct: 0 },
      ];
    }

    // Generate 3D Flower Fields
    this.flowers = [];
    // Sunflower Field (white/yellow)
    for (let x = -18; x <= -6; x += 3) {
      for (let z = 0; z <= 12; z += 3) {
        this.flowers.push({ x, z, y: 0, col: 'w', p: 4, max: 4, rg: 0 });
      }
    }
    // Mushroom Field (red)
    for (let x = 6; x <= 18; x += 3) {
      for (let z = 0; z <= 12; z += 3) {
        this.flowers.push({ x, z, y: 0, col: 'r', p: 4, max: 4, rg: 0 });
      }
    }
    // Blue Flower Field (blue)
    for (let x = -8; x <= 8; x += 3) {
      for (let z = -14; z <= -4; z += 3) {
        this.flowers.push({ x, z, y: 0, col: 'b', p: 5, max: 5, rg: 0 });
      }
    }

    // 3D Hostile Mobs
    this.mobs = [
      { id: 'm1', type: 'beetle', x: 12, z: 6, hp: 30, maxHp: 30, speed: 2 },
      { id: 'm2', type: 'ladybug', x: -12, z: 6, hp: 20, maxHp: 20, speed: 2.5 },
    ];

    this.updateHUD();
  }

  private updateHUD() {
    this.onScoreUpdate(
      Math.floor(this.total),
      `3D HONEY ${Math.floor(this.honey)} · BEES ${this.bees.length}/50`
    );
  }

  public getBagUsed(): number {
    return this.bag.w + this.bag.r + this.bag.b;
  }

  public getSaveData(): BeeSaveData {
    return {
      honey: Math.floor(this.honey),
      total: Math.floor(this.total),
      bees: this.bees.map((b) => b.t),
      bagLv: this.bagCap > 500 ? 1 : 0,
      toolLv: 1,
    };
  }

  public update(dt: number, keys: Set<string>): { gameOver: boolean; won: boolean } {
    this.time += dt;
    this.swingCooldown -= dt;

    // 3D Player Steering & Walking
    let forward = 0;
    let turn = 0;

    if (keys.has('w') || keys.has('ArrowUp')) forward += 1;
    if (keys.has('s') || keys.has('ArrowDown')) forward -= 0.6;
    if (keys.has('a') || keys.has('ArrowLeft')) turn -= 1;
    if (keys.has('d') || keys.has('ArrowRight')) turn += 1;

    this.pAngle += turn * 2.8 * dt;

    const moveSpeed = 16;
    this.px += Math.sin(this.pAngle) * forward * moveSpeed * dt;
    this.pz -= Math.cos(this.pAngle) * forward * moveSpeed * dt;

    // Boundaries
    this.px = Math.max(-28, Math.min(28, this.px));
    this.pz = Math.max(-26, Math.min(30, this.pz));

    // Jump with Spacebar
    if (keys.has(' ') && this.isGrounded) {
      // If holding shift or in field, deploy 3D sprinkler
      if (this.pz < 18 && this.sprinklers.length < 2 && !this.prevSpace) {
        this.sprinklers.push({ x: this.px, z: this.pz, range: 7, life: 45 });
        soundEngine.play('sprinkler');
        vfx.addText(this.canvas.width / 2, this.canvas.height / 2, '💧 3D SPRINKLER PLACED!', '#38bdf8', 16);
      } else {
        this.pVy = 14;
        this.isGrounded = false;
        soundEngine.play('jump');
      }
    }
    this.prevSpace = keys.has(' ');

    this.pVy -= 36 * dt; // gravity
    this.py += this.pVy * dt;
    if (this.py <= 0) {
      this.py = 0;
      this.pVy = 0;
      this.isGrounded = true;
    }

    // 3D Camera Follows Behind Player
    const targetCamX = this.px - Math.sin(this.pAngle) * 9;
    const targetCamZ = this.pz + Math.cos(this.pAngle) * 9;
    this.camX += (targetCamX - this.camX) * Math.min(1, dt * 6);
    this.camZ += (targetCamZ - this.camZ) * Math.min(1, dt * 6);
    this.camY = 5 + this.py * 0.4;

    // Tool collection with swing animation
    if (this.swingCooldown <= 0) {
      this.swingCooldown = 0.35;
      let collected = 0;
      for (const f of this.flowers) {
        if (collected >= 3 || this.getBagUsed() >= this.bagCap) break;
        if (f.p <= 0) continue;
        const dist = Math.hypot(f.x - this.px, f.z - this.pz);
        if (dist < 3.8) {
          f.p -= 1;
          this.bag[f.col] += 1;
          collected++;
        }
      }
      if (collected > 0) {
        this.toolSwing = 1;
        soundEngine.play('scoop');
      }
    }
    if (this.toolSwing > 0) {
      this.toolSwing = Math.max(0, this.toolSwing - dt * 4);
    }

    // 3D Sprinklers update
    for (let i = this.sprinklers.length - 1; i >= 0; i--) {
      const sp = this.sprinklers[i];
      sp.life -= dt;
      if (sp.life <= 0) {
        this.sprinklers.splice(i, 1);
        continue;
      }
      // Speed up flower regrowth near sprinkler
      for (const f of this.flowers) {
        if (Math.hypot(f.x - sp.x, f.z - sp.z) < sp.range && f.p < f.max) {
          f.rg += dt * 2;
        }
      }
    }

    // 3D Mobs update & Bees attack
    for (const mob of this.mobs) {
      if (mob.hp <= 0) continue;
      mob.x += Math.sin(this.time * 2 + mob.hp) * mob.speed * dt;
      mob.z += Math.cos(this.time * 2 + mob.hp) * mob.speed * dt;
    }

    // 3D Bees following player and gathering / stinging mobs
    for (let i = 0; i < this.bees.length; i++) {
      const b = this.bees[i];
      // Target mob if close
      const nearMob = this.mobs.find((m) => m.hp > 0 && Math.hypot(m.x - this.px, m.z - this.pz) < 8);

      let targetX = this.px + Math.sin(this.time * 3 + i * 2) * 2.5;
      let targetZ = this.pz + Math.cos(this.time * 3 + i * 2) * 2.5;
      let targetY = 1.8 + Math.sin(this.time * 4 + i) * 0.5 + this.py;

      if (nearMob) {
        targetX = nearMob.x + Math.sin(this.time * 8 + i) * 0.8;
        targetZ = nearMob.z + Math.cos(this.time * 8 + i) * 0.8;
        targetY = 0.8 + Math.abs(Math.sin(this.time * 12)) * 0.6;

        // Deal damage
        if (Math.hypot(nearMob.x - b.x, nearMob.z - b.z) < 1.2) {
          nearMob.hp -= 20 * dt;
          if (nearMob.hp <= 0) {
            soundEngine.play('win');
            this.honey += 150;
            this.total += 150;
          }
        }
      }

      b.x += (targetX - b.x) * dt * 5;
      b.z += (targetZ - b.z) * dt * 5;
      b.y += (targetY - b.y) * dt * 5;
    }

    // Flower regrowth
    for (const f of this.flowers) {
      if (f.p < f.max) {
        f.rg += dt;
        if (f.rg > 3.2) {
          f.p++;
          f.rg = 0;
        }
      }
    }

    // 3D Hive Plot conversion
    const myPlot = HIVE_PLOTS_3D[this.myPlotId] || HIVE_PLOTS_3D[0];
    const atHive = Math.hypot(this.px - myPlot.padX, this.pz - myPlot.padZ) < 4.5;
    const isE = keys.has('e');

    // 3D Black Bear at (x: 0, z: -10)
    const atBear = Math.hypot(this.px - 0, this.pz - (-10)) < 4.5;

    if (isE && !this.prevE) {
      if (atHive && this.getBagUsed() > 0) {
        this.isConverting = !this.isConverting;
        if (this.isConverting) soundEngine.play('stage');
      } else if (atBear) {
        this.bearDialog = !this.bearDialog;
        soundEngine.play('coin');
      }
    }
    this.prevE = isE;

    // Convert honey
    if (this.isConverting) {
      if (!atHive || this.getBagUsed() <= 0) {
        this.isConverting = false;
      } else {
        const u = this.getBagUsed();
        const amt = Math.min(u, 28 * dt);
        for (const c of ['w', 'r', 'b'] as const) {
          this.bag[c] = Math.max(0, this.bag[c] - (amt * this.bag[c]) / u);
        }
        this.honey += amt;
        this.total += amt;
      }
    }

    this.updateHUD();

    return { gameOver: false, won: false };
  }

  // 3D Perspective Projection
  private project3D(x: number, y: number, z: number) {
    const W = this.canvas.width;
    const H = this.canvas.height;

    // Translate relative to camera
    const dx = x - this.camX;
    const dy = y - this.camY;
    const dz = z - this.camZ;

    // Rotate by camera angle
    const cos = Math.cos(this.pAngle);
    const sin = Math.sin(this.pAngle);

    const rx = dx * cos - dz * sin;
    const rz = dx * sin + dz * cos;
    const ry = dy;

    // Clip behind camera
    if (rz >= -0.5) return null;

    const fov = 340;
    const depth = -rz;
    const px = W / 2 + (rx * fov) / depth;
    const py = H / 2 - (ry * fov) / depth;
    const scale = fov / depth;

    return { x: px, y: py, scale, depth };
  }

  public render(ctx: CanvasRenderingContext2D) {
    const W = this.canvas.width;
    const H = this.canvas.height;

    // 3D Sky gradient
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#60a5fa');
    sky.addColorStop(0.65, '#bfdbfe');
    sky.addColorStop(1, '#86efac');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    // Sun in 3D sky
    ctx.fillStyle = '#fde047';
    ctx.beginPath();
    ctx.arc(650, 70, 36, 0, Math.PI * 2);
    ctx.fill();

    // 3D Ground Green Horizon
    ctx.fillStyle = '#4ade80';
    ctx.fillRect(0, H * 0.42, W, H * 0.58);

    // 4 3D Hive Plots across the 3D Hive Wall at z = 27
    HIVE_PLOTS_3D.forEach((plot) => {
      const isMyPlot = plot.id === this.myPlotId;
      const hiveCenter = this.project3D(plot.x, 3.5, plot.z);
      if (hiveCenter) {
        const hw = 10 * hiveCenter.scale;
        const hh = 7 * hiveCenter.scale;

        // Wooden board
        ctx.fillStyle = isMyPlot ? '#78350f' : '#451a03';
        ctx.fillRect(hiveCenter.x - hw / 2, hiveCenter.y - hh, hw, hh);
        ctx.strokeStyle = isMyPlot ? '#f59e0b' : '#92400e';
        ctx.lineWidth = Math.max(1, hiveCenter.scale * 0.2);
        ctx.strokeRect(hiveCenter.x - hw / 2, hiveCenter.y - hh, hw, hh);

        // Plot Label
        ctx.fillStyle = isMyPlot ? '#fde047' : '#d97706';
        ctx.font = `bold ${Math.max(9, Math.floor(hiveCenter.scale * 1.1))}px Manrope, system-ui`;
        ctx.textAlign = 'center';
        ctx.fillText(isMyPlot ? `★ YOU (${plot.name})` : plot.name, hiveCenter.x, hiveCenter.y - hh - 4);

        // Hive honeycomb cells
        ctx.fillStyle = '#fde047';
        for (let r = 0; r < 3; r++) {
          for (let c = 0; c < 4; c++) {
            const cx = hiveCenter.x - hw * 0.35 + c * (hw * 0.22);
            const cy = hiveCenter.y - hh * 0.75 + r * (hh * 0.28);
            ctx.beginPath();
            ctx.arc(cx, cy, hw * 0.07, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      // 3D Pad on the grass
      const padCenter = this.project3D(plot.padX, 0.05, plot.padZ);
      if (padCenter) {
        const padR = Math.max(6, 2.5 * padCenter.scale);
        ctx.fillStyle = isMyPlot ? '#f59e0b' : '#b45309';
        ctx.beginPath();
        ctx.ellipse(padCenter.x, padCenter.y, padR * 1.4, padR * 0.7, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    // 3D Black Bear NPC at (0, 0, -10)
    const bearCenter = this.project3D(0, 1.8, -10);
    if (bearCenter) {
      const bScale = Math.max(8, 2.4 * bearCenter.scale);
      // Body
      ctx.fillStyle = '#2b2118';
      ctx.beginPath();
      ctx.ellipse(bearCenter.x, bearCenter.y + bScale * 0.2, bScale * 0.8, bScale, 0, 0, Math.PI * 2);
      ctx.fill();
      // Head
      ctx.beginPath();
      ctx.arc(bearCenter.x, bearCenter.y - bScale * 0.6, bScale * 0.65, 0, Math.PI * 2);
      ctx.fill();
      // Ears
      ctx.beginPath();
      ctx.arc(bearCenter.x - bScale * 0.5, bearCenter.y - bScale * 1.1, bScale * 0.22, 0, Math.PI * 2);
      ctx.arc(bearCenter.x + bScale * 0.5, bearCenter.y - bScale * 1.1, bScale * 0.22, 0, Math.PI * 2);
      ctx.fill();
      // Snout
      ctx.fillStyle = '#d5a67b';
      ctx.beginPath();
      ctx.ellipse(bearCenter.x, bearCenter.y - bScale * 0.5, bScale * 0.35, bScale * 0.25, 0, 0, Math.PI * 2);
      ctx.fill();
      // Nameplate
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${Math.max(10, Math.floor(bearCenter.scale * 1.2))}px Manrope, system-ui`;
      ctx.textAlign = 'center';
      ctx.fillText('🐻 3D BLACK BEAR [E]', bearCenter.x, bearCenter.y - bScale * 1.4);
    }

    // 3D Sprinklers
    for (const sp of this.sprinklers) {
      const spCenter = this.project3D(sp.x, 0.2, sp.z);
      if (spCenter) {
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.arc(spCenter.x, spCenter.y, Math.max(3, 0.8 * spCenter.scale), 0, Math.PI * 2);
        ctx.fill();
        // Spray fountain arcs
        for (let a = 0; a < 6; a++) {
          const sang = this.time * 8 + a;
          const fx = spCenter.x + Math.cos(sang) * (spCenter.scale * 1.8);
          const fy = spCenter.y - Math.abs(Math.sin(sang)) * (spCenter.scale * 1.4);
          ctx.fillRect(fx, fy, 2, 2);
        }
      }
    }

    // 3D Flowers
    for (const f of this.flowers) {
      const p = this.project3D(f.x, 0.4, f.z);
      if (!p) continue;

      const size = Math.max(3, 1.2 * p.scale);

      // Stem
      ctx.strokeStyle = '#15803d';
      ctx.lineWidth = Math.max(1, p.scale * 0.2);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x, p.y + size * 2);
      ctx.stroke();

      // Flower Head
      ctx.fillStyle = f.col === 'r' ? '#ef4444' : f.col === 'b' ? '#3b82f6' : '#fef08a';
      ctx.beginPath();
      ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
      ctx.fill();
    }

    // 3D Mobs
    for (const mob of this.mobs) {
      if (mob.hp <= 0) continue;
      const mp = this.project3D(mob.x, 0.5, mob.z);
      if (!mp) continue;

      const mSize = Math.max(5, 1.5 * mp.scale);
      ctx.fillStyle = mob.type === 'beetle' ? '#6b21a8' : '#dc2626';
      ctx.beginPath();
      ctx.arc(mp.x, mp.y, mSize, 0, Math.PI * 2);
      ctx.fill();

      // 3D Health bar
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(mp.x - mSize, mp.y - mSize - 6, mSize * 2, 3);
      ctx.fillStyle = '#22c55e';
      ctx.fillRect(mp.x - mSize, mp.y - mSize - 6, (mob.hp / mob.maxHp) * mSize * 2, 3);
    }

    // Other Multiplayer 3D Players
    if (this.otherPlayers) {
      for (const op of this.otherPlayers) {
        if (op.x !== undefined && op.z !== undefined) {
          const opp = this.project3D(op.x, 0.6, op.z);
          if (opp) {
            const opSize = Math.max(6, 1.8 * opp.scale);
            ctx.fillStyle = '#8c5e3c';
            ctx.beginPath();
            ctx.ellipse(opp.x, opp.y, opSize, opSize * 0.7, 0, 0, Math.PI * 2);
            ctx.fill();

            // Nameplate
            ctx.fillStyle = 'rgba(0,0,0,0.7)';
            ctx.beginPath();
            ctx.roundRect(opp.x - 30, opp.y - opSize * 1.8, 60, 14, 4);
            ctx.fill();
            ctx.fillStyle = '#38bdf8';
            ctx.font = 'bold 8px Manrope, system-ui';
            ctx.textAlign = 'center';
            ctx.fillText(op.username || 'Crewmate', opp.x, opp.y - opSize * 1.8 + 10);
          }
        }
      }
    }

    // 3D Player Capybara in center viewport
    const pp = this.project3D(this.px, this.py + 0.6, this.pz);
    if (pp) {
      const pSize = Math.max(8, 2.2 * pp.scale);

      // Shadow on 3D ground
      const sp = this.project3D(this.px, 0.05, this.pz);
      if (sp) {
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.beginPath();
        ctx.ellipse(sp.x, sp.y, pSize * 1.2, pSize * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      // Capy body
      ctx.fillStyle = '#a9764e';
      ctx.beginPath();
      ctx.ellipse(pp.x, pp.y, pSize, pSize * 0.75, 0, 0, Math.PI * 2);
      ctx.fill();

      // Capy head
      ctx.fillStyle = '#ba895e';
      ctx.beginPath();
      ctx.arc(pp.x, pp.y - pSize * 0.5, pSize * 0.6, 0, Math.PI * 2);
      ctx.fill();

      // Yuzu orange on head
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(pp.x, pp.y - pSize * 1.1, pSize * 0.25, 0, Math.PI * 2);
      ctx.fill();

      // Honey backpack on back
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.roundRect(pp.x - pSize * 0.9, pp.y - pSize * 0.3, pSize * 0.5, pSize * 0.7, 3);
      ctx.fill();

      // Tool swing animation
      if (this.toolSwing > 0) {
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = Math.max(2, pp.scale * 0.3);
        ctx.beginPath();
        ctx.arc(pp.x + pSize * 0.8, pp.y, pSize * 0.9, -Math.PI / 4, Math.PI / 4);
        ctx.stroke();
      }

      // Honey Beam to Hive when converting
      if (this.isConverting) {
        const myPlot = HIVE_PLOTS_3D[this.myPlotId] || HIVE_PLOTS_3D[0];
        const padCenter = this.project3D(myPlot.padX, 0.2, myPlot.padZ);
        if (padCenter) {
          ctx.strokeStyle = '#f59e0b';
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.moveTo(pp.x, pp.y);
          ctx.lineTo(padCenter.x, padCenter.y);
          ctx.stroke();
        }
      }
    }

    // 3D Bees
    for (const b of this.bees) {
      const bp = this.project3D(b.x, b.y, b.z);
      if (!bp) continue;

      const bSize = Math.max(4, 0.8 * bp.scale);
      ctx.fillStyle = b.t === 'gifted' ? '#ffd700' : b.t === 'r' ? '#ef4444' : b.t === 'b' ? '#3b82f6' : '#f59e0b';
      ctx.beginPath();
      ctx.arc(bp.x, bp.y, bSize, 0, Math.PI * 2);
      ctx.fill();

      // Wings
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath();
      ctx.ellipse(bp.x - bSize * 0.6, bp.y - bSize * 0.6, bSize * 0.7, bSize * 0.4, 0, 0, Math.PI * 2);
      ctx.ellipse(bp.x + bSize * 0.6, bp.y - bSize * 0.6, bSize * 0.7, bSize * 0.4, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // 3D HUD
    this.renderHUD(ctx);
  }

  private renderHUD(ctx: CanvasRenderingContext2D) {
    const W = this.canvas.width;
    const u = this.getBagUsed();

    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.beginPath();
    ctx.roundRect(14, 14, 150, 32, 8);
    ctx.roundRect(172, 14, 120, 32, 8);
    ctx.fill();

    ctx.fillStyle = '#fde047';
    ctx.font = 'bold 13px Manrope, system-ui';
    ctx.fillText(`🍯 ${Math.floor(this.honey)}`, 24, 35);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`🐝 ${this.bees.length}/50`, 182, 35);

    // 3D Pollen Bar at bottom
    const barW = Math.min(340, W * 0.7);
    const barX = (W - barW) / 2;
    const barY = this.canvas.height - 40;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW, 20, 10);
    ctx.fill();

    const fillRatio = Math.min(1, u / this.bagCap);
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW * fillRatio, 20, 10);
    ctx.fill();

    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 11px Manrope, system-ui';
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.floor(u)} / ${this.bagCap} Pollen (WASD Move, Space Jump / Sprinkler)`, barX + barW / 2, barY + 14);
    ctx.textAlign = 'left';

    // Black Bear dialogue popup
    if (this.bearDialog) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
      ctx.beginPath();
      ctx.roundRect(W / 2 - 160, 60, 320, 90, 12);
      ctx.fill();
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2;
      ctx.strokeRect(W / 2 - 160, 60, 320, 90);

      ctx.fillStyle = '#fde047';
      ctx.font = 'bold 13px Manrope, system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('🐻 Black Bear', W / 2, 85);
      ctx.fillStyle = '#ffffff';
      ctx.font = '11px DM Sans, system-ui';
      ctx.fillText('Welcome to the 3D Meadow! Collect 3D pollen,', W / 2, 108);
      ctx.fillText('defeat beetles with your swarm, and grow your hive!', W / 2, 125);
      ctx.textAlign = 'left';
    }
  }
}
