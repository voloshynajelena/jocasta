import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, RefreshControl } from 'react-native';
import { useState, useCallback } from 'react';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { api } from '../../src/services/api';
import { useAuthStore } from '../../src/store/authStore';
import { getTodayEvents, DEMO_EVENTS } from '../../src/data/mockData';

export default function TodayScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);
  const user = useAuthStore((s) => s.user);
  const isDemoMode = user?.id === 'demo-user';

  const [quickInput, setQuickInput] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const tomorrowStr = new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const { data: eventsData, refetch } = useQuery({
    queryKey: ['events', todayStr],
    queryFn: () => api.getEvents({ startDate: todayStr, endDate: tomorrowStr }),
    enabled: isAuthenticated && !isDemoMode,
  });

  const proposeMutation = useMutation({
    mutationFn: (text: string) => api.propose(text),
    onSuccess: (data) => {
      if (data.proposals.length > 0) {
        router.push(`/proposal/${data.proposals[0].id}`);
      }
    },
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    if (!isDemoMode) {
      await refetch();
    }
    setRefreshing(false);
  }, [refetch, isDemoMode]);

  const handleQuickAdd = () => {
    if (quickInput.trim()) {
      if (isDemoMode) {
        // In demo mode, show a proposal preview
        router.push('/proposal/demo-1');
      } else {
        proposeMutation.mutate(quickInput.trim());
      }
      setQuickInput('');
    }
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  if (!isAuthenticated) {
    return (
      <View style={styles.container}>
        <View style={styles.authPrompt}>
          <Text style={styles.authTitle}>Welcome to Jocasta</Text>
          <Text style={styles.authSubtitle}>Sign in to manage your schedule</Text>
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

  // Use mock data in demo mode
  const events = isDemoMode ? getTodayEvents() : (eventsData?.events || []);
  const now = new Date();

  // Sort events by time
  const sortedEvents = [...events].sort(
    (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()
  );

  // Find current/next event
  const currentEventIndex = sortedEvents.findIndex((event) => {
    const start = new Date(event.startAt);
    const end = new Date(event.endAt);
    return now >= start && now <= end;
  });

  return (
    <View style={styles.container}>
      {/* Quick Add Input */}
      <View style={styles.quickAddContainer}>
        <TextInput
          style={styles.quickInput}
          placeholder="Add event... (e.g., 'Coffee with Sarah Friday 3pm')"
          placeholderTextColor="#666"
          value={quickInput}
          onChangeText={setQuickInput}
          onSubmitEditing={handleQuickAdd}
          returnKeyType="send"
        />
        <TouchableOpacity
          style={[styles.addButton, !quickInput.trim() && styles.addButtonDisabled]}
          onPress={handleQuickAdd}
          disabled={!quickInput.trim() || proposeMutation.isPending}
        >
          <Text style={styles.addButtonText}>+</Text>
        </TouchableOpacity>
      </View>

      {/* Greeting */}
      <View style={styles.greetingContainer}>
        <Text style={styles.greeting}>
          {getGreeting()}, {user?.name?.split(' ')[0] || 'there'}
        </Text>
        <Text style={styles.dateSubtitle}>
          {today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </Text>
      </View>

      {/* Summary Card */}
      <View style={styles.summaryCard}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryNumber}>{sortedEvents.length}</Text>
          <Text style={styles.summaryLabel}>Events</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryNumber}>
            {sortedEvents.filter((e) => e.type === 'meeting').length}
          </Text>
          <Text style={styles.summaryLabel}>Meetings</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryNumber}>
            {Math.round(getFreeTime(sortedEvents) / 60)}h
          </Text>
          <Text style={styles.summaryLabel}>Free</Text>
        </View>
      </View>

      {/* Events List */}
      <ScrollView
        style={styles.eventsList}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b82f6" />
        }
      >
        <Text style={styles.sectionTitle}>Today's Schedule</Text>

        {sortedEvents.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📭</Text>
            <Text style={styles.emptyTitle}>No events today</Text>
            <Text style={styles.emptySubtitle}>Use the input above to add something</Text>
          </View>
        ) : (
          sortedEvents.map((event: any, index: number) => {
            const isPast = new Date(event.endAt) < now;
            const isCurrent = index === currentEventIndex;

            return (
              <TouchableOpacity
                key={event.id}
                style={[
                  styles.eventCard,
                  isPast && styles.eventCardPast,
                  isCurrent && styles.eventCardCurrent,
                ]}
              >
                <View style={styles.eventTime}>
                  <Text style={[styles.eventTimeText, isPast && styles.textMuted]}>
                    {new Date(event.startAt).toLocaleTimeString('en-US', {
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </Text>
                  <Text style={[styles.eventDuration, isPast && styles.textMuted]}>
                    {getEventDuration(event.startAt, event.endAt)}
                  </Text>
                </View>
                <View style={styles.eventContent}>
                  <Text style={[styles.eventTitle, isPast && styles.textMuted]}>
                    {event.title}
                  </Text>
                  {event.location && (
                    <Text style={styles.eventLocation}>
                      {getLocationIcon(event.type)} {event.location.name}
                    </Text>
                  )}
                </View>
                <View
                  style={[
                    styles.eventIndicator,
                    { backgroundColor: getTypeColor(event.type) },
                    isPast && styles.indicatorPast,
                  ]}
                />
              </TouchableOpacity>
            );
          })
        )}

        <View style={styles.bottomPadding} />
      </ScrollView>
    </View>
  );
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function getEventDuration(start: string, end: string): string {
  const diff = (new Date(end).getTime() - new Date(start).getTime()) / 1000 / 60;
  if (diff < 60) return `${diff}m`;
  const hours = Math.floor(diff / 60);
  const mins = diff % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

function getFreeTime(events: any[]): number {
  // Calculate free time between 9am and 6pm
  const workStart = 9 * 60; // 9am in minutes
  const workEnd = 18 * 60; // 6pm in minutes
  const totalWorkMinutes = workEnd - workStart;

  const busyMinutes = events
    .filter((e) => {
      const startHour = new Date(e.startAt).getHours();
      return startHour >= 9 && startHour < 18;
    })
    .reduce((acc, e) => {
      const diff = (new Date(e.endAt).getTime() - new Date(e.startAt).getTime()) / 1000 / 60;
      return acc + diff;
    }, 0);

  return Math.max(0, totalWorkMinutes - busyMinutes);
}

function getLocationIcon(type: string): string {
  const icons: Record<string, string> = {
    meeting: '🏢',
    appointment: '🏥',
    personal_workout: '💪',
    dog_walk: '🐕',
    kids_activity: '👧',
    personal: '📍',
  };
  return icons[type] || '📍';
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
  },
  loadingText: {
    color: '#fff',
    textAlign: 'center',
    marginTop: 100,
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
  quickAddContainer: {
    flexDirection: 'row',
    padding: 16,
    paddingTop: 8,
    gap: 12,
  },
  quickInput: {
    flex: 1,
    backgroundColor: '#2d2d44',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#fff',
    fontSize: 15,
  },
  addButton: {
    backgroundColor: '#3b82f6',
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButtonDisabled: {
    opacity: 0.5,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '600',
  },
  greetingContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  greeting: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  dateSubtitle: {
    fontSize: 15,
    color: '#888',
    marginTop: 4,
  },
  summaryCard: {
    flexDirection: 'row',
    backgroundColor: '#2d2d44',
    marginHorizontal: 16,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryNumber: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  summaryLabel: {
    fontSize: 13,
    color: '#888',
    marginTop: 4,
  },
  summaryDivider: {
    width: 1,
    backgroundColor: '#3d3d5c',
  },
  eventsList: {
    flex: 1,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#888',
    textTransform: 'uppercase',
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#888',
  },
  eventCard: {
    flexDirection: 'row',
    backgroundColor: '#2d2d44',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    alignItems: 'center',
  },
  eventCardPast: {
    opacity: 0.6,
  },
  eventCardCurrent: {
    borderWidth: 2,
    borderColor: '#3b82f6',
    backgroundColor: '#2d2d54',
  },
  eventTime: {
    width: 65,
  },
  eventTimeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  eventDuration: {
    color: '#666',
    fontSize: 12,
    marginTop: 2,
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
  eventLocation: {
    color: '#888',
    fontSize: 13,
    marginTop: 4,
  },
  eventIndicator: {
    width: 4,
    height: 44,
    borderRadius: 2,
    marginLeft: 12,
  },
  indicatorPast: {
    opacity: 0.5,
  },
  textMuted: {
    opacity: 0.7,
  },
  bottomPadding: {
    height: 100,
  },
});
