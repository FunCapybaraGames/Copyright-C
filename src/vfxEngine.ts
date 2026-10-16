/**
 * Visual Effects (VFX) Engine for Capybara Games
 * Handles in-canvas particle simulation, screen shake, floating text, and DOM UI bursts.
 */

import { Particle, FloatingText } from './types';

export class VfxEngine {
  public enabled: boolean = true;
  public reduceMotion: boolean = false;

  public particles: Particle[] = [];
  public floatingTexts: FloatingText[] = [];
  public shakeIntensity: number = 0;
  public shakeDuration: number = 0;
  private nextTextId: number = 1;

  public update(dt: number) {
    if (this.shakeDuration > 0) {
      this.shakeDuration -= dt;
      if (this.shakeDuration <= 0) {
        this.shakeIntensity = 0;
      }
    }

    if (!this.enabled || this.reduceMotion) {
      this.particles.length = 0;
      this.floatingTexts.length = 0;
      return;
    }

    // Update particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }

      if (p.gravity) p.vy += p.gravity * dt;
      if (p.drag) {
        p.vx *= Math.pow(p.drag, dt * 60);
        p.vy *= Math.pow(p.drag, dt * 60);
      }

      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }

    // Limit maximum particles for smooth 60fps
    if (this.particles.length > 500) {
      this.particles.splice(0, this.particles.length - 500);
    }

    // Update floating texts
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.life -= dt;
      if (ft.life <= 0) {
        this.floatingTexts.splice(i, 1);
        continue;
      }
      ft.y += ft.vy * dt;
    }
  }

  public render(ctx: CanvasRenderingContext2D) {
    if (!this.enabled || this.reduceMotion) return;

    ctx.save();

    // Render particles
    for (const p of this.particles) {
      const progress = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = (p.alpha ?? 1) * progress;
      ctx.fillStyle = p.color;

      const size = p.size * (0.3 + 0.7 * progress);

      if (p.shape === 'ring') {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, size * 2.5 * (1.2 - progress), 0, Math.PI * 2);
        ctx.stroke();
      } else if (p.shape === 'circle') {
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(1, size / 2), 0, Math.PI * 2);
        ctx.fill();
      } else if (p.shape === 'star') {
        // Draw 4-point star
        ctx.beginPath();
        ctx.moveTo(p.x, p.y - size);
        ctx.lineTo(p.x + size * 0.3, p.y - size * 0.3);
        ctx.lineTo(p.x + size, p.y);
        ctx.lineTo(p.x + size * 0.3, p.y + size * 0.3);
        ctx.lineTo(p.x, p.y + size);
        ctx.lineTo(p.x - size * 0.3, p.y + size * 0.3);
        ctx.lineTo(p.x - size, p.y);
        ctx.lineTo(p.x - size * 0.3, p.y - size * 0.3);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.fillRect(p.x - size / 2, p.y - size / 2, size, size);
      }
    }

    // Render floating pop text
    for (const ft of this.floatingTexts) {
      const progress = ft.life / ft.maxLife;
      ctx.globalAlpha = Math.min(1, progress * 1.5);
      ctx.fillStyle = ft.color;
      ctx.font = `bold ${ft.size}px Manrope, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Subtle drop shadow
      ctx.shadowColor = 'rgba(0,0,0,0.4)';
      ctx.shadowBlur = 4;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 2;

      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.shadowBlur = 0;
    }

    ctx.restore();
  }

  public triggerShake(intensity = 8, duration = 0.25) {
    if (this.reduceMotion) return;
    this.shakeIntensity = intensity;
    this.shakeDuration = duration;
  }

  public getShakeOffset(): { x: number; y: number } {
    if (this.shakeIntensity <= 0 || this.reduceMotion) return { x: 0, y: 0 };
    return {
      x: (Math.random() - 0.5) * this.shakeIntensity * 2,
      y: (Math.random() - 0.5) * this.shakeIntensity * 2,
    };
  }

  public addText(x: number, y: number, text: string, color = '#ffd166', size = 18) {
    if (this.reduceMotion) return;
    this.floatingTexts.push({
      id: this.nextTextId++,
      x,
      y,
      text,
      color,
      size,
      life: 0.8,
      maxLife: 0.8,
      vy: -55,
    });
  }

  public burstSparks(x: number, y: number, count = 12, baseColor?: string) {
    if (!this.enabled || this.reduceMotion) return;
    const colors = baseColor ? [baseColor] : ['#ffd166', '#06d6a0', '#118ab2', '#ff85b2', '#ffffff'];

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 70 + Math.random() * 220;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 40,
        life: 0.4 + Math.random() * 0.4,
        maxLife: 0.8,
        size: 3 + Math.random() * 4,
        color: colors[i % colors.length],
        shape: Math.random() > 0.5 ? 'star' : 'circle',
        gravity: 350,
        drag: 0.94,
      });
    }
  }

  public burstDust(x: number, y: number, count = 6) {
    if (!this.enabled || this.reduceMotion) return;
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: x + (Math.random() - 0.5) * 16,
        y: y + (Math.random() - 0.5) * 6,
        vx: (Math.random() - 0.5) * 60,
        vy: -15 - Math.random() * 45,
        life: 0.35 + Math.random() * 0.25,
        maxLife: 0.6,
        size: 6 + Math.random() * 6,
        color: '#e5eae1',
        shape: 'circle',
        alpha: 0.6,
        gravity: 20,
        drag: 0.92,
      });
    }
  }

  public burstShockwave(x: number, y: number, color = '#7ef0df') {
    if (!this.enabled || this.reduceMotion) return;
    this.particles.push({
      x,
      y,
      vx: 0,
      vy: 0,
      life: 0.3,
      maxLife: 0.3,
      size: 14,
      color,
      shape: 'ring',
    });
  }

  public burstConfetti(width = 800, height = 450, count = 70) {
    if (!this.enabled || this.reduceMotion) return;
    const colors = ['#286c4b', '#f5c86d', '#ff85b2', '#7ef0df', '#3b82f6', '#ec4899'];
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: Math.random() * width,
        y: -10 - Math.random() * 40,
        vx: (Math.random() - 0.5) * 120,
        vy: 120 + Math.random() * 220,
        life: 1.5 + Math.random() * 1.5,
        maxLife: 3.0,
        size: 5 + Math.random() * 6,
        color: colors[i % colors.length],
        shape: 'square',
        drag: 0.98,
      });
    }
  }

  public clear() {
    this.particles.length = 0;
    this.floatingTexts.length = 0;
    this.shakeIntensity = 0;
    this.shakeDuration = 0;
  }
}

export const vfx = new VfxEngine();

/**
 * Trigger DOM-level micro particles on click or achievement
 */
export function spawnDomBurst(x: number, y: number, count = 12) {
  if (vfx.reduceMotion || !vfx.enabled) return;
  const colors = ['#286c4b', '#e8c56b', '#8ed0a1', '#d7e8c7', '#ff85b2'];
  for (let i = 0; i < count; i++) {
    const el = document.createElement('span');
    el.className = 'dom-burst-particle';
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    const dx = (Math.random() - 0.5) * 140;
    const dy = (Math.random() - 0.7) * 120;
    el.style.setProperty('--dx', `${dx}px`);
    el.style.setProperty('--dy', `${dy}px`);
    el.style.background = colors[i % colors.length];
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 750);
  }
}
