import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';

import { useAuthStore } from '../../src/store/authStore';
import { DEMO_EVENTS, DEMO_WEATHER, Event, DEMO_LOCATIONS } from '../../src/data/demoData';

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const isDemoMode = user?.id === 'demo-user';

  const [isDeleting, setIsDeleting] = useState(false);

  const event = useMemo(() => {
    return DEMO_EVENTS.find(e => e.id === id);
  }, [id]);

  if (!event) {
    return (
      <View style={styles.container}>
        <View style={styles.notFound}>
          <Text style={styles.notFoundText}>Event not found</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const formatDate = (isoString: string) => {
    return new Date(isoString).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatTime = (isoString: string) => {
    return new Date(isoString).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const formatDuration = (start: string, end: string) => {
    const diff = (new Date(end).getTime() - new Date(start).getTime()) / (1000 * 60);
    if (diff >= 60) {
      const hours = Math.floor(diff / 60);
      const mins = diff % 60;
      return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    }
    return `${diff}m`;
  };

  const getTypeColor = (type: string): string => {
    const colors: Record<string, string> = {
      appointment: '#ef4444',
      meeting: '#3b82f6',
      personal_workout: '#10b981',
      dog_walk: '#8b5cf6',
      kids_dropoff: '#f59e0b',
      kids_pickup: '#f59e0b',
      personal: '#6366f1',
      fueling: '#f97316',
      shopping: '#ec4899',
    };
    return colors[type] || '#6b7280';
  };

  const getTypeIcon = (type: string): string => {
    const icons: Record<string, string> = {
      meeting: '💼',
      appointment: '🏥',
      personal_workout: '💪',
      dog_walk: '🐕',
      kids_dropoff: '🚸',
      kids_pickup: '🚸',
      personal: '📍',
      fueling: '⛽',
      shopping: '🛒',
    };
    return icons[type] || '📅';
  };

  const getSourceBadge = (source: string) => {
    if (source === 'external_google') {
      return { icon: '📅', text: 'Google Calendar', color: '#4285f4' };
    }
    return { icon: '✨', text: 'Jocasta', color: '#8b5cf6' };
  };

  const sourceBadge = getSourceBadge(event.source);

  const handleDelete = () => {
    Alert.alert(
      'Delete Event',
      'Are you sure you want to delete this event?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            setIsDeleting(true);
            setTimeout(() => {
              router.replace('/(tabs)');
            }, 500);
          },
        },
      ]
    );
  };

  const handleEdit = () => {
    // Navigate to edit screen
    router.push({
      pathname: '/event/edit',
      params: { id: event.id },
    });
  };

  const handleReschedule = () => {
    router.push({
      pathname: '/proposal/[id]',
      params: { id: event.id, title: event.title },
    });
  };

  // Check for weather impact during this event
  const weatherForecast = DEMO_WEATHER.forecast.find(f => {
    const eventHour = new Date(event.startAt).getHours();
    return f.hour >= eventHour - 1 && f.hour <= eventHour + 1 && f.etaImpact;
  });

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={() => router.back()}>
          <Text style={styles.headerButtonText}>← Back</Text>
        </TouchableOpacity>
        {!event.isLocked && (
          <TouchableOpacity style={styles.headerButton} onPress={handleEdit}>
            <Text style={styles.editButtonText}>Edit</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Event Type Badge */}
      <View style={styles.typeBadgeContainer}>
        <View style={[styles.typeBadge, { backgroundColor: getTypeColor(event.type) }]}>
          <Text style={styles.typeIcon}>{getTypeIcon(event.type)}</Text>
          <Text style={styles.typeText}>{event.type.replace(/_/g, ' ')}</Text>
        </View>
        {event.isLocked && (
          <View style={styles.lockedBadge}>
            <Text style={styles.lockedIcon}>🔒</Text>
            <Text style={styles.lockedText}>Locked</Text>
          </View>
        )}
      </View>

      {/* Title */}
      <Text style={styles.title}>{event.title}</Text>

      {/* Priority */}
      {event.priority === 3 && (
        <View style={styles.priorityBadge}>
          <Text style={styles.priorityIcon}>!</Text>
          <Text style={styles.priorityText}>High Priority</Text>
        </View>
      )}

      {/* Time Card */}
      <View style={styles.card}>
        <View style={styles.cardRow}>
          <Text style={styles.cardIcon}>📆</Text>
          <View style={styles.cardContent}>
            <Text style={styles.cardLabel}>Date</Text>
            <Text style={styles.cardValue}>{formatDate(event.startAt)}</Text>
          </View>
        </View>
        <View style={styles.cardDivider} />
        <View style={styles.cardRow}>
          <Text style={styles.cardIcon}>🕐</Text>
          <View style={styles.cardContent}>
            <Text style={styles.cardLabel}>Time</Text>
            <Text style={styles.cardValue}>
              {formatTime(event.startAt)} - {formatTime(event.endAt)}
            </Text>
            <Text style={styles.cardSubtext}>
              Duration: {formatDuration(event.startAt, event.endAt)}
            </Text>
          </View>
        </View>
      </View>

      {/* Location Card */}
      {event.location && (
        <View style={styles.card}>
          <View style={styles.cardRow}>
            <Text style={styles.cardIcon}>📍</Text>
            <View style={styles.cardContent}>
              <Text style={styles.cardLabel}>Location</Text>
              <Text style={styles.cardValue}>{event.location.name}</Text>
              <Text style={styles.cardSubtext}>{event.location.address}</Text>
            </View>
            <TouchableOpacity style={styles.mapButton}>
              <Text style={styles.mapButtonText}>Map</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Travel Segment */}
      {event.travelSegment && (
        <View style={styles.travelCard}>
          <View style={styles.travelHeader}>
            <Text style={styles.travelTitle}>🚗 Travel Info</Text>
            <Text style={styles.travelConfidence}>
              {Math.round(event.travelSegment.confidence * 100)}% confidence
            </Text>
          </View>
          <View style={styles.travelGrid}>
            <View style={styles.travelItem}>
              <Text style={styles.travelItemLabel}>Distance</Text>
              <Text style={styles.travelItemValue}>{event.travelSegment.distanceKm} km</Text>
            </View>
            <View style={styles.travelItem}>
              <Text style={styles.travelItemLabel}>ETA</Text>
              <Text style={styles.travelItemValue}>{event.travelSegment.etaMinutes} min</Text>
            </View>
            <View style={styles.travelItem}>
              <Text style={styles.travelItemLabel}>Mode</Text>
              <Text style={styles.travelItemValue}>{event.travelSegment.mode}</Text>
            </View>
            <View style={styles.travelItem}>
              <Text style={styles.travelItemLabel}>Source</Text>
              <Text style={styles.travelItemValue}>{event.travelSegment.source}</Text>
            </View>
          </View>
          <View style={styles.leaveBySection}>
            <Text style={styles.leaveByLabel}>Leave by</Text>
            <Text style={styles.leaveByTime}>{formatTime(event.travelSegment.departAt)}</Text>
            <Text style={styles.leaveBySubtext}>to arrive on time</Text>
          </View>
        </View>
      )}

      {/* Weather Impact */}
      {weatherForecast && (
        <View style={styles.weatherCard}>
          <View style={styles.weatherHeader}>
            <Text style={styles.weatherIcon}>
              {weatherForecast.condition === 'snow' ? '❄️' : '🌧️'}
            </Text>
            <View style={styles.weatherContent}>
              <Text style={styles.weatherTitle}>Weather Impact</Text>
              <Text style={styles.weatherText}>
                {weatherForecast.condition === 'snow' ? 'Snow' : 'Rain'} expected around this time.
                Travel may take +{weatherForecast.etaImpact}% longer.
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Notes */}
      {event.notes && (
        <View style={styles.card}>
          <View style={styles.cardRow}>
            <Text style={styles.cardIcon}>📝</Text>
            <View style={styles.cardContent}>
              <Text style={styles.cardLabel}>Notes</Text>
              <Text style={styles.notesText}>{event.notes}</Text>
            </View>
          </View>
        </View>
      )}

      {/* Source Badge */}
      <View style={styles.sourceCard}>
        <Text style={styles.sourceIcon}>{sourceBadge.icon}</Text>
        <Text style={styles.sourceText}>From {sourceBadge.text}</Text>
        {event.externalProviderId && (
          <Text style={styles.sourceId}>ID: {event.externalProviderId}</Text>
        )}
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        {!event.isLocked && (
          <>
            <TouchableOpacity style={styles.rescheduleButton} onPress={handleReschedule}>
              <Text style={styles.rescheduleIcon}>🔄</Text>
              <Text style={styles.rescheduleText}>Find Better Time</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
              <Text style={styles.deleteText}>Delete Event</Text>
            </TouchableOpacity>
          </>
        )}

        {event.isLocked && (
          <View style={styles.lockedNotice}>
            <Text style={styles.lockedNoticeIcon}>🔒</Text>
            <Text style={styles.lockedNoticeText}>
              This event is locked and cannot be modified
            </Text>
          </View>
        )}
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
  notFound: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notFoundText: {
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
    color: '#3b82f6',
    fontSize: 16,
  },
  editButtonText: {
    color: '#3b82f6',
    fontSize: 16,
    fontWeight: '600',
  },
  typeBadgeContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 10,
    marginBottom: 12,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  typeIcon: {
    fontSize: 14,
  },
  typeText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  lockedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#374151',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  lockedIcon: {
    fontSize: 12,
  },
  lockedText: {
    color: '#9ca3af',
    fontSize: 13,
    fontWeight: '500',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  priorityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#7f1d1d',
    marginHorizontal: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 8,
    marginBottom: 16,
  },
  priorityIcon: {
    color: '#fca5a5',
    fontSize: 16,
    fontWeight: 'bold',
  },
  priorityText: {
    color: '#fca5a5',
    fontSize: 14,
    fontWeight: '500',
  },
  card: {
    backgroundColor: '#2d2d44',
    marginHorizontal: 16,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  cardIcon: {
    fontSize: 20,
    marginRight: 14,
    marginTop: 2,
  },
  cardContent: {
    flex: 1,
  },
  cardLabel: {
    color: '#888',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  cardValue: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '500',
  },
  cardSubtext: {
    color: '#888',
    fontSize: 14,
    marginTop: 4,
  },
  cardDivider: {
    height: 1,
    backgroundColor: '#3d3d5c',
    marginVertical: 14,
  },
  mapButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  mapButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  travelCard: {
    backgroundColor: '#1e3a5f',
    marginHorizontal: 16,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },
  travelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  travelTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  travelConfidence: {
    color: '#60a5fa',
    fontSize: 13,
  },
  travelGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 14,
  },
  travelItem: {
    width: '50%',
    marginBottom: 12,
  },
  travelItemLabel: {
    color: '#60a5fa',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  travelItemValue: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  leaveBySection: {
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
  },
  leaveByLabel: {
    color: '#60a5fa',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  leaveByTime: {
    color: '#fbbf24',
    fontSize: 24,
    fontWeight: 'bold',
  },
  leaveBySubtext: {
    color: '#888',
    fontSize: 13,
    marginTop: 2,
  },
  weatherCard: {
    backgroundColor: '#422006',
    marginHorizontal: 16,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },
  weatherHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  weatherIcon: {
    fontSize: 28,
    marginRight: 14,
  },
  weatherContent: {
    flex: 1,
  },
  weatherTitle: {
    color: '#fbbf24',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  weatherText: {
    color: '#fcd34d',
    fontSize: 14,
    lineHeight: 20,
  },
  notesText: {
    color: '#ccc',
    fontSize: 15,
    lineHeight: 22,
  },
  sourceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 8,
  },
  sourceIcon: {
    fontSize: 16,
  },
  sourceText: {
    color: '#888',
    fontSize: 14,
  },
  sourceId: {
    color: '#666',
    fontSize: 12,
    marginLeft: 'auto',
  },
  actions: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 12,
  },
  rescheduleButton: {
    flexDirection: 'row',
    backgroundColor: '#3b82f6',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  rescheduleIcon: {
    fontSize: 18,
  },
  rescheduleText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
  deleteButton: {
    backgroundColor: '#2d2d44',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  deleteText: {
    color: '#ef4444',
    fontSize: 16,
  },
  lockedNotice: {
    flexDirection: 'row',
    backgroundColor: '#2d2d44',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  lockedNoticeIcon: {
    fontSize: 18,
  },
  lockedNoticeText: {
    color: '#888',
    fontSize: 15,
  },
  bottomPadding: {
    height: 40,
  },
});
