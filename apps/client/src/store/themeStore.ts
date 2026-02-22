import { create } from 'zustand';
import { Platform } from 'react-native';

export type ThemeMode = 'light' | 'dark';

export interface ThemeColors {
  background: string;
  backgroundSecondary: string;
  backgroundTertiary: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  primary: string;
  primaryLight: string;
  border: string;
  card: string;
  success: string;
  warning: string;
  error: string;
  headerBg: string;
}

const darkColors: ThemeColors = {
  background: '#1a1a2e',
  backgroundSecondary: '#2d2d44',
  backgroundTertiary: '#3d3d5c',
  text: '#ffffff',
  textSecondary: '#cccccc',
  textMuted: '#888888',
  primary: '#3b82f6',
  primaryLight: '#60a5fa',
  border: '#3d3d5c',
  card: '#2d2d44',
  success: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444',
  headerBg: '#16213e',
};

const lightColors: ThemeColors = {
  background: '#f8f9fa',
  backgroundSecondary: '#ffffff',
  backgroundTertiary: '#f0f1f3',
  text: '#1f2937',
  textSecondary: '#4b5563',
  textMuted: '#9ca3af',
  primary: '#3b82f6',
  primaryLight: '#60a5fa',
  border: '#e5e7eb',
  card: '#ffffff',
  success: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444',
  headerBg: '#1e293b',
};

interface ThemeState {
  mode: ThemeMode;
  colors: ThemeColors;
  toggleTheme: () => void;
  setTheme: (mode: ThemeMode) => void;
}

// Check saved preference
const getSavedTheme = (): ThemeMode => {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    try {
      const saved = localStorage.getItem('theme');
      if (saved === 'light' || saved === 'dark') return saved;
    } catch {}
  }
  return 'dark'; // default
};

const initialMode = getSavedTheme();

export const useThemeStore = create<ThemeState>((set, get) => ({
  mode: initialMode,
  colors: initialMode === 'dark' ? darkColors : lightColors,

  toggleTheme: () => {
    const newMode = get().mode === 'dark' ? 'light' : 'dark';
    const newColors = newMode === 'dark' ? darkColors : lightColors;

    // Save preference
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      try {
        localStorage.setItem('theme', newMode);
      } catch {}
    }

    set({ mode: newMode, colors: newColors });
  },

  setTheme: (mode: ThemeMode) => {
    const newColors = mode === 'dark' ? darkColors : lightColors;

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      try {
        localStorage.setItem('theme', mode);
      } catch {}
    }

    set({ mode, colors: newColors });
  },
}));

export { darkColors, lightColors };
