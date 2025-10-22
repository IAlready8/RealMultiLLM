'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
  EyeOff,
  Calendar,
  User,
  Key,
  Database,
  Server,
  BarChart3,
  Activity,
  Users,
  Zap,
  Save as SaveIcon,
  RotateCcw as RotateCcwIcon
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { format } from 'date-fns';

/**
 * Compliance Settings Component
 * Manages GDPR/CCPA compliance configuration and data retention policies
 */

export function ComplianceSettings() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    dataRetentionPeriod: 2555, // 7 years
    exportFormat: 'json',
    notificationEmail: '',
    enableAuditLogging: true,
    enableDataEncryption: true,
    enableConsentManagement: true,
    defaultDataRetentionDays: 90,
    enableAutomaticExports: false,
    exportNotificationEmail: '',
    enableDeletionConfirmation: true,
    requireAdminApprovalForDeletion: true,
    enableComplianceReporting: true,
    complianceReportFrequency: 'weekly',
    enableRegulatoryComplianceChecks: true,
    regulations: ['gdpr', 'ccpa'],
    consentText: 'I consent to the processing of my personal data in accordance with the privacy policy.',
    consentVersion: '1.0'
  });

  const fetchComplianceSettings = useCallback(async () => {
    try {
      setLoading(true);
      
      // In a real implementation, this would fetch from the API
      // For now, we'll use mock data to demonstrate the UI
      const mockSettings = {
        dataRetentionPeriod: 2555,
        exportFormat: 'json',
        notificationEmail: 'compliance@example.com',
        enableAuditLogging: true,
        enableDataEncryption: true,
        enableConsentManagement: true,
        defaultDataRetentionDays: 90,
        enableAutomaticExports: false,
        exportNotificationEmail: 'exports@example.com',
        enableDeletionConfirmation: true,
        requireAdminApprovalForDeletion: true,
        enableComplianceReporting: true,
        complianceReportFrequency: 'weekly',
        enableRegulatoryComplianceChecks: true,
        regulations: ['gdpr', 'ccpa'],
        consentText: 'I consent to the processing of my personal data in accordance with the privacy policy.',
        consentVersion: '1.0'
      };

      setFormData(mockSettings);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load compliance settings',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void fetchComplianceSettings();
  }, [fetchComplianceSettings]);

  const handleSave = async () => {
    try {
      setSaving(true);
      
      // In a real implementation, this would save to the API
      // await complianceService.updateComplianceConfig(userId, formData);
      
      toast({
        title: 'Settings Saved',
        description: 'Compliance settings have been updated successfully.'
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save compliance settings',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setFormData({
      dataRetentionPeriod: 2555,
      exportFormat: 'json',
      notificationEmail: '',
      enableAuditLogging: true,
      enableDataEncryption: true,
      enableConsentManagement: true,
      defaultDataRetentionDays: 90,
      enableAutomaticExports: false,
      exportNotificationEmail: '',
      enableDeletionConfirmation: true,
      requireAdminApprovalForDeletion: true,
      enableComplianceReporting: true,
      complianceReportFrequency: 'weekly',
      enableRegulatoryComplianceChecks: true,
      regulations: ['gdpr', 'ccpa'],
      consentText: 'I consent to the processing of my personal data in accordance with the privacy policy.',
      consentVersion: '1.0'
    });
  };

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const toggleRegulation = (regulation: string) => {
    setFormData(prev => {
      const regulations = prev.regulations.includes(regulation)
        ? prev.regulations.filter(r => r !== regulation)
        : [...prev.regulations, regulation];
      
      return {
        ...prev,
        regulations
      };
    });
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="heading-underline text-3xl font-bold">Compliance Settings</h1>
          <div className="flex items-center space-x-2">
            <div className="h-8 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
          </div>
        </div>
        
        <div className="grid gap-6">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="glass-card">
              <CardHeader>
                <div className="h-6 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
              </CardHeader>
              <CardContent className="space-y-4">
                {[...Array(4)].map((_, j) => (
                  <div key={j} className="flex items-center justify-between">
                    <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                    <div className="h-6 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="heading-underline text-3xl font-bold flex items-center gap-2">
          <Shield className="h-8 w-8" />
          Compliance Settings
        </h1>
        <div className="flex items-center space-x-2">
          <Button variant="outline" onClick={handleReset}>
            <RotateCcwIcon className="h-4 w-4 mr-2" />
            Reset
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <SaveIcon className="h-4 w-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </div>
      
      <div className="grid gap-6">
        {/* Data Retention Policy */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Data Retention Policy
            </CardTitle>
            <CardDescription>
              Configure how long user data is retained and when it's automatically deleted
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="dataRetentionPeriod">Default Retention Period (days)</Label>
                <Input
                  id="dataRetentionPeriod"
                  type="number"
                  value={formData.dataRetentionPeriod}
                  onChange={(e) => handleChange('dataRetentionPeriod', parseInt(e.target.value) || 0)}
                  min="1"
                  max="7300" // ~20 years
                />
                <p className="text-sm text-muted-foreground">
                  {formData.dataRetentionPeriod === 2555 
                    ? '7 years (GDPR recommendation)' 
                    : `${Math.round(formData.dataRetentionPeriod / 365 * 10) / 10} years`}
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="defaultDataRetentionDays">Short-term Retention (days)</Label>
                <Input
                  id="defaultDataRetentionDays"
                  type="number"
                  value={formData.defaultDataRetentionDays}
                  onChange={(e) => handleChange('defaultDataRetentionDays', parseInt(e.target.value) || 0)}
                  min="1"
                  max="365"
                />
                <p className="text-sm text-muted-foreground">
                  Used for temporary data like session logs
                </p>
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-base">Automated Cleanup</Label>
                <p className="text-sm text-muted-foreground">
                  Automatically delete data older than retention period
                </p>
              </div>
              <Switch
                checked={true}
                disabled
              />
            </div>
          </CardContent>
        </Card>
        
        {/* Export Configuration */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              Data Export Configuration
            </CardTitle>
            <CardDescription>
              Configure how user data is exported for compliance requests
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="exportFormat">Default Export Format</Label>
                <select
                  id="exportFormat"
                  className="w-full p-2 border rounded-md bg-background"
                  value={formData.exportFormat}
                  onChange={(e) => handleChange('exportFormat', e.target.value)}
                >
                  <option value="json">JSON (Machine-readable)</option>
                  <option value="csv">CSV (Spreadsheet)</option>
                </select>
                <p className="text-sm text-muted-foreground">
                  Format used for data subject access requests
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="exportNotificationEmail">Export Notification Email</Label>
                <Input
                  id="exportNotificationEmail"
                  type="email"
                  value={formData.exportNotificationEmail}
                  onChange={(e) => handleChange('exportNotificationEmail', e.target.value)}
                  placeholder="compliance@example.com"
                />
                <p className="text-sm text-muted-foreground">
                  Email to receive notifications about export requests
                </p>
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-base">Enable Automatic Exports</Label>
                <p className="text-sm text-muted-foreground">
                  Generate compliance exports on a schedule
                </p>
              </div>
              <Switch
                checked={formData.enableAutomaticExports}
                onCheckedChange={(checked) => handleChange('enableAutomaticExports', checked)}
              />
            </div>
            
            {formData.enableAutomaticExports && (
              <div className="space-y-2">
                <Label htmlFor="complianceReportFrequency">Export Frequency</Label>
                <select
                  id="complianceReportFrequency"
                  className="w-full p-2 border rounded-md bg-background"
                  value={formData.complianceReportFrequency}
                  onChange={(e) => handleChange('complianceReportFrequency', e.target.value)}
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                </select>
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Consent Management */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5" />
              Consent Management
            </CardTitle>
            <CardDescription>
              Configure how user consent is collected and managed
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-base">Enable Consent Management</Label>
                <p className="text-sm text-muted-foreground">
                  Require and track user consent for data processing
                </p>
              </div>
              <Switch
                checked={formData.enableConsentManagement}
                onCheckedChange={(checked) => handleChange('enableConsentManagement', checked)}
              />
            </div>
            
            {formData.enableConsentManagement && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="consentText">Consent Text</Label>
                  <Textarea
                    id="consentText"
                    value={formData.consentText}
                    onChange={(e) => handleChange('consentText', e.target.value)}
                    rows={4}
                  />
                  <p className="text-sm text-muted-foreground">
                    Text displayed to users when requesting consent
                  </p>
                </div>
                
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="consentVersion">Consent Version</Label>
                    <Input
                      id="consentVersion"
                      value={formData.consentVersion}
                      onChange={(e) => handleChange('consentVersion', e.target.value)}
                      placeholder="1.0"
                    />
                    <p className="text-sm text-muted-foreground">
                      Version number for consent tracking
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Consent Types</Label>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary">Necessary</Badge>
                      <Badge variant="secondary">Analytics</Badge>
                      <Badge variant="secondary">Marketing</Badge>
                      <Badge variant="secondary">Functional</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Configure different consent categories
                    </p>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
        
        {/* Regulatory Compliance */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Regulatory Compliance
            </CardTitle>
            <CardDescription>
              Enable compliance with specific data protection regulations
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-base">Enable Compliance Checks</Label>
                <p className="text-sm text-muted-foreground">
                  Automatically verify compliance with enabled regulations
                </p>
              </div>
              <Switch
                checked={formData.enableRegulatoryComplianceChecks}
                onCheckedChange={(checked) => handleChange('enableRegulatoryComplianceChecks', checked)}
              />
            </div>
            
            {formData.enableRegulatoryComplianceChecks && (
              <div className="space-y-4">
                <Label>Enabled Regulations</Label>
                <div className="grid gap-4 md:grid-cols-2">
                  <div 
                    className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                      formData.regulations.includes('gdpr') 
                        ? 'border-primary bg-primary/10' 
                        : 'border-border hover:border-primary/50'
                    }`}
                    onClick={() => toggleRegulation('gdpr')}
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-medium">GDPR</div>
                      <Badge variant={formData.regulations.includes('gdpr') ? 'default' : 'outline'}>
                        {formData.regulations.includes('gdpr') ? 'Enabled' : 'Disabled'}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">
                      General Data Protection Regulation (EU)
                    </p>
                    <ul className="text-xs text-muted-foreground mt-2 space-y-1">
                      <li className="flex items-center gap-1">
                        <CheckCircle className="h-3 w-3 text-green-500" />
                        Data minimization
                      </li>
                      <li className="flex items-center gap-1">
                        <CheckCircle className="h-3 w-3 text-green-500" />
                        Purpose limitation
                      </li>
                      <li className="flex items-center gap-1">
                        <CheckCircle className="h-3 w-3 text-green-500" />
                        Consent management
                      </li>
                      <li className="flex items-center gap-1">
                        <CheckCircle className="h-3 w-3 text-green-500" />
                        Data portability
                      </li>
                      <li className="flex items-center gap-1">
                        <CheckCircle className="h-3 w-3 text-green-500" />
                        Right to erasure
                      </li>
                    </ul>
                  </div>
                  
                  <div 
                    className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                      formData.regulations.includes('ccpa') 
                        ? 'border-primary bg-primary/10' 
                        : 'border-border hover:border-primary/50'
                    }`}
                    onClick={() => toggleRegulation('ccpa')}
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-medium">CCPA</div>
                      <Badge variant={formData.regulations.includes('ccpa') ? 'default' : 'outline'}>
                        {formData.regulations.includes('ccpa') ? 'Enabled' : 'Disabled'}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">
                      California Consumer Privacy Act
                    </p>
                    <ul className="text-xs text-muted-foreground mt-2 space-y-1">
                      <li className="flex items-center gap-1">
                        <CheckCircle className="h-3 w-3 text-green-500" />
                        Right to know
                      </li>
                      <li className="flex items-center gap-1">
                        <CheckCircle className="h-3 w-3 text-green-500" />
                        Right to delete
                      </li>
                      <li className="flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3 text-yellow-500" />
                        Right to opt-out (pending)
                      </li>
                      <li className="flex items-center gap-1">
                        <CheckCircle className="h-3 w-3 text-green-500" />
                        Non-discrimination
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Reporting */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Compliance Reporting
            </CardTitle>
            <CardDescription>
              Configure automated compliance reports and notifications
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-base">Enable Compliance Reports</Label>
                <p className="text-sm text-muted-foreground">
                  Generate regular compliance status reports
                </p>
              </div>
              <Switch
                checked={formData.enableComplianceReporting}
                onCheckedChange={(checked) => handleChange('enableComplianceReporting', checked)}
              />
            </div>
            
            {formData.enableComplianceReporting && (
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="complianceReportFrequency">Report Frequency</Label>
                  <select
                    id="complianceReportFrequency"
                    className="w-full p-2 border rounded-md bg-background"
                    value={formData.complianceReportFrequency}
                    onChange={(e) => handleChange('complianceReportFrequency', e.target.value)}
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                  </select>
                  <p className="text-sm text-muted-foreground">
                    How often compliance reports are generated
                  </p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="notificationEmail">Report Notification Email</Label>
                  <Input
                    id="notificationEmail"
                    type="email"
                    value={formData.notificationEmail}
                    onChange={(e) => handleChange('notificationEmail', e.target.value)}
                    placeholder="compliance@example.com"
                  />
                  <p className="text-sm text-muted-foreground">
                    Email to receive compliance reports
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Deletion Configuration */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5" />
              Data Deletion Configuration
            </CardTitle>
            <CardDescription>
              Configure how user data deletion requests are handled
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-base">Require Deletion Confirmation</Label>
                <p className="text-sm text-muted-foreground">
                  Users must confirm deletion requests before processing
                </p>
              </div>
              <Switch
                checked={formData.enableDeletionConfirmation}
                onCheckedChange={(checked) => handleChange('enableDeletionConfirmation', checked)}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-base">Require Admin Approval</Label>
                <p className="text-sm text-muted-foreground">
                  Admin review required for all deletion requests
                </p>
              </div>
              <Switch
                checked={formData.requireAdminApprovalForDeletion}
                onCheckedChange={(checked) => handleChange('requireAdminApprovalForDeletion', checked)}
              />
            </div>
            
            <div className="p-4 border rounded-lg bg-yellow-50 dark:bg-yellow-900/20">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
                <h4 className="font-medium">Deletion Process</h4>
              </div>
              <p className="text-sm mt-2">
                When a user requests data deletion:
              </p>
              <ol className="text-sm mt-2 ml-4 list-decimal space-y-1">
                <li>Deletion request is logged in audit trail</li>
                <li>{formData.enableDeletionConfirmation ? 'User receives confirmation email' : 'Deletion processed immediately'}</li>
                <li>{formData.requireAdminApprovalForDeletion ? 'Admin approval required' : 'Automatic processing'}</li>
                <li>All user data is permanently removed from the system</li>
                <li>Audit logs are retained for compliance purposes</li>
              </ol>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Icons used in the component
function Loader2(props: React.SVGProps<SVGSVGElement>) {
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
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

function RotateCcw(props: React.SVGProps<SVGSVGElement>) {
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
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
    </svg>
  );
}

function Save(props: React.SVGProps<SVGSVGElement>) {
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
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
      <polyline points="17 21 17 13 7 13 7 21" />
      <polyline points="7 3 7 8 15 8" />
    </svg>
  );
}

export default ComplianceSettings;
