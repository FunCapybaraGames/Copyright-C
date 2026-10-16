import React, { useState, useEffect, useRef } from 'react';
import { UserAccount, Friend, FriendRequest, ChatMessage } from '../types';
import { soundEngine } from '../soundEngine';
import { spawnDomBurst } from '../vfxEngine';
import {
  Users,
  UserPlus,
  Search,
  MessageCircle,
  Check,
  X,
  Send,
  Sparkles,
  ShieldAlert,
  ArrowLeft,
  Trophy,
} from 'lucide-react';

interface FriendsTabProps {
  currentUser: UserAccount | null;
  onOpenAuth: () => void;
  onJoinFriendGame?: (gameTitle: string, roomId?: string) => void;
}

export const FriendsTab: React.FC<FriendsTabProps> = ({ currentUser, onOpenAuth, onJoinFriendGame }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{ id: number; username: string; totalScore: number }>>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchMsg, setSearchMsg] = useState('');

  const [friends, setFriends] = useState<Friend[]>([]);
  const [pendingIncoming, setPendingIncoming] = useState<FriendRequest[]>([]);
  const [pendingOutgoing, setPendingOutgoing] = useState<FriendRequest[]>([]);
  const [requestedJoinIds, setRequestedJoinIds] = useState<Set<number>>(new Set());

  // Active chat state
  const [activeFriend, setActiveFriend] = useState<Friend | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isSending, setIsSending] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);

  // Poll friends & requests
  const fetchFriends = async () => {
    if (!currentUser) return;
    try {
      const res = await fetch(`/api/friends?userId=${currentUser.id}`);
      if (res.ok) {
        const data = await res.json();
        setFriends(data.friends || []);
        setPendingIncoming(data.pendingIncoming || []);
        setPendingOutgoing(data.pendingOutgoing || []);
      }
    } catch {}
  };

  useEffect(() => {
    fetchFriends();
    const interval = setInterval(fetchFriends, 4000);
    return () => clearInterval(interval);
  }, [currentUser]);

  // Poll chat messages when a friend is open
  const fetchMessages = async () => {
    if (!currentUser || !activeFriend) return;
    try {
      const res = await fetch(`/api/chat?userId=${currentUser.id}&friendId=${activeFriend.id}`);
      if (res.ok) {
        const data = await res.json();
        setChatMessages(data.messages || []);
      }
    } catch {}
  };

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 2500);
    return () => clearInterval(interval);
  }, [currentUser, activeFriend]);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollTop = chatEndRef.current.scrollHeight;
    }
  }, [chatMessages]);

  // Handle Search
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim() || !currentUser) return;
    setIsSearching(true);
    setSearchMsg('');

    try {
      const res = await fetch(`/api/friends/search?query=${encodeURIComponent(searchQuery)}&userId=${currentUser.id}`);
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data.results || []);
        if ((data.results || []).length === 0) {
          setSearchMsg('No player found with that username or ID.');
        }
      }
    } catch {
      setSearchMsg('Search failed. Check your network.');
    } finally {
      setIsSearching(false);
    }
  };

  // Send Friend Request
  const handleSendRequest = async (targetId: number, e: React.MouseEvent) => {
    if (!currentUser) return;
    try {
      const res = await fetch('/api/friends/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fromId: currentUser.id, toId: targetId }),
      });
      const data = await res.json();
      if (res.ok) {
        soundEngine.play('coin');
        spawnDomBurst(e.clientX, e.clientY, 10);
        fetchFriends();
        // Remove from search results
        setSearchResults((prev) => prev.filter((u) => u.id !== targetId));
      } else {
        alert(data.error || 'Could not send request');
      }
    } catch {
      alert('Error sending friend request');
    }
  };

  // Respond to Request
  const handleRespond = async (requestId: string, action: 'ACCEPT' | 'DECLINE', e: React.MouseEvent) => {
    if (!currentUser) return;
    try {
      const res = await fetch('/api/friends/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, action, userId: currentUser.id }),
      });
      if (res.ok) {
        if (action === 'ACCEPT') {
          soundEngine.play('win');
          spawnDomBurst(e.clientX, e.clientY, 16);
        } else {
          soundEngine.play('click');
        }
        fetchFriends();
      }
    } catch {}
  };

  // Send a Request to Join a friend's active session
  const handleRequestToJoin = async (friend: Friend, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentUser) return;

    soundEngine.play('coin');
    spawnDomBurst(e.clientX, e.clientY, 10);
    setRequestedJoinIds((prev) => new Set(prev).add(friend.id));

    try {
      await fetch('/api/multiplayer/request-join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromId: currentUser.id,
          toId: friend.id,
          gameId: friend.currentGame || 'Multiplayer Game',
          roomId: friend.roomId,
        }),
      });
    } catch {}

    if (onJoinFriendGame && friend.currentGame) {
      setTimeout(() => {
        onJoinFriendGame(friend.currentGame!, friend.roomId);
      }, 350);
    }
  };

  // Send Chat Message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = chatInput.trim();
    if (!text || !currentUser || !activeFriend || isSending) return;

    setIsSending(true);
    soundEngine.play('flip');

    try {
      const res = await fetch('/api/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromId: currentUser.id,
          toId: activeFriend.id,
          text,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setChatMessages((prev) => [...prev, data.message]);
        setChatInput('');
      }
    } catch {} finally {
      setIsSending(false);
    }
  };

  if (!currentUser) {
    return (
      <div className="py-20 text-center space-y-4 max-w-md mx-auto">
        <div className="w-16 h-16 rounded-3xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 text-3xl flex items-center justify-center mx-auto shadow-sm">
          👥
        </div>
        <h2 className="text-2xl font-display font-bold text-slate-900 dark:text-white">
          Connect with Friends
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
          Log in or create your player account with a numbered ID to search friends, send friend
          requests, and chat in real-time.
        </p>
        <button
          onClick={onOpenAuth}
          className="px-6 py-2.5 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl shadow-md transition-all active:scale-95"
        >
          Sign in or Register →
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Account Info Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-2xl bg-white dark:bg-[#182118] border border-slate-200 dark:border-[#2b3a2b] shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 font-extrabold text-xl flex items-center justify-center shrink-0">
            {currentUser.username[0].toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-display font-extrabold text-lg text-slate-900 dark:text-white">
                {currentUser.username}
              </h2>
              <span className="px-2 py-0.5 text-xs font-mono font-bold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 rounded-md">
                Account #{currentUser.id}
              </span>
            </div>
            <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
              Share your Account #{currentUser.id} with friends so they can add you!
            </div>
          </div>
        </div>

        <button
          onClick={() => {
            navigator.clipboard.writeText(String(currentUser.id));
            soundEngine.play('coin');
            alert(`Copied your Account ID: #${currentUser.id}`);
          }}
          className="px-3.5 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-[#202c20] border border-slate-200 dark:border-[#2e3e2e] hover:border-emerald-500 rounded-xl transition-all"
        >
          Copy ID: #{currentUser.id}
        </button>
      </div>

      {/* Main Grid: Search & Friends / Direct Chat */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Left Column: Search & Pending (or Friends list when chat active) */}
        <div className={`${activeFriend ? 'hidden md:block md:col-span-5' : 'col-span-12 md:col-span-6'} space-y-5`}>
          {/* Search Box */}
          <div className="p-5 rounded-2xl bg-white dark:bg-[#182118] border border-slate-200 dark:border-[#2b3a2b] shadow-xs space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white">
              <UserPlus className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Add a Friend</span>
            </div>

            <form onSubmit={handleSearch} className="flex gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Enter username or #ID (e.g. 1)"
                  className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-[#121812] border border-slate-200 dark:border-[#2b3a2b] rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
              <button
                type="submit"
                disabled={isSearching}
                className="px-4 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl transition-colors shrink-0"
              >
                {isSearching ? '...' : 'Search'}
              </button>
            </form>

            {searchMsg && (
              <p className="text-xs text-slate-400 dark:text-slate-500 italic">{searchMsg}</p>
            )}

            {/* Search Results */}
            {searchResults.length > 0 && (
              <div className="space-y-2 pt-1 border-t border-slate-100 dark:border-[#263526]">
                <div className="text-[10px] font-bold text-slate-400 uppercase">Search Results</div>
                {searchResults.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-[#121812] border border-slate-200 dark:border-[#2b3a2b]"
                  >
                    <div>
                      <span className="font-bold text-xs text-slate-900 dark:text-white mr-1.5">
                        {user.username}
                      </span>
                      <span className="text-[11px] font-mono text-slate-400">#{user.id}</span>
                    </div>
                    <button
                      onClick={(e) => handleSendRequest(user.id, e)}
                      className="px-3 py-1 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors"
                    >
                      Add Friend
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pending Incoming Requests */}
          {pendingIncoming.length > 0 && (
            <div className="p-5 rounded-2xl bg-white dark:bg-[#182118] border border-amber-200 dark:border-amber-900/60 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-700 dark:text-amber-400">
                  Friend Requests ({pendingIncoming.length})
                </span>
                <span className="text-[10px] text-slate-400">Waiting for your approval</span>
              </div>

              <div className="space-y-2">
                {pendingIncoming.map((req) => (
                  <div
                    key={req.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40"
                  >
                    <div>
                      <div className="font-bold text-xs text-slate-900 dark:text-white">
                        {req.fromUsername}
                      </div>
                      <div className="text-[11px] font-mono text-slate-400">
                        Player #{req.fromId}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={(e) => handleRespond(req.id, 'ACCEPT', e)}
                        className="p-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors"
                        title="Accept"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => handleRespond(req.id, 'DECLINE', e)}
                        className="p-1.5 bg-slate-200 dark:bg-slate-700 hover:bg-red-600 hover:text-white text-slate-600 dark:text-slate-300 rounded-lg transition-colors"
                        title="Decline"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Friends List */}
          <div className="p-5 rounded-2xl bg-white dark:bg-[#182118] border border-slate-200 dark:border-[#2b3a2b] shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-[#263526]">
              <span className="text-xs font-bold text-slate-900 dark:text-white">
                Friends List ({friends.length})
              </span>
              <span className="text-[10px] text-slate-400 font-mono">Mutual connections</span>
            </div>

            {friends.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400">
                You haven't added any friends yet. Search someone's username or #ID above!
              </div>
            ) : (
              <div className="space-y-2">
                {friends.map((f) => (
                  <div
                    key={f.id}
                    onClick={() => {
                      soundEngine.play('click');
                      setActiveFriend(f);
                    }}
                    className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                      activeFriend?.id === f.id
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800'
                        : 'bg-slate-50 dark:bg-[#121812] border-slate-200/80 dark:border-[#2b3a2b] hover:border-emerald-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-bold text-sm flex items-center justify-center">
                        {f.username[0].toUpperCase()}
                      </div>
                      <div>
                        <div className="font-bold text-xs text-slate-900 dark:text-white">
                          {f.username}
                        </div>
                        <div className="text-[10px] font-mono text-slate-400">
                          #{f.id} · Score {f.totalScore}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <MessageCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Chat Window or Welcome Drawer */}
        <div className={`${activeFriend ? 'col-span-12 md:col-span-7' : 'hidden md:block md:col-span-6'}`}>
          {activeFriend ? (
            <div className="flex flex-col h-[520px] rounded-2xl bg-white dark:bg-[#182118] border border-slate-200 dark:border-[#2b3a2b] shadow-xs overflow-hidden">
              {/* Chat Header */}
              <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-[#2b3a2b] bg-slate-50 dark:bg-[#141c14]">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setActiveFriend(null)}
                    className="md:hidden p-1 text-slate-500 hover:text-slate-900"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 font-bold text-sm flex items-center justify-center">
                    {activeFriend.username[0].toUpperCase()}
                  </div>
                  <div>
                    <div className="font-bold text-xs text-slate-900 dark:text-white">
                      {activeFriend.username}
                    </div>
                    <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono">
                      Friend #{activeFriend.id} · Online
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setActiveFriend(null)}
                  className="hidden md:block p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Chat Messages Log */}
              <div ref={chatEndRef} className="flex-1 p-4 overflow-y-auto space-y-3">
                {chatMessages.length === 0 ? (
                  <div className="py-16 text-center text-xs text-slate-400 space-y-1">
                    <div>💬</div>
                    <div>Say hello to {activeFriend.username}!</div>
                    <div className="text-[10px]">Your chat messages are stored securely.</div>
                  </div>
                ) : (
                  chatMessages.map((msg) => {
                    const isMe = msg.fromId === currentUser.id;
                    return (
                      <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                        <div
                          className={`max-w-[75%] px-3.5 py-2.5 rounded-2xl text-xs leading-relaxed ${
                            isMe
                              ? 'bg-emerald-700 text-white rounded-br-none'
                              : 'bg-slate-100 dark:bg-[#202c20] text-slate-800 dark:text-slate-200 border border-slate-200/60 dark:border-[#2d3e2d] rounded-bl-none'
                          }`}
                        >
                          <div>{msg.text}</div>
                          <div
                            className={`text-[9px] mt-1 text-right font-mono ${
                              isMe ? 'text-emerald-200' : 'text-slate-400'
                            }`}
                          >
                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Chat Input */}
              <form
                onSubmit={handleSendMessage}
                className="flex items-center gap-2 p-3 border-t border-slate-200 dark:border-[#2b3a2b] bg-white dark:bg-[#182118]"
              >
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder={`Message ${activeFriend.username}...`}
                  className="flex-1 px-3 py-2 text-xs bg-slate-50 dark:bg-[#121812] border border-slate-200 dark:border-[#2b3a2b] rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                />
                <button
                  type="submit"
                  disabled={isSending || !chatInput.trim()}
                  className="p-2.5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-40 text-white rounded-xl shadow-xs transition-all active:scale-95"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-[520px] rounded-2xl bg-white dark:bg-[#182118] border border-slate-200 dark:border-[#2b3a2b] p-6 text-center space-y-3 text-slate-400">
              <MessageCircle className="w-10 h-10 text-emerald-500/40" />
              <div className="font-bold text-sm text-slate-700 dark:text-slate-300">
                Select a friend to start chatting
              </div>
              <p className="text-xs max-w-xs leading-relaxed">
                Connect and discuss high scores, strategies, or challenge your friends in Capy Pong!
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
