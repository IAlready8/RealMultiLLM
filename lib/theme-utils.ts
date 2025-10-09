import { CustomThemeSettings } from "@/components/theme/custom-theme-provider";

/**
 * Applies custom theme settings to the document root
 */
export const applyThemeSettings = (settings: CustomThemeSettings) => {
  const root = document.documentElement;
  
  // Apply custom colors (convert hex to RGB for CSS variables)
  root.style.setProperty("--primary-custom", hexToRgb(settings.primaryColor));
  root.style.setProperty("--secondary-custom", hexToRgb(settings.secondaryColor));
  root.style.setProperty("--accent-custom", hexToRgb(settings.accentColor));
  
  // Apply font size
  const fontSizeMap = {
    sm: "0.875rem",
    md: "1rem",
    lg: "1.125rem"
  };
  root.style.fontSize = fontSizeMap[settings.fontSize as keyof typeof fontSizeMap];
  
  // Apply border radius
  root.style.setProperty("--radius", `${settings.borderRadius}px`);
  
  // Apply compact mode
  if (settings.compactMode) {
    root.classList.add("compact-mode");
  } else {
    root.classList.remove("compact-mode");
  }
  
  // Apply animations class
  if (settings.animations) {
    root.classList.remove("no-animations");
  } else {
    root.classList.add("no-animations");
  }
  
  // Save to localStorage
  localStorage.setItem("themeSettings", JSON.stringify(settings));
};

/**
 * Converts hex color to RGB values
 */
export const hexToRgb = (hex: string): string => {
  // Expand shorthand form (e.g. "03F") to full form (e.g. "0033FF")
  const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
  hex = hex.replace(shorthandRegex, (m, r, g, b) => {
    return r + r + g + g + b + b;
  });

  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? 
    `${parseInt(result[1], 16)} ${parseInt(result[2], 16)} ${parseInt(result[3], 16)}` : 
    "0 0 0"; // fallback to black if conversion fails
};

/**
 * Loads theme settings from localStorage
 */
export const loadThemeSettings = (): CustomThemeSettings | null => {
  if (typeof window !== "undefined") {
    const saved = localStorage.getItem("themeSettings");
    return saved ? JSON.parse(saved) : null;
  }
  return null;
};

/**
 * Resets theme settings to defaults
 */
export const resetThemeSettings = () => {
  const defaultSettings: CustomThemeSettings = {
    primaryColor: "#8b5cf6",
    secondaryColor: "#ec4899",
    accentColor: "#06b6d4",
    borderRadius: 8,
    fontSize: "md",
    fontFamily: "system",
    compactMode: false,
    animations: true,
  };
  
  localStorage.setItem("themeSettings", JSON.stringify(defaultSettings));
  applyThemeSettings(defaultSettings);
  return defaultSettings;
};