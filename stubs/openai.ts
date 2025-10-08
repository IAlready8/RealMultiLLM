class OpenAIStub {
  private apiKey: string | undefined

  constructor(config: { apiKey?: string } = {}) {
    this.apiKey = config.apiKey
  }

  get models() {
    const error = new Error('OpenAI SDK stub in use. Install "openai" to enable Grok provider integration.')
    return {
      list: async (..._args: any[]) => {
        throw error
      }
    }
  }

  get chat() {
    const error = new Error('OpenAI SDK stub in use. Install "openai" to enable Grok provider integration.')
    return {
      completions: {
        create: async (..._args: any[]) => {
          throw error
        }
      }
    }
  }
}

export default OpenAIStub
