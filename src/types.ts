export type ThemeMode = 'light' | 'dark' | 'system';

export type GameCategory = 'Adventure' | 'Arcade' | 'Puzzle' | '3D';

export interface UserPrefs {
  theme: ThemeMode;
  sound: boolean;
  music: boolean;
  vfx: boolean;
  reduceMotion: boolean;
  sfxVolume: number;
  musicVolume: number;
}

export interface GameMetadata {
  id: string;
  title: string;
  category: GameCategory;
  categoryLabel: string;
  tagline: string;
  description: string;
  controls: string;
  shortControls: string;
  accentColor: string;
  badge?: string;
  featured?: boolean;
  multiplayer?: boolean;
  supportsWorldSelect?: boolean;
}

export interface UserAccount {
  id: number; // 1, 2, ... 2300
  username: string;
  email?: string;
  passwordHash?: string;
  isGoogleAuth?: boolean;
  createdAt: string;
  data: {
    favorites: string[];
    bestScores: Record<string, number>;
    stageBest: Record<string, number>;
    beeSave?: BeeSaveData;
    worldProgress?: Record<string, { unlockedWorld: number; unlockedStage: number }>;
  };
}

export interface Friend {
  id: number;
  username: string;
  bestScores: Record<string, number>;
  stageBest: Record<string, number>;
  totalScore: number;
  isOnline?: boolean;
  currentGame?: string;
  roomId?: string;
}

export interface FriendRequest {
  id: string;
  fromId: number;
  fromUsername: string;
  toId: number;
  toUsername: string;
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED';
  timestamp: number;
}

export interface ChatMessage {
  id: string;
  fromId: number;
  fromUsername: string;
  toId: number;
  toUsername: string;
  text: string;
  timestamp: number;
}

export interface GameRoomPlayer {
  id: number;
  username: string;
  plotId?: number;
  x?: number;
  y?: number;
  score?: number;
  data?: any;
  lastActive: number;
}

export interface GameRoom {
  id: string;
  gameId: string;
  hostId: number;
  hostUsername: string;
  players: GameRoomPlayer[];
  maxPlayers: number;
  state: any;
  createdAt: number;
}

export interface GameInvite {
  id: string;
  fromId: number;
  fromUsername: string;
  toId: number;
  toUsername: string;
  gameId: string;
  roomId: string;
  timestamp: number;
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED';
}

export interface BeeQuest {
  id: string;
  title: string;
  description: string;
  targetPollenType: 'w' | 'r' | 'b' | 'all';
  targetPollenAmount: number;
  currentPollen: number;
  targetMobs?: number;
  currentMobs: number;
  rewardHoney: number;
  completed: boolean;
  claimed: boolean;
}

export interface BeeMob {
  id: string;
  type: 'beetle' | 'ladybug';
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  radius: number;
  speed: number;
  field: string;
  isDefeated: boolean;
}

export interface Sprinkler {
  x: number;
  y: number;
  range: number;
  life: number;
}

export interface BeeSaveData {
  honey: number;
  total: number;
  bees: Array<'w' | 'r' | 'b' | 'gifted'>;
  bagLv: number;
  toolLv: number;
  questStep?: number;
  hasSprinkler?: boolean;
}

export interface WorldDefinition {
  id: number;
  name: string;
  themeColor: string;
  description: string;
  totalStages: number;
}

export type DifficultyMode = 'Casual' | 'Standard' | 'Expert';

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  shape?: 'circle' | 'square' | 'star' | 'ring';
  gravity?: number;
  drag?: number;
  alpha?: number;
}

export interface FloatingText {
  id: number;
  x: number;
  y: number;
  text: string;
  color: string;
  size: number;
  life: number;
  maxLife: number;
  vy: number;
}
