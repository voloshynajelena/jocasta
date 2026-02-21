import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { api } from '../../src/services/api';
import { useAuthStore } from '../../src/store/authStore';
import { DEMO_TASKS } from '../../src/data/mockData';

export default function InboxScreen() {
  const queryClient = useQueryClient();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const isDemoMode = user?.id === 'demo-user';
  const [refreshing, setRefreshing] = useState(false);
  const [completedTasks, setCompletedTasks] = useState<string[]>([]);

  const { data: tasksData, refetch } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => api.getTasks({ status: ['pending', 'scheduled'] }),
    enabled: isAuthenticated && !isDemoMode,
  });

  const markDoneMutation = useMutation({
    mutationFn: (taskId: string) => api.markTaskDone(taskId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    if (!isDemoMode) {
      await refetch();
    }
    setRefreshing(false);
  }, [refetch, isDemoMode]);

  const handleMarkDone = (taskId: string) => {
    if (isDemoMode) {
      setCompletedTasks((prev) => [...prev, taskId]);
    } else {
      markDoneMutation.mutate(taskId);
    }
  };

  // Use mock data in demo mode
  const allTasks = isDemoMode ? DEMO_TASKS : (tasksData?.tasks || []);
  const tasks = allTasks.filter(
    (t: any) => !completedTasks.includes(t.id) && t.status !== 'done'
  );

  // Separate pending and scheduled tasks
  const pendingTasks = tasks.filter((t: any) => t.status === 'pending');
  const scheduledTasks = tasks.filter((t: any) => t.status === 'scheduled');

  if (!isAuthenticated) {
    return (
      <View style={styles.container}>
        <Text style={styles.authText}>Sign in to view your tasks</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b82f6" />
      }
    >
      <Text style={styles.header}>Inbox</Text>
      <Text style={styles.subtitle}>
        {pendingTasks.length} tasks waiting to be scheduled
      </Text>

      {/* Quick Stats */}
      <View style={styles.statsRow}>
        <View style={[styles.statBadge, { backgroundColor: '#3b82f620' }]}>
          <Text style={[styles.statNumber, { color: '#3b82f6' }]}>{pendingTasks.length}</Text>
          <Text style={styles.statLabel}>Pending</Text>
        </View>
        <View style={[styles.statBadge, { backgroundColor: '#10b98120' }]}>
          <Text style={[styles.statNumber, { color: '#10b981' }]}>{scheduledTasks.length}</Text>
          <Text style={styles.statLabel}>Scheduled</Text>
        </View>
        <View style={[styles.statBadge, { backgroundColor: '#f59e0b20' }]}>
          <Text style={[styles.statNumber, { color: '#f59e0b' }]}>
            {tasks.filter((t: any) => t.priority >= 8).length}
          </Text>
          <Text style={styles.statLabel}>Urgent</Text>
        </View>
      </View>

      {tasks.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>✅</Text>
          <Text style={styles.emptyTitle}>All caught up!</Text>
          <Text style={styles.emptySubtitle}>No pending tasks</Text>
        </View>
      ) : (
        <>
          {/* Pending Tasks */}
          {pendingTasks.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Needs Scheduling</Text>
              {pendingTasks.map((task: any) => (
                <View key={task.id} style={styles.taskCard}>
                  <TouchableOpacity
                    style={styles.checkbox}
                    onPress={() => handleMarkDone(task.id)}
                  >
                    <Text style={styles.checkboxText}>○</Text>
                  </TouchableOpacity>
                  <View style={styles.taskContent}>
                    <Text style={styles.taskTitle}>{task.title}</Text>
                    {task.notes && (
                      <Text style={styles.taskNotes} numberOfLines={1}>
                        {task.notes}
                      </Text>
                    )}
                    <View style={styles.taskMeta}>
                      <Text style={styles.taskDuration}>⏱ {task.durationMinutes} min</Text>
                      {task.deadlineAt && (
                        <Text style={styles.taskDeadline}>
                          📅 Due {formatDeadline(task.deadlineAt)}
                        </Text>
                      )}
                    </View>
                  </View>
                  <View style={[styles.priorityBadge, getPriorityStyle(task.priority)]}>
                    <Text style={styles.priorityText}>{getPriorityLabel(task.priority)}</Text>
                  </View>
                </View>
              ))}
            </>
          )}

          {/* Scheduled Tasks */}
          {scheduledTasks.length > 0 && (
            <>
              <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Scheduled</Text>
              {scheduledTasks.map((task: any) => (
                <View key={task.id} style={[styles.taskCard, styles.scheduledCard]}>
                  <TouchableOpacity
                    style={styles.checkbox}
                    onPress={() => handleMarkDone(task.id)}
                  >
                    <Text style={styles.checkboxText}>○</Text>
                  </TouchableOpacity>
                  <View style={styles.taskContent}>
                    <Text style={styles.taskTitle}>{task.title}</Text>
                    <View style={styles.taskMeta}>
                      <Text style={styles.taskDuration}>⏱ {task.durationMinutes} min</Text>
                      {task.scheduledFor && (
                        <Text style={styles.scheduledFor}>
                          🗓 {new Date(task.scheduledFor).toLocaleDateString('en-US', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </Text>
                      )}
                    </View>
                  </View>
                  <View style={[styles.priorityBadge, { backgroundColor: '#10b98120' }]}>
                    <Text style={[styles.priorityText, { color: '#10b981' }]}>Scheduled</Text>
                  </View>
                </View>
              ))}
            </>
          )}
        </>
      )}

      <View style={styles.bottomPadding} />
    </ScrollView>
  );
}

function formatDeadline(dateStr: string): string {
  const date = new Date(dateStr);
  const today = new Date();
  const diffDays = Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays < 7) return date.toLocaleDateString('en-US', { weekday: 'short' });
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getPriorityStyle(priority: number) {
  if (priority >= 8) return { backgroundColor: '#ef444420' };
  if (priority >= 5) return { backgroundColor: '#f59e0b20' };
  return { backgroundColor: '#6b728020' };
}

function getPriorityLabel(priority: number): string {
  if (priority >= 8) return 'High';
  if (priority >= 5) return 'Medium';
  return 'Low';
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
  subtitle: {
    fontSize: 14,
    color: '#888',
    marginTop: 4,
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  statBadge: {
    flex: 1,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  statLabel: {
    fontSize: 12,
    color: '#888',
    marginTop: 4,
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
  taskCard: {
    flexDirection: 'row',
    backgroundColor: '#2d2d44',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    alignItems: 'flex-start',
  },
  scheduledCard: {
    borderLeftWidth: 3,
    borderLeftColor: '#10b981',
  },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#4b5563',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  checkboxText: {
    color: '#4b5563',
    fontSize: 18,
  },
  taskContent: {
    flex: 1,
  },
  taskTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '500',
  },
  taskNotes: {
    color: '#666',
    fontSize: 13,
    marginTop: 4,
  },
  taskMeta: {
    flexDirection: 'row',
    marginTop: 8,
    gap: 12,
    flexWrap: 'wrap',
  },
  taskDuration: {
    color: '#888',
    fontSize: 12,
  },
  taskDeadline: {
    color: '#888',
    fontSize: 12,
  },
  scheduledFor: {
    color: '#10b981',
    fontSize: 12,
  },
  priorityBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginLeft: 8,
  },
  priorityText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#ef4444',
  },
  bottomPadding: {
    height: 100,
  },
});
