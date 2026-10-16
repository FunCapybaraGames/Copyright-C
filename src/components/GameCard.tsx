import React from 'react';
import { GameMetadata } from '../types';
import { soundEngine } from '../soundEngine';
import { spawnDomBurst } from '../vfxEngine';
import { Heart } from 'lucide-react';

interface GameCardProps {
  game: GameMetadata;
  isFavorite: boolean;
  onToggleFavorite: (id: string) => void;
  onOpenGame: (game: GameMetadata) => void;
}

export const GameCard: React.FC<GameCardProps> = ({
  game,
  isFavorite,
  onToggleFavorite,
  onOpenGame,
}) => {
  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleFavorite(game.id);
    soundEngine.play('coin');
    spawnDomBurst(e.clientX, e.clientY, 8);
  };

  const handleCardClick = () => {
    soundEngine.play('click');
    onOpenGame(game);
  };

  return (
    <article
      onClick={handleCardClick}
      className="group relative flex flex-col p-2 bg-white dark:bg-[#182118] border border-slate-200 dark:border-[#2b3a2b] rounded-2xl shadow-xs hover:shadow-xl hover:border-emerald-300 dark:hover:border-emerald-700/60 transition-all duration-200 hover:-translate-y-1 cursor-pointer select-none"
    >
      {/* Accurate In-Game Thumbnail */}
      <div className="relative aspect-[16/10] w-full rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-900">
        {renderAccurateGameCover(game.id)}

        {/* Hover "PLAY ↗" pill */}
        <div className="absolute bottom-2.5 right-2.5 flex items-center gap-1 px-2.5 py-1 text-[10px] font-extrabold text-white bg-emerald-600 rounded-lg shadow-md opacity-0 group-hover:opacity-100 translate-y-1 group-hover:translate-y-0 transition-all duration-200">
          <span>PLAY</span>
          <span>↗</span>
        </div>
      </div>

      {/* Info & Favorite row */}
      <div className="flex items-center justify-between gap-2 px-1 pt-3 pb-2">
        <div className="min-w-0">
          <h3 className="font-display font-bold text-sm text-slate-900 dark:text-white truncate">
            {game.title}
          </h3>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
            {game.categoryLabel}
          </div>
        </div>

        <button
          onClick={handleFavoriteClick}
          className={`p-2 rounded-xl border transition-all ${
            isFavorite
              ? 'border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 text-red-500'
              : 'border-slate-200 dark:border-[#2b3a2b] bg-slate-50 dark:bg-[#1c261c] text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
          }`}
          title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
        >
          <Heart className={`w-3.5 h-3.5 ${isFavorite ? 'fill-current' : ''}`} />
        </button>
      </div>

      {/* Play Action Footer Button */}
      <button
        onClick={handleCardClick}
        className="mt-auto flex items-center justify-between w-full px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-[#151c15] border border-slate-200/80 dark:border-[#2b3a2b] rounded-xl group-hover:bg-emerald-50 dark:group-hover:bg-emerald-950/40 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 group-hover:border-emerald-200 dark:group-hover:border-emerald-800 transition-colors"
      >
        <span>Play game</span>
        <span className="text-sm font-extrabold group-hover:translate-x-0.5 transition-transform">→</span>
      </button>
    </article>
  );
};

function renderAccurateGameCover(id: string) {
  switch (id) {
    case 'Capy Hop':
      return (
        <svg viewBox="0 0 320 200" className="w-full h-full object-cover">
          <defs>
            <linearGradient id="hopSky" x1="0" y1="0" x2="0" y2="1">
              <stop stopColor="#cbe8d5" />
              <stop offset="1" stopColor="#f5e7c6" />
            </linearGradient>
          </defs>
          <rect width="320" height="200" fill="url(#hopSky)" />
          <circle cx="260" cy="40" r="22" fill="#f5c86d" />
          <circle cx="260" cy="40" r="32" fill="#f5c86d" opacity="0.18" />
          {/* Rolling hills */}
          <path d="M0 130 65 75 130 130 200 65 265 135 320 85V200H0Z" fill="#a6cda9" />
          <path d="M0 155Q90 120 180 155T320 148V200H0Z" fill="#7db28c" />
          {/* Actual platforms */}
          <rect x="20" y="160" width="80" height="40" rx="4" fill="#427b58" />
          <rect x="20" y="160" width="80" height="6" rx="3" fill="#7dbb7b" />
          <rect x="130" y="125" width="60" height="12" rx="4" fill="#427b58" />
          <rect x="130" y="125" width="60" height="5" rx="3" fill="#7dbb7b" />
          <rect x="220" y="150" width="90" height="50" rx="4" fill="#427b58" />
          <rect x="220" y="150" width="90" height="6" rx="3" fill="#7dbb7b" />
          {/* Animated jumping capy with orange on head */}
          <g transform="translate(138 68) scale(1.1)">
            <ellipse cx="20" cy="34" rx="22" ry="16" fill="#a9764e" />
            <ellipse cx="28" cy="24" rx="15" ry="12" fill="#ba895e" />
            <ellipse cx="38" cy="27" rx="8" ry="6" fill="#d5a67b" />
            <circle cx="43" cy="25" r="2.5" fill="#5a3a26" />
            <circle cx="31" cy="20" r="2.4" fill="#1f231c" />
            <circle cx="32" cy="19" r="0.8" fill="#fff" />
            <ellipse cx="24" cy="12" rx="4" ry="5" fill="#8a5d3c" />
            <ellipse cx="28" cy="8" rx="6" ry="5.5" fill="#f2a23a" />
            <path d="M28 3q4-3 6 0" stroke="#4f9a52" strokeWidth="2" fill="none" />
          </g>
          {/* Golden coins */}
          <g fill="#f2a23a">
            <ellipse cx="75" cy="125" rx="7" ry="8" />
            <ellipse cx="160" cy="90" rx="7" ry="8" />
          </g>
          <g fill="#fff0a7">
            <circle cx="75" cy="125" r="3" />
            <circle cx="160" cy="90" r="3" />
          </g>
          {/* Goal flag */}
          <rect x="285" y="105" width="3" height="46" fill="#315d45" />
          <polygon points="288,105 315,116 288,127" fill="#e76f51" />
        </svg>
      );

    case 'Neon Dodge':
      return (
        <svg viewBox="0 0 320 200" className="w-full h-full object-cover">
          <rect width="320" height="200" fill="#16172e" />
          {/* Perspective grid lines */}
          <g stroke="#2c2e55" strokeWidth="1">
            <line x1="0" y1="130" x2="320" y2="130" />
            <line x1="0" y1="150" x2="320" y2="150" />
            <line x1="0" y1="175" x2="320" y2="175" />
            <line x1="40" y1="120" x2="0" y2="200" />
            <line x1="100" y1="120" x2="60" y2="200" />
            <line x1="160" y1="120" x2="160" y2="200" />
            <line x1="220" y1="120" x2="260" y2="200" />
            <line x1="280" y1="120" x2="320" y2="200" />
          </g>
          {/* Falling neon blocks with glowing edges */}
          <rect x="45" y="40" width="24" height="24" rx="4" fill="#ff6b8b" />
          <rect x="49" y="44" width="16" height="16" fill="#ffffff" />
          <rect x="185" y="25" width="28" height="28" rx="4" fill="#f368e0" />
          <rect x="190" y="30" width="18" height="18" fill="#ffffff" />
          <rect x="250" y="85" width="22" height="22" rx="4" fill="#ff85b2" />
          <rect x="254" y="89" width="14" height="14" fill="#ffffff" />
          {/* Near-miss sparks */}
          <g fill="#7ef0df">
            <circle cx="178" cy="148" r="2.5" />
            <circle cx="184" cy="142" r="2" />
            <circle cx="188" cy="154" r="1.5" />
          </g>
          {/* Player Ship */}
          <g transform="translate(145 140)">
            <polygon points="15,-12 30,18 15,10 0,18" fill="#80f1e2" />
            <polygon points="15,-5 20,12 10,12" fill="#ffffff" />
            {/* Thruster glow */}
            <polygon points="12,18 15,28 18,18" fill="#ff85b2" opacity="0.8" />
          </g>
        </svg>
      );

    case 'Cube Canyon':
      return (
        <svg viewBox="0 0 320 200" className="w-full h-full object-cover">
          <defs>
            <linearGradient id="canyonSky" x1="0" y1="0" x2="0" y2="1">
              <stop stopColor="#d8e8ee" />
              <stop offset="0.6" stopColor="#f1dfbd" />
              <stop offset="1" stopColor="#7a9e98" />
            </linearGradient>
          </defs>
          <rect width="320" height="200" fill="url(#canyonSky)" />
          <circle cx="255" cy="40" r="18" fill="#f5ca77" />
          {/* Canyon walls */}
          <polygon points="0,90 80,75 120,200 0,200" fill="#6e9690" />
          <polygon points="320,90 240,75 200,200 320,200" fill="#5b827c" />
          {/* Road */}
          <polygon points="150,70 170,70 270,200 50,200" fill="#c9d4c3" />
          <line x1="160" y1="70" x2="160" y2="200" stroke="#fff6d9" strokeWidth="2" strokeDasharray="8 10" />
          {/* 3D Obstacle Cubes */}
          <g transform="translate(130 95)">
            <polygon points="14,0 28,7 14,14 0,7" fill="#83c6ad" />
            <polygon points="0,7 14,14 14,30 0,23" fill="#438c78" />
            <polygon points="14,14 28,7 28,23 14,30" fill="#286b5a" />
          </g>
          <g transform="translate(195 130)">
            <polygon points="20,0 40,10 20,20 0,10" fill="#e7a16d" />
            <polygon points="0,10 20,20 20,42 0,32" fill="#c97b47" />
            <polygon points="20,20 40,10 40,32 20,42" fill="#8c4720" />
          </g>
          {/* Glowing shard diamond */}
          <polygon points="105,120 112,132 105,144 98,132" fill="#ffd166" />
          {/* Capybara runner leaping */}
          <g transform="translate(142 145)">
            <rect x="0" y="0" width="22" height="14" rx="4" fill="#ba895e" />
            <rect x="14" y="-8" width="12" height="12" rx="3" fill="#d5a67b" />
            <circle cx="21" cy="-4" r="1.8" fill="#222" />
            <circle cx="16" cy="-12" r="3.5" fill="#f2a23a" />
          </g>
        </svg>
      );

    case 'Pocket Garden':
      return (
        <svg viewBox="0 0 320 200" className="w-full h-full object-cover">
          <defs>
            <linearGradient id="gardenBg" x1="0" y1="0" x2="0" y2="1">
              <stop stopColor="#f7f0e3" />
              <stop offset="1" stopColor="#d5e7cb" />
            </linearGradient>
          </defs>
          <rect width="320" height="200" fill="url(#gardenBg)" />
          {/* 6 authentic memory cards */}
          <g transform="translate(35 30)">
            {/* Card 1: Tulip */}
            <rect x="0" y="0" width="70" height="58" rx="8" fill="#ffffff" stroke="#8bc59b" strokeWidth="2" />
            <text x="35" y="38" fontSize="26" textAnchor="middle">🌷</text>
            {/* Card 2: Ladybug */}
            <rect x="90" y="0" width="70" height="58" rx="8" fill="#ffffff" stroke="#8bc59b" strokeWidth="2" />
            <text x="125" y="38" fontSize="26" textAnchor="middle">🐞</text>
            {/* Card 3: Back */}
            <rect x="180" y="0" width="70" height="58" rx="8" fill="#3f8a60" stroke="#2d6d48" strokeWidth="2" />
            <text x="215" y="36" fontSize="20" fill="#c5e2cb" fontWeight="bold" textAnchor="middle">c.</text>

            {/* Card 4: Back */}
            <rect x="0" y="75" width="70" height="58" rx="8" fill="#3f8a60" stroke="#2d6d48" strokeWidth="2" />
            <text x="35" y="111" fontSize="20" fill="#c5e2cb" fontWeight="bold" textAnchor="middle">c.</text>
            {/* Card 5: Strawberry matched */}
            <rect x="90" y="75" width="70" height="58" rx="8" fill="#d9efd2" stroke="#8bc59b" strokeWidth="2" />
            <text x="125" y="113" fontSize="26" textAnchor="middle">🍓</text>
            {/* Card 6: Strawberry matched */}
            <rect x="180" y="75" width="70" height="58" rx="8" fill="#d9efd2" stroke="#8bc59b" strokeWidth="2" />
            <text x="215" y="113" fontSize="26" textAnchor="middle">🍓</text>
          </g>
          {/* Sparkles on match */}
          <g fill="#10b981">
            <circle cx="210" cy="100" r="3" />
            <circle cx="270" cy="115" r="2.5" />
            <circle cx="195" cy="150" r="2" />
          </g>
        </svg>
      );

    case 'Snack Catch':
      return (
        <svg viewBox="0 0 320 200" className="w-full h-full object-cover">
          <defs>
            <linearGradient id="snackBg" x1="0" y1="0" x2="0" y2="1">
              <stop stopColor="#d8eef8" />
              <stop offset="1" stopColor="#f7edd2" />
            </linearGradient>
          </defs>
          <rect width="320" height="200" fill="url(#snackBg)" />
          <circle cx="265" cy="40" r="22" fill="#f5c86d" />
          <rect y="165" width="320" height="35" fill="#7ebd8c" />
          <rect y="180" width="320" height="20" fill="#529668" />
          {/* Falling treats & rocks */}
          <text x="50" y="65" fontSize="28">🍉</text>
          <text x="145" y="45" fontSize="28">🍊</text>
          <text x="220" y="80" fontSize="26">🪨</text>
          <text x="270" y="55" fontSize="28">🍓</text>
          {/* Capybara with woven basket */}
          <g transform="translate(110 130)">
            <ellipse cx="40" cy="22" rx="32" ry="18" fill="#a9764e" />
            <ellipse cx="60" cy="14" rx="16" ry="13" fill="#ba895e" />
            <ellipse cx="72" cy="17" rx="9" ry="7" fill="#d5a67b" />
            <circle cx="78" cy="16" r="2.5" fill="#5a3a26" />
            <circle cx="64" cy="10" r="2.5" fill="#1f231c" />
            {/* Woven wicker basket strapped to back */}
            <rect x="15" y="-6" width="34" height="20" rx="5" fill="#c98f4a" stroke="#8a5e3e" strokeWidth="2" />
            <line x1="15" y1="2" x2="49" y2="2" stroke="#e0b068" strokeWidth="2" />
            {/* Basket contents */}
            <circle cx="26" cy="-3" r="5" fill="#ef4444" />
            <circle cx="36" cy="-4" r="6" fill="#f59e0b" />
          </g>
        </svg>
      );

    case 'Capy Blaster':
      return (
        <svg viewBox="0 0 320 200" className="w-full h-full object-cover">
          <defs>
            <linearGradient id="blasterBg" x1="0" y1="0" x2="0" y2="1">
              <stop stopColor="#0c0f2b" />
              <stop offset="1" stopColor="#241a4a" />
            </linearGradient>
          </defs>
          <rect width="320" height="200" fill="url(#blasterBg)" />
          {/* Starfield */}
          <g fill="#fff">
            <circle cx="35" cy="35" r="1.5" />
            <circle cx="85" cy="85" r="1" />
            <circle cx="150" cy="25" r="2" />
            <circle cx="215" cy="65" r="1.5" />
            <circle cx="280" cy="30" r="1" />
            <circle cx="295" cy="120" r="2" />
          </g>
          {/* Invading alien bugs */}
          <text x="65" y="70" fontSize="30" textAnchor="middle">👾</text>
          <text x="160" y="55" fontSize="34" textAnchor="middle">👹</text>
          <text x="245" y="75" fontSize="30" textAnchor="middle">👾</text>
          {/* Dual cyan plasma laser bolts */}
          <rect x="148" y="105" width="4" height="24" rx="2" fill="#80f1e2" />
          <rect x="168" y="105" width="4" height="24" rx="2" fill="#80f1e2" />
          {/* Player starfighter */}
          <g transform="translate(160 160)">
            <polygon points="0,-24 24,14 0,6 -24,14" fill="#4fd1c0" />
            <polygon points="0,-16 12,8 -12,8" fill="#2ba898" />
            {/* Capybara bubble dome */}
            <circle cx="0" cy="-2" r="8" fill="#ba895e" />
            <circle cx="0" cy="-1" r="10" fill="rgba(230, 250, 255, 0.4)" stroke="#80f1e2" strokeWidth="1.5" />
            {/* Thruster exhaust flame */}
            <polygon points="-5,10 0,22 5,10" fill="#f59e0b" />
          </g>
        </svg>
      );

    case 'Bee Swarm Simulator (3D)':
      return (
        <svg viewBox="0 0 320 200" className="w-full h-full object-cover">
          <defs>
            <linearGradient id="bee3dSky" x1="0" y1="0" x2="0" y2="1">
              <stop stopColor="#60a5fa" />
              <stop offset="0.65" stopColor="#bfdbfe" />
              <stop offset="1" stopColor="#86efac" />
            </linearGradient>
          </defs>
          <rect width="320" height="200" fill="url(#bee3dSky)" />
          {/* Sun */}
          <circle cx="265" cy="35" r="22" fill="#fde047" />
          <circle cx="265" cy="35" r="32" fill="#fde047" opacity="0.2" />
          {/* 3D Horizon & Meadow Ground */}
          <rect y="84" width="320" height="116" fill="#4ade80" />
          <path d="M0,84 Q80,78 160,84 T320,84 L320,200 L0,200 Z" fill="#22c55e" opacity="0.4" />

          {/* 3D Hive Wall at Horizon */}
          <g transform="translate(60 50)">
            <rect x="0" y="0" width="200" height="42" rx="4" fill="#78350f" stroke="#f59e0b" strokeWidth="2" />
            {/* Hexagonal honeycomb slots */}
            <g fill="#fde047">
              <circle cx="25" cy="14" r="6" />
              <circle cx="45" cy="14" r="6" />
              <circle cx="65" cy="14" r="6" />
              <circle cx="85" cy="14" r="6" />
              <circle cx="105" cy="14" r="6" />
              <circle cx="125" cy="14" r="6" />
              <circle cx="145" cy="14" r="6" />
              <circle cx="165" cy="14" r="6" />
              <circle cx="35" cy="28" r="6" />
              <circle cx="55" cy="28" r="6" />
              <circle cx="75" cy="28" r="6" />
              <circle cx="95" cy="28" r="6" />
              <circle cx="115" cy="28" r="6" />
              <circle cx="135" cy="28" r="6" />
              <circle cx="155" cy="28" r="6" />
            </g>
            <text x="100" y="-4" fontSize="8" fontWeight="bold" fill="#fde047" textAnchor="middle">★ 3D HIVE WALL (4 PLOTS) ★</text>
          </g>

          {/* 3D Flowers in Meadow */}
          <g>
            {/* Sunflower Field */}
            <circle cx="45" cy="120" r="12" fill="#fde047" />
            <circle cx="45" cy="120" r="6" fill="#78350f" />
            <circle cx="85" cy="135" r="14" fill="#fde047" />
            <circle cx="85" cy="135" r="7" fill="#78350f" />
            {/* Mushroom Field */}
            <rect x="238" y="118" width="6" height="12" fill="#fff" />
            <path d="M232,118 Q241,102 250,118 Z" fill="#ef4444" />
            <circle cx="238" cy="112" r="2" fill="#fff" />
            <circle cx="244" cy="114" r="1.8" fill="#fff" />
            {/* Blue Flower */}
            <circle cx="195" cy="145" r="10" fill="#3b82f6" />
            <circle cx="195" cy="145" r="4" fill="#67e8f9" />
          </g>

          {/* 3D Capybara viewed from third-person camera */}
          <g transform="translate(145 130)">
            {/* Shadow */}
            <ellipse cx="15" cy="38" rx="28" ry="10" fill="rgba(0,0,0,0.25)" />
            {/* Capy Body */}
            <ellipse cx="15" cy="20" rx="22" ry="16" fill="#a9764e" />
            {/* Capy Head */}
            <circle cx="15" cy="6" rx="14" ry="12" fill="#ba895e" />
            {/* Yuzu Orange on Head */}
            <circle cx="15" cy="-8" r="6" fill="#f59e0b" />
            <rect x="14" y="-12" width="2" height="4" fill="#22c55e" />
            {/* Translucent Honey Backpack */}
            <rect x="3" y="10" width="24" height="18" rx="4" fill="#f59e0b" stroke="#fff" strokeWidth="1.5" />
            <line x1="15" y1="20" x2="160" y2="70" stroke="#f59e0b" strokeWidth="4" strokeDasharray="6 4" />
          </g>

          {/* 3D Bees hovering in perspective */}
          <g transform="translate(105 105)">
            <ellipse cx="0" cy="0" rx="9" ry="7" fill="#ffd700" />
            <line x1="-2" y1="-6" x2="-2" y2="6" stroke="#111" strokeWidth="2" />
            <ellipse cx="-4" cy="-7" rx="5" ry="3" fill="#e0f2fe" />
            <ellipse cx="4" cy="-7" rx="5" ry="3" fill="#e0f2fe" />
          </g>
          <g transform="translate(195 110)">
            <ellipse cx="0" cy="0" rx="8" ry="6" fill="#ef4444" />
            <line x1="-2" y1="-5" x2="-2" y2="5" stroke="#111" strokeWidth="2" />
            <ellipse cx="-3" cy="-6" rx="4" ry="2.5" fill="#e0f2fe" />
            <ellipse cx="3" cy="-6" rx="4" ry="2.5" fill="#e0f2fe" />
          </g>
          <g transform="translate(160 85)">
            <ellipse cx="0" cy="0" rx="8" ry="6" fill="#3b82f6" />
            <line x1="-2" y1="-5" x2="-2" y2="5" stroke="#111" strokeWidth="2" />
            <ellipse cx="-3" cy="-6" rx="4" ry="2.5" fill="#e0f2fe" />
            <ellipse cx="3" cy="-6" rx="4" ry="2.5" fill="#e0f2fe" />
          </g>

          {/* 3D Black Bear NPC on side */}
          <g transform="translate(280 115) scale(0.85)">
            <ellipse cx="0" cy="12" rx="16" ry="18" fill="#2b2118" />
            <circle cx="0" cy="-6" r="13" fill="#2b2118" />
            <circle cx="-10" cy="-15" r="5" fill="#2b2118" />
            <circle cx="10" cy="-15" r="5" fill="#2b2118" />
            <ellipse cx="0" cy="-4" rx="7" ry="5" fill="#d5a67b" />
            <text x="0" y="-24" fontSize="9" fontWeight="bold" fill="#fff" textAnchor="middle">🐻 BEAR</text>
          </g>
        </svg>
      );

    case 'Bee Swarm Simulator (2D)':
    case 'Bee Swarm':
      return (
        <svg viewBox="0 0 320 200" className="w-full h-full object-cover">
          <rect width="320" height="200" fill="#65ba60" />
          {/* 4 Hive Plots across top */}
          <g>
            <rect x="25" y="15" width="60" height="34" rx="4" fill="#78350f" stroke="#f59e0b" strokeWidth="1.5" />
            <text x="55" y="26" fontSize="7" fontWeight="bold" fill="#fde047" textAnchor="middle">PLOT 1</text>
            <circle cx="45" cy="36" r="4" fill="#fde047" />
            <circle cx="55" cy="36" r="4" fill="#fde047" />
            <circle cx="65" cy="36" r="4" fill="#fde047" />

            <rect x="95" y="15" width="60" height="34" rx="4" fill="#451a03" stroke="#92400e" strokeWidth="1" />
            <text x="125" y="26" fontSize="7" fontWeight="bold" fill="#d97706" textAnchor="middle">PLOT 2</text>
            <circle cx="115" cy="36" r="4" fill="#fde047" />
            <circle cx="125" cy="36" r="4" fill="#fde047" />
            <circle cx="135" cy="36" r="4" fill="#fde047" />

            <rect x="165" y="15" width="60" height="34" rx="4" fill="#451a03" stroke="#92400e" strokeWidth="1" />
            <text x="195" y="26" fontSize="7" fontWeight="bold" fill="#d97706" textAnchor="middle">PLOT 3</text>
            <circle cx="185" cy="36" r="4" fill="#fde047" />
            <circle cx="195" cy="36" r="4" fill="#fde047" />
            <circle cx="205" cy="36" r="4" fill="#fde047" />

            <rect x="235" y="15" width="60" height="34" rx="4" fill="#451a03" stroke="#92400e" strokeWidth="1" />
            <text x="265" y="26" fontSize="7" fontWeight="bold" fill="#d97706" textAnchor="middle">PLOT 4</text>
            <circle cx="255" cy="36" r="4" fill="#fde047" />
            <circle cx="265" cy="36" r="4" fill="#fde047" />
            <circle cx="275" cy="36" r="4" fill="#fde047" />
          </g>

          {/* Floral Fields */}
          <circle cx="55" cy="125" r="38" fill="rgba(253, 224, 71, 0.25)" stroke="#facc15" strokeWidth="1.5" />
          <circle cx="55" cy="125" r="9" fill="#fde047" />
          <circle cx="55" cy="125" r="4" fill="#78350f" />
          <circle cx="40" cy="115" r="7" fill="#fde047" />
          <circle cx="70" cy="135" r="7" fill="#fde047" />

          <circle cx="265" cy="125" r="38" fill="rgba(239, 68, 68, 0.22)" stroke="#ef4444" strokeWidth="1.5" />
          <rect x="263" y="125" width="4" height="10" fill="#fff" />
          <path d="M258,125 Q265,112 272,125 Z" fill="#ef4444" />
          <circle cx="263" cy="120" r="1.5" fill="#fff" />
          <circle cx="267" cy="121" r="1.5" fill="#fff" />

          {/* Black Bear NPC */}
          <g transform="translate(160 55) scale(0.85)">
            <ellipse cx="0" cy="10" rx="14" ry="16" fill="#2b2118" />
            <ellipse cx="0" cy="-6" rx="11" ry="10" fill="#2b2118" />
            <circle cx="-9" cy="-14" r="4" fill="#2b2118" />
            <circle cx="9" cy="-14" r="4" fill="#2b2118" />
            <circle cx="0" cy="2" r="4" fill="#f59e0b" />
            <text x="0" y="-20" fontSize="9" fontWeight="bold" fill="#fff" textAnchor="middle">🐻 BLACK BEAR</text>
          </g>

          {/* Capybara Beekeeper swinging scoop with honey jar */}
          <g transform="translate(150 135)">
            <ellipse cx="0" cy="0" rx="16" ry="12" fill="#a9764e" />
            <circle cx="10" cy="-4" r="9" fill="#ba895e" />
            <circle cx="15" cy="-2" r="2" fill="#222" />
            <circle cx="8" cy="-14" r="4" fill="#f2a23a" />
            {/* Backpack */}
            <rect x="-14" y="-10" width="8" height="14" rx="2" fill="#f59e0b" stroke="#78350f" strokeWidth="1" />
            {/* Scooper tool */}
            <line x1="10" y1="2" x2="22" y2="8" stroke="#78350f" strokeWidth="2.5" />
            <path d="M22,5 A4,4 0 0,1 26,11" stroke="#cbd5e1" strokeWidth="3" fill="none" />
          </g>

          {/* Bees with Gifted Star Bee */}
          <g transform="translate(115 110)">
            <circle cx="0" cy="0" r="12" fill="rgba(254, 240, 138, 0.4)" />
            <ellipse cx="0" cy="0" rx="8" ry="6" fill="#ffd700" />
            <line x1="-2" y1="-5" x2="-2" y2="5" stroke="#111" strokeWidth="2" />
            <ellipse cx="-3" cy="-6" rx="4" ry="2.5" fill="#e8f6ff" />
            <ellipse cx="3" cy="-6" rx="4" ry="2.5" fill="#e8f6ff" />
          </g>
          <g transform="translate(195 115)">
            <ellipse cx="0" cy="0" rx="8" ry="6" fill="#f25c5c" />
            <line x1="-2" y1="-5" x2="-2" y2="5" stroke="#111" strokeWidth="2" />
            <ellipse cx="-3" cy="-6" rx="4" ry="2.5" fill="#e8f6ff" />
            <ellipse cx="3" cy="-6" rx="4" ry="2.5" fill="#e8f6ff" />
          </g>

          {/* Hostile Beetle Mob */}
          <g transform="translate(205 160)">
            <ellipse cx="0" cy="0" rx="10" ry="8" fill="#581c87" />
            <rect x="-12" y="-14" width="24" height="3" fill="#22c55e" />
          </g>
        </svg>
      );

    case 'Capy Quest: Dungeon of the Sun':
    case 'Capy Quest':
      return (
        <svg viewBox="0 0 320 200" className="w-full h-full object-cover">
          <defs>
            <linearGradient id="dungeonFloor" x1="0" y1="0" x2="0" y2="1">
              <stop stopColor="#1e1b2e" />
              <stop offset="1" stopColor="#0f0c1b" />
            </linearGradient>
            <radialGradient id="torchGlow" cx="0.5" cy="0.5" r="0.5">
              <stop stopColor="#f59e0b" stopOpacity="0.4" />
              <stop offset="1" stopColor="#f59e0b" stopOpacity="0" />
            </radialGradient>
          </defs>
          <rect width="320" height="200" fill="url(#dungeonFloor)" />

          {/* Stone Dungeon Bricks */}
          <g stroke="#2d264a" strokeWidth="1" fill="none">
            <line x1="0" y1="50" x2="320" y2="50" />
            <line x1="0" y1="100" x2="320" y2="100" />
            <line x1="0" y1="150" x2="320" y2="150" />
            <line x1="40" y1="0" x2="40" y2="50" />
            <line x1="120" y1="0" x2="120" y2="50" />
            <line x1="200" y1="0" x2="200" y2="50" />
            <line x1="280" y1="0" x2="280" y2="50" />
            <line x1="80" y1="50" x2="80" y2="100" />
            <line x1="160" y1="50" x2="160" y2="100" />
            <line x1="240" y1="50" x2="240" y2="100" />
          </g>

          {/* Glowing Wall Torches */}
          <circle cx="45" cy="40" r="35" fill="url(#torchGlow)" />
          <rect x="42" y="38" width="6" height="14" fill="#78350f" />
          <polygon points="45,28 50,38 40,38" fill="#f59e0b" />

          <circle cx="275" cy="40" r="35" fill="url(#torchGlow)" />
          <rect x="272" y="38" width="6" height="14" fill="#78350f" />
          <polygon points="275,28 280,38 270,38" fill="#f59e0b" />

          {/* Slime Monster */}
          <g transform="translate(230 130)">
            <ellipse cx="0" cy="6" rx="18" ry="12" fill="#22c55e" opacity="0.9" />
            <circle cx="-6" cy="3" r="2.5" fill="#fff" />
            <circle cx="6" cy="3" r="2.5" fill="#fff" />
            <circle cx="-6" cy="3" r="1.2" fill="#000" />
            <circle cx="6" cy="3" r="1.2" fill="#000" />
          </g>

          {/* Golden Treasure Chest */}
          <g transform="translate(150 40)">
            <rect x="0" y="8" width="28" height="18" rx="3" fill="#b45309" stroke="#f59e0b" strokeWidth="2" />
            <path d="M0,8 Q14,0 28,8 Z" fill="#d97706" />
            <circle cx="14" cy="17" r="3" fill="#fde047" />
          </g>

          {/* Capybara Adventurer with Sun Sword & Shield */}
          <g transform="translate(110 120)">
            {/* Shadow */}
            <ellipse cx="14" cy="24" rx="22" ry="8" fill="rgba(0,0,0,0.4)" />
            {/* Body */}
            <ellipse cx="14" cy="10" rx="18" ry="14" fill="#a9764e" />
            {/* Head */}
            <circle cx="24" cy="2" r="11" fill="#ba895e" />
            {/* Iron Helmet */}
            <path d="M14,-4 Q24,-14 34,-4 L32,2 L16,2 Z" fill="#94a3b8" stroke="#64748b" strokeWidth="1.5" />
            {/* Glowing Sun Sword */}
            <line x1="32" y1="8" x2="52" y2="-4" stroke="#fbbf24" strokeWidth="4" />
            <circle cx="52" cy="-4" r="5" fill="#fde047" />
            {/* Wooden Shield */}
            <ellipse cx="2" cy="12" rx="7" ry="12" fill="#78350f" stroke="#b45309" strokeWidth="2" />
          </g>

          {/* Ancient Sun Relic Icon */}
          <g transform="translate(160 100)">
            <circle cx="0" cy="0" r="12" fill="#f59e0b" opacity="0.3" />
            <circle cx="0" cy="0" r="8" fill="#fbbf24" />
            <text x="0" y="3" fontSize="9" fontWeight="bold" fill="#78350f" textAnchor="middle">☼</text>
          </g>
        </svg>
      );

    case 'Island Expedition':
      return (
        <svg viewBox="0 0 320 200" className="w-full h-full object-cover">
          <defs>
            <linearGradient id="seaBg" x1="0" y1="0" x2="0" y2="1">
              <stop stopColor="#0284c7" />
              <stop offset="1" stopColor="#0369a1" />
            </linearGradient>
          </defs>
          <rect width="320" height="200" fill="url(#seaBg)" />

          {/* Wave ripples */}
          <g stroke="#38bdf8" strokeWidth="1.5" opacity="0.4" fill="none">
            <path d="M20,60 Q40,55 60,60 T100,60" />
            <path d="M180,40 Q200,35 220,40 T260,40" />
            <path d="M30,150 Q50,145 70,150 T110,150" />
            <path d="M200,165 Q220,160 240,165 T280,165" />
          </g>

          {/* Sandy Island with Palm Trees */}
          <g transform="translate(60 70)">
            <ellipse cx="0" cy="0" rx="48" ry="32" fill="#fef08a" stroke="#ca8a04" strokeWidth="2" />
            <ellipse cx="-5" cy="-4" rx="34" ry="22" fill="#86efac" />
            {/* Palm Tree */}
            <path d="M-10,0 Q-4,-22 0,-28" stroke="#78350f" strokeWidth="3.5" fill="none" />
            <ellipse cx="0" cy="-30" rx="14" ry="5" fill="#15803d" />
            <ellipse cx="-8" cy="-28" rx="12" ry="4" fill="#16a34a" />
            <ellipse cx="8" cy="-28" rx="12" ry="4" fill="#16a34a" />
          </g>

          {/* Wooden Sailboat with Billowing White Sail */}
          <g transform="translate(200 115)">
            {/* Water wake */}
            <ellipse cx="0" cy="20" rx="32" ry="7" fill="rgba(255,255,255,0.3)" />
            {/* Boat Hull */}
            <path d="M-28,14 Q0,26 28,14 L22,6 L-22,6 Z" fill="#854d0e" stroke="#543007" strokeWidth="1.5" />
            {/* Mast */}
            <line x1="0" y1="6" x2="0" y2="-32" stroke="#451a03" strokeWidth="3" />
            {/* Main Sail */}
            <path d="M2,-30 L22,-8 L2,-6 Z" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1" />
            {/* Jib Sail */}
            <path d="M-2,-26 L-18,-8 L-2,-8 Z" fill="#38bdf8" />
            {/* Captain Capybara at helm */}
            <circle cx="-12" cy="3" r="6" fill="#ba895e" />
            <circle cx="-12" cy="-3" r="3.5" fill="#f59e0b" />
          </g>

          {/* Jumping Fish with Water Splash */}
          <g transform="translate(135 155)">
            <path d="M0,0 Q6,-8 12,0 T24,0" stroke="#fff" strokeWidth="1.5" fill="none" />
            <text x="6" y="-4" fontSize="16">🐟</text>
          </g>
        </svg>
      );

    case 'Pond Snake':
      return (
        <svg viewBox="0 0 320 200" className="w-full h-full object-cover">
          {/* Lilypad checkerboard grid */}
          <rect width="320" height="200" fill="#98cfb0" />
          <g fill="#8bc4a3">
            <rect x="0" y="0" width="40" height="40" />
            <rect x="80" y="0" width="40" height="40" />
            <rect x="160" y="0" width="40" height="40" />
            <rect x="240" y="0" width="40" height="40" />
            <rect x="40" y="40" width="40" height="40" />
            <rect x="120" y="40" width="40" height="40" />
            <rect x="200" y="40" width="40" height="40" />
            <rect x="280" y="40" width="40" height="40" />
            <rect x="0" y="80" width="40" height="40" />
            <rect x="80" y="80" width="40" height="40" />
            <rect x="160" y="80" width="40" height="40" />
            <rect x="240" y="80" width="40" height="40" />
            <rect x="40" y="120" width="40" height="40" />
            <rect x="120" y="120" width="40" height="40" />
            <rect x="200" y="120" width="40" height="40" />
            <rect x="280" y="120" width="40" height="40" />
            <rect x="0" y="160" width="40" height="40" />
            <rect x="80" y="160" width="40" height="40" />
            <rect x="160" y="160" width="40" height="40" />
            <rect x="240" y="160" width="40" height="40" />
          </g>
          {/* Snake body segments */}
          <rect x="70" y="95" width="26" height="24" rx="6" fill="#1b4a35" />
          <rect x="100" y="95" width="26" height="24" rx="6" fill="#205c42" />
          <rect x="130" y="95" width="26" height="24" rx="6" fill="#266f4f" />
          <rect x="160" y="95" width="26" height="24" rx="6" fill="#2d825c" />
          {/* Snake head */}
          <rect x="160" y="65" width="28" height="28" rx="8" fill="#34966a" />
          <circle cx="168" cy="74" r="2.5" fill="#fff" />
          <circle cx="180" cy="74" r="2.5" fill="#fff" />
          {/* Clover target 🍀 */}
          <text x="235" y="85" fontSize="32" textAnchor="middle">🍀</text>
        </svg>
      );

    case 'Capy Pong':
      return (
        <svg viewBox="0 0 320 200" className="w-full h-full object-cover">
          <defs>
            <linearGradient id="pongBg" x1="0" y1="0" x2="0" y2="1">
              <stop stopColor="#0c2225" />
              <stop offset="1" stopColor="#153b3a" />
            </linearGradient>
          </defs>
          <rect width="320" height="200" fill="url(#pongBg)" />
          {/* Dotted net line */}
          <line x1="160" y1="0" x2="160" y2="200" stroke="#ffffff30" strokeWidth="3" strokeDasharray="8 10" />
          {/* Player cyan paddle with capybara badge */}
          <rect x="25" y="65" width="12" height="70" rx="6" fill="#7ef0df" />
          <text x="13" y="106" fontSize="18">🐹</text>
          {/* AI pink paddle */}
          <rect x="283" y="85" width="12" height="70" rx="6" fill="#ff85b2" />
          {/* Speed motion trail */}
          <line x1="120" y1="92" x2="175" y2="108" stroke="#ffe08a" strokeWidth="2" strokeDasharray="4 6" opacity="0.6" />
          {/* Golden glowing pong ball */}
          <circle cx="175" cy="108" r="8" fill="#ffe08a" />
          <circle cx="175" cy="108" r="14" fill="#ffe08a" opacity="0.2" />
        </svg>
      );

    case 'Mud Bricks':
      return (
        <svg viewBox="0 0 320 200" className="w-full h-full object-cover">
          <defs>
            <linearGradient id="brickBg" x1="0" y1="0" x2="0" y2="1">
              <stop stopColor="#f8ede0" />
              <stop offset="1" stopColor="#dfc9a6" />
            </linearGradient>
          </defs>
          <rect width="320" height="200" fill="url(#brickBg)" />
          {/* Rows of breakout bricks in rainbow mud hues */}
          <g>
            <rect x="25" y="30" width="48" height="15" rx="3" fill="#c97b5a" />
            <rect x="80" y="30" width="48" height="15" rx="3" fill="#d9a25a" />
            <rect x="135" y="30" width="48" height="15" rx="3" fill="#a8b86a" />
            <rect x="190" y="30" width="48" height="15" rx="3" fill="#5fa88a" />
            <rect x="245" y="30" width="48" height="15" rx="3" fill="#6a8cc9" />

            <rect x="52" y="52" width="48" height="15" rx="3" fill="#b86a9a" />
            <rect x="107" y="52" width="48" height="15" rx="3" fill="#c97b5a" />
            <rect x="162" y="52" width="48" height="15" rx="3" fill="#d9a25a" />
            <rect x="217" y="52" width="48" height="15" rx="3" fill="#5fa88a" />
          </g>
          {/* Bouncing red breakout ball */}
          <circle cx="185" cy="120" r="7.5" fill="#c0392b" />
          <circle cx="183" cy="118" r="2.5" fill="#ffffff" />
          {/* Brick shatter debris sparks */}
          <g fill="#a8b86a">
            <circle cx="175" cy="75" r="3" />
            <circle cx="182" cy="70" r="2.5" />
            <circle cx="190" cy="78" r="2" />
          </g>
          {/* Paddle with capybara mascot */}
          <rect x="115" y="165" width="85" height="14" rx="7" fill="#3f8a60" />
          <text x="157" y="162" fontSize="16" textAnchor="middle">🐹</text>
        </svg>
      );

    default:
      return (
        <div className="w-full h-full bg-slate-900 flex items-center justify-center text-white font-bold">
          {id}
        </div>
      );
  }
}
