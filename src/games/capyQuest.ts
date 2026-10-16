import { soundEngine } from '../soundEngine';
import { vfx } from '../vfxEngine';

interface Enemy {
  x: number;
  y: number;
  type: 'slime' | 'skeleton' | 'boss';
  hp: number;
  maxHp: number;
  vx: number;
  vy: number;
  radius: number;
  speed: number;
  invincibleTimer: number;
}

interface Chest {
  x: number;
  y: number;
  opened: boolean;
  loot: 'gems' | 'key' | 'heart';
}

export class CapyQuestGame {
  private canvas!: HTMLCanvasElement;
  private onScoreUpdate!: (score: number, extra?: string) => void;

  public score = 0;
  public room = 1;
  public maxRooms = 5;
  public hp = 5;
  public maxHp = 5;
  public keysCount = 0;
  public gems = 0;

  private player = {
    x: 400,
    y: 350,
    w: 28,
    h: 28,
    vx: 0,
    vy: 0,
    facing: 1, // 1 right, -1 left
    swingTimer: 0,
    rollTimer: 0,
    invincibleTimer: 0,
  };

  private enemies: Enemy[] = [];
  private chests: Chest[] = [];
  private door = { x: 400, y: 35, w: 60, h: 20, locked: true };
  private time = 0;

  public init(canvas: HTMLCanvasElement, onScoreUpdate: (score: number, extra?: string) => void) {
    this.canvas = canvas;
    this.onScoreUpdate = onScoreUpdate;
    this.score = 0;
    this.room = 1;
    this.hp = 5;
    this.keysCount = 0;
    this.gems = 0;
    this.loadRoom(1);
    this.updateHUD();
  }

  private loadRoom(roomNum: number) {
    this.room = roomNum;
    this.player.x = 400;
    this.player.y = 380;
    this.player.vx = 0;
    this.player.vy = 0;
    this.player.swingTimer = 0;
    this.player.rollTimer = 0;
    this.enemies = [];
    this.chests = [];
    this.door.locked = true;

    if (roomNum === 1) {
      // Slime Chamber
      this.enemies.push(
        { x: 300, y: 200, type: 'slime', hp: 3, maxHp: 3, vx: 0, vy: 0, radius: 16, speed: 60, invincibleTimer: 0 },
        { x: 500, y: 180, type: 'slime', hp: 3, maxHp: 3, vx: 0, vy: 0, radius: 16, speed: 60, invincibleTimer: 0 },
        { x: 400, y: 150, type: 'slime', hp: 4, maxHp: 4, vx: 0, vy: 0, radius: 18, speed: 70, invincibleTimer: 0 }
      );
      this.chests.push({ x: 120, y: 100, opened: false, loot: 'key' });
    } else if (roomNum === 2) {
      // Skeleton Crypt
      this.enemies.push(
        { x: 250, y: 180, type: 'skeleton', hp: 5, maxHp: 5, vx: 0, vy: 0, radius: 15, speed: 85, invincibleTimer: 0 },
        { x: 550, y: 200, type: 'skeleton', hp: 5, maxHp: 5, vx: 0, vy: 0, radius: 15, speed: 85, invincibleTimer: 0 }
      );
      this.chests.push(
        { x: 680, y: 100, opened: false, loot: 'heart' },
        { x: 400, y: 160, opened: false, loot: 'key' }
      );
    } else if (roomNum === 3) {
      // Dual Guard Hall
      this.enemies.push(
        { x: 220, y: 220, type: 'slime', hp: 4, maxHp: 4, vx: 0, vy: 0, radius: 16, speed: 75, invincibleTimer: 0 },
        { x: 580, y: 220, type: 'slime', hp: 4, maxHp: 4, vx: 0, vy: 0, radius: 16, speed: 75, invincibleTimer: 0 },
        { x: 400, y: 170, type: 'skeleton', hp: 6, maxHp: 6, vx: 0, vy: 0, radius: 15, speed: 90, invincibleTimer: 0 }
      );
      this.chests.push({ x: 140, y: 120, opened: false, loot: 'key' });
    } else if (roomNum === 4) {
      // Sun Golem Boss Chamber!
      this.enemies.push({
        x: 400,
        y: 180,
        type: 'boss',
        hp: 25,
        maxHp: 25,
        vx: 0,
        vy: 0,
        radius: 34,
        speed: 70,
        invincibleTimer: 0,
      });
      this.chests.push({ x: 680, y: 350, opened: false, loot: 'gems' });
    }
  }

  private updateHUD() {
    this.onScoreUpdate(
      this.score,
      `ROOM ${this.room}/${this.maxRooms} · ${'♥'.repeat(Math.max(0, this.hp))} · 🔑 ${this.keysCount}`
    );
  }

  public update(dt: number, keys: Set<string>): { gameOver: boolean; won: boolean } {
    this.time += dt;
    this.player.swingTimer -= dt;
    this.player.rollTimer -= dt;
    this.player.invincibleTimer -= dt;

    // Movement
    let dx = 0;
    let dy = 0;
    if (keys.has('a') || keys.has('ArrowLeft')) dx -= 1;
    if (keys.has('d') || keys.has('ArrowRight')) dx += 1;
    if (keys.has('w') || keys.has('ArrowUp')) dy -= 1;
    if (keys.has('s') || keys.has('ArrowDown')) dy += 1;

    if (dx !== 0) this.player.facing = dx > 0 ? 1 : -1;

    // Roll-Dash with Shift
    const isRolling = this.player.rollTimer > 0;
    const isShiftPressed = keys.has('Shift');
    if (isShiftPressed && this.player.rollTimer <= -0.4 && (dx !== 0 || dy !== 0)) {
      this.player.rollTimer = 0.25;
      this.player.invincibleTimer = 0.3;
      soundEngine.play('flip');
      vfx.burstDust(this.player.x, this.player.y + 14, 5);
    }

    const currentSpeed = isRolling ? 480 : 220;
    this.player.x += dx * currentSpeed * dt;
    this.player.y += dy * currentSpeed * dt;

    // Room boundaries
    this.player.x = Math.max(50, Math.min(this.canvas.width - 50, this.player.x));
    this.player.y = Math.max(70, Math.min(this.canvas.height - 50, this.player.y));

    // Attack Slash with Spacebar or Left Click
    if (keys.has(' ') && this.player.swingTimer <= 0) {
      this.player.swingTimer = 0.28;
      soundEngine.play('paddle');

      // Slash hitbox in front of player
      const slashX = this.player.x + this.player.facing * 26;
      const slashY = this.player.y;
      vfx.burstSparks(slashX, slashY, 6, '#ffd166');

      for (const e of this.enemies) {
        if (e.hp > 0 && Math.hypot(e.x - slashX, e.y - slashY) < e.radius + 20) {
          e.hp -= 2;
          e.invincibleTimer = 0.25;
          soundEngine.play('hit');
          vfx.burstSparks(e.x, e.y, 10, '#ef4444');
          vfx.addText(e.x, e.y - 15, '-2', '#ef4444', 16);

          // Knockback
          e.x += this.player.facing * 35;

          if (e.hp <= 0) {
            this.score += e.type === 'boss' ? 250 : 50;
            soundEngine.play('coin', { combo: true });
            vfx.burstSparks(e.x, e.y, 20, '#ffd166');
            vfx.addText(e.x, e.y, `+${e.type === 'boss' ? 250 : 50}`, '#ffd166', 18);
            this.updateHUD();
          }
        }
      }
    }

    // Update Enemies
    for (const e of this.enemies) {
      if (e.hp <= 0) continue;
      e.invincibleTimer -= dt;

      // Move toward player
      const angle = Math.atan2(this.player.y - e.y, this.player.x - e.x);
      e.x += Math.cos(angle) * e.speed * dt;
      e.y += Math.sin(angle) * e.speed * dt;

      // Enemy hit player
      if (
        Math.hypot(this.player.x - e.x, this.player.y - e.y) < e.radius + 14 &&
        this.player.invincibleTimer <= 0
      ) {
        this.hp--;
        this.player.invincibleTimer = 0.9;
        vfx.triggerShake(12, 0.3);
        soundEngine.play('hit');
        vfx.burstSparks(this.player.x, this.player.y, 12, '#ef4444');
        vfx.addText(this.player.x, this.player.y - 20, '-1 HEART', '#ef4444', 16);
        this.updateHUD();
      }
    }

    // Open chests
    for (const c of this.chests) {
      if (!c.opened && Math.hypot(this.player.x - c.x, this.player.y - c.y) < 32) {
        c.opened = true;
        soundEngine.play('win');
        vfx.burstSparks(c.x, c.y, 14, '#ffd166');

        if (c.loot === 'key') {
          this.keysCount++;
          vfx.addText(c.x, c.y - 25, 'FOUND DUNGEON KEY! 🔑', '#ffd166', 15);
        } else if (c.loot === 'heart') {
          this.hp = Math.min(this.maxHp, this.hp + 2);
          vfx.addText(c.x, c.y - 25, '+2 HEARTS! ♥', '#10b981', 15);
        } else {
          this.gems += 100;
          this.score += 100;
          vfx.addText(c.x, c.y - 25, '+100 GEMS! 💎', '#38bdf8', 15);
        }
        this.updateHUD();
      }
    }

    // Check door unlock
    const allEnemiesDefeated = this.enemies.every((e) => e.hp <= 0);
    if (allEnemiesDefeated || this.keysCount > 0) {
      this.door.locked = false;
    }

    // Exit through door to next chamber
    if (
      !this.door.locked &&
      Math.abs(this.player.x - this.door.x) < 40 &&
      this.player.y < this.door.y + 35
    ) {
      if (this.room < this.maxRooms) {
        soundEngine.play('stage');
        vfx.burstSparks(400, 200, 25, '#ffd166');
        vfx.addText(400, 200, `DUNGEON CHAMBER ${this.room + 1}!`, '#10b981', 24);
        if (this.keysCount > 0) this.keysCount--;
        this.loadRoom(this.room + 1);
        this.updateHUD();
      } else {
        vfx.burstConfetti(800, 450, 70);
        return { gameOver: false, won: true };
      }
    }

    if (this.hp <= 0) {
      return { gameOver: true, won: false };
    }

    return { gameOver: false, won: false };
  }

  public render(ctx: CanvasRenderingContext2D) {
    const W = this.canvas.width;
    const H = this.canvas.height;

    // Stone dungeon floor
    ctx.fillStyle = '#26282e';
    ctx.fillRect(0, 0, W, H);

    // Stone tile pattern
    ctx.strokeStyle = '#323640';
    ctx.lineWidth = 1.5;
    for (let x = 40; x < W - 40; x += 50) {
      for (let y = 60; y < H - 40; y += 50) {
        ctx.strokeRect(x, y, 50, 50);
      }
    }

    // Dungeon stone walls
    ctx.fillStyle = '#181a1f';
    ctx.fillRect(0, 0, W, 60);
    ctx.fillRect(0, H - 40, W, 40);
    ctx.fillRect(0, 0, 40, H);
    ctx.fillRect(W - 40, 0, 40, H);

    // Wall torch flames
    const torchGlow = Math.sin(this.time * 12) * 2;
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.arc(80, 50, 8 + torchGlow, 0, Math.PI * 2);
    ctx.arc(W - 80, 50, 8 - torchGlow, 0, Math.PI * 2);
    ctx.fill();

    // Chamber Door
    ctx.fillStyle = this.door.locked ? '#7f1d1d' : '#059669';
    ctx.fillRect(this.door.x - 30, this.door.y, this.door.w, this.door.h);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px Manrope, system-ui';
    ctx.textAlign = 'center';
    ctx.fillText(this.door.locked ? 'LOCKED' : 'ENTER ↗', this.door.x, this.door.y + 14);

    // Treasure Chests
    for (const c of this.chests) {
      ctx.fillStyle = c.opened ? '#9a7b56' : '#d97706';
      ctx.beginPath();
      ctx.roundRect(c.x - 14, c.y - 12, 28, 22, 5);
      ctx.fill();
      ctx.fillStyle = '#fef3c7';
      ctx.fillRect(c.x - 4, c.y - 3, 8, 6);
    }

    // Enemies
    for (const e of this.enemies) {
      if (e.hp <= 0) continue;

      if (e.type === 'slime') {
        const squish = Math.sin(this.time * 8 + e.x) * 2;
        ctx.fillStyle = '#22c55e';
        ctx.beginPath();
        ctx.ellipse(e.x, e.y, e.radius, e.radius - squish, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#14532d';
        ctx.fillRect(e.x - 5, e.y - 4, 3, 3);
        ctx.fillRect(e.x + 2, e.y - 4, 3, 3);
      } else if (e.type === 'skeleton') {
        ctx.fillStyle = '#e2e8f0';
        ctx.beginPath();
        ctx.arc(e.x, e.y - 4, e.radius * 0.7, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(e.x - 6, e.y + 2, 12, 12);
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(e.x - 4, e.y - 6, 2.5, 2.5);
        ctx.fillRect(e.x + 2, e.y - 6, 2.5, 2.5);
      } else if (e.type === 'boss') {
        // Sun Golem Boss
        ctx.fillStyle = '#ea580c';
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.radius * 0.7, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#7c2d12';
        ctx.font = 'bold 12px Manrope, system-ui';
        ctx.textAlign = 'center';
        ctx.fillText('SUN GOLEM', e.x, e.y + 4);
      }

      // Health bar above enemy
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(e.x - 14, e.y - e.radius - 8, 28, 4);
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(e.x - 14, e.y - e.radius - 8, (e.hp / e.maxHp) * 28, 4);
    }

    // Player Hero Capybara
    this.drawHeroCapybara(ctx);

    // Attack Slash Arc
    if (this.player.swingTimer > 0) {
      const slashX = this.player.x + this.player.facing * 28;
      ctx.strokeStyle = '#ffd166';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(
        slashX,
        this.player.y,
        22,
        this.player.facing > 0 ? -Math.PI / 3 : (2 * Math.PI) / 3,
        this.player.facing > 0 ? Math.PI / 3 : (4 * Math.PI) / 3
      );
      ctx.stroke();
    }
  }

  private drawHeroCapybara(ctx: CanvasRenderingContext2D) {
    const p = this.player;
    if (p.invincibleTimer > 0 && Math.floor(this.time * 16) % 2 === 0) return;

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.scale(p.facing, 1);

    // Roll rotation
    if (p.rollTimer > 0) {
      ctx.rotate(this.time * 25);
    }

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(0, 16, 16, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Body
    ctx.fillStyle = '#a9764e';
    ctx.beginPath();
    ctx.ellipse(0, 4, 16, 12, 0, 0, Math.PI * 2);
    ctx.fill();

    // Head
    ctx.fillStyle = '#ba895e';
    ctx.beginPath();
    ctx.arc(8, -4, 10, 0, Math.PI * 2);
    ctx.fill();

    // Hero Golden Headband
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(2, -10, 14, 4);

    // Eye
    ctx.fillStyle = '#1f231c';
    ctx.fillRect(10, -6, 2.5, 2.5);

    // Wooden Sword in hand
    ctx.fillStyle = '#d97706';
    ctx.fillRect(14, 2, 12, 4);
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(18, 0, 4, 8);

    ctx.restore();
  }
}
