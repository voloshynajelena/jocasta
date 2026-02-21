import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';

import { useAuthStore } from '../../src/store/authStore';

export default function ProposalScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const isDemoMode = user?.id === 'demo-user';
  const [loading, setLoading] = useState(false);

  // Demo proposal data
  const proposal = {
    id,
    title: 'Coffee with Sarah',
    type: 'personal',
    startAt: getNextFreeSlot(),
    endAt: getNextFreeSlotEnd(),
    confidence: 0.94,
    location: 'Blue Bottle Coffee - Downtown',
    explanation: [
      'Found 45-minute gap between meetings',
      'Location is 5 min walk from office',
      'No conflicts with kids pickup',
      'Weather looks good (sunny, 68°F)',
    ],
    alternatives: [
      { label: 'Tomorrow 2pm', confidence: 0.87 },
      { label: 'Friday 10am', confidence: 0.82 },
    ],
  };

  const handleConfirm = async () => {
    setLoading(true);
    // Simulate API call
    setTimeout(() => {
      setLoading(false);
      router.back();
    }, 1000);
  };

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>{proposal.title}</Text>
        <View style={styles.confidenceBadge}>
          <Text style={styles.confidenceText}>
            {Math.round(proposal.confidence * 100)}% match
          </Text>
        </View>
      </View>

      {/* Proposed Time Card */}
      <View style={styles.timeCard}>
        <Text style={styles.timeLabel}>Proposed Time</Text>
        <Text style={styles.timeDate}>
          {proposal.startAt.toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
          })}
        </Text>
        <Text style={styles.timeValue}>
          {proposal.startAt.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
          })}{' '}
          -{' '}
          {proposal.endAt.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
          })}
        </Text>
        {proposal.location && (
          <View style={styles.locationRow}>
            <Text style={styles.locationIcon}>📍</Text>
            <Text style={styles.locationText}>{proposal.location}</Text>
          </View>
        )}
      </View>

      {/* Why this slot */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Why this slot?</Text>
        {proposal.explanation.map((reason, idx) => (
          <View key={idx} style={styles.reasonRow}>
            <Text style={styles.checkmark}>✓</Text>
            <Text style={styles.reasonText}>{reason}</Text>
          </View>
        ))}
      </View>

      {/* Alternatives */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Other options</Text>
        <View style={styles.alternativesRow}>
          {proposal.alternatives.map((alt, idx) => (
            <TouchableOpacity key={idx} style={styles.alternativeChip}>
              <Text style={styles.alternativeText}>{alt.label}</Text>
              <Text style={styles.alternativeConfidence}>
                {Math.round(alt.confidence * 100)}%
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Travel Info */}
      <View style={styles.travelCard}>
        <View style={styles.travelHeader}>
          <Text style={styles.travelIcon}>🚗</Text>
          <Text style={styles.travelTitle}>Travel Info</Text>
        </View>
        <Text style={styles.travelText}>
          5 min walk from Downtown Office
        </Text>
        <Text style={styles.travelSubtext}>
          Leave by {getLeaveTime(proposal.startAt)} to arrive on time
        </Text>
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.confirmButton}
          onPress={handleConfirm}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.confirmText}>Confirm & Add to Calendar</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.modifyButton}>
          <Text style={styles.modifyText}>Modify Details</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.cancelButton} onPress={() => router.back()}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

function getNextFreeSlot(): Date {
  const date = new Date();
  // Set to next available time (e.g., 2pm today or tomorrow)
  if (date.getHours() >= 14) {
    date.setDate(date.getDate() + 1);
  }
  date.setHours(14, 0, 0, 0);
  return date;
}

function getNextFreeSlotEnd(): Date {
  const date = getNextFreeSlot();
  date.setMinutes(date.getMinutes() + 45);
  return date;
}

function getLeaveTime(startTime: Date): string {
  const leave = new Date(startTime);
  leave.setMinutes(leave.getMinutes() - 10);
  return leave.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    padding: 16,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
  },
  confidenceBadge: {
    backgroundColor: '#10b981',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  confidenceText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  timeCard: {
    backgroundColor: '#2d2d44',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
  },
  timeLabel: {
    color: '#888',
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  timeDate: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  timeValue: {
    color: '#3b82f6',
    fontSize: 22,
    fontWeight: 'bold',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#3d3d5c',
  },
  locationIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  locationText: {
    color: '#888',
    fontSize: 14,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#888',
    textTransform: 'uppercase',
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#2d2d44',
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
  },
  checkmark: {
    color: '#10b981',
    fontSize: 16,
    marginRight: 12,
    fontWeight: 'bold',
  },
  reasonText: {
    color: '#fff',
    fontSize: 15,
    flex: 1,
  },
  alternativesRow: {
    flexDirection: 'row',
    gap: 12,
  },
  alternativeChip: {
    flex: 1,
    backgroundColor: '#2d2d44',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#3d3d5c',
  },
  alternativeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  alternativeConfidence: {
    color: '#888',
    fontSize: 12,
    marginTop: 4,
  },
  travelCard: {
    backgroundColor: '#2d2d44',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  travelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  travelIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  travelTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  travelText: {
    color: '#888',
    fontSize: 14,
  },
  travelSubtext: {
    color: '#666',
    fontSize: 13,
    marginTop: 4,
  },
  actions: {
    gap: 12,
    paddingBottom: 40,
  },
  confirmButton: {
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
  },
  confirmText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
  modifyButton: {
    backgroundColor: '#2d2d44',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  modifyText: {
    color: '#fff',
    fontSize: 16,
  },
  cancelButton: {
    padding: 16,
    alignItems: 'center',
  },
  cancelText: {
    color: '#888',
    fontSize: 15,
  },
});
