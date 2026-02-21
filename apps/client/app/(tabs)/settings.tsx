import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Alert } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';

import { api } from '../../src/services/api';
import { useAuthStore } from '../../src/store/authStore';
import { DEMO_SETTINGS, DEMO_GOOGLE_STATUS, DEMO_USER } from '../../src/data/mockData';

export default function SettingsScreen() {
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const isDemoMode = user?.id === 'demo-user';

  const [weatherAlerts, setWeatherAlerts] = useState(true);
  const [trafficAlerts, setTrafficAlerts] = useState(true);

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: () => api.getSettings(),
    enabled: isAuthenticated && !isDemoMode,
  });

  const { data: googleStatus } = useQuery({
    queryKey: ['google-status'],
    queryFn: () => api.getGoogleSyncStatus(),
    enabled: isAuthenticated && !isDemoMode,
  });

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  if (!isAuthenticated) {
    return (
      <View style={styles.container}>
        <Text style={styles.authText}>Sign in to view settings</Text>
      </View>
    );
  }

  // Use mock data in demo mode
  const currentSettings = isDemoMode ? DEMO_SETTINGS : settings;
  const currentGoogleStatus = isDemoMode ? DEMO_GOOGLE_STATUS : googleStatus;
  const displayUser = isDemoMode ? { ...DEMO_USER, name: 'Elena' } : user;

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.header}>Settings</Text>

      {/* Profile Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Profile</Text>
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {displayUser?.name?.[0] || displayUser?.email?.[0] || '?'}
            </Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{displayUser?.name || 'User'}</Text>
            <Text style={styles.profileEmail}>{displayUser?.email}</Text>
            {isDemoMode && (
              <View style={styles.demoBadge}>
                <Text style={styles.demoBadgeText}>Demo Mode</Text>
              </View>
            )}
          </View>
        </View>
      </View>

      {/* Lifestyle Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Your Lifestyle</Text>
        <View style={styles.lifestyleCard}>
          <View style={styles.lifestyleItem}>
            <Text style={styles.lifestyleEmoji}>👩‍💼</Text>
            <Text style={styles.lifestyleText}>Working Mom</Text>
          </View>
          <View style={styles.lifestyleItem}>
            <Text style={styles.lifestyleEmoji}>👧👦</Text>
            <Text style={styles.lifestyleText}>2 kids (9 & 11)</Text>
          </View>
          <View style={styles.lifestyleItem}>
            <Text style={styles.lifestyleEmoji}>🐕</Text>
            <Text style={styles.lifestyleText}>Dog: Max</Text>
          </View>
          <View style={styles.lifestyleItem}>
            <Text style={styles.lifestyleEmoji}>💪</Text>
            <Text style={styles.lifestyleText}>Gym 3x/week</Text>
          </View>
          <View style={styles.lifestyleItem}>
            <Text style={styles.lifestyleEmoji}>🏢</Text>
            <Text style={styles.lifestyleText}>Downtown Office</Text>
          </View>
        </View>
      </View>

      {/* Integrations Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Integrations</Text>

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Google Calendar</Text>
            <Text style={styles.settingDesc}>
              {currentGoogleStatus?.isConnected
                ? `Synced ${formatLastSync(currentGoogleStatus.lastSyncAt)}`
                : 'Not connected'}
            </Text>
          </View>
          <View
            style={[
              styles.statusDot,
              { backgroundColor: currentGoogleStatus?.isConnected ? '#10b981' : '#6b7280' },
            ]}
          />
        </View>

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Telegram Bot</Text>
            <Text style={styles.settingDesc}>Quick voice commands</Text>
          </View>
          <View style={[styles.statusDot, { backgroundColor: '#6b7280' }]} />
        </View>
      </View>

      {/* Smart Buffers Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Smart Buffers</Text>
        <Text style={styles.sectionSubtitle}>
          Automatic buffer time between events
        </Text>

        {currentSettings?.buffers?.map((buffer: any, idx: number) => (
          <View key={idx} style={styles.bufferRow}>
            <Text style={styles.bufferType}>{formatEventType(buffer.eventType)}</Text>
            <Text style={styles.bufferValue}>
              {buffer.beforeMinutes}min before · {buffer.afterMinutes}min after
            </Text>
          </View>
        ))}
      </View>

      {/* Notifications Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Notifications</Text>

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Weather Alerts</Text>
            <Text style={styles.settingDesc}>Get notified about weather impacts</Text>
          </View>
          <Switch
            value={weatherAlerts}
            onValueChange={setWeatherAlerts}
            trackColor={{ false: '#4b5563', true: '#3b82f6' }}
          />
        </View>

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Traffic Alerts</Text>
            <Text style={styles.settingDesc}>Get notified about traffic delays</Text>
          </View>
          <Switch
            value={trafficAlerts}
            onValueChange={setTrafficAlerts}
            trackColor={{ false: '#4b5563', true: '#3b82f6' }}
          />
        </View>

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Reminder Times</Text>
            <Text style={styles.settingDesc}>15 minutes & 1 hour before</Text>
          </View>
          <Text style={styles.settingChevron}>›</Text>
        </View>
      </View>

      {/* Account Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>

        <TouchableOpacity style={styles.dangerButton} onPress={handleLogout}>
          <Text style={styles.dangerButtonText}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Jocasta v1.0.0</Text>
        <Text style={styles.footerText}>Your intelligent scheduling assistant</Text>
      </View>
    </ScrollView>
  );
}

function formatLastSync(dateStr: string | null): string {
  if (!dateStr) return 'never';
  const date = new Date(dateStr);
  const diffMins = Math.round((Date.now() - date.getTime()) / 1000 / 60);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.round(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return date.toLocaleDateString();
}

function formatEventType(type: string): string {
  const labels: Record<string, string> = {
    meeting: '🏢 Meetings',
    appointment: '🏥 Appointments',
    personal_workout: '💪 Workouts',
    kids_activity: '👧 Kids Activities',
  };
  return labels[type] || type;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    padding: 16,
  },
  authText: {
    color: '#888',
    textAlign: 'center',
    marginTop: 100,
  },
  header: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 24,
  },
  section: {
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#888',
    textTransform: 'uppercase',
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#666',
    marginTop: -8,
    marginBottom: 12,
  },
  profileCard: {
    flexDirection: 'row',
    backgroundColor: '#2d2d44',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  profileInfo: {
    marginLeft: 16,
    flex: 1,
  },
  profileName: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  profileEmail: {
    color: '#888',
    fontSize: 14,
    marginTop: 2,
  },
  demoBadge: {
    backgroundColor: '#f59e0b20',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  demoBadgeText: {
    color: '#f59e0b',
    fontSize: 11,
    fontWeight: '600',
  },
  lifestyleCard: {
    backgroundColor: '#2d2d44',
    borderRadius: 12,
    padding: 16,
  },
  lifestyleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  lifestyleEmoji: {
    fontSize: 20,
    width: 36,
  },
  lifestyleText: {
    color: '#fff',
    fontSize: 15,
  },
  settingRow: {
    flexDirection: 'row',
    backgroundColor: '#2d2d44',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  settingInfo: {
    flex: 1,
  },
  settingLabel: {
    color: '#fff',
    fontSize: 15,
  },
  settingDesc: {
    color: '#888',
    fontSize: 13,
    marginTop: 2,
  },
  settingChevron: {
    color: '#666',
    fontSize: 24,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  bufferRow: {
    backgroundColor: '#2d2d44',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  bufferType: {
    color: '#fff',
    fontSize: 15,
    marginBottom: 4,
  },
  bufferValue: {
    color: '#888',
    fontSize: 13,
  },
  dangerButton: {
    backgroundColor: '#ef4444',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  dangerButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  footerText: {
    color: '#4b5563',
    fontSize: 12,
    marginBottom: 4,
  },
});
