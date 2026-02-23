import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Alert, Modal, TextInput, ActivityIndicator } from 'react-native';
import { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';

import { useAuthStore } from '../../src/store/authStore';
import { useThemeStore, ThemeMode } from '../../src/store/themeStore';
import { useSettingsStore, TAXI_PROVIDERS, TaxiProvider, TransportMode, Constraint } from '../../src/store/settingsStore';
import {
  DEMO_SETTINGS,
  DEMO_GOOGLE_SYNC,
  DEMO_USER,
} from '../../src/data/demoData';

export default function SettingsScreen() {
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const isAdmin = useAuthStore((s) => s.isAdmin);
  const isDemoMode = user?.id === 'demo-user';

  const { colors, mode, setTheme } = useThemeStore();
  const {
    taxiProvider,
    setTaxiProvider,
    transportMode,
    setTransportMode: setStoreTransportMode,
    bufferRules,
    updateBufferRule,
    constraints,
    updateConstraint,
  } = useSettingsStore();

  const [weatherAlerts, setWeatherAlerts] = useState(DEMO_SETTINGS.notifications.weatherAlerts);
  const [trafficAlerts, setTrafficAlerts] = useState(DEMO_SETTINGS.notifications.trafficAlerts);
  const [leaveByReminders, setLeaveByReminders] = useState(DEMO_SETTINGS.notifications.leaveByReminders);
  const [googleSyncEnabled, setGoogleSyncEnabled] = useState(DEMO_SETTINGS.privacy.googleSyncEnabled);
  const [sendNotesToAI, setSendNotesToAI] = useState(DEMO_SETTINGS.privacy.sendNotesToAI);
  const [weatherInfluence, setWeatherInfluence] = useState(DEMO_SETTINGS.privacy.weatherInfluence);

  // Buffer editing modal state
  const [bufferModalVisible, setBufferModalVisible] = useState(false);
  const [editingBuffer, setEditingBuffer] = useState<{ eventType: string; before: string; after: string } | null>(null);

  // Constraint editing modal state
  const [constraintModalVisible, setConstraintModalVisible] = useState(false);
  const [editingConstraint, setEditingConstraint] = useState<{ type: string; config: Record<string, string> } | null>(null);

  // Google Calendar sync state
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<{ isConnected: boolean; lastSyncAt: string | null } | null>(null);

  // Google Calendar settings
  const [lockGoogleEvents, setLockGoogleEvents] = useState(true);
  const [includeGoogleInPlanning, setIncludeGoogleInPlanning] = useState(true);

  // Home location state
  const [homeLocation, setHomeLocation] = useState<{ id: string; name: string; address: string } | null>(null);
  const [homeLocationModalVisible, setHomeLocationModalVisible] = useState(false);
  const [homeAddressInput, setHomeAddressInput] = useState('');
  const [savingHome, setSavingHome] = useState(false);
  const [homeSuggestions, setHomeSuggestions] = useState<Array<{ placeId: string; name: string; address: string }>>([]);
  const [loadingHomeSuggestions, setLoadingHomeSuggestions] = useState(false);

  const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';

  // Get access token for API calls
  const getAccessToken = (): string | null => {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem('accessToken');
    }
    return null;
  };

  // Fetch Google Calendar sync status and user settings
  useEffect(() => {
    if (!isDemoMode && isAuthenticated) {
      fetchSyncStatus();
      fetchUserSettings();
      fetchHomeLocation();
    }
  }, [isDemoMode, isAuthenticated]);

  const fetchHomeLocation = async () => {
    try {
      const token = getAccessToken();
      if (!token) return;
      const response = await fetch(`${API_URL}/api/v1/locations`, {
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      if (response.ok) {
        const data = await response.json();
        const defaultLoc = data.locations?.find((l: any) => l.isDefault);
        if (defaultLoc) {
          setHomeLocation({ id: defaultLoc.id, name: defaultLoc.name, address: defaultLoc.address });
        }
      }
    } catch (err) {
      console.error('Failed to fetch home location:', err);
    }
  };

  // Search for home address suggestions
  useEffect(() => {
    if (!homeLocationModalVisible || homeAddressInput.length < 3) {
      setHomeSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      const token = getAccessToken();
      if (!token) return;

      setLoadingHomeSuggestions(true);
      try {
        const response = await fetch(
          `${API_URL}/api/v1/locations/search?q=${encodeURIComponent(homeAddressInput)}`,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            credentials: 'include',
          }
        );
        if (response.ok) {
          const data = await response.json();
          setHomeSuggestions(data.suggestions || []);
        }
      } catch (err) {
        console.error('Failed to search addresses:', err);
      } finally {
        setLoadingHomeSuggestions(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [homeAddressInput, homeLocationModalVisible]);

  const saveHomeLocation = async (selectedAddress?: string) => {
    const addressToSave = selectedAddress || homeAddressInput.trim();
    if (!addressToSave) return;
    const token = getAccessToken();
    if (!token) return;

    setSavingHome(true);
    try {
      // Create or update home location
      const method = homeLocation ? 'PUT' : 'POST';
      const url = homeLocation
        ? `${API_URL}/api/v1/locations/${homeLocation.id}`
        : `${API_URL}/api/v1/locations`;

      const response = await fetch(url, {
        method,
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Home',
          address: homeAddressInput.trim(),
          isDefault: true,
        }),
      });

      if (response.ok) {
        const saved = await response.json();
        setHomeLocation({ id: saved.id, name: saved.name, address: saved.address });
        setHomeLocationModalVisible(false);
      } else {
        const err = await response.json().catch(() => ({}));
        window.alert(err.message || 'Failed to save location');
      }
    } catch (err: any) {
      window.alert(err.message || 'Failed to save location');
    } finally {
      setSavingHome(false);
    }
  };

  const fetchUserSettings = async () => {
    try {
      const token = getAccessToken();
      if (!token) {
        console.log('No access token for settings fetch');
        return;
      }
      console.log('Fetching user settings...');
      const response = await fetch(`${API_URL}/api/v1/settings`, {
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      if (response.ok) {
        const data = await response.json();
        console.log('User settings received:', data);
        if (data.googleCalendar) {
          setLockGoogleEvents(data.googleCalendar.lockGoogleEvents ?? true);
          setIncludeGoogleInPlanning(data.googleCalendar.includeGoogleInPlanning ?? true);
        }
      } else {
        console.error('Settings fetch failed:', response.status);
      }
    } catch (err) {
      console.error('Failed to fetch user settings:', err);
    }
  };

  const updateGoogleCalendarSetting = async (key: 'lockGoogleEvents' | 'includeGoogleInPlanning', value: boolean) => {
    const token = getAccessToken();
    if (!token) {
      console.error('No access token for settings update');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/v1/settings`, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ [key]: value }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Settings update failed:', response.status, errorData);
      } else {
        console.log(`Updated ${key} to ${value}`);
      }
    } catch (err) {
      console.error('Failed to update setting:', err);
    }
  };

  const fetchSyncStatus = async () => {
    try {
      const token = getAccessToken();
      if (!token) {
        console.log('No access token available for sync status');
        return;
      }
      const response = await fetch(`${API_URL}/api/v1/integrations/google/status`, {
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      if (response.ok) {
        const data = await response.json();
        setSyncStatus(data);
      } else {
        console.error('Sync status failed:', response.status);
      }
    } catch (err) {
      console.error('Failed to fetch sync status:', err);
    }
  };

  const handleSyncCalendar = async () => {
    const token = getAccessToken();
    if (!token) {
      Alert.alert('Error', 'Please sign in again to sync calendar');
      return;
    }

    setSyncing(true);
    try {
      const response = await fetch(`${API_URL}/api/v1/integrations/google/sync`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      const data = await response.json();
      if (data.success) {
        Alert.alert('Sync Complete', `Imported: ${data.imported}, Updated: ${data.updated}, Deleted: ${data.deleted}`);
        fetchSyncStatus();
      } else {
        Alert.alert('Sync Failed', data.error || data.errors?.[0] || 'Unknown error');
      }
    } catch (err: any) {
      Alert.alert('Sync Error', err.message);
    } finally {
      setSyncing(false);
    }
  };

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
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} showsVerticalScrollIndicator={false}>
      <Text style={[styles.header, { color: colors.text }]}>Settings</Text>

      {/* Profile Section */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>PROFILE</Text>
        <View style={[styles.profileCard, { backgroundColor: colors.card }]}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {displayUser?.name?.[0] || displayUser?.email?.[0] || '?'}
            </Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={[styles.profileName, { color: colors.text }]}>{displayUser?.name || 'User'}</Text>
            <Text style={[styles.profileEmail, { color: colors.textMuted }]}>{displayUser?.email}</Text>
            <Text style={[styles.profileTimezone, { color: colors.textMuted }]}>📍 Calgary, AB • America/Edmonton</Text>
            {isDemoMode && (
              <View style={styles.demoBadge}>
                <Text style={styles.demoBadgeText}>Demo Mode</Text>
              </View>
            )}
          </View>
        </View>
      </View>

      {/* Home Location Section */}
      {!isDemoMode && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>HOME LOCATION</Text>
          <TouchableOpacity
            style={[styles.settingRow, { backgroundColor: colors.card }]}
            onPress={() => {
              setHomeAddressInput(homeLocation?.address || '');
              setHomeLocationModalVisible(true);
            }}
          >
            <Text style={styles.homeIcon}>🏠</Text>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingLabel, { color: colors.text }]}>
                {homeLocation ? homeLocation.name : 'Set Home Address'}
              </Text>
              <Text style={[styles.settingDesc, { color: colors.textMuted }]}>
                {homeLocation ? homeLocation.address : 'Required for travel time calculations'}
              </Text>
            </View>
            <Text style={[styles.chevron, { color: colors.textMuted }]}>›</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Home Location Modal */}
      <Modal
        visible={homeLocationModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setHomeLocationModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card, maxHeight: '80%' }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Set Home Address</Text>
            <View style={styles.modalRow}>
              <Text style={[styles.modalLabel, { color: colors.textSecondary }]}>Search Address</Text>
              <TextInput
                style={[styles.modalInput, styles.addressInput, { backgroundColor: colors.backgroundSecondary, color: colors.text }]}
                value={homeAddressInput}
                onChangeText={setHomeAddressInput}
                placeholder="Start typing your address..."
                placeholderTextColor={colors.textMuted}
              />
              {loadingHomeSuggestions && <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: 8 }} />}
            </View>

            {/* Address Suggestions */}
            {homeSuggestions.length > 0 && (
              <ScrollView style={styles.suggestionsContainer} showsVerticalScrollIndicator={false}>
                {homeSuggestions.map((suggestion) => (
                  <TouchableOpacity
                    key={suggestion.placeId}
                    style={[styles.suggestionItem, { backgroundColor: colors.backgroundSecondary }]}
                    onPress={() => {
                      setHomeAddressInput(suggestion.address);
                      setHomeSuggestions([]);
                      saveHomeLocation(suggestion.address);
                    }}
                  >
                    <Text style={styles.suggestionItemIcon}>📍</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.suggestionItemName, { color: colors.text }]}>{suggestion.name}</Text>
                      <Text style={[styles.suggestionItemAddress, { color: colors.textMuted }]} numberOfLines={1}>
                        {suggestion.address}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => {
                  setHomeLocationModalVisible(false);
                  setHomeSuggestions([]);
                }}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSave]}
                onPress={() => saveHomeLocation()}
                disabled={savingHome || !homeAddressInput.trim()}
              >
                {savingHome ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.modalButtonText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Theme Selection */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>APPEARANCE</Text>
        <View style={styles.themeSelector}>
          {(['light', 'dark'] as ThemeMode[]).map((themeOption) => (
            <TouchableOpacity
              key={themeOption}
              style={[
                styles.themeOption,
                { backgroundColor: colors.card },
                mode === themeOption && styles.themeOptionActive,
              ]}
              onPress={() => setTheme(themeOption)}
            >
              <View style={[
                styles.themePreview,
                themeOption === 'light' ? styles.themePreviewLight : styles.themePreviewDark
              ]}>
                <View style={[
                  styles.themePreviewBar,
                  { backgroundColor: themeOption === 'light' ? '#e5e7eb' : '#3d3d5c' }
                ]} />
                <View style={styles.themePreviewContent}>
                  <View style={[
                    styles.themePreviewCard,
                    { backgroundColor: themeOption === 'light' ? '#ffffff' : '#2d2d44' }
                  ]} />
                  <View style={[
                    styles.themePreviewCard,
                    { backgroundColor: themeOption === 'light' ? '#ffffff' : '#2d2d44' }
                  ]} />
                </View>
              </View>
              <Text style={[
                styles.themeLabel,
                { color: colors.text },
                mode === themeOption && { color: colors.primary }
              ]}>
                {themeOption === 'light' ? 'Light' : 'Dark'}
              </Text>
              {mode === themeOption && (
                <View style={[styles.themeCheck, { backgroundColor: colors.primary }]}>
                  <Text style={styles.themeCheckText}>✓</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Transport Mode */}
      <View style={[styles.section, { backgroundColor: colors.background }]}>
        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>DEFAULT TRANSPORT</Text>
        <View style={styles.transportModes}>
          {(['sedan', 'motorcycle', 'taxi', 'transit'] as TransportMode[]).map(mode => (
            <TouchableOpacity
              key={mode}
              style={[
                styles.transportMode,
                { backgroundColor: colors.card },
                transportMode === mode && styles.transportModeActive
              ]}
              onPress={() => setStoreTransportMode(mode)}
            >
              <Text style={styles.transportIcon}>{getTransportIcon(mode)}</Text>
              <Text style={[styles.transportLabel, { color: colors.textMuted }, transportMode === mode && styles.transportLabelActive]}>
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Taxi Provider - Show when taxi mode selected */}
      {transportMode === 'taxi' && (
        <View style={[styles.section, { backgroundColor: colors.background }]}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>TAXI PROVIDER</Text>
          <View style={styles.transportModes}>
            {(['uber', 'checker'] as TaxiProvider[]).map(provider => (
              <TouchableOpacity
                key={provider}
                style={[
                  styles.taxiProvider,
                  { backgroundColor: colors.card },
                  taxiProvider === provider && styles.taxiProviderActive
                ]}
                onPress={() => setTaxiProvider(provider)}
              >
                <Text style={styles.transportIcon}>{TAXI_PROVIDERS[provider].icon}</Text>
                <Text style={[styles.transportLabel, { color: colors.textMuted }, taxiProvider === provider && styles.transportLabelActive]}>
                  {TAXI_PROVIDERS[provider].name}
                </Text>
                {provider === 'checker' && (
                  <Text style={styles.taxiPhone}>{TAXI_PROVIDERS.checker.displayPhone}</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Integrations */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>INTEGRATIONS</Text>

        <View style={[styles.integrationCard, { backgroundColor: colors.card }]}>
          <View style={styles.integrationHeader}>
            <Text style={styles.integrationIcon}>📅</Text>
            <View style={styles.integrationInfo}>
              <Text style={[styles.integrationName, { color: colors.text }]}>Google Calendar</Text>
              <Text style={[styles.integrationStatus, { color: colors.textMuted }]}>
                {isDemoMode
                  ? (DEMO_GOOGLE_SYNC.isConnected ? `Synced ${formatLastSync(DEMO_GOOGLE_SYNC.lastSyncAt)}` : 'Not connected')
                  : (syncStatus?.isConnected ? `Synced ${formatLastSync(syncStatus.lastSyncAt)}` : 'Ready to sync')}
              </Text>
            </View>
            {isDemoMode ? (
              <View style={[styles.statusBadge, DEMO_GOOGLE_SYNC.isConnected && styles.statusBadgeConnected]}>
                <Text style={[styles.statusBadgeText, DEMO_GOOGLE_SYNC.isConnected && styles.statusBadgeTextConnected]}>
                  {DEMO_GOOGLE_SYNC.isConnected ? 'Connected' : 'Connect'}
                </Text>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.syncButton, syncing && styles.syncButtonDisabled]}
                onPress={handleSyncCalendar}
                disabled={syncing}
              >
                {syncing ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.syncButtonText}>Sync Now</Text>
                )}
              </TouchableOpacity>
            )}
          </View>
          {(isDemoMode ? DEMO_GOOGLE_SYNC.isConnected : syncStatus?.isConnected) && (
            <View style={[styles.integrationDetails, { borderTopColor: colors.border }]}>
              <Text style={[styles.integrationDetail, { color: colors.textMuted }]}>
                • Importing from: Primary calendar
              </Text>
              {syncStatus?.lastSyncAt && (
                <Text style={[styles.integrationDetail, { color: colors.textMuted }]}>
                  • Last synced: {new Date(syncStatus.lastSyncAt).toLocaleString()}
                </Text>
              )}
            </View>
          )}
        </View>

        {/* Google Calendar Settings */}
        {!isDemoMode && (
          <>
            <View style={[styles.settingRow, { backgroundColor: colors.card }]}>
              <View style={styles.settingInfo}>
                <Text style={[styles.settingLabel, { color: colors.text }]}>Lock Google Events</Text>
                <Text style={[styles.settingDesc, { color: colors.textMuted }]}>Prevent editing imported events</Text>
              </View>
              <Switch
                value={lockGoogleEvents}
                onValueChange={(value) => {
                  setLockGoogleEvents(value);
                  updateGoogleCalendarSetting('lockGoogleEvents', value);
                }}
                trackColor={{ false: '#4b5563', true: colors.primary }}
                thumbColor="#fff"
              />
            </View>

            <View style={[styles.settingRow, { backgroundColor: colors.card }]}>
              <View style={styles.settingInfo}>
                <Text style={[styles.settingLabel, { color: colors.text }]}>Include in Planning</Text>
                <Text style={[styles.settingDesc, { color: colors.textMuted }]}>Use Google events for travel & schedule calculations</Text>
              </View>
              <Switch
                value={includeGoogleInPlanning}
                onValueChange={(value) => {
                  setIncludeGoogleInPlanning(value);
                  updateGoogleCalendarSetting('includeGoogleInPlanning', value);
                }}
                trackColor={{ false: '#4b5563', true: colors.primary }}
                thumbColor="#fff"
              />
            </View>
          </>
        )}

        <View style={[styles.integrationCard, { backgroundColor: colors.card }]}>
          <View style={styles.integrationHeader}>
            <Text style={styles.integrationIcon}>📱</Text>
            <View style={styles.integrationInfo}>
              <Text style={[styles.integrationName, { color: colors.text }]}>Telegram Bot</Text>
              <Text style={[styles.integrationStatus, { color: colors.textMuted }]}>
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
        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>NOTIFICATIONS</Text>

        <View style={[styles.settingRow, { backgroundColor: colors.card }]}>
          <View style={styles.settingInfo}>
            <Text style={[styles.settingLabel, { color: colors.text }]}>Leave-By Reminders</Text>
            <Text style={[styles.settingDesc, { color: colors.textMuted }]}>Get notified when to leave for events</Text>
          </View>
          <Switch
            value={leaveByReminders}
            onValueChange={setLeaveByReminders}
            trackColor={{ false: '#4b5563', true: '#3b82f6' }}
            thumbColor="#fff"
          />
        </View>

        <View style={[styles.settingRow, { backgroundColor: colors.card }]}>
          <View style={styles.settingInfo}>
            <Text style={[styles.settingLabel, { color: colors.text }]}>Weather Alerts</Text>
            <Text style={[styles.settingDesc, { color: colors.textMuted }]}>Adjust travel time for weather</Text>
          </View>
          <Switch
            value={weatherAlerts}
            onValueChange={setWeatherAlerts}
            trackColor={{ false: '#4b5563', true: colors.primary }}
            thumbColor="#fff"
          />
        </View>

        <View style={[styles.settingRow, { backgroundColor: colors.card }]}>
          <View style={styles.settingInfo}>
            <Text style={[styles.settingLabel, { color: colors.text }]}>Traffic Alerts</Text>
            <Text style={[styles.settingDesc, { color: colors.textMuted }]}>Get notified about delays</Text>
          </View>
          <Switch
            value={trafficAlerts}
            onValueChange={setTrafficAlerts}
            trackColor={{ false: '#4b5563', true: colors.primary }}
            thumbColor="#fff"
          />
        </View>

        <TouchableOpacity style={[styles.settingRow, { backgroundColor: colors.card }]}>
          <View style={styles.settingInfo}>
            <Text style={[styles.settingLabel, { color: colors.text }]}>Reminder Times</Text>
            <Text style={[styles.settingDesc, { color: colors.textMuted }]}>
              {DEMO_SETTINGS.notifications.reminderMinutesBefore.map(m =>
                m >= 60 ? `${m/60}h` : `${m}m`
              ).join(', ')} before
            </Text>
          </View>
          <Text style={[styles.chevron, { color: colors.textMuted }]}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Smart Buffers */}
      <View style={[styles.section, { backgroundColor: colors.background }]}>
        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>SMART BUFFERS</Text>
        <Text style={[styles.sectionSubtitle, { color: colors.textMuted }]}>Tap to edit buffer times</Text>

        {bufferRules.map((buffer, idx) => (
          <TouchableOpacity
            key={idx}
            style={[styles.bufferRow, { backgroundColor: colors.card }]}
            onPress={() => {
              setEditingBuffer({
                eventType: buffer.eventType,
                before: String(buffer.beforeMinutes),
                after: String(buffer.afterMinutes),
              });
              setBufferModalVisible(true);
            }}
          >
            <Text style={styles.bufferIcon}>{getEventTypeIcon(buffer.eventType)}</Text>
            <View style={styles.bufferInfo}>
              <Text style={[styles.bufferType, { color: colors.text }]}>{formatEventType(buffer.eventType)}</Text>
              <Text style={[styles.bufferValue, { color: colors.textMuted }]}>
                +{buffer.beforeMinutes}m before • +{buffer.afterMinutes}m after
              </Text>
            </View>
            <Text style={[styles.chevron, { color: colors.textMuted }]}>›</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Buffer Edit Modal */}
      <Modal
        visible={bufferModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setBufferModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              Edit Buffer: {editingBuffer ? formatEventType(editingBuffer.eventType) : ''}
            </Text>

            <View style={styles.modalRow}>
              <Text style={[styles.modalLabel, { color: colors.textSecondary }]}>Before (minutes)</Text>
              <TextInput
                style={[styles.modalInput, { backgroundColor: colors.backgroundSecondary, color: colors.text }]}
                value={editingBuffer?.before || ''}
                onChangeText={(text) => setEditingBuffer(prev => prev ? { ...prev, before: text } : null)}
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor={colors.textMuted}
              />
            </View>

            <View style={styles.modalRow}>
              <Text style={[styles.modalLabel, { color: colors.textSecondary }]}>After (minutes)</Text>
              <TextInput
                style={[styles.modalInput, { backgroundColor: colors.backgroundSecondary, color: colors.text }]}
                value={editingBuffer?.after || ''}
                onChangeText={(text) => setEditingBuffer(prev => prev ? { ...prev, after: text } : null)}
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor={colors.textMuted}
              />
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => setBufferModalVisible(false)}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSave]}
                onPress={() => {
                  if (editingBuffer) {
                    updateBufferRule(
                      editingBuffer.eventType,
                      parseInt(editingBuffer.before) || 0,
                      parseInt(editingBuffer.after) || 0
                    );
                  }
                  setBufferModalVisible(false);
                }}
              >
                <Text style={styles.modalButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Constraints */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>SCHEDULE CONSTRAINTS</Text>
        <Text style={[styles.sectionSubtitle, { color: colors.textMuted }]}>Tap to edit</Text>

        {constraints.map((constraint, idx) => (
          <TouchableOpacity
            key={idx}
            style={[styles.constraintRow, { backgroundColor: colors.card }]}
            onPress={() => {
              const configStrings: Record<string, string> = {};
              Object.entries(constraint.config).forEach(([key, value]) => {
                configStrings[key] = String(value);
              });
              setEditingConstraint({ type: constraint.type, config: configStrings });
              setConstraintModalVisible(true);
            }}
          >
            <Text style={styles.constraintIcon}>{getConstraintIcon(constraint.type)}</Text>
            <View style={styles.constraintInfo}>
              <Text style={[styles.constraintType, { color: colors.text }]}>{formatConstraintType(constraint.type)}</Text>
              <Text style={[styles.constraintValue, { color: colors.textMuted }]}>{formatConstraintValue(constraint)}</Text>
            </View>
            <Text style={[styles.chevron, { color: colors.textMuted }]}>›</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Constraint Edit Modal */}
      <Modal
        visible={constraintModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setConstraintModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              Edit: {editingConstraint ? formatConstraintType(editingConstraint.type) : ''}
            </Text>

            {editingConstraint && renderConstraintFields(editingConstraint, setEditingConstraint, colors)}

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => setConstraintModalVisible(false)}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSave]}
                onPress={() => {
                  if (editingConstraint) {
                    const parsedConfig: Record<string, string | number> = {};
                    Object.entries(editingConstraint.config).forEach(([key, value]) => {
                      // Parse numbers for numeric fields
                      if (key === 'minutes' || key === 'minutesPerDay') {
                        parsedConfig[key] = parseInt(value) || 0;
                      } else {
                        parsedConfig[key] = value;
                      }
                    });
                    updateConstraint(editingConstraint.type, parsedConfig);
                  }
                  setConstraintModalVisible(false);
                }}
              >
                <Text style={styles.modalButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Privacy */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>PRIVACY</Text>

        <View style={[styles.settingRow, { backgroundColor: colors.card }]}>
          <View style={styles.settingInfo}>
            <Text style={[styles.settingLabel, { color: colors.text }]}>Google Calendar Sync</Text>
            <Text style={[styles.settingDesc, { color: colors.textMuted }]}>Sync events with Google</Text>
          </View>
          <Switch
            value={googleSyncEnabled}
            onValueChange={setGoogleSyncEnabled}
            trackColor={{ false: '#4b5563', true: colors.primary }}
            thumbColor="#fff"
          />
        </View>

        <View style={[styles.settingRow, { backgroundColor: colors.card }]}>
          <View style={styles.settingInfo}>
            <Text style={[styles.settingLabel, { color: colors.text }]}>Send Notes to AI</Text>
            <Text style={[styles.settingDesc, { color: colors.textMuted }]}>Include event notes in AI analysis</Text>
          </View>
          <Switch
            value={sendNotesToAI}
            onValueChange={setSendNotesToAI}
            trackColor={{ false: '#4b5563', true: colors.primary }}
            thumbColor="#fff"
          />
        </View>

        <View style={[styles.settingRow, { backgroundColor: colors.card }]}>
          <View style={styles.settingInfo}>
            <Text style={[styles.settingLabel, { color: colors.text }]}>Weather Influence</Text>
            <Text style={[styles.settingDesc, { color: colors.textMuted }]}>Adjust ETAs based on weather</Text>
          </View>
          <Switch
            value={weatherInfluence}
            onValueChange={setWeatherInfluence}
            trackColor={{ false: '#4b5563', true: colors.primary }}
            thumbColor="#fff"
          />
        </View>
      </View>

      {/* Account */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>ACCOUNT</Text>

        {isAdmin() && (
          <TouchableOpacity
            style={[styles.adminButton, { backgroundColor: colors.card }]}
            onPress={() => router.push('/admin')}
          >
            <Text style={styles.adminIcon}>👑</Text>
            <View style={styles.adminInfo}>
              <Text style={[styles.adminLabel, { color: colors.text }]}>Admin Panel</Text>
              <Text style={[styles.adminDesc, { color: colors.textMuted }]}>Manage users and settings</Text>
            </View>
            <Text style={[styles.chevron, { color: colors.textMuted }]}>›</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.dangerButton} onPress={handleLogout}>
          <Text style={styles.dangerButtonText}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.footer}>
        <Text style={[styles.logoText, { color: colors.primary }]}>J.O.C.A.S.T.A.</Text>
        <Text style={[styles.footerText, { color: colors.textMuted }]}>Your Intelligent Schedule Assistant</Text>
        <Text style={[styles.versionText, { color: colors.textMuted }]}>Version 1.0.0</Text>
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

// Helper function to render constraint input fields based on type
function renderConstraintFields(
  constraint: { type: string; config: Record<string, string> },
  setConstraint: (value: { type: string; config: Record<string, string> } | null) => void,
  colors: any
) {
  const updateField = (key: string, value: string) => {
    setConstraint({
      ...constraint,
      config: { ...constraint.config, [key]: value },
    });
  };

  const inputStyle = [styles.modalInput, { backgroundColor: colors.backgroundSecondary, color: colors.text }];
  const labelStyle = [styles.modalLabel, { color: colors.textSecondary }];

  switch (constraint.type) {
    case 'sleep':
    case 'work':
    case 'quiet_hours':
      return (
        <>
          <View style={styles.modalRow}>
            <Text style={labelStyle}>Start Time</Text>
            <TextInput
              style={inputStyle}
              value={constraint.config.start || ''}
              onChangeText={(text) => updateField('start', text)}
              placeholder="HH:MM"
              placeholderTextColor={colors.textMuted}
            />
          </View>
          <View style={styles.modalRow}>
            <Text style={labelStyle}>End Time</Text>
            <TextInput
              style={inputStyle}
              value={constraint.config.end || ''}
              onChangeText={(text) => updateField('end', text)}
              placeholder="HH:MM"
              placeholderTextColor={colors.textMuted}
            />
          </View>
        </>
      );
    case 'min_gap':
      return (
        <View style={styles.modalRow}>
          <Text style={labelStyle}>Minutes between events</Text>
          <TextInput
            style={inputStyle}
            value={constraint.config.minutes || ''}
            onChangeText={(text) => updateField('minutes', text)}
            keyboardType="number-pad"
            placeholder="15"
            placeholderTextColor={colors.textMuted}
          />
        </View>
      );
    case 'max_travel':
      return (
        <View style={styles.modalRow}>
          <Text style={labelStyle}>Max minutes per day</Text>
          <TextInput
            style={inputStyle}
            value={constraint.config.minutesPerDay || ''}
            onChangeText={(text) => updateField('minutesPerDay', text)}
            keyboardType="number-pad"
            placeholder="120"
            placeholderTextColor={colors.textMuted}
          />
        </View>
      );
    case 'preferred_mode':
      return (
        <>
          <View style={styles.modalRow}>
            <Text style={labelStyle}>Preferred Mode</Text>
            <TextInput
              style={inputStyle}
              value={constraint.config.mode || ''}
              onChangeText={(text) => updateField('mode', text)}
              placeholder="sedan"
              placeholderTextColor={colors.textMuted}
            />
          </View>
          <View style={styles.modalRow}>
            <Text style={labelStyle}>Fallback Mode</Text>
            <TextInput
              style={inputStyle}
              value={constraint.config.fallback || ''}
              onChangeText={(text) => updateField('fallback', text)}
              placeholder="taxi"
              placeholderTextColor={colors.textMuted}
            />
          </View>
        </>
      );
    default:
      return null;
  }
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
  themeSelector: {
    flexDirection: 'row',
    gap: 12,
  },
  themeOption: {
    flex: 1,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  themeOptionActive: {
    borderColor: '#3b82f6',
  },
  themePreview: {
    width: '100%',
    height: 60,
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 8,
  },
  themePreviewLight: {
    backgroundColor: '#f8f9fa',
  },
  themePreviewDark: {
    backgroundColor: '#1a1a2e',
  },
  themePreviewBar: {
    height: 12,
    width: '100%',
  },
  themePreviewContent: {
    flex: 1,
    padding: 4,
    gap: 3,
  },
  themePreviewCard: {
    flex: 1,
    borderRadius: 3,
  },
  themeLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 4,
  },
  themeCheck: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  themeCheckText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
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
  taxiProvider: {
    flex: 1,
    backgroundColor: '#2d2d44',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  taxiProviderActive: {
    borderColor: '#3b82f6',
    backgroundColor: '#3b82f620',
  },
  taxiPhone: {
    color: '#888',
    fontSize: 10,
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#2d2d44',
    borderRadius: 16,
    padding: 24,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalRow: {
    marginBottom: 16,
  },
  modalLabel: {
    fontSize: 14,
    color: '#888',
    marginBottom: 8,
  },
  modalInput: {
    backgroundColor: '#1a1a2e',
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    color: '#fff',
    textAlign: 'center',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  modalButton: {
    flex: 1,
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalButtonCancel: {
    backgroundColor: '#4b5563',
  },
  modalButtonSave: {
    backgroundColor: '#3b82f6',
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
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
  syncButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 90,
    alignItems: 'center',
  },
  syncButtonDisabled: {
    backgroundColor: '#3b82f680',
  },
  syncButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
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
  homeIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  addressInput: {
    textAlign: 'left',
    minHeight: 44,
    textAlignVertical: 'top',
  },
  suggestionsContainer: {
    maxHeight: 200,
    marginBottom: 16,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  suggestionItemIcon: {
    fontSize: 18,
    marginRight: 10,
  },
  suggestionItemName: {
    fontSize: 14,
    fontWeight: '500',
  },
  suggestionItemAddress: {
    fontSize: 12,
    marginTop: 2,
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
  adminButton: {
    flexDirection: 'row',
    backgroundColor: '#2d2d44',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    alignItems: 'center',
  },
  adminIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  adminInfo: {
    flex: 1,
  },
  adminLabel: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '500',
  },
  adminDesc: {
    color: '#888',
    fontSize: 13,
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
