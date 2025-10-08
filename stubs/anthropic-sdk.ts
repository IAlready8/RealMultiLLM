class AnthropicStub {
  private apiKey: string | undefined

  constructor(config: { apiKey?: string } = {}) {
    this.apiKey = config.apiKey
  }

  get models() {
    return {
      list: async (..._args: any[]) => {
        throw new Error('Anthropic SDK stub in use. Install "@anthropic-ai/sdk" to enable Anthropic provider integration.')
      }
    }
  }

  get messages() {
    return {
      create: async (..._args: any[]) => {
        throw new Error('Anthropic SDK stub in use. Install "@anthropic-ai/sdk" to enable Anthropic provider integration.')
      }
    }
  }
}

export default AnthropicStub
