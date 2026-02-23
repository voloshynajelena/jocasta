import { Tabs } from 'expo-router';
import { View, StyleSheet, Text } from 'react-native';
import { useThemeStore } from '../../src/store/themeStore';

// Monochrome Today Icon - square with folded corner showing today's date
function TodayIcon({ color }: { color: string }) {
  const { colors } = useThemeStore();
  const today = new Date().getDate();
  return (
    <View style={styles.todayContainer}>
      {/* Main square with rounded corners except bottom-right */}
      <View style={[styles.todaySquare, { borderColor: color }]}>
        <Text style={[styles.todayDate, { color }]}>{today}</Text>
      </View>
      {/* Triangle to cut the corner */}
      <View
        style={[
          styles.todayTriangle,
          {
            borderTopColor: colors.background,
            borderRightColor: colors.background,
          }
        ]}
      />
      {/* Small fold indicator */}
      <View
        style={[
          styles.todayFold,
          {
            borderBottomColor: color,
            borderLeftColor: color,
          }
        ]}
      />
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

// Monochrome Planning Icon (stacked lines with sparkle)
function PlanningIcon({ color }: { color: string }) {
  return (
    <View style={styles.iconContainer}>
      {/* Stacked lines */}
      <View style={[styles.planLine, styles.planLine1, { backgroundColor: color }]} />
      <View style={[styles.planLine, styles.planLine2, { backgroundColor: color }]} />
      <View style={[styles.planLine, styles.planLine3, { backgroundColor: color }]} />
      {/* Sparkle indicator */}
      <View style={[styles.planSparkle, { backgroundColor: color }]} />
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
          title: 'Planning',
          tabBarIcon: ({ color }) => <PlanningIcon color={color} />,
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
  // Today icon - square with folded corner
  todayContainer: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todaySquare: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderRadius: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayDate: {
    fontSize: 11,
    fontWeight: '700',
  },
  todayTriangle: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 0,
    height: 0,
    borderStyle: 'solid',
    borderTopWidth: 6,
    borderRightWidth: 6,
    borderBottomWidth: 0,
    borderLeftWidth: 0,
    borderBottomColor: 'transparent',
    borderLeftColor: 'transparent',
  },
  todayFold: {
    position: 'absolute',
    bottom: 5,
    right: 5,
    width: 0,
    height: 0,
    borderStyle: 'solid',
    borderTopWidth: 0,
    borderRightWidth: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderTopColor: 'transparent',
    borderRightColor: 'transparent',
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
  // Planning icon - stacked lines with sparkle
  planLine: {
    position: 'absolute',
    height: 2,
    borderRadius: 1,
  },
  planLine1: {
    width: 16,
    top: 5,
    left: 2,
  },
  planLine2: {
    width: 12,
    top: 10,
    left: 2,
  },
  planLine3: {
    width: 14,
    top: 15,
    left: 2,
  },
  planSparkle: {
    position: 'absolute',
    width: 4,
    height: 4,
    borderRadius: 2,
    top: 3,
    right: 2,
  },
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
