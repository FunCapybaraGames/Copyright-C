import { soundEngine } from '../soundEngine';
import { vfx } from '../vfxEngine';

interface Island {
  x: number;
  y: number;
  radius: number;
  name: string;
  hasRelic: boolean;
  relicFound: boolean;
}

export class IslandExpeditionGame {
  private canvas!: HTMLCanvasElement;
  private onScoreUpdate!: (score: number, extra?: string) => void;

  public score = 0;
  public relics = 0;
  public fishCount = 0;

  private boat = {
    x: 400,
    y: 225,
    angle: 0,
    speed: 0,
    maxSpeed: 180,
    isDocked: false,
  };

  private islands: Island[] = [
    { x: 220, y: 150, radius: 95, name: 'Palm Isle', hasRelic: true, relicFound: false },
    { x: 580, y: 140, radius: 90, name: 'Shell Beach', hasRelic: true, relicFound: false },
    { x: 250, y: 350, radius: 85, name: 'Pirate Cove', hasRelic: true, relicFound: false },
    { x: 620, y: 340, radius: 100, name: 'Sunken Relic Atoll', hasRelic: true, relicFound: false },
  ];

  private whirlpools: Array<{ x: number; y: number; r: number }> = [
    { x: 400, y: 225, r: 40 },
    { x: 420, y: 110, r: 35 },
  ];

  private time = 0;
  private fishingTimer = 0;

  public init(canvas: HTMLCanvasElement, onScoreUpdate: (score: number, extra?: string) => void) {
    this.canvas = canvas;
    this.onScoreUpdate = onScoreUpdate;
    this.score = 0;
    this.relics = 0;
    this.fishCount = 0;
    this.boat = {
      x: 400,
      y: 270,
      angle: -Math.PI / 2,
      speed: 0,
      maxSpeed: 180,
      isDocked: false,
    };
    this.updateHUD();
  }

  private updateHUD() {
    this.onScoreUpdate(
      this.score,
      `RELICS ${this.relics}/4 · FISH ${this.fishCount}`
    );
  }

  public update(dt: number, keys: Set<string>): { gameOver: boolean; won: boolean } {
    this.time += dt;

    // Boat steering & propulsion
    let turning = 0;
    if (keys.has('a') || keys.has('ArrowLeft')) turning -= 1;
    if (keys.has('d') || keys.has('ArrowRight')) turning += 1;

    let throttle = 0;
    if (keys.has('w') || keys.has('ArrowUp')) throttle += 1;
    if (keys.has('s') || keys.has('ArrowDown')) throttle -= 0.6;

    this.boat.angle += turning * 2.5 * dt;

    if (throttle > 0) {
      this.boat.speed = Math.min(this.boat.maxSpeed, this.boat.speed + 120 * dt);
    } else if (throttle < 0) {
      this.boat.speed = Math.max(-50, this.boat.speed - 90 * dt);
    } else {
      this.boat.speed *= Math.pow(0.92, dt * 60); // water drag
    }

    this.boat.x += Math.cos(this.boat.angle) * this.boat.speed * dt;
    this.boat.y += Math.sin(this.boat.angle) * this.boat.speed * dt;

    // Boundaries
    this.boat.x = Math.max(30, Math.min(this.canvas.width - 30, this.boat.x));
    this.boat.y = Math.max(30, Math.min(this.canvas.height - 30, this.boat.y));

    // Water wake particles behind boat
    if (Math.abs(this.boat.speed) > 40 && Math.random() < 0.4) {
      const wakeX = this.boat.x - Math.cos(this.boat.angle) * 18;
      const wakeY = this.boat.y - Math.sin(this.boat.angle) * 18;
      vfx.burstSparks(wakeX, wakeY, 1, '#e0f2fe');
    }

    // Fishing on open ocean with Spacebar
    if (keys.has(' ') && this.fishingTimer <= 0) {
      this.fishingTimer = 1.2;
      const nearIsland = this.islands.some(
        (isl) => Math.hypot(this.boat.x - isl.x, this.boat.y - isl.y) < isl.radius + 20
      );

      if (!nearIsland) {
        this.fishCount++;
        this.score += 25;
        soundEngine.play('coin', { combo: true });
        vfx.burstSparks(this.boat.x, this.boat.y, 8, '#38bdf8');
        vfx.addText(this.boat.x, this.boat.y - 20, 'CAUGHT TROPICAL FISH! 🐟', '#38bdf8', 15);
        this.updateHUD();
      }
    }
    this.fishingTimer -= dt;

    // Check Island docking & relics
    for (const isl of this.islands) {
      if (Math.hypot(this.boat.x - isl.x, this.boat.y - isl.y) < isl.radius) {
        // Soft beach bump
        this.boat.speed *= 0.5;

        if (isl.hasRelic && !isl.relicFound) {
          isl.relicFound = true;
          this.relics++;
          this.score += 200;
          soundEngine.play('win');
          vfx.burstConfetti(800, 450, 40);
          vfx.addText(this.boat.x, this.boat.y - 30, `FOUND ${isl.name.toUpperCase()} RELIC! 🏆`, '#ffd166', 18);
          this.updateHUD();
        }
      }
    }

    // Whirlpool pull & danger
    for (const wp of this.whirlpools) {
      const dist = Math.hypot(this.boat.x - wp.x, this.boat.y - wp.y);
      if (dist < wp.r) {
        // Pulled toward whirlpool center
        this.boat.x += (wp.x - this.boat.x) * 1.5 * dt;
        this.boat.y += (wp.y - this.boat.y) * 1.5 * dt;
        this.boat.angle += 3.5 * dt;

        if (dist < 12) {
          vfx.triggerShake(16, 0.4);
          soundEngine.play('hit');
          return { gameOver: true, won: false };
        }
      }
    }

    if (this.relics >= 4) {
      vfx.burstConfetti(800, 450, 80);
      return { gameOver: false, won: true };
    }

    return { gameOver: false, won: false };
  }

  public render(ctx: CanvasRenderingContext2D) {
    const W = this.canvas.width;
    const H = this.canvas.height;

    // Tropical turquoise ocean
    const sea = ctx.createLinearGradient(0, 0, 0, H);
    sea.addColorStop(0, '#0284c7');
    sea.addColorStop(1, '#0369a1');
    ctx.fillStyle = sea;
    ctx.fillRect(0, 0, W, H);

    // Ocean wave ripples
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 8; i++) {
      const waveY = (i * 60 + this.time * 12) % H;
      ctx.beginPath();
      ctx.moveTo(0, waveY);
      ctx.bezierCurveTo(W * 0.3, waveY + 8, W * 0.7, waveY - 8, W, waveY);
      ctx.stroke();
    }

    // Whirlpools
    for (const wp of this.whirlpools) {
      ctx.save();
      ctx.translate(wp.x, wp.y);
      ctx.rotate(this.time * 4);
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, wp.r * 0.8, 0, Math.PI * 1.5);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, wp.r * 0.4, 0, Math.PI);
      ctx.stroke();
      ctx.restore();
    }

    // Islands
    for (const isl of this.islands) {
      // Shallow water sand shoal
      ctx.fillStyle = 'rgba(254, 243, 199, 0.35)';
      ctx.beginPath();
      ctx.arc(isl.x, isl.y, isl.radius + 14, 0, Math.PI * 2);
      ctx.fill();

      // Sandy beach
      ctx.fillStyle = '#fde68a';
      ctx.beginPath();
      ctx.arc(isl.x, isl.y, isl.radius, 0, Math.PI * 2);
      ctx.fill();

      // Lush palm vegetation center
      ctx.fillStyle = '#16a34a';
      ctx.beginPath();
      ctx.arc(isl.x, isl.y, isl.radius * 0.65, 0, Math.PI * 2);
      ctx.fill();

      // Island name
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 11px Manrope, system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(isl.name, isl.x, isl.y + 4);

      // Relic icon
      if (isl.hasRelic) {
        ctx.font = '16px system-ui';
        ctx.fillText(isl.relicFound ? '✅' : '🏆', isl.x, isl.y - 15);
      }
    }

    // Sailboat
    ctx.save();
    ctx.translate(this.boat.x, this.boat.y);
    ctx.rotate(this.boat.angle);

    // Boat hull
    ctx.fillStyle = '#92400e';
    ctx.beginPath();
    ctx.moveTo(18, 0);
    ctx.lineTo(-14, -9);
    ctx.lineTo(-18, 0);
    ctx.lineTo(-14, 9);
    ctx.closePath();
    ctx.fill();

    // Wooden deck
    ctx.fillStyle = '#b45309';
    ctx.fillRect(-12, -6, 24, 12);

    // White canvas sail
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(8, -14);
    ctx.lineTo(-6, -12);
    ctx.closePath();
    ctx.fill();

    // Capybara captain
    ctx.fillStyle = '#ba895e';
    ctx.beginPath();
    ctx.arc(-2, 0, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}
