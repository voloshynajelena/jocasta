import { useState } from 'react';
import { YStack, XStack, Text, Card, ScrollView, Spinner } from 'tamagui';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RefreshControl } from 'react-native';
import { useQuery } from '@tanstack/react-query';

import { api } from '@/services/api';
import { useAuthStore } from '@/store/authStore';
import { EventCard } from '@/components/EventCard';
import { QuickAddInput } from '@/components/QuickAddInput';

export default function WeekScreen() {
  const { isAuthenticated } = useAuthStore();
  const [refreshing, setRefreshing] = useState(false);

  const today = new Date();
  const startDate = today.toISOString().split('T')[0];
  const endOfWeek = new Date(today);
  endOfWeek.setDate(endOfWeek.getDate() + 6);
  const endDate = endOfWeek.toISOString().split('T')[0];

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['events', 'week', startDate],
    queryFn: () => api.getEvents({ startDate, endDate }),
    enabled: isAuthenticated,
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={{ flex: 1 }}>
        <YStack flex={1} justifyContent="center" alignItems="center" padding="$4">
          <Text color="$gray11">Please sign in to view your week</Text>
        </YStack>
      </SafeAreaView>
    );
  }

  const events = data?.events || [];

  // Group events by day
  const eventsByDay: Record<string, typeof events> = {};
  for (let i = 0; i < 7; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() + i);
    const dateKey = date.toISOString().split('T')[0];
    eventsByDay[dateKey] = [];
  }

  events.forEach((event) => {
    const dateKey = new Date(event.startAt).toISOString().split('T')[0];
    if (eventsByDay[dateKey]) {
      eventsByDay[dateKey].push(event);
    }
  });

  // Sort events within each day
  Object.keys(eventsByDay).forEach((key) => {
    eventsByDay[key].sort(
      (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
    );
  });

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['left', 'right']}>
      <YStack flex={1}>
        <QuickAddInput />

        <ScrollView
          flex={1}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          <YStack padding="$4" gap="$4">
            <Text fontSize="$8" fontWeight="bold">
              This Week
            </Text>

            {isLoading ? (
              <YStack height={200} justifyContent="center" alignItems="center">
                <Spinner size="large" />
              </YStack>
            ) : (
              Object.entries(eventsByDay).map(([dateKey, dayEvents]) => {
                const date = new Date(dateKey + 'T00:00:00');
                const isToday = dateKey === today.toISOString().split('T')[0];

                return (
                  <YStack key={dateKey} gap="$2">
                    <XStack alignItems="center" gap="$2">
                      <Text
                        fontWeight={isToday ? 'bold' : 'normal'}
                        color={isToday ? '$blue10' : '$color'}
                      >
                        {date.toLocaleDateString('en-US', {
                          weekday: 'long',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </Text>
                      {isToday && (
                        <Text
                          fontSize="$2"
                          backgroundColor="$blue5"
                          paddingHorizontal="$2"
                          borderRadius="$2"
                          color="$blue10"
                        >
                          Today
                        </Text>
                      )}
                    </XStack>

                    {dayEvents.length === 0 ? (
                      <Card padding="$3" opacity={0.6}>
                        <Text color="$gray10" fontSize="$3">
                          No events
                        </Text>
                      </Card>
                    ) : (
                      <YStack gap="$2">
                        {dayEvents.map((event) => (
                          <EventCard key={event.id} event={event} compact />
                        ))}
                      </YStack>
                    )}
                  </YStack>
                );
              })
            )}
          </YStack>
        </ScrollView>
      </YStack>
    </SafeAreaView>
  );
}
