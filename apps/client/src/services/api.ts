import { Platform } from 'react-native';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';

// Lazy load SecureStore only on native
let SecureStore: typeof import('expo-secure-store') | null = null;
const getSecureStore = async () => {
  if (Platform.OS === 'web') return null;
  if (!SecureStore) {
    SecureStore = await import('expo-secure-store');
  }
  return SecureStore;
};

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: any;
  headers?: Record<string, string>;
}

class ApiClient {
  private accessToken: string | null = null;

  setAccessToken(token: string | null) {
    this.accessToken = token;
    // Also persist to storage
    if (Platform.OS === 'web') {
      if (token) {
        localStorage.setItem('accessToken', token);
      } else {
        localStorage.removeItem('accessToken');
      }
    }
  }

  async getAccessToken(): Promise<string | null> {
    if (this.accessToken) return this.accessToken;

    if (Platform.OS === 'web') {
      this.accessToken = localStorage.getItem('accessToken');
    } else {
      const store = await getSecureStore();
      if (store) {
        this.accessToken = await store.getItemAsync('accessToken');
      }
    }

    return this.accessToken;
  }

  async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const { method = 'GET', body, headers = {} } = options;

    const accessToken = await this.getAccessToken();

    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...headers,
    };

    if (accessToken) {
      requestHeaders['Authorization'] = `Bearer ${accessToken}`;
    }

    const response = await fetch(`${API_URL}/api/v1${endpoint}`, {
      method,
      headers: requestHeaders,
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'include', // For web cookies
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error?.message || `HTTP ${response.status}`);
    }

    return response.json();
  }

  // Auth
  async getAuthConfig() {
    return this.request<{
      clientId: string;
      scopes: string[];
      authorizationEndpoint: string;
      tokenEndpoint: string;
    }>('/auth/mobile/config');
  }

  async exchangeCode(params: {
    code: string;
    codeVerifier: string;
    redirectUri: string;
  }) {
    return this.request<{
      accessToken: string;
      refreshToken: string;
      expiresIn: number;
    }>('/auth/mobile/exchange', {
      method: 'POST',
      body: params,
    });
  }

  async loginWithGoogleToken(googleAccessToken: string) {
    return this.request<{
      accessToken: string;
      refreshToken: string;
      expiresIn: number;
    }>('/auth/google/token', {
      method: 'POST',
      body: { accessToken: googleAccessToken },
    });
  }

  async refreshTokens(refreshToken: string) {
    return this.request<{
      accessToken: string;
      refreshToken: string;
      expiresIn: number;
    }>('/auth/refresh', {
      method: 'POST',
      body: { refreshToken },
    });
  }

  // Profile
  async getProfile() {
    return this.request<{
      id: string;
      email: string;
      name: string | null;
      avatarUrl: string | null;
      timezone: string;
      defaultTransportMode: string;
      hasGoogleCalendar: boolean;
      hasTelegram: boolean;
    }>('/me');
  }

  async updateProfile(data: {
    name?: string;
    timezone?: string;
    defaultTransportMode?: string;
  }) {
    return this.request('/me', {
      method: 'PUT',
      body: data,
    });
  }

  // Events
  async getEvents(params?: {
    startDate?: string;
    endDate?: string;
    types?: string[];
    includeExternal?: boolean;
    page?: number;
    limit?: number;
  }) {
    const searchParams = new URLSearchParams();
    if (params?.startDate) searchParams.set('startDate', params.startDate);
    if (params?.endDate) searchParams.set('endDate', params.endDate);
    if (params?.types) params.types.forEach((t) => searchParams.append('types', t));
    if (params?.includeExternal !== undefined)
      searchParams.set('includeExternal', String(params.includeExternal));
    if (params?.page) searchParams.set('page', String(params.page));
    if (params?.limit) searchParams.set('limit', String(params.limit));

    const query = searchParams.toString();
    return this.request<{
      events: any[];
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    }>(`/events${query ? `?${query}` : ''}`);
  }

  async createEvent(data: {
    title: string;
    type: string;
    startAt: string;
    endAt: string;
    locationId?: string;
    isLocked?: boolean;
    priority?: number;
    notes?: string;
  }) {
    return this.request('/events', {
      method: 'POST',
      body: data,
    });
  }

  async updateEvent(
    id: string,
    data: {
      title?: string;
      type?: string;
      startAt?: string;
      endAt?: string;
      locationId?: string;
      isLocked?: boolean;
      priority?: number;
      notes?: string;
    },
  ) {
    return this.request(`/events/${id}`, {
      method: 'PUT',
      body: data,
    });
  }

  async deleteEvent(id: string) {
    return this.request(`/events/${id}`, {
      method: 'DELETE',
    });
  }

  // Tasks
  async getTasks(params?: {
    status?: string[];
    page?: number;
    limit?: number;
  }) {
    const searchParams = new URLSearchParams();
    if (params?.status) params.status.forEach((s) => searchParams.append('status', s));
    if (params?.page) searchParams.set('page', String(params.page));
    if (params?.limit) searchParams.set('limit', String(params.limit));

    const query = searchParams.toString();
    return this.request<{
      tasks: any[];
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    }>(`/tasks${query ? `?${query}` : ''}`);
  }

  async markTaskDone(id: string) {
    return this.request(`/tasks/${id}/done`, {
      method: 'POST',
    });
  }

  // Planner
  async propose(text: string, options?: { preferredMode?: string; preferredDate?: string }) {
    return this.request<{
      proposals: any[];
      extractedIntent: any;
      warnings: string[];
    }>('/planner/propose', {
      method: 'POST',
      body: { text, ...options },
    });
  }

  async commitProposal(proposalId: string, overrides?: { title?: string; notes?: string }) {
    return this.request<{
      event: any;
      travelSegment: any;
      notificationsScheduled: number;
    }>('/planner/commit', {
      method: 'POST',
      body: { proposalId, overrides },
    });
  }

  // Google Calendar
  async getGoogleSyncStatus() {
    return this.request<{
      isConnected: boolean;
      lastSyncAt: string | null;
      managedCalendarId: string | null;
      syncErrors: string[];
    }>('/integrations/google/status');
  }

  async triggerGoogleSync() {
    return this.request<{
      success: boolean;
      imported: number;
      updated: number;
      deleted: number;
      errors: string[];
    }>('/integrations/google/sync', {
      method: 'POST',
    });
  }

  // Telegram
  async getTelegramConnectInfo() {
    return this.request<{
      configured: boolean;
      botUsername?: string;
      deepLink?: string;
      instructions?: string;
    }>('/integrations/telegram/connect');
  }

  // Settings
  async getSettings() {
    return this.request<{
      buffers: any[];
      constraints: any[];
      notifications: {
        reminderMinutesBefore: number[];
        weatherAlerts: boolean;
        trafficAlerts: boolean;
      };
    }>('/settings');
  }

  async updateSettings(data: {
    buffers?: any[];
    reminderMinutesBefore?: number[];
    weatherAlerts?: boolean;
    trafficAlerts?: boolean;
  }) {
    return this.request('/settings', {
      method: 'PUT',
      body: data,
    });
  }

  // Locations
  async getLocations() {
    return this.request<{
      locations: any[];
      total: number;
    }>('/locations');
  }
}

export const api = new ApiClient();
