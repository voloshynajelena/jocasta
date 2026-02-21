import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { api } from '@/services/api';

interface User {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
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
  logout: () => Promise<void>;
  refreshAuth: () => Promise<boolean>;
}

const storeToken = async (key: string, value: string) => {
  if (Platform.OS === 'web') {
    // On web, we rely on httpOnly cookies set by the server
    return;
  }
  await SecureStore.setItemAsync(key, value);
};

const getToken = async (key: string): Promise<string | null> => {
  if (Platform.OS === 'web') {
    return null; // Web uses cookies
  }
  return SecureStore.getItemAsync(key);
};

const deleteToken = async (key: string) => {
  if (Platform.OS === 'web') {
    return;
  }
  await SecureStore.deleteItemAsync(key);
};

export const useAuthStore = create<AuthState>((set, get) => ({
  isAuthenticated: false,
  isLoading: true,
  user: null,
  error: null,

  initialize: async () => {
    try {
      set({ isLoading: true, error: null });

      // Check for existing tokens
      const accessToken = await getToken('accessToken');

      if (accessToken) {
        api.setAccessToken(accessToken);

        // Validate by fetching profile
        try {
          const profile = await api.getProfile();
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
          return;
        } catch {
          // Token might be expired, try refresh
          const refreshed = await get().refreshAuth();
          if (refreshed) {
            set({ isLoading: false });
            return;
          }
        }
      }

      // On web, try to fetch profile (cookies might be set)
      if (Platform.OS === 'web') {
        try {
          const profile = await api.getProfile();
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
          return;
        } catch {
          // Not authenticated
        }
      }

      set({ isAuthenticated: false, isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
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

      // On web, call logout endpoint to clear cookies
      if (Platform.OS === 'web') {
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
}));
