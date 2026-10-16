import { soundEngine } from '../soundEngine';
import { vfx } from '../vfxEngine';

export class PondSnakeGame {
  private canvas!: HTMLCanvasElement;
  private onScoreUpdate!: (score: number, extra?: string) => void;

  public score = 0;
  public stage = 1;

  private body: Array<[number, number]> = [
    [20, 11],
    [19, 11],
    [18, 11],
  ];
  private dir: [number, number] = [1, 0];
  private nextDir: [number, number] | null = null;
  private food: [number, number] = [10, 10];
  private moveTimer = 0;
  private eaten = 0;

  public init(canvas: HTMLCanvasElement, onScoreUpdate: (score: number, extra?: string) => void) {
    this.canvas = canvas;
    this.onScoreUpdate = onScoreUpdate;
    this.score = 0;
    this.stage = 1;
    this.eaten = 0;
    this.body = [
      [20, 11],
      [19, 11],
      [18, 11],
    ];
    this.dir = [1, 0];
    this.nextDir = null;
    this.moveTimer = 0;
    this.placeFood();
    this.updateHUD();
  }

  private placeFood() {
    do {
      this.food = [
        Math.floor(Math.random() * 40),
        Math.floor(Math.random() * 22),
      ];
    } while (this.body.some((b) => b[0] === this.food[0] && b[1] === this.food[1]));
  }

  private updateHUD() {
    this.onScoreUpdate(this.score, `STAGE ${this.stage}/10 · SPEED ${Math.round(100 / Math.max(0.06, 0.17 - this.stage * 0.011))}%`);
  }

  public update(dt: number, keys: Set<string>): { gameOver: boolean; won: boolean } {
    const d = this.dir;

    if ((keys.has('w') || keys.has('ArrowUp')) && d[1] === 0) {
      this.nextDir = [0, -1];
    } else if ((keys.has('s') || keys.has('ArrowDown')) && d[1] === 0) {
      this.nextDir = [0, 1];
    } else if ((keys.has('a') || keys.has('ArrowLeft')) && d[0] === 0) {
      this.nextDir = [-1, 0];
    } else if ((keys.has('d') || keys.has('ArrowRight')) && d[0] === 0) {
      this.nextDir = [1, 0];
    }

    this.moveTimer += dt;
    const stepDuration = Math.max(0.055, 0.165 - this.stage * 0.011);

    if (this.moveTimer < stepDuration) {
      return { gameOver: false, won: false };
    }
    this.moveTimer = 0;

    if (this.nextDir) {
      this.dir = this.nextDir;
      this.nextDir = null;
    }

    const head: [number, number] = [
      this.body[0][0] + this.dir[0],
      this.body[0][1] + this.dir[1],
    ];

    // Wall collision
    if (head[0] < 0 || head[1] < 0 || head[0] >= 40 || head[1] >= 22) {
      vfx.triggerShake(14, 0.35);
      soundEngine.play('hit');
      vfx.burstSparks(head[0] * 20, head[1] * 20 + 10, 15, '#2f7d52');
      return { gameOver: true, won: false };
    }

    // Self collision
    if (this.body.some((b) => b[0] === head[0] && b[1] === head[1])) {
      vfx.triggerShake(14, 0.35);
      soundEngine.play('hit');
      vfx.burstSparks(head[0] * 20, head[1] * 20 + 10, 15, '#2f7d52');
      return { gameOver: true, won: false };
    }

    this.body.unshift(head);

    // Food collision
    if (head[0] === this.food[0] && head[1] === this.food[1]) {
      this.eaten++;
      this.score = this.eaten * 10;
      soundEngine.play('clover', { combo: true });
      vfx.burstSparks(head[0] * 20 + 10, head[1] * 20 + 15, 10, '#10b981');
      vfx.addText(head[0] * 20 + 10, head[1] * 20, '+10', '#10b981', 15);
      this.placeFood();

      // Stage progression every 5 clovers
      const newStage = Math.min(10, 1 + Math.floor(this.eaten / 5));
      if (newStage !== this.stage) {
        this.stage = newStage;
        soundEngine.play('stage');
        vfx.addText(400, 200, `POND SPEED ${this.stage}!`, '#7ef0df', 26);
      }
      this.updateHUD();
    } else {
      this.body.pop();
    }

    if (this.stage >= 10 && this.eaten >= 50) {
      vfx.burstConfetti(800, 450, 70);
      return { gameOver: false, won: true };
    }

    return { gameOver: false, won: false };
  }

  public render(ctx: CanvasRenderingContext2D) {
    // Checkerboard lily pond tiles
    for (let y = 0; y < 22; y++) {
      for (let x = 0; x < 40; x++) {
        ctx.fillStyle = (x + y) % 2 === 0 ? '#98cfb0' : '#8bc4a3';
        ctx.fillRect(x * 20, y * 20 + 5, 20, 20);
      }
    }

    // Header
    ctx.fillStyle = '#1b4a35';
    ctx.font = 'bold 16px Manrope, system-ui';
    ctx.fillText('POND SNAKE', 20, 36);
    ctx.font = '12px system-ui';
    ctx.fillStyle = '#396d55';
    ctx.fillText(`Stage ${this.stage} of 10 · Steer smoothly, eat clovers`, 20, 54);

    // Food Clover 🍀
    ctx.font = '18px system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🍀', this.food[0] * 20 + 10, this.food[1] * 20 + 15);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';

    // Snake Body
    this.body.forEach((b, i) => {
      ctx.fillStyle = `hsl(${145 - Math.min(i, 25)}, 50%, ${32 + Math.min(i, 20) * 0.7}%)`;
      ctx.beginPath();
      ctx.roundRect(b[0] * 20 + 1, b[1] * 20 + 6, 18, 18, i === 0 ? 8 : 5);
      ctx.fill();
    });

    // Snake Eyes on head
    const head = this.body[0];
    const eyeOffsetX = this.dir[1] !== 0 ? 4 : 0;
    const eyeOffsetY = this.dir[0] !== 0 ? 4 : 0;
    const eyeForwardX = this.dir[0] * 3;
    const eyeForwardY = this.dir[1] * 3;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(head[0] * 20 + 6 + eyeForwardX - eyeOffsetX, head[1] * 20 + 11 + eyeForwardY - eyeOffsetY, 3, 3);
    ctx.fillRect(head[0] * 20 + 11 + eyeForwardX + eyeOffsetX, head[1] * 20 + 11 + eyeForwardY + eyeOffsetY, 3, 3);
  }
}
