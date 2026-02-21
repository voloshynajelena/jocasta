import { useState } from 'react';
import { YStack, XStack, Text, Card, ScrollView, Button, Spinner } from 'tamagui';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RefreshControl } from 'react-native';
import { CheckCircle, XCircle, Clock } from '@tamagui/lucide-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';

import { api } from '@/services/api';
import { useAuthStore } from '@/store/authStore';

export default function InboxScreen() {
  const { isAuthenticated } = useAuthStore();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['tasks', 'open'],
    queryFn: () => api.getTasks({ status: ['open'] }),
    enabled: isAuthenticated,
  });

  const markDoneMutation = useMutation({
    mutationFn: (taskId: string) => api.markTaskDone(taskId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
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
          <Text color="$gray11">Please sign in to view your inbox</Text>
        </YStack>
      </SafeAreaView>
    );
  }

  const tasks = data?.tasks || [];

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['left', 'right']}>
      <ScrollView
        flex={1}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <YStack padding="$4" gap="$4">
          <Text fontSize="$8" fontWeight="bold">
            Inbox
          </Text>
          <Text color="$gray11">
            Tasks waiting to be scheduled
          </Text>

          {isLoading ? (
            <YStack height={200} justifyContent="center" alignItems="center">
              <Spinner size="large" />
            </YStack>
          ) : tasks.length === 0 ? (
            <Card padding="$6" marginTop="$4">
              <YStack alignItems="center" gap="$2">
                <CheckCircle size={48} color="$green10" />
                <Text fontSize="$5" fontWeight="bold" marginTop="$2">
                  All caught up!
                </Text>
                <Text color="$gray11" textAlign="center">
                  No pending tasks. Add new tasks using the quick input on the Today tab.
                </Text>
              </YStack>
            </Card>
          ) : (
            <YStack gap="$3">
              {tasks.map((task) => (
                <Card key={task.id} padding="$4" pressStyle={{ scale: 0.98 }}>
                  <YStack gap="$2">
                    <XStack justifyContent="space-between" alignItems="flex-start">
                      <YStack flex={1}>
                        <Text fontSize="$5" fontWeight="bold">
                          {task.title}
                        </Text>
                        <XStack gap="$2" marginTop="$1" alignItems="center">
                          <Clock size={14} color="$gray10" />
                          <Text color="$gray10" fontSize="$2">
                            {task.durationMinutes} min
                          </Text>
                          {task.deadlineAt && (
                            <>
                              <Text color="$gray10">•</Text>
                              <Text color="$orange10" fontSize="$2">
                                Due {new Date(task.deadlineAt).toLocaleDateString()}
                              </Text>
                            </>
                          )}
                        </XStack>
                      </YStack>
                      <XStack gap="$2">
                        <Text
                          fontSize="$2"
                          backgroundColor={
                            task.priority === 1
                              ? '$red5'
                              : task.priority === 2
                                ? '$yellow5'
                                : '$gray5'
                          }
                          paddingHorizontal="$2"
                          paddingVertical="$1"
                          borderRadius="$2"
                          color={
                            task.priority === 1
                              ? '$red10'
                              : task.priority === 2
                                ? '$yellow10'
                                : '$gray10'
                          }
                        >
                          P{task.priority}
                        </Text>
                      </XStack>
                    </XStack>

                    <XStack gap="$2" marginTop="$2">
                      <Button
                        size="$3"
                        flex={1}
                        theme="blue"
                        onPress={() => {
                          // TODO: Navigate to scheduling flow
                        }}
                      >
                        Schedule
                      </Button>
                      <Button
                        size="$3"
                        flex={1}
                        theme="green"
                        icon={CheckCircle}
                        onPress={() => markDoneMutation.mutate(task.id)}
                        disabled={markDoneMutation.isPending}
                      >
                        Done
                      </Button>
                    </XStack>
                  </YStack>
                </Card>
              ))}
            </YStack>
          )}
        </YStack>
      </ScrollView>
    </SafeAreaView>
  );
}
