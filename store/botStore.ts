import { create } from 'zustand';
import { Bot, Room, Message, AIPersonality, AIProvider, RoomUser } from '../types';
import { imvuService } from '../services/imvuService';

interface BotState {
    bots: Bot[];
    rooms: Record<string, Room>;
    activeBotId: string | null;
    activeRoomId: string | null;
    logs: string[];
    loginModal: { isOpen: boolean; botId: string | null };
    availableRooms: Pick<Room, 'id' | 'name'>[];

    initialize: () => void;
    addBot: (name: string) => void;

    openLoginModal: (botId: string) => void;
    closeLoginModal: () => void;
    loginBot: (botId: string, user: string, pass: string) => Promise<boolean>;
    logoutBot: (botId: string) => void;
    
    setActiveBot: (botId: string | null) => void;
    setActiveRoom: (roomId: string | null) => void;
    updateBotAiSettings: (botId: string, settings: Partial<AIPersonality>) => void;
    updateBotAiProvider: (botId: string, provider: AIProvider) => void;
    toggleBotAi: (botId: string) => void;
    
    fetchAvailableRooms: (botId: string) => void;
    joinRoom: (botId: string, roomName: string) => Promise<void>;
    leaveRoom: (botId: string, roomId: string) => Promise<void>;
    
    sendMessage: (botId: string, roomId: string, text: string) => Promise<void>;
    addMessage: (message: Message) => void;
    addLog: (log: string) => void;
    addUserToRoom: (roomId: string, user: RoomUser) => void;
    removeUserFromRoom: (roomId: string, userId: string) => void;
}

const initialBots: Bot[] = [
    {
        id: 'bot-1',
        name: 'Bot_Alpha',
        status: 'offline',
        isAiEnabled: true,
        activeRoomIds: [],
        personality: {
            style: 'friendly',
            responseSpeed: 80,
            aggressiveness: 10,
            humor: 70,
            creativity: 90,
            language: 'English',
            behavior: 'neutral',
            mode: 'entertainer',
        },
        aiProvider: 'gemini',
    },
    {
        id: 'bot-2',
        name: 'Bot_Beta',
        status: 'offline',
        isAiEnabled: false,
        activeRoomIds: [],
        personality: {
            style: 'sarcastic',
            responseSpeed: 60,
            aggressiveness: 40,
            humor: 90,
            creativity: 70,
            language: 'English',
            behavior: 'dominant',
            mode: 'entertainer',
        },
        aiProvider: 'gemini',
    },
];

export const useBotStore = create<BotState>((set, get) => ({
    bots: initialBots,
    rooms: {},
    activeBotId: initialBots.length > 0 ? initialBots[0].id : null,
    activeRoomId: null,
    logs: [],
    loginModal: { isOpen: false, botId: null },
    availableRooms: [],
    
    initialize: () => {
        imvuService.onMessage((message) => {
            get().addMessage(message);
        });
        imvuService.onLog((log) => {
            get().addLog(log);
        });
        imvuService.onUserJoined((roomId, user) => {
            get().addUserToRoom(roomId, user);
            get().addMessage({
                id: `msg-${Date.now()}`,
                roomId,
                author: 'System',
                authorId: 'system',
                text: `${user.name} has joined the room.`,
                timestamp: Date.now(),
                type: 'system'
            });
        });
        imvuService.onUserLeft((roomId, userId, userName) => {
            get().removeUserFromRoom(roomId, userId);
            get().addMessage({
                id: `msg-${Date.now()}`,
                roomId,
                author: 'System',
                authorId: 'system',
                text: `${userName} has left the room.`,
                timestamp: Date.now(),
                type: 'system'
            });
        });
    },

    addBot: (name) => set(state => ({ bots: [...state.bots, { 
        id: `bot-${Date.now()}`,
        name,
        status: 'offline',
        isAiEnabled: false,
        activeRoomIds: [],
        personality: { ...initialBots[0].personality },
        aiProvider: 'gemini',
    }] })),

    openLoginModal: (botId) => set({ loginModal: { isOpen: true, botId } }),
    closeLoginModal: () => set({ loginModal: { isOpen: false, botId: null } }),

    loginBot: async (botId, user, pass) => {
        const bot = get().bots.find(b => b.id === botId);
        if (!bot) return false;

        const success = await imvuService.login(botId, bot.name, pass);
        if (success) {
            set(state => ({
                bots: state.bots.map(b => b.id === botId ? { ...b, status: 'online' } : b),
                loginModal: { isOpen: false, botId: null }
            }));
        }
        return success;
    },

    logoutBot: (botId) => {
        imvuService.logout(botId);
        set(state => {
            // FIX: Explicitly cast status to 'offline' to prevent type widening to string.
            const newBots = state.bots.map(b => b.id === botId ? { ...b, status: 'offline' as 'offline', activeRoomIds: [] } : b);
            
            let newActiveBotId = state.activeBotId;
            if (state.activeBotId === botId) {
                const nextOnlineBot = newBots.find(b => b.status === 'online');
                newActiveBotId = nextOnlineBot ? nextOnlineBot.id : newBots.length > 0 ? newBots[0].id : null;
            }

            return {
                bots: newBots,
                activeBotId: newActiveBotId,
                activeRoomId: state.activeBotId === botId ? null : state.activeRoomId, // Clear active room if the logged out bot was active
            }
        });
    },

    setActiveBot: (botId) => set({ activeBotId: botId, activeRoomId: null }),
    setActiveRoom: (roomId) => set({ activeRoomId: roomId }),

    updateBotAiSettings: (botId, settings) => set(state => ({
        bots: state.bots.map(b => b.id === botId ? { ...b, personality: { ...b.personality, ...settings } } : b)
    })),
    
    updateBotAiProvider: (botId, provider) => set(state => ({
        bots: state.bots.map(b => b.id === botId ? { ...b, aiProvider: provider } : b)
    })),

    toggleBotAi: (botId) => set(state => ({
        bots: state.bots.map(b => b.id === botId ? { ...b, isAiEnabled: !b.isAiEnabled } : b)
    })),

    fetchAvailableRooms: async (botId) => {
        const rooms = await imvuService.getRooms(botId);
        set({ availableRooms: rooms });
    },

    joinRoom: async (botId, roomName) => {
        const bot = get().bots.find(b => b.id === botId);
        if(!bot || bot.status === 'offline') return;

        const roomId = await imvuService.joinRoom(bot.id, roomName);
        if (!roomId) return; // Join room failed

        set(state => {
            if (bot.activeRoomIds.includes(roomId)) return state;

            return {
                bots: state.bots.map(b => b.id === botId ? { ...b, activeRoomIds: [...b.activeRoomIds, roomId] } : b),
                rooms: {
                    ...state.rooms,
                    [roomId]: { id: roomId, name: roomName, users: [{id: botId, name: bot.name}], messages: [] }
                }
            }
        });
    },

    leaveRoom: async (botId, roomId) => {
        await imvuService.leaveRoom(botId, roomId);
        set(state => ({
            bots: state.bots.map(b => b.id === botId ? { ...b, activeRoomIds: b.activeRoomIds.filter(id => id !== roomId) } : b),
            activeRoomId: state.activeRoomId === roomId ? null : state.activeRoomId
        }));
    },

    sendMessage: async (botId, roomId, text) => {
        const bot = get().bots.find(b => b.id === botId);
        if (!bot) return;
        await imvuService.sendMessage(botId, roomId, text);
    },

    addMessage: (message) => set(state => {
        const room = state.rooms[message.roomId];
        if (!room) return state;
        return {
            rooms: {
                ...state.rooms,
                [message.roomId]: { ...room, messages: [...room.messages, message].slice(-200) } // Keep last 200 messages
            }
        };
    }),

    addLog: (log) => set(state => ({ logs: [log, ...state.logs.slice(0, 99)] })),

    addUserToRoom: (roomId, user) => set(state => {
        const room = state.rooms[roomId];
        if (!room || room.users.some(u => u.id === user.id)) return state;
        return {
            rooms: {
                ...state.rooms,
                [roomId]: { ...room, users: [...room.users, user] }
            }
        };
    }),

    removeUserFromRoom: (roomId, userId) => set(state => {
        const room = state.rooms[roomId];
        if (!room) return state;
        return {
            rooms: {
                ...state.rooms,
                [roomId]: { ...room, users: room.users.filter(u => u.id !== userId) }
            }
        };
    }),
}));