import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Alert } from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'expo-router';

import { useAuthStore } from '../../src/store/authStore';
import { useThemeStore } from '../../src/store/themeStore';

interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  role: string;
  isDemo: boolean;
  timezone: string;
  defaultTransportMode: string;
  hasGoogleCalendar: boolean;
  hasAppleId: boolean;
  eventsCount: number;
  tasksCount: number;
  createdAt: string;
}

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';

export default function AdminScreen() {
  const router = useRouter();
  const { colors } = useThemeStore();
  const user = useAuthStore((s) => s.user);
  const isAdmin = useAuthStore((s) => s.isAdmin);

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Redirect if not admin
  useEffect(() => {
    if (!isAdmin()) {
      router.replace('/(tabs)');
    }
  }, [user]);

  const fetchUsers = async () => {
    try {
      const response = await fetch(`${API_URL}/api/v1/admin/users`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }

      const data = await response.json();
      setUsers(data);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchUsers();
  }, []);

  const toggleUserRole = async (userId: string, currentRole: string) => {
    const newRole = currentRole === 'admin' ? 'user' : 'admin';

    try {
      const response = await fetch(`${API_URL}/api/v1/admin/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ role: newRole }),
      });

      if (!response.ok) {
        throw new Error('Failed to update user');
      }

      // Refresh users list
      fetchUsers();
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  };

  const deleteUser = async (userId: string, email: string) => {
    Alert.alert(
      'Delete User',
      `Are you sure you want to delete ${email}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await fetch(`${API_URL}/api/v1/admin/users/${userId}`, {
                method: 'DELETE',
                credentials: 'include',
              });

              if (!response.ok) {
                throw new Error('Failed to delete user');
              }

              fetchUsers();
            } catch (err: any) {
              Alert.alert('Error', err.message);
            }
          },
        },
      ],
    );
  };

  if (!isAdmin()) {
    return null;
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.headerBg }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Admin Panel</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={[styles.statCard, { backgroundColor: colors.card }]}>
          <Text style={[styles.statNumber, { color: colors.text }]}>{users.length}</Text>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>Total Users</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: colors.card }]}>
          <Text style={[styles.statNumber, { color: colors.text }]}>
            {users.filter(u => u.role === 'admin').length}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>Admins</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: colors.card }]}>
          <Text style={[styles.statNumber, { color: colors.text }]}>
            {users.filter(u => u.isDemo).length}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>Demo</Text>
        </View>
      </View>

      {error && (
        <View style={[styles.errorBox, { backgroundColor: colors.error }]}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Users List */}
      <ScrollView
        style={styles.usersList}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>ALL USERS</Text>

        {loading ? (
          <View style={styles.loadingContainer}>
            <Text style={[styles.loadingText, { color: colors.textMuted }]}>Loading users...</Text>
          </View>
        ) : (
          users.map((u) => (
            <View key={u.id} style={[styles.userCard, { backgroundColor: colors.card }]}>
              <View style={styles.userInfo}>
                <View style={styles.userHeader}>
                  <Text style={[styles.userName, { color: colors.text }]}>
                    {u.name || 'No name'}
                  </Text>
                  <View style={styles.badges}>
                    {u.role === 'admin' && (
                      <View style={[styles.badge, { backgroundColor: colors.primary }]}>
                        <Text style={styles.badgeText}>Admin</Text>
                      </View>
                    )}
                    {u.isDemo && (
                      <View style={[styles.badge, { backgroundColor: colors.warning }]}>
                        <Text style={styles.badgeText}>Demo</Text>
                      </View>
                    )}
                  </View>
                </View>
                <Text style={[styles.userEmail, { color: colors.textMuted }]}>{u.email}</Text>

                <View style={styles.userMeta}>
                  <Text style={[styles.metaText, { color: colors.textMuted }]}>
                    {u.eventsCount} events • {u.tasksCount} tasks
                  </Text>
                  <View style={styles.authBadges}>
                    {u.hasGoogleCalendar && (
                      <Text style={styles.authIcon}>G</Text>
                    )}
                    {u.hasAppleId && (
                      <Text style={styles.authIcon}></Text>
                    )}
                  </View>
                </View>

                <Text style={[styles.dateText, { color: colors.textMuted }]}>
                  Joined: {new Date(u.createdAt).toLocaleDateString()}
                </Text>
              </View>

              <View style={styles.userActions}>
                {u.id !== user?.id && (
                  <>
                    <TouchableOpacity
                      style={[styles.actionButton, { backgroundColor: colors.primary + '20' }]}
                      onPress={() => toggleUserRole(u.id, u.role)}
                    >
                      <Text style={[styles.actionText, { color: colors.primary }]}>
                        {u.role === 'admin' ? 'Demote' : 'Promote'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionButton, { backgroundColor: colors.error + '20' }]}
                      onPress={() => deleteUser(u.id, u.email)}
                    >
                      <Text style={[styles.actionText, { color: colors.error }]}>Delete</Text>
                    </TouchableOpacity>
                  </>
                )}
                {u.id === user?.id && (
                  <Text style={[styles.youText, { color: colors.textMuted }]}>You</Text>
                )}
              </View>
            </View>
          ))
        )}

        <View style={styles.bottomPadding} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  backButton: {
    padding: 8,
  },
  backText: {
    color: '#fff',
    fontSize: 18,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  placeholder: {
    width: 50,
  },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
  },
  statCard: {
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
    marginTop: 4,
    textTransform: 'uppercase',
  },
  errorBox: {
    marginHorizontal: 16,
    padding: 12,
    borderRadius: 8,
  },
  errorText: {
    color: '#fff',
    textAlign: 'center',
  },
  usersList: {
    flex: 1,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: 12,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
  },
  userCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  userInfo: {
    marginBottom: 12,
  },
  userHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  badges: {
    flexDirection: 'row',
    gap: 6,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  userEmail: {
    fontSize: 14,
    marginBottom: 8,
  },
  userMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  metaText: {
    fontSize: 13,
  },
  authBadges: {
    flexDirection: 'row',
    gap: 8,
  },
  authIcon: {
    fontSize: 14,
    color: '#666',
  },
  dateText: {
    fontSize: 12,
  },
  userActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  actionText: {
    fontSize: 13,
    fontWeight: '600',
  },
  youText: {
    fontSize: 13,
    fontStyle: 'italic',
  },
  bottomPadding: {
    height: 100,
  },
});
