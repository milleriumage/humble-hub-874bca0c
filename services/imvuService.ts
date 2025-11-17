import { Message, RoomUser } from '../types';

type MessageCallback = (message: Message) => void;
type LogCallback = (log: string) => void;
type UserJoinedCallback = (roomId: string, user: RoomUser) => void;
type UserLeftCallback = (roomId: string, userId: string, userName: string) => void;

// Resolve backend URL from env or localStorage
const getBackendUrl = (): string => {
  const envUrl = (import.meta as any).env?.VITE_BACKEND_URL;
  const lsUrl = typeof window !== 'undefined' ? localStorage.getItem('BACKEND_URL') : null;
  return (envUrl || lsUrl || '').trim();
};

const toWsUrl = (httpUrl: string): string => {
  if (!httpUrl) return '';
  try {
    const url = new URL(httpUrl);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    url.pathname = url.pathname.replace(/\/$/, '') + '/ws';
    return url.toString();
  } catch {
    return '';
  }
};

class ImvuService {
    private messageCallback: MessageCallback | null = null;
    private logCallback: LogCallback | null = null;
    private userJoinedCallback: UserJoinedCallback | null = null;
    private userLeftCallback: UserLeftCallback | null = null;
    private ws: WebSocket | null = null;
    private reconnectTimer: any = null;

    constructor() {
        this.connectWebSocket();
    }

    private get BACKEND_URL() { return getBackendUrl(); }
    private get WS_URL() { return toWsUrl(this.BACKEND_URL); }

    private connectWebSocket() {
        const wsUrl = this.WS_URL;
        if (!wsUrl) {
            this.log('[WebSocket] Backend URL not configured. Set VITE_BACKEND_URL or localStorage.BACKEND_URL (e.g., https://xxx.ngrok-free.app)');
            return;
        }

        try {
            this.ws = new WebSocket(wsUrl);

            this.ws.onopen = () => {
                this.log('[WebSocket] Connected to backend server');
            };

            this.ws.onmessage = (event) => {
                const data = JSON.parse(event.data);
                
                switch (data.type) {
                    case 'message':
                        this.messageCallback?.(data.data);
                        break;
                    case 'user_joined':
                        this.userJoinedCallback?.(data.data.roomId, data.data.user);
                        break;
                    case 'user_left':
                        this.userLeftCallback?.(data.data.roomId, data.data.userId, data.data.username);
                        break;
                    case 'log':
                        this.log(data.data);
                        break;
                }
            };

            this.ws.onerror = () => {
                this.log('[WebSocket] Error connecting to backend');
            };

            this.ws.onclose = () => {
                this.log('[WebSocket] Disconnected. Reconnecting in 3s...');
                this.reconnectTimer = setTimeout(() => this.connectWebSocket(), 3000);
            };
        } catch (error) {
            this.log('[WebSocket] Failed to connect. Check backend URL.');
            console.error('WebSocket error:', error);
        }
    }

    public onMessage(callback: MessageCallback) { this.messageCallback = callback; }
    public onLog(callback: LogCallback) { this.logCallback = callback; }
    public onUserJoined(callback: UserJoinedCallback) { this.userJoinedCallback = callback; }
    public onUserLeft(callback: UserLeftCallback) { this.userLeftCallback = callback; }
    
    public async login(botId: string, username: string, password?: string): Promise<boolean> {
        console.log('[ImvuService] Login called - botId:', botId, 'username:', username);
        console.log('[ImvuService] Backend URL:', this.BACKEND_URL);
        
        if (!password) {
            this.log(`[${username}] Login failed: Password is required.`);
            console.error('[ImvuService] No password provided');
            return false;
        }

        if (!this.BACKEND_URL) {
            this.log(`[${username}] ❌ Backend URL not configured! Set it via: localStorage.setItem('BACKEND_URL', 'https://your-url.vercel.app')`);
            console.error('[ImvuService] Backend URL is empty!');
            alert('⚠️ Backend não configurado!\n\n1. Faça deploy no Vercel (veja DEPLOY.md)\n2. Configure a URL no console:\nlocalStorage.setItem("BACKEND_URL", "https://sua-url.vercel.app");\nlocation.reload();');
            return false;
        }

        try {
            this.log(`[${username}] Connecting to backend: ${this.BACKEND_URL}/login`);
            console.log('[ImvuService] Sending login request...');
            
            const response = await fetch(`${this.BACKEND_URL}/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });

            console.log('[ImvuService] Response status:', response.status);
            const data = await response.json();
            console.log('[ImvuService] Response data:', data);

            if (!response.ok || !data.success) {
                this.log(`[${username}] ❌ Login failed: ${data.error || 'Unknown error'}`);
                console.error('[ImvuService] Login failed:', data);
                return false;
            }

            this.log(`[${username}] ✅ Successfully logged in!`);
            console.log('[ImvuService] Login successful!');
            return true;
        } catch (error: any) {
            this.log(`[${username}] ❌ Connection error: ${error.message}. Backend may not be running.`);
            console.error('[ImvuService] Login error:', error);
            alert(`❌ Erro ao conectar com backend!\n\nErro: ${error.message}\n\nVerifique:\n1. Backend está rodando? (vercel logs)\n2. URL está correta no localStorage?`);
            return false;
        }
    }

    public async logout(botId: string): Promise<void> {
        if (!this.BACKEND_URL) return;
        try {
            await fetch(`${this.BACKEND_URL}/bots/${botId}/logout`, {
                method: 'POST'
            });
            this.log(`[${botId}] Logged out`);
        } catch (error: any) {
            this.log(`[${botId}] Logout failed: ${error.message}`);
            console.error('Logout error:', error);
        }
    }

    public async getRooms(botId: string): Promise<{id: string, name: string}[]> {
        if (!this.BACKEND_URL) return [];
        try {
            this.log(`[${botId}] Fetching public rooms...`);
            
            const response = await fetch(`${this.BACKEND_URL}/bots/${botId}/rooms/search`);
            const data = await response.json();

            if (!response.ok || !data.success) {
                this.log(`[${botId}] Failed to fetch rooms: ${data.error || 'Unknown error'}`);
                return [];
            }

            return data.rooms.map((room: any) => ({ 
                id: room.id, 
                name: room.name 
            }));
        } catch (error: any) {
            this.log(`[${botId}] Failed to fetch rooms: ${error.message}`);
            console.error('Get rooms error:', error);
            return [];
        }
    }

    public async joinRoom(botId: string, roomName: string): Promise<string | null> {
        if (!this.BACKEND_URL) return null;
        try {
            this.log(`[${botId}] Joining room: ${roomName}...`);
            
            const response = await fetch(`${this.BACKEND_URL}/bots/${botId}/rooms/join`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ room: roomName })
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                this.log(`[${botId}] Failed to join room: ${data.error || 'Unknown error'}`);
                return null;
            }

            return data.roomId;
        } catch (error: any) {
            this.log(`[${botId}] Failed to join room: ${error.message}`);
            console.error('Join room error:', error);
            return null;
        }
    }

    public async leaveRoom(botId: string, roomId: string): Promise<void> {
        if (!this.BACKEND_URL) return;
        try {
            await fetch(`${this.BACKEND_URL}/bots/${botId}/rooms/${roomId}/leave`, {
                method: 'POST'
            });
            this.log(`[${botId}] Left room ${roomId}`);
        } catch (error: any) {
            this.log(`[${botId}] Failed to leave room: ${error.message}`);
            console.error('Leave room error:', error);
        }
    }

    public async sendMessage(botId: string, roomId: string, text: string): Promise<void> {
        if (!this.BACKEND_URL) return;
        try {
            await fetch(`${this.BACKEND_URL}/bots/${botId}/rooms/${roomId}/send`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ message: text })
            });
        } catch (error: any) {
            this.log(`[${botId}] Failed to send message: ${error.message}`);
            console.error('Send message error:', error);
        }
    }

    private log(logMessage: string) {
        const timestamp = new Date().toLocaleTimeString();
        this.logCallback?.(`[${timestamp}] ${logMessage}`);
    }
}

export const imvuService = new ImvuService();
