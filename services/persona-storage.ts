export interface PersonaData {
  id: string
  name: string
  systemPrompt: string
  description?: string | null
  createdAt: Date
  updatedAt?: Date
  userId?: string
}

export interface ImportPersonaData {
  personas: PersonaData[]
  userId: string
  conflictResolution?: 'skip' | 'replace' | 'merge'
}

export interface ImportResult {
  imported: number
  failed: number
  skipped: number
  errors: string[]
}

export class PersonaStorage {
  private readonly STORAGE_KEY = 'personas_data'

  private getStoredPersonas(): PersonaData[] {
    try {
      if (typeof window === 'undefined') {
        return [] // No localStorage in Node.js
      }
      const stored = localStorage.getItem(this.STORAGE_KEY)
      return stored ? JSON.parse(stored) : []
    } catch (error) {
      console.warn('Failed to parse stored personas:', error)
      return []
    }
  }

  private savePersonas(personas: PersonaData[]): void {
    try {
      if (typeof window === 'undefined') {
        return // No localStorage in Node.js
      }
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(personas))
    } catch (error) {
      console.warn('Failed to save personas:', error)
    }
  }

  async getAllPersonas(): Promise<PersonaData[]> {
    return this.getStoredPersonas()
  }

  async getPersona(id: string): Promise<PersonaData | null> {
    const personas = this.getStoredPersonas()
    return personas.find(p => p.id === id) || null
  }

  async savePersona(persona: PersonaData): Promise<string> {
    const personas = this.getStoredPersonas()
    const existingIndex = personas.findIndex(p => p.id === persona.id)

    const personaToSave = {
      ...persona,
      updatedAt: new Date(),
      createdAt: persona.createdAt || new Date()
    }

    if (existingIndex >= 0) {
      personas[existingIndex] = personaToSave
    } else {
      personas.push(personaToSave)
    }

    this.savePersonas(personas)
    return persona.id
  }

  async deletePersona(id: string): Promise<void> {
    const personas = this.getStoredPersonas()
    const filtered = personas.filter(p => p.id !== id)
    this.savePersonas(filtered)
  }

  async importPersonas(data: ImportPersonaData): Promise<ImportResult> {
    const result: ImportResult = {
      imported: 0,
      failed: 0,
      skipped: 0,
      errors: []
    }

    const existingPersonas = this.getStoredPersonas()

    for (const persona of data.personas) {
      try {
        const existing = existingPersonas.find(p => p.id === persona.id)

        if (existing && data.conflictResolution === 'skip') {
          result.skipped++
          result.errors.push('Persona already exists')
          continue
        }

        await this.savePersona({
          ...persona,
          userId: data.userId
        })

        result.imported++
      } catch (error) {
        result.failed++
        result.errors.push(error instanceof Error ? error.message : 'Unknown error')
      }
    }

    return result
  }
}

// Legacy functional exports for backward compatibility
export async function savePersona(
  title: string,
  description: string | null,
  prompt: string,
  userId: string
): Promise<string> {
  const storage = new PersonaStorage()
  const persona: PersonaData = {
    id: `persona_${Date.now()}`,
    name: title,
    systemPrompt: prompt,
    description: description || undefined,
    createdAt: new Date(),
    userId
  }
  return storage.savePersona(persona)
}

export async function getPersonasByUserId(userId: string): Promise<PersonaData[]> {
  const storage = new PersonaStorage()
  const personas = await storage.getAllPersonas()
  return personas.filter(p => p.userId === userId)
}

export async function getPersona(id: string): Promise<PersonaData | null> {
  const storage = new PersonaStorage()
  return storage.getPersona(id)
}

// Additional functional exports to resolve import issues
export async function updatePersona(id: string, updates: Partial<Omit<PersonaData, 'id' | 'userId' | 'createdAt'>>): Promise<void> {
  const storage = new PersonaStorage()
  const existing = await storage.getPersona(id)
  if (existing) {
    const updated = { ...existing, ...updates, updatedAt: new Date() }
    await storage.savePersona(updated)
  }
}

export async function deletePersona(id: string): Promise<void> {
  const storage = new PersonaStorage()
  await storage.deletePersona(id)
}
