'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Activity, 
  Search, 
  Filter, 
  Download, 
  Calendar, 
  User, 
  Server, 
  Shield,
  AlertTriangle,
  Key,
  Users,
  Bot as BotIcon
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { format, parseISO } from 'date-fns';
import { ComplianceAuditEntry } from '@/lib/compliance-audit';

/**
 * Compliance Audit Log Viewer Component
 * Displays and filters audit logs for compliance monitoring
 */

export function ComplianceAuditViewer() {
  const { toast } = useToast();
  const [logs, setLogs] = useState<ComplianceAuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    search: '',
    category: '',
    severity: '',
    startDate: '',
    endDate: '',
    limit: '50'
  });
  const [exporting, setExporting] = useState(false);

  const fetchAuditLogs = useCallback(async () => {
    try {
      setLoading(true);
      
      // In a real implementation, this would fetch from the API
      // const auditService = getComplianceAuditService(prisma);
      // const fetchedLogs = await auditService.getComplianceLogs(filters);
      
      // For demonstration, using mock data
      const mockLogs: ComplianceAuditEntry[] = [
        {
          id: '1',
          timestamp: new Date(Date.now() - 1000 * 60 * 5),
          userId: 'user-123',
          teamId: null,
          action: 'data_export_requested',
          resource: 'user_data',
          resourceId: 'user-123',
          details: { exportFormat: 'json', includeConversations: true },
          outcome: 'success',
          ipAddress: '192.168.1.100',
          userAgent: 'Mozilla/5.0...',
          correlationId: 'corr-789',
          severity: 'medium',
          category: 'data_access'
        },
        {
          id: '2',
          timestamp: new Date(Date.now() - 1000 * 60 * 15),
          userId: 'user-456',
          teamId: 'team-abc',
          action: 'data_deletion_requested',
          resource: 'user_account',
          resourceId: 'user-456',
          details: { reason: 'User requested account deletion' },
          outcome: 'success',
          ipAddress: '192.168.1.101',
          userAgent: 'Mozilla/5.0...',
          correlationId: 'corr-123',
          severity: 'high',
          category: 'data_modification'
        },
        {
          id: '3',
          timestamp: new Date(Date.now() - 1000 * 60 * 30),
          userId: 'admin-789',
          teamId: 'team-xyz',
          action: 'role_assigned',
          resource: 'rbac',
          resourceId: 'user-456',
          details: { roleId: 'user-manager', grantedBy: 'admin-789' },
          outcome: 'success',
          ipAddress: '192.168.1.200',
          userAgent: 'Mozilla/5.0...',
          correlationId: 'corr-456',
          severity: 'medium',
          category: 'user_management'
        },
        {
          id: '4',
          timestamp: new Date(Date.now() - 1000 * 60 * 45),
          userId: 'user-123',
          teamId: null,
          action: 'login_attempt',
          resource: 'authentication',
          resourceId: null,
          details: { method: 'oauth', provider: 'google' },
          outcome: 'success',
          ipAddress: '192.168.1.100',
          userAgent: 'Mozilla/5.0...',
          correlationId: 'corr-789',
          severity: 'low',
          category: 'authentication'
        },
        {
          id: '5',
          timestamp: new Date(Date.now() - 1000 * 60 * 60),
          userId: 'user-789',
          teamId: null,
          action: 'api_key_generated',
          resource: 'api_key',
          resourceId: 'openai',
          details: { keyPrefix: 'sk-...', keyLength: 51 },
          outcome: 'success',
          ipAddress: '192.168.1.105',
          userAgent: 'Mozilla/5.0...',
          correlationId: 'corr-888',
          severity: 'high',
          category: 'api_key_management'
        }
      ];
      
      setLogs(mockLogs);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load audit logs',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void fetchAuditLogs();
  }, [fetchAuditLogs]);

  const handleFilterChange = (field: string, value: string) => {
    setFilters(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleExport = async (format: 'json' | 'csv') => {
    try {
      setExporting(true);
      
      // In a real implementation, this would export from the API
      // const auditService = getComplianceAuditService(prisma);
      // const exportedData = await auditService.exportComplianceLogs(filters, format);
      
      toast({
        title: 'Export Started',
        description: `Audit logs export (${format.toUpperCase()}) has been initiated.`
      });
      
      // Simulate download
      setTimeout(() => {
        const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `audit-logs-${format}-${new Date().toISOString().split('T')[0]}.${format}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 1000);
    } catch (error) {
      toast({
        title: 'Export Failed',
        description: 'Failed to export audit logs',
        variant: 'destructive'
      });
    } finally {
      setExporting(false);
    }
  };

  const getSeverityBadge = (severity: ComplianceAuditEntry['severity']) => {
    switch (severity) {
      case 'critical':
        return <Badge className="bg-red-500 hover:bg-red-600">Critical</Badge>;
      case 'high':
        return <Badge className="bg-orange-500 hover:bg-orange-600">High</Badge>;
      case 'medium':
        return <Badge className="bg-yellow-500 hover:bg-yellow-600">Medium</Badge>;
      case 'low':
        return <Badge className="bg-green-500 hover:bg-green-600">Low</Badge>;
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  const getCategoryIcon = (category: ComplianceAuditEntry['category']) => {
    switch (category) {
      case 'authentication':
        return <Shield className="h-4 w-4 text-blue-500" />;
      case 'authorization':
        return <User className="h-4 w-4 text-purple-500" />;
      case 'data_access':
        return <Eye className="h-4 w-4 text-green-500" />;
      case 'data_modification':
        return <Edit className="h-4 w-4 text-yellow-500" />;
      case 'configuration_change':
        return <Settings className="h-4 w-4 text-gray-500" />;
      case 'api_key_management':
        return <Key className="h-4 w-4 text-indigo-500" />;
      case 'user_management':
        return <Users className="h-4 w-4 text-teal-500" />;
      case 'llm_interaction':
        return <BotIcon className="h-4 w-4 text-pink-500" />;
      case 'security_event':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'system_event':
        return <Server className="h-4 w-4 text-cyan-500" />;
      default:
        return <Activity className="h-4 w-4 text-gray-500" />;
    }
  };

  const filteredLogs = logs.filter(log => {
    if (filters.search && 
        !log.action.toLowerCase().includes(filters.search.toLowerCase()) &&
        !log.resource.toLowerCase().includes(filters.search.toLowerCase()) &&
        !(log.userId && log.userId.toLowerCase().includes(filters.search.toLowerCase()))) {
      return false;
    }
    
    if (filters.category && log.category !== filters.category) {
      return false;
    }
    
    if (filters.severity && log.severity !== filters.severity) {
      return false;
    }
    
    if (filters.startDate) {
      const startDate = new Date(filters.startDate);
      if (log.timestamp < startDate) {
        return false;
      }
    }
    
    if (filters.endDate) {
      const endDate = new Date(filters.endDate);
      if (log.timestamp > endDate) {
        return false;
      }
    }
    
    return true;
  });

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="heading-underline text-3xl font-bold flex items-center gap-2">
            <Activity className="h-8 w-8" />
            Audit Log Viewer
          </h1>
          <div className="flex items-center space-x-2">
            <div className="h-8 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
          </div>
        </div>
        
        <Card className="glass-card">
          <CardHeader>
            <div className="h-6 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="h-4 w-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                    <div className="space-y-2">
                      <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                      <div className="h-3 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                    </div>
                  </div>
                  <div className="h-6 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="heading-underline text-3xl font-bold flex items-center gap-2">
          <Activity className="h-8 w-8" />
          Audit Log Viewer
        </h1>
        <div className="flex items-center space-x-2">
          <Button 
            variant="outline" 
            onClick={() => handleExport('json')}
            disabled={exporting}
          >
            <Download className="h-4 w-4 mr-2" />
            Export JSON
          </Button>
          <Button 
            variant="outline" 
            onClick={() => handleExport('csv')}
            disabled={exporting}
          >
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>
      
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filter Logs
          </CardTitle>
          <CardDescription>
            Search and filter audit logs by various criteria
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="search">Search</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Search actions, resources..."
                  className="pl-8"
                  value={filters.search}
                  onChange={(e) => handleFilterChange('search', e.target.value)}
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <select
                id="category"
                className="w-full p-2 border rounded-md bg-background"
                value={filters.category}
                onChange={(e) => handleFilterChange('category', e.target.value)}
              >
                <option value="">All Categories</option>
                <option value="authentication">Authentication</option>
                <option value="authorization">Authorization</option>
                <option value="data_access">Data Access</option>
                <option value="data_modification">Data Modification</option>
                <option value="configuration_change">Configuration Change</option>
                <option value="api_key_management">API Key Management</option>
                <option value="user_management">User Management</option>
                <option value="llm_interaction">LLM Interaction</option>
                <option value="security_event">Security Event</option>
                <option value="system_event">System Event</option>
              </select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="severity">Severity</Label>
              <select
                id="severity"
                className="w-full p-2 border rounded-md bg-background"
                value={filters.severity}
                onChange={(e) => handleFilterChange('severity', e.target.value)}
              >
                <option value="">All Severities</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="limit">Results Limit</Label>
              <select
                id="limit"
                className="w-full p-2 border rounded-md bg-background"
                value={filters.limit}
                onChange={(e) => handleFilterChange('limit', e.target.value)}
              >
                <option value="10">10</option>
                <option value="25">25</option>
                <option value="50">50</option>
                <option value="100">100</option>
              </select>
            </div>
          </div>
          
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date</Label>
              <div className="relative">
                <Calendar className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="startDate"
                  type="date"
                  className="pl-8"
                  value={filters.startDate}
                  onChange={(e) => handleFilterChange('startDate', e.target.value)}
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="endDate">End Date</Label>
              <div className="relative">
                <Calendar className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="endDate"
                  type="date"
                  className="pl-8"
                  value={filters.endDate}
                  onChange={(e) => handleFilterChange('endDate', e.target.value)}
                />
              </div>
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Showing {filteredLogs.length} of {logs.length} logs
            </div>
            <Button variant="outline" onClick={fetchAuditLogs}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>
      
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Audit Events
          </CardTitle>
          <CardDescription>
            Recent compliance and security-related events
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredLogs.length === 0 ? (
            <div className="text-center py-8">
              <Activity className="h-12 w-12 mx-auto text-muted-foreground" />
              <h3 className="mt-4 font-medium">No audit logs found</h3>
              <p className="text-sm text-muted-foreground">
                Try adjusting your filters or check back later
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredLogs.map((log) => (
                <div key={log.id} className="flex items-start gap-3 p-4 border rounded-lg hover:bg-accent transition-colors">
                  <div className="mt-1">
                    {getCategoryIcon(log.category)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-sm">
                        {log.action.replace(/_/g, ' ')}
                      </h4>
                      <Badge variant="outline" className="text-xs">
                        {format(parseISO(log.timestamp.toISOString()), 'MMM d, yyyy HH:mm:ss')}
                      </Badge>
                    </div>
                    
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                      <span>Resource: {log.resource}</span>
                      {log.resourceId && <span>ID: {log.resourceId}</span>}
                    </div>
                    
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="secondary" className="text-xs">
                        {log.category.replace(/_/g, ' ')}
                      </Badge>
                      {getSeverityBadge(log.severity)}
                      <Badge variant="outline" className="text-xs">
                        {log.outcome}
                      </Badge>
                    </div>
                    
                    {log.userId && (
                      <div className="flex items-center gap-2 mt-2 text-xs">
                        <User className="h-3 w-3 text-muted-foreground" />
                        <span>User: {log.userId}</span>
                      </div>
                    )}
                    
                    {log.ipAddress && (
                      <div className="flex items-center gap-2 mt-1 text-xs">
                        <Server className="h-3 w-3 text-muted-foreground" />
                        <span>IP: {log.ipAddress}</span>
                      </div>
                    )}
                    
                    {Object.keys(log.details).length > 0 && (
                      <details className="mt-2">
                        <summary className="text-xs text-muted-foreground cursor-pointer">
                          Details ({Object.keys(log.details).length} items)
                        </summary>
                        <pre className="mt-1 text-xs bg-muted p-2 rounded overflow-x-auto">
                          {JSON.stringify(log.details, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Icons used in the component
function RefreshCw(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M3 3v5h5" />
    </svg>
  );
}

function Edit(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

function Settings(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}



function Eye(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export default ComplianceAuditViewer;
