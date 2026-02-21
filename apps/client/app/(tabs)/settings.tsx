import { YStack, XStack, Text, Card, ScrollView, Button, Switch, Separator } from 'tamagui';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  User,
  Calendar,
  Bell,
  MessageCircle,
  Car,
  LogOut,
  ChevronRight,
} from '@tamagui/lucide-icons';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';

import { api } from '@/services/api';
import { useAuthStore } from '@/store/authStore';

export default function SettingsScreen() {
  const { isAuthenticated, user, logout } = useAuthStore();

  const { data: profile } = useQuery({
    queryKey: ['profile'],
    queryFn: () => api.getProfile(),
    enabled: isAuthenticated,
  });

  const { data: syncStatus } = useQuery({
    queryKey: ['google', 'status'],
    queryFn: () => api.getGoogleSyncStatus(),
    enabled: isAuthenticated,
  });

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={{ flex: 1 }}>
        <YStack flex={1} justifyContent="center" alignItems="center" padding="$4">
          <Text color="$gray11">Please sign in to view settings</Text>
          <Button
            marginTop="$4"
            theme="blue"
            onPress={() => router.push('/(auth)/login')}
          >
            Sign In
          </Button>
        </YStack>
      </SafeAreaView>
    );
  }

  const handleLogout = async () => {
    await logout();
    router.replace('/(auth)/login');
  };

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['left', 'right']}>
      <ScrollView flex={1}>
        <YStack padding="$4" gap="$4">
          <Text fontSize="$8" fontWeight="bold">
            Settings
          </Text>

          {/* Profile Section */}
          <Card padding="$4">
            <XStack alignItems="center" gap="$3">
              <YStack
                width={60}
                height={60}
                borderRadius={30}
                backgroundColor="$blue5"
                justifyContent="center"
                alignItems="center"
              >
                <User size={30} color="$blue10" />
              </YStack>
              <YStack flex={1}>
                <Text fontSize="$5" fontWeight="bold">
                  {profile?.name || 'User'}
                </Text>
                <Text color="$gray11" fontSize="$3">
                  {profile?.email}
                </Text>
              </YStack>
            </XStack>
          </Card>

          {/* Integrations */}
          <YStack gap="$2">
            <Text fontSize="$4" fontWeight="bold" color="$gray11">
              Integrations
            </Text>

            <Card>
              <YStack>
                <XStack padding="$4" justifyContent="space-between" alignItems="center">
                  <XStack gap="$3" alignItems="center">
                    <Calendar size={24} color="$blue10" />
                    <YStack>
                      <Text fontWeight="bold">Google Calendar</Text>
                      <Text color="$gray11" fontSize="$2">
                        {syncStatus?.isConnected
                          ? `Last sync: ${syncStatus.lastSyncAt ? new Date(syncStatus.lastSyncAt).toLocaleString() : 'Never'}`
                          : 'Not connected'}
                      </Text>
                    </YStack>
                  </XStack>
                  <XStack alignItems="center" gap="$2">
                    <YStack
                      width={8}
                      height={8}
                      borderRadius={4}
                      backgroundColor={syncStatus?.isConnected ? '$green10' : '$gray10'}
                    />
                    <ChevronRight size={20} color="$gray10" />
                  </XStack>
                </XStack>

                <Separator />

                <XStack padding="$4" justifyContent="space-between" alignItems="center">
                  <XStack gap="$3" alignItems="center">
                    <MessageCircle size={24} color="$blue10" />
                    <YStack>
                      <Text fontWeight="bold">Telegram</Text>
                      <Text color="$gray11" fontSize="$2">
                        {profile?.hasTelegram ? 'Connected' : 'Not connected'}
                      </Text>
                    </YStack>
                  </XStack>
                  <XStack alignItems="center" gap="$2">
                    <YStack
                      width={8}
                      height={8}
                      borderRadius={4}
                      backgroundColor={profile?.hasTelegram ? '$green10' : '$gray10'}
                    />
                    <ChevronRight size={20} color="$gray10" />
                  </XStack>
                </XStack>
              </YStack>
            </Card>
          </YStack>

          {/* Preferences */}
          <YStack gap="$2">
            <Text fontSize="$4" fontWeight="bold" color="$gray11">
              Preferences
            </Text>

            <Card>
              <YStack>
                <XStack padding="$4" justifyContent="space-between" alignItems="center">
                  <XStack gap="$3" alignItems="center">
                    <Car size={24} color="$blue10" />
                    <YStack>
                      <Text fontWeight="bold">Default Transport</Text>
                      <Text color="$gray11" fontSize="$2">
                        {profile?.defaultTransportMode || 'Sedan'}
                      </Text>
                    </YStack>
                  </XStack>
                  <ChevronRight size={20} color="$gray10" />
                </XStack>

                <Separator />

                <XStack padding="$4" justifyContent="space-between" alignItems="center">
                  <XStack gap="$3" alignItems="center">
                    <Bell size={24} color="$blue10" />
                    <Text fontWeight="bold">Notifications</Text>
                  </XStack>
                  <ChevronRight size={20} color="$gray10" />
                </XStack>
              </YStack>
            </Card>
          </YStack>

          {/* About */}
          <YStack gap="$2">
            <Text fontSize="$4" fontWeight="bold" color="$gray11">
              About
            </Text>

            <Card padding="$4">
              <YStack gap="$2">
                <XStack justifyContent="space-between">
                  <Text color="$gray11">Version</Text>
                  <Text>1.0.0</Text>
                </XStack>
                <XStack justifyContent="space-between">
                  <Text color="$gray11">Timezone</Text>
                  <Text>{profile?.timezone || 'America/Edmonton'}</Text>
                </XStack>
              </YStack>
            </Card>
          </YStack>

          {/* Logout */}
          <Button
            size="$4"
            theme="red"
            icon={LogOut}
            onPress={handleLogout}
            marginTop="$4"
          >
            Sign Out
          </Button>
        </YStack>
      </ScrollView>
    </SafeAreaView>
  );
}
