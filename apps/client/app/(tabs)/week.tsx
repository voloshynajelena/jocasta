import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';

import { api } from '../../src/services/api';
import { useAuthStore } from '../../src/store/authStore';
import { getWeekEvents, DEMO_EVENTS } from '../../src/data/mockData';

export default function WeekScreen() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const isDemoMode = user?.id === 'demo-user';
  const [refreshing, setRefreshing] = useState(false);

  const today = new Date();
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay());
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 7);

  const { data: eventsData, refetch } = useQuery({
    queryKey: ['events', 'week', weekStart.toISOString()],
    queryFn: () =>
      api.getEvents({
        startDate: weekStart.toISOString().split('T')[0],
        endDate: weekEnd.toISOString().split('T')[0],
      }),
    enabled: isAuthenticated && !isDemoMode,
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    if (!isDemoMode) {
      await refetch();
    }
    setRefreshing(false);
  }, [refetch, isDemoMode]);

  // Use mock data in demo mode
  const events = isDemoMode ? getWeekEvents() : (eventsData?.events || []);

  // Group events by day
  const days = [];
  for (let i = 0; i < 7; i++) {
    const day = new Date(weekStart);
    day.setDate(weekStart.getDate() + i);
    const dayStr = day.toISOString().split('T')[0];
    const dayEvents = events
      .filter((e: any) => e.startAt.startsWith(dayStr))
      .sort((a: any, b: any) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
    days.push({ date: day, events: dayEvents });
  }

  if (!isAuthenticated) {
    return (
      <View style={styles.container}>
        <Text style={styles.authText}>Sign in to view your week</Text>
      </View>
    );
  }

  // Calculate week stats
  const totalEvents = events.length;
  const totalMeetings = events.filter((e: any) => e.type === 'meeting').length;
  const busyDays = days.filter((d) => d.events.length > 3).length;

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b82f6" />
      }
    >
      <Text style={styles.header}>This Week</Text>
      <Text style={styles.weekRange}>
        {weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} -{' '}
        {weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
      </Text>

      {/* Week Summary */}
      <View style={styles.summaryRow}>
        <View style={styles.summaryBadge}>
          <Text style={styles.summaryBadgeNumber}>{totalEvents}</Text>
          <Text style={styles.summaryBadgeLabel}>Events</Text>
        </View>
        <View style={styles.summaryBadge}>
          <Text style={styles.summaryBadgeNumber}>{totalMeetings}</Text>
          <Text style={styles.summaryBadgeLabel}>Meetings</Text>
        </View>
        <View style={styles.summaryBadge}>
          <Text style={styles.summaryBadgeNumber}>{busyDays}</Text>
          <Text style={styles.summaryBadgeLabel}>Busy Days</Text>
        </View>
      </View>

      {days.map((day, idx) => {
        const isToday = day.date.toDateString() === today.toDateString();
        const isPast = day.date < today && !isToday;
        const dayName = day.date.toLocaleDateString('en-US', { weekday: 'short' });
        const isWeekend = dayName === 'Sat' || dayName === 'Sun';

        return (
          <View
            key={idx}
            style={[
              styles.dayCard,
              isToday && styles.dayCardToday,
              isPast && styles.dayCardPast,
            ]}
          >
            <View style={styles.dayHeader}>
              <Text style={[styles.dayName, isToday && styles.dayNameToday]}>
                {dayName}
              </Text>
              <Text style={[styles.dayDate, isToday && styles.dayDateToday]}>
                {day.date.getDate()}
              </Text>
              {isWeekend && <Text style={styles.weekendBadge}>Weekend</Text>}
            </View>
            <View style={styles.dayEvents}>
              {day.events.length === 0 ? (
                <Text style={styles.noEvents}>
                  {isWeekend ? 'Enjoy your day off!' : 'No events scheduled'}
                </Text>
              ) : (
                day.events.slice(0, 4).map((event: any) => (
                  <View key={event.id} style={styles.eventItem}>
                    <View
                      style={[styles.eventDot, { backgroundColor: getTypeColor(event.type) }]}
                    />
                    <Text style={styles.eventTime}>
                      {new Date(event.startAt).toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </Text>
                    <Text style={styles.eventTitle} numberOfLines={1}>
                      {event.title}
                    </Text>
                  </View>
                ))
              )}
              {day.events.length > 4 && (
                <Text style={styles.moreEvents}>+{day.events.length - 4} more</Text>
              )}
            </View>
          </View>
        );
      })}

      <View style={styles.bottomPadding} />
    </ScrollView>
  );
}

function getTypeColor(type: string): string {
  const colors: Record<string, string> = {
    appointment: '#ef4444',
    meeting: '#3b82f6',
    personal_workout: '#10b981',
    dog_walk: '#8b5cf6',
    kids_activity: '#f59e0b',
    personal: '#6366f1',
    default: '#6b7280',
  };
  return colors[type] || colors.default;
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
  },
  weekRange: {
    fontSize: 15,
    color: '#888',
    marginTop: 4,
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  summaryBadge: {
    flex: 1,
    backgroundColor: '#2d2d44',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  summaryBadgeNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  summaryBadgeLabel: {
    fontSize: 12,
    color: '#888',
    marginTop: 4,
  },
  dayCard: {
    backgroundColor: '#2d2d44',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    flexDirection: 'row',
  },
  dayCardToday: {
    borderWidth: 2,
    borderColor: '#3b82f6',
    backgroundColor: '#2d2d54',
  },
  dayCardPast: {
    opacity: 0.6,
  },
  dayHeader: {
    width: 55,
    alignItems: 'center',
  },
  dayName: {
    color: '#888',
    fontSize: 12,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  dayNameToday: {
    color: '#3b82f6',
  },
  dayDate: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 2,
  },
  dayDateToday: {
    color: '#3b82f6',
  },
  weekendBadge: {
    fontSize: 9,
    color: '#10b981',
    marginTop: 4,
    textTransform: 'uppercase',
  },
  dayEvents: {
    flex: 1,
    marginLeft: 16,
    justifyContent: 'center',
  },
  noEvents: {
    color: '#666',
    fontStyle: 'italic',
    fontSize: 14,
  },
  eventItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  eventDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  eventTime: {
    color: '#888',
    width: 65,
    fontSize: 13,
  },
  eventTitle: {
    color: '#fff',
    flex: 1,
    fontSize: 14,
  },
  moreEvents: {
    color: '#3b82f6',
    fontSize: 13,
    marginTop: 4,
  },
  bottomPadding: {
    height: 100,
  },
});
