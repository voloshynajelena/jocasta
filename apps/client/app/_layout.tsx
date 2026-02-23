import { useEffect, useState } from 'react';
import { View, Platform } from 'react-native';
import { Stack, useSegments } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';

import { useAuthStore } from '../src/store/authStore';
import { useThemeStore } from '../src/store/themeStore';
import { AppHeader } from '../src/components/AppHeader';
import { LoadingScreen } from '../src/components/LoadingScreen';

console.log('[Layout Module] Loaded');

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 2,
    },
  },
});

function LayoutContent() {
  const { colors, mode } = useThemeStore();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const segments = useSegments();

  // Show header only on tabs screens when authenticated
  const showHeader = isAuthenticated && segments[0] === '(tabs)';

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {showHeader && <AppHeader />}
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen
          name="proposal/[id]"
          options={{
            presentation: 'modal',
            headerShown: true,
            headerStyle: { backgroundColor: colors.headerBg },
            headerTintColor: colors.text,
            title: 'Review Proposal',
          }}
        />
        <Stack.Screen
          name="batch-review/[sessionId]"
          options={{
            presentation: 'modal',
            headerShown: false,
            contentStyle: { backgroundColor: colors.background },
          }}
        />
      </Stack>
      {Platform.OS !== 'web' && <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />}
    </View>
  );
}

export default function RootLayout() {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    console.log('[Layout] Calling initialize...');
    const init = async () => {
      await useAuthStore.getState().initialize();

      // Hide web loading screen if present
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        (window as { hideLoadingScreen?: () => void }).hideLoadingScreen?.();
      }

      // Small delay for smooth transition
      setTimeout(() => setIsLoading(false), 500);
    };
    init();
  }, []);

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <LayoutContent />
    </QueryClientProvider>
  );
}
