import { soundEngine } from '../soundEngine';
import { vfx } from '../vfxEngine';
import { BeeSaveData, BeeQuest, BeeMob, Sprinkler } from '../types';

interface Flower {
  x: number;
  y: number;
  col: 'w' | 'r' | 'b';
  p: number;
  max: number;
  rg: number;
  claim?: Bee;
}

interface Bee {
  t: 'w' | 'r' | 'b' | 'gifted';
  x: number;
  y: number;
  tgt?: Flower | null;
  targetMob?: BeeMob | null;
  tm: number;
  ct: number;
}

const ZONES = [
  { n: 'Starting Meadow', need: 0, ymin: 0 },
  { n: '5-Bee Mountain Field', need: 5, ymin: 600 },
  { n: '10-Bee Stump Field', need: 10, ymin: 950 },
];

const FIELDS: Array<{ n: string; col: 'w' | 'r' | 'b'; x: number; y: number; rich: number }> = [
  { n: 'Sunflower Field', col: 'w', x: 350, y: 250, rich: 3 },
  { n: 'Dandelion Field', col: 'w', x: 1250, y: 250, rich: 3 },
  { n: 'Mushroom Field', col: 'r', x: 400, y: 750, rich: 4 },
  { n: 'Blue Flower Field', col: 'b', x: 1200, y: 750, rich: 4 },
  { n: 'Strawberry Field', col: 'r', x: 400, y: 1100, rich: 5 },
  { n: 'Bamboo Field', col: 'b', x: 1200, y: 1100, rich: 5 },
  { n: 'Pine Tree Forest', col: 'w', x: 800, y: 1050, rich: 6 },
];

export const BAG_CAPS = [200, 500, 1200, 3000, 7500];
export const BAG_NAMES = ['Pouch', 'Jar', 'Backpack', 'Giant Bag', 'Porcelain Dipper'];
export const BAG_PRICES = [0, 400, 1500, 5000, 15000];

export const HIVE_PLOTS = [
  { id: 0, name: 'Plot 1', x: 440, padX: 490, padY: 200 },
  { id: 1, name: 'Plot 2', x: 680, padX: 730, padY: 200 },
  { id: 2, name: 'Plot 3', x: 920, padX: 970, padY: 200 },
  { id: 3, name: 'Plot 4', x: 1160, padX: 1210, padY: 200 },
];

export const TOOLS = [
  { n: 'Scooper', r: 45, a: 1 },
  { n: 'Rake', r: 60, a: 2 },
  { n: 'Clippers', r: 75, a: 3 },
  { n: 'Magnet Staff', r: 95, a: 5 },
  { n: 'Golden Wand', r: 120, a: 8 },
];
export const TOOL_PRICES = [0, 300, 1200, 4000, 12000];

const BEAR_QUESTS: BeeQuest[] = [
  {
    id: 'q1',
    title: 'First Sweet Steps',
    description: 'Gather 100 white pollen from Sunflowers or Dandelions.',
    targetPollenType: 'w',
    targetPollenAmount: 100,
    currentPollen: 0,
    currentMobs: 0,
    rewardHoney: 300,
    completed: false,
    claimed: false,
  },
  {
    id: 'q2',
    title: 'Bug Patrol',
    description: 'Defeat 1 hostile beetle in the field & collect 200 red pollen.',
    targetPollenType: 'r',
    targetPollenAmount: 200,
    currentPollen: 0,
    targetMobs: 1,
    currentMobs: 0,
    rewardHoney: 800,
    completed: false,
    claimed: false,
  },
  {
    id: 'q3',
    title: 'Blue Bloom Bounty',
    description: 'Collect 500 blue pollen and defeat 2 field ladybugs.',
    targetPollenType: 'b',
    targetPollenAmount: 500,
    currentPollen: 0,
    targetMobs: 2,
    currentMobs: 0,
    rewardHoney: 2500,
    completed: false,
    claimed: false,
  },
  {
    id: 'q4',
    title: 'Master of the Swarm',
    description: 'Collect 1,500 pollen of any type and maintain your hive.',
    targetPollenType: 'all',
    targetPollenAmount: 1500,
    currentPollen: 0,
    currentMobs: 0,
    rewardHoney: 7000,
    completed: false,
    claimed: false,
  },
];

export class BeeSwarmGame {
  private canvas!: HTMLCanvasElement;
  private onScoreUpdate!: (score: number, extra?: string) => void;

  public x = 800;
  public y = 220;
  public facing = 1;
  public honey = 0;
  public total = 0;

  public bag = { w: 0, r: 0, b: 0 };
  public bagLv = 0;
  public toolLv = 0;

  public bees: Bee[] = [];
  public flowers: Flower[] = [];
  public mobs: BeeMob[] = [];
  public sprinklers: Sprinkler[] = [];
  public activeQuest: BeeQuest = { ...BEAR_QUESTS[0] };
  public questIndex = 0;

  public converting = false;
  public shopOpen = false;
  public bearDialogOpen = false;

  public myPlotId = 0;
  public otherPlayers: any[] = [];

  public setRoomData(plotId: number, otherPlayers: any[]) {
    this.myPlotId = plotId;
    this.otherPlayers = otherPlayers;
  }

  private time = 0;
  private swingCooldown = 0;
  private tickTimer = 0;
  private prevE = false;
  private prevSpace = false;
  private mobSpawnTimer = 0;

  public init(
    canvas: HTMLCanvasElement,
    onScoreUpdate: (score: number, extra?: string) => void,
    savedData?: BeeSaveData
  ) {
    this.canvas = canvas;
    this.onScoreUpdate = onScoreUpdate;
    this.time = 0;
    this.converting = false;
    this.shopOpen = false;
    this.bearDialogOpen = false;
    this.x = 800;
    this.y = 220;
    this.bag = { w: 0, r: 0, b: 0 };
    this.sprinklers = [];
    this.mobs = [];

    if (savedData) {
      this.honey = savedData.honey || 0;
      this.total = savedData.total || 0;
      this.bagLv = savedData.bagLv || 0;
      this.toolLv = savedData.toolLv || 0;
      this.questIndex = savedData.questStep || 0;
      this.activeQuest = {
        ...BEAR_QUESTS[Math.min(BEAR_QUESTS.length - 1, this.questIndex)],
      };
      this.bees = (savedData.bees || ['w', 'r', 'b']).map((t, i) => ({
        t,
        x: 800 + (i % 10) * 15,
        y: 200 + Math.floor(i / 10) * 15,
        tm: 0,
        ct: 0,
      }));
    } else {
      this.honey = 0;
      this.total = 0;
      this.bagLv = 0;
      this.toolLv = 0;
      this.questIndex = 0;
      this.activeQuest = { ...BEAR_QUESTS[0] };
      this.bees = [
        { t: 'w', x: 800, y: 200, tm: 0, ct: 0 },
        { t: 'r', x: 820, y: 200, tm: 0, ct: 0 },
        { t: 'b', x: 840, y: 200, tm: 0, ct: 0 },
      ];
    }

    // Generate flowers
    this.flowers = [];
    FIELDS.forEach((F, fi) => {
      for (let i = 0; i < 7; i++) {
        for (let k = 0; k < 7; k++) {
          this.flowers.push({
            x: F.x + (i - 3) * 35 + Math.sin(i * 7 + k * 3 + fi) * 8,
            y: F.y + (k - 3) * 35 + Math.cos(i * 5 + k * 11 + fi) * 8,
            col: F.col,
            p: F.rich,
            max: F.rich,
            rg: 0,
          });
        }
      }
    });

    // Initial Mobs
    this.spawnMob('beetle', 400, 750, 'Mushroom Field');
    this.spawnMob('ladybug', 1200, 750, 'Blue Flower Field');
    this.spawnMob('beetle', 800, 1050, 'Pine Tree Forest');

    this.updateHUD();
  }

  private spawnMob(type: 'beetle' | 'ladybug', x: number, y: number, field: string) {
    this.mobs.push({
      id: `mob_${Date.now()}_${Math.random()}`,
      type,
      x,
      y,
      hp: type === 'beetle' ? 20 : 15,
      maxHp: type === 'beetle' ? 20 : 15,
      radius: 16,
      speed: 25,
      field,
      isDefeated: false,
    });
  }

  public getSaveData(): BeeSaveData {
    return {
      honey: Math.floor(this.honey),
      total: Math.floor(this.total),
      bees: this.bees.map((b) => b.t),
      bagLv: this.bagLv,
      toolLv: this.toolLv,
      questStep: this.questIndex,
    };
  }

  public getBagUsed(): number {
    return this.bag.w + this.bag.r + this.bag.b;
  }

  public getEggPrice(): number {
    return Math.floor(100 * Math.pow(1.3, this.bees.length - 3));
  }

  public hatch() {
    if (this.bees.length >= 50) return;
    const r = Math.random();
    // 10% chance for a rare Gifted Bee!
    const t: 'w' | 'r' | 'b' | 'gifted' =
      r < 0.1 ? 'gifted' : r < 0.5 ? 'w' : r < 0.75 ? 'r' : 'b';

    this.bees.push({
      t,
      x: this.x,
      y: this.y,
      tm: 0,
      ct: 0,
    });

    if (t === 'gifted') {
      soundEngine.play('win');
      vfx.burstConfetti(800, 450, 70);
      vfx.addText(this.x, this.y - 35, '✨ ULTRA RARE GIFTED BEE! ✨', '#ffd700', 22);
    } else {
      soundEngine.play('hatch');
      vfx.burstSparks(this.x, this.y, 16, '#f6c42a');
      vfx.addText(this.x, this.y - 30, `HATCHED ${t.toUpperCase()} BEE! 🐝`, '#f6c42a', 18);
    }
  }

  public placeSprinkler() {
    if (this.sprinklers.length >= 3) {
      this.sprinklers.shift(); // Max 3 active sprinklers
    }
    this.sprinklers.push({
      x: this.x,
      y: this.y,
      range: 110,
      life: 60, // 60 seconds
    });
    soundEngine.play('paddle');
    vfx.burstSparks(this.x, this.y, 12, '#38bdf8');
    vfx.addText(this.x, this.y - 20, '💧 SPRINKLER PLACED!', '#38bdf8', 16);
  }

  private updateHUD() {
    this.onScoreUpdate(
      Math.floor(this.total),
      `HONEY ${Math.floor(this.honey)} · BEES ${this.bees.length}/50`
    );
  }

  public update(dt: number, keys: Set<string>): { gameOver: boolean; won: boolean } {
    this.time += dt;
    this.swingCooldown -= dt;
    this.mobSpawnTimer += dt;

    if (this.shopOpen || this.bearDialogOpen) {
      if (keys.has('Escape') || (keys.has('e') && !this.prevE)) {
        this.shopOpen = false;
        this.bearDialogOpen = false;
      }
      this.prevE = keys.has('e');
      return { gameOver: false, won: false };
    }

    // Deploy Sprinkler with Spacebar when outside Hive
    const isSpace = keys.has(' ');
    if (isSpace && !this.prevSpace && this.y > 280) {
      this.placeSprinkler();
    }
    this.prevSpace = isSpace;

    // Movement
    let dx = 0;
    let dy = 0;
    if (keys.has('a') || keys.has('ArrowLeft')) dx -= 1;
    if (keys.has('d') || keys.has('ArrowRight')) dx += 1;
    if (keys.has('w') || keys.has('ArrowUp')) dy -= 1;
    if (keys.has('s') || keys.has('ArrowDown')) dy += 1;

    const speed = 250;
    if (dx !== 0 || dy !== 0) {
      this.x = Math.max(100, Math.min(1500, this.x + dx * speed * dt));
      this.y = Math.max(50, Math.min(1350, this.y + dy * speed * dt));
      if (dx !== 0) this.facing = dx > 0 ? 1 : -1;
    }

    // Zone gating
    const zoneTier = this.bees.length >= 10 ? 2 : this.bees.length >= 5 ? 1 : 0;
    if (zoneTier < 1 && this.y > 590) this.y = 590;
    if (zoneTier < 2 && this.y > 940) this.y = 940;

    // Tool collection
    const tool = TOOLS[Math.min(TOOLS.length - 1, this.toolLv)];
    const bagCap = BAG_CAPS[Math.min(BAG_CAPS.length - 1, this.bagLv)];

    if (this.swingCooldown <= 0) {
      this.swingCooldown = 0.35;
      let collected = 0;
      for (const f of this.flowers) {
        if (collected >= 4 || this.getBagUsed() >= bagCap) break;
        if (f.p <= 0 || Math.hypot(f.x - this.x, f.y - this.y) > tool.r) continue;
        const amt = Math.min(tool.a, f.p, bagCap - this.getBagUsed());
        if (amt > 0) {
          f.p -= amt;
          this.bag[f.col] += amt;
          collected++;
          vfx.burstSparks(f.x, f.y, 2, f.col === 'r' ? '#f25c5c' : f.col === 'b' ? '#4f86f0' : '#ffd166');

          // Quest progress
          if (!this.activeQuest.completed) {
            if (this.activeQuest.targetPollenType === 'all' || this.activeQuest.targetPollenType === f.col) {
              this.activeQuest.currentPollen += amt;
              if (
                this.activeQuest.currentPollen >= this.activeQuest.targetPollenAmount &&
                this.activeQuest.currentMobs >= (this.activeQuest.targetMobs || 0)
              ) {
                this.activeQuest.completed = true;
                soundEngine.play('stage');
                vfx.addText(this.x, this.y - 40, 'QUEST COMPLETE! TALK TO BEAR', '#10b981', 18);
              }
            }
          }
        }
      }
      if (collected > 0) {
        soundEngine.play('flip');
      }
    }

    // Update Sprinklers
    for (let i = this.sprinklers.length - 1; i >= 0; i--) {
      const sp = this.sprinklers[i];
      sp.life -= dt;
      if (sp.life <= 0) {
        this.sprinklers.splice(i, 1);
        continue;
      }

      // Water spray particles
      if (Math.random() < 0.25) {
        vfx.burstSparks(sp.x + (Math.random() - 0.5) * sp.range, sp.y + (Math.random() - 0.5) * sp.range, 1, '#38bdf8');
      }

      // Double flower regen in range
      for (const f of this.flowers) {
        if (Math.hypot(f.x - sp.x, f.y - sp.y) < sp.range && f.p < f.max) {
          f.rg += dt * 1.5;
        }
      }
    }

    // Spawn Mobs periodically
    if (this.mobSpawnTimer > 18) {
      this.mobSpawnTimer = 0;
      if (this.mobs.length < 5) {
        this.spawnMob(Math.random() > 0.5 ? 'beetle' : 'ladybug', 400 + Math.random() * 800, 700 + Math.random() * 400, 'Flower Field');
      }
    }

    // Update Mobs & Bee Swarm Combat
    for (const mob of this.mobs) {
      if (mob.isDefeated) continue;

      // Wander slightly
      mob.x += Math.sin(this.time + mob.hp) * mob.speed * dt;
      mob.y += Math.cos(this.time + mob.hp) * mob.speed * dt;
    }

    // Bees AI: prioritize attacking nearby mobs or gathering flowers
    for (let i = 0; i < this.bees.length; i++) {
      const b = this.bees[i];

      // Check nearby mob to attack
      if (!b.targetMob) {
        const nearbyMob = this.mobs.find(
          (m) => !m.isDefeated && Math.hypot(m.x - this.x, m.y - this.y) < 220
        );
        if (nearbyMob) {
          b.targetMob = nearbyMob;
        }
      }

      if (b.targetMob) {
        if (b.targetMob.isDefeated || Math.hypot(b.targetMob.x - this.x, b.targetMob.y - this.y) > 350) {
          b.targetMob = null;
        } else {
          // Fly to mob and sting
          b.x += (b.targetMob.x - b.x) * dt * 6;
          b.y += (b.targetMob.y - b.y) * dt * 6;

          if (Math.hypot(b.targetMob.x - b.x, b.targetMob.y - b.y) < 18) {
            b.ct += dt;
            if (b.ct > 0.4) {
              b.ct = 0;
              const damage = b.t === 'gifted' ? 4 : 2;
              b.targetMob.hp -= damage;
              vfx.burstSparks(b.targetMob.x, b.targetMob.y, 4, '#ff6b8b');
              soundEngine.play('hit');

              if (b.targetMob.hp <= 0) {
                b.targetMob.isDefeated = true;
                this.honey += 150;
                this.total += 150;
                soundEngine.play('coin');
                vfx.burstSparks(b.targetMob.x, b.targetMob.y, 16, '#ffd166');
                vfx.addText(b.targetMob.x, b.targetMob.y - 20, '+150 HONEY!', '#ffd166', 18);

                // Quest mob progress
                if (!this.activeQuest.completed) {
                  this.activeQuest.currentMobs++;
                  if (
                    this.activeQuest.currentPollen >= this.activeQuest.targetPollenAmount &&
                    this.activeQuest.currentMobs >= (this.activeQuest.targetMobs || 0)
                  ) {
                    this.activeQuest.completed = true;
                    soundEngine.play('stage');
                    vfx.addText(this.x, this.y - 40, 'QUEST COMPLETE! TALK TO BEAR', '#10b981', 18);
                  }
                }
              }
            }
          }
          continue;
        }
      }

      // Normal Flower Gathering
      if (b.tgt && (b.tgt.p <= 0 || this.getBagUsed() >= bagCap)) {
        b.tgt.claim = undefined;
        b.tgt = null;
      }

      if (!b.tgt && (b.tm -= dt) <= 0) {
        b.tm = 0.4;
        if (this.getBagUsed() < bagCap) {
          let best: Flower | null = null;
          let bestDist = 1e9;
          for (const f of this.flowers) {
            if (f.p > 0 && !f.claim && Math.hypot(f.x - this.x, f.y - this.y) < 300) {
              const d = Math.hypot(f.x - b.x, f.y - b.y) - (f.col === b.t || b.t === 'gifted' ? 60 : 0);
              if (d < bestDist) {
                bestDist = d;
                best = f;
              }
            }
          }
          if (best) {
            b.tgt = best;
            best.claim = b;
          }
        }
      }

      let tx = this.x;
      let ty = this.y;
      if (b.tgt) {
        tx = b.tgt.x;
        ty = b.tgt.y - 12;
      } else {
        const angle = this.time * 3 + i * 1.5;
        tx = this.x + Math.cos(angle) * 45;
        ty = this.y + Math.sin(angle) * 45;
      }

      b.x += (tx - b.x) * dt * 5;
      b.y += (ty - b.y) * dt * 5;

      if (b.tgt && Math.hypot(b.tgt.x - b.x, b.tgt.y - b.y) < 20) {
        b.ct += dt;
        if (b.ct > 0.45) {
          b.ct = 0;
          const f = b.tgt;
          const boost = b.t === 'gifted' ? 3 : f.col === b.t ? 2 : 1;
          const gather = Math.min(bagCap - this.getBagUsed(), boost);
          if (gather > 0 && f.p > 0) {
            f.p -= 1;
            this.bag[f.col] += gather;
            vfx.burstSparks(b.x, b.y, 2, b.t === 'gifted' ? '#ffd700' : '#f6c42a');
          }
        }
      }
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

    // Pad, Bear & Shop interactions
    const myPlot = HIVE_PLOTS[this.myPlotId] || HIVE_PLOTS[0];
    const atHivePad = Math.hypot(this.x - myPlot.padX, this.y - myPlot.padY) < 65;
    const atShop = Math.hypot(this.x - 188, this.y - 170) < 70;
    const atBear = Math.hypot(this.x - 300, this.y - 190) < 70;

    const isE = keys.has('e');
    if (isE && !this.prevE) {
      if (atShop) {
        this.shopOpen = true;
        soundEngine.play('click');
      } else if (atBear) {
        this.bearDialogOpen = true;
        soundEngine.play('coin');
      } else if (atHivePad && this.getBagUsed() > 0) {
        this.converting = !this.converting;
        if (this.converting) {
          soundEngine.play('stage');
        }
      }
    }
    this.prevE = isE;

    // Honey conversion loop
    if (this.converting) {
      if (!atHivePad || this.getBagUsed() <= 0) {
        this.converting = false;
      } else {
        const u = this.getBagUsed();
        const amt = Math.min(u, 18 * this.bees.length * dt);
        for (const c of ['w', 'r', 'b'] as const) {
          this.bag[c] = Math.max(0, this.bag[c] - (amt * this.bag[c]) / u);
        }
        this.honey += amt;
        this.total += amt;

        this.tickTimer += dt;
        if (this.tickTimer > 0.2) {
          this.tickTimer = 0;
          soundEngine.play('honey');
          vfx.burstSparks(myPlot.padX, myPlot.padY, 4, '#f5c86d');
          vfx.addText(this.x, this.y - 30, `+${Math.floor(amt)} HONEY`, '#fbbf24', 14);
        }
      }
    }

    this.updateHUD();

    if (this.bees.length >= 50 && this.total >= 50000) {
      vfx.burstConfetti(800, 450, 60);
      return { gameOver: false, won: true };
    }

    return { gameOver: false, won: false };
  }

  public claimBearQuest() {
    if (!this.activeQuest.completed || this.activeQuest.claimed) return;
    this.activeQuest.claimed = true;
    this.honey += this.activeQuest.rewardHoney;
    this.total += this.activeQuest.rewardHoney;

    soundEngine.play('win');
    vfx.burstConfetti(800, 450, 40);
    vfx.addText(this.x, this.y - 30, `+${this.activeQuest.rewardHoney} HONEY!`, '#ffd166', 22);

    // Advance quest
    this.questIndex = Math.min(BEAR_QUESTS.length - 1, this.questIndex + 1);
    this.activeQuest = { ...BEAR_QUESTS[this.questIndex] };
  }

  public render(ctx: CanvasRenderingContext2D) {
    const W = this.canvas.width;
    const H = this.canvas.height;

    ctx.save();
    // Camera follow player
    ctx.translate(W / 2 - this.x, H / 2 - this.y);

    // Meadow floor
    ctx.fillStyle = '#65ba60';
    ctx.fillRect(0, 0, 1600, 1400);

    // Grid path accents
    ctx.fillStyle = '#5fb35a';
    for (let x = 0; x < 1600; x += 80) {
      ctx.fillRect(x, 0, 40, 1400);
    }

    // 4 Distinct Honeycomb Hive Plots across North Wall
    this.drawHivePlots(ctx);

    // Black Bear NPC
    this.drawBearNPC(ctx, 300, 190);

    // Bee Shop Building
    ctx.fillStyle = '#4a2e18';
    ctx.beginPath();
    ctx.roundRect(140, 130, 95, 75, 8);
    ctx.fill();
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.roundRect(148, 140, 79, 30, 4);
    ctx.fill();
    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 11px Manrope, system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('🛒 BEE SHOP', 188, 160);
    ctx.fillStyle = '#ffffff';
    ctx.font = '9px system-ui';
    ctx.fillText('Press [E] here', 188, 195);

    // Zone Gates
    ZONES.slice(1).forEach((Z) => {
      const unlocked = this.bees.length >= Z.need;
      ctx.fillStyle = unlocked ? 'rgba(34, 197, 94, 0.35)' : 'rgba(239, 68, 68, 0.75)';
      ctx.fillRect(80, Z.ymin - 16, 1440, 32);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 14px Manrope, system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(
        unlocked
          ? `🔓 ${Z.n} — Open for Gathering!`
          : `🔒 ${Z.n} (Requires ${Z.need} Bees · You have ${this.bees.length})`,
        800,
        Z.ymin + 6
      );
    });

    // Floral Fields Boundaries & Grounds
    FIELDS.forEach((F) => {
      ctx.fillStyle =
        F.col === 'r'
          ? 'rgba(239, 68, 68, 0.22)'
          : F.col === 'b'
          ? 'rgba(59, 130, 246, 0.22)'
          : 'rgba(253, 224, 71, 0.25)';
      ctx.beginPath();
      ctx.arc(F.x, F.y, 140, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = F.col === 'r' ? '#ef444460' : F.col === 'b' ? '#3b82f660' : '#eab30860';
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.fillStyle = '#1c3d1b';
      ctx.font = 'bold 13px Manrope, system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(F.n, F.x, F.y - 115);
    });

    // Sprinklers with rotating spray arcs
    for (const sp of this.sprinklers) {
      this.drawSprinkler(ctx, sp);
    }

    // Authentic Flower Models
    for (const f of this.flowers) {
      this.drawFlower(ctx, f);
    }

    // Hostile Mobs
    for (const mob of this.mobs) {
      if (mob.isDefeated) continue;
      this.drawMob(ctx, mob);
    }

    // Other Multiplayer Players
    if (this.otherPlayers && this.otherPlayers.length > 0) {
      for (const op of this.otherPlayers) {
        if (op.x !== undefined && op.y !== undefined) {
          this.drawOtherPlayer(ctx, op);
        }
      }
    }

    // Local Player Capybara
    this.drawBeeCapybara(ctx);

    // Honey Beam to Hive when converting
    if (this.converting) {
      const myPlot = HIVE_PLOTS[this.myPlotId] || HIVE_PLOTS[0];
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 5;
      ctx.setLineDash([8, 6]);
      ctx.beginPath();
      ctx.moveTo(this.x, this.y);
      ctx.lineTo(myPlot.padX, myPlot.padY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Golden honey sparkles along the beam
      vfx.burstSparks(
        this.x + (myPlot.padX - this.x) * Math.random(),
        this.y + (myPlot.padY - this.y) * Math.random(),
        1,
        '#fde047'
      );
    }

    // Local Player Bees
    for (const b of this.bees) {
      this.drawBee(ctx, b);
    }

    ctx.restore();
    ctx.textAlign = 'left';

    // HUD overlays
    this.drawBeeOverlayHUD(ctx);
  }

  private drawHivePlots(ctx: CanvasRenderingContext2D) {
    HIVE_PLOTS.forEach((plot) => {
      const isMyPlot = plot.id === this.myPlotId;
      const plotW = 200;
      const plotH = 120;
      const px = plot.x;
      const py = 50;

      // Wooden hive background board
      ctx.fillStyle = isMyPlot ? '#78350f' : '#451a03';
      ctx.beginPath();
      ctx.roundRect(px, py, plotW, plotH, 10);
      ctx.fill();
      ctx.strokeStyle = isMyPlot ? '#f59e0b' : '#92400e';
      ctx.lineWidth = isMyPlot ? 3 : 1.5;
      ctx.stroke();

      // Plot Name Header
      ctx.fillStyle = isMyPlot ? '#fde047' : '#d97706';
      ctx.font = 'bold 11px Manrope, system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(
        isMyPlot ? `★ YOUR HIVE (${plot.name})` : `${plot.name} · HIVE`,
        px + plotW / 2,
        py + 18
      );

      // Hexagonal Honeycomb slots (5 cols x 4 rows)
      const slotR = 9;
      for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 5; c++) {
          const cx = px + 28 + c * 36 + (r % 2 === 1 ? 16 : 0);
          const cy = py + 38 + r * 20;

          // Honeycomb cell border & fill
          ctx.fillStyle = '#b45309';
          ctx.beginPath();
          ctx.arc(cx, cy, slotR, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#f59e0b';
          ctx.lineWidth = 1;
          ctx.stroke();

          // If slot has a bee for this plot
          const beeIndex = r * 5 + c;
          if (isMyPlot && beeIndex < this.bees.length) {
            const bee = this.bees[beeIndex];
            ctx.fillStyle = bee.t === 'gifted' ? '#ffd700' : bee.t === 'r' ? '#ef4444' : bee.t === 'b' ? '#3b82f6' : '#f59e0b';
            ctx.beginPath();
            ctx.arc(cx, cy, slotR - 2.5, 0, Math.PI * 2);
            ctx.fill();

            // Bee smiley face in honeycomb cell
            ctx.fillStyle = '#111827';
            ctx.fillRect(cx - 3, cy - 2, 2, 2);
            ctx.fillRect(cx + 1, cy - 2, 2, 2);
          }
        }
      }

      // Hive Pad on grass
      ctx.fillStyle = isMyPlot ? '#b45309' : '#78350f';
      ctx.beginPath();
      ctx.ellipse(plot.padX, plot.padY, 44, 26, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = isMyPlot ? '#fbbf24' : '#d97706';
      ctx.beginPath();
      ctx.ellipse(plot.padX, plot.padY, 36, 20, 0, 0, Math.PI * 2);
      ctx.fill();

      // Pad text
      ctx.fillStyle = '#451a03';
      ctx.font = 'bold 9px Manrope, system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(isMyPlot ? 'CONVERT [E]' : 'HIVE PAD', plot.padX, plot.padY + 3);
    });
  }

  private drawFlower(ctx: CanvasRenderingContext2D, f: Flower) {
    const scale = f.p > 0 ? 0.7 + 0.3 * (f.p / f.max) : 0.35;
    ctx.save();
    ctx.translate(f.x, f.y);
    ctx.scale(scale, scale);

    if (f.col === 'w') {
      // Sunflower (yellow petals with brown center)
      ctx.fillStyle = '#fde047';
      for (let a = 0; a < 8; a++) {
        const rad = (a * Math.PI) / 4;
        ctx.beginPath();
        ctx.ellipse(Math.cos(rad) * 9, Math.sin(rad) * 9, 7, 3.5, rad, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#78350f';
      ctx.beginPath();
      ctx.arc(0, 0, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(0, 0, 3, 0, Math.PI * 2);
      ctx.fill();
    } else if (f.col === 'r') {
      // Mushroom (stem + spotted red cap)
      ctx.fillStyle = '#f1f5f9';
      ctx.fillRect(-3, 0, 6, 12);
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(0, 0, 11, Math.PI, 0);
      ctx.fill();
      // White mushroom spots
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(-5, -4, 2.5, 0, Math.PI * 2);
      ctx.arc(4, -5, 2.2, 0, Math.PI * 2);
      ctx.arc(0, -8, 2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Blue Flower (blue petals with cyan core)
      ctx.fillStyle = '#3b82f6';
      for (let a = 0; a < 5; a++) {
        const rad = (a * Math.PI * 2) / 5;
        ctx.beginPath();
        ctx.ellipse(Math.cos(rad) * 8, Math.sin(rad) * 8, 6, 4, rad, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#67e8f9';
      ctx.beginPath();
      ctx.arc(0, 0, 4.5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  private drawSprinkler(ctx: CanvasRenderingContext2D, sp: Sprinkler) {
    const angle = this.time * 6;
    // Water sprinkler range ring
    ctx.fillStyle = 'rgba(56, 189, 248, 0.15)';
    ctx.beginPath();
    ctx.arc(sp.x, sp.y, sp.range, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#38bdf840';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Animated water droplet arcs
    for (let i = 0; i < 4; i++) {
      const sprayAngle = angle + (i * Math.PI) / 2;
      const dist = 30 + (Math.sin(this.time * 12 + i) + 1) * 35;
      const wx = sp.x + Math.cos(sprayAngle) * dist;
      const wy = sp.y + Math.sin(sprayAngle) * dist;
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(wx, wy, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Sprinkler brass nozzle stand
    ctx.fillStyle = '#92400e';
    ctx.beginPath();
    ctx.arc(sp.x, sp.y, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.arc(sp.x, sp.y, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawBee(ctx: CanvasRenderingContext2D, b: Bee) {
    const isGifted = b.t === 'gifted';
    const bob = Math.sin(this.time * 6 + b.x) * 3;

    ctx.save();
    ctx.translate(b.x, b.y + bob);

    // Gifted Bee glowing golden star aura
    if (isGifted) {
      ctx.fillStyle = 'rgba(254, 240, 138, 0.35)';
      ctx.beginPath();
      ctx.arc(0, 0, 18, 0, Math.PI * 2);
      ctx.fill();

      // Sparkling mini stars
      ctx.fillStyle = '#fde047';
      const starAngle = this.time * 4;
      for (let s = 0; s < 4; s++) {
        const sa = starAngle + (s * Math.PI) / 2;
        ctx.fillRect(Math.cos(sa) * 14 - 1.5, Math.sin(sa) * 14 - 1.5, 3, 3);
      }
    }

    // Bee Body
    ctx.fillStyle = isGifted ? '#ffd700' : b.t === 'r' ? '#ef4444' : b.t === 'b' ? '#3b82f6' : '#f59e0b';
    ctx.beginPath();
    ctx.ellipse(0, 0, 11, 8.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Black Bee Stripes
    ctx.fillStyle = '#1e1b18';
    ctx.fillRect(-3, -7.5, 3, 15);
    ctx.fillRect(2, -7.5, 3, 15);

    // Bee Eye & Smile
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(6, -2, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(6.5, -2.5, 0.8, 0, Math.PI * 2);
    ctx.fill();

    // Antennae
    ctx.strokeStyle = '#1e1b18';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(7, -6);
    ctx.lineTo(10, -10);
    ctx.moveTo(4, -6);
    ctx.lineTo(6, -11);
    ctx.stroke();

    // Fluttering translucent wings
    const wingFlap = Math.sin(this.time * 35 + b.x) * 4;
    ctx.fillStyle = 'rgba(224, 242, 254, 0.85)';
    ctx.beginPath();
    ctx.ellipse(-3, -9 + wingFlap, 6.5, 3.5, Math.PI / 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(3, -9 - wingFlap, 6.5, 3.5, -Math.PI / 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  private drawOtherPlayer(ctx: CanvasRenderingContext2D, p: any) {
    ctx.save();
    ctx.translate(p.x, p.y);

    // Name tag & Plot badge
    ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
    ctx.beginPath();
    ctx.roundRect(-45, -34, 90, 18, 5);
    ctx.fill();
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 9px Manrope, system-ui';
    ctx.textAlign = 'center';
    ctx.fillText(`${p.username || 'Friend'} (P${(p.plotId || 0) + 1})`, 0, -22);

    // Capybara Body
    ctx.fillStyle = '#8c5e3c';
    ctx.beginPath();
    ctx.ellipse(0, 0, 16, 12, 0, 0, Math.PI * 2);
    ctx.fill();

    // Head
    ctx.fillStyle = '#a9764e';
    ctx.beginPath();
    ctx.arc(8, -3, 9, 0, Math.PI * 2);
    ctx.fill();

    // Small honey bag
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.roundRect(-12, -10, 8, 12, 3);
    ctx.fill();

    ctx.restore();
  }

  private drawBearNPC(ctx: CanvasRenderingContext2D, x: number, y: number) {
    const nod = Math.sin(this.time * 2) * 2;
    const wave = Math.sin(this.time * 4) * 4;
    ctx.fillStyle = '#2b2118';
    // Bear Body
    ctx.beginPath();
    ctx.ellipse(x, y + 10, 24, 28, 0, 0, Math.PI * 2);
    ctx.fill();

    // Bear Head
    ctx.beginPath();
    ctx.ellipse(x, y - 18 + nod, 20, 18, 0, 0, Math.PI * 2);
    ctx.fill();

    // Ears
    ctx.beginPath();
    ctx.arc(x - 15, y - 30 + nod, 7, 0, Math.PI * 2);
    ctx.arc(x + 15, y - 30 + nod, 7, 0, Math.PI * 2);
    ctx.fill();

    // Snout
    ctx.fillStyle = '#d5a67b';
    ctx.beginPath();
    ctx.ellipse(x, y - 14 + nod, 10, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    // Nose
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(x, y - 16 + nod, 3.5, 0, Math.PI * 2);
    ctx.fill();

    // Honeycomb Medal around Bear's Neck
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.arc(x, y + 2 + nod, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(x - 2, y + 1 + nod, 4, 3);

    // Friendly waving paw
    ctx.fillStyle = '#2b2118';
    ctx.beginPath();
    ctx.arc(x + 24, y - 4 + wave, 7, 0, Math.PI * 2);
    ctx.fill();

    // Name tag & Quest Status Balloon
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px Manrope, system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('🐻 BLACK BEAR', x, y - 44 + nod);
    if (this.activeQuest.completed) {
      ctx.fillStyle = '#10b981';
      ctx.font = 'bold 11px Manrope, system-ui';
      ctx.fillText('★ QUEST COMPLETED! Press [E] ★', x, y - 58 + nod);
    } else {
      ctx.fillStyle = '#fde047';
      ctx.font = '10px system-ui';
      ctx.fillText('Talk to Bear [E]', x, y - 58 + nod);
    }
  }

  private drawMob(ctx: CanvasRenderingContext2D, mob: BeeMob) {
    const wobble = Math.sin(this.time * 8 + mob.hp) * 2;
    const legKick = Math.sin(this.time * 18) * 3;
    ctx.save();
    ctx.translate(mob.x, mob.y + wobble);

    if (mob.type === 'beetle') {
      // 6 Segmented Beetle Legs
      ctx.strokeStyle = '#2e1065';
      ctx.lineWidth = 2.5;
      for (let s = -1; s <= 1; s++) {
        ctx.beginPath();
        ctx.moveTo(-mob.radius * 0.8, s * 6);
        ctx.lineTo(-mob.radius * 1.3, s * 8 + legKick);
        ctx.moveTo(mob.radius * 0.8, s * 6);
        ctx.lineTo(mob.radius * 1.3, s * 8 - legKick);
        ctx.stroke();
      }

      // Iridescent Dark Purple Shell
      ctx.fillStyle = '#581c87';
      ctx.beginPath();
      ctx.ellipse(0, 0, mob.radius, mob.radius * 0.85, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#7e22ce';
      ctx.beginPath();
      ctx.ellipse(0, -2, mob.radius * 0.7, mob.radius * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Front Pincers / Horn
      ctx.strokeStyle = '#3b0764';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-4, -mob.radius + 2);
      ctx.lineTo(-8, -mob.radius - 8);
      ctx.moveTo(4, -mob.radius + 2);
      ctx.lineTo(8, -mob.radius - 8);
      ctx.stroke();

      // Red Glowing Eyes
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(-6, -mob.radius * 0.5, 2.5, 2.5);
      ctx.fillRect(3.5, -mob.radius * 0.5, 2.5, 2.5);
    } else {
      // Ladybug: Glossy red dome with black spots
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 2;
      for (let s = -1; s <= 1; s++) {
        ctx.beginPath();
        ctx.moveTo(-mob.radius * 0.7, s * 6);
        ctx.lineTo(-mob.radius * 1.2, s * 7 + legKick);
        ctx.moveTo(mob.radius * 0.7, s * 6);
        ctx.lineTo(mob.radius * 1.2, s * 7 - legKick);
        ctx.stroke();
      }

      ctx.fillStyle = '#dc2626';
      ctx.beginPath();
      ctx.ellipse(0, 0, mob.radius, mob.radius * 0.85, 0, 0, Math.PI * 2);
      ctx.fill();

      // Shiny carapace split line
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -mob.radius * 0.8);
      ctx.lineTo(0, mob.radius * 0.8);
      ctx.stroke();

      // Crisp Polka dots
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(-6, -4, 2.8, 0, Math.PI * 2);
      ctx.arc(6, -4, 2.8, 0, Math.PI * 2);
      ctx.arc(-6, 5, 2.8, 0, Math.PI * 2);
      ctx.arc(6, 5, 2.8, 0, Math.PI * 2);
      ctx.fill();
    }

    // Health bar above mob
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(-18, -mob.radius - 14, 36, 5);
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(-17, -mob.radius - 13, 34, 3);
    ctx.fillStyle = '#22c55e';
    ctx.fillRect(-17, -mob.radius - 13, (mob.hp / mob.maxHp) * 34, 3);

    ctx.restore();
  }

  private drawBeeCapybara(ctx: CanvasRenderingContext2D) {
    const walkStep = Math.sin(this.time * 16) * 3;
    const bagCap = BAG_CAPS[Math.min(BAG_CAPS.length - 1, this.bagLv)];
    const bagUsed = this.getBagUsed();
    const fillRatio = Math.min(1, bagUsed / bagCap);

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.scale(this.facing, 1);

    // Visible Backpack / Jar on Capybara's Back
    const jarX = -18;
    const jarY = -14;
    const jarW = 14;
    const jarH = 22;

    // Jar glass body & fill liquid
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(jarX, jarY, jarW, jarH, 4);
    ctx.fill();
    ctx.stroke();

    // Honey liquid level inside jar
    if (fillRatio > 0) {
      const liquidH = jarH * fillRatio;
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.roundRect(jarX + 1.5, jarY + jarH - liquidH, jarW - 3, liquidH - 1.5, 2);
      ctx.fill();
    }

    // Jar straps
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(jarX + jarW, jarY + 4);
    ctx.lineTo(0, 0);
    ctx.stroke();

    // Feet
    ctx.fillStyle = '#6f4a30';
    ctx.fillRect(-10 + walkStep, 10, 6, 6);
    ctx.fillRect(6 - walkStep, 10, 6, 6);

    // Body
    ctx.fillStyle = '#a9764e';
    ctx.beginPath();
    ctx.ellipse(0, 0, 18, 14, 0, 0, Math.PI * 2);
    ctx.fill();

    // Head
    ctx.fillStyle = '#ba895e';
    ctx.beginPath();
    ctx.arc(10, -4, 11, 0, Math.PI * 2);
    ctx.fill();

    // Snout
    ctx.fillStyle = '#d5a67b';
    ctx.beginPath();
    ctx.ellipse(17, -2, 6, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Eye with sparkle
    ctx.fillStyle = '#222222';
    ctx.fillRect(13, -7, 2.5, 2.5);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(14, -8, 1, 1);

    // Yuzu orange on head
    ctx.fillStyle = '#f2a23a';
    ctx.beginPath();
    ctx.arc(8, -16, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#22c55e';
    ctx.fillRect(8, -21, 2, 4);

    // Visible Harvesting Tool in Hand
    const tool = TOOLS[Math.min(TOOLS.length - 1, this.toolLv)];
    const toolSwing = Math.sin(this.time * 12) * 0.3;

    ctx.save();
    ctx.translate(14, 2);
    ctx.rotate(toolSwing);

    // Handle
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(16, 6);
    ctx.stroke();

    // Tool head (Scooper, Rake, Clippers, Magnet, or Golden Wand)
    if (this.toolLv === 0) {
      // Scooper
      ctx.fillStyle = '#cbd5e1';
      ctx.beginPath();
      ctx.arc(18, 7, 7, 0, Math.PI);
      ctx.fill();
    } else if (this.toolLv === 1) {
      // Rake
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(16, 2);
      ctx.lineTo(16, 12);
      ctx.moveTo(16, 4);
      ctx.lineTo(22, 4);
      ctx.moveTo(16, 8);
      ctx.lineTo(22, 8);
      ctx.moveTo(16, 12);
      ctx.lineTo(22, 12);
      ctx.stroke();
    } else if (this.toolLv === 2) {
      // Clippers
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(14, 3);
      ctx.lineTo(22, 1);
      ctx.moveTo(14, 7);
      ctx.lineTo(22, 9);
      ctx.stroke();
    } else if (this.toolLv === 3) {
      // Magnet Staff
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(18, 7, 6, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Golden Wand
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.arc(18, 7, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(17, 3, 2, 8);
    }
    ctx.restore();

    ctx.restore();
  }

  private drawBeeOverlayHUD(ctx: CanvasRenderingContext2D) {
    const W = this.canvas.width;
    const bagCap = BAG_CAPS[Math.min(BAG_CAPS.length - 1, this.bagLv)];
    const u = this.getBagUsed();

    // Top left badges
    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.beginPath();
    ctx.roundRect(14, 14, 140, 32, 8);
    ctx.roundRect(162, 14, 110, 32, 8);
    ctx.fill();

    ctx.fillStyle = '#ffd166';
    ctx.font = 'bold 14px Manrope, system-ui';
    ctx.fillText(`🍯 ${Math.floor(this.honey)}`, 24, 35);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`🐝 ${this.bees.length}/50`, 172, 35);

    // Quest Tracker at Top Right
    ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
    ctx.beginPath();
    ctx.roundRect(W - 250, 14, 236, 46, 8);
    ctx.fill();

    ctx.fillStyle = '#ffd166';
    ctx.font = 'bold 11px Manrope, system-ui';
    ctx.fillText(`🐻 ${this.activeQuest.title}`, W - 240, 30);
    ctx.fillStyle = this.activeQuest.completed ? '#10b981' : '#e2e8f0';
    ctx.font = '10px system-ui';
    const questStatus = this.activeQuest.completed
      ? 'READY TO CLAIM! (Talk to Bear)'
      : `Pollen: ${Math.floor(this.activeQuest.currentPollen)}/${this.activeQuest.targetPollenAmount}${
          this.activeQuest.targetMobs ? ` · Mobs: ${this.activeQuest.currentMobs}/${this.activeQuest.targetMobs}` : ''
        }`;
    ctx.fillText(questStatus, W - 240, 48);

    // Pollen Bag Bar at bottom
    const barW = Math.min(360, W * 0.7);
    const barX = (W - barW) / 2;
    const barY = this.canvas.height - 40;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW, 22, 11);
    ctx.fill();

    // Fill segments
    let curX = barX;
    const wWidth = (this.bag.w / bagCap) * barW;
    const rWidth = (this.bag.r / bagCap) * barW;
    const bWidth = (this.bag.b / bagCap) * barW;

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW, 22, 11);
    ctx.clip();

    ctx.fillStyle = '#fffbe8';
    ctx.fillRect(curX, barY, wWidth, 22);
    curX += wWidth;

    ctx.fillStyle = '#f25c5c';
    ctx.fillRect(curX, barY, rWidth, 22);
    curX += rWidth;

    ctx.fillStyle = '#4f86f0';
    ctx.fillRect(curX, barY, bWidth, 22);
    ctx.restore();

    ctx.fillStyle = '#222222';
    ctx.font = 'bold 11px Manrope, system-ui';
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.floor(u)} / ${bagCap} Pollen (Space: Sprinkler)`, barX + barW / 2, barY + 15);
    ctx.textAlign = 'left';

    // Interactive prompt
    const atHive = Math.hypot(this.x - 800, this.y - 200) < 65;
    const atShop = Math.hypot(this.x - 670, this.y - 180) < 65;
    const atBear = Math.hypot(this.x - 920, this.y - 180) < 65;

    let promptText = '';
    if (this.converting) {
      promptText = '🍯 Making Honey... (E to cancel)';
    } else if (atBear) {
      promptText = this.activeQuest.completed ? 'E — Claim Bear Quest Reward!' : 'E — Talk to Black Bear';
    } else if (atShop) {
      promptText = 'E — Open Bee Shop';
    } else if (atHive) {
      promptText = u > 0 ? 'E — Convert Pollen to Honey' : 'Collect pollen first!';
    } else if (u >= bagCap) {
      promptText = 'Bag Full! Return to Hive Pad';
    }

    if (promptText) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
      ctx.beginPath();
      ctx.roundRect(W / 2 - 130, this.canvas.height - 76, 260, 28, 8);
      ctx.fill();

      ctx.fillStyle = '#ffd166';
      ctx.font = 'bold 12px Manrope, system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(promptText, W / 2, this.canvas.height - 58);
      ctx.textAlign = 'left';
    }
  }
}
