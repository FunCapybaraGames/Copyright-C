import { soundEngine } from '../soundEngine';
import { vfx } from '../vfxEngine';

interface Platform {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Coin {
  x: number;
  y: number;
  taken: boolean;
  spinOffset: number;
}

export class CapyHopGame {
  private canvas!: HTMLCanvasElement;
  private onScoreUpdate!: (score: number, extra?: string) => void;

  public score = 0;
  public level = 0;
  public maxLevels = 10;
  private player = {
    x: 40,
    y: 280,
    w: 34,
    h: 36,
    vx: 0,
    vy: 0,
    grounded: false,
    facing: 1,
    wasGrounded: false,
    squashY: 1,
    squashX: 1,
    canDoubleJump: true,
  };

  private platforms: Platform[] = [];
  private coins: Coin[] = [];
  private goal = { x: 740, y: 285, w: 20, h: 80 };
  private time = 0;
  private prevJumpKey = false;

  public init(canvas: HTMLCanvasElement, onScoreUpdate: (score: number, extra?: string) => void) {
    this.canvas = canvas;
    this.onScoreUpdate = onScoreUpdate;
    this.score = 0;
    this.level = 0;
    this.loadLevel(0);
    this.updateHUD();
  }

  private loadLevel(n: number) {
    this.level = n;
    this.platforms = [];
    this.coins = [];
    this.player.x = 40;
    this.player.y = 280;
    this.player.vx = 0;
    this.player.vy = 0;
    this.player.grounded = false;
    this.player.canDoubleJump = true;

    if (n === 0) {
      this.platforms = [
        { x: 0, y: 365, w: 190, h: 85 },
        { x: 230, y: 325, w: 120, h: 125 },
        { x: 400, y: 285, w: 110, h: 165 },
        { x: 550, y: 330, w: 115, h: 120 },
        { x: 690, y: 365, w: 110, h: 85 },
        { x: 130, y: 255, w: 80, h: 14 },
        { x: 310, y: 195, w: 85, h: 14 },
        { x: 480, y: 165, w: 85, h: 14 },
      ];
      this.coins = [
        { x: 160, y: 215, taken: false, spinOffset: 0 },
        { x: 280, y: 280, taken: false, spinOffset: 1 },
        { x: 350, y: 155, taken: false, spinOffset: 2 },
        { x: 440, y: 245, taken: false, spinOffset: 3 },
        { x: 520, y: 125, taken: false, spinOffset: 4 },
        { x: 600, y: 290, taken: false, spinOffset: 5 },
        { x: 720, y: 325, taken: false, spinOffset: 6 },
      ];
    } else {
      let seed = n * 9301 + 49297;
      const rnd = () => {
        seed = (seed * 9301 + 49297) % 233280;
        return seed / 233280;
      };

      this.platforms.push({ x: 0, y: 365, w: 90, h: 85 });
      let cx = 90;
      let cy = 365;
      const pWidth = Math.max(45, 78 - n * 3);

      while (cx < 620) {
        cx += 35 + rnd() * (8 + n * 8);
        cy = Math.max(160, Math.min(365, cy + (rnd() - 0.5) * 115));
        this.platforms.push({ x: Math.round(cx), y: Math.round(cy), w: pWidth, h: 14 });
        this.coins.push({
          x: Math.round(cx + pWidth / 2),
          y: Math.round(cy - 35),
          taken: false,
          spinOffset: Math.random() * 5,
        });
        cx += pWidth;
      }

      this.platforms.push({ x: 690, y: 365, w: 110, h: 85 });
      this.coins.push({ x: 730, y: 325, taken: false, spinOffset: 7 });
    }
  }

  private updateHUD() {
    this.onScoreUpdate(this.score, `STAGE ${this.level + 1}/${this.maxLevels}`);
  }

  public update(dt: number, keys: Set<string>): { gameOver: boolean; won: boolean } {
    this.time += dt;
    const p = this.player;
    const oldBottom = p.y + p.h;

    // Squash & Stretch decay back to 1
    p.squashX += (1 - p.squashX) * Math.min(1, dt * 12);
    p.squashY += (1 - p.squashY) * Math.min(1, dt * 12);

    p.vx = 0;
    if (keys.has('ArrowLeft') || keys.has('a')) {
      p.vx = -240;
      p.facing = -1;
    }
    if (keys.has('ArrowRight') || keys.has('d')) {
      p.vx = 240;
      p.facing = 1;
    }

    const isJumpPressed = keys.has(' ') || keys.has('ArrowUp') || keys.has('w');
    if (isJumpPressed && !this.prevJumpKey) {
      if (p.grounded) {
        p.vy = -490;
        p.grounded = false;
        p.squashX = 0.8;
        p.squashY = 1.3; // Jump stretch
        soundEngine.play('jump');
        vfx.burstDust(p.x + p.w / 2, p.y + p.h, 6);
      } else if (p.canDoubleJump && this.level >= 2) {
        // Double jump unlocked from Stage 3+
        p.vy = -450;
        p.canDoubleJump = false;
        p.squashX = 0.75;
        p.squashY = 1.35;
        soundEngine.play('jump');
        vfx.burstSparks(p.x + p.w / 2, p.y + p.h, 8, '#70b982');
        vfx.addText(p.x + p.w / 2, p.y - 15, 'DOUBLE JUMP!', '#70b982', 14);
      }
    }
    this.prevJumpKey = isJumpPressed;

    // Physics
    p.x = Math.max(0, Math.min(this.canvas.width - p.w, p.x + p.vx * dt));
    p.vy += 1120 * dt;
    p.y += p.vy * dt;

    p.grounded = false;

    // Platform collisions
    for (const plat of this.platforms) {
      if (
        p.x + p.w > plat.x &&
        p.x < plat.x + plat.w &&
        p.vy >= 0 &&
        oldBottom <= plat.y + 4 &&
        p.y + p.h >= plat.y
      ) {
        p.y = plat.y - p.h;
        p.vy = 0;
        p.grounded = true;
        p.canDoubleJump = true;
        if (!p.wasGrounded) {
          p.squashX = 1.3;
          p.squashY = 0.75; // Landing squash
          vfx.burstDust(p.x + p.w / 2, p.y + p.h, 5);
        }
      }
    }
    p.wasGrounded = p.grounded;

    // Foot dust particles when running
    if (p.grounded && p.vx !== 0 && Math.random() < 0.3) {
      vfx.burstDust(p.x + p.w / 2, p.y + p.h, 1);
    }

    // Collect coins
    for (const c of this.coins) {
      if (!c.taken && Math.hypot(p.x + p.w / 2 - c.x, p.y + p.h / 2 - c.y) < 28) {
        c.taken = true;
        this.score++;
        soundEngine.play('coin', { combo: true });
        vfx.burstSparks(c.x, c.y, 10, '#ffd166');
        vfx.addText(c.x, c.y - 12, '+1', '#ffd166', 16);
        this.updateHUD();
      }
    }

    // Goal reached
    if (p.x + p.w > this.goal.x && p.y + p.h > this.goal.y) {
      if (this.level < this.maxLevels - 1) {
        this.level++;
        soundEngine.play('stage');
        vfx.burstSparks(this.goal.x + 10, this.goal.y, 25);
        vfx.addText(400, 200, `STAGE ${this.level + 1}!`, '#06d6a0', 28);
        this.loadLevel(this.level);
        this.updateHUD();
        return { gameOver: false, won: false };
      } else {
        vfx.burstConfetti(800, 450, 70);
        return { gameOver: false, won: true };
      }
    }

    // Fell off
    if (p.y > this.canvas.height + 50) {
      vfx.triggerShake(12, 0.35);
      soundEngine.play('hit');
      return { gameOver: true, won: false };
    }

    return { gameOver: false, won: false };
  }

  public render(ctx: CanvasRenderingContext2D) {
    const W = this.canvas.width;
    const H = this.canvas.height;

    // Sky gradient
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#cbe8d5');
    sky.addColorStop(1, '#f5e7c6');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    // Warm animated sun with pulsing coronal aura
    const sunPulse = Math.sin(this.time * 2) * 3;
    ctx.fillStyle = '#f5c86d';
    ctx.beginPath();
    ctx.arc(680, 80, 36, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(245, 200, 109, 0.2)';
    ctx.beginPath();
    ctx.arc(680, 80, 52 + sunPulse, 0, Math.PI * 2);
    ctx.fill();

    // Drifting clouds
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    for (let i = 0; i < 4; i++) {
      const cx = ((i * 240 + this.time * 14 * (1 + (i % 2) * 0.5)) % 1000) - 100;
      const cy = 60 + i * 26;
      ctx.beginPath();
      ctx.ellipse(cx, cy, 48, 14, 0, 0, Math.PI * 2);
      ctx.ellipse(cx + 24, cy - 8, 28, 12, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Distant soft mountains
    ctx.fillStyle = '#a6cda9';
    ctx.beginPath();
    ctx.moveTo(0, 310);
    ctx.lineTo(140, 160);
    ctx.lineTo(270, 270);
    ctx.lineTo(440, 130);
    ctx.lineTo(620, 290);
    ctx.lineTo(800, 180);
    ctx.lineTo(800, H);
    ctx.lineTo(0, H);
    ctx.closePath();
    ctx.fill();

    // Midground hills
    ctx.fillStyle = '#7db28c';
    ctx.beginPath();
    ctx.moveTo(0, 360);
    ctx.quadraticCurveTo(200, 280, 420, 350);
    ctx.quadraticCurveTo(600, 390, 800, 330);
    ctx.lineTo(800, H);
    ctx.lineTo(0, H);
    ctx.closePath();
    ctx.fill();

    // Platforms
    for (const p of this.platforms) {
      ctx.fillStyle = '#427b58';
      ctx.beginPath();
      ctx.roundRect(p.x, p.y, p.w, p.h, 6);
      ctx.fill();

      ctx.fillStyle = '#7dbb7b';
      ctx.beginPath();
      ctx.roundRect(p.x, p.y, p.w, 7, [6, 6, 2, 2]);
      ctx.fill();
    }

    // Animated rotating coins with glint
    for (const c of this.coins) {
      if (c.taken) continue;
      const bob = Math.sin(this.time * 4 + c.spinOffset) * 4;
      const rot = Math.abs(Math.cos(this.time * 3 + c.spinOffset));
      const r = 9;

      ctx.fillStyle = '#f2a23a';
      ctx.beginPath();
      ctx.ellipse(c.x, c.y + bob, Math.max(2, rot * r), r, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#fff0a7';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(c.x - 1, c.y + bob - 4, 2, 8);
    }

    // Goal Flag with smooth waving cloth animation
    const g = this.goal;
    ctx.fillStyle = '#315d45';
    ctx.fillRect(g.x, g.y, 4, g.h);

    const flagWave1 = Math.sin(this.time * 6) * 5;
    const flagWave2 = Math.sin(this.time * 6 + 1) * 3;
    ctx.fillStyle = '#e76f51';
    ctx.beginPath();
    ctx.moveTo(g.x + 4, g.y);
    ctx.quadraticCurveTo(g.x + 20, g.y + 4 + flagWave1, g.x + 38 + flagWave2, g.y + 14);
    ctx.quadraticCurveTo(g.x + 20, g.y + 24 - flagWave1, g.x + 4, g.y + 28);
    ctx.closePath();
    ctx.fill();

    // Draw Capybara with dynamic squash & stretch
    this.drawCapybara(ctx);
  }

  private drawCapybara(ctx: CanvasRenderingContext2D) {
    const p = this.player;
    const isMoving = p.vx !== 0 && p.grounded;
    const walkStep = isMoving ? Math.sin(this.time * 18) * 4 : 0;
    const bodyBob = isMoving ? -Math.abs(Math.sin(this.time * 18)) * 2.5 : Math.sin(this.time * 3) * 0.8;

    ctx.save();
    ctx.translate(p.x + p.w / 2, p.y + 18 + bodyBob);
    ctx.scale(p.facing * p.squashX, p.squashY);

    if (!p.grounded) {
      ctx.rotate(Math.max(-0.25, Math.min(0.25, p.vy * 0.0004)));
    }

    // Shadow on ground
    if (p.grounded) {
      ctx.fillStyle = 'rgba(40, 70, 50, 0.2)';
      ctx.beginPath();
      ctx.ellipse(0, 18 - bodyBob, 16 * p.squashX, 4 * p.squashY, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    const ellipse = (x: number, y: number, rx: number, ry: number, color: string) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
    };

    // Animated walking feet
    ctx.fillStyle = '#6f4a30';
    ctx.fillRect(-10 + walkStep, 11, 7, 7);
    ctx.fillRect(6 - walkStep, 11, 7, 7);

    // Body
    ellipse(0, 4, 18, 14, '#a9764e');
    ellipse(0, 8, 12, 6, '#ba895e');

    // Head
    ellipse(9, -4, 12, 11, '#ba895e');
    ellipse(18, -1, 7, 6, '#d5a67b'); // Snout
    ellipse(22, -2, 2.5, 1.8, '#5a3a26'); // Nose
    ellipse(6, -13, 3.5, 4.5, '#8a5d3c'); // Ear

    // Eye with blinking
    if (this.time % 3.5 < 0.12) {
      ctx.strokeStyle = '#1f231c';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(10, -6);
      ctx.lineTo(14, -6);
      ctx.stroke();
    } else {
      ellipse(12, -6, 2, 2.2, '#1f231c');
      ellipse(12.6, -6.8, 0.7, 0.7, '#ffffff'); // Glint
    }

    // Rosy cheek
    ellipse(14, 0, 2.8, 1.8, 'rgba(240, 144, 120, 0.45)');

    // Yuzu orange with leaf wobble
    const orangeWobble = Math.sin(this.time * 6) * 1;
    ellipse(7, -16 + orangeWobble, 5, 4.8, '#f2a23a');
    ellipse(9, -20 + orangeWobble, 2.6, 1.2, '#4f9a52'); // Orange leaf

    ctx.restore();
  }
}
