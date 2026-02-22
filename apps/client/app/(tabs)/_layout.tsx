import { Tabs } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import { useThemeStore } from '../../src/store/themeStore';

// Monochrome Today Icon with current date
function TodayIcon({ color }: { color: string }) {
  return (
    <View style={styles.iconContainer}>
      <View style={[styles.calendarIcon, { borderColor: color }]}>
        <View style={[styles.calendarTop, { backgroundColor: color }]} />
        <View style={styles.calendarDots}>
          <View style={[styles.dot, { backgroundColor: color }]} />
          <View style={[styles.dot, { backgroundColor: color }]} />
          <View style={[styles.dot, { backgroundColor: color }]} />
          <View style={[styles.dot, { backgroundColor: color }]} />
        </View>
      </View>
    </View>
  );
}

// Monochrome Week Icon (calendar with grid)
function WeekIcon({ color }: { color: string }) {
  return (
    <View style={styles.iconContainer}>
      <View style={[styles.weekIcon, { borderColor: color }]}>
        <View style={[styles.weekTop, { backgroundColor: color }]} />
        <View style={styles.weekGrid}>
          {[...Array(6)].map((_, i) => (
            <View key={i} style={[styles.weekDot, { backgroundColor: color }]} />
          ))}
        </View>
      </View>
    </View>
  );
}

// Monochrome AI/Sparkle Icon
function AIIcon({ color }: { color: string }) {
  return (
    <View style={styles.iconContainer}>
      <View style={[styles.starCenter, { backgroundColor: color }]} />
      <View style={[styles.starRay, styles.rayTop, { backgroundColor: color }]} />
      <View style={[styles.starRay, styles.rayBottom, { backgroundColor: color }]} />
      <View style={[styles.starRay, styles.rayLeft, { backgroundColor: color }]} />
      <View style={[styles.starRay, styles.rayRight, { backgroundColor: color }]} />
    </View>
  );
}

// Monochrome Inbox Icon
function InboxIcon({ color }: { color: string }) {
  return (
    <View style={styles.iconContainer}>
      <View style={[styles.inboxIcon, { borderColor: color }]}>
        <View style={[styles.inboxArrow, { borderColor: color }]} />
        <View style={[styles.inboxLine, { backgroundColor: color }]} />
      </View>
    </View>
  );
}

// Monochrome Settings/Gear Icon
function SettingsIcon({ color }: { color: string }) {
  return (
    <View style={styles.iconContainer}>
      <View style={[styles.gearOuter, { borderColor: color }]} />
      <View style={[styles.gearInner, { backgroundColor: color }]} />
    </View>
  );
}

export default function TabsLayout() {
  const { colors } = useThemeStore();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopColor: colors.border,
        },
        headerStyle: {
          backgroundColor: colors.headerBg,
        },
        headerTintColor: colors.text,
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Today',
          tabBarIcon: ({ color }) => <TodayIcon color={color} />,
        }}
      />
      <Tabs.Screen
        name="week"
        options={{
          title: 'Week',
          tabBarIcon: ({ color }) => <WeekIcon color={color} />,
        }}
      />
      <Tabs.Screen
        name="planner"
        options={{
          title: 'AI',
          tabBarIcon: ({ color }) => <AIIcon color={color} />,
        }}
      />
      <Tabs.Screen
        name="inbox"
        options={{
          title: 'Inbox',
          tabBarIcon: ({ color }) => <InboxIcon color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color }) => <SettingsIcon color={color} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconContainer: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Today icon
  calendarIcon: {
    width: 20,
    height: 20,
    borderWidth: 1.5,
    borderRadius: 3,
    overflow: 'hidden',
  },
  calendarTop: {
    height: 5,
    width: '100%',
  },
  calendarDots: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 2,
    gap: 2,
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 1,
  },
  // Week icon
  weekIcon: {
    width: 20,
    height: 20,
    borderWidth: 1.5,
    borderRadius: 3,
    overflow: 'hidden',
  },
  weekTop: {
    height: 4,
    width: '100%',
  },
  weekGrid: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 1,
    gap: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  weekDot: {
    width: 4,
    height: 4,
    borderRadius: 1,
  },
  // AI sparkle icon
  starCenter: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  starRay: {
    position: 'absolute',
    width: 3,
    height: 3,
    borderRadius: 1.5,
  },
  rayTop: { top: 2 },
  rayBottom: { bottom: 2 },
  rayLeft: { left: 2 },
  rayRight: { right: 2 },
  // Inbox icon
  inboxIcon: {
    width: 20,
    height: 16,
    borderWidth: 1.5,
    borderRadius: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inboxArrow: {
    width: 6,
    height: 6,
    borderLeftWidth: 1.5,
    borderBottomWidth: 1.5,
    transform: [{ rotate: '-45deg' }],
    marginTop: -2,
  },
  inboxLine: {
    width: 8,
    height: 1.5,
    marginTop: 1,
  },
  // Settings gear icon
  gearOuter: {
    width: 18,
    height: 18,
    borderWidth: 2,
    borderRadius: 9,
  },
  gearInner: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});
