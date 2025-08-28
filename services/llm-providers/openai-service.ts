/**
 * OpenAI Service
 * 
 * This file contains the logic for interacting with the OpenAI API.
 */

interface OpenAIRequest {
  apiKey: string;
  model: string;
  prompt: string;
  temperature?: number;
  max_tokens?: number;
}

interface OpenAIResponse {
  text: string;
  finish_reason: string;
}

export async function callOpenAI(request: OpenAIRequest): Promise<OpenAIResponse> {
  if (!request.apiKey) {
    throw new Error('OpenAI API key is required.');
  }

  const response = await fetch('https://api.openai.com/v1/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${request.apiKey}`
    },
    body: JSON.stringify({
      model: request.model,
      prompt: request.prompt,
      temperature: request.temperature || 0.7,
      max_tokens: request.max_tokens || 150,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.json();
    throw new Error(`OpenAI API request failed: ${errorBody.error.message}`);
  }

  const data = await response.json();
  
  return {
    text: data.choices[0].text.trim(),
    finish_reason: data.choices[0].finish_reason,
  };
}
