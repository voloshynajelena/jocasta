import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Platform, Alert, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState, useEffect } from 'react';

import { useAuthStore } from '../../src/store/authStore';
import { useThemeStore } from '../../src/store/themeStore';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';

const getAccessToken = (): string | null => {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage.getItem('accessToken');
  }
  return null;
};

export default function EditEventScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const isDemoMode = user?.id === 'demo-user';
  const { colors } = useThemeStore();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [eventType, setEventType] = useState('other');

  // Fetch event from API
  useEffect(() => {
    if (isDemoMode || !id) {
      setLoading(false);
      return;
    }

    const fetchEvent = async () => {
      const token = getAccessToken();
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`${API_URL}/api/v1/events/${id}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          credentials: 'include',
        });

        if (response.ok) {
          const data = await response.json();
          setTitle(data.title || '');
          setNotes(data.notes || '');
          setStartAt(data.startAt || '');
          setEndAt(data.endAt || '');
          setEventType(data.type || 'other');
        }
      } catch (err) {
        console.error('Failed to fetch event:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchEvent();
  }, [id, isDemoMode]);

  const handleSave = async () => {
    const token = getAccessToken();
    if (!token || !id) return;

    setSaving(true);
    try {
      const response = await fetch(`${API_URL}/api/v1/events/${id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          title,
          notes,
          type: eventType,
        }),
      });

      if (response.ok) {
        Alert.alert('Success', 'Event updated successfully');
        router.back();
      } else {
        const error = await response.json();
        Alert.alert('Error', error.message || 'Failed to update event');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to update event');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  if (!id) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.errorText}>Event not found</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const formatDateTime = (isoString: string) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={() => router.back()}>
          <Text style={[styles.headerButtonText, { color: colors.primary }]}>Cancel</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Edit Event</Text>
        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>Save</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Form */}
      <View style={styles.form}>
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.textMuted }]}>Title</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.card, color: colors.text }]}
            value={title}
            onChangeText={setTitle}
            placeholder="Event title"
            placeholderTextColor={colors.textMuted}
          />
        </View>

        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.textMuted }]}>Start</Text>
          <View style={[styles.readOnlyField, { backgroundColor: colors.card }]}>
            <Text style={[styles.readOnlyText, { color: colors.textSecondary }]}>
              {formatDateTime(startAt)}
            </Text>
          </View>
        </View>

        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.textMuted }]}>End</Text>
          <View style={[styles.readOnlyField, { backgroundColor: colors.card }]}>
            <Text style={[styles.readOnlyText, { color: colors.textSecondary }]}>
              {formatDateTime(endAt)}
            </Text>
          </View>
        </View>

        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.textMuted }]}>Notes</Text>
          <TextInput
            style={[styles.textArea, { backgroundColor: colors.card, color: colors.text }]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Add notes..."
            placeholderTextColor={colors.textMuted}
            multiline
            numberOfLines={4}
          />
        </View>
      </View>

      <View style={styles.bottomPadding} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: '#888',
    fontSize: 18,
    marginBottom: 20,
  },
  backButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  headerButton: {
    padding: 8,
  },
  headerButtonText: {
    fontSize: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 70,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: '#3b82f680',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  form: {
    padding: 16,
  },
  field: {
    marginBottom: 20,
  },
  label: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  input: {
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
  },
  readOnlyField: {
    borderRadius: 12,
    padding: 16,
  },
  readOnlyText: {
    fontSize: 16,
  },
  textArea: {
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    minHeight: 120,
    textAlignVertical: 'top',
  },
  bottomPadding: {
    height: 40,
  },
});
