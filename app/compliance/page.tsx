import { Metadata } from 'next';
import { ComplianceDashboard } from '@/components/compliance/compliance-dashboard';
import { ComplianceSettings } from '@/components/compliance/compliance-settings';
import { ComplianceAuditViewer } from '@/components/compliance/compliance-audit-viewer';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Shield, 
  Settings, 
  Activity, 
  FileText, 
  Users, 
  Calendar,
  BarChart3
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Compliance Dashboard',
  description: 'Manage GDPR/CCPA compliance settings and view audit logs',
};

export default function CompliancePage() {
  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <h1 className="heading-underline text-4xl font-bold">Compliance Center</h1>
        <p className="text-muted-foreground mt-2">
          Manage data protection compliance, audit logs, and user privacy settings
        </p>
      </div>
      
      <Tabs defaultValue="dashboard" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="dashboard" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Settings
          </TabsTrigger>
          <TabsTrigger value="audit" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Audit Logs
          </TabsTrigger>
          <TabsTrigger value="reports" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Reports
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="dashboard" className="mt-6">
          <ComplianceDashboard />
        </TabsContent>
        
        <TabsContent value="settings" className="mt-6">
          <ComplianceSettings />
        </TabsContent>
        
        <TabsContent value="audit" className="mt-6">
          <ComplianceAuditViewer />
        </TabsContent>
        
        <TabsContent value="reports" className="mt-6">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Compliance Reports
              </CardTitle>
              <CardDescription>
                Generate and download compliance reports for regulatory bodies
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <Card className="border-dashed border-2 hover:border-primary transition-colors">
                  <CardHeader>
                    <CardTitle className="text-lg">GDPR Compliance Report</CardTitle>
                    <CardDescription>
                      Generate a comprehensive GDPR compliance report
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <button className="w-full p-4 border rounded-lg hover:bg-accent transition-colors text-left">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">Generate Report</p>
                          <p className="text-sm text-muted-foreground">Last generated: Never</p>
                        </div>
                        <Calendar className="h-5 w-5 text-muted-foreground" />
                      </div>
                    </button>
                  </CardContent>
                </Card>
                
                <Card className="border-dashed border-2 hover:border-primary transition-colors">
                  <CardHeader>
                    <CardTitle className="text-lg">CCPA Compliance Report</CardTitle>
                    <CardDescription>
                      Generate a comprehensive CCPA compliance report
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <button className="w-full p-4 border rounded-lg hover:bg-accent transition-colors text-left">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">Generate Report</p>
                          <p className="text-sm text-muted-foreground">Last generated: Never</p>
                        </div>
                        <Calendar className="h-5 w-5 text-muted-foreground" />
                      </div>
                    </button>
                  </CardContent>
                </Card>
                
                <Card className="border-dashed border-2 hover:border-primary transition-colors">
                  <CardHeader>
                    <CardTitle className="text-lg">Data Subject Access</CardTitle>
                    <CardDescription>
                      View and manage data subject access requests
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <button className="w-full p-4 border rounded-lg hover:bg-accent transition-colors text-left">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">Manage Requests</p>
                          <p className="text-sm text-muted-foreground">0 pending requests</p>
                        </div>
                        <Users className="h-5 w-5 text-muted-foreground" />
                      </div>
                    </button>
                  </CardContent>
                </Card>
              </div>
              
              <div className="p-4 border rounded-lg bg-yellow-50 dark:bg-yellow-900/20">
                <div className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-yellow-500" />
                  <h3 className="font-medium">Compliance Reporting</h3>
                </div>
                <p className="text-sm mt-2">
                  Compliance reports will be generated here with detailed information about your 
                  organization&apos;s adherence to data protection regulations. Reports include:
                </p>
                <ul className="text-sm mt-2 ml-4 list-disc space-y-1">
                  <li>Data processing activities</li>
                  <li>User consent records</li>
                  <li>Data retention and deletion practices</li>
                  <li>Audit log summaries</li>
                  <li>Security incident reports</li>
                  <li>Third-party data processor agreements</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}