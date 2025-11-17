import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import { BotManager } from './botManager.js';
import http from 'http';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Bot Manager instance
const botManager = new BotManager();

// WebSocket connections
const wsClients = new Set();

// Create HTTP server
const server = http.createServer(app);

// Create WebSocket server
const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws) => {
  console.log('[WebSocket] Client connected');
  wsClients.add(ws);

  ws.on('close', () => {
    console.log('[WebSocket] Client disconnected');
    wsClients.delete(ws);
  });

  ws.on('error', (error) => {
    console.error('[WebSocket] Error:', error);
  });
});

// Broadcast to all WebSocket clients
function broadcast(data) {
  const message = JSON.stringify(data);
  wsClients.forEach(client => {
    if (client.readyState === 1) { // OPEN
      client.send(message);
    }
  });
}

// ==================== API ROUTES ====================

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Login a new bot
app.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ 
        success: false, 
        error: 'Username and password are required' 
      });
    }

    console.log(`[API] Login request for: ${username}`);
    
    const bot = await botManager.createBot(username, password);

    // Set up event listeners
    bot.onMessage((message) => {
      broadcast({
        type: 'message',
        data: message
      });
    });

    bot.onUserJoined((roomId, user) => {
      broadcast({
        type: 'user_joined',
        data: { roomId, user }
      });
    });

    bot.onUserLeft((roomId, userId, username) => {
      broadcast({
        type: 'user_left',
        data: { roomId, userId, username }
      });
    });

    const status = bot.getStatus();
    
    broadcast({
      type: 'log',
      data: `[${username}] Successfully logged in`
    });

    res.json({
      success: true,
      bot: status
    });
  } catch (error) {
    console.error('[API] Login error:', error);
    
    broadcast({
      type: 'log',
      data: `[${req.body.username}] Login failed: ${error.message}`
    });

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get all bots
app.get('/bots', (req, res) => {
  const bots = botManager.getAllBots();
  res.json({ success: true, bots });
});

// Get bot status
app.get('/bots/:botId/status', (req, res) => {
  const bot = botManager.getBot(req.params.botId);
  
  if (!bot) {
    return res.status(404).json({ 
      success: false, 
      error: 'Bot not found' 
    });
  }

  res.json({ success: true, bot: bot.getStatus() });
});

// Search rooms
app.get('/bots/:botId/rooms/search', async (req, res) => {
  try {
    const bot = botManager.getBot(req.params.botId);
    
    if (!bot) {
      return res.status(404).json({ 
        success: false, 
        error: 'Bot not found' 
      });
    }

    const rooms = await bot.searchRooms(req.query);
    
    res.json({ success: true, rooms });
  } catch (error) {
    console.error('[API] Search rooms error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Join a room
app.post('/bots/:botId/rooms/join', async (req, res) => {
  try {
    const bot = botManager.getBot(req.params.botId);
    
    if (!bot) {
      return res.status(404).json({ 
        success: false, 
        error: 'Bot not found' 
      });
    }

    const { room } = req.body;
    
    if (!room) {
      return res.status(400).json({ 
        success: false, 
        error: 'Room identifier is required' 
      });
    }

    console.log(`[API] Bot ${req.params.botId} joining room: ${room}`);
    
    const result = await bot.joinRoom(room);
    
    broadcast({
      type: 'log',
      data: `[${bot.username}] Joined room: ${result.roomName}`
    });

    broadcast({
      type: 'room_joined',
      data: {
        botId: req.params.botId,
        roomId: result.roomId,
        roomName: result.roomName
      }
    });

    res.json(result);
  } catch (error) {
    console.error('[API] Join room error:', error);
    
    broadcast({
      type: 'log',
      data: `[Bot ${req.params.botId}] Failed to join room: ${error.message}`
    });

    res.status(500).json({ success: false, error: error.message });
  }
});

// Leave a room
app.post('/bots/:botId/rooms/:roomId/leave', async (req, res) => {
  try {
    const bot = botManager.getBot(req.params.botId);
    
    if (!bot) {
      return res.status(404).json({ 
        success: false, 
        error: 'Bot not found' 
      });
    }

    const result = await bot.leaveRoom(req.params.roomId);
    
    broadcast({
      type: 'log',
      data: `[${bot.username}] Left room`
    });

    res.json(result);
  } catch (error) {
    console.error('[API] Leave room error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Send message to room
app.post('/bots/:botId/rooms/:roomId/send', async (req, res) => {
  try {
    const bot = botManager.getBot(req.params.botId);
    
    if (!bot) {
      return res.status(404).json({ 
        success: false, 
        error: 'Bot not found' 
      });
    }

    const { message } = req.body;
    
    if (!message) {
      return res.status(400).json({ 
        success: false, 
        error: 'Message is required' 
      });
    }

    const result = await bot.sendMessage(req.params.roomId, message);
    
    res.json(result);
  } catch (error) {
    console.error('[API] Send message error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Logout bot
app.post('/bots/:botId/logout', async (req, res) => {
  try {
    const bot = botManager.getBot(req.params.botId);
    
    if (!bot) {
      return res.status(404).json({ 
        success: false, 
        error: 'Bot not found' 
      });
    }

    const username = bot.username;
    await botManager.removeBot(req.params.botId);
    
    broadcast({
      type: 'log',
      data: `[${username}] Logged out`
    });

    res.json({ success: true });
  } catch (error) {
    console.error('[API] Logout error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Start server
server.listen(PORT, () => {
  console.log(`\n🚀 IMVU Bot Manager Backend Server`);
  console.log(`📡 HTTP API: http://localhost:${PORT}`);
  console.log(`🔌 WebSocket: ws://localhost:${PORT}/ws`);
  console.log(`✅ Server is ready!\n`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  
  // Logout all bots
  const bots = botManager.getAllBots();
  for (const bot of bots) {
    await botManager.removeBot(bot.id);
  }
  
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
