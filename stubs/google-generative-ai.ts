class GoogleGenerativeAIStub {
  private apiKey: string | undefined

  constructor(apiKey?: string) {
    this.apiKey = apiKey
  }

  private createModel() {
    const error = new Error('Google Generative AI stub in use. Install "@google/generative-ai" to enable Gemini provider integration.')
    return {
      async generateContent(..._args: any[]) {
        throw error
      },
      async generateContentStream(..._args: any[]) {
        async function* stream() {
          throw error
        }
        return { stream: stream() }
      }
    }
  }

  getGenerativeModel(..._args: any[]) {
    return this.createModel()
  }

  getGenerativeAI(..._args: any[]) {
    return this.createModel()
  }
}

export { GoogleGenerativeAIStub as GoogleGenerativeAI }
