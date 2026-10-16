import { soundEngine } from '../soundEngine';
import { vfx } from '../vfxEngine';

interface Brick {
  x: number;
  y: number;
  w: number;
  h: number;
  hue: number;
  dead: boolean;
}

export class MudBricksGame {
  private canvas!: HTMLCanvasElement;
  private onScoreUpdate!: (score: number, extra?: string) => void;

  public score = 0;
  public level = 1;
  public maxLevels = 10;
  public lives = 3;

  private paddleX = 355;
  private paddleW = 95;
  private ballX = 400;
  private ballY = 405;
  private ballVx = 0;
  private ballVy = 0;
  private isBallLive = false;

  private bricks: Brick[] = [];

  public init(canvas: HTMLCanvasElement, onScoreUpdate: (score: number, extra?: string) => void) {
    this.canvas = canvas;
    this.onScoreUpdate = onScoreUpdate;
    this.score = 0;
    this.level = 1;
    this.lives = 3;
    this.paddleX = canvas.width / 2 - this.paddleW / 2;
    this.resetBall();
    this.buildLevel(1);
    this.updateHUD();
  }

  private resetBall() {
    this.isBallLive = false;
    this.ballX = this.paddleX + this.paddleW / 2;
    this.ballY = 405;
    this.ballVx = 0;
    this.ballVy = 0;
  }

  private buildLevel(lvl: number) {
    this.level = lvl;
    this.bricks = [];
    const rows = Math.min(8, 2 + lvl);
    const cols = 10;
    const brickW = 68;
    const brickH = 20;
    const gap = 6;
    const startX = (this.canvas.width - (cols * brickW + (cols - 1) * gap)) / 2;
    const startY = 70;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        // Pattern variations for higher levels
        if (lvl > 3 && (r + c) % 5 === 0) continue;
        if (lvl > 6 && r % 2 === 1 && c % 2 === 0) continue;

        this.bricks.push({
          x: startX + c * (brickW + gap),
          y: startY + r * (brickH + gap),
          w: brickW,
          h: brickH,
          hue: 25 + r * 35 + c * 10,
          dead: false,
        });
      }
    }
  }

  private updateHUD() {
    this.onScoreUpdate(
      this.score,
      `LEVEL ${this.level}/${this.maxLevels} · ${'♥'.repeat(Math.max(0, this.lives))}`
    );
  }

  public update(dt: number, keys: Set<string>): { gameOver: boolean; won: boolean } {
    // Paddle movement
    let pDir = 0;
    if (keys.has('a') || keys.has('ArrowLeft')) pDir -= 1;
    if (keys.has('d') || keys.has('ArrowRight')) pDir += 1;

    const pSpeed = 520;
    this.paddleX += pDir * pSpeed * dt;
    this.paddleX = Math.max(10, Math.min(this.canvas.width - this.paddleW - 10, this.paddleX));

    // Ball on paddle before launch
    if (!this.isBallLive) {
      this.ballX = this.paddleX + this.paddleW / 2;
      this.ballY = 405;

      if (keys.has(' ')) {
        this.isBallLive = true;
        const speed = 300 + this.level * 22;
        this.ballVx = (Math.random() > 0.5 ? 1 : -1) * speed * 0.55;
        this.ballVy = -speed * 0.85;
        soundEngine.play('jump');
      }
      return { gameOver: false, won: false };
    }

    // Ball movement
    this.ballX += this.ballVx * dt;
    this.ballY += this.ballVy * dt;

    // Wall bounce
    if (this.ballX < 12) {
      this.ballX = 12;
      this.ballVx = Math.abs(this.ballVx);
      soundEngine.play('flip');
    } else if (this.ballX > this.canvas.width - 12) {
      this.ballX = this.canvas.width - 12;
      this.ballVx = -Math.abs(this.ballVx);
      soundEngine.play('flip');
    }

    if (this.ballY < 12) {
      this.ballY = 12;
      this.ballVy = Math.abs(this.ballVy);
      soundEngine.play('flip');
    }

    // Paddle collision
    const paddleY = 415;
    if (
      this.ballVy > 0 &&
      this.ballY >= paddleY - 10 &&
      this.ballY <= paddleY + 12 &&
      this.ballX >= this.paddleX - 6 &&
      this.ballX <= this.paddleX + this.paddleW + 6
    ) {
      const hitOffset = (this.ballX - (this.paddleX + this.paddleW / 2)) / (this.paddleW / 2);
      const speed = Math.hypot(this.ballVx, this.ballVy);
      this.ballVx = hitOffset * speed * 1.5;
      this.ballVy = -Math.sqrt(Math.max(10000, speed * speed - this.ballVx * this.ballVx));

      soundEngine.play('paddle');
      vfx.burstSparks(this.ballX, paddleY, 6, '#3f8a60');
    }

    // Brick collisions
    for (const b of this.bricks) {
      if (
        !b.dead &&
        this.ballX >= b.x - 6 &&
        this.ballX <= b.x + b.w + 6 &&
        this.ballY >= b.y - 6 &&
        this.ballY <= b.y + b.h + 6
      ) {
        b.dead = true;
        this.ballVy = -this.ballVy;
        this.score++;

        // Musical pitch climbing combo!
        soundEngine.play('brick', { combo: true });
        vfx.burstSparks(b.x + b.w / 2, b.y + b.h / 2, 8, `hsl(${b.hue % 360}, 60%, 55%)`);
        vfx.addText(b.x + b.w / 2, b.y, '+1', '#ffd166', 15);
        this.updateHUD();
        break;
      }
    }

    this.bricks = this.bricks.filter((b) => !b.dead);

    // Ball fell below
    if (this.ballY > this.canvas.height + 20) {
      this.lives--;
      vfx.triggerShake(14, 0.35);
      soundEngine.play('hit');
      vfx.addText(this.canvas.width / 2, 380, '-1 BALL', '#ef4444', 18);
      this.updateHUD();

      if (this.lives <= 0) {
        return { gameOver: true, won: false };
      }
      this.resetBall();
    }

    // Level clear!
    if (this.bricks.length === 0) {
      if (this.level < this.maxLevels) {
        this.level++;
        soundEngine.play('stage');
        vfx.burstConfetti(800, 450, 40);
        vfx.addText(400, 200, `LEVEL ${this.level}!`, '#10b981', 26);
        this.resetBall();
        this.buildLevel(this.level);
        this.updateHUD();
        return { gameOver: false, won: false };
      } else {
        vfx.burstConfetti(800, 450, 80);
        return { gameOver: false, won: true };
      }
    }

    return { gameOver: false, won: false };
  }

  public render(ctx: CanvasRenderingContext2D) {
    const W = this.canvas.width;
    const H = this.canvas.height;

    // Warm earth / pottery backdrop
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#f8ede0');
    bg.addColorStop(1, '#dfc9a6');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Header
    ctx.fillStyle = '#6b4528';
    ctx.font = 'bold 16px Manrope, system-ui';
    ctx.fillText('MUD BRICKS', 28, 38);
    ctx.font = '12px system-ui';
    ctx.fillStyle = '#8f6542';
    ctx.fillText(`Level ${this.level} of ${this.maxLevels} · Smash the terracotta tiles`, 28, 56);

    // Bricks
    for (const b of this.bricks) {
      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      ctx.beginPath();
      ctx.roundRect(b.x, b.y + 3, b.w, b.h, 4);
      ctx.fill();

      // Brick body
      ctx.fillStyle = `hsl(${b.hue % 360}, 55%, 52%)`;
      ctx.beginPath();
      ctx.roundRect(b.x, b.y, b.w, b.h, 4);
      ctx.fill();

      // Brick highlight top edge
      ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.fillRect(b.x + 3, b.y + 2, b.w - 6, 3);
    }

    // Paddle
    const paddleY = 415;
    ctx.fillStyle = '#3f8a60';
    ctx.beginPath();
    ctx.roundRect(this.paddleX, paddleY, this.paddleW, 14, 7);
    ctx.fill();

    // Cute capybara head on paddle center
    ctx.font = '18px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('🐹', this.paddleX + this.paddleW / 2, paddleY - 2);
    ctx.textAlign = 'left';

    // Ball
    ctx.fillStyle = '#c0392b';
    ctx.beginPath();
    ctx.arc(this.ballX, this.ballY, 8.5, 0, Math.PI * 2);
    ctx.fill();

    // Glint
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(this.ballX - 2.5, this.ballY - 2.5, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Launch hint
    if (!this.isBallLive) {
      ctx.fillStyle = '#6b4528';
      ctx.font = 'bold 13px Manrope, system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('Press SPACE to launch the ball', W / 2, 442);
      ctx.textAlign = 'left';
    }
  }
}
