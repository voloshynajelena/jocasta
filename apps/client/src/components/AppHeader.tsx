import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'expo-router';

import { useThemeStore } from '../store/themeStore';
import { useAuthStore } from '../store/authStore';

interface AppHeaderProps {
  onSync?: () => void;
  syncing?: boolean;
}

// Sun Icon for dark mode (click to switch to light)
function SunIcon({ color }: { color: string }) {
  return (
    <View style={headerIconStyles.iconContainer}>
      <View style={[headerIconStyles.sunCenter, { backgroundColor: color }]} />
      <View style={[headerIconStyles.sunRay, headerIconStyles.ray1, { backgroundColor: color }]} />
      <View style={[headerIconStyles.sunRay, headerIconStyles.ray2, { backgroundColor: color }]} />
      <View style={[headerIconStyles.sunRay, headerIconStyles.ray3, { backgroundColor: color }]} />
      <View style={[headerIconStyles.sunRay, headerIconStyles.ray4, { backgroundColor: color }]} />
    </View>
  );
}

// Moon Icon for light mode (click to switch to dark)
function MoonIcon({ color }: { color: string }) {
  return (
    <View style={headerIconStyles.iconContainer}>
      <View style={[headerIconStyles.moonOuter, { backgroundColor: color }]} />
      <View style={[headerIconStyles.moonCut]} />
    </View>
  );
}

const headerIconStyles = StyleSheet.create({
  iconContainer: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sunCenter: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  sunRay: {
    position: 'absolute',
    width: 3,
    height: 3,
    borderRadius: 1.5,
  },
  ray1: { top: 0, left: 9.5 },
  ray2: { bottom: 0, left: 9.5 },
  ray3: { left: 0, top: 9.5 },
  ray4: { right: 0, top: 9.5 },
  moonOuter: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  moonCut: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#1e293b',
    top: 0,
    right: 1,
  },
});

export function AppHeader({ onSync, syncing = false }: AppHeaderProps) {
  const router = useRouter();
  const { mode, colors, toggleTheme } = useThemeStore();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const [menuOpen, setMenuOpen] = useState(false);
  const spinAnim = useRef(new Animated.Value(0)).current;

  const handleSync = useCallback(() => {
    if (onSync) {
      Animated.loop(
        Animated.timing(spinAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        { iterations: 2 }
      ).start(() => spinAnim.setValue(0));
      onSync();
    }
  }, [onSync, spinAnim]);

  const handleLogout = async () => {
    setMenuOpen(false);
    await logout();
    router.replace('/(auth)/login');
  };

  return (
    <View style={[styles.header, { backgroundColor: colors.headerBg }]}>
      {/* Logo */}
      <View style={styles.logoContainer}>
        <Text style={styles.logo}>J.</Text>
      </View>

      {/* Right Actions */}
      <View style={styles.actions}>
        {/* Theme Toggle - Sun shows in dark mode, Moon shows in light mode */}
        <TouchableOpacity style={styles.iconButton} onPress={toggleTheme}>
          {mode === 'dark' ? <SunIcon color="#ffffff" /> : <MoonIcon color="#ffffff" />}
        </TouchableOpacity>

        {/* Profile */}
        <TouchableOpacity
          style={styles.avatarButton}
          onPress={() => setMenuOpen(!menuOpen)}
        >
          <View style={[styles.avatar, styles.avatarDefault]}>
            <Text style={styles.avatarText}>
              {user?.name?.charAt(0).toUpperCase() || 'U'}
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Dropdown Menu */}
      {menuOpen && (
        <View style={[styles.dropdown, { backgroundColor: colors.card }]}>
          <View style={styles.dropdownHeader}>
            <Text style={[styles.dropdownName, { color: colors.text }]}>
              {user?.name || 'Guest'}
            </Text>
            <Text style={[styles.dropdownEmail, { color: colors.textMuted }]}>
              {user?.email || ''}
            </Text>
          </View>

          <View style={[styles.dropdownDivider, { backgroundColor: colors.border }]} />

          <TouchableOpacity
            style={styles.dropdownItem}
            onPress={() => {
              setMenuOpen(false);
              router.push('/(tabs)/settings');
            }}
          >
            <View style={[styles.dropdownIconBox, { borderColor: colors.textMuted }]}>
              <View style={[styles.dropdownGearCenter, { borderColor: colors.textMuted }]} />
            </View>
            <Text style={[styles.dropdownText, { color: colors.text }]}>Settings</Text>
          </TouchableOpacity>

          <View style={[styles.dropdownDivider, { backgroundColor: colors.border }]} />

          <TouchableOpacity style={styles.dropdownItem} onPress={handleLogout}>
            <View style={[styles.dropdownIconBox]}>
              <View style={[styles.dropdownLogout, { backgroundColor: colors.error }]} />
            </View>
            <Text style={[styles.dropdownText, { color: colors.error }]}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Backdrop to close menu */}
      {menuOpen && (
        <TouchableOpacity
          style={styles.backdrop}
          onPress={() => setMenuOpen(false)}
          activeOpacity={1}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    zIndex: 100,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logo: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#10b981',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarButton: {
    marginLeft: 4,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarDefault: {
    backgroundColor: '#10b981',
  },
  avatarText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  dropdown: {
    position: 'absolute',
    top: 60,
    right: 16,
    width: 220,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 1000,
  },
  dropdownHeader: {
    padding: 16,
  },
  dropdownName: {
    fontSize: 16,
    fontWeight: '600',
  },
  dropdownEmail: {
    fontSize: 13,
    marginTop: 2,
  },
  dropdownDivider: {
    height: 1,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  dropdownIconBox: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropdownGearCenter: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
  },
  dropdownLogout: {
    width: 10,
    height: 10,
    borderRadius: 2,
  },
  dropdownText: {
    fontSize: 15,
  },
  backdrop: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    bottom: -1000,
    zIndex: 99,
  },
});
