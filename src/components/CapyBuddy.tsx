import React, { useState, useRef, useEffect } from 'react';
import { GAMES } from '../gameRegistry';
import { soundEngine } from '../soundEngine';
import { X, Send, Sparkles } from 'lucide-react';

interface Message {
  id: string;
  sender: 'user' | 'buddy';
  text: string;
}

interface CapyBuddyProps {
  onOpenGame: (gameId: string) => void;
}

export const CapyBuddy: React.FC<CapyBuddyProps> = ({ onOpenGame }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      sender: 'buddy',
      text: "Hi friend! I'm Capy Buddy 🐹 Ask me about any game, controls, high scores, or what to play next!",
    },
  ]);

  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [messages, isOpen]);

  const generateReply = (q: string): string => {
    const query = q.toLowerCase();
    const matched = GAMES.find((g) => query.includes(g.title.toLowerCase()) || query.includes(g.id.toLowerCase()));

    if (matched) {
      return `🎮 ${matched.title}: ${matched.description} Controls: ${matched.controls}`;
    }

    if (/^(hi|hey|hello|sup|yo|howdy)\b/.test(query)) {
      return "Hey there! Ready to play something great? Ask me for recommendations or controls for any game! 🐹";
    }

    if (/recommend|suggest|what should|bored|best game/.test(query)) {
      const pick = GAMES[Math.floor(Math.random() * GAMES.length)];
      return `I highly recommend ${pick.title}! ${pick.tagline} Want to try it?`;
    }

    if (/relax|chill|cozy|calm|zen/.test(query)) {
      return 'For the coziest chill vibes, I recommend Pocket Garden (relaxing card matching) or Pond Snake (peaceful lilypad grazing)! 🌸';
    }

    if (/arcade|fast|action|hard|chaos/.test(query)) {
      return 'If you want high-octane action, jump into Neon Dodge (fast survival with near-miss bonus points) or Capy Blaster (10 waves of space bugs)! 🚀';
    }

    if (/bee|honey|pollen|flower|hive/.test(query)) {
      return 'In Bee Swarm, roam the 7 flower fields, swing your collector tool to gather pollen, convert pollen to honey at your Hive pad (press E), and hatch white/red/blue bees at the Shop! 🐝';
    }

    if (/control|wasd|keys|how to play|mobile|phone/.test(query)) {
      return 'All games support keyboard (WASD / Arrow keys + Space). On phones and touch screens, intuitive on-screen buttons appear automatically! Press P anytime to pause.';
    }

    if (/sound|music|vfx|particles/.test(query)) {
      return 'Click the Settings gear (⚙) at the top to toggle procedural theme music, synthesized sound effects, or visual particle flourishes!';
    }

    return "I'm your little capybara guide! You can ask me about game controls, strategies, or say 'recommend a game'.";
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;

    soundEngine.play('click');
    const userMsg: Message = { id: String(Date.now()), sender: 'user', text };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');

    setTimeout(() => {
      soundEngine.play('talk');
      const reply = generateReply(text);
      setMessages((prev) => [
        ...prev,
        { id: String(Date.now() + 1), sender: 'buddy', text: reply },
      ]);
    }, 350);
  };

  return (
    <>
      {/* Floating Buddy Mascot Button */}
      <button
        onClick={() => {
          soundEngine.play('jump');
          setIsOpen(!isOpen);
        }}
        className="fixed bottom-5 right-5 z-40 flex items-center gap-2 p-2.5 sm:px-4 sm:py-2.5 bg-white dark:bg-[#1e271e] border-2 border-emerald-600/40 rounded-full shadow-xl hover:scale-105 active:scale-95 transition-all text-slate-800 dark:text-white group"
        title="Chat with Capy Buddy"
      >
        <div className="relative w-9 h-9 rounded-full bg-emerald-100 dark:bg-emerald-950/60 flex items-center justify-center text-xl shrink-0">
          🐹
          <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white dark:border-[#1e271e]" />
        </div>
        <div className="hidden sm:block text-left pr-1">
          <div className="text-xs font-bold leading-none">Capy Buddy</div>
          <div className="text-[10px] text-slate-400 dark:text-slate-500">Ask for tips</div>
        </div>
      </button>

      {/* Buddy Chat Window */}
      {isOpen && (
        <div className="fixed bottom-20 right-5 z-40 flex flex-col w-[340px] max-w-[calc(100vw-2.5rem)] h-[430px] bg-white dark:bg-[#182118] border border-slate-200 dark:border-[#2b3a2b] rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-emerald-50 dark:bg-[#141d14] border-b border-slate-200 dark:border-[#2b3a2b]">
            <div className="flex items-center gap-2">
              <span className="text-xl">🐹</span>
              <div>
                <div className="font-display font-bold text-xs text-slate-900 dark:text-white">
                  Capy Buddy
                </div>
                <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                  Your playground companion
                </div>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-[#253225] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Quick suggestions */}
          <div className="flex items-center gap-1.5 px-3 py-2 bg-slate-50/50 dark:bg-[#121912] border-b border-slate-100 dark:border-[#263226] overflow-x-auto text-[11px] select-none no-scrollbar">
            <button
              onClick={() => {
                setInput('Recommend a fun game');
              }}
              className="px-2 py-1 bg-white dark:bg-[#202b20] border border-slate-200 dark:border-[#2e3e2e] rounded-lg text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 whitespace-nowrap transition-colors"
            >
              🎲 Recommend game
            </button>
            <button
              onClick={() => {
                setInput('How does Bee Swarm work?');
              }}
              className="px-2 py-1 bg-white dark:bg-[#202b20] border border-slate-200 dark:border-[#2e3e2e] rounded-lg text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 whitespace-nowrap transition-colors"
            >
              🐝 Bee Swarm tips
            </button>
            <button
              onClick={() => {
                setInput('Controls');
              }}
              className="px-2 py-1 bg-white dark:bg-[#202b20] border border-slate-200 dark:border-[#2e3e2e] rounded-lg text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 whitespace-nowrap transition-colors"
            >
              🎮 Controls
            </button>
          </div>

          {/* Chat Messages */}
          <div ref={logRef} className="flex-1 p-3.5 overflow-y-auto space-y-2.5 text-xs">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl leading-relaxed ${
                    m.sender === 'user'
                      ? 'bg-emerald-600 text-white rounded-br-none'
                      : 'bg-slate-100 dark:bg-[#202b20] text-slate-800 dark:text-slate-200 border border-slate-200/60 dark:border-[#2d3d2d] rounded-bl-none'
                  }`}
                >
                  {m.text}
                </div>
              </div>
            ))}
          </div>

          {/* Input Form */}
          <form
            onSubmit={handleSend}
            className="flex items-center gap-1.5 p-2.5 border-t border-slate-200 dark:border-[#2b3a2b] bg-white dark:bg-[#182118]"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about a game or controls..."
              className="flex-1 px-3 py-2 text-xs bg-slate-50 dark:bg-[#121912] border border-slate-200 dark:border-[#2b3a2b] rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
            />
            <button
              type="submit"
              className="p-2 text-white bg-emerald-600 hover:bg-emerald-700 active:scale-95 rounded-xl transition-all"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      )}
    </>
  );
};
