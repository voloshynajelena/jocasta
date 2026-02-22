import { create } from 'zustand';
import { Platform } from 'react-native';

export type TaxiProvider = 'uber' | 'checker';
export type TransportMode = 'sedan' | 'motorcycle' | 'taxi' | 'transit';

export interface BufferRule {
  eventType: string;
  beforeMinutes: number;
  afterMinutes: number;
}

export interface Constraint {
  type: string;
  config: {
    start?: string;
    end?: string;
    minutes?: number;
    minutesPerDay?: number;
    mode?: string;
    fallback?: string;
  };
}

interface SettingsState {
  taxiProvider: TaxiProvider;
  transportMode: TransportMode;
  bufferRules: BufferRule[];
  constraints: Constraint[];
  setTaxiProvider: (provider: TaxiProvider) => void;
  setTransportMode: (mode: TransportMode) => void;
  updateBufferRule: (eventType: string, before: number, after: number) => void;
  updateConstraint: (type: string, config: Constraint['config']) => void;
}

const defaultBufferRules: BufferRule[] = [
  { eventType: 'appointment', beforeMinutes: 10, afterMinutes: 15 },
  { eventType: 'client_training', beforeMinutes: 15, afterMinutes: 10 },
  { eventType: 'personal_workout', beforeMinutes: 5, afterMinutes: 10 },
  { eventType: 'dog_walk', beforeMinutes: 5, afterMinutes: 5 },
  { eventType: 'meeting', beforeMinutes: 5, afterMinutes: 5 },
];

const defaultConstraints: Constraint[] = [
  { type: 'sleep', config: { start: '22:30', end: '06:00' } },
  { type: 'work', config: { start: '09:00', end: '17:00' } },
  { type: 'quiet_hours', config: { start: '21:00', end: '08:00' } },
  { type: 'min_gap', config: { minutes: 15 } },
  { type: 'max_travel', config: { minutesPerDay: 120 } },
  { type: 'preferred_mode', config: { mode: 'sedan', fallback: 'taxi' } },
];

const getSavedSettings = () => {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    try {
      const saved = localStorage.getItem('jocasta_settings');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {}
  }
  return null;
};

const saveSettings = (state: Partial<SettingsState>) => {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    try {
      const current = getSavedSettings() || {};
      localStorage.setItem('jocasta_settings', JSON.stringify({ ...current, ...state }));
    } catch {}
  }
};

const savedSettings = getSavedSettings();

export const useSettingsStore = create<SettingsState>((set) => ({
  taxiProvider: savedSettings?.taxiProvider || 'uber',
  transportMode: savedSettings?.transportMode || 'sedan',
  bufferRules: savedSettings?.bufferRules || defaultBufferRules,
  constraints: savedSettings?.constraints || defaultConstraints,

  setTaxiProvider: (provider) => {
    set({ taxiProvider: provider });
    saveSettings({ taxiProvider: provider });
  },

  setTransportMode: (mode) => {
    set({ transportMode: mode });
    saveSettings({ transportMode: mode });
  },

  updateBufferRule: (eventType, before, after) => {
    set((state) => {
      const newRules = state.bufferRules.map((rule) =>
        rule.eventType === eventType
          ? { ...rule, beforeMinutes: before, afterMinutes: after }
          : rule
      );
      saveSettings({ bufferRules: newRules });
      return { bufferRules: newRules };
    });
  },

  updateConstraint: (type, config) => {
    set((state) => {
      const newConstraints = state.constraints.map((constraint) =>
        constraint.type === type
          ? { ...constraint, config: { ...constraint.config, ...config } }
          : constraint
      );
      saveSettings({ constraints: newConstraints });
      return { constraints: newConstraints };
    });
  },
}));

// Transport mode multipliers for travel time
export const TRANSPORT_MULTIPLIERS: Record<TransportMode, number> = {
  sedan: 1.0,
  motorcycle: 0.85,
  taxi: 1.1, // includes wait time
  transit: 1.5, // buses are slower
};

// Taxi provider info
export const TAXI_PROVIDERS = {
  uber: {
    name: 'Uber',
    icon: '🚗',
    deepLink: 'uber://',
    webUrl: 'https://m.uber.com/ul/',
  },
  checker: {
    name: 'Checker Cabs',
    icon: '🚕',
    phone: '+14032999999',
    displayPhone: '(403) 299-9999',
  },
};
