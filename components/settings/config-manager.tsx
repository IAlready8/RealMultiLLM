'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/components/ui/use-toast'
import { AlertTriangle, CheckCircle, Settings, TestTube } from 'lucide-react'
import type { ProviderConfig } from '@/lib/config-schemas'

interface ConfigManagerProps {
  userId: string
}

interface ValidationError {
  path: string
  message: string
}

interface ValidationResult {
  success: boolean
  errors?: ValidationError[]
  connectionTest?: {
    success: boolean
    error?: string
    latency?: number
  }
}

const PROVIDERS = [
  { id: 'openai', name: 'OpenAI', models: ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo'] },
  { id: 'anthropic', name: 'Anthropic', models: ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku'] },
  { id: 'googleai', name: 'Google AI', models: ['gemini-pro', 'gemini-pro-vision'] },
  { id: 'openrouter', name: 'OpenRouter', models: ['openai/gpt-4', 'anthropic/claude-3-opus'] },
]

export function ConfigManager({ userId }: ConfigManagerProps) {
  const { toast } = useToast()
  const [configs, setConfigs] = useState<Record<string, ProviderConfig>>({})
  const [activeProvider, setActiveProvider] = useState<string>('openai')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null)

  const loadConfigurations = useCallback(async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/config/validate')
      const data = await response.json()
      
      if (data.configs) {
        setConfigs(data.configs)
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load configurations',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }, [toast])

  useEffect(() => {
    loadConfigurations()
  }, [loadConfigurations])

  const validateAndTest = async (provider: string, config: Partial<ProviderConfig>) => {
    try {
      setIsTesting(true)
      const response = await fetch('/api/config/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, config }),
      })
      
      const result = await response.json()
      setValidationResult(result)
      
      if (result.success && result.connectionTest?.success) {
        toast({
          title: 'Success',
          description: `${PROVIDERS.find(p => p.id === provider)?.name} connection test passed`,
        })
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Validation failed',
        variant: 'destructive',
      })
    } finally {
      setIsTesting(false)
    }
  }

  const saveConfiguration = async (provider: string, config: Partial<ProviderConfig>) => {
    try {
      setIsSaving(true)
      const response = await fetch(`/api/provider-configs/${provider}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })
      
      if (response.ok) {
        await loadConfigurations()
        toast({
          title: 'Success',
          description: `${PROVIDERS.find(p => p.id === provider)?.name} configuration saved`,
        })
        setValidationResult(null)
      } else {
        throw new Error('Save failed')
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save configuration',
        variant: 'destructive',
      })
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return <div className="flex justify-center p-8">Loading configurations...</div>
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Provider Configuration Manager
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeProvider} onValueChange={setActiveProvider}>
            <TabsList className="grid w-full grid-cols-4">
              {PROVIDERS.map((provider) => (
                <TabsTrigger key={provider.id} value={provider.id} className="relative">
                  {provider.name}
                  {configs[provider.id] && (
                    <Badge 
                      variant="secondary" 
                      className="absolute -top-1 -right-1 h-2 w-2 p-0 rounded-full bg-green-500"
                    />
                  )}
                </TabsTrigger>
              ))}
            </TabsList>

            {PROVIDERS.map((provider) => (
              <TabsContent key={provider.id} value={provider.id}>
                <ProviderConfigForm
                  provider={provider}
                  config={configs[provider.id]}
                  validationResult={validationResult}
                  isTesting={isTesting}
                  isSaving={isSaving}
                  onValidate={(config) => validateAndTest(provider.id, config)}
                  onSave={(config) => saveConfiguration(provider.id, config)}
                />
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}

interface ProviderConfigFormProps {
  provider: { id: string; name: string; models: string[] }
  config?: ProviderConfig
  validationResult: ValidationResult | null
  isTesting: boolean
  isSaving: boolean
  onValidate: (config: Partial<ProviderConfig>) => void
  onSave: (config: Partial<ProviderConfig>) => void
}

function ProviderConfigForm({
  provider,
  config,
  validationResult,
  isTesting,
  isSaving,
  onValidate,
  onSave,
}: ProviderConfigFormProps) {
  const [formData, setFormData] = useState<Partial<ProviderConfig>>({
    apiKey: config?.apiKey || '',
    baseUrl: config?.baseUrl || '',
    models: config?.models || provider.models,
    rateLimits: config?.rateLimits || { requests: 60, window: 60000 },
    isActive: config?.isActive !== false,
    settings: config?.settings || {},
  })

  const handleInputChange = (field: keyof ProviderConfig, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (validationResult?.success) {
      onSave(formData)
    } else {
      onValidate(formData)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          {provider.name} Configuration
          {config && (
            <Badge variant="outline" className="text-green-600">
              <CheckCircle className="h-3 w-3 mr-1" />
              Configured
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={`${provider.id}-api-key`}>API Key *</Label>
            <Input
              id={`${provider.id}-api-key`}
              type="password"
              value={formData.apiKey || ''}
              onChange={(e) => handleInputChange('apiKey', e.target.value)}
              placeholder={`Enter your ${provider.name} API key`}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${provider.id}-base-url`}>Base URL (Optional)</Label>
            <Input
              id={`${provider.id}-base-url`}
              type="url"
              value={formData.baseUrl || ''}
              onChange={(e) => handleInputChange('baseUrl', e.target.value)}
              placeholder="Custom API endpoint URL"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor={`${provider.id}-requests`}>Requests per minute</Label>
              <Input
                id={`${provider.id}-requests`}
                type="number"
                min="1"
                value={formData.rateLimits?.requests || 60}
                onChange={(e) =>
                  handleInputChange('rateLimits', {
                    ...formData.rateLimits,
                    requests: parseInt(e.target.value),
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${provider.id}-window`}>Window (ms)</Label>
              <Input
                id={`${provider.id}-window`}
                type="number"
                min="1000"
                value={formData.rateLimits?.window || 60000}
                onChange={(e) =>
                  handleInputChange('rateLimits', {
                    ...formData.rateLimits,
                    window: parseInt(e.target.value),
                  })
                }
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Available Models</Label>
            <div className="flex flex-wrap gap-2">
              {provider.models.map((model) => (
                <Badge key={model} variant="secondary">
                  {model}
                </Badge>
              ))}
            </div>
          </div>

          {validationResult && (
            <Alert className={validationResult.success ? 'border-green-500' : 'border-red-500'}>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {validationResult.success ? (
                  <div className="space-y-2">
                    <p className="text-green-700">Configuration is valid!</p>
                    {validationResult.connectionTest && (
                      <p className="text-sm">
                        Connection test: {
                          validationResult.connectionTest.success ? (
                            <span className="text-green-600">
                              ✓ Passed ({validationResult.connectionTest.latency}ms)
                            </span>
                          ) : (
                            <span className="text-red-600">
                              ✗ Failed: {validationResult.connectionTest.error}
                            </span>
                          )
                        }
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-1">
                    <p className="text-red-700">Configuration errors:</p>
                    <ul className="text-sm space-y-1">
                      {validationResult.errors?.map((error, index) => (
                        <li key={index} className="text-red-600">
                          • {error.path}: {error.message}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </AlertDescription>
            </Alert>
          )}

          <div className="flex gap-2">
            <Button
              type="submit"
              disabled={isTesting || isSaving}
              variant={validationResult?.success ? 'default' : 'outline'}
            >
              {isTesting ? (
                <>
                  <TestTube className="h-4 w-4 mr-2 animate-spin" />
                  Testing...
                </>
              ) : isSaving ? (
                'Saving...'
              ) : validationResult?.success ? (
                'Save Configuration'
              ) : (
                <>
                  <TestTube className="h-4 w-4 mr-2" />
                  Test & Validate
                </>
              )}
            </Button>
            
            {config && (
              <Button
                type="button"
                variant="outline"
                onClick={() => handleInputChange('isActive', !formData.isActive)}
              >
                {formData.isActive ? 'Disable' : 'Enable'}
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  )
}