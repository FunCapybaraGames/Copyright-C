// Capy.Games multiplayer relay. Zero dependencies. Run:  node server.js   (default port 8787)
// Players see each other in the same server (room). Enemies/quests stay per-player in this version.
const http = require("http"), crypto = require("crypto"), PORT = process.env.PORT || 8787, MAX = 12;
const rooms = { 1: new Map(), 2: new Map(), 3: new Map() }; let nextId = 1;
const srv = http.createServer((q, r) => { r.writeHead(200, { "content-type": "application/json", "access-control-allow-origin": "*" }); r.end(JSON.stringify(Object.fromEntries(Object.entries(rooms).map(([k, v]) => [k, v.size])))); });
function frame(s) { const b = Buffer.from(s), l = b.length; let h; if (l < 126) h = Buffer.from([0x81, l]); else if (l < 65536) { h = Buffer.alloc(4); h[0] = 0x81; h[1] = 126; h.writeUInt16BE(l, 2); } else { h = Buffer.alloc(10); h[0] = 0x81; h[1] = 127; h.writeBigUInt64BE(BigInt(l), 2); } return Buffer.concat([h, b]); }
const send = (c, o) => { try { c.write(frame(JSON.stringify(o))); } catch {} };
const num = (v, a = -400, b = 400) => Math.max(a, Math.min(b, +v || 0));
function handle(c, m) {
  if (m.t === "join" && !c.me) {
    const name = String(m.name || "").toLowerCase(), room = rooms[m.room];
    if (!/^[a-z0-9_]{3,20}$/.test(name) || !room) return send(c, { t: "err", m: "Invalid name or server." });
    if (room.size >= MAX) return send(c, { t: "err", m: "That server is full." });
    for (const r of Object.values(rooms)) for (const p of r.values()) if (p.name === name) return send(c, { t: "err", m: "That player is already online." });
    c.me = { id: nextId++, name, room: +m.room, x: 0, z: 8, yaw: 0, mv: false, sw: false, lvl: 1, fr: -1 }; room.set(c, c.me); send(c, { t: "welcome", id: c.me.id, room: c.me.room });
  } else if (m.t === "pos" && c.me) { const p = c.me; p.x = num(m.x); p.z = num(m.z); p.yaw = num(m.yaw, -7, 7); p.mv = !!m.mv; p.sw = !!m.sw; p.lvl = num(m.lvl, 1, 999); p.fr = num(m.fr, -1, 20) | 0; }
}
srv.on("upgrade", (req, c) => {
  const key = req.headers["sec-websocket-key"]; if (!key) return c.destroy();
  c.write("HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: " + crypto.createHash("sha1").update(key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11").digest("base64") + "\r\n\r\n");
  let buf = Buffer.alloc(0);
  const drop = () => { if (c.me) rooms[c.me.room].delete(c); c.me = null; };
  c.on("data", d => {
    buf = Buffer.concat([buf, d]);
    while (buf.length >= 2) {
      const op = buf[0] & 15, mk = buf[1] & 128; let len = buf[1] & 127, off = 2;
      if (len === 126) { if (buf.length < 4) return; len = buf.readUInt16BE(2); off = 4; } else if (len === 127) { if (buf.length < 10) return; len = Number(buf.readBigUInt64BE(2)); off = 10; }
      if (len > 8192 || !mk) return c.destroy(); if (buf.length < off + 4 + len) return;
      const mask = buf.slice(off, off + 4), data = Buffer.from(buf.slice(off + 4, off + 4 + len)); for (let i = 0; i < len; i++) data[i] ^= mask[i & 3]; buf = buf.slice(off + 4 + len);
      if (op === 8) { drop(); return c.end(); } if (op === 9) c.write(Buffer.from([0x8a, 0])); if (op === 1) { try { handle(c, JSON.parse(data.toString())); } catch {} }
    }
  });
  c.on("close", drop); c.on("error", drop);
});
setInterval(() => { for (const room of Object.values(rooms)) { const p = [...room.values()]; for (const c of room.keys()) send(c, { t: "state", p }); } }, 100);
srv.listen(PORT, () => console.log("Capy.Games server on ws://localhost:" + PORT));
