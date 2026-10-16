import { soundEngine } from '../soundEngine';
import { vfx } from '../vfxEngine';

interface Obstacle {
  x: number;
  y: number;
  w: number;
  h: number;
  speed: number;
  color: string;
  scoredNearMiss?: boolean;
}

export class NeonDodgeGame {
  private canvas!: HTMLCanvasElement;
  private onScoreUpdate!: (score: number, extra?: string) => void;

  public score = 0;
  public stage = 1;
  private elapsed = 0;
  private spawnTimer = 0;

  private player = {
    x: 385,
    y: 380,
    w: 30,
    h: 30,
    vx: 0,
  };

  private obstacles: Obstacle[] = [];
  private stars: Array<[number, number, number]> = [];

  public init(canvas: HTMLCanvasElement, onScoreUpdate: (score: number, extra?: string) => void) {
    this.canvas = canvas;
    this.onScoreUpdate = onScoreUpdate;
    this.score = 0;
    this.stage = 1;
    this.elapsed = 0;
    this.spawnTimer = 0;
    this.player.x = canvas.width / 2 - 15;
    this.player.y = 380;
    this.player.vx = 0;
    this.obstacles = [];

    this.stars = Array.from({ length: 50 }, () => [
      Math.random() * canvas.width,
      Math.random() * canvas.height,
      0.5 + Math.random() * 1.5,
    ]);

    this.updateHUD();
  }

  private updateHUD() {
    this.onScoreUpdate(this.score, `STAGE ${this.stage} · SURVIVE`);
  }

  public update(dt: number, keys: Set<string>): { gameOver: boolean; won: boolean } {
    this.elapsed += dt;
    this.spawnTimer += dt;

    // Stage progression every 15 seconds
    const newStage = Math.min(10, 1 + Math.floor(this.elapsed / 15));
    if (newStage !== this.stage) {
      this.stage = newStage;
      soundEngine.play('stage');
      vfx.burstShockwave(this.canvas.width / 2, this.canvas.height / 2, '#ff85b2');
      vfx.addText(this.canvas.width / 2, 200, `SPEED SURGE! STAGE ${this.stage}`, '#ff85b2', 26);
    }

    // Controls
    let dir = 0;
    if (keys.has('ArrowLeft') || keys.has('a')) dir -= 1;
    if (keys.has('ArrowRight') || keys.has('d')) dir += 1;

    const accel = 1800;
    this.player.vx += dir * accel * dt;
    this.player.vx *= Math.pow(0.82, dt * 60); // friction
    this.player.x += this.player.vx * dt;

    // Boundaries
    const margin = 12;
    if (this.player.x < margin) {
      this.player.x = margin;
      this.player.vx = 0;
    } else if (this.player.x > this.canvas.width - this.player.w - margin) {
      this.player.x = this.canvas.width - this.player.w - margin;
      this.player.vx = 0;
    }

    // Engine exhaust particles
    if (vfx.enabled && Math.random() < 0.8) {
      vfx.particles.push({
        x: this.player.x + this.player.w / 2 + (Math.random() - 0.5) * 6,
        y: this.player.y + this.player.h,
        vx: (Math.random() - 0.5) * 20 - this.player.vx * 0.1,
        vy: 120 + Math.random() * 80,
        life: 0.25,
        maxLife: 0.25,
        size: 3 + Math.random() * 3,
        color: '#7ef0df',
        shape: 'circle',
      });
    }

    // Spawn falling blocks
    const spawnInterval = Math.max(0.24, 0.75 - this.stage * 0.045);
    if (this.spawnTimer >= spawnInterval) {
      this.spawnTimer = 0;
      const size = 18 + Math.random() * 26;
      const colors = ['#ff85b2', '#ff6b8b', '#e056fd', '#f368e0', '#ff9ff3'];
      this.obstacles.push({
        x: Math.random() * (this.canvas.width - size - 20) + 10,
        y: -size,
        w: size,
        h: size,
        speed: 170 + Math.random() * 110 + (this.stage - 1) * 35,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }

    // Update obstacles and collision
    const p = this.player;
    for (const o of this.obstacles) {
      o.y += o.speed * dt;

      // Hit collision
      if (
        p.x < o.x + o.w &&
        p.x + p.w > o.x &&
        p.y < o.y + o.h &&
        p.y + p.h > o.y
      ) {
        vfx.triggerShake(16, 0.45);
        soundEngine.play('hit');
        vfx.burstSparks(p.x + p.w / 2, p.y + p.h / 2, 25, '#ff85b2');
        vfx.burstShockwave(p.x + p.w / 2, p.y + p.h / 2, '#ff6b8b');
        return { gameOver: true, won: false };
      }

      // Near-miss check
      if (!o.scoredNearMiss && o.y > p.y && o.y < p.y + p.h) {
        const dist = Math.min(
          Math.abs(p.x - (o.x + o.w)),
          Math.abs((p.x + p.w) - o.x)
        );
        if (dist < 26) {
          o.scoredNearMiss = true;
          this.score += 50;
          soundEngine.play('coin');
          vfx.burstSparks(p.x + p.w / 2, p.y, 6, '#7ef0df');
          vfx.addText(p.x + p.w / 2, p.y - 18, '+50 CLOSE!', '#7ef0df', 15);
        }
      }
    }

    // Remove offscreen
    this.obstacles = this.obstacles.filter((o) => o.y < this.canvas.height + 40);

    // Score based on survival time + near misses
    this.score += Math.floor(dt * 15);
    this.updateHUD();

    if (this.stage >= 10 && this.elapsed >= 150) {
      vfx.burstConfetti(800, 450, 70);
      return { gameOver: false, won: true };
    }

    return { gameOver: false, won: false };
  }

  public render(ctx: CanvasRenderingContext2D) {
    const W = this.canvas.width;
    const H = this.canvas.height;

    // Dark cyberpunk arena
    ctx.fillStyle = '#16172e';
    ctx.fillRect(0, 0, W, H);

    // Perspective grid background
    ctx.strokeStyle = '#27294d';
    ctx.lineWidth = 1;
    for (let x = 0; x <= W; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }
    const gridOffset = (this.elapsed * 120) % 40;
    for (let y = gridOffset; y <= H; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }

    // Falling star specks
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    for (const s of this.stars) {
      s[1] = (s[1] + s[2] * 2.5) % H;
      ctx.fillRect(s[0], s[1], 1.5, 1.5 + s[2]);
    }

    // Neon Obstacles
    for (const o of this.obstacles) {
      if (vfx.enabled) {
        ctx.shadowColor = o.color;
        ctx.shadowBlur = 12;
      }
      ctx.fillStyle = o.color;
      ctx.beginPath();
      ctx.roundRect(o.x, o.y, o.w, o.h, 4);
      ctx.fill();

      // Inner glow core
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(o.x + 3, o.y + 3, Math.max(2, o.w - 6), Math.max(2, o.h - 6));
    }
    ctx.shadowBlur = 0;

    // Player Neon Ship
    const p = this.player;
    ctx.save();
    ctx.translate(p.x + p.w / 2, p.y + p.h / 2);
    const tilt = (p.vx / 300) * 0.25;
    ctx.rotate(tilt);

    if (vfx.enabled) {
      ctx.shadowColor = '#80f1e2';
      ctx.shadowBlur = 16;
    }

    // Ship hull
    ctx.fillStyle = '#80f1e2';
    ctx.beginPath();
    ctx.moveTo(0, -p.h / 2);
    ctx.lineTo(p.w / 2, p.h / 2);
    ctx.lineTo(0, p.h / 3);
    ctx.lineTo(-p.w / 2, p.h / 2);
    ctx.closePath();
    ctx.fill();

    // Inner cockpit
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -p.h / 4);
    ctx.lineTo(p.w / 5, p.h / 4);
    ctx.lineTo(-p.w / 5, p.h / 4);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
    ctx.shadowBlur = 0;
  }
}
