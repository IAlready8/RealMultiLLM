# API Key Setup Guide

This guide explains how to properly set up and manage API keys for the various LLM providers supported by this application.

## Supported Providers

1. **OpenAI** - For GPT models
2. **Claude** - For Anthropic models
3. **Google AI** - For Gemini models
4. **Llama** - For local Llama models
5. **GitHub** - For GitHub Copilot
6. **Grok** - For X.AI models

## Setting Up API Keys

### Method 1: Through the UI (Recommended)

1. Navigate to the **Settings** page in the application
2. Go to the **API Keys** tab
3. Enter your API key for each provider you want to use
4. Click **Save** for each key
5. Optionally, click **Test Key** to verify the key works

### Method 2: Direct Storage

API keys are stored securely in the browser's localStorage using encryption. You can also manage them directly through the application's UI.

## Security Notes

- All API keys are encrypted before being stored in localStorage
- Keys never leave your browser unless making API requests
- Keys are only sent to the respective provider's API endpoints
- You can clear all stored keys using the "Clear All Data" option in Settings

## Troubleshooting

### If a model isn't working:

1. Check that you've entered the API key correctly
2. Verify the key by clicking "Test Key"
3. Check that you have the proper permissions/billing set up with the provider
4. Ensure you're using a supported model

### If you're seeing "No API key configured":

1. Make sure you've saved the API key for that provider
2. Try refreshing the page after saving
3. Check browser console for any errors

## Default Models

Each provider has a default model that will be used if you don't specify one:

- **OpenAI**: gpt-4o
- **Claude**: claude-3-opus-20240229
- **Google AI**: gemini-pro
- **Llama**: llama3
- **GitHub**: copilot
- **Grok**: grok-1

You can change these defaults in the Settings page under the "Model Settings" tab.
