// Advanced Settings Component
// Comprehensive settings management with theme, display, security and notification options

'use client';

import { Palette, Monitor, Shield, Bell, Save, Lock } from 'lucide-react';
import { useState, useEffect } from 'react';

import { useSettings } from '@/components/settings-provider';
import { useTheme } from '@/components/theme-provider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { hasRole, getSessionUser } from '@/lib/auth';

interface SecuritySettings {
  encryptionEnabled: boolean;
  twoFactorAuth: boolean;
  sessionTimeout: number;
  loginAttempts: number;
  ipWhitelist: string[];
}

interface NotificationSettings {
  emailNotifications: boolean;
  pushNotifications: boolean;
  soundEnabled: boolean;
  notificationFrequency: 'realtime' | 'hourly' | 'daily' | 'weekly';
  notificationTypes: {
    modelUpdates: boolean;
    usageAlerts: boolean;
    securityAlerts: boolean;
    featureAnnouncements: boolean;
  };
}

export default function AdvancedSettings() {
  const [activeTab, setActiveTab] = useState('appearance');
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Get theme and settings context
  const { setTheme } = useTheme();
  const {
    themeSettings,
    displaySettings,
    securitySettings,
    notificationSettings,
    updateThemeSettings,
    updateDisplaySettings,
    updateSecuritySettings,
    updateNotificationSettings,
  } = useSettings();

  // Load user role on component mount
  useEffect(() => {
    const loadUserRole = async () => {
      try {
        const user = await getSessionUser();
        if (user) {
          setUserRole(user.role || null);
        } else {
          setUserRole(null);
        }
      } catch (err) {
        console.error('Error loading user role:', err);
        setError('Failed to load user information');
      } finally {
        setLoading(false);
      }
    };

    void loadUserRole();
  }, []);

  // Handle saving settings changes
  const handleSave = async () => {
    try {
      // In a real implementation, this would sync with backend
      console.log('Settings saved successfully');
    } catch (err) {
      console.error('Error saving settings:', err);
      setError('Failed to save settings');
    }
  };

  // Handle theme change
  const handleThemeChange = (newTheme: string) => {
    setTheme(newTheme);
    updateDisplaySettings({ theme: newTheme as 'light' | 'dark' | 'system' });
  };

  // Handle font size change
  const handleFontSizeChange = (newSize: string) => {
    const size = newSize as 'sm' | 'md' | 'lg';
    updateDisplaySettings({ fontSize: size });
    updateThemeSettings({ fontSize: size });
  };

  // Handle primary color change
  const handlePrimaryColorChange = (color: string) => {
    updateThemeSettings({ primaryColor: color });
  };

  // Handle security settings change
  const handleSecurityChange = (key: keyof SecuritySettings, value: unknown) => {
    updateSecuritySettings({ [key]: value } as Partial<SecuritySettings>);
  };

  // Handle notification settings change
  const handleNotificationChange = (key: keyof NotificationSettings, value: unknown) => {
    updateNotificationSettings({ [key]: value } as Partial<NotificationSettings>);
  };

  // Handle notification type changes
  const handleNotificationTypeChange = (
    type: keyof NotificationSettings['notificationTypes'],
    value: boolean,
  ) => {
    updateNotificationSettings({
      notificationTypes: {
        ...notificationSettings.notificationTypes,
        [type]: value,
      },
    });
  };

  // Check if user has admin role
  const isAdmin = userRole && hasRole({ role: userRole }, ['admin']);

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl flex justify-center items-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading settings...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="bg-destructive/10 border border-destructive text-destructive p-4 rounded-lg">
          <h3 className="font-bold">Error</h3>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Palette className="h-8 w-8 text-primary" />
          Advanced Settings
        </h1>
        <p className="text-gray-400 mt-2">
          Customize your application experience and security preferences
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4 mb-8">
          <TabsTrigger value="appearance" className="flex items-center gap-2">
            <Palette className="h-4 w-4" />
            Appearance
          </TabsTrigger>
          <TabsTrigger value="display" className="flex items-center gap-2">
            <Monitor className="h-4 w-4" />
            Display
          </TabsTrigger>
          <TabsTrigger value="security" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Security
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Notifications
          </TabsTrigger>
        </TabsList>

        <TabsContent value="appearance">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5" />
                Theme Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Primary Color</Label>
                <div className="flex items-center gap-4">
                  <Input
                    type="color"
                    value={themeSettings.primaryColor}
                    onChange={(e) => handlePrimaryColorChange(e.target.value)}
                    className="w-16 h-10"
                  />
                  <span className="text-sm text-gray-500">{themeSettings.primaryColor}</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Font Size</Label>
                <Select value={displaySettings.fontSize} onValueChange={handleFontSizeChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sm">Small</SelectItem>
                    <SelectItem value="md">Medium</SelectItem>
                    <SelectItem value="lg">Large</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Border Radius</Label>
                <Slider
                  min={0}
                  max={20}
                  step={1}
                  value={[themeSettings.borderRadius]}
                  onValueChange={(value) => updateThemeSettings({ borderRadius: value[0] })}
                  className="w-full"
                />
                <div className="text-sm text-gray-500">{themeSettings.borderRadius}px</div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Animations</Label>
                  <p className="text-sm text-gray-400">Enable UI animations</p>
                </div>
                <Switch
                  checked={themeSettings.animations}
                  onCheckedChange={(checked) => updateThemeSettings({ animations: checked })}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="display">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Monitor className="h-5 w-5" />
                Display Options
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Theme</Label>
                <Select value={displaySettings.theme} onValueChange={handleThemeChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">Light</SelectItem>
                    <SelectItem value="dark">Dark</SelectItem>
                    <SelectItem value="system">System</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Compact Mode</Label>
                  <p className="text-sm text-gray-400">Dense UI layout</p>
                </div>
                <Switch
                  checked={displaySettings.compactMode}
                  onCheckedChange={(checked) => updateDisplaySettings({ compactMode: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Show Avatars</Label>
                  <p className="text-sm text-gray-400">Display user avatars</p>
                </div>
                <Switch
                  checked={displaySettings.showAvatars}
                  onCheckedChange={(checked) => updateDisplaySettings({ showAvatars: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Show Timestamps</Label>
                  <p className="text-sm text-gray-400">Display message timestamps</p>
                </div>
                <Switch
                  checked={displaySettings.showTimestamps}
                  onCheckedChange={(checked) => updateDisplaySettings({ showTimestamps: checked })}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Security Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label>End-to-End Encryption</Label>
                  <p className="text-sm text-gray-400">Encrypt data in transit</p>
                </div>
                <Switch
                  checked={securitySettings.encryptionEnabled}
                  onCheckedChange={(checked) => handleSecurityChange('encryptionEnabled', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Two-Factor Authentication</Label>
                  <p className="text-sm text-gray-400">Require additional verification</p>
                </div>
                <Switch
                  checked={securitySettings.twoFactorAuth}
                  onCheckedChange={(checked) => handleSecurityChange('twoFactorAuth', checked)}
                />
              </div>

              <div className="space-y-2">
                <Label>Session Timeout (minutes)</Label>
                <Slider
                  min={5}
                  max={120}
                  step={5}
                  value={[securitySettings.sessionTimeout]}
                  onValueChange={(value) => handleSecurityChange('sessionTimeout', value[0])}
                  className="w-full"
                />
                <div className="text-sm text-gray-500">
                  {securitySettings.sessionTimeout} minutes
                </div>
              </div>

              <div className="space-y-2">
                <Label>Max Login Attempts</Label>
                <Input
                  type="number"
                  min="1"
                  max="10"
                  value={securitySettings.loginAttempts}
                  onChange={(e) =>
                    handleSecurityChange('loginAttempts', parseInt(e.target.value, 10))
                  }
                  className="max-w-[150px]"
                />
              </div>
            </CardContent>
          </Card>

          {/* Admin-only security settings */}
          {isAdmin && (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lock className="h-5 w-5" />
                  Administrative Security
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <Label>IP Whitelist</Label>
                    <p className="text-sm text-gray-400 mb-2">
                      Comma-separated list of allowed IP addresses
                    </p>
                    <Input
                      value={securitySettings.ipWhitelist.join(', ')}
                      onChange={(e) =>
                        handleSecurityChange(
                          'ipWhitelist',
                          e.target.value.split(',').map((ip) => ip.trim()),
                        )
                      }
                      placeholder="e.g., 192.168.1.1, 10.0.0.0/8"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Activity Logging</Label>
                      <p className="text-sm text-gray-400">Log user activities</p>
                    </div>
                    <Switch checked={true} onCheckedChange={() => {}} disabled />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Notification Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Email Notifications</Label>
                  <p className="text-sm text-gray-400">Send notifications via email</p>
                </div>
                <Switch
                  checked={notificationSettings.emailNotifications}
                  onCheckedChange={(checked) =>
                    handleNotificationChange('emailNotifications', checked)
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Push Notifications</Label>
                  <p className="text-sm text-gray-400">Send browser notifications</p>
                </div>
                <Switch
                  checked={notificationSettings.pushNotifications}
                  onCheckedChange={(checked) =>
                    handleNotificationChange('pushNotifications', checked)
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Sound Enabled</Label>
                  <p className="text-sm text-gray-400">Play notification sounds</p>
                </div>
                <Switch
                  checked={notificationSettings.soundEnabled}
                  onCheckedChange={(checked) => handleNotificationChange('soundEnabled', checked)}
                />
              </div>

              <div className="space-y-2">
                <Label>Notification Frequency</Label>
                <Select
                  value={notificationSettings.notificationFrequency}
                  onValueChange={(value) =>
                    handleNotificationChange('notificationFrequency', value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="realtime">Real-time</SelectItem>
                    <SelectItem value="hourly">Hourly</SelectItem>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Notification Types</Label>
                <div className="space-y-4 mt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Model Updates</Label>
                      <p className="text-sm text-gray-400">Notify about new models</p>
                    </div>
                    <Switch
                      checked={notificationSettings.notificationTypes.modelUpdates}
                      onCheckedChange={(checked) =>
                        handleNotificationTypeChange('modelUpdates', checked)
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Usage Alerts</Label>
                      <p className="text-sm text-gray-400">Notify about high usage</p>
                    </div>
                    <Switch
                      checked={notificationSettings.notificationTypes.usageAlerts}
                      onCheckedChange={(checked) =>
                        handleNotificationTypeChange('usageAlerts', checked)
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Security Alerts</Label>
                      <p className="text-sm text-gray-400">Notify about security events</p>
                    </div>
                    <Switch
                      checked={notificationSettings.notificationTypes.securityAlerts}
                      onCheckedChange={(checked) =>
                        handleNotificationTypeChange('securityAlerts', checked)
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Feature Announcements</Label>
                      <p className="text-sm text-gray-400">Notify about new features</p>
                    </div>
                    <Switch
                      checked={notificationSettings.notificationTypes.featureAnnouncements}
                      onCheckedChange={(checked) =>
                        handleNotificationTypeChange('featureAnnouncements', checked)
                      }
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end mt-8">
        <Button onClick={handleSave} className="flex items-center gap-2">
          <Save className="h-4 w-4" />
          Save All Settings
        </Button>
      </div>
    </div>
  );
}