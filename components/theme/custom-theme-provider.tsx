"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { ThemeProvider as NextThemesProvider, useTheme as useNextTheme } from "next-themes";

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
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("themeSettings");
      return saved ? JSON.parse(saved) : DEFAULT_THEME_SETTINGS;
    }
    return DEFAULT_THEME_SETTINGS;
  });

  // Apply theme settings to document
  useEffect(() => {
    const root = document.documentElement;
    
    // Apply custom colors
    root.style.setProperty("--primary-custom", customTheme.primaryColor);
    root.style.setProperty("--secondary-custom", customTheme.secondaryColor);
    root.style.setProperty("--accent-custom", customTheme.accentColor);
    
    // Apply font size
    const fontSizeMap = {
      sm: "0.875rem",
      md: "1rem",
      lg: "1.125rem"
    };
    root.style.fontSize = fontSizeMap[customTheme.fontSize];
    
    // Apply border radius
    root.style.setProperty("--radius", `${customTheme.borderRadius}px`);
    
    // Apply compact mode
    if (customTheme.compactMode) {
      root.classList.add("compact-mode");
    } else {
      root.classList.remove("compact-mode");
    }
    
    // Save to localStorage
    localStorage.setItem("themeSettings", JSON.stringify(customTheme));
  }, [customTheme]);
  
  const updateCustomTheme = (settings: Partial<CustomThemeSettings>) => {
    setCustomTheme(prev => ({ ...prev, ...settings }));
  };
  
  const resetCustomTheme = () => {
    setCustomTheme(DEFAULT_THEME_SETTINGS);
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