import { useState } from 'react';
import { YStack, XStack, Text, Card, ScrollView, Button, Spinner } from 'tamagui';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, ChevronRight } from '@tamagui/lucide-icons';
import { useQuery } from '@tanstack/react-query';

import { api } from '@/services/api';
import { useAuthStore } from '@/store/authStore';

export default function MonthScreen() {
  const { isAuthenticated } = useAuthStore();
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  const startDate = new Date(year, month, 1).toISOString().split('T')[0];
  const endDate = new Date(year, month + 1, 0).toISOString().split('T')[0];

  const { data, isLoading } = useQuery({
    queryKey: ['events', 'month', startDate],
    queryFn: () => api.getEvents({ startDate, endDate }),
    enabled: isAuthenticated,
  });

  const goToPreviousMonth = () => {
    setCurrentMonth(new Date(year, month - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentMonth(new Date(year, month + 1, 1));
  };

  const goToToday = () => {
    setCurrentMonth(new Date());
  };

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={{ flex: 1 }}>
        <YStack flex={1} justifyContent="center" alignItems="center" padding="$4">
          <Text color="$gray11">Please sign in to view your calendar</Text>
        </YStack>
      </SafeAreaView>
    );
  }

  // Generate calendar grid
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  const todayDate = today.getDate();
  const isCurrentMonth =
    today.getMonth() === month && today.getFullYear() === year;

  // Count events per day
  const eventCounts: Record<number, number> = {};
  (data?.events || []).forEach((event) => {
    const day = new Date(event.startAt).getDate();
    eventCounts[day] = (eventCounts[day] || 0) + 1;
  });

  const weeks: (number | null)[][] = [];
  let currentWeek: (number | null)[] = [];

  // Fill in empty days before the first day
  for (let i = 0; i < firstDayOfMonth; i++) {
    currentWeek.push(null);
  }

  // Fill in the days of the month
  for (let day = 1; day <= daysInMonth; day++) {
    currentWeek.push(day);
    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  }

  // Fill in remaining days
  while (currentWeek.length < 7 && currentWeek.length > 0) {
    currentWeek.push(null);
  }
  if (currentWeek.length > 0) {
    weeks.push(currentWeek);
  }

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['left', 'right']}>
      <YStack flex={1} padding="$4">
        {/* Month Navigation */}
        <XStack justifyContent="space-between" alignItems="center" marginBottom="$4">
          <Button size="$3" circular icon={ChevronLeft} onPress={goToPreviousMonth} />
          <YStack alignItems="center">
            <Text fontSize="$7" fontWeight="bold">
              {currentMonth.toLocaleDateString('en-US', {
                month: 'long',
                year: 'numeric',
              })}
            </Text>
            {!isCurrentMonth && (
              <Button size="$2" chromeless onPress={goToToday}>
                <Text color="$blue10" fontSize="$2">
                  Go to Today
                </Text>
              </Button>
            )}
          </YStack>
          <Button size="$3" circular icon={ChevronRight} onPress={goToNextMonth} />
        </XStack>

        {/* Day Headers */}
        <XStack marginBottom="$2">
          {dayNames.map((day) => (
            <YStack key={day} flex={1} alignItems="center">
              <Text color="$gray10" fontSize="$2" fontWeight="bold">
                {day}
              </Text>
            </YStack>
          ))}
        </XStack>

        {/* Calendar Grid */}
        {isLoading ? (
          <YStack flex={1} justifyContent="center" alignItems="center">
            <Spinner size="large" />
          </YStack>
        ) : (
          <YStack gap="$1">
            {weeks.map((week, weekIndex) => (
              <XStack key={weekIndex} gap="$1">
                {week.map((day, dayIndex) => {
                  const isToday = isCurrentMonth && day === todayDate;
                  const hasEvents = day && eventCounts[day];

                  return (
                    <Card
                      key={dayIndex}
                      flex={1}
                      aspectRatio={1}
                      justifyContent="center"
                      alignItems="center"
                      backgroundColor={
                        isToday
                          ? '$blue5'
                          : day
                            ? '$background'
                            : 'transparent'
                      }
                      borderWidth={isToday ? 2 : 0}
                      borderColor="$blue10"
                    >
                      {day && (
                        <YStack alignItems="center">
                          <Text
                            fontSize="$4"
                            fontWeight={isToday ? 'bold' : 'normal'}
                            color={isToday ? '$blue10' : '$color'}
                          >
                            {day}
                          </Text>
                          {hasEvents && (
                            <XStack gap="$0.5" marginTop="$0.5">
                              {Array.from({
                                length: Math.min(eventCounts[day], 3),
                              }).map((_, i) => (
                                <YStack
                                  key={i}
                                  width={4}
                                  height={4}
                                  borderRadius={2}
                                  backgroundColor="$blue10"
                                />
                              ))}
                            </XStack>
                          )}
                        </YStack>
                      )}
                    </Card>
                  );
                })}
              </XStack>
            ))}
          </YStack>
        )}
      </YStack>
    </SafeAreaView>
  );
}
