import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, RefreshControl } from 'react-native';
import { useState, useCallback, useMemo } from 'react';
import { useRouter } from 'expo-router';

import { useAuthStore } from '../../src/store/authStore';
import { useThemeStore } from '../../src/store/themeStore';
import { useSettingsStore, TRANSPORT_MULTIPLIERS } from '../../src/store/settingsStore';
import {
  DEMO_EVENTS,
  DEMO_WEATHER,
  DEMO_DAILY_SUMMARY,
  Event,
  DEMO_USER,
} from '../../src/data/demoData';

export default function TodayScreen() {
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);
  const user = useAuthStore((s) => s.user);
  const isDemoMode = user?.id === 'demo-user';

  const { colors } = useThemeStore();
  const { transportMode } = useSettingsStore();

  const [quickInput, setQuickInput] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  // Get transport mode icon
  const getTransportModeIcon = () => {
    const icons = {
      sedan: '🚗',
      motorcycle: '🏍️',
      taxi: '🚕',
      transit: '🚌',
    };
    return icons[transportMode];
  };

  // Calculate adjusted travel time based on transport mode
  const getAdjustedTravelTime = (baseMinutes: number) => {
    const multiplier = TRANSPORT_MULTIPLIERS[transportMode];
    return Math.round(baseMinutes * multiplier);
  };

  const today = new Date();
  const todayStart = new Date(today);
  todayStart.setHours(0, 0, 0, 0);
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);

  // Get today's events
  const todayEvents = useMemo(() => {
    if (!isDemoMode) return [];
    return DEMO_EVENTS.filter(e => {
      const eventDate = new Date(e.startAt);
      return eventDate >= todayStart && eventDate < tomorrowStart;
    }).sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
  }, [isDemoMode]);

  const summary = DEMO_DAILY_SUMMARY;
  const now = new Date();

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    setRefreshing(false);
  }, []);

  const handleQuickAdd = () => {
    if (quickInput.trim()) {
      router.push({
        pathname: '/proposal/[id]',
        params: { id: 'new', title: quickInput.trim() }
      });
      setQuickInput('');
    }
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </View>
    );
  }

  if (!isAuthenticated) {
    return (
      <View style={styles.container}>
        <View style={styles.authPrompt}>
          <Text style={styles.logoText}>J.O.C.A.S.T.A.</Text>
          <Text style={styles.authTitle}>Your Intelligent Schedule Assistant</Text>
          <Text style={styles.authSubtitle}>Sign in to manage your schedule with AI-powered planning</Text>
          <TouchableOpacity
            style={styles.signInButton}
            onPress={() => router.push('/(auth)/login')}
          >
            <Text style={styles.signInText}>Get Started</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Find current event
  const currentEventIndex = todayEvents.findIndex((event) => {
    const start = new Date(event.startAt);
    const end = new Date(event.endAt);
    return now >= start && now <= end;
  });

  // Calculate total travel time
  const totalTravelMinutes = todayEvents.reduce((acc, e) => {
    return acc + (e.travelSegment?.etaMinutes || 0);
  }, 0);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header - Prominent Date Display */}
      <View style={[styles.header, { backgroundColor: colors.background }]}>
        <View style={styles.dateHeader}>
          <Text style={[styles.dayName, { color: colors.primary }]}>
            {today.toLocaleDateString('en-US', { weekday: 'long' })}
          </Text>
          <Text style={[styles.dateNumber, { color: colors.text }]}>
            {today.getDate()}
          </Text>
          <Text style={[styles.monthYear, { color: colors.textSecondary }]}>
            {today.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </Text>
        </View>
        <View style={[styles.weatherCard, { backgroundColor: colors.card }]}>
          <Text style={styles.weatherIcon}>{getWeatherIcon(DEMO_WEATHER.current.condition)}</Text>
          <View>
            <Text style={[styles.weatherTemp, { color: colors.text }]}>{DEMO_WEATHER.current.temperature}°C</Text>
            <Text style={[styles.weatherCondition, { color: colors.textMuted }]}>
              {DEMO_WEATHER.current.condition}
            </Text>
          </View>
        </View>
      </View>

      {/* Weather Alert - Before Quick Add */}
      {DEMO_WEATHER.alerts.length > 0 && (
        <View style={[styles.alertBanner, { backgroundColor: colors.card, borderLeftColor: colors.warning }]}>
          <View style={[styles.alertIconContainer, { backgroundColor: colors.warning + '30' }]}>
            <Text style={[styles.alertIconText, { color: colors.warning }]}>!</Text>
          </View>
          <Text style={[styles.alertText, { color: colors.text }]}>{DEMO_WEATHER.alerts[0].message}</Text>
        </View>
      )}

      {/* Quick Add */}
      <View style={styles.quickAddContainer}>
        <TextInput
          style={[styles.quickInput, { backgroundColor: colors.card, color: colors.text }]}
          placeholder="Add event... 'Coffee with Sarah Friday 3pm'"
          placeholderTextColor={colors.textMuted}
          value={quickInput}
          onChangeText={setQuickInput}
          onSubmitEditing={handleQuickAdd}
          returnKeyType="send"
        />
        <TouchableOpacity
          style={[styles.addButton, { backgroundColor: colors.primary }, !quickInput.trim() && styles.addButtonDisabled]}
          onPress={handleQuickAdd}
          disabled={!quickInput.trim()}
        >
          <Text style={styles.addButtonText}>+</Text>
        </TouchableOpacity>
      </View>

      {/* Summary Cards */}
      <View style={styles.summaryRow}>
        <View style={[styles.summaryCard, { backgroundColor: colors.card }]}>
          <Text style={[styles.summaryNumber, { color: colors.text }]}>{todayEvents.length}</Text>
          <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Events</Text>
        </View>
        <View style={[styles.summaryCard, { backgroundColor: colors.card }]}>
          <Text style={[styles.summaryNumber, { color: colors.text }]}>
            {todayEvents.filter(e => e.type === 'meeting').length}
          </Text>
          <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Meetings</Text>
        </View>
        <View style={[styles.summaryCard, { backgroundColor: colors.card }]}>
          <Text style={[styles.summaryNumber, { color: colors.text }]}>{totalTravelMinutes}m</Text>
          <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Travel</Text>
        </View>
        <View style={[styles.summaryCard, { backgroundColor: colors.card }]}>
          <Text style={[styles.summaryNumber, { color: colors.text }]}>
            {Math.round((480 - todayEvents.length * 45) / 60)}h
          </Text>
          <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Free</Text>
        </View>
      </View>

      {/* Visual Flow Header */}
      <View style={styles.flowHeader}>
        <Text style={styles.sectionTitle}>EVENT FLOW</Text>
        <View style={styles.flowLegend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#3b82f6' }]} />
            <Text style={styles.legendText}>Event</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendLine]} />
            <Text style={styles.legendText}>Travel</Text>
          </View>
        </View>
      </View>

      {/* Chain View - Visual Flow */}
      <ScrollView
        style={styles.eventsList}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b82f6" />
        }
        showsVerticalScrollIndicator={false}
      >
        {todayEvents.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📭</Text>
            <Text style={styles.emptyTitle}>No events today</Text>
            <Text style={styles.emptySubtitle}>Use the input above to add something</Text>
          </View>
        ) : (
          <View style={styles.flowContainer}>
            {/* Timeline Track */}
            <View style={styles.timelineTrack}>
              {todayEvents.map((event, index) => {
                const isPast = new Date(event.endAt) < now;
                const isCurrent = index === currentEventIndex;
                const showTravel = index > 0 && event.travelSegment;

                return (
                  <View key={event.id}>
                    {/* Travel Connector */}
                    {showTravel && event.travelSegment && (
                      <View style={styles.travelConnector}>
                        <View style={styles.travelPipe}>
                          <View style={styles.travelDashes} />
                          <View style={styles.travelArrow}>
                            <Text style={styles.arrowText}>▼</Text>
                          </View>
                        </View>
                        <View style={styles.travelCard}>
                          <View style={styles.travelCardInner}>
                            <Text style={styles.travelModeIcon}>{getTransportModeIcon()}</Text>
                            <View style={styles.travelCardContent}>
                              <Text style={styles.travelLeaveBy}>
                                Leave by {formatTime(event.travelSegment.departAt)}
                              </Text>
                              <Text style={styles.travelEta}>
                                {getAdjustedTravelTime(event.travelSegment.etaMinutes)} min {transportMode} • {event.travelSegment.distanceKm.toFixed(1)} km
                              </Text>
                            </View>
                            {event.travelSegment.confidence < 0.9 && (
                              <View style={styles.travelWarningBadge}>
                                <Text style={styles.travelWarningText}>~</Text>
                              </View>
                            )}
                          </View>
                        </View>
                      </View>
                    )}

                    {/* Event Node */}
                    <TouchableOpacity
                      style={[
                        styles.eventNode,
                        isPast && styles.eventNodePast,
                        isCurrent && styles.eventNodeCurrent,
                      ]}
                      onPress={() => router.push(`/event/${event.id}`)}
                    >
                      {/* Node Indicator */}
                      <View style={styles.nodeIndicator}>
                        <View style={[
                          styles.nodeDot,
                          { backgroundColor: getTypeColor(event.type) },
                          isCurrent && styles.nodeDotCurrent,
                        ]}>
                          {isCurrent && <View style={styles.nodePulse} />}
                        </View>
                        {index < todayEvents.length - 1 && (
                          <View style={[
                            styles.nodeConnector,
                            isPast && styles.nodeConnectorPast,
                          ]} />
                        )}
                      </View>

                      {/* Event Block */}
                      <View style={[
                        styles.eventBlock,
                        { borderLeftColor: getTypeColor(event.type) },
                        isCurrent && styles.eventBlockCurrent,
                      ]}>
                        {/* Time Header */}
                        <View style={styles.eventTimeHeader}>
                          <Text style={[styles.eventStartTime, isPast && styles.textMuted]}>
                            {formatTime(event.startAt)}
                          </Text>
                          <Text style={styles.eventDash}>–</Text>
                          <Text style={[styles.eventEndTime, isPast && styles.textMuted]}>
                            {formatTime(event.endAt)}
                          </Text>
                          <Text style={styles.eventDuration}>
                            ({getEventDuration(event.startAt, event.endAt)})
                          </Text>
                          {isCurrent && (
                            <View style={styles.nowBadge}>
                              <Text style={styles.nowText}>NOW</Text>
                            </View>
                          )}
                        </View>

                        {/* Event Content */}
                        <View style={styles.eventMain}>
                          <Text style={styles.eventTypeIcon}>{getTypeIcon(event.type)}</Text>
                          <View style={styles.eventInfo}>
                            <View style={styles.eventTitleRow}>
                              <Text style={[styles.eventTitle, isPast && styles.textMuted]} numberOfLines={1}>
                                {event.title}
                              </Text>
                              {event.isLocked && <Text style={styles.lockIcon}>🔒</Text>}
                              {event.priority === 3 && (
                                <View style={styles.priorityBadge}>
                                  <Text style={styles.priorityText}>!</Text>
                                </View>
                              )}
                            </View>
                            {event.location && (
                              <Text style={styles.eventLocation} numberOfLines={1}>
                                📍 {event.location.name}
                              </Text>
                            )}
                          </View>
                        </View>

                        {/* Source & Status Footer */}
                        <View style={styles.eventFooter}>
                          <View style={[styles.typeBadge, { backgroundColor: getTypeColor(event.type) + '30' }]}>
                            <Text style={[styles.typeBadgeText, { color: getTypeColor(event.type) }]}>
                              {event.type.replace(/_/g, ' ')}
                            </Text>
                          </View>
                          {event.source === 'external_google' && (
                            <View style={styles.googleBadge}>
                              <Text style={styles.googleText}>Google</Text>
                            </View>
                          )}
                        </View>
                      </View>
                    </TouchableOpacity>
                  </View>
                );
              })}

              {/* End of Day Marker */}
              <View style={styles.endMarker}>
                <View style={styles.endDot} />
                <Text style={styles.endText}>End of scheduled events</Text>
              </View>
            </View>
          </View>
        )}

        <View style={styles.bottomPadding} />
      </ScrollView>
    </View>
  );
}

// Helper Functions
function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function formatTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function getEventDuration(start: string, end: string): string {
  const diff = (new Date(end).getTime() - new Date(start).getTime()) / 1000 / 60;
  if (diff < 60) return `${diff}m`;
  const hours = Math.floor(diff / 60);
  const mins = diff % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
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
    travel_block: '#64748b',
  };
  return colors[type] || '#6b7280';
}

function getWeatherIcon(condition: string): string {
  const icons: Record<string, string> = {
    clear: '☀️',
    snow: '🌨️',
    rain: '🌧️',
    freezing_rain: '🧊',
    wind: '💨',
  };
  return icons[condition] || '⛅';
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
  },
  authPrompt: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  logoText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#3b82f6',
    marginBottom: 8,
    letterSpacing: 2,
  },
  authTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
  },
  authSubtitle: {
    fontSize: 16,
    color: '#888',
    marginBottom: 32,
    textAlign: 'center',
    lineHeight: 24,
  },
  signInButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 48,
    paddingVertical: 16,
    borderRadius: 12,
  },
  signInText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  dateHeader: {
    flex: 1,
  },
  dayName: {
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  dateNumber: {
    fontSize: 48,
    fontWeight: 'bold',
    marginVertical: -4,
  },
  monthYear: {
    fontSize: 14,
  },
  weatherCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2d2d44',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    gap: 10,
  },
  weatherIcon: {
    fontSize: 28,
  },
  weatherTemp: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  weatherCondition: {
    fontSize: 12,
    textTransform: 'capitalize',
  },
  quickAddContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 10,
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
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 12,
    borderRadius: 10,
    borderLeftWidth: 4,
  },
  alertIconContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  alertIconText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  alertText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  summaryRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 16,
    gap: 8,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: '#2d2d44',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  summaryNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  summaryLabel: {
    fontSize: 11,
    color: '#888',
    marginTop: 4,
    textTransform: 'uppercase',
  },
  flowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#888',
    letterSpacing: 1,
  },
  flowLegend: {
    flexDirection: 'row',
    gap: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendLine: {
    width: 16,
    height: 3,
    backgroundColor: '#60a5fa',
    borderRadius: 1,
  },
  legendText: {
    fontSize: 11,
    color: '#666',
  },
  eventsList: {
    flex: 1,
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
  flowContainer: {
    paddingHorizontal: 16,
  },
  timelineTrack: {
    paddingLeft: 8,
  },
  travelConnector: {
    flexDirection: 'row',
    marginLeft: 7,
    marginVertical: 4,
  },
  travelPipe: {
    width: 20,
    alignItems: 'center',
    marginRight: 12,
  },
  travelDashes: {
    width: 3,
    flex: 1,
    backgroundColor: '#60a5fa',
    minHeight: 30,
    borderRadius: 2,
  },
  travelArrow: {
    marginTop: -4,
  },
  arrowText: {
    color: '#60a5fa',
    fontSize: 10,
  },
  travelCard: {
    flex: 1,
    backgroundColor: '#1e3a5f',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2563eb',
    overflow: 'hidden',
  },
  travelCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
  },
  travelModeIcon: {
    fontSize: 20,
    marginRight: 10,
  },
  travelCardContent: {
    flex: 1,
  },
  travelLeaveBy: {
    color: '#fbbf24',
    fontSize: 14,
    fontWeight: '600',
  },
  travelEta: {
    color: '#93c5fd',
    fontSize: 12,
    marginTop: 2,
  },
  travelWarningBadge: {
    backgroundColor: '#f59e0b',
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  travelWarningText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  eventNode: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  eventNodePast: {
    opacity: 0.6,
  },
  eventNodeCurrent: {
    opacity: 1,
  },
  nodeIndicator: {
    width: 34,
    alignItems: 'center',
  },
  nodeDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 3,
    borderColor: '#1a1a2e',
    zIndex: 1,
  },
  nodeDotCurrent: {
    borderColor: '#3b82f6',
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
  },
  nodePulse: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#3b82f620',
    top: -6,
    left: -6,
  },
  nodeConnector: {
    width: 3,
    flex: 1,
    backgroundColor: '#3d3d5c',
    marginTop: -2,
    minHeight: 20,
    borderRadius: 1,
  },
  nodeConnectorPast: {
    backgroundColor: '#4d4d6c',
  },
  eventBlock: {
    flex: 1,
    backgroundColor: '#2d2d44',
    borderRadius: 14,
    borderLeftWidth: 4,
    padding: 14,
    marginLeft: 4,
  },
  eventBlockCurrent: {
    backgroundColor: '#2d2d54',
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  eventTimeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    flexWrap: 'wrap',
  },
  eventStartTime: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  eventDash: {
    color: '#666',
    marginHorizontal: 4,
  },
  eventEndTime: {
    color: '#888',
    fontSize: 14,
  },
  eventDuration: {
    color: '#666',
    fontSize: 12,
    marginLeft: 8,
  },
  nowBadge: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 'auto',
  },
  nowText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  eventMain: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  eventTypeIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  eventInfo: {
    flex: 1,
  },
  eventTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  eventTitle: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
    flex: 1,
  },
  lockIcon: {
    fontSize: 12,
    marginLeft: 6,
  },
  priorityBadge: {
    backgroundColor: '#7f1d1d',
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
  priorityText: {
    color: '#fca5a5',
    fontSize: 12,
    fontWeight: 'bold',
  },
  eventLocation: {
    color: '#888',
    fontSize: 14,
    marginTop: 4,
  },
  eventFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  typeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  googleBadge: {
    backgroundColor: '#4285f4',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  googleText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  textMuted: {
    opacity: 0.7,
  },
  endMarker: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    marginLeft: 3,
  },
  endDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#3d3d5c',
    marginRight: 14,
  },
  endText: {
    color: '#666',
    fontSize: 13,
  },
  bottomPadding: {
    height: 100,
  },
});
