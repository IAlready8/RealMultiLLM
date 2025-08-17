#!/usr/bin/env node

// Test models endpoint
async function testModels() {
  try {
    console.log('Testing models API endpoint...');
    
    const response = await fetch('http://localhost:3003/api/llm/models', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    console.log('Response status:', response.status);
    
    if (response.ok) {
      const responseData = await response.json();
      console.log('Available providers:', JSON.stringify(responseData, null, 2));
    } else {
      const errorData = await response.text();
      console.log('Error response:', errorData);
    }
    
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

testModels();