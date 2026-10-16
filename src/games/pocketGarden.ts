import { soundEngine } from '../soundEngine';
import { vfx } from '../vfxEngine';

interface Card {
  symbol: string;
  x: number;
  y: number;
  w: number;
  h: number;
  isUp: boolean;
  isMatched: boolean;
  flipProgress: number; // 0 to 1
}

const GARDEN_LAYOUTS = [
  [2, 2],
  [4, 2],
  [4, 3],
  [4, 4],
  [5, 4],
  [6, 4],
  [6, 4],
  [6, 4],
  [6, 4],
  [6, 4],
];

const FLORA_SYMBOLS = ['🌱', '🌷', '🍄', '🐞', '🍓', '🌻', '🦋', '🍀', '🍉', '🐝', '🌵', '🍒'];

export class PocketGardenGame {
  private canvas!: HTMLCanvasElement;
  private onScoreUpdate!: (score: number, extra?: string) => void;

  public score = 0;
  public moves = 0;
  public stage = 1;
  public maxStages = GARDEN_LAYOUTS.length;

  private cards: Card[] = [];
  private flipped: Card[] = [];
  private lockTimer = 0;

  public init(canvas: HTMLCanvasElement, onScoreUpdate: (score: number, extra?: string) => void) {
    this.canvas = canvas;
    this.onScoreUpdate = onScoreUpdate;
    this.score = 0;
    this.moves = 0;
    this.stage = 1;
    this.loadStage(1);
  }

  private loadStage(stageNum: number) {
    this.stage = stageNum;
    const [cols, rows] = GARDEN_LAYOUTS[stageNum - 1];
    const totalPairs = (cols * rows) / 2;

    const deck: string[] = [];
    for (let i = 0; i < totalPairs; i++) {
      const sym = FLORA_SYMBOLS[i % FLORA_SYMBOLS.length];
      deck.push(sym, sym);
    }

    // Shuffle
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }

    const gap = 12;
    const cardW = Math.min(105, Math.floor((720 - (cols - 1) * gap) / cols));
    const cardH = rows > 3 ? 66 : 74;
    const totalW = cols * cardW + (cols - 1) * gap;
    const totalH = rows * cardH + (rows - 1) * gap;
    const startX = (this.canvas.width - totalW) / 2;
    const startY = (this.canvas.height - totalH) / 2 + 15;

    this.cards = deck.map((symbol, i) => {
      const c = i % cols;
      const r = Math.floor(i / cols);
      return {
        symbol,
        x: startX + c * (cardW + gap),
        y: startY + r * (cardH + gap),
        w: cardW,
        h: cardH,
        isUp: false,
        isMatched: false,
        flipProgress: 0,
      };
    });

    this.flipped = [];
    this.lockTimer = 0;
    this.updateHUD();
  }

  private updateHUD() {
    this.onScoreUpdate(this.score, `STAGE ${this.stage}/${this.maxStages} · MOVES ${this.moves}`);
  }

  public onPointerDown(e: PointerEvent, canvas: HTMLCanvasElement) {
    if (this.lockTimer > 0) return;

    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((e.clientY - rect.top) / rect.height) * canvas.height;

    const clicked = this.cards.find(
      (c) => !c.isUp && !c.isMatched && x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h
    );

    if (!clicked) return;

    clicked.isUp = true;
    this.flipped.push(clicked);
    soundEngine.play('flip');

    if (this.flipped.length === 2) {
      this.moves++;
      const [c1, c2] = this.flipped;
      if (c1.symbol === c2.symbol) {
        c1.isMatched = true;
        c2.isMatched = true;
        this.score++;
        this.flipped = [];
        soundEngine.play('coin', { combo: true });
        vfx.burstSparks(c1.x + c1.w / 2, c1.y + c1.h / 2, 8, '#70b982');
        vfx.burstSparks(c2.x + c2.w / 2, c2.y + c2.h / 2, 8, '#70b982');
        vfx.addText(c1.x + c1.w / 2, c1.y, 'MATCH!', '#70b982', 16);
      } else {
        this.lockTimer = 0.65;
      }
      this.updateHUD();
    }
  }

  public update(dt: number, _keys: Set<string>): { gameOver: boolean; won: boolean } {
    // Handle mismatched card flip-back
    if (this.lockTimer > 0) {
      this.lockTimer -= dt;
      if (this.lockTimer <= 0) {
        for (const c of this.flipped) {
          c.isUp = false;
        }
        this.flipped = [];
      }
    }

    // Check stage clear
    if (this.cards.length > 0 && this.cards.every((c) => c.isMatched)) {
      if (this.stage < this.maxStages) {
        this.stage++;
        soundEngine.play('stage');
        vfx.burstConfetti(800, 450, 40);
        vfx.addText(400, 200, `GARDEN STAGE ${this.stage}!`, '#3f8a60', 26);
        this.loadStage(this.stage);
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

    // Cozy botanical background gradient
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#f7f0e3');
    bg.addColorStop(1, '#d5e7cb');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Subtle background plant outlines
    ctx.fillStyle = 'rgba(78, 140, 95, 0.08)';
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      ctx.arc(60 + i * 140, 50 + (i % 2) * 320, 60, 0, Math.PI * 2);
      ctx.fill();
    }

    // Header info
    ctx.fillStyle = '#265438';
    ctx.font = 'bold 16px Manrope, system-ui';
    ctx.fillText('POCKET GARDEN', 28, 38);
    ctx.font = '12px system-ui';
    ctx.fillStyle = '#567a64';
    ctx.fillText(`Stage ${this.stage} of ${this.maxStages} · Find the matching pairs`, 28, 56);

    // Cards
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (const c of this.cards) {
      // Drop shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
      ctx.beginPath();
      ctx.roundRect(c.x, c.y + 4, c.w, c.h, 10);
      ctx.fill();

      // Card face
      if (c.isMatched) {
        ctx.fillStyle = '#d9efd2';
        ctx.strokeStyle = '#8bc59b';
      } else if (c.isUp) {
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#d7e4d3';
      } else {
        ctx.fillStyle = '#3f8a60';
        ctx.strokeStyle = '#2d6d48';
      }

      ctx.beginPath();
      ctx.roundRect(c.x, c.y, c.w, c.h, 10);
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.stroke();

      if (c.isUp || c.isMatched) {
        ctx.font = '32px system-ui';
        ctx.fillText(c.symbol, c.x + c.w / 2, c.y + c.h / 2 + 2);
      } else {
        // Back of card pattern
        ctx.fillStyle = '#c5e2cb';
        ctx.font = 'bold 18px Manrope, system-ui';
        ctx.fillText('c.', c.x + c.w / 2, c.y + c.h / 2);
      }
    }

    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }
}
