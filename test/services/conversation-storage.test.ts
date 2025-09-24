import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { ConversationStorage } from '@/services/conversation-storage'

// Mock IndexedDB
const createMockIDB = () => {
  const mockRequest = {
    onsuccess: null as any,
    onerror: null as any,
    result: null as any,
    error: null,
    readyState: 'done',
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }

  const mockObjectStore = {
    add: vi.fn(() => ({ ...mockRequest })),
    get: vi.fn(() => ({ ...mockRequest })),
    getAll: vi.fn(() => ({ ...mockRequest })),
    put: vi.fn(() => ({ ...mockRequest })),
    delete: vi.fn(() => ({ ...mockRequest })),
    clear: vi.fn(() => ({ ...mockRequest })),
    createIndex: vi.fn(),
    index: vi.fn(() => ({
      get: vi.fn(() => ({ ...mockRequest })),
      getAll: vi.fn(() => ({ ...mockRequest })),
    })),
    count: vi.fn(() => ({ ...mockRequest })),
  }

  const mockTransaction = {
    objectStore: vi.fn(() => mockObjectStore),
    abort: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
    oncomplete: null,
    onerror: null,
    onabort: null,
    error: null,
    mode: 'readwrite',
    durability: 'default',
    db: null,
    objectStoreNames: ['conversations'],
    commit: vi.fn(),
  }

  const mockDatabase = {
    transaction: vi.fn(() => mockTransaction),
    createObjectStore: vi.fn(() => mockObjectStore),
    deleteObjectStore: vi.fn(),
    close: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
    name: 'conversation-db',
    version: 1,
    objectStoreNames: ['conversations'],
    onabort: null,
    onclose: null,
    onerror: null,
    onversionchange: null,
  }

  return { mockRequest, mockObjectStore, mockTransaction, mockDatabase }
}

describe('ConversationStorage', () => {
  let storage: ConversationStorage
  let mockIDB: ReturnType<typeof createMockIDB>

  beforeEach(() => {
    mockIDB = createMockIDB()

    global.indexedDB = {
      open: vi.fn(() => {
        const request = { ...mockIDB.mockRequest }
        setTimeout(() => {
          request.result = mockIDB.mockDatabase
          if (request.onsuccess) request.onsuccess({ target: request } as any)
        }, 0)
        return request
      }),
      deleteDatabase: vi.fn(() => mockIDB.mockRequest),
      databases: vi.fn(() => Promise.resolve([])),
      cmp: vi.fn(),
    }

    global.IDBKeyRange = {
      bound: vi.fn(),
      only: vi.fn(),
      lowerBound: vi.fn(),
      upperBound: vi.fn(),
    } as any

    storage = new ConversationStorage()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('saveConversation', () => {
    it('should save a new conversation successfully', async () => {
      const conversation = {
        id: 'conv-1',
        title: 'Test Conversation',
        messages: [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi there!' }
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
        provider: 'openai',
        model: 'gpt-3.5-turbo'
      }

      mockIDB.mockRequest.result = 'conv-1'

      const result = await storage.saveConversation(conversation)

      expect(result).toBe('conv-1')
      expect(mockIDB.mockObjectStore.put).toHaveBeenCalledWith(conversation)
    })

    it('should handle save errors gracefully', async () => {
      const conversation = {
        id: 'conv-1',
        title: 'Test Conversation',
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date()
      }

      mockIDB.mockRequest.error = new Error('Save failed')

      await expect(storage.saveConversation(conversation)).rejects.toThrow('Save failed')
    })

    it('should validate conversation data before saving', async () => {
      const invalidConversation = {
        id: '',
        title: '',
        messages: null
      }

      await expect(storage.saveConversation(invalidConversation as any))
        .rejects.toThrow('Invalid conversation data')
    })
  })

  describe('getConversation', () => {
    it('should retrieve a conversation by ID', async () => {
      const mockConversation = {
        id: 'conv-1',
        title: 'Test Conversation',
        messages: [{ role: 'user', content: 'Hello' }],
        createdAt: new Date(),
        updatedAt: new Date()
      }

      mockIDB.mockRequest.result = mockConversation

      const result = await storage.getConversation('conv-1')

      expect(result).toEqual(mockConversation)
      expect(mockIDB.mockObjectStore.get).toHaveBeenCalledWith('conv-1')
    })

    it('should return null for non-existent conversation', async () => {
      mockIDB.mockRequest.result = undefined

      const result = await storage.getConversation('non-existent')

      expect(result).toBeNull()
    })

    it('should handle retrieval errors', async () => {
      mockIDB.mockRequest.error = new Error('Retrieval failed')

      await expect(storage.getConversation('conv-1')).rejects.toThrow('Retrieval failed')
    })
  })

  describe('getAllConversations', () => {
    it('should retrieve all conversations', async () => {
      const mockConversations = [
        {
          id: 'conv-1',
          title: 'Conversation 1',
          messages: [],
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01')
        },
        {
          id: 'conv-2',
          title: 'Conversation 2',
          messages: [],
          createdAt: new Date('2024-01-02'),
          updatedAt: new Date('2024-01-02')
        }
      ]

      mockIDB.mockRequest.result = mockConversations

      const result = await storage.getAllConversations()

      expect(result).toEqual(mockConversations)
      expect(mockIDB.mockObjectStore.getAll).toHaveBeenCalled()
    })

    it('should sort conversations by updatedAt descending', async () => {
      const mockConversations = [
        {
          id: 'conv-1',
          title: 'Older Conversation',
          updatedAt: new Date('2024-01-01')
        },
        {
          id: 'conv-2',
          title: 'Newer Conversation',
          updatedAt: new Date('2024-01-02')
        }
      ]

      mockIDB.mockRequest.result = mockConversations

      const result = await storage.getAllConversations()

      expect(result[0].title).toBe('Newer Conversation')
      expect(result[1].title).toBe('Older Conversation')
    })
  })

  describe('deleteConversation', () => {
    it('should delete a conversation by ID', async () => {
      mockIDB.mockRequest.result = undefined

      await storage.deleteConversation('conv-1')

      expect(mockIDB.mockObjectStore.delete).toHaveBeenCalledWith('conv-1')
    })

    it('should handle deletion errors', async () => {
      mockIDB.mockRequest.error = new Error('Deletion failed')

      await expect(storage.deleteConversation('conv-1')).rejects.toThrow('Deletion failed')
    })
  })

  describe('searchConversations', () => {
    it('should search conversations by title and content', async () => {
      const mockConversations = [
        {
          id: 'conv-1',
          title: 'JavaScript Tutorial',
          messages: [
            { role: 'user', content: 'Explain JavaScript closures' },
            { role: 'assistant', content: 'A closure is a function...' }
          ]
        },
        {
          id: 'conv-2',
          title: 'Python Basics',
          messages: [
            { role: 'user', content: 'What is Python?' },
            { role: 'assistant', content: 'Python is a programming language...' }
          ]
        }
      ]

      mockIDB.mockRequest.result = mockConversations

      const result = await storage.searchConversations('JavaScript')

      expect(result).toHaveLength(1)
      expect(result[0].title).toBe('JavaScript Tutorial')
    })

    it('should search case-insensitively', async () => {
      const mockConversations = [
        {
          id: 'conv-1',
          title: 'JAVASCRIPT Tutorial',
          messages: []
        }
      ]

      mockIDB.mockRequest.result = mockConversations

      const result = await storage.searchConversations('javascript')

      expect(result).toHaveLength(1)
    })

    it('should search in message content', async () => {
      const mockConversations = [
        {
          id: 'conv-1',
          title: 'Programming Help',
          messages: [
            { role: 'user', content: 'Help with React components' }
          ]
        }
      ]

      mockIDB.mockRequest.result = mockConversations

      const result = await storage.searchConversations('React')

      expect(result).toHaveLength(1)
    })
  })

  describe('getConversationsByProvider', () => {
    it('should filter conversations by provider', async () => {
      const mockConversations = [
        {
          id: 'conv-1',
          title: 'OpenAI Chat',
          provider: 'openai',
          messages: []
        },
        {
          id: 'conv-2',
          title: 'Anthropic Chat',
          provider: 'anthropic',
          messages: []
        }
      ]

      mockIDB.mockRequest.result = mockConversations

      const result = await storage.getConversationsByProvider('openai')

      expect(result).toHaveLength(1)
      expect(result[0].provider).toBe('openai')
    })
  })

  describe('getConversationStats', () => {
    it('should return conversation statistics', async () => {
      const mockConversations = [
        {
          id: 'conv-1',
          messages: [
            { role: 'user', content: 'Hello' },
            { role: 'assistant', content: 'Hi' }
          ],
          provider: 'openai'
        },
        {
          id: 'conv-2',
          messages: [
            { role: 'user', content: 'Test' }
          ],
          provider: 'anthropic'
        }
      ]

      mockIDB.mockRequest.result = mockConversations

      const stats = await storage.getConversationStats()

      expect(stats.totalConversations).toBe(2)
      expect(stats.totalMessages).toBe(3)
      expect(stats.providerBreakdown).toEqual({
        openai: 1,
        anthropic: 1
      })
    })
  })

  describe('exportConversations', () => {
    it('should export all conversations in JSON format', async () => {
      const mockConversations = [
        {
          id: 'conv-1',
          title: 'Test Chat',
          messages: [{ role: 'user', content: 'Hello' }]
        }
      ]

      mockIDB.mockRequest.result = mockConversations

      const exported = await storage.exportConversations()

      expect(exported).toEqual({
        conversations: mockConversations,
        exportedAt: expect.any(Date),
        version: '1.0'
      })
    })
  })

  describe('importConversations', () => {
    it('should import conversations from JSON data', async () => {
      const importData = {
        conversations: [
          {
            id: 'conv-1',
            title: 'Imported Chat',
            messages: [{ role: 'user', content: 'Hello' }]
          }
        ],
        version: '1.0'
      }

      mockIDB.mockRequest.result = 'conv-1'

      const result = await storage.importConversations(importData)

      expect(result.imported).toBe(1)
      expect(result.failed).toBe(0)
      expect(mockIDB.mockObjectStore.put).toHaveBeenCalled()
    })

    it('should handle import errors gracefully', async () => {
      const importData = {
        conversations: [
          { id: 'conv-1', title: 'Test' }
        ],
        version: '1.0'
      }

      mockIDB.mockRequest.error = new Error('Import failed')

      const result = await storage.importConversations(importData)

      expect(result.imported).toBe(0)
      expect(result.failed).toBe(1)
      expect(result.errors).toHaveLength(1)
    })
  })

  describe('clearAllConversations', () => {
    it('should clear all conversations', async () => {
      mockIDB.mockRequest.result = undefined

      await storage.clearAllConversations()

      expect(mockIDB.mockObjectStore.clear).toHaveBeenCalled()
    })
  })

  describe('database management', () => {
    it('should handle database upgrade', async () => {
      const upgradeRequest = { ...mockIDB.mockRequest }
      upgradeRequest.onupgradeneeded = null

      global.indexedDB.open = vi.fn(() => {
        const request = upgradeRequest
        setTimeout(() => {
          if (request.onupgradeneeded) {
            request.onupgradeneeded({
              target: { result: mockIDB.mockDatabase }
            } as any)
          }
          if (request.onsuccess) {
            request.onsuccess({ target: request } as any)
          }
        }, 0)
        return request
      })

      await storage.init()

      expect(mockIDB.mockDatabase.createObjectStore).toHaveBeenCalled()
    })

    it('should handle database connection errors', async () => {
      global.indexedDB.open = vi.fn(() => {
        const request = { ...mockIDB.mockRequest }
        setTimeout(() => {
          request.error = new Error('Connection failed')
          if (request.onerror) request.onerror({ target: request } as any)
        }, 0)
        return request
      })

      await expect(storage.init()).rejects.toThrow('Connection failed')
    })
  })
})