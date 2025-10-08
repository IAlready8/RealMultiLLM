// Enhanced Theme Context Provider
// This file creates a custom theme provider that works with our advanced settings

"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { ThemeProvider as NextThemesProvider, useTheme as useNextTheme } from "next-themes";
import { applyThemeSettings, loadThemeSettings } from "@/lib/theme-utils";

interface CustomThemeSettings {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  borderRadius: number;
  fontSize: "sm" | "md" | "lg";
  fontFamily: string;
  compactMode: boolean;
  animations: boolean;
}

interface ThemeContextType {
  customTheme: CustomThemeSettings;
  updateCustomTheme: (settings: Partial<CustomThemeSettings>) => void;
  resetCustomTheme: () => void;
}

const DEFAULT_THEME_SETTINGS: CustomThemeSettings = {
  primaryColor: "#8b5cf6",
  secondaryColor: "#ec4899",
  accentColor: "#06b6d4",
  borderRadius: 8,
  fontSize: "md",
  fontFamily: "system",
  compactMode: false,
  animations: true,
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function CustomThemeProvider({ children }: { children: ReactNode }) {
  const [customTheme, setCustomTheme] = useState<CustomThemeSettings>(() => {
    const savedSettings = loadThemeSettings();
    return savedSettings || DEFAULT_THEME_SETTINGS;
  });

  // Apply theme settings to document
  useEffect(() => {
    applyThemeSettings(customTheme);
  }, [customTheme]);

  const updateCustomTheme = (settings: Partial<CustomThemeSettings>) => {
    setCustomTheme(prev => ({ ...prev, ...settings }));
  };

  const resetCustomTheme = () => {
    setCustomTheme(DEFAULT_THEME_SETTINGS);
    applyThemeSettings(DEFAULT_THEME_SETTINGS);
  };

  const value = {
    customTheme,
    updateCustomTheme,
    resetCustomTheme
  };

  return (
    <ThemeContext.Provider value={value}>
      <NextThemesProvider attribute="class" defaultTheme="system" enableSystem>
        {children}
      </NextThemesProvider>
    </ThemeContext.Provider>
  );
}

export function useCustomTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useCustomTheme must be used within a CustomThemeProvider");
  }
  return context;
}

export { useNextTheme as useTheme };