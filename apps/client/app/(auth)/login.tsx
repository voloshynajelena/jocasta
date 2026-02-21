import { useState } from 'react';
import { YStack, Text, Button, Spinner } from 'tamagui';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import { Platform } from 'react-native';

import { useAuthStore } from '@/store/authStore';
import { api } from '@/services/api';

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { login } = useAuthStore();

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);

    try {
      if (Platform.OS === 'web') {
        // Web: Redirect to backend OAuth
        const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';
        window.location.href = `${apiUrl}/api/v1/auth/google/start`;
        return;
      }

      // Mobile: Use AuthSession
      const config = await api.getAuthConfig();

      const redirectUri = AuthSession.makeRedirectUri({
        scheme: 'jocasta',
        path: 'auth/callback',
      });

      const request = new AuthSession.AuthRequest({
        clientId: config.clientId,
        scopes: config.scopes,
        redirectUri,
        usePKCE: true,
      });

      const result = await request.promptAsync({
        authorizationEndpoint: config.authorizationEndpoint,
      });

      if (result.type === 'success' && result.params.code) {
        // Exchange code for tokens
        const tokens = await api.exchangeCode({
          code: result.params.code,
          codeVerifier: request.codeVerifier!,
          redirectUri,
        });

        await login(tokens);
        router.replace('/(tabs)');
      } else if (result.type === 'error') {
        setError(result.error?.message || 'Authentication failed');
      }
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <YStack flex={1} justifyContent="center" alignItems="center" padding="$6">
        <YStack alignItems="center" gap="$4" maxWidth={400}>
          {/* Logo/Title */}
          <YStack alignItems="center" gap="$2" marginBottom="$6">
            <Text fontSize="$10" fontWeight="bold" color="$blue10">
              Jocasta
            </Text>
            <Text fontSize="$5" color="$gray11" textAlign="center">
              Your AI-powered scheduling assistant
            </Text>
          </YStack>

          {/* Features */}
          <YStack gap="$3" marginBottom="$6">
            <Text color="$gray11" textAlign="center">
              📅 Smart scheduling with conflict detection
            </Text>
            <Text color="$gray11" textAlign="center">
              🗺️ Travel time and weather-aware planning
            </Text>
            <Text color="$gray11" textAlign="center">
              🔔 Telegram notifications with action buttons
            </Text>
            <Text color="$gray11" textAlign="center">
              🔄 Bi-directional Google Calendar sync
            </Text>
          </YStack>

          {/* Login Button */}
          <Button
            size="$5"
            theme="blue"
            width="100%"
            onPress={handleGoogleLogin}
            disabled={loading}
            icon={loading ? <Spinner /> : undefined}
          >
            {loading ? 'Signing in...' : 'Sign in with Google'}
          </Button>

          {/* Error Message */}
          {error && (
            <Text color="$red10" textAlign="center" marginTop="$2">
              {error}
            </Text>
          )}

          {/* Privacy Note */}
          <Text color="$gray10" fontSize="$2" textAlign="center" marginTop="$4">
            By signing in, you agree to allow Jocasta to access your Google Calendar
            for scheduling purposes.
          </Text>
        </YStack>
      </YStack>
    </SafeAreaView>
  );
}
