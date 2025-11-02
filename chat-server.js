/**
 * chat-server.js
 *
 * Single-file real-time chat app using Express + Socket.IO.
 * Saves a tiny client (index.html + client JS) into ./public if missing,
 * then starts a server that serves the client and handles socket events.
 *
 * Run:
 *   npm init -y
 *   npm install express socket.io
 *   node chat-server.js
 *
 * Open: http://localhost:3000
 */

const express = require('express');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// create public dir and client files if they don't exist
const publicDir = path.join(__dirname, 'public');
if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir);

// index.html: simple chat client using socket.io client lib (CDN)
const indexHtml = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Socket.IO Chat</title>
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <style>
    body { font-family: Arial, sans-serif; margin:0; background:#f5f5f7; }
    #app { max-width:1000px; margin:24px auto; display:flex; gap:20px; }
    .panel { background:#fff; padding:16px; border-radius:8px; box-shadow: 0 1px 4px rgba(0,0,0,0.08); }
    #left { flex:2; display:flex; flex-direction:column; height:80vh; }
    #right { width:300px; }
    #messages { flex:1; overflow:auto; padding:8px; border:1px solid #eee; border-radius:6px; background:#fafafa; }
    .msg { margin:8px 0; }
    .meta { color:#666; font-size:12px; }
    #form { display:flex; gap:8px; margin-top:10px; }
    input, select, button, textarea { padding:8px; border-radius:6px; border:1px solid #ddd; }
    button { cursor:pointer; background:#2d89ff; color:#fff; border:none; }
    .system { color:#666; font-style:italic; }
    #users { list-style:none; padding:0; margin:0; }
    #users li { padding:6px 4px; border-bottom:1px solid #f0f0f0; }
    #typing { color:#888; font-style:italic; margin-top:6px; }
    .pm { background:#fffbe6; padding:6px; border-radius:6px; }
  </style>
</head>
<body>
<div id="app">
  <div id="left" class="panel">
    <div>
      <label>Username: <input id="username" placeholder="choose a name"/></label>
      <label>Room:
        <select id="room">
          <option>General</option>
          <option>Sports</option>
          <option>Tech</option>
          <option>Random</option>
        </select>
      </label>
      <button id="joinBtn">Join</button>
      <button id="leaveBtn" disabled>Leave</button>
    </div>

    <div id="messages" aria-live="polite"></div>

    <div id="typing"></div>

    <div id="form">
      <input id="msg" placeholder="Type message here..." style="flex:1" disabled/>
      <button id="sendBtn" disabled>Send</button>
    </div>

    <div style="margin-top:8px; color:#555; font-size:13px;">
      Tip: Use <code>/pm &lt;username&gt; &lt;message&gt;</code> to send a private message.
    </div>
  </div>

  <div id="right" class="panel">
    <h3>Room Users</h3>
    <ul id="users"></ul>
    <h4>Rooms</h4>
    <ul>
      <li>General</li><li>Sports</li><li>Tech</li><li>Random</li>
    </ul>
  </div>
</div>

<script src="/socket.io/socket.io.js"></script>
<script>
  (function(){
    const socket = io();

    const usernameInput = document.getElementById('username');
    const roomSelect = document.getElementById('room');
    const joinBtn = document.getElementById('joinBtn');
    const leaveBtn = document.getElementById('leaveBtn');
    const msgInput = document.getElementById('msg');
    const sendBtn = document.getElementById('sendBtn');
    const messagesDiv = document.getElementById('messages');
    const usersList = document.getElementById('users');
    const typingDiv = document.getElementById('typing');

    let joined = false;
    let typingTimer = null;

    function addMessage(html) {
      const div = document.createElement('div');
      div.className = 'msg';
      div.innerHTML = html;
      messagesDiv.appendChild(div);
      messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }

    function renderUsers(list) {
      usersList.innerHTML = '';
      list.forEach(u => {
        const li = document.createElement('li');
        li.textContent = u;
        usersList.appendChild(li);
      });
    }

    // Controls
    joinBtn.addEventListener('click', () => {
      const name = usernameInput.value.trim();
      const room = roomSelect.value;
      if (!name) return alert('Please enter a username');
      socket.emit('joinRoom', { username: name, room });
    });

    leaveBtn.addEventListener('click', () => {
      socket.emit('leaveRoom');
    });

    sendBtn.addEventListener('click', sendMessage);
    msgInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        sendMessage();
      } else {
        socket.emit('typing');
        clearTimeout(typingTimer);
        typingTimer = setTimeout(() => socket.emit('stopTyping'), 800);
      }
    });

    function sendMessage(){
      const text = msgInput.value.trim();
      if (!text) return;
      // support /pm name message
      if (text.startsWith('/pm ')) {
        const parts = text.split(' ');
        const to = parts[1];
        const body = parts.slice(2).join(' ');
        socket.emit('privateMessage', { to, message: body });
        addMessage('<span class="pm"><strong>To ' + escapeHtml(to) + ' (private):</strong> ' + escapeHtml(body) + '</span>');
      } else {
        socket.emit('chatMessage', text);
      }
      msgInput.value = '';
      socket.emit('stopTyping');
    }

    // socket events
    socket.on('joined', ({ room, username, users, history }) => {
      joined = true;
      joinBtn.disabled = true;
      leaveBtn.disabled = false;
      msgInput.disabled = false;
      sendBtn.disabled = false;
      addMessage('<div class="system">You joined room: <strong>' + escapeHtml(room) + '</strong> as <strong>' + escapeHtml(username) + '</strong></div>');
      renderUsers(users);
      // render history
      if (history && history.length) {
        addMessage('<div class="system">Room recent messages:</div>');
        history.forEach(m => {
          const time = new Date(m.ts).toLocaleTimeString();
          addMessage('<div><span class="meta">['+time+']</span> <strong>'+escapeHtml(m.username)+'</strong>: '+escapeHtml(m.text)+'</div>');
        });
      }
    });

    socket.on('left', ({ room, username }) => {
      joined = false;
      joinBtn.disabled = false;
      leaveBtn.disabled = true;
      msgInput.disabled = true;
      sendBtn.disabled = true;
      renderUsers([]);
      addMessage('<div class="system">' + escapeHtml(username) + ' left the room: ' + escapeHtml(room) + '</div>');
    });

    socket.on('message', (m) => {
      const time = new Date(m.ts).toLocaleTimeString();
      addMessage('<div><span class="meta">['+time+']</span> <strong>'+escapeHtml(m.username)+'</strong>: '+escapeHtml(m.text)+'</div>');
    });

    socket.on('system', (txt) => {
      addMessage('<div class="system">' + escapeHtml(txt) + '</div>');
    });

    socket.on('users', (list) => {
      renderUsers(list);
    });

    socket.on('typing', ({ username }) => {
      typingDiv.textContent = username + ' is typing...';
    });
    socket.on('stopTyping', () => {
      typingDiv.textContent = '';
    });

    socket.on('privateMessage', ({ from, message, ts }) => {
      const time = new Date(ts).toLocaleTimeString();
      addMessage('<div class="pm"><span class="meta">['+time+']</span> <strong>Private from '+escapeHtml(from)+':</strong> '+escapeHtml(message)+'</div>');
    });

    // helpers
    function escapeHtml(s) {
      return String(s).replace(/[&<>"'`]/g, (c) => ({
        '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;', '`':'&#x60;'
      }[c]));
    }

    // detect disconnect
    socket.on('disconnect', () => {
      addMessage('<div class="system">Disconnected from server</div>');
      joinBtn.disabled = false;
      leaveBtn.disabled = true;
      msgInput.disabled = true;
      sendBtn.disabled = true;
    });

  })();
</script>
</body>
</html>`;

// write index.html if missing
const indexPath = path.join(publicDir, 'index.html');
if (!fs.existsSync(indexPath)) fs.writeFileSync(indexPath, indexHtml, 'utf8');

// serve static files from public
app.use(express.static(publicDir));

// ---------------------
// Server-side chat logic
// ---------------------

// In-memory stores
// Structure: rooms -> { users: Map(socketId -> username), history: [ {username, text, ts} ] }
const rooms = new Map();
// global map socketId -> { username, room }
const clients = new Map();

function ensureRoom(room) {
  if (!rooms.has(room)) {
    rooms.set(room, { users: new Map(), history: [] });
  }
  return rooms.get(room);
}

io.on('connection', (socket) => {
  console.log('Socket connected:', socket.id);

  // client requests to join a room with username
  socket.on('joinRoom', ({ username, room }) => {
    username = String(username).trim().substring(0, 32) || 'Anonymous';
    room = String(room).trim() || 'General';

    // store client
    clients.set(socket.id, { username, room });

    // add to room
    socket.join(room);
    const r = ensureRoom(room);
    r.users.set(socket.id, username);

    // keep small history (last 50)
    const history = r.history.slice(-50);

    // notify others
    socket.to(room).emit('system', `${username} has joined the room`);
    io.to(room).emit('users', Array.from(r.users.values()));

    // send joined ack with history & current users
    socket.emit('joined', { room, username, users: Array.from(r.users.values()), history });
    console.log(\`[\${room}] \${username} joined (\${socket.id})\`);
  });

  socket.on('leaveRoom', () => {
    const info = clients.get(socket.id);
    if (!info) return;
    const { username, room } = info;
    const r = rooms.get(room);
    if (r) {
      r.users.delete(socket.id);
      socket.leave(room);
      socket.emit('left', { room, username });
      socket.to(room).emit('system', `${username} has left the room`);
      io.to(room).emit('users', Array.from(r.users.values()));
      console.log(\`[\${room}] \${username} left (\${socket.id})\`);
    }
    clients.delete(socket.id);
  });

  socket.on('chatMessage', (text) => {
    const info = clients.get(socket.id);
    if (!info) {
      socket.emit('system', 'Please join a room first');
      return;
    }
    const username = info.username;
    const room = info.room;
    const ts = Date.now();
    const msg = { username, text: String(text).substring(0, 1000), ts };
    // store in history
    const r = ensureRoom(room);
    r.history.push(msg);
    // limit history
    if (r.history.length > 200) r.history.shift();
    // broadcast to room
    io.to(room).emit('message', msg);
    console.log(\`[\${room}] \${username}: \${text}\`);
  });

  // typing indicator
  socket.on('typing', () => {
    const info = clients.get(socket.id);
    if (!info) return;
    io.to(info.room).emit('typing', { username: info.username });
  });
  socket.on('stopTyping', () => {
    const info = clients.get(socket.id);
    if (!info) return;
    io.to(info.room).emit('stopTyping');
  });

  // private message
  socket.on('privateMessage', ({ to, message }) => {
    const info = clients.get(socket.id);
    if (!info) {
      socket.emit('system', 'Join a room first');
      return;
    }
    const from = info.username;
    const room = info.room;
    // find socketId of 'to' in same room
    const r = rooms.get(room);
    if (!r) {
      socket.emit('system', 'Room not found');
      return;
    }
    let targetSocketId = null;
    for (const [sid, uname] of r.users.entries()) {
      if (uname === to) { targetSocketId = sid; break; }
    }
    const ts = Date.now();
    if (!targetSocketId) {
      socket.emit('system', 'User not found in room: ' + to);
      return;
    }
    // send PM to target and notify sender
    io.to(targetSocketId).emit('privateMessage', { from, message, ts });
    socket.emit('system', 'Private message sent to ' + to);
    console.log(\`PM from \${from} to \${to}: \${message}\`);
  });

  socket.on('disconnect', (reason) => {
    const info = clients.get(socket.id);
    if (info) {
      const { username, room } = info;
      const r = rooms.get(room);
      if (r) {
        r.users.delete(socket.id);
        socket.to(room).emit('system', `${username} disconnected`);
        io.to(room).emit('users', Array.from(r.users.values()));
      }
      clients.delete(socket.id);
      console.log(\`Socket disconnected: \${socket.id} (\${username}) - \${reason}\`);
    } else {
      console.log('Socket disconnected:', socket.id, reason);
    }
  });
});

// start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log('Chat server listening on http://localhost:' + PORT);
});
