import { soundEngine } from '../soundEngine';
import { vfx } from '../vfxEngine';

interface FallingItem {
  x: number;
  y: number;
  emoji: string;
  isRock: boolean;
  speed: number;
  collected?: boolean;
}

export class SnackCatchGame {
  private canvas!: HTMLCanvasElement;
  private onScoreUpdate!: (score: number, extra?: string) => void;

  public score = 0;
  public stage = 1;
  public lives = 3;
  public otherPlayers: any[] = [];

  public setRoomData(players: any[]) {
    this.otherPlayers = players;
  }

  public getPlayerX(): number {
    return this.player.x;
  }

  private player = {
    x: 368,
    y: 380,
    w: 64,
    h: 40,
    vx: 0,
    facing: 1,
  };

  private items: FallingItem[] = [];
  private spawnTimer = 0;
  private time = 0;

  public init(canvas: HTMLCanvasElement, onScoreUpdate: (score: number, extra?: string) => void) {
    this.canvas = canvas;
    this.onScoreUpdate = onScoreUpdate;
    this.score = 0;
    this.stage = 1;
    this.lives = 3;
    this.player.x = canvas.width / 2 - 32;
    this.player.y = 380;
    this.player.vx = 0;
    this.items = [];
    this.spawnTimer = 0;
    this.updateHUD();
  }

  private updateHUD() {
    this.onScoreUpdate(
      this.score,
      `STAGE ${this.stage} · ${'♥'.repeat(Math.max(0, this.lives))}`
    );
  }

  public update(dt: number, keys: Set<string>): { gameOver: boolean; won: boolean } {
    this.time += dt;
    this.spawnTimer += dt;

    // Movement
    let dir = 0;
    if (keys.has('ArrowLeft') || keys.has('a')) {
      dir -= 1;
      this.player.facing = -1;
    }
    if (keys.has('ArrowRight') || keys.has('d')) {
      dir += 1;
      this.player.facing = 1;
    }

    const speed = 400;
    this.player.x += dir * speed * dt;
    this.player.x = Math.max(8, Math.min(this.canvas.width - this.player.w - 8, this.player.x));

    // Stage progression every 8 fruits caught
    const newStage = Math.min(10, 1 + Math.floor(this.score / 8));
    if (newStage !== this.stage) {
      this.stage = newStage;
      soundEngine.play('stage');
      vfx.addText(400, 180, `STAGE ${this.stage}! FASTER!`, '#f59e0b', 24);
    }

    // Spawn falling snacks & rocks
    const spawnRate = Math.max(0.3, 0.9 - this.stage * 0.06);
    if (this.spawnTimer >= spawnRate) {
      this.spawnTimer = 0;
      const isRock = Math.random() < 0.2 + this.stage * 0.02;
      const fruits = ['🍉', '🍊', '🍓', '🍋', '🥝'];
      this.items.push({
        x: 30 + Math.random() * (this.canvas.width - 60),
        y: -24,
        emoji: isRock ? '🪨' : fruits[Math.floor(Math.random() * fruits.length)],
        isRock,
        speed: 160 + this.stage * 24 + Math.random() * 50,
      });
    }

    // Update items
    const p = this.player;
    for (const it of this.items) {
      it.y += it.speed * dt;

      // Caught by basket?
      if (!it.collected && it.y >= p.y - 10 && it.y <= p.y + 25 && it.x >= p.x - 10 && it.x <= p.x + p.w + 10) {
        it.collected = true;
        if (it.isRock) {
          this.lives--;
          vfx.triggerShake(12, 0.35);
          soundEngine.play('hit');
          vfx.burstSparks(it.x, it.y, 14, '#9ca3af');
          vfx.addText(it.x, it.y - 15, '-1 HEART', '#ef4444', 16);
        } else {
          this.score++;
          soundEngine.play('coin', { combo: true });
          vfx.burstSparks(it.x, it.y, 8, '#ffd166');
          vfx.addText(it.x, it.y - 15, '+1', '#10b981', 16);
        }
        this.updateHUD();
      } else if (!it.collected && it.y > this.canvas.height + 10) {
        it.collected = true;
        // Missed fruit costs a heart in later stages!
        if (!it.isRock && this.stage >= 4) {
          this.lives--;
          vfx.triggerShake(6, 0.2);
          soundEngine.play('hit');
          vfx.addText(it.x, 420, 'MISSED!', '#f87171', 14);
          this.updateHUD();
        }
      }
    }

    this.items = this.items.filter((it) => !it.collected);

    if (this.lives <= 0) {
      return { gameOver: true, won: false };
    }

    if (this.stage >= 10 && this.score >= 80) {
      vfx.burstConfetti(800, 450, 70);
      return { gameOver: false, won: true };
    }

    return { gameOver: false, won: false };
  }

  public render(ctx: CanvasRenderingContext2D) {
    const W = this.canvas.width;
    const H = this.canvas.height;

    // Cheerful sunny background
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#d8eef8');
    bg.addColorStop(1, '#f7edd2');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Warm Sun
    ctx.fillStyle = '#f5c86d';
    ctx.beginPath();
    ctx.arc(690, 75, 36, 0, Math.PI * 2);
    ctx.fill();

    // Grass floor
    ctx.fillStyle = '#7ebd8c';
    ctx.fillRect(0, 410, W, 40);
    ctx.fillStyle = '#529668';
    ctx.fillRect(0, 426, W, 24);

    // Header info
    ctx.fillStyle = '#265438';
    ctx.font = 'bold 16px Manrope, system-ui';
    ctx.fillText('SNACK CATCH', 28, 38);
    ctx.font = '12px system-ui';
    ctx.fillStyle = '#567a64';
    ctx.fillText(`Stage ${this.stage} · Catch fruit in basket, avoid heavy rocks`, 28, 56);

    // Render falling items
    ctx.font = '28px system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const it of this.items) {
      // Ground shadow preview
      const shadowSize = Math.max(2, 14 * (it.y / H));
      ctx.fillStyle = 'rgba(40, 70, 50, 0.15)';
      ctx.beginPath();
      ctx.ellipse(it.x, 415, shadowSize, shadowSize * 0.35, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillText(it.emoji, it.x, it.y);
    }
    ctx.textAlign = 'left';
    // Draw Other Co-op Players
    if (this.otherPlayers && this.otherPlayers.length > 0) {
      for (const op of this.otherPlayers) {
        if (op.x !== undefined) {
          ctx.save();
          ctx.translate(op.x + 32, 398);
          // Name tag
          ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
          ctx.beginPath();
          ctx.roundRect(-30, -38, 60, 16, 4);
          ctx.fill();
          ctx.fillStyle = '#38bdf8';
          ctx.font = 'bold 9px Manrope, system-ui';
          ctx.textAlign = 'center';
          ctx.fillText(op.username || 'Friend', 0, -26);

          // Body
          ctx.fillStyle = '#8c5e3c';
          ctx.beginPath();
          ctx.ellipse(0, 6, 22, 14, 0, 0, Math.PI * 2);
          ctx.fill();

          // Basket
          ctx.fillStyle = '#b45309';
          ctx.beginPath();
          ctx.roundRect(-18, -12, 22, 16, 4);
          ctx.fill();

          ctx.restore();
        }
      }
    }

    // Draw Local Capybara with wicker basket on back
    this.drawCapyWithBasket(ctx);
  }

  private drawCapyWithBasket(ctx: CanvasRenderingContext2D) {
    const p = this.player;
    ctx.save();
    ctx.translate(p.x + p.w / 2, p.y + 18);
    ctx.scale(p.facing, 1);

    // Shadow
    ctx.fillStyle = 'rgba(40, 70, 50, 0.25)';
    ctx.beginPath();
    ctx.ellipse(0, 20, 24, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Body
    ctx.fillStyle = '#a9764e';
    ctx.beginPath();
    ctx.ellipse(0, 6, 26, 17, 0, 0, Math.PI * 2);
    ctx.fill();

    // Head
    ctx.fillStyle = '#ba895e';
    ctx.beginPath();
    ctx.ellipse(18, -2, 14, 12, 0, 0, Math.PI * 2);
    ctx.fill();

    // Snout
    ctx.fillStyle = '#d5a67b';
    ctx.beginPath();
    ctx.ellipse(28, 1, 8, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    // Nose
    ctx.fillStyle = '#5a3a26';
    ctx.beginPath();
    ctx.arc(33, 0, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Eye
    ctx.fillStyle = '#1f231c';
    ctx.beginPath();
    ctx.arc(20, -5, 2.4, 0, Math.PI * 2);
    ctx.fill();

    // Wicker basket strapped to back
    ctx.fillStyle = '#c98f4a';
    ctx.beginPath();
    ctx.roundRect(-22, -14, 28, 18, 5);
    ctx.fill();

    ctx.fillStyle = '#e0b068';
    ctx.fillRect(-22, -14, 28, 4);

    // Straps
    ctx.strokeStyle = '#8a5e3e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-16, 4);
    ctx.lineTo(-8, 18);
    ctx.stroke();

    ctx.restore();
  }
}
