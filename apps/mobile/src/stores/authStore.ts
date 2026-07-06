import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { getApiClient, AuthResponse, User } from '@bus/shared';
import { saveCallerIdCredentials } from '../services/callerIdService';

const REFRESH_KEY = 'bus_refresh_token';
const SALT_KEY = 'bus_user_salt';

interface AuthState {
  accessToken: string | null;
  user: User | null;
  salt: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setSession: (data: AuthResponse) => Promise<void>;
  updateUser: (partial: Partial<User>) => void;
  refreshToken: () => Promise<void>;
  logout: () => Promise<void>;
  initialize: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  salt: null,
  isAuthenticated: false,
  isLoading: true,

  updateUser: (partial) => {
    set((state) => ({ user: state.user ? { ...state.user, ...partial } : null }));
  },

  setSession: async (data) => {
    await SecureStore.setItemAsync(REFRESH_KEY, data.refreshToken);
    await SecureStore.setItemAsync(SALT_KEY, data.salt);
    set({ accessToken: data.accessToken, user: data.user, salt: data.salt, isAuthenticated: true });
    const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? '';
    saveCallerIdCredentials(data.accessToken, apiUrl).catch(() => {});
  },

  refreshToken: async () => {
    const rt = await SecureStore.getItemAsync(REFRESH_KEY);
    if (!rt) throw new Error('No refresh token');
    const { data } = await getApiClient().post<{ accessToken: string }>('/api/auth/refresh', { refreshToken: rt });
    set({ accessToken: data.accessToken });
  },

  logout: async () => {
    try {
      const rt = await SecureStore.getItemAsync(REFRESH_KEY);
      if (rt) await getApiClient().post('/api/auth/logout', { refreshToken: rt }).catch(() => {});
    } finally {
      await SecureStore.deleteItemAsync(REFRESH_KEY);
      await SecureStore.deleteItemAsync(SALT_KEY);
      set({ accessToken: null, user: null, salt: null, isAuthenticated: false });
    }
  },

  initialize: async () => {
    try {
      const [rt, salt] = await Promise.all([
        SecureStore.getItemAsync(REFRESH_KEY),
        SecureStore.getItemAsync(SALT_KEY),
      ]);
      if (!rt) { set({ isLoading: false }); return; }
      const { data } = await getApiClient().post<{ accessToken: string }>('/api/auth/refresh', { refreshToken: rt });
      const { data: user } = await getApiClient().get<User>('/api/user/me');
      set({ accessToken: data.accessToken, user, salt, isAuthenticated: true });
      const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? '';
      saveCallerIdCredentials(data.accessToken, apiUrl).catch(() => {});
    } catch {
      await SecureStore.deleteItemAsync(REFRESH_KEY);
      await SecureStore.deleteItemAsync(SALT_KEY);
    } finally {
      set({ isLoading: false });
    }
  },
}));
