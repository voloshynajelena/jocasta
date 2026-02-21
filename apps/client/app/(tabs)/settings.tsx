import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Alert } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';

import { useAuthStore } from '../../src/store/authStore';
import {
  DEMO_SETTINGS,
  DEMO_GOOGLE_SYNC,
  DEMO_USER,
  DEMO_BUFFER_RULES,
  DEMO_CONSTRAINTS,
  TransportMode,
} from '../../src/data/demoData';

export default function SettingsScreen() {
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const isDemoMode = user?.id === 'demo-user';

  const [weatherAlerts, setWeatherAlerts] = useState(DEMO_SETTINGS.notifications.weatherAlerts);
  const [trafficAlerts, setTrafficAlerts] = useState(DEMO_SETTINGS.notifications.trafficAlerts);
  const [leaveByReminders, setLeaveByReminders] = useState(DEMO_SETTINGS.notifications.leaveByReminders);
  const [googleSyncEnabled, setGoogleSyncEnabled] = useState(DEMO_SETTINGS.privacy.googleSyncEnabled);
  const [sendNotesToAI, setSendNotesToAI] = useState(DEMO_SETTINGS.privacy.sendNotesToAI);
  const [weatherInfluence, setWeatherInfluence] = useState(DEMO_SETTINGS.privacy.weatherInfluence);
  const [transportMode, setTransportMode] = useState<TransportMode>(DEMO_USER.defaultTransportMode);

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
        <View style={styles.authPrompt}>
          <Text style={styles.authTitle}>Settings</Text>
          <Text style={styles.authSubtitle}>Sign in to customize your experience</Text>
          <TouchableOpacity
            style={styles.signInButton}
            onPress={() => router.push('/(auth)/login')}
          >
            <Text style={styles.signInText}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const displayUser = isDemoMode ? DEMO_USER : user;

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <Text style={styles.header}>Settings</Text>

      {/* Profile Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>PROFILE</Text>
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {displayUser?.name?.[0] || displayUser?.email?.[0] || '?'}
            </Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{displayUser?.name || 'User'}</Text>
            <Text style={styles.profileEmail}>{displayUser?.email}</Text>
            <Text style={styles.profileTimezone}>📍 Calgary, AB • America/Edmonton</Text>
            {isDemoMode && (
              <View style={styles.demoBadge}>
                <Text style={styles.demoBadgeText}>Demo Mode</Text>
              </View>
            )}
          </View>
        </View>
      </View>

      {/* Transport Mode */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>DEFAULT TRANSPORT</Text>
        <View style={styles.transportModes}>
          {(['sedan', 'motorcycle', 'taxi', 'transit'] as TransportMode[]).map(mode => (
            <TouchableOpacity
              key={mode}
              style={[styles.transportMode, transportMode === mode && styles.transportModeActive]}
              onPress={() => setTransportMode(mode)}
            >
              <Text style={styles.transportIcon}>{getTransportIcon(mode)}</Text>
              <Text style={[styles.transportLabel, transportMode === mode && styles.transportLabelActive]}>
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Integrations */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>INTEGRATIONS</Text>

        <View style={styles.integrationCard}>
          <View style={styles.integrationHeader}>
            <Text style={styles.integrationIcon}>📅</Text>
            <View style={styles.integrationInfo}>
              <Text style={styles.integrationName}>Google Calendar</Text>
              <Text style={styles.integrationStatus}>
                {DEMO_GOOGLE_SYNC.isConnected
                  ? `Synced ${formatLastSync(DEMO_GOOGLE_SYNC.lastSyncAt)}`
                  : 'Not connected'}
              </Text>
            </View>
            <View style={[styles.statusBadge, DEMO_GOOGLE_SYNC.isConnected && styles.statusBadgeConnected]}>
              <Text style={[styles.statusBadgeText, DEMO_GOOGLE_SYNC.isConnected && styles.statusBadgeTextConnected]}>
                {DEMO_GOOGLE_SYNC.isConnected ? 'Connected' : 'Connect'}
              </Text>
            </View>
          </View>
          {DEMO_GOOGLE_SYNC.isConnected && (
            <View style={styles.integrationDetails}>
              <Text style={styles.integrationDetail}>
                • Managing calendar: "Jocasta Managed"
              </Text>
              <Text style={styles.integrationDetail}>
                • Importing from: Primary calendar
              </Text>
            </View>
          )}
        </View>

        <View style={styles.integrationCard}>
          <View style={styles.integrationHeader}>
            <Text style={styles.integrationIcon}>📱</Text>
            <View style={styles.integrationInfo}>
              <Text style={styles.integrationName}>Telegram Bot</Text>
              <Text style={styles.integrationStatus}>
                {DEMO_SETTINGS.telegram.connected
                  ? `@${DEMO_SETTINGS.telegram.username?.replace('@', '')}`
                  : 'Not connected'}
              </Text>
            </View>
            <View style={[styles.statusBadge, DEMO_SETTINGS.telegram.connected && styles.statusBadgeConnected]}>
              <Text style={[styles.statusBadgeText, DEMO_SETTINGS.telegram.connected && styles.statusBadgeTextConnected]}>
                {DEMO_SETTINGS.telegram.connected ? 'Connected' : 'Connect'}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Notifications */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>NOTIFICATIONS</Text>

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Leave-By Reminders</Text>
            <Text style={styles.settingDesc}>Get notified when to leave for events</Text>
          </View>
          <Switch
            value={leaveByReminders}
            onValueChange={setLeaveByReminders}
            trackColor={{ false: '#4b5563', true: '#3b82f6' }}
            thumbColor="#fff"
          />
        </View>

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Weather Alerts</Text>
            <Text style={styles.settingDesc}>Adjust travel time for weather</Text>
          </View>
          <Switch
            value={weatherAlerts}
            onValueChange={setWeatherAlerts}
            trackColor={{ false: '#4b5563', true: '#3b82f6' }}
            thumbColor="#fff"
          />
        </View>

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Traffic Alerts</Text>
            <Text style={styles.settingDesc}>Get notified about delays</Text>
          </View>
          <Switch
            value={trafficAlerts}
            onValueChange={setTrafficAlerts}
            trackColor={{ false: '#4b5563', true: '#3b82f6' }}
            thumbColor="#fff"
          />
        </View>

        <TouchableOpacity style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Reminder Times</Text>
            <Text style={styles.settingDesc}>
              {DEMO_SETTINGS.notifications.reminderMinutesBefore.map(m =>
                m >= 60 ? `${m/60}h` : `${m}m`
              ).join(', ')} before
            </Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Smart Buffers */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>SMART BUFFERS</Text>
        <Text style={styles.sectionSubtitle}>Automatic buffer time between events</Text>

        {DEMO_BUFFER_RULES.slice(0, 5).map((buffer, idx) => (
          <TouchableOpacity key={idx} style={styles.bufferRow}>
            <Text style={styles.bufferIcon}>{getEventTypeIcon(buffer.eventType)}</Text>
            <View style={styles.bufferInfo}>
              <Text style={styles.bufferType}>{formatEventType(buffer.eventType)}</Text>
              <Text style={styles.bufferValue}>
                +{buffer.beforeMinutes}m before • +{buffer.afterMinutes}m after
              </Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Constraints */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>SCHEDULE CONSTRAINTS</Text>

        {DEMO_CONSTRAINTS.map((constraint, idx) => (
          <View key={idx} style={styles.constraintRow}>
            <Text style={styles.constraintIcon}>{getConstraintIcon(constraint.type)}</Text>
            <View style={styles.constraintInfo}>
              <Text style={styles.constraintType}>{formatConstraintType(constraint.type)}</Text>
              <Text style={styles.constraintValue}>{formatConstraintValue(constraint)}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* Privacy */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>PRIVACY</Text>

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Google Calendar Sync</Text>
            <Text style={styles.settingDesc}>Sync events with Google</Text>
          </View>
          <Switch
            value={googleSyncEnabled}
            onValueChange={setGoogleSyncEnabled}
            trackColor={{ false: '#4b5563', true: '#3b82f6' }}
            thumbColor="#fff"
          />
        </View>

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Send Notes to AI</Text>
            <Text style={styles.settingDesc}>Include event notes in AI analysis</Text>
          </View>
          <Switch
            value={sendNotesToAI}
            onValueChange={setSendNotesToAI}
            trackColor={{ false: '#4b5563', true: '#3b82f6' }}
            thumbColor="#fff"
          />
        </View>

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Weather Influence</Text>
            <Text style={styles.settingDesc}>Adjust ETAs based on weather</Text>
          </View>
          <Switch
            value={weatherInfluence}
            onValueChange={setWeatherInfluence}
            trackColor={{ false: '#4b5563', true: '#3b82f6' }}
            thumbColor="#fff"
          />
        </View>
      </View>

      {/* Account */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>ACCOUNT</Text>
        <TouchableOpacity style={styles.dangerButton} onPress={handleLogout}>
          <Text style={styles.dangerButtonText}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.footer}>
        <Text style={styles.logoText}>J.O.C.A.S.T.A.</Text>
        <Text style={styles.footerText}>Your Intelligent Schedule Assistant</Text>
        <Text style={styles.versionText}>Version 1.0.0</Text>
      </View>
    </ScrollView>
  );
}

// Helper Functions
function getTransportIcon(mode: TransportMode): string {
  const icons: Record<TransportMode, string> = {
    sedan: '🚗',
    motorcycle: '🏍️',
    taxi: '🚕',
    transit: '🚌',
  };
  return icons[mode];
}

function getEventTypeIcon(type: string): string {
  const icons: Record<string, string> = {
    appointment: '🏥',
    client_training: '🎯',
    personal_workout: '💪',
    dog_walk: '🐕',
    kids_dropoff: '🚸',
    kids_pickup: '🚸',
    fueling: '⛽',
    shopping: '🛒',
    home_chores: '🏠',
    meeting: '💼',
  };
  return icons[type] || '📅';
}

function formatEventType(type: string): string {
  const labels: Record<string, string> = {
    appointment: 'Appointments',
    client_training: 'Client Training',
    personal_workout: 'Workouts',
    dog_walk: 'Dog Walking',
    kids_dropoff: 'Kids Drop-off',
    kids_pickup: 'Kids Pick-up',
    fueling: 'Fueling',
    shopping: 'Shopping',
    home_chores: 'Home Chores',
    meeting: 'Meetings',
  };
  return labels[type] || type;
}

function getConstraintIcon(type: string): string {
  const icons: Record<string, string> = {
    sleep: '😴',
    work: '💼',
    quiet_hours: '🔕',
    min_gap: '⏱️',
    max_travel: '🚗',
    preferred_mode: '🎯',
  };
  return icons[type] || '⚙️';
}

function formatConstraintType(type: string): string {
  const labels: Record<string, string> = {
    sleep: 'Sleep Schedule',
    work: 'Work Hours',
    quiet_hours: 'Quiet Hours',
    min_gap: 'Minimum Gap',
    max_travel: 'Max Daily Travel',
    preferred_mode: 'Preferred Transport',
  };
  return labels[type] || type;
}

function formatConstraintValue(constraint: any): string {
  switch (constraint.type) {
    case 'sleep':
      return `${constraint.config.start} - ${constraint.config.end}`;
    case 'work':
      return `${constraint.config.start} - ${constraint.config.end} (Mon-Fri)`;
    case 'quiet_hours':
      return `${constraint.config.start} - ${constraint.config.end}`;
    case 'min_gap':
      return `${constraint.config.minutes} minutes between events`;
    case 'max_travel':
      return `${constraint.config.minutesPerDay} min/day`;
    case 'preferred_mode':
      return `${constraint.config.mode}, fallback: ${constraint.config.fallback}`;
    default:
      return '';
  }
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    padding: 16,
  },
  authPrompt: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  authTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  authSubtitle: {
    fontSize: 16,
    color: '#888',
    marginBottom: 32,
  },
  signInButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
  },
  signInText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
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
    fontSize: 12,
    fontWeight: '600',
    color: '#888',
    letterSpacing: 1,
    marginBottom: 12,
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
  profileTimezone: {
    color: '#666',
    fontSize: 12,
    marginTop: 4,
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
  transportModes: {
    flexDirection: 'row',
    gap: 10,
  },
  transportMode: {
    flex: 1,
    backgroundColor: '#2d2d44',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  transportModeActive: {
    borderColor: '#3b82f6',
    backgroundColor: '#3b82f620',
  },
  transportIcon: {
    fontSize: 24,
    marginBottom: 6,
  },
  transportLabel: {
    color: '#888',
    fontSize: 12,
    fontWeight: '500',
  },
  transportLabelActive: {
    color: '#fff',
  },
  integrationCard: {
    backgroundColor: '#2d2d44',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
  },
  integrationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  integrationIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  integrationInfo: {
    flex: 1,
  },
  integrationName: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '500',
  },
  integrationStatus: {
    color: '#888',
    fontSize: 13,
    marginTop: 2,
  },
  integrationDetails: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#3d3d5c',
  },
  integrationDetail: {
    color: '#666',
    fontSize: 12,
    marginBottom: 4,
  },
  statusBadge: {
    backgroundColor: '#3d3d5c',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  statusBadgeConnected: {
    backgroundColor: '#10b98120',
  },
  statusBadgeText: {
    color: '#888',
    fontSize: 12,
    fontWeight: '600',
  },
  statusBadgeTextConnected: {
    color: '#10b981',
  },
  settingRow: {
    flexDirection: 'row',
    backgroundColor: '#2d2d44',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    alignItems: 'center',
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
  chevron: {
    color: '#666',
    fontSize: 22,
    marginLeft: 8,
  },
  bufferRow: {
    flexDirection: 'row',
    backgroundColor: '#2d2d44',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    alignItems: 'center',
  },
  bufferIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  bufferInfo: {
    flex: 1,
  },
  bufferType: {
    color: '#fff',
    fontSize: 14,
  },
  bufferValue: {
    color: '#888',
    fontSize: 12,
    marginTop: 2,
  },
  constraintRow: {
    flexDirection: 'row',
    backgroundColor: '#2d2d44',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    alignItems: 'center',
  },
  constraintIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  constraintInfo: {
    flex: 1,
  },
  constraintType: {
    color: '#fff',
    fontSize: 14,
  },
  constraintValue: {
    color: '#888',
    fontSize: 12,
    marginTop: 2,
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
    paddingBottom: 100,
  },
  logoText: {
    color: '#3b82f6',
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 2,
    marginBottom: 4,
  },
  footerText: {
    color: '#666',
    fontSize: 13,
    marginBottom: 4,
  },
  versionText: {
    color: '#4b5563',
    fontSize: 11,
  },
});
