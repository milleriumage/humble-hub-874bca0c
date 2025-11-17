import { Client } from '../imvu.js-master/packages/client/src/index.js';
import { IMQManager } from '../imvu.js-master/packages/imq/src/IMQManager.js';
import { IMQWebSocketConnectionStrategy } from '../imvu.js-master/packages/imq/src/websocket/IMQWebSocketConnectionStrategy.js';

class BotInstance {
  constructor(id, username, password) {
    this.id = id;
    this.username = username;
    this.password = password;
    this.client = new Client();
    this.imqManager = null;
    this.isLoggedIn = false;
    this.currentRooms = new Map(); // roomId -> room data
    this.messageCallbacks = [];
    this.userJoinCallbacks = [];
    this.userLeftCallbacks = [];
  }

  async login() {
    try {
      console.log(`[Bot ${this.id}] Attempting login as ${this.username}...`);
      
      // Login via IMVU Client API
      await this.client.login(this.username, this.password);
      
      // Get IMQ connection info from user data
      const userData = await this.client.request('/login/me');
      const imqUrl = userData.denormalized[userData.id]?.relations?.imq;
      
      if (!imqUrl) {
        throw new Error('Could not get IMQ URL from user data');
      }

      // Initialize IMQ Manager for real-time chat
      this.imqManager = new IMQManager({
        url: imqUrl,
        strategies: [
          new IMQWebSocketConnectionStrategy({
            url: imqUrl,
            socketFactory: (await import('ws')).default
          })
        ],
        userId: this.client.account.user.legacy_cid || this.client.account.id,
        sessionId: this.client.sauce,
        metadata: {
          app: 'imvu_next',
          platform_type: 'big'
        }
      });

      // Connect to IMQ
      await this.imqManager.connect();
      
      this.isLoggedIn = true;
      console.log(`[Bot ${this.id}] Successfully logged in as ${this.username}`);
      
      return {
        success: true,
        botId: this.id,
        username: this.client.account.username,
        userId: this.client.account.id
      };
    } catch (error) {
      console.error(`[Bot ${this.id}] Login failed:`, error.message);
      throw error;
    }
  }

  async joinRoom(roomIdentifier) {
    if (!this.isLoggedIn) {
      throw new Error('Bot is not logged in');
    }

    try {
      console.log(`[Bot ${this.id}] Joining room: ${roomIdentifier}`);
      
      // Fetch room data
      let room;
      if (typeof roomIdentifier === 'number' || !isNaN(roomIdentifier)) {
        room = await this.client.rooms.fetch(roomIdentifier);
      } else {
        const rooms = await this.client.rooms.search({ name: roomIdentifier, limit: 1 });
        room = rooms[0];
      }

      if (!room) {
        throw new Error(`Room not found: ${roomIdentifier}`);
      }

      // Subscribe to room messages via IMQ
      const queueName = `room.${room.id}`;
      
      this.imqManager.subscribeMessage(
        queueName,
        'chat',
        (err, mount) => {
          if (err) {
            console.error(`[Bot ${this.id}] Error subscribing to room:`, err);
            return;
          }

          // Listen for messages
          mount.on('message', (data) => {
            const message = {
              id: `msg-${Date.now()}-${Math.random()}`,
              roomId: room.id,
              author: data.sender?.username || 'Unknown',
              authorId: data.sender?.id || 'unknown',
              text: data.message || data.text || '',
              timestamp: Date.now(),
              type: 'user'
            };

            console.log(`[Bot ${this.id}] Message in ${room.name}: ${message.author}: ${message.text}`);
            
            // Notify all message callbacks
            this.messageCallbacks.forEach(cb => cb(message));
          });
        }
      );

      // Subscribe to presence (user join/leave)
      this.imqManager.subscribeState(
        queueName,
        'presence',
        (err, mount) => {
          if (err) {
            console.error(`[Bot ${this.id}] Error subscribing to presence:`, err);
            return;
          }

          mount.on('join', (data) => {
            console.log(`[Bot ${this.id}] User joined ${room.name}:`, data.userId);
            this.userJoinCallbacks.forEach(cb => cb(room.id, {
              id: data.userId,
              username: data.username || 'Unknown'
            }));
          });

          mount.on('leave', (data) => {
            console.log(`[Bot ${this.id}] User left ${room.name}:`, data.userId);
            this.userLeftCallbacks.forEach(cb => cb(room.id, data.userId, data.username || 'Unknown'));
          });
        }
      );

      this.currentRooms.set(room.id, {
        id: room.id,
        name: room.name,
        queueName
      });

      console.log(`[Bot ${this.id}] Successfully joined room: ${room.name} (${room.id})`);
      
      return {
        success: true,
        roomId: room.id,
        roomName: room.name
      };
    } catch (error) {
      console.error(`[Bot ${this.id}] Failed to join room:`, error.message);
      throw error;
    }
  }

  async leaveRoom(roomId) {
    if (!this.currentRooms.has(roomId)) {
      throw new Error(`Not in room: ${roomId}`);
    }

    try {
      const room = this.currentRooms.get(roomId);
      
      // Unsubscribe from IMQ queue
      this.imqManager.unsubscribeQueue(room.queueName);
      
      this.currentRooms.delete(roomId);
      console.log(`[Bot ${this.id}] Left room: ${room.name}`);
      
      return { success: true, roomId };
    } catch (error) {
      console.error(`[Bot ${this.id}] Failed to leave room:`, error.message);
      throw error;
    }
  }

  async sendMessage(roomId, text) {
    if (!this.currentRooms.has(roomId)) {
      throw new Error(`Not in room: ${roomId}`);
    }

    try {
      const room = this.currentRooms.get(roomId);
      
      // Send message via IMQ
      this.imqManager.sendMessage(
        room.queueName,
        'chat',
        {
          message: text,
          sender: {
            id: this.client.account.id,
            username: this.client.account.username
          }
        },
        (err) => {
          if (err) {
            console.error(`[Bot ${this.id}] Failed to send message:`, err);
          }
        }
      );

      console.log(`[Bot ${this.id}] Sent message in ${room.name}: ${text}`);
      
      return { success: true, roomId, text };
    } catch (error) {
      console.error(`[Bot ${this.id}] Failed to send message:`, error.message);
      throw error;
    }
  }

  async searchRooms(query = {}) {
    if (!this.isLoggedIn) {
      throw new Error('Bot is not logged in');
    }

    try {
      const rooms = await this.client.rooms.search(query);
      return rooms.map(room => ({
        id: room.id,
        name: room.name,
        description: room.description,
        rating: room.rating,
        privacy: room.privacy
      }));
    } catch (error) {
      console.error(`[Bot ${this.id}] Failed to search rooms:`, error.message);
      throw error;
    }
  }

  onMessage(callback) {
    this.messageCallbacks.push(callback);
  }

  onUserJoined(callback) {
    this.userJoinCallbacks.push(callback);
  }

  onUserLeft(callback) {
    this.userLeftCallbacks.push(callback);
  }

  getStatus() {
    return {
      id: this.id,
      username: this.username,
      isLoggedIn: this.isLoggedIn,
      currentRooms: Array.from(this.currentRooms.values()),
      userId: this.client?.account?.id || null
    };
  }

  async logout() {
    if (this.imqManager) {
      this.imqManager.close();
    }
    
    if (this.client) {
      await this.client.logout();
    }

    this.isLoggedIn = false;
    this.currentRooms.clear();
    this.messageCallbacks = [];
    this.userJoinCallbacks = [];
    this.userLeftCallbacks = [];
    
    console.log(`[Bot ${this.id}] Logged out`);
  }
}

export class BotManager {
  constructor() {
    this.bots = new Map(); // botId -> BotInstance
    this.nextBotId = 1;
  }

  async createBot(username, password) {
    const botId = `bot-${this.nextBotId++}`;
    const bot = new BotInstance(botId, username, password);
    
    await bot.login();
    
    this.bots.set(botId, bot);
    return bot;
  }

  getBot(botId) {
    return this.bots.get(botId);
  }

  getAllBots() {
    return Array.from(this.bots.values()).map(bot => bot.getStatus());
  }

  async removeBot(botId) {
    const bot = this.bots.get(botId);
    if (bot) {
      await bot.logout();
      this.bots.delete(botId);
    }
  }
}
