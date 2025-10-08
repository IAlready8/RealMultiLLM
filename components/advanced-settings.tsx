"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Palette, 
  Type, 
  Monitor, 
  Shield,
  Bell,
  Download,
  Upload,
  Trash2,
  RefreshCw,
  Settings as SettingsIcon,
  Save,
  Zap,
  Layout,
  Lock,
  Sparkles
} from "lucide-react";
import { useTheme } from "next-themes";
import { useSettings } from "@/components/settings-provider";

export default function AdvancedSettings() {
  const { theme, setTheme } = useTheme();
  const {
    themeSettings,
    displaySettings,
    securitySettings,
    notificationSettings,
    updateThemeSettings,
    updateDisplaySettings,
    updateSecuritySettings,
    updateNotificationSettings,
    resetAllSettings
  } = useSettings();
  
  const [activeTab, setActiveTab] = useState("appearance");
  
  // Apply theme settings to document
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--primary", themeSettings.primaryColor);
    root.style.setProperty("--secondary", themeSettings.secondaryColor);
    root.style.setProperty("--accent", themeSettings.accentColor);
    
    // Apply font size
    const fontSizeMap = {
      sm: "0.875rem",
      md: "1rem",
      lg: "1.125rem"
    };
    root.style.fontSize = fontSizeMap[themeSettings.fontSize];
    
    // Apply border radius
    root.style.setProperty("--radius", `${themeSettings.borderRadius}px`);
  }, [themeSettings]);
  
  // Handle theme change
  const handleThemeChange = (value: "light" | "dark" | "system") => {
    setTheme(value);
    updateDisplaySettings({ theme: value });
  };
  
  const saveSettings = () => {
    // Settings are automatically saved to localStorage via the context provider
  };
  
  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-primary/10 rounded-lg">
            <SettingsIcon className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-3xl font-bold">Advanced Settings</h1>
        </div>
        <p className="text-gray-400">Customize your experience with advanced configuration options</p>
      </div>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5 mb-8 bg-gray-900/50 backdrop-blur-sm p-1 border border-gray-800">
          <TabsTrigger value="appearance" className="flex items-center gap-2 data-[state=active]:bg-primary/20">
            <Palette className="h-4 w-4" />
            Appearance
          </TabsTrigger>
          <TabsTrigger value="display" className="flex items-center gap-2 data-[state=active]:bg-primary/20">
            <Monitor className="h-4 w-4" />
            Display
          </TabsTrigger>
          <TabsTrigger value="security" className="flex items-center gap-2 data-[state=active]:bg-primary/20">
            <Shield className="h-4 w-4" />
            Security
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-2 data-[state=active]:bg-primary/20">
            <Bell className="h-4 w-4" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="advanced" className="flex items-center gap-2 data-[state=active]:bg-primary/20">
            <Zap className="h-4 w-4" />
            Advanced
          </TabsTrigger>
        </TabsList>
        
        {/* Appearance Settings */}
        <TabsContent value="appearance" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="bg-gray-900/50 border-gray-800 backdrop-blur-sm hover-lift transition-all">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Palette className="h-5 w-5 text-primary" />
                  Theme Colors
                </CardTitle>
                <CardDescription>Customize your color palette</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Primary Color</Label>
                  <Input 
                    type="color" 
                    value={themeSettings.primaryColor} 
                    onChange={(e) => updateThemeSettings({ primaryColor: e.target.value })}
                    className="w-16 h-10 cursor-pointer"
                  />
                  <div className="flex gap-2 mt-2">
                    <Badge variant="outline" className="px-3 py-1">
                      {themeSettings.primaryColor}
                    </Badge>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label>Secondary Color</Label>
                  <Input 
                    type="color" 
                    value={themeSettings.secondaryColor} 
                    onChange={(e) => updateThemeSettings({ secondaryColor: e.target.value })}
                    className="w-16 h-10 cursor-pointer"
                  />
                  <div className="flex gap-2 mt-2">
                    <Badge variant="outline" className="px-3 py-1">
                      {themeSettings.secondaryColor}
                    </Badge>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label>Accent Color</Label>
                  <Input 
                    type="color" 
                    value={themeSettings.accentColor} 
                    onChange={(e) => updateThemeSettings({ accentColor: e.target.value })}
                    className="w-16 h-10 cursor-pointer"
                  />
                  <div className="flex gap-2 mt-2">
                    <Badge variant="outline" className="px-3 py-1">
                      {themeSettings.accentColor}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-gray-900/50 border-gray-800 backdrop-blur-sm hover-lift transition-all">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Type className="h-5 w-5 text-primary" />
                  Typography & Layout
                </CardTitle>
                <CardDescription>Customize text and spacing options</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Font Size</Label>
                  <Select 
                    value={themeSettings.fontSize} 
                    onValueChange={(value: "sm" | "md" | "lg") => updateThemeSettings({ fontSize: value })}
                  >
                    <SelectTrigger className="bg-gray-800/50 border-gray-700">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-900 border-gray-800">
                      <SelectItem value="sm">Small</SelectItem>
                      <SelectItem value="md">Medium</SelectItem>
                      <SelectItem value="lg">Large</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label>Border Radius: {themeSettings.borderRadius}px</Label>
                  <Slider 
                    value={[themeSettings.borderRadius]} 
                    onValueChange={(value) => updateThemeSettings({ borderRadius: value[0] })}
                    min={0}
                    max={20}
                    step={1}
                  />
                  <p className="text-xs text-gray-500">Adjust the roundness of corners across all components</p>
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Compact Mode</Label>
                    <p className="text-xs text-gray-500">Reduce spacing and padding</p>
                  </div>
                  <Switch 
                    checked={themeSettings.compactMode}
                    onCheckedChange={(checked) => updateThemeSettings({ compactMode: checked })}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Enable Animations</Label>
                    <p className="text-xs text-gray-500">Smooth transitions and hover effects</p>
                  </div>
                  <Switch 
                    checked={themeSettings.animations}
                    onCheckedChange={(checked) => updateThemeSettings({ animations: checked })}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        {/* Display Settings */}
        <TabsContent value="display" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="bg-gray-900/50 border-gray-800 backdrop-blur-sm hover-lift transition-all">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Monitor className="h-5 w-5 text-primary" />
                  Theme & Display
                </CardTitle>
                <CardDescription>Appearance and display preferences</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Theme</Label>
                  <Select 
                    value={displaySettings.theme} 
                    onValueChange={(value: "light" | "dark" | "system") => handleThemeChange(value)}
                  >
                    <SelectTrigger className="bg-gray-800/50 border-gray-700">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-900 border-gray-800">
                      <SelectItem value="light">Light</SelectItem>
                      <SelectItem value="dark">Dark</SelectItem>
                      <SelectItem value="system">System</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Show Avatars</Label>
                    <p className="text-xs text-gray-500">Display user avatars in conversations</p>
                  </div>
                  <Switch 
                    checked={displaySettings.showAvatars}
                    onCheckedChange={(checked) => updateDisplaySettings({ showAvatars: checked })}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Show Timestamps</Label>
                    <p className="text-xs text-gray-500">Display message timestamps</p>
                  </div>
                  <Switch 
                    checked={displaySettings.showTimestamps}
                    onCheckedChange={(checked) => updateDisplaySettings({ showTimestamps: checked })}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Auto Collapse Conversations</Label>
                    <p className="text-xs text-gray-500">Automatically collapse long conversations</p>
                  </div>
                  <Switch 
                    checked={displaySettings.autoCollapse}
                    onCheckedChange={(checked) => updateDisplaySettings({ autoCollapse: checked })}
                  />
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-gray-900/50 border-gray-800 backdrop-blur-sm hover-lift transition-all">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Layout className="h-5 w-5 text-primary" />
                  Layout Options
                </CardTitle>
                <CardDescription>Customize the application layout</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Font Size</Label>
                  <Select 
                    value={displaySettings.fontSize} 
                    onValueChange={(value: "sm" | "md" | "lg") => updateDisplaySettings({ fontSize: value })}
                  >
                    <SelectTrigger className="bg-gray-800/50 border-gray-700">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-900 border-gray-800">
                      <SelectItem value="sm">Small</SelectItem>
                      <SelectItem value="md">Medium</SelectItem>
                      <SelectItem value="lg">Large</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Compact Mode</Label>
                    <p className="text-xs text-gray-500">Reduce spacing for more content</p>
                  </div>
                  <Switch 
                    checked={displaySettings.compactMode}
                    onCheckedChange={(checked) => updateDisplaySettings({ compactMode: checked })}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Enable Animations</Label>
                    <p className="text-xs text-gray-500">Smooth transitions and effects</p>
                  </div>
                  <Switch 
                    checked={displaySettings.animations}
                    onCheckedChange={(checked) => updateDisplaySettings({ animations: checked })}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        {/* Security Settings */}
        <TabsContent value="security" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="bg-gray-900/50 border-gray-800 backdrop-blur-sm hover-lift transition-all">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-primary" />
                  Security Preferences
                </CardTitle>
                <CardDescription>Configure security settings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>API Key Encryption</Label>
                    <p className="text-xs text-gray-500">Encrypt stored API keys</p>
                  </div>
                  <Switch 
                    checked={securitySettings.encryptionEnabled}
                    onCheckedChange={(checked) => updateSecuritySettings({ encryptionEnabled: checked })}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Two-Factor Authentication</Label>
                    <p className="text-xs text-gray-500">Add extra security layer</p>
                  </div>
                  <Switch 
                    checked={securitySettings.twoFactorAuth}
                    onCheckedChange={(checked) => updateSecuritySettings({ twoFactorAuth: checked })}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Session Timeout (minutes): {securitySettings.sessionTimeout}</Label>
                  <Slider 
                    value={[securitySettings.sessionTimeout]} 
                    onValueChange={(value) => updateSecuritySettings({ sessionTimeout: value[0] })}
                    min={5}
                    max={120}
                    step={5}
                  />
                  <p className="text-xs text-gray-500">Time before automatic logout</p>
                </div>
                
                <div className="space-y-2">
                  <Label>Login Attempts: {securitySettings.loginAttempts}</Label>
                  <Slider 
                    value={[securitySettings.loginAttempts]} 
                    onValueChange={(value) => updateSecuritySettings({ loginAttempts: value[0] })}
                    min={1}
                    max={10}
                    step={1}
                  />
                  <p className="text-xs text-gray-500">Max failed attempts before lockout</p>
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-gray-900/50 border-gray-800 backdrop-blur-sm hover-lift transition-all">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lock className="h-5 w-5 text-primary" />
                  IP Whitelist
                </CardTitle>
                <CardDescription>Restrict access to specific IPs</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Add IP Address</Label>
                  <div className="flex gap-2">
                    <Input 
                      placeholder="192.168.1.1" 
                      className="bg-gray-800/50 border-gray-700"
                    />
                    <Button variant="outline">Add</Button>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label>Whitelisted IPs</Label>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {securitySettings.ipWhitelist.map((ip, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-gray-800/30 rounded border border-gray-700">
                        <span>{ip}</span>
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="h-6 w-6 p-0"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        {/* Notification Settings */}
        <TabsContent value="notifications" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="bg-gray-900/50 border-gray-800 backdrop-blur-sm hover-lift transition-all">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5 text-primary" />
                  Notification Preferences
                </CardTitle>
                <CardDescription>Configure notification settings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Email Notifications</Label>
                    <p className="text-xs text-gray-500">Receive updates via email</p>
                  </div>
                  <Switch 
                    checked={notificationSettings.emailNotifications}
                    onCheckedChange={(checked) => updateNotificationSettings({ emailNotifications: checked })}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Push Notifications</Label>
                    <p className="text-xs text-gray-500">Show browser notifications</p>
                  </div>
                  <Switch 
                    checked={notificationSettings.pushNotifications}
                    onCheckedChange={(checked) => updateNotificationSettings({ pushNotifications: checked })}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Sound Enabled</Label>
                    <p className="text-xs text-gray-500">Play notification sounds</p>
                  </div>
                  <Switch 
                    checked={notificationSettings.soundEnabled}
                    onCheckedChange={(checked) => updateNotificationSettings({ soundEnabled: checked })}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Notification Frequency</Label>
                  <Select 
                    value={notificationSettings.notificationFrequency} 
                    onValueChange={(value: "realtime" | "hourly" | "daily" | "weekly") => updateNotificationSettings({ notificationFrequency: value })}
                  >
                    <SelectTrigger className="bg-gray-800/50 border-gray-700">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-900 border-gray-800">
                      <SelectItem value="realtime">Real-time</SelectItem>
                      <SelectItem value="hourly">Hourly Digest</SelectItem>
                      <SelectItem value="daily">Daily Digest</SelectItem>
                      <SelectItem value="weekly">Weekly Digest</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-gray-900/50 border-gray-800 backdrop-blur-sm hover-lift transition-all">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  Notification Types
                </CardTitle>
                <CardDescription>Select which notifications to receive</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Model Updates</Label>
                  <Switch 
                    checked={notificationSettings.notificationTypes.modelUpdates}
                    onCheckedChange={(checked) => updateNotificationSettings({ 
                      notificationTypes: {
                        ...notificationSettings.notificationTypes,
                        modelUpdates: checked
                      }
                    })}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <Label>Usage Alerts</Label>
                  <Switch 
                    checked={notificationSettings.notificationTypes.usageAlerts}
                    onCheckedChange={(checked) => updateNotificationSettings({ 
                      notificationTypes: {
                        ...notificationSettings.notificationTypes,
                        usageAlerts: checked
                      }
                    })}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <Label>Security Alerts</Label>
                  <Switch 
                    checked={notificationSettings.notificationTypes.securityAlerts}
                    onCheckedChange={(checked) => updateNotificationSettings({ 
                      notificationTypes: {
                        ...notificationSettings.notificationTypes,
                        securityAlerts: checked
                      }
                    })}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <Label>Feature Announcements</Label>
                  <Switch 
                    checked={notificationSettings.notificationTypes.featureAnnouncements}
                    onCheckedChange={(checked) => updateNotificationSettings({ 
                      notificationTypes: {
                        ...notificationSettings.notificationTypes,
                        featureAnnouncements: checked
                      }
                    })}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        {/* Advanced Settings */}
        <TabsContent value="advanced" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="bg-gray-900/50 border-gray-800 backdrop-blur-sm hover-lift transition-all">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-primary" />
                  Performance
                </CardTitle>
                <CardDescription>Optimize application performance</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Cache Size (MB)</Label>
                  <Input 
                    type="number" 
                    defaultValue="50" 
                    className="bg-gray-800/50 border-gray-700"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Max Concurrent Requests</Label>
                  <Input 
                    type="number" 
                    defaultValue="5" 
                    className="bg-gray-800/50 border-gray-700"
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <Label>Enable Caching</Label>
                  <Switch defaultChecked />
                </div>
                
                <div className="flex items-center justify-between">
                  <Label>Prefetch Conversations</Label>
                  <Switch defaultChecked />
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-gray-900/50 border-gray-800 backdrop-blur-sm hover-lift transition-all">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Download className="h-5 w-5 text-primary" />
                  Data Management
                </CardTitle>
                <CardDescription>Export, import, and reset settings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col gap-2">
                  <Button variant="outline" className="w-full">
                    <Upload className="h-4 w-4 mr-2" />
                    Export All Settings
                  </Button>
                  
                  <Button variant="outline" className="w-full">
                    <Download className="h-4 w-4 mr-2" />
                    Import Settings
                  </Button>
                  
                  <Separator className="my-3" />
                  
                  <Button 
                    variant="destructive" 
                    className="w-full"
                    onClick={resetSettings}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Reset All Settings
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
      
      <div className="flex justify-end gap-4 mt-8">
        <Button 
          variant="outline" 
          onClick={resetAllSettings}
          className="px-6"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Reset
        </Button>
        
        <Button 
          onClick={saveSettings}
          className="px-6 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
        >
          <Save className="h-4 w-4 mr-2" />
          Save Changes
        </Button>
      </div>
    </div>
  );
}

// Placeholder for Save icon since it's not imported
const Save = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
  </svg>
);

// Placeholder for SettingsIcon since it's not imported
const SettingsIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
  </svg>
);