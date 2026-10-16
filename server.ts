import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json());

// Persistent Data Storage directory
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const ACCOUNTS_FILE = path.join(DATA_DIR, 'accounts.json');
const FRIENDS_FILE = path.join(DATA_DIR, 'friends.json');
const MESSAGES_FILE = path.join(DATA_DIR, 'messages.json');

interface UserAccount {
  id: number;
  username: string;
  email?: string;
  passwordHash?: string;
  isGoogleAuth?: boolean;
  createdAt: string;
  resetCode?: string;
  resetCodeExpiry?: number;
  data: {
    favorites: string[];
    bestScores: Record<string, number>;
    stageBest: Record<string, number>;
    beeSave?: any;
  };
}

interface FriendRequest {
  id: string;
  fromId: number;
  fromUsername: string;
  toId: number;
  toUsername: string;
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED';
  timestamp: number;
}

interface ChatMessage {
  id: string;
  fromId: number;
  fromUsername: string;
  toId: number;
  toUsername: string;
  text: string;
  timestamp: number;
}

function loadJSON<T>(filePath: string, fallback: T): T {
  try {
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify(fallback, null, 2), 'utf-8');
      return fallback;
    }
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error(`Error reading ${filePath}:`, err);
    return fallback;
  }
}

function saveJSON(filePath: string, data: any) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error(`Error saving ${filePath}:`, err);
  }
}

// ---- Account Endpoints ----

// Register: allocates the next sequential integer ID (1, 2, 3...)
app.post('/api/auth/register', (req, res) => {
  const { username, passwordHash, email } = req.body;
  if (!username) {
    return res.status(400).json({ error: 'Username is required' });
  }

  const cleanUser = username.trim().toLowerCase();
  const accounts = loadJSON<UserAccount[]>(ACCOUNTS_FILE, []);

  if (accounts.some((a) => a.username.toLowerCase() === cleanUser)) {
    return res.status(409).json({ error: 'Username is already taken' });
  }

  // Next sequential numeric ID (e.g. 1, 2, ... 2300)
  const maxId = accounts.reduce((max, a) => Math.max(max, a.id || 0), 0);
  const nextId = maxId + 1;

  const newAccount: UserAccount = {
    id: nextId,
    username,
    email: email ? email.trim() : undefined,
    passwordHash: passwordHash || '',
    isGoogleAuth: false,
    createdAt: new Date().toISOString(),
    data: {
      favorites: [],
      bestScores: {},
      stageBest: {},
    },
  };

  accounts.push(newAccount);
  saveJSON(ACCOUNTS_FILE, accounts);

  console.log(`Registered user #${nextId}: ${username}`);
  return res.json({ account: newAccount });
});

// Login by username or numbered ID
app.post('/api/auth/login', (req, res) => {
  const { identifier, passwordHash } = req.body;
  if (!identifier) {
    return res.status(400).json({ error: 'Identifier is required' });
  }

  const accounts = loadJSON<UserAccount[]>(ACCOUNTS_FILE, []);
  const cleanId = String(identifier).trim().toLowerCase().replace(/^#/, '');
  const numericId = parseInt(cleanId, 10);

  const account = accounts.find((a) => {
    if (!isNaN(numericId) && a.id === numericId) return true;
    return a.username.toLowerCase() === cleanId;
  });

  if (!account) {
    return res.status(404).json({ error: 'Account not found' });
  }

  if (account.passwordHash && account.passwordHash !== passwordHash) {
    return res.status(401).json({ error: 'Incorrect password' });
  }

  return res.json({ account });
});

// Google Sign-In
app.post('/api/auth/google', (req, res) => {
  const { email, name, googleId } = req.body;
  if (!email && !googleId) {
    return res.status(400).json({ error: 'Missing Google credentials' });
  }

  const accounts = loadJSON<UserAccount[]>(ACCOUNTS_FILE, []);
  let account = accounts.find(
    (a) => (a.email && a.email.toLowerCase() === email?.toLowerCase()) || (a.isGoogleAuth && a.username === name)
  );

  if (!account) {
    const maxId = accounts.reduce((max, a) => Math.max(max, a.id || 0), 0);
    const nextId = maxId + 1;
    const cleanUsername = name ? name.replace(/\s+/g, '_').toLowerCase() : `user_${nextId}`;

    account = {
      id: nextId,
      username: cleanUsername,
      email: email || undefined,
      isGoogleAuth: true,
      createdAt: new Date().toISOString(),
      data: {
        favorites: [],
        bestScores: {},
        stageBest: {},
      },
    };
    accounts.push(account);
    saveJSON(ACCOUNTS_FILE, accounts);
  }

  return res.json({ account });
});

// Add / Update Email
app.post('/api/auth/update-email', (req, res) => {
  const { userId, email } = req.body;
  const accounts = loadJSON<UserAccount[]>(ACCOUNTS_FILE, []);
  const account = accounts.find((a) => a.id === Number(userId));

  if (!account) {
    return res.status(404).json({ error: 'Account not found' });
  }

  account.email = email ? email.trim() : undefined;
  saveJSON(ACCOUNTS_FILE, accounts);
  return res.json({ account });
});

// Request Password Reset Code (generates 6-digit verification code)
app.post('/api/auth/request-reset', (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  const accounts = loadJSON<UserAccount[]>(ACCOUNTS_FILE, []);
  const cleanEmail = email.trim().toLowerCase();
  const account = accounts.find((a) => a.email && a.email.toLowerCase() === cleanEmail);

  if (!account) {
    return res.status(404).json({ error: 'No account associated with that email.' });
  }

  // 6-digit recovery code
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  account.resetCode = code;
  account.resetCodeExpiry = Date.now() + 15 * 60 * 1000; // 15 mins

  saveJSON(ACCOUNTS_FILE, accounts);
  console.log(`Password reset code for ${cleanEmail} (ID #${account.id}): ${code}`);

  return res.json({
    message: 'Reset code generated successfully.',
    code, // Returned for instant testing and displayed in UI
    accountUsername: account.username,
  });
});

// Confirm Password Reset with Code
app.post('/api/auth/confirm-reset', (req, res) => {
  const { email, code, newPasswordHash } = req.body;
  const accounts = loadJSON<UserAccount[]>(ACCOUNTS_FILE, []);
  const cleanEmail = email.trim().toLowerCase();
  const account = accounts.find((a) => a.email && a.email.toLowerCase() === cleanEmail);

  if (!account) {
    return res.status(404).json({ error: 'Account not found.' });
  }

  if (!account.resetCode || account.resetCode !== code.trim()) {
    return res.status(400).json({ error: 'Invalid reset code.' });
  }

  if (account.resetCodeExpiry && Date.now() > account.resetCodeExpiry) {
    return res.status(400).json({ error: 'Reset code has expired.' });
  }

  account.passwordHash = newPasswordHash;
  account.resetCode = undefined;
  account.resetCodeExpiry = undefined;
  saveJSON(ACCOUNTS_FILE, accounts);

  return res.json({ success: true, account });
});

// Sync User Progress Data (favorites, high scores, Bee Swarm save)
app.post('/api/auth/sync-data', (req, res) => {
  const { userId, data } = req.body;
  const accounts = loadJSON<UserAccount[]>(ACCOUNTS_FILE, []);
  const account = accounts.find((a) => a.id === Number(userId));

  if (!account) {
    return res.status(404).json({ error: 'Account not found' });
  }

  account.data = { ...account.data, ...data };
  saveJSON(ACCOUNTS_FILE, accounts);
  return res.json({ success: true });
});

// ---- Friends & Search Endpoints ----

// Search users by name or #ID
app.get('/api/friends/search', (req, res) => {
  const query = String(req.query.query || '').trim().toLowerCase().replace(/^#/, '');
  const currentUserId = Number(req.query.userId || 0);

  if (!query) {
    return res.json({ results: [] });
  }

  const accounts = loadJSON<UserAccount[]>(ACCOUNTS_FILE, []);
  const numericQuery = parseInt(query, 10);

  const matched = accounts
    .filter((a) => a.id !== currentUserId)
    .filter((a) => {
      if (!isNaN(numericQuery) && a.id === numericQuery) return true;
      return a.username.toLowerCase().includes(query);
    })
    .slice(0, 10)
    .map((a) => ({
      id: a.id,
      username: a.username,
      totalScore: Object.values(a.data.bestScores || {}).reduce((s, v) => s + v, 0),
    }));

  return res.json({ results: matched });
});

// ---- Presence & Active Game Tracking ----
interface UserPresence {
  userId: number;
  username: string;
  lastSeen: number;
  currentGame?: string;
  roomId?: string;
}

const presenceMap: Record<number, UserPresence> = {};

// Heartbeat to keep presence active & track current game
app.post('/api/presence/heartbeat', (req, res) => {
  const { userId, currentGame, roomId } = req.body;
  if (!userId) return res.status(400).json({ error: 'userId required' });

  const accounts = loadJSON<UserAccount[]>(ACCOUNTS_FILE, []);
  const acc = accounts.find((a) => a.id === Number(userId));
  if (!acc) return res.status(404).json({ error: 'User not found' });

  presenceMap[Number(userId)] = {
    userId: Number(userId),
    username: acc.username,
    lastSeen: Date.now(),
    currentGame: currentGame || undefined,
    roomId: roomId || undefined,
  };

  return res.json({ success: true });
});

// ---- Multiplayer Rooms & Invites ----
interface GameRoomPlayer {
  id: number;
  username: string;
  plotId?: number;
  x?: number;
  y?: number;
  score?: number;
  data?: any;
  lastActive: number;
}

interface GameRoom {
  id: string;
  gameId: string;
  hostId: number;
  hostUsername: string;
  players: GameRoomPlayer[];
  maxPlayers: number;
  state: any;
  createdAt: number;
}

interface GameInvite {
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

const activeRooms: Record<string, GameRoom> = {};
const gameInvites: GameInvite[] = [];

// Create a multiplayer room
app.post('/api/multiplayer/create', (req, res) => {
  const { gameId, hostId, maxPlayers = 4 } = req.body;
  if (!gameId || !hostId) return res.status(400).json({ error: 'Missing parameters' });

  const accounts = loadJSON<UserAccount[]>(ACCOUNTS_FILE, []);
  const host = accounts.find((a) => a.id === Number(hostId));
  if (!host) return res.status(404).json({ error: 'Host not found' });

  const roomId = `room_${Math.random().toString(36).substring(2, 8)}`;
  const room: GameRoom = {
    id: roomId,
    gameId,
    hostId: host.id,
    hostUsername: host.username,
    maxPlayers: Number(maxPlayers),
    players: [
      {
        id: host.id,
        username: host.username,
        plotId: 0,
        lastActive: Date.now(),
      },
    ],
    state: {},
    createdAt: Date.now(),
  };

  activeRooms[roomId] = room;
  return res.json({ room });
});

// Join an existing room
app.post('/api/multiplayer/join', (req, res) => {
  const { roomId, userId } = req.body;
  const room = activeRooms[roomId];
  if (!room) return res.status(404).json({ error: 'Room not found or expired' });

  const accounts = loadJSON<UserAccount[]>(ACCOUNTS_FILE, []);
  const user = accounts.find((a) => a.id === Number(userId));
  if (!user) return res.status(404).json({ error: 'User not found' });

  if (room.players.length >= room.maxPlayers && !room.players.some((p) => p.id === user.id)) {
    return res.status(400).json({ error: 'Room is full' });
  }

  const existingIndex = room.players.findIndex((p) => p.id === user.id);
  if (existingIndex >= 0) {
    room.players[existingIndex].lastActive = Date.now();
  } else {
    room.players.push({
      id: user.id,
      username: user.username,
      plotId: room.players.length,
      lastActive: Date.now(),
    });
  }

  return res.json({ room });
});

// Sync player state & fetch room
app.post('/api/multiplayer/sync', (req, res) => {
  const { roomId, userId, playerState, gameState } = req.body;
  const room = activeRooms[roomId];
  if (!room) return res.status(404).json({ error: 'Room not found' });

  const p = room.players.find((pl) => pl.id === Number(userId));
  if (p) {
    p.lastActive = Date.now();
    if (playerState) {
      if (playerState.x !== undefined) p.x = playerState.x;
      if (playerState.y !== undefined) p.y = playerState.y;
      if (playerState.score !== undefined) p.score = playerState.score;
      if (playerState.data !== undefined) p.data = playerState.data;
    }
  }

  // Prune players inactive > 12s
  room.players = room.players.filter((pl) => Date.now() - pl.lastActive < 12000);

  if (gameState && room.hostId === Number(userId)) {
    room.state = { ...room.state, ...gameState };
  }

  return res.json({ room });
});

// Send an invite to a friend
app.post('/api/multiplayer/invite', (req, res) => {
  const { fromId, toId, gameId, roomId } = req.body;
  const accounts = loadJSON<UserAccount[]>(ACCOUNTS_FILE, []);
  const fromAcc = accounts.find((a) => a.id === Number(fromId));
  const toAcc = accounts.find((a) => a.id === Number(toId));

  if (!fromAcc || !toAcc) return res.status(404).json({ error: 'Users not found' });

  const invite: GameInvite = {
    id: `inv_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    fromId: fromAcc.id,
    fromUsername: fromAcc.username,
    toId: toAcc.id,
    toUsername: toAcc.username,
    gameId,
    roomId,
    timestamp: Date.now(),
    status: 'PENDING',
  };

  gameInvites.push(invite);
  return res.json({ success: true, invite });
});

// Get pending game invites for user
app.get('/api/multiplayer/invites', (req, res) => {
  const userId = Number(req.query.userId || 0);
  if (!userId) return res.status(400).json({ error: 'userId required' });

  // Clean old invites > 1 minute
  const validInvites = gameInvites.filter(
    (inv) => inv.toId === userId && inv.status === 'PENDING' && Date.now() - inv.timestamp < 60000
  );

  return res.json({ invites: validInvites });
});

// Join Requests (when a player requests to join a friend who is currently in a room)
interface JoinRequest {
  id: string;
  fromId: number;
  fromUsername: string;
  toId: number;
  gameId: string;
  roomId: string;
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED';
  timestamp: number;
}

const joinRequests: JoinRequest[] = [];

// Send a request to join a friend's active game
app.post('/api/multiplayer/request-join', (req, res) => {
  const { fromId, toId, gameId, roomId } = req.body;
  const accounts = loadJSON<UserAccount[]>(ACCOUNTS_FILE, []);
  const fromAcc = accounts.find((a) => a.id === Number(fromId));
  const toAcc = accounts.find((a) => a.id === Number(toId));

  if (!fromAcc || !toAcc) return res.status(404).json({ error: 'User not found' });

  // Look up room
  const targetRoom = roomId ? activeRooms[roomId] : Object.values(activeRooms).find((r) => r.hostId === toAcc.id);
  const finalRoomId = targetRoom?.id || roomId;

  const joinReq: JoinRequest = {
    id: `jreq_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    fromId: fromAcc.id,
    fromUsername: fromAcc.username,
    toId: toAcc.id,
    gameId: gameId || targetRoom?.gameId || 'Multiplayer Game',
    roomId: finalRoomId,
    status: 'PENDING',
    timestamp: Date.now(),
  };

  joinRequests.push(joinReq);
  return res.json({ success: true, request: joinReq });
});

// Get pending join requests for host
app.get('/api/multiplayer/requests', (req, res) => {
  const userId = Number(req.query.userId || 0);
  if (!userId) return res.status(400).json({ error: 'userId required' });

  const validRequests = joinRequests.filter(
    (r) => r.toId === userId && r.status === 'PENDING' && Date.now() - r.timestamp < 60000
  );

  return res.json({ requests: validRequests });
});

// Respond to join request (Host accepts or declines)
app.post('/api/multiplayer/requests/respond', (req, res) => {
  const { requestId, action } = req.body;
  const reqItem = joinRequests.find((r) => r.id === requestId);
  if (!reqItem) return res.status(404).json({ error: 'Join request not found or expired' });

  reqItem.status = action === 'ACCEPT' ? 'ACCEPTED' : 'DECLINED';
  return res.json({ success: true, request: reqItem });
});

// Enhanced Friends list with online presence & current game
app.get('/api/friends', (req, res) => {
  const userId = Number(req.query.userId || 0);
  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  const allRequests = loadJSON<FriendRequest[]>(FRIENDS_FILE, []);
  const accounts = loadJSON<UserAccount[]>(ACCOUNTS_FILE, []);

  // Accepted friendships
  const accepted = allRequests.filter(
    (r) => r.status === 'ACCEPTED' && (r.fromId === userId || r.toId === userId)
  );

  const friends = accepted.map((r) => {
    const friendId = r.fromId === userId ? r.toId : r.fromId;
    const friendAcc = accounts.find((a) => a.id === friendId);
    const pres = presenceMap[friendId];
    const isOnline = pres && Date.now() - pres.lastSeen < 14000;

    return {
      id: friendId,
      username: friendAcc?.username || (r.fromId === userId ? r.toUsername : r.fromUsername),
      bestScores: friendAcc?.data.bestScores || {},
      stageBest: friendAcc?.data.stageBest || {},
      totalScore: Object.values(friendAcc?.data.bestScores || {}).reduce((s, v) => s + v, 0),
      isOnline: !!isOnline,
      currentGame: isOnline ? pres.currentGame : undefined,
      roomId: isOnline ? pres.roomId : undefined,
    };
  });

  const pendingIncoming = allRequests.filter(
    (r) => r.status === 'PENDING' && r.toId === userId
  );

  const pendingOutgoing = allRequests.filter(
    (r) => r.status === 'PENDING' && r.fromId === userId
  );

  return res.json({ friends, pendingIncoming, pendingOutgoing });
});

// Send a friend request
app.post('/api/friends/request', (req, res) => {
  const { fromId, toId } = req.body;
  if (!fromId || !toId || fromId === toId) {
    return res.status(400).json({ error: 'Invalid user IDs' });
  }

  const accounts = loadJSON<UserAccount[]>(ACCOUNTS_FILE, []);
  const fromAcc = accounts.find((a) => a.id === Number(fromId));
  const toAcc = accounts.find((a) => a.id === Number(toId));

  if (!fromAcc || !toAcc) {
    return res.status(404).json({ error: 'One or both users not found' });
  }

  const allRequests = loadJSON<FriendRequest[]>(FRIENDS_FILE, []);

  // Check existing
  const existing = allRequests.find(
    (r) =>
      ((r.fromId === fromId && r.toId === toId) || (r.fromId === toId && r.toId === fromId)) &&
      r.status !== 'DECLINED'
  );

  if (existing) {
    if (existing.status === 'ACCEPTED') {
      return res.status(400).json({ error: 'You are already friends!' });
    }
    return res.status(400).json({ error: 'A friend request is already pending.' });
  }

  const newRequest: FriendRequest = {
    id: `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    fromId: fromAcc.id,
    fromUsername: fromAcc.username,
    toId: toAcc.id,
    toUsername: toAcc.username,
    status: 'PENDING',
    timestamp: Date.now(),
  };

  allRequests.push(newRequest);
  saveJSON(FRIENDS_FILE, allRequests);

  return res.json({ request: newRequest });
});

// Respond to a friend request (Accept or Decline)
app.post('/api/friends/respond', (req, res) => {
  const { requestId, action, userId } = req.body; // action: 'ACCEPT' | 'DECLINE'
  const allRequests = loadJSON<FriendRequest[]>(FRIENDS_FILE, []);
  const request = allRequests.find((r) => r.id === requestId);

  if (!request) {
    return res.status(404).json({ error: 'Request not found' });
  }

  if (request.toId !== Number(userId)) {
    return res.status(403).json({ error: 'Unauthorized to respond to this request' });
  }

  request.status = action === 'ACCEPT' ? 'ACCEPTED' : 'DECLINED';
  saveJSON(FRIENDS_FILE, allRequests);

  return res.json({ success: true, request });
});

// ---- Chat Endpoints ----

// Get messages between two friends
app.get('/api/chat', (req, res) => {
  const userId = Number(req.query.userId || 0);
  const friendId = Number(req.query.friendId || 0);

  if (!userId || !friendId) {
    return res.status(400).json({ error: 'Both userId and friendId are required' });
  }

  const allMessages = loadJSON<ChatMessage[]>(MESSAGES_FILE, []);
  const conversation = allMessages.filter(
    (m) =>
      (m.fromId === userId && m.toId === friendId) ||
      (m.fromId === friendId && m.toId === userId)
  );

  return res.json({ messages: conversation });
});

// Send a chat message
app.post('/api/chat/send', (req, res) => {
  const { fromId, toId, text } = req.body;
  if (!fromId || !toId || !text || !text.trim()) {
    return res.status(400).json({ error: 'Invalid message parameters' });
  }

  const accounts = loadJSON<UserAccount[]>(ACCOUNTS_FILE, []);
  const fromAcc = accounts.find((a) => a.id === Number(fromId));
  const toAcc = accounts.find((a) => a.id === Number(toId));

  if (!fromAcc || !toAcc) {
    return res.status(404).json({ error: 'User not found' });
  }

  // Verify friendship
  const allRequests = loadJSON<FriendRequest[]>(FRIENDS_FILE, []);
  const isFriends = allRequests.some(
    (r) =>
      r.status === 'ACCEPTED' &&
      ((r.fromId === fromId && r.toId === toId) || (r.fromId === toId && r.toId === fromId))
  );

  if (!isFriends) {
    return res.status(403).json({ error: 'You must be accepted friends to chat.' });
  }

  const allMessages = loadJSON<ChatMessage[]>(MESSAGES_FILE, []);
  const newMsg: ChatMessage = {
    id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    fromId: fromAcc.id,
    fromUsername: fromAcc.username,
    toId: toAcc.id,
    toUsername: toAcc.username,
    text: text.trim(),
    timestamp: Date.now(),
  };

  allMessages.push(newMsg);
  saveJSON(MESSAGES_FILE, allMessages);

  return res.json({ message: newMsg });
});

// ---- Vite Middleware & Static Serving ----
async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  } else {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Capybara Games Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
