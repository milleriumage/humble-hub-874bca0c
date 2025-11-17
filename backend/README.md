# IMVU Bot Manager Backend

Backend Node.js server with Express, WebSocket, and real IMVU integration using imvu.js.

## 🚀 Quick Start

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Start the Server

```bash
npm start
```

Or with auto-reload during development:

```bash
npm run dev
```

The server will start on `http://localhost:3001`

## 📡 API Endpoints

### Authentication

#### `POST /login`
Login a new bot to IMVU.

**Body:**
```json
{
  "username": "your_imvu_username",
  "password": "your_imvu_password"
}
```

**Response:**
```json
{
  "success": true,
  "bot": {
    "id": "bot-1",
    "username": "your_imvu_username",
    "isLoggedIn": true,
    "currentRooms": [],
    "userId": "123456"
  }
}
```

### Bot Management

#### `GET /bots`
Get all active bots.

#### `GET /bots/:botId/status`
Get status of a specific bot.

#### `POST /bots/:botId/logout`
Logout a bot.

### Room Management

#### `GET /bots/:botId/rooms/search?name=roomname`
Search for rooms.

#### `POST /bots/:botId/rooms/join`
Join a room.

**Body:**
```json
{
  "room": "Nightclub Lounge"
}
```

Or use room ID:
```json
{
  "room": 823733
}
```

#### `POST /bots/:botId/rooms/:roomId/leave`
Leave a room.

### Messaging

#### `POST /bots/:botId/rooms/:roomId/send`
Send a message to a room.

**Body:**
```json
{
  "message": "Hello everyone!"
}
```

## 🔌 WebSocket

Connect to `ws://localhost:3001/ws` to receive real-time events.

### Event Types

#### `message`
New message in a room.
```json
{
  "type": "message",
  "data": {
    "id": "msg-123",
    "roomId": "room-456",
    "author": "username",
    "authorId": "user-789",
    "text": "Hello!",
    "timestamp": 1234567890,
    "type": "user"
  }
}
```

#### `user_joined`
User joined a room.
```json
{
  "type": "user_joined",
  "data": {
    "roomId": "room-456",
    "user": {
      "id": "user-789",
      "username": "username"
    }
  }
}
```

#### `user_left`
User left a room.
```json
{
  "type": "user_left",
  "data": {
    "roomId": "room-456",
    "userId": "user-789",
    "username": "username"
  }
}
```

#### `log`
Server log message.
```json
{
  "type": "log",
  "data": "[bot-1] Successfully logged in"
}
```

#### `room_joined`
Bot joined a room.
```json
{
  "type": "room_joined",
  "data": {
    "botId": "bot-1",
    "roomId": "room-456",
    "roomName": "Nightclub Lounge"
  }
}
```

## 🏗️ Architecture

- **BotManager**: Manages multiple bot instances
- **BotInstance**: Represents a single IMVU bot
- **IMVU Client API**: Handles HTTP requests to IMVU
- **IMQ Manager**: Handles real-time WebSocket communication with IMVU chat servers

## 📝 Notes

- Each bot requires valid IMVU credentials
- Bots connect to real IMVU chat rooms
- WebSocket provides real-time updates to frontend
- Multiple bots can be active simultaneously
- Each bot can be in multiple rooms at once

## 🐛 Debugging

Check console logs for detailed information about:
- Login attempts
- Room joins/leaves
- Message sending/receiving
- WebSocket connections
- Errors and exceptions
