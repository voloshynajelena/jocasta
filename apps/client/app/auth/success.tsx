import { useEffect } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuthStore } from '../../src/store/authStore';
import { useThemeStore } from '../../src/store/themeStore';

export default function AuthSuccessScreen() {
  const router = useRouter();
  const { colors } = useThemeStore();
  const login = useAuthStore((s) => s.login);
  const params = useLocalSearchParams<{ access_token?: string; refresh_token?: string }>();

  useEffect(() => {
    const handleSuccess = async () => {
      // Get tokens from URL params
      let accessToken = params.access_token;
      let refreshToken = params.refresh_token;

      // On web, also check window.location for tokens
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const urlParams = new URLSearchParams(window.location.search);
        accessToken = accessToken || urlParams.get('access_token') || undefined;
        refreshToken = refreshToken || urlParams.get('refresh_token') || undefined;
      }

      if (accessToken && refreshToken) {
        await login({ accessToken, refreshToken, expiresIn: 900 });
        router.replace('/(tabs)');
      } else {
        // No tokens, go back to login
        router.replace('/(auth)/login');
      }
    };
    handleSuccess();
  }, [params]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={[styles.text, { color: colors.text }]}>Signing you in...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    marginTop: 16,
    fontSize: 16,
  },
});
