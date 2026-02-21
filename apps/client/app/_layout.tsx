import { useEffect } from 'react';
import { View, Platform } from 'react-native';
import { Stack } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';

import { useAuthStore } from '../src/store/authStore';

console.log('[Layout Module] Loaded');

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 2,
    },
  },
});

export default function RootLayout() {
  useEffect(() => {
    console.log('[Layout] Calling initialize...');
    useAuthStore.getState().initialize();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {Platform.OS !== 'web' && <StatusBar style="light" />}
      <View style={{ flex: 1, backgroundColor: '#1a1a2e' }}>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: '#1a1a2e' },
          }}
        >
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen
            name="proposal/[id]"
            options={{
              presentation: 'modal',
              headerShown: true,
              headerStyle: { backgroundColor: '#1a1a2e' },
              headerTintColor: '#fff',
              title: 'Review Proposal',
            }}
          />
        </Stack>
      </View>
    </QueryClientProvider>
  );
}
