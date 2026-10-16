import { soundEngine } from '../soundEngine';
import { vfx } from '../vfxEngine';

export class CapyPongGame {
  private canvas!: HTMLCanvasElement;
  private onScoreUpdate!: (score: number, extra?: string) => void;

  public score = 0;
  public stage = 1;
  public lives = 3;
  public isMultiplayer = false;
  public opponentName = 'AI';
  public p1Score = 0;
  public p2Score = 0;

  private playerY = 185;
  private aiY = 185;
  private ballX = 400;
  private ballY = 225;
  private ballVx = -300;
  private ballVy = 100;
  private ballSpeed = 300;

  private paddleH = 80;
  private paddleW = 14;

  public setMultiplayer(isMp: boolean, opponentName = 'Friend') {
    this.isMultiplayer = isMp;
    this.opponentName = opponentName;
    this.p1Score = 0;
    this.p2Score = 0;
  }

  public setOpponentY(y: number) {
    this.aiY = y;
  }

  public getPlayerY() {
    return this.playerY;
  }

  public init(canvas: HTMLCanvasElement, onScoreUpdate: (score: number, extra?: string) => void) {
    this.canvas = canvas;
    this.onScoreUpdate = onScoreUpdate;
    this.score = 0;
    this.stage = 1;
    this.lives = 3;
    this.p1Score = 0;
    this.p2Score = 0;
    this.playerY = 185;
    this.aiY = 185;
    this.serve(-1);
    this.updateHUD();
  }

  private serve(dir: number) {
    this.ballX = 400;
    this.ballY = 225;
    this.ballSpeed = 300 + this.stage * 25;
    this.ballVx = dir * this.ballSpeed;
    this.ballVy = (Math.random() - 0.5) * 220;
  }

  private updateHUD() {
    if (this.isMultiplayer) {
      this.onScoreUpdate(
        this.p1Score * 10,
        `YOU ${this.p1Score} : ${this.p2Score} ${this.opponentName.toUpperCase()}`
      );
    } else {
      this.onScoreUpdate(
        this.score,
        `STAGE ${this.stage}/10 · ${'♥'.repeat(Math.max(0, this.lives))}`
      );
    }
  }

  public update(dt: number, keys: Set<string>): { gameOver: boolean; won: boolean } {
    // Player 1 paddle movement (W/S or Up/Down if singleplayer)
    let pDir = 0;
    if (keys.has('w') || (!this.isMultiplayer && keys.has('ArrowUp'))) pDir -= 1;
    if (keys.has('s') || (!this.isMultiplayer && keys.has('ArrowDown'))) pDir += 1;

    const pSpeed = 440;
    this.playerY += pDir * pSpeed * dt;
    this.playerY = Math.max(10, Math.min(this.canvas.height - this.paddleH - 10, this.playerY));

    // Player 2 / AI paddle movement
    if (this.isMultiplayer) {
      // In multiplayer, Arrow keys move the right paddle locally (or synced over network)
      let p2Dir = 0;
      if (keys.has('ArrowUp')) p2Dir -= 1;
      if (keys.has('ArrowDown')) p2Dir += 1;
      this.aiY += p2Dir * pSpeed * dt;
      this.aiY = Math.max(10, Math.min(this.canvas.height - this.paddleH - 10, this.aiY));
    } else {
      // AI paddle movement with stage-calibrated tracking
      const aiTarget = this.ballY - this.paddleH / 2;
      const aiSpeed = Math.min(420, 150 + this.stage * 30);
      const diff = aiTarget - this.aiY;
      this.aiY += Math.sign(diff) * Math.min(Math.abs(diff), aiSpeed * dt);
      this.aiY = Math.max(10, Math.min(this.canvas.height - this.paddleH - 10, this.aiY));
    }

    // Ball movement
    this.ballX += this.ballVx * dt;
    this.ballY += this.ballVy * dt;

    // Ball trail particles
    if (vfx.enabled && Math.random() < 0.35) {
      vfx.particles.push({
        x: this.ballX,
        y: this.ballY,
        vx: 0,
        vy: 0,
        life: 0.18,
        maxLife: 0.18,
        size: 5,
        color: '#ffe08a',
        shape: 'circle',
      });
    }

    // Top and bottom bounce
    if (this.ballY < 12 || this.ballY > this.canvas.height - 12) {
      this.ballVy = -this.ballVy;
      this.ballY = Math.max(12, Math.min(this.canvas.height - 12, this.ballY));
      soundEngine.play('flip');
      vfx.burstSparks(this.ballX, this.ballY, 3, '#ffe08a');
    }

    // Player paddle collision
    const playerX = 36;
    if (
      this.ballVx < 0 &&
      this.ballX <= playerX + this.paddleW &&
      this.ballX >= playerX - 10 &&
      this.ballY >= this.playerY - 8 &&
      this.ballY <= this.playerY + this.paddleH + 8
    ) {
      const hitOffset = (this.ballY - (this.playerY + this.paddleH / 2)) / (this.paddleH / 2);
      this.ballSpeed = Math.min(680, this.ballSpeed * 1.05);
      this.ballVx = Math.abs(this.ballVx) * 1.05;
      this.ballVy = hitOffset * this.ballSpeed * 0.85;

      soundEngine.play('paddle', { pitchOffset: 80 });
      vfx.burstSparks(playerX + this.paddleW, this.ballY, 8, '#7ef0df');
      vfx.burstShockwave(playerX + this.paddleW, this.ballY, '#7ef0df');
    }

    // AI paddle collision
    const aiX = this.canvas.width - 36 - this.paddleW;
    if (
      this.ballVx > 0 &&
      this.ballX >= aiX &&
      this.ballX <= aiX + this.paddleW + 10 &&
      this.ballY >= this.aiY - 8 &&
      this.ballY <= this.aiY + this.paddleH + 8
    ) {
      const hitOffset = (this.ballY - (this.aiY + this.paddleH / 2)) / (this.paddleH / 2);
      this.ballSpeed = Math.min(680, this.ballSpeed * 1.04);
      this.ballVx = -Math.abs(this.ballVx) * 1.04;
      this.ballVy = hitOffset * this.ballSpeed * 0.8;

      soundEngine.play('paddle', { pitchOffset: -40 });
      vfx.burstSparks(aiX, this.ballY, 8, '#ff85b2');
    }

    // Left lost point
    if (this.ballX < -15) {
      if (this.isMultiplayer) {
        this.p2Score++;
        soundEngine.play('hit');
        vfx.addText(150, 225, `${this.opponentName} +1`, '#ff85b2', 22);
        this.updateHUD();
        if (this.p2Score >= 7) {
          return { gameOver: true, won: false };
        }
        this.serve(1);
      } else {
        this.lives--;
        vfx.triggerShake(12, 0.35);
        soundEngine.play('hit');
        vfx.addText(120, 225, '-1 LIFE', '#ef4444', 20);
        this.updateHUD();

        if (this.lives <= 0) {
          return { gameOver: true, won: false };
        }
        this.serve(1);
      }
    }

    // Right lost point
    if (this.ballX > this.canvas.width + 15) {
      if (this.isMultiplayer) {
        this.p1Score++;
        this.score = this.p1Score * 10;
        soundEngine.play('coin', { combo: true });
        vfx.burstSparks(this.canvas.width - 80, this.ballY, 15, '#ffd166');
        vfx.addText(650, 225, 'YOU SCORED! +1', '#10b981', 22);
        this.updateHUD();
        if (this.p1Score >= 7) {
          vfx.burstConfetti(800, 450, 60);
          return { gameOver: false, won: true };
        }
        this.serve(-1);
      } else {
        this.score++;
        soundEngine.play('coin', { combo: true });
        vfx.burstSparks(this.canvas.width - 80, this.ballY, 15, '#ffd166');
        vfx.addText(650, 225, 'POINT! +1', '#10b981', 20);

        // Stage progression every 2 points
        const newStage = Math.min(10, 1 + Math.floor(this.score / 2));
        if (newStage !== this.stage) {
          this.stage = newStage;
          soundEngine.play('stage');
          vfx.addText(400, 180, `TOURNAMENT STAGE ${this.stage}!`, '#ffe08a', 26);
        }
        this.updateHUD();

        if (this.stage >= 10 && this.score >= 20) {
          vfx.burstConfetti(800, 450, 70);
          return { gameOver: false, won: true };
        }
        this.serve(-1);
      }
    }

    return { gameOver: false, won: false };
  }

  public render(ctx: CanvasRenderingContext2D) {
    const W = this.canvas.width;
    const H = this.canvas.height;

    // Dark tournament field
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#0c2225');
    bg.addColorStop(1, '#153b3a');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Center divider dotted line
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 3;
    ctx.setLineDash([12, 16]);
    ctx.beginPath();
    ctx.moveTo(W / 2, 0);
    ctx.lineTo(W / 2, H);
    ctx.stroke();
    ctx.setLineDash([]);

    // Header
    ctx.fillStyle = '#b9e8d5';
    ctx.font = 'bold 16px Manrope, system-ui';
    ctx.fillText('CAPY PONG', 28, 38);
    ctx.font = '12px system-ui';
    ctx.fillStyle = '#7acbb3';
    ctx.fillText(`Stage ${this.stage} of 10 · Defeat the AI challenger`, 28, 56);

    // Player Paddle (cyan glowing)
    if (vfx.enabled) {
      ctx.shadowColor = '#7ef0df';
      ctx.shadowBlur = 14;
    }
    ctx.fillStyle = '#7ef0df';
    ctx.beginPath();
    ctx.roundRect(36, this.playerY, this.paddleW, this.paddleH, 7);
    ctx.fill();

    // AI Paddle (pink glowing)
    ctx.shadowColor = '#ff85b2';
    ctx.fillStyle = '#ff85b2';
    ctx.beginPath();
    ctx.roundRect(W - 36 - this.paddleW, this.aiY, this.paddleW, this.paddleH, 7);
    ctx.fill();

    // Pong Ball (golden glowing orb)
    ctx.shadowColor = '#ffe08a';
    ctx.fillStyle = '#ffe08a';
    ctx.beginPath();
    ctx.arc(this.ballX, this.ballY, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Cute capybara head icon near player paddle
    ctx.font = '22px system-ui';
    ctx.fillText('🐹', 12, this.playerY + this.paddleH / 2 + 8);
  }
}
