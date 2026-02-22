import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Platform } from 'react-native';
import { useState, useCallback, useMemo, useEffect } from 'react';
import { useRouter } from 'expo-router';

import { useAuthStore } from '../../src/store/authStore';
import { useThemeStore } from '../../src/store/themeStore';
import { DEMO_EVENTS, Event } from '../../src/data/demoData';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';

const getAccessToken = (): string | null => {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage.getItem('accessToken');
  }
  return null;
};

export default function WeekScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isDemoMode = user?.id === 'demo-user';
  const { colors } = useThemeStore();

  const [refreshing, setRefreshing] = useState(false);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [weekOffset, setWeekOffset] = useState(0); // 0 = this week, 1 = next week, -1 = last week
  const [apiEvents, setApiEvents] = useState<Event[]>([]);

  // Fetch events from API
  const fetchEvents = useCallback(async (startDate: Date, endDate: Date) => {
    if (isDemoMode || !isAuthenticated) return;

    const token = getAccessToken();
    if (!token) return;

    try {
      const response = await fetch(
        `${API_URL}/api/v1/events?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`,
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
        // API returns { events: [...], total, ... }
        const eventsArray = data.events || [];
        const mappedEvents: Event[] = eventsArray.map((e: any) => ({
          id: e.id,
          title: e.title,
          type: e.type || 'other',
          startAt: e.startAt,
          endAt: e.endAt,
          location: e.location ? {
            name: e.location.name || e.location.address,
            address: e.location.address,
          } : undefined,
          source: e.source || 'external_google',
        }));
        setApiEvents(mappedEvents);
      }
    } catch (err) {
      console.error('Failed to fetch week events:', err);
    }
  }, [isDemoMode, isAuthenticated]);

  // Get week label based on offset
  const weekLabel = useMemo(() => {
    if (weekOffset === 0) return 'This Week';
    if (weekOffset === 1) return 'Next Week';
    if (weekOffset === -1) return 'Last Week';
    if (weekOffset > 1) return `In ${weekOffset} Weeks`;
    return `${Math.abs(weekOffset)} Weeks Ago`;
  }, [weekOffset]);

  // Generate week days for the selected week offset
  const weekDays = useMemo(() => {
    const today = new Date();
    const startOfWeek = new Date(today);
    // Get to Sunday of current week
    startOfWeek.setDate(today.getDate() - today.getDay());
    // Apply week offset
    startOfWeek.setDate(startOfWeek.getDate() + (weekOffset * 7));
    startOfWeek.setHours(0, 0, 0, 0);

    const days = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);
      days.push(date);
    }
    return days;
  }, [weekOffset]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    if (weekDays.length > 0) {
      const startDate = new Date(weekDays[0]);
      const endDate = new Date(weekDays[6]);
      endDate.setHours(23, 59, 59, 999);
      await fetchEvents(startDate, endDate);
    }
    setRefreshing(false);
  }, [fetchEvents, weekDays]);

  // Get week date range for header
  const weekDateRange = useMemo(() => {
    if (weekDays.length === 0) return '';
    const start = weekDays[0];
    const end = weekDays[6];
    const startMonth = start.toLocaleDateString('en-US', { month: 'short' });
    const endMonth = end.toLocaleDateString('en-US', { month: 'short' });

    if (startMonth === endMonth) {
      return `${startMonth} ${start.getDate()} - ${end.getDate()}`;
    }
    return `${startMonth} ${start.getDate()} - ${endMonth} ${end.getDate()}`;
  }, [weekDays]);

  // Fetch events when week changes
  useEffect(() => {
    if (weekDays.length > 0 && !isDemoMode && isAuthenticated) {
      const startDate = new Date(weekDays[0]);
      const endDate = new Date(weekDays[6]);
      endDate.setHours(23, 59, 59, 999);
      fetchEvents(startDate, endDate);
    }
  }, [weekDays, isDemoMode, isAuthenticated, fetchEvents]);

  // Group events by day (using local timezone)
  const eventsByDay = useMemo(() => {
    const events = isDemoMode ? DEMO_EVENTS : apiEvents;
    const map = new Map<string, Event[]>();

    events.forEach(event => {
      const eventDate = new Date(event.startAt);
      // Use local date for grouping, not UTC
      const year = eventDate.getFullYear();
      const month = String(eventDate.getMonth() + 1).padStart(2, '0');
      const day = String(eventDate.getDate()).padStart(2, '0');
      const dateKey = `${year}-${month}-${day}`;

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
  }, [isDemoMode, apiEvents]);

  // Helper to get local date key
  const getLocalDateKey = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Calculate week stats for the displayed week
  const weekStats = useMemo(() => {
    let totalEvents = 0;
    let totalMeetings = 0;
    let totalTravelMinutes = 0;

    weekDays.forEach(day => {
      const dateKey = getLocalDateKey(day);
      const dayEvents = eventsByDay.get(dateKey) || [];
      totalEvents += dayEvents.length;
      totalMeetings += dayEvents.filter(e => e.type === 'meeting').length;
      totalTravelMinutes += dayEvents.reduce((acc, e) => acc + (e.travelSegment?.etaMinutes || 0), 0);
    });

    return { totalEvents, totalMeetings, totalTravelMinutes };
  }, [eventsByDay, weekDays]);

  // Navigate to previous week
  const goToPrevWeek = () => {
    setWeekOffset(prev => prev - 1);
    setSelectedDay(null);
  };

  // Navigate to next week
  const goToNextWeek = () => {
    setWeekOffset(prev => prev + 1);
    setSelectedDay(null);
  };

  // Go to current week
  const goToToday = () => {
    setWeekOffset(0);
    setSelectedDay(null);
  };

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
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header with Navigation */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>{weekLabel}</Text>
          {weekOffset !== 0 && (
            <TouchableOpacity
              style={[styles.todayButton, { backgroundColor: colors.primary + '20' }]}
              onPress={goToToday}
            >
              <Text style={[styles.todayButtonText, { color: colors.primary }]}>Today</Text>
            </TouchableOpacity>
          )}
        </View>
        <Text style={[styles.weekRange, { color: colors.textMuted }]}>{weekDateRange}</Text>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={[styles.statItem, { backgroundColor: colors.card }]}>
            <Text style={[styles.statNumber, { color: colors.text }]}>{weekStats.totalEvents}</Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Events</Text>
          </View>
          <View style={[styles.statItem, { backgroundColor: colors.card }]}>
            <Text style={[styles.statNumber, { color: colors.text }]}>{weekStats.totalMeetings}</Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Meetings</Text>
          </View>
          <View style={[styles.statItem, { backgroundColor: colors.card }]}>
            <Text style={[styles.statNumber, { color: colors.text }]}>{Math.round(weekStats.totalTravelMinutes / 60)}h</Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Travel</Text>
          </View>
        </View>
      </View>

      {/* Week Navigation + Days Header */}
      <View style={[styles.weekNavContainer, { borderBottomColor: colors.border }]}>
        <TouchableOpacity style={styles.navButton} onPress={goToPrevWeek}>
          <Text style={[styles.navButtonText, { color: colors.primary }]}>‹</Text>
        </TouchableOpacity>

        <View style={styles.weekHeader}>
          {weekDays.map((day, index) => {
            const isToday = day.getTime() === today.getTime();
            const dateKey = getLocalDateKey(day);
            const dayEvents = eventsByDay.get(dateKey) || [];
            const isPastDay = day < today;

            return (
              <TouchableOpacity
                key={index}
                style={[
                  styles.dayHeader,
                  isToday && [styles.dayHeaderToday, { backgroundColor: colors.primary }],
                  selectedDay === index && [styles.dayHeaderSelected, { backgroundColor: colors.primaryLight }],
                ]}
                onPress={() => setSelectedDay(selectedDay === index ? null : index)}
              >
                <Text style={[
                  styles.dayName,
                  { color: colors.textMuted },
                  isToday && styles.dayNameToday,
                  isPastDay && weekOffset === 0 && { opacity: 0.5 },
                ]}>
                  {day.toLocaleDateString('en-US', { weekday: 'short' })}
                </Text>
                <Text style={[
                  styles.dayNumber,
                  { color: colors.text },
                  isToday && styles.dayNumberToday,
                  isPastDay && weekOffset === 0 && { opacity: 0.5 },
                ]}>
                  {day.getDate()}
                </Text>
                {dayEvents.length > 0 && (
                  <View style={styles.eventDots}>
                    {dayEvents.slice(0, 3).map((_, i) => (
                      <View
                        key={i}
                        style={[
                          styles.eventDot,
                          { backgroundColor: isToday ? '#fff' : colors.textMuted }
                        ]}
                      />
                    ))}
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity style={styles.navButton} onPress={goToNextWeek}>
          <Text style={[styles.navButtonText, { color: colors.primary }]}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Events List */}
      <ScrollView
        style={styles.eventsList}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        showsVerticalScrollIndicator={false}
      >
        {weekDays.map((day, dayIndex) => {
          const dateKey = getLocalDateKey(day);
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
                <Text style={[
                  styles.daySectionTitle,
                  { color: colors.text },
                  isToday && { color: colors.primary },
                ]}>
                  {isToday ? 'Today' : day.toLocaleDateString('en-US', { weekday: 'long' })}
                </Text>
                <Text style={[styles.daySectionDate, { color: colors.textMuted }]}>
                  {day.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </Text>
              </View>

              {dayEvents.length === 0 ? (
                <View style={[styles.emptyDay, { backgroundColor: colors.card }]}>
                  <Text style={[styles.emptyDayText, { color: colors.textMuted }]}>No events</Text>
                </View>
              ) : (
                dayEvents.map(event => (
                  <TouchableOpacity
                    key={event.id}
                    style={[
                      styles.eventCard,
                      { backgroundColor: colors.card },
                      isPast && styles.eventCardPast,
                    ]}
                    onPress={() => router.push(`/event/${event.id}`)}
                  >
                    <View style={[styles.eventIndicator, { backgroundColor: getTypeColor(event.type) }]} />
                    <View style={styles.eventTime}>
                      <Text style={[styles.eventTimeText, { color: colors.text }, isPast && styles.textMuted]}>
                        {formatTime(event.startAt)}
                      </Text>
                    </View>
                    <View style={styles.eventContent}>
                      <Text style={[styles.eventTitle, { color: colors.text }, isPast && styles.textMuted]} numberOfLines={1}>
                        {event.title}
                      </Text>
                      <View style={styles.eventMeta}>
                        {event.location && (
                          <Text style={[styles.eventLocation, { color: colors.textMuted }]} numberOfLines={1}>
                            {getTypeIcon(event.type)} {event.location.name}
                          </Text>
                        )}
                        {event.travelSegment && (
                          <Text style={[styles.travelInfo, { color: colors.primaryLight }]}>
                            🚗 {event.travelSegment.etaMinutes}m
                          </Text>
                        )}
                      </View>
                    </View>
                    <View style={styles.eventIcons}>
                      {event.isLocked && <Text style={styles.iconText}>🔒</Text>}
                      {event.priority === 3 && <Text style={[styles.priorityIcon, { color: colors.error }]}>!</Text>}
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </View>
          );
        })}

        {/* Empty week state */}
        {weekStats.totalEvents === 0 && (
          <View style={styles.emptyWeek}>
            <Text style={styles.emptyWeekIcon}>📅</Text>
            <Text style={[styles.emptyWeekTitle, { color: colors.text }]}>No events this week</Text>
            <Text style={[styles.emptyWeekSubtitle, { color: colors.textMuted }]}>
              {weekOffset > 0 ? 'Nothing scheduled yet' : 'All clear!'}
            </Text>
          </View>
        )}

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
    paddingBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  weekRange: {
    fontSize: 14,
    color: '#888',
    marginTop: 4,
    marginBottom: 12,
  },
  todayButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  todayButtonText: {
    fontSize: 13,
    fontWeight: '600',
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
  weekNavContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2d2d44',
  },
  navButton: {
    width: 36,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navButtonText: {
    fontSize: 28,
    fontWeight: '300',
    color: '#3b82f6',
  },
  weekHeader: {
    flex: 1,
    flexDirection: 'row',
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
  emptyWeek: {
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 32,
  },
  emptyWeekIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyWeekTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  emptyWeekSubtitle: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
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
