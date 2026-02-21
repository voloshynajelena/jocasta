import { useState } from 'react';
import { YStack, XStack, Text, Card, ScrollView, Input, Button, Spinner } from 'tamagui';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RefreshControl } from 'react-native';
import { Plus, MapPin, Clock, Car } from '@tamagui/lucide-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';

import { api } from '@/services/api';
import { useAuthStore } from '@/store/authStore';
import { EventCard } from '@/components/EventCard';
import { QuickAddInput } from '@/components/QuickAddInput';

export default function TodayScreen() {
  const { isAuthenticated } = useAuthStore();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const today = new Date();
  const startDate = today.toISOString().split('T')[0];
  const endDate = startDate;

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['events', 'today'],
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
          <Text fontSize="$6" fontWeight="bold" marginBottom="$2">
            Welcome to Jocasta
          </Text>
          <Text color="$gray11" textAlign="center" marginBottom="$4">
            Your AI-powered scheduling assistant
          </Text>
          <Button
            size="$4"
            theme="blue"
            onPress={() => router.push('/(auth)/login')}
          >
            Sign in with Google
          </Button>
        </YStack>
      </SafeAreaView>
    );
  }

  const events = data?.events || [];
  const now = new Date();

  // Sort events by start time
  const sortedEvents = [...events].sort(
    (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
  );

  // Split into upcoming and past
  const upcomingEvents = sortedEvents.filter(
    (e) => new Date(e.endAt) >= now,
  );
  const pastEvents = sortedEvents.filter(
    (e) => new Date(e.endAt) < now,
  );

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
          <YStack padding="$4" gap="$3">
            <XStack justifyContent="space-between" alignItems="center">
              <Text fontSize="$8" fontWeight="bold">
                Today
              </Text>
              <Text color="$gray11">
                {today.toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                })}
              </Text>
            </XStack>

            {isLoading ? (
              <YStack height={200} justifyContent="center" alignItems="center">
                <Spinner size="large" />
              </YStack>
            ) : upcomingEvents.length === 0 ? (
              <Card padding="$4" marginTop="$2">
                <YStack alignItems="center" gap="$2">
                  <Text color="$gray11">No upcoming events today</Text>
                  <Text color="$gray10" fontSize="$2">
                    Use the input above to add something
                  </Text>
                </YStack>
              </Card>
            ) : (
              <YStack gap="$3">
                {upcomingEvents.map((event) => (
                  <EventCard key={event.id} event={event} />
                ))}
              </YStack>
            )}

            {pastEvents.length > 0 && (
              <YStack gap="$2" marginTop="$4">
                <Text color="$gray10" fontSize="$3">
                  Earlier Today
                </Text>
                {pastEvents.map((event) => (
                  <EventCard key={event.id} event={event} isPast />
                ))}
              </YStack>
            )}
          </YStack>
        </ScrollView>
      </YStack>
    </SafeAreaView>
  );
}
