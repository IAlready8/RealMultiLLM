#!/usr/bin/env node

// Simple test script to check API endpoint
async function testAPI() {
  try {
    console.log('Testing LLM API endpoint...');
    
    const testPayload = {
      provider: 'openai',
      messages: [
        { role: 'user', content: 'Hello, how are you?' }
      ],
      options: {
        temperature: 0.7,
        maxTokens: 100
      }
    };

    const response = await fetch('http://localhost:3003/api/llm/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Note: This won't work without proper session, but will show us the error
      },
      body: JSON.stringify(testPayload)
    });

    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));
    
    const responseData = await response.json();
    console.log('Response data:', JSON.stringify(responseData, null, 2));
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testAPI();