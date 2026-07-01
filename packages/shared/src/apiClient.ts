import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';

let client: AxiosInstance | null = null;
let _getAccessToken: (() => string | null) | null = null;
let _refreshTokenFn: (() => Promise<void>) | null = null;
let _logout: (() => void) | null = null;

export function configureApiClient(opts: {
  baseURL: string;
  getAccessToken: () => string | null;
  refreshToken: () => Promise<void>;
  logout: () => void;
}) {
  _getAccessToken = opts.getAccessToken;
  _refreshTokenFn = opts.refreshToken;
  _logout = opts.logout;

  client = axios.create({ baseURL: opts.baseURL, timeout: 15_000 });

  client.interceptors.request.use((config: InternalAxiosRequestConfig) => {
    const token = _getAccessToken?.();
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  });

  client.interceptors.response.use(
    (r) => r,
    async (err) => {
      const original = err.config;
      if (err.response?.status === 401 && !original._retry) {
        original._retry = true;
        try {
          await _refreshTokenFn?.();
          const token = _getAccessToken?.();
          if (token) original.headers.Authorization = `Bearer ${token}`;
          return client!(original);
        } catch {
          _logout?.();
        }
      }
      return Promise.reject(err);
    }
  );
}

export function getApiClient(): AxiosInstance {
  if (!client) throw new Error('API client not configured — call configureApiClient() first');
  return client;
}
