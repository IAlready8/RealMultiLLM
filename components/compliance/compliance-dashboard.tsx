'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Shield, 
  FileText, 
  Trash2, 
  Clock, 
  AlertTriangle, 
  CheckCircle, 
  XCircle,
  Download,
  Eye,
  Users,
  User,
  Activity,
  RefreshCw,
  Key,
  Database,
  Loader2,
  BarChart3
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { ComplianceMetrics, ComplianceStatus } from '@/types/compliance';
import { format } from 'date-fns';

// Constants for data subject rights
const DATA_SUBJECT_RIGHTS = [
  'right_to_access',
  'right_to_rectification', 
  'right_to_erasure',
  'right_to_restrict',
  'right_to_portability',
  'right_to_object',
  'right_to_information',
  'right_to_complaint'
] as const;

/**
 * Compliance Dashboard Component
 * Provides a comprehensive UI for managing GDPR/CCPA compliance
 */

export function ComplianceDashboard() {
  const { toast } = useToast();
  const [metrics, setMetrics] = useState<ComplianceMetrics | null>(null);
  const [status, setStatus] = useState<ComplianceStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [exportLoading, setExportLoading] = useState(false);
  const [deletionLoading, setDeletionLoading] = useState(false);

  const fetchComplianceData = useCallback(async () => {
    try {
      setLoading(true);
      
      // In a real implementation, this would fetch from the API
      // For now, we'll use mock data to demonstrate the UI
      const mockMetrics: ComplianceMetrics = {
        totalUsers: 1247,
        consentRate: 98.2,
        pendingDeletionRequests: 3,
        recentAuditEvents: 12478,
        highRiskEvents: 5,
        complianceScore: 94,
        gdprCompliance: {
          regulation: 'gdpr',
          status: 'compliant',
          lastChecked: new Date(),
          nextCheck: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          issues: [],
          remediationSteps: []
        },
        ccpaCompliance: {
          regulation: 'ccpa',
          status: 'partially_compliant',
          lastChecked: new Date(),
          nextCheck: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          issues: ['Missing opt-out mechanism for data sales'],
          remediationSteps: ['Implement data sale opt-out feature']
        },
        lastReportGenerated: new Date(Date.now() - 24 * 60 * 60 * 1000)
      };

      const mockStatus: ComplianceStatus[] = [
        {
          regulation: 'gdpr',
          status: 'compliant',
          lastChecked: new Date(),
          nextCheck: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          issues: [],
          remediationSteps: []
        },
        {
          regulation: 'ccpa',
          status: 'partially_compliant',
          lastChecked: new Date(),
          nextCheck: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          issues: ['Missing opt-out mechanism for data sales'],
          remediationSteps: ['Implement data sale opt-out feature']
        }
      ];

      setMetrics(mockMetrics);
      setStatus(mockStatus);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load compliance data',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void fetchComplianceData();
  }, [fetchComplianceData]);

  const handleExportRequest = async () => {
    try {
      setExportLoading(true);
      
      // In a real implementation, this would call the API
      // await complianceService.exportUserData(userId);
      
      toast({
        title: 'Export Requested',
        description: 'Your data export has been requested and will be available shortly.'
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to request data export',
        variant: 'destructive'
      });
    } finally {
      setExportLoading(false);
    }
  };

  const handleDeletionRequest = async () => {
    try {
      setDeletionLoading(true);
      
      // In a real implementation, this would call the API
      // await complianceService.requestDataDeletion(userId);
      
      toast({
        title: 'Deletion Requested',
        description: 'Your data deletion request has been submitted for review.'
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to request data deletion',
        variant: 'destructive'
      });
    } finally {
      setDeletionLoading(false);
    }
  };

  const getStatusIcon = (status: ComplianceStatus['status']) => {
    switch (status) {
      case 'compliant':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'partially_compliant':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'non_compliant':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: ComplianceStatus['status']) => {
    switch (status) {
      case 'compliant':
        return <Badge className="bg-green-500 hover:bg-green-600">Compliant</Badge>;
      case 'partially_compliant':
        return <Badge className="bg-yellow-500 hover:bg-yellow-600">Partially Compliant</Badge>;
      case 'non_compliant':
        return <Badge className="bg-red-500 hover:bg-red-600">Non-Compliant</Badge>;
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="heading-underline text-3xl font-bold">Compliance Dashboard</h1>
          <div className="flex items-center space-x-2">
            <div className="h-8 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
            <div className="h-8 w-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
          </div>
        </div>
        
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="glass-card">
              <CardHeader className="pb-2">
                <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
              </CardHeader>
              <CardContent>
                <div className="h-8 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
              </CardContent>
            </Card>
          ))}
        </div>
        
        <Card className="glass-card">
          <CardHeader>
            <div className="h-6 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
          </CardHeader>
          <CardContent>
            <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="heading-underline text-3xl font-bold flex items-center gap-2">
          <Shield className="h-8 w-8" />
          Compliance Dashboard
        </h1>
        <div className="flex items-center space-x-2">
          <Badge variant="outline" className="text-sm">
            Last Updated: {metrics?.lastReportGenerated ? format(metrics.lastReportGenerated, 'MMM d, yyyy') : 'Never'}
          </Badge>
          <Button variant="outline" size="icon">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      {/* Compliance Score */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="glass-card hover:glass-card-hover transition-all">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Compliance Score</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.complianceScore ?? 0}%</div>
            <p className="text-xs text-muted-foreground">
              Overall compliance health
            </p>
          </CardContent>
        </Card>
        
        <Card className="glass-card hover:glass-card-hover transition-all">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.totalUsers?.toLocaleString() ?? 0}</div>
            <p className="text-xs text-muted-foreground">
              Registered user accounts
            </p>
          </CardContent>
        </Card>
        
        <Card className="glass-card hover:glass-card-hover transition-all">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Consent Rate</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.consentRate ?? 0}%</div>
            <p className="text-xs text-muted-foreground">
              Users with active consent
            </p>
          </CardContent>
        </Card>
        
        <Card className="glass-card hover:glass-card-hover transition-all">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Deletions</CardTitle>
            <Trash2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.pendingDeletionRequests ?? 0}</div>
            <p className="text-xs text-muted-foreground">
              Awaiting approval
            </p>
          </CardContent>
        </Card>
      </div>
      
      {/* Compliance Status Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="regulations">Regulations</TabsTrigger>
          <TabsTrigger value="audit">Audit Logs</TabsTrigger>
          <TabsTrigger value="actions">Actions</TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview" className="space-y-6">
          {/* Regulation Status */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Regulation Compliance Status
              </CardTitle>
              <CardDescription>
                Current compliance status across major data protection regulations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {status.map((regulationStatus) => (
                  <div key={regulationStatus.regulation} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-3">
                      {getStatusIcon(regulationStatus.status)}
                      <div>
                        <h3 className="font-medium capitalize">{regulationStatus.regulation}</h3>
                        <p className="text-sm text-muted-foreground">
                          Last checked: {format(regulationStatus.lastChecked, 'MMM d, yyyy')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {getStatusBadge(regulationStatus.status)}
                      {regulationStatus.nextCheck && (
                        <Badge variant="outline">
                          Next check: {format(regulationStatus.nextCheck, 'MMM d')}
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          
          {/* Data Subject Rights Summary */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Data Subject Rights
              </CardTitle>
              <CardDescription>
                Tracking of user exercise of their data protection rights
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {DATA_SUBJECT_RIGHTS.map((right) => (
                  <div key={right} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="font-medium text-sm capitalize">
                      {right.replace(/_/g, ' ')}
                    </div>
                    <Badge variant="secondary">
                      {Math.floor(Math.random() * 100)} requests
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="regulations" className="space-y-6">
          {/* GDPR Compliance */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-blue-500" />
                GDPR Compliance
              </CardTitle>
              <CardDescription>
                General Data Protection Regulation (EU) compliance status
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="font-medium">Status</div>
                <Badge className="bg-green-500 hover:bg-green-600">Compliant</Badge>
              </div>
              
              <Separator />
              
              <div className="space-y-2">
                <h4 className="font-medium">Compliance Checks</h4>
                <ul className="space-y-1 text-sm">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    Data minimization practices
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    Purpose limitation enforcement
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    Consent management system
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    Data portability implementation
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    Right to erasure procedures
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    Data breach notification process
                  </li>
                </ul>
              </div>
              
              <Separator />
              
              <div className="space-y-2">
                <h4 className="font-medium">Data Processing Activities</h4>
                <div className="text-sm space-y-1">
                  <p><strong>Controller:</strong> Your Organization Name</p>
                  <p><strong>Processor:</strong> Third-party LLM providers</p>
                  <p><strong>Purposes:</strong> AI assistant services, analytics, personalization</p>
                  <p><strong>Data Categories:</strong> User profiles, conversation history, usage analytics</p>
                  <p><strong>Retention:</strong> 7 years unless earlier deletion requested</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* CCPA Compliance */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-purple-500" />
                CCPA Compliance
              </CardTitle>
              <CardDescription>
                California Consumer Privacy Act compliance status
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="font-medium">Status</div>
                <Badge className="bg-yellow-500 hover:bg-yellow-600">Partially Compliant</Badge>
              </div>
              
              <Separator />
              
              <div className="space-y-2">
                <h4 className="font-medium">Required Improvements</h4>
                <ul className="space-y-1 text-sm">
                  <li className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-yellow-500" />
                    Implement opt-out mechanism for data sales
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    Right to know implementation
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    Right to delete procedures
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    Non-discrimination policy
                  </li>
                </ul>
              </div>
              
              <Separator />
              
              <div className="space-y-2">
                <h4 className="font-medium">Consumer Rights</h4>
                <div className="text-sm space-y-1">
                  <p><strong>Right to Know:</strong> Implemented via data export feature</p>
                  <p><strong>Right to Delete:</strong> Implemented via deletion request process</p>
                  <p><strong>Right to Opt-Out:</strong> Pending implementation</p>
                  <p><strong>Non-Discrimination:</strong> Policy in place</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="audit" className="space-y-6">
          {/* Recent Audit Events */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Recent Audit Events
              </CardTitle>
              <CardDescription>
                Security and compliance-related events from the past 24 hours
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 border rounded-lg">
                    <div className="mt-1">
                      {i % 3 === 0 ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : i % 3 === 1 ? (
                        <AlertTriangle className="h-4 w-4 text-yellow-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium text-sm">
                          {i % 3 === 0 ? 'Data Export Requested' : 
                           i % 3 === 1 ? 'Login Attempt' : 
                           'API Key Accessed'}
                        </h4>
                        <Badge variant="outline" className="text-xs">
                          {format(new Date(Date.now() - i * 3600000), 'HH:mm')}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {i % 3 === 0 ? `User ${Math.floor(Math.random() * 1000)} requested data export` : 
                         i % 3 === 1 ? `Successful login from IP 192.168.1.${Math.floor(Math.random() * 255)}` : 
                         `API key for provider accessed by admin`}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="secondary" className="text-xs">
                          {i % 3 === 0 ? 'data_access' : 
                           i % 3 === 1 ? 'authentication' : 
                           'api_key_management'}
                        </Badge>
                        <Badge variant={i % 3 === 0 ? 'default' : i % 3 === 1 ? 'secondary' : 'destructive'} className="text-xs">
                          {i % 3 === 0 ? 'low' : 
                           i % 3 === 1 ? 'medium' : 
                           'high'}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
                
                <div className="text-center pt-4">
                  <Button variant="outline">View All Audit Events</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="actions" className="space-y-6">
          {/* User Data Actions */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Data Subject Rights Actions
              </CardTitle>
              <CardDescription>
                Exercise your rights under data protection regulations
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <Card className="border-dashed border-2 hover:border-primary transition-colors">
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <Download className="h-5 w-5 text-primary" />
                      <CardTitle className="text-lg">Export My Data</CardTitle>
                    </div>
                    <CardDescription>
                      Request a copy of all personal data we hold about you
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button 
                      className="w-full"
                      onClick={handleExportRequest}
                      disabled={exportLoading}
                    >
                      {exportLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <Download className="mr-2 h-4 w-4" />
                          Request Data Export
                        </>
                      )}
                    </Button>
                    <p className="text-xs text-muted-foreground mt-2">
                      Receive a machine-readable copy of your personal data in JSON format
                    </p>
                  </CardContent>
                </Card>
                
                <Card className="border-dashed border-2 hover:border-destructive transition-colors">
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <Trash2 className="h-5 w-5 text-destructive" />
                      <CardTitle className="text-lg">Delete My Data</CardTitle>
                    </div>
                    <CardDescription>
                      Request permanent deletion of your personal data
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button 
                      variant="destructive"
                      className="w-full"
                      onClick={handleDeletionRequest}
                      disabled={deletionLoading}
                    >
                      {deletionLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <Trash2 className="mr-2 h-4 w-4" />
                          Request Data Deletion
                        </>
                      )}
                    </Button>
                    <p className="text-xs text-muted-foreground mt-2">
                      All personal data will be permanently removed from our systems
                    </p>
                  </CardContent>
                </Card>
              </div>
              
              <Separator />
              
              <div className="space-y-4">
                <h3 className="font-medium text-lg">Consent Management</h3>
                
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Eye className="h-5 w-5" />
                    <div>
                      <h4 className="font-medium">Marketing Communications</h4>
                      <p className="text-sm text-muted-foreground">
                        Receive promotional emails and updates
                      </p>
                    </div>
                  </div>
                  <Badge className="bg-green-500 hover:bg-green-600">Consented</Badge>
                </div>
                
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Database className="h-5 w-5" />
                    <div>
                      <h4 className="font-medium">Analytics Collection</h4>
                      <p className="text-sm text-muted-foreground">
                        Collect usage data for product improvement
                      </p>
                    </div>
                  </div>
                  <Badge className="bg-green-500 hover:bg-green-600">Consented</Badge>
                </div>
                
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Key className="h-5 w-5" />
                    <div>
                      <h4 className="font-medium">Third-Party Sharing</h4>
                      <p className="text-sm text-muted-foreground">
                        Share data with trusted partners
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline">Not Consented</Badge>
                </div>
                
                <div className="text-center pt-4">
                  <Button variant="outline">Manage All Consents</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default ComplianceDashboard;
