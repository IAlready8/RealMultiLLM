import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { ExportImportService } from '@/services/export-import-service'

// Mock file system operations
const mockFile = vi.fn()
const mockFileReader = {
  readAsText: vi.fn(),
  result: '',
  onload: null as any,
  onerror: null as any,
}

global.File = mockFile as any
global.FileReader = vi.fn(() => mockFileReader) as any

// Mock URL.createObjectURL and revokeObjectURL
global.URL = {
  createObjectURL: vi.fn(() => 'blob:mock-url'),
  revokeObjectURL: vi.fn(),
} as any

// Mock document methods
const mockAnchor = {
  href: '',
  download: '',
  click: vi.fn(),
  style: {},
}

Object.defineProperty(document, 'createElement', {
  value: vi.fn(() => mockAnchor),
  writable: true,
})

Object.defineProperty(document.body, 'appendChild', {
  value: vi.fn(),
  writable: true,
})

Object.defineProperty(document.body, 'removeChild', {
  value: vi.fn(),
  writable: true,
})

// Mock services
const mockConversationStorage = {
  getAllConversations: vi.fn(),
  importConversations: vi.fn(),
  saveConversation: vi.fn(),
}

const mockPersonaStorage = {
  getAllPersonas: vi.fn(),
  importPersonas: vi.fn(),
  savePersona: vi.fn(),
}

const mockAnalyticsService = {
  getUserAnalytics: vi.fn(),
  importAnalytics: vi.fn(),
}

vi.mock('@/services/conversation-storage', () => ({
  ConversationStorage: vi.fn(() => mockConversationStorage),
}))

vi.mock('@/services/persona-storage', () => ({
  PersonaStorage: vi.fn(() => mockPersonaStorage),
}))

vi.mock('@/services/analytics-service', () => ({
  AnalyticsService: vi.fn(() => mockAnalyticsService),
}))

describe('ExportImportService', () => {
  let exportImportService: ExportImportService

  beforeEach(() => {
    vi.clearAllMocks()
    exportImportService = new ExportImportService()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('exportData', () => {
    it('should export all user data', async () => {
      const mockConversations = [
        {
          id: 'conv-1',
          title: 'Test Conversation',
          messages: [{ role: 'user', content: 'Hello' }],
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ]

      const mockPersonas = [
        {
          id: 'persona-1',
          name: 'Assistant',
          systemPrompt: 'You are a helpful assistant',
          createdAt: new Date()
        }
      ]

      const mockAnalytics = {
        totalConversations: 1,
        totalMessages: 1,
        eventBreakdown: { conversation_started: 1 }
      }

      mockConversationStorage.getAllConversations.mockResolvedValue(mockConversations)
      mockPersonaStorage.getAllPersonas.mockResolvedValue(mockPersonas)
      mockAnalyticsService.getUserAnalytics.mockResolvedValue(mockAnalytics)

      const exportData = await exportImportService.exportData('user-123')

      expect(exportData).toEqual({
        version: '1.0',
        exportedAt: expect.any(Date),
        userId: 'user-123',
        conversations: mockConversations,
        personas: mockPersonas,
        analytics: mockAnalytics,
        metadata: {
          totalConversations: 1,
          totalPersonas: 1,
          dataSize: expect.any(Number)
        }
      })
    })

    it('should handle partial data export', async () => {
      const options = {
        includeConversations: true,
        includePersonas: false,
        includeAnalytics: false
      }

      const mockConversations = [
        { id: 'conv-1', title: 'Test', messages: [] }
      ]

      mockConversationStorage.getAllConversations.mockResolvedValue(mockConversations)

      const exportData = await exportImportService.exportData('user-123', options)

      expect(exportData.conversations).toEqual(mockConversations)
      expect(exportData.personas).toBeUndefined()
      expect(exportData.analytics).toBeUndefined()
    })

    it('should filter data by date range', async () => {
      const startDate = new Date('2024-01-01')
      const endDate = new Date('2024-01-31')

      const mockConversations = [
        {
          id: 'conv-1',
          title: 'Old Conversation',
          createdAt: new Date('2023-12-15'),
          messages: []
        },
        {
          id: 'conv-2',
          title: 'New Conversation',
          createdAt: new Date('2024-01-15'),
          messages: []
        }
      ]

      mockConversationStorage.getAllConversations.mockResolvedValue(mockConversations)

      const exportData = await exportImportService.exportData('user-123', {
        startDate,
        endDate
      })

      expect(exportData.conversations).toHaveLength(1)
      expect(exportData.conversations[0].title).toBe('New Conversation')
    })

    it('should handle export errors gracefully', async () => {
      mockConversationStorage.getAllConversations.mockRejectedValue(
        new Error('Database error')
      )

      await expect(
        exportImportService.exportData('user-123')
      ).rejects.toThrow('Failed to export data')
    })
  })

  describe('importData', () => {
    it('should import valid data successfully', async () => {
      const importData = {
        version: '1.0',
        exportedAt: new Date(),
        userId: 'user-123',
        conversations: [
          {
            id: 'conv-1',
            title: 'Imported Conversation',
            messages: [{ role: 'user', content: 'Hello' }]
          }
        ],
        personas: [
          {
            id: 'persona-1',
            name: 'Imported Persona',
            systemPrompt: 'You are helpful'
          }
        ],
        analytics: {
          totalConversations: 1
        }
      }

      mockConversationStorage.importConversations.mockResolvedValue({
        imported: 1,
        failed: 0,
        errors: []
      })

      mockPersonaStorage.importPersonas.mockResolvedValue({
        imported: 1,
        failed: 0,
        errors: []
      })

      const result = await exportImportService.importData(importData, 'user-123')

      expect(result.success).toBe(true)
      expect(result.imported.conversations).toBe(1)
      expect(result.imported.personas).toBe(1)
      expect(result.errors).toHaveLength(0)
    })

    it('should validate data format', async () => {
      const invalidData = {
        version: '0.5', // Unsupported version
        conversations: 'invalid'
      }

      await expect(
        exportImportService.importData(invalidData as any, 'user-123')
      ).rejects.toThrow('Invalid data format')
    })

    it('should handle import conflicts', async () => {
      const importData = {
        version: '1.0',
        exportedAt: new Date(),
        userId: 'user-123',
        conversations: [
          {
            id: 'conv-1',
            title: 'Conflicting Conversation',
            messages: []
          }
        ]
      }

      const options = {
        conflictResolution: 'skip' as const
      }

      mockConversationStorage.importConversations.mockResolvedValue({
        imported: 0,
        failed: 1,
        errors: ['Conversation already exists']
      })

      const result = await exportImportService.importData(importData, 'user-123', options)

      expect(result.imported.conversations).toBe(0)
      expect(result.skipped.conversations).toBe(1)
    })

    it('should sanitize imported data', async () => {
      const importData = {
        version: '1.0',
        exportedAt: new Date(),
        userId: 'user-123',
        conversations: [
          {
            id: 'conv-1',
            title: '<script>alert("xss")</script>Malicious Title',
            messages: [
              {
                role: 'user',
                content: '<img src="x" onerror="alert(1)">Hello'
              }
            ]
          }
        ]
      }

      mockConversationStorage.importConversations.mockResolvedValue({
        imported: 1,
        failed: 0,
        errors: []
      })

      await exportImportService.importData(importData, 'user-123')

      const importCall = mockConversationStorage.importConversations.mock.calls[0][0]
      const sanitizedConversation = importCall.conversations[0]

      expect(sanitizedConversation.title).not.toContain('<script>')
      expect(sanitizedConversation.messages[0].content).not.toContain('<img')
    })
  })

  describe('downloadExport', () => {
    it('should trigger file download', async () => {
      const exportData = {
        version: '1.0',
        conversations: [],
        personas: []
      }

      await exportImportService.downloadExport(exportData, 'test-export.json')

      expect(document.createElement).toHaveBeenCalledWith('a')
      expect(mockAnchor.download).toBe('test-export.json')
      expect(mockAnchor.click).toHaveBeenCalled()
      expect(URL.createObjectURL).toHaveBeenCalled()
      expect(URL.revokeObjectURL).toHaveBeenCalled()
    })

    it('should generate default filename with timestamp', async () => {
      const exportData = { version: '1.0' }

      await exportImportService.downloadExport(exportData)

      expect(mockAnchor.download).toMatch(/^realmultillm-export-\d{4}-\d{2}-\d{2}\.json$/)
    })

    it('should compress large exports', async () => {
      const largeExportData = {
        version: '1.0',
        conversations: Array.from({ length: 1000 }, (_, i) => ({
          id: `conv-${i}`,
          title: `Conversation ${i}`,
          messages: Array.from({ length: 10 }, (_, j) => ({
            role: j % 2 === 0 ? 'user' : 'assistant',
            content: `Message ${j} in conversation ${i}`
          }))
        }))
      }

      await exportImportService.downloadExport(largeExportData)

      expect(mockAnchor.download).toContain('.json.gz')
    })
  })

  describe('uploadImport', () => {
    it('should read and parse uploaded file', async () => {
      const mockFileContent = JSON.stringify({
        version: '1.0',
        conversations: [],
        personas: []
      })

      const mockUploadFile = new File([mockFileContent], 'import.json', {
        type: 'application/json'
      })

      mockFileReader.result = mockFileContent

      const parsePromise = exportImportService.uploadImport(mockUploadFile)

      // Simulate FileReader onload
      mockFileReader.onload({ target: mockFileReader })

      const result = await parsePromise

      expect(result).toEqual({
        version: '1.0',
        conversations: [],
        personas: []
      })
    })

    it('should handle file read errors', async () => {
      const mockUploadFile = new File([''], 'import.json')

      const parsePromise = exportImportService.uploadImport(mockUploadFile)

      // Simulate FileReader error
      mockFileReader.onerror(new Error('File read error'))

      await expect(parsePromise).rejects.toThrow('File read error')
    })

    it('should validate file format', async () => {
      const invalidFile = new File(['invalid json{'], 'import.json')

      mockFileReader.result = 'invalid json{'

      const parsePromise = exportImportService.uploadImport(invalidFile)

      mockFileReader.onload({ target: mockFileReader })

      await expect(parsePromise).rejects.toThrow('Invalid JSON format')
    })

    it('should handle compressed files', async () => {
      const compressedFile = new File(['compressed data'], 'import.json.gz', {
        type: 'application/gzip'
      })

      // Mock decompression
      const originalData = JSON.stringify({ version: '1.0', conversations: [] })
      mockFileReader.result = originalData

      const parsePromise = exportImportService.uploadImport(compressedFile)

      mockFileReader.onload({ target: mockFileReader })

      const result = await parsePromise

      expect(result.version).toBe('1.0')
    })
  })

  describe('validateExportData', () => {
    it('should validate correct data structure', () => {
      const validData = {
        version: '1.0',
        exportedAt: new Date(),
        userId: 'user-123',
        conversations: [],
        personas: []
      }

      expect(() => exportImportService.validateExportData(validData)).not.toThrow()
    })

    it('should reject invalid version', () => {
      const invalidData = {
        version: '2.0', // Unsupported
        conversations: []
      }

      expect(() => exportImportService.validateExportData(invalidData))
        .toThrow('Unsupported data version')
    })

    it('should reject malformed conversation data', () => {
      const invalidData = {
        version: '1.0',
        conversations: [
          { id: '', title: 'Invalid' } // Missing required fields
        ]
      }

      expect(() => exportImportService.validateExportData(invalidData))
        .toThrow('Invalid conversation data')
    })
  })

  describe('migration and compatibility', () => {
    it('should migrate older data formats', async () => {
      const oldFormatData = {
        version: '0.9',
        data: {
          chats: [
            {
              id: 'old-1',
              name: 'Old Chat',
              history: [{ user: 'Hello', bot: 'Hi' }]
            }
          ]
        }
      }

      const migratedData = await exportImportService.migrateDataFormat(oldFormatData)

      expect(migratedData.version).toBe('1.0')
      expect(migratedData.conversations).toBeDefined()
      expect(migratedData.conversations[0].messages).toBeDefined()
    })

    it('should handle unknown data formats gracefully', async () => {
      const unknownFormatData = {
        version: '0.1',
        unknownStructure: true
      }

      await expect(
        exportImportService.migrateDataFormat(unknownFormatData)
      ).rejects.toThrow('Cannot migrate from version 0.1')
    })
  })

  describe('privacy and security', () => {
    it('should exclude sensitive data from exports', async () => {
      const mockConversations = [
        {
          id: 'conv-1',
          title: 'Test',
          messages: [
            {
              role: 'user',
              content: 'My API key is sk-123456',
              metadata: { apiKey: 'sk-123456' }
            }
          ],
          settings: {
            apiKey: 'sk-123456',
            userEmail: 'user@example.com'
          }
        }
      ]

      mockConversationStorage.getAllConversations.mockResolvedValue(mockConversations)

      const exportData = await exportImportService.exportData('user-123')

      const conversation = exportData.conversations[0]
      expect(JSON.stringify(conversation)).not.toContain('sk-123456')
      expect(JSON.stringify(conversation)).not.toContain('user@example.com')
    })

    it('should validate import data for security risks', async () => {
      const maliciousData = {
        version: '1.0',
        conversations: [
          {
            id: 'conv-1',
            title: 'Normal Title',
            messages: [
              {
                role: 'user',
                content: 'javascript:alert("xss")',
                __proto__: { isAdmin: true }
              }
            ]
          }
        ]
      }

      await expect(
        exportImportService.importData(maliciousData, 'user-123')
      ).rejects.toThrow('Security validation failed')
    })
  })
})