export interface ConversationRecord {
  id: string
  title: string
  messages: Array<{ role: string; content: string }>
  createdAt: Date
  updatedAt: Date
  provider?: string
  model?: string
  userId?: string
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
          createdAt: conversation.createdAt || new Date(),
          updatedAt: new Date()
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

// Legacy functional exports for backward compatibility
export async function saveConversation(type: string, title: string, data: any): Promise<string> {
  const storage = new ConversationStorage()
  const conversation: ConversationRecord = {
    id: `${type}_${Date.now()}`,
    title,
    messages: data.messages || [],
    createdAt: new Date(),
    updatedAt: new Date(),
    provider: data.provider,
    model: data.model
  }
  return storage.saveConversation(conversation)
}

export async function getAllConversations(): Promise<ConversationRecord[]> {
  const storage = new ConversationStorage()
  return storage.getAllConversations()
}
