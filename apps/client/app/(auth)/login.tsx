import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Linking, TextInput, Platform, KeyboardAvoidingView, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';

import { useAuthStore } from '../../src/store/authStore';
import { useThemeStore } from '../../src/store/themeStore';

// Apple Authentication - only available on iOS native
let AppleAuthentication: typeof import('expo-apple-authentication') | null = null;
if (Platform.OS === 'ios') {
  try {
    AppleAuthentication = require('expo-apple-authentication');
  } catch {
    // Not available
  }
}

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';

export default function LoginScreen() {
  const router = useRouter();
  const { colors } = useThemeStore();
  const login = useAuthStore((s) => s.login);
  const loginWithPassword = useAuthStore((s) => s.loginWithPassword);
  const loginWithApple = useAuthStore((s) => s.loginWithApple);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Email/password form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showEmailForm, setShowEmailForm] = useState(false);

  // Apple auth availability
  const [appleAuthAvailable, setAppleAuthAvailable] = useState(false);

  useEffect(() => {
    // Check if Apple Authentication is available
    if (Platform.OS === 'ios' && AppleAuthentication) {
      AppleAuthentication.isAvailableAsync().then(setAppleAuthAvailable);
    }
  }, []);

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
      const authUrl = `${API_URL}/api/v1/auth/google/mobile-start`;

      // On web, just redirect to the auth URL
      if (Platform.OS === 'web') {
        window.location.href = authUrl;
        return;
      }

      // On mobile, use WebBrowser
      const result = await WebBrowser.openAuthSessionAsync(authUrl, 'jocasta://');

      if (result.type === 'success' && result.url) {
        const urlObj = new URL(result.url);
        const accessToken = urlObj.searchParams.get('access_token');
        const refreshToken = urlObj.searchParams.get('refresh_token');

        if (accessToken && refreshToken) {
          await login({ accessToken, refreshToken, expiresIn: 900 });
          router.replace('/(tabs)');
        } else {
          setError('No tokens received');
        }
      }
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err.message || 'Failed to open login');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailLogin = async () => {
    if (!email || !password) {
      setError('Please enter email and password');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      await loginWithPassword(email, password);
      router.replace('/(tabs)');
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleAppleLogin = async () => {
    if (!AppleAuthentication) return;

    setError(null);
    setLoading(true);

    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      const fullName = credential.fullName
        ? `${credential.fullName.givenName || ''} ${credential.fullName.familyName || ''}`.trim()
        : undefined;

      await loginWithApple(credential.user, credential.email || undefined, fullName);
      router.replace('/(tabs)');
    } catch (err: any) {
      if (err.code === 'ERR_CANCELED') {
        // User cancelled
      } else {
        console.error('Apple login error:', err);
        setError(err.message || 'Apple Sign-In failed');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={[styles.logo, { color: colors.primary }]}>J.</Text>
          <Text style={[styles.logoFull, { color: colors.text }]}>J.O.C.A.S.T.A.</Text>
          <Text style={[styles.tagline, { color: colors.textMuted }]}>
            Your intelligent scheduling assistant
          </Text>
        </View>

        <View style={styles.content}>
          <Text style={[styles.title, { color: colors.text }]}>Welcome</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            Sign in to manage your schedule
          </Text>

          {error && (
            <View style={[styles.errorBox, { backgroundColor: colors.error }]}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Email/Password Form */}
          {showEmailForm ? (
            <View style={styles.emailForm}>
              <TextInput
                style={[styles.input, { backgroundColor: colors.card, color: colors.text }]}
                placeholder="Email"
                placeholderTextColor={colors.textMuted}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
              />
              <TextInput
                style={[styles.input, { backgroundColor: colors.card, color: colors.text }]}
                placeholder="Password"
                placeholderTextColor={colors.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoComplete="password"
              />
              <TouchableOpacity
                style={[styles.emailLoginButton, { backgroundColor: colors.primary }]}
                onPress={handleEmailLogin}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.emailLoginText}>Sign In</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => setShowEmailForm(false)}
              >
                <Text style={[styles.backButtonText, { color: colors.textMuted }]}>
                  Back to other options
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {/* Google Sign-In */}
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

              {/* Apple Sign-In (iOS only) */}
              {(Platform.OS === 'ios' && appleAuthAvailable && AppleAuthentication) && (
                <AppleAuthentication.AppleAuthenticationButton
                  buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                  buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                  cornerRadius={12}
                  style={styles.appleButton}
                  onPress={handleAppleLogin}
                />
              )}

              {/* Email Sign-In Option */}
              <TouchableOpacity
                style={[styles.emailButton, { backgroundColor: colors.card }]}
                onPress={() => setShowEmailForm(true)}
              >
                <Text style={styles.emailIcon}>@</Text>
                <Text style={[styles.emailButtonText, { color: colors.text }]}>
                  Sign in with Email
                </Text>
              </TouchableOpacity>
            </>
          )}

          <Text style={[styles.terms, { color: colors.textMuted }]}>
            By signing in, you agree to our Terms of Service and Privacy Policy
          </Text>

          <TouchableOpacity
            style={[styles.demoButton, { backgroundColor: colors.card }]}
            onPress={() => {
              useAuthStore.getState().setDemoMode();
              router.replace('/(tabs)');
            }}
          >
            <Text style={[styles.demoButtonText, { color: colors.text }]}>
              Try Demo (Elena's Schedule)
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  header: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
    minHeight: 200,
  },
  logo: {
    fontSize: 72,
    fontWeight: 'bold',
  },
  logoFull: {
    fontSize: 24,
    fontWeight: '600',
    letterSpacing: 2,
    marginTop: 8,
  },
  tagline: {
    fontSize: 16,
    marginTop: 8,
  },
  content: {
    flex: 2,
    paddingHorizontal: 32,
    paddingTop: 40,
    paddingBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 32,
  },
  errorBox: {
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
    marginBottom: 12,
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
  appleButton: {
    height: 52,
    width: '100%',
    marginBottom: 12,
  },
  emailButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  emailIcon: {
    color: '#888',
    fontSize: 20,
    fontWeight: 'bold',
    marginRight: 12,
  },
  emailButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  emailForm: {
    marginBottom: 24,
  },
  input: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    fontSize: 16,
    marginBottom: 12,
  },
  emailLoginButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  emailLoginText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  backButton: {
    alignItems: 'center',
    padding: 12,
  },
  backButtonText: {
    fontSize: 14,
  },
  terms: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
  demoButton: {
    marginTop: 24,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  demoButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
});
