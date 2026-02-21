import { Tabs } from 'expo-router';
import { Text } from 'react-native';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#3b82f6',
        tabBarInactiveTintColor: '#6b7280',
        tabBarStyle: {
          backgroundColor: '#1a1a2e',
          borderTopColor: '#2d2d44',
        },
        headerStyle: {
          backgroundColor: '#1a1a2e',
        },
        headerTintColor: '#fff',
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Today',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>📅</Text>,
        }}
      />
      <Tabs.Screen
        name="week"
        options={{
          title: 'Week',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>📆</Text>,
        }}
      />
      <Tabs.Screen
        name="planner"
        options={{
          title: 'AI',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>✨</Text>,
        }}
      />
      <Tabs.Screen
        name="inbox"
        options={{
          title: 'Inbox',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>📥</Text>,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>⚙️</Text>,
        }}
      />
    </Tabs>
  );
}
