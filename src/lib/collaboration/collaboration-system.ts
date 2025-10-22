/**
 * Advanced Real-time Collaboration System for RealMultiLLM
 * Provides real-time collaboration with operational transformation
 */

import { Logger } from '../../lib/logger';
import { Cache } from '../../lib/cache';
import { LLMManager } from '../../lib/llm-manager';

// Type definitions
export interface CollaborationRoom {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  participants: Map<string, Participant>;
  createdAt: Date;
  updatedAt: Date;
  maxParticipants: number;
  isPublic: boolean;
  metadata: Record<string, any>;
  content: string;
  operations: Operation[];
  version: number;
}

export interface Participant {
  id: string;
  userId: string;
  name: string;
  role: 'owner' | 'editor' | 'viewer';
  joinedAt: Date;
  lastActive: Date;
  cursorPosition?: number;
  selectionRange?: [number, number];
  color: string; // Color for this participant's edits
  isActive: boolean;
}

export interface Operation {
  id: string;
  type: 'insert' | 'delete' | 'update';
  userId: string;
  position: number;
  content?: string;
  length?: number;
  timestamp: Date;
  clientId: string; // ID of the client that originated this operation
  roomId: string;
  metadata?: Record<string, any>;
}

export interface OperationMetadata {
  agentUsed?: string; // Which AI agent was used for this operation
  wasAIAssisted?: boolean;
  originalOperation?: string; // Original operation before AI assistance
}

export interface ConflictResolution {
  strategy: 'server-wins' | 'client-wins' | 'merge' | 'custom';
  resolvedAt: Date;
  resolverId: string;
  originalOperations: Operation[];
  resolvedOperation: Operation;
  metadata?: Record<string, any>;
}

export interface CollaborationEvent {
  id: string;
  type: 'join' | 'leave' | 'content-update' | 'operation' | 'selection-change' | 'ai-assist' | 'comment' | 'presence';
  roomId: string;
  userId: string;
  data: any;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export class CollaborationSystem {
  private rooms: Map<string, CollaborationRoom>;
  private activeSockets: Map<string, any>; // In a real implementation, this would be WebSocket connections
  private eventQueue: CollaborationEvent[];
  private logger: Logger;
  private cache: Cache;
  private llmManager: LLMManager;
  private conflictResolvers: Map<string, (op1: Operation, op2: Operation) => ConflictResolution>;

  constructor() {
    this.rooms = new Map();
    this.activeSockets = new Map();
    this.eventQueue = [];
    this.conflictResolvers = new Map();
    this.logger = new Logger('CollaborationSystem');
    this.cache = new Cache();
    this.llmManager = new LLMManager();
    
    this.initializeDefaultConflictResolvers();
  }

  /**
   * Initialize default conflict resolution strategies
   */
  private initializeDefaultConflictResolvers(): void {
    // Server wins resolver - always prefer server operations
    this.conflictResolvers.set('server-wins', (op1: Operation, op2: Operation): ConflictResolution => {
      return {
        strategy: 'server-wins',
        resolvedAt: new Date(),
        resolverId: 'system',
        originalOperations: [op1, op2],
        resolvedOperation: op1.priority > op2.priority ? op1 : op1.timestamp > op2.timestamp ? op1 : op2,
        metadata: { conflicted: true }
      };
    });

    // Client wins resolver - prefer client operations
    this.conflictResolvers.set('client-wins', (op1: Operation, op2: Operation): ConflictResolution => {
      return {
        strategy: 'client-wins',
        resolvedAt: new Date(),
        resolverId: 'system',
        originalOperations: [op1, op2],
        resolvedOperation: op1.priority > op2.priority ? op2 : op1.timestamp > op2.timestamp ? op2 : op1,
        metadata: { conflicted: true }
      };
    });

    // Merge resolver - attempt to intelligently merge conflicting operations
    this.conflictResolvers.set('merge', (op1: Operation, op2: Operation): ConflictResolution => {
      // For now, return the operation with the most recent timestamp
      // In a real implementation, this would have more sophisticated merging logic
      const resolvedOp = op1.timestamp > op2.timestamp ? op1 : op2;
      
      return {
        strategy: 'merge',
        resolvedAt: new Date(),
        resolverId: 'system',
        originalOperations: [op1, op2],
        resolvedOperation: resolvedOp,
        metadata: { 
          conflicted: true,
          resolution: resolvedOp.type === 'insert' ? 'merged' : 'later-operation-wins' 
        }
      };
    });
  }

  /**
   * Create a new collaboration room
   */
  createRoom(
    ownerId: string,
    name: string,
    content: string = '',
    options?: {
      description?: string;
      maxParticipants?: number;
      isPublic?: boolean;
      metadata?: Record<string, any>;
    }
  ): CollaborationRoom {
    const room: CollaborationRoom = {
      id: `room_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name,
      description: options?.description || '',
      ownerId,
      participants: new Map(),
      createdAt: new Date(),
      updatedAt: new Date(),
      maxParticipants: options?.maxParticipants || 10,
      isPublic: options?.isPublic ?? false,
      metadata: options?.metadata || {},
      content,
      operations: [],
      version: 0
    };

    this.rooms.set(room.id, room);
    this.logger.info(`Collaboration room created: ${room.name} (ID: ${room.id})`);
    
    // Join the owner to the room
    this.addParticipant(room.id, ownerId, 'owner');
    
    return room;
  }

  /**
   * Add a participant to a room
   */
  addParticipant(roomId: string, userId: string, role: 'owner' | 'editor' | 'viewer' = 'viewer'): Participant | null {
    const room = this.rooms.get(roomId);
    if (!room) {
      this.logger.error(`Room not found: ${roomId}`);
      return null;
    }

    if (room.participants.size >= room.maxParticipants) {
      this.logger.error(`Room ${roomId} is at capacity (${room.maxParticipants})`);
      return null;
    }

    // Check if user is already in the room
    const existingParticipant = Array.from(room.participants.values()).find(p => p.userId === userId);
    if (existingParticipant) {
      // Update existing participant's role if needed
      existingParticipant.role = role;
      existingParticipant.joinedAt = new Date();
      existingParticipant.lastActive = new Date();
      existingParticipant.isActive = true;
      return existingParticipant;
    }

    const participant: Participant = {
      id: `participant_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      name: `User_${userId.substring(0, 5)}`, // In real implementation, get from user service
      role,
      joinedAt: new Date(),
      lastActive: new Date(),
      isActive: true,
      color: this.generateUserColor(userId)
    };

    room.participants.set(participant.id, participant);
    room.updatedAt = new Date();

    // Log join event
    this.logEvent({
      id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'join',
      roomId,
      userId,
      data: { participant },
      timestamp: new Date()
    });

    this.logger.info(`User ${userId} joined room ${roomId} as ${role}`);
    return participant;
  }

  /**
   * Generate a color for a user based on their ID
   */
  private generateUserColor(userId: string): string {
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFBE0B', '#FB5607', 
      '#8338EC', '#3A86FF', '#38B000', '#9D4EDD', '#F15BB5'
    ];
    
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      hash = userId.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    return colors[Math.abs(hash) % colors.length];
  }

  /**
   * Apply an operation to a room's content
   */
  async applyOperation(roomId: string, operation: Omit<Operation, 'id' | 'timestamp' | 'roomId'>): Promise<Operation | null> {
    const room = this.rooms.get(roomId);
    if (!room) {
      this.logger.error(`Room not found: ${roomId}`);
      return null;
    }

    // Validate operation
    if (!this.validateOperation(room, operation)) {
      this.logger.error(`Invalid operation for room ${roomId}`);
      return null;
    }

    // Transform operation against all pending operations to handle concurrent edits
    const transformedOperation = this.transformOperation(operation, room.operations);
    
    // Create the final operation
    const finalOperation: Operation = {
      ...transformedOperation,
      id: `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      roomId,
      metadata: transformedOperation.metadata
    };

    // Update room content based on operation type
    switch (finalOperation.type) {
      case 'insert':
        if (finalOperation.content) {
          room.content = 
            room.content.substring(0, finalOperation.position) + 
            finalOperation.content + 
            room.content.substring(finalOperation.position);
        }
        break;

      case 'delete':
        if (finalOperation.length !== undefined) {
          room.content = 
            room.content.substring(0, finalOperation.position) + 
            room.content.substring(finalOperation.position + finalOperation.length);
        }
        break;

      case 'update':
        if (finalOperation.content && finalOperation.length !== undefined) {
          room.content = 
            room.content.substring(0, finalOperation.position) + 
            finalOperation.content + 
            room.content.substring(finalOperation.position + finalOperation.length);
        }
        break;
    }

    // Add operation to room history
    room.operations.push(finalOperation);
    room.version++;
    room.updatedAt = new Date();

    // Log operation event
    this.logEvent({
      id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'operation',
      roomId,
      userId: operation.userId,
      data: { operation: finalOperation },
      timestamp: new Date()
    });

    this.logger.info(`Operation applied to room ${roomId}: ${finalOperation.type}`);
    return finalOperation;
  }

  /**
   * Validate an operation before applying it
   */
  private validateOperation(room: CollaborationRoom, operation: Omit<Operation, 'id' | 'timestamp' | 'roomId'>): boolean {
    // Check if user has permission to perform operation
    const participant = Array.from(room.participants.values()).find(p => p.userId === operation.userId);
    if (!participant) {
      return false;
    }

    // Viewers cannot perform edit operations
    if ((operation.type === 'insert' || operation.type === 'delete') && participant.role === 'viewer') {
      return false;
    }

    // Check position bounds
    if (operation.position < 0 || operation.position > room.content.length) {
      return false;
    }

    // For delete operations, check length
    if (operation.type === 'delete' && operation.length !== undefined) {
      if (operation.position + operation.length > room.content.length) {
        return false;
      }
    }

    return true;
  }

  /**
   * Transform an operation against a sequence of operations to handle concurrency
   */
  private transformOperation(
    operation: Omit<Operation, 'id' | 'timestamp' | 'roomId'>,
    operations: Operation[]
  ): Omit<Operation, 'id' | 'timestamp' | 'roomId'> {
    let transformedOp = { ...operation };

    for (const op of operations) {
      if (op.timestamp >= transformedOp.timestamp) {
        // Only transform against operations that happened before this one conceptually
        // (in practice, we'd use proper causality tracking)
        continue;
      }

      // Apply operational transformation
      transformedOp = this.transformAgainst(transformedOp, op);
    }

    return transformedOp;
  }

  /**
   * Transform an operation against a single other operation
   */
  private transformAgainst(
    op1: Omit<Operation, 'id' | 'timestamp' | 'roomId'>,
    op2: Operation
  ): Omit<Operation, 'id' | 'timestamp' | 'roomId'> {
    // This is a simplified operational transformation implementation
    // A full implementation would handle all combinations of operation types
    
    if (op1.type === 'insert' && op2.type === 'insert') {
      if (op2.position < op1.position) {
        // op2 insert shifts our position
        return { ...op1, position: op1.position + op2.content?.length! };
      }
    } else if (op1.type === 'insert' && op2.type === 'delete') {
      // If delete happens before our insert position, shift our position
      if (op2.position < op1.position) {
        return { 
          ...op1, 
          position: Math.max(0, op1.position - op2.length!) 
        };
      }
    } else if (op1.type === 'delete' && op2.type === 'insert') {
      // If insert happens before our delete, shift our position
      if (op2.position < op1.position) {
        return { 
          ...op1, 
          position: op1.position + op2.content?.length! 
        };
      }
    } else if (op1.type === 'delete' && op2.type === 'delete') {
      // Two deletes - adjust position based on overlap
      if (op2.position < op1.position) {
        return { 
          ...op1, 
          position: Math.max(0, op1.position - op2.length!),
          length: Math.max(0, op1.length! - Math.max(0, op2.position + op2.length! - op1.position))
        };
      }
    }

    return op1;
  }

  /**
   * Resolve a conflict between operations
   */
  resolveConflict(
    roomId: string,
    op1: Operation,
    op2: Operation,
    strategyName: 'server-wins' | 'client-wins' | 'merge' = 'merge'
  ): ConflictResolution | null {
    const resolver = this.conflictResolvers.get(strategyName);
    if (!resolver) {
      this.logger.error(`Conflict resolver not found: ${strategyName}`);
      return null;
    }

    const resolution = resolver(op1, op2);
    
    // Apply the resolved operation to the room
    this.applyOperation(roomId, resolution.resolvedOperation);
    
    this.logger.info(`Conflict resolved in room ${roomId} using ${strategyName} strategy`);
    return resolution;
  }

  /**
   * Get room by ID
   */
  getRoom(roomId: string): CollaborationRoom | undefined {
    return this.rooms.get(roomId);
  }

  /**
   * Get room content with participant information
   */
  getRoomState(roomId: string): { 
    content: string; 
    participants: Participant[]; 
    operations: Operation[]; 
    version: number 
  } | null {
    const room = this.rooms.get(roomId);
    if (!room) {
      return null;
    }

    return {
      content: room.content,
      participants: Array.from(room.participants.values()),
      operations: [...room.operations], // Return a copy
      version: room.version
    };
  }

  /**
   * Update participant cursor position
   */
  updateCursorPosition(roomId: string, userId: string, position: number): boolean {
    const room = this.rooms.get(roomId);
    if (!room) {
      return false;
    }

    const participant = Array.from(room.participants.values()).find(p => p.userId === userId);
    if (!participant) {
      return false;
    }

    participant.cursorPosition = position;
    participant.lastActive = new Date();
    room.updatedAt = new Date();

    // Log cursor change event
    this.logEvent({
      id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'selection-change',
      roomId,
      userId,
      data: { position },
      timestamp: new Date()
    });

    return true;
  }

  /**
   * Update participant selection range
   */
  updateSelectionRange(roomId: string, userId: string, range: [number, number]): boolean {
    const room = this.rooms.get(roomId);
    if (!room) {
      return false;
    }

    const participant = Array.from(room.participants.values()).find(p => p.userId === userId);
    if (!participant) {
      return false;
    }

    participant.selectionRange = range;
    participant.lastActive = new Date();
    room.updatedAt = new Date();

    // Log selection change event
    this.logEvent({
      id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'selection-change',
      roomId,
      userId,
      data: { range },
      timestamp: new Date()
    });

    return true;
  }

  /**
   * Add a comment to the collaboration
   */
  addComment(roomId: string, userId: string, content: string, position?: number): boolean {
    const room = this.rooms.get(roomId);
    if (!room) {
      return false;
    }

    const participant = Array.from(room.participants.values()).find(p => p.userId === userId);
    if (!participant) {
      return false;
    }

    // Log comment event
    this.logEvent({
      id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'comment',
      roomId,
      userId,
      data: { content, position },
      timestamp: new Date()
    });

    // In a full implementation, comments would be stored separately
    // For now, we'll just log the event
    this.logger.info(`Comment added to room ${roomId} by user ${userId}`);
    return true;
  }

  /**
   * Generate AI-assisted content in the collaboration
   */
  async generateAIAssistedContent(
    roomId: string,
    userId: string,
    prompt: string,
    position?: number
  ): Promise<string | null> {
    const room = this.rooms.get(roomId);
    if (!room) {
      return null;
    }

    const participant = Array.from(room.participants.values()).find(p => p.userId === userId);
    if (!participant || participant.role === 'viewer') {
      return null; // Viewers can't generate content
    }

    try {
      // Use LLM to generate content based on the prompt and current context
      const context = this.getCollaborationContext(roomId);
      const fullPrompt = `Context:\n${context}\n\nUser request:\n${prompt}\n\nGenerated content:`;
      
      const generatedContent = await this.llmManager.generateResponse({
        prompt: fullPrompt,
        model: 'openai/gpt-3.5-turbo',
        context: { room: roomId, user: userId }
      });

      // Log AI assistance event
      this.logEvent({
        id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: 'ai-assist',
        roomId,
        userId,
        data: { 
          prompt,
          generatedContent,
          position,
          agentUsed: 'openai/gpt-3.5-turbo'
        },
        timestamp: new Date()
      });

      // Apply the generated content as an insert operation
      if (position !== undefined) {
        await this.applyOperation(roomId, {
          type: 'insert',
          userId,
          position,
          content: generatedContent,
          clientId: 'ai-assistant',
          metadata: {
            agentUsed: 'openai/gpt-3.5-turbo',
            wasAIAssisted: true,
            originalPrompt: prompt
          }
        });
      } else {
        // Insert at the end
        await this.applyOperation(roomId, {
          type: 'insert',
          userId,
          position: room.content.length,
          content: generatedContent,
          clientId: 'ai-assistant',
          metadata: {
            agentUsed: 'openai/gpt-3.5-turbo',
            wasAIAssisted: true,
            originalPrompt: prompt
          }
        });
      }

      this.logger.info(`AI-assisted content generated for room ${roomId}`);
      return generatedContent;
    } catch (error) {
      this.logger.error(`Error generating AI-assisted content for room ${roomId}:`, error);
      return null;
    }
  }

  /**
   * Get the collaboration context for AI generation
   */
  private getCollaborationContext(roomId: string): string {
    const room = this.rooms.get(roomId);
    if (!room) {
      return '';
    }

    return `Current document content: ${room.content.substring(0, 1000)}...`;
  }

  /**
   * Remove a participant from a room
   */
  removeParticipant(roomId: string, userId: string): boolean {
    const room = this.rooms.get(roomId);
    if (!room) {
      return false;
    }

    // Find and remove the participant
    const participantId = Array.from(room.participants.keys()).find(id => {
      const p = room.participants.get(id)!;
      return p.userId === userId;
    });

    if (!participantId) {
      return false;
    }

    room.participants.delete(participantId);
    room.updatedAt = new Date();

    // Log leave event
    this.logEvent({
      id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'leave',
      roomId,
      userId,
      data: { participantId },
      timestamp: new Date()
    });

    this.logger.info(`User ${userId} removed from room ${roomId}`);
    return true;
  }

  /**
   * Update room metadata
   */
  updateRoomMetadata(roomId: string, metadata: Record<string, any>): CollaborationRoom | undefined {
    const room = this.rooms.get(roomId);
    if (!room) {
      return undefined;
    }

    room.metadata = { ...room.metadata, ...metadata };
    room.updatedAt = new Date();

    return room;
  }

  /**
   * Log a collaboration event
   */
  private logEvent(event: Omit<CollaborationEvent, 'id' | 'timestamp'>): void {
    const fullEvent: CollaborationEvent = {
      ...event,
      id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date()
    };

    this.eventQueue.push(fullEvent);

    // Keep only the last 1000 events to prevent memory issues
    if (this.eventQueue.length > 1000) {
      this.eventQueue = this.eventQueue.slice(-1000);
    }

    // Cache important events
    if (event.type === 'content-update' || event.type === 'operation') {
      this.cache.set(`collab:event:${fullEvent.id}`, fullEvent, 60 * 60); // 1 hour
    }

    this.logger.info(`Collaboration event: ${event.type}`, { roomId: event.roomId, userId: event.userId });
  }

  /**
   * Get collaboration events for a room
   */
  getRoomEvents(roomId: string, limit: number = 50): CollaborationEvent[] {
    return this.eventQueue
      .filter(event => event.roomId === roomId)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * Get all rooms a user is participating in
   */
  getUserRooms(userId: string): CollaborationRoom[] {
    const rooms: CollaborationRoom[] = [];
    
    for (const [_, room] of this.rooms) {
      const hasUser = Array.from(room.participants.values()).some(p => p.userId === userId);
      if (hasUser) {
        rooms.push(room);
      }
    }
    
    return rooms;
  }

  /**
   * Update participant presence
   */
  updatePresence(roomId: string, userId: string, isActive: boolean): boolean {
    const room = this.rooms.get(roomId);
    if (!room) {
      return false;
    }

    const participant = Array.from(room.participants.values()).find(p => p.userId === userId);
    if (!participant) {
      return false;
    }

    participant.isActive = isActive;
    participant.lastActive = new Date();
    room.updatedAt = new Date();

    // Log presence event
    this.logEvent({
      id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'presence',
      roomId,
      userId,
      data: { isActive },
      timestamp: new Date()
    });

    return true;
  }

  /**
   * Search for content across all rooms a user has access to
   */
  searchContent(userId: string, query: string): Array<{ 
    roomId: string; 
    roomName: string;
    matches: Array<{ content: string; position: number }> 
  }> {
    const results: Array<{ 
      roomId: string; 
      roomName: string;
      matches: Array<{ content: string; position: number }> 
    }> = [];

    for (const [_, room] of this.rooms) {
      // Check if user has access to this room
      const participant = Array.from(room.participants.values()).find(p => p.userId === userId);
      if (!participant) continue;

      // Search for the query in the content
      const matches: Array<{ content: string; position: number }> = [];
      const content = room.content.toLowerCase();
      const searchQuery = query.toLowerCase();
      let position = 0;

      while ((position = content.indexOf(searchQuery, position)) !== -1) {
        // Extract context around the match
        const start = Math.max(0, position - 50);
        const end = Math.min(content.length, position + query.length + 50);
        const context = room.content.substring(start, end);

        matches.push({
          content: `...${context}...`,
          position
        });

        position += searchQuery.length;
      }

      if (matches.length > 0) {
        results.push({
          roomId: room.id,
          roomName: room.name,
          matches
        });
      }
    }

    return results;
  }

  /**
   * Get collaboration statistics
   */
  getStats(): {
    totalRooms: number;
    totalParticipants: number;
    totalOperations: number;
    activeRooms: number;
    publicRooms: number;
  } {
    let totalParticipants = 0;
    let activeRooms = 0;
    let publicRooms = 0;

    for (const [_, room] of this.rooms) {
      totalParticipants += room.participants.size;
      if (room.participants.size > 0) activeRooms++;
      if (room.isPublic) publicRooms++;
    }

    return {
      totalRooms: this.rooms.size,
      totalParticipants,
      totalOperations: this.eventQueue.filter(e => e.type === 'operation').length,
      activeRooms,
      publicRooms
    };
  }

  /**
   * Export room data for backup/transfer
   */
  exportRoom(roomId: string): CollaborationRoom | undefined {
    const room = this.rooms.get(roomId);
    if (!room) return undefined;

    // Return a copy without internal references
    return {
      ...room,
      participants: new Map(room.participants),
      operations: [...room.operations]
    };
  }

  /**
   * Register a custom conflict resolver
   */
  registerConflictResolver(name: string, resolver: (op1: Operation, op2: Operation) => ConflictResolution): void {
    this.conflictResolvers.set(name, resolver);
    this.logger.info(`Custom conflict resolver registered: ${name}`);
  }
}

// Collaboration utilities
export class CollaborationUtils {
  /**
   * Format operations for efficient transmission
   */
  static compressOperations(operations: Operation[]): any[] {
    // In a real implementation, this would compress operations for network transmission
    return operations.map(op => ({
      t: op.type,      // type
      u: op.userId,    // user ID
      p: op.position,  // position
      c: op.content,   // content
      l: op.length,    // length
      ts: op.timestamp.getTime() // timestamp as number
    }));
  }

  /**
   * Decompress operations
   */
  static decompressOperations(compressedOps: any[]): Operation[] {
    return compressedOps.map(op => ({
      id: `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, // Generate new ID
      type: op.t,
      userId: op.u,
      position: op.p || 0,
      content: op.c,
      length: op.l,
      timestamp: new Date(op.ts),
      roomId: 'unknown', // Will be set when applied to a room
      clientId: 'unknown' // Will be set when applied to a room
    }));
  }

  /**
   * Detect potential conflicts in operations
   */
  static detectConflicts(operations: Operation[]): Array<{ op1: Operation; op2: Operation; type: string }> {
    const conflicts: Array<{ op1: Operation; op2: Operation; type: string }> = [];

    for (let i = 0; i < operations.length; i++) {
      for (let j = i + 1; j < operations.length; j++) {
        const op1 = operations[i];
        const op2 = operations[j];

        // Check for position conflict
        if (op1.roomId === op2.roomId) {
          if (op1.type === 'delete' && op2.type === 'delete') {
            // Check if they delete overlapping ranges
            const deleteEnd1 = op1.position + (op1.length || 0);
            const deleteEnd2 = op2.position + (op2.length || 0);
            
            if ((op1.position < deleteEnd2 && deleteEnd1 > op2.position)) {
              conflicts.push({ op1, op2, type: 'delete-delete-overlap' });
            }
          } else if (op1.position === op2.position) {
            // Two operations at the same position
            conflicts.push({ op1, op2, type: 'position-conflict' });
          }
        }
      }
    }

    return conflicts;
  }
}