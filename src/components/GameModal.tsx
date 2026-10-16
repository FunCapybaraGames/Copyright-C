import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GameMetadata, BeeSaveData, UserAccount, Friend, GameRoom, DifficultyMode } from '../types';
import { soundEngine } from '../soundEngine';
import { vfx, spawnDomBurst } from '../vfxEngine';
import { CapyHopGame } from '../games/capyHop';
import { NeonDodgeGame } from '../games/neonDodge';
import { CubeCanyonGame } from '../games/cubeCanyon';
import { PocketGardenGame } from '../games/pocketGarden';
import { SnackCatchGame } from '../games/snackCatch';
import { CapyBlasterGame } from '../games/capyBlaster';
import { BeeSwarmGame, BAG_CAPS, BAG_NAMES, BAG_PRICES, TOOLS, TOOL_PRICES } from '../games/beeSwarm';
import { BeeSwarmSimulator3DGame } from '../games/beeSwarm3D';
import { CapyQuestGame } from '../games/capyQuest';
import { IslandExpeditionGame } from '../games/islandExpedition';
import { PondSnakeGame } from '../games/pondSnake';
import { CapyPongGame } from '../games/capyPong';
import { MudBricksGame } from '../games/mudBricks';
import {
  Maximize2,
  Minimize2,
  Pause,
  Play,
  X,
  ShoppingCart,
  Users,
  UserCheck,
  Send,
  Lock,
  ChevronRight,
  Sparkles,
  ArrowLeft,
  Copy,
} from 'lucide-react';

interface GameModalProps {
  game: GameMetadata | null;
  onClose: () => void;
  bestScore: number;
  onNewBestScore: (gameId: string, score: number) => void;
  currentUser: UserAccount | null;
  beeSave?: BeeSaveData;
  onSaveBee?: (save: BeeSaveData) => void;
  initialRoomId?: string;
}

const HOP_WORLDS = [
  { id: 1, name: 'Sunny Meadow', color: '#427b58', stages: 3 },
  { id: 2, name: 'Emerald Peaks', color: '#15803d', stages: 3 },
  { id: 3, name: 'Sunset Canyon', color: '#c2410c', stages: 2 },
  { id: 4, name: 'Mystic Valley', color: '#6b21a8', stages: 2 },
];

const BRICK_WORLDS = [
  { id: 1, name: 'Clay Quarry', color: '#c97b5a', stages: 4 },
  { id: 2, name: 'Terracotta Ruins', color: '#b45309', stages: 3 },
  { id: 3, name: 'Obsidian Vault', color: '#334155', stages: 3 },
];

export const GameModal: React.FC<GameModalProps> = ({
  game,
  onClose,
  bestScore,
  onNewBestScore,
  currentUser,
  beeSave,
  onSaveBee,
  initialRoomId,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  type ModalView = 'MENU' | 'WORLD_SELECT' | 'STAGE_SELECT' | 'MULTIPLAYER_LOBBY' | 'PLAYING' | 'PAUSED' | 'GAME_OVER' | 'WON';
  const [modalView, setModalView] = useState<ModalView>(initialRoomId ? 'MULTIPLAYER_LOBBY' : 'MENU');

  const [currentScore, setCurrentScore] = useState(0);
  const [extraHUD, setExtraHUD] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);

  // World / Stage & Difficulty selections
  const [selectedWorld, setSelectedWorld] = useState(1);
  const [selectedDifficulty, setSelectedDifficulty] = useState<DifficultyMode>('Standard');

  // Multiplayer Room state
  const [room, setRoom] = useState<GameRoom | null>(null);
  const [friendsList, setFriendsList] = useState<Friend[]>([]);
  const [invitedIds, setInvitedIds] = useState<Set<number>>(new Set());

  // Bee Swarm UI dialogs
  const [isBeeShopOpen, setIsBeeShopOpen] = useState(false);
  const [isBearDialogOpen, setIsBearDialogOpen] = useState(false);

  // Active game reference
  const gameInstanceRef = useRef<any>(null);
  const keysRef = useRef<Set<string>>(new Set());
  const animFrameRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  // Stop everything
  const stopGame = useCallback(() => {
    soundEngine.stopMusic();
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = 0;
    }
    keysRef.current.clear();
    vfx.clear();
  }, []);

  // Update HUD callback
  const handleScoreUpdate = useCallback((score: number, extra?: string) => {
    setCurrentScore(score);
    if (extra !== undefined) setExtraHUD(extra);
  }, []);

  // Heartbeat presence when game is active
  useEffect(() => {
    if (!currentUser || !game || modalView !== 'PLAYING') return;

    const reportPresence = () => {
      fetch('/api/presence/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.id,
          currentGame: game.title,
          roomId: room?.id,
        }),
      }).catch(() => {});
    };

    reportPresence();
    const interval = setInterval(reportPresence, 4000);
    return () => clearInterval(interval);
  }, [currentUser, game, modalView, room]);

  // Load friends for multiplayer invite screen
  const loadFriends = async () => {
    if (!currentUser) return;
    try {
      const res = await fetch(`/api/friends?userId=${currentUser.id}`);
      if (res.ok) {
        const data = await res.json();
        setFriendsList(data.friends || []);
      }
    } catch {}
  };

  // Create or Join multiplayer room
  const createMultiplayerRoom = async () => {
    if (!game || !currentUser) return;
    try {
      const res = await fetch('/api/multiplayer/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameId: game.id,
          hostId: currentUser.id,
          maxPlayers: 4,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setRoom(data.room);
        setModalView('MULTIPLAYER_LOBBY');
        loadFriends();
      }
    } catch {}
  };

  const joinExistingRoom = async (roomId: string) => {
    if (!currentUser) return;
    try {
      const res = await fetch('/api/multiplayer/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId, userId: currentUser.id }),
      });
      if (res.ok) {
        const data = await res.json();
        setRoom(data.room);
        setModalView('MULTIPLAYER_LOBBY');
      }
    } catch {}
  };

  useEffect(() => {
    if (initialRoomId) {
      joinExistingRoom(initialRoomId);
    }
  }, [initialRoomId]);

  // Poll room updates in lobby
  useEffect(() => {
    if (!room || modalView !== 'MULTIPLAYER_LOBBY' || !currentUser) return;

    const pollRoom = async () => {
      try {
        const res = await fetch('/api/multiplayer/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roomId: room.id, userId: currentUser.id }),
        });
        if (res.ok) {
          const data = await res.json();
          setRoom(data.room);
        }
      } catch {}
    };

    const timer = setInterval(pollRoom, 2500);
    return () => clearInterval(timer);
  }, [room, modalView, currentUser]);

  // Invite friend to room
  const handleInviteFriend = async (friendId: number, e: React.MouseEvent) => {
    if (!currentUser || !room || !game) return;
    try {
      const res = await fetch('/api/multiplayer/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromId: currentUser.id,
          toId: friendId,
          gameId: game.id,
          roomId: room.id,
        }),
      });
      if (res.ok) {
        setInvitedIds((prev) => new Set(prev).add(friendId));
        soundEngine.play('coin');
        spawnDomBurst(e.clientX, e.clientY, 8);
      }
    } catch {}
  };

  // Start or resume game
  const startGame = useCallback(
    (startStage = 0) => {
      if (!game || !canvasRef.current) return;
      const canvas = canvasRef.current;

      if (modalView === 'PAUSED') {
        setModalView('PLAYING');
        soundEngine.startMusic(game.id);
        lastTimeRef.current = performance.now();
        return;
      }

      // Reset & Initialize game instance
      vfx.clear();
      let instance: any = null;

      switch (game.id) {
        case 'Capy Hop':
          instance = new CapyHopGame();
          break;
        case 'Neon Dodge':
          instance = new NeonDodgeGame();
          break;
        case 'Cube Canyon':
          instance = new CubeCanyonGame();
          break;
        case 'Bee Swarm Simulator (3D)':
          instance = new BeeSwarmSimulator3DGame();
          break;
        case 'Bee Swarm Simulator (2D)':
          instance = new BeeSwarmGame();
          break;
        case 'Capy Quest: Dungeon of the Sun':
          instance = new CapyQuestGame();
          break;
        case 'Island Expedition':
          instance = new IslandExpeditionGame();
          break;
        case 'Pocket Garden':
          instance = new PocketGardenGame();
          break;
        case 'Snack Catch':
          instance = new SnackCatchGame();
          break;
        case 'Capy Blaster':
          instance = new CapyBlasterGame();
          break;
        case 'Pond Snake':
          instance = new PondSnakeGame();
          break;
        case 'Capy Pong':
          instance = new CapyPongGame();
          break;
        case 'Mud Bricks':
          instance = new MudBricksGame();
          break;
        default:
          instance = new CapyHopGame();
      }

      if (game.id.includes('Bee Swarm')) {
        instance.init(canvas, handleScoreUpdate, beeSave);
      } else {
        instance.init(canvas, handleScoreUpdate);
      }

      gameInstanceRef.current = instance;
      setCurrentScore(0);
      setModalView('PLAYING');
      soundEngine.play('jump');
      soundEngine.startMusic(game.id);

      lastTimeRef.current = performance.now();
    },
    [game, modalView, handleScoreUpdate, beeSave]
  );

  // Pause toggle
  const togglePause = useCallback(() => {
    if (modalView === 'PLAYING') {
      setModalView('PAUSED');
      soundEngine.stopMusic();
      soundEngine.play('click');
    } else if (modalView === 'PAUSED') {
      setModalView('PLAYING');
      if (game) soundEngine.startMusic(game.id);
      lastTimeRef.current = performance.now();
      soundEngine.play('click');
    }
  }, [modalView, game]);

  // Main Game Loop
  useEffect(() => {
    if (!game || modalView !== 'PLAYING') return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let isRunning = true;

    const loop = (now: number) => {
      if (!isRunning) return;

      const dt = Math.min((now - lastTimeRef.current) / 1000, 0.033);
      lastTimeRef.current = now;

      const instance = gameInstanceRef.current;
      if (instance) {
        if (game.id === 'Bee Swarm Simulator (2D)') {
          setIsBeeShopOpen(instance.shopOpen);
          setIsBearDialogOpen(instance.bearDialogOpen);
        }

        const { gameOver, won } = instance.update(dt, keysRef.current);
        vfx.update(dt);

        // Render pass
        ctx.save();
        const shake = vfx.getShakeOffset();
        if (shake.x !== 0 || shake.y !== 0) {
          ctx.translate(shake.x, shake.y);
        }

        instance.render(ctx);
        vfx.render(ctx);
        ctx.restore();

        if (gameOver || won) {
          stopGame();
          setModalView(won ? 'WON' : 'GAME_OVER');
          soundEngine.play(won ? 'win' : 'hit');

          if (game.id.includes('Bee Swarm') && onSaveBee && instance.getSaveData) {
            onSaveBee(instance.getSaveData());
          }

          if (instance.score > bestScore) {
            onNewBestScore(game.id, instance.score);
          }
          return;
        }
      }

      animFrameRef.current = requestAnimationFrame(loop);
    };

    lastTimeRef.current = performance.now();
    animFrameRef.current = requestAnimationFrame(loop);

    return () => {
      isRunning = false;
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [game, modalView, bestScore, onNewBestScore, onSaveBee, stopGame]);

  // Key listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault();
      }
      if (e.key.toLowerCase() === 'p' && (modalView === 'PLAYING' || modalView === 'PAUSED')) {
        togglePause();
        return;
      }
      keysRef.current.add(e.key.length === 1 ? e.key.toLowerCase() : e.key);
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysRef.current.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [modalView, togglePause]);

  // Close cleanup
  useEffect(() => {
    return () => {
      stopGame();
    };
  }, [stopGame]);

  // Fullscreen toggle
  const toggleFullscreen = async () => {
    if (!wrapRef.current) return;
    try {
      if (!document.fullscreenElement) {
        await wrapRef.current.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch {}
  };

  // Canvas pointer down for Pocket Garden
  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || modalView !== 'PLAYING') return;
    const instance = gameInstanceRef.current;
    if (instance && instance.onPointerDown) {
      instance.onPointerDown(e.nativeEvent, canvasRef.current);
    }
  };

  const handleTouchDown = (key: string) => {
    keysRef.current.add(key);
    soundEngine.play('hover');
  };
  const handleTouchUp = (key: string) => {
    keysRef.current.delete(key);
  };

  if (!game) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        ref={wrapRef}
        className="relative flex flex-col w-full max-w-4xl bg-white dark:bg-[#181f18] border border-slate-200 dark:border-[#2b382b] rounded-2xl shadow-2xl overflow-hidden max-h-[96vh]"
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-[#2b382b] bg-slate-50/80 dark:bg-[#141a14]/80 select-none">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-xs" />
            <span className="font-display font-bold text-sm tracking-tight text-slate-900 dark:text-white">
              {game.title}
            </span>
            <span className="text-xs text-slate-400 dark:text-slate-500 hidden sm:inline">
              · {game.categoryLabel}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {modalView === 'PLAYING' && (
              <button
                onClick={togglePause}
                className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg border border-slate-200 dark:border-[#334233] bg-white dark:bg-[#1c241c] text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#253025] transition-colors"
                title="Pause Game (P)"
              >
                <Pause className="w-3.5 h-3.5" />
                <span>Pause</span>
              </button>
            )}

            {modalView === 'PAUSED' && (
              <button
                onClick={togglePause}
                className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
                title="Resume Game"
              >
                <Play className="w-3.5 h-3.5" />
                <span>Resume</span>
              </button>
            )}

            <button
              onClick={toggleFullscreen}
              className="p-1.5 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-[#253025] transition-colors"
              title="Toggle Fullscreen"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            <button
              onClick={() => {
                stopGame();
                onClose();
              }}
              className="p-1.5 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-[#253025] transition-colors ml-1"
              title="Close (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Canvas & Overlay Area */}
        <div className="relative w-full aspect-video bg-slate-950 overflow-hidden flex items-center justify-center">
          <canvas
            ref={canvasRef}
            width={800}
            height={450}
            onPointerDown={handleCanvasPointerDown}
            className="w-full h-full object-contain cursor-crosshair select-none"
          />

          {/* MAIN MENU OVERLAY */}
          {modalView === 'MENU' && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-6 text-center bg-black/85 backdrop-blur-md text-white select-none animate-in fade-in duration-200">
              <span className="text-xs font-bold tracking-widest text-emerald-400 uppercase mb-2">
                Capybara Games
              </span>

              <h1 className="text-3xl sm:text-5xl font-display font-black tracking-tight mb-2 text-balance">
                {game.title}
              </h1>

              <p className="max-w-md text-xs sm:text-sm text-slate-300 leading-relaxed mb-6">
                {game.tagline}
              </p>

              <div className="flex flex-col gap-3 w-full max-w-xs">
                {game.supportsWorldSelect ? (
                  <button
                    onClick={() => {
                      soundEngine.play('click');
                      setModalView('WORLD_SELECT');
                    }}
                    className="w-full py-3 text-sm font-extrabold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-95 rounded-xl shadow-lg transition-all"
                  >
                    Play (Select World) →
                  </button>
                ) : (
                  <button
                    onClick={() => startGame(0)}
                    className="w-full py-3 text-sm font-extrabold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-95 rounded-xl shadow-lg transition-all"
                  >
                    Single Player →
                  </button>
                )}

                {game.multiplayer && (
                  <button
                    onClick={() => {
                      soundEngine.play('coin');
                      createMultiplayerRoom();
                    }}
                    className="w-full py-3 text-sm font-extrabold text-slate-900 bg-gradient-to-r from-amber-300 to-amber-400 hover:from-amber-400 hover:to-amber-500 active:scale-95 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2"
                  >
                    <Users className="w-4 h-4" />
                    <span>Multiplayer (Play with Friends)</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* WORLD SELECT OVERLAY (Capy Hop & Mud Bricks) */}
          {modalView === 'WORLD_SELECT' && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-6 text-center bg-black/90 backdrop-blur-md text-white select-none animate-in fade-in">
              <div className="flex items-center justify-between w-full max-w-lg mb-4">
                <button
                  onClick={() => setModalView('MENU')}
                  className="flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-white"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Main Menu</span>
                </button>
                <h2 className="text-xl font-display font-extrabold">Select a World</h2>
                <div className="w-16" />
              </div>

              {/* Difficulty Chooser */}
              <div className="flex items-center gap-2 mb-6 p-1 bg-white/10 rounded-xl">
                {(['Casual', 'Standard', 'Expert'] as DifficultyMode[]).map((diff) => (
                  <button
                    key={diff}
                    onClick={() => {
                      setSelectedDifficulty(diff);
                      soundEngine.play('click');
                    }}
                    className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                      selectedDifficulty === diff
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {diff}
                  </button>
                ))}
              </div>

              {/* Worlds Grid */}
              <div className="grid grid-cols-2 gap-3 w-full max-w-lg">
                {(game.id === 'Capy Hop' ? HOP_WORLDS : BRICK_WORLDS).map((w, idx) => {
                  const isUnlocked = idx <= 1 || (bestScore > idx * 10);
                  return (
                    <button
                      key={w.id}
                      disabled={!isUnlocked}
                      onClick={() => {
                        setSelectedWorld(w.id);
                        setModalView('STAGE_SELECT');
                        soundEngine.play('click');
                      }}
                      className={`flex flex-col items-start p-4 rounded-xl border text-left transition-all ${
                        isUnlocked
                          ? 'bg-white/10 hover:bg-white/15 border-white/20 hover:border-emerald-400 active:scale-98'
                          : 'bg-white/5 border-white/5 opacity-40 cursor-not-allowed'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full mb-1">
                        <span className="text-[10px] font-bold uppercase text-slate-400">World {w.id}</span>
                        {!isUnlocked && <Lock className="w-3.5 h-3.5 text-slate-500" />}
                      </div>
                      <div className="font-display font-extrabold text-sm text-white">{w.name}</div>
                      <div className="text-[11px] text-emerald-400 mt-2 font-mono">
                        {isUnlocked ? `${w.stages} Stages Unlocked →` : 'Locked'}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* STAGE SELECT OVERLAY */}
          {modalView === 'STAGE_SELECT' && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-6 text-center bg-black/90 backdrop-blur-md text-white select-none animate-in fade-in">
              <div className="flex items-center justify-between w-full max-w-md mb-6">
                <button
                  onClick={() => setModalView('WORLD_SELECT')}
                  className="flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-white"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Worlds</span>
                </button>
                <h2 className="text-xl font-display font-extrabold">Select Stage</h2>
                <div className="w-16" />
              </div>

              <div className="grid grid-cols-4 gap-3 w-full max-w-sm mb-6">
                {[1, 2, 3, 4, 5].map((st) => (
                  <button
                    key={st}
                    onClick={() => {
                      soundEngine.play('jump');
                      startGame(st - 1);
                    }}
                    className="aspect-square flex flex-col items-center justify-center rounded-xl bg-emerald-600/80 hover:bg-emerald-600 active:scale-95 border border-emerald-400/40 text-white font-extrabold text-lg shadow-md transition-all"
                  >
                    <span>{st}</span>
                    <span className="text-[9px] font-normal opacity-80">Stage</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* MULTIPLAYER LOBBY & INVITE OVERLAY */}
          {modalView === 'MULTIPLAYER_LOBBY' && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-6 text-center bg-black/90 backdrop-blur-md text-white select-none animate-in fade-in">
              <div className="w-full max-w-lg bg-[#182218] border border-amber-400/40 rounded-2xl p-6 shadow-2xl space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-amber-400" />
                    <h3 className="font-display font-extrabold text-base">
                      {game.title} Multiplayer Lobby
                    </h3>
                  </div>
                  <button
                    onClick={() => setModalView('MENU')}
                    className="p-1 text-slate-400 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Room Info & Players */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
                  <div className="text-left">
                    <div className="text-[10px] text-slate-400 uppercase font-bold">Room Code</div>
                    <div className="font-mono text-emerald-400 font-extrabold text-sm">{room?.id}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-slate-400 uppercase font-bold">Players in Room</div>
                    <div className="text-xs font-bold text-amber-300">
                      {room?.players?.length || 1} / {room?.maxPlayers || 4}
                    </div>
                  </div>
                </div>

                {/* Connected players list */}
                <div className="space-y-1.5 text-left">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Room Crew</div>
                  <div className="grid grid-cols-2 gap-2">
                    {(room?.players || [{ username: currentUser?.username || 'You', id: currentUser?.id }]).map(
                      (p: any, i: number) => (
                        <div
                          key={p.id || i}
                          className="flex items-center gap-2 p-2 rounded-lg bg-emerald-950/40 border border-emerald-800/40 text-xs font-bold"
                        >
                          <span className="w-2 h-2 rounded-full bg-emerald-400" />
                          <span className="truncate">{p.username}</span>
                          <span className="text-[10px] text-slate-400">Plot {i + 1}</span>
                        </div>
                      )
                    )}
                  </div>
                </div>

                {/* Invite Online Friends */}
                <div className="space-y-2 text-left pt-2 border-t border-white/10">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Invite Your Friends</div>
                  {friendsList.length === 0 ? (
                    <div className="text-xs text-slate-400 italic">
                      Add friends from the Friends tab to invite them here!
                    </div>
                  ) : (
                    <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                      {friendsList.map((f) => {
                        const isInvited = invitedIds.has(f.id);
                        return (
                          <div
                            key={f.id}
                            className="flex items-center justify-between p-2 rounded-lg bg-white/5 border border-white/10 text-xs"
                          >
                            <div className="flex items-center gap-2">
                              <span
                                className={`w-2 h-2 rounded-full ${
                                  f.isOnline ? 'bg-emerald-400 shadow-sm' : 'bg-slate-500'
                                }`}
                              />
                              <span className="font-bold">{f.username}</span>
                              <span className="text-[10px] text-slate-400">
                                {f.isOnline ? 'Online' : 'Offline'}
                              </span>
                            </div>

                            <button
                              disabled={isInvited || !f.isOnline}
                              onClick={(e) => handleInviteFriend(f.id, e)}
                              className="px-2.5 py-1 text-[11px] font-bold bg-amber-400 text-slate-900 rounded-lg hover:bg-amber-300 disabled:opacity-40 transition-colors"
                            >
                              {isInvited ? 'Invited ✓' : 'Invite'}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Launch Button */}
                <button
                  onClick={() => startGame(0)}
                  className="w-full py-3 text-sm font-extrabold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-95 rounded-xl shadow-lg transition-all"
                >
                  Launch Multiplayer Session →
                </button>
              </div>
            </div>
          )}

          {/* PAUSED / GAME OVER / WON OVERLAYS */}
          {(modalView === 'PAUSED' || modalView === 'GAME_OVER' || modalView === 'WON') && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-6 text-center bg-black/75 backdrop-blur-sm text-white select-none">
              <span className="text-xs font-bold tracking-widest text-emerald-400 uppercase mb-2">
                Capybara Games
              </span>

              <h2 className="text-2xl sm:text-4xl font-display font-extrabold tracking-tight mb-2">
                {modalView === 'PAUSED' && 'Game Paused'}
                {modalView === 'GAME_OVER' && 'Good Run!'}
                {modalView === 'WON' && 'You Won! Congratulations!'}
              </h2>

              <p className="max-w-md text-sm text-slate-300 leading-relaxed mb-5">
                {modalView === 'PAUSED' && 'Take a deep breath and jump right back when ready.'}
                {modalView === 'GAME_OVER' &&
                  `Your score: ${currentScore}. Best score: ${Math.max(bestScore, currentScore)}.`}
                {modalView === 'WON' &&
                  `Mastered all stages! Final score: ${currentScore}. Best: ${Math.max(
                    bestScore,
                    currentScore
                  )}.`}
              </p>

              <div className="flex gap-3">
                <button
                  onClick={() => setModalView('MENU')}
                  className="px-4 py-2.5 text-xs font-bold text-slate-300 bg-white/10 hover:bg-white/20 rounded-xl transition-colors"
                >
                  Main Menu
                </button>
                <button
                  onClick={() => startGame(0)}
                  className="px-6 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-95 rounded-xl shadow-lg transition-all"
                >
                  {modalView === 'PAUSED' ? 'Resume Playing →' : 'Play Again →'}
                </button>
              </div>
            </div>
          )}

          {/* Bee Swarm Shop Dialog */}
          {isBeeShopOpen && game.id.includes('Bee Swarm') && (
            <div className="absolute inset-0 z-30 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
              <div className="w-full max-w-sm bg-[#16222f] border border-amber-400/40 rounded-2xl p-5 text-white shadow-2xl animate-in zoom-in-95">
                <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
                  <div className="flex items-center gap-2">
                    <ShoppingCart className="w-5 h-5 text-amber-400" />
                    <h3 className="font-display font-bold text-base">Bee Shop</h3>
                  </div>
                  <button
                    onClick={() => {
                      if (gameInstanceRef.current) gameInstanceRef.current.shopOpen = false;
                      setIsBeeShopOpen(false);
                    }}
                    className="p-1 text-slate-400 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-3">
                  {/* Basic Egg */}
                  <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
                    <div>
                      <div className="font-bold text-sm text-amber-200">Basic Egg</div>
                      <div className="text-xs text-slate-400">
                        Hatches random bee ({gameInstanceRef.current?.bees?.length || 0}/50)
                      </div>
                    </div>
                    <button
                      disabled={
                        (gameInstanceRef.current?.honey || 0) <
                          (gameInstanceRef.current?.getEggPrice?.() || 100) ||
                        (gameInstanceRef.current?.bees?.length || 0) >= 50
                      }
                      onClick={() => {
                        const inst = gameInstanceRef.current;
                        if (!inst) return;
                        const price = inst.getEggPrice();
                        if (inst.honey >= price && inst.bees.length < 50) {
                          inst.honey -= price;
                          inst.hatch();
                          soundEngine.play('cash');
                          if (onSaveBee) onSaveBee(inst.getSaveData());
                        }
                      }}
                      className="px-3 py-1.5 text-xs font-bold bg-amber-400 text-slate-900 rounded-lg hover:bg-amber-300 disabled:opacity-40 transition-colors"
                    >
                      🍯 {gameInstanceRef.current?.getEggPrice?.() || 100}
                    </button>
                  </div>

                  {/* Backpack upgrade */}
                  <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
                    <div>
                      <div className="font-bold text-sm text-amber-200">
                        {gameInstanceRef.current?.bagLv < BAG_NAMES.length - 1
                          ? BAG_NAMES[gameInstanceRef.current.bagLv + 1]
                          : 'Max Backpack'}
                      </div>
                      <div className="text-xs text-slate-400">
                        Cap: {BAG_CAPS[gameInstanceRef.current?.bagLv || 0]} →{' '}
                        {BAG_CAPS[Math.min(BAG_CAPS.length - 1, (gameInstanceRef.current?.bagLv || 0) + 1)]}
                      </div>
                    </div>
                    {gameInstanceRef.current?.bagLv < BAG_NAMES.length - 1 ? (
                      <button
                        disabled={
                          (gameInstanceRef.current?.honey || 0) <
                          BAG_PRICES[(gameInstanceRef.current?.bagLv || 0) + 1]
                        }
                        onClick={() => {
                          const inst = gameInstanceRef.current;
                          if (!inst) return;
                          const nextLv = inst.bagLv + 1;
                          if (inst.honey >= BAG_PRICES[nextLv]) {
                            inst.honey -= BAG_PRICES[nextLv];
                            inst.bagLv = nextLv;
                            soundEngine.play('cash');
                            if (onSaveBee) onSaveBee(inst.getSaveData());
                          }
                        }}
                        className="px-3 py-1.5 text-xs font-bold bg-amber-400 text-slate-900 rounded-lg hover:bg-amber-300 disabled:opacity-40 transition-colors"
                      >
                        🍯 {BAG_PRICES[(gameInstanceRef.current?.bagLv || 0) + 1]}
                      </button>
                    ) : (
                      <span className="text-xs font-bold text-emerald-400">MAX</span>
                    )}
                  </div>

                  {/* Tool upgrade */}
                  <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
                    <div>
                      <div className="font-bold text-sm text-amber-200">
                        {gameInstanceRef.current?.toolLv < TOOLS.length - 1
                          ? TOOLS[gameInstanceRef.current.toolLv + 1].n
                          : 'Max Tool'}
                      </div>
                      <div className="text-xs text-slate-400">
                        Tool: {TOOLS[gameInstanceRef.current?.toolLv || 0]?.n}
                      </div>
                    </div>
                    {gameInstanceRef.current?.toolLv < TOOLS.length - 1 ? (
                      <button
                        disabled={
                          (gameInstanceRef.current?.honey || 0) <
                          TOOL_PRICES[(gameInstanceRef.current?.toolLv || 0) + 1]
                        }
                        onClick={() => {
                          const inst = gameInstanceRef.current;
                          if (!inst) return;
                          const nextLv = inst.toolLv + 1;
                          if (inst.honey >= TOOL_PRICES[nextLv]) {
                            inst.honey -= TOOL_PRICES[nextLv];
                            inst.toolLv = nextLv;
                            soundEngine.play('cash');
                            if (onSaveBee) onSaveBee(inst.getSaveData());
                          }
                        }}
                        className="px-3 py-1.5 text-xs font-bold bg-amber-400 text-slate-900 rounded-lg hover:bg-amber-300 disabled:opacity-40 transition-colors"
                      >
                        🍯 {TOOL_PRICES[(gameInstanceRef.current?.toolLv || 0) + 1]}
                      </button>
                    ) : (
                      <span className="text-xs font-bold text-emerald-400">MAX</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Bee Swarm Bear NPC Quest Dialog */}
          {isBearDialogOpen && game.id.includes('Bee Swarm') && (
            <div className="absolute inset-0 z-30 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
              <div className="w-full max-w-sm bg-[#1e1915] border border-amber-600/50 rounded-2xl p-5 text-white shadow-2xl animate-in zoom-in-95">
                <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">🐻</span>
                    <div>
                      <h3 className="font-display font-bold text-base">Black Bear</h3>
                      <div className="text-[10px] text-amber-400 font-bold uppercase">Meadow Quest Giver</div>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      if (gameInstanceRef.current) gameInstanceRef.current.bearDialogOpen = false;
                      setIsBearDialogOpen(false);
                    }}
                    className="p-1 text-slate-400 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 space-y-2">
                    <div className="font-bold text-sm text-amber-200">
                      {gameInstanceRef.current?.activeQuest?.title || 'Bear Quest'}
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      {gameInstanceRef.current?.activeQuest?.description}
                    </p>

                    <div className="pt-2 text-xs font-mono space-y-1">
                      <div className="flex justify-between text-slate-400">
                        <span>Pollen Progress:</span>
                        <span className="text-amber-300 font-bold">
                          {Math.floor(gameInstanceRef.current?.activeQuest?.currentPollen || 0)} /{' '}
                          {gameInstanceRef.current?.activeQuest?.targetPollenAmount || 100}
                        </span>
                      </div>
                      {gameInstanceRef.current?.activeQuest?.targetMobs ? (
                        <div className="flex justify-between text-slate-400">
                          <span>Mobs Defeated:</span>
                          <span className="text-red-400 font-bold">
                            {gameInstanceRef.current?.activeQuest?.currentMobs || 0} /{' '}
                            {gameInstanceRef.current?.activeQuest?.targetMobs}
                          </span>
                        </div>
                      ) : null}
                      <div className="flex justify-between text-slate-400 pt-1 border-t border-white/10">
                        <span>Reward:</span>
                        <span className="text-emerald-400 font-bold">
                          🍯 +{gameInstanceRef.current?.activeQuest?.rewardHoney || 300} Honey
                        </span>
                      </div>
                    </div>
                  </div>

                  {gameInstanceRef.current?.activeQuest?.completed &&
                  !gameInstanceRef.current?.activeQuest?.claimed ? (
                    <button
                      onClick={() => {
                        const inst = gameInstanceRef.current;
                        if (!inst) return;
                        inst.claimBearQuest();
                        inst.bearDialogOpen = false;
                        setIsBearDialogOpen(false);
                        if (onSaveBee) onSaveBee(inst.getSaveData());
                      }}
                      className="w-full py-2.5 text-xs font-extrabold text-slate-900 bg-gradient-to-r from-amber-400 to-emerald-400 hover:opacity-95 rounded-xl shadow-lg transition-all"
                    >
                      🎉 Claim Reward (+{gameInstanceRef.current?.activeQuest?.rewardHoney} Honey)
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        if (gameInstanceRef.current) gameInstanceRef.current.bearDialogOpen = false;
                        setIsBearDialogOpen(false);
                      }}
                      className="w-full py-2 text-xs font-bold text-slate-300 bg-white/10 hover:bg-white/15 rounded-xl transition-colors"
                    >
                      {gameInstanceRef.current?.activeQuest?.completed ? 'Completed' : 'Understood, on it!'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Touch Controls (shown on touch or small devices) */}
        <div className="flex items-center justify-center gap-2 p-2.5 bg-slate-100 dark:bg-[#121712] border-t border-slate-200 dark:border-[#2b382b] select-none touch-none sm:hidden">
          <button
            onPointerDown={() => handleTouchDown('ArrowLeft')}
            onPointerUp={() => handleTouchUp('ArrowLeft')}
            onPointerLeave={() => handleTouchUp('ArrowLeft')}
            className="flex-1 py-3 bg-white dark:bg-[#1a211a] border border-slate-200 dark:border-[#334233] text-slate-800 dark:text-white rounded-xl font-bold active:bg-emerald-100 dark:active:bg-[#253825] transition-colors"
          >
            ◀
          </button>
          <button
            onPointerDown={() => handleTouchDown('ArrowRight')}
            onPointerUp={() => handleTouchUp('ArrowRight')}
            onPointerLeave={() => handleTouchUp('ArrowRight')}
            className="flex-1 py-3 bg-white dark:bg-[#1a211a] border border-slate-200 dark:border-[#334233] text-slate-800 dark:text-white rounded-xl font-bold active:bg-emerald-100 dark:active:bg-[#253825] transition-colors"
          >
            ▶
          </button>
          <button
            onPointerDown={() => handleTouchDown(' ')}
            onPointerUp={() => handleTouchUp(' ')}
            onPointerLeave={() => handleTouchUp(' ')}
            className="flex-2 py-3 bg-emerald-600 text-white rounded-xl font-bold active:bg-emerald-700 transition-colors"
          >
            Action / Jump
          </button>
          {game.id.includes('Bee Swarm') && (
            <button
              onPointerDown={() => handleTouchDown('e')}
              onPointerUp={() => handleTouchUp('e')}
              onPointerLeave={() => handleTouchUp('e')}
              className="px-4 py-3 bg-amber-500 text-white rounded-xl font-bold active:bg-amber-600 transition-colors"
            >
              E
            </button>
          )}
        </div>

        {/* Footer Controls & Score HUD */}
        <div className="flex items-center justify-between px-4 py-2.5 text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-[#141a14] border-t border-slate-200 dark:border-[#2b382b] select-none">
          <span className="truncate max-w-[280px] sm:max-w-md">
            {game.controls}
          </span>
          <div className="flex items-center gap-3 shrink-0 font-mono font-bold text-slate-700 dark:text-slate-200">
            {extraHUD && <span className="text-emerald-600 dark:text-emerald-400">{extraHUD}</span>}
            <span>SCORE {currentScore}</span>
            <span className="text-slate-400 dark:text-slate-500">BEST {Math.max(bestScore, currentScore)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
