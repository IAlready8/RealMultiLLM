import { openDB, DBSchema, IDBPDatabase } from 'idb';
import type { Conversation, ConversationData } from '@/types/app';

// Define the schema for our IndexedDB database using the centralized types
interface ConversationDBSchema extends DBSchema {
  conversations: {
    key: string;
    value: Conversation;
    indexes: { 'by-type': string; 'by-timestamp': number };
  };
}

let dbPromise: Promise<IDBPDatabase<ConversationDBSchema>> | null = null;

function getDB(): Promise<IDBPDatabase<ConversationDBSchema>> {
  if (!dbPromise) {
    dbPromise = openDB<ConversationDBSchema>('multi-llm-conversations', 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('conversations')) {
          const conversationStore = db.createObjectStore('conversations', { keyPath: 'id' });
          conversationStore.createIndex('by-type', 'type');
          conversationStore.createIndex('by-timestamp', 'timestamp');
        }
      },
    });
  }
  return dbPromise;
}

export async function saveConversation<T extends Conversation['type']>(
  type: T,
  title: string,
  data: ConversationData<T>
): Promise<string> {
  const db = await getDB();
  const id = `${type}_${Date.now()}`;
  
  // The object must conform to one of the types in the Conversation union
  const conversationToSave: Conversation = {
    id,
    type,
    title,
    timestamp: Date.now(),
    data,
  } as Conversation; // Cast is necessary because TypeScript can't infer the union type from the generic parameters alone

  await db.put('conversations', conversationToSave);
  
  return id;
}

export async function getConversation(id: string): Promise<Conversation | undefined> {
  const db = await getDB();
  return db.get('conversations', id);
}

export async function getConversationsByType<T extends Conversation['type']>(type: T): Promise<Extract<Conversation, {type: T}>[]> {
  const db = await getDB();
  const results = await db.getAllFromIndex('conversations', 'by-type', type);
  return results as Extract<Conversation, {type: T}>[];
}

export async function getAllConversations(): Promise<Conversation[]> {
  const db = await getDB();
  return db.getAll('conversations');
}

export async function deleteConversation(id: string): Promise<void> {
  const db = await getDB();
  return db.delete('conversations', id);
}

export async function updateConversation(
  id: string, 
  updates: Partial<Omit<Conversation, 'id'>>
): Promise<void> {
  const db = await getDB();
  const conversation = await db.get('conversations', id);
  
  if (!conversation) {
    throw new Error(`Conversation with ID ${id} not found`);
  }
  
  const updatedConversation: Conversation = {
    ...conversation,
    ...updates,
    timestamp: updates.timestamp || Date.now(),
  };

  await db.put('conversations', updatedConversation);
}