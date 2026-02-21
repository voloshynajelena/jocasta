import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { useState, useCallback } from 'react';
import { useRouter } from 'expo-router';

import { useAuthStore } from '../../src/store/authStore';
import { DEMO_TASKS, DEMO_NOTIFICATIONS, Task, NotificationJob } from '../../src/data/demoData';

export default function InboxScreen() {
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const isDemoMode = user?.id === 'demo-user';
  const [refreshing, setRefreshing] = useState(false);
  const [completedTasks, setCompletedTasks] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'tasks' | 'notifications'>('tasks');

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    setRefreshing(false);
  }, []);

  const handleMarkDone = (taskId: string) => {
    setCompletedTasks((prev) => [...prev, taskId]);
  };

  const handleScheduleTask = (task: Task) => {
    router.push({
      pathname: '/proposal/[id]',
      params: { id: 'new', input: task.title, taskId: task.id }
    });
  };

  // Use mock data in demo mode
  const allTasks = isDemoMode ? DEMO_TASKS : [];
  const tasks = allTasks.filter(t => !completedTasks.includes(t.id) && t.status !== 'done');
  const notifications = isDemoMode ? DEMO_NOTIFICATIONS : [];

  // Separate pending and scheduled tasks
  const pendingTasks = tasks.filter(t => t.status === 'pending');
  const scheduledTasks = tasks.filter(t => t.status === 'scheduled');

  // Failed notifications
  const failedNotifications = notifications.filter(n => n.status === 'failed');

  if (!isAuthenticated) {
    return (
      <View style={styles.container}>
        <View style={styles.authPrompt}>
          <Text style={styles.authTitle}>Inbox</Text>
          <Text style={styles.authSubtitle}>Sign in to manage your tasks</Text>
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

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Inbox</Text>
        <Text style={styles.headerSubtitle}>
          {pendingTasks.length} tasks need scheduling
        </Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'tasks' && styles.tabActive]}
          onPress={() => setActiveTab('tasks')}
        >
          <Text style={[styles.tabText, activeTab === 'tasks' && styles.tabTextActive]}>
            Tasks ({tasks.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'notifications' && styles.tabActive]}
          onPress={() => setActiveTab('notifications')}
        >
          <Text style={[styles.tabText, activeTab === 'notifications' && styles.tabTextActive]}>
            Notifications
            {failedNotifications.length > 0 && (
              <Text style={styles.tabBadge}> {failedNotifications.length}</Text>
            )}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b82f6" />
        }
        showsVerticalScrollIndicator={false}
      >
        {activeTab === 'tasks' ? (
          <>
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
              <View style={[styles.statBadge, { backgroundColor: '#ef444420' }]}>
                <Text style={[styles.statNumber, { color: '#ef4444' }]}>
                  {tasks.filter(t => t.priority === 3).length}
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
                    <Text style={styles.sectionTitle}>NEEDS SCHEDULING</Text>
                    {pendingTasks.map(task => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        onMarkDone={handleMarkDone}
                        onSchedule={handleScheduleTask}
                      />
                    ))}
                  </>
                )}

                {/* Scheduled Tasks */}
                {scheduledTasks.length > 0 && (
                  <>
                    <Text style={[styles.sectionTitle, { marginTop: 24 }]}>SCHEDULED</Text>
                    {scheduledTasks.map(task => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        onMarkDone={handleMarkDone}
                        onSchedule={handleScheduleTask}
                        isScheduled
                      />
                    ))}
                  </>
                )}
              </>
            )}
          </>
        ) : (
          <>
            {/* Notifications Tab */}
            {failedNotifications.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>FAILED NOTIFICATIONS</Text>
                {failedNotifications.map(notif => (
                  <NotificationCard key={notif.id} notification={notif} />
                ))}
              </>
            )}

            <Text style={[styles.sectionTitle, { marginTop: failedNotifications.length > 0 ? 24 : 0 }]}>
              RECENT NOTIFICATIONS
            </Text>
            {notifications.filter(n => n.status !== 'failed').map(notif => (
              <NotificationCard key={notif.id} notification={notif} />
            ))}
          </>
        )}

        <View style={styles.bottomPadding} />
      </ScrollView>
    </View>
  );
}

// Task Card Component
function TaskCard({
  task,
  onMarkDone,
  onSchedule,
  isScheduled = false,
}: {
  task: Task;
  onMarkDone: (id: string) => void;
  onSchedule: (task: Task) => void;
  isScheduled?: boolean;
}) {
  return (
    <View style={[styles.taskCard, isScheduled && styles.scheduledCard]}>
      <TouchableOpacity
        style={styles.checkbox}
        onPress={() => onMarkDone(task.id)}
      >
        <Text style={styles.checkboxIcon}>○</Text>
      </TouchableOpacity>

      <View style={styles.taskContent}>
        <Text style={styles.taskTitle}>{task.title}</Text>
        {task.notes && (
          <Text style={styles.taskNotes} numberOfLines={1}>{task.notes}</Text>
        )}
        <View style={styles.taskMeta}>
          <Text style={styles.taskDuration}>⏱ {task.durationMinutes} min</Text>
          {task.deadlineAt && (
            <Text style={[styles.taskDeadline, isOverdue(task.deadlineAt) && styles.overdue]}>
              📅 {formatDeadline(task.deadlineAt)}
            </Text>
          )}
          {task.locationText && (
            <Text style={styles.taskLocation}>📍 {task.locationText}</Text>
          )}
        </View>
      </View>

      <View style={styles.taskActions}>
        <View style={[styles.priorityBadge, getPriorityStyle(task.priority)]}>
          <Text style={[styles.priorityText, getPriorityTextStyle(task.priority)]}>
            {getPriorityLabel(task.priority)}
          </Text>
        </View>
        {!isScheduled && (
          <TouchableOpacity
            style={styles.scheduleButton}
            onPress={() => onSchedule(task)}
          >
            <Text style={styles.scheduleButtonText}>Schedule</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// Notification Card Component
function NotificationCard({ notification }: { notification: NotificationJob }) {
  const getStatusColor = () => {
    switch (notification.status) {
      case 'sent': return '#10b981';
      case 'failed': return '#ef4444';
      case 'pending': return '#f59e0b';
      default: return '#6b7280';
    }
  };

  const getTypeLabel = () => {
    switch (notification.type) {
      case 'leave_by': return 'Leave By Reminder';
      case 'reminder_60': return '60 min Reminder';
      case 'reminder_30': return '30 min Reminder';
      case 'reminder_10': return '10 min Reminder';
      default: return 'Notification';
    }
  };

  return (
    <View style={[styles.notificationCard, notification.status === 'failed' && styles.failedCard]}>
      <View style={styles.notificationIcon}>
        <Text style={styles.notificationIconText}>
          {notification.channel === 'telegram' ? '📱' : '🔔'}
        </Text>
      </View>
      <View style={styles.notificationContent}>
        <Text style={styles.notificationTitle}>{getTypeLabel()}</Text>
        <Text style={styles.notificationTime}>
          {new Date(notification.scheduledFor).toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
          })}
        </Text>
        {notification.lastError && (
          <Text style={styles.errorText}>{notification.lastError}</Text>
        )}
      </View>
      <View style={[styles.statusBadge, { backgroundColor: getStatusColor() + '20' }]}>
        <Text style={[styles.statusText, { color: getStatusColor() }]}>
          {notification.status}
        </Text>
      </View>
      {notification.status === 'failed' && (
        <TouchableOpacity style={styles.retryButton}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// Helper Functions
function formatDeadline(dateStr: string): string {
  const date = new Date(dateStr);
  const today = new Date();
  const diffDays = Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return 'Overdue';
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays < 7) return date.toLocaleDateString('en-US', { weekday: 'short' });
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function isOverdue(dateStr: string): boolean {
  return new Date(dateStr) < new Date();
}

function getPriorityStyle(priority: number) {
  if (priority === 3) return { backgroundColor: '#ef444420' };
  if (priority === 2) return { backgroundColor: '#f59e0b20' };
  return { backgroundColor: '#6b728020' };
}

function getPriorityTextStyle(priority: number) {
  if (priority === 3) return { color: '#ef4444' };
  if (priority === 2) return { color: '#f59e0b' };
  return { color: '#6b7280' };
}

function getPriorityLabel(priority: number): string {
  if (priority === 3) return 'High';
  if (priority === 2) return 'Medium';
  return 'Low';
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
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#888',
    marginTop: 4,
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 16,
    gap: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    backgroundColor: '#2d2d44',
    borderRadius: 10,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: '#3b82f6',
  },
  tabText: {
    color: '#888',
    fontSize: 14,
    fontWeight: '500',
  },
  tabTextActive: {
    color: '#fff',
  },
  tabBadge: {
    color: '#ef4444',
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  statBadge: {
    flex: 1,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  statLabel: {
    fontSize: 11,
    color: '#888',
    marginTop: 4,
    textTransform: 'uppercase',
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#888',
    letterSpacing: 1,
    marginBottom: 12,
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
    padding: 14,
    marginBottom: 10,
    alignItems: 'flex-start',
  },
  scheduledCard: {
    borderLeftWidth: 3,
    borderLeftColor: '#10b981',
  },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: '#4b5563',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  checkboxIcon: {
    color: '#4b5563',
    fontSize: 16,
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
    gap: 10,
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
  taskLocation: {
    color: '#888',
    fontSize: 12,
  },
  overdue: {
    color: '#ef4444',
  },
  taskActions: {
    alignItems: 'flex-end',
    marginLeft: 8,
    gap: 8,
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  priorityText: {
    fontSize: 11,
    fontWeight: '600',
  },
  scheduleButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  scheduleButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  notificationCard: {
    flexDirection: 'row',
    backgroundColor: '#2d2d44',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    alignItems: 'center',
  },
  failedCard: {
    borderLeftWidth: 3,
    borderLeftColor: '#ef4444',
  },
  notificationIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#3d3d5c',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  notificationIconText: {
    fontSize: 18,
  },
  notificationContent: {
    flex: 1,
  },
  notificationTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  notificationTime: {
    color: '#888',
    fontSize: 12,
    marginTop: 2,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 11,
    marginTop: 4,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginLeft: 8,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  retryButton: {
    backgroundColor: '#ef444420',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    marginLeft: 8,
  },
  retryButtonText: {
    color: '#ef4444',
    fontSize: 12,
    fontWeight: '600',
  },
  bottomPadding: {
    height: 100,
  },
});
