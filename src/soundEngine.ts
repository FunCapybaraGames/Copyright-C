/**
 * Sound Engine for Capybara Games
 * High-quality Web Audio API synthesizer with mastering compressor,
 * dynamic SFX synthesis, and procedural melodic background themes.
 */

class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;

  public soundEnabled: boolean = true;
  public musicEnabled: boolean = true;
  public sfxVolume: number = 0.8;
  public musicVolume: number = 0.5;

  private musicTimer: number | null = null;
  private currentMusicGame: string | null = null;
  private comboCount: number = 0;
  private lastComboTime: number = 0;

  private initAudio(): AudioContext | null {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      return this.ctx;
    }

    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return null;

    try {
      this.ctx = new AudioContextClass();

      // Master Compressor to prevent clipping
      this.compressor = this.ctx.createDynamicsCompressor();
      this.compressor.threshold.setValueAtTime(-18, this.ctx.currentTime);
      this.compressor.knee.setValueAtTime(12, this.ctx.currentTime);
      this.compressor.ratio.setValueAtTime(6, this.ctx.currentTime);
      this.compressor.attack.setValueAtTime(0.003, this.ctx.currentTime);
      this.compressor.release.setValueAtTime(0.2, this.ctx.currentTime);

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.9, this.ctx.currentTime);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.setValueAtTime(this.soundEnabled ? this.sfxVolume : 0, this.ctx.currentTime);

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.setValueAtTime(this.musicEnabled ? this.musicVolume : 0, this.ctx.currentTime);

      this.sfxGain.connect(this.compressor);
      this.musicGain.connect(this.compressor);
      this.compressor.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);

      return this.ctx;
    } catch {
      return null;
    }
  }

  public updateSettings(sound: boolean, music: boolean, sfxVol = 0.8, musVol = 0.5) {
    this.soundEnabled = sound;
    this.musicEnabled = music;
    this.sfxVolume = sfxVol;
    this.musicVolume = musVol;

    if (this.ctx) {
      const now = this.ctx.currentTime;
      if (this.sfxGain) {
        this.sfxGain.gain.setTargetAtTime(sound ? sfxVol : 0, now, 0.05);
      }
      if (this.musicGain) {
        this.musicGain.gain.setTargetAtTime(music ? musVol : 0, now, 0.05);
      }
    }

    if (!music && this.musicTimer) {
      this.stopMusic();
    } else if (music && !this.musicTimer && this.currentMusicGame) {
      this.startMusic(this.currentMusicGame);
    }
  }

  /**
   * Play clean synthesized tone with ADSR envelope
   */
  private playTone(
    freq: number,
    duration: number,
    type: OscillatorType = 'sine',
    volume = 0.1,
    targetFreq?: number,
    delay = 0
  ) {
    if (!this.soundEnabled) return;
    const ctx = this.initAudio();
    if (!ctx || !this.sfxGain) return;

    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (targetFreq) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(10, targetFreq), t + duration);
    }

    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(volume, t + Math.min(0.015, duration * 0.15));
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(t);
    osc.stop(t + duration + 0.05);
  }

  /**
   * Filtered noise burst for percussive hits and whooshes
   */
  private playNoise(duration: number, volume = 0.1, filterFreq = 1200, delay = 0) {
    if (!this.soundEnabled) return;
    const ctx = this.initAudio();
    if (!ctx || !this.sfxGain) return;

    const t = ctx.currentTime + delay;
    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 1.5);
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(filterFreq, t);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    source.start(t);
  }

  public play(name: string, opt?: { combo?: boolean; pitchOffset?: number }) {
    if (!this.soundEnabled) return;

    const now = performance.now();
    if (opt?.combo) {
      if (now - this.lastComboTime < 1400) {
        this.comboCount = Math.min(8, this.comboCount + 1);
      } else {
        this.comboCount = 0;
      }
      this.lastComboTime = now;
    }

    const comboMult = Math.pow(1.06, this.comboCount);

    switch (name) {
      case 'jump':
        this.playTone(200, 0.14, 'triangle', 0.12, 540);
        this.playTone(400, 0.1, 'sine', 0.05, 780, 0.02);
        break;

      case 'coin':
      case 'clover':
        // Glistening dual chime
        this.playTone(988 * comboMult, 0.08, 'sine', 0.09);
        this.playTone(1319 * comboMult, 0.18, 'triangle', 0.08, 0, 0.05);
        this.playTone(1975 * comboMult, 0.22, 'sine', 0.04, 0, 0.1);
        break;

      case 'hit':
        this.playNoise(0.28, 0.18, 800);
        this.playTone(180, 0.25, 'sawtooth', 0.14, 45);
        break;

      case 'win':
        // Fanfare chord progression
        [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => {
          this.playTone(f, 0.35, 'triangle', 0.08, 0, i * 0.09);
          this.playTone(f * 1.5, 0.35, 'sine', 0.03, 0, i * 0.09);
        });
        break;

      case 'stage':
        [587, 740, 880, 1175].forEach((f, i) => {
          this.playTone(f, 0.25, 'triangle', 0.08, 0, i * 0.08);
          this.playTone(f * 2, 0.25, 'sine', 0.03, 0, i * 0.08 + 0.04);
        });
        break;

      case 'flip':
        this.playTone(600 + Math.random() * 200, 0.04, 'sine', 0.06);
        this.playNoise(0.04, 0.05, 3500);
        break;

      case 'laser':
        this.playTone(850, 0.12, 'sawtooth', 0.08, 120);
        this.playNoise(0.06, 0.04, 4000);
        break;

      case 'explosion':
        this.playNoise(0.45, 0.22, 450);
        this.playTone(95, 0.45, 'triangle', 0.2, 30);
        break;

      case 'paddle':
        this.playTone(480 + (opt?.pitchOffset || 0), 0.09, 'sine', 0.12, 600);
        this.playNoise(0.04, 0.06, 2500);
        break;

      case 'brick': {
        const base = 440 * Math.pow(1.08, this.comboCount);
        this.playTone(base, 0.12, 'sine', 0.1);
        this.playTone(base * 1.5, 0.14, 'triangle', 0.06, 0, 0.02);
        this.playNoise(0.05, 0.04, 3000);
        break;
      }

      case 'hatch':
        [523, 659, 784, 1047, 1319].forEach((f, i) => {
          this.playTone(f, 0.3, 'sine', 0.08, 0, i * 0.07);
        });
        break;

      case 'cash':
        this.playTone(1319, 0.08, 'square', 0.04);
        this.playTone(1760, 0.2, 'square', 0.04, 0, 0.06);
        break;

      case 'honey':
        this.playTone(320 + Math.random() * 120, 0.08, 'sine', 0.08, 540);
        break;

      case 'click':
        this.playTone(700, 0.03, 'sine', 0.05, 900);
        break;

      case 'buzz': {
        // Cute FM vibrato bee buzzing sound
        const ctx = this.initAudio();
        if (ctx && this.sfxGain && this.soundEnabled) {
          const t = ctx.currentTime;
          const osc = ctx.createOscillator();
          const mod = ctx.createOscillator();
          const modGain = ctx.createGain();
          const gain = ctx.createGain();

          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(240, t);
          mod.type = 'sine';
          mod.frequency.setValueAtTime(45, t);
          modGain.gain.setValueAtTime(60, t);

          mod.connect(osc.frequency);
          gain.gain.setValueAtTime(0.001, t);
          gain.gain.linearRampToValueAtTime(0.06, t + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);

          osc.connect(gain);
          gain.connect(this.sfxGain);

          mod.start(t);
          osc.start(t);
          mod.stop(t + 0.18);
          osc.stop(t + 0.18);
        }
        break;
      }

      case 'scoop':
      case 'swoosh':
        this.playNoise(0.12, 0.09, 2200);
        this.playTone(420, 0.1, 'sine', 0.04, 180);
        break;

      case 'sting':
        this.playTone(880, 0.08, 'triangle', 0.14, 220);
        this.playNoise(0.08, 0.1, 4500);
        break;

      case 'sprinkler':
        this.playNoise(0.08, 0.07, 3600);
        this.playTone(720, 0.06, 'sine', 0.03, 980);
        break;

      case 'quest':
        [523.25, 659.25, 783.99, 1046.5, 1318.5, 1567.98].forEach((f, i) => {
          this.playTone(f, 0.28, 'triangle', 0.08, 0, i * 0.06);
          this.playTone(f * 1.5, 0.28, 'sine', 0.03, 0, i * 0.06);
        });
        break;

      case 'tick':
        this.playTone(1050 + Math.random() * 150, 0.025, 'triangle', 0.03);
        break;

      case 'talk':
        for (let i = 0; i < 3; i++) {
          this.playTone(280 + Math.random() * 180, 0.05, 'triangle', 0.03, 0, i * 0.06);
        }
        break;

      default:
        this.playTone(550, 0.05, 'sine', 0.05);
    }
  }

  /**
   * Procedural background music generator tailored to game identity
   */
  public startMusic(gameName: string) {
    this.stopMusic();
    this.currentMusicGame = gameName;
    if (!this.musicEnabled) return;

    const ctx = this.initAudio();
    if (!ctx || !this.musicGain) return;

    // Seeded scale based on game name
    let hash = 0;
    for (const ch of gameName) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;

    const MELODIES = [
      // Cozy Pentatonic (Capy Hop, Bee Swarm, Pond Snake)
      [0, 2, 4, 7, 9, 7, 4, 2, 0, 4, 7, 9, 12, 9, 7, 4],
      // Synthwave / Arcade (Neon Dodge, Capy Blaster)
      [0, 3, 7, 10, 7, 3, 5, 8, 12, 8, 5, 3, 0, 3, 7, 10],
      // Playful Casual (Snack Catch, Capy Pong)
      [0, 4, 7, 9, 7, 4, 2, 4, 7, 11, 9, 7, 4, 2, 0, 2],
      // Chill Lofi (Pocket Garden, Cube Canyon)
      [0, 2, 5, 7, 9, 7, 5, 2, 0, 5, 9, 12, 9, 7, 5, 2],
    ];

    const melody = MELODIES[hash % MELODIES.length];
    const rootNotes = [196, 220, 261.63, 293.66, 329.63]; // G3, A3, C4, D4, E4
    const root = rootNotes[hash % rootNotes.length];
    const tempos = [112, 120, 100, 128];
    const tempo = tempos[(hash >> 2) % tempos.length];
    const stepSec = 60 / tempo / 2; // eighth notes

    let stepIndex = 0;

    this.musicTimer = window.setInterval(() => {
      if (!this.musicEnabled || !this.ctx || !this.musicGain) return;
      const now = this.ctx.currentTime;
      const s = stepIndex % 16;
      stepIndex++;

      // Lead voice
      const semitone = melody[s];
      const leadFreq = root * Math.pow(2, semitone / 12);
      const leadOsc = this.ctx.createOscillator();
      const leadGain = this.ctx.createGain();

      leadOsc.type = (hash % 2 === 0) ? 'triangle' : 'sine';
      leadOsc.frequency.setValueAtTime(leadFreq, now);

      leadGain.gain.setValueAtTime(0.0001, now);
      leadGain.gain.linearRampToValueAtTime(0.035, now + 0.02);
      leadGain.gain.exponentialRampToValueAtTime(0.0001, now + stepSec * 0.85);

      leadOsc.connect(leadGain);
      leadGain.connect(this.musicGain);

      leadOsc.start(now);
      leadOsc.stop(now + stepSec * 0.9);

      // Bass voice on beats 0, 4, 8, 12
      if (s % 4 === 0) {
        const bassFreq = (root / 2) * Math.pow(2, [0, 5, 7, 3][(s / 4) % 4] / 12);
        const bassOsc = this.ctx.createOscillator();
        const bassGain = this.ctx.createGain();

        bassOsc.type = 'sine';
        bassOsc.frequency.setValueAtTime(bassFreq, now);

        bassGain.gain.setValueAtTime(0.0001, now);
        bassGain.gain.linearRampToValueAtTime(0.06, now + 0.03);
        bassGain.gain.exponentialRampToValueAtTime(0.0001, now + stepSec * 3.4);

        bassOsc.connect(bassGain);
        bassGain.connect(this.musicGain);

        bassOsc.start(now);
        bassOsc.stop(now + stepSec * 3.6);
      }
    }, stepSec * 1000);
  }

  public stopMusic() {
    if (this.musicTimer) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }
}

export const soundEngine = new SoundEngine();
