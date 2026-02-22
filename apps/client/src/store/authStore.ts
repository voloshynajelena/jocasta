import { create } from 'zustand';
import { Platform } from 'react-native';

import { api } from '../services/api';

interface User {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  role?: string;
}

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
  error: string | null;

  initialize: () => Promise<void>;
  login: (tokens: AuthTokens) => Promise<void>;
  loginWithPassword: (email: string, password: string) => Promise<void>;
  loginWithApple: (appleId: string, email?: string, name?: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<boolean>;
  setDemoMode: () => void;
  isAdmin: () => boolean;
}

// Lazy load SecureStore only on native
let SecureStore: typeof import('expo-secure-store') | null = null;
const getSecureStore = async () => {
  if (Platform.OS === 'web') return null;
  if (!SecureStore) {
    SecureStore = await import('expo-secure-store');
  }
  return SecureStore;
};

const isWebWithStorage = () =>
  Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage;

const storeToken = async (key: string, value: string) => {
  if (isWebWithStorage()) {
    window.localStorage.setItem(key, value);
    return;
  }
  if (Platform.OS !== 'web') {
    const store = await getSecureStore();
    if (store) {
      await store.setItemAsync(key, value);
    }
  }
};

const getToken = async (key: string): Promise<string | null> => {
  if (isWebWithStorage()) {
    return window.localStorage.getItem(key);
  }
  if (Platform.OS !== 'web') {
    const store = await getSecureStore();
    if (store) {
      return store.getItemAsync(key);
    }
  }
  return null;
};

const deleteToken = async (key: string) => {
  if (isWebWithStorage()) {
    window.localStorage.removeItem(key);
    return;
  }
  if (Platform.OS !== 'web') {
    const store = await getSecureStore();
    if (store) {
      await store.deleteItemAsync(key);
    }
  }
};

// Check demo mode synchronously at module load for web
const checkDemoMode = (): boolean => {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      return window.localStorage.getItem('demoMode') === 'true';
    } catch {
      return false;
    }
  }
  return false;
};

const DEMO_USER: User = {
  id: 'demo-user',
  email: 'elena@workingmom.io',
  name: 'Elena Martinez',
  avatarUrl: null,
};

const isDemoOnLoad = checkDemoMode();

export const useAuthStore = create<AuthState>((set, get) => ({
  // If demo mode, start authenticated immediately
  isAuthenticated: isDemoOnLoad,
  isLoading: !isDemoOnLoad, // Only loading if NOT demo mode
  user: isDemoOnLoad ? DEMO_USER : null,
  error: null,

  initialize: async () => {
    // If already in demo mode, nothing to do
    if (get().user?.id === 'demo-user') {
      set({ isLoading: false });
      return;
    }

    try {
      // Check for existing tokens
      const accessToken = await getToken('accessToken');

      if (!accessToken) {
        set({ isAuthenticated: false, isLoading: false });
        return;
      }

      // Have token - try to validate (with timeout)
      api.setAccessToken(accessToken);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      try {
        const profile = await api.getProfile();
        clearTimeout(timeoutId);
        set({
          isAuthenticated: true,
          user: {
            id: profile.id,
            email: profile.email,
            name: profile.name,
            avatarUrl: profile.avatarUrl,
          },
          isLoading: false,
        });
      } catch {
        clearTimeout(timeoutId);
        await deleteToken('accessToken');
        await deleteToken('refreshToken');
        api.setAccessToken(null);
        set({ isAuthenticated: false, isLoading: false });
      }
    } catch {
      set({ isAuthenticated: false, isLoading: false });
    }
  },

  login: async (tokens: AuthTokens) => {
    try {
      // Store tokens
      await storeToken('accessToken', tokens.accessToken);
      await storeToken('refreshToken', tokens.refreshToken);

      api.setAccessToken(tokens.accessToken);

      // Fetch user profile
      const profile = await api.getProfile();

      set({
        isAuthenticated: true,
        user: {
          id: profile.id,
          email: profile.email,
          name: profile.name,
          avatarUrl: profile.avatarUrl,
        },
        error: null,
      });
    } catch (error: any) {
      set({ error: error.message });
      throw error;
    }
  },

  logout: async () => {
    try {
      // Clear tokens
      await deleteToken('accessToken');
      await deleteToken('refreshToken');

      api.setAccessToken(null);

      // On web, clear demo mode and call logout endpoint
      if (Platform.OS === 'web') {
        localStorage.removeItem('demoMode');
        try {
          await fetch(
            `${process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/auth/logout`,
            {
              method: 'POST',
              credentials: 'include',
            },
          );
        } catch {
          // Ignore errors
        }
      }

      set({
        isAuthenticated: false,
        user: null,
        error: null,
      });
    } catch (error: any) {
      set({ error: error.message });
    }
  },

  refreshAuth: async () => {
    try {
      const refreshToken = await getToken('refreshToken');

      if (!refreshToken && Platform.OS !== 'web') {
        return false;
      }

      const tokens = await api.refreshTokens(refreshToken || '');

      await storeToken('accessToken', tokens.accessToken);
      await storeToken('refreshToken', tokens.refreshToken);

      api.setAccessToken(tokens.accessToken);

      // Fetch updated profile
      const profile = await api.getProfile();

      set({
        isAuthenticated: true,
        user: {
          id: profile.id,
          email: profile.email,
          name: profile.name,
          avatarUrl: profile.avatarUrl,
        },
      });

      return true;
    } catch {
      // Refresh failed
      await get().logout();
      return false;
    }
  },

  setDemoMode: () => {
    // Persist demo mode flag for web
    if (Platform.OS === 'web') {
      localStorage.setItem('demoMode', 'true');
    }
    set({
      isAuthenticated: true,
      isLoading: false,
      user: {
        id: 'demo-user',
        email: 'elena@workingmom.io',
        name: 'Elena Martinez',
        avatarUrl: null,
      },
      error: null,
    });
  },

  loginWithPassword: async (email: string, password: string) => {
    try {
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/auth/login`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ email, password }),
        },
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Login failed');
      }

      const tokens = await response.json();

      // Store tokens
      await storeToken('accessToken', tokens.accessToken);
      await storeToken('refreshToken', tokens.refreshToken);

      api.setAccessToken(tokens.accessToken);

      // Fetch user profile
      const profile = await api.getProfile();

      set({
        isAuthenticated: true,
        user: {
          id: profile.id,
          email: profile.email,
          name: profile.name,
          avatarUrl: profile.avatarUrl,
          role: profile.role,
        },
        error: null,
      });
    } catch (error: any) {
      set({ error: error.message });
      throw error;
    }
  },

  loginWithApple: async (appleId: string, email?: string, name?: string) => {
    try {
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/auth/apple`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ appleId, email, name }),
        },
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Apple Sign-In failed');
      }

      const tokens = await response.json();

      // Store tokens
      await storeToken('accessToken', tokens.accessToken);
      await storeToken('refreshToken', tokens.refreshToken);

      api.setAccessToken(tokens.accessToken);

      // Fetch user profile
      const profile = await api.getProfile();

      set({
        isAuthenticated: true,
        user: {
          id: profile.id,
          email: profile.email,
          name: profile.name,
          avatarUrl: profile.avatarUrl,
          role: profile.role,
        },
        error: null,
      });
    } catch (error: any) {
      set({ error: error.message });
      throw error;
    }
  },

  isAdmin: () => {
    return get().user?.role === 'admin';
  },
}));
