/**
 * 👥 ADVANCED FEATURE 2: Real-Time Collaborative Chat Rooms
 * 
 * Multi-user chat rooms with real-time synchronization, cursor tracking,
 * and collaborative features using WebSocket connections.
 */

interface CollaborativeMessage {
  id: string;
  content: string;
  userId: string;
  userName: string;
  timestamp: Date;
  type: 'user' | 'llm' | 'system';
  providerId?: string;
  isEditing?: boolean;
  mentions?: string[];
  reactions?: Record<string, string[]>; // emoji -> user IDs
}

interface RoomParticipant {
  userId: string;
  userName: string;
  avatar?: string;
  isOnline: boolean;
  lastSeen: Date;
  cursor?: {
    x: number;
    y: number;
    messageId?: string;
  };
  typing?: {
    isTyping: boolean;
    lastTyping: Date;
  };
}

interface CollaborativeRoom {
  id: string;
  name: string;
  description?: string;
  createdBy: string;
  createdAt: Date;
  participants: Map<string, RoomParticipant>;
  messages: CollaborativeMessage[];
  isPublic: boolean;
  maxParticipants: number;
  settings: {
    allowAnonymous: boolean;
    moderationLevel: 'open' | 'moderated' | 'strict';
    allowLLMResponses: boolean;
    sharedPrompts: boolean;
  };
}

interface RealTimeEvent {
  type: 'message' | 'typing' | 'cursor' | 'reaction' | 'join' | 'leave' | 'edit';
  roomId: string;
  userId: string;
  data: any;
  timestamp: Date;
}

class CollaborativeChatManager {
  private rooms: Map<string, CollaborativeRoom> = new Map();
  private connections: Map<string, Set<WebSocket>> = new Map(); // roomId -> websockets
  private userSessions: Map<string, {roomId: string, ws: WebSocket}> = new Map();
  private presenceTimeout: number = 30000; // 30 seconds

  constructor() {
    this.startPresenceCleanup();
  }

  /**
   * Create a new collaborative room
   */
  createRoom(
    name: string,
    creatorId: string,
    creatorName: string,
    options: Partial<CollaborativeRoom['settings']> = {}
  ): string {
    const roomId = this.generateRoomId();
    
    const room: CollaborativeRoom = {
      id: roomId,
      name,
      createdBy: creatorId,
      createdAt: new Date(),
      participants: new Map(),
      messages: [],
      isPublic: false,
      maxParticipants: 50,
      settings: {
        allowAnonymous: false,
        moderationLevel: 'open',
        allowLLMResponses: true,
        sharedPrompts: true,
        ...options
      }
    };

    // Add creator as first participant
    room.participants.set(creatorId, {
      userId: creatorId,
      userName: creatorName,
      isOnline: true,
      lastSeen: new Date()
    });

    this.rooms.set(roomId, room);
    this.connections.set(roomId, new Set());

    // Add system message
    this.addSystemMessage(roomId, `Room "${name}" created by ${creatorName}`);

    return roomId;
  }

  /**
   * Join a collaborative room
   */
  async joinRoom(
    roomId: string, 
    userId: string, 
    userName: string, 
    ws: WebSocket
  ): Promise<boolean> {
    const room = this.rooms.get(roomId);
    if (!room) return false;

    // Check room capacity
    if (room.participants.size >= room.maxParticipants) {
      this.sendToUser(ws, {
        type: 'error',
        data: { message: 'Room is at maximum capacity' }
      });
      return false;
    }

    // Add participant
    room.participants.set(userId, {
      userId,
      userName,
      isOnline: true,
      lastSeen: new Date()
    });

    // Add WebSocket connection
    const roomConnections = this.connections.get(roomId) || new Set();
    roomConnections.add(ws);
    this.connections.set(roomId, roomConnections);

    // Store user session
    this.userSessions.set(userId, { roomId, ws });

    // Setup WebSocket handlers
    this.setupWebSocketHandlers(ws, roomId, userId);

    // Send room state to new participant
    this.sendToUser(ws, {
      type: 'room_state',
      data: {
        room: this.serializeRoom(room),
        messages: room.messages.slice(-50) // Send last 50 messages
      }
    });

    // Notify others about new participant
    this.broadcastToRoom(roomId, {
      type: 'join',
      roomId,
      userId,
      data: { userName },
      timestamp: new Date()
    }, userId);

    // Add system message
    this.addSystemMessage(roomId, `${userName} joined the room`);

    return true;
  }

  /**
   * Leave a collaborative room
   */
  leaveRoom(userId: string): void {
    const session = this.userSessions.get(userId);
    if (!session) return;

    const { roomId, ws } = session;
    const room = this.rooms.get(roomId);
    if (!room) return;

    // Remove participant
    const participant = room.participants.get(userId);
    if (participant) {
      room.participants.delete(userId);
      
      // Notify others
      this.broadcastToRoom(roomId, {
        type: 'leave',
        roomId,
        userId,
        data: { userName: participant.userName },
        timestamp: new Date()
      });

      this.addSystemMessage(roomId, `${participant.userName} left the room`);
    }

    // Remove WebSocket connection
    const roomConnections = this.connections.get(roomId);
    if (roomConnections) {
      roomConnections.delete(ws);
    }

    // Remove user session
    this.userSessions.delete(userId);

    // Clean up empty rooms (except if creator is still there)
    if (room.participants.size === 0 || 
        (room.participants.size === 1 && !room.participants.has(room.createdBy))) {
      this.rooms.delete(roomId);
      this.connections.delete(roomId);
    }
  }

  /**
   * Send a message to the room
   */
  sendMessage(
    roomId: string,
    userId: string,
    content: string,
    type: 'user' | 'llm' = 'user',
    providerId?: string
  ): void {
    const room = this.rooms.get(roomId);
    if (!room || !room.participants.has(userId)) return;

    const participant = room.participants.get(userId)!;
    const message: CollaborativeMessage = {
      id: this.generateMessageId(),
      content,
      userId,
      userName: participant.userName,
      timestamp: new Date(),
      type,
      providerId,
      mentions: this.extractMentions(content),
      reactions: {}
    };

    room.messages.push(message);

    // Limit message history
    if (room.messages.length > 1000) {
      room.messages = room.messages.slice(-1000);
    }

    // Broadcast message to all participants
    this.broadcastToRoom(roomId, {
      type: 'message',
      roomId,
      userId,
      data: message,
      timestamp: new Date()
    });

    // Handle mentions
    this.handleMentions(roomId, message);
  }

  /**
   * Update typing status
   */
  updateTypingStatus(roomId: string, userId: string, isTyping: boolean): void {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const participant = room.participants.get(userId);
    if (!participant) return;

    participant.typing = {
      isTyping,
      lastTyping: new Date()
    };

    // Broadcast typing status (but not to the typer)
    this.broadcastToRoom(roomId, {
      type: 'typing',
      roomId,
      userId,
      data: { isTyping, userName: participant.userName },
      timestamp: new Date()
    }, userId);
  }

  /**
   * Update cursor position for real-time collaboration
   */
  updateCursor(
    roomId: string, 
    userId: string, 
    x: number, 
    y: number, 
    messageId?: string
  ): void {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const participant = room.participants.get(userId);
    if (!participant) return;

    participant.cursor = { x, y, messageId };

    // Broadcast cursor position (throttled)
    this.throttledBroadcast(roomId, {
      type: 'cursor',
      roomId,
      userId,
      data: { x, y, messageId, userName: participant.userName },
      timestamp: new Date()
    }, userId, 100); // 100ms throttle
  }

  /**
   * Add reaction to a message
   */
  addReaction(
    roomId: string, 
    userId: string, 
    messageId: string, 
    emoji: string
  ): void {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const message = room.messages.find(m => m.id === messageId);
    if (!message) return;

    if (!message.reactions) message.reactions = {};
    if (!message.reactions[emoji]) message.reactions[emoji] = [];

    // Toggle reaction
    const userReactions = message.reactions[emoji];
    const index = userReactions.indexOf(userId);
    if (index > -1) {
      userReactions.splice(index, 1);
      if (userReactions.length === 0) {
        delete message.reactions[emoji];
      }
    } else {
      userReactions.push(userId);
    }

    // Broadcast reaction update
    this.broadcastToRoom(roomId, {
      type: 'reaction',
      roomId,
      userId,
      data: { messageId, emoji, reactions: message.reactions },
      timestamp: new Date()
    });
  }

  /**
   * Get shared LLM responses for the room
   */
  async getSharedLLMResponse(
    roomId: string, 
    prompt: string, 
    requestedBy: string,
    providerPreference?: string
  ): Promise<void> {
    const room = this.rooms.get(roomId);
    if (!room || !room.settings.allowLLMResponses) return;

    // Use intelligent router to select best provider
    const availableProviders = ['openai', 'claude', 'google', 'llama'];
    
    try {
      // This would integrate with the intelligent router
      const response = await this.callLLMProvider(providerPreference || 'openai', prompt);
      
      this.sendMessage(
        roomId,
        'llm-assistant',
        response,
        'llm',
        providerPreference || 'openai'
      );

    } catch (error) {
      this.addSystemMessage(roomId, `Failed to get LLM response: ${error}`);
    }
  }

  private setupWebSocketHandlers(ws: WebSocket, roomId: string, userId: string): void {
    ws.on('message', (data: Buffer) => {
      try {
        const event = JSON.parse(data.toString()) as RealTimeEvent;
        this.handleWebSocketEvent(roomId, userId, event);
      } catch (error) {
        console.error('Invalid WebSocket message:', error);
      }
    });

    ws.on('close', () => {
      this.leaveRoom(userId);
    });

    ws.on('error', (error) => {
      console.error('WebSocket error for user', userId, ':', error);
      this.leaveRoom(userId);
    });
  }

  private handleWebSocketEvent(roomId: string, userId: string, event: RealTimeEvent): void {
    switch (event.type) {
      case 'message':
        this.sendMessage(roomId, userId, event.data.content);
        break;
      
      case 'typing':
        this.updateTypingStatus(roomId, userId, event.data.isTyping);
        break;
      
      case 'cursor':
        this.updateCursor(roomId, userId, event.data.x, event.data.y, event.data.messageId);
        break;
      
      case 'reaction':
        this.addReaction(roomId, userId, event.data.messageId, event.data.emoji);
        break;

      default:
        console.warn('Unknown event type:', event.type);
    }
  }

  private broadcastToRoom(roomId: string, event: RealTimeEvent, excludeUserId?: string): void {
    const connections = this.connections.get(roomId);
    if (!connections) return;

    const message = JSON.stringify(event);
    connections.forEach(ws => {
      // Skip the sender if excludeUserId is provided
      if (excludeUserId) {
        const userSession = Array.from(this.userSessions.entries())
          .find(([_, session]) => session.ws === ws);
        if (userSession && userSession[0] === excludeUserId) return;
      }

      if (ws.readyState === ws.OPEN) {
        ws.send(message);
      }
    });
  }

  private throttledBroadcast(
    roomId: string, 
    event: RealTimeEvent, 
    excludeUserId?: string,
    throttleMs: number = 100
  ): void {
    // Simple throttling using setTimeout
    const key = `${roomId}_${event.type}_${excludeUserId}`;
    if (this.throttleMap.has(key)) return;

    this.throttleMap.set(key, true);
    setTimeout(() => {
      this.broadcastToRoom(roomId, event, excludeUserId);
      this.throttleMap.delete(key);
    }, throttleMs);
  }

  private throttleMap: Map<string, boolean> = new Map();

  private sendToUser(ws: WebSocket, data: any): void {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify(data));
    }
  }

  private addSystemMessage(roomId: string, content: string): void {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const message: CollaborativeMessage = {
      id: this.generateMessageId(),
      content,
      userId: 'system',
      userName: 'System',
      timestamp: new Date(),
      type: 'system'
    };

    room.messages.push(message);

    this.broadcastToRoom(roomId, {
      type: 'message',
      roomId,
      userId: 'system',
      data: message,
      timestamp: new Date()
    });
  }

  private extractMentions(content: string): string[] {
    const mentionRegex = /@(\w+)/g;
    const mentions = [];
    let match;
    while ((match = mentionRegex.exec(content)) !== null) {
      mentions.push(match[1]);
    }
    return mentions;
  }

  private handleMentions(roomId: string, message: CollaborativeMessage): void {
    if (!message.mentions || message.mentions.length === 0) return;

    const room = this.rooms.get(roomId);
    if (!room) return;

    // Send notification to mentioned users
    message.mentions.forEach(mention => {
      const participant = Array.from(room.participants.values())
        .find(p => p.userName.toLowerCase() === mention.toLowerCase());
      
      if (participant) {
        const session = this.userSessions.get(participant.userId);
        if (session) {
          this.sendToUser(session.ws, {
            type: 'mention',
            data: {
              message,
              mentionedBy: message.userName
            }
          });
        }
      }
    });
  }

  private serializeRoom(room: CollaborativeRoom): any {
    return {
      id: room.id,
      name: room.name,
      description: room.description,
      participants: Array.from(room.participants.values()),
      isPublic: room.isPublic,
      settings: room.settings,
      participantCount: room.participants.size
    };
  }

  private startPresenceCleanup(): void {
    setInterval(() => {
      this.cleanupInactiveUsers();
    }, this.presenceTimeout);
  }

  private cleanupInactiveUsers(): void {
    const now = new Date();
    
    this.rooms.forEach(room => {
      room.participants.forEach((participant, userId) => {
        if (participant.isOnline && 
            now.getTime() - participant.lastSeen.getTime() > this.presenceTimeout) {
          participant.isOnline = false;
          
          // Notify room about user going offline
          this.broadcastToRoom(room.id, {
            type: 'leave',
            roomId: room.id,
            userId,
            data: { userName: participant.userName, temporary: true },
            timestamp: now
          });
        }
      });
    });
  }

  private async callLLMProvider(provider: string, prompt: string): Promise<string> {
    // This would integrate with existing LLM infrastructure
    // For now, return a mock response
    return `[${provider}] Response to: ${prompt.substring(0, 50)}...`;
  }

  private generateRoomId(): string {
    return 'room_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
  }

  private generateMessageId(): string {
    return 'msg_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
  }

  /**
   * Get room analytics and statistics
   */
  getRoomAnalytics(roomId: string): any {
    const room = this.rooms.get(roomId);
    if (!room) return null;

    const now = new Date();
    const onlineUsers = Array.from(room.participants.values()).filter(p => p.isOnline).length;
    const totalMessages = room.messages.length;
    const messagesByType = room.messages.reduce((acc, msg) => {
      acc[msg.type] = (acc[msg.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      roomId,
      name: room.name,
      onlineUsers,
      totalParticipants: room.participants.size,
      totalMessages,
      messagesByType,
      averageResponseTime: this.calculateAverageResponseTime(room),
      activityLevel: this.calculateActivityLevel(room),
      createdAt: room.createdAt
    };
  }

  private calculateAverageResponseTime(room: CollaborativeRoom): number {
    // Calculate average time between user messages and LLM responses
    const userMessages = room.messages.filter(m => m.type === 'user');
    const llmMessages = room.messages.filter(m => m.type === 'llm');
    
    if (userMessages.length === 0 || llmMessages.length === 0) return 0;

    let totalResponseTime = 0;
    let responseCount = 0;

    userMessages.forEach(userMsg => {
      const nextLLMResponse = llmMessages.find(llmMsg => 
        llmMsg.timestamp > userMsg.timestamp
      );
      if (nextLLMResponse) {
        totalResponseTime += nextLLMResponse.timestamp.getTime() - userMsg.timestamp.getTime();
        responseCount++;
      }
    });

    return responseCount > 0 ? totalResponseTime / responseCount : 0;
  }

  private calculateActivityLevel(room: CollaborativeRoom): 'low' | 'medium' | 'high' {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    
    const recentMessages = room.messages.filter(m => m.timestamp > oneHourAgo);
    const messagesPerHour = recentMessages.length;

    if (messagesPerHour < 10) return 'low';
    if (messagesPerHour < 50) return 'medium';
    return 'high';
  }
}

// Export singleton instance
export const collaborativeChat = new CollaborativeChatManager();
export type { CollaborativeMessage, RoomParticipant, CollaborativeRoom, RealTimeEvent };