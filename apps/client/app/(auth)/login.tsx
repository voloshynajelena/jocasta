import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';

import { useAuthStore } from '../../src/store/authStore';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';

export default function LoginScreen() {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Handle deep link callback from OAuth
  useEffect(() => {
    const handleUrl = async (event: { url: string }) => {
      const url = event.url;
      if (url.includes('jocasta://')) {
        try {
          const urlObj = new URL(url);
          const accessToken = urlObj.searchParams.get('access_token');
          const refreshToken = urlObj.searchParams.get('refresh_token');

          if (accessToken && refreshToken) {
            setLoading(true);
            await login({ accessToken, refreshToken, expiresIn: 900 });
            router.replace('/(tabs)');
          }
        } catch (err: any) {
          console.error('Callback error:', err);
          setError(err.message || 'Login failed');
        } finally {
          setLoading(false);
        }
      }
    };

    const subscription = Linking.addEventListener('url', handleUrl);

    // Check if app was opened with a URL
    Linking.getInitialURL().then((url) => {
      if (url) handleUrl({ url });
    });

    return () => subscription.remove();
  }, [login, router]);

  const handleGoogleLogin = async () => {
    setError(null);
    setLoading(true);

    try {
      // Open the server's Google OAuth flow in browser
      // The server will redirect back to jocasta:// scheme with tokens
      const authUrl = `${API_URL}/api/v1/auth/google/mobile-start`;
      const result = await WebBrowser.openAuthSessionAsync(authUrl, 'jocasta://');

      if (result.type === 'success' && result.url) {
        // Parse tokens from the callback URL
        const urlObj = new URL(result.url);
        const accessToken = urlObj.searchParams.get('access_token');
        const refreshToken = urlObj.searchParams.get('refresh_token');

        if (accessToken && refreshToken) {
          await login({ accessToken, refreshToken, expiresIn: 900 });
          router.replace('/(tabs)');
        } else {
          setError('No tokens received');
        }
      } else if (result.type === 'cancel') {
        // User cancelled
      }
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err.message || 'Failed to open login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.logo}>Jocasta</Text>
        <Text style={styles.tagline}>Your intelligent scheduling assistant</Text>
      </View>

      <View style={styles.content}>
        <Text style={styles.title}>Welcome</Text>
        <Text style={styles.subtitle}>Sign in to manage your schedule</Text>

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <TouchableOpacity
          style={styles.googleButton}
          onPress={handleGoogleLogin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Text style={styles.googleIcon}>G</Text>
              <Text style={styles.googleText}>Continue with Google</Text>
            </>
          )}
        </TouchableOpacity>

        <Text style={styles.terms}>
          By signing in, you agree to our Terms of Service and Privacy Policy
        </Text>

        <TouchableOpacity
          style={styles.demoButton}
          onPress={() => {
            useAuthStore.getState().setDemoMode();
            router.replace('/(tabs)');
          }}
        >
          <Text style={styles.demoButtonText}>Try Demo (Elena's Schedule)</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  header: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
  },
  logo: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#fff',
  },
  tagline: {
    fontSize: 16,
    color: '#888',
    marginTop: 8,
  },
  content: {
    flex: 2,
    paddingHorizontal: 32,
    paddingTop: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#888',
    marginBottom: 32,
  },
  errorBox: {
    backgroundColor: '#ef4444',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    color: '#fff',
    textAlign: 'center',
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4285f4',
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  googleIcon: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginRight: 12,
  },
  googleText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  terms: {
    color: '#666',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
  demoButton: {
    marginTop: 24,
    padding: 16,
    backgroundColor: '#2d2d44',
    borderRadius: 12,
    alignItems: 'center',
  },
  demoButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
});
