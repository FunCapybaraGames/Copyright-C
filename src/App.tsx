import React, { useState, useEffect, useMemo } from 'react';
import { GAMES } from './gameRegistry';
import { GameMetadata, UserPrefs, UserAccount, BeeSaveData } from './types';
import { soundEngine } from './soundEngine';
import { vfx, spawnDomBurst } from './vfxEngine';
import { GameCard } from './components/GameCard';
import { GameModal } from './components/GameModal';
import { SettingsModal } from './components/SettingsModal';
import { AuthModal } from './components/AuthModal';
import { FriendsTab } from './components/FriendsTab';
import { CapyBuddy } from './components/CapyBuddy';
import {
  Search,
  Settings,
  Heart,
  Compass,
  Gamepad2,
  Puzzle,
  Box,
  Home,
  Menu,
  X,
  Sparkles,
  User,
  Users,
  Volume2,
  VolumeX,
} from 'lucide-react';

const PREFS_KEY = 'capyPrefs';
const ACCOUNT_SESSION_KEY = 'capyCurrentAccount';

export default function App() {
  // Preferences State
  const [prefs, setPrefs] = useState<UserPrefs>(() => {
    try {
      const stored = localStorage.getItem(PREFS_KEY);
      if (stored) return { ...defaultPrefs, ...JSON.parse(stored) };
    } catch {}
    return defaultPrefs;
  });

  // Numbered User Account State
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(() => {
    try {
      const stored = localStorage.getItem(ACCOUNT_SESSION_KEY);
      if (stored) return JSON.parse(stored);
    } catch {}
    return null;
  });

  // Favorites & Scores State
  const [favorites, setFavorites] = useState<Set<string>>(() => {
    try {
      if (currentUser?.data?.favorites) {
        return new Set(currentUser.data.favorites);
      }
      const stored = localStorage.getItem('capyFavorites');
      if (stored) return new Set(JSON.parse(stored));
    } catch {}
    return new Set<string>();
  });

  const [bestScores, setBestScores] = useState<Record<string, number>>(() => {
    try {
      if (currentUser?.data?.bestScores) {
        return currentUser.data.bestScores;
      }
      const stored = localStorage.getItem('capyBest');
      if (stored) return JSON.parse(stored);
    } catch {}
    return {};
  });

  const [beeSave, setBeeSave] = useState<BeeSaveData | undefined>(() => {
    try {
      if (currentUser?.data?.beeSave) {
        return currentUser.data.beeSave;
      }
      const stored = localStorage.getItem('capyBee');
      if (stored) return JSON.parse(stored);
    } catch {}
    return undefined;
  });

  // UI state
  const [currentView, setCurrentView] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeGame, setActiveGame] = useState<GameMetadata | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  // Sync Audio & Theme to DOM
  useEffect(() => {
    soundEngine.updateSettings(prefs.sound, prefs.music, prefs.sfxVolume, prefs.musicVolume);
    vfx.enabled = prefs.vfx;
    vfx.reduceMotion = prefs.reduceMotion;

    let isDark = prefs.theme === 'dark';
    if (prefs.theme === 'system') {
      isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    document.documentElement.classList.toggle('dark', isDark);

    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    } catch {}
  }, [prefs]);

  // Sync Account to localStorage and Server
  const syncAccountData = async (dataUpdates: Partial<UserAccount['data']>) => {
    if (!currentUser) return;
    const updatedData = { ...currentUser.data, ...dataUpdates };
    const updatedUser: UserAccount = { ...currentUser, data: updatedData };
    setCurrentUser(updatedUser);
    localStorage.setItem(ACCOUNT_SESSION_KEY, JSON.stringify(updatedUser));

    try {
      await fetch('/api/auth/sync-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id, data: dataUpdates }),
      });
    } catch {}
  };

  // Poll pending friend requests count
  useEffect(() => {
    if (!currentUser) {
      setPendingCount(0);
      return;
    }

    const checkRequests = async () => {
      try {
        const res = await fetch(`/api/friends?userId=${currentUser.id}`);
        if (res.ok) {
          const data = await res.json();
          setPendingCount((data.pendingIncoming || []).length);
        }
      } catch {}
    };

    checkRequests();
    const timer = setInterval(checkRequests, 5000);
    return () => clearInterval(timer);
  }, [currentUser]);

  // Update preferences
  const handleUpdatePrefs = (updated: Partial<UserPrefs>) => {
    setPrefs((prev) => ({ ...prev, ...updated }));
  };

  // Toggle favorite
  const handleToggleFavorite = (gameId: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(gameId)) next.delete(gameId);
      else next.add(gameId);

      const arrayFavs = Array.from(next);
      localStorage.setItem('capyFavorites', JSON.stringify(arrayFavs));
      syncAccountData({ favorites: arrayFavs });
      return next;
    });
  };

  // Record new best score
  const handleNewBestScore = (gameId: string, score: number) => {
    setBestScores((prev) => {
      const next = { ...prev, [gameId]: Math.max(prev[gameId] || 0, score) };
      localStorage.setItem('capyBest', JSON.stringify(next));
      syncAccountData({ bestScores: next });
      return next;
    });
  };

  // Save Bee Swarm data
  const handleSaveBee = (data: BeeSaveData) => {
    setBeeSave(data);
    localStorage.setItem('capyBee', JSON.stringify(data));
    syncAccountData({ beeSave: data });
  };

  // Account login callback
  const handleLoginSuccess = (account: UserAccount) => {
    setCurrentUser(account);
    localStorage.setItem(ACCOUNT_SESSION_KEY, JSON.stringify(account));
    if (account.data) {
      if (account.data.favorites) setFavorites(new Set(account.data.favorites));
      if (account.data.bestScores) setBestScores(account.data.bestScores);
      if (account.data.beeSave) setBeeSave(account.data.beeSave);
    }
  };

  // Account logout
  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem(ACCOUNT_SESSION_KEY);
  };

  // Surprise random game picker
  const handleSurpriseMe = (e: React.MouseEvent) => {
    const randomGame = GAMES[Math.floor(Math.random() * GAMES.length)];
    soundEngine.play('coin');
    spawnDomBurst(e.clientX || window.innerWidth / 2, e.clientY || window.innerHeight / 2, 16);
    setActiveGame(randomGame);
  };

  // Filter games
  const filteredGames = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return GAMES.filter((game) => {
      const matchesSearch =
        game.title.toLowerCase().includes(query) ||
        game.categoryLabel.toLowerCase().includes(query) ||
        game.description.toLowerCase().includes(query);

      let matchesCategory = true;
      if (currentView === 'Favorites') {
        matchesCategory = favorites.has(game.id);
      } else if (currentView === 'My Games') {
        matchesCategory = (bestScores[game.id] || 0) > 0 || favorites.has(game.id);
      } else if (currentView !== 'All') {
        matchesCategory = game.category === currentView;
      }

      return matchesSearch && matchesCategory;
    });
  }, [searchQuery, currentView, favorites, bestScores]);

  // Keyboard shortcut '/' to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        e.preventDefault();
        document.getElementById('main-search-input')?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="min-h-screen bg-[#f5f7f2] dark:bg-[#111611] text-[#202820] dark:text-[#edf3e9] flex flex-col antialiased transition-colors duration-200">
      {/* Ambient background glows */}
      <div className="fixed top-16 right-4 w-96 h-96 rounded-full bg-emerald-400/10 blur-3xl pointer-events-none -z-10" />
      <div className="fixed bottom-1/4 left-1/3 w-80 h-80 rounded-full bg-amber-400/10 blur-3xl pointer-events-none -z-10" />

      {/* Top Bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-4 md:gap-8 min-h-[66px] px-4 md:px-8 bg-white/85 dark:bg-[#161f16]/85 backdrop-blur-md border-b border-slate-200 dark:border-[#263526]">
        {/* Zone 1: Brand wordmark */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => setIsMobileNavOpen(!isMobileNavOpen)}
            className="md:hidden p-1.5 text-slate-600 dark:text-slate-300 hover:text-slate-900 rounded-lg"
          >
            {isMobileNavOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              setCurrentView('All');
              soundEngine.play('click');
            }}
            className="flex items-center gap-2 font-display font-extrabold text-base tracking-tight whitespace-nowrap text-slate-900 dark:text-white group"
          >
            <span className="flex items-center justify-center w-8 h-8 rounded-xl bg-emerald-700 text-white font-extrabold text-lg shadow-xs group-hover:scale-105 transition-transform">
              c<span className="text-emerald-300">.</span>
            </span>
            <span>
              capybara<span className="text-slate-400 dark:text-slate-500 font-medium">.games</span>
            </span>
          </a>
        </div>

        {/* Zone 2: Navigation Links */}
        <nav className="hidden md:flex items-center gap-6 text-xs font-bold text-slate-600 dark:text-slate-400">
          <button
            onClick={() => {
              setCurrentView('All');
              soundEngine.play('click');
            }}
            className={`whitespace-nowrap transition-colors hover:text-slate-900 dark:hover:text-white ${
              currentView === 'All' ? 'text-emerald-700 dark:text-emerald-400 font-extrabold' : ''
            }`}
          >
            Home
          </button>
          <button
            onClick={() => {
              setCurrentView('Adventure');
              soundEngine.play('click');
            }}
            className={`whitespace-nowrap transition-colors hover:text-slate-900 dark:hover:text-white ${
              currentView === 'Adventure' ? 'text-emerald-700 dark:text-emerald-400 font-extrabold' : ''
            }`}
          >
            Adventure
          </button>
          <button
            onClick={() => {
              setCurrentView('Arcade');
              soundEngine.play('click');
            }}
            className={`whitespace-nowrap transition-colors hover:text-slate-900 dark:hover:text-white ${
              currentView === 'Arcade' ? 'text-emerald-700 dark:text-emerald-400 font-extrabold' : ''
            }`}
          >
            Arcade
          </button>
          <button
            onClick={() => {
              setCurrentView('Puzzle');
              soundEngine.play('click');
            }}
            className={`whitespace-nowrap transition-colors hover:text-slate-900 dark:hover:text-white ${
              currentView === 'Puzzle' ? 'text-emerald-700 dark:text-emerald-400 font-extrabold' : ''
            }`}
          >
            Puzzle
          </button>
          <button
            onClick={() => {
              setCurrentView('3D');
              soundEngine.play('click');
            }}
            className={`whitespace-nowrap transition-colors hover:text-slate-900 dark:hover:text-white ${
              currentView === '3D' ? 'text-emerald-700 dark:text-emerald-400 font-extrabold' : ''
            }`}
          >
            3D Worlds
          </button>
          <button
            onClick={() => {
              setCurrentView('Friends');
              soundEngine.play('click');
            }}
            className={`relative flex items-center gap-1.5 whitespace-nowrap transition-colors hover:text-slate-900 dark:hover:text-white ${
              currentView === 'Friends' ? 'text-emerald-700 dark:text-emerald-400 font-extrabold' : ''
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Friends</span>
            {pendingCount > 0 && (
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            )}
          </button>
        </nav>

        {/* Zone 3: Search, Settings & Account Action */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <div className="relative hidden sm:flex items-center">
            <Search className="w-3.5 h-3.5 absolute left-3 text-slate-400 pointer-events-none" />
            <input
              id="main-search-input"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Find your next game..."
              className="w-48 lg:w-60 pl-8 pr-7 py-1.5 text-xs bg-slate-100 dark:bg-[#1c271c] border border-slate-200 dark:border-[#2b3a2b] rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 transition-all"
            />
            <kbd className="absolute right-2 px-1 py-0.5 text-[9px] font-mono text-slate-400 bg-white dark:bg-[#162016] border border-slate-200 dark:border-[#2d3d2d] rounded">
              /
            </kbd>
          </div>

          <button
            onClick={() => {
              handleUpdatePrefs({ sound: !prefs.sound });
              soundEngine.play('click');
            }}
            className="p-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-[#1e281e] transition-colors"
            title={prefs.sound ? 'Mute SFX' : 'Unmute SFX'}
          >
            {prefs.sound ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4 text-red-500" />}
          </button>

          <button
            onClick={() => {
              soundEngine.play('click');
              setIsSettingsOpen(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-[#1c271c] border border-slate-200 dark:border-[#2b3a2b] hover:border-emerald-400 rounded-xl transition-all"
            title="Settings"
          >
            <Settings className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden sm:inline">Settings</span>
          </button>

          <button
            onClick={() => {
              soundEngine.play('click');
              setIsAuthOpen(true);
            }}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl shadow-xs transition-all whitespace-nowrap shrink-0"
          >
            {currentUser ? (
              <>
                <span className="w-4 h-4 rounded-full bg-emerald-400 text-emerald-950 flex items-center justify-center text-[10px] font-black">
                  {currentUser.username[0].toUpperCase()}
                </span>
                <span className="truncate max-w-[85px]">{currentUser.username} (#{currentUser.id})</span>
              </>
            ) : (
              <>
                <User className="w-3.5 h-3.5" />
                <span>Log In</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* Main Layout */}
      <div className="flex-1 flex max-w-[1440px] w-full mx-auto">
        {/* Desktop Sidebar */}
        <aside
          className={`fixed inset-y-0 left-0 z-40 w-64 p-5 bg-white dark:bg-[#161f16] border-r border-slate-200 dark:border-[#263526] flex flex-col md:static md:w-56 lg:w-60 transition-transform duration-200 ${
            isMobileNavOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
          }`}
        >
          <div className="flex items-center justify-between pb-3 md:hidden">
            <span className="font-display font-bold text-sm">Navigation</span>
            <button onClick={() => setIsMobileNavOpen(false)}>
              <X className="w-5 h-5 text-slate-400" />
            </button>
          </div>

          <div className="text-[10px] font-extrabold tracking-wider text-slate-400 dark:text-slate-500 uppercase px-2 mb-2">
            Discover
          </div>
          <nav className="space-y-1 text-xs font-bold">
            <SidebarItem
              icon={<Home className="w-4 h-4" />}
              label="Home"
              active={currentView === 'All'}
              onClick={() => {
                setCurrentView('All');
                setIsMobileNavOpen(false);
                soundEngine.play('click');
              }}
            />
            <SidebarItem
              icon={<Compass className="w-4 h-4" />}
              label="Adventure"
              active={currentView === 'Adventure'}
              onClick={() => {
                setCurrentView('Adventure');
                setIsMobileNavOpen(false);
                soundEngine.play('click');
              }}
            />
            <SidebarItem
              icon={<Gamepad2 className="w-4 h-4" />}
              label="Arcade"
              active={currentView === 'Arcade'}
              onClick={() => {
                setCurrentView('Arcade');
                setIsMobileNavOpen(false);
                soundEngine.play('click');
              }}
            />
            <SidebarItem
              icon={<Puzzle className="w-4 h-4" />}
              label="Puzzle"
              active={currentView === 'Puzzle'}
              onClick={() => {
                setCurrentView('Puzzle');
                setIsMobileNavOpen(false);
                soundEngine.play('click');
              }}
            />
            <SidebarItem
              icon={<Box className="w-4 h-4" />}
              label="3D Worlds"
              badge="NEW"
              active={currentView === '3D'}
              onClick={() => {
                setCurrentView('3D');
                setIsMobileNavOpen(false);
                soundEngine.play('click');
              }}
            />
          </nav>

          <div className="text-[10px] font-extrabold tracking-wider text-slate-400 dark:text-slate-500 uppercase px-2 mt-6 mb-2">
            Your Space
          </div>
          <nav className="space-y-1 text-xs font-bold">
            <SidebarItem
              icon={<Users className="w-4 h-4" />}
              label="Friends & Chat"
              count={pendingCount > 0 ? pendingCount : undefined}
              badge={pendingCount > 0 ? 'REQUEST' : undefined}
              active={currentView === 'Friends'}
              onClick={() => {
                setCurrentView('Friends');
                setIsMobileNavOpen(false);
                soundEngine.play('click');
              }}
            />
            <SidebarItem
              icon={<Sparkles className="w-4 h-4" />}
              label="My Games"
              active={currentView === 'My Games'}
              onClick={() => {
                setCurrentView('My Games');
                setIsMobileNavOpen(false);
                soundEngine.play('click');
              }}
            />
            <SidebarItem
              icon={<Heart className="w-4 h-4" />}
              label="Favorites"
              count={favorites.size}
              active={currentView === 'Favorites'}
              onClick={() => {
                setCurrentView('Favorites');
                setIsMobileNavOpen(false);
                soundEngine.play('click');
              }}
            />
          </nav>

          {/* Surprise Me Box */}
          <div className="mt-auto pt-6">
            <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-50 to-emerald-100/60 dark:from-[#1b261b] dark:to-[#172217] border border-emerald-200/70 dark:border-[#2a3a2a]">
              <div className="text-sm">✦</div>
              <div className="font-display font-bold text-xs text-slate-900 dark:text-white mt-1">
                Your next favorite?
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed my-2">
                Handcrafted little games made to play right in your browser.
              </p>
              <button
                onClick={handleSurpriseMe}
                className="w-full py-2 text-xs font-extrabold text-slate-900 dark:text-white bg-white dark:bg-[#202b20] border border-emerald-300 dark:border-[#2f402f] hover:border-emerald-500 rounded-xl shadow-xs transition-all active:scale-98"
              >
                Surprise me ↗
              </button>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-slate-400 dark:text-slate-500 mt-3 px-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>All 10 games run in browser</span>
            </div>
          </div>
        </aside>

        {/* Content Area */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 min-w-0">
          {/* If Friends tab is selected, render FriendsTab */}
          {currentView === 'Friends' ? (
            <FriendsTab
              currentUser={currentUser}
              onOpenAuth={() => setIsAuthOpen(true)}
            />
          ) : (
            <>
              {/* Welcome Hero */}
              {currentView === 'All' && !searchQuery && (
                <section className="mb-10 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                  <div className="lg:col-span-5 space-y-4">
                    <div className="flex items-center gap-2 text-[10px] font-extrabold tracking-widest text-emerald-700 dark:text-emerald-400 uppercase">
                      <span>✦</span>
                      <span>YOUR PERSONAL BROWSER PLAYGROUND</span>
                    </div>
                    <h1 className="font-display text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-[1.08] text-balance">
                      A little escape.{' '}
                      <span className="text-emerald-700 dark:text-emerald-400">A lot of fun.</span>
                    </h1>
                    <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed max-w-md">
                      Discover tiny adventures, arcade challenges, cozy puzzles, and strange little worlds
                      — complete with handcrafted sound effects, procedural music, and fluid animations.
                    </p>
                    <div className="flex items-center gap-4 pt-1">
                      <button
                        onClick={() => {
                          const el = document.getElementById('collection-anchor');
                          el?.scrollIntoView({ behavior: 'smooth' });
                          soundEngine.play('click');
                        }}
                        className="px-5 py-2.5 text-xs font-extrabold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl shadow-md transition-all active:scale-95"
                      >
                        Explore games ↘
                      </button>
                      <span className="text-xs text-slate-400 dark:text-slate-500">
                        No downloads · Just play
                      </span>
                    </div>
                  </div>

                  <div className="lg:col-span-7 relative rounded-2xl overflow-hidden border border-slate-200 dark:border-[#2b3a2b] shadow-lg group">
                    <svg viewBox="0 0 700 380" className="w-full h-auto block">
                      <defs>
                        <linearGradient id="heroSky" x1="0" y1="0" x2="0" y2="1">
                          <stop stopColor="#c9e8d6" />
                          <stop offset="1" stopColor="#f4edcf" />
                        </linearGradient>
                        <linearGradient id="heroHill" x1="0" y1="0" x2="1" y2="1">
                          <stop stopColor="#8fc49a" />
                          <stop offset="1" stopColor="#5c9b77" />
                        </linearGradient>
                      </defs>
                      <rect width="700" height="380" fill="url(#heroSky)" />
                      <circle cx="540" cy="80" r="42" fill="#f4cb78" />
                      <circle cx="540" cy="80" r="58" fill="#f4cb78" opacity="0.18" />
                      <path d="M0 238 112 102 220 230 355 78 520 250 630 130 700 205V380H0Z" fill="#a7cdb0" />
                      <path d="M0 276 156 185 278 270 435 160 590 279 700 212V380H0Z" fill="#7db28c" />
                      <path d="M0 310Q155 252 280 315T530 302T700 294V380H0Z" fill="url(#heroHill)" />
                      <path d="M0 344Q150 305 280 350T700 334V380H0Z" fill="#4d8967" />

                      <g className="animate-capy-float">
                        <g transform="translate(295 210)">
                          <ellipse cx="55" cy="93" rx="75" ry="12" fill="#315d45" opacity="0.2" />
                          <ellipse cx="55" cy="63" rx="59" ry="43" fill="#a9764e" />
                          <ellipse cx="26" cy="29" rx="37" ry="34" fill="#ba895e" />
                          <ellipse cx="2" cy="43" rx="23" ry="17" fill="#d5a67b" />
                          <ellipse cx="-14" cy="44" rx="7" ry="5" fill="#644630" />
                          <circle cx="16" cy="22" r="4" fill="#272b22" />
                          <ellipse cx="8" cy="0" rx="10" ry="12" fill="#9a6b48" />
                          <ellipse cx="9" cy="2" rx="5" ry="7" fill="#d8a57a" />
                          <path d="M30 95 27 112 45 112 48 99M79 97 82 112 99 112 96 91" fill="#8b5e3e" />
                          <circle cx="30" cy="-6" r="10" fill="#f2a23a" />
                          <path d="M30 -16q8-6 12 0q-8 4-12 0Z" fill="#4f9a52" />
                          <ellipse cx="6" cy="34" rx="6" ry="3.5" fill="#f0907855" />
                        </g>
                      </g>
                    </svg>

                    <div className="absolute bottom-3 right-3 px-3 py-1.5 rounded-lg bg-white/90 dark:bg-black/80 backdrop-blur-md text-[10px] font-bold text-slate-700 dark:text-slate-200 shadow-xs">
                      ✦ A world of your own
                    </div>
                  </div>
                </section>
              )}

              {/* Game Library Grid */}
              <section id="collection-anchor" className="space-y-4">
                <div className="flex items-end justify-between border-b border-slate-200 dark:border-[#263526] pb-3">
                  <div>
                    <div className="text-[10px] font-extrabold tracking-wider text-slate-400 dark:text-slate-500 uppercase">
                      The Collection
                    </div>
                    <h2 className="text-xl font-display font-extrabold text-slate-900 dark:text-white">
                      {currentView === 'All' ? 'Explore all games' : currentView}
                    </h2>
                  </div>
                  <span className="text-xs font-mono font-bold text-slate-400 dark:text-slate-500">
                    {String(filteredGames.length).padStart(2, '0')} GAMES
                  </span>
                </div>

                {filteredGames.length === 0 ? (
                  <div className="py-16 text-center space-y-2">
                    <div className="text-3xl">🐹</div>
                    <h3 className="font-bold text-sm text-slate-700 dark:text-slate-300">
                      No games found
                    </h3>
                    <p className="text-xs text-slate-400">
                      Try searching for another keyword or switch category.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
                    {filteredGames.map((game) => (
                      <GameCard
                        key={game.id}
                        game={game}
                        isFavorite={favorites.has(game.id)}
                        onToggleFavorite={handleToggleFavorite}
                        onOpenGame={setActiveGame}
                      />
                    ))}
                  </div>
                )}
              </section>
            </>
          )}

          {/* Footer */}
          <footer className="mt-16 pt-8 pb-12 border-t border-slate-200 dark:border-[#263526] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400 dark:text-slate-500">
            <div className="flex items-center gap-2">
              <span className="font-bold text-emerald-700 dark:text-emerald-400">capybara.games</span>
              <span>·</span>
              <span>Small games. Big chill.</span>
            </div>
            <div>© {new Date().getFullYear()} · Handcrafted for fun</div>
          </footer>
        </main>
      </div>

      {/* Game Play Dialog Modal */}
      {activeGame && (
        <GameModal
          game={activeGame}
          onClose={() => setActiveGame(null)}
          bestScore={bestScores[activeGame.id] || 0}
          onNewBestScore={handleNewBestScore}
          beeSave={beeSave}
          onSaveBee={handleSaveBee}
        />
      )}

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        prefs={prefs}
        onUpdatePrefs={handleUpdatePrefs}
      />

      {/* Account Login / Register Modal */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        currentUser={currentUser}
        onLoginSuccess={handleLoginSuccess}
        onLogout={handleLogout}
      />

      {/* Capy Buddy Floating Companion */}
      <CapyBuddy onOpenGame={(gameId) => {
        const found = GAMES.find((g) => g.id === gameId);
        if (found) setActiveGame(found);
      }} />
    </div>
  );
}

function SidebarItem({
  icon,
  label,
  count,
  badge,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  count?: number;
  badge?: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center justify-between w-full px-3 py-2 rounded-xl transition-all ${
        active
          ? 'bg-emerald-100/70 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-300 font-extrabold'
          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#1a231a] hover:text-slate-900 dark:hover:text-white'
      }`}
    >
      <div className="flex items-center gap-2.5">
        <span className={active ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-400'}>
          {icon}
        </span>
        <span>{label}</span>
      </div>
      {badge && (
        <span className="px-1.5 py-0.5 text-[9px] font-extrabold bg-emerald-600 text-white rounded">
          {badge}
        </span>
      )}
      {count !== undefined && (
        <span className="text-[11px] font-mono text-slate-400">{count}</span>
      )}
    </button>
  );
}

const defaultPrefs: UserPrefs = {
  theme: 'light',
  sound: true,
  music: true,
  vfx: true,
  reduceMotion: false,
  sfxVolume: 0.8,
  musicVolume: 0.5,
};
