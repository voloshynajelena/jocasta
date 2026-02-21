import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { useState, useCallback, useMemo } from 'react';
import { useRouter } from 'expo-router';

import { useAuthStore } from '../../src/store/authStore';
import { DEMO_EVENTS, Event } from '../../src/data/demoData';

export default function WeekScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isDemoMode = user?.id === 'demo-user';

  const [refreshing, setRefreshing] = useState(false);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    setRefreshing(false);
  }, []);

  // Generate week days
  const weekDays = useMemo(() => {
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay()); // Sunday
    startOfWeek.setHours(0, 0, 0, 0);

    const days = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);
      days.push(date);
    }
    return days;
  }, []);

  // Group events by day
  const eventsByDay = useMemo(() => {
    if (!isDemoMode) return new Map();

    const map = new Map<string, Event[]>();

    DEMO_EVENTS.forEach(event => {
      const eventDate = new Date(event.startAt);
      const dateKey = eventDate.toISOString().split('T')[0];

      if (!map.has(dateKey)) {
        map.set(dateKey, []);
      }
      map.get(dateKey)!.push(event);
    });

    // Sort events within each day
    map.forEach((events, key) => {
      map.set(key, events.sort((a, b) =>
        new Date(a.startAt).getTime() - new Date(b.startAt).getTime()
      ));
    });

    return map;
  }, [isDemoMode]);

  // Calculate week stats
  const weekStats = useMemo(() => {
    let totalEvents = 0;
    let totalMeetings = 0;
    let totalTravelMinutes = 0;

    eventsByDay.forEach(events => {
      totalEvents += events.length;
      totalMeetings += events.filter(e => e.type === 'meeting').length;
      totalTravelMinutes += events.reduce((acc, e) => acc + (e.travelSegment?.etaMinutes || 0), 0);
    });

    return { totalEvents, totalMeetings, totalTravelMinutes };
  }, [eventsByDay]);

  if (!isAuthenticated) {
    return (
      <View style={styles.container}>
        <View style={styles.authPrompt}>
          <Text style={styles.authTitle}>Week View</Text>
          <Text style={styles.authSubtitle}>Sign in to see your weekly schedule</Text>
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

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>This Week</Text>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{weekStats.totalEvents}</Text>
            <Text style={styles.statLabel}>Events</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{weekStats.totalMeetings}</Text>
            <Text style={styles.statLabel}>Meetings</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{Math.round(weekStats.totalTravelMinutes / 60)}h</Text>
            <Text style={styles.statLabel}>Travel</Text>
          </View>
        </View>
      </View>

      {/* Week Days Header */}
      <View style={styles.weekHeader}>
        {weekDays.map((day, index) => {
          const isToday = day.getTime() === today.getTime();
          const dateKey = day.toISOString().split('T')[0];
          const dayEvents = eventsByDay.get(dateKey) || [];

          return (
            <TouchableOpacity
              key={index}
              style={[
                styles.dayHeader,
                isToday && styles.dayHeaderToday,
                selectedDay === index && styles.dayHeaderSelected,
              ]}
              onPress={() => setSelectedDay(selectedDay === index ? null : index)}
            >
              <Text style={[styles.dayName, isToday && styles.dayNameToday]}>
                {day.toLocaleDateString('en-US', { weekday: 'short' })}
              </Text>
              <Text style={[styles.dayNumber, isToday && styles.dayNumberToday]}>
                {day.getDate()}
              </Text>
              {dayEvents.length > 0 && (
                <View style={styles.eventDots}>
                  {dayEvents.slice(0, 3).map((_, i) => (
                    <View key={i} style={styles.eventDot} />
                  ))}
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Events List */}
      <ScrollView
        style={styles.eventsList}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b82f6" />
        }
        showsVerticalScrollIndicator={false}
      >
        {weekDays.map((day, dayIndex) => {
          const dateKey = day.toISOString().split('T')[0];
          const dayEvents = eventsByDay.get(dateKey) || [];
          const isToday = day.getTime() === today.getTime();
          const isPast = day < today;

          // If a day is selected, only show that day
          if (selectedDay !== null && selectedDay !== dayIndex) {
            return null;
          }

          return (
            <View key={dayIndex} style={styles.daySection}>
              <View style={styles.daySectionHeader}>
                <Text style={[styles.daySectionTitle, isToday && styles.daySectionTitleToday]}>
                  {isToday ? 'Today' : day.toLocaleDateString('en-US', { weekday: 'long' })}
                </Text>
                <Text style={styles.daySectionDate}>
                  {day.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </Text>
              </View>

              {dayEvents.length === 0 ? (
                <View style={styles.emptyDay}>
                  <Text style={styles.emptyDayText}>No events</Text>
                </View>
              ) : (
                dayEvents.map(event => (
                  <TouchableOpacity
                    key={event.id}
                    style={[styles.eventCard, isPast && styles.eventCardPast]}
                    onPress={() => router.push(`/event/${event.id}`)}
                  >
                    <View style={[styles.eventIndicator, { backgroundColor: getTypeColor(event.type) }]} />
                    <View style={styles.eventTime}>
                      <Text style={[styles.eventTimeText, isPast && styles.textMuted]}>
                        {formatTime(event.startAt)}
                      </Text>
                    </View>
                    <View style={styles.eventContent}>
                      <Text style={[styles.eventTitle, isPast && styles.textMuted]} numberOfLines={1}>
                        {event.title}
                      </Text>
                      <View style={styles.eventMeta}>
                        {event.location && (
                          <Text style={styles.eventLocation} numberOfLines={1}>
                            {getTypeIcon(event.type)} {event.location.name}
                          </Text>
                        )}
                        {event.travelSegment && (
                          <Text style={styles.travelInfo}>
                            🚗 {event.travelSegment.etaMinutes}m
                          </Text>
                        )}
                      </View>
                    </View>
                    <View style={styles.eventIcons}>
                      {event.isLocked && <Text style={styles.iconText}>🔒</Text>}
                      {event.priority === 3 && <Text style={styles.priorityIcon}>!</Text>}
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </View>
          );
        })}

        <View style={styles.bottomPadding} />
      </ScrollView>
    </View>
  );
}

// Helper functions
function formatTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function getTypeIcon(type: string): string {
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
}

function getTypeColor(type: string): string {
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
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
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
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statItem: {
    backgroundColor: '#2d2d44',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    minWidth: 70,
  },
  statNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  statLabel: {
    fontSize: 10,
    color: '#888',
    marginTop: 2,
    textTransform: 'uppercase',
  },
  weekHeader: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2d2d44',
  },
  dayHeader: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 10,
  },
  dayHeaderToday: {
    backgroundColor: '#3b82f6',
  },
  dayHeaderSelected: {
    backgroundColor: '#4f46e5',
  },
  dayName: {
    fontSize: 11,
    color: '#888',
    textTransform: 'uppercase',
  },
  dayNameToday: {
    color: '#fff',
  },
  dayNumber: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginTop: 4,
  },
  dayNumberToday: {
    color: '#fff',
  },
  eventDots: {
    flexDirection: 'row',
    marginTop: 4,
    gap: 3,
  },
  eventDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#888',
  },
  eventsList: {
    flex: 1,
  },
  daySection: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  daySectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  daySectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  daySectionTitleToday: {
    color: '#3b82f6',
  },
  daySectionDate: {
    fontSize: 14,
    color: '#888',
  },
  emptyDay: {
    backgroundColor: '#2d2d44',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
  },
  emptyDayText: {
    color: '#666',
    fontSize: 14,
  },
  eventCard: {
    flexDirection: 'row',
    backgroundColor: '#2d2d44',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    alignItems: 'center',
  },
  eventCardPast: {
    opacity: 0.6,
  },
  eventIndicator: {
    width: 4,
    height: 36,
    borderRadius: 2,
    marginRight: 12,
  },
  eventTime: {
    width: 55,
  },
  eventTimeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  eventContent: {
    flex: 1,
    marginLeft: 8,
  },
  eventTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '500',
  },
  eventMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 12,
  },
  eventLocation: {
    color: '#888',
    fontSize: 12,
  },
  travelInfo: {
    color: '#60a5fa',
    fontSize: 12,
  },
  eventIcons: {
    flexDirection: 'row',
    gap: 4,
    marginLeft: 8,
  },
  iconText: {
    fontSize: 12,
  },
  priorityIcon: {
    fontSize: 12,
    color: '#ef4444',
    fontWeight: 'bold',
  },
  textMuted: {
    opacity: 0.7,
  },
  bottomPadding: {
    height: 100,
  },
});
