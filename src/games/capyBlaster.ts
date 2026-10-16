import { soundEngine } from '../soundEngine';
import { vfx } from '../vfxEngine';

interface Bullet {
  x: number;
  y: number;
}

interface EnemyBullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface BugEnemy {
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  speed: number;
  fireCooldown: number;
  phase: number;
  isBoss?: boolean;
}

export class CapyBlasterGame {
  private canvas!: HTMLCanvasElement;
  private onScoreUpdate!: (score: number, extra?: string) => void;

  public score = 0;
  public wave = 1;
  public hp = 5;
  public otherPlayers: any[] = [];

  public setRoomData(players: any[]) {
    this.otherPlayers = players;
  }

  public getPlayerState() {
    return { x: this.player.x, y: this.player.y };
  }

  private player = {
    x: 400,
    y: 390,
    w: 36,
    h: 36,
    invincibleTimer: 0,
    fireCooldown: 0,
  };

  private bullets: Bullet[] = [];
  private enemyBullets: EnemyBullet[] = [];
  private enemies: BugEnemy[] = [];
  private stars: Array<[number, number, number]> = [];
  private spawnTimer = 0;
  private time = 0;
  private kills = 0;

  public init(canvas: HTMLCanvasElement, onScoreUpdate: (score: number, extra?: string) => void) {
    this.canvas = canvas;
    this.onScoreUpdate = onScoreUpdate;
    this.score = 0;
    this.wave = 1;
    this.hp = 5;
    this.kills = 0;
    this.player.x = 400;
    this.player.y = 390;
    this.player.invincibleTimer = 0;
    this.player.fireCooldown = 0;
    this.bullets = [];
    this.enemyBullets = [];
    this.enemies = [];

    this.stars = Array.from({ length: 65 }, () => [
      Math.random() * canvas.width,
      Math.random() * canvas.height,
      0.4 + Math.random() * 1.6,
    ]);

    this.updateHUD();
  }

  private updateHUD() {
    this.onScoreUpdate(
      this.score,
      `WAVE ${this.wave}/10 · ${'♥'.repeat(Math.max(0, this.hp))}`
    );
  }

  public update(dt: number, keys: Set<string>): { gameOver: boolean; won: boolean } {
    this.time += dt;
    this.player.invincibleTimer -= dt;
    this.player.fireCooldown -= dt;
    this.spawnTimer -= dt;

    // Movement
    let dx = 0;
    let dy = 0;
    if (keys.has('a') || keys.has('ArrowLeft')) dx -= 1;
    if (keys.has('d') || keys.has('ArrowRight')) dx += 1;
    if (keys.has('w') || keys.has('ArrowUp')) dy -= 1;
    if (keys.has('s') || keys.has('ArrowDown')) dy += 1;

    const speed = 340;
    this.player.x = Math.max(20, Math.min(this.canvas.width - 20, this.player.x + dx * speed * dt));
    this.player.y = Math.max(180, Math.min(this.canvas.height - 30, this.player.y + dy * speed * dt));

    // Player Shooting (hold Space)
    if (keys.has(' ') && this.player.fireCooldown <= 0) {
      this.player.fireCooldown = 0.16;
      // Twin blasters
      this.bullets.push({ x: this.player.x - 10, y: this.player.y - 18 });
      this.bullets.push({ x: this.player.x + 10, y: this.player.y - 18 });
      soundEngine.play('laser');
      vfx.burstSparks(this.player.x, this.player.y - 20, 2, '#80f1e2');
    }

    // Spawn enemy bugs
    if (this.spawnTimer <= 0) {
      const spawnInterval = Math.max(0.35, 1.1 - this.wave * 0.08);
      this.spawnTimer = spawnInterval;

      const isArmored = this.wave >= 4 && Math.random() < 0.35;
      const hp = isArmored ? 3 : 1;
      this.enemies.push({
        x: 40 + Math.random() * (this.canvas.width - 80),
        y: -30,
        hp,
        maxHp: hp,
        speed: 70 + this.wave * 14 + Math.random() * 30,
        fireCooldown: 1.5 + Math.random() * 2.0,
        phase: Math.random() * Math.PI * 2,
      });
    }

    // Update player bullets
    for (const b of this.bullets) {
      b.y -= 640 * dt;
    }

    // Update enemies
    for (const e of this.enemies) {
      e.y += e.speed * dt;
      e.x += Math.sin(this.time * 2.5 + e.phase) * 75 * dt;
      e.fireCooldown -= dt;

      // Enemy shoot
      if (this.wave >= 2 && e.fireCooldown <= 0 && e.y > 40 && e.y < 320) {
        e.fireCooldown = 2.2 - Math.min(1.0, this.wave * 0.1);
        const angle = Math.atan2(this.player.y - e.y, this.player.x - e.x);
        const bulletSpeed = 160 + this.wave * 14;
        this.enemyBullets.push({
          x: e.x,
          y: e.y + 12,
          vx: Math.cos(angle) * bulletSpeed,
          vy: Math.sin(angle) * bulletSpeed,
        });
      }

      // Check collision with player
      if (Math.hypot(e.x - this.player.x, e.y - this.player.y) < 26) {
        e.hp = 0;
        this.damagePlayer();
      }

      // Check bullet hits
      for (const b of this.bullets) {
        if (Math.hypot(b.x - e.x, b.y - e.y) < 22 && e.hp > 0) {
          e.hp -= 1;
          b.y = -999; // destroy bullet
          vfx.burstSparks(e.x, e.y, 4, '#ffd166');

          if (e.hp <= 0) {
            this.kills++;
            this.score += 10 * this.wave;
            soundEngine.play('explosion');
            vfx.triggerShake(5, 0.15);
            vfx.burstSparks(e.x, e.y, 14, '#ff6b8b');
            vfx.addText(e.x, e.y, `+${10 * this.wave}`, '#ffd166', 15);

            // Wave progression every 10 kills
            const newWave = Math.min(10, 1 + Math.floor(this.kills / 10));
            if (newWave !== this.wave) {
              this.wave = newWave;
              soundEngine.play('stage');
              vfx.burstShockwave(400, 225, '#7ef0df');
              vfx.addText(400, 180, `WAVE ${this.wave}!`, '#7ef0df', 26);
            }
            this.updateHUD();
          }
        }
      }
    }

    // Update enemy bullets
    for (const eb of this.enemyBullets) {
      eb.x += eb.vx * dt;
      eb.y += eb.vy * dt;

      if (Math.hypot(eb.x - this.player.x, eb.y - this.player.y) < 18) {
        eb.y = 9999; // destroy
        this.damagePlayer();
      }
    }

    // Clean up offscreen
    this.bullets = this.bullets.filter((b) => b.y > -30);
    this.enemies = this.enemies.filter((e) => e.hp > 0 && e.y < this.canvas.height + 40);
    this.enemyBullets = this.enemyBullets.filter(
      (eb) => eb.y > -20 && eb.y < this.canvas.height + 20 && eb.x > -20 && eb.x < this.canvas.width + 20
    );

    if (this.hp <= 0) {
      return { gameOver: true, won: false };
    }

    if (this.wave >= 10 && this.kills >= 100) {
      vfx.burstConfetti(800, 450, 70);
      return { gameOver: false, won: true };
    }

    return { gameOver: false, won: false };
  }

  private damagePlayer() {
    if (this.player.invincibleTimer > 0) return;
    this.hp--;
    this.player.invincibleTimer = 1.2;
    vfx.triggerShake(14, 0.35);
    soundEngine.play('hit');
    vfx.burstSparks(this.player.x, this.player.y, 16, '#ff6b8b');
    vfx.addText(this.player.x, this.player.y - 20, '-1 SHIELD', '#ef4444', 16);
    this.updateHUD();
  }

  public render(ctx: CanvasRenderingContext2D) {
    const W = this.canvas.width;
    const H = this.canvas.height;

    // Deep space gradient
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#0c0f2b');
    bg.addColorStop(1, '#241a4a');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Starfield
    ctx.fillStyle = '#ffffff';
    for (const s of this.stars) {
      s[1] = (s[1] + s[2] * 2.8) % H;
      ctx.globalAlpha = 0.4 + s[2] * 0.4;
      ctx.fillRect(s[0], s[1], 1.6, 1.6 + s[2]);
    }
    ctx.globalAlpha = 1;

    // Header
    ctx.fillStyle = '#e3dcff';
    ctx.font = 'bold 16px Manrope, system-ui';
    ctx.fillText('CAPY BLASTER', 28, 38);
    ctx.font = '12px system-ui';
    ctx.fillStyle = '#b5b5dc';
    ctx.fillText(`Wave ${this.wave} of 10 · Hold Space to fire plasma cannons`, 28, 56);

    // Enemy bugs
    ctx.font = '28px system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const e of this.enemies) {
      ctx.fillText(e.hp > 1 ? '👹' : '👾', e.x, e.y);

      // Mini health bar for armored bugs
      if (e.maxHp > 1) {
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(e.x - 14, e.y - 22, 28, 4);
        ctx.fillStyle = '#10b981';
        ctx.fillRect(e.x - 14, e.y - 22, (e.hp / e.maxHp) * 28, 4);
      }
    }
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';

    // Enemy plasma bullets (red/pink glowing orbs)
    if (vfx.enabled) {
      ctx.shadowColor = '#ff6b8b';
      ctx.shadowBlur = 10;
    }
    ctx.fillStyle = '#ff6b8b';
    for (const eb of this.enemyBullets) {
      ctx.beginPath();
      ctx.arc(eb.x, eb.y, 4.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;

    // Player twin blasters (cyan glowing laser beams)
    if (vfx.enabled) {
      ctx.shadowColor = '#80f1e2';
      ctx.shadowBlur = 12;
    }
    ctx.fillStyle = '#80f1e2';
    for (const b of this.bullets) {
      ctx.beginPath();
      ctx.roundRect(b.x - 2, b.y - 12, 4, 18, 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(b.x - 1, b.y - 10, 2, 14);
      ctx.fillStyle = '#80f1e2';
    }
    ctx.shadowBlur = 0;

    // Other Multiplayer Wingmen Starfighters
    if (this.otherPlayers && this.otherPlayers.length > 0) {
      for (const op of this.otherPlayers) {
        if (op.x !== undefined && op.y !== undefined) {
          ctx.save();
          ctx.translate(op.x, op.y);
          // Name tag
          ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
          ctx.beginPath();
          ctx.roundRect(-30, -38, 60, 16, 4);
          ctx.fill();
          ctx.fillStyle = '#38bdf8';
          ctx.font = 'bold 9px Manrope, system-ui';
          ctx.textAlign = 'center';
          ctx.fillText(op.username || 'Wingman', 0, -26);

          // Starfighter body
          ctx.fillStyle = '#38bdf8';
          ctx.beginPath();
          ctx.moveTo(0, -20);
          ctx.lineTo(18, 14);
          ctx.lineTo(0, 8);
          ctx.lineTo(-18, 14);
          ctx.closePath();
          ctx.fill();

          ctx.restore();
        }
      }
    }

    // Player Capybara Starfighter
    if (!(this.player.invincibleTimer > 0 && Math.floor(this.time * 16) % 2 === 0)) {
      this.drawStarship(ctx);
    }
  }

  private drawStarship(ctx: CanvasRenderingContext2D) {
    const p = this.player;
    ctx.save();
    ctx.translate(p.x, p.y);

    if (vfx.enabled) {
      ctx.shadowColor = '#4fd1c0';
      ctx.shadowBlur = 14;
    }

    // Ship wings
    ctx.fillStyle = '#4fd1c0';
    ctx.beginPath();
    ctx.moveTo(0, -26);
    ctx.lineTo(24, 18);
    ctx.lineTo(0, 10);
    ctx.lineTo(-24, 18);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;

    // Ship trim
    ctx.fillStyle = '#2ba898';
    ctx.beginPath();
    ctx.moveTo(0, -18);
    ctx.lineTo(12, 12);
    ctx.lineTo(-12, 12);
    ctx.closePath();
    ctx.fill();

    // Capybara pilot head inside cockpit bubble
    ctx.fillStyle = '#ba895e';
    ctx.beginPath();
    ctx.arc(0, -2, 9, 0, Math.PI * 2);
    ctx.fill();

    // Cute capybara muzzle
    ctx.fillStyle = '#d5a67b';
    ctx.beginPath();
    ctx.ellipse(0, 2, 6, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Pilot goggles / eyes
    ctx.fillStyle = '#1f231c';
    ctx.fillRect(-4, -5, 2.5, 3);
    ctx.fillRect(2, -5, 2.5, 3);

    // Glass dome
    ctx.fillStyle = 'rgba(230, 250, 255, 0.4)';
    ctx.strokeStyle = '#80f1e2';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, -1, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Thruster fire
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.moveTo(-6, 12);
    ctx.lineTo(0, 22 + Math.random() * 8);
    ctx.lineTo(6, 12);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }
}
