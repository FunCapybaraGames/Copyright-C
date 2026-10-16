import React from 'react';
import { UserPrefs, ThemeMode } from '../types';
import { soundEngine } from '../soundEngine';
import { spawnDomBurst } from '../vfxEngine';
import { X, Volume2, Music, Sparkles, Wind, Sun, Moon, Laptop } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  prefs: UserPrefs;
  onUpdatePrefs: (updated: Partial<UserPrefs>) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  prefs,
  onUpdatePrefs,
}) => {
  if (!isOpen) return null;

  const handleThemeChange = (theme: ThemeMode, e: React.MouseEvent) => {
    onUpdatePrefs({ theme });
    soundEngine.play('click');
    spawnDomBurst(e.clientX, e.clientY, 10);
  };

  const handleToggle = (key: keyof UserPrefs, e: React.MouseEvent) => {
    const val = !prefs[key];
    onUpdatePrefs({ [key]: val });
    soundEngine.play('click');
    spawnDomBurst(e.clientX, e.clientY, 8);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-white dark:bg-[#182018] border border-slate-200 dark:border-[#2b382b] rounded-2xl p-6 shadow-2xl text-slate-900 dark:text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-[#263226]">
          <div>
            <div className="text-[10px] font-extrabold tracking-wider text-slate-400 dark:text-slate-500 uppercase">
              Preferences
            </div>
            <h2 className="text-xl font-display font-bold">Settings</h2>
          </div>
          <button
            onClick={() => {
              soundEngine.play('click');
              onClose();
            }}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-[#253225] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Options list */}
        <div className="divide-y divide-slate-100 dark:divide-[#263226] py-2">
          {/* Appearance */}
          <div className="py-3.5 flex items-center justify-between">
            <div>
              <div className="font-semibold text-xs">Appearance</div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">Choose interface theme</div>
            </div>
            <div className="flex p-1 bg-slate-100 dark:bg-[#121812] rounded-xl border border-slate-200 dark:border-[#2b382b]">
              <button
                onClick={(e) => handleThemeChange('light', e)}
                className={`flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors ${
                  prefs.theme === 'light'
                    ? 'bg-white dark:bg-[#202b20] text-emerald-600 dark:text-emerald-400 shadow-sm'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-300'
                }`}
              >
                <Sun className="w-3.5 h-3.5" />
                <span>Light</span>
              </button>
              <button
                onClick={(e) => handleThemeChange('dark', e)}
                className={`flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors ${
                  prefs.theme === 'dark'
                    ? 'bg-white dark:bg-[#202b20] text-emerald-600 dark:text-emerald-400 shadow-sm'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-300'
                }`}
              >
                <Moon className="w-3.5 h-3.5" />
                <span>Dark</span>
              </button>
              <button
                onClick={(e) => handleThemeChange('system', e)}
                className={`flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors ${
                  prefs.theme === 'system'
                    ? 'bg-white dark:bg-[#202b20] text-emerald-600 dark:text-emerald-400 shadow-sm'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-300'
                }`}
              >
                <Laptop className="w-3.5 h-3.5" />
                <span>Auto</span>
              </button>
            </div>
          </div>

          {/* Sound Effects */}
          <div className="py-3.5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
                <Volume2 className="w-4 h-4" />
              </div>
              <div>
                <div className="font-semibold text-xs">Sound effects</div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">UI and in-game SFX</div>
              </div>
            </div>
            <button
              onClick={(e) => handleToggle('sound', e)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                prefs.sound ? 'bg-emerald-600' : 'bg-slate-200 dark:bg-slate-700'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                  prefs.sound ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Theme Music */}
          <div className="py-3.5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400">
                <Music className="w-4 h-4" />
              </div>
              <div>
                <div className="font-semibold text-xs">Theme music</div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">Procedural game melodies</div>
              </div>
            </div>
            <button
              onClick={(e) => handleToggle('music', e)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                prefs.music ? 'bg-emerald-600' : 'bg-slate-200 dark:bg-slate-700'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                  prefs.music ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Visual Effects */}
          <div className="py-3.5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <div className="font-semibold text-xs">Visual effects</div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">Particles, sparks, and shake</div>
              </div>
            </div>
            <button
              onClick={(e) => handleToggle('vfx', e)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                prefs.vfx ? 'bg-emerald-600' : 'bg-slate-200 dark:bg-slate-700'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                  prefs.vfx ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Reduced Motion */}
          <div className="py-3.5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
                <Wind className="w-4 h-4" />
              </div>
              <div>
                <div className="font-semibold text-xs">Reduce motion</div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">Diminish animated transitions</div>
              </div>
            </div>
            <button
              onClick={(e) => handleToggle('reduceMotion', e)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                prefs.reduceMotion ? 'bg-emerald-600' : 'bg-slate-200 dark:bg-slate-700'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                  prefs.reduceMotion ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-[#263226]">
          <span className="text-[11px] text-slate-400 dark:text-slate-500">
            Saves automatically on device
          </span>
          <button
            onClick={() => {
              soundEngine.play('click');
              onClose();
            }}
            className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
