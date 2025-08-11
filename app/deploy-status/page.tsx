"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, AlertTriangle, X, RefreshCw, ExternalLink } from "lucide-react";

interface HealthStatus {
  status: 'healthy' | 'warning' | 'error';
  timestamp: string;
  version: string;
  environment: string;
  database: string;
  llmProviders: {
    available: number;
    configured: string[];
  };
  deployment: {
    platform: string;
    region: string;
  };
  warnings?: string[];
  errors?: string[];
}

export default function DeployStatusPage() {
  const [healthStatus, setHealthStatus] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const fetchHealthStatus = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/health');
      const data = await response.json();
      setHealthStatus(data);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Failed to fetch health status:', error);
      setHealthStatus({
        status: 'error',
        timestamp: new Date().toISOString(),
        version: 'unknown',
        environment: 'unknown',
        database: 'disconnected',
        llmProviders: { available: 0, configured: [] },
        deployment: { platform: 'unknown', region: 'unknown' },
        errors: ['Failed to fetch health status']
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealthStatus();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchHealthStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <Check className="h-5 w-5 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'error':
        return <X className="h-5 w-5 text-red-500" />;
      default:
        return <RefreshCw className="h-5 w-5 text-gray-500 animate-spin" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'bg-green-100 text-green-800';
      case 'warning':
        return 'bg-yellow-100 text-yellow-800';
      case 'error':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">🚀 Deployment Status</h1>
        <p className="text-gray-600">Real-time health check for your RealMultiLLM deployment</p>
      </div>

      <div className="grid gap-6">
        {/* Overall Status Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                {loading ? (
                  <RefreshCw className="h-5 w-5 animate-spin" />
                ) : (
                  getStatusIcon(healthStatus?.status || 'unknown')
                )}
                Overall Status
              </CardTitle>
              <div className="flex items-center gap-2">
                <Badge className={getStatusColor(healthStatus?.status || 'unknown')}>
                  {healthStatus?.status?.toUpperCase() || 'UNKNOWN'}
                </Badge>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={fetchHealthStatus}
                  disabled={loading}
                >
                  {loading ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-gray-500">Version</p>
                <p className="font-medium">{healthStatus?.version || 'Unknown'}</p>
              </div>
              <div>
                <p className="text-gray-500">Environment</p>
                <p className="font-medium">{healthStatus?.environment || 'Unknown'}</p>
              </div>
              <div>
                <p className="text-gray-500">Platform</p>
                <p className="font-medium capitalize">{healthStatus?.deployment.platform || 'Unknown'}</p>
              </div>
              <div>
                <p className="text-gray-500">Last Updated</p>
                <p className="font-medium">{lastUpdated.toLocaleTimeString()}</p>
              </div>
            </div>
            
            {healthStatus?.errors && healthStatus.errors.length > 0 && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <h4 className="font-medium text-red-800 mb-2">❌ Errors</h4>
                <ul className="text-sm text-red-700 space-y-1">
                  {healthStatus.errors.map((error, index) => (
                    <li key={index}>• {error}</li>
                  ))}
                </ul>
              </div>
            )}

            {healthStatus?.warnings && healthStatus.warnings.length > 0 && (
              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <h4 className="font-medium text-yellow-800 mb-2">⚠️ Warnings</h4>
                <ul className="text-sm text-yellow-700 space-y-1">
                  {healthStatus.warnings.map((warning, index) => (
                    <li key={index}>• {warning}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Database Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {healthStatus?.database === 'connected' ? (
                <Check className="h-5 w-5 text-green-500" />
              ) : (
                <X className="h-5 w-5 text-red-500" />
              )}
              Database Connection
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span>Status: <span className="font-medium">{healthStatus?.database || 'Unknown'}</span></span>
              <Badge className={healthStatus?.database === 'connected' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                {healthStatus?.database === 'connected' ? 'CONNECTED' : 'DISCONNECTED'}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* LLM Providers */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {(healthStatus?.llmProviders.available || 0) > 0 ? (
                <Check className="h-5 w-5 text-green-500" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
              )}
              LLM Providers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span>Available Providers</span>
                <Badge>{healthStatus?.llmProviders.available || 0}</Badge>
              </div>
              
              {healthStatus?.llmProviders.configured && healthStatus.llmProviders.configured.length > 0 ? (
                <div>
                  <p className="text-sm text-gray-600 mb-2">Configured:</p>
                  <div className="flex flex-wrap gap-2">
                    {healthStatus.llmProviders.configured.map((provider) => (
                      <Badge key={provider} variant="outline" className="capitalize">
                        {provider}
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-700">
                    ⚠️ No LLM providers configured. Add API keys in the Settings page.
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>🔧 Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Button asChild variant="outline">
                <a href="/settings" className="flex items-center gap-2">
                  <ExternalLink className="h-4 w-4" />
                  Configure API Keys
                </a>
              </Button>
              <Button asChild variant="outline">
                <a href="/" className="flex items-center gap-2">
                  <ExternalLink className="h-4 w-4" />
                  Test Multi-Chat
                </a>
              </Button>
              <Button asChild variant="outline">
                <a href="/api/health" target="_blank" className="flex items-center gap-2">
                  <ExternalLink className="h-4 w-4" />
                  Raw Health Data
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Deployment Info */}
        {healthStatus && (
          <Card>
            <CardHeader>
              <CardTitle>📊 Deployment Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500">Deployment Platform</p>
                  <p className="font-medium capitalize">{healthStatus.deployment.platform}</p>
                </div>
                <div>
                  <p className="text-gray-500">Region</p>
                  <p className="font-medium">{healthStatus.deployment.region}</p>
                </div>
                <div>
                  <p className="text-gray-500">Timestamp</p>
                  <p className="font-medium">{new Date(healthStatus.timestamp).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-gray-500">Environment</p>
                  <p className="font-medium">{healthStatus.environment}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Footer */}
      <div className="mt-8 text-center text-sm text-gray-500">
        <p>Deployment Status • Auto-refreshes every 30 seconds</p>
      </div>
    </div>
  );
}