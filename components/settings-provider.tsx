// Settings Context Provider
// Provides global access to application settings

"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";

interface ThemeSettings {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  borderRadius: number;
  fontSize: "sm" | "md" | "lg";
  fontFamily: string;
  compactMode: boolean;
  animations: boolean;
  theme: "light" | "dark" | "system";
}

interface DisplaySettings {
  theme: "light" | "dark" | "system";
  fontSize: "sm" | "md" | "lg";
  compactMode: boolean;
  animations: boolean;
  showAvatars: boolean;
  showTimestamps: boolean;
  autoCollapse: boolean;
}

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
  notificationFrequency: "realtime" | "hourly" | "daily" | "weekly";
  notificationTypes: {
    modelUpdates: boolean;
    usageAlerts: boolean;
    securityAlerts: boolean;
    featureAnnouncements: boolean;
  };
}

interface SettingsContextType {
  themeSettings: ThemeSettings;
  displaySettings: DisplaySettings;
  securitySettings: SecuritySettings;
  notificationSettings: NotificationSettings;
  updateThemeSettings: (settings: Partial<ThemeSettings>) => void;
  updateDisplaySettings: (settings: Partial<DisplaySettings>) => void;
  updateSecuritySettings: (settings: Partial<SecuritySettings>) => void;
  updateNotificationSettings: (settings: Partial<NotificationSettings>) => void;
  resetAllSettings: () => void;
}

const DEFAULT_THEME_SETTINGS: ThemeSettings = {
  primaryColor: "#8b5cf6",
  secondaryColor: "#ec4899",
  accentColor: "#06b6d4",
  borderRadius: 8,
  fontSize: "md",
  fontFamily: "system",
  compactMode: false,
  animations: true,
  theme: "system"
};

const DEFAULT_DISPLAY_SETTINGS: DisplaySettings = {
  theme: "system",
  fontSize: "md",
  compactMode: false,
  animations: true,
  showAvatars: true,
  showTimestamps: true,
  autoCollapse: false
};

const DEFAULT_SECURITY_SETTINGS: SecuritySettings = {
  encryptionEnabled: true,
  twoFactorAuth: false,
  sessionTimeout: 30,
  loginAttempts: 5,
  ipWhitelist: []
};

const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  emailNotifications: true,
  pushNotifications: true,
  soundEnabled: true,
  notificationFrequency: "realtime",
  notificationTypes: {
    modelUpdates: true,
    usageAlerts: true,
    securityAlerts: true,
    featureAnnouncements: true
  }
};

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [themeSettings, setThemeSettings] = useState<ThemeSettings>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("themeSettings");
      return saved ? JSON.parse(saved) : DEFAULT_THEME_SETTINGS;
    }
    return DEFAULT_THEME_SETTINGS;
  });
  
  const [displaySettings, setDisplaySettings] = useState<DisplaySettings>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("displaySettings");
      return saved ? JSON.parse(saved) : DEFAULT_DISPLAY_SETTINGS;
    }
    return DEFAULT_DISPLAY_SETTINGS;
  });
  
  const [securitySettings, setSecuritySettings] = useState<SecuritySettings>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("securitySettings");
      return saved ? JSON.parse(saved) : DEFAULT_SECURITY_SETTINGS;
    }
    return DEFAULT_SECURITY_SETTINGS;
  });
  
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("notificationSettings");
      return saved ? JSON.parse(saved) : DEFAULT_NOTIFICATION_SETTINGS;
    }
    return DEFAULT_NOTIFICATION_SETTINGS;
  });
  
  // Save settings to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem("themeSettings", JSON.stringify(themeSettings));
  }, [themeSettings]);
  
  useEffect(() => {
    localStorage.setItem("displaySettings", JSON.stringify(displaySettings));
  }, [displaySettings]);
  
  useEffect(() => {
    localStorage.setItem("securitySettings", JSON.stringify(securitySettings));
  }, [securitySettings]);
  
  useEffect(() => {
    localStorage.setItem("notificationSettings", JSON.stringify(notificationSettings));
  }, [notificationSettings]);
  
  const updateThemeSettings = (settings: Partial<ThemeSettings>) => {
    setThemeSettings(prev => ({ ...prev, ...settings }));
  };
  
  const updateDisplaySettings = (settings: Partial<DisplaySettings>) => {
    setDisplaySettings(prev => ({ ...prev, ...settings }));
  };
  
  const updateSecuritySettings = (settings: Partial<SecuritySettings>) => {
    setSecuritySettings(prev => ({ ...prev, ...settings }));
  };
  
  const updateNotificationSettings = (settings: Partial<NotificationSettings>) => {
    setNotificationSettings(prev => ({ ...prev, ...settings }));
  };
  
  const resetAllSettings = () => {
    setThemeSettings(DEFAULT_THEME_SETTINGS);
    setDisplaySettings(DEFAULT_DISPLAY_SETTINGS);
    setSecuritySettings(DEFAULT_SECURITY_SETTINGS);
    setNotificationSettings(DEFAULT_NOTIFICATION_SETTINGS);
  };
  
  const value = {
    themeSettings,
    displaySettings,
    securitySettings,
    notificationSettings,
    updateThemeSettings,
    updateDisplaySettings,
    updateSecuritySettings,
    updateNotificationSettings,
    resetAllSettings
  };
  
  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return context;
}