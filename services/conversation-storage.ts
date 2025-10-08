import type { Conversation, ConversationData } from '@/types/app'

export interface ConversationRecord {
  id: string
  title: string
  messages: Array<{ role: string; content: string }>
  createdAt: number | Date
  updatedAt: number | Date
  provider?: string
  model?: string
  userId?: string
  type?: string
  data?: any
  timestamp?: number
  metadata?: Record<string, unknown>
}

export interface ImportConversationData {
  conversations: ConversationRecord[]
  userId: string
  conflictResolution?: 'skip' | 'replace' | 'merge'
}

export interface ImportResult {
  imported: number
  failed: number
  skipped: number
  errors: string[]
}

export interface ConversationStats {
  totalConversations: number
  totalMessages: number
  providerBreakdown: Record<string, number>
}

export interface ExportData {
  conversations: ConversationRecord[]
  exportedAt: Date
  version: string
}

export class ConversationStorage {
  private dbName = 'conversation-db'
  private dbVersion = 1
  private storeName = 'conversations'
  private db: IDBDatabase | null = null

  private async handleRequest<T>(request: IDBRequest, getValue: () => T): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const onSuccess = () => {
        cleanup()
        resolve(getValue())
      }

      const onError = () => {
        cleanup()
        const error = (request as any).error
        if (error instanceof Error) {
          reject(error)
        } else if (error) {
          reject(new Error(String(error)))
        } else {
          reject(new Error('IndexedDB operation failed'))
        }
      }

      const cleanup = () => {
        if (typeof request.removeEventListener === 'function') {
          request.removeEventListener('success', onSuccess as EventListener)
          request.removeEventListener('error', onError as EventListener)
        }
      }

      if (typeof request.addEventListener === 'function') {
        request.addEventListener('success', onSuccess as EventListener)
        request.addEventListener('error', onError as EventListener)
      }

      request.onsuccess = onSuccess
      request.onerror = onError

      const readyState = (request as any).readyState
      if (readyState === 'done') {
        if ((request as any).error) {
          onError()
        } else {
          onSuccess()
        }
      } else if ((request as any).error) {
        onError()
      }
    })
  }

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion)

      request.onerror = () => {
        reject(request.error)
      }

      request.onsuccess = () => {
        this.db = request.result
        resolve()
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        const storeNames: any = db.objectStoreNames
        const hasContains = typeof storeNames?.contains === 'function'
        const hasStore = hasContains
          ? storeNames.contains(this.storeName)
          : Array.from(storeNames || []).includes(this.storeName)

        if (!hasStore || !hasContains) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'id' })
          store.createIndex('userId', 'userId')
          store.createIndex('provider', 'provider')
          store.createIndex('createdAt', 'createdAt')
          store.createIndex('updatedAt', 'updatedAt')
        }
      }
    })
  }

  private async getDB(): Promise<IDBDatabase> {
    if (!this.db) {
      await this.init()
    }
    return this.db!
  }

  private validateConversation(conversation: any): void {
    if (!conversation.id || !conversation.title || !Array.isArray(conversation.messages)) {
      throw new Error('Invalid conversation data')
    }
  }

  async saveConversation(conversation: ConversationRecord): Promise<string> {
    this.validateConversation(conversation)

    const db = await this.getDB()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readwrite')
      const store = transaction.objectStore(this.storeName)

      const request = store.put(conversation)

      this.handleRequest(request, () => (request as any).result ?? conversation.id)
        .then(resolve)
        .catch(reject)
    })
  }

  async getConversation(id: string): Promise<ConversationRecord | null> {
    const db = await this.getDB()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readonly')
      const store = transaction.objectStore(this.storeName)
      const request = store.get(id)

      this.handleRequest(request, () => request.result || null)
        .then(resolve)
        .catch(reject)
    })
  }

  async getAllConversations(): Promise<ConversationRecord[]> {
    const db = await this.getDB()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readonly')
      const store = transaction.objectStore(this.storeName)
      const request = store.getAll()

      this.handleRequest(request, () => {
        const conversations = request.result || []
        conversations.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        return conversations
      })
        .then(resolve)
        .catch(reject)
    })
  }

  async deleteConversation(id: string): Promise<void> {
    const db = await this.getDB()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readwrite')
      const store = transaction.objectStore(this.storeName)
      const request = store.delete(id)

      this.handleRequest(request, () => undefined)
        .then(() => resolve())
        .catch(reject)
    })
  }

  async searchConversations(query: string): Promise<ConversationRecord[]> {
    const conversations = await this.getAllConversations()
    const lowerQuery = query.toLowerCase()

    return conversations.filter(conv => {
      if (conv.title.toLowerCase().includes(lowerQuery)) {
        return true
      }

      return conv.messages.some(msg =>
        msg.content && msg.content.toLowerCase().includes(lowerQuery)
      )
    })
  }

  async getConversationsByProvider(provider: string): Promise<ConversationRecord[]> {
    const conversations = await this.getAllConversations()
    return conversations.filter(conv => conv.provider === provider)
  }

  async getConversationStats(): Promise<ConversationStats> {
    const conversations = await this.getAllConversations()

    const totalMessages = conversations.reduce((sum, conv) => sum + conv.messages.length, 0)

    const providerBreakdown: Record<string, number> = {}
    conversations.forEach(conv => {
      if (conv.provider) {
        providerBreakdown[conv.provider] = (providerBreakdown[conv.provider] || 0) + 1
      }
    })

    return {
      totalConversations: conversations.length,
      totalMessages,
      providerBreakdown
    }
  }

  async exportConversations(): Promise<ExportData> {
    const conversations = await this.getAllConversations()

    return {
      conversations,
      exportedAt: new Date(),
      version: '1.0'
    }
  }

  async importConversations(data: ImportConversationData): Promise<ImportResult> {
    const result: ImportResult = {
      imported: 0,
      failed: 0,
      skipped: 0,
      errors: []
    }

    for (const conversation of data.conversations) {
      try {
        // Check for existing conversation
        const existing = await this.getConversation(conversation.id)

        if (existing && data.conflictResolution === 'skip') {
          result.skipped++
          result.errors.push('Conversation already exists')
          continue
        }

        await this.saveConversation({
          ...conversation,
          userId: data.userId,
          createdAt: conversation.createdAt || new Date().getTime(),
          updatedAt: new Date().getTime()
        })

        result.imported++
      } catch (error) {
        result.failed++
        result.errors.push(error instanceof Error ? error.message : 'Unknown error')
      }
    }

    return result
  }

  async clearAllConversations(): Promise<void> {
    const db = await this.getDB()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readwrite')
      const store = transaction.objectStore(this.storeName)
      const request = store.clear()

      this.handleRequest(request, () => undefined)
        .then(() => resolve())
        .catch(reject)
    })
  }
}
const memoryStore = new Map<string, ConversationRecord>()

function isBrowserStorageAvailable(): boolean {
  return typeof indexedDB !== 'undefined'
}

function deepClone<T>(value: T): T {
  try {
    return typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value ?? null))
  } catch {
    return value
  }
}

function cloneRecord(record: ConversationRecord): ConversationRecord {
  return {
    ...record,
    createdAt: typeof record.createdAt === 'number' ? record.createdAt : record.createdAt.getTime(),
    updatedAt: typeof record.updatedAt === 'number' ? record.updatedAt : record.updatedAt.getTime(),
    messages: Array.isArray(record.messages)
      ? record.messages.map(message => ({ role: message.role, content: message.content }))
      : [],
    data: deepClone(record.data),
    metadata: record.metadata ? { ...record.metadata } : undefined
  }
}

async function persistRecord(record: ConversationRecord): Promise<string> {
  if (!isBrowserStorageAvailable()) {
    memoryStore.set(record.id, cloneRecord(record))
    return record.id
  }
  const storage = new ConversationStorage()
  return storage.saveConversation(record)
}

async function fetchRecord(id: string): Promise<ConversationRecord | null> {
  if (!isBrowserStorageAvailable()) {
    const stored = memoryStore.get(id)
    return stored ? cloneRecord(stored) : null
  }
  const storage = new ConversationStorage()
  return storage.getConversation(id)
}

async function fetchAllRecords(): Promise<ConversationRecord[]> {
  if (!isBrowserStorageAvailable()) {
    return Array.from(memoryStore.values())
      .map(cloneRecord)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
  }
  const storage = new ConversationStorage()
  return storage.getAllConversations()
}

export async function getAllConversations(): Promise<ConversationRecord[]> {
  return fetchAllRecords()
}

export async function getConversationsByType<T extends Conversation['type']>(type: T): Promise<Array<Extract<Conversation, { type: T }>>> {
  const records = await fetchAllRecords()
  return records
    .filter(record => record.type === type)
    .map(record => recordToConversation<T>(record))
    .filter((conversation): conversation is Extract<Conversation, { type: T }> => Boolean(conversation))
    .sort((a, b) => b.timestamp - a.timestamp)
}

export async function saveConversation<T extends Conversation['type']>(type: T, title: string, data: ConversationData<T>): Promise<string> {
  const timestamp = Date.now()
  const now = new Date(timestamp)
  const record: ConversationRecord = {
    id: generateConversationId(type),
    title: title?.trim() || 'Untitled Conversation',
    messages: normalizeMessages(data),
    createdAt: now,
    updatedAt: now,
    type,
    timestamp,
    data: deepClone(data)
  }

  await persistRecord(record)
  return record.id
}

async function removeRecord(id: string): Promise<void> {
  if (!isBrowserStorageAvailable()) {
    memoryStore.delete(id)
    return
  }
  const storage = new ConversationStorage()
  await storage.deleteConversation(id)
}

function generateConversationId(type: Conversation['type']): string {
  const random = Math.random().toString(36).slice(2, 10)
  return `${type}-${Date.now()}-${random}`
}

function normalizeMessages(data: unknown): Array<{ role: string; content: string }> {
  const draft: unknown = (data as any)?.messages
  if (!Array.isArray(draft)) {
    return []
  }

  return draft
    .map(entry => {
      const role = typeof entry?.role === 'string' ? entry.role : undefined
      const content = typeof entry?.content === 'string' ? entry.content : undefined
      if (!role || !content) {
        return null
      }
      return { role, content }
    })
    .filter((entry): entry is { role: string; content: string } => Boolean(entry))
}

function recordToConversation<T extends Conversation['type']>(record: ConversationRecord): Extract<Conversation, { type: T }> | null {
  if (!record.type) {
    return null
  }

  const createdAtMs = typeof record.createdAt === 'number' ? record.createdAt : record.createdAt.getTime()
  const updatedAtMs = typeof record.updatedAt === 'number' ? record.updatedAt : record.updatedAt.getTime()
  const timestamp = typeof record.timestamp === 'number' ? record.timestamp : updatedAtMs ?? createdAtMs
  return {
    id: record.id,
    type: record.type as T,
    title: record.title,
    timestamp,
    createdAt: createdAtMs,
    updatedAt: updatedAtMs,
    data: (record.data ?? { messages: record.messages ?? [] }) as ConversationData<T>
  }
}



export async function updateConversation<T extends Conversation['type']>(
  id: string,
  updates: Partial<Omit<Extract<Conversation, { type: T }>, 'id'>>
): Promise<void> {
  const existing = await fetchRecord(id)
  if (!existing) {
    throw new Error(`Conversation with id '${id}' not found`)
  }

  if (updates.title && typeof updates.title === 'string') {
    existing.title = updates.title.trim() || existing.title
  }

  if (updates.type && typeof updates.type === 'string') {
    existing.type = updates.type as Conversation['type']
  }

  if (typeof updates.timestamp === 'number' && Number.isFinite(updates.timestamp)) {
    existing.timestamp = updates.timestamp
  }

  if (updates.data !== undefined) {
    existing.data = deepClone(updates.data)
    const maybeMessages = normalizeMessages(updates.data)
    if (maybeMessages.length > 0) {
      existing.messages = maybeMessages
    }
  }

  existing.updatedAt = new Date()

  await persistRecord(existing)
}

export async function deleteConversation(id: string): Promise<void> {
  await removeRecord(id)
}

