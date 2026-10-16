import { soundEngine } from '../soundEngine';
import { vfx } from '../vfxEngine';

interface CanyonObstacle {
  lane: number;
  z: number;
  size: number;
  isShard?: boolean;
  collected?: boolean;
}

export class CubeCanyonGame {
  private canvas!: HTMLCanvasElement;
  private onScoreUpdate!: (score: number, extra?: string) => void;

  public score = 0;
  public stage = 1;
  private elapsed = 0;
  private world = 0;
  private spawnTimer = 0;

  private lane = 0;
  private laneTarget = 0;
  private jump = 0;
  private jumpV = 0;

  private obstacles: CanyonObstacle[] = [];

  public init(canvas: HTMLCanvasElement, onScoreUpdate: (score: number, extra?: string) => void) {
    this.canvas = canvas;
    this.onScoreUpdate = onScoreUpdate;
    this.score = 0;
    this.stage = 1;
    this.elapsed = 0;
    this.world = 0;
    this.spawnTimer = 0;
    this.lane = 0;
    this.laneTarget = 0;
    this.jump = 0;
    this.jumpV = 0;
    this.obstacles = [];
    this.updateHUD();
  }

  private updateHUD() {
    this.onScoreUpdate(this.score, `STAGE ${this.stage} · DIST ${this.score}m`);
  }

  public update(dt: number, keys: Set<string>): { gameOver: boolean; won: boolean } {
    this.elapsed += dt;
    this.world += dt * (8 + this.stage * 1.2);
    this.spawnTimer += dt;

    const newStage = Math.min(10, 1 + Math.floor(this.elapsed / 20));
    if (newStage !== this.stage) {
      this.stage = newStage;
      soundEngine.play('stage');
      vfx.addText(400, 160, `STAGE ${this.stage}!`, '#83c6ad', 26);
    }

    // Lane controls
    if (keys.has('ArrowLeft') || keys.has('a')) {
      this.laneTarget = Math.max(-1, this.laneTarget - 3.2 * dt);
    }
    if (keys.has('ArrowRight') || keys.has('d')) {
      this.laneTarget = Math.min(1, this.laneTarget + 3.2 * dt);
    }
    this.lane += (this.laneTarget - this.lane) * Math.min(1, dt * 10);

    // Jump controls
    if ((keys.has(' ') || keys.has('ArrowUp') || keys.has('w')) && this.jump <= 0) {
      this.jumpV = 7.2;
      soundEngine.play('jump');
      vfx.burstDust(400 + this.lane * 110, 370, 5);
    }

    this.jumpV -= 19 * dt;
    this.jump += this.jumpV * dt;
    if (this.jump < 0) {
      this.jump = 0;
      this.jumpV = 0;
    }

    // Spawn obstacles and shards
    const spawnRate = Math.max(0.4, 0.72 - this.stage * 0.03);
    if (this.spawnTimer > spawnRate) {
      this.spawnTimer = 0;
      const targetLane = Math.floor(Math.random() * 3) - 1;
      const isShard = Math.random() < 0.35;

      this.obstacles.push({
        lane: targetLane,
        z: 1.0,
        size: isShard ? 0.08 : 0.12 + Math.random() * 0.06,
        isShard,
      });
    }

    // Update 3D objects
    const speed = 0.42 + this.stage * 0.035;
    for (const o of this.obstacles) {
      o.z -= dt * speed;

      // Interaction zone
      if (o.z < 0.22 && o.z > 0.06 && Math.abs(o.lane - this.lane) < 0.42) {
        if (o.isShard) {
          if (!o.collected) {
            o.collected = true;
            this.score += 25;
            soundEngine.play('coin', { combo: true });
            vfx.burstSparks(400 + this.lane * 110, 330 - this.jump * 55, 10, '#ffd166');
            vfx.addText(400 + this.lane * 110, 310 - this.jump * 55, '+25', '#ffd166', 16);
          }
        } else {
          // Obstacle hit unless jumping high enough
          if (this.jump < 0.65) {
            vfx.triggerShake(16, 0.4);
            soundEngine.play('hit');
            vfx.burstSparks(400 + this.lane * 110, 340, 20, '#e7a16d');
            return { gameOver: true, won: false };
          }
        }
      }
    }

    this.obstacles = this.obstacles.filter((o) => o.z > 0 && !o.collected);

    this.score += Math.floor(dt * 12);
    this.updateHUD();

    if (this.stage >= 10 && this.elapsed >= 200) {
      vfx.burstConfetti(800, 450, 60);
      return { gameOver: false, won: true };
    }

    return { gameOver: false, won: false };
  }

  private project(x: number, y: number, z: number) {
    const depth = Math.max(0.08, z);
    const scale = 1 / depth;
    return {
      x: 400 + x * scale * 240,
      y: 200 + y * scale * 170 + scale * 25,
      w: scale,
    };
  }

  private drawCube(ctx: CanvasRenderingContext2D, x: number, y: number, z: number, size: number, color: string) {
    const p = this.project(x, y, z);
    const s = size * p.w * 90;

    // Top face
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - s);
    ctx.lineTo(p.x + s, p.y - s * 0.72);
    ctx.lineTo(p.x, p.y - s * 0.45);
    ctx.lineTo(p.x - s, p.y - s * 0.72);
    ctx.closePath();
    ctx.fill();

    // Left face
    ctx.fillStyle = '#243f3b';
    ctx.beginPath();
    ctx.moveTo(p.x - s, p.y - s * 0.72);
    ctx.lineTo(p.x, p.y - s * 0.45);
    ctx.lineTo(p.x, p.y + s * 0.35);
    ctx.lineTo(p.x - s, p.y + s * 0.08);
    ctx.closePath();
    ctx.fill();

    // Right face
    ctx.fillStyle = '#3c7160';
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - s * 0.45);
    ctx.lineTo(p.x + s, p.y - s * 0.72);
    ctx.lineTo(p.x + s, p.y + s * 0.08);
    ctx.lineTo(p.x, p.y + s * 0.35);
    ctx.closePath();
    ctx.fill();
  }

  public render(ctx: CanvasRenderingContext2D) {
    const W = this.canvas.width;
    const H = this.canvas.height;

    // Sky
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#d8e8ee');
    sky.addColorStop(0.62, '#f1dfbd');
    sky.addColorStop(1, '#7a9e98');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    // Warm Sun
    ctx.fillStyle = '#f5ca77';
    ctx.beginPath();
    ctx.arc(645, 65, 30, 0, Math.PI * 2);
    ctx.fill();

    // Distant canyon backdrop
    ctx.fillStyle = '#a8c1c2';
    ctx.beginPath();
    ctx.moveTo(0, 205);
    ctx.lineTo(120, 95);
    ctx.lineTo(215, 190);
    ctx.lineTo(355, 75);
    ctx.lineTo(485, 195);
    ctx.lineTo(610, 100);
    ctx.lineTo(W, 205);
    ctx.lineTo(W, H);
    ctx.lineTo(0, H);
    ctx.closePath();
    ctx.fill();

    // Left canyon wall
    ctx.fillStyle = '#6e9690';
    ctx.beginPath();
    ctx.moveTo(0, 235);
    ctx.lineTo(220, 190);
    ctx.lineTo(310, H);
    ctx.lineTo(0, H);
    ctx.closePath();
    ctx.fill();

    // Right canyon wall
    ctx.beginPath();
    ctx.moveTo(W, 235);
    ctx.lineTo(580, 190);
    ctx.lineTo(490, H);
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fill();

    // Road floor
    ctx.fillStyle = '#c9d4c3';
    ctx.beginPath();
    ctx.moveTo(380, 165);
    ctx.lineTo(420, 165);
    ctx.lineTo(690, H);
    ctx.lineTo(110, H);
    ctx.closePath();
    ctx.fill();

    // Center divider dash
    ctx.strokeStyle = '#fff6d9';
    ctx.lineWidth = 3;
    ctx.setLineDash([14, 18]);
    ctx.beginPath();
    ctx.moveTo(400, 170);
    ctx.lineTo(400, H);
    ctx.stroke();
    ctx.setLineDash([]);

    // Grid depth lines
    for (let i = 0; i < 9; i++) {
      const z = (i / 9 + this.world * 0.11) % 1;
      const y = 170 + z * z * 280;
      const spread = 20 + z * 270;
      ctx.strokeStyle = `rgba(80, 112, 103, ${0.08 + z * 0.22})`;
      ctx.lineWidth = 1 + z * 2;
      ctx.beginPath();
      ctx.moveTo(400 - spread, y);
      ctx.lineTo(400 + spread, y);
      ctx.stroke();
    }

    // Sort objects by depth and render
    const sorted = [...this.obstacles].sort((a, b) => b.z - a.z);
    for (const o of sorted) {
      if (o.isShard) {
        // Glowing shard diamond
        const p = this.project(o.lane * 0.72, 0, o.z);
        const s = o.size * p.w * 80;
        ctx.fillStyle = '#ffd166';
        ctx.beginPath();
        ctx.moveTo(p.x, p.y - s * 1.5);
        ctx.lineTo(p.x + s, p.y);
        ctx.lineTo(p.x, p.y + s * 1.5);
        ctx.lineTo(p.x - s, p.y);
        ctx.closePath();
        ctx.fill();
      } else {
        this.drawCube(
          ctx,
          o.lane * 0.72,
          0,
          o.z,
          o.size,
          o.lane === 0 ? '#e7a16d' : '#5f9b8b'
        );
      }
    }

    // Player Capybara 3D runner
    const jump = this.jump * 55;
    const px = 400 + this.lane * 100;
    const py = 355 - jump;

    // Ground shadow
    ctx.fillStyle = 'rgba(44, 75, 64, 0.4)';
    ctx.beginPath();
    ctx.ellipse(px, 375, 24 * (1 - this.jump * 0.3), 8 * (1 - this.jump * 0.3), 0, 0, Math.PI * 2);
    ctx.fill();

    // Capybara body
    ctx.save();
    ctx.translate(px, py);

    // Body block
    ctx.fillStyle = '#b88155';
    ctx.beginPath();
    ctx.moveTo(-19, -10);
    ctx.lineTo(-12, -35);
    ctx.lineTo(10, -35);
    ctx.lineTo(20, -13);
    ctx.lineTo(14, 5);
    ctx.lineTo(-16, 5);
    ctx.closePath();
    ctx.fill();

    // Head block
    ctx.fillStyle = '#d7a477';
    ctx.beginPath();
    ctx.moveTo(-12, -35);
    ctx.lineTo(-7, -49);
    ctx.lineTo(7, -49);
    ctx.lineTo(13, -34);
    ctx.closePath();
    ctx.fill();

    // Ears
    ctx.fillStyle = '#9c6b48';
    ctx.beginPath();
    ctx.moveTo(-7, -47);
    ctx.lineTo(-12, -57);
    ctx.lineTo(-1, -51);
    ctx.fill();

    // Cute Yuzu orange on head
    ctx.fillStyle = '#f2a23a';
    ctx.beginPath();
    ctx.arc(0, -53, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#4f9a52';
    ctx.fillRect(1, -59, 2, 4);

    ctx.restore();
  }
}
